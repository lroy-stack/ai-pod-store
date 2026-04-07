/**
 * Vitest global setup — mocks for Next.js, i18n, and browser APIs
 */
import { vi } from 'vitest'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({
    number: (n: number) => String(n),
    dateTime: (d: Date) => d.toISOString(),
  }),
}))

// Mock next-intl/server
vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string) => key,
  getLocale: () => 'en',
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/chat',
  useParams: () => ({ locale: 'en' }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

// Mock next/headers (for API route tests)
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
  headers: vi.fn(() => new Map()),
}))
