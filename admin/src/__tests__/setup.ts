/**
 * Admin Vitest global setup — mocks for Next.js server components
 */
import { vi } from 'vitest'

// Mock next/headers (server-side cookies for iron-session)
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
  headers: vi.fn(() => new Map()),
}))

// Mock iron-session — used by auth-middleware.ts
vi.mock('iron-session', async () => {
  const actual = await vi.importActual('iron-session')
  return {
    ...actual,
    getIronSession: vi.fn().mockResolvedValue({
      id: 'test-admin-id',
      email: 'admin@example.com',
      role: 'admin',
      name: 'Test Admin',
      isLoggedIn: true,
      save: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    }),
  }
})
