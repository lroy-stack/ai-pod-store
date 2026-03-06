/**
 * SKAPARA Hats v4 — Fix for Vibe Coded (beanie) + Prompt Me (cap)
 *
 * Problem with v3: two-line stacked designs were too tall for the
 * wide/short embroidery areas (beanie 5"×1.75", cap 4"×2.25").
 *
 * Fix: SINGLE LINE horizontal layouts that fill the width.
 *   - "VIBE CODED" all on one line, letters sized for 1.75" height
 *   - ">PROMPT ME" all on one line, compact terminal style
 *
 * NPC v3 was fine — not touched here.
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

// ─── Colors ──────────────────────────────────────────────────────────────────
const WHITE     = '#FFFFFF'
const HOT_PINK  = '#FF1493'
const GOLD      = '#FFD700'
const GREEN     = '#00AA00'

// ─── Solid Letter Renderer (same as v3) ─────────────────────────────────────
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
    case 'V': return [p(0,0, 32,0, 56,140, 44,140), p(68,0, 100,0, 56,140, 44,140)].join('\n')
    case 'I': return [r(0,0,100,28), r(36,0,28,140), r(0,112,100,28)].join('\n')
    case 'B': return [r(0,0,28,140), r(0,0,78,28), r(0,56,78,28), r(0,112,78,28), r(72,0,28,84), r(72,56,28,84)].join('\n')
    case 'E': return [r(0,0,28,140), r(0,0,100,28), r(0,56,72,28), r(0,112,100,28)].join('\n')
    case 'C': return [r(0,0,28,140), r(0,0,100,28), r(0,112,100,28)].join('\n')
    case 'O': return [r(0,0,100,28), r(0,112,100,28), r(0,0,28,140), r(72,0,28,140)].join('\n')
    case 'D': return [r(0,0,28,140), r(0,0,80,28), r(0,112,80,28), r(72,0,28,140)].join('\n')
    case 'N': return [r(0,0,28,140), r(72,0,28,140), p(0,0, 32,0, 100,108, 100,140, 68,140, 0,32)].join('\n')
    case 'P': return [r(0,0,28,140), r(0,0,80,28), r(0,56,80,28), r(72,0,28,84)].join('\n')
    case 'R': return [r(0,0,28,140), r(0,0,80,28), r(0,56,80,28), r(72,0,28,84), p(48,84, 78,84, 100,140, 70,140)].join('\n')
    case 'M': return [r(0,0,28,140), r(72,0,28,140), p(0,0, 30,0, 58,65, 42,65), p(70,0, 100,0, 58,65, 42,65)].join('\n')
    case 'T': return [r(0,0,100,28), r(36,0,28,140)].join('\n')
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
// Beanie: 5" × 1.75" — very wide, short. SINGLE LINE.
// "VIBE" in white + dot separator + "CODED" in hot pink
// All on one horizontal line, centered vertically.
function svgVibeCoded() {
  // 9 letters total. Fill ~1100px width, ~340px height to stay in safe area.
  // "VIBE" in white
  const lw = 100, sp = 14  // compact spacing
  const wVibe = wordWidth('VIBE', lw, sp)
  const wCoded = wordWidth('CODED', lw, sp)
  const dotW = 24
  const gap = 30  // gap between VIBE [dot] CODED
  const totalW = wVibe + gap + dotW + gap + wCoded
  const ox = (1200 - totalW) / 2
  const letterH = 140 * (lw / 100)  // 140px
  const oy = (720 - letterH) / 2    // centered vertically

  // Gold dot separator
  const dotX = ox + wVibe + gap
  const dotY = oy + letterH / 2

  // CODED starts after dot
  const codedX = dotX + dotW + gap

  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${solidWord('VIBE', ox, oy, lw, sp, WHITE)}
<circle cx="${dotX + dotW / 2}" cy="${dotY}" r="${dotW / 2}" fill="${GOLD}"/>
${solidWord('CODED', codedX, oy, lw, sp, HOT_PINK)}
</svg>`
}

// ─── Design 2: PROMPT ME (Cap 1200×720) ──────────────────────────────────────
// Cap: 4" × 2.25" — wider than tall. SINGLE LINE.
// ">" green + "PROMPT ME" in white, cursor gold at end
function svgPromptMe() {
  // ">" triangle + 8 letters "PROMPTME" with space
  const lw = 90, sp = 12
  const chevronW = 80
  const chevronH = 140 * (lw / 100)  // 126px
  const wPrompt = wordWidth('PROMPT', lw, sp)
  const wMe = wordWidth('ME', lw, sp)
  const spaceW = 30  // space between PROMPT and ME
  const cursorW = 30
  const gapAfterChevron = 20
  const gapBeforeCursor = 10

  const totalW = chevronW + gapAfterChevron + wPrompt + spaceW + wMe + gapBeforeCursor + cursorW
  const ox = (1200 - totalW) / 2
  const oy = (720 - chevronH) / 2

  const chevronX = ox
  const chevron = `<polygon points="${chevronX},${oy} ${chevronX + chevronW},${oy + chevronH / 2} ${chevronX},${oy + chevronH}" fill="${GREEN}"/>`

  const promptX = chevronX + chevronW + gapAfterChevron
  const meX = promptX + wPrompt + spaceW
  const cursorX = meX + wMe + gapBeforeCursor
  const cursorY = oy + chevronH - 28
  const cursor = `<rect x="${cursorX}" y="${cursorY}" width="${cursorW}" height="24" rx="3" fill="${GOLD}"/>`

  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${chevron}
${solidWord('PROMPT', promptX, oy, lw, sp, WHITE)}
${solidWord('ME', meX, oy, lw, sp, HOT_PINK)}
${cursor}
</svg>`
}

// ─── SVG to PNG ──────────────────────────────────────────────────────────────
async function svgToPng(svgString, darkPreview = false) {
  const rendered = sharp(Buffer.from(svgString))
    .resize(1200, 720, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()

  if (!darkPreview) return rendered.toBuffer()

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
      en: 'Vibe Coded — Embroidered cuffed beanie. VIBE in white, CODED in pink, gold dot accent. Programmer streetwear.',
      es: 'Vibe Coded — Beanie bordado. VIBE blanco, CODED rosa, acento dorado. Streetwear programador.',
      de: 'Vibe Coded — Bestickte Beanie. VIBE weiss, CODED pink, Gold-Akzent. Programmierer Streetwear.',
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
      en: 'Prompt Me — Embroidered cap. Terminal-style green chevron, white PROMPT, pink ME, gold cursor. AI era.',
      es: 'Prompt Me — Gorra bordada. Chevron verde terminal, PROMPT blanco, ME rosa, cursor dorado. Era AI.',
      de: 'Prompt Me — Bestickte Kappe. Terminal-Chevron gruen, PROMPT weiss, ME pink, Gold-Cursor. AI-Ara.',
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  HATS v4 — Single-Line Fix (Vibe Coded + Prompt Me)')
  console.log('='.repeat(55) + '\n')
  if (PREVIEW) console.log('  *** PREVIEW MODE ***\n')

  const dir = '/tmp/hats-v4'
  mkdirSync(dir, { recursive: true })

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`  [${idx + 1}/2] ${product.name} — ${product.subtitle}`)

    const svg = product.svg()
    const slug = product.name.toLowerCase().replace(/ /g, '-')
    writeFileSync(`${dir}/${slug}.svg`, svg)

    const png = await svgToPng(svg, false)
    writeFileSync(`${dir}/${slug}.png`, png)
    console.log(`    ${(png.length / 1024).toFixed(0)} KB -> ${dir}/${slug}.png`)

    if (PREVIEW) {
      const darkPng = await svgToPng(svg, true)
      writeFileSync(`${dir}/${slug}-dark.png`, darkPng)
      console.log(`    dark preview -> ${dir}/${slug}-dark.png`)
      continue
    }

    // Upload
    await delay(3000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: `hat-${slug}.png`, contents: png.toString('base64') }),
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

    // Sync mockups
    await delay(5000)
    try {
      const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
      const imgs = (details?.images || []).filter(i => !i.src.includes('size-chart')).slice(0, 6).map(i => i.src)
      if (imgs.length) {
        await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
        console.log(`    ${imgs.length} mockups`)
      }
    } catch {}

    console.log(`    DONE\n`)
  }

  console.log('='.repeat(55))
  console.log('  HATS v4 COMPLETE')
  console.log('='.repeat(55))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
