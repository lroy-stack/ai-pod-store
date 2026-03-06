/**
 * migrate-phase1-09-generate-mockups.mjs
 *
 * Phase 1 Step 9: Generate rich mockup gallery via Printful Mockup Generator API.
 *
 * Strategy:
 * - Ghost Front per color → KEPT from Printful CDN (permanent preview_url, no storage needed)
 * - Men's, Women's, Flat, Zoomed → GENERATED via Mockup Generator API per color
 *   → Downloaded + uploaded to Supabase Storage (API URLs expire in ~24h)
 *
 * Gallery order per color (5 images):
 *   1. Ghost Front    — from Printful CDN (hero image)
 *   2. Men's Front    — generated + stored (male model)
 *   3. Women's Front  — generated + stored (female model)
 *   4. Flat Front     — generated + stored (flat lay, shows design clearly)
 *   5. Zoomed in      — generated + stored (close-up print texture)
 *
 * ~5 images × ~5 colors × 20 products = ~500 images total (~75MB in Storage)
 *
 * Rate limit: ~10 req/min for Mockup Generator. URLs expire in ~24h.
 *
 * Supports --dry-run and --product=<uuid> for single product testing.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-09-generate-mockups.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-09-generate-mockups.mjs --product=168731f6-...
 *   cd frontend && node scripts/migrate-phase1-09-generate-mockups.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const SINGLE_PRODUCT = process.argv.find((a) => a.startsWith('--product='))?.split('=')[1]

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

const DELAY_BETWEEN_TASKS_MS = 7000 // ~10 req/min for mockup generator
const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 40 // 40 × 3s = 2 min max wait
const PRODUCTS_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')
const STORAGE_BUCKET = 'product-images'

// Colors that should NOT get mockups (invisible designs on light backgrounds)
const LIGHT_COLORS = new Set(['Ivory', 'White', 'Vintage White'])

// Mockup types to GENERATE (temporary URLs → stored in bucket)
// Ghost Front is NOT here — it comes from the permanent CDN preview_url
const GENERATED_MOCKUP_TYPES = [
  { optionGroup: "Men's",      option: 'Front',  label: 'mens-front',    altSuffix: 'Model' },
  { optionGroup: "Women's",    option: 'Front',  label: 'womens-front',  altSuffix: 'Model' },
  { optionGroup: 'Flat',       option: 'Front',  label: 'flat-front',    altSuffix: 'Flat Lay' },
  { optionGroup: 'Zoomed in',  option: 'Front',  label: 'zoomed-front',  altSuffix: 'Detail' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

async function printfulFetch(path, options = {}) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SKAPARA-POD/1.0',
      'X-PF-Store-Id': PRINTFUL_STORE,
      ...(options.headers || {}),
    },
  })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') || '60', 10)
    console.log(`  Rate limited, waiting ${retryAfter}s...`)
    await delay(retryAfter * 1000)
    return printfulFetch(path, options)
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

/**
 * Download image from temporary URL and upload to Supabase Storage (permanent)
 */
async function uploadToStorage(filePath, imageUrl) {
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`Download failed: ${imgRes.status}`)
  const buffer = await imgRes.arrayBuffer()
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${filePath}`
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    throw new Error(`Storage upload failed: ${uploadRes.status} ${text}`)
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${filePath}`
}

/**
 * Create a mockup generation task and poll until complete
 */
async function generateMockup(catalogProductId, variantId, files, optionGroup, option) {
  const taskResult = await printfulFetch(`/mockup-generator/create-task/${catalogProductId}`, {
    method: 'POST',
    body: JSON.stringify({
      variant_ids: [variantId],
      format: 'jpg',
      width: 1000,
      option_groups: [optionGroup],
      options: [option],
      files,
    }),
  })

  const taskKey = taskResult.task_key
  if (!taskKey) throw new Error('No task_key returned')

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await delay(POLL_INTERVAL_MS)
    const status = await printfulFetch(`/mockup-generator/task?task_key=${taskKey}`)

    if (status.status === 'completed') {
      const mockups = status.mockups || []
      return mockups.length > 0 ? mockups[0].mockup_url : null
    }
    if (status.status === 'failed') {
      throw new Error(`Mockup failed: ${JSON.stringify(status.error || 'unknown')}`)
    }
  }

  throw new Error(`Mockup timed out after ${POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`)
}

/**
 * Ensure the storage bucket exists
 */
async function ensureStorageBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${STORAGE_BUCKET}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  if (res.ok) {
    console.log(`  Bucket "${STORAGE_BUCKET}" exists`)
    return
  }
  const createRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: STORAGE_BUCKET,
      name: STORAGE_BUCKET,
      public: true,
      file_size_limit: 5242880,
      allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    throw new Error(`Failed to create bucket: ${createRes.status} ${text}`)
  }
  console.log(`  Created bucket "${STORAGE_BUCKET}"`)
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('============================================================')
  console.log('  Phase 1 Step 9: Generate Mockup Gallery')
  console.log('  Strategy: Ghost (CDN) + Mens + Womens + Flat + Zoom (Storage)')
  console.log('============================================================')
  if (DRY_RUN) console.log('  *** DRY RUN ***')
  if (SINGLE_PRODUCT) console.log(`  *** SINGLE PRODUCT: ${SINGLE_PRODUCT} ***`)
  console.log()

  if (!DRY_RUN) await ensureStorageBucket()

  const productsData = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))
  let entries = Object.entries(productsData)

  if (SINGLE_PRODUCT) {
    entries = entries.filter(([id]) => id === SINGLE_PRODUCT)
    if (entries.length === 0) {
      console.error(`Product ${SINGLE_PRODUCT} not found`)
      process.exit(1)
    }
  }

  const results = []
  let successCount = 0
  let failedCount = 0

  for (let i = 0; i < entries.length; i++) {
    const [supabaseId, productInfo] = entries[i]
    const { title, catalogId, syncProductId } = productInfo
    const prog = `[${i + 1}/${entries.length}]`
    console.log(`\n${prog} ${title} (catalog: ${catalogId})`)

    try {
      // 1. Fetch sync product to get variant info + permanent preview URLs
      await delay(2000)
      const pfProduct = await printfulFetch(`/store/products/${syncProductId}`)
      const syncVariants = pfProduct.sync_variants || []

      // 2. Build per-color data: variant ID, design files, and CDN ghost preview URL
      const colorData = new Map() // color → { variantId, files, ghostPreviewUrl }

      for (const sv of syncVariants) {
        const nameParts = sv.name.split(' / ')
        const color = nameParts.length >= 3 ? nameParts[1] : 'unknown'

        if (LIGHT_COLORS.has(color)) continue
        if (colorData.has(color)) continue // first variant per color

        // Get permanent Ghost preview URL from CDN
        let ghostPreviewUrl = null
        const designFiles = []

        for (const f of sv.files || []) {
          if ((f.type === 'preview' || f.type === 'mockup') && f.preview_url) {
            ghostPreviewUrl = f.preview_url
          }
          if (f.type === 'default' || f.type === 'front' || f.type === 'back') {
            designFiles.push({
              placement: f.type === 'default' ? 'front' : f.type,
              image_url: f.preview_url || f.url,
              position: {
                area_width: 1800,
                area_height: 2400,
                width: f.width || 1800,
                height: f.height || 2400,
                top: 0,
                left: 0,
              },
            })
          }
        }

        if (ghostPreviewUrl && designFiles.length > 0) {
          colorData.set(color, {
            variantId: sv.variant_id,
            files: designFiles,
            ghostPreviewUrl,
          })
        }
      }

      const activeColors = [...colorData.keys()]
      console.log(`  Colors: ${activeColors.length} (${activeColors.join(', ')})`)

      if (activeColors.length === 0) {
        console.log(`  No active color variants, skipping`)
        results.push({ id: supabaseId, title, status: 'no_colors' })
        continue
      }

      if (DRY_RUN) {
        console.log(`  Would generate ${GENERATED_MOCKUP_TYPES.length} mockups x ${activeColors.length} colors = ${GENERATED_MOCKUP_TYPES.length * activeColors.length} tasks`)
        console.log(`  Ghost previews (CDN): ${activeColors.length}`)
        results.push({ id: supabaseId, title, status: 'dry_run', colors: activeColors.length })
        successCount++
        continue
      }

      // 3. For each color: collect Ghost (CDN) + generate Men's/Women's/Flat/Zoom (Storage)
      const allImages = [] // { src, alt, color, order }
      const colorHeroUrls = new Map() // color → ghost URL for variant.image_url

      for (const [color, data] of colorData) {
        console.log(`  Color: ${color}`)
        const colorSlug = color.toLowerCase().replace(/\s+/g, '-')

        // Image 1: Ghost Front from CDN (permanent, no storage needed)
        allImages.push({
          src: data.ghostPreviewUrl,
          alt: `${title} - ${color}`,
          color,
          order: 0,
        })
        colorHeroUrls.set(color, data.ghostPreviewUrl)

        // Images 2-5: Generated mockups → upload to Storage
        for (let t = 0; t < GENERATED_MOCKUP_TYPES.length; t++) {
          const mt = GENERATED_MOCKUP_TYPES[t]

          try {
            console.log(`    [${t + 1}/${GENERATED_MOCKUP_TYPES.length}] ${mt.optionGroup} / ${mt.option}...`)

            const mockupUrl = await generateMockup(
              catalogId,
              data.variantId,
              data.files,
              mt.optionGroup,
              mt.option
            )

            if (!mockupUrl) {
              console.log(`      -> no result, skipping`)
              continue
            }

            // Upload to permanent storage
            const storagePath = `mockups/${supabaseId}/${colorSlug}/${mt.label}.jpg`
            const permanentUrl = await uploadToStorage(storagePath, mockupUrl)

            allImages.push({
              src: permanentUrl,
              alt: `${title} - ${color} ${mt.altSuffix}`,
              color,
              order: t + 1,
            })

            console.log(`      -> stored`)
          } catch (err) {
            console.log(`      -> FAILED: ${err.message}`)
          }

          await delay(DELAY_BETWEEN_TASKS_MS)
        }
      }

      console.log(`  Total images: ${allImages.length}`)

      // 4. Sort: group by color, then by gallery order within each color
      allImages.sort((a, b) => {
        if (a.color !== b.color) return a.color.localeCompare(b.color)
        return a.order - b.order
      })

      // 5. Update product images[] in Supabase
      const imagesForDb = allImages.map(({ src, alt }) => ({ src, alt }))
      await supabaseQuery(`/products?id=eq.${supabaseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ images: imagesForDb }),
      })
      console.log(`  Updated images[] (${imagesForDb.length} total)`)

      // 6. Update variant.image_url with Ghost Front per color
      for (const [color, heroUrl] of colorHeroUrls) {
        await supabaseQuery(
          `/product_variants?product_id=eq.${supabaseId}&color=eq.${encodeURIComponent(color)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ image_url: heroUrl }),
          }
        )
      }
      console.log(`  Updated variant image_urls (${colorHeroUrls.size} colors)`)

      successCount++
      results.push({
        id: supabaseId,
        title,
        status: 'ok',
        colors: activeColors.length,
        totalImages: allImages.length,
        cdnImages: activeColors.length,
        storedImages: allImages.length - activeColors.length,
      })
    } catch (err) {
      console.log(`  FAILED: ${err.message}`)
      failedCount++
      results.push({ id: supabaseId, title, status: 'failed', error: err.message })
    }
  }

  // Save results
  const outputPath = join(ROOT, 'scripts', 'phase1-mockup-generation-results.json')
  writeFileSync(outputPath, JSON.stringify(results, null, 2))

  console.log()
  console.log('============================================================')
  console.log('  MOCKUP GENERATION SUMMARY')
  console.log('============================================================')
  console.log(`  Success: ${successCount}`)
  console.log(`  Failed:  ${failedCount}`)
  console.log(`  Output:  ${outputPath}`)
  console.log()

  if (failedCount > 0) {
    console.log('  Some products failed. Retry with --product=<id>')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
