/**
 * SKAPARA Branded Fixes v3 — Final 3 corrections
 * 1. SNEAKERS: Smaller S mark (~30% panel), refined placement
 * 2. DESK MAT: Dark background (#1C1C1C) for sublimation
 * 3. LONG SLEEVE: Expand to 6 dark colors with full size ranges
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const SVG_DIR = join(ROOT, 'public', 'brand')
const SVG = {
  markWhite: join(SVG_DIR, 'skapara-mark-white.svg'),
  markDark:  join(SVG_DIR, 'skapara-mark-dark.svg'),
}

const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const API = 'https://api.printify.com/v1'
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(path, opts = {}) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API}${path}`, { ...opts, headers: { ...hdrs, ...opts.headers } })
    if (r.status === 429) {
      const wait = 20000 * (i + 1)
      console.log(`    ⏳ Rate limited, waiting ${wait / 1000}s...`)
      await delay(wait)
      continue
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
    const ct = r.headers.get('content-type') || ''
    return ct.includes('json') ? r.json() : null
  }
  throw new Error('Rate limit exceeded after 4 retries')
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. SNEAKERS — Smaller S mark, refined placement
// ═══════════════════════════════════════════════════════════════════════════
async function fixSneakers() {
  console.log('\n' + '─'.repeat(60))
  console.log('  1/3  SNEAKERS — Smaller S, refined placement')
  console.log('─'.repeat(60))

  const { data: [sneaker] } = await sb.from('products')
    .select('id, printify_id').ilike('title', '%SKAPARA Step%').limit(1)
  if (!sneaker) { console.log('  Not found'); return }
  console.log(`  ${sneaker.printify_id}`)

  const markSvg = readFileSync(SVG.markDark, 'utf8')

  // Body outside: S at 30% height, positioned center-right like a swoosh
  async function bodyDesign(w, h) {
    const mH = Math.round(h * 0.35)
    const mW = Math.round(mH * (1431 / 1100))
    const buf = await sharp(Buffer.from(markSvg))
      .resize(mW, mH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer()
    return sharp({
      create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite([{
      input: buf,
      left: Math.round((w - mW) / 2),     // horizontally centered
      top: Math.round((h - mH) / 2),       // vertically centered
    }]).png().toBuffer()
  }

  // Tongue: S at 35% width, centered
  async function tongueDesign() {
    const W = 945, H = 1220
    const mW = Math.round(W * 0.35)
    const mH = Math.round(mW * (1100 / 1431))
    const buf = await sharp(Buffer.from(markSvg))
      .resize(mW, mH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer()
    return sharp({
      create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite([{
      input: buf,
      left: Math.round((W - mW) / 2),
      top: Math.round((H - mH) / 2),
    }]).png().toBuffer()
  }

  // Generate all 6 designs
  const body1 = await bodyDesign(1434, 650)
  const body2 = await bodyDesign(1433, 649)
  const tongue = await tongueDesign()

  // Upload 3 unique images (body L, body R, tongue) — reuse for inside/outside
  console.log('  Uploading designs...')
  const upBody1 = await api('/uploads/images.json', {
    method: 'POST', body: JSON.stringify({ file_name: 'sk-sneaker-body1.png', contents: body1.toString('base64') })
  })
  await delay(3000)
  const upBody2 = await api('/uploads/images.json', {
    method: 'POST', body: JSON.stringify({ file_name: 'sk-sneaker-body2.png', contents: body2.toString('base64') })
  })
  await delay(3000)
  const upTongue = await api('/uploads/images.json', {
    method: 'POST', body: JSON.stringify({ file_name: 'sk-sneaker-tongue.png', contents: tongue.toString('base64') })
  })
  console.log(`  Uploads: body1=${upBody1.id}, body2=${upBody2.id}, tongue=${upTongue.id}`)

  // Get variants
  await delay(3000)
  const varRes = await api('/catalog/blueprints/767/print_providers/90/variants.json')
  const vs = varRes.variants || []

  // Update product with 6 print areas
  await delay(3000)
  await api(`/shops/${SHOP}/products/${sneaker.printify_id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      print_areas: [{
        variant_ids: vs.map(v => v.id),
        placeholders: [
          { position: 'body_outside_left',  images: [{ id: upBody1.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_outside_right', images: [{ id: upBody2.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_inside_left',   images: [{ id: upBody2.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_inside_right',  images: [{ id: upBody1.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'tongue_left',        images: [{ id: upTongue.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'tongue_right',       images: [{ id: upTongue.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
        ],
      }],
    }),
  })
  console.log('  Product updated')

  // Publish
  await delay(3000)
  await api(`/shops/${SHOP}/products/${sneaker.printify_id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('  Published')

  // Re-harvest mockups
  await delay(10000)
  try {
    const d = await api(`/shops/${SHOP}/products/${sneaker.printify_id}.json`)
    const imgs = (d?.images || []).filter(i => !i.src?.includes('size-chart')).slice(0, 8).map(i => i.src)
    if (imgs.length) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', sneaker.id)
      console.log(`  ${imgs.length} mockups saved`)
    }
  } catch (e) { console.log(`  Mockup harvest: ${e.message}`) }

  console.log('  SNEAKERS ✓')
}

// ═══════════════════════════════════════════════════════════════════════════
//  2. DESK MAT — Dark background for sublimation
// ═══════════════════════════════════════════════════════════════════════════
async function fixDeskMat() {
  console.log('\n' + '─'.repeat(60))
  console.log('  2/3  DESK MAT — Dark background for sublimation')
  console.log('─'.repeat(60))

  const { data: [deskmat] } = await sb.from('products')
    .select('id, printify_id').ilike('title', '%SKAPARA Grip%').limit(1)
  if (!deskmat) { console.log('  Not found'); return }
  console.log(`  ${deskmat.printify_id}`)

  const W = 7205, H = 3661
  const tileSize = 580
  const markSvg = readFileSync(SVG.markWhite, 'utf8')
  const tileBuf = await sharp(Buffer.from(markSvg))
    .resize(tileSize, Math.round(tileSize * (1100 / 1431)), {
      fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }
    }).ensureAlpha().png().toBuffer()

  // 40% opacity
  const faded = await sharp(tileBuf).ensureAlpha().composite([{
    input: Buffer.from([0, 0, 0, Math.round(255 * 0.40)]),
    raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in'
  }]).png().toBuffer()

  const tileH = Math.round(tileSize * (1100 / 1431))
  const cols = Math.ceil(W / (tileSize + 80)) + 1
  const rows = Math.ceil(H / (tileH + 80)) + 1
  const composites = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = (r % 2 === 1) ? Math.round(tileSize / 2) : 0
      const left = c * (tileSize + 80) + ox - 40
      const top = r * (tileH + 80) - 40
      if (left < W && top < H && left > -tileSize && top > -tileH) {
        composites.push({ input: faded, left, top })
      }
    }
  }

  // DARK background (#1C1C1C) — NOT transparent
  console.log('  Generating design with dark background...')
  const designBuf = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 28, g: 28, b: 28, alpha: 255 } }
  }).png().composite(composites).png().toBuffer()
  console.log(`  Design: ${W}x${H}, ${Math.round(designBuf.length / 1024)}KB`)

  // Upload
  await delay(3000)
  const upload = await api('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: 'sk-grip-deskmat-v3.png', contents: designBuf.toString('base64') })
  })
  console.log(`  Upload: ${upload.id}`)

  // Get variants
  await delay(3000)
  const varRes = await api('/catalog/blueprints/969/print_providers/90/variants.json')
  const vs = varRes.variants || []

  // Update
  await delay(3000)
  await api(`/shops/${SHOP}/products/${deskmat.printify_id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      print_areas: [{
        variant_ids: vs.map(v => v.id),
        placeholders: [{ position: 'front', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
      }],
    }),
  })
  console.log('  Product updated')

  // Publish
  await delay(3000)
  await api(`/shops/${SHOP}/products/${deskmat.printify_id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('  Published')

  // Mockups
  await delay(10000)
  try {
    const d = await api(`/shops/${SHOP}/products/${deskmat.printify_id}.json`)
    const imgs = (d?.images || []).filter(i => !i.src?.includes('size-chart')).slice(0, 8).map(i => i.src)
    if (imgs.length) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', deskmat.id)
      console.log(`  ${imgs.length} mockups saved`)
    }
  } catch (e) { console.log(`  Mockup harvest: ${e.message}`) }

  console.log('  DESK MAT ✓')
}

// ═══════════════════════════════════════════════════════════════════════════
//  3. LONG SLEEVE — Expand to 6 dark colors
// ═══════════════════════════════════════════════════════════════════════════
async function fixLongSleeve() {
  console.log('\n' + '─'.repeat(60))
  console.log('  3/3  LONG SLEEVE — Expand colors')
  console.log('─'.repeat(60))

  const { data: [ls] } = await sb.from('products')
    .select('id, printify_id').ilike('title', '%SKAPARA Edge%').limit(1)
  if (!ls) { console.log('  Not found'); return }
  console.log(`  ${ls.printify_id}`)

  // Get all variants
  await delay(3000)
  const varRes = await api('/catalog/blueprints/879/print_providers/217/variants.json')
  const allVars = varRes.variants || []

  // Dark colors with full size ranges
  const darkColors = ['black', 'navy', 'burgundy', 'army green', 'colony blue', 'chestnut']
  const selected = allVars.filter(v => {
    const c = (v.options?.color || '').toLowerCase()
    return darkColors.some(dc => c === dc)
  })

  const colorMap = {}
  for (const v of selected) {
    const c = v.options?.color || '?'
    colorMap[c] = (colorMap[c] || 0) + 1
  }
  console.log(`  ${selected.length} variants in ${Object.keys(colorMap).length} colors:`)
  for (const [c, n] of Object.entries(colorMap)) console.log(`    ${c}: ${n} sizes`)

  // Update Printify variants
  await delay(3000)
  await api(`/shops/${SHOP}/products/${ls.printify_id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      variants: selected.map(v => ({ id: v.id, price: 2999, is_enabled: true })),
    }),
  })
  console.log('  Product updated')

  // Publish
  await delay(3000)
  await api(`/shops/${SHOP}/products/${ls.printify_id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('  Published')

  // Sync Supabase variants
  await sb.from('product_variants').delete().eq('product_id', ls.id)
  for (const sv of selected) {
    const parts = sv.title.split(' / ').map(p => p.trim())
    await sb.from('product_variants').upsert({
      product_id: ls.id,
      printify_variant_id: String(sv.id),
      title: sv.title,
      color: parts[0] || sv.options?.color || 'Default',
      size: parts[1] || sv.options?.size || 'One size',
      price_cents: 2999,
      is_enabled: true,
      is_available: true,
    }, { onConflict: 'product_id,printify_variant_id' })
  }
  console.log(`  ${selected.length} variants synced to Supabase`)

  // Mockups
  await delay(10000)
  try {
    const d = await api(`/shops/${SHOP}/products/${ls.printify_id}.json`)
    const imgs = (d?.images || []).filter(i => !i.src?.includes('size-chart')).slice(0, 8).map(i => i.src)
    if (imgs.length) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', ls.id)
      console.log(`  ${imgs.length} mockups saved`)
    }
  } catch (e) { console.log(`  Mockup harvest: ${e.message}`) }

  console.log('  LONG SLEEVE ✓')
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('═'.repeat(60))
  console.log('  SKAPARA — Fix v3: Sneakers + Desk Mat + Long Sleeve')
  console.log('═'.repeat(60))

  await fixSneakers()
  await fixDeskMat()
  await fixLongSleeve()

  console.log('\n' + '═'.repeat(60))
  console.log('  ALL 3 FIXES COMPLETE')
  console.log('═'.repeat(60))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
