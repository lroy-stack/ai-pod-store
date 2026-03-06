/**
 * order.failed handler — Similar to order.cancelled but for production failures.
 * Issues a Stripe refund, transitions to 'refunded' or 'failed', notifies user.
 *
 * Logic extracted from webhooks/printify/route.ts handleOrderFailed().
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendOrderFailedEmail } from '@/lib/resend'
import { issueRefund } from '@/lib/reliability/refund-guard'
import { transition } from '@/lib/reliability/state-transition'
import { findOrder, isEmailEnabled } from './utils'

export async function handleOrderFailed(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
): Promise<void> {
  const order = await findOrder(event, supabase)

  if (!order) {
    console.error(`[webhook:order.failed] Order not found (provider: ${event.provider}, resourceId: ${event.resourceId})`)
    throw new Error('Order not found')
  }

  const orderDisplayId = order.id.slice(0, 8)
  let refundIssued = false

  // If the order has been paid, issue a refund
  if (order.stripe_payment_intent_id && order.total_cents > 0) {
    console.log(`[webhook:order.failed] Issuing refund for order ${order.id}`)

    const refundResult = await issueRefund(
      order.id,
      order.stripe_payment_intent_id,
      order.total_cents,
      `${event.provider} order failed`,
    )

    if (refundResult.success) {
      console.log(`[webhook:order.failed] Refund issued: ${refundResult.stripeRefundId}`)
      refundIssued = true
    } else if (refundResult.alreadyRefunded) {
      console.log(`[webhook:order.failed] Order was already refunded`)
      refundIssued = true
    } else {
      console.error(`[webhook:order.failed] Refund failed: ${refundResult.error}`)
    }
  } else {
    console.log(`[webhook:order.failed] No payment to refund for order ${order.id}`)
  }

  // Update order status
  const finalStatus = refundIssued ? 'refunded' : 'failed'
  const transitionResult = await transition('orders', order.id, order.status, finalStatus)

  if (!transitionResult.success) {
    console.error(`[webhook:order.failed] State transition failed: ${transitionResult.error}`)
  } else {
    console.log(`[webhook:order.failed] Order ${order.id}: ${order.status} -> ${finalStatus}`)
  }

  // Create in-app notification
  if (order.user_id) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: order.user_id,
      type: 'order_failed',
      title: `Order #${orderDisplayId} Failed`,
      body: refundIssued
        ? 'There was an issue with your order. A full refund has been issued.'
        : 'There was an issue with your order. Please contact support.',
      data: {
        order_id: order.id,
        refunded: refundIssued,
      },
      is_read: false,
    })

    if (notificationError) {
      console.error('[webhook:order.failed] Failed to create notification:', notificationError)
    } else {
      console.log(`[webhook:order.failed] Created notification for user ${order.user_id}`)
    }
  }

  // Send email notification
  if (order.customer_email) {
    let emailEnabled = true
    if (order.user_id) {
      emailEnabled = await isEmailEnabled(order.user_id, supabase)
    }

    if (emailEnabled) {
      const emailResult = await sendOrderFailedEmail({
        to: order.customer_email,
        orderId: order.id,
        orderNumber: orderDisplayId,
        locale: order.locale || 'en',
      })

      if (emailResult.success) {
        console.log(`[webhook:order.failed] Email sent for order ${order.id}`)
      } else {
        console.error('[webhook:order.failed] Failed to send email:', emailResult.error)
      }
    } else {
      console.log(`[webhook:order.failed] Email skipped (user preference disabled)`)
    }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: `${event.provider}_webhook`,
    action: 'order_failed',
    resource_type: 'order',
    resource_id: order.id,
    changes: { status: finalStatus, refunded: refundIssued },
    metadata: {
      provider: event.provider,
      provider_order_id: event.resourceId,
      refund_issued: refundIssued,
    },
  })

  console.log(`[webhook:order.failed] Processing complete: ${event.resourceId} (status: ${finalStatus})`)
}
