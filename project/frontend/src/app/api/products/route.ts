import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Hybrid search using Reciprocal Rank Fusion (RRF) to combine vector + keyword results
 */
async function hybridSearch(
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

    // Run vector search and keyword search in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      getVectorSearchResults(searchQuery, category, limit * 3),
      getKeywordSearchResults(searchQuery, category, limit * 3),
    ])

    // Apply Reciprocal Rank Fusion (RRF) to combine results
    const k = 60 // RRF constant (recommended: 60)
    const productScores = new Map<string, { score: number; data: any }>()

    // Add vector search scores
    vectorResults.forEach((result, index) => {
      const rank = index + 1
      const rrfScore = 1 / (k + rank)

      productScores.set(result.id, {
        score: rrfScore,
        data: { ...result, vectorRank: rank, vectorSimilarity: result.similarity },
      })
    })

    // Add keyword search scores
    keywordResults.forEach((result, index) => {
      const rank = index + 1
      const rrfScore = 1 / (k + rank)

      const existing = productScores.get(result.id)
      if (existing) {
        // Product appears in both lists — combine scores
        productScores.set(result.id, {
          score: existing.score + rrfScore,
          data: { ...existing.data, keywordRank: rank },
        })
      } else {
        // Product only in keyword results
        productScores.set(result.id, {
          score: rrfScore,
          data: { ...result, keywordRank: rank },
        })
      }
    })

    // Sort by combined RRF score (descending)
    const rankedProducts = Array.from(productScores.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .map(([id, { data }]) => data)

    // Apply pagination
    const offset = (page - 1) * limit
    const paginatedProducts = rankedProducts.slice(offset, offset + limit)

    // Map to frontend format
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
      // Include search metadata for debugging
      vectorRank: p.vectorRank,
      keywordRank: p.keywordRank,
      vectorSimilarity: p.vectorSimilarity,
    }))

    const total = rankedProducts.length
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages,
      items,
      locale,
      searchMethod: 'hybrid',
      query: searchQuery,
      vectorResults: vectorResults.length,
      keywordResults: keywordResults.length,
      combinedResults: rankedProducts.length,
    })
  } catch (error) {
    console.error('Hybrid search error:', error)
    return fallbackTextSearch(searchQuery, category, locale, page, limit, sort)
  }
}

/**
 * Get vector similarity search results
 */
async function getVectorSearchResults(
  searchQuery: string,
  category: string | null,
  limit: number
): Promise<any[]> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return []

    // Generate embedding for the search query
    const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

    const embeddingResponse = await fetch(embeddingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: searchQuery }] },
        outputDimensionality: 768,
      }),
    })

    if (!embeddingResponse.ok) return []

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.embedding?.values || []

    if (queryEmbedding.length !== 768) return []

    // Search documents table using vector similarity
    const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
      'search_documents',
      {
        query_embedding: queryEmbedding,
        match_count: limit,
        filter_locale: null,
      }
    )

    if (searchError) return []

    // Filter for product documents and extract product IDs
    const productResults = (searchResults || []).filter(
      (r: any) => r.source_type === 'product'
    )

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const productIds = productResults
      .map((r: any) => r.source_id)
      .filter((id: string) => UUID_REGEX.test(id))

    if (productIds.length === 0) return []

    // Fetch full product details
    let query = supabaseAdmin
      .from('products')
      .select('id, title, description, category, tags, base_price_cents, currency, images, status, avg_rating, review_count, created_at')
      .eq('status', 'active')
      .in('id', productIds)

    if (category && category !== 'all') {
      query = query.ilike('category', category)
    }

    const { data: products, error: productsError } = await query

    if (productsError) return []

    // Add similarity scores to products
    const similarityMap = new Map(
      productResults.map((r: any) => [r.source_id, r.similarity])
    )

    return (products || [])
      .map((p) => ({ ...p, similarity: similarityMap.get(p.id) || 0 }))
      .sort((a, b) => b.similarity - a.similarity)
  } catch (error) {
    console.error('Vector search component error:', error)
    return []
  }
}

/**
 * Get keyword search results using PostgreSQL full-text search
 */
async function getKeywordSearchResults(
  searchQuery: string,
  category: string | null,
  limit: number
): Promise<any[]> {
  try {
    let query = supabaseAdmin
      .from('products')
      .select('id, title, description, category, tags, base_price_cents, currency, images, status, avg_rating, review_count, created_at')
      .eq('status', 'active')

    if (category && category !== 'all') {
      query = query.ilike('category', category)
    }

    // PostgreSQL full-text search on title, description, category
    query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,category.ilike.%${searchQuery}%`)
    query = query.limit(limit)

    const { data: products, error } = await query

    if (error) return []

    return products || []
  } catch (error) {
    console.error('Keyword search component error:', error)
    return []
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

    // If search query exists, use hybrid search (vector + keyword)
    if (search && search.trim().length > 0) {
      return await hybridSearch(search, category, locale, page, limit, sort)
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
