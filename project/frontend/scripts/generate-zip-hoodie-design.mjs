/**
 * Generate SKAPARA SPLIT — Zip Hoodie Design
 *
 * Concept: Geometric lines radiate from the center (where the zipper is),
 * creating a split symmetry effect. The SKAPARA "S" mark sits on the left chest,
 * "SKAPARA" wordmark below it, and "CREATE YOUR REALITY" as a tagline.
 *
 * Canvas: 3366x2772 (BP91/P26 front)
 * The zipper runs vertically through the center (~x=1683).
 * Design leaves a ~100px gap in the center for the zip.
 */

import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join } from 'path'

const OUT_DIR = join(import.meta.dirname, '..', 'public', 'brand-designs')
mkdirSync(OUT_DIR, { recursive: true })

const W = 3366
const H = 2772
const CX = W / 2  // Center X (zipper line)

// ─── S Mark path data (from brand SVGs) ────────────────────────────────────

const S_MARK_PATHS = [
  `M7650 16230 c-185 -6 -231 -11 -445 -46 -195 -33 -362 -80 -570 -161 -321 -127 -594 -320 -761 -542 -35 -46 -64 -90 -64 -96 0 -7 9 -24 21 -39 20 -25 20 -28 5 -67 -22 -55 -22 -298 0 -377 61 -220 130 -319 316 -459 147 -110 299 -186 608 -307 52 -20 111 -43 130 -51 19 -7 89 -34 155 -60 66 -25 136 -52 155 -60 218 -84 326 -126 390 -150 22 -8 57 -21 78 -29 20 -8 80 -31 132 -51 52 -20 133 -54 180 -75 47 -21 173 -75 280 -120 107 -45 222 -95 254 -112 l59 -29 111 11 c80 8 939 11 3106 10 l2995 -2 80 21 c114 30 227 88 322 165 100 81 121 107 215 271 41 72 119 207 173 300 54 94 154 269 222 390 69 121 139 243 157 270 18 28 63 106 101 175 108 197 268 477 346 607 66 109 216 373 296 520 31 56 32 63 17 77 -14 15 -206 16 -2067 17 -1129 1 -3121 2 -4427 3 -1306 1 -2463 -1 -2570 -4z`,
  `M5675 15202 c-26 -29 -111 -172 -178 -297 -35 -66 -78 -140 -94 -165 -17 -25 -61 -99 -98 -165 -37 -66 -103 -181 -145 -255 -43 -74 -114 -200 -158 -280 -43 -80 -94 -170 -112 -200 -19 -30 -63 -109 -100 -175 -37 -66 -105 -190 -153 -275 -112 -202 -226 -485 -263 -654 -22 -103 -44 -280 -44 -361 0 -190 50 -397 133 -558 126 -240 276 -422 497 -599 74 -59 251 -173 330 -213 77 -39 355 -161 400 -175 14 -5 50 -18 80 -30 64 -24 207 -73 365 -123 61 -20 135 -45 165 -57 30 -12 127 -46 215 -75 161 -55 468 -160 625 -216 47 -16 157 -54 245 -84 88 -30 225 -78 305 -106 80 -28 179 -61 220 -74 167 -54 446 -148 665 -226 127 -45 618 -212 745 -254 106 -34 507 -171 555 -189 83 -31 337 -120 535 -186 543 -183 830 -281 880 -300 80 -31 490 -177 590 -210 14 -5 70 -25 125 -45 55 -20 172 -60 260 -90 88 -30 246 -84 350 -120 105 -36 242 -83 305 -105 63 -21 153 -53 200 -71 47 -17 110 -39 140 -49 30 -10 118 -47 195 -82 77 -36 201 -91 275 -124 179 -78 546 -265 635 -322 278 -179 372 -253 501 -396 132 -146 228 -318 265 -471 18 -78 21 -110 16 -240 -2 -82 -9 -162 -15 -177 -21 -52 13 -83 49 -45 30 31 563 929 659 1110 23 44 77 136 119 205 43 70 99 168 126 217 26 50 73 132 102 183 77 132 126 239 173 383 165 498 180 869 53 1249 -83 246 -174 401 -386 653 -50 59 -271 257 -348 310 -168 119 -471 292 -604 345 -119 48 -285 112 -340 131 -115 39 -253 90 -306 111 -279 114 -295 119 -579 216 -91 31 -185 66 -210 76 -25 11 -76 30 -115 43 -38 13 -95 33 -125 45 -30 12 -68 25 -85 30 -16 4 -95 31 -175 60 -80 29 -181 65 -225 80 -44 16 -118 42 -165 60 -47 17 -137 48 -200 70 -63 21 -155 53 -205 71 -205 73 -286 101 -395 139 -169 58 -300 105 -345 125 -22 9 -58 23 -80 30 -22 7 -74 25 -115 40 -41 15 -156 56 -255 91 -99 34 -259 90 -355 124 -96 34 -206 72 -245 85 -38 13 -115 40 -170 60 -55 19 -138 49 -185 65 -141 48 -312 108 -370 130 -30 12 -74 28 -97 36 -23 8 -79 28 -125 45 -46 17 -117 41 -158 54 -41 13 -120 40 -175 60 -55 20 -131 47 -170 60 -38 13 -108 38 -155 56 -125 46 -202 73 -320 108 -127 39 -351 117 -520 181 -30 11 -82 30 -115 41 -33 11 -94 34 -135 51 -41 16 -91 35 -110 42 -46 18 -196 74 -240 91 -19 7 -89 34 -155 60 -174 67 -181 70 -280 105 -242 86 -575 219 -650 259 -296 157 -401 232 -527 376 -84 97 -154 223 -179 325 -18 71 -18 277 -2 307 23 40 -14 79 -42 45z`,
  `M4580 8224 c-159 -24 -336 -86 -477 -165 -85 -49 -263 -255 -322 -374 -19 -38 -60 -113 -91 -165 -31 -52 -92 -160 -135 -240 -43 -80 -89 -163 -103 -184 -13 -21 -56 -98 -96 -170 -40 -72 -107 -192 -150 -266 -171 -297 -330 -579 -368 -655 -22 -44 -77 -143 -122 -220 -46 -77 -116 -198 -156 -270 -40 -71 -85 -149 -101 -172 -48 -73 -51 -80 -33 -97 14 -15 482 -16 5122 -16 5302 1 5361 1 5672 40 158 20 352 56 485 90 489 126 1016 425 1223 694 41 53 47 68 48 111 1 27 14 84 29 125 27 73 28 82 29 275 1 209 -6 256 -59 380 -70 166 -343 456 -560 597 -75 48 -480 259 -580 301 -33 14 -125 56 -205 92 -164 74 -273 121 -375 160 -38 15 -117 52 -175 83 l-105 56 -4160 1 c-3037 0 -4180 -3 -4235 -11z`,
]

const WORDMARK_PATHS = [
  `M870 2310 c-156 -12 -280 -37 -421 -84 -195 -65 -312 -141 -422 -275 l-27 -33 0 -213 c0 -180 2 -214 15 -219 8 -3 15 -10 15 -16 0 -18 82 -108 130 -143 89 -64 120 -76 330 -130 167 -43 290 -59 810 -103 303 -25 445 -58 500 -116 61 -63 75 -124 42 -185 -97 -181 -719 -226 -1207 -86 -52 15 -118 39 -146 53 -10 5 -46 21 -80 35 -35 15 -94 47 -130 71 -37 24 -71 44 -77 44 -6 0 -50 -47 -98 -105 -48 -58 -91 -105 -96 -105 -4 0 -8 -46 -8 -103 l0 -103 57 -26 c270 -124 414 -163 786 -214 178 -24 549 -21 734 5 291 42 480 107 629 216 123 91 185 193 204 338 22 165 -25 300 -144 415 -166 161 -391 232 -861 272 -60 6 -200 17 -310 25 -110 8 -216 19 -235 25 -19 5 -55 10 -80 10 -57 0 -164 35 -208 67 -74 55 -80 115 -19 177 49 48 112 72 275 101 141 25 461 23 612 -3 237 -42 381 -90 517 -173 22 -14 46 -19 74 -17 46 3 27 -21 198 257 l52 84 -23 22 c-64 61 -394 165 -683 216 -127 22 -528 33 -705 19z`,
  `M3042 2258 c-17 -17 -17 -1929 0 -1946 18 -18 501 -17 517 1 7 9 11 106 11 296 1 311 -4 286 67 334 120 83 182 128 188 137 14 23 127 90 139 83 7 -5 44 -44 83 -88 80 -90 193 -201 398 -391 77 -71 199 -187 271 -257 l132 -128 318 1 c239 0 322 4 331 13 10 10 -20 43 -145 163 -87 84 -200 189 -252 235 -52 45 -229 209 -393 363 -164 155 -316 295 -337 311 -47 36 -49 49 -12 72 15 10 50 36 78 58 29 22 93 69 144 105 82 58 274 198 558 407 53 39 137 101 186 138 129 98 133 96 -262 97 -176 0 -326 -3 -334 -8 -7 -5 -47 -34 -88 -64 -41 -31 -97 -72 -125 -92 -27 -19 -125 -88 -217 -154 -93 -65 -241 -170 -330 -232 -90 -63 -191 -135 -225 -160 -109 -83 -152 -112 -163 -112 -7 0 -10 124 -10 401 1 291 -2 405 -11 415 -16 19 -498 21 -517 2z`,
  `M6978 2241 c-24 -29 -88 -130 -121 -189 -10 -18 -45 -74 -78 -124 -33 -50 -71 -112 -86 -137 -14 -25 -57 -99 -97 -164 -39 -65 -77 -128 -84 -140 -7 -12 -62 -101 -122 -197 -59 -96 -206 -337 -326 -535 -119 -198 -228 -375 -242 -393 -45 -60 -35 -62 263 -62 l264 0 20 26 c12 15 21 30 21 35 0 7 51 93 145 244 l44 70 603 5 c332 3 612 2 623 -1 11 -4 29 -24 40 -45 38 -74 168 -289 188 -311 20 -23 23 -23 283 -23 308 0 304 -1 255 82 -18 29 -36 60 -41 68 -12 20 -282 476 -306 517 -11 18 -59 98 -109 178 -49 80 -101 165 -114 188 -13 23 -43 71 -66 107 -49 77 -189 308 -198 330 -4 8 -16 29 -27 45 -11 17 -23 37 -28 47 0 4 -13 25 -29 49 -16 24 -39 61 -51 83 -12 22 -30 54 -41 70 -10 17 -22 37 -25 45 -4 8 -16 25 -27 38 -20 21 -25 22 -233 22 l-212 0 -24 -29z m249 -548 c10 -29 87 -163 230 -401 74 -122 131 -227 128 -232 -9 -14 -762 -13 -770 0 -4 6 7 32 22 58 16 26 32 54 36 62 4 8 16 29 27 45 11 17 23 37 27 45 3 8 21 38 39 65 50 77 144 235 144 241 0 4 13 25 29 49 16 24 32 53 36 64 8 26 43 28 52 4z`,
  `M9093 2248 c-13 -15 -15 -122 -11 -967 3 -765 7 -952 17 -965 12 -14 47 -16 260 -16 179 0 250 3 259 12 9 9 12 85 12 280 l0 268 23 5 c12 2 245 6 517 8 538 4 560 6 760 66 183 55 297 126 386 241 76 98 105 169 125 309 18 130 1 236 -57 357 -83 171 -201 268 -411 338 -241 82 -318 87 -1176 84 -633 -3 -690 -4 -704 -20z m1512 -407 c50 -10 110 -28 135 -39 120 -53 181 -202 133 -324 -21 -55 -43 -83 -95 -123 -97 -74 -236 -89 -754 -83 -204 3 -376 8 -382 12 -9 5 -12 84 -12 281 0 250 2 275 18 284 11 7 171 10 442 10 374 0 436 -2 515 -18z`,
  `M12721 2246 c-12 -12 -68 -99 -125 -192 -57 -93 -163 -266 -235 -384 -73 -118 -154 -249 -181 -290 -27 -41 -114 -183 -193 -315 -190 -314 -186 -308 -194 -325 -3 -8 -25 -44 -48 -80 -23 -36 -63 -101 -90 -145 -26 -44 -65 -105 -86 -136 -28 -42 -35 -59 -26 -68 8 -8 92 -11 279 -11 l268 0 27 43 c39 60 45 70 71 119 13 23 49 81 80 128 l57 85 155 7 c85 5 361 7 613 5 l458 -2 31 -55 c16 -30 45 -77 63 -105 18 -27 41 -66 51 -85 28 -51 55 -92 78 -117 19 -23 22 -23 287 -23 221 0 269 2 279 15 6 8 8 20 4 27 -4 7 -26 42 -49 78 -23 36 -45 72 -48 80 -4 8 -16 29 -27 45 -11 17 -24 39 -29 50 -5 11 -38 66 -73 123 -35 56 -135 220 -222 365 -88 144 -178 291 -200 327 -23 36 -47 74 -53 85 -40 63 -144 237 -167 280 -54 97 -273 452 -295 479 -12 14 -41 16 -225 16 -210 0 -213 0 -235 -24z m251 -563 c12 -27 33 -64 46 -83 13 -19 28 -44 32 -55 4 -11 59 -105 122 -210 63 -104 117 -197 121 -205 4 -8 14 -26 22 -39 7 -14 11 -29 8 -34 -8 -13 -764 -6 -769 7 -3 7 27 65 66 129 38 65 70 120 70 122 0 6 91 157 105 175 7 8 27 42 45 75 18 33 39 67 46 76 8 8 14 19 14 23 0 9 39 66 46 66 2 0 14 -21 26 -47z`,
  `M14844 2249 c-13 -15 -15 -137 -12 -966 2 -787 5 -953 17 -966 12 -15 43 -17 260 -17 179 0 250 3 259 12 9 9 12 71 12 217 0 114 3 250 7 304 l6 97 347 0 348 0 58 -67 c117 -135 310 -350 407 -456 l100 -107 312 0 c358 0 361 1 294 66 -66 63 -589 612 -589 617 0 3 26 13 58 22 136 38 286 127 369 219 95 105 141 255 129 422 -9 132 -35 202 -120 317 -102 139 -253 221 -496 271 -164 34 -278 37 -1019 34 -664 -3 -734 -5 -747 -19z m1589 -405 c141 -32 201 -83 227 -193 26 -112 -30 -220 -145 -278 -48 -25 -58 -26 -310 -34 -302 -9 -805 -12 -812 -5 -7 6 -4 507 3 518 3 4 221 8 485 8 407 0 491 -2 552 -16z`,
  `M18838 2243 c-26 -28 -67 -90 -101 -152 -10 -19 -31 -52 -45 -75 -15 -23 -31 -49 -37 -58 -70 -118 -195 -318 -260 -418 -91 -140 -99 -152 -228 -368 -51 -85 -99 -165 -107 -177 -8 -13 -42 -67 -75 -120 -33 -53 -67 -107 -75 -120 -8 -13 -70 -115 -138 -226 -97 -159 -120 -204 -111 -215 9 -11 62 -14 268 -14 305 0 261 -20 374 173 11 18 44 71 75 120 l56 87 617 0 617 0 42 -72 c24 -40 48 -81 54 -92 6 -12 23 -39 37 -61 14 -22 34 -56 45 -75 46 -85 27 -80 306 -80 l248 0 0 85 c0 47 -4 85 -9 85 -8 0 -140 213 -201 325 -23 42 -122 206 -152 253 -10 15 -22 36 -28 47 -6 11 -18 32 -28 47 -24 38 -163 267 -176 292 -6 12 -24 40 -39 63 -15 24 -27 45 -27 47 0 8 -90 155 -137 225 -24 34 -58 88 -75 120 -17 31 -43 74 -57 96 -38 59 -49 78 -60 100 -14 29 -76 125 -101 158 l-22 27 -212 0 -212 0 -26 -27z m253 -545 c12 -23 61 -108 110 -189 49 -82 89 -150 89 -153 0 -3 20 -40 45 -82 25 -41 45 -77 45 -79 0 -2 16 -31 36 -65 19 -33 32 -65 29 -70 -8 -13 -744 -13 -764 -1 -11 7 -2 30 46 113 34 56 71 121 83 143 12 22 61 104 109 182 47 79 99 165 114 193 16 27 30 50 32 50 3 0 14 -19 26 -42z`,
]

// ─── Gradient definitions ──────────────────────────────────────────────────

const OCEAN_GRADIENT = `
  <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#00BCD4"/>
    <stop offset="50%" stop-color="#2979FF"/>
    <stop offset="100%" stop-color="#7C4DFF"/>
  </linearGradient>`

// ─── SVG Builder Functions ─────────────────────────────────────────────────

function buildSMarkGroup(x, y, scale, fill) {
  return `<g transform="translate(${x}, ${y}) scale(${scale})">
    <g transform="translate(-2416,16234) scale(1,-1)" fill="${fill}" stroke="none">
      ${S_MARK_PATHS.map(d => `<path d="${d}"/>`).join('\n      ')}
    </g>
  </g>`
}

function buildWordmarkGroup(x, y, scale, fill) {
  return `<g transform="translate(${x}, ${y}) scale(${scale})">
    <g transform="translate(0,2316) scale(1,-1)" fill="${fill}" stroke="none">
      ${WORDMARK_PATHS.map(d => `<path d="${d}"/>`).join('\n      ')}
    </g>
  </g>`
}

/**
 * Build geometric pattern radiating from center (zip zone).
 * Deterministic — no randomness. Clean, symmetric geometry.
 */
function buildGeometricLines(fill, opacity = 0.25) {
  const lines = []
  const zipGap = 50  // gap for zipper

  // ─── Horizontal line clusters (symmetric pairs) ───
  // Each cluster: 3 parallel lines at fixed lengths (short/medium/long)
  const clusters = [
    { y: 500,  lengths: [350, 500, 300] },
    { y: 850,  lengths: [500, 650, 400] },
    { y: 1350, lengths: [400, 550, 350] },
    { y: 1850, lengths: [550, 700, 450] },
    { y: 2250, lengths: [400, 600, 350] },
  ]

  for (const { y, lengths } of clusters) {
    for (let i = 0; i < lengths.length; i++) {
      const ly = y + i * 16
      const len = lengths[i]
      // Left
      lines.push(`<line x1="${CX - zipGap}" y1="${ly}" x2="${CX - zipGap - len}" y2="${ly}"
        stroke="${fill}" stroke-width="2.5" opacity="${opacity}"/>`)
      // Right (mirror)
      lines.push(`<line x1="${CX + zipGap}" y1="${ly}" x2="${CX + zipGap + len}" y2="${ly}"
        stroke="${fill}" stroke-width="2.5" opacity="${opacity}"/>`)
    }
  }

  // ─── Chevron accents between clusters ───
  const chevrons = [
    { y: 670,  len: 250, angle: 18 },
    { y: 1100, len: 300, angle: 14 },
    { y: 1600, len: 280, angle: 16 },
    { y: 2050, len: 250, angle: 18 },
  ]

  for (const { y, len, angle } of chevrons) {
    const rad = angle * Math.PI / 180
    const dx = len * Math.cos(rad)
    const dy = len * Math.sin(rad)

    // Left V
    lines.push(`<line x1="${CX - zipGap}" y1="${y}" x2="${CX - zipGap - dx}" y2="${y - dy}"
      stroke="${fill}" stroke-width="1.5" opacity="${opacity * 0.6}"/>`)
    lines.push(`<line x1="${CX - zipGap}" y1="${y}" x2="${CX - zipGap - dx}" y2="${y + dy}"
      stroke="${fill}" stroke-width="1.5" opacity="${opacity * 0.6}"/>`)
    // Right V (mirror)
    lines.push(`<line x1="${CX + zipGap}" y1="${y}" x2="${CX + zipGap + dx}" y2="${y - dy}"
      stroke="${fill}" stroke-width="1.5" opacity="${opacity * 0.6}"/>`)
    lines.push(`<line x1="${CX + zipGap}" y1="${y}" x2="${CX + zipGap + dx}" y2="${y + dy}"
      stroke="${fill}" stroke-width="1.5" opacity="${opacity * 0.6}"/>`)
  }

  // ─── Small diamond accents along zip line ───
  const diamondSize = 18
  const diamondYs = [400, 760, 1200, 1500, 1950, 2380]
  for (const dy of diamondYs) {
    const lx = CX - zipGap - 15
    const rx = CX + zipGap + 15
    lines.push(`<polygon points="${lx},${dy} ${lx-diamondSize},${dy-diamondSize} ${lx-diamondSize*2},${dy} ${lx-diamondSize},${dy+diamondSize}"
      fill="${fill}" opacity="${opacity * 0.4}"/>`)
    lines.push(`<polygon points="${rx},${dy} ${rx+diamondSize},${dy-diamondSize} ${rx+diamondSize*2},${dy} ${rx+diamondSize},${dy+diamondSize}"
      fill="${fill}" opacity="${opacity * 0.4}"/>`)
  }

  return lines.join('\n  ')
}

/**
 * Build the full SKAPARA SPLIT design SVG.
 *
 * Layout concept: The zip hoodie has a zipper down the center.
 * The design uses this as a visual axis:
 *   - Left chest: S mark (bold, main element)
 *   - Right chest: "SKAPARA" wordmark (matching height)
 *   - Below both: "CREATE YOUR REALITY" tagline, centered across full width
 *   - Full height: Geometric lines radiate from the zip center
 *
 * This creates a split composition where the branding has weight on BOTH sides.
 */
function buildDesignSVG(fillColor, gradientDef = '') {
  const fill = gradientDef ? 'url(#ocean)' : fillColor

  // S Mark — left chest
  const markNatW = 14310
  const markNatH = 11000
  const markTargetH = 520
  const markScale = markTargetH / markNatH
  const markW = markNatW * markScale
  const markX = CX - markW - 120  // Right-aligned to zip gap (left side)
  const markY = 280

  // Wordmark — right chest, vertically centered with S mark
  const wmNatW = 20400
  const wmNatH = 2316
  const wmTargetW = 680
  const wmScale = wmTargetW / wmNatW
  const wmH = wmNatH * wmScale
  const wmX = CX + 120  // Left-aligned from zip gap (right side)
  const wmY = markY + (markTargetH - wmH) / 2 + 40  // Vertically centered with S mark

  // Tagline — centered, below both elements
  const tagY = markY + markTargetH + 140
  const tagX = CX

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    ${gradientDef}
  </defs>

  <!-- Geometric lines radiating from zip center -->
  ${buildGeometricLines(fill, 0.25)}

  <!-- S Mark — left chest -->
  ${buildSMarkGroup(markX, markY, markScale, fill)}

  <!-- SKAPARA wordmark — right chest -->
  ${buildWordmarkGroup(wmX, wmY, wmScale, fill)}

  <!-- Tagline: CREATE YOUR REALITY -->
  <text x="${tagX}" y="${tagY}"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="300"
    font-size="48"
    letter-spacing="20"
    text-anchor="middle"
    fill="${fill}"
    opacity="0.6">CREATE YOUR REALITY</text>

</svg>`
}

// ─── Generate designs ──────────────────────────────────────────────────────

// We generate TWO versions:
// 1. Ocean gradient — for dark garments (Jet Black, Oxford Navy, Steel Grey, Bottle Green)
// 2. Dark navy — for light/bright garments (Arctic White, Heather Grey, Fire Red, Sun Yellow)

const designs = [
  {
    name: 'zip-hoodie-ocean',
    svg: buildDesignSVG(null, OCEAN_GRADIENT),
    desc: 'Ocean gradient — for dark garments',
  },
  {
    name: 'zip-hoodie-dark',
    svg: buildDesignSVG('#0F172A'),
    desc: 'Dark navy — for light/bright garments',
  },
]

async function render() {
  for (const { name, svg, desc } of designs) {
    const outPath = join(OUT_DIR, `${name}.png`)
    try {
      await sharp(Buffer.from(svg))
        .png({ quality: 100 })
        .ensureAlpha()
        .toFile(outPath)

      const stats = await sharp(outPath).metadata()
      console.log(`OK ${name}.png — ${stats.width}x${stats.height} — ${desc}`)
    } catch (err) {
      console.error(`FAIL ${name}.png — ${err.message}`)
    }
  }
  console.log(`\nDesigns saved to: ${OUT_DIR}`)
}

render().catch(console.error)
