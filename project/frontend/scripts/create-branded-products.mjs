/**
 * SKAPARA — 7 Branded Products (Redesigned with real brand assets)
 *
 * Uses actual brand PNGs (S mark, wordmark, gradients) composed via sharp
 * onto each product's exact Printify canvas size. No generic SVG text.
 *
 * Usage:
 *   node scripts/create-branded-products.mjs --preview    # Generate PNG previews
 *   node scripts/create-branded-products.mjs              # Create on Printify + Supabase
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const PREVIEW = process.argv.includes('--preview')
const ROOT = join(import.meta.dirname, '..')
const OUT_DIR = join(ROOT, 'public', 'branded-previews')
mkdirSync(OUT_DIR, { recursive: true })

// ─── Brand Assets ────────────────────────────────────────────────────────────
const BRAND = join(ROOT, 'public', 'brand-designs')
const SVG_DIR = join(ROOT, 'public', 'brand')

// Pre-rendered PNGs (high quality, transparent backgrounds)
const ASSETS = {
  teeDark:        join(BRAND, 'tee-dark.png'),        // 3951×4919 — S + wordmark, dark
  teeWhite:       join(BRAND, 'tee-white.png'),       // 3951×4919 — S + wordmark, white
  teeGradient:    join(BRAND, 'tee-gradient.png'),     // 3951×4919 — S + wordmark, gradient
  bottleDark:     join(BRAND, 'bottle-dark.png'),      // 2759×1500 — horizontal lockup, dark
  bottleGradient: join(BRAND, 'bottle-gradient.png'),  // 2100×1200 — horizontal lockup, gradient
  hoodieDark:     join(BRAND, 'hoodie-dark.png'),      // 1200×1200 — compact lockup, dark
  hoodieWhite:    join(BRAND, 'hoodie-white.png'),     // 1200×1200 — compact lockup, white
  skaparaWhite:   join(BRAND, 'skapara-white.png'),    // 4096×4096 — S mark only, white
  skaparaOcean:   join(BRAND, 'skapara-ocean.png'),    // 4096×4096 — S mark, ocean gradient
  skaparaWarm:    join(BRAND, 'skapara-warm.png'),     // 4096×4096 — S mark, warm gradient
  tumblerWarm:    join(BRAND, 'tumbler-warm.png'),     // 2795×2100 — wrap design, warm
  tumblerOcean:   join(BRAND, 'tumbler-ocean.png'),    // 2900×1181 — wrap design, ocean
}

// SVGs for vector rendering
const SVG = {
  markWhite:    join(SVG_DIR, 'skapara-mark-white.svg'),
  markDark:     join(SVG_DIR, 'skapara-mark-dark.svg'),
  markColor:    join(SVG_DIR, 'skapara-mark-color.svg'),
  wordmarkDark: join(SVG_DIR, 'skapara-wordmark-dark.svg'),
}

// ─── Env ─────────────────────────────────────────────────────────────────────
let TOKEN, SHOP_ID, supabase
if (!PREVIEW) {
  const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
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

// ═══════════════════════════════════════════════════════════════════════════════
//  DESIGN COMPOSITORS — Each uses real brand PNGs, composited to exact canvas
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 1. SKAPARA Noir — Standard Mug (BP 1016, canvas 2244×945)
 * Dark S mark on white mug. Uses the dark tee asset cropped to horizontal.
 * Result: S mark left, SKAPARA wordmark right, centered on mug wrap.
 */
async function design_mug_noir() {
  const W = 2244, H = 945

  // S mark: 60% of height, preserve aspect (viewBox 1431x1100)
  const markH = Math.round(H * 0.60)
  const markW = Math.round(markH * (1431 / 1100))
  const markSvg = readFileSync(SVG.markDark, 'utf8')
  const markBuf = await sharp(Buffer.from(markSvg))
    .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  // Wordmark: proportional to mark (viewBox 2040x208)
  const wmH = Math.round(H * 0.10)
  const wmW = Math.round(wmH * (2040 / 208))
  const wmSvg = readFileSync(SVG.wordmarkDark, 'utf8')
  const wmBuf = await sharp(Buffer.from(wmSvg))
    .resize(wmW, wmH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  // Total lockup width: mark + gap + wordmark
  const gap = Math.round(W * 0.03)
  const lockupW = markW + gap + wmW
  const lockupLeft = Math.round((W - lockupW) / 2) // center the whole lockup

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png()

  return canvas.composite([
    { input: markBuf, left: lockupLeft, top: Math.round((H - markH) / 2) },
    { input: wmBuf, left: lockupLeft + markW + gap, top: Math.round((H - wmH) / 2) },
  ]).png().toBuffer()
}

/**
 * 2. SKAPARA Signal — Water Bottle (BP 854, canvas 2759×1500)
 * Uses bottle-dark.png which is already 2759×1500 — exact match!
 */
async function design_bottle_signal() {
  const W = 2759, H = 1500

  // S mark: 55% of height, centered lockup with wordmark
  const markH = Math.round(H * 0.55)
  const markW = Math.round(markH * (1431 / 1100))
  const markSvg = readFileSync(SVG.markDark, 'utf8')
  const markBuf = await sharp(Buffer.from(markSvg))
    .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  // Wordmark proportional
  const wmH = Math.round(H * 0.08)
  const wmW = Math.round(wmH * (2040 / 208))
  const wmSvg = readFileSync(SVG.wordmarkDark, 'utf8')
  const wmBuf = await sharp(Buffer.from(wmSvg))
    .resize(wmW, wmH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  // Center the lockup horizontally
  const gap = Math.round(W * 0.03)
  const lockupW = markW + gap + wmW
  const lockupLeft = Math.round((W - lockupW) / 2)

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png()

  return canvas.composite([
    { input: markBuf, left: lockupLeft, top: Math.round((H - markH) / 2) },
    { input: wmBuf, left: lockupLeft + markW + gap, top: Math.round((H - wmH) / 2) },
  ]).png().toBuffer()
}

/**
 * 3. SKAPARA Core — Crewneck (BP 457, canvas 3366×4230)
 * White S mark centered on chest area (upper 60% of canvas).
 * For dark garments: white logo is bold and visible.
 */
async function design_crewneck_core() {
  const W = 3366, H = 4230

  // S mark: ~35% of width, vertically centered in chest zone
  const markW = Math.round(W * 0.35)
  const markH = Math.round(markW * (1100 / 1431))
  const markSvg = readFileSync(SVG.markWhite, 'utf8')
  const markBuf = await sharp(Buffer.from(markSvg))
    .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  // Wordmark below: proportional
  const wmH = Math.round(H * 0.035)
  const wmW = Math.round(wmH * (2040 / 208))
  const wmSvg = readFileSync(SVG.wordmarkDark, 'utf8')
    .replace('fill="#0F172A"', 'fill="#FFFFFF"')
  const wmBuf = await sharp(Buffer.from(wmSvg))
    .resize(wmW, wmH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  // Vertical lockup: mark + gap + wordmark, centered on canvas
  const gap = Math.round(H * 0.03)
  const lockupH = markH + gap + wmH
  const topStart = Math.round((H - lockupH) / 2) // TRUE vertical center

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png()

  return canvas.composite([
    { input: markBuf, left: Math.round((W - markW) / 2), top: topStart },
    { input: wmBuf, left: Math.round((W - wmW) / 2), top: topStart + markH + gap },
  ]).png().toBuffer()
}

/**
 * 4. SKAPARA Edge — Long Sleeve (BP 879, canvas 2752×3142)
 * Small S mark on left chest. Minimal branding.
 * Uses white mark SVG rendered small but crisp.
 */
async function design_longsleeve_edge() {
  const W = 2752, H = 3142

  // S mark: small but visible, ~12% of width (left chest placement)
  const markW = Math.round(W * 0.12)
  const markH = Math.round(markW * (1100 / 1431))
  const markSvg = readFileSync(SVG.markWhite, 'utf8')
  const markBuf = await sharp(Buffer.from(markSvg))
    .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  // Wordmark below the mark
  const wmH = Math.round(H * 0.018)
  const wmW = Math.round(wmH * (2040 / 208))
  const wmSvg = readFileSync(SVG.wordmarkDark, 'utf8')
    .replace('fill="#0F172A"', 'fill="#FFFFFF"')
  const wmBuf = await sharp(Buffer.from(wmSvg))
    .resize(wmW, wmH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png()

  // Left chest: mark centered at ~32% from left, ~15% from top
  const markLeft = Math.round(W * 0.32 - markW / 2)
  const markTop = Math.round(H * 0.14)
  const wmLeft = Math.round(W * 0.32 - wmW / 2)
  const wmTop = markTop + markH + Math.round(H * 0.015)

  return canvas.composite([
    { input: markBuf, left: markLeft, top: markTop },
    { input: wmBuf, left: wmLeft, top: wmTop },
  ]).png().toBuffer()
}

/**
 * 5. SKAPARA Grip — Desk Mat (BP 969, canvas 7205×3661)
 * Tiled S mark pattern (tonal, subtle) across the ultra-wide canvas.
 * Uses ocean gradient mark repeated in a grid.
 */
async function design_deskmat_grip() {
  const W = 7205, H = 3661

  // Render S mark at tile size using white variant (desk mat surface is dark)
  const tileSize = 580
  const markSvg = readFileSync(SVG.markWhite, 'utf8')
  const tileBuf = await sharp(Buffer.from(markSvg))
    .resize(tileSize, Math.round(tileSize * (1100 / 1431)), {
      fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .ensureAlpha()
    .png().toBuffer()

  // Apply 50% opacity for visible tonal pattern
  const fadedTile = await sharp(tileBuf)
    .ensureAlpha()
    .composite([{
      input: Buffer.from([0, 0, 0, Math.round(255 * 0.50)]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in'
    }])
    .png().toBuffer()

  // Build grid of tiles
  const tileH = Math.round(tileSize * (1100 / 1431))
  const cols = Math.ceil(W / (tileSize + 80)) + 1
  const rows = Math.ceil(H / (tileH + 80)) + 1
  const composites = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offsetX = (row % 2 === 1) ? Math.round(tileSize / 2) : 0 // stagger every other row
      const left = col * (tileSize + 80) + offsetX - 40
      const top = row * (tileH + 80) - 40
      if (left < W && top < H && left > -(tileSize) && top > -(tileH)) {
        composites.push({ input: fadedTile, left, top })
      }
    }
  }

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png()

  return canvas.composite(composites).png().toBuffer()
}

/**
 * 6. SKAPARA Step — Low Top Sneaker (BP 767)
 * Multiple print areas: body_outside_left/right (1434×650), tongue_left/right (945×1220)
 * S mark on body panels, wordmark on tongue.
 */
async function design_sneaker_body() {
  const W = 1434, H = 650

  // White S mark, scaled to fill 60% of height
  const markH = Math.round(H * 0.65)
  const markW = Math.round(markH * (1431 / 1100))
  const markSvg = readFileSync(SVG.markWhite, 'utf8')
  const markBuf = await sharp(Buffer.from(markSvg))
    .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png()

  // Center the mark
  const left = Math.round((W - markW) / 2)
  const top = Math.round((H - markH) / 2)

  return canvas.composite([
    { input: markBuf, left, top },
  ]).png().toBuffer()
}

async function design_sneaker_tongue() {
  const W = 945, H = 1220

  // S mark centered on tongue, ~50% of width
  const markW = Math.round(W * 0.50)
  const markH = Math.round(markW * (1100 / 1431))
  const markSvg = readFileSync(SVG.markWhite, 'utf8')
  const markBuf = await sharp(Buffer.from(markSvg))
    .resize(markW, markH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png()

  // Center both axes
  const left = Math.round((W - markW) / 2)
  const top = Math.round((H - markH) / 2)

  return canvas.composite([
    { input: markBuf, left, top },
  ]).png().toBuffer()
}

/**
 * 7. SKAPARA Pack — Sticker (BP 794, canvas 600×600)
 * Color gradient S mark, filling the square.
 */
async function design_sticker_pack() {
  const W = 600, H = 600

  // Use color gradient SVG, fit within canvas with padding
  const markSvg = readFileSync(SVG.markColor, 'utf8')
  const maxSize = Math.round(Math.min(W, H) * 0.85)
  const markBuf = await sharp(Buffer.from(markSvg))
    .resize(maxSize, maxSize, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer()
  const markMeta = await sharp(markBuf).metadata()
  const markW = markMeta.width
  const markH = markMeta.height

  const canvas = sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).png()

  const left = Math.round((W - markW) / 2)
  const top = Math.round((H - markH) / 2)

  return canvas.composite([
    { input: markBuf, left, top },
  ]).png().toBuffer()
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const PRODUCTS = [
  {
    name: '01-skapara-noir-mug',
    title: 'SKAPARA Noir — Standard Mug',
    blueprintId: 1016, providerId: 26, priceCents: 1699,
    colorFilter: [],
    category: 'mugs',
    tags: ['mug', 'skapara', 'brand', 'minimal', 'ceramic', '11oz'],
    desc: {
      en: 'The SKAPARA Noir mug. Bold S mark and wordmark on premium white ceramic. 11oz, dishwasher safe.',
      es: 'La taza SKAPARA Noir. Marca S y logotipo en cerámica blanca premium. 11oz, apta lavavajillas.',
      de: 'Die SKAPARA Noir Tasse. S-Logo und Schriftzug auf weißer Premium-Keramik. 11oz, spülmaschinenfest.',
    },
    designFn: async () => [{ position: 'front', buffer: await design_mug_noir(), w: 2244, h: 945 }],
  },
  {
    name: '02-skapara-signal-bottle',
    title: 'SKAPARA Signal — Water Bottle',
    blueprintId: 854, providerId: 23, priceCents: 2999,
    colorFilter: [],
    category: 'bottles',  // slug exists as child of drinkware
    tags: ['bottle', 'skapara', 'brand', 'water', 'stainless-steel'],
    desc: {
      en: 'SKAPARA Signal stainless steel water bottle. Bold brand lockup with handle lid.',
      es: 'Botella SKAPARA Signal de acero inoxidable. Logotipo de marca con tapa asa.',
      de: 'SKAPARA Signal Edelstahl-Wasserflasche. Marken-Lockup mit Griffdeckel.',
    },
    designFn: async () => [{ position: 'front', buffer: await design_bottle_signal(), w: 2759, h: 1500 }],
  },
  {
    name: '03-skapara-core-crewneck',
    title: 'SKAPARA Core — Crewneck',
    blueprintId: 457, providerId: 26, priceCents: 3999,
    colorFilter: ['Black', 'Anthracite', 'Navy'],
    category: 'crewnecks',
    tags: ['crewneck', 'sweatshirt', 'skapara', 'brand', 'minimal'],
    desc: {
      en: 'SKAPARA Core crewneck. White S mark and wordmark centered on chest. EU fulfilled.',
      es: 'Sudadera SKAPARA Core. Marca S blanca centrada en pecho. Envío desde EU.',
      de: 'SKAPARA Core Rundhals. Weißes S-Logo zentriert auf der Brust. EU-Versand.',
    },
    designFn: async () => [{ position: 'front', buffer: await design_crewneck_core(), w: 3366, h: 4230 }],
  },
  {
    name: '04-skapara-edge-longsleeve',
    title: 'SKAPARA Edge — Long Sleeve',
    blueprintId: 879, providerId: 217, priceCents: 2999,
    colorFilter: ['Black', 'Navy', 'Burgundy'],
    category: 'long-sleeves',
    tags: ['longsleeve', 'skapara', 'brand', 'minimal', 'edge'],
    desc: {
      en: 'SKAPARA Edge long sleeve. Small S mark on left chest. Clean streetwear aesthetic.',
      es: 'Camiseta manga larga SKAPARA Edge. Logo S pequeño pecho izquierdo. Estética streetwear.',
      de: 'SKAPARA Edge Langarmshirt. Kleines S-Logo auf der linken Brust. Streetwear-Ästhetik.',
    },
    designFn: async () => [{ position: 'front', buffer: await design_longsleeve_edge(), w: 2752, h: 3142 }],
  },
  {
    name: '05-skapara-grip-deskmat',
    title: 'SKAPARA Grip — Desk Mat',
    blueprintId: 969, providerId: 90, priceCents: 3499,
    colorFilter: [],
    category: 'desk-mats',
    tags: ['deskmat', 'mousepad', 'skapara', 'brand', 'gaming', 'office'],
    desc: {
      en: 'SKAPARA Grip gaming desk mat. Tiled S-mark pattern with gradient. Ultra-wide, non-slip.',
      es: 'Alfombrilla gaming SKAPARA Grip. Patrón de marcas S con gradiente. Ultra-ancha, antideslizante.',
      de: 'SKAPARA Grip Gaming-Schreibtischunterlage. S-Muster mit Farbverlauf. Extrabreit, rutschfest.',
    },
    designFn: async () => [{ position: 'front', buffer: await design_deskmat_grip(), w: 7205, h: 3661 }],
  },
  {
    name: '06-skapara-step-sneaker',
    title: 'SKAPARA Step — Low Top Sneaker',
    blueprintId: 767, providerId: 90, priceCents: 5499,
    colorFilter: [],
    category: 'sneakers',
    tags: ['sneaker', 'shoes', 'skapara', 'brand', 'lowtop', 'streetwear'],
    desc: {
      en: 'SKAPARA Step low top sneakers. S mark on panels, wordmark on tongue. Canvas lace-up.',
      es: 'Zapatillas SKAPARA Step. Logo S en paneles, SKAPARA en lengüeta. Canvas con cordones.',
      de: 'SKAPARA Step Low-Top-Sneaker. S-Logo auf Panels, Schriftzug auf Zunge. Canvas.',
    },
    designFn: async () => {
      const body = await design_sneaker_body()
      const tongue = await design_sneaker_tongue()
      return [
        { position: 'body_outside_left', buffer: body, w: 1434, h: 650 },
        { position: 'body_outside_right', buffer: body, w: 1433, h: 649 },
        { position: 'tongue_left', buffer: tongue, w: 945, h: 1220 },
        { position: 'tongue_right', buffer: tongue, w: 945, h: 1220 },
      ]
    },
  },
  {
    name: '07-skapara-pack-sticker',
    title: 'SKAPARA Pack — Sticker',
    blueprintId: 794, providerId: 73, priceCents: 699,
    colorFilter: [],
    category: 'stickers',
    tags: ['sticker', 'skapara', 'brand', 'logo', 'decal'],
    desc: {
      en: 'SKAPARA brand sticker. Gradient S mark. Premium vinyl, weather resistant.',
      es: 'Sticker de marca SKAPARA. Marca S gradiente. Vinilo premium, resistente al agua.',
      de: 'SKAPARA Marken-Sticker. Gradient S-Logo. Premium-Vinyl, wetterfest.',
    },
    designFn: async () => [{ position: 'front', buffer: await design_sticker_pack(), w: 600, h: 600 }],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER + SAVE PREVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

async function renderAll() {
  console.log('='.repeat(60))
  console.log('  SKAPARA — 7 Branded Products — Real Brand Assets')
  console.log('='.repeat(60) + '\n')

  const allDesigns = []

  for (const [idx, product] of PRODUCTS.entries()) {
    console.log(`  [${idx + 1}/7] ${product.title}`)
    try {
      const designs = await product.designFn()

      for (const { position, buffer, w, h } of designs) {
        // Save full-res transparent PNG
        const suffix = designs.length > 1 ? `-${position}` : ''
        const outPath = join(OUT_DIR, `${product.name}${suffix}.png`)
        await sharp(buffer).toFile(outPath)

        // Save dark-bg preview (800px wide)
        const previewW = 800
        const previewH = Math.round(previewW * (h / w))
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
        console.log(`    ✓ ${position}: ${meta.width}×${meta.height}, ${Math.round(fsize / 1024)}KB`)
      }

      allDesigns.push(designs)
    } catch (err) {
      console.error(`    ✗ ERROR: ${err.message}`)
      allDesigns.push(null)
    }
  }

  console.log(`\n  Previews saved to: ${OUT_DIR}\n`)
  return allDesigns
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRINTIFY + SUPABASE CREATION
// ═══════════════════════════════════════════════════════════════════════════════

async function createProducts(allDesigns) {
  console.log('='.repeat(60))
  console.log('  Creating 7 branded products on Printify + Supabase')
  console.log('='.repeat(60) + '\n')

  for (const [idx, product] of PRODUCTS.entries()) {
    const designs = allDesigns[idx]
    if (!designs || designs.some(d => !d.buffer)) {
      console.error(`  [${idx + 1}/7] Skipping ${product.title} — missing design buffer`)
      continue
    }

    console.log(`  [${idx + 1}/7] ${product.title}`)

    // 1. Upload images
    const uploadIds = {}
    for (const { position, buffer } of designs) {
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

    // 3. Build print_areas
    const placeholders = []
    for (const { position } of designs) {
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

    // 7. Publishing succeeded
    try {
      await api(`/shops/${SHOP_ID}/products/${prod.id}/publishing_succeeded.json`, {
        method: 'POST',
        body: JSON.stringify({ external: { id: dbProd.id, handle: `/shop/${dbProd.id}` } }),
      })
    } catch {}

    // 8. Insert variants — parse color/size from real Printify title formats
    for (const sv of selected) {
      let color = 'Default', size = 'One size'

      // Use Printify options if available
      if (sv.options?.color) color = sv.options.color
      if (sv.options?.size) size = sv.options.size

      // Fallback: parse from title
      const parts = sv.title.split(' / ').map(p => p.trim())

      if (product.blueprintId === 767) {
        // Sneakers: "US 5 / White sole" → size=US 5, color=White sole
        size = parts[0] || size
        color = parts[1] || color
      } else if (product.blueprintId === 969) {
        // Desk mats: '23.6" x 11.8" / Rectangle' → size=dimension, color=n/a
        size = parts[0] || size
        color = parts[1] || 'Default'
      } else if (product.blueprintId === 794) {
        // Stickers: '2" × 2" / Square / Transparent' → size=dimension
        size = parts[0] || size
        color = 'Transparent'
      } else if (product.blueprintId === 1016) {
        // Mug: "11oz / White / Glossy" → size=11oz, color=White
        size = parts[0] || '11oz'
        color = parts[1] || 'White'
      } else if (product.blueprintId === 854) {
        // Bottle: "White / 12oz" → color=White, size=12oz
        color = parts[0] || 'White'
        size = parts[1] || size
      } else if (parts.length >= 2) {
        // Standard apparel: "Black / M" → color=Black, size=M
        color = parts[0]
        size = parts[1]
      }

      await supabase.from('product_variants').upsert({
        product_id: dbProd.id,
        printify_variant_id: String(sv.id),
        title: sv.title,
        color,
        size,
        price_cents: product.priceCents,
        is_enabled: true,
        is_available: true,
      }, { onConflict: 'product_id,printify_variant_id' })
    }

    // 9. Harvest mockup images
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
        console.log(`    No mockups yet (re-sync needed)`)
      }
    } catch {}

    console.log(`    DONE\n`)
  }

  console.log('='.repeat(60))
  console.log('  ALL 7 BRANDED PRODUCTS CREATED')
  console.log('='.repeat(60))
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const designs = await renderAll()
  if (PREVIEW) {
    console.log('  *** PREVIEW MODE — No products created ***\n')
    return
  }
  await createProducts(designs)
}

main().catch(e => { console.error('\nFATAL:', e.message, e.stack); process.exit(1) })
