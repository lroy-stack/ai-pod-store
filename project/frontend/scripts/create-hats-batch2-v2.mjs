/**
 * SKAPARA Hats Batch 2 v2 — Real Typography + Creative Compositions
 *
 * Design principles:
 *   - Real fonts (Futura Bold + Courier for contrast)
 *   - Monochrome per design (all white — thread color)
 *   - Scale contrast (huge word + tiny annotation)
 *   - Font mixing (geometric sans + monospace = tension)
 *   - Product-specific: beanie (wide/narrow) vs cap (balanced)
 *
 * Beanies (BP 1691, 5"×1.75" — wide strip):
 *   1. DARK MODE — "DARK" massive + "mode" tiny right-aligned
 *   2. IT WORKS — Terminal: "it" whisper + "WORKS" triumph
 *
 * Caps (BP 1744, 4"×2.25" — more square):
 *   3. AI WROTE THIS — "AI" fills 80% + "wrote this" footnote
 *   4. FRIDAY DEPLOY — "FRIDAY" bold + "$ deploy --force" monospace
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

// ─── Design 1: DARK MODE (Beanie — 1200×720 → 5"×1.75") ────────────────────
// Composition: "DARK" massive Futura Bold filling the width.
//              "mode" small Helvetica Neue, right-aligned underneath — whispered.
//              All white. Asymmetric. Premium minimalism.
function svgDarkMode() {
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
  <text x="600" y="420"
    text-anchor="middle"
    font-family="Futura" font-weight="bold" font-size="320"
    fill="white" letter-spacing="18">DARK</text>
  <text x="900" y="530"
    text-anchor="end"
    font-family="Helvetica Neue" font-weight="300" font-size="100"
    fill="white" letter-spacing="14">mode</text>
</svg>`
}

// ─── Design 2: IT WORKS (Beanie — 1200×720 → 5"×1.75") ─────────────────────
// Composition: "it" tiny Helvetica Light, lowercase, humble.
//              "WORKS" massive Futura Bold, uppercase, triumphant.
//              Side by side on one line — whisper-to-shout effect.
//              All white. The scale jump IS the joke.
function svgItWorks() {
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
  <text x="110" y="440"
    text-anchor="end"
    font-family="Helvetica Neue" font-weight="200" font-size="90"
    fill="white">it</text>
  <text x="130" y="450"
    text-anchor="start"
    font-family="Futura" font-weight="bold" font-size="240"
    fill="white" letter-spacing="10">WORKS</text>
</svg>`
}

// ─── Design 3: AI WROTE THIS (Cap — 1200×720 → 4"×2.25") ───────────────────
// Composition: "AI" absolutely massive, fills 70% of area.
//              "wrote this" tiny Courier monospace, centered below — like a credit.
//              All white. Scale contrast is dramatic — AI proud, context whispered.
function svgAiWroteThis() {
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
  <text x="600" y="410"
    text-anchor="middle"
    font-family="Futura" font-weight="bold" font-size="400"
    fill="white" letter-spacing="30">AI</text>
  <text x="600" y="530"
    text-anchor="middle"
    font-family="Courier" font-size="85"
    fill="white" letter-spacing="8">wrote this</text>
</svg>`
}

// ─── Design 4: FRIDAY DEPLOY (Cap — 1200×720 → 4"×2.25") ───────────────────
// Composition: "FRIDAY" big Futura Bold across top — the headline.
//              "$ deploy --force" small Courier underneath — the dangerous command.
//              Geometric beauty meets raw terminal. Tension.
//              All white.
function svgFridayDeploy() {
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
  <text x="600" y="340"
    text-anchor="middle"
    font-family="Futura" font-weight="bold" font-size="230"
    fill="white" letter-spacing="16">FRIDAY</text>
  <text x="600" y="480"
    text-anchor="middle"
    font-family="Courier" font-weight="bold" font-size="80"
    fill="white" letter-spacing="3">$ deploy --force</text>
</svg>`
}

// ─── SVG to PNG ──────────────────────────────────────────────────────────────
async function svgToPng(svgString, darkBg = false) {
  const rendered = sharp(Buffer.from(svgString))
    .resize(1200, 720, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
  if (!darkBg) return rendered.toBuffer()
  const overlay = await rendered.toBuffer()
  return sharp({ create: { width: 1200, height: 720, channels: 4, background: { r: 25, g: 25, b: 25, alpha: 255 } } })
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
    tags: ['beanie', 'embroidered', 'dark mode', 'developer', 'minimal', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'Dark Mode — Embroidered beanie. Bold typographic design with scale contrast. White thread on dark.',
      es: 'Dark Mode — Beanie bordado. Diseno tipografico bold con contraste de escala. Hilo blanco sobre oscuro.',
      de: 'Dark Mode — Bestickte Beanie. Typografisches Design mit Skalenkontrast. Weisser Faden auf Dunkel.',
    },
  },
  {
    name: 'It Works', subtitle: 'Embroidered Beanie',
    blueprintId: 1691, providerId: 99, priceCents: 2499,
    colorFilter: ['Black', 'Navy', 'Dark Grey', 'Olive', 'Spruce'],
    svg: svgItWorks, position: 'front', category: 'hats',
    tags: ['beanie', 'embroidered', 'it works', 'developer', 'meme', 'minimal', 'streetwear', '2026'],
    desc: {
      en: 'It Works — Embroidered beanie. Whisper-to-shout typography. The universal dev victory cry.',
      es: 'It Works — Beanie bordado. Tipografia susurro-a-grito. El grito de victoria universal del developer.',
      de: 'It Works — Bestickte Beanie. Fluestern-zu-Schrei Typografie. Der universelle Dev-Siegesruf.',
    },
  },
  {
    name: 'AI Wrote This', subtitle: 'Embroidered Cap',
    blueprintId: 1744, providerId: 99, priceCents: 2999,
    colorFilter: ['Black', 'Dark Navy', 'Dark Grey', 'Khaki', 'Olive', 'Grey'],
    svg: svgAiWroteThis, position: 'front', category: 'hats',
    tags: ['cap', 'embroidered', 'AI', 'wrote this', 'meme', 'trending', 'minimal', 'streetwear', '2026'],
    desc: {
      en: 'AI Wrote This — Embroidered cap. Massive AI with tiny credit. Self-aware humor, trending 2026.',
      es: 'AI Wrote This — Gorra bordada. AI masivo con credito diminuto. Humor autoconsciente, trending 2026.',
      de: 'AI Wrote This — Bestickte Kappe. Riesiges AI mit kleinem Credit. Selbstbewusster Humor, Trend 2026.',
    },
  },
  {
    name: 'Friday Deploy', subtitle: 'Embroidered Cap',
    blueprintId: 1744, providerId: 99, priceCents: 2999,
    colorFilter: ['Black', 'Dark Navy', 'Dark Grey', 'Khaki', 'Olive', 'Grey'],
    svg: svgFridayDeploy, position: 'front', category: 'hats',
    tags: ['cap', 'embroidered', 'friday deploy', 'developer', 'meme', 'terminal', 'streetwear', '2026'],
    desc: {
      en: 'Friday Deploy — Embroidered cap. Bold headline meets terminal command. The classic dev nightmare.',
      es: 'Friday Deploy — Gorra bordada. Titular bold + comando terminal. La pesadilla clasica del developer.',
      de: 'Friday Deploy — Bestickte Kappe. Fette Headline trifft Terminal-Befehl. Der klassische Dev-Albtraum.',
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  HATS BATCH 2 v2 — Real Typography + Compositions')
  console.log('='.repeat(55) + '\n')
  if (PREVIEW) console.log('  *** PREVIEW MODE ***\n')

  const dir = '/tmp/hats-b2v2'
  mkdirSync(dir, { recursive: true })

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`  [${idx+1}/4] ${product.name} — ${product.subtitle}`)

    const svg = product.svg()
    const slug = product.name.toLowerCase().replace(/ /g, '-')
    writeFileSync(`${dir}/${slug}.svg`, svg)

    const png = await svgToPng(svg, false)
    writeFileSync(`${dir}/${slug}.png`, png)
    console.log(`    ${(png.length/1024).toFixed(0)} KB -> ${dir}/${slug}.png`)

    if (PREVIEW) {
      const darkPng = await svgToPng(svg, true)
      writeFileSync(`${dir}/${slug}-dark.png`, darkPng)
      console.log(`    dark -> ${dir}/${slug}-dark.png`)
      continue
    }

    await delay(3000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: `hat-${slug}.png`, contents: png.toString('base64') }),
    })
    console.log(`    Upload: ${upload.id}`)

    await delay(3000)
    const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
    const selected = (varRes.variants || []).filter(v => {
      const c = (v.options?.color || v.title || '').toLowerCase()
      return product.colorFilter.some(f => c.includes(f.toLowerCase()))
    })
    if (!selected.length) selected.push(...(varRes.variants || []))
    console.log(`    ${selected.length} variants`)

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
          placeholders: [{ position: product.position, images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
        }],
        tags: product.tags,
      }),
    })
    console.log(`    Printify: ${prod.id}`)

    await delay(2000)
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
      method: 'POST', body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    })

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

    console.log(`    DONE\n`)
  }

  console.log('='.repeat(55))
  console.log('  BATCH 2 v2 COMPLETE')
  console.log('='.repeat(55))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
