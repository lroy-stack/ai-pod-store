# Consolidated Gap Analysis & Priority Matrix

**Date**: 2026-03-04
**Sources**: 4 specialist audit documents (DB schema, Backend API, Frontend UX, Cart-to-Delivery lifecycle)
**Cross-validated against**: Codebase grep/read verification

---

## Priority Tiers

- **P0 (BLOCKER)**: Security vulnerabilities or broken functionality that prevents production launch
- **P1 (CRITICAL)**: Missing core features or data integrity risks for production e-commerce
- **P2 (HIGH)**: Important UX gaps or architectural debt affecting reliability
- **P3 (MEDIUM)**: Improvements for scalability, maintainability, or polish

---

## P0 — Production Blockers (Security / Broken)

### P0-1: Return Request API has ZERO authentication
**Sources**: Backend API audit (Section 4.5), Lifecycle audit (Phase 6)
**File**: `src/app/api/orders/[id]/returns/route.ts:22-118`
**Issue**: `POST /api/orders/[id]/returns` and `GET /api/orders/[id]/returns` have no auth check. Anyone with a valid order UUID can create a return request for the full order amount.
**Impact**: Financial loss — attackers can trigger refund requests for any order.
**Fix**: Add `requireAuth()` + ownership check (`order.user_id === user.id`).
**Effort**: Small (< 1 hour)

### P0-2: Cart PATCH missing ownership verification
**Sources**: Backend API audit (Section 2.3), Lifecycle audit (Phase 1)
**File**: `src/app/api/cart/route.ts:442-583`
**Issue**: PATCH handler updates cart items by `item_id` using `supabaseAdmin` (RLS bypass) without verifying the item belongs to the requesting user/session.
**Impact**: Any user who knows a cart item UUID could modify another user's cart.
**Fix**: Fetch item first, verify `user_id` or `session_id` matches before update.
**Effort**: Small

### P0-3: Checkout cancel page returns 404
**Sources**: Lifecycle audit (Phase 2), Frontend audit (checkout)
**File**: Missing `src/app/[locale]/(focused)/checkout/cancel/page.tsx`
**Issue**: Stripe's `cancel_url` points to `/{locale}/checkout/cancel` but no page exists. Users who cancel payment at Stripe see a 404.
**Impact**: Broken UX for every cancelled checkout — user cannot return to store.
**Fix**: Create simple page that redirects to cart with "Payment cancelled" toast.
**Effort**: Small

### P0-4: `tenant_configs` and `admin_settings` have NO RLS
**Sources**: DB audit (Section 1.4, 1.8)
**Tables**: `tenant_configs`, `admin_settings`
**Issue**: Any authenticated user can read all tenant configurations and global admin settings via the anon Supabase client.
**Impact**: Cross-tenant data exposure, admin settings leak.
**Fix**: Enable RLS + add appropriate policies.
**Effort**: Small (migration)

---

## P1 — Critical for Production E-Commerce

### P1-1: No user-facing returns UI page
**Sources**: Lifecycle audit (Phase 6), Frontend audit (Section 3)
**Issue**: Return request API exists but there is NO frontend page for customers to initiate returns. The order detail page has a return request dialog but it connects to the unauthenticated API.
**Impact**: Customers cannot request returns through the UI — only via direct API calls.
**Fix**: Create returns section in order detail page with proper auth flow.
**Effort**: Medium

### P1-2: Guest-to-auth cart merge missing
**Sources**: Lifecycle audit (Phase 1), Frontend audit (cart)
**File**: `src/hooks/useCart.tsx`, `src/app/api/cart/route.ts`
**Issue**: When a guest logs in, their `session_id`-based cart items are orphaned. No merge logic exists.
**Impact**: Customers lose their cart items after registering/logging in.
**Fix**: POST `/api/cart/merge` endpoint + call on login success. Transfer `session_id` items to `user_id`.
**Effort**: Medium

### P1-3: Hardcoded default tenant_id in ALL data tables
**Sources**: DB audit (Section 1.5)
**Tables**: users, products, orders, cart_items, categories, conversations, designs, wishlists, analytics_events (9 tables)
**Issue**: All default to `f1c548a3-...` (primary tenant). The `handle_new_user()` trigger does NOT set `tenant_id` based on registration domain.
**Impact**: New tenants' users silently end up in the wrong tenant. Complete multi-tenancy breakdown.
**Fix**: (1) Remove hardcoded defaults, (2) Modify `handle_new_user()` to read tenant from JWT metadata, (3) Add NOT NULL constraint without default to force explicit tenant_id on INSERT.
**Effort**: Large (migration + trigger + all INSERT code paths)

### P1-4: Missing index on `order_items.order_id`
**Sources**: DB audit (Section 3.2, 4.3)
**Table**: `order_items`
**Issue**: No index on `order_id`. Every order detail page, invoice, and reorder operation requires sequential scan.
**Impact**: Performance degrades linearly with order volume.
**Fix**: `CREATE INDEX idx_order_items_order_id ON order_items(order_id);`
**Effort**: Small (migration)

### P1-5: Two competing returns tables
**Sources**: DB audit (Section 3.4, 3.5)
**Tables**: `return_requests` (2 rows, 18 columns) vs `returns` (0 rows, 12 columns)
**Issue**: Both exist with overlapping schemas and different status enums. API routes use `return_requests`. RLS policies exist on both.
**Impact**: Confusion, potential data split, inconsistent behavior.
**Fix**: Consolidate to `return_requests` (has data). Drop or deprecate `returns`. Update RLS.
**Effort**: Medium

### P1-6: 533 product variants (28.6%) missing `cost_cents`
**Sources**: DB audit (Section 5.4)
**Table**: `product_variants`
**Issue**: Missing cost data breaks margin calculations, pricing sync, and profitability reporting.
**Impact**: Cannot accurately calculate margins for ~30% of catalog.
**Fix**: Backfill from Printify/Printful API. Add NOT NULL constraint after backfill.
**Effort**: Medium (script + migration)

### P1-7: Returns only support full refund
**Sources**: Lifecycle audit (Phase 6), Backend audit (Section 4.5)
**File**: `src/app/api/orders/[id]/returns/route.ts:82-93`
**Issue**: `refund_amount_cents` is hardcoded to `order.total_cents`. No partial refund support for multi-item orders.
**Impact**: Cannot return individual items — must refund entire order.
**Fix**: Accept item-level return requests, calculate partial refund.
**Effort**: Medium-Large

---

## P2 — High Priority Improvements

### P2-1: Guest orders accessible to any authenticated user
**Sources**: Backend API audit (Section 4.2)
**File**: `src/app/api/orders/[id]/route.ts:46-51`
**Issue**: Ownership check is `order.user_id && order.user_id !== user.id`. If `user_id` is null (guest order), check is skipped.
**Fix**: Deny access unless user is admin or order.user_id matches.

### P2-2: Billing portal return URL hardcoded to English locale
**Sources**: Profile audit v1 (Section: Security Issues)
**File**: `src/app/api/billing/portal/route.ts:49`
**Fix**: Extract locale from user profile or request.

### P2-3: Duplicate returns tables RLS mismatch
**Sources**: DB audit (Section 1.8)
**Issue**: `return_requests` has 4 RLS policies, `returns` has 5. Different column names (`user_id` vs `customer_id`). Different status enums.
**Fix**: Consolidate (see P1-5).

### P2-4: No cross-tab cart sync
**Sources**: Frontend audit (Section 7)
**Issue**: `useAuth` uses localStorage events for cross-tab sync, but `useCart` does not. Cart changes in one tab are invisible in another.
**Fix**: Add localStorage event listener in CartProvider for invalidation.

### P2-5: Missing `charge.dispute.closed` webhook handler
**Sources**: Lifecycle audit (Phase 3)
**File**: `src/app/api/webhooks/stripe/route.ts`
**Issue**: Only `charge.dispute.created` is handled. Won disputes leave orders as `cancelled`.
**Fix**: Add handler to restore order status on `status: won`.

### P2-6: Review verified-purchase check uses wrong query
**Sources**: Lifecycle audit (Phase 7)
**File**: `src/app/api/reviews/route.ts`
**Issue**: Purchase verification query is broken — uses wrong column/join, allowing unverified reviews or blocking legitimate ones.
**Fix**: Fix the query to properly check order_items for matching product_id + user_id.

### P2-7: 18 tables lack tenant_id (indirect isolation only)
**Sources**: DB audit (Section 1.6)
**Tables**: order_items, product_variants, shipping_addresses, return_requests, returns, notifications, coupons, personalizations, product_reviews, credit_transactions, abandoned_carts, product_labels, referrals, newsletter_subscribers, push_subscriptions, user_consents, drip_queue, blog_posts
**Issue**: Most rely on FK-based indirect isolation. `coupons`, `newsletter_subscribers`, `blog_posts`, `shipping_zones` have NO isolation.
**Fix**: Phase approach — add tenant_id to globally-shared tables first.

### P2-8: Stripe Tax not enabled (EU VAT compliance)
**Sources**: Lifecycle audit (Phase 2)
**File**: `src/app/api/checkout/create-session/route.ts:658`
**Issue**: `automatic_tax: { enabled: false }`. EU sales require proper VAT handling.
**Fix**: Enable Stripe Tax, configure tax registrations.

---

## P3 — Medium Priority

### P3-1: No PDF invoice generation
**Sources**: Lifecycle audit (Phase 7), Frontend audit (orders)
**Issue**: Invoice endpoint returns JSON data. No PDF generation or Stripe hosted invoice URL.

### P3-2: No guest cart expiration cleanup
**Sources**: Lifecycle audit (Phase 1)
**Issue**: Guest carts (session_id-based) persist indefinitely. No cron to clean up.

### P3-3: Missing tenant_id indexes on orders and products
**Sources**: DB audit (Section 3.1)
**Fix**: Add composite indexes `(tenant_id, created_at DESC)`.

### P3-4: ShippingAddressList uses window.confirm instead of AlertDialog
**Sources**: Frontend audit (Section 2.4)
**Fix**: Replace with shadcn AlertDialog for consistency.

### P3-5: No express shipping option in Stripe checkout
**Sources**: Lifecycle audit (Phase 2)
**Issue**: `SHIPPING_RATES` defines express rates but only standard shipping sent to Stripe.

### P3-6: `useAuth` is not a Context (redundant API calls)
**Sources**: Frontend audit (Section 7)
**Issue**: Each component using useAuth makes its own `/api/auth/session` call. Not a shared provider.

### P3-7: Notifications page not in (app) route group
**Sources**: Profile audit v1
**File**: `src/app/[locale]/profile/notifications/page.tsx`
**Issue**: Outside `(app)` group, may not be auth-protected by middleware.

### P3-8: Guest orders not linked to future registrations
**Sources**: Lifecycle audit (Phase 3)
**Issue**: Past guest orders (by email) are not automatically linked when user registers.

### P3-9: Duplicate webhook processing risk (legacy + unified)
**Sources**: Lifecycle audit (Phase 4)
**Issue**: Both `/api/webhooks/printify` and `/api/webhooks/pod/printify` are active. If both registered, events are double-processed.

### P3-10: change-password creates second session via signInWithPassword
**Sources**: Profile audit v1 (Section: Security Issues)
**File**: `src/app/api/profile/change-password/route.ts:76-79`
**Issue**: Session leak risk.

---

## Implementation Order Recommendation

### Sprint 1: Security Fixes (P0)
1. P0-1: Auth on returns API (~30 min)
2. P0-2: Cart PATCH ownership check (~30 min)
3. P0-3: Checkout cancel page (~30 min)
4. P0-4: RLS on tenant_configs + admin_settings (~30 min)

### Sprint 2: Core E-Commerce Gaps (P1)
5. P1-4: order_items.order_id index (migration)
6. P1-1: User-facing returns UI page
7. P1-2: Guest-to-auth cart merge
8. P1-5: Consolidate returns tables
9. P1-6: Backfill variant cost_cents

### Sprint 3: Reliability & Compliance (P2)
10. P2-1: Guest order access fix
11. P2-5: Dispute closed webhook
12. P2-6: Fix review purchase verification
13. P2-8: Enable Stripe Tax (EU VAT)
14. P2-4: Cross-tab cart sync

### Sprint 4: Multi-Tenancy Hardening (P1-3 + P2-7)
15. P1-3: Remove hardcoded tenant defaults
16. P2-7: Add tenant_id to shared tables
17. Tenant-aware trigger for handle_new_user()

---

## Files Reference (All Gaps)

| File | Gaps |
|------|------|
| `src/app/api/orders/[id]/returns/route.ts` | P0-1, P1-7 |
| `src/app/api/cart/route.ts` | P0-2 |
| `src/app/[locale]/(focused)/checkout/cancel/page.tsx` | P0-3 (missing) |
| `supabase/migrations/` | P0-4, P1-4, P1-5, P2-7, P3-3 |
| `src/app/api/orders/[id]/route.ts` | P2-1 |
| `src/app/api/billing/portal/route.ts` | P2-2 |
| `src/app/api/webhooks/stripe/route.ts` | P2-5 |
| `src/app/api/reviews/route.ts` | P2-6 |
| `src/app/api/checkout/create-session/route.ts` | P2-8 |
| `src/hooks/useCart.tsx` | P1-2, P2-4 |
| `src/app/api/profile/change-password/route.ts` | P3-10 |
| `src/app/[locale]/profile/notifications/page.tsx` | P3-7 |
