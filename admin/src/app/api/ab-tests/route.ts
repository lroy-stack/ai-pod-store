import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export const GET = withAuth(async (req, session) => {
  try {
    // Fetch all experiments
    const { data: experiments, error } = await supabase
      .from('ab_experiments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // For each experiment, fetch stats from ab_events
    const experimentsWithStats = await Promise.all(
      (experiments || []).map(async (exp) => {
        if (exp.status === 'draft') {
          return exp
        }

        const { data: events } = await supabase
          .from('ab_events')
          .select('variant, event_type, value')
          .eq('experiment_id', exp.id)

        const stats = {
          control: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0
          },
          test: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0
          }
        }

        if (events) {
          events.forEach((event) => {
            const variant = event.variant === 'control' ? 'control' : 'test'

            if (event.event_type === 'impression') {
              stats[variant].impressions++
            } else if (event.event_type === 'click') {
              stats[variant].clicks++
            } else if (event.event_type === 'conversion') {
              stats[variant].conversions++
            } else if (event.event_type === 'revenue') {
              stats[variant].revenue += Number(event.value || 0)
            }
          })
        }

        return {
          ...exp,
          stats
        }
      })
    )

    return NextResponse.json(experimentsWithStats)
  } catch (error) {
    console.error('Error fetching experiments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch experiments' },
      { status: 500 }
    )
  }
})

export const POST = withPermission('analytics', 'update', async (req, session) => {
  try {
    const body = await req.json()
    const { name, description, variants } = body

    if (!name || !variants) {
      return NextResponse.json(
        { error: 'Name and variants are required' },
        { status: 400 }
      )
    }

    // Validate variants structure
    if (!variants.control || !variants.test) {
      return NextResponse.json(
        { error: 'Both control and test variants are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('ab_experiments')
      .insert({
        name,
        description: description || null,
        variants,
        status: 'draft'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating experiment:', error)
    return NextResponse.json(
      { error: 'Failed to create experiment' },
      { status: 500 }
    )
  }
})
