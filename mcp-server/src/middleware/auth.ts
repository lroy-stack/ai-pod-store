import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8002';
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Auth level for tool registration.
 * - 'required': Tool fails with auth error if no valid token
 * - 'optional': Tool receives authInfo if available, works without
 * - 'none': Tool never receives authInfo
 */
export type AuthLevel = 'required' | 'optional' | 'none';

/**
 * Centralized auth enforcement HOF.
 * Replaces the identical boilerplate in 11 protected tools:
 *   if (!authInfo || !authInfo.extra?.userId) { return { success: false, error: 'Authentication required...' }; }
 */
export function withAuth(
  level: AuthLevel,
  handler: (input: any, extra?: { authInfo?: AuthInfo }) => Promise<any>,
  requiredScopes?: string[]
): (input: any, extra?: { authInfo?: AuthInfo }) => Promise<any> {
  if (level === 'none') {
    return handler;
  }

  return async (input: any, extra?: { authInfo?: AuthInfo }) => {
    if (level === 'required') {
      const userId = (extra?.authInfo?.extra as Record<string, unknown>)?.userId;
      if (!extra?.authInfo || !userId) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'Authentication required to use this tool.',
              login_url: `${FRONTEND_URL}/en/auth/login`,
              message: `Please log in to your store account first: ${FRONTEND_URL}/en/auth/login — Once logged in, try again.`,
            }, null, 2),
          }],
          isError: true,
          _headers: {
            'WWW-Authenticate': `Bearer resource_metadata="${MCP_BASE_URL}/.well-known/oauth-protected-resource"`,
          },
        };
      }

      // Enforce JWT scopes if tool requires specific scopes
      if (requiredScopes?.length) {
        const userScopes = (extra?.authInfo as any)?.scopes as string[] | undefined || [];
        const hasRequiredScope = requiredScopes.every(s => userScopes.includes(s));
        if (!hasRequiredScope) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: `Insufficient scope. This tool requires all of: ${requiredScopes.join(', ')}`,
              }, null, 2),
            }],
            isError: true,
          };
        }
      }
    }

    return handler(input, extra);
  };
}
