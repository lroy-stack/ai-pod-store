import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withPermission } from '@/lib/rbac';
import { logUpdate } from '@/lib/audit';
import { withValidation } from '@/lib/validation';
import { z } from 'zod';

const productUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  base_price_cents: z.number().int().min(0).optional(),
  currency: z.enum(['EUR', 'USD', 'GBP', 'eur', 'usd', 'gbp']).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  stock: z.number().int().min(0).optional(),
  design_id: z.string().uuid().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  // SEO fields
  slug: z.string().max(200).optional().nullable(),
  meta_title: z.string().max(200).optional().nullable(),
  meta_description: z.string().max(500).optional().nullable(),
  // GPSR fields
  gpsr_info: z.record(z.string(), z.unknown()).optional().nullable(),
  // Images array
  images: z.array(z.object({
    src: z.string(),
    position: z.number().optional(),
    is_primary: z.boolean().optional(),
  })).optional().nullable(),
});

// GET requires 'read' permission on 'products' resource
export const GET = withPermission('products', 'read', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    if (!context) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { id } = await context.params;

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Compute avg base cost from enabled variants
    const { data: variants } = await supabaseAdmin
      .from('product_variants')
      .select('cost_cents')
      .eq('product_id', id)
      .eq('is_enabled', true);

    const costsWithData = (variants ?? []).filter((v) => v.cost_cents !== null && v.cost_cents > 0);
    const avgBaseCostCents =
      costsWithData.length > 0
        ? Math.round(costsWithData.reduce((s, v) => s + (v.cost_cents ?? 0), 0) / costsWithData.length)
        : 0;

    return NextResponse.json({ product: { ...product, avg_base_cost_cents: avgBaseCostCents } });
  } catch (error) {
    console.error('Product fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
});

// PATCH requires 'update' permission on 'products' resource
export const PATCH = withPermission('products', 'update', withValidation(productUpdateSchema, async (
  req: NextRequest,
  validatedData,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  try {
    if (!context) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { id } = await context.params;

    // Fetch current product state (before update)
    const { data: beforeProduct, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !beforeProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Perform update
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Product update error:', error);
      return NextResponse.json(
        { error: 'Failed to update product' },
        { status: 500 }
      );
    }

    // Log audit event with before/after values
    await logUpdate(session.userId, 'product', id, beforeProduct, product, session.email);

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}));
