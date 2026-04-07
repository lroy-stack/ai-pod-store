/**
 * stock.updated handler — Updates variant availability in Supabase
 * when a provider reports stock level changes.
 *
 * This is a NEW handler (not extracted from the old webhook route).
 * Printful sends stock_updated events; Printify does not currently.
 */

import type { NormalizedWebhookEvent } from '../../models'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findProduct } from './utils'

interface StockChange {
  variant_id: string | number
  in_stock?: boolean
  quantity?: number
}

/**
 * Extract stock changes from the event data.
 * Printful: data.sync_variant or data.product.variants[]
 */
function extractStockChanges(data: Record<string, unknown>): StockChange[] {
  // Direct variants array with stock info
  if (Array.isArray(data.variants)) {
    return (data.variants as Array<Record<string, unknown>>).map(v => ({
      variant_id: String(v.id || v.variant_id || ''),
      in_stock: v.in_stock as boolean | undefined,
      quantity: v.quantity as number | undefined,
    }))
  }

  // Single sync_variant (Printful format)
  if (data.sync_variant && typeof data.sync_variant === 'object') {
    const sv = data.sync_variant as Record<string, unknown>
    return [{
      variant_id: String(sv.id || sv.variant_id || ''),
      in_stock: sv.in_stock as boolean | undefined,
      quantity: sv.quantity as number | undefined,
    }]
  }

  // Product-level stock update
  const productObj = data.product as Record<string, unknown> | undefined
  if (productObj && Array.isArray(productObj.variants)) {
    return (productObj.variants as Array<Record<string, unknown>>).map(v => ({
      variant_id: String(v.id || v.variant_id || ''),
      in_stock: v.in_stock as boolean | undefined,
      quantity: v.quantity as number | undefined,
    }))
  }

  return []
}

export async function handleStockUpdated(
  event: NormalizedWebhookEvent,
  supabase: SupabaseClient,
): Promise<void> {
  const changes = extractStockChanges(event.data)

  if (changes.length === 0) {
    console.log(`[webhook:stock.updated] No variant stock changes in event (provider: ${event.provider})`)
    return
  }

  let updatedCount = 0

  for (const change of changes) {
    if (!change.variant_id) continue

    // Determine availability: explicit in_stock flag, or infer from quantity
    const isAvailable = change.in_stock !== undefined
      ? change.in_stock
      : change.quantity !== undefined
        ? change.quantity > 0
        : undefined

    if (isAvailable === undefined) continue

    // Update by external variant ID
    const { data: updated, error } = await supabase
      .from('product_variants')
      .update({ is_available: isAvailable })
      .eq('external_variant_id', String(change.variant_id))
      .select('id')

    if (error) {
      console.error(
        `[webhook:stock.updated] Failed to update variant ${change.variant_id}:`,
        error,
      )
    } else if (updated && updated.length > 0) {
      updatedCount += updated.length
    }
  }

  console.log(
    `[webhook:stock.updated] Updated ${updatedCount} variant(s) availability (provider: ${event.provider}, resourceId: ${event.resourceId})`,
  )

  // Audit log (only if something changed)
  if (updatedCount > 0) {
    const product = await findProduct(event, supabase)
    await supabase.from('audit_log').insert({
      actor_type: 'webhook',
      actor_id: `${event.provider}_webhook`,
      action: 'stock_updated',
      resource_type: 'product',
      resource_id: product?.id || event.resourceId,
      changes: { variants_updated: updatedCount },
      metadata: {
        provider: event.provider,
        provider_resource_id: event.resourceId,
        stock_changes: changes,
      },
    })
  }
}
