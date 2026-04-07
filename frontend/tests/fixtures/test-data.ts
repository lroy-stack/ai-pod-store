export const TEST_URLS = {
  base: 'http://localhost:3000',
  api: 'http://localhost:3000/api',
  bridge: 'http://localhost:8000',
  bridgeViaProxy: 'http://localhost:8080/api/bridge',
  rembg: 'http://localhost:8090',
} as const

export const TEST_LOCALES = ['en', 'es', 'de'] as const

export const TEST_VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
} as const

// Test credentials MUST come from environment variables.
// Set E2E_USER_EMAIL and E2E_USER_PASSWORD in .env.test before running.
export const TEST_CREDENTIALS = {
  validUser: {
    email: process.env.E2E_USER_EMAIL || process.env.TEST_USER_EMAIL || '',
    password: process.env.E2E_USER_PASSWORD || process.env.TEST_USER_PASSWORD || '',
  },
  invalidUser: {
    email: 'nonexistent@example.com',
    password: 'wrongpassword',
  },
} as const

export const TIMEOUTS = {
  api: 10_000,
  page: 15_000,
  stream: 30_000,
} as const
