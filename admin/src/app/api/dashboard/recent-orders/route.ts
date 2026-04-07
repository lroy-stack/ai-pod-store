import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async () => {
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
    const formattedOrders = orders?.map((order) => {
      const user = Array.isArray(order.users) ? order.users[0] : order.users;
      return {
        id: order.id,
        status: order.status,
        total: order.total_cents / 100, // Convert cents to currency
        currency: order.currency || 'EUR',
        createdAt: order.created_at,
        customerName: user?.name || 'Guest',
        customerEmail: user?.email || 'N/A',
      };
    }) || [];

    return NextResponse.json(formattedOrders);
  } catch (error) {
    console.error('Recent orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent orders' },
      { status: 500 }
    );
  }
});
