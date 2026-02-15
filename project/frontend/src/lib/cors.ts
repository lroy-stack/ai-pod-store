/**
 * CORS configuration for API routes
 * Allows the frontend origin and common development/production scenarios
 */

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_BASE_URL || 'https://podai.com',
    'http://localhost:3000',
    'http://localhost:3001', // Admin panel
  ]

  const requestOrigin = origin || ''
  const allowOrigin = allowedOrigins.some((allowed) => requestOrigin.startsWith(allowed))
    ? requestOrigin
    : allowedOrigins[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
}

export function handleCorsPrelight(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin')
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    })
  }
  return null
}
