/**
 * Canonical product models — provider-agnostic representations of POD products.
 * Maps to `products` and `product_variants` Supabase tables.
 */

export interface CanonicalProduct {
  /** Provider's external product ID (e.g. Printify product ID or Printful sync product ID) */
  externalId: string
  title: string
  /** Plain-text description (HTML stripped by mapper) */
  description: string
  status: 'draft' | 'active' | 'publishing' | 'deleted'
  variants: CanonicalVariant[]
  images: CanonicalImage[]
  printAreas: CanonicalPrintArea[]
  /**
   * Provider-specific blueprint/template reference.
   * Printify: "printify:{blueprintId}:{providerId}" e.g. "printify:6:26"
   * Printful: "printful:{catalogProductId}" e.g. "printful:71"
   */
  blueprintRef: string | null
  tags: string[]
  /** Raw provider API response — escape hatch for sync engine. NEVER use in business logic. */
  _raw?: unknown
}

export interface CanonicalVariant {
  /** Provider's external variant ID */
  externalId: string
  /** Full variant title from provider (e.g. "Black / S") */
  title: string
  /** Parsed size, null if not applicable */
  size: string | null
  /** Parsed color, null if not applicable */
  color: string | null
  sku: string
  /** Retail price in EUR cents */
  priceCents: number
  /** Production cost in EUR cents, null when unavailable */
  costCents: number | null
  isEnabled: boolean
  isAvailable: boolean
  /** Per-variant mockup image URL */
  imageUrl: string | null
}

export interface CanonicalImage {
  src: string
  alt: string
  /** Variant IDs this image is associated with */
  variantIds: string[]
  isDefault: boolean
}

export interface CanonicalPrintArea {
  /** Position name: front, back, neck_outer, sleeve_left, etc. */
  position: string
  placeholders: CanonicalPlaceholder[]
}

export interface CanonicalPlaceholder {
  /** Width in pixels at production resolution */
  width: number
  /** Height in pixels at production resolution */
  height: number
  images: CanonicalPlaceholderImage[]
}

export interface CanonicalPlaceholderImage {
  /** Provider's image/file ID */
  id: string
  x: number
  y: number
  scale: number
  angle: number
}
