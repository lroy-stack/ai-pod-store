/**
 * migrate-phase1-08-disable-light-colors.mjs
 *
 * Phase 1 Step 8b: Disable light-colored variants that are incompatible with white-text designs.
 *
 * 95% of SKAPARA designs use white/ghost text + bright accent colors → only work on dark backgrounds.
 * Light colors (Ivory, White, Vintage White) make designs invisible.
 *
 * This script sets is_enabled = false for these variants across all 20 Printful products.
 *
 * Supports --dry-run.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-08-disable-light-colors.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-08-disable-light-colors.mjs
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

// ─── Constants ──────────────────────────────────────────────────────────────────

// Colors that make white-text designs invisible
const LIGHT_COLORS = ['Ivory', 'White', 'Vintage White']

const PRODUCTS_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')
const productsData = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
const productIds = Object.keys(productsData)

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 8b: Disable Light Color Variants        ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no changes ***')
  console.log(`  Target colors: ${LIGHT_COLORS.join(', ')}`)
  console.log(`  Products: ${productIds.length}`)
  console.log()

  let totalDisabled = 0
  let totalAlreadyDisabled = 0

  for (let i = 0; i < productIds.length; i++) {
    const productId = productIds[i]
    const title = productsData[productId].title
    const prog = `[${i + 1}/${productIds.length}]`

    try {
      // Build OR filter for light colors
      const colorFilter = LIGHT_COLORS.map((c) => `color.eq.${c}`).join(',')

      // Fetch light-colored variants for this product
      const variants = await supabaseQuery(
        `/product_variants?product_id=eq.${productId}&or=(${colorFilter})&select=id,color,is_enabled`,
        { method: 'GET' }
      )

      if (!variants || variants.length === 0) {
        console.log(`${prog} ${title} — no light color variants`)
        continue
      }

      const enabled = variants.filter((v) => v.is_enabled)
      const alreadyDisabled = variants.filter((v) => !v.is_enabled)

      if (enabled.length === 0) {
        console.log(`${prog} ${title} — ${variants.length} light variants already disabled`)
        totalAlreadyDisabled += alreadyDisabled.length
        continue
      }

      const colorBreakdown = {}
      for (const v of enabled) {
        colorBreakdown[v.color] = (colorBreakdown[v.color] || 0) + 1
      }
      const breakdown = Object.entries(colorBreakdown)
        .map(([c, n]) => `${c}(${n})`)
        .join(', ')

      console.log(`${prog} ${title} — disabling ${enabled.length} variants: ${breakdown}`)

      if (!DRY_RUN) {
        // Batch disable by product + color
        for (const color of LIGHT_COLORS) {
          const colorVariants = enabled.filter((v) => v.color === color)
          if (colorVariants.length > 0) {
            await supabaseQuery(
              `/product_variants?product_id=eq.${productId}&color=eq.${encodeURIComponent(color)}&is_enabled=eq.true`,
              {
                method: 'PATCH',
                body: JSON.stringify({ is_enabled: false }),
              }
            )
          }
        }
      }

      totalDisabled += enabled.length
      totalAlreadyDisabled += alreadyDisabled.length
    } catch (err) {
      console.log(`${prog} ${title} — FAILED: ${err.message}`)
    }
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  LIGHT COLOR DISABLE SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Disabled:         ${totalDisabled}`)
  console.log(`  Already disabled: ${totalAlreadyDisabled}`)
  console.log(`  Colors targeted:  ${LIGHT_COLORS.join(', ')}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
