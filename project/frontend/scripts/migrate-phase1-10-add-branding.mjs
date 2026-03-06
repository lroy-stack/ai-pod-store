/**
 * migrate-phase1-10-add-branding.mjs
 *
 * Adds sleeve_left (S mark) + label_outside (neck label) to all 17 Printful products.
 * Preserves existing front file. Skips variants that already have sleeve_left.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-10-add-branding.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-10-add-branding.mjs
 */

import { readFileSync } from 'fs'
import { resolve, join } from 'path'

const DRY_RUN = process.argv.includes('--dry-run')

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const TOKEN = env('PRINTFUL_API_TOKEN')
const STORE = env('PRINTFUL_STORE_ID')

if (!TOKEN || !STORE) {
  console.error('ERROR: PRINTFUL_API_TOKEN and PRINTFUL_STORE_ID required')
  process.exit(1)
}

// Branding file IDs (already uploaded to Printful File Library)
const SLEEVE_FILE_ID = 950357086
const LABEL_FILE_ID = 950357102

// Deleted products (no SVG source)
const DELETED = new Set([
  '168731f6-75db-4075-bb30-c1ec8fead998', // Absolutely Right
  '60f6ceb4-46a7-4bd3-92c0-2e67c4cf0f66', // Vibe Coder
  'e4867449-08b1-408a-b85b-b6ecd9b4274c', // Zero Bugs
])

const PRODUCTS_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')
const productsData = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))

async function pf(path, options = {}) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'X-PF-Store-Id': STORE,
      'Content-Type': 'application/json',
    },
    body: options.body,
  })
  const data = await res.json()
  if (data.code === 429) {
    const wait = 25
    console.log(`    ⏳ Rate limited, waiting ${wait}s...`)
    await new Promise(r => setTimeout(r, wait * 1000))
    return pf(path, options) // Retry once
  }
  return data
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 10: Add Branding to All Products        ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no changes ***')
  console.log(`  Sleeve file: ${SLEEVE_FILE_ID}`)
  console.log(`  Label file:  ${LABEL_FILE_ID}`)
  console.log()

  let totalUpdated = 0
  let totalFailed = 0
  let totalSkipped = 0
  let productIdx = 0

  const entries = Object.entries(productsData).filter(([uid]) => !DELETED.has(uid))

  for (const [uid, info] of entries) {
    productIdx++
    const { syncProductId: sid, title, tier } = info
    const prog = `[${productIdx}/${entries.length}]`

    console.log(`\n${prog} ${title} (${tier}, sync ${sid})`)

    const productData = await pf(`/store/products/${sid}`)
    const variants = productData.result?.sync_variants || []
    console.log(`  ${variants.length} variants`)

    for (let i = 0; i < variants.length; i++) {
      const sv = variants[i]
      const vid = sv.id
      const files = sv.files || []
      const types = files.map(f => f.type)

      // Get front file ID
      const frontFile = files.find(f => f.type === 'default' || f.type === 'front')
      if (!frontFile?.id) {
        console.log(`  [${i + 1}/${variants.length}] NO FRONT — skip`)
        totalSkipped++
        continue
      }

      // Skip if already has sleeve
      if (types.includes('sleeve_left')) {
        if (i === 0) console.log(`  [${i + 1}/${variants.length}] already has sleeve — skip all`)
        totalSkipped++
        continue
      }

      const frontType = types.includes('front') ? 'front' : 'default'
      const payload = JSON.stringify({
        files: [
          { type: frontType, id: frontFile.id },
          { type: 'sleeve_left', id: SLEEVE_FILE_ID },
          { type: 'label_outside', id: LABEL_FILE_ID },
        ]
      })

      if (DRY_RUN) {
        if (i === 0) console.log(`  Would update ${variants.length} variants with sleeve+label`)
        totalUpdated++
        continue
      }

      const result = await pf(`/store/variants/${vid}`, { method: 'PUT', body: payload })

      if (result.code === 200) {
        totalUpdated++
        if (i === 0 || (i + 1) % 10 === 0 || i === variants.length - 1) {
          console.log(`  [${i + 1}/${variants.length}] ${sv.name} — OK`)
        }
      } else {
        totalFailed++
        console.log(`  [${i + 1}/${variants.length}] ${sv.name} — FAIL (${result.code}: ${result.result?.substring?.(0, 80) || result.result})`)
      }

      await delay(2000)
    }

    await delay(3000)
  }

  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  BRANDING UPDATE SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Updated:  ${totalUpdated}`)
  console.log(`  Failed:   ${totalFailed}`)
  console.log(`  Skipped:  ${totalSkipped}`)
  console.log()
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
