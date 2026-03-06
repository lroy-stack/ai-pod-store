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

async function main() {
  // Get Printify products
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
  
  // Get Supabase active
  const { data: sbProds } = await sb.from('products')
    .select('id, title, printify_id, status, blueprint_id, print_provider_id, category_id')
    .neq('status', 'deleted')
  
  console.log(`Printify: ${allPP.length} products`)
  console.log(`Supabase active: ${sbProds.length} products\n`)
  
  // Check EU for each Printify product
  const euCache = new Map()
  for (const pp of allPP) {
    const key = `${pp.blueprint_id}:${pp.print_provider_id}`
    if (!euCache.has(key)) {
      await delay(300)
      const r = await fetch(`${API}/catalog/blueprints/${pp.blueprint_id}/print_providers/${pp.print_provider_id}/shipping.json`, { headers: hdrs })
      if (r.ok) {
        const data = await r.json()
        let hasEU = false
        for (const profile of (data.profiles || [])) {
          if ((profile.countries || []).some(c => EU.has(c))) { hasEU = true; break }
        }
        euCache.set(key, hasEU)
      } else {
        euCache.set(key, false)
      }
    }
    const hasEU = euCache.get(key)
    const sb = sbProds.find(s => s.printify_id === String(pp.id))
    console.log(`  ${hasEU ? '✅' : '❌'} BP${pp.blueprint_id}/P${pp.print_provider_id} ${pp.title.substring(0,50).padEnd(50)} ${sb ? 'SB:active' : 'SB:MISSING'}`)
  }
  
  // Check orphans in Supabase
  const ppIds = new Set(allPP.map(p => String(p.id)))
  const orphans = sbProds.filter(s => !ppIds.has(s.printify_id))
  if (orphans.length > 0) {
    console.log(`\n⚠ ${orphans.length} Supabase products NOT in Printify:`)
    for (const o of orphans) {
      console.log(`  ${o.title} (${o.printify_id})`)
    }
  }
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
