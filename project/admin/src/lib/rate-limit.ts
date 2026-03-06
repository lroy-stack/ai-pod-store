/**
 * In-memory rate limiter for admin authentication endpoints.
 *
 * Tracks failed login attempts per IP address to prevent brute force attacks.
 * This is per-instance (each serverless function has its own Map), which is acceptable
 * because the primary goal is to slow down automated attacks.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private limit: number
  private windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  /**
   * Check if the key is within rate limits.
   * @returns Object with success flag, remaining attempts, and resetAt timestamp
   */
  check(key: string): { success: boolean; remaining: number; resetAt: number } {
    // Bypass rate limiting for E2E tests
    if (process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.CI) {
      return { success: true, remaining: this.limit, resetAt: Date.now() + this.windowMs }
    }

    const now = Date.now()

    // Cleanup expired entries periodically (1% chance per check)
    if (Math.random() < 0.01) {
      for (const [k, v] of this.store) {
        if (now > v.resetAt) this.store.delete(k)
      }
    }

    const entry = this.store.get(key)

    if (!entry || now > entry.resetAt) {
      // First attempt or window expired - start fresh
      const resetAt = now + this.windowMs
      this.store.set(key, { count: 1, resetAt })
      return { success: true, remaining: this.limit - 1, resetAt }
    }

    if (entry.count >= this.limit) {
      // Rate limit exceeded
      return { success: false, remaining: 0, resetAt: entry.resetAt }
    }

    // Increment attempt counter
    entry.count++
    return { success: true, remaining: this.limit - entry.count, resetAt: entry.resetAt }
  }

  /**
   * Reset the rate limit for a specific key (e.g., after successful login).
   */
  reset(key: string): void {
    this.store.delete(key)
  }
}

// Pre-configured limiter for admin login
// 5 attempts per 15 minutes per IP address
export const adminLoginLimiter = new RateLimiter(5, 15 * 60 * 1000)

// API rate limiters per IP per minute
// Read routes (GET): 60 requests/minute
export const readApiLimiter = new RateLimiter(60, 60 * 1000)
// Write routes (POST/PUT/PATCH/DELETE): 20 requests/minute
export const writeApiLimiter = new RateLimiter(20, 60 * 1000)

/**
 * Helper to get client IP from request headers.
 * Prioritizes Cloudflare's IP, then x-real-ip, then x-forwarded-for.
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfIp = req.headers.get('cf-connecting-ip')

  return cfIp || realIp || forwarded?.split(',')[0] || 'unknown'
}

/**
 * Check rate limit for an API request. Returns 429 response if exceeded, null if ok.
 */
export function checkApiRateLimit(req: Request): { status: 429; headers: Record<string, string> } | null {
  const ip = getClientIP(req)
  const method = req.method?.toUpperCase() || 'GET'
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const limiter = isWrite ? writeApiLimiter : readApiLimiter

  const result = limiter.check(ip)

  if (!result.success) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
    return {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': isWrite ? '20' : '60',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  }

  return null
}
