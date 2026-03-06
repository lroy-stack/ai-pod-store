/**
 * Fix miscategorized products by checking their actual Printify blueprint
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

async function main() {
  // Get categories lookup
  const { data: cats } = await sb.from('categories').select('id, slug, name_en')
  const catBySlug = new Map()
  for (const c of cats) catBySlug.set(c.slug, c)

  // Get the "accessories" category ID
  const accCat = catBySlug.get('accessories')
  console.log('Accessories category ID:', accCat.id)

  // Get all products in "accessories"
  const { data: products } = await sb.from('products')
    .select('id, title, printify_id, category_id, blueprint_id')
    .eq('category_id', accCat.id)
    .neq('status', 'deleted')

  console.log(`\nProducts in "accessories": ${products.length}\n`)

  // For each, check the Printify blueprint to determine correct category
  for (const p of products) {
    await delay(300)
    const r = await fetch(`${API}/shops/${SHOP}/products/${p.printify_id}.json`, { headers: hdrs })
    if (r.status !== 200) {
      console.log(`  ❌ ${p.title}: HTTP ${r.status}`)
      continue
    }
    const pp = await r.json()
    const bpId = pp.blueprint_id
    const provId = pp.print_provider_id
    const ppTitle = pp.title

    // Also get blueprint name
    await delay(300)
    const bpR = await fetch(`${API}/catalog/blueprints/${bpId}.json`, { headers: hdrs })
    const bp = bpR.ok ? await bpR.json() : null
    const bpTitle = bp?.title || '?'

    // Determine correct category from blueprint title + product title
    const combined = `${ppTitle} ${bpTitle}`.toLowerCase()
    let correctSlug = null

    if (['hoodie', 'pullover hoodie', 'pullover'].some(k => combined.includes(k))) correctSlug = 'pullover-hoodies'
    else if (['zip-up hoodie', 'zip hoodie'].some(k => combined.includes(k))) correctSlug = 'zip-hoodies'
    else if (['crewneck', 'crew neck', 'sweatshirt'].some(k => combined.includes(k))) correctSlug = 'crewnecks'
    else if (['long sleeve'].some(k => combined.includes(k))) correctSlug = 'long-sleeves'
    else if (['t-shirt', 'tee', 'tshirt'].some(k => combined.includes(k))) correctSlug = 't-shirts'
    else if (['beanie', 'knit hat'].some(k => combined.includes(k))) correctSlug = 'beanies'
    else if (['bucket hat'].some(k => combined.includes(k))) correctSlug = 'bucket-hats'
    else if (['snapback'].some(k => combined.includes(k))) correctSlug = 'snapbacks'
    else if (['dad hat', 'dad cap'].some(k => combined.includes(k))) correctSlug = 'dad-hats'
    else if (['5-panel', '5 panel'].some(k => combined.includes(k))) correctSlug = '5-panel-caps'
    else if (['hat', 'cap'].some(k => combined.includes(k))) correctSlug = 'caps'
    else if (['mug', 'cup'].some(k => combined.includes(k))) correctSlug = 'mugs'
    else if (['tumbler'].some(k => combined.includes(k))) correctSlug = 'tumblers'
    else if (['bottle'].some(k => combined.includes(k))) correctSlug = 'bottles'
    else if (['sticker'].some(k => combined.includes(k))) correctSlug = 'stickers'
    else if (['mouse pad', 'mousepad'].some(k => combined.includes(k))) correctSlug = 'mouse-pads'
    else if (['desk mat'].some(k => combined.includes(k))) correctSlug = 'desk-mats'
    else if (['sneaker', 'shoe'].some(k => combined.includes(k))) correctSlug = 'sneakers'
    else if (['poster', 'canvas'].some(k => combined.includes(k))) correctSlug = 'posters'

    const correctCat = correctSlug ? catBySlug.get(correctSlug) : null

    console.log(`  ${p.title}`)
    console.log(`    BP ${bpId}: "${bpTitle}" | Provider: ${provId}`)
    console.log(`    Combined: "${combined.substring(0, 80)}"`)

    if (correctCat && correctCat.id !== p.category_id) {
      const { error } = await sb.from('products').update({ category_id: correctCat.id }).eq('id', p.id)
      if (error) {
        console.log(`    ❌ Failed to update: ${error.message}`)
      } else {
        console.log(`    ✓ FIXED: accessories → ${correctSlug} (${correctCat.name_en})`)
      }
    } else if (!correctCat) {
      console.log(`    ⚠ Could not determine correct category — needs manual review`)
    } else {
      console.log(`    ✓ Already correct`)
    }
    console.log()
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
