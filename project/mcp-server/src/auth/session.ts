import { jwtVerify } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { IncomingMessage } from 'node:http';

const MCP_JWT_SECRET = new TextEncoder().encode(
  process.env.MCP_JWT_SECRET || 'dev-secret-change-me-in-production'
);
const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8002';

/**
 * Extract and validate JWT from Authorization header.
 * Returns SDK AuthInfo with userId/email in extra field.
 * Returns null if no token or invalid token (public tools still work).
 */
export async function validateJwt(req: IncomingMessage): Promise<AuthInfo | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, MCP_JWT_SECRET, {
      issuer: MCP_BASE_URL,
    });

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
