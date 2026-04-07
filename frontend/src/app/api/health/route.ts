import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis'
import { getCorsHeaders, handleCorsPrelight } from '@/lib/cors'
import { logInfo } from '@/lib/logger'

/**
 * OPTIONS /api/health
 *
 * Handle CORS preflight requests for the health endpoint
 *
 * @param {Request} req - The incoming request
 * @returns {Response} CORS preflight response
 */
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

/**
 * GET /api/health
 *
 * Health check endpoint with dependency latency measurements
 *
 * Returns system status, memory usage, and latency metrics for:
 * - Supabase (database)
 * - Redis (cache)
 * - Printify (fulfillment API)
 * - Stripe (payment API)
 *
 * @param {Request} req - The incoming request
 * @returns {Response} JSON health status with latencies
 */
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

  // Check POD Provider (Printify/Printful) with latency
  try {
    const { initializeProviders, getProvider } = await import('@/lib/pod')
    initializeProviders()
    const provider = getProvider()
    const { result: healthResult, latency } = await measureLatency(async () => {
      return await provider.healthCheck()
    })
    // Token expiry check (Printful OAuth tokens expire)
    const tokenExpiresAt = process.env.PRINTFUL_TOKEN_EXPIRES_AT
    let daysUntilExpiry: number | undefined
    let tokenExpiryDegraded = false
    if (tokenExpiresAt) {
      const expiryDate = new Date(tokenExpiresAt)
      daysUntilExpiry = Math.round((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysUntilExpiry < 7) tokenExpiryDegraded = true
    }

    // Last sync staleness check
    let lastSyncStale = false
    try {
      const supabaseUrl = process.env.SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_KEY
      if (supabaseUrl && serviceKey) {
        const { createClient } = await import('@supabase/supabase-js')
        const adminClient = createClient(supabaseUrl, serviceKey)
        const { data: lastRun } = await adminClient
          .from('cron_runs')
          .select('completed_at')
          .eq('cron_name', 'sync-products')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single()
        if (lastRun?.completed_at) {
          const minutesSince = (Date.now() - new Date(lastRun.completed_at).getTime()) / (1000 * 60)
          lastSyncStale = minutesSince > 90
        }
      }
    } catch {
      // Non-critical — ignore staleness check errors
    }

    health.pod = {
      status: healthResult.ok && !tokenExpiryDegraded ? 'connected' : (healthResult.ok ? 'degraded' : 'error'),
      provider: healthResult.provider,
      latency,
      ...(healthResult.error && { error: healthResult.error }),
      ...(daysUntilExpiry !== undefined && { daysUntilExpiry }),
      ...(tokenExpiryDegraded && { tokenExpiryWarning: `Token expires in ${daysUntilExpiry} days` }),
      lastSyncStale,
    }
  } catch (error: unknown) {
    health.pod = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
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
  const podStatus = (health.pod as any)?.status

  // Critical dependencies: Supabase (database is essential)
  // Non-critical: Redis (optional cache), POD provider (fulfillment), Stripe (payments can queue)
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
    podStatus === 'error'
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
    pod: podStatus,
  })

  return NextResponse.json(health, {
    status: statusCode,
    headers: getCorsHeaders(origin),
  })
}
