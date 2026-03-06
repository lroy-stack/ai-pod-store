import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  // Search for pullover hoodie BPs with EU DTG
  const hoodBPs = [475, 1195, 1188, 1205, 622, 1040, 630, 1169, 649, 77, 380]
  console.log('═══ Searching hoodie BPs with EU providers ═══\n')

  for (const bp of hoodBPs) {
    await delay(400)
    try {
      const r = await fetch(`${API}/catalog/blueprints/${bp}/print_providers.json`, { headers })
      const provs = await r.json()
      if (!Array.isArray(provs)) continue
      const eu = provs.filter(p => ['DE','NL','PL','GB','ES','FR'].includes((p.location?.country || '').toUpperCase()))
      if (eu.length > 0) {
        console.log(`BP ${bp}: ${eu.length} EU — ${eu.map(p => `${p.id}:${p.title}`).join(', ')}`)
      } else {
        console.log(`BP ${bp}: ${provs.length} provs, 0 EU`)
      }
    } catch(e) { console.log(`BP ${bp}: error`) }
  }

  // Check which BPs work with Textildruck Europa (26)
  console.log('\n═══ BPs with Textildruck Europa (26) ═══\n')
  for (const bp of [455, 457, 49, 475, 622, 630, 879]) {
    await delay(400)
    try {
      const r = await fetch(`${API}/catalog/blueprints/${bp}/print_providers.json`, { headers })
      const provs = await r.json()
      if (!Array.isArray(provs)) continue
      const has26 = provs.find(p => p.id === 26)
      if (has26) console.log(`  BP ${bp}: Textildruck ✓`)
      else console.log(`  BP ${bp}: no Textildruck`)
    } catch(e) {}
  }

  // Try Stacked Commerce (103) or Fulfill Engine (217) for hoodie BPs
  console.log('\n═══ Hoodie BPs with Stacked/Fulfill ═══\n')
  for (const bp of [77, 475, 622, 630, 380]) {
    await delay(400)
    try {
      const r = await fetch(`${API}/catalog/blueprints/${bp}/print_providers.json`, { headers })
      const provs = await r.json()
      if (!Array.isArray(provs)) continue
      const sc = provs.find(p => p.id === 103)
      const fe = provs.find(p => p.id === 217)
      if (sc) console.log(`  BP ${bp}: Stacked Commerce ✓`)
      if (fe) console.log(`  BP ${bp}: Fulfill Engine ✓`)
      if (!sc && !fe) console.log(`  BP ${bp}: neither`)
    } catch(e) {}
  }
}

main().catch(e => console.error(e.message))
