/**
 * Convert branding SVGs to production-ready transparent PNGs using sharp.
 * Output goes to /public/kids-designs/ for use by the creation script.
 *
 * Assets generated:
 * - branding-back-smark-white.png     (S mark white — for back on dark garments)
 * - branding-back-smark-dark.png      (S mark dark — for back on light garments)
 * - branding-back-wordmark-white.png  (Wordmark white — for back on dark garments)
 * - branding-back-wordmark-dark.png   (Wordmark dark — for back on light garments)
 * - branding-back-lockup-white.png    (S mark + wordmark lockup white)
 * - branding-neck-smark-gradient.png  (Gradient S mark — for kids neck position)
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '..')
const BRAND_DIR = join(ROOT, 'public', 'brand')
const OUT_DIR = join(ROOT, 'public', 'kids-designs')

// Target sizes for Printify uploads (reasonable resolution for scaling)
const BACK_WIDTH = 2000   // Will be scaled down with Printify scale: 0.25-0.35
const BACK_HEIGHT = 1600
const NECK_SIZE = 1000    // Will fill most of the neck area

async function convertSvg(svgPath, outPath, width, height) {
  const svgBuffer = readFileSync(svgPath)
  await sharp(svgBuffer, { density: 300 })
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath)
  const info = await sharp(outPath).metadata()
  console.log(`  ✓ ${outPath.split('/').pop()} — ${info.width}x${info.height} (${Math.round(info.size / 1024)}KB)`)
}

async function main() {
  console.log('\nConverting SKAPARA branding SVGs to PNGs...\n')

  // 1. S Mark White (for dark garments back)
  await convertSvg(
    join(BRAND_DIR, 'skapara-mark-white.svg'),
    join(OUT_DIR, 'branding-back-smark-white.png'),
    BACK_WIDTH, BACK_HEIGHT
  )

  // 2. S Mark Dark (for light garments back)
  await convertSvg(
    join(BRAND_DIR, 'skapara-mark-dark.svg'),
    join(OUT_DIR, 'branding-back-smark-dark.png'),
    BACK_WIDTH, BACK_HEIGHT
  )

  // 3. Wordmark White (for dark garments back)
  await convertSvg(
    join(BRAND_DIR, 'skapara-wordmark-white.svg'),
    join(OUT_DIR, 'branding-back-wordmark-white.png'),
    BACK_WIDTH, 400 // Wordmark is very wide, keep it proportional
  )

  // 4. Wordmark Dark (for light garments back)
  await convertSvg(
    join(BRAND_DIR, 'skapara-wordmark-dark.svg'),
    join(OUT_DIR, 'branding-back-wordmark-dark.png'),
    BACK_WIDTH, 400
  )

  // 5. Lockup White (S mark + wordmark horizontal)
  await convertSvg(
    join(BRAND_DIR, 'skapara-lockup-white.svg'),
    join(OUT_DIR, 'branding-back-lockup-white.png'),
    BACK_WIDTH, 400
  )

  // 6. S Mark Gradient (for kids neck position — colorful)
  await convertSvg(
    join(BRAND_DIR, 'skapara-mark-color.svg'),
    join(OUT_DIR, 'branding-neck-smark-gradient.png'),
    NECK_SIZE, NECK_SIZE
  )

  console.log('\nDone! All branding PNGs saved to /public/kids-designs/\n')
}

main().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
