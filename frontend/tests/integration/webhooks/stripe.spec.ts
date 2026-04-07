/**
 * Stripe Webhook Integration Tests
 *
 * Note: Full end-to-end order creation from webhook is tested in the E2E shopping flow test (ID 107).
 * These integration tests verify the webhook endpoint accepts requests and validates signatures.
 */

import { test, expect } from '@playwright/test'
import Stripe from 'stripe'

// Initialize Stripe for constructing webhook events
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret'

test.describe('Stripe Webhook Integration', () => {
  test('webhook endpoint accepts valid checkout.session.completed event', async ({ request }) => {
    // Create a minimal mock checkout session
    const testSessionId = `cs_test_integration_${Date.now()}`
    const testEmail = `webhook-test-${Date.now()}@example.com`

    const mockSession: Partial<Stripe.Checkout.Session> = {
      id: testSessionId,
      object: 'checkout.session',
      payment_status: 'paid',
      customer_email: testEmail,
      amount_total: 2999,
      currency: 'eur',
      metadata: {
        locale: 'en',
        cart_items: JSON.stringify([]),
      },
    }

    // Construct webhook event
    const event = {
      id: `evt_test_${Date.now()}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: mockSession },
      api_version: '2024-12-18.acacia',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
    }

    const payload = JSON.stringify(event, null, 2)

    // Generate valid webhook signature
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    })

    // Send webhook request
    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/stripe`, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      data: payload,
    })

    // Verify webhook was accepted
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })

  test('webhook endpoint rejects requests without signature', async ({ request }) => {
    const event = {
      id: `evt_test_${Date.now()}`,
      type: 'checkout.session.completed',
      data: { object: { id: 'test' } },
    }

    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/stripe`, {
      headers: {
        'content-type': 'application/json',
      },
      data: JSON.stringify(event),
    })

    // Should reject without signature
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('signature')
  })

  test('webhook endpoint rejects requests with invalid signature', async ({ request }) => {
    const event = {
      id: `evt_test_${Date.now()}`,
      type: 'checkout.session.completed',
      data: { object: { id: 'test' } },
    }

    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/stripe`, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'invalid_signature',
      },
      data: JSON.stringify(event),
    })

    // Should reject with invalid signature
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('signature')
  })

  test('webhook endpoint handles subscription events', async ({ request }) => {
    const mockSubscription: Partial<Stripe.Subscription> = {
      id: `sub_test_${Date.now()}`,
      object: 'subscription',
      status: 'active',
      customer: 'cus_test_123',
    }

    const event = {
      id: `evt_test_${Date.now()}`,
      object: 'event',
      type: 'customer.subscription.created',
      data: { object: mockSubscription },
      api_version: '2024-12-18.acacia',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
    }

    const payload = JSON.stringify(event, null, 2)
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    })

    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/stripe`, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
      data: payload,
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })
})
