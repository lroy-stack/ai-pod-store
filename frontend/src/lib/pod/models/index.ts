/**
 * Barrel export for all canonical POD models.
 */
export type {
  CanonicalProduct,
  CanonicalVariant,
  CanonicalImage,
  CanonicalPrintArea,
  CanonicalPlaceholder,
  CanonicalPlaceholderImage,
} from './product'

export type {
  CanonicalOrder,
  CanonicalLineItem,
  CanonicalAddress,
  CanonicalShipment,
} from './order'

export type {
  CatalogFilters,
  Blueprint,
  BlueprintVariant,
  VariantPricing,
} from './catalog'

export type {
  DesignUploadInput,
  UploadedDesign,
  MockupInput,
  MockupResult,
} from './design'

export type {
  ShippingRateInput,
  ShippingRate,
} from './shipping'

export type {
  WebhookEventType,
  NormalizedWebhookEvent,
} from './webhook'

export type {
  MarginCalculation,
  MarginAuditResult,
} from './pricing'
