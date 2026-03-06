/**
 * migrate-phase1-08-clean-blank-images.mjs
 *
 * Phase 1 Step 8a: Remove blank garment images from products.images[]
 *
 * The step 7 sync added 5 "blank" garment photos (model without design) to each product.
 * These images have alt text ending with "(blank)" and confuse the gallery.
 * This script removes them, keeping only the preview mockups with actual designs.
 *
 * Supports --dry-run.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-08-clean-blank-images.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-08-clean-blank-images.mjs
 */

import { readFileSync } from 'fs'
import { resolve, join } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const SUPABASE_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required')
  process.exit(1)
}

// ─── Supabase REST ──────────────────────────────────────────────────────────────

async function supabaseQuery(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=minimal',
    },
    method: options.method || 'GET',
    body: options.body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${options.method || 'GET'} ${path}: ${res.status} ${text}`)
  }
  if (options.method === 'GET' || options.prefer === 'return=representation') {
    return res.json()
  }
  return null
}

// ─── Product IDs ────────────────────────────────────────────────────────────────

const PRODUCTS_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')
const productsData = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
const productIds = Object.keys(productsData)

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 8a: Clean Blank Images from Gallery     ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no changes ***')
  console.log()

  let cleaned = 0
  let unchanged = 0
  let failed = 0

  for (let i = 0; i < productIds.length; i++) {
    const id = productIds[i]
    const title = productsData[id].title
    const prog = `[${i + 1}/${productIds.length}]`

    try {
      // Fetch current images
      const [product] = await supabaseQuery(
        `/products?id=eq.${id}&select=images`,
        { method: 'GET' }
      )

      if (!product || !Array.isArray(product.images)) {
        console.log(`${prog} ${title} — no images, skipping`)
        unchanged++
        continue
      }

      const before = product.images.length
      const filtered = product.images.filter(
        (img) => !(img.alt && img.alt.includes('(blank)'))
      )
      const removed = before - filtered.length

      if (removed === 0) {
        console.log(`${prog} ${title} — no blank images found (${before} total)`)
        unchanged++
        continue
      }

      console.log(`${prog} ${title} — removing ${removed} blank images (${before} → ${filtered.length})`)

      if (!DRY_RUN) {
        await supabaseQuery(`/products?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ images: filtered }),
        })
      }

      cleaned++
    } catch (err) {
      console.log(`${prog} ${title} — FAILED: ${err.message}`)
      failed++
    }
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  BLANK IMAGE CLEANUP SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Cleaned:   ${cleaned}`)
  console.log(`  Unchanged: ${unchanged}`)
  console.log(`  Failed:    ${failed}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
