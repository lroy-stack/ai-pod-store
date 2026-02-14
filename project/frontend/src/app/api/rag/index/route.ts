import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Chunk text into smaller pieces for better RAG retrieval
 * Strategy: Split on sentence boundaries, keep chunks under 1000 tokens (~750 chars)
 */
function chunkText(text: string, maxChunkSize = 750): string[] {
  // If text is short enough, return as single chunk
  if (text.length <= maxChunkSize) {
    return [text]
  }

  const chunks: string[] = []

  // Split on sentence boundaries (., !, ?, followed by space or newline)
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text]

  let currentChunk = ''

  for (const sentence of sentences) {
    // If adding this sentence would exceed max size, save current chunk and start new one
    if (currentChunk.length > 0 && currentChunk.length + sentence.length > maxChunkSize) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  // If no chunks were created (e.g., single long sentence), split by character limit
  if (chunks.length === 0) {
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize))
    }
  }

  return chunks
}

/**
 * Index a new document into the RAG knowledge base
 * POST /api/rag/index
 * Body: {
 *   content: string,
 *   metadata?: object,
 *   source_type: 'product' | 'design' | 'faq' | 'policy',
 *   source_id?: string,
 *   locale?: string
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      content,
      metadata = {},
      source_type,
      source_id = null,
      locale = 'en',
    } = body

    // Validate required fields
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      )
    }

    if (!source_type || !['product', 'design', 'faq', 'policy'].includes(source_type)) {
      return NextResponse.json(
        {
          error: 'source_type is required and must be one of: product, design, faq, policy',
        },
        { status: 400 }
      )
    }

    if (content.length < 10) {
      return NextResponse.json(
        { error: 'Content must be at least 10 characters' },
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

    // 1. Chunk the content if it's long
    const chunks = chunkText(content, 750) // ~750 chars ≈ 200-250 tokens (well under 1000 token limit)

    const indexedChunks = []
    const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

    // 2. Process each chunk: generate embedding + insert into DB
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]

      // Generate embedding for this chunk
      const embeddingResponse = await fetch(embeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text: chunk }],
          },
          outputDimensionality: 768,
        }),
      })

      if (!embeddingResponse.ok) {
        const errorData = await embeddingResponse.text()
        console.error(`Gemini embedding error for chunk ${i}:`, errorData)
        continue // Skip this chunk but continue with others
      }

      const embeddingData = await embeddingResponse.json()
      const embedding = embeddingData.embedding?.values || []

      if (embedding.length !== 768) {
        console.error(`Invalid embedding dimension for chunk ${i}: ${embedding.length}`)
        continue
      }

      // Insert chunk with embedding into the database
      const chunkMetadata = {
        ...metadata,
        chunk_index: i,
        total_chunks: chunks.length,
        chunk_size: chunk.length,
      }

      const { data: document, error: insertError } = await supabaseAdmin
        .from('documents')
        .insert({
          content: chunk,
          metadata: chunkMetadata,
          embedding: JSON.stringify(embedding),
          source_type,
          source_id,
          locale,
        })
        .select()
        .single()

      if (insertError) {
        console.error(`Document insert error for chunk ${i}:`, insertError)
        continue
      }

      indexedChunks.push({
        id: document.id,
        chunk_index: i,
        content_length: chunk.length,
        has_embedding: true,
      })
    }

    if (indexedChunks.length === 0) {
      return NextResponse.json(
        {
          error: 'Failed to index any chunks',
          details: 'All chunks failed embedding or insertion',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Document indexed successfully',
        chunks: indexedChunks,
        summary: {
          total_chunks: chunks.length,
          indexed_chunks: indexedChunks.length,
          original_length: content.length,
          max_chunk_size: Math.max(...chunks.map((c) => c.length)),
          avg_chunk_size: Math.round(
            chunks.reduce((sum, c) => sum + c.length, 0) / chunks.length
          ),
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('RAG index error:', error)
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
 * Get indexing configuration
 * GET /api/rag/index
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/rag/index',
    method: 'POST',
    description: 'Index a new document into the RAG knowledge base',
    parameters: {
      content: 'Document content (required, min 10 chars)',
      metadata: 'Additional metadata (optional, JSON object)',
      source_type: 'Document type: product, design, faq, or policy (required)',
      source_id: 'Reference ID to source entity (optional)',
      locale: 'Document locale (default: "en")',
    },
    example: {
      content: 'Our premium cotton t-shirts are made from 100% organic cotton.',
      metadata: {
        product_id: '123',
        category: 'apparel',
      },
      source_type: 'product',
      source_id: '123',
      locale: 'en',
    },
  })
}
