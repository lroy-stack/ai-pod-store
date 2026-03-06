# Printful API — Sync Variants

**Base URL:** `https://api.printful.com`  
**Authentication:** Bearer token via `Authorization` header  
**Rate Limit:** 120 requests/minute

---

## Overview

Sync Variants are the individual SKUs within a Sync Product. Each variant maps:
- A Printful Catalog `variant_id` (determines blank product, size, color)
- One or more design files via the `files` array
- A `retail_price` (what customers pay)

Variants also exist in the **Ecommerce Platform Sync API** for external platform integrations (Shopify, WooCommerce, etc.).

---

## Sync Variant Object — Full Structure

```json
{
  "code": 200,
  "result": {
    "id": 10,
    "external_id": "12312414",
    "sync_product_id": 71,
    "name": "Red T-Shirt",
    "synced": true,
    "variant_id": 3001,
    "retail_price": "29.99",
    "currency": "USD",
    "is_ignored": true,
    "sku": "SKU1234",
    "product": {
      "variant_id": 3001,
      "product_id": 301,
      "image": "https://files.cdn.printful.com/products/71/5309_1581412541.jpg",
      "name": "Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt with Tear Away Label (White / 4XL)"
    },
    "files": [
      {
        "type": "default",
        "id": 10,
        "url": "\u200bhttps://www.example.com/files/tshirts/example.png",
        "options": [
          {
            "id": "template_type",
            "value": "native"
          }
        ],
        "hash": "ea44330b887dfec278dbc4626a759547",
        "filename": "shirt1.png",
        "mime_type": "image/png",
        "size": 45582633,
        "width": 1000,
        "height": 1000,
        "dpi": 300,
        "status": "ok",
        "created": 1590051937,
        "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
        "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
        "visible": true,
        "is_temporary": false,
        "stitch_count_tier": "stitch_tier_1"
      }
    ],
    "options": [
      {
        "id": "embroidery_type",
        "value": "flat"
      }
    ],
    "main_category_id": 24,
    "warehouse_product_id": 3002,
    "warehouse_product_variant_id": 3002,
    "size": "XS",
    "color": "White",
    "availability_status": "active"
  }
}
```

---

## Endpoints

### GET /store/variants/{id} — Get Sync Variant

Returns information about a specific Sync Variant.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer/string | Sync Variant ID or `@{external_id}` |

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "id": 10,
    "external_id": "12312414",
    "sync_product_id": 71,
    "name": "Red T-Shirt",
    "synced": true,
    "variant_id": 3001,
    "retail_price": "29.99",
    "currency": "USD",
    "is_ignored": true,
    "sku": "SKU1234",
    "product": {
      "variant_id": 3001,
      "product_id": 301,
      "image": "https://files.cdn.printful.com/products/71/5309_1581412541.jpg",
      "name": "Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt with Tear Away Label (White / 4XL)"
    },
    "files": [
      {
        "type": "default",
        "id": 10,
        "url": "\u200bhttps://www.example.com/files/tshirts/example.png",
        "options": [
          {
            "id": "template_type",
            "value": "native"
          }
        ],
        "hash": "ea44330b887dfec278dbc4626a759547",
        "filename": "shirt1.png",
        "mime_type": "image/png",
        "size": 45582633,
        "width": 1000,
        "height": 1000,
        "dpi": 300,
        "status": "ok",
        "created": 1590051937,
        "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
        "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
        "visible": true,
        "is_temporary": false,
        "stitch_count_tier": "stitch_tier_1"
      }
    ],
    "options": [
      {
        "id": "embroidery_type",
        "value": "flat"
      }
    ],
    "main_category_id": 24,
    "warehouse_product_id": 3002,
    "warehouse_product_variant_id": 3002,
    "size": "XS",
    "color": "White",
    "availability_status": "active"
  }
}
```

---

### DELETE /store/variants/{id} — Delete Sync Variant

Deletes a Sync Variant. The Sync Product must have at least one remaining variant.

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "id": 10,
    "external_id": "12312414",
    "sync_product_id": 71,
    "variant_id": 3001,
    "retail_price": "29.99",
    "synced": true
  }
}
```

---

### PUT /store/variants/{id} — Update Sync Variant

Modifies a specific Sync Variant. Send only the fields you want to change.

**Request Body:**

```json
{
  "external_id": "12312414",
  "variant_id": 3001,
  "retail_price": "29.99",
  "is_ignored": true,
  "sku": "SKU1234",
  "files": [
    {
      "type": "default",
      "url": "\u200bhttps://www.example.com/files/tshirts/example.png",
      "options": [
        {
          "id": "template_type",
          "value": "native"
        }
      ],
      "filename": "shirt1.png",
      "visible": true
    }
  ],
  "options": [
    {
      "id": "embroidery_type",
      "value": "flat"
    }
  ],
  "availability_status": "active"
}
```

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "id": 10,
    "external_id": "12312414",
    "sync_product_id": 71,
    "name": "Red T-Shirt",
    "synced": true,
    "variant_id": 3001,
    "retail_price": "29.99",
    "currency": "USD",
    "is_ignored": true,
    "sku": "SKU1234",
    "product": {
      "variant_id": 3001,
      "product_id": 301,
      "image": "https://files.cdn.printful.com/products/71/5309_1581412541.jpg",
      "name": "Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt with Tear Away Label (White / 4XL)"
    },
    "files": [
      {
        "type": "default",
        "id": 10,
        "url": "\u200bhttps://www.example.com/files/tshirts/example.png",
        "options": [
          {
            "id": "template_type",
            "value": "native"
          }
        ],
        "hash": "ea44330b887dfec278dbc4626a759547",
        "filename": "shirt1.png",
        "mime_type": "image/png",
        "size": 45582633,
        "width": 1000,
        "height": 1000,
        "dpi": 300,
        "status": "ok",
        "created": 1590051937,
        "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
        "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
        "visible": true,
        "is_temporary": false,
        "stitch_count_tier": "stitch_tier_1"
      }
    ],
    "options": [
      {
        "id": "embroidery_type",
        "value": "flat"
      }
    ],
    "main_category_id": 24,
    "warehouse_product_id": 3002,
    "warehouse_product_variant_id": 3002,
    "size": "XS",
    "color": "White",
    "availability_status": "active"
  }
}
```

---

### POST /store/products/{product_id}/variants — Create Sync Variant

Adds a new Sync Variant to an existing Sync Product.

**Required Fields:**
- `variant_id` — Printful Catalog variant ID
- `files` — array with at least one file (must include `type` and `url`)
- `retail_price` — price string (e.g., `"29.99"`)

**Request Body:**

```json
{
  "variant_id": 3001,
  "retail_price": "29.99",
  "sku": "MY-SKU-001",
  "is_ignored": false,
  "files": [
    {
      "type": "default",
      "url": "https://example.com/design-front.png"
    },
    {
      "type": "back",
      "url": "https://example.com/design-back.png"
    }
  ],
  "options": []
}
```

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "id": 10,
    "external_id": "12312414",
    "sync_product_id": 71,
    "name": "Red T-Shirt",
    "synced": true,
    "variant_id": 3001,
    "retail_price": "29.99",
    "currency": "USD",
    "is_ignored": true,
    "sku": "SKU1234",
    "product": {
      "variant_id": 3001,
      "product_id": 301,
      "image": "https://files.cdn.printful.com/products/71/5309_1581412541.jpg",
      "name": "Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt with Tear Away Label (White / 4XL)"
    },
    "files": [
      {
        "type": "default",
        "id": 10,
        "url": "\u200bhttps://www.example.com/files/tshirts/example.png",
        "options": [
          {
            "id": "template_type",
            "value": "native"
          }
        ],
        "hash": "ea44330b887dfec278dbc4626a759547",
        "filename": "shirt1.png",
        "mime_type": "image/png",
        "size": 45582633,
        "width": 1000,
        "height": 1000,
        "dpi": 300,
        "status": "ok",
        "created": 1590051937,
        "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
        "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
        "visible": true,
        "is_temporary": false,
        "stitch_count_tier": "stitch_tier_1"
      }
    ],
    "options": [
      {
        "id": "embroidery_type",
        "value": "flat"
      }
    ],
    "main_category_id": 24,
    "warehouse_product_id": 3002,
    "warehouse_product_variant_id": 3002,
    "size": "XS",
    "color": "White",
    "availability_status": "active"
  }
}
```

---

## Files Array — File Types for Variants

Each file in the `files` array specifies a print placement:

```json
{
  "files": [
    {
      "type": "default",
      "url": "https://example.com/front.png",
      "position": {
        "area_width": 1800,
        "area_height": 2400,
        "width": 1800,
        "height": 1800,
        "top": 300,
        "left": 0
      }
    }
  ]
}
```

### File Object Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Placement type. See values below |
| `url` | string | Yes* | Publicly accessible URL to the print file |
| `id` | integer | Yes* | File ID from File Library (alternative to `url`) |
| `position` | object | No | Custom positioning override |

*Either `url` or `id` is required.

### Placement Type Values

| `type` | Description |
|--------|-------------|
| `default` | Front print (primary placement) |
| `back` | Back print |
| `label_outside` | Outside neck label |
| `label_inside` | Inside neck label |
| `sleeve_left` | Left sleeve |
| `sleeve_right` | Right sleeve |
| `embroidery_front` | Front embroidery |
| `embroidery_back` | Back embroidery |
| `embroidery_left` | Left embroidery |
| `embroidery_right` | Right embroidery |

---

## Ecommerce Platform Sync API

For stores connected to external platforms (Shopify, WooCommerce, Etsy, etc.), use these endpoints to manage synced product variants.

### GET /sync/products — Get Store Sync Products

```json
{
  "code": 200,
  "paging": {
    "total": 100,
    "offset": 10,
    "limit": 100
  },
  "result": [
    {
      "id": 13,
      "external_id": "4235234213",
      "name": "T-shirt",
      "variants": 10,
      "synced": 10,
      "thumbnail_url": "\u200bhttps://your-domain.com/path/to/image.png",
      "is_ignored": true
    }
  ]
}
```

### GET /sync/products/{id} — Get Store Sync Product

Returns the Sync Product along with all its Sync Variants.

```json
{
  "code": 200,
  "result": {
    "sync_product": {
      "id": 13,
      "external_id": "4235234213",
      "name": "T-shirt",
      "variants": 10,
      "synced": 10,
      "thumbnail_url": "\u200bhttps://your-domain.com/path/to/image.png",
      "is_ignored": true
    },
    "sync_variants": [
      {
        "id": 10,
        "external_id": "12312414",
        "sync_product_id": 71,
        "name": "Red T-Shirt",
        "synced": true,
        "variant_id": 3001,
        "retail_price": "29.99",
        "currency": "USD",
        "is_ignored": true,
        "sku": "SKU1234",
        "product": {
          "variant_id": 3001,
          "product_id": 301,
          "image": "https://files.cdn.printful.com/products/71/5309_1581412541.jpg",
          "name": "Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt with Tear Away Label (White / 4XL)"
        },
        "files": [
          {
            "type": "default",
            "id": 10,
            "url": "\u200bhttps://www.example.com/files/tshirts/example.png",
            "options": [
              {
                "id": "template_type",
                "value": "native"
              }
            ],
            "hash": "ea44330b887dfec278dbc4626a759547",
            "filename": "shirt1.png",
            "mime_type": "image/png",
            "size": 45582633,
            "width": 1000,
            "height": 1000,
            "dpi": 300,
            "status": "ok",
            "created": 1590051937,
            "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
            "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
            "visible": true,
            "is_temporary": false,
            "stitch_count_tier": "stitch_tier_1"
          }
        ],
        "options": [
          {
            "id": "embroidery_type",
            "value": "flat"
          }
        ],
        "main_category_id": 24,
        "warehouse_product_id": 3002,
        "warehouse_product_variant_id": 3002,
        "size": "XS",
        "color": "White",
        "availability_status": "active"
      }
    ]
  }
}
```

### GET /sync/variants/{id} — Get Store Sync Variant

```json
{
  "code": 200,
  "result": {
    "sync_variant": {
      "id": 10,
      "external_id": "12312414",
      "sync_product_id": 71,
      "name": "Red T-Shirt",
      "synced": true,
      "variant_id": 3001,
      "retail_price": "29.99",
      "currency": "USD",
      "is_ignored": true,
      "sku": "SKU1234",
      "product": {
        "variant_id": 3001,
        "product_id": 301,
        "image": "https://files.cdn.printful.com/products/71/5309_1581412541.jpg",
        "name": "Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt with Tear Away Label (White / 4XL)"
      },
      "files": [
        {
          "type": "default",
          "id": 10,
          "url": "\u200bhttps://www.example.com/files/tshirts/example.png",
          "options": [
            {
              "id": "template_type",
              "value": "native"
            }
          ],
          "hash": "ea44330b887dfec278dbc4626a759547",
          "filename": "shirt1.png",
          "mime_type": "image/png",
          "size": 45582633,
          "width": 1000,
          "height": 1000,
          "dpi": 300,
          "status": "ok",
          "created": 1590051937,
          "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
          "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
          "visible": true,
          "is_temporary": false,
          "stitch_count_tier": "stitch_tier_1"
        }
      ],
      "options": [
        {
          "id": "embroidery_type",
          "value": "flat"
        }
      ],
      "main_category_id": 24,
      "warehouse_product_id": 3002,
      "warehouse_product_variant_id": 3002,
      "size": "XS",
      "color": "White",
      "availability_status": "active"
    },
    "sync_product": {
      "id": 13,
      "external_id": "4235234213",
      "name": "T-shirt",
      "variants": 10,
      "synced": 10,
      "thumbnail_url": "\u200bhttps://your-domain.com/path/to/image.png",
      "is_ignored": true
    }
  }
}
```

### PUT /sync/variants/{id} — Update Store Sync Variant

**Request Body:**

```json
{
  "code": 200,
  "result": {
    "sync_variant": {
      "id": 10,
      "external_id": "12312414",
      "sync_product_id": 71,
      "name": "Red T-Shirt",
      "synced": true,
      "variant_id": 3001,
      "retail_price": "29.99",
      "currency": "USD",
      "is_ignored": true,
      "sku": "SKU1234",
      "product": {
        "variant_id": 3001,
        "product_id": 301,
        "image": "https://files.cdn.printful.com/products/71/5309_1581412541.jpg",
        "name": "Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt with Tear Away Label (White / 4XL)"
      },
      "files": [
        {
          "type": "default",
          "id": 10,
          "url": "\u200bhttps://www.example.com/files/tshirts/example.png",
          "options": [
            {
              "id": "template_type",
              "value": "native"
            }
          ],
          "hash": "ea44330b887dfec278dbc4626a759547",
          "filename": "shirt1.png",
          "mime_type": "image/png",
          "size": 45582633,
          "width": 1000,
          "height": 1000,
          "dpi": 300,
          "status": "ok",
          "created": 1590051937,
          "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
          "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
          "visible": true,
          "is_temporary": false,
          "stitch_count_tier": "stitch_tier_1"
        }
      ],
      "options": [
        {
          "id": "embroidery_type",
          "value": "flat"
        }
      ],
      "main_category_id": 24,
      "warehouse_product_id": 3002,
      "warehouse_product_variant_id": 3002,
      "size": "XS",
      "color": "White",
      "availability_status": "active"
    },
    "sync_product": {
      "id": 13,
      "external_id": "4235234213",
      "name": "T-shirt",
      "variants": 10,
      "synced": 10,
      "thumbnail_url": "\u200bhttps://your-domain.com/path/to/image.png",
      "is_ignored": true
    }
  }
}
```

---

## Variant Options (for Special Products)

Some products require options (e.g., embroidery type):

```json
{
  "options": [
    {
      "id": "embroidery_type",
      "value": "flat"
    },
    {
      "id": "thread_colors",
      "value": ["#FFFFFF", "#000000"]
    }
  ]
}
```

### Common Option IDs

| `id` | Description |
|------|-------------|
| `embroidery_type` | `flat`, `3d_puff`, `mixed` |
| `thread_colors` | Array of hex color strings |
| `lifelike` | Boolean for photo-realistic mockups |

---

## Error Codes — Sync Variants

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Missing required fields (variant_id, files) |
| 401 | Unauthorized | Invalid or missing token |
| 403 | Forbidden | Token lacks required scope |
| 404 | Not Found | Variant ID does not exist |
| 409 | Conflict | Variant already exists for this product |
