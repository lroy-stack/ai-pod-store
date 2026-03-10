# MCP Server — SKAPARA E-Commerce

Model Context Protocol (MCP) server that exposes 17 e-commerce tools for AI assistants to interact with the SKAPARA print-on-demand store.

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    HTTP Server (node:http)                     │
│                         Port 8002                             │
├───────────────────┬───────────────────┬───────────────────────┤
│  OAuth 2.1 + PKCE │  MCP StreamableHTTP│  Health/Ready        │
│  /oauth/*         │  POST/GET/DELETE /mcp│  /health, /ready    │
│  /.well-known/*   │  (SSE transport)    │                     │
├───────────────────┴───────────────────┴───────────────────────┤
│                    Middleware Layer                            │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐             │
│  │ JWT Auth │  │ Rate Limiter │  │ Audit Log  │             │
│  │ (jose)   │  │ (Redis/mem)  │  │ (JSON)     │             │
│  └──────────┘  └──────────────┘  └────────────┘             │
├───────────────────────────────────────────────────────────────┤
│                    17 MCP Tools                               │
│  PUBLIC (6):  search_products, get_product_details,           │
│               get_product_reviews, list_categories,           │
│               get_store_info, get_store_policies              │
│  PROTECTED (11): get_cart, update_cart, create_checkout,      │
│               get_order_status, list_my_orders, track_shipment│
│               list_wishlist, add_to_wishlist,                 │
│               remove_from_wishlist, get_my_profile,           │
│               update_my_profile                               │
├───────────────────────────────────────────────────────────────┤
│                    Data Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Supabase │  │  Redis   │  │  Stripe  │                   │
│  │ (PG+RLS) │  │ (cache)  │  │ (payments│                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└───────────────────────────────────────────────────────────────┘
```

**Protocol**: MCP 2024-11-05 via StreamableHTTP (SSE streaming)
**Pattern**: One `McpServer` + `StreamableHTTPServerTransport` per session
**Auth**: OAuth 2.1 with PKCE (S256), JWT access tokens (24h)

## Quick Start

### Docker (recommended)

The MCP server runs as part of the full stack via `docker compose`:

```bash
cd project
./start.sh           # Starts all services including MCP on :8002
```

### Local Development

```bash
cd mcp-server
npm install

# Option A: Use start-dev.sh (sources frontend .env.local)
chmod +x start-dev.sh
./start-dev.sh

# Option B: Manual
export SUPABASE_URL="..."
export SUPABASE_SERVICE_KEY="..."
export MCP_JWT_SECRET="your-secret-min-32-chars"
npm run dev          # tsx watch, auto-reload on changes
```

### Verify

```bash
curl http://localhost:8002/health
# {"status":"ok","version":"1.0.0","tools":17,"uptime":...}

curl http://localhost:8002/ready
# {"status":"ready","supabase":"connected","redis":"connected","stripe":"configured"}
```

## Directory Structure

```
mcp-server/
├── src/
│   ├── index.ts                    # HTTP server, routing, MCP session management (1018 lines)
│   ├── session.ts                  # Redis-backed session metadata (create/update/delete/list)
│   ├── auth/
│   │   ├── oauth-provider.ts       # OAuth 2.1 endpoints (authorize, token, revoke, metadata)
│   │   └── session.ts              # JWT validation, AuthInfo injection (injectAuthInfo)
│   ├── tools/                      # 17 MCP tool implementations
│   │   ├── search-products.ts      # PUBLIC  — ILIKE search with sanitizeForLike()
│   │   ├── get-product-details.ts  # PUBLIC  — Product + variants + images
│   │   ├── get-product-reviews.ts  # PUBLIC  — Paginated reviews with user names
│   │   ├── list-categories.ts      # PUBLIC  — Category listing with product counts
│   │   ├── get-store-info.ts       # PUBLIC  — Store metadata (static/env)
│   │   ├── get-store-policies.ts   # PUBLIC  — Shipping, returns, privacy policies
│   │   ├── get-cart.ts             # AUTH    — User cart with product details
│   │   ├── update-cart.ts          # AUTH    — Add/update/remove cart items
│   │   ├── create-checkout.ts      # AUTH    — Create Stripe Checkout Session
│   │   ├── get-order-status.ts     # AUTH    — Order details with line items
│   │   ├── list-my-orders.ts       # AUTH    — User order history (filtered, sorted)
│   │   ├── track-shipment.ts       # AUTH    — Shipment tracking info
│   │   ├── list-wishlist.ts        # AUTH    — User wishlist with product details
│   │   ├── add-to-wishlist.ts      # AUTH    — Add product/variant to wishlist
│   │   ├── remove-from-wishlist.ts # AUTH    — Remove from wishlist
│   │   ├── get-my-profile.ts       # AUTH    — User profile (name, locale, currency)
│   │   └── update-my-profile.ts    # AUTH    — Update name/locale (context injection)
│   ├── lib/
│   │   ├── supabase.ts             # Supabase admin client singleton (service key)
│   │   ├── redis.ts                # ioredis client singleton (lazy connect, retry)
│   │   ├── stripe.ts               # Stripe client singleton
│   │   ├── audit-log.ts            # Structured JSON audit logging with PII sanitization
│   │   ├── completions.ts          # Auto-complete for tool arguments
│   │   └── logger.ts               # Runtime-adjustable log level (MCP logging/setLevel)
│   ├── middleware/
│   │   └── rate-limit.ts           # Redis sliding window + in-memory fallback
│   ├── resources/
│   │   ├── catalog.ts              # MCP Resource: paginated product catalog
│   │   └── policies.ts             # MCP Resource: store policies (static)
│   ├── prompts/
│   │   └── shopping-assistant.ts   # MCP Prompt: multi-locale shopping assistant
│   └── __tests__/
│       ├── test-utils.ts           # Mock factories (Redis, HTTP req/res, AuthInfo)
│       ├── tools.test.ts           # Tool tests (search-products, auth guards)
│       ├── rate-limit.test.ts      # Rate limiter tests (15 tests)
│       ├── session.test.ts         # Session management tests (12 tests)
│       ├── oauth-flow.test.ts      # OAuth metadata tests (needs MCP_JWT_SECRET fix)
│       └── oauth.test.ts           # OAuth metadata tests (duplicate, can remove)
├── Dockerfile                      # Multi-stage Node 22 Alpine (non-root, healthcheck)
├── .dockerignore
├── .env.example                    # Environment variable template
├── start-dev.sh                    # Dev startup script (sources frontend .env.local)
├── tsconfig.json                   # TypeScript strict mode config
├── vitest.config.ts                # Test config (coverage thresholds)
├── package.json                    # Dependencies and scripts
└── CLAUDE.md                       # SDK reference for Claude Code
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key (bypasses RLS) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for checkout sessions |
| `MCP_JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `REDIS_URL` | No | Redis connection URL (default: `redis://localhost:6379`) |
| `REDIS_PASSWORD` | No | Redis auth password |
| `PORT` | No | Server port (default: `8002`) |
| `MCP_CORS_ORIGINS` | No | Comma-separated allowed origins (default: `http://localhost:3000`) |
| `STORE_NAME` | No | Store display name (default: `SKAPARA`) |
| `STORE_DESCRIPTION` | No | Store description |

## API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check (version, tool count, uptime) |
| `GET` | `/ready` | Readiness check (Supabase, Redis, Stripe connectivity) |
| `GET` | `/.well-known/oauth-authorization-server` | OAuth 2.1 metadata |
| `GET` | `/.well-known/oauth-protected-resource` | Protected resource metadata |
| `GET` | `/oauth/authorize` | OAuth authorization (renders login form) |
| `POST` | `/oauth/token` | Token exchange (auth code → access token) |
| `POST` | `/oauth/revoke` | Token revocation |
| `POST` | `/mcp` | MCP protocol handler (initialize or tool call) |
| `GET` | `/mcp` | MCP SSE stream (existing session) |
| `DELETE` | `/mcp` | MCP session termination |

## Tool Reference

### Public Tools (no auth required)

| Tool | Input | Description |
|---|---|---|
| `search_products` | `query` (1-200 chars), `limit?` (1-50) | Search products by title/description/category with ILIKE |
| `get_product_details` | `product_id` (UUID) | Full product info with variants, images, sizes, colors |
| `get_product_reviews` | `product_id` (UUID), `page?`, `limit?` (1-20) | Paginated approved reviews with ratings |
| `list_categories` | none | All categories with product counts and thumbnails |
| `get_store_info` | none | Store name, description, currencies, features |
| `get_store_policies` | none | Shipping, returns, privacy policies |

### Protected Tools (JWT auth required)

| Tool | Input | Description |
|---|---|---|
| `get_cart` | none | User's cart with product details, quantities, totals |
| `update_cart` | `product_id`, `variant_id?`, `quantity` (0-100) | Add/update/remove cart items (0 = remove) |
| `create_checkout` | `success_url?`, `cancel_url?` | Create Stripe Checkout Session, returns URL |
| `get_order_status` | `order_id` (UUID) | Order details with line items (ownership verified) |
| `list_my_orders` | `limit?` (1-100), `status?` | User order history, newest first |
| `track_shipment` | `order_id` (UUID) | Tracking number, carrier, shipping address |
| `list_wishlist` | none | All wishlist items with product details |
| `add_to_wishlist` | `product_id`, `variant_id?` | Add to default wishlist (auto-creates if needed) |
| `remove_from_wishlist` | `product_id`, `variant_id?` | Remove from default wishlist |
| `get_my_profile` | none | User profile (name, email, locale, currency) |
| `update_my_profile` | `name?`, `locale?` (en/es/de) | Update profile (userId from JWT, not input) |

## Rate Limits

| Tool | Limit |
|---|---|
| `create_checkout` | 5 req/min |
| `update_cart` | 30 req/min |
| `add_to_wishlist` / `remove_from_wishlist` | 30 req/min |
| `search_products` | 60 req/min |
| All others | 120 req/min (global) |

Rate limiting uses Redis sliding window with automatic in-memory fallback when Redis is unavailable.

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

### Call a tool

```bash
curl -s -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
    "name":"search_products",
    "arguments":{"query":"hoodie","limit":5}}}'
```

### Terminate session

```bash
curl -s -X DELETE http://localhost:8002/mcp \
  -H "Mcp-Session-Id: <session-id>"
```

Response format is SSE (`text/event-stream`). Parse the `data:` line for JSON-RPC response.

## Security

- **OAuth 2.1** with PKCE (S256 required)
- **JWT tokens** signed with configurable secret (24h expiry)
- **Token revocation** via Redis blacklist (RFC 7009)
- **Input validation** via Zod schemas on all tools
- **SQL injection protection** via Supabase query builder + `sanitizeForLike()`
- **XSS prevention** via `escapeHtml()` in OAuth forms
- **Body size limits**: 1MB (MCP), 16KB (OAuth)
- **Audit logging** with PII field sanitization
- **Context injection**: userId always from JWT, never from client input
- **IDOR protection**: Ownership verification on order/cart/wishlist tools
- **Docker**: Non-root user, minimal Alpine image, healthcheck

## Development

```bash
npm run dev           # Dev server with auto-reload (tsx watch)
npm run build         # TypeScript compilation
npm run start         # Production start (from dist/)
npm run typecheck     # Type checking only
npm run test          # Run tests (vitest)
npm run test:watch    # Tests in watch mode
npm run test:coverage # Tests with coverage report
```

## Dependencies

| Package | Purpose |
|---|---|
| `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `@supabase/supabase-js` | Database client (PostgreSQL) |
| `ioredis` | Redis client (sessions, rate limiting, caching) |
| `jose` | JWT signing and verification |
| `stripe` | Payment processing (Checkout Sessions) |
| `zod` | Input schema validation |

## Known Issues

See `docs/audit-mcp-server-2026-03-09/AUDIT_CONSOLIDATED.md` for the full audit report. Key items:

1. Supabase service key used for all queries (bypasses RLS) — needs user-scoped client
2. OAuth test suite broken (MCP_JWT_SECRET not set in test env)
3. Rate limiter fails open on Redis errors
4. No refresh token mechanism (24h access tokens)
5. `list_categories` fetches all products (O(n) per call)
