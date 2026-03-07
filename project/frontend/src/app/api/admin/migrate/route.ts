import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    // Require admin auth
    try {
      await requireAdmin(request)
    } catch (error) {
      return authErrorResponse(error)
    }

    // Always block raw SQL execution via API — migrations must go through Supabase CLI
    return NextResponse.json(
      { error: 'Raw SQL execution via API is permanently disabled. Use Supabase CLI for migrations.' },
      { status: 403 }
    )

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
