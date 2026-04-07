/**
 * Playwright auth fixtures for admin E2E tests
 *
 * Provides helper to programmatically create an admin session cookie,
 * bypassing the login UI for faster, more reliable tests.
 *
 * REQUIRED: Set these env vars in .env.test before running:
 *   E2E_ADMIN_EMAIL=your-admin@yourdomain.com
 *   E2E_ADMIN_PASSWORD=your-admin-password
 */
import { test as base, type Page } from '@playwright/test'

/** Admin session data matching iron-session SessionData interface */
interface AdminSession {
  id: string
  email: string
  role: string
  name: string
  isLoggedIn: boolean
}

const DEFAULT_ADMIN: AdminSession = {
  id: 'test-admin-e2e',
  email: process.env.E2E_ADMIN_EMAIL || '',
  role: 'admin',
  name: 'E2E Admin',
  isLoggedIn: true,
}

/**
 * Set admin session cookie via the login API.
 * This is more reliable than injecting iron-session cookies directly
 * because iron-session signs and encrypts the cookie.
 */
async function loginAsAdmin(page: Page, credentials?: { email: string; password: string }) {
  const email = credentials?.email || process.env.E2E_ADMIN_EMAIL
  const password = credentials?.password || process.env.E2E_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in .env.test to run admin E2E tests.'
    )
  }

  const response = await page.request.post('/api/auth/login', {
    data: { email, password },
  })

  if (!response.ok()) {
    throw new Error(`Admin login failed: ${response.status()} ${await response.text()}`)
  }

  return response.json()
}

/**
 * Extended test fixture with pre-authenticated admin page
 */
export const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ page }, use) => {
    await loginAsAdmin(page)
    await use(page)
  },
})

export { loginAsAdmin, DEFAULT_ADMIN }
export { expect } from '@playwright/test'
