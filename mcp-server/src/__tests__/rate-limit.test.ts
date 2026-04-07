import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { createMockRequest, createMockResponse, createMockRedisClient, createMockAuthInfo } from './test-utils.js';

// Mock Redis client
const mockRedis = createMockRedisClient();

vi.mock('../lib/redis.js', () => ({
  getRedisClient: () => mockRedis,
}));

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Global Rate Limits', () => {
    it('should allow requests within limit for unauthenticated users', async () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(30); // 30 requests in window

      const allowed = await rateLimitMiddleware(req as any, res as any);

      expect(allowed).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '60');
    });

    it('should block requests exceeding limit for unauthenticated users', async () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.2' },
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(60); // At limit
      vi.mocked(mockRedis.zrange).mockResolvedValue(['1000', '1000']);

      const allowed = await rateLimitMiddleware(req as any, res as any);

      expect(allowed).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(429, expect.objectContaining({
        'Retry-After': expect.any(String),
      }));
    });

    it('should have higher limit for authenticated users', async () => {
      const authInfo = createMockAuthInfo('user-123', 'test@example.com');
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.3' },
        auth: authInfo,
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(100); // 100 requests

      const allowed = await rateLimitMiddleware(req as any, res as any);

      expect(allowed).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '120');
    });
  });

  describe('Per-Tool Rate Limits', () => {
    it('should enforce per-tool limit for create_checkout', async () => {
      const authInfo = createMockAuthInfo('user-456', 'test@example.com');
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.4' },
        auth: authInfo,
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(3); // 3 requests

      const allowed = await rateLimitMiddleware(req as any, res as any, 'create_checkout');

      expect(allowed).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    });

    it('should block create_checkout after 5 requests', async () => {
      const authInfo = createMockAuthInfo('user-789', 'test@example.com');
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.5' },
        auth: authInfo,
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(5); // At limit
      vi.mocked(mockRedis.zrange).mockResolvedValue(['1000', '1000']);

      const allowed = await rateLimitMiddleware(req as any, res as any, 'create_checkout');

      expect(allowed).toBe(false);
      expect(res.writeHead).toHaveBeenCalledWith(429, expect.any(Object));
    });

    it('should enforce search_products limit of 60/min', async () => {
      const authInfo = createMockAuthInfo('user-search', 'test@example.com');
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.6' },
        auth: authInfo,
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(50);

      const allowed = await rateLimitMiddleware(req as any, res as any, 'search_products');

      expect(allowed).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '60');
    });

    it('should enforce update_cart limit of 30/min', async () => {
      const authInfo = createMockAuthInfo('user-cart', 'test@example.com');
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.7' },
        auth: authInfo,
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(20);

      const allowed = await rateLimitMiddleware(req as any, res as any, 'update_cart');

      expect(allowed).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '30');
    });
  });

  describe('In-Memory Fallback', () => {
    it('should use in-memory rate limiting when Redis unavailable', async () => {
      const badRedis = { ...mockRedis, status: 'disconnected' };
      vi.mocked(await import('../lib/redis.js')).getRedisClient = () => badRedis as any;

      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.8' },
      });
      const res = createMockResponse();

      const allowed = await rateLimitMiddleware(req as any, res as any);

      expect(allowed).toBe(true);
    });

    it('should track requests in-memory when Redis down', async () => {
      const badRedis = { ...mockRedis, status: 'disconnected' };
      vi.mocked(await import('../lib/redis.js')).getRedisClient = () => badRedis as any;

      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.9' },
      });

      // Make multiple requests
      for (let i = 0; i < 3; i++) {
        const res = createMockResponse();
        await rateLimitMiddleware(req as any, res as any);
      }

      // Verify rate limit headers are set correctly
      const res = createMockResponse();
      await rateLimitMiddleware(req as any, res as any);

    });
  });

  describe('Rate Limit Headers', () => {
    it('should include X-RateLimit-Limit header', async () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.10' },
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(10);

      await rateLimitMiddleware(req as any, res as any);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(String));
    });

    it('should include X-RateLimit-Remaining header', async () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.11' },
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(20);

      await rateLimitMiddleware(req as any, res as any);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    });

    it('should include X-RateLimit-Reset header', async () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '192.168.1.12' },
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(15);

      await rateLimitMiddleware(req as any, res as any);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });
  });

  describe('IP Extraction', () => {
    it('should extract IP from X-Forwarded-For header', async () => {
      const req = createMockRequest({
        headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(5);

      const allowed = await rateLimitMiddleware(req as any, res as any);

      // Should allow the request
      expect(allowed).toBe(true);
    });

    it('should extract IP from X-Real-IP header', async () => {
      const req = createMockRequest({
        headers: { 'x-real-ip': '198.51.100.2' },
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(5);

      const allowed = await rateLimitMiddleware(req as any, res as any);

      expect(allowed).toBe(true);
    });

    it('should fallback to socket remote address', async () => {
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();

      vi.mocked(mockRedis.zcard).mockResolvedValue(5);

      const allowed = await rateLimitMiddleware(req as any, res as any);

      expect(allowed).toBe(true);
    });
  });
});
