/**
 * Printify API Client
 * Documentation: https://developers.printify.com/
 */

import { STORE_DEFAULTS } from './store-config'

const PRINTIFY_API_URL = 'https://api.printify.com/v1'

interface PrintifyLineItem {
  product_id: string
  variant_id: number
  quantity: number
}

interface PrintifyShippingAddress {
  first_name: string
  last_name: string
  email: string
  phone?: string
  country: string
  region?: string
  address1: string
  address2?: string
  city: string
  zip: string
}

interface PrintifyOrderRequest {
  external_id?: string
  label?: string
  line_items: PrintifyLineItem[]
  shipping_method: number
  is_printify_express?: boolean
  send_shipping_notification: boolean
  address_to: PrintifyShippingAddress
}

interface PrintifyOrderResponse {
  id: string
  status: string
  created_at: string
  label?: string
  line_items: Array<{
    product_id: string
    variant_id: number
    quantity: number
    status: string
  }>
  shipments: Array<{
    carrier: string
    tracking_number: string
    tracking_url: string
  }>
}

class PrintifyClient {
  private apiToken: string
  private shopId: string

  constructor() {
    this.apiToken = process.env.PRINTIFY_API_TOKEN || ''
    this.shopId = process.env.PRINTIFY_SHOP_ID || ''

    if (!this.apiToken || !this.shopId) {
      console.warn('Printify API token or shop ID missing')
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${PRINTIFY_API_URL}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'POD-AI-Store/1.0',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Printify API error: ${response.status} ${response.statusText} - ${errorText}`
      )
    }

    return response.json()
  }

  /**
   * Create a product in Printify
   */
  async createProduct(productData: Record<string, unknown>): Promise<{ id: string }> {
    return this.request(`/shops/${this.shopId}/products.json`, {
      method: 'POST',
      body: JSON.stringify(productData),
    })
  }

  /**
   * Create an order in Printify
   * @param orderData - Order details
   * @returns Printify order response with order ID
   */
  async createOrder(orderData: PrintifyOrderRequest): Promise<PrintifyOrderResponse> {
    return this.request<PrintifyOrderResponse>(
      `/shops/${this.shopId}/orders.json`,
      {
        method: 'POST',
        body: JSON.stringify(orderData),
      }
    )
  }

  /**
   * Get order details from Printify
   * @param orderId - Printify order ID
   */
  async getOrder(orderId: string): Promise<PrintifyOrderResponse> {
    return this.request<PrintifyOrderResponse>(
      `/shops/${this.shopId}/orders/${orderId}.json`
    )
  }

  /**
   * Submit an order for production (moves from draft to production queue)
   * @param orderId - Printify order ID
   */
  async submitOrderForProduction(orderId: string): Promise<{ id: string }> {
    return this.request<{ id: string }>(
      `/shops/${this.shopId}/orders/${orderId}/send_to_production.json`,
      { method: 'POST' }
    )
  }

  /**
   * Cancel an order (only possible before production starts)
   * @param orderId - Printify order ID
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.request(
      `/shops/${this.shopId}/orders/${orderId}/cancel.json`,
      { method: 'POST' }
    )
  }

  /**
   * Calculate shipping cost for an order
   * @param lineItems - Products and variants to ship
   * @param address - Shipping address
   */
  /**
   * Upload an image to Printify via public URL
   */
  async uploadImage(url: string, fileName: string): Promise<{ id: string; file_name: string; preview_url: string }> {
    return this.request(`/uploads/images.json`, {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, url }),
    })
  }

  /**
   * Upload an image to Printify from base64 string
   */
  async uploadImageFromBase64(base64: string, fileName: string): Promise<{ id: string; file_name: string; preview_url: string }> {
    return this.request(`/uploads/images.json`, {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, contents: base64 }),
    })
  }

  /**
   * Publish a product to the connected sales channel
   */
  async publishProduct(productId: string): Promise<void> {
    await this.request(
      `/shops/${this.shopId}/products/${productId}/publish.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
        }),
      }
    )
  }

  /**
   * Confirm successful publishing to custom integration.
   * REQUIRED for custom integrations — without this, products stay in "publishing" forever.
   */
  async publishingSucceeded(productId: string, externalId: string, handle?: string): Promise<void> {
    await this.request(
      `/shops/${this.shopId}/products/${productId}/publishing_succeeded.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          external: {
            id: externalId,
            handle: handle || `/products/${externalId}`,
          },
        }),
      }
    )
  }

  /**
   * Report publishing failure to Printify.
   */
  async publishingFailed(productId: string, reason?: string): Promise<void> {
    await this.request(
      `/shops/${this.shopId}/products/${productId}/publishing_failed.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: reason || 'Publishing failed',
        }),
      }
    )
  }

  /**
   * List all products in the shop (paginated)
   */
  async listProducts(page = 1, limit = 100): Promise<{
    current_page: number
    data: Record<string, unknown>[]
    total: number
  }> {
    return this.request(
      `/shops/${this.shopId}/products.json?page=${page}&limit=${limit}`
    )
  }

  /**
   * Get a single product by ID
   */
  async getProduct(productId: string): Promise<Record<string, unknown>> {
    return this.request(`/shops/${this.shopId}/products/${productId}.json`)
  }

  /**
   * List all available blueprints (product templates) from the Printify catalog
   */
  async getBlueprints(): Promise<Array<{ id: number; title: string; description: string; images: string[] }>> {
    return this.request(`/catalog/blueprints.json`)
  }

  /**
   * Get print providers for a specific blueprint
   */
  async getProviders(blueprintId: number): Promise<Array<{ id: number; title: string; location: { country: string; region: string } }>> {
    return this.request(`/catalog/blueprints/${blueprintId}/print_providers.json`)
  }

  /**
   * Get available variants (sizes/colors) for a blueprint+provider combination
   */
  async getVariants(blueprintId: number, providerId: number): Promise<{ id: number; title: string; variants: Array<{ id: number; title: string; options: Record<string, string>; placeholders: Array<{ position: string; height: number; width: number }> }> }> {
    return this.request(`/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`)
  }

  async calculateShipping(
    lineItems: PrintifyLineItem[],
    address: Partial<PrintifyShippingAddress>
  ): Promise<Array<{ id: number; name: string; cost: number }>> {
    const response = await this.request<{
      standard: Array<{ id: number; name: string; cost: number }>
    }>(
      `/shops/${this.shopId}/orders/shipping.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          line_items: lineItems,
          address_to: address,
        }),
      }
    )
    return response.standard || []
  }
}

// Lazy singleton — client is created on first property access, not at import time.
let _printify: PrintifyClient | undefined

function initPrintify(): PrintifyClient {
  if (!_printify) {
    _printify = new PrintifyClient()
  }
  return _printify
}

export const printify: PrintifyClient = new Proxy({} as PrintifyClient, {
  get(_, prop) {
    const client = initPrintify()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

// Helper to build shipping address from Stripe format
export function buildPrintifyAddress(
  stripeAddress: {
    name?: string
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  },
  email: string
): PrintifyShippingAddress {
  // Split name into first/last (best effort)
  const nameParts = (stripeAddress.name || 'Customer').split(' ')
  const firstName = nameParts[0] || 'Customer'
  const lastName = nameParts.slice(1).join(' ') || ''

  return {
    first_name: firstName,
    last_name: lastName,
    email,
    country: stripeAddress.country || STORE_DEFAULTS.country,
    region: stripeAddress.state || '',
    address1: stripeAddress.line1 || '',
    address2: stripeAddress.line2 || undefined,
    city: stripeAddress.city || '',
    zip: stripeAddress.postal_code || '',
  }
}
