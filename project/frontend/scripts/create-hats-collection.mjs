/**
 * SKAPARA Hats Collection — 3 Embroidered Hats
 *
 * 1. "Facet" — Classic Cuffed Beanie (BP 1691) — Crystal/diamond pattern
 * 2. "Nova"  — Structured Cap (BP 1744) — Concentric burst
 * 3. "Flux"  — Bucket Hat (BP 1910) — Abstract wave
 *
 * NO BRANDING — Pure abstract geometric designs
 * Bold modern palette: Hot Pink, Electric Orange, Teal, Violet, Black
 *
 * Usage:
 *   node scripts/create-hats-collection.mjs --preview
 *   node scripts/create-hats-collection.mjs --dry-run
 *   node scripts/create-hats-collection.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const PREVIEW = process.argv.includes('--preview')
const DRY_RUN = process.argv.includes('--dry-run')

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN   = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL  = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY  = env('SUPABASE_SERVICE_KEY')

if (!PREVIEW && (!TOKEN || !SHOP_ID || !SB_URL || !SB_KEY)) {
  console.error('Missing env vars'); process.exit(1)
}

const supabase = !PREVIEW ? createClient(SB_URL, SB_KEY) : null
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...headers, ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// ─── Bold Modern Palette ─────────────────────────────────────────────────────
const PINK   = '#EC4899'
const ORANGE = '#F97316'
const TEAL   = '#14B8A6'
const VIOLET = '#8B5CF6'
const BLACK  = '#0F172A'

// ─── Design 1: "Facet" — Diamond/crystal with colored facets ─────────────────
// For beanie cuff embroidery area (~4"×2.5" = 1200×750px at 300DPI)
function svgFacet() {
  return `<svg width="1200" height="750" viewBox="0 0 1200 750" xmlns="http://www.w3.org/2000/svg">
  <!-- Diamond made of 4 colored triangular facets -->
  <!-- Top facet -->
  <polygon points="600,40 380,375 820,375" fill="${PINK}"/>
  <!-- Left facet -->
  <polygon points="380,375 150,375 380,710" fill="${TEAL}"/>
  <!-- Right facet -->
  <polygon points="820,375 1050,375 820,710" fill="${VIOLET}"/>
  <!-- Bottom facet -->
  <polygon points="380,375 820,375 600,710" fill="${ORANGE}"/>

  <!-- Small black accent diamond at center -->
  <polygon points="600,280 520,375 600,470 680,375" fill="${BLACK}"/>

  <!-- Top highlight triangle -->
  <polygon points="600,40 540,180 660,180" fill="${ORANGE}" opacity="0.7"/>
</svg>`
}

// ─── Design 2: "Nova" — Concentric burst/arcs ───────────────────────────────
// For cap front panel (~2.5"×2.5" = 750×750px at 300DPI)
function svgNova() {
  // Bold concentric semi-circles creating a sunrise/burst effect
  return `<svg width="750" height="750" viewBox="0 0 750 750" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer arc - pink -->
  <circle cx="375" cy="750" r="650" fill="${PINK}"/>
  <!-- Middle-outer arc - orange -->
  <circle cx="375" cy="750" r="500" fill="${ORANGE}"/>
  <!-- Middle arc - teal -->
  <circle cx="375" cy="750" r="360" fill="${TEAL}"/>
  <!-- Inner arc - violet -->
  <circle cx="375" cy="750" r="230" fill="${VIOLET}"/>
  <!-- Core - black -->
  <circle cx="375" cy="750" r="120" fill="${BLACK}"/>

  <!-- Mask out the bottom half (below viewBox, automatic) -->
  <!-- The circles are centered at bottom, so only top halves show -->

  <!-- Small floating accent dots -->
  <circle cx="375" cy="80" r="35" fill="${BLACK}"/>
  <circle cx="220" cy="160" r="22" fill="${PINK}"/>
  <circle cx="530" cy="160" r="22" fill="${ORANGE}"/>
</svg>`
}

// ─── Design 3: "Flux" — Abstract thick wave stripes ─────────────────────────
// For bucket hat front (~2"×2" = 600×600px at 300DPI)
function svgFlux() {
  // 4 thick diagonal stripes at an angle
  return `<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <!-- Thick diagonal stripes -->
  <rect x="-80" y="-100" width="140" height="800" rx="15" fill="${PINK}" transform="rotate(-25,300,300)"/>
  <rect x="80" y="-100" width="140" height="800" rx="15" fill="${ORANGE}" transform="rotate(-25,300,300)"/>
  <rect x="240" y="-100" width="140" height="800" rx="15" fill="${TEAL}" transform="rotate(-25,300,300)"/>
  <rect x="400" y="-100" width="140" height="800" rx="15" fill="${VIOLET}" transform="rotate(-25,300,300)"/>

  <!-- Black accent circle overlapping -->
  <circle cx="420" cy="460" r="80" fill="${BLACK}"/>
</svg>`
}

// ─── SVG to PNG ──────────────────────────────────────────────────────────────
async function svgToPng(svgString, width, height) {
  return sharp(Buffer.from(svgString))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

// ─── Product Definitions ─────────────────────────────────────────────────────
const PRODUCTS = [
  {
    name: 'Facet',
    subtitle: 'Embroidered Beanie',
    blueprintId: 1691,
    providerId: 99,
    priceCents: 2499,
    colorFilter: ['Black', 'Navy', 'Dark Grey', 'Olive', 'White', 'Spruce', 'Brown', 'Red', 'Royal', 'Gold'],
    svg: svgFacet,
    svgW: 1200, svgH: 750,
    position: 'front',
    category: 'hats',
    tags: ['beanie', 'embroidered', 'abstract', 'geometric', 'crystal', 'colorful', 'streetwear'],
    desc: {
      en: 'Facet — Embroidered cuffed beanie. Abstract crystal/diamond pattern in bold pink, orange, teal, and violet. One size fits all.',
      es: 'Facet — Beanie bordado con doblez. Patron de cristal/diamante abstracto en rosa, naranja, teal y violeta. Talla unica.',
      de: 'Facet — Bestickte Beanie mit Umschlag. Abstraktes Kristall-/Diamantmuster in Pink, Orange, Teal und Violett. Einheitsgrosse.',
    },
  },
  {
    name: 'Nova',
    subtitle: 'Embroidered Cap',
    blueprintId: 1744,
    providerId: 99,
    priceCents: 2999,
    colorFilter: ['Black', 'Dark Navy', 'Dark Grey', 'Royal Blue', 'Khaki', 'Olive', 'White', 'Grey', 'Red'],
    svg: svgNova,
    svgW: 750, svgH: 750,
    position: 'front',
    category: 'hats',
    tags: ['cap', 'embroidered', 'abstract', 'burst', 'nova', 'colorful', 'streetwear'],
    desc: {
      en: 'Nova — Embroidered structured cap. Concentric burst pattern in pink, orange, teal, violet, and black. S/M and L/XL sizes.',
      es: 'Nova — Gorra estructurada bordada. Patron de explosion concentrica en rosa, naranja, teal, violeta y negro. Tallas S/M y L/XL.',
      de: 'Nova — Bestickte strukturierte Kappe. Konzentrisches Burst-Muster in Pink, Orange, Teal, Violett und Schwarz. S/M und L/XL.',
    },
  },
  {
    name: 'Flux',
    subtitle: 'Embroidered Bucket Hat',
    blueprintId: 1910,
    providerId: 410,
    priceCents: 2999,
    colorFilter: ['Black', 'Navy', 'White'],
    svg: svgFlux,
    svgW: 600, svgH: 600,
    position: 'front',
    category: 'hats',
    tags: ['bucket hat', 'embroidered', 'abstract', 'stripes', 'flux', 'colorful', 'streetwear'],
    desc: {
      en: 'Flux — Embroidered bucket hat. Bold diagonal stripe pattern in pink, orange, teal, and violet. One size.',
      es: 'Flux — Bucket hat bordado. Patron de rayas diagonales en rosa, naranja, teal y violeta. Talla unica.',
      de: 'Flux — Bestickter Bucket Hat. Kuhnes diagonales Streifenmuster in Pink, Orange, Teal und Violett. Einheitsgrosse.',
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  SKAPARA HATS COLLECTION — 3 Embroidered Hats')
  console.log('='.repeat(55) + '\n')
  if (PREVIEW) console.log('  *** PREVIEW MODE ***\n')
  if (DRY_RUN) console.log('  *** DRY RUN ***\n')

  const previewDir = '/tmp/hats-collection'
  mkdirSync(previewDir, { recursive: true })

  // Ensure 'hats' category exists
  if (!PREVIEW) {
    const { data: catCheck } = await supabase.from('categories').select('id').eq('slug', 'hats').single()
    if (!catCheck) {
      console.log('Creating "hats" category...')
      await supabase.from('categories').insert({
        name: 'Hats',
        slug: 'hats',
        description: 'Embroidered hats, beanies, and caps',
        translations: {
          es: { name: 'Gorros', description: 'Gorros, beanies y gorras bordadas' },
          de: { name: 'Hute', description: 'Bestickte Hute, Beanies und Caps' },
        },
      })
      console.log('  Created')
    }
  }

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`\n${'─'.repeat(55)}`)
    console.log(`  [${idx + 1}/3] ${product.name} — ${product.subtitle}`)
    console.log(`${'─'.repeat(55)}\n`)

    // Step 1: Render design
    console.log('  Rendering design...')
    const svg = product.svg()
    writeFileSync(`${previewDir}/${product.name.toLowerCase()}.svg`, svg)
    const png = await svgToPng(svg, product.svgW, product.svgH)
    writeFileSync(`${previewDir}/${product.name.toLowerCase()}.png`, png)
    console.log(`    ${(png.length / 1024).toFixed(0)} KB -> ${previewDir}/${product.name.toLowerCase()}.png`)

    if (PREVIEW) continue

    // Step 2: Upload
    await delay(3000)
    console.log('  Uploading...')
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({
        file_name: `hat-${product.name.toLowerCase()}.png`,
        contents: png.toString('base64'),
      }),
    })
    console.log(`    Upload: ${upload.id}`)

    // Step 3: Get variants
    await delay(3000)
    console.log('  Fetching variants...')
    const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
    const allVariants = varRes.variants || []
    const selected = allVariants.filter(v => {
      const c = (v.options?.color || v.title || '').toLowerCase()
      return product.colorFilter.some(f => c.toLowerCase().includes(f.toLowerCase()))
    })
    console.log(`    ${selected.length} / ${allVariants.length} variants selected`)
    for (const v of selected.slice(0, 5)) console.log(`      ${v.id}: ${v.title}`)

    if (!selected.length) {
      // Fallback: use all variants
      console.log('    No filter matches, using all variants')
      selected.push(...allVariants)
    }

    if (DRY_RUN) {
      console.log(`    [DRY] Would create ${selected.length} variants @ EUR ${(product.priceCents/100).toFixed(2)}`)
      continue
    }

    // Step 4: Create product
    await delay(3000)
    console.log('  Creating product...')
    const prod = await api(`/shops/${SHOP_ID}/products.json`, {
      method: 'POST',
      body: JSON.stringify({
        title: `${product.name} — ${product.subtitle}`,
        description: product.desc.en,
        blueprint_id: product.blueprintId,
        print_provider_id: product.providerId,
        variants: selected.map(v => ({ id: v.id, price: product.priceCents, is_enabled: true })),
        print_areas: [{
          variant_ids: selected.map(v => v.id),
          placeholders: [{
            position: product.position,
            images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
          }],
        }],
        tags: product.tags,
      }),
    })
    console.log(`    Printify: ${prod.id}`)

    // Step 5: Publish
    await delay(2000)
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
      method: 'POST',
      body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    })
    console.log('    Published')

    // Step 6: Supabase
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', product.category).single()
    const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
      title: product.name,
      description: product.desc.en,
      printify_id: prod.id,
      blueprint_id: product.blueprintId,
      print_provider_id: product.providerId,
      category_id: cat?.id,
      status: 'active',
      currency: 'EUR',
      base_price_cents: product.priceCents,
      tags: product.tags,
      published_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      translations: {
        es: { title: product.name, description: product.desc.es },
        de: { title: product.name, description: product.desc.de },
      },
    }).select('id').single()

    if (dbErr) { console.error(`    DB: ${dbErr.message}`); continue }
    const dbId = dbProd.id
    console.log(`    Supabase: ${dbId}`)

    try { await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
      method: 'POST', body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } })
    }) } catch {}

    // Variants
    for (const sv of selected) {
      const parts = sv.title.split('/').map(p => p.trim())
      await supabase.from('product_variants').upsert({
        product_id: dbId, printify_variant_id: String(sv.id), title: sv.title,
        color: parts[0] || sv.options?.color || 'Default',
        size: parts[1] || sv.options?.size || 'One size',
        price_cents: product.priceCents, is_enabled: true, is_available: true,
      }, { onConflict: 'product_id,printify_variant_id' })
    }

    // Sync mockups
    await delay(5000)
    try {
      const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
      const imgs = (details?.images || []).filter(i => !i.src.includes('size-chart')).slice(0, 6).map(i => i.src)
      if (imgs.length) {
        await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbId)
        console.log(`    ${imgs.length} mockups synced`)
      }
    } catch {}

    console.log(`    DONE: ${product.name}`)
  }

  console.log('\n' + '='.repeat(55))
  console.log('  HATS COLLECTION COMPLETE')
  console.log('='.repeat(55))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
