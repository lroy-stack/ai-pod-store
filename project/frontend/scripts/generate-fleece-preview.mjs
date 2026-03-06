#!/usr/bin/env node
/**
 * Generate preview versions of fleece designs on dark background
 * so they're visible for review (the actual production files are white on transparent)
 */

import sharp from 'sharp'
import path from 'path'

const OUT_DIR = path.resolve('public/fleece-designs')

// ─── Left Chest: SKAPARA + divider + EST · 26 ──────────
function chestLeftPreview() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#1a1a1a"/>

  <text x="600" y="510"
    font-family="Arial Black, Impact, Helvetica Neue, sans-serif"
    font-weight="900"
    font-size="155"
    fill="white"
    text-anchor="middle"
    letter-spacing="22">SKAPARA</text>

  <rect x="180" y="545" width="840" height="18" rx="3" fill="white"/>

  <text x="600" y="660"
    font-family="Arial Black, Impact, Helvetica Neue, sans-serif"
    font-weight="900"
    font-size="105"
    fill="white"
    text-anchor="middle"
    letter-spacing="16">EST · 26</text>
</svg>`
}

// ─── Center Chest: SKAPARA + ORIGINAL + geometric lines ─
function centerChestPreview() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#1a1a1a"/>

  <rect x="350" y="360" width="500" height="16" rx="2" fill="white"/>
  <rect x="420" y="390" width="360" height="16" rx="2" fill="white"/>

  <text x="600" y="530"
    font-family="Arial Black, Impact, Helvetica Neue, sans-serif"
    font-weight="900"
    font-size="165"
    fill="white"
    text-anchor="middle"
    letter-spacing="24">SKAPARA</text>

  <text x="600" y="640"
    font-family="Arial Black, Impact, Helvetica Neue, sans-serif"
    font-weight="900"
    font-size="100"
    fill="white"
    text-anchor="middle"
    letter-spacing="30">ORIGINAL</text>

  <rect x="420" y="680" width="360" height="16" rx="2" fill="white"/>
  <rect x="350" y="710" width="500" height="16" rx="2" fill="white"/>
</svg>`
}

// ─── Wrist: Bold S in geometric frame ───────────────────
function wristPreview() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect width="900" height="600" fill="#1a1a1a"/>

  <rect x="300" y="120" width="300" height="360" rx="8"
    fill="none" stroke="white" stroke-width="18"/>

  <text x="450" y="380"
    font-family="Arial Black, Impact, Helvetica Neue, sans-serif"
    font-weight="900"
    font-size="240"
    fill="white"
    text-anchor="middle">S</text>
</svg>`
}

async function main() {
  const previews = [
    { name: 'preview-chest-left',   svg: chestLeftPreview(),   w: 1200, h: 1200 },
    { name: 'preview-chest-center', svg: centerChestPreview(), w: 1200, h: 1200 },
    { name: 'preview-wrist-left',   svg: wristPreview(),       w: 900,  h: 600  },
  ]

  for (const { name, svg, w, h } of previews) {
    const outPath = path.join(OUT_DIR, `${name}.png`)
    await sharp(Buffer.from(svg))
      .resize(w, h)
      .png({ quality: 100 })
      .toFile(outPath)
    console.log(`✓ ${name}.png`)
  }
}

main().catch(console.error)
