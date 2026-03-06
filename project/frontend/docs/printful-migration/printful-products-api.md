# Printful API — Products API (Sync Products)

**Source:** https://developers.printful.com/docs/#tag/Products-API
**Fetched:** 2026-03-02

---

## Overview

The Products API manages **Sync Products** — items in your Printful store that map to catalog variants for fulfillment. This is the equivalent of Printify's product management (create product → add to shop).

**Authentication:** Required (Bearer token)
**Required Scope:** `sync_products` (read+write) or `sync_products/read` (read only)
**Rate limit:** 120 requests per minute (general)

> **Key Concept:** A Sync Product is YOUR store product. It contains one or more Sync Variants, each of which maps to a Printful Catalog Variant ID plus your design files.

---

## Endpoints

### 1. GET /sync_products — List Sync Products

**URL:** `GET https://api.printful.com/sync_products`

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter by status: `all`, `synced`, `unsynced`, `imported`, `exporting` |
| `search` | string | Search by product name |
| `offset` | integer | Pagination offset (default: 0) |
| `limit` | integer | Items per page (default: 20, max: 100) |

**Example Request:**
```bash
curl 'https://api.printful.com/sync_products?limit=100&offset=0' \
  --header 'Authorization: Bearer {token}'
```

**Response:**
```json
{
  "code": 200,
  "result": [
    {
      "id": 123456,
      "external_id": "your-internal-id",
      "name": "My Awesome T-Shirt",
      "variants": 4,
      "synced": 4,
      "thumbnail_url": "https://files.cdn.printful.com/...",
      "is_ignored": false
    }
  ],
  "paging": {
    "total": 50,
    "offset": 0,
    "limit": 100
  }
}
```

---

### 2. POST /sync_products — Create Sync Product

**URL:** `POST https://api.printful.com/sync_products`

**Request Body:**
```json
{
  "sync_product": {
    "external_id": "your-sku-123",
    "name": "SKAPARA Ghost Tee",
    "thumbnail": "https://your-store.com/preview.png"
  },
  "sync_variants": [
    {
      "external_id": "your-variant-123-black-m",
      "variant_id": 4011,
      "retail_price": "29.99",
      "is_enabled": true,
      "files": [
        {
          "placement": "front",
          "image_url": "https://your-cdn.com/design-front.png",
          "position": {
            "area_width": 1800,
            "area_height": 2400,
            "width": 1200,
            "height": 1200,
            "top": 600,
            "left": 300
          }
        },
        {
          "placement": "back",
          "image_url": "https://your-cdn.com/design-back.png"
        }
      ],
      "options": [
        {
          "id": "embroidery_type",
          "value": "flat"
        }
      ]
    }
  ]
}
```

**sync_product Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `external_id` | string | No | Your internal product ID |
| `name` | string | Yes | Product display name |
| `thumbnail` | string | No | Thumbnail image URL |

**sync_variants Array — Each Item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `external_id` | string | No | Your internal variant ID |
| `variant_id` | integer | Yes | Printful Catalog Variant ID |
| `retail_price` | string | No | Price shown to customers |
| `is_enabled` | boolean | No | Whether variant is active (default: true) |
| `files` | array | Yes | Print file placements (see below) |
| `options` | array | No | Customization options (embroidery type, etc.) |

**files Array — Each Item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `placement` | string | Yes | Print area (`front`, `back`, `sleeve_left`, etc.) |
| `image_url` | string | Yes | Public URL to print file (PNG/PDF recommended) |
| `position` | object | No | Position/sizing within print area (see below) |

**position Object:**

| Field | Type | Description |
|---|---|---|
| `area_width` | integer | Width of the printable area in pixels |
| `area_height` | integer | Height of the printable area in pixels |
| `width` | integer | Design width in pixels |
| `height` | integer | Design height in pixels |
| `top` | integer | Top offset from area top |
| `left` | integer | Left offset from area left |

**Response (created SyncProduct):**
```json
{
  "code": 200,
  "result": {
    "sync_product": {
      "id": 123456,
      "external_id": "your-sku-123",
      "name": "SKAPARA Ghost Tee",
      "variants": 2,
      "synced": 2,
      "thumbnail_url": "...",
      "is_ignored": false
    },
    "sync_variants": [ ... ]
  }
}
```

---

### 3. GET /sync_products/{id} — Get Sync Product

**URL:** `GET https://api.printful.com/sync_products/{id}`

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer or string | Sync Product ID, or `@{external_id}` for external ID lookup |

> Use `@` prefix to look up by your external ID: `/sync_products/@your-sku-123`

**Response:**
```json
{
  "code": 200,
  "result": {
    "sync_product": { ...SyncProduct object... },
    "sync_variants": [
      {
        "id": 789012,
        "external_id": "your-variant-123-black-m",
        "sync_product_id": 123456,
        "name": "SKAPARA Ghost Tee Black / M",
        "synced": true,
        "variant_id": 4011,
        "retail_price": "29.99",
        "currency": "USD",
        "is_ignored": false,
        "is_enabled": true,
        "product": {
          "variant_id": 4011,
          "product_id": 71,
          "image": "https://...",
          "name": "Bella + Canvas 3001 Unisex Jersey Short Sleeve Tee (Black / M)"
        },
        "files": [
          {
            "id": 98765,
            "type": "front",
            "hash": "abc123",
            "url": null,
            "filename": "design-front.png",
            "mime_type": "image/png",
            "size": 1024000,
            "width": 4500,
            "height": 5400,
            "dpi": 300,
            "status": "ok",
            "created": 1677700000,
            "thumbnail_url": "https://...",
            "preview_url": "https://...",
            "visible": true
          }
        ],
        "options": [ ... ]
      }
    ]
  }
}
```

---

### 4. PUT /sync_products/{id} — Modify Sync Product

**URL:** `PUT https://api.printful.com/sync_products/{id}`

Updates a sync product's metadata. Use this to rename a product or update its thumbnail.

**Request Body:**
```json
{
  "sync_product": {
    "name": "Updated Product Name",
    "thumbnail": "https://your-cdn.com/new-thumbnail.png"
  }
}
```

---

### 5. DELETE /sync_products/{id} — Delete Sync Product

**URL:** `DELETE https://api.printful.com/sync_products/{id}`

Permanently deletes a sync product and all its variants.

**Response:**
```json
{
  "code": 200,
  "result": {
    "id": 123456
  }
}
```

---

### 6. GET /sync_products/{id}/variants/{variant_id} — Get Sync Variant

**URL:** `GET https://api.printful.com/sync_products/{id}/variants/{variant_id}`

Retrieves a single sync variant.

---

### 7. POST /sync_products/{id}/variants — Create Sync Variant

**URL:** `POST https://api.printful.com/sync_products/{id}/variants`

Adds a new variant to an existing sync product.

**Request Body:** Same structure as a single item from `sync_variants` array in POST /sync_products.

---

### 8. PUT /sync_products/{id}/variants/{variant_id} — Modify Sync Variant

**URL:** `PUT https://api.printful.com/sync_products/{id}/variants/{variant_id}`

Updates a specific variant's files, price, or options.

**Request Body:**
```json
{
  "sync_variant": {
    "retail_price": "34.99",
    "is_enabled": true,
    "variant_id": 4011,
    "files": [ ... ],
    "options": [ ... ]
  }
}
```

---

### 9. DELETE /sync_products/{id}/variants/{variant_id} — Delete Sync Variant

**URL:** `DELETE https://api.printful.com/sync_products/{id}/variants/{variant_id}`

Removes a specific variant from a sync product.

---

## SyncProduct Object Schema

| Field | Type | Description |
|---|---|---|
| `id` | integer | Printful internal sync product ID |
| `external_id` | string | Your store's product ID |
| `name` | string | Product display name |
| `variants` | integer | Total number of variants |
| `synced` | integer | Number of synced/active variants |
| `thumbnail_url` | string | Product thumbnail URL |
| `is_ignored` | boolean | Whether product is ignored in sync |

## SyncVariant Object Schema

| Field | Type | Description |
|---|---|---|
| `id` | integer | Printful internal sync variant ID |
| `external_id` | string | Your store's variant ID |
| `sync_product_id` | integer | Parent sync product ID |
| `name` | string | Full variant name |
| `synced` | boolean | Whether variant is fully configured |
| `variant_id` | integer | Printful catalog variant ID |
| `retail_price` | string | Customer-facing price |
| `currency` | string | Currency code |
| `is_ignored` | boolean | Whether variant is ignored |
| `is_enabled` | boolean | Whether variant is active |
| `product` | object | Brief catalog product info |
| `files` | array | Configured print files |
| `options` | array | Applied options |

---

## Migration Notes: Printify vs Printful Products API

| Concept | Printify | Printful |
|---|---|---|
| Create product endpoint | `POST /v1/shops/{id}/products.json` | `POST /sync_products` |
| Variants linked by | Blueprint ID + Print Provider ID + variant IDs | Catalog Variant ID only |
| Design files | Uploaded separately, referenced by image ID | Referenced by URL or file ID |
| Publish step needed? | Yes — `POST .../publish.json` required | No separate publish step — synced immediately |
| External ID support | Yes | Yes — `@external_id` lookup |
| Sync concept | No equivalent (Printify is direct) | Sync Products separate from catalog |
| Price in Printify AND DB | Must update both | Set `retail_price` on sync variant |

### Key Difference: No Separate Publish Step

With Printify, you must:
1. Create product
2. Publish product
3. Handle `publishing_succeeded` webhook
4. Update external ID

With Printful, creating a sync product immediately makes it available. No separate publish call needed.

### File URL Requirements

- Files must be publicly accessible URLs (Printful fetches them on their end)
- Use Printful's File Library API (`POST /files`) to upload files first for better reliability
- Supported formats: PNG, PDF, JPEG, SVG
- Recommended: PNG at 150+ DPI minimum (300 DPI preferred)

### External ID Lookup

Printful supports `@` prefix for external ID lookup — useful for avoiding ID mapping:
```bash
GET /sync_products/@your-internal-product-id
```
This enables direct lookup without storing Printful's internal IDs in your database.
