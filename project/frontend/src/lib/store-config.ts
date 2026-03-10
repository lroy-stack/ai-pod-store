/** Brand identity — single source of truth for name + logos */
const _brandName = process.env.NEXT_PUBLIC_SITE_NAME || 'SKAPARA'

export const BRAND = {
  name: _brandName,
  tagline: process.env.NEXT_PUBLIC_SITE_TAGLINE || 'Wear what you mean',
  description: {
    en: 'Unique fashion & accessories designed with you, made in Europe. Find your next favorite piece.',
    es: 'Moda y accesorios únicos diseñados contigo, hechos en Europa. Encuentra tu próxima pieza favorita.',
    de: 'Einzigartige Mode & Accessoires mit dir gestaltet, hergestellt in Europa. Finde dein nächstes Lieblingsstück.',
  },
  logoLight: '/brand/skapara-mark-dark.svg',
  logoDark: '/brand/skapara-mark-white.svg',
  logoFull: '/brand/skapara-wordmark-dark.svg',
  logoFullLight: '/brand/skapara-wordmark-dark.svg',
} as const

/** Company legal entity — single source of truth */
const _companyName = process.env.STORE_COMPANY_NAME || 'SKAPARA UG (haftungsbeschränkt)'
export const COMPANY = {
  legalName: _companyName,
  shortName: _companyName.split(' (')[0],
  address: process.env.STORE_COMPANY_ADDRESS || 'c/o SKAPARA UG, Musterstraße 1, 10115 Berlin, Germany',
  country: 'DE',
  taxId: '',
} as const

/** Store-wide defaults — single source of truth */
export const STORE_DEFAULTS = {
  platformName: _brandName,
  storeName: `${_brandName} Store`,
  assistantName: _brandName,
  currency: 'EUR',
  country: 'DE',
  measurementUnit: 'cm',
  freeShippingThreshold: 50,
  stripeCurrency: 'eur',
  maxCartQuantity: 99,
}

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

/** EU-approved Printify providers (only these ship from EU fulfillment centers) */
export const EU_APPROVED_PROVIDERS = new Set([26, 410, 90, 23, 30, 255, 86])

export function isEUProvider(providerId: number): boolean {
  return EU_APPROVED_PROVIDERS.has(providerId)
}

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

/** Canonical base URL — single source of truth */
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://skapara.com'

/**
 * Contact emails — single source of truth for ALL email addresses.
 * SERVER-ONLY: These use runtime env vars (no NEXT_PUBLIC_ prefix).
 * Do NOT import CONTACT in client components ('use client').
 */
const _noreply = process.env.STORE_NOREPLY_EMAIL || process.env.RESEND_FROM_EMAIL || 'noreply@skapara.com'
export const CONTACT = {
  general: process.env.STORE_CONTACT_EMAIL || 'hello@skapara.com',
  support: process.env.STORE_SUPPORT_EMAIL || 'support@skapara.com',
  legal: process.env.STORE_LEGAL_EMAIL || 'legal@skapara.com',
  privacy: process.env.STORE_PRIVACY_EMAIL || 'privacy@skapara.com',
  noreply: _noreply,
  push: `mailto:${_noreply}`,
} as const

/** Email template color palette — used by resend.ts and all transactional emails */
export const EMAIL_PALETTE = {
  gradientStart: '#667eea',
  gradientEnd: '#764ba2',
  heading: '#667eea',
  ctaButton: '#667eea',
  bodyText: '#333',
  mutedText: '#6b7280',
  footerText: '#9ca3af',
  panelBg: '#f9fafb',
  cardBorder: '#e5e7eb',
  warningBg: '#fef3c7',
  warningBorder: '#f59e0b',
} as const

/** Formatted email sender — use for Resend 'from' field */
export const EMAIL_FROM = `${_brandName} <${process.env.RESEND_FROM_EMAIL || CONTACT.noreply}>`

/** Social media links */
export const SOCIAL_LINKS = {
  instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || 'https://instagram.com/skapara',
  twitter: process.env.NEXT_PUBLIC_SOCIAL_TWITTER || 'https://twitter.com/skapara',
  facebook: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || 'https://facebook.com/skapara',
} as const

/** Store domain — derived from BASE_URL or explicit env var */
const _storeDomain = process.env.STORE_DOMAIN
  || (() => { try { return new URL(BASE_URL).hostname } catch { return 'skapara.com' } })()

/** Primary domains — used by middleware and tenant resolution */
export const PRIMARY_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0', _storeDomain] as const
