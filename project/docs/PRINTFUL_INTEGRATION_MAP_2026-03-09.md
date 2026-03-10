# Printful Integration Map — POD AI Store (SKAPARA)

> Generated: 2026-03-09
> Scope: Complete map of every Printful/Printify endpoint, tool, webhook, data transformation and gap.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Frontend Printful Provider — Endpoints Map](#2-frontend-printful-provider)
3. [Frontend Printify Provider (Legacy) — Endpoints Map](#3-frontend-printify-provider-legacy)
4. [PodClaw Printify Connector — Tools Map](#4-podclaw-printify-connector-tools)
5. [Webhooks & Events](#5-webhooks-events)
6. [Cron Jobs](#6-cron-jobs)
7. [Data Transformation — Printful to Supabase](#7-data-transformation)
8. [MCP Server](#8-mcp-server)
9. [Environment Variables](#9-environment-variables)
10. [Gap Analysis: Printify Connector vs Printful](#10-gap-analysis)

---

## 1. Architecture Overview

The project uses a **provider-agnostic POD abstraction layer** with Interface Segregation:

```
PODProvider (composite)
├── PODCatalogProvider    — getBlueprints, getBlueprintVariants, getVariantPricing
├── PODProductProvider    — createProduct, getProduct, listProducts, updateProduct, deleteProduct, publish*, confirm*
├── PODDesignProvider     — uploadDesign, generateMockup, getMockupStatus
├── PODOrderProvider      — createOrder, submitForProduction, cancelOrder, getOrder, getShippingRates
└── PODWebhookProvider    — verifyWebhook, normalizeEvent, getRegisteredEvents
```

**Key files:**

| Component | Path |
|---|---|
| PODProvider interface | `frontend/src/lib/pod/types.ts` |
| Provider registry | `frontend/src/lib/pod/provider-registry.ts` |
| Entry point + initialization | `frontend/src/lib/pod/index.ts` |
| Printful provider | `frontend/src/lib/pod/printful/index.ts` |
| Printful client (HTTP) | `frontend/src/lib/pod/printful/client.ts` |
| Printful mapper | `frontend/src/lib/pod/printful/mapper.ts` |
| Printful constants | `frontend/src/lib/pod/printful/constants.ts` |
| Printful webhook verifier | `frontend/src/lib/pod/printful/webhook-verifier.ts` |
| Printify provider (legacy) | `frontend/src/lib/pod/printify/index.ts` |
| Printify client (legacy) | `frontend/src/lib/pod/printify/client.ts` |
| Printify compat shim | `frontend/src/lib/pod/printify/compat.ts` |
| Printify mapper | `frontend/src/lib/pod/printify/mapper.ts` |
| Canonical models | `frontend/src/lib/pod/models/*.ts` |
| Sync engine | `frontend/src/lib/pod/sync/sync-product.ts` |
| Webhook router | `frontend/src/lib/pod/webhooks/webhook-router.ts` |
| Webhook handlers | `frontend/src/lib/pod/webhooks/handlers/*.ts` |
| Submit order | `frontend/src/lib/pod/submit-order-to-pod.ts` |
| PodClaw connector | `podclaw/connectors/printify_connector.py` |

**Current default provider:** `printful` (set via `POD_PROVIDER` env var, defaults to `'printful'`)

---

## 2. Frontend Printful Provider

### 2.1 Authentication

- **Base URL:** `https://api.printful.com`
- **Auth header:** `Authorization: Bearer ${PRINTFUL_API_TOKEN}`
- **Store header:** `X-PF-Store-Id: ${PRINTFUL_STORE_ID}` (optional, for store-scoped operations)
- **User-Agent:** `SKAPARA-POD/1.0` (required — Cloudflare blocks without it)
- **Token expiry warning:** Logs warning if `PRINTFUL_TOKEN_EXPIRES_AT` < 7 days

### 2.2 Response Envelope

ALL Printful responses are wrapped: `{ code, result, paging? }`. The client unwraps `.result` automatically.

### 2.3 Rate Limiting

- Token bucket: 120 req/min
- Respects `Retry-After` header on 429
- 5xx retries with exponential backoff (2 retries)
- Catalog GET endpoints cached with 10-min TTL

### 2.4 Endpoints Map

| Method | Printful Endpoint | Client Method | Provider Method | Description |
|---|---|---|---|---|
| GET | `/stores` | `getStore()` | `healthCheck()` | Get store info (health check) |
| POST | `/store/products` | `createSyncProduct(body)` | `createProduct(input)` | Create sync product |
| GET | `/store/products/{id}` | `getSyncProduct(id)` | `getProduct(id)` | Get single sync product |
| GET | `/store/products?offset=&limit=` | `listSyncProducts(offset, limit)` | `listProducts(pagination)` | List all sync products (paginated) |
| DELETE | `/store/products/{id}` | `deleteSyncProduct(id)` | `deleteProduct(id)` | Delete sync product |
| POST | `/files` | `createFile(body)` | `uploadDesign(input)` | Upload design file (URL-based) |
| GET | `/files/{id}` | `getFile(id)` | — | Get file info |
| POST | `/orders` or `/orders?confirm=true` | `createOrder(body, confirm)` | `createOrder(input)` | Create order (confirm=true skips draft) |
| GET | `/orders/{id}` | `getOrder(id)` | `getOrder(id)` | Get order details |
| POST | `/orders/{id}/confirm` | `confirmOrder(id)` | `submitForProduction(id)` | Confirm/submit order |
| DELETE | `/orders/{id}` | `cancelOrder(id)` | `cancelOrder(id)` | Cancel order |
| POST | `/shipping/rates` | `getShippingRates(body)` | `getShippingRates(input)` | Calculate shipping rates |
| GET | `/products` | `getCatalogProducts()` | `getBlueprints()` | List catalog products |
| GET | `/products/{id}` | `getCatalogProduct(id)` | `getBlueprintVariants(id)` | Get catalog product variants |
| POST | `/mockup-generator/create-task/{productId}` | `createMockupTask(productId, body)` | `generateMockup(input)` | Create async mockup task |
| GET | `/mockup-generator/task?task_key=` | `getMockupTask(taskKey)` | `getMockupStatus(taskId)` | Poll mockup task status |

### 2.5 Key Differences from Printify

| Aspect | Printify | Printful |
|---|---|---|
| Publishing | Explicit publish + confirm cycle | Auto-publishes (no-ops) |
| Order creation | Creates as draft, then send_to_production | `?confirm=true` creates + confirms in one call |
| Order cancel | POST `.../cancel.json` | DELETE `/orders/{id}` |
| Design upload | Base64 + URL supported | URL-only (`DesignUploadInput.url` required) |
| Mockups | Sync (auto-generated on product creation) | Async task (create → poll) |
| Webhook auth | HMAC-SHA256 header | Query parameter `?secret=` |
| Response format | Direct JSON | Wrapped `{code, result, paging?}` |
| Variant cost | Included in variant object | Requires separate catalog lookup |
| Update product | PUT to update endpoint | No partial update — must replace |
| Pricing currency | USD (converted to EUR) | EUR (store currency) |

---

## 3. Frontend Printify Provider (Legacy)

### 3.1 Endpoints Map

| Method | Printify Endpoint | Client Method | Description |
|---|---|---|---|
| GET | `/shops/{shopId}.json` | `getShop()` | Get shop info |
| POST | `/shops/{shopId}/products.json` | `createProduct(data)` | Create product |
| GET | `/shops/{shopId}/products/{id}.json` | `getProduct(id)` | Get product |
| GET | `/shops/{shopId}/products.json?page=&limit=` | `listProducts(page, limit)` | List products |
| DELETE | `/shops/{shopId}/products/{id}.json` | `deleteProduct(id)` | Delete product |
| POST | `/shops/{shopId}/products/{id}/publish.json` | `publishProduct(id)` | Publish product |
| POST | `.../publishing_succeeded.json` | `publishingSucceeded(id, extId, handle)` | Confirm publishing |
| POST | `.../publishing_failed.json` | `publishingFailed(id, reason)` | Report publish failure |
| POST | `/uploads/images.json` (URL) | `uploadImage(url, fileName)` | Upload image via URL |
| POST | `/uploads/images.json` (base64) | `uploadImageFromBase64(b64, fileName)` | Upload image via base64 |
| POST | `/shops/{shopId}/orders.json` | `createOrder(data)` | Create order |
| GET | `/shops/{shopId}/orders/{id}.json` | `getOrder(id)` | Get order |
| POST | `.../orders/{id}/send_to_production.json` | `submitOrderForProduction(id)` | Submit to production |
| POST | `.../orders/{id}/cancel.json` | `cancelOrder(id)` | Cancel order |
| GET | `/catalog/blueprints.json` | `getBlueprints()` | List all blueprints |
| GET | `/catalog/blueprints/{id}/print_providers.json` | `getProviders(bpId)` | Get providers for blueprint |
| GET | `.../print_providers/{pvId}/variants.json` | `getVariants(bpId, pvId)` | Get variants for bp+pv |
| POST | `/shops/{shopId}/orders/shipping.json` | `calculateShipping(items, addr)` | Calculate shipping |

### 3.2 Backward Compatibility Shim

`frontend/src/lib/pod/printify/compat.ts` exports a `printify` Proxy object that maps old Printify method names to the new PODProvider methods. This allows legacy code to work without changes.

---

## 4. PodClaw Printify Connector — Tools Map

The `PrintifyMCPConnector` class in `podclaw/connectors/printify_connector.py` exposes **22 tools** used by PodClaw agents:

### 4.1 Products (7 tools)

| Tool Name | Printify Endpoint | Description |
|---|---|---|
| `printify_list_products` | `GET /shops/{id}/products.json?page=&limit=` | List shop products (paginated) |
| `printify_create` | `POST /shops/{id}/products.json` | Create product (with dedup check, GPSR, normalized print_areas) |
| `printify_update` | `PUT /shops/{id}/products/{pid}.json` | Update product (title, description, variants) |
| `printify_get_product` | `GET /shops/{id}/products/{pid}.json` | Get full product details (includes cost per variant) |
| `printify_delete_product` | `DELETE /shops/{id}/products/{pid}.json` | Delete product from shop |
| `printify_get_mockup` | `GET /shops/{id}/products/{pid}.json` | Get mockup images (extracts images from product) |
| `printify_get_gpsr` | `GET /shops/{id}/products/{pid}/gpsr.json` | Get EU GPSR safety info |

### 4.2 Publishing (4 tools)

| Tool Name | Printify Endpoint | Description |
|---|---|---|
| `printify_publish` | `POST .../publish.json` | Publish product to sales channel |
| `printify_unpublish` | `POST .../unpublish.json` | Unpublish product |
| `printify_publishing_succeeded` | `POST .../publishing_succeeded.json` | Confirm publishing (custom integration) |
| `printify_publishing_failed` | `POST .../publishing_failed.json` | Report publishing failure |

### 4.3 Catalog (4 tools)

| Tool Name | Printify Endpoint | Description |
|---|---|---|
| `printify_get_blueprints` | `GET /catalog/blueprints.json` | List all blueprints |
| `printify_search_blueprints` | (in-memory filter of blueprints) | Search by name/category |
| `printify_get_providers` | `GET /catalog/blueprints/{bid}/print_providers.json` | Get providers for blueprint |
| `printify_get_variants` | `GET .../print_providers/{pvId}/variants.json` | Get variants for bp+pv |
| `printify_get_blueprint_detail` | `GET /catalog/blueprints/{bid}.json` | Get blueprint detail (description, brand, model) |

### 4.4 Orders (4 tools)

| Tool Name | Printify Endpoint | Description |
|---|---|---|
| `printify_get_orders` | `GET /shops/{id}/orders.json?page=&limit=&status=` | List orders (filtered) |
| `printify_get_order_costs` | `GET /shops/{id}/orders/{oid}.json` | Get order cost breakdown |
| `printify_create_order` | `POST /shops/{id}/orders.json` | Create order (sample/test) |
| `printify_send_to_production` | `POST .../orders/{oid}/send_to_production.json` | Submit to production |
| `printify_cancel_order` | `POST .../orders/{oid}/cancel.json` | Cancel order |

### 4.5 Uploads (2 tools)

| Tool Name | Printify Endpoint | Description |
|---|---|---|
| `printify_upload_image` | `POST /uploads/images.json` | Upload image via URL (SSRF-protected) |
| `printify_list_uploads` | `GET /uploads.json?page=&limit=` | List uploaded images |

### 4.6 Webhooks (3 tools)

| Tool Name | Printify Endpoint | Description |
|---|---|---|
| `printify_list_webhooks` | `GET /shops/{id}/webhooks.json` | List active webhooks |
| `printify_create_webhook` | `POST /shops/{id}/webhooks.json` | Create webhook (topic + URL validated) |
| `printify_delete_webhook` | `DELETE /shops/{id}/webhooks/{wid}.json` | Delete webhook |

### 4.7 Shops (2 tools)

| Tool Name | Printify Endpoint | Description |
|---|---|---|
| `printify_list_shops` | `GET /shops.json` | List all connected shops |
| `printify_get_shop` | `GET /shops/{id}.json` | Get shop details (locked to configured shop) |

### 4.8 Shipping (1 tool)

| Tool Name | Printify Endpoint | Description |
|---|---|---|
| `printify_get_shipping_profiles` | `GET /shops/{id}/shipping.json` | Get shipping profiles |

### 4.9 Security Features in PodClaw Connector

- **SSRF protection:** IP resolution + block private/reserved ranges
- **Image host allowlist:** fal.ai, ideogram.ai, recraft.ai, supabase
- **Webhook URL validation:** Only allowed domains (configurable)
- **ID validation:** Regex `^[a-zA-Z0-9\-_]+$`
- **Page limit clamping:** Max 50
- **Circuit breaker:** Opens after 5 consecutive failures, 60s timeout
- **Retry with backoff:** 2s, 4s, 8s for 429/5xx
- **Duplicate detection:** Levenshtein distance < 3 or trigram similarity > 0.8

---

## 5. Webhooks & Events

### 5.1 Printful Webhook Events

Printful uses a **query-string secret** for authentication (`?secret={PRINTFUL_WEBHOOK_SECRET}`), NOT HMAC.

| Printful Raw Event | Canonical Event | Handler |
|---|---|---|
| `package_shipped` | `order.shipped` | `handleOrderShipped` |
| `package_returned` | `order.cancelled` | `handleOrderCancelled` |
| `order_created` | `order.created` | `handleOrderCreated` |
| `order_updated` | `order.updated` | `handleOrderCreated` (log-only) |
| `order_failed` | `order.failed` | `handleOrderFailed` |
| `order_canceled` | `order.cancelled` | `handleOrderCancelled` |
| `order_put_hold` | `order.updated` | `handleOrderCreated` (log-only) |
| `order_remove_hold` | `order.updated` | `handleOrderCreated` (log-only) |
| `product_synced` | `product.created` | `handleProductUpdated` |
| `product_updated` | `product.updated` | `handleProductUpdated` |
| `product_deleted` | `product.deleted` | `handleProductDeleted` |
| `stock_updated` | `stock.updated` | `handleStockUpdated` |

**NOTE:** Printful does NOT send an `order_delivered` event. Delivery status is detected by the `check-delivery-status` cron job that polls the provider API.

### 5.2 Printify Webhook Events (Legacy)

| Printify Raw Event | Canonical Event |
|---|---|
| `order:created` | `order.created` |
| `order:shipped` | `order.shipped` |
| `order:delivered` | `order.delivered` |
| `order:cancelled` | `order.cancelled` |
| `order:failed` | `order.failed` |
| `product:publish:started` | `product.publish_started` |
| `product:publish:succeeded` | `product.publish_succeeded` |
| `product:created` | `product.created` |
| `product:updated` | `product.updated` |
| `product:deleted` | `product.deleted` |

### 5.3 Webhook Endpoint

**Route:** `POST /api/webhooks/pod/[provider]` (dynamic: `printful` or `printify`)

**Flow:**
1. Validate provider ID against known set
2. Read raw body
3. Initialize provider
4. Extract signature (Printful: `?secret=` query param; Printify: `x-printify-hmac-sha256` header)
5. Verify webhook signature (timing-safe compare)
6. Parse + normalize event
7. Write audit log to `audit_log` table
8. Route to handler via `WebhookRouter`
9. On handler error: persist to `webhook_dead_letters` table
10. Always return 200 (prevent provider retries)

### 5.4 Webhook Handlers

| Canonical Event | Handler | Actions |
|---|---|---|
| `order.created` | `handleOrderCreated` | Log only |
| `order.updated` | `handleOrderCreated` | Log only |
| `order.shipped` | `handleOrderShipped` | Update order (status, tracking_number, tracking_url, carrier, shipped_at), create notification, send email |
| `order.delivered` | `handleOrderDelivered` | Update order (status=delivered, delivered_at), create notification |
| `order.cancelled` | `handleOrderCancelled` | Update order (status=cancelled) |
| `order.failed` | `handleOrderFailed` | Update order (status=failed, pod_error), send admin alert |
| `product.created` | `handleProductUpdated` | Fetch full product from provider, sync to Supabase |
| `product.updated` | `handleProductUpdated` | Same |
| `product.publish_succeeded` | `handleProductUpdated` | Same |
| `product.deleted` | `handleProductDeleted` | Mark product as deleted in Supabase |
| `stock.updated` | `handleStockUpdated` | Update variant `is_available` flags |

---

## 6. Cron Jobs

### 6.1 `sync-printify` — Full Reconciliation

**Route:** `GET /api/cron/sync-printify`
**Schedule:** Every 30 minutes
**Auth:** `CRON_SECRET` bearer token

**Steps:**
1. Fetch ALL products from active provider (paginated, max 10 pages / 500 products)
2. Fetch ALL Supabase products with `provider_product_id`
3. Create missing products (provider -> Supabase via `syncProductFromProvider`)
4. Update stale products (title/images/status differ)
5. Mark orphaned products (in Supabase but not provider) as deleted
6. Reconcile variant availability (`is_available`)
7. Fix margins below 35% via `auditMargins`
8. 10% chance: run divergence detection

### 6.2 `retry-printify-orders` — Stuck Order Retry

**Route:** `GET /api/cron/retry-printify-orders`

**Steps:**
1. Find orders in `paid` status without `external_order_id` (stuck)
2. If `pod_retry_count >= 3` OR `paid_at > 2h ago`: auto-refund via Stripe
3. If within 30min retry window: re-submit via `submitOrderToPOD()`
4. If `retry_count + 1 >= 3`: transition to `requires_review`
5. Auto-refund `requires_review` orders older than 24 hours

### 6.3 `check-delivery-status` — Delivery Polling

**Route:** `GET /api/cron/check-delivery-status`

**Steps:**
1. Find orders with `status=shipped` and `shipped_at > 3 days ago`
2. For each: query provider for current status
3. If delivered: synthesize `order.delivered` webhook event and route through webhook router
4. Max 20 orders per run

---

## 7. Data Transformation

### 7.1 Printful -> CanonicalProduct

| Printful Field | Canonical Field | Transform |
|---|---|---|
| `sync_product.id` | `externalId` | String cast |
| `sync_product.name` | `title` | String cast |
| (not stored) | `description` | Empty string (comes from Supabase) |
| `sync_product.is_ignored` | `status` | `is_ignored=true` -> `'draft'`, else `'active'` |
| `sync_variants[].id` | `variants[].externalId` | String cast |
| `sync_variants[].name` | `variants[].color`, `.size` | Parsed via regex `(Color / Size)` |
| `sync_variants[].retail_price` | `variants[].priceCents` | Float -> cents |
| (none) | `variants[].costCents` | `null` (requires catalog lookup) |
| `sync_variants[].product.image` | `variants[].imageUrl` | Extracted from nested product |
| `sync_variants[].product.product_id` | `blueprintRef` | `"printful:{product_id}"` |

### 7.2 Printful -> CanonicalOrder

| Printful Field | Canonical Field | Transform |
|---|---|---|
| `id` | `externalId` | String cast |
| `status` | `status` | Via `PRINTFUL_ORDER_STATUS_MAP` (draft/failed/pending/canceled/onhold/inprocess/partial/fulfilled/archived) |
| `recipient.name` | `shippingAddress.firstName`, `.lastName` | Split on first space |
| `recipient.address1` | `shippingAddress.address1` | Direct |
| `recipient.country_code` | `shippingAddress.country` | Direct |
| `recipient.zip` | `shippingAddress.postalCode` | Direct |
| `items[].sync_variant_id` | `lineItems[].variantExternalId` | String cast |
| `shipments[].tracking_number` | `shipments[].trackingNumber` | Direct |
| `shipments[].tracking_url` | `shipments[].trackingUrl` | Direct |
| `created` | `createdAt` | Unix timestamp -> ISO string |

### 7.3 CanonicalProduct -> Supabase (via sync-product.ts)

| Canonical Field | Supabase Column | Notes |
|---|---|---|
| `externalId` | `provider_product_id` | Upsert key |
| (from blueprintRef) | `pod_provider` | e.g. `'printful'` or `'printify'` |
| (from blueprintRef) | `product_template_id` | e.g. catalog product ID |
| (from blueprintRef) | `provider_facility_id` | e.g. provider/facility ID |
| `title` | `title` | Preserves admin edits if `admin_edited_at > last_synced_at` |
| `description` | `description` | HTML stripped, max 2000 chars |
| (inferred from title) | `category_id` | Only for NEW products |
| `status` | `status` | `'active'` or `'draft'` |
| min(variants.priceCents) | `base_price_cents` | From enabled variants only |
| min(variants.costCents) | `cost_cents` | Nullable |
| `images` | `images` | Deduplicated JSONB array |
| | `currency` | Always `'EUR'` |
| | `last_synced_at` | Current timestamp |
| | `published_at` | Set if status=active |

### 7.4 CanonicalVariant -> product_variants

| Canonical Field | Supabase Column |
|---|---|
| `externalId` | `external_variant_id` |
| `title` | `title` |
| `size` | `size` |
| `color` | `color` |
| `priceCents` | `price_cents` |
| `costCents` | `cost_cents` |
| `sku` | `sku` |
| `isEnabled` | `is_enabled` |
| `isAvailable` | `is_available` |
| `imageUrl` | `image_url` |

### 7.5 Printful Position Mapping

| Canonical/Printify Position | Printful Placement |
|---|---|
| `front` | `front` |
| `back` | `back` |
| `neck_outer` | `label_outside` |
| `sleeve` | `sleeve_left` |
| `sleeve_left` | `sleeve_left` |
| `sleeve_right` | `sleeve_right` |
| `embroidery_front` | `embroidery_front` |
| `embroidery_back` | `embroidery_back` |

---

## 8. MCP Server

The MCP server (`mcp-server/`) has **minimal Printful awareness**:
- `src/resources/policies.ts` mentions "Printify" in static shipping policy text (stale reference)
- No Printful-specific tools, resources, or prompts
- The MCP server operates at the Supabase data layer (searching products, managing cart) — it does not call the POD provider API directly

---

## 9. Environment Variables

| Variable | Used By | Description |
|---|---|---|
| `PRINTFUL_API_TOKEN` | Frontend POD layer | Printful API bearer token |
| `PRINTFUL_STORE_ID` | Frontend POD layer | Printful store ID |
| `PRINTFUL_TOKEN_EXPIRES_AT` | Frontend POD layer | Optional: ISO date for token expiry warning |
| `PRINTFUL_WEBHOOK_SECRET` | Frontend webhooks | Shared secret for `?secret=` webhook auth |
| `POD_PROVIDER` | Frontend POD layer | Default provider ID (defaults to `'printful'`) |
| `CRON_SECRET` | Cron routes | Bearer token for cron job auth |

---

## 10. Gap Analysis: Printify Connector vs Printful

### 10.1 PodClaw Connector Tools — Coverage Status

| PodClaw Tool | Frontend Printful Equivalent | Status |
|---|---|---|
| `printify_list_products` | `listProducts()` | COVERED |
| `printify_create` | `createProduct()` | PARTIALLY — No duplicate detection, no print_areas normalization |
| `printify_update` | `updateProduct()` | STUB — Returns current state, no actual update |
| `printify_get_product` | `getProduct()` | COVERED |
| `printify_delete_product` | `deleteProduct()` | COVERED |
| `printify_get_mockup` | `generateMockup()` + `getMockupStatus()` | DIFFERENT — Async task (not sync like Printify) |
| `printify_get_gpsr` | — | **MISSING** — No GPSR endpoint for Printful |
| `printify_publish` | `publishProduct()` | NO-OP (Printful auto-publishes) |
| `printify_unpublish` | — | **MISSING** — No unpublish concept in Printful |
| `printify_publishing_succeeded` | `confirmPublishing()` | NO-OP |
| `printify_publishing_failed` | `reportPublishingFailed()` | NO-OP |
| `printify_upload_image` | `uploadDesign()` | COVERED (URL only, no base64) |
| `printify_get_blueprints` | `getBlueprints()` | COVERED |
| `printify_search_blueprints` | — | **MISSING** — No in-memory search |
| `printify_get_providers` | — | **MISSING** — Printful has no provider concept (they ARE the provider) |
| `printify_get_variants` | `getBlueprintVariants()` | COVERED (different format) |
| `printify_get_blueprint_detail` | — | **MISSING** — No dedicated detail endpoint used |
| `printify_get_orders` | — | **MISSING** — No listOrders method |
| `printify_get_order_costs` | — | **MISSING** — No dedicated cost breakdown |
| `printify_create_order` | `createOrder()` | COVERED |
| `printify_send_to_production` | `submitForProduction()` | COVERED |
| `printify_cancel_order` | `cancelOrder()` | COVERED |
| `printify_list_webhooks` | — | **MISSING** — No webhook CRUD via API |
| `printify_create_webhook` | — | **MISSING** — Printful webhooks configured in dashboard |
| `printify_delete_webhook` | — | **MISSING** — Same as above |
| `printify_list_uploads` | — | **MISSING** — No list uploads endpoint |
| `printify_list_shops` | — | **MISSING** — Uses `getStore()` (returns first store only) |
| `printify_get_shop` | `getStore()` | COVERED (different format) |
| `printify_get_shipping_profiles` | — | **MISSING** — Printful uses `getShippingRates()` per-request |

### 10.2 Critical Gaps Summary

#### Missing in Printful Provider (Frontend)

1. **`updateProduct` is a stub** — Returns current state without actual update. Printful sync products can be updated via PUT to `/store/products/{id}`, but this is not implemented.

2. **No GPSR endpoint** — Printify has `/gpsr.json` for EU GPSR safety info. Printful equivalent needs investigation (may be in product creation payload or dashboard).

3. **No list orders** — The Printful client can only `getOrder(id)`, not list orders with filters. Needed for PodClaw order management agent.

4. **No order cost breakdown** — Printify returns cost/shipping_cost per line item. Printful likely has this in the order response but no dedicated extraction.

5. **Variant cost is null** — Printful sync products don't include production cost. Must be fetched from catalog pricing endpoint or calculated separately.

#### Missing in PodClaw (No Printful Connector)

The PodClaw connector (`podclaw/connectors/printify_connector.py`) is **entirely Printify-specific**. There is NO Printful equivalent connector for PodClaw agents. This means:

1. **All 22 PodClaw tools call Printify API** (`https://api.printify.com/v1`)
2. **PodClaw agents cannot manage Printful products** until a new connector is built
3. The PodClaw bridge API does not know about the frontend POD abstraction layer
4. **Critical features only in PodClaw connector but NOT in frontend Printful:**
   - Duplicate product detection (Levenshtein + trigram)
   - SSRF-protected image URL validation
   - Circuit breaker pattern
   - Print areas normalization (simplified -> full format)
   - Blueprint search (in-memory filtering)
   - Webhook CRUD management

#### Inconsistencies

1. **MCP server policies.ts** still references "Printify" — should say "Printful"
2. **Cron job routes** are named `sync-printify` and `retry-printify-orders` but operate on the active provider (which is now Printful)
3. **`checkout-completed.ts`** hardcodes `pod_provider: 'printful'` in the order update
4. **`submit-order-to-pod.ts`** imports `canonicalAddressFromStripe` from the Printify mapper (`pod/printify/mapper`), NOT the Printful mapper — this works because it's a shared utility, but the import path is misleading
5. **`create-product/route.ts`** (design studio) hardcodes `pod_provider: 'printful'` when inserting to products table

### 10.3 Recommended Next Steps

1. **Build PodClaw Printful Connector** — Port `printify_connector.py` to call Printful API with the same tool interface but adapted endpoints
2. **Implement `updateProduct`** — Printful supports PUT `/store/products/{id}` for sync product updates
3. **Add `listOrders`** — Printful supports `GET /orders` with offset/limit/status filters
4. **Investigate GPSR for Printful** — May need to be handled differently (Printful may auto-include GPSR data)
5. **Fix import paths** — Move `canonicalAddressFromStripe` to shared location (not under `printify/`)
6. **Rename cron routes** — `sync-printify` -> `sync-pod-provider` or similar
7. **Fix MCP server policies** — Update "Printify" reference to "Printful"
