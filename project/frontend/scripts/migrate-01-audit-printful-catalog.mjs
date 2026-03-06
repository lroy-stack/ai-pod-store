/**
 * migrate-01-audit-printful-catalog.mjs
 *
 * Block 2D — Script 1: Audit Printful Catalog
 *
 * Queries Printful Catalog API to verify each Printify blueprint has a matching
 * Printful product with EU availability.
 *
 * Input:  Hard-coded blueprint mapping from 04-catalog-migration.md
 * Output: frontend/scripts/printful-catalog-map.json
 *
 * Usage:
 *   cd frontend && node scripts/migrate-01-audit-printful-catalog.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const PRINTFUL_TOKEN = env('PRINTFUL_API_TOKEN')
// Catalog API is public (no auth needed for GET /products/{id}),
// but we include the token for rate-limit headroom.

if (!PRINTFUL_TOKEN) {
  console.error('ERROR: PRINTFUL_API_TOKEN not found in .env.local')
  process.exit(1)
}

// ─── Rate Limiting ──────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const DELAY_MS = 2000 // 2 seconds between calls

// ─── Printful Fetch Helper ──────────────────────────────────────────────────────

async function printfulFetch(path, retries = 3) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SKAPARA-POD/1.0',
    },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    console.log(`  Rate limited, waiting ${retryAfter}s...`)
    await delay(retryAfter * 1000)
    if (retries > 0) return printfulFetch(path, retries - 1)
    throw new Error(`Rate limited on ${path} after retries`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Printful ${res.status}: ${body.slice(0, 300)}`)
  }

  const json = await res.json()
  if (json.code !== 200) {
    throw new Error(`Printful API error: ${json.code} ${json.error?.message || JSON.stringify(json)}`)
  }
  return json.result
}

// ─── Blueprint Mapping Table ────────────────────────────────────────────────────
// From 04-catalog-migration.md Sections B.1 through B.5

const BLUEPRINT_AUDIT = [
  // B.1 — Garments — P26 (DTG, Germany)
  { bp: 6,    name: 'Gildan 5000 Unisex Heavy Cotton Tee',                 provider: 'P26',  count: 16, printfulCandidate: 4,    notes: '' },
  { bp: 12,   name: 'Gildan 64000 Unisex Softstyle Tee',                   provider: 'P26',  count: 1,  printfulCandidate: 64,   notes: '' },
  { bp: 49,   name: 'Gildan 18000 Crewneck Sweatshirt',                    provider: 'P26',  count: 4,  printfulCandidate: 28,   notes: '' },
  { bp: 65,   name: 'Kids Organic Sweatshirt (Stanley/Stella)',             provider: 'P26',  count: 1,  printfulCandidate: null,  notes: 'TBD — search for Stanley/Stella kids sweatshirt' },
  { bp: 67,   name: 'Baby/Toddler Organic Sweatshirt (Stanley/Stella)',     provider: 'P26',  count: 1,  printfulCandidate: null,  notes: 'TBD — may need alternative' },
  { bp: 77,   name: 'Gildan 18500 Unisex Heavy Blend Hoodie',              provider: 'P26',  count: 5,  printfulCandidate: 18,   notes: '' },
  { bp: 80,   name: 'Gildan 2400 Long Sleeve Tee',                         provider: 'P26',  count: 3,  printfulCandidate: 2,    notes: '' },
  { bp: 81,   name: 'Gildan 5000B Heavy Cotton Youth Tee',                 provider: 'P26',  count: 2,  printfulCandidate: 7,    notes: '' },
  { bp: 145,  name: 'Gildan 2400 Long Sleeve (alt)',                        provider: 'P26',  count: 1,  printfulCandidate: 2,    notes: 'Verify exact spec matches BP80' },
  { bp: 157,  name: 'B&C TK300 Kids Tee',                                  provider: 'P26',  count: 1,  printfulCandidate: null,  notes: 'TBD — B&C brand available at Printful EU' },
  { bp: 454,  name: 'B&C E190 Exact 190 T-Shirt',                          provider: 'P26',  count: 1,  printfulCandidate: null,  notes: 'TBD — may not be in Printful catalog' },
  { bp: 455,  name: 'Zip-Up Hoodie (B&C WM647)',                           provider: 'P26',  count: 1,  printfulCandidate: null,  notes: 'HIGH RISK — specific model may not be available' },
  { bp: 457,  name: 'Crewneck Sweatshirt (B&C WU600)',                     provider: 'P26',  count: 2,  printfulCandidate: null,  notes: 'TBD' },
  { bp: 731,  name: 'Organic Tote Bag (EarthAware)',                       provider: 'P26',  count: 4,  printfulCandidate: 73,   notes: '' },
  { bp: 1018, name: 'Ceramic Mug 11oz',                                    provider: 'P26',  count: 5,  printfulCandidate: 19,   notes: 'WARNING: Printful may have only 2 colors (White, Black)' },
  { bp: 1025, name: 'Baby Bodysuit Organic (Stanley/Stella)',               provider: 'P26',  count: 1,  printfulCandidate: null,  notes: 'TBD' },
  { bp: 1045, name: 'Baby Bodysuit Organic Alt (Stanley/Stella)',           provider: 'P26',  count: 1,  printfulCandidate: null,  notes: 'TBD' },
  { bp: 1462, name: 'Unisex Organic T-Shirt (Stanley/Stella Creator)',     provider: 'P26',  count: 1,  printfulCandidate: null,  notes: 'TBD' },

  // B.2 — Drinkware — P86 (T-Shirt and Sons, Poland)
  { bp: 620,  name: 'Insulated Water Bottle 12oz',                         provider: 'P86',  count: 2,  printfulCandidate: null,  notes: 'TBD — search for Printful 12oz bottle' },
  { bp: 633,  name: 'Travel Mug 16oz',                                     provider: 'P86',  count: 2,  printfulCandidate: null,  notes: 'TBD — search for 16oz travel mug' },
  { bp: 966,  name: 'Insulated Tumbler 20oz',                              provider: 'P86',  count: 1,  printfulCandidate: 388,  notes: '' },

  // B.3 — Bottles + Stickers — P23 (Art Gun, EU)
  { bp: 854,  name: 'Insulated Bottle 12/18/32oz',                         provider: 'P23',  count: 2,  printfulCandidate: null,  notes: 'TBD — search Printful stainless bottle' },
  { bp: 1523, name: 'Sticker Round/Square',                                provider: 'P23',  count: 2,  printfulCandidate: 358,  notes: '' },

  // B.4 — Shoes + Desk Mat — P90 (Printy6, Czech Republic)
  { bp: 767,  name: 'Low Top Sneaker',                                     provider: 'P90',  count: 1,  printfulCandidate: null,  notes: 'CRITICAL — no direct Printful equivalent' },
  { bp: 1534, name: 'Kids Clogs',                                          provider: 'P90',  count: 1,  printfulCandidate: null,  notes: 'CRITICAL — niche product type' },
  { bp: 969,  name: 'Desk Mat',                                            provider: 'P90',  count: 1,  printfulCandidate: null,  notes: 'MEDIUM — search for Printful desk mat / mousepad' },

  // B.5 — Headwear + Embroidered Hoodie — P410 (Printful, Latvia) — ALREADY PRINTFUL
  { bp: 793,  name: 'Premium Embroidered Hoodie (Cotton Heritage M2580)',   provider: 'P410', count: 5,  printfulCandidate: null,  notes: 'Already Printful — search by model name' },
  { bp: 1691, name: 'Beanie (Cuffed)',                                     provider: 'P410', count: 1,  printfulCandidate: null,  notes: 'Already Printful — search by name' },
  { bp: 1729, name: 'Dad Hat (Unstructured)',                               provider: 'P410', count: 1,  printfulCandidate: null,  notes: 'Already Printful — search by name' },
  { bp: 1743, name: 'Snapback (Flat Brim)',                                provider: 'P410', count: 1,  printfulCandidate: null,  notes: 'Already Printful — search by name' },
  { bp: 1744, name: 'Trucker Cap',                                         provider: 'P410', count: 4,  printfulCandidate: null,  notes: 'Already Printful — search by name' },
  { bp: 1910, name: 'Bucket Hat (Embroidered)',                            provider: 'P410', count: 3,  printfulCandidate: null,  notes: 'Already Printful — search by name' },
  { bp: 1927, name: 'Insulated Tumbler 20oz',                              provider: 'P410', count: 1,  printfulCandidate: null,  notes: 'Already Printful via P410 — search by name' },
]

// ─── Keyword Search Map ─────────────────────────────────────────────────────────
// For blueprints without a printfulCandidate, we search the catalog by keywords.

const SEARCH_KEYWORDS = {
  65:   ['kids', 'sweatshirt', 'organic'],
  67:   ['baby', 'sweatshirt', 'organic', 'toddler'],
  157:  ['kids', 'tee', 'B&C'],
  454:  ['B&C', 'E190', 't-shirt'],
  455:  ['zip', 'hoodie'],
  457:  ['crewneck', 'sweatshirt', 'B&C'],
  620:  ['water', 'bottle', '12oz', 'insulated'],
  633:  ['travel', 'mug', '16oz'],
  854:  ['stainless', 'bottle', 'insulated'],
  767:  ['sneaker', 'shoe', 'canvas'],
  969:  ['desk', 'mat', 'mousepad'],
  1025: ['baby', 'bodysuit', 'organic'],
  1045: ['baby', 'bodysuit'],
  1462: ['organic', 't-shirt', 'Stanley', 'Stella'],
  1534: ['clogs', 'kids'],
  793:  ['hoodie', 'embroidered', 'Cotton Heritage', 'M2580'],
  1691: ['beanie', 'cuffed'],
  1729: ['dad', 'hat', 'unstructured'],
  1743: ['snapback', 'flat', 'cap'],
  1744: ['trucker', 'cap', 'foam'],
  1910: ['bucket', 'hat', 'embroidered'],
  1927: ['tumbler', 'insulated', '20oz'],
}

// ─── EU Availability Check ──────────────────────────────────────────────────────

function countEUVariants(variants) {
  if (!Array.isArray(variants)) return { total: 0, euCount: 0, sizes: [], colors: [] }

  const sizes = new Set()
  const colors = new Set()
  let euCount = 0

  for (const v of variants) {
    // Printful variants have an `availability_status` array or `availability_regions`
    // In practice, check if the variant has EU fulfillment
    const hasEU = (v.availability_status || []).some(
      (s) => (s.region === 'EU' || s.region === 'Europe') && s.status === 'in_stock'
    )
    // If no availability_status, check availability_regions
    const regionCheck = Array.isArray(v.availability_regions)
      ? v.availability_regions.some((r) => r === 'EU' || r === 'Europe')
      : false

    // Some Printful catalog endpoints just list all variants without region info.
    // If no region data, count all as potentially EU-available and flag for manual check.
    const isEU = hasEU || regionCheck || (!v.availability_status && !v.availability_regions)

    if (isEU) {
      euCount++
      if (v.size) sizes.add(v.size)
      if (v.color) colors.add(v.color)
    }
  }

  return {
    total: variants.length,
    euCount,
    sizes: [...sizes],
    colors: [...colors],
  }
}

// ─── Search Catalog for Keyword Match ───────────────────────────────────────────

let fullCatalog = null

async function getFullCatalog() {
  if (fullCatalog) return fullCatalog
  console.log('\n  Fetching full Printful catalog...')
  const result = await printfulFetch('/products')
  fullCatalog = result
  console.log(`  Catalog loaded: ${result.length} products\n`)
  return result
}

function searchCatalog(catalog, keywords) {
  const results = []

  for (const product of catalog) {
    const title = (product.title || product.model || '').toLowerCase()
    const type = (product.type || product.type_name || '').toLowerCase()
    const combined = `${title} ${type}`

    const matchCount = keywords.filter((kw) => combined.includes(kw.toLowerCase())).length
    if (matchCount > 0) {
      results.push({ ...product, matchScore: matchCount })
    }
  }

  // Sort by match score descending
  results.sort((a, b) => b.matchScore - a.matchScore)
  return results.slice(0, 5) // top 5 candidates
}

// ─── Main Audit ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70))
  console.log('  SKAPARA Migration — Script 1: Audit Printful Catalog')
  console.log('  Verifying Printful equivalents for 33 Printify blueprints')
  console.log('='.repeat(70))

  const catalogMap = {}
  const summary = { confirmed: 0, needsSearch: 0, noMatch: 0, total: BLUEPRINT_AUDIT.length }

  // Phase 1: Check blueprints with known Printful candidate IDs
  console.log('\n--- Phase 1: Verify known Printful catalog IDs ---\n')

  for (const item of BLUEPRINT_AUDIT) {
    if (item.printfulCandidate === null) continue

    console.log(`  BP${item.bp}: ${item.name} -> Printful #${item.printfulCandidate}`)

    try {
      await delay(DELAY_MS)
      const product = await printfulFetch(`/products/${item.printfulCandidate}`)

      // product may be { product: {...}, variants: [...] } or direct
      const productInfo = product.product || product
      const variants = product.variants || []

      const euData = countEUVariants(variants)

      catalogMap[String(item.bp)] = {
        printfulId: item.printfulCandidate,
        title: productInfo.title || productInfo.model || 'Unknown',
        euVariants: euData.euCount,
        totalVariants: euData.total,
        sizes: euData.sizes,
        colors: euData.colors,
        confirmed: euData.euCount > 0 || euData.total > 0,
        provider: item.provider,
        skaparaCount: item.count,
        notes: item.notes || '',
      }

      const status = catalogMap[String(item.bp)].confirmed ? 'CONFIRMED' : 'WARN: 0 EU variants'
      console.log(
        `    -> ${productInfo.title || '?'}: ${euData.euCount}/${euData.total} EU variants [${status}]`
      )
      summary.confirmed++
    } catch (err) {
      console.error(`    -> ERROR: ${err.message}`)
      catalogMap[String(item.bp)] = {
        printfulId: item.printfulCandidate,
        title: null,
        euVariants: 0,
        totalVariants: 0,
        sizes: [],
        colors: [],
        confirmed: false,
        provider: item.provider,
        skaparaCount: item.count,
        notes: `API error: ${err.message}`,
      }
      summary.noMatch++
    }
  }

  // Phase 2: Search for blueprints without a candidate
  console.log('\n--- Phase 2: Search catalog for unmatched blueprints ---\n')

  const catalog = await getFullCatalog()
  await delay(DELAY_MS)

  for (const item of BLUEPRINT_AUDIT) {
    if (item.printfulCandidate !== null) continue

    const bpKey = String(item.bp)
    const keywords = SEARCH_KEYWORDS[item.bp] || item.name.split(/\s+/).filter((w) => w.length > 2)

    console.log(`  BP${item.bp}: ${item.name} (${item.provider})`)
    console.log(`    Keywords: ${keywords.join(', ')}`)

    const candidates = searchCatalog(catalog, keywords)

    if (candidates.length > 0) {
      const best = candidates[0]
      console.log(`    Top match: #${best.id} "${best.title}" (score: ${best.matchScore})`)

      // Fetch variant details for the best candidate
      try {
        await delay(DELAY_MS)
        const product = await printfulFetch(`/products/${best.id}`)
        const variants = product.variants || []
        const euData = countEUVariants(variants)

        catalogMap[bpKey] = {
          printfulId: best.id,
          title: best.title || best.model || 'Unknown',
          euVariants: euData.euCount,
          totalVariants: euData.total,
          sizes: euData.sizes,
          colors: euData.colors,
          confirmed: false, // needs human review
          provider: item.provider,
          skaparaCount: item.count,
          notes: item.notes || '',
          searchCandidates: candidates.slice(0, 3).map((c) => ({
            id: c.id,
            title: c.title,
            matchScore: c.matchScore,
          })),
          needsReview: true,
        }

        console.log(`    -> ${euData.euCount}/${euData.total} EU variants [NEEDS REVIEW]`)
        summary.needsSearch++
      } catch (err) {
        console.error(`    -> Error fetching details: ${err.message}`)
        catalogMap[bpKey] = {
          printfulId: best.id,
          title: best.title,
          euVariants: 0,
          totalVariants: 0,
          sizes: [],
          colors: [],
          confirmed: false,
          provider: item.provider,
          skaparaCount: item.count,
          notes: `${item.notes || ''} | Fetch error: ${err.message}`,
          searchCandidates: candidates.slice(0, 3).map((c) => ({
            id: c.id,
            title: c.title,
            matchScore: c.matchScore,
          })),
          needsReview: true,
        }
        summary.needsSearch++
      }
    } else {
      console.log(`    -> NO MATCH FOUND`)
      catalogMap[bpKey] = {
        printfulId: null,
        title: null,
        euVariants: 0,
        totalVariants: 0,
        sizes: [],
        colors: [],
        confirmed: false,
        provider: item.provider,
        skaparaCount: item.count,
        notes: item.notes || 'No Printful equivalent found in catalog search',
        needsReview: true,
      }
      summary.noMatch++
    }
  }

  // ─── Write Output ───────────────────────────────────────────────────────────

  const outputPath = join(ROOT, 'scripts', 'printful-catalog-map.json')
  writeFileSync(outputPath, JSON.stringify(catalogMap, null, 2))
  console.log(`\nOutput written to: ${outputPath}`)

  // ─── Print Summary ──────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(70))
  console.log('  AUDIT SUMMARY')
  console.log('='.repeat(70))

  const colWidths = { bp: 6, name: 50, pf: 8, eu: 10, status: 15 }
  const header = [
    'BP'.padEnd(colWidths.bp),
    'Product Name'.padEnd(colWidths.name),
    'PF ID'.padEnd(colWidths.pf),
    'EU Vars'.padEnd(colWidths.eu),
    'Status'.padEnd(colWidths.status),
  ].join(' | ')
  console.log(`\n  ${header}`)
  console.log('  ' + '-'.repeat(header.length))

  for (const item of BLUEPRINT_AUDIT) {
    const entry = catalogMap[String(item.bp)]
    const status = entry.confirmed
      ? 'CONFIRMED'
      : entry.printfulId
        ? 'NEEDS REVIEW'
        : 'NO MATCH'

    const row = [
      String(item.bp).padEnd(colWidths.bp),
      item.name.slice(0, colWidths.name).padEnd(colWidths.name),
      String(entry.printfulId || '-').padEnd(colWidths.pf),
      `${entry.euVariants}/${entry.totalVariants}`.padEnd(colWidths.eu),
      status.padEnd(colWidths.status),
    ].join(' | ')
    console.log(`  ${row}`)
  }

  console.log('\n  ' + '-'.repeat(60))
  console.log(`  Confirmed:    ${summary.confirmed}/${summary.total}`)
  console.log(`  Needs review: ${summary.needsSearch}/${summary.total}`)
  console.log(`  No match:     ${summary.noMatch}/${summary.total}`)
  console.log('  ' + '-'.repeat(60))

  // Identify blockers
  const blockers = BLUEPRINT_AUDIT.filter((item) => {
    const entry = catalogMap[String(item.bp)]
    return !entry.confirmed && !entry.printfulId
  })

  if (blockers.length > 0) {
    console.log('\n  BLOCKERS (no Printful candidate found):')
    for (const b of blockers) {
      console.log(`    - BP${b.bp}: ${b.name} (${b.provider}, ${b.count} products)`)
    }
  }

  const atRisk = BLUEPRINT_AUDIT.filter((item) => {
    const entry = catalogMap[String(item.bp)]
    return entry.printfulId && !entry.confirmed
  })

  if (atRisk.length > 0) {
    console.log('\n  AT RISK (candidate found, needs human review):')
    for (const r of atRisk) {
      const entry = catalogMap[String(r.bp)]
      console.log(`    - BP${r.bp}: ${r.name} -> PF#${entry.printfulId} (${entry.euVariants} EU vars)`)
    }
  }

  console.log('\n  Done.\n')
}

main().catch((e) => {
  console.error('\nFATAL:', e.message, e.stack)
  process.exit(1)
})
