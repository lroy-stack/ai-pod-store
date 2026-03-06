import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const supabase = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))
const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs, ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// 1. Delete embroidered hoodie
console.log('Deleting embroidered hoodie...')
try { await fetch(`${API}/shops/${SHOP_ID}/products/69a24369efc94038120f27d5.json`, { method: 'DELETE', headers: hdrs }) } catch {}
await supabase.from('product_variants').delete().eq('product_id', '842cb476-2c41-46df-a168-7cd679b5205c')
await supabase.from('products').delete().eq('id', '842cb476-2c41-46df-a168-7cd679b5205c')
console.log('Deleted\n')

// 2. Reuse existing apparel upload
const UPLOAD_ID = '69a241caa08e9da20a6d074f'

// 3. Get BP 455 + Provider 26 (Textildruck Europa DTG)
await delay(2000)
const varRes = await api('/catalog/blueprints/455/print_providers/26/variants.json')
const allVars = varRes.variants || []
const colorFilter = ['Black', 'Anthracite', 'Navy', 'Heather Grey']
let selected = allVars.filter(v => {
  const c = (v.options?.color || v.title || '').toLowerCase()
  return colorFilter.some(f => c.includes(f.toLowerCase()))
})
if (!selected.length) selected = allVars

const colors = [...new Set(selected.map(v => v.options?.color || '?'))]
const sizes = [...new Set(selected.map(v => v.options?.size || '?'))]
console.log(`BP 455 (Zip-Up Hoodie DTG) + Provider 26`)
console.log(`${colors.length} colors: ${colors.join(', ')}`)
console.log(`${sizes.length} sizes: ${sizes.join(', ')}`)
console.log(`${selected.length} variants\n`)

// 4. Create product
await delay(2000)
const prod = await api(`/shops/${SHOP_ID}/products.json`, {
  method: 'POST',
  body: JSON.stringify({
    title: 'GPU — Zip-Up Hoodie',
    description: 'GPU — Premium zip-up hoodie with DTG-printed eye logo on front. Green on dark. The ultimate dev flex.',
    blueprint_id: 455,
    print_provider_id: 26,
    variants: selected.map(v => ({ id: v.id, price: 4999, is_enabled: true })),
    print_areas: [{
      variant_ids: selected.map(v => v.id),
      placeholders: [{ position: 'front', images: [{ id: UPLOAD_ID, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
    }],
    tags: ['hoodie', 'zip-up', 'GPU', 'graphics', 'developer', 'gaming', 'streetwear', '2026'],
  }),
})
console.log(`Printify: ${prod.id}`)

// 5. Publish
await delay(1500)
await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
  method: 'POST', body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
})

// 6. Supabase
const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'hoodies').single()
const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
  title: 'GPU — Zip-Up Hoodie',
  description: 'GPU — Premium zip-up hoodie. Green eye logo DTG-printed on front.',
  printify_id: prod.id, blueprint_id: 455, print_provider_id: 26,
  category_id: cat?.id, status: 'active', currency: 'EUR',
  base_price_cents: 4999,
  tags: ['hoodie', 'zip-up', 'GPU', 'graphics', 'developer', 'gaming', 'streetwear', '2026'],
  published_at: new Date().toISOString(), last_synced_at: new Date().toISOString(),
  translations: {
    es: { title: 'GPU — Zip-Up Hoodie', description: 'GPU — Hoodie premium con cremallera. Logo ojo verde impreso DTG.' },
    de: { title: 'GPU — Zip-Up Hoodie', description: 'GPU — Premium Zip-Hoodie. Grünes Augen-Logo DTG-gedruckt.' },
  },
}).select('id').single()

if (dbErr) { console.error(`DB: ${dbErr.message}`); process.exit(1) }
console.log(`Supabase: ${dbProd.id}`)

try { await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
  method: 'POST', body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } })
}) } catch {}

for (const sv of selected) {
  const parts = sv.title.split('/').map(p => p.trim())
  await supabase.from('product_variants').upsert({
    product_id: dbProd.id, printify_variant_id: String(sv.id), title: sv.title,
    color: parts[0] || sv.options?.color || 'Default',
    size: parts[1] || sv.options?.size || 'One size',
    price_cents: 4999, is_enabled: true, is_available: true,
  }, { onConflict: 'product_id,printify_variant_id' })
}

// 7. Validate
await delay(8000)
const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)

console.log('\nPrint areas:')
for (const pa of details.print_areas || []) {
  for (const ph of pa.placeholders || []) {
    console.log(`  ${ph.position}: ${ph.images?.length || 0} images`)
  }
}

const imgs = (details?.images || []).filter(i => !i.src.includes('size-chart')).slice(0, 8).map(i => i.src)
if (imgs.length) {
  await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
  console.log(`${imgs.length} mockups`)
  console.log(`Front: ${imgs[0]}`)
}

console.log('\nDONE')
