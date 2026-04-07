/**
 * Provider Registry — singleton that manages POD provider instances.
 * Supports per-product routing for dual-provider migration period.
 */

import type { PODProvider } from './types'
import { PODNotFoundError } from './errors'

export class ProviderRegistry {
  private providers = new Map<string, PODProvider>()
  private defaultProviderId: string | null = null

  /** Register a provider instance */
  register(provider: PODProvider): void {
    this.providers.set(provider.providerId, provider)
  }

  /** Set the default provider (used when no specific provider is requested) */
  setDefault(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Cannot set default: provider '${providerId}' is not registered`)
    }
    this.defaultProviderId = providerId
  }

  /** Get a provider by ID, or the default if no ID is specified */
  get(providerId?: string): PODProvider {
    const id = providerId ?? this.defaultProviderId
    if (!id) {
      throw new Error('No provider ID specified and no default provider set')
    }
    const provider = this.providers.get(id)
    if (!provider) {
      throw new PODNotFoundError('registry', 'provider', id)
    }
    return provider
  }

  /**
   * Get the provider for a specific product, based on its pod_provider column.
   * Falls back to the default provider if productProviderId is null/undefined.
   * Used during dual-provider migration period.
   */
  getForProduct(productProviderId?: string | null): PODProvider {
    if (productProviderId && this.providers.has(productProviderId)) {
      return this.providers.get(productProviderId)!
    }
    return this.get()
  }

  /** Check if a provider is registered */
  has(providerId: string): boolean {
    return this.providers.has(providerId)
  }

  /** List all registered providers */
  list(): PODProvider[] {
    return Array.from(this.providers.values())
  }

  /** Get the default provider ID */
  getDefaultId(): string | null {
    return this.defaultProviderId
  }
}

/** Singleton registry instance */
export const providerRegistry = new ProviderRegistry()
