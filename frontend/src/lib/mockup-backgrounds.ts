/**
 * Branded mockup background templates per product category.
 * Each template is a 1200×1200 SVG rendered with Sharp for product composition.
 *
 * Background strategy:
 * - Garments (t-shirts, hoodies, crewnecks, LS): Navy→charcoal gradient (premium)
 * - Headwear (caps, hats, beanies): Warm kraft/paper texture
 * - Drinkware (mugs, tumblers, glasses): Wood surface
 * - Accessories (totes, desk mats, etc.): Sand/beige gradient
 * - Kids: Soft pastel gradient
 * - Shoes/sneakers: Urban gray gradient
 */

export interface MockupBackground {
  id: string
  name: string
  /** SVG string at 1200×1200 */
  svg: string
  /** Where the product image sits on the canvas */
  productZone: { x: number; y: number; w: number; h: number }
  /** Category slugs that use this background */
  categories: string[]
}

// ── Brand colors ────────────────────────────────────────────────────────────
const NAVY = '#0F172A'
const CHARCOAL = '#1E293B'
const SLATE = '#334155'
const WARM_WHITE = '#F0EDE8'
const SAND = '#D4C8B8'
const KRAFT = '#C4A882'
const TURQUOISE = '#40ACCC'
const WOOD_LIGHT = '#A0845C'
const WOOD_MID = '#8B7355'
const WOOD_DARK = '#5C4033'
const MARBLE_LIGHT = '#E8E4E0'
const MARBLE_DARK = '#3A3A3A'
const PASTEL_PINK = '#FCE4EC'
const PASTEL_BLUE = '#E3F2FD'

// ── Brand mark (name at low opacity) ────────────────────────
const brandMarkName = process.env.NEXT_PUBLIC_SITE_NAME!
function brandMark(color: string = WARM_WHITE, opacity: number = 0.12): string {
  return `<text x="1140" y="1160" font-family="'Courier New', monospace" font-size="28" font-weight="bold" fill="${color}" opacity="${opacity}" text-anchor="end">${brandMarkName}</text>`
}

// ── Subtle drop shadow for product (placed UNDER product zone) ──────────────
function dropShadow(): string {
  return `<defs>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="20" result="blur"/>
      <feOffset dx="0" dy="8" result="offsetBlur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`
}

// ── Template: Navy Gradient (garments — t-shirts, crewnecks, long sleeves) ──
const navyGradient: MockupBackground = {
  id: 'navy-gradient',
  name: 'Navy Gradient',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${NAVY}"/>
      <stop offset="100%" stop-color="${CHARCOAL}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="45%">
      <stop offset="0%" stop-color="${SLATE}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${NAVY}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#glow)"/>
  ${brandMark(WARM_WHITE, 0.10)}
</svg>`,
  productZone: { x: 150, y: 100, w: 900, h: 950 },
  categories: ['t-shirts', 'crewnecks', 'long-sleeves'],
}

// ── Template: Warm Gray (hoodies, zip hoodies) ──────────────────────────────
const warmGray: MockupBackground = {
  id: 'warm-gray',
  name: 'Warm Gray',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2D2D2D"/>
      <stop offset="100%" stop-color="#1A1A2E"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#3D3D3D" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#1A1A2E" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#glow)"/>
  ${brandMark(WARM_WHITE, 0.10)}
</svg>`,
  productZone: { x: 120, y: 80, w: 960, h: 1000 },
  categories: ['pullover-hoodies', 'zip-hoodies', 'hoodies-sweatshirts'],
}

// ── Template: Kraft Paper (headwear — caps, hats, beanies) ──────────────────
const kraftPaper: MockupBackground = {
  id: 'kraft-paper',
  name: 'Kraft Paper',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${SAND}"/>
      <stop offset="50%" stop-color="${KRAFT}"/>
      <stop offset="100%" stop-color="#B8976A"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <!-- subtle grain texture -->
  <filter id="grain"><feTurbulence baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  <rect width="1200" height="1200" filter="url(#grain)" opacity="0.04"/>
  ${brandMark(WOOD_DARK, 0.15)}
</svg>`,
  productZone: { x: 200, y: 200, w: 800, h: 750 },
  categories: ['caps', 'snapbacks', 'dad-hats', '5-panel-caps', 'beanies', 'bucket-hats', 'headwear'],
}

// ── Template: Wood Surface Light (mugs, coasters) ───────────────────────────
const woodLight: MockupBackground = {
  id: 'wood-light',
  name: 'Light Wood Surface',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D4B896"/>
      <stop offset="50%" stop-color="#C4A882"/>
      <stop offset="100%" stop-color="#B8976A"/>
    </linearGradient>
    <!-- wood grain lines -->
    <pattern id="grain" width="200" height="1200" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="1200" stroke="#B8956A" stroke-width="0.5" opacity="0.15"/>
      <line x1="40" y1="0" x2="35" y2="1200" stroke="#B8956A" stroke-width="0.3" opacity="0.10"/>
      <line x1="95" y1="0" x2="100" y2="1200" stroke="#B8956A" stroke-width="0.4" opacity="0.12"/>
      <line x1="150" y1="0" x2="145" y2="1200" stroke="#B8956A" stroke-width="0.3" opacity="0.08"/>
    </pattern>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#grain)"/>
  ${brandMark(WOOD_DARK, 0.18)}
</svg>`,
  productZone: { x: 200, y: 150, w: 800, h: 850 },
  categories: ['mugs'],
}

// ── Template: Dark Wood (pint glasses, bar context) ─────────────────────────
const woodDark: MockupBackground = {
  id: 'wood-dark',
  name: 'Dark Wood Surface',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4A3728"/>
      <stop offset="50%" stop-color="${WOOD_DARK}"/>
      <stop offset="100%" stop-color="#3A2A1C"/>
    </linearGradient>
    <pattern id="grain" width="200" height="1200" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="1200" stroke="#6B5543" stroke-width="0.5" opacity="0.2"/>
      <line x1="60" y1="0" x2="55" y2="1200" stroke="#6B5543" stroke-width="0.3" opacity="0.12"/>
      <line x1="130" y1="0" x2="135" y2="1200" stroke="#6B5543" stroke-width="0.4" opacity="0.15"/>
    </pattern>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#grain)"/>
  ${brandMark(WARM_WHITE, 0.10)}
</svg>`,
  productZone: { x: 200, y: 100, w: 800, h: 900 },
  categories: ['drinkware'],
}

// ── Template: Dark Marble (wine tumblers, premium) ──────────────────────────
const darkMarble: MockupBackground = {
  id: 'dark-marble',
  name: 'Dark Marble',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${MARBLE_DARK}"/>
      <stop offset="50%" stop-color="#2E2E2E"/>
      <stop offset="100%" stop-color="#1A1A1A"/>
    </linearGradient>
    <radialGradient id="vein" cx="30%" cy="60%" r="50%">
      <stop offset="0%" stop-color="#555" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="${MARBLE_DARK}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#vein)"/>
  ${brandMark(WARM_WHITE, 0.10)}
</svg>`,
  productZone: { x: 200, y: 100, w: 800, h: 900 },
  categories: ['tumblers', 'bottles'],
}

// ── Template: Sand/Beige (tote bags, eco/natural) ───────────────────────────
const sandBeige: MockupBackground = {
  id: 'sand-beige',
  name: 'Sand Beige',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E8DDD0"/>
      <stop offset="100%" stop-color="${SAND}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  ${brandMark(WOOD_DARK, 0.15)}
</svg>`,
  productZone: { x: 150, y: 100, w: 900, h: 950 },
  categories: ['tote-bags'],
}

// ── Template: Urban Gray (sneakers, street) ─────────────────────────────────
const urbanGray: MockupBackground = {
  id: 'urban-gray',
  name: 'Urban Gray',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#383838"/>
      <stop offset="100%" stop-color="#1F1F1F"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="50%" r="40%">
      <stop offset="0%" stop-color="#4A4A4A" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#1F1F1F" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#spot)"/>
  ${brandMark(WARM_WHITE, 0.10)}
</svg>`,
  productZone: { x: 100, y: 150, w: 1000, h: 850 },
  categories: ['sneakers', 'shoes'],
}

// ── Template: Desk Surface (desk mats, mouse pads, laptop sleeves) ──────────
const deskSurface: MockupBackground = {
  id: 'desk-surface',
  name: 'Desk Surface',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C4A882"/>
      <stop offset="100%" stop-color="#A0845C"/>
    </linearGradient>
    <pattern id="grain" width="300" height="1200" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="1200" stroke="${WOOD_MID}" stroke-width="0.4" opacity="0.12"/>
      <line x1="80" y1="0" x2="75" y2="1200" stroke="${WOOD_MID}" stroke-width="0.3" opacity="0.08"/>
      <line x1="180" y1="0" x2="185" y2="1200" stroke="${WOOD_MID}" stroke-width="0.35" opacity="0.10"/>
    </pattern>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <rect width="1200" height="1200" fill="url(#grain)"/>
  ${brandMark(WOOD_DARK, 0.18)}
</svg>`,
  productZone: { x: 100, y: 150, w: 1000, h: 850 },
  categories: ['desk-mats', 'mouse-pads', 'laptop-sleeves'],
}

// ── Template: Soft Pastel (kids products) ───────────────────────────────────
const softPastel: MockupBackground = {
  id: 'soft-pastel',
  name: 'Soft Pastel',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PASTEL_BLUE}"/>
      <stop offset="100%" stop-color="${PASTEL_PINK}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  ${brandMark('#666', 0.12)}
</svg>`,
  productZone: { x: 150, y: 100, w: 900, h: 950 },
  categories: ['kids', 'kids-tshirts', 'kids-sweatshirts', 'baby-clothing'],
}

// ── Template: Sticker Surface (stickers — clean white with accent) ──────────
const stickerSurface: MockupBackground = {
  id: 'sticker-surface',
  name: 'Sticker Surface',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F8F8F8"/>
      <stop offset="100%" stop-color="#ECECEC"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <!-- subtle turquoise accent line at bottom -->
  <rect x="0" y="1170" width="1200" height="4" fill="${TURQUOISE}" opacity="0.3"/>
  ${brandMark('#999', 0.12)}
</svg>`,
  productZone: { x: 200, y: 150, w: 800, h: 850 },
  categories: ['stickers'],
}

// ── Template: Clean White Fallback ──────────────────────────────────────────
const cleanWhite: MockupBackground = {
  id: 'clean-white',
  name: 'Clean White',
  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  ${dropShadow()}
  <rect width="1200" height="1200" fill="#FAFAFA"/>
  ${brandMark('#BBB', 0.10)}
</svg>`,
  productZone: { x: 150, y: 100, w: 900, h: 950 },
  categories: ['phone-cases', 'socks', 'accessories'],
}

// ── Template: Tank Tops (same as t-shirts) ──────────────────────────────────
const tankTop: MockupBackground = {
  id: 'tank-top',
  name: 'Tank Top Navy',
  svg: navyGradient.svg,
  productZone: { x: 150, y: 100, w: 900, h: 950 },
  categories: ['tank-tops'],
}

// ── All templates ───────────────────────────────────────────────────────────

export const MOCKUP_BACKGROUNDS: MockupBackground[] = [
  navyGradient,
  warmGray,
  kraftPaper,
  woodLight,
  woodDark,
  darkMarble,
  sandBeige,
  urbanGray,
  deskSurface,
  softPastel,
  stickerSurface,
  cleanWhite,
  tankTop,
]

/**
 * Find the background template for a given category slug.
 * Falls back to cleanWhite if no match found.
 */
export function getBackgroundForCategory(categorySlug: string): MockupBackground {
  const slug = categorySlug.toLowerCase().trim()

  // Direct match
  for (const bg of MOCKUP_BACKGROUNDS) {
    if (bg.categories.includes(slug)) return bg
  }

  // Parent category match for child slugs
  const parentMappings: Record<string, string> = {
    'apparel': 'navy-gradient',
    'headwear': 'kraft-paper',
    'drinkware': 'wood-dark',
    'accessories': 'clean-white',
    'shoes': 'urban-gray',
    'kids': 'soft-pastel',
  }

  if (parentMappings[slug]) {
    return MOCKUP_BACKGROUNDS.find(bg => bg.id === parentMappings[slug]) || cleanWhite
  }

  return cleanWhite
}
