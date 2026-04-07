/**
 * Locale-aware currency formatting utilities
 */

import { LOCALE_CURRENCY, LOCALE_FORMAT, STORE_DEFAULTS } from './store-config'

/**
 * Get the default currency for a given locale
 */
export function getCurrencyForLocale(locale: string): string {
  return LOCALE_CURRENCY[locale] || STORE_DEFAULTS.currency
}

/**
 * Get the Intl.NumberFormat locale code for a given locale
 */
export function getFormatLocale(locale: string): string {
  return LOCALE_FORMAT[locale] || LOCALE_FORMAT['en']
}

/**
 * Format a price amount in the appropriate currency for the given locale
 *
 * @param price - The numeric price to format
 * @param locale - The current locale (en, es, de)
 * @param currency - Optional currency override (defaults to locale's currency)
 * @returns Formatted price string (e.g., "24,99 €")
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
 * Get the currency symbol for a given currency code
 *
 * @param currency - ISO 4217 currency code (e.g., 'EUR', 'USD')
 * @param locale - Locale for formatting (defaults to 'en')
 * @returns Currency symbol (e.g., '€', '$')
 */
export function getCurrencySymbol(currency: string, locale: string = 'en'): string {
  const formatLocale = getFormatLocale(locale)
  return new Intl.NumberFormat(formatLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0).replace(/[\d\s.,]/g, '').trim()
}

/**
 * Convert a price from one currency to another (placeholder for future API integration)
 * For now, uses simplified conversion rates rebased to EUR
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
  // Simplified conversion rates relative to EUR (in production, use real-time exchange rates API)
  const rates: Record<string, number> = {
    EUR: 1.0,
    USD: 1.09,
    GBP: 0.86,
  }

  if (fromCurrency === toCurrency) {
    return price
  }

  // Convert to EUR first, then to target currency
  const eurAmount = price / (rates[fromCurrency] || 1)
  return eurAmount * (rates[toCurrency] || 1)
}

/**
 * Get the price for a product in the user's locale currency
 *
 * @param basePrice - The base price (typically in EUR)
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
