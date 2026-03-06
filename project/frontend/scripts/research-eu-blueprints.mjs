#!/usr/bin/env node
/**
 * Research EU Blueprints — Query Printify API for all blueprints available
 * from EU-approved providers and generate a comprehensive report.
 *
 * Usage: PRINTIFY_TOKEN=xxx node scripts/research-eu-blueprints.mjs [--filter keyword]
 *
 * EU-Approved Providers:
 *   P26  — Textildruck Europa (Germany) — DTG
 *   P410 — Printful (Latvia) — Embroidery/UV
 *   P90  — Smart Printee — Sublimation
 *   P23  — WOYC — Sublimation (bottles)
 *   P30  — OPT OnDemand — UV (stickers, mouse pads)
 *   P255 — Dimona Tee — DTG
 *   P86  — The Dream Junction — UV (tumblers)
 */

const PRINTIFY_TOKEN = process.env.PRINTIFY_TOKEN
if (!PRINTIFY_TOKEN) {
  console.error('ERROR: Set PRINTIFY_TOKEN environment variable')
  process.exit(1)
}

const EU_PROVIDERS = new Map([
  [26, 'Textildruck Europa'],
  [410, 'Printful'],
  [90, 'Smart Printee'],
  [23, 'WOYC'],
  [30, 'OPT OnDemand'],
  [255, 'Dimona Tee'],
  [86, 'The Dream Junction'],
])

const API_BASE = 'https://api.printify.com/v1'
const filterKeyword = process.argv.includes('--filter')
  ? process.argv[process.argv.indexOf('--filter') + 1]?.toLowerCase()
  : null

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${PRINTIFY_TOKEN}` },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`)
  return res.json()
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('Fetching all blueprints from Printify...')
  const blueprints = await fetchJSON(`${API_BASE}/catalog/blueprints.json`)
  console.log(`Found ${blueprints.length} total blueprints\n`)

  // Filter by keyword if provided
  const filtered = filterKeyword
    ? blueprints.filter(bp => bp.title.toLowerCase().includes(filterKeyword))
    : blueprints

  if (filterKeyword) {
    console.log(`Filtered to ${filtered.length} blueprints matching "${filterKeyword}"\n`)
  }

  const results = []

  for (const bp of filtered) {
    // Rate limit: Printify allows ~5 req/s
    await sleep(250)

    try {
      const providers = await fetchJSON(
        `${API_BASE}/catalog/blueprints/${bp.id}/print_providers.json`
      )

      const euProviders = providers.filter(p => EU_PROVIDERS.has(p.id))
      if (euProviders.length === 0) continue

      for (const provider of euProviders) {
        // Get print areas / canvas sizes for this BP+Provider combo
        await sleep(250)
        let variants = []
        try {
          const variantData = await fetchJSON(
            `${API_BASE}/catalog/blueprints/${bp.id}/print_providers/${provider.id}/variants.json`
          )
          variants = variantData.variants || variantData || []
        } catch {
          // Some combos don't have variant data
        }

        results.push({
          blueprint_id: bp.id,
          blueprint_title: bp.title,
          provider_id: provider.id,
          provider_name: EU_PROVIDERS.get(provider.id),
          variant_count: Array.isArray(variants) ? variants.length : 0,
        })

        console.log(
          `  BP${bp.id} — ${bp.title} — P${provider.id} (${EU_PROVIDERS.get(provider.id)}) — ${Array.isArray(variants) ? variants.length : '?'} variants`
        )
      }
    } catch (err) {
      console.error(`  ERROR BP${bp.id}: ${err.message}`)
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log(`RESULTS: ${results.length} EU-available blueprint+provider combinations`)
  console.log(`${'='.repeat(80)}\n`)

  // Group by product type (rough categorization from title)
  const categories = {
    'T-Shirts': [],
    'Hoodies': [],
    'Crewnecks/Sweatshirts': [],
    'Long Sleeves': [],
    'Caps/Hats': [],
    'Beanies': [],
    'Kids': [],
    'Mugs': [],
    'Bottles/Tumblers': [],
    'Stickers': [],
    'Mouse Pads/Desk Mats': [],
    'Sneakers/Footwear': [],
    'Phone Cases': [],
    'Tote Bags': [],
    'Other': [],
  }

  for (const r of results) {
    const t = r.blueprint_title.toLowerCase()
    if (t.includes('kid') || t.includes('youth') || t.includes('baby') || t.includes('infant') || t.includes('toddler') || t.includes('onesie') || t.includes('bodysuit')) {
      categories['Kids'].push(r)
    } else if (t.includes('t-shirt') || t.includes('tee') || t.includes('tshirt') || t.includes('tank')) {
      categories['T-Shirts'].push(r)
    } else if (t.includes('hoodie') || t.includes('zip')) {
      categories['Hoodies'].push(r)
    } else if (t.includes('crewneck') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('fleece')) {
      categories['Crewnecks/Sweatshirts'].push(r)
    } else if (t.includes('long sleeve') || t.includes('longsleeve')) {
      categories['Long Sleeves'].push(r)
    } else if (t.includes('cap') || t.includes('hat') || t.includes('snapback') || t.includes('trucker') || t.includes('bucket') || t.includes('visor')) {
      categories['Caps/Hats'].push(r)
    } else if (t.includes('beanie') || t.includes('knit')) {
      categories['Beanies'].push(r)
    } else if (t.includes('mug') || t.includes('cup') || t.includes('mason jar')) {
      categories['Mugs'].push(r)
    } else if (t.includes('bottle') || t.includes('tumbler') || t.includes('vagabond') || t.includes('flask') || t.includes('can')) {
      categories['Bottles/Tumblers'].push(r)
    } else if (t.includes('sticker') || t.includes('decal')) {
      categories['Stickers'].push(r)
    } else if (t.includes('mouse') || t.includes('desk mat') || t.includes('mousepad') || t.includes('mat')) {
      categories['Mouse Pads/Desk Mats'].push(r)
    } else if (t.includes('sneaker') || t.includes('shoe') || t.includes('slip-on') || t.includes('flip flop') || t.includes('slide')) {
      categories['Sneakers/Footwear'].push(r)
    } else if (t.includes('phone') || t.includes('case') || t.includes('iphone') || t.includes('samsung')) {
      categories['Phone Cases'].push(r)
    } else if (t.includes('tote') || t.includes('bag') || t.includes('backpack')) {
      categories['Tote Bags'].push(r)
    } else {
      categories['Other'].push(r)
    }
  }

  for (const [cat, items] of Object.entries(categories)) {
    if (items.length === 0) continue
    console.log(`\n## ${cat} (${items.length} combos)`)
    for (const item of items) {
      console.log(`  BP${item.blueprint_id} — ${item.blueprint_title} — P${item.provider_id} (${item.provider_name}) — ${item.variant_count} variants`)
    }
  }

  // Save full results to JSON
  const outputPath = new URL('./_eu-blueprints-report.json', import.meta.url)
  const { writeFileSync } = await import('fs')
  const { fileURLToPath } = await import('url')
  writeFileSync(fileURLToPath(outputPath), JSON.stringify(results, null, 2))
  console.log(`\nFull results saved to scripts/_eu-blueprints-report.json`)

  // Specific queries from the plan
  console.log(`\n${'='.repeat(80)}`)
  console.log('SPECIFIC QUERIES (from expansion plan):')
  console.log(`${'='.repeat(80)}`)

  const queries = ['kids', 'baby', 'bodysuit', 'onesie', 'tank', 'tote', 'sock', 'phone case', 'iphone', 'flip flop', 'slide', 'card', 'postcard']
  for (const q of queries) {
    const matches = results.filter(r => r.blueprint_title.toLowerCase().includes(q))
    if (matches.length > 0) {
      console.log(`\n"${q}": ${matches.length} match(es)`)
      for (const m of matches) {
        console.log(`  BP${m.blueprint_id} — ${m.blueprint_title} — P${m.provider_id} (${m.provider_name})`)
      }
    } else {
      console.log(`\n"${q}": NO EU matches`)
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
