# Order Lifecycle Audit — Complete Report

**Date**: 2026-03-08
**Scope**: Database schema, status machine, creation flow, fulfillment flow, returns/refunds, cron jobs

---

## 1. Database Schema — All Order-Related Tables

### 1.1 `orders` Table

**File**: `supabase/migrations/20260213000000_initial_schema.sql` (lines 105-125)
**Additions via migrations**: Multiple ALTER TABLE migrations added columns over time.

| Column | Type | Constraints | Added By |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Initial |
| `user_id` | UUID | FK -> users(id) ON DELETE SET NULL | Initial |
| `stripe_session_id` | VARCHAR(255) | | Initial |
| `stripe_payment_intent_id` | VARCHAR(255) | | Initial |
| `printify_order_id` | VARCHAR(255) | (Legacy, backfilled to external_order_id) | Initial |
| `status` | VARCHAR(30) | NOT NULL DEFAULT 'pending', CHECK (pending, paid, submitted, in_production, shipped, delivered, cancelled, refunded) | Initial |
| `total_cents` | INTEGER | NOT NULL, CHECK >= 0 | Initial + data_integrity |
| `currency` | VARCHAR(10) | NOT NULL DEFAULT 'EUR' | Initial (changed from 'usd') |
| `shipping_address` | JSONB | | Initial |
| `customer_email` | VARCHAR(255) | | Initial |
| `tracking_number` | VARCHAR(255) | | Initial |
| `tracking_url` | TEXT | | Initial |
| `carrier` | VARCHAR(100) | | Initial |
| `locale` | VARCHAR(5) | NOT NULL DEFAULT 'en' | Initial |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Initial |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Initial |
| `paid_at` | TIMESTAMPTZ | | Initial |
| `shipped_at` | TIMESTAMPTZ | | Initial |
| `delivered_at` | TIMESTAMPTZ | | 20260214160000 |
| `printify_status` | VARCHAR(50) | | 20260215131133 |
| `printify_retry_count` | INTEGER | NOT NULL DEFAULT 0 | 20260214033304 |
| `printify_cost_cents` | INTEGER | | 20260216000000 |
| `stripe_fee_cents` | INTEGER | | 20260216000000 |
| `gift_message` | TEXT | | 20260221110000 |
| `payment_method` | VARCHAR(50) | | 20260222154832 |
| `stripe_refund_id` | VARCHAR(255) | UNIQUE | 20260223190344 |
| `refunded_at` | TIMESTAMPTZ | | 20260223190344 |
| `refund_amount_cents` | INTEGER | | 20260223190344 |
| `refund_reason` | TEXT | | 20260223190344 |
| `retry_count` | INTEGER | DEFAULT 0, NOT NULL | 20260223190344 |
| `external_order_id` | TEXT | | 20260302100000 |
| `pod_provider` | VARCHAR(20) | NOT NULL DEFAULT 'printify' | 20260302100000 |
| `pod_cost_cents` | INTEGER | | 20260302100000 |
| `pod_retry_count` | INTEGER | NOT NULL DEFAULT 0 | 20260302100000 |
| `pod_error` | TEXT | | 20260302100000 |
| `pod_last_attempt_at` | TIMESTAMPTZ | | 20260302100000 |
| `admin_notes` | JSONB | DEFAULT '[]'::jsonb | 20260306233418 |
| `tenant_id` | UUID | NOT NULL, FK -> tenants(id) | 20260224102643 |

**Indexes on `orders`**:
- `idx_orders_user_status` — (user_id, status)
- `idx_orders_stripe_session` — (stripe_session_id)
- `idx_orders_printify_status` — (printify_status)
- `idx_orders_payment_method` — (payment_method) WHERE payment_method IS NOT NULL
- `idx_orders_pod_retry` — (pod_retry_count, pod_last_attempt_at) WHERE pod_error IS NOT NULL AND status = 'paid'
- `idx_orders_external_order_id` — (external_order_id) WHERE external_order_id IS NOT NULL
- `idx_orders_status_created` — (status, created_at DESC)
- `idx_orders_tenant_id` — (tenant_id)

**RLS Policies**:
- `Users can view own orders` — FOR SELECT USING (auth.uid() = user_id)

**Triggers**:
- `update_orders_updated_at` — BEFORE UPDATE, sets updated_at = NOW()

---

### 1.2 `order_items` Table

**File**: `supabase/migrations/20260213000000_initial_schema.sql` (lines 127-135)

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() |
| `order_id` | UUID | NOT NULL, FK -> orders(id) ON DELETE CASCADE |
| `product_id` | UUID | NOT NULL, FK -> products(id) |
| `variant_id` | UUID | FK -> product_variants(id) |
| `quantity` | INTEGER | NOT NULL, CHECK (quantity > 0) |
| `unit_price_cents` | INTEGER | NOT NULL |
| `printify_line_item_id` | VARCHAR(255) | (Legacy) |
| `external_line_item_id` | TEXT | Added by 20260302100000 |
| `personalization_id` | UUID | (Added later, referenced in checkout code) |
| `composition_id` | UUID | (Added later, referenced in checkout code) |

---

### 1.3 `return_requests` Table

**File**: `supabase/migrations/20260214031838_create_return_requests_table.sql`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `order_id` | UUID | NOT NULL, FK -> orders(id) ON DELETE CASCADE |
| `user_id` | UUID | FK -> users(id) ON DELETE SET NULL |
| `reason` | TEXT | NOT NULL |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'pending', CHECK (pending, approved, rejected, processing, completed) |
| `refund_amount_cents` | INTEGER | |
| `refund_currency` | VARCHAR(10) | DEFAULT 'usd' |
| `stripe_refund_id` | VARCHAR(255) | |
| `admin_notes` | TEXT | |
| `approved_by` | UUID | FK -> users(id) |
| `approved_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `tracking_number` | TEXT | Added by 20260224105922 |
| `tracking_carrier` | TEXT | Added by 20260224105922 |
| `customer_shipped_at` | TIMESTAMPTZ | Added by 20260224105922 |
| `item_received_at` | TIMESTAMPTZ | Added by 20260224105922 |

**Indexes**: order_id, user_id, status
**RLS**: Users view own, admins view all, admins update all

---

### 1.4 `returns` Table (Separate Lifecycle Table)

**File**: `supabase/migrations/20260223190135_create_returns_table.sql`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `order_id` | UUID | NOT NULL, FK -> orders(id) ON DELETE CASCADE |
| `customer_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `status` | VARCHAR(30) | NOT NULL DEFAULT 'return_requested', CHECK (return_requested, return_approved, item_shipped, item_received, return_completed, rejected, expired) |
| `reason` | TEXT | NOT NULL |
| `admin_notes` | TEXT | |
| `return_tracking_number` | VARCHAR(255) | |
| `refund_amount_cents` | INTEGER | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `resolved_at` | TIMESTAMPTZ | |
| `resolved_by` | UUID | FK -> users(id) |

**Note**: There are TWO return tables (`return_requests` and `returns`) with different schemas and status enums. The API at `/api/orders/[id]/returns/route.ts` uses `return_requests`. The zombie-reaper cron queries `returns`. This is a potential inconsistency.

---

### 1.5 `credit_transactions` Table

**File**: `supabase/migrations/20260222200002_idempotent_credits.sql` (inferred from code references)

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK -> users(id) |
| `amount` | INTEGER | |
| `reason` | VARCHAR | |
| `stripe_payment_id` | VARCHAR | UNIQUE(user_id, stripe_payment_id) |
| `balance_after` | INTEGER | |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

---

### 1.6 `processed_events` Table

**File**: `supabase/migrations/20260223184253_create_processed_events_table.sql`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `provider` | VARCHAR(255) | NOT NULL |
| `event_id` | VARCHAR(255) | NOT NULL |
| `event_type` | VARCHAR(255) | NOT NULL |
| `processed_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `status_code` | INTEGER | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

**Unique**: (provider, event_id)
**Purpose**: Webhook deduplication

---

### 1.7 `cron_runs` Table

**File**: `supabase/migrations/20260223185917_create_cron_runs_table.sql`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `cron_name` | VARCHAR(255) | NOT NULL |
| `started_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `finished_at` | TIMESTAMPTZ | |
| `status` | VARCHAR(20) | NOT NULL DEFAULT 'running', CHECK (running, completed, failed, skipped) |
| `duration_ms` | INTEGER | |
| `error_message` | TEXT | |
| `rows_affected` | INTEGER | |

---

### 1.8 `abandoned_carts` Table

**File**: `supabase/migrations/20260224031046_add_abandoned_cart_tracking.sql`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `session_id` | VARCHAR(255) | |
| `user_id` | UUID | FK -> users(id) ON DELETE CASCADE |
| `email` | VARCHAR(255) | NOT NULL |
| `locale` | VARCHAR(10) | NOT NULL DEFAULT 'en' |
| `first_email_sent_at` | TIMESTAMPTZ | |
| `second_email_sent_at` | TIMESTAMPTZ | |
| `cart_last_updated_at` | TIMESTAMPTZ | NOT NULL |
| `recovered_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() |

**Constraint**: Must have either session_id OR user_id (not both, not neither)

---

### 1.9 Order-Related Columns on `users` Table

| Column | Purpose |
|---|---|
| `stripe_customer_id` | Stripe customer link (added via later migration) |
| `subscription_status` | CHECK (none, active, cancelled, past_due) |
| `credit_balance` | Integer, atomic credit operations |
| `tenant_id` | Multi-tenant isolation |

---

### 1.10 Database Functions (Order-Related)

| Function | File | Purpose |
|---|---|---|
| `issue_refund_atomic(p_order_id, p_refund_amount_cents, p_refund_reason, p_stripe_refund_id)` | 20260223190734 | Atomic refund: checks refunded_at, updates order, returns BOOLEAN (TRUE=processed, FALSE=already refunded) |
| `consume_credit_atomic(p_user_id, p_action)` | 20260222200000 | Decrements credit_balance atomically, logs transaction |
| `add_credits(p_user_id, p_amount)` | (Referenced in checkout-completed.ts) | Atomically adds credits to user balance |

---

## 2. Order Status Machine

### 2.1 Database CHECK Constraint (Initial)

**File**: `supabase/migrations/20260213000000_initial_schema.sql:112`

```
CHECK (status IN ('pending', 'paid', 'submitted', 'in_production', 'shipped', 'delivered', 'cancelled', 'refunded'))
```

### 2.2 Application-Level State Machine

**File**: `frontend/src/lib/reliability/state-transition.ts` (lines 24-36)

The code defines a broader set of transitions including `requires_review` and `failed`:

```
orders: {
  pending:         ['paid', 'cancelled']
  paid:            ['submitted', 'requires_review', 'cancelled', 'refunded']
  submitted:       ['in_production', 'shipped', 'requires_review', 'cancelled']
  in_production:   ['shipped', 'requires_review', 'cancelled']
  shipped:         ['delivered', 'refunded']
  requires_review: ['paid', 'cancelled', 'refunded']
  delivered:       ['refunded']
  cancelled:       []  // Terminal
  refunded:        []  // Terminal
}
```

### 2.3 CRITICAL FINDING: Schema vs. Code Mismatch

The database CHECK constraint does NOT include `requires_review` or `failed`, but the application code uses both:

- `requires_review` is used by: `checkout-completed.ts:281`, `retry-printify-orders/route.ts:122`, zombie-reaper
- `failed` is used by: `order-failed.ts:54` (webhook handler)

**Impact**: Any attempt to set status to `requires_review` or `failed` will be rejected by the database CHECK constraint, causing silent failures.

### 2.4 Status Transition Diagram

```
                                    +-----------+
                                    |           |
                                    v           |
+---------+     +------+     +-----------+     +-----------------+
| pending | --> | paid | --> | submitted | --> | in_production   |
+---------+     +------+     +-----------+     +-----------------+
    |              |  |           |  |               |  |
    |              |  |           |  |               |  |
    v              v  v           v  v               v  v
+----------+   +-------+   +---------+          +--------+     +-----------+
| cancelled|   |requires|   |cancelled|          |shipped | --> | delivered |
+----------+   |_review |   +---------+          +--------+     +-----------+
               +-------+                            |              |
                 | | |                               v              v
                 v v v                           +--------+    +--------+
              paid/cancelled/refunded            |refunded|    |refunded|
                                                 +--------+    +--------+

Terminal states: cancelled, refunded
```

### 2.5 Status Transitions — Who Triggers What

| Transition | Triggered By | File |
|---|---|---|
| (none) -> `pending` | Stripe checkout session created (implicit) | create-session/route.ts |
| `pending` -> `paid` | Stripe webhook: checkout.session.completed | checkout-completed.ts:105 |
| `paid` -> `submitted` | POD provider order created successfully | checkout-completed.ts:354 |
| `paid` -> `requires_review` | Missing provider variant mapping | checkout-completed.ts:281 |
| `paid` -> `requires_review` | Retry cron (within retry window) | retry-printify-orders/route.ts:122 |
| `paid` -> `refunded` | Retry cron (max retries / hard timeout) | retry-printify-orders/route.ts:90 |
| `submitted` -> `shipped` | POD webhook: order.shipped | order-shipped.ts:70 |
| `shipped` -> `delivered` | POD webhook: order.delivered | order-delivered.ts:27 |
| `shipped` -> `delivered` | Cron: check-delivery-status (polling) | check-delivery-status/route.ts:119 |
| `shipped` -> `delivered` | Zombie-reaper: shipped > 30 days auto-confirm | zombie-reaper/route.ts:176 |
| `*` -> `cancelled` | POD webhook: order.cancelled | order-cancelled.ts:58 |
| `*` -> `cancelled` | Stripe dispute/chargeback | dispute-handlers.ts:47 |
| `*` -> `refunded` | POD webhook: order.cancelled (with payment) | order-cancelled.ts:44 |
| `*` -> `refunded` | POD webhook: order.failed (with payment) | order-failed.ts:54 |
| `requires_review` -> `refunded` | Retry cron: requires_review > 24h | retry-printify-orders/route.ts:163 |
| `requires_review` -> `refunded` | Zombie-reaper: requires_review > 24h | zombie-reaper/route.ts:149 |

---

## 3. Order Creation Flow

### 3.1 Full Flow: Cart -> Payment -> Order

```
[1] Customer fills cart
    └── Cart items stored in `cart_items` table (user_id or session_id)

[2] Customer initiates checkout
    └── POST /api/checkout/create-session
        ├── Rate limit: 5/min per IP (checkoutLimiter)
        ├── Validate: cart items non-empty
        ├── Validate: all items have variant_id
        ├── Validate: all products are active + not deleted
        ├── Validate: all variant is_available = true
        ├── Validate coupon code (if provided)
        ├── Resolve production URLs for custom designs (composition_id)
        ├── Server-side price override: DB variant prices override client prices
        ├── Build Stripe line items
        ├── Apply coupon discount (Stripe coupon object)
        ├── Calculate shipping: free >= EUR 50, else EUR 4.99
        ├── Stripe Connect: per-tenant routing + application_fee (10% free, 5% starter, 3% pro, 2% enterprise)
        ├── Cart metadata serialized into session.metadata.cart_items
        └── stripe.checkout.sessions.create()
            Returns: { sessionId, url }

[3] Customer pays on Stripe Checkout hosted page

[4] Stripe sends webhook: checkout.session.completed
    └── POST /api/webhooks/stripe
        ├── Verify signature (stripe.webhooks.constructEvent)
        ├── Dispatch to handleCheckoutCompleted()
        └── checkout-completed.ts handles:
            ├── Skip if payment_status !== 'paid'
            ├── Retrieve full session (line_items, payment_intent, payment_method)
            ├── Extract shipping address from collected_information
            ├── IDEMPOTENCY: Check if order already exists for this stripe_session_id
            ├── Lookup user by email
            ├── INSERT into `orders` (status='paid', paid_at=now())
            ├── INSERT into `order_items` (filter out items without product_id/variant_id)
            ├── CREATE notification (order_confirmation)
            ├── CREATE audit_log entry (order_created)
            ├── INCREMENT coupon usage counter
            ├── SUBMIT to POD provider (see Section 4)
            └── SEND order confirmation email via Resend

[5] Customer sees success page
    └── /[locale]/checkout/success?session_id={id}
```

### 3.2 Key Files

| Step | File |
|---|---|
| Checkout session creation | `frontend/src/app/api/checkout/create-session/route.ts` |
| Tax calculation | `frontend/src/app/api/checkout/calculate-tax/route.ts` |
| Stripe webhook dispatcher | `frontend/src/app/api/webhooks/stripe/route.ts` |
| Checkout completed handler | `frontend/src/lib/webhooks/stripe/checkout-completed.ts` |
| Shared webhook utilities | `frontend/src/lib/webhooks/stripe/shared.ts` |
| Stripe library | `frontend/src/lib/stripe.ts` |
| Store config (shipping, currency) | `frontend/src/lib/store-config.ts` |

### 3.3 Idempotency & Safety

- **Order creation**: Checks for existing order by `stripe_session_id` before INSERT
- **Credit pack purchase**: Uses UNIQUE(user_id, stripe_payment_id) constraint + atomic RPC
- **Coupon usage**: Increment via simple UPDATE (not atomic -- potential race condition)
- **Price authority**: Server overrides client prices with DB variant prices (prevents manipulation)
- **Product validation**: Checks products are active and not soft-deleted before Stripe session
- **Stock validation**: Checks variant `is_available` before creating payment session

---

## 4. Order Fulfillment Flow (POD Submission)

### 4.1 Submission Flow (Inside Checkout Completed Handler)

```
[4a] After order INSERT (status='paid')
    └── Submit to POD Provider
        ├── initializeProviders() — loads configured provider (Printful)
        ├── getProvider() — gets active provider instance
        ├── Fetch provider_product_id from products table
        ├── Fetch external_variant_id from product_variants table
        ├── GUARD: verify all items have provider variant mappings
        │   └── If missing: set status='requires_review', notify admin, send customer email, RETURN
        ├── Build canonical address (canonicalAddressFromStripe)
        ├── provider.createOrder() — submits to POD API
        │   ├── internalOrderId = order.id (Supabase UUID)
        │   ├── lineItems with productExternalId, variantExternalId, quantity
        │   └── Custom design files via `files` parameter (if composition_id exists)
        ├── UPDATE order: external_order_id, pod_provider='printful', status='submitted'
        └── provider.submitForProduction() — triggers production
            └── On failure: set pod_error, pod_retry_count=1, notify admin, send customer email
```

### 4.2 POD Webhook Events (Provider -> Our System)

**Endpoint**: `POST /api/webhooks/pod/[provider]` (provider = 'printify' | 'printful')
**File**: `frontend/src/app/api/webhooks/pod/[provider]/route.ts`

Flow:
```
[1] Provider sends webhook event
[2] Extract and validate provider ID from URL path
[3] Read raw body
[4] Initialize provider instance
[5] Verify webhook signature
    ├── Printify: HMAC-SHA256 via x-printify-hmac-sha256 header
    └── Printful: ?secret= query parameter
[6] Parse JSON body
[7] Normalize event to canonical format (provider.normalizeEvent())
[8] Write audit_log entry
[9] Route to handler via WebhookRouter
[10] Always return 200 (prevents provider retries)
```

### 4.3 Webhook Event Handlers

**File**: `frontend/src/lib/pod/webhooks/index.ts`

| Event | Handler | Action |
|---|---|---|
| `order.created` | handleOrderCreated | Log-only: confirms order exists in DB |
| `order.updated` | handleOrderCreated | Log-only (same handler) |
| `order.shipped` | handleOrderShipped | Update status='shipped', set tracking info, notification, email, audit log |
| `order.delivered` | handleOrderDelivered | Update status='delivered', set delivered_at, notification, email, audit log |
| `order.cancelled` | handleOrderCancelled | Issue Stripe refund (via RefundGuard), state transition to cancelled/refunded, notification, email, audit log |
| `order.failed` | handleOrderFailed | Issue Stripe refund (via RefundGuard), state transition to failed/refunded, notification, email, audit log |
| `product.created` | handleProductUpdated | Sync product data |
| `product.updated` | handleProductUpdated | Sync product data |
| `product.publish_succeeded` | handleProductUpdated | Sync product data |
| `product.deleted` | handleProductDeleted | Mark product deleted |
| `stock.updated` | handleStockUpdated | Update variant availability |

### 4.4 Provider Abstraction Layer

**File**: `frontend/src/lib/pod/types.ts`

The POD provider is abstracted via ISP interfaces:
- `PODCatalogProvider` — getBlueprints, getBlueprintVariants, getVariantPricing
- `PODProductProvider` — createProduct, getProduct, listProducts, updateProduct, deleteProduct, publish
- `PODDesignProvider` — uploadDesign, generateMockup
- `PODOrderProvider` — createOrder, submitForProduction, cancelOrder, getOrder, getShippingRates
- `PODWebhookProvider` — verifyWebhook, normalizeEvent, getRegisteredEvents
- `PODProvider` — composite of all 5 interfaces

Canonical order model (`frontend/src/lib/pod/models/order.ts`):
```typescript
interface CanonicalOrder {
  externalId: string
  status: 'draft' | 'pending' | 'in_production' | 'shipped' | 'delivered' | 'cancelled' | 'failed'
  lineItems: CanonicalLineItem[]
  shippingAddress: CanonicalAddress
  shipments: CanonicalShipment[]
  createdAt: string
}
```

### 4.5 Order Lookup Strategy (Webhook Handlers)

**File**: `frontend/src/lib/pod/webhooks/handlers/utils.ts`

The `findOrder()` function uses two strategies:
1. **Strategy 1**: Provider puts our Supabase UUID in `data.order.external_id` -> lookup by `orders.id`
2. **Strategy 2**: Lookup by `orders.external_order_id` matching `event.resourceId`

### 4.6 Complete Fulfillment Flow Diagram

```
Customer pays
    │
    v
Stripe webhook: checkout.session.completed
    │
    v
handleCheckoutCompleted()
    ├── INSERT order (status='paid')
    ├── INSERT order_items
    ├── provider.createOrder() ─────────────────────────┐
    │   └── UPDATE order (status='submitted',           │
    │       external_order_id=providerOrderId)           │
    │                                                    │
    ├── provider.submitForProduction() ─────────────────┤
    │   └── On failure: set pod_error, pod_retry_count   │
    │                                                    │
    └── Send confirmation email                          │
                                                         │
    POD Provider processes order                         │
    │                                                    │
    ├── Webhook: order.shipped ─────────────────────────┤
    │   └── Update status='shipped', tracking info       │
    │       + notification + email                       │
    │                                                    │
    ├── Webhook: order.delivered ────────────────────────┤
    │   └── Update status='delivered', delivered_at      │
    │       + notification + email                       │
    │                                                    │
    ├── Webhook: order.cancelled ───────────────────────┤
    │   └── Issue Stripe refund + status='refunded'      │
    │       + notification + email                       │
    │                                                    │
    └── Webhook: order.failed ──────────────────────────┘
        └── Issue Stripe refund + status='refunded'
            + notification + email
```

---

## 5. Returns & Refunds

### 5.1 Return Request API

**File**: `frontend/src/app/api/orders/[id]/returns/route.ts`

#### POST — Create Return Request

```
POST /api/orders/:id/returns
Auth: Required (requireAuth)
Body: { reason: string } (min 10 chars, validated with Zod)

Flow:
1. Authenticate user
2. Validate body (Zod schema: reason min 10 chars)
3. Fetch order by ID
4. Ownership check: user must own order (or be admin)
5. Status check: order must be in 'paid', 'submitted', 'in_production', 'shipped', or 'delivered'
6. Duplicate check: no existing return_request in 'pending', 'approved', 'processing', or 'completed' status
   (Allows new request if previous was 'rejected')
7. INSERT into return_requests (status='pending', refund_amount_cents=order.total_cents)
8. Return 201 with return_request object
```

#### GET — List Return Requests

```
GET /api/orders/:id/returns
Auth: Required
Flow:
1. Authenticate user
2. Verify order exists + ownership check
3. SELECT * FROM return_requests WHERE order_id = :id ORDER BY created_at DESC
4. Return array of return_requests
```

### 5.2 Refund Guard (Atomic Refund Processing)

**File**: `frontend/src/lib/reliability/refund-guard.ts`

Two-phase refund:
```
1. Create Stripe refund (stripe.refunds.create)
2. Record atomically in DB (issue_refund_atomic RPC)
   └── If already refunded: cancel Stripe refund
3. If DB error: cancel Stripe refund
```

Database function `issue_refund_atomic`:
- Uses `FOR UPDATE` row lock
- Checks `refunded_at IS NOT NULL` (idempotency)
- Sets refunded_at, refund_amount_cents, refund_reason, stripe_refund_id
- Returns TRUE (first refund) or FALSE (already refunded)

### 5.3 Return Status Machine (from state-transition.ts)

```
returns: {
  return_requested: ['return_approved', 'rejected', 'expired']
  return_approved:  ['item_shipped', 'expired']
  item_shipped:     ['item_received', 'expired']
  item_received:    ['return_completed']
  return_completed: []  // Terminal
  rejected:         []  // Terminal
  expired:          []  // Terminal
}
```

**Note**: This state machine is defined in `state-transition.ts` and uses the `returns` table schema. The `return_requests` table (used by the API) has a DIFFERENT status enum: `pending, approved, rejected, processing, completed`. These are two separate systems.

### 5.4 Chargeback/Dispute Handling

**File**: `frontend/src/lib/webhooks/stripe/dispute-handlers.ts`

```
Stripe event: charge.dispute.created
    │
    v
handleChargeDisputeCreated()
    ├── Find order by stripe_payment_intent_id
    ├── Update order status to 'cancelled' (no 'disputed' status exists yet)
    ├── Create audit_log entry
    ├── Create notification for ALL admin users (type='chargeback')
    └── POST to /api/admin/alert (fallback)
```

**TODO in code**: Add 'disputed' status to orders table CHECK constraint and add columns: `stripe_dispute_id`, `stripe_dispute_reason`, `stripe_dispute_amount`.

---

## 6. Cron Jobs (Order-Related)

### 6.1 Retry Printify Orders

**File**: `frontend/src/app/api/cron/retry-printify-orders/route.ts`
**Endpoint**: `GET /api/cron/retry-printify-orders`
**Auth**: Bearer token (CRON_SECRET)

**Part 1 — Stuck 'paid' Orders** (no external_order_id):
```
Find orders: status='paid', external_order_id IS NULL, stripe_payment_intent_id NOT NULL
    │
    ├── retry_count >= 3 OR paid_at > 2h ago → AUTO-REFUND
    │   └── issueRefund() + transition('orders', id, 'paid', 'refunded')
    │
    ├── paid_at within last 30min → MARK FOR REVIEW
    │   └── INCREMENT retry_count, transition('paid' -> 'requires_review')
    │
    └── Between 30min and 2h → SKIP (wait for next run)
```

**Part 2 — Stuck 'requires_review' Orders** (> 24h):
```
Find orders: status='requires_review', > 24h old
    └── AUTO-REFUND: issueRefund() + transition('requires_review' -> 'refunded')
```

### 6.2 Check Delivery Status (Polling)

**File**: `frontend/src/app/api/cron/check-delivery-status/route.ts`
**Endpoint**: `GET /api/cron/check-delivery-status`
**Auth**: Bearer token (CRON_SECRET)

```
Required because: Printful does NOT send order_delivered webhook event.

Find orders: status='shipped', shipped_at < 3 days ago
    │
    └── For each order:
        ├── Determine provider (pod_provider column or infer from external_order_id)
        ├── Query provider API: provider.getOrder(providerOrderId)
        └── If canonicalOrder.status === 'delivered':
            ├── Synthesize NormalizedWebhookEvent (type='order.delivered')
            └── Route through webhookRouter → handleOrderDelivered()
                └── Update status='delivered', delivered_at, notification, email

Batch size: 20 orders per run
Advisory lock: prevents concurrent runs
```

### 6.3 Zombie Reaper

**File**: `frontend/src/app/api/cron/zombie-reaper/route.ts`
**Endpoint**: `GET /api/cron/zombie-reaper`
**Auth**: Bearer token (CRON_SECRET)
**Schedule**: Every 15 minutes

| Entity | State | TTL | Action |
|---|---|---|---|
| Order | `pending` | > 1h | Alert admin |
| Order | `paid` (retry_count < 3) | > 30min | Retry Printify submission |
| Order | `paid` (retry_count >= 3) | > 2h | Auto-refund (issue_refund_atomic RPC) |
| Order | `submitted` | > 7d | Alert admin |
| Order | `in_production` | > 14d | Alert admin |
| Order | `requires_review` | > 24h | Auto-refund (issue_refund_atomic RPC) |
| Order | `shipped` | > 30d | Auto-confirm delivery (status='delivered') |
| Product | `publishing` | > 1h | Revert to 'draft' |
| Product | `pending_review` | > 7d | Alert admin |
| Agent | `queued` | > 30min | Mark error + reschedule |
| Return | `pending` | > 7d | Alert admin |
| Return | `approved` | > 14d | Alert admin |

Records execution in `cron_runs` table.

### 6.4 Sync Printify (Product Reconciliation)

**File**: `frontend/src/app/api/cron/sync-printify/route.ts`
**Endpoint**: `GET /api/cron/sync-printify`
**Auth**: Bearer token
**Schedule**: Every 30 minutes

Order-related aspects:
- Does NOT touch orders directly
- Reconciles product/variant data that affects future orders (availability, pricing)
- Fixes margins below 35%
- Runs divergence detection (10% sampling)

### 6.5 Abandoned Cart Recovery

**File**: `frontend/src/app/api/cron/abandoned-cart-recovery/route.ts`
**Endpoint**: `GET /api/cron/abandoned-cart-recovery`
**Auth**: Bearer token
**Schedule**: Every 30-60 minutes

```
Find carts: user_id NOT NULL, updated_at < 1 hour ago

For each cart:
    ├── Check if user completed an order since cart update → skip (recovered)
    ├── 1st email: cart abandoned > 1h, no first_email_sent_at
    └── 2nd email: cart abandoned > 24h, first_email_sent_at exists, no second_email_sent_at

Emails: Locale-aware (en/es/de), branded HTML, CTA links to /[locale]/cart
Tracking: via `abandoned_carts` table
```

---

## 7. Order-Related API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/checkout/create-session` | None (email optional) | Create Stripe Checkout session |
| POST | `/api/checkout/calculate-tax` | None | Calculate tax for cart |
| POST | `/api/webhooks/stripe` | Stripe signature | Handle Stripe webhook events |
| POST | `/api/webhooks/pod/[provider]` | HMAC/secret | Handle POD provider webhooks |
| GET | `/api/orders` | JWT | List user's orders (paginated) |
| GET | `/api/orders/[id]` | JWT + ownership | Get order details with items |
| GET | `/api/orders/[id]/invoice` | JWT + ownership | Get invoice data |
| POST | `/api/orders/[id]/reorder` | JWT + ownership | Copy order items to cart |
| POST | `/api/orders/[id]/returns` | JWT + ownership | Create return request |
| GET | `/api/orders/[id]/returns` | JWT + ownership | List return requests for order |
| GET | `/api/cron/retry-printify-orders` | CRON_SECRET | Retry stuck orders / auto-refund |
| GET | `/api/cron/check-delivery-status` | CRON_SECRET | Poll provider for delivery status |
| GET | `/api/cron/zombie-reaper` | CRON_SECRET | Detect and correct expired states |
| GET | `/api/cron/abandoned-cart-recovery` | CRON_SECRET | Send abandoned cart emails |
| GET | `/api/cron/sync-printify` | CRON_SECRET | Full product reconciliation |

---

## 8. Email Notifications (Order-Related)

All emails sent via Resend API. **File**: `frontend/src/lib/resend.ts`

| Email | Trigger | Locale Support |
|---|---|---|
| Order Confirmation | checkout.session.completed | en/es/de |
| Credit Purchase Confirmation | checkout.session.completed (credit pack) | en/es/de |
| Order Issue (requires review) | POD submission failure | en/es/de |
| Order Shipped | order.shipped webhook | en/es/de |
| Order Delivered | order.delivered webhook | en/es/de |
| Order Cancelled (with refund) | order.cancelled webhook | en/es/de |
| Order Failed | order.failed webhook | en/es/de |
| Abandoned Cart (1st) | Cron: abandoned-cart-recovery (>1h) | en/es/de |
| Abandoned Cart (2nd) | Cron: abandoned-cart-recovery (>24h) | en/es/de |

---

## 9. In-App Notifications (Order-Related)

Stored in `notifications` table with `user_id`.

| Type | Event | Message Pattern |
|---|---|---|
| `order_confirmation` | Order created | "Order #{id} Confirmed" |
| `order_shipped` | Order shipped | "Order #{id} Shipped" + tracking info |
| `order_delivered` | Order delivered | "Order #{id} Delivered" |
| `order_cancelled` | Order cancelled | "Order #{id} Cancelled" + refund info |
| `order_failed` | Order failed | "Order #{id} Failed" + refund info |
| `pod_error` | POD submission failure | Admin-only: "Provider {type} failed" |
| `chargeback` | Stripe dispute | Admin-only: "Chargeback Alert" |

---

## 10. Audit Log Entries (Order-Related)

All entries stored in `audit_log` table.

| Action | Actor Type | Actor ID | Resource Type |
|---|---|---|---|
| `order_created` | webhook | stripe_webhook | order |
| `order_shipped` | webhook | {provider}_webhook | order |
| `order_delivered` | webhook | {provider}_webhook | order |
| `order_cancelled` | webhook | {provider}_webhook | order |
| `order_failed` | webhook | {provider}_webhook | order |
| `order_disputed` | webhook | stripe_webhook | order |
| `webhook_received:{type}` | webhook | {provider}_webhook | webhook |

---

## 11. Critical Findings & Issues

### 11.1 CRITICAL: Database CHECK Constraint Missing Statuses

**Severity**: CRITICAL
**File**: `supabase/migrations/20260213000000_initial_schema.sql:112`

The `orders.status` CHECK constraint allows only: `pending, paid, submitted, in_production, shipped, delivered, cancelled, refunded`

But the application code uses:
- `requires_review` (retry cron, checkout-completed, zombie-reaper)
- `failed` (order-failed webhook handler)

**No migration exists to ALTER this CHECK constraint.**

If these statuses are set via the `transition()` function (which uses a direct UPDATE), the database will reject the write. However, some code paths bypass `transition()` and do raw `.update({ status: 'requires_review' })` -- these will also fail.

**Fix needed**: Migration to DROP and recreate the CHECK constraint with the additional statuses.

### 11.2 HIGH: Duplicate Return Tables

**Severity**: HIGH

Two separate tables track returns:
1. `return_requests` (migration 20260214031838) -- used by the API `/api/orders/[id]/returns/route.ts`
2. `returns` (migration 20260223190135) -- used by zombie-reaper cron, state-transition.ts

They have different:
- Column names (`user_id` vs `customer_id`)
- Status enums (`pending/approved/rejected/processing/completed` vs `return_requested/return_approved/item_shipped/item_received/return_completed/rejected/expired`)
- RLS policies

The zombie-reaper queries `returns` table, but the customer-facing API uses `return_requests`. This means:
- Returns created by customers (via API) are never monitored by the zombie-reaper
- The `returns` table state machine is never used in practice

### 11.3 HIGH: Duplicate Retry Columns

The orders table has TWO sets of retry tracking columns:
1. `retry_count` (from 20260223190344) -- used by zombie-reaper
2. `pod_retry_count` (from 20260302100000) -- used by checkout-completed.ts

The retry cron queries `retry_count`, while the checkout handler writes to `pod_retry_count`. These are separate columns that may diverge.

### 11.4 MEDIUM: Coupon Usage Counter Race Condition

**File**: `frontend/src/lib/webhooks/stripe/checkout-completed.ts:233-244`

Coupon usage is incremented via SELECT + UPDATE (not atomic):
```typescript
const { data: coupon } = await supabase.from('coupons').select('id, times_used')...
await supabase.from('coupons').update({ times_used: (coupon.times_used || 0) + 1 })
```

Under concurrent checkouts using the same coupon, `times_used` could be incremented incorrectly. Should use `rpc('increment_coupon_usage')` or `times_used = times_used + 1` via raw SQL.

### 11.5 MEDIUM: Dispute Handler Uses Wrong Status

**File**: `frontend/src/lib/webhooks/stripe/dispute-handlers.ts:47`

Sets `status: 'cancelled'` for disputed orders, but code comment says "Using existing status until migration adds 'disputed'". No 'disputed' status exists in the CHECK constraint, but 'cancelled' is arguably incorrect since a dispute is not the same as a cancellation.

### 11.6 LOW: Guest Checkout Notification Gap

**File**: `frontend/src/lib/webhooks/stripe/checkout-completed.ts:191`

If no user is found for the customer email (guest checkout), notifications are skipped entirely. Guest customers only receive the email notification, no in-app notification. This is acceptable but should be documented as intentional.

### 11.7 LOW: Zombie-Reaper References `total_price_cents`

**File**: `frontend/src/app/api/cron/zombie-reaper/route.ts:76`

The zombie-reaper selects `total_price_cents` from orders, but the actual column is `total_cents`. This would cause the auto-refund to pass `undefined` as the refund amount.

---

## 12. Multi-Tenant Isolation

Orders support multi-tenancy via:
- `orders.tenant_id` column (FK to tenants)
- The orders list API applies `query.eq('tenant_id', tenantId)` when `x-tenant-id` header is present
- Stripe Connect routing: per-tenant connected accounts with tiered application fees
- Cart items also have `tenant_id`

---

## 13. Reliability Infrastructure

### 13.1 State Transition Validator

**File**: `frontend/src/lib/reliability/state-transition.ts`
- Defines valid transition matrices for orders, products, returns, agent_sessions, users
- Optimistic locking: reads current state, validates transition, updates with WHERE clause
- Idempotent: same-state transitions return success

### 13.2 Refund Guard

**File**: `frontend/src/lib/reliability/refund-guard.ts`
- Two-phase refund: Stripe first, DB second
- If DB indicates already refunded, cancels the Stripe refund
- If DB errors, cancels the Stripe refund
- Uses `issue_refund_atomic` RPC with `FOR UPDATE` row lock

### 13.3 Cron Lock

**File**: `frontend/src/lib/reliability/cron-lock.ts`
- Advisory locking to prevent concurrent cron runs
- Records run results in `cron_runs` table

### 13.4 Webhook Deduplication

**Table**: `processed_events`
- UNIQUE(provider, event_id) prevents duplicate webhook processing
- Note: The POD webhook route (`/api/webhooks/pod/[provider]/route.ts`) does NOT appear to check this table before processing. The idempotency check happens at the handler level (e.g., order status already changed).
