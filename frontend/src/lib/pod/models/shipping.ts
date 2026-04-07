/**
 * Shipping models — rate inputs and results.
 */

export interface ShippingRateInput {
  lineItems: Array<{
    productExternalId: string
    variantExternalId: string
    quantity: number
  }>
  address: {
    country: string
    postalCode?: string
    state?: string
    city?: string
  }
}

export interface ShippingRate {
  id: string
  name: string
  costCents: number
  currency: string
  minDeliveryDays?: number
  maxDeliveryDays?: number
}
