import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { getRedisClient } from '../lib/redis.js';

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8002';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

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

// Clean up old auth requests every 5 minutes (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authRequests.entries()) {
    if (now - value.created_at > 10 * 60 * 1000) {
      authRequests.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * OAuth 2.1 Authorization Server Metadata
 * RFC 8414: OAuth 2.0 Authorization Server Metadata
 */
export function handleAuthorizationServerMetadata(
  req: IncomingMessage,
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
  req: IncomingMessage,
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
export function handleToken(
  req: IncomingMessage,
  res: ServerResponse
): void {
  // TODO: Implement in next feature
  res.writeHead(501, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not implemented yet' }));
}

/**
 * OAuth 2.1 Token Revocation Endpoint
 * POST /oauth/revoke { token }
 */
export function handleRevoke(
  req: IncomingMessage,
  res: ServerResponse
): void {
  // TODO: Implement in next feature
  res.writeHead(501, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not implemented yet' }));
}
