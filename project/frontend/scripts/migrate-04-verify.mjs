/**
 * migrate-04-verify.mjs
 *
 * Block 2D — Script 4: Post-Migration Verification
 *
 * Runs a comprehensive verification of the Printify -> Printful migration.
 * Checks product counts, variant counts, GPSR fields, pricing consistency,
 * and orphaned Printify products.
 *
 * Output: Console table with pass/fail + frontend/scripts/migration-verification.json
 *
 * Usage:
 *   cd frontend && node scripts/migrate-04-verify.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

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
const OUTPUT_PATH = join(ROOT, 'scripts', 'migration-verification.json')
const RESULTS_PATH = join(ROOT, 'scripts', 'migration-results.json')

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Printful Fetch ─────────────────────────────────────────────────────────────

async function printfulFetch(path, retries = 3) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': PRINTFUL_STORE,
      'User-Agent': 'SKAPARA-POD/1.0',
    },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    console.log(`  Rate limited, waiting ${retryAfter}s...`)
    await delay(retryAfter * 1000)
    if (retries > 0) return printfulFetch(path, retries - 1)
    throw new Error(`Rate limited after retries`)
  }

  if (res.status >= 500 && retries > 0) {
    await delay(2000)
    return printfulFetch(path, retries - 1)
  }

  const json = await res.json()

  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(
      `Printful ${res.status}: ${json.error?.message || json.message || JSON.stringify(json).slice(0, 300)}`
    )
  }

  return { result: json.result, paging: json.paging }
}

// ─── Supabase Fetch ─────────────────────────────────────────────────────────────

async function supabaseFetch(path) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  }

  const contentRange = res.headers.get('content-range')
  const totalCount = contentRange ? parseInt(contentRange.split('/')[1], 10) : null

  const data = await res.json()
  return { data, totalCount }
}

// ─── Verification Checks ────────────────────────────────────────────────────────

const checks = []

function recordCheck(name, passed, details) {
  checks.push({
    name,
    passed,
    details,
    timestamp: new Date().toISOString(),
  })

  const icon = passed ? 'PASS' : 'FAIL'
  console.log(`  [${icon}] ${name}`)
  if (details) console.log(`         ${details}`)
}

// ─── Check 1: Products with pod_provider = 'printful' ───────────────────────────

async function check1_printfulProducts() {
  console.log('\n--- Check 1: Products with pod_provider = printful ---\n')

  const { data, totalCount } = await supabaseFetch(
    '/products?pod_provider=eq.printful&status=eq.active&select=id&limit=0'
  )

  const count = totalCount || (data ? data.length : 0)
  recordCheck(
    'Products with pod_provider=printful',
    count > 0,
    `${count} products found with pod_provider=printful`
  )

  return count
}

// ─── Check 2: Products with provider_product_id populated ───────────────────────

async function check2_providerProductId() {
  console.log('\n--- Check 2: Products with provider_product_id populated ---\n')

  const { data: allActive, totalCount: totalActive } = await supabaseFetch(
    '/products?status=eq.active&select=id&limit=0'
  )

  const { data: withProvider, totalCount: withProviderCount } = await supabaseFetch(
    '/products?status=eq.active&provider_product_id=not.is.null&select=id&limit=0'
  )

  const total = totalActive || 0
  const populated = withProviderCount || 0

  recordCheck(
    'provider_product_id populated',
    populated > 0 && populated >= total * 0.8,
    `${populated}/${total} active products have provider_product_id`
  )

  return { total, populated }
}

// ─── Check 3: Printful sync products count via API ──────────────────────────────

async function check3_printfulSyncProducts() {
  console.log('\n--- Check 3: Printful sync products count ---\n')

  let totalPrintfulProducts = 0
  let offset = 0
  const limit = 100

  try {
    // Paginate to get total count
    const { result, paging } = await printfulFetch(`/sync/products?offset=0&limit=${limit}`)
    totalPrintfulProducts = paging ? paging.total : (Array.isArray(result) ? result.length : 0)

    recordCheck(
      'Printful sync products exist',
      totalPrintfulProducts > 0,
      `${totalPrintfulProducts} sync products in Printful store`
    )
  } catch (err) {
    recordCheck('Printful sync products exist', false, `API error: ${err.message}`)
  }

  return totalPrintfulProducts
}

// ─── Check 4: Spot-check 5 random products — variant count comparison ───────────

async function check4_spotCheckVariants() {
  console.log('\n--- Check 4: Spot-check 5 random products ---\n')

  const { data: candidates } = await supabaseFetch(
    '/products?pod_provider=eq.printful&provider_product_id=not.is.null&status=eq.active&select=id,title,provider_product_id&limit=20'
  )

  if (!candidates || candidates.length === 0) {
    recordCheck('Spot-check variants', false, 'No Printful products found in DB to spot-check')
    return
  }

  // Pick 5 random products
  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, 5)
  let allPassed = true
  const details = []

  for (const product of shuffled) {
    // Get our variant count
    const { data: variants, totalCount: ourCount } = await supabaseFetch(
      `/product_variants?product_id=eq.${product.id}&is_enabled=eq.true&select=id&limit=0`
    )
    const dbVariants = ourCount || (variants ? variants.length : 0)

    // Get Printful variant count
    try {
      await delay(DELAY_MS)
      const { result } = await printfulFetch(`/sync/products/${product.provider_product_id}`)
      const syncVariants = result.sync_variants || []
      const pfVariants = syncVariants.length

      const match = Math.abs(dbVariants - pfVariants) <= 2 // allow 2 variant tolerance
      if (!match) allPassed = false

      details.push(
        `  ${product.title}: DB=${dbVariants} vs PF=${pfVariants} ${match ? 'OK' : 'MISMATCH'}`
      )
    } catch (err) {
      allPassed = false
      details.push(`  ${product.title}: DB=${dbVariants} vs PF=ERROR (${err.message})`)
    }
  }

  recordCheck('Spot-check variant counts (5 products)', allPassed, details.join('\n'))
}

// ─── Check 5: provider_product_id populated for all migrated ────────────────────

async function check5_allMigratedHaveId() {
  console.log('\n--- Check 5: All migrated products have provider_product_id ---\n')

  const { data, totalCount } = await supabaseFetch(
    '/products?pod_provider=eq.printful&provider_product_id=is.null&status=eq.active&select=id,title&limit=10'
  )

  const missingCount = totalCount || (data ? data.length : 0)

  if (missingCount > 0) {
    const names = (data || []).slice(0, 5).map((p) => p.title).join(', ')
    recordCheck(
      'All printful products have provider_product_id',
      false,
      `${missingCount} products missing provider_product_id. Examples: ${names}`
    )
  } else {
    recordCheck(
      'All printful products have provider_product_id',
      true,
      'All printful products have provider_product_id populated'
    )
  }

  return missingCount
}

// ─── Check 6: GPSR fields populated ─────────────────────────────────────────────

async function check6_gpsrFields() {
  console.log('\n--- Check 6: GPSR fields populated ---\n')

  // Check manufacturing_country
  const { data: noCountry, totalCount: noCountryCount } = await supabaseFetch(
    '/products?status=eq.active&select=id&limit=0'
  )
  const totalActive = noCountryCount || 0

  // We need to check product_details JSONB for GPSR fields.
  // Supabase REST doesn't support JSONB field IS NULL easily,
  // so we fetch a sample and check programmatically.
  const { data: sample } = await supabaseFetch(
    '/products?status=eq.active&select=id,title,product_details&limit=100'
  )

  let withManufacturing = 0
  let withSafety = 0
  let withMaterial = 0

  for (const p of sample || []) {
    const details = p.product_details || {}
    if (details.manufacturing_country) withManufacturing++
    if (details.safety_information) withSafety++
    if (details.material) withMaterial++
  }

  const sampleSize = (sample || []).length

  recordCheck(
    'GPSR: manufacturing_country populated',
    withManufacturing === sampleSize,
    `${withManufacturing}/${sampleSize} products have manufacturing_country`
  )

  recordCheck(
    'GPSR: safety_information populated',
    withSafety === sampleSize,
    `${withSafety}/${sampleSize} products have safety_information`
  )

  recordCheck(
    'GPSR: material populated',
    withMaterial === sampleSize,
    `${withMaterial}/${sampleSize} products have material`
  )

  return { withManufacturing, withSafety, withMaterial, sampleSize }
}

// ─── Check 7: Price comparison — base_price_cents vs Printful retail_price ──────

async function check7_priceComparison() {
  console.log('\n--- Check 7: Price comparison (DB vs Printful) ---\n')

  const { data: products } = await supabaseFetch(
    '/products?pod_provider=eq.printful&provider_product_id=not.is.null&status=eq.active&select=id,title,base_price_cents,provider_product_id&limit=10'
  )

  if (!products || products.length === 0) {
    recordCheck('Price comparison', false, 'No Printful products found for price check')
    return
  }

  // Check 5 products
  const toCheck = products.slice(0, 5)
  let allWithin5Pct = true
  const details = []

  for (const product of toCheck) {
    const dbPriceCents = product.base_price_cents || 0
    const dbPrice = dbPriceCents / 100

    try {
      await delay(DELAY_MS)
      const { result } = await printfulFetch(`/sync/products/${product.provider_product_id}`)
      const syncVariants = result.sync_variants || []

      if (syncVariants.length > 0) {
        // Compare with first variant's retail_price
        const pfPrice = parseFloat(syncVariants[0].retail_price || '0')
        const diff = Math.abs(dbPrice - pfPrice)
        const pctDiff = dbPrice > 0 ? (diff / dbPrice) * 100 : 100

        const within5 = pctDiff <= 5
        if (!within5) allWithin5Pct = false

        details.push(
          `  ${product.title}: DB=${dbPrice.toFixed(2)} vs PF=${pfPrice.toFixed(2)} (${pctDiff.toFixed(1)}%) ${within5 ? 'OK' : 'DRIFT'}`
        )
      } else {
        details.push(`  ${product.title}: No sync variants found at Printful`)
        allWithin5Pct = false
      }
    } catch (err) {
      details.push(`  ${product.title}: ERROR (${err.message})`)
      allWithin5Pct = false
    }
  }

  recordCheck('Price comparison within 5%', allWithin5Pct, details.join('\n'))
}

// ─── Check 8: Orphan check — products still on Printify ─────────────────────────

async function check8_orphanCheck() {
  console.log('\n--- Check 8: Orphan check (products still on Printify) ---\n')

  // Products that have pod_provider = 'printify' (or NULL) that are still active
  const { data: printifyProducts, totalCount } = await supabaseFetch(
    '/products?status=eq.active&pod_provider=neq.printful&select=id,title,print_provider_id,pod_provider&limit=50'
  )

  // Also check for NULL pod_provider
  const { data: nullProvider, totalCount: nullCount } = await supabaseFetch(
    '/products?status=eq.active&pod_provider=is.null&select=id,title,print_provider_id&limit=50'
  )

  const orphanPrintify = (printifyProducts || []).filter(
    (p) => p.pod_provider === 'printify' || !p.pod_provider
  )
  const orphanNull = nullProvider || []

  const totalOrphans = (totalCount || orphanPrintify.length) + (nullCount || orphanNull.length)

  if (totalOrphans === 0) {
    recordCheck('No orphaned Printify products', true, 'All active products are on Printful')
  } else {
    const examples = [...orphanPrintify, ...orphanNull]
      .slice(0, 10)
      .map((p) => `${p.title} (P${p.print_provider_id})`)

    recordCheck(
      'No orphaned Printify products',
      false,
      `${totalOrphans} products still not on Printful:\n  ${examples.join('\n  ')}`
    )
  }

  return totalOrphans
}

// ─── Load Migration Results (if available) ──────────────────────────────────────

function loadMigrationResults() {
  if (!existsSync(RESULTS_PATH)) return null
  try {
    return JSON.parse(readFileSync(RESULTS_PATH, 'utf8'))
  } catch {
    return null
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70))
  console.log('  SKAPARA Migration — Script 4: Post-Migration Verification')
  console.log('='.repeat(70))

  // Load migration results for context
  const migrationResults = loadMigrationResults()
  if (migrationResults) {
    console.log(`\n  Migration results loaded:`)
    console.log(`    Migrated: ${migrationResults.migrated?.length || 0}`)
    console.log(`    Failed:   ${migrationResults.failed?.length || 0}`)
    console.log(`    Skipped:  ${migrationResults.skipped?.length || 0}`)
  } else {
    console.log('\n  No migration-results.json found (running standalone verification)')
  }

  // Run all checks
  const printfulCount = await check1_printfulProducts()
  const providerIds = await check2_providerProductId()
  const syncProducts = await check3_printfulSyncProducts()
  await check4_spotCheckVariants()
  const missingIds = await check5_allMigratedHaveId()
  const gpsr = await check6_gpsrFields()
  await check7_priceComparison()
  const orphans = await check8_orphanCheck()

  // ─── Summary Table ──────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(70))
  console.log('  VERIFICATION SUMMARY')
  console.log('='.repeat(70))

  const passed = checks.filter((c) => c.passed).length
  const failed = checks.filter((c) => !c.passed).length

  console.log(`\n  Total checks: ${checks.length}`)
  console.log(`  Passed:       ${passed}`)
  console.log(`  Failed:       ${failed}`)

  console.log('\n  ' + '-'.repeat(65))
  const colW = { status: 6, name: 50 }
  for (const check of checks) {
    const status = check.passed ? 'PASS' : 'FAIL'
    console.log(`  [${status}] ${check.name}`)
  }
  console.log('  ' + '-'.repeat(65))

  // ─── Key Metrics ────────────────────────────────────────────────────────────

  console.log('\n  KEY METRICS:')
  console.log(`    Products on Printful (DB):     ${printfulCount}`)
  console.log(`    Products with provider_id:     ${providerIds.populated}/${providerIds.total}`)
  console.log(`    Printful sync products (API):  ${syncProducts}`)
  console.log(`    Orphaned (not migrated):       ${orphans}`)
  console.log(`    GPSR coverage:                 ${gpsr.withSafety}/${gpsr.sampleSize} safety_info`)

  // ─── Overall Verdict ────────────────────────────────────────────────────────

  const overallPass = failed === 0
  console.log(`\n  OVERALL: ${overallPass ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED — review above`}`)

  // ─── Write Report ───────────────────────────────────────────────────────────

  const report = {
    timestamp: new Date().toISOString(),
    overallPass,
    checksTotal: checks.length,
    checksPassed: passed,
    checksFailed: failed,
    checks,
    metrics: {
      printfulProductsInDB: printfulCount,
      providerProductIdPopulated: providerIds.populated,
      totalActiveProducts: providerIds.total,
      printfulSyncProducts: syncProducts,
      orphanedProducts: orphans,
      gpsrCoverage: gpsr,
    },
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2))
  console.log(`\n  Report written to: ${OUTPUT_PATH}`)
  console.log('\n  Done.\n')

  // Exit with non-zero if any check failed
  if (!overallPass) process.exit(1)
}

main().catch((e) => {
  console.error('\nFATAL:', e.message, e.stack)
  process.exit(1)
})
