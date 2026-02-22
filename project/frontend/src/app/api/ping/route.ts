/**
 * Lightweight Health Check (Ping)
 *
 * Returns 200 OK without checking database or external dependencies.
 * This endpoint is designed for load balancers and monitoring tools
 * that need a very fast health check to verify the server is running.
 *
 * For detailed dependency health checks, use /api/health instead.
 */

import { NextResponse } from 'next/server'
import { getCorsHeaders, handleCorsPrelight } from '@/lib/cors'

export async function OPTIONS(req: Request) {
  const preflightResponse = handleCorsPrelight(req)
  return preflightResponse || new Response(null, { status: 405 })
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin')

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: getCorsHeaders(origin),
    }
  )
}
