# Backend API Purchase Flow Audit

**Generated**: 2026-03-04
**Scope**: All API routes involved in the user purchase lifecycle
**Base Path**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src`

---

## Table of Contents

1. [Authentication Mechanisms](#1-authentication-mechanisms)
2. [Cart Management APIs](#2-cart-management-apis)
3. [Checkout & Payment APIs](#3-checkout--payment-apis)
4. [Order Management APIs (User-Facing)](#4-order-management-apis-user-facing)
5. [Order Management APIs (Admin)](#5-order-management-apis-admin)
6. [Returns & Refunds APIs](#6-returns--refunds-apis)
7. [User Profile APIs (Purchase-Related)](#7-user-profile-apis-purchase-related)
8. [Shipping Address APIs](#8-shipping-address-apis)
9. [Subscription & Credits APIs](#9-subscription--credits-apis)
10. [Billing Portal API](#10-billing-portal-api)
11. [Webhook Routes](#11-webhook-routes)
12. [Cron Jobs (Purchase-Related)](#12-cron-jobs-purchase-related)
13. [Coupon Validation API](#13-coupon-validation-api)
14. [Session Migration API](#14-session-migration-api)
15. [Order State Machine](#15-order-state-machine)
16. [Security Analysis & Gaps](#16-security-analysis--gaps)

---

## 1. Authentication Mechanisms

### Auth Guard Module
**File**: `lib/auth-guard.ts:1-138`

The platform uses a centralized auth guard that provides three levels of access:

| Function | Level | How it works |
|---|---|---|
| `getAuthUser(req)` | Optional auth | Returns `AuthUser \| null`. Reads `sb-access-token` cookie. |
| `requireAuth(req)` | Required auth | Throws `AuthError(401)` if not authenticated. |
| `requireAdmin(req)` | Admin-only | Calls `requireAuth` then checks `user.role === 'admin'`. Throws `AuthError(403)`. |

**Token extraction** (`auth-guard.ts:41-50`):
- Reads from `sb-access-token` cookie via raw `Cookie` header parsing
- Verifies token via `supabase.auth.getUser(token)` using the service-role client
- Fetches `tier`, `role`, `credit_balance` from `users` table

**AuthUser interface** (`auth-guard.ts:17-23`):
```typescript
interface AuthUser {
  id: string
  email: string
  tier: 'free' | 'premium'
  role: string
  credit_balance: number
}
```

### Authentication Patterns Used Across Routes

| Pattern | Used By | Description |
|---|---|---|
| `requireAuth(req)` via auth-guard | Orders, Billing, Subscription, Credits, Reorder | Centralized guard, returns `AuthUser` |
| `requireAdmin(req)` via auth-guard | Admin Orders, Admin Returns | Centralized guard, checks role=admin |
| `cookies().get('sb-access-token')` | Cart, Profile, Shipping Addresses, Payment Methods | Direct cookie access, manual token verify |
| `verifyCronSecret(authHeader)` | All cron jobs | Bearer token comparison (timing-safe) |
| `stripe.webhooks.constructEvent()` | Stripe webhook | Stripe signature verification |
| `verifyPrintifyWebhook()` | Printify webhook | HMAC-SHA256 with timing-safe comparison |
| `provider.verifyWebhook()` | Unified POD webhook | Provider-specific signature verification |
| `x-api-key` header | Cache invalidation webhook | Simple API key comparison |

---

## 2. Cart Management APIs

### 2.1 GET /api/cart
**File**: `app/api/cart/route.ts:10-238`
**Method**: GET
**Auth**: Optional (supports both authenticated and guest users)
**Rate Limiting**: None

**Business Logic**:
1. Reads `sb-access-token` cookie for authenticated user identification (`cart/route.ts:13`)
2. Reads/creates `cart-session-id` cookie for guest carts (`cart/route.ts:16-21`)
3. Queries `cart_items` table filtered by `user_id` (auth) or `session_id` (guest) (`cart/route.ts:46-55`)
4. Fetches product details (title, price, images, status) joining `products` table (`cart/route.ts:85-97`)
5. Fetches variant details (size, color, price_cents) from `product_variants` (`cart/route.ts:124-133`)
6. Fetches personalization details via user-scoped client (RLS-protected) (`cart/route.ts:142-162`)
7. Fetches available variants per product for variant editing in cart (`cart/route.ts:168-184`)
8. Marks unavailable products (status !== 'active') (`cart/route.ts:112`)

**Response Schema**:
```typescript
{
  items: Array<{
    id, product_id, variant_id, quantity,
    product_title, product_price, product_image,
    product_currency, unavailable, variant_details,
    personalization_id, composition_id, personalization
  }>,
  available_variants: Record<string, { sizes: string[], colors: string[] }>
}
```

**Dependencies**: Supabase (admin client for cart_items, products, product_variants; user-scoped client for personalizations)

**Security Notes**:
- Uses `supabaseAdmin` (RLS bypass) for cart_items read -- cart_items does not have user-level RLS
- Creates a user-scoped client for personalizations to respect RLS (`cart/route.ts:34-42`)
- Guest session cookie: httpOnly, secure in production, 30-day expiry (`cart/route.ts:74-79`)

### 2.2 POST /api/cart
**File**: `app/api/cart/route.ts:241-438`
**Method**: POST
**Auth**: Optional (guest and authenticated)
**Rate Limiting**: None

**Request Schema**:
```typescript
{
  product_id: string,       // required
  quantity: number,         // required, >= 1
  variant_details?: { size?: string, color?: string },
  personalization_id?: string,
  composition_id?: string
}
```

**Business Logic**:
1. Validates product exists and is active (`cart/route.ts:274-287`)
2. Resolves `variant_id` from `variant_details` (size/color match) (`cart/route.ts:290-310`)
3. If no variant resolved: auto-selects if only 1 variant, or returns `VARIANT_REQUIRED` error (`cart/route.ts:313-338`)
4. Checks for duplicate items (same product + variant + personalization + composition) (`cart/route.ts:343-367`)
5. If duplicate: updates quantity (capped at `MAX_CART_QUANTITY`) (`cart/route.ts:369-396`)
6. If new: inserts into `cart_items` (`cart/route.ts:400-430`)

**Error Codes**:
- `PRODUCT_NOT_FOUND` (404): Product missing or inactive
- `VARIANT_REQUIRED` (400): Multiple variants available, selection needed
- `NO_VARIANTS` (400): No available variants for product

**Security Note**: No max items-per-cart limit. `MAX_CART_QUANTITY` only limits per-item quantity from `STORE_DEFAULTS.maxCartQuantity`.

### 2.3 PATCH /api/cart
**File**: `app/api/cart/route.ts:442-583`
**Method**: PATCH
**Auth**: Optional

**Request Schema**:
```typescript
{
  item_id: string,              // required
  quantity?: number,            // >= 0 (0 = delete)
  variant_details?: { size?, color? }  // optional variant change
}
```

**Business Logic**:
1. If `quantity === 0`: deletes the cart item (`cart/route.ts:485-500`)
2. If `quantity > MAX_CART_QUANTITY`: returns 400 (`cart/route.ts:477-482`)
3. If `variant_details` provided: resolves new variant_id and updates (`cart/route.ts:511-551`)
4. Updates the cart item with new quantity/variant (`cart/route.ts:562-565`)

**Security Gap**: No ownership check on the `item_id`. Any user could update any cart item by guessing the UUID. The `supabaseAdmin` client bypasses RLS.

### 2.4 DELETE /api/cart
**File**: `app/api/cart/route.ts:586-630`
**Method**: DELETE
**Auth**: Optional

**Business Logic**: Deletes all cart items for the user (by `user_id`) or session (by `session_id`).

**Security Gap**: Same as PATCH -- uses admin client, no ownership verification on guest session carts beyond cookie presence.

### 2.5 POST /api/cart/shipping-estimate
**File**: `app/api/cart/shipping-estimate/route.ts:1-123`
**Method**: POST
**Auth**: None (public)
**Rate Limiting**: None

**Request Schema**:
```typescript
{
  zipCode: string,       // required
  countryCode?: string,  // default: STORE_DEFAULTS.country
  cartTotal: number,
  itemCount?: number     // default: 1
}
```

**Business Logic**:
1. Normalizes zip code (removes spaces/dashes) (`shipping-estimate/route.ts:35`)
2. Queries `shipping_zones` table for matching zones by country + zip pattern (`shipping-estimate/route.ts:39-44`)
3. Pattern matching: converts SQL LIKE patterns to regex (`shipping-estimate/route.ts:71-77`)
4. Falls back to default zone (wildcard pattern) (`shipping-estimate/route.ts:81-82`)
5. Calculates shipping: `base_rate + per_item_rate * (itemCount - 1)` (`shipping-estimate/route.ts:93`)
6. Applies free shipping threshold (`shipping-estimate/route.ts:96-99`)

**Dependencies**: Supabase (shipping_zones table)

---

## 3. Checkout & Payment APIs

### 3.1 POST /api/checkout/create-session
**File**: `app/api/checkout/create-session/route.ts:1-733`
**Method**: POST
**Auth**: None (supports guest checkout)
**Rate Limiting**: None

This is the most complex route in the purchase flow. It handles:
- Cart validation
- Stock verification
- Coupon application
- Personalization rendering (server-side PNG generation)
- Composition rendering
- Server-side price authority
- Stripe session creation
- Multi-tenant Stripe Connect routing

**Request Schema**:
```typescript
{
  cartItems: Array<{
    product_id: string,
    variant_id: string,
    quantity: number,
    product_name?: string,
    product_price?: number,
    product_image?: string,
    variant_name?: string,
    personalization_id?: string,
    composition_id?: string,
    personalization?: { surcharge?: number },
    variant_details?: { size?, color? }
  }>,
  shippingAddress?: { name, line1, line2, city, state, postal_code, country },
  locale?: string,         // default: 'en'
  currency?: string,       // default: STORE_DEFAULTS.stripeCurrency
  customerEmail?: string,
  gift_message?: string,   // max 200 chars
  couponCode?: string
}
```

**Business Logic (step by step)**:

1. **Provider initialization** (`create-session/route.ts:100-101`): Initializes POD providers
2. **Cart validation** (`create-session/route.ts:107-128`): Ensures non-empty cart, all items have variant_id
3. **Product availability** (`create-session/route.ts:131-154`): Verifies all products are active and not deleted
4. **Stock validation** (`create-session/route.ts:157-198`): Checks `product_variants.is_available` for each item
5. **Coupon validation** (`create-session/route.ts:201-225`): Validates coupon code against `coupons` table (active, min_purchase, usage_limit)
6. **Personalization rendering** (`create-session/route.ts:237-367`):
   - Loads personalization from DB
   - Gets original product from Printify API
   - Generates high-res PNG using `canvas` library
   - Uploads PNG to Printify via provider
   - Creates temp product in Printify with overlay
   - Updates personalization record with temp product ID
7. **Composition rendering** (`create-session/route.ts:370-481`):
   - Exports production-quality image via `composition-renderer`
   - Uploads to Printify
   - Creates temp product with custom design
8. **Server-side price authority** (`create-session/route.ts:483-507`): Overrides client-sent prices with DB variant prices
9. **Line item construction** (`create-session/route.ts:510-536`): Builds Stripe line items with personalization surcharges
10. **Coupon discount** (`create-session/route.ts:539-566`): Creates one-time Stripe coupon for discount
11. **Stripe Connect** (`create-session/route.ts:579-629`): If `x-tenant-id` header present, routes payment to connected account with application fee
12. **Shipping calculation** (`create-session/route.ts:632-637`): Free shipping if cart >= `STORE_DEFAULTS.freeShippingThreshold`, otherwise EUR 4.99
13. **Stripe session creation** (`create-session/route.ts:640-715`):
    - Mode: `payment`
    - Payment methods: card (+ crypto if enabled)
    - Shipping address collection (if not pre-filled)
    - Metadata includes serialized cart items, gift message, coupon code

**Response**: `{ success: true, sessionId: string, url: string }`

**Dependencies**: Stripe, Supabase (admin), Printify (via provider abstraction), canvas (for PNG generation)

**Security Concerns**:
- **No authentication required** -- guest checkout supported
- **Server-side price authority** at line 483-507 correctly overrides client prices
- Gift message truncated to 200 chars (`create-session/route.ts:698`)
- Cart item metadata serialized to JSON string (Stripe metadata limit: 500 chars per key)
- **Personalization failure does not block checkout** (`create-session/route.ts:363-366`)

### 3.2 POST /api/checkout/calculate-tax
**File**: `app/api/checkout/calculate-tax/route.ts:1-65`
**Method**: POST
**Auth**: None
**Rate Limiting**: None

**Request Schema**:
```typescript
{
  cartItems: Array<any>,
  shippingAddress: { line1, city, state, postal_code, country },
  currency?: string,
  shipping?: any
}
```

**Business Logic**: Delegates to `calculateTax()` from `@/lib/stripe`. Currently Stripe Tax is disabled (`create-session/route.ts:658`).

**Note**: `automatic_tax.enabled: false` in the checkout session creation means this endpoint is preparatory but not actively used.

---

## 4. Order Management APIs (User-Facing)

### 4.1 GET /api/orders
**File**: `app/api/orders/route.ts:1-91`
**Method**: GET
**Auth**: Required (`requireAuth`)

**Query Parameters**:
- `page` (default: 1)
- `limit` (default: 10, max: 100)
- `status` (optional, comma-separated)

**Business Logic**:
1. Authenticates user via `requireAuth`
2. Queries `orders` filtered by `user_id = user.id` (`orders/route.ts:42`)
3. Multi-tenant isolation via `x-tenant-id` header (`orders/route.ts:36-49`)
4. Supports comma-separated status filter (`orders/route.ts:53-56`)
5. Returns paginated response with metadata

**Response Schema**:
```typescript
{
  orders: Array<{ id, status, total_cents, currency, created_at, paid_at, shipped_at, tracking_number, customer_email }>,
  pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage }
}
```

### 4.2 GET /api/orders/[id]
**File**: `app/api/orders/[id]/route.ts:1-90`
**Method**: GET
**Auth**: Required (`requireAuth`)

**Business Logic**:
1. Fetches order by ID (`orders/[id]/route.ts:32-36`)
2. **Ownership check**: Verifies `order.user_id === user.id` or user is admin (`orders/[id]/route.ts:46-51`)
3. Fetches order items with product and variant details via joins (`orders/[id]/route.ts:54-72`)

**Response**: `{ order: {...}, items: [...] }`

**Note**: Order with `user_id === null` (guest order) is accessible by any authenticated user due to the check `order.user_id && order.user_id !== user.id` -- if `user_id` is null, the check is skipped.

### 4.3 GET /api/orders/[id]/invoice
**File**: `app/api/orders/[id]/invoice/route.ts:1-146`
**Method**: GET
**Auth**: Required (`requireAuth`)

**Business Logic**:
1. Same ownership check as order detail (`invoice/route.ts:47`)
2. For Stripe orders: returns structured invoice data with line items (`invoice/route.ts:55-100`)
3. For non-Stripe orders: returns basic invoice (`invoice/route.ts:104-137`)
4. Includes `stripe_dashboard_url` for admin reference

**Note**: Does not currently generate PDF or retrieve actual Stripe hosted invoice URL -- returns JSON data only.

### 4.4 POST /api/orders/[id]/reorder
**File**: `app/api/orders/[id]/reorder/route.ts:1-170`
**Method**: POST
**Auth**: Required (`requireAuth`)

**Business Logic**:
1. **Strict ownership**: Only `order.user_id === user.id` (no admin override) (`reorder/route.ts:46-49`)
2. Fetches order items (product_id, quantity, variant_id)
3. For each item:
   - Checks if already in cart (same product + variant, no personalization)
   - If exists: increments quantity (capped at MAX_CART_QUANTITY)
   - If new: inserts new cart item
4. Personalizations are NOT copied -- user must re-personalize

**Response**: `{ success, items_added, items_updated, items_skipped, total_items }`

### 4.5 POST /api/orders/[id]/returns
**File**: `app/api/orders/[id]/returns/route.ts:22-118`
**Method**: POST
**Auth**: None (no auth check!)

**Request Schema** (Zod-validated):
```typescript
{
  reason: string,    // min 10 chars
  user_id?: string   // optional UUID
}
```

**Business Logic**:
1. Validates order exists (`returns/route.ts:43-47`)
2. Checks order status is eligible: `paid`, `submitted`, `in_production`, `shipped`, or `delivered` (`returns/route.ts:57`)
3. Checks no existing return in active states (`pending`, `approved`, `processing`, `completed`) (`returns/route.ts:67-72`)
4. Creates `return_requests` record with full order amount as refund (`returns/route.ts:82-93`)

**CRITICAL Security Gap**: **No authentication whatsoever**. Anyone with an order UUID can create a return request. The `user_id` field in the request body is optional and falls back to `order.user_id`, but there is no verification that the requester is the order owner.

### 4.6 GET /api/orders/[id]/returns
**File**: `app/api/orders/[id]/returns/route.ts:121-154`
**Method**: GET
**Auth**: None (no auth check!)

**Business Logic**: Returns all return requests for an order.

**CRITICAL Security Gap**: No authentication. Anyone with an order UUID can view return requests.

---

## 5. Order Management APIs (Admin)

### 5.1 GET /api/admin/orders
**File**: `app/api/admin/orders/route.ts:1-128`
**Method**: GET
**Auth**: Required, Admin-only (`requireAdmin`)

**Query Parameters**:
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `status` (comma-separated filter)
- `search` (email or order ID)

**Business Logic**:
1. Admin auth via `requireAdmin` (`admin/orders/route.ts:25-29`)
2. Fetches all orders with user join (`admin/orders/route.ts:43-77`)
3. **SQL injection protection**: Uses `sanitizeForLike()` and `sanitizeForPostgrest()` for search input (`admin/orders/route.ts:91-92`)
4. Returns paginated response with full order details including Printify/POD error info

**Dependencies**: `@/lib/query-sanitizer` for input sanitization

---

## 6. Returns & Refunds APIs

### 6.1 GET /api/admin/returns
**File**: `app/api/admin/returns/route.ts:1-87`
**Method**: GET
**Auth**: Required, Admin-only (`requireAdmin`)

**Query Parameters**:
- `status` (optional filter)
- `limit` (default: 50)
- `offset` (default: 0)

**Business Logic**: Fetches return requests with order, user, and approver joins using disambiguated FK references.

### 6.2 PUT /api/admin/returns/[id]
**File**: `app/api/admin/returns/[id]/route.ts:1-269`
**Method**: PUT
**Auth**: Required, Admin-only (`requireAdmin`)

**Request Schema** (Zod-validated):
```typescript
{
  action: 'approve' | 'reject',
  admin_notes?: string
}
```

**Business Logic for REJECT** (`returns/[id]/route.ts:82-123`):
1. Updates return status to `rejected`
2. Records admin ID and timestamp
3. Writes audit log

**Business Logic for APPROVE** (`returns/[id]/route.ts:125-260`):
1. Fetches order for payment intent ID
2. Sets return to `processing` status
3. Creates Stripe refund via `stripe.refunds.create()` with order metadata
4. On success:
   - Updates return to `completed` with Stripe refund ID
   - Updates order status to `refunded`
   - Writes audit log
   - Creates user notification
5. On Stripe failure:
   - Reverts return to `pending` status
   - Appends error message to admin_notes

**Refund amount**: Uses `return_request.refund_amount_cents` (set at creation to full order amount)

**Note**: Only supports full refunds. Partial refunds would require modifying `refund_amount_cents` before approval.

### 6.3 POST /api/returns/[id]/tracking
**File**: `app/api/returns/[id]/tracking/route.ts:1-103`
**Method**: POST
**Auth**: Required (via Supabase SSR client)

**Request Schema** (Zod-validated):
```typescript
{
  tracking_number: string,  // min 5 chars
  tracking_carrier: string  // min 2 chars
}
```

**Business Logic**:
1. Authenticates via Supabase SSR client (different pattern from other routes)
2. Verifies return request ownership (`tracking/route.ts:63`)
3. Only allows tracking on `approved` status returns (`tracking/route.ts:68`)
4. Updates return with tracking info, sets `customer_shipped_at`, transitions to `processing`

---

## 7. User Profile APIs (Purchase-Related)

### 7.1 GET /api/user/profile
**File**: `app/api/user/profile/route.ts:10-64`
**Method**: GET
**Auth**: Required (cookie-based)

**Business Logic**:
1. Verifies `sb-access-token` cookie
2. Fetches profile from `users` table
3. **Auto-creates** profile if not found (PGRST116 = not found) (`profile/route.ts:34-53`)

**Response fields**: id, email, name, avatar_url, locale, currency, phone, email_verified, notification_preferences, deletion_requested_at

### 7.2 PATCH /api/user/profile
**File**: `app/api/user/profile/route.ts:69-118`
**Method**: PATCH
**Auth**: Required (cookie-based)

**Updatable fields**: name, phone, locale, currency, avatar_url, notification_preferences

**Security Note**: Updates use `eq('email', user.email)` instead of `eq('id', user.id)` which relies on email uniqueness in the users table.

### 7.3 POST /api/profile/change-password
**File**: `app/api/profile/change-password/route.ts:1-113`
**Method**: POST
**Auth**: Required (cookie-based with session restoration)
**Rate Limiting**: `changePasswordLimiter.check()` per user ID (`change-password/route.ts:50-53`)

**Business Logic**:
1. Restores Supabase session from cookies (access + refresh token)
2. Rate limit check
3. Validates new password >= 8 chars
4. **Verifies current password** by calling `signInWithPassword` (`change-password/route.ts:76-79`)
5. Updates password via `auth.updateUser`

### 7.4 POST /api/profile/change-email
**File**: `app/api/profile/change-email/route.ts:1-104`
**Method**: POST
**Auth**: Required (cookie-based with session restoration)
**Rate Limiting**: `changeEmailLimiter.check()` per user ID (`change-email/route.ts:49-52`)

**Business Logic**:
1. Validates email format via regex
2. Prevents setting same email
3. **Verifies current password** for security
4. Delegates to `auth.updateUser({ email: newEmail })` -- Supabase sends confirmation

### 7.5 POST /api/profile/avatar
**File**: `app/api/profile/avatar/route.ts:1-124`
**Method**: POST
**Auth**: Required (cookie-based)
**Rate Limiting**: `avatarUploadLimiter.check()` per user ID (`avatar/route.ts:40-43`)

**Business Logic**:
1. Accepts FormData with `avatar` field
2. Validates: image type only, max 2MB
3. Resizes to 256x256 WebP via `sharp`
4. Uploads to Supabase Storage `avatars` bucket
5. Deletes old avatar from storage
6. Updates `users.avatar_url`

### 7.6 POST /api/profile/delete
**File**: `app/api/profile/delete/route.ts:1-131`
**Method**: POST
**Auth**: Required (cookie-based)

**Request**: `{ confirm: boolean }`

**Business Logic** (GDPR-compliant soft delete):
1. Requires explicit `confirm: true`
2. Sets `deletion_requested_at` timestamp (30-day grace period)
3. Sends confirmation email with date info
4. Signs out user and clears cookies

### 7.7 POST /api/profile/cancel-deletion
**File**: `app/api/profile/cancel-deletion/route.ts:1-52`
**Method**: POST
**Auth**: Required (cookie-based)

**Business Logic**: Clears `deletion_requested_at` if deletion is pending.

### 7.8 GET /api/profile/export
**File**: `app/api/profile/export/route.ts:1-154`
**Method**: GET
**Auth**: Required (cookie-based)
**Rate Limiting**: Custom -- max 1 export per 24 hours (stored in user `preferences.last_data_export`)

**Business Logic** (GDPR Article 20 - Right to Data Portability):
1. Gathers data from 8 tables: users, orders, conversations+messages, user_designs, wishlists, personalizations, notifications, shipping_addresses
2. Creates ZIP file with JSON exports and README
3. Updates last export timestamp
4. Returns ZIP as downloadable attachment

### 7.9 GET /api/profile/payment-methods
**File**: `app/api/profile/payment-methods/route.ts:1-103`
**Method**: GET
**Auth**: Required (cookie-based)

**Business Logic**:
1. Fetches `stripe_customer_id` from users table
2. Lists card-type payment methods from Stripe
3. Returns formatted list (brand, last4, exp_month, exp_year)

### 7.10 DELETE /api/profile/payment-methods/[id]
**File**: `app/api/profile/payment-methods/[id]/route.ts:1-66`
**Method**: DELETE
**Auth**: Required (cookie-based)

**Business Logic**:
1. Retrieves payment method from Stripe
2. **Ownership verification**: Checks `pm.customer === profile.stripe_customer_id` (`payment-methods/[id]/route.ts:45`)
3. Detaches payment method from customer

---

## 8. Shipping Address APIs

### 8.1 GET /api/shipping-addresses
**File**: `app/api/shipping-addresses/route.ts:5-39`
**Method**: GET
**Auth**: Required (cookie-based)

**Business Logic**: Returns all addresses for user, sorted by `is_default` desc then `created_at` desc.

### 8.2 POST /api/shipping-addresses
**File**: `app/api/shipping-addresses/route.ts:42-117`
**Method**: POST
**Auth**: Required (cookie-based)

**Request Schema**:
```typescript
{
  label?, full_name?, street_line1, street_line2?,
  city, state?, postal_code, country_code,
  phone?, is_default?
}
```

**Business Logic**:
1. Validates required fields (street_line1, city, postal_code, country_code)
2. If `is_default: true`: unsets all other defaults for this user
3. Inserts new address

**Note**: No limit on number of addresses per user.

### 8.3 PUT /api/shipping-addresses/[id]
**File**: `app/api/shipping-addresses/[id]/route.ts:7-95`
**Method**: PUT
**Auth**: Required (cookie-based)

**Business Logic**:
1. **Ownership check**: Verifies `address.user_id === user.id` (`shipping-addresses/[id]/route.ts:53-55`)
2. Handles default address toggling
3. Updates all fields

### 8.4 DELETE /api/shipping-addresses/[id]
**File**: `app/api/shipping-addresses/[id]/route.ts:98-150`
**Method**: DELETE
**Auth**: Required (cookie-based)

**Business Logic**: Ownership check then hard delete.

---

## 9. Subscription & Credits APIs

### 9.1 POST /api/subscription/create
**File**: `app/api/subscription/create/route.ts:1-81`
**Method**: POST
**Auth**: Required (`requireAuth`)

**Business Logic**:
1. Checks if user already has active subscription (`subscription/create/route.ts:31`)
2. Gets or creates Stripe customer (`subscription/create/route.ts:39-52`)
3. Creates Stripe Checkout session in `subscription` mode
4. Uses `STRIPE_PREMIUM_PRICE_ID` env var

**Response**: `{ url: string }` (Stripe Checkout URL)

### 9.2 GET /api/subscription/usage
**File**: `app/api/subscription/usage/route.ts:1-74`
**Method**: GET
**Auth**: Required (`requireAuth`)

**Response**:
```typescript
{
  tier: 'free' | 'premium',
  credit_balance: number,
  subscription_status: 'active' | 'past_due' | 'none' | 'cancelled',
  limits: {
    chats_per_day: number,
    designs_per_month: number,
    mockups_per_month: number
  }
}
```

**Tier limits** (`subscription/usage/route.ts:19-30`):
| Tier | Chats/Day | Designs/Month | Mockups/Month |
|---|---|---|---|
| free | 30 | 5 | 10 |
| premium | 100 | 50 | 100 |

### 9.3 POST /api/credits/purchase
**File**: `app/api/credits/purchase/route.ts:1-110`
**Method**: POST
**Auth**: Required (`requireAuth`)
**Tier Gate**: Premium only (`credits/purchase/route.ts:33-37`)

**Credit Packs** (`credits/purchase/route.ts:20-24`):
| Pack | Credits | Price |
|---|---|---|
| small | 15 | EUR 4.99 |
| medium | 50 | EUR 14.99 |
| large | 150 | EUR 39.99 |

**Business Logic**:
1. Rejects free-tier users (credits are premium-only overflow)
2. Gets or creates Stripe customer
3. Creates Stripe Checkout session in `payment` mode
4. Metadata includes `type: 'credit_pack'`, `user_id`, `pack`, `credits`

**Credit fulfillment**: Handled by Stripe webhook handler (`handleCreditPackPurchase` in `webhooks/stripe/route.ts:655-725`)

---

## 10. Billing Portal API

### 10.1 POST /api/billing/portal
**File**: `app/api/billing/portal/route.ts:1-64`
**Method**: POST
**Auth**: Required (`requireAuth`)

**Business Logic**:
1. Looks up `stripe_customer_id` from users table
2. Requires existing Stripe customer ID
3. Creates Stripe Customer Portal session with return URL `/en/settings/billing`

**Response**: `{ url: string }` (Stripe portal URL)

**Note**: Return URL is hardcoded to `/en/` locale.

---

## 11. Webhook Routes

### 11.1 POST /api/webhooks/stripe
**File**: `app/api/webhooks/stripe/route.ts:1-1008`
**Auth**: Stripe webhook signature verification

**Events handled**:

| Event | Handler | Effect |
|---|---|---|
| `checkout.session.completed` | `handleCheckoutSessionCompleted` | Creates order, order items, notifications, audit log, submits to Printify, sends email |
| `customer.subscription.created/updated` | `handleSubscriptionUpdate` | Updates user tier, bonus credits |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Reverts to free tier |
| `payment_intent.succeeded` | (log only) | Console log |
| `payment_intent.payment_failed` | (log only) | Console log |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Sets subscription to past_due, emails user + admin |
| `charge.dispute.created` | `handleChargeDisputeCreated` | Cancels order, audit log, admin alerts |

**handleCheckoutSessionCompleted details** (`stripe/route.ts:96-534`):
1. **Idempotency check**: Looks for existing order by `stripe_session_id` (`stripe/route.ts:152-161`)
2. Retrieves full session with line items and payment method
3. Creates order record with status `paid`
4. Creates order items (filters out items without product_id or variant_id)
5. Creates notification for authenticated users
6. Creates audit log entry
7. Increments coupon usage counter
8. **Printify order submission** (`stripe/route.ts:323-499`):
   - Maps DB product/variant IDs to Printify IDs (dual-read: provider-agnostic + legacy columns)
   - Guards against missing variant mappings (sets `requires_review`)
   - Creates Printify order via provider abstraction
   - Submits for production
   - Handles failures: marks for retry, notifies admin + customer
9. Handles credit pack purchases if metadata indicates
10. Sends order confirmation email

**handleCreditPackPurchase** (`stripe/route.ts:655-725`):
- **Idempotent**: Uses `UNIQUE(user_id, stripe_payment_id)` constraint on `credit_transactions`
- **Atomic**: Uses `add_credits` RPC for race-free balance update
- Sends confirmation email

**handleChargeDisputeCreated** (`stripe/route.ts:888-1007`):
- Finds order by payment intent ID
- Sets order status to `cancelled` (note: TODO comment says to add `disputed` status)
- Creates audit log + admin notifications

### 11.2 POST /api/webhooks/printify
**File**: `app/api/webhooks/printify/route.ts:1-673`
**Auth**: HMAC-SHA256 signature with timing-safe comparison
**Marked as**: `@deprecated` -- migrating to unified `/api/webhooks/pod/[provider]`

**Events handled**:

| Event | Effect |
|---|---|
| `order:created` | Confirms order record exists |
| `order:shipped` | Updates status + tracking info, notification + email |
| `order:delivered` | Updates status, notification + email |
| `order:cancelled` | Auto-refund via `issueRefund()`, notification + email |
| `order:failed` | Auto-refund via `issueRefund()`, notification + email |
| `product:publish:started` | Confirms publishing |
| `product:publish:succeeded` / `product:created` / `product:updated` | Syncs product via `syncProductFromPrintify()` |
| `product:deleted` | Cascading soft delete |

**Key behaviors**:
- `order:shipped` aggregates tracking from multiple shipments (`printify/route.ts:204-214`)
- `order:shipped`/`order:delivered` check user email notification preferences before sending
- `order:cancelled` and `order:failed` use `issueRefund()` from refund-guard (atomic refund)
- `order:failed`/`order:cancelled` use `transition()` from state-transition module
- All handlers write audit log entries
- Returns 200 even on processing errors to prevent Printify retries

### 11.3 POST /api/webhooks/pod/[provider]
**File**: `app/api/webhooks/pod/[provider]/route.ts:1-146`
**Auth**: Provider-specific (HMAC header for Printify, query param for Printful)

**Architecture**: Unified webhook endpoint for all POD providers.

**Flow**:
1. Validates provider ID (`printify` or `printful`)
2. Reads raw body
3. Initializes provider via registry
4. Verifies webhook signature (provider-specific)
5. Normalizes event to canonical `NormalizedWebhookEvent` format
6. Writes audit log
7. Routes to appropriate handler via `webhookRouter`

### 11.4 POST /api/webhooks/cache-invalidate
**File**: `app/api/webhooks/cache-invalidate/route.ts:1-44`
**Auth**: `x-api-key` header match against `CACHE_INVALIDATE_API_KEY`

**Types**: `product-sync`, `brand-update`, `full`

---

## 12. Cron Jobs (Purchase-Related)

### 12.1 GET /api/cron/retry-printify-orders
**File**: `app/api/cron/retry-printify-orders/route.ts:1-202`
**Auth**: Bearer token (`CRON_SECRET`)
**Schedule**: Periodic (Vercel Cron or external)

**Constants**:
- `RETRY_WINDOW_MINUTES`: 30
- `HARD_TIMEOUT_HOURS`: 2
- `REQUIRES_REVIEW_TIMEOUT_HOURS`: 24
- `MAX_RETRY_ATTEMPTS`: 3

**Business Logic**:

**Part 1 -- Stuck 'paid' orders** (no printify_order_id):
- For each stuck order:
  - If retries >= 3 OR paid > 2h ago: **auto-refund** via `issueRefund()`, transition to `refunded`
  - If within 30min window: increment retry count, transition to `requires_review`
  - Otherwise: skip for next run

**Part 2 -- Old 'requires_review' orders** (>24h old):
- **Auto-refund** via `issueRefund()`, transition to `refunded`

### 12.2 GET /api/cron/abandoned-cart-recovery
**File**: `app/api/cron/abandoned-cart-recovery/route.ts:1-360`
**Auth**: Bearer token (`CRON_SECRET`)
**Schedule**: Every 30-60 minutes

**Business Logic**:
1. Finds abandoned carts (authenticated users only, >1h since last update)
2. Checks if user has since completed an order (marks as recovered)
3. **First email** (>1h abandoned): "You left items in your cart"
4. **Second email** (>24h abandoned): "Your cart is still waiting!"
5. Tracks emails in `abandoned_carts` table
6. Locale-aware (en/es/de) email content

**Note**: Only works for authenticated users. Guest carts have no email.

### 12.3 GET /api/cron/check-delivery-status
**File**: `app/api/cron/check-delivery-status/route.ts:1-178`
**Auth**: Bearer token (`CRON_SECRET`)

**Business Logic**:
1. **Advisory lock** via `acquireLock()` prevents concurrent runs (`check-delivery-status/route.ts:42-48`)
2. Finds orders shipped >= 3 days ago (batch of 20)
3. Queries provider for current order status
4. If status = `delivered`: synthesizes a webhook event and routes through `webhookRouter`
5. Records run via `recordRun()`

**Purpose**: Required because Printful does not send `order_delivered` webhook events.

### 12.4 GET /api/cron/hard-delete-accounts
**File**: `app/api/cron/hard-delete-accounts/route.ts:1-123`
**Auth**: Bearer token (`CRON_SECRET`)
**Schedule**: Daily

**Business Logic** (GDPR right to be forgotten):
1. Finds accounts where `deletion_requested_at > 30 days ago`
2. For each account:
   - Deletes: shipping_addresses, personalizations, wishlists, notifications, user_consents, messages, conversations
   - **Anonymizes** orders (keeps for business records but removes PII)
   - Deletes cart items, user record, Supabase Auth user
3. Processes in batches of 100

---

## 13. Coupon Validation API

### 13.1 POST /api/coupons/validate
**File**: `app/api/coupons/validate/route.ts:1-121`
**Method**: POST
**Auth**: None (public)
**Rate Limiting**: `couponLimiter.check(ip)` by IP address

**Request**: `{ code: string, cartTotal: number }`

**Validations**:
1. Code lookup (case-insensitive via `ilike`)
2. Date range (valid_from / valid_until)
3. Usage limit check
4. Minimum purchase amount
5. Discount calculation (percentage with optional max cap, or fixed amount)

**Response**: `{ valid, coupon: { code, discount_type, discount_value }, discount_amount, new_total }`

**Security Note**: Debug info (`fetchError.message`) is returned in the 404 response for invalid coupons (`validate/route.ts:44`) -- should be removed in production.

---

## 14. Session Migration API

### 14.1 POST /api/session/migrate
**File**: `app/api/session/migrate/route.ts:1-87`
**Method**: POST
**Auth**: Required (`requireAuth`)

**Request**: `{ fingerprint?, conversationIds?: string[], sessionId?: string }`

**Business Logic**:
1. Migrates anonymous conversations to authenticated user
2. Migrates anonymous usage counts via `migrate_usage` RPC
3. **Security**: Uses separate queries instead of `.or()` to prevent SQL injection (`session/migrate/route.ts:33`)

**Note**: Does not migrate cart items -- cart migration from guest to authenticated happens implicitly when the user logs in and subsequent cart API calls use `user_id` instead of `session_id`.

---

## 15. Order State Machine

**File**: `lib/reliability/state-transition.ts:24-36`

```
pending --> paid --> submitted --> in_production --> shipped --> delivered
  |          |         |              |                |           |
  v          v         v              v                v           v
cancelled  refunded  cancelled     cancelled        refunded    refunded
           requires_review  requires_review  requires_review
```

**Full transition matrix** for orders:
```
pending       -> paid, cancelled
paid          -> submitted, requires_review, cancelled, refunded
submitted     -> in_production, shipped, requires_review, cancelled
in_production -> shipped, requires_review, cancelled
shipped       -> delivered, refunded
requires_review -> paid, cancelled, refunded
delivered     -> refunded
cancelled     -> (terminal)
refunded      -> (terminal)
```

**Refund Guard** (`lib/reliability/refund-guard.ts`):
- Two-phase refund: Stripe refund -> atomic DB record via `issue_refund_atomic` RPC
- If DB indicates already refunded, cancels the Stripe refund
- Prevents double-refund race conditions

---

## 16. Security Analysis & Gaps

### Critical Issues

| Issue | Severity | Location | Description |
|---|---|---|---|
| **No auth on return request creation** | CRITICAL | `orders/[id]/returns/route.ts:22` | POST /api/orders/[id]/returns has no authentication. Anyone with an order UUID can create a return request for full refund amount. |
| **No auth on return request listing** | HIGH | `orders/[id]/returns/route.ts:121` | GET /api/orders/[id]/returns has no authentication. Anyone can view return requests. |
| **No ownership check on PATCH /api/cart** | MEDIUM | `cart/route.ts:442` | Cart PATCH uses admin client without verifying the cart item belongs to the requesting user/session. |
| **Debug info in coupon error** | LOW | `coupons/validate/route.ts:44` | Returns `fetchError.message` in production responses. |
| **Disputed status workaround** | LOW | `webhooks/stripe/route.ts:920` | Uses `cancelled` instead of `disputed` status for chargebacks (TODO in code). |

### Authentication Coverage Summary

| Endpoint | Auth Level | Ownership Check |
|---|---|---|
| GET /api/cart | Optional (cookie) | By user_id or session_id |
| POST /api/cart | Optional (cookie) | N/A (creates item) |
| PATCH /api/cart | Optional (cookie) | **MISSING** |
| DELETE /api/cart | Optional (cookie) | By user_id or session_id |
| POST /api/cart/shipping-estimate | None | N/A |
| POST /api/checkout/create-session | None | N/A (guest checkout) |
| POST /api/checkout/calculate-tax | None | N/A |
| GET /api/orders | requireAuth | By user_id |
| GET /api/orders/[id] | requireAuth | user_id check (admins bypass) |
| GET /api/orders/[id]/invoice | requireAuth | user_id check (admins bypass) |
| POST /api/orders/[id]/reorder | requireAuth | Strict user_id check |
| POST /api/orders/[id]/returns | **NONE** | **NONE** |
| GET /api/orders/[id]/returns | **NONE** | **NONE** |
| GET /api/admin/orders | requireAdmin | N/A (all orders) |
| GET /api/admin/returns | requireAdmin | N/A (all returns) |
| PUT /api/admin/returns/[id] | requireAdmin | N/A (admin action) |
| POST /api/returns/[id]/tracking | SSR auth | user_id ownership |
| GET /api/user/profile | Cookie auth | N/A (own profile) |
| PATCH /api/user/profile | Cookie auth | N/A (own profile) |
| POST /api/profile/change-password | Cookie + session | Rate limited |
| POST /api/profile/change-email | Cookie + session | Rate limited |
| POST /api/profile/avatar | Cookie auth | Rate limited |
| POST /api/profile/delete | Cookie auth | Requires confirm |
| POST /api/profile/cancel-deletion | Cookie auth | Own account |
| GET /api/profile/export | Cookie auth | 24h rate limit |
| GET /api/profile/payment-methods | Cookie auth | Stripe customer match |
| DELETE /api/profile/payment-methods/[id] | Cookie auth | Stripe ownership check |
| GET /api/shipping-addresses | Cookie auth | By user_id |
| POST /api/shipping-addresses | Cookie auth | Sets user_id |
| PUT /api/shipping-addresses/[id] | Cookie auth | user_id ownership |
| DELETE /api/shipping-addresses/[id] | Cookie auth | user_id ownership |
| POST /api/subscription/create | requireAuth | Own subscription |
| GET /api/subscription/usage | requireAuth | Own usage |
| POST /api/credits/purchase | requireAuth | Tier gate (premium only) |
| POST /api/billing/portal | requireAuth | Stripe customer match |
| POST /api/coupons/validate | None | IP rate limit |
| POST /api/session/migrate | requireAuth | N/A |

### Rate Limiting Coverage

| Endpoint | Rate Limiter | Key |
|---|---|---|
| POST /api/profile/change-password | `changePasswordLimiter` | `password:{userId}` |
| POST /api/profile/change-email | `changeEmailLimiter` | `email:{userId}` |
| POST /api/profile/avatar | `avatarUploadLimiter` | `avatar:{userId}` |
| GET /api/profile/export | Custom (24h cooldown) | `preferences.last_data_export` |
| POST /api/coupons/validate | `couponLimiter` | IP address |
| All cron routes | `verifyCronSecret` | Bearer token |

**Routes WITHOUT rate limiting**:
- POST /api/cart (add to cart)
- POST /api/checkout/create-session (Stripe session creation)
- GET /api/orders (order listing)
- POST /api/orders/[id]/returns (return creation)

### Missing Features / Recommendations

1. **Add authentication to return request endpoints**: `POST /api/orders/[id]/returns` and `GET /api/orders/[id]/returns` must use `requireAuth` and verify ownership.

2. **Add ownership check to PATCH /api/cart**: Verify the cart item belongs to the user/session before updating.

3. **Add rate limiting to checkout**: Prevent abuse of Stripe session creation (each creates API calls to Stripe, Supabase, and potentially Printify).

4. **Add `disputed` status to order state machine**: Currently uses `cancelled` as a workaround for chargebacks.

5. **Partial refund support**: Returns currently always request full order amount. Consider adding per-item return capability.

6. **Remove debug info from coupon validation error**: The `fetchError.message` leak in production.

7. **Billing portal locale**: Hardcoded to `/en/settings/billing` return URL. Should use user's locale.

8. **Guest order access**: `GET /api/orders/[id]` allows any authenticated user to view guest orders (where `user_id` is null) since the ownership check is `order.user_id && order.user_id !== user.id`.

9. **Cart item quantity bombing**: No per-cart total items limit. Only per-item `MAX_CART_QUANTITY` exists.

10. **Missing cart-to-user migration**: When a guest user logs in, their session-based cart items are not automatically migrated to their user account. The session/migrate endpoint only handles conversations and usage, not cart items.
