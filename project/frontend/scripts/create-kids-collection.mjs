/**
 * SKAPARA — 8 Kids Collection Products
 *
 * Creates 8 kids products on Printify + Supabase with:
 * - PNG upload from /public/kids-designs/
 * - Variant filtering by preferred colors
 * - GPSR safety information (EU mandatory)
 * - Translations (EN/ES/DE)
 * - Full sync for mockup images
 *
 * Usage:
 *   node scripts/create-kids-collection.mjs              # Create all 8 products
 *   node scripts/create-kids-collection.mjs --dry-run    # Show what would be created (no API calls)
 *   node scripts/create-kids-collection.mjs --only 3     # Create only product #3
 */
import { readFileSync, statSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const ONLY = process.argv.includes('--only') ? Number(process.argv[process.argv.indexOf('--only') + 1]) : null
const ROOT = join(import.meta.dirname, '..')
const DESIGNS_DIR = join(ROOT, 'public', 'kids-designs')

// ─── Env ─────────────────────────────────────────────────────────────────────
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')

if (!DRY_RUN && (!TOKEN || !SHOP_ID || !SB_URL || !SB_KEY)) {
  console.error('Missing env vars: PRINTIFY_API_TOKEN, PRINTIFY_SHOP_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY')
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

// ─── Category IDs (from Supabase) ────────────────────────────────────────────
const CATEGORIES = {
  'baby-clothing':    'a5f33845-5fb5-439b-a5be-a2bbea23c2db',
  'kids-tshirts':     '2057480e-21a9-4545-943a-78a2c3ce3dac',
  'kids-sweatshirts': 'c309a282-e305-43cb-bc27-b0df4496639f',
  'sneakers':         'f9e9eb54-3cb1-4f26-b7cf-8ac29d78ee28',
}

// ─── GPSR Templates ──────────────────────────────────────────────────────────
const GPSR = {
  dtgCotton: (material) => `<p><strong>Manufacturer:</strong> Textildruck Europa GmbH, Germany</p>
<p><strong>Material:</strong> ${material}</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>`,
  clogs: `<p><strong>Manufacturer:</strong> Smart Printee</p>
<p><strong>Material:</strong> EVA foam, sublimation printed</p>
<p><strong>Print technique:</strong> Sublimation print on EVA</p>
<p><strong>Care:</strong> Wipe clean with damp cloth. Air dry.</p>
<p><strong>Compliance:</strong> REACH compliant</p>`,
}

// ─── 8 Product Definitions ───────────────────────────────────────────────────

const PRODUCTS = [
  // 1. Compiling Tears — Baby Bodysuit
  {
    num: 1,
    name: 'Compiling Tears',
    designFile: '01-not-crying-compiling.png',
    blueprintId: 1045,
    printProviderId: 26,
    position: 'front',
    categorySlug: 'baby-clothing',
    preferredColors: ['White', 'Powder Pink', 'Dusty Blue'],
    priceCents: 1999,
    material: '100% Organic Cotton',
    gpsr: GPSR.dtgCotton('100% Organic Cotton'),
    tags: ['skapara', 'baby', 'kids', 'coding', 'tech', 'funny', 'bodysuit'],
    description: {
      en: "Every build has its tears. Your baby's first debug session starts here.",
      es: 'Cada build tiene sus lágrimas. La primera sesión de debug de tu bebé empieza aquí.',
      de: 'Jeder Build hat seine Tränen. Die erste Debug-Session deines Babys beginnt hier.',
    },
  },
  // 2. Bug Reporter — Baby T-Shirt (BP1025: front 1391x1583, back 1391x1583)
  {
    num: 2,
    name: 'Bug Reporter',
    designFile: '02-bug-reporter.png',
    blueprintId: 1025,
    printProviderId: 26,
    position: 'front',
    // Multi-position: back branding (rotation #1: wordmark dark — light garments)
    backDesign: { file: 'branding-back-wordmark-dark.png', x: 0.5, y: 0.2, scale: 0.3 },
    categorySlug: 'baby-clothing',
    preferredColors: ['White', 'Heather Grey Melange', 'Nautical Navy'],
    priceCents: 1799,
    material: '100% Cotton',
    gpsr: GPSR.dtgCotton('100% Cotton'),
    tags: ['skapara', 'baby', 'kids', 'bug', 'developer', 'junior', 'tech'],
    description: {
      en: 'Officially certified to find bugs in everything. Minimum experience required: 0 days.',
      es: 'Certificado oficialmente para encontrar bugs en todo. Experiencia mínima requerida: 0 días.',
      de: 'Offiziell zertifiziert, Bugs in allem zu finden. Mindesterfahrung: 0 Tage.',
    },
  },
  // 3. Sudo Ice Cream — Kids Softstyle Tee (BP81: front 2362x2908, back 2362x2908, neck_outer 1181x1181, sleeves 1181x1181)
  {
    num: 3,
    name: 'Sudo Ice Cream',
    designFile: '03-sudo-ice-cream.png',
    blueprintId: 81,
    printProviderId: 26,
    position: 'front',
    // Multi-position: back branding (rotation #2: S mark white — dark garments)
    backDesign: { file: 'branding-back-smark-white.png', x: 0.5, y: 0.2, scale: 0.25 },
    // Neck: gradient S mark (kids = colorful)
    neckDesign: { file: 'branding-neck-smark-gradient.png', position: 'neck_outer', x: 0.5, y: 0.5, scale: 0.8 },
    categorySlug: 'kids-tshirts',
    preferredColors: ['Black', 'Navy', 'Charcoal', 'Purple'],
    priceCents: 2299,
    material: '100% Ring-Spun Cotton',
    gpsr: GPSR.dtgCotton('100% Ring-Spun Cotton'),
    tags: ['skapara', 'kids', 'sudo', 'terminal', 'ice-cream', 'funny', 'tech'],
    description: {
      en: 'Root access to the freezer. For the kid who knows that with great permissions comes great ice cream.',
      es: 'Acceso root al congelador. Para el niño que sabe que con grandes permisos viene gran helado.',
      de: 'Root-Zugang zum Gefrierschrank. Für das Kind, das weiß: mit großen Berechtigungen kommt großes Eis.',
    },
  },
  // 4. Bedtime 404 — Kids Softstyle Tee (BP81: front 2362x2908, back 2362x2908, neck_outer 1181x1181, sleeves 1181x1181)
  {
    num: 4,
    name: 'Bedtime 404',
    designFile: '04-bedtime-not-found.png',
    blueprintId: 81,
    printProviderId: 26,
    position: 'front',
    // Multi-position: back branding (rotation #3: lockup white — dark garments)
    backDesign: { file: 'branding-back-lockup-white.png', x: 0.5, y: 0.2, scale: 0.3 },
    // Neck: gradient S mark (kids = colorful)
    neckDesign: { file: 'branding-neck-smark-gradient.png', position: 'neck_outer', x: 0.5, y: 0.5, scale: 0.8 },
    categorySlug: 'kids-tshirts',
    preferredColors: ['Navy', 'Purple', 'Black', 'Light Blue'],
    priceCents: 2299,
    material: '100% Ring-Spun Cotton',
    gpsr: GPSR.dtgCotton('100% Ring-Spun Cotton'),
    tags: ['skapara', 'kids', '404', 'bedtime', 'error', 'funny', 'tech'],
    description: {
      en: 'This page has been permanently moved to NEVER. For the night owl who runs on infinite loops.',
      es: 'Esta página se ha movido permanentemente a NUNCA. Para el búho nocturno que corre en bucles infinitos.',
      de: 'Diese Seite wurde dauerhaft nach NIE verschoben. Für die Nachteule im Endlosloop.',
    },
  },
  // 5. Ctrl+Z Homework — Kids Heavy Cotton Tee (BP157: front 2244x2735, back 2244x2735, neck 750x750)
  {
    num: 5,
    name: 'Ctrl+Z Homework',
    designFile: '05-ctrl-z-homework.png',
    blueprintId: 157,
    printProviderId: 26,
    position: 'front',
    // Multi-position: back branding (rotation #4: wordmark white — majority dark garments)
    backDesign: { file: 'branding-back-wordmark-white.png', x: 0.5, y: 0.2, scale: 0.3 },
    // Neck: gradient S mark (kids = colorful) — BP157 only has "neck" not "neck_outer"
    neckDesign: { file: 'branding-neck-smark-gradient.png', position: 'neck', x: 0.5, y: 0.5, scale: 0.8 },
    categorySlug: 'kids-tshirts',
    preferredColors: ['Black', 'Navy', 'White'],
    priceCents: 2299,
    material: '100% Cotton',
    gpsr: GPSR.dtgCotton('100% Cotton'),
    tags: ['skapara', 'kids', 'ctrl-z', 'homework', 'keyboard', 'funny', 'tech'],
    description: {
      en: 'The keyboard shortcut every student wishes actually worked. Undo level: expert.',
      es: 'El atajo de teclado que todo estudiante desearía que funcionara de verdad. Nivel de undo: experto.',
      de: 'Die Tastenkombination, die sich jeder Schüler wünscht. Undo-Level: Experte.',
    },
  },
  // 6. AI Raised Me — Kids Hoodie (BP67: front 1890x1512, back 2008x2471)
  {
    num: 6,
    name: 'AI Raised Me',
    designFile: '06-ai-raised-me.png',
    blueprintId: 67,
    printProviderId: 26,
    position: 'front',
    // Multi-position: back branding (rotation #5: S mark white — mostly dark garments)
    backDesign: { file: 'branding-back-smark-white.png', x: 0.5, y: 0.2, scale: 0.25 },
    categorySlug: 'kids-sweatshirts',
    preferredColors: ['Jet Black', 'Oxford Navy', 'Sky Blue', 'Sun Yellow'],
    priceCents: 3499,
    material: '80% Ring-Spun Cotton / 20% Polyester',
    gpsr: GPSR.dtgCotton('80% Ring-Spun Cotton / 20% Polyester'),
    tags: ['skapara', 'kids', 'ai', 'hoodie', 'generation-alpha', 'funny', 'tech'],
    description: {
      en: "Generation Alpha's parenting co-pilot. For the kid who asks Siri before asking Mom.",
      es: 'El copiloto de crianza de la Generación Alpha. Para el niño que le pregunta a Siri antes que a mamá.',
      de: 'Der Erziehungs-Copilot der Generation Alpha. Für das Kind, das Siri vor Mama fragt.',
    },
  },
  // 7. Code Works — Kids Crewneck (BP65: front 2008x2471, back 2008x2471)
  {
    num: 7,
    name: 'Code Works',
    designFile: '07-my-code-works.png',
    blueprintId: 65,
    printProviderId: 26,
    position: 'front',
    // Multi-position: back branding (rotation #6: lockup white — all dark garments)
    backDesign: { file: 'branding-back-lockup-white.png', x: 0.5, y: 0.2, scale: 0.3 },
    categorySlug: 'kids-sweatshirts',
    preferredColors: ['Jet Black', 'Charcoal', 'Oxford Navy'],
    priceCents: 3299,
    material: '80% Ring-Spun Cotton / 20% Polyester',
    gpsr: GPSR.dtgCotton('80% Ring-Spun Cotton / 20% Polyester'),
    tags: ['skapara', 'kids', 'code', 'crewneck', 'developer', 'funny', 'tech'],
    description: {
      en: 'All tests passing. Zero understanding. The junior developer origin story.',
      es: 'Todos los tests pasan. Cero comprensión. El origin story del junior developer.',
      de: 'Alle Tests bestanden. Null Verständnis. Die Origin Story des Junior-Developers.',
    },
  },
  // 8. Prompt Engineer — Kids EVA Clogs (AOP sublimation)
  {
    num: 8,
    name: 'Prompt Engineer',
    designFile: '08-future-prompt-engineer.png',
    blueprintId: 1534,
    printProviderId: 90,
    position: 'front', // AOP — will query actual position from API
    categorySlug: 'sneakers',
    preferredColors: ['Black', 'White'],
    priceCents: 2999,
    material: 'EVA foam, sublimation printed',
    gpsr: GPSR.clogs,
    tags: ['skapara', 'kids', 'prompt', 'engineer', 'clogs', 'ai', 'tech'],
    description: {
      en: 'Every step is a new prompt. For the kid who is already engineering the future, one word at a time.',
      es: 'Cada paso es un nuevo prompt. Para el niño que ya está ingenieriando el futuro, una palabra a la vez.',
      de: 'Jeder Schritt ist ein neuer Prompt. Für das Kind, das die Zukunft schon engineert, ein Wort nach dem anderen.',
    },
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filterVariantsByColor(variants, preferredColors) {
  if (!preferredColors.length) return variants.slice(0, 5)

  const matched = variants.filter((v) => {
    const title = v.title.toLowerCase()
    return preferredColors.some((c) => title.includes(c.toLowerCase()))
  })

  // If too few matches, add more variants
  if (matched.length < 2) {
    const remaining = variants.filter((v) => !matched.includes(v))
    return [...matched, ...remaining].slice(0, Math.max(3, preferredColors.length))
  }

  return matched
}

function parseVariantColor(title) {
  // Handle both formats: "Color / Size" and "Size / Color"
  // Split on " / " (space-slash-space) to avoid splitting "S/M" size ranges
  const parts = title.split(' / ').map(p => p.trim())
  if (parts.length >= 3) {
    const last = parts[parts.length - 1]
    if (SIZE_RE.test(last)) return { color: parts.slice(0, -1).join(' / '), size: last }
    return { color: parts.slice(1).join(' / '), size: parts[0] }
  }
  if (parts.length === 2) {
    // Check if first part is an EXACT size match ($ anchor prevents "Light Blue" matching "L")
    if (SIZE_RE.test(parts[0])) {
      return { size: parts[0], color: parts[1] }
    }
    return { color: parts[0], size: parts[1] }
  }
  return { color: parts[0] || 'Default', size: parts[1] || 'One Size' }
}

// Corrected size regex — $ anchor ensures full token match
// "Light Blue" does NOT match L$, "Sky Blue" does NOT match S$
const SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|2XS|S\/M|L\/XL|NB|One\s*size|US\s+\d+(?:\.\d+)?|\d+.*)$/i

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const products = ONLY ? PRODUCTS.filter(p => p.num === ONLY) : PRODUCTS
  console.log(`\n🧒 SKAPARA Kids Collection — Creating ${products.length} products\n`)

  if (DRY_RUN) {
    console.log('--- DRY RUN MODE (no API calls) ---\n')
    for (const p of products) {
      const fSize = statSync(join(DESIGNS_DIR, p.designFile)).size
      console.log(`#${p.num} "${p.name}"`)
      console.log(`   BP${p.blueprintId} / P${p.printProviderId} / ${p.categorySlug}`)
      console.log(`   Design: ${p.designFile} (${Math.round(fSize / 1024)}KB)`)
      if (p.backDesign) console.log(`   Back: ${p.backDesign.file} (x:${p.backDesign.x}, y:${p.backDesign.y}, scale:${p.backDesign.scale})`)
      if (p.neckDesign) console.log(`   Neck (${p.neckDesign.position}): ${p.neckDesign.file} (scale:${p.neckDesign.scale})`)
      console.log(`   Colors: ${p.preferredColors.join(', ')}`)
      console.log(`   Price: €${(p.priceCents / 100).toFixed(2)}`)
      console.log(`   Tags: ${p.tags.join(', ')}`)
      console.log()
    }
    console.log('Dry run complete. Remove --dry-run to create products.')
    return
  }

  const results = []

  // ── STEP 1: Upload design PNGs (front + back + neck branding) ────────────
  console.log('Step 1: Uploading design images to Printify...\n')

  const uploadIds = new Map()

  // Collect ALL unique files: front designs + back branding + neck branding
  const allFiles = new Set()
  for (const p of products) {
    allFiles.add(p.designFile)
    if (p.backDesign) allFiles.add(p.backDesign.file)
    if (p.neckDesign) allFiles.add(p.neckDesign.file)
  }
  const uniqueFiles = [...allFiles]

  for (const file of uniqueFiles) {
    try {
      const filePath = join(DESIGNS_DIR, file)
      const buffer = readFileSync(filePath)
      const base64 = buffer.toString('base64')
      const label = file.startsWith('branding-') ? '(branding)' : '(design)'

      console.log(`  Uploading ${file} ${label} (${Math.round(buffer.length / 1024)}KB)...`)
      await delay(2000)

      const result = await api('/uploads/images.json', {
        method: 'POST',
        body: JSON.stringify({ file_name: `skapara-kids-${file}`, contents: base64 }),
      })

      uploadIds.set(file, result.id)
      console.log(`  ✓ ${file} → ${result.id}`)
    } catch (e) {
      console.error(`  ✗ ${file}: ${e.message}`)
    }
  }

  console.log(`\n  ${uploadIds.size}/${uniqueFiles.length} designs uploaded\n`)

  // ── STEP 2: Query variant info per blueprint ────────────────────────────
  console.log('Step 2: Fetching blueprint variants...\n')

  const bpVariants = new Map()
  const uniqueBPs = [...new Set(products.map(p => `${p.blueprintId}:${p.printProviderId}`))]

  for (const key of uniqueBPs) {
    const [bpId, providerId] = key.split(':').map(Number)
    try {
      await delay(1500)
      const data = await api(`/catalog/blueprints/${bpId}/print_providers/${providerId}/variants.json`)
      const variants = data.variants || data
      bpVariants.set(key, Array.isArray(variants) ? variants : [])
      console.log(`  BP${bpId}/P${providerId}: ${bpVariants.get(key).length} variants`)

      // Also get placeholder info
      await delay(1000)
      const shipping = await api(`/catalog/blueprints/${bpId}/print_providers/${providerId}/shipping.json`).catch(() => null)
      if (shipping) {
        console.log(`  BP${bpId} shipping OK`)
      }
    } catch (e) {
      console.error(`  ✗ BP${bpId}/P${providerId}: ${e.message}`)
    }
  }

  // ── STEP 3: Create products one by one ──────────────────────────────────
  console.log('\nStep 3: Creating products...\n')

  for (const prod of products) {
    const uploadId = uploadIds.get(prod.designFile)
    const key = `${prod.blueprintId}:${prod.printProviderId}`
    const variants = bpVariants.get(key)

    if (!uploadId) {
      console.error(`  ✗ #${prod.num} "${prod.name}": Design not uploaded`)
      results.push({ num: prod.num, name: prod.name, status: 'error', error: 'Design not uploaded' })
      continue
    }
    if (!variants || !variants.length) {
      console.error(`  ✗ #${prod.num} "${prod.name}": No variants for BP${prod.blueprintId}`)
      results.push({ num: prod.num, name: prod.name, status: 'error', error: 'No variants' })
      continue
    }

    try {
      // Filter variants by preferred colors
      const selected = filterVariantsByColor(variants, prod.preferredColors)
      console.log(`  #${prod.num} "${prod.name}" — ${selected.length} variants (from ${variants.length})`)
      console.log(`    Colors: ${selected.map(v => v.title).join(', ')}`)

      // Detect available placeholder positions from variant data
      let availablePositions = [prod.position]
      if (selected[0]?.placeholders?.length) {
        availablePositions = selected[0].placeholders.map(p => p.position)
        console.log(`    Available positions: ${availablePositions.join(', ')}`)
      }

      // Build position-specific placeholders (multi-position golden rule)
      const placeholders = []

      // Front: always use the main design
      placeholders.push({
        position: 'front',
        images: [{ id: uploadId, x: 0.5, y: 0.45, scale: 1, angle: 0 }],
      })

      // Back: use branding design if configured AND position available
      if (prod.backDesign && availablePositions.includes('back')) {
        const backUploadId = uploadIds.get(prod.backDesign.file)
        if (backUploadId) {
          placeholders.push({
            position: 'back',
            images: [{
              id: backUploadId,
              x: prod.backDesign.x,
              y: prod.backDesign.y,
              scale: prod.backDesign.scale,
              angle: 0,
            }],
          })
          console.log(`    Back: ${prod.backDesign.file} (scale: ${prod.backDesign.scale})`)
        } else {
          console.warn(`    ⚠ Back design ${prod.backDesign.file} not uploaded`)
        }
      }

      // Neck: use gradient S mark if configured AND position available
      if (prod.neckDesign && availablePositions.includes(prod.neckDesign.position)) {
        const neckUploadId = uploadIds.get(prod.neckDesign.file)
        if (neckUploadId) {
          placeholders.push({
            position: prod.neckDesign.position,
            images: [{
              id: neckUploadId,
              x: prod.neckDesign.x,
              y: prod.neckDesign.y,
              scale: prod.neckDesign.scale,
              angle: 0,
            }],
          })
          console.log(`    Neck (${prod.neckDesign.position}): ${prod.neckDesign.file} (scale: ${prod.neckDesign.scale})`)
        } else {
          console.warn(`    ⚠ Neck design ${prod.neckDesign.file} not uploaded`)
        }
      }

      // For AOP products (clogs), fill ALL remaining positions with front design
      if (prod.blueprintId === 1534) {
        for (const pos of availablePositions) {
          if (!placeholders.find(p => p.position === pos)) {
            placeholders.push({
              position: pos,
              images: [{ id: uploadId, x: 0.5, y: 0.5, scale: 1, angle: 0 }],
            })
          }
        }
      }

      console.log(`    Using ${placeholders.length} position(s): ${placeholders.map(p => p.position).join(', ')}`)

      await delay(2000)

      // Create product on Printify
      const printifyProduct = await api(`/shops/${SHOP_ID}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          title: prod.name,
          description: prod.description.en,
          blueprint_id: prod.blueprintId,
          print_provider_id: prod.printProviderId,
          variants: selected.map(v => ({ id: v.id, price: prod.priceCents, is_enabled: true })),
          print_areas: [{
            variant_ids: selected.map(v => v.id),
            placeholders,
          }],
          tags: prod.tags,
        }),
      })

      const printifyId = printifyProduct.id
      console.log(`    ✓ Printify product created: ${printifyId}`)

      // ── STEP 4: GPSR Safety Information ───────────────────────────────
      try {
        await delay(1000)
        await api(`/shops/${SHOP_ID}/products/${printifyId}.json`, {
          method: 'PUT',
          body: JSON.stringify({ safety_information: prod.gpsr }),
        })
        console.log(`    ✓ GPSR safety info set`)
      } catch (e) {
        console.warn(`    ⚠ GPSR failed: ${e.message}`)
      }

      // ── STEP 5: Publish ───────────────────────────────────────────────
      await delay(1500)
      await api(`/shops/${SHOP_ID}/products/${printifyId}/publish.json`, {
        method: 'POST',
        body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
      })
      console.log(`    ✓ Published`)

      // ── STEP 6: Insert into Supabase ──────────────────────────────────
      const categoryId = CATEGORIES[prod.categorySlug]

      const { data: dbProduct, error: dbError } = await supabase
        .from('products')
        .insert({
          title: prod.name,
          description: prod.description.en,
          printify_id: printifyId,
          blueprint_id: prod.blueprintId,
          print_provider_id: prod.printProviderId,
          category_id: categoryId,
          status: 'active',
          currency: 'EUR',
          base_price_cents: prod.priceCents,
          tags: prod.tags,
          published_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          product_details: {
            safety_information: prod.gpsr,
            material: prod.material,
            care_instructions: prod.blueprintId === 1534
              ? 'Wipe clean with damp cloth. Air dry.'
              : 'Machine wash cold, inside out. Tumble dry low.',
            print_technique: prod.printProviderId === 90 ? 'Sublimation' : 'DTG (Direct-to-Garment)',
            manufacturing_country: prod.printProviderId === 90 ? 'EU' : 'Germany',
            brand: 'SKAPARA',
            provider: prod.printProviderId === 90 ? 'Smart Printee (P90)' : 'Textildruck Europa (P26)',
          },
          translations: {
            es: { title: prod.name, description: prod.description.es },
            de: { title: prod.name, description: prod.description.de },
          },
        })
        .select('id')
        .single()

      if (dbError) {
        console.error(`    ✗ Supabase insert error: ${dbError.message}`)
        results.push({ num: prod.num, name: prod.name, status: 'partial', printifyId, error: dbError.message })
        continue
      }

      const dbId = dbProduct.id
      console.log(`    ✓ Supabase product: ${dbId}`)

      // ── STEP 7: publishing_succeeded ──────────────────────────────────
      try {
        await delay(500)
        await api(`/shops/${SHOP_ID}/products/${printifyId}/publishing_succeeded.json`, {
          method: 'POST',
          body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } }),
        })
        console.log(`    ✓ Publishing confirmed`)
      } catch (e) {
        console.warn(`    ⚠ publishing_succeeded: ${e.message}`)
      }

      // ── STEP 8: Insert variants into product_variants ─────────────────
      for (const sv of selected) {
        const parsed = parseVariantColor(sv.title)
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
      console.log(`    ✓ ${selected.length} variants inserted`)

      // ── STEP 9: Full sync for mockup images ──────────────────────────
      try {
        await delay(2000)
        const fullProduct = await api(`/shops/${SHOP_ID}/products/${printifyId}.json`)
        // Import and call syncProductFromPrintify dynamically would be ideal,
        // but since we're in .mjs we just store the images from the full product
        const images = (fullProduct.images || [])
          .filter(img => img.src && !img.src.includes('size-chart'))
          .map(img => ({
            src: img.src,
            alt: prod.name,
            variant_ids: img.variant_ids || [],
            is_default: img.is_default === true,
          }))

        if (images.length) {
          await supabase
            .from('products')
            .update({ images })
            .eq('id', dbId)
          console.log(`    ✓ ${images.length} mockup images synced`)

          // Map images to variants for color swatches
          for (const img of images) {
            for (const vid of img.variant_ids) {
              await supabase
                .from('product_variants')
                .update({ image_url: img.src })
                .eq('product_id', dbId)
                .eq('printify_variant_id', String(vid))
            }
          }
          console.log(`    ✓ Variant images mapped`)
        }
      } catch (e) {
        console.warn(`    ⚠ Image sync: ${e.message} (will sync via cron)`)
      }

      results.push({
        num: prod.num,
        name: prod.name,
        status: 'success',
        printifyId,
        supabaseId: dbId,
        variants: selected.length,
      })
      console.log(`    ✓ DONE\n`)

    } catch (e) {
      console.error(`  ✗ #${prod.num} "${prod.name}": ${e.message}`)
      results.push({ num: prod.num, name: prod.name, status: 'error', error: e.message })
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════')
  console.log('  SUMMARY')
  console.log('═══════════════════════════════════════════════\n')

  const ok = results.filter(r => r.status === 'success')
  const fail = results.filter(r => r.status === 'error')
  const partial = results.filter(r => r.status === 'partial')

  for (const r of results) {
    const icon = r.status === 'success' ? '✓' : r.status === 'partial' ? '⚠' : '✗'
    console.log(`  ${icon} #${r.num} ${r.name} — ${r.status}${r.variants ? ` (${r.variants} variants)` : ''}${r.error ? ` [${r.error}]` : ''}`)
  }

  console.log(`\n  Created: ${ok.length} | Partial: ${partial.length} | Failed: ${fail.length}\n`)

  if (ok.length > 0) {
    console.log('  Next: Run cron sync to get final mockup images:')
    console.log('  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-printify\n')
  }
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
