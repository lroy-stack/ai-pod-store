/**
 * DivergenceDetector — Catalog consistency detection module
 *
 * Detects inconsistencies between POD provider catalog data (remote source of truth)
 * and local Supabase database records. Used to identify products that have
 * diverged due to sync failures, webhook drops, or manual changes.
 *
 * @module reliability/divergence-detector
 */

import { getProvider, initializeProviders } from '@/lib/pod'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Extract blueprint_id from blueprintRef like "printify:6:26" */
function extractBlueprintId(blueprintRef: string | null): number | null {
  if (!blueprintRef) return null
  const parts = blueprintRef.split(':')
  return parts.length >= 2 ? parseInt(parts[1], 10) : null
}

/** Extract print_provider_id from blueprintRef like "printify:6:26" */
function extractProviderId(blueprintRef: string | null): number | null {
  if (!blueprintRef) return null
  const parts = blueprintRef.split(':')
  return parts.length >= 3 ? parseInt(parts[2], 10) : null
}

export interface Divergence {
  productId: string
  field: string
  localValue: any
  remoteValue: any
}

export interface DivergenceDetectionResult {
  divergences: Divergence[]
  totalProductsChecked: number
  totalDivergencesFound: number
  error?: string
}

/**
 * Detect divergences between POD provider catalog and local database
 *
 * Compares key fields between remote provider products and local Supabase products.
 * Only checks products that have a provider_product_id (i.e., synced products).
 *
 * Fields compared:
 * - Product: title, description, product_template_id, provider_facility_id
 * - Variants: title, price_cents, is_enabled
 */
export async function detectDivergence(): Promise<DivergenceDetectionResult> {
  const divergences: Divergence[] = []
  let totalProductsChecked = 0

  try {
    initializeProviders()

    // Step 1: Fetch all products from local database that have a provider_product_id
    console.log('[DivergenceDetector] Fetching local products from database')
    const { data: localProducts, error: dbError } = await supabaseAdmin
      .from('products')
      .select('id, provider_product_id, title, description, product_template_id, provider_facility_id, base_price_cents')
      .not('provider_product_id', 'is', null)

    if (dbError) {
      console.error('[DivergenceDetector] Database error:', dbError)
      return {
        divergences: [],
        totalProductsChecked: 0,
        totalDivergencesFound: 0,
        error: dbError.message,
      }
    }

    if (!localProducts || localProducts.length === 0) {
      console.log('[DivergenceDetector] No products with provider_product_id found')
      return {
        divergences: [],
        totalProductsChecked: 0,
        totalDivergencesFound: 0,
      }
    }

    console.log(`[DivergenceDetector] Found ${localProducts.length} local products to check`)

    // Step 2: For each local product, fetch from provider and compare
    for (const localProduct of localProducts) {
      totalProductsChecked++

      try {
        const providerProductId = localProduct.provider_product_id!
        const remoteProduct = await getProvider().getProduct(providerProductId)

        // Compare product-level fields
        if (remoteProduct.title && localProduct.title !== remoteProduct.title) {
          divergences.push({
            productId: localProduct.id,
            field: 'title',
            localValue: localProduct.title,
            remoteValue: remoteProduct.title,
          })
        }

        if (remoteProduct.description && localProduct.description !== remoteProduct.description) {
          divergences.push({
            productId: localProduct.id,
            field: 'description',
            localValue: localProduct.description,
            remoteValue: remoteProduct.description,
          })
        }

        const remoteBlueprintId = extractBlueprintId(remoteProduct.blueprintRef)
        const localBlueprintId = localProduct.product_template_id ? Number(localProduct.product_template_id) : null
        if (
          remoteBlueprintId !== null &&
          localBlueprintId !== remoteBlueprintId
        ) {
          divergences.push({
            productId: localProduct.id,
            field: 'blueprint_id',
            localValue: localBlueprintId,
            remoteValue: remoteBlueprintId,
          })
        }

        const remoteProviderId = extractProviderId(remoteProduct.blueprintRef)
        const localProviderId = localProduct.provider_facility_id ? Number(localProduct.provider_facility_id) : null
        if (
          remoteProviderId !== null &&
          localProviderId !== remoteProviderId
        ) {
          divergences.push({
            productId: localProduct.id,
            field: 'print_provider_id',
            localValue: localProviderId,
            remoteValue: remoteProviderId,
          })
        }

        // Step 3: Compare variants
        if (Array.isArray(remoteProduct.variants)) {
          const { data: localVariants, error: variantsError } = await supabaseAdmin
            .from('product_variants')
            .select('id, external_variant_id, title, price_cents, is_enabled')
            .eq('product_id', localProduct.id)

          if (variantsError) {
            console.error('[DivergenceDetector] Variants fetch error:', variantsError)
            continue
          }

          const variantMap = new Map(
            localVariants?.map((v) => [v.external_variant_id?.toString(), v]) || []
          )

          for (const remoteVariant of remoteProduct.variants) {
            const localVariant = variantMap.get(remoteVariant.externalId)

            if (!localVariant) {
              // Variant exists in provider but not in local DB
              divergences.push({
                productId: localProduct.id,
                field: 'variant_missing',
                localValue: null,
                remoteValue: remoteVariant.externalId,
              })
              continue
            }

            // Compare variant title
            if (remoteVariant.title && localVariant.title !== remoteVariant.title) {
              divergences.push({
                productId: localProduct.id,
                field: `variant_${remoteVariant.externalId}_title`,
                localValue: localVariant.title,
                remoteValue: remoteVariant.title,
              })
            }

            // Compare variant price (priceCents is already in cents)
            if (remoteVariant.priceCents !== undefined) {
              if (localVariant.price_cents !== remoteVariant.priceCents) {
                divergences.push({
                  productId: localProduct.id,
                  field: `variant_${remoteVariant.externalId}_price`,
                  localValue: localVariant.price_cents,
                  remoteValue: remoteVariant.priceCents,
                })
              }
            }

            // Compare variant enabled status
            if (
              remoteVariant.isEnabled !== undefined &&
              localVariant.is_enabled !== remoteVariant.isEnabled
            ) {
              divergences.push({
                productId: localProduct.id,
                field: `variant_${remoteVariant.externalId}_enabled`,
                localValue: localVariant.is_enabled,
                remoteValue: remoteVariant.isEnabled,
              })
            }
          }
        }
      } catch (productError: any) {
        // Log error but continue checking other products
        console.error(
          `[DivergenceDetector] Error checking product ${localProduct.provider_product_id}:`,
          productError
        )

        // If product not found in provider (404), it may have been deleted
        if (productError?.message?.includes('404')) {
          divergences.push({
            productId: localProduct.id,
            field: 'product_deleted',
            localValue: 'exists',
            remoteValue: 'not_found',
          })
        }

        continue
      }
    }

    console.log(
      `[DivergenceDetector] Detection complete: ${divergences.length} divergences found`
    )

    return {
      divergences,
      totalProductsChecked,
      totalDivergencesFound: divergences.length,
    }
  } catch (err: any) {
    console.error('[DivergenceDetector] Unexpected error:', err)
    return {
      divergences: [],
      totalProductsChecked,
      totalDivergencesFound: 0,
      error: err?.message || 'Unexpected error during divergence detection',
    }
  }
}

/**
 * Detect divergences for a specific product
 *
 * @param productId - UUID of the local product to check
 * @returns Promise<Divergence[]> - Array of divergences for this product
 */
export async function detectProductDivergence(productId: string): Promise<Divergence[]> {
  const divergences: Divergence[] = []

  try {
    initializeProviders()

    const { data: localProduct, error: dbError } = await supabaseAdmin
      .from('products')
      .select('id, provider_product_id, title, description, product_template_id, provider_facility_id, base_price_cents')
      .eq('id', productId)
      .single()

    if (dbError || !localProduct) {
      console.error('[DivergenceDetector] Product not found:', productId)
      return divergences
    }

    const providerProductId = localProduct.provider_product_id
    if (!providerProductId) {
      console.log('[DivergenceDetector] Product has no provider_product_id, skipping')
      return divergences
    }

    // Fetch remote product
    const remoteProduct = await getProvider().getProduct(providerProductId)

    // Compare fields (same logic as detectDivergence)
    if (remoteProduct.title && localProduct.title !== remoteProduct.title) {
      divergences.push({
        productId: localProduct.id,
        field: 'title',
        localValue: localProduct.title,
        remoteValue: remoteProduct.title,
      })
    }

    if (remoteProduct.description && localProduct.description !== remoteProduct.description) {
      divergences.push({
        productId: localProduct.id,
        field: 'description',
        localValue: localProduct.description,
        remoteValue: remoteProduct.description,
      })
    }

    const remoteBlueprintId = extractBlueprintId(remoteProduct.blueprintRef)
    const localBlueprintId2 = localProduct.product_template_id ? Number(localProduct.product_template_id) : null
    if (
      remoteBlueprintId !== null &&
      localBlueprintId2 !== remoteBlueprintId
    ) {
      divergences.push({
        productId: localProduct.id,
        field: 'blueprint_id',
        localValue: localBlueprintId2,
        remoteValue: remoteBlueprintId,
      })
    }

    const remoteProviderId = extractProviderId(remoteProduct.blueprintRef)
    const localProviderId2 = localProduct.provider_facility_id ? Number(localProduct.provider_facility_id) : null
    if (
      remoteProviderId !== null &&
      localProviderId2 !== remoteProviderId
    ) {
      divergences.push({
        productId: localProduct.id,
        field: 'print_provider_id',
        localValue: localProviderId2,
        remoteValue: remoteProviderId,
      })
    }

    return divergences
  } catch (err: any) {
    console.error('[DivergenceDetector] Error detecting product divergence:', err)
    return divergences
  }
}
