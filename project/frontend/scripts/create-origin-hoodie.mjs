/**
 * SKAPARA "Origin" — Typographic Embroidered White Hoodie
 *
 * BP 793 (Cotton Heritage M2580) + Provider 410 (Printful Embroidery)
 *
 * Design: Modern text-based — uses ACTUAL brand SVG paths (no font dependency)
 * "2026" built from block rectangles (pixel/digital style)
 * S mark on sleeve from real logo path data
 *
 * Colors: Black (#0F172A) + Blue (#2563EB) + Coral (#EF4444)
 *
 * Usage:
 *   node scripts/create-origin-hoodie.mjs --preview
 *   node scripts/create-origin-hoodie.mjs --dry-run
 *   node scripts/create-origin-hoodie.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const PREVIEW = process.argv.includes('--preview')
const DRY_RUN = process.argv.includes('--dry-run')

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN   = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const SB_URL  = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY  = env('SUPABASE_SERVICE_KEY')

if (!PREVIEW && (!TOKEN || !SHOP_ID || !SB_URL || !SB_KEY)) {
  console.error('Missing env vars'); process.exit(1)
}

const supabase = !PREVIEW ? createClient(SB_URL, SB_KEY) : null
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function api(endpoint, opts = {}) {
  const r = await fetch(`${API}${endpoint}`, { ...opts, headers: { ...headers, ...opts.headers } })
  if (!r.ok) throw new Error(`Printify ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const ct = r.headers.get('content-type') || ''
  return ct.includes('application/json') ? r.json() : null
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const BLACK = '#0F172A'
const BLUE  = '#2563EB'
const CORAL = '#EF4444'

// ─── Brand SVG Path Data (from actual brand files) ──────────────────────────
// These are GEOMETRIC PATHS, not text — they render perfectly without fonts.

const WORDMARK_PATHS = `
    <path d="M870 2310 c-156 -12 -280 -37 -421 -84 -195 -65 -312 -141 -422 -275 l-27 -33 0 -213 c0 -180 2 -214 15 -219 8 -3 15 -10 15 -16 0 -18 82 -108 130 -143 89 -64 120 -76 330 -130 167 -43 290 -59 810 -103 303 -25 445 -58 500 -116 61 -63 75 -124 42 -185 -97 -181 -719 -226 -1207 -86 -52 15 -118 39 -146 53 -10 5 -46 21 -80 35 -35 15 -94 47 -130 71 -37 24 -71 44 -77 44 -6 0 -50 -47 -98 -105 -48 -58 -91 -105 -96 -105 -4 0 -8 -46 -8 -103 l0 -103 57 -26 c270 -124 414 -163 786 -214 178 -24 549 -21 734 5 291 42 480 107 629 216 123 91 185 193 204 338 22 165 -25 300 -144 415 -166 161 -391 232 -861 272 -60 6 -200 17 -310 25 -110 8 -216 19 -235 25 -19 5 -55 10 -80 10 -57 0 -164 35 -208 67 -74 55 -80 115 -19 177 49 48 112 72 275 101 141 25 461 23 612 -3 237 -42 381 -90 517 -173 22 -14 46 -19 74 -17 46 3 27 -21 198 257 l52 84 -23 22 c-64 61 -394 165 -683 216 -127 22 -528 33 -705 19z"/>
    <path d="M3042 2258 c-17 -17 -17 -1929 0 -1946 18 -18 501 -17 517 1 7 9 11 106 11 296 1 311 -4 286 67 334 120 83 182 128 188 137 14 23 127 90 139 83 7 -5 44 -44 83 -88 80 -90 193 -201 398 -391 77 -71 199 -187 271 -257 l132 -128 318 1 c239 0 322 4 331 13 10 10 -20 43 -145 163 -87 84 -200 189 -252 235 -52 45 -229 209 -393 363 -164 155 -316 295 -337 311 -47 36 -49 49 -12 72 15 10 50 36 78 58 29 22 93 69 144 105 82 58 274 198 558 407 53 39 137 101 186 138 129 98 133 96 -262 97 -176 0 -326 -3 -334 -8 -7 -5 -47 -34 -88 -64 -41 -31 -97 -72 -125 -92 -27 -19 -125 -88 -217 -154 -93 -65 -241 -170 -330 -232 -90 -63 -191 -135 -225 -160 -109 -83 -152 -112 -163 -112 -7 0 -10 124 -10 401 1 291 -2 405 -11 415 -16 19 -498 21 -517 2z"/>
    <path d="M6978 2241 c-24 -29 -88 -130 -121 -189 -10 -18 -45 -74 -78 -124 -33 -50 -71 -112 -86 -137 -14 -25 -57 -99 -97 -164 -39 -65 -77 -128 -84 -140 -7 -12 -62 -101 -122 -197 -59 -96 -206 -337 -326 -535 -119 -198 -228 -375 -242 -393 -45 -60 -35 -62 263 -62 l264 0 20 26 c12 15 21 30 21 35 0 7 51 93 145 244 l44 70 603 5 c332 3 612 2 623 -1 11 -4 29 -24 40 -45 38 -74 168 -289 188 -311 20 -23 23 -23 283 -23 308 0 304 -1 255 82 -18 29 -36 60 -41 68 -12 20 -282 476 -306 517 -11 18 -59 98 -109 178 -49 80 -101 165 -114 188 -13 23 -43 71 -66 107 -49 77 -189 308 -198 330 -4 8 -16 29 -27 45 -11 17 -23 37 -27 45 -4 8 -20 34 -35 56 -15 23 -28 44 -28 47 0 4 -13 25 -29 49 -16 24 -39 61 -51 83 -12 22 -30 54 -41 70 -10 17 -22 37 -25 45 -4 8 -16 25 -27 38 -20 21 -25 22 -233 22 l-212 0 -24 -29z m249 -548 c10 -29 87 -163 230 -401 74 -122 131 -227 128 -232 -9 -14 -762 -13 -770 0 -4 6 7 32 22 58 16 26 32 54 36 62 4 8 16 29 27 45 11 17 23 37 27 45 3 8 21 38 39 65 50 77 144 235 144 241 0 4 13 25 29 49 16 24 32 53 36 64 8 26 43 28 52 4z"/>
    <path d="M9093 2248 c-13 -15 -15 -122 -11 -967 3 -765 7 -952 17 -965 12 -14 47 -16 260 -16 179 0 250 3 259 12 9 9 12 85 12 280 l0 268 23 5 c12 2 245 6 517 8 538 4 560 6 760 66 183 55 297 126 386 241 76 98 105 169 125 309 18 130 1 236 -57 357 -83 171 -201 268 -411 338 -241 82 -318 87 -1176 84 -633 -3 -690 -4 -704 -20z m1512 -407 c50 -10 110 -28 135 -39 120 -53 181 -202 133 -324 -21 -55 -43 -83 -95 -123 -97 -74 -236 -89 -754 -83 -204 3 -376 8 -382 12 -9 5 -12 84 -12 281 0 250 2 275 18 284 11 7 171 10 442 10 374 0 436 -2 515 -18z"/>
    <path d="M12721 2246 c-12 -12 -68 -99 -125 -192 -57 -93 -163 -266 -235 -384 -73 -118 -154 -249 -181 -290 -27 -41 -114 -183 -193 -315 -190 -314 -186 -308 -194 -325 -3 -8 -25 -44 -48 -80 -23 -36 -63 -101 -90 -145 -26 -44 -65 -105 -86 -136 -28 -42 -35 -59 -26 -68 8 -8 92 -11 279 -11 l268 0 27 43 c39 60 45 70 71 119 13 23 49 81 80 128 l57 85 155 7 c85 5 361 7 613 5 l458 -2 31 -55 c16 -30 45 -77 63 -105 18 -27 41 -66 51 -85 28 -51 55 -92 78 -117 19 -23 22 -23 287 -23 221 0 269 2 279 15 6 8 8 20 4 27 -4 7 -26 42 -49 78 -23 36 -45 72 -48 80 -4 8 -16 29 -27 45 -11 17 -24 39 -29 50 -5 11 -38 66 -73 123 -35 56 -135 220 -222 365 -88 144 -178 291 -200 327 -23 36 -47 74 -53 85 -40 63 -144 237 -167 280 -54 97 -273 452 -295 479 -12 14 -41 16 -225 16 -210 0 -213 0 -235 -24z m251 -563 c12 -27 33 -64 46 -83 13 -19 28 -44 32 -55 4 -11 59 -105 122 -210 63 -104 117 -197 121 -205 4 -8 14 -26 22 -39 7 -14 11 -29 8 -34 -8 -13 -764 -6 -769 7 -3 7 27 65 66 129 38 65 70 120 70 122 0 6 91 157 105 175 7 8 27 42 45 75 18 33 39 67 46 76 8 8 14 19 14 23 0 9 39 66 46 66 2 0 14 -21 26 -47z"/>
    <path d="M14844 2249 c-13 -15 -15 -137 -12 -966 2 -787 5 -953 17 -966 12 -15 43 -17 260 -17 179 0 250 3 259 12 9 9 12 71 12 217 0 114 3 250 7 304 l6 97 347 0 348 0 58 -67 c117 -135 310 -350 407 -456 l100 -107 312 0 c358 0 361 1 294 66 -66 63 -589 612 -589 617 0 3 26 13 58 22 136 38 286 127 369 219 95 105 141 255 129 422 -9 132 -35 202 -120 317 -102 139 -253 221 -496 271 -164 34 -278 37 -1019 34 -664 -3 -734 -5 -747 -19z m1589 -405 c141 -32 201 -83 227 -193 26 -112 -30 -220 -145 -278 -48 -25 -58 -26 -310 -34 -302 -9 -805 -12 -812 -5 -7 6 -4 507 3 518 3 4 221 8 485 8 407 0 491 -2 552 -16z"/>
    <path d="M18838 2243 c-26 -28 -67 -90 -101 -152 -10 -19 -31 -52 -45 -75 -15 -23 -31 -49 -37 -58 -70 -118 -195 -318 -260 -418 -91 -140 -99 -152 -228 -368 -51 -85 -99 -165 -107 -177 -8 -13 -42 -67 -75 -120 -33 -53 -67 -107 -75 -120 -8 -13 -70 -115 -138 -226 -97 -159 -120 -204 -111 -215 9 -11 62 -14 268 -14 305 0 261 -20 374 173 11 18 44 71 75 120 l56 87 617 0 617 0 42 -72 c24 -40 48 -81 54 -92 6 -12 23 -39 37 -61 14 -22 34 -56 45 -75 46 -85 27 -80 306 -80 l248 0 0 85 c0 47 -4 85 -9 85 -8 0 -140 213 -201 325 -23 42 -122 206 -152 253 -10 15 -22 36 -28 47 -6 11 -18 32 -28 47 -24 38 -163 267 -176 292 -6 12 -24 40 -39 63 -15 24 -27 45 -27 47 0 8 -90 155 -137 225 -24 34 -58 88 -75 120 -17 31 -43 74 -57 96 -38 59 -49 78 -60 100 -14 29 -76 125 -101 158 l-22 27 -212 0 -212 0 -26 -27z m253 -545 c12 -23 61 -108 110 -189 49 -82 89 -150 89 -153 0 -3 20 -40 45 -82 25 -41 45 -77 45 -79 0 -2 16 -31 36 -65 19 -33 32 -65 29 -70 -8 -13 -744 -13 -764 -1 -11 7 -2 30 46 113 34 56 71 121 83 143 12 22 61 104 109 182 47 79 99 165 114 193 16 27 30 50 32 50 3 0 14 -19 26 -42z"/>`

const S_MARK_PATHS = `
    <path d="M7650 16230 c-185 -6 -231 -11 -445 -46 -195 -33 -362 -80 -570 -161 -321 -127 -594 -320 -761 -542 -35 -46 -64 -90 -64 -96 0 -7 9 -24 21 -39 20 -25 20 -28 5 -67 -22 -55 -22 -298 0 -377 61 -220 130 -319 316 -459 147 -110 299 -186 608 -307 52 -20 111 -43 130 -51 19 -7 89 -34 155 -60 66 -25 136 -52 155 -60 218 -84 326 -126 390 -150 22 -8 57 -21 78 -29 20 -8 80 -31 132 -51 52 -20 133 -54 180 -75 47 -21 173 -75 280 -120 107 -45 222 -95 254 -112 l59 -29 111 11 c80 8 939 11 3106 10 l2995 -2 80 21 c114 30 227 88 322 165 100 81 121 107 215 271 41 72 119 207 173 300 54 94 154 269 222 390 69 121 139 243 157 270 18 28 63 106 101 175 108 197 268 477 346 607 66 109 216 373 296 520 31 56 32 63 17 77 -14 15 -206 16 -2067 17 -1129 1 -3121 2 -4427 3 -1306 1 -2463 -1 -2570 -4z"/>
    <path d="M5675 15202 c-26 -29 -111 -172 -178 -297 -35 -66 -78 -140 -94 -165 -17 -25 -61 -99 -98 -165 -37 -66 -103 -181 -145 -255 -43 -74 -114 -200 -158 -280 -43 -80 -94 -170 -112 -200 -19 -30 -63 -109 -100 -175 -37 -66 -105 -190 -153 -275 -112 -202 -226 -485 -263 -654 -22 -103 -44 -280 -44 -361 0 -190 50 -397 133 -558 126 -240 276 -422 497 -599 74 -59 251 -173 330 -213 77 -39 355 -161 400 -175 14 -5 50 -18 80 -30 64 -24 207 -73 365 -123 61 -20 135 -45 165 -57 30 -12 127 -46 215 -75 161 -55 468 -160 625 -216 47 -16 157 -54 245 -84 88 -30 225 -78 305 -106 80 -28 179 -61 220 -74 167 -54 446 -148 665 -226 127 -45 618 -212 745 -254 106 -34 507 -171 555 -189 83 -31 337 -120 535 -186 543 -183 830 -281 880 -300 80 -31 490 -177 590 -210 14 -5 70 -25 125 -45 55 -20 172 -60 260 -90 88 -30 246 -84 350 -120 105 -36 242 -83 305 -105 63 -21 153 -53 200 -71 47 -17 110 -39 140 -49 30 -10 118 -47 195 -82 77 -36 201 -91 275 -124 179 -78 546 -265 635 -322 278 -179 372 -253 501 -396 132 -146 228 -318 265 -471 18 -78 21 -110 16 -240 -2 -82 -9 -162 -15 -177 -21 -52 13 -83 49 -45 30 31 563 929 659 1110 23 44 77 136 119 205 43 70 99 168 126 217 26 50 73 132 102 183 77 132 126 239 173 383 165 498 180 869 53 1249 -83 246 -174 401 -386 653 -50 59 -271 257 -348 310 -168 119 -471 292 -604 345 -119 48 -285 112 -340 131 -115 39 -253 90 -306 111 -279 114 -295 119 -579 216 -91 31 -185 66 -210 76 -25 11 -76 30 -115 43 -38 13 -95 33 -125 45 -30 12 -68 25 -85 30 -16 4 -95 31 -175 60 -80 29 -181 65 -225 80 -44 16 -118 42 -165 60 -47 17 -137 48 -200 70 -63 21 -155 53 -205 71 -205 73 -286 101 -395 139 -169 58 -300 105 -345 125 -22 9 -58 23 -80 30 -22 7 -74 25 -115 40 -41 15 -156 56 -255 91 -99 34 -259 90 -355 124 -96 34 -206 72 -245 85 -38 13 -115 40 -170 60 -55 19 -138 49 -185 65 -141 48 -312 108 -370 130 -30 12 -74 28 -97 36 -23 8 -79 28 -125 45 -46 17 -117 41 -158 54 -41 13 -120 40 -175 60 -55 20 -131 47 -170 60 -38 13 -108 38 -155 56 -125 46 -202 73 -320 108 -127 39 -351 117 -520 181 -30 11 -82 30 -115 41 -33 11 -94 34 -135 51 -41 16 -91 35 -110 42 -46 18 -196 74 -240 91 -19 7 -89 34 -155 60 -174 67 -181 70 -280 105 -242 86 -575 219 -650 259 -296 157 -401 232 -527 376 -84 97 -154 223 -179 325 -18 71 -18 277 -2 307 23 40 -14 79 -42 45z"/>
    <path d="M4580 8224 c-159 -24 -336 -86 -477 -165 -85 -49 -263 -255 -322 -374 -19 -38 -60 -113 -91 -165 -31 -52 -92 -160 -135 -240 -43 -80 -89 -163 -103 -184 -13 -21 -56 -98 -96 -170 -40 -72 -107 -192 -150 -266 -171 -297 -330 -579 -368 -655 -22 -44 -77 -143 -122 -220 -46 -77 -116 -198 -156 -270 -40 -71 -85 -149 -101 -172 -48 -73 -51 -80 -33 -97 14 -15 482 -16 5122 -16 5302 1 5361 1 5672 40 158 20 352 56 485 90 489 126 1016 425 1223 694 41 53 47 68 48 111 1 27 14 84 29 125 27 73 28 82 29 275 1 209 -6 256 -59 380 -70 166 -343 456 -560 597 -75 48 -480 259 -580 301 -33 14 -125 56 -205 92 -164 74 -273 121 -375 160 -38 15 -117 52 -175 83 l-105 56 -4160 1 c-3037 0 -4180 -3 -4235 -11z"/>`

// ─── Block Digit Renderer ────────────────────────────────────────────────────
// Builds digits from filled rectangles — perfect for embroidery, no font needed.

const DIGIT_GRIDS = {
  0: [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  1: [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[1,1,1]],
  2: [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
  3: [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
  6: [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
}

function renderDigit(n, ox, oy, bw, bh, gap, color) {
  const grid = DIGIT_GRIDS[n]
  let rects = ''
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      if (grid[r][c]) {
        rects += `    <rect x="${ox + c*(bw+gap)}" y="${oy + r*(bh+gap)}" width="${bw}" height="${bh}" rx="6" fill="${color}"/>\n`
      }
    }
  }
  return rects
}

function renderNumber(str, ox, oy, bw, bh, gap, digitGap, colors) {
  let x = ox
  const dw = 3*bw + 2*gap
  let svg = ''
  for (let i = 0; i < str.length; i++) {
    const color = Array.isArray(colors) ? colors[i % colors.length] : colors
    svg += renderDigit(parseInt(str[i]), x, oy, bw, bh, gap, color)
    x += dw + digitGap
  }
  return svg
}

// ─── SVG Designs ─────────────────────────────────────────────────────────────

/** front_center_chest (3000×1800): SKAPARA wordmark + blue bar + "2026" blocks */
function svgCenterChest() {
  // Wordmark: 2600px wide, centered
  const wmX = (3000 - 2600) / 2  // 200
  const wmY = 250
  const wmH = Math.round(2600 * 208 / 2040)  // ~265

  // Blue accent bar below wordmark
  const barY = wmY + wmH + 60  // ~575
  const barH = 35

  // "2026" block digits below bar
  const bw = 100, bh = 80, gap = 12, digitGap = 50
  const dw = 3*bw + 2*gap  // 324 per digit
  const totalW = 4*dw + 3*digitGap  // 1446
  const numX = (3000 - totalW) / 2  // ~777
  const numY = barY + barH + 80  // ~690

  // Coral accent dot at bottom
  const dotY = numY + 5*bh + 4*gap + 80

  // Colors: "20" in black, "26" in blue
  const digitColors = [BLACK, BLACK, BLUE, BLUE]

  return `<svg width="3000" height="1800" viewBox="0 0 3000 1800" xmlns="http://www.w3.org/2000/svg">
  <!-- SKAPARA Wordmark (real SVG paths) -->
  <svg x="${wmX}" y="${wmY}" width="2600" height="${wmH}" viewBox="0 0 2040 208">
    <g transform="translate(0,231.6) scale(0.1,-0.1)" fill="${BLACK}" stroke="none">
${WORDMARK_PATHS}
    </g>
  </svg>

  <!-- Blue accent bar -->
  <rect x="${wmX}" y="${barY}" width="2600" height="${barH}" rx="4" fill="${BLUE}"/>

  <!-- "2026" in block digits -->
${renderNumber('2026', numX, numY, bw, bh, gap, digitGap, digitColors)}

  <!-- Coral accent dot -->
  <circle cx="1500" cy="${dotY}" r="30" fill="${CORAL}"/>

  <!-- Small blue dots flanking -->
  <circle cx="1420" cy="${dotY}" r="14" fill="${BLUE}"/>
  <circle cx="1580" cy="${dotY}" r="14" fill="${BLUE}"/>
</svg>`
}

/** front_left_chest (1200×1200): Bold "26" in blocks with colored accents */
function svgLeftChest() {
  const bw = 130, bh = 100, gap = 15, digitGap = 60
  const dw = 3*bw + 2*gap  // 420 per digit
  const totalW = 2*dw + digitGap  // 900
  const ox = (1200 - totalW) / 2  // 150
  const oy = (1200 - (5*bh + 4*gap)) / 2  // ~320

  return `<svg width="1200" height="1200" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
  <!-- "2" in black -->
${renderDigit(2, ox, oy, bw, bh, gap, BLACK)}
  <!-- "6" in blue -->
${renderDigit(6, ox + dw + digitGap, oy, bw, bh, gap, BLUE)}

  <!-- Coral accent bar below -->
  <rect x="${ox}" y="${oy + 5*bh + 4*gap + 40}" width="${totalW}" height="20" rx="10" fill="${CORAL}"/>
</svg>`
}

/** left_wrist (600×900): S mark (original logo) */
function svgLeftWrist() {
  // S mark centered in 600×900
  // S mark viewBox: 0 0 1431 1100, aspect ~1.3:1
  // Fit within 500×385 and center
  const sw = 500
  const sh = Math.round(500 * 1100 / 1431)  // ~384
  const sx = (600 - sw) / 2  // 50
  const sy = (900 - sh) / 2  // ~258

  return `<svg width="600" height="900" viewBox="0 0 600 900" xmlns="http://www.w3.org/2000/svg">
  <!-- S Mark (original SKAPARA logo — SVG paths) -->
  <svg x="${sx}" y="${sy}" width="${sw}" height="${sh}" viewBox="0 0 1431 1100">
    <g transform="translate(-241.6,1623.4) scale(0.1,-0.1)" fill="${BLACK}" stroke="none">
${S_MARK_PATHS}
    </g>
  </svg>
</svg>`
}

/** right_wrist (600×900): ">_" prompt symbol + blue accent */
function svgRightWrist() {
  // ">" built as a right-pointing triangle (filled)
  // "_" built as a thick horizontal rectangle
  return `<svg width="600" height="900" viewBox="0 0 600 900" xmlns="http://www.w3.org/2000/svg">
  <!-- ">" chevron/arrow — solid filled triangle -->
  <polygon points="120,200 420,400 120,600" fill="${BLACK}"/>

  <!-- "_" underscore — solid rectangle -->
  <rect x="160" y="650" width="280" height="50" rx="8" fill="${BLUE}"/>

  <!-- Small coral accent dot -->
  <circle cx="300" cy="780" r="30" fill="${CORAL}"/>
</svg>`
}

// ─── Render SVG to PNG ───────────────────────────────────────────────────────
async function svgToPng(svgString, width, height) {
  return sharp(Buffer.from(svgString))
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

// ─── Product ─────────────────────────────────────────────────────────────────
const PRODUCT = {
  name: 'Origin',
  subtitle: 'Embroidered Hoodie',
  blueprintId: 793,
  providerId: 410,
  colorFilter: ['White', 'Bone'],
  priceCents: 5999,
  category: 'hoodies',
  tags: ['hoodie', 'embroidered', 'premium', 'skapara', 'origin', '2026', 'white', 'streetwear', 'typographic'],
  desc: {
    en: 'SKAPARA Origin — Premium embroidered hoodie. Typographic design with SKAPARA wordmark, block-style 2026, and S mark on sleeve. 3-color thread on Cotton Heritage M2580.',
    es: 'SKAPARA Origin — Hoodie bordado premium. Diseño tipografico con wordmark SKAPARA, 2026 en bloques y marca S en la manga. 3 colores de hilo en Cotton Heritage M2580.',
    de: 'SKAPARA Origin — Premium bestickter Hoodie. Typografisches Design mit SKAPARA-Wortmarke, 2026 in Blockschrift und S-Marke am Armel. 3-Farben-Stickerei auf Cotton Heritage M2580.',
  },
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(55))
  console.log('  SKAPARA ORIGIN — Typographic Embroidered Hoodie')
  console.log('='.repeat(55) + '\n')
  if (PREVIEW) console.log('  *** PREVIEW MODE ***\n')
  if (DRY_RUN) console.log('  *** DRY RUN ***\n')

  const designs = [
    { name: 'left_chest',   position: 'front_left_chest',   svg: svgLeftChest(),   w: 1200, h: 1200 },
    { name: 'center_chest', position: 'front_center_chest', svg: svgCenterChest(), w: 3000, h: 1800 },
    { name: 'left_wrist',   position: 'left_wrist',         svg: svgLeftWrist(),    w: 600,  h: 900  },
    { name: 'right_wrist',  position: 'right_wrist',        svg: svgRightWrist(),   w: 600,  h: 900  },
  ]

  const previewDir = '/tmp/origin-hoodie'
  mkdirSync(previewDir, { recursive: true })

  const uploads = new Map()

  console.log('Step 1: Rendering designs...\n')
  for (const d of designs) {
    console.log(`  ${d.name} (${d.w}x${d.h})...`)
    writeFileSync(`${previewDir}/${d.name}.svg`, d.svg)
    const png = await svgToPng(d.svg, d.w, d.h)
    writeFileSync(`${previewDir}/${d.name}.png`, png)
    console.log(`    ${(png.length / 1024).toFixed(0)} KB -> ${previewDir}/${d.name}.png`)

    if (PREVIEW || DRY_RUN) { uploads.set(d.position, `preview-${d.name}`); continue }

    await delay(2000)
    const upload = await api('/uploads/images.json', {
      method: 'POST',
      body: JSON.stringify({ file_name: `origin-${d.name}.png`, contents: png.toString('base64') }),
    })
    uploads.set(d.position, upload.id)
    console.log(`    Upload: ${upload.id}`)
  }

  console.log(`\n  ${uploads.size}/4 designs ready\n`)
  if (PREVIEW) { console.log('Preview at: ' + previewDir); process.exit(0) }

  console.log('Step 2: Fetching variants...\n')
  const varRes = await api(`/catalog/blueprints/${PRODUCT.blueprintId}/print_providers/${PRODUCT.providerId}/variants.json`)
  const selected = (varRes.variants || []).filter(v => {
    const c = (v.options?.color || '').toLowerCase()
    return PRODUCT.colorFilter.some(f => c.includes(f.toLowerCase()))
  })
  console.log(`  Selected: ${selected.length} (White/Bone)`)

  if (!selected.length) { console.error('No variants!'); process.exit(1) }
  if (DRY_RUN) { console.log(`\n  [DRY RUN] ${selected.length} variants @ EUR ${(PRODUCT.priceCents/100).toFixed(2)}`); process.exit(0) }

  console.log('\nStep 3: Creating product...\n')
  const placeholders = designs.map(d => ({
    position: d.position,
    images: [{ id: uploads.get(d.position), x: 0.5, y: 0.5, scale: 1, angle: 0 }],
  }))

  await delay(1500)
  const prod = await api(`/shops/${SHOP_ID}/products.json`, {
    method: 'POST',
    body: JSON.stringify({
      title: `${PRODUCT.name} — ${PRODUCT.subtitle}`,
      description: PRODUCT.desc.en,
      blueprint_id: PRODUCT.blueprintId,
      print_provider_id: PRODUCT.providerId,
      variants: selected.map(v => ({ id: v.id, price: PRODUCT.priceCents, is_enabled: true })),
      print_areas: [{ variant_ids: selected.map(v => v.id), placeholders }],
      tags: PRODUCT.tags,
    }),
  })
  console.log(`  Printify: ${prod.id}`)

  await delay(1000)
  await api(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
    method: 'POST',
    body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
  })
  console.log('  Published')

  // Supabase
  const { data: cat } = await supabase.from('categories').select('id').eq('slug', PRODUCT.category).single()
  const { data: dbProd, error: dbErr } = await supabase.from('products').insert({
    title: PRODUCT.name,
    description: PRODUCT.desc.en,
    printify_id: prod.id,
    blueprint_id: PRODUCT.blueprintId,
    print_provider_id: PRODUCT.providerId,
    category_id: cat?.id,
    status: 'active',
    currency: 'EUR',
    base_price_cents: PRODUCT.priceCents,
    tags: PRODUCT.tags,
    published_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    translations: {
      es: { title: PRODUCT.name, description: PRODUCT.desc.es },
      de: { title: PRODUCT.name, description: PRODUCT.desc.de },
    },
  }).select('id').single()

  if (dbErr) { console.error(`  DB: ${dbErr.message}`); return }
  const dbId = dbProd.id
  console.log(`  Supabase: ${dbId}`)

  try { await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
    method: 'POST', body: JSON.stringify({ external: { id: dbId, handle: `/shop/${dbId}` } })
  }) } catch {}

  for (const sv of selected) {
    const parts = sv.title.split('/').map(p => p.trim())
    await supabase.from('product_variants').upsert({
      product_id: dbId, printify_variant_id: String(sv.id), title: sv.title,
      color: parts[0] || 'White', size: parts[1] || 'Default',
      price_cents: PRODUCT.priceCents, is_enabled: true, is_available: true,
    }, { onConflict: 'product_id,printify_variant_id' })
  }

  await delay(5000)
  try {
    const details = await api(`/shops/${SHOP_ID}/products/${prod.id}.json`)
    const imgs = (details?.images || []).filter(i => !i.src.includes('size-chart')).slice(0, 8).map(i => i.src)
    if (imgs.length) {
      await supabase.from('products').update({ images: imgs, thumbnail_url: imgs[0] }).eq('id', dbId)
      console.log(`  ${imgs.length} mockups synced`)
    }
  } catch {}

  console.log('\n  ORIGIN CREATED')
  console.log(`  Price: EUR ${(PRODUCT.priceCents/100).toFixed(2)} | Variants: ${selected.length} | Colors: 3 thread`)
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1) })
