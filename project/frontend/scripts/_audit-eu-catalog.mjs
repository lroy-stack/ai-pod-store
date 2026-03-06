/**
 * Full Printify EU Catalog Audit
 * Queries the API directly for ALL blueprints, then checks EU shipping
 * Focus: Drinkware, Shoes, Headwear (+ summary of all categories)
 *
 * Usage: node scripts/_audit-eu-catalog.mjs
 */
import { readFileSync, writeFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]?.trim()
const API = 'https://api.printify.com/v1'

const EU_COUNTRIES = new Set([
  'ES','DE','FR','IT','NL','PL','GB','AT','BE','PT','IE','SE','DK','FI',
  'CZ','GR','HU','RO','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY'
])

const delay = ms => new Promise(r => setTimeout(r, ms))

async function apiFetch(path) {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  if (!r.ok) return null
  return r.json()
}

// ─── Step 1: Get ALL blueprints ──────────────────────────────────────────────
async function getAllBlueprints() {
  console.log('Fetching all blueprints from Printify catalog...')
  const data = await apiFetch('/catalog/blueprints.json')
  if (!data) { console.error('Failed to fetch blueprints'); process.exit(1) }
  console.log(`  Found ${data.length} blueprints total\n`)
  return data
}

// ─── Step 2: For a blueprint, get providers + check EU shipping ──────────────
async function checkBlueprintEU(bp) {
  const providers = await apiFetch(`/catalog/blueprints/${bp.id}/print_providers.json`)
  if (!providers || !Array.isArray(providers)) return null

  const euProviders = []

  for (const prov of providers) {
    await delay(200)

    // Get shipping profiles
    const shipping = await apiFetch(
      `/catalog/blueprints/${bp.id}/print_providers/${prov.id}/shipping.json`
    )
    if (!shipping?.profiles) continue

    // Check for EU country shipping
    let euProfile = null
    let rowProfile = null // REST_OF_WORLD

    for (const profile of shipping.profiles) {
      const countries = profile.countries || []
      const hasDirectEU = countries.some(c => EU_COUNTRIES.has(c))
      const hasROW = countries.includes('REST_OF_WORLD')

      if (hasDirectEU && !euProfile) euProfile = { ...profile, matchType: 'direct' }
      if (hasROW && !rowProfile) rowProfile = { ...profile, matchType: 'REST_OF_WORLD' }
    }

    const bestProfile = euProfile || rowProfile
    if (!bestProfile) continue

    // Get variants + print areas
    await delay(200)
    const varData = await apiFetch(
      `/catalog/blueprints/${bp.id}/print_providers/${prov.id}/variants.json`
    )
    const variants = varData?.variants || []
    const placeholders = variants[0]?.placeholders || []
    const printAreas = placeholders.map(p => ({
      position: p.position,
      width: p.width,
      height: p.height,
    }))

    // Extract shipping cost and time
    const firstItemCost = bestProfile.first_item?.cost
      ? (bestProfile.first_item.cost / 100).toFixed(2)
      : '?'
    const additionalCost = bestProfile.additional_items?.cost
      ? (bestProfile.additional_items.cost / 100).toFixed(2)
      : '?'

    // Handling time (production)
    const handlingMin = shipping.handling_time?.min || '?'
    const handlingMax = shipping.handling_time?.max || '?'

    // Shipping transit time from profile
    const transitMin = bestProfile.first_item?.min_delivery_time || bestProfile.min_delivery_time || '?'
    const transitMax = bestProfile.first_item?.max_delivery_time || bestProfile.max_delivery_time || '?'

    euProviders.push({
      providerId: prov.id,
      providerName: prov.title,
      location: prov.location
        ? `${prov.location.country}/${prov.location.region || '?'}`
        : 'global',
      matchType: bestProfile.matchType,
      shippingCostFirst: firstItemCost,
      shippingCostAdditional: additionalCost,
      handlingDays: `${handlingMin}-${handlingMax}`,
      transitDays: `${transitMin}-${transitMax}`,
      variantCount: variants.length,
      sampleVariants: variants.slice(0, 5).map(v => v.title),
      printAreas,
      printTechnique: prov.technique || '?',
    })
  }

  if (euProviders.length === 0) return null

  return {
    blueprintId: bp.id,
    title: bp.title,
    description: bp.description,
    euProviders,
  }
}

// ─── Categorize blueprints by title keywords ─────────────────────────────────
function categorize(title) {
  const t = title.toLowerCase()

  // Drinkware
  if (t.includes('mug') || t.includes('cup')) return 'MUGS'
  if (t.includes('tumbler')) return 'TUMBLERS'
  if (t.includes('bottle') || t.includes('flask') || t.includes('water')) return 'BOTTLES'
  if (t.includes('can cooler') || t.includes('koozie')) return 'DRINKWARE_OTHER'
  if (t.includes('glass') || t.includes('stein') || t.includes('pint')) return 'DRINKWARE_OTHER'
  if (t.includes('coaster')) return 'DRINKWARE_OTHER'

  // Shoes
  if (t.includes('shoe') || t.includes('sneaker') || t.includes('slip-on') ||
      t.includes('loafer') || t.includes('boot') || t.includes('sandal') ||
      t.includes('canvas shoe') || t.includes('low-top') || t.includes('high-top')) return 'SHOES'

  // Headwear
  if (t.includes('hat') || t.includes('cap') || t.includes('beanie') ||
      t.includes('snapback') || t.includes('visor') || t.includes('bucket') ||
      t.includes('headband') || t.includes('trucker')) return 'HEADWEAR'

  // Clothing
  if (t.includes('t-shirt') || t.includes('tee') || t.includes('tshirt')) return 'TSHIRTS'
  if (t.includes('hoodie') || t.includes('hooded')) return 'HOODIES'
  if (t.includes('sweatshirt') || t.includes('crewneck') || t.includes('crew neck')) return 'SWEATSHIRTS'
  if (t.includes('long sleeve')) return 'LONG_SLEEVES'
  if (t.includes('tank top')) return 'TANK_TOPS'
  if (t.includes('jacket') || t.includes('coat') || t.includes('windbreaker')) return 'OUTERWEAR'
  if (t.includes('shorts') || t.includes('pants') || t.includes('jogger') || t.includes('legging')) return 'BOTTOMS'
  if (t.includes('dress') || t.includes('skirt')) return 'DRESSES'
  if (t.includes('swimsuit') || t.includes('bikini') || t.includes('swim')) return 'SWIMWEAR'

  // Accessories
  if (t.includes('phone case') || t.includes('iphone') || t.includes('samsung') || t.includes('galaxy')) return 'PHONE_CASES'
  if (t.includes('mouse pad') || t.includes('mousepad') || t.includes('desk mat') || t.includes('gaming mat')) return 'MOUSE_PADS'
  if (t.includes('sticker')) return 'STICKERS'
  if (t.includes('tote') || t.includes('bag') || t.includes('backpack') || t.includes('pouch')) return 'BAGS'
  if (t.includes('laptop') || t.includes('sleeve')) return 'LAPTOP_SLEEVES'
  if (t.includes('sock')) return 'SOCKS'
  if (t.includes('mask')) return 'MASKS'

  // Home
  if (t.includes('poster') || t.includes('canvas') || t.includes('print') || t.includes('frame')) return 'WALL_ART'
  if (t.includes('pillow') || t.includes('cushion')) return 'PILLOWS'
  if (t.includes('blanket') || t.includes('throw')) return 'BLANKETS'
  if (t.includes('towel')) return 'TOWELS'
  if (t.includes('ornament')) return 'ORNAMENTS'
  if (t.includes('candle')) return 'CANDLES'
  if (t.includes('puzzle') || t.includes('jigsaw')) return 'PUZZLES'
  if (t.includes('flag') || t.includes('banner')) return 'FLAGS'
  if (t.includes('apron') || t.includes('cutting board') || t.includes('oven')) return 'KITCHEN'
  if (t.includes('notebook') || t.includes('journal') || t.includes('diary')) return 'NOTEBOOKS'
  if (t.includes('magnet')) return 'MAGNETS'
  if (t.includes('postcard') || t.includes('greeting')) return 'CARDS'

  // Kids
  if (t.includes('baby') || t.includes('onesie') || t.includes('bib') || t.includes('toddler') || t.includes('infant') || t.includes('kid')) return 'KIDS'

  return 'OTHER'
}

async function main() {
  const allBPs = await getAllBlueprints()

  // Categorize all
  const byCategory = {}
  for (const bp of allBPs) {
    const cat = categorize(bp.title)
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(bp)
  }

  // Show full catalog summary
  console.log('=' .repeat(70))
  console.log('  PRINTIFY FULL CATALOG — BLUEPRINT COUNT BY CATEGORY')
  console.log('=' .repeat(70))
  const sorted = Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)
  for (const [cat, bps] of sorted) {
    console.log(`  ${cat.padEnd(20)} ${String(bps.length).padStart(4)} blueprints`)
  }
  console.log(`  ${'TOTAL'.padEnd(20)} ${String(allBPs.length).padStart(4)} blueprints`)

  // ─── Deep check: Drinkware, Shoes, Headwear ─────────────────────────────────
  const focusCategories = ['MUGS', 'TUMBLERS', 'BOTTLES', 'DRINKWARE_OTHER', 'SHOES', 'HEADWEAR']
  const focusBPs = allBPs.filter(bp => focusCategories.includes(categorize(bp.title)))

  console.log(`\n${'='.repeat(70)}`)
  console.log(`  DEEP EU CHECK — ${focusBPs.length} blueprints (drinkware + shoes + headwear)`)
  console.log(`${'='.repeat(70)}\n`)

  const results = { MUGS: [], TUMBLERS: [], BOTTLES: [], DRINKWARE_OTHER: [], SHOES: [], HEADWEAR: [] }

  for (const [i, bp] of focusBPs.entries()) {
    const cat = categorize(bp.title)
    process.stdout.write(`  [${i+1}/${focusBPs.length}] BP ${bp.id}: ${bp.title}...`)

    const result = await checkBlueprintEU(bp)
    if (result) {
      results[cat].push(result)
      const best = result.euProviders[0]
      console.log(` ✓ EU (${best.providerName}, $${best.shippingCostFirst}, ${best.handlingDays}d prod, ${best.transitDays}d ship)`)
    } else {
      console.log(' ✗ NO EU')
    }

    await delay(300)
  }

  // ─── DETAILED REPORTS ──────────────────────────────────────────────────────
  for (const [cat, items] of Object.entries(results)) {
    if (items.length === 0 && ['MUGS', 'SHOES'].includes(cat)) {
      console.log(`\n${'─'.repeat(70)}`)
      console.log(`  ${cat}: ✗ ZERO blueprints with EU shipping`)
      console.log(`${'─'.repeat(70)}`)
      continue
    }
    if (items.length === 0) continue

    console.log(`\n${'─'.repeat(70)}`)
    console.log(`  ${cat} — ${items.length} blueprints with EU shipping`)
    console.log(`${'─'.repeat(70)}`)

    for (const item of items) {
      console.log(`\n  BP ${item.blueprintId}: ${item.title}`)
      for (const prov of item.euProviders.slice(0, 3)) {
        const areas = prov.printAreas.map(a => `${a.position}(${a.width}x${a.height})`).join(', ')
        console.log(`    Provider ${prov.providerId}: "${prov.providerName}" (${prov.location})`)
        console.log(`      Match: ${prov.matchType} | Technique: ${prov.printTechnique}`)
        console.log(`      Shipping: $${prov.shippingCostFirst} first / $${prov.shippingCostAdditional} additional`)
        console.log(`      Production: ${prov.handlingDays} business days`)
        console.log(`      Transit: ${prov.transitDays} business days`)
        console.log(`      Variants: ${prov.variantCount} | Print areas: ${areas || 'none'}`)
        console.log(`      Samples: ${prov.sampleVariants.slice(0, 3).join(' | ')}`)
      }
    }
  }

  // ─── Save JSON report ──────────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    totalBlueprints: allBPs.length,
    categorySummary: Object.fromEntries(sorted),
    euResults: results,
  }
  const outPath = new URL('../public/eu-catalog-audit.json', import.meta.url).pathname
  writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\n\nFull report saved to: ${outPath}`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
