/**
 * Cross-reference our products' BP/Provider combos against
 * the cached EU catalog audit AND live Printify shipping API.
 * Shows the FULL shipping profile for each combo.
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

const EU = new Set([
  'ES','DE','FR','IT','NL','PL','GB','AT','BE','PT','IE','SE','DK','FI',
  'CZ','GR','HU','RO','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY'
])

async function main() {
  // Get all Printify products
  const allPP = []
  let page = 1
  while (true) {
    const r = await fetch(`${API}/shops/${SHOP}/products.json?page=${page}&limit=50`, { headers: hdrs })
    const data = await r.json()
    if (!data.data || data.data.length === 0) break
    allPP.push(...data.data)
    if (page >= (data.last_page || 1)) break
    page++
  }

  // Unique BP/Provider combos
  const combos = new Map()
  for (const p of allPP) {
    const key = `${p.blueprint_id}:${p.print_provider_id}`
    if (!combos.has(key)) combos.set(key, [])
    combos.get(key).push(p.title)
  }

  console.log('═'.repeat(70))
  console.log(`  EU SHIPPING DEEP VERIFICATION — ${combos.size} unique BP/Provider combos`)
  console.log('═'.repeat(70))

  for (const [combo, titles] of combos) {
    const [bpId, provId] = combo.split(':')
    console.log(`\n  BP ${bpId} / Provider ${provId} (${titles.length} products)`)
    console.log(`    Products: ${titles.join(', ')}`)

    await delay(400)
    const r = await fetch(`${API}/catalog/blueprints/${bpId}/print_providers/${provId}/shipping.json`, { headers: hdrs })

    if (!r.ok) {
      console.log(`    ❌ API returned ${r.status}`)
      continue
    }

    const data = await r.json()
    const profiles = data.profiles || []
    const handling = data.handling_time || {}

    console.log(`    Handling time: ${handling.min || '?'}-${handling.max || '?'} business days`)
    console.log(`    Profiles: ${profiles.length}`)

    let hasDirectEU = false
    let hasROW = false

    for (const profile of profiles) {
      const countries = profile.countries || []
      const directEU = countries.filter(c => EU.has(c))
      const isROW = countries.includes('REST_OF_WORLD')
      const cost1 = profile.first_item?.cost ? '$' + (profile.first_item.cost / 100).toFixed(2) : '?'
      const cost2 = profile.additional_items?.cost ? '$' + (profile.additional_items.cost / 100).toFixed(2) : '?'

      if (directEU.length > 0) hasDirectEU = true
      if (isROW) hasROW = true

      // Show all profiles
      const countryList = countries.length > 10
        ? countries.slice(0, 10).join(',') + `... (+${countries.length - 10})`
        : countries.join(',')
      const euMark = directEU.length > 0 ? ` ✓ EU(${directEU.length} countries)` : isROW ? ' ✓ REST_OF_WORLD' : ''
      console.log(`      [${cost1} / ${cost2}] ${countryList}${euMark}`)
    }

    const verdict = hasDirectEU ? '✅ EU DIRECT' : hasROW ? '✅ EU via REST_OF_WORLD' : '❌ NO EU'
    console.log(`    → VERDICT: ${verdict}`)
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
