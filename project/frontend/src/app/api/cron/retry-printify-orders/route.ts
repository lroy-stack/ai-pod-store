/**
 * POD Order Retry Cron
 *
 * GET /api/cron/retry-printify-orders
 * Handles stuck orders and automatic refunds:
 * 1. Retries orders stuck in 'paid' state without external_order_id (max 3 attempts, 30min window)
 * 2. Auto-refunds after 3 failed attempts OR 2 hours timeout
 * 3. Auto-refunds orders in 'requires_review' > 24 hours
 * Protected by bearer token auth.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyCronSecret } from '@/lib/rate-limit'
import { issueRefund } from '@/lib/reliability/refund-guard'
import { transition } from '@/lib/reliability/state-transition'
import { submitOrderToPOD } from '@/lib/pod/submit-order-to-pod'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const CRON_SECRET = process.env.CRON_SECRET

// Time windows
const RETRY_WINDOW_MINUTES = 30
const HARD_TIMEOUT_HOURS = 2
const REQUIRES_REVIEW_TIMEOUT_HOURS = 24
const MAX_RETRY_ATTEMPTS = 3

export async function GET(req: NextRequest) {
  // Verify cron secret (timing-safe)
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const retryWindowCutoff = new Date(now.getTime() - RETRY_WINDOW_MINUTES * 60 * 1000)
  const hardTimeoutCutoff = new Date(now.getTime() - HARD_TIMEOUT_HOURS * 60 * 60 * 1000)
  const requiresReviewCutoff = new Date(now.getTime() - REQUIRES_REVIEW_TIMEOUT_HOURS * 60 * 60 * 1000)

  const results: Array<{ orderId: string; action: string; success: boolean; error?: string }> = []

  // === PART 1: Handle stuck 'paid' orders ===
  // Find orders in 'paid' status without external_order_id (stuck after payment)
  const { data: stuckPaidOrders, error: paidFetchError } = await supabase
    .from('orders')
    .select('id, status, stripe_payment_intent_id, total_cents, paid_at, pod_retry_count, currency, external_order_id')
    .eq('status', 'paid')
    .is('external_order_id', null)
    .not('stripe_payment_intent_id', 'is', null)
    .order('paid_at', { ascending: true })
    .limit(20)

  if (paidFetchError) {
    console.error('[Retry Cron] Failed to fetch stuck paid orders:', paidFetchError)
  } else if (stuckPaidOrders && stuckPaidOrders.length > 0) {
    console.log(`[Retry Cron] Found ${stuckPaidOrders.length} stuck 'paid' orders`)

    for (const order of stuckPaidOrders) {
      const paidAt = order.paid_at ? new Date(order.paid_at) : null

      if (!paidAt) {
        console.warn(`[Retry Cron] Order ${order.id} has no paid_at timestamp, skipping`)
        continue
      }

      const retryCount = order.pod_retry_count || 0
      const isExpired = paidAt < hardTimeoutCutoff
      const isWithinRetryWindow = paidAt > retryWindowCutoff

      // Auto-refund conditions: max retries exceeded OR hard timeout exceeded
      if (retryCount >= MAX_RETRY_ATTEMPTS || isExpired) {
        const reason = retryCount >= MAX_RETRY_ATTEMPTS
          ? `Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`
          : `Hard timeout (${HARD_TIMEOUT_HOURS}h) exceeded`

        console.log(`[Retry Cron] Auto-refunding order ${order.id}: ${reason}`)

        const refundResult = await issueRefund(
          order.id,
          order.stripe_payment_intent_id!,
          order.total_cents,
          reason
        )

        if (refundResult.success || refundResult.alreadyRefunded) {
          // Transition to refunded status
          await transition('orders', order.id, 'paid', 'refunded')

          results.push({
            orderId: order.id,
            action: 'auto_refund',
            success: true,
          })

          console.log(`[Retry Cron] Successfully refunded order ${order.id}`)
        } else {
          results.push({
            orderId: order.id,
            action: 'auto_refund_failed',
            success: false,
            error: refundResult.error,
          })

          console.error(`[Retry Cron] Refund failed for order ${order.id}:`, refundResult.error)
        }
      } else if (isWithinRetryWindow) {
        // Still within retry window — try to re-submit to POD provider
        console.log(`[Retry Cron] Re-submitting order ${order.id} to POD (retry ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`)

        try {
          const submitResult = await submitOrderToPOD(order.id)

          if (submitResult.success) {
            console.log(`[Retry Cron] Successfully re-submitted order ${order.id}: ${submitResult.externalOrderId}`)
            results.push({ orderId: order.id, action: 'resubmitted', success: true })
          } else {
            console.error(`[Retry Cron] Re-submission failed for order ${order.id}: ${submitResult.error}`)

            await supabase
              .from('orders')
              .update({
                pod_retry_count: retryCount + 1,
                pod_error: submitResult.error,
              })
              .eq('id', order.id)

            if (retryCount + 1 >= MAX_RETRY_ATTEMPTS) {
              await transition('orders', order.id, 'paid', 'requires_review')
            }

            results.push({ orderId: order.id, action: 'retry_failed', success: false, error: submitResult.error })
          }
        } catch (submitError) {
          console.error(`[Retry Cron] Unexpected error re-submitting order ${order.id}:`, submitError)

          await supabase
            .from('orders')
            .update({
              retry_count: retryCount + 1,
              pod_error: submitError instanceof Error ? submitError.message : 'Unknown error',
            })
            .eq('id', order.id)

          if (retryCount + 1 >= MAX_RETRY_ATTEMPTS) {
            await transition('orders', order.id, 'paid', 'requires_review')
          }

          results.push({
            orderId: order.id,
            action: 'retry_failed',
            success: false,
            error: submitError instanceof Error ? submitError.message : 'Unknown error',
          })
        }
      } else {
        // Outside retry window (older than 30min) but not yet at hard timeout
        // Leave as-is for next cron run
        console.log(`[Retry Cron] Order ${order.id} outside retry window, will check again on next run`)
      }
    }
  }

  // === PART 2: Auto-refund orders stuck in 'requires_review' > 24h ===
  const { data: oldRequiresReviewOrders, error: reviewFetchError } = await supabase
    .from('orders')
    .select('id, status, stripe_payment_intent_id, total_cents, created_at, currency')
    .eq('status', 'requires_review')
    .not('stripe_payment_intent_id', 'is', null)
    .lt('created_at', requiresReviewCutoff.toISOString())
    .order('created_at', { ascending: true })
    .limit(20)

  if (reviewFetchError) {
    console.error('[Retry Cron] Failed to fetch old requires_review orders:', reviewFetchError)
  } else if (oldRequiresReviewOrders && oldRequiresReviewOrders.length > 0) {
    console.log(`[Retry Cron] Found ${oldRequiresReviewOrders.length} old 'requires_review' orders`)

    for (const order of oldRequiresReviewOrders) {
      console.log(`[Retry Cron] Auto-refunding requires_review order ${order.id} (>24h old)`)

      const refundResult = await issueRefund(
        order.id,
        order.stripe_payment_intent_id!,
        order.total_cents,
        `Order stuck in requires_review for >24 hours`
      )

      if (refundResult.success || refundResult.alreadyRefunded) {
        // Transition to refunded status
        await transition('orders', order.id, 'requires_review', 'refunded')

        results.push({
          orderId: order.id,
          action: 'auto_refund_requires_review',
          success: true,
        })

        console.log(`[Retry Cron] Successfully refunded requires_review order ${order.id}`)
      } else {
        results.push({
          orderId: order.id,
          action: 'auto_refund_requires_review_failed',
          success: false,
          error: refundResult.error,
        })

        console.error(`[Retry Cron] Refund failed for requires_review order ${order.id}:`, refundResult.error)
      }
    }
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  return NextResponse.json({
    message: `Processed ${results.length} orders: ${succeeded} succeeded, ${failed} failed`,
    processed: results.length,
    succeeded,
    failed,
    results,
  })
}
