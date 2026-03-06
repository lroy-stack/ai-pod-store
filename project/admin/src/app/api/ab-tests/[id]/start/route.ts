import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

export const POST = withPermission('analytics', 'update', async (req, session, context) => {
  try {
    const { id } = await context.params

    // Update experiment status to running
    const { data, error } = await supabase
      .from('ab_experiments')
      .update({
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error starting experiment:', error)
    return NextResponse.json(
      { error: 'Failed to start experiment' },
      { status: 500 }
    )
  }
})
