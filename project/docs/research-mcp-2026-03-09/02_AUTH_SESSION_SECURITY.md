# MCP Server Auth & Session Security Research

**Date**: 2026-03-09
**Scope**: OAuth 2.1, PKCE, session management, transport security, database access defense-in-depth
**Target**: `mcp-server/` (TypeScript, Node.js, StreamableHTTP transport)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [OAuth 2.1 Best Practices vs Current Implementation](#2-oauth-21-best-practices-vs-current-implementation)
3. [PKCE Implementation Analysis](#3-pkce-implementation-analysis)
4. [MCP-Specific Auth Requirements (Draft Spec)](#4-mcp-specific-auth-requirements-draft-spec)
5. [Token Lifecycle Management](#5-token-lifecycle-management)
6. [Session Management Security](#6-session-management-security)
7. [Transport Security (StreamableHTTP)](#7-transport-security-streamablehttp)
8. [Rate Limiting & Abuse Prevention](#8-rate-limiting--abuse-prevention)
9. [Database Access Defense-in-Depth](#9-database-access-defense-in-depth)
10. [Priority-Ordered Action Items](#10-priority-ordered-action-items)

---

## 1. Executive Summary

Our MCP server (`mcp-server/src/`) implements OAuth 2.1 with PKCE over StreamableHTTP transport for an e-commerce store handling real user data (orders, payments, profiles). After analyzing the codebase against the official MCP authorization specification (draft), IETF RFCs, and OWASP guidelines, we identified **8 critical issues** and **12 improvements** across authentication, session management, transport security, and database access patterns.

### Critical Findings

| # | Finding | Severity | File |
|---|---------|----------|------|
| 1 | 24-hour access tokens with NO refresh tokens | CRITICAL | `auth/oauth-provider.ts:452` |
| 2 | Token revocation race condition (Redis vs in-memory) | HIGH | `auth/oauth-provider.ts:593-608`, `auth/session.ts:33-55` |
| 3 | No centralized auth middleware (each tool checks individually) | HIGH | `tools/*.ts` |
| 4 | Auto-approve backdoor for test users (NODE_ENV check bypassable) | HIGH | `auth/oauth-provider.ts:203-239` |
| 5 | X-Forwarded-For trusted without proxy validation | HIGH | `middleware/rate-limit.ts:54-66` |
| 6 | Service key used for ALL database operations (RLS bypassed) | HIGH | `lib/supabase.ts:17` |
| 7 | Missing `resource` parameter validation (RFC 8707) | MEDIUM | `auth/oauth-provider.ts` |
| 8 | No Protected Resource Metadata in 401 responses (RFC 9728) | MEDIUM | `auth/session.ts`, `index.ts` |

---

## 2. OAuth 2.1 Best Practices vs Current Implementation

### 2.1 Access Token Lifetime

**Standard (IETF draft-ietf-oauth-v2-1-13 Section 7.1)**:
> Authorization servers SHOULD issue short-lived access tokens to reduce the impact of leaked tokens.

**Industry consensus (2025-2026)**:
- Sensitive APIs (payments, PII): **5-15 minutes**
- General-purpose APIs: **15-30 minutes**
- Maximum recommended: **60 minutes**

**Our current implementation** (`auth/oauth-provider.ts:452`):
```typescript
.setExpirationTime('24h')  // 86400 seconds
```

**Gap**: Our tokens live **96x longer** than the recommended maximum. A leaked token grants 24 hours of access to user orders, profile, cart, and checkout creation (Stripe sessions).

**Recommendation**:
```typescript
// Access token: 15 minutes for e-commerce with payment data
.setExpirationTime('15m')

// Pair with refresh tokens (see Section 5)
```

### 2.2 Grant Types

**Standard**: OAuth 2.1 requires Authorization Code + PKCE. Implicit grant and ROPC are removed.

**Our implementation**: Correct. Only `authorization_code` grant type is supported.

```typescript
// oauth-provider.ts:77
grant_types_supported: ['authorization_code'],
```

### 2.3 Client Authentication

**Standard**: Public clients (SPAs, mobile apps, CLI tools like Claude/ChatGPT) use `token_endpoint_auth_method: "none"` with PKCE as the primary security mechanism.

**Our implementation**: Correct for public clients.

```typescript
// oauth-provider.ts:79
token_endpoint_auth_methods_supported: ['none'],
```

**Note**: If we add confidential clients (server-to-server), we should add `client_secret_post` or `private_key_jwt`.

### 2.4 Scopes

**Our implementation** (`oauth-provider.ts:97`):
```typescript
scopes_supported: ['read', 'write'],
```

**Gap**: These scopes are too coarse for an e-commerce MCP server. The MCP spec recommends scopes that map to tool capabilities.

**Recommendation**: Adopt fine-grained scopes aligned with tool groups:
```typescript
scopes_supported: [
  'catalog:read',      // search_products, get_product_details, list_categories, get_product_reviews
  'store:read',        // get_store_info, get_store_policies
  'profile:read',      // get_my_profile
  'profile:write',     // update_my_profile
  'orders:read',       // list_my_orders, get_order_status, track_shipment
  'cart:read',         // get_cart
  'cart:write',        // update_cart
  'checkout:create',   // create_checkout
  'wishlist:read',     // list_wishlist
  'wishlist:write',    // add_to_wishlist, remove_from_wishlist
]
```

---

## 3. PKCE Implementation Analysis

### 3.1 Current State

Our PKCE implementation is **correct and compliant** with OAuth 2.1:

1. S256 method enforced (`oauth-provider.ts:164-173`)
2. code_challenge required on authorization (`oauth-provider.ts:152-162`)
3. code_verifier validated on token exchange (`oauth-provider.ts:431-442`)
4. S256 verification uses SHA-256 + base64url (`oauth-provider.ts:525-535`)

### 3.2 MCP Spec Requirements (Draft)

From the official MCP authorization spec:

> MCP clients MUST implement PKCE according to OAuth 2.1 Section 7.5.2 and MUST verify PKCE support before proceeding with authorization. MCP clients MUST use the S256 code challenge method when technically capable.

> If `code_challenge_methods_supported` is absent, the authorization server does not support PKCE and MCP clients MUST refuse to proceed.

**Our compliance**: We correctly advertise `code_challenge_methods_supported: ['S256']` in the authorization server metadata endpoint.

### 3.3 Minor Improvement

The PKCE verifier regex validation is missing. RFC 7636 specifies the code_verifier MUST be between 43-128 characters using `[A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"`.

```typescript
// Recommended: Add validation before PKCE verification
function validateCodeVerifier(verifier: string): boolean {
  return /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier);
}
```

---

## 4. MCP-Specific Auth Requirements (Draft Spec)

### 4.1 Protected Resource Metadata (RFC 9728) -- MANDATORY

The MCP spec (draft, 2025-11-25) says:

> MCP servers MUST implement OAuth 2.0 Protected Resource Metadata (RFC 9728). MCP servers MUST implement one of the following discovery mechanisms: WWW-Authenticate Header or Well-Known URI.

**Our implementation**: We serve the well-known URI correctly at `/.well-known/oauth-protected-resource`.

**Gap**: We do NOT include `resource_metadata` in 401 responses (WWW-Authenticate header).

**Current behavior** (implicit in `auth/session.ts`): When auth fails, `validateJwt` returns `null` and the tool handler returns a plain error message. No HTTP 401 with WWW-Authenticate is sent at the transport level.

**Fix required**: When a tool requires auth and none is provided, the MCP server should return:
```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource",
                         scope="profile:read"
```

### 4.2 Resource Indicators (RFC 8707) -- MANDATORY

> MCP clients MUST implement Resource Indicators (RFC 8707). The `resource` parameter MUST be included in both authorization requests and token requests.

**Our implementation**: We do NOT validate or require the `resource` parameter in either the authorization endpoint or the token endpoint.

**Fix required** (`oauth-provider.ts`):
```typescript
// In handleAuthorize:
const resource = params.get('resource');
// Store resource with auth request for validation at token exchange

// In handleToken:
// Validate that resource matches MCP_BASE_URL
// Include audience in JWT bound to the resource
```

### 4.3 Client ID Metadata Documents -- SHOULD

The November 2025 MCP spec update introduced Client ID Metadata Documents (CIMD) as the preferred client registration approach:

> Authorization servers SHOULD support OAuth Client ID Metadata Documents. The client uses HTTPS URLs as client identifiers, where the URL points to a JSON document containing client metadata.

**Our implementation**: We accept any `client_id` string without validation. We do not fetch or validate CIMD documents.

**Recommendation**: For now, accept any client_id (we are an open store). In the future, implement CIMD validation to display client information during the consent screen and validate redirect_uri against the metadata document.

### 4.4 Authorization Server Metadata Discovery

**Our implementation**: Correct. We serve `/.well-known/oauth-authorization-server` with proper metadata.

**Gap**: We should also support OpenID Connect Discovery at `/.well-known/openid-configuration` for interoperability, as the MCP spec requires clients to support both.

### 4.5 Token Audience Validation

From the MCP spec:

> MCP servers MUST validate that access tokens were issued specifically for them as the intended audience. MCP servers MUST only accept tokens specifically intended for themselves.

**Our implementation** (`auth/session.ts:28`):
```typescript
const { payload } = await jwtVerify(token, MCP_JWT_SECRET, {
  issuer: MCP_BASE_URL,
});
```

**Gap**: We validate `issuer` but NOT `audience`. The JWT is created with `audience: 'mcp-client'` (incorrect -- should be the resource server URL per RFC 8707).

**Fix**:
```typescript
// When creating the JWT (oauth-provider.ts):
.setAudience(MCP_BASE_URL)  // Not 'mcp-client'

// When validating (session.ts):
const { payload } = await jwtVerify(token, MCP_JWT_SECRET, {
  issuer: MCP_BASE_URL,
  audience: MCP_BASE_URL,
});
```

---

## 5. Token Lifecycle Management

### 5.1 Refresh Token Rotation

**Standard** (OAuth 2.1 Section 4.3.1):
> For public clients, authorization servers MUST rotate refresh tokens.

**Our implementation**: We issue NO refresh tokens at all (`oauth-provider.ts:458-464`):
```typescript
res.end(JSON.stringify({
  access_token: accessToken,
  token_type: 'bearer',
  expires_in: 86400, // No refresh_token field
}));
```

**Impact**: With 24h tokens and no refresh, users must re-authenticate every 24 hours. If we reduce token lifetime to 15 minutes (recommended), we MUST implement refresh tokens or the UX becomes unusable.

**Recommended implementation**:

```typescript
// Generate refresh token (opaque, stored in Redis)
const refreshToken = randomBytes(32).toString('hex');
const refreshTokenTTL = 7 * 24 * 3600; // 7 days

// Store in Redis with user binding
await redis.setex(`oauth:refresh:${refreshToken}`, refreshTokenTTL, JSON.stringify({
  user_id: codeData.user_id,
  email: codeData.email,
  client_id: authRequest.client_id,
  created_at: Date.now(),
  family_id: randomBytes(16).toString('hex'), // For rotation detection
}));

// Return both tokens
res.end(JSON.stringify({
  access_token: accessToken,
  token_type: 'bearer',
  expires_in: 900, // 15 minutes
  refresh_token: refreshToken,
}));
```

**Refresh token rotation** (add `grant_type: 'refresh_token'` support):
```typescript
// When refresh token is used:
// 1. Validate refresh token exists in Redis
// 2. Delete old refresh token (one-time use)
// 3. Issue new access token + new refresh token
// 4. If old refresh token already used (replay detection):
//    - Revoke entire token family
//    - Log security event
```

### 5.2 Token Revocation (RFC 7009)

**Our implementation**: Partially correct. We implement the revocation endpoint and return 200 for all requests (per RFC 7009).

**Race condition identified** (`auth/oauth-provider.ts:592-609` + `auth/session.ts:33-55`):

```
Timeline of a race condition:
1. Token revoked -> stored in Redis
2. Redis connection drops
3. Token validation checks Redis -> fails -> falls back to in-memory
4. In-memory map does NOT have the revoked token (it was stored in Redis before the drop)
5. Token is accepted as valid despite being revoked
```

**Fix**: When revoking a token, ALWAYS write to BOTH Redis AND in-memory simultaneously, not just one:

```typescript
// In handleRevoke:
// Always write to in-memory as the authoritative fallback
const expiresAt = exp || Math.floor(Date.now() / 1000) + ttl;
revokedTokens.set(token, { revoked_at: Math.floor(Date.now() / 1000), expires_at: expiresAt });

// Also write to Redis if available (for multi-instance deployments)
if (redis?.status === 'ready') {
  await redis.setex(`oauth:revoked:${token}`, ttl, '1').catch(err => {
    console.error('[OAuth] Redis revoke write failed (in-memory still authoritative):', err);
  });
}
```

And in validation (`session.ts`), check BOTH sources:

```typescript
// Check in-memory FIRST (always available, authoritative)
if (revokedTokens.has(token)) {
  return null;
}

// Then check Redis (for tokens revoked by other instances)
if (redis?.status === 'ready') {
  const revoked = await redis.get(`oauth:revoked:${token}`);
  if (revoked) {
    // Sync to in-memory for future checks
    revokedTokens.set(token, { revoked_at: Date.now() / 1000, expires_at: payload.exp || 0 });
    return null;
  }
}
```

### 5.3 Token Storage Security

**Guidance** (OAuth 2.1 Section 7.1):
> Clients and servers MUST implement secure token storage.

For our MCP server (server-side), tokens are validated per-request from the Authorization header -- no persistent storage of access tokens. This is correct.

For revocation blacklisting, we use Redis + in-memory. This is acceptable for a single-instance deployment but needs Redis-only for multi-instance.

---

## 6. Session Management Security

### 6.1 MCP Session vs OAuth Session

Our server manages two distinct session types:

1. **MCP Transport Session** (`session.ts`): Tracks the StreamableHTTP `Mcp-Session-Id` -- a protocol-level session linking JSON-RPC requests.
2. **OAuth Session**: The JWT access token lifetime -- an authentication session.

These are correctly separated. The MCP session (1 hour TTL) is shorter than the OAuth token (24 hours), which is reasonable for connection management.

### 6.2 Session Fixation Prevention

**OWASP Recommendation**: Regenerate session IDs after authentication changes.

**Our implementation**: MCP session IDs are generated with `randomUUID()` at initialization time and are never reused. Since MCP sessions are created fresh per connection (not transferred between auth states), session fixation is not directly applicable. This is correct.

### 6.3 Session ID Security

**Current** (`index.ts:748`):
```typescript
sessionIdGenerator: () => randomUUID(),
```

UUID v4 provides 122 bits of randomness from `crypto.randomUUID()`, which is sufficient. The MCP spec states session IDs must contain "only visible ASCII characters," which UUIDs satisfy.

### 6.4 Concurrent Session Limits

**Gap**: We have no limit on concurrent MCP sessions per user. A single authenticated user could open unlimited sessions, each consuming memory for the transport + McpServer pair.

**Recommendation**: Track sessions per user and enforce a limit:

```typescript
const MAX_SESSIONS_PER_USER = 5;

// In handleMcpPost, before creating new transport:
const userId = (req as any).auth?.extra?.userId;
if (userId) {
  const userSessionCount = await countUserSessions(userId);
  if (userSessionCount >= MAX_SESSIONS_PER_USER) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Too many active sessions' },
      id: null,
    }));
    return;
  }
}
```

### 6.5 Session-Token Binding

**Gap**: MCP sessions are not bound to the OAuth token that created them. A user could:
1. Create a session with token A
2. Token A gets revoked
3. Continue using the MCP session (no re-validation of the token occurs on subsequent requests within the same session)

**Recommendation**: Store the token's `jti` (JWT ID) or hash with the session metadata. On each request, validate that the token used matches the session's bound token. If the token is revoked, invalidate the session.

### 6.6 Idle Timeout

**Current**: Sessions have a 1-hour TTL that resets on each activity (`session.ts:48-67`).

**Gap**: There is no absolute maximum session lifetime. A session kept alive with periodic pings could live indefinitely.

**Recommendation**: Add an absolute timeout (e.g., 8 hours) in addition to the idle timeout:

```typescript
const SESSION_IDLE_TTL = 3600;     // 1 hour
const SESSION_ABSOLUTE_TTL = 28800; // 8 hours

// In updateSessionActivity:
const created = new Date(metadata.created_at).getTime();
const now = Date.now();
if (now - created > SESSION_ABSOLUTE_TTL * 1000) {
  // Session exceeded absolute lifetime -- force close
  await deleteSession(sessionId);
  return;
}
```

---

## 7. Transport Security (StreamableHTTP)

### 7.1 CORS Configuration

**Current** (`index.ts:124-126`):
```typescript
const MCP_CORS_ORIGINS = (process.env.MCP_CORS_ORIGINS ||
  'https://claude.ai,https://chatgpt.com,http://localhost:3000')
  .split(',').map((s) => s.trim());
```

**Analysis**: The default includes production origins (claude.ai, chatgpt.com) and dev origin (localhost:3000). This is a reasonable default.

**Gap 1**: Missing `Vary: Origin` header to prevent CDN cache poisoning:
```typescript
res.setHeader('Vary', 'Origin');
```

**Gap 2**: Missing `Access-Control-Expose-Headers` for `Mcp-Session-Id`:
```typescript
res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
```

Without this, browser-based MCP clients cannot read the session ID from response headers.

**Gap 3**: No origin validation for non-browser clients. Requests without an Origin header (curl, server-to-server) bypass CORS entirely. This is by design (CORS is a browser security mechanism), but we should log requests without Origin for monitoring.

### 7.2 Security Headers

**Missing** from all responses:
```typescript
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('Cache-Control', 'no-store');  // Prevent caching of API responses
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
```

### 7.3 Request Size Limits

**Current** (`index.ts:618`):
```typescript
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB
```

**Analysis**: 1MB is reasonable for MCP JSON-RPC requests. The token endpoint has a separate 16KB limit (`oauth-provider.ts:484`), which is also appropriate.

### 7.4 DNS Rebinding Prevention

**MCP Spec Guidance**: Validate the Origin header on all incoming requests.

**Current**: We check Origin against allowed list for CORS headers but do NOT reject requests with invalid origins.

**Recommendation for production**: Consider rejecting requests with unexpected Origin headers (not just skipping CORS headers):

```typescript
if (origin && !MCP_CORS_ORIGINS.includes(origin)) {
  // Log suspicious request
  logger.warn('Request from unauthorized origin', { origin, ip: getClientIp(req) });
  // Optionally reject in strict mode
  if (process.env.STRICT_ORIGIN_CHECK === 'true') {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Origin not allowed' }));
    return;
  }
}
```

---

## 8. Rate Limiting & Abuse Prevention

### 8.1 Current Rate Limiting

**Implementation** (`middleware/rate-limit.ts`):
- Global: 60 req/min unauthenticated, 120 req/min authenticated
- Per-tool: `create_checkout`: 5/min, `search_products`: 60/min, `update_cart`: 30/min
- Storage: Redis sorted set with in-memory fallback
- Algorithm: Sliding window

**Analysis**: The implementation is solid. The sliding window algorithm with Redis sorted sets is a production-grade approach.

### 8.2 X-Forwarded-For Trust Issue

**Current** (`middleware/rate-limit.ts:54-66`):
```typescript
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return ips[0].trim();  // Trusts first IP unconditionally
  }
  // ...
}
```

**Problem**: An attacker can spoof `X-Forwarded-For: 1.2.3.4` to bypass rate limiting. Each request appears to come from a different IP.

**OWASP Guidance**: Only trust `X-Forwarded-For` when the request comes through a known reverse proxy. The leftmost IP is the one inserted by the attacker; the rightmost IP before your proxy is the actual client.

**Fix**:
```typescript
const TRUSTED_PROXIES = (process.env.TRUSTED_PROXY_IPS || '127.0.0.1,::1').split(',').map(s => s.trim());

function getClientIp(req: IncomingMessage): string {
  const remoteAddress = req.socket.remoteAddress || 'unknown';

  // Only trust X-Forwarded-For if request comes from a trusted proxy
  if (!TRUSTED_PROXIES.includes(remoteAddress)) {
    return remoteAddress;
  }

  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded.split(',') : forwarded)
      .map(ip => ip.trim());
    // Walk from the right, skip trusted proxies, return the first untrusted IP
    for (let i = ips.length - 1; i >= 0; i--) {
      if (!TRUSTED_PROXIES.includes(ips[i])) {
        return ips[i];
      }
    }
  }

  return remoteAddress;
}
```

### 8.3 Fail-Open Policy

**Current** (`middleware/rate-limit.ts:243-247`):
```typescript
} catch (error) {
  console.error('[RateLimit] Error checking rate limit:', error);
  // On error, allow request (fail open)
  return true;
}
```

**Analysis**: Fail-open is a pragmatic choice for availability. However, for the checkout tool (`create_checkout`), consider fail-closed to prevent abuse when Redis is down.

### 8.4 Missing: OAuth Endpoint Rate Limiting

The OAuth endpoints (`/oauth/authorize`, `/oauth/token`, `/oauth/revoke`) are NOT rate-limited. An attacker could:
- Brute-force authorization codes at `/oauth/token`
- Flood `/oauth/authorize` with requests
- DoS the revocation endpoint

**Recommendation**: Apply stricter rate limits to OAuth endpoints:
```typescript
// 10 token requests per minute per IP
// 20 authorize requests per minute per IP
// 30 revoke requests per minute per IP
```

---

## 9. Database Access Defense-in-Depth

### 9.1 Current Pattern: Service Key Everywhere

**Current** (`lib/supabase.ts:17`):
```typescript
supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  // Service key = bypasses ALL RLS policies
});
```

Every tool (public and authenticated) queries the database using the service key, which has `BYPASSRLS` privileges. This means:
- RLS policies on the `users`, `orders`, `cart_items`, `wishlists` tables are NOT enforced
- Authorization is entirely application-level (checking `userId` in tool handlers)
- A bug in any tool handler could leak data across users

**Supabase Documentation**:
> The service_role key uses the BYPASSRLS attribute, skipping any and all Row Level Security policies. Unlike the anon key, the service_role key allows elevated access and is meant to be used only in secure, developer-controlled components.

### 9.2 Recommended: Per-Request User Client

For authenticated tool calls, create a per-request Supabase client that uses the user's JWT, enforcing RLS as a defense-in-depth layer:

```typescript
import { createClient } from '@supabase/supabase-js';

// For public tools (no auth needed, read-only catalog data)
export function getAnonClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// For authenticated tools (user-scoped data)
export function getUserClient(userJwt: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
  });
}

// For admin operations only (cron, webhooks, system tasks)
export function getAdminClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey);
}
```

**Challenge**: Our MCP server issues its own JWTs (not Supabase JWTs). To use per-request user clients with RLS, we would need to either:

1. **Exchange MCP JWT for Supabase JWT** using a server-side token exchange
2. **Use Supabase service key with manual `.eq('user_id', userId)` filtering** (current approach, acceptable with strong application-level checks)
3. **Use Supabase's `auth.uid()` function** by creating Supabase-compatible JWTs with the same signing secret

**Pragmatic recommendation for now**: Keep the service key client but add a helper that enforces user scoping:

```typescript
function scopedQuery(table: string, userId: string) {
  const supabase = getSupabaseClient();
  return supabase.from(table).select().eq('user_id', userId);
}
```

And ensure RLS is enabled on ALL tables as a fallback safety net even though the service key bypasses it -- this protects against accidental exposure through other clients (frontend, admin).

### 9.3 Data Access Audit Trail

**Current**: The `withAuditLog` wrapper in `lib/audit-log.ts` logs tool invocations.

**Gap**: It does not log which user accessed which data rows. For PII compliance (GDPR), consider logging:
- User ID
- Table accessed
- Row IDs returned
- Operation type (read/write)

---

## 10. Priority-Ordered Action Items

### P0 -- Critical (Do Before Production)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 1 | **Reduce access token lifetime to 15 minutes** and implement refresh token rotation | Medium | Prevents 24h window for stolen token abuse |
| 2 | **Fix token revocation race condition** -- write to both Redis AND in-memory on revoke, check both on validate | Low | Eliminates revocation bypass when Redis drops |
| 3 | **Remove auto-approve backdoor** or restrict to explicitly allowlisted test environments (not just `NODE_ENV !== 'production'`) | Low | Prevents auth bypass if NODE_ENV misconfigured |
| 4 | **Fix X-Forwarded-For trust** -- only trust when request comes from known proxy IP | Low | Prevents rate limit bypass via header spoofing |
| 5 | **Add rate limiting to OAuth endpoints** (`/oauth/token`, `/oauth/authorize`) | Low | Prevents brute-force attacks on auth codes |

### P1 -- High (First Sprint After Launch)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 6 | **Add `resource` parameter validation** (RFC 8707) in authorize and token endpoints | Medium | Prevents token audience confusion / confused deputy |
| 7 | **Fix JWT audience claim** -- set to `MCP_BASE_URL` instead of `'mcp-client'` and validate on every request | Low | Aligns with MCP spec, prevents cross-service token reuse |
| 8 | **Add `WWW-Authenticate` header** to 401 responses with `resource_metadata` URL | Low | MCP spec compliance for client discovery |
| 9 | **Add concurrent session limits** per user (max 5) | Low | Prevents resource exhaustion |
| 10 | **Add security headers** (`X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control: no-store`, `HSTS`) | Low | Defense-in-depth against various attack vectors |
| 11 | **Add `Vary: Origin` and `Access-Control-Expose-Headers: Mcp-Session-Id`** to CORS | Low | Prevents CDN cache poisoning, enables browser MCP clients |

### P2 -- Medium (Within 30 Days)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 12 | **Implement fine-grained scopes** (`catalog:read`, `profile:read`, `orders:read`, etc.) | Medium | Principle of least privilege for MCP clients |
| 13 | **Add absolute session timeout** (8 hours max regardless of activity) | Low | Limits long-lived session exploitation |
| 14 | **Bind MCP sessions to auth tokens** -- invalidate session when token is revoked | Medium | Prevents continued access after revocation |
| 15 | **Add PKCE code_verifier format validation** (43-128 chars, allowed charset) | Low | Defense-in-depth for PKCE |
| 16 | **Add OpenID Connect Discovery endpoint** (`/.well-known/openid-configuration`) | Low | MCP spec interoperability |
| 17 | **Add origin rejection in strict mode** for production | Low | DNS rebinding prevention |

### P3 -- Low (Backlog)

| # | Action | Effort | Impact |
|---|--------|--------|--------|
| 18 | Implement Client ID Metadata Documents (CIMD) validation | High | Better client identification during consent |
| 19 | Add per-request Supabase user client with RLS enforcement | High | Database-level defense-in-depth |
| 20 | Add step-up authorization flow (403 + insufficient_scope) | Medium | Incremental scope requests per MCP spec |

---

## Sources

### Official Specifications
- [MCP Authorization Specification (Draft)](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [OAuth 2.1 IETF Draft (draft-ietf-oauth-v2-1-13)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13)
- [RFC 8707 - Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707.html)
- [RFC 9728 - OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728)
- [RFC 7009 - OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)
- [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)

### MCP-Specific Analysis
- [MCP, OAuth 2.1, PKCE, and the Future of AI Authorization (Aembit)](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/)
- [Is that allowed? Authentication and authorization in MCP (Stack Overflow Blog)](https://stackoverflow.blog/2026/01/21/is-that-allowed-authentication-and-authorization-in-model-context-protocol/)
- [What's New In The 2025-11-25 MCP Authorization Spec (Den Delimarsky)](https://den.dev/blog/mcp-november-authorization-spec/)
- [MCP Spec Updates from June 2025 (Auth0)](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
- [Client Registration and Enterprise Management in the November 2025 MCP Authorization Spec (Aaron Parecki)](https://aaronparecki.com/2025/11/25/1/mcp-authorization-spec-update)

### Transport & Implementation
- [CORS Policies for Web-Based MCP Servers (MCPcat)](https://mcpcat.io/guides/implementing-cors-policies-web-based-mcp-servers/)
- [Build StreamableHTTP MCP Servers - Production Guide (MCPcat)](https://mcpcat.io/guides/building-streamablehttp-mcp-server/)
- [Build a Secure MCP Server in TypeScript (Rebecca M. de Prey)](https://rebeccamdeprey.com/blog/secure-mcp-server)
- [Why MCP's Move Away from SSE Simplifies Security (Auth0)](https://auth0.com/blog/mcp-streamable-http/)
- [MCP StreamableHTTP Transport Security Considerations (Yani Dong)](https://medium.com/@yany.dong/mcp-streamable-http-transport-security-considerations-and-guidance-2797cfbc9b19)

### OAuth Best Practices
- [Hardening OAuth Tokens in API Security (Clutch Events)](https://www.clutchevents.co/resources/hardening-oauth-tokens-in-api-security-token-expiry-rotation-and-revocation-best-practices)
- [OAuth 2.1 Features You Can't Ignore in 2026 (Ricardo Gutierrez)](https://rgutierrez2004.medium.com/oauth-2-1-features-you-cant-ignore-in-2026-a15f852cb723)
- [OAuth 2.1 vs 2.0: What's Changing and Why (Descope)](https://www.descope.com/blog/post/oauth-2-0-vs-oauth-2-1)
- [OAuth 2.1 vs 2.0: What developers need to know (Stytch)](https://stytch.com/blog/oauth-2-1-vs-2-0/)
- [Access Token vs Refresh Token: A Practical Breakdown (TheLinuxCode)](https://thelinuxcode.com/access-token-vs-refresh-token-a-practical-breakdown-for-modern-oauth-2026/)
- [Refresh Tokens: What Are They and When to Use Them (Auth0)](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
- [Antipattern: Set a Long Expiration Time for OAuth Tokens (Google Cloud)](https://docs.cloud.google.com/apigee/docs/api-platform/antipatterns/oauth-long-expiration)

### Session Management
- [Best Practices for Secure Session Management in Node (JScrambler)](https://jscrambler.com/blog/best-practices-for-secure-session-management-in-node)
- [Session Management with Redis: Secure & Scalable Guide (Medium)](https://medium.com/@20011002nimeth/session-management-with-redis-a21d43ac7d5a)
- [How to Build a Session Management System with Redis (OneUptime)](https://oneuptime.com/blog/post/2026-01-21-redis-session-management/view)

### Database Security
- [Row Level Security (Supabase Docs)](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing Your API (Supabase Docs)](https://supabase.com/docs/guides/api/securing-your-api)
- [Understanding API Keys (Supabase Docs)](https://supabase.com/docs/guides/api/api-keys)
- [Supabase Security Retro 2025 (SupaExplorer)](https://supaexplorer.com/dev-notes/supabase-security-2025-whats-new-and-how-to-stay-secure.html)
- [How to Secure Your Supabase Service Role Key (Chat2DB)](https://chat2db.ai/resources/blog/secure-supabase-role-key)
