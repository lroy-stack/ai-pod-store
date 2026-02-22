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

/**
 * OPTIONS /api/ping
 *
 * Handle CORS preflight requests
 *
 * @param {Request} req - The incoming request
 * @returns {Response} CORS preflight response
 */
export async function OPTIONS(req: Request) {
  const preflightResponse = handleCorsPrelight(req)
  return preflightResponse || new Response(null, { status: 405 })
}

/**
 * GET /api/ping
 *
 * Lightweight health check endpoint for load balancers
 *
 * Returns 200 OK without checking database or external dependencies.
 * Use /api/health for detailed dependency checks.
 *
 * @param {Request} req - The incoming request
 * @returns {Response} JSON response with status and timestamp
 */
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
