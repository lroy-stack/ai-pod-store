# MCP Server Audit Report

**Date:** 2026-03-04
**Auditor:** Claude Opus 4.6
**Scope:** Complete architecture, tools, auth, security, integration, and gap analysis of `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/`

---

## 1. Directory Structure

```
mcp-server/
├── .dockerignore
├── .env.example                   # Environment template (7 vars)
├── CLAUDE.md                      # SDK reference + patterns doc
├── Dockerfile                     # Multi-stage Node 22 Alpine build
├── check-products.ts              # Debug script: check DB products
├── create-test-order.mjs          # Debug script: seed test order
├── mcp-server.log                 # Runtime log sample
├── package.json                   # @pod-ai/mcp-server v1.0.0
├── package-lock.json
├── start-dev.sh                   # Dev startup (loads frontend/.env.local)
├── test-search-logic.mjs          # Integration test: search logic
├── test-search-mug.ts             # Integration test: mug search
├── test-search.ts                 # Integration test: search
├── tsconfig.json                  # ES2022, NodeNext, strict
├── vitest.config.ts               # Coverage thresholds: 30/40/25/30
├── coverage/                      # Test coverage output
├── dist/                          # Compiled JS output
├── node_modules/
└── src/
    ├── index.ts                   # Main entry (32KB, 1002 lines)
    ├── session.ts                 # Redis session CRUD
    ├── auth/
    │   ├── oauth-provider.ts      # OAuth 2.1 endpoints (PKCE, token, revoke)
    │   └── session.ts             # JWT validation + AuthInfo injection
    ├── lib/
    │   ├── audit-log.ts           # Structured JSON audit logging
    │   ├── completions.ts         # Auto-complete for tool arguments
    │   ├── logger.ts              # Runtime-adjustable log levels
    │   ├── redis.ts               # ioredis singleton (graceful fallback)
    │   ├── stripe.ts              # Stripe client singleton
    │   └── supabase.ts            # Supabase admin client singleton
    ├── middleware/
    │   └── rate-limit.ts          # Redis sliding window + in-memory fallback
    ├── prompts/
    │   └── shopping-assistant.ts  # Multi-locale prompt template (en/es/de)
    ├── resources/
    │   ├── catalog.ts             # catalog://products resource
    │   └── policies.ts            # store://policies resource
    ├── tools/                     # 17 tool implementations
    │   ├── add-to-wishlist.ts
    │   ├── create-checkout.ts
    │   ├── get-cart.ts
    │   ├── get-my-profile.ts
    │   ├── get-order-status.ts
    │   ├── get-product-details.ts
    │   ├── get-product-reviews.ts
    │   ├── get-store-info.ts
    │   ├── get-store-policies.ts
    │   ├── list-categories.ts
    │   ├── list-my-orders.ts
    │   ├── list-wishlist.ts
    │   ├── remove-from-wishlist.ts
    │   ├── search-products.ts
    │   ├── track-shipment.ts
    │   ├── update-cart.ts
    │   └── update-my-profile.ts
    └── __tests__/                 # 6 test files
        ├── oauth-flow.test.ts
        ├── oauth.test.ts
        ├── rate-limit.test.ts
        ├── session.test.ts
        ├── test-utils.ts
        └── tools.test.ts
```

**Total source files:** 28 TypeScript files in `src/`
**Total lines of code:** ~3,200 lines (source only, excluding tests)

---

## 2. Server Architecture

### Tech Stack

| Component | Technology | Version |
|---|---|---|
| Runtime | Node.js | >= 22.0.0 |
| Language | TypeScript | 5.7.3 |
| MCP SDK | @modelcontextprotocol/sdk | 1.0.4 |
| Database | Supabase (PostgreSQL) | supabase-js 2.47.10 |
| Cache/Sessions | Redis via ioredis | 5.4.2 |
| Payments | Stripe | 17.5.0 |
| JWT | jose | 5.9.6 |
| Validation | Zod | 3.24.1 |
| Testing | Vitest | 4.0.18 |

### Transport: Streamable HTTP (SSE)

The server uses `StreamableHTTPServerTransport` over a raw `http.createServer()`. This is **NOT** stdio-based -- it is a standalone HTTP server on port 8002.

**Key pattern: One transport per session.** Each `initialize` request creates a new `StreamableHTTPServerTransport` + `McpServer` pair. The SDK manages `Mcp-Session-Id` headers automatically.

```
File: /Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/index.ts

Line 132: const transports = new Map<string, StreamableHTTPServerTransport>();
Line 141: function createMcpServer(): McpServer { ... }
Line 734: // New session -- create transport + server
Line 736: const transport = new StreamableHTTPServerTransport({
Line 737:   sessionIdGenerator: () => randomUUID(),
```

### Server Capabilities

The MCP server declares these capabilities at initialization:

```typescript
// File: src/index.ts, line 144
{ capabilities: { tools: {}, resources: {}, prompts: {}, logging: {}, completions: {} } }
```

- **Tools:** 17 registered tools
- **Resources:** 2 (catalog://products, store://policies)
- **Prompts:** 1 (shopping_assistant in en/es/de)
- **Logging:** Runtime-adjustable via MCP notification
- **Completions:** Auto-complete for category, order_id, product_id arguments

### HTTP Endpoints

| Method | Path | Handler |
|---|---|---|
| POST | `/mcp` or `/` | MCP protocol (tools, resources, prompts) |
| GET | `/mcp` or `/` | SSE streaming (existing sessions) |
| DELETE | `/mcp` or `/` | Session termination |
| GET | `/health` | Liveness check |
| GET | `/ready` | Readiness check (Supabase + Redis + Stripe) |
| GET | `/.well-known/oauth-authorization-server` | OAuth 2.1 metadata |
| GET | `/.well-known/oauth-protected-resource` | Protected resource metadata |
| GET | `/oauth/authorize` | OAuth authorization (renders login form) |
| POST | `/oauth/token` | OAuth token exchange |
| POST | `/oauth/revoke` | Token revocation (RFC 7009) |

### Service Connections

The MCP server accesses Supabase and Stripe **directly** -- it does NOT call the frontend's API routes.

```
File: src/lib/supabase.ts
- Uses SUPABASE_SERVICE_KEY (admin, bypasses RLS)
- Singleton pattern via getSupabaseClient()

File: src/lib/stripe.ts
- Uses STRIPE_SECRET_KEY directly
- Singleton pattern via getStripeClient()

File: src/lib/redis.ts
- Uses REDIS_URL (default: redis://localhost:6379)
- Graceful fallback if Redis unavailable
- Lazy connect with 3 retries
```

**CRITICAL NOTE:** Every protected tool creates its own Supabase client instance via `createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)` instead of using the singleton from `src/lib/supabase.ts`. This is redundant and wasteful -- 13 tool files each instantiate their own client at module scope.

Files with redundant client creation:
- `src/tools/get-my-profile.ts` (line 52)
- `src/tools/update-my-profile.ts` (line 62)
- `src/tools/list-my-orders.ts` (line 60)
- `src/tools/get-order-status.ts` (line 73)
- `src/tools/track-shipment.ts` (line 64)
- `src/tools/get-cart.ts` (line 60)
- `src/tools/update-cart.ts` (line 59)
- `src/tools/create-checkout.ts` (line 56)
- `src/tools/list-wishlist.ts` (line 54)
- `src/tools/add-to-wishlist.ts` (line 56)
- `src/tools/remove-from-wishlist.ts` (line 51)

Only `search-products.ts`, `list-categories.ts`, and `get-product-reviews.ts` use the shared singleton.

---

## 3. Available Tools -- Complete Inventory

### 3.1 PUBLIC Tools (No Authentication Required)

| # | Tool Name | Description | Input Schema | Read/Write | Data Source |
|---|---|---|---|---|---|
| 1 | `search_products` | Search by title/description/category (ILIKE) | `{ query: string, limit?: 1-50 }` | Read | Supabase `products` |
| 2 | `get_product_details` | Full product + variants by UUID | `{ product_id: uuid }` | Read | Supabase `products` + `product_variants` |
| 3 | `get_store_info` | Store metadata (hardcoded) | `{}` | Read | Environment/hardcoded |
| 4 | `get_store_policies` | Shipping, returns, privacy (hardcoded) | `{}` | Read | Hardcoded text |
| 5 | `list_categories` | All categories with product counts | `{}` | Read | Supabase `products` (GROUP BY) |
| 6 | `get_product_reviews` | Paginated reviews for a product | `{ product_id: uuid, page?: int, limit?: 1-20 }` | Read | Supabase `reviews` + `users` |

### 3.2 PROTECTED Tools (Authentication Required)

| # | Tool Name | Description | Input Schema | Read/Write | Data Source |
|---|---|---|---|---|---|
| 7 | `get_my_profile` | Authenticated user's profile | `{}` | Read | Supabase `users` |
| 8 | `update_my_profile` | Update name/locale | `{ name?: string, locale?: en/es/de }` | Write | Supabase `users` |
| 9 | `list_my_orders` | Order history with filters | `{ limit?: 1-100, status?: enum }` | Read | Supabase `orders` |
| 10 | `get_order_status` | Single order + line items | `{ order_id: uuid }` | Read | Supabase `orders` + `order_items` |
| 11 | `track_shipment` | Tracking info for an order | `{ order_id: uuid }` | Read | Supabase `orders` |
| 12 | `get_cart` | Current cart contents | `{}` | Read | Supabase `cart_items` + joins |
| 13 | `update_cart` | Add/update/remove cart items | `{ product_id: uuid, variant_id?: uuid, quantity: 0-100 }` | Write | Supabase `cart_items` |
| 14 | `create_checkout` | Create Stripe Checkout Session | `{ success_url?: url, cancel_url?: url }` | Write* | Stripe + Supabase |
| 15 | `list_wishlist` | Default wishlist items | `{}` | Read | Supabase `wishlists` + `wishlist_items` |
| 16 | `add_to_wishlist` | Add product to wishlist | `{ product_id: uuid, variant_id?: uuid }` | Write | Supabase `wishlist_items` |
| 17 | `remove_from_wishlist` | Remove product from wishlist | `{ product_id: uuid, variant_id?: uuid }` | Write | Supabase `wishlist_items` |

*`create_checkout` is annotated as `readOnlyHint: true` because it only returns a URL -- payment happens on Stripe's hosted page.

### 3.3 Tool Annotations Summary

| Tool | readOnly | idempotent | destructive | openWorld |
|---|---|---|---|---|
| search_products | true | true | false | true |
| get_product_details | true | true | false | true |
| get_store_info | true | true | false | true |
| get_store_policies | true | true | false | true |
| list_categories | true | true | false | true |
| get_product_reviews | true | true | false | true |
| get_my_profile | true | true | false | true |
| update_my_profile | false | false | **true** | true |
| list_my_orders | true | true | false | true |
| get_order_status | true | true | false | true |
| track_shipment | true | true | false | true |
| get_cart | true | true | false | true |
| update_cart | false | false | false | true |
| create_checkout | true | false | false | true |
| list_wishlist | true | true | false | true |
| add_to_wishlist | false | false | **true** | true |
| remove_from_wishlist | false | true | **true** | true |

---

## 4. Authentication & Security

### 4.1 OAuth 2.1 Implementation

The MCP server implements a full OAuth 2.1 authorization server with PKCE:

```
File: /Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/auth/oauth-provider.ts

- Authorization Code Grant with PKCE (S256 only)
- No implicit grant (OAuth 2.1 compliance)
- No password grant (OAuth 2.1 compliance)
- No client authentication required (public clients)
- Authorization codes stored in Redis (10 min TTL) with in-memory fallback
- Revoked tokens tracked in Redis with automatic TTL cleanup
```

**OAuth Flow:**

1. Client sends `GET /oauth/authorize?response_type=code&client_id=...&code_challenge=...&code_challenge_method=S256&redirect_uri=...&state=...`
2. Server renders an HTML login form (line 244-288) that POSTs to `{FRONTEND_URL}/en/auth/oauth-callback`
3. After authentication, the frontend generates an authorization code and redirects back
4. Client exchanges code for JWT via `POST /oauth/token { grant_type, code, code_verifier, redirect_uri }`
5. Server returns signed JWT (HS256, 24h expiry)

**JWT Token Structure:**

```typescript
// File: src/auth/oauth-provider.ts, line 445
const accessToken = await new SignJWT({
  sub: codeData.user_id,    // Supabase user UUID
  email: codeData.email,
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuer(MCP_BASE_URL)
  .setAudience('mcp-client')
  .setExpirationTime('24h')
  .setIssuedAt()
  .sign(MCP_JWT_SECRET);
```

### 4.2 JWT Validation

```
File: /Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/auth/session.ts

- Validates signature (HS256) + issuer
- Checks revocation list (Redis first, in-memory fallback)
- Returns AuthInfo: { token, clientId, scopes: ['read', 'write'], extra: { userId, email } }
- Returns null if no token or invalid token (public tools still work)
```

### 4.3 Auth Injection Pattern

```
File: src/index.ts, line 707

// For every POST /mcp request:
await injectAuthInfo(req);  // Sets req.auth if valid JWT present
// SDK passes req.auth to tool handlers as extra.authInfo
```

### 4.4 Per-Tool Authorization

Each protected tool checks authentication independently:

```typescript
// Pattern used in all 11 protected tools:
if (!authInfo || !authInfo.extra?.userId) {
  return {
    success: false,
    error: 'Authentication required. Please provide a valid Bearer token.',
  };
}
```

**Ownership verification** is performed by `get_order_status` and `track_shipment`:

```typescript
// File: src/tools/get-order-status.ts, line 111
if (orderData.user_id !== userId) {
  return {
    success: false,
    error: 'You do not have permission to view this order',
  };
}
```

### 4.5 Rate Limiting

```
File: /Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/middleware/rate-limit.ts

Global limits:
- Unauthenticated: 60 requests/minute per IP
- Authenticated: 120 requests/minute per IP+userId

Per-tool limits (authenticated only):
- create_checkout: 5/min
- search_products: 60/min
- update_cart: 30/min
- add_to_wishlist: 30/min
- remove_from_wishlist: 30/min

Implementation: Redis sorted set (sliding window) with in-memory fallback
Response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

### 4.6 Audit Logging

```
File: /Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/lib/audit-log.ts

Every tool invocation is wrapped with withAuditLog():
- Emits structured JSON to stdout
- Fields: timestamp, tool, duration_ms, success, user_id, input_sanitized, error
- Sensitive fields (token, password, api_key, secret) are redacted
```

### 4.7 Required Environment Variables

| Variable | Required | Used By | Description |
|---|---|---|---|
| `PORT` | No (default 8002) | HTTP server | Listen port |
| `MCP_BASE_URL` | No (default localhost:8002) | OAuth, JWT issuer | Base URL for discovery |
| `MCP_CORS_ORIGINS` | No | CORS | Comma-separated origins |
| `SUPABASE_URL` | **Yes** | All tools | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | **Yes** | All tools | Admin key (bypasses RLS) |
| `STRIPE_SECRET_KEY` | **Yes** | create_checkout, readiness | Stripe API key |
| `MCP_JWT_SECRET` | **Yes** | OAuth + auth | JWT signing secret |
| `REDIS_URL` | No (default localhost:6379) | Sessions, rate limit, revocation | Redis connection |
| `FRONTEND_URL` | No (default localhost:3000) | OAuth redirect, checkout URLs | Frontend base URL |
| `STORE_NAME` | No | get_store_info | Display name |
| `STORE_DESCRIPTION` | No | get_store_info | Store description |
| `DEFAULT_CURRENCY` | No (default EUR) | get_store_info | Default currency |

### 4.8 Security Findings

#### CRITICAL

1. **Hardcoded test user in OAuth auto-approve mode** (line 208):
   ```typescript
   const testUserId = '5fae3de5-94e8-469d-a6a6-789fd08868d5';
   const testEmail = 'test@example.com';
   ```
   Protected by `process.env.NODE_ENV !== 'production'` check, but the auto_approve parameter is still accepted. An attacker could try `?auto_approve=true` in production (would be rejected, but the code path exists).

2. **Service key used directly in all tools** -- every tool bypasses RLS via `SUPABASE_SERVICE_KEY`. The server is a single point of compromise: if the JWT secret is leaked, an attacker with any valid user JWT can read/write any user's data because the Supabase queries use the admin client, and ownership checks are application-level only.

3. **No scope-based authorization** -- all authenticated users get `scopes: ['read', 'write']` hardcoded (line 62 of `auth/session.ts`). There is no distinction between read-only and write scopes. A user with a token can call any tool.

4. **Login form sends credentials via GET** -- the OAuth authorize page (line 270) has `method="GET"` on the form, which would put email+password in the URL query string and browser history:
   ```html
   <form action="${FRONTEND_URL}/en/auth/oauth-callback" method="GET">
   ```

#### HIGH

5. **In-memory fallback for auth state is not clustered** -- if Redis goes down and the server restarts, all in-memory auth requests, authorization codes, and revoked tokens are lost. In a multi-instance deployment, each instance has separate in-memory state.

6. **No refresh token mechanism** -- tokens expire after 24 hours with no way to refresh. Users must re-authenticate through the full OAuth flow.

7. **No CSRF protection on OAuth authorize** -- the `state` parameter is passed through but not validated to be cryptographically random by the server.

8. **Rate limit fails open** (line 244 of rate-limit.ts): if Redis errors during rate checking, the request is allowed. An attacker could potentially exploit Redis failures to bypass rate limiting.

#### MEDIUM

9. **Completions endpoint leaks data** -- `getOrderIdCompletions` and `getProductIdCompletions` in `src/lib/completions.ts` query without user filtering. Any client can auto-complete order IDs or product IDs belonging to any user.

10. **No request body size limit** -- the `parseBody` function (line 614) buffers the entire request body with no size cap. An attacker could send a very large JSON payload.

11. **Redundant Supabase client instantiation** -- 11 tools create their own `createClient()` at module scope instead of using the singleton. This is not a security issue per se but increases the attack surface if env vars change at runtime.

12. **CORS allows localhost:3000** in production config but `MCP_CORS_ORIGINS` in Docker is `https://claude.ai,https://chatgpt.com` -- the frontend origin is NOT in the CORS list in production, which means the frontend cannot directly call the MCP server from the browser.

---

## 5. Profile & Purchase Tools

### 5.1 User Profile Management

| Tool | Capability | Fields |
|---|---|---|
| `get_my_profile` | Read profile | id, email, name, locale, currency, created_at |
| `update_my_profile` | Update profile | name, locale (only these two fields) |

**Missing profile capabilities:**
- Cannot update currency preference
- Cannot update email
- Cannot update password (no password change tool)
- Cannot view/update shipping address
- Cannot delete account
- Cannot view subscription status
- Cannot export personal data (GDPR)

### 5.2 Orders & Cart

| Tool | Capability |
|---|---|
| `list_my_orders` | List orders with status filter |
| `get_order_status` | Order details + line items |
| `track_shipment` | Tracking number, carrier, address |
| `get_cart` | View cart contents + totals |
| `update_cart` | Add/update/remove items (with smart variant resolution) |
| `create_checkout` | Generate Stripe Checkout URL |

**Smart variant handling in update_cart:**
- Auto-selects variant if product has only one
- Returns `needsVariantSelection: true` with available variants if multiple exist
- Validates product status, variant ownership, and availability

### 5.3 Wishlist

| Tool | Capability |
|---|---|
| `list_wishlist` | View default wishlist with product details |
| `add_to_wishlist` | Add product (auto-creates wishlist if needed) |
| `remove_from_wishlist` | Remove by product_id + optional variant_id |

### 5.4 Product Browsing

| Tool | Capability |
|---|---|
| `search_products` | Text search across title/description/category |
| `get_product_details` | Full details + all variants |
| `list_categories` | Browse by category with counts |
| `get_product_reviews` | Paginated reviews with ratings |

### 5.5 Store Info

| Tool | Capability |
|---|---|
| `get_store_info` | Name, currencies, locales, features (hardcoded) |
| `get_store_policies` | Shipping, returns, privacy (hardcoded) |

---

## 6. Integration with Frontend

### 6.1 Architecture: Standalone Sidecar

The MCP server is a **standalone service** that does NOT call the frontend's API routes. It accesses Supabase and Stripe directly using the same credentials.

```
                    +--------------+
                    |   Claude.ai  |
                    |   ChatGPT    |
                    +------+-------+
                           |
                           | HTTPS (MCP protocol)
                           v
+---------+         +------+-------+         +----------+
| Browser | <-----> |    Caddy     | <-----> | Frontend |
| (React) |  HTTP   | (reverse    |  HTTP   | (Next.js)|
+---------+         |  proxy)     |         +-----+----+
                    +------+-------+               |
                           |                       |
                           | /mcp, /oauth/*        |
                           v                       v
                    +------+-------+         +-----+------+
                    |  MCP Server  | ------> |  Supabase  |
                    |  (port 8002) | ------> |   (Cloud)  |
                    +------+-------+         +-----+------+
                           |                       ^
                           |                       |
                           +---------> Stripe <----+
                                       Redis
```

### 6.2 Caddy Reverse Proxy Config

```
File: /Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Caddyfile, lines 48-61

handle /mcp* {
    reverse_proxy mcp-server:8002
}
handle /.well-known/oauth-authorization-server {
    reverse_proxy mcp-server:8002
}
handle /.well-known/oauth-protected-resource {
    reverse_proxy mcp-server:8002
}
handle /oauth/* {
    reverse_proxy mcp-server:8002
}
```

The MCP server is exposed at `https://{DOMAIN}/mcp` in production, with OAuth discovery endpoints at their standard well-known paths.

### 6.3 Docker Compose Deployment

```
File: /Users/lr0y/POD-AI-PDR/pod_workspace/project/docker-compose.yml, lines 281-314

Service: mcp-server
- Build: ./mcp-server/Dockerfile (multi-stage)
- Port: 8002 (internal only, not exposed to host)
- Networks: proxy, data
- Resource limits: 0.5 CPU, 256MB RAM
- Health check: curl http://localhost:8002/health (30s interval)
- Depends on: redis (healthy)
- No env_file -- secrets passed individually
```

### 6.4 Frontend Has NO Direct MCP Connection

The frontend (`frontend/`) has **zero imports or references** to the MCP server, port 8002, or any MCP-related code. The MCP server is designed exclusively for external AI clients (Claude.ai, ChatGPT) -- the frontend's chat interface (`/chat`) uses the Vercel AI SDK and its own `/api/chat` route, which does not interact with the MCP server at all.

The `frontend/.mcp.json` file contains only a Pipedream MCP config (for Claude Code development tooling), unrelated to the production MCP server.

---

## 7. Gap Analysis

### 7.1 Missing Tools for Complete AI-Assisted Shopping

#### Profile Management (HIGH priority)

| Missing Tool | Description | Rationale |
|---|---|---|
| `update_currency` | Change currency preference | Users shopping via AI should be able to set EUR/USD/GBP |
| `get_shipping_addresses` | List saved addresses | AI should suggest saved addresses at checkout |
| `add_shipping_address` | Save a new address | Conversational address collection |
| `delete_account` | GDPR right to erasure | Legal requirement |
| `export_my_data` | GDPR data portability | Legal requirement |

#### Shopping Experience (HIGH priority)

| Missing Tool | Description | Rationale |
|---|---|---|
| `get_trending_products` | Popular/bestselling products | "What's popular?" is a common question |
| `get_product_recommendations` | Personalized suggestions | Based on order history, wishlist, browsing |
| `compare_products` | Side-by-side comparison | "What's the difference between X and Y?" |
| `check_product_availability` | Stock/variant availability | Before adding to cart |
| `apply_coupon` | Apply discount code | "I have a coupon code SKAPARA10" |
| `estimate_shipping` | Shipping cost/time estimate | Before checkout |
| `submit_review` | Write a product review | Post-purchase engagement |

#### Order Management (MEDIUM priority)

| Missing Tool | Description | Rationale |
|---|---|---|
| `cancel_order` | Request order cancellation | Before production starts |
| `request_return` | Initiate return/refund | Post-delivery |
| `reorder` | Reorder from past orders | "Order the same shirt again" |
| `get_order_invoice` | Download/view invoice | Business customers |

#### Support (LOW priority)

| Missing Tool | Description | Rationale |
|---|---|---|
| `contact_support` | Send message to support | Escalation from AI |
| `get_faq` | Retrieve FAQ content | Common questions |
| `get_size_guide` | Size recommendations | Product-specific sizing |

### 7.2 Security Improvements Needed

| Priority | Issue | Recommendation |
|---|---|---|
| CRITICAL | Service key in all tools | Use per-user Supabase tokens or implement row-level authorization in a middleware layer, not just application checks |
| CRITICAL | Login form uses GET method | Change to POST method in OAuth authorize HTML |
| HIGH | No scope enforcement | Implement `read` vs `write` scopes; public tools should require no scope, read tools `read` scope, write tools `write` scope |
| HIGH | No refresh tokens | Implement `refresh_token` grant type for seamless re-auth |
| HIGH | Completions leak order IDs | Filter completions by authenticated user |
| HIGH | No request body size limit | Add max body size (e.g., 1MB) to parseBody |
| MEDIUM | In-memory auth fallback fragile | Document that Redis is effectively required for production auth |
| MEDIUM | 11 tools create own Supabase client | Refactor to use shared singleton from `src/lib/supabase.ts` |
| MEDIUM | Rate limit fails open on Redis error | Consider fail-closed for write operations |
| LOW | Static policies text | Move to database/CMS for maintainability |

### 7.3 Guest vs. Authenticated User Experience

**Current state:** Guest users can only use 6 public tools (search, details, categories, reviews, store info, policies). All cart, wishlist, order, profile, and checkout operations require authentication. There is no guest cart or wishlist.

**Recommended improvements:**

1. **Guest cart via session** -- Allow unauthenticated users to add items to a session-based cart. When they authenticate, merge the session cart into their user cart. This is critical for the conversational shopping flow where a user says "add that to my cart" before being asked to sign in.

2. **Guest wishlist via session** -- Same pattern as guest cart. Allow browsing and saving products without authentication, then merge on login.

3. **Graceful auth prompts** -- Tools should return `{ success: false, error: 'authentication_required', action: 'prompt_login', login_url: '/oauth/authorize...' }` so the AI can guide the user to log in with a clickable link.

4. **Anonymous product interactions** -- Allow anonymous review viewing, product comparison, and shipping estimates. These are already public but should be explicitly documented.

### 7.4 Data Exposure Assessment

**What IS exposed that should be:**
- Product catalog, variants, pricing, images, categories, reviews -- all appropriate for public access
- User's own profile, orders, cart, wishlist -- properly scoped to authenticated user

**What IS exposed that SHOULD NOT be:**
- `get_order_status` returns `customer_email` and full `shipping_address` -- these should be partially masked in AI responses
- `get_product_details` returns `printify_id` via the `catalog://products` resource (line 31 of catalog.ts) -- this is an internal ID
- Completion handler returns order IDs without user filtering (any client can enumerate orders)

**What is NOT exposed that should be:**
- Subscription/billing status
- Design studio/personalization state
- Referral program info
- Newsletter subscription status
- Recently viewed products

---

## 8. Test Coverage

### Test Files

| File | Tests | What's Covered |
|---|---|---|
| `tools.test.ts` | 5 | search_products (4), get_cart auth (1), create_checkout auth (1) |
| `oauth.test.ts` | 6 | Metadata endpoints, PKCE, grant types |
| `oauth-flow.test.ts` | 17 | Full OAuth 2.1 compliance, metadata, PKCE, security |
| `rate-limit.test.ts` | 12 | Global limits, per-tool limits, in-memory fallback, headers, IP extraction |
| `session.test.ts` | 8 | Create, update, delete, get, list sessions |

**Coverage thresholds (vitest.config.ts):**
- Lines: 30%
- Functions: 40%
- Branches: 25%
- Statements: 30%

These thresholds are very low. Critical paths like the actual OAuth token exchange, protected tool authorization checks, and the `update_cart` variant resolution logic are not unit tested.

### Missing Test Coverage

- No tests for any of the 11 protected tools (beyond auth-required check)
- No tests for `update_cart` variant auto-selection logic
- No tests for `create_checkout` Stripe integration
- No integration tests for the full MCP protocol flow
- No tests for `completions.ts`
- No tests for `resources/catalog.ts` or `resources/policies.ts`
- No tests for the `shopping_assistant` prompt

---

## 9. Summary

The MCP server is a well-structured standalone service that provides a comprehensive set of e-commerce tools for AI assistants (Claude, ChatGPT) to interact with the POD AI Store. The architecture is sound: Streamable HTTP transport, OAuth 2.1 with PKCE, Redis-backed sessions and rate limiting, structured audit logging, and proper tool annotations.

### Strengths
- Clean separation between public and protected tools
- OAuth 2.1 compliance (no implicit grant, PKCE required)
- Graceful Redis fallback for all subsystems
- Comprehensive rate limiting (global + per-tool)
- Structured audit logging with sensitive data redaction
- Smart variant resolution in `update_cart`
- Multi-locale prompt template

### Critical Issues
1. Login form uses GET method (credentials in URL)
2. Service key bypass of RLS with application-level ownership checks only
3. No scope-based authorization
4. Completions endpoint leaks cross-user data
5. No guest cart/wishlist support
6. No request body size limit
7. Redundant Supabase client creation in 11 tools

### Recommended Next Steps
1. Fix the OAuth login form to use POST method
2. Add request body size limit
3. Filter completions by authenticated user
4. Implement guest session cart
5. Add missing tools (currency, addresses, returns, recommendations)
6. Increase test coverage to at least 70%
7. Refactor protected tools to use shared Supabase singleton
8. Implement refresh tokens
