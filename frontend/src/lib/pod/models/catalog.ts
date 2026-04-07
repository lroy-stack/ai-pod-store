/**
 * Catalog models — blueprints, variants, and pricing for the POD catalog.
 */

export interface CatalogFilters {
  category?: string
  euOnly?: boolean
}

export interface Blueprint {
  id: string
  title: string
  description: string
  images: string[]
  providerId?: string
  providerName?: string
  isEuFulfillable: boolean
}

export interface BlueprintVariant {
  id: string
  title: string
  options: Record<string, string>
  placeholders: Array<{
    position: string
    width: number
    height: number
  }>
}

export interface VariantPricing {
  variantId: string
  costCents: number
  currency: string
}
