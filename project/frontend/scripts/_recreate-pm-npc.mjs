/**
 * Re-create Prompt Me (cap) and NPC (bucket) — accidentally deleted.
 * Identical to create-hats-text.mjs but skips Vibe Coded.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN   = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL  = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY  = env('SUPABASE_SERVICE_KEY')
const supabase = createClient(SB_URL, SB_KEY)
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...headers, ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

const PINK   = '#EC4899'
const ORANGE = '#F97316'
const TEAL   = '#14B8A6'
const VIOLET = '#8B5CF6'
const BLACK  = '#0F172A'

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
  const lw = 3*bw + 2*gap
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

function svgPromptMe() {
  const bw = 28, bh = 22, gap = 4, letterGap = 12
  const w1 = blockWordWidth('PROMPT', bw, gap, letterGap)
  const x1 = 180
  const y1 = 120
  const bw2 = 48, bh2 = 38, gap2 = 6, letterGap2 = 20
  const w2 = blockWordWidth('ME', bw2, gap2, letterGap2)
  const x2 = (750 - w2) / 2
  const y2 = 420
  return `<svg width="750" height="750" viewBox="0 0 750 750" xmlns="http://www.w3.org/2000/svg">
  <polygon points="40,160 150,250 40,340" fill="${PINK}"/>
${renderBlockWord('PROMPT', x1, y1, bw, bh, gap, letterGap, ORANGE)}
  <rect x="${x1}" y="360" width="80" height="20" rx="4" fill="${TEAL}"/>
${renderBlockWord('ME', x2, y2, bw2, bh2, gap2, letterGap2, VIOLET)}
  <circle cx="375" cy="690" r="22" fill="${BLACK}"/>
</svg>`
}

function svgNpc() {
  const bw = 55, bh = 42, gap = 8, letterGap = 30
  const totalW = blockWordWidth('NPC', bw, gap, letterGap)
  const ox = (600 - totalW) / 2
  const oy = (600 - (5*bh + 4*gap)) / 2
  const colors = [PINK, ORANGE, VIOLET]
  return `<svg width="600" height="600" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
${renderBlockWord('NPC', ox, oy, bw, bh, gap, letterGap, colors)}
  <circle cx="300" cy="${oy + 5*bh + 4*gap + 40}" r="20" fill="${BLACK}"/>
  <rect x="260" y="${oy + 5*bh + 4*gap + 75}" width="80" height="14" rx="7" fill="${TEAL}"/>
</svg>`
}

async function svgToPng(svgString, width, height) {
  return sharp(Buffer.from(svgString))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

const PRODUCTS = [
  {
    name: 'Prompt Me', subtitle: 'Embroidered Cap',
    blueprintId: 1744, providerId: 99, priceCents: 2999,
    colorFilter: ['Black', 'Dark Navy', 'Dark Grey', 'Royal Blue', 'Khaki', 'Olive', 'White', 'Grey', 'Red'],
    svg: svgPromptMe, svgW: 750, svgH: 750, position: 'front', category: 'hats',
    tags: ['cap', 'embroidered', 'prompt', 'AI', 'meme', 'tech', 'streetwear', '2026'],
    desc: {
      en: 'Prompt Me — Embroidered structured cap. Terminal-style typography with prompt symbol. AI era streetwear.',
      es: 'Prompt Me — Gorra estructurada bordada. Tipografia estilo terminal con simbolo de prompt. Streetwear era AI.',
      de: 'Prompt Me — Bestickte strukturierte Kappe. Terminal-Typografie mit Prompt-Symbol. AI-Ara Streetwear.',
    },
  },
  {
    name: 'NPC', subtitle: 'Embroidered Bucket Hat',
    blueprintId: 1910, providerId: 410, priceCents: 2999,
    colorFilter: ['Black', 'Navy', 'White'],
    svg: svgNpc, svgW: 600, svgH: 600, position: 'front', category: 'hats',
    tags: ['bucket hat', 'embroidered', 'NPC', 'meme', 'gaming', 'streetwear', '2026'],
    desc: {
      en: 'NPC — Embroidered bucket hat. Giant color-split block letters. Internet culture meets streetwear.',
      es: 'NPC — Bucket hat bordado. Letras gigantes en bloques de colores. Cultura internet meets streetwear.',
      de: 'NPC — Bestickter Bucket Hat. Riesige farbgeteilte Blockbuchstaben. Internetkultur trifft Streetwear.',
    },
  },
]

async function main() {
  console.log('Re-creating Prompt Me + NPC...\n')
  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`[${idx+1}/2] ${product.name} — ${product.subtitle}`)
    const svg = product.svg()
    const png = await svgToPng(svg, product.svgW, product.svgH)
    console.log(`  ${(png.length/1024).toFixed(0)} KB`)

    await delay(3000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: `hat-${product.name.toLowerCase().replace(/ /g,'-')}.png`, contents: png.toString('base64') }),
    })
    console.log(`  Upload: ${upload.id}`)

    await delay(3000)
    const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
    const selected = (varRes.variants || []).filter(v => {
      const c = (v.options?.color || v.title || '').toLowerCase()
      return product.colorFilter.some(f => c.includes(f.toLowerCase()))
    })
    if (!selected.length) selected.push(...(varRes.variants || []))
    console.log(`  ${selected.length} variants`)

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
    console.log(`  Printify: ${prod.id}`)

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

    if (dbErr) { console.error(`  DB: ${dbErr.message}`); continue }
    console.log(`  Supabase: ${dbProd.id}`)

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
        console.log(`  ${imgs.length} mockups`)
      }
    } catch {}
    console.log(`  DONE\n`)
  }
  console.log('Prompt Me + NPC re-created successfully!')
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
