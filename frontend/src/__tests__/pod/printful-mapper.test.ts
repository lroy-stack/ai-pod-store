/**
 * Printful Mapper — Unit Tests
 *
 * Tests parsePrintfulVariantName, toCanonicalProduct (sync product structure,
 * blueprintRef), toNormalizedWebhookEvent (extractResourceId per event type).
 */

import { describe, it, expect } from 'vitest'
import {
  parsePrintfulVariantName,
  toCanonicalProduct,
  toNormalizedWebhookEvent,
  fromCreateProductInput,
  fromCreateOrderInput,
} from '@/lib/pod/printful/mapper'

// ─── parsePrintfulVariantName ───────────────────────────────

describe('parsePrintfulVariantName', () => {
  it('parses "Brand Model (Color / Size)" format', () => {
    expect(parsePrintfulVariantName('Bella + Canvas 3001 (Black / M)')).toEqual({
      color: 'Black',
      size: 'M',
    })
  })

  it('handles multi-word color', () => {
    expect(parsePrintfulVariantName('Gildan 18500 (Sport Grey / 2XL)')).toEqual({
      color: 'Sport Grey',
      size: '2XL',
    })
  })

  it('parses color-only variant', () => {
    expect(parsePrintfulVariantName('Bella + Canvas 3001 (Black)')).toEqual({
      color: 'Black',
      size: null,
    })
  })

  it('returns null/null for unparenthesized names', () => {
    expect(parsePrintfulVariantName('Custom Variant')).toEqual({
      color: null,
      size: null,
    })
  })

  it('handles empty string', () => {
    expect(parsePrintfulVariantName('')).toEqual({
      color: null,
      size: null,
    })
  })

  it('handles nested slashes in color', () => {
    // "Brand (Black/White / L)" → color=Black/White, size=L
    // The regex splits on '/', so it takes first and last
    expect(parsePrintfulVariantName('Brand (Dark / Heather / L)')).toEqual({
      color: 'Dark',
      size: 'L',
    })
  })
})

// ─── toCanonicalProduct ─────────────────────────────────────

describe('toCanonicalProduct (Printful)', () => {
  const baseSyncProduct = {
    sync_product: {
      id: 12345,
      name: 'Printful Hoodie',
      is_ignored: false,
    },
    sync_variants: [
      {
        id: 'sv-1',
        name: 'Gildan 18500 (Black / M)',
        sku: 'PF-BLK-M',
        retail_price: '29.99',
        is_enabled: true,
        synced: true,
        product: {
          product_id: 71,
          image: 'https://files.printful.com/img1.jpg',
        },
      },
      {
        id: 'sv-2',
        name: 'Gildan 18500 (White / L)',
        sku: 'PF-WHT-L',
        retail_price: '29.99',
        is_enabled: true,
        synced: false,
        product: {
          product_id: 71,
          image: 'https://files.printful.com/img2.jpg',
        },
      },
    ],
  }

  it('maps sync_product fields correctly', () => {
    const result = toCanonicalProduct(baseSyncProduct as any)
    expect(result.externalId).toBe('12345')
    expect(result.title).toBe('Printful Hoodie')
    expect(result.status).toBe('active')
  })

  it('sets status to draft when is_ignored is true', () => {
    const ignored = {
      ...baseSyncProduct,
      sync_product: { ...baseSyncProduct.sync_product, is_ignored: true },
    }
    const result = toCanonicalProduct(ignored as any)
    expect(result.status).toBe('draft')
  })

  it('parses variant prices from retail_price string', () => {
    const result = toCanonicalProduct(baseSyncProduct as any)
    expect(result.variants[0].priceCents).toBe(2999)
  })

  it('sets isAvailable from synced flag', () => {
    const result = toCanonicalProduct(baseSyncProduct as any)
    expect(result.variants[0].isAvailable).toBe(true)
    expect(result.variants[1].isAvailable).toBe(false)
  })

  it('extracts blueprintRef from first variant product_id', () => {
    const result = toCanonicalProduct(baseSyncProduct as any)
    expect(result.blueprintRef).toBe('printful:71')
  })

  it('deduplicates images from sync variants', () => {
    const result = toCanonicalProduct(baseSyncProduct as any)
    expect(result.images).toHaveLength(2)
    expect(result.images[0].isDefault).toBe(true)
  })

  it('has empty description (Printful stores no descriptions)', () => {
    const result = toCanonicalProduct(baseSyncProduct as any)
    expect(result.description).toBe('')
  })

  it('has empty tags and printAreas', () => {
    const result = toCanonicalProduct(baseSyncProduct as any)
    expect(result.tags).toEqual([])
    expect(result.printAreas).toEqual([])
  })

  it('stores _raw reference', () => {
    const result = toCanonicalProduct(baseSyncProduct as any)
    expect(result._raw).toBe(baseSyncProduct)
  })
})

// ─── toNormalizedWebhookEvent ───────────────────────────────

describe('toNormalizedWebhookEvent (Printful)', () => {
  it('maps package_shipped → order.shipped with order external_id', () => {
    const event = toNormalizedWebhookEvent({
      type: 'package_shipped',
      data: { order: { id: 123, external_id: 'ext-order-1' } },
    })
    expect(event.type).toBe('order.shipped')
    expect(event.provider).toBe('printful')
    expect(event.resourceId).toBe('ext-order-1')
  })

  it('maps order_created → order.created', () => {
    const event = toNormalizedWebhookEvent({
      type: 'order_created',
      data: { order: { id: 456 } },
    })
    expect(event.type).toBe('order.created')
    expect(event.resourceId).toBe('456')
  })

  it('maps product_synced → product.created', () => {
    const event = toNormalizedWebhookEvent({
      type: 'product_synced',
      data: { sync_product: { id: 789 } },
    })
    expect(event.type).toBe('product.created')
    expect(event.resourceId).toBe('789')
  })

  it('maps product_updated → product.updated', () => {
    const event = toNormalizedWebhookEvent({
      type: 'product_updated',
      data: { sync_product: { id: 999 } },
    })
    expect(event.type).toBe('product.updated')
    expect(event.resourceId).toBe('999')
  })

  it('maps stock_updated → stock.updated with empty resourceId', () => {
    const event = toNormalizedWebhookEvent({
      type: 'stock_updated',
      data: { variants: [{ id: 1 }] },
    })
    expect(event.type).toBe('stock.updated')
    expect(event.resourceId).toBe('')
  })

  it('maps order_canceled → order.cancelled', () => {
    const event = toNormalizedWebhookEvent({
      type: 'order_canceled',
      data: { order: { id: 111, external_id: 'ext-111' } },
    })
    expect(event.type).toBe('order.cancelled')
    expect(event.resourceId).toBe('ext-111')
  })

  it('falls back to product.updated for unknown types', () => {
    const event = toNormalizedWebhookEvent({
      type: 'unknown_event',
      data: { id: 'fallback' },
    })
    expect(event.type).toBe('product.updated')
  })

  it('converts Unix timestamp to ISO', () => {
    const ts = 1709251200 // 2024-02-29T12:00:00Z
    const event = toNormalizedWebhookEvent({
      type: 'order_created',
      created: ts,
      data: { order: { id: 1 } },
    })
    expect(event.timestamp).toContain('2024')
  })

  it('stores _raw reference', () => {
    const raw = { type: 'product_deleted', data: { sync_product: { id: 5 } } }
    const event = toNormalizedWebhookEvent(raw)
    expect(event._raw).toBe(raw)
  })
})

// ─── fromCreateProductInput ─────────────────────────────────

describe('fromCreateProductInput (Printful)', () => {
  it('maps to Printful sync_product format', () => {
    const result = fromCreateProductInput({
      title: 'My Hoodie',
      variants: [{ variantId: '4012', priceCents: 3499 }],
      printAreas: [{ position: 'front', images: [{ id: 'file-abc', x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
    })
    expect((result.sync_product as any).name).toBe('My Hoodie')
    expect((result.sync_variants as any[])[0].variant_id).toBe(4012)
    expect((result.sync_variants as any[])[0].retail_price).toBe('34.99')
  })
})

// ─── fromCreateOrderInput ───────────────────────────────────

describe('fromCreateOrderInput (Printful)', () => {
  it('includes gift message when provided', () => {
    const result = fromCreateOrderInput({
      internalOrderId: 'uuid-abc',
      lineItems: [{ productExternalId: 'p1', variantExternalId: '100', quantity: 1 }],
      shippingAddress: {
        firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com',
        address1: '456 Oak', city: 'Munich', state: 'BY', postalCode: '80331', country: 'DE',
      },
      giftMessage: 'Happy Birthday!',
    })
    expect((result as any).gift.message).toBe('Happy Birthday!')
    expect((result as any).gift.subject).toContain('A gift for you from')
  })

  it('omits gift field when no message', () => {
    const result = fromCreateOrderInput({
      internalOrderId: 'uuid-xyz',
      lineItems: [],
      shippingAddress: {
        firstName: 'A', lastName: 'B', email: 'a@b.com',
        address1: '1', city: 'C', state: 'D', postalCode: '12345', country: 'DE',
      },
    })
    expect(result).not.toHaveProperty('gift')
  })
})
