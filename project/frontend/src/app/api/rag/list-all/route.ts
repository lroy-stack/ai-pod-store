import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * List all documents
 * GET /api/rag/list-all
 */
export async function GET() {
  try {
    const { data, error, count } = await supabaseAdmin
      .from('documents')
      .select('id, content, source_type, locale, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch documents', details: error.message },
        { status: 500 }
      )
    }

    // Check which ones have embeddings
    const { data: withEmbeddings, error: embError } = await supabaseAdmin
      .from('documents')
      .select('id')
      .not('embedding', 'is', null)

    const embeddingIds = new Set(withEmbeddings?.map((d: any) => d.id) || [])

    const documentsWithEmbeddingStatus = data?.map((d: any) => ({
      ...d,
      hasEmbedding: embeddingIds.has(d.id),
    }))

    return NextResponse.json({
      success: true,
      total: count,
      withEmbeddings: withEmbeddings?.length || 0,
      documents: documentsWithEmbeddingStatus,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
