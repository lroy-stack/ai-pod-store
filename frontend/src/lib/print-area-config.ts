/**
 * Print area configuration for the Design Studio canvas.
 *
 * The canvas aspect ratio now matches the real product print area (derived from
 * PRODUCTION_DIMENSIONS). The print area guide is simply the canvas with padding,
 * since the canvas itself represents the printable surface.
 */

import { PRINT_AREAS, MULTI_PANEL_AREAS, CATEGORY_TO_PRODUCT_TYPE, type PrintArea } from '@/lib/print-areas'

/** Padding fraction around the print area within the canvas (10% each side) */
const PRINT_AREA_PADDING = 0.1

/**
 * Get the print area rectangle for the canvas (with visual padding).
 * Since the canvas aspect ratio already matches the product, the print area
 * is the canvas minus padding.
 */
export function getCanvasPrintArea(
  _productCategory: string,
  canvasWidth: number,
  canvasHeight: number,
  _panelId: string = 'front'
): { left: number; top: number; width: number; height: number } {
  return {
    left: Math.round(canvasWidth * PRINT_AREA_PADDING),
    top: Math.round(canvasHeight * PRINT_AREA_PADDING),
    width: Math.round(canvasWidth * (1 - 2 * PRINT_AREA_PADDING)),
    height: Math.round(canvasHeight * (1 - 2 * PRINT_AREA_PADDING)),
  }
}

/**
 * Get the product type key from a category string.
 */
export function getProductTypeFromCategory(category: string): string {
  const key = (category || '').toLowerCase().trim()
  return CATEGORY_TO_PRODUCT_TYPE[key] || 'tshirt'
}

/**
 * Get the raw print area (unscaled, 1024×1024 reference) for a product type.
 * Kept for backward compatibility with composition-renderer and mockup-generator.
 */
export function getRawPrintArea(productType: string, panelId: string = 'front'): PrintArea {
  const multiPanels = MULTI_PANEL_AREAS[productType]
  if (multiPanels && multiPanels[panelId]) {
    return multiPanels[panelId]
  }
  return PRINT_AREAS[productType] || PRINT_AREAS['tshirt']
}

/**
 * Get available panels for a product type.
 */
export function getAvailablePanels(productType: string): string[] {
  const multiPanels = MULTI_PANEL_AREAS[productType]
  if (multiPanels) {
    return Object.keys(multiPanels)
  }
  return ['front']
}
