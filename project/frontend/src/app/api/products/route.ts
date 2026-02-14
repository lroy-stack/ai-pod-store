import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Vector similarity search for products using RAG
 */
async function vectorSearch(
  searchQuery: string,
  category: string | null,
  locale: string,
  page: number,
  limit: number,
  sort: string | null
) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY not configured, falling back to text search')
      return fallbackTextSearch(searchQuery, category, locale, page, limit, sort)
    }

    // 1. Generate embedding for the search query
    const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

    const embeddingResponse = await fetch(embeddingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: {
          parts: [{ text: searchQuery }],
        },
        outputDimensionality: 768,
      }),
    })

    if (!embeddingResponse.ok) {
      console.error('Gemini embedding failed, falling back to text search')
      return fallbackTextSearch(searchQuery, category, locale, page, limit, sort)
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.embedding?.values || []

    if (queryEmbedding.length !== 768) {
      console.error('Invalid embedding dimension, falling back to text search')
      return fallbackTextSearch(searchQuery, category, locale, page, limit, sort)
    }

    // 2. Search for matching product documents using vector similarity
    // Note: locale in DB may have trailing spaces, so we pass null to search all locales
    const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
      'search_documents',
      {
        query_embedding: queryEmbedding,
        match_count: limit * 3, // Get more results for filtering
        filter_locale: null, // Search all locales to avoid locale mismatch issues
      }
    )

    if (searchError) {
      console.error('Vector search error:', searchError)
      return fallbackTextSearch(searchQuery, category, locale, page, limit, sort)
    }

    // 3. Filter for product documents and extract product IDs
    const productResults = (searchResults || []).filter(
      (r: any) => r.source_type === 'product'
    )

    if (productResults.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        page,
        limit,
        totalPages: 0,
        items: [],
        locale,
        searchMethod: 'vector',
        message: 'No products found matching your search',
      })
    }

    // Filter out invalid UUIDs (some test data may have non-UUID source_ids)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const productIds = productResults
      .map((r: any) => r.source_id)
      .filter((id: string) => UUID_REGEX.test(id))

    if (productIds.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        page,
        limit,
        totalPages: 0,
        items: [],
        locale,
        searchMethod: 'vector',
        message: 'No valid products found matching your search',
      })
    }

    // 4. Fetch full product details from products table
    let query = supabaseAdmin
      .from('products')
      .select('id, title, description, category, tags, base_price_cents, currency, images, status, avg_rating, review_count, created_at')
      .eq('status', 'active')
      .in('id', productIds)

    // Filter by category if specified
    if (category && category !== 'all') {
      query = query.ilike('category', category)
    }

    const { data: products, error: productsError } = await query

    if (productsError) {
      console.error('Products query error:', productsError)
      return fallbackTextSearch(searchQuery, category, locale, page, limit, sort)
    }

    // 5. Sort products by similarity score (preserve vector search ranking)
    const similarityMap = new Map(
      productResults.map((r: any) => [r.source_id, r.similarity])
    )

    const sortedProducts = (products || []).sort((a, b) => {
      const simA = similarityMap.get(a.id) || 0
      const simB = similarityMap.get(b.id) || 0
      return simB - simA // Descending order
    })

    // 6. Apply pagination to the sorted results
    const offset = (page - 1) * limit
    const paginatedProducts = sortedProducts.slice(offset, offset + limit)

    // 7. Map to frontend format
    const items = paginatedProducts.map((p) => ({
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
      similarity: similarityMap.get(p.id),
    }))

    const total = sortedProducts.length
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages,
      items,
      locale,
      searchMethod: 'vector',
      query: searchQuery,
    })
  } catch (error) {
    console.error('Vector search error:', error)
    return fallbackTextSearch(searchQuery, category, locale, page, limit, sort)
  }
}

/**
 * Fallback text search using PostgreSQL full-text search
 */
async function fallbackTextSearch(
  searchQuery: string,
  category: string | null,
  locale: string,
  page: number,
  limit: number,
  sort: string | null
) {
  let query = supabaseAdmin
    .from('products')
    .select('id, title, description, category, tags, base_price_cents, currency, images, status, avg_rating, review_count, created_at', { count: 'exact' })
    .eq('status', 'active')

  if (category && category !== 'all') {
    query = query.ilike('category', category)
  }

  if (searchQuery) {
    query = query.or(`title.wfts.${searchQuery},description.wfts.${searchQuery},category.wfts.${searchQuery}`)
  }

  // Apply sorting
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

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data: products, error, count } = await query

  if (error) {
    console.error('Fallback search error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to search products' },
      { status: 500 }
    )
  }

  const total = count || 0
  const totalPages = Math.ceil(total / limit)

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
    searchMethod: 'text',
    query: searchQuery,
  })
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const locale = searchParams.get('locale') || 'en'
    const category = searchParams.get('category')
    const search = searchParams.get('q') || searchParams.get('search')
    const sort = searchParams.get('sort')

    // If search query exists, use vector similarity search
    if (search && search.trim().length > 0) {
      return await vectorSearch(search, category, locale, page, limit, sort)
    }

    // Otherwise, use traditional database query
    let query = supabaseAdmin
      .from('products')
      .select('id, title, description, category, tags, base_price_cents, currency, images, status, avg_rating, review_count, created_at', { count: 'exact' })
      .eq('status', 'active')

    // Filter by category (case-insensitive — DB has mixed casing)
    if (category && category !== 'all') {
      query = query.ilike('category', category)
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
