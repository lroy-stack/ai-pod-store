/**
 * SKAPARA "Synapse" v2 — Premium Embroidered White Hoodie
 *
 * BP 793 (Cotton Heritage M2580) + Provider 410 (Printful Embroidery)
 *
 * Design: Bold abstract geometric — ONLY SVG primitives (circle, rect, polygon)
 * NO text (eliminates font rendering issues)
 * ALL shapes solid-filled (no outlines/strokes that could render thin)
 * Minimum element size: 90px (0.3" at 300DPI)
 *
 * Colors (5 thread colors):
 *   Black:   #0F172A
 *   Blue:    #2563EB
 *   Coral:   #EF4444
 *   Amber:   #F59E0B
 *   Teal:    #059669
 *
 * Usage:
 *   node scripts/create-synapse-v2.mjs --preview    (render PNGs locally, don't upload)
 *   node scripts/create-synapse-v2.mjs --dry-run    (render + fetch variants, don't create)
 *   node scripts/create-synapse-v2.mjs              (full create)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const PREVIEW  = process.argv.includes('--preview')
const DRY_RUN  = process.argv.includes('--dry-run')

// ─── ENV ─────────────────────────────────────────────────────────────────────
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
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Printify ${r.status}: ${text.slice(0, 300)}`)
  }
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) return r.json()
  return null
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const BLACK = '#0F172A'
const BLUE  = '#2563EB'
const CORAL = '#EF4444'
const AMBER = '#F59E0B'
const TEAL  = '#059669'

// ─── SVG Designs ─────────────────────────────────────────────────────────────
// RULES: Only <circle>, <rect>, <polygon>, <ellipse> with solid fill.
// NO <text>, NO <path>, NO <line>, NO stroke-only elements.
// Every element ≥ 90px in smallest dimension.

/**
 * front_left_chest (1200×1200px = 4"×4")
 * Abstract mark: overlapping bold geometric shapes
 */
function svgLeftChest() {
  return `<svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
  <!-- Large blue circle - left -->
  <circle cx="420" cy="500" r="280" fill="${BLUE}"/>
  <!-- Coral triangle - right overlap -->
  <polygon points="550,200 950,750 250,750" fill="${CORAL}"/>
  <!-- Amber accent circle - center overlap -->
  <circle cx="580" cy="600" r="150" fill="${AMBER}"/>
  <!-- Black diamond - bottom -->
  <polygon points="600,700 780,900 600,1100 420,900" fill="${BLACK}"/>
  <!-- Teal small circle - top right accent -->
  <circle cx="820" cy="350" r="110" fill="${TEAL}"/>
</svg>`
}

/**
 * front_center_chest (3000×1800px = 10"×6")
 * Hero piece: Bold abstract landscape of overlapping geometric planes
 */
function svgCenterChest() {
  return `<svg width="3000" height="1800" viewBox="0 0 3000 1800" xmlns="http://www.w3.org/2000/svg">
  <!-- === LEFT CLUSTER === -->
  <!-- Large black triangle base -->
  <polygon points="100,400 700,1500 -200,1500" fill="${BLACK}"/>
  <!-- Blue circle overlapping -->
  <circle cx="400" cy="900" r="320" fill="${BLUE}"/>
  <!-- Coral accent rect -->
  <rect x="50" y="600" width="250" height="500" rx="30" fill="${CORAL}" transform="rotate(-15,175,850)"/>

  <!-- === CENTER COMPOSITION === -->
  <!-- Large amber triangle pointing up -->
  <polygon points="1500,150 1900,1000 1100,1000" fill="${AMBER}"/>
  <!-- Large teal circle -->
  <circle cx="1350" cy="1000" r="350" fill="${TEAL}"/>
  <!-- Black rectangle bar -->
  <rect x="1100" y="500" width="800" height="200" rx="20" fill="${BLACK}" transform="rotate(-8,1500,600)"/>
  <!-- Blue circle overlap center -->
  <circle cx="1600" cy="800" r="250" fill="${BLUE}"/>
  <!-- Coral diamond -->
  <polygon points="1500,300 1700,600 1500,900 1300,600" fill="${CORAL}"/>

  <!-- === RIGHT CLUSTER === -->
  <!-- Teal triangle -->
  <polygon points="2500,200 2900,900 2100,900" fill="${TEAL}"/>
  <!-- Black circle -->
  <circle cx="2600" cy="1100" r="300" fill="${BLACK}"/>
  <!-- Amber rectangle -->
  <rect x="2300" y="900" width="200" height="600" rx="20" fill="${AMBER}" transform="rotate(12,2400,1200)"/>
  <!-- Coral circle accent -->
  <circle cx="2200" cy="600" r="180" fill="${CORAL}"/>
  <!-- Blue rect accent -->
  <rect x="2650" y="400" width="250" height="400" rx="30" fill="${BLUE}" transform="rotate(20,2775,600)"/>

  <!-- === CONNECTING ELEMENTS === -->
  <!-- Horizontal amber bar linking clusters -->
  <rect x="600" y="1350" width="1800" height="120" rx="60" fill="${AMBER}" opacity="0.8"/>
  <!-- Small black circles as rhythm dots -->
  <circle cx="900" cy="400" r="90" fill="${BLACK}"/>
  <circle cx="2050" cy="350" r="90" fill="${BLACK}"/>
</svg>`
}

/**
 * left_wrist (600×900px = 2"×3")
 * Three stacked bold circles — blue, coral, amber
 */
function svgLeftWrist() {
  return `<svg width="600" height="900" viewBox="0 0 600 900" xmlns="http://www.w3.org/2000/svg">
  <!-- Blue circle top -->
  <circle cx="300" cy="200" r="140" fill="${BLUE}"/>
  <!-- Coral circle middle -->
  <circle cx="300" cy="460" r="140" fill="${CORAL}"/>
  <!-- Amber circle bottom -->
  <circle cx="300" cy="720" r="140" fill="${AMBER}"/>
</svg>`
}

/**
 * right_wrist (600×900px = 2"×3")
 * Two bold diagonal stripes + accent dot
 */
function svgRightWrist() {
  return `<svg width="600" height="900" viewBox="0 0 600 900" xmlns="http://www.w3.org/2000/svg">
  <!-- Teal diagonal stripe -->
  <rect x="80" y="-50" width="180" height="1000" rx="20" fill="${TEAL}" transform="rotate(-20,300,450)"/>
  <!-- Blue diagonal stripe -->
  <rect x="340" y="-50" width="180" height="1000" rx="20" fill="${BLUE}" transform="rotate(-20,300,450)"/>
  <!-- Coral accent circle at bottom -->
  <circle cx="300" cy="780" r="100" fill="${CORAL}"/>
</svg>`
}

// ─── Render SVG to PNG ───────────────────────────────────────────────────────
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
  colorFilter: ['White', 'Bone'],
  priceCents: 5999,
  category: 'hoodies',
  tags: ['hoodie', 'embroidered', 'premium', 'abstract', 'geometric', 'skapara', 'white', 'streetwear', 'colorful'],
  desc: {
    en: 'SKAPARA Synapse — Premium embroidered hoodie. Bold abstract geometric design across 4 placements: chest, left pocket, and both wrists. 5-color thread embroidery on Cotton Heritage M2580 fleece.',
    es: 'SKAPARA Synapse — Hoodie bordado premium. Diseño geométrico abstracto en 4 posiciones: pecho, bolsillo izquierdo y ambas muñecas. Bordado de 5 colores en Cotton Heritage M2580.',
    de: 'SKAPARA Synapse — Premium bestickter Hoodie. Abstraktes geometrisches Design an 4 Positionen: Brust, linke Tasche und beide Handgelenke. 5-Farben-Stickerei auf Cotton Heritage M2580.',
  },
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SKAPARA SYNAPSE v2 — Bold Abstract Embroidery')
  console.log('═══════════════════════════════════════════════════════\n')
  if (PREVIEW)  console.log('  *** PREVIEW MODE — Rendering PNGs locally ***\n')
  if (DRY_RUN)  console.log('  *** DRY RUN ***\n')

  // ── Step 1: Generate designs ───────────────────────────────────────────
  console.log('Step 1: Generating embroidery designs...\n')

  const designs = [
    { name: 'left_chest',   position: 'front_left_chest',   svg: svgLeftChest(),   w: 1200, h: 1200 },
    { name: 'center_chest', position: 'front_center_chest', svg: svgCenterChest(), w: 3000, h: 1800 },
    { name: 'left_wrist',   position: 'left_wrist',         svg: svgLeftWrist(),    w: 600,  h: 900  },
    { name: 'right_wrist',  position: 'right_wrist',        svg: svgRightWrist(),   w: 600,  h: 900  },
  ]

  // Save SVGs for inspection
  const previewDir = '/tmp/synapse-v2'
  mkdirSync(previewDir, { recursive: true })

  const uploads = new Map()

  for (const d of designs) {
    console.log(`  Rendering ${d.name} (${d.w}x${d.h})...`)

    // Save SVG source
    writeFileSync(`${previewDir}/${d.name}.svg`, d.svg)

    const png = await svgToPng(d.svg, d.w, d.h)
    console.log(`    PNG: ${(png.length / 1024).toFixed(0)} KB`)

    // Always save PNG locally for inspection
    writeFileSync(`${previewDir}/${d.name}.png`, png)
    console.log(`    Saved: ${previewDir}/${d.name}.png`)

    if (PREVIEW || DRY_RUN) {
      uploads.set(d.position, `preview-${d.name}`)
      continue
    }

    await delay(2000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({
        file_name: `synapse-v2-${d.name}.png`,
        contents: png.toString('base64'),
      }),
    })
    uploads.set(d.position, upload.id)
    console.log(`    Upload: ${upload.id}`)
  }

  console.log(`\n  ${uploads.size}/4 designs rendered`)
  console.log(`  Preview dir: ${previewDir}/\n`)

  if (PREVIEW) {
    console.log('Preview complete. Check PNGs at:')
    for (const d of designs) console.log(`  ${previewDir}/${d.name}.png`)
    process.exit(0)
  }

  // ── Step 2: Get variants ───────────────────────────────────────────────
  console.log('Step 2: Fetching variants...\n')

  const varRes = await api(`/catalog/blueprints/${PRODUCT.blueprintId}/print_providers/${PRODUCT.providerId}/variants.json`)
  const allVariants = varRes.variants || []

  const selectedVariants = allVariants.filter(v => {
    const color = (v.options?.color || '').toLowerCase()
    return PRODUCT.colorFilter.some(c => color.includes(c.toLowerCase()))
  })

  console.log(`  Total: ${allVariants.length}, Selected: ${selectedVariants.length}`)
  for (const v of selectedVariants.slice(0, 6)) console.log(`    ${v.id}: ${v.title}`)

  if (!selectedVariants.length) { console.error('No variants!'); process.exit(1) }

  if (DRY_RUN) {
    console.log(`\n  [DRY RUN] Would create with ${selectedVariants.length} variants @ EUR ${(PRODUCT.priceCents/100).toFixed(2)}`)
    process.exit(0)
  }

  // ── Step 3: Create product ─────────────────────────────────────────────
  console.log('\nStep 3: Creating product...\n')

  const placeholders = designs.map(d => ({
    position: d.position,
    images: [{ id: uploads.get(d.position), x: 0.5, y: 0.5, scale: 1, angle: 0 }],
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

  // ── Step 4: Publish ────────────────────────────────────────────────────
  await delay(1000)
  await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('  Published')

  // ── Step 5: Save to Supabase ───────────────────────────────────────────
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

    try {
      await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publishing_succeeded.json`, {
        method: 'POST',
        body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } }),
      })
    } catch { /* non-fatal */ }

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
    await delay(5000)
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

  console.log('\n  SYNAPSE v2 CREATED')
  console.log(`  Price: EUR ${(PRODUCT.priceCents/100).toFixed(2)}`)
  console.log(`  Variants: ${selectedVariants.length}`)
  console.log(`  Colors: 5 thread (Black, Blue, Coral, Amber, Teal)`)
  console.log(`  Placements: 4`)
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
