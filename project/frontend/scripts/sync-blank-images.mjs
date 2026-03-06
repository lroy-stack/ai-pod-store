#!/usr/bin/env node
/**
 * Sync blank garment images from Printful Catalog API → product_variants.
 *
 * For each active product with a `product_template_id` (Printful catalog ID),
 * fetches catalog variant details (blank image URL + hex color code) and
 * stores them in `product_variants.blank_image_url` and `color_hex`.
 *
 * Usage:
 *   node frontend/scripts/sync-blank-images.mjs
 *   node frontend/scripts/sync-blank-images.mjs --force   # overwrite existing
 *
 * Requires: PRINTFUL_API_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY in .env.local
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── Load env from .env.local ───────────────────────────────────────
function loadEnv() {
  const paths = ['frontend/.env.local', '.env.local', '.env']
  for (const p of paths) {
    try {
      const raw = readFileSync(p, 'utf-8')
      for (const line of raw.split('\n')) {
        const match = line.match(/^([A-Z_]+[A-Z0-9_]*)=(.*)$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
        }
      }
    } catch { /* skip */ }
  }
}

loadEnv()

const PRINTFUL_TOKEN = process.env.PRINTFUL_API_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!PRINTFUL_TOKEN) { console.error('Missing PRINTFUL_API_TOKEN'); process.exit(1) }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const FORCE = process.argv.includes('--force')
const DELAY_MS = 1500

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function printfulGet(path) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
      'User-Agent': 'POD-AI-Store/1.0',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Printful ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.result
}

async function main() {
  console.log('=== Sync Blank Images from Printful Catalog ===\n')

  // 1. Get unique catalog IDs from active products
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, title, product_template_id')
    .not('product_template_id', 'is', null)
    .eq('status', 'active')

  if (prodErr) { console.error('DB error:', prodErr.message); process.exit(1) }
  if (!products?.length) { console.log('No products with product_template_id found.'); return }

  // Group products by catalog ID
  const catalogMap = new Map()
  for (const p of products) {
    const catalogId = p.product_template_id
    if (!catalogMap.has(catalogId)) {
      catalogMap.set(catalogId, [])
    }
    catalogMap.get(catalogId).push(p)
  }

  console.log(`Found ${products.length} products across ${catalogMap.size} catalog templates\n`)

  let totalUpdated = 0
  let totalSkipped = 0
  let totalErrors = 0

  for (const [catalogId, prods] of catalogMap) {
    const titles = prods.map(p => p.title).join(', ')
    console.log(`\n--- Catalog ${catalogId}: ${titles}`)

    try {
      // 2. Fetch catalog product with variants
      const catalogProduct = await printfulGet(`/products/${catalogId}`)
      const catalogVariants = catalogProduct.variants || []

      if (!catalogVariants.length) {
        console.log('  No catalog variants found')
        continue
      }

      console.log(`  ${catalogVariants.length} catalog variants`)

      // Build lookup: color name (lowercase) → { image, colorCode }
      // One blank image per color is enough (same garment photo for all sizes)
      const colorLookup = new Map()
      for (const cv of catalogVariants) {
        if (cv.color && cv.image && !colorLookup.has(cv.color.toLowerCase())) {
          colorLookup.set(cv.color.toLowerCase(), {
            image: cv.image,
            colorCode: cv.color_code ? (cv.color_code.startsWith('#') ? cv.color_code : `#${cv.color_code}`) : null,
          })
        }
      }

      console.log(`  ${colorLookup.size} unique colors with images`)

      // 3. Get our product_variants for these products
      const productIds = prods.map(p => p.id)
      const { data: variants, error: varErr } = await supabase
        .from('product_variants')
        .select('id, product_id, color, blank_image_url, color_hex')
        .in('product_id', productIds)
        .eq('is_enabled', true)

      if (varErr) {
        console.log(`  DB error: ${varErr.message}`)
        totalErrors++
        continue
      }

      if (!variants?.length) {
        console.log('  No product_variants found')
        continue
      }

      // 4. Match by color name and update
      const updates = []
      for (const v of variants) {
        if (!FORCE && v.blank_image_url && v.color_hex) {
          totalSkipped++
          continue
        }

        const match = v.color ? colorLookup.get(v.color.toLowerCase()) : null

        if (match) {
          updates.push({
            id: v.id,
            blank_image_url: match.image,
            color_hex: match.colorCode || v.color_hex,
          })
        }
      }

      // Batch update
      if (updates.length > 0) {
        for (const u of updates) {
          const { error: upErr } = await supabase
            .from('product_variants')
            .update({ blank_image_url: u.blank_image_url, color_hex: u.color_hex })
            .eq('id', u.id)

          if (upErr) {
            console.log(`  Update error for ${u.id}: ${upErr.message}`)
            totalErrors++
          } else {
            totalUpdated++
          }
        }
        console.log(`  Updated ${updates.length} variants`)
      } else {
        console.log('  No updates needed')
      }
    } catch (err) {
      console.log(`  Error fetching catalog ${catalogId}: ${err.message}`)
      totalErrors++
    }

    await delay(DELAY_MS)
  }

  console.log(`\n=== Done ===`)
  console.log(`Updated: ${totalUpdated}`)
  console.log(`Skipped: ${totalSkipped} (already populated)`)
  console.log(`Errors:  ${totalErrors}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
