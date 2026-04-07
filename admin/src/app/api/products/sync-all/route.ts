/**
 * POST /api/products/sync-all — Trigger full product reconciliation
 *
 * Fetches all products from Printful, compares with Supabase,
 * and updates last_synced_at for all synced products.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';
import { printfulFetch, type PrintfulSyncProduct } from '@/lib/printful';

export const POST = withPermission('products', 'update', async () => {
  try {
    // Fetch all Printful products (paginated)
    const allProducts: PrintfulSyncProduct[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const { data, paging } = await printfulFetch<PrintfulSyncProduct[]>(
        `/store/products?limit=${limit}&offset=${offset}`
      );
      allProducts.push(...data);
      if (!paging || offset + limit >= paging.total) break;
      offset += limit;
      // Rate limit: 120 req/min, be conservative
      await new Promise(r => setTimeout(r, 600));
    }

    // Get all Supabase products with provider IDs
    const { data: dbProducts } = await supabaseAdmin
      .from('products')
      .select('id, provider_product_id, title, status')
      .not('provider_product_id', 'is', null);

    const dbMap = new Map(
      (dbProducts || []).map(p => [p.provider_product_id, p])
    );

    const now = new Date().toISOString();
    let synced = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const pf of allProducts) {
      const pfId = String(pf.id);
      const existing = dbMap.get(pfId);

      if (existing) {
        // Update last_synced_at and status
        const newStatus = pf.is_ignored ? 'draft' : 'active';
        const needsUpdate = existing.title !== pf.name || existing.status !== newStatus;

        const updateData: Record<string, unknown> = { last_synced_at: now };
        if (needsUpdate) {
          updateData.title = pf.name;
          updateData.status = newStatus;
        }

        const { error } = await supabaseAdmin
          .from('products')
          .update(updateData)
          .eq('id', existing.id);

        if (error) {
          errors.push(`Update ${existing.id}: ${error.message}`);
        } else {
          if (needsUpdate) updated++;
          synced++;
        }
      } else {
        // Create new product from Printful
        const { error } = await supabaseAdmin
          .from('products')
          .insert({
            title: pf.name,
            provider_product_id: pfId,
            pod_provider: 'printful',
            status: pf.is_ignored ? 'draft' : 'active',
            currency: 'EUR',
            last_synced_at: now,
          });

        if (error) {
          errors.push(`Create ${pfId}: ${error.message}`);
        } else {
          created++;
          synced++;
        }
      }
    }

    return NextResponse.json({
      status: 'completed',
      printful_total: allProducts.length,
      synced,
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      synced_at: now,
    });
  } catch (error) {
    console.error('Sync all error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
});
