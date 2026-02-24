import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'

const trackingSchema = z.object({
  tracking_number: z.string().min(5, 'Tracking number must be at least 5 characters'),
  tracking_carrier: z.string().min(2, 'Carrier name required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: returnId } = await params

  // Authenticate the user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const validation = trackingSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error.errors },
      { status: 400 }
    )
  }

  const { tracking_number, tracking_carrier } = validation.data

  // Fetch the return request and verify ownership
  const { data: returnRequest, error: fetchError } = await supabaseAdmin
    .from('return_requests')
    .select('id, user_id, status')
    .eq('id', returnId)
    .single()

  if (fetchError || !returnRequest) {
    return NextResponse.json({ error: 'Return request not found' }, { status: 404 })
  }

  // Only the owner can add tracking
  if (returnRequest.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Can only add tracking when status is 'approved'
  if (returnRequest.status !== 'approved') {
    return NextResponse.json(
      { error: `Cannot add tracking — return status is '${returnRequest.status}', must be 'approved'` },
      { status: 400 }
    )
  }

  // Update the return request with tracking info
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('return_requests')
    .update({
      tracking_number,
      tracking_carrier,
      customer_shipped_at: new Date().toISOString(),
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', returnId)
    .select()
    .single()

  if (updateError) {
    console.error('Tracking update error:', updateError)
    return NextResponse.json(
      { error: 'Failed to update tracking', details: updateError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    return_request: updated,
    message: 'Tracking information submitted. We will notify you when we receive your return.',
  })
}
