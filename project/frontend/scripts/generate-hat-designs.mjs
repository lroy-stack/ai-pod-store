/**
 * Generate 5 trending hat designs as high-resolution transparent PNGs.
 * Zero cost — SVG + Sharp, no AI APIs.
 * All designs on TRANSPARENT background with BOLD colors for hat printing.
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join } from 'path'

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'hat-designs')
mkdirSync(OUT_DIR, { recursive: true })

const SIZE = 2048

// ─── Design 1: "Ocean Lines" — Bold teal wave line art ──────────────────────
const design1_waves = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00BCD4"/>
      <stop offset="100%" style="stop-color:#004D40"/>
    </linearGradient>
  </defs>
  ${[0,1,2,3,4,5,6].map(i => {
    const y = 550 + i * 140
    const sw = 28 - i * 3
    const amp = 120 - i * 10
    return `<path d="M 100 ${y} Q 350 ${y - amp} 600 ${y} T 1100 ${y} T 1600 ${y} T 2000 ${y}"
      fill="none" stroke="url(#wg)" stroke-width="${sw}" stroke-linecap="round" opacity="${1 - i * 0.08}"/>`
  }).join('\n  ')}
  <circle cx="1580" cy="350" r="130" fill="none" stroke="#00897B" stroke-width="12"/>
  <circle cx="1580" cy="350" r="85" fill="#00897B" opacity="0.35"/>
</svg>`

// ─── Design 2: "Neon Horizon" — Vibrant retro sunset + palm ────────────────
const design2_sunset = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FF006E"/>
      <stop offset="30%" style="stop-color:#FF6B35"/>
      <stop offset="60%" style="stop-color:#FFD23F"/>
      <stop offset="100%" style="stop-color:#7B2FF7"/>
    </linearGradient>
    <clipPath id="sunClip"><circle cx="1024" cy="1050" r="480"/></clipPath>
  </defs>
  <circle cx="1024" cy="1050" r="480" fill="url(#sky)"/>
  <g clip-path="url(#sunClip)">
    ${[0,1,2,3,4,5,6,7,8,9].map(i => {
      const y = 750 + i * 70
      const h = 8 + i * 4
      return `<rect x="400" y="${y}" width="1300" height="${h}" fill="rgba(0,0,0,0.18)"/>`
    }).join('\n    ')}
  </g>
  <g fill="#1B0035">
    <path d="M 620 1550 Q 650 1150 680 850 Q 690 800 700 740" stroke="#1B0035" stroke-width="35" fill="none"/>
    <path d="M 700 740 Q 440 620 280 680 Q 520 600 700 720Z"/>
    <path d="M 700 740 Q 560 520 380 420 Q 610 510 710 710Z"/>
    <path d="M 700 740 Q 800 500 980 410 Q 830 540 720 710Z"/>
    <path d="M 700 740 Q 920 650 1090 680 Q 890 640 720 720Z"/>
    <path d="M 700 740 Q 740 500 770 360 Q 760 540 710 710Z"/>
  </g>
  <line x1="80" y1="1450" x2="1968" y2="1450" stroke="#1B0035" stroke-width="6" opacity="0.5"/>
</svg>`

// ─── Design 3: "Street Script" — Bold black GRIND + red accent ─────────────
const design3_grind = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <filter id="rough">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="5" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
  <!-- Shadow for depth -->
  <text x="1030" y="1060" font-family="Impact, 'Arial Black', sans-serif" font-size="560"
    font-weight="900" fill="#333333" text-anchor="middle" letter-spacing="35" opacity="0.3">GRIND</text>
  <!-- Main text - solid black -->
  <text x="1024" y="1050" font-family="Impact, 'Arial Black', sans-serif" font-size="560"
    font-weight="900" fill="#1A1A1A" text-anchor="middle" letter-spacing="35" filter="url(#rough)">GRIND</text>
  <!-- Red underline -->
  <line x1="220" y1="1190" x2="1828" y2="1190" stroke="#E53935" stroke-width="24" stroke-linecap="round"/>
  <!-- Subtitle -->
  <text x="1024" y="1340" font-family="'Helvetica Neue', Arial, sans-serif" font-size="110"
    font-weight="400" fill="#424242" text-anchor="middle" letter-spacing="35">NEVER STOP</text>
  <!-- Red splatter accents -->
  <circle cx="260" cy="830" r="18" fill="#E53935" opacity="0.8"/>
  <circle cx="310" cy="890" r="10" fill="#E53935" opacity="0.6"/>
  <circle cx="1780" cy="900" r="14" fill="#E53935" opacity="0.7"/>
  <circle cx="1730" cy="845" r="7" fill="#E53935" opacity="0.5"/>
  <circle cx="1800" cy="960" r="5" fill="#E53935" opacity="0.4"/>
</svg>`

// ─── Design 4: "Summit Moon" — Dark mountains + moon + stars ────────────────
const design4_mountain = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="mg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#263238"/>
      <stop offset="100%" style="stop-color:#546E7A"/>
    </linearGradient>
    <linearGradient id="mg2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#37474F"/>
      <stop offset="100%" style="stop-color:#78909C"/>
    </linearGradient>
  </defs>
  <!-- Stars -->
  ${Array.from({length: 25}, (_, i) => {
    const x = 150 + ((i * 317) % 1748)
    const y = 120 + ((i * 211) % 500)
    const r = 3 + (i % 4) * 2.5
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#B0BEC5" opacity="${0.5 + (i%3)*0.2}"/>`
  }).join('\n  ')}
  <!-- Crescent moon -->
  <circle cx="1520" cy="300" r="110" fill="#CFD8DC"/>
  <circle cx="1570" cy="265" r="95" fill="none"/>
  <path d="M 1520 190 A 110 110 0 0 1 1520 410 A 75 75 0 0 0 1520 190Z" fill="#CFD8DC"/>
  <!-- Back mountain -->
  <polygon points="650,800 100,1600 1200,1600" fill="url(#mg2)" opacity="0.7"/>
  <!-- Back right mountain -->
  <polygon points="1450,750 900,1600 1950,1600" fill="url(#mg2)" opacity="0.6"/>
  <!-- Main mountain -->
  <polygon points="1024,580 300,1600 1748,1600" fill="url(#mg)"/>
  <!-- Snow cap -->
  <polygon points="1024,580 940,750 1110,750" fill="#CFD8DC" opacity="0.85"/>
  <!-- Treeline -->
  ${Array.from({length: 20}, (_, i) => {
    const x = 300 + i * 60
    const h = 30 + (i % 3) * 20
    return `<polygon points="${x},1520 ${x+15},${1520-h} ${x+30},1520" fill="#263238" opacity="0.4"/>`
  }).join('\n  ')}
</svg>`

// ─── Design 5: "Fluid Ink" — Vivid abstract gradient blobs ─────────────────
const design5_fluid = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <linearGradient id="fg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7B2FF7"/>
      <stop offset="45%" style="stop-color:#2979FF"/>
      <stop offset="100%" style="stop-color:#E91E63"/>
    </linearGradient>
    <linearGradient id="fg2" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#E91E63;stop-opacity:0.85"/>
      <stop offset="50%" style="stop-color:#00BFA5;stop-opacity:0.85"/>
      <stop offset="100%" style="stop-color:#651FFF;stop-opacity:0.85"/>
    </linearGradient>
    <filter id="softblur"><feGaussianBlur stdDeviation="25"/></filter>
  </defs>
  <!-- Main blob -->
  <path d="M 450 680 C 250 350, 700 150, 1024 300 C 1400 150, 1800 380, 1550 700
           C 1780 1050, 1400 1350, 1024 1220 C 600 1350, 200 1050, 450 680Z"
    fill="url(#fg1)" filter="url(#softblur)"/>
  <!-- Secondary blob -->
  <path d="M 650 850 C 420 600, 850 430, 1100 600 C 1350 430, 1650 650, 1420 920
           C 1600 1200, 1250 1380, 1024 1280 C 750 1380, 430 1150, 650 850Z"
    fill="url(#fg2)" opacity="0.8"/>
  <!-- Highlight accents -->
  <circle cx="750" cy="550" r="70" fill="white" opacity="0.12"/>
  <circle cx="1250" cy="650" r="50" fill="white" opacity="0.1"/>
  <circle cx="950" cy="420" r="30" fill="white" opacity="0.18"/>
  <!-- Accent lines -->
  <path d="M 350 1080 Q 700 850 1024 900 T 1700 1020"
    fill="none" stroke="white" stroke-width="5" opacity="0.25"/>
  <path d="M 500 700 Q 800 550 1024 600 T 1500 680"
    fill="none" stroke="white" stroke-width="3" opacity="0.2"/>
</svg>`

// ─── Render all to transparent PNG ──────────────────────────────────────────

const designs = [
  { name: 'ocean-lines', svg: design1_waves },
  { name: 'neon-horizon', svg: design2_sunset },
  { name: 'street-script', svg: design3_grind },
  { name: 'summit-moon', svg: design4_mountain },
  { name: 'fluid-ink', svg: design5_fluid },
]

async function renderDesigns() {
  for (const { name, svg } of designs) {
    const outPath = join(OUT_DIR, `${name}.png`)
    try {
      await sharp(Buffer.from(svg))
        .resize(SIZE, SIZE)
        .png({ quality: 100 })
        .ensureAlpha()
        .toFile(outPath)

      const stats = await sharp(outPath).metadata()
      console.log(`✓ ${name}.png — ${stats.width}x${stats.height}, ${stats.channels}ch, ${Math.round(stats.size/1024)}KB`)
    } catch (err) {
      console.error(`✗ ${name}.png — ${err.message}`)
    }
  }
  console.log(`\nAll designs saved to: ${OUT_DIR}`)
}

renderDesigns().catch(console.error)
