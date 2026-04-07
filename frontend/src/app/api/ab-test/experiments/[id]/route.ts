import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  const { id } = await params

  const { data: experiment, error } = await supabaseAdmin
    .from('ab_experiments')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !experiment) {
    return Response.json({ error: 'Experiment not found' }, { status: 404 })
  }

  // Aggregated stats per variant
  const { data: events } = await supabaseAdmin
    .from('ab_events')
    .select('variant, event_type, value, created_at')
    .eq('experiment_id', id)

  const variantStats: Record<string, {
    impressions: number
    clicks: number
    conversions: number
    revenue: number
    conversion_rate: number
  }> = {}

  for (const event of events || []) {
    if (!variantStats[event.variant]) {
      variantStats[event.variant] = { impressions: 0, clicks: 0, conversions: 0, revenue: 0, conversion_rate: 0 }
    }
    const vs = variantStats[event.variant]
    switch (event.event_type) {
      case 'impression': vs.impressions++; break
      case 'click': vs.clicks++; break
      case 'conversion': vs.conversions++; break
      case 'revenue': vs.revenue += Number(event.value) || 0; break
    }
  }

  // Calculate conversion rates
  for (const variant of Object.values(variantStats)) {
    variant.conversion_rate = variant.impressions > 0
      ? (variant.conversions / variant.impressions) * 100
      : 0
  }

  // Daily event breakdown for charts
  const dailyBreakdown: Record<string, Record<string, number>> = {}
  for (const event of events || []) {
    const date = event.created_at.split('T')[0]
    if (!dailyBreakdown[date]) dailyBreakdown[date] = {}
    const key = `${event.variant}_${event.event_type}`
    dailyBreakdown[date][key] = (dailyBreakdown[date][key] || 0) + 1
  }

  return Response.json({
    experiment,
    stats: variantStats,
    daily: Object.entries(dailyBreakdown)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    total_events: (events || []).length,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  try {
    await requireAdmin(request)
  } catch (error) {
    return authErrorResponse(error)
  }

  const { id } = await params
  const body = await request.json()
  const { status, name, description } = body

  const updateData: Record<string, unknown> = {}
  if (status) {
    const validStatuses = ['draft', 'running', 'completed']
    if (!validStatuses.includes(status)) {
      return Response.json({ error: `Invalid status. Must be: ${validStatuses.join(', ')}` }, { status: 400 })
    }
    updateData.status = status
    if (status === 'running') updateData.started_at = new Date().toISOString()
    if (status === 'completed') updateData.ended_at = new Date().toISOString()
  }
  if (name) updateData.name = name
  if (description !== undefined) updateData.description = description

  const { data, error } = await supabaseAdmin
    .from('ab_experiments')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Update experiment error:', error)
    return Response.json({ error: 'Failed to update experiment' }, { status: 500 })
  }

  return Response.json({ experiment: data })
}
