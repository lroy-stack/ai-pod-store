/**
 * Shared test utilities for pod/ unit tests.
 * Provides mock factories for Supabase, providers, webhook events, and products.
 */

import { vi } from 'vitest'
import type { CanonicalProduct, CanonicalVariant, NormalizedWebhookEvent, WebhookEventType } from '@/lib/pod/models'

// ─── Mock Supabase Client ───────────────────────────────────

interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  gt: ReturnType<typeof vi.fn>
  is: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function createMockQueryBuilder(returnData: unknown = null, returnError: unknown = null): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    gt: vi.fn(),
    is: vi.fn(),
    single: vi.fn(),
    limit: vi.fn(),
    upsert: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }

  // Chain everything back to itself, except terminal methods
  for (const key of Object.keys(builder) as (keyof MockQueryBuilder)[]) {
    if (key === 'single') {
      builder[key].mockResolvedValue({ data: returnData, error: returnError })
    } else {
      builder[key].mockReturnValue(builder)
    }
  }

  return builder
}

export function createMockSupabaseClient(returnData: unknown = null, returnError: unknown = null) {
  const qb = createMockQueryBuilder(returnData, returnError)

  return {
    from: vi.fn().mockReturnValue(qb),
    _qb: qb,
  }
}

// ─── Mock POD Provider ──────────────────────────────────────

export function createMockProvider(overrides: Record<string, unknown> = {}) {
  return {
    providerId: 'printify',
    providerName: 'Printify',
    healthCheck: vi.fn().mockResolvedValue({ ok: true, provider: 'printify', latencyMs: 50 }),
    getBlueprints: vi.fn().mockResolvedValue([]),
    getBlueprintVariants: vi.fn().mockResolvedValue([]),
    getVariantPricing: vi.fn().mockResolvedValue([]),
    createProduct: vi.fn().mockResolvedValue({ externalId: 'new-product-id' }),
    getProduct: vi.fn().mockResolvedValue({ externalId: 'product-1' }),
    listProducts: vi.fn().mockResolvedValue({ data: [], total: 0, offset: 0, limit: 50 }),
    updateProduct: vi.fn().mockResolvedValue({ externalId: 'product-1' }),
    deleteProduct: vi.fn().mockResolvedValue(undefined),
    publishProduct: vi.fn().mockResolvedValue(undefined),
    confirmPublishing: vi.fn().mockResolvedValue(undefined),
    uploadDesign: vi.fn().mockResolvedValue({ id: 'upload-1', fileName: 'test.png', previewUrl: '' }),
    generateMockup: vi.fn().mockResolvedValue({ taskId: null, mockupsByVariant: {}, status: 'completed' }),
    createOrder: vi.fn().mockResolvedValue({ externalId: 'order-1' }),
    submitForProduction: vi.fn().mockResolvedValue(undefined),
    cancelOrder: vi.fn().mockResolvedValue(undefined),
    getOrder: vi.fn().mockResolvedValue({ externalId: 'order-1' }),
    getShippingRates: vi.fn().mockResolvedValue([]),
    verifyWebhook: vi.fn().mockReturnValue(true),
    normalizeEvent: vi.fn(),
    getRegisteredEvents: vi.fn().mockReturnValue([]),
    ...overrides,
  }
}

// ─── Mock Webhook Event ─────────────────────────────────────

export function createMockWebhookEvent(
  overrides: Partial<NormalizedWebhookEvent> = {},
): NormalizedWebhookEvent {
  return {
    type: 'product.updated' as WebhookEventType,
    provider: 'printify',
    eventId: 'evt-test-123',
    resourceId: 'resource-456',
    timestamp: '2026-03-01T00:00:00.000Z',
    data: {},
    _raw: {},
    ...overrides,
  }
}

// ─── Mock Canonical Product ─────────────────────────────────

export function createMockCanonicalProduct(
  overrides: Partial<CanonicalProduct> = {},
): CanonicalProduct {
  return {
    externalId: 'prod-123',
    title: 'Test T-Shirt',
    description: 'A test product',
    status: 'active',
    variants: [
      createMockVariant(),
    ],
    images: [
      { src: 'https://example.com/img1.jpg', alt: 'Test T-Shirt', variantIds: ['v1'], isDefault: true },
    ],
    printAreas: [],
    blueprintRef: 'printify:6:26',
    tags: ['test'],
    ...overrides,
  }
}

export function createMockVariant(
  overrides: Partial<CanonicalVariant> = {},
): CanonicalVariant {
  return {
    externalId: 'v1',
    title: 'Black / S',
    size: 'S',
    color: 'Black',
    sku: 'TEST-BLK-S',
    priceCents: 2499,
    costCents: 800,
    isEnabled: true,
    isAvailable: true,
    imageUrl: 'https://example.com/variant-img.jpg',
    ...overrides,
  }
}
