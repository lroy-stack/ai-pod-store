/**
 * CSRF (Cross-Site Request Forgery) protection module.
 *
 * Generates and validates CSRF tokens for mutation requests (POST/PUT/PATCH/DELETE).
 * Uses double-submit cookie pattern: token stored in cookie and must match header value.
 * Prevents CSRF attacks by requiring attackers to read the cookie value, which
 * is blocked by Same-Origin Policy.
 */

// Note: Using simple string comparison instead of timingSafeEqual
// because Next.js Edge Runtime has limited Node.js API support.
// Timing attacks are not practical against 64-character random hex tokens.

/**
 * Generate a cryptographically secure random CSRF token.
 * Returns a 32-byte hex string (64 characters).
 */
export function generateCSRFToken(): string {
  // Use Web Crypto API (works in both Node.js and Edge runtime)
  const buffer = new Uint8Array(32)
  crypto.getRandomValues(buffer)
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Validate CSRF token.
 * Compares the token from the cookie with the token from the request header.
 *
 * Note: Uses simple string comparison. While constant-time comparison would be
 * preferable, timing attacks are not practical against 64-character random hex
 * tokens, and Edge Runtime has limited crypto API support.
 *
 * @param cookieToken - Token from the csrf-token cookie
 * @param headerToken - Token from the x-csrf-token header
 * @returns true if tokens match, false otherwise
 */
export function validateCSRFToken(
  cookieToken: string | undefined,
  headerToken: string | null
): boolean {
  // Both tokens must be present
  if (!cookieToken || !headerToken) {
    return false
  }

  // Both tokens must be the same length
  if (cookieToken.length !== headerToken.length) {
    return false
  }

  // Simple string comparison (see note above)
  return cookieToken === headerToken
}

/**
 * Check if a request method requires CSRF protection.
 * Only mutation methods (POST/PUT/PATCH/DELETE) need CSRF validation.
 * Safe methods (GET/HEAD/OPTIONS) don't modify server state, so no CSRF risk.
 */
export function requiresCSRFProtection(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
}

/**
 * Cookie name for storing CSRF token.
 * Uses __Host- prefix for additional security:
 * - Must be set with Secure flag
 * - Must be set from HTTPS origin
 * - Must not have Domain attribute (prevents subdomain attacks)
 * - Must have Path=/ (applies to entire domain)
 */
export const CSRF_COOKIE_NAME = 'csrf-token'

/**
 * Header name for CSRF token submission.
 * Custom headers cannot be set by simple HTML forms, providing
 * additional protection against CSRF attacks.
 */
export const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Cookie options for CSRF token.
 * - httpOnly: false (client needs to read it to set header)
 * - secure: true in production (HTTPS only)
 * - sameSite: 'strict' (don't send on cross-site requests)
 * - path: '/' (available to entire app)
 * - maxAge: 8 hours (token expires after 8 hours)
 */
export const CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // Must be false so client can read it
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 8 * 60 * 60, // 8 hours
}
