import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { getRedisClient } from '../lib/redis.js';
import { SignJWT } from 'jose';

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8002';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
if (!process.env.MCP_JWT_SECRET) {
  throw new Error('MCP_JWT_SECRET environment variable is required');
}
const MCP_JWT_SECRET = new TextEncoder().encode(process.env.MCP_JWT_SECRET);

// In-memory fallback for auth requests (if Redis unavailable)
const authRequests = new Map<
  string,
  {
    client_id: string;
    redirect_uri: string;
    state: string;
    code_challenge: string;
    code_challenge_method: string;
    created_at: number;
  }
>();

// In-memory fallback for authorization codes (if Redis unavailable)
const authorizationCodes = new Map<
  string,
  {
    request_id: string;
    user_id: string;
    email: string;
    created_at: number;
  }
>();

// In-memory fallback for revoked tokens (if Redis unavailable)
// Exported for use in session.ts validation
export const revokedTokens = new Map<string, { revoked_at: number; expires_at: number }>();

// Clean up old auth requests and codes every 5 minutes (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authRequests.entries()) {
    if (now - value.created_at > 10 * 60 * 1000) {
      authRequests.delete(key);
    }
  }
  for (const [key, value] of authorizationCodes.entries()) {
    if (now - value.created_at > 10 * 60 * 1000) {
      authorizationCodes.delete(key);
    }
  }
  // Clean up expired revoked tokens
  for (const [token, data] of revokedTokens.entries()) {
    if (now > data.expires_at * 1000) {
      revokedTokens.delete(token);
    }
  }
}, 5 * 60 * 1000);

/**
 * OAuth 2.1 Authorization Server Metadata
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 */
export function handleAuthorizationServerMetadata(
  _req: IncomingMessage,
  res: ServerResponse
): void {
  const metadata = {
    issuer: MCP_BASE_URL,
    authorization_endpoint: `${MCP_BASE_URL}/oauth/authorize`,
    token_endpoint: `${MCP_BASE_URL}/oauth/token`,
    revocation_endpoint: `${MCP_BASE_URL}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(metadata, null, 2));
}

/**
 * OAuth 2.0 Protected Resource Metadata
 * RFC 8414: OAuth 2.0 Authorization Server Metadata (Section 5)
 */
export function handleProtectedResourceMetadata(
  _req: IncomingMessage,
  res: ServerResponse
): void {
  const metadata = {
    resource: MCP_BASE_URL,
    authorization_servers: [MCP_BASE_URL],
    scopes_supported: ['read', 'write'],
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(metadata, null, 2));
}

/**
 * OAuth 2.1 Authorization Endpoint (PKCE required)
 * GET /oauth/authorize?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256&redirect_uri=...&state=...
 */
export function handleAuthorize(
  req: IncomingMessage,
  res: ServerResponse
): void {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing URL' }));
    return;
  }

  const url = new URL(req.url, MCP_BASE_URL);
  const params = url.searchParams;

  // Extract OAuth parameters
  const response_type = params.get('response_type');
  const client_id = params.get('client_id');
  const redirect_uri = params.get('redirect_uri');
  const state = params.get('state');
  const code_challenge = params.get('code_challenge');
  const code_challenge_method = params.get('code_challenge_method');

  // Validate required parameters
  if (response_type !== 'code') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported',
      })
    );
    return;
  }

  if (!client_id || !redirect_uri) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, redirect_uri',
      })
    );
    return;
  }

  // PKCE validation (REQUIRED in OAuth 2.1)
  if (!code_challenge || !code_challenge_method) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'invalid_request',
        error_description: 'PKCE is required: code_challenge and code_challenge_method must be provided',
      })
    );
    return;
  }

  if (code_challenge_method !== 'S256') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'invalid_request',
        error_description: 'Only code_challenge_method=S256 is supported',
      })
    );
    return;
  }

  // Generate a unique request ID to store the authorization request
  const requestId = randomBytes(16).toString('hex');

  // Store the authorization request (for later verification in token exchange)
  const authRequest = {
    client_id,
    redirect_uri,
    state: state || '',
    code_challenge,
    code_challenge_method,
    created_at: Date.now(),
  };

  // Try to store in Redis, fallback to in-memory
  const redis = getRedisClient();
  if (redis?.status === 'ready') {
    redis
      .setex(`oauth:auth_request:${requestId}`, 600, JSON.stringify(authRequest))
      .catch((err: Error) => {
        console.error('[OAuth] Failed to store auth request in Redis:', err);
        authRequests.set(requestId, authRequest);
      });
  } else {
    authRequests.set(requestId, authRequest);
  }

  // Test mode: auto-approve for E2E tests
  // In production, this would always show the login form
  const autoApprove = params.get('auto_approve') === 'true';
  if (autoApprove && process.env.NODE_ENV !== 'production') {
    // Generate authorization code for test user
    const code = randomBytes(32).toString('hex');
    // Use the existing test user ID from the database
    const testUserId = '5fae3de5-94e8-469d-a6a6-789fd08868d5';
    const testEmail = 'test@example.com';

    // Store the authorization code
    const codeData = {
      request_id: requestId,
      user_id: testUserId,
      email: testEmail,
      created_at: Date.now(),
    };

    if (redis?.status === 'ready') {
      redis
        .setex(`oauth:code:${code}`, 600, JSON.stringify(codeData))
        .catch((err: Error) => {
          console.error('[OAuth] Failed to store code in Redis:', err);
          authorizationCodes.set(code, codeData);
        });
    } else {
      authorizationCodes.set(code, codeData);
    }

    // Redirect back to client with code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    res.writeHead(302, { Location: redirectUrl.toString() });
    res.end();
    return;
  }

  // Render a simple HTML login form
  // In production, this would redirect to the frontend's login page
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize POD AI Store</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .container { background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; width: 100%; padding: 32px; }
    h1 { font-size: 24px; font-weight: 600; margin-bottom: 8px; color: #111; }
    p { color: #666; font-size: 14px; margin-bottom: 24px; }
    .app-name { color: #4f46e5; font-weight: 500; }
    form { display: flex; flex-direction: column; gap: 16px; }
    label { font-size: 14px; font-weight: 500; color: #374151; }
    input { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; font-size: 14px; transition: border-color 0.2s; }
    input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
    button { background: #4f46e5; color: white; border: none; border-radius: 6px; padding: 12px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #4338ca; }
    .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sign in to continue</h1>
    <p><span class="app-name">${escapeHtml(client_id)}</span> wants to access your POD AI Store account</p>
    <form action="${FRONTEND_URL}/en/auth/oauth-callback" method="GET">
      <input type="hidden" name="request_id" value="${escapeHtml(requestId)}">
      <input type="hidden" name="mcp_base" value="${escapeHtml(MCP_BASE_URL)}">
      <div>
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="you@example.com">
      </div>
      <div>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required placeholder="••••••••">
      </div>
      <button type="submit">Sign In</button>
    </form>
    <div class="footer">
      By continuing, you agree to allow access to your account
    </div>
  </div>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * OAuth 2.1 Token Endpoint
 * POST /oauth/token { grant_type, code, code_verifier, redirect_uri }
 */
export async function handleToken(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    // Parse request body
    const body = await parseTokenBody(req);

    // Validate required parameters
    const { grant_type, code, code_verifier, redirect_uri } = body;

    if (grant_type !== 'authorization_code') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'unsupported_grant_type',
          error_description: 'Only grant_type=authorization_code is supported',
        })
      );
      return;
    }

    if (!code || !code_verifier || !redirect_uri) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing required parameters: code, code_verifier, redirect_uri',
        })
      );
      return;
    }

    // Retrieve authorization code data
    const redis = getRedisClient();
    let codeData: { request_id: string; user_id: string; email: string; created_at: number } | null = null;

    if (redis?.status === 'ready') {
      try {
        const raw = await redis.get(`oauth:code:${code}`);
        if (raw) {
          codeData = JSON.parse(raw);
          // Delete code after use (one-time use only)
          await redis.del(`oauth:code:${code}`);
        }
      } catch (err) {
        console.error('[OAuth] Failed to retrieve code from Redis:', err);
      }
    }

    // Fallback to in-memory
    if (!codeData && authorizationCodes.has(code)) {
      codeData = authorizationCodes.get(code)!;
      authorizationCodes.delete(code);
    }

    if (!codeData) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code',
        })
      );
      return;
    }

    // Retrieve auth request data
    let authRequest: {
      client_id: string;
      redirect_uri: string;
      state: string;
      code_challenge: string;
      code_challenge_method: string;
      created_at: number;
    } | null = null;

    if (redis?.status === 'ready') {
      try {
        const raw = await redis.get(`oauth:auth_request:${codeData.request_id}`);
        if (raw) {
          authRequest = JSON.parse(raw);
          // Delete after use
          await redis.del(`oauth:auth_request:${codeData.request_id}`);
        }
      } catch (err) {
        console.error('[OAuth] Failed to retrieve auth request from Redis:', err);
      }
    }

    // Fallback to in-memory
    if (!authRequest && authRequests.has(codeData.request_id)) {
      authRequest = authRequests.get(codeData.request_id)!;
      authRequests.delete(codeData.request_id);
    }

    if (!authRequest) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid authorization request',
        })
      );
      return;
    }

    // Validate redirect_uri matches
    if (authRequest.redirect_uri !== redirect_uri) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'redirect_uri does not match',
        })
      );
      return;
    }

    // PKCE validation: verify code_verifier
    const isValid = verifyPkce(code_verifier, authRequest.code_challenge);
    if (!isValid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'PKCE validation failed: code_verifier does not match code_challenge',
        })
      );
      return;
    }

    // Generate JWT access token
    const accessToken = await new SignJWT({
      sub: codeData.user_id,
      email: codeData.email,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(MCP_BASE_URL)
      .setAudience('mcp-client')
      .setExpirationTime('24h')
      .setIssuedAt()
      .sign(MCP_JWT_SECRET);

    // Return token response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400, // 24 hours
      })
    );
  } catch (error) {
    console.error('[OAuth] Token endpoint error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error',
      })
    );
  }
}

/**
 * Parse POST body for token endpoint
 */
function parseTokenBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        if (!raw) {
          resolve({});
          return;
        }
        // Support both JSON and form-urlencoded
        if (req.headers['content-type']?.includes('application/json')) {
          resolve(JSON.parse(raw));
        } else {
          // Parse application/x-www-form-urlencoded
          const params = new URLSearchParams(raw);
          const body: any = {};
          for (const [key, value] of params.entries()) {
            body[key] = value;
          }
          resolve(body);
        }
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Verify PKCE code_verifier against code_challenge
 * Uses S256 method: BASE64URL(SHA256(code_verifier)) === code_challenge
 */
function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  // Hash the code_verifier using SHA256
  const hash = createHash('sha256').update(codeVerifier).digest();
  // Base64url encode (replace +/= with -_~)
  const computed = hash
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return computed === codeChallenge;
}

/**
 * OAuth 2.1 Token Revocation Endpoint
 * POST /oauth/revoke { token }
 * RFC 7009: OAuth 2.0 Token Revocation
 */
export async function handleRevoke(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    // Parse request body
    const body = await parseTokenBody(req);
    const { token } = body;

    if (!token) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'invalid_request',
          error_description: 'Missing required parameter: token',
        })
      );
      return;
    }

    // Decode the token to get expiration time (for TTL)
    // We don't need to verify signature here - just decode to get exp
    let exp: number | undefined;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        exp = payload.exp;
      }
    } catch {
      // Invalid token format - still accept revocation (RFC 7009: always return 200)
      exp = undefined;
    }

    // Calculate TTL (time until token expires naturally)
    let ttl = 86400; // Default 24 hours (max token lifetime)
    if (exp) {
      const now = Math.floor(Date.now() / 1000);
      const remaining = exp - now;
      if (remaining > 0) {
        ttl = remaining;
      } else {
        // Token already expired - no need to blacklist
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({}));
        return;
      }
    }

    // Blacklist token in Redis (or in-memory fallback)
    const redis = getRedisClient();
    if (redis?.status === 'ready') {
      try {
        await redis.setex(`oauth:revoked:${token}`, ttl, '1');
        console.info(`[OAuth] Token revoked in Redis (TTL: ${ttl}s)`);
      } catch (err) {
        console.error('[OAuth] Failed to blacklist token in Redis:', err);
        // Fallback to in-memory
        const expiresAt = exp || Math.floor(Date.now() / 1000) + ttl;
        revokedTokens.set(token, { revoked_at: Math.floor(Date.now() / 1000), expires_at: expiresAt });
        console.warn(`[OAuth] Token revoked in memory (fallback)`);
      }
    } else {
      // Store in-memory when Redis unavailable
      const expiresAt = exp || Math.floor(Date.now() / 1000) + ttl;
      revokedTokens.set(token, { revoked_at: Math.floor(Date.now() / 1000), expires_at: expiresAt });
      console.info(`[OAuth] Token revoked in memory (TTL: ${ttl}s)`);
    }

    // RFC 7009: The revocation endpoint responds with HTTP 200 for both successful
    // revocation and tokens that don't exist (to prevent token scanning)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({}));
  } catch (error) {
    console.error('[OAuth] Revoke endpoint error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error',
      })
    );
  }
}
