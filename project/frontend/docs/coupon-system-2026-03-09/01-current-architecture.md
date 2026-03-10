# Coupon System — Current Architecture (2026-03-09)

## Database Schema (Production — verified via psql)

### Table: `coupons`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | uuid | PK, gen_random_uuid() | Unique identifier |
| `code` | varchar(50) | NOT NULL, UNIQUE | Discount code |
| `discount_type` | varchar(20) | NOT NULL, CHECK IN ('percentage','fixed_amount') | Type |
| `discount_value` | decimal(10,2) | NOT NULL, CHECK > 0 | Amount or percentage |
| `min_purchase_amount` | decimal(10,2) | nullable | Min cart total |
| `max_discount_amount` | decimal(10,2) | nullable | Cap for percentage discounts |
| `usage_limit` | integer | nullable | Max total uses (NULL=unlimited) |
| `times_used` | integer | DEFAULT 0 | Counter (updated via RPC) |
| `valid_from` | timestamptz | DEFAULT now() | Activation date |
| `valid_until` | timestamptz | nullable | Expiration date |
| `active` | boolean | DEFAULT true | Enable/disable |
| `created_at` | timestamptz | DEFAULT now() | |
| `updated_at` | timestamptz | DEFAULT now() | trigger: update_updated_at_column |

**Indexes**: `coupons_pkey`, `coupons_code_key` (UNIQUE), `idx_coupons_code`, `idx_coupons_active_valid`
**RLS**: 1 policy — `"Anyone can read active coupons"` SELECT WHERE active=true. No INSERT/UPDATE/DELETE policies.

### Table: `coupon_uses`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK |
| `coupon_id` | uuid | NOT NULL, FK→coupons(id) |
| `order_id` | uuid | NOT NULL, FK→orders(id) |
| `created_at` | timestamptz | DEFAULT now() |

**UNIQUE constraint**: `(coupon_id, order_id)` — prevents double-counting on webhook retries.
**RLS**: NONE — no policies defined.
**Missing column**: `user_id` — cannot track per-user usage.

### RPC: `increment_coupon_usage(p_coupon_id, p_order_id)`

SECURITY DEFINER function. Idempotent via UNIQUE constraint:
1. INSERT into coupon_uses (fails silently on duplicate)
2. UPDATE coupons SET times_used = times_used + 1
3. Returns TRUE (incremented) or FALSE (already counted)

### Seed Data (Production)

| Code | Type | Value | Min Purchase | Max Discount | Limit | Used |
|------|------|-------|--------------|--------------|-------|------|
| WELCOME10 | percentage | 10% | €25 | — | unlimited | 0 |
| SAVE5 | fixed_amount | €5 | €15 | — | unlimited | 0 |
| FREESHIP | fixed_amount | €10 | €50 | — | 100 | 0 |
| BIGDEAL | percentage | 20% | €100 | €50 | 50 | 0 |

---

## Data Flow

```
Cart UI (Input) → POST /api/coupons/validate → DB query + validation → Response
     ↓ sessionStorage('pod_applied_coupon')
Checkout UI → POST /api/checkout/create-session → Re-validate → stripe.coupons.create() → Stripe session
     ↓
Stripe Checkout (payment)
     ↓
Webhook: checkout.session.completed → session.metadata.coupon_code → RPC increment_coupon_usage()
```

---

## API Routes

### POST /api/coupons/validate
- **File**: `src/app/api/coupons/validate/route.ts`
- **Rate limit**: 10 req / 5 min per IP
- **Validates**: active, date range, usage limit, min purchase
- **Returns**: `{ valid, coupon, discount_amount, new_total }`

### POST /api/checkout/create-session (lines 135-269)
- **File**: `src/app/api/checkout/create-session/route.ts`
- **Re-validates**: active, min purchase, usage limit
- **BUG**: Does NOT check expiration dates (`valid_from`, `valid_until`)
- **Creates**: One-time Stripe coupon per checkout (amount_off, duration:'once')
- **Stores**: `coupon_code` in Stripe session metadata

---

## Frontend Components

### CartView.tsx (lines 38-211, 458-504)
- Coupon input field + Apply/Remove buttons
- `applyCoupon()`: calls /api/coupons/validate, stores in sessionStorage
- `removeCoupon()`: clears state + sessionStorage
- Displays discount line in order summary

### CheckoutView.tsx (lines 57-72, 244-246, 639-644)
- Restores coupon from sessionStorage on mount
- Passes `couponCode` to create-session payload
- Displays discount in order summary

---

## Translations (en/es/de)

Keys: `couponCode`, `couponPlaceholder`, `couponApplied`, `couponInvalid`, `couponExpired`,
`couponNotYetValid`, `couponUsageLimitExceeded`, `couponMinimumNotMet`, `discount`, `removeCoupon`, `applying`

---

## Critical Gaps Identified

| # | Gap | Severity | Detail |
|---|-----|----------|--------|
| 1 | **No admin UI** | HIGH | No CRUD for coupons — only direct DB access |
| 2 | **No per-user tracking** | HIGH | `coupon_uses` lacks `user_id` — can't enforce 1-per-user |
| 3 | **No first-purchase-only** | HIGH | WELCOME10 has no restriction — any user, any purchase |
| 4 | **No expiration check in checkout** | MEDIUM | create-session skips date validation |
| 5 | **Stripe coupon leak** | MEDIUM | Creates new Stripe coupon per checkout, never cleaned up |
| 6 | **No user-specific codes** | MEDIUM | No `user_id` column on `coupons` for personal codes |
| 7 | **No category/product targeting** | LOW | All coupons apply to entire cart |
| 8 | **No bulk generation** | LOW | Cannot generate campaign batches |
| 9 | **No analytics** | LOW | No dashboard for coupon performance |

---

## Source Files

| Component | Path |
|-----------|------|
| Schema | `supabase/migrations/20260214011457_create_coupons_table.sql` |
| Idempotency | `supabase/migrations/20260308500001_coupon_idempotency.sql` |
| Validate API | `src/app/api/coupons/validate/route.ts` |
| Checkout API | `src/app/api/checkout/create-session/route.ts` |
| Cart UI | `src/components/cart/CartView.tsx` |
| Checkout UI | `src/components/checkout/CheckoutView.tsx` |
| Webhook | `src/lib/webhooks/stripe/checkout-completed.ts` |
| Rate Limiter | `src/lib/rate-limit.ts` (line 64) |
| E2E Tests | `tests/integration/phase2-data-integrity.spec.ts` |
