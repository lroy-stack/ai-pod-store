import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Add multiple documents with embeddings
 * POST /api/rag/add-documents
 * Body: { documents: Array<{ content, source_type, source_id, locale }> }
 */
export async function POST(request: NextRequest) {
  try {
    try { await requireAdmin(request) } catch (e) { return authErrorResponse(e) }

    const { documents } = await request.json()

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: 'documents array is required' },
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

    const results = []
    for (const docData of documents) {
      // Generate embedding
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
        results.push({ content: docData.content, success: false, error: 'Insert failed' })
      } else {
        results.push({ content: docData.content, success: true, id: data[0]?.id })
      }
    }

    const successCount = results.filter((r) => r.success).length

    return NextResponse.json({
      success: true,
      message: `Added ${successCount}/${documents.length} documents with embeddings`,
      results,
    })
  } catch (error) {
    console.error('Add documents error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
