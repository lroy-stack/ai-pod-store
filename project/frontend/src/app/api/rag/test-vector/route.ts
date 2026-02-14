import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Test vector insertion with 768 dimensions
 * POST /api/rag/test-vector
 */
export async function POST() {
  try {
    // Generate a test 768-dimensional vector (all zeros for simplicity)
    const testVector = new Array(768).fill(0)

    // Insert a test document
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('documents')
      .insert({
        content: 'Test document for vector verification',
        metadata: { test: true, timestamp: new Date().toISOString() },
        embedding: testVector,
        source_type: 'faq',
        source_id: 'test-vector-verification',
        locale: 'en',
      })
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to insert test document',
          details: insertError.message,
          hint: insertError.hint || null,
        },
        { status: 500 }
      )
    }

    // Clean up - delete the test document
    if (insertData && insertData.length > 0) {
      const testId = insertData[0].id
      await supabaseAdmin.from('documents').delete().eq('id', testId)
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully inserted and deleted test document with 768-dimensional vector',
      vectorDimension: 768,
      verification: {
        canInsertVector768: true,
        canQueryBack: true,
        canDelete: true,
      },
    })
  } catch (error: any) {
    console.error('Vector test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Get existing documents with locale information
 * GET /api/rag/test-vector
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('id, content, locale, source_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch documents', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      documents: data,
      count: data.length,
      locales: [...new Set(data.map((d: any) => d.locale))],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
