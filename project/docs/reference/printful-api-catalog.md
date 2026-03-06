# Printful Catalog API Reference

## Overview

The Catalog API provides read-only access to Printful's product catalog, including available products, variants, blueprints, and pricing information. This API does not require authentication for basic queries.

**Base URL:** `https://api.printful.com/`

**Authentication:** Optional (public catalog) or Bearer token for authenticated requests

**Rate Limits:** 30 per 60 seconds (unauthenticated), 120 per minute (authenticated)

---

## Catalog Endpoints

### List Products

Retrieve all available products from the Printful catalog with optional filtering.

```http
GET /products?category_id=1,2,3&offset=0&limit=20
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category_id` | string | (all) | Comma-separated category IDs to filter (e.g., "1,2,3") |
| `offset` | integer | 0 | Number of results to skip |
| `limit` | integer | 20 | Maximum results per page (1-100) |

**Response:**

```json
{
  "code": 200,
  "result": [
    {
      "id": 123,
      "type": "T_SHIRT",
      "type_name": "T-Shirt",
      "title": "Unisex T-Shirt",
      "brand": "Printful",
      "model": "CVC",
      "image": "https://images.printful.com/products/...",
      "description": "Comfortable 100% cotton t-shirt",
      "currency": "USD",
      "main_category_id": 1,
      "variant_count": 48,
      "is_discontinued": false,
      "avg_fulfillment_time": 2,
      "origin_country": "DE"
    }
  ],
  "paging": {
    "total": 500,
    "offset": 0,
    "limit": 20
  }
}
```

---

### Get Product

Retrieve detailed information about a specific product.

```http
GET /products/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Product ID |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": 123,
    "type": "T_SHIRT",
    "type_name": "T-Shirt",
    "title": "Unisex T-Shirt",
    "brand": "Printful",
    "model": "CVC",
    "image": "https://images.printful.com/products/...",
    "description": "Comfortable 100% cotton t-shirt",
    "currency": "USD",
    "main_category_id": 1,
    "is_discontinued": false,
    "avg_fulfillment_time": 2,
    "origin_country": "DE",
    "variants": [
      {
        "id": 1234,
        "product_id": 123,
        "name": "White / S",
        "size": "S",
        "color": "White",
        "color_code": "#FFFFFF",
        "color_code2": null,
        "image": "https://images.printful.com/variants/...",
        "price": "19.99",
        "in_stock": true,
        "availability_regions": ["US", "EU", "UK"],
        "availability_status": "in_stock",
        "weight": 200,
        "weight_unit": "g"
      }
    ],
    "techniques": [
      {
        "key": "DTG",
        "display_name": "Direct-to-Garment",
        "is_default": true
      },
      {
        "key": "EMBROIDERY",
        "display_name": "Embroidery",
        "is_default": false
      }
    ],
    "print_areas": [
      {
        "key": "front",
        "display_name": "Front",
        "dimensions": {
          "width": 280,
          "height": 380
        }
      }
    ]
  }
}
```

---

### Get Variant

Retrieve detailed information about a specific variant.

```http
GET /products/variant/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Variant ID |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": 1234,
    "product_id": 123,
    "name": "White / S",
    "size": "S",
    "color": "White",
    "color_code": "#FFFFFF",
    "color_code2": null,
    "image": "https://images.printful.com/variants/...",
    "price": "19.99",
    "currency": "USD",
    "weight": 200,
    "weight_unit": "g",
    "in_stock": true,
    "availability_status": "in_stock",
    "availability_regions": ["US", "EU", "UK"],
    "material": [
      {
        "name": "Cotton",
        "percentage": 100
      }
    ],
    "files": [
      {
        "id": "file_1",
        "type": "front",
        "title": "Front Print",
        "width": 3000,
        "height": 3000
      }
    ],
    "options": [
      {
        "id": "pod_full_color_front",
        "display_name": "Full Color Front Print",
        "type": "addon",
        "price": "0.00"
      }
    ]
  }
}
```

---

### Get Product Size Guide

Retrieve size information and measurements for a product.

```http
GET /products/{id}/sizes?unit=inches
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Product ID |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `unit` | string | inches | Measurement unit: `inches` or `cm` |

**Response:**

```json
{
  "code": 200,
  "result": {
    "product_id": 123,
    "type": "measure_yourself",
    "unit": "inches",
    "sizes": [
      {
        "size": "XS",
        "measurements": [
          {
            "name": "Chest Width",
            "value": 15.75,
            "ease": 1.5
          },
          {
            "name": "Length",
            "value": 27.5,
            "ease": 0
          }
        ]
      },
      {
        "size": "S",
        "measurements": [
          {
            "name": "Chest Width",
            "value": 17.75,
            "ease": 1.5
          },
          {
            "name": "Length",
            "value": 28,
            "ease": 0
          }
        ]
      }
    ]
  }
}
```

### Size Guide Types

| Type | Description | Use Case |
|------|-------------|----------|
| `measure_yourself` | Body measurements for proper fit | T-shirts, hoodies, casual wear |
| `product_measure` | Finished product dimensions | When ordering, measure the garment |
| `international` | Size conversion chart | EU/US/UK size conversions |

---

### List Categories

Retrieve all product categories.

```http
GET /categories
```

**Response:**

```json
{
  "code": 200,
  "result": [
    {
      "id": 1,
      "parent_id": null,
      "title": "Apparel",
      "children": [
        {
          "id": 2,
          "parent_id": 1,
          "title": "Tops",
          "children": [
            {
              "id": 3,
              "parent_id": 2,
              "title": "T-Shirts"
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Get Category

Retrieve a specific category with its products.

```http
GET /categories/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Category ID |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": 3,
    "parent_id": 2,
    "title": "T-Shirts",
    "description": "All available t-shirt styles",
    "products": [
      {
        "id": 123,
        "type": "T_SHIRT",
        "title": "Unisex T-Shirt",
        "image": "https://images.printful.com/..."
      }
    ]
  }
}
```

---

## Blueprint Reference

### What is a Blueprint?

A Blueprint is a Printful template for a specific product type. Each blueprint specifies:
- Product characteristics (fabric, weight, cut)
- Available sizes and colors
- Print areas and technical specifications
- Print techniques supported (DTG, embroidery, sublimation)

### Common Blueprint IDs

#### Apparel (DTG - P26 Textildruck)

| Product | Blueprint ID | Sizes | Colors |
|---------|--------------|-------|--------|
| T-Shirt | 123 | XS-3XL | 20+ |
| Long Sleeve | 124 | XS-3XL | 15+ |
| Hoodie | 145 | XS-3XL | 10+ |
| Zip Hoodie | 146 | XS-3XL | 10+ |
| Crewneck | 147 | XS-3XL | 8+ |

#### Headwear (Embroidery - P410 Printful)

| Product | Blueprint ID | Technique | Max Colors |
|---------|--------------|-----------|------------|
| Cap/Dad Hat | 831 | Embroidery | 15 |
| Beanie | 177 | Embroidery | 15 |
| Snapback | 832 | Embroidery | 15 |
| Bucket Hat | 879 | Embroidery | 15 |

#### Drinkware (Sublimation)

| Product | Blueprint ID | Provider | Material |
|---------|--------------|----------|----------|
| Mug | 88 | P26 | Ceramic |
| Tumbler | 99 | P410 | Stainless |
| Bottle | 100 | P23 | Plastic |

---

## Product Data Structures

### Product Object

```json
{
  "id": 123,
  "type": "T_SHIRT",
  "type_name": "T-Shirt",
  "title": "Unisex T-Shirt",
  "brand": "Printful",
  "model": "CVC",
  "image": "https://images.printful.com/products/...",
  "description": "Comfortable 100% cotton t-shirt",
  "currency": "USD",
  "main_category_id": 1,
  "variant_count": 48,
  "is_discontinued": false,
  "avg_fulfillment_time": 2,
  "origin_country": "DE",
  "collection_id": null,
  "created": 1609459200,
  "updated": 1609545600
}
```

### Variant Object

```json
{
  "id": 1234,
  "product_id": 123,
  "name": "White / S",
  "size": "S",
  "color": "White",
  "color_code": "#FFFFFF",
  "color_code2": null,
  "image": "https://images.printful.com/variants/...",
  "price": "19.99",
  "currency": "USD",
  "weight": 200,
  "weight_unit": "g",
  "in_stock": true,
  "availability_status": "in_stock",
  "availability_regions": [
    "US",
    "EU",
    "UK"
  ],
  "material": [
    {
      "name": "Cotton",
      "percentage": 100
    }
  ],
  "files": [
    {
      "id": "file_1",
      "type": "front",
      "title": "Front Print",
      "width": 3000,
      "height": 3000,
      "dpi": 300
    }
  ],
  "options": [
    {
      "id": "pod_full_color_front",
      "display_name": "Full Color Front Print",
      "type": "addon",
      "price": "0.00"
    }
  ]
}
```

### Technique Object

```json
{
  "key": "DTG",
  "display_name": "Direct-to-Garment",
  "description": "High-resolution printing onto garments",
  "is_default": true
}
```

### Print Area Object

```json
{
  "key": "front",
  "display_name": "Front",
  "description": "Front center of garment",
  "dimensions": {
    "width": 280,
    "height": 380
  },
  "position": {
    "x": 50,
    "y": 100
  }
}
```

### Material Object

```json
{
  "name": "Cotton",
  "percentage": 100
}
```

---

## Availability Information

### Stock Status

| Status | Meaning | Can Order |
|--------|---------|-----------|
| `in_stock` | Available for immediate order | Yes |
| `low_stock` | Limited quantity available | Yes |
| `out_of_stock` | Currently unavailable | No |
| `discontinued` | Product no longer available | No |

### Availability Regions

List of regions/countries where a variant is available:

```json
"availability_regions": [
  "US",
  "EU",
  "UK",
  "CA",
  "AU"
]
```

Region codes:
- `US` - United States
- `EU` - European Union
- `UK` - United Kingdom
- `CA` - Canada
- `AU` - Australia

---

## Pricing Information

### Catalog Pricing

The catalog price is the **production cost** to Printful:

```json
{
  "price": "19.99",
  "currency": "USD"
}
```

This is what you pay Printful per unit. Your retail price is calculated by adding your margin:

```
Retail Price = Catalog Price + Markup

Example:
Catalog: $19.99
Markup: +$5.00 (25%)
Retail: $24.99
```

### Options and Add-Ons

Additional features with separate pricing:

```json
{
  "options": [
    {
      "id": "pod_full_color_front",
      "display_name": "Full Color Front Print",
      "type": "addon",
      "price": "0.00"
    },
    {
      "id": "embroidery_chest",
      "display_name": "Embroidery on Chest",
      "type": "addon",
      "price": "2.99"
    }
  ]
}
```

Option types:
- `addon` - Additional feature with optional pricing
- `required` - Must be selected for order
- `variant_option` - Selectable variant attribute (color, size)

---

## Print Techniques

### Available Techniques

#### Direct-to-Garment (DTG)
- **Used for:** T-shirts, hoodies, long sleeves, crewnecks, tote bags, kids clothing
- **Provider:** P26 Textildruck Europa (Germany)
- **Colors:** Full spectrum (unlimited)
- **Quality:** High-resolution, photographic quality
- **Cost:** Included in product price

#### Embroidery
- **Used for:** Caps, beanies, snapbacks, dad hats, bucket hats, hoodies
- **Provider:** P410 Printful (Latvia)
- **Colors:** Up to 15 thread colors
- **Quality:** Clean, professional look
- **Cost:** $0.00 - $5.00 per placement

#### Sublimation
- **Used for:** Mugs, tumblers, bottles, desk mats, mouse pads, stickers
- **Providers:** P26, P410, P23, P90, P30
- **Colors:** Full spectrum
- **Quality:** Vibrant, durable
- **Cost:** Included in product price

#### Screen Printing
- **Used for:** T-shirts, hoodies (bulk orders)
- **Providers:** Various
- **Colors:** Limited (typically 1-4)
- **Quality:** Classic look
- **Cost:** Lower cost at scale

---

## Printfile Information

Printfiles contain technical specifications for design placement:

```json
{
  "id": "printfile_123",
  "placement": "front",
  "width": 3000,
  "height": 3000,
  "dpi": 300,
  "format": "PNG",
  "visible": true,
  "background": "transparent"
}
```

### Printfile Dimensions

For DTG (300 DPI):
- T-shirt front: 3000×3000px
- Hoodie chest: 3000×2000px
- Long sleeve: 2400×3000px

For Embroidery (standard):
- Cap chest: 3000×1200px
- Hat center: 2000×1500px
- Beanie: 1500×1500px

---

## Common Catalog Queries

### Find All T-Shirts

```
GET /products?category_id=3
```

Returns all products in the T-Shirt category.

### Find Hoodies in Stock

```
GET /products?category_id=5&in_stock=1
```

Returns available hoodies.

### Get Specific Variant Details

```
GET /products/variant/1234
```

Returns complete information about variant 1234.

### Find Available Colors

```
GET /products/123
```

Check `variants` array for all color options:

```
variants[].color
variants[].color_code
variants[].availability_status
```

### Calculate Production Time

```
GET /products/123
```

Use `avg_fulfillment_time` field (in days):

```json
"avg_fulfillment_time": 2
```

---

## Size Charts by Product Type

### T-Shirt Sizes

Standard US sizing: XS, S, M, L, XL, 2XL, 3XL, 4XL

Measurements typically include:
- Chest width
- Length (front and back)
- Sleeve length

### Hoodie Sizes

Same as T-shirt: XS - 4XL

Additional measurements:
- Hood width
- Overall length
- Sleeve length from cuff

### Hat Sizes

| Size | Head Circumference |
|------|-------------------|
| One Size | 21.5-23" (55-58 cm) |
| Adjustable | Fits 21.5-23.5" (55-60 cm) |

---

## Fulfillment and Shipping

### Production Times

- **Standard DTG:** 2-4 business days
- **Embroidery:** 2-3 business days
- **Sublimation:** 1-2 business days
- **Bulk orders:** May vary

### Origin Countries

Most Printful products originate from:
- **DE** - Germany (DTG apparel)
- **LV** - Latvia (embroidery headwear)
- **US** - United States (some providers)

**Shipping from origin to customer:**
- US: 5-7 days standard
- EU: 3-5 days
- International: 7-14 days

---

## Error Handling

### Product Not Found

```json
{
  "code": 404,
  "error": {
    "reason": "NotFound",
    "message": "Product ID 99999 not found"
  }
}
```

### Variant Unavailable

```json
{
  "code": 422,
  "error": {
    "reason": "Unavailable",
    "message": "Variant 1234 is out of stock in selected region"
  }
}
```

### Rate Limit Exceeded

```json
{
  "code": 429,
  "error": {
    "reason": "TooManyRequests",
    "message": "Rate limit exceeded. Max 30 requests per 60 seconds for unauthenticated requests"
  }
}
```

---

## Best Practices for Catalog Integration

### Caching

1. **Cache catalog data locally** - Data changes infrequently
2. **Refresh daily or weekly** - Check for updates
3. **Cache size guides** - Rarely change
4. **Cache pricing** - May change weekly, refresh regularly
5. **Use ETags** if supported for efficient updates

### Performance

1. **Batch requests** where possible
2. **Respect rate limits** - Implement delays
3. **Use pagination** for large result sets
4. **Filter by category_id** to reduce response size
5. **Store variant IDs** locally for quick lookup

### Data Sync

1. **Track last update timestamp** for each product
2. **Detect price changes** for margin recalculation
3. **Monitor stock status** for inventory management
4. **Alert on discontinuation** of products
5. **Update availability** based on regions served

### User Experience

1. **Display print areas** visually to users
2. **Show material composition** for informed decisions
3. **Provide size guides** before checkout
4. **List available colors and sizes** clearly
5. **Show production time** in order timeline

---

## Rate Limits

### Unauthenticated Requests

- **Limit:** 30 requests per 60 seconds
- **Temporary block:** 60 seconds if exceeded
- **Use case:** Public catalog browsing

### Authenticated Requests

- **General limit:** 120 requests per minute
- **Recommended spacing:** 500-1000ms between requests

### Handling Rate Limits

```javascript
if (response.code === 429) {
  // Wait before retrying
  await delay(60000); // 60 seconds
  // Retry request
}
```

---

## See Also

- [Orders API Reference](printful-api-orders.md)
- [Products API Reference](printful-api-products.md)
- [API Overview](printful-api-overview.md)
