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
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required. Set a 32+ character secret in .env.local')
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: 'admin-session',
  cookieOptions: {
    // Secure flag only when behind HTTPS
    // In development (localhost), this is false
    // In production (behind Caddy with HTTPS), this is true
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
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
  }
}
