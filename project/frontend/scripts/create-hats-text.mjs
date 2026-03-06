/**
 * SKAPARA Hats Collection v2 — Text/Typography Embroidered Hats
 *
 * 1. "VIBE CODED" — Beanie (BP 1691) — Block/pixel letters
 * 2. "PROMPT ME"  — Cap (BP 1744) — Bold prompt style
 * 3. "NPC"        — Bucket Hat (BP 1910) — Color-split giant letters
 *
 * All text built from SVG primitives (rect, polygon, circle)
 * NO font dependency — guaranteed perfect render
 *
 * Usage:
 *   node scripts/create-hats-text.mjs --preview
 *   node scripts/create-hats-text.mjs --dry-run
 *   node scripts/create-hats-text.mjs
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

// ─── Colors ──────────────────────────────────────────────────────────────────
const PINK   = '#EC4899'
const ORANGE = '#F97316'
const TEAL   = '#14B8A6'
const VIOLET = '#8B5CF6'
const BLACK  = '#0F172A'

// ─── Block Letter Engine ─────────────────────────────────────────────────────
// Each letter defined as 5×3 grid (same system as digits in Origin)

const LETTER_GRIDS = {
  V: [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
  I: [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
  B: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  E: [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,1,1]],
  C: [[1,1,1],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
  O: [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  D: [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
  N: [[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
  P: [[1,1,1],[1,0,1],[1,1,1],[1,0,0],[1,0,0]],
  R: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
  M: [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
  T: [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
}

function renderBlockLetter(ch, ox, oy, bw, bh, gap, color) {
  const grid = LETTER_GRIDS[ch]
  if (!grid) return ''
  let rects = ''
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c]) {
        rects += `  <rect x="${ox + c*(bw+gap)}" y="${oy + r*(bh+gap)}" width="${bw}" height="${bh}" rx="4" fill="${color}"/>\n`
      }
    }
  }
  return rects
}

function renderBlockWord(word, ox, oy, bw, bh, gap, letterGap, colors) {
  let x = ox
  const lw = 3*bw + 2*gap // letter width
  let svg = ''
  for (let i = 0; i < word.length; i++) {
    const color = Array.isArray(colors) ? colors[i % colors.length] : colors
    svg += renderBlockLetter(word[i], x, oy, bw, bh, gap, color)
    x += lw + letterGap
  }
  return svg
}

function blockWordWidth(word, bw, gap, letterGap) {
  const lw = 3*bw + 2*gap
  return word.length * lw + (word.length - 1) * letterGap
}

// ─── Design 1: "VIBE CODED" — Block pixel letters for beanie ────────────────
// Beanie cuff: ~4"×2.5" = 1200×750px
function svgVibeCoded() {
  const bw = 38, bh = 30, gap = 5, letterGap = 18

  // Line 1: "VIBE" in pink/orange
  const w1 = blockWordWidth('VIBE', bw, gap, letterGap)
  const x1 = (1200 - w1) / 2
  const y1 = 80
  const colors1 = [PINK, ORANGE, PINK, ORANGE]

  // Line 2: "CODED" in teal/violet
  const w2 = blockWordWidth('CODED', bw, gap, letterGap)
  const x2 = (1200 - w2) / 2
  const y2 = 380
  const colors2 = [TEAL, VIOLET, TEAL, VIOLET, TEAL]

  // Accent bar between lines
  const barW = Math.max(w1, w2) + 40
  const barX = (1200 - barW) / 2

  return `<svg width="1200" height="750" viewBox="0 0 1200 750" xmlns="http://www.w3.org/2000/svg">
  <!-- VIBE -->
${renderBlockWord('VIBE', x1, y1, bw, bh, gap, letterGap, colors1)}
  <!-- Accent bar -->
  <rect x="${barX}" y="320" width="${barW}" height="25" rx="12" fill="${BLACK}"/>
  <!-- CODED -->
${renderBlockWord('CODED', x2, y2, bw, bh, gap, letterGap, colors2)}
  <!-- Small accent dots -->
  <circle cx="${barX + 20}" cy="700" r="12" fill="${PINK}"/>
  <circle cx="${barX + barW - 20}" cy="700" r="12" fill="${TEAL}"/>
</svg>`
}

// ─── Design 2: "PROMPT ME" — Bold prompt style for cap ──────────────────────
// Cap front: ~2.5"×2.5" = 750×750px
function svgPromptMe() {
  const bw = 28, bh = 22, gap = 4, letterGap = 12

  // ">" triangle (prompt symbol) — large, pink
  // Then "PROMPT" in block letters line 1
  // "ME" in block letters line 2 (larger)

  const w1 = blockWordWidth('PROMPT', bw, gap, letterGap)
  const x1 = 180 // after the ">" triangle
  const y1 = 120

  // "ME" larger
  const bw2 = 48, bh2 = 38, gap2 = 6, letterGap2 = 20
  const w2 = blockWordWidth('ME', bw2, gap2, letterGap2)
  const x2 = (750 - w2) / 2
  const y2 = 420

  return `<svg width="750" height="750" viewBox="0 0 750 750" xmlns="http://www.w3.org/2000/svg">
  <!-- ">" prompt triangle — hot pink -->
  <polygon points="40,160 150,250 40,340" fill="${PINK}"/>

  <!-- "PROMPT" in block letters — orange -->
${renderBlockWord('PROMPT', x1, y1, bw, bh, gap, letterGap, ORANGE)}

  <!-- Underscore/cursor blink — teal -->
  <rect x="${x1}" y="360" width="80" height="20" rx="4" fill="${TEAL}"/>

  <!-- "ME" in bigger block letters — violet -->
${renderBlockWord('ME', x2, y2, bw2, bh2, gap2, letterGap2, VIOLET)}

  <!-- Bottom accent circle -->
  <circle cx="375" cy="690" r="22" fill="${BLACK}"/>
</svg>`
}

// ─── Design 3: "NPC" — Giant color-split letters for bucket ─────────────────
// Bucket front: ~2"×2" = 600×600px
function svgNpc() {
  // Giant block letters, each a different color
  const bw = 55, bh = 42, gap = 8, letterGap = 30

  const totalW = blockWordWidth('NPC', bw, gap, letterGap)
  const ox = (600 - totalW) / 2
  const oy = (600 - (5*bh + 4*gap)) / 2

  const colors = [PINK, ORANGE, VIOLET]

  return `<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
  <!-- N P C — each letter a different color -->
${renderBlockWord('NPC', ox, oy, bw, bh, gap, letterGap, colors)}

  <!-- Black accent dot below -->
  <circle cx="300" cy="${oy + 5*bh + 4*gap + 40}" r="20" fill="${BLACK}"/>

  <!-- Small teal bar under dot -->
  <rect x="260" y="${oy + 5*bh + 4*gap + 75}" width="80" height="14" rx="7" fill="${TEAL}"/>
</svg>`
}

// ─── SVG to PNG ──────────────────────────────────────────────────────────────
async function svgToPng(svgString, width, height) {
  return sharp(Buffer.from(svgString))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
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
    colorFilter: ['Black', 'Navy', 'Dark Grey', 'Olive', 'White', 'Spruce', 'Brown', 'Red', 'Royal', 'Gold'],
    svg: svgVibeCoded,
    svgW: 1200, svgH: 750,
    position: 'front',
    category: 'hats',
    tags: ['beanie', 'embroidered', 'vibe', 'coded', 'meme', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'Vibe Coded — Embroidered cuffed beanie. Block-pixel typography in bold pink, orange, teal, and violet. Vibe coding era.',
      es: 'Vibe Coded — Beanie bordado. Tipografia pixel en rosa, naranja, teal y violeta. Era del vibe coding.',
      de: 'Vibe Coded — Bestickte Beanie. Pixel-Typografie in Pink, Orange, Teal und Violett. Vibe Coding Ara.',
    },
  },
  {
    name: 'Prompt Me',
    subtitle: 'Embroidered Cap',
    blueprintId: 1744,
    providerId: 99,
    priceCents: 2999,
    colorFilter: ['Black', 'Dark Navy', 'Dark Grey', 'Royal Blue', 'Khaki', 'Olive', 'White', 'Grey', 'Red'],
    svg: svgPromptMe,
    svgW: 750, svgH: 750,
    position: 'front',
    category: 'hats',
    tags: ['cap', 'embroidered', 'prompt', 'AI', 'meme', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'Prompt Me — Embroidered structured cap. Terminal-style typography with prompt symbol. AI era streetwear.',
      es: 'Prompt Me — Gorra estructurada bordada. Tipografia estilo terminal con simbolo de prompt. Streetwear era AI.',
      de: 'Prompt Me — Bestickte strukturierte Kappe. Terminal-Typografie mit Prompt-Symbol. AI-Ara Streetwear.',
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
    svgW: 600, svgH: 600,
    position: 'front',
    category: 'hats',
    tags: ['bucket hat', 'embroidered', 'NPC', 'meme', 'gaming', 'streetwear', '2026'],
    desc: {
      en: 'NPC — Embroidered bucket hat. Giant color-split block letters. Internet culture meets streetwear.',
      es: 'NPC — Bucket hat bordado. Letras gigantes en bloques de colores. Cultura internet meets streetwear.',
      de: 'NPC — Bestickter Bucket Hat. Riesige farbgeteilte Blockbuchstaben. Internetkultur trifft Streetwear.',
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  HATS v2 — Text/Typography Collection')
  console.log('='.repeat(55) + '\n')
  if (PREVIEW) console.log('  *** PREVIEW MODE ***\n')
  if (DRY_RUN) console.log('  *** DRY RUN ***\n')

  const previewDir = '/tmp/hats-text'
  mkdirSync(previewDir, { recursive: true })

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`\n  [${idx+1}/3] ${product.name} — ${product.subtitle}`)

    const svg = product.svg()
    writeFileSync(`${previewDir}/${product.name.toLowerCase().replace(/ /g,'-')}.svg`, svg)
    const png = await svgToPng(svg, product.svgW, product.svgH)
    writeFileSync(`${previewDir}/${product.name.toLowerCase().replace(/ /g,'-')}.png`, png)
    console.log(`    ${(png.length/1024).toFixed(0)} KB -> ${previewDir}/${product.name.toLowerCase().replace(/ /g,'-')}.png`)

    if (PREVIEW) continue

    // Upload
    await delay(3000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: `hat-${product.name.toLowerCase().replace(/ /g,'-')}.png`, contents: png.toString('base64') }),
    })
    console.log(`    Upload: ${upload.id}`)

    // Variants
    await delay(3000)
    const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
    const selected = (varRes.variants || []).filter(v => {
      const c = (v.options?.color || v.title || '').toLowerCase()
      return product.colorFilter.some(f => c.includes(f.toLowerCase()))
    })
    if (!selected.length) selected.push(...(varRes.variants || []))
    console.log(`    ${selected.length} variants`)

    if (DRY_RUN) { console.log(`    [DRY] EUR ${(product.priceCents/100).toFixed(2)}`); continue }

    // Create
    await delay(3000)
    const prod = await api(`/shops/${SHOP_ID}/products.json`, {
      method: 'POST',
      body: JSON.stringify({
        title: `${product.name} — ${product.subtitle}`,
        description: product.desc.en,
        blueprint_id: product.blueprintId,
        print_provider_id: product.providerId,
        variants: selected.map(v => ({ id: v.id, price: product.priceCents, is_enabled: true })),
        print_areas: [{ variant_ids: selected.map(v => v.id), placeholders: [{
          position: product.position,
          images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
        }] }],
        tags: product.tags,
      }),
    })
    console.log(`    Printify: ${prod.id}`)

    await delay(2000)
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
      method: 'POST', body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    })

    // Supabase
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', product.category).single()
    const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
      title: product.name, description: product.desc.en, printify_id: prod.id,
      blueprint_id: product.blueprintId, print_provider_id: product.providerId,
      category_id: cat?.id, status: 'active', currency: 'EUR',
      base_price_cents: product.priceCents, tags: product.tags,
      published_at: new Date().toISOString(), last_synced_at: new Date().toISOString(),
      translations: {
        es: { title: product.name, description: product.desc.es },
        de: { title: product.name, description: product.desc.de },
      },
    }).select('id').single()

    if (dbErr) { console.error(`    DB: ${dbErr.message}`); continue }
    console.log(`    Supabase: ${dbProd.id}`)

    try { await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
      method: 'POST', body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } })
    }) } catch {}

    for (const sv of selected) {
      const parts = sv.title.split('/').map(p => p.trim())
      await supabase.from('product_variants').upsert({
        product_id: dbProd.id, printify_variant_id: String(sv.id), title: sv.title,
        color: parts[0] || sv.options?.color || 'Default',
        size: parts[1] || sv.options?.size || 'One size',
        price_cents: product.priceCents, is_enabled: true, is_available: true,
      }, { onConflict: 'product_id,printify_variant_id' })
    }

    await delay(5000)
    try {
      const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
      const imgs = (details?.images || []).filter(i => !i.src.includes('size-chart')).slice(0, 6).map(i => i.src)
      if (imgs.length) {
        await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
        console.log(`    ${imgs.length} mockups`)
      }
    } catch {}

    console.log(`    DONE`)
  }

  console.log('\n' + '='.repeat(55))
  console.log('  TEXT HATS COMPLETE')
  console.log('='.repeat(55))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
