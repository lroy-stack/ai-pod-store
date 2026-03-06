/**
 * PrintifyProvider — implements PODProvider by wrapping PrintifyClient.
 */

import { PrintifyClient } from './client'
import * as mapper from './mapper'
import { verifyPrintifyWebhook } from './webhook-verifier'
import { PRINTIFY_MAX_PAGE_SIZE, PRINTIFY_WEBHOOK_EVENTS } from './constants'
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

export interface PrintifyProviderConfig {
  apiToken: string
  shopId: string
  webhookSecret?: string
}

export class PrintifyProvider implements PODProvider {
  readonly providerId = 'printify'
  readonly providerName = 'Printify'

  private client: PrintifyClient
  private webhookSecret: string

  constructor(config: PrintifyProviderConfig) {
    this.client = new PrintifyClient(config.apiToken, config.shopId)
    this.webhookSecret = config.webhookSecret || ''
  }

  // ─── Catalog ─────────────────────────────────────────

  async getBlueprints(_filters?: CatalogFilters): Promise<Blueprint[]> {
    const raw = await this.client.getBlueprints()
    return raw.map(b => mapper.toBlueprint(b as unknown as Record<string, unknown>))
  }

  async getBlueprintVariants(blueprintId: string): Promise<BlueprintVariant[]> {
    // blueprintId format: "{bpId}:{providerId}" or just "{bpId}"
    const parts = blueprintId.split(':')
    const bpId = parseInt(parts[0], 10)
    const pvId = parts[1] ? parseInt(parts[1], 10) : 26 // default provider
    const raw = await this.client.getVariants(bpId, pvId)
    return (raw.variants || []).map(v => mapper.toBlueprintVariant(v as unknown as Record<string, unknown>))
  }

  async getVariantPricing(_variantIds: string[]): Promise<VariantPricing[]> {
    // Printify does not have a dedicated pricing endpoint; cost comes from variants
    return []
  }

  // ─── Products ────────────────────────────────────────

  async createProduct(input: CreateProductInput): Promise<CanonicalProduct> {
    const body = mapper.fromCreateProductInput(input)
    const result = await this.client.createProduct(body)
    // Fetch full product to get all data (createProduct only returns {id})
    const full = await this.client.getProduct(result.id)
    return mapper.toCanonicalProduct(full)
  }

  async getProduct(productId: string): Promise<CanonicalProduct> {
    const raw = await this.client.getProduct(productId)
    return mapper.toCanonicalProduct(raw)
  }

  async listProducts(pagination: PaginationInput): Promise<PaginatedResult<CanonicalProduct>> {
    const limit = Math.min(pagination.limit || PRINTIFY_MAX_PAGE_SIZE, PRINTIFY_MAX_PAGE_SIZE)
    const offset = pagination.offset || 0
    const page = Math.floor(offset / limit) + 1

    const result = await this.client.listProducts(page, limit)
    return {
      data: result.data.map(p => mapper.toCanonicalProduct(p)),
      total: result.total,
      offset: (result.current_page - 1) * limit,
      limit,
    }
  }

  async updateProduct(productId: string, _input: UpdateProductInput): Promise<CanonicalProduct> {
    // Printify doesn't have a dedicated update method in our client — use getProduct for now
    // In practice, consumers call specific endpoints. This is a placeholder.
    const raw = await this.client.getProduct(productId)
    return mapper.toCanonicalProduct(raw)
  }

  async deleteProduct(productId: string): Promise<void> {
    await this.client.deleteProduct(productId)
  }

  async publishProduct(productId: string): Promise<void> {
    await this.client.publishProduct(productId)
  }

  async confirmPublishing(productId: string, externalId: string, handle?: string): Promise<void> {
    await this.client.publishingSucceeded(productId, externalId, handle)
  }

  async reportPublishingFailed(productId: string, reason?: string): Promise<void> {
    await this.client.publishingFailed(productId, reason)
  }

  // ─── Designs ─────────────────────────────────────────

  async uploadDesign(input: DesignUploadInput): Promise<UploadedDesign> {
    let raw: { id: string; file_name: string; preview_url: string }
    if (input.base64) {
      raw = await this.client.uploadImageFromBase64(input.base64, input.fileName)
    } else if (input.url) {
      raw = await this.client.uploadImage(input.url, input.fileName)
    } else {
      throw new Error('DesignUploadInput must have either url or base64')
    }
    return mapper.toUploadedDesign(raw as unknown as Record<string, unknown>)
  }

  async generateMockup(_input: MockupInput): Promise<MockupResult> {
    // Printify generates mockups automatically when print_areas are set
    return {
      taskId: null,
      mockupsByVariant: {},
      status: 'completed',
    }
  }

  // ─── Orders ──────────────────────────────────────────

  async createOrder(input: CreateOrderInput): Promise<CanonicalOrder> {
    const body = mapper.fromCreateOrderInput(input)
    const raw = await this.client.createOrder(body as any)
    return mapper.toCanonicalOrder(raw as unknown as Record<string, unknown>)
  }

  async submitForProduction(orderId: string): Promise<void> {
    await this.client.submitOrderForProduction(orderId)
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.client.cancelOrder(orderId)
  }

  async getOrder(orderId: string): Promise<CanonicalOrder> {
    const raw = await this.client.getOrder(orderId)
    return mapper.toCanonicalOrder(raw as unknown as Record<string, unknown>)
  }

  async getShippingRates(input: ShippingRateInput): Promise<ShippingRate[]> {
    const lineItems = input.lineItems.map(li => ({
      product_id: li.productExternalId,
      variant_id: parseInt(li.variantExternalId, 10),
      quantity: li.quantity,
    }))
    const address = {
      country: input.address.country,
      region: input.address.state,
      city: input.address.city,
      zip: input.address.postalCode,
    }
    const raw = await this.client.calculateShipping(lineItems, address)
    return raw.map(r => mapper.toShippingRate(r as unknown as Record<string, unknown>))
  }

  // ─── Webhooks ────────────────────────────────────────

  verifyWebhook(rawBody: string, signature: string): boolean {
    return verifyPrintifyWebhook(rawBody, signature, this.webhookSecret)
  }

  normalizeEvent(rawEvent: unknown): NormalizedWebhookEvent {
    return mapper.toNormalizedWebhookEvent(rawEvent)
  }

  getRegisteredEvents(): string[] {
    return [...PRINTIFY_WEBHOOK_EVENTS]
  }

  // ─── Health ──────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      await this.client.getShop()
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
