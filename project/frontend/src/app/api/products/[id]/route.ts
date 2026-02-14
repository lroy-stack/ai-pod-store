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

    // Fetch product and its variants in parallel (same pattern as product-detail-cache.ts)
    const [productResult, variantsResult] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('status', 'active')
        .single(),
      supabaseAdmin
        .from('product_variants')
        .select('size, color, price_cents, is_enabled, is_available')
        .eq('product_id', id)
        .eq('is_enabled', true)
        .eq('is_available', true),
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

    // Map DB schema to frontend format
    const mapped = {
      id: product.id,
      title,
      description,
      price: product.base_price_cents / 100,
      currency: product.currency?.toUpperCase() || 'EUR',
      image: Array.isArray(product.images) && product.images.length > 0 ? (product.images[0].src || product.images[0].url) : null,
      images: Array.isArray(product.images) ? product.images.map((img: { src?: string; url?: string; alt?: string }) => img.src || img.url || '') : [],
      rating: Number(product.avg_rating) || 0,
      reviewCount: product.review_count || 0,
      category: product.category?.toLowerCase(),
      tags: product.tags || [],
      inStock: true,
      printifyId: product.printify_id,
      createdAt: product.created_at,
      variants: {
        ...(sizes.length > 0 ? { sizes } : {}),
        ...(colors.length > 0 ? { colors } : {}),
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
