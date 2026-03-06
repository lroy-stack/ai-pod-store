/**
 * CATALOGO DEFINITIVO: Datos reales de cada BP/Provider EU
 * - Precios base (variant costs from shop products)
 * - Shipping costs a EU (from catalog API)
 * - País de fulfillment
 * - Canvas sizes
 * - Variantes disponibles
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

const EU = new Set(['ES','DE','FR','IT','NL','PL','GB','AT','BE','PT','IE','SE','DK','FI','CZ','GR','HU','RO','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY'])

// ALL BP/Provider combos we want to evaluate for our definitive catalog
const CATALOG_CANDIDATES = [
  // === ROPA (Textildruck Europa P26, Alemania) ===
  { bp: 6, prov: 26, category: 'T-Shirts', note: 'Gildan 5000 Heavy Cotton' },
  { bp: 12, prov: 26, category: 'T-Shirts', note: 'Bella+Canvas 3001 Unisex' },
  { bp: 145, prov: 26, category: 'T-Shirts', note: 'Gildan 64000 Softstyle' },
  { bp: 454, prov: 26, category: 'T-Shirts', note: 'B&C TU01T Men Tee' },
  { bp: 1462, prov: 26, category: 'T-Shirts', note: 'Stanley Stella Creator 2.0 (organic)' },
  { bp: 77, prov: 26, category: 'Pullover Hoodies', note: 'Gildan 18500' },
  { bp: 458, prov: 26, category: 'Pullover Hoodies', note: 'B&C WUI24 Pullover' },
  { bp: 92, prov: 26, category: 'Pullover Hoodies', note: 'AWDIS JH001 College Hoodie' },
  { bp: 455, prov: 26, category: 'Zip-Up Hoodies', note: 'Gildan 18600 (ya en tienda)' },
  { bp: 49, prov: 26, category: 'Crewnecks', note: 'Gildan 18000 Heavy Blend' },
  { bp: 457, prov: 26, category: 'Crewnecks', note: 'B&C WUI23 (ya en tienda)' },
  { bp: 80, prov: 26, category: 'Long Sleeves', note: 'Gildan 2400 Ultra Cotton LS' },
  // === ROPA (Printful P410, Letonia) ===
  { bp: 6, prov: 410, category: 'T-Shirts', note: 'Gildan 5000 via Printful' },
  { bp: 77, prov: 410, category: 'Pullover Hoodies', note: 'Gildan 18500 via Printful' },
  { bp: 793, prov: 410, category: 'Embroidered Hoodies', note: 'Gildan 18500 Embroidered (ya en tienda)' },
  // === HEADWEAR (Printful P410) ===
  { bp: 1744, prov: 410, category: 'Caps', note: 'Yupoong 6089M Structured Cap' },
  { bp: 1691, prov: 410, category: 'Beanies', note: 'Yupoong 1501KC Cuffed Beanie' },
  { bp: 1743, prov: 410, category: 'Snapbacks', note: 'Yupoong 6606 Snapback Trucker' },
  { bp: 1729, prov: 410, category: 'Dad Hats', note: 'Sportsman SP500 Dad Hat' },
  { bp: 1910, prov: 410, category: 'Bucket Hats', note: 'Big Accessories BA682 (ya en tienda)' },
  { bp: 1755, prov: 410, category: 'Snapbacks', note: 'Yupoong 6007 Flat Bill (alt)' },
  // === ACCESORIOS ===
  { bp: 1018, prov: 26, category: 'Mugs', note: 'Two-Tone Mug 11oz (ya en tienda)' },
  { bp: 1016, prov: 26, category: 'Mugs', note: 'Standard Mug 11oz Textildruck' },
  { bp: 854, prov: 23, category: 'Bottles', note: 'SS Bottle Handle Lid WOYC (ya en tienda)' },
  { bp: 969, prov: 90, category: 'Desk Mats', note: 'Large Desk Mat Smart Printee (ya en tienda)' },
  { bp: 767, prov: 90, category: 'Sneakers', note: 'Low Top Sneaker Smart Printee (ya en tienda)' },
  { bp: 442, prov: 30, category: 'Mouse Pads', note: 'Mouse Pad OPT OnDemand' },
  { bp: 476, prov: 30, category: 'Stickers', note: 'Square Vinyl Sticker OPT OnDemand' },
  { bp: 1216, prov: 255, category: 'Stickers', note: 'Kiss-Cut Vinyl Sticky Products EU' },
  { bp: 1927, prov: 410, category: 'Tumblers', note: 'SS Tumbler 20oz Printful' },
  { bp: 966, prov: 86, category: 'Tumblers', note: 'Vagabond 20oz Chill' },
  // === SHOES ===
  { bp: 1470, prov: 90, category: 'Sneakers', note: 'EVA Foam AOP Smart Printee' },
]

// Provider info
const PROVIDERS = {
  26: { name: 'Textildruck Europa', country: '🇩🇪 Germany' },
  410: { name: 'Printful', country: '🇱🇻 Latvia (EU)' },
  23: { name: 'WOYC', country: '🇺🇸 US (ships EU)' },
  90: { name: 'Smart Printee', country: '🇨🇳 CN (ships EU)' },
  30: { name: 'OPT OnDemand', country: '🇺🇸 US (ships EU)' },
  255: { name: 'Sticky Products', country: '🇪🇺 EU' },
  86: { name: 'Chill', country: '🇺🇸 US (ships EU)' },
  94: { name: 'Harrier', country: '🇬🇧 UK (ships EU)' },
}

async function main() {
  const results = []

  console.log('Fetching data for', CATALOG_CANDIDATES.length, 'BP/Provider combos...\n')

  for (const [i, cand] of CATALOG_CANDIDATES.entries()) {
    process.stdout.write(`  [${i+1}/${CATALOG_CANDIDATES.length}] BP${cand.bp}/P${cand.prov} ${cand.note.substring(0,40)}...`)

    // 1. Get blueprint name
    await delay(300)
    const bpR = await fetch(`${API}/catalog/blueprints/${cand.bp}.json`, { headers: hdrs })
    const bpData = bpR.ok ? await bpR.json() : {}

    // 2. Get variants (for canvas size)
    await delay(300)
    const varR = await fetch(`${API}/catalog/blueprints/${cand.bp}/print_providers/${cand.prov}/variants.json`, { headers: hdrs })
    const varData = varR.ok ? await varR.json() : {}
    const variants = varData.variants || []
    
    // Extract canvas from first variant
    const placeholders = variants[0]?.placeholders || []
    const frontPh = placeholders.find(p => p.position === 'front') || placeholders[0] || {}
    const canvas = frontPh.width && frontPh.height ? `${frontPh.width}x${frontPh.height}` : '??'

    // Get unique colors
    const colors = [...new Set(variants.map(v => v.options?.color).filter(Boolean))]

    // 3. Get shipping
    await delay(300)
    const shipR = await fetch(`${API}/catalog/blueprints/${cand.bp}/print_providers/${cand.prov}/shipping.json`, { headers: hdrs })
    const shipData = shipR.ok ? await shipR.json() : {}
    const profiles = shipData.profiles || []
    const handling = shipData.handling_time || {}

    // Find EU shipping cost (profile with EU countries)
    let euShipFirst = null
    let euShipAdd = null
    let euCountryCount = 0
    for (const profile of profiles) {
      const countries = profile.countries || []
      const euC = countries.filter(c => EU.has(c))
      if (euC.length > 0) {
        euCountryCount = Math.max(euCountryCount, euC.length)
        if (euShipFirst === null || (profile.first_item?.cost || 0) < euShipFirst) {
          euShipFirst = profile.first_item?.cost || 0
          euShipAdd = profile.additional_items?.cost || 0
        }
      }
    }

    // 4. Get base cost from existing shop products (if any)
    await delay(300)
    // Search for any existing product with this BP/provider to get real costs
    const searchR = await fetch(`${API}/shops/${SHOP}/products.json?limit=50`, { headers: hdrs })
    const searchData = searchR.ok ? await searchR.json() : {}
    const shopProduct = (searchData.data || []).find(p => p.blueprint_id === cand.bp && p.print_provider_id === cand.prov)
    
    let baseCostMin = null, baseCostMax = null
    if (shopProduct) {
      const enabledVars = shopProduct.variants?.filter(v => v.is_enabled) || []
      const costs = enabledVars.map(v => v.cost).filter(c => c > 0)
      if (costs.length > 0) {
        baseCostMin = Math.min(...costs)
        baseCostMax = Math.max(...costs)
      }
    }

    const hasEU = euCountryCount > 0

    results.push({
      bp: cand.bp,
      prov: cand.prov,
      category: cand.category,
      note: cand.note,
      bpTitle: bpData.title || '??',
      canvas,
      totalVariants: variants.length,
      colors: colors.length,
      colorList: colors,
      hasEU,
      euCountries: euCountryCount,
      euShipFirst: euShipFirst !== null ? euShipFirst / 100 : null,
      euShipAdd: euShipAdd !== null ? euShipAdd / 100 : null,
      baseCostMin: baseCostMin !== null ? baseCostMin / 100 : null,
      baseCostMax: baseCostMax !== null ? baseCostMax / 100 : null,
      handlingMin: handling.min,
      handlingMax: handling.max,
      provName: PROVIDERS[cand.prov]?.name || `P${cand.prov}`,
      provCountry: PROVIDERS[cand.prov]?.country || '??',
      printMethod: variants[0]?.decoration_methods?.join(', ') || '??',
      allPositions: [...new Set(placeholders.map(p => p.position))],
    })

    console.log(hasEU ? ` ✅ EU(${euCountryCount})` : ' ❌ NO EU')
  }

  // Output structured JSON for further analysis
  const outputPath = join(ROOT, 'scripts', '_catalog-results.json')
  const { writeFileSync } = await import('fs')
  writeFileSync(outputPath, JSON.stringify(results, null, 2))

  // Pretty print
  console.log('\n' + '═'.repeat(100))
  console.log('  CATÁLOGO DEFINITIVO SKAPARA — Blueprint/Provider EU Confirmados')
  console.log('═'.repeat(100))

  const categories = [...new Set(results.map(r => r.category))]
  for (const cat of categories) {
    const items = results.filter(r => r.category === cat && r.hasEU)
    if (items.length === 0) continue

    console.log(`\n  ▸ ${cat.toUpperCase()} (${items.length} opciones EU)`)
    console.log('  ' + '─'.repeat(96))

    for (const item of items) {
      const cost = item.baseCostMin !== null 
        ? `$${item.baseCostMin.toFixed(2)}-$${item.baseCostMax.toFixed(2)}` 
        : 'sin dato (no hay producto en tienda)'
      const ship = item.euShipFirst !== null 
        ? `$${item.euShipFirst.toFixed(2)} (+$${item.euShipAdd.toFixed(2)}/extra)` 
        : '??'
      
      console.log(`    BP${item.bp}/P${item.prov} — ${item.bpTitle}`)
      console.log(`      Proveedor: ${item.provName} ${item.provCountry}`)
      console.log(`      Canvas: ${item.canvas} | Print: ${item.printMethod} | Posiciones: ${item.allPositions.join(', ')}`)
      console.log(`      Variantes: ${item.totalVariants} (${item.colors} colores) | EU: ${item.euCountries} países`)
      console.log(`      Handling: ${item.handlingMin || '?'}-${item.handlingMax || '?'} días | Ship EU: ${ship}`)
      console.log(`      Coste base: ${cost}`)
      if (item.note.includes('ya en tienda')) console.log(`      ★ YA EN TIENDA`)
      console.log()
    }
  }

  // Items without EU
  const noEU = results.filter(r => !r.hasEU)
  if (noEU.length > 0) {
    console.log(`\n  ❌ SIN EU (DESCARTADOS): ${noEU.length}`)
    for (const item of noEU) {
      console.log(`    BP${item.bp}/P${item.prov} — ${item.bpTitle} (${item.provName})`)
    }
  }

  console.log('\n' + '═'.repeat(100))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
