/**
 * SKAPARA — 20 New Products (Mix: 7 Branded + 7 Trending + 6 Humor Tech)
 *
 * All BPs verified for EU shipping (2026-02-28 audit).
 *
 * Usage:
 *   node scripts/create-20-new-products.mjs --preview    # Generate PNG previews
 *   node scripts/create-20-new-products.mjs              # Create on Printify + Supabase
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const PREVIEW = process.argv.includes('--preview')
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'new-product-previews')
mkdirSync(OUT_DIR, { recursive: true })

// ─── Env ────────────────────────────────────────────────────────────────────
let TOKEN, SHOP_ID, supabase
if (!PREVIEW) {
  const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
  TOKEN = env('PRINTIFY_API_TOKEN')
  SHOP_ID = env('PRINTIFY_SHOP_ID')
  const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
  const SB_KEY = env('SUPABASE_SERVICE_KEY')
  if (!TOKEN || !SHOP_ID || !SB_URL || !SB_KEY) { console.error('Missing env vars'); process.exit(1) }
  supabase = createClient(SB_URL, SB_KEY)
}

const API = 'https://api.printify.com/v1'
const hdrs = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' })
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs(), ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// ─── Typography ─────────────────────────────────────────────────────────────
const SANS  = "'Helvetica Neue','Arial','Helvetica',sans-serif"
const MONO  = "'Courier New','Monaco','Consolas',monospace"
const SERIF = "'Georgia','Times New Roman',serif"
const FUTURA = "'Futura','Helvetica Neue','Arial',sans-serif"

// ─── Colors ─────────────────────────────────────────────────────────────────
const WHITE = '#FFFFFF'
const BLACK = '#1A1A1A'
const GRAY  = '#888888'
const GRAY_L = '#AAAAAA'
const GRAY_D = '#555555'
const GREEN_T = '#10B981'  // terminal green
const RED    = '#EF4444'
const NPC_G  = '#76B900'   // NPC energy green
const SKY    = '#87CEEB'   // sky blue for clouds

// ═══════════════════════════════════════════════════════════════════════════════
//  DESIGN FUNCTIONS — Each returns SVG string for its canvas
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 1. SKAPARA Noir — Mug (2244×945) ──────────────────────────────────────
// Dark minimal "S" mark + wordmark on white mug
function design_01(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.25}" y="${h*0.72}" font-family="${FUTURA}" font-size="${Math.round(h*0.7)}"
    fill="${BLACK}" font-weight="900" text-anchor="middle">S</text>
  <text x="${w*0.72}" y="${h*0.55}" font-family="${FUTURA}" font-size="${Math.round(h*0.12)}"
    fill="${BLACK}" font-weight="700" text-anchor="middle" letter-spacing="${Math.round(w*0.012)}">SKAPARA</text>
  <line x1="${w*0.55}" y1="${h*0.62}" x2="${w*0.89}" y2="${h*0.62}" stroke="${GRAY}" stroke-width="2" opacity="0.4"/>
  <text x="${w*0.72}" y="${h*0.73}" font-family="${SANS}" font-size="${Math.round(h*0.06)}"
    fill="${GRAY}" text-anchor="middle" letter-spacing="${Math.round(w*0.004)}">EST. 2026</text>
</svg>`
}

// ─── 2. SKAPARA Signal — Bottle wrap (2759×1500) ────────────────────────────
// Gradient-inspired horizontal bands + vertical wordmark
function design_02(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4A4A4A"/>
      <stop offset="50%" stop-color="#2C3E50"/>
      <stop offset="100%" stop-color="#1A1A2E"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${h*0.1}" width="${w}" height="${h*0.05}" fill="url(#grad)" opacity="0.6"/>
  <rect x="0" y="${h*0.85}" width="${w}" height="${h*0.05}" fill="url(#grad)" opacity="0.6"/>
  <text x="${w*0.5}" y="${h*0.55}" font-family="${FUTURA}" font-size="${Math.round(h*0.18)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.02)}">SKAPARA</text>
  <text x="${w*0.5}" y="${h*0.68}" font-family="${SANS}" font-size="${Math.round(h*0.05)}"
    fill="${GRAY_L}" text-anchor="middle" letter-spacing="${Math.round(w*0.008)}">SIGNAL COLLECTION</text>
</svg>`
}

// ─── 3. SKAPARA Core — Crewneck (3366×4230) ────────────────────────────────
// Center chest "S" mark + small wordmark below
function design_03(w, h) {
  const cx = w / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${cx}" y="${h*0.35}" font-family="${FUTURA}" font-size="${Math.round(w*0.22)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle">S</text>
  <line x1="${cx - w*0.12}" y1="${h*0.38}" x2="${cx + w*0.12}" y2="${h*0.38}" stroke="${GRAY}" stroke-width="3" opacity="0.5"/>
  <text x="${cx}" y="${h*0.43}" font-family="${FUTURA}" font-size="${Math.round(w*0.04)}"
    fill="${GRAY_L}" font-weight="500" text-anchor="middle" letter-spacing="${Math.round(w*0.012)}">SKAPARA</text>
</svg>`
}

// ─── 4. SKAPARA Edge — Long Sleeve (2752×3142) ─────────────────────────────
// Left chest logo small
function design_04(w, h) {
  const lx = w * 0.25
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${lx}" y="${h*0.18}" font-family="${FUTURA}" font-size="${Math.round(w*0.10)}"
    fill="${WHITE}" font-weight="900" text-anchor="center">S</text>
  <text x="${lx + w*0.005}" y="${h*0.22}" font-family="${FUTURA}" font-size="${Math.round(w*0.025)}"
    fill="${GRAY_L}" font-weight="500" text-anchor="center" letter-spacing="${Math.round(w*0.006)}">SKAPARA</text>
</svg>`
}

// ─── 5. SKAPARA Grip — Desk Mat (7205×3661) ────────────────────────────────
// Tonal repeating S pattern grid
function design_05(w, h) {
  const rows = 5
  const cols = 12
  const cellW = w / cols
  const cellH = h / rows
  let marks = ''
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cellW * c + cellW / 2
      const y = cellH * r + cellH / 2
      const opacity = ((r + c) % 3 === 0) ? 0.12 : 0.06
      marks += `<text x="${x}" y="${y + cellH*0.15}" font-family="${FUTURA}" font-size="${Math.round(cellH*0.6)}"
        fill="${WHITE}" font-weight="900" text-anchor="middle" opacity="${opacity}">S</text>\n`
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${marks}
  <rect x="${w*0.01}" y="${h*0.01}" width="${w*0.98}" height="${h*0.98}" fill="none" stroke="${WHITE}" stroke-width="3" opacity="0.08" rx="20"/>
</svg>`
}

// ─── 6. SKAPARA Step — Sneaker body outside (1434×650) ─────────────────────
function design_06_body(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.65}" font-family="${FUTURA}" font-size="${Math.round(h*0.55)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle">S</text>
</svg>`
}

// ─── 6b. SKAPARA Step — Sneaker tongue (945×1220) ──────────────────────────
function design_06_tongue(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.45}" font-family="${FUTURA}" font-size="${Math.round(w*0.14)}"
    fill="${WHITE}" font-weight="700" text-anchor="middle" letter-spacing="${Math.round(w*0.015)}"
    transform="rotate(-90 ${w*0.5} ${h*0.45})">SKAPARA</text>
</svg>`
}

// ─── 7. SKAPARA Pack — Sticker (600×600) ────────────────────────────────────
function design_07(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="${w*0.05}" y="${h*0.05}" width="${w*0.9}" height="${h*0.9}" fill="${BLACK}" rx="${w*0.08}"/>
  <text x="${w*0.5}" y="${h*0.6}" font-family="${FUTURA}" font-size="${Math.round(w*0.45)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle">S</text>
  <text x="${w*0.5}" y="${h*0.82}" font-family="${FUTURA}" font-size="${Math.round(w*0.09)}"
    fill="${GRAY_L}" font-weight="500" text-anchor="middle" letter-spacing="${Math.round(w*0.015)}">SKAPARA</text>
</svg>`
}

// ─── 8. Zen Mode — Zip Hoodie (2776×2285) ──────────────────────────────────
function design_08(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.42}" font-family="${FUTURA}" font-size="${Math.round(w*0.12)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.015)}">ZEN MODE</text>
  <text x="${w*0.5}" y="${h*0.58}" font-family="${SANS}" font-size="${Math.round(w*0.08)}"
    fill="${GRAY}" text-anchor="middle" opacity="0.6">\u221E</text>
</svg>`
}

// ─── 9. Main Character — Long Sleeve (2752×3142) ───────────────────────────
// Back print big + small star on front chest
function design_09(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.38}" font-family="${FUTURA}" font-size="${Math.round(w*0.13)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.008)}">MAIN</text>
  <text x="${w*0.5}" y="${h*0.52}" font-family="${FUTURA}" font-size="${Math.round(w*0.13)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.008)}">CHARACTER</text>
  <text x="${w*0.5}" y="${h*0.65}" font-family="${SANS}" font-size="${Math.round(w*0.035)}"
    fill="${GRAY}" text-anchor="middle" letter-spacing="${Math.round(w*0.015)}">SEASON ONE</text>
</svg>`
}

// ─── 10. Overthinking — Crewneck (4091×4624) ───────────────────────────────
function design_10(w, h) {
  const barW = w * 0.6
  const barH = h * 0.025
  const barX = (w - barW) / 2
  const barY = h * 0.45
  const filled = barW * 0.99
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.35}" font-family="${FUTURA}" font-size="${Math.round(w*0.085)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.005)}">OVERTHINKING</text>
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${barH/2}" fill="${GRAY_D}" opacity="0.5"/>
  <rect x="${barX}" y="${barY}" width="${filled}" height="${barH}" rx="${barH/2}" fill="${WHITE}"/>
  <text x="${w*0.5}" y="${barY + barH + h*0.04}" font-family="${MONO}" font-size="${Math.round(w*0.03)}"
    fill="${GRAY_L}" text-anchor="middle">99%  \u2014  please wait...</text>
</svg>`
}

// ─── 11. NPC Energy — Tumbler wrap (2776×2374) ─────────────────────────────
function design_11(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="npc" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${NPC_G}"/>
      <stop offset="60%" stop-color="#3D5A00"/>
      <stop offset="100%" stop-color="#1A1A1A"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#npc)" opacity="0.85"/>
  <text x="${w*0.5}" y="${h*0.18}" font-family="${FUTURA}" font-size="${Math.round(w*0.04)}"
    fill="${WHITE}" font-weight="500" text-anchor="middle" letter-spacing="${Math.round(w*0.02)}" opacity="0.6">PREMIUM ENERGY DRINK</text>
  <text x="${w*0.5}" y="${h*0.40}" font-family="${FUTURA}" font-size="${Math.round(w*0.12)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.005)}">NPC</text>
  <text x="${w*0.5}" y="${h*0.55}" font-family="${FUTURA}" font-size="${Math.round(w*0.08)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.01)}">ENERGY\u2122</text>
  <line x1="${w*0.2}" y1="${h*0.60}" x2="${w*0.8}" y2="${h*0.60}" stroke="${WHITE}" stroke-width="2" opacity="0.3"/>
  <text x="${w*0.5}" y="${h*0.70}" font-family="${MONO}" font-size="${Math.round(w*0.028)}"
    fill="${GRAY_L}" text-anchor="middle">0% Motivation \u00B7 100% Side Quest</text>
  <text x="${w*0.5}" y="${h*0.80}" font-family="${MONO}" font-size="${Math.round(w*0.022)}"
    fill="${GRAY}" text-anchor="middle">ZERO AGENCY \u00B7 INFINITE LOOPS</text>
  <text x="${w*0.5}" y="${h*0.93}" font-family="${SANS}" font-size="${Math.round(w*0.02)}"
    fill="${GRAY_D}" text-anchor="middle">Warning: May cause idle animations and dialogue repetition</text>
</svg>`
}

// ─── 12. Touch Grass — Mouse Pad (2894×2421) ───────────────────────────────
function design_12(w, h) {
  // Geometric grass pattern top + terminal bottom
  const grassH = h * 0.55
  let blades = ''
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * w
    const bh = grassH * (0.3 + Math.random() * 0.7)
    const lean = (Math.random() - 0.5) * 30
    blades += `<line x1="${x}" y1="${grassH}" x2="${x + lean}" y2="${grassH - bh}"
      stroke="#22C55E" stroke-width="${4 + Math.random()*6}" opacity="${0.15 + Math.random()*0.25}" stroke-linecap="round"/>\n`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="0" y="0" width="${w}" height="${grassH}" fill="#0A2F0A"/>
  ${blades}
  <rect x="0" y="${grassH}" width="${w}" height="${h - grassH}" fill="#0D0D0D"/>
  <text x="${w*0.08}" y="${h*0.73}" font-family="${MONO}" font-size="${Math.round(w*0.028)}"
    fill="${GREEN_T}" opacity="0.5">user@dev:~$</text>
  <text x="${w*0.08}" y="${h*0.82}" font-family="${MONO}" font-size="${Math.round(w*0.055)}"
    fill="${GREEN_T}" font-weight="700">$ touch grass</text>
  <text x="${w*0.08}" y="${h*0.92}" font-family="${MONO}" font-size="${Math.round(w*0.025)}"
    fill="${GREEN_T}" opacity="0.4">\u2588</text>
</svg>`
}

// ─── 13. Not My Circus — Two-Tone Mug (2244×945) ──────────────────────────
function design_13(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.38}" font-family="${MONO}" font-size="${Math.round(h*0.13)}"
    fill="${BLACK}" text-anchor="middle">not my codebase</text>
  <text x="${w*0.5}" y="${h*0.63}" font-family="${MONO}" font-size="${Math.round(h*0.13)}"
    fill="${BLACK}" text-anchor="middle">not my bugs</text>
  <text x="${w*0.5}" y="${h*0.85}" font-family="${SANS}" font-size="${Math.round(h*0.055)}"
    fill="${GRAY}" text-anchor="middle" font-style="italic">// TODO: not my problem either</text>
</svg>`
}

// ─── 14. No Thoughts — EVA Foam shoe (2571×4886) ───────────────────────────
// Cloud AOP pattern
function design_14_shoe(w, h) {
  let clouds = ''
  // Generate cloud-like ellipses
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * w
    const cy = Math.random() * h
    const rx = 80 + Math.random() * 200
    const ry = 40 + Math.random() * 100
    clouds += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${WHITE}" opacity="${0.08 + Math.random()*0.12}"/>\n`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="${SKY}" opacity="0.7"/>
  ${clouds}
</svg>`
}

// ─── 14b. No Thoughts — EVA Foam strap (3301×594) ──────────────────────────
function design_14_strap(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="0" y="0" width="${w}" height="${h}" fill="${SKY}" opacity="0.5"/>
  <text x="${w*0.5}" y="${h*0.65}" font-family="${SANS}" font-size="${Math.round(h*0.35)}"
    fill="${WHITE}" font-weight="300" text-anchor="middle" letter-spacing="${Math.round(w*0.005)}" opacity="0.7">no thoughts</text>
</svg>`
}

// ─── 15. Accept All — Tee (3600×4800) ──────────────────────────────────────
function design_15(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.38}" font-family="${SANS}" font-size="${Math.round(w*0.3)}"
    fill="${WHITE}" font-weight="200" text-anchor="middle">\u2713</text>
  <text x="${w*0.5}" y="${h*0.55}" font-family="${FUTURA}" font-size="${Math.round(w*0.1)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.008)}">ACCEPT ALL</text>
</svg>`
}

// ─── 16. Open Sorcery — Tee (3600×4800) ────────────────────────────────────
function design_16(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.40}" font-family="${SERIF}" font-size="${Math.round(w*0.1)}"
    fill="${WHITE}" font-weight="700" text-anchor="middle" letter-spacing="${Math.round(w*0.006)}">OPEN SORCERY</text>
  <text x="${w*0.5}" y="${h*0.50}" font-family="${SERIF}" font-size="${Math.round(w*0.06)}"
    fill="${GRAY}" text-anchor="middle">\u2726</text>
</svg>`
}

// ─── 17. Hallucination — Hoodie (2835×1890) ────────────────────────────────
// Glitch effect: multiple offset text layers
function design_17(w, h) {
  const cx = w / 2
  const mainY = h * 0.45
  const fs = Math.round(w * 0.09)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- Glitch layers -->
  <text x="${cx - 8}" y="${mainY - 4}" font-family="${FUTURA}" font-size="${fs}"
    fill="#FF0040" font-weight="900" text-anchor="middle" letter-spacing="3" opacity="0.4">HALLUCINATION</text>
  <text x="${cx + 6}" y="${mainY + 4}" font-family="${FUTURA}" font-size="${fs}"
    fill="#00D4FF" font-weight="900" text-anchor="middle" letter-spacing="3" opacity="0.4">HALLUCINATION</text>
  <!-- Main text -->
  <text x="${cx}" y="${mainY}" font-family="${FUTURA}" font-size="${fs}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="3">HALLUCINATION</text>
  <!-- Subtitle -->
  <text x="${cx}" y="${h*0.62}" font-family="${MONO}" font-size="${Math.round(w*0.025)}"
    fill="${GRAY}" text-anchor="middle">"it's a feature, not a bug"</text>
</svg>`
}

// ─── 18. Works on My Prompt — Mug (2244×945) ──────────────────────────────
function design_18(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.08}" y="${h*0.35}" font-family="${MONO}" font-size="${Math.round(h*0.10)}"
    fill="${GREEN_T}" opacity="0.5">$ run model.py</text>
  <text x="${w*0.08}" y="${h*0.60}" font-family="${MONO}" font-size="${Math.round(h*0.12)}"
    fill="${GREEN_T}" font-weight="700">&gt; works on my prompt \u2713</text>
  <text x="${w*0.08}" y="${h*0.82}" font-family="${MONO}" font-size="${Math.round(h*0.07)}"
    fill="${GREEN_T}" opacity="0.3">\u2588</text>
</svg>`
}

// ─── 19. Token Limit — Tumbler wrap (2776×2374) ────────────────────────────
function design_19(w, h) {
  // Retro fuel gauge
  const gaugeX = w * 0.2
  const gaugeW = w * 0.6
  const gaugeY = h * 0.52
  const gaugeH = h * 0.06
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.5}" y="${h*0.30}" font-family="${FUTURA}" font-size="${Math.round(w*0.09)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.005)}">OUT OF</text>
  <text x="${w*0.5}" y="${h*0.44}" font-family="${FUTURA}" font-size="${Math.round(w*0.09)}"
    fill="${WHITE}" font-weight="900" text-anchor="middle" letter-spacing="${Math.round(w*0.005)}">TOKENS</text>
  <!-- Gauge background -->
  <rect x="${gaugeX}" y="${gaugeY}" width="${gaugeW}" height="${gaugeH}" rx="${gaugeH/2}" fill="${GRAY_D}" opacity="0.5"/>
  <!-- Gauge fill (almost empty) -->
  <rect x="${gaugeX}" y="${gaugeY}" width="${gaugeW*0.05}" height="${gaugeH}" rx="${gaugeH/2}" fill="${RED}"/>
  <!-- Gauge labels -->
  <text x="${gaugeX}" y="${gaugeY + gaugeH + h*0.04}" font-family="${MONO}" font-size="${Math.round(w*0.02)}"
    fill="${GRAY}">E</text>
  <text x="${gaugeX + gaugeW}" y="${gaugeY + gaugeH + h*0.04}" font-family="${MONO}" font-size="${Math.round(w*0.02)}"
    fill="${GRAY}" text-anchor="end">F</text>
  <text x="${w*0.5}" y="${h*0.78}" font-family="${MONO}" font-size="${Math.round(w*0.022)}"
    fill="${GRAY}" text-anchor="middle">context_length: 200,000 / 200,000</text>
</svg>`
}

// ─── 20. Context Window — Mouse Pad (2894×2421) ───────────────────────────
// Text that overflows the canvas (meta-humor)
function design_20(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w*0.06}" y="${h*0.35}" font-family="${MONO}" font-size="${Math.round(w*0.025)}"
    fill="${GRAY}" opacity="0.4">error: maximum context length exceeded</text>
  <text x="${w*0.06}" y="${h*0.50}" font-family="${MONO}" font-size="${Math.round(w*0.065)}"
    fill="${WHITE}" font-weight="700">CONTEXT WINDOW</text>
  <text x="${w*0.06}" y="${h*0.65}" font-family="${MONO}" font-size="${Math.round(w*0.065)}"
    fill="${WHITE}" font-weight="700">EXCEEDED \u2192 \u2192 \u2192 \u2192</text>
  <text x="${w*0.06}" y="${h*0.80}" font-family="${MONO}" font-size="${Math.round(w*0.02)}"
    fill="${GRAY}" opacity="0.4">tokens_used: 200,001 | max_tokens: 200,000 | overflow: 1</text>
</svg>`
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const PRODUCTS = [
  // ─── BRANDED SKAPARA (1-7) ────────────────────────────────────────────────
  {
    name: '01-skapara-noir-mug',
    title: 'SKAPARA Noir \u2014 Standard Mug',
    blueprintId: 1016, providerId: 26, priceCents: 1699,
    colorFilter: [],
    category: 'mugs',
    tags: ['mug', 'skapara', 'brand', 'minimal', 'ceramic', '11oz'],
    desc: {
      en: 'The SKAPARA Noir mug. Minimal S mark and wordmark on premium white ceramic. 11oz, dishwasher safe.',
      es: 'La taza SKAPARA Noir. Marca S minimalista sobre cer\u00E1mica blanca premium. 11oz, apta lavavajillas.',
      de: 'Die SKAPARA Noir Tasse. Minimales S-Logo auf wei\u00DFer Premium-Keramik. 11oz, sp\u00FClmaschinenfest.',
    },
    designs: [{ position: 'front', svgFn: design_01, w: 2244, h: 945 }],
  },
  {
    name: '02-skapara-signal-bottle',
    title: 'SKAPARA Signal \u2014 Water Bottle',
    blueprintId: 854, providerId: 23, priceCents: 2999,
    colorFilter: [],
    category: 'bottles',
    tags: ['bottle', 'skapara', 'brand', 'water', 'stainless-steel'],
    desc: {
      en: 'SKAPARA Signal stainless steel water bottle. Gradient wrap design with handle lid. Multiple sizes.',
      es: 'Botella SKAPARA Signal de acero inoxidable. Dise\u00F1o envolvente con tapa asa. Varios tama\u00F1os.',
      de: 'SKAPARA Signal Edelstahl-Wasserflasche. Gradient-Wickeldesign mit Griffdeckel. Verschiedene Gr\u00F6\u00DFen.',
    },
    designs: [{ position: 'front', svgFn: design_02, w: 2759, h: 1500 }],
  },
  {
    name: '03-skapara-core-crewneck',
    title: 'SKAPARA Core \u2014 Crewneck',
    blueprintId: 457, providerId: 26, priceCents: 3999,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 'crewnecks',
    tags: ['crewneck', 'sweatshirt', 'skapara', 'brand', 'minimal'],
    desc: {
      en: 'SKAPARA Core crewneck sweatshirt. Center chest S mark, minimal brandmark. EU fulfilled.',
      es: 'Sudadera SKAPARA Core cuello redondo. Marca S centrada en pecho, minimal. Env\u00EDo desde EU.',
      de: 'SKAPARA Core Rundhals-Sweatshirt. S-Logo zentriert auf der Brust, minimal. EU-Versand.',
    },
    designs: [{ position: 'front', svgFn: design_03, w: 3366, h: 4230 }],
  },
  {
    name: '04-skapara-edge-longsleeve',
    title: 'SKAPARA Edge \u2014 Long Sleeve',
    blueprintId: 879, providerId: 217, priceCents: 2999,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 'long-sleeves',
    tags: ['longsleeve', 'skapara', 'brand', 'minimal', 'edge'],
    desc: {
      en: 'SKAPARA Edge long sleeve. Left chest S logo with wordmark. Clean streetwear aesthetic.',
      es: 'Camiseta manga larga SKAPARA Edge. Logo S pecho izquierdo. Est\u00E9tica streetwear limpia.',
      de: 'SKAPARA Edge Langarmshirt. S-Logo links auf der Brust. Saubere Streetwear-\u00C4sthetik.',
    },
    designs: [{ position: 'front', svgFn: design_04, w: 2752, h: 3142 }],
  },
  {
    name: '05-skapara-grip-deskmat',
    title: 'SKAPARA Grip \u2014 Desk Mat',
    blueprintId: 969, providerId: 90, priceCents: 3499,
    colorFilter: [],
    category: 'desk-mats',
    tags: ['deskmat', 'mousepad', 'skapara', 'brand', 'gaming', 'office'],
    desc: {
      en: 'SKAPARA Grip gaming desk mat. Tonal S-mark pattern grid. Ultra-wide, non-slip rubber base.',
      es: 'Alfombrilla gaming SKAPARA Grip. Patr\u00F3n tonal de marcas S. Ultra-ancha, base antideslizante.',
      de: 'SKAPARA Grip Gaming-Schreibtischunterlage. Tonales S-Muster. Extrabreit, rutschfeste Gummibasis.',
    },
    designs: [{ position: 'front', svgFn: design_05, w: 7205, h: 3661 }],
  },
  {
    name: '06-skapara-step-sneaker',
    title: 'SKAPARA Step \u2014 Low Top Sneaker',
    blueprintId: 767, providerId: 90, priceCents: 5499,
    colorFilter: [],
    category: 'sneakers',
    tags: ['sneaker', 'shoes', 'skapara', 'brand', 'lowtop', 'streetwear'],
    desc: {
      en: 'SKAPARA Step low top sneakers. S logo on outer panels, SKAPARA on tongue. Lace-up canvas.',
      es: 'Zapatillas SKAPARA Step low top. Logo S en paneles exteriores, SKAPARA en leng\u00FCeta. Canvas con cordones.',
      de: 'SKAPARA Step Low-Top-Sneaker. S-Logo auf Au\u00DFenpanels, SKAPARA auf der Zunge. Canvas mit Schn\u00FCrung.',
    },
    designs: [
      { position: 'body_outside_left', svgFn: design_06_body, w: 1434, h: 650 },
      { position: 'body_outside_right', svgFn: design_06_body, w: 1433, h: 649 },
      { position: 'tongue_left', svgFn: design_06_tongue, w: 945, h: 1220 },
      { position: 'tongue_right', svgFn: design_06_tongue, w: 945, h: 1220 },
    ],
  },
  {
    name: '07-skapara-pack-sticker',
    title: 'SKAPARA Pack \u2014 Sticker',
    blueprintId: 794, providerId: 73, priceCents: 699,
    colorFilter: [],
    category: 'stickers',
    tags: ['sticker', 'skapara', 'brand', 'logo', 'decal'],
    desc: {
      en: 'SKAPARA brand sticker. Bold S mark on black background. Premium vinyl, weather resistant.',
      es: 'Sticker de marca SKAPARA. Marca S en fondo negro. Vinilo premium, resistente al agua.',
      de: 'SKAPARA Marken-Sticker. S-Logo auf schwarzem Hintergrund. Premium-Vinyl, wetterfest.',
    },
    designs: [{ position: 'front', svgFn: design_07, w: 600, h: 600 }],
  },

  // ─── TRENDING / STREETWEAR (8-14) ─────────────────────────────────────────
  {
    name: '08-zen-mode-ziphoodie',
    title: 'Zen Mode \u2014 Zip-Up Hoodie',
    blueprintId: 455, providerId: 26, priceCents: 4999,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 'zip-hoodies',
    tags: ['hoodie', 'zipup', 'zen', 'minimal', 'streetwear', 'trending'],
    desc: {
      en: 'Zen Mode zip-up hoodie. Bold typography, infinite symbol. When you need the world to know you\'re unbothered.',
      es: 'Sudadera con cremallera Zen Mode. Tipograf\u00EDa bold, s\u00EDmbolo infinito. Para cuando necesitas que el mundo sepa que no te afecta.',
      de: 'Zen Mode Kapuzenjacke. Markante Typografie, Unendlichkeitssymbol. Wenn die Welt wissen soll, dass dich nichts st\u00F6rt.',
    },
    designs: [{ position: 'front', svgFn: design_08, w: 2776, h: 2285 }],
  },
  {
    name: '09-main-character-longsleeve',
    title: 'Main Character \u2014 Long Sleeve',
    blueprintId: 879, providerId: 217, priceCents: 2999,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 'long-sleeves',
    tags: ['longsleeve', 'maincharacter', 'streetwear', 'trending', 'backprint'],
    desc: {
      en: 'Main Character long sleeve tee. Bold back print statement. Season One. You\'re not an NPC.',
      es: 'Camiseta manga larga Main Character. Estampado trasero contundente. Temporada Uno. No eres un NPC.',
      de: 'Main Character Langarmshirt. Gro\u00DFer R\u00FCckendruck. Season One. Du bist kein NPC.',
    },
    designs: [{ position: 'front', svgFn: design_09, w: 2752, h: 3142 }],
  },
  {
    name: '10-overthinking-crewneck',
    title: 'Overthinking \u2014 Crewneck',
    blueprintId: 49, providerId: 26, priceCents: 3999,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 'crewnecks',
    tags: ['crewneck', 'overthinking', 'progress-bar', 'anxiety', 'meme', 'trending'],
    desc: {
      en: 'Overthinking crewneck. Progress bar stuck at 99%. The infinite loading state of your brain.',
      es: 'Sudadera Overthinking. Barra de progreso atascada al 99%. El estado de carga infinito de tu cerebro.',
      de: 'Overthinking Sweatshirt. Fortschrittsbalken h\u00E4ngt bei 99%. Der endlose Ladezustand deines Gehirns.',
    },
    designs: [{ position: 'front', svgFn: design_10, w: 4091, h: 4624 }],
  },
  {
    name: '11-npc-energy-tumbler',
    title: 'NPC Energy \u2014 Tumbler',
    blueprintId: 1927, providerId: 410, priceCents: 3199,
    colorFilter: [],
    category: 'tumblers',
    tags: ['tumbler', 'npc', 'energy-drink', 'meme', 'gaming', 'trending'],
    desc: {
      en: 'NPC Energy tumbler. Fake energy drink can design. 0% Motivation, 100% Side Quest. Stainless steel 20oz.',
      es: 'Vaso NPC Energy. Dise\u00F1o de lata de bebida energ\u00E9tica falsa. 0% Motivaci\u00F3n, 100% Misi\u00F3n Secundaria. Acero 20oz.',
      de: 'NPC Energy Thermobecher. Fake-Energy-Drink-Design. 0% Motivation, 100% Nebenquest. Edelstahl 20oz.',
    },
    designs: [{ position: 'front', svgFn: design_11, w: 2776, h: 2374 }],
  },
  {
    name: '12-touch-grass-mousepad',
    title: 'Touch Grass \u2014 Mouse Pad',
    blueprintId: 442, providerId: 30, priceCents: 1999,
    colorFilter: [],
    category: 'mouse-pads',
    tags: ['mousepad', 'touch-grass', 'terminal', 'developer', 'meme', 'trending'],
    desc: {
      en: 'Touch Grass mouse pad. Grass pattern meets terminal command. A daily reminder to go outside.',
      es: 'Alfombrilla Touch Grass. Patr\u00F3n de hierba + comando terminal. Un recordatorio diario para salir.',
      de: 'Touch Grass Mauspad. Grasmuster trifft Terminal-Befehl. T\u00E4gliche Erinnerung rauszugehen.',
    },
    designs: [{ position: 'front', svgFn: design_12, w: 2894, h: 2421 }],
  },
  {
    name: '13-not-my-circus-mug',
    title: 'Not My Circus \u2014 Two-Tone Mug',
    blueprintId: 1018, providerId: 26, priceCents: 1699,
    colorFilter: ['Black', 'Red', 'Blue'],
    category: 'mugs',
    tags: ['mug', 'two-tone', 'developer', 'codebase', 'bugs', 'humor', 'trending'],
    desc: {
      en: 'Not my codebase, not my bugs. Two-tone ceramic mug with colored handle and rim. 11oz.',
      es: 'No es mi c\u00F3digo, no son mis bugs. Taza cer\u00E1mica bicolor con asa y borde de color. 11oz.',
      de: 'Nicht meine Codebase, nicht meine Bugs. Zweifarbige Keramiktasse mit farbigem Griff. 11oz.',
    },
    designs: [{ position: 'front', svgFn: design_13, w: 2244, h: 945 }],
  },
  {
    name: '14-no-thoughts-shoes',
    title: 'No Thoughts \u2014 EVA Foam Shoes',
    blueprintId: 1470, providerId: 90, priceCents: 4999,
    colorFilter: [],
    category: 'sneakers',
    tags: ['shoes', 'eva', 'foam', 'clouds', 'vibes', 'aop', 'trending', 'unisex'],
    desc: {
      en: 'No Thoughts, Just Vibes. Cloud pattern EVA foam shoes. All-over print, unisex sizing. Walk on clouds.',
      es: 'Sin Pensamientos, Solo Vibes. Zapatos EVA foam con patr\u00F3n de nubes. Impresi\u00F3n total, tallas unisex.',
      de: 'Keine Gedanken, Nur Vibes. Wolkenmuster EVA-Schaumschuhe. Ganzfl\u00E4chendruck, Unisex-Gr\u00F6\u00DFen.',
    },
    designs: [
      { position: 'left_shoe', svgFn: design_14_shoe, w: 2571, h: 4886 },
      { position: 'right_shoe', svgFn: design_14_shoe, w: 2571, h: 4886 },
      { position: 'left_shoe_strap', svgFn: design_14_strap, w: 3301, h: 594 },
      { position: 'right_shoe_strap', svgFn: design_14_strap, w: 3301, h: 594 },
    ],
  },

  // ─── HUMOR TECH / AI (15-20) ──────────────────────────────────────────────
  {
    name: '15-accept-all-tee',
    title: 'Accept All \u2014 Premium Tee',
    blueprintId: 6, providerId: 27, priceCents: 2499,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 't-shirts',
    tags: ['tshirt', 'accept-all', 'vibe-coding', 'ai', 'developer', 'meme', '2026'],
    desc: {
      en: 'Accept All. The universal response to every AI suggestion. Giant checkmark, zero hesitation.',
      es: 'Aceptar Todo. La respuesta universal a cada sugerencia de IA. Checkmark gigante, cero dudas.',
      de: 'Alles akzeptieren. Die universelle Antwort auf jeden KI-Vorschlag. Riesiges H\u00E4kchen, null Z\u00F6gern.',
    },
    designs: [{ position: 'front', svgFn: design_15, w: 3600, h: 4800 }],
  },
  {
    name: '16-open-sorcery-tee',
    title: 'Open Sorcery \u2014 Premium Tee',
    blueprintId: 6, providerId: 27, priceCents: 2499,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 't-shirts',
    tags: ['tshirt', 'open-sorcery', 'open-source', 'ai', 'magic', 'wordplay', '2026'],
    desc: {
      en: 'Open Sorcery. When open source meets dark arts. Elegant serif typography with decorative star.',
      es: 'Open Sorcery. Cuando el c\u00F3digo abierto conoce las artes oscuras. Tipograf\u00EDa serif elegante.',
      de: 'Open Sorcery. Wenn Open Source auf dunkle K\u00FCnste trifft. Elegante Serif-Typografie.',
    },
    designs: [{ position: 'front', svgFn: design_16, w: 3600, h: 4800 }],
  },
  {
    name: '17-hallucination-hoodie',
    title: 'Hallucination \u2014 Pullover Hoodie',
    blueprintId: 77, providerId: 27, priceCents: 4499,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 'pullover-hoodies',
    tags: ['hoodie', 'pullover', 'hallucination', 'ai', 'glitch', 'developer', '2026'],
    desc: {
      en: 'Hallucination hoodie. Glitch-effect typography. "It\'s a feature, not a bug." Every AI developer\'s mantra.',
      es: 'Sudadera Hallucination. Tipograf\u00EDa efecto glitch. "Es una feature, no un bug." El mantra de todo dev de IA.',
      de: 'Hallucination Hoodie. Glitch-Effekt-Typografie. "Es ist ein Feature, kein Bug." Das Mantra jedes KI-Entwicklers.',
    },
    designs: [{ position: 'front', svgFn: design_17, w: 2835, h: 1890 }],
  },
  {
    name: '18-works-on-my-prompt-mug',
    title: 'Works on My Prompt \u2014 Mug',
    blueprintId: 1016, providerId: 26, priceCents: 1699,
    colorFilter: [],
    category: 'mugs',
    tags: ['mug', 'works-on-my-prompt', 'terminal', 'developer', 'ai', 'humor', '2026'],
    desc: {
      en: 'Works on My Prompt. Terminal-style design. The AI-era twist on "works on my machine." 11oz ceramic.',
      es: 'Works on My Prompt. Dise\u00F1o estilo terminal. El giro de la era IA de "funciona en mi m\u00E1quina." 11oz.',
      de: 'Works on My Prompt. Terminal-Design. Die KI-Version von "funktioniert auf meinem Rechner." 11oz.',
    },
    designs: [{ position: 'front', svgFn: design_18, w: 2244, h: 945 }],
  },
  {
    name: '19-token-limit-tumbler',
    title: 'Token Limit \u2014 Tumbler',
    blueprintId: 1927, providerId: 410, priceCents: 3499,
    colorFilter: [],
    category: 'tumblers',
    tags: ['tumbler', 'token-limit', 'ai', 'llm', 'context-window', 'developer', '2026'],
    desc: {
      en: 'Out of Tokens tumbler. Retro fuel gauge at empty. When your context window hits the wall. 20oz stainless steel.',
      es: 'Vaso Out of Tokens. Medidor retro vac\u00EDo. Cuando tu ventana de contexto se estrella. Acero 20oz.',
      de: 'Out of Tokens Thermobecher. Retro-Tankanzeige auf leer. Wenn dein Kontextfenster ans Limit kommt. 20oz Edelstahl.',
    },
    designs: [{ position: 'front', svgFn: design_19, w: 2776, h: 2374 }],
  },
  {
    name: '20-context-window-mousepad',
    title: 'Context Window \u2014 Mouse Pad',
    blueprintId: 442, providerId: 30, priceCents: 1999,
    colorFilter: [],
    category: 'mouse-pads',
    tags: ['mousepad', 'context-window', 'overflow', 'ai', 'llm', 'developer', 'humor', '2026'],
    desc: {
      en: 'Context Window Exceeded. The text literally overflows the pad. Meta-humor for LLM enthusiasts.',
      es: 'Context Window Exceeded. El texto literalmente se sale del pad. Meta-humor para entusiastas de LLMs.',
      de: 'Context Window Exceeded. Der Text l\u00E4uft buchst\u00E4blich \u00FCber das Pad hinaus. Meta-Humor f\u00FCr LLM-Fans.',
    },
    designs: [{ position: 'front', svgFn: design_20, w: 2894, h: 2421 }],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

async function renderAll() {
  console.log('='.repeat(60))
  console.log('  SKAPARA \u2014 20 New Products \u2014 Design Preview')
  console.log('='.repeat(60) + '\n')

  const productBuffers = []

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`  [${idx+1}/20] ${product.title}`)
    const designBuffers = []

    for (const design of product.designs) {
      try {
        const svg = design.svgFn(design.w, design.h)
        const buffer = await sharp(Buffer.from(svg))
          .resize(design.w, design.h)
          .ensureAlpha()
          .png()
          .toBuffer()

        // Save full-res transparent PNG
        const suffix = product.designs.length > 1 ? `-${design.position}` : ''
        const outPath = join(OUT_DIR, `${product.name}${suffix}.png`)
        await sharp(buffer).toFile(outPath)

        // Save dark-bg preview (800px wide)
        const previewW = 800
        const previewH = Math.round(previewW * (design.h / design.w))
        const darkBg = await sharp({
          create: { width: previewW, height: previewH, channels: 4,
            background: { r: 28, g: 28, b: 28, alpha: 255 } }
        }).png().toBuffer()

        const smallBuf = await sharp(buffer)
          .resize(previewW, previewH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png().toBuffer()

        const previewPath = join(OUT_DIR, `${product.name}${suffix}-preview.png`)
        await sharp(darkBg)
          .composite([{ input: smallBuf, left: 0, top: 0 }])
          .png().toFile(previewPath)

        const meta = await sharp(outPath).metadata()
        const fsize = readFileSync(outPath).length
        console.log(`    \u2713 ${design.position}: ${meta.width}\u00D7${meta.height}, ${Math.round(fsize/1024)}KB`)

        designBuffers.push({ position: design.position, buffer })
      } catch (err) {
        console.error(`    \u2717 ${design.position}: ${err.message}`)
        designBuffers.push({ position: design.position, buffer: null })
      }
    }

    productBuffers.push(designBuffers)
  }

  console.log(`\n  Previews saved to: ${OUT_DIR}\n`)
  return productBuffers
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRINTIFY + SUPABASE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

async function createProducts(allBuffers) {
  console.log('='.repeat(60))
  console.log('  Creating 20 products on Printify + Supabase')
  console.log('='.repeat(60) + '\n')

  for (const [idx, product] of PRODUCTS.entries()) {
    const buffers = allBuffers[idx]
    if (!buffers || buffers.some(b => !b.buffer)) {
      console.error(`  [${idx+1}/20] Skipping ${product.title} \u2014 missing design buffer`)
      continue
    }

    console.log(`  [${idx+1}/20] ${product.title}`)

    // 1. Upload images
    const uploadIds = {}
    for (const { position, buffer } of buffers) {
      await delay(2000)
      const upload = await api('/uploads/images.json', {
        method: 'POST',
        body: JSON.stringify({
          file_name: `skapara-${product.name}-${position}.png`,
          contents: buffer.toString('base64'),
        }),
      })
      uploadIds[position] = upload.id
      console.log(`    Upload (${position}): ${upload.id}`)
    }

    // 2. Get variants
    await delay(2000)
    const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
    const allVariants = varRes.variants || []
    let selected = allVariants

    if (product.colorFilter.length > 0) {
      selected = allVariants.filter(v => {
        const c = (v.options?.color || v.title || '').toLowerCase()
        return product.colorFilter.some(f => c.includes(f.toLowerCase()))
      })
      if (!selected.length) selected = allVariants
    }

    const colors = [...new Set(selected.map(v => v.options?.color || v.title || '?'))]
    console.log(`    ${colors.length} colors, ${selected.length} variants`)

    // 3. Build print_areas — deduplicate upload IDs for shared images
    const uniqueUploads = [...new Set(Object.values(uploadIds))]
    const placeholders = []
    for (const { position } of buffers) {
      placeholders.push({
        position,
        images: [{
          id: uploadIds[position],
          x: 0.5, y: 0.5, scale: 1, angle: 0,
        }],
      })
    }

    // 4. Create product on Printify
    await delay(2000)
    const prod = await api(`/shops/${SHOP_ID}/products.json`, {
      method: 'POST',
      body: JSON.stringify({
        title: product.title,
        description: product.desc.en,
        blueprint_id: product.blueprintId,
        print_provider_id: product.providerId,
        variants: selected.map(v => ({ id: v.id, price: product.priceCents, is_enabled: true })),
        print_areas: [{
          variant_ids: selected.map(v => v.id),
          placeholders,
        }],
        tags: product.tags,
      }),
    })
    console.log(`    Printify: ${prod.id}`)

    // 5. Publish
    await delay(1500)
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
      method: 'POST',
      body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    })

    // 6. Insert in Supabase
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', product.category).single()
    const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
      title: product.title,
      description: product.desc.en,
      printify_id: prod.id,
      blueprint_id: product.blueprintId,
      print_provider_id: product.providerId,
      category_id: cat?.id,
      category: product.category,
      status: 'active',
      currency: 'EUR',
      base_price_cents: product.priceCents,
      tags: product.tags,
      published_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      translations: {
        es: { title: product.title, description: product.desc.es },
        de: { title: product.title, description: product.desc.de },
      },
    }).select('id').single()

    if (dbErr) { console.error(`    DB: ${dbErr.message}`); continue }
    console.log(`    Supabase: ${dbProd.id}`)

    // 7. Notify publishing succeeded
    try {
      await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
        method: 'POST',
        body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } }),
      })
    } catch {}

    // 8. Insert variants
    const SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|S\/M|L\/XL|One\s*size|\d+oz|US\s*\d+|EU\s*\d+)/i
    for (const sv of selected) {
      const parts = sv.title.split(' / ').map(p => p.trim())
      let color = null, size = null
      if (parts.length >= 3) {
        const last = parts[parts.length - 1]
        if (SIZE_RE.test(last)) { color = parts.slice(0, -1).join(' / '); size = last }
        else { color = parts[0]; size = parts[1] }
      } else if (parts.length === 2) {
        if (SIZE_RE.test(parts[0])) { size = parts[0]; color = parts[1] }
        else { color = parts[0]; size = parts[1] }
      } else {
        color = parts[0] || 'Default'
        size = 'One size'
      }
      await supabase.from('product_variants').upsert({
        product_id: dbProd.id,
        printify_variant_id: String(sv.id),
        title: sv.title,
        color: color || sv.options?.color || 'Default',
        size: size || sv.options?.size || 'One size',
        price_cents: product.priceCents,
        is_enabled: true,
        is_available: true,
      }, { onConflict: 'product_id,printify_variant_id' })
    }

    // 9. Harvest mockup images (wait for Printify to generate)
    await delay(5000)
    try {
      const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
      const imgs = (details?.images || [])
        .filter(i => !i.src?.includes('size-chart'))
        .slice(0, 6)
        .map(i => i.src)
      if (imgs.length) {
        await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
        console.log(`    ${imgs.length} mockups`)
      } else {
        console.log(`    No mockups yet (may need re-sync)`)
      }
    } catch {}

    console.log(`    DONE\n`)
  }

  console.log('='.repeat(60))
  console.log('  ALL 20 PRODUCTS CREATED')
  console.log('='.repeat(60))
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const buffers = await renderAll()
  if (PREVIEW) {
    console.log('  *** PREVIEW MODE \u2014 No products created ***\n')
    return
  }
  await createProducts(buffers)
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
