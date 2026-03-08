/**
 * order.cancelled handler — Issues a Stripe refund if the order was paid,
 * performs a validated state transition, sends email and creates notification.
 *
 * Logic extracted from webhooks/printify/route.ts handleOrderCancelled().
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendOrderCancelledEmail } from '@/lib/resend'
import { issueRefund } from '@/lib/reliability/refund-guard'
import { transition } from '@/lib/reliability/state-transition'
import { findOrder, isEmailEnabled } from './utils'

export async function handleOrderCancelled(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
): Promise<void> {
  const order = await findOrder(event, supabase)

  if (!order) {
    console.error(`[webhook:order.cancelled] Order not found (provider: ${event.provider}, resourceId: ${event.resourceId})`)
    throw new Error('Order not found')
  }

  // Package returned to sender = delivery failure, NOT merchant cancellation
  // Don't auto-refund — set requires_review for human intervention
  const rawType = (event as any)._raw?.type
  if (rawType === 'package_returned') {
    console.log(`[webhook:order.cancelled] Package returned for order ${order.id} — setting requires_review`)

    await supabase.from('orders').update({
      status: 'requires_review',
      pod_error: 'Package returned to sender — delivery failure',
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)

    if (order.user_id) {
      await supabase.from('notifications').insert({
        user_id: order.user_id,
        type: 'order_delivery_failed',
        title: `Order #${order.id.slice(0, 8)} — Delivery Failed`,
        body: 'Your package was returned to the sender. Our team will contact you about re-shipping.',
        data: { order_id: order.id },
        is_read: false,
      })
    }

    await supabase.from('audit_log').insert({
      actor_type: 'webhook',
      actor_id: `${event.provider}_webhook`,
      action: 'package_returned',
      resource_type: 'order',
      resource_id: order.id,
      changes: { status: 'requires_review' },
      metadata: { provider: event.provider, raw_type: 'package_returned' },
    })

    return
  }

  const orderDisplayId = order.id.slice(0, 8)
  let finalStatus = 'cancelled'
  let refundIssued = false

  // If the order has been paid, issue a refund
  if (order.stripe_payment_intent_id && order.total_cents > 0) {
    console.log(`[webhook:order.cancelled] Issuing refund for order ${order.id}`)

    const refundResult = await issueRefund(
      order.id,
      order.stripe_payment_intent_id,
      order.total_cents,
      `${event.provider} cancelled order`,
    )

    if (refundResult.success) {
      console.log(`[webhook:order.cancelled] Refund issued: ${refundResult.stripeRefundId}`)
      finalStatus = 'refunded'
      refundIssued = true
    } else if (refundResult.alreadyRefunded) {
      console.log(`[webhook:order.cancelled] Order was already refunded`)
      finalStatus = 'refunded'
      refundIssued = true
    } else {
      console.error(`[webhook:order.cancelled] Refund failed: ${refundResult.error}`)
      // Continue with cancellation even if refund fails - manual intervention needed
    }
  } else {
    console.log(`[webhook:order.cancelled] No payment to refund for order ${order.id}`)
  }

  // Perform state transition with validation
  const transitionResult = await transition('orders', order.id, order.status, finalStatus)

  if (!transitionResult.success) {
    console.error(`[webhook:order.cancelled] State transition failed: ${transitionResult.error}`)
  } else {
    console.log(`[webhook:order.cancelled] Order ${order.id}: ${order.status} -> ${finalStatus}`)
  }

  // Create in-app notification
  if (order.user_id) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: order.user_id,
      type: 'order_cancelled',
      title: `Order #${orderDisplayId} Cancelled`,
      body: refundIssued
        ? 'Your order has been cancelled and a full refund has been issued.'
        : 'Your order has been cancelled. Please contact support if you were charged.',
      data: {
        order_id: order.id,
        refunded: refundIssued,
      },
      is_read: false,
    })

    if (notificationError) {
      console.error('[webhook:order.cancelled] Failed to create notification:', notificationError)
    } else {
      console.log(`[webhook:order.cancelled] Created notification for user ${order.user_id}`)
    }
  }

  // Send email notification if refund was issued
  if (refundIssued && order.customer_email) {
    let emailEnabled = true
    if (order.user_id) {
      emailEnabled = await isEmailEnabled(order.user_id, supabase)
    }

    if (emailEnabled) {
      const emailResult = await sendOrderCancelledEmail({
        to: order.customer_email,
        orderId: orderDisplayId,
        refundAmount: order.total_cents,
        currency: order.currency,
        reason: `${event.provider} cancelled order`,
        locale: order.locale || 'en',
      })

      if (emailResult.success) {
        console.log(`[webhook:order.cancelled] Email sent for order ${order.id}`)
      } else {
        console.error('[webhook:order.cancelled] Failed to send email:', emailResult.error)
      }
    } else {
      console.log(`[webhook:order.cancelled] Email skipped (user preference disabled)`)
    }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: `${event.provider}_webhook`,
    action: 'order_cancelled',
    resource_type: 'order',
    resource_id: order.id,
    changes: { status: finalStatus, refunded: refundIssued },
    metadata: {
      provider: event.provider,
      provider_order_id: event.resourceId,
      refund_issued: refundIssued,
    },
  })

  console.log(`[webhook:order.cancelled] Processing complete: ${event.resourceId} (status: ${finalStatus})`)
}
