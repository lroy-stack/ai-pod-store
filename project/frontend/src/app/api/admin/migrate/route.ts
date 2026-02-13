import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json()

    if (!sql) {
      return NextResponse.json({ error: 'SQL is required' }, { status: 400 })
    }

    // Execute raw SQL using the admin client
    const { data, error } = await supabaseAdmin.rpc('query', { query_text: sql })

    if (error) {
      // If RPC doesn't exist, return details for manual execution
      return NextResponse.json({
        error: 'RPC query function not available',
        message: error.message,
        note: 'You may need to execute this SQL directly in Supabase dashboard'
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
