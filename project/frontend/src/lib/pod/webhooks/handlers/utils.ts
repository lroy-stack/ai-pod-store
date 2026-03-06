/**
 * Shared utilities for webhook event handlers.
 *
 * findOrder works for provider webhook events:
 * - Provider puts our Supabase UUID in data.order.external_id
 * - Fallback: lookup by external_order_id column
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Find the Supabase order record for a webhook event.
 * Tries multiple lookup strategies.
 */
export async function findOrder(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
) {
  // Strategy 1: Provider puts our Supabase UUID in data.order.external_id
  const orderData = event.data as Record<string, unknown>
  const orderObj = (orderData?.order || orderData) as Record<string, unknown>
  const externalId = orderObj?.external_id as string | undefined

  if (externalId) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('id', externalId)
      .single()
    if (data) return data
  }

  // Strategy 2: Lookup by external_order_id (provider-agnostic column)
  if (event.resourceId) {
    const { data: byExternal } = await supabase
      .from('orders')
      .select('*')
      .eq('external_order_id', event.resourceId)
      .single()
    if (byExternal) return byExternal
  }

  return null
}

/**
 * Find the Supabase product record for a webhook event.
 * Looks up by provider_product_id.
 */
export async function findProduct(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
) {
  const productData = event.data as Record<string, unknown>
  const productId = (productData?.id as string) || event.resourceId

  if (!productId) return null

  // Lookup by provider_product_id
  const { data: byProviderId } = await supabase
    .from('products')
    .select('*')
    .eq('provider_product_id', productId)
    .single()
  if (byProviderId) return byProviderId

  return null
}

/**
 * Check if a user has email notifications enabled.
 * Returns true by default (opt-out model).
 */
export async function isEmailEnabled(
  userId: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data: userData } = await supabase
    .from('users')
    .select('notification_preferences')
    .eq('id', userId)
    .single()

  const preferences = userData?.notification_preferences || { email: true }
  return preferences.email !== false
}
