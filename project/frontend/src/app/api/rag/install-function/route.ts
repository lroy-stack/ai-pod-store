import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Install search_documents RPC function
 * POST /api/rag/install-function
 */
export async function POST() {
  try {
    const sql = `
      -- Create search_documents RPC function for vector similarity search
      CREATE OR REPLACE FUNCTION search_documents(
        query_embedding vector(768),
        match_count int DEFAULT 10,
        filter_locale text DEFAULT NULL
      )
      RETURNS TABLE (
        id uuid,
        content text,
        metadata jsonb,
        source_type varchar(50),
        source_id varchar(255),
        locale char(5),
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          d.id,
          d.content,
          d.metadata,
          d.source_type,
          d.source_id,
          d.locale,
          1 - (d.embedding <=> query_embedding) AS similarity
        FROM documents d
        WHERE
          d.embedding IS NOT NULL
          AND (filter_locale IS NULL OR d.locale = filter_locale)
        ORDER BY d.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;

      -- Grant execute permission
      GRANT EXECUTE ON FUNCTION search_documents(vector(768), int, text) TO authenticated, anon;
    `

    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql })

    if (error) {
      console.error('Function installation error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to install function',
          details: error.message,
          note: 'RPC exec_sql may not be available - migration file created instead',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'search_documents function installed successfully',
    })
  } catch (error: any) {
    console.error('Install function error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message,
        note: 'Migration file exists at supabase/migrations/20260214124326_create_search_documents_function.sql - use supabase db push to apply',
      },
      { status: 500 }
    )
  }
}
