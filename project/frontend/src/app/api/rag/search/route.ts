import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Vector similarity search in documents
 * POST /api/rag/search
 * Body: { query: string, limit?: number, locale?: string }
 */
export async function POST(request: Request) {
  try {
    const { query, limit = 10, locale } = await request.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required and must be a string' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // 1. Generate embedding for the query
    const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

    const embeddingResponse = await fetch(embeddingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
        {
          error: 'Failed to generate query embedding',
          details: errorData,
        },
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

    // 2. Perform vector similarity search using pgvector
    // Note: We use the RPC function for vector search
    const { data: searchResults, error: searchError } = await supabaseAdmin.rpc(
      'search_documents',
      {
        query_embedding: queryEmbedding,
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
        return NextResponse.json(
          {
            error: 'Vector search failed',
            details: searchError.message,
            fallbackError: fallbackError.message,
          },
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

    return NextResponse.json({
      success: true,
      query,
      results: searchResults,
      count: searchResults?.length || 0,
      embedding: {
        dimension: queryEmbedding.length,
      },
    })
  } catch (error: any) {
    console.error('RAG search error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
      },
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
