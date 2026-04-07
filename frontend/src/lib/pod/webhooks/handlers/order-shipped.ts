/**
 * order.shipped handler — Parses shipment data from the normalized event,
 * updates the order record with tracking info, sends email notification,
 * and creates an in-app notification.
 *
 * Logic extracted from webhooks/printify/route.ts handleOrderShipped().
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendOrderShippedEmail } from '@/lib/resend'
import { findOrder, isEmailEnabled } from './utils'

interface ShipmentData {
  carrier: string
  number: string
  url: string
}

/**
 * Extract shipments array from normalized event data.
 * Printify: data.shipments[]
 * Printful: data.shipment (single) or data.order.shipments[]
 */
function extractShipments(data: Record<string, unknown>): ShipmentData[] {
  // Direct shipments array (Printify format)
  if (Array.isArray(data.shipments)) {
    return data.shipments as ShipmentData[]
  }

  // Printful format: single shipment object
  if (data.shipment && typeof data.shipment === 'object') {
    const s = data.shipment as Record<string, unknown>
    return [{
      carrier: String(s.carrier || s.service || ''),
      number: String(s.tracking_number || s.number || ''),
      url: String(s.tracking_url || s.url || ''),
    }]
  }

  // Printful nested format: data.order.shipments[]
  const orderObj = data.order as Record<string, unknown> | undefined
  if (orderObj && Array.isArray(orderObj.shipments)) {
    return (orderObj.shipments as Array<Record<string, unknown>>).map(s => ({
      carrier: String(s.carrier || s.service || ''),
      number: String(s.tracking_number || s.number || ''),
      url: String(s.tracking_url || s.url || ''),
    }))
  }

  return []
}

export async function handleOrderShipped(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
): Promise<void> {
  const order = await findOrder(event, supabase)

  if (!order) {
    console.error(`[webhook:order.shipped] Order not found (provider: ${event.provider}, resourceId: ${event.resourceId})`)
    throw new Error('Order not found')
  }

  const shipments = extractShipments(event.data)

  // Build update payload
  const updateData: Record<string, unknown> = {
    status: 'shipped',
    shipped_at: new Date().toISOString(),
  }

  if (shipments.length === 1) {
    updateData.tracking_number = shipments[0].number
    updateData.tracking_url = shipments[0].url
    updateData.carrier = shipments[0].carrier
  } else if (shipments.length > 1) {
    // Multiple shipments: concatenate tracking numbers, dedupe carriers
    updateData.tracking_number = shipments.map(s => s.number).join(', ')
    updateData.tracking_url = shipments[0].url
    updateData.carrier = shipments
      .map(s => s.carrier)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ')
  }

  const primaryShipment = shipments[0] || null

  // Update order status
  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', order.id)

  if (error) {
    console.error('[webhook:order.shipped] Failed to update order:', error)
    throw error
  }

  console.log(`[webhook:order.shipped] Order ${order.id} marked as shipped (provider: ${event.provider})`)

  const orderDisplayId = order.id.slice(0, 8)

  // Create in-app notification
  if (order.user_id) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: order.user_id,
      type: 'order_shipped',
      title: `Order #${orderDisplayId} Shipped`,
      body: primaryShipment
        ? `Your order has been shipped via ${primaryShipment.carrier}. Tracking: ${primaryShipment.number}`
        : 'Your order has been shipped and is on its way!',
      data: {
        order_id: order.id,
        tracking_number: primaryShipment?.number,
        tracking_url: primaryShipment?.url,
        carrier: primaryShipment?.carrier,
      },
      is_read: false,
    })

    if (notificationError) {
      console.error('[webhook:order.shipped] Failed to create notification:', notificationError)
    } else {
      console.log(`[webhook:order.shipped] Created notification for user ${order.user_id}`)
    }
  }

  // Send email notification (respecting user preferences)
  if (order.customer_email && order.user_id) {
    const emailEnabled = await isEmailEnabled(order.user_id, supabase)

    if (emailEnabled) {
      const emailResult = await sendOrderShippedEmail({
        to: order.customer_email,
        orderId: orderDisplayId,
        trackingNumber: primaryShipment?.number,
        trackingUrl: primaryShipment?.url,
        carrier: primaryShipment?.carrier,
        locale: order.locale || 'en',
      })

      if (emailResult.success) {
        console.log(`[webhook:order.shipped] Email sent for order ${order.id}`)
      } else {
        console.error('[webhook:order.shipped] Failed to send email:', emailResult.error)
      }
    } else {
      console.log(`[webhook:order.shipped] Email skipped (user preference disabled)`)
    }
  }

  // Audit log
  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: `${event.provider}_webhook`,
    action: 'order_shipped',
    resource_type: 'order',
    resource_id: order.id,
    changes: updateData,
    metadata: {
      provider: event.provider,
      provider_order_id: event.resourceId,
    },
  })
}
