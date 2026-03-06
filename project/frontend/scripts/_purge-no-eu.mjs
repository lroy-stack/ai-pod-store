/**
 * PURGE: Delete all 35 products without EU shipping
 * Deletes from Printify first, then soft-deletes in Supabase
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

// All 35 Printify IDs without EU shipping (verified from shipping profiles)
const TO_DELETE = [
  // BP794/P73 — Sticker
  { title: 'SKAPARA Pack — Sticker' },
  // BP879/P217 — Long Sleeves
  { title: 'SKAPARA Edge — Long Sleeve' },
  { title: 'Ship Fast — Long Sleeve Crewneck' },
  { title: 'Refactor Mode — Long Sleeve Crewneck' },
  { title: 'Two Hours — Long Sleeve Crewneck' },
  // BP6/P103 — Tees
  { title: 'GPU — Premium Cotton Tee' },
  { title: 'Prompt Life — Unisex Tee' },
  { title: 'Zero Bugs — Unisex Tee' },
  { title: 'Vibe Coder — Unisex Tee' },
  { title: 'Absolutely Right — Unisex Tee' },
  { title: 'Prism Tee' },
  { title: 'Ghost Tee' },
  { title: 'Shadow Tee' },
  // BP1910/P99 — Bucket Hat
  { title: 'GPU — Embroidered Bucket Hat' },
  // BP1744/P99 — Caps
  { title: 'Friday Deploy — Embroidered Cap' },
  { title: 'AI Wrote This — Embroidered Cap' },
  { title: 'Prompt Me — Embroidered Cap' }, // There are 2 with this name
  { title: 'Nova — Embroidered Cap' },
  // BP1691/P99 — Beanies
  { title: 'It Works — Embroidered Beanie' },
  { title: 'Dark Mode — Embroidered Beanie' },
  { title: 'Vibe Coded — Embroidered Beanie' },
  { title: 'Facet — Embroidered Beanie' },
  // BP77/P217 — Pullover Hoodie
  { title: 'Night Shift — Pullover Hoodie' },
  // BP49/P34 — Crewneck
  { title: 'Dev Mode — Heavy Crewneck Sweatshirt' },
  // Drinkware
  { title: 'Ocean Tumbler' },
  { title: 'Prism Tumbler' },
  { title: 'Neon Bottle' },
  // BP1108/P99 — Baseball Cap
  { title: 'Summit Club' },
  // BP1446/P217 — Snapbacks
  { title: 'Neon Dusk' },
  { title: 'Grind Mode' },
  { title: 'Wave Rider' },
  // BP1447/P217 — Dad Hats
  { title: 'Peak Wild' },
  { title: 'Sunset Glow' },
  // BP5/P99 — E2E test
  { title: '[E2E] Botanical Serenity T-Shirt Forest Green' },
]

async function main() {
  console.log('═'.repeat(70))
  console.log(`  PURGE — Deleting ${TO_DELETE.length} products without EU shipping`)
  console.log('═'.repeat(70))

  // Get all Supabase products to match by title
  const { data: sbProds } = await sb.from('products')
    .select('id, title, printify_id, status')
    .neq('status', 'deleted')

  let deleted = 0, failed = 0, skipped = 0

  for (const [idx, target] of TO_DELETE.entries()) {
    const label = `[${idx + 1}/${TO_DELETE.length}]`
    // Find ALL matching products (there can be duplicates like "Prompt Me")
    const matches = sbProds.filter(p => p.title === target.title)

    if (matches.length === 0) {
      console.log(`  ${label} ⚠ NOT FOUND: ${target.title}`)
      skipped++
      continue
    }

    for (const match of matches) {
      process.stdout.write(`  ${label} ${match.title.substring(0, 50).padEnd(50)}`)

      // 1. Unpublish from Printify first
      try {
        await fetch(`${API}/shops/${SHOP}/products/${match.printify_id}/unpublish.json`, {
          method: 'POST', headers: hdrs, body: JSON.stringify({})
        })
      } catch {}

      await delay(500)

      // 2. Delete from Printify
      try {
        const r = await fetch(`${API}/shops/${SHOP}/products/${match.printify_id}.json`, {
          method: 'DELETE', headers: hdrs
        })
        if (r.ok || r.status === 404) {
          // 3. Soft-delete in Supabase
          await sb.from('product_variants').delete().eq('product_id', match.id)
          await sb.from('wishlist_items').delete().eq('product_id', match.id)
          await sb.from('cart_items').delete().eq('product_id', match.id)
          const { error } = await sb.from('products').update({
            status: 'deleted',
            deleted_at: new Date().toISOString(),
          }).eq('id', match.id)

          if (error) {
            console.log(` ❌ SB: ${error.message}`)
            failed++
          } else {
            console.log(' ✓ DELETED')
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
  }

  // Verify final count
  const { count } = await sb.from('products')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')

  console.log('\n' + '═'.repeat(70))
  console.log('  PURGE COMPLETE')
  console.log(`    Deleted:  ${deleted}`)
  console.log(`    Failed:   ${failed}`)
  console.log(`    Skipped:  ${skipped}`)
  console.log(`    Active products remaining: ${count}`)
  console.log('═'.repeat(70))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
