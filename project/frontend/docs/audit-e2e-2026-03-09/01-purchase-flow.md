# E2E Purchase Flow Audit — SKAPARA Store

**Date**: 2026-03-09
**Scope**: Complete purchase pipeline from cart to fulfillment
**Status**: RESEARCH ONLY (no code changes)

---

## 1. Architecture Overview

```
                            SKAPARA E2E Purchase Pipeline
 ___________________________________________________________________________
|                                                                           |
|  BROWSER (React 19 + Next.js 16)                                         |
|  ___________________________________     __________________________       |
|  | useCart hook (CartProvider)      |     | CheckoutView.tsx        |     |
|  | - addToCart (POST /api/cart)     |---->| - address selection     |     |
|  | - updateQuantity (PATCH)        |     | - guest email input     |     |
|  | - removeFromCart (PATCH q=0)    |     | - coupon application    |     |
|  | - optimistic UI updates         |     | - gift message toggle   |     |
|  |_________________________________|     | - "Proceed to Payment"  |     |
|                                          |__________________________|     |
|                                                     |                     |
|_________________________________________|___________|_____________________|
                                          |
                                          v
 ___________________________________________________________________________
|                                                                           |
|  NEXT.JS API ROUTES (Server)                                             |
|  ___________________________________                                      |
|  | POST /api/checkout/create-session |                                    |
|  | 1. Rate limit (5/min/IP)          |                                    |
|  | 2. Validate cart items            |                                    |
|  | 3. Check product active status    |                                    |
|  | 4. Check variant availability     |                                    |
|  | 5. Validate coupon code           |                                    |
|  | 6. Resolve composition URLs       |                                    |
|  | 7. Server-side price authority    |                                    |
|  | 8. Create Stripe Checkout Session |                                    |
|  |___________________________________|                                    |
|                  |                                                        |
|__________________|________________________________________________________|
                   |
                   v
 ___________________________________________________________________________
|                                                                           |
|  STRIPE HOSTED CHECKOUT                                                  |
|  - Collects payment info (card, etc.)                                    |
|  - Collects shipping address (if not pre-filled)                         |
|  - On success: redirects to /checkout/success?session_id=cs_xxx          |
|  - On cancel: redirects to /checkout/cancel                              |
|  - Fires webhook: checkout.session.completed                             |
|___________________________________________________________________________|
                   |
                   v
 ___________________________________________________________________________
|                                                                           |
|  POST /api/webhooks/stripe                                               |
|  ___________________________________                                      |
|  | checkout-completed.ts handler    |                                     |
|  | 1. Verify signature (STRIPE_WEBHOOK_SECRET)                           |
|  | 2. Check payment_status === 'paid'                                    |
|  | 3. Idempotency check (stripe_session_id)                             |
|  | 4. Lookup user by email                                               |
|  | 5. INSERT into orders table                                           |
|  | 6. INSERT order_items                                                 |
|  | 7. CREATE notification (in-app)                                       |
|  | 8. Audit log entry                                                    |
|  | 9. Increment coupon usage (if any)                                    |
|  | 10. SUBMIT ORDER TO PRINTFUL ----+                                    |
|  | 11. Send confirmation email       |                                   |
|  |___________________________________|                                   |
|                                      |                                    |
|______________________________________|____________________________________|
                                       |
                                       v
 ___________________________________________________________________________
|                                                                           |
|  PRINTFUL ORDER SUBMISSION                                               |
|  _________________________________                                        |
|  | provider.createOrder()          |                                      |
|  | - Maps internal IDs to Printful IDs (provider_product_id,             |
|  |   external_variant_id)                                                |
|  | - Builds Printful order body via fromCreateOrderInput()               |
|  | - POST /orders?confirm=true (Printful v2 API)                        |
|  | - Updates order: external_order_id, status='submitted'                |
|  | - provider.submitForProduction() (POST /orders/{id}/confirm)          |
|  |_________________________________|                                      |
|                  |                                                        |
|  ON FAILURE:     |                                                        |
|  - pod_error stored on order                                             |
|  - status='requires_review' (if variant mapping missing)                 |
|  - Admin notified via notifications table                                |
|  - Customer emailed re: review required                                  |
|  - Order NOT lost: marked for retry by cron                              |
|___________________________________________________________________________|
                   |
                   v
 ___________________________________________________________________________
|                                                                           |
|  PRINTFUL WEBHOOKS -> POST /api/webhooks/pod/printful                    |
|  Verified by query param ?secret=PRINTFUL_WEBHOOK_SECRET                 |
|  _________________________________                                        |
|  | order.created   -> log only (confirmation)                            |
|  | order.shipped   -> status='shipped', tracking info, email + notif     |
|  | order.delivered -> status='delivered', email + notif                   |
|  | order.cancelled -> auto-refund via RefundGuard, email + notif         |
|  | order.failed    -> auto-refund via RefundGuard, email + notif         |
|  |_________________________________|                                      |
|                                                                           |
|  Dead Letter Queue: webhook_dead_letters table (on handler errors)       |
|  Audit Log: audit_log table (every event)                                |
|___________________________________________________________________________|
                   |
                   v
 ___________________________________________________________________________
|                                                                           |
|  RETRY & RECOVERY (Cron Job)                                             |
|  GET /api/cron/retry-printify-orders (CRON_SECRET auth)                  |
|  - Finds orders in 'paid' with no external_order_id                      |
|  - Retries up to 3 times (30-min window between attempts)               |
|  - Auto-refunds after 3 failures OR 2-hour hard timeout                  |
|  - Auto-refunds 'requires_review' orders > 24 hours old                  |
|  - Uses submitOrderToPOD() reusable function                             |
|  - Uses issueRefund() atomic refund guard                                |
|___________________________________________________________________________|
```

---

## 2. Detailed Flow by User Type

### 2A. Anonymous User (Guest Checkout)

| Step | Component | File:Line | Behavior |
|------|-----------|-----------|----------|
| Browse | Product pages | N/A | No auth required |
| Add to Cart | `useCart.addToCart()` | `hooks/useCart.tsx:80-128` | POST /api/cart with `session_id` cookie (auto-generated UUID, 30-day expiry, httpOnly) |
| Cart Storage | `/api/cart` POST | `app/api/cart/route.ts:241-439` | Inserts to `cart_items` with `session_id`, `user_id=null` |
| Navigate to Checkout | CheckoutView | `components/checkout/CheckoutView.tsx:41` | Shows guest email input (required), NO saved addresses |
| Enter Email | Guest email field | `CheckoutView.tsx:477-504` | Basic regex validation, stored as `guestEmail` state |
| Proceed to Payment | `handleProceedToPayment()` | `CheckoutView.tsx:211-280` | Sends `customerEmail` to create-session |
| Stripe Session | `/api/checkout/create-session` | `app/api/checkout/create-session/route.ts:28-435` | `customer_email` set on session; `shipping_address_collection` with country whitelist (NO pre-filled address) |
| Stripe Checkout | External | Stripe hosted page | Guest enters payment + shipping address |
| Success Redirect | Success page | `app/[locale]/(focused)/checkout/success/page.tsx` | Shows order details, clears cart via CartClearer |
| Webhook | `handleCheckoutCompleted` | `lib/webhooks/stripe/checkout-completed.ts:19-452` | Looks up user by email; if found, sets `user_id`; otherwise `user_id=null` |
| Order Created | Supabase INSERT | `checkout-completed.ts:99-121` | `user_id` may be null for pure guests |
| Notification | In-app | `checkout-completed.ts:178-193` | Only created if `userId` found; guests get NO in-app notification |
| Confirmation Email | Resend | `checkout-completed.ts:428-444` | Sent to `customerEmail` regardless of auth |
| View Orders | `/api/orders` | `app/api/orders/route.ts:17-90` | Requires `requireAuth()` -- **GUEST CANNOT VIEW ORDERS** |

**VERDICT**: Guest can complete a purchase end-to-end. However, they have NO way to view their order status after purchase (orders API requires auth). They receive email confirmation only.

### 2B. Registered Free User (Logged In)

| Step | Component | File:Line | Behavior |
|------|-----------|-----------|----------|
| Cart Merge | POST `/api/cart/merge` | `app/api/cart/merge/route.ts:17-135` | Called after login; merges session cart into user cart (quantity aggregation, ownership transfer) |
| Cart Storage | `/api/cart` | `app/api/cart/route.ts:51-55` | Queries by `user_id` (not session_id) |
| Saved Addresses | CheckoutView | `CheckoutView.tsx:82-106` | Fetches from `/api/shipping-addresses`, auto-selects default |
| Tax Calculation | Auto on address select | `CheckoutView.tsx:109-165` | POST `/api/checkout/calculate-tax` with Stripe Tax API (fallback to simulated rates if inactive) |
| Stripe Session | create-session | `create-session/route.ts:363-367` | If pre-filled address: NO `shipping_address_collection` (Stripe skips address step) |
| Webhook | checkout-completed | `checkout-completed.ts:88-96` | Looks up user by email, sets `user_id` on order |
| Notification | In-app | `checkout-completed.ts:178-193` | Created with `user_id` |
| Order History | `/api/orders` | `app/api/orders/route.ts` | Full paginated history with status filters |

**VERDICT**: Fully functional. Address auto-selection, tax calculation, and order history all work.

### 2C. Premium/Paid User (Subscription)

| Step | Difference from Free | File:Line | Notes |
|------|---------------------|-----------|-------|
| Platform Fees | Lower fee rate | `create-session/route.ts:284-289` | `PLAN_FEE_RATES`: free=10%, starter=5%, pro=3%, enterprise=2% |
| Stripe Connect | Per-tenant routing | `create-session/route.ts:291-331` | Only activates if `x-tenant-id` header and `tenant_configs.stripe:connected_account_id` exists |
| Subscription Events | Tier management | `subscription-handlers.ts:17-112` | `customer.subscription.created/updated` -> updates `users.tier='premium'`, adds 10 bonus credits |
| Invoice Failures | Status tracking | `invoice-handlers.ts:15-79` | Sets `subscription_status='past_due'`, emails user |

**VERDICT**: Premium-specific features (lower platform fees, Stripe Connect routing) are only active for multi-tenant setups with `x-tenant-id` header. For the single-store SKAPARA use case, all users get the same checkout flow. The tier difference is subscription management, not checkout.

---

## 3. Cart System Deep Dive

### 3A. Cart API Routes

| Method | Route | Purpose | Auth Required |
|--------|-------|---------|---------------|
| GET | `/api/cart` | Fetch cart items with product details | No (session_id cookie) |
| POST | `/api/cart` | Add item to cart | No (session_id cookie) |
| PATCH | `/api/cart` | Update quantity or variant | No (session_id cookie) |
| DELETE | `/api/cart` | Clear all cart items | No (session_id cookie) |
| POST | `/api/cart/merge` | Merge guest cart into user cart | Yes (sb-access-token) |
| POST | `/api/cart/shipping-estimate` | Estimate shipping cost by zip | No |

### 3B. Cart Data Model

```
cart_items table:
  id              UUID PK
  product_id      UUID FK -> products
  variant_id      UUID FK -> product_variants (REQUIRED)
  quantity         int
  user_id         UUID FK -> users (nullable - null for guests)
  session_id      text (nullable - null for logged-in users)
  personalization_id UUID FK -> personalizations (nullable)
  composition_id  UUID FK -> design_compositions (nullable)
  created_at      timestamp
  updated_at      timestamp
```

### 3C. Cart Security Analysis

- **Ownership scoping**: Queries always filter by `user_id` OR `session_id` -- no unscoped queries
- **PATCH/DELETE guards**: Require `userId || sessionId` check before proceeding (`route.ts:458-463`)
- **Quantity cap**: `MAX_CART_QUANTITY = 99` enforced on both add and update
- **Product validation**: Active status + soft-delete check on add (`route.ts:274-287`)
- **Variant resolution**: Must resolve to valid, enabled, available variant (`route.ts:291-339`)
- **Using supabaseAdmin**: Cart API uses service-role client (bypasses RLS). This is intentional because session-based guests have no Supabase auth, but it means RLS on `cart_items` is NOT enforced.

---

## 4. Stripe Integration

### 4A. Environment Variables Required

| Variable | Used By | Purpose |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | `lib/stripe.ts` | Server-side Stripe client |
| `STRIPE_WEBHOOK_SECRET` | `webhooks/stripe/route.ts:42` | Webhook signature verification |
| `STRIPE_CRYPTO_ENABLED` | `create-session/route.ts:278` | Optional crypto payment method |

### 4B. Stripe Client Configuration

- **File**: `frontend/src/lib/stripe.ts`
- **API Version**: `2026-01-28.clover`
- **Pattern**: Lazy singleton via Proxy (created on first property access)
- **Tax Calculation**: `calculateTax()` uses Stripe Tax API with apparel tax code `txcd_20030000`
- **Tax Fallback**: If Stripe Tax not activated (`stripe_tax_inactive`), falls back to hardcoded state-based rates (US only: CA 7.25%, NY 8%, etc.) with 7% default

### 4C. Checkout Session Configuration

Created at `create-session/route.ts:343-418`:

```typescript
{
  mode: 'payment',
  payment_method_types: ['card'],  // + 'crypto' if STRIPE_CRYPTO_ENABLED
  line_items: [...],               // Server-side price authority (DB variant prices override client)
  success_url: '/{locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}',
  cancel_url: '/{locale}/checkout/cancel',
  locale: 'en' | 'es' | 'de',
  shipping_address_collection: { allowed_countries: [...12 countries] },  // only if no pre-filled address
  shipping_options: [{ ... }],     // Free >50 EUR, else 4.99 EUR
  automatic_tax: { enabled: false },  // DISABLED for now
  metadata: {
    locale, cart_items (JSON), gift_message, coupon_code
  }
}
```

**Key observations**:
- `automatic_tax: { enabled: false }` -- Stripe Tax not integrated into checkout session, only available as separate calculate-tax endpoint
- Server-side price authority: DB variant prices override whatever the client sends (`create-session/route.ts:189-213`)
- Cart items serialized into `metadata.cart_items` (Stripe metadata has 500-char limit per value -- potential truncation for large carts)

### 4D. Stripe Webhook Events Handled

| Event | Handler | File |
|-------|---------|------|
| `checkout.session.completed` | `handleCheckoutCompleted` | `lib/webhooks/stripe/checkout-completed.ts` |
| `customer.subscription.created` | `handleSubscriptionUpdate` | `lib/webhooks/stripe/subscription-handlers.ts` |
| `customer.subscription.updated` | `handleSubscriptionUpdate` | same |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | same |
| `payment_intent.succeeded` | Log only | `webhooks/stripe/route.ts:68` |
| `payment_intent.payment_failed` | Log only | `webhooks/stripe/route.ts:72` |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | `lib/webhooks/stripe/invoice-handlers.ts` |
| `charge.dispute.created` | `handleChargeDisputeCreated` | `lib/webhooks/stripe/dispute-handlers.ts` |
| `charge.refunded` | `handleChargeRefunded` | `lib/webhooks/stripe/charge-refunded.ts` |

---

## 5. Order Creation (checkout-completed.ts)

### 5A. Step-by-Step Flow

1. **Guard**: Skip if `payment_status !== 'paid'`
2. **Idempotency**: Check `orders.stripe_session_id` -- skip if order exists
3. **User lookup**: Query `users.email` to find `user_id` (null for pure guests)
4. **Order INSERT**: `orders` table with status='paid'
5. **Order items INSERT**: Maps Stripe line items to `order_items` (indexed by position)
6. **Notification**: In-app notification (only for authenticated users)
7. **Audit log**: `audit_log` table entry
8. **Coupon increment**: `increment_coupon_usage` RPC (idempotent via order_id)
9. **POD submission**: Full Printful order creation (see section 6)
10. **Email**: Confirmation email via Resend

### 5B. Order Data Model

```
orders table:
  id                     UUID PK
  user_id                UUID FK (nullable - guest orders)
  stripe_session_id      text UNIQUE (idempotency key)
  stripe_payment_intent_id text
  status                 text (paid -> submitted -> in_production -> shipped -> delivered | refunded | cancelled | failed | disputed | requires_review)
  total_cents            int
  currency               text
  shipping_address       jsonb
  customer_email         text
  locale                 text
  gift_message           text
  payment_method         text
  paid_at                timestamp
  shipped_at             timestamp
  delivered_at           timestamp
  tracking_number        text
  tracking_url           text
  carrier                text
  external_order_id      text (Printful order ID)
  pod_provider           text
  pod_error              text
  pod_retry_count        int
  pod_last_attempt_at    timestamp
  retry_count            int
  refunded_at            timestamp
  refund_amount_cents    int
  refund_reason          text
  stripe_refund_id       text

order_items table:
  id                     UUID PK
  order_id               UUID FK -> orders
  product_id             UUID FK -> products
  variant_id             UUID FK -> product_variants (NOT NULL)
  personalization_id     UUID FK (nullable)
  composition_id         UUID FK (nullable)
  quantity               int
  unit_price_cents       int
```

### 5C. Order State Machine

Defined in `lib/reliability/state-transition.ts:24-38`:

```
pending ---------> paid -----------> submitted ---------> in_production ----> shipped ----> delivered
    |               |                    |                     |                 |              |
    +-> cancelled   +-> cancelled        +-> cancelled         +-> cancelled     +-> refunded   +-> refunded
                    +-> requires_review  +-> requires_review   +-> requires_review
                    +-> refunded         +-> shipped (skip)

requires_review --> paid | cancelled | refunded
cancelled       --> (terminal)
refunded        --> (terminal)
failed          --> (terminal)
disputed        --> (terminal)
```

---

## 6. Printful Order Submission

### 6A. Two-Step Process

Invoked within `handleCheckoutCompleted` at `checkout-completed.ts:247-417`:

**Step 1: Create Order**
```
provider.createOrder(input) --> PrintfulProvider.createOrder()
  --> mapper.fromCreateOrderInput(input)
  --> client.createOrder(body, confirm=true)
  --> POST https://api.printful.com/v2/orders?confirm=true
```

**Step 2: Submit for Production**
```
provider.submitForProduction(externalId)
  --> client.confirmOrder(id)
  --> POST https://api.printful.com/v2/orders/{id}/confirm
```

### 6B. Order Body Structure (Printful v2)

Built by `fromCreateOrderInput()` at `lib/pod/printful/mapper.ts:171-201`:

```json
{
  "external_id": "<supabase-order-uuid>",
  "label": "SKAPARA ABCD1234",
  "shipping": "STANDARD",
  "recipient": {
    "name": "John Doe",
    "address1": "123 Main St",
    "city": "Berlin",
    "country_code": "DE",
    "zip": "10115",
    "email": "customer@example.com"
  },
  "items": [
    {
      "sync_variant_id": 123456,
      "quantity": 2,
      "files": [                    // Only for custom designs (composition_id)
        { "type": "default", "url": "https://..." }
      ]
    }
  ],
  "gift": {                         // Only if gift_message present
    "subject": "A gift for you from SKAPARA",
    "message": "..."
  }
}
```

### 6C. Provider ID Mapping

The system maps internal Supabase IDs to Printful IDs:

```
products.provider_product_id   --> Printful sync product ID
product_variants.external_variant_id --> Printful sync variant ID
```

Both are fetched from Supabase and validated before submission:
- If any item has missing or '0' variant mapping --> order marked as `requires_review`, admin notified

### 6D. Error Handling Matrix

| Failure Point | Handling | Order Status | User Notified |
|--------------|----------|--------------|---------------|
| Missing variant mapping | Skip POD, mark `requires_review` | `requires_review` | Email + admin notif |
| `createOrder()` throws | Catch, store error | `paid` (stays) | Email + admin notif |
| `submitForProduction()` throws | Catch, store error, `pod_retry_count=1` | `paid` (stays) | Email + admin notif |
| No shipping address | Skip POD entirely | `paid` | Log only |
| No valid line items | Skip POD | `paid` | Log only |

### 6E. Retry Mechanism

Cron job at `/api/cron/retry-printify-orders` (`route.ts:32-226`):

| Condition | Action |
|-----------|--------|
| `paid` + no `external_order_id` + within 30min | Re-submit via `submitOrderToPOD()` |
| `paid` + retry_count >= 3 | Auto-refund via `issueRefund()` |
| `paid` + older than 2 hours | Auto-refund (hard timeout) |
| `requires_review` + older than 24 hours | Auto-refund |

**Refund Guard** (`lib/reliability/refund-guard.ts`):
- Two-phase: Stripe refund first, then atomic DB recording via `issue_refund_atomic` RPC
- If DB says already refunded: cancels the Stripe refund
- CRITICAL: uses `stripe.refunds.cancel()` for rollback -- this only works if the refund hasn't been processed yet

---

## 7. POD Provider Webhooks

### 7A. Unified Webhook Route

`POST /api/webhooks/pod/[provider]` where provider = 'printify' | 'printful'

File: `app/api/webhooks/pod/[provider]/route.ts`

Flow:
1. Validate provider ID against known set
2. Read raw body
3. Initialize provider (`initializeProviders()`)
4. Verify signature (Printful: `?secret=` query param)
5. Normalize event to canonical format
6. Write audit log
7. Route via WebhookRouter

### 7B. Registered Event Handlers

| Event Type | Handler | Behavior |
|------------|---------|----------|
| `order.created` | `handleOrderCreated` | Log-only confirmation |
| `order.updated` | `handleOrderCreated` | Log-only (same handler) |
| `order.shipped` | `handleOrderShipped` | Update status, tracking info, email + notification |
| `order.delivered` | `handleOrderDelivered` | Update status, email + notification with review prompt |
| `order.cancelled` | `handleOrderCancelled` | Auto-refund + state transition + email |
| `order.failed` | `handleOrderFailed` | Auto-refund + state transition + email |
| `product.created` | `handleProductUpdated` | Sync product data |
| `product.updated` | `handleProductUpdated` | Sync product data |
| `product.publish_succeeded` | `handleProductUpdated` | Sync product data |
| `product.deleted` | `handleProductDeleted` | Soft-delete product |
| `stock.updated` | `handleStockUpdated` | Update variant availability |

### 7C. Order Lookup Strategy

Defined in `lib/pod/webhooks/handlers/utils.ts:16-45`:

1. **Strategy 1**: Provider's `data.order.external_id` = our Supabase UUID --> `orders.id`
2. **Strategy 2**: Provider's resource ID --> `orders.external_order_id`
3. **Fallback**: Returns null (handler throws)

### 7D. Dead Letter Queue

On handler error (`/api/webhooks/pod/[provider]/route.ts:141-154`):
- Inserts to `webhook_dead_letters` table: provider, event_type, event_id, resource_id, payload, error
- Still returns 200 to prevent provider retries
- Errors are persisted for later investigation

---

## 8. Stripe Webhook Handlers (Non-Purchase)

### 8A. Refund Handling (`charge.refunded`)

File: `lib/webhooks/stripe/charge-refunded.ts`

- Finds order by `stripe_payment_intent_id`
- Idempotency: skips if `stripe_refund_id` already set or status='refunded'
- Determines full vs partial refund
- Updates order with refund details
- Creates user notification
- Audit log entry

### 8B. Dispute Handling (`charge.dispute.created`)

File: `lib/webhooks/stripe/dispute-handlers.ts`

- Finds order by `stripe_payment_intent_id`
- Sets order status to 'disputed' (terminal state -- fulfillment paused)
- Creates admin notifications (all admin users)
- Fires fallback alert to `/api/admin/alert`
- Audit log entry

### 8C. Invoice Payment Failed

File: `lib/webhooks/stripe/invoice-handlers.ts`

- Finds user by Stripe customer ID
- Sets `subscription_status='past_due'`
- Emails user with payment update link
- Alerts admin

---

## 9. Environment Variables Summary

| Variable | Service | Required For |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | Stripe | All server-side Stripe operations |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook signature verification |
| `STRIPE_CRYPTO_ENABLED` | Stripe | Optional crypto payment method |
| `PRINTFUL_API_TOKEN` | Printful | POD provider authentication |
| `PRINTFUL_STORE_ID` | Printful | Store identification |
| `PRINTFUL_WEBHOOK_SECRET` | Printful | Webhook verification |
| `PRINTFUL_TOKEN_EXPIRES_AT` | Printful | Optional token expiry tracking |
| `SUPABASE_URL` | Supabase | Database connection |
| `SUPABASE_SERVICE_KEY` | Supabase | Service role (bypasses RLS) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Anon client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Anon client |
| `RESEND_API_KEY` | Resend | Email sending |
| `RESEND_FROM_EMAIL` | Resend | Sender address |
| `CRON_SECRET` | Cron | Retry cron authentication |

---

## 10. Current Gaps & Risks

### CRITICAL

| # | Gap | Impact | Location |
|---|-----|--------|----------|
| C1 | **Stripe metadata truncation**: `cart_items` is serialized into `session.metadata.cart_items`. Stripe limits metadata values to 500 characters. A cart with 5+ items with UUIDs will exceed this. If truncated, order items creation fails silently (items array is empty or invalid JSON). | Order created but no order_items, POD submission skipped | `create-session/route.ts:393-400` |
| C2 | **Guest orders are invisible**: Orders API (`/api/orders`) requires `requireAuth()`. Guest users who purchased with email have NO way to view order status, tracking info, or request returns. Only email notifications inform them. | Poor guest UX, support burden | `app/api/orders/route.ts:20-24` |
| C3 | **No checkout cancel page**: The `cancel_url` points to `/{locale}/checkout/cancel` but no corresponding page exists (glob search returned no files). Users hitting "Back" on Stripe Checkout land on a 404. | Broken cancel flow | `create-session/route.ts:274` |
| C4 | **Tax disabled in checkout**: `automatic_tax: { enabled: false }` in the Stripe session. The separate tax calculation endpoint exists but its result is NOT passed to Stripe. EU VAT is not collected. | Tax compliance violation for EU sales | `create-session/route.ts:359-361` |

### HIGH

| # | Gap | Impact | Location |
|---|-----|--------|----------|
| H1 | **No email verification for guest checkout**: Any email address is accepted. Typos mean no confirmation email, no way to look up order. No duplicate-email-check. | Customer loses order access | `CheckoutView.tsx:205-208` |
| H2 | **Cart uses supabaseAdmin for all operations**: All cart API calls bypass RLS. While ownership is enforced in application code, a bug in the ownership check could expose other users' carts. | Potential data leak if ownership logic fails | `app/api/cart/route.ts:23, 254, 448` |
| H3 | **submitOrderToPOD uses shipping_address_id field**: The reusable retry function (`submit-order-to-pod.ts:44-48`) queries `shipping_addresses` table by `order.shipping_address_id`. But `handleCheckoutCompleted` stores shipping as inline JSONB (`order.shipping_address`), NOT as a foreign key. The cron retry function will ALWAYS fail to find the shipping address. | Retries always fail, leading to auto-refund | `lib/pod/submit-order-to-pod.ts:23-48` vs `checkout-completed.ts:46-57` |
| H4 | **Stripe Connect tenant routing without validation**: The `x-tenant-id` header is read from the request but there's no validation that the caller is authorized for that tenant. A malicious client could route payments to arbitrary connected accounts. | Payment routing manipulation | `create-session/route.ts:294` |
| H5 | **Order items index mapping is fragile**: `lineItems[index]` is matched with `cartItems[index]` to create order_items. If Stripe reorders line items or the coupon discount creates a misalignment, product_id/variant_id mapping breaks. | Wrong products linked to order | `checkout-completed.ts:126-137` |

### MEDIUM

| # | Gap | Impact | Location |
|---|-----|--------|----------|
| M1 | **Shipping address not always passed to Printful**: If the user selects a saved address in CheckoutView, the address is NOT passed in the `create-session` body (only `shippingAddress: undefined` triggers Stripe's address collection). But if address IS passed, Stripe's `shipping_address_collection` is skipped, and the webhook reads from `session.collected_information.shipping_details` which may be null. | Printful order submitted without shipping address | `create-session/route.ts:362-367` and `checkout-completed.ts:46-57` |
| M2 | **No stock reservation**: Adding to cart does not reserve stock. Between adding and paying, the variant could become unavailable. The create-session check catches this, but the user loses their checkout progress. | Frustrating UX at checkout | `create-session/route.ts:92-133` |
| M3 | **Tax fallback uses US state rates for EU store**: The tax calculation fallback (`stripe.ts:121-143`) uses US state codes (CA, NY, TX, etc.) with a 7% default. SKAPARA is an EU store. EU customers would get incorrect tax estimates. | Misleading tax display | `lib/stripe.ts:127-134` |
| M4 | **Coupon discount as negative line item removed**: The code creates a Stripe coupon via `stripe.coupons.create()` with `amount_off` and attaches via `discounts[]`. But the coupon ID is stored on the lineItems array as a property hack (`(lineItems as any)._stripeCouponId`). This is fragile and could break if lineItems is cloned or serialized. | Coupon might not apply | `create-session/route.ts:267-268` |
| M5 | **No Stripe webhook idempotency beyond session check**: The checkout-completed handler checks for existing order by `stripe_session_id`. But if the webhook fires, order creation succeeds, and then the webhook fires again before order_items are created, order_items could be duplicated (no UNIQUE constraint visible). | Duplicate order items | `checkout-completed.ts:75-84` |
| M6 | **Refund guard race condition window**: The `issueRefund` function creates the Stripe refund FIRST, then atomically records in DB. If the process crashes between these steps, a Stripe refund exists with no DB record. The cancellation attempt may fail if the refund was already processed. | Orphaned Stripe refund | `lib/reliability/refund-guard.ts:64-82` |
| M7 | **`order.updated` routed to log-only handler**: The webhook router maps `order.updated` to `handleOrderCreated` which only logs. If Printful sends status updates via `order.updated` (e.g., status change to `in_production`), they're silently ignored. | Missing status updates | `lib/pod/webhooks/index.ts:24` |

### LOW

| # | Gap | Impact | Location |
|---|-----|--------|----------|
| L1 | **No abandoned cart recovery**: No mechanism to email users who started checkout but didn't complete payment. | Lost revenue | N/A |
| L2 | **Gift message not passed to Printful**: The `gift_message` is stored in order metadata and the Stripe session, but `handleCheckoutCompleted` does not pass it to `provider.createOrder()` despite the mapper supporting it (`fromCreateOrderInput` accepts `giftMessage`). | Gift message not printed/included | `checkout-completed.ts:332-343` (no `isGift`/`giftMessage` in input) |
| L3 | **Shipping estimate endpoint disconnected**: `/api/cart/shipping-estimate` queries `shipping_zones` table but the actual Stripe checkout uses hardcoded shipping (free >50 EUR, else 4.99 EUR). The estimate endpoint and checkout use different shipping logic. | Inconsistent shipping quotes | `create-session/route.ts:369-390` vs `cart/shipping-estimate/route.ts` |
| L4 | **No inventory sync from Printful**: There's a `stock.updated` webhook handler, but there's no periodic sync to check Printful stock levels. Stock availability depends entirely on webhooks arriving. | Stale stock data if webhook missed | `lib/pod/webhooks/handlers/stock-updated.ts` |
| L5 | **Checkout page has no address pre-fill for guests**: Guests must enter their shipping address on Stripe's hosted page. There's no way to pre-fill it from the checkout view (only saved addresses for logged-in users). | Extra friction for guests | `CheckoutView.tsx:477-504` |

---

## 11. Recommendations

### Immediate (Pre-Launch Blockers)

1. **Fix metadata truncation (C1)**: Use Stripe's `metadata` field only for a reference ID. Store full cart items in Supabase (e.g., a `checkout_sessions` table) and reference by ID. Or use `client_reference_id` on the Stripe session.

2. **Create checkout cancel page (C3)**: Add `frontend/src/app/[locale]/(focused)/checkout/cancel/page.tsx` with a "Return to cart" CTA.

3. **Fix shipping address schema mismatch (H3)**: The `submitOrderToPOD` function reads `order.shipping_address_id` (FK) but `handleCheckoutCompleted` stores shipping as inline JSONB at `order.shipping_address`. Either:
   - Change `submitOrderToPOD` to read inline `shipping_address` JSONB, OR
   - Have `handleCheckoutCompleted` create a `shipping_addresses` record and store the FK

4. **Enable EU tax collection (C4)**: Enable `automatic_tax: { enabled: true }` in the Stripe session config. Requires Stripe Tax activation in the dashboard.

### Short-Term (First 30 Days)

5. **Guest order lookup**: Create `/api/orders/lookup` endpoint that accepts email + order ID (first 8 chars) without auth. Rate-limit heavily.

6. **Fix gift message passthrough (L2)**: Pass `giftMessage` from `session.metadata.gift_message` to the `createOrder` input.

7. **Validate tenant ID (H4)**: If Stripe Connect is used, validate `x-tenant-id` against the user's tenant membership.

8. **Handle `order.updated` events (M7)**: Create a proper handler that updates order status (e.g., `in_production`).

9. **Fix tax fallback for EU (M3)**: Replace US state tax rates with EU VAT rates (19% DE, 21% ES, etc.) or disable the fallback entirely.

### Medium-Term

10. **Abandoned cart emails**: Track checkout session creation without completion; trigger email after 1 hour.

11. **Stock reservation**: Implement 15-minute stock hold when checkout session is created. Release on session expiry.

12. **Reconcile shipping logic (L3)**: Unify shipping rate calculation between the estimate endpoint and Stripe checkout.

---

## 12. File Reference Index

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useCart.tsx` | Cart context provider + hooks |
| `frontend/src/app/api/cart/route.ts` | Cart CRUD API |
| `frontend/src/app/api/cart/merge/route.ts` | Guest-to-user cart merge |
| `frontend/src/app/api/cart/shipping-estimate/route.ts` | Shipping estimate by zip |
| `frontend/src/components/checkout/CheckoutView.tsx` | Checkout UI component |
| `frontend/src/components/checkout/AddressForm.tsx` | Address form component |
| `frontend/src/components/checkout/CheckoutBreadcrumb.tsx` | Breadcrumb navigation |
| `frontend/src/app/api/checkout/create-session/route.ts` | Stripe session creation |
| `frontend/src/app/api/checkout/calculate-tax/route.ts` | Tax calculation endpoint |
| `frontend/src/lib/stripe.ts` | Stripe client + tax calculation |
| `frontend/src/lib/stripe-checkout.ts` | Session retrieval utility |
| `frontend/src/app/[locale]/(focused)/checkout/success/page.tsx` | Post-payment success page |
| `frontend/src/app/api/webhooks/stripe/route.ts` | Stripe webhook dispatcher |
| `frontend/src/lib/webhooks/stripe/checkout-completed.ts` | Order creation + POD submission |
| `frontend/src/lib/webhooks/stripe/subscription-handlers.ts` | Subscription management |
| `frontend/src/lib/webhooks/stripe/invoice-handlers.ts` | Payment failure handling |
| `frontend/src/lib/webhooks/stripe/dispute-handlers.ts` | Chargeback handling |
| `frontend/src/lib/webhooks/stripe/charge-refunded.ts` | Refund sync from Stripe |
| `frontend/src/lib/webhooks/stripe/shared.ts` | Shared utilities (supabase, email, admin notify) |
| `frontend/src/app/api/webhooks/pod/[provider]/route.ts` | Unified POD webhook endpoint |
| `frontend/src/lib/pod/index.ts` | Provider abstraction entry point |
| `frontend/src/lib/pod/types.ts` | Provider interfaces (ISP) |
| `frontend/src/lib/pod/printful/index.ts` | PrintfulProvider implementation |
| `frontend/src/lib/pod/printful/client.ts` | Raw Printful API client |
| `frontend/src/lib/pod/printful/mapper.ts` | Printful <-> canonical mapper |
| `frontend/src/lib/pod/submit-order-to-pod.ts` | Reusable order submission (retry cron) |
| `frontend/src/lib/pod/webhooks/webhook-router.ts` | Event -> handler routing |
| `frontend/src/lib/pod/webhooks/index.ts` | Router factory with all handlers |
| `frontend/src/lib/pod/webhooks/handlers/order-shipped.ts` | Shipped status + tracking |
| `frontend/src/lib/pod/webhooks/handlers/order-delivered.ts` | Delivered status |
| `frontend/src/lib/pod/webhooks/handlers/order-cancelled.ts` | Cancel + auto-refund |
| `frontend/src/lib/pod/webhooks/handlers/order-failed.ts` | Failure + auto-refund |
| `frontend/src/lib/pod/webhooks/handlers/utils.ts` | Order/product lookup utilities |
| `frontend/src/lib/reliability/refund-guard.ts` | Atomic refund processing |
| `frontend/src/lib/reliability/state-transition.ts` | Order state machine |
| `frontend/src/app/api/cron/retry-printify-orders/route.ts` | Stuck order retry + auto-refund |
| `frontend/src/app/api/orders/route.ts` | Order history API |
| `frontend/src/lib/store-config.ts` | Store defaults, shipping countries, pricing |

---

*End of audit. No code was modified.*
