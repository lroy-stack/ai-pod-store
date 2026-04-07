import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { z } from 'zod'

const trackingSchema = z.object({
  tracking_number: z.string().min(5, 'Tracking number must be at least 5 characters'),
  tracking_carrier: z.string().min(2, 'Carrier name required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: returnId } = await params
    const user = await requireAuth(request)

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

    if (returnRequest.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
        { error: 'Failed to update tracking' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      return_request: updated,
      message: 'Tracking information submitted. We will notify you when we receive your return.',
    })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Return tracking error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
