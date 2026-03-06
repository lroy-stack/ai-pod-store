/**
 * SKAPARA Hats Batch 2 — 6 Trending AI/Coding Embroidered Hats
 *
 * Beanies (BP 1691, 5"×1.75"):
 *   1. DARK MODE  — White monochrome + green LED dot
 *   2. IT WORKS   — Terminal green (success)
 *
 * Caps (BP 1744, 4"×2.25"):
 *   3. AI WROTE THIS — Teal "AI" + White "WROTE" + Purple "THIS"
 *   4. FRIDAY DEPLOY — Red "FRIDAY" + Gold "DEPLOY"
 *
 * Bucket Hats (BP 1910, 5.5"×2"):
 *   5. GPT — Giant tricolor: G=teal, P=purple, T=white
 *   6. GPU — Giant all green (Nvidia vibes)
 *
 * All single-line horizontal layouts. Solid shapes only.
 *
 * Usage:
 *   node scripts/create-hats-batch2.mjs --preview
 *   node scripts/create-hats-batch2.mjs
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
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs, ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// ─── Thread Colors ───────────────────────────────────────────────────────────
const WHITE  = '#FFFFFF'
const GREEN  = '#00AA00'
const TEAL   = '#008080'
const PURPLE = '#800080'
const RED    = '#DD0000'
const GOLD   = '#FFD700'

// ─── Solid Letter Renderer ──────────────────────────────────────────────────
// Each letter at 100×140 reference. Stroke ~28. Rects + polygons only.

function solidLetter(ch, x, y, sc, color) {
  const rc = (rx, ry, rw, rh) =>
    `<rect x="${(x+rx*sc).toFixed(1)}" y="${(y+ry*sc).toFixed(1)}" width="${(rw*sc).toFixed(1)}" height="${(rh*sc).toFixed(1)}" fill="${color}"/>`
  const pg = (...pts) => {
    const pairs = []
    for (let i = 0; i < pts.length; i += 2)
      pairs.push(`${(x+pts[i]*sc).toFixed(1)},${(y+pts[i+1]*sc).toFixed(1)}`)
    return `<polygon points="${pairs.join(' ')}" fill="${color}"/>`
  }

  switch (ch) {
    // ── Existing letters ──
    case 'V': return [pg(0,0,32,0,56,140,44,140), pg(68,0,100,0,56,140,44,140)].join('\n')
    case 'I': return [rc(0,0,100,28), rc(36,0,28,140), rc(0,112,100,28)].join('\n')
    case 'B': return [rc(0,0,28,140), rc(0,0,78,28), rc(0,56,78,28), rc(0,112,78,28), rc(72,0,28,84), rc(72,56,28,84)].join('\n')
    case 'E': return [rc(0,0,28,140), rc(0,0,100,28), rc(0,56,72,28), rc(0,112,100,28)].join('\n')
    case 'C': return [rc(0,0,28,140), rc(0,0,100,28), rc(0,112,100,28)].join('\n')
    case 'O': return [rc(0,0,100,28), rc(0,112,100,28), rc(0,0,28,140), rc(72,0,28,140)].join('\n')
    case 'D': return [rc(0,0,28,140), rc(0,0,80,28), rc(0,112,80,28), rc(72,0,28,140)].join('\n')
    case 'N': return [rc(0,0,28,140), rc(72,0,28,140), pg(0,0,32,0,100,108,100,140,68,140,0,32)].join('\n')
    case 'P': return [rc(0,0,28,140), rc(0,0,80,28), rc(0,56,80,28), rc(72,0,28,84)].join('\n')
    case 'R': return [rc(0,0,28,140), rc(0,0,80,28), rc(0,56,80,28), rc(72,0,28,84), pg(48,84,78,84,100,140,70,140)].join('\n')
    case 'M': return [rc(0,0,28,140), rc(72,0,28,140), pg(0,0,30,0,58,65,42,65), pg(70,0,100,0,58,65,42,65)].join('\n')
    case 'T': return [rc(0,0,100,28), rc(36,0,28,140)].join('\n')

    // ── New letters ──
    case 'A': return [
      pg(0,140, 24,140, 56,0, 44,0),     // left leg
      pg(76,140, 100,140, 56,0, 44,0),    // right leg
      rc(16, 82, 68, 26),                  // crossbar
    ].join('\n')
    case 'F': return [
      rc(0,0, 28,140),                     // spine
      rc(0,0, 100,28),                     // top bar
      rc(0,56, 72,28),                     // mid bar
    ].join('\n')
    case 'G': return [
      rc(0,0, 28,140),                     // left spine
      rc(0,0, 100,28),                     // top bar
      rc(0,112, 100,28),                   // bottom bar
      rc(72,56, 28,84),                    // right arm (bottom half)
      rc(50,56, 50,28),                    // mid shelf
    ].join('\n')
    case 'H': return [
      rc(0,0, 28,140),                     // left spine
      rc(72,0, 28,140),                    // right spine
      rc(0,56, 100,28),                    // crossbar
    ].join('\n')
    case 'K': return [
      rc(0,0, 28,140),                     // spine
      pg(28,84, 28,56, 100,0, 100,28),    // upper diagonal
      pg(28,56, 28,84, 100,112, 100,140), // lower diagonal
    ].join('\n')
    case 'L': return [
      rc(0,0, 28,140),                     // spine
      rc(0,112, 100,28),                   // bottom bar
    ].join('\n')
    case 'S': return [
      rc(0,0, 100,28),                     // top bar
      rc(0,0, 28,84),                      // left spine (top half)
      rc(0,56, 100,28),                    // mid bar
      rc(72,56, 28,84),                    // right spine (bottom half)
      rc(0,112, 100,28),                   // bottom bar
    ].join('\n')
    case 'U': return [
      rc(0,0, 28,140),                     // left spine
      rc(72,0, 28,140),                    // right spine
      rc(0,112, 100,28),                   // bottom bar
    ].join('\n')
    case 'W': return [
      rc(0,0, 28,140),                     // left spine
      rc(72,0, 28,140),                    // right spine
      pg(0,140, 30,140, 58,75, 42,75),    // left inner diagonal (bottom→center)
      pg(70,140, 100,140, 58,75, 42,75),  // right inner diagonal (bottom→center)
    ].join('\n')
    case 'Y': return [
      pg(0,0, 28,0, 58,65, 42,65),        // left upper diagonal
      pg(72,0, 100,0, 58,65, 42,65),      // right upper diagonal
      rc(36,65, 28,75),                    // lower spine
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

// ─── Phrase Renderer (auto-sizes single line to fill width) ─────────────────
function renderPhrase(words, targetW = 1080) {
  const totalChars = words.reduce((s, w) => s + w.text.length, 0)
  const numSpaces = words.length - 1
  // lw * (totalChars + (totalChars-1)*0.14 + numSpaces*0.4) = targetW
  const factor = totalChars + (totalChars - 1) * 0.14 + numSpaces * 0.4
  const lw = Math.floor(targetW / factor)
  const sp = Math.max(4, Math.floor(lw * 0.14))
  const wordGap = Math.floor(lw * 0.4)
  const letterH = Math.floor(140 * (lw / 100))

  let actualW = 0
  for (let i = 0; i < words.length; i++) {
    actualW += wordWidth(words[i].text, lw, sp)
    if (i < words.length - 1) actualW += wordGap
  }

  const ox = Math.floor((1200 - actualW) / 2)
  const oy = Math.floor((720 - letterH) / 2)

  let svg = '', cx = ox
  for (let i = 0; i < words.length; i++) {
    svg += solidWord(words[i].text, cx, oy, lw, sp, words[i].color) + '\n'
    cx += wordWidth(words[i].text, lw, sp)
    if (i < words.length - 1) cx += wordGap
  }

  return { svg, lw, letterH, ox, oy, actualW }
}

// ─── Design Functions ────────────────────────────────────────────────────────

function svgDarkMode() {
  const { svg, ox, actualW, oy, letterH } = renderPhrase([
    { text: 'DARK', color: WHITE },
    { text: 'MODE', color: WHITE },
  ])
  const dotX = ox + actualW + 18
  const dotY = oy + letterH - 14
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${svg}
<circle cx="${dotX}" cy="${dotY}" r="10" fill="${GREEN}"/>
</svg>`
}

function svgItWorks() {
  const { svg } = renderPhrase([
    { text: 'IT', color: GREEN },
    { text: 'WORKS', color: GREEN },
  ])
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${svg}
</svg>`
}

function svgAiWroteThis() {
  const { svg } = renderPhrase([
    { text: 'AI', color: TEAL },
    { text: 'WROTE', color: WHITE },
    { text: 'THIS', color: PURPLE },
  ])
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${svg}
</svg>`
}

function svgFridayDeploy() {
  const { svg } = renderPhrase([
    { text: 'FRIDAY', color: RED },
    { text: 'DEPLOY', color: GOLD },
  ])
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${svg}
</svg>`
}

function svgGpt() {
  const lw = 280, sp = 60
  const totalW = wordWidth('GPT', lw, sp)
  const ox = (1200 - totalW) / 2
  const letterH = Math.floor(140 * (lw / 100))
  const oy = Math.floor((720 - letterH) / 2)
  const colors = [TEAL, PURPLE, WHITE]
  const dotY = oy + letterH + 30
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${solidWord('GPT', ox, oy, lw, sp, colors)}
<circle cx="600" cy="${dotY}" r="16" fill="${GOLD}"/>
</svg>`
}

function svgGpu() {
  const lw = 280, sp = 60
  const totalW = wordWidth('GPU', lw, sp)
  const ox = (1200 - totalW) / 2
  const letterH = Math.floor(140 * (lw / 100))
  const oy = Math.floor((720 - letterH) / 2)
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
${solidWord('GPU', ox, oy, lw, sp, GREEN)}
</svg>`
}

// ─── SVG to PNG ──────────────────────────────────────────────────────────────
async function svgToPng(svgString, darkBg = false) {
  const rendered = sharp(Buffer.from(svgString))
    .resize(1200, 720, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
  if (!darkBg) return rendered.toBuffer()
  const overlay = await rendered.toBuffer()
  return sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 255 } } })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer()
}

// ─── Products ────────────────────────────────────────────────────────────────
const PRODUCTS = [
  {
    name: 'Dark Mode', subtitle: 'Embroidered Beanie',
    blueprintId: 1691, providerId: 99, priceCents: 2499,
    colorFilter: ['Black', 'Navy', 'Dark Grey', 'Olive', 'Spruce'],
    svg: svgDarkMode, position: 'front', category: 'hats',
    tags: ['beanie', 'embroidered', 'dark mode', 'developer', 'coding', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'Dark Mode — Embroidered beanie. Clean white text with green power LED accent. Developer identity.',
      es: 'Dark Mode — Beanie bordado. Texto blanco limpio con acento LED verde. Identidad developer.',
      de: 'Dark Mode — Bestickte Beanie. Weisser Text mit gruenem LED-Akzent. Entwickler-Identitaet.',
    },
  },
  {
    name: 'It Works', subtitle: 'Embroidered Beanie',
    blueprintId: 1691, providerId: 99, priceCents: 2499,
    colorFilter: ['Black', 'Navy', 'Dark Grey', 'Olive', 'Spruce'],
    svg: svgItWorks, position: 'front', category: 'hats',
    tags: ['beanie', 'embroidered', 'it works', 'developer', 'meme', 'coding', 'streetwear', '2026'],
    desc: {
      en: 'It Works — Embroidered beanie. Terminal green text. The universal developer victory cry.',
      es: 'It Works — Beanie bordado. Texto verde terminal. El grito de victoria universal del developer.',
      de: 'It Works — Bestickte Beanie. Terminal-gruener Text. Der universelle Entwickler-Siegesruf.',
    },
  },
  {
    name: 'AI Wrote This', subtitle: 'Embroidered Cap',
    blueprintId: 1744, providerId: 99, priceCents: 2999,
    colorFilter: ['Black', 'Dark Navy', 'Dark Grey', 'Khaki', 'Olive', 'Grey'],
    svg: svgAiWroteThis, position: 'front', category: 'hats',
    tags: ['cap', 'embroidered', 'AI', 'wrote this', 'meme', 'trending', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'AI Wrote This — Embroidered cap. Teal, white and purple. Self-aware AI era humor, trending 2026.',
      es: 'AI Wrote This — Gorra bordada. Teal, blanco y purpura. Humor autoconsciente de la era AI, trending 2026.',
      de: 'AI Wrote This — Bestickte Kappe. Teal, weiss und lila. Selbstbewusster AI-Ara Humor, Trend 2026.',
    },
  },
  {
    name: 'Friday Deploy', subtitle: 'Embroidered Cap',
    blueprintId: 1744, providerId: 99, priceCents: 2999,
    colorFilter: ['Black', 'Dark Navy', 'Dark Grey', 'Khaki', 'Olive', 'Grey'],
    svg: svgFridayDeploy, position: 'front', category: 'hats',
    tags: ['cap', 'embroidered', 'friday deploy', 'developer', 'meme', 'coding', 'streetwear', '2026'],
    desc: {
      en: 'Friday Deploy — Embroidered cap. Red and gold warning colors. The classic dev nightmare meme.',
      es: 'Friday Deploy — Gorra bordada. Rojo y dorado de advertencia. El meme clasico del nightmare developer.',
      de: 'Friday Deploy — Bestickte Kappe. Rot und Gold Warnfarben. Das klassische Entwickler-Albtraum-Meme.',
    },
  },
  {
    name: 'GPT', subtitle: 'Embroidered Bucket Hat',
    blueprintId: 1910, providerId: 410, priceCents: 2999,
    colorFilter: ['Black', 'Navy', 'White'],
    svg: svgGpt, position: 'front', category: 'hats',
    tags: ['bucket hat', 'embroidered', 'GPT', 'AI', 'trending', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'GPT — Embroidered bucket hat. Giant tricolor letters: teal G, purple P, white T. The AI era icon.',
      es: 'GPT — Bucket hat bordado. Letras tricolor gigantes: G teal, P purpura, T blanco. Icono de la era AI.',
      de: 'GPT — Bestickter Bucket Hat. Riesige dreifarbige Buchstaben: G Teal, P Lila, T Weiss. AI-Ara Ikone.',
    },
  },
  {
    name: 'GPU', subtitle: 'Embroidered Bucket Hat',
    blueprintId: 1910, providerId: 410, priceCents: 2999,
    colorFilter: ['Black', 'Navy', 'White'],
    svg: svgGpu, position: 'front', category: 'hats',
    tags: ['bucket hat', 'embroidered', 'GPU', 'AI', 'nvidia', 'hardware', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'GPU — Embroidered bucket hat. Giant green letters. AI hardware obsession, Nvidia energy.',
      es: 'GPU — Bucket hat bordado. Letras gigantes verdes. Obsesion hardware AI, energia Nvidia.',
      de: 'GPU — Bestickter Bucket Hat. Riesige gruene Buchstaben. AI-Hardware-Obsession, Nvidia-Energie.',
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  HATS BATCH 2 — Trending AI/Coding (6 products)')
  console.log('='.repeat(55) + '\n')
  if (PREVIEW) console.log('  *** PREVIEW MODE ***\n')

  const dir = '/tmp/hats-batch2'
  mkdirSync(dir, { recursive: true })

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`  [${idx+1}/6] ${product.name} — ${product.subtitle}`)

    const svg = product.svg()
    const slug = product.name.toLowerCase().replace(/ /g, '-')
    writeFileSync(`${dir}/${slug}.svg`, svg)

    const png = await svgToPng(svg, false)
    writeFileSync(`${dir}/${slug}.png`, png)
    console.log(`    ${(png.length/1024).toFixed(0)} KB -> ${dir}/${slug}.png`)

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
  console.log('  BATCH 2 COMPLETE')
  console.log('='.repeat(55))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
