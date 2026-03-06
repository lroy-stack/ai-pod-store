# Printful API — Catalog Products

**Base URL:** `https://api.printful.com`  
**Authentication:** Bearer token via `Authorization` header  
**Rate Limit:** 120 requests/minute

---

## Overview

The Catalog API provides read-only access to Printful's product catalog. Use it to:
- Browse available blank products and variants
- Get size, color, and pricing information  
- Find `variant_id` values required for creating Sync Products

> **Important:** Always use `variant_id` (NOT `product_id`) when creating Sync Products or orders.

---

## Catalog Product Object

```json
{
  "id": 13,
  "main_category_id": 24,
  "type": "T-SHIRT",
  "type_name": "T-Shirt",
  "title": "Unisex Staple T-Shirt | Bella + Canvas 3001",
  "brand": "Bella + Canvas",
  "model": "3001 Unisex Jersey Short Sleeve Tee",
  "image": "https://files.cdn.printful.com/products/71/product_1574748840.jpg",
  "variant_count": 82,
  "currency": "USD",
  "options": [
    {
      "id": "embroidery_type",
      "title": "Embroidery type",
      "type": "radio",
      "values": {
        "flat": "Flat Embroidery",
        "3d_puff": "3D Puff Embroidery"
      }
    }
  ],
  "is_discontinued": false,
  "avg_fulfillment_time": null,
  "description": "...",
  "files": [
    {
      "id": "default",
      "type": "front",
      "title": "Front print",
      "additional_price": null,
      "options": []
    }
  ],
  "dimensions": {}
}
```

---

## Catalog Variant Object

```json
{
  "id": 4011,
  "product_id": 71,
  "name": "Unisex Staple T-Shirt | Bella + Canvas 3001 (Black / S)",
  "size": "S",
  "color": "Black",
  "color_code": "#14191e",
  "color_code2": null,
  "image": "https://files.cdn.printful.com/products/71/5309_1539modes.png",
  "price": "9.85",
  "in_stock": true,
  "availability_regions": {
    "US": "United States",
    "EU": "Europe",
    "CA": "Canada"
  },
  "availability_status": [
    {
      "region": "US",
      "status": "in_stock"
    },
    {
      "region": "EU",
      "status": "in_stock"
    }
  ]
}
```

---

## Endpoints

### GET /products — Get All Catalog Products

Returns a list of all available blank products in the Printful catalog.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category_id` | integer | Filter by category ID |

**Response 200:**

```json
{
  "code": 200,
  "result": [
    {
      "id": 13,
      "main_category_id": 24,
      "type": "T-SHIRT",
      "type_name": "T-Shirt",
      "title": "Unisex Staple T-Shirt | Bella + Canvas 3001",
      "brand": "Gildan",
      "model": "2200 Ultra Cotton Tank Top",
      "image": "https://files.cdn.printful.com/products/12/product_1550594502.jpg",
      "variant_count": 30,
      "currency": "EUR",
      "files": [
        {
          "id": "default",
          "type": "front",
          "title": "Front print",
          "additional_price": "2.22",
          "options": [
            {
              "id": "full_color",
              "type": "bool",
              "title": "Unlimited color",
              "additional_price": 3.25
            }
          ]
        }
      ],
      "options": [
        {
          "id": "embroidery_type",
          "title": "Embroidery type",
          "type": "radio",
          "values": {
            "flat": "Flat Embroidery",
            "3d": "3D Puff",
            "both": "Partial 3D Puff"
          },
          "additional_price": "string",
          "additional_price_breakdown": {
            "flat": "0.00",
            "3d": "0.00",
            "both": "0.00"
          }
        }
      ],
      "is_discontinued": false,
      "avg_fulfillment_time": 4.3,
      "description": "string",
      "techniques": [
        {
          "key": "DTG",
          "display_name": "DTG printing",
          "is_default": true
        }
      ],
      "origin_country": "Nicaragua"
    }
  ]
}
```

---

### GET /products/{product_id} — Get Catalog Product

Returns information about a specific catalog product, including all its variants.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `product_id` | integer | Printful catalog product ID |

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "product": {
      "id": 13,
      "main_category_id": 24,
      "type": "T-SHIRT",
      "type_name": "T-Shirt",
      "title": "Unisex Staple T-Shirt | Bella + Canvas 3001",
      "brand": "Gildan",
      "model": "2200 Ultra Cotton Tank Top",
      "image": "https://files.cdn.printful.com/products/12/product_1550594502.jpg",
      "variant_count": 30,
      "currency": "EUR",
      "files": [
        {
          "id": "default",
          "type": "front",
          "title": "Front print",
          "additional_price": "2.22",
          "options": [
            {
              "id": "full_color",
              "type": "bool",
              "title": "Unlimited color",
              "additional_price": 3.25
            }
          ]
        }
      ],
      "options": [
        {
          "id": "embroidery_type",
          "title": "Embroidery type",
          "type": "radio",
          "values": {
            "flat": "Flat Embroidery",
            "3d": "3D Puff",
            "both": "Partial 3D Puff"
          },
          "additional_price": "string",
          "additional_price_breakdown": {
            "flat": "0.00",
            "3d": "0.00",
            "both": "0.00"
          }
        }
      ],
      "is_discontinued": false,
      "avg_fulfillment_time": 4.3,
      "description": "string",
      "techniques": [
        {
          "key": "DTG",
          "display_name": "DTG printing",
          "is_default": true
        }
      ],
      "origin_country": "Nicaragua"
    },
    "variants": [
      {
        "id": 100,
        "product_id": 12,
        "name": "Gildan 64000 Unisex Softstyle T-Shirt with Tear Away (Black / 2XL)",
        "size": "2XL",
        "color": "Black",
        "color_code": "#14191e",
        "color_code2": "string",
        "image": "https://files.cdn.printful.com/products/12/629_1517916489.jpg",
        "price": "9.85",
        "in_stock": true,
        "availability_regions": {
          "US": "USA",
          "EU": "Europe"
        },
        "availability_status": [
          {
            "region": "US",
            "status": "in_stock"
          }
        ],
        "material": [
          {
            "name": "cotton",
            "percentage": 100
          }
        ]
      }
    ]
  }
}
```

### Product Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique product ID |
| `type` | string | Product type identifier (e.g., `T-SHIRT`, `HOODIE`, `MUG`) |
| `type_name` | string | Human-readable product type |
| `title` | string | Full product title with brand/model |
| `brand` | string | Blank product brand (e.g., `Bella + Canvas`, `Gildan`) |
| `model` | string | Specific model name and number |
| `image` | string | Product preview image URL |
| `variant_count` | integer | Total number of available variants |
| `currency` | string | Price currency |
| `options` | object[] | Available product options (e.g., embroidery type) |
| `is_discontinued` | boolean | Whether product is discontinued |
| `files` | object[] | Available print placements |

---

### GET /products/variant/{variant_id} — Get Catalog Variant

Returns information about a specific variant.

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "variant": {
      "id": 100,
      "product_id": 12,
      "name": "Gildan 64000 Unisex Softstyle T-Shirt with Tear Away (Black / 2XL)",
      "size": "2XL",
      "color": "Black",
      "color_code": "#14191e",
      "color_code2": "string",
      "image": "https://files.cdn.printful.com/products/12/629_1517916489.jpg",
      "price": "9.85",
      "in_stock": true,
      "availability_regions": {
        "US": "USA",
        "EU": "Europe"
      },
      "availability_status": [
        {
          "region": "US",
          "status": "in_stock"
        }
      ],
      "material": [
        {
          "name": "cotton",
          "percentage": 100
        }
      ]
    },
    "product": {
      "id": 13,
      "main_category_id": 24,
      "type": "T-SHIRT",
      "type_name": "T-Shirt",
      "title": "Unisex Staple T-Shirt | Bella + Canvas 3001",
      "brand": "Gildan",
      "model": "2200 Ultra Cotton Tank Top",
      "image": "https://files.cdn.printful.com/products/12/product_1550594502.jpg",
      "variant_count": 30,
      "currency": "EUR",
      "files": [
        {
          "id": "default",
          "type": "front",
          "title": "Front print",
          "additional_price": "2.22",
          "options": [
            {
              "id": "full_color",
              "type": "bool",
              "title": "Unlimited color",
              "additional_price": 3.25
            }
          ]
        }
      ],
      "options": [
        {
          "id": "embroidery_type",
          "title": "Embroidery type",
          "type": "radio",
          "values": {
            "flat": "Flat Embroidery",
            "3d": "3D Puff",
            "both": "Partial 3D Puff"
          },
          "additional_price": "string",
          "additional_price_breakdown": {
            "flat": "0.00",
            "3d": "0.00",
            "both": "0.00"
          }
        }
      ],
      "is_discontinued": false,
      "avg_fulfillment_time": 4.3,
      "description": "string",
      "techniques": [
        {
          "key": "DTG",
          "display_name": "DTG printing",
          "is_default": true
        }
      ],
      "origin_country": "Nicaragua"
    }
  }
}
```

### Variant Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique variant ID — **use this as `variant_id`** |
| `product_id` | integer | Parent product ID |
| `name` | string | Full variant name (includes color and size) |
| `size` | string | Size label (e.g., `S`, `M`, `L`, `XL`, `2XL`) |
| `color` | string | Color name |
| `color_code` | string | Primary hex color code |
| `color_code2` | string | Secondary hex color code (for two-tone colors) |
| `image` | string | Variant-specific product image URL |
| `price` | string | Base price (USD) |
| `in_stock` | boolean | Current stock availability |
| `availability_regions` | object | Regions where variant is available |
| `availability_status` | object[] | Per-region stock status |

### Availability Status Values

| Status | Description |
|--------|-------------|
| `in_stock` | Available for fulfillment |
| `stocked_on_demand` | Available but fulfilled on demand |
| `out_of_stock` | Currently unavailable |
| `temporary_out_of_stock` | Temporarily unavailable |
| `discontinued` | No longer available |

---

### GET /products/{product_id}/sizes — Get Size Guide

Returns sizing information and measurement guides for a product.

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "product_id": 13,
    "available_sizes": [
      "S",
      "M",
      "L"
    ],
    "size_tables": [
      {
        "type": "measure_yourself",
        "unit": "inches",
        "description": "<p>Measurements are provided by suppliers.<br /><br />US customers should order a size up as the EU sizes for this supplier correspond to a smaller size in the US market.</p>\\n<p>Product measurements may vary by up to 2\\\" (5 cm).&nbsp;</p>",
        "image_url": "https://s3.staging.printful.com/upload/measure-yourself/6a/6a4fe322f592f2b91d5a735d7ff8d1c0_t?v=1652962720",
        "image_description": "<h6><strong>A Length</strong></h6>\\n<p dir=\\\"ltr\\\"><span id=\\\"docs-internal-guid-a3ac3082-7fff-5f98-2623-3eb38d5f43a1\\\">Place the end of the tape beside the collar at the top of the tee (Highest Point Shoulder). Pull the tape measure t</span><span id=\\\"docs-internal-guid-a3ac3082-7fff-5f98-2623-3eb38d5f43a1\\\">o the bottom of the shirt.</span></p>\\n<h6>B Chest</h6>\\n<p dir=\\\"ltr\\\">Measure yourself around the fullest part of your chest. Keep the tape measure horizontal.</p>",
        "measurements": [
          {
            "type_label": "Length",
            "values": [
              {
                "size": "S",
                "value": "24"
              },
              {
                "size": "M",
                "value": "26"
              },
              {
                "size": "L",
                "value": "28"
              }
            ]
          },
          {
            "type_label": "Chest",
            "values": [
              {
                "size": "S",
                "min_value": "14",
                "max_value": "16"
              },
              {
                "size": "M",
                "min_value": "18",
                "max_value": "20"
              },
              {
                "size": "L",
                "min_value": "22",
                "max_value": "24"
              }
            ]
          }
        ]
      },
      {
        "type": "product_measure",
        "unit": "inches",
        "description": "<p dir=\\\"ltr\\\">Measurements are provided by our suppliers. Product measurements may vary by up to 2\\\" (5 cm).</p>\\n<p dir=\\\"ltr\\\">US customers should order a size up as the EU sizes for this supplier correspond to a smaller size in the US market.</p>\\n<p dir=\\\"ltr\\\">Pro tip! Measure one of your products at home and compare with the measurements you see in this guide.</p>",
        "image_url": "https://s3.staging.printful.com/upload/product-measure/85/857e7cc8b802da216e7f1a6114075a72_t?v=1652962720",
        "image_description": "<h6><strong>A Length</strong></h6>\\n<p dir=\\\"ltr\\\"><span id=\\\"docs-internal-guid-a3ac3082-7fff-5f98-2623-3eb38d5f43a1\\\">Place the end of the tape beside the collar at the top of the tee (Highest Point Shoulder). Pull the tape measure t</span><span id=\\\"docs-internal-guid-a3ac3082-7fff-5f98-2623-3eb38d5f43a1\\\">o the bottom of the shirt.</span></p>\\n<h6>B Width</h6>\\n<p dir=\\\"ltr\\\">Place the end of the tape at the seam under the sleeve and pull the tape measure across the shirt to the seam under the opposite sleeve.</p>",
        "measurements": [
          {
            "type_label": "Length",
            "values": [
              {
                "size": "S",
                "value": "24"
              },
              {
                "size": "M",
                "value": "26"
              },
              {
                "size": "L",
                "value": "28"
              }
            ]
          },
          {
            "type_label": "Width",
            "values": [
              {
                "size": "S",
                "min_value": "14",
                "max_value": "16"
              },
              {
                "size": "M",
                "min_value": "18",
                "max_value": "20"
              },
              {
                "size": "L",
                "min_value": "22",
                "max_value": "24"
              }
            ]
          }
        ]
      },
      {
        "type": "measure_yourself",
        "unit": "cm",
        "description": "<p>Measurements are provided by suppliers.<br /><br />US customers should order a size up as the EU sizes for this supplier correspond to a smaller size in the US market.</p>\\n<p>Product measurements may vary by up to 2\\\" (5 cm).&nbsp;</p>",
        "image_url": "https://s3.staging.printful.com/upload/measure-yourself/6a/6a4fe322f592f2b91d5a735d7ff8d1c0_t?v=1652962720",
        "image_description": "<h6><strong>A Length</strong></h6>\\n<p dir=\\\"ltr\\\"><span id=\\\"docs-internal-guid-a3ac3082-7fff-5f98-2623-3eb38d5f43a1\\\">Place the end of the tape beside the collar at the top of the tee (Highest Point Shoulder). Pull the tape measure t</span><span id=\\\"docs-internal-guid-a3ac3082-7fff-5f98-2623-3eb38d5f43a1\\\">o the bottom of the shirt.</span></p>\\n<h6>B Chest</h6>\\n<p dir=\\\"ltr\\\">Measure yourself around the fullest part of your chest. Keep the tape measure horizontal.</p>",
        "measurements": [
          {
            "type_label": "Length",
            "values": [
              {
                "size": "S",
                "value": "60.96"
              },
              {
                "size": "M",
                "value": "66.04"
              },
              {
                "size": "L",
                "value": "71.12"
              }
            ]
          },
          {
            "type_label": "Chest",
            "values": [
              {
                "size": "S",
                "min_value": "35.56",
                "max_value": "40.64"
              },
              {
                "size": "M",
                "min_value": "45.72",
                "max_value": "50.80"
              },
              {
                "size": "L",
                "min_value": "55.88",
                "max_value": "60.96"
              }
            ]
          }
        ]
      },
      {
        "type": "product_measure",
        "unit": "cm",
        "description": "<p dir=\\\"ltr\\\">Measurements are provided by our suppliers. Product measurements may vary by up to 2\\\" (5 cm).</p>\\n<p dir=\\\"ltr\\\">US customers should order a size up as the EU sizes for this supplier correspond to a smaller size in the US market.</p>\\n<p dir=\\\"ltr\\\">Pro tip! Measure one of your products at home and compare with the measurements you see in this guide.</p>",
        "image_url": "https://s3.staging.printful.com/upload/product-measure/85/857e7cc8b802da216e7f1a6114075a72_t?v=1652962720",
        "image_description": "<h6><strong>A Length</strong></h6>\\n<p dir=\\\"ltr\\\"><span id=\\\"docs-internal-guid-a3ac3082-7fff-5f98-2623-3eb38d5f43a1\\\">Place the end of the tape beside the collar at the top of the tee (Highest Point Shoulder). Pull the tape measure t</span><span id=\\\"docs-internal-guid-a3ac3082-7fff-5f98-2623-3eb38d5f43a1\\\">o the bottom of the shirt.</span></p>\\n<h6>B Width</h6>\\n<p dir=\\\"ltr\\\">Place the end of the tape at the seam under the sleeve and pull the tape measure across the shirt to the seam under the opposite sleeve.</p>",
        "measurements": [
          {
            "type_label": "Length",
            "values": [
              {
                "size": "S",
                "value": "60.96"
              },
              {
                "size": "M",
                "value": "66.04"
              },
              {
                "size": "L",
                "value": "71.12"
              }
            ]
          },
          {
            "type_label": "Width",
            "values": [
              {
                "size": "S",
                "min_value": "35.56",
                "max_value": "40.64"
              },
              {
                "size": "M",
                "min_value": "45.72",
                "max_value": "50.80"
              },
              {
                "size": "L",
                "min_value": "55.88",
                "max_value": "60.96"
              }
            ]
          }
        ]
      },
      {
        "type": "international",
        "unit": "none",
        "measurements": [
          {
            "type_label": "US size",
            "values": [
              {
                "size": "S",
                "min_value": "8",
                "max_value": "10"
              },
              {
                "size": "M",
                "min_value": "12",
                "max_value": "14"
              },
              {
                "size": "L",
                "min_value": "16",
                "max_value": "18"
              }
            ]
          },
          {
            "type_label": "EU size",
            "values": [
              {
                "size": "S",
                "min_value": "38",
                "max_value": "39"
              },
              {
                "size": "M",
                "min_value": "40",
                "max_value": "41"
              },
              {
                "size": "L",
                "min_value": "42",
                "max_value": "43"
              }
            ]
          },
          {
            "type_label": "UK size",
            "values": [
              {
                "size": "S",
                "min_value": "4",
                "max_value": "6"
              },
              {
                "size": "M",
                "min_value": "8",
                "max_value": "10"
              },
              {
                "size": "L",
                "min_value": "12",
                "max_value": "14"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

### GET /categories — Get All Categories

Returns a list of all Printful catalog categories.

**Response 200:**

```json
{
  "code": 200,
  "result": [
    {
      "id": 24,
      "parent_id": 6,
      "image_url": "https://s3.staging.printful.com/upload/catalog_category/b1/b1513c82696405fcc316fc611c57f132_t?v=1646395980",
      "size": "small",
      "title": "T-Shirts"
    }
  ]
}
```

---

### GET /categories/{category_id} — Get Category

Returns information about a specific category.

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "id": 24,
    "parent_id": 6,
    "image_url": "https://s3.staging.printful.com/upload/catalog_category/b1/b1513c82696405fcc316fc611c57f132_t?v=1646395980",
    "size": "small",
    "title": "T-Shirts"
  }
}
```

---

## EU Availability — Important Notes

When building an EU-only store, always check `availability_regions` to confirm EU fulfillment:

```json
{
  "availability_regions": {
    "EU": "Europe"
  }
}
```

EU-available products are fulfilled from EU-based providers, avoiding customs issues for EU customers.

### Key EU Providers
| Provider ID | Name | Location |
|-------------|------|----------|
| P26 | Textildruck Europa | Germany |
| P410 | Printful | Latvia |
| P90 | AOP+ Easy Print on Demand | UK/EU |
| P23 | Printful | EU |
| P30 | Printful Stickers | EU |

---

## Filtering Products by Category

To find all t-shirts:

```
GET /products?category_id=24
```

Common category IDs:
| Category | ID |
|---------|----|
| T-Shirts | 24 |
| Hoodies & Sweatshirts | 25 |
| Hats | 19 |
| Mugs & Drinkware | 93 |
| Bags | 53 |
| Phone Cases | 57 |
| Stickers | 136 |
| Posters | 31 |

---

## Error Codes — Catalog API

| Code | Description |
|------|-------------|
| 400 | Bad request |
| 401 | Unauthorized |
| 404 | Product or variant not found |
| 429 | Rate limit exceeded |
