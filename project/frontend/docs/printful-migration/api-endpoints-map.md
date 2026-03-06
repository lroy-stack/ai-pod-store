# API Endpoints Map — Printify-to-Printful Migration Scope

> **Generated**: 2026-03-02
> **Total routes**: 127 `route.ts` files
> **Printify-coupled**: 10 direct + 3 indirect = 13 endpoints requiring migration work
> **Unaffected**: 114 endpoints (no Printify dependency)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **YES** | Directly calls Printify API — must be rewritten for Printful |
| **INDIRECT** | References Printify data model (IDs, columns) but does not call the API |
| **NO** | Zero Printify dependency — no migration work needed |

---

## Table of Contents

1. [Products](#1-products)
2. [Cart](#2-cart)
3. [Checkout](#3-checkout)
4. [Orders](#4-orders)
5. [Designs](#5-designs)
6. [Webhooks](#6-webhooks)
7. [Cron Jobs](#7-cron-jobs)
8. [Admin](#8-admin)
9. [Auth](#9-auth)
10. [Chat & AI](#10-chat--ai)
11. [Notifications & Messaging](#11-notifications--messaging)
12. [Wishlist](#12-wishlist)
13. [Newsletter](#13-newsletter)
14. [RAG & Search](#14-rag--search)
15. [Storefront & Tenant](#15-storefront--tenant)
16. [Analytics & AB Testing](#16-analytics--ab-testing)
17. [Billing & Subscriptions](#17-billing--subscriptions)
18. [Profile & User](#18-profile--user)
19. [Miscellaneous](#19-miscellaneous)

---

## 1. Products

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/products` | Public | Supabase, Gemini (embeddings) | NO | Product listing with hybrid search (vector + keyword RRF), pagination, category filtering, locale translations, multi-tenant isolation via x-tenant-id header |
| POST | `/api/products` | Auth (tenant admin) | Supabase | NO | Create product for tenant. Enforces plan gates (free tier limit) |
| GET | `/api/products/[id]` | Public | Supabase | **INDIRECT** | Product detail with variants, labels, image indices. Exposes `printifyId` field in response schema — column rename needed |
| GET | `/api/products/trending` | Public | Supabase | NO | Top trending products from `trending_products` materialized view |
| GET | `/api/products/[id]/cross-sell` | Public | Supabase | NO | Cross-sell recommendations via `association_rules` table |
| GET | `/api/products/[id]/social-proof` | Public | Supabase | NO | Views today + orders this week from `product_daily_metrics` |

**Migration notes for Products:**
- `products/[id]` response includes `printifyId` — rename to generic `provider_id` or `printful_id`
- Product listing reads from Supabase (already synced) — no direct Printify calls
- The `product_variants` table stores `printify_variant_id` — schema migration needed

---

## 2. Cart

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/cart` | Auth (user) | Supabase | NO | Get user's cart with items, variants, personalizations |
| POST | `/api/cart` | Auth (user) | Supabase | NO | Add item to cart (product_id, variant_id, quantity, personalization) |
| PATCH | `/api/cart` | Auth (user) | Supabase | NO | Update cart item quantity |
| DELETE | `/api/cart` | Auth (user) | Supabase | NO | Remove item from cart |
| POST | `/api/cart/shipping-estimate` | Auth (user) | Supabase | NO | Shipping cost calculation from `shipping_zones` table |

**Migration notes for Cart:** None — cart operates on local DB only.

---

## 3. Checkout

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| POST | `/api/checkout/create-session` | Auth (user) | **Stripe, Printify**, Supabase | **YES** | Creates Stripe checkout session. For personalized items: loads personalization, gets Printify product, generates PNG overlay, uploads image to Printify (`uploadImageFromBase64`), creates temp Printify product (`createProduct`). For compositions: exports production image, uploads to Printify, creates temp product. Core import: `import { printify } from '@/lib/printify'` |
| POST | `/api/checkout/calculate-tax` | Auth (user) | Stripe Tax API | NO | Tax calculation via Stripe automatic tax |

**Migration notes for Checkout:**
- `create-session` is the **most complex Printify-coupled route**. It handles:
  1. Fetching base product from Printify to get blueprint/provider info
  2. Generating personalized PNG images (text overlay on product template)
  3. Uploading images to Printify via base64
  4. Creating temporary Printify products with custom print areas
  5. Mapping variant IDs between local DB and Printify
- Must be rewritten to use Printful's product creation + image upload APIs
- Personalization and composition flows must be adapted to Printful's template system

---

## 4. Orders

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/orders` | Auth (user) | Supabase | **INDIRECT** | User's order list. DB schema includes `printify_order_id` column |
| GET | `/api/orders/[id]` | Auth (user) | Supabase | **INDIRECT** | Order detail. Exposes `printify_order_id` in response |
| POST | `/api/orders/[id]/cancel` | Auth (user) | Supabase | NO | Request order cancellation (sets status, does not call Printify directly) |
| POST | `/api/orders/[id]/return` | Auth (user) | Supabase | NO | Request return (creates return_requests record) |

**Migration notes for Orders:**
- `printify_order_id` column in `orders` table should be renamed to `provider_order_id` or `printful_order_id`
- No direct Printify API calls from order routes — the order submission happens in the Stripe webhook

---

## 5. Designs

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/designs` | Auth / Public | Supabase | NO | List user's designs or public approved designs |
| POST | `/api/designs` | Auth (user) | Supabase | NO | Save generated design to DB |
| POST | `/api/designs/[id]/create-product` | Auth (cron secret) | **Printify**, Supabase, rembg | **YES** | Design-to-product pipeline: validate design, bg removal via rembg, upload image to Printify (`uploadImage`), create Printify product (`createProduct`), publish (`publishProduct`), call `publishingSucceeded`, save to DB. Validates EU provider via `isEUProvider()` |
| POST | `/api/designs/personalize` | Auth (user) | Supabase | NO | Save text personalization as draft. Printify temp product created later at checkout |
| POST | `/api/designs/mockup` | Auth (user) | Local mockup-generator | NO | Generate product mockup image (local canvas rendering) |
| POST | `/api/designs/preview-text` | Auth (user) | Local canvas | NO | Generate text overlay preview on product template |
| POST | `/api/designs/generate` | Auth (user) | fal.ai | NO | AI design generation via fal.ai |
| POST | `/api/designs/ai-generate` | Auth (user) | fal.ai, Supabase | NO | AI design with orchestration, cost guards, session tracking, credit deduction |
| POST | `/api/designs/ai-generate/refine` | Auth (user) | fal.ai, Supabase | NO | Refine existing AI generation |
| POST | `/api/designs/compose` | Auth (user) | Supabase Storage | NO | Multi-layer design composition, saves preview to storage |
| GET | `/api/designs/estimate` | Auth (user) | Supabase | NO | Design generation cost estimate based on model/size |
| POST | `/api/designs/remove-bg` | Auth (user) | rembg sidecar | NO | Background removal via rembg service |
| GET | `/api/designs/history` | Auth (user) | Supabase | NO | AI generation history for user |
| GET | `/api/designs/personalizations/history` | Auth (user) | Supabase (RLS) | NO | Personalization history for user |

**Migration notes for Designs:**
- `designs/[id]/create-product` is the full product creation pipeline — must be rewritten for Printful
- The `isEUProvider()` validation in `store-config.ts` must be updated with Printful provider IDs
- Blueprint IDs, provider IDs, and print area specs are all Printify-specific

---

## 6. Webhooks

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| POST | `/api/webhooks/printify` | HMAC signature | **Printify**, Supabase, Resend, Stripe | **YES** | Handles ALL Printify webhook events: `order:created`, `order:shipped`, `order:delivered`, `order:cancelled`, `order:failed`, `product:publish:started/succeeded/created/updated/deleted`. Updates order status, sends shipping/delivery emails via Resend, creates user notifications, issues automatic refunds via Stripe for failed orders, syncs product updates |
| POST | `/api/webhooks/stripe` | Stripe signature | **Stripe, Printify**, Supabase, Resend | **YES** | Handles `checkout.session.completed` (creates order record, submits to Printify via `createOrder` + `submitOrderForProduction`, builds Printify address via `buildPrintifyAddress`). Also handles subscription events, invoice failures, chargebacks, credit pack purchases |
| POST | `/api/webhooks/telegram` | Secret token header | Telegram Bot API, PodClaw Bridge, Supabase | NO | Telegram bot commands (admin: status, agents, orders, revenue; customer: browse, search, track) |
| GET/POST | `/api/webhooks/whatsapp` | HMAC signature | WhatsApp Business API, Supabase | NO | WhatsApp webhook verification (GET) and message processing (POST) |
| POST | `/api/webhooks/cache-invalidate` | Bearer token | Supabase | NO | Cache invalidation webhook for CDN/ISR revalidation |

**Migration notes for Webhooks:**
- `webhooks/printify` must be completely replaced with a Printful webhook handler. Printful uses different event names and payload structures
- `webhooks/stripe` contains Printify order submission logic inside `checkout.session.completed` handler — this section must be rewritten to call Printful's order API
- Key functions to replace: `printify.createOrder()`, `printify.submitOrderForProduction()`, `buildPrintifyAddress()`

---

## 7. Cron Jobs

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/cron/sync-printify` | Bearer (CRON_SECRET) | **Printify**, Supabase | **YES** | Full product reconciliation: fetches all Printify products (paginated, max 50/page), syncs to Supabase (create missing, update stale, mark orphans deleted), fixes margins <35%, calls `publishingSucceeded` for stuck products. Uses `acquireLock`/`recordRun` for deduplication |
| GET | `/api/cron/retry-printify-orders` | Bearer (CRON_SECRET) | Stripe (refunds), Supabase | **INDIRECT** | Handles stuck orders (paid but no `printify_order_id`). Auto-refunds after 3 retries or 2h timeout. Auto-refunds `requires_review` orders >24h old. References `printify_order_id` column but does not call Printify API directly |
| GET | `/api/cron/cleanup-temp-products` | Bearer (CRON_SECRET) | **Printify**, Supabase | **YES** | Deletes orphaned Printify temp products (personalizations >24h old, not ordered). Calls `printify.deleteProduct()` |

**Migration notes for Cron Jobs:**
- `sync-printify` is the most critical cron — must be rewritten as `sync-printful` with Printful's product listing API
- `cleanup-temp-products` calls `printify.deleteProduct()` — replace with Printful product deletion
- `retry-printify-orders` only touches the DB column `printify_order_id` — rename column and update queries

---

## 8. Admin

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/admin/orders` | Admin auth | Supabase | NO | Admin order list with pagination, filtering by status/date. Reads `printify_order_id` from DB but does not call Printify |
| GET | `/api/admin/fix-publishing` | Admin auth | **Printify**, Supabase | **YES** | Fixes stuck publishing products by calling `publishingSucceeded` for all products. Lists all Printify products, matches by external ID, triggers publishing completion |
| POST | `/api/admin/seed-branded` | Dev only | **Printify**, Supabase | **YES** | Creates 10 branded products. Full Printify pipeline: upload images, get providers/variants, create products, publish, sync. Blocked in production via `NODE_ENV` check |
| POST | `/api/admin/seed-hats` | Dev only | **Printify**, Supabase | **YES** | Creates 7 hat products. Same full Printify pipeline as seed-branded. Dev-only |
| POST | `/api/admin/designs/moderate` | Admin auth | Supabase | NO | Design moderation (approve/reject) |
| GET | `/api/admin/returns` | Admin auth | Supabase | NO | List return requests with pagination |
| PUT | `/api/admin/returns/[id]` | Admin auth | Stripe (refunds), Supabase | NO | Process return (approve with refund or reject) |
| POST | `/api/admin/alert` | Admin auth | Supabase | NO | Create admin alert/notification |
| GET | `/api/admin/sitemap` | Admin auth | Supabase | NO | Generate sitemap data |
| GET/PUT | `/api/admin/translations` | Admin auth | Supabase | NO | Manage translation overrides |

**Migration notes for Admin:**
- `fix-publishing` is Printify-specific (publishing state machine) — may not be needed with Printful or must be adapted
- `seed-branded` and `seed-hats` are dev tools — rewrite for Printful product creation or deprecate in favor of Printful dashboard
- Admin orders route reads `printify_order_id` — cosmetic rename only

---

## 9. Auth

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| POST | `/api/auth/register` | Public | Supabase Auth | NO | User registration with email verification |
| POST | `/api/auth/login` | Public | Supabase Auth | NO | Email/password login |
| POST | `/api/auth/logout` | Auth (user) | Supabase Auth | NO | Sign out and clear session |
| POST | `/api/auth/forgot-password` | Public | Supabase Auth, Resend | NO | Send password reset email |
| POST | `/api/auth/reset-password` | Public (with token) | Supabase Auth | NO | Reset password with token |
| POST | `/api/auth/verify-email` | Public (with token) | Supabase Auth | NO | Verify email address |
| GET | `/api/auth/session` | Auth (user) | Supabase Auth | NO | Get current session/user info |
| POST | `/api/auth/refresh` | Auth (user) | Supabase Auth | NO | Refresh JWT token |
| POST | `/api/auth/social/[provider]` | Public | Supabase Auth (OAuth) | NO | Social login (Google, GitHub) |

**Migration notes for Auth:** None — fully independent of Printify.

---

## 10. Chat & AI

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| POST | `/api/chat` | Auth (user) | Google Generative AI (Gemini), Supabase, fal.ai | NO | AI chat with tool use: search products, browse catalog, generate designs, add to cart, check order status. Queries Printify-synced data in Supabase but does not call Printify API |

**Migration notes for Chat:** None — reads from Supabase only. Product data schema changes (column renames) will be transparent.

---

## 11. Notifications & Messaging

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/notifications` | Auth (user) | Supabase | NO | List user notifications |
| PATCH | `/api/notifications/[id]` | Auth (user) | Supabase | NO | Mark notification as read |
| POST | `/api/notifications/mark-all-read` | Auth (user) | Supabase | NO | Mark all notifications as read |
| GET | `/api/notifications/unread-count` | Auth (user) | Supabase | NO | Get unread notification count |
| POST | `/api/push/subscribe` | Auth (user) | Supabase | NO | Subscribe to web push notifications |
| POST | `/api/push/send` | Admin auth | Web Push API | NO | Send push notification to subscribers |
| GET | `/api/conversations` | Auth (user) | Supabase | NO | List chat conversations |
| GET | `/api/conversations/[id]` | Auth (user) | Supabase | NO | Get conversation messages |

**Migration notes for Notifications & Messaging:** None.

---

## 12. Wishlist

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/wishlist` | Auth (user) | Supabase | NO | Get user's wishlist items |
| POST | `/api/wishlist` | Auth (user) | Supabase | NO | Add product to wishlist |
| DELETE | `/api/wishlist` | Auth (user) | Supabase | NO | Remove product from wishlist |
| POST | `/api/wishlist/share` | Auth (user) | Supabase | NO | Generate shareable wishlist link |
| GET | `/api/wishlist/shared/[token]` | Public | Supabase | NO | View shared wishlist by token |

**Migration notes for Wishlist:** None.

---

## 13. Newsletter

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| POST | `/api/newsletter/subscribe` | Public | Supabase, Resend | NO | Subscribe to newsletter |
| POST | `/api/newsletter/unsubscribe` | Public (with token) | Supabase | NO | Unsubscribe from newsletter |
| GET | `/api/newsletter/preferences` | Auth (user) | Supabase | NO | Get newsletter preferences |
| PUT | `/api/newsletter/preferences` | Auth (user) | Supabase | NO | Update newsletter preferences |
| POST | `/api/newsletter/send` | Admin auth | Resend, Supabase | NO | Send newsletter to subscribers |
| GET | `/api/newsletter/campaigns` | Admin auth | Supabase | NO | List newsletter campaigns |
| POST | `/api/newsletter/campaigns` | Admin auth | Supabase | NO | Create newsletter campaign |
| GET | `/api/newsletter/campaigns/[id]` | Admin auth | Supabase | NO | Get campaign details |
| PUT | `/api/newsletter/campaigns/[id]` | Admin auth | Supabase | NO | Update campaign |
| DELETE | `/api/newsletter/campaigns/[id]` | Admin auth | Supabase | NO | Delete campaign |
| POST | `/api/newsletter/campaigns/[id]/send` | Admin auth | Resend, Supabase | NO | Send specific campaign |
| GET | `/api/newsletter/stats` | Admin auth | Supabase | NO | Newsletter analytics |

**Migration notes for Newsletter:** None.

---

## 14. RAG & Search

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| POST | `/api/rag/ingest` | Admin auth | Supabase, Gemini (embeddings) | NO | Ingest document into vector store |
| POST | `/api/rag/query` | Auth (user) | Supabase, Gemini (embeddings) | NO | Semantic search over knowledge base |
| GET | `/api/rag/documents` | Admin auth | Supabase | NO | List ingested documents |
| DELETE | `/api/rag/documents/[id]` | Admin auth | Supabase | NO | Delete ingested document |
| POST | `/api/rag/rebuild-index` | Admin auth | Supabase, Gemini | NO | Rebuild vector index |
| GET | `/api/rag/stats` | Admin auth | Supabase | NO | RAG index statistics |
| POST | `/api/rag/embed` | Internal | Gemini (embeddings) | NO | Generate embedding for text |
| POST | `/api/rag/chunk` | Internal | None (local) | NO | Chunk text for ingestion |
| GET | `/api/rag/sources` | Admin auth | Supabase | NO | List RAG sources |
| POST | `/api/rag/sources` | Admin auth | Supabase | NO | Add RAG source |

**Migration notes for RAG & Search:** None — operates on local vector store.

---

## 15. Storefront & Tenant

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/storefront/config` | Public | Supabase | NO | Get storefront configuration (theme, branding, features) |
| GET | `/api/storefront/pages/[slug]` | Public | Supabase | NO | Get CMS page content by slug |
| GET | `/api/storefront/navigation` | Public | Supabase | NO | Get navigation menu structure |
| POST | `/api/tenant-resolve` | Public | Supabase | NO | Resolve tenant from domain/subdomain |
| GET | `/api/tenant/gate` | Auth (user) | Supabase | NO | Check tenant feature gates and plan limits |

**Migration notes for Storefront & Tenant:** None.

---

## 16. Analytics & AB Testing

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| POST | `/api/analytics/event` | Public | Supabase | NO | Track client-side event (page view, click, add to cart, etc.) |
| GET | `/api/analytics/funnel` | Admin auth | Supabase | NO | Funnel analytics (conversion rates by step) |
| POST | `/api/ab-test/assign` | Public | Supabase | NO | Assign user to AB test variant |
| GET | `/api/ab-test/variant` | Public | Supabase | NO | Get user's AB test assignment |
| POST | `/api/ab-test/convert` | Public | Supabase | NO | Record AB test conversion |

**Migration notes for Analytics & AB Testing:** None.

---

## 17. Billing & Subscriptions

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| POST | `/api/billing/portal` | Auth (user) | Stripe (billing portal) | NO | Create Stripe billing portal session |
| POST | `/api/subscription/create` | Auth (user) | Stripe (subscriptions) | NO | Create subscription checkout session |
| GET | `/api/subscription/status` | Auth (user) | Supabase | NO | Get subscription status |
| POST | `/api/subscription/cancel` | Auth (user) | Stripe | NO | Cancel subscription |
| POST | `/api/credits/purchase` | Auth (user) | Stripe | NO | Purchase AI generation credit pack |
| POST | `/api/coupons/validate` | Public | Supabase | NO | Validate discount coupon code |

**Migration notes for Billing & Subscriptions:** None — Stripe-only, no Printify dependency.

---

## 18. Profile & User

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/profile` | Auth (user) | Supabase | NO | Get user profile |
| PUT | `/api/profile` | Auth (user) | Supabase | NO | Update user profile |
| POST | `/api/profile/change-password` | Auth (user) | Supabase Auth | NO | Change password |
| GET | `/api/profile/payment-methods` | Auth (user) | Stripe | NO | List saved payment methods |
| GET | `/api/user/profile` | Auth (user) | Supabase | NO | Alias for profile endpoint |
| GET | `/api/shipping-addresses` | Auth (user) | Supabase | NO | List saved shipping addresses |
| POST | `/api/shipping-addresses` | Auth (user) | Supabase | NO | Add shipping address |

**Migration notes for Profile & User:** None.

---

## 19. Miscellaneous

| Method | Path | Auth | External APIs | Printify-coupled? | Description |
|--------|------|------|---------------|-------------------|-------------|
| GET | `/api/seo/[locale]` | Public | Supabase | NO | SEO metadata for locale |
| GET | `/api/health` | Public | None | NO | Health check endpoint |
| GET | `/api/ping` | Public | None | NO | Simple ping/pong |
| POST | `/api/captcha/verify` | Public | Turnstile (Cloudflare) | NO | Verify CAPTCHA token |
| POST | `/api/consent` | Public | Supabase | NO | Record cookie/privacy consent |
| POST | `/api/referral` | Auth (user) | Supabase | NO | Process referral code |
| GET | `/api/returns/[id]/tracking` | Auth (user) | Supabase | NO | Get return tracking info |
| POST | `/api/reviews` | Auth (user) | Supabase | NO | Submit product review |
| POST | `/api/reviews/upload-photos` | Auth (user) | Supabase Storage | NO | Upload review photos |
| POST | `/api/errors/report` | Public | Supabase | NO | Client error reporting |
| GET | `/api/metrics` | Admin auth | Supabase | NO | System metrics |
| GET | `/api/policies` | Public | Supabase | NO | Legal policies content |
| POST | `/api/session/migrate` | Auth (user) | Supabase | NO | Migrate anonymous session to authenticated |
| GET | `/api/usage/status` | Auth (user) | Supabase | NO | AI generation usage/limits |
| POST | `/api/verify-domain` | Admin auth | DNS lookup | NO | Verify custom domain ownership |
| POST | `/api/verify-schema` | Admin auth | Supabase | NO | Verify DB schema integrity |
| POST | `/api/revalidate/theme` | Internal | Next.js ISR | NO | Revalidate theme cache |
| GET | `/api/translations/cache` | Public | Supabase | NO | Get cached translations |
| POST | `/api/marketing/subscribe` | Public | Supabase | NO | Marketing subscription |
| GET | `/api/marketing/campaigns` | Admin auth | Supabase | NO | List marketing campaigns |
| POST | `/api/telegram/test-webhook` | Admin auth | Telegram Bot API | NO | Test Telegram webhook |
| POST | `/api/telegram/test-message` | Admin auth | Telegram Bot API | NO | Send test Telegram message |

---

## Migration Priority Matrix

### P0 — Critical Path (Order Flow)

These endpoints are in the **checkout-to-fulfillment** pipeline. If they break, no orders can be placed or fulfilled.

| Route | Printify Calls | Migration Complexity |
|-------|---------------|---------------------|
| `POST /api/checkout/create-session` | `getProduct`, `uploadImageFromBase64`, `createProduct` | **HIGH** — personalization + composition pipelines create temp products |
| `POST /api/webhooks/stripe` | `createOrder`, `submitOrderForProduction`, `buildPrintifyAddress` | **HIGH** — order submission + address mapping |
| `POST /api/webhooks/printify` | Receives events, triggers Supabase updates + emails | **HIGH** — must be replaced with Printful webhook handler |
| `GET /api/cron/sync-printify` | `listProducts` (paginated), `publishingSucceeded` | **HIGH** — full product catalog sync |

### P1 — Product Management

| Route | Printify Calls | Migration Complexity |
|-------|---------------|---------------------|
| `POST /api/designs/[id]/create-product` | `uploadImage`, `createProduct`, `publishProduct`, `publishingSucceeded` | **HIGH** — full product creation pipeline |
| `GET /api/cron/cleanup-temp-products` | `deleteProduct` | **LOW** — single API call replacement |

### P2 — Admin Tools

| Route | Printify Calls | Migration Complexity |
|-------|---------------|---------------------|
| `GET /api/admin/fix-publishing` | `listProducts`, `publishingSucceeded` | **MEDIUM** — Printful may not have equivalent publishing state |
| `POST /api/admin/seed-branded` | Full pipeline (upload, create, publish, sync) | **MEDIUM** — dev tool, could use Printful dashboard instead |
| `POST /api/admin/seed-hats` | Full pipeline (upload, create, publish, sync) | **MEDIUM** — dev tool, could use Printful dashboard instead |

### P3 — Data Model (Schema Only)

| Route | Change Required | Migration Complexity |
|-------|----------------|---------------------|
| `GET /api/products/[id]` | Rename `printifyId` in response | **LOW** |
| `GET /api/orders` | Rename `printify_order_id` column | **LOW** |
| `GET /api/orders/[id]` | Rename `printify_order_id` column | **LOW** |
| `GET /api/cron/retry-printify-orders` | Rename column references | **LOW** |

---

## Shared Libraries Requiring Migration

These files are imported by the Printify-coupled routes and contain the core Printify integration logic:

| File | Description | Coupled Routes |
|------|-------------|---------------|
| `src/lib/printify.ts` | PrintifyClient class — all API methods (list, create, publish, upload, order, delete) | All P0/P1/P2 routes |
| `src/lib/printify-sync.ts` | Sync logic — product reconciliation, variant mapping, margin fixing, HTML stripping | `cron/sync-printify`, `webhooks/printify` |
| `src/lib/print-areas.ts` | Print area dimensions and position configs per blueprint | `checkout/create-session`, `designs/[id]/create-product`, `admin/seed-*` |
| `src/lib/mockup-generator.ts` | Mockup image generation (local) — references Printify image URLs | `designs/mockup` |
| `src/lib/store-config.ts` | `isEUProvider()` function with Printify provider IDs | `designs/[id]/create-product` |
| `src/lib/stripe-checkout.ts` | Stripe session creation — contains Printify product references | `checkout/create-session` |

---

## Database Tables with Printify References

| Table | Columns | Notes |
|-------|---------|-------|
| `products` | `printify_id`, `blueprint_id`, `print_provider_id` | Core product table — all three columns are Printify-specific |
| `product_variants` | `printify_variant_id`, `image_url` (from Printify sync) | Variant mapping — IDs must be remapped to Printful |
| `orders` | `printify_order_id` | Order tracking — rename to `provider_order_id` |
| `personalizations` | `temp_printify_product_id` | Temp product reference — rename to `temp_provider_product_id` |
| `design_compositions` | `printify_product_id` | Composition product reference |
| `cron_runs` | `job_name = 'sync-printify'` | Cron tracking — rename job |
| `cron_locks` | `job_name = 'sync-printify'` | Cron locking — rename job |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Total API routes | 127 |
| Printify-coupled (direct) | 10 |
| Printify-coupled (indirect/schema) | 3 |
| Stripe-dependent (no Printify) | 7 |
| Supabase-only | 95 |
| External AI (fal.ai, Gemini) | 6 |
| Messaging (Telegram, WhatsApp) | 3 |
| No external deps | 3 |
