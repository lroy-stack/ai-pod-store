---
name: Checkout End-to-End Audit
description: >
  Comprehensive audit of the SKAPARA checkout flow — cart-to-checkout transition, address
  management, tax calculation, Stripe session creation, payment handling, order creation via
  webhook, and success/cancel pages. Use when asked to audit checkout, payment flow, cart-to-order
  pipeline, or Stripe integration.
allowed-tools: Read, Grep, Glob, Bash
---

# Checkout End-to-End Audit

Systematic audit of the full checkout pipeline: cart validation, address selection, tax calculation, server-side price enforcement, Stripe Checkout session creation, payment processing, webhook-driven order creation, success/cancel handling, and edge cases.

## Prerequisites

Before starting, read these files for architectural context:

- `CLAUDE.md` — component standards, semantic tokens, route groups, Supabase connection reference
- `memory/MEMORY.md` — current project state, known blockers, connection details

## File Map

Keep this reference open throughout the audit. All paths relative to `frontend/src/`.

### Checkout Pages

| File | Role |
|---|---|
| `app/[locale]/(focused)/checkout/page.tsx` | Checkout page entry point |
| `components/checkout/CheckoutView.tsx` (737 lines) | Main checkout orchestrator — address, summary, payment CTA |
| `components/checkout/AddressForm.tsx` (305 lines) | Address input with validation and saved address selection |
| `app/[locale]/(focused)/checkout/success/page.tsx` (151 lines) | Post-payment success page |
| `app/[locale]/(focused)/checkout/success/CartClearer.tsx` | Client component that clears cart after successful payment |
| `app/[locale]/(focused)/checkout/cancel/page.tsx` (60 lines) | Payment cancellation page |

### API Endpoints

| Endpoint | Route File | Role |
|---|---|---|
| `POST /api/checkout/create-session` | `app/api/checkout/create-session/route.ts` (435 lines) | Creates Stripe Checkout session with server-side prices |
| `POST /api/checkout/calculate-tax` | `app/api/checkout/calculate-tax/route.ts` (65 lines) | Tax calculation based on shipping address |
| `GET/POST /api/cart` | `app/api/cart/route.ts` (653 lines) | Cart CRUD — add, update, remove, get |
| `GET/POST/PUT/DELETE /api/shipping-addresses/` | `app/api/shipping-addresses/` | Shipping address CRUD |

### Supporting Libraries

| File | Role |
|---|---|
| `lib/stripe-checkout.ts` (66 lines) | Stripe checkout utilities — session config, redirect |
| `lib/stripe.ts` | Stripe client initialization |
| `lib/supabase-server.ts` | Server Supabase client with user auth |
| `lib/supabase-admin.ts` | Admin Supabase client (RLS bypass) |

### Webhook (Order Creation)

| File | Role |
|---|---|
| `app/api/webhooks/stripe/route.ts` (1002 lines) | Stripe webhook — creates order on checkout.session.completed |

### Database Tables

| Table | Purpose |
|---|---|
| `cart_items` | User cart contents (product_id, variant_id, quantity, composition_id) |
| `orders` | Created orders (stripe_session_id, status, total, user_id) |
| `order_items` | Line items per order |
| `shipping_addresses` | Saved user addresses |
| `coupons` | Discount codes (code, discount_percent, usage_limit, expires_at) |
| `credit_transactions` | Credit balance changes (tied to payments via stripe_payment_id) |

---

## Workflow

Execute each phase sequentially. Record every finding with severity, file path, and line number.

### Phase 1: Cart-to-Checkout Transition (8 checks)

#### 1.1 Cart Validation Before Checkout

- Read `app/api/cart/route.ts`
- **Check**: Cart GET endpoint returns full product data (price, stock, images) not just IDs
- **Check**: Empty cart is rejected before checkout can proceed
- **Check**: Cart items with deleted/unpublished products are flagged or removed
- **Check**: Variant availability is validated (variant may be out of stock even if product exists)

#### 1.2 Cart Item Structure

- Read `app/api/cart/route.ts` — POST/PUT handlers
- **Check**: `variant_id` is required (not just product_id)
- **Check**: Quantity is validated (positive integer, max limit)
- **Check**: `composition_id` is stored for custom-designed products
- **Check**: Duplicate detection prevents same variant appearing twice (should merge quantities)

#### 1.3 Cart Authentication

- Read `app/api/cart/route.ts` — auth handling
- **Check**: Authenticated users have server-side cart (Supabase)
- **Check**: Guest users have client-side cart (localStorage or cookie)
- **Check**: Cart merges on login (guest items added to server cart)
- **Severity**: FAIL if guest checkout is broken or cart is lost on login

#### 1.4 Cart Expiration

- **Check**: Is there a TTL on cart items? (stale items with outdated prices)
- **Check**: If no expiration exists, how are price changes handled between add-to-cart and checkout?
- **Benchmark**: Industry standard is 24-72h cart expiration or price revalidation at checkout

### Phase 2: Address Management (6 checks)

#### 2.1 Address Form Validation

- Read `components/checkout/AddressForm.tsx`
- **Check**: Required fields enforced: name, street, city, postal code, country
- **Check**: Country is restricted to supported shipping countries
- **Check**: Postal code format validation per country (at least basic regex)
- **Check**: Phone number validation exists (required for shipping labels)

#### 2.2 Saved Addresses

- Read `app/api/shipping-addresses/` — all route files
- **Check**: CRUD operations are user-scoped (RLS or explicit user_id filter)
- **Check**: User can select a saved address at checkout
- **Check**: Default address is pre-selected
- **Check**: Address edit/delete works without affecting past orders

#### 2.3 Address Security

- **Check**: Address API endpoints require authentication
- **Check**: User cannot access another user's addresses (RLS or server-side filter)
- **Check**: Address data is not leaked in error responses
- **Severity**: CRITICAL if address data is accessible cross-user

### Phase 3: Tax Calculation (5 checks)

#### 3.1 Tax API

- Read `app/api/checkout/calculate-tax/route.ts`
- **Check**: Tax is calculated server-side (not client-side)
- **Check**: Tax rate varies by destination country/region
- **Check**: Tax calculation uses shipping address (not billing address)
- **Check**: EU VAT is handled (MOSS/OSS rules for cross-border B2C)

#### 3.2 Tax Accuracy

- **Check**: Tax amount is recalculated at session creation (not trusted from client)
- **Check**: Tax-inclusive vs tax-exclusive pricing is consistent with store settings
- **Check**: Tax breakdown is shown to user before payment
- **Benchmark**: EU requires tax to be displayed before payment confirmation

#### 3.3 Tax Edge Cases

- **Check**: Zero-tax jurisdictions handled (e.g., some US states, non-EU)
- **Check**: Tax on shipping is handled (some jurisdictions tax shipping)

### Phase 4: Stripe Session Creation (10 checks)

#### 4.1 Server-Side Price Authority

- Read `app/api/checkout/create-session/route.ts`
- **Check**: Prices are loaded from database/Printful server-side (never from client request)
- **Check**: Client-provided prices are ignored or used only for display validation
- **Check**: Each line item price is fetched fresh at session creation time
- **Severity**: CRITICAL if client can manipulate prices

#### 4.2 Stock Validation at Session Creation

- **Check**: Stock/availability is checked at session creation time (not just cart add time)
- **Check**: If stock is insufficient, session creation fails with clear error message
- **Check**: Race condition between two users buying last item — is there a lock or reservation?
- **Benchmark**: Shopify reserves stock for 10 minutes during checkout

#### 4.3 Rate Limiting

- Search for rate limit logic in `create-session/route.ts`
- **Check**: Rate limit exists (stated as 5/min in context)
- **Check**: Rate limit is per-user or per-IP (not global)
- **Check**: Rate limit response includes `Retry-After` header
- **Check**: Rate limit cannot be bypassed by switching auth tokens

#### 4.4 Coupon Validation

- Search for `coupon`, `discount`, `promo` in `create-session/route.ts`
- **Check**: Coupon code is validated server-side
- **Check**: Expired coupons are rejected
- **Check**: Usage limit is enforced (coupon used X times max)
- **Check**: Per-user usage limit is enforced (same user can't reuse)
- **Check**: Discount amount is capped (e.g., can't exceed order total)
- **Check**: Coupon validation is atomic (no TOCTOU between validation and application)

#### 4.5 Session Metadata

- **Check**: Stripe session includes `metadata` with order context (user_id, cart_item_ids, coupon_code)
- **Check**: `success_url` and `cancel_url` include session ID for verification
- **Check**: `client_reference_id` is set to user ID
- **Check**: Shipping address is passed to Stripe or collected there

#### 4.6 Currency Handling

- **Check**: Currency is EUR (consistent with store settings)
- **Check**: Prices are in cents (Stripe expects smallest currency unit)
- **Check**: No floating-point arithmetic on prices (use integers)

#### 4.7 Composition/Design Handling

- Search for `composition`, `design`, `files` in `create-session/route.ts`
- **Check**: Custom-designed products have `composition_id` resolved
- **Check**: Production URLs from composition are stored for later Printful order
- **Check**: Missing composition does not block checkout (graceful degradation or clear error)

#### 4.8 Variant Validation

- **Check**: Each cart item has a valid `variant_id`
- **Check**: Variant belongs to the specified product
- **Check**: Variant is enabled/published (not disabled in Printful)

#### 4.9 Error Responses

- **Check**: All error paths return structured JSON with user-facing message
- **Check**: Stripe API errors are caught and normalized (not raw Stripe error to client)
- **Check**: Error messages are translatable (i18n keys or locale-aware)
- **Check**: HTTP status codes are correct (400 for validation, 401 for auth, 429 for rate limit, 500 for server error)

#### 4.10 Idempotency

- **Check**: Duplicate session creation for same cart is handled (prevent double-charge)
- **Check**: If user navigates back and clicks "Pay" again, a new session is created safely
- **Check**: Old unpaid sessions expire naturally via Stripe's 24h default

### Phase 5: Payment Flow UX (6 checks)

#### 5.1 Checkout View Flow

- Read `components/checkout/CheckoutView.tsx`
- **Check**: Multi-step flow is clear (address -> summary -> pay)
- **Check**: Order summary shows all line items with images, quantities, prices
- **Check**: Shipping cost is displayed (or "calculated at next step")
- **Check**: Total includes tax and shipping

#### 5.2 Loading States

- **Check**: "Pay" button shows loading spinner during session creation
- **Check**: Button is disabled while processing (prevents double-click)
- **Check**: Redirect to Stripe is smooth (no flash of blank page)

#### 5.3 Error Display

- **Check**: Validation errors are shown inline (not just console.log)
- **Check**: API errors show user-friendly message in user's locale
- **Check**: Network errors have retry option

#### 5.4 Mobile Checkout UX

- **Check**: Checkout page is responsive (mobile-first)
- **Check**: Address form works on mobile keyboards (correct input types)
- **Check**: Order summary is collapsible on mobile
- **Check**: Touch targets meet 44px minimum
- **Benchmark**: Mobile checkout completion rate benchmark is 50%+

#### 5.5 Guest vs Authenticated

- **Check**: Guest users can complete checkout (no forced registration)
- **Check**: Guest checkout captures email for order confirmation
- **Check**: Authenticated users see saved addresses and order history link
- **Check**: Post-purchase account creation is offered to guests

#### 5.6 Back Navigation

- **Check**: Browser back button from Stripe returns to checkout (not empty cart)
- **Check**: Cart is preserved if user abandons checkout
- **Check**: Cancel page provides clear "Return to cart" CTA

### Phase 6: Success & Cancel Pages (6 checks)

#### 6.1 Success Page

- Read `app/[locale]/(focused)/checkout/success/page.tsx`
- **Check**: Session ID is verified via URL parameter (not blindly trusted)
- **Check**: Order details are displayed (order number, items, total)
- **Check**: Success page fetches order from database (not just Stripe session)
- **Check**: User is shown estimated delivery timeline

#### 6.2 Cart Clearing

- Read `app/[locale]/(focused)/checkout/success/CartClearer.tsx`
- **Check**: Cart is cleared only after confirmed successful payment
- **Check**: Cart clearing is idempotent (refreshing success page doesn't error)
- **Check**: Server-side cart (Supabase) is also cleared (not just localStorage)

#### 6.3 Cancel Page

- Read `app/[locale]/(focused)/checkout/cancel/page.tsx`
- **Check**: Cancel page preserves cart contents
- **Check**: Clear CTA to return to cart or continue shopping
- **Check**: No misleading language (user wasn't charged)

#### 6.4 Email Confirmation

- Search for `email`, `resend`, `notification` in webhook and success-related files
- **Check**: Order confirmation email is sent after successful payment
- **Check**: Email includes order number, items, total, estimated delivery
- **Check**: Email sending failure does not block order creation
- **Severity**: FAIL if email is never sent

#### 6.5 Order Record

- **Check**: Order is created in `orders` table with correct status ("paid" or "processing")
- **Check**: `order_items` are created for each line item
- **Check**: `stripe_session_id` is stored for reference and idempotency
- **Check**: Order total matches Stripe payment amount

#### 6.6 Duplicate Prevention

- **Check**: Same `stripe_session_id` cannot create two orders (idempotency check)
- **Check**: Success page can be refreshed without creating duplicate orders
- **Check**: Webhook retry (Stripe retries on 5xx) does not create duplicates

### Phase 7: Security & Edge Cases (8 checks)

#### 7.1 Price Manipulation

- **Check**: Client cannot inject arbitrary prices into Stripe session
- **Check**: Discount codes are validated server-side (not just client-side)
- **Check**: Negative prices or quantities are rejected
- **Severity**: CRITICAL if price manipulation is possible

#### 7.2 Stock Race Condition

- **Check**: Between session creation and webhook (payment), stock may have been purchased by another user
- **Check**: Webhook handler checks stock again or order is created as backorder
- **Check**: If stock check fails at webhook time, order is flagged (not silently accepted)
- **Benchmark**: Most POD platforms don't pre-check stock (made-to-order), but if stock validation exists, it must be consistent

#### 7.3 Authentication Bypass

- **Check**: All checkout API endpoints require auth (except guest checkout flow)
- **Check**: User ID is extracted from session/token server-side
- **Check**: Webhook endpoint uses Stripe signature verification (not auth)
- **Severity**: CRITICAL if any mutating endpoint lacks auth

#### 7.4 Stripe Webhook Security

- **Check**: Webhook verifies Stripe signature using `stripe.webhooks.constructEvent()`
- **Check**: Webhook secret is in env var (not hardcoded)
- **Check**: Raw body is used for signature verification (not parsed JSON)
- **Check**: Invalid signature returns 400 (not 200)

#### 7.5 Data Leakage

- **Check**: Error responses don't leak internal IDs, stack traces, or DB structure
- **Check**: Stripe session ID in URL doesn't expose other users' data
- **Check**: Cart API doesn't return other users' carts

#### 7.6 CSRF Protection

- **Check**: State-changing endpoints use POST (not GET)
- **Check**: Next.js CSRF protection is active (or custom CSRF tokens used)

#### 7.7 Input Sanitization

- **Check**: Address fields are sanitized (no XSS via address line)
- **Check**: Coupon codes are sanitized (no SQL injection)
- **Check**: Quantity values are validated as positive integers

#### 7.8 Logging & Audit Trail

- **Check**: Checkout session creation is logged
- **Check**: Payment success/failure is logged
- **Check**: Order creation is logged with user context
- **Check**: Sensitive data (card numbers) is never logged

---

## Output Format

Generate `AUDIT_CHECKOUT_E2E_[DATE].md` at the workspace root with the following structure:

```markdown
# Checkout E2E Audit — [DATE]

## Executive Summary

[2-3 paragraph overview: what works well, what is broken, what is missing. State overall production-readiness of the checkout flow.]

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| Cart-to-Checkout Transition | 8 | X | X | X | X | X% |
| Address Management | 6 | X | X | X | X | X% |
| Tax Calculation | 5 | X | X | X | X | X% |
| Stripe Session Creation | 10 | X | X | X | X | X% |
| Payment Flow UX | 6 | X | X | X | X | X% |
| Success & Cancel Pages | 6 | X | X | X | X | X% |
| Security & Edge Cases | 8 | X | X | X | X | X% |
| **TOTAL** | **49** | **X** | **X** | **X** | **X** | **X%** |

## Findings

| ID | Severity | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|
| CO-001 | CRITICAL | Security | [description] | `src/app/api/checkout/create-session/route.ts:XX` | [fix] |
| CO-002 | FAIL | Cart | [description] | `src/app/api/cart/route.ts:XX` | [fix] |
| CO-003 | WARN | UX | [description] | `src/components/checkout/CheckoutView.tsx:XX` | [fix] |
| ... | ... | ... | ... | ... | ... |

## Critical Blockers (Must Fix Before Production)

1. [CO-001] — [description and fix]
2. ...

## High Priority (Fix Within Sprint)

1. [CO-0XX] — [description]
2. ...

## Warnings (Fix Before V2)

1. [CO-0XX] — [description]
2. ...

## Priority Actions

1. **Immediate** (before launch): [list CRITICAL items]
2. **This sprint**: [list FAIL items]
3. **Next sprint**: [list WARN items]
```

## Severity Levels

- **CRITICAL**: Security vulnerability, price manipulation, data leakage, auth bypass, payment integrity. Blocks production launch.
- **FAIL**: Broken functionality, missing validation, incorrect calculations, lost orders. Must fix before release.
- **WARN**: Sub-optimal pattern, missing best practice, UX gap, missing edge case handling. Should fix before V2.
- **PASS**: Meets standards and industry benchmarks.

## Notes

- Always verify findings against actual code (read the file, cite the line number). Never report speculative issues.
- The checkout flow is the most revenue-critical path — any CRITICAL finding is a hard launch blocker.
- Pay special attention to the gap between Stripe session creation and webhook delivery (minutes to hours). Any state that can change in that window is a potential race condition.
- For each CRITICAL or FAIL finding, include a concrete code-level recommendation (not just "fix this").
- Test the flow mentally: Cart -> Address -> Tax -> Pay -> Webhook -> Order -> Success. Every transition is an audit point.
