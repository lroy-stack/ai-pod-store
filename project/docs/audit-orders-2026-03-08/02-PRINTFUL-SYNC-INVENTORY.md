# Printful Synchronization & Inventory Management Audit

**Date**: 2026-03-08
**Scope**: Printful API integration, product sync, inventory/stock management, order submission, webhook handlers, frontend availability
**Auditor**: Claude Opus 4.6

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Printful API Integration](#2-printful-api-integration)
3. [Product Sync (Printful to Supabase)](#3-product-sync-printful-to-supabase)
4. [Inventory / Stock Management](#4-inventory--stock-management)
5. [Order Submission to Printful](#5-order-submission-to-printful)
6. [Webhook Handlers (Printful to App)](#6-webhook-handlers-printful-to-app)
7. [Product Availability in Frontend](#7-product-availability-in-frontend)
8. [Reliability Infrastructure](#8-reliability-infrastructure)
9. [Test Coverage](#9-test-coverage)
10. [Gap Analysis & Recommendations](#10-gap-analysis--recommendations)
11. [Scorecard](#11-scorecard)

---

## 1. Architecture Overview

The system uses a **provider-agnostic POD abstraction layer** (`frontend/src/lib/pod/`) that decouples business logic from any specific print-on-demand provider. The project migrated from Printify to Printful, and the architecture supports dual-provider operation.

### Key Directories

| Directory | Purpose |
|---|---|
| `frontend/src/lib/pod/` | Provider abstraction layer (interfaces, models, constants, errors) |
| `frontend/src/lib/pod/printful/` | Printful-specific client, mapper, constants, webhook verifier |
| `frontend/src/lib/pod/printify/` | Legacy Printify adapter (compat shim for backward compatibility) |
| `frontend/src/lib/pod/sync/` | Provider-agnostic sync engine (product sync, margin auditor, category inferrer, conflict resolver, cascade delete) |
| `frontend/src/lib/pod/webhooks/` | Webhook router + 8 event handlers |
| `frontend/src/lib/reliability/` | Cron locks, state transitions, refund guard, divergence detector |
| `frontend/src/app/api/cron/` | Cron endpoints (sync, retry, delivery check) |
| `frontend/src/app/api/webhooks/pod/[provider]/` | Unified webhook endpoint |

### Data Flow

```
Printful API <--> PrintfulClient <--> PrintfulProvider (PODProvider interface)
                                         |
                                  Canonical Models (CanonicalProduct, CanonicalOrder, etc.)
                                         |
                               Sync Engine / Webhook Handlers
                                         |
                                      Supabase
                                    (products, product_variants, orders, order_items)
```

---

## 2. Printful API Integration

### 2.1 Client Configuration

**File**: `frontend/src/lib/pod/printful/client.ts`

```
Base URL: https://api.printful.com
Auth: Bearer token (PRINTFUL_API_TOKEN env var)
Store ID: X-PF-Store-Id header (PRINTFUL_STORE_ID env var)
User-Agent: SKAPARA-POD/1.0
Token Expiry Warning: Logs when token expires within 7 days
```

### 2.2 API Endpoints Used

| Method | Endpoint | Purpose | File |
|---|---|---|---|
| GET | `/stores` | Health check / store info | `client.ts:211-214` |
| POST | `/store/products` | Create sync product | `client.ts:218-220` |
| GET | `/store/products/{id}` | Get sync product details | `client.ts:222-224` |
| GET | `/store/products?offset=&limit=` | List sync products (paginated) | `client.ts:226-239` |
| DELETE | `/store/products/{id}` | Delete sync product | `client.ts:241-243` |
| POST | `/files` | Upload design file (URL-based) | `client.ts:247-249` |
| GET | `/files/{id}` | Get file info | `client.ts:251-253` |
| POST | `/orders` | Create order (optional `?confirm=true`) | `client.ts:257-260` |
| GET | `/orders/{id}` | Get order details | `client.ts:262-264` |
| POST | `/orders/{id}/confirm` | Confirm order for production | `client.ts:266-268` |
| DELETE | `/orders/{id}` | Cancel order | `client.ts:270-272` |
| POST | `/shipping/rates` | Calculate shipping rates | `client.ts:276-278` |
| GET | `/products` | List catalog products | `client.ts:282-284` |
| GET | `/products/{id}` | Get catalog product details | `client.ts:286-288` |
| POST | `/mockup-generator/create-task/{id}` | Create async mockup task | `client.ts:292-301` |
| GET | `/mockup-generator/task?task_key=` | Poll mockup task status | `client.ts:303-313` |

### 2.3 Rate Limiting

**File**: `frontend/src/lib/pod/printful/constants.ts`

- Token bucket: 120 requests per 60-second window
- Implementation: In-memory counter per `PrintfulClient` instance
- On 429 response: Reads `Retry-After` header, waits that duration, retries up to 2 times
- On 5xx: Exponential backoff, retries up to 2 times

### 2.4 Caching

- Catalog GET endpoints (paths starting with `/products`) cached in-memory for 10 minutes (`PRINTFUL_CATALOG_TTL_MS = 600000`)
- Cache is per-instance (not shared across serverless invocations)

### 2.5 Error Handling

**File**: `frontend/src/lib/pod/errors.ts`

| Error Class | HTTP Code | Usage |
|---|---|---|
| `PODProviderError` | varies | Generic provider API error |
| `PODNotFoundError` | 404 | Resource not found |
| `PODRateLimitError` | 429 | Rate limit exceeded after retries |
| `PODAuthError` | 401 | Authentication failure |
| `PODValidationError` | 400 | Input validation error |
| `PODUnsupportedOperationError` | N/A | Operation not supported by provider |
| `PODWebhookVerificationError` | 401 | Webhook signature mismatch |

### 2.6 Response Envelope

All Printful API responses follow `{ code, result, paging? }` format. The client automatically unwraps `.result` in `request<T>()`.

---

## 3. Product Sync (Printful to Supabase)

### 3.1 Sync Cron Endpoint

**File**: `frontend/src/app/api/cron/sync-printify/route.ts`
**Method**: `GET /api/cron/sync-printify`
**Auth**: Bearer token (`CRON_SECRET` env var, timing-safe comparison)
**Concurrency**: PostgreSQL advisory lock via `acquireLock('sync-printify')` prevents overlapping runs

#### Sync Steps

1. **Fetch all products from Printful** (paginated, 50 per page, max 10 pages = 1000 products)
2. **Fetch all Supabase products** with `provider_product_id IS NOT NULL`
3. **Create missing products** (exist in Printful but not Supabase) via `syncProductFromProvider()`
4. **Update stale products** (title, images, or status differ) via `syncProductFromProvider()`
5. **Mark orphaned products** (exist in Supabase but not Printful) as `status = 'deleted'`
6. **Reconcile variant availability**: Compare `is_available` on `product_variants` rows against provider data; batch update divergent variants
7. **Margin audit**: Fix products with margin below 35% via `auditMargins()`
8. **Divergence check** (10% sampling probability): Full field-level comparison via `detectDivergence()`

#### Staleness Detection Criteria (Step 4)

A product is re-synced when ANY of these differ:
- `title` changed
- Images are empty, contain raw strings (not objects), or have >1.5x more images than provider
- `status` changed (active vs draft)
- Product stuck in `publishing` status (attempts `confirmPublishing`)

### 3.2 Sync Engine

**File**: `frontend/src/lib/pod/sync/sync-product.ts`
**Function**: `syncProductFromProvider(product, supabase, options?)`

#### What Gets Synced

| Field | Source | Notes |
|---|---|---|
| `provider_product_id` | `CanonicalProduct.externalId` | Upsert key |
| `pod_provider` | Parsed from `blueprintRef` | e.g., "printful" |
| `product_template_id` | Parsed from `blueprintRef` | e.g., "71" |
| `provider_facility_id` | Parsed from `blueprintRef` | null for Printful |
| `title` | Provider or preserved admin edit | Conflict resolver decides |
| `description` | Provider or preserved admin edit | HTML-stripped, truncated to 2000 chars |
| `tags` | Provider or preserved admin edit | |
| `status` | `active` or `draft` | Based on `is_ignored` flag |
| `currency` | Constant `EUR` | |
| `cost_cents` | Min cost from enabled variants | null if no cost data |
| `base_price_cents` | Min price from enabled variants OR calculated | `calculateEngagementPrice()` fallback |
| `images` | Deduplicated by URL, size-chart images excluded | Array of `{src, alt, variant_ids, is_default}` |
| `category_id` | Inferred from title for NEW products only | Never overwrites existing |
| `product_details` | Merged JSONB (preserves existing, adds `safety_information`) | |
| `last_synced_at` | Current timestamp | |
| `published_at` | Current timestamp (if visible) | |

#### Variant Sync

**Function**: `syncVariantsFromProvider()` (private, called by `syncProductFromProvider`)

| Column | Source |
|---|---|
| `product_id` | UUID from products upsert |
| `external_variant_id` | `CanonicalVariant.externalId` |
| `title` | Full variant name (e.g., "Gildan 18500 (Black / M)") |
| `size` | Parsed from variant name |
| `color` | Parsed from variant name |
| `price_cents` | Retail price in EUR cents |
| `cost_cents` | Production cost (null for Printful if unavailable) |
| `sku` | Provider SKU |
| `is_enabled` | Whether variant is enabled |
| `is_available` | Based on `synced` flag from Printful |
| `image_url` | Per-variant mockup URL |

Upsert key: `(product_id, external_variant_id)`. Only enabled variants are synced (disabled variants are filtered out).

### 3.3 Admin Edit Preservation (Conflict Resolution)

**File**: `frontend/src/lib/pod/sync/conflict-resolver.ts`

When `admin_edited_at > last_synced_at`, the sync engine preserves:
- `title`
- `description`
- `tags`

Always synced regardless of admin edits:
- `base_price_cents`, `cost_cents`, `status`, `images`, `last_synced_at`

### 3.4 Category Inference

**File**: `frontend/src/lib/pod/sync/category-inferrer.ts`

Keyword-based title matching to category slugs (47 categories covering apparel, headwear, drinkware, accessories, kids, home decor, etc.). Only applied to NEW products; existing categories are never overwritten.

### 3.5 Margin Auditor

**File**: `frontend/src/lib/pod/sync/margin-auditor.ts`

- **Threshold**: 35% minimum margin (`MIN_MARGIN_THRESHOLD = 0.35`)
- **Formula**: Tiered multipliers by product type (1.55x to 2.5x cost), hard floor of 1.4x, hard ceiling of 3.0x
- **Rounding**: Up to nearest `.99` (e.g., 2501 -> 2599)
- **Minimum prices**: Range from 399 (stickers) to 3999 (blankets/pillows)

### 3.6 Cascade Delete

**File**: `frontend/src/lib/pod/sync/delete-product.ts`

On product deletion:
1. Unlink designs (set `product_id = null` -- preserves designs since they cost money)
2. Hard delete child rows from: `product_variants`, `marketing_content`, `wishlist_items`, `cart_items`
3. Soft delete the product (`deleted_at` timestamp)
4. Write to `audit_log`

---

## 4. Inventory / Stock Management

### 4.1 Data Model

The `product_variants` table has two availability-related columns:
- `is_enabled` (boolean) -- Whether the variant is offered for sale
- `is_available` (boolean) -- Whether the variant is currently in stock

### 4.2 How Availability is Determined

**Source of truth**: Printful `synced` flag on sync variants.

In `frontend/src/lib/pod/printful/mapper.ts:60`:
```typescript
isAvailable: (v as Record<string, unknown>).synced === true
```

A variant is considered available when `synced === true` in the Printful response.

### 4.3 Availability Update Mechanisms

| Mechanism | Trigger | Frequency | File |
|---|---|---|---|
| **Full sync cron** | Scheduled | Every 30 min (Vercel cron) | `api/cron/sync-printify/route.ts:199-263` |
| **Webhook: stock_updated** | Printful push event | Real-time | `pod/webhooks/handlers/stock-updated.ts` |
| **Webhook: product_updated** | Printful push event | Real-time | `pod/webhooks/handlers/product-updated.ts` |
| **Product variant sync** | During product sync | Per product | `pod/sync/sync-product.ts:209-245` |

#### Full Sync Cron Availability Reconciliation (Step 5)

The cron builds a truth map of `external_variant_id -> isAvailable` from all provider products, then compares against DB variants. Divergent variants are batch-updated (grouped by target availability for minimal queries).

#### Webhook Stock Handler

`handleStockUpdated()` processes three formats:
- Direct `data.variants[]` array with `in_stock` or `quantity` fields
- Single `data.sync_variant` object (Printful format)
- Nested `data.product.variants[]`

Updates `is_available` on `product_variants` by `external_variant_id`.

### 4.4 CRITICAL FINDING: No Real-Time Stock Tracking

Printful is a print-on-demand provider -- products are manufactured on order. There is no traditional inventory to track. The `is_available` flag primarily reflects whether:
- The variant is synced and configured in Printful
- The base blank garment is available from the supplier

The `stock_updated` webhook from Printful fires when upstream blank garment availability changes (e.g., a specific color/size of Gildan 18500 is temporarily out of stock at the factory).

### 4.5 DynamicPriceStock Component -- HARDCODED

**File**: `frontend/src/components/products/DynamicPriceStock.tsx`

**CRITICAL**: The `getDynamicPriceAndStock()` function returns `inStock = true` always:
```typescript
const inStock = true // In production: check actual inventory
```

This component is a PPR (Partial Pre-rendering) placeholder that was never connected to real data. The actual availability logic is handled at the variant level in the product detail page.

---

## 5. Order Submission to Printful

### 5.1 Order Flow

**Trigger**: Stripe `checkout.session.completed` webhook
**File**: `frontend/src/lib/webhooks/stripe/checkout-completed.ts`

#### Steps

1. **Verify payment**: Only process sessions with `payment_status === 'paid'`
2. **Idempotency check**: Skip if order already exists for `stripe_session_id`
3. **Create order in Supabase**: Status `paid`, with all metadata
4. **Create order items**: Link to `product_id` and `variant_id` from cart metadata
5. **Resolve provider IDs**: Lookup `provider_product_id` from products table, `external_variant_id` from product_variants
6. **Guard: missing mappings**: If any item lacks a valid `external_variant_id`, set order to `requires_review` and notify admin
7. **Build production URLs**: For custom designs, extract production file URLs from cart metadata (keyed by `composition_id`)
8. **Submit to Printful**: `provider.createOrder()` with `confirm=true` (creates + confirms in one call)
9. **Record provider order ID**: Update order with `external_order_id`, `pod_provider = 'printful'`, `status = 'submitted'`
10. **Submit for production**: `provider.submitForProduction()` (calls `/orders/{id}/confirm`)
11. **Error handling**: On failure, set `pod_error`, `pod_retry_count`, notify admin and customer
12. **Send confirmation email**: Via Resend

#### Order Input Format (to Printful)

From `fromCreateOrderInput()` in `frontend/src/lib/pod/printful/mapper.ts:171-201`:
```json
{
  "external_id": "<supabase-order-uuid>",
  "label": "SKAPARA <first-8-chars>",
  "shipping": "STANDARD",
  "recipient": { "name", "address1", "city", "country_code", "zip", "email" },
  "items": [{ "sync_variant_id": 12345, "quantity": 1, "files": [...] }],
  "gift": { "subject": "A gift for you from SKAPARA", "message": "..." }
}
```

### 5.2 Order Retry Cron

**File**: `frontend/src/app/api/cron/retry-printify-orders/route.ts`
**Method**: `GET /api/cron/retry-printify-orders`

Handles stuck orders in three scenarios:

| Scenario | Action | Window |
|---|---|---|
| `paid` + no `external_order_id` + within 30min | Mark as `requires_review`, increment `retry_count` | 0-30 min |
| `paid` + no `external_order_id` + retries >= 3 or > 2 hours | **Auto-refund** via Stripe, transition to `refunded` | 30min-2h or 3+ retries |
| `requires_review` > 24 hours | **Auto-refund** via Stripe, transition to `refunded` | > 24 hours |

**NOTE**: This cron does NOT actually re-submit orders to Printful. It only marks them for review or auto-refunds. The retry is manual (admin intervention).

### 5.3 Delivery Status Polling Cron

**File**: `frontend/src/app/api/cron/check-delivery-status/route.ts`
**Method**: `GET /api/cron/check-delivery-status`

**Purpose**: Printful does not send an `order_delivered` webhook event. This cron polls shipped orders to detect delivery.

- **Window**: Only checks orders shipped 3+ days ago
- **Batch size**: 20 orders per run
- **Flow**: For each shipped order, queries Printful for current status via `provider.getOrder()`. If status is `delivered`, synthesizes a `NormalizedWebhookEvent` and routes it through the webhook handler (triggers email, notification, and status update).
- **Concurrency**: PostgreSQL advisory lock prevents overlapping runs

---

## 6. Webhook Handlers (Printful to App)

### 6.1 Webhook Endpoint

**File**: `frontend/src/app/api/webhooks/pod/[provider]/route.ts`
**Method**: `POST /api/webhooks/pod/printful?secret=<PRINTFUL_WEBHOOK_SECRET>`

#### Verification

Printful uses query-string secret verification (not HMAC). The `?secret=` query parameter is compared against `PRINTFUL_WEBHOOK_SECRET` env var using timing-safe comparison (`timingSafeEqual` from `node:crypto`).

**File**: `frontend/src/lib/pod/printful/webhook-verifier.ts`

#### Processing Flow

1. Validate provider ID (only `printify` and `printful` are known)
2. Read raw body
3. Extract signature (query param for Printful, header for Printify)
4. Verify webhook signature
5. Parse JSON body
6. Normalize event via `providerInstance.normalizeEvent()`
7. Write audit log entry to `audit_log` table
8. Route to handler via `webhookRouter.route()`
9. Always return 200 after verification (prevents provider retries)

### 6.2 Event Type Mapping (Printful to Canonical)

**File**: `frontend/src/lib/pod/printful/constants.ts`

| Printful Event | Canonical Event | Handler |
|---|---|---|
| `package_shipped` | `order.shipped` | `handleOrderShipped` |
| `package_returned` | `order.cancelled` | `handleOrderCancelled` |
| `order_created` | `order.created` | `handleOrderCreated` (log-only) |
| `order_updated` | `order.updated` | `handleOrderCreated` (log-only) |
| `order_failed` | `order.failed` | `handleOrderFailed` |
| `order_canceled` | `order.cancelled` | `handleOrderCancelled` |
| `order_put_hold` | `order.updated` | `handleOrderCreated` (log-only) |
| `order_remove_hold` | `order.updated` | `handleOrderCreated` (log-only) |
| `product_synced` | `product.created` | `handleProductUpdated` |
| `product_updated` | `product.updated` | `handleProductUpdated` |
| `product_deleted` | `product.deleted` | `handleProductDeleted` |
| `stock_updated` | `stock.updated` | `handleStockUpdated` |

### 6.3 Handler Details

#### `handleOrderCreated` / `handleOrderUpdated`
- **Log-only**: Verifies the order exists in Supabase but makes no changes
- **Order lookup**: Tries `data.order.external_id` (Supabase UUID) first, then `external_order_id` column

#### `handleOrderShipped`
- Updates order: `status = 'shipped'`, `shipped_at`, `tracking_number`, `tracking_url`, `carrier`
- Handles multiple shipments (concatenates tracking numbers)
- Creates in-app notification (`notifications` table)
- Sends email via `sendOrderShippedEmail()` (respects user `notification_preferences`)
- Writes audit log

#### `handleOrderDelivered`
- Updates order: `status = 'delivered'`, `delivered_at`
- Creates in-app notification
- Sends delivery confirmation email with review prompt
- Writes audit log

#### `handleOrderCancelled`
- Issues Stripe refund via `issueRefund()` (atomic, idempotent)
- State transition via `transition()` to `cancelled` or `refunded`
- Creates in-app notification
- Sends cancellation email (only if refund was issued)
- Writes audit log

#### `handleOrderFailed`
- Issues Stripe refund via `issueRefund()` if order was paid
- State transition to `refunded` or `failed`
- Creates in-app notification (different message based on refund success)
- Sends failure email
- Writes audit log

#### `handleProductUpdated` / `handleProductCreated`
- Fetches full product from provider via `provider.getProduct()`
- Runs full `syncProductFromProvider()` (upsert product + variants)

#### `handleProductDeleted`
- Calls `deleteProductCascade()` (soft delete + cascade)

#### `handleStockUpdated`
- Extracts stock changes from multiple formats
- Updates `is_available` on `product_variants` by `external_variant_id`
- Writes audit log only if changes were made

---

## 7. Product Availability in Frontend

### 7.1 Product Detail Page

**File**: `frontend/src/app/api/products/[id]/route.ts`

The API endpoint fetches two sets of variants:
- **Available variants**: `is_enabled = true AND is_available = true` (used for variant selection)
- **All enabled variants**: `is_enabled = true` (used to build `unavailableCombinations`)

The response includes:
```json
{
  "allColors": ["Black", "White", ...],
  "allSizes": ["S", "M", "L", ...],
  "unavailableCombinations": [{"color": "Black", "size": "3XL"}, ...]
}
```

### 7.2 Variant Selector Component

**File**: `frontend/src/components/products/VariantSelector.tsx`

- Receives `availableSizes` and `availableColors` as `Set<string>`
- Unavailable variants are rendered with `opacity-40`, `cursor-not-allowed`, `line-through`
- Disabled state prevents click interaction

### 7.3 Product Detail Client (Cross-Filtering)

**File**: `frontend/src/components/products/ProductDetailClient.tsx`

Cross-filtering logic:
- When a color is selected, computes which sizes are available for that color
- When a size is selected, computes which colors are available for that size
- Auto-resets selection when chosen option becomes unavailable for the cross-filtered set

### 7.4 Product Card (Grid View)

**File**: `frontend/src/components/products/ProductCard.tsx`

No availability/out-of-stock indicator on the product card in grid view. The card shows price and color variants but does not display stock status.

---

## 8. Reliability Infrastructure

### 8.1 State Transition Validator

**File**: `frontend/src/lib/reliability/state-transition.ts`

Enforces valid order status transitions:
```
pending -> paid, cancelled
paid -> submitted, requires_review, cancelled, refunded
submitted -> in_production, shipped, requires_review, cancelled
in_production -> shipped, requires_review, cancelled
shipped -> delivered, refunded
requires_review -> paid, cancelled, refunded
delivered -> refunded
cancelled -> (terminal)
refunded -> (terminal)
```

Uses optimistic locking (`WHERE status = fromState`) to prevent race conditions.

### 8.2 Refund Guard

**File**: `frontend/src/lib/reliability/refund-guard.ts`

Two-phase atomic refund:
1. Create Stripe refund
2. Record atomically via `issue_refund_atomic()` PostgreSQL function
3. If database returns `false` (already refunded), cancel the Stripe refund

Prevents double-refund scenarios in concurrent webhook deliveries.

### 8.3 Cron Lock Manager

**File**: `frontend/src/lib/reliability/cron-lock.ts`

Uses PostgreSQL advisory locks (`try_cron_lock` RPC function) to prevent overlapping cron executions. Tracks runs in `cron_runs` table with status, duration, and error messages.

### 8.4 Divergence Detector

**File**: `frontend/src/lib/reliability/divergence-detector.ts`

Compares Supabase records against Printful source of truth. Fields checked:
- Product: title, description, product_template_id, provider_facility_id
- Variants: title, price_cents, is_enabled
- Missing variants (exist in provider but not in DB)
- Deleted products (exist in DB but return 404 from provider)

Runs probabilistically (10% chance per sync cycle) to avoid API overhead.

### 8.5 Monitoring & Alerting

**File**: `frontend/src/lib/pod/monitoring.ts`

Structured logging via Pino (`logInfo`, `logWarn`, `logError`). Sends Telegram alerts when:
- Sync errors >= 5
- Failure rate >= 50%

---

## 9. Test Coverage

**Directory**: `frontend/src/__tests__/pod/`

| Test File | Coverage |
|---|---|
| `printful-mapper.test.ts` | Variant name parsing, product mapping, webhook event normalization, order input/output mapping |
| `printify-mapper.test.ts` | Legacy Printify mapper (backward compat) |
| `webhook-verification.test.ts` | Printful query-string secret verification |
| `webhook-router.test.ts` | Event routing to handlers |
| `provider-registry.test.ts` | Provider registration, default provider, per-product routing |
| `sync-engine.test.ts` | Sync product, margin auditor, category inferrer |
| `test-utils.ts` | Shared test utilities |

---

## 10. Gap Analysis & Recommendations

### CRITICAL

| # | Gap | Impact | Location |
|---|---|---|---|
| C1 | **DynamicPriceStock always returns `inStock = true`** | Customers see "In Stock" for all products regardless of actual availability | `components/products/DynamicPriceStock.tsx:21` |
| C2 | **Retry cron does NOT re-submit orders to Printful** | Stuck orders are refunded, never retried. Revenue lost when Printful was temporarily down | `api/cron/retry-printify-orders/route.ts` |
| C3 | **costCents is always null from Printful mapper** | Margin auditor cannot calculate real margins; `calculateEngagementPrice()` fallback may be inaccurate | `pod/printful/mapper.ts:58` (`costCents: null`) |

### HIGH

| # | Gap | Impact | Location |
|---|---|---|---|
| H1 | **No out-of-stock indicator on ProductCard** | Users browse grid without knowing which products have unavailable variants | `components/products/ProductCard.tsx` |
| H2 | **`package_returned` mapped to `order.cancelled`** | A returned package triggers cancellation + refund logic, but the carrier may have failed delivery (not a cancellation) | `pod/printful/constants.ts:28` |
| H3 | **Printful `order_delivered` event not in event map** | Printful does NOT send a delivered webhook -- addressed by the polling cron, but if the cron fails or the order is less than 3 days old, delivery is never detected | `pod/printful/constants.ts:26-39` + `api/cron/check-delivery-status/route.ts:27` |
| H4 | **No dead letter queue for failed webhook processing** | If a webhook handler throws after returning 200, the event is lost forever (provider won't retry) | `api/webhooks/pod/[provider]/route.ts:140-141` |
| H5 | **In-memory rate limiter not shared across serverless instances** | On serverless platforms (Vercel), each cold-start gets its own rate bucket; actual API call rate may exceed 120/min across instances | `pod/printful/client.ts:82-93` |

### MEDIUM

| # | Gap | Impact | Location |
|---|---|---|---|
| M1 | **10-minute catalog cache is per-instance** | Serverless cold starts mean the cache is rarely warm; each instance makes redundant catalog calls | `pod/printful/client.ts:148-150` |
| M2 | **1000-product ceiling on sync cron** | If catalog exceeds 1000 products (10 pages x 100), remaining products are never synced | `api/cron/sync-printify/route.ts:92` |
| M3 | **Unknown webhook event types silently fall back to `product.updated`** | Unexpected events trigger a full product re-sync, which may be wasteful or incorrect | `pod/printful/mapper.ts:286` |
| M4 | **Divergence detector fetches every product individually** | O(n) API calls to Printful; at 500 products this takes ~15 minutes at 120 req/min | `reliability/divergence-detector.ts:92-93` |
| M5 | **No webhook replay/idempotency key storage** | No way to detect and skip duplicate webhook deliveries (Printful may retry on timeouts) | `api/webhooks/pod/[provider]/route.ts` |
| M6 | **`order.updated` handler is identical to `order.created` (log-only)** | Order status changes (e.g., `order_put_hold`) are logged but not reflected in the database | `pod/webhooks/index.ts:24` |
| M7 | **Legacy Printify compat layer uses `any` extensively** | Type safety is lost; runtime errors possible if method shapes diverge | `pod/printify/compat.ts` |

### LOW

| # | Gap | Impact | Location |
|---|---|---|---|
| L1 | **`canonicalAddressFromStripe` imported from Printify mapper** | Cross-provider import dependency in checkout-completed.ts | `webhooks/stripe/checkout-completed.ts:12` |
| L2 | **Cron endpoint still named `sync-printify`** | Naming inconsistency after Printful migration | `api/cron/sync-printify/route.ts` |
| L3 | **`getVariantPricing()` returns empty array** | Printful pricing comes from catalog lookup; the interface method is a no-op | `pod/printful/index.ts:80-83` |

### Recommendations

1. **C1**: Connect `DynamicPriceStock` to real variant availability data from the `product_variants` table, or remove the component entirely since availability is already handled at the variant selector level.

2. **C2**: Add actual Printful re-submission logic to the retry cron. On retry, re-fetch product/variant mappings, re-build the order payload, and call `provider.createOrder()`. Only auto-refund after re-submission has been attempted and failed.

3. **C3**: Use Printful's catalog pricing endpoint (`/products/{id}`) to populate `costCents` during sync. The current mapper sets `costCents: null` because the sync product endpoint does not include cost data.

4. **H1**: Add an "Out of Stock" or "Limited Availability" badge to `ProductCard` when any/all variants have `is_available = false`.

5. **H2**: Differentiate `package_returned` from `order_canceled`. A returned package may warrant re-shipping or a different status (`return_received`), not automatic cancellation + refund.

6. **H4**: Implement a dead letter queue (Redis list or Supabase table) that stores webhook payloads when handler processing fails. A separate cron can retry failed events.

7. **H5**: Move rate limiting to Redis (already in the stack) for shared state across serverless instances.

---

## 11. Scorecard

| Area | Score | Notes |
|---|---|---|
| **API Client** | 8/10 | Well-structured with rate limiting, caching, retry, error hierarchy |
| **Product Sync** | 7/10 | Comprehensive with conflict resolution, category inference, margin enforcement. Missing cost data from Printful |
| **Inventory/Stock** | 5/10 | Variant availability tracked but DynamicPriceStock is hardcoded; no product-level stock indicator |
| **Order Submission** | 7/10 | Full flow from Stripe to Printful with error handling and admin notifications. Missing actual retry logic |
| **Webhook Handling** | 8/10 | Comprehensive handler set with audit logging, email, in-app notifications, refund guard. Missing dead letter queue and delivery event |
| **Reliability** | 8/10 | State transition enforcement, atomic refunds, advisory locks, divergence detection. Strong foundation |
| **Test Coverage** | 7/10 | Good mapper/router tests. Missing integration tests for sync cron and webhook handlers |
| **Overall** | **7/10** | Mature provider-agnostic architecture with solid reliability patterns. Main gaps are operational (cost data, retry logic, stock display) |

---

**Files Audited**: 38 source files across `frontend/src/lib/pod/`, `frontend/src/lib/reliability/`, `frontend/src/lib/webhooks/`, `frontend/src/app/api/cron/`, `frontend/src/app/api/webhooks/`, and `frontend/src/components/products/`
