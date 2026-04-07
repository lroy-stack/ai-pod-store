/**
 * withAuth — Admin API Route Authentication Middleware
 *
 * Higher-order function that wraps admin API route handlers to:
 * 1. Validate iron-session authentication
 * 2. Auto-log to audit_log before sending response
 * 3. Return 401 if not authenticated
 *
 * Usage:
 *   export const GET = withAuth(async (req, session) => {
 *     // Your handler code here
 *     return NextResponse.json({ data: '...' })
 *   })
 */

import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { checkApiRateLimit } from '@/lib/rate-limit'

/**
 * Type for authenticated route handlers.
 * Handlers receive the request, validated session data, and optional route context (params).
 * Returns NextResponse for standard JSON responses, or Response for streaming/SSE endpoints.
 */
type AuthenticatedHandler = (
  req: NextRequest,
  session: SessionData,
  context?: any
) => Promise<NextResponse | Response> | NextResponse | Response

/**
 * Extract HTTP method and pathname for audit logging.
 */
function getRequestInfo(req: NextRequest) {
  const method = req.method
  const pathname = new URL(req.url).pathname
  return { method, pathname }
}

/**
 * Extract client IP from request headers (for audit logging).
 */
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const cfIp = req.headers.get('cf-connecting-ip')

  return cfIp || realIp || forwarded?.split(',')[0] || 'unknown'
}

/**
 * Log API request to audit_log table.
 *
 * @param session - Admin session data
 * @param req - Next.js request object
 * @param statusCode - HTTP status code of response
 */
async function logAuditEntry(
  session: SessionData,
  req: NextRequest,
  statusCode: number
): Promise<void> {
  try {
    const { method, pathname } = getRequestInfo(req)
    const ipAddress = getClientIP(req)
    const userAgent = req.headers.get('user-agent') || 'unknown'

    await supabaseAdmin.from('audit_log').insert({
      actor_type: 'admin',
      actor_id: session.id,
      action: `api_${method.toLowerCase()}`,
      resource_type: 'api_endpoint',
      resource_id: pathname,
      changes: null,
      metadata: {
        ip_address: ipAddress,
        user_agent: userAgent,
        status_code: statusCode,
        email: session.email,
      },
    })
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Audit log error:', error)
  }
}

/**
 * withAuth — Higher-order function for admin API route authentication.
 *
 * Wraps an API route handler to require authentication via iron-session.
 * Returns 401 if session is invalid or user is not logged in.
 * Automatically logs API requests to audit_log table.
 *
 * @param handler - The authenticated route handler function
 * @returns Wrapped handler that validates auth before execution
 *
 * @example
 * export const GET = withAuth(async (req, session) => {
 *   const data = await fetchData()
 *   return NextResponse.json(data)
 * })
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async function authenticatedRoute(req: NextRequest, context?: any): Promise<NextResponse | Response> {
    try {
      // Check API rate limits before authentication
      const rateLimitResult = await checkApiRateLimit(req)
      if (rateLimitResult) {
        return NextResponse.json(
          { error: 'Too Many Requests', message: 'Rate limit exceeded. Please slow down.' },
          { status: 429, headers: rateLimitResult.headers }
        )
      }

      // Get iron-session from cookies
      const session = await getIronSession<SessionData>(await cookies(), sessionOptions)

      // Check if user is authenticated
      if (!session.isLoggedIn || !session.id) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        )
      }

      // Check if user has admin role
      if (session.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Admin role required' },
          { status: 403 }
        )
      }

      // Block limited sessions that require password change
      if (session.mustChangePassword) {
        return NextResponse.json(
          { error: 'PasswordChangeRequired', message: 'You must change your password before continuing' },
          { status: 403 }
        )
      }

      // Execute the wrapped handler, passing context (route params) if present
      const response = await handler(req, session, context)

      // Log to audit_log after successful execution
      const statusCode = response.status || 200
      // Fire and forget audit logging (don't await)
      logAuditEntry(session, req, statusCode).catch((err) => {
        console.error('Audit log failed:', err)
      })

      return response
    } catch (error) {
      console.error('withAuth error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
