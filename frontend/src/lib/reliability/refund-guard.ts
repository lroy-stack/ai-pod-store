/**
 * RefundGuard — Atomic refund processing module
 *
 * Ensures a single refund per order by using the issue_refund_atomic database function.
 * If the database indicates the order was already refunded, automatically cancels the
 * Stripe refund to maintain consistency.
 *
 * @module reliability/refund-guard
 */

import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface RefundResult {
  success: boolean
  stripeRefundId?: string
  alreadyRefunded?: boolean
  error?: string
}

/**
 * Issue a refund for an order with atomic database protection
 *
 * This function performs a two-phase refund:
 * 1. Creates a Stripe refund
 * 2. Atomically records it in the database via issue_refund_atomic()
 * 3. If the database indicates the order was already refunded, cancels the Stripe refund
 *
 * @param orderId - UUID of the order to refund
 * @param paymentIntentId - Stripe payment intent ID
 * @param amount - Refund amount in cents
 * @param reason - Refund reason for records
 * @returns Promise<RefundResult> - Result of the refund operation
 *
 * @example
 * ```typescript
 * const result = await issueRefund(
 *   '123e4567-e89b-12d3-a456-426614174000',
 *   'pi_1234567890',
 *   5000,
 *   'Customer requested refund'
 * )
 * if (result.success) {
 *   console.log('Refund issued:', result.stripeRefundId)
 * } else if (result.alreadyRefunded) {
 *   console.log('Order was already refunded')
 * } else {
 *   console.error('Refund failed:', result.error)
 * }
 * ```
 */
export async function issueRefund(
  orderId: string,
  paymentIntentId: string,
  amount: number,
  reason: string
): Promise<RefundResult> {
  let stripeRefund: any

  try {
    // Step 1: Create the Stripe refund
    console.log(`[RefundGuard] Creating Stripe refund for order ${orderId}`)

    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason: 'requested_by_customer', // Stripe enum value
        metadata: {
          order_id: orderId,
          reason, // Store custom reason in metadata
        },
      })

      console.log(`[RefundGuard] Stripe refund created: ${stripeRefund.id}`)
    } catch (stripeError: any) {
      console.error('[RefundGuard] Stripe refund failed:', stripeError)
      return {
        success: false,
        error: stripeError?.message || 'Stripe refund creation failed',
      }
    }

    // Step 2: Atomically record the refund in the database
    console.log(`[RefundGuard] Recording refund atomically for order ${orderId}`)

    const { data: atomicResult, error: rpcError } = await supabaseAdmin.rpc(
      'issue_refund_atomic',
      {
        p_order_id: orderId,
        p_refund_amount_cents: amount,
        p_refund_reason: reason,
        p_stripe_refund_id: stripeRefund.id,
      }
    )

    if (rpcError) {
      console.error('[RefundGuard] Database RPC error:', rpcError)

      // Database error - try to cancel the Stripe refund
      console.log(`[RefundGuard] Cancelling Stripe refund due to database error`)
      try {
        await stripe.refunds.cancel(stripeRefund.id)
        console.log(`[RefundGuard] Stripe refund cancelled successfully`)
      } catch (cancelError: any) {
        console.error('[RefundGuard] Failed to cancel Stripe refund:', cancelError)
        // Log but don't throw - we already have a primary error
      }

      return {
        success: false,
        error: rpcError.message || 'Database error during refund recording',
      }
    }

    // Step 3: Check if the refund was already processed
    // issue_refund_atomic returns TRUE if the refund was recorded (first time)
    // and FALSE if the order was already refunded
    if (atomicResult === false) {
      console.log(`[RefundGuard] Order ${orderId} was already refunded - cancelling Stripe refund`)

      // Cancel the Stripe refund since this was a duplicate
      try {
        await stripe.refunds.cancel(stripeRefund.id)
        console.log(`[RefundGuard] Stripe refund cancelled: ${stripeRefund.id}`)
      } catch (cancelError: any) {
        console.error('[RefundGuard] Failed to cancel duplicate Stripe refund:', cancelError)
        // This is bad - we have a Stripe refund for an order that was already refunded
        // Log this as a critical error for manual intervention
        console.error('[RefundGuard] CRITICAL: Stripe refund exists for already-refunded order:', {
          orderId,
          stripeRefundId: stripeRefund.id,
        })
      }

      return {
        success: false,
        alreadyRefunded: true,
        error: 'Order was already refunded',
      }
    }

    // Success! Refund created and recorded atomically
    console.log(`[RefundGuard] Refund completed successfully for order ${orderId}`)
    return {
      success: true,
      stripeRefundId: stripeRefund.id,
    }
  } catch (err: any) {
    console.error('[RefundGuard] Unexpected error:', err)

    // If we created a Stripe refund but hit an unexpected error, try to cancel it
    if (stripeRefund?.id) {
      console.log(`[RefundGuard] Attempting to cancel Stripe refund due to unexpected error`)
      try {
        await stripe.refunds.cancel(stripeRefund.id)
        console.log(`[RefundGuard] Stripe refund cancelled successfully`)
      } catch (cancelError: any) {
        console.error('[RefundGuard] Failed to cancel Stripe refund:', cancelError)
      }
    }

    return {
      success: false,
      error: err?.message || 'Unexpected error during refund',
    }
  }
}
