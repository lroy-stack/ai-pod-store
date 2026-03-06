/**
 * SKAPARA Sneaker Fix v4 — S mark at 15% panel height
 * The logo should be a subtle brand mark, not a giant stamp.
 * Body panels: S at 15% height, centered
 * Tongue: S at 18% width, upper-center
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
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

async function main() {
  console.log('═'.repeat(60))
  console.log('  SNEAKERS v4 — S mark at 15% (subtle brand mark)')
  console.log('═'.repeat(60))

  const { data: [sneaker] } = await sb.from('products')
    .select('id, printify_id').ilike('title', '%SKAPARA Step%').limit(1)
  if (!sneaker) { console.log('  Not found'); return }
  console.log(`  Product: ${sneaker.printify_id}`)

  const markSvg = readFileSync(join(ROOT, 'public', 'brand', 'skapara-mark-dark.svg'), 'utf8')

  // Body outside panels: S at 15% of panel height — subtle like a Nike swoosh
  // Panel sizes: 1434x650 and 1433x649
  async function bodyDesign(w, h) {
    const mH = Math.round(h * 0.15)           // 15% = ~97px on 650px panel
    const mW = Math.round(mH * (1431 / 1100)) // maintain SVG aspect ratio
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

  // Tongue panels (945x1220): S at 18% width, upper third
  async function tongueDesign() {
    const W = 945, H = 1220
    const mW = Math.round(W * 0.18)           // 18% = ~170px on 945px
    const mH = Math.round(mW * (1100 / 1431)) // maintain aspect ratio
    const buf = await sharp(Buffer.from(markSvg))
      .resize(mW, mH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer()
    return sharp({
      create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).composite([{
      input: buf,
      left: Math.round((W - mW) / 2),
      top: Math.round(H * 0.30),             // upper third, not dead center
    }]).png().toBuffer()
  }

  // Generate designs
  console.log('  Generating designs (body 15%, tongue 18%)...')
  const body1 = await bodyDesign(1434, 650)
  const body2 = await bodyDesign(1433, 649)
  const tongue = await tongueDesign()
  console.log(`  body1: ${body1.length}B, body2: ${body2.length}B, tongue: ${tongue.length}B`)

  // Upload 3 images
  console.log('  Uploading...')
  const upBody1 = await api('/uploads/images.json', {
    method: 'POST', body: JSON.stringify({ file_name: 'sk-step-body1-v4.png', contents: body1.toString('base64') })
  })
  await delay(3000)
  const upBody2 = await api('/uploads/images.json', {
    method: 'POST', body: JSON.stringify({ file_name: 'sk-step-body2-v4.png', contents: body2.toString('base64') })
  })
  await delay(3000)
  const upTongue = await api('/uploads/images.json', {
    method: 'POST', body: JSON.stringify({ file_name: 'sk-step-tongue-v4.png', contents: tongue.toString('base64') })
  })
  console.log(`  Uploads: body1=${upBody1.id}, body2=${upBody2.id}, tongue=${upTongue.id}`)

  // Get variants
  await delay(3000)
  const varRes = await api('/catalog/blueprints/767/print_providers/90/variants.json')
  const vs = varRes.variants || []
  console.log(`  ${vs.length} variants`)

  // Update product
  await delay(3000)
  await api(`/shops/${SHOP}/products/${sneaker.printify_id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      print_areas: [{
        variant_ids: vs.map(v => v.id),
        placeholders: [
          { position: 'body_outside_left',  images: [{ id: upBody1.id,  x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_outside_right', images: [{ id: upBody2.id,  x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_inside_left',   images: [{ id: upBody2.id,  x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
          { position: 'body_inside_right',  images: [{ id: upBody1.id,  x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
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

  // Harvest mockups (wait for Printify to generate)
  console.log('  Waiting 15s for mockup generation...')
  await delay(15000)
  try {
    const d = await api(`/shops/${SHOP}/products/${sneaker.printify_id}.json`)
    const imgs = (d?.images || []).filter(i => !i.src?.includes('size-chart')).slice(0, 8).map(i => i.src)
    if (imgs.length) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', sneaker.id)
      console.log(`  ${imgs.length} mockups saved to Supabase`)
    }
  } catch (e) { console.log(`  Mockup harvest: ${e.message}`) }

  console.log('\n  SNEAKERS v4 ✓ — S mark at 15% panel height')
  console.log('═'.repeat(60))
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
