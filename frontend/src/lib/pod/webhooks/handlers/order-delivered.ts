/**
 * order.delivered handler — Marks the order as delivered, sends a delivery
 * confirmation email with review prompt, and creates an in-app notification.
 *
 * Logic extracted from webhooks/printify/route.ts handleOrderDelivered().
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendOrderDeliveredEmail } from '@/lib/resend'
import { findOrder, isEmailEnabled } from './utils'

export async function handleOrderDelivered(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
): Promise<void> {
  const order = await findOrder(event, supabase)

  if (!order) {
    console.error(`[webhook:order.delivered] Order not found (provider: ${event.provider}, resourceId: ${event.resourceId})`)
    throw new Error('Order not found')
  }

  // Update order status
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .eq('id', order.id)

  if (error) {
    console.error('[webhook:order.delivered] Failed to update order:', error)
    throw error
  }

  console.log(`[webhook:order.delivered] Order ${order.id} marked as delivered (provider: ${event.provider})`)

  const orderDisplayId = order.id.slice(0, 8)

  // Create in-app notification
  if (order.user_id) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: order.user_id,
      type: 'order_delivered',
      title: `Order #${orderDisplayId} Delivered`,
      body: 'Your order has been delivered! We hope you love your new items.',
      data: {
        order_id: order.id,
      },
      is_read: false,
    })

    if (notificationError) {
      console.error('[webhook:order.delivered] Failed to create notification:', notificationError)
    } else {
      console.log(`[webhook:order.delivered] Created notification for user ${order.user_id}`)
    }
  }

  // Send email notification
  if (order.customer_email && order.user_id) {
    const emailEnabled = await isEmailEnabled(order.user_id, supabase)

    if (emailEnabled) {
      const emailResult = await sendOrderDeliveredEmail({
        to: order.customer_email,
        orderId: order.id,
        orderNumber: orderDisplayId,
        locale: order.locale || 'en',
      })

      if (emailResult.success) {
        console.log(`[webhook:order.delivered] Email sent for order ${order.id}`)
      } else {
        console.error('[webhook:order.delivered] Failed to send email:', emailResult.error)
      }
    } else {
      console.log(`[webhook:order.delivered] Email skipped (user preference disabled)`)
    }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: `${event.provider}_webhook`,
    action: 'order_delivered',
    resource_type: 'order',
    resource_id: order.id,
    changes: { status: 'delivered' },
    metadata: {
      provider: event.provider,
      provider_order_id: event.resourceId,
    },
  })
}
