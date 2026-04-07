import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withPermission } from '@/lib/rbac'
import Stripe from 'stripe'

/**
 * POST /api/returns/[id]/receive
 *
 * Marks a return as item_received -> return_completed.
 * Auto-issues Stripe refund if one has not been processed yet.
 * This is the canonical "item received" step in the return lifecycle:
 *   pending -> approved -> processing (customer ships) -> item_received -> return_completed
 */
export const POST = withPermission('orders', 'update', async (
  request: NextRequest,
  session,
  context: { params?: Promise<{ id: string }>, session?: any }
) => {
  const { id } = await context.params!

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Fetch the return request
    const { data: returnRequest, error: fetchError } = await supabase
      .from('return_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !returnRequest) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 })
    }

    // Can only receive items that are approved or processing (customer shipped)
    const allowedStatuses = ['approved', 'processing']
    if (!allowedStatuses.includes(returnRequest.status)) {
      return NextResponse.json(
        { error: `Cannot mark as received — current status is '${returnRequest.status}'` },
        { status: 400 }
      )
    }

    // Fetch the associated order for Stripe refund
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, stripe_payment_intent_id, total_cents, currency, status')
      .eq('id', returnRequest.order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    let stripeRefundId = returnRequest.stripe_refund_id
    let refundAmountCents = returnRequest.refund_amount_cents || order.total_cents

    // Issue Stripe refund if not already done
    if (!stripeRefundId && stripeSecretKey && order.stripe_payment_intent_id) {
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-01-28.clover' })
      try {
        const stripeRefund = await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
          amount: refundAmountCents,
          reason: 'requested_by_customer',
          metadata: {
            return_request_id: returnRequest.id,
            order_id: order.id,
            trigger: 'item_received',
          },
        })
        stripeRefundId = stripeRefund.id
      } catch (stripeError: unknown) {
        const msg = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error'
        console.error('Stripe refund error during receive:', stripeError)
        return NextResponse.json(
          { error: 'Failed to process refund' },
          { status: 500 }
        )
      }
    }

    // Transition: item_received -> return_completed (auto)
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('return_requests')
      .update({
        status: 'completed',
        item_received_at: now,
        completed_at: now,
        stripe_refund_id: stripeRefundId,
        refund_amount_cents: refundAmountCents,
        refund_currency: returnRequest.refund_currency || order.currency,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError);
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

    // Audit log
    await supabase.from('audit_log').insert({
      actor_type: 'admin',
      actor_id: session?.userId,
      action: 'return_item_received',
      resource_type: 'return_request',
      resource_id: id,
      changes: {
        before: { status: returnRequest.status },
        after: { status: 'completed', stripe_refund_id: stripeRefundId },
      },
      metadata: { order_id: returnRequest.order_id },
    })

    // Notify customer
    if (returnRequest.user_id) {
      await supabase.from('notifications').insert({
        user_id: returnRequest.user_id,
        type: 'return_completed',
        title: 'Return Completed',
        message: `Your returned item has been received and a refund of ${((refundAmountCents || 0) / 100).toFixed(2)} ${(returnRequest.refund_currency || order.currency).toUpperCase()} has been processed.`,
        data: {
          return_request_id: id,
          order_id: returnRequest.order_id,
          refund_amount: refundAmountCents,
        },
      })
    }

    return NextResponse.json({
      success: true,
      return_request: updated,
      refund_issued: !!stripeRefundId,
    })
  } catch (error) {
    console.error('Error marking return as received:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
