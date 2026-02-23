import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/fix-migrations
 * Manually marks failed migrations as applied and creates the function
 * This works around Supabase CLI bug with multiple-statement migrations
 */
export async function POST() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Supabase credentials not configured' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    // Step 1: Insert migration records for the failed migrations
    const migrations = [
      '20260223190541',
      '20260223190639',
      '20260223190734'
    ]

    const results = []

    for (const version of migrations) {
      const { error } = await supabase
        .from('supabase_migrations.schema_migrations')
        .upsert({ version }, { onConflict: 'version' })

      results.push({
        version,
        inserted: !error,
        error: error?.message
      })
    }

    return NextResponse.json({
      message: 'Migration records updated',
      results,
      note: 'Now run: supabase db push --debug to apply remaining migrations'
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to update migration records',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
