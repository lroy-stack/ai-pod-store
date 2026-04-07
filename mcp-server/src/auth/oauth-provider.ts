import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { getRedisClient } from '../lib/redis.js';
import { SignJWT } from 'jose';
import { getClientAsync, validateRedirectUri, registerDynamicClient } from './clients.js';
import { clientIdAlreadyApproved, generateApprovalCookieHeader } from './cookie-approval.js';

const NODE_ENV = process.env.NODE_ENV || 'development';
const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8002';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SUPABASE_AUTH_URL = process.env.API_EXTERNAL_URL || process.env.SUPABASE_URL || 'http://localhost:8000';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Fail-fast in production if critical URLs are localhost
if (NODE_ENV === 'production') {
  for (const [name, url] of [['MCP_BASE_URL', MCP_BASE_URL], ['FRONTEND_URL', FRONTEND_URL], ['SUPABASE_AUTH_URL', SUPABASE_AUTH_URL]] as const) {
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      throw new Error(`[OAuth] CRITICAL: ${name} points to localhost in production: ${url}`);
    }
  }
}
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
    scopes: string[];
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
    scopes?: string[];
    created_at: number;
  }
>();

// In-memory fallback for revoked tokens (if Redis unavailable)
// Exported for use in session.ts validation
export const revokedTokens = new Map<string, { revoked_at: number; expires_at: number }>();

// In-memory fallback for refresh tokens (if Redis unavailable)
const refreshTokenStore = new Map<
  string,
  {
    user_id: string;
    email: string;
    family_id: string;
    scopes?: string[];
    created_at: number;
  }
>();

// Track used refresh tokens for replay detection
const usedRefreshTokens = new Map<string, { family_id: string; used_at: number }>();

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
const MAX_MAP_SIZE = 10_000; // Hard cap for in-memory fallback maps

/**
 * Evict oldest 20% of entries when a Map exceeds MAX_MAP_SIZE.
 * Prevents unbounded memory growth when Redis is unavailable.
 */
function evictIfFull<K, V>(map: Map<K, V>): void {
  if (map.size < MAX_MAP_SIZE) return;
  const evictCount = Math.floor(MAX_MAP_SIZE * 0.2);
  const keys = map.keys();
  for (let i = 0; i < evictCount; i++) {
    const key = keys.next().value;
    if (key !== undefined) map.delete(key);
  }
}
const ACCESS_TOKEN_TTL = 900; // 15 minutes in seconds

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
  // Clean up expired refresh tokens
  for (const [token, data] of refreshTokenStore.entries()) {
    if (now - data.created_at > REFRESH_TOKEN_TTL * 1000) {
      refreshTokenStore.delete(token);
    }
  }
  // Clean up old used refresh token markers (keep for 1 hour)
  for (const [token, data] of usedRefreshTokens.entries()) {
    if (now - data.used_at > 60 * 60 * 1000) {
      usedRefreshTokens.delete(token);
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
    authorization_endpoint: `${MCP_BASE_URL}/authorize`,
    token_endpoint: `${MCP_BASE_URL}/token`,
    registration_endpoint: `${MCP_BASE_URL}/register`,
    revocation_endpoint: `${MCP_BASE_URL}/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
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
    bearer_methods_supported: ['header'],
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(metadata, null, 2));
}

/**
 * OAuth 2.1 Authorization Endpoint (PKCE required)
 * GET /oauth/authorize?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256&redirect_uri=...&state=...
 */
export async function handleAuthorize(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
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

  if (!client_id || !redirect_uri || !state) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, redirect_uri, state',
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

  // Validate client_id against registry (static + DCR)
  const redis = getRedisClient();
  const client = await getClientAsync(client_id, redis);
  if (!client) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'invalid_client',
        error_description: 'Unknown client_id. Register your client via POST /register or use a known client identifier.',
      })
    );
    return;
  }

  // Validate redirect_uri against client's allowlist
  if (!validateRedirectUri(client_id, redirect_uri)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'invalid_request',
        error_description: 'redirect_uri is not allowed for this client',
      })
    );
    return;
  }

  // Extract requested scopes (default to client's allowed scopes)
  const requestedScope = params.get('scope') || client.scopes.join(' ');
  const requestedScopes = requestedScope.split(' ').filter(Boolean);
  // Validate scopes are within client's allowed set
  const validScopes = requestedScopes.filter(s => client.scopes.includes(s));
  if (validScopes.length === 0) {
    validScopes.push(...client.scopes);
  }

  // Generate a unique request ID to store the authorization request
  const requestId = randomBytes(16).toString('hex');

  // Store the authorization request (for later verification in token exchange)
  const authRequest = {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method,
    scopes: validScopes,
    created_at: Date.now(),
  };

  // Try to store in Redis, fallback to in-memory
  if (redis?.status === 'ready') {
    redis
      .setex(`oauth:auth_request:${requestId}`, 600, JSON.stringify(authRequest))
      .catch((err: Error) => {
        console.error('[OAuth] Failed to store auth request in Redis:', err);
        evictIfFull(authRequests);
        authRequests.set(requestId, authRequest);
      });
  } else {
    evictIfFull(authRequests);
    authRequests.set(requestId, authRequest);
  }

  // Check cookie: if client already approved, skip consent → redirect to Supabase Auth
  const approveSecret = process.env.MCP_APPROVE_SECRET || '';
  if (clientIdAlreadyApproved(req, client_id!, approveSecret)) {
    const supabaseUrl = await buildSupabaseAuthUrl(requestId);
    const requestIdCookie = `mcp_request_id=${encodeURIComponent(requestId)}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`;
    console.info(`[OAuth] Client ${client_id} already approved (cookie), skipping consent`);
    res.writeHead(302, {
      Location: supabaseUrl,
      'Set-Cookie': requestIdCookie,
    });
    res.end();
    return;
  }

  // Not approved → redirect to frontend consent page
  const consentUrl = new URL(`${FRONTEND_URL}/en/auth/mcp-consent`);
  consentUrl.searchParams.set('request_id', requestId);
  consentUrl.searchParams.set('client_name', client.name);
  consentUrl.searchParams.set('scopes', validScopes.join(' '));

  res.writeHead(302, { Location: consentUrl.toString() });
  res.end();
}

/**
 * OAuth 2.1 Approval Endpoint (internal, called by frontend API route)
 * POST /oauth/approve { request_id, user_id, email, secret }
 *
 * This endpoint is the bridge between the frontend's Supabase auth
 * and the MCP OAuth flow. The frontend validates the user's session,
 * then calls this endpoint with a shared secret to generate the
 * authorization code.
 *
 * Returns: { code, redirect_uri, state } on success
 * The frontend then redirects the user to redirect_uri?code=...&state=...
 */
export async function handleApprove(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseApproveBody(req);
    const { request_id, user_id, email, secret } = body;

    // Validate shared secret
    const approveSecret = process.env.MCP_APPROVE_SECRET;
    if (!approveSecret || approveSecret.length < 32) {
      console.error('[OAuth] MCP_APPROVE_SECRET not configured or too short');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_error', error_description: 'Server not configured for approval' }));
      return;
    }

    const secretBuf = Buffer.from(secret || '');
    const expectedBuf = Buffer.from(approveSecret);
    if (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'access_denied', error_description: 'Invalid approval secret' }));
      return;
    }

    if (!request_id || !user_id || !email) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing required parameters: request_id, user_id, email' }));
      return;
    }

    // Retrieve the original auth request (but DON'T delete it — token endpoint needs it)
    const redis = getRedisClient();
    let authRequest: {
      client_id: string;
      redirect_uri: string;
      state: string;
      code_challenge: string;
      code_challenge_method: string;
      scopes?: string[];
      created_at: number;
    } | null = null;

    if (redis?.status === 'ready') {
      try {
        const raw = await redis.get(`oauth:auth_request:${request_id}`);
        if (raw) authRequest = JSON.parse(raw);
      } catch (err) {
        console.error('[OAuth] Failed to retrieve auth request from Redis:', err);
      }
    }
    if (!authRequest && authRequests.has(request_id)) {
      authRequest = authRequests.get(request_id)!;
    }

    if (!authRequest) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Authorization request not found or expired' }));
      return;
    }

    // Generate authorization code
    const code = randomBytes(32).toString('hex');
    const codeData = {
      request_id,
      user_id,
      email,
      scopes: authRequest.scopes,
      created_at: Date.now(),
    };

    if (redis?.status === 'ready') {
      try {
        await redis.setex(`oauth:code:${code}`, 600, JSON.stringify(codeData));
      } catch (err) {
        console.error('[OAuth] Failed to store code in Redis:', err);
        evictIfFull(authorizationCodes);
        authorizationCodes.set(code, codeData);
      }
    } else {
      evictIfFull(authorizationCodes);
      authorizationCodes.set(code, codeData);
    }

    console.info(`[OAuth] Approval granted for user ${email} (request: ${request_id})`);

    // Return code + redirect info to frontend
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      code,
      redirect_uri: authRequest.redirect_uri,
      state: authRequest.state,
    }));
  } catch (error) {
    console.error('[OAuth] Approve endpoint error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server_error', error_description: 'Internal server error' }));
  }
}

/**
 * Parse POST body for approve endpoint (JSON only)
 */
function parseApproveBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const MAX_BODY_SIZE = 4 * 1024; // 4KB
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
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

    if (grant_type === 'refresh_token') {
      await handleRefreshTokenGrant(req, res, body);
      return;
    }

    if (grant_type !== 'authorization_code') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'unsupported_grant_type',
          error_description: 'Only grant_type=authorization_code and refresh_token are supported',
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
    let codeData: { request_id: string; user_id: string; email: string; scopes?: string[]; created_at: number } | null = null;

    if (redis?.status === 'ready') {
      try {
        // Atomic get+delete to prevent race condition (Redis 6.2+)
        const raw = await redis.getdel(`oauth:code:${code}`);
        if (raw) {
          codeData = JSON.parse(raw);
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
      scopes?: string[];
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

    // Generate token pair (access + refresh)
    const familyId = randomBytes(16).toString('hex');
    const scopes = authRequest.scopes || ['read', 'write'];
    const tokenPair = await generateTokenPair(codeData.user_id, codeData.email, familyId, scopes, authRequest.client_id);

    // Return token response
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tokenPair));
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
 * Generate access + refresh token pair
 */
async function generateTokenPair(
  userId: string,
  email: string,
  familyId: string,
  scopes: string[] = ['read', 'write'],
  clientId?: string
): Promise<{
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}> {
  // Generate JWT access token (15 min)
  const scopeString = scopes.join(' ');
  const accessToken = await new SignJWT({
    sub: userId,
    email,
    scope: scopeString,
    ...(clientId && { azp: clientId }), // Authorized party (RFC 9068)
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(MCP_BASE_URL)
    .setAudience(MCP_BASE_URL)
    .setExpirationTime('15m')
    .setIssuedAt()
    .sign(MCP_JWT_SECRET);

  // Generate opaque refresh token (7 days, one-time-use)
  const refreshToken = randomBytes(64).toString('hex');
  const refreshData = {
    user_id: userId,
    email,
    family_id: familyId,
    scopes,
    created_at: Date.now(),
  };

  // Store refresh token: Redis is primary, in-memory is fallback only
  const redis = getRedisClient();
  let redisWriteSuccess = false;
  if (redis?.status === 'ready') {
    try {
      await redis.setex(`oauth:refresh:${refreshToken}`, REFRESH_TOKEN_TTL, JSON.stringify(refreshData));
      redisWriteSuccess = true;
    } catch (err) {
      console.error('[OAuth] Failed to store refresh token in Redis:', err);
    }
  }
  if (!redisWriteSuccess) {
    evictIfFull(refreshTokenStore);
    refreshTokenStore.set(refreshToken, refreshData);
  }

  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refreshToken,
    scope: scopeString,
  };
}

/**
 * Revoke all tokens in a family (replay detection)
 */
async function revokeFamilyTokens(familyId: string): Promise<void> {
  // Revoke all refresh tokens in this family
  for (const [token, data] of refreshTokenStore.entries()) {
    if (data.family_id === familyId) {
      refreshTokenStore.delete(token);
    }
  }

  const redis = getRedisClient();
  if (redis?.status === 'ready') {
    try {
      // Scan for family tokens in Redis (best effort)
      const familyKey = `oauth:family_revoked:${familyId}`;
      await redis.setex(familyKey, REFRESH_TOKEN_TTL, '1');
    } catch (err) {
      console.error('[OAuth] Failed to revoke family tokens in Redis:', err);
    }
  }

  console.warn(`[OAuth] Revoked all tokens in family ${familyId} (replay detection)`);
}

/**
 * Handle refresh token grant
 */
async function handleRefreshTokenGrant(
  _req: IncomingMessage,
  res: ServerResponse,
  body: any
): Promise<void> {
  const { refresh_token } = body;

  if (!refresh_token) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'invalid_request',
      error_description: 'Missing required parameter: refresh_token',
    }));
    return;
  }

  // Check if this refresh token was already used (replay attack)
  const usedData = usedRefreshTokens.get(refresh_token);
  if (usedData) {
    // REPLAY DETECTED — revoke entire token family
    await revokeFamilyTokens(usedData.family_id);
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Refresh token has already been used (possible replay attack)',
    }));
    return;
  }

  // Retrieve refresh token data: Redis is primary, in-memory is fallback
  let tokenData: { user_id: string; email: string; family_id: string; scopes?: string[]; created_at: number } | null = null;

  const redis = getRedisClient();
  if (redis?.status === 'ready') {
    try {
      const raw = await redis.get(`oauth:refresh:${refresh_token}`);
      if (raw) {
        tokenData = JSON.parse(raw);
        await redis.del(`oauth:refresh:${refresh_token}`); // One-time use
      }
    } catch (err) {
      console.error('[OAuth] Failed to retrieve refresh token from Redis:', err);
    }
  }

  // Fall back to in-memory only when Redis is unavailable
  if (!tokenData && (!redis || redis.status !== 'ready') && refreshTokenStore.has(refresh_token)) {
    tokenData = refreshTokenStore.get(refresh_token)!;
    refreshTokenStore.delete(refresh_token); // One-time use
  }

  if (!tokenData) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Invalid or expired refresh token',
    }));
    return;
  }

  // Check if family has been revoked (reuse redis from above)
  if (redis?.status === 'ready') {
    try {
      const familyRevoked = await redis.get(`oauth:family_revoked:${tokenData.family_id}`);
      if (familyRevoked) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Token family has been revoked',
        }));
        return;
      }
    } catch {
      // Best effort check
    }
  }

  // Mark old refresh token as used (for replay detection)
  evictIfFull(usedRefreshTokens);
  usedRefreshTokens.set(refresh_token, {
    family_id: tokenData.family_id,
    used_at: Date.now(),
  });

  // Generate new token pair with same family (preserve scopes)
  const tokenPair = await generateTokenPair(tokenData.user_id, tokenData.email, tokenData.family_id, tokenData.scopes || ['read', 'write']);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(tokenPair));
}

/**
 * Parse POST body for token endpoint
 */
function parseTokenBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const MAX_TOKEN_BODY_SIZE = 16 * 1024; // 16KB
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_TOKEN_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
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
  if (computed.length !== codeChallenge.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(codeChallenge));
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

    // Blacklist token in BOTH Redis AND in-memory (prevents race conditions)
    const expiresAt = exp || Math.floor(Date.now() / 1000) + ttl;
    evictIfFull(revokedTokens);
    revokedTokens.set(token, { revoked_at: Math.floor(Date.now() / 1000), expires_at: expiresAt });

    const redis = getRedisClient();
    if (redis?.status === 'ready') {
      try {
        await redis.setex(`oauth:revoked:${token}`, ttl, '1');
        console.info(`[OAuth] Token revoked in Redis + memory (TTL: ${ttl}s)`);
      } catch (err) {
        console.error('[OAuth] Failed to blacklist token in Redis (memory-only):', err);
      }
    } else {
      console.info(`[OAuth] Token revoked in memory only (TTL: ${ttl}s)`);
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

// ─── Upstream Supabase Auth (Phase 3) ───────────────────────────────────────

/**
 * Generate Supabase PKCE pair and store code_verifier in Redis.
 * Returns the authorize URL with code_challenge.
 *
 * GoTrue PKCE flow (supabase.com/docs/guides/auth/sessions/pkce-flow):
 *   1. Server generates code_verifier (random 64 bytes hex)
 *   2. Server computes code_challenge = base64url(SHA256(code_verifier))
 *   3. Server stores code_verifier in Redis keyed by mcp_request_id
 *   4. Redirect to GoTrue /auth/v1/authorize with code_challenge
 *   5. After Google login, GoTrue redirects to callback with code
 *   6. Server exchanges code + code_verifier at /auth/v1/token?grant_type=pkce
 */
async function buildSupabaseAuthUrl(mcpRequestId: string): Promise<string> {
  // Generate Supabase PKCE pair (separate from MCP client's PKCE)
  const codeVerifier = randomBytes(64).toString('hex');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Store code_verifier in Redis for exchange in callback
  const redis = getRedisClient();
  if (redis?.status === 'ready') {
    try {
      await redis.setex(`oauth:supabase_verifier:${mcpRequestId}`, 600, codeVerifier);
    } catch (err) {
      console.error('[OAuth] Failed to store Supabase code_verifier:', err);
    }
  }
  // In-memory fallback
  evictIfFull(authRequests); // reuse eviction
  authRequests.set(`__sb_verifier:${mcpRequestId}`, {
    client_id: '__supabase_pkce',
    redirect_uri: '',
    state: codeVerifier,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scopes: [],
    created_at: Date.now(),
  });

  // Clean redirect_to (no query params) — GoTrue drops redirect_to when it
  // contains query params that don't match GOTRUE_URI_ALLOW_LIST exactly.
  // The mcp_request_id is passed via a cookie instead (set in handleAuthorizeApproved).
  const callbackUrl = `${MCP_BASE_URL}/oauth/callback`;
  const authUrl = new URL(`${SUPABASE_AUTH_URL}/auth/v1/authorize`);
  authUrl.searchParams.set('provider', 'google');
  authUrl.searchParams.set('redirect_to', callbackUrl);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 's256');
  return authUrl.toString();
}

/**
 * Handle approval redirect from consent page.
 * GET /oauth/authorize/approved?request_id=...
 *
 * Sets HMAC approval cookie and redirects to Supabase Auth.
 */
export async function handleAuthorizeApproved(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_request' }));
    return;
  }

  const url = new URL(req.url, MCP_BASE_URL);
  const requestId = url.searchParams.get('request_id');

  if (!requestId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing request_id' }));
    return;
  }

  // Retrieve auth request to get client_id for cookie
  const redis = getRedisClient();
  let authRequest: { client_id: string; [key: string]: unknown } | null = null;

  if (redis?.status === 'ready') {
    try {
      const raw = await redis.get(`oauth:auth_request:${requestId}`);
      if (raw) authRequest = JSON.parse(raw);
    } catch (err) {
      console.error('[OAuth] Failed to retrieve auth request from Redis:', err);
    }
  }
  if (!authRequest && authRequests.has(requestId)) {
    authRequest = authRequests.get(requestId)! as unknown as { client_id: string; [key: string]: unknown };
  }

  if (!authRequest) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Authorization request not found or expired' }));
    return;
  }

  // Set approval cookie + mcp_request_id cookie (for callback to recover the auth request)
  const approveSecret = process.env.MCP_APPROVE_SECRET || '';
  const approvalCookie = generateApprovalCookieHeader(req, authRequest.client_id, approveSecret);
  const requestIdCookie = `mcp_request_id=${encodeURIComponent(requestId)}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`;

  // Redirect to Supabase Auth
  const supabaseUrl = await buildSupabaseAuthUrl(requestId);
  console.info(`[OAuth] Approval granted for client ${authRequest.client_id}, redirecting to Supabase Auth`);

  res.writeHead(302, {
    Location: supabaseUrl,
    'Set-Cookie': [approvalCookie, requestIdCookie],
  });
  res.end();
}

/**
 * Handle callback from Supabase Auth after user authenticates.
 * GET /oauth/callback?code=...&mcp_request_id=...
 *
 * Exchanges Supabase code for user session, generates MCP authorization code,
 * and redirects to the MCP client's callback URL.
 */
export async function handleOAuthCallback(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    if (!req.url) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_request' }));
      return;
    }

    const url = new URL(req.url, MCP_BASE_URL);
    const supabaseCode = url.searchParams.get('code');

    // Read mcp_request_id from cookie (set in handleAuthorizeApproved)
    // Fallback to query param for backwards compatibility
    let mcpRequestId = url.searchParams.get('mcp_request_id');
    if (!mcpRequestId) {
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(/mcp_request_id=([^;]+)/);
      if (match) mcpRequestId = decodeURIComponent(match[1]);
    }

    if (!supabaseCode || !mcpRequestId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'invalid_request',
        error_description: 'Missing code or mcp_request_id. Authentication session may have expired.',
      }));
      return;
    }

    // Clear the mcp_request_id cookie
    res.setHeader('Set-Cookie', 'mcp_request_id=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');

    // 1. Retrieve Supabase PKCE code_verifier from Redis
    const redis = getRedisClient();
    let codeVerifier: string | null = null;

    if (redis?.status === 'ready') {
      try {
        codeVerifier = await redis.get(`oauth:supabase_verifier:${mcpRequestId}`);
        if (codeVerifier) {
          await redis.del(`oauth:supabase_verifier:${mcpRequestId}`); // One-time use
        }
      } catch (err) {
        console.error('[OAuth] Failed to retrieve Supabase code_verifier from Redis:', err);
      }
    }
    // In-memory fallback
    if (!codeVerifier) {
      const fallback = authRequests.get(`__sb_verifier:${mcpRequestId}`);
      if (fallback) {
        codeVerifier = fallback.state; // We stored verifier in the state field
        authRequests.delete(`__sb_verifier:${mcpRequestId}`);
      }
    }

    if (!codeVerifier) {
      console.error('[OAuth] Supabase code_verifier not found for request:', mcpRequestId);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'invalid_request',
        error_description: 'Authentication session expired. Please restart the connection.',
      }));
      return;
    }

    // 2. Exchange Supabase code for user session using PKCE
    // GoTrue endpoint: POST /auth/v1/token?grant_type=pkce
    const supabaseInternalUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://kong:8000';
    const tokenResponse = await fetch(`${supabaseInternalUrl}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        auth_code: supabaseCode,
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text().catch(() => 'Unknown error');
      console.error('[OAuth] Supabase PKCE exchange failed:', tokenResponse.status, errBody);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'access_denied',
        error_description: 'Authentication failed. Please try again.',
      }));
      return;
    }

    const sessionData = await tokenResponse.json() as { user?: { id?: string; email?: string } };
    const userId = sessionData.user?.id;
    const email = sessionData.user?.email || '';

    if (!userId) {
      console.error('[OAuth] Supabase returned no user in token response');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'access_denied',
        error_description: 'Authentication failed. No user returned.',
      }));
      return;
    }

    // 3. Retrieve original MCP auth request from Redis
    // (reuse redis client from step 1)
    let authRequest: {
      client_id: string;
      redirect_uri: string;
      state: string;
      code_challenge: string;
      code_challenge_method: string;
      scopes?: string[];
      created_at: number;
    } | null = null;

    if (redis?.status === 'ready') {
      try {
        const raw = await redis.get(`oauth:auth_request:${mcpRequestId}`);
        if (raw) authRequest = JSON.parse(raw);
      } catch (err) {
        console.error('[OAuth] Failed to retrieve auth request from Redis:', err);
      }
    }
    if (!authRequest && authRequests.has(mcpRequestId)) {
      authRequest = authRequests.get(mcpRequestId)!;
    }

    if (!authRequest) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'invalid_request',
        error_description: 'Authorization request not found or expired. Please restart the connection.',
      }));
      return;
    }

    // 3. Generate MCP authorization code
    const code = randomBytes(32).toString('hex');
    const codeData = {
      request_id: mcpRequestId,
      user_id: userId,
      email,
      scopes: authRequest.scopes,
      created_at: Date.now(),
    };

    if (redis?.status === 'ready') {
      try {
        await redis.setex(`oauth:code:${code}`, 600, JSON.stringify(codeData));
      } catch (err) {
        console.error('[OAuth] Failed to store code in Redis:', err);
        evictIfFull(authorizationCodes);
        authorizationCodes.set(code, codeData);
      }
    } else {
      evictIfFull(authorizationCodes);
      authorizationCodes.set(code, codeData);
    }

    console.info(`[OAuth] Upstream auth completed for ${email}, redirecting to client`);

    // 4. Redirect to MCP client's callback URL
    const redirectUrl = new URL(authRequest.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (authRequest.state) {
      redirectUrl.searchParams.set('state', authRequest.state);
    }

    res.writeHead(302, { Location: redirectUrl.toString() });
    res.end();
  } catch (error) {
    console.error('[OAuth] Callback error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'server_error',
      error_description: 'Internal server error during authentication callback.',
    }));
  }
}

// ─── Dynamic Client Registration (RFC 7591) ──────────────────────────────

/**
 * POST /register — Dynamic Client Registration
 * Allows MCP clients (like Claude.ai) to self-register as OAuth clients.
 *
 * Per RFC 7591: accepts client metadata, returns client_id.
 * Only public clients (token_endpoint_auth_method: "none") are supported.
 */
export async function handleRegister(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const body = await parseApproveBody(req); // reuse JSON parser

    const { client_name, redirect_uris, token_endpoint_auth_method } = body;

    // Validate required fields
    if (!client_name || typeof client_name !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'invalid_client_metadata',
        error_description: 'client_name is required',
      }));
      return;
    }

    if (client_name.length > 200) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'invalid_client_metadata',
        error_description: 'client_name must be 200 characters or less',
      }));
      return;
    }

    if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'invalid_redirect_uri',
        error_description: 'redirect_uris must be a non-empty array',
      }));
      return;
    }

    // Validate each redirect URI (HTTPS or localhost only)
    for (const uri of redirect_uris) {
      if (typeof uri !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'invalid_redirect_uri',
          error_description: 'Each redirect_uri must be a string',
        }));
        return;
      }
      try {
        const parsed = new URL(uri);
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        if (parsed.protocol !== 'https:' && !isLocalhost) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'invalid_redirect_uri',
            error_description: `redirect_uri must use HTTPS (or localhost): ${uri}`,
          }));
          return;
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'invalid_redirect_uri',
          error_description: `Invalid URL: ${uri}`,
        }));
        return;
      }
    }

    // Only public clients supported (no client_secret)
    if (token_endpoint_auth_method && token_endpoint_auth_method !== 'none') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'invalid_client_metadata',
        error_description: 'Only token_endpoint_auth_method "none" is supported (public clients)',
      }));
      return;
    }

    // Register the client
    const redis = getRedisClient();
    const { client_id, config, issued_at } = await registerDynamicClient(
      client_name,
      redirect_uris,
      redis,
    );

    // Return RFC 7591 response
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      client_id,
      client_name: config.name,
      redirect_uris: config.redirect_uris,
      grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
      response_types: body.response_types || ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: issued_at,
      client_secret_expires_at: 0,
    }));
  } catch (error) {
    console.error('[OAuth] Registration error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'server_error',
      error_description: 'Internal server error during client registration',
    }));
  }
}
