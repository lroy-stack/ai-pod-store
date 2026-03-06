/**
 * DELETE + RECREATE 6 Kids Products (#2-#7) — Clean Slate
 *
 * Eliminates old products from Printify + Supabase and recreates from cero
 * with correct: print_areas, categories, translations, GPSR, image sync.
 *
 * Usage:
 *   node scripts/_recreate-kids.mjs              # All 6
 *   node scripts/_recreate-kids.mjs --only 2     # Only product #2
 *   node scripts/_recreate-kids.mjs --skip-delete # Skip deletion (if already deleted)
 *   node scripts/_recreate-kids.mjs --dry-run    # Show config only
 */
import { readFileSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_DELETE = process.argv.includes('--skip-delete')
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
  console.error('Missing env vars'); process.exit(1)
}

const supabase = DRY_RUN ? null : createClient(SB_URL, SB_KEY)
const API = 'https://api.printify.com/v1'
const hdrs = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' })
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs(), ...opts.headers } })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`Printify ${r.status} ${r.statusText}: ${body.slice(0, 300)}`)
  }
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// ─── GPSR Template ────────────────────────────────────────────────────────────
const GPSR_HTML = (material) => `<p><strong>Manufacturer:</strong> Textildruck Europa GmbH, Germany</p>
<p><strong>Material:</strong> ${material}</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>`

// ─── Category IDs (from Supabase) ─────────────────────────────────────────────
const CATEGORIES = {
  'baby-clothing':    { id: 'a5f33845-5fb5-439b-a5be-a2bbea23c2db', slug: 'baby-clothing' },
  'kids-tshirts':     { id: '2057480e-21a9-4545-943a-78a2c3ce3dac', slug: 'kids-tshirts' },
  'kids-sweatshirts': { id: 'c309a282-e305-43cb-bc27-b0df4496639f', slug: 'kids-sweatshirts' },
}

// ─── Size regex (corrected with $ anchor) ──────────────────────────────────────
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

// ─── OLD product IDs (to delete) ──────────────────────────────────────────────
const OLD_IDS = {
  2: { pid: '69a38b2546730b56700a4018', sid: '743f1925-cb78-4ad9-a73d-3c29be80464d' },
  3: { pid: '69a38b5d1ec5ca402c0352e0', sid: '8982c0a2-1761-44bd-884f-d861592099aa' },
  4: { pid: '69a38b853b12a90c8e089201', sid: '8aa671b9-5dad-41b8-887f-27c27e8520c7' },
  5: { pid: '69a38bac5a653e214b0be2f4', sid: '2c0e6015-6b4c-4713-948a-a58efb96cbb0' },
  6: { pid: '69a38bda3b12a90c8e08920c', sid: '62c85f65-3d67-4961-9024-ab45e7100b57' },
  7: { pid: '69a38c03874d66e74c0ea105', sid: '9805dca8-5179-4312-8963-0018248aa315' },
}

// ─── 6 Product Definitions (CORRECT current state) ────────────────────────────
const PRODUCTS = [
  // #2 Bug Reporter — Baby T-Shirt (BP1025, P26)
  // Front: lockup dark (light garments), Back: main design
  {
    num: 2,
    name: 'Bug Reporter',
    designFile: '02-bug-reporter.png',
    blueprintId: 1025,
    printProviderId: 26,
    placeholders: [
      { position: 'front', file: 'branding-back-lockup-dark.png', x: 0.5, y: 0.35, scale: 0.55 },
      { position: 'back',  file: '02-bug-reporter.png',           x: 0.5, y: 0.45, scale: 1 },
    ],
    category: 'baby-clothing',
    preferredColors: ['White', 'Heather Grey Melange', 'Nautical Navy'],
    excludeColors: [],
    priceCents: 1799,
    material: '100% Cotton',
    gpsr: GPSR_HTML('100% Cotton'),
    tags: ['skapara', 'baby', 'kids', 'bug', 'developer', 'junior', 'tech'],
    description: {
      en: 'Officially certified to find bugs in everything. Minimum experience required: 0 days.',
      es: 'Certificado oficialmente para encontrar bugs en todo. Experiencia mínima requerida: 0 días.',
      de: 'Offiziell zertifiziert, Bugs in allem zu finden. Mindesterfahrung: 0 Tage.',
    },
  },
  // #3 Sudo Ice Cream — Kids Softstyle Tee (BP81, P26)
  // Front: main design, Neck: gradient S mark. NO back.
  {
    num: 3,
    name: 'Sudo Ice Cream',
    designFile: '03-sudo-ice-cream.png',
    blueprintId: 81,
    printProviderId: 26,
    placeholders: [
      { position: 'front',      file: '03-sudo-ice-cream.png',                x: 0.5, y: 0.45, scale: 1 },
      { position: 'neck_outer', file: 'branding-neck-smark-gradient.png', x: 0.5, y: 0.5,  scale: 0.8 },
    ],
    category: 'kids-tshirts',
    preferredColors: ['Black', 'Navy', 'Charcoal', 'Purple'],
    excludeColors: [],
    priceCents: 2299,
    material: '100% Ring-Spun Cotton',
    gpsr: GPSR_HTML('100% Ring-Spun Cotton'),
    tags: ['skapara', 'kids', 'sudo', 'terminal', 'ice-cream', 'funny', 'tech'],
    description: {
      en: 'Root access to the freezer. For the kid who knows that with great permissions comes great ice cream.',
      es: 'Acceso root al congelador. Para el niño que sabe que con grandes permisos viene gran helado.',
      de: 'Root-Zugang zum Gefrierschrank. Für das Kind, das weiß: mit großen Berechtigungen kommt großes Eis.',
    },
  },
  // #4 Bedtime 404 — Kids Softstyle Tee (BP81, P26)
  // Front: main design, Neck: gradient S mark. NO back. NO Light Blue.
  {
    num: 4,
    name: 'Bedtime 404',
    designFile: '04-bedtime-not-found.png',
    blueprintId: 81,
    printProviderId: 26,
    placeholders: [
      { position: 'front',      file: '04-bedtime-not-found.png',         x: 0.5, y: 0.45, scale: 1 },
      { position: 'neck_outer', file: 'branding-neck-smark-gradient.png', x: 0.5, y: 0.5,  scale: 0.8 },
    ],
    category: 'kids-tshirts',
    preferredColors: ['Navy', 'Purple', 'Black'],
    excludeColors: ['Light Blue'],
    priceCents: 2299,
    material: '100% Ring-Spun Cotton',
    gpsr: GPSR_HTML('100% Ring-Spun Cotton'),
    tags: ['skapara', 'kids', '404', 'bedtime', 'error', 'funny', 'tech'],
    description: {
      en: 'This page has been permanently moved to NEVER. For the night owl who runs on infinite loops.',
      es: 'Esta página se ha movido permanentemente a NUNCA. Para el búho nocturno que corre en bucles infinitos.',
      de: 'Diese Seite wurde dauerhaft nach NIE verschoben. Für die Nachteule im Endlosloop.',
    },
  },
  // #5 Ctrl+Z Homework — Kids Heavy Cotton Tee (BP157, P26)
  // Front: main design, Back: wordmark white, Neck: gradient S mark
  {
    num: 5,
    name: 'Ctrl+Z Homework',
    designFile: '05-ctrl-z-homework.png',
    blueprintId: 157,
    printProviderId: 26,
    placeholders: [
      { position: 'front', file: '05-ctrl-z-homework.png',              x: 0.5, y: 0.45, scale: 1 },
      { position: 'back',  file: 'branding-back-wordmark-white.png',    x: 0.5, y: 0.2,  scale: 0.3 },
      { position: 'neck',  file: 'branding-neck-smark-gradient.png',    x: 0.5, y: 0.5,  scale: 0.8 },
    ],
    category: 'kids-tshirts',
    preferredColors: ['Black', 'Navy', 'White'],
    excludeColors: [],
    priceCents: 2299,
    material: '100% Cotton',
    gpsr: GPSR_HTML('100% Cotton'),
    tags: ['skapara', 'kids', 'ctrl-z', 'homework', 'keyboard', 'funny', 'tech'],
    description: {
      en: 'The keyboard shortcut every student wishes actually worked. Undo level: expert.',
      es: 'El atajo de teclado que todo estudiante desearía que funcionara de verdad. Nivel de undo: experto.',
      de: 'Die Tastenkombination, die sich jeder Schüler wünscht. Undo-Level: Experte.',
    },
  },
  // #6 AI Raised Me — Kids Hoodie (BP67, P26)
  // Front: lockup white (dark garments), Back: main design
  {
    num: 6,
    name: 'AI Raised Me',
    designFile: '06-ai-raised-me.png',
    blueprintId: 67,
    printProviderId: 26,
    placeholders: [
      { position: 'front', file: 'branding-back-lockup-white.png', x: 0.5, y: 0.35, scale: 0.55 },
      { position: 'back',  file: '06-ai-raised-me.png',            x: 0.5, y: 0.45, scale: 1 },
    ],
    category: 'kids-sweatshirts',
    preferredColors: ['Jet Black', 'Oxford Navy', 'Sky Blue', 'Sun Yellow'],
    excludeColors: [],
    priceCents: 3499,
    material: '80% Ring-Spun Cotton / 20% Polyester',
    gpsr: GPSR_HTML('80% Ring-Spun Cotton / 20% Polyester'),
    tags: ['skapara', 'kids', 'ai', 'hoodie', 'generation-alpha', 'funny', 'tech'],
    description: {
      en: "Generation Alpha's parenting co-pilot. For the kid who asks Siri before asking Mom.",
      es: 'El copiloto de crianza de la Generación Alpha. Para el niño que le pregunta a Siri antes que a mamá.',
      de: 'Der Erziehungs-Copilot der Generation Alpha. Für das Kind, das Siri vor Mama fragt.',
    },
  },
  // #7 Code Works — Kids Crewneck (BP65, P26)
  // Front: main design, Back: lockup white
  {
    num: 7,
    name: 'Code Works',
    designFile: '07-my-code-works.png',
    blueprintId: 65,
    printProviderId: 26,
    placeholders: [
      { position: 'front', file: '07-my-code-works.png',               x: 0.5, y: 0.45, scale: 1 },
      { position: 'back',  file: 'branding-back-lockup-white.png', x: 0.5, y: 0.2,  scale: 0.3 },
    ],
    category: 'kids-sweatshirts',
    preferredColors: ['Jet Black', 'Charcoal', 'Oxford Navy'],
    excludeColors: [],
    priceCents: 3299,
    material: '80% Ring-Spun Cotton / 20% Polyester',
    gpsr: GPSR_HTML('80% Ring-Spun Cotton / 20% Polyester'),
    tags: ['skapara', 'kids', 'code', 'crewneck', 'developer', 'funny', 'tech'],
    description: {
      en: 'All tests passing. Zero understanding. The junior developer origin story.',
      es: 'Todos los tests pasan. Cero comprensión. El origin story del junior developer.',
      de: 'Alle Tests bestanden. Null Verständnis. Die Origin Story des Junior-Developers.',
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterVariantsByColor(variants, preferredColors, excludeColors) {
  let pool = variants
  // Exclude colors first
  if (excludeColors.length) {
    pool = pool.filter(v => {
      const title = v.title.toLowerCase()
      return !excludeColors.some(c => title.includes(c.toLowerCase()))
    })
  }
  if (!preferredColors.length) return pool.slice(0, 5)
  const matched = pool.filter(v => {
    const title = v.title.toLowerCase()
    return preferredColors.some(c => title.includes(c.toLowerCase()))
  })
  if (matched.length < 2) {
    const remaining = pool.filter(v => !matched.includes(v))
    return [...matched, ...remaining].slice(0, Math.max(3, preferredColors.length))
  }
  return matched
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: DELETE OLD PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

async function deleteOldProducts(nums) {
  console.log('\n' + '═'.repeat(60))
  console.log('  PHASE 1: DELETING OLD PRODUCTS')
  console.log('═'.repeat(60))

  for (const num of nums) {
    const old = OLD_IDS[num]
    if (!old) continue
    const prod = PRODUCTS.find(p => p.num === num)
    console.log(`\n  #${num} ${prod.name}:`)

    // Delete from Printify
    try {
      // Unpublish first
      await api(`/shops/${SHOP_ID}/products/${old.pid}/unpublish.json`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      console.log(`    Printify: unpublished`)
      await delay(1000)
    } catch (e) {
      console.log(`    Printify: unpublish skipped (${e.message.slice(0, 60)})`)
    }

    try {
      await api(`/shops/${SHOP_ID}/products/${old.pid}.json`, { method: 'DELETE' })
      console.log(`    Printify: DELETED`)
    } catch (e) {
      console.log(`    Printify: delete failed (${e.message.slice(0, 80)})`)
    }

    // Delete from Supabase (variants first, then product)
    try {
      const { count: vc } = await supabase.from('product_variants')
        .delete({ count: 'exact' }).eq('product_id', old.sid)
      console.log(`    Supabase: ${vc || 0} variants deleted`)

      const { count: pc } = await supabase.from('products')
        .delete({ count: 'exact' }).eq('id', old.sid)
      console.log(`    Supabase: product ${pc ? 'DELETED' : 'not found'}`)
    } catch (e) {
      console.log(`    Supabase: ${e.message}`)
    }

    await delay(500)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: UPLOAD DESIGNS
// ═══════════════════════════════════════════════════════════════════════════════

async function uploadDesigns(products) {
  console.log('\n' + '═'.repeat(60))
  console.log('  PHASE 2: UPLOADING DESIGNS TO PRINTIFY')
  console.log('═'.repeat(60))

  const uploadIds = new Map()

  // Collect unique files
  const allFiles = new Set()
  for (const p of products) {
    for (const ph of p.placeholders) {
      allFiles.add(ph.file)
    }
  }

  for (const file of allFiles) {
    const filePath = join(DESIGNS_DIR, file)
    if (!existsSync(filePath)) {
      console.error(`  MISSING: ${filePath}`)
      process.exit(1)
    }
    const buffer = readFileSync(filePath)
    const label = file.startsWith('branding-') ? '(branding)' : '(design)'
    console.log(`\n  Uploading ${file} ${label} (${Math.round(buffer.length / 1024)}KB)...`)

    await delay(2000)
    const result = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: `skapara-kids-${file}`, contents: buffer.toString('base64') }),
    })
    uploadIds.set(file, result.id)
    console.log(`  -> ${result.id}`)
  }

  return uploadIds
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 3: CREATE PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

async function createProduct(prod, uploadIds) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  #${prod.num} ${prod.name} (BP${prod.blueprintId} / P${prod.printProviderId})`)
  console.log('─'.repeat(60))

  // Step 1: Get blueprint variants
  console.log('  1. Fetching blueprint variants...')
  await delay(1000)
  const bpVariants = await api(`/catalog/blueprints/${prod.blueprintId}/print_providers/${prod.printProviderId}/variants.json`)
  const allVariants = bpVariants.variants || bpVariants
  console.log(`     ${allVariants.length} total variants available`)

  // Step 2: Filter variants by preferred colors (exclude unwanted)
  const selected = filterVariantsByColor(allVariants, prod.preferredColors, prod.excludeColors)
  console.log(`     ${selected.length} variants selected`)

  // Step 3: Build print_areas with placeholders
  const placeholders = prod.placeholders.map(ph => ({
    position: ph.position,
    images: [{ id: uploadIds.get(ph.file), x: ph.x, y: ph.y, scale: ph.scale, angle: 0 }],
  }))

  // Step 4: Create product on Printify
  console.log('  2. Creating product on Printify...')
  await delay(2000)
  const printifyProduct = await api(`/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: prod.name,
      description: prod.description.en,
      blueprint_id: prod.blueprintId,
      print_provider_id: prod.printProviderId,
      variants: selected.map(v => ({
        id: v.id,
        price: prod.priceCents,
        is_enabled: true,
      })),
      print_areas: [{
        variant_ids: selected.map(v => v.id),
        placeholders,
      }],
      tags: prod.tags,
    }),
  })

  const printifyId = printifyProduct.id
  console.log(`     Printify ID: ${printifyId}`)

  // Step 5: Set GPSR safety information
  console.log('  3. Setting GPSR safety info...')
  try {
    await delay(1000)
    await api(`/shops/${SHOP_ID}/products/${printifyId}.json`, {
      method: 'PUT',
      body: JSON.stringify({ safety_information: prod.gpsr }),
    })
    console.log('     GPSR set')
  } catch (e) {
    console.warn(`     GPSR failed: ${e.message.slice(0, 80)}`)
  }

  // Step 6: Publish
  console.log('  4. Publishing...')
  await delay(1500)
  await api(`/shops/${SHOP_ID}/products/${printifyId}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('     Published — waiting 15s for mockup generation...')
  await delay(15000)

  // Step 7: Insert into Supabase
  console.log('  5. Inserting into Supabase...')
  const cat = CATEGORIES[prod.category]
  const { data: dbProduct, error: dbError } = await supabase
    .from('products')
    .insert({
      title: prod.name,
      description: prod.description.en,
      printify_id: printifyId,
      blueprint_id: prod.blueprintId,
      print_provider_id: prod.printProviderId,
      category: cat.slug,
      category_id: cat.id,
      status: 'active',
      currency: 'EUR',
      base_price_cents: prod.priceCents,
      tags: prod.tags,
      published_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      translations: {
        es: { title: prod.name, description: prod.description.es },
        de: { title: prod.name, description: prod.description.de },
      },
      product_details: {
        safety_information: prod.gpsr,
        material: prod.material,
        care_instructions: 'Machine wash cold, inside out. Tumble dry low.',
        print_technique: 'DTG (Direct-to-Garment)',
        manufacturing_country: 'Germany',
        brand: 'SKAPARA',
        provider: 'Textildruck Europa (P26)',
      },
    })
    .select('id')
    .single()

  if (dbError) {
    console.error(`     Supabase error: ${dbError.message}`)
    return { num: prod.num, name: prod.name, status: 'partial', printifyId, error: dbError.message }
  }

  const dbId = dbProduct.id
  console.log(`     Supabase ID: ${dbId}`)

  // Step 8: Confirm publishing
  try {
    await delay(500)
    await api(`/shops/${SHOP_ID}/products/${printifyId}/publishing_succeeded.json`, {
      method: 'POST',
      body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } }),
    })
    console.log('     Publishing confirmed')
  } catch (e) {
    console.warn(`     publishing_succeeded: ${e.message.slice(0, 60)}`)
  }

  // Step 9: Insert variants
  console.log('  6. Inserting variants...')
  for (const sv of selected) {
    const parsed = parseVariantTitle(sv.title)
    await supabase.from('product_variants').upsert(
      {
        product_id: dbId,
        printify_variant_id: String(sv.id),
        title: sv.title,
        color: parsed.color,
        size: parsed.size,
        price_cents: prod.priceCents,
        is_enabled: true,
        is_available: true,
      },
      { onConflict: 'product_id,printify_variant_id' },
    )
  }
  console.log(`     ${selected.length} variants`)

  // Step 10: Harvest mockup images (front-first) and map to variants
  console.log('  7. Harvesting mockup images...')
  await delay(2000)
  const fullProduct = await api(`/shops/${SHOP_ID}/products/${printifyId}.json`)
  const allImages = (fullProduct.images || [])
    .filter(img => img.src && !img.src.includes('size-chart') && !img.src.includes('size_chart'))

  // Sort: front first, then is_default, then others
  const sorted = [...allImages].sort((a, b) => {
    const aFront = (a.src || '').includes('camera_label=front') ? 1 : 0
    const bFront = (b.src || '').includes('camera_label=front') ? 1 : 0
    if (aFront !== bFront) return bFront - aFront
    if (a.is_default && !b.is_default) return -1
    if (b.is_default && !a.is_default) return 1
    return 0
  })

  const imagesPayload = sorted.map(img => ({
    src: img.src,
    alt: prod.name,
    variant_ids: img.variant_ids || [],
    is_default: img.is_default === true,
  }))

  await supabase.from('products').update({ images: imagesPayload }).eq('id', dbId)
  console.log(`     ${imagesPayload.length} images saved (front-first)`)

  // Map variant image_url — first match per variant wins (front)
  const mapped = new Set()
  let mapCount = 0
  for (const img of sorted) {
    for (const vid of (img.variant_ids || [])) {
      if (mapped.has(String(vid))) continue
      mapped.add(String(vid))
      await supabase.from('product_variants')
        .update({ image_url: img.src })
        .eq('product_id', dbId)
        .eq('printify_variant_id', String(vid))
      mapCount++
    }
  }
  console.log(`     ${mapCount} variant image_urls mapped`)

  // Verify card image is front
  const firstLabel = sorted[0]?.src?.match(/camera_label=([^&]+)/)?.[1] || 'unknown'
  console.log(`     Card image: ${firstLabel}`)

  return {
    num: prod.num,
    name: prod.name,
    status: 'success',
    printifyId,
    supabaseId: dbId,
    variants: selected.length,
    images: sorted.length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const products = ONLY ? PRODUCTS.filter(p => p.num === ONLY) : PRODUCTS
  const nums = products.map(p => p.num)

  console.log(`\n  SKAPARA Kids — Recreating ${products.length} products`)
  console.log(`  Products: ${products.map(p => `#${p.num} ${p.name}`).join(', ')}`)

  if (DRY_RUN) {
    console.log('\n  --- DRY RUN ---\n')
    for (const p of products) {
      console.log(`  #${p.num} "${p.name}"`)
      console.log(`    BP${p.blueprintId} / P${p.printProviderId} / ${p.category}`)
      console.log(`    Price: ${(p.priceCents / 100).toFixed(2)}EUR`)
      console.log(`    Colors: ${p.preferredColors.join(', ')}${p.excludeColors.length ? ` (exclude: ${p.excludeColors.join(', ')})` : ''}`)
      console.log(`    Placeholders:`)
      for (const ph of p.placeholders) {
        const exists = existsSync(join(DESIGNS_DIR, ph.file))
        console.log(`      ${ph.position}: ${ph.file} (${ph.x},${ph.y},${ph.scale}) ${exists ? 'OK' : 'MISSING!'}`)
      }
      console.log(`    Translations: en, es, de`)
      console.log(`    Tags: ${p.tags.join(', ')}`)
      console.log()
    }
    return
  }

  // Phase 1: Delete old products
  if (!SKIP_DELETE) {
    await deleteOldProducts(nums)
  }

  // Phase 2: Upload designs
  const uploadIds = await uploadDesigns(products)

  // Phase 3: Create products
  console.log('\n' + '═'.repeat(60))
  console.log('  PHASE 3: CREATING NEW PRODUCTS')
  console.log('═'.repeat(60))

  const results = []
  for (const prod of products) {
    try {
      const result = await createProduct(prod, uploadIds)
      results.push(result)
    } catch (e) {
      console.error(`  ERROR #${prod.num}: ${e.message}`)
      results.push({ num: prod.num, name: prod.name, status: 'error', error: e.message })
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('  SUMMARY')
  console.log('═'.repeat(60))

  for (const r of results) {
    const icon = r.status === 'success' ? '  OK' : ' ERR'
    const details = r.status === 'success'
      ? `${r.variants} variants, ${r.images} images | Printify:${r.printifyId} | SB:${r.supabaseId}`
      : r.error || 'unknown error'
    console.log(`  ${icon} #${r.num} ${r.name} — ${details}`)
  }

  const ok = results.filter(r => r.status === 'success').length
  const fail = results.filter(r => r.status !== 'success').length
  console.log(`\n  OK: ${ok} | Failed: ${fail}\n`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
