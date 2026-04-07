/**
 * Margin auditor — pricing calculation and margin enforcement.
 * calculateEngagementPrice copied VERBATIM from printify-sync.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { MIN_MARGIN_THRESHOLD } from '@/lib/pod/constants'

/**
 * Calculate retail price from production cost using tiered multipliers.
 * Matches the Cataloger SKILL.md pricing table exactly.
 *
 * @param costCents - Production cost in EUR cents
 * @param title - Product title (used to detect product type)
 * @returns Retail price in EUR cents, rounded up to .99
 */
export function calculateEngagementPrice(costCents: number, title: string): number {
  const t = title.toLowerCase()

  let multiplier: number
  let minPrice: number

  if (['sticker', 'pin', 'badge', 'magnet'].some(k => t.includes(k))) {
    multiplier = 2.5; minPrice = 399
  } else if (['mug', 'phone case', 'iphone', 'samsung', 'case'].some(k => t.includes(k))) {
    multiplier = 2.0; minPrice = 999
  } else if (['hoodie', 'sweater', 'sweatshirt', 'pullover'].some(k => t.includes(k))) {
    multiplier = 1.7; minPrice = 2999
  } else if (['hat', 'cap', 'beanie', 'snapback', 'trucker', 'bucket'].some(k => t.includes(k))) {
    multiplier = 2.0; minPrice = 1999
  } else if (['t-shirt', 'tee', 'tote', 'bag', 'tank'].some(k => t.includes(k))) {
    multiplier = 1.8; minPrice = 1499
  } else if (['poster', 'canvas', 'print', 'art'].some(k => t.includes(k))) {
    multiplier = 2.0; minPrice = 799
  } else if (['blanket', 'pillow', 'throw', 'cushion', 'flag'].some(k => t.includes(k))) {
    multiplier = 1.55; minPrice = 3999
  } else {
    multiplier = 1.8; minPrice = 1499 // default: apparel-like
  }

  let raw = costCents * multiplier

  // Hard floor: at least 40% margin
  raw = Math.max(raw, costCents * 1.4)
  // Hard ceiling: at most 3x cost
  raw = Math.min(raw, costCents * 3.0)

  // Round up to nearest .99
  const rounded = Math.ceil(raw / 100) * 100 - 1

  return Math.max(rounded, minPrice)
}

/**
 * Audit all products in Supabase and fix margins that fall below threshold.
 * Reads cost_cents and base_price_cents from the products table, recalculates
 * using calculateEngagementPrice, and updates products with insufficient margins.
 *
 * @param supabase - Admin Supabase client (bypasses RLS)
 * @param threshold - Minimum margin threshold (default: MIN_MARGIN_THRESHOLD from constants)
 * @returns Count of fixed products and any errors encountered
 */
export async function auditMargins(
  supabase: SupabaseClient,
  threshold: number = MIN_MARGIN_THRESHOLD,
): Promise<{ fixed: number; errors: string[] }> {
  const errors: string[] = []
  let fixed = 0

  // Fetch all active products with cost data
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, title, base_price_cents, cost_cents, provider_product_id')
    .eq('status', 'active')
    .not('cost_cents', 'is', null)
    .gt('cost_cents', 0)
    .is('deleted_at', null)

  if (fetchError) {
    errors.push(`Failed to fetch products: ${fetchError.message}`)
    return { fixed, errors }
  }

  if (!products || products.length === 0) {
    return { fixed, errors }
  }

  for (const product of products) {
    const costCents = product.cost_cents as number
    const currentPrice = product.base_price_cents as number
    const title = product.title as string

    // Check if margin is below threshold
    const margin = currentPrice > 0 ? (currentPrice - costCents) / currentPrice : 0
    if (margin >= threshold) continue

    // Calculate recommended price
    const recommendedPrice = calculateEngagementPrice(costCents, title)

    const { error: updateError } = await supabase
      .from('products')
      .update({ base_price_cents: recommendedPrice })
      .eq('id', product.id)

    if (updateError) {
      const productRef = product.provider_product_id || product.id
      errors.push(`Failed to fix margin for ${productRef}: ${updateError.message}`)
    } else {
      const productRef = product.provider_product_id || product.id
      console.log(`pod-sync: fixed margin for ${productRef} — ${currentPrice} → ${recommendedPrice} (cost: ${costCents})`)
      fixed++
    }
  }

  return { fixed, errors }
}
