# Section 2 — Printful Adapter Implementation

> **Migration Plan: Printify → Printful**
> **Section:** 2 of N
> **Topic:** PrintfulClient HTTP wrapper, PrintfulMapper anti-corruption layer, complete method-by-method mapping
> **Date:** 2026-03-02
> **Scope:** `src/lib/pod/printful/` — all files within the Printful adapter package

---

## Table of Contents

1. [Overview and Design Principles](#1-overview-and-design-principles)
2. [Method-by-Method Mapping: PrintifyClient → PrintfulClient](#2-method-by-method-mapping)
3. [PrintfulClient — HTTP Wrapper Design](#3-printfulclient-http-wrapper-design)
4. [Authentication Handling](#4-authentication-handling)
5. [Rate Limiting Strategy](#5-rate-limiting-strategy)
6. [Caching Strategy](#6-caching-strategy)
7. [Error Handling](#7-error-handling)
8. [PrintfulMapper — Anti-Corruption Layer](#8-printfulmapper-anti-corruption-layer)
9. [Environment Variables](#9-environment-variables)
10. [Complete File List with Paths and Line Estimates](#10-complete-file-list)
11. [Implementation Order and Effort Estimates](#11-implementation-order-and-effort-estimates)

---

## 1. Overview and Design Principles

### What This Section Covers

This section defines the concrete implementation of `PrintfulClient` (the HTTP transport layer) and `PrintfulMapper` (the anti-corruption layer that translates between Printful's API format and our canonical domain models).

The adapter sits at:

```
src/lib/pod/printful/
  client.ts          ← HTTP wrapper (this section)
  mapper.ts          ← Transform functions (this section)
  index.ts           ← PrintfulProvider class (uses client + mapper)
  webhook-verifier.ts
  constants.ts
```

### Key Behavioral Differences from Printify

These differences drive every design decision in this section:

| Behavior | Printify | Printful | Impact on Adapter |
|---|---|---|---|
| **Product publishing** | Explicit `POST .../publish.json` + `publishing_succeeded.json` callback required | Products sync immediately on creation — no publish step | `publishProduct()` and `publishingSucceeded()` become no-ops or are removed from the interface |
| **Order draft concept** | Orders go directly to production queue | Orders are created as `draft`, then confirmed with a separate `POST /orders/{id}/confirm` call | `createOrder()` must call confirm, OR caller must call `submitForProduction()` — prefer `?confirm=true` query param on create |
| **File upload method** | Base64 encoded JSON body (`contents` field) or URL. Python urllib blocked by Cloudflare — requires curl workaround | URL-based upload (Printful fetches the file). No Cloudflare issue. Direct HTTP works | Eliminates the base64 upload path and the curl workaround entirely |
| **Token expiry** | Tokens are permanent until deleted | Tokens have an **expiration date** | Client must check token age and warn (or refresh if using OAuth) |
| **Shop ID in URL** | `shopId` embedded in every URL: `/v1/shops/{shopId}/products.json` | Store-level tokens have no URL shop ID. Account-level tokens use `X-PF-Store-Id` header | Client must conditionally add `X-PF-Store-Id` header, not embed ID in URL |
| **Catalog structure** | Blueprint ID + Print Provider ID combo determines product | Single catalog variant ID determines the product+provider combo | `getProviders()` has no equivalent — Printful IS the provider |
| **Mockup generation** | Synchronous (returns image URL directly, or uses print_areas data) | Asynchronous task queue: create task → poll for completion | `generateMockup()` requires polling loop or webhook-based completion |
| **Response envelope** | Raw JSON (no code/result wrapper) | Always `{ code: 200, result: ..., paging: ... }` | All responses must unwrap `.result` before returning |
| **EU availability** | Controlled by `print_provider_id` (P26, P410 = EU) | Per-variant `availability_status` array, check for `region: "EU"` | EU guard logic moves from provider-ID check to variant availability check |
| **Variant IDs** | Blueprint-specific integer IDs (e.g., 4011 is relative to a blueprint) | Global integer IDs across the entire Printful catalog | No scoping needed — variant IDs are globally unique |

---

## 2. Method-by-Method Mapping

Every method in the current `PrintifyClient` is mapped below. For each method: current endpoint, Printful equivalent, behavioral delta, and the mapper logic needed.

---

### 2.1 `createProduct(productData)`

**Current Printify call:**
```
POST /v1/shops/{shopId}/products.json
Body: {
  title, description, blueprint_id, print_provider_id,
  variants: [{ id, price, is_enabled }],
  print_areas: [{ variant_ids, placeholders: [{ position, images: [{ id, x, y, scale, angle }] }] }]
}
Returns: { id: string }
```

**Printful equivalent:**
```
POST /sync_products
Body: {
  sync_product: { external_id, name, thumbnail },
  sync_variants: [
    {
      external_id,
      variant_id,       ← Printful catalog variant ID (globally unique)
      retail_price,     ← decimal string, e.g. "29.99"
      is_enabled,
      files: [
        {
          placement,    ← "front", "back", "sleeve_left", etc.
          image_url,    ← public URL (Printful fetches it)
          position: { area_width, area_height, width, height, top, left }
        }
      ]
    }
  ]
}
Returns: { code: 200, result: { sync_product: { id, ... }, sync_variants: [...] } }
```

**Behavioral delta:**
- Printify: requires `blueprint_id` + `print_provider_id` to identify product template. Variants reference blueprint-scoped IDs.
- Printful: requires a global `variant_id` from the Printful catalog. No blueprint/provider combo.
- Printify: returns `{ id }` directly.
- Printful: returns `{ code, result: { sync_product, sync_variants } }`. Must unwrap `.result.sync_product.id`.
- **No publish step needed** — product is active immediately.
- File references: Printify uses uploaded image IDs (`{ id: "abc123" }` in print_areas). Printful uses public URLs in `files[].image_url`.

**Mapper transform — fromCanonicalCreateProduct:**
```typescript
// Input: our canonical CreateProductInput (provider-agnostic)
// Output: Printful POST /sync_products body

export function fromCanonicalCreateProduct(
  input: CreateProductInput
): PrintfulCreateSyncProductBody {
  return {
    sync_product: {
      external_id: input.internalProductId,      // our Supabase product UUID
      name: input.title,
      thumbnail: input.thumbnailUrl ?? undefined,
    },
    sync_variants: input.variants.map(v => ({
      external_id: v.internalVariantId,          // our Supabase variant UUID
      variant_id: parseInt(v.providerVariantId, 10), // Printful catalog variant ID
      retail_price: (v.priceCents / 100).toFixed(2),  // cents → "29.99" string
      is_enabled: v.isEnabled,
      files: v.printAreas.map(area => ({
        placement: mapPositionToPlacement(area.position),
        image_url: area.imageUrl,                 // must be publicly accessible URL
        ...(area.position_params ? {
          position: {
            area_width: area.position_params.areaWidth,
            area_height: area.position_params.areaHeight,
            width: area.position_params.width,
            height: area.position_params.height,
            top: area.position_params.top,
            left: area.position_params.left,
          }
        } : {}),
      })),
    })),
  }
}

// Printify position names → Printful placement names
function mapPositionToPlacement(position: string): string {
  const map: Record<string, string> = {
    'front':      'front',
    'back':       'back',
    'neck_outer': 'label_outside',   // Printify neck_outer = Printful label_outside
    'sleeve':     'sleeve_left',
    'left':       'sleeve_left',
    'right':      'sleeve_right',
    'embroidery_front': 'embroidery_front',  // hats
    'embroidery_back':  'embroidery_back',
  }
  return map[position] ?? position
}
```

---

### 2.2 `getProduct(productId)`

**Current Printify call:**
```
GET /v1/shops/{shopId}/products/{productId}.json
Returns: { id, title, description, variants, images, print_areas, blueprint_id, print_provider_id, ... }
```

**Printful equivalent:**
```
GET /sync_products/{id}
Returns: { code: 200, result: { sync_product: { id, external_id, name, variants, synced, thumbnail_url, is_ignored }, sync_variants: [...] } }
```

**Behavioral delta:**
- Printful returns product + all variants in a single call (same structure as create response).
- No `description` field on Printful sync products — descriptions are stored on our side in Supabase.
- No `blueprint_id` on the sync product itself — it appears on individual sync_variants as `product.product_id`.
- `is_ignored: true` = product disabled (equivalent to Printify `visible: false`).

**Mapper transform — toCanonicalProduct:**
```typescript
export function toCanonicalProduct(
  raw: PrintfulGetSyncProductResult
): CanonicalProduct {
  const { sync_product, sync_variants } = raw

  return {
    externalId: String(sync_product.id),
    title: sync_product.name,
    description: '',   // Not stored in Printful — comes from our Supabase record
    status: sync_product.is_ignored ? 'draft' : 'active',
    variants: (sync_variants ?? [])
      .filter(v => v.is_enabled !== false)
      .map(toCanonicalSyncVariant),
    images: extractImagesFromSyncVariants(sync_variants ?? []),
    printAreas: [],    // Not returned by Printful sync product endpoint
    blueprintRef: extractBlueprintRef(sync_variants ?? []),
    tags: [],          // Not stored in Printful — comes from Supabase
    _raw: raw,
  }
}

function toCanonicalSyncVariant(v: PrintfulSyncVariant): CanonicalVariant {
  // Parse size and color from variant name: "Bella + Canvas 3001 (Black / M)" → {color:"Black", size:"M"}
  const { color, size } = parsePrintfulVariantName(v.name)

  return {
    externalId: String(v.id),
    title: v.name,
    size,
    color,
    sku: v.sku ?? '',
    priceCents: Math.round(parseFloat(v.retail_price ?? '0') * 100),
    costCents: null,   // Cost requires separate catalog lookup — not in sync_variant
    isEnabled: v.is_enabled !== false,
    isAvailable: v.synced === true,
    imageUrl: v.product?.image ?? null,
  }
}

function extractBlueprintRef(variants: PrintfulSyncVariant[]): string | null {
  const productId = variants[0]?.product?.product_id
  return productId ? `printful:${productId}` : null
}

function extractImagesFromSyncVariants(
  variants: PrintfulSyncVariant[]
): CanonicalImage[] {
  // Collect unique thumbnail URLs, grouped by product
  const seen = new Set<string>()
  return variants
    .filter(v => v.product?.image && !seen.has(v.product.image))
    .map(v => {
      seen.add(v.product!.image)
      return {
        src: v.product!.image,
        alt: v.name,
        variantIds: [String(v.id)],
        isDefault: seen.size === 1,
      }
    })
}

// "Bella + Canvas 3001 Unisex Jersey Short Sleeve Tee (Black / M)"
// We want: color="Black", size="M"
function parsePrintfulVariantName(
  name: string
): { color: string | null; size: string | null } {
  // Printful always formats as "Product Name (Color / Size)" or "Product Name Color Size"
  const parenMatch = name.match(/\(([^)]+)\)\s*$/)
  if (parenMatch) {
    const parts = parenMatch[1].split('/')
    if (parts.length >= 2) {
      return {
        color: parts[0].trim() || null,
        size: parts[parts.length - 1].trim() || null,
      }
    }
    // Single value in parens — assume it's color for garments
    return { color: parenMatch[1].trim() || null, size: null }
  }
  return { color: null, size: null }
}
```

---

### 2.3 `listProducts(page, limit)`

**Current Printify call:**
```
GET /v1/shops/{shopId}/products.json?page={page}&limit={limit}
Returns: { current_page, data: [...], total }
```
Note: Printify max limit is 50 (not 100 — returns validation error).

**Printful equivalent:**
```
GET /sync_products?offset={offset}&limit={limit}&status=synced
Returns: {
  code: 200,
  result: [{ id, external_id, name, variants, synced, thumbnail_url, is_ignored }],
  paging: { total, offset, limit }
}
```

**Behavioral delta:**
- Printify paginates with `page` (1-based). Printful paginates with `offset` (0-based).
- Printify returns full product objects in the list. Printful returns lightweight summary objects (no variants). To get full variant data, you must call `GET /sync_products/{id}` for each product.
- Printful max limit is 100 (vs Printify's 50 cap).
- The `status` filter `synced` gets only fully configured products. Use `all` during migration audits.

**Pagination transform:**
```typescript
// Input: page (1-based), limit → Output: Printful offset (0-based)
function pageToOffset(page: number, limit: number): number {
  return (page - 1) * limit
}

// Input: Printful paging → Output: canonical PaginatedResult
export function toListResult(
  raw: PrintfulListSyncProductsResponse,
  page: number
): PaginatedResult<CanonicalProduct> {
  return {
    // NOTE: sync_products list only returns summary objects (no sync_variants).
    // Callers that need full variant data must call getProduct(id) individually.
    data: raw.result.map(p => ({
      externalId: String(p.id),
      title: p.name,
      description: '',
      status: p.is_ignored ? 'draft' : 'active',
      variants: [],           // Empty — requires individual getProduct() call
      images: p.thumbnail_url ? [{
        src: p.thumbnail_url,
        alt: p.name,
        variantIds: [],
        isDefault: true,
      }] : [],
      printAreas: [],
      blueprintRef: null,
      tags: [],
      _raw: p,
    })),
    total: raw.paging.total,
    offset: raw.paging.offset,
    limit: raw.paging.limit,
    currentPage: page,
  }
}
```

**Important note for cron sync:** The Printify sync cron fetches all products with full variant data in paginated calls. With Printful, listing products returns summaries only. The sync engine will need to call `getProduct(id)` for each product to get variant data, OR use the `@external_id` lookup to batch by known external IDs. This adds N additional API calls per sync cycle. See Section 6 (Sync Engine) for the throttled batch strategy.

---

### 2.4 `createOrder(orderData)`

**Current Printify call:**
```
POST /v1/shops/{shopId}/orders.json
Body: {
  external_id,
  label,
  line_items: [{ product_id, variant_id, quantity }],
  shipping_method: 1,              // integer — standard = 1
  is_printify_express: false,
  send_shipping_notification: true,
  address_to: {
    first_name, last_name, email, phone,
    country, region, address1, address2, city, zip
  }
}
Returns: { id, status, created_at, line_items, shipments }
```

**Printful equivalent:**
```
POST /orders?confirm=true          // ?confirm=true skips draft state — goes straight to production
Body: {
  external_id,
  label,
  shipping: "STANDARD",            // string — not integer
  recipient: {
    name,                          // SINGLE full name field (not first/last)
    company,
    address1, address2,
    city,
    state_code,                    // ISO state/province code (required for US, CA, AU)
    state_name,
    country_code,                  // ISO 3166-1 alpha-2
    country_name,
    zip,
    phone,
    email,
    tax_number                     // For EU B2B orders
  },
  items: [
    {
      sync_variant_id,             // Our Printful sync variant ID (preferred)
      // OR: variant_id            // Printful catalog variant ID (for on-demand design)
      quantity,
      retail_price,
      name
    }
  ],
  retail_costs: {
    currency: "EUR",
    subtotal, discount, shipping, tax
  },
  gift: { subject, message },      // If gift order
  packing_slip: {
    email, phone, message, logo_url, store_name, custom_order_id
  }
}
Returns: { code: 200, result: { id, external_id, status, shipping, recipient, items, costs, retail_costs, shipments } }
```

**Behavioral delta:**
- Printify `shipping_method: 1` (integer) → Printful `shipping: "STANDARD"` (string).
- Printify has `first_name` + `last_name` separately. Printful uses single `name` field.
- Printify `address_to.country` (ISO code) → Printful `recipient.country_code` (same format, different key).
- Printify `address_to.region` → Printful `recipient.state_code`.
- Printify `send_shipping_notification: false` for gifts → Printful uses `gift` object instead.
- Printify line items reference `product_id` (Printify product ID). Printful line items reference `sync_variant_id` (Printful sync variant ID). This requires a lookup from our Supabase `product_variants` table to find the stored `printful_variant_id`.
- **Critical:** Using `?confirm=true` sends the order directly to production, which matches current Printify behavior where Stripe webhook calls `createOrder()` then immediately `submitOrderForProduction()`. The two-step flow is preserved but both steps are executed in `createOrder()` when the confirm param is used.

**Mapper transform — fromCanonicalOrder:**
```typescript
export function fromCanonicalOrder(
  input: CreateOrderInput,
  options: { confirm?: boolean; packingSlip?: PrintfulPackingSlip } = {}
): { body: PrintfulCreateOrderBody; confirmInRequest: boolean } {
  const confirmInRequest = options.confirm ?? true  // Default: confirm immediately

  const body: PrintfulCreateOrderBody = {
    external_id: input.internalOrderId,
    label: `SKAPARA ${input.internalOrderId.slice(0, 8).toUpperCase()}`,
    shipping: mapShippingMethod(input.shippingMethod),
    recipient: {
      name: `${input.address.firstName} ${input.address.lastName}`.trim(),
      address1: input.address.address1,
      address2: input.address.address2 ?? undefined,
      city: input.address.city,
      state_code: input.address.state ?? undefined,
      country_code: input.address.country,    // Already ISO 3166-1 alpha-2 from Stripe
      zip: input.address.postalCode,
      phone: input.address.phone ?? undefined,
      email: input.address.email,
    },
    items: input.lineItems.map(item => ({
      sync_variant_id: parseInt(item.providerVariantId, 10),  // Stored in product_variants.provider_variant_id
      quantity: item.quantity,
      retail_price: (item.priceCents / 100).toFixed(2),
      name: item.productTitle ?? undefined,
    })),
    retail_costs: {
      currency: 'EUR',
      subtotal: (input.subtotalCents / 100).toFixed(2),
      discount: '0.00',
      shipping: (input.shippingCents / 100).toFixed(2),
      tax: (input.taxCents / 100).toFixed(2),
    },
    ...(input.giftMessage ? {
      gift: {
        subject: 'A gift for you from SKAPARA',
        message: input.giftMessage,
      }
    } : {}),
    packing_slip: options.packingSlip ?? {
      email: 'hello@skapara.com',
      store_name: 'SKAPARA',
      logo_url: 'https://skapara.com/brand/skapara-wordmark-white.svg',
      message: 'Thank you for your order! Wear it well.',
    },
  }

  return { body, confirmInRequest }
}

// Printify shipping_method integer → Printful shipping string
function mapShippingMethod(method?: number | string): string {
  if (method === 'EXPRESS' || method === 2) return 'EXPRESS'
  if (method === 'OVERNIGHT' || method === 3) return 'OVERNIGHT'
  return 'STANDARD'  // Default
}
```

**Mapper transform — toCanonicalOrder:**
```typescript
export function toCanonicalOrder(raw: PrintfulOrderResult): CanonicalOrder {
  return {
    externalId: String(raw.id),
    status: mapPrintfulOrderStatus(raw.status),
    lineItems: (raw.items ?? []).map(item => ({
      productExternalId: String(item.sync_variant_id ?? item.variant_id),
      variantExternalId: String(item.sync_variant_id ?? item.variant_id),
      quantity: item.quantity,
      status: raw.status,
    })),
    shippingAddress: {
      firstName: extractFirstName(raw.recipient?.name ?? ''),
      lastName: extractLastName(raw.recipient?.name ?? ''),
      email: raw.recipient?.email ?? '',
      phone: raw.recipient?.phone,
      address1: raw.recipient?.address1 ?? '',
      address2: raw.recipient?.address2,
      city: raw.recipient?.city ?? '',
      state: raw.recipient?.state_code ?? '',
      postalCode: raw.recipient?.zip ?? '',
      country: raw.recipient?.country_code ?? '',
    },
    shipments: (raw.shipments ?? []).map(s => ({
      carrier: s.carrier ?? '',
      trackingNumber: s.tracking_number ?? '',
      trackingUrl: s.tracking_url ?? '',
      shippedAt: s.shipped_at
        ? new Date(s.shipped_at * 1000).toISOString()
        : new Date().toISOString(),
    })),
    createdAt: raw.created
      ? new Date(raw.created * 1000).toISOString()
      : new Date().toISOString(),
    _raw: raw,
  }
}

const PRINTFUL_ORDER_STATUS_MAP: Record<string, CanonicalOrder['status']> = {
  'draft':     'draft',
  'failed':    'failed',
  'pending':   'pending',
  'canceled':  'cancelled',
  'onhold':    'pending',
  'inprocess': 'in_production',
  'partial':   'shipped',
  'fulfilled': 'shipped',
  'archived':  'delivered',
}

function mapPrintfulOrderStatus(status: string): CanonicalOrder['status'] {
  return PRINTFUL_ORDER_STATUS_MAP[status] ?? 'pending'
}

function extractFirstName(fullName: string): string {
  return fullName.split(' ')[0] ?? ''
}

function extractLastName(fullName: string): string {
  const parts = fullName.split(' ')
  return parts.slice(1).join(' ')
}
```

---

### 2.5 `getOrder(orderId)`

**Current Printify call:**
```
GET /v1/shops/{shopId}/orders/{orderId}.json
```

**Printful equivalent:**
```
GET /orders/{id}
-- OR with external ID lookup (preferred for our use case):
GET /orders/@{externalId}
Returns: { code: 200, result: { ...full order object... } }
```

**Behavioral delta:**
- Printful supports `@external_id` prefix lookup. This means we can retrieve orders by our Supabase order ID without needing to store Printful's internal order ID.
- Response is the full order object (same schema as createOrder response). Use the same `toCanonicalOrder()` mapper.
- Printful timestamps are Unix integers. Printify timestamps are ISO strings.

```typescript
// In PrintfulClient:
async getOrder(orderIdOrExternalId: string): Promise<CanonicalOrder> {
  // Support both internal Printful IDs and our external IDs
  const idParam = orderIdOrExternalId.startsWith('@')
    ? orderIdOrExternalId
    : orderIdOrExternalId
  const raw = await this.request<PrintfulEnvelope<PrintfulOrderResult>>(
    `/orders/${idParam}`
  )
  return mapper.toCanonicalOrder(raw.result)
}
```

---

### 2.6 `submitOrderForProduction(orderId)`

**Current Printify call:**
```
POST /v1/shops/{shopId}/orders/{orderId}/send_to_production.json
Body: (empty)
Returns: { id }
```

**Printful equivalent:**
```
POST /orders/{id}/confirm
Body: (none required)
Returns: { code: 200, result: { ...order object with status: "pending"... } }
```

**Behavioral delta:**
- The endpoint name changes: `send_to_production` → `confirm`.
- Printful's confirm endpoint does the same thing: transitions the order from draft to production queue.
- **Preferred approach:** Use `?confirm=true` query param on `POST /orders` to skip the two-step entirely. If callers already call both `createOrder()` and `submitOrderForProduction()`, the adapter should:
  1. Have `createOrder()` set `confirmInRequest: false` (creates draft).
  2. Have `submitOrderForProduction()` call `POST /orders/{id}/confirm`.

  This preserves the existing call contract without breaking callers. The `confirm: true` query param variant is offered as an optimization.

```typescript
// Implementation in PrintfulClient:
async submitOrderForProduction(orderId: string): Promise<void> {
  await this.request(`/orders/${orderId}/confirm`, { method: 'POST' })
}
```

---

### 2.7 `cancelOrder(orderId)`

**Current Printify call:**
```
POST /v1/shops/{shopId}/orders/{orderId}/cancel.json
```

**Printful equivalent:**
```
DELETE /orders/{id}
-- OR with external ID:
DELETE /orders/@{externalId}
```

**Behavioral delta:**
- Printify uses `POST .../cancel.json`. Printful uses `DELETE /orders/{id}`.
- Both can only cancel orders before production starts.
- Printful returns `{ code: 200, result: { id } }`. No meaningful data to unwrap.

```typescript
async cancelOrder(orderId: string): Promise<void> {
  await this.request(`/orders/${orderId}`, { method: 'DELETE' })
}
```

---

### 2.8 `uploadImage(url, fileName)` and `uploadImageFromBase64(base64, fileName)`

**Current Printify calls:**
```
-- By URL:
POST /v1/uploads/images.json
Body: { file_name, url }

-- By base64:
POST /v1/uploads/images.json
Body: { file_name, contents: "base64-encoded-string..." }
Note: Python urllib blocked by Cloudflare — must use curl for base64 uploads.
Returns: { id, file_name, preview_url }
```

**Printful equivalent:**
```
-- By URL (recommended):
POST /files
Body: { url, type: "default", filename, visible: true }

-- By base64 (if needed — no Cloudflare issue with Printful):
POST /files
Body: { type: "default", file: "data:image/png;base64,{base64data}" }

Returns: { code: 200, result: {
  id, type, hash, filename, mime_type, size,
  width, height, dpi, status,
  thumbnail_url, preview_url, visible, is_temporary
} }
```

**Behavioral delta:**
- Printful supports URL upload cleanly — no Cloudflare issues. The base64 path still exists but is no longer needed for script-based uploads.
- Printful deduplicates by file hash. Uploading the same file twice returns the same `id`.
- Printful file `status` can be `waiting` (processing) — callers may need to poll before the file is usable.
- The returned `id` is an integer in Printful (versus a string in Printify).
- **The `uploadImageFromBase64` method can be simplified:** Printful accepts `data:image/png;base64,{data}` directly in the `file` field without the Cloudflare curl workaround.

**Mapper transform:**
```typescript
export interface UploadedDesign {
  id: string           // Always string in canonical model
  fileName: string
  previewUrl: string
  thumbnailUrl: string
  status: 'ok' | 'waiting' | 'failed'
  width: number
  height: number
  dpi: number
}

export function toUploadedDesign(raw: PrintfulFileResult): UploadedDesign {
  return {
    id: String(raw.id),               // Printful returns integer — normalize to string
    fileName: raw.filename,
    previewUrl: raw.preview_url ?? raw.thumbnail_url ?? '',
    thumbnailUrl: raw.thumbnail_url ?? '',
    status: raw.status as 'ok' | 'waiting' | 'failed',
    width: raw.width ?? 0,
    height: raw.height ?? 0,
    dpi: raw.dpi ?? 0,
  }
}
```

**File status polling (important):** Printful file processing is not always instant. After `POST /files`, the `status` may be `waiting`. For product creation, files should be confirmed `ok` before use. Add a thin polling helper:

```typescript
// In PrintfulClient:
async uploadImageAndWait(
  url: string,
  fileName: string,
  maxWaitMs = 30_000
): Promise<UploadedDesign> {
  const result = await this.uploadImageByUrl(url, fileName)
  if (result.status === 'ok') return result

  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    await delay(2000)
    const check = await this.getFile(result.id)
    if (check.status === 'ok') return check
    if (check.status === 'failed') {
      throw new PODProviderError(
        'printful',
        'FILE_PROCESSING_FAILED',
        `File ${result.id} failed to process`,
        500
      )
    }
  }
  throw new PODProviderError(
    'printful',
    'FILE_PROCESSING_TIMEOUT',
    `File ${result.id} still processing after ${maxWaitMs}ms`,
    504
  )
}
```

---

### 2.9 `publishProduct(productId)` and `publishingSucceeded(productId, externalId)` and `publishingFailed(productId, reason)`

**Current Printify calls:**
```
POST /v1/shops/{shopId}/products/{productId}/publish.json
POST /v1/shops/{shopId}/products/{productId}/publishing_succeeded.json
POST /v1/shops/{shopId}/products/{productId}/publishing_failed.json
```
These are required for Printify custom integrations. Without `publishing_succeeded`, products stay in `publishing` status forever.

**Printful equivalent:**
```
NONE — no equivalent endpoints exist.
```

**Behavioral delta:**
- Printful products are live immediately upon `POST /sync_products` creation.
- There is no "publishing" state, no publishing webhook, no external ID confirmation.
- The `external_id` field is set during product creation — it does not need a separate confirmation call.

**Adapter implementation:**
```typescript
// These methods become no-ops in the Printful adapter.
// They are kept in the PODProductProvider interface as optional methods
// so that Printify-aware callers don't break.

async publishProduct(_productId: string): Promise<void> {
  // Printful: product is auto-published on creation. No-op.
  return
}

async publishingSucceeded(_productId: string, _externalId: string): Promise<void> {
  // Printful: external_id was set at creation time. No-op.
  return
}

async publishingFailed(_productId: string, _reason?: string): Promise<void> {
  // Printful: no publishing failure state. No-op.
  return
}
```

**Impact on callers:** The design pipeline in `src/app/api/designs/[id]/create-product/route.ts` currently calls `publishProduct()` then `publishingSucceeded()` after creation. With Printful, both calls are no-ops. The product is already active after `createProduct()`. The caller flow doesn't need to change — it just becomes faster (two fewer HTTP calls).

---

### 2.10 `deleteProduct(productId)`

**Current Printify call:**
```
DELETE /v1/shops/{shopId}/products/{productId}.json
```

**Printful equivalent:**
```
DELETE /sync_products/{id}
Returns: { code: 200, result: { id: 123456 } }
```

**Behavioral delta:**
- Identical semantics. Both permanently delete the product and all variants.
- Printful returns `{ code, result: { id } }`. Printify returns `{}` or `204`. Unwrap and discard.

---

### 2.11 `getBlueprints()`

**Current Printify call:**
```
GET /v1/catalog/blueprints.json
Returns: [{ id, title, description, images }]
Cached: 10 min (in-memory)
```

**Printful equivalent:**
```
GET /products                      ← Catalog API — PUBLIC, no auth required
Optional: GET /products?category_id=24
Returns: { code: 200, result: [{ id, title, brand, model, type, type_name, variant_count, techniques, files, options }] }
```

**Behavioral delta:**
- Printful catalog is public — no auth token needed. The client can still send the token (harmless).
- Printify returns `blueprints` (product templates). Printful returns `products` (same concept, different name).
- Printful product has richer metadata: `brand`, `model`, `techniques`, `files` (available print areas), `options`.
- The `id` in Printful is the product ID. The equivalent of Printify's `blueprint_id` is the Printful `product_id`.
- No `print_provider_id` concept — Printful is the only provider.

**Mapper transform — toBlueprint:**
```typescript
export interface Blueprint {
  id: string
  title: string
  description: string
  type: string
  brand: string | null
  model: string | null
  thumbnailUrl: string
  techniques: string[]                  // ['DTG', 'EMBROIDERY', etc.]
  availablePlacements: string[]         // ['front', 'back', 'label_outside', etc.]
  variantCount: number
  isDiscontinued: boolean
}

export function toBlueprint(raw: PrintfulCatalogProduct): Blueprint {
  return {
    id: String(raw.id),
    title: raw.title,
    description: '',    // Not in Printful catalog response — store our own descriptions
    type: raw.type,
    brand: raw.brand ?? null,
    model: raw.model ?? null,
    thumbnailUrl: raw.image,
    techniques: (raw.techniques ?? []).map(t => t.key),
    availablePlacements: (raw.files ?? []).map(f => f.id),
    variantCount: raw.variant_count ?? 0,
    isDiscontinued: raw.is_discontinued ?? false,
  }
}
```

---

### 2.12 `getProviders(blueprintId)`

**Current Printify call:**
```
GET /v1/catalog/blueprints/{blueprintId}/print_providers.json
Returns: [{ id, title, location: { country, region } }]
Purpose: Find EU providers (P26, P410) for a given blueprint
```

**Printful equivalent:**
```
NONE — no equivalent endpoint. Printful IS the provider.
EU availability is checked per-variant, not per-provider.
```

**Behavioral delta:**
- **This method has no Printful equivalent.** The entire concept of selecting a print provider does not exist in Printful.
- EU availability is checked at the variant level: `GET /products/{id}` returns variants with `availability_status: [{ region: "EU", status: "in_stock" }]`.
- The EU guard logic in `src/lib/store-config.ts` (`isEUProvider()`) must be replaced with a per-variant EU availability check.

**Adapter implementation:**
```typescript
// getProviders() is not in the PODProvider interface.
// The EU availability check is now done via getCatalogProduct().

// In PrintfulMapper:
export function isEUAvailable(variant: PrintfulCatalogVariant): boolean {
  return (variant.availability_status ?? []).some(
    s => s.region === 'EU' && s.status === 'in_stock'
  )
}

// Usage in product creation (replace isEUProvider() guard):
// Before: if (!isEUProvider(providerId)) throw new Error(...)
// After:  variants.filter(v => isEUAvailable(v))  — only include EU-available variants
```

---

### 2.13 `getVariants(blueprintId, providerId)`

**Current Printify call:**
```
GET /v1/catalog/blueprints/{blueprintId}/print_providers/{providerId}/variants.json
Returns: { id, title, variants: [{ id, title, options, placeholders }] }
Purpose: Get available size/color combinations for a blueprint+provider combo
```

**Printful equivalent:**
```
GET /products/{id}
Returns: { code: 200, result: { product: {...}, variants: [{ id, product_id, name, size, color, color_code, image, price, in_stock, availability_status, material }] } }
```

**Behavioral delta:**
- Printify returns variants scoped to a blueprint+provider combo. Printful returns all variants for a catalog product, with per-variant availability metadata.
- Printify variant `placeholders` (print areas) per variant → Printful `GET /mockup-generator/printfiles/{id}` for per-variant print area specs.
- EU filtering moves from provider selection to variant selection (filter by `availability_status`).

**Mapper transform — toBlueprintVariant:**
```typescript
export interface BlueprintVariant {
  id: string
  title: string
  size: string | null
  color: string | null
  colorHex: string | null
  colorHex2: string | null
  imageUrl: string
  wholesalePriceCents: number        // Production cost (what Printful charges us)
  inStock: boolean
  isEUAvailable: boolean
}

export function toBlueprintVariant(raw: PrintfulCatalogVariant): BlueprintVariant {
  return {
    id: String(raw.id),
    title: raw.name,
    size: raw.size ?? null,
    color: raw.color ?? null,
    colorHex: raw.color_code ?? null,
    colorHex2: raw.color_code2 ?? null,
    imageUrl: raw.image,
    // Printful catalog pricing is in USD — convert to EUR cents
    wholesalePriceCents: Math.round(parseFloat(raw.price ?? '0') * USD_TO_EUR_RATE * 100),
    inStock: raw.in_stock ?? false,
    isEUAvailable: isEUAvailable(raw),
  }
}

// Constant — update quarterly or fetch from exchange rate API
const USD_TO_EUR_RATE = 0.92
```

---

### 2.14 `calculateShipping(lineItems, address)`

**Current Printify call:**
```
POST /v1/shops/{shopId}/orders/shipping.json
Body: {
  line_items: [{ product_id, variant_id, quantity }],
  address_to: { country, region, ... }
}
Returns: { standard: [{ id, name, cost }] }
```

**Printful equivalent:**
```
POST /shipping/rates
Body: {
  recipient: {
    country_code,      // ISO 3166-1 alpha-2
    state_code,
    city,
    zip
  },
  items: [
    {
      variant_id,      // Printful catalog variant ID
      quantity
    }
  ],
  currency: "EUR",
  locale: "en_US"
}
Returns: { code: 200, result: [{ id, name, rate, currency, minDeliveryDate, maxDeliveryDate }] }
```

**Behavioral delta:**
- Printify line items use `product_id` + `variant_id`. Printful uses only `variant_id` (catalog variant ID).
- Printify returns `cost` as a number (cents). Printful returns `rate` as a decimal string (e.g., `"3.99"`).
- Printful response includes delivery date estimates (`minDeliveryDate`, `maxDeliveryDate`).
- Printful requires `currency` and `locale` params for localized pricing.

**Mapper transforms:**
```typescript
export function fromShippingRateInput(
  input: ShippingRateInput
): PrintfulShippingRatesBody {
  return {
    recipient: {
      country_code: input.address.country,
      state_code: input.address.state ?? undefined,
      city: input.address.city ?? undefined,
      zip: input.address.postalCode ?? undefined,
    },
    items: input.lineItems.map(item => ({
      variant_id: parseInt(item.providerVariantId, 10),
      quantity: item.quantity,
    })),
    currency: 'EUR',
    locale: 'en_US',
  }
}

export function toShippingRate(raw: PrintfulShippingRate): ShippingRate {
  return {
    id: String(raw.id),
    name: raw.name,
    // Printful returns decimal string — convert to cents
    costCents: Math.round(parseFloat(raw.rate) * 100),
    currency: raw.currency,
    estimatedDelivery: raw.minDeliveryDate && raw.maxDeliveryDate
      ? `${raw.minDeliveryDate} – ${raw.maxDeliveryDate}`
      : undefined,
  }
}
```

---

## 3. PrintfulClient — HTTP Wrapper Design

The `PrintfulClient` is the single HTTP transport layer. All methods in the adapter go through it. No Printify-specific behaviors (Cloudflare workaround, base64 upload, shop ID in URL path) exist here.

```typescript
// src/lib/pod/printful/client.ts

import { PODProviderError, PODRateLimitError } from '../errors'

const PRINTFUL_BASE_URL = 'https://api.printful.com'
const CATALOG_TTL_MS = 10 * 60 * 1000    // 10 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 1000   // 1 minute
const MAX_REQUESTS_PER_WINDOW = 120
const RETRY_DELAY_MS = 1000

interface CacheEntry {
  data: unknown
  expiresAt: number
}

interface RateLimitBucket {
  count: number
  windowStart: number
}

export interface PrintfulClientConfig {
  apiToken: string
  storeId?: string           // Required if using account-level token
  tokenExpiresAt?: Date      // Track expiry for warnings
  webhookSecret?: string     // For webhook signature verification
}

export class PrintfulClient {
  private readonly headers: HeadersInit
  private readonly cache: Map<string, CacheEntry> = new Map()
  private readonly rateBucket: RateLimitBucket = {
    count: 0,
    windowStart: Date.now(),
  }

  constructor(private readonly config: PrintfulClientConfig) {
    if (!config.apiToken) {
      throw new Error('PrintfulClient: apiToken is required')
    }

    this.headers = {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      // NOTE: No User-Agent header needed — Printful does not use Cloudflare
      // with the same restrictions as Printify. Adding it anyway for identification.
      'User-Agent': 'SKAPARA-POD/1.0',
      ...(config.storeId ? { 'X-PF-Store-Id': config.storeId } : {}),
    }

    // Warn if token will expire within 7 days
    if (config.tokenExpiresAt) {
      const daysUntilExpiry =
        (config.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      if (daysUntilExpiry < 7) {
        console.warn(
          `[PrintfulClient] WARNING: API token expires in ${daysUntilExpiry.toFixed(1)} days. ` +
          `Rotate at: https://developers.printful.com/`
        )
      }
    }
  }

  // ---- Core Request Method ----

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2
  ): Promise<PrintfulEnvelope<T>> {
    const method = (options.method ?? 'GET').toUpperCase()
    const isCatalogGet = method === 'GET' && endpoint.startsWith('/products')

    // Serve from cache for catalog endpoints
    if (isCatalogGet) {
      const cached = this.cache.get(endpoint)
      if (cached && Date.now() < cached.expiresAt) {
        return cached.data as PrintfulEnvelope<T>
      }
    }

    // Enforce rate limit
    await this.enforceRateLimit()

    const url = `${PRINTFUL_BASE_URL}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    })

    // Handle rate limit (429)
    if (response.status === 429) {
      if (retries > 0) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10)
        console.warn(`[PrintfulClient] Rate limited. Retrying after ${retryAfter}s...`)
        await delay(retryAfter * 1000)
        return this.request<T>(endpoint, options, retries - 1)
      }
      throw new PODRateLimitError('printful', 'Rate limit exceeded')
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      let errorCode = `HTTP_${response.status}`
      let message = `${response.status} ${response.statusText}`
      try {
        const parsed = JSON.parse(body)
        errorCode = parsed.code ?? errorCode
        message = parsed.error?.message ?? parsed.message ?? message
      } catch {
        // body is not JSON
      }
      throw new PODProviderError('printful', errorCode, message, response.status)
    }

    const data = (await response.json()) as PrintfulEnvelope<T>

    // Cache catalog responses
    if (isCatalogGet) {
      this.cache.set(endpoint, {
        data,
        expiresAt: Date.now() + CATALOG_TTL_MS,
      })
    }

    return data
  }

  // ---- Convenience Methods ----

  async get<T>(endpoint: string): Promise<PrintfulEnvelope<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    queryParams?: Record<string, string>
  ): Promise<PrintfulEnvelope<T>> {
    const url = queryParams
      ? `${endpoint}?${new URLSearchParams(queryParams).toString()}`
      : endpoint
    return this.request<T>(url, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  async put<T>(endpoint: string, body: unknown): Promise<PrintfulEnvelope<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
  }

  async delete<T = void>(endpoint: string): Promise<PrintfulEnvelope<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  // ---- Cache Management ----

  clearCatalogCache(): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith('/products')) {
        this.cache.delete(key)
      }
    }
  }

  clearAllCache(): void {
    this.cache.clear()
  }

  // ---- Internal Helpers ----

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()

    // Reset window if expired
    if (now - this.rateBucket.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateBucket.count = 0
      this.rateBucket.windowStart = now
    }

    this.rateBucket.count++

    if (this.rateBucket.count > MAX_REQUESTS_PER_WINDOW) {
      // We've exceeded the budget — wait for window to reset
      const waitMs = RATE_LIMIT_WINDOW_MS - (now - this.rateBucket.windowStart) + 100
      console.warn(`[PrintfulClient] Rate limit budget reached. Waiting ${waitMs}ms...`)
      await delay(waitMs)
      this.rateBucket.count = 0
      this.rateBucket.windowStart = Date.now()
    }
  }

  /** Get the webhook secret for signature verification */
  get webhookSecret(): string {
    return this.config.webhookSecret ?? ''
  }
}

// ---- Response Envelope Type ----

export interface PrintfulEnvelope<T> {
  code: number
  result: T
  paging?: {
    total: number
    offset: number
    limit: number
  }
  extra?: unknown
}

// ---- Singleton Factory ----

let _printful: PrintfulClient | undefined

export function getPrintfulClient(): PrintfulClient {
  if (!_printful) {
    const token = process.env.PRINTFUL_API_TOKEN
    const storeId = process.env.PRINTFUL_STORE_ID
    const expiresEnv = process.env.PRINTFUL_TOKEN_EXPIRES_AT

    if (!token) {
      throw new PODProviderError(
        'printful',
        'CONFIG_MISSING',
        'PRINTFUL_API_TOKEN environment variable is not set',
        500
      )
    }

    _printful = new PrintfulClient({
      apiToken: token,
      storeId: storeId,
      tokenExpiresAt: expiresEnv ? new Date(expiresEnv) : undefined,
    })
  }
  return _printful
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

---

## 4. Authentication Handling

### Token Type: Private Token (Store-Level)

For SKAPARA's use case (single store, backend integration), we use a **private store-level token**. This is simpler than OAuth and does not require the `X-PF-Store-Id` header.

**Key difference from Printify:** Printify tokens never expire. Printful private tokens **do expire**. The expiration date is set when the token is generated in the Printful Developer Portal.

### Token Lifecycle

```
Token generated at:       developers.printful.com
Token stored in:          .env.local (PRINTFUL_API_TOKEN)
Token used by:            PrintfulClient constructor
Token expiry tracked by:  PRINTFUL_TOKEN_EXPIRES_AT env var (optional but recommended)
Rotation strategy:        Manual rotation before expiry. Cron job checks expiry weekly.
```

### Expiry Warning Flow

```typescript
// In PrintfulClient constructor (already shown above):
if (config.tokenExpiresAt) {
  const daysUntilExpiry = ...
  if (daysUntilExpiry < 7) {
    console.warn('Token expires soon — rotate at developers.printful.com')
  }
}

// Additionally: add a health-check cron that pings Printful and checks expiry.
// src/app/api/cron/check-printful-health/route.ts
// Schedule: daily (existing Vercel cron infrastructure)
```

### OAuth 2.0 — NOT needed for SKAPARA

OAuth is used for public apps serving multiple Printful merchants. SKAPARA has one store. Private token is the correct choice. If OAuth is needed in the future (e.g., for a multi-tenant admin tool), the client must be extended with a `refreshToken` method:

```typescript
// NOT NEEDED NOW — documented for future reference:
async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch('https://www.printful.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: process.env.PRINTFUL_CLIENT_ID,
      client_secret: process.env.PRINTFUL_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  })
  const data = await response.json()
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}
```

### Required OAuth Scopes (for reference, if store-level token is insufficient)

```
orders           — Create and manage orders (Stripe webhook)
sync_products    — Create, update, delete products (design pipeline, cron sync)
file_library     — Upload design files
webhooks         — Configure webhook events (admin setup)
```

---

## 5. Rate Limiting Strategy

**Printful rate limit:** 120 requests per minute (general). The Mockup Generator has a **stricter, undocumented limit** — treat it as significantly lower.

### Strategy: Token Bucket (implemented in PrintfulClient)

The `rateBucket` counter in `PrintfulClient` tracks requests within the current 60-second window. When the counter exceeds 120, the client waits for the window to reset.

This is an **in-process** rate limiter. It works for single-process deployments (local dev, single Vercel instance). For multi-process environments (multiple Vercel function instances running concurrently), a **distributed rate limiter** backed by Redis is required.

```typescript
// For cron scripts (sequential, single process):
// The in-process rate limiter in PrintfulClient is sufficient.

// For Vercel serverless (concurrent invocations):
// Use Redis-backed rate limiter via rate-limit.ts:
import { rateLimit } from '@/lib/rate-limit'

// Each Vercel invocation checks Redis before making Printful calls.
// Key: 'printful-rate-limit'
// Limit: 100 req/min (conservative — 83% of actual limit)
// Window: 60 seconds
```

### Mockup Generator Rate Limiting

The Mockup Generator is rate-limited more aggressively than documented. Strategy:

- Maximum 1 `create-task` call every 3 seconds.
- Poll `task` endpoint every 4 seconds (not every 1 second).
- Abort after 20 polling attempts (80 seconds max wait).
- For bulk mockup generation (catalog sync), use a queue with sequential processing and 3-second delays between tasks.

```typescript
// In PrintfulClient — mockup-specific delay wrapper:
async createMockupTask(
  productId: number,
  body: PrintfulMockupTaskBody
): Promise<{ taskKey: string }> {
  // Enforce minimum 3-second gap between mockup task creations
  const now = Date.now()
  const elapsed = now - (this._lastMockupTaskAt ?? 0)
  if (elapsed < 3000) {
    await delay(3000 - elapsed)
  }
  this._lastMockupTaskAt = Date.now()

  const raw = await this.post<{ task_key: string }>(
    `/mockup-generator/create-task/${productId}`,
    body
  )
  return { taskKey: raw.result.task_key }
}

private _lastMockupTaskAt = 0
```

---

## 6. Caching Strategy

### Catalog Cache (in-process, 10-minute TTL)

Same TTL as the current Printify client. Catalog data (product list, variant specs) does not change frequently. The cache is stored as a `Map<string, CacheEntry>` in the `PrintfulClient` instance.

| Cached endpoint | TTL | Cache key |
|---|---|---|
| `GET /products` | 10 min | `/products` |
| `GET /products?category_id=...` | 10 min | `/products?category_id=...` |
| `GET /products/{id}` | 10 min | `/products/{id}` |
| `GET /products/variant/{id}` | 10 min | `/products/variant/{id}` |
| `GET /mockup-generator/printfiles/{id}` | 30 min | `/mockup-generator/printfiles/{id}` (longer TTL — printfile specs rarely change) |

**Not cached:**
- `GET /sync_products` (your store products — changes frequently)
- `GET /sync_products/{id}` (live product state)
- `GET /orders/{id}` (order status changes)
- Any `POST`, `PUT`, `DELETE` (mutation — never cache)

### Persistent Cache (Redis)

For the cron sync engine, product data is also cached in Redis (via the existing `product-cache.ts` and `product-detail-cache.ts` infrastructure). The Printful adapter writes to these caches using the same interface. No changes needed to the Redis caching layer — it operates on canonical models, not provider-specific formats.

### Cache Invalidation

Printful supports webhook events for product changes (`product_synced`, `product_updated`, `product_deleted`). The webhook handler should call `client.clearCatalogCache()` when a product update event is received. This is more precise than time-based expiry for sync products, but catalog products (variants, sizes) still use the TTL approach since they rarely change.

---

## 7. Error Handling

### PODProviderError Class

```typescript
// src/lib/pod/errors.ts

export class PODProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: string,
    message: string,
    public readonly httpStatus: number = 500
  ) {
    super(message)
    this.name = 'PODProviderError'
  }

  toJSON() {
    return {
      provider: this.provider,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
    }
  }
}

export class PODRateLimitError extends PODProviderError {
  constructor(provider: string, message = 'Rate limit exceeded') {
    super(provider, 'RATE_LIMIT_EXCEEDED', message, 429)
    this.name = 'PODRateLimitError'
  }
}

export class PODNotFoundError extends PODProviderError {
  constructor(provider: string, resourceType: string, resourceId: string) {
    super(provider, 'NOT_FOUND', `${resourceType} ${resourceId} not found`, 404)
    this.name = 'PODNotFoundError'
  }
}

export class PODAuthError extends PODProviderError {
  constructor(provider: string, message = 'Authentication failed') {
    super(provider, 'AUTH_FAILED', message, 401)
    this.name = 'PODAuthError'
  }
}

export class PODValidationError extends PODProviderError {
  constructor(provider: string, message: string) {
    super(provider, 'VALIDATION_ERROR', message, 400)
    this.name = 'PODValidationError'
  }
}
```

### Printful HTTP Status → PODProviderError Mapping

| HTTP Status | Printful `code` field | Error Class | When It Occurs |
|---|---|---|---|
| `400` | Various | `PODValidationError` | Invalid request body (bad variant ID, missing required field) |
| `401` | `401` | `PODAuthError` | Invalid or expired token |
| `403` | `403` | `PODProviderError` | Insufficient scope (token lacks required permission) |
| `404` | `404` | `PODNotFoundError` | Product/order/file not found |
| `429` | `429` | `PODRateLimitError` | Rate limit exceeded |
| `500` | `500` | `PODProviderError` | Printful internal server error |
| `503` | `503` | `PODProviderError` | Printful service unavailable |

The `PrintfulClient.request()` method (shown above) performs this mapping. Callers catch `PODProviderError` and handle by code:

```typescript
// Example in design pipeline:
try {
  const product = await printfulProvider.createProduct(input)
} catch (error) {
  if (error instanceof PODNotFoundError) {
    // Variant ID doesn't exist in Printful catalog
    return NextResponse.json({ error: 'Invalid variant configuration' }, { status: 400 })
  }
  if (error instanceof PODRateLimitError) {
    // Queue for retry
    await scheduleRetry(input)
    return NextResponse.json({ error: 'Service busy, order queued' }, { status: 202 })
  }
  if (error instanceof PODAuthError) {
    // Alert — token may have expired
    await notifyAdminTokenExpired()
    throw error  // Let Next.js error boundary handle it
  }
  throw error
}
```

### Retry Policy

Retryable errors (client-level, with exponential backoff):
- `429 Too Many Requests` — wait `Retry-After` header seconds, then retry
- `503 Service Unavailable` — retry after 5s, 10s, 20s (3 attempts max)
- Network timeouts — retry after 2s (2 attempts max)

Non-retryable errors (propagate immediately):
- `400 Bad Request` — request is invalid, won't succeed on retry
- `401 Unauthorized` — token issue, needs human intervention
- `403 Forbidden` — scope issue, needs configuration change
- `404 Not Found` — resource doesn't exist

---

## 8. PrintfulMapper — Anti-Corruption Layer

The complete `PrintfulMapper` module translates in both directions:
- **Printful API → Canonical:** `toCanonicalProduct`, `toCanonicalOrder`, `toShippingRate`, etc.
- **Canonical → Printful API:** `fromCanonicalCreateProduct`, `fromCanonicalOrder`, `fromShippingRateInput`, etc.

All transform functions documented in Section 2 are collected here with their TypeScript raw type definitions.

### Raw Printful API Type Definitions

```typescript
// src/lib/pod/printful/types.ts
// These are the EXACT shapes returned by Printful's API.
// They exist only in this file — no business logic ever sees them directly.

// --- Sync Products ---
export interface PrintfulSyncProductSummary {
  id: number
  external_id: string
  name: string
  variants: number       // Count, not array
  synced: number         // Count of synced variants
  thumbnail_url: string | null
  is_ignored: boolean
}

export interface PrintfulSyncVariant {
  id: number
  external_id: string | null
  sync_product_id: number
  name: string
  synced: boolean
  variant_id: number
  retail_price: string | null    // Decimal string e.g. "29.99"
  currency: string
  is_ignored: boolean
  is_enabled: boolean
  sku: string | null
  product: {
    variant_id: number
    product_id: number
    image: string
    name: string
  } | null
  files: PrintfulSyncFile[]
  options: PrintfulOption[]
}

export interface PrintfulSyncFile {
  id: number
  type: string
  hash: string | null
  url: string | null
  filename: string
  mime_type: string
  size: number
  width: number
  height: number
  dpi: number
  status: 'ok' | 'waiting' | 'failed'
  created: number
  thumbnail_url: string
  preview_url: string
  visible: boolean
}

export interface PrintfulOption {
  id: string
  value: string
}

export interface PrintfulGetSyncProductResult {
  sync_product: PrintfulSyncProductSummary
  sync_variants: PrintfulSyncVariant[]
}

// --- Orders ---
export interface PrintfulOrderResult {
  id: number
  external_id: string | null
  store: number
  status: string
  shipping: string
  shipping_service_name: string | null
  created: number       // Unix timestamp
  updated: number       // Unix timestamp
  recipient: PrintfulRecipient
  items: PrintfulOrderItem[]
  costs: PrintfulCosts | null
  retail_costs: PrintfulRetailCosts | null
  shipments: PrintfulShipment[]
  gift: { subject: string; message: string } | null
  packing_slip: unknown
}

export interface PrintfulRecipient {
  name: string
  company: string | null
  address1: string
  address2: string | null
  city: string
  state_code: string | null
  state_name: string | null
  country_code: string
  country_name: string | null
  zip: string
  phone: string | null
  email: string | null
  tax_number: string | null
}

export interface PrintfulOrderItem {
  id: number
  external_id: string | null
  variant_id: number
  sync_variant_id: number | null
  external_variant_id: string | null
  quantity: number
  price: string
  retail_price: string | null
  name: string
  product: { variant_id: number; product_id: number }
  files: PrintfulSyncFile[]
  options: PrintfulOption[]
  discontinued: boolean
  out_of_stock: boolean
}

export interface PrintfulShipment {
  id: number
  carrier: string
  service: string | null
  tracking_number: string
  tracking_url: string
  created: number
  ship_date: string
  shipped_at: number
  reshipment: boolean
  items: unknown[]
}

export interface PrintfulCosts {
  currency: string
  subtotal: string
  discount: string
  shipping: string
  digitization: string
  additional_fee: string
  fulfillment_fee: string
  tax: string
  vat: string
  total: string
}

export interface PrintfulRetailCosts {
  currency: string
  subtotal: string
  discount: string
  shipping: string
  tax: string
  total?: string
}

// --- Catalog ---
export interface PrintfulCatalogProduct {
  id: number
  main_category_id: number
  type: string
  type_name: string
  title: string
  brand: string | null
  model: string | null
  image: string
  variant_count: number
  currency: string
  is_discontinued: boolean
  avg_fulfillment_time: number | null
  origin_country: string | null
  techniques: Array<{ key: string; display_name: string; is_default: boolean }>
  files: Array<{ id: string; type: string; title: string; additional_price: string }>
  options: Array<{
    id: string
    title: string
    type: 'radio' | 'bool' | 'multi_select'
    values: Record<string, string>
    additional_price: string
  }>
}

export interface PrintfulCatalogVariant {
  id: number
  product_id: number
  name: string
  size: string | null
  color: string | null
  color_code: string | null
  color_code2: string | null
  image: string
  price: string
  in_stock: boolean
  availability_regions: Record<string, string>
  availability_status: Array<{ region: string; status: string }>
  material: Array<{ name: string; percentage: number }> | null
}

// --- Files ---
export interface PrintfulFileResult {
  id: number
  type: string
  hash: string | null
  url: string | null
  filename: string
  mime_type: string
  size: number
  width: number | null
  height: number | null
  dpi: number | null
  status: 'ok' | 'waiting' | 'failed'
  created: number
  thumbnail_url: string
  preview_url: string
  visible: boolean
  is_temporary: boolean
}

// --- Shipping ---
export interface PrintfulShippingRate {
  id: string
  name: string
  rate: string             // Decimal string e.g. "3.99"
  currency: string
  minDeliveryDays: number
  maxDeliveryDays: number
  minDeliveryDate: string
  maxDeliveryDate: string
}
```

---

## 9. Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `PRINTFUL_API_TOKEN` | Yes | Private API token from Printful Developer Portal | `eyJhbGciOiJIUzI1NiJ9...` |
| `PRINTFUL_STORE_ID` | Conditional | Store ID — only needed if using account-level token | `12345678` |
| `PRINTFUL_TOKEN_EXPIRES_AT` | Recommended | ISO 8601 date when token expires — enables expiry warnings | `2026-09-01T00:00:00Z` |
| `PRINTFUL_WEBHOOK_SECRET` | Yes (when webhooks configured) | Secret for HMAC webhook signature verification | `wh_secret_abc123` |
| `POD_DEFAULT_PROVIDER` | Yes | Active provider: `printful` or `printify` | `printful` |
| `PRINTIFY_API_TOKEN` | Conditional | Keep during migration for fallback | (existing value) |
| `PRINTIFY_SHOP_ID` | Conditional | Keep during migration for fallback | (existing value) |

**Variables to REMOVE after migration complete:**
- `PRINTIFY_API_TOKEN`
- `PRINTIFY_SHOP_ID`

**Variables to NOT add yet (Printify-specific, being removed):**
- `PRINTIFY_SHOP_ID` is embedded in Printify URLs — no equivalent needed in Printful (store-level token handles it)

---

## 10. Complete File List

All files within the Printful adapter package plus supporting infrastructure files that need to be created or modified.

### New Files — Printful Adapter Package

| File | Purpose | Est. Lines |
|---|---|---|
| `src/lib/pod/printful/types.ts` | Raw Printful API type definitions (PrintfulSyncProductSummary, PrintfulOrderResult, PrintfulCatalogVariant, etc.) | ~250 |
| `src/lib/pod/printful/client.ts` | PrintfulClient HTTP wrapper with caching, rate limiting, error handling, singleton factory | ~200 |
| `src/lib/pod/printful/mapper.ts` | All transform functions: toCanonicalProduct, toCanonicalOrder, fromCanonicalOrder, fromCanonicalCreateProduct, toShippingRate, fromShippingRateInput, toBlueprint, toBlueprintVariant, toUploadedDesign | ~350 |
| `src/lib/pod/printful/index.ts` | PrintfulProvider class implementing PODProvider interface — thin orchestration layer calling client + mapper | ~200 |
| `src/lib/pod/printful/webhook-verifier.ts` | HMAC signature verification for Printful webhooks | ~50 |
| `src/lib/pod/printful/constants.ts` | EU region codes, shipping method strings, rate limit constants, USD→EUR conversion rate | ~40 |

**Subtotal: ~1,090 lines**

### New Files — Shared Infrastructure

| File | Purpose | Est. Lines |
|---|---|---|
| `src/lib/pod/errors.ts` | PODProviderError, PODRateLimitError, PODNotFoundError, PODAuthError, PODValidationError | ~60 |
| `src/lib/pod/types.ts` | Shared interfaces: PODProvider, PODProductProvider, PODOrderProvider, PODDesignProvider, PODCatalogProvider, PODWebhookProvider, all input/output types (CreateProductInput, CreateOrderInput, ShippingRateInput, etc.) | ~300 |
| `src/lib/pod/models/product.ts` | CanonicalProduct, CanonicalVariant, CanonicalImage, CanonicalPrintArea | ~80 |
| `src/lib/pod/models/order.ts` | CanonicalOrder, CanonicalLineItem, CanonicalAddress, CanonicalShipment | ~70 |
| `src/lib/pod/models/catalog.ts` | Blueprint, BlueprintVariant, CatalogFilters, VariantPricing | ~60 |
| `src/lib/pod/models/design.ts` | UploadedDesign, MockupInput, MockupResult, MockupFile | ~50 |
| `src/lib/pod/models/shipping.ts` | ShippingRate, ShippingMethod | ~30 |
| `src/lib/pod/models/webhook.ts` | WebhookEventType, NormalizedWebhookEvent | ~40 |
| `src/lib/pod/provider-registry.ts` | ProviderRegistry singleton with register/get/setDefault/list | ~60 |
| `src/lib/pod/index.ts` | initializeProviders(), getProvider(), getProviderForProduct(), re-exports | ~70 |

**Subtotal: ~820 lines**

### New Files — Printify Adapter (wrap existing client)

| File | Purpose | Est. Lines |
|---|---|---|
| `src/lib/pod/printify/client.ts` | Thin wrapper around existing `src/lib/printify.ts` — adapts to PrintfulClient-style interface | ~80 |
| `src/lib/pod/printify/mapper.ts` | Transform functions for Printify ↔ canonical model (extracted from printify-sync.ts) | ~250 |
| `src/lib/pod/printify/index.ts` | PrintifyProvider class implementing PODProvider | ~150 |
| `src/lib/pod/printify/webhook-verifier.ts` | Move from existing webhooks/printify/route.ts | ~50 |
| `src/lib/pod/printify/constants.ts` | EU_PROVIDER_IDS Set, page limits | ~20 |

**Subtotal: ~550 lines**

### New Files — Webhook Infrastructure

| File | Purpose | Est. Lines |
|---|---|---|
| `src/lib/pod/webhooks/webhook-router.ts` | WebhookRouter class with on()/route() | ~50 |
| `src/lib/pod/webhooks/handlers/order-shipped.ts` | Update order status + tracking in Supabase | ~60 |
| `src/lib/pod/webhooks/handlers/order-failed.ts` | Trigger refund + notify customer | ~80 |
| `src/lib/pod/webhooks/handlers/order-cancelled.ts` | Update order status | ~40 |
| `src/lib/pod/webhooks/handlers/product-updated.ts` | Re-sync product from provider to Supabase | ~60 |
| `src/lib/pod/webhooks/handlers/product-deleted.ts` | Soft-delete product in Supabase | ~40 |
| `src/app/api/webhooks/pod/[provider]/route.ts` | Unified webhook entry point | ~60 |

**Subtotal: ~390 lines**

### Modified Files (Existing)

| File | Change | Est. Delta |
|---|---|---|
| `src/lib/printify.ts` | No change — kept as-is during migration. Wrapped by PrintifyProvider in pod/printify/. | 0 |
| `src/lib/store-config.ts` | Replace `isEUProvider()` with `isEUAvailableVariant()` using Printful availability check | ~+20 |
| `src/app/api/webhooks/printify/route.ts` | Keep during migration. After cutover, this route is retired (replaced by `pod/[provider]/route.ts`) | 0 (then delete) |
| `src/app/api/webhooks/stripe/route.ts` | Change `printify.createOrder()` → `getProvider().createOrder()` | ~-5 / +5 |
| `src/app/api/cron/sync-printify/route.ts` | Rename → `sync-products`. Change to use `getProvider().listProducts()` | ~-20 / +20 |
| `src/app/api/designs/[id]/create-product/route.ts` | Remove `publishProduct()`/`publishingSucceeded()` guard for Printful (no-ops OK) | ~-10 |

### Test Files (Required)

| File | Purpose | Est. Lines |
|---|---|---|
| `src/lib/pod/testing/mock-provider.ts` | InMemoryProvider — implements PODProvider with in-memory storage for unit tests | ~200 |
| `src/lib/pod/testing/fixtures/products.ts` | Sample canonical products and raw Printful API responses | ~150 |
| `src/lib/pod/testing/fixtures/orders.ts` | Sample canonical orders and raw Printful API responses | ~100 |
| `src/__tests__/pod/printful/mapper.test.ts` | Unit tests for all mapper transform functions | ~300 |
| `src/__tests__/pod/printful/client.test.ts` | Unit tests for rate limiting, caching, retry logic | ~200 |
| `src/__tests__/pod/printful/webhook-verifier.test.ts` | Unit tests for webhook signature verification | ~80 |

**Test subtotal: ~1,030 lines**

---

**Grand total new/modified lines: ~3,880**

---

## 11. Implementation Order and Effort Estimates

### Phase 1 — Types and Infrastructure (No API calls yet)

Implement the shared type system and error hierarchy. Nothing runs yet — pure TypeScript compilation.

| Task | File(s) | Effort | Blocked by |
|---|---|---|---|
| 1.1 Define canonical models | `src/lib/pod/models/*.ts` | 2h | Nothing |
| 1.2 Define shared interfaces (PODProvider, all Input/Output types) | `src/lib/pod/types.ts` | 3h | 1.1 |
| 1.3 Define error classes | `src/lib/pod/errors.ts` | 1h | Nothing |
| 1.4 Define Printful raw API types | `src/lib/pod/printful/types.ts` | 3h | Nothing |
| 1.5 Define Printful constants | `src/lib/pod/printful/constants.ts` | 1h | Nothing |

**Phase 1 total: ~10h**

---

### Phase 2 — PrintfulClient (HTTP wrapper, no mapper yet)

Implement the HTTP layer. Can be smoke-tested against the live Printful API with a sandbox token.

| Task | File(s) | Effort | Blocked by |
|---|---|---|---|
| 2.1 Implement PrintfulClient with request(), get(), post(), put(), delete() | `client.ts` | 4h | Phase 1 |
| 2.2 Add in-process rate limiter (token bucket) | `client.ts` | 2h | 2.1 |
| 2.3 Add catalog cache (Map + TTL) | `client.ts` | 1h | 2.1 |
| 2.4 Add error mapping (HTTP status → PODProviderError) | `client.ts` | 2h | 2.1, 1.3 |
| 2.5 Add retry logic (429, 503, timeout) | `client.ts` | 2h | 2.1, 2.4 |
| 2.6 Add token expiry warning | `client.ts` | 1h | 2.1 |
| 2.7 Add singleton factory (getPrintfulClient) | `client.ts` | 0.5h | 2.1 |
| 2.8 Unit tests for rate limiting and caching | `client.test.ts` | 3h | 2.1–2.7 |

**Phase 2 total: ~15.5h**

---

### Phase 3 — PrintfulMapper (All transforms)

Implement all transform functions. Pure functions — no HTTP calls, highly testable.

| Task | File(s) | Effort | Blocked by |
|---|---|---|---|
| 3.1 Product transforms: toCanonicalProduct, extractImagesFromSyncVariants, parsePrintfulVariantName | `mapper.ts` | 4h | Phase 1 |
| 3.2 Product create transform: fromCanonicalCreateProduct, mapPositionToPlacement | `mapper.ts` | 3h | 3.1 |
| 3.3 Order transforms: fromCanonicalOrder, toCanonicalOrder, mapPrintfulOrderStatus | `mapper.ts` | 4h | Phase 1 |
| 3.4 Catalog transforms: toBlueprint, toBlueprintVariant, isEUAvailable | `mapper.ts` | 2h | Phase 1 |
| 3.5 File/design transforms: toUploadedDesign | `mapper.ts` | 1h | Phase 1 |
| 3.6 Shipping transforms: fromShippingRateInput, toShippingRate | `mapper.ts` | 1.5h | Phase 1 |
| 3.7 Webhook event mapping: toNormalizedEvent, PRINTFUL_EVENT_MAP | `mapper.ts` | 2h | Phase 1 |
| 3.8 List pagination transform: toListResult | `mapper.ts` | 1h | 3.1 |
| 3.9 Unit tests for all mapper functions (including edge cases: null fields, empty variants, unknown statuses) | `mapper.test.ts` | 5h | 3.1–3.8 |

**Phase 3 total: ~23.5h**

---

### Phase 4 — PrintfulProvider Class

Assemble the provider by wiring client + mapper. Implement all PODProvider interface methods.

| Task | File(s) | Effort | Blocked by |
|---|---|---|---|
| 4.1 Implement product methods: createProduct, getProduct, listProducts, updateProduct, deleteProduct | `index.ts` | 4h | Phase 2, 3 |
| 4.2 Implement no-op publish methods: publishProduct, publishingSucceeded, publishingFailed | `index.ts` | 0.5h | 4.1 |
| 4.3 Implement order methods: createOrder, submitForProduction, cancelOrder, getOrder | `index.ts` | 3h | Phase 2, 3 |
| 4.4 Implement file methods: uploadDesign (URL + base64 paths), uploadImageAndWait | `index.ts` | 2h | Phase 2, 3 |
| 4.5 Implement catalog methods: getBlueprints, getBlueprintVariants, getVariantPricing | `index.ts` | 2h | Phase 2, 3 |
| 4.6 Implement shipping: getShippingRates | `index.ts` | 1h | Phase 2, 3 |
| 4.7 Implement mockup methods: generateMockup, getMockupStatus (with polling) | `index.ts` | 3h | Phase 2, 3 |
| 4.8 Implement webhook methods: verifyWebhook, normalizeEvent, getRegisteredEvents | `index.ts`, `webhook-verifier.ts` | 2h | Phase 3 |
| 4.9 Implement healthCheck | `index.ts` | 0.5h | Phase 2 |

**Phase 4 total: ~18h**

---

### Phase 5 — Provider Registry and Initialization

Wire up the registry and factory so callers can use `getProvider()` instead of importing PrintifyClient directly.

| Task | File(s) | Effort | Blocked by |
|---|---|---|---|
| 5.1 Implement ProviderRegistry | `provider-registry.ts` | 2h | Phase 1 |
| 5.2 Implement PrintifyProvider wrapper (wraps existing printify.ts) | `pod/printify/*.ts` | 6h | Phase 1, 2, 3 |
| 5.3 Implement initializeProviders() and pod/index.ts | `pod/index.ts` | 2h | 5.1, 4.x, 5.2 |
| 5.4 Add POD_DEFAULT_PROVIDER env var support | `pod/index.ts` | 0.5h | 5.3 |

**Phase 5 total: ~10.5h**

---

### Phase 6 — Webhook Infrastructure

| Task | File(s) | Effort | Blocked by |
|---|---|---|---|
| 6.1 Implement WebhookRouter | `webhooks/webhook-router.ts` | 2h | Phase 1 |
| 6.2 Implement event handlers (5 handlers) | `webhooks/handlers/*.ts` | 6h | 6.1 |
| 6.3 Implement unified webhook API route | `api/webhooks/pod/[provider]/route.ts` | 2h | 5.3, 6.1, 6.2 |
| 6.4 Write webhook handler tests | `__tests__/pod/` | 3h | 6.1–6.3 |

**Phase 6 total: ~13h**

---

### Summary Table

| Phase | Description | Effort | Cumulative |
|---|---|---|---|
| 1 | Types and infrastructure | 10h | 10h |
| 2 | PrintfulClient HTTP wrapper | 15.5h | 25.5h |
| 3 | PrintfulMapper transforms | 23.5h | 49h |
| 4 | PrintfulProvider class | 18h | 67h |
| 5 | Provider registry + Printify wrapper | 10.5h | 77.5h |
| 6 | Webhook infrastructure | 13h | 90.5h |

**Total estimated implementation effort: ~90.5 hours (approximately 11 engineering days)**

This does NOT include:
- Section 3: Printify sync cron → provider-agnostic sync engine migration
- Section 4: Caller migration (Stripe webhook, checkout, design pipeline)
- Section 5: Data migration (existing products from Printify → Printful)
- Section 6: Testing against live Printful sandbox
- Section 7: Cutover and rollback plan

---

## Appendix A — Complete Method Reference Table

| PrintifyClient Method | Printful Endpoint | Method Change | Request Body Change | Response Change | No-op? |
|---|---|---|---|---|---|
| `createProduct(data)` | `POST /sync_products` | POST path changes | Blueprint+provider+print_areas → sync_product+sync_variants with file URLs | Unwrap `.result.sync_product` | No |
| `getProduct(id)` | `GET /sync_products/{id}` | Path changes | N/A | Unwrap `.result`, different schema | No |
| `listProducts(page, limit)` | `GET /sync_products?offset=...&limit=...` | Query param changes | N/A | Summary only (no variants), unwrap `.result` | No |
| `createOrder(data)` | `POST /orders?confirm=true` | Path + query change | `address_to` → `recipient`, `shipping_method:1` → `shipping:"STANDARD"`, `line_items[].product_id` removed | Unwrap `.result`, status strings differ | No |
| `getOrder(id)` | `GET /orders/{id}` | Path changes | N/A | Unwrap `.result`, Unix timestamps | No |
| `submitOrderForProduction(id)` | `POST /orders/{id}/confirm` | Action name changes | None | Unwrap `.result` | No (but redundant if `?confirm=true` used) |
| `cancelOrder(id)` | `DELETE /orders/{id}` | `POST .../cancel` → `DELETE` | None | Unwrap `.result` | No |
| `uploadImage(url, name)` | `POST /files` with `{ url, filename }` | Path changes | Simpler body | Unwrap `.result`, status field | No |
| `uploadImageFromBase64(b64, name)` | `POST /files` with `{ file: "data:image/png;base64,..." }` | Path changes, no Cloudflare workaround | data URI format instead of raw base64 | Same as above | No |
| `publishProduct(id)` | N/A | — | — | — | **YES** |
| `publishingSucceeded(id, extId)` | N/A | — | — | — | **YES** |
| `publishingFailed(id, reason)` | N/A | — | — | — | **YES** |
| `deleteProduct(id)` | `DELETE /sync_products/{id}` | Path changes | None | Unwrap `.result` | No |
| `getBlueprints()` | `GET /products` | Path changes, no auth needed | N/A | Unwrap `.result`, richer schema | No |
| `getProviders(blueprintId)` | N/A | — | — | — | **YES** (EU check moves to variant level) |
| `getVariants(bpId, pvId)` | `GET /products/{id}` | Path changes, no providerId | N/A | Different schema, includes availability_status | No |
| `calculateShipping(items, addr)` | `POST /shipping/rates` | Path changes | `line_items` → `items` (variant_id only), `address_to` → `recipient` | Rate is string decimal, includes delivery dates | No |

**Methods with no-op Printful equivalent: 4 out of 16 (publishProduct, publishingSucceeded, publishingFailed, getProviders)**

---

## Appendix B — EU Availability: Guard Logic Migration

The current EU guard in `store-config.ts`:

```typescript
// CURRENT — Printify-based:
const EU_APPROVED_PROVIDERS = new Set([26, 410, 90, 23, 30, 255, 86])
export function isEUProvider(providerId: number): boolean {
  return EU_APPROVED_PROVIDERS.has(providerId)
}
```

The replacement for Printful-based product creation:

```typescript
// NEW — Printful variant-level check:
// In src/lib/pod/printful/mapper.ts:
export function isEUAvailable(variant: PrintfulCatalogVariant): boolean {
  return (variant.availability_status ?? []).some(
    s => s.region === 'EU' && s.status === 'in_stock'
  )
}

// Usage in create-product route (replaces the isEUProvider guard):
const euVariants = catalogVariants.filter(isEUAvailable)
if (euVariants.length === 0) {
  return NextResponse.json(
    { error: 'No EU-available variants for this product configuration' },
    { status: 400 }
  )
}
```

The old `isEUProvider()` function stays in `store-config.ts` and continues to be used for any Printify-backed products during the migration period. It is removed only after all products have been migrated to Printful.

---

*End of Section 2 — Printful Adapter Implementation*
