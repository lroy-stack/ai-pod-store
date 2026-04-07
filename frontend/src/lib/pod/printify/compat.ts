/**
 * Backward-compatible shim for code that still imports from '@/lib/printify'.
 * @deprecated Use `import { getProvider } from '@/lib/pod'` instead.
 */

import { getProvider, initializeProviders } from '../index'
import { canonicalAddressFromStripe } from './mapper'

// Re-create the lazy proxy pattern that matches the original printify.ts export
export const printify = new Proxy({} as any, {
  get(_, prop: string) {
    initializeProviders()
    const provider = getProvider()

    // Map old PrintifyClient method names to PODProvider methods
    const methodMap: Record<string, (...args: any[]) => any> = {
      createProduct: async (data: Record<string, unknown>) => {
        // Pass through raw data — compat mode
        const result = await (provider as any).client.createProduct(data)
        return result
      },
      getProduct: async (id: string) => {
        const product = await provider.getProduct(id)
        return product._raw || product
      },
      listProducts: async (page = 1, limit = 50) => {
        const offset = (page - 1) * limit
        const result = await provider.listProducts({ offset, limit })
        return {
          current_page: page,
          data: result.data.map(p => p._raw || p),
          total: result.total,
        }
      },
      createOrder: async (orderData: any) => {
        const raw = await (provider as any).client.createOrder(orderData)
        return raw
      },
      getOrder: async (id: string) => {
        const order = await provider.getOrder(id)
        return order._raw || order
      },
      submitOrderForProduction: async (id: string) => {
        await provider.submitForProduction(id)
        return { id }
      },
      cancelOrder: async (id: string) => {
        await provider.cancelOrder(id)
      },
      uploadImage: async (url: string, fileName: string) => {
        const result = await provider.uploadDesign({ url, fileName })
        return { id: result.id, file_name: result.fileName, preview_url: result.previewUrl }
      },
      uploadImageFromBase64: async (base64: string, fileName: string) => {
        const result = await provider.uploadDesign({ base64, fileName })
        return { id: result.id, file_name: result.fileName, preview_url: result.previewUrl }
      },
      publishProduct: async (id: string) => {
        await provider.publishProduct!(id)
      },
      publishingSucceeded: async (productId: string, externalId: string, handle?: string) => {
        await provider.confirmPublishing!(productId, externalId, handle)
      },
      publishingFailed: async (productId: string, reason?: string) => {
        await provider.reportPublishingFailed!(productId, reason)
      },
      deleteProduct: async (id: string) => {
        await provider.deleteProduct(id)
      },
      getBlueprints: async () => {
        // Access raw client to preserve original shape (numeric ids)
        const client = (provider as any).client
        if (client?.getBlueprints) return client.getBlueprints()
        return provider.getBlueprints()
      },
      getProviders: async (blueprintId: number) => {
        // Access raw client for catalog discovery (no canonical equivalent)
        const client = (provider as any).client
        if (client?.getProviders) return client.getProviders(blueprintId)
        return []
      },
      getVariants: async (blueprintId: number, providerId: number) => {
        // Access raw client for catalog discovery (preserves original return shape)
        const client = (provider as any).client
        if (client?.getVariants) return client.getVariants(blueprintId, providerId)
        const variants = await provider.getBlueprintVariants(`${blueprintId}:${providerId}`)
        return { id: blueprintId, title: '', variants }
      },
      calculateShipping: async (lineItems: any[], address: any) => {
        const rates = await provider.getShippingRates({
          lineItems: lineItems.map((li: any) => ({
            productExternalId: li.product_id,
            variantExternalId: String(li.variant_id),
            quantity: li.quantity,
          })),
          address: {
            country: address.country || '',
            postalCode: address.zip || '',
            state: address.region || '',
            city: address.city || '',
          },
        })
        return rates.map(r => ({ id: parseInt(r.id, 10), name: r.name, cost: r.costCents }))
      },
    }

    const method = methodMap[prop]
    if (method) return method

    return undefined
  },
})

/**
 * @deprecated Use `canonicalAddressFromStripe` from '@/lib/pod/printify/mapper'
 */
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
  email: string,
) {
  const addr = canonicalAddressFromStripe(stripeAddress, email)
  // Convert to legacy Printify format
  return {
    first_name: addr.firstName,
    last_name: addr.lastName,
    email: addr.email,
    country: addr.country,
    region: addr.state,
    address1: addr.address1,
    address2: addr.address2,
    city: addr.city,
    zip: addr.postalCode,
  }
}
