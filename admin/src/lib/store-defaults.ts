/** Store defaults — reads from env vars. All values are required in production.
 *  Use start.sh or docker-compose to validate before startup. */
import { requiredEnv, optionalEnv } from './env'

export const STORE_NAME = requiredEnv('NEXT_PUBLIC_SITE_NAME')
export const STORE_CONTACT_EMAIL = requiredEnv('STORE_CONTACT_EMAIL')
export const STORE_SUPPORT_EMAIL = requiredEnv('STORE_SUPPORT_EMAIL')
export const STORE_COMPANY_NAME = requiredEnv('STORE_COMPANY_NAME')
export const STORE_COMPANY_ADDRESS = requiredEnv('STORE_COMPANY_ADDRESS')
export const STORE_LEGAL_EMAIL = requiredEnv('STORE_LEGAL_EMAIL')
export const STORE_PRIVACY_EMAIL = requiredEnv('STORE_PRIVACY_EMAIL')
export const ADMIN_EMAIL = requiredEnv('ADMIN_EMAIL')
export const STORE_DOMAIN = requiredEnv('STORE_DOMAIN')
