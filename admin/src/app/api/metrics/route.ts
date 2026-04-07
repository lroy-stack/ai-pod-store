/**
 * GET /panel/api/metrics
 * Prometheus-compatible metrics endpoint for admin service
 * Returns metrics in Prometheus text format
 * Protected by withAuth — admin credentials required
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import type { SessionData } from '@/lib/session'

const startTime = Date.now()

export const GET = withAuth(async (request: NextRequest, session: SessionData) => {
  try {
    const uptime = (Date.now() - startTime) / 1000
    const memoryUsage = process.memoryUsage()

    // Prometheus text format metrics
    const metrics = `
# HELP admin_uptime_seconds Time since service started
# TYPE admin_uptime_seconds gauge
admin_uptime_seconds ${uptime}

# HELP admin_memory_usage_bytes Memory usage by type
# TYPE admin_memory_usage_bytes gauge
admin_memory_usage_bytes{type="rss"} ${memoryUsage.rss}
admin_memory_usage_bytes{type="heap_used"} ${memoryUsage.heapUsed}
admin_memory_usage_bytes{type="heap_total"} ${memoryUsage.heapTotal}
admin_memory_usage_bytes{type="external"} ${memoryUsage.external}

# HELP admin_heap_usage_ratio Heap used vs heap total ratio
# TYPE admin_heap_usage_ratio gauge
admin_heap_usage_ratio ${(memoryUsage.heapUsed / memoryUsage.heapTotal).toFixed(4)}

# HELP admin_info Service information
# TYPE admin_info gauge
admin_info{version="0.3.0",service="admin",environment="${process.env.NODE_ENV || 'development'}"} 1
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
})
