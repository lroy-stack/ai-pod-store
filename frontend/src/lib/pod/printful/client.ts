/**
 * Printful API Client — HTTP transport layer.
 *
 * Key differences from Printify:
 * - Response envelope: ALL responses are { code, result, paging? } — always unwrap .result
 * - Rate limiter: Token bucket, 120 req/min
 * - Cache: Map + TTL for catalog GET endpoints (/products prefix)
 * - Retry: 429 respects Retry-After, 5xx retries with backoff
 * - Headers: Authorization: Bearer + optional X-PF-Store-Id
 */

import {
  PRINTFUL_API_BASE,
  PRINTFUL_CATALOG_TTL_MS,
  PRINTFUL_RATE_LIMIT_PER_MIN,
  PRINTFUL_RATE_LIMIT_WINDOW_MS,
} from './constants'
import { PODProviderError, PODRateLimitError, PODAuthError } from '../errors'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface PrintfulClientConfig {
  apiToken: string
  storeId?: string
  tokenExpiresAt?: Date
}

interface PrintfulEnvelope<T = unknown> {
  code: number
  result: T
  paging?: { total: number; offset: number; limit: number }
}

interface PrintfulPaging {
  total: number
  offset: number
  limit: number
}

export interface PrintfulMockupTaskResult {
  taskKey: string
  status: string
  mockups?: Array<{
    placement?: string
    variant_ids?: number[]
    mockup_url?: string
    generator_mockup_id?: number
    extra?: Array<{ title: string; url: string; option: string; option_group: string }>
  }>
  error?: string
}

export class PrintfulClient {
  private readonly headers: Record<string, string>
  private readonly cache = new Map<string, { data: unknown; expiresAt: number }>()
  private rateBucket = { count: 0, windowStart: Date.now() }

  constructor(private readonly config: PrintfulClientConfig) {
    if (!config.apiToken) throw new Error('PrintfulClient: apiToken is required')

    this.headers = {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      'User-Agent': process.env.STORE_USER_AGENT || 'POD-Platform/1.0',
      ...(config.storeId ? { 'X-PF-Store-Id': config.storeId } : {}),
    }

    if (config.tokenExpiresAt) {
      const daysLeft = (config.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      if (daysLeft < 7) {
        console.warn(
          `[PrintfulClient] Token expires in ${daysLeft.toFixed(1)} days. Rotate at developers.printful.com`,
        )
      }
    }
  }

  // ─── Rate Limiting ──────────────────────────────────────────

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    if (now - this.rateBucket.windowStart > PRINTFUL_RATE_LIMIT_WINDOW_MS) {
      this.rateBucket = { count: 0, windowStart: now }
    }
    this.rateBucket.count++
    if (this.rateBucket.count > PRINTFUL_RATE_LIMIT_PER_MIN) {
      const waitMs = PRINTFUL_RATE_LIMIT_WINDOW_MS - (now - this.rateBucket.windowStart) + 100
      await delay(waitMs)
      this.rateBucket = { count: 0, windowStart: Date.now() }
    }
  }

  // ─── Core Request (unwraps .result) ─────────────────────────

  async request<T>(endpoint: string, options: RequestInit = {}, retries = 2): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase()
    const isCatalogGet = method === 'GET' && endpoint.startsWith('/products')

    if (isCatalogGet) {
      const cached = this.cache.get(endpoint)
      if (cached && Date.now() < cached.expiresAt) return cached.data as T
    }

    await this.enforceRateLimit()

    const url = `${PRINTFUL_API_BASE}${endpoint}`
    const response = await fetch(url, {
      ...options,
      method,
      headers: { ...this.headers, ...(options.headers as Record<string, string> | undefined) },
    })

    if (response.status === 429) {
      if (retries > 0) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10)
        await delay(retryAfter * 1000)
        return this.request<T>(endpoint, options, retries - 1)
      }
      throw new PODRateLimitError('printful')
    }

    if (response.status === 401) {
      throw new PODAuthError('printful', 'Printful API authentication failed')
    }

    if (response.status >= 500 && retries > 0) {
      await delay(1000 * (3 - retries))
      return this.request<T>(endpoint, options, retries - 1)
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      let message = `${response.status} ${response.statusText}`
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string }
        message = parsed.error?.message ?? parsed.message ?? message
      } catch {
        /* not JSON */
      }
      throw new PODProviderError('printful', message, response.status)
    }

    const envelope = (await response.json()) as PrintfulEnvelope<T>
    const result = envelope.result !== undefined ? envelope.result : (envelope as unknown as T)

    if (isCatalogGet) {
      this.cache.set(endpoint, { data: result, expiresAt: Date.now() + PRINTFUL_CATALOG_TTL_MS })
    }

    return result
  }

  // ─── Raw Request (returns result + paging) ──────────────────

  private async requestWithPaging<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2,
  ): Promise<{ result: T; paging: PrintfulPaging }> {
    await this.enforceRateLimit()

    const method = (options.method ?? 'GET').toUpperCase()
    const url = `${PRINTFUL_API_BASE}${endpoint}`
    const response = await fetch(url, {
      ...options,
      method,
      headers: { ...this.headers, ...(options.headers as Record<string, string> | undefined) },
    })

    if (response.status === 429) {
      if (retries > 0) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10)
        await delay(retryAfter * 1000)
        return this.requestWithPaging<T>(endpoint, options, retries - 1)
      }
      throw new PODRateLimitError('printful')
    }

    if (response.status === 401) {
      throw new PODAuthError('printful', 'Printful API authentication failed')
    }

    if (response.status >= 500 && retries > 0) {
      await delay(1000 * (3 - retries))
      return this.requestWithPaging<T>(endpoint, options, retries - 1)
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      let message = `${response.status} ${response.statusText}`
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string }
        message = parsed.error?.message ?? parsed.message ?? message
      } catch {
        /* not JSON */
      }
      throw new PODProviderError('printful', message, response.status)
    }

    const envelope = (await response.json()) as PrintfulEnvelope<T>
    return {
      result: envelope.result !== undefined ? envelope.result : (envelope as unknown as T),
      paging: envelope.paging ?? { total: 0, offset: 0, limit: 100 },
    }
  }

  // ─── Store ──────────────────────────────────────────────────

  async getStore(): Promise<Record<string, unknown>> {
    const stores = await this.request<Array<Record<string, unknown>>>('/stores')
    return stores[0] || {}
  }

  // ─── Store Products ─────────────────────────────────────────

  async createSyncProduct(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request('/store/products', { method: 'POST', body: JSON.stringify(body) })
  }

  async getSyncProduct(id: string): Promise<Record<string, unknown>> {
    return this.request(`/store/products/${id}`)
  }

  async listSyncProducts(
    offset = 0,
    limit = 100,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number; offset: number; limit: number }> {
    const { result, paging } = await this.requestWithPaging<Array<Record<string, unknown>>>(
      `/store/products?offset=${offset}&limit=${limit}`,
    )
    return {
      items: result || [],
      total: paging.total,
      offset: paging.offset,
      limit: paging.limit,
    }
  }

  async deleteSyncProduct(id: string): Promise<void> {
    await this.request(`/store/products/${id}`, { method: 'DELETE' })
  }

  // ─── Files ──────────────────────────────────────────────────

  async createFile(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request('/files', { method: 'POST', body: JSON.stringify(body) })
  }

  async getFile(id: string): Promise<Record<string, unknown>> {
    return this.request(`/files/${id}`)
  }

  // ─── Orders ─────────────────────────────────────────────────

  async createOrder(body: Record<string, unknown>, confirm = false): Promise<Record<string, unknown>> {
    const qs = confirm ? '?confirm=true' : ''
    return this.request(`/orders${qs}`, { method: 'POST', body: JSON.stringify(body) })
  }

  async getOrder(id: string): Promise<Record<string, unknown>> {
    return this.request(`/orders/${id}`)
  }

  async confirmOrder(id: string): Promise<Record<string, unknown>> {
    return this.request(`/orders/${id}/confirm`, { method: 'POST' })
  }

  async cancelOrder(id: string): Promise<void> {
    await this.request(`/orders/${id}`, { method: 'DELETE' })
  }

  // ─── Shipping ───────────────────────────────────────────────

  async getShippingRates(body: Record<string, unknown>): Promise<Array<Record<string, unknown>>> {
    return this.request('/shipping/rates', { method: 'POST', body: JSON.stringify(body) })
  }

  // ─── Catalog (public) ──────────────────────────────────────

  async getCatalogProducts(): Promise<Array<Record<string, unknown>>> {
    return this.request('/products')
  }

  async getCatalogProduct(id: string): Promise<Record<string, unknown>> {
    return this.request(`/products/${id}`)
  }

  // ─── Mockup Generator ──────────────────────────────────────

  async createMockupTask(
    productId: string,
    body: Record<string, unknown>,
  ): Promise<{ taskKey: string }> {
    const result = await this.request<{ task_key: string }>(
      `/mockup-generator/create-task/${productId}`,
      { method: 'POST', body: JSON.stringify(body) },
    )
    return { taskKey: result.task_key }
  }

  async getMockupTask(taskKey: string): Promise<PrintfulMockupTaskResult> {
    const raw = await this.request<Record<string, unknown>>(
      `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
    )
    return {
      taskKey,
      status: String(raw.status || 'pending'),
      mockups: (raw.mockups as PrintfulMockupTaskResult['mockups']) || [],
      error: raw.error ? String(raw.error) : undefined,
    }
  }
}
