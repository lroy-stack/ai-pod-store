/**
 * @deprecated This module is deprecated as of Feature #51.
 *
 * Products now use category_id (UUID FK to categories table) instead of VARCHAR category.
 * API routes should join with categories table and use categories.slug directly.
 *
 * DO NOT import this module in new code.
 *
 * ---
 *
 * LEGACY: Canonical category normalization.
 *
 * The DB may store categories in varied formats (Titlecase, spaces, ampersands).
 * This module maps every known variant to a single canonical kebab-case key
 * that matches the i18n keys in messages/{locale}.json → shop.category.*.
 *
 * Usage:  import { normalizeCategory } from '@/lib/categories'
 *         const cat = normalizeCategory(product.category)  // "home-decor"
 */

const CATEGORY_ALIASES: Record<string, string> = {
  // home-decor variants
  'home & living': 'home-decor',
  'home and living': 'home-decor',
  'home': 'home-decor',
  'home-living': 'home-decor',
  'hogar': 'home-decor',
  'casa': 'home-decor',
  // apparel variants
  'clothing': 'apparel',
  'ropa': 'apparel',
  // drinkware variants
  'mugs': 'mugs',
  'cups': 'drinkware',
  // pass-through (already canonical)
  'apparel': 'apparel',
  'accessories': 'accessories',
  'drinkware': 'drinkware',
  't-shirts': 't-shirts',
  'hoodies': 'hoodies',
  'stickers': 'stickers',
  'phone-cases': 'phone-cases',
  'posters': 'posters',
  'bags': 'bags',
  'hats': 'hats',
  'wall-art': 'wall-art',
  'stationery': 'stationery',
  'sweatshirts': 'sweatshirts',
  'kitchen': 'kitchen',
  'kids': 'kids',
  'games': 'games',
  'home-decor': 'home-decor',
}

/**
 * Normalize a raw DB category to its canonical kebab-case key.
 * Returns the canonical key or the lowercased input if no alias matches.
 */
export function normalizeCategory(raw: string | null | undefined): string {
  if (!raw) return 'other'
  const key = raw.trim().toLowerCase()
  return CATEGORY_ALIASES[key] ?? key
}
