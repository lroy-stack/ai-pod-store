/**
 * DivergenceDetector — Catalog consistency detection module
 *
 * Detects inconsistencies between Printify catalog data (remote source of truth)
 * and local Supabase database records. Used to identify products that have
 * diverged due to sync failures, webhook drops, or manual changes.
 *
 * @module reliability/divergence-detector
 */

import { printify } from '@/lib/printify'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
 * Detect divergences between Printify catalog and local database
 *
 * Compares key fields between remote Printify products and local Supabase products.
 * Only checks products that have a printify_id (i.e., synced products).
 *
 * Fields compared:
 * - Product: title, description, blueprint_id, print_provider_id
 * - Variants: title, price_cents, is_enabled
 *
 * @returns Promise<DivergenceDetectionResult> - Array of divergences and summary stats
 *
 * @example
 * ```typescript
 * const result = await detectDivergence()
 * if (result.error) {
 *   console.error('Detection failed:', result.error)
 * } else {
 *   console.log(`Found ${result.totalDivergencesFound} divergences across ${result.totalProductsChecked} products`)
 *   result.divergences.forEach(d => {
 *     console.log(`Product ${d.productId}: ${d.field} changed from "${d.localValue}" to "${d.remoteValue}"`)
 *   })
 * }
 * ```
 */
export async function detectDivergence(): Promise<DivergenceDetectionResult> {
  const divergences: Divergence[] = []
  let totalProductsChecked = 0

  try {
    // Step 1: Fetch all products from local database that have a printify_id
    console.log('[DivergenceDetector] Fetching local products from database')
    const { data: localProducts, error: dbError } = await supabaseAdmin
      .from('products')
      .select('id, printify_id, title, description, blueprint_id, print_provider_id, base_price_cents')
      .not('printify_id', 'is', null)

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
      console.log('[DivergenceDetector] No products with printify_id found')
      return {
        divergences: [],
        totalProductsChecked: 0,
        totalDivergencesFound: 0,
      }
    }

    console.log(`[DivergenceDetector] Found ${localProducts.length} local products to check`)

    // Step 2: For each local product, fetch from Printify and compare
    for (const localProduct of localProducts) {
      totalProductsChecked++

      try {
        // Fetch remote product data from Printify
        const remoteProduct = await printify.getProduct(localProduct.printify_id!)

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

        if (
          remoteProduct.blueprint_id &&
          localProduct.blueprint_id !== remoteProduct.blueprint_id
        ) {
          divergences.push({
            productId: localProduct.id,
            field: 'blueprint_id',
            localValue: localProduct.blueprint_id,
            remoteValue: remoteProduct.blueprint_id,
          })
        }

        if (
          remoteProduct.print_provider_id &&
          localProduct.print_provider_id !== remoteProduct.print_provider_id
        ) {
          divergences.push({
            productId: localProduct.id,
            field: 'print_provider_id',
            localValue: localProduct.print_provider_id,
            remoteValue: remoteProduct.print_provider_id,
          })
        }

        // Step 3: Compare variants
        if (Array.isArray(remoteProduct.variants)) {
          // Fetch local variants for this product
          const { data: localVariants, error: variantsError } = await supabaseAdmin
            .from('product_variants')
            .select('id, printify_variant_id, title, price_cents, is_enabled')
            .eq('product_id', localProduct.id)

          if (variantsError) {
            console.error('[DivergenceDetector] Variants fetch error:', variantsError)
            continue
          }

          // Build a map of printify_variant_id -> local variant
          const variantMap = new Map(
            localVariants?.map((v) => [v.printify_variant_id?.toString(), v]) || []
          )

          // Compare each remote variant with local variant
          for (const remoteVariant of remoteProduct.variants as Array<{
            id: number
            title?: string
            price?: number
            is_enabled?: boolean
          }>) {
            const localVariant = variantMap.get(remoteVariant.id.toString())

            if (!localVariant) {
              // Variant exists in Printify but not in local DB
              divergences.push({
                productId: localProduct.id,
                field: 'variant_missing',
                localValue: null,
                remoteValue: remoteVariant.id,
              })
              continue
            }

            // Compare variant title
            if (remoteVariant.title && localVariant.title !== remoteVariant.title) {
              divergences.push({
                productId: localProduct.id,
                field: `variant_${remoteVariant.id}_title`,
                localValue: localVariant.title,
                remoteValue: remoteVariant.title,
              })
            }

            // Compare variant price (convert Printify dollars to cents)
            if (remoteVariant.price !== undefined) {
              const remotePriceCents = Math.round(remoteVariant.price * 100)
              if (localVariant.price_cents !== remotePriceCents) {
                divergences.push({
                  productId: localProduct.id,
                  field: `variant_${remoteVariant.id}_price`,
                  localValue: localVariant.price_cents,
                  remoteValue: remotePriceCents,
                })
              }
            }

            // Compare variant enabled status
            if (
              remoteVariant.is_enabled !== undefined &&
              localVariant.is_enabled !== remoteVariant.is_enabled
            ) {
              divergences.push({
                productId: localProduct.id,
                field: `variant_${remoteVariant.id}_enabled`,
                localValue: localVariant.is_enabled,
                remoteValue: remoteVariant.is_enabled,
              })
            }
          }
        }
      } catch (productError: any) {
        // Log error but continue checking other products
        console.error(
          `[DivergenceDetector] Error checking product ${localProduct.printify_id}:`,
          productError
        )

        // If product not found in Printify (404), it may have been deleted
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
    // Fetch local product
    const { data: localProduct, error: dbError } = await supabaseAdmin
      .from('products')
      .select('id, printify_id, title, description, blueprint_id, print_provider_id, base_price_cents')
      .eq('id', productId)
      .single()

    if (dbError || !localProduct) {
      console.error('[DivergenceDetector] Product not found:', productId)
      return divergences
    }

    if (!localProduct.printify_id) {
      console.log('[DivergenceDetector] Product has no printify_id, skipping')
      return divergences
    }

    // Fetch remote product
    const remoteProduct = await printify.getProduct(localProduct.printify_id)

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

    if (
      remoteProduct.blueprint_id &&
      localProduct.blueprint_id !== remoteProduct.blueprint_id
    ) {
      divergences.push({
        productId: localProduct.id,
        field: 'blueprint_id',
        localValue: localProduct.blueprint_id,
        remoteValue: remoteProduct.blueprint_id,
      })
    }

    if (
      remoteProduct.print_provider_id &&
      localProduct.print_provider_id !== remoteProduct.print_provider_id
    ) {
      divergences.push({
        productId: localProduct.id,
        field: 'print_provider_id',
        localValue: localProduct.print_provider_id,
        remoteValue: remoteProduct.print_provider_id,
      })
    }

    return divergences
  } catch (err: any) {
    console.error('[DivergenceDetector] Error detecting product divergence:', err)
    return divergences
  }
}
