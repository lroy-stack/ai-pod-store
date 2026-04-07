/**
 * Shared product types — single source of truth.
 *
 * Three-tier hierarchy aligned with API response shapes:
 *   ProductBase  → minimal (landing cards, wishlist items)
 *   ProductCard  → /api/products list response (grids, cards, search results)
 *   ProductDetail → /api/products/[id] detail response (detail panel, full page)
 */

// ---------------------------------------------------------------------------
// Tier 1: Minimal fields shared by ALL product representations
// ---------------------------------------------------------------------------
export interface ProductBase {
  id: string
  slug: string
  title: string
  price: number
  currency: string
  image: string | null
}

// ---------------------------------------------------------------------------
// Tier 2: List API response shape (/api/products)
// Used by: ProductCard, ProductGrid, ShopPageClient, QuickViewModal,
//          ProductGridArtifact, LandingPageClient, useProductCache
// ---------------------------------------------------------------------------
export interface ProductCard extends ProductBase {
  description: string
  rating?: number
  reviewCount?: number
  category?: string
  inStock?: boolean
  stock?: number
  createdAt?: string
  compareAtPrice?: number
  maxPrice?: number
  hasVariantPricing?: boolean
  labels?: string[]
  variants?: {
    sizes?: string[]
    colors?: string[]
    colorImages?: Record<string, string>
  }
}

// ---------------------------------------------------------------------------
// Tier 3: Detail API response shape (/api/products/[id])
// Used by: DetailPanel/ProductView, ArtifactContent, ProductDetailClient
// ---------------------------------------------------------------------------
export interface ProductDetail extends Omit<ProductCard, 'variants'> {
  images: string[]
  materials?: string | null
  careInstructions?: string | null
  printTechnique?: string | null
  manufacturingCountry?: string | null
  brand?: string | null
  safetyInformation?: string | null
  finish?: string | null
  variants?: {
    sizes?: string[]
    colors?: string[]
    allColors?: string[]
    allSizes?: string[]
    colorImages?: Record<string, string>
    colorImageIndices?: Record<string, number[]>
    sizeImageIndices?: Record<string, number[]>
    unavailableCombinations?: Array<{ color: string; size: string }>
    prices?: Array<{ size: string; color: string; price: number }>
  }
}

// ---------------------------------------------------------------------------
// Shared variant selection state
// ---------------------------------------------------------------------------
export interface VariantSelection {
  size?: string
  color?: string
}
