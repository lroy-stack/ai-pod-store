import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/auth-middleware'
import type { SessionData } from '@/lib/session'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

export const GET = withAuth(async (request: NextRequest, session: SessionData) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { searchParams } = new URL(request.url)
    const agent = searchParams.get('agent')
    const limit = parseInt(searchParams.get('limit') || '20')

    let query = supabase
      .from('agent_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (agent) {
      query = query.eq('session_type', agent)
    }

    const { data: sessions, error } = await query

    if (error) {
      console.error('Supabase error fetching sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      sessions: sessions || [],
      count: sessions?.length || 0,
    })
  } catch (error) {
    console.error('Error in /api/agent/sessions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
