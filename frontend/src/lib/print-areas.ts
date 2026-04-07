/**
 * Print area definitions shared between mockup generator and frontend components.
 *
 * Coordinates are in pixels on a 1024x1024 canvas.
 * These map directly to the physical print zones of each product type.
 */

export interface PrintArea {
  x: number
  y: number
  w: number
  h: number
}

/** Print area definitions (x, y, width, height in px on a 1024×1024 template) */
export const PRINT_AREAS: Record<string, PrintArea> = {
  'tshirt':     { x: 312, y: 200, w: 400, h: 500 },
  'hoodie':     { x: 300, y: 220, w: 420, h: 480 },
  'mug':        { x: 150, y: 180, w: 350, h: 300 },
  'phone-case': { x: 100, y: 150, w: 300, h: 550 },
  'tote-bag':   { x: 200, y: 150, w: 400, h: 500 },
  'hat':        { x: 262, y: 280, w: 500, h: 280 },
}

/** Multi-panel print areas per product type (1024×1024 reference) */
export const MULTI_PANEL_AREAS: Record<string, Record<string, PrintArea>> = {
  'tshirt': {
    front: { x: 312, y: 200, w: 400, h: 500 },
    back:  { x: 262, y: 150, w: 500, h: 600 },
  },
  'hoodie': {
    front:        { x: 300, y: 220, w: 420, h: 480 },
    back:         { x: 262, y: 150, w: 500, h: 600 },
    left_sleeve:  { x: 362, y: 300, w: 300, h: 200 },
    right_sleeve: { x: 362, y: 300, w: 300, h: 200 },
  },
  'mug': {
    front: { x: 150, y: 180, w: 350, h: 300 },
  },
  'phone-case': {
    front: { x: 100, y: 150, w: 300, h: 550 },
  },
  'tote-bag': {
    front: { x: 200, y: 150, w: 400, h: 500 },
    back:  { x: 200, y: 150, w: 400, h: 500 },
  },
  'hat': {
    front: { x: 262, y: 280, w: 500, h: 280 },
  },
}

/** Available template colors per product type */
export const TEMPLATE_COLORS: Record<string, string[]> = {
  'tshirt':     ['white', 'black'],
  'hoodie':     ['white', 'black'],
  'mug':        ['white'],
  'phone-case': ['black'],
  'tote-bag':   ['natural'],
}

/** Maps normalized product category to PRINT_AREAS key */
export const CATEGORY_TO_PRODUCT_TYPE: Record<string, string> = {
  'apparel': 'tshirt',
  't-shirts': 'tshirt',
  'hoodies': 'hoodie',
  'sweatshirts': 'hoodie',
  'mugs': 'mug',
  'drinkware': 'mug',
  'phone-cases': 'phone-case',
  'bags': 'tote-bag',
  'accessories': 'tote-bag',
  'posters': 'tshirt',
  'wall-art': 'tshirt',
  'stickers': 'tshirt',
  'stationery': 'tshirt',
  'kitchen': 'mug',
  'kids': 'tshirt',
  'hats': 'hat',
  'home-decor': 'tshirt',
  'pullover-hoodies': 'hoodie',
  'crewneck-sweatshirts': 'hoodie',
  'zip-hoodies': 'hoodie',
  'long-sleeve-shirts': 'tshirt',
  'caps': 'hat',
  'snapbacks': 'hat',
  'dad-hats': 'hat',
  'beanies': 'hat',
  'bucket-hats': 'hat',
  'tank-tops': 'tshirt',
  'bottles': 'mug',
  'tumblers': 'mug',
  'sneakers': 'tshirt',
  'desk-mats': 'tshirt',
  'baby-clothing': 'tshirt',
  'mouse-pads': 'tshirt',
  'tote-bags': 'tote-bag',
}

/** Get the print area for a product category */
export function getPrintArea(category?: string | null): PrintArea {
  const key = (category || '').toLowerCase().trim()
  const type = CATEGORY_TO_PRODUCT_TYPE[key] || 'tshirt'
  return PRINT_AREAS[type] || PRINT_AREAS['tshirt']
}

/**
 * Convert a PrintArea to CSS percentage values (relative to a square container).
 * Used by mockup-generator for server-side rendering on the 1024×1024 canvas.
 */
export function printAreaToCSS(area: PrintArea) {
  const canvasSize = 1024
  return {
    left: `${(area.x / canvasSize) * 100}%`,
    top: `${(area.y / canvasSize) * 100}%`,
    width: `${(area.w / canvasSize) * 100}%`,
    height: `${(area.h / canvasSize) * 100}%`,
  }
}

/**
 * CSS preview zones for the frontend text overlay on real Printify product photos.
 *
 * These are DIFFERENT from PRINT_AREAS — they define where the printable zone
 * appears visually in typical Printify product photography (flat-lay, on-model, etc.).
 * Values are CSS percentages relative to the product image container.
 */
export interface PreviewZone {
  top: string
  left: string
  width: string
  height: string
}

export const CSS_PREVIEW_ZONES: Record<string, PreviewZone> = {
  'tshirt':     { top: '28%', left: '27%', width: '46%', height: '34%' },
  'hoodie':     { top: '32%', left: '25%', width: '50%', height: '30%' },
  'mug':        { top: '22%', left: '8%',  width: '56%', height: '48%' },
  'phone-case': { top: '14%', left: '18%', width: '64%', height: '62%' },
  'tote-bag':   { top: '34%', left: '20%', width: '60%', height: '44%' },
  'hat':        { top: '30%', left: '20%', width: '60%', height: '30%' },
}

/** Get the CSS preview zone for a product category (for frontend overlay) */
export function getPreviewZone(category?: string | null): PreviewZone {
  const key = (category || '').toLowerCase().trim()
  const type = CATEGORY_TO_PRODUCT_TYPE[key] || 'tshirt'
  return CSS_PREVIEW_ZONES[type] || CSS_PREVIEW_ZONES['tshirt']
}

// ── Unified personalization rendering constants ────────────────────────

/** Consistent line height across preview, server-render, and production */
export const LINE_HEIGHT = 1.3

/** Font size ratios relative to a base size (medium = 1.0) */
export const FONT_SIZE_RATIOS = { small: 0.67, medium: 1.0, large: 1.5 } as const

/** Compute pixel font size from a preset and base size */
export function computeFontSize(preset: 'small' | 'medium' | 'large', baseSize: number): number {
  return Math.round(baseSize * FONT_SIZE_RATIOS[preset])
}

/**
 * Production print dimensions per product type (in pixels).
 * Used when rendering final production-quality images for Printify.
 */
export const PRODUCTION_DIMENSIONS: Record<string, { w: number; h: number }> = {
  'tshirt':     { w: 3600, h: 4800 },
  'hoodie':     { w: 3000, h: 3600 },
  'mug':        { w: 2850, h: 1050 },
  'phone-case': { w: 750,  h: 1500 },
  'tote-bag':   { w: 3600, h: 3600 },
  'hat':        { w: 1650, h: 750 },
}

/**
 * Production font size ratios — medium = 8% of placeholder height.
 * Use with computeFontSize() for production-resolution text rendering.
 */
export function getProductionBaseFontSize(productType: string): number {
  const dims = PRODUCTION_DIMENSIONS[productType] || PRODUCTION_DIMENSIONS['tshirt']
  return Math.round(dims.h * 0.08)
}

/**
 * Get the real aspect ratio (width/height) for a product type.
 * Derived from PRODUCTION_DIMENSIONS which match actual print specs.
 */
export function getProductAspectRatio(productType: string, panelId: string = 'front'): number {
  // Check panel-specific overrides first
  const panelAR = PANEL_ASPECT_RATIOS[productType]?.[panelId]
  if (panelAR) return panelAR

  const dims = PRODUCTION_DIMENSIONS[productType]
  if (!dims) return 0.75 // default: t-shirt aspect ratio
  return dims.w / dims.h
}

/**
 * Per-panel aspect ratios where they differ from the base product.
 * Sleeves are wider than front/back panels.
 */
export const PANEL_ASPECT_RATIOS: Record<string, Record<string, number>> = {
  hoodie: {
    left_sleeve: 1.5,
    right_sleeve: 1.5,
  },
}
