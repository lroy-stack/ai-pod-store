/**
 * Stripe Checkout Utilities
 * Server-side utilities for retrieving checkout session details
 */

import { stripe } from './stripe'

export interface CheckoutSessionDetails {
  id: string
  status: string
  payment_status: string
  customer_email: string | null
  amount_total: number
  currency: string
  line_items: Array<{
    description: string
    quantity: number
    amount_total: number
  }>
  metadata: {
    locale?: string
    cart_items?: string
  }
}

/**
 * Retrieve checkout session details from Stripe
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<CheckoutSessionDetails | null> {
  try {
    if (!sessionId || !sessionId.startsWith('cs_')) {
      console.error('Invalid Stripe session ID format:', sessionId?.slice(0, 10))
      return null
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items'],
    })

    if (!session) {
      return null
    }

    const lineItems = session.line_items?.data.map((item) => ({
      description: item.description || '',
      quantity: item.quantity || 0,
      amount_total: item.amount_total || 0,
    })) || []

    return {
      id: session.id,
      status: session.status || 'unknown',
      payment_status: session.payment_status || 'unknown',
      customer_email: session.customer_details?.email || null,
      amount_total: session.amount_total || 0,
      currency: session.currency || 'eur',
      line_items: lineItems,
      metadata: session.metadata || {},
    }
  } catch (error) {
    console.error('Failed to retrieve checkout session:', error)
    return null
  }
}
