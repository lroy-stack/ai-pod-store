import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = import.meta.dirname ? join(import.meta.dirname, '..') : '/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend'
const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const e = (key) => env.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = e('PRINTIFY_API_TOKEN')
const SHOP = e('PRINTIFY_SHOP_ID')
const SB_URL = e('SUPABASE_URL') || e('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = e('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)

const API = 'https://api.printify.com/v1'
async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...opts.headers }
  })
  const body = await r.text()
  if (!r.ok) throw new Error(`${r.status}: ${body.slice(0, 300)}`)
  return body ? JSON.parse(body) : null
}

const delay = ms => new Promise(r => setTimeout(r, ms))

function buildGPSR(material) {
  return `<p><strong>Manufacturer:</strong> Textildruck Europa GmbH, Germany</p>
<p><strong>Material:</strong> ${material}</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based OEKO-TEX certified inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>`
}

const SIZES = new Set(['2xs','xs','s','m','l','xl','2xl','3xl','4xl','5xl','one size'])
function parseColorSize(title) {
  const parts = (title || '').split(' / ').map(p => p.trim())
  if (parts.length < 2) return { color: parts[0] || 'Default', size: 'One size' }
  if (SIZES.has(parts[0].toLowerCase())) return { color: parts[1], size: parts[0] }
  return { color: parts[0], size: parts[1] }
}

// ═══════════════════════════════════════════════════════════
// STEP 1: Delete old broken products
// ═══════════════════════════════════════════════════════════

const OLD = [
  { name: 'Skip Permissions (old)', printifyId: '69a35647414758b6c602ea45', dbId: '03253d89-df33-42a7-b7a5-2a1b9226d87c' },
  { name: 'Just One Button (old)', printifyId: '69a3568cf7d8be67940cd6b8', dbId: '41fea70b-240f-4d93-89f8-f7044abb8297' },
]

console.log('═══ STEP 1: Delete old products ═══\n')
for (const old of OLD) {
  console.log(`Deleting ${old.name}...`)
  
  // Unpublish from Printify first
  try {
    await api(`/shops/${SHOP}/products/${old.printifyId}/unpublish.json`, {
      method: 'POST',
      body: JSON.stringify({})
    })
    console.log('  Unpublished from Printify')
  } catch (err) {
    console.log(`  Unpublish: ${err.message.substring(0, 100)}`)
  }
  await delay(2000)
  
  // Delete from Printify
  try {
    await fetch(`${API}/shops/${SHOP}/products/${old.printifyId}.json`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}` }
    })
    console.log('  Deleted from Printify')
  } catch (err) {
    console.log(`  Printify delete: ${err.message}`)
  }
  
  // Delete variants from Supabase
  const { error: vErr } = await supabase.from('product_variants').delete().eq('product_id', old.dbId)
  console.log(`  Variants deleted: ${vErr ? vErr.message : 'OK'}`)
  
  // Delete product from Supabase
  const { error: pErr } = await supabase.from('products').delete().eq('id', old.dbId)
  console.log(`  Product deleted: ${pErr ? pErr.message : 'OK'}`)
  console.log()
}

// ═══════════════════════════════════════════════════════════
// STEP 2: Recreate with fixes
// ═══════════════════════════════════════════════════════════

console.log('═══ STEP 2: Recreate with fixes ═══\n')

const NEW_PRODUCTS = [
  // Skip Permissions — NEW design (13-bypass-permissions) instead of 14-skip-permissions
  {
    name: 'skip-permissions',
    title: 'Skip Permissions',
    uploadId: '69a354f30f854773fc0e2abd',  // Upload for 13-bypass-permissions-tee.png (from Option Two)
    blueprintId: 92, providerId: 26,
    priceCents: 4999,
    colorFilter: ['Jet Black', 'Oxford Navy', 'Charcoal', 'Bottle Green', 'Purple'],
    category: 'pullover-hoodies',
    printPosition: { x: 0.5, y: 0.45, scale: 1.0 },  // Full scale — design 13 has lots of content
    material: '80% Ringspun Cotton / 20% Polyester',
    tags: ['skapara', 'meme', 'claude-code', 'permissions', 'cli', 'developer', 'hoodie', 'college'],
    desc: {
      en: 'Claude has a plan. Four options on screen. You already know which one you\'re picking. Always option two. Sporty college-cut hoodie.',
      es: 'Claude tiene un plan. Cuatro opciones en pantalla. Ya sabes cuál vas a elegir. Siempre la opción dos. Hoodie college-cut deportivo.',
      de: 'Claude hat einen Plan. Vier Optionen auf dem Bildschirm. Du weißt bereits, welche du wählst. Immer Option zwei. Sportlicher College-Cut Hoodie.',
    },
  },
  // Just One Button — same design, adjusted position
  {
    name: 'just-one-button',
    title: 'Just One Button',
    uploadId: '69a354fd6e289f0bcdf86ba3',  // Upload for 15-button-color-tee.png
    blueprintId: 77, providerId: 26,
    priceCents: 4999,
    colorFilter: ['Black', 'Forest Green', 'Maroon', 'Navy'],
    category: 'pullover-hoodies',
    printPosition: { x: 0.5, y: 0.58, scale: 0.85 },  // Pushed DOWN + smaller to avoid hood cut
    material: '50% Cotton / 50% Polyester',
    tags: ['skapara', 'meme', 'claude-code', 'scope-creep', 'ai', 'developer', 'hoodie'],
    desc: {
      en: 'All you wanted was a blue button. What you got was a full codebase rewrite. The AI development experience in one hoodie.',
      es: 'Solo querías un botón azul. Lo que obtuviste fue una reescritura completa del codebase. La experiencia de desarrollo con AI en un hoodie.',
      de: 'Du wolltest nur einen blauen Button. Was du bekommen hast, war ein kompletter Codebase-Rewrite. Die KI-Entwicklungserfahrung in einem Hoodie.',
    },
  },
]

for (const product of NEW_PRODUCTS) {
  console.log(`\n── Creating ${product.title} (BP${product.blueprintId}/P${product.providerId}) ──`)
  
  // Query variants
  await delay(2000)
  const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
  const allVariants = varRes.variants || []
  
  const filterLower = product.colorFilter.map(c => c.toLowerCase())
  const selected = allVariants.filter(v => {
    const { color } = parseColorSize(v.title)
    return filterLower.some(f => color.toLowerCase() === f)
  })
  
  const colors = [...new Set(selected.map(v => parseColorSize(v.title).color))]
  const sizes = [...new Set(selected.map(v => parseColorSize(v.title).size))]
  console.log(`  Variants: ${selected.length} (${colors.length} colors × ${sizes.length} sizes)`)
  console.log(`  Colors: ${colors.join(', ')}`)
  
  // Create on Printify
  await delay(2000)
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
    await delay(1500)
    await api(`/shops/${SHOP}/products/${prod.id}/safety_information.json`, {
      method: 'PUT',
      body: JSON.stringify({ safety_information: buildGPSR(product.material) }),
    })
    console.log(`  GPSR: OK`)
  } catch (err) {
    console.log(`  GPSR: ${err.message.substring(0, 80)} (retry later)`)
  }
  
  // Publish
  await delay(1500)
  await api(`/shops/${SHOP}/products/${prod.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log(`  Published`)
  
  // Supabase insert
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', product.category).single()
  const gpsrHtml = buildGPSR(product.material)
  const productDetails = {
    safety_information: gpsrHtml,
    material: product.material,
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Germany',
    brand: 'SKAPARA',
    provider: 'Textildruck Europa (P26)',
  }
  
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
    product_details: productDetails,
    published_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    translations: {
      es: { title: product.title, description: product.desc.es },
      de: { title: product.title, description: product.desc.de },
    },
  }).select('id').single()
  
  if (dbErr) {
    console.log(`  Supabase ERROR: ${dbErr.message}`)
    continue
  }
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
      title: sv.title,
      color,
      size,
      price_cents: product.priceCents,
      is_enabled: true,
      is_available: true,
    }, { onConflict: 'product_id,printify_variant_id' })
  }
  console.log(`  Variants: ${selected.length} inserted`)
  
  // Mockups
  await delay(5000)
  try {
    const details = await api(`/shops/${SHOP}/products/${prod.id}.json`)
    const imgs = (details?.images || [])
      .filter(i => i.src && !i.src.includes('size-chart'))
      .slice(0, 8)
      .map(i => i.src)
    if (imgs.length) {
      await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
      console.log(`  Mockups: ${imgs.length} images`)
    }
  } catch {}
  
  console.log(`  ✓ DONE | Printify: ${prod.id} | DB: ${dbProd.id}`)
}

console.log('\n═══ ALL DONE ═══')
console.log('Run cron sync to finalize mockup images.')
