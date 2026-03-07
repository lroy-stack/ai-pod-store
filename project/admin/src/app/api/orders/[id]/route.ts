import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, session, context) => {
  const { id: orderId } = await context.params;
  try {
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
        { error: 'Failed to fetch order' },
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

    // Fetch user order count (for first-time customer fraud check)
    let userOrderCount = 0;
    if (order.user_id) {
      const { count } = await supabaseAdmin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', order.user_id);
      userOrderCount = count ?? 0;
    }

    return NextResponse.json({
      order: {
        ...order,
        items: lineItems || [],
        user_order_count: userOrderCount,
      }
    });
  } catch (error: any) {
    console.error('Order API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
