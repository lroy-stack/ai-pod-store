# Printful Products API Reference (Sync Products)

## Overview

The Products API (also called Sync Products API) allows you to manage products in your Printful store. You can create, retrieve, modify, and delete sync products, as well as manage variants.

**Base URL:** `https://api.printful.com/`

**Authentication:** Bearer token required

**Endpoint Prefix:** `/sync/` (or `/sync/products/`)

---

## Sync Products Endpoints

### List Sync Products

Retrieve all products in your store with pagination.

```http
GET /sync/products?offset=0&limit=20
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | integer | 0 | Number of results to skip |
| `limit` | integer | 20 | Maximum results per page (1-100) |

**Response:**

```json
{
  "code": 200,
  "result": [
    {
      "id": 567,
      "external_id": "ext_product_567",
      "name": "Classic T-Shirt",
      "description": "Premium cotton t-shirt",
      "image": "https://storage.printful.com/products/...",
      "created": 1609459200,
      "updated": 1609545600,
      "synced": true,
      "variants": [
        {
          "id": 1234,
          "external_id": "ext_var_1234",
          "sync_product_id": 567,
          "name": "White / S",
          "sku": "tee-white-s",
          "color": "White",
          "size": "S",
          "price": "19.99",
          "currency": "USD",
          "retail_price": "24.99",
          "weight": "200g",
          "in_stock": true
        }
      ]
    }
  ],
  "paging": {
    "total": 150,
    "offset": 0,
    "limit": 20
  }
}
```

---

### Get Sync Product

Retrieve a specific product by ID.

```http
GET /sync/products/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Sync product ID |

**Response:**

Returns complete sync product object (see List response structure).

---

### Create Sync Product

Create a new product in your store.

```http
POST /sync/products
Content-Type: application/json
```

**Request Body:**

```json
{
  "external_id": "ext_product_567",
  "name": "Classic T-Shirt",
  "description": "High-quality cotton t-shirt",
  "image": "https://example.com/product.jpg",
  "blueprint_id": 123,
  "print_provider_id": 26,
  "variants": [
    {
      "external_id": "ext_var_white_s",
      "sku": "tee-white-s",
      "name": "White / S",
      "color": "White",
      "size": "S",
      "color_code": "#FFFFFF",
      "product_template_id": 456,
      "files": [
        {
          "type": "front",
          "id": "file_id_123"
        }
      ],
      "options": [
        {
          "id": "pod_full_color_front",
          "value": true
        }
      ],
      "price": 1299,
      "cost": 599,
      "enabled": true
    }
  ],
  "description_template": {
    "title": "{{product_name}}",
    "description": "Premium {{color}} {{product_type}} - Size {{size}}"
  }
}
```

**Required Fields:**

- `name` - Product name (max 255 chars)
- `blueprint_id` - Printful blueprint ID (product template)
- `print_provider_id` - Provider ID (26 for DTG, 410 for embroidery, etc.)
- `variants` - At least one variant

**Blueprint ID Examples:**

| Product Type | Blueprint ID | Provider |
|--------------|--------------|----------|
| T-Shirt (DTG) | 123 | P26 |
| Hoodie (DTG) | 145 | P26 |
| Cap (Embroidery) | 831 | P410 |
| Beanie (Embroidery) | 177 | P410 |
| Mug (Sublimation) | 88 | P26 |

**Variant Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `external_id` | string | No | Your system ID for variant |
| `sku` | string | No | Stock keeping unit |
| `name` | string | No | Variant display name |
| `color` | string | No | Color name |
| `size` | string | No | Size value |
| `color_code` | string | No | Hex color code (#FFFFFF) |
| `files` | array | No | Design files with placements |
| `options` | array | No | Product-specific options |
| `price` | integer | No | Price in cents (USD) |
| `cost` | integer | No | Production cost in cents |
| `enabled` | boolean | Yes | Is variant available for sale |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": 567,
    "external_id": "ext_product_567",
    "name": "Classic T-Shirt",
    "synced": false,
    "variants": [
      {
        "id": 1234,
        "sync_product_id": 567,
        "external_id": "ext_var_white_s",
        "sku": "tee-white-s"
      }
    ]
  }
}
```

---

### Modify Sync Product

Update an existing product.

```http
PUT /sync/products/{id}
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Sync product ID |

**Request Body:**

```json
{
  "name": "Premium Classic T-Shirt",
  "description": "Updated description",
  "image": "https://example.com/product-v2.jpg"
}
```

**Updatable Fields:**

- `name` - Product name
- `description` - Product description
- `image` - Product image URL

**Non-Updatable Fields:**

- `blueprint_id`
- `print_provider_id`
- `variants` (use variant endpoints instead)

---

### Delete Sync Product

Remove a product from your store.

```http
DELETE /sync/products/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | integer | Sync product ID |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": 567,
    "deleted": true
  }
}
```

---

## Variant Management

### Get Variant

Retrieve a specific variant of a product.

```http
GET /sync/products/{product_id}/variants/{variant_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `product_id` | integer | Sync product ID |
| `variant_id` | integer | Variant ID |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": 1234,
    "sync_product_id": 567,
    "external_id": "ext_var_white_s",
    "sku": "tee-white-s",
    "name": "White / S",
    "color": "White",
    "size": "S",
    "color_code": "#FFFFFF",
    "price": "19.99",
    "retail_price": "24.99",
    "currency": "USD",
    "cost": "8.99",
    "weight": "200g",
    "in_stock": true,
    "enabled": true,
    "files": [
      {
        "id": "file_id_123",
        "type": "front",
        "hash": "abc123def456",
        "url": "https://storage.printful.com/..."
      }
    ],
    "options": [
      {
        "id": "pod_full_color_front",
        "value": true
      }
    ]
  }
}
```

---

### Add Variant

Add a new variant to an existing product.

```http
POST /sync/products/{product_id}/variants
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `product_id` | integer | Sync product ID |

**Request Body:**

```json
{
  "external_id": "ext_var_black_m",
  "sku": "tee-black-m",
  "name": "Black / M",
  "color": "Black",
  "size": "M",
  "color_code": "#000000",
  "files": [
    {
      "type": "front",
      "id": "file_id_123"
    }
  ],
  "price": 1299,
  "cost": 599,
  "enabled": true
}
```

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": 1235,
    "sync_product_id": 567,
    "external_id": "ext_var_black_m",
    "sku": "tee-black-m"
  }
}
```

---

### Update Variant

Modify an existing variant.

```http
PUT /sync/products/{product_id}/variants/{variant_id}
Content-Type: application/json
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `product_id` | integer | Sync product ID |
| `variant_id` | integer | Variant ID |

**Request Body:**

```json
{
  "price": 2299,
  "cost": 899,
  "enabled": true,
  "sku": "tee-black-m-v2",
  "files": [
    {
      "type": "front",
      "id": "file_id_456"
    }
  ]
}
```

**Updatable Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sku` | string | Stock keeping unit |
| `color` | string | Color name |
| `size` | string | Size value |
| `color_code` | string | Hex color code |
| `price` | integer | Price in cents |
| `cost` | integer | Production cost in cents |
| `enabled` | boolean | Is variant available |
| `files` | array | Design files |
| `options` | array | Product options |

---

### Delete Variant

Remove a variant from a product.

```http
DELETE /sync/products/{product_id}/variants/{variant_id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `product_id` | integer | Sync product ID |
| `variant_id` | integer | Variant ID |

**Response:**

```json
{
  "code": 200,
  "result": {
    "id": 1234,
    "deleted": true
  }
}
```

---

## Product Data Structures

### Sync Product Object

```json
{
  "id": 567,
  "external_id": "ext_product_567",
  "name": "Classic T-Shirt",
  "description": "High-quality cotton t-shirt for everyday wear",
  "image": "https://storage.printful.com/products/...",
  "created": 1609459200,
  "updated": 1609545600,
  "synced": true,
  "synced_at": 1609545600,
  "blueprint_id": 123,
  "print_provider_id": 26,
  "variants": [
    { /* Variant objects */ }
  ]
}
```

### Variant Object

```json
{
  "id": 1234,
  "sync_product_id": 567,
  "external_id": "ext_var_white_s",
  "sku": "tee-white-s",
  "name": "White / S",
  "color": "White",
  "size": "S",
  "color_code": "#FFFFFF",
  "color_code2": null,
  "product_template_id": 456,
  "price": 1999,
  "cost": 899,
  "retail_price": 2499,
  "currency": "USD",
  "weight": 200,
  "weight_unit": "g",
  "in_stock": true,
  "enabled": true,
  "files": [
    {
      "id": "file_id_123",
      "type": "front",
      "hash": "abc123def456",
      "url": "https://storage.printful.com/...",
      "filename": "design.png"
    }
  ],
  "options": [
    {
      "id": "pod_full_color_front",
      "value": true
    }
  ],
  "template": {
    "color_template": "white",
    "image_placement": "front_center"
  }
}
```

### File Object

```json
{
  "id": "file_id_123",
  "type": "front",
  "hash": "abc123def456",
  "url": "https://storage.printful.com/files/files/...",
  "filename": "design.png",
  "mime_type": "image/png"
}
```

### Options Array

```json
[
  {
    "id": "pod_full_color_front",
    "value": true,
    "display_name": "Full Color Front",
    "type": "addon"
  }
]
```

---

## Pricing Information

### Price Fields

| Field | Type | Description |
|-------|------|-------------|
| `price` | integer | Your wholesale price in cents |
| `cost` | integer | Printful production cost in cents |
| `retail_price` | integer | Suggested retail price in cents |
| `currency` | string | Currency code (USD, EUR, etc.) |

### Pricing Example

```
Price: 1999 cents = $19.99 (your cost)
Cost: 899 cents = $8.99 (Printful production)
Retail: 2499 cents = $24.99 (suggested selling price)

Margin: ($19.99 - $8.99) / $19.99 = 55% markup
```

### Price Calculations

- **Production cost** comes from Printify catalog
- **Your price** is what you pay Printful per unit
- **Retail price** is suggested selling price
- **Customer price** is what you charge customers

**Common Margin Requirements:**
- Minimum viable: 25-35%
- Healthy margin: 40-50%
- High margin: 60%+

---

## File Management in Variants

### File Types (Placements)

| Placement | Product | Description |
|-----------|---------|-------------|
| `front` | T-Shirts, Hoodies | Front chest area |
| `back` | T-Shirts, Hoodies | Back center |
| `sleeve` | Long Sleeves, Hoodies | Sleeve area |
| `label` | Caps, Hats | Label area |
| `left` | Caps | Left side |
| `right` | Caps | Right side |
| `center_front` | Hoodies | Front center (large) |

### Adding Files to Variants

Files must be uploaded to the File Library first, then referenced by ID:

```json
{
  "files": [
    {
      "type": "front",
      "id": "file_id_123"
    },
    {
      "type": "back",
      "id": "file_id_456"
    }
  ]
}
```

---

## Product Publishing Workflow

### Before Publishing

1. **Create Product** - POST /sync/products
2. **Add Variants** - POST /sync/products/{id}/variants
3. **Upload Files** - POST /files (separate endpoint)
4. **Set Pricing** - In variant configuration
5. **Verify GPSR** - If EU products

### Publishing Status

Products have a `synced` flag:

- `synced: false` - Product created but not yet published
- `synced: true` - Product published and visible in catalog

### Sync to Printify

After creating a product in sync products:

1. Printful validates configuration
2. Creates variants in Printify system
3. Sets `synced: true`
4. Generates variant IDs

---

## Common Workflows

### Creating a Complete Product

```
1. POST /sync/products
   - Set blueprint_id, provider_id, name

2. POST /sync/products/{id}/variants (for each variant)
   - Set colors, sizes, prices

3. POST /files
   - Upload design files

4. PUT /sync/products/{product_id}/variants/{variant_id}
   - Add file IDs to variant

5. Verify synced=true
   - Product ready for orders
```

### Updating Variant Pricing

```
PUT /sync/products/{product_id}/variants/{variant_id}
{
  "price": 2299,
  "cost": 999,
  "enabled": true
}
```

### Managing Product Images

```
- Use high-quality images
- Recommended: 500x500px or larger
- Formats: JPG, PNG
- Update via PUT /sync/products
```

---

## Error Scenarios

### Invalid Blueprint ID

```json
{
  "code": 422,
  "error": {
    "reason": "ValidationFailed",
    "message": "Blueprint ID 9999 is invalid or unavailable"
  }
}
```

### Variant Already Exists

```json
{
  "code": 422,
  "error": {
    "reason": "DuplicateVariant",
    "message": "Variant with SKU 'tee-white-s' already exists"
  }
}
```

### File Not Found

```json
{
  "code": 404,
  "error": {
    "reason": "NotFound",
    "message": "File ID 'file_id_999' not found"
  }
}
```

### Product Limit Exceeded

```json
{
  "code": 429,
  "error": {
    "reason": "LimitExceeded",
    "message": "Product creation limit for this plan exceeded"
  }
}
```

---

## Best Practices

### Product Management

1. **Use external_id** for system integration
2. **Set unique SKUs** for each variant
3. **Use meaningful names** for products and variants
4. **Upload high-res images** for better display
5. **Test with draft variants** before publishing

### Pricing

1. **Calculate margins** before setting prices
2. **Monitor cost changes** from Printful
3. **Adjust pricing** periodically
4. **Use cost field** for accurate margin tracking
5. **Consider bulk discounts** for customers

### File Management

1. **Upload files once**, reference by ID
2. **Use appropriate file types** for each placement
3. **Test files** with mockup generator
4. **Keep file history** for reference
5. **Monitor file size** (1-20MB typical)

### Variant Management

1. **Create variants systematically** (all colors × all sizes)
2. **Don't delete variants** with orders (archive instead)
3. **Enable/disable** rather than delete for stock control
4. **Test ordering** before making live
5. **Monitor stock status** via in_stock flag

---

## Rate Limits

- General limit: **120 API calls per minute**
- Product creation: **10 per minute** (lower limit for resource-intensive operation)
- Recommended spacing: **500-1000ms** between requests

---

## See Also

- [Catalog API Reference](printful-api-catalog.md)
- [Orders API Reference](printful-api-orders.md)
- [File Library API](printful-api-overview.md#file-library-api)
