/**
 * Full diagnostic: compare every Supabase product vs Printify
 * - Images format (string vs object)
 * - Variant count mismatch
 * - Products in SB not in Printify
 * - Outputs a full report
 */
import { readFileSync } from 'fs'
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

async function main() {
  console.log('═'.repeat(70))
  console.log('  FULL DIAGNOSTIC — Printify ↔ Supabase')
  console.log('═'.repeat(70))

  // 1. Get all Printify products (full detail)
  console.log('\n  Fetching Printify products...')
  const printifyMap = {}
  let page = 1
  while (true) {
    const r = await fetch(`${API}/shops/${SHOP}/products.json?page=${page}&limit=50`, { headers: hdrs })
    const data = await r.json()
    if (!data.data || data.data.length === 0) break
    for (const p of data.data) printifyMap[p.id] = p
    if (page >= (data.last_page || 1)) break
    page++
    await delay(500)
  }
  const printifyCount = Object.keys(printifyMap).length
  console.log(`  Printify: ${printifyCount} products`)

  // 2. Get all Supabase products + variants
  const { data: sbProducts } = await sb.from('products').select('*').order('title')
  const { data: sbVariants } = await sb.from('product_variants').select('*')
  console.log(`  Supabase: ${sbProducts.length} products, ${sbVariants.length} variants`)

  // Group SB variants by product_id
  const sbVarsByProduct = {}
  for (const v of sbVariants) {
    if (!sbVarsByProduct[v.product_id]) sbVarsByProduct[v.product_id] = []
    sbVarsByProduct[v.product_id].push(v)
  }

  // 3. Diagnose each product
  const issues = {
    orphaned: [],       // in SB but not in Printify
    imageFormat: [],    // images stored as objects instead of strings
    noImages: [],       // empty images array
    variantMissing: [], // enabled in Printify but missing in SB
    variantExtra: [],   // in SB but not enabled in Printify
  }

  console.log('\n  Diagnosing...\n')

  for (const sp of sbProducts) {
    const pp = printifyMap[sp.printify_id]
    const myVars = sbVarsByProduct[sp.id] || []

    // Orphaned?
    if (!pp) {
      issues.orphaned.push({ title: sp.title, id: sp.id, printify_id: sp.printify_id })
      console.log(`  ❌ ORPHAN  ${sp.title} (${sp.printify_id})`)
      continue
    }

    // Image format check
    const imgs = Array.isArray(sp.images) ? sp.images : []
    if (imgs.length === 0) {
      issues.noImages.push({ title: sp.title, id: sp.id, printify_id: sp.printify_id })
      console.log(`  📷 NO IMG  ${sp.title}`)
    } else if (typeof imgs[0] === 'object' && imgs[0] !== null) {
      // Old format — objects with .src
      issues.imageFormat.push({ title: sp.title, id: sp.id, count: imgs.length })
    }

    // Variant comparison
    const ppEnabled = (pp.variants || []).filter(v => v.is_enabled)
    const ppEnabledIds = new Set(ppEnabled.map(v => String(v.id)))
    const sbVarIds = new Set(myVars.map(v => String(v.printify_variant_id)))

    const missing = ppEnabled.filter(v => !sbVarIds.has(String(v.id)))
    const extra = myVars.filter(v => !ppEnabledIds.has(String(v.printify_variant_id)))

    if (missing.length > 0) {
      issues.variantMissing.push({
        title: sp.title,
        id: sp.id,
        printify_id: sp.printify_id,
        sbCount: myVars.length,
        ppEnabledCount: ppEnabled.length,
        missing: missing.map(v => ({ id: v.id, title: v.title })),
      })
      console.log(`  ⚠ VARS -${missing.length}  ${sp.title} (SB:${myVars.length} vs PP:${ppEnabled.length})`)
    }

    if (extra.length > 0) {
      issues.variantExtra.push({
        title: sp.title,
        id: sp.id,
        sbCount: myVars.length,
        ppEnabledCount: ppEnabled.length,
        extra: extra.map(v => ({ id: v.id, title: v.title })),
      })
    }
  }

  // ─── REPORT ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('  REPORT')
  console.log('═'.repeat(70))

  console.log(`\n  ❌ ORPHANED (SB only, not in Printify): ${issues.orphaned.length}`)
  for (const p of issues.orphaned) console.log(`    ${p.title} — ${p.printify_id}`)

  console.log(`\n  📷 NO IMAGES: ${issues.noImages.length}`)
  for (const p of issues.noImages) console.log(`    ${p.title}`)

  console.log(`\n  🔄 OLD IMAGE FORMAT (objects, not strings): ${issues.imageFormat.length}`)
  for (const p of issues.imageFormat) console.log(`    ${p.title} (${p.count} images)`)

  console.log(`\n  ⚠ MISSING VARIANTS (in Printify but not SB): ${issues.variantMissing.length} products`)
  for (const p of issues.variantMissing) {
    console.log(`    ${p.title} — SB:${p.sbCount} vs Printify:${p.ppEnabledCount} (missing ${p.missing.length})`)
    for (const v of p.missing.slice(0, 5)) console.log(`      - ${v.title}`)
    if (p.missing.length > 5) console.log(`      ... +${p.missing.length - 5} more`)
  }

  console.log(`\n  🗑 EXTRA VARIANTS (in SB but disabled in Printify): ${issues.variantExtra.length} products`)
  for (const p of issues.variantExtra) {
    console.log(`    ${p.title} — SB:${p.sbCount} vs Printify:${p.ppEnabledCount} (extra ${p.extra.length})`)
  }

  console.log('\n' + '═'.repeat(70))
  console.log('  TOTALS')
  console.log(`    Orphaned:        ${issues.orphaned.length}`)
  console.log(`    No images:       ${issues.noImages.length}`)
  console.log(`    Old img format:  ${issues.imageFormat.length}`)
  console.log(`    Missing variants:${issues.variantMissing.length} products`)
  console.log(`    Extra variants:  ${issues.variantExtra.length} products`)
  console.log('═'.repeat(70))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
