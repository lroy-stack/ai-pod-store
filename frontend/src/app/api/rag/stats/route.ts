import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Get statistics about documents in the RAG knowledge base
 * GET /api/rag/stats
 */
export async function GET(request: NextRequest) {
  try {
    try { await requireAdmin(request) } catch (e) { return authErrorResponse(e) }
    // Count total documents
    const { count: totalCount, error: totalError } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })

    if (totalError) {
      return NextResponse.json(
        { error: 'Failed to count documents' },
        { status: 500 }
      )
    }

    // Count by source_type
    const { data: byType, error: typeError } = await supabaseAdmin
      .from('documents')
      .select('source_type')

    if (typeError) {
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    const typeCounts = (byType || []).reduce((acc: any, doc: any) => {
      const type = doc.source_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    // Count by locale
    const { data: byLocale, error: localeError } = await supabaseAdmin
      .from('documents')
      .select('locale')

    if (localeError) {
      return NextResponse.json(
        { error: 'Failed to fetch locales' },
        { status: 500 }
      )
    }

    const localeCounts = (byLocale || []).reduce((acc: any, doc: any) => {
      const locale = doc.locale || 'unknown'
      acc[locale] = (acc[locale] || 0) + 1
      return acc
    }, {})

    // Sample documents (first 5)
    const { data: samples, error: samplesError } = await supabaseAdmin
      .from('documents')
      .select('id, source_type, locale, content')
      .limit(15)

    if (samplesError) {
      return NextResponse.json(
        { error: 'Failed to fetch samples' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      total: totalCount || 0,
      byType: typeCounts,
      byLocale: localeCounts,
      samples: (samples || []).map((doc: any) => ({
        id: doc.id,
        type: doc.source_type,
        locale: doc.locale,
        content: doc.content?.substring(0, 60) + '...',
      })),
    })
  } catch (error) {
    console.error('RAG stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
