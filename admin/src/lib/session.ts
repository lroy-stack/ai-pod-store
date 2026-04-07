/**
 * Iron Session Configuration
 *
 * Provides signed and encrypted session cookies for admin authentication.
 * Uses iron-session to prevent cookie tampering and data exposure.
 *
 * @see https://github.com/vvo/iron-session
 */

import { SessionOptions } from 'iron-session'

export interface SessionData {
  id: string
  email: string
  role: string
  name: string
  isLoggedIn: boolean
  mustChangePassword?: boolean
}

/**
 * Default empty session data
 */
export const defaultSession: SessionData = {
  id: '',
  email: '',
  role: '',
  name: '',
  isLoggedIn: false,
}

/**
 * Iron Session configuration
 *
 * - password: 32+ character secret key for encryption (from env)
 * - cookieName: Cookie name for the session
 * - cookieOptions: Security settings for the cookie
 */
export const sessionOptions: SessionOptions = {
  password: (() => {
    const s = process.env.SESSION_SECRET
    if (!s || s.length < 32 || s.includes('placeholder')) {
      if (process.env.NEXT_PHASE === 'phase-production-build') return 'build-phase-only-not-used-at-runtime-32ch!!'
      throw new Error('FATAL: SESSION_SECRET must be set in environment (min 32 chars)')
    }
    return s
  })(),
  cookieName: 'admin-session',
  cookieOptions: {
    // Secure flag only when behind HTTPS
    // In development (localhost), this is false
    // In production (behind Caddy with HTTPS), this is true
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 12, // 12 hours
    path: '/',
  },
}

/**
 * Type declaration for iron-session
 *
 * This module augmentation allows TypeScript to know about the session data structure
 */
declare module 'iron-session' {
  interface IronSessionData {
    id?: string
    email?: string
    role?: string
    name?: string
    isLoggedIn?: boolean
    mustChangePassword?: boolean
  }
}
