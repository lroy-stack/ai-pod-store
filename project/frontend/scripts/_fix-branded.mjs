/**
 * Fix branded products: delete duplicate, harvest mockups
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  // 1. Delete the duplicate mug (old run, bad parsing)
  const { data: dupes } = await sb.from('products')
    .select('id, printify_id')
    .eq('printify_id', '69a2d8b61ec5ca402c032b46')

  for (const d of (dupes || [])) {
    await sb.from('product_variants').delete().eq('product_id', d.id)
    await sb.from('products').delete().eq('id', d.id)
    console.log('Deleted duplicate mug:', d.id)
  }

  // 2. Harvest mockup images from Printify for all SKAPARA products
  const { data: prods } = await sb.from('products')
    .select('id, title, printify_id')
    .ilike('title', '%SKAPARA%')

  for (const p of (prods || [])) {
    await delay(500)
    try {
      const r = await fetch(
        `https://api.printify.com/v1/shops/${SHOP}/products/${p.printify_id}.json`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      )
      if (r.status !== 200) {
        console.log(`  ${p.title} — Printify HTTP ${r.status}`)
        continue
      }
      const details = await r.json()
      const imgs = (details.images || [])
        .filter(i => i.src && !i.src.includes('size-chart'))
        .slice(0, 8)
        .map(i => i.src)

      if (imgs.length > 0) {
        await sb.from('products').update({ images: imgs }).eq('id', p.id)
        console.log(`${p.title} — ${imgs.length} mockups saved`)
      } else {
        console.log(`${p.title} — NO mockups yet`)
      }
    } catch (e) {
      console.log(`${p.title} — ERROR: ${e.message}`)
    }
  }

  console.log('\nDone.')
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
