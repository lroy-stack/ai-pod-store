import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const e = (key) => env.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = e('PRINTIFY_API_TOKEN')
const SHOP = e('PRINTIFY_SHOP_ID')
const supabase = createClient(e('SUPABASE_URL') || e('NEXT_PUBLIC_SUPABASE_URL'), e('SUPABASE_SERVICE_KEY'))
const API = 'https://api.printify.com/v1'
const delay = ms => new Promise(r => setTimeout(r, ms))

async function pfy(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, {
    ...opts, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
  })
  console.log(`  [${r.status}] ${opts.method || 'GET'} ${endpoint}`)
  if (r.status === 429) {
    const txt = await r.text()
    console.log('  RATE LIMITED — aborting. Wait and retry.')
    process.exit(1)
  }
  const body = await r.text()
  if (!r.ok) throw new Error(`${r.status}: ${body.slice(0, 200)}`)
  return body ? JSON.parse(body) : null
}

console.log('Step 1/4: Get BP77 variants')
const varRes = await pfy('/catalog/blueprints/77/print_providers/26/variants.json')
const allV = varRes.variants || []
const want = ['black', 'forest green', 'maroon', 'navy']
const selected = allV.filter(v => want.includes(v.title.split(' / ')[0].trim().toLowerCase()))
console.log(`  ${selected.length} variants matched`)

console.log('\n  Waiting 15s...')
await delay(15000)

console.log('Step 2/4: Create product')
const prod = await pfy(`/shops/${SHOP}/products.json`, {
  method: 'POST',
  body: JSON.stringify({
    title: 'Just One Button',
    description: 'All you wanted was a blue button. What you got was a full codebase rewrite. The AI development experience in one hoodie.',
    blueprint_id: 77, print_provider_id: 26,
    variants: selected.map(v => ({ id: v.id, price: 4999, is_enabled: true })),
    print_areas: [{ variant_ids: selected.map(v => v.id), placeholders: [{
      position: 'front', images: [{ id: '69a354fd6e289f0bcdf86ba3', x: 0.5, y: 0.58, scale: 0.85, angle: 0 }]
    }]}],
    tags: ['skapara','meme','claude-code','scope-creep','ai','developer','hoodie'],
  }),
})
console.log(`  Printify ID: ${prod.id}`)

console.log('\n  Waiting 15s...')
await delay(15000)

console.log('Step 3/4: Publish')
await pfy(`/shops/${SHOP}/products/${prod.id}/publish.json`, {
  method: 'POST',
  body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
})

// Supabase (no rate limit)
const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'pullover-hoodies').single()
const { data: dbProd } = await supabase.from('products').insert({
  title: 'Just One Button',
  description: 'All you wanted was a blue button. What you got was a full codebase rewrite. The AI development experience in one hoodie.',
  printify_id: prod.id, blueprint_id: 77, print_provider_id: 26,
  category_id: cat?.id, category: 'pullover-hoodies',
  status: 'active', currency: 'EUR', base_price_cents: 4999,
  tags: ['skapara','meme','claude-code','scope-creep','ai','developer','hoodie'],
  product_details: {
    material: '50% Cotton / 50% Polyester', care_instructions: 'Machine wash cold, inside out. Tumble dry low.',
    print_technique: 'DTG (Direct-to-Garment)', manufacturing_country: 'Germany',
    brand: 'SKAPARA', provider: 'Textildruck Europa (P26)',
  },
  published_at: new Date().toISOString(), last_synced_at: new Date().toISOString(),
  translations: {
    es: { title: 'Just One Button', description: 'Solo querías un botón azul. Lo que obtuviste fue una reescritura completa del codebase.' },
    de: { title: 'Just One Button', description: 'Du wolltest nur einen blauen Button. Was du bekommen hast, war ein kompletter Codebase-Rewrite.' },
  },
}).select('id').single()
console.log(`  Supabase: ${dbProd.id}`)

try { await pfy(`/shops/${SHOP}/products/${prod.id}/publishing_succeeded.json`, {
  method: 'POST', body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } })
}) } catch {}

for (const sv of selected) {
  const [color, size] = sv.title.split(' / ').map(p => p.trim())
  await supabase.from('product_variants').upsert({
    product_id: dbProd.id, printify_variant_id: String(sv.id),
    title: sv.title, color, size, price_cents: 4999, is_enabled: true, is_available: true,
  }, { onConflict: 'product_id,printify_variant_id' })
}
console.log(`  Variants: ${selected.length}`)

console.log('\n  Waiting 15s for mockups...')
await delay(15000)

console.log('Step 4/4: Fetch mockups')
const details = await pfy(`/shops/${SHOP}/products/${prod.id}.json`)
const imgs = (details?.images || []).filter(i => i.src && !i.src.includes('size-chart')).slice(0,8).map(i => i.src)
if (imgs.length) {
  await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
  console.log(`  Mockups: ${imgs.length}`)
}

console.log(`\n✓ DONE — Printify: ${prod.id} | DB: ${dbProd.id}`)
