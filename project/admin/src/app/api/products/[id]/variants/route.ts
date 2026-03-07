import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/rbac';
import { logUpdate } from '@/lib/audit';
import { z } from 'zod';

const variantUpdateSchema = z.object({
  price_cents: z.number().int().min(0).optional(),
  is_enabled: z.boolean().optional(),
  is_available: z.boolean().optional(),
});

// GET /api/products/[id]/variants — list variants for a product
export const GET = withPermission('products', 'read', async (
  _req: NextRequest,
  _session,
  context?: { params: Promise<{ id: string }> }
) => {
  if (!context) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { id } = await context.params;

  const { data: variants, error } = await supabaseAdmin
    .from('product_variants')
    .select('id, product_id, size, color, price_cents, cost_cents, is_enabled, is_available, sku, image_url, color_hex')
    .eq('product_id', id)
    .order('color')
    .order('size');

  if (error) {
    console.error('[variants GET] fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch variants' }, { status: 500 });
  }

  return NextResponse.json({ variants: variants ?? [] });
});

// PATCH /api/products/[id]/variants/[variantId] — update a single variant
// Since Next.js route params only go one level, we use a query param for variant id
export const PATCH = withPermission('products', 'update', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  if (!context) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { id } = await context.params;
  const url = new URL(req.url);
  const variantId = url.searchParams.get('variantId');

  if (!variantId) {
    return NextResponse.json({ error: 'variantId query param required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = variantUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: oldVariant } = await supabaseAdmin
    .from('product_variants')
    .select('*')
    .eq('id', variantId)
    .eq('product_id', id)
    .single();

  const { data: variant, error } = await supabaseAdmin
    .from('product_variants')
    .update(updates)
    .eq('id', variantId)
    .eq('product_id', id)
    .select()
    .single();

  if (error) {
    console.error('[variants PATCH] update error:', error);
    return NextResponse.json({ error: 'Failed to update variant' }, { status: 500 });
  }

  await logUpdate(
    session?.email ?? 'unknown',
    'variant',
    variantId,
    oldVariant,
    variant
  );

  return NextResponse.json({ variant });
});
