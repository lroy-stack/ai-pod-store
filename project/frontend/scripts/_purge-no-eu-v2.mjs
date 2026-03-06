/**
 * PURGE v2: Elimina los 19 productos sin EU shipping
 * Usa printify_id directo — no depende de títulos
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
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

const EU = new Set(['ES','DE','FR','IT','NL','PL','GB','AT','BE','PT','IE','SE','DK','FI','CZ','GR','HU','RO','BG','HR','SK','SI','LT','LV','EE','LU','MT','CY'])

async function main() {
  // 1. Get ALL Printify products
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

  // 2. Check EU for each, collect the ones to delete
  const euCache = new Map()
  const toDelete = []

  for (const pp of allPP) {
    const key = `${pp.blueprint_id}:${pp.print_provider_id}`
    if (!euCache.has(key)) {
      await delay(350)
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
    if (!euCache.get(key)) {
      toDelete.push({ id: String(pp.id), title: pp.title, bp: pp.blueprint_id, prov: pp.print_provider_id })
    }
  }

  console.log('═'.repeat(70))
  console.log(`  PURGE v2 — Eliminando ${toDelete.length} productos sin EU`)
  console.log('═'.repeat(70))

  let deleted = 0, failed = 0

  for (const [idx, target] of toDelete.entries()) {
    const label = `[${idx + 1}/${toDelete.length}]`
    process.stdout.write(`  ${label} ${target.title.substring(0, 45).padEnd(45)}`)

    // 1. Unpublish
    try {
      await fetch(`${API}/shops/${SHOP}/products/${target.id}/unpublish.json`, {
        method: 'POST', headers: hdrs, body: JSON.stringify({})
      })
    } catch {}
    await delay(500)

    // 2. Delete from Printify
    try {
      const r = await fetch(`${API}/shops/${SHOP}/products/${target.id}.json`, {
        method: 'DELETE', headers: hdrs
      })
      if (r.ok || r.status === 404) {
        // 3. Soft-delete in Supabase (find by printify_id)
        const { data: sbMatch } = await sb.from('products')
          .select('id')
          .eq('printify_id', target.id)
          .neq('status', 'deleted')
          .limit(1)

        if (sbMatch && sbMatch.length > 0) {
          // Clean up related tables first
          await sb.from('product_variants').delete().eq('product_id', sbMatch[0].id)
          await sb.from('wishlist_items').delete().eq('product_id', sbMatch[0].id)
          await sb.from('cart_items').delete().eq('product_id', sbMatch[0].id)
          const { error } = await sb.from('products').update({
            status: 'deleted',
            deleted_at: new Date().toISOString(),
          }).eq('id', sbMatch[0].id)

          if (error) {
            console.log(` ❌ SB: ${error.message}`)
            failed++
          } else {
            console.log(' ✓ DELETED')
            deleted++
          }
        } else {
          console.log(' ✓ PRINTIFY OK (no SB record)')
          deleted++
        }
      } else {
        const body = await r.text()
        console.log(` ❌ Printify ${r.status}: ${body.substring(0, 80)}`)
        failed++
      }
    } catch (e) {
      console.log(` ❌ ${e.message}`)
      failed++
    }
    await delay(800)
  }

  // Verify final state
  const ppAfter = []
  page = 1
  while (true) {
    const r = await fetch(`${API}/shops/${SHOP}/products.json?page=${page}&limit=50`, { headers: hdrs })
    const data = await r.json()
    if (!data.data || data.data.length === 0) break
    ppAfter.push(...data.data)
    if (page >= (data.last_page || 1)) break
    page++
  }
  const { count: sbCount } = await sb.from('products')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'deleted')

  console.log('\n' + '═'.repeat(70))
  console.log('  PURGE v2 COMPLETE')
  console.log(`    Eliminados:  ${deleted}`)
  console.log(`    Fallidos:    ${failed}`)
  console.log(`    Printify restante:  ${ppAfter.length}`)
  console.log(`    Supabase activos:   ${sbCount}`)
  console.log('═'.repeat(70))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
