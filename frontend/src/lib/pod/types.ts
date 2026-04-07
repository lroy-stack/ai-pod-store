/**
 * POD Provider interfaces — Interface Segregation Principle (ISP).
 * Each interface represents a single responsibility area.
 * Providers implement all 5 via the composite PODProvider.
 */

import type {
  CanonicalProduct,
  CanonicalOrder,
  CanonicalAddress,
  Blueprint,
  BlueprintVariant,
  VariantPricing,
  CatalogFilters,
  DesignUploadInput,
  UploadedDesign,
  MockupInput,
  MockupResult,
  ShippingRateInput,
  ShippingRate,
  NormalizedWebhookEvent,
} from './models'

// ─── Pagination ──────────────────────────────────────────────

export interface PaginationInput {
  offset?: number
  limit?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  offset: number
  limit: number
}

// ─── Product Input Types ─────────────────────────────────────

export interface CreateProductInput {
  title: string
  description?: string
  /** Printify blueprint ID (number). Printful uses catalogProductId in blueprintRef. */
  blueprintId?: number
  /** Printify print provider ID (number). Not used by Printful. */
  printProviderId?: number
  variants: CreateVariantInput[]
  printAreas: PrintAreaInput[]
  tags?: string[]
}

export interface CreateVariantInput {
  /** Provider variant ID (number for Printify, string for Printful) */
  variantId: string | number
  /** Retail price in EUR cents */
  priceCents: number
  isEnabled?: boolean
}

export interface PrintAreaInput {
  position: string
  images: Array<{
    id: string
    x: number
    y: number
    scale: number
    angle: number
  }>
}

export interface UpdateProductInput {
  title?: string
  description?: string
  variants?: CreateVariantInput[]
  tags?: string[]
}

// ─── Order Input Types ───────────────────────────────────────

export interface CreateOrderInput {
  /** Internal (Supabase) order ID — stored as external_id in Printify, external_id in Printful */
  internalOrderId: string
  label?: string
  lineItems: CreateOrderLineItem[]
  shippingAddress: CanonicalAddress
  suppressShippingNotification?: boolean
  isGift?: boolean
  giftMessage?: string
}

export interface CreateOrderLineItem {
  productExternalId: string
  variantExternalId: string
  quantity: number
  /** Custom print files per placement (overrides sync product files) */
  files?: Array<{ type: string; url: string }>
}

// ─── Health Check ────────────────────────────────────────────

export interface HealthCheckResult {
  ok: boolean
  latencyMs: number
  provider: string
  error?: string
}

// ─── Provider Interfaces (ISP) ───────────────────────────────

export interface PODCatalogProvider {
  getBlueprints(_filters?: CatalogFilters): Promise<Blueprint[]>
  getBlueprintVariants(_blueprintId: string): Promise<BlueprintVariant[]>
  getVariantPricing(_variantIds: string[]): Promise<VariantPricing[]>
}

export interface PODProductProvider {
  createProduct(_input: CreateProductInput): Promise<CanonicalProduct>
  getProduct(_productId: string): Promise<CanonicalProduct>
  listProducts(_pagination: PaginationInput): Promise<PaginatedResult<CanonicalProduct>>
  updateProduct(_productId: string, _input: UpdateProductInput): Promise<CanonicalProduct>
  deleteProduct(_productId: string): Promise<void>
  /** Printify-only: publish to sales channel. Throws PODUnsupportedOperationError for Printful. */
  publishProduct?(_productId: string): Promise<void>
  /** Printify-only: confirm successful publishing. Throws PODUnsupportedOperationError for Printful. */
  confirmPublishing?(_productId: string, _externalId: string, _handle?: string): Promise<void>
  /** Printify-only: report publishing failure. Throws PODUnsupportedOperationError for Printful. */
  reportPublishingFailed?(_productId: string, _reason?: string): Promise<void>
}

export interface PODDesignProvider {
  uploadDesign(_input: DesignUploadInput): Promise<UploadedDesign>
  generateMockup(_input: MockupInput): Promise<MockupResult>
  /** Printful-only: poll async mockup task. Returns null for Printify (sync mockups). */
  getMockupStatus?(_taskId: string): Promise<MockupResult>
}

export interface PODOrderProvider {
  createOrder(_input: CreateOrderInput): Promise<CanonicalOrder>
  submitForProduction(_orderId: string): Promise<void>
  cancelOrder(_orderId: string): Promise<void>
  getOrder(_orderId: string): Promise<CanonicalOrder>
  getShippingRates(_input: ShippingRateInput): Promise<ShippingRate[]>
}

export interface PODWebhookProvider {
  verifyWebhook(_rawBody: string, _signature: string): boolean
  normalizeEvent(_rawEvent: unknown): NormalizedWebhookEvent
  getRegisteredEvents(): string[]
}

// ─── Composite Provider ──────────────────────────────────────

export interface PODProvider
  extends PODCatalogProvider,
    PODProductProvider,
    PODDesignProvider,
    PODOrderProvider,
    PODWebhookProvider {
  readonly providerId: string
  readonly providerName: string
  healthCheck(): Promise<HealthCheckResult>
}
