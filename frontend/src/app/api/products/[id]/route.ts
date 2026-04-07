import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sortSizes } from '@/lib/size-order'

/**
 * Apply locale-specific translations to product title and description
 */
function applyTranslations(product: any, locale: string) {
  if (!locale || locale === 'en' || !product.translations) {
    return {
      title: product.title,
      description: product.description,
    }
  }

  const translations = product.translations?.[locale]
  if (!translations) {
    return {
      title: product.title,
      description: product.description,
    }
  }

  return {
    title: translations.title || product.title,
    description: translations.description || product.description,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const locale = request.nextUrl.searchParams.get('locale') || 'en'

    // Fetch product, available variants, all enabled variants, and labels in parallel
    const [productResult, variantsResult, allEnabledResult, labelsResult] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('*, categories(slug)')
        .eq('id', id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .single(),
      supabaseAdmin
        .from('product_variants')
        .select('title, size, color, price_cents, is_enabled, is_available, external_variant_id, image_url')
        .eq('product_id', id)
        .eq('is_enabled', true)
        .eq('is_available', true),
      supabaseAdmin
        .from('product_variants')
        .select('size, color, is_available, external_variant_id, image_url')
        .eq('product_id', id)
        .eq('is_enabled', true),
      supabaseAdmin
        .from('product_labels')
        .select('label_type')
        .eq('product_id', id),
    ])

    const { data: product, error } = productResult

    if (error || !product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Deduplicate variant sizes and colors
    const variants = variantsResult.data || []
    const sizes = sortSizes([...new Set(variants.map((v) => v.size).filter(Boolean))] as string[])
    const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[]

    // Build variant prices (only when prices differ across variants)
    const variantPricesRaw = variants
      .filter((v: any) => v.price_cents != null)
      .map((v: any) => ({ size: v.size || '', color: v.color || '', price: v.price_cents / 100 }))
    const uniquePrices = new Set(variantPricesRaw.map((v: any) => v.price))
    const hasVariantPricing = uniquePrices.size > 1
    const maxPrice = variantPricesRaw.length > 0
      ? Math.max(...variantPricesRaw.map((v: any) => v.price)) : undefined

    // Apply locale-specific translations
    const { title, description } = applyTranslations(product, locale)

    const details = product.product_details || {}

    // Build image list — prepend branded hero if available
    const rawImageObjects: Array<{ src?: string; url?: string; alt?: string }> = Array.isArray(product.images) ? product.images : []
    const rawImages: string[] = rawImageObjects.map((img) => img.src || img.url || '').filter(Boolean)
    const allImages: string[] = product.branded_hero_url
      ? [product.branded_hero_url, ...rawImages]
      : rawImages
    // Alt texts aligned with allImages (branded hero gets empty alt)
    const allAlts: string[] = product.branded_hero_url
      ? ['', ...rawImageObjects.map((img) => img.alt || '')]
      : rawImageObjects.map((img) => img.alt || '')

    // Build variant→image indices (match external_variant_id in image URLs, or image_url from provider)
    function buildImageMap(field: 'color' | 'size'): Record<string, number[]> {
      const idToValue = new Map<string, string>()
      for (const v of variants) {
        const val = v[field]
        if (val && v.external_variant_id) idToValue.set(v.external_variant_id, val)
      }
      const indices: Record<string, number[]> = {}

      // Strategy 1: Match external_variant_id in image URLs
      for (let i = 0; i < allImages.length; i++) {
        for (const [pvid, val] of idToValue) {
          if (allImages[i].includes('/' + pvid + '/')) {
            if (!indices[val]) indices[val] = []
            if (!indices[val].includes(i)) indices[val].push(i)
            break
          }
        }
      }

      // Strategy 2: If no matches found, use image_url + alt text matching
      if (Object.keys(indices).length === 0) {
        // Collect unique field values (colors/sizes)
        const fieldValues = new Set<string>()
        const valueToImageUrls = new Map<string, Set<string>>()
        for (const v of variants) {
          const val = v[field]
          if (val) {
            fieldValues.add(val)
            if (v.image_url) {
              if (!valueToImageUrls.has(val)) valueToImageUrls.set(val, new Set())
              valueToImageUrls.get(val)!.add(v.image_url)
            }
          }
        }
        // Match by image_url AND by alt text containing the field value (e.g. "Title - Black")
        for (let i = 0; i < allImages.length; i++) {
          // Direct URL match
          for (const [val, urls] of valueToImageUrls) {
            if (urls.has(allImages[i])) {
              if (!indices[val]) indices[val] = []
              if (!indices[val].includes(i)) indices[val].push(i)
            }
          }
          // Alt text match: "Title - Color" or "Title — Color" pattern (skip blank images)
          const alt = allAlts[i] || ''
          if (alt && !alt.includes('(blank)')) {
            for (const val of fieldValues) {
              if (alt.includes(`- ${val}`) || alt.includes(`\u2014 ${val}`)) {
                if (!indices[val]) indices[val] = []
                if (!indices[val].includes(i)) indices[val].push(i)
              }
            }
          }
        }
      }

      return indices
    }

    const colorImageIndices = colors.length > 1 ? buildImageMap('color') : {}
    const sizeImageIndices = sizes.length > 1 ? buildImageMap('size') : {}

    // Build unavailable combinations from all enabled variants
    const allEnabled = allEnabledResult.data || []
    const allEnabledColors = [...new Set(allEnabled.map(v => v.color).filter(Boolean))] as string[]
    const allEnabledSizes = sortSizes([...new Set(allEnabled.map(v => v.size).filter(Boolean))] as string[])
    const unavailableCombinations = allEnabled
      .filter(v => !v.is_available)
      .map(v => ({ color: v.color || '', size: v.size || '' }))

    // Extract finish from variant titles (e.g. "11oz / Black / Glossy" → "Glossy")
    const finishes = [...new Set(variants.map((v) => {
      const parts = String(v.title || '').split(' / ').map(p => p.trim())
      return parts.length === 3 ? parts[2] : null
    }).filter(Boolean))] as string[]
    if (finishes.length > 0 && !details.finish) {
      details.finish = finishes.join(', ')
    }

    // Map DB schema to frontend format
    const mapped = {
      id: product.id,
      slug: product.slug,
      title,
      description,
      price: product.base_price_cents / 100,
      ...(hasVariantPricing ? { maxPrice } : {}),
      ...(hasVariantPricing ? { hasVariantPricing } : {}),
      compareAtPrice: product.compare_at_price_cents ? product.compare_at_price_cents / 100 : undefined,
      currency: product.currency?.toUpperCase() || 'EUR',
      image: allImages.length > 0 ? allImages[0] : null,
      images: allImages,
      rating: Number(product.avg_rating) || 0,
      reviewCount: product.review_count || 0,
      category: (product.categories as any)?.slug?.toLowerCase() || undefined,
      tags: product.tags || [],
      inStock: variants.length > 0,
      providerProductId: product.provider_product_id,
      createdAt: product.created_at,
      materials: details.material || null,
      careInstructions: details.care_instructions || null,
      printTechnique: details.print_technique || null,
      manufacturingCountry: details.manufacturing_country || null,
      brand: details.brand || null,
      safetyInformation: details.safety_information || null,
      finish: details.finish || null,
      labels: (labelsResult.data || []).map((l: { label_type: string }) => l.label_type),
      variants: {
        ...(sizes.length > 0 ? { sizes } : {}),
        ...(colors.length > 0 ? { colors } : {}),
        ...(Object.keys(colorImageIndices).length > 0 ? { colorImageIndices } : {}),
        ...(Object.keys(sizeImageIndices).length > 0 ? { sizeImageIndices } : {}),
        ...(allEnabledColors.length > 0 ? { allColors: allEnabledColors } : {}),
        ...(allEnabledSizes.length > 0 ? { allSizes: allEnabledSizes } : {}),
        ...(unavailableCombinations.length > 0 ? { unavailableCombinations } : {}),
        ...(hasVariantPricing ? { prices: variantPricesRaw } : {}),
      },
    }

    return NextResponse.json({ success: true, product: mapped })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}
