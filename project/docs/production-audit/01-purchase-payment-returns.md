# Production Audit: Purchase → Payment → Order → Shipping → Return Pipeline

**Date**: 2026-03-06
**Auditor**: Claude Sonnet 4.6 (automated deep-read audit)
**Scope**: Full purchase lifecycle — Cart, Checkout, Payment, POD Submission, Shipping, Returns, Admin Order Management
**Stack**: Next.js 16.1.6, Stripe, Printful (via POD abstraction layer), Supabase, Resend

---

## Executive Summary

**Overall production-readiness: ~72%**

The core payment spine (cart → Stripe Checkout → webhook → order creation → email) is well-implemented with solid idempotency, signature verification, and error handling. The Printful integration layer is architecturally clean with a proper anti-corruption mapper. However, several gaps stand between this and a robust production system:

- **No return of guest cart on login** (cart merging is missing — P0)
- **No EU VAT/IOSS handling** (Stripe Tax disabled, no VAT line on receipts — P0 for EU compliance)
- **No manual retry endpoint for stuck orders** (`/api/admin/orders/{id}/retry` is called from the UI but does not exist — P0)
- **No admin bulk endpoint** (`/api/admin/orders/bulk` called from the admin orders page but does not exist — P0)
- **Coupon race condition**: `times_used` is read then written non-atomically, allowing concurrent redemptions to exceed `usage_limit` — P1
- **`submitted` orders are retried as `requires_review`** but the cron never actually re-submits them to Printful — P1
- **No phone number collected at checkout**, which Printful requires for some countries — P1
- **Returns are authentication-only**: guest checkout orders can never generate a return request — P1
- **Partial refunds are not supported**: the return system always refunds `order.total_cents` regardless of which items are returned — P1
- **Stripe `charge.refunded` webhook not handled**: if a refund is issued from the Stripe dashboard directly, the DB order status never updates — P1

---

## 1. Cart System

### 1.1 Current State

| Feature | Status | Notes |
|---|---|---|
| Guest cart (session cookie) | Working | `cart-session-id` cookie, 30-day TTL |
| Authenticated cart (DB) | Working | `user_id` based, Supabase `cart_items` |
| Product status validation on add | Working | Checks `status = active AND deleted_at IS NULL` |
| Variant resolution (size/color → ID) | Working | Resolves to `product_variants.id` |
| Single-variant auto-select | Working | If only 1 variant exists, auto-selects |
| Multiple-variant enforcement | Working | Returns `VARIANT_REQUIRED` error code |
| Max quantity enforcement | Working | `STORE_DEFAULTS.maxCartQuantity = 99` |
| Optimistic UI updates | Working | Remove and updateQuantity both use optimistic pattern with rollback |
| Personalization support | Working | Fetches via RLS-scoped client using user's token |
| Design composition support | Working | `composition_id` in cart items |

### 1.2 Gaps

**GAP-C1 (P0): No guest cart → authenticated cart merging on login**

File: `/frontend/src/app/api/cart/route.ts`

When a guest user logs in, their `cart-session-id` items are never migrated to their `user_id`. The `refreshCart()` call in `useCart.tsx:76` (triggered by `user` change in `useEffect`) only fetches the authenticated cart, silently discarding any guest items. This is a conversion killer.

**GAP-C2 (P1): No real-time stock check on cart display**

File: `/frontend/src/app/api/cart/route.ts:86-116`

The cart marks items with `unavailable: true` if `product.status !== 'active'`, but does NOT re-check `product_variants.is_available`. A variant can become out-of-stock after being added to the cart, and the cart will show a stale price without any "out of stock" indicator at the variant level.

**GAP-C3 (P2): Price displayed may differ from checkout price**

File: `/frontend/src/app/api/cart/route.ts:202-208`

The cart returns variant `price_cents` from the `product_variants` table, which is correct. However, if a price changes after a user adds an item to cart, there is no notification to the user. The checkout does server-side price override (correct), but the cart UI will show the stale cached price until `refreshCart()` is called.

**GAP-C4 (P2): No total cart item count limit**

File: `/frontend/src/app/api/cart/route.ts`

`MAX_CART_QUANTITY = 99` applies per-item, but there is no limit on the number of distinct items in a cart. A user could theoretically add hundreds of SKUs.

---

## 2. Checkout Flow

### 2.1 Current State

| Feature | Status | Notes |
|---|---|---|
| Product availability validation | Working | Checks active status before session creation |
| Variant stock validation | Working | Checks `is_available` for each variant |
| Server-side price authority | Working | Overrides client prices with DB variant prices (lines 182-205) |
| Stripe Checkout Session creation | Working | `mode: payment`, proper locale, success/cancel URLs |
| Free shipping threshold | Working | EUR 50 threshold, hardcoded `€4.99` otherwise |
| Coupon/discount support | Working | Stored in Supabase `coupons` table, applied as Stripe one-time coupon |
| Guest checkout support | Working | Email collected, customer_email set on session |
| Gift message support | Working | Stored in metadata, forwarded to Printful |
| Stripe Connect (multi-tenant) | Working | Per-tenant connected account + application fee |
| Currency | EUR only | All locales use EUR, `LOCALE_CURRENCY` all map to EUR |
| Tax calculation | Disabled | `automatic_tax.enabled: false` (line 352) |
| Shipping address collection | Working | Stripe collects if not pre-filled |
| Shipping country restriction | Working | `ALLOWED_SHIPPING_COUNTRIES` enforced |

### 2.2 Gaps

**GAP-CH1 (P0): EU VAT / IOSS not handled**

File: `/frontend/src/app/api/checkout/create-session/route.ts:350-353`

Stripe Tax is explicitly disabled (`automatic_tax.enabled: false`). For an EU-based store shipping within the EU, this is a legal compliance issue. Orders above EUR 150 require normal VAT collection at the destination country's rate. Orders under EUR 150 from non-EU customers require IOSS. Neither is handled.

**GAP-CH2 (P1): Coupon `times_used` has a race condition**

File: `/frontend/src/app/api/checkout/create-session/route.ts:127-152`

The coupon validation reads `times_used` and `usage_limit`, then the webhook later increments `times_used`. Between validation and increment there is a window where concurrent checkouts can both pass the `hasUsesLeft` check for the same coupon. This should use an atomic `UPDATE coupons SET times_used = times_used + 1 WHERE id = ? AND times_used < usage_limit` pattern.

**GAP-CH3 (P1): No phone number collected**

File: `/frontend/src/app/api/checkout/create-session/route.ts`

Stripe Checkout does not collect phone numbers by default. Printful requires a phone number for shipments to some countries (notably Brazil, Russia, Chile). The `canonicalAddressFromStripe` mapper sets `phone: undefined`, and if Printful rejects the order for missing phone, there is no recovery path without manual intervention.

**GAP-CH4 (P2): Single shipping option (no rate shopping)**

File: `/frontend/src/app/api/checkout/create-session/route.ts:361-382`

Only one shipping option is presented: free or standard EUR 4.99. The `PrintfulProvider.getShippingRates()` method exists and is implemented, but is never called during checkout. Actual Printful shipping rates vary by destination country. The flat rate may be below actual cost for distant EU countries.

**GAP-CH5 (P2): Stripe coupon leak**

File: `/frontend/src/app/api/checkout/create-session/route.ts:252-258`

A new Stripe coupon object is created on every call to `/api/checkout/create-session`. If the user abandons the session, this Stripe coupon is never deleted. Over time this pollutes the Stripe coupon namespace.

**GAP-CH6 (P2): Metadata `cart_items` truncation risk**

File: `/frontend/src/app/api/checkout/create-session/route.ts:384-393`

Stripe metadata values are capped at 500 characters. `cart_items` is stored as a JSON string. For orders with many items or long IDs, this could silently truncate, causing the webhook to mis-parse cart items and create orders with missing `product_id` or `variant_id`.

---

## 3. Payment Processing (Stripe Webhook)

### 3.1 Current State

| Feature | Status | Notes |
|---|---|---|
| Webhook signature verification | Working | HMAC via `stripe.webhooks.constructEvent` |
| `checkout.session.completed` | Working | Full order creation flow |
| Idempotency check | Working | Checks for existing order by `stripe_session_id` before creating |
| Order record creation | Working | Creates `orders` + `order_items` in DB |
| Audit log entry | Working | Written to `audit_log` table |
| In-app notification (auth user) | Working | Created in `notifications` table |
| Order confirmation email | Working | Via `sendOrderConfirmationEmail` (Resend) |
| Coupon increment on purchase | Working | Increments `times_used` post-payment |
| Subscription events | Working | `customer.subscription.created/updated/deleted` |
| Invoice payment failed | Working | Sets `past_due`, sends email |
| Dispute/chargeback handling | Working | `charge.dispute.created` → sets status `cancelled`, notifies admin |
| Credit pack purchase | Working | Atomic via `add_credits` RPC + UNIQUE constraint |
| `payment_intent.payment_failed` | Logged only | Only logs, no customer email |
| Failed payment handling | Partial | See GAP-W2 |

### 3.2 Gaps

**GAP-W1 (P1): `payment_intent.payment_failed` sends no customer notification**

File: `/frontend/src/app/api/webhooks/stripe/route.ts:73-75`

When a payment intent fails (e.g., insufficient funds, card declined), the webhook only logs the event. The customer receives no email. Only subscription invoice failures trigger emails (via `invoice.payment_failed`). For one-time Checkout sessions, payment failure is already surfaced by Stripe's hosted page, but there is no follow-up communication.

**GAP-W2 (P0): `charge.refunded` webhook event not handled**

File: `/frontend/src/app/api/webhooks/stripe/route.ts:55-87`

The `charge.refunded` event is not in the switch statement. If an admin issues a refund directly from the Stripe dashboard (bypassing the admin return approval flow), the `orders.status` in the DB will never change to `refunded`. The customer's order will continue to show as `shipped` or `delivered`. The switch case falls to `default: console.log(Unhandled event type...)`.

**GAP-W3 (P1): Guest checkout orders have no user linkage**

File: `/frontend/src/app/api/webhooks/stripe/route.ts:164-173`

Guest orders look up `userId` by `customer_details.email` via `users` table. If the guest later creates an account with the same email, the historic orders won't be linked because at order creation time `userId` was null. There is no retroactive linking mechanism.

**GAP-W4 (P1): `checkout.session.async_payment_succeeded` not handled**

File: `/frontend/src/app/api/webhooks/stripe/route.ts`

For payment methods that use delayed confirmation (bank transfers, SEPA Direct Debit, etc.), `checkout.session.completed` fires with `payment_status: 'unpaid'` and is skipped (line 101-104). The actual confirmation arrives via `checkout.session.async_payment_succeeded`. This event is not handled, meaning orders paid via bank transfer/SEPA are never created.

**GAP-W5 (P1): Order items are mapped by `lineItems[index]` position, not by ID**

File: `/frontend/src/app/api/webhooks/stripe/route.ts:203-213`

```typescript
const orderItems = lineItems.map((item, index) => {
  const cartItem = cartItems[index] || {}
  ...
})
```

This relies on Stripe `line_items` being returned in the same order as the `cart_items` metadata. Stripe does not guarantee line item ordering. If Stripe reorders them, `product_id` and `variant_id` will be associated with the wrong `unit_price_cents`.

**GAP-W6 (P2): Dispute handling uses `cancelled` status instead of dedicated `disputed` status**

File: `/frontend/src/app/api/webhooks/stripe/route.ts:910-924`

The code comments acknowledge this (`// TODO: Add 'disputed' status`). Using `cancelled` makes it impossible to distinguish a customer cancellation from a chargeback in reporting and admin views.

---

## 4. Order Submission to Printful (POD Provider)

### 4.1 Current State

| Feature | Status | Notes |
|---|---|---|
| POD abstraction layer | Working | Clean `PODProvider` interface, `PrintfulProvider` implementation |
| Order creation | Working | `provider.createOrder()` → `provider.submitForProduction()` |
| Variant mapping | Working | `product_variants.external_variant_id` → Printful sync variant ID |
| Missing variant guard | Working | Lines 349-366 check for null/`'0'` mappings, set `requires_review` |
| Production URL injection (custom designs) | Working | `files` parameter passed for composition-based products |
| Order failure error capture | Working | `pod_error`, `pod_retry_count`, `pod_last_attempt_at` columns |
| Admin notification on failure | Working | `notifyAdminOfProviderFailure()` |
| Customer email on failure | Working | `sendOrderIssueEmail()` |
| Retry cron job | Working | `/api/cron/retry-printify-orders` with 3-attempt / 2h / 24h windows |
| Auto-refund on timeout | Working | `issueRefund()` with atomic DB guard |

### 4.2 Gaps

**GAP-P1 (P0): Admin "Retry Provider Submission" button calls non-existent endpoint**

File: `/admin/src/app/(dashboard)/orders/[id]/page.tsx:187`

```typescript
const response = await adminFetch(`/api/admin/orders/${order.id}/retry`, { method: 'POST' })
```

There is no `/api/admin/orders/[id]/retry/route.ts` in the codebase. This button will always return 404. Admin cannot manually retry a failed order.

**GAP-P2 (P1): Retry cron marks stuck orders as `requires_review` but never re-submits**

File: `/frontend/src/app/api/cron/retry-printify-orders/route.ts:109-133`

The cron finds orders stuck in `paid` status without an `external_order_id` and transitions them to `requires_review`, incrementing the retry counter. However, it does NOT actually call `provider.createOrder()` again. A true retry would attempt re-submission before escalating. The cron only handles escalation and eventual auto-refund.

**GAP-P3 (P1): `import { canonicalAddressFromStripe } from '@/lib/pod/printify/mapper'` in Stripe webhook**

File: `/frontend/src/app/api/webhooks/stripe/route.ts:12`

The Stripe webhook imports from `printify/mapper` (the legacy Printify module), not from `printful/mapper`. This is an architectural inconsistency — the system uses Printful as the provider but the address mapper is sourced from the Printify module. The Printify compat module re-exports this (line `frontend/src/lib/pod/printify/compat.ts:115` marks it `@deprecated`). This works today but is a maintenance risk.

**GAP-P4 (P1): `submitForProduction` is called after `createOrder` with `?confirm=true`**

File: `/frontend/src/lib/pod/printful/index.ts:210-217`

Printful's `createOrder(body, true)` passes `?confirm=true` which creates and confirms the order in one API call. Then the Stripe webhook calls `provider.submitForProduction()` (which calls `confirmOrder()`) a second time. This may cause a 400 error from Printful ("Order already confirmed") that is currently silently swallowed by the catch block at line 442-467 in the Stripe webhook.

**GAP-P5 (P2): No Printful order cost capture**

File: `/frontend/src/lib/pod/printful/index.ts`

The `createOrder` response from Printful includes the calculated cost for the order. The `toCanonicalOrder` mapper does not extract this cost, and the `orders.pod_cost_cents` column is never populated. This means margin tracking per order is impossible without manual Printful dashboard lookup.

---

## 5. Shipping and Tracking

### 5.1 Current State

| Feature | Status | Notes |
|---|---|---|
| `order.shipped` webhook handler | Working | Updates `tracking_number`, `tracking_url`, `carrier`, `shipped_at` |
| In-app notification on ship | Working | Creates notification with tracking info |
| Shipping email | Working | Via `sendOrderShippedEmail` (Resend) |
| Email opt-out respected | Working | Checks `notification_preferences.email` |
| `order.delivered` detection | Working | Polling cron (`check-delivery-status`) since Printful has no delivery webhook |
| Delivery polling cron | Working | Queries Printful every 3+ days for shipped orders, synthesizes webhook event |
| Concurrent run protection | Working | `acquireLock()` / `recordRun()` advisory locks |
| Tracking link in admin | Working | Clickable tracking URL in order detail page |

### 5.2 Gaps

**GAP-S1 (P1): No customer-facing delivery confirmation email**

File: `/frontend/src/lib/pod/webhooks/handlers/order-delivered.ts`

The `order.delivered` handler exists (via `check-delivery-status` cron), but read the handler to verify whether it sends a customer email. The `order-shipped.ts` sends an email, but there is no `sendOrderDeliveredEmail()` function in `resend.ts`. Customers get a shipped email but no "delivered" confirmation or post-purchase follow-up.

**GAP-S2 (P1): Shipping rate shown at checkout does not match actual Printful cost**

File: `/frontend/src/app/api/checkout/create-session/route.ts:361-382`

The flat rate of EUR 4.99 is displayed for all non-free orders regardless of destination. Actual Printful shipping rates vary by country and weight. The store is either over-collecting or under-collecting shipping fees, with no mechanism to reconcile.

**GAP-S3 (P2): Multi-shipment tracking: only first tracking URL is stored**

File: `/frontend/src/lib/pod/webhooks/handlers/order-shipped.ts:77-85`

When an order has multiple shipments, tracking numbers are concatenated with commas (`tracking_number = shipments.map(s => s.number).join(', ')`) but only the first URL is stored (`tracking_url = shipments[0].url`). The second shipment's tracking URL is silently dropped.

**GAP-S4 (P2): Delivery polling only checks orders shipped 3+ days ago, with no upper bound**

File: `/frontend/src/app/api/cron/check-delivery-status/route.ts:57`

Orders shipped years ago that Printful now marks as `archived` will be polled indefinitely (up to the `BATCH_SIZE = 20` per run). There is no "give up after N days" cutoff for delivered detection.

**GAP-S5 (P2): No push notification for shipping**

The shipped email respects `notification_preferences.email`, but there is no push notification sent on shipment. `frontend/src/lib/push-notifications.ts` exists but is not triggered from the order-shipped webhook handler.

---

## 6. Returns and Refunds

### 6.1 Current State

| Feature | Status | Notes |
|---|---|---|
| Customer return request (POST) | Working | `/api/orders/[id]/returns` — auth required |
| Return eligibility check | Working | Allows returns for `paid, submitted, in_production, shipped, delivered` statuses |
| Duplicate return prevention | Working | Blocks new request if `pending/approved/processing/completed` return exists |
| Admin return list (GET) | Working | `/api/admin/returns` with status filter, pagination |
| Admin approve/reject (PUT) | Working | `/api/admin/returns/[id]` — issues Stripe refund on approve |
| Stripe refund on approval | Working | Calls `stripe.refunds.create()` with `payment_intent` |
| Order status → `refunded` on approve | Working | Updates `orders.status` |
| Audit log on approve/reject | Working | Written to `audit_log` table |
| User notification on refund | Working | In-app notification created |
| State transition revert on Stripe failure | Working | Reverts return status to `pending` if Stripe fails |
| Auto-refund for stuck orders (cron) | Working | Via `issueRefund()` with atomic DB guard |

### 6.2 Gaps

**GAP-R1 (P1): Guest checkout orders cannot request returns**

File: `/frontend/src/app/api/orders/[id]/returns/route.ts:29`

The `POST` endpoint calls `requireAuth(req)`. Guest orders (where `orders.user_id IS NULL`) can never generate a return request. There is no guest return flow (e.g., lookup by order ID + email).

**GAP-R2 (P1): Return always refunds full `order.total_cents`, no partial refund support**

File: `/frontend/src/app/api/orders/[id]/returns/route.ts:97-108`

```typescript
refund_amount_cents: order.total_cents,
```

When a customer returns only one item from a multi-item order, the system creates a return for the full order total. There is no item-level return selection. The admin approval endpoint then refunds `returnRequest.refund_amount_cents`, which is the full order amount. This will over-refund on partial returns.

**GAP-R3 (P1): No return window enforcement**

File: `/frontend/src/app/api/orders/[id]/returns/route.ts:72-77`

There is no time-based eligibility check. A customer can submit a return request years after receiving an order, and the API will accept it (as long as the order status is in the allowed list). The returns policy page may state a 14 or 30-day window, but the API does not enforce it.

**GAP-R4 (P1): Return request submitted for in-production orders creates a Printful cancellation race**

File: `/frontend/src/app/api/orders/[id]/returns/route.ts:72-77`

Return requests are accepted for orders in `in_production` status, but the handler does not call `provider.cancelOrder()` to stop production. Without cancellation, the product will be manufactured and shipped even though a return was requested. Admin must manually cancel from the Printful dashboard.

**GAP-R5 (P1): No Stripe `charge.refunded` handling — manual refunds create status drift**

As noted in GAP-W2: if an admin refunds via Stripe dashboard without going through the admin return approval UI, the order status never changes. Combined with the return system, this creates a state where `orders.status = 'shipped'` but the charge is fully refunded.

**GAP-R6 (P2): No customer refund email notification**

File: `/frontend/src/app/api/admin/returns/[id]/route.ts:215-228`

When a return is approved, an in-app notification is created, but no email is sent to the customer. The customer gets no transactional email confirming their refund was processed.

**GAP-R7 (P2): Returns only available to authenticated users — no admin-initiated return for guest orders**

The admin returns list only shows returns submitted through the customer portal. Since guest users cannot submit returns (GAP-R1), there is no mechanism for an admin to proactively create a return for a guest order even when warranted.

---

## 7. Order Management (Admin)

### 7.1 Current State

| Feature | Status | Notes |
|---|---|---|
| Order list with pagination | Working | `/api/admin/orders` — 100 max per page |
| Status filter | Working | Single or comma-separated statuses |
| Email/ID search | Working | `customer_email.ilike` or `id.eq` |
| SQL injection prevention | Working | `sanitizeForLike()` / `sanitizeForPostgrest()` |
| Order detail view | Working | Timeline, customer info, items, tracking, provider details |
| Personalization display | Working | Shows text, font, color, position, size |
| Bulk order actions (UI) | Working | Select all, cancel, mark shipped/delivered/processing |
| Keyboard navigation | Working | j/k navigation, Enter to open |
| React Query caching | Working | `useOrders` hook with query invalidation |

### 7.2 Gaps

**GAP-A1 (P0): Bulk actions endpoint does not exist**

File: `/admin/src/app/(dashboard)/orders/page.tsx:151`

```typescript
const response = await adminFetch('/api/admin/orders/bulk', {
  method: 'POST',
  ...
})
```

There is no `/api/admin/orders/bulk/route.ts` file. The bulk action UI (cancel, mark shipped, mark delivered, mark processing) will always return 404. This is a complete dead feature.

**GAP-A2 (P0): Retry endpoint does not exist**

File: `/admin/src/app/(dashboard)/orders/[id]/page.tsx:187`

```typescript
const response = await adminFetch(`/api/admin/orders/${order.id}/retry`, { method: 'POST' })
```

No corresponding route file exists. The "Retry Provider Submission" button on the order detail page always fails with 404.

**GAP-A3 (P1): Order detail page does not load order items**

File: `/admin/src/app/(dashboard)/orders/[id]/page.tsx:146-162`

The admin order detail page fetches from `/api/orders/${orderId}` (the customer-facing endpoint), not an admin-specific endpoint. The `requireAuth` in that endpoint will pass for admins, but the customer endpoint returns order items via a join. The `OrderDetail` TypeScript interface includes `items?: OrderLineItem[]` but it depends on the customer API returning them, which it does (`items: items || []`). However, the `items` in the customer response include `product` and `variant` joins but use `product_name` and `variant_name` fields that do not exist in the schema — the customer API returns `product` and `variant` objects, not flat string fields.

**GAP-A4 (P1): No admin endpoint to view returns per order**

The admin order detail page has no returns section. An admin cannot see from the order detail view whether a return request has been filed. They must navigate to the separate returns list page and search by order ID.

**GAP-A5 (P2): Admin order list `status` filter does not include all valid order statuses**

File: `/admin/src/app/(dashboard)/orders/page.tsx:229-264`

The admin UI only shows filter buttons for `all`, `pending`, `processing`, and `shipped`. There are no quick filters for `paid`, `submitted`, `in_production`, `delivered`, `cancelled`, `refunded`, or `requires_review`. Admins cannot efficiently surface orders needing attention.

**GAP-A6 (P2): Order detail timeline uses `paid_at` for "Submitted to Provider" timestamp**

File: `/admin/src/app/(dashboard)/orders/[id]/page.tsx:88-95`

```typescript
timestamp: order.paid_at, // Typically happens right after payment
```

This is inaccurate. Submission to Printful happens asynchronously after payment. A dedicated `submitted_at` column would be needed for accuracy.

**GAP-A7 (P2): Admin cannot cancel a Printful order that is in production**

There is no UI or API endpoint to call `provider.cancelOrder(externalOrderId)`. Once submitted to Printful, there is no admin-initiated cancellation path. This is especially problematic during the return flow for `in_production` orders (see GAP-R4).

---

## 8. Cross-Cutting Gaps

**GAP-X1 (P1): `_initialized` singleton in `pod/index.ts` is module-level — does not reset between serverless invocations**

File: `/frontend/src/lib/pod/index.ts:14`

The `_initialized` flag is a module-level singleton. In Next.js serverless functions, modules may be re-imported in warm lambdas but the flag persists. If `PRINTFUL_API_TOKEN` is rotated and the lambda is not cold-started, the old token continues to be used. This is a standard serverless module caching issue.

**GAP-X2 (P1): `cart_items` are not deleted after successful checkout**

File: `/frontend/src/app/[locale]/(focused)/checkout/success/CartClearer.tsx`

A `CartClearer` component exists in the success page directory. The Stripe webhook does not clear the cart. Cart clearing depends on the frontend component loading on the success page. If the user closes the tab before the success page loads (e.g., redirected by a password manager, or the success page fails), the cart remains populated and the user may attempt to checkout again for an order already placed.

**GAP-X3 (P2): No structured logging or tracing across the purchase pipeline**

The codebase uses `console.log/error` throughout. There is no correlation ID threading through cart → checkout session → webhook → order creation → Printful submission. Debugging a failed order requires manually correlating by `session_id` across multiple log streams.

---

## Final Priority Table

| ID | Area | Gap Description | Priority | File(s) |
|---|---|---|---|---|
| GAP-W2 | Payment | `charge.refunded` webhook not handled — DB status drift | P0 | `webhooks/stripe/route.ts:55-87` |
| GAP-A1 | Admin | Bulk orders endpoint `/api/admin/orders/bulk` missing | P0 | `admin/orders/page.tsx:151` |
| GAP-A2 | Admin | Retry endpoint `/api/admin/orders/[id]/retry` missing | P0 | `admin/orders/[id]/page.tsx:187` |
| GAP-P1 | POD | Same as A2 — admin retry calls non-existent endpoint | P0 | `admin/orders/[id]/page.tsx:187` |
| GAP-C1 | Cart | No guest → auth cart merging on login | P0 | `api/cart/route.ts` |
| GAP-CH1 | Checkout | EU VAT / IOSS not collected (Stripe Tax disabled) | P0 | `checkout/create-session/route.ts:350-353` |
| GAP-W4 | Payment | `checkout.session.async_payment_succeeded` not handled | P1 | `webhooks/stripe/route.ts` |
| GAP-W5 | Payment | `lineItems[index]` mapping assumes Stripe ordering | P1 | `webhooks/stripe/route.ts:203-213` |
| GAP-CH2 | Checkout | Coupon `times_used` race condition | P1 | `checkout/create-session/route.ts:127-152` |
| GAP-CH3 | Checkout | No phone number collected for Printful | P1 | `checkout/create-session/route.ts` |
| GAP-P2 | POD | Retry cron escalates but never re-submits to Printful | P1 | `cron/retry-printify-orders/route.ts:109-133` |
| GAP-P4 | POD | `?confirm=true` + `submitForProduction()` double-confirm | P1 | `pod/printful/index.ts:210-217` |
| GAP-R1 | Returns | Guest orders cannot request returns | P1 | `orders/[id]/returns/route.ts:29` |
| GAP-R2 | Returns | Always refunds full total, no partial refund | P1 | `orders/[id]/returns/route.ts:97-108` |
| GAP-R3 | Returns | No return window enforcement (14/30 day policy not enforced) | P1 | `orders/[id]/returns/route.ts:72-77` |
| GAP-R4 | Returns | In-production orders: no Printful cancellation on return | P1 | `orders/[id]/returns/route.ts:72-77` |
| GAP-R5 | Returns | `charge.refunded` not handled — status drift on manual refunds | P1 | `webhooks/stripe/route.ts` (same as GAP-W2) |
| GAP-S1 | Shipping | No customer delivery confirmation email | P1 | `webhooks/handlers/order-delivered.ts` |
| GAP-S2 | Shipping | Flat shipping rate doesn't match actual Printful cost | P1 | `checkout/create-session/route.ts:361-382` |
| GAP-W3 | Payment | Guest orders not linked to account if user registers later | P1 | `webhooks/stripe/route.ts:164-173` |
| GAP-W1 | Payment | `payment_intent.payment_failed` sends no customer email | P1 | `webhooks/stripe/route.ts:73-75` |
| GAP-A4 | Admin | No returns view in admin order detail | P1 | `admin/orders/[id]/page.tsx` |
| GAP-X2 | Cross | Cart not cleared server-side after checkout | P1 | `checkout/success/CartClearer.tsx` |
| GAP-C2 | Cart | No per-variant stock check on cart display | P1 | `api/cart/route.ts:86-116` |
| GAP-P3 | POD | Imports `canonicalAddressFromStripe` from deprecated `printify/mapper` | P1 | `webhooks/stripe/route.ts:12` |
| GAP-P5 | POD | Printful order cost not captured (pod_cost_cents always null) | P2 | `pod/printful/index.ts` |
| GAP-CH4 | Checkout | No real-time Printful shipping rates | P2 | `checkout/create-session/route.ts:361-382` |
| GAP-CH5 | Checkout | Orphaned Stripe coupon objects on abandoned sessions | P2 | `checkout/create-session/route.ts:252-258` |
| GAP-CH6 | Checkout | Stripe metadata `cart_items` truncation risk | P2 | `checkout/create-session/route.ts:384-393` |
| GAP-W6 | Payment | `disputed` order status not modeled — uses `cancelled` | P2 | `webhooks/stripe/route.ts:910-924` |
| GAP-S3 | Shipping | Multi-shipment: second tracking URL silently dropped | P2 | `webhooks/handlers/order-shipped.ts:77-85` |
| GAP-S4 | Shipping | No upper bound on delivery polling for old orders | P2 | `cron/check-delivery-status/route.ts:57` |
| GAP-S5 | Shipping | No push notification on shipping | P2 | `webhooks/handlers/order-shipped.ts` |
| GAP-R6 | Returns | No customer email on return approval/refund | P2 | `admin/returns/[id]/route.ts:215-228` |
| GAP-R7 | Returns | No admin-initiated return for guest orders | P2 | `api/admin/returns/route.ts` |
| GAP-A3 | Admin | Order detail item field mismatch (`product_name` vs nested object) | P1 | `admin/orders/[id]/page.tsx` |
| GAP-A5 | Admin | Missing status filters in admin order list | P2 | `admin/orders/page.tsx:229-264` |
| GAP-A6 | Admin | Timeline shows `paid_at` as submission time | P2 | `admin/orders/[id]/page.tsx:88-95` |
| GAP-A7 | Admin | No admin-initiated Printful order cancellation | P2 | `api/admin/orders/` |
| GAP-C3 | Cart | Stale cart price not notified to user | P2 | `api/cart/route.ts:202-208` |
| GAP-C4 | Cart | No total cart item count limit | P2 | `api/cart/route.ts` |
| GAP-X1 | Cross | POD provider singleton doesn't reset on token rotation | P1 | `lib/pod/index.ts:14` |
| GAP-X3 | Cross | No structured logging / request tracing | P2 | All webhook/cron handlers |

---

## Recommended Fix Order (P0 Blockers First)

### P0 — Must fix before production launch

1. **Implement `/api/admin/orders/[id]/retry/route.ts`**: Fetch the order's items and variants, call `provider.createOrder()` + `provider.submitForProduction()`, update `external_order_id` and `status`. Auth: admin required.

2. **Implement `/api/admin/orders/bulk/route.ts`**: Accept `{ orderIds: string[], action: string }`, validate action against an allowlist, and perform the corresponding Supabase `UPDATE orders SET status = ?` (with the appropriate Printful call for `cancel`). Auth: admin required.

3. **Handle `charge.refunded` webhook**: Add `case 'charge.refunded':` to the switch in `webhooks/stripe/route.ts`. Find the order by `stripe_payment_intent_id`, transition to `refunded` status.

4. **Fix guest → auth cart merging**: When `POST /api/cart` or `GET /api/cart` is called with a valid session and a `cart-session-id` cookie, merge session cart items into the user's cart (`UPDATE cart_items SET user_id = ?, session_id = NULL WHERE session_id = ?`).

5. **Enable Stripe Tax or implement EU VAT collection**: At minimum, enable `automatic_tax.enabled: true` (requires Stripe Tax setup) or add a VAT line item based on destination country from `shippingAddress.country`.

### P1 — Must fix within first 30 days

6. **Handle `checkout.session.async_payment_succeeded`**: Add handler identical to `handleCheckoutSessionCompleted` (both are triggered by the same session, but for async payment methods).

7. **Fix `lineItems[index]` mapping**: Use the Stripe line item `description` to match against `cartItems` by product title, or pass a stable `cart_item_id` in the Stripe product metadata to enable correct re-association.

8. **Implement return window enforcement**: Add `const RETURN_WINDOW_DAYS = 30` and check `order.delivered_at || order.created_at` against `Date.now() - RETURN_WINDOW_DAYS * 86400000`.

9. **Cancel Printful order when return is requested for in-production orders**: In `POST /api/orders/[id]/returns`, if `order.status === 'in_production' && order.external_order_id`, call `provider.cancelOrder(order.external_order_id)`.

10. **Fix double-confirm in Printful flow**: Either remove `createOrder(body, true)` (use draft first) and let `submitForProduction()` confirm, or remove the `submitForProduction()` call and rely on `?confirm=true`. Do not do both.

11. **Add customer refund email**: Implement `sendReturnApprovedEmail()` in `resend.ts` and call it from `PUT /api/admin/returns/[id]/route.ts` after Stripe refund succeeds.

12. **Collect phone number at checkout**: Add `phone_number_collection: { enabled: true }` to the Stripe session config and pass `phone` from `session.collected_information?.shipping_details` to `canonicalAddressFromStripe`.
