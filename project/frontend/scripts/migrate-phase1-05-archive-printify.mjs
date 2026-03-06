/**
 * migrate-phase1-05-archive-printify.mjs
 *
 * Phase 1 Step 5: Archive (unpublish) Printify products.
 *
 * - Reads phase1-audit.json for printify_ids
 * - Unpublishes each product on Printify (reversible)
 * - Saves legacy printify_id in Supabase metadata
 * - Clears printify_id in Supabase
 *
 * ONLY run after step 4 is verified and step 6 passes.
 * Supports --dry-run and --delete-permanent (caution).
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-05-archive-printify.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-05-archive-printify.mjs
 *   cd frontend && node scripts/migrate-phase1-05-archive-printify.mjs --delete-permanent
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, join } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const DELETE_PERMANENT = process.argv.includes('--delete-permanent')

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const PRINTIFY_TOKEN = env('PRINTIFY_API_TOKEN')
const PRINTIFY_SHOP = env('PRINTIFY_SHOP_ID')
const SUPABASE_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')

if (!PRINTIFY_TOKEN || !PRINTIFY_SHOP) {
  console.error('ERROR: PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID required in .env.local')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required in .env.local')
  process.exit(1)
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DELAY_MS = 2000
const AUDIT_PATH = join(ROOT, 'scripts', 'phase1-audit.json')
const OUTPUT_PATH = join(ROOT, 'scripts', 'phase1-archive-results.json')

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function printifyFetch(path, options = {}) {
  const url = `https://api.printify.com/v1/shops/${PRINTIFY_SHOP}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${PRINTIFY_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'POD-AI-Store/1.0',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Printify ${res.status}: ${body.slice(0, 300)}`)
  }

  if (res.status === 204) return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

async function supabaseFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=minimal',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  }

  return null
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 5: Archive Printify Products           ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no changes ***')
  if (DELETE_PERMANENT) console.log('  ⚠ PERMANENT DELETE MODE — products will be removed from Printify')
  console.log()

  // Load audit
  if (!existsSync(AUDIT_PATH)) {
    console.error('ERROR: phase1-audit.json not found. Run step 0 first.')
    process.exit(1)
  }
  const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8'))

  const results = []
  let archived = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < audit.products.length; i++) {
    const product = audit.products[i]
    const prog = `[${i + 1}/${audit.products.length}]`

    if (!product.printify_id) {
      console.log(`${prog} ⊘ ${product.title}: no printify_id — skipping`)
      results.push({ id: product.id, title: product.title, status: 'skipped', reason: 'no printify_id' })
      skipped++
      continue
    }

    console.log(`${prog} ${product.title} (printify_id: ${product.printify_id})`)

    if (DRY_RUN) {
      console.log(`  → Would ${DELETE_PERMANENT ? 'DELETE' : 'unpublish'} from Printify`)
      console.log(`  → Would clear printify_id in Supabase`)
      results.push({ id: product.id, title: product.title, status: 'dry_run' })
      continue
    }

    try {
      await delay(DELAY_MS)

      if (DELETE_PERMANENT) {
        // Permanently delete from Printify
        await printifyFetch(`/products/${product.printify_id}.json`, { method: 'DELETE' })
        console.log(`  ✓ Deleted from Printify`)
      } else {
        // Unpublish (reversible)
        await printifyFetch(`/products/${product.printify_id}/unpublish.json`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        console.log(`  ✓ Unpublished from Printify`)
      }

      // Save legacy printify_id in product_details and clear printify_id
      // First get current product_details
      const currentProduct = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${product.id}&select=product_details`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      }).then(r => r.json())
      const currentDetails = currentProduct?.[0]?.product_details || {}
      const updatedDetails = { ...currentDetails, legacy_printify_id: product.printify_id }

      await supabaseFetch(`/products?id=eq.${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          printify_id: null,
          product_details: updatedDetails,
        }),
      })
      console.log(`  ✓ Cleared printify_id in Supabase (saved in product_details)`)

      archived++
      results.push({
        id: product.id,
        title: product.title,
        printify_id: product.printify_id,
        status: DELETE_PERMANENT ? 'deleted' : 'unpublished',
        archivedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}`)
      failed++
      results.push({
        id: product.id,
        title: product.title,
        printify_id: product.printify_id,
        status: 'failed',
        error: err.message,
      })
    }
  }

  // Save results
  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2))

  // Summary
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  ARCHIVE SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Archived: ${archived}`)
  console.log(`  Skipped:  ${skipped}`)
  console.log(`  Failed:   ${failed}`)
  console.log(`  Output:   ${OUTPUT_PATH}`)
  console.log()

  if (failed > 0) {
    console.log('  ⚠ Some archives failed. Check errors and retry.')
  } else if (!DRY_RUN) {
    console.log('  Next step: node scripts/migrate-phase1-06-verify.mjs')
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
