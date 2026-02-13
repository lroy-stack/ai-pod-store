/**
 * Locale-aware currency formatting utilities
 */

// Map of supported locales to their default currencies
const LOCALE_CURRENCY_MAP: Record<string, string> = {
  en: 'USD',
  es: 'EUR',
  de: 'EUR',
}

// Map of locales to their Intl.NumberFormat locale codes
const LOCALE_FORMAT_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
}

/**
 * Get the default currency for a given locale
 */
export function getCurrencyForLocale(locale: string): string {
  return LOCALE_CURRENCY_MAP[locale] || 'USD'
}

/**
 * Get the Intl.NumberFormat locale code for a given locale
 */
export function getFormatLocale(locale: string): string {
  return LOCALE_FORMAT_MAP[locale] || 'en-US'
}

/**
 * Format a price amount in the appropriate currency for the given locale
 *
 * @param price - The numeric price to format
 * @param locale - The current locale (en, es, de)
 * @param currency - Optional currency override (defaults to locale's currency)
 * @returns Formatted price string (e.g., "$24.99", "24,99 €")
 */
export function formatPrice(
  price: number,
  locale: string,
  currency?: string
): string {
  const currencyCode = currency || getCurrencyForLocale(locale)
  const formatLocale = getFormatLocale(locale)

  return new Intl.NumberFormat(formatLocale, {
    style: 'currency',
    currency: currencyCode,
  }).format(price)
}

/**
 * Convert a price from one currency to another (placeholder for future API integration)
 * For now, uses simplified conversion rates
 *
 * @param price - The price to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted price
 */
export function convertPrice(
  price: number,
  fromCurrency: string,
  toCurrency: string
): number {
  // Simplified conversion rates (in production, use real-time exchange rates API)
  const rates: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
  }

  if (fromCurrency === toCurrency) {
    return price
  }

  // Convert to USD first, then to target currency
  const usdAmount = price / (rates[fromCurrency] || 1)
  return usdAmount * (rates[toCurrency] || 1)
}

/**
 * Get the price for a product in the user's locale currency
 *
 * @param basePrice - The base price (typically in USD)
 * @param baseCurrency - The currency of the base price
 * @param locale - The current locale
 * @returns Price converted to locale's currency
 */
export function getLocalizedPrice(
  basePrice: number,
  baseCurrency: string,
  locale: string
): number {
  const targetCurrency = getCurrencyForLocale(locale)
  return convertPrice(basePrice, baseCurrency, targetCurrency)
}
