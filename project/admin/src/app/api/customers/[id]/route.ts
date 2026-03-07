import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withAuth } from '@/lib/auth-middleware';
import { withPermission } from '@/lib/rbac';
import { logUpdate } from '@/lib/audit';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };
type AdminSession = { email: string; userId: string; role: string };

const updateSchema = z.object({
  account_status: z.enum(['active', 'disabled', 'suspended']).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// GET /api/customers/[id] — customer detail
export const GET = withAuth(async (_req: NextRequest, _session, context?: RouteContext) => {
  if (!context) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { id } = await context.params;

  // Fetch user
  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id, email, name, created_at, avatar_url, account_status, tags, role, locale, currency, phone, email_verified, last_login_at, tier')
    .eq('id', id)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Fetch orders
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, total_cents, currency, status, created_at, external_order_id')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Compute stats from paid orders only
  const paidOrders = (orders || []).filter((o) =>
    ['paid', 'processing', 'in_production', 'shipped', 'delivered'].includes(o.status)
  );
  const totalSpentCents = paidOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0);
  const orderCount = paidOrders.length;
  const avgOrderCents = orderCount > 0 ? Math.round(totalSpentCents / orderCount) : 0;

  // CLV
  const daysSinceJoined = Math.max(
    1,
    Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
  );
  const yearsActive = daysSinceJoined / 365;
  const purchaseFrequencyPerYear = orderCount / Math.max(yearsActive, 0.1);
  const avgOrderValue = orderCount > 0 ? totalSpentCents / orderCount : 0;
  const clvCents = Math.round(avgOrderValue * purchaseFrequencyPerYear * 3);

  // RFM segment
  const lastPaidOrder = paidOrders[0];
  const daysSinceLast = lastPaidOrder
    ? Math.floor((Date.now() - new Date(lastPaidOrder.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  let rfmSegment = 'No Orders';
  if (orderCount > 0) {
    if (totalSpentCents >= 50000 && orderCount >= 3 && daysSinceLast <= 90) rfmSegment = 'VIP';
    else if (totalSpentCents >= 20000 && orderCount >= 2) rfmSegment = 'Champion';
    else if (orderCount >= 4 && daysSinceLast <= 180) rfmSegment = 'Loyal';
    else if (orderCount >= 2 && daysSinceLast > 90) rfmSegment = 'At Risk';
    else if (daysSinceLast > 180) rfmSegment = 'Churned';
    else if (orderCount === 1 && daysSinceLast <= 30) rfmSegment = 'New';
    else rfmSegment = 'Regular';
  }

  // Shipping addresses
  const { data: addresses } = await supabaseAdmin
    .from('shipping_addresses')
    .select('*')
    .eq('user_id', id)
    .order('is_default', { ascending: false });

  // Wishlist count
  const { count: wishlistCount } = await supabaseAdmin
    .from('wishlist_items')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', id);

  return NextResponse.json({
    user: {
      ...user,
      account_status: (user as Record<string, unknown>).account_status ?? 'active',
      tags: (user as Record<string, unknown>).tags ?? [],
    },
    stats: {
      order_count: orderCount,
      total_spent_cents: totalSpentCents,
      avg_order_cents: avgOrderCents,
      clv_cents: clvCents,
      rfm_segment: rfmSegment,
      wishlist_count: wishlistCount ?? 0,
    },
    orders: orders || [],
    addresses: addresses || [],
  });
});

// PATCH /api/customers/[id] — update tags or account_status
export const PATCH = withPermission('customers', 'update', async (req: NextRequest, session: AdminSession, context?: RouteContext) => {
  if (!context) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { id } = await context.params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.account_status !== undefined) updates.account_status = parsed.data.account_status;
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: old } = await supabaseAdmin
    .from('users')
    .select('account_status, tags')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[customers/[id] PATCH] update error:', error);
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 });
  }

  await logUpdate(session?.email || 'unknown', 'customers', id, old, updates);

  return NextResponse.json({ success: true, ...updates });
});

// POST /api/customers/[id] — account actions (password reset, etc.)
export const POST = withPermission('customers', 'update', async (req: NextRequest, session: AdminSession, context?: RouteContext) => {
  if (!context) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { id } = await context.params;

  const body = await req.json();
  const { action } = body;

  if (action === 'send_password_reset') {
    // Trigger Supabase password reset email
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', id)
      .single();

    if (!user?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Use Supabase Admin API to generate a password reset link
    // Note: supabaseAdmin is the service role client
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });

    if (error) {
      console.error('[customers/[id] POST] reset link error:', error);
      return NextResponse.json({ error: 'Failed to generate reset link' }, { status: 500 });
    }

    await logUpdate(session?.email || 'unknown', 'customers', id, {}, { action: 'password_reset_sent' });
    return NextResponse.json({ success: true, message: 'Password reset email sent' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
});
