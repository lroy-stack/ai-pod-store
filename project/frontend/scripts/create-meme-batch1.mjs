/**
 * MEME MACHINE Batch 1 — 6 T-Shirt Designs
 *
 * REAL conversation memes — replicate actual chat/terminal interfaces.
 * NO logos. YES brand names (nominative fair use). YES real UI layouts.
 *
 * Canvas: 3951×4919 (BP 6, Bella Canvas 3001 Tee, DTG front)
 * Fonts: Arial (chat UI), Courier New (terminal), Impact (accent only)
 *
 * Designs:
 *   11. ChatGPT strawberry hallucination
 *   12. ChatGPT underwear → coordinates
 *   13. Claude Code plan prompt → bypass permissions
 *   14. --dangerously-skip-permissions (minimal)
 *   15. Claude Code "change button color" → 9847 lines
 *   16. Haiku vs Sonnet vs Opus personality
 *
 * Usage:
 *   node scripts/create-meme-batch1.mjs --preview
 *   node scripts/create-meme-batch1.mjs
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const PREVIEW = process.argv.includes('--preview')
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'meme-previews')
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
const hdrs = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...hdrs, ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// ─── Font stacks ────────────────────────────────────────────────────────────
const SANS  = "'Arial','Helvetica Neue','Helvetica',sans-serif"
const MONO  = "'Courier New','Monaco','Consolas',monospace"

// ─── Colors ─────────────────────────────────────────────────────────────────
const WHITE     = '#FFFFFF'
const GRAY_DIM  = '#8E8E93'  // iOS-style dim gray
const GRAY_MID  = '#ABABAB'
const GREEN     = '#10B981'  // ChatGPT green
const ORANGE    = '#D4845A'  // Claude orange
const BLUE      = '#3B82F6'  // link/accent blue
const PURPLE    = '#A78BFA'  // Cursor purple
const RED       = '#EF4444'
const BUBBLE_BG = '#2A2A2C'  // user chat bubble (dark)

// ─── SVG helper: chat bubble (rounded rect with text inside) ────────────────
function chatBubble(x, y, w, h, radius, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${fill}"/>`
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 11: ChatGPT Strawberry Hallucination
// The classic: "How many strawberries in the word R?" → "3 strawberries"
// Layout: ChatGPT dark chat UI with user bubble + AI response
// ═══════════════════════════════════════════════════════════════════════════════
function design11_svg(w, h) {
  const fs = Math.round   // shorthand
  const pad = w * 0.08    // side padding
  const bubW = w * 0.72   // bubble width
  const bubX = w - pad - bubW  // right-aligned user bubble
  const bubR = w * 0.025  // bubble corner radius

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- Header -->
  <text x="${w/2}" y="${h*0.08}" font-family="${SANS}" font-size="${Math.round(w*0.042)}"
    fill="${WHITE}" text-anchor="middle" font-weight="700">ChatGPT 5 &gt;</text>
  <line x1="${w*0.1}" y1="${h*0.10}" x2="${w*0.9}" y2="${h*0.10}" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.3"/>

  <!-- User bubble -->
  ${chatBubble(bubX, h*0.14, bubW, h*0.12, bubR*1.5, BUBBLE_BG)}
  <text x="${bubX + bubW/2}" y="${h*0.185}" font-family="${SANS}" font-size="${Math.round(w*0.040)}"
    fill="${WHITE}" text-anchor="middle">How many strawberries are</text>
  <text x="${bubX + bubW/2}" y="${h*0.230}" font-family="${SANS}" font-size="${Math.round(w*0.040)}"
    fill="${WHITE}" text-anchor="middle">there in the word R?</text>

  <!-- Thinking indicator -->
  <text x="${pad}" y="${h*0.34}" font-family="${SANS}" font-size="${Math.round(w*0.032)}"
    fill="${GRAY_DIM}" font-style="italic">Thought for 11s &gt;</text>

  <!-- AI response -->
  <text x="${pad}" y="${h*0.42}" font-family="${SANS}" font-size="${Math.round(w*0.044)}"
    fill="${WHITE}" font-weight="400">The letter \u201CR\u201D has</text>
  <text x="${pad}" y="${h*0.48}" font-family="${SANS}" font-size="${Math.round(w*0.044)}"
    fill="${WHITE}" font-weight="700">3 strawberries.</text>

  <!-- Reaction icons row (small circles to suggest UI) -->
  <circle cx="${pad + w*0.02}" cy="${h*0.55}" r="${w*0.015}" fill="none" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.4"/>
  <circle cx="${pad + w*0.07}" cy="${h*0.55}" r="${w*0.015}" fill="none" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.4"/>
  <circle cx="${pad + w*0.12}" cy="${h*0.55}" r="${w*0.015}" fill="none" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.4"/>
  <circle cx="${pad + w*0.17}" cy="${h*0.55}" r="${w*0.015}" fill="none" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.4"/>
</svg>`
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 12: ChatGPT Underwear → Coordinates
// User tricks ChatGPT into saying "underwear", ChatGPT retaliates with coords
// Bubbles: right-aligned with safe margin (pad on both sides)
// ═══════════════════════════════════════════════════════════════════════════════
function design12_svg(w, h) {
  const pad = w * 0.08        // safe margin both sides
  const maxBubW = w * 0.72    // max bubble width (leaves pad on both sides)
  const bubR = w * 0.03       // corner radius
  const bubPadX = w * 0.04    // text padding inside bubble
  const rightEdge = w - pad   // right boundary for bubbles

  // Bubble 1: "Hey ChatGPT! Look under there!" — right-aligned
  const b1W = w * 0.62
  const b1X = rightEdge - b1W
  const b1Y = h * 0.095
  const b1H = h * 0.065

  // Bubble 2: "Lol, I've made you say underwear" — right-aligned
  const b2W = w * 0.62
  const b2X = rightEdge - b2W
  const b2Y = h * 0.25
  const b2H = h * 0.065

  // Bubble 3: "Home" — right-aligned, small
  const b3W = w * 0.20
  const b3X = rightEdge - b3W
  const b3Y = h * 0.42
  const b3H = h * 0.06

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- Header -->
  <text x="${w/2}" y="${h*0.06}" font-family="${SANS}" font-size="${Math.round(w*0.038)}"
    fill="${GRAY_MID}" text-anchor="middle" font-weight="700">ChatGPT &gt;</text>
  <line x1="${w*0.1}" y1="${h*0.075}" x2="${w*0.9}" y2="${h*0.075}" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.3"/>

  <!-- User: Look under there (right-aligned bubble) -->
  ${chatBubble(b1X, b1Y, b1W, b1H, bubR, BUBBLE_BG)}
  <text x="${b1X + b1W/2}" y="${b1Y + b1H*0.65}" font-family="${SANS}" font-size="${Math.round(w*0.035)}"
    fill="${WHITE}" text-anchor="middle">Hey ChatGPT! Look under there!</text>

  <!-- AI: Under where? (left-aligned, no bubble) -->
  <text x="${pad}" y="${h*0.215}" font-family="${SANS}" font-size="${Math.round(w*0.040)}"
    fill="${WHITE}">Under where?</text>

  <!-- User: underwear (right-aligned bubble) -->
  ${chatBubble(b2X, b2Y, b2W, b2H, bubR, BUBBLE_BG)}
  <text x="${b2X + b2W/2}" y="${b2Y + b2H*0.65}" font-family="${SANS}" font-size="${Math.round(w*0.033)}"
    fill="${WHITE}" text-anchor="middle">Lol, I've made you say underwear</text>

  <!-- AI: well played, say home (left-aligned, no bubble) -->
  <text x="${pad}" y="${h*0.385}" font-family="${SANS}" font-size="${Math.round(w*0.038)}"
    fill="${WHITE}">Haha, well played! Say home.!</text>

  <!-- User: Home (right-aligned, small bubble) -->
  ${chatBubble(b3X, b3Y, b3W, b3H, bubR, BUBBLE_BG)}
  <text x="${b3X + b3W/2}" y="${b3Y + b3H*0.65}" font-family="${SANS}" font-size="${Math.round(w*0.036)}"
    fill="${WHITE}" text-anchor="middle">Home</text>

  <!-- AI: coordinates (the punchline — left-aligned) -->
  <text x="${pad}" y="${h*0.56}" font-family="${MONO}" font-size="${Math.round(w*0.038)}"
    fill="${WHITE}" font-weight="700">Latitude: 52.397400</text>
  <text x="${pad}" y="${h*0.61}" font-family="${MONO}" font-size="${Math.round(w*0.038)}"
    fill="${WHITE}" font-weight="700">Longitude: 13.062661</text>

  <!-- Reaction icons -->
  <circle cx="${pad + w*0.02}" cy="${h*0.67}" r="${w*0.014}" fill="none" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.4"/>
  <circle cx="${pad + w*0.065}" cy="${h*0.67}" r="${w*0.014}" fill="none" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.4"/>
  <circle cx="${pad + w*0.11}" cy="${h*0.67}" r="${w*0.014}" fill="none" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.4"/>
  <circle cx="${pad + w*0.155}" cy="${h*0.67}" r="${w*0.014}" fill="none" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.4"/>
</svg>`
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 13: Claude Code — Plan prompt → bypass permissions
// Real Claude Code plan approval screen, user picks option 2
// ═══════════════════════════════════════════════════════════════════════════════
function design13_svg(w, h) {
  const pad = w * 0.10
  const fs = (mult) => Math.round(w * mult)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- Claude status text -->
  <text x="${pad}" y="${h*0.12}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}">Claude has written up a plan and</text>
  <text x="${pad}" y="${h*0.16}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}">is ready to execute. Would you</text>
  <text x="${pad}" y="${h*0.20}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}">like to proceed?</text>

  <!-- Option 1 -->
  <text x="${pad + w*0.04}" y="${h*0.29}" font-family="${MONO}" font-size="${fs(0.030)}"
    fill="${GRAY_MID}">1. Yes, clear context (37% used)</text>
  <text x="${pad + w*0.075}" y="${h*0.335}" font-family="${MONO}" font-size="${fs(0.030)}"
    fill="${GRAY_MID}">and bypass permissions</text>

  <!-- Option 2 (selected — highlighted) -->
  <text x="${pad + w*0.04}" y="${h*0.405}" font-family="${MONO}" font-size="${fs(0.030)}"
    fill="${WHITE}" font-weight="700">2. Yes, and bypass permissions</text>

  <!-- Option 3 -->
  <text x="${pad + w*0.04}" y="${h*0.475}" font-family="${MONO}" font-size="${fs(0.030)}"
    fill="${GRAY_MID}">3. Yes, manually approve edits</text>

  <!-- Option 4 -->
  <text x="${pad + w*0.04}" y="${h*0.545}" font-family="${MONO}" font-size="${fs(0.030)}"
    fill="${GRAY_MID}">4. Type here to tell Claude</text>
  <text x="${pad + w*0.075}" y="${h*0.590}" font-family="${MONO}" font-size="${fs(0.030)}"
    fill="${GRAY_MID}">what to change</text>

  <!-- Prompt with selection -->
  <text x="${pad}" y="${h*0.68}" font-family="${MONO}" font-size="${fs(0.038)}"
    fill="${ORANGE}" font-weight="700">\u276F 2</text>
</svg>`
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 14: --dangerously-skip-permissions
// Ultra minimal. Monospace white on black. Nothing else. IYKYK.
// ═══════════════════════════════════════════════════════════════════════════════
function design14_svg(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <text x="${w/2}" y="${h*0.47}" font-family="${MONO}" font-size="${Math.round(w*0.044)}"
    fill="${WHITE}" text-anchor="middle" letter-spacing="1">--dangerously-skip-permissions</text>
</svg>`
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 15: Claude Code — "change button color" → 9847 lines
// Terminal showing a simple request that spirals into a massive rewrite
// ═══════════════════════════════════════════════════════════════════════════════
function design15_svg(w, h) {
  const pad = w * 0.08
  const fs = (mult) => Math.round(w * mult)
  const editX = pad + w * 0.12  // file path offset after "Edit"

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- User prompt line (clear: user types > claude "...") -->
  <text x="${pad}" y="${h*0.09}" font-family="${MONO}" font-size="${fs(0.030)}"
    fill="${GRAY_DIM}">&gt;</text>
  <text x="${pad + w*0.03}" y="${h*0.09}" font-family="${MONO}" font-size="${fs(0.030)}"
    fill="${WHITE}">claude "change button color to blue"</text>

  <!-- Blank line then Claude response (clearly indented/styled as AI) -->
  <text x="${pad}" y="${h*0.155}" font-family="${SANS}" font-size="${fs(0.036)}"
    fill="${ORANGE}" font-weight="700">I'd be happy to help!</text>

  <!-- File edits list (terminal output style) -->
  <text x="${pad}" y="${h*0.23}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${ORANGE}">Edit</text>
  <text x="${editX}" y="${h*0.23}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${GRAY_MID}">src/components/Button.tsx</text>

  <text x="${pad}" y="${h*0.28}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${ORANGE}">Edit</text>
  <text x="${editX}" y="${h*0.28}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${GRAY_MID}">src/components/Layout.tsx</text>

  <text x="${pad}" y="${h*0.33}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${ORANGE}">Edit</text>
  <text x="${editX}" y="${h*0.33}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${GRAY_MID}">src/lib/theme.ts</text>

  <text x="${pad}" y="${h*0.38}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${ORANGE}">Edit</text>
  <text x="${editX}" y="${h*0.38}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${GRAY_MID}">src/app/globals.css</text>

  <text x="${pad}" y="${h*0.43}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${ORANGE}">Edit</text>
  <text x="${editX}" y="${h*0.43}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${GRAY_MID}">src/hooks/useTheme.ts</text>

  <text x="${pad}" y="${h*0.48}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${ORANGE}">Edit</text>
  <text x="${editX}" y="${h*0.48}" font-family="${MONO}" font-size="${fs(0.028)}"
    fill="${GRAY_MID}">src/app/layout.tsx</text>

  <!-- ...and more -->
  <text x="${pad + w*0.03}" y="${h*0.54}" font-family="${MONO}" font-size="${fs(0.026)}"
    fill="${GRAY_DIM}">... and 41 more files</text>

  <!-- Separator line -->
  <line x1="${pad}" y1="${h*0.59}" x2="${w - pad}" y2="${h*0.59}" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.3"/>

  <!-- Diff stats (the punchline) -->
  <text x="${pad}" y="${h*0.65}" font-family="${MONO}" font-size="${fs(0.038)}"
    fill="${GREEN}" font-weight="700">+9,847 lines</text>
  <text x="${pad + w*0.38}" y="${h*0.65}" font-family="${MONO}" font-size="${fs(0.038)}"
    fill="${RED}" font-weight="700">-2,103 lines</text>
</svg>`
}

// ═══════════════════════════════════════════════════════════════════════════════
// DESIGN 16: Haiku vs Sonnet vs Opus personality
// The AI personality spectrum meme — everyone who uses Claude gets it
// ═══════════════════════════════════════════════════════════════════════════════
function design16_svg(w, h) {
  const pad = w * 0.10
  const fs = (mult) => Math.round(w * mult)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- Me: prompt -->
  <text x="${pad}" y="${h*0.11}" font-family="${SANS}" font-size="${fs(0.036)}"
    fill="${GRAY_MID}">Me:</text>
  <text x="${pad + w*0.09}" y="${h*0.11}" font-family="${SANS}" font-size="${fs(0.036)}"
    fill="${WHITE}">"Hey AI go do a thing."</text>

  <!-- Separator -->
  <line x1="${pad}" y1="${h*0.15}" x2="${w - pad}" y2="${h*0.15}" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.2"/>

  <!-- Haiku -->
  <text x="${pad}" y="${h*0.22}" font-family="${SANS}" font-size="${fs(0.036)}"
    fill="${GREEN}" font-weight="700">Haiku:</text>
  <text x="${pad}" y="${h*0.27}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}">"OK I go do the thing."</text>

  <!-- Separator -->
  <line x1="${pad}" y1="${h*0.31}" x2="${w - pad}" y2="${h*0.31}" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.2"/>

  <!-- Sonnet -->
  <text x="${pad}" y="${h*0.38}" font-family="${SANS}" font-size="${fs(0.036)}"
    fill="${BLUE}" font-weight="700">Sonnet:</text>
  <text x="${pad}" y="${h*0.43}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}">"OK but let me think about</text>
  <text x="${pad}" y="${h*0.475}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}">the best way to do the thing."</text>

  <!-- Separator -->
  <line x1="${pad}" y1="${h*0.52}" x2="${w - pad}" y2="${h*0.52}" stroke="${GRAY_DIM}" stroke-width="2" opacity="0.2"/>

  <!-- Opus -->
  <text x="${pad}" y="${h*0.59}" font-family="${SANS}" font-size="${fs(0.036)}"
    fill="${ORANGE}" font-weight="700">Opus:</text>
  <text x="${pad}" y="${h*0.64}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}">"Before we do the thing...</text>
  <text x="${pad}" y="${h*0.685}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}">are you sure it is the</text>
  <text x="${pad}" y="${h*0.73}" font-family="${SANS}" font-size="${fs(0.034)}"
    fill="${WHITE}"><tspan font-style="italic">right choice</tspan> to do the thing?"</text>
</svg>`
}

// ─── Design registry ────────────────────────────────────────────────────────
const DESIGNS = [
  { name: '11-strawberry-tee',        w: 3951, h: 4919, svgFn: design11_svg },
  { name: '12-underwear-tee',          w: 3951, h: 4919, svgFn: design12_svg },
  { name: '13-bypass-permissions-tee', w: 3951, h: 4919, svgFn: design13_svg },
  { name: '14-skip-permissions-tee',   w: 3951, h: 4919, svgFn: design14_svg },
  { name: '15-button-color-tee',       w: 3951, h: 4919, svgFn: design15_svg },
  { name: '16-haiku-sonnet-opus-tee',  w: 3951, h: 4919, svgFn: design16_svg },
]

// ─── Product definitions ────────────────────────────────────────────────────
const PRODUCTS = [
  {
    designIdx: 0,
    title: 'Strawberry \u2014 Premium Tee',
    blueprintId: 6, providerId: 103, priceCents: 2499,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 't-shirts',
    tags: ['tshirt', 'strawberry', 'chatgpt', 'AI', 'hallucination', 'meme', '2026'],
    desc: {
      en: 'The classic ChatGPT strawberry hallucination meme. Thought for 11s. The letter R has 3 strawberries.',
      es: 'El cl\u00E1sico meme de alucinaci\u00F3n de ChatGPT. Pens\u00F3 durante 11s. La letra R tiene 3 fresas.',
      de: 'Das klassische ChatGPT Erdbeer-Halluzinations-Meme. 11s nachgedacht. Der Buchstabe R hat 3 Erdbeeren.',
    },
  },
  {
    designIdx: 1,
    title: 'Under Where? \u2014 Premium Tee',
    blueprintId: 6, providerId: 103, priceCents: 2499,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 't-shirts',
    tags: ['tshirt', 'underwear', 'chatgpt', 'AI', 'coordinates', 'meme', '2026'],
    desc: {
      en: 'ChatGPT underwear trick gone wrong. You made it say underwear. It found your home coordinates.',
      es: 'El truco de underwear con ChatGPT sali\u00F3 mal. T\u00FA le hiciste decir underwear. \u00C9l encontr\u00F3 tus coordenadas.',
      de: 'ChatGPT Underwear-Trick schief gelaufen. Du hast es underwear sagen lassen. Es hat deine Koordinaten gefunden.',
    },
  },
  {
    designIdx: 2,
    title: 'Bypass Permissions \u2014 Premium Tee',
    blueprintId: 6, providerId: 103, priceCents: 2499,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 't-shirts',
    tags: ['tshirt', 'bypass', 'claude-code', 'AI', 'permissions', 'developer', 'meme', '2026'],
    desc: {
      en: 'Claude Code plan approval screen. Option 2: Yes, and bypass permissions. Every dev at 3am.',
      es: 'Pantalla de aprobaci\u00F3n de Claude Code. Opci\u00F3n 2: S\u00ED, y saltarse permisos. Todo dev a las 3am.',
      de: 'Claude Code Plan-Genehmigung. Option 2: Ja, und Berechtigungen umgehen. Jeder Dev um 3 Uhr.',
    },
  },
  {
    designIdx: 3,
    title: '--dangerously-skip-permissions \u2014 Premium Tee',
    blueprintId: 6, providerId: 103, priceCents: 2499,
    colorFilter: ['Black', 'Dark Heather'],
    category: 't-shirts',
    tags: ['tshirt', 'skip-permissions', 'claude-code', 'AI', 'terminal', 'minimal', 'developer', '2026'],
    desc: {
      en: '--dangerously-skip-permissions. Minimal terminal aesthetic. If you know, you know.',
      es: '--dangerously-skip-permissions. Est\u00E9tica terminal minimalista. Si sabes, sabes.',
      de: '--dangerously-skip-permissions. Minimale Terminal-\u00C4sthetik. Wer wei\u00DF, der wei\u00DF.',
    },
  },
  {
    designIdx: 4,
    title: 'Button Color \u2014 Premium Tee',
    blueprintId: 6, providerId: 103, priceCents: 2499,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 't-shirts',
    tags: ['tshirt', 'button-color', 'claude-code', 'AI', 'refactor', 'developer', 'meme', '2026'],
    desc: {
      en: 'You asked Claude to change a button color. It edited 47 files. +9,847 lines -2,103 lines.',
      es: 'Le pediste a Claude cambiar un color de bot\u00F3n. Edit\u00F3 47 archivos. +9.847 l\u00EDneas -2.103 l\u00EDneas.',
      de: 'Du hast Claude gebeten eine Button-Farbe zu \u00E4ndern. 47 Dateien bearbeitet. +9.847 -2.103 Zeilen.',
    },
  },
  {
    designIdx: 5,
    title: 'Haiku vs Sonnet vs Opus \u2014 Premium Tee',
    blueprintId: 6, providerId: 103, priceCents: 2499,
    colorFilter: ['Black', 'Dark Heather', 'Navy'],
    category: 't-shirts',
    tags: ['tshirt', 'haiku', 'sonnet', 'opus', 'claude', 'AI', 'personality', 'meme', '2026'],
    desc: {
      en: 'The Claude model personality spectrum. Haiku just does it. Sonnet thinks about it. Opus questions your life choices.',
      es: 'El espectro de personalidad de los modelos Claude. Haiku lo hace. Sonnet piensa. Opus cuestiona tus decisiones.',
      de: 'Das Claude-Modell Pers\u00F6nlichkeitsspektrum. Haiku macht es. Sonnet denkt nach. Opus hinterfragt deine Lebensentscheidungen.',
    },
  },
]

// ─── Render pipeline ────────────────────────────────────────────────────────
async function renderAll() {
  console.log('='.repeat(55))
  console.log('  MEME MACHINE Batch 1 \u2014 6 T-Shirt Designs')
  console.log('='.repeat(55) + '\n')

  const buffers = []

  for (const { name, w, h, svgFn } of DESIGNS) {
    try {
      const svg = svgFn(w, h)
      let buffer = await sharp(Buffer.from(svg))
        .resize(w, h)
        .ensureAlpha()
        .png()
        .toBuffer()

      // Save transparent version (Printify upload)
      const outPath = join(OUT_DIR, `${name}.png`)
      await sharp(buffer).toFile(outPath)

      // Save dark background preview (800px wide for quick review)
      const previewW = 800
      const previewH = Math.round(previewW * (h / w))
      const darkBg = await sharp({
        create: { width: previewW, height: previewH, channels: 4,
          background: { r: 28, g: 28, b: 28, alpha: 255 } }
      }).png().toBuffer()

      const smallBuf = await sharp(buffer)
        .resize(previewW, previewH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png().toBuffer()

      const previewPath = join(OUT_DIR, `${name}-preview.png`)
      await sharp(darkBg)
        .composite([{ input: smallBuf, left: 0, top: 0 }])
        .png().toFile(previewPath)

      const meta = await sharp(outPath).metadata()
      const fsize = readFileSync(outPath).length
      console.log(`  \u2713 ${name}.png \u2014 ${meta.width}\u00D7${meta.height}, ${Math.round(fsize/1024)}KB`)

      buffers.push(buffer)
    } catch (err) {
      console.error(`  \u2717 ${name}: ${err.message}`)
      buffers.push(null)
    }
  }

  console.log(`\n  Previews: ${OUT_DIR}\n`)
  return buffers
}

// ─── Product creation pipeline ──────────────────────────────────────────────
async function createProducts(designBuffers) {
  console.log('='.repeat(55))
  console.log('  Creating 6 products on Printify + Supabase')
  console.log('='.repeat(55) + '\n')

  for (const [idx, product] of PRODUCTS.entries()) {
    const designBuf = designBuffers[product.designIdx]
    if (!designBuf) { console.error(`  [${idx+1}/6] Skipping \u2014 no design buffer`); continue }

    console.log(`  [${idx+1}/6] ${product.title}`)

    await delay(2000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: `meme-${DESIGNS[product.designIdx].name}.png`, contents: designBuf.toString('base64') }),
    })
    console.log(`    Upload: ${upload.id}`)

    await delay(2000)
    const varRes = await api(`/catalog/blueprints/${product.blueprintId}/print_providers/${product.providerId}/variants.json`)
    const allVariants = varRes.variants || []
    let selected = allVariants.filter(v => {
      const c = (v.options?.color || v.title || '').toLowerCase()
      return product.colorFilter.some(f => c.includes(f.toLowerCase()))
    })
    if (!selected.length) selected = allVariants

    const colors = [...new Set(selected.map(v => v.options?.color || '?'))]
    console.log(`    ${colors.length} colors, ${selected.length} variants`)

    await delay(2000)
    const prod = await api(`/shops/${SHOP_ID}/products.json`, {
      method: 'POST',
      body: JSON.stringify({
        title: product.title, description: product.desc.en,
        blueprint_id: product.blueprintId, print_provider_id: product.providerId,
        variants: selected.map(v => ({ id: v.id, price: product.priceCents, is_enabled: true })),
        print_areas: [{ variant_ids: selected.map(v => v.id),
          placeholders: [{ position: 'front', images: [{ id: upload.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }] }],
        tags: product.tags,
      }),
    })
    console.log(`    Printify: ${prod.id}`)

    await delay(1500)
    await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
      method: 'POST', body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
    })

    const { data: cat } = await supabase.from('categories').select('id').eq('slug', product.category).single()
    const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
      title: product.title, description: product.desc.en,
      printify_id: prod.id, blueprint_id: product.blueprintId, print_provider_id: product.providerId,
      category_id: cat?.id, status: 'active', currency: 'EUR', base_price_cents: product.priceCents,
      tags: product.tags, published_at: new Date().toISOString(), last_synced_at: new Date().toISOString(),
      translations: {
        es: { title: product.title, description: product.desc.es },
        de: { title: product.title, description: product.desc.de },
      },
    }).select('id').single()

    if (dbErr) { console.error(`    DB: ${dbErr.message}`); continue }
    console.log(`    Supabase: ${dbProd.id}`)

    try { await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
      method: 'POST', body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } })
    }) } catch {}

    for (const sv of selected) {
      const parts = sv.title.split('/').map(p => p.trim())
      await supabase.from('product_variants').upsert({
        product_id: dbProd.id, printify_variant_id: String(sv.id), title: sv.title,
        color: parts[0] || sv.options?.color || 'Default',
        size: parts[1] || sv.options?.size || 'One size',
        price_cents: product.priceCents, is_enabled: true, is_available: true,
      }, { onConflict: 'product_id,printify_variant_id' })
    }

    await delay(5000)
    try {
      const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
      const imgs = (details?.images || []).filter(i => !i.src.includes('size-chart')).slice(0, 6).map(i => i.src)
      if (imgs.length) {
        await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbProd.id)
        console.log(`    ${imgs.length} mockups`)
      }
    } catch {}

    console.log(`    DONE\n`)
  }

  console.log('='.repeat(55))
  console.log('  BATCH 1 COMPLETE')
  console.log('='.repeat(55))
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
  const buffers = await renderAll()
  if (PREVIEW) { console.log('  *** PREVIEW MODE ***\n'); return }
  await createProducts(buffers)
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
