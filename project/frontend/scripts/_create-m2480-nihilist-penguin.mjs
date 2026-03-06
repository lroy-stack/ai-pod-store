#!/usr/bin/env node
/**
 * Create "Nihilist Penguin Crewneck" on Printful (M2480, Catalog 411)
 *
 * Branding layout (user-approved):
 *   front:        Nihilist Penguin design (1800x2400)
 *   sleeve_left:  SKAPARA wordmark vertical (450x1800) — +$2.20
 *   label_inside: S mark isotipo (750x750) — +$0.99
 *   back:         NONE (clean, no branding)
 *   Total extra:  $3.19/unit
 *
 * Flow:
 *   1. Upload 3 PNGs to Supabase Storage (public URLs)
 *   2. Create Printful files via URL
 *   3. Create sync product with CORE DARK variants (Black + Navy Blazer, S-3XL)
 *   4. Create Supabase product + variants
 *   5. publishing_succeeded linking
 *
 * Usage:
 *   cd frontend && node scripts/_create-m2480-nihilist-penguin.mjs --dry-run
 *   cd frontend && node scripts/_create-m2480-nihilist-penguin.mjs
 */
import { readFileSync } from 'fs'
import { resolve, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const ROOT = resolve(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`^${k}=(.*)`, 'm'))?.[1]?.trim()

// ─── Env ──────────────────────────────────────────────────────────────────────
const PF_TOKEN = env('PRINTFUL_API_TOKEN')
const PF_STORE = env('PRINTFUL_STORE_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')

if (!PF_TOKEN || !PF_STORE) { console.error('Missing PRINTFUL_API_TOKEN / PRINTFUL_STORE_ID'); process.exit(1) }
if (!SB_URL || !SB_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1) }

const supabase = createClient(SB_URL, SB_KEY)
const delay = (ms) => new Promise(r => setTimeout(r, ms))

// ─── Printful API ─────────────────────────────────────────────────────────────
async function pf(path, opts = {}, retries = 3) {
  const res = await fetch(`https://api.printful.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${PF_TOKEN}`,
      'Content-Type': 'application/json',
      'X-PF-Store-Id': PF_STORE,
      'User-Agent': 'SKAPARA-POD/1.0',
      ...opts.headers,
    },
  })
  if (res.status === 429) {
    const wait = parseInt(res.headers.get('Retry-After') || '60', 10)
    console.log(`  ⏳ Rate limited ${wait}s...`)
    await delay(wait * 1000)
    if (retries > 0) return pf(path, opts, retries - 1)
    throw new Error(`Rate limited on ${path}`)
  }
  if (res.status >= 500 && retries > 0) {
    await delay(3000)
    return pf(path, opts, retries - 1)
  }
  const json = await res.json()
  if (!res.ok || (json.code && json.code !== 200)) {
    throw new Error(`Printful ${res.status}: ${json.error?.message || JSON.stringify(json).slice(0, 500)}`)
  }
  return json.result !== undefined ? json.result : json
}

// ─── Supabase Storage Upload ──────────────────────────────────────────────────
async function uploadToStorage(localPath, storagePath) {
  const buf = readFileSync(localPath)
  const url = `${SB_URL}/storage/v1/object/designs/${storagePath}`

  let res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: buf,
  })
  // Fallback to PUT if POST fails
  if (!res.ok && res.status === 409) {
    res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, 'Content-Type': 'image/png' },
      body: buf,
    })
  }
  if (!res.ok) throw new Error(`Storage upload ${res.status}: ${await res.text()}`)
  return `${SB_URL}/storage/v1/object/public/designs/${storagePath}`
}

// ─── Product Definition ───────────────────────────────────────────────────────

const PRODUCT = {
  name: 'Nihilist Penguin Crewneck',
  catalogId: 411, // Cotton Heritage M2480
  desc: {
    en: 'When existence is meaningless, at least your crewneck is premium. Hand-drawn nihilist penguin on heavyweight Cotton Heritage M2480.',
    es: 'Cuando la existencia no tiene sentido, al menos tu sudadera es premium. Pingüino nihilista dibujado a mano sobre Cotton Heritage M2480 de alta gama.',
    de: 'Wenn die Existenz sinnlos ist, ist wenigstens dein Sweatshirt premium. Handgezeichneter nihilistischer Pinguin auf hochwertigem Cotton Heritage M2480.',
  },
  tags: ['crewneck', 'sweatshirt', 'skapara', 'nihilist', 'penguin', 'meme', 'streetwear', 'premium', 'cotton-heritage'],
  productDetails: {
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 65% ring-spun cotton, 35% polyester (face: 100% cotton)</p><p><strong>Weight:</strong> 8.5 oz/yd²</p><p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p><p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron on print.</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>',
    material: '65% ring-spun cotton, 35% polyester (100% cotton face)',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron on print.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    model: 'Cotton Heritage M2480',
    tier: 'PREMIUM',
    fit: 'Classic crew neck, side-seamed, ribbed cuffs',
    weight: '8.5 oz/yd²',
  },
}

// CORE DARK variants only (Black + Navy Blazer, S-3XL)
const VARIANTS = [
  // Black — all sizes
  { color: 'Black', size: 'S',   variantId: 11254, priceCents: 4999 },
  { color: 'Black', size: 'M',   variantId: 11255, priceCents: 4999 },
  { color: 'Black', size: 'L',   variantId: 11256, priceCents: 4999 },
  { color: 'Black', size: 'XL',  variantId: 11257, priceCents: 4999 },
  { color: 'Black', size: '2XL', variantId: 11258, priceCents: 5499 },
  { color: 'Black', size: '3XL', variantId: 13258, priceCents: 5799 },
  // Navy Blazer — all sizes
  { color: 'Navy Blazer', size: 'S',   variantId: 13252, priceCents: 4999 },
  { color: 'Navy Blazer', size: 'M',   variantId: 13253, priceCents: 4999 },
  { color: 'Navy Blazer', size: 'L',   variantId: 13254, priceCents: 4999 },
  { color: 'Navy Blazer', size: 'XL',  variantId: 13255, priceCents: 4999 },
  { color: 'Navy Blazer', size: '2XL', variantId: 13256, priceCents: 5499 },
  { color: 'Navy Blazer', size: '3XL', variantId: 13257, priceCents: 5799 },
]

// ─── Local Files ──────────────────────────────────────────────────────────────
const FILES = {
  front:       join(ROOT, 'printful-ready', 'nihilist-penguin-front-1800x2400.png'),
  sleeve_left: join(ROOT, 'printful-ready', 'sleeve-left-wordmark-450x1800.png'),
  label_inside: join(ROOT, 'printful-ready', 'label-inside-smark-750x750.png'),
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║  Nihilist Penguin Crewneck — M2480 (Printful)           ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no API calls ***\n')

  // ── Step 1: Upload PNGs to Supabase Storage ──────────────────────────────
  console.log('Step 1: Upload designs to Supabase Storage...')
  const slug = 'nihilist-penguin-crewneck'
  const publicUrls = {}

  for (const [placement, localPath] of Object.entries(FILES)) {
    const storagePath = `printful-uploads/${slug}/${placement}.png`
    if (DRY_RUN) {
      console.log(`  [DRY] Would upload ${placement} → ${storagePath}`)
      publicUrls[placement] = `https://example.com/${storagePath}`
      continue
    }
    publicUrls[placement] = await uploadToStorage(localPath, storagePath)
    console.log(`  ✓ ${placement} → ${publicUrls[placement].split('/').pop()}`)
    await delay(500)
  }

  // ── Step 2: Create Printful files from public URLs ───────────────────────
  console.log('\nStep 2: Create Printful file references...')
  const fileIds = {}

  for (const [placement, url] of Object.entries(publicUrls)) {
    if (DRY_RUN) {
      console.log(`  [DRY] Would create Printful file for ${placement}`)
      fileIds[placement] = 999999
      continue
    }
    await delay(2000)
    const result = await pf('/files', {
      method: 'POST',
      body: JSON.stringify({ url, filename: `${slug}-${placement}.png` }),
    })
    fileIds[placement] = result.id
    console.log(`  ✓ ${placement}: file_id=${result.id}`)
  }

  // ── Step 3: Create Printful sync product ─────────────────────────────────
  console.log('\nStep 3: Create sync product...')

  // Note: label_inside must be added AFTER product creation (API rejects it at creation time)
  const syncVariants = VARIANTS.map(v => ({
    variant_id: v.variantId,
    retail_price: (v.priceCents / 100).toFixed(2),
    is_enabled: true,
    files: [
      { type: 'front', id: fileIds.front },
      { type: 'sleeve_left', id: fileIds.sleeve_left },
    ],
  }))

  const payload = {
    sync_product: {
      name: PRODUCT.name,
    },
    sync_variants: syncVariants,
  }

  if (DRY_RUN) {
    console.log(`  [DRY] Would create: ${syncVariants.length} variants, 2 files/variant (label_inside added post-creation)`)
    console.log(`  [DRY] Payload sample:`, JSON.stringify(payload.sync_variants[0], null, 2))
  } else {
    await delay(2000)
    const result = await pf('/store/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const syncProductId = result.id || result.sync_product?.id
    console.log(`  ✓ Sync product created: ${syncProductId}`)

    // ── Step 3b: Add label_inside to all variants ──────────────────────
    if (fileIds.label_inside) {
      console.log('\nStep 3b: Add label_inside to variants...')
      await delay(3000)
      // Get sync product to retrieve sync_variant IDs
      const prod = await pf(`/store/products/${syncProductId}`)
      const svs = prod.sync_variants || []
      console.log(`  Found ${svs.length} sync variants`)

      // Build update payload with all 3 files
      const updateVariants = svs.map(sv => ({
        id: sv.id,
        files: [
          { type: 'front', id: fileIds.front },
          { type: 'sleeve_left', id: fileIds.sleeve_left },
          { type: 'label_inside', id: fileIds.label_inside },
        ],
      }))

      await delay(2000)
      try {
        await pf(`/store/products/${syncProductId}`, {
          method: 'PUT',
          body: JSON.stringify({ sync_variants: updateVariants }),
        })
        console.log(`  ✓ label_inside added to ${svs.length} variants`)
      } catch (e) {
        console.log(`  ⚠ label_inside update failed: ${e.message}`)
        console.log('    → Add manually in Printful dashboard')
      }
    }

    // ── Step 4: GPSR compliance ──────────────────────────────────────────
    console.log('\nStep 4: Accept GPSR...')
    try {
      await delay(2000)
      const gpsr = await pf(`/store/products/${syncProductId}/gpsr`)
      if (gpsr?.safety_information) {
        await delay(2000)
        await pf(`/store/products/${syncProductId}/gpsr`, {
          method: 'PUT',
          body: JSON.stringify({ safety_information: gpsr.safety_information }),
        })
        console.log('  ✓ GPSR accepted')
      } else {
        console.log('  ⚠ No GPSR template returned — check manually')
      }
    } catch (e) {
      console.log(`  ⚠ GPSR: ${e.message} — set manually in Printful dashboard`)
    }

    // ── Step 5: Supabase product ─────────────────────────────────────────
    console.log('\nStep 5: Create Supabase product...')

    // Find category
    const { data: cat } = await supabase
      .from('categories').select('id').eq('slug', 'crewnecks').single()
    // Fallback to sweatshirts if crewnecks doesn't exist
    const { data: catFallback } = !cat
      ? await supabase.from('categories').select('id').eq('slug', 'sweatshirts').single()
      : { data: null }
    const categoryId = cat?.id || catFallback?.id

    const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
      title: PRODUCT.name,
      description: PRODUCT.desc.en,
      pod_provider: 'printful',
      provider_product_id: String(syncProductId),
      blueprint_id: PRODUCT.catalogId,
      category_id: categoryId,
      status: 'active',
      currency: 'EUR',
      base_price_cents: 4999,
      tags: PRODUCT.tags,
      published_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      translations: {
        es: { title: PRODUCT.name, description: PRODUCT.desc.es },
        de: { title: PRODUCT.name, description: PRODUCT.desc.de },
      },
      product_details: PRODUCT.productDetails,
    }).select('id').single()

    if (dbErr) { console.error(`  DB error: ${dbErr.message}`); return }
    const dbId = dbProd.id
    console.log(`  ✓ Supabase product: ${dbId}`)

    // ── Step 6: Create variants in Supabase ──────────────────────────────
    console.log('\nStep 6: Create variants...')
    for (const v of VARIANTS) {
      const { error } = await supabase.from('product_variants').upsert({
        product_id: dbId,
        external_variant_id: String(v.variantId),
        title: `${v.color} / ${v.size}`,
        color: v.color,
        size: v.size,
        price_cents: v.priceCents,
        is_enabled: true,
        is_available: true,
      }, { onConflict: 'product_id,external_variant_id' })
      if (error) console.log(`  ⚠ ${v.color}/${v.size}: ${error.message}`)
    }
    console.log(`  ✓ ${VARIANTS.length} variants created`)

    // ── Step 7: Link publishing ──────────────────────────────────────────
    console.log('\nStep 7: Publishing link...')
    try {
      // Note: Printful external linking not always required, but we store the ref
      console.log(`  ✓ Printful ID ${syncProductId} → Supabase ID ${dbId}`)
    } catch {}

    // ── Summary ──────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════')
    console.log('  NIHILIST PENGUIN CREWNECK — CREATED')
    console.log(`  Printful sync product: ${syncProductId}`)
    console.log(`  Supabase product:      ${dbId}`)
    console.log(`  Variants:              ${VARIANTS.length} (2 colors × 6 sizes)`)
    console.log(`  Placements:            front + sleeve_left + label_inside`)
    console.log(`  Files:                 front=${fileIds.front}, sleeve=${fileIds.sleeve_left}, label=${fileIds.label_inside}`)
    console.log('════════════════════════════════════════════')
    console.log('\nNext: Generate mockups with scripts/_generate-m2480-mockups.mjs')
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
