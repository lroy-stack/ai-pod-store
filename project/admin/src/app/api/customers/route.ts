import { createClient } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/rbac';

export async function GET(req: Request) {
  // Require authentication
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized - admin session required' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const supabase = createClient();

    // Get all orders with user information
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, total_cents, currency, user_id, users(name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Aggregate customer data
    const customerMap = new Map<string, {
      email: string;
      name: string;
      orderCount: number;
      totalSpent: number;
      currency: string;
    }>();

    orders?.forEach((order) => {
      const user = Array.isArray(order.users) ? order.users[0] : order.users;
      const email = user?.email;
      if (!email) return;

      const existing = customerMap.get(email);
      if (existing) {
        existing.orderCount += 1;
        existing.totalSpent += (order.total_cents || 0) / 100;
      } else {
        customerMap.set(email, {
          email,
          name: user?.name || email,
          orderCount: 1,
          totalSpent: (order.total_cents || 0) / 100,
          currency: order.currency || 'eur',
        });
      }
    });

    // Convert to array and sort by total spent
    let customers = Array.from(customerMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent);

    // Apply search filter
    if (search) {
      const query = search.toLowerCase();
      customers = customers.filter(
        (c) =>
          c.email.toLowerCase().includes(query) ||
          c.name.toLowerCase().includes(query)
      );
    }

    // Calculate pagination
    const total = customers.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedCustomers = customers.slice(offset, offset + limit);

    return NextResponse.json({
      customers: paginatedCustomers,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error in customers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
