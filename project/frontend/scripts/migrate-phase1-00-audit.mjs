/**
 * migrate-phase1-00-audit.mjs
 *
 * Phase 1 Step 0: Audit current t-shirt products and map to local design files.
 *
 * - Queries Supabase for the 20 active t-shirts
 * - Maps each product to its local design file (SVG or PNG)
 * - Downloads main product image from Printify CDN as backup
 * - Assigns each product to a Printful blank tier (PREMIUM MC1087 or SIGNATURE CC1717)
 * - Outputs: scripts/phase1-audit.json
 *
 * READ-ONLY — does not modify any APIs or databases.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-00-audit.mjs
 *   cd frontend && node scripts/migrate-phase1-00-audit.mjs --skip-download
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, join, basename } from 'path'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const SKIP_DOWNLOAD = process.argv.includes('--skip-download')

// ─── Env ────────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const envPath = join(ROOT, '.env.local')
const envFile = readFileSync(envPath, 'utf8')
const env = (key) => envFile.match(new RegExp(`^${key}=(.*)`, 'm'))?.[1]?.trim()

const SUPABASE_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = env('SUPABASE_SERVICE_KEY')
const PRINTIFY_TOKEN = env('PRINTIFY_API_TOKEN')
const PRINTIFY_SHOP = env('PRINTIFY_SHOP_ID')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required in .env.local')
  process.exit(1)
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const BACKUP_DIR = join(ROOT, 'scripts', 'phase1-backups')
const OUTPUT_PATH = join(ROOT, 'scripts', 'phase1-audit.json')
const DELAY_MS = 1500

// T-shirt category slug
const TSHIRT_CATEGORY_SLUG = 't-shirts'

// Printful catalog IDs
const PRINTFUL_MC1087 = 917
const PRINTFUL_CC1717 = 586

// Design file mapping: product title → local design file path (relative to public/)
// This is the authoritative mapping based on the catalog audit.
const DESIGN_MAP = {
  // ── PREMIUM tier (MC1087) — expansion SVGs ──
  'Soup Fork':         { file: 'expansion-designs/a01-life-is-soup.svg', format: 'svg', tier: 'premium' },
  'Existential Dread': { file: 'expansion-designs/a04-existential-dread.svg', format: 'svg', tier: 'premium' },
  'Social Battery':    { file: 'expansion-designs/c01-social-battery.svg', format: 'svg', tier: 'premium' },
  'Plans Cancelled':   { file: 'expansion-designs/c02-plans-cancelled.svg', format: 'svg', tier: 'premium' },
  'Caffeine Anxiety':  { file: 'expansion-designs/f02-caffeine-anxiety.svg', format: 'svg', tier: 'premium' },
  'Self-Care Mode':    { file: 'expansion-designs/d03-self-care-aggressive.svg', format: 'svg', tier: 'premium' },

  // ── SIGNATURE tier (CC1717) — meme PNGs ──
  'Absolutely Right':  { file: 'meme-designs/02-absolutely-right-tee.png', format: 'png', tier: 'signature' },
  'Vibe Coder':        { file: 'meme-designs/03-vibe-coding-tee.png', format: 'png', tier: 'signature' },
  'Zero Bugs':         { file: 'meme-designs/05-no-bugs-tee.png', format: 'png', tier: 'signature' },
  'Strawberry Count':  { file: 'meme-previews/11-strawberry-tee.png', format: 'png', tier: 'signature' },
  'Under Where':       { file: 'meme-previews/12-underwear-tee.png', format: 'png', tier: 'signature' },
  'Three Models':      { file: 'meme-previews/16-haiku-sonnet-opus-tee.png', format: 'png', tier: 'signature' },
  'Prism Tee':         { file: 'meme-previews/15-button-color-tee.png', format: 'png', tier: 'signature' },
  'Scope Creep':       { file: 'meme-previews/13-bypass-permissions-tee.png', format: 'png', tier: 'signature' },
  'Dangerous Flag':    { file: 'meme-previews/14-skip-permissions-tee.png', format: 'png', tier: 'signature' },
  'Just For You':      { file: 'expansion-designs/h03-made-just-for-you.svg', format: 'svg', tier: 'signature' },

  // ── SIGNATURE tier — designs recovered from Printify S3 ──
  'Ghost Tee':         { file: 'printful-designs/source-ghost-tee.png', format: 'png', tier: 'signature' },
  'Shadow Tee':        { file: 'printful-designs/source-shadow-tee.png', format: 'png', tier: 'signature' },
  'Option Two':        { file: 'printful-designs/source-option-two.png', format: 'png', tier: 'signature' },
  'Next Line':         { file: 'printful-designs/source-next-line.png', format: 'png', tier: 'signature' },
}

// Tier → Printful catalog product ID
const TIER_CATALOG = {
  premium: PRINTFUL_MC1087,
  signature: PRINTFUL_CC1717,
}

// Tier → color selection
const TIER_COLORS = {
  premium: ['Black', 'Navy Blazer', 'Vintage Black', 'Vintage White', 'White'],
  signature: ['Black', 'Pepper', 'Graphite', 'Ivory', 'True Navy'],
}

// Tier → sizes
const TIER_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

// Tier → EUR price in cents
const TIER_PRICES = {
  premium: { 'S': 4499, 'M': 4499, 'L': 4499, 'XL': 4499, '2XL': 4799, '3XL': 4999, '4XL': 4999 },
  signature: { 'S': 3499, 'M': 3499, 'L': 3499, 'XL': 3499, '2XL': 3799, '3XL': 3999, '4XL': 3999 },
}

// Tier → USD retail price in cents (for Printful API)
const TIER_PRICES_USD = {
  premium: { 'S': 4899, 'M': 4899, 'L': 4899, 'XL': 4899, '2XL': 5225, '3XL': 5449, '4XL': 5449 },
  signature: { 'S': 3809, 'M': 3809, 'L': 3809, 'XL': 3809, '2XL': 4139, '3XL': 4359, '4XL': 4359 },
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ─── Supabase Fetch ─────────────────────────────────────────────────────────────

async function supabaseFetch(path) {
  const url = `${SUPABASE_URL}/rest/v1${path}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`)
  }

  return res.json()
}

// ─── Printify Fetch (for image backup) ──────────────────────────────────────────

async function printifyFetch(path) {
  if (!PRINTIFY_TOKEN || !PRINTIFY_SHOP) return null
  const url = `https://api.printify.com/v1/shops/${PRINTIFY_SHOP}${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PRINTIFY_TOKEN}`,
      'User-Agent': 'POD-AI-Store/1.0',
    },
  })
  if (!res.ok) return null
  return res.json()
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 0: T-Shirt Catalog Audit             ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log()

  // 1. Fetch t-shirt category ID
  console.log('→ Fetching t-shirt category...')
  const categories = await supabaseFetch(
    `/categories?slug=eq.${TSHIRT_CATEGORY_SLUG}&select=id,name_en,slug`
  )
  if (!categories.length) {
    console.error('ERROR: Category "t-shirts" not found in Supabase')
    process.exit(1)
  }
  const tshirtCategoryId = categories[0].id
  console.log(`  Found category: ${categories[0].name_en} (${tshirtCategoryId})`)

  // 2. Fetch all active t-shirts with variants
  console.log('→ Fetching active t-shirts...')
  const products = await supabaseFetch(
    `/products?status=eq.active&category_id=eq.${tshirtCategoryId}&select=*,product_variants(*)&order=title.asc`
  )
  console.log(`  Found ${products.length} active t-shirts`)

  if (products.length === 0) {
    console.error('ERROR: No active t-shirts found. Check category assignment.')
    process.exit(1)
  }

  // 3. Map each product to its design and tier
  console.log('→ Mapping products to designs and tiers...')
  const audit = []
  let premiumCount = 0
  let signatureCount = 0
  let needsVerification = 0

  for (const product of products) {
    const designInfo = DESIGN_MAP[product.title]

    if (!designInfo) {
      console.warn(`  ⚠ No design mapping for "${product.title}" — will try fuzzy match`)
    }

    const tier = designInfo?.tier || 'signature'
    const designFile = designInfo?.file || null
    const designFormat = designInfo?.format || 'unknown'
    const designFullPath = designFile ? join(ROOT, 'public', designFile) : null
    const designExists = designFullPath ? existsSync(designFullPath) : false

    if (tier === 'premium') premiumCount++
    else signatureCount++
    if (designInfo?.needsVerification) needsVerification++

    // Extract first image URL from product
    const images = Array.isArray(product.images) ? product.images : []
    const firstImage = typeof images[0] === 'string'
      ? images[0]
      : images[0]?.src || images[0]?.url || null

    const entry = {
      id: product.id,
      title: product.title,
      printify_id: product.printify_id,
      provider_product_id: product.provider_product_id,
      blueprint_id: product.blueprint_id,
      print_provider_id: product.print_provider_id,
      current_price_cents: product.base_price_cents,
      current_cost_cents: product.cost_cents,
      variant_count: product.product_variants?.length || 0,
      current_colors: [...new Set((product.product_variants || []).map(v => v.color).filter(Boolean))],
      current_sizes: [...new Set((product.product_variants || []).map(v => v.size).filter(Boolean))],

      // Migration plan
      tier,
      printful_catalog_id: TIER_CATALOG[tier],
      new_colors: TIER_COLORS[tier],
      new_price_eur_cents: TIER_PRICES[tier],
      new_price_usd_cents: TIER_PRICES_USD[tier],

      // Design info
      design_file: designFile,
      design_format: designFormat,
      design_exists: designExists,
      needs_verification: designInfo?.needsVerification || false,
      first_image_url: firstImage,

      // Product details (for descriptions)
      current_description_en: product.description_en || product.description || '',
      current_product_details: product.product_details || {},
    }

    audit.push(entry)
    console.log(`  ${designExists ? '✓' : '✗'} ${product.title} → ${tier.toUpperCase()} (${designFile || 'NEEDS MAPPING'})`)
  }

  // 4. Download backup images from Printify CDN
  if (!SKIP_DOWNLOAD && PRINTIFY_TOKEN) {
    console.log()
    console.log('→ Downloading Printify product images as backup...')
    mkdirSync(BACKUP_DIR, { recursive: true })

    for (const entry of audit) {
      if (!entry.printify_id) {
        console.log(`  ⊘ ${entry.title}: no printify_id, skipping download`)
        continue
      }

      try {
        await delay(DELAY_MS)
        const printifyProduct = await printifyFetch(`/products/${entry.printify_id}.json`)
        if (!printifyProduct) {
          console.log(`  ✗ ${entry.title}: could not fetch from Printify`)
          continue
        }

        // Save full Printify product data as JSON backup
        const backupPath = join(BACKUP_DIR, `${entry.printify_id}.json`)
        writeFileSync(backupPath, JSON.stringify(printifyProduct, null, 2))

        // Try to download first image
        const imgSrc = printifyProduct.images?.[0]?.src
        if (imgSrc) {
          const imgRes = await fetch(imgSrc)
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer())
            const imgPath = join(BACKUP_DIR, `${entry.printify_id}-front.png`)
            writeFileSync(imgPath, buffer)
            entry.backup_image_path = imgPath
            console.log(`  ✓ ${entry.title}: backed up (${(buffer.length / 1024).toFixed(0)}KB)`)
          }
        }

        // Save the original design image URLs for verification
        entry.printify_images = (printifyProduct.images || []).map(img => ({
          src: img.src,
          variant_ids: img.variant_ids,
          is_default: img.is_default,
          position: img.position,
        }))

        // For products that need verification, try to identify the design from print_areas
        if (entry.needs_verification && printifyProduct.print_areas) {
          const frontArea = printifyProduct.print_areas.find(
            pa => pa.placeholders?.[0]?.position === 'front'
          )
          if (frontArea?.placeholders?.[0]?.images?.[0]) {
            const designImg = frontArea.placeholders[0].images[0]
            entry.printify_design_url = designImg.src || designImg.url
            entry.printify_design_id = designImg.id
            console.log(`  🔍 ${entry.title}: found design URL for verification`)
          }
        }
      } catch (err) {
        console.log(`  ✗ ${entry.title}: error — ${err.message}`)
      }
    }
  } else {
    console.log()
    console.log('→ Skipping image download (--skip-download or no Printify token)')
  }

  // 5. Summary
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  AUDIT SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Total t-shirts:      ${audit.length}`)
  console.log(`  PREMIUM (MC1087):    ${premiumCount}`)
  console.log(`  SIGNATURE (CC1717):  ${signatureCount}`)
  console.log(`  Design files found:  ${audit.filter(a => a.design_exists).length}/${audit.length}`)
  console.log(`  Needs verification:  ${needsVerification}`)
  console.log(`  Missing design file: ${audit.filter(a => !a.design_exists && !a.needs_verification).length}`)
  console.log()

  // Warn about missing designs
  const missing = audit.filter(a => !a.design_exists && !a.needs_verification)
  if (missing.length > 0) {
    console.log('  ⚠ Products with missing design files:')
    for (const m of missing) {
      console.log(`    - ${m.title} (expected: ${m.design_file || 'NO MAPPING'})`)
    }
    console.log()
  }

  const needsVerify = audit.filter(a => a.needs_verification)
  if (needsVerify.length > 0) {
    console.log('  🔍 Products needing design verification:')
    for (const v of needsVerify) {
      const designUrl = v.printify_design_url || v.first_image_url || 'UNKNOWN'
      console.log(`    - ${v.title} → ${designUrl}`)
    }
    console.log()
  }

  // 6. Write output
  const output = {
    generatedAt: new Date().toISOString(),
    totalProducts: audit.length,
    premiumCount,
    signatureCount,
    needsVerification,
    designsMapped: audit.filter(a => a.design_exists).length,
    products: audit,
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`  ✓ Audit saved to: ${OUTPUT_PATH}`)
  console.log()
  console.log('Next step: node scripts/migrate-phase1-01-render-designs.mjs')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
