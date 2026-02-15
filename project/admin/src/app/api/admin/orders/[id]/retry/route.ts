import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

// Admin auth check
async function checkAdminAuth() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin-session');

  if (!sessionCookie) {
    return null;
  }

  try {
    const session = JSON.parse(sessionCookie.value);
    if (session.role !== 'admin') {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin auth
    const session = await checkAdminAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await params;

    // Get Supabase admin client
    const supabase = createClient();

    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if the order has a failed Printify status
    if (order.printify_status !== 'failed') {
      return NextResponse.json(
        { error: 'Order does not have a failed Printify status' },
        { status: 400 }
      );
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items found for this order' },
        { status: 400 }
      );
    }

    // Prepare Printify order payload
    const printifyLineItems = items.map((item) => ({
      product_id: item.printify_product_id,
      variant_id: item.printify_variant_id,
      quantity: item.quantity,
    }));

    // Submit to Printify API
    const printifyResponse = await fetch(
      `https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/orders.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: orderId,
          label: `Order ${orderId.substring(0, 8)}`,
          line_items: printifyLineItems,
          shipping_method: 1, // Standard shipping
          send_shipping_notification: true,
          address_to: order.shipping_address,
        }),
      }
    );

    if (!printifyResponse.ok) {
      const errorData = await printifyResponse.json();
      throw new Error(errorData.message || 'Printify API error');
    }

    const printifyOrder = await printifyResponse.json();

    // Update order with new Printify order ID and reset status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        printify_order_id: printifyOrder.id,
        printify_status: 'submitted',
        status: 'submitted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw new Error('Failed to update order status');
    }

    // Create audit log entry
    await supabase.from('audit_log').insert({
      user_id: session.id,
      action: 'order.printify.retry',
      resource_type: 'order',
      resource_id: orderId,
      details: {
        printify_order_id: printifyOrder.id,
        previous_status: 'failed',
        new_status: 'submitted',
      },
    });

    return NextResponse.json({
      success: true,
      printify_order_id: printifyOrder.id,
      message: 'Order successfully resubmitted to Printify',
    });
  } catch (error: any) {
    console.error('Printify retry error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retry Printify submission' },
      { status: 500 }
    );
  }
}
