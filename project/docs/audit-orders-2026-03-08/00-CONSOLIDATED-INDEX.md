# Consolidated Audit Index -- Order/Payment/Fulfillment System

**Date**: 2026-03-08
**Reports consolidated**: 5 (Order Lifecycle, Printful Sync & Inventory, Checkout & Payment, Product Availability UX, Multi-Tenancy & User Management)

---

## 1. Executive Summary

The order/payment/fulfillment system has a **mature core pipeline** -- the path from cart to Stripe payment to POD submission to delivery is well-engineered with idempotent order creation, atomic refunds (RefundGuard), server-side price authority, proper state machine enforcement, and a comprehensive provider-agnostic POD abstraction layer. Webhook handling for Stripe and Printful is robust, with audit logging, localized email notifications (EN/ES/DE), and in-app notifications at each lifecycle stage. The product detail page implements an excellent Amazon-style cross-filtered variant selector with real-time unavailable combination dimming.

However, the system has **critical schema and data integrity gaps** that will cause silent failures in production. The database CHECK constraint on `orders.status` is missing two statuses (`requires_review`, `failed`) that the application actively uses -- any attempt to set these will be rejected by PostgreSQL, silently breaking the retry and failure recovery flows. There are duplicate return tables (`return_requests` vs `returns`) with incompatible schemas, and duplicate retry columns (`retry_count` vs `pod_retry_count`) that diverge. The `charge.refunded` Stripe webhook is unhandled, meaning dashboard-initiated refunds will never update order status. The `DynamicPriceStock` component hardcodes `inStock = true` (though it is currently unused). ISR cache staleness of up to 1 hour means users can see "In Stock" for unavailable variants.

The **multi-tenancy layer is non-functional** and represents the single largest risk. The `get_current_tenant_id()` SQL function always returns NULL, making all tenant-aware RLS policies pass-through. Only 7 of 80+ API routes filter by `tenant_id`. All admin routes are globally scoped with no tenant boundaries. The production database contains 22 test users out of 25 total. While the system currently operates as single-tenant (only one tenant has data), adding a second tenant would cause immediate cross-tenant data leakage across 73+ routes. A strategic decision on whether to pursue or abandon multi-tenancy must be made before production launch.

**Overall production readiness: NOT READY** -- 8 CRITICAL findings, 13 HIGH findings, and 13 MEDIUM findings must be addressed. The core single-tenant order flow could ship after resolving the CRITICAL schema mismatch (C1) and missing webhook handler (C5), but multi-tenancy requires fundamental redesign.

---

## 2. Critical Findings Matrix

| ID | Severity | Area | Finding | File(s) | Effort |
|---|---|---|---|---|---|
| C1 | CRITICAL | Order Lifecycle | Database CHECK constraint on `orders.status` is missing `requires_review` and `failed` statuses that the application actively uses. Any write of these statuses will be silently rejected by PostgreSQL. | `supabase/migrations/20260213000000_initial_schema.sql:112` | S |
| C2 | CRITICAL | Multi-Tenancy | `get_current_tenant_id()` SQL function **always returns NULL** because no JWT `app_metadata.tenant_id` claim or GUC setting is ever populated. All 3 tenant-aware RLS policies become pass-through. | `get_current_tenant_id()` function, RLS policies on `products`, `orders`, `conversations` | L |
| C3 | CRITICAL | Multi-Tenancy | 73 out of 80+ API routes have **zero tenant filtering**. Only 7 routes conditionally filter by `x-tenant-id` header. Adding a second tenant causes immediate cross-tenant data leakage. | All API routes in `frontend/src/app/api/` | L |
| C4 | CRITICAL | Multi-Tenancy | Admin routes (`/api/admin/orders`, `/api/admin/returns`, etc.) are **globally scoped** -- any admin can see and manage ALL tenants' data. No concept of tenant-admin exists. | `frontend/src/app/api/admin/*` | L |
| C5 | CRITICAL | Checkout | Missing `charge.refunded` Stripe webhook handler. Refunds issued via Stripe Dashboard never update order status in Supabase -- orders remain `paid`/`submitted` indefinitely. | `frontend/src/app/api/webhooks/stripe/route.ts` | S |
| C6 | CRITICAL | Checkout | Coupon `times_used` counter is not idempotent -- increments on every webhook delivery without checking if already counted for this session. Stripe retries cause over-counting, prematurely exhausting coupon limits. | `frontend/src/lib/webhooks/stripe/checkout-completed.ts:224-244` | S |
| C7 | CRITICAL | Checkout | Dispute handler sets `status = 'cancelled'` instead of `'disputed'`. No way to distinguish voluntary cancellations from chargebacks. The `disputed` status does not exist in the CHECK constraint. | `frontend/src/lib/webhooks/stripe/dispute-handlers.ts:47` | S |
| C8 | CRITICAL | Printful Sync | `DynamicPriceStock` component always returns `inStock = true` (hardcoded). Currently unused in production but a latent risk if ever imported. | `frontend/src/components/products/DynamicPriceStock.tsx:21` | S |
| H1 | HIGH | Order Lifecycle | Two separate return tables (`return_requests` and `returns`) with different column names, status enums, and RLS policies. API uses `return_requests` but zombie-reaper queries `returns`. Customer-created returns are never monitored by cron jobs. | `return_requests` table, `returns` table, `zombie-reaper/route.ts` | M |
| H2 | HIGH | Order Lifecycle | Duplicate retry columns: `retry_count` (used by zombie-reaper) and `pod_retry_count` (used by checkout-completed). These diverge silently, causing incorrect retry/refund decisions. | `orders` table columns, `zombie-reaper/route.ts`, `checkout-completed.ts` | S |
| H3 | HIGH | Order Lifecycle | Zombie-reaper selects `total_price_cents` from orders but actual column is `total_cents`. Auto-refund passes `undefined` as refund amount. | `frontend/src/app/api/cron/zombie-reaper/route.ts:76` | S |
| H4 | HIGH | Printful Sync | Retry cron does NOT actually re-submit orders to Printful -- it only marks for review or auto-refunds. Revenue lost when Printful was temporarily down since orders are never retried. | `frontend/src/app/api/cron/retry-printify-orders/route.ts` | M |
| H5 | HIGH | Printful Sync | `costCents` is always `null` from Printful mapper. Margin auditor cannot calculate real margins; `calculateEngagementPrice()` fallback may set inaccurate prices. | `frontend/src/lib/pod/printful/mapper.ts:58` | M |
| H6 | HIGH | Printful Sync | `package_returned` Printful event mapped to `order.cancelled`. A returned package (carrier failed delivery) triggers cancellation + automatic refund instead of re-shipping or separate handling. | `frontend/src/lib/pod/printful/constants.ts:28` | S |
| H7 | HIGH | Printful Sync | No dead letter queue for failed webhook processing. The route always returns 200 after signature verification; if the handler throws, the event is lost forever. | `frontend/src/app/api/webhooks/pod/[provider]/route.ts:140-141` | M |
| H8 | HIGH | Printful Sync | In-memory rate limiter not shared across serverless instances. Each cold-start gets its own bucket; actual Printful API call rate may exceed 120/min across instances. | `frontend/src/lib/pod/printful/client.ts:82-93` | M |
| H9 | HIGH | Checkout | No cart item count limit. An attacker can add thousands of distinct products, causing expensive DB queries and potential Stripe metadata size overflow (500 chars/key limit). | `frontend/src/app/api/cart/route.ts` | S |
| H10 | HIGH | Checkout | Cart API uses `supabaseAdmin` (service-role, bypasses RLS). Ownership filtering is manual via code -- a missing filter in future code changes could expose all cart items. | `frontend/src/app/api/cart/route.ts:23` | M |
| H11 | HIGH | Multi-Tenancy | Registration always assigns users to hardcoded default tenant. No mechanism to register for a specific tenant even when accessed via custom domain. | `frontend/src/app/api/auth/register/route.ts` | S |
| H12 | HIGH | Multi-Tenancy | 22 out of 25 users in production database are test accounts. Production data contaminated with test emails, fake subscriptions, and test admin accounts. | `users` table | S |
| H13 | HIGH | Multi-Tenancy | `/api/admin/seed-branded` and `/api/admin/seed-hats` routes appear to lack authentication checks. Anyone can invoke them to seed product data. | `frontend/src/app/api/admin/seed-branded/route.ts`, `seed-hats/route.ts` | S |
| M1 | MEDIUM | Order Lifecycle | Coupon usage uses SELECT + UPDATE (not atomic). Concurrent checkouts with same coupon can increment incorrectly. | `frontend/src/lib/webhooks/stripe/checkout-completed.ts:233-244` | S |
| M2 | MEDIUM | Order Lifecycle | Dispute handler uses `cancelled` status but code TODO says `disputed` status needed. No migration exists. | `frontend/src/lib/webhooks/stripe/dispute-handlers.ts:47` | S |
| M3 | MEDIUM | Printful Sync | 10-minute catalog cache is per-instance (in-memory). On serverless, cache is rarely warm; each instance makes redundant catalog API calls. | `frontend/src/lib/pod/printful/client.ts:148-150` | M |
| M4 | MEDIUM | Printful Sync | Sync cron has 1000-product ceiling (10 pages x 100). Products beyond this limit are never synced. | `frontend/src/app/api/cron/sync-printify/route.ts:92` | S |
| M5 | MEDIUM | Printful Sync | Unknown webhook event types silently fall back to `product.updated`, triggering unnecessary full product re-syncs. | `frontend/src/lib/pod/printful/mapper.ts:286` | S |
| M6 | MEDIUM | Printful Sync | No webhook replay/idempotency key storage. Duplicate Printful webhook deliveries cannot be detected. | `frontend/src/app/api/webhooks/pod/[provider]/route.ts` | M |
| M7 | MEDIUM | Checkout | Tax calculation fallback uses hardcoded US state tax rates (7% default) for an EU-focused store selling in EUR. | `frontend/src/lib/stripe.ts:127-136` | S |
| M8 | MEDIUM | Checkout | Guest email validated client-side only. Server passes unvalidated email directly to Stripe. | `frontend/src/components/checkout/CheckoutView.tsx:206-208` | S |
| M9 | MEDIUM | Checkout | No inventory locking between variant validation (session creation) and payment completion. Variant could become unavailable during payment. | `frontend/src/app/api/checkout/create-session/route.ts` | M |
| M10 | MEDIUM | Product Availability | ISR revalidation is 1 hour for PDP, 5 min for shop. Stock webhook changes are not reflected until cache expires. No on-demand revalidation from stock webhooks. | `shop/[id]/page.tsx`, `stock-updated.ts` | M |
| M11 | MEDIUM | Product Availability | QuickViewModal does not check availability -- all variants appear equally selectable, no `inStock` check on CTA. Server rejects at cart API but UX is poor. | `frontend/src/components/products/QuickViewModal.tsx` | S |
| M12 | MEDIUM | Product Availability | Cart GET does not check variant-level `is_available` -- only checks product status. Items with unavailable variants appear valid until checkout 409. | `frontend/src/hooks/useCart.tsx`, `frontend/src/app/api/cart/route.ts` | S |
| M13 | MEDIUM | Multi-Tenancy | `viewer@podstore.local` has `role=admin`. Test account with elevated privileges that should be read-only. | `users` table | S |

---

## 3. Architecture Decisions Required

### Decision 1: Multi-Tenancy Strategy

The system has multi-tenant scaffolding that is **non-functional**. Before any fixes, a strategic decision is needed:

- **Option A: Abandon multi-tenancy** -- Operate as single-tenant Skapara store. Remove `tenant_id` columns and related complexity. Simplest path to production. Recommended if no marketplace/platform plans exist.
- **Option B: Fix multi-tenancy properly** -- Populate JWT `app_metadata.tenant_id` during login/registration. Add tenant filtering to all 73+ routes. Add `tenant_id` to 87 missing tables. Implement tenant-scoped admin. Estimated effort: 4-6 weeks.
- **Option C: Database-per-tenant** -- Most secure isolation but operationally complex. Not recommended for current scale.

**This decision blocks**: C2, C3, C4, H11, H12, and 6 additional multi-tenancy findings.

### Decision 2: Return System Consolidation

Two separate return tables exist (`return_requests` and `returns`) with incompatible schemas. Must decide:

- **Option A**: Keep `return_requests` (used by API), drop `returns` table, update zombie-reaper to query `return_requests`.
- **Option B**: Migrate to `returns` table (has richer status machine), update API to use it, drop `return_requests`.

**This decision blocks**: H1.

### Decision 3: Retry Column Consolidation

Two sets of retry columns exist (`retry_count` vs `pod_retry_count`). Must decide which to standardize on and migrate the other's references.

**This decision blocks**: H2.

### Decision 4: RLS Strategy

Currently 76+ routes bypass RLS via service-role key. Options:

- **Keep service-role** (current): Simpler, faster queries, but RLS provides no defense-in-depth.
- **Switch to user-scoped clients** for user-facing routes: Adds RLS as a safety net, requires fixing all tenant-aware policies.

---

## 4. Recommended Fix Order

### Phase 1: Security Blockers (Must fix before production)

| ID | Finding | Effort |
|---|---|---|
| C1 | Add `requires_review` and `failed` to orders status CHECK constraint (migration) | S |
| C5 | Add `charge.refunded` Stripe webhook handler | S |
| C6 | Make coupon usage counter idempotent (UNIQUE constraint on coupon_id + order_id) | S |
| C7 | Add `disputed` status to orders CHECK constraint + update dispute handler | S |
| H3 | Fix zombie-reaper `total_price_cents` -> `total_cents` column reference | S |
| H13 | Add `requireAdmin()` to seed routes or remove them | S |
| H12 | Purge 22 test users from production database | S |

### Phase 2: Data Integrity (Prevents data loss/corruption)

| ID | Finding | Effort |
|---|---|---|
| H1 | Consolidate duplicate return tables (requires architecture decision) | M |
| H2 | Consolidate duplicate retry columns (requires architecture decision) | S |
| H4 | Add actual Printful re-submission logic to retry cron | M |
| H5 | Populate `costCents` from Printful catalog pricing endpoint during sync | M |
| H6 | Differentiate `package_returned` from `order_canceled` -- separate handling path | S |
| H7 | Implement dead letter queue for failed webhook events (Redis or Supabase table) | M |
| M1 | Make coupon usage atomic (RPC or raw SQL increment) | S |
| M6 | Add webhook idempotency key storage to `processed_events` table | M |

### Phase 3: UX & Operational (Improves user experience)

| ID | Finding | Effort |
|---|---|---|
| H9 | Add cart item count limit (e.g., 50 distinct items) | S |
| M7 | Fix tax fallback to use EU VAT rates instead of US state rates | S |
| M8 | Add server-side guest email validation | S |
| M10 | Trigger on-demand ISR revalidation from stock webhooks + invalidate Redis cache | M |
| M11 | Fix QuickViewModal: disable CTA when out of stock, pass availability to VariantSelector | S |
| M12 | Cart GET: check variant-level `is_available`, not just product status | S |
| H8 | Move rate limiter to Redis for shared state across serverless instances | M |
| M3 | Move catalog cache to Redis for shared state | M |

### Phase 4: Nice-to-Have (Can ship without)

| ID | Finding | Effort |
|---|---|---|
| C8 | Remove or connect `DynamicPriceStock` component (currently unused) | S |
| M2 | Add `disputed` columns to orders table (stripe_dispute_id, reason, amount) | S |
| M4 | Raise sync cron product ceiling beyond 1000 | S |
| M5 | Handle unknown webhook events gracefully instead of defaulting to `product.updated` | S |
| M9 | Consider variant reservation/lock between validation and payment | M |
| M13 | Fix `viewer@podstore.local` role from admin to customer | S |
| H10 | Evaluate switching cart API from supabaseAdmin to user-scoped client | M |
| C2-C4, H11 | Multi-tenancy fixes (deferred pending architecture decision) | L |

---

## 5. Report Index

### [01-ORDER-LIFECYCLE.md](./01-ORDER-LIFECYCLE.md)
Complete audit of the order database schema (9 tables), status state machine, creation flow (cart -> Stripe -> order -> POD), fulfillment webhooks, returns/refunds system, and 5 cron jobs. Key finding: the orders CHECK constraint is missing two statuses the application uses, and there are duplicate return tables and retry columns that cause silent divergence.

### [02-PRINTFUL-SYNC-INVENTORY.md](./02-PRINTFUL-SYNC-INVENTORY.md)
Deep dive into the Printful API integration, product sync engine (cron + webhooks), inventory/stock management, order submission flow, and reliability infrastructure. Scored 7/10 overall. Key findings: the retry cron never actually re-submits orders, cost data is always null from the mapper, and the in-memory rate limiter does not work across serverless instances.

### [03-CHECKOUT-PAYMENT-FLOW.md](./03-CHECKOUT-PAYMENT-FLOW.md)
End-to-end audit of the cart system, checkout session creation, Stripe integration (8 handled event types), subscription/credits system, payment methods management, coupon system, and security controls (CSRF, rate limiting, price authority). Key findings: the `charge.refunded` webhook is unhandled, coupon usage is not idempotent, and the dispute handler uses the wrong status.

### [04-PRODUCT-AVAILABILITY-UX.md](./04-PRODUCT-AVAILABILITY-UX.md)
Frontend-focused audit of product display, variant selection UX, availability validation chain (4 layers), and edge cases. The PDP cross-filter selector is rated EXCELLENT. Key findings: QuickViewModal ignores availability entirely, ISR cache can serve stale stock data for up to 1 hour, and the cart does not check variant-level availability on load.

### [05-MULTI-TENANCY-USER-MANAGEMENT.md](./05-MULTI-TENANCY-USER-MANAGEMENT.md)
Comprehensive analysis of tenant architecture, isolation mechanisms, user management, session management, admin access control, and RLS effectiveness. Scored 34/110 (FAIL). Key findings: the tenant isolation function always returns NULL, only 7 of 80+ routes filter by tenant, admin access is globally scoped, and 22 of 25 database users are test accounts. The system must NOT be operated as multi-tenant without fundamental redesign.
