import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const e = (key) => env.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = e('PRINTIFY_API_TOKEN')
const SHOP = e('PRINTIFY_SHOP_ID')
const SB_URL = e('SUPABASE_URL') || e('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = e('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)

const API = 'https://api.printify.com/v1'
async function api(endpoint, opts = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${API}${endpoint}`, {
      ...opts,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...opts.headers }
    })
    if (r.status === 429) {
      console.log(`    Rate limited, waiting 30s (attempt ${attempt + 1}/3)...`)
      await delay(30000)
      continue
    }
    const body = await r.text()
    if (!r.ok) throw new Error(`${r.status}: ${body.slice(0, 300)}`)
    return body ? JSON.parse(body) : null
  }
  throw new Error('Rate limited 3 times, giving up')
}

const delay = ms => new Promise(r => setTimeout(r, ms))

function buildGPSR(material) {
  return `<p><strong>Manufacturer:</strong> Textildruck Europa GmbH, Germany</p>
<p><strong>Material:</strong> ${material}</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based OEKO-TEX certified inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>`
}

const SIZES_SET = new Set(['2xs','xs','s','m','l','xl','2xl','3xl','4xl','5xl','one size'])
function parseColorSize(title) {
  const parts = (title || '').split(' / ').map(p => p.trim())
  if (parts.length < 2) return { color: parts[0] || 'Default', size: 'One size' }
  if (SIZES_SET.has(parts[0].toLowerCase())) return { color: parts[1], size: parts[0] }
  return { color: parts[0], size: parts[1] }
}

const PRODUCTS = [
  {
    name: 'skip-permissions',
    title: 'Skip Permissions',
    uploadId: '69a354f30f854773fc0e2abd',
    blueprintId: 92, providerId: 26,
    priceCents: 4999,
    colorFilter: ['Jet Black', 'Oxford Navy', 'Charcoal', 'Bottle Green', 'Purple'],
    category: 'pullover-hoodies',
    printPosition: { x: 0.5, y: 0.45, scale: 1.0 },
    material: '80% Ringspun Cotton / 20% Polyester',
    tags: ['skapara', 'meme', 'claude-code', 'permissions', 'cli', 'developer', 'hoodie', 'college'],
    desc: {
      en: 'Claude has a plan. Four options on screen. You already know which one you\'re picking. Always option two. Sporty college-cut hoodie.',
      es: 'Claude tiene un plan. Cuatro opciones en pantalla. Ya sabes cuál vas a elegir. Siempre la opción dos. Hoodie college-cut deportivo.',
      de: 'Claude hat einen Plan. Vier Optionen auf dem Bildschirm. Du weißt bereits, welche du wählst. Immer Option zwei. Sportlicher College-Cut Hoodie.',
    },
  },
  {
    name: 'just-one-button',
    title: 'Just One Button',
    uploadId: '69a354fd6e289f0bcdf86ba3',
    blueprintId: 77, providerId: 26,
    priceCents: 4999,
    colorFilter: ['Black', 'Forest Green', 'Maroon', 'Navy'],
    category: 'pullover-hoodies',
    printPosition: { x: 0.5, y: 0.58, scale: 0.85 },
    material: '50% Cotton / 50% Polyester',
    tags: ['skapara', 'meme', 'claude-code', 'scope-creep', 'ai', 'developer', 'hoodie'],
    desc: {
      en: 'All you wanted was a blue button. What you got was a full codebase rewrite. The AI development experience in one hoodie.',
      es: 'Solo querías un botón azul. Lo que obtuviste fue una reescritura completa del codebase. La experiencia de desarrollo con AI en un hoodie.',
      de: 'Du wolltest nur einen blauen Button. Was du bekommen hast, war ein kompletter Codebase-Rewrite. Die KI-Entwicklungserfahrung in einem Hoodie.',
    },
  },
]

for (const product of PRODUCTS) {
  console.log(`\n── Creating ${product.title} (BP${product.blueprintId}/P${product.providerId}) ──`)
  
  // Query variants
  await delay(3000)
  const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
  const allVariants = varRes.variants || []
  
  const filterLower = product.colorFilter.map(c => c.toLowerCase())
  const selected = allVariants.filter(v => {
    const { color } = parseColorSize(v.title)
    return filterLower.some(f => color.toLowerCase() === f)
  })
  
  const colors = [...new Set(selected.map(v => parseColorSize(v.title).color))]
  console.log(`  Variants: ${selected.length} (${colors.length} colors)`)
  console.log(`  Colors: ${colors.join(', ')}`)
  
  // Create on Printify
  await delay(3000)
  const { x, y, scale } = product.printPosition
  const prod = await api(`/shops/${SHOP}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: product.title,
      description: product.desc.en,
      blueprint_id: product.blueprintId,
      print_provider_id: product.providerId,
      variants: selected.map(v => ({ id: v.id, price: product.priceCents, is_enabled: true })),
      print_areas: [{
        variant_ids: selected.map(v => v.id),
        placeholders: [{
          position: 'front',
          images: [{ id: product.uploadId, x, y, scale, angle: 0 }],
        }],
      }],
      tags: product.tags,
    }),
  })
  console.log(`  Printify ID: ${prod.id}`)
  
  // GPSR
  try {
    await delay(3000)
    await api(`/shops/${SHOP}/products/${prod.id}/safety_information.json`, {
      method: 'PUT',
      body: JSON.stringify({ safety_information: buildGPSR(product.material) }),
    })
    console.log(`  GPSR: OK`)
  } catch (err) {
    console.log(`  GPSR: ${err.message.substring(0, 80)} (retry later)`)
  }
  
  // Publish
  await delay(3000)
  await api(`/shops/${SHOP}/products/${prod.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log(`  Published`)
  
  // Supabase insert
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', product.category).single()
  const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
    title: product.title,
    description: product.desc.en,
    printify_id: prod.id,
    blueprint_id: product.blueprintId,
    print_provider_id: product.providerId,
    category_id: cat?.id,
    category: product.category,
    status: 'active',
    currency: 'EUR',
    base_price_cents: product.priceCents,
    tags: product.tags,
    product_details: {
      safety_information: buildGPSR(product.material),
      material: product.material,
      care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach.',
      print_technique: 'DTG (Direct-to-Garment)',
      manufacturing_country: 'Germany',
      brand: 'SKAPARA',
      provider: 'Textildruck Europa (P26)',
    },
    published_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    translations: {
      es: { title: product.title, description: product.desc.es },
      de: { title: product.title, description: product.desc.de },
    },
  }).select('id').single()
  
  if (dbErr) { console.log(`  Supabase ERROR: ${dbErr.message}`); continue }
  console.log(`  Supabase: ${dbProd.id}`)
  
  // Publishing succeeded
  try {
    await api(`/shops/${SHOP}/products/${prod.id}/publishing_succeeded.json`, {
      method: 'POST',
      body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } }),
    })
  } catch {}
  
  // Insert variants
  for (const sv of selected) {
    const { color, size } = parseColorSize(sv.title)
    await supabase.from('product_variants').upsert({
      product_id: dbProd.id,
      printify_variant_id: String(sv.id),
      title: sv.title, color, size,
      price_cents: product.priceCents,
      is_enabled: true, is_available: true,
    }, { onConflict: 'product_id,printify_variant_id' })
  }
  console.log(`  Variants: ${selected.length} inserted`)
  
  // Mockups
  await delay(8000)
  try {
    const details = await api(`/shops/${SHOP}/products/${prod.id}.json`)
    const imgs = (details?.images || [])
      .filter(i => i.src && !i.src.includes('size-chart'))
      .slice(0, 8).map(i => i.src)
    if (imgs.length) {
      await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
      console.log(`  Mockups: ${imgs.length} images`)
    }
  } catch {}
  
  console.log(`  ✓ DONE`)
}

console.log('\n═══ ALL DONE ═══')
