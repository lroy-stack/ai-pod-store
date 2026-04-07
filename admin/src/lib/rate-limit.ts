/**
 * Rate limiter with Redis backend and in-memory fallback.
 *
 * Uses Redis INCR + EXPIRE for distributed rate limiting across
 * multiple admin instances. Falls back to per-instance Map if
 * Redis is unavailable.
 */

import { getRedisClient, isRedisAvailable } from './redis'

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

interface InMemoryEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly prefix: string
  private readonly fallbackStore = new Map<string, InMemoryEntry>()

  constructor(limit: number, windowMs: number, prefix: string) {
    this.limit = limit
    this.windowMs = windowMs
    this.prefix = prefix
  }

  async check(key: string): Promise<RateLimitResult> {
    if (process.env.NODE_ENV === 'test' && process.env.PLAYWRIGHT_TEST_BASE_URL) {
      return { success: true, remaining: this.limit, resetAt: Date.now() + this.windowMs }
    }

    if (isRedisAvailable()) {
      return this.checkRedis(key)
    }
    return this.checkMemory(key)
  }

  async reset(key: string): Promise<void> {
    const redisKey = `${this.prefix}:${key}`

    if (isRedisAvailable()) {
      const client = getRedisClient()
      try {
        await client?.del(redisKey)
      } catch {
        // Fallback: also clear memory
      }
    }
    this.fallbackStore.delete(key)
  }

  private async checkRedis(key: string): Promise<RateLimitResult> {
    const client = getRedisClient()
    if (!client) return this.checkMemory(key)

    const redisKey = `${this.prefix}:${key}`
    const windowSec = Math.ceil(this.windowMs / 1000)

    try {
      const results = await client
        .multi()
        .incr(redisKey)
        .ttl(redisKey)
        .exec()

      if (!results) return this.checkMemory(key)

      const count = results[0][1] as number
      const ttl = results[1][1] as number

      // Set expiry on first request in window (TTL = -1 means no expiry set)
      if (ttl === -1) {
        await client.expire(redisKey, windowSec)
      }

      const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : this.windowMs)
      const remaining = Math.max(0, this.limit - count)

      return {
        success: count <= this.limit,
        remaining,
        resetAt,
      }
    } catch {
      return this.checkMemory(key)
    }
  }

  private checkMemory(key: string): RateLimitResult {
    const now = Date.now()

    // Probabilistic cleanup (1% chance per check)
    if (Math.random() < 0.01) {
      for (const [k, v] of this.fallbackStore) {
        if (now > v.resetAt) this.fallbackStore.delete(k)
      }
    }

    const entry = this.fallbackStore.get(key)

    if (!entry || now > entry.resetAt) {
      const resetAt = now + this.windowMs
      this.fallbackStore.set(key, { count: 1, resetAt })
      return { success: true, remaining: this.limit - 1, resetAt }
    }

    if (entry.count >= this.limit) {
      return { success: false, remaining: 0, resetAt: entry.resetAt }
    }

    const updated = { count: entry.count + 1, resetAt: entry.resetAt }
    this.fallbackStore.set(key, updated)
    return { success: true, remaining: this.limit - updated.count, resetAt: entry.resetAt }
  }
}

// Pre-configured limiters
// Login: 5 attempts per 15 minutes per IP
export const adminLoginLimiter = new RateLimiter(5, 15 * 60 * 1000, 'rl:admin:login')

// Read routes (GET): 60 requests/minute
export const readApiLimiter = new RateLimiter(60, 60 * 1000, 'rl:admin:read')

// Write routes (POST/PUT/PATCH/DELETE): 20 requests/minute
export const writeApiLimiter = new RateLimiter(20, 60 * 1000, 'rl:admin:write')

/**
 * Get client IP from request headers.
 * Prioritizes Cloudflare's IP, then x-real-ip, then x-forwarded-for.
 */
export function getClientIP(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')
  const realIp = req.headers.get('x-real-ip')
  const forwarded = req.headers.get('x-forwarded-for')

  return cfIp || realIp || forwarded?.split(',')[0] || 'unknown'
}

/**
 * Check rate limit for an API request.
 * Returns 429 info if exceeded, null if ok.
 */
export async function checkApiRateLimit(
  req: Request
): Promise<{ status: 429; headers: Record<string, string> } | null> {
  const ip = getClientIP(req)
  const method = req.method?.toUpperCase() || 'GET'
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const limiter = isWrite ? writeApiLimiter : readApiLimiter

  const result = await limiter.check(ip)

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
