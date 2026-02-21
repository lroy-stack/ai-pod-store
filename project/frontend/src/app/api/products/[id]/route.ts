import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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

    // Fetch product, available variants, and all enabled variants in parallel
    const [productResult, variantsResult, allEnabledResult] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('status', 'active')
        .single(),
      supabaseAdmin
        .from('product_variants')
        .select('size, color, price_cents, is_enabled, is_available, printify_variant_id')
        .eq('product_id', id)
        .eq('is_enabled', true)
        .eq('is_available', true),
      supabaseAdmin
        .from('product_variants')
        .select('size, color, is_available, printify_variant_id')
        .eq('product_id', id)
        .eq('is_enabled', true),
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
    const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))] as string[]
    const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))] as string[]

    // Apply locale-specific translations
    const { title, description } = applyTranslations(product, locale)

    const details = product.product_details || {}

    // Build image list
    const allImages: string[] = Array.isArray(product.images)
      ? product.images.map((img: { src?: string; url?: string }) => img.src || img.url || '').filter(Boolean)
      : []

    // Build variant→image indices (match printify_variant_id in image URLs)
    function buildImageMap(field: 'color' | 'size'): Record<string, number[]> {
      const idToValue = new Map<string, string>()
      for (const v of variants) {
        const val = v[field]
        if (val && v.printify_variant_id) idToValue.set(v.printify_variant_id, val)
      }
      const indices: Record<string, number[]> = {}
      for (let i = 0; i < allImages.length; i++) {
        for (const [pvid, val] of idToValue) {
          if (allImages[i].includes('/' + pvid + '/')) {
            if (!indices[val]) indices[val] = []
            if (!indices[val].includes(i)) indices[val].push(i)
            break
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
    const allEnabledSizes = [...new Set(allEnabled.map(v => v.size).filter(Boolean))] as string[]
    const unavailableCombinations = allEnabled
      .filter(v => !v.is_available)
      .map(v => ({ color: v.color || '', size: v.size || '' }))

    // Map DB schema to frontend format
    const mapped = {
      id: product.id,
      title,
      description,
      price: product.base_price_cents / 100,
      currency: product.currency?.toUpperCase() || 'EUR',
      image: allImages.length > 0 ? allImages[0] : null,
      images: allImages,
      rating: Number(product.avg_rating) || 0,
      reviewCount: product.review_count || 0,
      category: product.category?.toLowerCase(),
      tags: product.tags || [],
      inStock: variants.length > 0,
      printifyId: product.printify_id,
      createdAt: product.created_at,
      materials: details.material || null,
      careInstructions: details.care_instructions || null,
      printTechnique: details.print_technique || null,
      manufacturingCountry: details.manufacturing_country || null,
      brand: details.brand || null,
      safetyInformation: details.safety_information || null,
      variants: {
        ...(sizes.length > 0 ? { sizes } : {}),
        ...(colors.length > 0 ? { colors } : {}),
        ...(Object.keys(colorImageIndices).length > 0 ? { colorImageIndices } : {}),
        ...(Object.keys(sizeImageIndices).length > 0 ? { sizeImageIndices } : {}),
        ...(allEnabledColors.length > 0 ? { allColors: allEnabledColors } : {}),
        ...(allEnabledSizes.length > 0 ? { allSizes: allEnabledSizes } : {}),
        ...(unavailableCombinations.length > 0 ? { unavailableCombinations } : {}),
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
