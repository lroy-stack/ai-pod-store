/**
 * Delivery Status Polling Cron
 *
 * GET /api/cron/check-delivery-status
 *
 * Polls shipped orders to detect delivery status changes.
 * Required because Printful does not send an order_delivered webhook event.
 * For each shipped order older than 3 days, queries the provider for the
 * current status and synthesizes a delivery event through the webhook router.
 *
 * Protected by bearer token auth (CRON_SECRET).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/rate-limit'
import { acquireLock, recordRun } from '@/lib/reliability/cron-lock'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { initializeProviders, getProviderById } from '@/lib/pod'
import { providerRegistry } from '@/lib/pod/provider-registry'
import { createWebhookRouter } from '@/lib/pod/webhooks'
import type { NormalizedWebhookEvent, WebhookEventType } from '@/lib/pod/models'

const CRON_NAME = 'check-delivery-status'
const CRON_SECRET = process.env.CRON_SECRET

/** Only check orders shipped at least 3 days ago (to avoid premature polling) */
const MIN_SHIPPED_DAYS = 3

/** Maximum orders to process per cron run */
const BATCH_SIZE = 20

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()

  // Acquire advisory lock to prevent concurrent runs
  const lock = await acquireLock(CRON_NAME)
  if (!lock.acquired) {
    return NextResponse.json({
      message: 'Another instance is already running',
      skipped: true,
    })
  }

  initializeProviders()

  const webhookRouter = createWebhookRouter()
  const results: Array<{ orderId: string; action: string; success: boolean; error?: string }> = []

  try {
    // Find orders shipped more than MIN_SHIPPED_DAYS days ago
    const cutoffDate = new Date(Date.now() - MIN_SHIPPED_DAYS * 24 * 60 * 60 * 1000)

    const { data: shippedOrders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, status, external_order_id, pod_provider, shipped_at')
      .eq('status', 'shipped')
      .lt('shipped_at', cutoffDate.toISOString())
      .order('shipped_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error(`[${CRON_NAME}] Failed to fetch shipped orders:`, fetchError)
      await recordRun(CRON_NAME, 'failed', Date.now() - startTime, fetchError.message)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    if (!shippedOrders || shippedOrders.length === 0) {
      console.log(`[${CRON_NAME}] No shipped orders to check`)
      await recordRun(CRON_NAME, 'completed', Date.now() - startTime, undefined, 0)
      return NextResponse.json({
        message: 'No shipped orders to check',
        processed: 0,
      })
    }

    console.log(`[${CRON_NAME}] Checking ${shippedOrders.length} shipped orders`)

    for (const order of shippedOrders) {
      try {
        // Determine provider: explicit pod_provider column, or infer from available IDs
        let providerId = order.pod_provider as string | null

        if (!providerId && order.external_order_id) {
          providerId = 'printful'
        }

        if (!providerId) {
          console.log(`[${CRON_NAME}] Cannot determine provider for order ${order.id}, skipping`)
          results.push({ orderId: order.id, action: 'skipped_no_provider', success: false })
          continue
        }

        // Check if this provider is registered
        if (!providerRegistry.has(providerId)) {
          console.log(`[${CRON_NAME}] Provider ${providerId} not configured, skipping order ${order.id}`)
          results.push({ orderId: order.id, action: `skipped_provider_not_configured:${providerId}`, success: false })
          continue
        }

        // Get the provider's order ID
        const providerOrderId = order.external_order_id
        if (!providerOrderId) {
          console.log(`[${CRON_NAME}] No provider order ID for order ${order.id}, skipping`)
          results.push({ orderId: order.id, action: 'skipped_no_provider_order_id', success: false })
          continue
        }

        // Query the provider for current order status
        const provider = getProviderById(providerId)
        const canonicalOrder = await provider.getOrder(providerOrderId)

        if (canonicalOrder.status === 'delivered') {
          console.log(`[${CRON_NAME}] Order ${order.id} delivered — synthesizing webhook event`)

          // Synthesize a NormalizedWebhookEvent for the delivery
          const syntheticEvent: NormalizedWebhookEvent = {
            type: 'order.delivered' as WebhookEventType,
            provider: providerId,
            eventId: `cron-delivery-${order.id}-${Date.now()}`,
            resourceId: providerOrderId,
            timestamp: new Date().toISOString(),
            data: {
              order: {
                external_id: order.id,
              },
            },
            _raw: { source: 'cron-check-delivery-status', canonicalOrder },
          }

          await webhookRouter.route(syntheticEvent, supabaseAdmin)

          results.push({ orderId: order.id, action: 'delivered', success: true })
        } else {
          // Status hasn't changed to delivered yet
          results.push({
            orderId: order.id,
            action: `still_${canonicalOrder.status}`,
            success: true,
          })
        }
      } catch (orderError) {
        const errMsg = orderError instanceof Error ? orderError.message : String(orderError)
        console.error(`[${CRON_NAME}] Error checking order ${order.id}:`, errMsg)
        results.push({ orderId: order.id, action: 'error', success: false })
      }
    }

    const delivered = results.filter(r => r.action === 'delivered').length
    const errors = results.filter(r => !r.success).length

    await recordRun(CRON_NAME, 'completed', Date.now() - startTime, undefined, delivered)

    return NextResponse.json({
      message: `Checked ${results.length} orders: ${delivered} delivered, ${errors} errors`,
      processed: results.length,
      delivered,
      errors,
      results,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error(`[${CRON_NAME}] Unexpected error:`, errMsg)
    await recordRun(CRON_NAME, 'failed', Date.now() - startTime, errMsg)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
