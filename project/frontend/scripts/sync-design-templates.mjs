#!/usr/bin/env node
/**
 * Sync Printful ghost templates → products.design_templates JSONB.
 *
 * For each active product with product_template_id (Printful catalog ID),
 * fetches mockup-generator/templates/{id} to get:
 *   - Ghost image URLs per color/placement
 *   - Exact print area coordinates (pixels within template image)
 *   - Variant-to-template mapping
 *
 * Usage:
 *   node frontend/scripts/sync-design-templates.mjs
 *   node frontend/scripts/sync-design-templates.mjs --force   # overwrite existing
 *   node frontend/scripts/sync-design-templates.mjs --dry-run # preview only
 *
 * Requires: PRINTFUL_API_TOKEN, PRINTFUL_STORE_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── Load env ────────────────────────────────────────────────────
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
const PRINTFUL_STORE = process.env.PRINTFUL_STORE_ID
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!PRINTFUL_TOKEN) { console.error('Missing PRINTFUL_API_TOKEN'); process.exit(1) }
if (!PRINTFUL_STORE) { console.error('Missing PRINTFUL_STORE_ID'); process.exit(1) }
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY'); process.exit(1) }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const FORCE = process.argv.includes('--force')
const DRY_RUN = process.argv.includes('--dry-run')
const DELAY_MS = 2000

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function printfulGet(path) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
      'X-PF-Store-Id': PRINTFUL_STORE,
      'User-Agent': 'POD-AI-Store/1.0',
    },
  })

  // Handle rate limiting
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '60')
    console.log(`  Rate limited, waiting ${retryAfter}s...`)
    await delay(retryAfter * 1000 + 2000)
    return printfulGet(path) // retry
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Printful ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.result
}

/**
 * Parse the templates API response into a compact structure for DB storage.
 *
 * Input:  raw result from GET /mockup-generator/templates/{id}
 * Output: structured JSONB for products.design_templates
 */
function parseTemplateResponse(raw, catalogVariants) {
  const templates = raw.templates || []
  const variantMapping = raw.variant_mapping || []

  if (!templates.length) return null

  // Build template lookup: template_id → template data
  const templateLookup = {}
  for (const t of templates) {
    templateLookup[t.template_id] = {
      image_url: t.image_url || null,
      background_color: t.background_color || null,
      template_width: t.template_width,
      template_height: t.template_height,
      print_area_width: t.print_area_width,
      print_area_height: t.print_area_height,
      print_area_left: t.print_area_left,
      print_area_top: t.print_area_top,
      is_template_on_front: t.is_template_on_front,
    }
  }

  // Build variant → template mapping (variant_id → { placement: template_id })
  const variantMap = {}
  for (const v of variantMapping) {
    const placementMap = {}
    for (const tp of (v.templates || [])) {
      placementMap[tp.placement] = tp.template_id
    }
    variantMap[v.variant_id] = placementMap
  }

  // Discover all placements
  const allPlacements = new Set()
  for (const v of variantMapping) {
    for (const tp of (v.templates || [])) {
      allPlacements.add(tp.placement)
    }
  }

  // Build color → variant_id lookup using catalog variants
  // This allows the editor to find the right template by color name
  const colorToVariantId = {}
  if (catalogVariants) {
    for (const cv of catalogVariants) {
      if (cv.color && !colorToVariantId[cv.color.toLowerCase()]) {
        colorToVariantId[cv.color.toLowerCase()] = cv.id
      }
    }
  }

  // Build per-placement summary (unique ghost images + print area)
  // Since print area is the same for all colors within a placement,
  // we just need one representative template per placement
  const placementInfo = {}
  for (const placement of allPlacements) {
    // Find first variant that has this placement
    for (const v of variantMapping) {
      const tp = (v.templates || []).find(t => t.placement === placement)
      if (tp) {
        const tmpl = templateLookup[tp.template_id]
        if (tmpl) {
          placementInfo[placement] = {
            template_width: tmpl.template_width,
            template_height: tmpl.template_height,
            print_area_width: tmpl.print_area_width,
            print_area_height: tmpl.print_area_height,
            print_area_left: tmpl.print_area_left,
            print_area_top: tmpl.print_area_top,
          }
        }
        break
      }
    }
  }

  return {
    version: raw.version || 1,
    placements: [...allPlacements].sort(),
    placement_info: placementInfo,
    templates: templateLookup,
    variant_mapping: variantMap,
    color_to_variant_id: colorToVariantId,
  }
}

async function main() {
  console.log('=== Sync Design Templates from Printful ===\n')
  if (DRY_RUN) console.log('** DRY RUN — no DB writes **\n')

  // 1. Get products with catalog IDs
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, title, product_template_id, design_templates')
    .not('product_template_id', 'is', null)
    .eq('status', 'active')

  if (prodErr) { console.error('DB error:', prodErr.message); process.exit(1) }
  if (!products?.length) { console.log('No products with product_template_id found.'); return }

  // Group by catalog ID (multiple products may share the same catalog)
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
    const titles = prods.map(p => p.title).slice(0, 3).join(', ')
    console.log(`\n--- Catalog ${catalogId}: ${titles}`)

    // Skip if already populated (unless --force)
    if (!FORCE && prods.every(p => p.design_templates)) {
      console.log('  Already populated (use --force to overwrite)')
      totalSkipped += prods.length
      continue
    }

    try {
      // 2. Fetch templates
      const templateResult = await printfulGet(`/mockup-generator/templates/${catalogId}`)

      // 3. Also fetch catalog product to get variant color names
      await delay(1000) // Respect rate limits
      let catalogVariants = null
      try {
        const catalogProduct = await printfulGet(`/products/${catalogId}`)
        catalogVariants = catalogProduct.variants || []
      } catch (err) {
        console.log(`  Warning: couldn't fetch catalog variants: ${err.message}`)
      }

      // 4. Parse into structured format
      const parsed = parseTemplateResponse(templateResult, catalogVariants)

      if (!parsed) {
        console.log('  No templates found')
        totalErrors++
        continue
      }

      const placementCount = parsed.placements.length
      const templateCount = Object.keys(parsed.templates).length
      const variantCount = Object.keys(parsed.variant_mapping).length
      const colorCount = Object.keys(parsed.color_to_variant_id).length

      console.log(`  ${templateCount} templates, ${variantCount} variants, ${placementCount} placements, ${colorCount} colors`)
      console.log(`  Placements: ${parsed.placements.join(', ')}`)

      // Show print area info per placement
      for (const [placement, info] of Object.entries(parsed.placement_info)) {
        console.log(`    ${placement}: ${info.print_area_width}×${info.print_area_height} at (${info.print_area_left}, ${info.print_area_top}) in ${info.template_width}×${info.template_height}`)
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update ${prods.length} products`)
        totalSkipped += prods.length
        continue
      }

      // 5. Update all products with this catalog ID
      for (const p of prods) {
        const { error: upErr } = await supabase
          .from('products')
          .update({ design_templates: parsed })
          .eq('id', p.id)

        if (upErr) {
          console.log(`  Update error for ${p.id}: ${upErr.message}`)
          totalErrors++
        } else {
          totalUpdated++
        }
      }
      console.log(`  Updated ${prods.length} products`)

    } catch (err) {
      console.log(`  Error for catalog ${catalogId}: ${err.message}`)
      totalErrors++
    }

    await delay(DELAY_MS)
  }

  console.log(`\n=== Done ===`)
  console.log(`Updated: ${totalUpdated}`)
  console.log(`Skipped: ${totalSkipped}`)
  console.log(`Errors:  ${totalErrors}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
