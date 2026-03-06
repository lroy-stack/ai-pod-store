/**
 * Fix 6 Kids Products — Printify + Supabase
 *
 * Fixes:
 * - #2 Bug Reporter: remove badges from design, swap front↔back, bigger logo
 * - #3 Sudo Ice Cream: remove redundant back branding
 * - #4 Bedtime 404: remove back branding, disable Light Blue, fix color/size swap
 * - #5 Ctrl+Z Homework: remove text_layer.svg from neck
 * - #6 AI Raised Me: swap front↔back, fix color/size swap
 * - #7 Code Works: re-sync images (front-first)
 *
 * Also fixes:
 * - parseVariantColor regex ($ anchor)
 * - variant image_url mapping (front mockup only)
 *
 * Usage:
 *   node scripts/_fix-kids-products.mjs              # Fix all 6
 *   node scripts/_fix-kids-products.mjs --only 2     # Fix only product #2
 *   node scripts/_fix-kids-products.mjs --dry-run    # Show what would change
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY = process.argv.includes('--only') ? Number(process.argv[process.argv.indexOf('--only') + 1]) : null
const ROOT = join(import.meta.dirname, '..')
const DESIGNS_DIR = join(ROOT, 'public', 'kids-designs')

// ─── Env ──────────────────────────────────────────────────────────────────────
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')

if (!DRY_RUN && (!TOKEN || !SHOP_ID || !SB_URL || !SB_KEY)) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = DRY_RUN ? null : createClient(SB_URL, SB_KEY)
const API = 'https://api.printify.com/v1'
const hdrs = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' })
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs(), ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 500)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// ─── Product IDs ──────────────────────────────────────────────────────────────
const PRODUCTS = {
  2: { name: 'Bug Reporter',     printifyId: '69a38b2546730b56700a4018', supabaseId: '743f1925-cb78-4ad9-a73d-3c29be80464d' },
  3: { name: 'Sudo Ice Cream',   printifyId: '69a38b5d1ec5ca402c0352e0', supabaseId: '8982c0a2-1761-44bd-884f-d861592099aa' },
  4: { name: 'Bedtime 404',      printifyId: '69a38b853b12a90c8e089201', supabaseId: '8aa671b9-5dad-41b8-887f-27c27e8520c7' },
  5: { name: 'Ctrl+Z Homework',  printifyId: '69a38bac5a653e214b0be2f4', supabaseId: '2c0e6015-6b4c-4713-948a-a58efb96cbb0' },
  6: { name: 'AI Raised Me',     printifyId: '69a38bda3b12a90c8e08920c', supabaseId: '62c85f65-3d67-4961-9024-ab45e7100b57' },
  7: { name: 'Code Works',       printifyId: '69a38c03874d66e74c0ea105', supabaseId: '9805dca8-5179-4312-8963-0018248aa315' },
}

// ─── Corrected size regex (with $ anchor) ─────────────────────────────────────
const SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|2XS|S\/M|L\/XL|NB|One\s*size|US\s+\d+(?:\.\d+)?|\d+.*)$/i

function parseVariantTitle(title) {
  const parts = title.split(' / ').map(p => p.trim())
  if (parts.length >= 3) {
    const last = parts[parts.length - 1]
    if (SIZE_RE.test(last)) return { color: parts.slice(0, -1).join(' / '), size: last }
    return { color: parts.slice(1).join(' / '), size: parts[0] }
  }
  if (parts.length === 2) {
    if (SIZE_RE.test(parts[0])) return { size: parts[0], color: parts[1] }
    return { color: parts[0], size: parts[1] }
  }
  return { color: parts[0] || 'Default', size: 'One Size' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadImage(fileName) {
  const filePath = join(DESIGNS_DIR, fileName)
  const buffer = readFileSync(filePath)
  const base64 = buffer.toString('base64')
  console.log(`    Uploading ${fileName} (${Math.round(buffer.length / 1024)}KB)...`)
  await delay(2000)
  const result = await api('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify({ file_name: `skapara-kids-${fileName}`, contents: base64 }),
  })
  console.log(`    ✓ ${fileName} → ${result.id}`)
  return result.id
}

async function getProduct(printifyId) {
  return api(`/shops/${SHOP_ID}/products/${printifyId}.json`)
}

function getUploadIds(product) {
  const ids = {}
  for (const pa of product.print_areas || []) {
    for (const ph of pa.placeholders || []) {
      // Get the first real image (not text_layer)
      const realImg = ph.images?.find(i => i.name !== 'text_layer.svg')
      if (realImg) ids[ph.position] = realImg.id
    }
  }
  return ids
}

async function updatePrintAreas(printifyId, variantIds, placeholders) {
  console.log(`    PUT print_areas: ${placeholders.map(p => p.position).join(', ')}`)
  await delay(2000)
  await api(`/shops/${SHOP_ID}/products/${printifyId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      print_areas: [{ variant_ids: variantIds, placeholders }],
    }),
  })
  console.log(`    ✓ Print areas updated`)
}

async function publishProduct(printifyId) {
  console.log(`    Publishing...`)
  await delay(1500)
  await api(`/shops/${SHOP_ID}/products/${printifyId}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log(`    ✓ Published — waiting 15s for mockup generation...`)
  await delay(15000)
}

async function harvestAndSyncImages(printifyId, supabaseId, productName) {
  console.log(`    Harvesting mockup images...`)
  const p = await getProduct(printifyId)
  const allImages = (p.images || []).filter(i => i.src && !i.src.includes('size-chart') && !i.src.includes('size_chart'))

  console.log(`    Raw images from Printify: ${allImages.length}`)

  // Sort: front first, then is_default, then others
  const sorted = [...allImages].sort((a, b) => {
    const aFront = (a.src || '').includes('camera_label=front') ? 1 : 0
    const bFront = (b.src || '').includes('camera_label=front') ? 1 : 0
    if (aFront !== bFront) return bFront - aFront
    if (a.is_default && !b.is_default) return -1
    if (b.is_default && !a.is_default) return 1
    return 0
  })

  // Save to products.images
  const imagesPayload = sorted.map(img => ({
    src: img.src,
    alt: productName,
    variant_ids: img.variant_ids || [],
    is_default: img.is_default === true,
  }))

  await supabase.from('products').update({ images: imagesPayload }).eq('id', supabaseId)
  console.log(`    ✓ ${imagesPayload.length} images saved to Supabase (front-first order)`)

  // Map variant image_url — first match per variant wins (front)
  const mapped = new Set()
  let mapCount = 0
  for (const img of sorted) {
    for (const vid of (img.variant_ids || [])) {
      if (mapped.has(String(vid))) continue
      mapped.add(String(vid))
      await supabase.from('product_variants')
        .update({ image_url: img.src })
        .eq('product_id', supabaseId)
        .eq('printify_variant_id', String(vid))
      mapCount++
    }
  }
  console.log(`    ✓ ${mapCount} variant image_urls mapped (front-only)`)

  // Verify first image is front
  if (sorted.length > 0) {
    const firstLabel = (sorted[0].src || '').match(/camera_label=([^&]+)/)?.[1] || 'unknown'
    console.log(`    Card image: ${firstLabel}`)
  }
}

async function reparseVariants(supabaseId, productName) {
  console.log(`    Re-parsing variants for ${productName}...`)
  const { data: variants } = await supabase.from('product_variants')
    .select('id, title, color, size')
    .eq('product_id', supabaseId)

  let fixed = 0
  for (const v of variants || []) {
    const parsed = parseVariantTitle(v.title)
    if (parsed.color !== v.color || parsed.size !== v.size) {
      await supabase.from('product_variants')
        .update({ color: parsed.color, size: parsed.size })
        .eq('id', v.id)
      console.log(`      "${v.title}": "${v.color}|${v.size}" → "${parsed.color}|${parsed.size}"`)
      fixed++
    }
  }
  console.log(`    ✓ ${fixed} variants re-parsed`)
}

// ─── Product-specific fixes ───────────────────────────────────────────────────

async function fix2_BugReporter() {
  const p = PRODUCTS[2]
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  #2 ${p.name} — Swap front↔back + new design`)
  console.log('═'.repeat(60))

  if (DRY_RUN) {
    console.log('  DRY RUN: Would remove badges from SVG, swap front/back, bigger logo')
    return
  }

  // Upload regenerated design (badges removed)
  const designId = await uploadImage('02-bug-reporter.png')
  // Upload dark lockup for front (garments include White, Heather Grey)
  const lockupId = await uploadImage('branding-back-lockup-dark.png')

  // Get current product for variant IDs
  const product = await getProduct(p.printifyId)
  const variantIds = product.variants.map(v => v.id)

  // Swap: front = lockup (bigger), back = design
  await updatePrintAreas(p.printifyId, variantIds, [
    { position: 'front', images: [{ id: lockupId, x: 0.5, y: 0.35, scale: 0.55, angle: 0 }] },
    { position: 'back',  images: [{ id: designId, x: 0.5, y: 0.45, scale: 1, angle: 0 }] },
  ])

  await publishProduct(p.printifyId)
  await harvestAndSyncImages(p.printifyId, p.supabaseId, p.name)
}

async function fix3_SudoIceCream() {
  const p = PRODUCTS[3]
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  #3 ${p.name} — Remove redundant back branding`)
  console.log('═'.repeat(60))

  if (DRY_RUN) {
    console.log('  DRY RUN: Would remove back, keep front + neck_outer only')
    return
  }

  const product = await getProduct(p.printifyId)
  const ids = getUploadIds(product)
  const variantIds = product.variants.map(v => v.id)

  console.log(`    Current positions: ${Object.keys(ids).join(', ')}`)
  console.log(`    front=${ids.front}, neck_outer=${ids.neck_outer}`)

  // Keep front + neck_outer only (remove back)
  await updatePrintAreas(p.printifyId, variantIds, [
    { position: 'front',      images: [{ id: ids.front, x: 0.5, y: 0.45, scale: 1, angle: 0 }] },
    { position: 'neck_outer', images: [{ id: ids.neck_outer, x: 0.5, y: 0.5, scale: 0.8, angle: 0 }] },
  ])

  await publishProduct(p.printifyId)
  await harvestAndSyncImages(p.printifyId, p.supabaseId, p.name)
}

async function fix4_Bedtime404() {
  const p = PRODUCTS[4]
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  #4 ${p.name} — Remove back + Light Blue + fix parsing`)
  console.log('═'.repeat(60))

  if (DRY_RUN) {
    console.log('  DRY RUN: Would remove back, disable Light Blue, fix color/size')
    return
  }

  const product = await getProduct(p.printifyId)
  const ids = getUploadIds(product)
  const variantIds = product.variants.map(v => v.id)

  console.log(`    Current positions: ${Object.keys(ids).join(', ')}`)

  // 1. Remove back, keep front + neck_outer
  await updatePrintAreas(p.printifyId, variantIds, [
    { position: 'front',      images: [{ id: ids.front, x: 0.5, y: 0.45, scale: 1, angle: 0 }] },
    { position: 'neck_outer', images: [{ id: ids.neck_outer, x: 0.5, y: 0.5, scale: 0.8, angle: 0 }] },
  ])

  // 2. Disable Light Blue variants in Printify
  const lightBlueVariants = product.variants.filter(v => v.title.toLowerCase().includes('light blue'))
  if (lightBlueVariants.length > 0) {
    console.log(`    Disabling ${lightBlueVariants.length} Light Blue variants in Printify...`)
    const updatedVariants = product.variants.map(v => ({
      id: v.id,
      price: v.price,
      is_enabled: v.title.toLowerCase().includes('light blue') ? false : v.is_enabled,
    }))
    await delay(2000)
    await api(`/shops/${SHOP_ID}/products/${p.printifyId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ variants: updatedVariants }),
    })
    console.log(`    ✓ Light Blue variants disabled in Printify`)
  }

  await publishProduct(p.printifyId)
  await harvestAndSyncImages(p.printifyId, p.supabaseId, p.name)

  // 3. Fix color/size swap in Supabase
  await reparseVariants(p.supabaseId, p.name)

  // 4. Disable Light Blue in Supabase
  const { data: lbVars } = await supabase.from('product_variants')
    .update({ is_enabled: false, is_available: false })
    .eq('product_id', p.supabaseId)
    .ilike('color', '%Light Blue%')
    .select('id')
  console.log(`    ✓ ${lbVars?.length || 0} Light Blue variants disabled in Supabase`)
}

async function fix5_CtrlZHomework() {
  const p = PRODUCTS[5]
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  #5 ${p.name} — Remove text_layer from neck`)
  console.log('═'.repeat(60))

  if (DRY_RUN) {
    console.log('  DRY RUN: Would remove text_layer.svg from neck, keep gradient only')
    return
  }

  const product = await getProduct(p.printifyId)
  const ids = getUploadIds(product)
  const variantIds = product.variants.map(v => v.id)

  console.log(`    Current positions: ${Object.keys(ids).join(', ')}`)

  // Check if neck has text_layer
  const neckPA = product.print_areas?.[0]?.placeholders?.find(ph => ph.position === 'neck')
  if (neckPA) {
    const hasTextLayer = neckPA.images?.some(i => i.name === 'text_layer.svg')
    console.log(`    Neck has text_layer: ${hasTextLayer}`)
    console.log(`    Neck images: ${neckPA.images?.length}`)
  }

  // Rebuild with clean placeholders
  await updatePrintAreas(p.printifyId, variantIds, [
    { position: 'front', images: [{ id: ids.front, x: 0.5, y: 0.45, scale: 1, angle: 0 }] },
    { position: 'back',  images: [{ id: ids.back,  x: 0.5, y: 0.2, scale: 0.3, angle: 0 }] },
    { position: 'neck',  images: [{ id: ids.neck,  x: 0.5, y: 0.5, scale: 0.8, angle: 0 }] },
  ])

  await publishProduct(p.printifyId)
  await harvestAndSyncImages(p.printifyId, p.supabaseId, p.name)
}

async function fix6_AIRaisedMe() {
  const p = PRODUCTS[6]
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  #6 ${p.name} — Swap front↔back + fix parsing`)
  console.log('═'.repeat(60))

  if (DRY_RUN) {
    console.log('  DRY RUN: Would swap front/back, fix Sky Blue/Sun Yellow parsing')
    return
  }

  // Upload white lockup for front (garments are dark: Jet Black, Oxford Navy)
  const lockupId = await uploadImage('branding-back-lockup-white.png')

  const product = await getProduct(p.printifyId)
  const ids = getUploadIds(product)
  const variantIds = product.variants.map(v => v.id)

  console.log(`    Current positions: ${Object.keys(ids).join(', ')}`)
  console.log(`    Current front design: ${ids.front}`)

  // Swap: front = lockup (white for dark garments), back = design
  await updatePrintAreas(p.printifyId, variantIds, [
    { position: 'front', images: [{ id: lockupId,  x: 0.5, y: 0.35, scale: 0.55, angle: 0 }] },
    { position: 'back',  images: [{ id: ids.front, x: 0.5, y: 0.45, scale: 1, angle: 0 }] },
  ])

  await publishProduct(p.printifyId)
  await harvestAndSyncImages(p.printifyId, p.supabaseId, p.name)

  // Fix color/size swap in Supabase
  await reparseVariants(p.supabaseId, p.name)
}

async function fix7_CodeWorks() {
  const p = PRODUCTS[7]
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  #7 ${p.name} — Re-sync images (front-first)`)
  console.log('═'.repeat(60))

  if (DRY_RUN) {
    console.log('  DRY RUN: Would re-sync images with front-first ordering')
    return
  }

  // No Printify changes needed — just re-harvest and re-map images
  await harvestAndSyncImages(p.printifyId, p.supabaseId, p.name)

  // Also re-parse variants just in case
  await reparseVariants(p.supabaseId, p.name)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const fixes = {
    2: fix2_BugReporter,
    3: fix3_SudoIceCream,
    4: fix4_Bedtime404,
    5: fix5_CtrlZHomework,
    6: fix6_AIRaisedMe,
    7: fix7_CodeWorks,
  }

  const toRun = ONLY ? { [ONLY]: fixes[ONLY] } : fixes

  console.log(`\n🔧 Fixing ${Object.keys(toRun).length} kids products${DRY_RUN ? ' (DRY RUN)' : ''}\n`)

  const results = []

  for (const [num, fixFn] of Object.entries(toRun)) {
    try {
      await fixFn()
      results.push({ num, name: PRODUCTS[num].name, status: 'OK' })
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`)
      results.push({ num, name: PRODUCTS[num].name, status: 'FAIL', error: e.message })
    }
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  SUMMARY')
  console.log('═'.repeat(60))

  for (const r of results) {
    const icon = r.status === 'OK' ? '✓' : '✗'
    console.log(`  ${icon} #${r.num} ${r.name} — ${r.status}${r.error ? ` [${r.error}]` : ''}`)
  }

  const ok = results.filter(r => r.status === 'OK').length
  const fail = results.filter(r => r.status === 'FAIL').length
  console.log(`\n  OK: ${ok} | Failed: ${fail}\n`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
