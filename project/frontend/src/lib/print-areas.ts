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
  'hats': 'tshirt',
  'home-decor': 'tshirt',
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
}

/** Get the CSS preview zone for a product category (for frontend overlay) */
export function getPreviewZone(category?: string | null): PreviewZone {
  const key = (category || '').toLowerCase().trim()
  const type = CATEGORY_TO_PRODUCT_TYPE[key] || 'tshirt'
  return CSS_PREVIEW_ZONES[type] || CSS_PREVIEW_ZONES['tshirt']
}
