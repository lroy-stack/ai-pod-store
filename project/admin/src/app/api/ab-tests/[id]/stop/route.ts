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

    // Update experiment status to completed
    const { data, error } = await supabase
      .from('ab_experiments')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error stopping experiment:', error)
    return NextResponse.json(
      { error: 'Failed to stop experiment' },
      { status: 500 }
    )
  }
})
