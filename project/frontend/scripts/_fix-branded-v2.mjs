/**
 * SKAPARA Branded Products — Fix Script v2
 *
 * Fixes 4 issues identified after creation:
 * 1. MUG: Delete BP 1016 (only white), recreate with BP 1018 (Two-Tone, 11 colors)
 * 2. SNEAKERS: Re-upload design with dark mark (was white-on-white = invisible)
 * 3. DESK MAT: Re-upload design with dark background (sublimation: transparent = white base)
 * 4. LONG SLEEVE: Expand color filter to include colors with full size ranges
 *
 * Usage: node scripts/_fix-branded-v2.mjs
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const SVG_DIR = join(ROOT, 'public', 'brand')

const SVG = {
  markWhite:    join(SVG_DIR, 'skapara-mark-white.svg'),
  markDark:     join(SVG_DIR, 'skapara-mark-dark.svg'),
  markColor:    join(SVG_DIR, 'skapara-mark-color.svg'),
  wordmarkDark: join(SVG_DIR, 'skapara-wordmark-dark.svg'),
}

// ─── Env ────────────────────────────────────────────────────────────────────
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const sb = createClient(SB_URL, SB_KEY)

const API = 'https://api.printify.com/v1'
const hdrs = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' })
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs(), ...opts.headers } })
    if (r.status === 429 && attempt < retries) {
      const wait = 15000 * (attempt + 1)
      console.log(`    Rate limited, waiting ${wait / 1000}s (attempt ${attempt + 1}/${retries})...`)
      await delay(wait)
      continue
    }
    if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
    const ct = r.headers.get('content-type') || ''
    return ct.includes('application/json') ? r.json() : null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FIX 1: MUG — Delete BP 1016, Recreate BP 1018 (Two-Tone, 11 colors)
// ═══════════════════════════════════════════════════════════════════════════════

async function fixMug() {
  console.log('\n' + '═'.repeat(60))
  console.log('  FIX 1: MUG — BP 1016 → BP 1018 (Two-Tone, 11 colors)')
  console.log('═'.repeat(60))

  // Find current mug
  const { data: mugs } = await sb.from('products')
    .select('id, printify_id, title')
    .ilike('title', '%SKAPARA Noir%')

  if (!mugs?.length) {
    console.log('  No SKAPARA Noir mug found. Skipping.')
    return
  }

  for (const mug of mugs) {
    // Delete variants from Supabase
    await sb.from('product_variants').delete().eq('product_id', mug.id)
    // Unpublish + delete from Printify
    try {
      await api(`/shops/${SHOP_ID}/products/${mug.printify_id}/unpublish.json`, { method: 'POST', body: '{}' })
    } catch {}
    await delay(1000)
    try {
      await api(`/shops/${SHOP_ID}/products/${mug.printify_id}.json`, { method: 'DELETE' })
    } catch (e) { console.log(`  Printify delete: ${e.message}`) }
    // Delete from Supabase
    await sb.from('products').delete().eq('id', mug.id)
    console.log(`  Deleted old mug: ${mug.title} (${mug.id})`)
  }

  // Create new mug with BP 1018
  console.log('  Creating new Two-Tone Mug (BP 1018, Provider 26)...')

  // Design: same dark S mark + wordmark lockup (works on white mug body)
  const W = 2244, H = 945
  const markH = Math.round(H * 0.60)
  const markW = Math.round(markH * (1431 / 1100))
  const markSvg = readFileSync(SVG.markDark, 'utf8')
  const markBuf = await sharp(Buffer.from(markSvg))
    .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  const wmH = Math.round(H * 0.10)
  const wmW = Math.round(wmH * (2040 / 208))
  const wmSvg = readFileSync(SVG.wordmarkDark, 'utf8')
  const wmBuf = await sharp(Buffer.from(wmSvg))
    .resize(wmW, wmH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  const gap = Math.round(W * 0.03)
  const lockupW = markW + gap + wmW
  const lockupLeft = Math.round((W - lockupW) / 2)

  const designBuf = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png().composite([
    { input: markBuf, left: lockupLeft, top: Math.round((H - markH) / 2) },
    { input: wmBuf, left: lockupLeft + markW + gap, top: Math.round((H - wmH) / 2) },
  ]).png().toBuffer()

  // Upload to Printify
  await delay(3000)
  const upload = await api('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({
      file_name: 'skapara-noir-twotone-mug.png',
      contents: designBuf.toString('base64'),
    }),
  })
  console.log(`  Upload: ${upload.id}`)

  // Get variants
  await delay(2000)
  const varRes = await api('/catalog/blueprints/1018/print_providers/26/variants.json')
  const allVariants = varRes.variants || []
  console.log(`  ${allVariants.length} color variants available`)

  // Create product — ALL 11 colors
  await delay(2000)
  const prod = await api(`/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'SKAPARA Noir — Two-Tone Mug',
      description: 'The SKAPARA Noir two-tone mug. Bold S mark and wordmark on premium ceramic. Colored handle and inner rim. 11oz, dishwasher safe.',
      blueprint_id: 1018,
      print_provider_id: 26,
      variants: allVariants.map(v => ({ id: v.id, price: 1699, is_enabled: true })),
      print_areas: [{
        variant_ids: allVariants.map(v => v.id),
        placeholders: [{ position: 'front', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }],
      }],
      tags: ['mug', 'skapara', 'brand', 'minimal', 'ceramic', '11oz', 'two-tone'],
    }),
  })
  console.log(`  Printify: ${prod.id}`)

  // Publish
  await delay(1500)
  await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })

  // Insert in Supabase
  const { data: cat } = await sb.from('categories').select('id').eq('slug', 'mugs').single()
  const { data: dbProd, error: dbErr } = await sb.from('products').insert({
    title: 'SKAPARA Noir — Two-Tone Mug',
    description: 'The SKAPARA Noir two-tone mug. Bold S mark and wordmark on premium ceramic. Colored handle and inner rim. 11oz, dishwasher safe.',
    printify_id: prod.id,
    blueprint_id: 1018,
    print_provider_id: 26,
    category_id: cat?.id,
    category: 'mugs',
    status: 'active',
    currency: 'EUR',
    base_price_cents: 1699,
    tags: ['mug', 'skapara', 'brand', 'minimal', 'ceramic', '11oz', 'two-tone'],
    published_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    translations: {
      es: { title: 'SKAPARA Noir — Taza Two-Tone', description: 'Taza SKAPARA Noir two-tone. Marca S y logotipo en cerámica premium. Asa e interior de color. 11oz, apta lavavajillas.' },
      de: { title: 'SKAPARA Noir — Two-Tone Tasse', description: 'SKAPARA Noir Two-Tone Tasse. S-Logo und Schriftzug auf Premium-Keramik. Farbiger Henkel und Innenseite. 11oz, spülmaschinenfest.' },
    },
  }).select('id').single()

  if (dbErr) { console.error(`  DB error: ${dbErr.message}`); return }
  console.log(`  Supabase: ${dbProd.id}`)

  // Publish succeeded
  try {
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
      method: 'POST',
      body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } }),
    })
  } catch {}

  // Insert variants
  for (const sv of allVariants) {
    const parts = sv.title.split(' / ').map(p => p.trim())
    await sb.from('product_variants').upsert({
      product_id: dbProd.id,
      printify_variant_id: String(sv.id),
      title: sv.title,
      color: parts[1] || sv.options?.color || 'Default',
      size: parts[0] || sv.options?.size || '11oz',
      price_cents: 1699,
      is_enabled: true,
      is_available: true,
    }, { onConflict: 'product_id,printify_variant_id' })
  }
  console.log(`  ${allVariants.length} variants inserted`)

  // Harvest mockups
  await delay(5000)
  try {
    const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
    const imgs = (details?.images || [])
      .filter(i => !i.src?.includes('size-chart'))
      .slice(0, 8)
      .map(i => i.src)
    if (imgs.length) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
      console.log(`  ${imgs.length} mockups saved`)
    }
  } catch {}

  console.log('  MUG FIX COMPLETE ✓')
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FIX 2: SNEAKERS — Dark design (was white-on-white)
// ═══════════════════════════════════════════════════════════════════════════════

async function fixSneakers() {
  console.log('\n' + '═'.repeat(60))
  console.log('  FIX 2: SNEAKERS — Dark design (white-on-white was invisible)')
  console.log('═'.repeat(60))

  const { data: prods } = await sb.from('products')
    .select('id, printify_id, title')
    .ilike('title', '%SKAPARA Step%')

  if (!prods?.length) { console.log('  No sneaker found. Skipping.'); return }
  const sneaker = prods[0]
  console.log(`  Found: ${sneaker.title} (${sneaker.printify_id})`)

  // Generate new designs with DARK mark
  console.log('  Generating dark S mark designs for all 6 print areas...')

  // Body panel: dark S mark centered (1434x650)
  async function darkBody(w, h) {
    const markH = Math.round(h * 0.65)
    const markW = Math.round(markH * (1431 / 1100))
    const markSvg = readFileSync(SVG.markDark, 'utf8')
    const markBuf = await sharp(Buffer.from(markSvg))
      .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer()
    return sharp({
      create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).png().composite([{
      input: markBuf,
      left: Math.round((w - markW) / 2),
      top: Math.round((h - markH) / 2),
    }]).png().toBuffer()
  }

  // Tongue: dark S mark centered (945x1220)
  async function darkTongue() {
    const W = 945, H = 1220
    const markW = Math.round(W * 0.50)
    const markH = Math.round(markW * (1100 / 1431))
    const markSvg = readFileSync(SVG.markDark, 'utf8')
    const markBuf = await sharp(Buffer.from(markSvg))
      .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer()
    return sharp({
      create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    }).png().composite([{
      input: markBuf,
      left: Math.round((W - markW) / 2),
      top: Math.round((H - markH) / 2),
    }]).png().toBuffer()
  }

  // All 6 print areas
  const areas = [
    { position: 'body_outside_left',  buf: await darkBody(1434, 650) },
    { position: 'body_outside_right', buf: await darkBody(1433, 649) },
    { position: 'body_inside_left',   buf: await darkBody(1433, 649) },
    { position: 'body_inside_right',  buf: await darkBody(1434, 650) },
    { position: 'tongue_left',        buf: await darkTongue() },
    { position: 'tongue_right',       buf: await darkTongue() },
  ]

  // Upload all 6
  const uploadIds = {}
  for (const area of areas) {
    await delay(3000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({
        file_name: `skapara-sneaker-${area.position}.png`,
        contents: area.buf.toString('base64'),
      }),
    })
    uploadIds[area.position] = upload.id
    console.log(`  Upload ${area.position}: ${upload.id}`)
  }

  // Get current variants
  await delay(2000)
  const varRes = await api('/catalog/blueprints/767/print_providers/90/variants.json')
  const allVariants = varRes.variants || []

  // Update product on Printify with new images + all 6 areas
  await delay(2000)
  await api(`/shops/${SHOP_ID}/products/${sneaker.printify_id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      print_areas: [{
        variant_ids: allVariants.map(v => v.id),
        placeholders: areas.map(a => ({
          position: a.position,
          images: [{ id: uploadIds[a.position], x: 0.5, y: 0.5, scale: 1, angle: 0 }],
        })),
      }],
    }),
  })
  console.log('  Product updated with dark designs on all 6 areas')

  // Re-publish to generate new mockups
  await delay(1500)
  await api(`/shops/${SHOP_ID}/products/${sneaker.printify_id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })

  // Re-harvest mockups after a wait
  await delay(8000)
  try {
    const details = await api(`/shops/${SHOP_ID}/products/${sneaker.printify_id}.json`)
    const imgs = (details?.images || [])
      .filter(i => !i.src?.includes('size-chart'))
      .slice(0, 8)
      .map(i => i.src)
    if (imgs.length) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', sneaker.id)
      console.log(`  ${imgs.length} new mockups saved`)
    }
  } catch {}

  console.log('  SNEAKERS FIX COMPLETE ✓')
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FIX 3: DESK MAT — Include dark background (sublimation: transparent = white)
// ═══════════════════════════════════════════════════════════════════════════════

async function fixDeskMat() {
  console.log('\n' + '═'.repeat(60))
  console.log('  FIX 3: DESK MAT — Dark background for sublimation')
  console.log('═'.repeat(60))

  const { data: prods } = await sb.from('products')
    .select('id, printify_id, title')
    .ilike('title', '%SKAPARA Grip%')

  if (!prods?.length) { console.log('  No desk mat found. Skipping.'); return }
  const deskmat = prods[0]
  console.log(`  Found: ${deskmat.title} (${deskmat.printify_id})`)

  // Generate design with DARK background (#1C1C1C) + white S marks at 50% opacity
  const W = 7205, H = 3661
  console.log('  Generating desk mat design with dark background...')

  // Render S mark tile
  const tileSize = 580
  const markSvg = readFileSync(SVG.markWhite, 'utf8')
  const tileBuf = await sharp(Buffer.from(markSvg))
    .resize(tileSize, Math.round(tileSize * (1100 / 1431)), {
      fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .ensureAlpha()
    .png().toBuffer()

  // Apply 40% opacity for subtle tonal pattern
  const fadedTile = await sharp(tileBuf)
    .ensureAlpha()
    .composite([{
      input: Buffer.from([0, 0, 0, Math.round(255 * 0.40)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in'
    }])
    .png().toBuffer()

  // Build grid of tiles
  const tileH = Math.round(tileSize * (1100 / 1431))
  const cols = Math.ceil(W / (tileSize + 80)) + 1
  const rows = Math.ceil(H / (tileH + 80)) + 1
  const composites = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offsetX = (row % 2 === 1) ? Math.round(tileSize / 2) : 0
      const left = col * (tileSize + 80) + offsetX - 40
      const top = row * (tileH + 80) - 40
      if (left < W && top < H && left > -(tileSize) && top > -(tileH)) {
        composites.push({ input: fadedTile, left, top })
      }
    }
  }

  // DARK BACKGROUND (#1C1C1C) instead of transparent
  const designBuf = await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 28, g: 28, b: 28, alpha: 255 } }
  }).png().composite(composites).png().toBuffer()

  console.log(`  Design: ${W}x${H}, ${Math.round(designBuf.length / 1024)}KB`)

  // Upload
  await delay(3000)
  const upload = await api('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({
      file_name: 'skapara-grip-deskmat-v2.png',
      contents: designBuf.toString('base64'),
    }),
  })
  console.log(`  Upload: ${upload.id}`)

  // Get variants
  await delay(2000)
  const varRes = await api('/catalog/blueprints/969/print_providers/90/variants.json')
  const allVariants = varRes.variants || []

  // Update product
  await delay(2000)
  await api(`/shops/${SHOP_ID}/products/${deskmat.printify_id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      print_areas: [{
        variant_ids: allVariants.map(v => v.id),
        placeholders: [{
          position: 'front',
          images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
        }],
      }],
    }),
  })
  console.log('  Product updated with dark background design')

  // Re-publish
  await delay(1500)
  await api(`/shops/${SHOP_ID}/products/${deskmat.printify_id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })

  // Re-harvest mockups
  await delay(8000)
  try {
    const details = await api(`/shops/${SHOP_ID}/products/${deskmat.printify_id}.json`)
    const imgs = (details?.images || [])
      .filter(i => !i.src?.includes('size-chart'))
      .slice(0, 8)
      .map(i => i.src)
    if (imgs.length) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', deskmat.id)
      console.log(`  ${imgs.length} new mockups saved`)
    }
  } catch {}

  console.log('  DESK MAT FIX COMPLETE ✓')
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FIX 4: LONG SLEEVE — Expand colors to include full-size options
// ═══════════════════════════════════════════════════════════════════════════════

async function fixLongSleeve() {
  console.log('\n' + '═'.repeat(60))
  console.log('  FIX 4: LONG SLEEVE — Expand to dark colors with full sizes')
  console.log('═'.repeat(60))

  const { data: prods } = await sb.from('products')
    .select('id, printify_id, title')
    .ilike('title', '%SKAPARA Edge%')

  if (!prods?.length) { console.log('  No long sleeve found. Skipping.'); return }
  const ls = prods[0]
  console.log(`  Found: ${ls.title} (${ls.printify_id})`)

  // Get ALL variants from Printify
  await delay(3000)
  const varRes = await api('/catalog/blueprints/879/print_providers/217/variants.json')
  const allVariants = varRes.variants || []

  // Filter to dark colors only (exclude White, Heather Grey, Mushroom, Toasted Coconut)
  const darkColors = ['Black', 'Navy', 'Burgundy', 'Army Green', 'Colony Blue', 'Chestnut']
  const selected = allVariants.filter(v => {
    const color = v.options?.color || ''
    return darkColors.some(dc => color.toLowerCase() === dc.toLowerCase())
  })

  const colorCounts = {}
  for (const v of selected) {
    const c = v.options?.color || '?'
    colorCounts[c] = (colorCounts[c] || 0) + 1
  }
  console.log(`  Selected ${selected.length} variants in ${Object.keys(colorCounts).length} colors:`)
  for (const [c, n] of Object.entries(colorCounts)) {
    console.log(`    ${c}: ${n} sizes`)
  }

  // Update product on Printify with expanded variants
  await delay(2000)
  await api(`/shops/${SHOP_ID}/products/${ls.printify_id}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      variants: selected.map(v => ({ id: v.id, price: 2999, is_enabled: true })),
    }),
  })
  console.log('  Product updated with expanded variants')

  // Re-publish
  await delay(1500)
  await api(`/shops/${SHOP_ID}/products/${ls.printify_id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })

  // Update Supabase variants — delete old, insert new
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

  // Re-harvest mockups
  await delay(8000)
  try {
    const details = await api(`/shops/${SHOP_ID}/products/${ls.printify_id}.json`)
    const imgs = (details?.images || [])
      .filter(i => !i.src?.includes('size-chart'))
      .slice(0, 8)
      .map(i => i.src)
    if (imgs.length) {
      await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', ls.id)
      console.log(`  ${imgs.length} mockups saved`)
    }
  } catch {}

  console.log('  LONG SLEEVE FIX COMPLETE ✓')
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN — Run all fixes sequentially
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(60))
  console.log('  SKAPARA — Branded Products Fix Script v2')
  console.log('  Fixing: Sneakers (visibility), Desk Mat (background), Long Sleeve (variants)')
  console.log('  Mug already fixed in previous run.')
  console.log('═'.repeat(60))

  // await fixMug() // DONE — 11 colors created successfully
  // await fixSneakers() // DONE — product updated with dark designs, needs publish only
  // await fixDeskMat()
  // await fixLongSleeve()

  // CONTINUATION: sneaker publish + remaining fixes
  console.log('  Waiting 60s for rate limit reset...')
  await delay(60000)

  // Publish sneakers (product already updated with dark designs)
  console.log('\n  Publishing sneakers...')
  const { data: sneakers } = await sb.from('products')
    .select('id, printify_id').ilike('title', '%SKAPARA Step%')
  if (sneakers?.length) {
    const s = sneakers[0]
    try {
      await api(`/shops/${SHOP_ID}/products/${s.printify_id}/publish.json`, {
        method: 'POST',
        body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
      })
      console.log('  Sneakers published ✓')
    } catch (e) { console.log(`  Sneaker publish: ${e.message}`) }

    // Harvest mockups
    await delay(8000)
    try {
      const details = await api(`/shops/${SHOP_ID}/products/${s.printify_id}.json`)
      const imgs = (details?.images || [])
        .filter(i => !i.src?.includes('size-chart'))
        .slice(0, 8).map(i => i.src)
      if (imgs.length) {
        await sb.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', s.id)
        console.log(`  ${imgs.length} new sneaker mockups saved`)
      }
    } catch {}
  }

  await delay(5000)
  await fixDeskMat()
  await fixLongSleeve()

  console.log('\n' + '═'.repeat(60))
  console.log('  ALL FIXES COMPLETE')
  console.log('═'.repeat(60))
}

main().catch(e => { console.error('\nFATAL:', e.message, e.stack); process.exit(1) })
