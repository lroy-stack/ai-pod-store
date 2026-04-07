/**
 * Pricing models — margin calculation and audit results.
 */

export interface MarginCalculation {
  productId: string
  externalId: string
  priceCents: number
  costCents: number
  marginPercent: number
  meetsThreshold: boolean
  recommendedMinPriceCents: number
}

export interface MarginAuditResult {
  total: number
  failing: number
  fixed: number
  errors: string[]
}
