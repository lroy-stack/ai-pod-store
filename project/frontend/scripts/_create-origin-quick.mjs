// Quick create using already-uploaded images (skip re-upload)
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...headers, ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// Already uploaded image IDs
const uploads = {
  front_left_chest:   '69a229563e38462b3294d1f9',
  front_center_chest: '69a2295a516ba84a637daee7',
  left_wrist:         '69a2295dcf58815a40b2a8ec',
  right_wrist:        '69a2295f81ebda6c73dbe520',
}

const PRODUCT = {
  name: 'Origin',
  subtitle: 'Embroidered Hoodie',
  blueprintId: 793,
  providerId: 410,
  colorFilter: ['White', 'Bone'],
  priceCents: 5999,
  category: 'hoodies',
  tags: ['hoodie', 'embroidered', 'premium', 'skapara', 'origin', '2026', 'white', 'streetwear', 'typographic'],
  desc: {
    en: 'SKAPARA Origin — Premium embroidered hoodie. Typographic design with SKAPARA wordmark, block-style 2026, and S mark on sleeve. 3-color thread on Cotton Heritage M2580.',
    es: 'SKAPARA Origin — Hoodie bordado premium. Diseño tipografico con wordmark SKAPARA, 2026 en bloques y marca S en la manga. 3 colores de hilo en Cotton Heritage M2580.',
    de: 'SKAPARA Origin — Premium bestickter Hoodie. Typografisches Design mit SKAPARA-Wortmarke, 2026 in Blockschrift und S-Marke am Armel. 3-Farben-Stickerei auf Cotton Heritage M2580.',
  },
}

async function main() {
  console.log('Origin Hoodie — Quick Create (images already uploaded)\n')

  // Step 1: Get variants
  console.log('Fetching variants...')
  const varRes = await api(`/catalog/blueprints/${PRODUCT.blueprintId}/print_providers/${PRODUCT.providerId}/variants.json`)
  const selected = (varRes.variants || []).filter(v => {
    const c = (v.options?.color || '').toLowerCase()
    return PRODUCT.colorFilter.some(f => c.includes(f.toLowerCase()))
  })
  console.log(`  ${selected.length} White/Bone variants`)

  await delay(2000)

  // Step 2: Create product
  console.log('Creating product...')
  const placeholders = Object.entries(uploads).map(([position, id]) => ({
    position,
    images: [{ id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
  }))

  const prod = await api(`/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: `${PRODUCT.name} — ${PRODUCT.subtitle}`,
      description: PRODUCT.desc.en,
      blueprint_id: PRODUCT.blueprintId,
      print_provider_id: PRODUCT.providerId,
      variants: selected.map(v => ({ id: v.id, price: PRODUCT.priceCents, is_enabled: true })),
      print_areas: [{ variant_ids: selected.map(v => v.id), placeholders }],
      tags: PRODUCT.tags,
    }),
  })
  console.log(`  Printify: ${prod.id}`)

  await delay(2000)

  // Step 3: Publish
  await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('  Published')

  // Step 4: Supabase
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', PRODUCT.category).single()
  const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
    title: PRODUCT.name,
    description: PRODUCT.desc.en,
    printify_id: prod.id,
    blueprint_id: PRODUCT.blueprintId,
    print_provider_id: PRODUCT.providerId,
    category_id: cat?.id,
    status: 'active',
    currency: 'EUR',
    base_price_cents: PRODUCT.priceCents,
    tags: PRODUCT.tags,
    published_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    translations: {
      es: { title: PRODUCT.name, description: PRODUCT.desc.es },
      de: { title: PRODUCT.name, description: PRODUCT.desc.de },
    },
  }).select('id').single()

  if (dbErr) { console.error(`  DB: ${dbErr.message}`); return }
  const dbId = dbProd.id
  console.log(`  Supabase: ${dbId}`)

  try { await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
    method: 'POST', body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } })
  }) } catch {}

  for (const sv of selected) {
    const parts = sv.title.split('/').map(p => p.trim())
    await supabase.from('product_variants').upsert({
      product_id: dbId, printify_variant_id: String(sv.id), title: sv.title,
      color: parts[0] || 'White', size: parts[1] || 'Default',
      price_cents: PRODUCT.priceCents, is_enabled: true, is_available: true,
    }, { onConflict: 'product_id,printify_variant_id' })
  }

  // Sync mockups
  await delay(5000)
  try {
    const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
    const imgs = (details?.images || []).filter(i => !i.src.includes('size-chart')).slice(0, 8).map(i => i.src)
    if (imgs.length) {
      await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbId)
      console.log(`  ${imgs.length} mockups synced`)
    }
  } catch {}

  console.log('\nORIGIN CREATED')
  console.log(`  Printify: ${prod.id}`)
  console.log(`  Supabase: ${dbId}`)
  console.log(`  Variants: ${selected.length} @ EUR 59.99`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
