/** Store defaults — reads from env vars. Set all values in .env before deploying.
 *  STORE_NAME checks NEXT_PUBLIC_ prefix first for client component compatibility. */
export const STORE_NAME = process.env.STORE_NAME || process.env.NEXT_PUBLIC_SITE_NAME || 'My POD Store'
export const STORE_CONTACT_EMAIL = process.env.STORE_CONTACT_EMAIL || 'hello@example.com'
export const STORE_SUPPORT_EMAIL = process.env.STORE_SUPPORT_EMAIL || 'support@example.com'
export const STORE_COMPANY_NAME = process.env.STORE_COMPANY_NAME || 'Your Company Name'
export const STORE_COMPANY_ADDRESS = process.env.STORE_COMPANY_ADDRESS || 'Your Company Address'
export const STORE_LEGAL_EMAIL = process.env.STORE_LEGAL_EMAIL || 'legal@example.com'
export const STORE_PRIVACY_EMAIL = process.env.STORE_PRIVACY_EMAIL || 'privacy@example.com'
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
export const STORE_DOMAIN = process.env.STORE_DOMAIN || 'localhost'
