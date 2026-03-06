/**
 * product.deleted handler — Removes the product and all child records
 * from Supabase using the cascade delete function.
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteProductCascade } from '@/lib/pod/sync'

export async function handleProductDeleted(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
): Promise<void> {
  const productData = event.data as Record<string, unknown>
  const productId = (productData?.id as string) || event.resourceId

  if (!productId) {
    console.warn(`[webhook:product.deleted] No product ID in event (provider: ${event.provider})`)
    return
  }

  const result = await deleteProductCascade(productId, supabase, `${event.provider}_webhook`)

  if (result.deleted) {
    console.log(`[webhook:product.deleted] Product deleted from Supabase: ${productId} (provider: ${event.provider})`)
  } else if (result.error) {
    console.error(`[webhook:product.deleted] Failed to delete product ${productId}:`, result.error)
  } else {
    console.log(`[webhook:product.deleted] Product ${productId} not found in Supabase (may have been deleted already)`)
  }
}
