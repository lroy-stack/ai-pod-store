import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/rbac';
import { logUpdate } from '@/lib/audit';
import { z } from 'zod';

const bulkPriceUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid(),
      base_price_cents: z.number().int().min(1),
    })
  ).min(1).max(500),
});

// GET: returns products with avg_base_cost_cents for bulk price editor
export const GET = withPermission('products', 'read', async (_req: NextRequest) => {
  try {
    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, title, base_price_cents, currency, status, pod_provider')
      .eq('status', 'active')
      .order('title');

    if (prodErr) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    const productIds = (products || []).map((p) => p.id);

    // Batch-fetch enabled variant costs
    const { data: variants, error: varErr } = await supabaseAdmin
      .from('product_variants')
      .select('product_id, cost_cents')
      .in('product_id', productIds)
      .eq('is_enabled', true)
      .not('cost_cents', 'is', null);

    if (varErr) {
      console.error('Variant fetch error:', varErr);
    }

    // Compute avg cost per product
    const costMap = new Map<string, number[]>();
    (variants || []).forEach((v) => {
      if (!costMap.has(v.product_id)) costMap.set(v.product_id, []);
      if (v.cost_cents != null) costMap.get(v.product_id)!.push(v.cost_cents);
    });

    const productsWithCost = (products || []).map((p) => {
      const costs = costMap.get(p.id) || [];
      const avg_cost_cents =
        costs.length > 0
          ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length)
          : null;
      return { ...p, avg_cost_cents };
    });

    return NextResponse.json({ products: productsWithCost });
  } catch (err) {
    console.error('Bulk price GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH: bulk update prices
export const PATCH = withPermission('products', 'update', async (req: NextRequest, session) => {
  try {
    const body = await req.json();
    const parsed = bulkPriceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { updates } = parsed.data;
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const update of updates) {
      const { data: old } = await supabaseAdmin
        .from('products')
        .select('base_price_cents, title')
        .eq('id', update.id)
        .single();

      const { error } = await supabaseAdmin
        .from('products')
        .update({ base_price_cents: update.base_price_cents, updated_at: new Date().toISOString() })
        .eq('id', update.id);

      if (error) {
        console.error(`Bulk price update failed for ${update.id}:`, error);
        results.push({ id: update.id, success: false, error: 'Update failed' });
      } else {
        await logUpdate(
          session?.email || 'unknown',
          'products',
          update.id,
          { base_price_cents: old?.base_price_cents },
          { base_price_cents: update.base_price_cents }
        );
        results.push({ id: update.id, success: true });
      }
    }

    const failed = results.filter((r) => !r.success);
    return NextResponse.json({
      updated: results.filter((r) => r.success).length,
      failed: failed.length,
      results,
    });
  } catch (err) {
    console.error('Bulk price PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
