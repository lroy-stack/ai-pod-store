/**
 * BATCH 1 — Recreate 6 tees with EU stock (BP6/P26 — Textildruck Europa)
 *
 * Products: Absolutely Right, Vibe Coder, Zero Bugs, Ghost Tee, Shadow Tee, Prism Tee
 * Dark palette: Black, Dark Heather, Navy, Charcoal (26 variants per product)
 * Category: t-shirts (8a143376-d1f5-4568-88ff-20c2296420c5)
 *
 * Real data verified from:
 * - Printify API: GET /catalog/blueprints/6/print_providers/26/variants.json
 * - Supabase: products table (status=deleted) for descriptions
 * - Design files: dimensions verified with ImageMagick identify
 *
 * Usage: node scripts/_recreate-batch1.mjs [--dry-run]
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// ─── ENV ─────────────────────────────────────────────────────────────────────
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()

const TOKEN   = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL  = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY  = env('SUPABASE_SERVICE_KEY')

if (!TOKEN || !SHOP_ID) { console.error('Missing Printify creds'); process.exit(1) }
if (!SB_URL || !SB_KEY) { console.error('Missing Supabase creds'); process.exit(1) }

const DRY_RUN = process.argv.includes('--dry-run')
const supabase = createClient(SB_URL, SB_KEY)

// ─── Constants ───────────────────────────────────────────────────────────────
const API = 'https://api.printify.com/v1'
const BLUEPRINT_ID = 6          // Unisex Heavy Cotton Tee (Gildan 5000)
const PROVIDER_ID = 26          // Textildruck Europa (Germany) — EU shipping confirmed
const CATEGORY_ID = '8a143376-d1f5-4568-88ff-20c2296420c5'  // t-shirts

// Real variant IDs from Printify API (queried 2026-02-28)
// Dark palette only: Black, Dark Heather, Navy, Charcoal
const DARK_VARIANTS = [
  // Black — S through 5XL (8 sizes)
  { id: 12126, color: 'Black', size: 'S' },
  { id: 12125, color: 'Black', size: 'M' },
  { id: 12124, color: 'Black', size: 'L' },
  { id: 12127, color: 'Black', size: 'XL' },
  { id: 12128, color: 'Black', size: '2XL' },
  { id: 12129, color: 'Black', size: '3XL' },
  { id: 24039, color: 'Black', size: '4XL' },
  { id: 24171, color: 'Black', size: '5XL' },
  // Dark Heather — S through 2XL (5 sizes)
  { id: 11904, color: 'Dark Heather', size: 'S' },
  { id: 11903, color: 'Dark Heather', size: 'M' },
  { id: 11902, color: 'Dark Heather', size: 'L' },
  { id: 11905, color: 'Dark Heather', size: 'XL' },
  { id: 11906, color: 'Dark Heather', size: '2XL' },
  // Navy — S through 5XL (8 sizes)
  { id: 11988, color: 'Navy', size: 'S' },
  { id: 11987, color: 'Navy', size: 'M' },
  { id: 11986, color: 'Navy', size: 'L' },
  { id: 11989, color: 'Navy', size: 'XL' },
  { id: 11990, color: 'Navy', size: '2XL' },
  { id: 11991, color: 'Navy', size: '3XL' },
  { id: 23993, color: 'Navy', size: '4XL' },
  { id: 24126, color: 'Navy', size: '5XL' },
  // Charcoal — S through 2XL (5 sizes)
  { id: 11874, color: 'Charcoal', size: 'S' },
  { id: 11873, color: 'Charcoal', size: 'M' },
  { id: 11872, color: 'Charcoal', size: 'L' },
  { id: 11875, color: 'Charcoal', size: 'XL' },
  { id: 11876, color: 'Charcoal', size: '2XL' },
]

// ─── 6 Products for Batch 1 ─────────────────────────────────────────────────
// All designs are 3951x4919 (portrait), perfect fit for BP6 canvas (4606x5787)
const PRODUCTS = [
  {
    name: 'Absolutely Right',
    designFile: 'meme-designs/02-absolutely-right-tee.png',
    priceCents: 2499,
    tags: ['tshirt', 'claude', 'ai', 'humor', 'developer', 'meme', 'absolutely-right', 'skapara'],
    desc: {
      en: '"You\'re absolutely right!" — Every Claude response ever. The tee that captures AI\'s favorite phrase.',
      es: '"¡Tienes toda la razón!" — Cada respuesta de Claude. La camiseta que captura la frase favorita de la IA.',
      de: '"Du hast absolut recht!" — Jede Claude-Antwort. Das T-Shirt das die Lieblingsphrase der KI einfängt.',
    },
  },
  {
    name: 'Vibe Coder',
    designFile: 'meme-designs/03-vibe-coding-tee.png',
    priceCents: 2499,
    tags: ['tshirt', 'vibe-coding', 'cursor', 'ai', 'humor', 'developer', 'meme', 'skapara'],
    desc: {
      en: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — The art of describing what you want and pretending you built it.',
      es: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — El arte de describir lo que quieres y pretender que lo construiste.',
      de: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — Die Kunst zu beschreiben was man will und so zu tun als hätte man es gebaut.',
    },
  },
  {
    name: 'Zero Bugs',
    designFile: 'meme-designs/05-no-bugs-tee.png',
    priceCents: 2499,
    tags: ['tshirt', 'chatgpt', 'ai', 'humor', 'developer', 'meme', 'bugs', 'features', 'skapara'],
    desc: {
      en: 'My code has no bugs. It has AI-generated features. The honest developer\'s daily uniform.',
      es: 'Mi código no tiene bugs. Tiene features generadas por IA. El uniforme diario del developer honesto.',
      de: 'Mein Code hat keine Bugs. Er hat KI-generierte Features. Die tägliche Uniform des ehrlichen Entwicklers.',
    },
  },
  {
    name: 'Ghost Tee',
    designFile: 'brand-designs/tee-dark.png',
    priceCents: 2499,
    tags: ['tshirt', 'skapara', 'branded', 'minimal', 'clean', 'white'],
    desc: {
      en: 'Less is everything. Dark SKAPARA mark on light cotton — minimal presence, maximum impact. The quiet flex.',
      es: 'Menos es todo. Marca SKAPARA oscura sobre algodón claro — presencia mínima, impacto máximo. El flex silencioso.',
      de: 'Weniger ist alles. Dunkles SKAPARA-Zeichen auf heller Baumwolle — minimale Präsenz, maximale Wirkung. Der leise Flex.',
    },
  },
  {
    name: 'Shadow Tee',
    designFile: 'brand-designs/tee-white.png',
    priceCents: 2499,
    tags: ['tshirt', 'skapara', 'branded', 'streetwear', 'underground', 'black'],
    desc: {
      en: 'The original SKAPARA statement. White mark on black — clean, bold, unmistakable. For those who let their style speak volumes.',
      es: 'La declaración original de SKAPARA. Marca blanca sobre negro — limpio, audaz, inconfundible. Para los que dejan que su estilo hable.',
      de: 'Das originale SKAPARA Statement. Weißes Zeichen auf Schwarz — klar, mutig, unverwechselbar. Für die, die ihren Stil sprechen lassen.',
    },
  },
  {
    name: 'Prism Tee',
    designFile: 'brand-designs/tee-gradient.png',
    priceCents: 2699,
    tags: ['tshirt', 'skapara', 'branded', 'gradient', 'premium', 'color'],
    desc: {
      en: 'Full spectrum energy. The SKAPARA gradient mark catches light like nothing else — art you wear, not just a logo.',
      es: 'Energía de espectro completo. La marca gradiente SKAPARA atrapa la luz como nada — arte que vistes, no solo un logo.',
      de: 'Volle Spektrum-Energie. Das SKAPARA-Gradient fängt Licht wie nichts anderes — Kunst die du trägst, nicht nur ein Logo.',
    },
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, options = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Printify ${r.status}: ${text.slice(0, 300)}`)
  }
  return r.json()
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  BATCH 1 — 6 Tees BP6/P26 (Textildruck Europa)')
  console.log('  Dark palette: Black, Dark Heather, Navy, Charcoal')
  console.log(`  Variants per product: ${DARK_VARIANTS.length}`)
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════\n')

  const publicDir = join(import.meta.dirname, '..', 'public')
  const results = []

  // ── Pre-flight: verify all design files exist ─────────────────────────────
  console.log('Pre-flight: Verifying design files...')
  for (const prod of PRODUCTS) {
    const path = join(publicDir, prod.designFile)
    try {
      const stat = readFileSync(path)
      console.log(`  OK ${prod.name}: ${prod.designFile} (${(stat.length / 1024).toFixed(0)} KB)`)
    } catch {
      console.error(`  MISSING ${prod.name}: ${prod.designFile}`)
      console.error('  ABORTING — all designs must exist before proceeding.')
      process.exit(1)
    }
  }

  // ── Pre-flight: verify Printify API connection ────────────────────────────
  console.log('\nPre-flight: Verifying Printify API...')
  try {
    const shops = await api('/shops.json')
    const shop = shops.find(s => String(s.id) === String(SHOP_ID))
    if (!shop) {
      console.error(`  Shop ${SHOP_ID} not found in account.`)
      process.exit(1)
    }
    console.log(`  Shop: ${shop.title} (ID: ${shop.id})`)
  } catch (e) {
    console.error(`  API error: ${e.message}`)
    process.exit(1)
  }

  // ── Pre-flight: verify Supabase connection + category exists ──────────────
  console.log('\nPre-flight: Verifying Supabase...')
  const { data: cat } = await supabase.from('categories').select('id, slug, name_en').eq('id', CATEGORY_ID).single()
  if (!cat) {
    console.error(`  Category ${CATEGORY_ID} not found in Supabase.`)
    process.exit(1)
  }
  console.log(`  Category: ${cat.slug} (${cat.name_en})`)

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: would create these products ---')
    for (const prod of PRODUCTS) {
      console.log(`  ${prod.name}: €${(prod.priceCents/100).toFixed(2)} | ${DARK_VARIANTS.length} variants | ${prod.designFile}`)
    }
    console.log('\nRun without --dry-run to execute.')
    return
  }

  // ── Step 1: Upload all designs to Printify ────────────────────────────────
  console.log('\nStep 1: Uploading designs to Printify...')
  const uploads = new Map()

  for (const prod of PRODUCTS) {
    const filePath = join(publicDir, prod.designFile)
    const fileBuffer = readFileSync(filePath)
    const base64 = fileBuffer.toString('base64')
    const fileName = prod.designFile.split('/').pop()

    try {
      await delay(1500)  // Rate limit: Printify allows ~40 req/min
      const upload = await api('/uploads/images.json', {
        method: 'POST',
        body: JSON.stringify({ file_name: `batch1-${fileName}`, contents: base64 }),
      })
      uploads.set(prod.name, upload.id)
      console.log(`  OK ${prod.name}: image_id=${upload.id}`)
    } catch (e) {
      console.error(`  FAIL ${prod.name}: ${e.message}`)
      console.error('  ABORTING — all images must upload successfully.')
      process.exit(1)
    }
  }
  console.log(`  ${uploads.size}/${PRODUCTS.length} images uploaded.`)

  // ── Step 2: Create products in Printify ───────────────────────────────────
  console.log('\nStep 2: Creating products in Printify...')

  for (const prod of PRODUCTS) {
    const imageId = uploads.get(prod.name)
    if (!imageId) {
      results.push({ name: prod.name, status: 'error', error: 'No upload ID' })
      continue
    }

    try {
      const variantIds = DARK_VARIANTS.map(v => v.id)

      const body = {
        title: prod.name,
        description: prod.desc.en,
        blueprint_id: BLUEPRINT_ID,
        print_provider_id: PROVIDER_ID,
        variants: DARK_VARIANTS.map(v => ({
          id: v.id,
          price: prod.priceCents,
          is_enabled: true,
        })),
        print_areas: [{
          variant_ids: variantIds,
          placeholders: [{
            position: 'front',
            images: [{
              id: imageId,
              x: 0.5,    // Centered horizontally
              y: 0.5,    // Centered vertically
              scale: 1,  // Full print area
              angle: 0,  // No rotation
            }],
          }],
        }],
        tags: prod.tags,
      }

      await delay(2000)  // Rate limit
      const created = await api(`/shops/${SHOP_ID}/products.json`, {
        method: 'POST',
        body: JSON.stringify(body),
      })

      console.log(`  OK ${prod.name}: printify_id=${created.id}`)

      // Publish
      await delay(1000)
      await api(`/shops/${SHOP_ID}/products/${created.id}/publish.json`, {
        method: 'POST',
        body: JSON.stringify({
          title: true,
          description: true,
          images: true,
          variants: true,
          tags: true,
        }),
      })
      console.log(`     Published.`)

      // ── Step 3: Insert to Supabase ──────────────────────────────────────
      const { data: dbRow, error: dbErr } = await supabase
        .from('products')
        .insert({
          title: prod.name,
          description: prod.desc.en,
          printify_id: created.id,
          blueprint_id: BLUEPRINT_ID,
          print_provider_id: PROVIDER_ID,
          category_id: CATEGORY_ID,
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

      if (dbErr) {
        console.error(`     Supabase insert error: ${dbErr.message}`)
        results.push({ name: prod.name, status: 'partial', printifyId: created.id, error: dbErr.message })
        continue
      }

      console.log(`     Supabase ID: ${dbRow.id}`)

      // Notify Printify of successful publishing
      try {
        await api(`/shops/${SHOP_ID}/products/${created.id}/publishing_succeeded.json`, {
          method: 'POST',
          body: JSON.stringify({ external: { id: dbRow.id, handle: `/shop/${dbRow.id}` } }),
        })
      } catch { /* non-fatal */ }

      // ── Step 4: Insert variants to Supabase ────────────────────────────
      let variantInsertCount = 0
      for (const v of DARK_VARIANTS) {
        const { error: vErr } = await supabase.from('product_variants').upsert(
          {
            product_id: dbRow.id,
            printify_variant_id: String(v.id),
            title: `${v.color} / ${v.size}`,
            color: v.color,
            size: v.size,
            price_cents: prod.priceCents,
            is_enabled: true,
            is_available: true,
          },
          { onConflict: 'product_id,printify_variant_id' }
        )
        if (!vErr) variantInsertCount++
      }
      console.log(`     Variants synced: ${variantInsertCount}/${DARK_VARIANTS.length}`)

      // ── Step 5: Sync mockup images from Printify ──────────────────────
      await delay(3000)  // Wait for Printify to generate mockups
      try {
        const details = await api(`/shops/${SHOP_ID}/products/${created.id}.json`)
        if (details.images?.length) {
          const imageUrls = details.images
            .filter(img => img.src && !img.src.includes('size-chart'))
            .slice(0, 10)
            .map(img => img.src)

          if (imageUrls.length > 0) {
            await supabase.from('products').update({
              images: imageUrls,
              thumbnail_url: imageUrls[0],
            }).eq('id', dbRow.id)
            console.log(`     Images synced: ${imageUrls.length} mockups`)
          }
        }
      } catch (e) {
        console.log(`     Image sync skipped: ${e.message.slice(0, 80)}`)
      }

      results.push({
        name: prod.name,
        status: 'success',
        printifyId: created.id,
        dbId: dbRow.id,
        variants: variantInsertCount,
      })

      console.log()
    } catch (e) {
      console.error(`  FAIL ${prod.name}: ${e.message}`)
      results.push({ name: prod.name, status: 'error', error: e.message.slice(0, 120) })
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log('  BATCH 1 RESULTS')
  console.log('═══════════════════════════════════════════════════════')
  const ok = results.filter(r => r.status === 'success').length
  const partial = results.filter(r => r.status === 'partial').length
  const fail = results.filter(r => r.status === 'error').length
  console.log(`  Success: ${ok} | Partial: ${partial} | Failed: ${fail}\n`)
  for (const r of results) {
    const icon = r.status === 'success' ? 'OK' : r.status === 'partial' ? '!!' : 'XX'
    const detail = r.status === 'success'
      ? `printify=${r.printifyId} db=${r.dbId} ${r.variants} variants`
      : r.error
    console.log(`  [${icon}] ${r.name.padEnd(20)} ${detail}`)
  }
  console.log()
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
