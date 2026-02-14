/** Store-wide defaults — single source of truth */
export const STORE_DEFAULTS = {
  platformName: 'POD AI',
  storeName: 'POD AI Store',
  assistantName: 'POD AI Assistant',
  currency: 'EUR',
  country: 'DE',
  measurementUnit: 'cm',
  freeShippingThreshold: 50,
  stripeCurrency: 'eur',
  maxCartQuantity: 99,
} as const

/** Locale → default country (used when user has no saved address) */
export const LOCALE_COUNTRY: Record<string, string> = {
  en: 'IE',
  es: 'ES',
  de: 'DE',
}

/** Locale → Currency (expandible: add 'en-US': 'USD' for Americas) */
export const LOCALE_CURRENCY: Record<string, string> = {
  en: 'EUR',
  es: 'EUR',
  de: 'EUR',
}

/** Locale → Intl format code */
export const LOCALE_FORMAT: Record<string, string> = {
  en: 'en-IE',
  es: 'es-ES',
  de: 'de-DE',
}

/** Stripe allowed shipping countries (EU-first, expandible) */
export const ALLOWED_SHIPPING_COUNTRIES = [
  'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'GB', 'US', 'CA',
] as const

/** Pricing & Tier constants */
export const PRICING = {
  premium: { priceCents: 999, currency: 'EUR', label: 'Premium', period: 'month' },
  creditPacks: {
    small:  { credits: 15,  priceCents: 499 },
    medium: { credits: 50,  priceCents: 1499 },
    large:  { credits: 150, priceCents: 3999 },
  },
} as const

/** Shipping rates in store currency */
export const SHIPPING_RATES: Record<string, Array<{ method: string; price: number; days: string }>> = {
  DE: [
    { method: 'Standard', price: 3.99, days: '3-5 business days' },
    { method: 'Express', price: 9.99, days: '1-2 business days' },
  ],
  ES: [
    { method: 'Standard', price: 4.99, days: '4-6 business days' },
    { method: 'Express', price: 11.99, days: '2-3 business days' },
  ],
  FR: [
    { method: 'Standard', price: 4.99, days: '3-5 business days' },
    { method: 'Express', price: 11.99, days: '2-3 business days' },
  ],
  EU: [
    { method: 'Standard', price: 5.99, days: '5-8 business days' },
    { method: 'Express', price: 14.99, days: '2-4 business days' },
  ],
  GB: [
    { method: 'Standard', price: 6.99, days: '5-7 business days' },
    { method: 'Express', price: 14.99, days: '3-5 business days' },
  ],
  US: [
    { method: 'Standard', price: 12.99, days: '10-14 business days' },
    { method: 'Express', price: 24.99, days: '5-7 business days' },
  ],
}
