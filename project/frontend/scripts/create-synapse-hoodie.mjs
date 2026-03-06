/**
 * SKAPARA "Synapse" — Premium Embroidered White Hoodie
 *
 * Blueprint: BP 793 (Cotton Heritage M2580 Unisex Fleece Hoodie)
 * Provider: 410 (Printful) — Embroidery
 *
 * 4 placements:
 *   front_left_chest  (4"×4")  — S mark in hexagonal badge
 *   front_center_chest (10"×6") — Neural network + SKAPARA wordmark
 *   left_wrist  (2"×3")  — ">_ 26" prompt text
 *   right_wrist (2"×3")  — Small S mark + dots
 *
 * Design: 2-color embroidery (Black #0F172A + Electric Blue #3B82F6) on white hoodie
 *
 * Usage: node scripts/create-synapse-hoodie.mjs [--dry-run]
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── ENV ─────────────────────────────────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN   = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL  = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY  = env('SUPABASE_SERVICE_KEY')

if (!TOKEN || !SHOP_ID || !SB_URL || !SB_KEY) {
  console.error('Missing env vars'); process.exit(1)
}

const supabase = createClient(SB_URL, SB_KEY)
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...headers, ...opts.headers } })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Printify ${r.status}: ${text.slice(0, 300)}`)
  }
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) return r.json()
  return null
}

// ─── Brand Colors ────────────────────────────────────────────────────────────
const BLACK = '#0F172A'
const BLUE  = '#3B82F6'

// ─── SVG Designs ─────────────────────────────────────────────────────────────

/** front_left_chest: S mark inside hexagonal badge — 1200×1200px (4"×4" @300DPI) */
function svgLeftChest() {
  return `<svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
  <!-- Hexagonal border -->
  <polygon points="600,80 1060,340 1060,860 600,1120 140,860 140,340"
           fill="none" stroke="${BLACK}" stroke-width="28"/>
  <!-- Inner hexagon accent -->
  <polygon points="600,160 980,380 980,820 600,1040 220,820 220,380"
           fill="none" stroke="${BLACK}" stroke-width="8" opacity="0.3"/>

  <!-- Bold geometric S -->
  <g transform="translate(600,600)">
    <!-- Top arc of S -->
    <path d="M-200,-320 C-200,-320 -200,-440 -60,-440 L160,-440 C300,-440 300,-320 300,-320
             C300,-200 200,-200 120,-200 L-80,-200"
          fill="none" stroke="${BLACK}" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Bottom arc of S -->
    <path d="M200,320 C200,320 200,440 60,440 L-160,440 C-300,440 -300,320 -300,320
             C-300,200 -200,200 -120,200 L80,200"
          fill="none" stroke="${BLACK}" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Connecting diagonal -->
    <line x1="-80" y1="-200" x2="80" y2="200"
          stroke="${BLACK}" stroke-width="80" stroke-linecap="round"/>
    <!-- Blue accent dots -->
    <circle cx="-200" cy="-320" r="20" fill="${BLUE}"/>
    <circle cx="200" cy="320" r="20" fill="${BLUE}"/>
  </g>
</svg>`
}

/** front_center_chest: Neural network + SKAPARA — 3000×1800px (10"×6" @300DPI) */
function svgCenterChest() {
  // Neural network nodes and connections
  const nodes = [
    { x: 300,  y: 750, r: 35, color: BLACK },
    { x: 650,  y: 550, r: 30, color: BLACK },
    { x: 650,  y: 950, r: 30, color: BLACK },
    { x: 1100, y: 650, r: 40, color: BLUE  },
    { x: 1100, y: 850, r: 40, color: BLUE  },
    { x: 1500, y: 750, r: 55, color: BLACK }, // Center node — main
    { x: 1900, y: 650, r: 40, color: BLUE  },
    { x: 1900, y: 850, r: 40, color: BLUE  },
    { x: 2350, y: 550, r: 30, color: BLACK },
    { x: 2350, y: 950, r: 30, color: BLACK },
    { x: 2700, y: 750, r: 35, color: BLACK },
  ]

  // Connections between nodes
  const edges = [
    [0,1], [0,2], [1,3], [1,4], [2,3], [2,4],
    [3,5], [4,5],
    [5,6], [5,7],
    [6,8], [6,9], [7,8], [7,9], [8,10], [9,10],
  ]

  const lines = edges.map(([a, b]) =>
    `<line x1="${nodes[a].x}" y1="${nodes[a].y}" x2="${nodes[b].x}" y2="${nodes[b].y}"
           stroke="${BLACK}" stroke-width="6" opacity="0.4"/>`
  ).join('\n    ')

  const circles = nodes.map(n =>
    `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${n.color}"/>`
  ).join('\n    ')

  // Center node "S" text
  const centerS = `<text x="1500" y="770" font-family="'Arial Black','Impact',sans-serif"
    font-size="70" fill="white" text-anchor="middle" font-weight="900">S</text>`

  return `<svg width="3000" height="1800" viewBox="0 0 3000 1800" xmlns="http://www.w3.org/2000/svg">
  <!-- SKAPARA wordmark -->
  <text x="1500" y="280" font-family="'Arial Black','Impact',sans-serif"
        font-size="240" fill="${BLACK}" text-anchor="middle" font-weight="900"
        letter-spacing="40">SKAPARA</text>

  <!-- Thin decorative lines under wordmark -->
  <line x1="400" y1="340" x2="1300" y2="340" stroke="${BLACK}" stroke-width="4"/>
  <line x1="1700" y1="340" x2="2600" y2="340" stroke="${BLACK}" stroke-width="4"/>
  <circle cx="1500" cy="340" r="8" fill="${BLUE}"/>

  <!-- Neural network -->
  <g>
    ${lines}
    ${circles}
    ${centerS}
  </g>

  <!-- Bottom tagline -->
  <text x="1500" y="1200" font-family="'Courier New',monospace"
        font-size="80" fill="${BLACK}" text-anchor="middle" opacity="0.7"
        letter-spacing="8">&gt;_ SYNAPSE.001</text>

  <!-- Small decorative dots bottom -->
  <circle cx="1380" cy="1300" r="8" fill="${BLUE}"/>
  <line x1="1396" y1="1300" x2="1604" y2="1300" stroke="${BLACK}" stroke-width="3" opacity="0.3"/>
  <circle cx="1620" cy="1300" r="8" fill="${BLUE}"/>

  <!-- Edition marker -->
  <text x="1500" y="1500" font-family="'Courier New',monospace"
        font-size="48" fill="${BLACK}" text-anchor="middle" opacity="0.4"
        letter-spacing="12">PREMIUM EMBROIDERED COLLECTION</text>
</svg>`
}

/** left_wrist: Prompt text — 600×900px (2"×3" @300DPI) */
function svgLeftWrist() {
  return `<svg width="600" height="900" viewBox="0 0 600 900" xmlns="http://www.w3.org/2000/svg">
  <!-- Prompt symbol -->
  <text x="300" y="350" font-family="'Courier New',monospace"
        font-size="140" fill="${BLACK}" text-anchor="middle" font-weight="bold">&gt;_</text>

  <!-- Year -->
  <text x="300" y="550" font-family="'Arial Black','Impact',sans-serif"
        font-size="160" fill="${BLACK}" text-anchor="middle" font-weight="900">26</text>

  <!-- Small blue dot -->
  <circle cx="300" cy="680" r="14" fill="${BLUE}"/>

  <!-- Thin line below -->
  <line x1="200" y1="740" x2="400" y2="740" stroke="${BLACK}" stroke-width="4" opacity="0.3"/>
</svg>`
}

/** right_wrist: S mark + nodes — 600×900px (2"×3" @300DPI) */
function svgRightWrist() {
  return `<svg width="600" height="900" viewBox="0 0 600 900" xmlns="http://www.w3.org/2000/svg">
  <!-- Mini S -->
  <text x="300" y="380" font-family="'Arial Black','Impact',sans-serif"
        font-size="260" fill="${BLACK}" text-anchor="middle" font-weight="900">S</text>

  <!-- Connected node pair -->
  <circle cx="220" cy="580" r="16" fill="${BLUE}"/>
  <line x1="236" y1="580" x2="364" y2="580" stroke="${BLACK}" stroke-width="5"/>
  <circle cx="380" cy="580" r="16" fill="${BLUE}"/>

  <!-- Small dot below -->
  <circle cx="300" cy="680" r="10" fill="${BLACK}" opacity="0.4"/>

  <!-- Thin line -->
  <line x1="200" y1="740" x2="400" y2="740" stroke="${BLACK}" stroke-width="4" opacity="0.3"/>
</svg>`
}

// ─── Render SVG to PNG buffer ────────────────────────────────────────────────
async function svgToPng(svgString, width, height) {
  return sharp(Buffer.from(svgString))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

// ─── Product definition ──────────────────────────────────────────────────────
const PRODUCT = {
  name: 'Synapse',
  subtitle: 'Embroidered Hoodie',
  blueprintId: 793,
  providerId: 410,
  // White + Bone variants (S-2XL)
  colorFilter: ['White', 'Bone'],
  priceCents: 5999,
  category: 'hoodies',
  tags: ['hoodie', 'embroidered', 'premium', 'neural', 'synapse', 'skapara', 'white', 'streetwear'],
  desc: {
    en: 'SKAPARA Synapse — Premium embroidered hoodie. Neural network design across 4 placements: chest, left pocket, and both wrists. Cotton Heritage M2580 fleece.',
    es: 'SKAPARA Synapse — Hoodie bordado premium. Diseño de red neuronal en 4 posiciones: pecho, bolsillo izquierdo y ambas muñecas. Cotton Heritage M2580.',
    de: 'SKAPARA Synapse — Premium bestickter Hoodie. Neuronales Netzwerk-Design an 4 Positionen: Brust, linke Tasche und beide Handgelenke. Cotton Heritage M2580.',
  },
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SKAPARA SYNAPSE — Embroidered Hoodie')
  console.log('═══════════════════════════════════════════════════════\n')
  if (DRY_RUN) console.log('  *** DRY RUN ***\n')

  // ── Step 1: Generate 4 design PNGs ──────────────────────────────────────
  console.log('Step 1: Generating embroidery designs...\n')

  const designs = [
    { name: 'left_chest',   position: 'front_left_chest',   svg: svgLeftChest(),   w: 1200, h: 1200 },
    { name: 'center_chest', position: 'front_center_chest', svg: svgCenterChest(), w: 3000, h: 1800 },
    { name: 'left_wrist',   position: 'left_wrist',         svg: svgLeftWrist(),    w: 600,  h: 900  },
    { name: 'right_wrist',  position: 'right_wrist',        svg: svgRightWrist(),   w: 600,  h: 900  },
  ]

  const uploads = new Map()

  for (const d of designs) {
    console.log(`  Rendering ${d.name} (${d.w}×${d.h})...`)
    const png = await svgToPng(d.svg, d.w, d.h)
    console.log(`    PNG: ${(png.length / 1024).toFixed(0)} KB`)

    if (DRY_RUN) {
      uploads.set(d.position, `dry-${d.name}`)
      continue
    }

    await delay(2000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({
        file_name: `synapse-${d.name}.png`,
        contents: png.toString('base64'),
      }),
    })
    uploads.set(d.position, upload.id)
    console.log(`    Upload: ${upload.id}`)
  }

  console.log(`\n  ${uploads.size}/4 designs uploaded\n`)

  // ── Step 2: Get White/Bone variants ─────────────────────────────────────
  console.log('Step 2: Fetching variants...\n')

  const varRes = await api(`/catalog/blueprints/${PRODUCT.blueprintId}/print_providers/${PRODUCT.providerId}/variants.json`)
  const allVariants = varRes.variants || []

  const selectedVariants = allVariants.filter(v => {
    const color = (v.options?.color || '').toLowerCase()
    return PRODUCT.colorFilter.some(c => color.includes(c.toLowerCase()))
  })

  console.log(`  Total variants: ${allVariants.length}`)
  console.log(`  White/Bone selected: ${selectedVariants.length}`)
  for (const v of selectedVariants.slice(0, 6)) {
    console.log(`    ${v.id}: ${v.title}`)
  }

  if (selectedVariants.length === 0) {
    console.error('No white/bone variants found!')
    process.exit(1)
  }

  // ── Step 3: Create product with 4 placements ───────────────────────────
  console.log('\nStep 3: Creating product...\n')

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would create product with 4 placements')
    console.log(`  Variants: ${selectedVariants.length}`)
    console.log(`  Price: €${(PRODUCT.priceCents / 100).toFixed(2)}`)
    process.exit(0)
  }

  const placeholders = designs.map(d => ({
    position: d.position,
    images: [{
      id: uploads.get(d.position),
      x: 0.5,
      y: 0.5,
      scale: 1,
      angle: 0,
    }],
  }))

  await delay(1500)
  const printifyProduct = await api(`/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: `${PRODUCT.name} — ${PRODUCT.subtitle}`,
      description: PRODUCT.desc.en,
      blueprint_id: PRODUCT.blueprintId,
      print_provider_id: PRODUCT.providerId,
      variants: selectedVariants.map(v => ({ id: v.id, price: PRODUCT.priceCents, is_enabled: true })),
      print_areas: [{
        variant_ids: selectedVariants.map(v => v.id),
        placeholders,
      }],
      tags: PRODUCT.tags,
    }),
  })

  console.log(`  Printify ID: ${printifyProduct.id}`)

  // ── Step 4: Publish ─────────────────────────────────────────────────────
  await delay(1000)
  await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('  Published ✓')

  // ── Step 5: Save to Supabase ────────────────────────────────────────────
  const { data: catData } = await supabase.from('categories').select('id').eq('slug', PRODUCT.category).single()

  const { data: dbProduct, error: dbError } = await supabase
    .from('products')
    .insert({
      title: PRODUCT.name,
      description: PRODUCT.desc.en,
      printify_id: printifyProduct.id,
      blueprint_id: PRODUCT.blueprintId,
      print_provider_id: PRODUCT.providerId,
      category_id: catData?.id,
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
    })
    .select('id')
    .single()

  if (dbError) {
    console.error(`  DB error: ${dbError.message}`)
  } else {
    const dbId = dbProduct.id
    console.log(`  Supabase ID: ${dbId}`)

    // publishing_succeeded
    try {
      await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publishing_succeeded.json`, {
        method: 'POST',
        body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } }),
      })
    } catch { /* non-fatal */ }

    // Insert variants
    for (const sv of selectedVariants) {
      const parts = sv.title.split('/').map(p => p.trim())
      await supabase.from('product_variants').upsert(
        {
          product_id: dbId,
          printify_variant_id: String(sv.id),
          title: sv.title,
          color: parts[0] || 'White',
          size: parts[1] || parts[0] || 'Default',
          price_cents: PRODUCT.priceCents,
          is_enabled: true,
          is_available: true,
        },
        { onConflict: 'product_id,printify_variant_id' }
      )
    }

    // Sync mockup images
    await delay(3000)
    try {
      const details = await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}.json`)
      if (details?.images?.length) {
        const imageUrls = details.images
          .filter(img => img.src && !img.src.includes('size-chart'))
          .slice(0, 8)
          .map(img => img.src)
        if (imageUrls.length) {
          await supabase.from('products').update({
            images: imageUrls,
            thumbnail_url: imageUrls[0],
          }).eq('id', dbId)
          console.log(`  ${imageUrls.length} mockup images synced`)
        }
      }
    } catch { /* non-fatal */ }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  SYNAPSE HOODIE CREATED ✓')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Blueprint: BP 793 (Cotton Heritage M2580)`)
  console.log(`  Provider: 410 (Printful — Embroidery)`)
  console.log(`  Colors: White, Bone`)
  console.log(`  Variants: ${selectedVariants.length}`)
  console.log(`  Price: €${(PRODUCT.priceCents / 100).toFixed(2)}`)
  console.log(`  Placements: 4 (front_left_chest, front_center_chest, left_wrist, right_wrist)`)
  console.log(`  Thread colors: Black (#0F172A) + Electric Blue (#3B82F6)`)
  console.log()
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
