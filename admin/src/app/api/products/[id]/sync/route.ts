/**
 * POST /api/products/[id]/sync — Sync a single product from Printful
 *
 * Fetches fresh data from Printful API, updates Supabase product + variants,
 * and sets last_synced_at to now.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';
import { printfulFetch, type PrintfulProductDetail } from '@/lib/printful';

export const POST = withPermission('products', 'update', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params;

  try {
    // Get the product from Supabase to find provider_product_id
    const { data: product, error: dbError } = await supabaseAdmin
      .from('products')
      .select('id, provider_product_id, pod_provider, title')
      .eq('id', id)
      .single();

    if (dbError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.provider_product_id) {
      return NextResponse.json({ error: 'Product has no provider link — cannot sync' }, { status: 400 });
    }

    // Fetch from Printful
    const { data: printfulData } = await printfulFetch<PrintfulProductDetail>(
      `/store/products/${product.provider_product_id}`
    );

    const syncProduct = printfulData.sync_product;
    const syncVariants = printfulData.sync_variants;

    // Update product in Supabase
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .update({
        title: syncProduct.name,
        status: syncProduct.is_ignored ? 'draft' : 'active',
        last_synced_at: now,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Product sync update error:', updateError);
      return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
    }

    // Sync variants
    let variantsSynced = 0;
    for (const sv of syncVariants) {
      const variantData = {
        product_id: id,
        external_variant_id: String(sv.variant_id),
        title: sv.name,
        price_cents: Math.round(parseFloat(sv.retail_price) * 100),
        is_enabled: !sv.is_ignored,
        is_available: sv.synced,
        image_url: sv.product.image || null,
      };

      // Parse size/color from variant name (format: "Product / Color / Size")
      const parts = sv.name.split(' / ');
      if (parts.length >= 3) {
        Object.assign(variantData, {
          color: parts[1],
          size: parts[2],
        });
      } else if (parts.length === 2) {
        Object.assign(variantData, {
          color: parts[1],
        });
      }

      const { error: variantError } = await supabaseAdmin
        .from('product_variants')
        .upsert(variantData, { onConflict: 'product_id,external_variant_id' });

      if (!variantError) variantsSynced++;
    }

    return NextResponse.json({
      status: 'synced',
      product_id: id,
      provider_product_id: product.provider_product_id,
      variants_synced: variantsSynced,
      synced_at: now,
    });
  } catch (error) {
    console.error('Product sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
});
