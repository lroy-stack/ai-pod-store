/**
 * Get base variant costs by creating temporary product drafts
 * Uses the Printify pricing API endpoint
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

// BPs we need costs for (no product in store yet)
const NEED_COSTS = [
  { bp: 6, prov: 26, label: 'Gildan 5000 Tee / Textildruck' },
  { bp: 12, prov: 26, label: 'Bella+Canvas 3001 / Textildruck' },
  { bp: 145, prov: 26, label: 'Gildan Softstyle / Textildruck' },
  { bp: 454, prov: 26, label: 'B&C Men Tee / Textildruck' },
  { bp: 1462, prov: 26, label: 'Stanley Stella Creator / Textildruck' },
  { bp: 77, prov: 26, label: 'Gildan 18500 Hoodie / Textildruck' },
  { bp: 458, prov: 26, label: 'B&C WUI24 Hoodie / Textildruck' },
  { bp: 92, prov: 26, label: 'AWDIS JH001 Hoodie / Textildruck' },
  { bp: 49, prov: 26, label: 'Gildan 18000 Crewneck / Textildruck' },
  { bp: 80, prov: 26, label: 'Gildan 2400 LS / Textildruck' },
  { bp: 6, prov: 410, label: 'Gildan 5000 Tee / Printful' },
  { bp: 77, prov: 410, label: 'Gildan 18500 Hoodie / Printful' },
  { bp: 1744, prov: 410, label: 'Structured Cap / Printful' },
  { bp: 1691, prov: 410, label: 'Cuffed Beanie / Printful' },
  { bp: 1743, prov: 410, label: 'Snapback Trucker / Printful' },
  { bp: 1729, prov: 410, label: 'Dad Hat / Printful' },
  { bp: 1755, prov: 410, label: 'Flat Bill Snapback / Printful' },
  { bp: 1016, prov: 26, label: 'Standard Mug 11oz / Textildruck' },
  { bp: 442, prov: 30, label: 'Mouse Pad / OPT OnDemand' },
  { bp: 476, prov: 30, label: 'Square Vinyl Sticker / OPT OnDemand' },
  { bp: 1216, prov: 255, label: 'Kiss-Cut Sticker / Sticky Products' },
  { bp: 1927, prov: 410, label: 'SS Tumbler 20oz / Printful' },
  { bp: 966, prov: 86, label: 'Vagabond 20oz / Chill' },
  { bp: 1470, prov: 90, label: 'EVA Foam Shoes / Smart Printee' },
]

async function main() {
  console.log('═'.repeat(80))
  console.log('  BASE COSTS — Obteniendo precios reales de Printify')
  console.log('═'.repeat(80))

  for (const item of NEED_COSTS) {
    await delay(400)
    
    // Get variants first
    const varR = await fetch(`${API}/catalog/blueprints/${item.bp}/print_providers/${item.prov}/variants.json`, { headers: hdrs })
    const varData = varR.ok ? await varR.json() : {}
    const variants = varData.variants || []
    
    if (variants.length === 0) {
      console.log(`  BP${item.bp}/P${item.prov} ${item.label}: NO VARIANTS`)
      continue
    }

    // Create a minimal draft product to get costs
    const variantIds = variants.slice(0, 3).map(v => v.id)
    const printAreas = []
    const firstVariant = variants[0]
    if (firstVariant.placeholders?.length > 0) {
      const ph = firstVariant.placeholders[0]
      printAreas.push({
        variant_ids: variantIds,
        placeholders: [{
          position: ph.position,
          images: [{ id: "67c140af86d4a6c74f0d2d66", x: 0, y: 0, scale: 1, angle: 0 }]
        }]
      })
    }

    await delay(400)
    const createR = await fetch(`${API}/shops/${SHOP}/products.json`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({
        title: `__COST_CHECK_${item.bp}_${item.prov}`,
        blueprint_id: item.bp,
        print_provider_id: item.prov,
        variants: variantIds.map(id => ({ id, price: 2999, is_enabled: true })),
        print_areas: printAreas,
      })
    })

    if (!createR.ok) {
      const errText = await createR.text()
      console.log(`  BP${item.bp}/P${item.prov} ${item.label}: CREATE FAILED ${createR.status} — ${errText.substring(0, 100)}`)
      continue
    }

    const product = await createR.json()
    const costs = (product.variants || []).map(v => v.cost).filter(c => c > 0)
    const minCost = costs.length > 0 ? Math.min(...costs) / 100 : null
    const maxCost = costs.length > 0 ? Math.max(...costs) / 100 : null

    console.log(`  BP${item.bp}/P${item.prov} ${item.label.padEnd(45)} $${minCost?.toFixed(2) || '??'} - $${maxCost?.toFixed(2) || '??'}`)

    // Delete the draft immediately
    await delay(300)
    await fetch(`${API}/shops/${SHOP}/products/${product.id}.json`, { method: 'DELETE', headers: hdrs })
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
