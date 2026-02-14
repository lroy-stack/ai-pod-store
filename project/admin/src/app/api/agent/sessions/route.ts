import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { searchParams } = new URL(request.url)
    const agent = searchParams.get('agent')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!agent) {
      return NextResponse.json(
        { error: 'Missing agent parameter' },
        { status: 400 }
      )
    }

    // Note: The agent_sessions table currently uses session_type for agent type
    // We'll query by session_type matching the agent name
    const { data: sessions, error } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('session_type', agent)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Supabase error fetching sessions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: error.message },
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
}
