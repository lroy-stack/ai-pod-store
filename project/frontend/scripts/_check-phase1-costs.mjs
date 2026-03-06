import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'User-Agent': 'POD-AI-Store/1.0' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

// Target blueprints and our planned sell prices (in cents)
const targets = {
  6:    { name: 'T-Shirt',     sell: 2999 },
  77:   { name: 'Hoodie',      sell: 4999 },
  49:   { name: 'Crewneck',    sell: 4499 },
  80:   { name: 'Long Sleeve', sell: 3499 },
  1018: { name: 'Mug',         sell: 1699 },
  1744: { name: 'Cap',         sell: 2999 },
}

console.log('='.repeat(70))
console.log('  COST CHECK — Scanning existing shop products for base costs')
console.log('='.repeat(70) + '\n')

// Fetch all products (paginated)
const allProducts = []
let page = 1
while (true) {
  await delay(1500)
  const r = await fetch(`${API}/shops/${SHOP_ID}/products.json?limit=50&page=${page}`, { headers: hdrs })
  if (!r.ok) { console.log(`Page ${page}: ${r.status}`); break }
  const data = await r.json()
  const prods = data.data || []
  if (prods.length === 0) break
  allProducts.push(...prods)
  console.log(`  Fetched page ${page}: ${prods.length} products (total: ${allProducts.length})`)
  page++
  if (page > 10) break
}

console.log(`\n  Total products in shop: ${allProducts.length}\n`)

// Group by blueprint_id and extract costs
const costsByBP = {}
for (const p of allProducts) {
  const bp = p.blueprint_id
  if (!costsByBP[bp]) costsByBP[bp] = { costs: [], title: p.title }
  for (const v of (p.variants || [])) {
    if (v.cost && v.is_enabled) {
      costsByBP[bp].costs.push(v.cost)
    }
  }
}

console.log('  Blueprints found in shop:')
for (const [bp, data] of Object.entries(costsByBP).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const costs = data.costs
  if (costs.length === 0) { console.log(`    BP${bp}: ${data.title} — no enabled variants`); continue }
  const min = Math.min(...costs)
  const max = Math.max(...costs)
  console.log(`    BP${bp}: ${data.title} — cost ${min}-${max} cents (${costs.length} variants)`)
}

console.log('\n' + '='.repeat(70))
console.log('  MARGIN ANALYSIS for Phase 1 Products (target: ≥40%)')
console.log('='.repeat(70) + '\n')

for (const [bpId, target] of Object.entries(targets)) {
  const bp = Number(bpId)
  const data = costsByBP[bp]

  if (!data || data.costs.length === 0) {
    // No existing product with this BP — need to estimate
    console.log(`  ❓ ${target.name} (BP${bp}): No existing products found — cost unknown`)
    console.log(`     Sell: ${target.sell} cents (€${(target.sell/100).toFixed(2)})`)
    console.log(`     Need to create 1 test product to check cost\n`)
    continue
  }

  const maxCost = Math.max(...data.costs)
  const minCost = Math.min(...data.costs)
  const worstMargin = ((target.sell - maxCost) / target.sell * 100).toFixed(1)
  const bestMargin = ((target.sell - minCost) / target.sell * 100).toFixed(1)

  // Min price for 40% margin on most expensive variant
  const minPriceFor40 = Math.ceil(maxCost / 0.60)

  const ok = parseFloat(worstMargin) >= 40
  const status = ok ? '✅' : '⚠️'

  console.log(`  ${status} ${target.name} (BP${bp})`)
  console.log(`     Base cost: ${minCost}–${maxCost} cents`)
  console.log(`     Sell price: ${target.sell} cents (€${(target.sell/100).toFixed(2)})`)
  console.log(`     Margin: ${worstMargin}%–${bestMargin}%`)
  if (!ok) {
    console.log(`     ❌ WORST MARGIN ${worstMargin}% < 40%`)
    console.log(`     → Minimum sell price for 40%: ${minPriceFor40} cents (€${(minPriceFor40/100).toFixed(2)})`)
  }
  console.log('')
}
