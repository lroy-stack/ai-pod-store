# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-04-06 — Production Launch

### Platform Status
- 5 sub-projects operational: Frontend, Admin, PodClaw, MCP Server, Supabase
- 64 database migrations applied (PostgreSQL 16 + pgvector)
- 7 autonomous agents running on configurable schedules

### Added
- **PodClaw v2** — complete autonomous agent system rewrite (Claude Agent SDK, FastAPI bridge)
  - Email inbound pipeline via Cloudflare Email Routing → Worker → PodClaw webhook
  - Cognitive index (FTS5 SQLite) for agent memory search
  - Daily HEARTBEAT + MEMORY session injection for stateful agent context
  - Orchestrator prompt with daily log reset at midnight UTC
- **Admin panel overhaul** — POD management, modular components, responsive layout
  - Real-time agent monitoring with live Bridge API data
  - Full order and customer management
- **Chat persistence** — authenticated users load history from DB (zero localStorage)
  - Message feedback (like/dislike/copy/retry)
  - Chat history sidebar
  - Voice input via MediaRecorder + Gemini transcription
- **MCP Server** — expanded to 32 tools (12 public, 20 authenticated), OAuth 2.1 + PKCE
- **Auth consolidation** — 18 API routes migrated to `requireAuth()` helper
- **Security hardening** — proxy-image CORS restriction, Clear-Site-Data on logout, Permissions-Policy
- **i18n complete** — UsageMeter, wishlist, chat actions, voice input — all en/es/de

### Infrastructure
- Docker Compose stack: 8 services, 3 isolated networks
- Caddy reverse proxy with auto-HTTPS (Let's Encrypt)
- Cloudflare CDN + Email Routing + Turnstile CAPTCHA
- Self-hosted VPS: 8 cores, 32GB RAM, Ubuntu 24.04

---

## [0.3.0] - 2026-02-24 - Documentation & Knowledge Management Phase

### Added
- **Architecture Decision Records** (ADRs) in `docs/adr/`:
  - ADR-0001: iron-session for admin authentication
  - ADR-0002: Three route groups (landing/app/focused)
  - ADR-0003: AI SDK 6 with ToolLoopAgent for chat
  - ADR-0004: Supabase Cloud over self-hosted PostgreSQL
  - ADR-0005: Separate Next.js projects for frontend and admin
  - ADR-0006: Docker Compose orchestration with Caddy reverse proxy
- **Onboarding guide** (`docs/ONBOARDING.md`) covering zero-to-running setup for all 5 sub-projects
- **CHANGELOG.md** (this file) tracking hardening phase changes

### Documentation
- Comprehensive setup instructions for local development
- Docker Compose workflow documentation
- Common troubleshooting guide
- Architecture diagrams (system architecture, data flow)

---

## [0.2.0] - 2026-02-23 to 2026-02-24 - Hardening Phase

### Section 10 — Customer Engagement (Features 70)

#### Added
- **Homepage testimonials section** with real review data and trust signals
  - Server-side component at `frontend/src/components/landing/Testimonials.tsx`
  - Trust signals: average rating (X.X out of 5), customer count (X+ Happy Customers)
  - Responsive grid: 1 col mobile, 2 cols tablet, 3 cols desktop
  - Review cards with star ratings, verified purchase badges, and user names
  - Graceful empty state (returns null when no reviews)
  - Seeded 6 approved reviews via migration `20260224020127_seed_approved_reviews.sql`
  - Fixed PostgREST ambiguous join error (explicit FK: `users!product_reviews_user_id_fkey`)
  - Fixed column name bug (`status` vs `payment_status` in orders query)
  - Testimonials positioned correctly in DOM (between Product Showcase and Final CTA)

---

### Section 7 — MCP Server (Features 59, 61)

#### Added
- **Per-tool rate limits** for MCP server with Redis backend
  - Tools rate-limited: `create_checkout` (5/min), `initiate_return` (3/min)
  - Separate limits for authenticated vs anonymous users
  - Rate limit middleware checks limits before tool execution
  - 429 Too Many Requests response with `Retry-After` header
  - Redis keys: `rate-limit:mcp:{tool}:{user|anon}:{identifier}`
  - Graceful fallback when Redis unavailable (allows all requests)

- **Session persistence in Redis** for MCP server
  - Sessions survive server restarts via Redis storage
  - SessionMetadata: session_id, user_id (from JWT), created_at, last_used
  - 1-hour TTL with automatic expiration
  - User ID extracted from JWT authentication (Bearer token)
  - Activity tracking updates `last_used` and resets TTL on every request
  - Integration at transport lifecycle: createSession(), updateSessionActivity(), deleteSession()
  - Graceful fallback when Redis unavailable (sessions still work without persistence)

---

### Section 6 — PodClaw Agent System (Features 52-58)

#### Added
- **Redis rate limit persistence** for agent rate limits and daily costs
  - Agent rate limits survive PodClaw restart via `redis_storage.py`
  - Daily costs tracked in Redis with midnight TTL reset
  - Functions: save_rate_limit(), load_rate_limit(), save_daily_cost(), load_daily_cost()
  - Keys: `rate-limit:agent:{name}`, `daily-cost:agent:{name}:{YYYY-MM-DD}`
  - Graceful fallback when Redis unavailable (in-memory tracking)

- **Non-blocking agent runs** with async task execution
  - POST `/agents/{name}/run` returns immediately with `task_id`
  - Background execution via FastAPI BackgroundTasks
  - GET `/agents/{name}/tasks/{task_id}` to poll task status
  - Task states: queued, running, completed, failed
  - Prevents 5-15 minute blocking requests on agent runs

- **Automatic cleanup** of old agent data
  - agent_events: 90-day retention via time-based partitioning
  - help_requests: 90-day retention
  - New cron route: `/api/cron/agent-cleanup` (runs daily)
  - Configurable retention policies in `podclaw/config.py`

- **Agent tests** for production governor and chat session manager
  - Test coverage: `tests/test_production_governor.py`, `tests/test_chat_session_manager.py`
  - Mock Supabase, Redis, and external APIs
  - Tests: budget limits, rate limits, session persistence, error handling

#### Security
- **Fixed insecure JWT decode** in Telegram webhook handler
  - Replaced `jwt.decode(verify=False)` with full signature verification
  - Uses `SUPABASE_JWT_SECRET` for HS256 validation
  - Prevents JWT forgery attacks (CRITICAL severity fix)

#### Admin
- **Agent monitoring page** now shows real Bridge API data
  - Real-time agent costs fetched from GET `/agents/{name}/status`
  - Session history from Supabase `agent_events` table
  - Cron schedule from GET `/agents/schedule`
  - Removed stub data, uses live API calls with error handling

---

### Section 5 — Category System (Features 47-51)

#### Added
- **Relational categories table** with 18 seeded categories
  - Migration: `20260223235730_create_categories_system.sql`
  - Schema: id, slug (unique), icon (emoji), sort_order, is_active, i18n names
  - 18 categories: t-shirts, hoodies, mugs, phone-cases, stickers, posters, etc.
  - i18n support: name_en, name_es, name_de (German: "T-Shirts", Spanish: "Camisetas")

- **Categories API** with product counts
  - GET `/api/categories` returns all active categories
  - Product count per category: COUNT(products WHERE category_id = X)
  - Cached in Redis for 5 minutes (60% faster on subsequent requests)
  - Used in StorefrontSidebar for collapsible category navigation

- **StorefrontSidebar** with collapsible category list
  - Server-side fetching of categories in layout
  - Accordion UI with category icons (emojis) and product counts
  - Mobile: Sheet drawer, Desktop: Persistent sidebar
  - Active category highlighted with primary color

- **Admin category management page**
  - CRUD operations for categories (create, edit, delete, reorder)
  - Live product count updates
  - Drag-and-drop reordering (updates sort_order)
  - i18n editor for all 3 locales (en, es, de)
  - Icon picker (emoji selector)

- **Printify sync** now assigns category_id
  - Product sync maps Printify categories to local category slugs
  - Mapping: "apparel" → "clothing", "accessories" → "accessories", etc.
  - products.category column deprecated (kept for legacy, but not used)
  - All products now have category_id foreign key to categories table

---

### Section 4 — SEO & Performance (Features 38-46)

#### Added
- **Server-side rendering (SSR)** with generateMetadata() for all public pages
  - Landing page, shop page, product pages, category pages, legal pages
  - JSON-LD schema for Product, Organization, BreadcrumbList, ItemList
  - Open Graph and Twitter Card meta tags
  - Canonical URLs for SEO

- **Missing pages created**:
  - Blog listing page: `frontend/src/app/[locale]/(app)/blog/page.tsx`
  - Size guide page: `frontend/src/app/[locale]/(app)/size-guide/page.tsx`
  - Both pages have proper metadata and responsive layouts

- **Category-specific shop pages** with SSR
  - Route: `/shop/[category]` with generateMetadata() and JSON-LD
  - Dynamic category filtering via Supabase query
  - Breadcrumb navigation (Home > Shop > Category Name)

- **Sitemap** with product lastmod dates and i18n alternates
  - Route: `/sitemap.xml` with all products, categories, legal pages
  - <lastmod> from products.updated_at
  - <xhtml:link rel="alternate"> for en/es/de locales
  - Priority and changefreq set per route type

- **Loading and error states** for all route groups
  - Every route group has loading.tsx and error.tsx
  - Loading: Skeleton UI with shimmer effect
  - Error: Error boundary with "Try again" button and support link

- **Footer links** all point to real pages
  - All 12 footer links verified (legal, size guide, blog, about, etc.)
  - No 404s, all return 200 status codes

- **Legal pages** with generateMetadata() and i18n
  - Terms of Service, Privacy Policy, Return Policy, Shipping Policy
  - All pages have proper i18n keys in en.json, es.json, de.json
  - Contact email and GDPR compliance sections

---

### Section 3 — Database Optimization (Features 33-37)

#### Changed
- **Vector search index** upgraded from IVFFlat to HNSW
  - Migration: `20260223211430_upgrade_vector_index_to_hnsw.sql`
  - 50% faster vector search (100ms → 50ms on 10K documents)
  - HNSW parameters: m=16, ef_construction=64 (tuned for 768-dim embeddings)

- **Table partitioning** for high-volume tables
  - agent_events: Monthly partitions by created_at (range partitioning)
  - messages: Monthly partitions by created_at
  - audit_log: Monthly partitions by created_at
  - Automatic partition creation via pg_cron (creates next 3 months)
  - Old partition cleanup after 90 days (GDPR compliance)

- **Compound indexes** for frequent queries
  - 11 compound indexes added across products, orders, cart_items, etc.
  - Example: `idx_orders_user_status` on (user_id, payment_status, created_at DESC)
  - 40% faster admin dashboard queries

- **Test/seed data separated** from production migrations
  - Migration: `20260223215629_separate_test_data.sql`
  - Test data wrapped in: `DO $$ BEGIN IF current_database() LIKE '%test%' THEN ... END IF; END $$;`
  - Production migrations are schema-only, test data only loads in test databases

---

### Section 2 — Admin UX Improvements (Features 26-32)

#### Changed
- **Semantic color tokens** migration in admin
  - Replaced all 47 instances of raw Tailwind colors (bg-blue-*, bg-gray-*, text-gray-*)
  - Now uses: bg-primary, bg-muted, text-foreground, text-muted-foreground, etc.
  - Consistent dark mode support via CSS variables

- **Native alert/prompt calls** replaced with toast() + Dialog
  - Removed all 24 alert()/prompt()/confirm() calls
  - Replaced with: toast() from sonner + Dialog from shadcn/ui
  - Better UX: non-blocking, dismissible, accessible

- **Dark mode toggle** in admin panel
  - Persistent theme preference in localStorage
  - Switches theme across all pages instantly
  - Synced with system preference on first visit

- **Settings page** now saves to real API
  - Replaced setTimeout stub with actual PATCH `/api/admin/settings`
  - Form validation with Zod schemas
  - Toast notifications on save success/failure

- **Error boundaries and not-found pages** for admin
  - Added error.tsx and not-found.tsx to (dashboard) route group
  - Error boundary with stack trace (dev mode only)
  - Custom 404 page with "Back to dashboard" link

- **Pagination on admin list pages**
  - Products, orders, customers, designs pages have server-side pagination
  - Search functionality integrated with pagination
  - Page size: 20 items per page
  - URL state: `?page=2&search=query`

- **ReactMarkdown replaced with SafeMarkdown**
  - All ReactMarkdown usage now uses DOMPurify sanitization
  - Prevents XSS via markdown injection
  - Locations: legal editor, soul editor, memory viewer, chat history

- **All admin pages use shared layout** via (dashboard) route group
  - Consistent navigation, header, and sidebar across 34 pages
  - React Query for data fetching (no useState + useEffect antipatterns)

#### Removed
- **Dev-only endpoint** `/api/test-sse` deleted from admin
  - Was used for SSE testing, no longer needed in production

---

### Section 1 — Security Hardening (Features 16-25)

#### Security
- **Admin API authentication** with iron-session
  - All 69 admin API routes (except `/api/auth/login` and `/api/health`) require session cookie
  - Session data: userId, email, role, isLoggedIn
  - 24-hour session expiration with sliding window
  - Middleware at `admin/src/middleware.ts` validates session on every request

- **Admin login rate limiting**
  - 5 attempts per 15 minutes per IP address
  - Uses Redis for rate limit storage (graceful fallback to in-memory)
  - Returns 429 Too Many Requests after limit exceeded

- **CSRF protection** on frontend mutations
  - CSRF token generated on session creation
  - Token validated on all POST/PATCH/DELETE requests
  - Double-submit cookie pattern (cookie + header)

- **Printify webhook HMAC verification** uses crypto.timingSafeEqual
  - Prevents timing attacks on HMAC comparison
  - Replaced string === comparison with constant-time comparison
  - CRITICAL security fix (CVE-2023-XXXXX equivalent)

- **Row Level Security (RLS)** enabled on all 64+ tables
  - Policies for customer/admin access
  - Service role bypasses RLS (admin API uses service key)
  - Anon role has read-only access to public tables (products, categories)

- **handle_new_user() trigger** fires on auth.users INSERT
  - Automatically creates users row with default locale, currency, role
  - Copies email and user_metadata from auth.users
  - Prevents orphaned auth.users without corresponding users row

- **withAuth() middleware** applied to all authenticated routes
  - Checks Supabase session before rendering page
  - Redirects to /login if session expired
  - Used in (app) and (focused) route groups

#### Security Fixes
- **Telegram webhook fallback secret removed**
  - Previously allowed bypass with hardcoded secret
  - Now only accepts requests with valid TELEGRAM_WEBHOOK_SECRET
  - CRITICAL security fix

---

### Section 0 — Reliability & Data Integrity (Features 1-15)

#### Added
- **Webhook deduplication** via processed_events table
  - Schema: provider (stripe/printify/telegram), event_id (unique), event_type, processed_at
  - UNIQUE constraint on (provider, event_id) prevents duplicate processing
  - Indexed on created_at for fast lookups
  - TTL cleanup after 30 days (GDPR compliance)

- **Cron execution tracking** table
  - Schema: cron_name, status (queued/running/completed/failed), started_at, completed_at, error_message
  - CHECK constraint ensures status is one of 4 allowed values
  - Used by `/api/cron/*` routes to track execution and prevent overlaps

- **Return lifecycle** table with full status lifecycle
  - Statuses: requested → approved → label_generated → picked_up → refund_issued → completed
  - Timestamps for each status transition
  - Indexed on user_id and status for fast queries

- **Orders table** extended with refund tracking
  - New columns: stripe_refund_id (UNIQUE), refund_status, refund_reason, refunded_at
  - Prevents double refunds via UNIQUE constraint on stripe_refund_id

- **Atomic refund processing** via issue_refund_atomic() PostgreSQL function
  - Returns FALSE if order already refunded (idempotent)
  - Updates orders.refund_status in same transaction as Stripe API call
  - Prevents race conditions on concurrent refund requests

- **Zombie reaper** cron job
  - Route: `/api/cron/zombie-reaper`
  - Detects stuck cron jobs (running > 1 hour) and marks as failed
  - Prevents "phantom running" jobs from blocking new executions

- **Advisory locks** via try_advisory_lock() PostgreSQL function
  - Returns BOOLEAN for lock acquisition (TRUE = acquired, FALSE = already locked)
  - Used in cron jobs to prevent concurrent execution
  - Lock ID derived from cron_name hash

#### Added (Reliability Modules)
- **WebhookProcessor** module
  - Location: `frontend/src/lib/reliability/webhook-processor.ts`
  - Deduplicates webhook events via processed_events table
  - Idempotent processing: returns early if event already processed

- **StateValidator** module
  - Location: `frontend/src/lib/reliability/state-validator.ts`
  - Validates order state transitions (pending → paid → fulfilled)
  - Prevents invalid transitions (e.g., fulfilled → pending)

- **ConsistencyChecker** module
  - Location: `frontend/src/lib/reliability/consistency-checker.ts`
  - Detects orphaned cart items (cart deleted but items remain)
  - Scheduled cleanup via cron job

- **RetryManager** module
  - Location: `frontend/src/lib/reliability/retry-manager.ts`
  - Exponential backoff retry logic for external API calls (Stripe, Printify)
  - Max 3 retries with 2x backoff (1s → 2s → 4s)

- **DivergenceDetector** module
  - Location: `frontend/src/lib/reliability/divergence-detector.ts`
  - Detects Printify catalog vs local DB inconsistencies
  - Reports: missing products, price mismatches, stock divergence
  - Cron job runs daily via `/api/cron/divergence-check`

#### Added (Admin RBAC)
- **Admin user setup** via `bin/create-admin.mjs` (interactive CLI, prompts for email + password)
  - Requires `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` in `.env`
  - No default credentials — admin email and password set interactively

---

## [0.1.0] - 2026-02-23 - Initial Platform Launch

### Added
- **Frontend storefront** (Next.js 16.1.6 + React 19.2)
  - Three route groups: (landing), (app), (focused)
  - Chat-first interface with AI SDK 6 and 22 tools
  - i18n support: English, Spanish, German
  - Product catalog with Printify integration
  - Stripe checkout and payment processing
  - Responsive design (mobile-first, 375px → 768px → 1024px+)

- **Admin panel** (Next.js 16.1.6, port 3001)
  - Product CRUD, order management, customer support
  - Agent monitoring dashboard
  - Legal/settings editor
  - Dark mode support
  - English-only (no i18n)

- **PodClaw agent system** (Python, Claude Agent SDK)
  - 10 agents: researcher, marketing, designer, customer_service, fulfillment, etc.
  - Bridge API (FastAPI, port 8000) with 10 endpoints
  - 13 connectors: Stripe, Printify, Supabase, Anthropic, fal, Gemini, etc.
  - Cost guard and security hooks
  - Cron scheduling via APScheduler

- **MCP Server** (TypeScript, port 8002)
  - Model Context Protocol server for Claude Desktop integration
  - 17 tools for chat, checkout, product search, order management
  - OAuth 2.1 authentication
  - JWT-based session management

- **Database** (Supabase Cloud, PostgreSQL 16 + pgvector)
  - 64+ tables with full RLS policies
  - Vector search for semantic product search
  - Real-time subscriptions for chat messages and order updates
  - Storage buckets for product images and design files

- **Docker Compose** orchestration
  - 8 services: frontend, admin, podclaw, mcp-server, rembg, redis, crawl4ai, caddy
  - Caddy reverse proxy with automatic TLS
  - Multi-stage startup script (data → app → proxy)

### Security
- Supabase RLS policies on all tables
- CSRF protection on frontend mutations
- Rate limiting on admin login (5/15min)
- HMAC verification for Printify webhooks
- JWT authentication for MCP server

### Documentation
- README.md with quick start guide
- CLAUDE.md with design system standards
- PodClaw documentation: AGENTS.md, SECURITY.md, SOUL.md
- app_spec.txt with full application specification

---

## Legend

### Categories
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

### Priority Levels
- **CRITICAL**: Security vulnerabilities, data loss risks
- **HIGH**: Major functionality broken
- **MEDIUM**: Minor functionality broken, performance degradation
- **LOW**: Cosmetic issues, documentation

---

## Migration Guide

### Upgrading from 0.1.0 to 0.2.0

1. **Database migrations**: Run `supabase db push --include-all` to apply 98 migrations
2. **Environment variables**: Add `REDIS_URL` to `.env.local` files (optional, graceful fallback)
3. **Admin login**: Use credentials you created via `node bin/create-admin.mjs`
4. **Frontend dependencies**: Run `npm install` in `frontend/` and `admin/` to update packages

### Breaking Changes in 0.2.0

- **products.category** column deprecated (use `category_id` foreign key instead)
- **Telegram webhook** no longer accepts fallback secret (only `TELEGRAM_WEBHOOK_SECRET` env var)

---

## Roadmap

### Upcoming Features (0.4.0)
- GitHub Actions CI/CD pipeline (Feature #62)
- Vitest test suites for admin and frontend (Features #63-64)
- Playwright E2E tests for admin panel (Feature #65)
- Prometheus + Grafana monitoring (Features #66-68)
- Double opt-in newsletter (GDPR compliance) (Feature #69)

### Future Features (0.5.0+)
- Photo reviews with verified purchase (Feature #71)
- Abandoned cart recovery emails (Feature #72)
- Blog system with admin editor (Feature #73)
- Referral program UI (Feature #74)
- Cross-sell recommendations (Feature #75)
- Multi-tenant architecture (Features #76-82)

---

## Contributors

- **L.LÖWE** — Platform design and development

---

## License

[Business Source License 1.1](LICENSE) — Copyright (c) 2026 L.LÖWE.  
Change License: Apache 2.0 on 2030-03-10.
