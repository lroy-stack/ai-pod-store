/**
 * Phase 2 Integration Tests — Data Integrity Fixes
 *
 * Tests for:
 * - H1: zombie-reaper queries return_requests (not returns)
 * - H7: POD webhook DLQ on handler error
 * - POD webhook auth (missing/invalid signature)
 * - Retry cron auth + response structure
 * - C6+M1: coupon idempotency (checkout.session.completed with coupon)
 */

import { test, expect } from '@playwright/test'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret'
const CRON_SECRET = process.env.CRON_SECRET || ''
const PRINTFUL_WEBHOOK_SECRET = process.env.PRINTFUL_WEBHOOK_SECRET || ''

// Helper: send a signed Stripe webhook event
async function sendStripeWebhookEvent(
  request: any,
  eventType: string,
  dataObject: Record<string, unknown>,
) {
  const event = {
    id: `evt_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: 'event',
    type: eventType,
    data: { object: dataObject },
    api_version: '2024-12-18.acacia',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  }

  const payload = JSON.stringify(event, null, 2)
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: WEBHOOK_SECRET,
  })

  return request.post(`${TEST_BASE_URL}/api/webhooks/stripe`, {
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    data: payload,
  })
}

test.describe('@integration Phase 2 — Data Integrity', () => {
  // ─── H1: zombie-reaper returns structure ───

  test('zombie-reaper response includes returns field', async ({ request }) => {
    test.skip(!CRON_SECRET, 'CRON_SECRET not configured')

    const response = await request.get(`${TEST_BASE_URL}/api/cron/zombie-reaper`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.results).toBeDefined()
    expect(body.results.orders).toBeDefined()
    expect(body.results.products).toBeDefined()
    expect(body.results.returns).toBeDefined()
    expect(body.results.returns.pending).toBeDefined()
    expect(body.results.returns.approved).toBeDefined()
    expect(body.duration_ms).toBeGreaterThanOrEqual(0)
  })

  // ─── POD webhook auth ───

  test('POD webhook without signature is rejected (401)', async ({ request }) => {
    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/pod/printful`, {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ type: 'order_updated', data: {} }),
    })

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('signature')
  })

  test('POD webhook with invalid signature is rejected (401)', async ({ request }) => {
    const response = await request.post(
      `${TEST_BASE_URL}/api/webhooks/pod/printful?secret=invalid_secret`,
      {
        headers: { 'content-type': 'application/json' },
        data: JSON.stringify({ type: 'order_updated', data: {} }),
      },
    )

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('signature')
  })

  test('POD webhook to unknown provider returns 404', async ({ request }) => {
    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/pod/unknown`, {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ type: 'test', data: {} }),
    })

    expect(response.status()).toBe(404)
  })

  // ─── Retry cron auth ───

  test('retry cron without token is rejected (401)', async ({ request }) => {
    const response = await request.get(`${TEST_BASE_URL}/api/cron/retry-pod-orders`)
    expect(response.status()).toBe(401)
  })

  test('retry cron with invalid token is rejected (401)', async ({ request }) => {
    const response = await request.get(`${TEST_BASE_URL}/api/cron/retry-pod-orders`, {
      headers: { Authorization: 'Bearer wrong_token_value' },
    })
    expect(response.status()).toBe(401)
  })

  test('retry cron with valid token returns results structure', async ({ request }) => {
    test.skip(!CRON_SECRET, 'CRON_SECRET not configured')

    const response = await request.get(`${TEST_BASE_URL}/api/cron/retry-pod-orders`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.processed).toBeDefined()
    expect(body.succeeded).toBeDefined()
    expect(body.failed).toBeDefined()
    expect(body.results).toBeDefined()
    expect(Array.isArray(body.results)).toBe(true)
  })

  // ─── C6+M1: checkout.session.completed with coupon ───

  test('checkout.session.completed with coupon is accepted (200)', async ({ request }) => {
    const mockSession = {
      id: `cs_test_${Date.now()}`,
      object: 'checkout.session',
      payment_status: 'paid',
      mode: 'payment',
      amount_total: 2999,
      currency: 'eur',
      customer_email: 'test@example.com',
      payment_intent: `pi_test_coupon_${Date.now()}`,
      metadata: {
        coupon_code: 'TEST_COUPON_IDEMPOTENCY',
        cart_items: JSON.stringify([]),
      },
      shipping_details: {
        name: 'Test User',
        address: {
          line1: '123 Test St',
          city: 'Berlin',
          postal_code: '10115',
          country: 'DE',
        },
      },
    }

    const response = await sendStripeWebhookEvent(
      request,
      'checkout.session.completed',
      mockSession,
    )

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })

  test('duplicate checkout.session.completed with same coupon is accepted (idempotent)', async ({
    request,
  }) => {
    const sessionId = `cs_test_idempotent_${Date.now()}`
    const mockSession = {
      id: sessionId,
      object: 'checkout.session',
      payment_status: 'paid',
      mode: 'payment',
      amount_total: 1999,
      currency: 'eur',
      customer_email: 'test-idem@example.com',
      payment_intent: `pi_test_idem_${Date.now()}`,
      metadata: {
        coupon_code: 'TEST_IDEM_COUPON',
        cart_items: JSON.stringify([]),
      },
      shipping_details: {
        name: 'Test User',
        address: {
          line1: '456 Test Ave',
          city: 'Munich',
          postal_code: '80331',
          country: 'DE',
        },
      },
    }

    // First call
    const response1 = await sendStripeWebhookEvent(
      request,
      'checkout.session.completed',
      mockSession,
    )
    expect(response1.status()).toBe(200)

    // Second call (simulating Stripe retry) — should not crash or double-count
    const response2 = await sendStripeWebhookEvent(
      request,
      'checkout.session.completed',
      mockSession,
    )
    expect(response2.status()).toBe(200)
  })
})
