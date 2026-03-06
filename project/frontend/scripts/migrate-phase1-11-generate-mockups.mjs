/**
 * migrate-phase1-11-generate-mockups.mjs
 *
 * Generates Ghost mockups (Front, Left, Back) for all 17 Printful products
 * using the Mockup Generator API. Includes branding (sleeve_left + label_outside).
 *
 * Steps:
 *   1. Fetch each product's front design URL from Printful
 *   2. Create mockup tasks per dark color (Ghost: Front, Left, Back)
 *   3. Poll for completion
 *   4. Download images and upload to Supabase Storage
 *   5. Update products.images[] in Supabase
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-11-generate-mockups.mjs --dry-run
 *   cd frontend && node scripts/migrate-phase1-11-generate-mockups.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, join } from 'path'

const DRY_RUN = process.argv.includes('--dry-run')
const SINGLE = process.argv.find(a => a.startsWith('--product='))?.split('=')[1]

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const PRINTFUL_TOKEN = env('PRINTFUL_API_TOKEN')
const PRINTFUL_STORE = env('PRINTFUL_STORE_ID')
const SUPABASE_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')

if (!PRINTFUL_TOKEN || !PRINTFUL_STORE || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars: PRINTFUL_API_TOKEN, PRINTFUL_STORE_ID, SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

// ─── Branding file URLs (from Printful CDN, used in mockup generator) ────────

const SLEEVE_LEFT_URL = 'https://files.cdn.printful.com/files/ad6/ad64b3438a5caa9a266f015f2aae41e6_preview.png'
const LABEL_OUTSIDE_URL = 'https://files.cdn.printful.com/files/d91/d91ffd49e8754fdd93552920de6d2fc7_preview.png'

// ─── Dark colors per catalog (exclude light colors) ──────────────────────────

const DARK_COLORS_586 = {
  'Black': 15114,
  'Pepper': 17693,
  'Graphite': 21264,
  'True Navy': 15181,
}

const DARK_COLORS_917 = {
  'Black': 23577,
  'Navy Blazer': 23584,
  'Vintage Black': 23591,
}

// ─── Deleted products (skip) ─────────────────────────────────────────────────

const DELETED = new Set([
  '168731f6-75db-4075-bb30-c1ec8fead998',
  '60f6ceb4-46a7-4bd3-92c0-2e67c4cf0f66',
  'e4867449-08b1-408a-b85b-b6ecd9b4274c',
])

// ─── Product data ────────────────────────────────────────────────────────────

const PRODUCTS_PATH = join(ROOT, 'scripts', 'printful-phase1-products.json')
const productsData = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'))

// ─── Printful API helper ─────────────────────────────────────────────────────

async function pf(path, options = {}) {
  const url = `https://api.printful.com${path}`
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Bearer ${PRINTFUL_TOKEN}`,
      'X-PF-Store-Id': PRINTFUL_STORE,
      'Content-Type': 'application/json',
    },
    body: options.body,
  })

  // Rate limit handling
  if (res.status === 429) {
    const resetAfter = parseInt(res.headers.get('x-ratelimit-reset') || '60')
    console.log(`    ⏳ Rate limited, waiting ${resetAfter}s...`)
    await delay(resetAfter * 1000)
    return pf(path, options)
  }

  return res.json()
}

// ─── Supabase REST helper ────────────────────────────────────────────────────

async function sb(path, options = {}) {
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

// ─── Supabase Storage helper ─────────────────────────────────────────────────

async function uploadToStorage(bucket, filePath, imageBuffer, contentType = 'image/jpeg') {
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: imageBuffer,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Storage upload ${filePath}: ${res.status} ${text}`)
  }
  // Return public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filePath}`
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

// ─── Mockup Generator ───────────────────────────────────────────────────────

async function createMockupTask(catalogId, variantId, frontDesignUrl) {
  const body = {
    variant_ids: [variantId],
    format: 'jpg',
    width: 1000,
    option_groups: ['Ghost'],
    options: ['Front', 'Left', 'Back'],
    files: [
      {
        placement: 'front',
        image_url: frontDesignUrl,
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 },
      },
      {
        placement: 'sleeve_left',
        image_url: SLEEVE_LEFT_URL,
        position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 },
      },
      {
        placement: 'label_outside',
        image_url: LABEL_OUTSIDE_URL,
        position: { area_width: 450, area_height: 450, width: 450, height: 450, top: 0, left: 0 },
      },
    ],
  }

  const result = await pf(`/mockup-generator/create-task/${catalogId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return result.result?.task_key || null
}

async function pollMockupTask(taskKey, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await delay(3000)
    const result = await pf(`/mockup-generator/task?task_key=${taskKey}`)
    const status = result.result?.status

    if (status === 'completed') {
      return result.result
    } else if (status === 'failed') {
      throw new Error(`Mockup task ${taskKey} failed: ${JSON.stringify(result.result?.error)}`)
    }
    // Still pending, continue polling
  }
  throw new Error(`Mockup task ${taskKey} timed out after ${maxAttempts} attempts`)
}

async function downloadImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 11: Generate Mockups with Branding      ║')
  console.log('╚═══════════════════════════════════════════════════════╝')
  if (DRY_RUN) console.log('  *** DRY RUN — no changes ***')
  if (SINGLE) console.log(`  Single product mode: ${SINGLE}`)
  console.log()

  const entries = Object.entries(productsData)
    .filter(([uid]) => !DELETED.has(uid))
    .filter(([uid]) => !SINGLE || uid.startsWith(SINGLE))

  console.log(`  Products to process: ${entries.length}`)
  console.log()

  const results = []
  let totalImages = 0
  let totalFailed = 0

  for (let idx = 0; idx < entries.length; idx++) {
    const [uid, info] = entries[idx]
    const { syncProductId, title, catalogId } = info
    const darkColors = catalogId === 586 ? DARK_COLORS_586 : DARK_COLORS_917
    const prog = `[${idx + 1}/${entries.length}]`

    console.log(`\n${prog} ${title} (catalog ${catalogId}, sync ${syncProductId})`)

    // Step 1: Get front design URL from Printful sync product
    const productData = await pf(`/store/products/${syncProductId}`)
    const syncVariants = productData.result?.sync_variants || []
    if (syncVariants.length === 0) {
      console.log(`  ⚠ No sync variants found — skip`)
      totalFailed++
      continue
    }

    const firstVariant = syncVariants[0]
    const frontFile = (firstVariant.files || []).find(f => f.type === 'default' || f.type === 'front')
    if (!frontFile?.preview_url) {
      console.log(`  ⚠ No front design URL — skip`)
      totalFailed++
      continue
    }

    const frontDesignUrl = frontFile.preview_url
    console.log(`  Front design: ${frontDesignUrl.substring(0, 60)}...`)
    console.log(`  Colors: ${Object.keys(darkColors).join(', ')}`)

    const productImages = []

    // Step 2: Generate mockups for each dark color
    for (const [colorName, variantId] of Object.entries(darkColors)) {
      console.log(`  🎨 ${colorName} (variant ${variantId})...`)

      if (DRY_RUN) {
        console.log(`    Would generate Ghost Front+Left+Back`)
        productImages.push(
          { src: 'DRY_RUN', alt: `${title} - ${colorName}` },
          { src: 'DRY_RUN', alt: `${title} - ${colorName} - Left` },
          { src: 'DRY_RUN', alt: `${title} - ${colorName} - Back` },
        )
        totalImages += 3
        continue
      }

      try {
        // Create mockup task
        const taskKey = await createMockupTask(catalogId, variantId, frontDesignUrl)
        if (!taskKey) {
          console.log(`    ❌ Failed to create task`)
          totalFailed++
          continue
        }
        console.log(`    Task: ${taskKey}`)

        // Poll for completion
        const taskResult = await pollMockupTask(taskKey)
        const mockups = taskResult.mockups || []

        if (mockups.length === 0) {
          console.log(`    ❌ No mockups generated`)
          totalFailed++
          continue
        }

        // Collect all mockup URLs (main + extras)
        const allMockupUrls = []
        for (const m of mockups) {
          if (m.mockup_url) allMockupUrls.push({ url: m.mockup_url, view: 'Front' })
          if (m.extra) {
            for (const e of m.extra) {
              allMockupUrls.push({ url: e.url, view: e.title || 'Extra' })
            }
          }
        }

        console.log(`    Generated ${allMockupUrls.length} images`)

        // Download and upload each mockup
        for (const { url: mockupUrl, view } of allMockupUrls) {
          try {
            const imageBuffer = await downloadImage(mockupUrl)
            const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            const safeColor = colorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            const safeView = view.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            const storagePath = `mockups/${safeName}/${safeColor}-${safeView}.jpg`

            const publicUrl = await uploadToStorage('designs', storagePath, imageBuffer)

            const altText = view === 'Front'
              ? `${title} - ${colorName}`
              : `${title} - ${colorName} - ${view}`

            productImages.push({ src: publicUrl, alt: altText })
            totalImages++
            console.log(`    ✅ ${view}: uploaded`)
          } catch (dlErr) {
            console.log(`    ❌ ${view}: download/upload failed: ${dlErr.message}`)
            totalFailed++
          }
        }

        // Rate limit between colors
        await delay(5000)

      } catch (err) {
        console.log(`    ❌ ${colorName} failed: ${err.message}`)
        totalFailed++
      }
    }

    // Step 3: Update Supabase products.images[]
    if (productImages.length > 0 && !DRY_RUN) {
      try {
        // Order: Front views first (all colors), then Left/Back views
        const frontViews = productImages.filter(img => !img.alt.includes(' - Left') && !img.alt.includes(' - Back'))
        const sideViews = productImages.filter(img => img.alt.includes(' - Left'))
        const backViews = productImages.filter(img => img.alt.includes(' - Back'))
        const orderedImages = [...frontViews, ...sideViews, ...backViews]

        // Find actual Supabase UUID (may differ from printful-phase1-products.json key)
        const [dbProduct] = await sb(
          `/products?provider_product_id=eq.${syncProductId}&select=id`,
          { method: 'GET' }
        )

        if (dbProduct) {
          await sb(`/products?id=eq.${dbProduct.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ images: orderedImages }),
          })
          console.log(`  📦 Updated Supabase images (${orderedImages.length} images)`)
        } else {
          console.log(`  ⚠ Product not found in Supabase by provider_product_id=${syncProductId}`)
        }
      } catch (err) {
        console.log(`  ❌ Supabase update failed: ${err.message}`)
        totalFailed++
      }
    }

    results.push({ title, imageCount: productImages.length })

    // Rate limit between products
    await delay(3000)
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  MOCKUP GENERATION SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Products processed: ${results.length}`)
  console.log(`  Total images:       ${totalImages}`)
  console.log(`  Failed:             ${totalFailed}`)
  console.log()
  for (const r of results) {
    console.log(`  ${r.title}: ${r.imageCount} images`)
  }
  console.log()

  // Save results log
  if (!DRY_RUN) {
    const logPath = join(ROOT, 'scripts', 'mockup-generation-results.json')
    writeFileSync(logPath, JSON.stringify(results, null, 2))
    console.log(`  Results saved to: ${logPath}`)
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
