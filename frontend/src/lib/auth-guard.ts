/**
 * Auth Guard Module
 *
 * Centralized authentication and authorization for API routes.
 * Reads Supabase session cookies, verifies tokens, and checks user roles/tiers.
 */

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface AuthUser {
  id: string
  email: string
  tier: 'free' | 'premium'
  role: string
  credit_balance: number
}

export class AuthError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
    this.code = code
  }
}

/**
 * Extract auth token from request cookies.
 * Exported for routes that need the raw token (e.g. signOut).
 */
export function getAccessToken(req: NextRequest): string | null {
  const cookieHeader = req.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [key, ...val] = c.trim().split('=')
      return [key, val.join('=')]
    })
  )
  return cookies['sb-access-token'] || null
}

/**
 * Get authenticated user from request (returns null if not authenticated).
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token = getAccessToken(req)
  if (!token) return null

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null

    // Fetch tier + role from users table
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('tier, role, credit_balance')
      .eq('id', user.id)
      .single()

    return {
      id: user.id,
      email: user.email || '',
      tier: (profile?.tier as 'free' | 'premium') || 'free',
      role: profile?.role || 'customer',
      credit_balance: profile?.credit_balance || 0,
    }
  } catch {
    return null
  }
}

/**
 * Require authenticated user — throws 401 if not authenticated.
 */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(req)
  if (!user) {
    throw new AuthError('Authentication required', 401, 'AUTH_REQUIRED')
  }
  return user
}

/**
 * Require admin role — throws 403 if not admin.
 */
export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req)
  if (user.role !== 'admin') {
    throw new AuthError('Admin access required', 403, 'ADMIN_REQUIRED')
  }
  return user
}

/**
 * Get client IP address from request headers.
 * Priority: CF-Connecting-IP > X-Real-IP > first X-Forwarded-For entry
 * Rejects obviously invalid IPs in production (localhost, private ranges).
 */
export function getClientIP(req: NextRequest): string {
  const raw =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'

  // In production, reject localhost/loopback as client IP (likely spoofed)
  if (process.env.NODE_ENV === 'production') {
    if (raw === '127.0.0.1' || raw === '::1' || raw === 'localhost') {
      return 'unknown'
    }
  }

  return raw
}

/**
 * Helper to create a JSON error response from an AuthError.
 */
export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status }
    )
  }
  throw error
}
