import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withAuth } from '@/lib/auth-middleware'

export const POST = withAuth(async (
  request: NextRequest,
  context: { params?: Promise<{ id: string }>, session?: any }
) => {
  const { id } = await context.params\!
  const session = context.session

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (\!supabaseUrl || \!supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const body = await request.json()
    const { admin_notes } = body

    if (\!admin_notes) {
      return NextResponse.json(
        { error: 'Admin notes are required for rejection' },
        { status: 400 }
      )
    }

    // Fetch the return request
    const { data: returnRequest, error: fetchError } = await supabase
      .from('return_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || \!returnRequest) {
      return NextResponse.json(
        { error: 'Return request not found' },
        { status: 404 }
      )
    }

    if (returnRequest.status \!== 'pending') {
      return NextResponse.json(
        { error: 'Return request is not pending' },
        { status: 400 }
      )
    }

    // Update the return request
    const { data: updated, error: updateError } = await supabase
      .from('return_requests')
      .update({
        status: 'rejected',
        admin_notes,
        approved_by: session?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update return request', details: updateError.message },
        { status: 500 }
      )
    }

    // Create audit log entry
    await supabase
      .from('audit_log')
      .insert({
        actor_type: 'admin',
        actor_id: session?.id,
        action: 'return_rejected',
        resource_type: 'return_request',
        resource_id: id,
        changes: { after: { status: 'rejected' } },
        metadata: {
          order_id: returnRequest.order_id,
          rejection_reason: admin_notes,
        }
      })

    // Create notification for the customer
    if (returnRequest.user_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: returnRequest.user_id,
          type: 'return_rejected',
          title: 'Return Request Rejected',
          message: `Your return request has been rejected. Reason: ${admin_notes}`,
          data: {
            return_request_id: id,
            order_id: returnRequest.order_id,
          }
        })
    }

    return NextResponse.json({ returnRequest: updated })
  } catch (error) {
    console.error('Error rejecting return:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
