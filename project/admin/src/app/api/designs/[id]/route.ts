import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'
import { withValidation } from '@/lib/validation'
import { designUpdateSchema } from '@/lib/schemas/extended'

export const GET = withAuth(async (
  request: NextRequest,
  context: { params?: Promise<{ id: string }> }
) => {
  const { id } = await context.params!

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { data, error } = await supabase
      .from('designs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Design not found', details: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json({ design: data })
  } catch (error) {
    console.error('Error fetching design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

export const PATCH = withPermission('designs', 'update', withValidation(designUpdateSchema, async (
  request: NextRequest,
  validatedData,
  session,
  context: { params?: Promise<{ id: string }> }
) => {
  const { id } = await context.params!

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { data, error } = await supabase
      .from('designs')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to update design', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ design: data })
  } catch (error) {
    console.error('Error updating design:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}))
