/**
 * Admin Authentication Helper
 *
 * Provides authentication utilities for admin API routes.
 * All routes except /api/auth/login and /api/health must use requireAuth().
 */

import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from './session';

/**
 * Authentication result type
 */
export type AuthResult =
  | { authenticated: true; session: SessionData }
  | { authenticated: false; response: NextResponse };

/**
 * Require authentication for admin API routes
 *
 * This function checks if a user is authenticated via iron-session.
 * If not authenticated, it returns a 401 Unauthorized response.
 * If authenticated, it returns the session data.
 *
 * Usage in route handlers:
 * ```ts
 * const auth = await requireAuth();
 * if (!auth.authenticated) {
 *   return auth.response;
 * }
 * // Use auth.session.id, auth.session.email, etc.
 * ```
 *
 * @returns Authentication result with session data or error response
 */
export async function requireAuth(): Promise<AuthResult> {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn || !session.id) {
      return {
        authenticated: false,
        response: NextResponse.json(
          { error: 'Unauthorized. Please log in.' },
          { status: 401 }
        ),
      };
    }

    return {
      authenticated: true,
      session: {
        id: session.id,
        email: session.email,
        role: session.role,
        name: session.name,
        isLoggedIn: session.isLoggedIn,
      },
    };
  } catch (error) {
    console.error('Auth check error:', error);
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      ),
    };
  }
}

/**
 * Optional: Get session without enforcing authentication
 *
 * Returns session data if authenticated, or null if not.
 * Use this for routes that optionally use auth data but don't require it.
 *
 * @returns Session data or null
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

    if (!session.isLoggedIn || !session.id) {
      return null;
    }

    return {
      id: session.id,
      email: session.email,
      role: session.role,
      name: session.name,
      isLoggedIn: session.isLoggedIn,
    };
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
}
