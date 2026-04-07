/**
 * GET /api/products/[id]/printful — Get Printful provider data for a product
 *
 * Proxies to Printful API and returns full product detail with variants,
 * files, mockups, and options. Used by PrintfulSyncPanel component.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';
import { printfulFetch, type PrintfulProductDetail } from '@/lib/printful';

export const GET = withPermission('products', 'read', async (
  req: NextRequest,
  session,
  context?: { params: Promise<{ id: string }> }
) => {
  const { id } = await context!.params;

  try {
    // Get provider_product_id from Supabase
    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('id, provider_product_id, pod_provider, last_synced_at')
      .eq('id', id)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!product.provider_product_id) {
      return NextResponse.json({
        provider: null,
        message: 'Product has no provider link',
      });
    }

    // Fetch from Printful
    const { data: printfulData } = await printfulFetch<PrintfulProductDetail>(
      `/store/products/${product.provider_product_id}`
    );

    // Compute diff: what changed since last sync?
    const variants = printfulData.sync_variants.map(sv => ({
      id: sv.id,
      name: sv.name,
      variant_id: sv.variant_id,
      retail_price: sv.retail_price,
      currency: sv.currency,
      synced: sv.synced,
      is_ignored: sv.is_ignored,
      catalog_product: sv.product.name,
      catalog_image: sv.product.image,
      files: sv.files.map(f => ({
        type: f.type,
        preview_url: f.preview_url,
        thumbnail_url: f.thumbnail_url,
        filename: f.filename,
        status: f.status,
      })),
    }));

    return NextResponse.json({
      provider: 'printful',
      provider_product_id: product.provider_product_id,
      last_synced_at: product.last_synced_at,
      printful_dashboard_url: `https://www.printful.com/dashboard/store/products/${product.provider_product_id}`,
      sync_product: {
        id: printfulData.sync_product.id,
        name: printfulData.sync_product.name,
        variants_count: printfulData.sync_product.variants,
        synced_count: printfulData.sync_product.synced,
        thumbnail_url: printfulData.sync_product.thumbnail_url,
        is_ignored: printfulData.sync_product.is_ignored,
      },
      variants,
    });
  } catch (error) {
    console.error('Printful fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Printful data' },
      { status: 500 }
    );
  }
});
