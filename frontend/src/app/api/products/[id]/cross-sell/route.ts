import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products/[id]/cross-sell
 *
 * Returns up to 4 cross-sell product recommendations based on association_rules.
 * Falls back to same-category products if no rules exist.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params

    if (!productId) {
      return NextResponse.json({ items: [] })
    }

    // Query association_rules for co-purchase recommendations
    const { data: rules } = await supabaseAdmin
      .from('association_rules')
      .select('consequents, confidence, lift')
      .contains('antecedents', [productId])
      .order('lift', { ascending: false })
      .limit(4)

    let recommendedIds: string[] = []

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        if (rule.consequents && Array.isArray(rule.consequents)) {
          recommendedIds.push(...rule.consequents)
        }
      }
      recommendedIds = [...new Set(recommendedIds)]
        .filter(id => id !== productId)
        .slice(0, 4)
    }

    // If no association rules, fall back to same-category products
    if (recommendedIds.length === 0) {
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('category_id')
        .eq('id', productId)
        .single()

      if (product?.category_id) {
        const { data: sameCategory } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('category_id', product.category_id)
          .eq('status', 'active')
          .is('deleted_at', null)
          .neq('id', productId)
          .limit(4)

        recommendedIds = (sameCategory || []).map(p => p.id)
      }
    }

    if (recommendedIds.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // Fetch product details for recommendations
    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, slug, title, description, base_price_cents, currency, images, avg_rating, review_count, categories(slug)')
      .eq('status', 'active')
      .is('deleted_at', null)
      .in('id', recommendedIds)

    const items = (products || []).map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description || '',
      price: p.base_price_cents / 100,
      currency: p.currency?.toUpperCase() || 'EUR',
      image: Array.isArray(p.images) && p.images.length > 0
        ? (p.images[0].src || p.images[0].url)
        : null,
      rating: Number(p.avg_rating) || 0,
      reviewCount: p.review_count || 0,
      category: (p.categories as any)?.slug || 'other',
    }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Cross-sell error:', error)
    return NextResponse.json({ items: [] })
  }
}
