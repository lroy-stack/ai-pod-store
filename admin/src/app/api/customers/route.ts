import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/auth-middleware';
import { sanitizeSearch } from '@/lib/query-sanitizer';

// RFM segment computation
// Recency: days since last order
// Frequency: order count
// Monetary: total_spent_cents
function computeRfmSegment(
  orderCount: number,
  totalSpentCents: number,
  lastOrderAt: string | null,
): string {
  if (orderCount === 0) return 'No Orders';

  const daysSinceLast = lastOrderAt
    ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // VIP: high spend + recent + frequent
  if (totalSpentCents >= 50000 && orderCount >= 3 && daysSinceLast <= 90) return 'VIP';
  // Champion: very high spend
  if (totalSpentCents >= 20000 && orderCount >= 2) return 'Champion';
  // Loyal: frequent orders, decent spend
  if (orderCount >= 4 && daysSinceLast <= 180) return 'Loyal';
  // At Risk: bought before but not recently
  if (orderCount >= 2 && daysSinceLast > 90) return 'At Risk';
  // Churned: haven't ordered in 6+ months
  if (daysSinceLast > 180) return 'Churned';
  // New: only 1 order, recent
  if (orderCount === 1 && daysSinceLast <= 30) return 'New';
  // Regular: everything else with orders
  return 'Regular';
}

// CLV: avg_order_value × purchase_frequency_per_year × 3
function computeClv(orderCount: number, totalSpentCents: number, joinedAt: string): number {
  if (orderCount === 0) return 0;
  const avgOrderValue = totalSpentCents / orderCount;
  const daysSinceJoined = Math.max(
    1,
    Math.floor((Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60 * 24))
  );
  const yearsActive = daysSinceJoined / 365;
  const purchaseFrequencyPerYear = orderCount / Math.max(yearsActive, 0.1);
  return Math.round(avgOrderValue * purchaseFrequencyPerYear * 3);
}

export const GET = withAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') ? sanitizeSearch(searchParams.get('search')!) : '';
    const segment = searchParams.get('segment') || '';
    const tag = searchParams.get('tag') || '';
    const offset = (page - 1) * limit;

    // Fetch users (role=customer) with server-side search filtering
    let usersQuery = supabaseAdmin
      .from('users')
      .select('id, email, name, created_at, avatar_url, account_status, tags, role', { count: 'exact' })
      .eq('role', 'customer')
      .order('created_at', { ascending: false });

    // Push search filter to DB level using parameterized ilike
    if (search) {
      usersQuery = usersQuery.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    }

    const { data: users, error: usersErr, count: _totalUsers } = await usersQuery;

    if (usersErr) {
      console.error('Users fetch error:', usersErr);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    const userIds = (users || []).map((u) => u.id);

    // Batch-fetch orders for matching users only
    const { data: orders, error: ordersErr } = userIds.length > 0
      ? await supabaseAdmin
          .from('orders')
          .select('id, user_id, total_cents, currency, created_at, status')
          .in('user_id', userIds)
          .in('status', ['paid', 'processing', 'in_production', 'shipped', 'delivered'])
      : { data: [], error: null };

    if (ordersErr) {
      console.error('Orders fetch error:', ordersErr);
    }

    // Aggregate orders per user
    const orderMap = new Map<
      string,
      { count: number; totalCents: number; currency: string; lastAt: string | null }
    >();
    (orders || []).forEach((o) => {
      const uid = o.user_id;
      if (!uid) return;
      const ex = orderMap.get(uid);
      if (ex) {
        ex.count += 1;
        ex.totalCents += o.total_cents || 0;
        if (!ex.lastAt || (o.created_at && o.created_at > ex.lastAt)) {
          ex.lastAt = o.created_at;
        }
      } else {
        orderMap.set(uid, {
          count: 1,
          totalCents: o.total_cents || 0,
          currency: o.currency || 'eur',
          lastAt: o.created_at,
        });
      }
    });

    // Build enriched customer list
    let customers = (users || []).map((u) => {
      const agg = orderMap.get(u.id) || { count: 0, totalCents: 0, currency: 'eur', lastAt: null };
      const rfmSegment = computeRfmSegment(agg.count, agg.totalCents, agg.lastAt);
      const clvCents = computeClv(agg.count, agg.totalCents, u.created_at);
      const avgOrderCents = agg.count > 0 ? Math.round(agg.totalCents / agg.count) : 0;
      return {
        id: u.id,
        email: u.email,
        name: u.name || u.email,
        created_at: u.created_at,
        avatar_url: u.avatar_url ?? null,
        account_status: (u as { account_status?: string }).account_status ?? 'active',
        tags: (u as { tags?: string[] }).tags ?? [],
        order_count: agg.count,
        total_spent_cents: agg.totalCents,
        currency: agg.currency,
        rfm_segment: rfmSegment,
        clv_cents: clvCents,
        avg_order_cents: avgOrderCents,
        last_order_at: agg.lastAt,
      };
    });

    // Apply filters (search already applied at DB level)
    if (segment) {
      customers = customers.filter((c) => c.rfm_segment === segment);
    }
    if (tag) {
      customers = customers.filter((c) => c.tags.includes(tag));
    }

    const total = customers.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = customers.slice(offset, offset + limit);

    return NextResponse.json({
      customers: paginated,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error('Customers GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
