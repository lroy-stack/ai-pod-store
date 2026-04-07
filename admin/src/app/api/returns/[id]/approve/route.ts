import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withPermission } from '@/lib/rbac'
import Stripe from 'stripe'

export const POST = withPermission('orders', 'refund', async (
  request: NextRequest,
  session,
  context: { params?: Promise<{ id: string }>, session?: any }
) => {
  const { id } = await context.params!

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    )
  }

  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: 'Stripe configuration missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-01-28.clover' })

  try {
    const body = await request.json()
    const { admin_notes } = body

    // Fetch the return request
    const { data: returnRequest, error: fetchError } = await supabase
      .from('return_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !returnRequest) {
      return NextResponse.json(
        { error: 'Return request not found' },
        { status: 404 }
      )
    }

    if (returnRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Return request is not pending' },
        { status: 400 }
      )
    }

    // Fetch the associated order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', returnRequest.order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    if (!order.stripe_payment_intent_id) {
      return NextResponse.json(
        { error: 'No payment intent found for this order' },
        { status: 400 }
      )
    }

    // Create a Stripe refund
    let stripeRefund
    try {
      stripeRefund = await stripe.refunds.create(
        {
          payment_intent: order.stripe_payment_intent_id,
          amount: order.total_cents,
          reason: 'requested_by_customer',
          metadata: {
            return_request_id: returnRequest.id,
            order_id: order.id,
          },
        },
        {
          idempotencyKey: `return-refund-${returnRequest.id}`,
        }
      )
    } catch (stripeError: any) {
      console.error('Stripe refund error:', stripeError)
      return NextResponse.json(
        { error: 'Failed to process refund' },
        { status: 500 }
      )
    }

    // Update the return request
    const { data: updated, error: updateError } = await supabase
      .from('return_requests')
      .update({
        status: 'approved',
        refund_amount_cents: order.total_cents,
        refund_currency: order.currency,
        stripe_refund_id: stripeRefund.id,
        admin_notes: admin_notes || null,
        approved_by: session?.userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update return request' },
        { status: 500 }
      )
    }

    // Update order status to refunded
    await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', returnRequest.order_id)

    // Create audit log entry
    await supabase
      .from('audit_log')
      .insert({
        actor_type: 'admin',
        actor_id: session?.userId,
        action: 'return_approved',
        resource_type: 'return_request',
        resource_id: id,
        changes: { after: { status: 'approved', refund_amount_cents: order.total_cents } },
        metadata: {
          order_id: returnRequest.order_id,
          stripe_refund_id: stripeRefund.id,
        }
      })

    // Create notification for the customer
    if (returnRequest.user_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: returnRequest.user_id,
          type: 'return_approved',
          title: 'Return Approved',
          message: `Your return request has been approved. A refund of ${(order.total_cents / 100).toFixed(2)} ${order.currency.toUpperCase()} has been processed.`,
          data: {
            return_request_id: id,
            order_id: returnRequest.order_id,
            refund_amount: order.total_cents,
          }
        })
    }

    return NextResponse.json({ returnRequest: updated })
  } catch (error) {
    console.error('Error approving return:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
