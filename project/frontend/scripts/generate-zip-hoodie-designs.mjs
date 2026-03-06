#!/usr/bin/env node
/**
 * SKAPARA Zip Hoodie — DTG Front Design
 *
 * Product: AWDIS Full Zip Hoodie (BP91/P26 Textildruck Europa)
 * Canvas: front 3366×2772 px
 * Method: DTG — full color, gradients OK
 *
 * Design: Gradient S mark (purple→teal) + geometric L-brackets + accent line
 * For dark fabrics: Black, Navy, Steel Grey, Heather Grey
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

const OUT = path.resolve('public/zip-hoodie-designs')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const markSvgRaw = readFileSync('public/brand/skapara-mark-white.svg', 'utf8')

async function buildFront() {
  const CW = 3366, CH = 2772
  const MW = 1000, MH = Math.round(1000 * 1100 / 1431) // 769
  const MX = Math.round((CW - MW) / 2) // 1183
  const MY = 550  // Upper chest area

  // 1) Render white S mark at target size
  const whiteAlpha = await sharp(Buffer.from(markSvgRaw))
    .resize(MW, MH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer()

  // 2) Gradient rectangle (DTG supports gradients!)
  const gradSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}">
    <defs>
      <linearGradient id="g" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%"   stop-color="#7C3AED"/>
        <stop offset="45%"  stop-color="#6D28D9"/>
        <stop offset="100%" stop-color="#14B8A6"/>
      </linearGradient>
    </defs>
    <rect width="${MW}" height="${MH}" fill="url(#g)"/>
  </svg>`
  const gradBuf = await sharp(Buffer.from(gradSvg)).png().toBuffer()

  // 3) Mask gradient through S mark alpha
  const gradientMark = await sharp(gradBuf)
    .composite([{ input: whiteAlpha, blend: 'dest-in' }])
    .png()
    .toBuffer()

  // 4) Geometric accents scaled for large canvas
  const bracketOffset = 250
  const tlx = MX - bracketOffset, tly = MY - bracketOffset
  const brx = MX + MW + bracketOffset - 130, bry = MY + MH + bracketOffset - 130
  const accentY = MY + MH + 70
  const accentHalfW = 250

  const accentSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
    <!-- Top-left L-bracket (teal) -->
    <path d="M ${tlx} ${tly + 150} L ${tlx} ${tly} L ${tlx + 150} ${tly}"
      fill="none" stroke="#14B8A6" stroke-width="20"
      stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Bottom-right L-bracket (purple) -->
    <path d="M ${brx} ${bry - 150} L ${brx} ${bry} L ${brx - 150} ${bry}"
      fill="none" stroke="#7C3AED" stroke-width="20"
      stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Constellation dots -->
    <circle cx="${tlx + 5}" cy="${tly + 5}" r="12" fill="#14B8A6" opacity="0.8"/>
    <circle cx="${brx - 5}" cy="${bry - 5}" r="12" fill="#7C3AED" opacity="0.8"/>
    <circle cx="${tlx - 10}" cy="${tly + 350}" r="7" fill="#14B8A6" opacity="0.35"/>
    <circle cx="${brx + 10}" cy="${bry - 350}" r="7" fill="#7C3AED" opacity="0.35"/>

    <!-- Accent underline (teal, centered) -->
    <line x1="${CW / 2 - accentHalfW}" y1="${accentY}" x2="${CW / 2 + accentHalfW}" y2="${accentY}"
      stroke="#14B8A6" stroke-width="18" stroke-linecap="round"/>
  </svg>`
  const accentBuf = await sharp(Buffer.from(accentSvg)).png().toBuffer()

  // 5) Composite on transparent canvas
  return sharp({
    create: { width: CW, height: CH, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      { input: accentBuf, top: 0, left: 0 },
      { input: gradientMark, top: MY, left: MX },
    ])
    .png({ quality: 100 })
    .toBuffer()
}

async function main() {
  console.log('Building zip hoodie DTG design…\n')

  const frontBuf = await buildFront()

  await sharp(frontBuf).toFile(path.join(OUT, 'zip-hoodie-front.png'))
  console.log('✓ zip-hoodie-front.png (3366×2772)')

  // Previews on the 4 dark fabric colors
  const backgrounds = [
    { r: 20,  g: 20,  b: 20,  name: 'black' },
    { r: 25,  g: 35,  b: 60,  name: 'navy' },
    { r: 85,  g: 85,  b: 88,  name: 'steel-grey' },
    { r: 160, g: 160, b: 162, name: 'heather-grey' },
  ]

  // Resize front design for previews
  const previewW = 800, previewH = Math.round(800 * 2772 / 3366)
  const frontSmall = await sharp(frontBuf).resize(previewW, previewH).png().toBuffer()

  for (const { r, g, b, name } of backgrounds) {
    await sharp({
      create: { width: previewW, height: previewH, channels: 4,
                background: { r, g, b, alpha: 255 } }
    })
      .composite([{ input: frontSmall }])
      .png()
      .toFile(path.join(OUT, `preview-front-${name}.png`))
    console.log(`✓ preview ${name}`)
  }

  console.log(`\nDone → ${OUT}/`)
}

main().catch(err => { console.error(err); process.exit(1) })
