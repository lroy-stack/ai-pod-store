/**
 * POST /api/printful/products — Create a new product in Printful store + sync to Supabase
 *
 * Body: {
 *   name: string,
 *   variants: [{ variant_id: number, retail_price: string, files: [{ placement: string, url: string }] }],
 *   gpsr: { material, care_instructions, print_technique, manufacturing_country },
 *   seo: { title?, description? }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/rbac';
import { supabaseAdmin } from '@/lib/supabase';
import { printfulFetch, type PrintfulProductDetail } from '@/lib/printful';
import { logCreate } from '@/lib/audit';

export const POST = withPermission('products', 'create', async (req: NextRequest, session) => {
  try {
    const body = await req.json();
    const { name, variants, gpsr, seo } = body;

    if (!name || !variants?.length) {
      return NextResponse.json({ error: 'Name and variants are required' }, { status: 400 });
    }

    // 1. Create product in Printful
    const syncPayload = {
      sync_product: { name },
      sync_variants: variants.map((v: any) => ({
        variant_id: v.variant_id,
        retail_price: v.retail_price,
        is_ignored: false,
        files: (v.files || []).map((f: any) => ({
          type: f.placement || 'default',
          url: f.url,
        })),
      })),
    };

    const { data: printfulProduct } = await printfulFetch<PrintfulProductDetail>(
      '/store/products',
      {
        method: 'POST',
        body: JSON.stringify(syncPayload),
      }
    );

    const providerProductId = String(printfulProduct.sync_product.id);

    // 2. Save to Supabase
    const now = new Date().toISOString();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const productData: Record<string, unknown> = {
      title: name,
      slug,
      provider_product_id: providerProductId,
      pod_provider: 'printful',
      product_type: 'pod',
      status: 'active',
      currency: 'EUR',
      last_synced_at: now,
      published_at: now,
    };

    // GPSR compliance
    if (gpsr) {
      productData.product_details = {
        brand: process.env.STORE_NAME || (process.env.NEXT_PUBLIC_SITE_NAME || 'My Store'),
        manufacturer: process.env.STORE_COMPANY_NAME || process.env.STORE_COMPANY_NAME || 'Your Company Name',
        safety_information: 'Conforms to EU Regulation 2023/988 (GPSR)',
        ...gpsr,
      };
    }

    // SEO
    if (seo?.title) productData.meta_title = seo.title;
    if (seo?.description) productData.meta_description = seo.description;

    // Compute base_price from first variant
    const firstPrice = parseFloat(variants[0]?.retail_price || '0');
    productData.base_price_cents = Math.round(firstPrice * 100);

    const { data: product, error: insertError } = await supabaseAdmin
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (insertError) {
      console.error('Product insert error:', insertError);
      return NextResponse.json({ error: 'Failed to save product' }, { status: 500 });
    }

    // 3. Sync variants to Supabase
    const variantRows = printfulProduct.sync_variants.map(sv => ({
      product_id: product.id,
      external_variant_id: String(sv.variant_id),
      title: sv.name,
      price_cents: Math.round(parseFloat(sv.retail_price) * 100),
      is_enabled: !sv.is_ignored,
      is_available: sv.synced,
      image_url: sv.product?.image || null,
    }));

    if (variantRows.length > 0) {
      await supabaseAdmin
        .from('product_variants')
        .upsert(variantRows, { onConflict: 'product_id,external_variant_id' });
    }

    // 4. Audit log
    await logCreate(session.userId, 'product', product.id, { name, provider: 'printful', variants: variants.length }, session.email);

    return NextResponse.json({
      product,
      provider_product_id: providerProductId,
      variants_synced: variantRows.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Printful product creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create product' },
      { status: 500 }
    );
  }
});
