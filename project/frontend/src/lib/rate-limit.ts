/**
 * In-memory burst rate limiter.
 *
 * Used for per-request burst protection (e.g., 20 chat messages per minute).
 * This is per-instance (each Vercel serverless function has its own Map),
 * which is acceptable because:
 * - Vercel routes requests to the same instance when possible
 * - The daily usage limiter (Supabase-backed) is the real enforcement
 * - This just prevents rapid-fire abuse within a single instance
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

  check(key: string): { success: boolean; remaining: number } {
    const now = Date.now()

    // Cleanup expired entries periodically
    if (Math.random() < 0.01) {
      for (const [k, v] of this.store) {
        if (now > v.resetAt) this.store.delete(k)
      }
    }

    const entry = this.store.get(key)

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs })
      return { success: true, remaining: this.limit - 1 }
    }

    if (entry.count >= this.limit) {
      return { success: false, remaining: 0 }
    }

    entry.count++
    return { success: true, remaining: this.limit - entry.count }
  }
}

// Pre-configured limiters
export const authLimiter = new RateLimiter(5, 15 * 60 * 1000)       // 5 attempts / 15 min
export const registerLimiter = new RateLimiter(3, 60 * 60 * 1000)   // 3 attempts / 60 min
export const forgotPasswordLimiter = new RateLimiter(3, 60 * 60 * 1000) // 3 attempts / 60 min
export const chatLimiter = new RateLimiter(20, 60 * 1000)            // 20 messages / 1 min
export const couponLimiter = new RateLimiter(10, 5 * 60 * 1000)     // 10 attempts / 5 min
export const apiLimiter = new RateLimiter(100, 60 * 1000)           // 100 requests / 1 min

/**
 * Helper to get client IP from request headers
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfIp = req.headers.get('cf-connecting-ip')

  return cfIp || realIp || forwarded?.split(',')[0] || 'unknown'
}
