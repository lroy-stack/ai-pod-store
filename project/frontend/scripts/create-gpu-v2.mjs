/**
 * GPU v2 — Bucket Hat with NVIDIA-style Logo Parody
 *
 * Design: NVIDIA eye symbol + "GPU" in bold geometric type.
 * All in NVIDIA green (#76B900) on transparent (for dark hats).
 * The joke: it looks like NVIDIA but says GPU. Instant recognition.
 *
 * Blueprint: 1910 (Bucket Hat), Provider: 99
 * Print area: 5.5"×2" → 1200×720 canvas
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

// Old GPU to delete
const OLD_GPU = {
  printifyId: '69a238459f7e893e8a0dd6c9',
  supabaseId: '87abce1d-285f-4c8d-aefb-309e33c87786',
}

// ─── SVG: NVIDIA-style eye + "GPU" text ─────────────────────────────────────
// Eye paths extracted from NVIDIA logo, scaled 3.8x and positioned left.
// "GPU" in Futura Bold at matching scale, positioned right.
// All in NVIDIA green #76B900.
function svgGpu() {
  const GREEN = '#76B900'
  return `<svg width="1200" height="720" viewBox="0 0 1200 720" xmlns="http://www.w3.org/2000/svg">
  <!-- NVIDIA-style eye, scaled 3.3x -->
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
  <!-- GPU in geometric bold, NVIDIA typography style -->
  <text x="560" y="445"
    text-anchor="start"
    font-family="Futura" font-weight="bold" font-size="240"
    fill="${GREEN}" letter-spacing="12">GPU</text>
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

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  GPU v2 — NVIDIA-style Logo Parody (Bucket Hat)')
  console.log('='.repeat(55) + '\n')

  const dir = '/tmp/gpu-v2'
  mkdirSync(dir, { recursive: true })

  // Render design
  const svg = svgGpu()
  writeFileSync(`${dir}/gpu.svg`, svg)
  const png = await svgToPng(svg, false)
  writeFileSync(`${dir}/gpu.png`, png)
  console.log(`  ${(png.length/1024).toFixed(0)} KB -> ${dir}/gpu.png`)

  const darkPng = await svgToPng(svg, true)
  writeFileSync(`${dir}/gpu-dark.png`, darkPng)
  console.log(`  dark -> ${dir}/gpu-dark.png`)

  if (PREVIEW) {
    console.log('\n  *** PREVIEW MODE — done ***')
    return
  }

  // Phase 1: Delete old GPU
  console.log('\n  Deleting old GPU...')
  try {
    await fetch(`${API}/shops/${SHOP_ID}/products/${OLD_GPU.printifyId}.json`, { method: 'DELETE', headers: hdrs })
    console.log(`    Printify ${OLD_GPU.printifyId} deleted`)
  } catch (e) { console.log(`    Printify delete: ${e.message}`) }

  await supabase.from('product_variants').delete().eq('product_id', OLD_GPU.supabaseId)
  await supabase.from('products').delete().eq('id', OLD_GPU.supabaseId)
  console.log(`    Supabase ${OLD_GPU.supabaseId} deleted`)

  await delay(3000)

  // Phase 2: Upload design
  const upload = await api('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: 'hat-gpu-v2.png', contents: png.toString('base64') }),
  })
  console.log(`    Upload: ${upload.id}`)

  await delay(3000)

  // Phase 3: Get variants (bucket hat BP 1910, provider 99)
  const varRes = await api('/catalog/blueprints/1910/print_providers/99/variants.json')
  const colorFilter = ['Black', 'Navy', 'Dark Grey', 'Olive', 'Khaki']
  let selected = (varRes.variants || []).filter(v => {
    const c = (v.options?.color || v.title || '').toLowerCase()
    return colorFilter.some(f => c.includes(f.toLowerCase()))
  })
  if (!selected.length) selected = varRes.variants || []
  console.log(`    ${selected.length} variants`)

  await delay(3000)

  // Phase 4: Create product on Printify
  const prod = await api(`/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'GPU — Embroidered Bucket Hat',
      description: 'GPU — Embroidered bucket hat. Green-on-dark logo with eye symbol. The ultimate dev flex for GPU enthusiasts.',
      blueprint_id: 1910,
      print_provider_id: 99,
      variants: selected.map(v => ({ id: v.id, price: 2999, is_enabled: true })),
      print_areas: [{
        variant_ids: selected.map(v => v.id),
        placeholders: [{ position: 'front', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
      }],
      tags: ['bucket hat', 'embroidered', 'GPU', 'graphics', 'developer', 'meme', 'gaming', 'streetwear', '2026'],
    }),
  })
  console.log(`    Printify: ${prod.id}`)

  await delay(2000)
  await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
    method: 'POST', body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })

  // Phase 5: Save to Supabase
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', 'hats').single()
  const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
    title: 'GPU', description: 'GPU — Embroidered bucket hat. Green-on-dark eye logo. The ultimate dev flex.',
    printify_id: prod.id, blueprint_id: 1910, print_provider_id: 99,
    category_id: cat?.id, status: 'active', currency: 'EUR',
    base_price_cents: 2999, tags: ['bucket hat', 'embroidered', 'GPU', 'graphics', 'developer', 'meme', 'gaming', 'streetwear', '2026'],
    published_at: new Date().toISOString(), last_synced_at: new Date().toISOString(),
    translations: {
      es: { title: 'GPU', description: 'GPU — Bucket hat bordado. Logo ojo verde sobre oscuro. El flex definitivo para devs.' },
      de: { title: 'GPU', description: 'GPU — Bestickter Bucket Hat. Gruenes Augen-Logo auf Dunkel. Der ultimative Dev-Flex.' },
    },
  }).select('id').single()

  if (dbErr) { console.error(`    DB: ${dbErr.message}`); return }
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
      price_cents: 2999, is_enabled: true, is_available: true,
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

  console.log('\n' + '='.repeat(55))
  console.log('  GPU v2 COMPLETE')
  console.log('='.repeat(55))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
