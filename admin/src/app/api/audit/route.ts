import { withAuth } from '@/lib/auth-middleware'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export const GET = withAuth(async (req, session) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(req.url)

    const actorType = searchParams.get('actor_type')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by actor_type if provided
    if (actorType && actorType !== 'all') {
      query = query.eq('actor_type', actorType)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Audit log fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
    }

    return NextResponse.json({
      logs: data || [],
      total: count || 0,
      limit,
      offset,
    })
  } catch (err) {
    console.error('Audit API error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
})
