# MCP Server Audit Report: Core, Auth & Security

**Date**: 2026-03-09
**Auditor**: Claude Opus 4.6 (Deep Audit)
**Scope**: `/mcp-server/` -- all core, auth, middleware, lib, prompts, resources, and infrastructure files
**SDK Version**: `@modelcontextprotocol/sdk ^1.0.4`
**Runtime**: Node.js 22, TypeScript 5.7, ESM modules

---

## Executive Summary

The MCP server is a well-structured, purpose-built Model Context Protocol server exposing 17 e-commerce tools (product search, cart, checkout, orders, wishlist) over the StreamableHTTP transport. It implements OAuth 2.1 with PKCE, JWT-based session auth, Redis-backed rate limiting with in-memory fallback, and structured audit logging. The codebase demonstrates strong security awareness overall.

However, the audit uncovered **2 CRITICAL**, **5 HIGH**, **6 MEDIUM**, and **4 LOW** severity findings that require attention before production deployment.

**Key concerns**:
1. The Supabase client uses the **service role key** (RLS bypass) for ALL queries, including user-scoped operations -- a single auth bypass vulnerability could expose the entire database.
2. Hardcoded test user credentials in the OAuth auto-approve flow are inadequately guarded.
3. The rate limiter fails open on Redis errors, allowing burst attacks.
4. Token revocation has a race condition between Redis and in-memory stores on multi-instance deployments.

---

## Architecture Overview

### Transport & Protocol
- **Transport**: `StreamableHTTPServerTransport` (HTTP-based, supports SSE streaming)
- **Protocol Version**: `2024-11-05` (MCP spec)
- **Server Pattern**: One `McpServer` + `StreamableHTTPServerTransport` per session (correct per SDK docs)
- **HTTP Server**: Raw `node:http` (no Express/Fastify framework)
- **Port**: 8002 (configurable via `PORT` env var)

### Routing
```
GET  /health                              -> Liveness check
GET  /ready                               -> Readiness check (Supabase, Redis, Stripe)
GET  /.well-known/oauth-authorization-server -> OAuth metadata
GET  /.well-known/oauth-protected-resource   -> Protected resource metadata
GET  /oauth/authorize                     -> OAuth authorize (renders login form)
POST /oauth/token                         -> OAuth token exchange
POST /oauth/revoke                        -> OAuth token revocation
POST /mcp (or /)                          -> MCP protocol handler
GET  /mcp (or /)                          -> MCP SSE stream (existing session)
DELETE /mcp (or /)                        -> MCP session termination
```

### Tool Inventory (17 tools)
| Tool | Auth | Type | Notes |
|------|------|------|-------|
| search_products | PUBLIC | read | SQL injection protection via `sanitizeForLike` |
| get_product_details | PUBLIC | read | UUID-validated input |
| get_store_info | PUBLIC | read | Static store metadata |
| get_store_policies | PUBLIC | read | Static policies |
| list_categories | PUBLIC | read | Category listing |
| get_product_reviews | PUBLIC | read | Paginated reviews |
| get_my_profile | PROTECTED | read | Auth enforced in handler |
| update_my_profile | PROTECTED | write | Context injection (userId from JWT) |
| list_my_orders | PROTECTED | read | User-scoped |
| get_order_status | PROTECTED | read | Ownership verification |
| track_shipment | PROTECTED | read | Ownership verification |
| get_cart | PROTECTED | read | User-scoped |
| update_cart | PROTECTED | write | Product/variant validation |
| create_checkout | PROTECTED | write | Stripe session creation only |
| list_wishlist | PROTECTED | read | User-scoped |
| add_to_wishlist | PROTECTED | write | |
| remove_from_wishlist | PROTECTED | write | |

### Dependencies
| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| @modelcontextprotocol/sdk | ^1.0.4 | MCP protocol | Low -- actively maintained |
| @supabase/supabase-js | ^2.47.10 | Database client | Low |
| ioredis | ^5.4.2 | Redis client | Low |
| jose | ^5.9.6 | JWT signing/verification | Low -- well-maintained |
| stripe | ^17.5.0 | Payment processing | Low |
| zod | ^3.24.1 | Input validation | Low |

---

## Scorecard

| # | Severity | Category | Finding | File:Line |
|---|----------|----------|---------|-----------|
| 1 | **CRITICAL** | Auth/Data | Supabase service key used for ALL queries -- RLS completely bypassed | `src/lib/supabase.ts:17` |
| 2 | **CRITICAL** | Auth | Hardcoded test user ID in OAuth auto-approve guarded only by `NODE_ENV !== 'production'` | `src/auth/oauth-provider.ts:204-208` |
| 3 | **HIGH** | Auth | Auth enforcement is at tool handler level, not transport/middleware level -- missing auth check could expose data | `src/index.ts:677-678` |
| 4 | **HIGH** | Rate Limiting | Rate limiter fails open on Redis error -- allows unlimited requests during Redis outage | `src/middleware/rate-limit.ts:243-247` |
| 5 | **HIGH** | Auth | Token revocation race condition between Redis and in-memory stores | `src/auth/session.ts:32-55` |
| 6 | **HIGH** | Security | `X-Forwarded-For` header trusted without proxy validation -- IP spoofing possible | `src/middleware/rate-limit.ts:54-59` |
| 7 | **HIGH** | Auth | No refresh token mechanism -- 24h access tokens with no rotation | `src/auth/oauth-provider.ts:452-453` |
| 8 | **MEDIUM** | Security | CORS allows wildcard-like origins without validation of the full origin URL | `src/index.ts:814` |
| 9 | **MEDIUM** | Logging | User IDs logged in session creation -- potential PII in logs | `src/session.ts:38` |
| 10 | **MEDIUM** | Config | JWT secret in start-dev.sh is a weak static string | `start-dev.sh:13` |
| 11 | **MEDIUM** | Docker | `dist/` directory excluded from `.dockerignore` but full `node_modules` copied | `Dockerfile:13` |
| 12 | **MEDIUM** | Session | Session cleanup uses `redis.keys()` -- O(N) scan on Redis | `src/session.ts:113` |
| 13 | **MEDIUM** | Auth | OAuth login form submits credentials to frontend via plain POST -- CSRF risk | `src/auth/oauth-provider.ts:270` |
| 14 | **LOW** | Testing | Coverage thresholds very low (30% lines, 25% branches) | `vitest.config.ts:34-37` |
| 15 | **LOW** | Config | `MCP_JWT_SECRET` env var name differs from `.env.example` which uses `JWT_SECRET` | `.env.example:26` vs `src/auth/oauth-provider.ts:9` |
| 16 | **LOW** | Docs | Policies resource references `podstore.local` and `Printify` instead of actual brand | `src/resources/policies.ts:22,74` |
| 17 | **LOW** | Code | Deprecated `server.resource()` and `server.prompt()` methods used with `@ts-ignore` | `src/index.ts:565-566,597` |

---

## Detailed Findings

### CRITICAL-1: Supabase Service Key Used for ALL Queries (RLS Bypass)

**File**: `src/lib/supabase.ts:17`
**Impact**: Complete database exposure if any tool has an authorization flaw

The `getSupabaseClient()` singleton initializes with `SUPABASE_SERVICE_KEY`, which **bypasses all Row-Level Security policies**. Every tool -- including user-scoped ones like `get_cart`, `get_order_status`, `update_my_profile` -- queries the database through this admin client.

```typescript
// src/lib/supabase.ts:17
supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

This means:
- The `user_id` filtering in tools like `get_cart` (`eq('user_id', userId)`) is the **only** authorization barrier
- If any tool accidentally omits the `user_id` filter, or if the userId extraction has a bug, ALL user data is exposed
- RLS policies on `cart_items`, `orders`, `order_items`, `wishlists` etc. provide zero protection

**Recommendation**: Create a second Supabase client using the anon key + user JWT for user-scoped queries. Use the service key client only for admin operations (e.g., readiness check, catalog queries where RLS is not needed). Alternatively, use `supabase.auth.setSession()` with the user's Supabase token if the OAuth flow can be extended to issue Supabase tokens.

---

### CRITICAL-2: Hardcoded Test User in OAuth Auto-Approve

**File**: `src/auth/oauth-provider.ts:204-208`
**Impact**: Unauthorized access to a real user account in non-production environments

```typescript
const autoApprove = params.get('auto_approve') === 'true';
if (autoApprove && process.env.NODE_ENV !== 'production') {
  const testUserId = '5fae3de5-94e8-469d-a6a6-789fd08868d5';
  const testEmail = 'test@example.com';
```

Issues:
1. The `NODE_ENV` check is the only guard. If `NODE_ENV` is unset (common in Docker), this code is reachable
2. The test user ID `5fae3de5-94e8-469d-a6a6-789fd08868d5` appears to be a real database UUID
3. Any client can add `auto_approve=true` to the authorize URL to get a token for this user
4. The `Dockerfile` does not set `NODE_ENV=production`

**Recommendation**:
1. Add `NODE_ENV=production` to the `Dockerfile` (`ENV NODE_ENV=production`)
2. Gate this behind a separate `MCP_ENABLE_TEST_AUTH=true` env var, not `NODE_ENV`
3. Use a dedicated test user that cannot access real data
4. Consider removing auto-approve entirely and using proper test fixtures

---

### HIGH-3: Auth Enforcement at Tool Level Only

**File**: `src/index.ts:677-678`
**Impact**: A new protected tool added without auth checks would be silently accessible without authentication

Auth injection happens at the transport level:
```typescript
// src/index.ts:678
await injectAuthInfo(req);
```

But this only **sets** `req.auth` -- it does not **enforce** it. Each tool handler must individually check:
```typescript
if (!authInfo || !authInfo.extra?.userId) {
  return { success: false, error: 'Authentication required...' };
}
```

There is no middleware or decorator pattern that automatically rejects unauthenticated requests for tools marked as PROTECTED. If a developer adds a new tool and forgets the auth check, it will be callable without authentication.

**Recommendation**: Implement a tool metadata registry that maps tool names to their auth requirements, and enforce auth at the `handleMcpPost` level before dispatching to tool handlers. Alternatively, use a `requireAuth` wrapper function:
```typescript
function requireAuth<T>(handler: (input: T, authInfo: AuthInfo) => Promise<any>) {
  return (input: T, extra?: { authInfo?: AuthInfo }) => {
    if (!extra?.authInfo?.extra?.userId) {
      return { success: false, error: 'Authentication required' };
    }
    return handler(input, extra.authInfo);
  };
}
```

---

### HIGH-4: Rate Limiter Fails Open on Redis Error

**File**: `src/middleware/rate-limit.ts:243-247`
**Impact**: Unlimited requests during Redis failures

```typescript
} catch (error) {
  console.error('[RateLimit] Error checking rate limit:', error);
  // On error, allow request (fail open)
  return true;
}
```

When a Redis operation fails (connection timeout, command error, etc.), the rate limiter allows the request through without any fallback enforcement. This means:
- A Redis outage eliminates all rate limiting
- An attacker could potentially trigger Redis errors to bypass rate limiting
- The in-memory fallback is only used when `redis.status !== 'ready'`, not on per-request Redis errors

**Recommendation**: On Redis error, fall back to in-memory rate limiting for that specific request. The `rateLimitInMemory` function already exists and should be called in the catch block:
```typescript
} catch (error) {
  console.error('[RateLimit] Redis error, falling back to in-memory:', error);
  return rateLimitInMemory(req, res, toolName);
}
```

---

### HIGH-5: Token Revocation Race Condition

**File**: `src/auth/session.ts:32-55`
**Impact**: Revoked tokens may be accepted on some requests in multi-instance deployments

The revocation check follows this logic:
1. If Redis is ready, check Redis for `oauth:revoked:{token}`
2. If Redis check fails, fall back to in-memory `revokedTokens` Map
3. If Redis is not ready, check in-memory only

Issues:
- In a multi-instance deployment (multiple MCP server processes), each instance has its own `revokedTokens` Map
- A token revoked on instance A is stored in Redis, but if instance B has a Redis error during validation, it checks its local in-memory store -- which is empty
- There is a window between token revocation and Redis propagation where the token is valid
- The `revokedTokens` Map in oauth-provider.ts is shared via module-level export, which only works within a single process

**Recommendation**:
- For single-instance deployment (current plan), this is acceptable but should be documented
- For multi-instance, ensure Redis is the sole source of truth for revocation, and fail-closed (reject token if Redis is unavailable during revocation check)

---

### HIGH-6: X-Forwarded-For Header Trusted Without Validation

**File**: `src/middleware/rate-limit.ts:54-59`
**Impact**: IP-based rate limiting can be bypassed by spoofing headers

```typescript
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return ips[0].trim(); // Takes first IP -- attacker controlled
  }
```

Any client can set `X-Forwarded-For: random-ip` to get a fresh rate limit bucket on every request. Since the MCP server is behind Caddy (per the docker-compose stack), the reverse proxy should strip or override this header, but the MCP server does not validate that the header comes from a trusted proxy.

**Recommendation**:
1. Configure Caddy to set `X-Forwarded-For` authoritatively
2. In the MCP server, take the **last** IP in the `X-Forwarded-For` chain (the one set by Caddy), or better, use a configured list of trusted proxy IPs
3. Alternatively, use `X-Real-IP` set by Caddy (already partially supported at line 61)

---

### HIGH-7: No Refresh Token Mechanism

**File**: `src/auth/oauth-provider.ts:452-453`
**Impact**: Long-lived access tokens increase exposure window

```typescript
.setExpirationTime('24h')
// ...
expires_in: 86400, // 24 hours
```

The token endpoint issues 24-hour access tokens with no refresh token. This means:
- A compromised token is valid for up to 24 hours
- There is no way to silently rotate tokens without user re-authentication
- The revocation mechanism exists but requires explicit action

**Recommendation**: Implement refresh tokens (short-lived access tokens of ~1h + refresh tokens with rotation). The OAuth 2.1 spec supports this via `grant_type=refresh_token`.

---

### MEDIUM-8: CORS Origin Validation

**File**: `src/index.ts:814`
**Impact**: Potentially allows requests from unintended origins

```typescript
if (origin && MCP_CORS_ORIGINS.includes(origin)) {
```

The comparison is exact string match, which is correct. However:
- Default origins include `http://localhost:3000` which is appropriate for development only
- In production, the `MCP_CORS_ORIGINS` env var must be explicitly set
- No validation that the origin URL is well-formed
- If CORS origins are misconfigured (e.g., with a trailing slash), legitimate clients will be blocked silently

**Recommendation**: Add startup validation for CORS origins (valid URLs, no trailing slashes). Log a warning if `http://localhost` origins are present in production.

---

### MEDIUM-9: User IDs in Logs

**File**: `src/session.ts:38`
**Impact**: PII leakage in log output

```typescript
console.info(`[Session] Created: ${sessionId}${userId ? ` (user: ${userId})` : ''}`);
```

User IDs (UUIDs) are logged at the INFO level during session creation. While UUIDs are pseudonymous, they can be correlated with user data and may constitute PII under GDPR.

**Recommendation**: Redact or hash user IDs in logs, or only log them at DEBUG level.

---

### MEDIUM-10: Weak Dev JWT Secret

**File**: `start-dev.sh:13`
**Impact**: Predictable JWT signing key in development

```bash
export MCP_JWT_SECRET="development-secret-key-change-in-production-min-32-chars-required"
```

While this is a development script, the secret is committed to the repository. If someone runs this in a staging/production environment, all JWTs would be forgeable.

**Recommendation**: Generate a random secret at runtime if not provided, or fail hard if the secret matches the default value.

---

### MEDIUM-11: Docker Node Modules

**File**: `Dockerfile:13`
**Impact**: Larger image, potential dev dependency exposure

```dockerfile
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json package-lock.json ./
RUN npm prune --omit=dev
```

The build copies ALL `node_modules` from the builder stage and then prunes dev dependencies. This works but:
1. Increases build time and layer size
2. Temporarily exposes dev dependencies in the production image

Additionally, `NODE_ENV` is not set to `production`, which means:
- The `auto_approve` OAuth bypass is active (CRITICAL-2)
- npm may install dev dependencies if `npm ci` is re-run

**Recommendation**: Add `ENV NODE_ENV=production` before the `COPY` stage. Consider using `npm ci --omit=dev` in a separate install step instead of copying and pruning.

---

### MEDIUM-12: Redis KEYS Command in Session Listing

**File**: `src/session.ts:113`
**Impact**: Performance degradation under load

```typescript
const keys = await redis.keys(SESSION_KEY_PREFIX + '*');
```

`redis.keys()` performs an O(N) scan of the entire keyspace. With many sessions or keys, this blocks Redis. This function (`listActiveSessions`) is not called in the hot path but could be invoked via monitoring.

**Recommendation**: Use `SCAN` command instead of `KEYS` for production use, or use a Redis Set to track active session IDs.

---

### MEDIUM-13: OAuth Login Form CSRF Risk

**File**: `src/auth/oauth-provider.ts:270`
**Impact**: Cross-site request forgery on the OAuth login form

```html
<form action="${FRONTEND_URL}/en/auth/oauth-callback" method="POST">
  <input type="hidden" name="request_id" value="${escapeHtml(requestId)}">
```

The login form POSTs to the frontend's OAuth callback endpoint without a CSRF token. An attacker could:
1. Craft a page that auto-submits the form with known `request_id`
2. The `request_id` is generated server-side and stored, so this is partially mitigated
3. However, the form itself lacks a CSRF token separate from the OAuth state

**Recommendation**: Add a CSRF token to the form, stored in a secure cookie and validated on the callback endpoint.

---

### LOW-14: Very Low Test Coverage Thresholds

**File**: `vitest.config.ts:34-37`

```typescript
thresholds: {
  lines: 30,
  functions: 40,
  branches: 25,
  statements: 30,
},
```

These thresholds are very low and many critical files (all of `src/lib/`, `src/prompts/`, `src/resources/`, `src/index.ts`) are excluded from coverage.

**Recommendation**: Increase thresholds progressively (target 70%+) and include critical auth/security files in coverage.

---

### LOW-15: Environment Variable Naming Inconsistency

**File**: `.env.example:26` vs `src/auth/oauth-provider.ts:9`

The `.env.example` defines `JWT_SECRET` but the code reads `MCP_JWT_SECRET`. The `start-dev.sh` correctly uses `MCP_JWT_SECRET`, but the `.env.example` would mislead production deployments.

**Recommendation**: Update `.env.example` to use `MCP_JWT_SECRET` consistently.

---

### LOW-16: Placeholder Content in Policies Resource

**File**: `src/resources/policies.ts:22,74`

The policies resource contains placeholder content:
- References `Printify` instead of `Printful` (current provider)
- Uses `podstore.local` instead of the actual domain
- Contact email `support@podstore.local` is not real

**Recommendation**: Fetch policies from the database/CMS as the TODO suggests, or update the static content to match the actual brand.

---

### LOW-17: Deprecated SDK Methods

**File**: `src/index.ts:565-566, 597`

```typescript
// @ts-ignore - using deprecated method intentionally
server.resource(...)
// @ts-ignore - using deprecated method intentionally
server.prompt(...)
```

These use deprecated methods from SDK 1.0.4. While they work, they suppress TypeScript type checking and may break in future SDK versions.

**Recommendation**: Migrate to `server.registerResource()` and `server.registerPrompt()` when SDK support stabilizes.

---

## Positive Findings

These aspects of the codebase are well-implemented:

1. **PKCE Enforcement**: OAuth 2.1 PKCE with S256 is properly required and validated (`oauth-provider.ts:152-173, 525-535`)
2. **Input Validation**: Zod schemas on all tool inputs with proper UUID validation, string length limits, and numeric bounds
3. **SQL Injection Protection**: `sanitizeForLike()` in `search-products.ts:38-43` properly escapes PostgreSQL LIKE wildcards
4. **XSS Prevention**: `escapeHtml()` in OAuth form output (`oauth-provider.ts:297-306`)
5. **Body Size Limits**: 1MB for MCP requests, 16KB for OAuth token requests
6. **Audit Logging**: Structured JSON audit logs with sensitive field sanitization (`audit-log.ts:22-53`)
7. **Tool Annotations**: Proper `readOnlyHint`, `destructiveHint`, `idempotentHint` annotations on all tools
8. **IDOR Protection**: Order ownership verification in `get_order_status` and `track_shipment`
9. **Context Injection**: User ID comes from JWT, not from client-supplied parameters (prevents horizontal privilege escalation)
10. **Graceful Degradation**: Redis is optional with in-memory fallback for sessions, rate limiting, and auth data
11. **Graceful Shutdown**: Proper SIGTERM/SIGINT handling with transport cleanup and Redis connection close
12. **Health/Readiness Checks**: Separate liveness (`/health`) and readiness (`/ready`) endpoints with dependency checks
13. **Docker Security**: Multi-stage build, non-root user (`USER node`), health check configured
14. **Error Handling**: Errors do not leak internal details (generic messages returned to clients)
15. **Token Revocation**: RFC 7009 compliant, with Redis blacklist and TTL-based auto-cleanup
16. **Checkout Safety**: `create_checkout` explicitly documents it never processes payments directly

---

## Recommendations (Priority Order)

### Immediate (Before Production)

1. **Set `NODE_ENV=production` in Dockerfile** -- Prevents CRITICAL-2 auto-approve bypass
2. **Fix `.env.example`** -- Change `JWT_SECRET` to `MCP_JWT_SECRET` (LOW-15)
3. **Fix rate limiter Redis fallback** -- Fall back to in-memory on Redis error instead of failing open (HIGH-4)
4. **Fix `X-Forwarded-For` trust** -- Take last IP or validate proxy source (HIGH-6)

### Short-term (Pre-launch)

5. **Add auth enforcement middleware** -- Centralize auth checks instead of per-tool enforcement (HIGH-3)
6. **Create user-scoped Supabase client** -- Use anon key + user JWT for user queries (CRITICAL-1)
7. **Implement refresh tokens** -- Short-lived access tokens with rotation (HIGH-7)
8. **Add CSRF protection to OAuth form** (MEDIUM-13)

### Medium-term

9. **Replace `redis.keys()` with `SCAN`** in session listing (MEDIUM-12)
10. **Increase test coverage** thresholds and include auth/security files (LOW-14)
11. **Migrate deprecated SDK methods** (LOW-17)
12. **Fetch policies from database** instead of static content (LOW-16)
13. **Redact user IDs in production logs** (MEDIUM-9)

---

## Appendix: File Manifest

| File | Lines | Purpose |
|------|-------|---------|
| `src/index.ts` | 1018 | HTTP server, routing, MCP session management, tool registration |
| `src/session.ts` | 129 | Redis-backed session metadata (create, update, delete, list) |
| `src/auth/oauth-provider.ts` | 626 | OAuth 2.1 endpoints (authorize, token, revoke, metadata) |
| `src/auth/session.ts` | 85 | JWT validation, AuthInfo injection |
| `src/middleware/rate-limit.ts` | 249 | Redis sliding window + in-memory fallback rate limiter |
| `src/lib/audit-log.ts` | 109 | Structured audit logging with PII sanitization |
| `src/lib/completions.ts` | 188 | Auto-complete for tool arguments |
| `src/lib/logger.ts` | 80 | Runtime-adjustable log level (MCP logging/setLevel) |
| `src/lib/redis.ts` | 56 | Redis client singleton with lazy connect and retry |
| `src/lib/stripe.ts` | 22 | Stripe client singleton |
| `src/lib/supabase.ts` | 27 | Supabase admin client singleton (service key) |
| `src/prompts/shopping-assistant.ts` | 117 | Multi-locale shopping assistant prompt template |
| `src/resources/catalog.ts` | 103 | Product catalog resource (paginated) |
| `src/resources/policies.ts` | 99 | Store policies resource (static) |
| `src/tools/*.ts` | ~17 files | Individual tool implementations |
| `package.json` | 44 | Dependencies and scripts |
| `tsconfig.json` | 26 | TypeScript strict mode config |
| `Dockerfile` | 23 | Multi-stage Node.js 22 Alpine build |
| `vitest.config.ts` | 44 | Test configuration |
| `start-dev.sh` | 19 | Development startup script |
| `.env.example` | 26 | Environment variable template |
| `CLAUDE.md` | 143 | SDK reference documentation |
