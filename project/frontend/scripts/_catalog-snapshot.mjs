/**
 * Catalog Snapshot — Audita el estado real de TODOS los productos.
 * Consulta Printify API + Supabase para obtener datos reales.
 *
 * Output: JSON + resumen en consola
 * Usage: node scripts/_catalog-snapshot.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── ENV ─────────────────────────────────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const TOKEN   = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL  = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY  = env('SUPABASE_SERVICE_KEY')

if (!TOKEN || !SHOP_ID) { console.error('Missing Printify creds'); process.exit(1) }
if (!SB_URL || !SB_KEY) { console.error('Missing Supabase creds'); process.exit(1) }

const supabase = createClient(SB_URL, SB_KEY)

const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

// EU country codes
const EU = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'])

async function fetchJSON(url) {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  CATALOG SNAPSHOT — Estado real completo')
  console.log('═══════════════════════════════════════════════════════\n')

  // ── 1. Fetch ALL products from Printify ──────────────────────────────────
  console.log('1. Fetching Printify products...')
  let allPrintify = []
  let page = 1
  while (true) {
    const data = await fetchJSON(`${API}/shops/${SHOP_ID}/products.json?page=${page}&limit=50`)
    const items = data.data || data
    if (!Array.isArray(items) || items.length === 0) break
    allPrintify.push(...items)
    if (items.length < 50) break
    page++
    await delay(300)
  }
  console.log(`   Printify total: ${allPrintify.length} productos\n`)

  // ── 2. Fetch Supabase products ───────────────────────────────────────────
  console.log('2. Fetching Supabase products...')
  const { data: sbActive } = await supabase.from('products')
    .select('id, title, printify_id, blueprint_id, print_provider_id, category_id, base_price_cents, status, images')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('title')

  const { data: sbDeleted } = await supabase.from('products')
    .select('id, title, printify_id, blueprint_id, print_provider_id, category_id, base_price_cents, status, images, description')
    .eq('status', 'deleted')
    .order('title')

  const { data: cats } = await supabase.from('categories').select('id, slug, name')
  const catMap = new Map((cats || []).map(c => [c.id, c.slug]))

  console.log(`   Supabase activos: ${sbActive.length}`)
  console.log(`   Supabase eliminados: ${sbDeleted.length}\n`)

  // ── 3. For each active Printify product: get variants + EU shipping ──────
  console.log('3. Auditing active products...\n')
  const euCache = new Map()
  const activeProducts = []

  for (const pp of allPrintify) {
    const bpKey = `${pp.blueprint_id}:${pp.print_provider_id}`

    // Check EU shipping (cached)
    if (!euCache.has(bpKey)) {
      try {
        const shipping = await fetchJSON(
          `${API}/catalog/blueprints/${pp.blueprint_id}/print_providers/${pp.print_provider_id}/shipping.json`
        )
        let hasEU = false
        for (const profile of (shipping.profiles || shipping || [])) {
          if ((profile.countries || []).some(c => EU.has(c))) { hasEU = true; break }
        }
        euCache.set(bpKey, hasEU)
      } catch {
        euCache.set(bpKey, '??')
      }
      await delay(200)
    }

    // Parse variants
    const enabledVariants = (pp.variants || []).filter(v => v.is_enabled)
    const sizes = [...new Set(enabledVariants.map(v => {
      const parts = (v.title || '').split(' / ').map(p => p.trim())
      if (parts.length >= 2) return parts[parts.length - 1]
      return null
    }).filter(Boolean))]

    const colors = [...new Set(enabledVariants.map(v => {
      const parts = (v.title || '').split(' / ').map(p => p.trim())
      if (parts.length >= 2) return parts[0]
      if (parts.length === 1) return parts[0]
      return null
    }).filter(Boolean))]

    const images = (pp.images || []).map(i => i.src || i.url || '').filter(Boolean)

    // Match to Supabase
    const sbMatch = sbActive.find(s => s.printify_id === String(pp.id))
    const cat = sbMatch ? catMap.get(sbMatch.category_id) : '??'
    const price = sbMatch ? sbMatch.base_price_cents : null

    activeProducts.push({
      title: pp.title,
      printifyId: String(pp.id),
      blueprintId: pp.blueprint_id,
      printProviderId: pp.print_provider_id,
      bpKey: `BP${pp.blueprint_id}/P${pp.print_provider_id}`,
      hasEU: euCache.get(bpKey),
      category: cat,
      priceCents: price,
      variantCount: enabledVariants.length,
      sizes,
      colors,
      imageCount: images.length,
      supabaseId: sbMatch?.id || null,
      status: 'active',
    })

    console.log(`  ✓ ${pp.title}`)
    console.log(`    BP${pp.blueprint_id}/P${pp.print_provider_id} | EU: ${euCache.get(bpKey)} | ${enabledVariants.length} variants | ${colors.length} colors | ${sizes.length} sizes | ${images.length} imgs`)
  }

  // ── 4. Map deleted products ──────────────────────────────────────────────
  console.log('\n4. Mapping deleted products...\n')

  // EU replacement map from CATALOGO_EU_DEFINITIVO
  const EU_REPLACEMENT = {
    // Tees: P103/P99/P217 → P26 (Textildruck EU)
    '6:103': { bp: 6, prov: 26, label: 'Gildan 5000 / Textildruck EU' },
    '6:99':  { bp: 6, prov: 26, label: 'Gildan 5000 / Textildruck EU' },
    // Hoodies: P217 → P26
    '77:217': { bp: 77, prov: 26, label: 'Gildan 18500 / Textildruck EU' },
    '77:99':  { bp: 77, prov: 26, label: 'Gildan 18500 / Textildruck EU' },
    // Crewnecks: P34 → P26
    '49:34':  { bp: 49, prov: 26, label: 'Gildan 18000 / Textildruck EU' },
    '49:99':  { bp: 49, prov: 26, label: 'Gildan 18000 / Textildruck EU' },
    // Long Sleeves: P217 → P26
    '879:217': { bp: 80, prov: 26, label: 'Gildan 2400 LS / Textildruck EU' },
    // Caps: P99 → P410 (Printful)
    '1744:99':  { bp: 1744, prov: 410, label: 'Structured Cap / Printful' },
    '1108:99':  { bp: 1744, prov: 410, label: 'Structured Cap / Printful' },
    // Beanies: P99 → P410
    '1691:99':  { bp: 1691, prov: 410, label: 'Cuffed Beanie / Printful' },
    // Bucket Hats: P99 → P410
    '1910:99':  { bp: 1910, prov: 410, label: 'Bucket Hat / Printful' },
    // Snapbacks: P217 → P410
    '1446:217': { bp: 1743, prov: 410, label: 'Snapback Trucker / Printful' },
    // Dad Hats: P217 → P410
    '1447:217': { bp: 1729, prov: 410, label: 'Dad Hat / Printful' },
    // Tumblers
    '693:75':  { bp: 1927, prov: 410, label: 'SS Tumbler / Printful' },
    '353:1':   { bp: 966, prov: 86, label: 'Vagabond / Chill' },
    // Bottles
    '482:28':  { bp: 854, prov: 23, label: 'SS Bottle / WOYC' },
    // Stickers
    '794:73':  { bp: 476, prov: 30, label: 'Square Vinyl / OPT OnDemand' },
  }

  const deletedProducts = []
  for (const p of (sbDeleted || [])) {
    if (p.title?.startsWith('[E2E]')) continue

    const oldKey = `${p.blueprint_id}:${p.print_provider_id}`
    const replacement = EU_REPLACEMENT[oldKey]
    const cat = catMap.get(p.category_id) || '??'

    deletedProducts.push({
      title: p.title,
      supabaseId: p.id,
      printifyId: p.printify_id,
      oldBP: p.blueprint_id,
      oldProvider: p.print_provider_id,
      oldKey: `BP${p.blueprint_id}/P${p.print_provider_id}`,
      newBP: replacement?.bp || null,
      newProvider: replacement?.prov || null,
      newKey: replacement ? `BP${replacement.bp}/P${replacement.prov}` : 'MANUAL',
      replacementLabel: replacement?.label || 'NEEDS MANUAL MAPPING',
      category: cat,
      priceCents: p.base_price_cents,
      description: p.description?.substring(0, 100) || '',
      imageCount: Array.isArray(p.images) ? p.images.length : 0,
    })

    console.log(`  ${p.title}`)
    console.log(`    ${`BP${p.blueprint_id}/P${p.print_provider_id}`} → ${replacement ? `BP${replacement.bp}/P${replacement.prov} (${replacement.label})` : 'NEEDS MANUAL MAPPING'}`)
    console.log(`    Cat: ${cat} | Price: ${p.base_price_cents ? `€${(p.base_price_cents/100).toFixed(2)}` : '??'}`)
  }

  // ── 5. Summary ───────────────────────────────────────────────────────────
  const snapshot = {
    timestamp: new Date().toISOString(),
    summary: {
      printifyTotal: allPrintify.length,
      supabaseActive: sbActive.length,
      supabaseDeleted: (sbDeleted || []).filter(p => !p.title?.startsWith('[E2E]')).length,
      activeWithEU: activeProducts.filter(p => p.hasEU === true).length,
      activeWithoutEU: activeProducts.filter(p => p.hasEU === false).length,
      deletedWithMapping: deletedProducts.filter(p => p.newBP !== null).length,
      deletedNeedsManual: deletedProducts.filter(p => p.newBP === null).length,
    },
    activeProducts,
    deletedProducts,
    categories: cats,
  }

  const outPath = join(import.meta.dirname, '_catalog-snapshot.json')
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2))

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  RESUMEN')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Printify activos:       ${snapshot.summary.printifyTotal}`)
  console.log(`  Supabase activos:       ${snapshot.summary.supabaseActive}`)
  console.log(`  Con envio EU:           ${snapshot.summary.activeWithEU}`)
  console.log(`  Sin envio EU:           ${snapshot.summary.activeWithoutEU}`)
  console.log(`  Eliminados total:       ${snapshot.summary.supabaseDeleted}`)
  console.log(`  Con mapping EU:         ${snapshot.summary.deletedWithMapping}`)
  console.log(`  Necesitan mapping:      ${snapshot.summary.deletedNeedsManual}`)
  console.log(`\n  JSON guardado en: ${outPath}`)
}

main().catch(e => console.error('FATAL:', e.message))
