import { NextResponse } from 'next/server'

export async function GET() {
  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  }

  // Check database connection
  const supabaseUrl = process.env.SUPABASE_URL
  const apiKey = process.env.SUPABASE_SERVICE_KEY

  if (supabaseUrl && apiKey) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        health.db = 'connected'
      } else {
        health.db = 'error'
        health.dbError = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (error: unknown) {
      health.db = 'error'
      health.dbError = error instanceof Error
        ? (error.name === 'AbortError' ? 'Connection timeout (3s)' : error.message)
        : 'Unknown error'
    }
  } else {
    health.db = 'not_configured'
  }

  // Redis is optional — skip if not configured
  health.redis = process.env.REDIS_URL ? 'not_checked' : 'not_configured'

  const statusCode = health.db === 'error' ? 503 : 200
  return NextResponse.json(health, { status: statusCode })
}
