/**
 * GET /api/metrics
 * Prometheus-compatible metrics endpoint for frontend service
 * Returns metrics in Prometheus text format
 */

import { NextResponse } from 'next/server'

const startTime = Date.now()

export async function GET(req: Request) {
  try {
    // Require Bearer token for metrics endpoint
    const authHeader = req.headers.get('authorization')
    const expectedToken = process.env.METRICS_SECRET
    if (!expectedToken) {
      return new NextResponse('METRICS_SECRET not configured', { status: 403 })
    }
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const uptime = (Date.now() - startTime) / 1000
    const memoryUsage = process.memoryUsage()

    // Prometheus text format metrics
    const metrics = `
# HELP frontend_uptime_seconds Time since service started
# TYPE frontend_uptime_seconds gauge
frontend_uptime_seconds ${uptime}

# HELP frontend_memory_usage_bytes Memory usage by type
# TYPE frontend_memory_usage_bytes gauge
frontend_memory_usage_bytes{type="rss"} ${memoryUsage.rss}
frontend_memory_usage_bytes{type="heap_used"} ${memoryUsage.heapUsed}
frontend_memory_usage_bytes{type="heap_total"} ${memoryUsage.heapTotal}
frontend_memory_usage_bytes{type="external"} ${memoryUsage.external}

# HELP frontend_heap_usage_ratio Heap used vs heap total ratio
# TYPE frontend_heap_usage_ratio gauge
frontend_heap_usage_ratio ${(memoryUsage.heapUsed / memoryUsage.heapTotal).toFixed(4)}

# HELP frontend_info Service information
# TYPE frontend_info gauge
frontend_info{version="0.3.0",service="frontend",environment="${process.env.NODE_ENV || 'development'}"} 1
`.trim()

    return new NextResponse(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[Metrics] Error generating metrics:', error)
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    )
  }
}
