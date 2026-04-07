/**
 * order.created handler — Verifies that the webhook event corresponds to a
 * known order in our database. This is a log-only handler; no state changes.
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findOrder } from './utils'

export async function handleOrderCreated(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
): Promise<void> {
  const order = await findOrder(event, supabase)

  if (order) {
    console.log(
      `[webhook:order.created] Confirmed for order ${order.id} (provider: ${event.provider}, resourceId: ${event.resourceId})`,
    )
  } else {
    console.warn(
      `[webhook:order.created] Received event for unknown order (provider: ${event.provider}, resourceId: ${event.resourceId})`,
    )
  }
}
