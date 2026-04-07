import { createClient } from '@/lib/supabase-admin';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth-middleware';
import { sanitizeSearch } from '@/lib/query-sanitizer';

export const GET = withAuth(async (req: NextRequest, session: unknown) => {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] });
    }

    const supabase = createClient();
    const searchTerm = sanitizeSearch(query).toLowerCase();

    // Search products
    const { data: products } = await supabase
      .from('products')
      .select('id, title, description, base_price_cents, currency')
      .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      .limit(5);

    // Search customers (users)
    const { data: customers } = await supabase
      .from('users')
      .select('id, email, name')
      .or(`email.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
      .limit(5);

    // Search orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, total_cents, currency, created_at, users(name, email)')
      .or(`id::text.ilike.%${searchTerm}%,status.ilike.%${searchTerm}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    // Format results
    const results = {
      products: (products || []).map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.description?.substring(0, 60) || '',
        type: 'product',
        url: `/products/${p.id}`,
        meta: `${((p.base_price_cents || 0) / 100).toFixed(2)} ${p.currency?.toUpperCase() || 'EUR'}`,
      })),
      customers: (customers || []).map((c) => ({
        id: c.id,
        title: c.name || c.email,
        subtitle: c.email,
        type: 'customer',
        url: `/customers`,
        meta: '',
      })),
      orders: (orders || []).map((o) => {
        const user = Array.isArray(o.users) ? o.users[0] : o.users;
        return {
          id: o.id,
          title: `Order ${o.id.substring(0, 8)}...`,
          subtitle: user?.email || 'Guest',
          type: 'order',
          url: `/orders/${o.id}`,
          meta: `${o.status} • ${((o.total_cents || 0) / 100).toFixed(2)} ${o.currency?.toUpperCase() || 'EUR'}`,
        };
      }),
    };

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
});
