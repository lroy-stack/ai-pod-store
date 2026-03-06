/**
 * Seed 17 Meme Products (v4) into Printify + Supabase.
 *
 * Pipeline:
 *   Phase 0: Delete 10 old meme products (Printify + Supabase)
 *   Phase 1: Validate blueprints via Printify API (EU providers)
 *   Phase 2: Upload 10 design PNGs (deduplicated, cached)
 *   Phase 3: Create 17 products on Printify
 *   Phase 4: Publish + publishing_succeeded
 *   Phase 5: Save to Supabase with translations + variants + images
 *
 * Usage:
 *   node scripts/seed-meme-catalog.mjs
 *   node scripts/seed-meme-catalog.mjs --skip-delete
 *   node scripts/seed-meme-catalog.mjs --dry-run
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── CLI flags ───────────────────────────────────────────────────────────────
const SKIP_DELETE = process.argv.includes('--skip-delete')
const DRY_RUN = process.argv.includes('--dry-run')

// ─── ENV ─────────────────────────────────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const TOKEN   = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL  = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY  = env('SUPABASE_SERVICE_KEY')

if (!TOKEN || !SHOP_ID) { console.error('Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID in .env.local'); process.exit(1) }
if (!SB_URL || !SB_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local'); process.exit(1) }

const supabase = createClient(SB_URL, SB_KEY)

// ─── Printify API helper ─────────────────────────────────────────────────────
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, options = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Printify ${r.status}: ${text.slice(0, 300)}`)
  }
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) return r.json()
  return null
}

// ─── Old product IDs to delete ───────────────────────────────────────────────
const OLD_PRINTIFY_IDS = [
  '69a2142defc94038120f1c7e', '69a2143e95d2a7cc0b09e65f',
  '69a2144f1ec5ca402c02f731', '69a214601ec5ca402c02f739',
  '69a21472e86da3fe960e6172', '69a214877ab6ca0074088dcc',
  '69a21495e86da3fe960e6178', '69a214a12585b900f60a5fae',
  '69a214b106c74eb6da0c5ce7', '69a214bf06c74eb6da0c5ce9',
]

// ─── EU provider filter ──────────────────────────────────────────────────────
const EU_COUNTRIES = ['DE', 'NL', 'PL', 'GB', 'ES', 'FR', 'IT', 'AT', 'BE', 'CZ']

function findEuProvider(providers) {
  const eu = providers.filter(p =>
    EU_COUNTRIES.includes((p.location?.country || '').toUpperCase())
  )
  return eu[0] || providers[0]
}

// ─── Dark color filter (designs are white text on transparent) ───────────────
function filterByColors(variants, preferredColors) {
  if (!preferredColors || preferredColors.length === 0) return variants
  const matched = variants.filter(v => {
    const color = (v.options?.color || v.title?.split('/')[0] || '').trim().toLowerCase()
    return preferredColors.some(c => color.includes(c.toLowerCase()))
  })
  return matched.length >= 2 ? matched : variants
}

// ─── Supabase child tables to clean up on delete ─────────────────────────────
const CHILD_TABLES = ['product_variants', 'cart_items', 'wishlist_items', 'marketing_content']

// ─── 17 Products ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  // ═══ 6 T-Shirts ═══════════════════════════════════════════════════════════
  {
    file: '02-absolutely-right-tee.png',
    name: 'Absolutely Right',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    colors: ['Black', 'Dark Heather', 'Navy', 'Maroon'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'claude', 'ai', 'humor', 'developer', 'meme', 'absolutely-right'],
    desc: {
      en: '"You\'re absolutely right!" — Every Claude response ever. The tee that captures AI\'s favorite phrase.',
      es: '"¡Tienes toda la razón!" — Cada respuesta de Claude. La camiseta que captura la frase favorita de la IA.',
      de: '"Du hast absolut recht!" — Jede Claude-Antwort. Das T-Shirt das die Lieblingsphrase der KI einfängt.',
    },
  },
  {
    file: '03-vibe-coding-tee.png',
    name: 'Vibe Coder',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    colors: ['Black', 'Dark Heather', 'Navy', 'Army'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'vibe-coding', 'cursor', 'ai', 'humor', 'developer', 'meme'],
    desc: {
      en: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — The art of describing what you want and pretending you built it.',
      es: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — El arte de describir lo que quieres y pretender que lo construiste.',
      de: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — Die Kunst zu beschreiben was man will und so zu tun als hätte man es gebaut.',
    },
  },
  {
    file: '05-no-bugs-tee.png',
    name: 'Zero Bugs',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    colors: ['Black', 'Dark Heather', 'Navy', 'Forest Green'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'chatgpt', 'ai', 'humor', 'developer', 'meme', 'bugs', 'features'],
    desc: {
      en: 'My code has no bugs. It has AI-generated features. The honest developer\'s daily uniform.',
      es: 'Mi código no tiene bugs. Tiene features generadas por IA. El uniforme diario del developer honesto.',
      de: 'Mein Code hat keine Bugs. Er hat KI-generierte Features. Die tägliche Uniform des ehrlichen Entwicklers.',
    },
  },
  {
    file: '01-prompts-crewneck.png',
    name: 'Prompt Life',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    colors: ['Black', 'Dark Heather', 'Navy', 'Forest Green'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'ai', 'humor', 'developer', 'meme', 'prompt', 'vibe-coding'],
    desc: {
      en: 'I don\'t write code anymore. I write prompts. The tee that speaks the truth about modern dev.',
      es: 'Ya no escribo código. Escribo prompts. La camiseta que dice la verdad sobre el desarrollo moderno.',
      de: 'Ich schreibe keinen Code mehr. Ich schreibe Prompts. Das T-Shirt das die Wahrheit sagt.',
    },
  },
  {
    file: '04-built-2hours-ls.png',
    name: 'Two Hours',
    subtitle: 'Long Sleeve Crewneck',
    blueprintId: 879,
    fallbackBlueprint: 6,
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 2999,
    category: 'long-sleeves',
    tags: ['long-sleeve', 'cursor', 'ai', 'humor', 'developer', 'meme', '2-hours'],
    desc: {
      en: '"I built this in 2 hours" (spent 6 hours debugging). $ cursor compose --yolo.',
      es: '"Lo hice en 2 horas" (pasé 6 horas debuggeando). $ cursor compose --yolo.',
      de: '"Hab ich in 2 Stunden gebaut" (6 Stunden debuggt). $ cursor compose --yolo.',
    },
  },
  {
    file: '08-refactor-anyway-zip.png',
    name: 'Refactor Mode',
    subtitle: 'Long Sleeve Crewneck',
    blueprintId: 879,
    fallbackBlueprint: 6,
    colors: ['Black', 'Dark Heather', 'Navy', 'Maroon'],
    priceCents: 2999,
    category: 'long-sleeves',
    tags: ['long-sleeve', 'cursor', 'refactor', 'ai', 'humor', 'developer', 'meme', '3am'],
    desc: {
      en: 'If it ain\'t broke, I\'ll refactor it anyway. — cursor agent, 3am, unsupervised.',
      es: 'Si no está roto, lo refactorizo igual. — cursor agent, 3am, sin supervisión.',
      de: 'Wenn es nicht kaputt ist, refactore ich trotzdem. — cursor agent, 3 Uhr morgens.',
    },
  },

  // ═══ 5 Hoodies / Sweatshirts ══════════════════════════════════════════════
  {
    file: '01-prompts-crewneck.png',
    name: 'Night Shift',
    subtitle: 'Pullover Hoodie',
    blueprintId: 793,
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 4499,
    category: 'hoodies',
    tags: ['hoodie', 'pullover', 'ai', 'humor', 'developer', 'meme', 'prompt', 'night-shift'],
    desc: {
      en: 'I don\'t write code anymore. I write prompts. The hoodie for late-night prompt sessions.',
      es: 'Ya no escribo código. Escribo prompts. La hoodie para sesiones nocturnas de prompts.',
      de: 'Ich schreibe keinen Code mehr. Ich schreibe Prompts. Der Hoodie für nächtliche Sessions.',
    },
  },
  {
    file: '02-absolutely-right-tee.png',
    name: 'Always Right',
    subtitle: 'Zip-Up Hoodie',
    blueprintId: 455,
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 4999,
    category: 'hoodies',
    tags: ['hoodie', 'zip-up', 'claude', 'ai', 'humor', 'developer', 'meme'],
    desc: {
      en: '"You\'re absolutely right!" — The zip-up that captures AI\'s favorite phrase.',
      es: '"¡Tienes toda la razón!" — La hoodie con cremallera de la frase favorita de la IA.',
      de: '"Du hast absolut recht!" — Der Zip-Hoodie der die Lieblingsphrase der KI einfängt.',
    },
  },
  {
    file: '05-no-bugs-tee.png',
    name: 'Bug Free',
    subtitle: 'Crew Neck Sweatshirt',
    blueprintId: 457,
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 3999,
    category: 'sweatshirts',
    tags: ['sweatshirt', 'crewneck', 'ai', 'humor', 'developer', 'meme', 'bugs'],
    desc: {
      en: 'My code has no bugs. It has AI-generated features. Crew neck for bug-free developers.',
      es: 'Mi código no tiene bugs. Tiene features generadas por IA. Sudadera para devs sin bugs.',
      de: 'Mein Code hat keine Bugs. Er hat KI-generierte Features. Sweatshirt für bugfreie Devs.',
    },
  },
  {
    file: '03-vibe-coding-tee.png',
    name: 'Dev Mode',
    subtitle: 'Heavy Crewneck Sweatshirt',
    blueprintId: 49,
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 3999,
    category: 'sweatshirts',
    tags: ['sweatshirt', 'crewneck', 'heavy', 'vibe-coding', 'ai', 'humor', 'developer', 'meme'],
    desc: {
      en: 'Vibe Coding — The art of describing what you want. Heavy crewneck for serious devs.',
      es: 'Vibe Coding — El arte de describir lo que quieres. Sudadera heavy para devs serios.',
      de: 'Vibe Coding — Die Kunst zu beschreiben was man will. Heavy Sweatshirt für ernste Devs.',
    },
  },
  {
    file: '04-built-2hours-ls.png',
    name: 'Ship Fast',
    subtitle: 'Long Sleeve Crewneck',
    blueprintId: 879,
    fallbackBlueprint: 6,
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 3999,
    category: 'sweatshirts',
    tags: ['sweatshirt', 'long-sleeve', 'cursor', 'ai', 'humor', 'developer', 'meme', 'ship-fast'],
    desc: {
      en: '"I built this in 2 hours" (6 hours debugging). Long sleeve for fast shippers.',
      es: '"Lo hice en 2 horas" (6 horas debuggeando). Manga larga para los que shippen rápido.',
      de: '"In 2 Stunden gebaut" (6 Stunden debuggt). Langarm für schnelle Shipper.',
    },
  },

  // ═══ 6 Desk Items ═════════════════════════════════════════════════════════
  {
    file: '07-git-reset-mousepad.png',
    name: 'Hard Reset',
    subtitle: 'Mouse Pad',
    blueprintId: 442,
    colors: [],
    priceCents: 1999,
    category: 'mouse-pads',
    tags: ['mousepad', 'git', 'reset', 'ai', 'humor', 'developer', 'meme', 'desk'],
    desc: {
      en: '$ git reset --hard — The real AI undo button. Premium mouse pad for your desk.',
      es: '$ git reset --hard — El verdadero botón de deshacer. Mouse pad premium para tu escritorio.',
      de: '$ git reset --hard — Der wahre KI-Undo-Button. Premium Mauspad für deinen Schreibtisch.',
    },
  },
  {
    file: '10-404-dev-gaming-pad.png',
    name: 'Dev 404',
    subtitle: 'LED Gaming Desk Mat',
    blueprintId: 969,
    colors: [],
    priceCents: 3499,
    category: 'mouse-pads',
    tags: ['gaming', 'desk-mat', 'led', '404', 'developer', 'ai', 'humor', 'meme'],
    desc: {
      en: '404: Developer Not Found. LED gaming desk mat for the replaced developer.',
      es: '404: Developer No Encontrado. Escritorio gaming LED para el developer reemplazado.',
      de: '404: Entwickler nicht gefunden. LED Gaming Matte für den ersetzten Entwickler.',
    },
  },
  {
    file: '06-prompt-engineer-poster.png',
    name: 'Career Path',
    subtitle: 'Satin Poster',
    blueprintId: 97,
    colors: [],
    priceCents: 1999,
    category: 'posters',
    tags: ['poster', 'satin', 'prompt-engineer', 'career', 'ai', 'humor', 'developer', 'meme'],
    desc: {
      en: 'Senior Dev → Prompt Engineer. career_progression.js — 2026 edition.',
      es: 'Senior Dev → Prompt Engineer. career_progression.js — edición 2026.',
      de: 'Senior Dev → Prompt Engineer. career_progression.js — 2026 Edition.',
    },
  },
  {
    file: '09-full-credit-laptop.png',
    name: 'Full Stack',
    subtitle: 'Laptop Sleeve',
    blueprintId: 429,
    colors: [],
    priceCents: 2999,
    category: 'tech-accessories',
    tags: ['laptop', 'sleeve', 'credit', 'claude', 'ai', 'humor', 'developer', 'meme'],
    desc: {
      en: 'I didn\'t write this code. But I take full credit. Laptop sleeve for honest developers.',
      es: 'No escribí este código. Pero me llevo el crédito. Funda de laptop para devs honestos.',
      de: 'Ich habe den Code nicht geschrieben. Aber nehm die Anerkennung. Laptophülle für ehrliche Devs.',
    },
  },
  {
    file: '07-git-reset-mousepad.png',
    name: 'Ctrl+Z',
    subtitle: 'Square Stickers',
    blueprintId: 794,
    colors: [],
    priceCents: 699,
    category: 'stickers',
    tags: ['sticker', 'square', 'git', 'reset', 'undo', 'ai', 'humor', 'developer', 'meme'],
    desc: {
      en: '$ git reset --hard — The real AI undo button. Sticker pack for your laptop.',
      es: '$ git reset --hard — El verdadero botón de deshacer. Pack de stickers para tu laptop.',
      de: '$ git reset --hard — Der wahre KI-Undo-Button. Sticker-Pack für deinen Laptop.',
    },
  },
  {
    file: '06-prompt-engineer-poster.png',
    name: 'Deprecated',
    subtitle: 'Framed Poster',
    blueprintId: 1130,
    colors: [],
    priceCents: 3999,
    category: 'posters',
    tags: ['poster', 'framed', 'prompt-engineer', 'deprecated', 'ai', 'humor', 'developer', 'meme'],
    desc: {
      en: 'Senior Dev → Prompt Engineer. Framed poster — hang the truth on your wall.',
      es: 'Senior Dev → Prompt Engineer. Poster enmarcado — cuelga la verdad en tu pared.',
      de: 'Senior Dev → Prompt Engineer. Gerahmtes Poster — häng die Wahrheit an die Wand.',
    },
  },
]

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  MEME PRODUCT CATALOG v4 — 17 PRODUCTS')
  console.log('═══════════════════════════════════════════════════════\n')
  if (DRY_RUN) console.log('  *** DRY RUN — no API calls ***\n')

  const designsDir = join(import.meta.dirname, '..', 'public', 'meme-designs')
  const results = []

  // ════════════════════════════════════════════════════════════════════════
  // Phase 0: Delete 10 old meme products
  // ════════════════════════════════════════════════════════════════════════
  if (!SKIP_DELETE) {
    console.log('Phase 0: Deleting 10 old meme products...\n')
    let deleted = 0

    for (const pid of OLD_PRINTIFY_IDS) {
      try {
        if (!DRY_RUN) {
          // Delete from Printify
          try {
            await api(`/shops/${SHOP_ID}/products/${pid}.json`, { method: 'DELETE' })
            console.log(`  Printify DELETE ✓ ${pid}`)
          } catch (e) {
            // 404 = already deleted, that's OK
            if (e.message.includes('404')) {
              console.log(`  Printify SKIP   ${pid} (already deleted)`)
            } else {
              throw e
            }
          }
          await delay(500)

          // Hard delete from Supabase
          const { data: prods } = await supabase
            .from('products')
            .select('id')
            .eq('printify_id', pid)

          if (prods?.length) {
            const productId = prods[0].id
            for (const table of CHILD_TABLES) {
              await supabase.from(table).delete().eq('product_id', productId)
            }
            // Unlink designs (preserve them — they cost money)
            await supabase.from('designs').update({ product_id: null }).eq('product_id', productId)
            await supabase.from('products').delete().eq('id', productId)
            console.log(`  Supabase DELETE ✓ ${productId}`)
            deleted++
          } else {
            console.log(`  Supabase SKIP   (not found for ${pid})`)
          }
        } else {
          console.log(`  [DRY] Would delete ${pid}`)
          deleted++
        }
      } catch (e) {
        console.error(`  ✗ ${pid}: ${e.message}`)
      }
    }
    console.log(`\n  ${deleted}/${OLD_PRINTIFY_IDS.length} products deleted\n`)
  } else {
    console.log('Phase 0: SKIPPED (--skip-delete)\n')
  }

  // ════════════════════════════════════════════════════════════════════════
  // Phase 1: Validate blueprints & get EU providers + variants
  // ════════════════════════════════════════════════════════════════════════
  console.log('Phase 1: Validating blueprints...\n')

  const blueprintData = new Map() // bp_id -> { provider, variants, blueprintId }
  const uniqueBlueprints = [...new Set(PRODUCTS.map(p => p.blueprintId))]

  for (const bp of uniqueBlueprints) {
    try {
      await delay(600)
      const providers = await api(`/catalog/blueprints/${bp}/print_providers.json`)
      const provider = findEuProvider(providers)

      if (!provider) {
        console.error(`  BP ${bp}: No provider found!`)
        continue
      }

      const country = provider.location?.country || '?'
      console.log(`  BP ${bp}: ${provider.title} (${country}) [id=${provider.id}]`)

      await delay(600)
      const variantResp = await api(
        `/catalog/blueprints/${bp}/print_providers/${provider.id}/variants.json`
      )
      const variants = variantResp.variants || []

      blueprintData.set(bp, { provider, variants, blueprintId: bp })
      console.log(`         ${variants.length} variants available`)
    } catch (e) {
      console.error(`  BP ${bp}: FAILED — ${e.message}`)
    }
  }

  // Apply fallbacks for blueprints that failed
  for (const prod of PRODUCTS) {
    if (prod.fallbackBlueprint && !blueprintData.has(prod.blueprintId)) {
      if (blueprintData.has(prod.fallbackBlueprint)) {
        const fb = blueprintData.get(prod.fallbackBlueprint)
        console.log(`  BP ${prod.blueprintId}: Falling back to BP ${prod.fallbackBlueprint}`)
        blueprintData.set(prod.blueprintId, {
          ...fb,
          blueprintId: prod.fallbackBlueprint,
        })
      }
    }
  }

  console.log(`\n  ${blueprintData.size}/${uniqueBlueprints.length} blueprints validated\n`)

  // ─── Category lookup ──────────────────────────────────────────────────
  console.log('  Category lookup:')
  const categorySlugs = [...new Set(PRODUCTS.map(p => p.category))]
  const catMap = {}

  for (const slug of categorySlugs) {
    const { data } = await supabase.from('categories').select('id').eq('slug', slug).single()
    catMap[slug] = data?.id || null
    console.log(`    ${slug}: ${data?.id || 'NOT FOUND'}`)
  }
  console.log()

  // ════════════════════════════════════════════════════════════════════════
  // Phase 2: Upload 10 unique design PNGs
  // ════════════════════════════════════════════════════════════════════════
  console.log('Phase 2: Uploading designs...\n')

  const uploads = new Map() // file -> upload_id
  const uniqueFiles = [...new Set(PRODUCTS.map(p => p.file))]

  for (const file of uniqueFiles) {
    try {
      const filePath = join(designsDir, file)
      const fileBuffer = readFileSync(filePath)

      if (DRY_RUN) {
        uploads.set(file, `dry-run-${file}`)
        console.log(`  [DRY] ${file}`)
        continue
      }

      const base64 = fileBuffer.toString('base64')
      await delay(2000) // Rate limit — uploads are expensive
      const upload = await api('/uploads/images.json', {
        method: 'POST',
        body: JSON.stringify({ file_name: `meme-v4-${file}`, contents: base64 }),
      })
      uploads.set(file, upload.id)
      console.log(`  ✓ ${file}: ${upload.id}`)
    } catch (e) {
      console.error(`  ✗ ${file}: ${e.message}`)
    }
  }

  console.log(`\n  ${uploads.size}/${uniqueFiles.length} designs uploaded\n`)

  // ════════════════════════════════════════════════════════════════════════
  // Phases 3–5: Create → Publish → Save (per product)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Phases 3–5: Creating, publishing & saving products...\n')

  for (const prod of PRODUCTS) {
    const uploadId = uploads.get(prod.file)
    if (!uploadId) {
      results.push({ name: prod.name, status: 'error', error: 'Upload missing' })
      console.error(`  ✗ ${prod.name}: Design upload missing\n`)
      continue
    }

    const bpData = blueprintData.get(prod.blueprintId)
    if (!bpData) {
      results.push({ name: prod.name, status: 'error', error: `BP ${prod.blueprintId} unavailable` })
      console.error(`  ✗ ${prod.name}: Blueprint ${prod.blueprintId} not available\n`)
      continue
    }

    try {
      // Filter variants by color (apparel) or take all (desk items)
      const selectedVariants = prod.colors.length > 0
        ? filterByColors(bpData.variants, prod.colors)
        : bpData.variants

      if (selectedVariants.length === 0) {
        results.push({ name: prod.name, status: 'error', error: 'No variants matched' })
        console.error(`  ✗ ${prod.name}: No variants matched color filter\n`)
        continue
      }

      const colorNames = [...new Set(selectedVariants.map(v => v.options?.color || v.title?.split('/')[0]?.trim() || '?'))]
      const sizeNames = [...new Set(selectedVariants.map(v => v.options?.size || v.title?.split('/')[1]?.trim() || '?'))]

      console.log(`  ── ${prod.name} — ${prod.subtitle} ──`)
      console.log(`     BP ${bpData.blueprintId} | ${colorNames.length} colors × ${sizeNames.length} sizes = ${selectedVariants.length} variants`)

      if (DRY_RUN) {
        results.push({ name: prod.name, status: 'dry-run', variants: selectedVariants.length })
        console.log(`     [DRY RUN] Would create product\n`)
        continue
      }

      // ── Phase 3: Create product in Printify ─────────────────────────
      await delay(1500)
      const printifyProduct = await api(`/shops/${SHOP_ID}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          title: `${prod.name} — ${prod.subtitle}`,
          description: prod.desc.en,
          blueprint_id: bpData.blueprintId,
          print_provider_id: bpData.provider.id,
          variants: selectedVariants.map(v => ({
            id: v.id,
            price: prod.priceCents,
            is_enabled: true,
          })),
          print_areas: [{
            variant_ids: selectedVariants.map(v => v.id),
            placeholders: [{
              position: 'front',
              images: [{
                id: uploadId,
                x: 0.5,
                y: 0.5,
                scale: 1,
                angle: 0,
              }],
            }],
          }],
          tags: prod.tags,
        }),
      })

      console.log(`     Printify ID: ${printifyProduct.id}`)

      // ── Phase 4: Publish ────────────────────────────────────────────
      await delay(1000)
      await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publish.json`, {
        method: 'POST',
        body: JSON.stringify({
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
        }),
      })
      console.log(`     Published ✓`)

      // ── Phase 5: Save to Supabase ───────────────────────────────────
      const { data: dbProduct, error: dbError } = await supabase
        .from('products')
        .insert({
          title: prod.name,
          description: prod.desc.en,
          printify_id: printifyProduct.id,
          blueprint_id: bpData.blueprintId,
          print_provider_id: bpData.provider.id,
          category_id: catMap[prod.category],
          status: 'active',
          currency: 'EUR',
          base_price_cents: prod.priceCents,
          tags: prod.tags,
          published_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          translations: {
            es: { title: prod.name, description: prod.desc.es },
            de: { title: prod.name, description: prod.desc.de },
          },
        })
        .select('id')
        .single()

      if (dbError) {
        console.error(`     DB error: ${dbError.message}`)
        results.push({ name: prod.name, status: 'partial', printifyId: printifyProduct.id, error: dbError.message })
        console.log()
        continue
      }

      const dbId = dbProduct.id

      // Confirm publishing to Printify (required for custom integrations)
      try {
        await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publishing_succeeded.json`, {
          method: 'POST',
          body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } }),
        })
      } catch { /* non-fatal */ }

      // Insert variants into Supabase
      for (const sv of selectedVariants) {
        const parts = sv.title.split('/').map(p => p.trim())
        await supabase.from('product_variants').upsert(
          {
            product_id: dbId,
            printify_variant_id: String(sv.id),
            title: sv.title,
            color: parts[0] || 'Default',
            size: parts[1] || parts[0] || 'Default',
            price_cents: prod.priceCents,
            is_enabled: true,
            is_available: true,
          },
          { onConflict: 'product_id,printify_variant_id' }
        )
      }

      // Sync mockup images from Printify (needs time to generate)
      await delay(2000)
      try {
        const details = await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}.json`)
        if (details?.images?.length) {
          const imageUrls = details.images
            .filter(img => img.src && !img.src.includes('size-chart'))
            .slice(0, 8)
            .map(img => img.src)

          if (imageUrls.length) {
            await supabase.from('products').update({
              images: imageUrls,
              thumbnail_url: imageUrls[0],
            }).eq('id', dbId)
          }
        }
      } catch { /* non-fatal — images can be synced later */ }

      console.log(`     Supabase ID: ${dbId}`)
      console.log(`     Colors: ${colorNames.join(', ')}`)
      results.push({
        name: prod.name,
        status: 'success',
        printifyId: printifyProduct.id,
        dbId,
        variants: selectedVariants.length,
      })
      console.log()

    } catch (e) {
      console.error(`     ✗ ${prod.name}: ${e.message}\n`)
      results.push({ name: prod.name, status: 'error', error: e.message.slice(0, 120) })
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════')

  const ok = results.filter(r => r.status === 'success').length
  const partial = results.filter(r => r.status === 'partial').length
  const fail = results.filter(r => r.status === 'error').length
  const dry = results.filter(r => r.status === 'dry-run').length

  console.log(`  ✓ ${ok} products created`)
  if (partial) console.log(`  ⚠ ${partial} partially created (Printify OK, Supabase failed)`)
  if (fail) console.log(`  ✗ ${fail} failed`)
  if (dry) console.log(`  ~ ${dry} dry-run`)
  console.log()

  // Detailed table
  console.log('  Product              Status     Details')
  console.log('  ─────────────────────────────────────────────')
  for (const r of results) {
    const icon = { success: '✓', partial: '⚠', 'dry-run': '~', error: '✗' }[r.status]
    const detail = r.variants
      ? `${r.variants} variants`
      : r.error || ''
    console.log(`  ${icon} ${r.name.padEnd(20)} ${r.status.padEnd(10)} ${detail}`)
  }
  console.log()

  // Exit code
  if (fail > 0 && ok === 0) process.exit(1)
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
