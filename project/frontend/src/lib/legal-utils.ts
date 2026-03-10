/**
 * Legal utilities for dynamic placeholder resolution
 * Replaces {{placeholder}} patterns with actual values from legal_settings
 */

import { COMPANY, CONTACT } from './store-config'

/**
 * Legal settings structure from database
 */
export interface LegalSettings {
  company_name: string
  company_address: string
  company_email: string
  tax_id: string
  trade_register_court: string
  trade_register_number: string
  dpo_name: string
  dpo_email: string
  cookie_policy_url?: string
  privacy_policy_url?: string
  terms_of_service_url?: string
}

/**
 * Fallback default values when DB is unavailable
 * Uses store-config.ts as single source of truth
 */
const LEGAL_FALLBACKS: LegalSettings = {
  company_name: COMPANY.legalName,
  company_address: COMPANY.address,
  company_email: CONTACT.general,
  tax_id: COMPANY.taxId,
  trade_register_court: '',
  trade_register_number: '',
  dpo_name: 'Data Protection Officer',
  dpo_email: CONTACT.privacy,
  cookie_policy_url: '/cookies',
  privacy_policy_url: '/privacy',
  terms_of_service_url: '/terms',
}

/**
 * Supported placeholders
 */
export const SUPPORTED_PLACEHOLDERS = [
  'company_name',
  'company_address',
  'company_email',
  'tax_id',
  'trade_register_court',
  'trade_register_number',
  'dpo_name',
  'dpo_email',
  'current_date',
  'cookie_policy_url',
  'privacy_policy_url',
  'terms_of_service_url',
] as const

/**
 * Replace all {{placeholder}} patterns in a string with actual values
 *
 * @param content - String containing {{placeholder}} patterns
 * @param settings - Legal settings object (optional, will use fallbacks if not provided)
 * @param locale - Locale for date formatting (default: 'en')
 * @returns String with all placeholders replaced
 *
 * @example
 * ```ts
 * const settings = await fetchLegalSettings()
 * const resolved = resolvePlaceholders(
 *   "Contact us at {{company_email}}. DPO: {{dpo_email}}",
 *   settings
 * )
 * // => "Contact us at legal@podclaw.store. DPO: privacy@podclaw.store"
 * ```
 */
export function resolvePlaceholders(
  content: string,
  settings?: LegalSettings | null,
  locale: string = 'en'
): string {
  // Use provided settings or fallback to defaults
  if (!settings) {
    console.warn('[legal-utils] Using fallback legal settings — configure real values in admin legal settings')
  }
  const resolvedSettings = settings ?? LEGAL_FALLBACKS

  // Current date formatting based on locale
  const currentDate = new Date().toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Create replacement map
  const replacements: Record<string, string> = {
    company_name: resolvedSettings.company_name,
    company_address: resolvedSettings.company_address,
    company_email: resolvedSettings.company_email,
    tax_id: resolvedSettings.tax_id,
    trade_register_court: resolvedSettings.trade_register_court,
    trade_register_number: resolvedSettings.trade_register_number,
    dpo_name: resolvedSettings.dpo_name,
    dpo_email: resolvedSettings.dpo_email,
    current_date: currentDate,
    cookie_policy_url: resolvedSettings.cookie_policy_url ?? LEGAL_FALLBACKS.cookie_policy_url!,
    privacy_policy_url: resolvedSettings.privacy_policy_url ?? LEGAL_FALLBACKS.privacy_policy_url!,
    terms_of_service_url: resolvedSettings.terms_of_service_url ?? LEGAL_FALLBACKS.terms_of_service_url!,
  }

  // Replace all {{placeholder}} patterns
  let result = content
  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(pattern, value)
  }

  return result
}

/**
 * Fetch legal settings from the admin API
 * Returns null if fetch fails (graceful degradation)
 *
 * @param baseUrl - Base URL for the admin API (default: from env or localhost:3001)
 * @returns LegalSettings object or null if unavailable
 */
export async function fetchLegalSettings(
  baseUrl?: string
): Promise<LegalSettings | null> {
  try {
    const apiUrl = baseUrl ?? process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'
    const response = await fetch(`${apiUrl}/api/admin/legal-settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 5 minutes to reduce DB load
      // @ts-ignore - Next.js specific fetch extension
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      console.warn('[legal-utils] Failed to fetch legal settings:', response.status)
      return null
    }

    const data = await response.json()

    // Extract settings from the response structure
    // API returns: { id, settings: { ... }, created_at, updated_at }
    if (data.settings) {
      return data.settings as LegalSettings
    }

    // Fallback: if settings is not nested, return the data directly
    return data as LegalSettings
  } catch (error) {
    console.warn('[legal-utils] Error fetching legal settings:', error)
    return null
  }
}

/**
 * Extract all {{placeholder}} patterns from content
 * Useful for validation and debugging
 *
 * @param content - String to scan for placeholders
 * @returns Array of unique placeholder names (without {{ }})
 */
export function extractPlaceholders(content: string): string[] {
  const pattern = /\{\{(\w+)\}\}/g
  const matches = Array.from(content.matchAll(pattern))
  const placeholders = new Set<string>()

  for (const match of matches) {
    placeholders.add(match[1])
  }

  return Array.from(placeholders)
}

/**
 * Validate that all placeholders in content are supported
 *
 * @param content - String to validate
 * @returns Object with isValid flag and array of unsupported placeholders
 */
export function validatePlaceholders(content: string): {
  isValid: boolean
  unsupported: string[]
} {
  const found = extractPlaceholders(content)
  const unsupported = found.filter(
    (p) => !SUPPORTED_PLACEHOLDERS.includes(p as any)
  )

  return {
    isValid: unsupported.length === 0,
    unsupported,
  }
}
