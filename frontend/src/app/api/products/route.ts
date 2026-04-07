import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeForLike, sanitizeForPostgrest } from '@/lib/query-sanitizer'
import { checkPlanGate } from '@/lib/plan-gates'
import { sortSizes } from '@/lib/size-order'
import { slugify } from '@/lib/utils'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

/**
 * Resolve a category slug to category_id(s) for proper DB filtering.
 * For parent categories, returns IDs of parent + all children.
 * Returns null if category not found.
 */
async function resolveCategoryIds(slug: string): Promise<string[] | null> {
  const { data: catRow } = await supabaseAdmin
    .from('categories')
    .select('id, parent_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!catRow) return null

  if (!catRow.parent_id) {
    // Parent: include children
    const { data: children } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('parent_id', catRow.id)
      .eq('is_active', true)

    return [catRow.id, ...(children || []).map((c: any) => c.id)]
  }

  return [catRow.id]
}

/**
 * Apply locale-specific translations to product title and description
 */
function applyTranslations(product: any, locale: string) {
  // Default to English or if no translations exist
  if (!locale || locale === 'en') {
    return {
      title: product.title,
      description: product.description,
    }
  }

  // Check if translations field exists and has the requested locale
  if (product.translations && typeof product.translations === 'object') {
    const translations = product.translations[locale]
    if (translations && typeof translations === 'object') {
      return {
        title: translations.title || product.title,
        description: translations.description || product.description,
      }
    }
  }

  // Fallback to original title/description
  return {
    title: product.title,
    description: product.description,
  }
}

/**
 * Batch-fetch product variants grouped by product ID
 * Returns sizes, colors, and colorImages (first image_url per color)
 */
async function fetchVariantsByProductId(productIds: string[]): Promise<Map<string, { sizes: string[]; colors: string[]; colorImages: Record<string, string>; minPrice?: number; maxPrice?: number; hasVariantPricing?: boolean }>> {
  if (productIds.length === 0) return new Map()

  const { data: allVariants } = await supabaseAdmin
    .from('product_variants')
    .select('product_id, size, color, image_url, price_cents')
    .in('product_id', productIds)
    .eq('is_enabled', true)
    .eq('is_available', true)

  const grouped = new Map<string, { sizes: Set<string>; colors: Set<string>; colorImages: Map<string, string>; prices: Set<number> }>()
  for (const v of allVariants || []) {
    if (!grouped.has(v.product_id)) {
      grouped.set(v.product_id, { sizes: new Set(), colors: new Set(), colorImages: new Map(), prices: new Set() })
    }
    const entry = grouped.get(v.product_id)!
    if (v.size) entry.sizes.add(v.size)
    if (v.price_cents != null) entry.prices.add(v.price_cents)
    if (v.color) {
      entry.colors.add(v.color)
      // Keep first image_url per color
      if (v.image_url && !entry.colorImages.has(v.color)) {
        entry.colorImages.set(v.color, v.image_url)
      }
    }
  }

  const result = new Map<string, { sizes: string[]; colors: string[]; colorImages: Record<string, string>; minPrice?: number; maxPrice?: number; hasVariantPricing?: boolean }>()
  for (const [id, { sizes, colors, colorImages, prices }] of grouped) {
    const priceArr = [...prices]
    const hasVariantPricing = priceArr.length > 1 && Math.min(...priceArr) !== Math.max(...priceArr)
    result.set(id, {
      sizes: sortSizes([...sizes]),
      colors: [...colors],
      colorImages: Object.fromEntries(colorImages),
      ...(hasVariantPricing ? {
        minPrice: Math.min(...priceArr) / 100,
        maxPrice: Math.max(...priceArr) / 100,
        hasVariantPricing: true,
      } : {}),
    })
  }
  return result
}

/**
 * Batch-fetch product labels grouped by product ID
 */
async function fetchLabelsByProductId(productIds: string[]): Promise<Map<string, string[]>> {
  if (productIds.length === 0) return new Map()
  const { data } = await supabaseAdmin
    .from('product_labels')
    .select('product_id, label_type')
    .in('product_id', productIds)
  const result = new Map<string, string[]>()
  for (const row of data || []) {
    const existing = result.get(row.product_id) || []
    existing.push(row.label_type)
    result.set(row.product_id, existing)
  }
  return result
}

function buildPricingFields(variantsMap: Map<string, { sizes: string[]; colors: string[]; colorImages: Record<string, string>; minPrice?: number; maxPrice?: number; hasVariantPricing?: boolean }>, productId: string): { maxPrice?: number; hasVariantPricing?: boolean } {
  const pv = variantsMap.get(productId)
  if (!pv?.hasVariantPricing) return {}
  return { maxPrice: pv.maxPrice, hasVariantPricing: true }
}

function buildVariantsField(variantsMap: Map<string, { sizes: string[]; colors: string[]; colorImages: Record<string, string>; minPrice?: number; maxPrice?: number; hasVariantPricing?: boolean }>, productId: string) {
  const pv = variantsMap.get(productId)
  if (!pv) return {}
  return {
    ...(pv.sizes.length > 0 ? { sizes: pv.sizes } : {}),
    ...(pv.colors.length > 0 ? { colors: pv.colors } : {}),
    ...(Object.keys(pv.colorImages).length > 0 ? { colorImages: pv.colorImages } : {}),
  }
}

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

    // Batch-fetch variants for paginated products
    const variantsMap = await fetchVariantsByProductId(paginatedProducts.map(p => p.id))

    // Map to frontend format
    const items = paginatedProducts.map((p) => {
      const { title, description } = applyTranslations(p, locale)
      return {
        id: p.id,
        slug: p.slug,
        title,
        description,
        price: p.base_price_cents / 100,
        ...buildPricingFields(variantsMap, p.id),
        currency: p.currency?.toUpperCase() || 'EUR',
        image: p.branded_hero_url || (Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : ''),
        images: Array.isArray(p.images) ? p.images.map((img: { src?: string; url?: string; alt?: string }) => img.src || img.url || '') : [],
        rating: Number(p.avg_rating) || 0,
        reviewCount: p.review_count || 0,
        category: (p.categories as any)?.slug || 'other',
        tags: p.tags || [],
        inStock: variantsMap.has(p.id),
        createdAt: p.created_at,
        variants: buildVariantsField(variantsMap, p.id),
        // Include search metadata for debugging
        vectorRank: p.vectorRank,
        keywordRank: p.keywordRank,
        vectorSimilarity: p.vectorSimilarity,
      }
    })

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
      .select('id, slug, title, description, category_id, categories(slug), tags, base_price_cents, compare_at_price_cents, currency, images, branded_hero_url, status, avg_rating, review_count, created_at, translations')
      .eq('status', 'active')
      .is('deleted_at', null)
      .in('id', productIds)

    if (category && category !== 'all') {
      const catIds = await resolveCategoryIds(category)
      if (catIds) {
        query = query.in('category_id', catIds)
      }
    }

    const { data: products, error: productsError } = await query

    if (productsError) return []

    // Add similarity scores to products
    const similarityMap = new Map(
      productResults.map((r: any) => [r.source_id, r.similarity])
    )

    return (products || [])
      .map((p) => ({ ...p, similarity: Number(similarityMap.get(p.id) || 0) }))
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
      .select('id, slug, title, description, category_id, categories(slug), tags, base_price_cents, compare_at_price_cents, currency, images, branded_hero_url, status, avg_rating, review_count, created_at, translations')
      .eq('status', 'active')
      .is('deleted_at', null)

    if (category && category !== 'all') {
      const catIds = await resolveCategoryIds(category)
      if (catIds) {
        query = query.in('category_id', catIds)
      }
    }

    // PostgreSQL full-text search on title, description, category
    // SECURITY: Sanitize user input to prevent SQL injection
    const sanitizedSearchQuery = sanitizeForLike(searchQuery, 'both')
    query = query.or(`title.ilike.${sanitizedSearchQuery},description.ilike.${sanitizedSearchQuery}`)
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
    .select('id, slug, title, description, category_id, categories(slug), tags, base_price_cents, compare_at_price_cents, currency, images, branded_hero_url, status, avg_rating, review_count, created_at, translations', { count: 'exact' })
    .eq('status', 'active')
    .is('deleted_at', null)

  if (category && category !== 'all') {
    const catIds = await resolveCategoryIds(category)
    if (catIds) {
      query = query.in('category_id', catIds)
    }
  }

  if (searchQuery) {
    // SECURITY: Sanitize user input to prevent SQL injection
    const sanitizedSearchQuery = sanitizeForPostgrest(searchQuery)
    query = query.or(`title.wfts.${sanitizedSearchQuery},description.wfts.${sanitizedSearchQuery}`)
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

  const variantsMap = await fetchVariantsByProductId((products || []).map(p => p.id))

  const items = (products || []).map((p) => {
    const { title, description } = applyTranslations(p, locale)
    return {
      id: p.id,
      slug: p.slug,
      title,
      description,
      price: p.base_price_cents / 100,
      ...buildPricingFields(variantsMap, p.id),
      currency: p.currency?.toUpperCase() || 'EUR',
      image: p.branded_hero_url || (Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : ''),
      images: Array.isArray(p.images) ? p.images.map((img: { src?: string; url?: string; alt?: string }) => img.src || img.url || '') : [],
      rating: Number(p.avg_rating) || 0,
      reviewCount: p.review_count || 0,
      category: (p.categories as any)?.slug || 'other',
      tags: p.tags || [],
      inStock: variantsMap.has(p.id),
      createdAt: p.created_at,
      variants: buildVariantsField(variantsMap, p.id),
    }
  })

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

/**
 * GET /api/products
 *
 * Fetch products with pagination, filtering, and search
 *
 * Query Parameters:
 * @param {string} page - Page number (default: 1)
 * @param {string} limit - Items per page (default: 10)
 * @param {string} locale - Locale for translations (en/es/de, default: en)
 * @param {string} category - Filter by category
 * @param {string} q - Search query (hybrid vector + keyword search)
 * @param {string} sort - Sort order (newest, price-asc, price-desc, rating)
 * @param {string} newArrivals - Filter for new arrivals (true/false)
 * @param {string} ids - Comma-separated product IDs (fast-path lookup)
 *
 * @returns {Object} JSON response with products list, pagination, and metadata
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const locale = searchParams.get('locale') || 'en'
    const category = searchParams.get('category')
    const search = searchParams.get('q') || searchParams.get('search')
    const sort = searchParams.get('sort')
    const newArrivals = searchParams.get('newArrivals')

    // Multi-tenant: read tenant_id from x-tenant-id header (set by middleware after domain resolution)
    // Falls back to no filter (single-tenant mode) when header is absent
    const tenantId = request.headers.get('x-tenant-id') || null

    // Fast-path: fetch by product IDs (used by guest wishlist)
    const ids = searchParams.get('ids')
    if (ids) {
      const idList = ids.split(',').filter(Boolean).slice(0, 50)
      if (idList.length === 0) {
        return NextResponse.json({ success: true, total: 0, items: [], page: 1, limit: 50, totalPages: 0 })
      }

      const { data: products, error: idsError } = await supabaseAdmin
        .from('products')
        .select('id, slug, title, description, category_id, categories(slug), tags, base_price_cents, compare_at_price_cents, currency, images, branded_hero_url, status, avg_rating, review_count, created_at, translations')
        .eq('status', 'active')
        .is('deleted_at', null)
        .in('id', idList)

      if (idsError) {
        return NextResponse.json({ success: false, error: 'Failed to fetch products' }, { status: 500 })
      }

      const idsVariantsMap = await fetchVariantsByProductId((products || []).map(p => p.id))

      const items = (products || []).map((p) => {
        const { title, description } = applyTranslations(p, locale)
        return {
          id: p.id,
        slug: p.slug,
          title,
          description,
          price: p.base_price_cents / 100,
          ...buildPricingFields(idsVariantsMap, p.id),
          currency: p.currency?.toUpperCase() || 'EUR',
          image: p.branded_hero_url || (Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : ''),
          images: Array.isArray(p.images) ? p.images.map((img: any) => img.src || img.url || '') : [],
          rating: Number(p.avg_rating) || 0,
          reviewCount: p.review_count || 0,
          category: (p.categories as any)?.slug || 'other',
          inStock: idsVariantsMap.has(p.id),
          variants: buildVariantsField(idsVariantsMap, p.id),
        }
      })
      return NextResponse.json({ success: true, total: items.length, items, page: 1, limit: items.length, totalPages: 1 })
    }

    // If search query exists, use hybrid search (vector + keyword)
    if (search && search.trim().length > 0) {
      return await hybridSearch(search, category, locale, page, limit, sort)
    }

    // Otherwise, use traditional database query
    let query = supabaseAdmin
      .from('products')
      .select('id, slug, title, description, category_id, categories(slug), tags, base_price_cents, compare_at_price_cents, currency, images, branded_hero_url, status, avg_rating, review_count, created_at, translations', { count: 'exact' })
      .eq('status', 'active')
      .is('deleted_at', null)

    // Multi-tenant isolation: filter by tenant_id when x-tenant-id header is set
    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    // Filter by category slug → resolve to category_id(s) for proper filtering
    if (category && category !== 'all') {
      const { data: catRow } = await supabaseAdmin
        .from('categories')
        .select('id, parent_id')
        .eq('slug', category)
        .eq('is_active', true)
        .single()

      if (catRow) {
        if (!catRow.parent_id) {
          // Parent category: include products from parent + all children
          const { data: children } = await supabaseAdmin
            .from('categories')
            .select('id')
            .eq('parent_id', catRow.id)
            .eq('is_active', true)

          const allIds = [catRow.id, ...(children || []).map(c => c.id)]
          query = query.in('category_id', allIds)
        } else {
          query = query.eq('category_id', catRow.id)
        }
      } else {
        // Unknown category slug — return empty results
        query = query.eq('category_id', '00000000-0000-0000-0000-000000000000')
      }
    }

    // Filter new arrivals (last 14 days)
    if (newArrivals === 'true') {
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      query = query.gte('created_at', fourteenDaysAgo.toISOString())
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

    // Batch-fetch variants and labels for returned products
    const productIds = (products || []).map(p => p.id)
    const [variantsMap, labelsMap] = await Promise.all([
      fetchVariantsByProductId(productIds),
      fetchLabelsByProductId(productIds),
    ])

    // Map DB schema to frontend format
    const items = (products || []).map((p) => {
      const { title, description } = applyTranslations(p, locale)
      return {
        id: p.id,
        slug: p.slug,
        title,
        description,
        price: p.base_price_cents / 100,
        ...buildPricingFields(variantsMap, p.id),
        compareAtPrice: p.compare_at_price_cents ? p.compare_at_price_cents / 100 : undefined,
        currency: p.currency?.toUpperCase() || 'EUR',
        image: p.branded_hero_url || (Array.isArray(p.images) && p.images.length > 0 ? (p.images[0].src || p.images[0].url) : ''),
        images: Array.isArray(p.images) ? p.images.map((img: { src?: string; url?: string; alt?: string }) => img.src || img.url || '') : [],
        rating: Number(p.avg_rating) || 0,
        reviewCount: p.review_count || 0,
        category: (p.categories as any)?.slug || 'other',
        tags: p.tags || [],
        inStock: variantsMap.has(p.id),
        createdAt: p.created_at,
        labels: labelsMap.get(p.id) || undefined,
        variants: buildVariantsField(variantsMap, p.id),
      }
    })

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

/**
 * POST /api/products
 *
 * Creates a product for the current tenant (identified via x-tenant-id header).
 * Enforces plan-based product limits before inserting.
 *
 * This endpoint is used by PodClaw and programmatic integrations.
 * The admin panel uses its own POST /panel/api/products route.
 *
 * Body: { title, description, base_price, currency, category, tags?, status? }
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch (error) {
    return authErrorResponse(error)
  }

  const tenantId = request.headers.get('x-tenant-id')

  try {
    const body = await request.json()
    const { title, description, base_price, currency = 'usd', category = 'apparel', tags = [], status = 'active' } = body

    if (!title) {
      return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 })
    }

    // Enforce plan product limit (if tenant context is available)
    if (tenantId) {
      const gate = await checkPlanGate(tenantId, 'products')
      if (!gate.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: gate.reason,
            code: 'PLAN_LIMIT_EXCEEDED',
            limit: gate.limit,
            current: gate.current,
            plan: gate.plan,
            upgrade_to: gate.upgrade_to,
          },
          { status: 402 } // 402 Payment Required = plan upgrade needed
        )
      }
    }

    // Generate collision-safe slug (immutable once set)
    let baseSlug = slugify(title) || 'product'
    const { data: existingSlugs } = await supabaseAdmin
      .from('products')
      .select('slug')
      .like('slug', `${baseSlug}%`)
    const usedSlugs = new Set((existingSlugs || []).map((p: { slug: string }) => p.slug))
    let slug = baseSlug
    let counter = 1
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter++}`
    }

    const insertData: Record<string, unknown> = {
      title,
      slug,
      description: description ?? '',
      base_price_cents: Math.round((Number(base_price) || 0) * 100),
      currency: currency.toLowerCase(),
      category,
      tags,
      status,
      ...(tenantId && { tenant_id: tenantId }),
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert(insertData)
      .select('id, title, status, created_at')
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, product }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/products]', err)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
