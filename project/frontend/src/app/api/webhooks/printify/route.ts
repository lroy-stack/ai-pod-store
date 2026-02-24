/**
 * Printify Webhook Handler
 *
 * POST /api/webhooks/printify
 * Handles Printify webhook events (order:shipped, order:delivered, etc.)
 *
 * Architecture note: PodClaw agents do NOT receive these webhooks directly.
 * This handler writes all state changes to Supabase (orders, products,
 * notifications, audit_log), and PodClaw agents read from Supabase during
 * their scheduled runs / heartbeat cycles. This avoids coupling between
 * the frontend and PodClaw deployments.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { sendOrderShippedEmail, sendOrderCancelledEmail } from '@/lib/resend'
import { printify } from '@/lib/printify'
import { syncProductFromPrintify, deleteProductCascade } from '@/lib/printify-sync'
import { issueRefund } from '@/lib/reliability/refund-guard'
import { transition } from '@/lib/reliability/state-transition'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * Verifies Printify webhook HMAC signature using constant-time comparison.
 * Uses timingSafeEqual() to prevent timing attacks.
 */
function verifyPrintifyWebhook(body: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret)
  hmac.update(body)
  const expected = hmac.digest('base64')

  // Check length first (fast fail for obviously wrong signatures)
  if (signature.length !== expected.length) {
    return false
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    // timingSafeEqual throws if buffer lengths don't match
    return false
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('X-Printify-Hmac-SHA256')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing X-Printify-Hmac-SHA256 header' },
      { status: 401 }
    )
  }

  const webhookSecret = process.env.PRINTIFY_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('PRINTIFY_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  if (!verifyPrintifyWebhook(body, signature, webhookSecret)) {
    console.error('Printify webhook signature verification failed')
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  let event: { type: string; resource: Record<string, unknown> }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { type, resource } = event

  try {
    switch (type) {
      case 'order:created':
        await handleOrderCreated(resource)
        break
      case 'order:shipped':
        await handleOrderShipped(resource)
        break
      case 'order:delivered':
        await handleOrderDelivered(resource)
        break
      case 'order:cancelled':
        await handleOrderCancelled(resource)
        break
      case 'product:publish:started': {
        const publishProductId = resource?.id as string
        if (publishProductId) {
          // Find the Supabase product to get external ID for publishing confirmation
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .eq('printify_id', publishProductId)
            .single()

          if (existingProduct) {
            try {
              await printify.publishingSucceeded(
                publishProductId,
                existingProduct.id,
                `/shop/${existingProduct.id}`
              )
              console.log('Publishing confirmed for:', publishProductId)
            } catch (e) {
              console.error('Failed to confirm publishing:', publishProductId, e)
            }
          } else {
            console.log(
              'Product not in Supabase yet, will be confirmed by create-product pipeline:',
              publishProductId
            )
          }
        }
        break
      }
      case 'product:publish:succeeded':
      case 'product:created':
      case 'product:updated': {
        const productId = resource?.id as string
        if (productId) {
          const fullProduct = await printify.getProduct(productId)
          await syncProductFromPrintify(fullProduct, supabase)
          console.log(`Product synced (${type}):`, productId)
        }
        break
      }
      case 'product:deleted': {
        const deletedProductId = resource?.id as string
        if (deletedProductId) {
          await deleteProductCascade(deletedProductId, supabase)
          console.log('Product deleted from Supabase:', deletedProductId)
        }
        break
      }
      default:
        console.log(`Unhandled Printify event: ${type}`)
    }
  } catch (error) {
    console.error(`Error handling Printify event ${type}:`, error)
    // Return 200 to prevent Printify from retrying — we log the error
    return NextResponse.json({ received: true, error: 'Processing error' })
  }

  return NextResponse.json({ received: true })
}

async function handleOrderCreated(resource: Record<string, unknown>) {
  const printifyOrderId = resource.id as string
  console.log('Printify order:created event received:', printifyOrderId)

  // Verify our order record matches
  const { data: order } = await supabase
    .from('orders')
    .select('id, printify_order_id')
    .eq('printify_order_id', printifyOrderId)
    .single()

  if (order) {
    console.log('Printify order:created confirmed for order:', order.id)
  } else {
    console.warn('Received order:created for unknown Printify order:', printifyOrderId)
  }
}

async function handleOrderShipped(resource: Record<string, unknown>) {
  const printifyOrderId = resource.id as string
  const shipments = resource.shipments as Array<{
    carrier: string
    number: string
    url: string
  }> | undefined

  const shipment = shipments?.[0]

  const updateData: Record<string, unknown> = {
    status: 'shipped',
    shipped_at: new Date().toISOString(),
  }

  if (shipment) {
    updateData.tracking_number = shipment.number
    updateData.tracking_url = shipment.url
    updateData.carrier = shipment.carrier
  }

  // Get the order to find the user_id and email
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, user_id, customer_email, locale')
    .eq('printify_order_id', printifyOrderId)
    .single()

  if (fetchError || !order) {
    console.error('Failed to fetch order for shipped event:', fetchError)
    throw fetchError || new Error('Order not found')
  }

  // Update order status
  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('printify_order_id', printifyOrderId)

  if (error) {
    console.error('Failed to update order for shipped event:', error)
    throw error
  }

  console.log('Order marked as shipped:', printifyOrderId)

  const orderDisplayId = order.id.slice(0, 8) // Use first 8 chars of UUID as display ID

  // Create notification for user
  if (order.user_id) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: order.user_id,
      type: 'order_shipped',
      title: `Order #${orderDisplayId} Shipped`,
      body: shipment
        ? `Your order has been shipped via ${shipment.carrier}. Tracking: ${shipment.number}`
        : 'Your order has been shipped and is on its way!',
      data: {
        order_id: order.id,
        tracking_number: shipment?.number,
        tracking_url: shipment?.url,
        carrier: shipment?.carrier,
      },
      is_read: false,
    })

    if (notificationError) {
      console.error('Failed to create notification:', notificationError)
      // Don't throw — notification is not critical
    } else {
      console.log('Created order_shipped notification for user:', order.user_id)
    }
  }

  // Send email notification (check user preferences first)
  if (order.customer_email && order.user_id) {
    // Fetch user's notification preferences
    const { data: userData } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', order.user_id)
      .single()

    const preferences = userData?.notification_preferences || { email: true }
    const emailEnabled = preferences.email !== false

    if (emailEnabled) {
      const emailResult = await sendOrderShippedEmail({
        to: order.customer_email,
        orderId: orderDisplayId,
        trackingNumber: shipment?.number,
        trackingUrl: shipment?.url,
        carrier: shipment?.carrier,
        locale: order.locale || 'en',
      })

      if (emailResult.success) {
        console.log('Order shipped email sent to:', order.customer_email)
      } else {
        console.error('Failed to send order shipped email:', emailResult.error)
        // Don't throw — email is not critical
      }
    } else {
      console.log('Email notification skipped (user preference disabled):', order.customer_email)
    }
  }

  // Create audit log entry
  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: 'printify_webhook',
    action: 'order_shipped',
    resource_type: 'order',
    resource_id: order.id, // Use order UUID, not printify_order_id string
    changes: updateData,
    metadata: {
      printify_order_id: printifyOrderId,
    },
  })
}

async function handleOrderDelivered(resource: Record<string, unknown>) {
  const printifyOrderId = resource.id as string

  // Get the order to find the UUID
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id')
    .eq('printify_order_id', printifyOrderId)
    .single()

  if (fetchError || !order) {
    console.error('Failed to fetch order for delivered event:', fetchError)
    throw fetchError || new Error('Order not found')
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .eq('printify_order_id', printifyOrderId)

  if (error) {
    console.error('Failed to update order for delivered event:', error)
    throw error
  }

  console.log('Order marked as delivered:', printifyOrderId)

  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: 'printify_webhook',
    action: 'order_delivered',
    resource_type: 'order',
    resource_id: order.id, // Use order UUID, not printify_order_id string
    changes: { status: 'delivered' },
    metadata: {
      printify_order_id: printifyOrderId,
    },
  })
}

async function handleOrderCancelled(resource: Record<string, unknown>) {
  const printifyOrderId = resource.id as string

  // Get the full order with all required fields for refund processing
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, user_id, customer_email, status, stripe_payment_intent_id, total_cents, currency, locale')
    .eq('printify_order_id', printifyOrderId)
    .single()

  if (fetchError || !order) {
    console.error('Failed to fetch order for cancelled event:', fetchError)
    throw fetchError || new Error('Order not found')
  }

  const orderDisplayId = order.id.slice(0, 8) // Use first 8 chars of UUID as display ID
  let finalStatus = 'cancelled'
  let refundIssued = false

  // If the order has been paid, issue a refund
  if (order.stripe_payment_intent_id && order.total_cents > 0) {
    console.log(`[Printify Cancelled] Issuing refund for order ${order.id}`)

    const refundResult = await issueRefund(
      order.id,
      order.stripe_payment_intent_id,
      order.total_cents,
      'Printify cancelled order'
    )

    if (refundResult.success) {
      console.log(`[Printify Cancelled] Refund issued successfully: ${refundResult.stripeRefundId}`)
      finalStatus = 'refunded'
      refundIssued = true
    } else if (refundResult.alreadyRefunded) {
      console.log(`[Printify Cancelled] Order was already refunded`)
      finalStatus = 'refunded'
      refundIssued = true
    } else {
      console.error(`[Printify Cancelled] Refund failed: ${refundResult.error}`)
      // Continue with cancellation even if refund fails - manual intervention needed
    }
  } else {
    console.log(`[Printify Cancelled] No payment to refund for order ${order.id}`)
  }

  // Perform state transition with validation
  const transitionResult = await transition('orders', order.id, order.status, finalStatus)

  if (!transitionResult.success) {
    console.error(`[Printify Cancelled] State transition failed: ${transitionResult.error}`)
    // Log but don't throw - we still want to notify the customer
  } else {
    console.log(`[Printify Cancelled] Order ${order.id}: ${order.status} → ${finalStatus}`)
  }

  // Create notification for user
  if (order.user_id) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: order.user_id,
      type: 'order_cancelled',
      title: `Order #${orderDisplayId} Cancelled`,
      body: refundIssued
        ? `Your order has been cancelled and a full refund has been issued.`
        : `Your order has been cancelled. Please contact support if you were charged.`,
      data: {
        order_id: order.id,
        refunded: refundIssued,
      },
      is_read: false,
    })

    if (notificationError) {
      console.error('Failed to create cancellation notification:', notificationError)
      // Don't throw — notification is not critical
    } else {
      console.log('Created order_cancelled notification for user:', order.user_id)
    }
  }

  // Send email notification if refund was issued
  if (refundIssued && order.customer_email) {
    // Check user's notification preferences
    let emailEnabled = true
    if (order.user_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('notification_preferences')
        .eq('id', order.user_id)
        .single()

      const preferences = userData?.notification_preferences || { email: true }
      emailEnabled = preferences.email !== false
    }

    if (emailEnabled) {
      const emailResult = await sendOrderCancelledEmail({
        to: order.customer_email,
        orderId: orderDisplayId,
        refundAmount: order.total_cents,
        currency: order.currency,
        reason: 'Printify cancelled order',
        locale: order.locale || 'en',
      })

      if (emailResult.success) {
        console.log('Order cancelled email sent to:', order.customer_email)
      } else {
        console.error('Failed to send order cancelled email:', emailResult.error)
        // Don't throw — email is not critical
      }
    } else {
      console.log('Email notification skipped (user preference disabled):', order.customer_email)
    }
  }

  // Create audit log entry
  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: 'printify_webhook',
    action: 'order_cancelled',
    resource_type: 'order',
    resource_id: order.id,
    changes: { status: finalStatus, refunded: refundIssued },
    metadata: {
      printify_order_id: printifyOrderId,
      refund_issued: refundIssued,
    },
  })

  console.log(`[Printify Cancelled] Order processing complete: ${printifyOrderId} (status: ${finalStatus})`)
}

// handleProductPublished is now handled by syncProductFromPrintify()
// which does a full upsert including status, images, and pricing.
