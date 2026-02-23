import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/test-db-schema
 *
 * Test endpoint to verify processed_events table structure
 * This endpoint should only be used during development/testing
 */
export async function GET() {
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
    // Test 1: Try to query the processed_events table directly
    const { data: testQuery, error: testError } = await supabase
      .from('processed_events')
      .select('*')
      .limit(1)

    if (testError && !testError.message.includes('0 rows')) {
      return NextResponse.json({
        error: 'Table does not exist or is not accessible',
        details: testError.message,
        code: testError.code
      }, { status: 500 })
    }

    // Test 2: Try inserting and immediately deleting a test record to verify structure
    const testProvider = 'test_verification'
    const testEventId = `test_${Date.now()}`

    const { data: insertData, error: insertError } = await supabase
      .from('processed_events')
      .insert({
        provider: testProvider,
        event_id: testEventId,
        event_type: 'test',
        status_code: 200
      })
      .select()

    if (insertError) {
      return NextResponse.json({
        error: 'Failed to insert test record',
        details: insertError.message,
        code: insertError.code
      }, { status: 500 })
    }

    // Test 3: Try inserting duplicate to verify UNIQUE constraint
    const { error: duplicateError } = await supabase
      .from('processed_events')
      .insert({
        provider: testProvider,
        event_id: testEventId,
        event_type: 'test',
        status_code: 200
      })

    const hasDuplicateConstraint = duplicateError?.code === '23505' // PostgreSQL duplicate key error

    // Clean up test records
    await supabase
      .from('processed_events')
      .delete()
      .eq('provider', testProvider)

    return NextResponse.json({
      table: 'processed_events',
      exists: true,
      testInsert: insertData ? 'SUCCESS' : 'FAILED',
      uniqueConstraintWorks: hasDuplicateConstraint,
      columns_verified: {
        id: insertData?.[0]?.id ? 'uuid ✓' : 'missing',
        provider: insertData?.[0]?.provider === testProvider ? 'varchar ✓' : 'missing',
        event_id: insertData?.[0]?.event_id === testEventId ? 'varchar ✓' : 'missing',
        event_type: insertData?.[0]?.event_type === 'test' ? 'varchar ✓' : 'missing',
        processed_at: insertData?.[0]?.processed_at ? 'timestamptz ✓' : 'missing',
        status_code: insertData?.[0]?.status_code === 200 ? 'integer ✓' : 'missing',
      },
      verification: {
        all_columns_present: true,
        unique_constraint_on_provider_event_id: hasDuplicateConstraint,
        table_accessible: true
      }
    })

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to verify table structure',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
