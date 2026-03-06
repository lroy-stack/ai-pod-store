/**
 * SKAPARA Hats v3 — Solid Embroidery-Optimized Text Designs
 *
 * Key difference from v2 (block pixels):
 *   - Letters built from LARGE solid rects + polygons (2-6 shapes per letter)
 *   - NOT grids of small blocks — each shape is continuous and thick
 *   - All strokes ≥0.1" at print scale — well above Printify's 0.05" minimum
 *   - Max 4 thread colors per design
 *
 * 1. "VIBE CODED" — Beanie (BP 1691) — White + Pink, two-line stack
 * 2. "PROMPT ME"  — Cap (BP 1744) — Green chevron + White + Pink
 * 3. "NPC"        — Bucket Hat (BP 1910) — Giant tricolor letters
 *
 * Usage:
 *   node scripts/create-hats-v3.mjs --preview   (render PNGs locally)
 *   node scripts/create-hats-v3.mjs             (create on Printify + Supabase)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const PREVIEW = process.argv.includes('--preview')
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

// ─── Thread Colors (close to Printify's 15-color Madeira palette) ────────────
const WHITE     = '#FFFFFF'
const HOT_PINK  = '#FF1493'
const GOLD      = '#FFD700'
const GREEN     = '#00AA00'
const ROYAL     = '#2222FF'

// ─── Solid Letter Renderer ──────────────────────────────────────────────────
// Each letter defined at 100×140 reference grid, stroke width ~28.
// Shapes are LARGE solid rects and polygons — no tiny details.
// Scale and position via parameters.

function solidLetter(ch, x, y, sc, color) {
  const r = (rx, ry, rw, rh) =>
    `<rect x="${(x + rx * sc).toFixed(1)}" y="${(y + ry * sc).toFixed(1)}" width="${(rw * sc).toFixed(1)}" height="${(rh * sc).toFixed(1)}" fill="${color}"/>`
  const p = (...pts) => {
    const pairs = []
    for (let i = 0; i < pts.length; i += 2)
      pairs.push(`${(x + pts[i] * sc).toFixed(1)},${(y + pts[i + 1] * sc).toFixed(1)}`)
    return `<polygon points="${pairs.join(' ')}" fill="${color}"/>`
  }

  switch (ch) {
    case 'V': return [
      p(0, 0, 32, 0, 56, 140, 44, 140),       // left leg
      p(68, 0, 100, 0, 56, 140, 44, 140),      // right leg
    ].join('\n')
    case 'I': return [
      r(0, 0, 100, 28),                         // top bar
      r(36, 0, 28, 140),                         // spine
      r(0, 112, 100, 28),                        // bottom bar
    ].join('\n')
    case 'B': return [
      r(0, 0, 28, 140),                          // left spine
      r(0, 0, 78, 28),                           // top bar
      r(0, 56, 78, 28),                          // mid bar
      r(0, 112, 78, 28),                         // bottom bar
      r(72, 0, 28, 84),                          // right top
      r(72, 56, 28, 84),                         // right bottom
    ].join('\n')
    case 'E': return [
      r(0, 0, 28, 140),                          // spine
      r(0, 0, 100, 28),                          // top bar
      r(0, 56, 72, 28),                          // mid bar
      r(0, 112, 100, 28),                        // bottom bar
    ].join('\n')
    case 'C': return [
      r(0, 0, 28, 140),                          // spine
      r(0, 0, 100, 28),                          // top bar
      r(0, 112, 100, 28),                        // bottom bar
    ].join('\n')
    case 'O': return [
      r(0, 0, 100, 28),                          // top
      r(0, 112, 100, 28),                        // bottom
      r(0, 0, 28, 140),                          // left
      r(72, 0, 28, 140),                         // right
    ].join('\n')
    case 'D': return [
      r(0, 0, 28, 140),                          // spine
      r(0, 0, 80, 28),                           // top
      r(0, 112, 80, 28),                         // bottom
      r(72, 0, 28, 140),                         // right
    ].join('\n')
    case 'N': return [
      r(0, 0, 28, 140),                          // left spine
      r(72, 0, 28, 140),                         // right spine
      p(0, 0, 32, 0, 100, 108, 100, 140, 68, 140, 0, 32), // diagonal
    ].join('\n')
    case 'P': return [
      r(0, 0, 28, 140),                          // spine
      r(0, 0, 80, 28),                           // top
      r(0, 56, 80, 28),                          // mid
      r(72, 0, 28, 84),                          // right bowl
    ].join('\n')
    case 'R': return [
      r(0, 0, 28, 140),                          // spine
      r(0, 0, 80, 28),                           // top
      r(0, 56, 80, 28),                          // mid
      r(72, 0, 28, 84),                          // right bowl
      p(48, 84, 78, 84, 100, 140, 70, 140),     // diagonal leg
    ].join('\n')
    case 'M': return [
      r(0, 0, 28, 140),                          // left spine
      r(72, 0, 28, 140),                         // right spine
      p(0, 0, 30, 0, 58, 65, 42, 65),           // left peak
      p(70, 0, 100, 0, 58, 65, 42, 65),         // right peak
    ].join('\n')
    case 'T': return [
      r(0, 0, 100, 28),                          // top bar
      r(36, 0, 28, 140),                         // spine
    ].join('\n')
    default: return ''
  }
}

function solidWord(word, x, y, letterW, spacing, colors) {
  const sc = letterW / 100
  let svg = ''
  for (let i = 0; i < word.length; i++) {
    const color = Array.isArray(colors) ? colors[i % colors.length] : colors
    svg += solidLetter(word[i], x + i * (letterW + spacing), y, sc, color) + '\n'
  }
  return svg
}

function wordWidth(word, letterW, spacing) {
  return word.length * letterW + (word.length - 1) * spacing
}

// ─── Design 1: VIBE CODED (Beanie 1200×720) ────────────────────────────────
// Beanie area: 5" × 1.75". Two-line stack with hierarchy.
// "VIBE" large in white, "CODED" slightly smaller in hot pink.
// Gold accent dot between lines.
function svgVibeCoded() {
  // Line 1: "VIBE" — large
  const lw1 = 170, sp1 = 36
  const w1 = wordWidth('VIBE', lw1, sp1)
  const x1 = (1200 - w1) / 2
  const h1 = 140 * (lw1 / 100) // 238px
  const y1 = 80

  // Line 2: "CODED" — slightly smaller
  const lw2 = 130, sp2 = 28
  const w2 = wordWidth('CODED', lw2, sp2)
  const x2 = (1200 - w2) / 2
  const h2 = 140 * (lw2 / 100) // 182px
  const y2 = y1 + h1 + 60

  // Gold accent bar between lines
  const barW = 100
  const barX = (1200 - barW) / 2

  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${solidWord('VIBE', x1, y1, lw1, sp1, WHITE)}
<rect x="${barX}" y="${y1 + h1 + 20}" width="${barW}" height="18" rx="9" fill="${GOLD}"/>
${solidWord('CODED', x2, y2, lw2, sp2, HOT_PINK)}
</svg>`
}

// ─── Design 2: PROMPT ME (Cap 1200×720) ──────────────────────────────────────
// Cap area: 4" × 2.25". Terminal-style layout.
// Line 1: ">" green + "PROMPT" white, all on same baseline
// Line 2: "ME" big in pink, centered
function svgPromptMe() {
  // Line 1: ">" chevron + "PROMPT" on same line
  const chevronH = 160  // chevron height
  const chevronW = 110  // chevron width
  const y1 = 60

  // ">" as solid triangle
  const cx = 80
  const chevron = `<polygon points="${cx},${y1} ${cx + chevronW},${y1 + chevronH / 2} ${cx},${y1 + chevronH}" fill="${GREEN}"/>`

  // "PROMPT" after chevron, same vertical center
  const lw1 = 115, sp1 = 20
  const letterH1 = 140 * (lw1 / 100) // 161px
  const promptX = cx + chevronW + 30
  const promptY = y1 + (chevronH - letterH1) / 2

  // Gold cursor after PROMPT
  const w1 = wordWidth('PROMPT', lw1, sp1)
  const cursorX = promptX + w1 + 12
  const cursorY = promptY + letterH1 - 40
  const cursor = `<rect x="${cursorX}" y="${cursorY}" width="40" height="35" rx="4" fill="${GOLD}"/>`

  // Line 2: "ME" centered, bigger
  const lw2 = 180, sp2 = 40
  const w2 = wordWidth('ME', lw2, sp2)
  const x2 = (1200 - w2) / 2
  const y2 = y1 + chevronH + 80

  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${chevron}
${solidWord('PROMPT', promptX, promptY, lw1, sp1, WHITE)}
${cursor}
${solidWord('ME', x2, y2, lw2, sp2, HOT_PINK)}
</svg>`
}

// ─── Design 3: NPC (Bucket 1200×720) ─────────────────────────────────────────
// Bucket area: 5.5" × 2". Three giant letters, each a different color.
function svgNpc() {
  const lw = 280, sp = 60
  const totalW = wordWidth('NPC', lw, sp)
  const ox = (1200 - totalW) / 2
  const letterH = 140 * (lw / 100) // 392px
  const oy = (720 - letterH) / 2

  const colors = [HOT_PINK, GOLD, ROYAL]

  // White dot accent below
  const dotY = oy + letterH + 35

  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${solidWord('NPC', ox, oy, lw, sp, colors)}
<circle cx="600" cy="${dotY}" r="20" fill="${WHITE}"/>
</svg>`
}

// ─── SVG to PNG ──────────────────────────────────────────────────────────────
async function svgToPng(svgString, darkPreview = false) {
  const rendered = sharp(Buffer.from(svgString))
    .resize(1200, 720, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()

  if (!darkPreview) return rendered.toBuffer()

  // Composite SVG over dark background for preview
  const overlay = await rendered.toBuffer()
  return sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 255 } } })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer()
}

// ─── Products ────────────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    name: 'Vibe Coded',
    subtitle: 'Embroidered Beanie',
    blueprintId: 1691,
    providerId: 99,
    priceCents: 2499,
    colorFilter: ['Black', 'Navy', 'Dark Grey', 'Olive', 'Spruce', 'Brown', 'Red', 'Royal', 'Gold'],
    svg: svgVibeCoded,
    position: 'front',
    category: 'hats',
    tags: ['beanie', 'embroidered', 'vibe coded', 'meme', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'Vibe Coded — Embroidered cuffed beanie. Bold solid-stitch VIBE in white with CODED in hot pink. Gold accent. Programmer streetwear.',
      es: 'Vibe Coded — Beanie bordado. VIBE en blanco con CODED en rosa fuerte, acento dorado. Streetwear programador.',
      de: 'Vibe Coded — Bestickte Beanie. VIBE in Weiss, CODED in Pink, Gold-Akzent. Programmierer Streetwear.',
    },
  },
  {
    name: 'Prompt Me',
    subtitle: 'Embroidered Cap',
    blueprintId: 1744,
    providerId: 99,
    priceCents: 2999,
    colorFilter: ['Black', 'Dark Navy', 'Dark Grey', 'Khaki', 'Olive', 'White', 'Grey', 'Red'],
    svg: svgPromptMe,
    position: 'front',
    category: 'hats',
    tags: ['cap', 'embroidered', 'prompt', 'AI', 'meme', 'tech', 'terminal', 'streetwear', '2026'],
    desc: {
      en: 'Prompt Me — Embroidered structured cap. Terminal-style with bold green chevron, white text, and pink accent. AI era streetwear.',
      es: 'Prompt Me — Gorra bordada. Estilo terminal con chevron verde, texto blanco y acento rosa. Streetwear era AI.',
      de: 'Prompt Me — Bestickte Kappe. Terminal-Stil mit gruenem Chevron, weissem Text und Pink-Akzent. AI-Ara Streetwear.',
    },
  },
  {
    name: 'NPC',
    subtitle: 'Embroidered Bucket Hat',
    blueprintId: 1910,
    providerId: 410,
    priceCents: 2999,
    colorFilter: ['Black', 'Navy', 'White'],
    svg: svgNpc,
    position: 'front',
    category: 'hats',
    tags: ['bucket hat', 'embroidered', 'NPC', 'meme', 'gaming', 'streetwear', '2026'],
    desc: {
      en: 'NPC — Embroidered bucket hat. Giant tricolor block letters — pink N, gold P, blue C. Internet culture meets streetwear.',
      es: 'NPC — Bucket hat bordado. Letras gigantes tricolor — N rosa, P dorada, C azul. Cultura internet meets streetwear.',
      de: 'NPC — Bestickter Bucket Hat. Riesige dreifarbige Blockbuchstaben — N Pink, P Gold, C Blau. Internetkultur trifft Streetwear.',
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  HATS v3 — Solid Embroidery Text Designs')
  console.log('='.repeat(55) + '\n')
  if (PREVIEW) console.log('  *** PREVIEW MODE ***\n')

  const dir = '/tmp/hats-v3'
  mkdirSync(dir, { recursive: true })

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`  [${idx + 1}/3] ${product.name} — ${product.subtitle}`)

    const svg = product.svg()
    const slug = product.name.toLowerCase().replace(/ /g, '-')
    writeFileSync(`${dir}/${slug}.svg`, svg)

    // Preview with dark bg (to see white text), production with transparent
    const png = await svgToPng(svg, false)
    writeFileSync(`${dir}/${slug}.png`, png)
    console.log(`    ${(png.length / 1024).toFixed(0)} KB -> ${dir}/${slug}.png`)

    if (PREVIEW) {
      // Also render dark preview to see white elements
      const darkPng = await svgToPng(svg, true)
      writeFileSync(`${dir}/${slug}-dark.png`, darkPng)
      console.log(`    dark preview -> ${dir}/${slug}-dark.png`)
      continue
    }

    // Upload image
    await delay(3000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: `hat-${slug}.png`, contents: png.toString('base64') }),
    })
    console.log(`    Upload: ${upload.id}`)

    // Get variants
    await delay(3000)
    const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
    const selected = (varRes.variants || []).filter(v => {
      const c = (v.options?.color || v.title || '').toLowerCase()
      return product.colorFilter.some(f => c.includes(f.toLowerCase()))
    })
    if (!selected.length) selected.push(...(varRes.variants || []))
    console.log(`    ${selected.length} variants`)

    // Create product
    await delay(3000)
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

    // Publish
    await delay(2000)
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
      method: 'POST',
      body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    })

    // Supabase
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
    console.log(`    Supabase: ${dbProd.id}`)

    try {
      await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
        method: 'POST',
        body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } }),
      })
    } catch {}

    // Variants in Supabase
    for (const sv of selected) {
      const parts = sv.title.split('/').map(p => p.trim())
      await supabase.from('product_variants').upsert({
        product_id: dbProd.id,
        printify_variant_id: String(sv.id),
        title: sv.title,
        color: parts[0] || sv.options?.color || 'Default',
        size: parts[1] || sv.options?.size || 'One size',
        price_cents: product.priceCents,
        is_enabled: true,
        is_available: true,
      }, { onConflict: 'product_id,printify_variant_id' })
    }

    // Sync mockups
    await delay(5000)
    try {
      const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
      const imgs = (details?.images || [])
        .filter(i => !i.src.includes('size-chart'))
        .slice(0, 6)
        .map(i => i.src)
      if (imgs.length) {
        await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
        console.log(`    ${imgs.length} mockups`)
      }
    } catch {}

    console.log(`    DONE\n`)
  }

  console.log('='.repeat(55))
  console.log('  HATS v3 COMPLETE')
  console.log('='.repeat(55))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
