/**
 * Query real variant + placeholder data from Printify API for a given BP/Provider.
 * Usage: node scripts/_query-bp.mjs <blueprint_id> <provider_id>
 */
import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}` }

const [bp, prov] = process.argv.slice(2).map(Number)
if (!bp || !prov) { console.error('Usage: node _query-bp.mjs <bp> <prov>'); process.exit(1) }

async function fetchJSON(url) {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r.json()
}

async function main() {
  console.log(`\n=== BP${bp}/P${prov} — Real Data ===\n`)

  // 1. Variants
  const variants = await fetchJSON(`${API}/catalog/blueprints/${bp}/print_providers/${prov}/variants.json`)
  console.log(`VARIANTS (${variants.variants?.length || 0} total):`)

  // Group by color
  const byColor = {}
  for (const v of (variants.variants || [])) {
    const parts = (v.title || '').split(' / ').map(p => p.trim())
    const color = parts[0] || 'Unknown'
    const size = parts[1] || parts[0] || 'Unknown'
    if (!byColor[color]) byColor[color] = []
    byColor[color].push({ id: v.id, size, title: v.title })
  }

  for (const [color, sizes] of Object.entries(byColor)) {
    console.log(`  ${color}: ${sizes.map(s => `${s.size}(${s.id})`).join(', ')}`)
  }

  // 2. Placeholders
  const placeholders = await fetchJSON(`${API}/catalog/blueprints/${bp}/print_providers/${prov}/placeholders.json`)
  console.log(`\nPLACEHOLDERS (${placeholders.placeholders?.length || 0}):`)
  for (const p of (placeholders.placeholders || [])) {
    console.log(`  ${p.position}: ${p.width}x${p.height}`)
    if (p.images) {
      for (const img of p.images) {
        console.log(`    variant_ids count: ${img.variant_ids?.length || 0}`)
        console.log(`    first 3 variant_ids: ${(img.variant_ids || []).slice(0, 3).join(', ')}`)
      }
    }
  }

  // 3. Shipping (EU check)
  const shipping = await fetchJSON(`${API}/catalog/blueprints/${bp}/print_providers/${prov}/shipping.json`)
  const EU = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'])
  let euProfiles = []
  for (const profile of (shipping.profiles || shipping || [])) {
    const euCountries = (profile.countries || []).filter(c => EU.has(c))
    if (euCountries.length > 0) {
      euProfiles.push({
        name: profile.variant_ids ? `${profile.variant_ids.length} variants` : 'all',
        firstItem: profile.first_item,
        additionalItems: profile.additional_items,
        euCountries: euCountries.length,
      })
    }
  }
  console.log(`\nEU SHIPPING: ${euProfiles.length > 0 ? 'YES' : 'NO'}`)
  for (const p of euProfiles) {
    console.log(`  ${p.name}: first=$${(p.firstItem?.cost/100).toFixed(2)}, add=$${(p.additionalItems?.cost/100).toFixed(2)}, ${p.euCountries} EU countries`)
  }

  // 4. Summary: dark palette colors available
  const DARK_PALETTE = ['Black', 'Dark Heather', 'Navy', 'Charcoal']
  console.log(`\nDARK PALETTE FILTER:`)
  for (const target of DARK_PALETTE) {
    const match = Object.keys(byColor).find(c => c.toLowerCase() === target.toLowerCase())
    if (match) {
      console.log(`  ✓ ${match}: ${byColor[match].length} sizes — IDs: ${byColor[match].map(s => s.id).join(',')}`)
    } else {
      console.log(`  ✗ ${target}: NOT AVAILABLE`)
    }
  }

  // Print full JSON for reference
  console.log(`\n=== RAW VARIANT COUNT: ${variants.variants?.length} ===`)
  console.log(`=== RAW PLACEHOLDER COUNT: ${placeholders.placeholders?.length} ===`)
}

main().catch(e => console.error('FATAL:', e.message))
