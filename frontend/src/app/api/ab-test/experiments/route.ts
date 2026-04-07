import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'


export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  const { data: experiments, error } = await supabaseAdmin
    .from('ab_experiments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: 'Failed to fetch experiments' }, { status: 500 })
  }

  // Fetch aggregated stats for each experiment
  const experimentsWithStats = await Promise.all(
    (experiments || []).map(async (exp) => {
      const { data: events } = await supabaseAdmin
        .from('ab_events')
        .select('variant, event_type')
        .eq('experiment_id', exp.id)

      const stats: Record<string, { impressions: number; clicks: number; conversions: number }> = {}

      for (const event of events || []) {
        if (!stats[event.variant]) {
          stats[event.variant] = { impressions: 0, clicks: 0, conversions: 0 }
        }
        if (event.event_type === 'impression') stats[event.variant].impressions++
        if (event.event_type === 'click') stats[event.variant].clicks++
        if (event.event_type === 'conversion') stats[event.variant].conversions++
      }

      return { ...exp, stats }
    })
  )

  return Response.json({ experiments: experimentsWithStats })
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  try {
    await requireAdmin(request)
  } catch (error) {
    return authErrorResponse(error)
  }

  const body = await request.json()
  const { name, description, variants, traffic_percentage } = body

  if (!name || !variants || !Array.isArray(variants) || variants.length < 2) {
    return Response.json(
      { error: 'Name and at least 2 variants are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('ab_experiments')
    .insert({
      name,
      description: description || null,
      variants,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Create experiment error:', error)
    return Response.json({ error: 'Failed to create experiment' }, { status: 500 })
  }

  return Response.json({ experiment: data }, { status: 201 })
}
