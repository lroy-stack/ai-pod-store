// Copyright (c) 2026 L.LÖWE <maintainer@example.com>
// SPDX-License-Identifier: MIT

import { requiredEnv, optionalEnv } from './env'

/** Brand identity — single source of truth for name + logos */
const _brandName = requiredEnv('NEXT_PUBLIC_SITE_NAME')

export const BRAND = {
  name: _brandName,
  tagline: requiredEnv('NEXT_PUBLIC_SITE_TAGLINE'),
  description: {
    en: optionalEnv('NEXT_PUBLIC_SITE_DESCRIPTION_EN'),
    es: optionalEnv('NEXT_PUBLIC_SITE_DESCRIPTION_ES'),
    de: optionalEnv('NEXT_PUBLIC_SITE_DESCRIPTION_DE'),
  },
  logoLight: '/brand/brand-mark-dark.svg',
  logoDark: '/brand/brand-mark-white.svg',
  logoFullLight: '/brand/brand-wordmark-dark.svg',
  logoFullDark: '/brand/brand-wordmark-white.svg',
} as const

/** Company legal entity — single source of truth */
const _companyName = requiredEnv('STORE_COMPANY_NAME')
export const COMPANY = {
  legalName: _companyName,
  shortName: _companyName.split(' (')[0],
  address: requiredEnv('STORE_COMPANY_ADDRESS'),
  country: optionalEnv('STORE_COMPANY_COUNTRY', 'DE'),
  taxId: optionalEnv('STORE_TAX_ID'),
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
export const BASE_URL = requiredEnv('NEXT_PUBLIC_BASE_URL')

/**
 * Contact emails — single source of truth for ALL email addresses.
 * SERVER-ONLY: These use runtime env vars (no NEXT_PUBLIC_ prefix).
 * Do NOT import CONTACT in client components ('use client').
 */
const _noreply = requiredEnv('RESEND_FROM_EMAIL')
export const CONTACT = {
  general: requiredEnv('STORE_CONTACT_EMAIL'),
  support: requiredEnv('STORE_SUPPORT_EMAIL'),
  legal: requiredEnv('STORE_LEGAL_EMAIL'),
  privacy: requiredEnv('STORE_PRIVACY_EMAIL'),
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
export const EMAIL_FROM = `${_brandName} <${_noreply}>`

/** Social media links */
export const SOCIAL_LINKS = {
  instagram: optionalEnv('NEXT_PUBLIC_SOCIAL_INSTAGRAM'),
  facebook: optionalEnv('NEXT_PUBLIC_SOCIAL_FACEBOOK'),
} as const

/** Store domain — explicit env var required; BASE_URL hostname is the fallback only in non-production */
const _storeDomain = requiredEnv('STORE_DOMAIN')

/** Primary domains — used by middleware and tenant resolution */
export const PRIMARY_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0', _storeDomain] as const
