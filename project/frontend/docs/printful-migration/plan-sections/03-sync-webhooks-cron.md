# Section 3 — Sync Engine, Webhooks & Cron Migration

> **Scope**: Provider-agnostic migration of `printify-sync.ts`, the Printify webhook handler, and the two cron jobs (`sync-printify`, `retry-printify-orders`).
>
> **Author**: Migration Plan — Section 3
> **Date**: 2026-03-02
> **Source files audited**:
> - `frontend/src/lib/printify-sync.ts` (550 lines)
> - `frontend/src/app/api/webhooks/printify/route.ts` (667 lines)
> - `frontend/src/app/api/cron/sync-printify/route.ts` (246 lines)
> - `frontend/src/app/api/cron/retry-printify-orders/route.ts` (197 lines)
> - `frontend/docs/printful-migration/printful-webhooks-api.md`
> - `frontend/docs/printful-migration/printful-products-api.md`
> - `frontend/docs/printful-migration/architecture-recommendations.md`

---

## Table of Contents

1. [A — Sync Engine Migration](#a--sync-engine-migration)
2. [B — Webhook Handler Migration](#b--webhook-handler-migration)
3. [C — Cron Jobs Migration](#c--cron-jobs-migration)
4. [D — Implementation Order](#d--implementation-order)

---

## A — Sync Engine Migration

### Current State: `printify-sync.ts` Function-by-Function Analysis

The sync library (`frontend/src/lib/printify-sync.ts`) is 550 lines and exports four public symbols:

| Symbol | Type | Lines |
|--------|------|-------|
| `inferCategorySlug(title)` | Pure function | 38–115 |
| `calculateEngagementPrice(costCents, title)` | Pure function | 129–164 |
| `syncProductFromPrintify(product, supabase)` | Async, Printify-coupled | 197–336 |
| `deleteProductCascade(printifyId, supabase)` | Async, Printify-coupled | 487–549 |

---

#### `inferCategorySlug(title: string): string`

**Current behaviour**: Keyword-matching against product title. Returns a slug like `t-shirts`, `pullover-hoodies`, `mugs`, etc. Falls back to `accessories`. Entirely pure — no API calls, no Printify data shapes.

**Changes needed for Printful**: None. The function operates on a product title string. The source of that title (Printify product vs Printful sync_product `name` field) does not matter. Move verbatim to `src/lib/pod/sync/category-inferrer.ts` and expose it through the sync engine.

**One caveat**: Printful sync product names are controlled by you (you set them when creating the `sync_product`), so they will always match the same patterns. No regression risk.

---

#### `calculateEngagementPrice(costCents: number, title: string): number`

**Current behaviour**: Tiered multiplier table (stickers: 2.5x, hoodies: 1.7x, etc.) applied to EUR cents. Hard floor at 1.4x, hard ceiling at 3.0x. Rounds up to nearest .99. Returns minimum category price if computed value falls below floor.

**Changes needed for Printful**: The logic itself is provider-agnostic — it takes a cost in EUR cents and a title and returns a price. The only provider-specific part is **how cost is obtained**.

- **Printify**: Cost comes from `variant.cost` in USD cents (requiring `USD_TO_EUR = 0.92` conversion).
- **Printful**: Cost comes from the Printful Catalog API (`GET /products/variant/{id}`) in the store's set currency. If the Printful store is configured in EUR, `costCents` arrives as EUR directly and the conversion step is skipped. If Printful returns costs in USD (for non-EUR stores), the same conversion applies.

**Action**: Move the function verbatim to `src/lib/pod/sync/margin-auditor.ts`. Isolate the currency conversion to the Printful mapper layer (`src/lib/pod/printful/mapper.ts`), so `calculateEngagementPrice` always receives EUR cents regardless of provider. The 35% margin threshold is a business rule — keep it unchanged.

---

#### `syncProductFromPrintify()` → Renamed `syncProductFromProvider()`

This is the most deeply coupled function. It performs eight distinct operations:

1. Extract `title`, `description` (with HTML stripping), `visible` flag
2. Extract minimum cost from enabled variants (USD → EUR)
3. Extract minimum enabled price from variants
4. Apply `calculateEngagementPrice` if no price set
5. Deduplicate and normalize images into `{src, alt, variant_ids, is_default}` shape
6. Detect admin edits (`admin_edited_at > last_synced_at`) and preserve them
7. Infer category for new products only
8. Upsert the product row + call `syncVariants()`

**Data mapping changes for Printful**:

| Field | Printify source | Printful source | Change |
|-------|-----------------|-----------------|--------|
| `title` | `product.title` | `sync_product.name` | Rename input field |
| `description` | `product.description` (HTML, strip) | Not in Printful sync product — manage in Supabase only | Description no longer synced from provider |
| `visible` / `status` | `product.visible === true` | `!sync_product.is_ignored` | Different field, same semantics |
| `cost` (USD cents) | `variant.cost` | Not in `GET /sync_products` list response — need `GET /sync_products/{id}/variants/{id}` or catalog pricing API | Significant: cost no longer in list response |
| `price` (USD/EUR cents) | `variant.price` | `sync_variant.retail_price` (string, e.g. `"29.99"`) | Parse string → integer cents |
| `images` | `product.images[].src` + `variant_ids` | `sync_product.thumbnail_url` (single URL) + per-variant `files[].preview_url` | See image handling section below |
| `blueprint_id` | `product.blueprint_id` | `sync_variant.product.product_id` (catalog product ID) | Different concept — store as `blueprint_id` |
| `print_provider_id` | `product.print_provider_id` | Not applicable (Printful is the provider) | Store as constant `null` or `"printful"` |
| `safety_information` | `product.safety_information` | Not in sync product API — manage in Supabase `product_details` only | Field removed from provider sync |

**Admin edit preservation**: The `shouldPreserveAdminEdits` logic (`admin_edited_at > last_synced_at`) is entirely independent of the provider. Move it verbatim to `ConflictResolver` in `src/lib/pod/sync/conflict-resolver.ts`.

**Upsert conflict key**: Currently `ON CONFLICT (printify_id)`. After migration, the Supabase column must also accommodate Printful IDs. The architecture recommendation is a `provider_product_id` column (agnostic) plus a `provider` column. During migration, existing rows already have `printify_id` values — the DB migration section (Section 5) covers the schema change. For this section, the sync engine writes to `provider_product_id` when the provider is Printful.

---

#### `syncVariants()` — Variant Parsing Differences

This is the most structurally different part of the migration.

**Current Printify behaviour**: Printify encodes all variant dimensions in a single `variant.title` string. The parser in `syncVariants()` handles four formats:

```
"Black / S"                  → color="Black",          size="S"        (standard)
"S/M / White"                → color="White",          size="S/M"      (caps)
"Black / White / One size"   → color="Black / White",  size="One size" (bicolor hats)
"Natural"                    → color="Natural",         size=null       (one-size)
```

The parser uses a `SIZE_RE` regex and a `SHOE_SIZE_RE` to distinguish color from size when the order is ambiguous, plus a US→EU shoe size conversion table.

**Printful behaviour**: Printful uses **structured data**, not a combined string. The `sync_variant` object has:

```json
{
  "id": 789012,
  "name": "SKAPARA Ghost Tee Black / M",
  "variant_id": 4011,
  "product": {
    "variant_id": 4011,
    "product_id": 71,
    "name": "Bella + Canvas 3001 Unisex Jersey Short Sleeve Tee (Black / M)"
  }
}
```

Printful does **not** expose `color` and `size` as separate fields on the sync_variant. However, the underlying **catalog variant** (`GET /products/{product_id}/variants/{variant_id}`) does:

```json
{
  "id": 4011,
  "name": "Bella + Canvas 3001 (Black / S)",
  "size": "S",
  "color": "Black",
  "color_code": "#14110F"
}
```

**Recommended approach for `syncVariants()` with Printful**:

Option A (simple, sufficient for display): Apply the same `SIZE_RE`-based parser to `sync_variant.name`. The Printful variant name follows the same `"Product Name (Color / Size)"` convention — strip the product name prefix, then parse the remainder with the existing regex. This requires zero DB schema changes and can reuse 90% of the existing parser.

Option B (structured, future-proof): When creating Printful sync products, store `external_id` on each `sync_variant` as `{color}|{size}` (e.g., `"Black|S"`). The sync engine reads `external_id` directly and splits on `|`. This requires controlling the product creation pipeline (Section 2 of the migration plan).

**Recommendation**: Use Option A for the first migration pass. This decouples the sync migration from the product creation migration. Promote to Option B in a follow-up.

**US→EU shoe size conversion**: Keep the conversion table intact. Printful catalog variant names for EU-fulfilled sneakers may use US sizes depending on the catalog product. Verify with a single Printful API call against the target blueprint during migration.

**Variant image mapping**: Printify maps images to variants via `image.variant_ids[]` — each mockup image declares which variant IDs it represents. Printful exposes per-variant file previews at `sync_variant.files[].preview_url`. The `variantImageMap` logic changes as follows:

```typescript
// Printify (current)
// variant_id → mockup URL comes from product.images[].variant_ids

// Printful (new)
// variant_id → preview URL comes from sync_variant.files[0].preview_url
// (The first file of type "front" is the primary mockup)
```

The `product_variants.image_url` population logic in `syncVariants()` lines 349–361 must be rewritten to read from the Printful variant's `files` array instead of the parent product's `images` array.

---

#### `deleteProductCascade(printifyId, supabase)`

**Current behaviour**: Looks up by `printify_id`, unlinks designs, deletes child rows (`product_variants`, `marketing_content`, `wishlist_items`, `cart_items`), soft-deletes the product, writes to `audit_log`.

**Changes needed**: The function is called with a provider product ID string. After the DB schema migration introduces `provider_product_id`, rename the parameter and query column. The cascade logic (unlink designs, delete children, soft delete, audit log) is entirely Supabase-side and provider-agnostic — no other changes needed.

Rename target: `deleteProductCascade(providerProductId, supabase, deletedBy?)`.

---

### New `ProductSyncEngine` Class Design

The architecture recommendation (`architecture-recommendations.md` §6) defines a `ProductSyncEngine` class at `src/lib/pod/sync/sync-engine.ts`. This class replaces the four exported functions in `printify-sync.ts` with a composable, testable, provider-agnostic object.

**Key design decisions extracted from the audit**:

1. **Dependency injection for the provider**: `new ProductSyncEngine(provider, supabase, options)` — the provider is passed in, not imported. This allows unit tests to inject `MockPODProvider` without mocking HTTP.

2. **`fullSync()` method**: Direct replacement for the reconciliation logic in `sync-printify/route.ts` (steps 1–5 of that cron). The cron route becomes a thin wrapper: acquire lock → `new ProductSyncEngine(getProvider(), supabase).fullSync()` → record run → return report.

3. **`syncSingle(externalId)` method**: Called from webhook handlers instead of calling `syncProductFromPrintify` directly. The webhook handler resolves the provider from the event, then calls `engine.syncSingle(resourceId)`.

4. **`deleteProduct(externalId)` method**: Wraps `deleteProductCascade` with the same provider-agnostic interface.

5. **`ConflictResolver` sub-class**: Encapsulates the `shouldPreserveAdminEdits` logic currently at lines 278–279 of `printify-sync.ts`. Default strategy: `'newest-wins'` (matching current behaviour).

6. **`MarginAuditor` sub-class**: Encapsulates the step-5 margin audit loop from `sync-printify/route.ts` (lines 195–223). Threshold: 35% (kept from current implementation). This is independent of provider — it operates only on Supabase data after sync.

---

### Variant Parsing Differences Summary

| Aspect | Printify | Printful |
|--------|----------|----------|
| Variant title format | `"Color / Size"` combined string | `sync_variant.name` includes product name + `"Color / Size"` suffix |
| Dedicated color field | No — parse from title | Available on catalog variant (`GET /products/{id}/variants/{vid}`) but not on sync variant |
| Dedicated size field | No — parse from title | Same as color |
| Image-to-variant mapping | `product.images[].variant_ids[]` | `sync_variant.files[].preview_url` (per-variant) |
| Variant cost | `variant.cost` (USD cents) in list response | Not in sync product list — requires separate catalog API call |
| Variant enable/disable | `variant.is_enabled` boolean | `sync_variant.is_enabled` boolean (same semantics) |
| Variant availability | `variant.is_available` boolean | `sync_variant.synced` boolean (different semantics: synced = configured) |

---

### Price Mapping: Printify USD→EUR vs Printful Multi-Currency

**Current Printify flow**:
- Variant costs arrive in USD cents (`variant.cost`)
- Constant `USD_TO_EUR = 0.92` converts to EUR at sync time
- Variant prices arrive in whatever currency the product was created in (typically USD cents, `variant.price`)
- `base_price_cents` in Supabase is stored in EUR cents

**Printful flow**:
- `retail_price` on `sync_variant` is a decimal string (`"29.99"`) in the store's configured currency
- If the Printful store is set to EUR: `parseFloat("29.99") * 100 = 2999` cents directly — no conversion
- Variant costs are not in the sync product response — they must be retrieved from `GET /products/variant/{id}` which returns `price` in USD. The same `USD_TO_EUR` conversion applies
- **Recommendation**: Configure the Printful store in EUR. This eliminates the price conversion step and makes prices deterministic

**Conversion isolation**: The `USD_TO_EUR` constant must live in the Printful mapper (`src/lib/pod/printful/mapper.ts`), not in the sync engine. The sync engine receives EUR cents from the mapper and writes them to Supabase.

---

### Image/Mockup URL Handling Differences

| Aspect | Printify | Printful |
|--------|----------|----------|
| Mockup generation | Automatic on product creation (stored in `product.images`) | Requires explicit `POST /mockup-tasks` (async, returns task ID) |
| Mockup availability | Immediately in list/get product response | Task-based: poll `GET /mockup-tasks/{taskId}` until `status: "completed"` |
| Per-variant images | `product.images[].variant_ids` links mockup to variant IDs | `sync_variant.files[].preview_url` (per-variant, post-generation) |
| Thumbnail | `product.images[0].src` (first mockup) | `sync_product.thumbnail_url` (set on creation) |
| Size chart filtering | Current code filters `src.includes('size-chart')` | No equivalent — Printful doesn't embed size charts in product images |

**Impact on sync**: The current `images` array in Supabase (`products.images JSONB[]`) stores `{src, alt, variant_ids, is_default}` objects. With Printful, the `variant_ids` array must be populated from the `sync_variant.id` → `files[0].preview_url` mapping rather than from the product-level images array. The mockup task workflow (for new product creation) is covered in Section 2 of the migration plan. For sync purposes, `preview_url` fields on already-generated variants are sufficient.

---

### Margin Audit Logic — Keep 35% Threshold

The 35% margin floor is a business rule set in `PRICING_RULES.md` and enforced in `sync-printify/route.ts` (lines 209–223). It is provider-agnostic: it reads `cost_cents` and `base_price_cents` from Supabase and applies `calculateEngagementPrice` if margin < 0.35.

**Keep the threshold unchanged.** The `MarginAuditor` class in the new sync engine replicates this logic exactly. No Printful-specific adjustment is needed.

One note: Printful production costs for the same product types (Bella+Canvas tees, Gildan hoodies) are comparable to P26 (Textildruck Europa) for EU fulfillment. The existing price floors (e.g., €14.99 minimum for tees, €29.99 for hoodies) remain valid and must not be changed during this migration.

---

## B — Webhook Handler Migration

### Event Mapping Table: Complete

The current webhook handler at `frontend/src/app/api/webhooks/printify/route.ts` handles 8 distinct event types. The table below maps all of them to Printful equivalents and canonical internal events:

| Printify Event | Printful Event | Canonical Internal Event | Handler Action |
|----------------|----------------|--------------------------|----------------|
| `order:created` | `order_created` | `order.created` | Verify order exists in DB; log confirmation |
| `order:shipped` | `package_shipped` | `order.shipped` | Update `orders.status='shipped'`, set tracking fields, create notification, send email |
| `order:delivered` | *(no equivalent)* | `order.delivered` | Update `orders.status='delivered'`, create notification, send email |
| `order:cancelled` | `order_canceled` | `order.cancelled` | Issue Stripe refund if paid, transition status, create notification, send email |
| `order:failed` | `order_failed` | `order.failed` | Issue Stripe refund if paid, transition status, create notification, send email |
| `product:publish:started` | *(no equivalent — no publish step)* | `product.publish_started` | Call `publishingSucceeded()` if product exists in DB |
| `product:publish:succeeded` / `product:created` / `product:updated` | `product_synced` / `product_updated` | `product.updated` | Fetch full product, call `syncProductFromProvider()` |
| `product:deleted` | `product_deleted` | `product.deleted` | Call `deleteProductCascade()` |
| *(no equivalent)* | `stock_updated` | `stock.updated` | Update `product_variants.is_available` for affected variant IDs |
| *(no equivalent)* | `package_returned` | `order.cancelled` | Treat as cancellation — update order status, notify, potentially issue refund |
| *(no equivalent)* | `order_updated` | `order.updated` | Log state change; no customer email needed |
| *(no equivalent)* | `order_put_hold` / `order_remove_hold` | *(ignore or log)* | No action required — informational |
| *(no equivalent)* | `order_refunded` | `order.refunded` | Update `orders.status='refunded'` if not already set |

**Critical gap — `order:delivered`**: Printful has **no `order_delivered` event**. The current handler relies on this event to send the delivery email and update `delivered_at`. Resolution options:

- Option A: Remove delivery webhook handling. Accept that delivery status will only update via cron polling of `GET /orders/{id}` until `status === "fulfilled"`.
- Option B: Add a dedicated "delivery check" cron that runs daily and fetches order status for all orders in `shipped` status older than 3 days, updating to `delivered` if Printful reports `fulfilled`.

**Recommendation**: Implement Option B as a new `check-delivery-status` cron. The delivery email is customer-facing and its loss would be a regression. See Section C for the new cron design.

**Critical gap — `product:publish:started`**: This event is Printify-specific. It triggers the `publishingSucceeded()` callback that links a Printify product to its Supabase UUID. With Printful, products do not have a separate publish step — a sync product is immediately available after creation. The `product:publish:started` handler and the `publishingSucceeded()` method on the Printify client have **no Printful equivalent and should be removed**. The `product_synced` webhook fires when a sync product is fully configured, which is the equivalent trigger for the initial sync.

---

### Signature Verification: Printify HMAC-SHA256 vs Printful

**Printify (current)**:
```typescript
// Header: X-Printify-Hmac-SHA256 (base64-encoded HMAC-SHA256 of body)
const hmac = createHmac('sha256', secret)
hmac.update(body)
const expected = hmac.digest('base64')
timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
```

**Printful (new)**:
Printful does **not** send a cryptographic signature header by default (confirmed in `printful-webhooks-api.md`). Instead, Printful's documented security pattern is a **secret token embedded in the webhook URL**:

```
POST /api/webhooks/pod/printful?secret=PRINTFUL_WEBHOOK_SECRET
```

**Implementation**:
```typescript
// In the unified webhook handler:
function verifyPrintfulWebhook(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get('secret')
  return secret === process.env.PRINTFUL_WEBHOOK_SECRET
}
```

This is less secure than HMAC but is Printful's own recommended approach. The mitigation is:
1. Use a long (32+ char) random secret stored in `PRINTFUL_WEBHOOK_SECRET`
2. HTTPS-only (already enforced by Caddy)
3. Return 200 immediately on all valid requests (prevents retry amplification even if the secret leaks)

**Important**: The unified webhook route (`/api/webhooks/pod/[provider]/route.ts`) must dispatch to the correct verifier based on `providerId`:
- `printify` → HMAC header verification (keep existing logic)
- `printful` → URL query secret verification

---

### New Unified Webhook Route: `/api/webhooks/pod/[provider]/route.ts`

The current route is at `/api/webhooks/printify/route.ts`. The new route uses a dynamic `[provider]` segment.

**File**: `frontend/src/app/api/webhooks/pod/[provider]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getProvider } from '@/lib/pod'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerId } = await params
  const body = await req.text()

  // Resolve provider adapter
  let provider
  try {
    provider = getProvider(providerId)
  } catch {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  // Verify signature (provider-specific)
  const signature = req.headers.get('x-printify-hmac-sha256')
    || req.headers.get('x-webhook-signature')
    || req.nextUrl.searchParams.get('secret')
    || ''

  if (!provider.verifyWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Parse, normalize, route
  let rawEvent: unknown
  try {
    rawEvent = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = provider.normalizeEvent(rawEvent)

  try {
    await webhookRouter.route(event)
  } catch (error) {
    console.error(`[webhook/${providerId}] Error processing ${event.type}:`, error)
    // Return 200 to prevent provider retries — error is logged
  }

  return NextResponse.json({ received: true })
}
```

**The old `/api/webhooks/printify/route.ts` must be kept active during the transition period** (dual-run phase) until all Printify products are migrated. After full cutover, decommission it by returning 200 immediately (no processing) to silence any late-arriving Printify events.

---

### Handler Functions for Each Normalized Event

All handler functions move from the monolithic `route.ts` into the `src/lib/pod/webhooks/handlers/` directory. The external email calls, refund logic, and audit logging remain unchanged — only the trigger mechanism changes.

| Handler File | Normalized Event | Behaviour vs Current |
|---|---|---|
| `order-created.ts` | `order.created` | Identical to current `handleOrderCreated()` |
| `order-shipped.ts` | `order.shipped` | Identical to current `handleOrderShipped()`. Printful `package_shipped` payload has `data.shipment.carrier`, `data.shipment.tracking_number`, `data.shipment.tracking_url` and `data.order.external_id`. The mapper normalizes this into the same shape the handler currently expects |
| `order-delivered.ts` | `order.delivered` | Currently driven by `order:delivered` webhook. With Printful, driven by the new delivery-check cron (see Section C). The handler function itself is unchanged |
| `order-cancelled.ts` | `order.cancelled` | Triggered by `order_canceled` AND `package_returned` (both map to `order.cancelled`). Logic identical: refund if paid, transition state, notify, email |
| `order-failed.ts` | `order.failed` | Identical: refund if paid, transition state, notify, email |
| `product-synced.ts` | `product.updated` | Triggered by `product_synced` and `product_updated`. Calls `engine.syncSingle(resourceId)`. The `sync_product.id` is the resource identifier in Printful events |
| `product-deleted.ts` | `product.deleted` | Calls `engine.deleteProduct(resourceId)`. Identical cascade logic |
| `stock-updated.ts` | `stock.updated` | **New handler**. Updates `product_variants.is_available` for variant IDs in `data.variants`. This maps to the `is_available` field currently populated by the sync. With Printful, stock events arrive in near-real-time |

**Email notification behaviour — preserved exactly**:

| Trigger | Email sent? | Condition |
|---------|------------|-----------|
| `order.shipped` | Yes (`sendOrderShippedEmail`) | `user.notification_preferences.email !== false` |
| `order.delivered` | Yes (`sendOrderDeliveredEmail`) | Same preference check |
| `order.cancelled` | Yes (`sendOrderCancelledEmail`) | Only if refund was issued AND preference check |
| `order.failed` | Yes (`sendOrderFailedEmail`) | `customer_email` exists AND preference check |

The `order.created` and `order.updated` events do **not** send emails — preserving current behaviour.

---

## C — Cron Jobs Migration

### `sync-printify` Cron → Provider-Agnostic Cron

**Current file**: `frontend/src/app/api/cron/sync-printify/route.ts` (246 lines)
**New file**: `frontend/src/app/api/cron/sync-products/route.ts`

The current cron performs five numbered steps. The mapping to the new implementation:

| Current step | Logic lives in | New location |
|---|---|---|
| 1. Paginated Printify fetch | `printify.listProducts(page, 50)` | `ProductSyncEngine.fetchAllProviderProducts()` via `provider.listProducts({offset, limit: 50})` |
| 2. Fetch all Supabase products | Inline in route | `ProductSyncEngine.fetchAllDbProducts()` — queries `provider_product_id` instead of `printify_id` |
| 3. Create/update products | `syncProductFromPrintify()` per product | `engine.syncSingle()` via `createProduct()` or `updateProduct()` |
| 4. Mark orphans deleted | Inline status update | `engine.markDeleted()` — soft delete |
| 5. Margin audit | Inline loop | `MarginAuditor.auditAll(supabase)` |

**The route handler becomes a thin wrapper**:

```typescript
// frontend/src/app/api/cron/sync-products/route.ts
export async function GET(req: NextRequest) {
  // Auth check (unchanged)
  if (!verifyCronSecret(req.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Distributed lock (unchanged)
  const lock = await acquireLock('sync-products')
  if (!lock.acquired) {
    return NextResponse.json({ skipped: true, reason: 'Already running' })
  }

  const engine = new ProductSyncEngine(
    getProvider(), // Returns Printful adapter after migration
    supabaseAdmin,
    { marginThreshold: 0.35 }
  )

  const report = await engine.fullSync()

  await recordRun(
    'sync-products',
    report.errors.length > 0 ? 'failed' : 'completed',
    report.durationMs,
    report.errors.length > 0 ? report.errors.join('; ') : undefined,
    report.created + report.updated + report.deleted + report.marginFixed
  )

  return NextResponse.json(report)
}
```

**`vercel.json` cron schedule**: Change `"/api/cron/sync-printify"` to `"/api/cron/sync-products"`. Keep the same 30-minute interval.

**Printful-specific pagination note**: Printful list endpoint uses offset-based pagination (`offset` + `limit`, max 100 per page), not page-number-based like Printify. The `fetchAllProviderProducts()` method must use `offset += limit` instead of `page++`. The safety cap (current: 10 pages × 50 = 1000 products) translates to offset cap at 1000.

**`publishing` status handling**: The current cron has special handling for products stuck in `publishing` status — it calls `printify.publishingSucceeded()` to unstick them (lines 151–162 in `sync-printify/route.ts`). This logic is **Printify-specific and must be removed**. Printful has no `publishing` status. Any Supabase rows with `status='publishing'` that remain after migration must be transitioned to `active` or `draft` as part of the data migration (Section 5).

---

### `retry-printify-orders` → Changes Needed for Printful Order Flow

**Current file**: `frontend/src/app/api/cron/retry-printify-orders/route.ts` (197 lines)

The cron handles two scenarios:
1. **Stuck `paid` orders** (no `printify_order_id`): retries order submission, auto-refunds after 3 failures or 2h timeout
2. **`requires_review` orders** older than 24h: auto-refunds

**Printful equivalence analysis**:

Both scenarios are triggered by the order failing to reach the POD provider after payment. This is an infrastructure reliability concern, not a provider concern. The logic does **not call Printify APIs directly** — it uses `issueRefund()` (Stripe) and `transition()` (Supabase state machine). The only Printify coupling is:

- The column name `printify_order_id` — must be renamed to `provider_order_id`
- The `null` check on `printify_order_id` that identifies stuck orders — becomes `null` check on `provider_order_id`

**Rename strategy**: The DB column `orders.printify_order_id` becomes `orders.provider_order_id` in the schema migration (Section 5). This cron only needs the column rename — all retry and refund logic is identical.

**Printful order submission flow**: With Printful, `createOrder()` + `submitForProduction()` replace Printify's `createOrder()` + `submitOrderForProduction()`. The order creation happens in the Stripe webhook handler (Section 4 of the migration plan). If that creation fails, the order ends up in `paid` status without `provider_order_id` — exactly the condition this cron monitors. No logic change needed.

**File rename**: `retry-printify-orders/route.ts` → `retry-orders/route.ts`. Update `vercel.json` accordingly.

---

### `cleanup-temp-products` — Still Needed with Printful?

**Current purpose**: Deletes temporary Printify products created during checkout for personalized items. These are needed because Printify requires a product to exist before an order can reference it.

**Printful flow**: Printful uses `sync_variant_id` in order line items. For personalized products, you still need to create a sync product + sync variant with the custom design before submitting the order. The "temp product" concept persists under Printful.

**Conclusion**: Keep `cleanup-temp-products` cron. The logic changes only in the cleanup call: `printify.deleteProduct(tempProductId)` → `provider.deleteProduct(tempProductId)`. The Supabase query that finds temp products (by a `is_temp` flag or `created_for_order_id` column, depending on current implementation) is unchanged.

---

### New Cron Needed: `check-delivery-status`

As noted in Section B, Printful has no `order_delivered` event. A new cron is required to detect delivered orders.

**Proposed file**: `frontend/src/app/api/cron/check-delivery-status/route.ts`

**Logic**:
1. Fetch all orders with `status='shipped'` and `shipped_at < (now - 3 days)`
2. For each order, call `provider.getOrder(provider_order_id)`
3. If Printful returns `status === "fulfilled"`, call `handleOrderDelivered(order)` (the same handler function used by the current webhook)
4. Skip orders where Printful returns non-`fulfilled` status

**Schedule**: Daily (once per day is sufficient — delivery detection is not time-critical).

**Vercel cron entry**:
```json
{ "path": "/api/cron/check-delivery-status", "schedule": "0 8 * * *" }
```

---

### New Cron Needed: `sync-stock` (Optional, Recommended)

The `stock_updated` webhook covers real-time stock changes. However, if the webhook is missed or delayed, stock data in Supabase can drift. A lightweight daily stock sync that queries Printful for variant availability on the active product set would improve reliability.

This is a **phase-2 item** — implement after the core migration is stable. It is not a blocker for launch.

---

## D — Implementation Order

### Prerequisites (Before Any Work in This Section)

- [ ] DB migration adding `provider_product_id` and `provider` columns to `products` table
- [ ] DB migration renaming `printify_order_id` to `provider_order_id` in `orders` table
- [ ] `src/lib/pod/` directory structure scaffolded (types, models, errors)
- [ ] Printful adapter client (`src/lib/pod/printful/client.ts`) with `get/post/put/delete` wrappers

These are covered in Section 5 (DB Migration) and Section 2 (Provider Abstraction Layer) of the overall plan.

---

### Step 1 — Extract Pure Functions (Isolated, 0 risk)

**Effort**: 1–2 hours
**Files affected**: New `src/lib/pod/sync/` directory

1. Copy `inferCategorySlug()` verbatim to `src/lib/pod/sync/category-inferrer.ts`. Export as `CategoryInferrer` class wrapping the function.
2. Copy `calculateEngagementPrice()` verbatim to `src/lib/pod/sync/margin-auditor.ts`. Export as `MarginAuditor` class.
3. Copy the variant title parser (lines 370–440 of `printify-sync.ts`) to `src/lib/pod/sync/variant-parser.ts`. Export as `parseVariantTitle(title: string): { color: string | null, size: string | null }`.
4. Copy `ConflictResolver` from architecture doc to `src/lib/pod/sync/conflict-resolver.ts`.
5. Write unit tests for all four (especially `parseVariantTitle` — the regex is complex). Run against existing production variant titles to verify no regressions.

**Testable in isolation**: Yes. These are pure functions with no external dependencies.

**Rollback**: N/A — nothing is modified, only new files added.

---

### Step 2 — Build Printful Mapper (Isolated, 0 risk)

**Effort**: 3–4 hours
**Files**: `src/lib/pod/printful/mapper.ts`

1. Implement `toCanonicalProduct(raw: PrintfulSyncProduct): CanonicalProduct`
2. Implement `toCanonicalVariant(raw: PrintfulSyncVariant): CanonicalVariant` — handle `retail_price` string→cents conversion, `is_ignored` → `isEnabled`, `files[0].preview_url` → `imageUrl`
3. Implement `toNormalizedEvent(raw: PrintfulRawWebhookEvent): NormalizedWebhookEvent` — use the `PRINTFUL_EVENT_MAP` table from Section B
4. Implement `fromCanonicalOrder(input: CreateOrderInput): PrintfulOrderPayload`

**Testable in isolation**: Yes. Write unit tests using Printful API response fixtures (sample from `printful-products-api.md` and `printful-webhooks-api.md`).

**Rollback**: N/A — new file only.

---

### Step 3 — Build `ProductSyncEngine` Class (Isolated, 0 risk)

**Effort**: 4–6 hours
**Files**: `src/lib/pod/sync/sync-engine.ts`

1. Implement constructor with `provider: PODProductProvider`, `supabase: SupabaseClient`, `options`
2. Implement `fullSync()` — replaces the body of `sync-printify/route.ts`. Depends on Step 1 (CategoryInferrer, MarginAuditor, ConflictResolver)
3. Implement `syncSingle(externalId)` — calls `provider.getProduct()` then upsert
4. Implement `deleteProduct(externalId)` — wraps `deleteProductCascade` logic

**Testable in isolation**: Yes — inject `MockPODProvider` (from architecture doc §7.1). Write tests for all reconciliation scenarios: create missing, update stale, skip unchanged, delete orphan, fix margin.

**Rollback**: N/A — new file only.

---

### Step 4 — Build Webhook Normalizer + Unified Route (Low risk)

**Effort**: 3–4 hours
**Files**:
- `src/lib/pod/webhooks/webhook-router.ts`
- `src/app/api/webhooks/pod/[provider]/route.ts`
- `src/lib/pod/webhooks/handlers/*.ts` (5 handler files)

1. Implement `WebhookRouter` class (from architecture doc §5.3)
2. Implement each handler file (extract functions from current `webhooks/printify/route.ts` verbatim)
3. Register handlers in `webhook-router.ts`: `router.on('order.shipped', handleOrderShipped)`, etc.
4. Create the unified route at `/api/webhooks/pod/[provider]/route.ts`
5. Add `stock-updated.ts` handler for the new Printful stock event

**The old `/api/webhooks/printify/route.ts` is NOT touched in this step.**

**Testable in isolation**: Yes — the `WebhookRouter` accepts normalized events; inject mock events without any HTTP. The unified route can be tested with `supertest` against Printful fixture payloads.

**Rollback**: Remove the new directory. Old route is unaffected.

---

### Step 5 — Wire New Sync Cron (Moderate risk — touches production scheduling)

**Effort**: 2 hours
**Files**:
- `frontend/src/app/api/cron/sync-products/route.ts` (new)
- `vercel.json` (update schedule)

1. Create `sync-products/route.ts` as the thin wrapper (see Section C)
2. Point it at the Printful provider
3. **Dual-run period**: Keep `sync-printify/route.ts` running on its existing schedule. Add `sync-products/route.ts` on a different schedule (e.g., offset by 15 minutes) so both run without overlap
4. Monitor `sync-products` output for 1 week. Compare `report.updated`/`report.created` counts against `sync-printify` output
5. After validation, disable `sync-printify` in `vercel.json`

**Testable in isolation**: Trigger `GET /api/cron/sync-products` with the cron secret against staging. Verify Supabase product rows reflect Printful data.

**Rollback**: Remove `sync-products` from `vercel.json`. `sync-printify` continues running.

---

### Step 6 — Activate Printful Webhooks + Unified Route (Moderate risk)

**Effort**: 1–2 hours (plus Printful dashboard config)

1. Deploy the unified webhook route
2. Register webhook in Printful dashboard:
   ```
   POST https://api.printful.com/webhooks
   {
     "url": "https://skapara.com/api/webhooks/pod/printful?secret=PRINTFUL_WEBHOOK_SECRET",
     "types": ["package_shipped", "order_created", "order_updated", "order_failed",
               "order_canceled", "product_synced", "product_updated", "product_deleted",
               "stock_updated", "package_returned"]
   }
   ```
3. Keep the Printify webhook active during dual-run

**Testable in isolation**: Use Printful's test event feature (or manually trigger a product update from the Printful dashboard) to verify the webhook is received and processed correctly.

**Rollback**: Delete Printful webhook registration. Unified route can remain deployed but inactive.

---

### Step 7 — Update Retry Cron + Add Delivery Check Cron (Low risk)

**Effort**: 2 hours
**Files**:
- Rename `retry-printify-orders/route.ts` → `retry-orders/route.ts`
- New `check-delivery-status/route.ts`

1. In `retry-orders/route.ts`: change `printify_order_id` to `provider_order_id` in all Supabase queries
2. Create `check-delivery-status/route.ts` per the design in Section C
3. Update `vercel.json`: replace `retry-printify-orders` with `retry-orders`, add `check-delivery-status`

**Rollback**: Restore old `retry-printify-orders/route.ts`, remove new files from `vercel.json`.

---

### Step 8 — Decommission Printify Sync Path (Final step, after full cutover)

**Effort**: 1 hour
**Files**: Printify-specific files become read-only or archived

1. Remove `sync-printify/route.ts` from `vercel.json`
2. Stub `webhooks/printify/route.ts` to return `{received: true}` with no processing
3. Keep `src/lib/printify-sync.ts` in the repo for 30 days as a reference, then archive

**Condition for this step**: Zero Printify products remaining in Supabase with `provider='printify'` AND no active Printify orders in `in_production` or `shipped` status.

---

### Effort Summary

| Step | Description | Effort | Risk |
|------|-------------|--------|------|
| 1 | Extract pure functions | 1–2h | None |
| 2 | Printful mapper | 3–4h | None |
| 3 | ProductSyncEngine class | 4–6h | None |
| 4 | Webhook normalizer + unified route | 3–4h | Low |
| 5 | New sync cron (dual-run) | 2h | Moderate |
| 6 | Printful webhooks activation | 1–2h | Moderate |
| 7 | Retry + delivery check crons | 2h | Low |
| 8 | Decommission Printify path | 1h | Low (last step) |
| **Total** | | **17–23h** | |

---

### Rollback Strategy

The rollback strategy for each step is explicit in the step description above. The general principle is:

1. **Steps 1–4** (new files only): Rollback = delete new files. Zero impact on production.
2. **Step 5** (dual-run cron): Rollback = remove `sync-products` from `vercel.json`. `sync-printify` continues.
3. **Step 6** (Printful webhooks): Rollback = delete Printful webhook registration via `DELETE /webhooks`. Printify webhooks remain.
4. **Step 7** (cron updates): Rollback = revert `vercel.json` to original cron paths.
5. **Step 8** (decommission): This step is only performed after full cutover validation. It is the point of no return. A 30-day archive window is built in.

**Circuit breaker**: If `sync-products` reports significantly more `errors` than `sync-printify` during the dual-run phase (Step 5), halt Step 6 and diagnose the mapper before activating live webhooks.
