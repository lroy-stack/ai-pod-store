# Cart-to-Delivery Lifecycle Audit

**Date**: 2026-03-04
**Scope**: Complete purchase lifecycle from cart to delivery + returns
**Platform**: Next.js 16 + Supabase + Stripe + Printify/Printful (via POD abstraction)

---

## Executive Summary

The purchase lifecycle is **substantially implemented** with strong foundations across all 7 phases. The system covers cart management (auth + guest), Stripe Checkout with server-side price authority, automated Printify order submission, full webhook-driven status tracking, automated refunds, returns lifecycle, abandoned cart recovery, reviews, reorder, and invoice APIs.

**Key strengths**: Provider-agnostic POD abstraction, atomic refund guard, state transition validation, idempotent webhook processing, multi-locale email templates, CSRF protection.

**Key gaps**: No guest-to-auth cart merge, no checkout cancel page, no PDF invoice generation, no Stripe automatic tax, no partial refund support in returns, no user-facing returns UI page.

### Phase Readiness Summary

| Phase | Rating | Key Issues |
|---|---|---|
| 1. Cart | **READY** | Missing guest-to-auth cart merge |
| 2. Checkout | **READY** | No cancel page, shipping calculated at Stripe |
| 3. Payment Processing | **READY** | Solid idempotent webhook handling |
| 4. Order Fulfillment | **READY** | Full auto-submit + retry + refund pipeline |
| 5. Delivery Tracking | **READY** | Cron-based delivery polling for Printful gap |
| 6. Returns & Refunds | **PARTIAL** | No user-facing UI page for returns |
| 7. Post-Purchase | **PARTIAL** | No PDF invoices, review purchase check uses wrong query |

---

## End-to-End Flow Diagram

```
                          PURCHASE LIFECYCLE
                          ==================

  [Customer]                                        [Provider]
      |                                                  |
      |  1. Add to Cart                                  |
      |  (POST /api/cart)                                |
      v                                                  |
  +--------+                                             |
  |  CART   | <-- DB: cart_items (user_id or session_id) |
  | (DB)    |     Supports: variants, personalizations,  |
  +--------+     compositions, guest carts               |
      |                                                  |
      |  2. Proceed to Checkout                          |
      |  (CheckoutView.tsx)                              |
      v                                                  |
  +-----------+   Shipping address selection              |
  | CHECKOUT  |   Tax calculation (pre-check)            |
  | (Client)  |   Guest email for unauthenticated        |
  +-----------+   Gift message, Coupon code              |
      |                                                  |
      |  3. Create Stripe Session                        |
      |  (POST /api/checkout/create-session)             |
      v                                                  |
  +----------------+                                     |
  | STRIPE         |  - Server-side price validation     |
  | CHECKOUT       |  - Personalization PNG generation   |
  | SESSION        |  - Temp Printify product creation   |
  |                |  - Coupon validation + Stripe coupon |
  |                |  - Shipping options (free >= 50EUR)  |
  |                |  - Connect routing (multi-tenant)    |
  +----------------+                                     |
      |                                                  |
      |  4. Customer pays on Stripe                      |
      v                                                  |
  +----------------+                                     |
  | STRIPE         |  checkout.session.completed webhook  |
  | WEBHOOK        |------------------------------------>|
  | HANDLER        |                                     |
  +----------------+                                     |
      |                                                  |
      |  5. Create Order in DB                           |
      |  (orders + order_items + notifications)          |
      v                                                  |
  +-----------+  6. Submit to Printify/Printful           |
  | ORDER     |  (provider.createOrder + submitForProd)  |
  | (paid)    |--------------------------------------->  |
  +-----------+                                          |
      |                                                  |
      |  7. Send confirmation email (Resend)             |
      |                                                  |
      v                         8. Provider processes    |
  +-----------+                     order                |
  | ORDER     | <-- order:shipped webhook --------------|
  | (shipped) |                                          |
  +-----------+                                          |
      |                                                  |
      |  9. Shipping notification email + in-app notif   |
      v                                                  |
  +-----------+                                          |
  | ORDER     | <-- order:delivered webhook ------------|
  | (delivered)|    OR cron check-delivery-status poll   |
  +-----------+                                          |
      |                                                  |
      |  10. Post-purchase: review, reorder, return      |
      v                                                  |
  [LIFECYCLE COMPLETE]
```

## State Machine: Order Status

```
  pending --> paid --> submitted --> in_production --> shipped --> delivered
     |         |         |              |                |           |
     |         |         |              |                |           |
     v         v         v              v                v           v
  cancelled  requires_  requires_    requires_       refunded    refunded
             review     review       review
               |
               v
            refunded
```

Defined in `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/reliability/state-transition.ts`

Valid transitions matrix:
- `pending` -> `paid`, `cancelled`
- `paid` -> `submitted`, `requires_review`, `cancelled`, `refunded`
- `submitted` -> `in_production`, `shipped`, `requires_review`, `cancelled`
- `in_production` -> `shipped`, `requires_review`, `cancelled`
- `shipped` -> `delivered`, `refunded`
- `requires_review` -> `paid`, `cancelled`, `refunded`
- `delivered` -> `refunded`
- `cancelled` -> (terminal)
- `refunded` -> (terminal)

---

## Phase 1: Cart

**Rating: READY**

### Files Analyzed

- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/hooks/useCart.tsx` -- Client state management
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cart/route.ts` -- Cart API (GET/POST/PATCH/DELETE)
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/cart/CartView.tsx` -- Cart page UI

### What Is Fully Implemented

1. **DB-backed cart** -- `cart_items` table in Supabase, not localStorage. Full CRUD via API routes.
2. **Auth + Guest support** -- Authenticated users use `user_id`, guests use `session_id` cookie (UUID, 30-day TTL, httpOnly).
3. **Variant resolution** -- POST resolves `variant_details` (size/color) to a `variant_id`. Auto-selects if only one variant exists. Returns `VARIANT_REQUIRED` error with available options if multiple.
4. **Personalization support** -- `personalization_id` and `composition_id` fields on cart items. Personalization details fetched via user-scoped RLS client.
5. **Duplicate detection** -- Same product + variant + personalization + composition = quantity increment (capped at `maxCartQuantity: 99`).
6. **Unavailable product detection** -- Cart GET checks product `status !== 'active'` and flags items as `unavailable`.
7. **Available variants for editing** -- Cart GET returns `available_variants` map for in-cart variant editing.
8. **Optimistic updates** -- Client-side optimistic quantity/remove updates with rollback on API error.
9. **Variant editing in cart** -- Full inline variant editing (size/color Select dropdowns) in CartView.
10. **Coupon code** -- Client-side coupon validation via `/api/coupons/validate`, persisted in sessionStorage for checkout.
11. **Shipping estimate** -- ZIP-based shipping calculation in cart summary.
12. **Free shipping progress bar** -- Visual indicator showing progress toward 50 EUR threshold.
13. **Cross-sell** -- `CartCrossSell` component loaded below cart items.
14. **Guest checkout path** -- Clear CTA for guest checkout vs sign-in-to-checkout.
15. **Max quantity enforcement** -- Both client and server enforce `maxCartQuantity: 99`.
16. **Undo remove** -- Toast with undo action when removing items.

### Gaps / Issues

1. **No guest-to-auth cart merge** -- When a guest logs in, their `session_id`-based cart items are NOT merged with their `user_id`-based items. This is a **data loss risk** -- guest items are orphaned after login. Grep confirms no merge logic exists.
2. **No cart expiration cleanup** -- Guest carts with `session_id` persist indefinitely in DB. No cron job to clean up stale guest carts (the `cleanup-temp-products` cron only handles temp Printify products, not cart items).
3. **PATCH delete does not verify ownership** -- The PATCH handler deletes by `item_id` without checking if the item belongs to the requesting user/session. An attacker with a valid `item_id` could delete another user's cart item. The POST handler correctly scopes by `user_id`/`session_id`, but PATCH does not.
4. **DELETE does not handle missing session** -- If neither `userId` nor `sessionId` exists, returns 404. Edge case: if cookies are cleared mid-session, authenticated user's items remain but cannot be accessed until re-login.

### Security Concerns

- **PATCH ownership gap**: Cart item ID is a UUID, so brute-forcing is impractical, but the missing ownership check is still a defense-in-depth violation.
- **Session cookie**: `httpOnly: true`, `secure: production-only`, `sameSite: lax` -- properly configured.
- **Price authority**: Cart prices are from DB products/variants, not client-submitted. Server-side price override happens at checkout.

---

## Phase 2: Checkout

**Rating: READY**

### Files Analyzed

- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/checkout/CheckoutView.tsx` -- Checkout UI
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/checkout/create-session/route.ts` -- Stripe session creation

### What Is Fully Implemented

1. **Address management** -- Authenticated users can select from saved addresses or add new ones via `/api/shipping-addresses` API.
2. **Guest checkout** -- Email-only guest checkout with validation. No address pre-fill for guests (Stripe collects address).
3. **Tax pre-calculation** -- Client calls `/api/checkout/calculate-tax` when address is selected. Displays tax estimate in summary.
4. **Server-side price authority** -- `create-session` fetches `product_variants.price_cents` from DB and overrides any client-submitted prices (lines 484-507).
5. **Variant/product availability re-validation** -- All products checked for `status: active` and variant `is_available` before session creation. Returns 409 with specific unavailable items.
6. **Personalization at checkout** -- Full pipeline: loads personalization from DB, generates high-res PNG via `node-canvas`, uploads to Printify, creates temp product, links to cart item metadata.
7. **Composition at checkout** -- Design compositions exported to production-quality PNG, uploaded, temp product created in Printify.
8. **Coupon validation** -- Server-side re-validation of coupon (active, min purchase, usage limits). Creates one-time Stripe coupon for discount.
9. **Gift message** -- Stored in Stripe session metadata, limited to 200 chars.
10. **Shipping options** -- Dynamic: free shipping >= 50 EUR subtotal, otherwise 4.99 EUR standard. 5-7 business day estimate.
11. **Multi-tenant Stripe Connect** -- Per-tenant connected account routing with plan-tiered application fees (2-10%).
12. **Crypto payments** -- Conditionally includes `crypto` payment method type via env flag.
13. **Checkout breadcrumb** -- Step indicator UI component.
14. **Exit intent dialog** -- AlertDialog shown when user tries to leave checkout page.
15. **Trust badges** -- Shipping, returns, and security badges. Payment method logos (Visa, MC, Amex, PayPal).
16. **Locale-aware** -- Stripe session locale set to match user locale (en/es/de).

### Gaps / Issues

1. **No checkout cancel page** -- `cancelUrl` points to `/${locale}/checkout/cancel` but no page exists at that route. User would see a 404 if they cancel at Stripe. This is a **production blocker** -- must create a simple redirect-back page.
2. **Stripe Tax disabled** -- `automatic_tax: { enabled: false }` with comment "will enable when Stripe Tax is activated". Tax pre-calculation on client side is an estimate only. VAT compliance for EU sales requires proper tax handling.
3. **Shipping only has one option** -- No express shipping option in Stripe session, despite `SHIPPING_RATES` in store-config defining express rates per country. Only standard shipping (or free) is sent to Stripe.
4. **Font registration at module load** -- `registerFont()` for 12 fonts runs at cold start. If a font file is missing, the PNG generation silently falls back to Inter. No error logging for missing fonts.
5. **Personalization failure is non-blocking** -- If temp product creation fails, checkout continues without personalization. Customer pays but the personalized product may not be fulfilled correctly. This should at minimum warn the user.
6. **No address passed to Stripe if guest** -- For guests, `shippingAddress` is undefined, so Stripe collects the address. But `shipping_address_collection` with `ALLOWED_SHIPPING_COUNTRIES` is only set when no pre-filled address. This is correct behavior, but guest orders to non-allowed countries are blocked at Stripe level, not with a friendly error.

### Security Concerns

- **Server-side price override**: Properly prevents client price manipulation.
- **Coupon validation**: Server-side re-check prevents client-forged discount amounts.
- **CSRF**: Middleware validates CSRF tokens for POST to `/api/checkout/create-session`.
- **Payment intent metadata**: Cart items serialized to metadata for webhook processing. Metadata size limit is 500 chars per key -- large carts may truncate.

---

## Phase 3: Payment Processing

**Rating: READY**

### Files Analyzed

- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/stripe/route.ts` -- Stripe webhook handler

### Events Handled

| Event | Handler | Action |
|---|---|---|
| `checkout.session.completed` | `handleCheckoutSessionCompleted` | Creates order + items, submits to Printify, sends email |
| `customer.subscription.created` | `handleSubscriptionUpdate` | Updates user tier, adds bonus credits, triggers drip |
| `customer.subscription.updated` | `handleSubscriptionUpdate` | Same as above |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Resets tier to free, status to cancelled |
| `payment_intent.succeeded` | Console log only | No action beyond logging |
| `payment_intent.payment_failed` | Console log only | No action beyond logging |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Updates subscription status, sends email, admin alert |
| `charge.dispute.created` | `handleChargeDisputeCreated` | Cancels order, audit log, admin notifications |

### What Is Fully Implemented

1. **Webhook signature verification** -- Uses `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET`.
2. **Idempotent order creation** -- Checks `stripe_session_id` uniqueness before creating order. Duplicate webhooks are safely ignored.
3. **Full session retrieval** -- Expands `line_items`, `payment_intent`, `payment_intent.payment_method` for complete data.
4. **Order record creation** -- Fields: `user_id`, `stripe_session_id`, `stripe_payment_intent_id`, `status: 'paid'`, `total_cents`, `currency`, `shipping_address` (JSONB), `customer_email`, `locale`, `gift_message`, `payment_method`, `paid_at`.
5. **Order items creation** -- Maps Stripe line items to DB `order_items` with `product_id`, `variant_id`, `personalization_id`, `quantity`, `unit_price_cents`.
6. **User lookup by email** -- Associates orders with existing users via email match.
7. **In-app notification** -- Creates `order_confirmation` notification for authenticated users.
8. **Audit log** -- Records `order_created` action with full metadata.
9. **Coupon usage increment** -- Atomically increments `times_used` on redeemed coupon.
10. **Auto-submit to Printify** -- Immediately after order creation, fetches Printify IDs, builds line items, creates Printify order, and submits for production.
11. **Printify failure handling** -- On submission failure: records error in `printify_error`/`pod_error`, increments retry count, notifies admins, sends customer issue email.
12. **Variant mapping guard** -- Checks all order items have valid `printify_variant_id`/`external_variant_id`. Missing mappings trigger `requires_review` status.
13. **Confirmation email** -- Locale-aware order confirmation via Resend with brand theming.
14. **Credit pack handling** -- Idempotent credit purchases via `UNIQUE(user_id, stripe_payment_id)` constraint and atomic `add_credits` RPC.
15. **Chargeback handling** -- Dispute webhook cancels order, creates audit entry, notifies all admins with severity, links to payment intent.

### Gaps / Issues

1. **Order items index mismatch risk** -- `lineItems.map((item, index) => cartItems[index])` assumes Stripe line items are in the same order as metadata cart items. If Stripe reorders items (unlikely but undocumented), cart item metadata could be mismatched. Safer approach: match by product name or metadata.
2. **No `payment_intent.payment_failed` order handling** -- Failed payment intents are only logged, not tracked. If a customer's payment fails after session creation (e.g., 3DS failure), there is no record or notification. This is acceptable because Stripe handles retries, but a `payment_intent.requires_action` handler would improve UX.
3. **Guest orders are not linked to future registrations** -- If a guest checks out and later creates an account with the same email, past orders are not automatically linked. The user lookup happens at webhook time, not retroactively.
4. **Missing `charge.dispute.closed` handler** -- Only `charge.dispute.created` is handled. If a dispute is resolved in the merchant's favor, the order status remains `cancelled`. Should handle `charge.dispute.closed` with `status: won` to restore the order.
5. **Dispute uses `cancelled` status instead of `disputed`** -- Comment acknowledges this: "TODO: Add 'disputed' status to orders table CHECK constraint". Uses `cancelled` as workaround.

### Security Concerns

- **Webhook verification**: Uses Stripe's official `constructEvent` for signature validation.
- **Service role client**: Uses `SUPABASE_SERVICE_KEY` to bypass RLS -- appropriate for webhook handler.
- **No secrets in logs**: Sensitive data (email, payment ID) logged at info level for debugging. Consider reducing in production.

---

## Phase 4: Order Fulfillment

**Rating: READY**

### Files Analyzed

- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/printify/route.ts` -- Legacy Printify webhooks
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/pod/[provider]/route.ts` -- Unified POD webhooks
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/retry-printify-orders/route.ts` -- Retry cron
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/types.ts` -- POD provider abstraction
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/reliability/refund-guard.ts` -- Atomic refund guard
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/reliability/state-transition.ts` -- State machine

### What Is Fully Implemented

1. **POD Provider Abstraction** -- Full ISP-compliant interface: `PODCatalogProvider`, `PODProductProvider`, `PODDesignProvider`, `PODOrderProvider`, `PODWebhookProvider`. Printify and Printful implementations exist.
2. **Dual webhook endpoints** -- Legacy `/api/webhooks/printify` (direct handler) + unified `/api/webhooks/pod/[provider]` (normalized router). Both active during migration.
3. **Printify webhook events handled**:
   - `order:created` -- Confirms order linkage
   - `order:shipped` -- Updates status, tracking info, sends email/notification
   - `order:delivered` -- Updates status, sends email/notification
   - `order:cancelled` -- Issues refund via RefundGuard, updates status
   - `order:failed` -- Issues refund via RefundGuard, updates status
   - `product:publish:started` -- Confirms publishing
   - `product:publish:succeeded` / `product:created` / `product:updated` -- Syncs product
   - `product:deleted` -- Cascade delete
4. **HMAC signature verification** -- Printify webhooks verified with `createHmac('sha256')` + `timingSafeEqual`. Printful uses query param secret.
5. **Atomic refund guard** -- `issueRefund()` creates Stripe refund first, then atomically records via `issue_refund_atomic` database function. If DB says already refunded, cancels the Stripe refund. Prevents double-refunding.
6. **State transition validator** -- `transition()` function reads current state, validates against matrix, uses optimistic locking (`eq(statusColumn, fromState)` in UPDATE) to prevent race conditions.
7. **Retry cron job** -- `/api/cron/retry-printify-orders`:
   - Finds orders stuck in `paid` without `printify_order_id`
   - Within 30min window: marks as `requires_review` + increments retry count
   - After 3 retries OR 2 hours: auto-refunds via RefundGuard
   - `requires_review` orders older than 24 hours: auto-refunded
8. **Multi-shipment tracking** -- Shipped handler aggregates tracking from multiple shipments (concatenates tracking numbers, deduplicates carriers).
9. **Email preference check** -- Before sending shipping/delivery emails, checks `users.notification_preferences.email` flag.
10. **Audit logging** -- Every webhook event creates an `audit_log` entry with actor, action, changes, and metadata.
11. **Admin notifications** -- Printify failures create `notifications` for all admin users with failure type and error message.
12. **Customer issue email** -- Multi-locale (en/es/de) email sent when order requires review.

### Gaps / Issues

1. **No actual retry of Printify submission** -- The retry cron does NOT re-attempt submitting the order to Printify. It only marks orders as `requires_review` or auto-refunds. A true retry mechanism (re-calling `provider.createOrder`) is missing.
2. **Legacy + unified webhooks both active** -- During the dual-write period, both `/api/webhooks/printify` and `/api/webhooks/pod/printify` process events. If both are registered in Printify's webhook config, events will be double-processed. The legacy handler's idempotency depends on status checks, but some operations (like sending emails) could be duplicated.
3. **No webhook event deduplication** -- Neither handler checks for a previously processed `event_id`. If Printify retries a webhook, the handler re-processes it. For shipped/delivered, this would attempt duplicate status updates (idempotent due to state transition), but emails could be re-sent.

---

## Phase 5: Delivery Tracking

**Rating: READY**

### Files Analyzed

- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/check-delivery-status/route.ts` -- Delivery polling cron

### What Is Fully Implemented

1. **Cron-based delivery polling** -- Compensates for providers (like Printful) that do not send `order:delivered` webhook. Polls shipped orders older than 3 days.
2. **Advisory lock** -- Uses `acquireLock()` to prevent concurrent cron runs.
3. **Provider-agnostic** -- Determines provider from `pod_provider` column or infers from available IDs. Uses provider registry to check configuration.
4. **Synthetic webhook events** -- When delivery detected, creates a `NormalizedWebhookEvent` and routes through the unified webhook router. This means delivery handling code is not duplicated.
5. **Batch processing** -- Processes up to 20 orders per run with `cron-lock` recording.
6. **Run recording** -- Records cron run status (completed/failed), duration, and items processed via `recordRun()`.

### Tracking Data Storage

- `orders.tracking_number` -- Carrier tracking number(s)
- `orders.tracking_url` -- Carrier tracking URL
- `orders.carrier` -- Carrier name(s)
- `orders.shipped_at` -- Timestamp
- `orders.delivered_at` -- Timestamp

### Gaps / Issues

1. **No customer-facing tracking page** -- Tracking info is stored in DB and sent via email, but there is no dedicated tracking page in the frontend. Users see tracking in order details and notifications, but no map/timeline visualization.
2. **3-day delay** -- Delivery check starts 3 days after shipping. Fast deliveries (next-day within EU) could go undetected for 2 days. This is acceptable for POD (typically 5-7 business days).
3. **No tracking API polling** -- The cron queries the provider's order status, not a carrier tracking API (17Track, AfterShip). This means tracking is provider-dependent and may not catch carrier-confirmed deliveries that the provider hasn't yet reflected.

---

## Phase 6: Returns & Refunds

**Rating: PARTIAL**

### Files Analyzed

- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/orders/[id]/returns/route.ts` -- User-facing return request API
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/admin/returns/route.ts` -- Admin return list
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/admin/returns/[id]/route.ts` -- Admin approve/reject
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/returns/[id]/tracking/route.ts` -- Customer tracking submission

### Return Request Lifecycle

```
  Customer submits       Admin reviews        Customer ships       Admin receives
  POST /orders/:id/      PUT /admin/           POST /returns/:id/   (manual)
  returns                 returns/:id           tracking
       |                     |                     |                   |
       v                     v                     v                   v
   [pending] ----------> [approved] ----------> [processing] ----> [completed]
       |                     |                                        |
       v                     v                                        v
   [rejected]            [expired]                              (refund issued)
```

### What Is Fully Implemented

1. **User return request API** -- `POST /api/orders/[id]/returns`: Validates order exists, checks status eligibility (paid/submitted/in_production/shipped/delivered), prevents duplicate active requests, sets refund amount to full order total.
2. **Duplicate prevention** -- Blocks new request if pending/approved/processing/completed exists. Allows re-request after rejection.
3. **Admin list returns** -- `GET /api/admin/returns`: Paginated, filterable by status, includes order/user/approver details via joins.
4. **Admin approve/reject** -- `PUT /api/admin/returns/[id]`:
   - **Reject**: Updates status to `rejected` with admin notes, audit log.
   - **Approve**: Sets status to `processing`, creates Stripe refund (`stripe.refunds.create`), updates to `completed` with Stripe refund ID, updates order status to `refunded`, creates user notification, audit log. On Stripe failure: reverts to `pending` with error note.
5. **Customer tracking submission** -- `POST /api/returns/[id]/tracking`: Authenticated user can submit tracking number/carrier for approved returns. Changes status to `processing`. Validates ownership and status.
6. **Auth guard** -- Admin endpoints use `requireAdmin()`. Tracking endpoint uses Supabase SSR auth + ownership check.
7. **Zod validation** -- Both approval and tracking endpoints use Zod schemas.

### Gaps / Issues

1. **No user-facing returns UI page** -- There is no frontend page at `/orders/[id]/returns` or similar where a customer can initiate a return through the UI. The API exists but is only usable programmatically. This is a **significant gap** for production.
2. **Full refund only** -- `refund_amount_cents: order.total_cents` is hardcoded at request creation. No support for partial refunds (e.g., returning one item from a multi-item order).
3. **No return request auth** -- `POST /api/orders/[id]/returns` does not verify that the requester is the order owner. The `user_id` field is optional in the schema and falls back to `order.user_id`. Any authenticated user who knows an order ID could submit a return request.
4. **No return window enforcement** -- No check for return eligibility period (e.g., 30 days from delivery). All delivered orders are eligible indefinitely.
5. **No return shipping label generation** -- Customer must arrange their own return shipping. No integration with carrier APIs for prepaid labels.
6. **No email notification to customer** -- When admin approves/rejects a return, only an in-app notification is created. No email is sent about the refund status.
7. **Refund always "full"** -- Even for multi-item orders, the refund amount is the full order total. No item-level refund calculation.
8. **`processing` status ambiguity** -- Both "admin processing refund" and "customer has shipped return" use `processing` status. The tracking submission transitions `approved` -> `processing`, and admin approval also goes through `processing` briefly before `completed`.

### Security Concerns

- **Missing ownership check on return creation**: Critical gap. Must verify requesting user matches `order.user_id`.
- **Admin auth**: Uses `requireAdmin()` guard -- properly secured.
- **Stripe refund error handling**: Reverts return status to `pending` on failure, preventing stuck states.

---

## Phase 7: Post-Purchase

**Rating: PARTIAL**

### Files Analyzed

- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/reviews/route.ts` -- Review submission
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/orders/[id]/reorder/route.ts` -- Reorder API
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/orders/[id]/invoice/route.ts` -- Invoice API
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/abandoned-cart-recovery/route.ts` -- Abandoned cart recovery

### Reviews

**Implemented**:
- POST: Authenticated, rate-limited, validated (1-5 rating, 10+ char comment, max 3 images)
- GET: Fetches approved reviews for a product
- Verified purchase check: Queries orders table
- Replaces existing review (delete + insert) for same user/product
- Moderation: Only `approved` reviews shown in GET

**Issue**: Purchase verification query `eq('items->>product_id', productId)` appears to use JSON arrow operator on `items` column, but orders don't have an `items` JSON column -- they have separate `order_items` table. This query would never match, meaning **all reviews show as unverified**. Should join through `order_items` table.

### Reorder

**Implemented**:
- POST: Authenticated, ownership-verified
- Copies all order items to cart with variant_id
- Handles existing cart items (increments quantity, caps at max)
- Does NOT copy personalizations (noted in comments)
- Returns counts of added/updated/skipped items

### Invoice

**Implemented**:
- GET: Authenticated, ownership-verified (admins see all)
- Returns structured invoice JSON with line items, totals, dates
- Two modes: `stripe` (with payment_intent link) and `basic`
- Includes `stripe_dashboard_url` for Stripe orders

**Not Implemented**:
- No PDF generation -- returns JSON only
- No `hosted_invoice_url` from Stripe (commented as TODO)
- No downloadable invoice for customers

### Abandoned Cart Recovery

**Implemented**:
- Cron job: Protected by bearer token
- Two-stage emails: 1st at 1 hour, 2nd at 24 hours
- Multi-locale email templates (en/es/de) with branded HTML
- Recovery tracking: `abandoned_carts` table tracks email sent timestamps
- Completion detection: Skips users who completed an order since cart update
- Fallback: Manual query if RPC `get_abandoned_carts` doesn't exist

**Limitation**: Only works for authenticated users (guest carts have no email).

### Checkout Success Page

**Implemented** at `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/[locale]/(focused)/checkout/success/page.tsx`:
- Server component fetches session details from Stripe
- Displays order summary, line items, total, payment status
- `CartClearer` component silently clears cart after successful payment
- Links to "Continue Shopping" and "View Orders"

### Gaps / Issues

1. **No PDF invoice** -- Only JSON invoice data is returned. Customers expect downloadable PDF invoices, especially for business purchases in the EU.
2. **Review purchase check is broken** -- Query uses JSON operator on a non-existent column. All reviews will be marked as unverified purchases.
3. **No order history page analysis** -- Not part of this audit's file list, but the orders page should display status, tracking, and return options.
4. **No post-delivery review prompt** -- No automated email asking customers to review their purchase after delivery.
5. **Abandoned cart only for auth users** -- Guest carts (which may represent a significant portion of traffic) cannot receive recovery emails.

---

## Cross-Cutting Concerns

### Multi-Tenancy

**Flow**: Middleware resolves `hostname` -> `/api/tenant-resolve` -> `x-tenant-id` header -> cached in cookie (5 min TTL). Checkout uses `x-tenant-id` for Stripe Connect routing.

**Implemented**:
- Tenant resolution with Redis cache
- Stripe Connect per-tenant with plan-tiered fees
- Tenant ID propagated via request/response headers

**Gap**: Order records do not include a `tenant_id` column. Multi-tenant analytics and order attribution would require joining through products or adding the column.

### Currency Handling

**Current**: EUR-only across all locales (LOCALE_CURRENCY maps en/es/de all to EUR). Stripe session currency defaults to EUR. Cart prices stored as `price_cents` (EUR cents).

**Status**: Single-currency. The architecture (locale -> currency mapping, `formatPrice` with currency param) is designed for multi-currency but not activated.

### Locale/i18n in Emails

**Implemented**: All transactional emails (order confirmation, shipped, delivered, cancelled, failed, abandoned cart, payment failed) support en/es/de locale with localized subjects, headings, and body text.

**Gap**: Return-related emails are not sent at all (only in-app notifications).

### Error Recovery

| Phase | Error | Recovery |
|---|---|---|
| Cart | API failure | Optimistic rollback + toast |
| Checkout | Session creation failure | Toast error, user retries |
| Payment | Webhook delivery failure | Stripe retries for up to 72h |
| Fulfillment | Printify submission failure | Error recorded, admin notified, retry cron |
| Fulfillment | After 3 retries / 2h timeout | Auto-refund via RefundGuard |
| Fulfillment | `requires_review` > 24h | Auto-refund via retry cron |
| Fulfillment | Printify order:failed | Auto-refund via webhook handler |
| Fulfillment | Printify order:cancelled | Auto-refund via webhook handler |
| Delivery | Provider doesn't send delivered webhook | Cron polling every run |
| Returns | Stripe refund fails | Status reverted to pending, error logged |

### Data Consistency

1. **Stripe <-> Supabase**: Order creation uses `stripe_session_id` uniqueness for idempotency. Payment intent ID linked.
2. **Supabase <-> Printify**: Dual-write columns (`printify_order_id` + `external_order_id`, `printify_error` + `pod_error`). Provider abstraction normalizes data.
3. **Refund consistency**: RefundGuard's atomic pattern prevents double-refunding. DB function `issue_refund_atomic` is the source of truth.
4. **State machine**: Validated transitions prevent impossible states (e.g., refunded -> paid).

---

## Production Blockers

### Critical (Must Fix Before Launch)

| # | Issue | Phase | Impact |
|---|---|---|---|
| 1 | **No checkout cancel page** | Checkout | User sees 404 after canceling Stripe payment |
| 2 | **Return request missing auth** | Returns | Any user can request return for any order |
| 3 | **PATCH cart missing ownership check** | Cart | Defense-in-depth violation |

### High Priority (Should Fix Before Launch)

| # | Issue | Phase | Impact |
|---|---|---|---|
| 4 | Guest-to-auth cart merge | Cart | Guest cart items lost on login |
| 5 | No user-facing returns UI | Returns | Customers cannot self-serve returns |
| 6 | Review purchase check broken | Post-Purchase | All reviews marked as unverified |
| 7 | Stripe Tax not enabled | Checkout | EU VAT compliance risk |
| 8 | `disputed` status not in CHECK constraint | Payment | Using `cancelled` as workaround |
| 9 | No `charge.dispute.closed` handler | Payment | Won disputes leave order cancelled |

### Medium Priority (Fix Post-Launch)

| # | Issue | Phase | Impact |
|---|---|---|---|
| 10 | No PDF invoice generation | Post-Purchase | Business customers need PDF receipts |
| 11 | No partial refund in returns | Returns | Multi-item orders can only full-refund |
| 12 | No express shipping option in Stripe | Checkout | Only standard shipping offered |
| 13 | No post-delivery review email | Post-Purchase | Missed review solicitation opportunity |
| 14 | No webhook event deduplication | Fulfillment | Potential duplicate emails on retry |
| 15 | Retry cron doesn't re-submit to Printify | Fulfillment | "Retry" only marks/refunds, doesn't actually retry |
| 16 | Guest abandoned cart recovery impossible | Post-Purchase | No email for guest carts |
| 17 | Cart cleanup cron for stale guest carts | Cart | DB accumulates orphaned cart items |
| 18 | Stripe metadata size limit risk | Payment | Large carts may exceed 500 char limit per key |

---

## Appendix: File Inventory

### Phase 1: Cart
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/hooks/useCart.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cart/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/cart/CartView.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/cart/CartCrossSell.tsx`

### Phase 2: Checkout
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/checkout/CheckoutView.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/checkout/AddressForm.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/checkout/CheckoutBreadcrumb.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/checkout/create-session/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/[locale]/(focused)/checkout/success/page.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/[locale]/(focused)/checkout/success/CartClearer.tsx`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/stripe-checkout.ts`

### Phase 3: Payment Processing
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/stripe/route.ts`

### Phase 4: Order Fulfillment
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/printify/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/webhooks/pod/[provider]/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/retry-printify-orders/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/pod/` (full directory -- 40+ files)
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/reliability/refund-guard.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/reliability/state-transition.ts`

### Phase 5: Delivery Tracking
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/check-delivery-status/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/reliability/cron-lock.ts`

### Phase 6: Returns & Refunds
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/orders/[id]/returns/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/admin/returns/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/admin/returns/[id]/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/returns/[id]/tracking/route.ts`

### Phase 7: Post-Purchase
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/reviews/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/orders/[id]/reorder/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/orders/[id]/invoice/route.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/cron/abandoned-cart-recovery/route.ts`

### Cross-Cutting
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/store-config.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/middleware.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/resend.ts`
- `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/email-drip.ts`
