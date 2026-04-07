/**
 * Shared product helpers — used across multiple MCP tools.
 * Eliminates code duplication for image extraction, price formatting, etc.
 */

/**
 * Extract the first image URL from a product's images JSONB array.
 * Handles multiple formats: {src}, {url}, or plain string.
 */
export function extractFirstImage(images: unknown): string {
  if (!Array.isArray(images) || images.length === 0) return '';
  const first = images[0];
  if (typeof first === 'string') return first;
  if (first && typeof first === 'object') {
    return (first as Record<string, unknown>).src as string
      || (first as Record<string, unknown>).url as string
      || '';
  }
  return '';
}

/**
 * Convert cents to decimal price.
 */
export function centsToDecimal(cents: number | null | undefined): number {
  return (cents || 0) / 100;
}

/**
 * Normalize currency to uppercase.
 */
export function normalizeCurrency(currency: string | null | undefined): string {
  return (currency || 'EUR').toUpperCase();
}

/**
 * ISO 3166-1 alpha-2 country codes supported for shipping.
 * Matches shipping_zones table entries.
 */
export const SUPPORTED_COUNTRY_CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'GB', 'CH', 'NO', 'US', 'CA', 'AU',
] as const;

export type CountryCode = typeof SUPPORTED_COUNTRY_CODES[number];

/**
 * Wrap user-generated content with boundary markers.
 * Helps LLMs distinguish system data from untrusted user input.
 */
export function userContent(value: string | null | undefined): string {
  if (!value) return '';
  return `[USER_CONTENT]${value}[/USER_CONTENT]`;
}
