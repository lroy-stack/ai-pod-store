import { createClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';

export const GET = withAuth(async (req, session, context) => {
  const { email: rawEmail } = await context.params;
  const email = decodeURIComponent(rawEmail);
  try {
    const supabase = createClient();

    // First get the user ID from the email
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (userError || \!users || users.length === 0) {
      return NextResponse.json([]);
    }

    const userId = users[0].id;

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, status, total_cents, currency, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer orders:', error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Transform to include total in decimal format
    const formattedOrders = orders?.map((order) => ({
      id: order.id,
      status: order.status,
      total: (order.total_cents || 0) / 100,
      currency: order.currency,
      created_at: order.created_at,
    })) || [];

    return NextResponse.json(formattedOrders);
  } catch (error) {
    console.error('Error in customer orders API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
