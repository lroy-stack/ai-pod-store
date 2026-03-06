# Printify Integration Audit — Migration to Printful

## Executive Summary

This Next.js codebase has **deep, multi-layered integration with Printify**. The migration to Printful will require changes across:
- 6 core library files
- 10+ API routes
- 80+ scripts
- Database schema (6 columns across 2 tables)
- Environment configuration
- Type definitions and constants
- 2 background removal and mockup systems

---

## 1. Core Printify Library Files

### 1.1 `src/lib/printify.ts` (370 lines)
**Purpose**: Main Printify API client (singleton proxy pattern)

**Key Methods**:
- `createProduct()` — POST `/shops/{id}/products.json`
- `createOrder()` — POST `/shops/{id}/orders.json`
- `getOrder()` — GET `/shops/{id}/orders/{id}.json`
- `submitOrderForProduction()` — POST `/shops/{id}/orders/{id}/send_to_production.json`
- `cancelOrder()` — POST `/shops/{id}/orders/{id}/cancel.json`
- `uploadImage()` — POST `/uploads/images.json` (accepts URL)
- `uploadImageFromBase64()` — POST `/uploads/images.json` (accepts base64)
- `publishProduct()` — POST `/shops/{id}/products/{id}/publish.json`
- `publishingSucceeded()` — POST `/shops/{id}/products/{id}/publishing_succeeded.json` (custom integration)
- `publishingFailed()` — POST `/shops/{id}/products/{id}/publishing_failed.json`
- `deleteProduct()` — DELETE `/shops/{id}/products/{id}.json`
- `listProducts()` — GET `/shops/{id}/products.json` (paginated, **max 50 per page**)
- `getProduct()` — GET `/shops/{id}/products/{id}.json`
- `getBlueprints()` — GET `/catalog/blueprints.json`
- `getProviders()` — GET `/catalog/blueprints/{id}/print_providers.json`
- `getVariants()` — GET `/catalog/blueprints/{id}/print_providers/{id}/variants.json`
- `calculateShipping()` — POST `/shops/{id}/orders/shipping.json`

**Data Structures**:
```typescript
interface PrintifyLineItem { product_id, variant_id, quantity }
interface PrintifyShippingAddress { first_name, last_name, email, phone?, country, region?, address1, address2?, city, zip }
interface PrintifyOrderRequest { external_id?, label?, line_items, shipping_method, is_printify_express?, send_shipping_notification, address_to }
interface PrintifyOrderResponse { id, status, created_at, label?, line_items[], shipments[] }
```

**Caching**: 10-minute TTL for catalog endpoints (blueprints, providers, variants)

**Auth**: Bearer token via `PRINTIFY_API_TOKEN`, shop ID via `PRINTIFY_SHOP_ID`

**Headers**: Always includes `User-Agent: POD-AI-Store/1.0` (critical for Cloudflare bypass)

**Migration Impact**: 🔴 MAJOR — Complete rewrite needed
- Swap base URL to Printful API
- No shop ID concept in Printful (token is account-specific)
- Endpoint structure is different
- Response structures vary significantly
- Order submission flow is different (Printful orders go straight to queue)

---

### 1.2 `src/lib/printify-sync.ts` (550 lines)
**Purpose**: Bi-directional sync engine between Printify and Supabase

**Key Functions**:
- `inferCategorySlug(title)` — Maps product title → category slug (40+ keyword patterns)
- `calculateEngagementPrice(costCents, title)` — Pricing multiplier by product type (stickers 2.5x, mugs 2.0x, hoodies 1.7x, apparel 1.8x)
- `syncProductFromPrintify(printifyProduct, supabase)` — Core sync: title, description (strips HTML), visibility, cost, price, images, blueprint_id, print_provider_id. Maps variant costs USD → EUR (0.92). Upserts on `printify_id`
- `syncVariants()` — Variant sub-sync: parses `"Color / Size"` format, handles caps, shoes (US→EU), bicolor
- `deleteProductCascade()` — Soft delete with cascade (variants, marketing, wishlist, cart)

**Migration Impact**: 🔴 MAJOR — Variant parsing, category inference, blueprint/provider mapping all need updating

---

### 1.3 `src/lib/print-areas.ts` (140 lines)
**Purpose**: Canvas specs for mockup generation

Contains: `PRINT_AREAS` (pixel coords per product type), `TEMPLATE_COLORS`, `CATEGORY_TO_PRODUCT_TYPE`, `CSS_PREVIEW_ZONES`, `PRODUCTION_DIMENSIONS`, `computeFontSize()`

**Migration Impact**: 🟡 MINOR — Validate placeholder dimensions against Printful catalog

---

### 1.4 `src/lib/mockup-generator.ts` (150 lines)
**Purpose**: Compose AI designs onto product templates

**Migration Impact**: 🟡 MINOR — Template files may need updating

---

### 1.5 `src/lib/branded-mockup-generator.ts` (268 lines)
**Purpose**: Composite Printify mockups onto branded SVG backgrounds (rembg + Sharp threshold)

**Migration Impact**: 🟡 MINOR — Mockup CDN URLs change, proportions may differ

---

## 2. Webhook & Cron API Routes

### 2.1 `src/app/api/webhooks/printify/route.ts` (667 lines)

**Webhook Events Handled**:
| Event | Action |
|---|---|
| `order:created` | Log |
| `order:shipped` | Update status, notification, email, tracking |
| `order:delivered` | Update status, notification, delivery email |
| `order:cancelled` | Refund (if paid), update status, email |
| `order:failed` | Refund, update status, notify |
| `product:publish:started` | Confirm publishing |
| `product:publish:succeeded` | Sync product |
| `product:created` | Sync product |
| `product:updated` | Sync product |
| `product:deleted` | Soft delete |

**Auth**: HMAC-SHA256 via `X-Printify-Hmac-SHA256` header + `PRINTIFY_WEBHOOK_SECRET`

**Migration Impact**: 🔴 MAJOR — Event types, signature auth, order status codes all different

---

### 2.2 `src/app/api/cron/sync-printify/route.ts` (246 lines)
**Purpose**: 30-min reconciliation cron. Fetches all products (50/page), upserts, detects orphans, fixes margins <35%

**Migration Impact**: 🟡 MINOR — API endpoint and response structure

---

### 2.3 `src/app/api/designs/[id]/create-product/route.ts` (249 lines)
**Purpose**: Design → Product pipeline (validate → upload → create → publish → save)

**Migration Impact**: 🔴 MAJOR — Blueprint/provider concepts change entirely

---

### 2.4 `src/app/api/checkout/create-session/route.ts`
**Printify logic**: Calls `printify.calculateShipping()` for shipping rates

**Migration Impact**: 🟡 MINOR — Swap shipping API

---

### 2.5 `src/app/api/cron/retry-printify-orders/route.ts`
**Purpose**: Retry stuck orders (max 3 attempts, 30min window, 2h hard timeout)

**Migration Impact**: ✅ NONE — Order lifecycle logic, not Printify-specific

---

## 3. Database Schema — Printify-Specific Columns

### `products` table
| Column | Type | Purpose |
|---|---|---|
| `printify_id` | text, unique | External ID from Printify |
| `blueprint_id` | integer | Printify blueprint ID |
| `print_provider_id` | integer | Printify provider ID |
| `cost_cents` | integer | Production cost (EUR cents) |
| `base_price_cents` | integer | Retail price |
| `product_details` | JSONB | GPSR, materials, technique, etc. |

### `product_variants` table
| Column | Type | Purpose |
|---|---|---|
| `printify_variant_id` | text | External variant ID |
| `title` | text | Printify variant title ("Black / S") |
| `size` | text | Parsed from title |
| `color` | text | Parsed from title |
| `price_cents` | integer | Variant price |
| `cost_cents` | integer | Production cost |
| `sku` | text | SKU from Printify |
| `image_url` | text | Mockup URL |

### Migration Strategy
**Recommended**: Rename to vendor-agnostic names
- `printify_id` → `external_product_id`
- `printify_variant_id` → `external_variant_id`
- `blueprint_id` → `product_template_id`

---

## 4. Environment Variables

| Current (Printify) | New (Printful) |
|---|---|
| `PRINTIFY_API_TOKEN` | `PRINTFUL_API_TOKEN` |
| `PRINTIFY_SHOP_ID` | (not needed — token is account-specific) |
| `PRINTIFY_WEBHOOK_SECRET` | `PRINTFUL_WEBHOOK_SECRET` |

---

## 5. Scripts (80+ .mjs files)

All scripts in `scripts/` follow this pattern:
```javascript
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
```

Categories: product creation, audit/sync, catalog snapshots, blueprint queries.

**Migration Impact**: 🔴 MAJOR — All need endpoint/parsing updates

---

## 6. Store Configuration

`src/lib/store-config.ts`:
```typescript
export const EU_APPROVED_PROVIDERS = new Set([26, 410, 90, 23, 30, 255, 86])
// 26=Textildruck, 410=Printful, 90=Monster, 23=SPOKE, 30=Gooten, 255=OPT, 86=T-Pop
```

**Migration Impact**: 🟡 — Provider IDs will be Printful-specific

---

## 7. Printify API Endpoints Currently Used

| Method | Endpoint | Used By |
|---|---|---|
| POST | `/uploads/images.json` | printify.ts, scripts |
| POST | `/shops/{id}/products.json` | printify.ts, create-product, scripts |
| POST | `/shops/{id}/products/{id}/publish.json` | printify.ts, create-product |
| POST | `/shops/{id}/products/{id}/publishing_succeeded.json` | printify.ts, create-product, sync |
| DELETE | `/shops/{id}/products/{id}.json` | printify.ts |
| GET | `/shops/{id}/products.json` | printify.ts, sync, scripts |
| GET | `/shops/{id}/products/{id}.json` | printify.ts, webhooks, scripts |
| POST | `/shops/{id}/orders.json` | printify.ts |
| GET | `/shops/{id}/orders/{id}.json` | printify.ts |
| POST | `/shops/{id}/orders/{id}/send_to_production.json` | printify.ts |
| POST | `/shops/{id}/orders/{id}/cancel.json` | printify.ts |
| POST | `/shops/{id}/orders/shipping.json` | printify.ts, checkout |
| GET | `/catalog/blueprints.json` | printify.ts |
| GET | `/catalog/blueprints/{id}/print_providers.json` | printify.ts |
| GET | `/catalog/blueprints/{id}/print_providers/{id}/variants.json` | printify.ts |

---

## 8. Migration Impact Summary

| File | Type | Impact | Changes |
|---|---|---|---|
| `src/lib/printify.ts` | Core Client | 🔴 Major | Complete rewrite |
| `src/lib/printify-sync.ts` | Sync Engine | 🔴 Major | Variant parsing, mapping |
| `src/lib/print-areas.ts` | Canvas Specs | 🟡 Minor | Validate dimensions |
| `src/lib/mockup-generator.ts` | Mockup Gen | 🟡 Minor | Template files |
| `src/lib/branded-mockup-generator.ts` | Branded Mockup | 🟡 Minor | CDN URLs |
| `webhooks/printify/route.ts` | Webhooks | 🔴 Major | New events, auth, statuses |
| `cron/sync-printify/route.ts` | Cron Sync | 🟡 Minor | API calls |
| `designs/.../create-product/route.ts` | Product Creation | 🔴 Major | Blueprint/provider mapping |
| `checkout/create-session/route.ts` | Checkout | 🟡 Minor | Shipping API |
| `cron/retry-printify-orders/route.ts` | Retry Logic | ✅ None | Not Printify-specific |
| `store-config.ts` | Constants | 🟡 Minor | Provider IDs |
| 80+ scripts | Automation | 🔴 Major | All need updates |
| Database schema | Tables | 🟡 Minor | Rename columns |
