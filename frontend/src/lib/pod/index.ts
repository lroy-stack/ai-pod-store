/**
 * POD Provider Abstraction Layer — Main Entry Point
 *
 * Usage:
 *   import { getProvider, initializeProviders } from '@/lib/pod'
 *   initializeProviders()
 *   const provider = getProvider()
 *   const product = await provider.getProduct(id)
 */

import { providerRegistry, ProviderRegistry } from './provider-registry'
import type { PODProvider } from './types'

let _initialized = false

/**
 * Initialize all configured providers based on environment variables.
 * Safe to call multiple times (idempotent).
 *
 * Reads:
 * - PRINTFUL_API_TOKEN + PRINTFUL_STORE_ID → registers PrintfulProvider
 * - POD_PROVIDER → sets default provider (default: 'printful')
 */
export function initializeProviders(): void {
  if (_initialized) return
  _initialized = true

  // Register Printful if configured
  const printfulToken = process.env.PRINTFUL_API_TOKEN
  if (printfulToken) {
    const { PrintfulProvider } = require('./printful') as typeof import('./printful')
    const provider = new PrintfulProvider({
      apiToken: printfulToken,
      storeId: process.env.PRINTFUL_STORE_ID,
      tokenExpiresAt: process.env.PRINTFUL_TOKEN_EXPIRES_AT
        ? new Date(process.env.PRINTFUL_TOKEN_EXPIRES_AT)
        : undefined,
      webhookSecret: process.env.PRINTFUL_WEBHOOK_SECRET,
    })
    providerRegistry.register(provider)
  }

  // Set default provider
  const defaultProvider = process.env.POD_PROVIDER || 'printful'
  if (providerRegistry.has(defaultProvider)) {
    providerRegistry.setDefault(defaultProvider)
  } else {
    // Fall back to first registered provider
    const providers = providerRegistry.list()
    if (providers.length > 0) {
      providerRegistry.setDefault(providers[0].providerId)
      console.warn(
        `[POD] Requested default '${defaultProvider}' not available, falling back to '${providers[0].providerId}'`,
      )
    } else {
      console.warn('[POD] No providers configured. Set PRINTFUL_API_TOKEN.')
    }
  }
}

/** Get the default provider */
export function getProvider(): PODProvider {
  if (!_initialized) initializeProviders()
  return providerRegistry.get()
}

/** Get a specific provider by ID */
export function getProviderById(providerId: string): PODProvider {
  if (!_initialized) initializeProviders()
  return providerRegistry.get(providerId)
}

/** Get the provider for a specific product (dual-provider routing) */
export function getProviderForProduct(productProviderId?: string | null): PODProvider {
  if (!_initialized) initializeProviders()
  return providerRegistry.getForProduct(productProviderId)
}

// ─── Re-exports ──────────────────────────────────────────────

export { providerRegistry, ProviderRegistry } from './provider-registry'

// Types
export type {
  PODProvider,
  PODCatalogProvider,
  PODProductProvider,
  PODDesignProvider,
  PODOrderProvider,
  PODWebhookProvider,
  PaginationInput,
  PaginatedResult,
  CreateProductInput,
  CreateVariantInput,
  PrintAreaInput,
  UpdateProductInput,
  CreateOrderInput,
  CreateOrderLineItem,
  HealthCheckResult,
} from './types'

// Models
export type {
  CanonicalProduct,
  CanonicalVariant,
  CanonicalImage,
  CanonicalPrintArea,
  CanonicalPlaceholder,
  CanonicalPlaceholderImage,
  CanonicalOrder,
  CanonicalLineItem,
  CanonicalAddress,
  CanonicalShipment,
  Blueprint,
  BlueprintVariant,
  VariantPricing,
  CatalogFilters,
  DesignUploadInput,
  UploadedDesign,
  MockupInput,
  MockupResult,
  ShippingRateInput,
  ShippingRate,
  WebhookEventType,
  NormalizedWebhookEvent,
  MarginCalculation,
  MarginAuditResult,
} from './models'

// Errors
export {
  PODError,
  PODProviderError,
  PODNotFoundError,
  PODRateLimitError,
  PODValidationError,
  PODAuthError,
  PODUnsupportedOperationError,
  PODWebhookVerificationError,
} from './errors'

// Constants
export { STORE_CURRENCY, USD_TO_EUR, MIN_MARGIN_THRESHOLD, MAX_PAGE_SIZE, EU_COUNTRIES } from './constants'
