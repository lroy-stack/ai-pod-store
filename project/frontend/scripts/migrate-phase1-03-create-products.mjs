/**
 * migrate-phase1-03-create-products.mjs
 *
 * Phase 1 Step 3: Create 20 Printful sync products for t-shirts.
 *
 * - Reads phase1-audit.json for product mapping (tier, colors, prices)
 * - Reads printful-phase1-file-map.json for uploaded design file IDs
 * - Fetches Printful catalog variants for MC1087 (917) and CC1717 (586)
 * - Creates sync products with correct variant_ids, retail_prices, and file placements
 * - Outputs: scripts/printful-phase1-products.json
 *
 * Supports --dry-run and --resume.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-03-create-products.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-03-create-products.mjs
 *   cd frontend && node scripts/migrate-phase1-03-create-products.mjs --resume
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const RESUME = process.argv.includes('--resume')

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const PRINTFUL_TOKEN = env('PRINTFUL_API_TOKEN')
const PRINTFUL_STORE = env('PRINTFUL_STORE_ID')

if (!PRINTFUL_TOKEN || !PRINTFUL_STORE) {
  console.error('ERROR: PRINTFUL_API_TOKEN and PRINTFUL_STORE_ID required in .env.local')
  process.exit(1)
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DELAY_MS = 2000
const MAX_RETRIES = 3

const AUDIT_PATH = join(ROOT, 'scripts', 'phase1-audit.json')
const FILE_MAP_PATH = join(ROOT, 'scripts', 'printful-phase1-file-map.json')
const OUTPUT_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')

// Printful catalog IDs
const CATALOG_IDS = {
  premium: 917,   // Cotton Heritage MC1087
  signature: 586, // Comfort Colors 1717
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ─── Printful Fetch ─────────────────────────────────────────────────────────────

async function printfulFetch(path, options = {}, retries = MAX_RETRIES) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': PRINTFUL_STORE,
      'User-Agent': 'SKAPARA-POD/1.0',
      ...options.headers,
    },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    console.log(`    Rate limited, waiting ${retryAfter}s...`)
    await delay(retryAfter * 1000)
    if (retries > 0) return printfulFetch(path, options, retries - 1)
    throw new Error(`Rate limited on ${path} after ${MAX_RETRIES} retries`)
  }

  if (res.status >= 500 && retries > 0) {
    const backoff = (MAX_RETRIES - retries + 1) * 2000
    console.log(`    Server error ${res.status}, retrying in ${backoff / 1000}s...`)
    await delay(backoff)
    return printfulFetch(path, options, retries - 1)
  }

  const json = await res.json()

  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(
      `Printful ${res.status}: ${json.error?.message || json.message || JSON.stringify(json).slice(0, 500)}`
    )
  }

  return json.result !== undefined ? json.result : json
}

// ─── Fetch Catalog Variants ─────────────────────────────────────────────────────

const variantCache = new Map()

async function getCatalogVariants(catalogProductId) {
  const key = String(catalogProductId)
  if (variantCache.has(key)) return variantCache.get(key)

  await delay(DELAY_MS)
  const product = await printfulFetch(`/products/${catalogProductId}`)
  const variants = product.variants || []
  variantCache.set(key, variants)
  return variants
}

// ─── Match Variant by Color + Size ──────────────────────────────────────────────

function normalizeColor(color) {
  if (!color) return ''
  return color.toLowerCase().trim()
}

function normalizeSize(size) {
  if (!size) return ''
  return size.toLowerCase().trim()
}

function findVariant(variants, color, size) {
  const nc = normalizeColor(color)
  const ns = normalizeSize(size)

  // Exact match
  let match = variants.find(v =>
    normalizeColor(v.color) === nc && normalizeSize(v.size) === ns
  )
  if (match) return match

  // Fuzzy: one contains the other
  match = variants.find(v => {
    const vc = normalizeColor(v.color)
    return (vc.includes(nc) || nc.includes(vc)) && normalizeSize(v.size) === ns
  })
  return match || null
}

// ─── Build Sync Product Payload ─────────────────────────────────────────────────

function buildPayload(product, catalogId, matchedVariants, fileMap) {
  const slug = slugify(product.title)
  const tier = product.tier

  // Build file assignments per variant
  const frontFileKey = `front-${slug}`
  const frontFile = fileMap[frontFileKey]
  const labelFile = fileMap['label-outside-smark-white']
  const backFile = fileMap['back-wordmark-white']

  const syncVariants = matchedVariants.map(mv => {
    const variant = {
      external_id: mv.supabaseVariantId || `${product.id}-${mv.color}-${mv.size}`,
      variant_id: mv.printfulVariantId,
      retail_price: (mv.priceUsdCents / 100).toFixed(2),
      is_enabled: true,
      files: [],
    }

    // Front design
    if (frontFile) {
      variant.files.push({
        type: 'front',
        id: frontFile.id,
      })
    }

    // PREMIUM: front + back (label_outside conflicts with back on MC1087)
    // SIGNATURE: front + label_outside
    if (tier === 'premium' && backFile) {
      variant.files.push({
        type: 'back',
        id: backFile.id,
      })
    } else if (labelFile) {
      variant.files.push({
        type: 'label_outside',
        id: labelFile.id,
      })
    }

    return variant
  })

  return {
    sync_product: {
      external_id: product.id,
      name: product.title,
      thumbnail: null,
    },
    sync_variants: syncVariants,
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 3: Create Printful Sync Products      ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no products will be created ***')
  console.log()

  // Load inputs
  if (!existsSync(AUDIT_PATH)) {
    console.error('ERROR: phase1-audit.json not found. Run step 0 first.')
    process.exit(1)
  }
  if (!existsSync(FILE_MAP_PATH)) {
    console.error('ERROR: printful-phase1-file-map.json not found. Run step 2 first.')
    process.exit(1)
  }

  const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8'))
  const fileMap = JSON.parse(readFileSync(FILE_MAP_PATH, 'utf8'))
  console.log(`  Loaded: ${audit.totalProducts} products, ${Object.keys(fileMap).length} files`)

  // Load existing results (for resume)
  let results = {}
  if (RESUME && existsSync(OUTPUT_PATH)) {
    results = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
    console.log(`  Resuming: ${Object.keys(results).length} products already processed`)
  }

  // Fetch catalog variants for both blanks
  console.log()
  console.log('→ Fetching Printful catalog variants...')

  const mc1087Variants = await getCatalogVariants(CATALOG_IDS.premium)
  console.log(`  MC1087 (917): ${mc1087Variants.length} variants`)

  const cc1717Variants = await getCatalogVariants(CATALOG_IDS.signature)
  console.log(`  CC1717 (586): ${cc1717Variants.length} variants`)

  // Filter to EU-available variants only
  const mc1087EU = mc1087Variants.filter(v => v.availability_status?.some(a => a.region === 'EU'))
  const cc1717EU = cc1717Variants.filter(v => v.availability_status?.some(a => a.region === 'EU'))

  // If availability_status is not present, use all variants (Printful may not include it)
  const mc1087Final = mc1087EU.length > 0 ? mc1087EU : mc1087Variants
  const cc1717Final = cc1717EU.length > 0 ? cc1717EU : cc1717Variants

  console.log(`  MC1087 EU-available: ${mc1087Final.length}`)
  console.log(`  CC1717 EU-available: ${cc1717Final.length}`)

  // Process each product
  console.log()
  console.log('→ Creating sync products...')
  let created = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < audit.products.length; i++) {
    const product = audit.products[i]
    const progress = `[${i + 1}/${audit.products.length}]`

    // Skip if already processed (resume)
    if (results[product.id]?.status === 'ok') {
      console.log(`${progress} ⊘ ${product.title}: already created`)
      skipped++
      continue
    }

    const tier = product.tier
    const catalogId = CATALOG_IDS[tier]
    const catalogVariants = tier === 'premium' ? mc1087Final : cc1717Final
    const targetColors = product.new_colors
    const targetSizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']
    const priceMap = product.new_price_usd_cents

    // Match variants
    const matchedVariants = []
    const unmatchedVariants = []

    for (const color of targetColors) {
      for (const size of targetSizes) {
        const pfVariant = findVariant(catalogVariants, color, size)
        if (pfVariant) {
          matchedVariants.push({
            color,
            size,
            printfulVariantId: pfVariant.id,
            priceUsdCents: priceMap[size] || priceMap['S'],
            supabaseVariantId: null, // Will be created in step 4
          })
        } else {
          unmatchedVariants.push({ color, size })
        }
      }
    }

    console.log(`${progress} ${product.title} (${tier.toUpperCase()}): ${matchedVariants.length} variants matched, ${unmatchedVariants.length} unmatched`)

    if (matchedVariants.length === 0) {
      console.log(`  ✗ No variants matched — skipping`)
      results[product.id] = {
        title: product.title,
        tier,
        status: 'failed',
        error: 'No variant matches found',
        unmatchedVariants,
      }
      failed++
      continue
    }

    if (unmatchedVariants.length > 0) {
      console.log(`  ⚠ Unmatched: ${unmatchedVariants.map(v => `${v.color}/${v.size}`).join(', ')}`)
    }

    // Build payload
    const payload = buildPayload(product, catalogId, matchedVariants, fileMap)

    if (DRY_RUN) {
      console.log(`  → Would create: ${payload.sync_variants.length} variants, files: ${payload.sync_variants[0]?.files?.length || 0} per variant`)
      results[product.id] = {
        title: product.title,
        tier,
        catalogId,
        status: 'dry_run',
        variantsMatched: matchedVariants.length,
        variantsUnmatched: unmatchedVariants.length,
        filesPerVariant: payload.sync_variants[0]?.files?.length || 0,
      }
      continue
    }

    // Create sync product
    try {
      await delay(DELAY_MS)
      const result = await printfulFetch('/store/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const syncProductId = result.id || result.sync_product?.id

      // Fetch the full product to get variant details
      await delay(1500)
      let syncVariants = []
      try {
        const full = await printfulFetch(`/store/products/${syncProductId}`)
        syncVariants = full.sync_variants || []
      } catch {
        console.log(`    (Could not fetch variant details, continuing)`)
      }

      results[product.id] = {
        title: product.title,
        tier,
        catalogId,
        syncProductId,
        status: 'ok',
        variantsCreated: result.variants || syncVariants.length,
        variantsUnmatched: unmatchedVariants.length,
        syncVariants: syncVariants.map(sv => ({
          syncVariantId: sv.id,
          variantId: sv.variant_id,
          retailPrice: sv.retail_price,
        })),
        createdAt: new Date().toISOString(),
      }

      created++
      console.log(`  ✓ Created: syncProductId=${syncProductId}, ${syncVariants.length} variants`)

      // Save progress
      writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}`)
      results[product.id] = {
        title: product.title,
        tier,
        status: 'failed',
        error: err.message,
      }
      failed++

      // Save progress even on failure
      writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))
    }
  }

  // Final save
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))

  // Summary
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  CREATE PRODUCTS SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Created:  ${created}`)
  console.log(`  Skipped:  ${skipped}`)
  console.log(`  Failed:   ${failed}`)
  console.log(`  Output:   ${OUTPUT_PATH}`)
  console.log()

  if (failed > 0) {
    console.log('  ⚠ Some products failed. Re-run with --resume to retry.')
  } else if (!DRY_RUN) {
    console.log('  Next step: node scripts/migrate-phase1-04-update-supabase.mjs --dry-run')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
