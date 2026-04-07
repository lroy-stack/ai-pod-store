# System Architecture — POD Platform

This document describes the high-level architecture, key design decisions, and data flows of this platform.

For detailed Architecture Decision Records (ADRs), see [`docs/adr/`](docs/adr/).  
For PodClaw agent system internals, see [`docs/architecture/`](docs/architecture/).

---

## Overview

This is a **full-stack AI-native e-commerce platform** that combines:

- A **conversational storefront** where the AI chat IS the primary shopping interface
- An **autonomous agent system** (PodClaw) that runs the store operations independently
- A standard **admin dashboard** for human oversight and control
- A **Model Context Protocol (MCP) server** exposing store operations as tools for external AI assistants

The platform is designed to be fully **self-hostable** via a single Docker Compose command.

---

## Subsystem Map

```
┌──────────────────────────────────────────────────────────────────┐
│                         POD Platform                              │
│                                                                    │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐  │
│  │   Customer Layer    │    │       Operations Layer           │  │
│  │                     │    │                                  │  │
│  │  Frontend (Next.js) │    │  PodClaw Bridge (FastAPI)        │  │
│  │  • Chat interface   │    │  • HTTP API for agents           │  │
│  │  • Shop / Cart      │    │  • APScheduler (cron)            │  │
│  │  • Checkout (Stripe)│    │  • 7 Claude Agents               │  │
│  │  • Design Studio    │    │                                  │  │
│  │  • i18n (en/es/de)  │    │  Admin Panel (Next.js)           │  │
│  └──────────┬──────────┘    │  • Agent monitoring              │  │
│             │               │  • Order management              │  │
│             │               │  • Customer analytics            │  │
│  ┌──────────▼──────────┐    └─────────────────────────────────┘  │
│  │   Data Layer        │                                          │
│  │                     │    ┌─────────────────────────────────┐  │
│  │  Supabase           │    │       Integration Layer          │  │
│  │  • PostgreSQL 16    │    │                                  │  │
│  │  • pgvector (RAG)   │    │  MCP Server (TypeScript)         │  │
│  │  • Auth + RLS       │    │  • OAuth 2.1 + PKCE              │  │
│  │  • Real-time        │    │  • 35 tools (13 public)          │  │
│  │                     │    │  • Claude / ChatGPT integration  │  │
│  │  Redis              │    └─────────────────────────────────┘  │
│  │  • Rate limiting    │                                          │
│  │  • Session cache    │    ┌─────────────────────────────────┐  │
│  │  • Chat history TTL │    │       AI Sidecar Services        │  │
│  └─────────────────────┘    │                                  │  │
│                              │  rembg   — background removal   │  │
│  ┌─────────────────────┐    │  crawl4ai — web scraping         │  │
│  │   Infrastructure    │    └─────────────────────────────────┘  │
│  │                     │                                          │
│  │  Caddy (proxy+TLS)  │                                          │
│  │  Docker Compose     │                                          │
│  │  Cloudflare (CDN)   │                                          │
│  └─────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. Frontend Architecture

**Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, Vercel AI SDK 6

### Route Groups (URL-invisible)

The frontend uses Next.js Route Groups for layout isolation without affecting URLs:

```
[locale]/
├── (landing)/          — Minimal layout, no sidebar
│   └── page.tsx        — / (hero, product carousel, CTA)
│
├── (app)/              — StorefrontLayout (sidebar + chat + detail panel)
│   ├── chat/           — /chat (chat is rendered in StorefrontLayout, not here)
│   ├── shop/           — /shop (product grid)
│   ├── cart/           — /cart
│   ├── orders/         — /orders
│   ├── profile/        — /profile
│   └── wishlist/       — /wishlist
│
└── (focused)/          — Minimal wrapper, no sidebar
    ├── auth/           — /auth/login, /auth/register, etc.
    └── checkout/       — /checkout
```

### Chat as Commerce

The storefront's central innovation is treating the AI chat as the primary shopping interface. The `StorefrontLayout` renders a three-panel design:

```
┌────────────┬────────────────────────┬──────────────┐
│  Sidebar   │  Chat (AI SDK Stream)  │  Detail Panel│
│  (nav +    │  22 tools available    │  (products,  │
│   history) │  to the assistant      │   designs,   │
└────────────┴────────────────────────┤   cart, etc.)│
                                       └──────────────┘
```

The AI assistant has access to 22 MCP-connected tools: product search, design generation, cart management, order tracking, and more. When the AI returns a structured artifact (e.g., a product card), it renders in the Detail Panel.

### Data Fetching Strategy

| Pattern | Used for |
|---------|----------|
| Server Components | Product pages, shop grid (SEO-critical) |
| Client Components + SWR/React Query | Cart, chat, profile, real-time updates |
| Server Actions | Form submissions, auth operations |
| Route Handlers | Webhooks, cron jobs, API endpoints |

### Authentication

Supabase SSR handles customer auth via secure HTTP-only cookies. The `middleware.ts` enforces locale routing and protects authenticated routes. Client and server use different Supabase clients:

- `supabase.ts` — anon client (RLS respected, browser)
- `supabase-server.ts` — server client with user's JWT
- `supabase-admin.ts` — service role client (RLS bypassed, server-only)

---

## 2. PodClaw — Autonomous Agent System

**Stack:** Python 3.12, Claude Agent SDK, FastAPI, APScheduler

PodClaw is the autonomous backend that runs the store without human intervention. It consists of:

### Agent Pipeline

```
APScheduler (cron trigger)
       │
       ▼
Orchestrator Prompt Builder
  (injects HEARTBEAT, MEMORY, daily log)
       │
       ▼
Claude Agent SDK (stateful session)
  • Reads skill prompt (SKILL.md per agent)
  • Has access to allowed MCP connectors
  • Operates within per-session budget
       │
       ▼
MCP Connectors (tool calls)
  • Printful (catalog, orders, mockups)
  • Supabase (products, orders, customers)
  • Stripe (refunds, revenue data)
  • Resend (email campaigns)
  • crawl4ai (market research / web scraping)
  • rembg (background removal)
  • svg-renderer (SVG → print-ready PNG)
```

### Security Model

PodClaw uses a **fail-closed security hook** on every tool call:

```python
# Every tool call passes through this hook BEFORE execution
def pre_tool_use_hook(tool_name, tool_input):
    if tool_name not in APPROVED_TOOLS_FOR_AGENT:
        return BLOCK  # Fail-closed: deny by default
    if exceeds_rate_limit(tool_name):
        return BLOCK
    if exceeds_budget():
        return BLOCK
    return ALLOW
```

Key constraints:
- **No shell access** for any agent (Bash is not in `allowed_tools`)
- **No cross-agent communication** (each session is isolated)
- **Budget enforcement** at SDK level (`max_budget_usd` per session)
- **Daily cap**: EUR 30.15/day across all agents
- **Circuit breaker**: 3+ errors in 24h → agent dispatch paused

### Memory System

Agents have three memory layers:
1. **HEARTBEAT** — real-time store status (injected each run)
2. **MEMORY** — agent's long-term notes (updated by agent)
3. **Daily log** — what happened today (shared context)

### Bridge API

The FastAPI bridge exposes agent control endpoints consumed by the Admin panel:

```
GET  /health            — System health
GET  /agents            — Agent status + last run
POST /agents/{id}/run   — Trigger agent run
GET  /agents/{id}/logs  — Recent execution logs
GET  /queue             — Current queue state
```

All bridge endpoints require `Authorization: Bearer <PODCLAW_BRIDGE_AUTH_TOKEN>`.

---

## 3. Admin Panel Architecture

**Stack:** Next.js 16, iron-session, TanStack Query/Table, Recharts

The admin panel is intentionally a **separate Next.js project** from the storefront (see [ADR-0005](docs/adr/ADR-0005-separate-nextjs-projects.md)).

### Why iron-session over Supabase Auth?

Admin authentication uses `iron-session` (encrypted cookies) rather than Supabase Auth because:
- Admin is a single-operator interface, not a multi-user system
- Sessions must survive container restarts (cookie-based, not token-based)
- Complete auth isolation from customer authentication reduces attack surface
- No risk of admin/customer privilege confusion in RLS policies

See [ADR-0001](docs/adr/ADR-0001-iron-session-for-admin-auth.md) for full rationale.

---

## 4. MCP Server Architecture

**Stack:** TypeScript, Node.js, OAuth 2.1 + PKCE

The MCP server exposes the platform's capabilities as tools consumable by any MCP-compatible AI assistant (Claude Desktop, Claude.ai, ChatGPT, etc.).

### OAuth 2.1 Flow

```
AI Assistant → Authorization Request → MCP Server
                                            │
                                    Show consent screen
                                    (embedded in frontend)
                                            │
                                    User approves → Authorization Code
                                            │
AI Assistant ← Access Token ← Token Exchange
```

### Tool Categories (35 tools total)

| Category | Example Tools | Auth Required |
|----------|--------------|---------------|
| Discovery (13) | `search_products`, `get_product_details`, `list_categories`, `browse_by_category`, `get_store_info`, `get_store_policies`, `get_product_reviews`, `get_trending_products`, `get_cross_sell`, `estimate_shipping`, `validate_coupon`, `subscribe_newsletter`, `get_shared_wishlist` | No |
| Cart & Checkout (3) | `get_cart`, `update_cart`, `create_checkout` | Yes |
| Orders (4) | `list_my_orders`, `get_order_status`, `track_shipment`, `reorder` | Yes |
| Profile (2) | `get_my_profile`, `update_my_profile` | Yes |
| Wishlist (4) | `list_wishlist`, `add_to_wishlist`, `remove_from_wishlist`, `clear_cart` | Yes |
| Returns (2) | `request_return`, `get_return_status` | Yes |
| Addresses (2) | `list_shipping_addresses`, `manage_shipping_address` | Yes |
| Notifications (2) | `list_notifications`, `mark_notifications_read` | Yes |
| Social (1) | `submit_review` | Yes |
| Designs (2) | `save_design`, `get_my_designs` | Yes |

---

## 5. Database Schema

**Stack:** Supabase (PostgreSQL 16 + pgvector + Row Level Security)

### Key Tables

```
users               — Customer accounts (Supabase Auth)
products            — Product catalog (synced from Printful)
product_variants    — SKUs with pricing and inventory
designs             — AI-generated customer designs
orders              — E-commerce orders
order_items         — Line items with design associations
cart_items          — Shopping cart (persisted for auth users)
wishlists           — Customer wishlists
conversations       — Chat session records
messages            — Chat messages with JSONB parts (AI SDK artifacts)
rag_embeddings      — pgvector embeddings for product search
newsletter_subs     — Newsletter subscriptions
```

### Multi-tenancy via RLS

Every customer-facing table has Row Level Security policies. The pattern:

```sql
-- Customers can only see their own data
CREATE POLICY "own_data" ON orders
  FOR ALL USING (user_id = auth.uid());

-- Public data is readable by anyone
CREATE POLICY "public_read" ON products
  FOR SELECT USING (is_published = true);
```

### RAG Pipeline

Product descriptions are embedded at sync time and stored in `rag_embeddings` (768-dim via Gemini `text-embedding-004`). At query time:

```
User query → Gemini embedding → pgvector similarity search → top-K products → LLM context
```

---

## 6. Infrastructure & Deployment

### Network Isolation

```
┌─────────────────────────────────────────────────────────┐
│  proxy network (internet-facing via Caddy)               │
│  caddy ↔ frontend, admin, podclaw, mcp-server           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  data network (internal only)                            │
│  frontend, podclaw, mcp-server ↔ redis                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ai-services network (zero secrets, isolated)            │
│  podclaw ↔ rembg, crawl4ai, svg-renderer                │
└─────────────────────────────────────────────────────────┘
```

### Container Security

Every container runs with:
- `cap_drop: ALL` (all Linux capabilities stripped)
- Non-root user in all custom images
- Read-only filesystem where possible
- Only the environment variables the service actually needs

### Email Flow (Inbound)

```
User email → Cloudflare Email Routing
          → Cloudflare Worker (email-inbound)
          → POST /bridge/webhook/email
          → PodClaw parses + routes to customer_manager agent
```

---

## 7. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Admin auth | iron-session | Isolation from customer auth; simpler for single-operator |
| Route groups | (landing)/(app)/(focused) | Layout isolation without URL pollution |
| AI chat | Vercel AI SDK 6 with streaming | Native streaming, tool-loop support, React hooks |
| Embeddings | Gemini text-embedding-004 (768-dim) | Cost-effective, high quality, 1M token context |
| Agent auth | Claude Agent SDK OAuth (Max Plan) | No API key management; cost controlled at plan level |
| Self-hosting | Docker Compose + Caddy | Single command deployment; auto-TLS; no vendor lock-in |
| Frontend/Admin split | Separate Next.js projects | Independent deploy cycles; auth isolation |

For detailed rationale, see the ADRs in [`docs/adr/`](docs/adr/).

---

## 8. Data Flow — Customer Purchase

```
1. Customer opens chat at yourdomain.com
2. AI assistant receives message (Vercel AI SDK streaming)
3. AI calls search_products tool → RAG query → pgvector results
4. Products displayed as artifacts in Detail Panel
5. Customer: "Add the black hoodie to my cart"
6. AI calls add_to_cart tool → cart_items table updated
7. Customer: "Checkout"
8. AI calls create_checkout tool → Stripe Checkout Session created
9. Customer completes payment on Stripe-hosted page
10. Stripe sends webhook → /api/webhooks/stripe
11. Order created in DB → Printful order submitted
12. Printful fulfills → ships → sends tracking
13. Printful webhook → /api/webhooks/printful → order status updated
14. Customer receives email via Resend (order confirmation + tracking)
```

---

*Last updated: 2026-04-06*
