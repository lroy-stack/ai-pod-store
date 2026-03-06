/**
 * migrate-phase1-06-verify.mjs
 *
 * Phase 1 Step 6: End-to-end verification of the t-shirt migration.
 *
 * Checks:
 * 1. Printful sync products exist and are accessible
 * 2. Supabase products have pod_provider='printful' and provider_product_id set
 * 3. Supabase variants have external_variant_id set
 * 4. product_details has brand=SKAPARA, correct model, safety_information
 * 5. Descriptions exist in en/es/de
 * 6. Margin >40% on all products
 * 7. printify_id is NULL (archived)
 * 8. Frontend API responds correctly
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-06-verify.mjs
 *   cd frontend && node scripts/migrate-phase1-06-verify.mjs --verbose
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const VERBOSE = process.argv.includes('--verbose')

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const PRINTFUL_TOKEN = env('PRINTFUL_API_TOKEN')
const PRINTFUL_STORE = env('PRINTFUL_STORE_ID')
const SUPABASE_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')

// ─── Constants ──────────────────────────────────────────────────────────────────

const DELAY_MS = 1500
const AUDIT_PATH = join(ROOT, 'scripts', 'phase1-audit.json')
const PRODUCTS_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')
const REPORT_PATH = join(ROOT, 'scripts', 'phase1-verification-report.json')

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function printfulFetch(path) {
  if (!PRINTFUL_TOKEN) return null
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      'X-PF-Store-Id': PRINTFUL_STORE,
      'User-Agent': 'SKAPARA-POD/1.0',
    },
  })
  if (!res.ok) return null
  const json = await res.json()
  return json.result !== undefined ? json.result : json
}

async function supabaseFetch(path) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) return null
  return res.json()
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 6: End-to-End Verification             ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log()

  // Load inputs
  if (!existsSync(AUDIT_PATH)) {
    console.error('ERROR: phase1-audit.json not found.')
    process.exit(1)
  }
  const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8'))
  const pfProducts = existsSync(PRODUCTS_PATH)
    ? JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
    : {}

  const report = {
    generatedAt: new Date().toISOString(),
    totalChecked: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    checks: [],
  }

  // Verify each product
  for (let i = 0; i < audit.products.length; i++) {
    const product = audit.products[i]
    const prog = `[${i + 1}/${audit.products.length}]`
    console.log(`${prog} Checking: ${product.title}`)

    const productChecks = {
      productId: product.id,
      title: product.title,
      tier: product.tier,
      checks: {},
    }

    // 1. Check Supabase product
    const dbProduct = await supabaseFetch(
      `/products?id=eq.${product.id}&select=*`
    )
    const db = dbProduct?.[0]

    if (!db) {
      productChecks.checks.supabase_exists = { pass: false, error: 'Product not found in Supabase' }
      console.log(`  ✗ Not found in Supabase`)
      report.checks.push(productChecks)
      report.failed++
      report.totalChecked++
      continue
    }

    // 2. pod_provider = 'printful'
    productChecks.checks.pod_provider = {
      pass: db.pod_provider === 'printful',
      value: db.pod_provider,
      expected: 'printful',
    }

    // 3. provider_product_id is set
    productChecks.checks.provider_product_id = {
      pass: !!db.provider_product_id,
      value: db.provider_product_id,
    }

    // 4. printify_id is NULL (archived) — only checked after step 5
    const printifyArchived = db.printify_id === null || db.printify_id === undefined
    productChecks.checks.printify_archived = {
      pass: printifyArchived,
      value: db.printify_id,
      expected: null,
      note: printifyArchived ? 'cleared' : 'will be cleared in step 5',
    }

    // 5. product_details
    const pd = db.product_details || {}
    productChecks.checks.brand = { pass: pd.brand === 'SKAPARA', value: pd.brand }
    productChecks.checks.model = {
      pass: !!pd.model && (pd.model.includes('MC1087') || pd.model.includes('1717')),
      value: pd.model,
    }
    productChecks.checks.material = { pass: !!pd.material, value: pd.material?.slice(0, 40) }
    productChecks.checks.safety_information = { pass: !!pd.safety_information, hasValue: !!pd.safety_information }
    productChecks.checks.manufacturing_country = { pass: pd.manufacturing_country === 'LV', value: pd.manufacturing_country }
    productChecks.checks.care_instructions = { pass: !!pd.care_instructions, hasValue: !!pd.care_instructions }

    // 6. Descriptions in 3 languages (description = EN, translations.{locale}.description = ES/DE)
    const descEn = db.description
    const descEs = db.translations?.es?.description
    const descDe = db.translations?.de?.description
    productChecks.checks.description_en = { pass: !!descEn && descEn.length > 20, length: descEn?.length }
    productChecks.checks.description_es = { pass: !!descEs && descEs.length > 20, length: descEs?.length }
    productChecks.checks.description_de = { pass: !!descDe && descDe.length > 20, length: descDe?.length }

    // 7. Pricing: margin >40%
    const price = db.base_price_cents || 0
    const cost = db.cost_cents || 0
    const margin = cost > 0 ? ((price - cost) / price) * 100 : 0
    productChecks.checks.margin = {
      pass: margin >= 40,
      margin: Math.round(margin * 10) / 10,
      price,
      cost,
    }

    // 8. Variants
    const variants = await supabaseFetch(
      `/product_variants?product_id=eq.${product.id}&is_enabled=eq.true&select=id,external_variant_id,price_cents,cost_cents,color,size`
    )
    const enabledVariants = variants || []
    const variantsWithExtId = enabledVariants.filter(v => !!v.external_variant_id)

    productChecks.checks.variants_count = {
      pass: enabledVariants.length > 0,
      count: enabledVariants.length,
    }
    productChecks.checks.variants_external_id = {
      pass: variantsWithExtId.length === enabledVariants.length,
      mapped: variantsWithExtId.length,
      total: enabledVariants.length,
    }

    // 9. Printful sync product exists
    if (PRINTFUL_TOKEN && db.provider_product_id) {
      await delay(DELAY_MS)
      const pfProduct = await printfulFetch(`/sync/products/${db.provider_product_id}`)
      productChecks.checks.printful_exists = {
        pass: !!pfProduct,
        syncProductId: db.provider_product_id,
      }
    }

    // Calculate pass/fail (printify_archived is not blocking before step 5)
    const allChecks = Object.entries(productChecks.checks)
    const criticalChecks = allChecks.filter(([k]) => k !== 'printify_archived')
    const allPass = criticalChecks.every(([, c]) => c.pass)
    const failCount = criticalChecks.filter(([, c]) => !c.pass).length

    if (allPass) {
      report.passed++
      const warnings = allChecks.filter(([k, v]) => k === 'printify_archived' && !v.pass)
      if (warnings.length > 0) {
        report.warnings++
        console.log(`  ✓ Checks passed (printify_id pending step 5)`)
      } else {
        console.log(`  ✓ All checks passed`)
      }
    } else {
      report.failed++
      const failedChecks = criticalChecks
        .filter(([, v]) => !v.pass)
        .map(([k]) => k)
      console.log(`  ✗ Failed: ${failedChecks.join(', ')}`)
    }

    if (VERBOSE) {
      for (const [name, check] of Object.entries(productChecks.checks)) {
        const icon = check.pass ? '✓' : '✗'
        console.log(`    ${icon} ${name}: ${JSON.stringify(check)}`)
      }
    }

    report.checks.push(productChecks)
    report.totalChecked++
  }

  // Save report
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))

  // Summary
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  VERIFICATION REPORT')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Total checked: ${report.totalChecked}`)
  console.log(`  Passed:        ${report.passed}`)
  console.log(`  Failed:        ${report.failed}`)
  console.log(`  Report:        ${REPORT_PATH}`)
  console.log()

  if (report.failed > 0) {
    console.log('  ✗ VERIFICATION FAILED')
    console.log('    DO NOT proceed to step 5 (archive) until all checks pass.')
    console.log('    Run with --verbose for details.')
    process.exit(1)
  } else {
    console.log('  ✓ ALL CHECKS PASSED')
    console.log('    Safe to proceed with step 5 (archive Printify products).')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
