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
    // Bypass rate limiting for E2E tests (only in test environment)
    if (process.env.NODE_ENV === 'test' && (process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.CI)) {
      return { success: true, remaining: this.limit }
    }

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
export const noFpChatLimiter = new RateLimiter(5, 60 * 1000)        // 5 messages / 1 min (no fingerprint)
export const couponLimiter = new RateLimiter(10, 5 * 60 * 1000)     // 10 attempts / 5 min
export const apiLimiter = new RateLimiter(100, 60 * 1000)           // 100 requests / 1 min
export const designGenerateLimiter = new RateLimiter(5, 60 * 1000)  // 5 requests / 1 min
export const mockupGenerateLimiter = new RateLimiter(10, 60 * 1000) // 10 requests / 1 min
export const newsletterLimiter = new RateLimiter(10, 60 * 1000)     // 10 requests / 1 min
export const previewTextLimiter = new RateLimiter(20, 60 * 1000)    // 20 requests / 1 min (canvas rendering is CPU-intensive)
export const changePasswordLimiter = new RateLimiter(5, 15 * 60 * 1000)  // 5 / 15 min
export const designSaveLimiter = new RateLimiter(30, 60 * 1000)          // 30 / min
export const personalizeLimiter = new RateLimiter(20, 60 * 1000)         // 20 / min
export const reviewLimiter = new RateLimiter(5, 60 * 60 * 1000)          // 5 / hora
export const avatarUploadLimiter = new RateLimiter(5, 15 * 60 * 1000)    // 5 / 15 min
export const changeEmailLimiter = new RateLimiter(3, 60 * 60 * 1000)     // 3 / hora
export const subscriptionCreateLimiter = new RateLimiter(3, 60 * 60 * 1000) // 3 / hour (Stripe Checkout spam prevention)
export const checkoutLimiter = new RateLimiter(5, 60 * 1000)              // 5 / min (checkout session creation)
export const composeLimiter = new RateLimiter(10, 60 * 1000)              // 10 / min (design composition)
export const removeBgLimiter = new RateLimiter(10, 60 * 1000)             // 10 / min (background removal)
export const historyLimiter = new RateLimiter(30, 60 * 1000)              // 30 / min (design history)

/**
 * Timing-safe comparison for bearer tokens (prevents timing attacks).
 * Returns true if the provided authorization header matches `Bearer ${secret}`.
 */
export function verifyCronSecret(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !authHeader) return false
  const expected = `Bearer ${secret}`
  if (authHeader.length !== expected.length) return false
  const { timingSafeEqual } = require('crypto')
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  } catch {
    return false
  }
}

/**
 * Helper to get client IP from request headers
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfIp = req.headers.get('cf-connecting-ip')

  return cfIp || realIp || forwarded?.split(',')[0] || 'unknown'
}

/**
 * Concurrent request tracker (in-memory, per-instance).
 * Prevents a single user from running multiple streaming requests simultaneously.
 */
const activeRequests = new Map<string, number>()

export function acquireSlot(key: string, maxConcurrent: number = 2): boolean {
  // Bypass for E2E tests (only in test environment)
  if (process.env.NODE_ENV === 'test' && (process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.CI)) {
    return true
  }

  const current = activeRequests.get(key) || 0
  if (current >= maxConcurrent) return false
  activeRequests.set(key, current + 1)
  return true
}

export function releaseSlot(key: string): void {
  const current = activeRequests.get(key) || 0
  if (current <= 1) activeRequests.delete(key)
  else activeRequests.set(key, current - 1)
}
