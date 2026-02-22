/**
 * Test endpoint for rate limiting verification
 * Allows 10 requests per minute for testing purposes
 *
 * ⚠️  SECURITY: This endpoint is disabled in production
 */

import { NextResponse } from 'next/server'
import { getCorsHeaders, handleCorsPrelight } from '@/lib/cors'
import { getClientIP } from '@/lib/rate-limit'

interface RateLimitEntry {
  count: number
  resetAt: number
}

class TestRateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private limit = 10
  private windowMs = 60 * 1000 // 1 minute

  check(key: string): { success: boolean; remaining: number; resetAt: number } {
    const now = Date.now()

    // Cleanup expired entries
    for (const [k, v] of this.store) {
      if (now > v.resetAt) this.store.delete(k)
    }

    const entry = this.store.get(key)

    if (!entry || now > entry.resetAt) {
      const resetAt = now + this.windowMs
      this.store.set(key, { count: 1, resetAt })
      return { success: true, remaining: this.limit - 1, resetAt }
    }

    if (entry.count >= this.limit) {
      return { success: false, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count++
    return { success: true, remaining: this.limit - entry.count, resetAt: entry.resetAt }
  }
}

const testLimiter = new TestRateLimiter()

export async function OPTIONS(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  const preflightResponse = handleCorsPrelight(req)
  return preflightResponse || new Response(null, { status: 405 })
}

export async function GET(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }


  const origin = req.headers.get('origin')
  const ip = getClientIP(req)

  const { success, remaining, resetAt } = testLimiter.check(ip)

  if (!success) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          ...getCorsHeaders(origin),
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
        },
      }
    )
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Request successful',
      rateLimit: {
        limit: 10,
        remaining,
        reset: Math.floor(resetAt / 1000),
      },
    },
    {
      status: 200,
      headers: {
        ...getCorsHeaders(origin),
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
      },
    }
  )
}
