/**
 * Printify Order Retry Cron
 *
 * GET /api/cron/retry-printify-orders
 * Retries failed Printify order submissions (max 3 retries per order).
 * Protected by bearer token auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { printify } from '@/lib/printify'
import { verifyCronSecret } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const CRON_SECRET = process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN

export async function GET(req: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch orders that failed and haven't exceeded retry limit
  const { data: failedOrders, error: fetchError } = await supabase
    .from('orders')
    .select('id, printify_order_id, printify_error, printify_retry_count')
    .not('printify_error', 'is', null)
    .lt('printify_retry_count', 3)
    .order('created_at', { ascending: true })
    .limit(10)

  if (fetchError) {
    console.error('Failed to fetch orders for retry:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  if (!failedOrders || failedOrders.length === 0) {
    return NextResponse.json({ message: 'No orders to retry', retried: 0 })
  }

  const results: Array<{ orderId: string; success: boolean; error?: string }> = []

  for (const order of failedOrders) {
    try {
      if (order.printify_order_id) {
        // Order was created in Printify but production submission failed — retry production
        await printify.submitOrderForProduction(order.printify_order_id)
      } else {
        // Order was never submitted to Printify — need full order data to recreate
        // Skip these for now — they need manual intervention or the full order data
        results.push({
          orderId: order.id,
          success: false,
          error: 'No printify_order_id — needs manual resubmission',
        })
        continue
      }

      // Success — clear error
      await supabase
        .from('orders')
        .update({
          printify_error: null,
          status: 'submitted',
          printify_last_attempt_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      results.push({ orderId: order.id, success: true })
      console.log('Successfully retried Printify order:', order.id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      await supabase
        .from('orders')
        .update({
          printify_error: errorMessage,
          printify_retry_count: (order.printify_retry_count || 0) + 1,
          printify_last_attempt_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      results.push({ orderId: order.id, success: false, error: errorMessage })
      console.error('Retry failed for order:', order.id, errorMessage)
    }
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  return NextResponse.json({
    message: `Retried ${results.length} orders: ${succeeded} succeeded, ${failed} failed`,
    retried: results.length,
    results,
  })
}
