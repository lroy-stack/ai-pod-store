/**
 * Handler for Stripe charge.refunded webhook events
 *
 * Syncs refunds initiated via Stripe Dashboard back to the application.
 * Follows same pattern as dispute-handlers.ts: try/catch without throw,
 * audit log, user notification.
 */

import Stripe from 'stripe'
import { supabase } from './shared'

/**
 * Handle charge.refunded event
 * Updates order status, creates notification and audit log entry
 */
export async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    console.log('Processing charge.refunded:', charge.id)

    const paymentIntentId = charge.payment_intent as string
    if (!paymentIntentId) {
      console.warn('No payment intent ID found in charge:', charge.id)
      return
    }

    // Find the order by payment intent ID
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, total_cents, currency, customer_email, user_id, stripe_refund_id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    if (orderError || !order) {
      console.warn('Refund: order not found for payment intent:', paymentIntentId)
      return
    }

    // Idempotency: skip if already refunded
    if (order.stripe_refund_id || order.status === 'refunded') {
      console.log(`[charge.refunded] Order ${order.id} already refunded, skipping`)
      return
    }

    // Extract refund details from the charge
    const refund = charge.refunds?.data?.[0]
    const refundId = refund?.id || `re_dashboard_${charge.id}`
    const refundAmount = charge.amount_refunded
    const isFullRefund = refundAmount >= (order.total_cents || 0)

    // Update order with refund information
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: isFullRefund ? 'refunded' : order.status,
        refunded_at: new Date().toISOString(),
        refund_amount_cents: refundAmount,
        refund_reason: refund?.reason || 'stripe_dashboard',
        stripe_refund_id: refundId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('Failed to update order on refund:', updateError)
      return
    }

    const statusLabel = isFullRefund ? 'refunded' : `partially refunded (${refundAmount} cents)`
    console.log(`Order ${order.id} ${statusLabel} via Stripe Dashboard (refund ${refundId})`)

    // Create user notification
    if (order.user_id) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: order.user_id,
          type: 'refund_completed',
          title: 'Refund Processed',
          body: `Your refund of €${(refundAmount / 100).toFixed(2)} has been processed.`,
          data: {
            order_id: order.id,
            amount: refundAmount,
            currency: order.currency,
          },
          is_read: false,
        })

      if (notifError) {
        console.error('Failed to create refund notification:', notifError)
      }
    }

    // Audit log
    await supabase
      .from('audit_log')
      .insert({
        actor_type: 'webhook',
        actor_id: 'stripe_webhook',
        action: 'order_refunded',
        resource_type: 'order',
        resource_id: order.id,
        changes: {
          status: isFullRefund ? 'refunded' : order.status,
          refund_amount_cents: refundAmount,
          stripe_refund_id: refundId,
        },
        metadata: {
          payment_intent_id: paymentIntentId,
          charge_id: charge.id,
          is_full_refund: isFullRefund,
          refund_reason: refund?.reason || 'stripe_dashboard',
        },
      })

    console.log(`Successfully processed refund for order ${order.id}`)
  } catch (error) {
    console.error('Error handling charge refunded:', error)
    // Don't throw - we don't want to cause Stripe to retry indefinitely
  }
}
