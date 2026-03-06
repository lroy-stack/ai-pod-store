/**
 * DUAL AUDIT:
 * 1. Products with third-party logos (ChatGPT, Claude, Cursor, OpenAI, Anthropic)
 * 2. Products that can't ship to EU
 *
 * Checks actual Printify blueprint+provider shipping data.
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

const EU_COUNTRIES = new Set([
  'ES','DE','FR','IT','NL','PL','GB','AT','BE','PT','IE','SE','DK','FI',
  'CZ','GR','HU','RO','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY'
])

// Known brand logos/references to check in product creation scripts
const BRAND_KEYWORDS = ['claude', 'chatgpt', 'openai', 'anthropic', 'cursor', 'gpt-4', 'gpt4', 'nvidia']

async function checkEUShipping(bpId, provId) {
  const r = await fetch(`${API}/catalog/blueprints/${bpId}/print_providers/${provId}/shipping.json`, { headers: hdrs })
  if (!r.ok) return { hasEU: false, method: 'api_error' }
  const data = await r.json()
  if (!data.profiles) return { hasEU: false, method: 'no_profiles' }

  for (const profile of data.profiles) {
    const countries = profile.countries || []
    if (countries.some(c => EU_COUNTRIES.has(c))) return { hasEU: true, method: 'direct' }
    if (countries.includes('REST_OF_WORLD')) return { hasEU: true, method: 'REST_OF_WORLD' }
  }
  return { hasEU: false, method: 'no_eu_country' }
}

async function main() {
  console.log('═'.repeat(70))
  console.log('  DUAL AUDIT: Third-Party Logos + EU Shipping')
  console.log('═'.repeat(70))

  // Get all active products from Printify with full details
  const allPP = []
  let page = 1
  while (true) {
    const r = await fetch(`${API}/shops/${SHOP}/products.json?page=${page}&limit=50`, { headers: hdrs })
    const data = await r.json()
    if (!data.data || data.data.length === 0) break
    allPP.push(...data.data)
    if (page >= (data.last_page || 1)) break
    page++
    await delay(500)
  }
  console.log(`  Printify: ${allPP.length} products\n`)

  // Get Supabase products for cross-reference
  const { data: sbProds } = await sb.from('products')
    .select('id, title, printify_id, status, blueprint_id, print_provider_id')
    .neq('status', 'deleted')
  const sbMap = new Map()
  for (const p of sbProds) sbMap.set(p.printify_id, p)

  const noEU = []
  const hasLogos = []
  const euCache = new Map() // bp:prov → result

  for (const [idx, pp] of allPP.entries()) {
    const pid = String(pp.id)
    const title = String(pp.title || '')
    const bpId = pp.blueprint_id
    const provId = pp.print_provider_id
    const sb = sbMap.get(pid)
    const label = `[${idx + 1}/${allPP.length}]`

    process.stdout.write(`  ${label} ${title.substring(0, 45).padEnd(45)}`)

    // ── 1. Check for brand logos in title, description, tags ──
    const searchText = [
      title,
      String(pp.description || ''),
      ...(Array.isArray(pp.tags) ? pp.tags : []),
    ].join(' ').toLowerCase()

    const foundBrands = BRAND_KEYWORDS.filter(k => searchText.includes(k))
    if (foundBrands.length > 0) {
      hasLogos.push({
        title,
        printify_id: pid,
        blueprint_id: bpId,
        provider_id: provId,
        brands: foundBrands,
        sb_id: sb?.id,
      })
    }

    // ── 2. Check EU shipping ──
    if (bpId && provId) {
      const cacheKey = `${bpId}:${provId}`
      let eu = euCache.get(cacheKey)
      if (!eu) {
        await delay(300)
        eu = await checkEUShipping(bpId, provId)
        euCache.set(cacheKey, eu)
      }

      if (!eu.hasEU) {
        noEU.push({
          title,
          printify_id: pid,
          blueprint_id: bpId,
          provider_id: provId,
          sb_id: sb?.id,
        })
      }

      const euTag = eu.hasEU ? `EU:${eu.method}` : '❌ NO EU'
      const logoTag = foundBrands.length > 0 ? ` | 🏷 ${foundBrands.join(',')}` : ''
      console.log(` BP${bpId}/P${provId} ${euTag}${logoTag}`)
    } else {
      console.log(` ⚠ NO BP/PROV`)
    }
  }

  // ─── REPORT ──────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('  RESULTS')
  console.log('═'.repeat(70))

  console.log(`\n  🏷 THIRD-PARTY LOGOS: ${hasLogos.length} products`)
  console.log('  ' + '─'.repeat(66))
  for (const p of hasLogos) {
    console.log(`    ${p.title}`)
    console.log(`      Brands: ${p.brands.join(', ')} | BP ${p.blueprint_id} / P ${p.provider_id}`)
  }

  console.log(`\n  ❌ NO EU SHIPPING: ${noEU.length} products`)
  console.log('  ' + '─'.repeat(66))
  for (const p of noEU) {
    console.log(`    ${p.title}`)
    console.log(`      BP ${p.blueprint_id} / P ${p.provider_id}`)
  }

  console.log('\n' + '═'.repeat(70))
  console.log(`  ACTION ITEMS:`)
  console.log(`    Products needing logo removal: ${hasLogos.length}`)
  console.log(`    Products needing EU removal:   ${noEU.length}`)
  console.log(`    Overlap (both issues):         ${hasLogos.filter(l => noEU.some(e => e.printify_id === l.printify_id)).length}`)
  console.log('═'.repeat(70))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
