import { jwtVerify } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { IncomingMessage } from 'node:http';
import { getRedisClient } from '../lib/redis.js';
import { revokedTokens } from './oauth-provider.js';

if (!process.env.MCP_JWT_SECRET) {
  throw new Error('MCP_JWT_SECRET environment variable is required');
}
const MCP_JWT_SECRET = new TextEncoder().encode(process.env.MCP_JWT_SECRET);
const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8002';

/**
 * Extract and validate JWT from Authorization header.
 * Returns SDK AuthInfo with userId/email in extra field.
 * Returns null if no token or invalid token (public tools still work).
 *
 * Supports both MCP-issued JWTs and Supabase JWTs for testing/development.
 */
export async function validateJwt(req: IncomingMessage): Promise<AuthInfo | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  // Try MCP JWT first
  try {
    const { payload } = await jwtVerify(token, MCP_JWT_SECRET, {
      issuer: MCP_BASE_URL,
    });

    // Check if token is revoked (Redis first, then in-memory fallback)
    const redis = getRedisClient();
    if (redis?.status === 'ready') {
      try {
        const revoked = await redis.get(`oauth:revoked:${token}`);
        if (revoked) {
          console.info('[Auth] Rejected revoked token (from Redis)');
          return null; // Token is blacklisted
        }
      } catch (err) {
        console.error('[Auth] Failed to check revocation in Redis:', err);
        // Check in-memory fallback
        if (revokedTokens.has(token)) {
          console.info('[Auth] Rejected revoked token (from memory fallback)');
          return null;
        }
      }
    } else {
      // No Redis - check in-memory
      if (revokedTokens.has(token)) {
        console.info('[Auth] Rejected revoked token (from memory)');
        return null;
      }
    }

    return {
      token,
      clientId: 'mcp-client',
      scopes: ['read', 'write'],
      expiresAt: payload.exp,
      extra: {
        userId: payload.sub,
        email: payload.email as string | undefined,
      },
    };
  } catch {
    // Try Supabase JWT (for testing/development)
    try {
      // Decode without verification for Supabase tokens (development only)
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      // Verify it's a Supabase token by checking issuer pattern
      if (!payload.iss?.includes('supabase.co')) return null;

      return {
        token,
        clientId: 'supabase-client',
        scopes: ['read', 'write'],
        expiresAt: payload.exp,
        extra: {
          userId: payload.sub,
          email: payload.email as string | undefined,
        },
      };
    } catch {
      return null;
    }
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
