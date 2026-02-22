import { IncomingMessage, ServerResponse } from 'node:http';

const MCP_BASE_URL = process.env.MCP_BASE_URL || 'http://localhost:8002';

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
  // TODO: Implement in next feature
  res.writeHead(501, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not implemented yet' }));
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
