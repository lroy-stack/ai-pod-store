# POD Provider Abstraction Layer -- Architecture Recommendations

> **Purpose**: Define a provider-agnostic, modular, type-safe, and testable architecture for the POD integration layer, enabling migration from Printify to Printful (and beyond) without touching business logic.
>
> **Date**: 2026-03-02
>
> **Audience**: Engineering team migrating SKAPARA's POD backend.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Provider Abstraction Layer](#2-provider-abstraction-layer)
3. [Recommended File Structure](#3-recommended-file-structure)
4. [Adapter Pattern Implementation](#4-adapter-pattern-implementation)
5. [Webhook Normalization](#5-webhook-normalization)
6. [Sync Engine Design](#6-sync-engine-design)
7. [Testing Strategy](#7-testing-strategy)
8. [Migration Path](#8-migration-path)
9. [Code Examples](#9-code-examples)
10. [References](#10-references)

---

## 1. Current State Analysis

### Integration Touchpoints (Printify-coupled files)

The current codebase has **15 files** directly importing or calling Printify:

| File | Concern | Coupling Level |
|---|---|---|
| `src/lib/printify.ts` | API client (singleton) | **Core** -- wraps all HTTP calls |
| `src/lib/printify-sync.ts` | Product sync + variant parsing + pricing | **Core** -- 550 lines, deeply coupled |
| `src/lib/mockup-generator.ts` | Mockup generation | **Medium** -- direct API calls for Printify mockups |
| `src/lib/print-areas.ts` | Print zone definitions | **Low** -- pure data, no API calls |
| `src/app/api/webhooks/printify/route.ts` | Webhook handler (order + product events) | **Core** -- HMAC verification + event routing |
| `src/app/api/webhooks/stripe/route.ts` | Order creation post-payment | **High** -- creates Printify orders, submits to production |
| `src/app/api/checkout/create-session/route.ts` | Checkout + personalization temp products | **High** -- creates temp products in Printify |
| `src/app/api/cron/sync-printify/route.ts` | Periodic full reconciliation | **Core** -- paginated fetch + margin audit |
| `src/app/api/cron/retry-printify-orders/route.ts` | Order retry logic | **Medium** -- resubmits failed orders |
| `src/app/api/cron/cleanup-temp-products/route.ts` | Temp product cleanup | **Low** -- deletes stale temp products |
| `src/app/api/designs/[id]/create-product/route.ts` | Design-to-product pipeline | **High** -- creates Printify products from designs |
| `src/app/api/designs/personalize/route.ts` | Personalization save (DB only) | **Low** -- no direct Printify calls |
| `src/app/api/admin/seed-*` | Seed scripts | **Low** -- one-time data loading |
| `src/app/api/admin/fix-publishing/route.ts` | Fix stuck publishing states | **Low** -- admin tooling |
| `src/app/api/products/[id]/route.ts` | Product detail API | **Low** -- reads from Supabase, not Printify |

### Key API Surface Used

From `PrintifyClient`, these are the methods actively called by the codebase:

```
createProduct()          -- checkout (temp products), design pipeline
getProduct()             -- webhook sync, checkout, cron
listProducts()           -- cron full reconciliation
createOrder()            -- Stripe webhook (post-payment)
submitOrderForProduction() -- Stripe webhook
cancelOrder()            -- webhook cancellation
getOrder()               -- retry cron
calculateShipping()      -- checkout (optional)
uploadImage()            -- design pipeline
uploadImageFromBase64()  -- checkout (personalization PNGs)
publishProduct()         -- design pipeline
publishingSucceeded()    -- webhook + cron (confirm publishing)
publishingFailed()       -- design pipeline (error path)
deleteProduct()          -- cleanup cron
getBlueprints()          -- catalog research
getProviders()           -- catalog research
getVariants()            -- catalog research
```

### Printful API Equivalents (v1 + v2 beta)

| Printify Method | Printful v1 Equivalent | Printful v2 Equivalent |
|---|---|---|
| `createProduct` | `POST /sync/products` | `POST /v2/catalog-products` (different model) |
| `getProduct` | `GET /sync/products/{id}` | `GET /v2/catalog-products/{id}` |
| `listProducts` | `GET /sync/products` | `GET /v2/catalog-products` |
| `createOrder` | `POST /orders` | `POST /v2/orders` |
| `submitOrderForProduction` | `POST /orders/{id}/confirm` | `POST /v2/orders/{id}/confirm` |
| `cancelOrder` | `DELETE /orders/{id}` | `PATCH /v2/orders/{id}` |
| `getOrder` | `GET /orders/{id}` | `GET /v2/orders/{id}` |
| `calculateShipping` | `POST /shipping/rates` | `POST /v2/shipping-rates` |
| `uploadImage` | `POST /files` | `POST /v2/files` |
| `publishProduct` | N/A (auto-published) | N/A |
| `publishingSucceeded` | N/A (no custom integration concept) | N/A |
| `getBlueprints` | `GET /products` (catalog) | `GET /v2/catalog-products` |
| `getProviders` | N/A (Printful is the provider) | N/A |
| `getVariants` | `GET /products/{id}/variants` | `GET /v2/catalog-products/{id}/catalog-variants` |
| `generateMockup` (not in current client) | `POST /mockup-tasks` | `POST /v2/mockup-tasks` |

### Critical Differences: Printify vs Printful

| Aspect | Printify | Printful |
|---|---|---|
| **Model** | Marketplace (multi-provider, blueprint + provider combo) | Single manufacturer (Printful IS the provider) |
| **Product creation** | `blueprint_id` + `print_provider_id` + variants + print_areas | `sync_product` with linked `catalog_variant_id` per variant |
| **Publishing** | Explicit publish + publishing_succeeded callback | No publishing concept -- products sync automatically |
| **Webhook auth** | HMAC-SHA256 signature | HMAC signature (similar) |
| **Webhook events** | `order:shipped`, `product:updated`, etc. | `package_shipped`, `order_updated`, `product_synced`, etc. |
| **File upload** | `POST /uploads/images.json` (URL or base64) | `POST /files` (URL or file upload) |
| **Mockups** | Product images auto-generated from print_areas | Explicit `POST /mockup-tasks` (async task) |
| **Pricing** | Variant-level `price` (USD cents) | Variant-level retail price + separate cost endpoint |
| **EU providers** | Provider IDs (P26, P410, etc.) | Warehouse selection (EU fulfillment centers) |

---

## 2. Provider Abstraction Layer

### Design Principles

1. **Adapter Pattern** -- Each provider implements a common interface. Business logic depends on the interface, never on a specific provider.
2. **Interface Segregation (ISP)** -- Split the monolithic interface into focused sub-interfaces. Not all consumers need all capabilities.
3. **Strategy Pattern** -- Select the active provider at runtime via configuration or per-product routing.
4. **Anti-Corruption Layer (ACL)** -- Provider adapters translate between provider-specific formats and our canonical domain models. Changes in provider APIs do not leak into business logic.
5. **Repository Pattern** -- Database access is abstracted separately. The sync engine writes to a repository, not directly to Supabase.

### Interface Hierarchy

Following Medusa.js's fulfillment module pattern and Shopify's fulfillment service API, we split the provider interface into **five segregated interfaces**:

```typescript
// ---- Segregated Interfaces (ISP) ----

/** Catalog operations: browse blueprints, variants, pricing */
interface PODCatalogProvider {
  getBlueprints(filters?: CatalogFilters): Promise<Blueprint[]>
  getBlueprintVariants(blueprintId: string): Promise<BlueprintVariant[]>
  getVariantPricing(variantIds: string[]): Promise<VariantPricing[]>
}

/** Product lifecycle: create, update, delete, publish */
interface PODProductProvider {
  createProduct(input: CreateProductInput): Promise<ProviderProduct>
  updateProduct(productId: string, input: UpdateProductInput): Promise<ProviderProduct>
  deleteProduct(productId: string): Promise<void>
  getProduct(productId: string): Promise<ProviderProduct>
  listProducts(pagination: PaginationInput): Promise<PaginatedResult<ProviderProduct>>
  publishProduct?(productId: string): Promise<void>       // Optional: Printify-specific
  confirmPublishing?(productId: string, externalId: string): Promise<void>  // Optional
}

/** File and design operations */
interface PODDesignProvider {
  uploadDesign(input: DesignUploadInput): Promise<UploadedDesign>
  generateMockup(input: MockupInput): Promise<MockupResult>
  getMockupStatus?(taskId: string): Promise<MockupResult>  // Optional: for async mockup providers
}

/** Order fulfillment: create, submit, cancel, track */
interface PODOrderProvider {
  createOrder(input: CreateOrderInput): Promise<ProviderOrder>
  submitForProduction(orderId: string): Promise<void>
  cancelOrder(orderId: string): Promise<void>
  getOrder(orderId: string): Promise<ProviderOrder>
  getShippingRates(input: ShippingRateInput): Promise<ShippingRate[]>
}

/** Webhook handling: verify and normalize events */
interface PODWebhookProvider {
  verifyWebhook(body: string, signature: string): boolean
  normalizeEvent(rawEvent: unknown): NormalizedWebhookEvent
  getRegisteredEvents(): string[]
}
```

### Composite Interface

For consumers that need the full provider (e.g., cron sync, admin tools):

```typescript
/** Full POD provider -- union of all capabilities */
interface PODProvider extends
  PODCatalogProvider,
  PODProductProvider,
  PODDesignProvider,
  PODOrderProvider,
  PODWebhookProvider {

  /** Unique provider identifier */
  readonly providerId: string

  /** Human-readable provider name */
  readonly providerName: string

  /** Health check -- verify API connectivity and credentials */
  healthCheck(): Promise<HealthCheckResult>
}
```

---

## 3. Recommended File Structure

```
src/lib/pod/
  index.ts                    # Factory + registry (getProvider, registerProvider)
  types.ts                    # All shared types and interfaces
  errors.ts                   # PODProviderError, PODRateLimitError, etc.
  constants.ts                # Shared constants (EU countries, currencies)

  provider-registry.ts        # Runtime provider registry (singleton)
  provider-factory.ts         # createProvider(config) factory

  # ---- Canonical domain models (provider-agnostic) ----
  models/
    product.ts                # Product, Variant, PrintArea
    order.ts                  # Order, OrderItem, ShippingAddress
    catalog.ts                # Blueprint, BlueprintVariant, CatalogFilters
    design.ts                 # UploadedDesign, MockupResult
    webhook.ts                # NormalizedWebhookEvent, WebhookEventType
    pricing.ts                # VariantPricing, MarginCalculation
    shipping.ts               # ShippingRate, ShippingMethod

  # ---- Sync engine (provider-agnostic) ----
  sync/
    sync-engine.ts            # ProductSyncEngine class
    conflict-resolver.ts      # Admin edits vs provider updates
    margin-auditor.ts         # Price margin enforcement
    category-inferrer.ts      # Title -> category slug mapping
    variant-parser.ts         # Variant title -> size/color extraction

  # ---- Webhook normalization ----
  webhooks/
    webhook-router.ts         # Route normalized events to handlers
    handlers/
      order-shipped.ts        # Handle order:shipped across providers
      order-failed.ts         # Handle order:failed + auto-refund
      order-cancelled.ts      # Handle order:cancelled
      product-updated.ts      # Handle product:updated -> sync
      product-deleted.ts      # Handle product:deleted -> soft delete

  # ---- Printify adapter (keep for reference/fallback) ----
  printify/
    index.ts                  # PrintifyProvider class (implements PODProvider)
    client.ts                 # PrintifyClient (HTTP wrapper with caching)
    mapper.ts                 # Printify API <-> canonical model transforms
    webhook-verifier.ts       # HMAC-SHA256 verification
    constants.ts              # Printify-specific: EU provider IDs, page limits

  # ---- Printful adapter (new primary) ----
  printful/
    index.ts                  # PrintfulProvider class (implements PODProvider)
    client.ts                 # PrintfulClient (HTTP wrapper + OAuth refresh)
    mapper.ts                 # Printful API <-> canonical model transforms
    webhook-verifier.ts       # Printful webhook verification
    constants.ts              # Printful-specific: warehouse codes, etc.

  # ---- Test utilities ----
  testing/
    mock-provider.ts          # InMemoryProvider for unit tests
    fixtures/                 # Sample products, orders, webhooks
      products.ts
      orders.ts
      webhooks.ts
```

---

## 4. Adapter Pattern Implementation

### 4.1 Canonical Domain Models

These are the types that business logic uses. They are provider-agnostic and map to our Supabase schema:

```typescript
// src/lib/pod/models/product.ts

export interface CanonicalProduct {
  /** Provider's product ID */
  externalId: string
  title: string
  description: string
  /** Printable status */
  status: 'draft' | 'active' | 'publishing' | 'deleted'
  /** Variants with size/color/price */
  variants: CanonicalVariant[]
  /** Product images (mockups) */
  images: CanonicalImage[]
  /** Print area definitions per position */
  printAreas: CanonicalPrintArea[]
  /** Provider-specific blueprint/template reference */
  blueprintRef: string | null
  /** Tags for categorization */
  tags: string[]
  /** Raw provider data (escape hatch) */
  _raw?: unknown
}

export interface CanonicalVariant {
  externalId: string
  title: string
  size: string | null
  color: string | null
  sku: string
  /** Price in store currency cents (EUR) */
  priceCents: number
  /** Production cost in store currency cents (EUR) */
  costCents: number | null
  isEnabled: boolean
  isAvailable: boolean
  imageUrl: string | null
}

export interface CanonicalImage {
  src: string
  alt: string
  variantIds: string[]
  isDefault: boolean
}

export interface CanonicalPrintArea {
  position: 'front' | 'back' | 'left' | 'right' | 'neck_outer' | string
  placeholders: Array<{
    width: number
    height: number
    images: Array<{
      id: string
      x: number
      y: number
      scale: number
      angle: number
    }>
  }>
}
```

```typescript
// src/lib/pod/models/order.ts

export interface CanonicalOrder {
  externalId: string
  status: 'draft' | 'pending' | 'in_production' | 'shipped' | 'delivered' | 'cancelled' | 'failed'
  lineItems: CanonicalLineItem[]
  shippingAddress: CanonicalAddress
  shipments: CanonicalShipment[]
  createdAt: string
  _raw?: unknown
}

export interface CanonicalLineItem {
  productExternalId: string
  variantExternalId: string
  quantity: number
  status: string
}

export interface CanonicalAddress {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address1: string
  address2?: string
  city: string
  state: string
  postalCode: string
  country: string  // ISO 3166-1 alpha-2
}

export interface CanonicalShipment {
  carrier: string
  trackingNumber: string
  trackingUrl: string
  shippedAt: string
}
```

### 4.2 Mapper Layer (Anti-Corruption Layer)

Each provider adapter has a `mapper.ts` that translates between provider-specific formats and canonical models. This is where all provider quirks are isolated:

```typescript
// src/lib/pod/printify/mapper.ts

import type { CanonicalProduct, CanonicalVariant, CanonicalOrder } from '../models'

const USD_TO_EUR = 0.92

/** Transform a raw Printify product API response into our canonical model */
export function toCanonicalProduct(raw: PrintifyRawProduct): CanonicalProduct {
  return {
    externalId: String(raw.id),
    title: String(raw.title || 'Untitled'),
    description: stripHtml(String(raw.description || '')),
    status: raw.visible ? 'active' : 'draft',
    variants: (raw.variants || [])
      .filter(v => v.is_enabled !== false)
      .map(v => toCanonicalVariant(v, raw.images || [])),
    images: deduplicateImages(raw.images || [], String(raw.title || '')),
    printAreas: (raw.print_areas || []).map(toPrintArea),
    blueprintRef: raw.blueprint_id ? `printify:${raw.blueprint_id}:${raw.print_provider_id}` : null,
    tags: raw.tags || [],
    _raw: raw,
  }
}

/** Transform a Printify variant into canonical form */
function toCanonicalVariant(
  v: PrintifyRawVariant,
  images: PrintifyRawImage[]
): CanonicalVariant {
  const { color, size } = parseVariantTitle(String(v.title || ''))
  const costUsd = Number(v.cost || 0)

  // Find matching image by variant_id
  const imageUrl = images.find(img =>
    Array.isArray(img.variant_ids) && img.variant_ids.includes(Number(v.id))
  )?.src || null

  return {
    externalId: String(v.id),
    title: String(v.title || ''),
    size,
    color,
    sku: String(v.sku || ''),
    priceCents: Number(v.price || 0),
    costCents: costUsd > 0 ? Math.round(costUsd * USD_TO_EUR) : null,
    isEnabled: v.is_enabled !== false,
    isAvailable: v.is_available !== false,
    imageUrl,
  }
}

/** Transform a canonical CreateOrderInput into Printify's order format */
export function fromCanonicalOrder(input: CreateOrderInput): PrintifyOrderPayload {
  return {
    external_id: input.internalOrderId,
    label: `Order ${input.internalOrderId.slice(0, 8)}`,
    line_items: input.lineItems.map(item => ({
      product_id: item.productExternalId,
      variant_id: parseInt(item.variantExternalId, 10),
      quantity: item.quantity,
    })),
    shipping_method: 1, // Standard
    send_shipping_notification: !input.isGift,
    address_to: {
      first_name: input.address.firstName,
      last_name: input.address.lastName,
      email: input.address.email,
      phone: input.address.phone,
      country: input.address.country,
      region: input.address.state,
      address1: input.address.address1,
      address2: input.address.address2,
      city: input.address.city,
      zip: input.address.postalCode,
    },
  }
}
```

```typescript
// src/lib/pod/printful/mapper.ts

import type { CanonicalProduct, CanonicalVariant, CanonicalOrder } from '../models'

/** Transform a raw Printful sync product into our canonical model */
export function toCanonicalProduct(raw: PrintfulRawSyncProduct): CanonicalProduct {
  return {
    externalId: String(raw.id),
    title: raw.name,
    description: '', // Printful sync products don't have descriptions (stored on our side)
    status: raw.is_ignored ? 'draft' : 'active',
    variants: (raw.sync_variants || []).map(toCanonicalVariant),
    images: extractImages(raw),
    printAreas: [], // Printful doesn't expose print_areas in sync product response
    blueprintRef: raw.sync_variants?.[0]?.product?.product_id
      ? `printful:${raw.sync_variants[0].product.product_id}`
      : null,
    tags: [],
    _raw: raw,
  }
}

/** Transform a canonical CreateOrderInput into Printful's order format */
export function fromCanonicalOrder(input: CreateOrderInput): PrintfulOrderPayload {
  return {
    external_id: input.internalOrderId,
    recipient: {
      name: `${input.address.firstName} ${input.address.lastName}`,
      email: input.address.email,
      phone: input.address.phone,
      address1: input.address.address1,
      address2: input.address.address2,
      city: input.address.city,
      state_code: input.address.state,
      country_code: input.address.country,
      zip: input.address.postalCode,
    },
    items: input.lineItems.map(item => ({
      sync_variant_id: parseInt(item.variantExternalId, 10),
      quantity: item.quantity,
    })),
    // Printful handles shipping method selection automatically
  }
}
```

### 4.3 Provider Adapter Class

```typescript
// src/lib/pod/printful/index.ts

import type {
  PODProvider,
  CreateProductInput,
  CreateOrderInput,
  DesignUploadInput,
  MockupInput,
  ShippingRateInput,
  NormalizedWebhookEvent,
  HealthCheckResult,
} from '../types'
import { PrintfulClient } from './client'
import * as mapper from './mapper'

export class PrintfulProvider implements PODProvider {
  readonly providerId = 'printful'
  readonly providerName = 'Printful'

  private client: PrintfulClient

  constructor(config: { apiToken: string; storeId?: string }) {
    this.client = new PrintfulClient(config)
  }

  // ---- Health ----
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const store = await this.client.get('/stores')
      return { ok: true, latencyMs: 0, provider: this.providerId }
    } catch (error) {
      return {
        ok: false,
        latencyMs: 0,
        provider: this.providerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ---- Catalog ----
  async getBlueprints(filters?) {
    const raw = await this.client.get('/products')
    return raw.result.map(mapper.toBlueprint)
  }

  async getBlueprintVariants(blueprintId: string) {
    const raw = await this.client.get(`/products/${blueprintId}`)
    return raw.result.variants.map(mapper.toBlueprintVariant)
  }

  async getVariantPricing(variantIds: string[]) {
    // Printful pricing comes with the product/variant data
    // Use catalog endpoint for base costs
    const results: VariantPricing[] = []
    for (const vid of variantIds) {
      const raw = await this.client.get(`/products/variant/${vid}`)
      results.push(mapper.toVariantPricing(raw.result))
    }
    return results
  }

  // ---- Products ----
  async createProduct(input: CreateProductInput) {
    const payload = mapper.fromCanonicalCreateProduct(input)
    const raw = await this.client.post('/sync/products', payload)
    return mapper.toCanonicalProduct(raw.result)
  }

  async getProduct(productId: string) {
    const raw = await this.client.get(`/sync/products/${productId}`)
    return mapper.toCanonicalProduct(raw.result)
  }

  async listProducts(pagination) {
    const raw = await this.client.get(
      `/sync/products?offset=${pagination.offset || 0}&limit=${pagination.limit || 50}`
    )
    return {
      data: raw.result.map(mapper.toCanonicalProduct),
      total: raw.paging.total,
      offset: raw.paging.offset,
      limit: raw.paging.limit,
    }
  }

  async updateProduct(productId: string, input) {
    const payload = mapper.fromCanonicalUpdateProduct(input)
    const raw = await this.client.put(`/sync/products/${productId}`, payload)
    return mapper.toCanonicalProduct(raw.result)
  }

  async deleteProduct(productId: string) {
    await this.client.delete(`/sync/products/${productId}`)
  }

  // publishProduct and confirmPublishing are not needed for Printful
  // (products are auto-published when created)

  // ---- Design / Files ----
  async uploadDesign(input: DesignUploadInput) {
    const payload = input.base64
      ? { type: 'default', file: `data:image/png;base64,${input.base64}` }
      : { type: 'default', url: input.url }
    const raw = await this.client.post('/files', payload)
    return mapper.toUploadedDesign(raw.result)
  }

  async generateMockup(input: MockupInput) {
    const payload = mapper.fromMockupInput(input)
    const raw = await this.client.post('/mockup-tasks', payload)
    return mapper.toMockupResult(raw.result)
  }

  async getMockupStatus(taskId: string) {
    const raw = await this.client.get(`/mockup-tasks/${taskId}`)
    return mapper.toMockupResult(raw.result)
  }

  // ---- Orders ----
  async createOrder(input: CreateOrderInput) {
    const payload = mapper.fromCanonicalOrder(input)
    const raw = await this.client.post('/orders', payload)
    return mapper.toCanonicalOrder(raw.result)
  }

  async submitForProduction(orderId: string) {
    await this.client.post(`/orders/${orderId}/confirm`)
  }

  async cancelOrder(orderId: string) {
    await this.client.delete(`/orders/${orderId}`)
  }

  async getOrder(orderId: string) {
    const raw = await this.client.get(`/orders/${orderId}`)
    return mapper.toCanonicalOrder(raw.result)
  }

  async getShippingRates(input: ShippingRateInput) {
    const payload = mapper.fromShippingRateInput(input)
    const raw = await this.client.post('/shipping/rates', payload)
    return raw.result.map(mapper.toShippingRate)
  }

  // ---- Webhooks ----
  verifyWebhook(body: string, signature: string): boolean {
    return verifyPrintfulWebhook(body, signature, this.client.webhookSecret)
  }

  normalizeEvent(rawEvent: unknown): NormalizedWebhookEvent {
    return mapper.toNormalizedEvent(rawEvent as PrintfulRawWebhookEvent)
  }

  getRegisteredEvents() {
    return [
      'package_shipped',
      'package_returned',
      'order_created',
      'order_updated',
      'order_failed',
      'order_canceled',
      'product_synced',
      'product_updated',
      'product_deleted',
      'stock_updated',
    ]
  }
}
```

### 4.4 Provider Registry and Factory

```typescript
// src/lib/pod/provider-registry.ts

import type { PODProvider } from './types'

class ProviderRegistry {
  private providers = new Map<string, PODProvider>()
  private defaultProviderId: string | null = null

  register(provider: PODProvider): void {
    this.providers.set(provider.providerId, provider)
  }

  setDefault(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider "${providerId}" not registered`)
    }
    this.defaultProviderId = providerId
  }

  get(providerId?: string): PODProvider {
    const id = providerId || this.defaultProviderId
    if (!id) throw new Error('No default provider configured')

    const provider = this.providers.get(id)
    if (!provider) throw new Error(`Provider "${id}" not found`)
    return provider
  }

  /** Get provider for a specific product (enables per-product routing) */
  getForProduct(productProviderId?: string): PODProvider {
    if (productProviderId && this.providers.has(productProviderId)) {
      return this.providers.get(productProviderId)!
    }
    return this.get()
  }

  list(): PODProvider[] {
    return Array.from(this.providers.values())
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId)
  }
}

// Singleton
export const providerRegistry = new ProviderRegistry()
```

```typescript
// src/lib/pod/index.ts

import { providerRegistry } from './provider-registry'
import { PrintifyProvider } from './printify'
import { PrintfulProvider } from './printful'

// Re-export types
export * from './types'
export * from './models/product'
export * from './models/order'
export * from './models/webhook'

// Initialize providers from environment
export function initializeProviders(): void {
  // Register Printful (new primary)
  if (process.env.PRINTFUL_API_TOKEN) {
    const printful = new PrintfulProvider({
      apiToken: process.env.PRINTFUL_API_TOKEN,
      storeId: process.env.PRINTFUL_STORE_ID,
    })
    providerRegistry.register(printful)
  }

  // Register Printify (legacy/fallback)
  if (process.env.PRINTIFY_API_TOKEN) {
    const printify = new PrintifyProvider({
      apiToken: process.env.PRINTIFY_API_TOKEN,
      shopId: process.env.PRINTIFY_SHOP_ID || '',
    })
    providerRegistry.register(printify)
  }

  // Set default provider
  const defaultProvider = process.env.POD_DEFAULT_PROVIDER || 'printful'
  if (providerRegistry.has(defaultProvider)) {
    providerRegistry.setDefault(defaultProvider)
  }
}

/** Get the default POD provider */
export function getProvider(providerId?: string) {
  return providerRegistry.get(providerId)
}

/** Get provider for a specific product */
export function getProviderForProduct(productProviderId?: string) {
  return providerRegistry.getForProduct(productProviderId)
}
```

---

## 5. Webhook Normalization

### 5.1 Normalized Event Types

```typescript
// src/lib/pod/models/webhook.ts

export type WebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.submitted'
  | 'order.in_production'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.failed'
  | 'order.refunded'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'product.publish_started'
  | 'product.publish_succeeded'
  | 'stock.updated'

export interface NormalizedWebhookEvent {
  /** Canonical event type */
  type: WebhookEventType
  /** Provider that sent the event */
  provider: string
  /** Provider's event ID (for deduplication) */
  eventId: string
  /** Resource identifier in the provider's system */
  resourceId: string
  /** Timestamp of the event */
  timestamp: string
  /** Normalized payload */
  data: Record<string, unknown>
  /** Raw provider payload (for debugging) */
  _raw: unknown
}
```

### 5.2 Event Mapping Tables

```typescript
// src/lib/pod/printify/mapper.ts (event normalization section)

const PRINTIFY_EVENT_MAP: Record<string, WebhookEventType> = {
  'order:created':           'order.created',
  'order:shipped':           'order.shipped',
  'order:delivered':         'order.delivered',
  'order:cancelled':         'order.cancelled',
  'order:failed':            'order.failed',
  'product:created':         'product.created',
  'product:updated':         'product.updated',
  'product:deleted':         'product.deleted',
  'product:publish:started': 'product.publish_started',
  'product:publish:succeeded': 'product.publish_succeeded',
}

// src/lib/pod/printful/mapper.ts (event normalization section)

const PRINTFUL_EVENT_MAP: Record<string, WebhookEventType> = {
  'order_created':     'order.created',
  'order_updated':     'order.updated',
  'order_failed':      'order.failed',
  'order_canceled':    'order.cancelled',
  'package_shipped':   'order.shipped',
  'package_returned':  'order.cancelled',
  'product_synced':    'product.created',
  'product_updated':   'product.updated',
  'product_deleted':   'product.deleted',
  'stock_updated':     'stock.updated',
}
```

### 5.3 Unified Webhook Router

```typescript
// src/lib/pod/webhooks/webhook-router.ts

import type { NormalizedWebhookEvent, WebhookEventType } from '../models/webhook'

type WebhookHandler = (event: NormalizedWebhookEvent) => Promise<void>

export class WebhookRouter {
  private handlers = new Map<WebhookEventType, WebhookHandler[]>()

  /** Register a handler for a specific event type */
  on(eventType: WebhookEventType, handler: WebhookHandler): void {
    const existing = this.handlers.get(eventType) || []
    existing.push(handler)
    this.handlers.set(eventType, existing)
  }

  /** Route a normalized event to all registered handlers */
  async route(event: NormalizedWebhookEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || []

    if (handlers.length === 0) {
      console.log(`[webhook-router] No handlers for event type: ${event.type}`)
      return
    }

    // Execute all handlers concurrently (each is independent)
    const results = await Promise.allSettled(
      handlers.map(handler => handler(event))
    )

    // Log any failures
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(
          `[webhook-router] Handler failed for ${event.type}:`,
          result.reason
        )
      }
    }
  }
}
```

### 5.4 Unified Webhook API Route

Replace per-provider webhook routes with a single entry point:

```typescript
// src/app/api/webhooks/pod/[provider]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/pod'
import { webhookRouter } from '@/lib/pod/webhooks/webhook-router'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params
  const body = await req.text()

  // Get the provider adapter
  let provider
  try {
    provider = getProvider(providerId)
  } catch {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  // Verify webhook signature
  const signature = req.headers.get('x-webhook-signature')
    || req.headers.get('x-printify-hmac-sha256')
    || req.headers.get('x-printful-signature')
    || ''

  if (!provider.verifyWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse and normalize the event
  const rawEvent = JSON.parse(body)
  const event = provider.normalizeEvent(rawEvent)

  // Route to handlers
  try {
    await webhookRouter.route(event)
  } catch (error) {
    console.error(`[webhook] Error processing ${event.type}:`, error)
    // Return 200 to prevent provider retries (we handle errors internally)
  }

  return NextResponse.json({ received: true })
}
```

---

## 6. Sync Engine Design

### 6.1 Provider-Agnostic Sync Engine

The sync engine orchestrates the reconciliation between a POD provider and Supabase, using only canonical models:

```typescript
// src/lib/pod/sync/sync-engine.ts

import type { PODProductProvider } from '../types'
import type { CanonicalProduct, CanonicalVariant } from '../models/product'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ConflictResolver } from './conflict-resolver'
import { MarginAuditor } from './margin-auditor'
import { CategoryInferrer } from './category-inferrer'
import { VariantWriter } from './variant-writer'

export interface SyncReport {
  providerTotal: number
  dbTotal: number
  created: number
  updated: number
  deleted: number
  marginFixed: number
  errors: string[]
  startedAt: string
  completedAt: string
  durationMs: number
}

export class ProductSyncEngine {
  private conflictResolver: ConflictResolver
  private marginAuditor: MarginAuditor
  private categoryInferrer: CategoryInferrer
  private variantWriter: VariantWriter

  constructor(
    private provider: PODProductProvider,
    private supabase: SupabaseClient,
    options?: {
      conflictStrategy?: 'provider-wins' | 'admin-wins' | 'newest-wins'
      marginThreshold?: number
    }
  ) {
    this.conflictResolver = new ConflictResolver(
      options?.conflictStrategy || 'newest-wins'
    )
    this.marginAuditor = new MarginAuditor(
      options?.marginThreshold || 0.35
    )
    this.categoryInferrer = new CategoryInferrer(supabase)
    this.variantWriter = new VariantWriter(supabase)
  }

  /** Full reconciliation sync */
  async fullSync(): Promise<SyncReport> {
    const report: SyncReport = {
      providerTotal: 0,
      dbTotal: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      marginFixed: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      completedAt: '',
      durationMs: 0,
    }

    const startTime = Date.now()

    try {
      // 1. Fetch all products from provider (paginated)
      const providerProducts = await this.fetchAllProviderProducts()
      report.providerTotal = providerProducts.length

      // 2. Fetch all products from DB with provider IDs
      const dbProducts = await this.fetchAllDbProducts()
      report.dbTotal = dbProducts.size

      // 3. Reconcile: create/update
      for (const product of providerProducts) {
        const existing = dbProducts.get(product.externalId)

        if (!existing) {
          await this.createProduct(product, report)
        } else {
          await this.updateProduct(product, existing, report)
          dbProducts.delete(product.externalId)
        }
      }

      // 4. Mark orphans as deleted
      for (const [externalId, dbProduct] of dbProducts) {
        if (dbProduct.status !== 'deleted') {
          await this.markDeleted(dbProduct, report)
        }
      }

      // 5. Margin audit
      await this.marginAuditor.auditAll(this.supabase, report)

    } catch (err) {
      report.errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
    }

    report.completedAt = new Date().toISOString()
    report.durationMs = Date.now() - startTime
    return report
  }

  /** Sync a single product (called from webhook handlers) */
  async syncSingle(externalId: string): Promise<void> {
    const product = await this.provider.getProduct(externalId)
    const canonical = product // Already canonical from provider adapter

    const { data: existing } = await this.supabase
      .from('products')
      .select('*')
      .eq('provider_product_id', externalId)
      .single()

    if (existing) {
      const resolved = this.conflictResolver.resolve(canonical, existing)
      await this.upsertProduct(resolved)
    } else {
      await this.upsertProduct(canonical)
    }
  }

  private async fetchAllProviderProducts(): Promise<CanonicalProduct[]> {
    const all: CanonicalProduct[] = []
    let offset = 0
    const limit = 50
    let hasMore = true

    while (hasMore) {
      const page = await this.provider.listProducts({ offset, limit })
      all.push(...page.data)
      offset += limit
      hasMore = page.data.length === limit && offset < 1000 // Safety cap
    }

    return all
  }

  // ... additional private methods for createProduct, updateProduct, etc.
}
```

### 6.2 Conflict Resolution

```typescript
// src/lib/pod/sync/conflict-resolver.ts

import type { CanonicalProduct } from '../models/product'

export type ConflictStrategy = 'provider-wins' | 'admin-wins' | 'newest-wins'

interface DbProduct {
  id: string
  title: string
  description: string
  admin_edited_at: string | null
  last_synced_at: string | null
  [key: string]: unknown
}

export class ConflictResolver {
  constructor(private strategy: ConflictStrategy) {}

  /**
   * Resolve conflicts between provider data and admin-edited DB data.
   *
   * Fields that are ALWAYS synced from provider (regardless of strategy):
   * - status, images, cost_cents, variants
   *
   * Fields subject to conflict resolution:
   * - title, description, tags
   */
  resolve(
    providerData: CanonicalProduct,
    dbRow: DbProduct
  ): Partial<CanonicalProduct> & { _preserveAdminFields: boolean } {

    switch (this.strategy) {
      case 'provider-wins':
        return { ...providerData, _preserveAdminFields: false }

      case 'admin-wins':
        return { ...providerData, _preserveAdminFields: true }

      case 'newest-wins': {
        const adminEditAt = dbRow.admin_edited_at
          ? new Date(dbRow.admin_edited_at)
          : null
        const lastSyncAt = dbRow.last_synced_at
          ? new Date(dbRow.last_synced_at)
          : null

        const preserveAdmin = !!(
          adminEditAt &&
          lastSyncAt &&
          adminEditAt > lastSyncAt
        )

        return { ...providerData, _preserveAdminFields: preserveAdmin }
      }

      default:
        return { ...providerData, _preserveAdminFields: false }
    }
  }
}
```

### 6.3 Idempotent Operations

Every sync operation is designed to be idempotent:

1. **Product upsert**: Uses `ON CONFLICT (provider_product_id) DO UPDATE` -- same product synced twice produces the same result.
2. **Variant upsert**: Uses `ON CONFLICT (product_id, provider_variant_id) DO UPDATE` -- no duplicate variants.
3. **Webhook deduplication**: Store `event_id` in a `webhook_events` table with `UNIQUE(event_id)`. If insert fails with `23505`, the event was already processed.
4. **Order creation**: Idempotency key via `stripe_session_id` -- if the order already exists, skip.

### 6.4 Retry Strategy

```typescript
// src/lib/pod/sync/retry.ts

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
  context?: string
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on 4xx errors (client errors are not transient)
      if (lastError.message.includes('400') || lastError.message.includes('404')) {
        throw lastError
      }

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelayMs
        )
        // Add jitter (+/- 20%)
        const jitter = delay * 0.2 * (Math.random() * 2 - 1)

        console.warn(
          `[retry] ${context || 'operation'} failed (attempt ${attempt + 1}/${config.maxRetries}), ` +
          `retrying in ${Math.round(delay + jitter)}ms: ${lastError.message}`
        )

        await new Promise(resolve => setTimeout(resolve, delay + jitter))
      }
    }
  }

  throw lastError
}
```

---

## 7. Testing Strategy

### 7.1 Mock Provider for Unit Tests

```typescript
// src/lib/pod/testing/mock-provider.ts

import type { PODProvider } from '../types'

/**
 * In-memory POD provider for unit tests.
 * Stores all operations in memory for assertion.
 */
export class MockPODProvider implements PODProvider {
  readonly providerId = 'mock'
  readonly providerName = 'Mock Provider'

  // In-memory stores
  products = new Map<string, CanonicalProduct>()
  orders = new Map<string, CanonicalOrder>()
  uploads = new Map<string, UploadedDesign>()

  // Operation logs (for assertions)
  calls: Array<{ method: string; args: unknown[] }> = []

  // Configurable behavior
  shouldFail = false
  failWithError?: string
  latencyMs = 0

  private async maybeDelay() {
    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs))
    }
  }

  private maybeFail() {
    if (this.shouldFail) {
      throw new Error(this.failWithError || 'Mock provider failure')
    }
  }

  private log(method: string, ...args: unknown[]) {
    this.calls.push({ method, args })
  }

  // ---- Catalog ----
  async getBlueprints() {
    this.log('getBlueprints')
    this.maybeFail()
    return []
  }

  async getBlueprintVariants(blueprintId: string) {
    this.log('getBlueprintVariants', blueprintId)
    return []
  }

  async getVariantPricing(variantIds: string[]) {
    this.log('getVariantPricing', variantIds)
    return []
  }

  // ---- Products ----
  async createProduct(input: CreateProductInput) {
    this.log('createProduct', input)
    await this.maybeDelay()
    this.maybeFail()

    const product: CanonicalProduct = {
      externalId: `mock-${crypto.randomUUID().slice(0, 8)}`,
      title: input.title,
      description: input.description || '',
      status: 'draft',
      variants: [],
      images: [],
      printAreas: [],
      blueprintRef: null,
      tags: input.tags || [],
    }
    this.products.set(product.externalId, product)
    return product
  }

  async getProduct(productId: string) {
    this.log('getProduct', productId)
    const product = this.products.get(productId)
    if (!product) throw new Error(`Product ${productId} not found`)
    return product
  }

  async listProducts(pagination) {
    this.log('listProducts', pagination)
    const all = Array.from(this.products.values())
    const offset = pagination.offset || 0
    const limit = pagination.limit || 50
    return {
      data: all.slice(offset, offset + limit),
      total: all.length,
      offset,
      limit,
    }
  }

  // ... (implement remaining interface methods similarly)

  // ---- Webhooks ----
  verifyWebhook() { return true }

  normalizeEvent(rawEvent: unknown): NormalizedWebhookEvent {
    return rawEvent as NormalizedWebhookEvent
  }

  getRegisteredEvents() { return [] }

  async healthCheck() {
    return { ok: !this.shouldFail, latencyMs: this.latencyMs, provider: this.providerId }
  }

  // ---- Test helpers ----
  reset() {
    this.products.clear()
    this.orders.clear()
    this.uploads.clear()
    this.calls = []
    this.shouldFail = false
    this.failWithError = undefined
    this.latencyMs = 0
  }

  getCallsFor(method: string) {
    return this.calls.filter(c => c.method === method)
  }

  wasCalledWith(method: string, ...args: unknown[]) {
    return this.calls.some(
      c => c.method === method && JSON.stringify(c.args) === JSON.stringify(args)
    )
  }
}
```

### 7.2 Test Patterns

#### Unit Tests (adapter logic)

```typescript
// __tests__/lib/pod/printful/mapper.test.ts

import { toCanonicalProduct, fromCanonicalOrder } from '@/lib/pod/printful/mapper'
import { printfulProductFixture, printfulOrderFixture } from '@/lib/pod/testing/fixtures'

describe('PrintfulMapper', () => {
  describe('toCanonicalProduct', () => {
    it('maps a Printful sync product to canonical format', () => {
      const raw = printfulProductFixture.tshirt
      const result = toCanonicalProduct(raw)

      expect(result.externalId).toBe(String(raw.id))
      expect(result.title).toBe(raw.name)
      expect(result.status).toBe('active')
      expect(result.variants).toHaveLength(raw.sync_variants.length)
    })

    it('maps ignored products to draft status', () => {
      const raw = { ...printfulProductFixture.tshirt, is_ignored: true }
      const result = toCanonicalProduct(raw)
      expect(result.status).toBe('draft')
    })
  })

  describe('fromCanonicalOrder', () => {
    it('transforms canonical address to Printful recipient format', () => {
      const input = {
        internalOrderId: 'order-123',
        lineItems: [{ productExternalId: 'p1', variantExternalId: '42', quantity: 1 }],
        address: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          address1: '123 Main St',
          city: 'Berlin',
          state: 'BE',
          postalCode: '10115',
          country: 'DE',
        },
      }

      const result = fromCanonicalOrder(input)
      expect(result.recipient.name).toBe('John Doe')
      expect(result.recipient.country_code).toBe('DE')
      expect(result.items[0].sync_variant_id).toBe(42)
    })
  })
})
```

#### Integration Tests (sync engine with mock)

```typescript
// __tests__/lib/pod/sync/sync-engine.test.ts

import { ProductSyncEngine } from '@/lib/pod/sync/sync-engine'
import { MockPODProvider } from '@/lib/pod/testing/mock-provider'
import { createMockSupabase } from '@/lib/pod/testing/mock-supabase'

describe('ProductSyncEngine', () => {
  let provider: MockPODProvider
  let supabase: ReturnType<typeof createMockSupabase>
  let engine: ProductSyncEngine

  beforeEach(() => {
    provider = new MockPODProvider()
    supabase = createMockSupabase()
    engine = new ProductSyncEngine(provider, supabase as any)
  })

  it('creates products that exist in provider but not in DB', async () => {
    // Arrange: provider has a product, DB is empty
    provider.products.set('ext-1', {
      externalId: 'ext-1',
      title: 'Test T-Shirt',
      status: 'active',
      variants: [],
      images: [],
      printAreas: [],
      blueprintRef: null,
      tags: [],
      description: '',
    })
    supabase.mockDbProducts([]) // empty DB

    // Act
    const report = await engine.fullSync()

    // Assert
    expect(report.created).toBe(1)
    expect(report.updated).toBe(0)
    expect(report.deleted).toBe(0)
  })

  it('marks DB-only products as deleted', async () => {
    // Provider has no products, DB has one
    supabase.mockDbProducts([
      { id: 'db-1', provider_product_id: 'ext-old', status: 'active' }
    ])

    const report = await engine.fullSync()

    expect(report.deleted).toBe(1)
  })

  it('handles provider API failure gracefully', async () => {
    provider.shouldFail = true
    provider.failWithError = 'API rate limit exceeded'

    const report = await engine.fullSync()

    expect(report.errors.length).toBeGreaterThan(0)
    expect(report.errors[0]).toContain('rate limit')
  })
})
```

#### Contract Tests (adapter fidelity)

Contract tests verify that each adapter correctly transforms provider-specific data into canonical models. They use recorded API responses (fixtures) to ensure the mapper handles all edge cases:

```typescript
// __tests__/lib/pod/contracts/product-contract.test.ts

import { toCanonicalProduct as printifyMap } from '@/lib/pod/printify/mapper'
import { toCanonicalProduct as printfulMap } from '@/lib/pod/printful/mapper'
import { printifyFixtures } from '@/lib/pod/testing/fixtures/printify'
import { printfulFixtures } from '@/lib/pod/testing/fixtures/printful'

/**
 * Contract test: Both adapters must produce valid CanonicalProduct objects
 * with the same shape, regardless of provider-specific quirks.
 */
describe('Product Contract', () => {
  const cases = [
    { name: 'Printify', map: printifyMap, fixture: printifyFixtures.product },
    { name: 'Printful', map: printfulMap, fixture: printfulFixtures.syncProduct },
  ]

  for (const { name, map, fixture } of cases) {
    describe(name, () => {
      it('produces a valid CanonicalProduct', () => {
        const result = map(fixture)

        // Shape assertions
        expect(typeof result.externalId).toBe('string')
        expect(result.externalId.length).toBeGreaterThan(0)
        expect(typeof result.title).toBe('string')
        expect(['draft', 'active', 'publishing', 'deleted']).toContain(result.status)
        expect(Array.isArray(result.variants)).toBe(true)
        expect(Array.isArray(result.images)).toBe(true)
      })

      it('produces variants with valid structure', () => {
        const result = map(fixture)

        for (const variant of result.variants) {
          expect(typeof variant.externalId).toBe('string')
          expect(typeof variant.priceCents).toBe('number')
          expect(typeof variant.isEnabled).toBe('boolean')
        }
      })
    })
  }
})
```

---

## 8. Migration Path

### Phase 1: Abstraction Layer (No Provider Change)

**Goal**: Extract all Printify-specific code behind the provider interfaces without changing behavior.

1. Create `src/lib/pod/` directory structure.
2. Define canonical types in `src/lib/pod/types.ts` and `src/lib/pod/models/`.
3. Move `printify.ts` -> `src/lib/pod/printify/client.ts` (rename, keep identical logic).
4. Create `src/lib/pod/printify/mapper.ts` extracting transform logic from `printify-sync.ts`.
5. Create `PrintifyProvider` class that implements `PODProvider` by wrapping the existing client + mapper.
6. Create `provider-registry.ts` and `index.ts` with factory.
7. Update all 15 consumer files to import from `@/lib/pod` instead of `@/lib/printify`.
8. **Keep all existing tests passing.** This phase should be a pure refactor.

Estimated diff: ~2,000 lines changed, zero behavior change.

### Phase 2: Printful Adapter

**Goal**: Implement the Printful adapter behind the same interfaces.

1. Create `src/lib/pod/printful/client.ts` -- HTTP client with OAuth token refresh.
2. Create `src/lib/pod/printful/mapper.ts` -- Printful API <-> canonical model transforms.
3. Create `src/lib/pod/printful/index.ts` -- `PrintfulProvider implements PODProvider`.
4. Add Printful webhook verification.
5. Write contract tests ensuring both adapters produce valid canonical models.
6. Deploy with `POD_DEFAULT_PROVIDER=printify` (no change in production behavior).

### Phase 3: Dual-Provider Testing

**Goal**: Run both providers in parallel, compare results.

1. Add a `products.provider_id` column to Supabase (default: `'printify'`).
2. Create a few test products in Printful.
3. Run sync engine against both providers, log differences.
4. Verify webhook handling works for both providers simultaneously.
5. Test order creation with Printful test products.

### Phase 4: Gradual Migration

**Goal**: Migrate products from Printify to Printful incrementally.

1. Switch `POD_DEFAULT_PROVIDER=printful` for **new product creation**.
2. Existing Printify products continue to work (provider lookup is per-product).
3. Migrate high-volume products first (re-create in Printful, update `provider_product_id`).
4. Update the cron sync to run against both providers (one sync engine per provider).
5. Webhook routes accept events from both providers (unified `/api/webhooks/pod/[provider]`).

### Phase 5: Printify Deprecation

**Goal**: Remove Printify as the active provider.

1. All products migrated to Printful.
2. Printify webhook route removed.
3. Printify cron sync disabled.
4. Printify adapter code kept in repository (for reference, not imported at runtime).
5. `POD_DEFAULT_PROVIDER=printful` is the only configured provider.

### Database Schema Changes

```sql
-- Phase 3: Add provider tracking
ALTER TABLE products ADD COLUMN pod_provider TEXT DEFAULT 'printify';
ALTER TABLE products ADD COLUMN provider_product_id TEXT;

-- Backfill from printify_id
UPDATE products SET provider_product_id = printify_id WHERE printify_id IS NOT NULL;

-- Add index
CREATE INDEX idx_products_provider ON products(pod_provider, provider_product_id);

-- Phase 5: Drop Printify columns
-- ALTER TABLE products DROP COLUMN printify_id;
-- ALTER TABLE products DROP COLUMN blueprint_id;
-- ALTER TABLE products DROP COLUMN print_provider_id;
```

---

## 9. Code Examples

### 9.1 Refactored Checkout (Provider-Agnostic)

Before (current code, Printify-coupled):
```typescript
// Direct Printify calls scattered through checkout
const tempProduct = await printify.createProduct({ ... })
const uploadResult = await printify.uploadImageFromBase64(base64, fileName)
const printifyOrder = await printify.createOrder({ ... })
await printify.submitOrderForProduction(printifyOrder.id)
```

After (abstraction layer):
```typescript
import { getProviderForProduct } from '@/lib/pod'

// Checkout creates temp product via provider abstraction
const provider = getProviderForProduct(dbProduct.podProvider)
const uploadResult = await provider.uploadDesign({
  base64: base64PNG,
  fileName: `personalization-${personalizationId}.png`,
})
const tempProduct = await provider.createProduct({
  title: `${dbProduct.title} (Personalized)`,
  description: `Personalized: ${text}`,
  blueprintRef: dbProduct.blueprintRef,
  variants: enabledVariants,
  printAreas: modifiedPrintAreas,
  tags: ['personalized'],
})

// Order creation via provider abstraction
const order = await provider.createOrder({
  internalOrderId: dbOrder.id,
  lineItems: printifyLineItems,
  address: canonicalAddress,
  isGift: !!giftMessage,
})
await provider.submitForProduction(order.externalId)
```

### 9.2 Refactored Cron Sync (Provider-Agnostic)

Before:
```typescript
import { printify } from '@/lib/printify'
import { syncProductFromPrintify } from '@/lib/printify-sync'

// Fetch from Printify
const result = await printify.listProducts(page, 50)
// Sync each product with Printify-specific logic
await syncProductFromPrintify(printifyProduct, supabase)
```

After:
```typescript
import { getProvider } from '@/lib/pod'
import { ProductSyncEngine } from '@/lib/pod/sync/sync-engine'

const provider = getProvider() // Uses POD_DEFAULT_PROVIDER
const engine = new ProductSyncEngine(provider, supabaseAdmin, {
  conflictStrategy: 'newest-wins',
  marginThreshold: 0.35,
})
const report = await engine.fullSync()
```

### 9.3 Refactored Webhook (Provider-Agnostic)

Before:
```typescript
// src/app/api/webhooks/printify/route.ts
// 667 lines of Printify-specific webhook handling
```

After:
```typescript
// src/app/api/webhooks/pod/[provider]/route.ts
// 30 lines -- verification + normalization + routing

// Business logic in handler files:
// src/lib/pod/webhooks/handlers/order-shipped.ts
export async function handleOrderShipped(event: NormalizedWebhookEvent) {
  const orderId = event.data.orderId as string
  const shipments = event.data.shipments as CanonicalShipment[]

  // Update order status (same logic regardless of provider)
  await supabase.from('orders').update({
    status: 'shipped',
    shipped_at: event.timestamp,
    tracking_number: shipments[0]?.trackingNumber,
    tracking_url: shipments[0]?.trackingUrl,
    carrier: shipments[0]?.carrier,
  }).eq('printify_order_id', orderId)

  // Send notification, email, audit log...
}
```

---

## 10. References

### Architecture Patterns

- [Medusa.js Fulfillment Module Provider](https://docs.medusajs.com/resources/references/fulfillment/provider) -- TypeScript abstract class pattern with method contracts for creating custom fulfillment providers.
- [Medusa.js Fulfillment Architecture Overview](https://docs.medusajs.com/v1/modules/orders/fulfillments) -- Multi-provider fulfillment lifecycle (order -> fulfillment -> shipment).
- [Shopify Fulfillment Orders API](https://www.shopify.com/partners/blog/shopify-fulfillment-orders-api) -- Callback-based fulfillment service integration pattern for multi-provider workflows.
- [Shopify Fulfillment Service API](https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps) -- How to build apps that act as fulfillment services with standardized endpoints.
- [Saleor Commerce Extensibility](https://docs.saleor.io/overview/why-saleor/extensibility) -- GraphQL-native, app-based extension model where each commerce function is delegated to independent apps.

### Design Patterns

- [Adapter Pattern for Vendor Integrations (Bocoup)](https://www.bocoup.com/blog/adapter-pattern-a-must-for-vendor-service-integrations) -- Why adapters are essential for third-party API integrations, with TypeScript examples.
- [Adapter Pattern in TypeScript (Refactoring Guru)](https://refactoring.guru/design-patterns/adapter/typescript/example) -- Classic GoF Adapter pattern adapted for TypeScript with class and object adapter variants.
- [Adapter Design Pattern for Third-Party Integrations (Medium)](https://medium.com/@olorondu_emeka/adapter-design-pattern-a-guide-to-manage-multiple-third-party-integrations-dc342f435daf) -- Multi-provider payment processing example with clean interface segregation.

### Webhook Architecture

- [Webhook Design Patterns (dave.dev)](https://dave.dev/blog/2022/11/01-11-2022-webhook-architecture/) -- Event normalization, anti-corruption layers, and idempotency patterns.
- [Webhook Infrastructure Requirements (Hookdeck)](https://hookdeck.com/webhooks/guides/webhook-infrastructure-requirements-and-architecture) -- Centralized webhook management for multi-provider systems.
- [Webhooks Done Right (Prospa)](https://medium.com/prospa-technology/webhooks-done-right-676d4e74578a) -- Security, idempotency, and retry best practices.

### Printful API

- [Printful API Documentation (v1)](https://developers.printful.com/docs/) -- REST API with OAuth/token auth, 120 req/min rate limit, endpoints for catalog, orders, files, mockups, webhooks.
- [Printful API v2 Beta Documentation](https://developers.printful.com/docs/v2-beta/) -- v2 endpoints under `/v2` prefix, improved order creation, async mockup generation.
- [Printful SDK for Node.js (v2)](https://github.com/spencerlepine/printful-sdk-js-v2) -- Community TypeScript SDK for Printful API v2 (not officially maintained by Printful).

### Printify vs Printful

- [Printful vs Printify Comparison (PODbase, 2026)](https://www.podbase.com/blogs/printful-vs-printify) -- Pricing, quality, fulfillment speed, and API capability comparison. Notes the planned merger between Printful and Printify.

---

## Appendix: Checklist

### Phase 1 Completion Criteria

- [ ] `src/lib/pod/types.ts` defines all 5 segregated interfaces + composite
- [ ] `src/lib/pod/models/` has all canonical types
- [ ] `src/lib/pod/printify/` adapter passes all existing tests
- [ ] `src/lib/pod/index.ts` exports factory + types
- [ ] All 15 consumer files import from `@/lib/pod` (no direct printify imports)
- [ ] Zero behavior change in production
- [ ] Build succeeds, all tests pass

### Phase 2 Completion Criteria

- [ ] `src/lib/pod/printful/` adapter implements full `PODProvider`
- [ ] Contract tests pass for both adapters
- [ ] Printful health check works with real credentials
- [ ] Printful webhook verification works
- [ ] Can create a test product in Printful via the adapter

### Phase 3 Completion Criteria

- [ ] `products.pod_provider` column added with migration
- [ ] Sync engine runs against both providers
- [ ] Webhook routes accept events from both
- [ ] Order creation works with Printful products
- [ ] No regressions on existing Printify products
