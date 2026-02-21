import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const orderId = params.id;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        user:user_id (
          id,
          email,
          name
        )
      `)
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Order fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch order', details: error.message },
        { status: 404 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Fetch order items (line_items) with personalization details
    const { data: lineItems, error: itemsError } = await supabaseAdmin
      .from('order_line_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Order items fetch error:', itemsError);
    }

    return NextResponse.json({
      order: {
        ...order,
        items: lineItems || []
      }
    });
  } catch (error: any) {
    console.error('Order API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
