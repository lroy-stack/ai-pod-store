/**
 * Shared constants for the POD abstraction layer.
 */

/** Store currency — all prices are in EUR */
export const STORE_CURRENCY = 'EUR'

/** USD to EUR conversion rate (approximate, updated periodically) */
export const USD_TO_EUR = 0.92

/** Minimum acceptable margin percentage (35%) */
export const MIN_MARGIN_THRESHOLD = 0.35

/** Maximum items per page for provider list requests */
export const MAX_PAGE_SIZE = 50

/** EU country codes (ISO 3166-1 alpha-2) */
export const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
])
