# Printful API — Sync Products (Products API)

**Base URL:** `https://api.printful.com`  
**Authentication:** Bearer token via `Authorization` header  
**Rate Limit:** 120 requests per minute

---

## Overview

The Products API lets you create, modify, and delete products in a Printful store based on the Manual orders / API platform.

> **Important:** Jewelry products are not supported via API.

Each product (Sync Product) contains one or more variants (Sync Variants). Each variant must reference:
1. A `variant_id` from the Printful Catalog
2. One or more print files via the `files` array

**Maximum 100 Sync Variants per Sync Product.**

---

## Sync Product Object

```json
{
  "id": 13,
  "external_id": "4235234213",
  "name": "T-shirt",
  "variants": 10,
  "synced": 10,
  "thumbnail_url": "https://your-domain.com/path/to/image.png",
  "is_ignored": false
}
```

## Sync Variant Object

```json
{
  "id": 10,
  "external_id": "12312414",
  "sync_product_id": 71,
  "name": "Gildan 64000 T-Shirt (Black / 2XL)",
  "synced": true,
  "variant_id": 3001,
  "main_category_id": 24,
  "warehouse_product_variant_id": null,
  "retail_price": "29.99",
  "sku": "SKU1234",
  "currency": "USD",
  "is_ignored": false,
  "product": {
    "variant_id": 3001,
    "product_id": 71,
    "image": "https://files.cdn.printful.com/products/71/5309_1539modes.png",
    "name": "Gildan 64000 T-Shirt (Black / 2XL)"
  },
  "files": [
    {
      "id": 10,
      "type": "default",
      "hash": "ea44330b887dfec278dbc4626a759547",
      "url": null,
      "filename": "shirt1.png",
      "mime_type": "image/png",
      "size": 45582633,
      "width": 1000,
      "height": 1000,
      "dpi": 72,
      "status": "ok",
      "created": 1590051937,
      "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
      "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_preview.png",
      "visible": true
    }
  ],
  "options": [
    {
      "id": "embroidery_type",
      "value": "flat"
    }
  ]
}
```

---

## Endpoints

### GET /store/products — Get Sync Products

Returns a list of Sync Product objects from your custom Printful store.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status. Enum: `all`, `synced`, `unsynced`, `ignored`, `imported`, `discontinued`, `out_of_stock` |
| `category_id` | string | Comma-separated list of category IDs to filter by |
| `offset` | integer | Pagination offset (default: 0) |
| `limit` | integer | Max results per page (default: 20, max: 100) |

**Response 200:**

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

---

### POST /store/products — Create Sync Product

Creates a new Sync Product with one or more Sync Variants.

**Request Body:**

```json
{
  "sync_product": {
    "external_id": "4235234213",
    "name": "T-shirt",
    "thumbnail": "\u200bhttp://your-domain.com/path/to/thumbnail.png",
    "is_ignored": true
  },
  "sync_variants": [
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
  ]
}
```

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "id": 13,
    "external_id": "4235234213",
    "name": "T-shirt",
    "variants": 10,
    "synced": 10,
    "thumbnail_url": "\u200bhttps://your-domain.com/path/to/image.png",
    "is_ignored": true
  }
}
```

---

### GET /store/products/{id} — Get Sync Product

Returns information about a specific Sync Product and its variants.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer/string | Sync Product ID or `@{external_id}` |

**Response 200:**

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

---

### DELETE /store/products/{id} — Delete Sync Product

Deletes a Sync Product and all associated Sync Variants.

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "id": 13,
    "external_id": "4235234213",
    "name": "T-shirt",
    "variants": 10,
    "synced": 10,
    "thumbnail_url": "https://your-domain.com/path/to/image.png",
    "is_ignored": false
  }
}
```

---

### PUT /store/products/{id} — Update Sync Product

Modifies an existing Sync Product and/or its Sync Variants.

**Request Body (same structure as POST, partial updates supported):**

```json
{
  "sync_product": {
    "external_id": "4235234213",
    "name": "T-shirt",
    "thumbnail": "\u200bhttp://your-domain.com/path/to/thumbnail.png",
    "is_ignored": true
  },
  "sync_variants": [
    {
      "id": 10,
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
  ]
}
```

---

### GET /store/variants/{id} — Get Sync Variant

Returns data about a specific Sync Variant.

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

Deletes a specific Sync Variant.

---

### PUT /store/variants/{id} — Update Sync Variant

Updates a specific Sync Variant.

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

### POST /store/products/{id}/variants — Create Sync Variant

Creates a new Sync Variant for an existing Sync Product.

**Request Body:**

```json
{ "variant_id": 3001, "retail_price": "29.99", "files": [{ "type": "default", "url": "https://example.com/design.png" }] }
```

---

## Files Array — Required for Each Variant

Each Sync Variant must include a `files` array specifying print placements:

```json
{
  "files": [
    {
      "type": "default",
      "url": "https://example.com/design-front.png"
    },
    {
      "type": "back",
      "url": "https://example.com/design-back.png"
    },
    {
      "type": "label_outside",
      "url": "https://example.com/label.png"
    }
  ]
}
```

### File Type Values

| `type` | Description |
|--------|-------------|
| `default` | Front print (main placement) |
| `back` | Back print |
| `label_outside` | Outside neck label |
| `label_inside` | Inside neck label |
| `sleeve_left` | Left sleeve print |
| `sleeve_right` | Right sleeve print |
| `embroidery_front` | Front embroidery |
| `embroidery_back` | Back embroidery |

---

## Error Codes — Products API

| Code | Description |
|------|-------------|
| 400 | Bad request — missing required fields |
| 401 | Unauthorized — invalid or missing token |
| 404 | Product not found |
| 500 | Internal server error |

---

## Rate Limits

- General: **120 requests/minute**
- Mockup-intensive operations have lower limits

---

## Full Create Product Example

```json
{
  "sync_product": {
    "external_id": "my-store-product-id-001",
    "name": "Custom T-Shirt — Ghost Developer Edition",
    "thumbnail": "https://example.com/thumbnail.png"
  },
  "sync_variants": [
    {
      "external_id": "my-variant-black-m",
      "variant_id": 4011,
      "retail_price": "29.99",
      "sku": "GHOST-BLK-M",
      "files": [
        {
          "type": "default",
          "url": "https://example.com/design-front.png"
        },
        {
          "type": "back",
          "url": "https://example.com/design-back.png"
        }
      ]
    },
    {
      "external_id": "my-variant-black-l",
      "variant_id": 4012,
      "retail_price": "29.99",
      "sku": "GHOST-BLK-L",
      "files": [
        {
          "type": "default",
          "url": "https://example.com/design-front.png"
        }
      ]
    }
  ]
}
```
