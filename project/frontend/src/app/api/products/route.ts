import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const locale = searchParams.get('locale') || 'en'
    const category = searchParams.get('category')
    const search = searchParams.get('q') || searchParams.get('search')
    const sort = searchParams.get('sort')

    let query = supabaseAdmin
      .from('products')
      .select('id, title, description, category, tags, base_price_cents, currency, images, status, avg_rating, review_count, created_at', { count: 'exact' })
      .eq('status', 'active')

    // Filter by category (case-insensitive — DB has mixed casing)
    if (category && category !== 'all') {
      query = query.ilike('category', category)
    }

    // Full-text search across title, description, and category
    if (search) {
      query = query.or(`title.wfts.${search},description.wfts.${search},category.wfts.${search}`)
    }

    // Sort products
    if (sort === 'price-asc' || sort === 'priceLowToHigh') {
      query = query.order('base_price_cents', { ascending: true })
    } else if (sort === 'price-desc' || sort === 'priceHighToLow') {
      query = query.order('base_price_cents', { ascending: false })
    } else if (sort === 'rating' || sort === 'topRated') {
      query = query.order('avg_rating', { ascending: false })
    } else if (sort === 'popular') {
      query = query.order('review_count', { ascending: false })
    } else if (sort === 'newest') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    // Pagination
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    const { data: products, error, count } = await query

    if (error) {
      console.error('Supabase products query error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    // Map DB schema to frontend format
    const items = (products || []).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.base_price_cents / 100,
      currency: p.currency?.toUpperCase() || 'EUR',
      image: Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : '',
      images: Array.isArray(p.images) ? p.images.map((img: { src?: string; url?: string; alt?: string }) => img.src || img.url || '') : [],
      rating: Number(p.avg_rating) || 0,
      reviewCount: p.review_count || 0,
      category: p.category?.toLowerCase(),
      tags: p.tags || [],
      inStock: true,
      createdAt: p.created_at,
    }))

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages,
      items,
      locale,
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
