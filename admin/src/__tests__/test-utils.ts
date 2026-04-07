import { vi } from 'vitest';
import { SessionData } from '@/lib/session';

/**
 * Test utilities for admin API tests
 */

/**
 * Mock iron-session with test session data
 */
export function createMockSession(data: Partial<SessionData> = {}): SessionData {
  return {
    id: data.id || 'test-user-id',
    email: data.email || 'admin@example.com',
    role: data.role || 'admin',
    name: data.name || 'Test Admin',
    isLoggedIn: data.isLoggedIn !== undefined ? data.isLoggedIn : true,
  };
}

/**
 * Mock getIronSession to return a mock session
 */
export function mockIronSession(sessionData: Partial<SessionData> = {}) {
  const session = createMockSession(sessionData);
  return {
    ...session,
    save: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Mock Supabase admin client
 */
export function createMockSupabaseClient() {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
}

/**
 * Mock NextRequest
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  json?: () => Promise<any>;
}) {
  const headers = new Map<string, string>();
  Object.entries(options.headers || {}).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return {
    method: options.method || 'GET',
    url: options.url || 'http://localhost:3001/api/test',
    headers: {
      get: (key: string) => headers.get(key),
      set: (key: string, value: string) => headers.set(key, value),
      has: (key: string) => headers.has(key),
      forEach: (fn: (value: string, key: string) => void) => {
        headers.forEach((value, key) => fn(value, key));
      },
    },
    json: options.json || vi.fn().mockResolvedValue(options.body || {}),
    nextUrl: {
      searchParams: new URLSearchParams(options.url?.split('?')[1] || ''),
    },
  } as any;
}

/**
 * Mock rate limiter
 */
export function createMockRateLimiter() {
  return {
    check: vi.fn().mockReturnValue({ success: true }),
    reset: vi.fn(),
  };
}

/**
 * Mock bcrypt
 */
export function createMockBcrypt() {
  return {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('$2a$10$hashedpassword'),
  };
}

/**
 * Mock admin session for RBAC tests
 */
export function createMockAdminSession(overrides: Partial<{
  userId: string;
  email: string;
  role: string;
  name: string;
}> = {}) {
  return {
    userId: overrides.userId || 'test-admin-id',
    email: overrides.email || 'admin@example.com',
    role: overrides.role || 'admin',
    name: overrides.name || 'Test Admin',
  };
}

/**
 * Create mock context for Next.js route params
 */
export function createMockContext(params: Record<string, any>) {
  return {
    params: Promise.resolve(params),
  };
}
