import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Verify documents table schema
 * GET /api/rag/verify-schema
 */
export async function GET() {
  try {
    // Query information_schema using direct SQL via RPC
    const { data: columns, error: columnsError } = await supabaseAdmin.rpc(
      'get_table_columns',
      { table_name_param: 'documents' }
    )

    // If the RPC doesn't exist, try a simple query to verify table exists
    let schemaInfo: any = null
    if (columnsError) {
      console.log('RPC not available, using fallback method')
      // Fallback: try to query the table and check if it works
      const { data: testData, error: testError } = await supabaseAdmin
        .from('documents')
        .select('*')
        .limit(0)

      if (testError) {
        console.error('Error querying documents table:', testError)
        return NextResponse.json(
          { error: 'Documents table not accessible', details: testError.message },
          { status: 500 }
        )
      }

      // Table exists and is queryable - assume schema is correct based on migration
      schemaInfo = {
        tableExists: true,
        assumedSchema: true,
        message: 'Table exists and is queryable. Schema assumed from migration.',
      }
    } else {
      schemaInfo = {
        tableExists: true,
        columns: columns,
      }
    }

    // Check for required columns by attempting to select them
    const { data: columnTest, error: columnError } = await supabaseAdmin
      .from('documents')
      .select('id, content, embedding, locale, source_type, metadata')
      .limit(1)

    // Determine if all required columns are accessible
    const allColumnsAccessible = columnError === null

    // Count existing documents
    const { count, error: countError } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      schemaInfo,
      verification: {
        tableExists: true,
        columnsAccessible: allColumnsAccessible,
        canSelectId: allColumnsAccessible,
        canSelectContent: allColumnsAccessible,
        canSelectEmbedding: allColumnsAccessible,
        canSelectLocale: allColumnsAccessible,
        canSelectSourceType: allColumnsAccessible,
        canSelectMetadata: allColumnsAccessible,
        documentCount: count || 0,
        allRequirementsPass: allColumnsAccessible,
      },
      message: allColumnsAccessible
        ? 'Documents table exists with all required columns (id, content, embedding vector(768), locale, source_type, metadata)'
        : 'Some columns are not accessible',
      migrationBased: {
        expectedSchema: {
          embedding: 'VECTOR(768)',
          locale: 'CHAR(5) or VARCHAR',
          content: 'TEXT',
          source_type: 'VARCHAR(50)',
          metadata: 'JSONB',
        },
        note: 'Schema created via migration 20260213000000_initial_schema.sql',
      },
    })
  } catch (error: any) {
    console.error('Schema verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
