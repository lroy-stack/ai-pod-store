import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthUser } from '@/lib/auth-guard'


export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  const body = await request.json()
  const { experiment_id, variant, event_type, value, session_id, metadata } = body

  if (!experiment_id || !variant || !event_type) {
    return Response.json({ error: 'Missing required fields: experiment_id, variant, event_type' }, { status: 400 })
  }

  const validEventTypes = ['impression', 'click', 'conversion', 'revenue']
  if (!validEventTypes.includes(event_type)) {
    return Response.json({ error: `Invalid event_type. Must be one of: ${validEventTypes.join(', ')}` }, { status: 400 })
  }

  // Get user ID if authenticated (optional)
  const user = await getAuthUser(request)

  const { data, error } = await supabaseAdmin
    .from('ab_events')
    .insert({
      experiment_id,
      variant,
      event_type,
      value: value || null,
      user_id: user?.id || null,
      session_id: session_id || null,
    })
    .select()
    .single()

  if (error) {
    console.error('A/B event insert error:', error)
    return Response.json({ error: 'Failed to record event' }, { status: 500 })
  }

  return Response.json({ success: true, event: data })
}
