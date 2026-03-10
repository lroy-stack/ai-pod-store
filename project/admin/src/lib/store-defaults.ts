/** Store defaults — reads from env vars with SKAPARA defaults.
 *  STORE_NAME checks NEXT_PUBLIC_ prefix first for client component compatibility. */
export const STORE_NAME = process.env.STORE_NAME || 'SKAPARA'
export const STORE_CONTACT_EMAIL = process.env.STORE_CONTACT_EMAIL || 'hello@skapara.com'
export const STORE_SUPPORT_EMAIL = process.env.STORE_SUPPORT_EMAIL || 'support@skapara.com'
export const STORE_COMPANY_NAME = process.env.STORE_COMPANY_NAME || 'SKAPARA UG (haftungsbeschränkt)'
export const STORE_COMPANY_ADDRESS = process.env.STORE_COMPANY_ADDRESS || 'c/o SKAPARA UG, Musterstraße 1, 10115 Berlin, Germany'
export const STORE_LEGAL_EMAIL = process.env.STORE_LEGAL_EMAIL || 'legal@skapara.com'
export const STORE_PRIVACY_EMAIL = process.env.STORE_PRIVACY_EMAIL || 'privacy@skapara.com'
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@skapara.com'
export const STORE_DOMAIN = process.env.STORE_DOMAIN || 'skapara.com'
