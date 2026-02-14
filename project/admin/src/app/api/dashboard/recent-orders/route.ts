import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch the 5 most recent orders
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('id, status, total_cents, currency, created_at, user_id, users(name, email)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Recent orders fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recent orders' },
        { status: 500 }
      );
    }

    // Transform the data for the frontend
    const formattedOrders = orders?.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total_cents / 100, // Convert cents to currency
      currency: order.currency || 'EUR',
      createdAt: order.created_at,
      customerName: order.users?.name || 'Guest',
      customerEmail: order.users?.email || 'N/A',
    })) || [];

    return NextResponse.json(formattedOrders);
  } catch (error) {
    console.error('Recent orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent orders' },
      { status: 500 }
    );
  }
}
