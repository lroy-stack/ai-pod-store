/**
 * Handlers for Stripe charge dispute webhook events
 *
 * - charge.dispute.created
 */

import Stripe from 'stripe'
import { BASE_URL } from '@/lib/store-config'
import { supabase } from './shared'

/**
 * Handle charge.dispute.created event
 * Marks order as disputed, alerts admin, and pauses fulfillment
 */
export async function handleChargeDisputeCreated(dispute: Stripe.Dispute) {
  try {
    console.log('Processing charge.dispute.created:', dispute.id)

    // Get the payment intent ID from the dispute
    const paymentIntentId = typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id

    if (!paymentIntentId) {
      console.warn('No payment intent ID found in dispute:', dispute.id)
      return
    }

    // Find the order by payment intent ID
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_email, total_cents, currency, status')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .single()

    if (orderError || !order) {
      console.warn('Dispute: order not found for payment intent:', paymentIntentId)
      return
    }

    // Update order status to 'disputed' to pause fulfillment
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'disputed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (updateError) {
      console.error('Failed to update order status on dispute:', updateError)
      return
    }

    console.log(`Order ${order.id} disputed due to chargeback (dispute ${dispute.id}), fulfillment paused`)

    // Create audit log entry
    await supabase
      .from('audit_log')
      .insert({
        actor_type: 'webhook',
        actor_id: 'stripe_webhook',
        action: 'order_disputed',
        resource_type: 'order',
        resource_id: order.id,
        changes: {
          status: 'disputed',
          dispute_id: dispute.id,
          dispute_reason: dispute.reason,
        },
        metadata: {
          payment_intent_id: paymentIntentId,
          dispute_amount: dispute.amount,
          dispute_currency: dispute.currency,
        },
      })

    // Send admin alert notification
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'chargeback',
        title: 'Chargeback Alert',
        body: `Order ${order.id.slice(0, 8)} has a chargeback (${dispute.reason}). Amount: ${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}. Fulfillment paused.`,
        data: {
          order_id: order.id,
          dispute_id: dispute.id,
          dispute_reason: dispute.reason,
          dispute_amount: dispute.amount,
          payment_intent_id: paymentIntentId,
        },
        is_read: false,
      }))

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (notifError) {
        console.error('Failed to create admin chargeback notifications:', notifError)
      } else {
        console.log(`Created ${notifications.length} admin chargeback alerts for order ${order.id}`)
      }
    }

    // Alert admin via API endpoint (fallback)
    fetch(`${BASE_URL}/api/admin/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'chargeback',
        message: `Chargeback on order ${order.id.slice(0, 8)}: ${dispute.reason}`,
        severity: 'high',
        metadata: {
          order_id: order.id,
          dispute_id: dispute.id,
          amount: dispute.amount,
        },
      }),
    }).catch(() => {})

    console.log(`Successfully processed chargeback for order ${order.id}`)
  } catch (error) {
    console.error('Error handling charge dispute created:', error)
    // Don't throw - we don't want to cause Stripe to retry indefinitely
  }
}
