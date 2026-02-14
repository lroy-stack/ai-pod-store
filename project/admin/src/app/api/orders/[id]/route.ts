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

    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('Order API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
