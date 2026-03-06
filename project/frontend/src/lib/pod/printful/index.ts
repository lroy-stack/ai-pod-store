/**
 * PrintfulProvider — implements PODProvider by wrapping PrintfulClient.
 *
 * Key differences from PrintifyProvider:
 * - publishProduct/confirmPublishing/reportPublishingFailed are no-ops (Printful auto-publishes)
 * - createOrder uses ?confirm=true (creates + confirms in one call)
 * - cancelOrder uses DELETE (not POST)
 * - uploadDesign supports both URL and base64
 * - generateMockup creates async task + poll via getMockupStatus
 */

import { PrintfulClient } from './client'
import type { PrintfulMockupTaskResult } from './client'
import * as mapper from './mapper'
import { verifyPrintfulWebhook } from './webhook-verifier'
import { PRINTFUL_WEBHOOK_EVENTS } from './constants'
import type {
  PODProvider,
  PaginationInput,
  PaginatedResult,
  CreateProductInput,
  UpdateProductInput,
  CreateOrderInput,
  HealthCheckResult,
} from '../types'
import type {
  CanonicalProduct,
  CanonicalOrder,
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
} from '../models'

export interface PrintfulProviderConfig {
  apiToken: string
  storeId?: string
  tokenExpiresAt?: Date
  webhookSecret?: string
}

export class PrintfulProvider implements PODProvider {
  readonly providerId = 'printful'
  readonly providerName = 'Printful'

  private client: PrintfulClient
  private webhookSecret: string

  constructor(config: PrintfulProviderConfig) {
    this.client = new PrintfulClient({
      apiToken: config.apiToken,
      storeId: config.storeId,
      tokenExpiresAt: config.tokenExpiresAt,
    })
    this.webhookSecret = config.webhookSecret || ''
  }

  // ─── Catalog ─────────────────────────────────────────────

  async getBlueprints(_filters?: CatalogFilters): Promise<Blueprint[]> {
    const raw = await this.client.getCatalogProducts()
    return raw.map(b => mapper.toBlueprint(b))
  }

  async getBlueprintVariants(blueprintId: string): Promise<BlueprintVariant[]> {
    const raw = await this.client.getCatalogProduct(blueprintId)
    const variants = ((raw as Record<string, unknown>).variants || []) as Array<
      Record<string, unknown>
    >
    return variants.map(v => mapper.toBlueprintVariant(v))
  }

  async getVariantPricing(_variantIds: string[]): Promise<VariantPricing[]> {
    // Printful pricing comes from catalog variant lookup, not a dedicated endpoint
    return []
  }

  // ─── Products ────────────────────────────────────────────

  async createProduct(input: CreateProductInput): Promise<CanonicalProduct> {
    const body = mapper.fromCreateProductInput(input)
    const raw = await this.client.createSyncProduct(body)
    return mapper.toCanonicalProduct(raw)
  }

  async getProduct(productId: string): Promise<CanonicalProduct> {
    const raw = await this.client.getSyncProduct(productId)
    return mapper.toCanonicalProduct(raw)
  }

  async listProducts(pagination: PaginationInput): Promise<PaginatedResult<CanonicalProduct>> {
    const limit = Math.min(pagination.limit || 100, 100)
    const offset = pagination.offset || 0
    const result = await this.client.listSyncProducts(offset, limit)
    return {
      data: result.items.map(p => mapper.toCanonicalProduct(p)),
      total: result.total,
      offset: result.offset,
      limit: result.limit,
    }
  }

  async updateProduct(productId: string, _input: UpdateProductInput): Promise<CanonicalProduct> {
    // Printful doesn't have a dedicated partial-update endpoint for sync products.
    // Consumers should use createSyncProduct to replace. Return current state.
    const raw = await this.client.getSyncProduct(productId)
    return mapper.toCanonicalProduct(raw)
  }

  async deleteProduct(productId: string): Promise<void> {
    await this.client.deleteSyncProduct(productId)
  }

  // Printful auto-publishes — these are no-ops (optional on PODProductProvider)
  async publishProduct(_productId: string): Promise<void> {
    return
  }

  async confirmPublishing(
    _productId: string,
    _externalId: string,
    _handle?: string,
  ): Promise<void> {
    return
  }

  async reportPublishingFailed(_productId: string, _reason?: string): Promise<void> {
    return
  }

  // ─── Designs ─────────────────────────────────────────────

  async uploadDesign(input: DesignUploadInput): Promise<UploadedDesign> {
    if (!input.url) {
      throw new Error('DesignUploadInput must have url — Printful API only accepts URL-based uploads')
    }
    const body: Record<string, unknown> = {
      url: input.url,
      filename: input.fileName,
    }
    const raw = await this.client.createFile(body)
    return mapper.toUploadedDesign(raw)
  }

  async generateMockup(input: MockupInput): Promise<MockupResult> {
    try {
      const result = await this.client.createMockupTask(input.productExternalId, {
        variant_ids: input.variantIds?.map(Number) || [],
      })
      return {
        taskId: result.taskKey,
        mockupsByVariant: {},
        status: 'pending',
      }
    } catch {
      return {
        taskId: null,
        mockupsByVariant: {},
        status: 'failed',
        error: 'Mockup generation failed',
      }
    }
  }

  async getMockupStatus(taskId: string): Promise<MockupResult> {
    const result: PrintfulMockupTaskResult = await this.client.getMockupTask(taskId)

    if (result.status === 'completed') {
      // VERIFIED: Printful returns ONE mockup object PER PLACEMENT.
      // Each has: { placement: "front"|"back"|"sleeve_left", mockup_url, variant_ids }
      // extra[] is always empty for Ghost mockups.
      const PLACEMENT_TO_VIEW: Record<string, string> = {
        front: 'front',
        back: 'back',
        sleeve_left: 'left',
      }
      const mockups: Record<string, string> = {}
      for (const m of result.mockups || []) {
        if (!m.mockup_url || !m.placement) continue
        const variantKey = m.variant_ids?.[0] ? String(m.variant_ids[0]) : 'unknown'
        const view = PLACEMENT_TO_VIEW[m.placement] || m.placement
        mockups[`${variantKey}:${view}`] = m.mockup_url
      }
      return { taskId, mockupsByVariant: mockups, status: 'completed' }
    }

    if (result.status === 'failed') {
      return {
        taskId,
        mockupsByVariant: {},
        status: 'failed',
        error: String(result.error || 'Unknown'),
      }
    }

    return { taskId, mockupsByVariant: {}, status: 'pending' }
  }

  // ─── Orders ──────────────────────────────────────────────

  async createOrder(input: CreateOrderInput): Promise<CanonicalOrder> {
    const body = mapper.fromCreateOrderInput(input)
    // Use ?confirm=true to skip draft state
    const raw = await this.client.createOrder(body, true)
    return mapper.toCanonicalOrder(raw)
  }

  async submitForProduction(orderId: string): Promise<void> {
    await this.client.confirmOrder(orderId)
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.client.cancelOrder(orderId)
  }

  async getOrder(orderId: string): Promise<CanonicalOrder> {
    const raw = await this.client.getOrder(orderId)
    return mapper.toCanonicalOrder(raw)
  }

  async getShippingRates(input: ShippingRateInput): Promise<ShippingRate[]> {
    const body = {
      recipient: {
        country_code: input.address.country,
        state_code: input.address.state || undefined,
        city: input.address.city || undefined,
        zip: input.address.postalCode || undefined,
      },
      items: input.lineItems.map(li => ({
        variant_id: parseInt(li.variantExternalId, 10),
        quantity: li.quantity,
      })),
      currency: 'EUR',
      locale: 'en_US',
    }
    const raw = await this.client.getShippingRates(body)
    return raw.map(r => mapper.toShippingRate(r))
  }

  // ─── Webhooks ────────────────────────────────────────────

  /**
   * Verify a Printful webhook request.
   * Printful uses a query-string secret (not HMAC), so `signature` here
   * is the `?secret=` query parameter value, and `rawBody` is unused.
   */
  verifyWebhook(rawBody: string, signature: string): boolean {
    return verifyPrintfulWebhook(rawBody, signature, this.webhookSecret)
  }

  normalizeEvent(rawEvent: unknown): NormalizedWebhookEvent {
    return mapper.toNormalizedWebhookEvent(rawEvent)
  }

  getRegisteredEvents(): string[] {
    return PRINTFUL_WEBHOOK_EVENTS
  }

  // ─── Health ──────────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      await this.client.getStore()
      return {
        ok: true,
        latencyMs: Date.now() - start,
        provider: this.providerId,
      }
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        provider: this.providerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
