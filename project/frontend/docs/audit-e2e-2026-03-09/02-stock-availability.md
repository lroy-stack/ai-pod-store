# Stock & Availability Synchronization Audit

**Date**: 2026-03-09
**Scope**: End-to-end stock/availability data flow from Printful to the SKAPARA frontend
**Status**: RESEARCH ONLY -- no code changes made

---

## Executive Summary

The SKAPARA store has a **well-architected stock synchronization system** with two complementary pathways: real-time webhooks (`stock.updated` event) and periodic cron reconciliation (every 30 min). However, **neither pathway is currently operational in production**:

1. **Webhooks are not registered** with Printful (zero `stock_updated` audit log entries, zero webhook events of any kind)
2. **Cron sync last ran on 2026-03-01** (8 days ago) and is not scheduled
3. **Zero variants are marked `is_available=false`** in the database despite Printful reporting out-of-stock items
4. **146 variants are disabled (`is_enabled=false`)** but this reflects Printful's variant configuration (e.g., colors not offered), NOT stock outages

The frontend correctly filters by both `is_enabled=true` AND `is_available=true`, and checkout validates variant availability before payment. The plumbing is solid -- it just needs to be connected.

---

## A. Database Schema

### `product_variants` Table

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `product_id` | uuid | NO | -- | FK to `products` |
| `printify_variant_id` | varchar(255) | YES | -- | Legacy Printify ID (deprecated) |
| `external_variant_id` | text | YES | -- | Provider-agnostic variant ID (Printful sync_variant.id) |
| `title` | varchar(255) | NO | -- | Full variant name (e.g., "Bella + Canvas 3001 (Black / M)") |
| `size` | varchar(50) | YES | -- | Parsed size (S, M, L, XL, etc.) |
| `color` | varchar(50) | YES | -- | Parsed color (Black, White, etc.) |
| `price_cents` | integer | NO | -- | Retail price in EUR cents |
| `cost_cents` | integer | YES | -- | Production cost in EUR cents |
| `sku` | varchar(100) | YES | -- | SKU string |
| `is_enabled` | boolean | NO | `true` | Whether the variant is offered for sale (from provider config) |
| `is_available` | boolean | NO | `true` | Whether the variant is currently in stock (from provider stock data) |
| `image_url` | text | YES | -- | Per-variant mockup image URL |
| `blank_image_url` | text | YES | -- | Blank product image URL |
| `color_hex` | varchar | YES | -- | Hex color code for swatch |

**Source**: `supabase/migrations/20260213000000_initial_schema.sql:71-82` (base), plus later migrations adding `cost_cents`, `image_url`, `external_variant_id`, `blank_image_url`, `color_hex`.

### `products` Table (Stock-Related Columns Only)

| Column | Type | Purpose |
|---|---|---|
| `status` | varchar(20) | `'draft' / 'active' / 'archived'` -- NO dedicated stock column |
| `deleted_at` | timestamptz | Soft delete timestamp |

**Key finding**: There is NO product-level stock/inventory column. Stock is tracked exclusively at the variant level via `is_enabled` and `is_available`. The product's `inStock` status is derived at API query time from whether any variant has `is_enabled=true AND is_available=true`.

---

## B. Data Flow Architecture

```
                    PRINTFUL
                       |
           +-----------+-----------+
           |                       |
     [stock_updated]         [sync product list]
      webhook event          GET /store/products
           |                       |
           v                       v
  POST /api/webhooks/      GET /api/cron/sync-printify
   pod/printful               (30 min cron)
           |                       |
           v                       v
  handleStockUpdated()     Availability reconciliation
  (stock-updated.ts)        (sync-printify/route.ts:199-262)
           |                       |
           +-------+-------+-------+
                   |
                   v
          Supabase: product_variants
          UPDATE is_available = true/false
                   |
                   v
          Frontend API queries
          (.eq('is_enabled', true)
           .eq('is_available', true))
                   |
           +-------+-------+
           |               |
     Product List      Product Detail
     /api/products     /api/products/[id]
    (inStock derived)  (unavailableCombinations)
```

### Path 1: Webhook (Real-Time)

**File**: `src/lib/pod/webhooks/handlers/stock-updated.ts`

- **Trigger**: Printful sends `stock_updated` event to `POST /api/webhooks/pod/printful?secret=<PRINTFUL_WEBHOOK_SECRET>`
- **Event mapping**: `PRINTFUL_EVENT_MAP['stock_updated'] = 'stock.updated'` (file: `src/lib/pod/printful/constants.ts:38`)
- **Router registration**: `router.on('stock.updated', handleStockUpdated)` (file: `src/lib/pod/webhooks/index.ts:37`)
- **Handler logic** (file: `src/lib/pod/webhooks/handlers/stock-updated.ts:56-119`):
  1. Extracts stock changes from event data (supports `data.variants[]`, `data.sync_variant`, `data.product.variants[]`)
  2. Determines availability: explicit `in_stock` flag, or infers from `quantity > 0`
  3. Updates `product_variants.is_available` by matching `external_variant_id`
  4. Writes audit log entry with `action: 'stock_updated'`

**Current status**: **NOT OPERATIONAL**
- Zero `stock_updated` events in `audit_log` table
- Zero webhook events of any kind in `audit_log`
- `PRINTFUL_WEBHOOK_SECRET` is listed as `[OPTIONAL]` in `.env.example` (should be REQUIRED)
- Webhook registration script exists (`scripts/register-printful-webhooks.mjs`) but has never been run against production

### Path 2: Cron Reconciliation (Periodic)

**File**: `src/app/api/cron/sync-printify/route.ts`

- **Endpoint**: `GET /api/cron/sync-printify` (protected by `CRON_SECRET`)
- **Step 5** (lines 199-262): Availability reconciliation
  1. Builds provider truth map: `external_variant_id -> isAvailable` from all Printful products
  2. Fetches current DB variant availability
  3. Compares and batch-updates divergent variants
  4. Reports: `report.availabilityFixed = toUpdate.length`

**Current status**: **NOT SCHEDULED**
- Last run: **2026-03-01 15:14:23 UTC** (8 days ago)
- 5 runs total in `cron_runs` table, all `status: 'completed'`
- No Vercel cron configured (comment in code says "runs every 30 minutes via Vercel cron" but no vercel.json cron config found)

### How Availability Maps from Printful to CanonicalVariant

**File**: `src/lib/pod/printful/mapper.ts:60`

```typescript
isAvailable: (v as Record<string, unknown>).synced === true,
```

**CRITICAL FINDING**: Printful's `synced` field on a sync variant indicates whether the variant is properly linked to a catalog variant, NOT whether it is in stock. Printful does NOT include real-time stock data in the `GET /store/products` response. The `stock_updated` webhook is the only way to get real-time stock signals from Printful.

This means:
- The cron reconciliation (Path 2) will set `isAvailable` based on `synced`, which is almost always `true` for properly configured products
- Only the webhook path (Path 1) can set `is_available=false` based on actual stock outages
- Since webhooks are not registered, **stock outages are never reflected in the database**

---

## C. Frontend Display

### Product List API (`/api/products/route.ts`)

**File**: `src/app/api/products/route.ts:72-115`

The `fetchVariantsByProductId()` function fetches variants with:
```typescript
.eq('is_enabled', true)
.eq('is_available', true)
```

The `inStock` field returned to the frontend is:
```typescript
inStock: variantsMap.has(p.id)  // true if any variant is enabled+available
```

**Result**: If all variants for a product have `is_available=false`, the product shows `inStock: false`. Currently, since no variants have `is_available=false`, ALL products show as in stock.

### Product Detail API (`/api/products/[id]/route.ts`)

**File**: `src/app/api/products/[id]/route.ts:39-62`

Makes two parallel variant queries:
1. **Available variants** (`is_enabled=true AND is_available=true`) -- used for sizes/colors/prices
2. **All enabled variants** (`is_enabled=true`) -- used to build `unavailableCombinations`

```typescript
// Line 166-172:
const unavailableCombinations = allEnabled
  .filter(v => !v.is_available)
  .map(v => ({ color: v.color || '', size: v.size || '' }))
```

This correctly surfaces per-combination unavailability (e.g., "Black / L is out of stock but Black / M is available").

The response includes:
```typescript
inStock: variants.length > 0,  // true if any available variant exists
variants: {
  sizes,                        // only from available variants
  colors,                       // only from available variants
  allColors,                    // all enabled (includes unavailable)
  allSizes,                     // all enabled (includes unavailable)
  unavailableCombinations,      // [{color, size}] for enabled but unavailable
}
```

### ProductCard Component (`src/components/products/ProductCard.tsx`)

**File**: `src/components/products/ProductCard.tsx:137-141, 257-259`

- Out-of-stock overlay: Shows `Badge("outOfStock")` when `product.inStock === false` (line 137-141)
- Add-to-cart button: `disabled={product.inStock === false}` (line 258)

### ProductDetailClient Component (`src/components/products/ProductDetailClient.tsx`)

**File**: `src/components/products/ProductDetailClient.tsx:270-284, 764-776`

- Uses `unavailableCombinations` to cross-filter: selecting a color grays out unavailable sizes and vice versa
- `isCurrentCombinationAvailable` checks the selected color+size against `unavailableCombinations` (lines 271-284)
- Add-to-cart and Buy Now buttons are disabled when `!isCurrentCombinationAvailable` (lines 767, 782)
- Shows "Out of Stock" badge when `!product.inStock` (lines 650-658)
- Size buttons show `opacity-40 line-through` when unavailable (line 625)
- Color buttons show `opacity-40 cursor-not-allowed` when unavailable (line 583)

---

## D. Cart & Checkout Validation

### Cart API (`/api/cart/route.ts`)

**File**: `src/app/api/cart/route.ts`

**Adding to cart** (POST, lines 291-339):
- Resolves variant by `product_id + size + color` with `.eq('is_enabled', true).eq('is_available', true)`
- If no matching available variant: returns `400 VARIANT_UNAVAILABLE` or `400 NO_VARIANTS`
- If single available variant: auto-selects it
- If multiple available variants but no selection: returns `400 VARIANT_REQUIRED`

**Displaying cart** (GET, lines 168-174):
- Fetches available variants per product (`.eq('is_enabled', true).eq('is_available', true)`)
- Marks cart items as `unavailable: true` if product status !== 'active' (but does NOT check variant availability on GET)

**Updating variant** (PATCH, lines 550-573):
- Resolves new variant with `.eq('is_enabled', true).eq('is_available', true)`
- Returns `400 VARIANT_UNAVAILABLE` if not found

### Checkout Session (`/api/checkout/create-session/route.ts`)

**File**: `src/app/api/checkout/create-session/route.ts:91-132`

**Explicit stock validation before payment**:
1. Fetches all variants for cart product IDs (`.eq('is_enabled', true)`)
2. For each cart item, finds matching variant by color+size
3. If variant not found OR `!matchingVariant.is_available`: adds to `unavailableItems`
4. If any unavailable: returns `409 ITEMS_UNAVAILABLE` with list of affected items

This is a **critical safety gate** -- even if cart items become stale, checkout blocks payment for out-of-stock variants.

### CartView Component (`src/components/cart/CartView.tsx`)

**File**: `src/components/cart/CartView.tsx:68, 384-388`

- Filters cart total to only `availableItems` (line 68)
- Shows `Badge("unavailable")` on items marked `unavailable: true` (line 384-388)

**GAP**: The cart GET endpoint marks items unavailable only based on product status, not variant availability. A user could see an item in cart as "available" even if the specific variant is now out of stock. The checkout gate catches this, but the UX is confusing.

---

## E. Current Database State

### Variant Availability Breakdown (Active Products Only)

| Metric | Count |
|---|---|
| **Total variants** | 913 |
| **Enabled + Available** (purchasable) | 767 |
| **Disabled + Available** | 146 |
| **Enabled + Unavailable** | 0 |
| **Both off** | 0 |
| **Active products** | 27 |
| **Variants with `external_variant_id`** | 895 (98%) |
| **Variants without `external_variant_id`** | 18 |

### Key Observation

**Zero variants have `is_available=false`**. All 913 variants on active products have `is_available=true`. This means either:
1. Every Printful variant is genuinely in stock (unlikely given the user reports)
2. Stock data has never been synced from Printful (confirmed -- no webhook events, cron not running)

### Products with Disabled Variants

16 products have some variants with `is_enabled=false`. These are color variants not offered by the seller (e.g., Ivory on t-shirts, Vintage White on hoodies), NOT stock outages. The `is_enabled` flag comes from the Printful sync product configuration, while `is_available` should come from real-time stock data.

| Product | Total | Purchasable | Disabled |
|---|---|---|---|
| Plans Cancelled | 35 | 21 | 14 |
| Self-Care Mode | 35 | 21 | 14 |
| Existential Dread | 35 | 21 | 14 |
| Soup Fork | 35 | 21 | 14 |
| Social Battery | 35 | 21 | 14 |
| Under Where | 63 | 56 | 7 |
| Option Two | 63 | 56 | 7 |
| Shadow Tee | 63 | 56 | 7 |
| Strawberry Count | 56 | 49 | 7 |
| Just For You | 64 | 57 | 7 |
| Prism Tee | 56 | 49 | 7 |
| Dangerous Flag | 63 | 56 | 7 |
| Scope Creep | 56 | 49 | 7 |
| Next Line | 56 | 49 | 7 |
| Three Models | 63 | 56 | 7 |
| Nihilist Penguin | 36 | 30 | 6 |

### Last Sync Timestamps

Products were last synced between 2026-02-28 and 2026-03-03 (6-9 days ago). The cron job last ran on 2026-03-01.

---

## F. Printful API Stock Capabilities

### Printful API Client (`src/lib/pod/printful/client.ts`)

The Printful client has NO dedicated stock/availability endpoint. The available endpoints are:

| Method | Endpoint | Stock Data? |
|---|---|---|
| `listSyncProducts()` | `GET /store/products` | Variants have `synced` flag (NOT stock) |
| `getSyncProduct(id)` | `GET /store/products/{id}` | Same |
| Catalog endpoints | `GET /products`, `GET /products/{id}` | General availability, not real-time stock |

### How Printful Reports Stock

Printful reports stock changes via the `stock_updated` webhook event. Per Printful API docs:
- Sent when stock levels change for products in the store
- Contains variant-level stock data (`in_stock`, `quantity`)
- This is the ONLY way to get real-time stock information from Printful

The `GET /store/products` endpoint returns variants with a `synced` field, but this only indicates whether the variant is properly configured -- NOT whether it has physical stock.

### Webhook Registration Script

**File**: `scripts/register-printful-webhooks.mjs`

A ready-to-use script exists to register webhooks with Printful. It registers:
- `stock_updated` (most critical)
- `product_updated`
- `order_created`
- `order_updated`
- `package_shipped`

**Requirements**:
- `PRINTFUL_API_TOKEN` -- set
- `PRINTFUL_STORE_ID` -- set
- `PRINTFUL_WEBHOOK_SECRET` -- needs to be configured
- `DOMAIN` -- needs to be set to production domain

---

## G. Gap Analysis

### CRITICAL Gaps

| # | Gap | Impact | Root Cause |
|---|---|---|---|
| **G1** | Printful webhooks not registered | Stock changes from Printful are never received | `register-printful-webhooks.mjs` never executed; `PRINTFUL_WEBHOOK_SECRET` + `DOMAIN` not configured |
| **G2** | Cron sync not scheduled | Periodic reconciliation not running | No Vercel cron or external scheduler configured; last run 8 days ago |
| **G3** | Zero `is_available=false` variants in DB | Frontend shows everything as in stock even when Printful is out of stock | Consequence of G1+G2 |
| **G4** | Mapper uses `synced` for `isAvailable` | Cron reconciliation sets `isAvailable` based on config state, not stock | `src/lib/pod/printful/mapper.ts:60` -- `synced` !== in-stock |

### MEDIUM Gaps

| # | Gap | Impact | Location |
|---|---|---|---|
| **G5** | Cart GET does not check variant availability | Cart shows items as available when their variant may be out of stock | `src/app/api/cart/route.ts:112` -- only checks `product.status !== 'active'` |
| **G6** | No real-time stock check on Add-to-Cart | User can add item to cart; stock check only at add time, not during cart display | Cart item could become stale between add and checkout |
| **G7** | No stock-related WebSocket/SSE push | Frontend has no mechanism to update stock UI in real time | No event push infrastructure for stock changes |
| **G8** | `PRINTFUL_WEBHOOK_SECRET` tagged `[OPTIONAL]` in `.env.example` | Operators may skip configuration | `.env.example:115` |

### LOW Gaps

| # | Gap | Impact | Location |
|---|---|---|---|
| **G9** | 18 variants missing `external_variant_id` | Webhook handler cannot update these variants by external ID | DB: 18 of 913 variants |
| **G10** | No `last_stock_checked_at` timestamp | Cannot tell when stock was last verified for a specific variant | `product_variants` table |
| **G11** | No stock quantity tracking | Only boolean `is_available`, no numeric inventory count | Schema design decision (acceptable for print-on-demand) |

---

## H. What Works Well

1. **Dual-path architecture**: Both webhook and cron reconciliation paths are fully implemented and tested
2. **Checkout validation**: `create-session/route.ts` performs explicit variant availability check before payment (lines 91-132)
3. **Frontend UX**: `ProductDetailClient` correctly uses `unavailableCombinations` for cross-filtering sizes/colors
4. **ProductCard**: Shows out-of-stock overlay and disables add-to-cart button
5. **Cart API (POST)**: Validates variant availability when adding to cart
6. **Cart API (PATCH)**: Validates variant availability when changing variant selection
7. **Webhook handler**: `handleStockUpdated()` is well-structured with audit logging
8. **Cron availability reconciliation**: Batch-updates divergent variants efficiently
9. **Dead letter queue**: Failed webhook processing is persisted for later investigation

---

## I. Recommendations

### Priority 1: Connect the Existing Infrastructure (Immediate)

1. **Configure `PRINTFUL_WEBHOOK_SECRET`** in production `.env`:
   - Generate a 32+ character random secret
   - Add to `.env.local` and production environment

2. **Set `DOMAIN`** in `.env.local` (e.g., `skapara.com`)

3. **Run `node scripts/register-printful-webhooks.mjs`** to register webhooks with Printful

4. **Schedule the cron job**:
   - Option A: Add to `vercel.json` crons (if using Vercel)
   - Option B: Set up external cron (e.g., cron-job.org) hitting `GET /api/cron/sync-printify` with `Authorization: Bearer <CRON_SECRET>`
   - Recommended interval: every 30 minutes

5. **Mark `PRINTFUL_WEBHOOK_SECRET` as `[REQUIRED]`** in `.env.example`

### Priority 2: Fix the Mapper (Short-Term)

6. **Fix `isAvailable` mapping in Printful mapper** (`src/lib/pod/printful/mapper.ts:60`):
   - Current: `isAvailable: (v as Record<string, unknown>).synced === true`
   - The `synced` field does not represent stock availability
   - For cron sync, the availability reconciliation step (sync-printify route.ts:199-262) should be the source of truth, not the initial mapping
   - Consider defaulting to `isAvailable: true` in the mapper since the cron reconciliation and webhooks handle the real updates

### Priority 3: Improve Cart UX (Medium-Term)

7. **Add variant availability check to cart GET** (`/api/cart` GET handler):
   - Join variant data and check `is_available` per cart item
   - Set `unavailable: true` when variant is out of stock (not just product status)

8. **Add stock re-validation on cart page load**:
   - When `CartView` mounts, call a lightweight endpoint to validate all cart item variants
   - Show warning badges for items that became unavailable

### Priority 4: Real-Time Stock Push (Long-Term)

9. **Implement Server-Sent Events (SSE)** or WebSocket for stock updates:
   - When `handleStockUpdated` processes a webhook, push event to connected clients
   - Frontend subscribes on product detail page and cart page
   - Update UI immediately without page refresh

10. **Add `last_stock_checked_at` column** to `product_variants`:
    - Updated by both webhook handler and cron
    - Enables monitoring: "these variants haven't been checked in X hours"

---

## J. File Reference Index

| File | Purpose | Key Lines |
|---|---|---|
| `supabase/migrations/20260213000000_initial_schema.sql` | Schema: `product_variants.is_enabled`, `is_available` | 71-82 |
| `src/lib/pod/printful/mapper.ts` | Maps Printful `synced` to `isAvailable` | 60 |
| `src/lib/pod/printful/constants.ts` | Maps `stock_updated` to `stock.updated` | 38 |
| `src/lib/pod/webhooks/handlers/stock-updated.ts` | Webhook handler for stock changes | 56-119 |
| `src/lib/pod/webhooks/index.ts` | Routes `stock.updated` to handler | 37 |
| `src/app/api/webhooks/pod/[provider]/route.ts` | Unified webhook endpoint | 35-158 |
| `src/app/api/cron/sync-printify/route.ts` | Cron: availability reconciliation | 199-262 |
| `src/lib/pod/sync/sync-product.ts` | Variant upsert (sets `is_available`) | 209-245 |
| `src/app/api/products/route.ts` | Product list: filters by `is_enabled+is_available` | 75-81, 239, 478, 564, 680 |
| `src/app/api/products/[id]/route.ts` | Product detail: `unavailableCombinations` | 39-62, 166-172, 199 |
| `src/components/products/ProductCard.tsx` | Out-of-stock overlay + disabled cart button | 137-141, 258 |
| `src/components/products/ProductDetailClient.tsx` | Cross-filter sizes/colors by availability | 140-159, 270-284, 767, 782 |
| `src/app/api/cart/route.ts` | Cart: validates variant availability on add/update | 291-339, 550-573 |
| `src/app/api/checkout/create-session/route.ts` | Checkout: stock gate before payment | 91-132 |
| `src/hooks/useCart.tsx` | Frontend cart hook | 17 (`unavailable` field) |
| `src/components/cart/CartView.tsx` | Cart display: unavailable badge | 68, 384-388 |
| `scripts/register-printful-webhooks.mjs` | Printful webhook registration script | 1-113 |
| `src/lib/pod/printful/client.ts` | Printful API client (no stock endpoint) | 1-315 |
| `src/lib/pod/printful/webhook-verifier.ts` | Query-string secret verification | 15-31 |
| `src/lib/pod/index.ts` | Provider initialization (reads `PRINTFUL_WEBHOOK_SECRET`) | 38 |
