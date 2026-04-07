/**
 * Shared test utilities for frontend Vitest tests
 *
 * Mock factories for Supabase, auth, Fabric.js canvas, and common patterns.
 */
import { vi } from 'vitest'

// ─── Auth mocks ──────────────────────────────────────────────────────

export interface MockAuthUser {
  id: string
  email: string
  role: string
  tier: string
  credit_balance: number
}

export function createMockAuthUser(overrides: Partial<MockAuthUser> = {}): MockAuthUser {
  return {
    id: overrides.id || 'test-user-id-123',
    email: overrides.email || 'user@test.com',
    role: overrides.role || 'customer',
    tier: overrides.tier || 'free',
    credit_balance: overrides.credit_balance ?? 100,
  }
}

// ─── Supabase mock ───────────────────────────────────────────────────

export function createMockSupabaseClient() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://storage.test/file.png' } })),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id-123' } }, error: null }),
      admin: {
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  }
  return chain
}

// ─── Fabric.js canvas mock ───────────────────────────────────────────

export function createMockFabricCanvas() {
  const objects: any[] = []

  return {
    getObjects: vi.fn(() => [...objects]),
    add: vi.fn((...objs: any[]) => { objects.push(...objs) }),
    remove: vi.fn((obj: any) => {
      const idx = objects.indexOf(obj)
      if (idx !== -1) objects.splice(idx, 1)
    }),
    renderAll: vi.fn(),
    requestRenderAll: vi.fn(),
    getActiveObject: vi.fn(() => null),
    setActiveObject: vi.fn(),
    discardActiveObject: vi.fn(),
    toObject: vi.fn(() => ({ version: '6.0.0', objects: [] })),
    toJSON: vi.fn(() => JSON.stringify({ version: '6.0.0', objects: [] })),
    toDataURL: vi.fn(() => 'data:image/png;base64,test'),
    getWidth: vi.fn(() => 800),
    getHeight: vi.fn(() => 600),
    setWidth: vi.fn(),
    setHeight: vi.fn(),
    setZoom: vi.fn(),
    getZoom: vi.fn(() => 1),
    viewportTransform: [1, 0, 0, 1, 0, 0],
    dispose: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    fire: vi.fn(),
    moveObjectTo: vi.fn(),
    _objects: objects,
  }
}

// ─── NextRequest mock ────────────────────────────────────────────────

export function createMockRequest(options: {
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: any
} = {}) {
  const headerMap = new Map(Object.entries(options.headers || {}))

  return {
    method: options.method || 'GET',
    url: options.url || 'http://localhost:3000/api/test',
    headers: {
      get: (key: string) => headerMap.get(key) || null,
      has: (key: string) => headerMap.has(key),
    },
    json: vi.fn().mockResolvedValue(options.body || {}),
    nextUrl: {
      searchParams: new URLSearchParams(options.url?.split('?')[1] || ''),
    },
  } as any
}

// ─── Response helpers ────────────────────────────────────────────────

export async function parseJsonResponse(response: Response) {
  const json = await response.json()
  return { status: response.status, body: json }
}
