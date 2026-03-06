/**
 * GPU Apparel — Hoodie + Tee with NVIDIA-style Logo
 *
 * Takes the GPU eye+text design from the bucket hat and adapts it
 * for DTG apparel: 4500×5400 portrait canvas, logo centered at chest height.
 *
 * Products:
 *   1. GPU — Pullover Hoodie (BP 793, Provider 410) → 44.99€
 *   2. GPU — Premium Cotton Tee (BP 6, Provider 103) → 24.99€
 *
 * Colors: Black, White, Navy + extras per product
 * Sizes: S through 3XL
 *
 * Usage:
 *   node scripts/create-gpu-apparel.mjs --preview
 *   node scripts/create-gpu-apparel.mjs
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

// ─── SVG: GPU logo adapted for apparel (4500×5400, chest-centered) ──────────
// The logo from the bucket hat (1200×720) scaled 2.67x and centered at ~30% height.
// Green #76B900 on transparent — prints well on both dark and light garments.
function svgGpuApparel() {
  const GREEN = '#76B900'
  return `<svg width="4500" height="5400" viewBox="0 0 4500 5400" xmlns="http://www.w3.org/2000/svg">
  <!-- GPU logo scaled 2.67x from 1200×720, centered at chest height -->
  <g transform="translate(648, 659) scale(2.67)">
    <!-- NVIDIA-style eye, scaled 3.3x from original paths -->
    <g transform="translate(40, -467.31) scale(3.3)" fill="${GREEN}">
      <path d="M53.09,236.88v-8.56c0.84,0,1.68-0.14,2.53-0.14c23.29-0.7,38.59,20.06,38.59,20.06
        s-16.56,23.01-34.24,23.01c-2.53,0-4.77-0.42-6.88-1.12v-25.82c9.12,1.12,10.94,5.05,16.42,14.17l12.21-10.24
        c0,0-8.84-11.65-23.85-11.65C56.17,236.6,54.63,236.74,53.09,236.88"/>
      <path d="M53.09,208.81v12.77c0.84,0,1.68-0.14,2.53-0.14
        c32.41-1.12,53.6,26.66,53.6,26.66s-24.27,29.47-49.53,29.47c-2.39,0-4.49-0.28-6.59-0.56v7.86c1.68,0.28,3.51,0.42,5.47,0.42
        c23.57,0,40.55-12.07,57.11-26.24c2.67,2.24,13.89,7.58,16.28,9.82c-15.71,13.05-52.2,23.71-72.96,23.71
        c-1.96,0-3.93-0.14-5.75-0.28v11.08h89.52v-94.43H53.09V208.81z"/>
      <path d="M53.09,270.13v6.73c-21.75-3.93-27.78-26.52-27.78-26.52
        s10.38-11.65,27.78-13.47v7.44l0,0c-9.12-1.12-16.28,7.44-16.28,7.44S40.88,266.06,53.09,270.13"/>
      <path d="M14.5,249.37
        c0,0,12.91-19.08,38.73-21.05v-6.88c-28.48,2.24-53.18,26.52-53.18,26.52s14.03,40.41,53.18,44.2v-7.3
        C24.32,281.08,14.5,249.37,14.5,249.37z"/>
    </g>
    <!-- GPU text -->
    <text x="560" y="445"
      text-anchor="start"
      font-family="Futura" font-weight="bold" font-size="240"
      fill="${GREEN}" letter-spacing="12">GPU</text>
  </g>
</svg>`
}

// ─── SVG to PNG ──────────────────────────────────────────────────────────────
async function svgToPng(svgString, width, height, darkBg = false) {
  const rendered = sharp(Buffer.from(svgString))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
  if (!darkBg) return rendered.toBuffer()
  const overlay = await rendered.toBuffer()
  return sharp({ create: { width, height, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 255 } } })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer()
}

// ─── Product definitions ─────────────────────────────────────────────────────
const PRODUCTS = [
  {
    name: 'GPU',
    subtitle: 'Pullover Hoodie',
    blueprintId: 793,
    providerId: 410,
    priceCents: 4499,
    colorFilter: ['Black', 'White', 'Navy Blazer', 'Charcoal Heather'],
    category: 'hoodies',
    tags: ['hoodie', 'pullover', 'GPU', 'graphics', 'developer', 'gaming', 'nvidia', 'streetwear', '2026'],
    desc: {
      en: 'GPU — Premium pullover hoodie. Green eye logo on front. For developers who worship their graphics cards.',
      es: 'GPU — Hoodie pullover premium. Logo ojo verde en el frente. Para devs que adoran sus tarjetas gráficas.',
      de: 'GPU — Premium Pullover Hoodie. Grünes Augen-Logo vorne. Für Devs die ihre Grafikkarten verehren.',
    },
  },
  {
    name: 'GPU',
    subtitle: 'Premium Cotton Tee',
    blueprintId: 6,
    providerId: 103,
    priceCents: 2499,
    colorFilter: ['Black', 'White', 'Dark Heather', 'Navy'],
    category: 't-shirts',
    tags: ['tshirt', 'cotton', 'GPU', 'graphics', 'developer', 'gaming', 'nvidia', 'streetwear', '2026'],
    desc: {
      en: 'GPU — Premium cotton tee. Green eye logo centered on chest. The dev\'s daily uniform.',
      es: 'GPU — Camiseta premium de algodón. Logo ojo verde centrado en pecho. El uniforme diario del dev.',
      de: 'GPU — Premium Baumwoll-T-Shirt. Grünes Augen-Logo auf der Brust. Die Dev-Uniform.',
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  GPU Apparel — Hoodie + Tee (NVIDIA-style)')
  console.log('='.repeat(55) + '\n')

  const dir = '/tmp/gpu-apparel'
  mkdirSync(dir, { recursive: true })

  // Render design
  const svg = svgGpuApparel()
  writeFileSync(`${dir}/gpu-apparel.svg`, svg)

  const png = await svgToPng(svg, 4500, 5400, false)
  writeFileSync(`${dir}/gpu-apparel.png`, png)
  console.log(`  Design: ${(png.length/1024).toFixed(0)} KB (4500×5400)`)

  const darkPng = await svgToPng(svg, 4500, 5400, true)
  writeFileSync(`${dir}/gpu-apparel-dark.png`, darkPng)
  console.log(`  Dark preview: ${dir}/gpu-apparel-dark.png`)

  // Also save a small preview for quick viewing
  const previewPng = await svgToPng(svg, 900, 1080, true)
  writeFileSync(`${dir}/gpu-apparel-preview.png`, previewPng)
  console.log(`  Small preview: ${dir}/gpu-apparel-preview.png`)

  if (PREVIEW) {
    console.log('\n  *** PREVIEW MODE — done ***')
    return
  }

  // Upload design (once, reuse for both products)
  await delay(2000)
  const upload = await api('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: 'gpu-apparel-v1.png', contents: png.toString('base64') }),
  })
  console.log(`\n  Upload ID: ${upload.id}\n`)

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`  [${idx+1}/2] ${product.name} — ${product.subtitle}`)

    // Get variants
    await delay(2000)
    const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
    const allVariants = varRes.variants || []

    let selected = allVariants.filter(v => {
      const c = (v.options?.color || v.title || '').toLowerCase()
      return product.colorFilter.some(f => c.includes(f.toLowerCase()))
    })
    if (!selected.length) selected = allVariants

    const colors = [...new Set(selected.map(v => v.options?.color || '?'))]
    const sizes = [...new Set(selected.map(v => v.options?.size || '?'))]
    console.log(`    ${colors.length} colors: ${colors.join(', ')}`)
    console.log(`    ${sizes.length} sizes: ${sizes.join(', ')}`)
    console.log(`    ${selected.length} total variants`)

    // Create product
    await delay(2000)
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
          placeholders: [{ position: 'front', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
        }],
        tags: product.tags,
      }),
    })
    console.log(`    Printify: ${prod.id}`)

    // Publish
    await delay(1500)
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
      method: 'POST', body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    })

    // Save to Supabase
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', product.category).single()
    const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
      title: `${product.name} — ${product.subtitle}`,
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
        es: { title: `${product.name} — ${product.subtitle}`, description: product.desc.es },
        de: { title: `${product.name} — ${product.subtitle}`, description: product.desc.de },
      },
    }).select('id').single()

    if (dbErr) { console.error(`    DB: ${dbErr.message}`); continue }
    console.log(`    Supabase: ${dbProd.id}`)

    try { await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
      method: 'POST', body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } })
    }) } catch {}

    // Save variants
    for (const sv of selected) {
      const parts = sv.title.split('/').map(p => p.trim())
      await supabase.from('product_variants').upsert({
        product_id: dbProd.id, printify_variant_id: String(sv.id), title: sv.title,
        color: parts[0] || sv.options?.color || 'Default',
        size: parts[1] || sv.options?.size || 'One size',
        price_cents: product.priceCents, is_enabled: true, is_available: true,
      }, { onConflict: 'product_id,printify_variant_id' })
    }

    // Sync mockup images
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
  console.log('  GPU APPAREL COMPLETE')
  console.log('='.repeat(55))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
