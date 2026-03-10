# Checkout & Payment Flow — Complete Audit

**Date**: 2026-03-08
**Scope**: Cart system, Checkout flow, Stripe integration, Subscriptions, Credits, Payment methods, Security
**Files audited**: 28 files across `app/api/`, `lib/`, `hooks/`, `components/`

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Cart System](#2-cart-system)
3. [Checkout Flow](#3-checkout-flow)
4. [Stripe Integration](#4-stripe-integration)
5. [Webhook Handlers](#5-webhook-handlers)
6. [Subscription & Credits System](#6-subscription--credits-system)
7. [Payment Methods Management](#7-payment-methods-management)
8. [Coupon System](#8-coupon-system)
9. [Security Analysis](#9-security-analysis)
10. [Critical Findings](#10-critical-findings)
11. [Recommendations](#11-recommendations)

---

## 1. Architecture Overview

### End-to-End Flow Diagram

```
CUSTOMER                    NEXT.JS API                     STRIPE                    SUPABASE                 POD PROVIDER
   |                           |                              |                          |                        |
   |-- Browse shop ---------->|                              |                          |                        |
   |-- Add to cart (POST) --->| /api/cart                    |                          |                        |
   |                          |--- validate product -------->|                          |-- products table ----->|
   |                          |--- resolve variant --------->|                          |-- product_variants --->|
   |                          |--- upsert cart_items ------->|                          |-- cart_items --------->|
   |<-- cart updated ---------|                              |                          |                        |
   |                           |                              |                          |                        |
   |-- /checkout ------------>| CheckoutView.tsx             |                          |                        |
   |                          |--- fetch addresses --------->|                          |-- shipping_addresses ->|
   |                          |--- calculate tax ----------->| Stripe Tax API           |                        |
   |                           |                              |                          |                        |
   |-- "Pay Now" ------------>| /api/checkout/create-session |                          |                        |
   |                          |--- rate limit check          |                          |                        |
   |                          |--- validate products ------->|                          |-- products/variants -->|
   |                          |--- validate coupon --------->|                          |-- coupons table ------>|
   |                          |--- server-side price auth -->|                          |-- variant prices ----->|
   |                          |--- create coupon (if any) -->| stripe.coupons.create    |                        |
   |                          |--- create session ---------->| stripe.checkout.create   |                        |
   |<-- redirect to Stripe ---|                              |                          |                        |
   |                           |                              |                          |                        |
   |-- Complete payment ----->|                              | Payment processed        |                        |
   |                          |                              |                          |                        |
   |                          | /api/webhooks/stripe <-------| checkout.session.completed                        |
   |                          |--- idempotency check ------->|                          |-- orders check ------->|
   |                          |--- create order ------------->|                          |-- INSERT orders ------>|
   |                          |--- create order items ------->|                          |-- INSERT order_items ->|
   |                          |--- create notification ------>|                          |-- notifications ------>|
   |                          |--- create audit log --------->|                          |-- audit_log ---------> |
   |                          |--- increment coupon usage --->|                          |-- UPDATE coupons ----->|
   |                          |--- submit to POD provider --->|                          |                        |-- createOrder -->
   |                          |--- submit for production ---->|                          |                        |-- submitForProd ->
   |                          |--- send confirmation email -->| (Resend)                 |                        |
   |                           |                              |                          |                        |
   |<-- redirect to success --|                              |                          |                        |
   |-- /checkout/success ---->| Success page                 |                          |                        |
   |                          |--- retrieve session -------->| stripe.sessions.retrieve |                        |
   |                          |--- clear cart (CartClearer) ->|                          |-- DELETE cart_items -->|
```

### Key Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend Cart | React Context (`useCart` hook), optimistic updates |
| Frontend Checkout | `CheckoutView.tsx` in `(focused)` route group |
| Cart API | `/api/cart` (GET/POST/PATCH/DELETE), supabaseAdmin |
| Checkout API | `/api/checkout/create-session`, Stripe Checkout Sessions |
| Payment | Stripe Checkout (hosted), card + optional crypto |
| Webhooks | `/api/webhooks/stripe`, signature-verified dispatcher |
| Order Creation | `checkout-completed.ts` webhook handler |
| Fulfillment | POD provider abstraction (`@/lib/pod`) |
| Notifications | Supabase `notifications` table + Resend email |
| CSRF | Double-submit cookie pattern via middleware |
| Rate Limiting | In-memory `RateLimiter` class (per-instance) |

---

## 2. Cart System

### 2.1 API Endpoints

**File**: `frontend/src/app/api/cart/route.ts`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cart` | Optional | Fetch cart items (user or guest) |
| POST | `/api/cart` | Optional | Add item to cart |
| PATCH | `/api/cart` | Optional | Update quantity or variant |
| DELETE | `/api/cart` | Optional | Clear all cart items |
| POST | `/api/cart/merge` | Required | Merge guest cart into user cart |
| POST | `/api/cart/shipping-estimate` | None | Calculate shipping estimate |

### 2.2 Cart Identity Model

```
Authenticated user:  cart_items.user_id = auth.uid()
Guest:               cart_items.session_id = cookie("cart-session-id")
```

- **Guest session**: `cart-session-id` cookie, httpOnly, 30-day TTL, generated via `crypto.randomUUID()`
- **Cookie flags**: `httpOnly: true`, `secure: production`, `sameSite: lax`

### 2.3 Cart Item Schema (inferred from queries)

```
cart_items:
  id            UUID PK
  product_id    UUID FK -> products
  variant_id    UUID FK -> product_variants
  quantity      integer
  user_id       UUID FK -> users (nullable)
  session_id    text (nullable)
  personalization_id  UUID FK -> personalizations (nullable)
  composition_id      UUID FK -> design_compositions (nullable)
  created_at    timestamptz
  updated_at    timestamptz
```

### 2.4 Add-to-Cart Logic (POST)

1. Validate `product_id` and `quantity >= 1`
2. Verify product exists, is active, and not soft-deleted
3. Resolve `variant_id` from `variant_details` (size/color)
4. If no variant match and multiple available: return `VARIANT_REQUIRED` (400)
5. If only one variant: auto-select
6. If zero variants: return `NO_VARIANTS` (400)
7. Check for existing item (same product + variant + personalization + composition)
8. If exists: increment quantity (capped at `MAX_CART_QUANTITY = 99`)
9. If new: insert cart item

### 2.5 Cart Merge on Login

**File**: `frontend/src/app/api/cart/merge/route.ts`

Called after authentication to transfer guest cart items:

1. Requires `sb-access-token` (auth required)
2. Fetches guest items by `session_id`
3. For each guest item:
   - If user has same product+variant+personalization+composition: merge quantities (capped)
   - Otherwise: transfer ownership (`user_id = userId, session_id = null`)
4. Deletes duplicate guest items after merge

### 2.6 Client-Side Cart Hook

**File**: `frontend/src/hooks/useCart.tsx`

- React Context pattern (`CartProvider` + `useCart`)
- Uses `apiFetch` for CSRF-protected mutations
- Optimistic updates for `removeFromCart` and `updateQuantity` with rollback on error
- `refreshCart` on mount and when `user` changes (handles login/logout transitions)
- `addToCart` handles `VARIANT_REQUIRED` code with `toast.info`

### 2.7 Shipping Estimate

**File**: `frontend/src/app/api/cart/shipping-estimate/route.ts`

- Queries `shipping_zones` table by country code
- Matches zip code via SQL LIKE patterns converted to regex
- Calculates: `base_rate + per_item_rate * (itemCount - 1)`
- Free shipping check: `cartTotal >= free_shipping_threshold`
- No auth required (public endpoint)

---

## 3. Checkout Flow

### 3.1 UI Flow

**File**: `frontend/src/components/checkout/CheckoutView.tsx`
**Route**: `/[locale]/checkout` in `(focused)` route group (minimal layout, no sidebar)

```
CartView                        CheckoutView                      Stripe Checkout
  |                                |                                   |
  |-- "Proceed to Checkout" ----->|                                   |
  |   (authenticated)             |                                   |
  |-- "Guest Checkout" ---------->|                                   |
  |   (?guest=true)               |                                   |
  |                                |                                   |
  |                                |-- Load saved addresses            |
  |                                |-- Select/add address              |
  |                                |-- Calculate tax (auto)            |
  |                                |-- Optional: gift message          |
  |                                |-- Optional: coupon (from session) |
  |                                |                                   |
  |                                |-- "Pay Now" ---------------------->|
  |                                |   POST /api/checkout/create-session|
  |                                |   -> window.location.href = url   |
  |                                |                                   |
  |                                |                                   |-- Stripe hosted checkout
  |                                |                                   |-- Payment processed
  |                                |                                   |
  |                                | /checkout/success <---------------|
  |                                |   CartClearer (auto)              |
  |                                |   Order details display           |
  |                                |                                   |
  |                                | /checkout/cancel <----------------|
  |                                |   "Return to Cart" button         |
```

### 3.2 Checkout Session Creation

**File**: `frontend/src/app/api/checkout/create-session/route.ts`

**Rate limit**: 5 requests/minute per IP (`checkoutLimiter`)

**Validation chain** (in order):
1. Rate limit check
2. Cart items non-empty and is array
3. All items have `variant_id` (required for Printful fulfillment)
4. All products are active and not soft-deleted
5. All variant combinations are available (`is_available = true`)
6. Coupon validation (if provided): active, meets minimum, has uses left
7. Resolve production URLs for custom designs (design_compositions table)
8. **Server-side price authority**: overrides client prices with DB variant `price_cents`

**Shipping configuration**:
- Free shipping for orders >= 50 EUR (`STORE_DEFAULTS.freeShippingThreshold`)
- Standard shipping: 4.99 EUR
- Delivery estimate: 5-7 business days
- Allowed countries: DE, FR, ES, IT, NL, BE, AT, PT, IE, GB, US, CA

**Payment methods**: `['card']` + optional `'crypto'` (env var `STRIPE_CRYPTO_ENABLED`)

**Stripe Connect** (multi-tenant):
- Reads `x-tenant-id` header from middleware
- Looks up `stripe:connected_account_id` from `tenant_configs`
- Applies platform fee based on tenant plan:
  - Free: 10%, Starter: 5%, Pro: 3%, Enterprise: 2%
- Routes payment to connected account via `transfer_data.destination`

**Session metadata** (passed to webhook):
- `locale`
- `cart_items` (JSON array: product_id, variant_id, quantity, personalization_id, composition_id, production_urls)
- `gift_message` (truncated to 200 chars)
- `coupon_code` (if coupon applied)

### 3.3 Tax Calculation

**File**: `frontend/src/app/api/checkout/calculate-tax/route.ts`
**Stripe lib**: `frontend/src/lib/stripe.ts` (`calculateTax` function)

- Uses Stripe Tax API with tax code `txcd_20030000` (Apparel - general)
- Shipping taxed as `txcd_92010001`
- **Fallback**: When Stripe Tax is inactive (common in test mode), uses simulated US state tax rates (7% default)
- Tax calculation triggered when user selects a shipping address in CheckoutView
- **Note**: `automatic_tax.enabled = false` in the checkout session config (disabled)

### 3.4 Checkout Success Page

**File**: `frontend/src/app/[locale]/(focused)/checkout/success/page.tsx`

- Server component that retrieves Stripe session via `getCheckoutSession(session_id)`
- Validates session ID format (must start with `cs_`)
- Displays: items, quantities, totals, payment status
- **CartClearer**: Client component that DELETEs `/api/cart` to empty the cart after payment
  - Uses `useRef` to prevent double-clearing
  - Calls `refreshCart()` after successful clear

---

## 4. Stripe Integration

### 4.1 Client Setup

**File**: `frontend/src/lib/stripe.ts`

- **Singleton**: Lazy proxy pattern -- Stripe client created on first property access
- **API Version**: `2026-01-28.clover`
- **Key**: `STRIPE_SECRET_KEY` (server-side only)
- **No public key** used client-side (Stripe Checkout is hosted, not embedded)

### 4.2 Webhook Signature Verification

**File**: `frontend/src/app/api/webhooks/stripe/route.ts`

- Reads raw body via `req.text()`
- Extracts `stripe-signature` header
- Verifies via `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`
- Returns 400 if signature missing or invalid
- Returns `{ received: true }` on success

### 4.3 Handled Stripe Events

| Event | Handler | Module |
|-------|---------|--------|
| `checkout.session.completed` | `handleCheckoutCompleted` | `checkout-completed.ts` |
| `customer.subscription.created` | `handleSubscriptionUpdate` | `subscription-handlers.ts` |
| `customer.subscription.updated` | `handleSubscriptionUpdate` | `subscription-handlers.ts` |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | `subscription-handlers.ts` |
| `payment_intent.succeeded` | Log only | (inline) |
| `payment_intent.payment_failed` | Log only | (inline) |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | `invoice-handlers.ts` |
| `charge.dispute.created` | `handleChargeDisputeCreated` | `dispute-handlers.ts` |

### 4.4 Events NOT Handled (Notable Gaps)

| Event | Risk | Impact |
|-------|------|--------|
| `checkout.session.expired` | Low | Abandoned checkout tracking |
| `charge.refunded` | **HIGH** | Refunds in Stripe won't update order status in DB |
| `charge.dispute.updated` | Medium | Dispute resolution won't update order |
| `charge.dispute.closed` | Medium | Won disputes won't reactivate orders |
| `payment_intent.canceled` | Low | Informational |
| `customer.subscription.trial_will_end` | Low | Pre-trial-end notification |
| `invoice.paid` | Low | Subscription renewal tracking |
| `charge.succeeded` | Low | Already covered by payment_intent.succeeded |

---

## 5. Webhook Handlers

### 5.1 checkout.session.completed

**File**: `frontend/src/lib/webhooks/stripe/checkout-completed.ts`

**Idempotency**: Checks `orders.stripe_session_id` for existing order. Skips if found.

**Flow**:
1. Guard: `payment_status !== 'paid'` -> skip
2. Parse metadata (locale, cart_items, gift_message)
3. Retrieve full session (expand: line_items, payment_intent, payment_method)
4. Extract customer email, shipping address, payment method type
5. **Idempotency check**: Query `orders` by `stripe_session_id`
6. Look up user by email (for `user_id` linking)
7. Create order record in `orders` table
8. Create order items in `order_items` table
9. Create notification (for authenticated users only)
10. Create audit log entry
11. Increment coupon usage (if coupon applied)
12. Submit to POD provider:
    a. Initialize providers
    b. Fetch product/variant provider IDs from DB
    c. Guard: verify all items have provider variant mappings
    d. Build line items with production URLs (custom designs)
    e. Create POD order
    f. Submit for production
    g. If production fails: mark order for retry, notify admin + customer
13. Handle credit pack purchase (if `metadata.type === 'credit_pack'`)
14. Send confirmation email via Resend

**Error handling**:
- Never throws -- catches all errors to prevent Stripe retries
- POD failures: order created but marked with `pod_error` and `pod_retry_count`
- Email failures: logged but don't fail webhook
- Missing provider variant mapping: order set to `requires_review`

### 5.2 subscription-handlers

**File**: `frontend/src/lib/webhooks/stripe/subscription-handlers.ts`

**`handleSubscriptionUpdate`**:
1. Find user by `stripe_customer_id`
2. Update `tier` (premium/free), `subscription_status`, `subscription_period_end`
3. Add 10 bonus credits on activation (idempotent: checks `credit_transactions` for existing bonus)
4. Trigger welcome drip email sequence for new subscribers

**`handleSubscriptionDeleted`**:
1. Find user by `stripe_customer_id`
2. Set `tier = 'free'`, `subscription_status = 'cancelled'`

### 5.3 invoice-handlers

**File**: `frontend/src/lib/webhooks/stripe/invoice-handlers.ts`

**`handleInvoicePaymentFailed`**:
1. Find user by `stripe_customer_id`
2. Set `subscription_status = 'past_due'`
3. Send payment failure email via Resend (direct API call)
4. Alert admin via `/api/admin/alert`

### 5.4 dispute-handlers

**File**: `frontend/src/lib/webhooks/stripe/dispute-handlers.ts`

**`handleChargeDisputeCreated`**:
1. Find order by `stripe_payment_intent_id`
2. Set order `status = 'cancelled'` (pauses fulfillment)
3. Create audit log entry
4. Create notifications for all admin users
5. Alert admin via `/api/admin/alert`

**NOTE**: Uses `cancelled` status instead of `disputed` -- TODO comment indicates migration needed to add `disputed` status to orders CHECK constraint.

### 5.5 Shared Utilities

**File**: `frontend/src/lib/webhooks/stripe/shared.ts`

- `supabase`: Service role client (bypasses RLS) for webhook operations
- `sendOrderIssueEmail`: Localized (EN/ES/DE) email for orders under review
- `notifyAdminOfProviderFailure`: Creates notification for all admin users

---

## 6. Subscription & Credits System

### 6.1 Subscription Create

**File**: `frontend/src/app/api/subscription/create/route.ts`

| Field | Value |
|-------|-------|
| Auth | Required (`requireAuth`) |
| Rate limit | 3/hour per user (`subscriptionCreateLimiter`) |
| Guard | Rejects if already has active subscription |
| Price | `STRIPE_PREMIUM_PRICE_ID` env var |
| Mode | `subscription` |
| Pricing | 9.99 EUR/month (`PRICING.premium.priceCents = 999`) |

Flow:
1. `requireAuth` -> AuthUser
2. Rate limit by `sub-create:{user.id}`
3. Check if `subscription_status === 'active'` -> reject
4. Get or create Stripe customer
5. Create Stripe Checkout session (mode: subscription)
6. Return session URL for redirect

### 6.2 Subscription Portal

**File**: `frontend/src/app/api/subscription/portal/route.ts`

- Auth required, premium tier required
- Creates Stripe billing portal session
- Return URL defaults to `/en/profile`

### 6.3 Subscription Usage

**File**: `frontend/src/app/api/subscription/usage/route.ts`

- Auth required
- Returns: tier, credit_balance, subscription_status, limits
- Limits derived from `USAGE_TIERS` (canonical config)

### 6.4 Credit Pack Purchase

**File**: `frontend/src/app/api/credits/purchase/route.ts`

| Pack | Credits | Price |
|------|---------|-------|
| small | 15 | 4.99 EUR |
| medium | 50 | 14.99 EUR |
| large | 150 | 39.99 EUR |

- Auth required, **premium tier only**
- Double-checks `subscription_status === 'active'` (defense against stale JWT)
- Creates one-time payment Stripe Checkout session
- Metadata: `type: 'credit_pack'`, `user_id`, `pack`, `credits`

### 6.5 Credit Fulfillment (in checkout-completed.ts)

When `metadata.type === 'credit_pack'`:

1. Extract `user_id`, `credits`, `paymentId` from metadata
2. **Idempotency**: Insert into `credit_transactions` with UNIQUE(user_id, stripe_payment_id)
   - Duplicate insert (code 23505) -> skip silently
3. **Atomic balance update**: `supabase.rpc('add_credits', { p_user_id, p_amount })`
   - No SELECT-then-UPDATE race condition
4. Backfill `balance_after` in transaction record
5. Send credit purchase confirmation email

---

## 7. Payment Methods Management

### 7.1 List Payment Methods

**File**: `frontend/src/app/api/profile/payment-methods/route.ts`

- Auth: Cookie-based (`sb-access-token`)
- Fetches user's `stripe_customer_id` from `users` table
- Lists card-type payment methods from Stripe
- Returns: id, type, brand, last4, exp_month, exp_year, funding
- Handles invalid Stripe customer gracefully (returns empty list)

### 7.2 Remove Payment Method

**File**: `frontend/src/app/api/profile/payment-methods/[id]/route.ts`

- Auth: Cookie-based
- **Ownership verification**: Retrieves payment method from Stripe, checks `pm.customer === profile.stripe_customer_id`
- Detaches via `stripe.paymentMethods.detach()`

### 7.3 UI Component

**File**: `frontend/src/components/profile/PaymentMethodsList.tsx`

- Displays cards with brand icon, last4, expiration
- Remove with confirmation dialog (AlertDialog)
- Loading skeleton state
- Note: "Add Payment Method" button is disabled with note "Managed by Stripe"

---

## 8. Coupon System

### 8.1 Coupon Validation

**File**: `frontend/src/app/api/coupons/validate/route.ts`

- Rate limited: 10/5min per IP (`couponLimiter`)
- Case-insensitive lookup (`.ilike('code', code)`)
- Validates: active, date range (valid_from/valid_until), usage limit, minimum purchase
- Discount types: `percentage` (with optional `max_discount_amount` cap), `fixed_amount`
- Discount never exceeds cart total

### 8.2 Coupon Flow

```
CartView                          Server                          Checkout Session
  |-- Enter code, "Apply" ------->| /api/coupons/validate         |
  |<-- { valid, discount } -------|                                |
  |-- Store in sessionStorage     |                                |
  |                                |                                |
  |-- Proceed to checkout ------->| CheckoutView reads session     |
  |                                |                                |
  |-- "Pay Now" ------------------>| /api/checkout/create-session   |
  |                                |--- re-validate coupon -------->|
  |                                |--- create Stripe coupon ------>| stripe.coupons.create
  |                                |--- apply to session ---------->| discounts: [{ coupon }]
  |                                |                                |
  |                                | checkout.session.completed     |
  |                                |--- increment times_used ------>|
```

**Security note**: Coupon is re-validated server-side during session creation, preventing client-side manipulation.

---

## 9. Security Analysis

### 9.1 CSRF Protection

| Mechanism | Status |
|-----------|--------|
| Double-submit cookie pattern | **ACTIVE** |
| Token generation | `crypto.getRandomValues()` - 32 bytes (64 hex chars) |
| Cookie name | `csrf-token` |
| Header name | `x-csrf-token` |
| Cookie flags | `httpOnly: false` (must be readable by JS), `secure: production`, `sameSite: strict` |
| Enforcement | Middleware validates for all POST/PUT/PATCH/DELETE to `/api/*` |
| Exemptions | `/api/webhooks/*`, `/api/admin/*`, `/api/cron/*` |
| Client-side | `apiFetch()` wrapper auto-attaches header for mutations |

**Assessment**: Well-implemented. The `sameSite: strict` + custom header requirement provides strong CSRF protection.

### 9.2 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Checkout session creation | 5 | 1 minute (per IP) |
| Subscription create | 3 | 1 hour (per user ID) |
| Coupon validation | 10 | 5 minutes (per IP) |

**Assessment**: Rate limiting is in-memory (per-instance). Acceptable for single-instance VPS deployment but would need Redis-backed limiter for multi-instance.

### 9.3 Auth Guards

| Endpoint | Auth Mechanism | Guard Type |
|----------|---------------|------------|
| Cart API (all methods) | Optional cookie | Scoped by user_id or session_id |
| Cart merge | Required cookie | `sb-access-token` verified |
| Shipping estimate | None | Public endpoint |
| Checkout create-session | None (guest allowed) | Rate-limited |
| Calculate tax | None | Public endpoint |
| Subscription create | `requireAuth` | JWT + DB lookup |
| Subscription portal | `requireAuth` + tier check | Premium only |
| Subscription usage | `requireAuth` | JWT + DB lookup |
| Credits purchase | `requireAuth` + tier check | Premium + active subscription |
| Payment methods GET | Cookie auth | `sb-access-token` |
| Payment methods DELETE | Cookie auth + ownership | Verifies PM belongs to user |
| Coupon validate | None | Rate-limited |
| Stripe webhook | Signature verification | `STRIPE_WEBHOOK_SECRET` |

### 9.4 Idempotency

| Operation | Mechanism | Verdict |
|-----------|-----------|---------|
| Order creation (webhook) | `orders.stripe_session_id` unique check | GOOD |
| Credit pack purchase | `credit_transactions` UNIQUE(user_id, stripe_payment_id) | GOOD |
| Subscription bonus credits | Query for existing bonus + subscription_id guard | GOOD |
| Credit balance update | `supabase.rpc('add_credits')` atomic increment | GOOD |
| Coupon usage increment | **NOT idempotent** -- `times_used + 1` on every webhook delivery | **ISSUE** |

### 9.5 Server-Side Price Authority

**File**: `create-session/route.ts` (lines 189-213)

The checkout session creation **overrides client-submitted prices** with authoritative DB variant prices:

```typescript
// Server-side price authority: override client prices with DB variant prices
const match = pricingVariants.find(v => ...)
if (match?.price_cents) {
  item.product_price = match.price_cents / 100
}
```

**Assessment**: CRITICAL security control. Prevents price manipulation by clients. Correctly implemented.

### 9.6 Input Validation Summary

| Input | Validated | Notes |
|-------|-----------|-------|
| Cart item quantity | Yes | >= 1 (POST), >= 0 (PATCH), <= MAX_CART_QUANTITY |
| Product existence | Yes | Active + not soft-deleted |
| Variant availability | Yes | is_enabled + is_available |
| Guest email | Client-side only | Regex validation in CheckoutView |
| Gift message | Yes | Truncated to 200 chars in metadata |
| Coupon code | Yes | Type check + server re-validation |
| Session ID format | Yes | `cs_` prefix check on success page |
| Payment method ownership | Yes | Cross-check customer ID before detach |

### 9.7 Cookie Security

| Cookie | httpOnly | secure | sameSite | maxAge |
|--------|----------|--------|----------|--------|
| `cart-session-id` | true | production | lax | 30 days |
| `sb-access-token` | (set elsewhere) | - | - | - |
| `csrf-token` | false | production | strict | 8 hours |
| `pod-visitor-id` | true | production | lax | 1 year |

---

## 10. Critical Findings

### CRITICAL

#### C1: Coupon Usage Counter Not Idempotent

**File**: `checkout-completed.ts:224-244`

The coupon `times_used` counter increments on every webhook delivery without checking if it was already incremented for this session. If Stripe retries the webhook, the counter will over-increment.

```typescript
// PROBLEM: No idempotency check
const { error: couponError } = await supabase
  .from('coupons')
  .update({ times_used: (coupon.times_used || 0) + 1 })
  .eq('id', coupon.id)
```

**Impact**: Coupon may hit usage limit prematurely due to webhook retries.

**Fix**: Add a `coupon_usages` join table with UNIQUE(coupon_id, order_id) or check if order already has this coupon applied.

#### C2: Missing `charge.refunded` Webhook Handler

No handler for refund events. When a refund is issued through the Stripe Dashboard, the order status in Supabase will remain `paid` or `submitted` indefinitely.

**Impact**: Order state inconsistency between Stripe and DB. Customer sees "Paid" even after refund.

**Fix**: Add handler for `charge.refunded` that updates `orders.status = 'refunded'` and creates audit log entry.

#### C3: Dispute Status Uses `cancelled` Instead of `disputed`

**File**: `dispute-handlers.ts:47`

```typescript
status: 'cancelled', // Using existing status until migration adds 'disputed'
```

**Impact**: No way to distinguish voluntarily cancelled orders from chargeback-cancelled orders. Reporting and reconciliation will be inaccurate.

### HIGH

#### H1: Checkout Create-Session Has No Auth Requirement

**File**: `create-session/route.ts`

The checkout session creation endpoint has no authentication guard. While it accepts guest checkout (correct), the only protection is IP-based rate limiting (5/min). A malicious actor could:
- Create many Stripe Checkout sessions (costs nothing but creates Stripe API load)
- Enumerate active product availability

**Mitigation**: The 5/min rate limit provides basic protection. Consider adding a CAPTCHA or fingerprint challenge for guests.

#### H2: Cart API Uses supabaseAdmin (RLS Bypassed)

**File**: `cart/route.ts:23`

```typescript
const supabase = supabaseAdmin
```

All cart operations bypass RLS. The code manually checks ownership via `userId` or `sessionId` filters, but a missing filter would expose all cart items.

**Assessment**: The code does apply ownership filters consistently (verified in GET/POST/PATCH/DELETE). However, using supabaseAdmin means RLS is not a safety net. A future code change could accidentally omit the filter.

#### H3: No Cart Item Limit

There is no limit on the number of distinct items in a cart (only quantity per item is capped at 99). An attacker could add thousands of distinct products, causing:
- Expensive DB queries (N products, N variants lookups)
- Large metadata in Stripe session creation
- Potential Stripe metadata size limit (500 chars per key, 50 keys max -- `cart_items` metadata could exceed this)

### MEDIUM

#### M1: Tax Calculation Fallback Uses Hardcoded US Rates

**File**: `stripe.ts:127-136`

When Stripe Tax is not activated, the fallback uses US-specific state tax rates (CA, NY, TX, etc.) with a 7% default. For an EU-focused store selling in EUR, these rates are incorrect.

**Fix**: Update fallback rates to EU VAT rates (DE: 19%, ES: 21%, FR: 20%, etc.) or return 0 with a note that tax is not configured.

#### M2: Guest Email Validated Client-Side Only

**File**: `CheckoutView.tsx:206-208`

Guest email is validated only with a client-side regex. The server (`create-session/route.ts`) does not validate the email format -- it passes it directly to Stripe.

**Mitigation**: Stripe itself validates the email format, so invalid emails would cause a Stripe API error. However, explicit server validation would provide better error messages.

#### M3: CartClearer Race Condition

**File**: `CartClearer.tsx`

If the success page is loaded but the webhook hasn't fired yet, the cart is cleared before the order is created. This is correct behavior (cart should clear on payment, not on order creation), but if the user navigates away and the webhook fails, there's no way to reconstruct the cart.

**Mitigation**: Cart items are in the Stripe session metadata, so the order can still be created from webhook data.

#### M4: No Inventory Locking Between Validation and Payment

The variant availability check happens during session creation, but there's no reservation/lock. Between validation and payment completion (which could be minutes), the variant could become unavailable. The webhook handler does not re-validate availability.

**Mitigation**: For POD (print-on-demand), inventory is theoretically unlimited. However, if variants are manually disabled, an order could be placed for a disabled variant.

---

## 11. Recommendations

### Priority 1 (Critical)

1. **Make coupon usage idempotent**: Track `coupon_code` per order or use a junction table with UNIQUE constraint.

2. **Add `charge.refunded` handler**: Update order status to `refunded`, create audit log, notify admin, send customer email.

3. **Add `disputed` status to orders**: Create migration adding CHECK constraint for `disputed` status and columns `stripe_dispute_id`, `stripe_dispute_reason`, `stripe_dispute_amount`.

### Priority 2 (High)

4. **Add cart item count limit**: Cap at e.g. 50 distinct items per cart.

5. **Validate Stripe metadata size**: The `cart_items` JSON in session metadata could exceed Stripe's 500-char limit for large carts. Serialize to a reference ID or split across multiple metadata keys.

6. **Add server-side guest email validation**: Simple regex check in `create-session/route.ts`.

### Priority 3 (Medium)

7. **Fix tax fallback for EU**: Replace US state tax rates with EU VAT rates in the Stripe Tax fallback.

8. **Add `dispute.updated` and `dispute.closed` handlers**: Track dispute resolution and re-enable orders when disputes are won.

9. **Add `checkout.session.expired` handler**: Track abandoned checkouts for analytics and potential recovery emails.

10. **Consider cart RLS**: Instead of relying solely on application-level ownership checks, define RLS policies on `cart_items` as a defense-in-depth measure.

---

## Appendix: File Index

| File | Purpose |
|------|---------|
| `frontend/src/app/api/cart/route.ts` | Cart CRUD (GET/POST/PATCH/DELETE) |
| `frontend/src/app/api/cart/merge/route.ts` | Guest-to-user cart merge |
| `frontend/src/app/api/cart/shipping-estimate/route.ts` | Shipping cost calculator |
| `frontend/src/hooks/useCart.tsx` | Client-side cart context + optimistic updates |
| `frontend/src/components/cart/CartView.tsx` | Cart page UI |
| `frontend/src/components/checkout/CheckoutView.tsx` | Checkout page UI |
| `frontend/src/app/api/checkout/create-session/route.ts` | Stripe Checkout session creation |
| `frontend/src/app/api/checkout/calculate-tax/route.ts` | Tax calculation API |
| `frontend/src/lib/stripe.ts` | Stripe client singleton + tax calculation |
| `frontend/src/lib/stripe-checkout.ts` | Session retrieval for success page |
| `frontend/src/app/api/webhooks/stripe/route.ts` | Webhook dispatcher (signature verification) |
| `frontend/src/lib/webhooks/stripe/index.ts` | Handler re-exports |
| `frontend/src/lib/webhooks/stripe/shared.ts` | Supabase admin client + shared email/notification helpers |
| `frontend/src/lib/webhooks/stripe/checkout-completed.ts` | Order creation + POD submission + credit fulfillment |
| `frontend/src/lib/webhooks/stripe/subscription-handlers.ts` | Subscription create/update/delete |
| `frontend/src/lib/webhooks/stripe/invoice-handlers.ts` | Invoice payment failure |
| `frontend/src/lib/webhooks/stripe/dispute-handlers.ts` | Chargeback handling |
| `frontend/src/app/api/subscription/create/route.ts` | Subscription checkout session |
| `frontend/src/app/api/subscription/portal/route.ts` | Stripe billing portal |
| `frontend/src/app/api/subscription/usage/route.ts` | Usage/tier/credits query |
| `frontend/src/app/api/credits/purchase/route.ts` | Credit pack checkout session |
| `frontend/src/app/api/profile/payment-methods/route.ts` | List saved payment methods |
| `frontend/src/app/api/profile/payment-methods/[id]/route.ts` | Delete payment method |
| `frontend/src/components/profile/PaymentMethodsList.tsx` | Payment methods UI |
| `frontend/src/app/api/coupons/validate/route.ts` | Coupon validation |
| `frontend/src/lib/csrf.ts` | CSRF token generation + validation |
| `frontend/src/lib/api-fetch.ts` | CSRF-aware fetch wrapper |
| `frontend/src/middleware.ts` | CSRF enforcement + auth guards + tenant resolution |
| `frontend/src/lib/rate-limit.ts` | In-memory rate limiter |
| `frontend/src/lib/auth-guard.ts` | Auth middleware (requireAuth, requireAdmin) |
| `frontend/src/lib/store-config.ts` | Store defaults (pricing, shipping, countries) |
| `frontend/src/app/[locale]/(focused)/checkout/success/page.tsx` | Checkout success page |
| `frontend/src/app/[locale]/(focused)/checkout/success/CartClearer.tsx` | Post-payment cart clearer |
| `frontend/src/app/[locale]/(focused)/checkout/cancel/page.tsx` | Checkout cancel page |
