/**
 * migrate-phase1-01-render-designs.mjs
 *
 * Phase 1 Step 1: Render all designs to Printful canvas dimensions.
 *
 * - Reads phase1-audit.json for the product→design mapping
 * - SVGs → render to 1800x2400px PNG (transparent, 150dpi)
 * - PNGs → downscale to 1800x2400px with Lanczos resampling
 * - Generates label_outside: S mark white 450x450px
 * - Generates back_branding: wordmark white centered 1800x2400px
 * - Output: public/printful-designs/ directory with all PNGs
 *
 * Does NOT modify any APIs or databases.
 *
 * Usage:
 *   cd frontend && node scripts/migrate-phase1-01-render-designs.mjs
 *   cd frontend && node scripts/migrate-phase1-01-render-designs.mjs --force
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, join, basename, extname } from 'path'
import sharp from 'sharp'

// ─── Flags ──────────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes('--force')

// ─── Constants ──────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..')
const PUBLIC_DIR = join(ROOT, 'public')
const OUTPUT_DIR = join(PUBLIC_DIR, 'printful-designs')
const AUDIT_PATH = join(ROOT, 'scripts', 'phase1-audit.json')

// Printful canvas dimensions
const FRONT_WIDTH = 1800
const FRONT_HEIGHT = 2400
const LABEL_SIZE = 450
const BACK_WIDTH = 1800
const BACK_HEIGHT = 2400

// Brand assets
const SMARK_WHITE_PATH = join(PUBLIC_DIR, 'brand', 'skapara-mark-white.svg')
const WORDMARK_WHITE_PATH = join(PUBLIC_DIR, 'brand', 'skapara-wordmark-white.svg')

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  Phase 1 Step 1: Render Designs for Printful        ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log()

  // Load audit
  if (!existsSync(AUDIT_PATH)) {
    console.error('ERROR: phase1-audit.json not found. Run step 0 first.')
    process.exit(1)
  }
  const audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8'))
  console.log(`  Loaded audit: ${audit.totalProducts} products`)

  // Create output directory
  mkdirSync(OUTPUT_DIR, { recursive: true })
  console.log(`  Output directory: ${OUTPUT_DIR}`)
  console.log()

  // ── 1. Render front designs ──────────────────────────────────────
  console.log('→ Rendering front designs...')
  let rendered = 0
  let skipped = 0
  let failed = 0

  for (const product of audit.products) {
    const slug = slugify(product.title)
    const outputPath = join(OUTPUT_DIR, `front-${slug}.png`)

    // Skip if already rendered (unless --force)
    if (existsSync(outputPath) && !FORCE) {
      console.log(`  ⊘ ${product.title}: already rendered, skipping`)
      skipped++
      continue
    }

    if (!product.design_file) {
      console.log(`  ✗ ${product.title}: no design file mapped — MANUAL INTERVENTION NEEDED`)
      failed++
      continue
    }

    const inputPath = join(PUBLIC_DIR, product.design_file)
    if (!existsSync(inputPath)) {
      console.log(`  ✗ ${product.title}: design file not found at ${inputPath}`)
      failed++
      continue
    }

    try {
      if (product.design_format === 'svg') {
        await renderSvg(inputPath, outputPath, FRONT_WIDTH, FRONT_HEIGHT)
      } else {
        await resizePng(inputPath, outputPath, FRONT_WIDTH, FRONT_HEIGHT)
      }
      rendered++
      const stats = await sharp(outputPath).metadata()
      console.log(`  ✓ ${product.title}: ${stats.width}x${stats.height} (${product.design_format})`)
    } catch (err) {
      console.log(`  ✗ ${product.title}: render failed — ${err.message}`)
      failed++
    }
  }

  console.log(`  Rendered: ${rendered}, Skipped: ${skipped}, Failed: ${failed}`)
  console.log()

  // ── 2. Generate label_outside (S mark) ───────────────────────────
  console.log('→ Generating label_outside (S mark white 450x450)...')
  const labelPath = join(OUTPUT_DIR, 'label-outside-smark-white.png')

  if (existsSync(labelPath) && !FORCE) {
    console.log('  ⊘ Already exists, skipping')
  } else if (!existsSync(SMARK_WHITE_PATH)) {
    console.log(`  ✗ S mark not found at ${SMARK_WHITE_PATH}`)
  } else {
    try {
      await renderSvg(SMARK_WHITE_PATH, labelPath, LABEL_SIZE, LABEL_SIZE)
      console.log(`  ✓ Label outside: ${LABEL_SIZE}x${LABEL_SIZE}px`)
    } catch (err) {
      console.log(`  ✗ Label render failed: ${err.message}`)
    }
  }
  console.log()

  // ── 3. Generate back branding (wordmark) ─────────────────────────
  console.log('→ Generating back branding (wordmark white centered 1800x2400)...')
  const backPath = join(OUTPUT_DIR, 'back-wordmark-white.png')

  if (existsSync(backPath) && !FORCE) {
    console.log('  ⊘ Already exists, skipping')
  } else if (!existsSync(WORDMARK_WHITE_PATH)) {
    console.log(`  ✗ Wordmark not found at ${WORDMARK_WHITE_PATH}`)
  } else {
    try {
      // Read wordmark SVG, resize to fit within a centered area, then composite onto transparent canvas
      const wordmarkBuffer = await sharp(WORDMARK_WHITE_PATH)
        .resize({ width: 800, fit: 'inside' })
        .png()
        .toBuffer()

      const wordmarkMeta = await sharp(wordmarkBuffer).metadata()

      // Create transparent canvas and composite wordmark centered in upper third
      const canvas = sharp({
        create: {
          width: BACK_WIDTH,
          height: BACK_HEIGHT,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })

      const topOffset = Math.round(BACK_HEIGHT * 0.15) // 15% from top
      const leftOffset = Math.round((BACK_WIDTH - wordmarkMeta.width) / 2)

      await canvas
        .composite([{ input: wordmarkBuffer, top: topOffset, left: leftOffset }])
        .png()
        .toFile(backPath)

      console.log(`  ✓ Back branding: ${BACK_WIDTH}x${BACK_HEIGHT}px (wordmark at ${leftOffset},${topOffset})`)
    } catch (err) {
      console.log(`  ✗ Back branding failed: ${err.message}`)
    }
  }
  console.log()

  // ── 4. Generate hi-res S mark for expansion-designs neck labels ──
  console.log('→ Generating neck label S mark (hi-res from existing asset)...')
  const neckLabelSrc = join(PUBLIC_DIR, 'expansion-designs', 'assets', 'neck-label-skapara-white.png')
  const neckLabelDst = join(OUTPUT_DIR, 'label-outside-smark-white-hires.png')

  if (existsSync(neckLabelDst) && !FORCE) {
    console.log('  ⊘ Already exists, skipping')
  } else if (existsSync(neckLabelSrc)) {
    try {
      await resizePng(neckLabelSrc, neckLabelDst, LABEL_SIZE, LABEL_SIZE)
      console.log(`  ✓ Neck label: ${LABEL_SIZE}x${LABEL_SIZE}px`)
    } catch (err) {
      console.log(`  ✗ Neck label failed: ${err.message}`)
    }
  } else {
    console.log('  ⊘ No hi-res neck label source, using SVG version')
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log()
  console.log('═══════════════════════════════════════════════════════')
  console.log('  RENDER SUMMARY')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Front designs rendered: ${rendered}`)
  console.log(`  Front designs skipped:  ${skipped}`)
  console.log(`  Front designs failed:   ${failed}`)
  console.log(`  Label outside:          ${existsSync(labelPath) ? '✓' : '✗'}`)
  console.log(`  Back branding:          ${existsSync(backPath) ? '✓' : '✗'}`)
  console.log(`  Output: ${OUTPUT_DIR}`)
  console.log()

  if (failed > 0) {
    console.log('  ⚠ Some designs failed to render. Fix issues and re-run with --force.')
  } else {
    console.log('  Next step: node scripts/migrate-phase1-02-upload-designs.mjs')
  }
}

// ─── Render Functions ───────────────────────────────────────────────────────────

async function renderSvg(inputPath, outputPath, width, height) {
  const svgBuffer = readFileSync(inputPath)

  await sharp(svgBuffer, { density: 150 })
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 6 })
    .toFile(outputPath)
}

async function resizePng(inputPath, outputPath, width, height) {
  await sharp(inputPath)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 6 })
    .toFile(outputPath)
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
