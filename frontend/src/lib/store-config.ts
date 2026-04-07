// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

/** Brand identity — single source of truth for name + logos */
const _brandName = process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store'

export const BRAND = {
  name: _brandName,
  tagline: process.env.NEXT_PUBLIC_SITE_TAGLINE || 'Custom products, made for you',
  description: {
    en: process.env.NEXT_PUBLIC_SITE_DESCRIPTION_EN || 'Unique fashion & accessories, made on demand. Find your next favorite piece.',
    es: process.env.NEXT_PUBLIC_SITE_DESCRIPTION_ES || 'Moda y accesorios únicos, hechos bajo pedido. Encuentra tu próxima pieza favorita.',
    de: process.env.NEXT_PUBLIC_SITE_DESCRIPTION_DE || 'Einzigartige Mode & Accessoires auf Bestellung. Finde dein nächstes Lieblingsstück.',
  },
  logoLight: '/brand/brand-mark-dark.svg',
  logoDark: '/brand/brand-mark-white.svg',
  logoFullLight: '/brand/brand-wordmark-dark.svg',
  logoFullDark: '/brand/brand-wordmark-white.svg',
} as const

/** Company legal entity — single source of truth */
const _companyName = process.env.STORE_COMPANY_NAME || 'Your Company Name'
export const COMPANY = {
  legalName: _companyName,
  shortName: _companyName.split(' (')[0],
  address: process.env.STORE_COMPANY_ADDRESS || 'Your Company Address',
  country: process.env.STORE_COMPANY_COUNTRY || 'DE',
  taxId: process.env.STORE_TAX_ID || '',
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

/** Minimum margin percentage for product pricing */
export const MIN_MARGIN_PERCENT = 35

/** Default GPSR compliance data for EU Regulation 2023/988 */
export const DEFAULT_GPSR = {
  brand: BRAND.name,
  manufacturer: COMPANY.legalName,
  manufacturer_address: COMPANY.address,
  manufacturing_country: 'LV', // Latvia (Printful EU fulfillment)
  safety_information: 'Conforms to EU Regulation 2023/988 (GPSR). No hazardous substances.',
  material: '', // Must be set per product
  care_instructions: '', // Must be set per product
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
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

/**
 * Contact emails — single source of truth for ALL email addresses.
 * SERVER-ONLY: These use runtime env vars (no NEXT_PUBLIC_ prefix).
 * Do NOT import CONTACT in client components ('use client').
 */
const _noreply = process.env.STORE_NOREPLY_EMAIL || process.env.RESEND_FROM_EMAIL || 'noreply@example.com'
export const CONTACT = {
  general: process.env.STORE_CONTACT_EMAIL || 'hello@example.com',
  support: process.env.STORE_SUPPORT_EMAIL || 'support@example.com',
  legal: process.env.STORE_LEGAL_EMAIL || 'legal@example.com',
  privacy: process.env.STORE_PRIVACY_EMAIL || 'privacy@example.com',
  noreply: _noreply,
  push: `mailto:${_noreply}`,
} as const

/** Email template color palette — used by resend.ts and all transactional emails */
export const EMAIL_PALETTE = {
  headerBg: '#1a1a1a',
  heading: '#1a1a1a',
  ctaButton: '#9a6a3a',
  bodyText: '#333333',
  mutedText: '#6b7280',
  footerText: '#9ca3af',
  panelBg: '#f9fafb',
  cardBorder: '#e5e7eb',
  warningBg: '#fef3c7',
  warningBorder: '#d4a853',
  accent: '#9a6a3a',
} as const

/** Formatted email sender — use for Resend 'from' field */
export const EMAIL_FROM = `${_brandName} <${process.env.RESEND_FROM_EMAIL || CONTACT.noreply}>`

/** Social media links */
export const SOCIAL_LINKS = {
  instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM || '',
  facebook: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || '',
} as const

/** Store domain — derived from BASE_URL or explicit env var */
const _storeDomain = process.env.STORE_DOMAIN
  || (() => { try { return new URL(BASE_URL).hostname } catch { return 'localhost' } })()

/** Primary domains — used by middleware and tenant resolution */
export const PRIMARY_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0', _storeDomain] as const
