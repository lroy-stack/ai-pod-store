# Printful API — Catalog API

**Source:** https://developers.printful.com/docs/#tag/Catalog-API
**Fetched:** 2026-03-02

---

## Overview

The Catalog API provides read-only access to Printful's entire product catalog — including products, variants, size guides, print file specifications, and available customization options.

**Authentication:** NOT required — the Catalog API is public.
**Rate limit (unauthenticated):** 30 requests per 60 seconds (60-second lockout if exceeded).

> **Critical:** Always use Variant IDs (not Product IDs) when creating sync products or orders. Mixing them causes incorrect results.

---

## Endpoints

### 1. GET /products — List All Products

Retrieves the complete list of available products.

**URL:** `GET https://api.printful.com/products`

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `category_id` | string | No | Comma-separated list of category IDs to filter by |

**Example Request:**
```bash
curl 'https://api.printful.com/products?category_id=24'
```

**Response:**
```json
{
  "code": 200,
  "result": [
    {
      "id": 71,
      "main_category_id": 24,
      "type": "T-SHIRT",
      "type_name": "Unisex T-Shirt",
      "title": "Unisex Staple T-Shirt | Bella + Canvas 3001",
      "brand": "Bella + Canvas",
      "model": "3001",
      "image": "https://files.cdn.printful.com/products/71/product.jpg",
      "variant_count": 432,
      "currency": "USD",
      "is_discontinued": false,
      "avg_fulfillment_time": 3.17,
      "origin_country": "Honduras",
      "techniques": [
        {
          "key": "DTG",
          "display_name": "DTG printing",
          "is_default": true
        }
      ],
      "files": [ ... ],
      "options": [ ... ]
    }
  ]
}
```

**Product Object Fields:**

| Field | Type | Description |
|---|---|---|
| `id` | integer | Product ID |
| `main_category_id` | integer | Primary category |
| `type` | string | Product type code (e.g., `T-SHIRT`, `HOODIE`) |
| `type_name` | string | Localized product type name |
| `title` | string | Full product title including brand and model |
| `brand` | string | Manufacturer brand name |
| `model` | string | Specific model designation |
| `image` | string | Product image URL |
| `variant_count` | integer | Total number of available variants |
| `currency` | string | Price currency code |
| `is_discontinued` | boolean | Whether product is discontinued |
| `avg_fulfillment_time` | decimal | Average production days |
| `origin_country` | string | Country of manufacture |
| `techniques` | array | Available print techniques (see below) |
| `files` | array | Available print placement areas (see below) |
| `options` | array | Customization options (see below) |

---

### 2. GET /products/{id} — Get Product

Retrieves full details for a specific product including all variants.

**URL:** `GET https://api.printful.com/products/{id}`

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | integer | Yes | Printful Product ID |

**Example Request:**
```bash
curl 'https://api.printful.com/products/71'
```

**Response (ProductInfo object):**
```json
{
  "code": 200,
  "result": {
    "product": { ...Product object... },
    "variants": [
      {
        "id": 4011,
        "product_id": 71,
        "name": "Bella + Canvas 3001 Unisex Jersey Short Sleeve Tee (Black / S)",
        "size": "S",
        "color": "Black",
        "color_code": "#14191e",
        "color_code2": null,
        "image": "https://files.cdn.printful.com/products/71/4011_1546512498.jpg",
        "price": "10.95",
        "in_stock": true,
        "availability_regions": {
          "US": "USA",
          "EU": "Europe",
          "AU": "Australia",
          "UK": "United Kingdom"
        },
        "availability_status": [
          { "region": "US", "status": "in_stock" },
          { "region": "EU", "status": "in_stock" }
        ],
        "material": [
          { "name": "100% Airlume combed and ring-spun cotton", "percentage": 100 }
        ]
      }
    ]
  }
}
```

---

### 3. GET /products/variant/{id} — Get Variant

Retrieves details for a specific variant plus its parent product.

**URL:** `GET https://api.printful.com/products/variant/{id}`

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | integer | Yes | Variant ID |

**Response (VariantInfo object):**
```json
{
  "code": 200,
  "result": {
    "variant": { ...Variant object... },
    "product": { ...Product object... }
  }
}
```

**Variant Object Fields:**

| Field | Type | Description |
|---|---|---|
| `id` | integer | Variant ID — USE THIS for orders and sync products |
| `product_id` | integer | Parent product ID |
| `name` | string | Full variant name (product + color + size) |
| `size` | string | Size designation (S, M, L, XL, etc.) |
| `color` | string | Color name |
| `color_code` | string | Hex color code (e.g., `#14191e`) |
| `color_code2` | string | Secondary hex color code (for multi-color variants) |
| `image` | string | Variant-specific image URL |
| `price` | string | Wholesale price (your cost) |
| `in_stock` | boolean | Overall stock status |
| `availability_regions` | object | Region codes mapped to region names |
| `availability_status` | array | Per-region stock status objects |
| `material` | array | Material composition (name + percentage) |

**Availability Status Values:**

| Status | Description |
|---|---|
| `in_stock` | Available in that region |
| `out_of_stock` | Temporarily out of stock |
| `stocked_on_demand` | Available but not pre-stocked |
| `discontinued` | No longer available |

**EU Availability:** Check `availability_status` for a `region: "EU"` entry with `status: "in_stock"` to confirm EU fulfillment is available for a variant.

---

### 4. GET /products/{id}/sizes — Get Size Guide

Returns sizing and measurement tables for a product.

**URL:** `GET https://api.printful.com/products/{id}/sizes`

**Path Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | integer | Yes | Product ID |

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `unit` | string | No | `inches` or `cm` (defaults based on locale) |

**Response (ProductSizeGuide object):**
```json
{
  "code": 200,
  "result": {
    "product_id": 71,
    "available_sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    "size_tables": [
      {
        "type": "product_measure",
        "unit": "inches",
        "description": "<p>Measurements are of the product itself</p>",
        "image_url": "https://files.cdn.printful.com/upload/product-catalog-img/...",
        "image_description": "<p>A = Length, B = Width</p>",
        "measurements": [
          {
            "type_label": "Length",
            "values": [
              { "size": "S", "min_value": "27", "max_value": "27.5" },
              { "size": "M", "value": "28" }
            ]
          }
        ]
      },
      {
        "type": "measure_yourself",
        "unit": "inches",
        "description": "<p>How to measure your body</p>",
        "measurements": [ ... ]
      },
      {
        "type": "international",
        "unit": "none",
        "measurements": [
          {
            "type_label": "US",
            "values": [
              { "size": "S", "value": "S" },
              { "size": "M", "value": "M" }
            ]
          },
          {
            "type_label": "EU",
            "values": [
              { "size": "S", "value": "44/46" }
            ]
          }
        ]
      }
    ]
  }
}
```

**Size Table Types:**

| Type | Description |
|---|---|
| `measure_yourself` | Body measurement guide (how to measure the person) |
| `product_measure` | Actual product dimensions |
| `international` | Size conversion between US/EU/UK/etc. |

---

## Data Object Schemas

### Product Files (Print Areas)

Each product has a `files` array defining available print placement areas:

```json
{
  "id": "front",
  "type": "front",
  "title": "Front print",
  "additional_price": "0.00",
  "options": [
    {
      "id": "full_color",
      "title": "Full color",
      "type": "bool",
      "values": { "0": "No", "1": "Yes" },
      "additional_price": "0.00",
      "additional_price_breakdown": {}
    }
  ]
}
```

**Common Placement Types:**

| Type | Description |
|---|---|
| `front` | Front print area (default/primary) |
| `back` | Back print area |
| `label_outside` | Outside neck/collar label |
| `label_inside` | Inside neck/collar label |
| `sleeve_left` | Left sleeve print |
| `sleeve_right` | Right sleeve print |
| `embroidery_front` | Front embroidery (for caps/hats) |
| `embroidery_back` | Back embroidery |
| `embroidery_left` | Left side embroidery |

### Product Options

The `options` array on a product defines customization choices:

```json
{
  "id": "embroidery_type",
  "title": "Embroidery type",
  "type": "radio",
  "values": {
    "flat": "Flat embroidery",
    "3d": "3D Puff embroidery",
    "partial_3d": "Partial 3D Puff embroidery"
  },
  "additional_price": "0.00",
  "additional_price_breakdown": {
    "flat": "0.00",
    "3d": "2.00",
    "partial_3d": "1.50"
  }
}
```

**Option Types:**

| Type | Description |
|---|---|
| `radio` | Single selection from predefined values |
| `bool` | Boolean yes/no toggle |
| `multi_select` | Multiple selections allowed |

### Techniques Array

```json
{
  "key": "DTG",
  "display_name": "DTG printing",
  "is_default": true
}
```

**Common Technique Keys:**

| Key | Description |
|---|---|
| `DTG` | Direct-to-Garment printing |
| `EMBROIDERY` | Thread embroidery |
| `SUBLIMATION` | Dye sublimation |
| `CUT_AND_SEW` | All-over print (AOP) |
| `DIGITAL_AOP` | Digital all-over print |
| `UV_PRINTING` | UV direct printing |
| `DIGITAL_EMBELLISHMENT` | Digital embellishment |

---

## EU-Specific Notes

- Use `availability_status` array to filter variants available in the EU region.
- The `availability_regions` field shows which regions a variant is stocked in — look for `"EU": "Europe"`.
- EU fulfillment is done from Printful's facility in **Riga, Latvia** (confirmed from external sources).
- Not all variants are available in EU — always check before creating products.
- EU variants will have `{ "region": "EU", "status": "in_stock" }` in `availability_status`.

**Example check in TypeScript:**
```typescript
const isEUAvailable = (variant: PrintfulVariant): boolean => {
  return variant.availability_status.some(
    s => s.region === 'EU' && s.status === 'in_stock'
  );
};
```

---

## Important Notes

- **Jewelry is not accessible via API** — must be managed in the Printful dashboard.
- Pricing in catalog responses reflects **standard wholesale pricing** — subscription discounts are not shown.
- The Catalog API is **read-only** — use Products API to manage your store's products.
- `is_discontinued: true` products can still fulfill existing orders but should not be used for new products.
