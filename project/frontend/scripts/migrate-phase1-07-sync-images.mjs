/**
 * migrate-phase1-07-sync-images.mjs
 *
 * Phase 1 Step 7: Sync mockup images from Printful to Supabase.
 *
 * For each of the 20 migrated products:
 * 1. Fetch Printful sync product → get preview_url per color
 * 2. Delete OLD Printify variants from Supabase
 * 3. Update NEW Printful variants with image_url (per color mockup)
 * 4. Update product images[] with Printful mockup URLs
 *
 * Supports --dry-run.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-07-sync-images.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-07-sync-images.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const PRINTFUL_TOKEN = env('PRINTFUL_API_TOKEN')
const PRINTFUL_STORE = env('PRINTFUL_STORE_ID')
const SUPABASE_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')

if (!PRINTFUL_TOKEN || !PRINTFUL_STORE) {
  console.error('ERROR: PRINTFUL_API_TOKEN and PRINTFUL_STORE_ID required')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required')
  process.exit(1)
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DELAY_MS = 2000
const PRODUCTS_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function printfulFetch(path) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SKAPARA-POD/1.0',
      'X-PF-Store-Id': PRINTFUL_STORE,
    },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    console.log(`  ⏳ Rate limited, waiting ${retryAfter}s...`)
    await delay(retryAfter * 1000)
    return printfulFetch(path)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Printful ${res.status}: ${body.slice(0, 300)}`)
  }

  const envelope = await res.json()
  return envelope.result !== undefined ? envelope.result : envelope
}

async function supabaseQuery(path, options = {}) {
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

  if (options.prefer === 'return=representation') {
    return res.json()
  }
  return null
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 7: Sync Printful Images to Supabase     ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no changes ***')
  console.log()

  const productsData = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
  const entries = Object.entries(productsData)

  let synced = 0
  let failed = 0
  const results = []

  for (let i = 0; i < entries.length; i++) {
    const [supabaseId, productInfo] = entries[i]
    const prog = `[${i + 1}/${entries.length}]`
    console.log(`${prog} ${productInfo.title} (sync: ${productInfo.syncProductId})`)

    try {
      await delay(DELAY_MS)

      // 1. Fetch Printful sync product to get preview URLs per color
      const pfProduct = await printfulFetch(`/store/products/${productInfo.syncProductId}`)
      const syncVariants = pfProduct.sync_variants || []
      console.log(`  Printful variants: ${syncVariants.length}`)

      // 2. Build color → preview URL mapping
      const colorPreviews = {} // color → preview_url
      const colorProductImages = {} // color → product.image (blank garment)
      const allPreviews = [] // all unique preview URLs for images[]

      for (const sv of syncVariants) {
        // Parse color from variant name "Product / Color / Size"
        const nameParts = sv.name.split(' / ')
        const color = nameParts.length >= 3 ? nameParts[1] : 'unknown'

        // Get preview/mockup file
        // SIGNATURE products use type='preview', PREMIUM products use type='mockup'
        for (const f of sv.files || []) {
          if ((f.type === 'preview' || f.type === 'mockup') && f.preview_url) {
            if (!colorPreviews[color]) {
              colorPreviews[color] = f.preview_url
              allPreviews.push({
                src: f.preview_url,
                alt: `${productInfo.title} - ${color}`,
                color,
              })
            }
          }
        }

        // Get product.image (blank garment photo)
        const productImage = sv.product?.image
        if (productImage && !colorProductImages[color]) {
          colorProductImages[color] = productImage
        }
      }

      console.log(`  Color mockups: ${Object.keys(colorPreviews).length} (${Object.keys(colorPreviews).join(', ')})`)

      if (DRY_RUN) {
        console.log(`  → Would delete old Printify variants`)
        console.log(`  → Would update ${syncVariants.length} variant image_urls`)
        console.log(`  → Would update product images[] with ${allPreviews.length} mockups`)
        results.push({ id: supabaseId, title: productInfo.title, status: 'dry_run' })
        continue
      }

      // 3. Delete OLD Printify variants (those with Printify image URLs)
      // Fetch all variants for this product with color info in one query
      const existingVariants = await fetch(
        `${SUPABASE_URL}/rest/v1/product_variants?product_id=eq.${supabaseId}&select=id,color,image_url,external_variant_id,sku`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      ).then((r) => r.json())

      // Old variants: no SKP- prefix (created by Printify sync)
      const oldVariants = existingVariants.filter(
        (v) => !v.sku || !v.sku.startsWith('SKP-'),
      )
      // New variants: have SKP- sku prefix (created by step 4)
      const newVariants = existingVariants.filter(
        (v) => v.sku && v.sku.startsWith('SKP-'),
      )

      console.log(`  Old Printify variants to delete: ${oldVariants.length}`)
      console.log(`  New Printful variants to update: ${newVariants.length}`)

      // Delete old variants in batch
      if (oldVariants.length > 0) {
        const oldIds = oldVariants.map((v) => v.id)
        for (let j = 0; j < oldIds.length; j += 50) {
          const batch = oldIds.slice(j, j + 50)
          const idFilter = batch.map((id) => `"${id}"`).join(',')
          await supabaseQuery(`/product_variants?id=in.(${idFilter})`, {
            method: 'DELETE',
          })
        }
        console.log(`  ✓ Deleted ${oldVariants.length} old variants`)
      }

      // 4. Update new variant image_urls based on color (batch per color)
      let updatedCount = 0
      for (const [color, previewUrl] of Object.entries(colorPreviews)) {
        // Get IDs of new variants with this color
        const colorVariantIds = newVariants
          .filter((v) => v.color === color)
          .map((v) => v.id)

        if (colorVariantIds.length > 0) {
          const idFilter = colorVariantIds.map((id) => `"${id}"`).join(',')
          await supabaseQuery(`/product_variants?id=in.(${idFilter})`, {
            method: 'PATCH',
            body: JSON.stringify({ image_url: previewUrl }),
          })
          updatedCount += colorVariantIds.length
        }
      }
      console.log(`  ✓ Updated ${updatedCount}/${newVariants.length} variant image_urls`)

      // 5. Update product images[] with Printful mockups
      // Use the preview mockups + blank product images for a good gallery
      const newImages = []
      for (const preview of allPreviews) {
        newImages.push({
          src: preview.src,
          alt: preview.alt,
        })
      }

      // Add blank garment photos per color (different angles)
      for (const [color, imgUrl] of Object.entries(colorProductImages)) {
        newImages.push({
          src: imgUrl,
          alt: `${productInfo.title} - ${color} (blank)`,
        })
      }

      await supabaseQuery(`/products?id=eq.${supabaseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ images: newImages }),
      })
      console.log(`  ✓ Updated product images[] with ${newImages.length} images`)

      synced++
      results.push({
        id: supabaseId,
        title: productInfo.title,
        status: 'synced',
        colorMockups: Object.keys(colorPreviews).length,
        variantsUpdated: updatedCount,
        totalImages: newImages.length,
        oldVariantsDeleted: oldVariants.length,
      })
    } catch (err) {
      console.log(`  ✗ Failed: ${err.message}`)
      failed++
      results.push({
        id: supabaseId,
        title: productInfo.title,
        status: 'failed',
        error: err.message,
      })
    }
  }

  // Save results
  const outputPath = join(ROOT, 'scripts', 'phase1-image-sync-results.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2))

  // Summary
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  IMAGE SYNC SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Synced:  ${synced}`)
  console.log(`  Failed:  ${failed}`)
  console.log(`  Output:  ${outputPath}`)
  console.log()

  if (failed > 0) {
    console.log('  ⚠ Some syncs failed. Check errors and retry.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
