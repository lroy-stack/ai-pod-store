import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Generate embeddings for existing documents
 * POST /api/rag/seed-embeddings
 */
export async function POST() {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Get all documents without embeddings
    const { data: documents, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('id, content')
      .is('embedding', null)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch documents', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No documents need embeddings',
        count: 0,
      })
    }

    // Generate embeddings for each document
    const results = []
    for (const doc of documents) {
      const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

      const embeddingResponse = await fetch(embeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text: doc.content }],
          },
          outputDimensionality: 768,
        }),
      })

      if (!embeddingResponse.ok) {
        console.error(`Failed to generate embedding for document ${doc.id}`)
        results.push({ id: doc.id, success: false, error: 'Embedding generation failed' })
        continue
      }

      const embeddingData = await embeddingResponse.json()
      const embedding = embeddingData.embedding?.values || []

      if (embedding.length !== 768) {
        results.push({ id: doc.id, success: false, error: 'Invalid embedding dimension' })
        continue
      }

      // Update document with embedding
      const { error: updateError } = await supabaseAdmin
        .from('documents')
        .update({ embedding, updated_at: new Date().toISOString() })
        .eq('id', doc.id)

      if (updateError) {
        results.push({ id: doc.id, success: false, error: updateError.message })
      } else {
        results.push({ id: doc.id, success: true })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      message: `Generated embeddings for ${successCount}/${documents.length} documents`,
      totalDocuments: documents.length,
      successCount,
      results,
    })
  } catch (error: any) {
    console.error('Seed embeddings error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Add test documents with cat-related content
 * GET /api/rag/seed-embeddings
 */
export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Add cat-related test documents
    const testDocuments = [
      {
        content: 'Cat Phone Case - Cute cat design phone case with whiskers and ears',
        source_type: 'product',
        source_id: 'cat-phone-case',
        locale: 'en',
      },
      {
        content: 'Funny cat t-shirt with adorable kitten print, perfect for cat lovers',
        source_type: 'product',
        source_id: 'cat-tshirt',
        locale: 'en',
      },
      {
        content: 'Dog-themed mug with playful puppy design',
        source_type: 'product',
        source_id: 'dog-mug',
        locale: 'en',
      },
    ]

    const results = []
    for (const docData of testDocuments) {
      // Generate embedding
      const embeddingUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

      const embeddingResponse = await fetch(embeddingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [{ text: docData.content }],
          },
          outputDimensionality: 768,
        }),
      })

      if (!embeddingResponse.ok) {
        results.push({ content: docData.content, success: false, error: 'Embedding failed' })
        continue
      }

      const embeddingData = await embeddingResponse.json()
      const embedding = embeddingData.embedding?.values || []

      // Insert document with embedding
      const { data, error } = await supabaseAdmin
        .from('documents')
        .insert({
          ...docData,
          embedding,
          metadata: { test: true },
        })
        .select()

      if (error) {
        results.push({ content: docData.content, success: false, error: error.message })
      } else {
        results.push({ content: docData.content, success: true, id: data[0]?.id })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      message: `Added ${successCount}/${testDocuments.length} test documents with embeddings`,
      results,
    })
  } catch (error: any) {
    console.error('Add test documents error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
