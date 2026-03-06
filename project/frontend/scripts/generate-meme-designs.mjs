/**
 * Generate 10 AI Developer Humor designs — PRINT-READY v4.
 * Transparent PNG backgrounds, minimalist text + logo composites.
 * Uses Sharp for SVG→PNG rendering and logo compositing.
 *
 * v4 IMPROVEMENTS:
 *  - Logos placed ABOVE text (not below) for better visual hierarchy
 *  - ChatGPT: SVG source with rounded corners (matches Claude icon style)
 *  - Only Cursor gets a subtle container badge (Claude & ChatGPT have own bg)
 *  - All 3 logos rendered at identical pixel size for visual harmony
 *  - Thin text: larger sizes, BODY bold instead of MONO where needed
 *  - Lines: stroke-width ≥6, opacity ≥0.8
 */

import sharp from 'sharp'
import { mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'meme-designs')
mkdirSync(OUT_DIR, { recursive: true })

const LOGOS_DIR = '/Users/lr0y/POD-AI-PDR/pod_workspace/img_logos'

// Logo source files
const CLAUDE  = 'claude-ai-icon.webp'
const CHATGPT = 'ChatGPT-logo-vector-01.svg'   // SVG for clean rendering + rounded corners
const CURSOR  = 'cursor-ai-logo-LPdV165213.webp'

// ─── Font stacks ────────────────────────────────────────────────────────────
const IMPACT = "'Impact','Arial Black',sans-serif"
const MONO   = "'Courier New','Monaco',monospace"
const BODY   = "'Arial','Helvetica Neue','Helvetica',sans-serif"

// ─── Logo loaders ───────────────────────────────────────────────────────────

/**
 * Claude logo — already has orange rounded-rect background.
 * No extra badge needed, just resize.
 */
async function loadClaudeLogo(size) {
  return sharp(readFileSync(join(LOGOS_DIR, CLAUDE)))
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

/**
 * ChatGPT logo — from SVG, add rounded corners to match Claude's icon radius.
 * The SVG has a sharp-cornered green rect; we add rx/ry (~21% radius).
 */
async function loadChatGPTLogo(size) {
  let svg = readFileSync(join(LOGOS_DIR, CHATGPT), 'utf8')
  // Add rounded corners matching standard app icon style (~21% of 512 = 108px)
  svg = svg.replace(
    '<rect x="0" y="0" class="st0" width="512" height="512"/>',
    '<rect x="0" y="0" class="st0" width="512" height="512" rx="108" ry="108"/>'
  )
  return sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer()
}

/**
 * Cursor logo — hexagonal icon on transparent background.
 * ONLY this logo gets a subtle white container badge for visibility.
 */
async function loadCursorLogo(size) {
  const radius = Math.round(size * 0.21) // match Claude/ChatGPT corner radius
  const pad = Math.round(size * 0.10)
  const iconSize = size - pad * 2

  // Subtle white rounded-rect badge
  const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}"
      fill="white" opacity="0.18"/>
  </svg>`
  const badge = await sharp(Buffer.from(badgeSvg)).resize(size, size).png().toBuffer()

  // Load and resize cursor icon inside the badge
  const icon = await sharp(readFileSync(join(LOGOS_DIR, CURSOR)))
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  return sharp(badge)
    .composite([{ input: icon, left: pad, top: pad }])
    .png()
    .toBuffer()
}

/** Dispatch logo loading based on filename */
async function loadLogo(filename, size) {
  if (filename === CLAUDE)  return loadClaudeLogo(size)
  if (filename === CHATGPT) return loadChatGPTLogo(size)
  if (filename === CURSOR)  return loadCursorLogo(size)
  throw new Error(`Unknown logo: ${filename}`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 1: "I don't write code anymore. I write prompts." (3366x4230)
// LOGOS: Claude, ChatGPT, Cursor — row at top
// ═══════════════════════════════════════════════════════════════════════════════
function design1_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.32}" font-family="${IMPACT}" font-size="${Math.round(w*0.078)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">I DON'T WRITE</text>
  <text x="${w/2}" y="${h*0.40}" font-family="${IMPACT}" font-size="${Math.round(w*0.078)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">CODE ANYMORE.</text>
  <line x1="${w*0.2}" y1="${h*0.45}" x2="${w*0.8}" y2="${h*0.45}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.54}" font-family="${IMPACT}" font-size="${Math.round(w*0.09)}"
    font-weight="900" fill="#10B981" text-anchor="middle" letter-spacing="4">I WRITE</text>
  <text x="${w/2}" y="${h*0.63}" font-family="${IMPACT}" font-size="${Math.round(w*0.09)}"
    font-weight="900" fill="#10B981" text-anchor="middle" letter-spacing="4">PROMPTS.</text>
</svg>`
}
function design1_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 2: "You're absolutely right!" (3951x4919)
// LOGO: Claude — centered at top
// FIXES: line stroke 6 opacity 0.9, credit BODY bold w*0.042
// ═══════════════════════════════════════════════════════════════════════════════
function design2_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.32}" font-family="'Georgia',serif" font-size="${Math.round(w*0.12)}"
    fill="white" text-anchor="middle" opacity="0.35">\u201C</text>
  <text x="${w/2}" y="${h*0.41}" font-family="${IMPACT}" font-size="${Math.round(w*0.09)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="4">YOU'RE</text>
  <text x="${w/2}" y="${h*0.51}" font-family="${IMPACT}" font-size="${Math.round(w*0.095)}"
    font-weight="900" fill="#D4845A" text-anchor="middle" letter-spacing="4">ABSOLUTELY</text>
  <text x="${w/2}" y="${h*0.61}" font-family="${IMPACT}" font-size="${Math.round(w*0.09)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="4">RIGHT!</text>
  <text x="${w/2}" y="${h*0.63}" font-family="'Georgia',serif" font-size="${Math.round(w*0.12)}"
    fill="white" text-anchor="middle" opacity="0.35">\u201D</text>
  <line x1="${w*0.25}" y1="${h*0.68}" x2="${w*0.75}" y2="${h*0.68}" stroke="#D4845A" stroke-width="6" opacity="0.9"/>
  <text x="${w/2}" y="${h*0.76}" font-family="${BODY}" font-size="${Math.round(w*0.042)}"
    font-weight="700" fill="#D4845A" text-anchor="middle">— Every Claude response ever</text>
</svg>`
}
function design2_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 3: "Vibe Coding" definition (3951x4919)
// LOGO: Cursor — centered at top
// FIXES: definition BODY bold w*0.044, credit BODY bold w*0.036, line stroke 6
// ═══════════════════════════════════════════════════════════════════════════════
function design3_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.34}" font-family="${IMPACT}" font-size="${Math.round(w*0.13)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="10">VIBE</text>
  <text x="${w/2}" y="${h*0.45}" font-family="${IMPACT}" font-size="${Math.round(w*0.13)}"
    font-weight="900" fill="#A78BFA" text-anchor="middle" letter-spacing="10">CODING</text>
  <line x1="${w*0.12}" y1="${h*0.50}" x2="${w*0.88}" y2="${h*0.50}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w*0.12}" y="${h*0.56}" font-family="${MONO}" font-size="${Math.round(w*0.036)}"
    font-weight="700" fill="#A78BFA">/va\u026Ab \u02C8ko\u028Ad\u026A\u014B/   noun</text>
  <text x="${w/2}" y="${h*0.64}" font-family="${BODY}" font-size="${Math.round(w*0.044)}"
    font-weight="700" fill="white" text-anchor="middle">The art of describing what you want</text>
  <text x="${w/2}" y="${h*0.70}" font-family="${BODY}" font-size="${Math.round(w*0.044)}"
    font-weight="700" fill="white" text-anchor="middle">and pretending you built it.</text>
  <text x="${w/2}" y="${h*0.78}" font-family="${BODY}" font-size="${Math.round(w*0.036)}"
    font-weight="700" fill="#A78BFA" text-anchor="middle">— Developer culture, 2026</text>
</svg>`
}
function design3_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 4: "I built this in 2 hours" (2752x3142)
// LOGO: Cursor — centered at top
// FIXES: yolo cmd size w*0.038 bold, debugging size w*0.042
// ═══════════════════════════════════════════════════════════════════════════════
function design4_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.35}" font-family="${IMPACT}" font-size="${Math.round(w*0.085)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="3">\u201CI BUILT THIS</text>
  <text x="${w/2}" y="${h*0.45}" font-family="${IMPACT}" font-size="${Math.round(w*0.085)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="3">IN 2 HOURS\u201D</text>
  <line x1="${w*0.2}" y1="${h*0.51}" x2="${w*0.8}" y2="${h*0.51}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.60}" font-family="${MONO}" font-size="${Math.round(w*0.042)}"
    font-weight="700" fill="#EF4444" text-anchor="middle">( spent 6 hours debugging )</text>
  <text x="${w/2}" y="${h*0.68}" font-family="${MONO}" font-size="${Math.round(w*0.038)}"
    font-weight="700" fill="white" text-anchor="middle" opacity="0.95">$ cursor compose --yolo</text>
</svg>`
}
function design4_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 5: "My code has no bugs" (3951x4919)
// LOGO: ChatGPT — centered at top
// FIXES: "It has" size w*0.050 bold, line stroke 6
// ═══════════════════════════════════════════════════════════════════════════════
function design5_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.30}" font-family="${IMPACT}" font-size="${Math.round(w*0.072)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="3">MY CODE HAS</text>
  <text x="${w/2}" y="${h*0.39}" font-family="${IMPACT}" font-size="${Math.round(w*0.09)}"
    font-weight="900" fill="#10B981" text-anchor="middle" letter-spacing="4">NO BUGS.</text>
  <line x1="${w*0.2}" y1="${h*0.44}" x2="${w*0.8}" y2="${h*0.44}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.52}" font-family="${BODY}" font-size="${Math.round(w*0.050)}"
    font-weight="700" fill="white" text-anchor="middle">It has</text>
  <text x="${w/2}" y="${h*0.60}" font-family="${IMPACT}" font-size="${Math.round(w*0.065)}"
    font-weight="900" fill="#10B981" text-anchor="middle" letter-spacing="3">AI-GENERATED</text>
  <text x="${w/2}" y="${h*0.68}" font-family="${IMPACT}" font-size="${Math.round(w*0.065)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="3">FEATURES.</text>
</svg>`
}
function design5_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 6: "Senior Dev → Prompt Engineer" (4200x3300 horizontal)
// LOGOS: Claude, ChatGPT, Cursor — row at top
// FIXES: header MONO bold w*0.028, SENIOR opacity 0.75, footer BODY bold w*0.024
// ═══════════════════════════════════════════════════════════════════════════════
function design6_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.30}" font-family="${MONO}" font-size="${Math.round(w*0.028)}"
    font-weight="700" fill="#10B981" text-anchor="middle">career_progression.js — 2026 edition</text>
  <text x="${w*0.28}" y="${h*0.48}" font-family="${IMPACT}" font-size="${Math.round(w*0.05)}"
    font-weight="900" fill="white" text-anchor="middle" opacity="0.75">SENIOR</text>
  <text x="${w*0.28}" y="${h*0.58}" font-family="${IMPACT}" font-size="${Math.round(w*0.05)}"
    font-weight="900" fill="white" text-anchor="middle" opacity="0.75">DEV</text>
  <text x="${w*0.50}" y="${h*0.53}" font-family="${IMPACT}" font-size="${Math.round(w*0.06)}"
    font-weight="900" fill="#FBBF24" text-anchor="middle">\u2192</text>
  <text x="${w*0.74}" y="${h*0.48}" font-family="${IMPACT}" font-size="${Math.round(w*0.05)}"
    font-weight="900" fill="#10B981" text-anchor="middle">PROMPT</text>
  <text x="${w*0.74}" y="${h*0.58}" font-family="${IMPACT}" font-size="${Math.round(w*0.05)}"
    font-weight="900" fill="#10B981" text-anchor="middle">ENGINEER</text>
  <line x1="${w*0.1}" y1="${h*0.66}" x2="${w*0.9}" y2="${h*0.66}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.90}" font-family="${BODY}" font-size="${Math.round(w*0.024)}"
    font-weight="700" fill="white" text-anchor="middle" opacity="0.9">\u00A9 2026 — All careers deprecated</text>
</svg>`
}
function design6_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 7: "git reset --hard" (2894x2421 ~square) — NO LOGOS
// FIXES: $ size w*0.050, subtitle BODY bold w*0.044, comment MONO bold w*0.034
// ═══════════════════════════════════════════════════════════════════════════════
function design7_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.30}" font-family="${MONO}" font-size="${Math.round(w*0.050)}"
    font-weight="700" fill="#10B981" text-anchor="middle">$</text>
  <text x="${w/2}" y="${h*0.45}" font-family="${MONO}" font-size="${Math.round(w*0.068)}"
    font-weight="700" fill="white" text-anchor="middle">git reset --hard</text>
  <line x1="${w*0.15}" y1="${h*0.54}" x2="${w*0.85}" y2="${h*0.54}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.65}" font-family="${BODY}" font-size="${Math.round(w*0.044)}"
    font-weight="700" fill="white" text-anchor="middle">The real AI undo button.</text>
  <text x="${w/2}" y="${h*0.76}" font-family="${MONO}" font-size="${Math.round(w*0.034)}"
    font-weight="700" fill="#EF4444" text-anchor="middle">// when Claude rewrites your entire codebase</text>
</svg>`
}
function design7_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 8: "If it ain't broke, I'll refactor it anyway" (2776x2285)
// LOGO: Cursor — centered at top
// FIXES: credit BODY bold w*0.036
// ═══════════════════════════════════════════════════════════════════════════════
function design8_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.40}" font-family="${IMPACT}" font-size="${Math.round(w*0.065)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="2">IF IT AIN'T BROKE,</text>
  <text x="${w/2}" y="${h*0.53}" font-family="${IMPACT}" font-size="${Math.round(w*0.068)}"
    font-weight="900" fill="#A78BFA" text-anchor="middle" letter-spacing="2">I'LL REFACTOR IT</text>
  <text x="${w/2}" y="${h*0.65}" font-family="${IMPACT}" font-size="${Math.round(w*0.068)}"
    font-weight="900" fill="#A78BFA" text-anchor="middle" letter-spacing="2">ANYWAY.</text>
  <line x1="${w*0.2}" y1="${h*0.71}" x2="${w*0.8}" y2="${h*0.71}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.80}" font-family="${BODY}" font-size="${Math.round(w*0.036)}"
    font-weight="700" fill="white" text-anchor="middle">— cursor agent, 3am, unsupervised</text>
</svg>`
}
function design8_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 9: "I didn't write this code" (3600x2700 horizontal)
// LOGOS: Claude, ChatGPT, Cursor — row at top
// FIXES: credit BODY bold w*0.048, line stroke 6
// ═══════════════════════════════════════════════════════════════════════════════
function design9_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.46}" font-family="${IMPACT}" font-size="${Math.round(w*0.058)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="3">I DIDN'T WRITE THIS CODE.</text>
  <line x1="${w*0.2}" y1="${h*0.53}" x2="${w*0.8}" y2="${h*0.53}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.65}" font-family="${BODY}" font-size="${Math.round(w*0.048)}"
    font-weight="700" fill="#FBBF24" text-anchor="middle">But I take full credit.</text>
</svg>`
}
function design9_logos() { return [] }

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 10: "404: Developer Not Found" (7205x3661 ultra-wide)
// LOGOS: Claude, ChatGPT, Cursor — row at top
// FIXES: subtitle BODY bold w*0.024
// ═══════════════════════════════════════════════════════════════════════════════
function design10_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.38}" font-family="${MONO}" font-size="${Math.round(w*0.055)}"
    font-weight="700" fill="#EF4444" text-anchor="middle">404</text>
  <text x="${w/2}" y="${h*0.55}" font-family="${IMPACT}" font-size="${Math.round(w*0.035)}"
    font-weight="900" fill="white" text-anchor="middle" letter-spacing="8">DEVELOPER NOT FOUND</text>
  <line x1="${w*0.25}" y1="${h*0.62}" x2="${w*0.75}" y2="${h*0.62}" stroke="white" stroke-width="6" opacity="0.8"/>
  <text x="${w/2}" y="${h*0.73}" font-family="${BODY}" font-size="${Math.round(w*0.024)}"
    font-weight="700" fill="white" text-anchor="middle">replaced by Claude, ChatGPT &amp; Cursor — since 2026</text>
</svg>`
}
function design10_logos() { return [] }

// ─── Render all designs ──────────────────────────────────────────────────────

const DESIGNS = [
  { name: '01-prompts-crewneck',      w: 3366, h: 4230, svgFn: design1_svg, logoFn: design1_logos },
  { name: '02-absolutely-right-tee',  w: 3951, h: 4919, svgFn: design2_svg, logoFn: design2_logos },
  { name: '03-vibe-coding-tee',       w: 3951, h: 4919, svgFn: design3_svg, logoFn: design3_logos },
  { name: '04-built-2hours-ls',       w: 2752, h: 3142, svgFn: design4_svg, logoFn: design4_logos },
  { name: '05-no-bugs-tee',           w: 3951, h: 4919, svgFn: design5_svg, logoFn: design5_logos },
  { name: '06-prompt-engineer-poster',w: 4200, h: 3300, svgFn: design6_svg, logoFn: design6_logos },
  { name: '07-git-reset-mousepad',    w: 2894, h: 2421, svgFn: design7_svg, logoFn: design7_logos },
  { name: '08-refactor-anyway-zip',   w: 2776, h: 2285, svgFn: design8_svg, logoFn: design8_logos },
  { name: '09-full-credit-laptop',    w: 3600, h: 2700, svgFn: design9_svg, logoFn: design9_logos },
  { name: '10-404-dev-gaming-pad',    w: 7205, h: 3661, svgFn: design10_svg, logoFn: design10_logos },
]

async function renderAll() {
  console.log('Generating 10 meme designs (v4 — logos above, text fixes)...\n')

  for (const { name, w, h, svgFn, logoFn } of DESIGNS) {
    try {
      const svg = svgFn(w, h)
      const logos = logoFn(w, h)

      // Render SVG text layer
      let buffer = await sharp(Buffer.from(svg))
        .resize(w, h)
        .ensureAlpha()
        .png()
        .toBuffer()

      if (logos.length > 0) {
        const composites = []
        for (const logo of logos) {
          const logoBuf = await loadLogo(logo.file, logo.size)
          composites.push({ input: logoBuf, left: logo.x, top: logo.y })
        }
        buffer = await sharp(buffer).composite(composites).png().toBuffer()
      }

      const outPath = join(OUT_DIR, `${name}.png`)
      await sharp(buffer).toFile(outPath)

      const meta = await sharp(outPath).metadata()
      const fsize = readFileSync(outPath).length
      console.log(`\u2713 ${name}.png — ${meta.width}x${meta.height}, ${meta.channels}ch, ${Math.round(fsize/1024)}KB`)
    } catch (err) {
      console.error(`\u2717 ${name}: ${err.message}`)
    }
  }

  console.log(`\nAll designs saved to: ${OUT_DIR}`)
}

renderAll().catch(console.error)
