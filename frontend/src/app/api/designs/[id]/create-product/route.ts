/**
 * Design → Product Pipeline
 *
 * POST /api/designs/:id/create-product
 * Converts an approved design into a POD provider product:
 *   1. Validate design is approved
 *   2. Upload image to provider (if not already uploaded)
 *   3. Create product with the uploaded image
 *   4. Publish product
 *   5. Save provider_product_id to products table
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider, initializeProviders } from '@/lib/pod'
import { verifyCronSecret } from '@/lib/rate-limit'
import { isEUProvider, MIN_MARGIN_PERCENT, DEFAULT_GPSR } from '@/lib/store-config'
import { slugify } from '@/lib/utils'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const CRON_SECRET = process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: require bearer token, timing-safe (called by PodClaw or cron)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: designId } = await params

  // 1. Fetch design
  const { data: design, error: designError } = await supabase
    .from('designs')
    .select('*')
    .eq('id', designId)
    .single()

  if (designError || !design) {
    return NextResponse.json({ error: 'Design not found' }, { status: 404 })
  }

  if (design.moderation_status !== 'approved') {
    return NextResponse.json(
      { error: `Design not approved (status: ${design.moderation_status})` },
      { status: 400 }
    )
  }

  // Parse request body for product config
  // Accepts both legacy (blueprint_id, print_provider_id) and
  // provider-agnostic (product_template_id, provider_facility_id) field names
  let body: {
    blueprint_id?: number
    print_provider_id?: number
    product_template_id?: number
    provider_facility_id?: number
    variants: Array<{ id: number; price: number; is_enabled: boolean }>
    title?: string
    description?: string
    tags?: string[]
    has_neck_position?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body required with blueprint_id/product_template_id, print_provider_id/provider_facility_id, variants' },
      { status: 400 }
    )
  }

  // Resolve provider-agnostic aliases
  const blueprintId = body.blueprint_id ?? body.product_template_id
  const printProviderId = body.print_provider_id ?? body.provider_facility_id

  if (!blueprintId || !printProviderId || !body.variants) {
    return NextResponse.json(
      { error: 'Missing required fields: blueprint_id/product_template_id, print_provider_id/provider_facility_id, variants' },
      { status: 400 }
    )
  }

  if (!isEUProvider(printProviderId)) {
    return NextResponse.json(
      { error: `Provider ${printProviderId} not approved for EU shipping` },
      { status: 400 }
    )
  }

  // DS-024: Margin validation — reject variants below minimum margin
  const minMarginFraction = MIN_MARGIN_PERCENT / 100
  const lowMarginVariants = body.variants.filter((v: { id: number; price: number; is_enabled: boolean }) => {
    // Price is in cents — we validate margin ratio: (price - cost) / price >= MIN_MARGIN
    // Since we don't have cost data here from the provider, we validate that price > 0
    // The actual margin check happens in the cron sync margin fixer
    return v.is_enabled && v.price <= 0
  })
  if (lowMarginVariants.length > 0) {
    return NextResponse.json(
      { error: `${lowMarginVariants.length} variants have invalid pricing (price must be > 0)` },
      { status: 400 }
    )
  }

  try {
    initializeProviders()
    const provider = getProvider()

    // 2. Transparency guarantee: prefer bg-removed version
    let imageUrl = design.bg_removed_url || design.image_url || design.url
    if (!imageUrl) {
      return NextResponse.json({ error: 'Design has no image URL' }, { status: 400 })
    }

    // If no bg-removed version exists, auto-remove now (defense-in-depth)
    if (!design.bg_removed_url) {
      try {
        const { removeBackground } = await import('@/lib/providers/background-removal')
        const bgResult = await removeBackground(imageUrl)
        if (bgResult.success && bgResult.imageUrl) {
          imageUrl = bgResult.imageUrl
          await supabase
            .from('designs')
            .update({
              bg_removed_url: imageUrl,
              bg_removed_at: new Date().toISOString(),
            })
            .eq('id', designId)
        } else {
          return NextResponse.json(
            { error: 'Background removal required for product creation but failed. Please try again.' },
            { status: 422 }
          )
        }
      } catch (bgError) {
        console.error('Auto bg-removal in create-product failed:', bgError)
        return NextResponse.json(
          { error: 'Background removal required but service unavailable.' },
          { status: 422 }
        )
      }
    }

    // 3. Upload image to provider if not already uploaded
    let providerUploadId = design.provider_upload_id
    if (!providerUploadId) {

      const fileName = `design-${designId}.png`
      const uploadResult = await provider.uploadDesign({ url: imageUrl, fileName })
      providerUploadId = uploadResult.id

      // Save upload ID to design
      await supabase
        .from('designs')
        .update({
          provider_upload_id: providerUploadId,
          pod_upload_url: uploadResult.previewUrl,
        })
        .eq('id', designId)
    }

    // 4. Create product via provider
    const productTitle = body.title || design.title || `Design ${designId.slice(0, 8)}`
    const productDescription = body.description || design.description || ''

    // Build placeholders — front design + optional neck label
    const placeholders: Array<Record<string, unknown>> = [
      {
        position: 'front',
        images: [
          {
            id: providerUploadId,
            x: 0.5,
            y: 0.5,
            scale: 1,
            angle: 0,
          },
        ],
      },
    ]

    // Add neck label if brand config has one and blueprint supports neck position
    if (body.has_neck_position) {
      const { data: brandConfig } = await supabase
        .from('brand_config')
        .select('neck_label_image_id')
        .eq('is_active', true)
        .single()

      if (brandConfig?.neck_label_image_id) {
        placeholders.push({
          position: 'neck',
          images: [
            {
              id: brandConfig.neck_label_image_id,
              x: 0.5,
              y: 0.5,
              scale: 1,
              angle: 0,
            },
          ],
        })
      }
    }

    const printifyProduct = await provider.createProduct({
      title: productTitle,
      description: productDescription,
      blueprintId: blueprintId,
      printProviderId: printProviderId,
      variants: body.variants.map((v: { id: number; price: number; is_enabled: boolean }) => ({
        variantId: v.id,
        priceCents: v.price,
        isEnabled: v.is_enabled,
      })),
      printAreas: placeholders.map((ph: Record<string, unknown>) => ({
        position: ph.position as string,
        images: (ph.images as any[]).map((img: any) => ({
          id: img.id as string,
          x: img.x as number,
          y: img.y as number,
          scale: img.scale as number,
          angle: img.angle as number,
        })),
      })),
      tags: body.tags || [],
    })

    // 4. Publish product
    await provider.publishProduct!(printifyProduct.externalId)

    // 5. Save to products table (before publishingSucceeded so we have the UUID)
    // Generate collision-safe slug (immutable once set)
    let baseSlug = slugify(productTitle) || 'product'
    const { data: existingSlugs } = await supabase
      .from('products')
      .select('slug')
      .like('slug', `${baseSlug}%`)
    const usedSlugs = new Set((existingSlugs || []).map((p: { slug: string }) => p.slug))
    let productSlug = baseSlug
    let slugCounter = 1
    while (usedSlugs.has(productSlug)) {
      productSlug = `${baseSlug}-${slugCounter++}`
    }

    // DS-023: GPSR compliance — EU Regulation 2023/988 requires these fields
    const gpsrData = {
      brand: DEFAULT_GPSR.brand,
      manufacturer: DEFAULT_GPSR.manufacturer,
      manufacturer_address: DEFAULT_GPSR.manufacturer_address,
      manufacturing_country: DEFAULT_GPSR.manufacturing_country,
      safety_information: DEFAULT_GPSR.safety_information,
      material: (body as any).material || '',
      care_instructions: (body as any).care_instructions || '',
      print_technique: (body as any).print_technique || 'dtg',
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        title: productTitle,
        slug: productSlug,
        description: productDescription,
        provider_product_id: printifyProduct.externalId,
        product_template_id: String(blueprintId),
        provider_facility_id: String(printProviderId),
        pod_provider: 'printful',
        status: 'draft',
        currency: 'EUR',
        product_details: gpsrData,
      })
      .select()
      .single()

    if (productError) {
      console.error('Failed to save product to DB:', productError)
    }

    // 6. Confirm publishing (custom integration requirement)
    if (product) {
      try {
        await provider.confirmPublishing!(
          printifyProduct.externalId,
          product.id,
          `/shop/${product.slug}`
        )
      } catch (e) {
        console.error('Failed to confirm publishing:', e)
        // Non-fatal — webhook or cron will retry
      }
    }

    return NextResponse.json({
      success: true,
      provider_product_id: printifyProduct.externalId,
      product_id: product?.id,
      provider_upload_id: providerUploadId,
    })
  } catch (error) {
    console.error('Design→Product pipeline error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Product creation failed' }, { status: 500 })
  }
}
