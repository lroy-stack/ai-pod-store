import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { getCached, setCached, isRedisAvailable } from '@/lib/redis'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Create a cache key for semantic search
 */
function createCacheKey(query: string, limit: number, locale?: string): string {
  const normalizedQuery = query.toLowerCase().trim()
  const cacheInput = JSON.stringify({ query: normalizedQuery, limit, locale: locale || 'all' })
  const hash = crypto.createHash('sha256').update(cacheInput).digest('hex').substring(0, 16)
  return `rag:search:${hash}`
}

/**
 * Vector similarity search in documents with semantic caching
 * POST /api/rag/search
 * Body: { query: string, limit?: number, locale?: string }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    try { await requireAuth(request) } catch (e) { return authErrorResponse(e) }

    const { query, limit = 10, locale } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      )
    }

    // Try to get cached result
    const cacheKey = createCacheKey(query, limit, locale)
    const cachedResult = await getCached(cacheKey)

    if (cachedResult) {
      const responseTime = Date.now() - startTime
      console.log(`[RAG Cache HIT] Query: "${query}" | Response time: ${responseTime}ms`)
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        cacheKey,
        responseTime,
      })
    }

    console.log(`[RAG Cache MISS] Query: "${query}" | Key: ${cacheKey}`)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // 1. Generate embedding for the query
    const embeddingUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent'

    const embeddingResponse = await fetch(embeddingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: {
          parts: [{ text: query }],
        },
        outputDimensionality: 768,
      }),
    })

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.text()
      console.error('Gemini embedding error:', errorData)
      return NextResponse.json(
        { error: 'Failed to generate query embedding' },
        { status: 500 }
      )
    }

    const embeddingData = await embeddingResponse.json()
    const queryEmbedding = embeddingData.embedding?.values || []

    if (queryEmbedding.length !== 768) {
      return NextResponse.json(
        {
          error: 'Invalid embedding dimension',
          expected: 768,
          received: queryEmbedding.length,
        },
        { status: 500 }
      )
    }

    // 2. Perform hybrid search (vector + keyword text matching)
    // Uses the hybrid_search_documents RPC function which combines:
    // - 70% vector similarity (semantic)
    // - 30% text relevance (keyword matching via PostgreSQL full-text search)
    const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
      'hybrid_search_documents',
      {
        query_embedding: queryEmbedding,
        query_text: query, // Pass original query text for keyword matching
        match_count: limit,
        filter_locale: locale || null,
      }
    )

    if (searchError) {
      console.error('Vector search error:', searchError)

      // Fallback: Try direct query with ORDER BY if RPC doesn't exist
      // This uses cosine distance operator <=>
      let query = supabaseAdmin
        .from('documents')
        .select('id, content, metadata, source_type, source_id, locale')
        .limit(limit)

      if (locale) {
        query = query.eq('locale', locale)
      }

      const { data: fallbackResults, error: fallbackError } = await query

      if (fallbackError) {
        console.error('RAG fallback error:', fallbackError)
        return NextResponse.json(
          { error: 'Vector search failed' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        query,
        results: fallbackResults,
        count: fallbackResults?.length || 0,
        usedFallback: true,
        message: 'Using fallback query (RPC function not available)',
      })
    }

    // Check if all results have low similarity (< 0.65 threshold)
    const SIMILARITY_THRESHOLD = 0.65
    const hasRelevantResults = searchResults && searchResults.length > 0 &&
      searchResults.some((r: any) => r.similarity >= SIMILARITY_THRESHOLD)

    const responseTime = Date.now() - startTime

    const response: any = {
      success: true,
      query,
      results: searchResults || [],
      count: searchResults?.length || 0,
      embedding: {
        dimension: queryEmbedding.length,
      },
      cached: false,
      responseTime,
    }

    // Add fallback message if no relevant results
    if (!hasRelevantResults) {
      response.message = 'No highly relevant results found. Showing best matches with low similarity scores.'
      response.lowRelevance = true
    }

    // Cache the response for 1 hour (3600 seconds)
    // Only cache if we have results and Redis is available
    if (searchResults && searchResults.length > 0) {
      await setCached(cacheKey, {
        success: true,
        query,
        results: searchResults,
        count: searchResults.length,
        embedding: { dimension: queryEmbedding.length },
        message: response.message,
        lowRelevance: response.lowRelevance,
      }, 3600)

      if (isRedisAvailable()) {
        response.cacheKey = cacheKey
        console.log(`[RAG Cache SET] Query: "${query}" | Key: ${cacheKey}`)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('RAG search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get search configuration
 * GET /api/rag/search
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/rag/search',
    method: 'POST',
    parameters: {
      query: 'Search query text (required)',
      limit: 'Number of results to return (default: 10)',
      locale: 'Filter by locale (optional, e.g., "en", "es", "de")',
    },
    example: {
      query: 'cat t-shirt',
      limit: 5,
      locale: 'en',
    },
  })
}
