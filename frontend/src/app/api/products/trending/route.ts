import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/products/trending
 *
 * Returns top 12 trending products from the trending_products materialized view.
 * The view aggregates product_daily_metrics over 7 days with weighted score.
 */
export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '12', 10)

    const { data: trending, error: trendingError } = await supabaseAdmin
      .from('trending_products')
      .select('id, title, avg_rating, views_7d, orders_7d, weighted_score')
      .order('weighted_score', { ascending: false })
      .limit(Math.min(limit, 50))

    if (trendingError) {
      console.error('Trending query error:', trendingError)
      // Fallback: return top products by review_count
      const { data: fallback } = await supabaseAdmin
        .from('products')
        .select('id, title, description, base_price_cents, currency, images, avg_rating, review_count, categories(slug)')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('review_count', { ascending: false })
        .limit(limit)

      const items = (fallback || []).map(p => ({
        id: p.id,
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

      return NextResponse.json({ items, source: 'fallback' })
    }

    // Fetch full product data for trending IDs
    const trendingIds = (trending || []).map(t => t.id)

    if (trendingIds.length === 0) {
      return NextResponse.json({ items: [], source: 'trending' })
    }

    const { data: products } = await supabaseAdmin
      .from('products')
      .select('id, title, description, base_price_cents, currency, images, avg_rating, review_count, categories(slug)')
      .eq('status', 'active')
      .is('deleted_at', null)
      .in('id', trendingIds)

    // Preserve trending order
    const productMap = new Map((products || []).map(p => [p.id, p]))
    const items = trendingIds
      .map(id => productMap.get(id))
      .filter(Boolean)
      .map((p: any) => ({
        id: p.id,
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

    return NextResponse.json({ items, source: 'trending' })
  } catch (error) {
    console.error('Trending products error:', error)
    return NextResponse.json({ items: [], source: 'error' })
  }
}
