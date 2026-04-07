/**
 * Stripe Webhook Handler — Dispatcher
 *
 * POST /api/webhooks/stripe
 *
 * Verifies Stripe signature and dispatches to focused handler modules.
 * All business logic lives in @/lib/webhooks/stripe/*
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'
import {
  handleCheckoutCompleted,
  handleSubscriptionUpdate,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
  handleChargeDisputeCreated,
  handleChargeRefunded,
} from '@/lib/webhooks/stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('CRITICAL: STRIPE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break

    case 'payment_intent.succeeded':
      console.log('PaymentIntent succeeded:', event.data.object.id)
      break

    case 'payment_intent.payment_failed':
      console.log('PaymentIntent failed:', event.data.object.id)
      break

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
      break

    case 'charge.dispute.created':
      await handleChargeDisputeCreated(event.data.object as Stripe.Dispute)
      break

    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as Stripe.Charge)
      break

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
