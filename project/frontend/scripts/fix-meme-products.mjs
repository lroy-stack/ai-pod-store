/**
 * Fix 8 problematic meme products:
 *   1. Night Shift (BP 793 embroidery-only) → replace with BP 77 Gildan Hoodie DTG
 *   2. Always Right (BP 455 zip hoodie) → scale 0.85 for better fit
 *   3. 6 desk items → re-upload designs with dark background (#111827)
 *
 * Usage: node scripts/fix-meme-products.mjs [--dry-run]
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── ENV ─────────────────────────────────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const TOKEN   = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL  = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY  = env('SUPABASE_SERVICE_KEY')

if (!TOKEN || !SHOP_ID) { console.error('Missing Printify creds'); process.exit(1) }
if (!SB_URL || !SB_KEY) { console.error('Missing Supabase creds'); process.exit(1) }

const supabase = createClient(SB_URL, SB_KEY)

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

const CHILD_TABLES = ['product_variants', 'cart_items', 'wishlist_items', 'marketing_content']

// ─── Products to fix ─────────────────────────────────────────────────────────

const PRODUCTS_TO_DELETE = [
  // Hoodies
  { printifyId: '69a21fcde86da3fe960e642e', supabaseId: '1020d56e-535f-4591-9de2-b5690427df48', name: 'Night Shift' },
  { printifyId: '69a21fd87fc2996b8d0a3bda', supabaseId: '3913dc01-0f23-4c90-b9c9-e305dfcdf899', name: 'Always Right' },
  // Desk items
  { printifyId: '69a2200f414758b6c6029ce9', supabaseId: '955cb1d1-e715-468b-81f4-3af6d85d27da', name: 'Hard Reset' },
  { printifyId: '69a220203b12a90c8e0839a7', supabaseId: '31c9efdc-3b07-4f3a-877e-725101fc2e29', name: 'Dev 404' },
  { printifyId: '69a2202e7fc2996b8d0a3bfc', supabaseId: '920d57ca-27bc-4b84-9372-417a359810e3', name: 'Career Path' },
  { printifyId: '69a220397fc2996b8d0a3bff', supabaseId: '1afac046-f273-4bb9-a36e-d65940ed0e2c', name: 'Full Stack' },
  { printifyId: '69a2204347b36fbdb0024bff', supabaseId: '26513226-8c1d-4351-b3d9-41b62f381de2', name: 'Ctrl+Z' },
  { printifyId: '69a220503b12a90c8e0839b0', supabaseId: '38b4461c-0942-427c-99bd-73ab35dd1deb', name: 'Deprecated' },
]

// Dark background color for desk items
const DARK_BG = '#111827'

// ─── Dark color filter ───────────────────────────────────────────────────────
function filterByColors(variants, preferredColors) {
  if (!preferredColors || preferredColors.length === 0) return variants
  const matched = variants.filter(v => {
    const color = (v.options?.color || v.title?.split('/')[0] || '').trim().toLowerCase()
    return preferredColors.some(c => color.includes(c.toLowerCase()))
  })
  return matched.length >= 2 ? matched : variants
}

// ─── Add dark background to a PNG ────────────────────────────────────────────
async function addDarkBackground(pngPath) {
  const img = sharp(pngPath)
  const meta = await img.metadata()
  const w = meta.width
  const h = meta.height

  // Create solid dark background
  const bg = sharp({
    create: { width: w, height: h, channels: 4, background: DARK_BG },
  }).png()

  // Composite: dark bg + original design on top
  const result = await sharp(await bg.toBuffer())
    .composite([{ input: pngPath, blend: 'over' }])
    .png()
    .toBuffer()

  return result
}

// ─── Products to recreate ────────────────────────────────────────────────────

const RECREATE = [
  // ── Night Shift: BP 77 Gildan Hoodie + Fulfill Engine (217) ──
  {
    file: '01-prompts-crewneck.png',
    needsDarkBg: false,
    name: 'Night Shift',
    subtitle: 'Pullover Hoodie',
    blueprintId: 77,
    providerId: 217,
    position: 'front',
    scale: 1,
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
  // ── Always Right: BP 455 with reduced scale ──
  {
    file: '02-absolutely-right-tee.png',
    needsDarkBg: false,
    name: 'Always Right',
    subtitle: 'Zip-Up Hoodie',
    blueprintId: 455,
    providerId: 26,
    position: 'front',
    scale: 0.85,
    colors: ['Black', 'Anthracite', 'Navy'],
    priceCents: 4999,
    category: 'hoodies',
    tags: ['hoodie', 'zip-up', 'claude', 'ai', 'humor', 'developer', 'meme'],
    desc: {
      en: '"You\'re absolutely right!" — The zip-up that captures AI\'s favorite phrase.',
      es: '"¡Tienes toda la razón!" — La hoodie con cremallera de la frase favorita de la IA.',
      de: '"Du hast absolut recht!" — Der Zip-Hoodie der die Lieblingsphrase der KI einfängt.',
    },
  },
  // ── 6 Desk Items: all need dark background ──
  {
    file: '07-git-reset-mousepad.png',
    needsDarkBg: true,
    name: 'Hard Reset',
    subtitle: 'Mouse Pad',
    blueprintId: 442,
    providerId: 30,
    position: 'front',
    scale: 1,
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
    needsDarkBg: true,
    name: 'Dev 404',
    subtitle: 'LED Gaming Desk Mat',
    blueprintId: 969,
    providerId: 90,
    position: 'front',
    scale: 1,
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
    needsDarkBg: true,
    name: 'Career Path',
    subtitle: 'Satin Poster',
    blueprintId: 97,
    providerId: 99,
    position: 'front',
    scale: 1,
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
    needsDarkBg: true,
    name: 'Full Stack',
    subtitle: 'Laptop Sleeve',
    blueprintId: 429,
    providerId: 1,
    position: 'front',
    scale: 1,
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
    needsDarkBg: true,
    name: 'Ctrl+Z',
    subtitle: 'Square Stickers',
    blueprintId: 794,
    providerId: 73,
    position: 'front',
    scale: 1,
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
    needsDarkBg: true,
    name: 'Deprecated',
    subtitle: 'Framed Poster',
    blueprintId: 1130,
    providerId: 66,
    position: 'front',
    scale: 1,
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
  console.log('  FIX 8 MEME PRODUCTS')
  console.log('═══════════════════════════════════════════════════════\n')
  if (DRY_RUN) console.log('  *** DRY RUN ***\n')

  const designsDir = join(import.meta.dirname, '..', 'public', 'meme-designs')
  const results = []

  // ═══ Phase 1: Delete 8 broken products ═══════════════════════════════════
  console.log('Phase 1: Deleting 8 broken products...\n')

  for (const p of PRODUCTS_TO_DELETE) {
    try {
      if (!DRY_RUN) {
        // Printify delete
        try {
          await api(`/shops/${SHOP_ID}/products/${p.printifyId}.json`, { method: 'DELETE' })
          console.log(`  Printify DELETE ✓ ${p.name} (${p.printifyId})`)
        } catch (e) {
          if (e.message.includes('404')) {
            console.log(`  Printify SKIP   ${p.name} (already deleted)`)
          } else {
            throw e
          }
        }
        await delay(500)

        // Supabase hard delete
        for (const table of CHILD_TABLES) {
          await supabase.from(table).delete().eq('product_id', p.supabaseId)
        }
        await supabase.from('designs').update({ product_id: null }).eq('product_id', p.supabaseId)
        await supabase.from('products').delete().eq('id', p.supabaseId)
        console.log(`  Supabase DELETE ✓ ${p.name} (${p.supabaseId})`)
      } else {
        console.log(`  [DRY] Would delete ${p.name}`)
      }
    } catch (e) {
      console.error(`  ✗ ${p.name}: ${e.message}`)
    }
  }

  // ═══ Phase 2: Upload designs (with dark bg for desk items) ═══════════════
  console.log('\nPhase 2: Uploading designs...\n')

  // We need uploads for: originals (hoodies) + dark-bg versions (desk items)
  // Key: "file" or "file:dark"
  const uploads = new Map()

  for (const prod of RECREATE) {
    const key = prod.needsDarkBg ? `${prod.file}:dark` : prod.file
    if (uploads.has(key)) continue // already uploaded

    try {
      const filePath = join(designsDir, prod.file)

      if (DRY_RUN) {
        uploads.set(key, `dry-run-${key}`)
        console.log(`  [DRY] ${key}`)
        continue
      }

      let buffer
      if (prod.needsDarkBg) {
        console.log(`  Adding dark bg to ${prod.file}...`)
        buffer = await addDarkBackground(filePath)
      } else {
        buffer = readFileSync(filePath)
      }

      const base64 = buffer.toString('base64')
      const fileName = prod.needsDarkBg ? `meme-v4-dark-${prod.file}` : `meme-v4-${prod.file}`

      await delay(2000)
      const upload = await api('/uploads/images.json', {
        method: 'POST',
        body: JSON.stringify({ file_name: fileName, contents: base64 }),
      })
      uploads.set(key, upload.id)
      console.log(`  ✓ ${key}: ${upload.id}`)
    } catch (e) {
      console.error(`  ✗ ${key}: ${e.message}`)
    }
  }

  console.log(`\n  ${uploads.size} designs uploaded\n`)

  // ═══ Phase 3: Category lookup ════════════════════════════════════════════
  const categorySlugs = [...new Set(RECREATE.map(p => p.category))]
  const catMap = {}
  for (const slug of categorySlugs) {
    const { data } = await supabase.from('categories').select('id').eq('slug', slug).single()
    catMap[slug] = data?.id || null
  }

  // ═══ Phase 4: Get variants per blueprint ═════════════════════════════════
  console.log('Phase 3: Fetching variants...\n')

  const bpData = new Map()
  const uniqueBPs = [...new Set(RECREATE.map(p => `${p.blueprintId}:${p.providerId}`))]

  for (const key of uniqueBPs) {
    const [bp, prov] = key.split(':').map(Number)
    await delay(500)
    const variantResp = await api(`/catalog/blueprints/${bp}/print_providers/${prov}/variants.json`)
    bpData.set(key, variantResp.variants || [])
    console.log(`  BP ${bp} / Prov ${prov}: ${(variantResp.variants || []).length} variants`)
  }

  // ═══ Phase 5: Create, Publish, Save ══════════════════════════════════════
  console.log('\nPhase 4: Creating products...\n')

  for (const prod of RECREATE) {
    const uploadKey = prod.needsDarkBg ? `${prod.file}:dark` : prod.file
    const uploadId = uploads.get(uploadKey)
    if (!uploadId) {
      results.push({ name: prod.name, status: 'error', error: 'Upload missing' })
      continue
    }

    const bpKey = `${prod.blueprintId}:${prod.providerId}`
    const variants = bpData.get(bpKey) || []

    const selectedVariants = prod.colors.length > 0
      ? filterByColors(variants, prod.colors)
      : variants

    if (selectedVariants.length === 0) {
      results.push({ name: prod.name, status: 'error', error: 'No variants' })
      console.error(`  ✗ ${prod.name}: No variants\n`)
      continue
    }

    const colorNames = [...new Set(selectedVariants.map(v => v.options?.color || v.title?.split('/')[0]?.trim() || '?'))]

    console.log(`  ── ${prod.name} — ${prod.subtitle} ──`)
    console.log(`     BP ${prod.blueprintId} | ${colorNames.length} colors, ${selectedVariants.length} variants | scale=${prod.scale}`)

    if (DRY_RUN) {
      results.push({ name: prod.name, status: 'dry-run', variants: selectedVariants.length })
      console.log(`     [DRY RUN]\n`)
      continue
    }

    try {
      // Create
      await delay(1500)
      const printifyProduct = await api(`/shops/${SHOP_ID}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          title: `${prod.name} — ${prod.subtitle}`,
          description: prod.desc.en,
          blueprint_id: prod.blueprintId,
          print_provider_id: prod.providerId,
          variants: selectedVariants.map(v => ({ id: v.id, price: prod.priceCents, is_enabled: true })),
          print_areas: [{
            variant_ids: selectedVariants.map(v => v.id),
            placeholders: [{
              position: prod.position,
              images: [{
                id: uploadId,
                x: 0.5,
                y: 0.5,
                scale: prod.scale,
                angle: 0,
              }],
            }],
          }],
          tags: prod.tags,
        }),
      })

      console.log(`     Printify: ${printifyProduct.id}`)

      // Publish
      await delay(1000)
      await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publish.json`, {
        method: 'POST',
        body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
      })
      console.log(`     Published ✓`)

      // Save to Supabase
      const { data: dbProduct, error: dbError } = await supabase
        .from('products')
        .insert({
          title: prod.name,
          description: prod.desc.en,
          printify_id: printifyProduct.id,
          blueprint_id: prod.blueprintId,
          print_provider_id: prod.providerId,
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
        results.push({ name: prod.name, status: 'partial', printifyId: printifyProduct.id })
        console.log()
        continue
      }

      const dbId = dbProduct.id

      // publishing_succeeded
      try {
        await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publishing_succeeded.json`, {
          method: 'POST',
          body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } }),
        })
      } catch { /* non-fatal */ }

      // Insert variants
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

      // Sync mockup images
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
      } catch { /* non-fatal */ }

      console.log(`     Supabase: ${dbId}`)
      console.log(`     Colors: ${colorNames.join(', ')}`)
      results.push({ name: prod.name, status: 'success', printifyId: printifyProduct.id, dbId, variants: selectedVariants.length })
      console.log()

    } catch (e) {
      console.error(`     ✗ ${e.message}\n`)
      results.push({ name: prod.name, status: 'error', error: e.message.slice(0, 120) })
    }
  }

  // ═══ Summary ═════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════')

  const ok = results.filter(r => r.status === 'success').length
  const fail = results.filter(r => r.status === 'error').length
  console.log(`  ✓ ${ok} fixed | ✗ ${fail} failed\n`)

  for (const r of results) {
    const icon = r.status === 'success' ? '✓' : r.status === 'dry-run' ? '~' : '✗'
    console.log(`  ${icon} ${r.name.padEnd(20)} ${r.status.padEnd(10)} ${r.variants ? r.variants + ' variants' : r.error || ''}`)
  }
  console.log()
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
