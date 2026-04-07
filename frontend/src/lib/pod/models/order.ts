/**
 * Canonical order models — provider-agnostic representations of POD orders.
 * Maps to `orders` and `order_items` Supabase tables.
 */

export interface CanonicalOrder {
  /** Provider's external order ID */
  externalId: string
  status: 'draft' | 'pending' | 'in_production' | 'shipped' | 'delivered' | 'cancelled' | 'failed'
  lineItems: CanonicalLineItem[]
  shippingAddress: CanonicalAddress
  shipments: CanonicalShipment[]
  createdAt: string
  /** Raw provider API response */
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
  /** ISO 3166-1 alpha-2 country code */
  country: string
}

export interface CanonicalShipment {
  carrier: string
  trackingNumber: string
  trackingUrl: string
  shippedAt: string
}
