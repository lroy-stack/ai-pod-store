/**
 * Printify Webhook Handler
 *
 * POST /api/webhooks/printify
 * Handles Printify webhook events (order:shipped, order:delivered, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

function verifyPrintifyWebhook(body: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret)
  hmac.update(body)
  const expected = hmac.digest('base64')
  return signature === expected
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
      case 'product:publish:started':
        console.log('Printify product publish started:', resource.id)
        break
      case 'product:publish:succeeded':
        await handleProductPublished(resource)
        break
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

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('printify_order_id', printifyOrderId)

  if (error) {
    console.error('Failed to update order for shipped event:', error)
    throw error
  }

  console.log('Order marked as shipped:', printifyOrderId)

  // Create audit log entry
  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: 'printify_webhook',
    action: 'order_shipped',
    resource_type: 'order',
    resource_id: printifyOrderId,
    changes: updateData,
  })
}

async function handleOrderDelivered(resource: Record<string, unknown>) {
  const printifyOrderId = resource.id as string

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
    resource_id: printifyOrderId,
    changes: { status: 'delivered' },
  })
}

async function handleOrderCancelled(resource: Record<string, unknown>) {
  const printifyOrderId = resource.id as string

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('printify_order_id', printifyOrderId)

  if (error) {
    console.error('Failed to update order for cancelled event:', error)
    throw error
  }

  console.log('Order marked as cancelled:', printifyOrderId)

  await supabase.from('audit_log').insert({
    actor_type: 'webhook',
    actor_id: 'printify_webhook',
    action: 'order_cancelled',
    resource_type: 'order',
    resource_id: printifyOrderId,
    changes: { status: 'cancelled' },
  })
}

async function handleProductPublished(resource: Record<string, unknown>) {
  const printifyProductId = resource.id as string

  const { error } = await supabase
    .from('products')
    .update({ status: 'published' })
    .eq('printify_id', printifyProductId)

  if (error) {
    console.error('Failed to update product status for publish event:', error)
  } else {
    console.log('Product marked as published:', printifyProductId)
  }
}
