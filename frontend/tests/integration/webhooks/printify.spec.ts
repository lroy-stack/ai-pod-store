/**
 * Printify Webhook Integration Tests
 *
 * Tests the Printify webhook endpoint handles order status update events correctly.
 * Verifies that order:shipped, order:delivered, and order:cancelled events
 * update the order status in the database.
 */

import { test, expect } from '@playwright/test'
import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const TEST_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const WEBHOOK_SECRET = process.env.PRINTIFY_WEBHOOK_SECRET || 'test_webhook_secret'

// Initialize Supabase client for test verification
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * Generate HMAC-SHA256 signature for Printify webhook
 */
function generatePrintifySignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(payload)
  return hmac.digest('base64')
}

/**
 * Create a test order in the database
 */
async function createTestOrder(printifyOrderId: string, userId?: string) {
  const orderId = crypto.randomUUID()

  const { data, error } = await supabase
    .from('orders')
    .insert({
      id: orderId,
      user_id: userId || null,
      customer_email: 'webhook-test@example.com',
      status: 'submitted', // Order has been submitted to Printify for fulfillment
      printify_order_id: printifyOrderId,
      total_cents: 2999, // $29.99
      currency: 'eur',
      locale: 'en',
      shipping_address: {
        first_name: 'Test',
        last_name: 'User',
        email: 'webhook-test@example.com',
        address1: '123 Test St',
        city: 'Test City',
        country_code: 'US',
        zip: '12345',
      },
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test order: ${error.message}`)
  }

  return data
}

/**
 * Delete test order from database
 */
async function deleteTestOrder(orderId: string) {
  await supabase.from('orders').delete().eq('id', orderId)
}

test.describe('Printify Webhook Integration', () => {
  test('webhook endpoint accepts order:shipped event and updates order status', async ({ request }) => {
    const printifyOrderId = `printify_test_${Date.now()}_shipped`

    // Create test order
    const order = await createTestOrder(printifyOrderId)

    try {
      // Construct order:shipped webhook event
      const event = {
        type: 'order:shipped',
        resource: {
          id: printifyOrderId,
          shipments: [
            {
              carrier: 'UPS',
              number: 'TEST123456789',
              url: 'https://www.ups.com/track?tracknum=TEST123456789',
            },
          ],
        },
      }

      const payload = JSON.stringify(event)
      const signature = generatePrintifySignature(payload, WEBHOOK_SECRET)

      // Send webhook request
      const response = await request.post(`${TEST_BASE_URL}/api/webhooks/printify`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Printify-Hmac-SHA256': signature,
        },
        data: payload,
      })

      // Verify webhook was accepted
      expect(response.status()).toBe(200)
      const body = await response.json()
      expect(body.received).toBe(true)

      // Wait a moment for async processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify order status was updated in database
      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .select('status, shipped_at, tracking_number, tracking_url, carrier')
        .eq('id', order.id)
        .single()

      expect(error).toBeNull()
      expect(updatedOrder).not.toBeNull()
      expect(updatedOrder!.status).toBe('shipped')
      expect(updatedOrder!.tracking_number).toBe('TEST123456789')
      expect(updatedOrder!.tracking_url).toBe('https://www.ups.com/track?tracknum=TEST123456789')
      expect(updatedOrder!.carrier).toBe('UPS')
      expect(updatedOrder!.shipped_at).not.toBeNull()
    } finally {
      // Clean up test order
      await deleteTestOrder(order.id)
    }
  })

  test('webhook endpoint accepts order:delivered event and updates order status', async ({ request }) => {
    const printifyOrderId = `printify_test_${Date.now()}_delivered`

    // Create test order
    const order = await createTestOrder(printifyOrderId)

    try {
      // Construct order:delivered webhook event
      const event = {
        type: 'order:delivered',
        resource: {
          id: printifyOrderId,
        },
      }

      const payload = JSON.stringify(event)
      const signature = generatePrintifySignature(payload, WEBHOOK_SECRET)

      // Send webhook request
      const response = await request.post(`${TEST_BASE_URL}/api/webhooks/printify`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Printify-Hmac-SHA256': signature,
        },
        data: payload,
      })

      // Verify webhook was accepted
      expect(response.status()).toBe(200)
      const body = await response.json()
      expect(body.received).toBe(true)

      // Wait a moment for async processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify order status was updated in database
      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .select('status, delivered_at')
        .eq('id', order.id)
        .single()

      expect(error).toBeNull()
      expect(updatedOrder).not.toBeNull()
      expect(updatedOrder!.status).toBe('delivered')
      expect(updatedOrder!.delivered_at).not.toBeNull()
    } finally {
      // Clean up test order
      await deleteTestOrder(order.id)
    }
  })

  test('webhook endpoint accepts order:cancelled event and updates order status', async ({ request }) => {
    const printifyOrderId = `printify_test_${Date.now()}_cancelled`

    // Create test order
    const order = await createTestOrder(printifyOrderId)

    try {
      // Construct order:cancelled webhook event
      const event = {
        type: 'order:cancelled',
        resource: {
          id: printifyOrderId,
        },
      }

      const payload = JSON.stringify(event)
      const signature = generatePrintifySignature(payload, WEBHOOK_SECRET)

      // Send webhook request
      const response = await request.post(`${TEST_BASE_URL}/api/webhooks/printify`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Printify-Hmac-SHA256': signature,
        },
        data: payload,
      })

      // Verify webhook was accepted
      expect(response.status()).toBe(200)
      const body = await response.json()
      expect(body.received).toBe(true)

      // Wait a moment for async processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify order status was updated in database
      const { data: updatedOrder, error } = await supabase
        .from('orders')
        .select('status')
        .eq('id', order.id)
        .single()

      expect(error).toBeNull()
      expect(updatedOrder).not.toBeNull()
      expect(updatedOrder!.status).toBe('cancelled')
    } finally {
      // Clean up test order
      await deleteTestOrder(order.id)
    }
  })

  test('webhook endpoint rejects requests without signature', async ({ request }) => {
    const event = {
      type: 'order:shipped',
      resource: {
        id: 'test_order_123',
      },
    }

    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/printify`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(event),
    })

    // Should reject without signature
    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('X-Printify-Hmac-SHA256')
  })

  test('webhook endpoint rejects requests with invalid signature', async ({ request }) => {
    const event = {
      type: 'order:shipped',
      resource: {
        id: 'test_order_123',
      },
    }

    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/printify`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Printify-Hmac-SHA256': 'invalid_signature',
      },
      data: JSON.stringify(event),
    })

    // Should reject with invalid signature
    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error).toContain('signature')
  })

  test('webhook endpoint handles unhandled event types gracefully', async ({ request }) => {
    const event = {
      type: 'order:unknown_event',
      resource: {
        id: 'test_order_123',
      },
    }

    const payload = JSON.stringify(event)
    const signature = generatePrintifySignature(payload, WEBHOOK_SECRET)

    const response = await request.post(`${TEST_BASE_URL}/api/webhooks/printify`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Printify-Hmac-SHA256': signature,
      },
      data: payload,
    })

    // Should still accept the webhook (return 200) even for unknown events
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })
})
