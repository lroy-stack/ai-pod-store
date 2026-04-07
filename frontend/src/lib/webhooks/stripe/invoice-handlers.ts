/**
 * Handlers for Stripe invoice webhook events
 *
 * - invoice.payment_failed
 */

import Stripe from 'stripe'
import { BASE_URL, EMAIL_FROM } from '@/lib/store-config'
import { supabase } from './shared'

/**
 * Handle invoice.payment_failed event
 * Updates subscription status and notifies user + admin
 */
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const customerId = typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id

    if (!customerId) return

    // Find user
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('stripe_customer_id', customerId)
      .single()

    if (!user) {
      console.warn('Invoice payment failed: no user found for customer', customerId)
      return
    }

    // Update subscription status to past_due
    await supabase
      .from('users')
      .update({ subscription_status: 'past_due', tier: 'free' })
      .eq('id', user.id)

    // Send payment failure email via Resend
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey && user.email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: user.email,
          subject: 'Payment Failed — Please Update Your Payment Method',
          html: `
            <h1>Payment Failed</h1>
            <p>We were unable to process your subscription payment.</p>
            <p>Please update your payment method to keep your Premium features active.</p>
            <p><a href="${BASE_URL}/profile">Update Payment Method →</a></p>
          `,
        }),
      }).catch((err) => console.error('Failed to send payment failure email:', err))
    }

    // Alert admin
    fetch(`${BASE_URL}/api/admin/alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'invoice_payment_failed',
        message: `Payment failed for user ${user.email || user.id}`,
        severity: 'medium',
      }),
    }).catch(() => {})

    console.log(`Invoice payment failed for user ${user.id}, status set to past_due`)
  } catch (error) {
    console.error('Error handling invoice payment failed:', error)
  }
}
