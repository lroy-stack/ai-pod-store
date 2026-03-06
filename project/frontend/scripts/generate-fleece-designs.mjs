#!/usr/bin/env node
/**
 * Fleece Jacket Embroidery Designs — SKAPARA Premium Collection
 *
 * Approach: Sharp composition pipeline (SVG → PNG → composite layers)
 * avoids fragile nested SVG transforms entirely.
 *
 * Design language:
 *   Chest — Solid white S mark + teal L-brackets + purple constellation dots + teal accent line
 *   Wrist — Solid white SKAPARA wordmark + teal accent dash
 *
 * Thread palette (3 solid colors — embroidery, NO gradients):
 *   #FFFFFF  white   (S mark, wordmark)
 *   #14B8A6  teal    (L-bracket TL, accent lines, dots)
 *   #7C3AED  purple  (L-bracket BR, dots)
 *
 * Canvases:
 *   front_left_chest  1200×1200  (4″×4″ @300dpi)
 *   left_wrist         900×600   (3″×2″ @300dpi)
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

const OUT = path.resolve('public/fleece-designs')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

// ─── Read original brand SVGs ───────────────────────────
const markSvgRaw = readFileSync('public/brand/skapara-mark-white.svg', 'utf8')
const wordmarkSvgRaw = readFileSync('public/brand/skapara-wordmark-dark.svg', 'utf8')

// ─────────────────────────────────────────────────────────
// CHEST LEFT — Gradient S mark + geometric accents
// ─────────────────────────────────────────────────────────
async function buildChest() {
  const CW = 1200, CH = 1200           // Canvas
  const MW = 550, MH = 422             // Mark size (1431:1100 aspect)
  const MX = Math.round((CW - MW) / 2) // 325
  const MY = 270                        // Top edge — slightly above center

  // 1) Render original white S mark at target size (solid white — embroidery thread)
  const markBuffer = await sharp(Buffer.from(markSvgRaw))
    .resize(MW, MH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer()

  // 4) Geometric accent layer (brackets, dots, underline)
  const accentSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
    <!-- Top-left L-bracket (teal) -->
    <path d="M 150 280 L 150 150 L 280 150"
      fill="none" stroke="#14B8A6" stroke-width="18"
      stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Bottom-right L-bracket (purple) -->
    <path d="M 1050 920 L 1050 1050 L 920 1050"
      fill="none" stroke="#7C3AED" stroke-width="18"
      stroke-linecap="round" stroke-linejoin="round"/>

    <!-- Constellation dots — rhythm at corners -->
    <circle cx="155" cy="155" r="10" fill="#14B8A6" opacity="0.8"/>
    <circle cx="1045" cy="1045" r="10" fill="#7C3AED" opacity="0.8"/>
    <circle cx="145" cy="400" r="6"  fill="#14B8A6" opacity="0.35"/>
    <circle cx="1055" cy="800" r="6" fill="#7C3AED" opacity="0.35"/>

    <!-- Accent underline (teal, centered below mark) -->
    <line x1="450" y1="742" x2="750" y2="742"
      stroke="#14B8A6" stroke-width="16" stroke-linecap="round"/>
  </svg>`
  const accentBuf = await sharp(Buffer.from(accentSvg)).png().toBuffer()

  // 5) Composite everything on transparent canvas
  return sharp({
    create: { width: CW, height: CH, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      { input: accentBuf, top: 0, left: 0 },
      { input: markBuffer, top: MY, left: MX },
    ])
    .png({ quality: 100 })
    .toBuffer()
}

// ─────────────────────────────────────────────────────────
// WRIST LEFT — White wordmark + teal accent dash
// ─────────────────────────────────────────────────────────
async function buildWrist() {
  const CW = 900, CH = 600
  const WMW = 700 // Wordmark target width

  // 1) Render wordmark in white
  const whiteSvg = wordmarkSvgRaw.replace('fill="#0F172A"', 'fill="#FFFFFF"')
  const wordmarkBuf = await sharp(Buffer.from(whiteSvg))
    .resize(WMW, null) // auto height (keeps aspect)
    .png()
    .toBuffer()

  const meta = await sharp(wordmarkBuf).metadata()
  const wmH = meta.height       // ≈71 px
  const wmX = Math.round((CW - WMW) / 2)      // 100
  const wmY = Math.round((CH - wmH) / 2) - 15  // slightly above center

  // 2) Teal accent dash below wordmark
  const accentY = wmY + wmH + 25
  const accentSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}">
    <line x1="310" y1="${accentY}" x2="590" y2="${accentY}"
      stroke="#14B8A6" stroke-width="14" stroke-linecap="round"/>
  </svg>`
  const accentBuf = await sharp(Buffer.from(accentSvg)).png().toBuffer()

  // 3) Composite on transparent canvas
  return sharp({
    create: { width: CW, height: CH, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([
      { input: accentBuf, top: 0, left: 0 },
      { input: wordmarkBuf, top: wmY, left: wmX },
    ])
    .png({ quality: 100 })
    .toBuffer()
}

// ─────────────────────────────────────────────────────────
// MAIN — Build + previews
// ─────────────────────────────────────────────────────────
async function main() {
  console.log('Building fleece jacket embroidery designs…\n')

  // Production files (transparent bg)
  const chestBuf = await buildChest()
  const wristBuf = await buildWrist()

  await sharp(chestBuf).toFile(path.join(OUT, 'fleece-chest-left.png'))
  console.log('✓ fleece-chest-left.png  (1200×1200)')

  await sharp(wristBuf).toFile(path.join(OUT, 'fleece-wrist-left.png'))
  console.log('✓ fleece-wrist-left.png  (900×600)')

  // Previews on the 3 fleece colors
  const backgrounds = [
    { r: 30,  g: 30,  b: 30,  name: 'black' },     // Black
    { r: 55,  g: 55,  b: 58,  name: 'charcoal' },   // Charcoal Heather
    { r: 27,  g: 42,  b: 74,  name: 'navy' },        // Collegiate Navy
  ]

  for (const { r, g, b, name } of backgrounds) {
    const bgColor = { r, g, b, alpha: 255 }

    await sharp({
      create: { width: 1200, height: 1200, channels: 4, background: bgColor }
    })
      .composite([{ input: chestBuf }])
      .png()
      .toFile(path.join(OUT, `preview-chest-${name}.png`))

    await sharp({
      create: { width: 900, height: 600, channels: 4, background: bgColor }
    })
      .composite([{ input: wristBuf }])
      .png()
      .toFile(path.join(OUT, `preview-wrist-${name}.png`))

    console.log(`✓ previews on ${name}`)
  }

  console.log(`\nDone → ${OUT}/`)
}

main().catch(err => { console.error(err); process.exit(1) })
