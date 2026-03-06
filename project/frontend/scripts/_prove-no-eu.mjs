/**
 * PRUEBA: Muestra los perfiles de envío COMPLETOS
 * para cada BP/Provider de los 19 productos sin EU
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const EU = new Set(['ES','DE','FR','IT','NL','PL','GB','AT','BE','PT','IE','SE','DK','FI','CZ','GR','HU','RO','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY'])

// Los 6 combos únicos de los 19 productos sin EU
const COMBOS = [
  { bp: 1910, prov: 99, label: 'Embroidered Bucket Hat (GPU)' },
  { bp: 1744, prov: 99, label: 'Embroidered Caps (Friday Deploy, AI Wrote This, Prompt Me, Nova)' },
  { bp: 1691, prov: 99, label: 'Embroidered Beanies (It Works, Dark Mode, Vibe Coded, Facet)' },
  { bp: 77,   prov: 217, label: 'Pullover Hoodie (Night Shift)' },
  { bp: 879,  prov: 217, label: 'Long Sleeve (Ship Fast, Refactor Mode, Two Hours)' },
  { bp: 49,   prov: 34,  label: 'Heavy Crewneck (Dev Mode)' },
  { bp: 6,    prov: 103, label: 'Unisex Tee (Prompt Life, Zero Bugs, Vibe Coder, Absolutely Right)' },
]

async function main() {
  console.log('═'.repeat(80))
  console.log('  PRUEBA DE ENVÍO EU — Datos crudos de Printify Shipping API')
  console.log('═'.repeat(80))

  for (const combo of COMBOS) {
    await delay(400)
    console.log(`\n  ▸ BP${combo.bp} / Provider ${combo.prov}`)
    console.log(`    Productos: ${combo.label}`)

    // Get provider name
    await delay(300)
    const provR = await fetch(`${API}/catalog/blueprints/${combo.bp}/print_providers/${combo.prov}.json`, { headers: hdrs })
    const provData = provR.ok ? await provR.json() : null
    console.log(`    Proveedor: ${provData?.title || '??'}`)

    const r = await fetch(`${API}/catalog/blueprints/${combo.bp}/print_providers/${combo.prov}/shipping.json`, { headers: hdrs })
    
    if (!r.ok) {
      console.log(`    ❌ API error: HTTP ${r.status}`)
      continue
    }

    const data = await r.json()
    const profiles = data.profiles || []
    console.log(`    Handling time: ${data.handling_time?.min || '?'}-${data.handling_time?.max || '?'} business days`)
    console.log(`    Shipping profiles: ${profiles.length}`)

    let anyEU = false
    for (const [idx, profile] of profiles.entries()) {
      const countries = profile.countries || []
      const euCountries = countries.filter(c => EU.has(c))
      const hasROW = countries.includes('REST_OF_THE_WORLD') || countries.includes('REST_OF_WORLD')
      const cost1 = profile.first_item?.cost != null ? '$' + (profile.first_item.cost / 100).toFixed(2) : '?'
      const cost2 = profile.additional_items?.cost != null ? '$' + (profile.additional_items.cost / 100).toFixed(2) : '?'

      if (euCountries.length > 0) anyEU = true

      console.log(`\n      Profile ${idx + 1}: [${cost1} first / ${cost2} additional]`)
      console.log(`        Countries (${countries.length}): ${countries.join(', ')}`)
      if (euCountries.length > 0) {
        console.log(`        ✅ EU COUNTRIES FOUND: ${euCountries.join(', ')}`)
      }
      if (hasROW) {
        console.log(`        ⚠ Has REST_OF_THE_WORLD (NO garantiza EU)`)
      }
    }

    console.log(`\n    ═══ VEREDICTO: ${anyEU ? '✅ SÍ ENVÍA A EU' : '❌ NO ENVÍA A EU — Ningún país EU en ningún perfil'} ═══`)
  }

  // Comparación: mostrar un combo que SÍ tiene EU (P26, Textildruck)
  console.log('\n\n  ── CONTROL: BP457/P26 (Textildruck Europa) — uno que SÍ tiene EU ──')
  await delay(400)
  const ctrlR = await fetch(`${API}/catalog/blueprints/457/print_providers/26/shipping.json`, { headers: hdrs })
  const ctrlData = await ctrlR.json()
  for (const profile of (ctrlData.profiles || [])) {
    const countries = profile.countries || []
    const euCountries = countries.filter(c => EU.has(c))
    const cost1 = profile.first_item?.cost != null ? '$' + (profile.first_item.cost / 100).toFixed(2) : '?'
    if (euCountries.length > 0) {
      console.log(`    Profile [${cost1}]: ${euCountries.length} EU countries: ${euCountries.join(', ')}`)
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
