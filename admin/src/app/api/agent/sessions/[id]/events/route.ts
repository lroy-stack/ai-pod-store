import { withAuth } from '@/lib/auth-middleware'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

export const GET = withAuth(async (req, session, context) => {
  try {
    const { id: sessionId } = await context.params

    // Fetch events for this session in chronological order (for replay)
    const { data: events, error } = await supabase
      .from('agent_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Failed to fetch agent events:', error)
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      events: events || [],
      count: events?.length || 0,
    })
  } catch (err) {
    console.error('Error in agent events API:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
