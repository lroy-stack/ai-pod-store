/**
 * Canonical size ordering for apparel products.
 * Sizes not in this map sort alphabetically at the end.
 */
const SIZE_ORDER: Record<string, number> = {
  'XXS': 1, '2XS': 1,
  'XS': 2,
  'S': 3,
  'M': 4,
  'L': 5,
  'XL': 6,
  'XXL': 7, '2XL': 7,
  '3XL': 8, 'XXXL': 8,
  '4XL': 9,
  '5XL': 10,
  '6XL': 11,
  // Numeric sizes (mugs, shoes, etc.) sort by parsed number
}

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const oa = SIZE_ORDER[a.toUpperCase()]
    const ob = SIZE_ORDER[b.toUpperCase()]

    // Both in the map — compare by rank
    if (oa !== undefined && ob !== undefined) return oa - ob

    // One in map, other not — mapped ones first
    if (oa !== undefined) return -1
    if (ob !== undefined) return 1

    // Neither in map — try numeric parse (e.g. "11oz", "15oz", "42")
    const na = parseFloat(a)
    const nb = parseFloat(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb

    // Fallback: alphabetical
    return a.localeCompare(b)
  })
}
