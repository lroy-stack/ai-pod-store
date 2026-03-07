import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/rbac';

export const GET = withPermission('products', 'read', async (
  _req: NextRequest,
  _session,
  context?: { params: Promise<{ id: string }> }
) => {
  if (!context) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { id } = await context.params;

  // Fetch order_items for this product
  const { data: orderItems } = await supabaseAdmin
    .from('order_items')
    .select('quantity, unit_price_cents, cost_cents')
    .eq('product_id', id);

  // Fetch product_reviews for this product
  const { data: reviews } = await supabaseAdmin
    .from('product_reviews')
    .select('rating')
    .eq('product_id', id);

  // Fetch returns for this product (via order_items join)
  // Returns table has order_id; order_items has product_id
  const { data: returnItems } = await supabaseAdmin
    .from('returns')
    .select('id, order_id')
    .eq('product_id', id);

  // Compute metrics
  const totalRevenueCents = (orderItems ?? []).reduce(
    (sum, item) => sum + (item.unit_price_cents ?? 0) * (item.quantity ?? 1),
    0
  );

  const orderCount = (orderItems ?? []).reduce(
    (sum, item) => sum + (item.quantity ?? 1),
    0
  );

  const avgRating =
    (reviews ?? []).length > 0
      ? (reviews ?? []).reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews!.length
      : null;

  // Margin: (revenue - cost) / revenue * 100
  const totalCostCents = (orderItems ?? []).reduce(
    (sum, item) => sum + (item.cost_cents ?? 0) * (item.quantity ?? 1),
    0
  );
  const marginPct =
    totalRevenueCents > 0
      ? ((totalRevenueCents - totalCostCents) / totalRevenueCents) * 100
      : null;

  const returnCount = (returnItems ?? []).length;

  return NextResponse.json({
    metrics: {
      total_revenue_cents: totalRevenueCents,
      order_count: orderCount,
      avg_rating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
      margin_pct: marginPct !== null ? Math.round(marginPct * 10) / 10 : null,
      return_count: returnCount,
      review_count: (reviews ?? []).length,
    },
  });
});
