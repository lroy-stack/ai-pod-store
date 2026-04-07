/**
 * Printify Mapper — Unit Tests
 *
 * Tests parseVariantTitle (6 formats), toCanonicalProduct (variant filtering,
 * image dedup, blueprintRef, HTML strip), and toNormalizedWebhookEvent (event
 * mappings, resourceId extraction).
 */

import { describe, it, expect } from 'vitest'
import {
  parseVariantTitle,
  toCanonicalProduct,
  toNormalizedWebhookEvent,
  fromCreateProductInput,
  fromCreateOrderInput,
  canonicalAddressFromStripe,
} from '@/lib/pod/printify/mapper'

// ─── parseVariantTitle ──────────────────────────────────────

describe('parseVariantTitle', () => {
  it('parses standard "Color / Size" format', () => {
    expect(parseVariantTitle('Black / S')).toEqual({ color: 'Black', size: 'S' })
    expect(parseVariantTitle('Navy / 2XL')).toEqual({ color: 'Navy', size: '2XL' })
    expect(parseVariantTitle('White / XS')).toEqual({ color: 'White', size: 'XS' })
  })

  it('parses cap/combo-size "S/M / Color" format', () => {
    expect(parseVariantTitle('S/M / White')).toEqual({ size: 'S/M', color: 'White' })
    expect(parseVariantTitle('L/XL / Black')).toEqual({ size: 'L/XL', color: 'Black' })
  })

  it('parses bicolor "Color1 / Color2 / Size" format', () => {
    expect(parseVariantTitle('Black / White / One size')).toEqual({
      color: 'Black / White',
      size: 'One size',
    })
  })

  it('parses drinkware "Size / Color / Finish" format', () => {
    expect(parseVariantTitle('11oz / Black / Glossy')).toEqual({
      size: '11oz',
      color: 'Black',
    })
  })

  it('parses single-part title (color only)', () => {
    expect(parseVariantTitle('Natural')).toEqual({ color: 'Natural', size: null })
  })

  it('parses single-part title (size only)', () => {
    expect(parseVariantTitle('One size')).toEqual({ color: null, size: 'One size' })
    expect(parseVariantTitle('S')).toEqual({ color: null, size: 'S' })
  })

  it('handles empty string', () => {
    expect(parseVariantTitle('')).toEqual({ color: null, size: null })
  })

  it('converts US shoe sizes to EU', () => {
    expect(parseVariantTitle('Black / US 9')).toEqual({ color: 'Black', size: 'EU 42.5' })
    expect(parseVariantTitle('White / US 7')).toEqual({ color: 'White', size: 'EU 40' })
  })

  it('preserves EU shoe sizes as-is', () => {
    expect(parseVariantTitle('Black / EU 42')).toEqual({ color: 'Black', size: 'EU 42' })
  })

  it('handles dimension-style sizes', () => {
    expect(parseVariantTitle('White / 18x24')).toEqual({ color: 'White', size: '18x24' })
  })
})

// ─── toCanonicalProduct ─────────────────────────────────────

describe('toCanonicalProduct', () => {
  const baseRawProduct = {
    id: 'abc123',
    title: 'Test Hoodie',
    description: '<p>A <b>great</b> hoodie&nbsp;for you&amp;me</p>',
    visible: true,
    blueprint_id: 6,
    print_provider_id: 26,
    tags: ['streetwear', 'ai'],
    variants: [
      { id: 101, title: 'Black / S', sku: 'TST-BLK-S', cost: 1500, price: 2999, is_enabled: true, is_available: true },
      { id: 102, title: 'White / M', sku: 'TST-WHT-M', cost: 1500, price: 2999, is_enabled: true, is_available: true },
      { id: 103, title: 'Red / L', sku: 'TST-RED-L', cost: 1500, price: 0, is_enabled: false, is_available: false },
    ],
    images: [
      { src: 'https://cdn.example.com/img1.jpg?v=1', variant_ids: [101], is_default: true },
      { src: 'https://cdn.example.com/img1.jpg?v=2', variant_ids: [101] }, // duplicate (same base URL)
      { src: 'https://cdn.example.com/size-chart.jpg', variant_ids: [] }, // size chart — should be filtered
      { src: 'https://cdn.example.com/img2.jpg', variant_ids: [102], is_default: false },
    ],
    print_areas: [
      {
        variant_ids: [101, 102],
        placeholders: [
          { position: 'front', width: 3000, height: 3000, images: [{ id: 'img-f', x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'back', width: 3000, height: 3000, images: [] },
        ],
      },
    ],
  }

  it('maps basic product fields', () => {
    const result = toCanonicalProduct(baseRawProduct as any)
    expect(result.externalId).toBe('abc123')
    expect(result.title).toBe('Test Hoodie')
    expect(result.status).toBe('active')
    expect(result.tags).toEqual(['streetwear', 'ai'])
    expect(result.blueprintRef).toBe('printify:6:26')
  })

  it('strips HTML from description', () => {
    const result = toCanonicalProduct(baseRawProduct as any)
    expect(result.description).toBe('A great hoodie for you&me')
    expect(result.description).not.toContain('<')
  })

  it('filters disabled variants', () => {
    const result = toCanonicalProduct(baseRawProduct as any)
    expect(result.variants).toHaveLength(2)
    expect(result.variants.map(v => v.externalId)).toEqual(['101', '102'])
  })

  it('deduplicates images by base URL and filters size charts', () => {
    const result = toCanonicalProduct(baseRawProduct as any)
    expect(result.images).toHaveLength(2)
    expect(result.images[0].src).toBe('https://cdn.example.com/img1.jpg?v=1')
    expect(result.images[1].src).toBe('https://cdn.example.com/img2.jpg')
  })

  it('builds variant image map correctly', () => {
    const result = toCanonicalProduct(baseRawProduct as any)
    const blackS = result.variants.find(v => v.title === 'Black / S')
    expect(blackS?.imageUrl).toBe('https://cdn.example.com/img1.jpg?v=1')
  })

  it('converts cost USD→EUR', () => {
    const result = toCanonicalProduct(baseRawProduct as any)
    const v = result.variants[0]
    // 1500 * 0.92 = 1380
    expect(v.costCents).toBe(1380)
  })

  it('sets blueprintRef to null when blueprint_id is missing', () => {
    const noBlueprint = { ...baseRawProduct, blueprint_id: undefined, print_provider_id: undefined }
    const result = toCanonicalProduct(noBlueprint as any)
    expect(result.blueprintRef).toBeNull()
  })

  it('handles product with only blueprint_id (no provider)', () => {
    const bpOnly = { ...baseRawProduct, print_provider_id: undefined }
    const result = toCanonicalProduct(bpOnly as any)
    expect(result.blueprintRef).toBe('printify:6')
  })

  it('maps print areas correctly', () => {
    const result = toCanonicalProduct(baseRawProduct as any)
    expect(result.printAreas).toHaveLength(2)
    expect(result.printAreas[0].position).toBe('front')
    expect(result.printAreas[0].placeholders[0].images).toHaveLength(1)
    expect(result.printAreas[1].position).toBe('back')
  })

  it('sets status to draft when not visible', () => {
    const invisible = { ...baseRawProduct, visible: false }
    const result = toCanonicalProduct(invisible as any)
    expect(result.status).toBe('draft')
  })

  it('handles missing variants gracefully', () => {
    const noVariants = { ...baseRawProduct, variants: undefined }
    const result = toCanonicalProduct(noVariants as any)
    expect(result.variants).toEqual([])
  })
})

// ─── toNormalizedWebhookEvent ───────────────────────────────

describe('toNormalizedWebhookEvent', () => {
  it('maps order:created to order.created', () => {
    const event = toNormalizedWebhookEvent({
      id: 'evt-1',
      type: 'order:created',
      resource: { id: 'order-abc' },
    })
    expect(event.type).toBe('order.created')
    expect(event.provider).toBe('printify')
    expect(event.resourceId).toBe('order-abc')
  })

  it('maps order:shipped to order.shipped', () => {
    const event = toNormalizedWebhookEvent({
      type: 'order:shipped',
      resource: { id: 'order-ship' },
    })
    expect(event.type).toBe('order.shipped')
  })

  it('maps product:publish:succeeded to product.publish_succeeded', () => {
    const event = toNormalizedWebhookEvent({
      type: 'product:publish:succeeded',
      resource: { id: 'prod-pub' },
    })
    expect(event.type).toBe('product.publish_succeeded')
    expect(event.resourceId).toBe('prod-pub')
  })

  it('maps product:deleted to product.deleted', () => {
    const event = toNormalizedWebhookEvent({
      type: 'product:deleted',
      resource: { id: 'prod-del' },
    })
    expect(event.type).toBe('product.deleted')
  })

  it('falls back to product.updated for unknown event types', () => {
    const event = toNormalizedWebhookEvent({
      type: 'unknown:event',
      resource: { id: 'resource-x' },
    })
    expect(event.type).toBe('product.updated')
  })

  it('extracts resourceId from resource.id', () => {
    const event = toNormalizedWebhookEvent({
      type: 'product:updated',
      resource: { id: 'res-99' },
    })
    expect(event.resourceId).toBe('res-99')
  })

  it('falls back to event.id when resource is missing', () => {
    const event = toNormalizedWebhookEvent({
      id: 'fallback-id',
      type: 'order:created',
    })
    expect(event.resourceId).toBe('fallback-id')
  })

  it('sets provider to printify', () => {
    const event = toNormalizedWebhookEvent({ type: 'order:created' })
    expect(event.provider).toBe('printify')
  })

  it('stores raw event as _raw', () => {
    const raw = { type: 'order:created', custom: 'data' }
    const event = toNormalizedWebhookEvent(raw)
    expect(event._raw).toBe(raw)
  })
})

// ─── fromCreateProductInput ─────────────────────────────────

describe('fromCreateProductInput', () => {
  it('throws when blueprintId is missing', () => {
    expect(() =>
      fromCreateProductInput({
        title: 'Test',
        variants: [],
        printAreas: [],
      }),
    ).toThrow('Printify requires blueprintId and printProviderId')
  })

  it('builds correct Printify format', () => {
    const result = fromCreateProductInput({
      title: 'My Tee',
      description: 'Cool tee',
      blueprintId: 6,
      printProviderId: 26,
      variants: [{ variantId: '101', priceCents: 2499, isEnabled: true }],
      printAreas: [{ position: 'front', images: [{ id: 'img-1', x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
      tags: ['test'],
    })

    expect(result.blueprint_id).toBe(6)
    expect(result.print_provider_id).toBe(26)
    expect(result.title).toBe('My Tee')
    expect((result.variants as any[])[0].id).toBe(101) // parsed from string
    expect((result.variants as any[])[0].price).toBe(2499)
  })
})

// ─── fromCreateOrderInput ───────────────────────────────────

describe('fromCreateOrderInput', () => {
  it('maps order input to Printify format', () => {
    const result = fromCreateOrderInput({
      internalOrderId: 'uuid-1234',
      lineItems: [{ productExternalId: 'p1', variantExternalId: '101', quantity: 2 }],
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        address1: '123 Main St',
        city: 'Berlin',
        state: 'BE',
        postalCode: '10115',
        country: 'DE',
      },
    })

    expect(result.external_id).toBe('uuid-1234')
    expect(result.shipping_method).toBe(1)
    expect((result.line_items as any[])[0].variant_id).toBe(101)
    expect((result.address_to as any).country).toBe('DE')
  })
})

// ─── canonicalAddressFromStripe ─────────────────────────────

describe('canonicalAddressFromStripe', () => {
  it('parses name into firstName/lastName', () => {
    const addr = canonicalAddressFromStripe(
      { name: 'John Doe', line1: '123 Main St', city: 'Berlin', country: 'DE', postal_code: '10115' },
      'john@example.com',
    )
    expect(addr.firstName).toBe('John')
    expect(addr.lastName).toBe('Doe')
    expect(addr.email).toBe('john@example.com')
    expect(addr.country).toBe('DE')
  })

  it('handles single-word name', () => {
    const addr = canonicalAddressFromStripe({ name: 'Madonna' }, 'test@test.com')
    expect(addr.firstName).toBe('Madonna')
    expect(addr.lastName).toBe('')
  })

  it('defaults country to DE', () => {
    const addr = canonicalAddressFromStripe({}, 'test@test.com')
    expect(addr.country).toBe('DE')
  })
})
