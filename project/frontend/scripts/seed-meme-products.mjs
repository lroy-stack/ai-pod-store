/**
 * Seed 10 Meme Design products into Printify + Supabase.
 * Each design maps to its intended product type (tee, crewneck, poster, mousepad, etc.)
 *
 * Usage: node scripts/seed-meme-products.mjs
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

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

// ─── Printify API helper ─────────────────────────────────────────────────────
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, options = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...options, headers: { ...headers, ...options.headers } })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Printify ${r.status}: ${text.slice(0, 200)}`)
  }
  return r.json()
}

// ─── Product catalog ─────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    file: '01-prompts-crewneck.png',
    name: 'Prompt Life',
    subtitle: 'Crewneck Sweatshirt',
    blueprintId: 457,        // Crew Neck Sweatshirt EU (Textildruck Europa)
    placeholder: 'front',    // 3366x4230
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 3999,
    category: 'hoodies',     // sweatshirts fall under hoodies
    tags: ['crewneck', 'sweatshirt', 'developer', 'ai', 'humor', 'prompt', 'vibe-coding', 'meme'],
    desc: {
      en: 'I don\'t write code anymore. I write prompts. The crewneck that speaks the truth about modern development.',
      es: 'Ya no escribo código. Escribo prompts. La sudadera que dice la verdad sobre el desarrollo moderno.',
      de: 'Ich schreibe keinen Code mehr. Ich schreibe Prompts. Das Sweatshirt das die Wahrheit über moderne Entwicklung sagt.',
    },
  },
  {
    file: '02-absolutely-right-tee.png',
    name: 'Absolutely Right',
    subtitle: 'Unisex Tee',
    blueprintId: 6,           // Bella+Canvas 3001 (3951x4919)
    placeholder: 'front',
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
    placeholder: 'front',
    colors: ['Black', 'Dark Heather', 'Navy', 'Army'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'vibe-coding', 'cursor', 'ai', 'humor', 'developer', 'meme', 'definition'],
    desc: {
      en: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — The art of describing what you want and pretending you built it.',
      es: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — El arte de describir lo que quieres y pretender que lo construiste.',
      de: 'Vibe Coding /vaɪb ˈkoʊdɪŋ/ — Die Kunst zu beschreiben was man will und so zu tun als hätte man es gebaut.',
    },
  },
  {
    file: '04-built-2hours-ls.png',
    name: 'Two Hours',
    subtitle: 'Long Sleeve Tee',
    blueprintId: 6,           // Using regular tee BP — design will scale fine
    placeholder: 'front',
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 2799,
    category: 't-shirts',
    tags: ['tshirt', 'long-sleeve', 'cursor', 'ai', 'humor', 'developer', 'meme', '2-hours', 'debugging'],
    desc: {
      en: '"I built this in 2 hours" (spent 6 hours debugging). $ cursor compose --yolo. Every dev\'s secret.',
      es: '"Lo hice en 2 horas" (pasé 6 horas debuggeando). $ cursor compose --yolo. El secreto de todo dev.',
      de: '"Hab ich in 2 Stunden gebaut" (6 Stunden debuggt). $ cursor compose --yolo. Das Geheimnis jedes Devs.',
    },
  },
  {
    file: '05-no-bugs-tee.png',
    name: 'Zero Bugs',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    placeholder: 'front',
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
    file: '06-prompt-engineer-poster.png',
    name: 'Career.js',
    subtitle: 'Satin Poster',
    blueprintId: 6,           // Using tee for now — poster BPs need EU provider check
    placeholder: 'front',
    colors: ['Black', 'Dark Heather'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'prompt-engineer', 'career', 'ai', 'humor', 'developer', 'meme', 'senior-dev'],
    desc: {
      en: 'Senior Dev → Prompt Engineer. career_progression.js — 2026 edition. © All careers deprecated.',
      es: 'Senior Dev → Prompt Engineer. career_progression.js — edición 2026. © Todas las carreras deprecadas.',
      de: 'Senior Dev → Prompt Engineer. career_progression.js — 2026 Edition. © Alle Karrieren deprecated.',
    },
  },
  {
    file: '07-git-reset-mousepad.png',
    name: 'Hard Reset',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    placeholder: 'front',
    colors: ['Black', 'Dark Heather'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'git', 'reset', 'ai', 'humor', 'developer', 'meme', 'undo', 'claude'],
    desc: {
      en: '$ git reset --hard — The real AI undo button. When Claude rewrites your entire codebase.',
      es: '$ git reset --hard — El verdadero botón de deshacer de la IA. Cuando Claude reescribe todo tu código.',
      de: '$ git reset --hard — Der wahre KI-Undo-Button. Wenn Claude deine gesamte Codebase neu schreibt.',
    },
  },
  {
    file: '08-refactor-anyway-zip.png',
    name: 'Refactor Anyway',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    placeholder: 'front',
    colors: ['Black', 'Dark Heather', 'Navy', 'Maroon'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'cursor', 'refactor', 'ai', 'humor', 'developer', 'meme', '3am'],
    desc: {
      en: 'If it ain\'t broke, I\'ll refactor it anyway. — cursor agent, 3am, unsupervised.',
      es: 'Si no está roto, lo refactorizo igual. — cursor agent, 3am, sin supervisión.',
      de: 'Wenn es nicht kaputt ist, refactore ich es trotzdem. — cursor agent, 3 Uhr morgens, unbeaufsichtigt.',
    },
  },
  {
    file: '09-full-credit-laptop.png',
    name: 'Full Credit',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    placeholder: 'front',
    colors: ['Black', 'Dark Heather', 'Navy'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'claude', 'chatgpt', 'cursor', 'ai', 'humor', 'developer', 'meme', 'credit'],
    desc: {
      en: 'I didn\'t write this code. But I take full credit. Powered by Claude, ChatGPT & Cursor.',
      es: 'Yo no escribí este código. Pero me llevo todo el crédito. Powered by Claude, ChatGPT & Cursor.',
      de: 'Ich habe diesen Code nicht geschrieben. Aber ich nehme die volle Anerkennung. Powered by Claude, ChatGPT & Cursor.',
    },
  },
  {
    file: '10-404-dev-gaming-pad.png',
    name: '404: Dev',
    subtitle: 'Unisex Tee',
    blueprintId: 6,
    placeholder: 'front',
    colors: ['Black', 'Dark Heather'],
    priceCents: 2499,
    category: 't-shirts',
    tags: ['tshirt', 'developer', '404', 'ai', 'humor', 'replaced', 'meme', 'not-found'],
    desc: {
      en: '404: Developer Not Found. Replaced by Claude, ChatGPT & Cursor — since 2026.',
      es: '404: Developer No Encontrado. Reemplazado por Claude, ChatGPT & Cursor — desde 2026.',
      de: '404: Entwickler nicht gefunden. Ersetzt durch Claude, ChatGPT & Cursor — seit 2026.',
    },
  },
]

// ─── Variant color filter ────────────────────────────────────────────────────
function filterByColors(variants, preferredColors) {
  const matched = variants.filter(v => {
    const color = (v.options?.color || v.title.split('/')[0] || '').trim().toLowerCase()
    return preferredColors.some(c => color.includes(c.toLowerCase()))
  })
  return matched.length >= 2 ? matched : variants.slice(0, 10)
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SEEDING 10 MEME DESIGN PRODUCTS')
  console.log('═══════════════════════════════════════════════════════\n')

  const designsDir = join(import.meta.dirname, '..', 'public', 'meme-designs')
  const results = []

  // ── Step 1: Category lookup ─────────────────────────────────────────────
  console.log('Step 1: Looking up categories...')
  const catMap = {}
  for (const slug of ['t-shirts', 'hoodies', 'accessories']) {
    const { data } = await supabase.from('categories').select('id').eq('slug', slug).single()
    catMap[slug] = data?.id || null
    console.log(`  ${slug}: ${data?.id || 'NOT FOUND'}`)
  }

  // ── Step 2: Get provider + variants for BP 6 (used by all products) ─────
  console.log('\nStep 2: Fetching Blueprint 6 providers...')
  await delay(500)
  const providers = await api(`/catalog/blueprints/6/print_providers.json`)
  const preferred = providers.filter(p =>
    ['US', 'DE', 'NL', 'PL', 'GB', 'ES'].includes(p.location?.country?.toUpperCase() || '')
  )
  const provider = preferred[0] || providers[0]
  console.log(`  Provider: ${provider.id} "${provider.title}" (${provider.location?.country || 'global'})`)

  await delay(500)
  const variantData = await api(`/catalog/blueprints/6/print_providers/${provider.id}/variants.json`)
  console.log(`  Total variants: ${variantData.variants.length}`)

  // ── Step 3: Upload all designs ──────────────────────────────────────────
  console.log('\nStep 3: Uploading designs...')
  const uploads = new Map()

  for (const prod of PRODUCTS) {
    try {
      const filePath = join(designsDir, prod.file)
      const fileBuffer = readFileSync(filePath)
      const base64 = fileBuffer.toString('base64')

      await delay(1500) // Rate limit
      const upload = await api('/uploads/images.json', {
        method: 'POST',
        body: JSON.stringify({ file_name: `meme-${prod.file}`, contents: base64 }),
      })
      uploads.set(prod.file, upload.id)
      console.log(`  ✓ ${prod.name}: ${upload.id}`)
    } catch (e) {
      console.error(`  ✗ ${prod.name}: ${e.message}`)
    }
  }

  console.log(`  ${uploads.size}/${PRODUCTS.length} designs uploaded`)

  // ── Step 4: Create + Publish products ───────────────────────────────────
  console.log('\nStep 4: Creating products...\n')

  for (const prod of PRODUCTS) {
    const uploadId = uploads.get(prod.file)
    if (!uploadId) {
      results.push({ name: prod.name, status: 'error', error: 'Upload failed' })
      continue
    }

    try {
      // Select variants by color
      const selectedVariants = filterByColors(variantData.variants, prod.colors)
      const colorNames = [...new Set(selectedVariants.map(v => v.options?.color || '?'))]
      const sizeCount = [...new Set(selectedVariants.map(v => v.options?.size || '?'))].length

      console.log(`Creating "${prod.name}" — ${colorNames.length} colors, ${sizeCount} sizes...`)

      await delay(1500)

      // Create product in Printify
      const printifyProduct = await api(`/shops/${SHOP_ID}/products.json`, {
        method: 'POST',
        body: JSON.stringify({
          title: `${prod.name} — ${prod.subtitle}`,
          description: prod.desc.en,
          blueprint_id: 6,
          print_provider_id: provider.id,
          variants: selectedVariants.map(v => ({ id: v.id, price: prod.priceCents, is_enabled: true })),
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

      console.log(`  Printify ID: ${printifyProduct.id}`)

      // Publish
      await delay(1000)
      await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}/publish.json`, {
        method: 'POST',
        body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
      })
      console.log(`  Published ✓`)

      // Save to Supabase
      const { data: dbProduct, error: dbError } = await supabase
        .from('products')
        .insert({
          title: prod.name,
          description: prod.desc.en,
          printify_id: printifyProduct.id,
          blueprint_id: 6,
          print_provider_id: provider.id,
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
        console.error(`  DB error: ${dbError.message}`)
      }

      const dbId = dbProduct?.id

      if (dbId) {
        // Confirm publishing to Printify
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

        // Sync images from Printify
        await delay(2000)
        try {
          const details = await api(`/shops/${SHOP_ID}/products/${printifyProduct.id}.json`)
          if (details.images?.length) {
            const imageUrls = details.images
              .filter(img => img.src && !img.src.includes('size-chart'))
              .slice(0, 8)
              .map(img => img.src)

            await supabase.from('products').update({
              images: imageUrls,
              thumbnail_url: imageUrls[0],
            }).eq('id', dbId)
          }
        } catch { /* non-fatal */ }

        console.log(`  Supabase ID: ${dbId}`)
        console.log(`  Colors: ${colorNames.join(', ')}`)
        console.log(`  Variants: ${selectedVariants.length} (${sizeCount} sizes × ${colorNames.length} colors)`)
        results.push({ name: prod.name, status: 'success', printifyId: printifyProduct.id, dbId, variants: selectedVariants.length })
      } else {
        results.push({ name: prod.name, status: 'partial', printifyId: printifyProduct.id, error: 'DB insert failed' })
      }

      console.log()
    } catch (e) {
      console.error(`  ✗ ${prod.name}: ${e.message}\n`)
      results.push({ name: prod.name, status: 'error', error: e.message.slice(0, 100) })
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════')
  const ok = results.filter(r => r.status === 'success').length
  const fail = results.filter(r => r.status === 'error').length
  console.log(`  ✓ ${ok} products created`)
  if (fail) console.log(`  ✗ ${fail} failed`)
  console.log()
  for (const r of results) {
    const icon = r.status === 'success' ? '✓' : r.status === 'partial' ? '⚠' : '✗'
    console.log(`  ${icon} ${r.name.padEnd(20)} ${r.status.padEnd(10)} ${r.variants ? r.variants + ' variants' : r.error || ''}`)
  }
  console.log()
}

main().catch(err => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
