/**
 * Provider-agnostic product sync — upserts a CanonicalProduct into Supabase.
 *
 * The function accepts a CanonicalProduct (already mapped by the provider mapper)
 * rather than raw provider JSON.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanonicalProduct, CanonicalVariant } from '@/lib/pod/models/product'
import { STORE_CURRENCY } from '@/lib/pod/constants'
import { inferCategoryId } from './category-inferrer'
import { shouldPreserveAdminEdits } from './conflict-resolver'
import { calculateEngagementPrice } from './margin-auditor'
import { slugify } from '@/lib/utils'
import type { SyncResult, SyncOptions } from './types'

// ---------------------------------------------------------------------------
// Blueprint ref parser
// ---------------------------------------------------------------------------

interface ParsedBlueprintRef {
  provider: string | null
  productTemplateId: string | null
  providerFacilityId: string | null
}

/**
 * Parse a blueprintRef string into its component parts.
 *   "printify:6:26"   → { provider: "printify", productTemplateId: "6", providerFacilityId: "26" }
 *   "printful:71"     → { provider: "printful", productTemplateId: "71", providerFacilityId: null }
 *   null              → { provider: null, productTemplateId: null, providerFacilityId: null }
 */
function parseBlueprintRef(ref: string | null): ParsedBlueprintRef {
  if (!ref) return { provider: null, productTemplateId: null, providerFacilityId: null }

  const parts = ref.split(':')
  return {
    provider: parts[0] || null,
    productTemplateId: parts[1] || null,
    providerFacilityId: parts[2] || null,
  }
}

// ---------------------------------------------------------------------------
// Main sync function
// ---------------------------------------------------------------------------

/**
 * Upsert a CanonicalProduct into Supabase.
 * Used by both webhook handlers and reconciliation crons.
 *
 * @param product - Provider-agnostic canonical product (from mapper)
 * @param supabase - Admin Supabase client (bypasses RLS)
 * @param options - Sync options (dual-write, margin threshold)
 * @returns SyncResult with action taken and any error
 */
export async function syncProductFromProvider(
  product: CanonicalProduct,
  supabase: SupabaseClient,
  options?: SyncOptions,
): Promise<SyncResult> {
  const providerProductId = product.externalId
  if (!providerProductId) {
    return { action: 'skipped', providerProductId: '', error: 'No product ID' }
  }

  const title = product.title || 'Untitled'
  // Description is already plain-text from the mapper, but double-check for any HTML remnants
  const description = (product.description || '')
    .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim().slice(0, 2000)
  const visible = product.status === 'active'

  // Extract minimum variant cost (already in EUR cents from mapper)
  const variants = product.variants || []
  const costs = variants
    .map(v => v.costCents)
    .filter((c): c is number => c != null && c > 0)
  const minCost = costs.length ? Math.min(...costs) : 0

  // Extract min price from ENABLED variants only (disabled ones default to cost)
  const enabledVariants = variants.filter(v => v.isEnabled)
  const prices = (enabledVariants.length ? enabledVariants : variants)
    .map(v => v.priceCents)
    .filter(p => p > 0)
  const minPrice = prices.length ? Math.min(...prices) : 0

  // Use agent-set price if available, else compute from cost
  const basePrice = minPrice > 0
    ? minPrice
    : minCost > 0
      ? calculateEngagementPrice(minCost, title)
      : 2999

  // Normalize images to [{src, alt, variant_ids}], deduplicated by URL
  const rawImages = product.images || []
  const seenSrcs = new Set<string>()
  const images = rawImages
    .map(img => {
      const src = img.src || ''
      if (!src || src.includes('size-chart') || src.includes('size_chart')) return null
      // Deduplicate: same mockup URL appears once per variant
      const baseUrl = src.split('?')[0]
      if (seenSrcs.has(baseUrl)) return null
      seenSrcs.add(baseUrl)
      return { src, alt: img.alt || title, variant_ids: img.variantIds || [], is_default: img.isDefault }
    })
    .filter(Boolean)

  const status = visible ? 'active' : 'draft'

  // Parse blueprint reference
  const blueprintParsed = parseBlueprintRef(product.blueprintRef)

  // Extract safety_information from raw provider data if available
  const rawProduct = product._raw as Record<string, unknown> | undefined
  const safetyInfo = rawProduct?.safety_information as string | undefined
  const existingDetails = {} as Record<string, unknown>
  if (safetyInfo) {
    existingDetails.safety_information = safetyInfo
  }

  // Lookup existing product by provider_product_id
  let existingProduct: Record<string, unknown> | null = null

  {
    const { data } = await supabase
      .from('products')
      .select('id, title, description, tags, admin_edited_at, last_synced_at, category_id, product_details, slug')
      .eq('provider_product_id', providerProductId)
      .single()
    existingProduct = data
  }

  // Generate slug for NEW products only (immutable — never overwrite existing)
  let slugField: { slug?: string } = {}
  if (!existingProduct) {
    let base = slugify(title)
    if (!base) base = 'product'
    // Collision check
    const { data: existing } = await supabase
      .from('products')
      .select('slug')
      .like('slug', `${base}%`)
    const usedSlugs = new Set((existing || []).map((p: { slug: string }) => p.slug))
    let candidate = base
    let counter = 1
    while (usedSlugs.has(candidate)) {
      candidate = `${base}-${counter++}`
    }
    slugField = { slug: candidate }
  }

  // Determine if admin edits should be preserved
  const preserveAdminEdits = existingProduct
    ? shouldPreserveAdminEdits({
        admin_edited_at: existingProduct.admin_edited_at as string | null,
        last_synced_at: existingProduct.last_synced_at as string | null,
      })
    : false

  // Only infer category for NEW products — never overwrite existing categories
  const categoryFields = existingProduct?.category_id
    ? {} // preserve existing category
    : await inferCategoryId(title, supabase)

  // Build row with conditional preservation of admin-edited fields
  const row: Record<string, unknown> = {
    ...slugField,
    // New provider-agnostic columns
    provider_product_id: providerProductId,
    pod_provider: blueprintParsed.provider || 'printful',
    product_template_id: blueprintParsed.productTemplateId,
    provider_facility_id: blueprintParsed.providerFacilityId,
    // Preserve admin edits for title, description, tags if admin_edited_at > last_synced_at
    title: preserveAdminEdits && existingProduct?.title ? existingProduct.title : title,
    description: preserveAdminEdits && existingProduct?.description ? existingProduct.description : description,
    tags: preserveAdminEdits && existingProduct?.tags ? existingProduct.tags : (product.tags || []),
    // Always sync price, status, images, and cost
    status,
    currency: STORE_CURRENCY,
    cost_cents: minCost || null,
    base_price_cents: basePrice,
    images,
    ...categoryFields,
    // Merge product_details: preserve existing, add safety_information from provider
    ...(Object.keys(existingDetails).length > 0
      ? { product_details: { ...(existingProduct?.product_details as Record<string, unknown> || {}), ...existingDetails } }
      : {}),
    // Update last_synced_at timestamp
    last_synced_at: new Date().toISOString(),
    ...(visible ? { published_at: new Date().toISOString() } : {}),
  }

  if (preserveAdminEdits && existingProduct) {
    const adminEditAt = existingProduct.admin_edited_at as string | null
    const lastSyncAt = existingProduct.last_synced_at as string | null
    console.log(`pod-sync: preserving admin edits for ${providerProductId} (admin_edited_at: ${adminEditAt}, last_synced_at: ${lastSyncAt})`)
  }

  const { data, error } = await supabase
    .from('products')
    .upsert(row, { onConflict: 'provider_product_id' })
    .select('id')

  if (error) {
    console.error('pod-sync: upsert failed', providerProductId, error.message)
    return { action: 'skipped', providerProductId, error: error.message }
  }

  const productId = data?.[0]?.id
  const action = data && data.length > 0 ? 'created' : 'updated'

  // Sync variants to product_variants table
  if (productId && variants.length > 0) {
    await syncVariantsFromProvider(supabase, productId, providerProductId, variants)
  }

  console.log(`pod-sync: ${action} product`, providerProductId, title.slice(0, 50))
  return { action, providerProductId }
}

// ---------------------------------------------------------------------------
// Variant Sync
// ---------------------------------------------------------------------------

/**
 * Upsert variants from CanonicalVariant array into product_variants table.
 * Color and size are already parsed by the provider mapper.
 */
async function syncVariantsFromProvider(
  supabase: SupabaseClient,
  productId: string,
  providerProductId: string,
  variants: CanonicalVariant[],
): Promise<void> {
  const rows = variants
    .filter(v => v.isEnabled !== false)
    .map(v => ({
      product_id: productId,
      external_variant_id: v.externalId,
      title: v.title,
      size: v.size,
      color: v.color,
      price_cents: v.priceCents > 0 ? v.priceCents : null,
      cost_cents: v.costCents,
      sku: v.sku || '',
      is_enabled: v.isEnabled !== false,
      is_available: v.isAvailable !== false,
      image_url: v.imageUrl || null,
    }))

  if (rows.length === 0) return

  const { error } = await supabase
    .from('product_variants')
    .upsert(rows, {
      onConflict: 'product_id,external_variant_id',
      ignoreDuplicates: false,
    })

  if (error) {
    console.error('pod-sync: variant upsert failed', providerProductId, error.message)
  } else {
    console.log(`pod-sync: synced ${rows.length} variants for`, providerProductId)
  }
}
