/**
 * product.updated / product.created / product.publish_succeeded handler.
 *
 * Fetches the full product from the provider and syncs it to Supabase
 * using the provider-agnostic syncProductFromProvider.
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getProviderById, initializeProviders } from '@/lib/pod'
import { syncProductFromProvider } from '@/lib/pod/sync'

export async function handleProductUpdated(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
): Promise<void> {
  const productData = event.data as Record<string, unknown>
  const productId = (productData?.id as string) || event.resourceId

  if (!productId) {
    console.warn(`[webhook:product.updated] No product ID in event (provider: ${event.provider})`)
    return
  }

  initializeProviders()

  try {
    const provider = getProviderById(event.provider)
    const fullProduct = await provider.getProduct(productId)

    // Provider-agnostic sync
    await syncProductFromProvider(fullProduct, supabase, {})

    console.log(`[webhook:product.updated] Product synced (${event.type}): ${productId} (provider: ${event.provider})`)
  } catch (error) {
    console.error(`[webhook:product.updated] Failed to sync product ${productId}:`, error)
    throw error
  }
}
