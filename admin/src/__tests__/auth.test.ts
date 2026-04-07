import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { createMockRequest, createMockSupabaseClient, createMockBcrypt, mockIronSession, createMockRateLimiter } from './test-utils';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  },
}));

vi.mock('bcryptjs', () => {
  const compare = vi.fn().mockResolvedValue(true);
  const hash = vi.fn().mockResolvedValue('$2a$10$hashedpassword');
  return {
    default: { compare, hash },
    compare,
    hash,
  };
});

vi.mock('iron-session', () => ({
  getIronSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/rate-limit', () => ({
  adminLoginLimiter: {
    check: vi.fn().mockReturnValue({ success: true }),
    reset: vi.fn(),
  },
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('Admin Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      const { getIronSession } = await import('iron-session');
      const bcrypt = await import('bcryptjs');

      // Mock Supabase response
      (supabaseAdmin.single as any).mockResolvedValue({
        data: {
          id: 'admin-id',
          email: 'admin@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'admin',
          name: 'Admin User',
        },
        error: null,
      });

      // Mock bcrypt comparison
      (bcrypt.compare as any).mockResolvedValue(true);

      // Mock iron-session
      const mockSession = mockIronSession();
      (getIronSession as any).mockResolvedValue(mockSession);

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: {
          email: 'admin@example.com',
          password: process.env.E2E_ADMIN_PASSWORD || 'MISSING_TEST_PASSWORD',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('admin@example.com');
      expect(mockSession.save).toHaveBeenCalled();
    });

    it('should fail with invalid credentials', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');
      const bcrypt = await import('bcryptjs');

      // Mock Supabase response
      (supabaseAdmin.single as any).mockResolvedValue({
        data: {
          id: 'admin-id',
          email: 'admin@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'admin',
          name: 'Admin User',
        },
        error: null,
      });

      // Mock bcrypt comparison to fail
      (bcrypt.compare as any).mockResolvedValue(false);

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: {
          email: 'admin@example.com',
          password: 'wrongpassword',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });

    it('should fail when user is not admin', async () => {
      const { supabaseAdmin } = await import('@/lib/supabase');

      // Mock Supabase response with non-admin role
      (supabaseAdmin.single as any).mockResolvedValue({
        data: {
          id: 'user-id',
          email: 'user@example.com',
          password_hash: '$2a$10$hashedpassword',
          role: 'customer',
          name: 'Regular User',
        },
        error: null,
      });

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: {
          email: 'user@example.com',
          password: 'password123',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied. Admin role required.');
    });

    it('should enforce rate limiting', async () => {
      const { adminLoginLimiter } = await import('@/lib/rate-limit');

      // Mock rate limiter to return failure
      (adminLoginLimiter.check as any).mockReturnValue({
        success: false,
        resetAt: Date.now() + 60000,
      });

      const req = createMockRequest({
        method: 'POST',
        url: 'http://localhost:3001/api/auth/login',
        body: {
          email: 'admin@example.com',
          password: process.env.E2E_ADMIN_PASSWORD || 'MISSING_TEST_PASSWORD',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many login attempts');
    });
  });
});
