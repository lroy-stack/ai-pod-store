/**
 * Embroidery constraints and thread color definitions.
 * Based on Printful embroidery specifications (Madeira Polyneon palette).
 */

export interface ThreadColor {
  name: string
  hex: string
  threadCode: string
}

/** Standard 15-color Madeira Polyneon palette available for embroidery */
export const MADEIRA_THREADS: ThreadColor[] = [
  { name: 'Black', hex: '#000000', threadCode: '1800' },
  { name: 'White', hex: '#FFFFFF', threadCode: '1801' },
  { name: 'Navy', hex: '#1B2A4A', threadCode: '1843' },
  { name: 'Royal Blue', hex: '#1A3C8D', threadCode: '1842' },
  { name: 'Red', hex: '#C41E3A', threadCode: '1839' },
  { name: 'Burgundy', hex: '#6D1A36', threadCode: '1840' },
  { name: 'Forest Green', hex: '#1B4D3E', threadCode: '1852' },
  { name: 'Kelly Green', hex: '#2E8B57', threadCode: '1851' },
  { name: 'Gold', hex: '#D4A017', threadCode: '1870' },
  { name: 'Orange', hex: '#E65100', threadCode: '1878' },
  { name: 'Pink', hex: '#E91E63', threadCode: '1816' },
  { name: 'Purple', hex: '#5B2C6F', threadCode: '1832' },
  { name: 'Silver Grey', hex: '#9E9E9E', threadCode: '1811' },
  { name: 'Charcoal', hex: '#424242', threadCode: '1813' },
  { name: 'Cream', hex: '#F5F5DC', threadCode: '1812' },
]

/** Maximum thread colors per design */
export const MAX_THREAD_COLORS = 6

/** Minimum embroidery dimensions (in mm) */
export const MIN_TEXT_SIZE_MM = 5
export const MIN_LINE_WIDTH_MM = 1.5

/** Embroidery area limits per placement (in mm) */
export const EMBROIDERY_AREA_LIMITS: Record<string, { width: number; height: number }> = {
  chest_left: { width: 100, height: 100 },
  chest_center: { width: 255, height: 152 },
  chest_center_large: { width: 255, height: 152 },
  wrist: { width: 63, height: 25 },
  hat_front: { width: 127, height: 45 },
  hat_front_knit: { width: 127, height: 45 },
  hat_back: { width: 50, height: 25 },
  bucket_hat: { width: 127, height: 50 },
}

/** Check if a product uses embroidery technique based on its metadata */
export function isEmbroideryProduct(product: {
  productType?: string
  category?: string
  print_technique?: string
  product_details?: { print_technique?: string } | null
}): boolean {
  if (product.print_technique === 'embroidery') return true
  if (product.product_details?.print_technique === 'embroidery') return true
  // Hat categories are typically embroidered
  const hatCategories = ['hats', 'caps', 'snapbacks', 'dad-hats', 'beanies', 'bucket-hats']
  const cat = (product.category || '').toLowerCase()
  return hatCategories.includes(cat)
}
