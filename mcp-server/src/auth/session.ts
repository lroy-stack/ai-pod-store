import { jwtVerify } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { IncomingMessage } from 'node:http';
import { getRedisClient } from '../lib/redis.js';
import { revokedTokens } from './oauth-provider.js';
import { requiredEnv } from '../lib/env.js';

const MCP_JWT_SECRET = new TextEncoder().encode(requiredEnv('MCP_JWT_SECRET'));
const MCP_BASE_URL = requiredEnv('MCP_BASE_URL');

/**
 * Extract and validate JWT from Authorization header.
 * Returns SDK AuthInfo with userId/email in extra field.
 * Returns null if no token or invalid token (public tools still work).
 *
 * Only accepts MCP-issued OAuth 2.1 JWTs with valid signatures.
 */
export async function validateJwt(req: IncomingMessage): Promise<AuthInfo | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  // Try MCP JWT first
  try {
    const { payload } = await jwtVerify(token, MCP_JWT_SECRET, {
      issuer: MCP_BASE_URL,
      audience: MCP_BASE_URL,
    });

    // Check if token is revoked (in-memory FIRST for speed, then Redis for cross-instance)
    if (revokedTokens.has(token)) {
      console.info('[Auth] Rejected revoked token (from memory)');
      return null;
    }

    const redis = getRedisClient();
    if (redis?.status === 'ready') {
      try {
        const revoked = await redis.get(`oauth:revoked:${token}`);
        if (revoked) {
          // Sync to in-memory for faster future checks
          const exp = payload.exp || Math.floor(Date.now() / 1000) + 900;
          revokedTokens.set(token, { revoked_at: Math.floor(Date.now() / 1000), expires_at: exp });
          console.info('[Auth] Rejected revoked token (from Redis, synced to memory)');
          return null;
        }
      } catch (err) {
        console.error('[Auth] Failed to check revocation in Redis:', err);
        // In-memory already checked above — continue
      }
    }

    return {
      token,
      clientId: (payload.azp as string) || (payload.client_id as string) || 'mcp-client',
      scopes: typeof payload.scope === 'string'
        ? payload.scope.split(' ').filter(Boolean)
        : ['read', 'write'],
      expiresAt: payload.exp,
      extra: {
        userId: payload.sub,
        email: payload.email as string | undefined,
      },
    };
  } catch {
    // Invalid or expired JWT - reject
    return null;
  }
}

/**
 * Inject auth info into request object for SDK transport.
 * The SDK reads req.auth and passes it to tool handlers via extra.authInfo.
 */
export async function injectAuthInfo(
  req: IncomingMessage & { auth?: AuthInfo }
): Promise<void> {
  const authInfo = await validateJwt(req);
  if (authInfo) {
    req.auth = authInfo;
  }
}
