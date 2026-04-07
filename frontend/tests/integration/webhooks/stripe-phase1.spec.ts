/**
 * Stripe Webhook Integration Tests — Phase 1 Security Fixes
 *
 * Tests for:
 * - charge.refunded webhook handler (C5)
 * - charge.dispute.created with 'disputed' status (C7)
 * - zombie-reaper cron auth + response structure (H3)
 */

import { test, expect } from '@playwright/test'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret'
const CRON_SECRET = process.env.CRON_SECRET || ''

// Helper: send a signed webhook event
async function sendWebhookEvent(
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

test.describe('@integration Stripe Webhook — Phase 1 Security Fixes', () => {
  // ─── C5: charge.refunded ───

  test('charge.refunded webhook is accepted (200 OK)', async ({ request }) => {
    const mockCharge = {
      id: `ch_test_${Date.now()}`,
      object: 'charge',
      amount: 2999,
      amount_refunded: 2999,
      refunded: true,
      currency: 'eur',
      payment_intent: `pi_test_refund_${Date.now()}`,
      refunds: {
        object: 'list',
        data: [
          {
            id: `re_test_${Date.now()}`,
            object: 'refund',
            amount: 2999,
            status: 'succeeded',
            reason: 'requested_by_customer',
            currency: 'eur',
          },
        ],
      },
    }

    const response = await sendWebhookEvent(request, 'charge.refunded', mockCharge)

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })

  test('charge.refunded without signature is rejected (400)', async ({ request }) => {
    const event = {
      id: `evt_test_${Date.now()}`,
      type: 'charge.refunded',
      data: {
        object: {
          id: `ch_test_${Date.now()}`,
          payment_intent: 'pi_test_nosig',
          amount_refunded: 1000,
        },
      },
    }

    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/stripe`, {
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify(event),
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('signature')
  })

  test('charge.refunded with invalid signature is rejected (400)', async ({ request }) => {
    const event = {
      id: `evt_test_${Date.now()}`,
      type: 'charge.refunded',
      data: {
        object: {
          id: `ch_test_${Date.now()}`,
          payment_intent: 'pi_test_badsig',
          amount_refunded: 1000,
        },
      },
    }

    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/stripe`, {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 'invalid_signature_value',
      },
      data: JSON.stringify(event),
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('signature')
  })

  // ─── C7: charge.dispute.created → 'disputed' ───

  test('charge.dispute.created webhook is accepted (200 OK)', async ({ request }) => {
    const mockDispute = {
      id: `dp_test_${Date.now()}`,
      object: 'dispute',
      amount: 2999,
      currency: 'eur',
      reason: 'fraudulent',
      status: 'needs_response',
      payment_intent: `pi_test_dispute_${Date.now()}`,
      charge: `ch_test_dispute_${Date.now()}`,
    }

    const response = await sendWebhookEvent(request, 'charge.dispute.created', mockDispute)

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })

  // ─── H3: zombie-reaper cron ───

  test('zombie-reaper requires authentication', async ({ request }) => {
    const response = await request.get(`${TEST_BASE_URL}/api/cron/zombie-reaper`)
    expect(response.status()).toBe(401)
  })

  test('zombie-reaper with wrong token is rejected', async ({ request }) => {
    const response = await request.get(`${TEST_BASE_URL}/api/cron/zombie-reaper`, {
      headers: { Authorization: 'Bearer wrong_token_value' },
    })
    expect(response.status()).toBe(401)
  })

  test('zombie-reaper with valid token returns results structure', async ({ request }) => {
    // Skip if no CRON_SECRET configured
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
    expect(body.duration_ms).toBeGreaterThanOrEqual(0)
  })
})
