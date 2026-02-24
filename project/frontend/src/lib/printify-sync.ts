/**
 * Printify ↔ Supabase Sync Library
 *
 * Shared logic used by:
 * - /api/webhooks/printify (real-time product events)
 * - /api/cron/sync-printify (periodic full reconciliation)
 *
 * This is infrastructure-level sync — it does NOT depend on PodClaw agents.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USD_TO_EUR = 0.92

/** Child tables with product_id FK — designs are EXCLUDED (preserved in bucket) */
const CHILD_TABLES = [
  'product_variants',
  'marketing_content',
  'wishlist_items',
  'cart_items',
]

// ---------------------------------------------------------------------------
// Category Inference — map product title to category slug
// ---------------------------------------------------------------------------

/**
 * Infer category slug from product title based on keywords.
 * Returns the category slug that matches the categories table.
 *
 * @param title - Product title
 * @returns Category slug (apparel, mugs, stickers, etc.)
 */
export function inferCategorySlug(title: string): string {
  const t = title.toLowerCase()

  // Specific product types first (most specific to least specific)
  if (['sticker', 'decal'].some(k => t.includes(k))) return 'stickers'
  if (['phone case', 'iphone', 'samsung', 'case'].some(k => t.includes(k))) return 'phone-cases'
  if (['poster', 'print', 'wall art'].some(k => t.includes(k))) return 'posters'
  if (['mug', 'cup'].some(k => t.includes(k))) return 'mugs'
  if (['hoodie', 'pullover'].some(k => t.includes(k))) return 'hoodies'
  if (['sweatshirt', 'sweater'].some(k => t.includes(k))) return 'sweatshirts'
  if (['t-shirt', 'tee', 'tshirt'].some(k => t.includes(k))) return 't-shirts'
  if (['tote', 'bag', 'backpack'].some(k => t.includes(k))) return 'bags'
  if (['hat', 'cap', 'beanie'].some(k => t.includes(k))) return 'hats'
  if (['notebook', 'journal', 'notepad'].some(k => t.includes(k))) return 'stationery'

  // Broader categories
  if (['blanket', 'pillow', 'cushion', 'throw', 'home decor', 'home & living'].some(k => t.includes(k))) return 'home-decor'
  if (['kitchen', 'utensil', 'cutting board'].some(k => t.includes(k))) return 'kitchen'
  if (['game', 'puzzle', 'toy'].some(k => t.includes(k))) return 'games'
  if (['kids', 'children', 'baby'].some(k => t.includes(k))) return 'kids'
  if (['drinkware', 'bottle', 'tumbler'].some(k => t.includes(k))) return 'drinkware'

  // Generic apparel fallback for clothing items
  if (['shirt', 'clothing', 'apparel', 'wear', 'jacket', 'pants'].some(k => t.includes(k))) return 'apparel'

  // Default for accessories or uncategorized items
  if (['accessory', 'accessories', 'jewelry', 'watch'].some(k => t.includes(k))) return 'accessories'

  return 'accessories' // Default fallback
}

// ---------------------------------------------------------------------------
// Pricing — port of sync_hook.py:_engagement_price()
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sync: Printify product → Supabase row
// ---------------------------------------------------------------------------

export interface SyncResult {
  action: 'created' | 'updated' | 'skipped'
  printifyId: string
  error?: string
}

/**
 * Upsert a Printify product into Supabase.
 * Used by both the webhook handler and the reconciliation cron.
 */
export async function syncProductFromPrintify(
  printifyProduct: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<SyncResult> {
  const printifyId = String(printifyProduct.id || '')
  if (!printifyId) {
    return { action: 'skipped', printifyId: '', error: 'No product ID' }
  }

  const title = String(printifyProduct.title || 'Untitled')
  const description = String(printifyProduct.description || '').slice(0, 2000)
  const visible = printifyProduct.visible === true

  // Extract minimum variant cost (USD cents) → convert to EUR
  const variants = (printifyProduct.variants as Array<Record<string, unknown>>) || []
  const costsUsd = variants
    .map(v => Number(v.cost || 0))
    .filter(c => c > 0)
  const minCostUsd = costsUsd.length ? Math.min(...costsUsd) : 0
  const costEur = minCostUsd ? Math.round(minCostUsd * USD_TO_EUR) : 0

  // Extract min price from variants (already in cents)
  const prices = variants
    .map(v => Number(v.price || 0))
    .filter(p => p > 0)
  const minPrice = prices.length ? Math.min(...prices) : 0

  // Use agent-set price if available, else compute from cost
  const basePrice = minPrice > 0
    ? minPrice
    : costEur > 0
      ? calculateEngagementPrice(costEur, title)
      : 2999

  // Normalize images to [{src, alt, variant_ids}]
  const rawImages = (printifyProduct.images as Array<Record<string, unknown>>) || []
  const images = rawImages
    .map(img => {
      const src = String(img.src || img.url || '')
      const variantIds = Array.isArray(img.variant_ids) ? img.variant_ids as number[] : []
      return src ? { src, alt: title, variant_ids: variantIds } : null
    })
    .filter(Boolean)

  const status = visible ? 'active' : 'draft'

  // Infer category from title and look up category_id
  const categorySlug = inferCategorySlug(title)
  const { data: categories } = await supabase
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .limit(1)

  const categoryId = categories?.[0]?.id || null

  const row = {
    printify_id: printifyId,
    title,
    description,
    status,
    currency: 'EUR',
    cost_cents: costEur || null,
    base_price_cents: basePrice,
    images,
    category_id: categoryId,
    ...(visible ? { published_at: new Date().toISOString() } : {}),
  }

  const { data, error } = await supabase
    .from('products')
    .upsert(row, { onConflict: 'printify_id' })
    .select('id')

  if (error) {
    console.error('printify-sync: upsert failed', printifyId, error.message)
    return { action: 'skipped', printifyId, error: error.message }
  }

  const productId = data?.[0]?.id
  const action = data && data.length > 0 ? 'created' : 'updated'

  // Sync variants to product_variants table
  if (productId && variants.length > 0) {
    await syncVariants(supabase, productId, printifyId, variants, rawImages)
  }

  console.log(`printify-sync: ${action} product`, printifyId, title.slice(0, 50))
  return { action, printifyId }
}

// ---------------------------------------------------------------------------
// Sync Variants: Printify variants → product_variants table
// ---------------------------------------------------------------------------

async function syncVariants(
  supabase: SupabaseClient,
  productId: string,
  printifyId: string,
  variants: Array<Record<string, unknown>>,
  images: Array<Record<string, unknown>>,
): Promise<void> {
  // Build variant_id → image_url map from mockup images
  const variantImageMap = new Map<number, string>()
  for (const img of images) {
    const variantIds = (img.variant_ids as number[]) || []
    const src = String(img.src || img.url || '')
    if (src) {
      for (const vid of variantIds) {
        if (!variantImageMap.has(vid)) {
          variantImageMap.set(vid, src)
        }
      }
    }
  }

  const rows = variants
    .filter(v => v.is_enabled !== false)
    .map(v => {
      const variantId = Number(v.id || 0)
      const title = String(v.title || '')
      // Parse color and size from variant title
      // Printify format is "Color / Size" (e.g., "Black / S", "Natural / One size")
      const parts = title.split('/').map(p => p.trim())
      let [partA, partB] = [parts[0] || null, parts.length > 1 ? parts[1] : null]

      // Detect which part is size vs color using known patterns
      const SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|2X|3X|4X|5X|One\s*size|\d+oz|\d+x\d+|\d+['"]?x\d+['"]?|\d+(\.\d+)?["']\s*x\s*\d+(\.\d+)?["']?|\d+(\.\d+)?["'])$/i
      const isASize = partA ? SIZE_RE.test(partA) : false
      const isBSize = partB ? SIZE_RE.test(partB) : false

      let size: string | null
      let color: string | null

      if (parts.length === 1) {
        // Single value — guess based on pattern
        size = isASize ? partA : null
        color = isASize ? null : partA
      } else if (isASize && !isBSize) {
        // partA is size, partB is color (unusual but handle it)
        size = partA
        color = partB
      } else {
        // Default: Printify standard "Color / Size"
        color = partA
        size = partB
      }
      const priceCents = Number(v.price || 0)
      const costUsd = Number(v.cost || 0)
      const costEur = costUsd > 0 ? Math.round(costUsd * USD_TO_EUR) : null

      return {
        product_id: productId,
        printify_variant_id: String(variantId),
        title,
        size,
        color,
        price_cents: priceCents > 0 ? priceCents : null,
        cost_cents: costEur,
        sku: String(v.sku || ''),
        is_enabled: v.is_enabled !== false,
        is_available: v.is_available !== false,
        image_url: variantImageMap.get(variantId) || null,
      }
    })

  if (rows.length === 0) return

  // Delete existing variants for this product, then insert fresh
  await supabase
    .from('product_variants')
    .delete()
    .eq('product_id', productId)

  const { error } = await supabase
    .from('product_variants')
    .insert(rows)

  if (error) {
    console.error('printify-sync: variant insert failed', printifyId, error.message)
  } else {
    console.log(`printify-sync: synced ${rows.length} variants for`, printifyId)
  }
}

// ---------------------------------------------------------------------------
// Cascade Delete (preserving designs)
// ---------------------------------------------------------------------------

/**
 * Soft delete a product from Supabase by its Printify ID.
 * Sets deleted_at timestamp instead of hard DELETE.
 * Cascades to child tables but PRESERVES designs (only unlinks them).
 */
export async function deleteProductCascade(
  printifyId: string,
  supabase: SupabaseClient,
  deletedBy?: string,
): Promise<{ deleted: boolean; error?: string }> {
  // Find the product UUID
  const { data: products, error: findError } = await supabase
    .from('products')
    .select('id')
    .eq('printify_id', printifyId)
    .is('deleted_at', null)

  if (findError || !products?.length) {
    console.warn('printify-sync: product not found for delete', printifyId)
    return { deleted: false, error: 'Product not found' }
  }

  const productId = products[0].id

  // Unlink designs (preserve them — they cost money)
  await supabase
    .from('designs')
    .update({ product_id: null })
    .eq('product_id', productId)

  // Delete child table rows
  for (const table of CHILD_TABLES) {
    await supabase.from(table).delete().eq('product_id', productId)
  }

  // Soft delete the product itself
  const { error: deleteError } = await supabase
    .from('products')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy || null,
    })
    .eq('id', productId)

  if (deleteError) {
    console.error('printify-sync: soft delete failed', printifyId, deleteError.message)
    return { deleted: false, error: deleteError.message }
  }

  // Log deletion to audit_log
  await supabase
    .from('audit_log')
    .insert({
      actor_type: deletedBy ? 'admin' : 'system',
      actor_id: deletedBy || 'system',
      action: 'soft_delete',
      resource_type: 'product',
      resource_id: productId,
      metadata: {
        printify_id: printifyId,
        reason: 'Product soft deleted',
      },
    })
    .select()

  console.log('printify-sync: soft deleted product', printifyId)
  return { deleted: true }
}
