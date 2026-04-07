# @pod-platform/mcp-server

Production-grade [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the AI-native POD e-commerce platform. Exposes 35 tools, 2 resources, and 1 prompt for AI assistants to browse products, manage carts, track orders, and complete purchases.

## Architecture

```
                    ┌─────────────────────────────────┐
                    │     MCP Clients (Claude, etc.)   │
                    └────────────────┬────────────────┘
                                     │ HTTPS + SSE
                    ┌────────────────▼────────────────┐
                    │        Caddy Reverse Proxy       │
                    │       mcp.yourdomain.com:443        │
                    └────────────────┬────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                        MCP Server (Node.js)                             │
│                           Port 8002                                     │
│                                                                         │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │  OAuth 2.1 + PKCE │  │ StreamableHTTP  │  │  Health / Readiness   │ │
│  │  /oauth/*         │  │ POST|GET|DEL /mcp│  │  /health  /ready     │ │
│  │  /.well-known/*   │  │ (SSE transport) │  │                       │ │
│  └──────────────────┘  └────────┬────────┘  └────────────────────────┘ │
│                                  │                                      │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │                      Middleware Pipeline                          │  │
│  │  injectAuthInfo() → rateLimitMiddleware() → withAuth() → audit   │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                  │                                      │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │                     32 MCP Tools (registry.ts)                    │  │
│  │  12 Public: search, details, reviews, categories, trending, ...  │  │
│  │  20 Protected: cart, checkout, orders, wishlist, profile, ...     │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                  │                                      │
│  ┌───────────┐  ┌───────────┐  ┌▼──────────┐                          │
│  │  Supabase │  │   Redis   │  │  Stripe   │                          │
│  │  (PG+RLS) │  │  (cache)  │  │ (payments)│                          │
│  └───────────┘  └───────────┘  └───────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Protocol**: MCP 2024-11-05 via Streamable HTTP (SSE streaming)
**Transport**: One `McpServer` + `StreamableHTTPServerTransport` per session
**Auth**: OAuth 2.1 with PKCE (S256), JWT access tokens (15 min) + refresh tokens (7 days)

## Quick Start

### Docker (recommended)

```bash
cd project
./start.sh           # Starts all services including MCP on :8002
```

### Local Development

```bash
cd mcp-server
cp .env.example .env  # Edit with your credentials
npm install
npm run dev           # tsx watch, auto-reload on changes
```

### Verify

```bash
curl http://localhost:8002/health
# {"status":"ok","timestamp":"..."}

curl http://localhost:8002/ready
# {"status":"ready","checks":{"supabase":{"status":"ready"},"redis":{"status":"ready"},"stripe":{"status":"ready"}}}
```

## Tools (32)

### Public Tools (12) — no authentication required

| Tool | Input | Description |
|---|---|---|
| `search_products` | `query`, `category?`, `limit?` | Full-text search with ILIKE fallback and category filter |
| `get_product_details` | `product_id` | Product info with variants, images, sizes, colors, GPSR data |
| `list_categories` | — | Category tree with product counts and parent/child hierarchy |
| `browse_by_category` | `category`, `sort?`, `limit?` | Browse products by category slug with sorting |
| `get_product_reviews` | `product_id`, `page?`, `limit?` | Paginated approved reviews with ratings |
| `get_trending_products` | `limit?` | Trending products (7-day weighted score) |
| `get_cross_sell` | `product_id` | Product recommendations via association rules |
| `estimate_shipping` | `country_code`, `zip_code`, `cart_total` | Shipping cost and delivery estimate |
| `validate_coupon` | `code`, `cart_total` | Coupon validation with discount calculation |
| `subscribe_newsletter` | `email`, `locale?` | Newsletter subscription (double opt-in) |
| `get_shared_wishlist` | `token` | View a shared wishlist by its public token |
| `get_store_info` | — | Store name, currencies, locales, features |
| `get_store_policies` | — | Shipping, returns, and privacy policies |

### Protected Tools (20) — JWT authentication required

| Tool | Scope | Description |
|---|---|---|
| `get_my_profile` | read | User profile (name, email, locale, currency) |
| `update_my_profile` | write | Update name/locale (userId from JWT, not input) |
| `get_cart` | read | Cart contents with product details and totals |
| `update_cart` | write | Add/update/remove items (max 50 items, qty 0-100) |
| `clear_cart` | write | Remove all cart items |
| `create_checkout` | write | Create Stripe Checkout Session (returns URL, never processes payment) |
| `list_my_orders` | read | Order history with status filter (max 50) |
| `get_order_status` | read | Order details with line items (ownership verified) |
| `track_shipment` | read | Tracking number, carrier, destination |
| `request_return` | write | Submit return request (delivered/shipped only) |
| `get_return_status` | read | Check return request status |
| `reorder` | write | Copy past order items to cart (merge, cap 10 per item) |
| `list_wishlist` | read | User's default wishlist with product details |
| `add_to_wishlist` | write | Add product/variant to wishlist |
| `remove_from_wishlist` | write | Remove from wishlist |
| `list_shipping_addresses` | read | Saved shipping addresses |
| `manage_shipping_address` | write | Create/update/delete shipping address |
| `list_notifications` | read | Paginated notifications with unread count |
| `mark_notifications_read` | write | Mark one or all notifications as read |
| `submit_review` | write | Submit product review (purchase verification) |
| `save_design` | write | Save AI-generated image as a design (SSRF-protected) |
| `get_my_designs` | read | List saved designs with pagination |

## OAuth 2.1 Authentication

### Built-in Clients

| Client ID | Platform | Redirect URIs |
|---|---|---|
| `claude-desktop` | Claude Desktop | `http://localhost:*` |
| `claude-ai` | Claude (claude.ai) | `https://claude.ai/oauth/callback`, `https://claude.ai/api/*` |
| `chatgpt` | ChatGPT | `https://chatgpt.com/aip/*/oauth/callback` |
| `store-web` | Store Web | `https://yourdomain.com/*/auth/mcp-callback` |

Additional clients can be registered via `MCP_REGISTERED_CLIENTS` env var (JSON) or Dynamic Client Registration (`POST /oauth/register`, RFC 7591).

### Auth Flow

```
1. Client → GET /oauth/authorize?client_id=...&code_challenge=...&code_challenge_method=S256
2. Server → 302 → Consent page (FRONTEND_URL/en/auth/mcp-consent)
3. User authenticates via Google (Supabase Auth) and approves
4. Server generates authorization code → redirect to client callback
5. Client → POST /oauth/token (code + code_verifier) → JWT (15 min) + refresh token (7 days)
6. Client uses JWT as Bearer token for protected tools
```

### Token Details

- **Access token**: JWT signed with HS256, 15-minute expiry. Claims: `sub` (userId), `email`, `scope`, `iss`, `aud`, `exp`, `iat`, `azp` (clientId)
- **Refresh token**: Opaque, 7-day expiry, one-time use with family rotation (replay detection)
- **Scopes**: `read` (default), `write` (required for mutations)
- **Revocation**: `POST /oauth/revoke` (RFC 7009), dual Redis + in-memory blacklist

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/ready` | Readiness check (Supabase, Redis, Stripe) |
| `GET` | `/.well-known/oauth-authorization-server` | OAuth 2.1 metadata (RFC 8414) |
| `GET` | `/.well-known/oauth-protected-resource` | Protected resource metadata (RFC 9728) |
| `GET` | `/oauth/authorize` | Authorization endpoint (PKCE required) |
| `POST` | `/oauth/token` | Token exchange (authorization_code, refresh_token) |
| `POST` | `/oauth/revoke` | Token revocation (RFC 7009) |
| `POST` | `/oauth/register` | Dynamic Client Registration (RFC 7591) |
| `POST` | `/mcp` | MCP protocol (initialize or tool call) |
| `GET` | `/mcp` | MCP SSE stream (existing session) |
| `DELETE` | `/mcp` | MCP session termination |

## Rate Limits

| Scope | Limit | Algorithm |
|---|---|---|
| Global (unauthenticated) | 60 req/min per IP | Redis sorted set sliding window |
| Global (authenticated) | 120 req/min per IP+user | Redis sorted set sliding window |
| `create_checkout` | 5/min | Per-tool override |
| `subscribe_newsletter` | 5/min | Per-tool override |
| `submit_review` | 5/min | Per-tool override |
| `request_return` | 5/min | Per-tool override |
| `validate_coupon` | 10/min | Per-tool override |
| `reorder` | 10/min | Per-tool override |
| `manage_shipping_address` | 10/min | Per-tool override |
| `update_cart` | 30/min | Per-tool override |
| `add_to_wishlist` / `remove_from_wishlist` | 30/min | Per-tool override |
| `search_products` | 60/min | Per-tool override |
| OAuth endpoints | 10-20/min per IP | Per-endpoint |

Falls back to in-memory rate limiting when Redis is unavailable (fail-closed, not fail-open).

## MCP Protocol Usage

### Initialize a session

```bash
curl -s -D- -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
    "protocolVersion":"2024-11-05",
    "clientInfo":{"name":"test","version":"1.0"},
    "capabilities":{}}}'
# Save Mcp-Session-Id from response headers
```

### Call a public tool

```bash
curl -s -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
    "name":"search_products",
    "arguments":{"query":"hoodie","limit":5}}}'
```

### Call a protected tool (with auth)

```bash
curl -s -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <session-id>" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
    "name":"get_cart","arguments":{}}}'
```

### Terminate session

```bash
curl -s -X DELETE http://localhost:8002/mcp \
  -H "Mcp-Session-Id: <session-id>"
```

Responses use SSE format (`text/event-stream`). Parse the `data:` line for the JSON-RPC payload.

## Security

### Authentication & Authorization
- **OAuth 2.1** with mandatory PKCE (S256) — no plain code challenge
- **Client registry** with redirect URI allowlist (static + dynamic registration)
- **JWT validation** with issuer + audience check, dual revocation (Redis + in-memory)
- **Scope enforcement**: `write` scope required for all mutation tools
- **IDOR protection**: 100% of protected tools verify resource ownership via `user_id` filter
- **Context injection**: userId always extracted from JWT, never from client input

### Input Validation
- **Zod schemas** on all 32 tools with strict constraints (UUID, length, enum, range)
- **SQL injection protection** via Supabase parameterized queries + `sanitizeForLike()`
- **SSRF protection** on `save_design`: HTTPS-only, private IP block, DNS rebinding check
- **Body size limits**: 1MB (MCP), 4KB (OAuth approve), 16KB (OAuth token)

### Transport Security
- **CORS allowlist** from `MCP_CORS_ORIGINS` (default: claude.ai, chatgpt.com, localhost)
- **DNS rebinding prevention** on MCP endpoint (origin validation)
- **Security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`

### Content Safety
- **User content boundaries**: `[USER_CONTENT]...[/USER_CONTENT]` tags on all user-generated text fields (descriptions, reviews, return reasons, addresses) to help LLMs distinguish system data from untrusted input
- **Generic error messages**: No stack traces, table names, or architecture details exposed to clients
- **Audit logging**: Structured JSON with PII field sanitization

### Operational
- **Rate limiting**: Per-tool + global, Redis sorted set with in-memory fallback (fail-closed)
- **Graceful shutdown**: Closes transports, Redis, HTTP server on SIGTERM/SIGINT
- **Docker**: Non-root user, minimal Alpine image, healthcheck

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | Yes | — | Supabase/PostgreSQL API URL |
| `SUPABASE_SERVICE_KEY` | Yes | — | Service role key (bypasses RLS for auth tools) |
| `SUPABASE_ANON_KEY` | Yes | — | Anon key (respects RLS for public tools) |
| `STRIPE_SECRET_KEY` | Yes | — | Stripe secret key for Checkout Sessions |
| `MCP_JWT_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `MCP_APPROVE_SECRET` | Yes | — | OAuth consent bridge secret (min 32 chars) |
| `MCP_BASE_URL` | Yes* | `http://localhost:8002` | Public URL (required in production) |
| `FRONTEND_URL` | Yes* | `http://localhost:3000` | Frontend URL for consent redirects |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `PORT` | No | `8002` | HTTP listen port |
| `MCP_CORS_ORIGINS` | No | `claude.ai,chatgpt.com,localhost:3000` | Allowed CORS origins |
| `TRUSTED_PROXY_IPS` | No | `127.0.0.1,::1` | IPs trusted for X-Forwarded-For |
| `MCP_REGISTERED_CLIENTS` | No | — | Additional OAuth clients (JSON) |

*Fail-fast in production if these point to localhost.

## Directory Structure

```
src/
├── index.ts                  # HTTP server, routing, session management
├── session.ts                # Redis-backed session metadata
├── auth/
│   ├── clients.ts            # OAuth client registry + DCR (RFC 7591)
│   ├── oauth-provider.ts     # OAuth 2.1 endpoints (authorize, token, revoke)
│   ├── session.ts            # JWT validation → AuthInfo injection
│   └── cookie-approval.ts    # HMAC-signed approval cookie
├── tools/
│   ├── registry.ts           # 32 tools registration + HOF wrapping
│   └── [32 tool files]       # One file per tool
├── lib/
│   ├── supabase.ts           # Dual clients: admin (service) + anon (RLS)
│   ├── redis.ts              # ioredis singleton (lazy connect, retry)
│   ├── stripe.ts             # Stripe client singleton
│   ├── response.ts           # createToolResponse() wrapper
│   ├── audit-log.ts          # withAuditLog() HOF + PII sanitization
│   ├── completions.ts        # Auto-complete for tool arguments
│   ├── product-helpers.ts    # Shared utilities (images, prices, userContent)
│   ├── image-utils.ts        # Image processing utilities
│   └── logger.ts             # Runtime-adjustable log level
├── middleware/
│   ├── auth.ts               # withAuth() HOF (required/optional/none + scopes)
│   └── rate-limit.ts         # Redis sliding window + in-memory fallback
├── resources/
│   ├── catalog.ts            # MCP Resource: paginated product catalog
│   └── policies.ts           # MCP Resource: store policies
└── prompts/
    └── shopping-assistant.ts  # MCP Prompt: multi-locale assistant template
```

## Development

```bash
npm run dev           # Dev server with auto-reload (tsx watch)
npm run build         # TypeScript + UI widget compilation
npm run start         # Production start (from dist/)
npm run typecheck     # Type checking only (tsc --noEmit)
npm run test          # Run tests (vitest)
npm run test:watch    # Tests in watch mode
npm run test:coverage # Tests with coverage report
```

### Adding a New Tool

1. Create `src/tools/my-tool.ts` exporting `myToolSchema` (Zod) and `myTool` (async handler)
2. Add the tool definition to `toolDefinitions` array in `src/tools/registry.ts`
3. Set `auth: 'required'` and `scopes: ['write']` for mutation tools
4. Add appropriate `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`)
5. Add per-tool rate limit in `src/middleware/rate-limit.ts` if needed
6. Write tests in `src/__tests__/`

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@modelcontextprotocol/sdk` | ^1.27.1 | MCP protocol (transport, server, types) |
| `@modelcontextprotocol/ext-apps` | ^1.2.2 | MCP Apps (interactive UI widgets) |
| `@supabase/supabase-js` | ^2.47 | PostgreSQL database client |
| `ioredis` | ^5.4 | Redis (sessions, rate limiting, OAuth state) |
| `jose` | ^5.9 | JWT signing and verification |
| `stripe` | ^17.5 | Stripe Checkout Sessions |
| `zod` | ^3.24 | Runtime input schema validation |

## License

[MIT](LICENSE)
