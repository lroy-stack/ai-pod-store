import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'
import { getCorsHeaders, handleCorsPrelight } from '@/lib/cors'
import { logInfo } from '@/lib/logger'

export async function OPTIONS(req: Request) {
  const preflightResponse = handleCorsPrelight(req)
  return preflightResponse || new Response(null, { status: 405 })
}

/**
 * Measure latency of an async operation
 */
async function measureLatency<T>(
  operation: () => Promise<T>
): Promise<{ result: T; latency: number }> {
  const start = performance.now()
  const result = await operation()
  const latency = Math.round(performance.now() - start)
  return { result, latency }
}

export async function GET(req: Request) {
  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  }

  // Memory usage
  const memUsage = process.memoryUsage()
  health.memory = {
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
  }

  // Check database connection with latency
  const supabaseUrl = process.env.SUPABASE_URL
  const apiKey = process.env.SUPABASE_SERVICE_KEY

  if (supabaseUrl && apiKey) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const { result: response, latency } = await measureLatency(async () => {
        return await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        })
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        health.supabase = {
          status: 'connected',
          latency,
        }
      } else {
        health.supabase = {
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }
    } catch (error: unknown) {
      health.supabase = {
        status: 'error',
        error: error instanceof Error
          ? (error.name === 'AbortError' ? 'Connection timeout (5s)' : error.message)
          : 'Unknown error',
      }
    }
  } else {
    health.supabase = {
      status: 'not_configured',
    }
  }

  // Check Redis connection (optional, non-blocking) with latency
  if (process.env.REDIS_URL) {
    try {
      const client = getRedisClient()
      if (client) {
        const { latency } = await measureLatency(async () => {
          return await client.ping()
        })
        health.redis = {
          status: 'connected',
          latency,
        }
      } else {
        health.redis = {
          status: 'disconnected',
          message: 'Client initialization failed',
        }
      }
    } catch (error) {
      health.redis = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  } else {
    health.redis = {
      status: 'not_configured',
    }
  }

  // Check Printify API with latency
  const printifyToken = process.env.PRINTIFY_API_TOKEN
  const printifyShopId = process.env.PRINTIFY_SHOP_ID

  if (printifyToken && printifyShopId) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const { result: response, latency } = await measureLatency(async () => {
        return await fetch(`https://api.printify.com/v1/shops/${printifyShopId}.json`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${printifyToken}`,
          },
          signal: controller.signal,
        })
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        health.printify = {
          status: 'connected',
          latency,
        }
      } else {
        health.printify = {
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }
    } catch (error: unknown) {
      health.printify = {
        status: 'error',
        error: error instanceof Error
          ? (error.name === 'AbortError' ? 'Connection timeout (5s)' : error.message)
          : 'Unknown error',
      }
    }
  } else {
    health.printify = {
      status: 'not_configured',
    }
  }

  // Check Stripe API with latency
  const stripeKey = process.env.STRIPE_SECRET_KEY

  if (stripeKey) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const { result: response, latency } = await measureLatency(async () => {
        return await fetch('https://api.stripe.com/v1/balance', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
          },
          signal: controller.signal,
        })
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        health.stripe = {
          status: 'connected',
          latency,
        }
      } else {
        health.stripe = {
          status: 'error',
          error: `HTTP ${response.status}: ${response.statusText}`,
        }
      }
    } catch (error: unknown) {
      health.stripe = {
        status: 'error',
        error: error instanceof Error
          ? (error.name === 'AbortError' ? 'Connection timeout (5s)' : error.message)
          : 'Unknown error',
      }
    }
  } else {
    health.stripe = {
      status: 'not_configured',
    }
  }

  // Determine overall health status based on dependencies
  const supabaseStatus = (health.supabase as any)?.status
  const redisStatus = (health.redis as any)?.status
  const stripeStatus = (health.stripe as any)?.status
  const printifyStatus = (health.printify as any)?.status

  // Critical dependencies: Supabase (database is essential)
  // Non-critical: Redis (optional cache), Printify (fulfillment), Stripe (payments can queue)
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  let statusCode = 200

  if (supabaseStatus === 'error') {
    // Database is down - system is unhealthy
    overallStatus = 'unhealthy'
    statusCode = 503
  } else if (
    redisStatus === 'error' ||
    redisStatus === 'disconnected' ||
    stripeStatus === 'error' ||
    printifyStatus === 'error'
  ) {
    // Non-critical dependencies down - system is degraded but functional
    overallStatus = 'degraded'
    statusCode = 200 // Still return 200 for degraded (system is operational)
  }

  health.status = overallStatus

  const origin = req.headers.get('origin')

  // Log health check
  logInfo('Health check completed', {
    status: overallStatus,
    supabase: supabaseStatus,
    redis: redisStatus,
    stripe: stripeStatus,
    printify: printifyStatus,
  })

  return NextResponse.json(health, {
    status: statusCode,
    headers: getCorsHeaders(origin),
  })
}
