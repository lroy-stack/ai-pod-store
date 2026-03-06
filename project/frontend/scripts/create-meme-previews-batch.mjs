/**
 * MEME PREVIEWS BATCH — 10 Products (6 Designs × 8 Blueprints)
 *
 * Uses pre-existing PNG designs from /public/meme-previews/
 * Creates on Printify + inserts in Supabase with GPSR, translations, product_details
 *
 * Plan: .claude/data/product-plans/2026-02-28-meme-previews-batch.md
 *
 * Usage:
 *   node scripts/create-meme-previews-batch.mjs --dry-run    # Print what would be created
 *   node scripts/create-meme-previews-batch.mjs              # Create on Printify + Supabase
 *   node scripts/create-meme-previews-batch.mjs --start=3    # Start from product #3
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const START_AT = (() => {
  const arg = process.argv.find(a => a.startsWith('--start='))
  return arg ? parseInt(arg.split('=')[1], 10) : 1
})()

const ROOT = join(import.meta.dirname, '..')
const DESIGNS_DIR = join(ROOT, 'public', 'meme-previews')

// ─── Env ────────────────────────────────────────────────────────────────────
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')

if (!TOKEN || !SHOP_ID || !SB_URL || !SB_KEY) {
  console.error('Missing env vars: PRINTIFY_API_TOKEN, PRINTIFY_SHOP_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}
const supabase = createClient(SB_URL, SB_KEY)

const API = 'https://api.printify.com/v1'
const hdrs = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' })
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs(), ...opts.headers } })
  if (!r.ok) {
    const body = (await r.text()).slice(0, 500)
    throw new Error(`Printify ${r.status}: ${body}`)
  }
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// ─── GPSR Safety Information (EU Regulation 2023/988) ───────────────────────
function buildGPSR(material) {
  return `<p><strong>Manufacturer:</strong> Textildruck Europa GmbH, Germany</p>
<p><strong>Material:</strong> ${material}</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based OEKO-TEX certified inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>`
}

// ═══════════════════════════════════════════════════════════════════════════════
//  10 PRODUCT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const PRODUCTS = [
  // ── 1. Strawberry Count — BP6 Gildan 5000 Heavy Cotton Tee ──
  {
    name: 'strawberry-count',
    title: 'Strawberry Count',
    designFile: '11-strawberry-tee.png',
    blueprintId: 6, providerId: 26,
    priceCents: 2499,
    colorFilter: ['Black', 'Charcoal', 'Navy', 'Dark Heather'],
    category: 't-shirts',
    printPosition: { x: 0.5, y: 0.45, scale: 1.0 },
    material: '100% Cotton',
    tags: ['skapara', 'meme', 'chatgpt', 'ai', 'strawberry', 'tech-humor'],
    desc: {
      en: 'ChatGPT 5 thought about it for 11 seconds. Still got it wrong. The AI era\'s most relatable moment, now on heavyweight cotton.',
      es: 'ChatGPT 5 pensó durante 11 segundos. Y aun así falló. El momento más relatable de la era AI, ahora en algodón heavyweight.',
      de: 'ChatGPT 5 hat 11 Sekunden nachgedacht. Und lag trotzdem falsch. Der relatable Moment der KI-Ära, auf Heavyweight-Baumwolle.',
    },
  },
  // ── 2. Under Where — BP145 Gildan 64000 Softstyle Tee ──
  {
    name: 'under-where',
    title: 'Under Where',
    designFile: '12-underwear-tee.png',
    blueprintId: 145, providerId: 26,
    priceCents: 2499,
    colorFilter: ['Charcoal', 'Dark Heather', 'Navy', 'Military Green'],
    category: 't-shirts',
    printPosition: { x: 0.5, y: 0.45, scale: 1.0 },
    material: '100% Ring-Spun Cotton',
    tags: ['skapara', 'meme', 'chatgpt', 'prompt-injection', 'ai', 'tech-humor'],
    desc: {
      en: 'The oldest trick in the book. ChatGPT fell for it — then leaked your coordinates. Classic prompt injection, wearable edition.',
      es: 'El truco más viejo del mundo. ChatGPT cayó — y después filtró tus coordenadas. Prompt injection clásica, edición portable.',
      de: 'Der älteste Trick der Welt. ChatGPT ist drauf reingefallen — und hat deine Koordinaten geleakt. Klassische Prompt Injection, tragbare Edition.',
    },
  },
  // ── 3. Option Two — BP454 B&C TU01T EU Single Jersey ──
  {
    name: 'option-two',
    title: 'Option Two',
    designFile: '13-bypass-permissions-tee.png',
    blueprintId: 454, providerId: 26,
    priceCents: 2699,
    colorFilter: ['Black', 'Bottle Green', 'Dark Grey', 'Navy'],
    category: 't-shirts',
    printPosition: { x: 0.5, y: 0.45, scale: 1.0 },
    material: '100% Ring-Spun Cotton',
    tags: ['skapara', 'meme', 'claude', 'claude-code', 'permissions', 'ai', 'tech-humor'],
    desc: {
      en: 'Claude has a plan. Four options on screen. You already know which one you\'re picking. Always option two.',
      es: 'Claude tiene un plan. Cuatro opciones en pantalla. Ya sabes cuál vas a elegir. Siempre la opción dos.',
      de: 'Claude hat einen Plan. Vier Optionen auf dem Bildschirm. Du weißt bereits, welche du wählst. Immer Option zwei.',
    },
  },
  // ── 4. Dangerous Flag — BP12 Bella+Canvas 3001 Premium Fitted Tee ──
  {
    name: 'dangerous-flag',
    title: 'Dangerous Flag',
    designFile: '14-skip-permissions-tee.png',
    blueprintId: 12, providerId: 26,
    priceCents: 2799,
    colorFilter: ['Black', 'Dark Grey', 'Dark Grey Heather', 'Heather Navy', 'Heather Olive'],
    category: 't-shirts',
    printPosition: { x: 0.5, y: 0.45, scale: 1.0 },
    material: '100% Airlume Combed and Ring-Spun Cotton',
    tags: ['skapara', 'meme', 'claude-code', 'permissions', 'cli', 'developer', 'tech-humor'],
    desc: {
      en: 'You know the flag. You\'ve typed the flag. No regrets. For the developer who lives on the edge of the command line.',
      es: 'Conoces el flag. Has escrito el flag. Sin arrepentimientos. Para el developer que vive al límite de la línea de comandos.',
      de: 'Du kennst das Flag. Du hast das Flag getippt. Keine Reue. Für den Entwickler, der am Rand der Kommandozeile lebt.',
    },
  },
  // ── 5. Scope Creep — BP6 Gildan 5000 Heavy Cotton Tee ──
  {
    name: 'scope-creep',
    title: 'Scope Creep',
    designFile: '15-button-color-tee.png',
    blueprintId: 6, providerId: 26,
    priceCents: 2499,
    colorFilter: ['Black', 'Charcoal', 'Navy', 'Maroon'],
    category: 't-shirts',
    printPosition: { x: 0.5, y: 0.45, scale: 1.0 },
    material: '100% Cotton',
    tags: ['skapara', 'meme', 'claude-code', 'scope-creep', 'ai', 'developer', 'tech-humor'],
    desc: {
      en: 'You asked to change a button color. Claude edited 47 files and added 9,847 lines. The AI pair programmer experience, summarized.',
      es: 'Pediste cambiar el color de un botón. Claude editó 47 archivos y añadió 9.847 líneas. La experiencia de pair programming con AI, resumida.',
      de: 'Du wolltest eine Button-Farbe ändern. Claude hat 47 Dateien bearbeitet und 9.847 Zeilen hinzugefügt. Das KI-Pair-Programming-Erlebnis, zusammengefasst.',
    },
  },
  // ── 6. Three Models — BP1462 Stanley Stella Creator 2.0 Sustainable ──
  {
    name: 'three-models',
    title: 'Three Models',
    designFile: '16-haiku-sonnet-opus-tee.png',
    blueprintId: 1462, providerId: 26,
    priceCents: 2999,
    colorFilter: ['Black', 'French Navy', 'Dark Heather Grey'],
    category: 't-shirts',
    printPosition: { x: 0.5, y: 0.45, scale: 1.0 },
    material: '100% Organic Ring-Spun Cotton (GOTS certified)',
    tags: ['skapara', 'meme', 'claude', 'haiku', 'sonnet', 'opus', 'ai-models', 'tech-humor', 'organic'],
    desc: {
      en: 'Same prompt, three personalities. Haiku just does it. Sonnet overthinks it. Opus questions your life choices. Pick your fighter.',
      es: 'Mismo prompt, tres personalidades. Haiku simplemente lo hace. Sonnet lo piensa demasiado. Opus cuestiona tus decisiones de vida. Elige tu fighter.',
      de: 'Gleicher Prompt, drei Persönlichkeiten. Haiku macht einfach. Sonnet denkt zu viel nach. Opus hinterfragt deine Lebensentscheidungen. Wähle deinen Fighter.',
    },
  },
  // ── 7. Skip Permissions — BP92 AWDIS JH001 College Hoodie ──
  {
    name: 'skip-permissions',
    title: 'Skip Permissions',
    designFile: '14-skip-permissions-tee.png',
    blueprintId: 92, providerId: 26,
    priceCents: 4999,
    colorFilter: ['Jet Black', 'Oxford Navy', 'Charcoal', 'Bottle Green', 'Purple'],
    category: 'pullover-hoodies',
    printPosition: { x: 0.5, y: 0.45, scale: 0.62 },
    material: '80% Ringspun Cotton / 20% Polyester',
    tags: ['skapara', 'meme', 'claude-code', 'permissions', 'cli', 'developer', 'hoodie', 'college'],
    desc: {
      en: 'The flag that says everything about how you code. Dangerously comfortable, just like your workflow. Sporty college-cut hoodie.',
      es: 'El flag que dice todo sobre cómo codeas. Peligrosamente cómodo, igual que tu workflow. Hoodie college-cut deportivo.',
      de: 'Das Flag, das alles über deinen Coding-Stil sagt. Gefährlich bequem, genau wie dein Workflow. Sportlicher College-Cut Hoodie.',
    },
  },
  // ── 8. AI Personalities — BP49 Gildan 18000 Heavy Blend Crewneck ──
  {
    name: 'ai-personalities',
    title: 'AI Personalities',
    designFile: '16-haiku-sonnet-opus-tee.png',
    blueprintId: 49, providerId: 26,
    priceCents: 4499,
    colorFilter: ['Black', 'Dark Heather', 'Maroon'],
    category: 'crewnecks',
    printPosition: { x: 0.5, y: 0.45, scale: 0.90 },
    material: '50% Cotton / 50% Polyester',
    tags: ['skapara', 'meme', 'claude', 'haiku', 'sonnet', 'opus', 'ai-models', 'crewneck'],
    desc: {
      en: 'Three models, one task, zero agreement. The definitive guide to Claude\'s personality spectrum, on cozy heavyweight crewneck.',
      es: 'Tres modelos, una tarea, cero acuerdo. La guía definitiva del espectro de personalidad de Claude, en crewneck heavyweight acogedor.',
      de: 'Drei Modelle, eine Aufgabe, null Einigung. Der definitive Guide zum Persönlichkeitsspektrum von Claude, auf gemütlichem Heavyweight-Crewneck.',
    },
  },
  // ── 9. Prompt Injection — BP80 Gildan 2400 Ultra Cotton Long Sleeve ──
  {
    name: 'prompt-injection',
    title: 'Prompt Injection',
    designFile: '12-underwear-tee.png',
    blueprintId: 80, providerId: 26,
    priceCents: 2999,
    colorFilter: ['Black', 'Navy'],
    category: 'long-sleeves',
    printPosition: { x: 0.5, y: 0.45, scale: 0.95 },
    material: '100% Ultra Cotton',
    tags: ['skapara', 'meme', 'chatgpt', 'prompt-injection', 'ai', 'developer', 'long-sleeve'],
    desc: {
      en: 'The underwear trick is just the warm-up. Wait until it leaks your coordinates. Social engineering meets AI, long sleeve edition.',
      es: 'El truco del underwear es solo el calentamiento. Espera a que filtre tus coordenadas. Ingeniería social meets AI, edición manga larga.',
      de: 'Der Underwear-Trick ist nur das Aufwärmen. Warte, bis es deine Koordinaten leakt. Social Engineering trifft KI, Langarm-Edition.',
    },
  },
  // ── 10. Just One Button — BP77 Gildan 18500 Heavy Blend Pullover Hoodie ──
  {
    name: 'just-one-button',
    title: 'Just One Button',
    designFile: '15-button-color-tee.png',
    blueprintId: 77, providerId: 26,
    priceCents: 4999,
    colorFilter: ['Black', 'Forest Green', 'Maroon', 'Navy'],
    category: 'pullover-hoodies',
    printPosition: { x: 0.5, y: 0.45, scale: 0.60 },
    material: '50% Cotton / 50% Polyester',
    tags: ['skapara', 'meme', 'claude-code', 'scope-creep', 'ai', 'developer', 'hoodie'],
    desc: {
      en: 'All you wanted was a blue button. What you got was a full codebase rewrite. The AI development experience in one hoodie.',
      es: 'Solo querías un botón azul. Lo que obtuviste fue una reescritura completa del codebase. La experiencia de desarrollo con AI en un hoodie.',
      de: 'Du wolltest nur einen blauen Button. Was du bekommen hast, war ein kompletter Codebase-Rewrite. Die KI-Entwicklungserfahrung in einem Hoodie.',
    },
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
//  CREATION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

// Cache uploads so same design file is only uploaded once
const uploadCache = {}

async function createProduct(product, idx) {
  const num = idx + 1
  console.log(`\n  [${num}/10] ${product.title} — BP${product.blueprintId}/P${product.providerId}`)

  // ── 1. Read & Upload design ──────────────────────────────────────────────
  const designPath = join(DESIGNS_DIR, product.designFile)
  const cacheKey = product.designFile

  let uploadId
  if (uploadCache[cacheKey]) {
    uploadId = uploadCache[cacheKey]
    console.log(`    Upload: ${uploadId} (cached from ${cacheKey})`)
  } else {
    const buffer = readFileSync(designPath)
    await delay(2000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({
        file_name: `skapara-meme-${product.name}.png`,
        contents: buffer.toString('base64'),
      }),
    })
    uploadId = upload.id
    uploadCache[cacheKey] = uploadId
    console.log(`    Upload: ${uploadId}`)
  }

  // ── 2. Query & filter variants ───────────────────────────────────────────
  await delay(1500)
  const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
  const allVariants = varRes.variants || []

  // Parse color from variant title — handles both "Color / Size" and "Size / Color" formats
  const SIZES = new Set(['2xs','xs','s','m','l','xl','2xl','3xl','4xl','5xl','one size'])
  function parseColorSize(title) {
    const parts = (title || '').split(' / ').map(p => p.trim())
    if (parts.length < 2) return { color: parts[0] || 'Default', size: 'One size' }
    // If first part is a size, format is "Size / Color" (BP49, BP80)
    if (SIZES.has(parts[0].toLowerCase())) return { color: parts[1], size: parts[0] }
    // Otherwise "Color / Size" (BP6, BP12, BP77, etc.)
    return { color: parts[0], size: parts[1] }
  }

  // Filter by exact color match (case-insensitive)
  const filterLower = product.colorFilter.map(c => c.toLowerCase())
  const selected = allVariants.filter(v => {
    const { color } = parseColorSize(v.title)
    return filterLower.some(f => color.toLowerCase() === f)
  })

  if (!selected.length) {
    const availColors = [...new Set(allVariants.map(v => parseColorSize(v.title).color))]
    console.error(`    ERROR: No variants matched colors [${product.colorFilter.join(', ')}]`)
    console.error(`    Available: ${availColors.join(', ')}`)
    return null
  }

  const colors = [...new Set(selected.map(v => parseColorSize(v.title).color))]
  const sizes = [...new Set(selected.map(v => parseColorSize(v.title).size))]
  console.log(`    Variants: ${selected.length} (${colors.length} colors × ${sizes.length} sizes)`)
  console.log(`    Colors: ${colors.join(', ')}`)
  console.log(`    Sizes: ${sizes.join(', ')}`)

  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would create ${product.title}`)
    return { dryRun: true }
  }

  // ── 3. Create product on Printify ────────────────────────────────────────
  await delay(2000)
  const { x, y, scale } = product.printPosition
  const prod = await api(`/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: product.title,
      description: product.desc.en,
      blueprint_id: product.blueprintId,
      print_provider_id: product.providerId,
      variants: selected.map(v => ({ id: v.id, price: product.priceCents, is_enabled: true })),
      print_areas: [{
        variant_ids: selected.map(v => v.id),
        placeholders: [{
          position: 'front',
          images: [{ id: uploadId, x, y, scale, angle: 0 }],
        }],
      }],
      tags: product.tags,
    }),
  })
  console.log(`    Printify ID: ${prod.id}`)

  // ── 4. GPSR — EU General Product Safety Regulation ───────────────────────
  try {
    await delay(1500)
    const gpsrHtml = buildGPSR(product.material)
    await api(`/shops/${SHOP_ID}/products/${prod.id}/safety_information.json`, {
      method: 'PUT',
      body: JSON.stringify({ safety_information: gpsrHtml }),
    })
    console.log(`    GPSR: OK`)
  } catch (e) {
    console.warn(`    GPSR: ${e.message} (non-blocking, will retry manually)`)
  }

  // ── 5. Publish ───────────────────────────────────────────────────────────
  await delay(1500)
  await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log(`    Published`)

  // ── 6. Insert in Supabase ────────────────────────────────────────────────
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', product.category).single()
  const gpsrHtml = buildGPSR(product.material)
  const productDetails = {
    safety_information: gpsrHtml,
    material: product.material,
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Germany',
    brand: 'SKAPARA',
    provider: 'Textildruck Europa (P26)',
  }

  const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
    title: product.title,
    description: product.desc.en,
    printify_id: prod.id,
    blueprint_id: product.blueprintId,
    print_provider_id: product.providerId,
    category_id: cat?.id,
    category: product.category,
    status: 'active',
    currency: 'EUR',
    base_price_cents: product.priceCents,
    tags: product.tags,
    product_details: productDetails,
    published_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    translations: {
      es: { title: product.title, description: product.desc.es },
      de: { title: product.title, description: product.desc.de },
    },
  }).select('id').single()

  if (dbErr) {
    console.error(`    Supabase ERROR: ${dbErr.message}`)
    return { printifyId: prod.id, dbId: null }
  }
  console.log(`    Supabase: ${dbProd.id}`)

  // ── 7. Publishing succeeded ──────────────────────────────────────────────
  try {
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
      method: 'POST',
      body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } }),
    })
  } catch {}

  // ── 8. Insert variants ───────────────────────────────────────────────────
  for (const sv of selected) {
    const parts = sv.title.split(' / ').map(p => p.trim())
    const color = parts[0] || 'Default'
    const size = parts[1] || 'One size'

    await supabase.from('product_variants').upsert({
      product_id: dbProd.id,
      printify_variant_id: String(sv.id),
      title: sv.title,
      color,
      size,
      price_cents: product.priceCents,
      is_enabled: true,
      is_available: true,
    }, { onConflict: 'product_id,printify_variant_id' })
  }
  console.log(`    Variants: ${selected.length} inserted`)

  // ── 9. Harvest mockup images ─────────────────────────────────────────────
  await delay(5000)
  try {
    const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
    const imgs = (details?.images || [])
      .filter(i => !i.src?.includes('size-chart'))
      .slice(0, 8)
      .map(i => i.src)
    if (imgs.length) {
      await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
      console.log(`    Mockups: ${imgs.length} images`)
    } else {
      console.log(`    Mockups: not ready yet (re-sync needed)`)
    }
  } catch {}

  console.log(`    ✓ DONE`)
  return { printifyId: prod.id, dbId: dbProd.id }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(60))
  console.log('  SKAPARA — Meme Previews Batch — 10 Products')
  console.log('  Mode: ' + (DRY_RUN ? 'DRY RUN' : 'LIVE CREATION'))
  if (START_AT > 1) console.log(`  Starting from product #${START_AT}`)
  console.log('═'.repeat(60))

  const results = []

  for (let i = 0; i < PRODUCTS.length; i++) {
    if (i + 1 < START_AT) {
      console.log(`\n  [${i + 1}/10] ${PRODUCTS[i].title} — SKIPPED (--start=${START_AT})`)
      continue
    }
    try {
      const result = await createProduct(PRODUCTS[i], i)
      results.push({ product: PRODUCTS[i].title, ...result })
    } catch (e) {
      console.error(`\n  [${i + 1}/10] ${PRODUCTS[i].title} — FAILED: ${e.message}`)
      results.push({ product: PRODUCTS[i].title, error: e.message })
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('  RESULTS')
  console.log('═'.repeat(60))
  for (const r of results) {
    const status = r.error ? `FAIL: ${r.error}` : r.dryRun ? 'DRY RUN OK' : `Printify: ${r.printifyId} | DB: ${r.dbId}`
    console.log(`  ${r.product.padEnd(25)} ${status}`)
  }

  if (!DRY_RUN) {
    console.log('\n  Next steps:')
    console.log('  1. Run cron sync: curl $SITE_URL/api/cron/sync-printify')
    console.log('  2. Verify mockups loaded for each product')
    console.log('  3. Check color toggles in ProductCard')
    console.log('  4. Verify SizeGuide shows for t-shirts/hoodies/crewnecks')
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
