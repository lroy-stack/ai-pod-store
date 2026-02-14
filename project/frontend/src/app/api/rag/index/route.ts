import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    // 1. Generate embedding for the content using Gemini
    const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

    const embeddingResponse = await fetch(embeddingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: {
          parts: [{ text: content }],
        },
        outputDimensionality: 768,
      }),
    })

    if (!embeddingResponse.ok) {
      const errorData = await embeddingResponse.text()
      console.error('Gemini embedding error:', errorData)
      return NextResponse.json(
        {
          error: 'Failed to generate embedding',
          details: errorData,
        },
        { status: 500 }
      )
    }

    const embeddingData = await embeddingResponse.json()
    const embedding = embeddingData.embedding?.values || []

    if (embedding.length !== 768) {
      return NextResponse.json(
        {
          error: 'Invalid embedding dimension',
          expected: 768,
          received: embedding.length,
        },
        { status: 500 }
      )
    }

    // 2. Insert document with embedding into the database
    const { data: document, error: insertError } = await supabaseAdmin
      .from('documents')
      .insert({
        content,
        metadata,
        embedding: JSON.stringify(embedding), // Store as JSON string for pgvector
        source_type,
        source_id,
        locale,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Document insert error:', insertError)
      return NextResponse.json(
        {
          error: 'Failed to insert document',
          details: insertError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        document: {
          id: document.id,
          content: document.content,
          metadata: document.metadata,
          source_type: document.source_type,
          source_id: document.source_id,
          locale: document.locale,
          created_at: document.created_at,
          has_embedding: !!document.embedding,
          embedding_dimension: embedding.length,
        },
        message: 'Document indexed successfully',
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
