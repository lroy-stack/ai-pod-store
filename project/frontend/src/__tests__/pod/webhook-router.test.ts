/**
 * WebhookRouter — Unit Tests
 *
 * Tests on/route/has methods and createWebhookRouter (11 event types).
 */

import { describe, it, expect, vi } from 'vitest'
import { WebhookRouter } from '@/lib/pod/webhooks/webhook-router'
import { createWebhookRouter } from '@/lib/pod/webhooks'
import { createMockWebhookEvent } from './test-utils'

// ─── WebhookRouter class ────────────────────────────────────

describe('WebhookRouter', () => {
  it('registers and routes events to handlers', async () => {
    const router = new WebhookRouter()
    const handler = vi.fn()
    router.on('order.created', handler)

    const event = createMockWebhookEvent({ type: 'order.created' })
    const mockSupabase = {} as any

    await router.route(event, mockSupabase)
    expect(handler).toHaveBeenCalledWith(event, mockSupabase)
  })

  it('does not throw for unregistered events', async () => {
    const router = new WebhookRouter()
    const event = createMockWebhookEvent({ type: 'order.refunded' })

    // Should log but not throw
    await expect(router.route(event, {} as any)).resolves.toBeUndefined()
  })

  it('reports registered events via has()', () => {
    const router = new WebhookRouter()
    router.on('product.created', vi.fn())

    expect(router.has('product.created')).toBe(true)
    expect(router.has('product.deleted')).toBe(false)
  })

  it('overwrites handlers for same event type', async () => {
    const router = new WebhookRouter()
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    router.on('order.shipped', handler1)
    router.on('order.shipped', handler2)

    const event = createMockWebhookEvent({ type: 'order.shipped' })
    await router.route(event, {} as any)

    expect(handler1).not.toHaveBeenCalled()
    expect(handler2).toHaveBeenCalledOnce()
  })
})

// ─── createWebhookRouter ────────────────────────────────────

describe('createWebhookRouter', () => {
  it('registers all 11 expected event types', () => {
    const router = createWebhookRouter()

    const expectedEvents = [
      'order.created',
      'order.updated',
      'order.shipped',
      'order.delivered',
      'order.cancelled',
      'order.failed',
      'product.created',
      'product.updated',
      'product.publish_succeeded',
      'product.deleted',
      'stock.updated',
    ]

    for (const eventType of expectedEvents) {
      expect(router.has(eventType)).toBe(true)
    }
  })

  it('does not register order.refunded (not implemented)', () => {
    const router = createWebhookRouter()
    expect(router.has('order.refunded')).toBe(false)
  })
})
