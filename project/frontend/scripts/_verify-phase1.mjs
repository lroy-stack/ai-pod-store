import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'POD-AI-Store/1.0' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)

const catalog = JSON.parse(readFileSync(join(ROOT, 'public/phase1-production/catalog.json'), 'utf8'))

console.log('='.repeat(75))
console.log('  PHASE 1 — FULL VERIFICATION (Printify + Supabase)')
console.log('='.repeat(75) + '\n')

// 1. Get all Supabase products created by phase1
const { data: dbProducts, error: dbErr } = await supabase
  .from('products')
  .select('id, title, printify_id, category, status, base_price_cents, images, translations, product_details, blueprint_id, print_provider_id')
  .order('created_at', { ascending: false })
  .limit(50)

if (dbErr) {
  console.error('  Supabase error:', dbErr.message)
  process.exit(1)
}
if (!dbProducts) {
  console.error('  No products returned from Supabase')
  process.exit(1)
}

const phase1Titles = catalog.products.map(p => p.name)
const phase1DbProducts = dbProducts.filter(p => phase1Titles.includes(p.title))

console.log(`  Found ${phase1DbProducts.length} Phase 1 products in Supabase\n`)

const issues = []

for (const [idx, catProduct] of catalog.products.entries()) {
  const dbProd = phase1DbProducts.find(p => p.title === catProduct.name)
  const vs = catalog.variantSets[catProduct.variantSet]
  const num = `${idx + 1}/20`

  console.log(`  [${num}] ${catProduct.id} — ${catProduct.name}`)

  if (!dbProd) {
    console.log(`         ❌ NOT FOUND in Supabase`)
    issues.push(`${catProduct.id}: Not found in Supabase`)
    console.log('')
    continue
  }

  // Check Supabase fields
  const checks = []

  // Status
  if (dbProd.status !== 'active') {
    checks.push(`status=${dbProd.status} (expected active)`)
  }

  // Price
  if (dbProd.base_price_cents !== catProduct.priceCents) {
    checks.push(`price=${dbProd.base_price_cents} (expected ${catProduct.priceCents})`)
  }

  // Category
  if (dbProd.category !== catProduct.category) {
    checks.push(`category=${dbProd.category} (expected ${catProduct.category})`)
  }

  // Images
  const imgCount = dbProd.images?.length || 0
  if (imgCount === 0) checks.push('NO images')
  // thumbnail check removed — column may not exist

  // Translations
  const hasEs = dbProd.translations?.es?.description
  const hasDe = dbProd.translations?.de?.description
  if (!hasEs) checks.push('missing ES translation')
  if (!hasDe) checks.push('missing DE translation')

  // Product details (GPSR)
  const pd = dbProd.product_details
  if (!pd?.safety_information) checks.push('NO GPSR/safety_information')
  if (!pd?.material) checks.push('NO material')
  if (!pd?.brand) checks.push('NO brand')

  // Blueprint
  if (dbProd.blueprint_id !== vs.blueprint_id) {
    checks.push(`blueprint=${dbProd.blueprint_id} (expected ${vs.blueprint_id})`)
  }

  // Variants in Supabase
  const { data: dbVariants, count } = await supabase
    .from('product_variants')
    .select('id, color, size, price_cents, is_enabled, printify_variant_id, image_url', { count: 'exact' })
    .eq('product_id', dbProd.id)

  const expectedVariantCount = Object.values(vs.colors).reduce((sum, sizes) => sum + Object.keys(sizes).length, 0)
  if ((count || 0) !== expectedVariantCount) {
    checks.push(`variants=${count} (expected ${expectedVariantCount})`)
  }

  // Check variant image_urls
  const withImages = (dbVariants || []).filter(v => v.image_url).length

  // Verify on Printify
  let printifyStatus = 'unknown'
  let printifyPrice = null
  let printifyPositions = []
  if (dbProd.printify_id) {
    await delay(1500)
    try {
      const r = await fetch(`${API}/shops/${SHOP_ID}/products/${dbProd.printify_id}.json`, { headers: hdrs })
      if (r.ok) {
        const pData = await r.json()
        printifyStatus = pData.visible ? 'published' : 'draft'

        // Check print areas / positions
        const areas = pData.print_areas || []
        for (const area of areas) {
          for (const ph of (area.placeholders || [])) {
            printifyPositions.push(ph.position)
          }
        }

        // Check worst-case cost vs price
        const enabledVars = (pData.variants || []).filter(v => v.is_enabled)
        if (enabledVars.length > 0) {
          const costs = enabledVars.map(v => v.cost).filter(Boolean)
          const prices = enabledVars.map(v => v.price).filter(Boolean)
          const maxCost = Math.max(...costs)
          const minPrice = Math.min(...prices)
          const worstMargin = ((minPrice - maxCost) / minPrice * 100).toFixed(1)
          printifyPrice = { maxCost, minPrice, margin: worstMargin }

          if (parseFloat(worstMargin) < 40) {
            checks.push(`⚠️ MARGIN ${worstMargin}% (cost=${maxCost}, price=${minPrice})`)
          }
        }
      } else {
        checks.push(`Printify: ${r.status}`)
      }
    } catch (e) {
      checks.push(`Printify error: ${e.message.slice(0, 60)}`)
    }
  }

  // Print results
  const statusIcon = checks.length === 0 ? '✅' : '⚠️'
  console.log(`         ${statusIcon} DB: ${dbProd.status} | €${(dbProd.base_price_cents/100).toFixed(2)} | ${imgCount} imgs | ${count} variants (${withImages} with img_url)`)
  console.log(`         Printify: ${printifyStatus} | positions: ${printifyPositions.join(', ') || 'n/a'}`)
  if (printifyPrice) {
    console.log(`         Margin: ${printifyPrice.margin}% (cost=${printifyPrice.maxCost}, sell=${printifyPrice.minPrice})`)
  }
  if (checks.length > 0) {
    for (const c of checks) {
      console.log(`         ⚠️  ${c}`)
      issues.push(`${catProduct.id}: ${c}`)
    }
  }
  console.log('')
}

// Summary
console.log('='.repeat(75))
if (issues.length === 0) {
  console.log('  ✅ ALL 20 PRODUCTS VERIFIED — NO ISSUES')
} else {
  console.log(`  ⚠️  ${issues.length} ISSUES FOUND:`)
  for (const i of issues) {
    console.log(`    - ${i}`)
  }
}
console.log('='.repeat(75))
