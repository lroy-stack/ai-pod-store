/**
 * migrate-03-create-sync-products.mjs
 *
 * Block 2D — Script 3: Create Printful Sync Products
 *
 * Creates Printful sync products for all active SKAPARA products.
 * Reads from Supabase, maps to Printful catalog variants, creates sync products,
 * and updates Supabase with new provider IDs.
 *
 * Input:  printful-catalog-map.json, printful-file-map.json, Supabase DB
 * Output: frontend/scripts/migration-results.json
 * Flags:  --dry-run, --resume, --provider p410|p26|p86|p23|p90,
 *         --product-id <uuid>, --all
 *
 * Usage:
 *   cd frontend && node scripts/migrate-03-create-sync-products.mjs --dry-run
 *   cd frontend && node scripts/migrate-03-create-sync-products.mjs --provider p410
 *   cd frontend && node scripts/migrate-03-create-sync-products.mjs --provider p26
 *   cd frontend && node scripts/migrate-03-create-sync-products.mjs --product-id <uuid>
 *   cd frontend && node scripts/migrate-03-create-sync-products.mjs --all
 *   cd frontend && node scripts/migrate-03-create-sync-products.mjs --all --resume
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const RESUME = process.argv.includes('--resume')
const ALL = process.argv.includes('--all')

const providerArgIdx = process.argv.indexOf('--provider')
const PROVIDER_FILTER = providerArgIdx !== -1 ? process.argv[providerArgIdx + 1] : null

const productIdArgIdx = process.argv.indexOf('--product-id')
const PRODUCT_ID_FILTER = productIdArgIdx !== -1 ? process.argv[productIdArgIdx + 1] : null

if (!ALL && !PROVIDER_FILTER && !PRODUCT_ID_FILTER && !DRY_RUN) {
  console.error('ERROR: Specify --all, --provider <p410|p26|p86|p23|p90>, or --product-id <uuid>')
  console.error('       Add --dry-run to validate without creating products.')
  process.exit(1)
}

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const PRINTFUL_TOKEN = env('PRINTFUL_API_TOKEN')
const PRINTFUL_STORE = env('PRINTFUL_STORE_ID')
const SUPABASE_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')

if (!PRINTFUL_TOKEN || !PRINTFUL_STORE) {
  console.error('ERROR: PRINTFUL_API_TOKEN and PRINTFUL_STORE_ID required in .env.local')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required in .env.local')
  process.exit(1)
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DELAY_MS = 2000
const MAX_RETRIES = 3

// Provider ID mapping: shorthand -> numeric
const PROVIDER_IDS = {
  p26: 26,
  p410: 410,
  p86: 86,
  p23: 23,
  p90: 90,
}

// Color name overrides: Printify name -> Printful name
const COLOR_OVERRIDES = {
  'Sport Grey': 'Sports Grey',
  'Antique Cherry Red': 'Antique Cherry',
  'Irish Green': 'Irish Green',
  'Heather Sapphire': 'Heather Sapphire',
  'Charcoal': 'Charcoal',
  'Anthracite': 'Anthracite',
}

// Printify position name -> Printful placement name (from constants.ts)
const POSITION_MAP = {
  front: 'front',
  back: 'back',
  neck_outer: 'label_outside',
  sleeve: 'sleeve_left',
  sleeve_left: 'sleeve_left',
  sleeve_right: 'sleeve_right',
  embroidery_front: 'embroidery_front',
  embroidery_back: 'embroidery_back',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── File Paths ─────────────────────────────────────────────────────────────────

const CATALOG_MAP_PATH = join(ROOT, 'scripts', 'printful-catalog-map.json')
const FILE_MAP_PATH = join(ROOT, 'scripts', 'printful-file-map.json')
const RESULTS_PATH = join(ROOT, 'scripts', 'migration-results.json')

// ─── Load Input Files ───────────────────────────────────────────────────────────

function loadJSON(path, name) {
  if (!existsSync(path)) {
    console.error(`ERROR: ${name} not found at ${path}`)
    console.error('  Run the previous migration script first.')
    process.exit(1)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
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

// ─── Supabase Fetch ─────────────────────────────────────────────────────────────

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  }

  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

async function supabaseUpdate(table, id, data) {
  return supabaseFetch(`/${table}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    prefer: 'return=minimal',
  })
}

// ─── Fetch Products from Supabase ───────────────────────────────────────────────

async function fetchProducts() {
  let query = '/products?status=eq.active&select=*,product_variants(*)'

  if (PRODUCT_ID_FILTER) {
    query = `/products?id=eq.${PRODUCT_ID_FILTER}&select=*,product_variants(*)`
  } else if (PROVIDER_FILTER) {
    const providerId = PROVIDER_IDS[PROVIDER_FILTER.toLowerCase()]
    if (!providerId) {
      console.error(`ERROR: Unknown provider "${PROVIDER_FILTER}". Use p26, p410, p86, p23, or p90.`)
      process.exit(1)
    }
    query = `/products?status=eq.active&print_provider_id=eq.${providerId}&select=*,product_variants(*)`
  }

  // Supabase REST API returns max 1000 rows by default
  query += '&order=created_at.asc&limit=1000'

  const products = await supabaseFetch(query)
  return products || []
}

// ─── Fetch Printful Catalog Variants ────────────────────────────────────────────

const catalogVariantCache = new Map()

async function getPrintfulCatalogVariants(printfulProductId) {
  const cacheKey = String(printfulProductId)
  if (catalogVariantCache.has(cacheKey)) return catalogVariantCache.get(cacheKey)

  await delay(DELAY_MS)
  const product = await printfulFetch(`/products/${printfulProductId}`)
  const variants = product.variants || []
  catalogVariantCache.set(cacheKey, variants)
  return variants
}

// ─── Match Variant by Color + Size ──────────────────────────────────────────────

function normalizeColor(color) {
  if (!color) return ''
  const overridden = COLOR_OVERRIDES[color] || color
  return overridden.toLowerCase().trim()
}

function normalizeSize(size) {
  if (!size) return ''
  return size.toLowerCase().trim()
}

function findMatchingPrintfulVariant(supabaseVariant, printfulVariants) {
  const svColor = normalizeColor(supabaseVariant.color)
  const svSize = normalizeSize(supabaseVariant.size)

  // Exact match first
  let match = printfulVariants.find((pv) => {
    const pvColor = normalizeColor(pv.color)
    const pvSize = normalizeSize(pv.size)
    return pvColor === svColor && pvSize === svSize
  })
  if (match) return match

  // Fuzzy color match: one contains the other
  match = printfulVariants.find((pv) => {
    const pvColor = normalizeColor(pv.color)
    const pvSize = normalizeSize(pv.size)
    const colorMatch = pvColor.includes(svColor) || svColor.includes(pvColor)
    return colorMatch && pvSize === svSize
  })
  if (match) return match

  // Size-only match (useful for one-size products like mugs, stickers)
  if (!svColor || svColor === 'default' || svColor === 'one color') {
    match = printfulVariants.find((pv) => {
      const pvSize = normalizeSize(pv.size)
      return pvSize === svSize
    })
    if (match) return match
  }

  return null
}

// ─── Find Design File for Product ───────────────────────────────────────────────

function findDesignFile(product, fileMap) {
  // Strategy: match by product title keywords against file map keys.
  // This is a heuristic — in production, a product-to-design mapping table would be ideal.
  const title = (product.title || '').toLowerCase()
  const printifyId = product.printify_id || ''

  // Check known design directory patterns
  const candidates = Object.entries(fileMap)

  // Try to find a file whose name matches the product
  for (const [key, fileData] of candidates) {
    const keyLower = key.toLowerCase()

    // Skip preview files (they are thumbnails, not print files)
    if (keyLower.includes('-preview')) continue

    // Match by product name fragments
    const nameWords = title
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)

    let matchCount = 0
    for (const word of nameWords) {
      if (keyLower.includes(word)) matchCount++
    }

    if (matchCount >= 2 || (matchCount === 1 && nameWords.length <= 2)) {
      return { key, ...fileData }
    }
  }

  // Fallback: return null — manual mapping needed
  return null
}

// ─── Build Sync Product Payload ─────────────────────────────────────────────────

function buildSyncProductPayload(product, printfulProductId, matchedVariants, designFile) {
  const syncVariants = matchedVariants.map((mv) => {
    const variant = {
      external_id: mv.supabaseVariant.id,
      variant_id: mv.printfulVariant.id,
      retail_price: (mv.supabaseVariant.price_cents / 100).toFixed(2),
      is_enabled: true,
    }

    // Add files (design placements) if we have a design file
    if (designFile && designFile.id) {
      variant.files = [
        {
          id: designFile.id,
          type: 'default',
        },
      ]
    }

    return variant
  })

  return {
    sync_product: {
      external_id: product.id,
      name: product.title,
      thumbnail: product.thumbnail_url || product.image_url || null,
    },
    sync_variants: syncVariants,
  }
}

// ─── Process Single Product ─────────────────────────────────────────────────────

async function migrateProduct(product, catalogMap, fileMap) {
  const bpKey = String(product.blueprint_id)
  const catalogEntry = catalogMap[bpKey]

  // Check if we have a Printful mapping
  if (!catalogEntry || !catalogEntry.printfulId) {
    return {
      supabase_id: product.id,
      title: product.title,
      status: 'skipped',
      reason: `No Printful mapping for blueprint ${bpKey}`,
      action: product.print_provider_id === 90 ? 'archive_candidate' : 'needs_mapping',
    }
  }

  const printfulProductId = catalogEntry.printfulId

  // Fetch Printful catalog variants
  let printfulVariants
  try {
    printfulVariants = await getPrintfulCatalogVariants(printfulProductId)
  } catch (err) {
    return {
      supabase_id: product.id,
      title: product.title,
      status: 'failed',
      error: `Failed to fetch Printful variants for #${printfulProductId}: ${err.message}`,
    }
  }

  // Match our variants to Printful variants
  const supabaseVariants = (product.product_variants || []).filter((v) => v.is_enabled)
  const matchedVariants = []
  const unmatchedVariants = []

  for (const sv of supabaseVariants) {
    const pfMatch = findMatchingPrintfulVariant(sv, printfulVariants)
    if (pfMatch) {
      matchedVariants.push({ supabaseVariant: sv, printfulVariant: pfMatch })
    } else {
      unmatchedVariants.push(sv)
    }
  }

  if (matchedVariants.length === 0) {
    return {
      supabase_id: product.id,
      title: product.title,
      status: 'failed',
      error: `No variant matches found (${supabaseVariants.length} Supabase variants vs ${printfulVariants.length} Printful variants)`,
      unmatchedColors: [...new Set(supabaseVariants.map((v) => v.color))],
    }
  }

  // Find design file
  const designFile = findDesignFile(product, fileMap)
  if (!designFile) {
    // Not a blocker — product can be created without files and designs added later
    console.log(`    WARNING: No design file matched for "${product.title}"`)
  }

  // Build payload
  const payload = buildSyncProductPayload(product, printfulProductId, matchedVariants, designFile)

  // DRY RUN: just validate
  if (DRY_RUN) {
    return {
      supabase_id: product.id,
      title: product.title,
      blueprint_id: product.blueprint_id,
      printful_product_id: printfulProductId,
      status: 'dry_run',
      variants_matched: matchedVariants.length,
      variants_unmatched: unmatchedVariants.length,
      design_file: designFile ? designFile.key || designFile.filename : null,
    }
  }

  // CREATE the sync product
  try {
    await delay(DELAY_MS)
    const result = await printfulFetch('/sync/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const syncProductId = result.id || (result.sync_product && result.sync_product.id)
    const syncVariants = result.sync_variants || []

    // Update Supabase: product level
    try {
      await supabaseUpdate('products', product.id, {
        pod_provider: 'printful',
        provider_product_id: String(syncProductId),
      })
    } catch (dbErr) {
      console.error(`    DB update failed for product: ${dbErr.message}`)
      // Log the Printful ID so we can retry DB update separately
      return {
        supabase_id: product.id,
        title: product.title,
        printful_sync_product_id: syncProductId,
        status: 'partial',
        error: `Printful product created but DB update failed: ${dbErr.message}`,
        variants_created: syncVariants.length,
      }
    }

    // Update Supabase: variant level — map external_variant_id
    let variantUpdateErrors = 0
    for (const sv of syncVariants) {
      if (sv.external_id) {
        try {
          await supabaseUpdate('product_variants', sv.external_id, {
            external_variant_id: String(sv.id || sv.sync_variant_id),
          })
        } catch {
          variantUpdateErrors++
        }
      }
    }

    return {
      supabase_id: product.id,
      title: product.title,
      printful_sync_product_id: syncProductId,
      variants_created: syncVariants.length,
      variants_unmatched: unmatchedVariants.length,
      variant_db_errors: variantUpdateErrors,
      design_file: designFile ? designFile.key || designFile.filename : null,
      status: 'ok',
    }
  } catch (err) {
    return {
      supabase_id: product.id,
      title: product.title,
      status: 'failed',
      error: err.message,
    }
  }
}

// ─── Handle P90 Products (Archive) ──────────────────────────────────────────────

async function archiveP90Product(product) {
  if (DRY_RUN) {
    return {
      supabase_id: product.id,
      title: product.title,
      status: 'dry_run',
      action: 'would_archive',
      reason: 'P90 product — no Printful equivalent for sneakers/clogs',
    }
  }

  try {
    await supabaseUpdate('products', product.id, {
      status: 'archived',
    })

    return {
      supabase_id: product.id,
      title: product.title,
      status: 'archived',
      action: 'archived',
      reason: 'No Printful equivalent for P90 product type',
    }
  } catch (err) {
    return {
      supabase_id: product.id,
      title: product.title,
      status: 'failed',
      error: `Archive failed: ${err.message}`,
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70))
  console.log('  SKAPARA Migration — Script 3: Create Printful Sync Products')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : RESUME ? 'RESUME' : 'LIVE'}`)
  if (PROVIDER_FILTER) console.log(`  Provider filter: ${PROVIDER_FILTER}`)
  if (PRODUCT_ID_FILTER) console.log(`  Product ID filter: ${PRODUCT_ID_FILTER}`)
  if (ALL) console.log(`  Scope: ALL products`)
  console.log('='.repeat(70))

  // Load input files
  const catalogMap = loadJSON(CATALOG_MAP_PATH, 'printful-catalog-map.json')
  const fileMap = loadJSON(FILE_MAP_PATH, 'printful-file-map.json')

  console.log(`\n  Catalog map: ${Object.keys(catalogMap).length} blueprint mappings`)
  console.log(`  File map: ${Object.keys(fileMap).length} design files`)

  // Load existing results for resume
  let existingResults = { migrated: [], failed: [], skipped: [] }
  if (RESUME && existsSync(RESULTS_PATH)) {
    try {
      existingResults = JSON.parse(readFileSync(RESULTS_PATH, 'utf8'))
      console.log(
        `  Resume: ${existingResults.migrated.length} already migrated, ` +
          `${existingResults.failed.length} failed, ${existingResults.skipped.length} skipped`
      )
    } catch {
      console.log('  Resume: Could not parse existing results, starting fresh')
    }
  }

  const alreadyDoneIds = new Set([
    ...existingResults.migrated.map((r) => r.supabase_id),
    ...existingResults.skipped.map((r) => r.supabase_id),
  ])

  // Fetch products from Supabase
  console.log('\n--- Fetching products from Supabase ---\n')
  const products = await fetchProducts()
  console.log(`  Found ${products.length} products matching filter`)

  if (products.length === 0) {
    console.log('  No products found. Check your filter flags.')
    return
  }

  // Print breakdown
  const byProvider = {}
  for (const p of products) {
    const key = `P${p.print_provider_id || '?'}`
    byProvider[key] = (byProvider[key] || 0) + 1
  }
  for (const [prov, count] of Object.entries(byProvider).sort()) {
    console.log(`    ${prov}: ${count} products`)
  }

  // Filter for resume
  const toProcess = products.filter((p) => {
    if (RESUME && alreadyDoneIds.has(p.id)) return false
    return true
  })

  const skippedResume = products.length - toProcess.length
  if (skippedResume > 0) {
    console.log(`\n  Skipping ${skippedResume} already-processed products (resume mode)`)
  }
  console.log(`  Products to process: ${toProcess.length}\n`)

  // ─── Process Products ─────────────────────────────────────────────────────

  const results = {
    migrated: [...existingResults.migrated],
    failed: [...existingResults.failed],
    skipped: [...existingResults.skipped],
  }

  console.log('--- Processing products ---\n')

  for (const [idx, product] of toProcess.entries()) {
    const progress = `[${idx + 1}/${toProcess.length}]`
    const varCount = (product.product_variants || []).length
    console.log(`  ${progress} ${product.title} (BP${product.blueprint_id}, P${product.print_provider_id}, ${varCount} vars)`)

    let result

    // P90 special handling: archive sneakers/clogs
    if (
      PROVIDER_FILTER === 'p90' &&
      product.print_provider_id === 90 &&
      (product.blueprint_id === 767 || product.blueprint_id === 1534)
    ) {
      result = await archiveP90Product(product)
    } else {
      result = await migrateProduct(product, catalogMap, fileMap)
    }

    // Categorize result
    if (result.status === 'ok' || result.status === 'dry_run') {
      console.log(`    -> ${result.status === 'dry_run' ? 'DRY RUN OK' : 'CREATED'}: ${result.variants_matched || result.variants_created || 0} variants`)
      if (result.variants_unmatched > 0) {
        console.log(`    -> WARNING: ${result.variants_unmatched} unmatched variants`)
      }
      results.migrated.push(result)
    } else if (result.status === 'skipped' || result.status === 'archived') {
      console.log(`    -> ${result.status.toUpperCase()}: ${result.reason || result.action || ''}`)
      results.skipped.push(result)
    } else if (result.status === 'partial') {
      console.log(`    -> PARTIAL: ${result.error}`)
      results.failed.push(result)
    } else {
      console.log(`    -> FAILED: ${result.error}`)
      results.failed.push(result)
    }

    // Save after each product (crash-safe)
    writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2))
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(70))
  console.log('  MIGRATION SUMMARY')
  console.log('='.repeat(70))
  console.log(`\n  Total processed:  ${toProcess.length}`)
  console.log(`  Migrated (ok):    ${results.migrated.length}`)
  console.log(`  Failed:           ${results.failed.length}`)
  console.log(`  Skipped/Archived: ${results.skipped.length}`)

  // Count total variants
  const totalVariants = results.migrated.reduce(
    (sum, r) => sum + (r.variants_created || r.variants_matched || 0),
    0
  )
  const totalUnmatched = results.migrated.reduce((sum, r) => sum + (r.variants_unmatched || 0), 0)
  console.log(`\n  Variants created: ${totalVariants}`)
  if (totalUnmatched > 0) {
    console.log(`  Variants unmatched: ${totalUnmatched}`)
  }

  console.log(`\n  Output: ${RESULTS_PATH}`)

  if (results.failed.length > 0) {
    console.log('\n  FAILED PRODUCTS:')
    for (const f of results.failed) {
      console.log(`    - ${f.title}: ${f.error}`)
    }
  }

  if (results.skipped.length > 0) {
    console.log('\n  SKIPPED/ARCHIVED:')
    for (const s of results.skipped) {
      console.log(`    - ${s.title}: ${s.reason || s.action || ''}`)
    }
  }

  if (DRY_RUN) {
    console.log('\n  DRY RUN complete. No products were created at Printful.')
    console.log('  Remove --dry-run to execute the migration.')
  }

  console.log('\n  Done.\n')
}

main().catch((e) => {
  console.error('\nFATAL:', e.message, e.stack)
  process.exit(1)
})
