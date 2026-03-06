/**
 * Estado REAL: Printify (fuente de verdad) vs Supabase
 * Sin suposiciones — lee directamente de ambas APIs
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

const EU = new Set(['ES','DE','FR','IT','NL','PL','GB','AT','BE','PT','IE','SE','DK','FI','CZ','GR','HU','RO','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY'])

async function main() {
  // 1. Printify — ALL products
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

  // 2. Supabase — ALL non-deleted
  const { data: sbProds } = await sb.from('products')
    .select('id, title, printify_id, status, blueprint_id, print_provider_id, category_id')
    .neq('status', 'deleted')

  // 3. Categories
  const { data: cats } = await sb.from('categories').select('id, slug, name_en')
  const catMap = new Map(cats.map(c => [c.id, c]))

  console.log('═'.repeat(80))
  console.log(`  ESTADO REAL — ${new Date().toISOString()}`)
  console.log(`  Printify: ${allPP.length} productos | Supabase activos: ${sbProds.length}`)
  console.log('═'.repeat(80))

  // 4. Check EU for each unique BP/Provider
  const euCache = new Map()
  const noEU = []
  const withEU = []

  for (const [i, pp] of allPP.entries()) {
    const key = `${pp.blueprint_id}:${pp.print_provider_id}`
    if (!euCache.has(key)) {
      await delay(350)
      try {
        const r = await fetch(`${API}/catalog/blueprints/${pp.blueprint_id}/print_providers/${pp.print_provider_id}/shipping.json`, { headers: hdrs })
        if (r.ok) {
          const data = await r.json()
          let euCountries = []
          for (const profile of (data.profiles || [])) {
            euCountries.push(...(profile.countries || []).filter(c => EU.has(c)))
          }
          euCache.set(key, { hasEU: euCountries.length > 0, countries: [...new Set(euCountries)] })
        } else {
          euCache.set(key, { hasEU: false, countries: [] })
        }
      } catch {
        euCache.set(key, { hasEU: false, countries: [] })
      }
    }

    const eu = euCache.get(key)
    const sbMatch = sbProds.find(s => s.printify_id === String(pp.id))
    const cat = sbMatch?.category_id ? catMap.get(sbMatch.category_id) : null
    const variants = pp.variants?.length || 0
    const enabledVariants = pp.variants?.filter(v => v.is_enabled)?.length || 0

    const row = {
      title: pp.title,
      printify_id: String(pp.id),
      bp: pp.blueprint_id,
      prov: pp.print_provider_id,
      eu: eu.hasEU,
      euCountries: eu.countries.length,
      variants,
      enabledVariants,
      category: cat?.slug || '??',
      inSupabase: !!sbMatch,
      sbStatus: sbMatch?.status || 'MISSING',
    }

    if (eu.hasEU) withEU.push(row)
    else noEU.push(row)
  }

  // Print EU OK
  console.log(`\n  ✅ CON ENVIO EU: ${withEU.length} productos`)
  console.log('  ' + '─'.repeat(76))
  for (const p of withEU) {
    console.log(`    ${p.title}`)
    console.log(`      BP${p.bp}/P${p.prov} | EU: ${p.euCountries} paises | Variants: ${p.enabledVariants}/${p.variants} | Cat: ${p.category} | SB: ${p.sbStatus}`)
  }

  // Print NO EU
  console.log(`\n  ❌ SIN ENVIO EU: ${noEU.length} productos`)
  console.log('  ' + '─'.repeat(76))
  for (const p of noEU) {
    console.log(`    ${p.title}`)
    console.log(`      BP${p.bp}/P${p.prov} | Variants: ${p.enabledVariants}/${p.variants} | Cat: ${p.category} | SB: ${p.sbStatus}`)
  }

  // Orphans check
  const ppIds = new Set(allPP.map(p => String(p.id)))
  const orphans = sbProds.filter(s => !ppIds.has(s.printify_id))
  if (orphans.length > 0) {
    console.log(`\n  ⚠ HUERFANOS EN SUPABASE (no existen en Printify): ${orphans.length}`)
    for (const o of orphans) {
      console.log(`    ${o.title} (printify_id: ${o.printify_id})`)
    }
  }

  console.log('\n' + '═'.repeat(80))
  console.log(`  RESUMEN:`)
  console.log(`    Total Printify:    ${allPP.length}`)
  console.log(`    Con EU:            ${withEU.length}`)
  console.log(`    Sin EU:            ${noEU.length}`)
  console.log(`    Supabase activos:  ${sbProds.length}`)
  console.log(`    Huerfanos SB:      ${orphans.length}`)
  console.log('═'.repeat(80))
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
