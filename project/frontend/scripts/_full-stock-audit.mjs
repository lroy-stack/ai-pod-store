/**
 * FULL STOCK AUDIT
 * 1. Check every product for EU shipping availability
 * 2. Compare Supabase variants vs Printify available variants
 * 3. Output actionable report
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const EU_COUNTRIES = new Set([
  'ES','DE','FR','IT','NL','PL','GB','AT','BE','PT','IE','SE','DK','FI',
  'CZ','GR','HU','RO','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY'
])

async function apiFetch(path) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API}${path}`, { headers: hdrs })
    if (r.status === 429) {
      console.log(`    ⏳ Rate limit, waiting ${15 * (i + 1)}s...`)
      await delay(15000 * (i + 1))
      continue
    }
    if (!r.ok) return null
    return r.json()
  }
  return null
}

// ─── Get ALL Printify products ──────────────────────────────────────────────
async function getAllPrintifyProducts() {
  const all = []
  let page = 1
  while (true) {
    const data = await apiFetch(`/shops/${SHOP}/products.json?page=${page}&limit=50`)
    if (!data || !data.data || data.data.length === 0) break
    all.push(...data.data)
    if (page >= (data.last_page || 1)) break
    page++
    await delay(500)
  }
  return all
}

// ─── Check EU shipping for a blueprint+provider ────────────────────────────
async function checkEUShipping(blueprintId, providerId) {
  const shipping = await apiFetch(
    `/catalog/blueprints/${blueprintId}/print_providers/${providerId}/shipping.json`
  )
  if (!shipping?.profiles) return { hasEU: false, method: 'no_profiles' }

  for (const profile of shipping.profiles) {
    const countries = profile.countries || []
    if (countries.some(c => EU_COUNTRIES.has(c))) {
      return { hasEU: true, method: 'direct', cost: profile.first_item?.cost }
    }
    if (countries.includes('REST_OF_WORLD')) {
      return { hasEU: true, method: 'REST_OF_WORLD', cost: profile.first_item?.cost }
    }
  }
  return { hasEU: false, method: 'no_eu_country' }
}

// ─── Get available variants from Printify catalog ──────────────────────────
async function getCatalogVariants(blueprintId, providerId) {
  const data = await apiFetch(
    `/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`
  )
  return data?.variants || []
}

// ─── Get Supabase products + variants ──────────────────────────────────────
async function getSupabaseData() {
  const { data: products } = await sb.from('products')
    .select('id, title, printify_id, blueprint_id, print_provider_id, is_active, images')
    .order('title')

  const { data: variants } = await sb.from('product_variants')
    .select('id, product_id, printify_variant_id, title, color, size, is_enabled, is_available')

  return { products: products || [], variants: variants || [] }
}

async function main() {
  console.log('═'.repeat(70))
  console.log('  FULL STOCK AUDIT — EU Shipping + Variant Completeness')
  console.log('═'.repeat(70))

  // Step 1: Get all data
  console.log('\n  Fetching Supabase products...')
  const { products: sbProducts, variants: sbVariants } = await getSupabaseData()
  console.log(`  ${sbProducts.length} products, ${sbVariants.length} variants in Supabase`)

  console.log('\n  Fetching Printify products...')
  const printifyProducts = await getAllPrintifyProducts()
  console.log(`  ${printifyProducts.length} products in Printify`)

  // Build lookup maps
  const printifyMap = {}
  for (const p of printifyProducts) printifyMap[p.id] = p

  // Step 2: Audit each Supabase product
  const report = {
    noEU: [],
    variantMismatch: [],
    ok: [],
    orphaned: [],
    locked: [],
    noBlueprint: [],
  }

  console.log('\n  Auditing each product...\n')

  for (const [idx, sp] of sbProducts.entries()) {
    const label = `[${idx + 1}/${sbProducts.length}]`
    const pp = printifyMap[sp.printify_id]

    // Check if product exists in Printify
    if (!pp) {
      console.log(`  ${label} ${sp.title} — ⚠ NOT IN PRINTIFY`)
      report.orphaned.push({ ...sp, reason: 'not_in_printify' })
      continue
    }

    if (pp.is_locked) {
      report.locked.push({ ...sp, reason: 'locked' })
    }

    // Extract blueprint_id and print_provider_id from Printify product
    const bpId = sp.blueprint_id || pp.blueprint_id
    const provId = sp.print_provider_id || pp.print_provider_id

    if (!bpId || !provId) {
      console.log(`  ${label} ${sp.title} — ⚠ NO BLUEPRINT/PROVIDER INFO`)
      report.noBlueprint.push({ title: sp.title, id: sp.id, printify_id: sp.printify_id })
      continue
    }

    process.stdout.write(`  ${label} ${sp.title.substring(0, 40).padEnd(40)} BP ${bpId}/P ${provId} ... `)

    // Check EU shipping
    await delay(400)
    const euCheck = await checkEUShipping(bpId, provId)

    // Get catalog variants (what Printify offers)
    await delay(400)
    const catalogVars = await getCatalogVariants(bpId, provId)

    // Get product variants from Printify (what's enabled on the product)
    const ppVariants = pp.variants || []
    const ppEnabledIds = new Set(ppVariants.filter(v => v.is_enabled).map(v => v.id))

    // Get Supabase variants for this product
    const myVariants = sbVariants.filter(v => v.product_id === sp.id)
    const myVarIds = new Set(myVariants.map(v => String(v.printify_variant_id)))

    // Compare: enabled in Printify but missing in Supabase
    const missingInSB = ppVariants.filter(v => v.is_enabled && !myVarIds.has(String(v.id)))
    // Extra in Supabase but not enabled in Printify
    const extraInSB = myVariants.filter(v => !ppEnabledIds.has(Number(v.printify_variant_id)))

    // Catalog variants not enabled in the product at all
    const catalogIds = new Set(catalogVars.map(v => v.id))
    const notOnProduct = catalogVars.filter(v => !ppEnabledIds.has(v.id))

    const variantStatus = {
      catalog: catalogVars.length,
      enabledInPrintify: ppEnabledIds.size,
      inSupabase: myVariants.length,
      missingInSB: missingInSB.length,
      extraInSB: extraInSB.length,
      notOnProduct: notOnProduct.length,
    }

    const euTag = euCheck.hasEU ? `EU:${euCheck.method}` : '❌ NO EU'
    const varTag = missingInSB.length > 0 ? `⚠ -${missingInSB.length} missing` : '✓'

    console.log(`${euTag} | vars: ${ppEnabledIds.size}P/${myVariants.length}SB/${catalogVars.length}cat ${varTag}`)

    const entry = {
      title: sp.title,
      id: sp.id,
      printify_id: sp.printify_id,
      blueprint_id: bpId,
      provider_id: provId,
      eu: euCheck,
      variants: variantStatus,
      missingVariants: missingInSB.map(v => ({ id: v.id, title: v.title })),
      extraVariants: extraInSB.map(v => ({ id: v.id, title: v.title })),
      notOnProduct: notOnProduct.length,
    }

    if (!euCheck.hasEU) {
      report.noEU.push(entry)
    } else if (missingInSB.length > 0 || extraInSB.length > 0) {
      report.variantMismatch.push(entry)
    } else {
      report.ok.push(entry)
    }
  }

  // ─── REPORT ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('  AUDIT RESULTS')
  console.log('═'.repeat(70))

  // NO EU
  console.log(`\n  ❌ NO EU SHIPPING: ${report.noEU.length} products`)
  console.log('  ' + '─'.repeat(66))
  for (const p of report.noEU) {
    console.log(`    ${p.title}`)
    console.log(`      BP ${p.blueprint_id} / Provider ${p.provider_id}`)
    console.log(`      Variants: ${p.variants.enabledInPrintify} enabled, ${p.variants.inSupabase} in SB`)
  }

  // VARIANT MISMATCH
  console.log(`\n  ⚠ VARIANT MISMATCH: ${report.variantMismatch.length} products`)
  console.log('  ' + '─'.repeat(66))
  for (const p of report.variantMismatch) {
    console.log(`    ${p.title}`)
    console.log(`      BP ${p.blueprint_id} / Provider ${p.provider_id} | EU: ${p.eu.method}`)
    console.log(`      Printify enabled: ${p.variants.enabledInPrintify} | Supabase: ${p.variants.inSupabase} | Catalog: ${p.variants.catalog}`)
    if (p.missingVariants.length > 0) {
      console.log(`      Missing in Supabase (${p.missingVariants.length}):`)
      for (const v of p.missingVariants.slice(0, 5)) console.log(`        - ${v.title}`)
      if (p.missingVariants.length > 5) console.log(`        ... +${p.missingVariants.length - 5} more`)
    }
    if (p.extraVariants.length > 0) {
      console.log(`      Extra in Supabase (${p.extraVariants.length}):`)
      for (const v of p.extraVariants.slice(0, 3)) console.log(`        - ${v.title}`)
    }
  }

  // PRODUCTS THAT COULD HAVE MORE VARIANTS ENABLED
  const underutilized = [...report.ok, ...report.variantMismatch].filter(
    p => p.notOnProduct > 5 && p.variants.enabledInPrintify < p.variants.catalog * 0.5
  )
  if (underutilized.length > 0) {
    console.log(`\n  📊 UNDERUTILIZED (< 50% of catalog variants enabled): ${underutilized.length} products`)
    console.log('  ' + '─'.repeat(66))
    for (const p of underutilized) {
      console.log(`    ${p.title}`)
      console.log(`      Enabled: ${p.variants.enabledInPrintify} / ${p.variants.catalog} catalog (${Math.round(p.variants.enabledInPrintify / p.variants.catalog * 100)}%)`)
    }
  }

  // OK
  console.log(`\n  ✅ OK: ${report.ok.length} products`)

  // ORPHANED
  if (report.orphaned.length > 0) {
    console.log(`\n  👻 ORPHANED (in Supabase but not in Printify): ${report.orphaned.length}`)
    for (const p of report.orphaned) console.log(`    ${p.title} (${p.printify_id})`)
  }

  // NO BLUEPRINT
  if (report.noBlueprint.length > 0) {
    console.log(`\n  ❓ NO BLUEPRINT INFO: ${report.noBlueprint.length}`)
    for (const p of report.noBlueprint) console.log(`    ${p.title} (${p.printify_id})`)
  }

  // LOCKED
  if (report.locked.length > 0) {
    console.log(`\n  🔒 LOCKED: ${report.locked.length}`)
    for (const p of report.locked) console.log(`    ${p.title}`)
  }

  // Summary
  console.log('\n' + '═'.repeat(70))
  console.log(`  SUMMARY`)
  console.log(`    Total products:    ${sbProducts.length}`)
  console.log(`    ✅ OK (EU + vars): ${report.ok.length}`)
  console.log(`    ⚠ Variant issues:  ${report.variantMismatch.length}`)
  console.log(`    ❌ No EU shipping: ${report.noEU.length}`)
  console.log(`    👻 Orphaned:       ${report.orphaned.length}`)
  console.log(`    ❓ No BP info:     ${report.noBlueprint.length}`)
  console.log('═'.repeat(70))

  // Save full report as JSON
  const outPath = join(ROOT, 'public', 'stock-audit.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\n  Full report: ${outPath}`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
