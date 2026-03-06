# Create a new Sync Variant

**Source**: Printful API OpenAPI Specification (extracted 2026-03-03)
**Tag**: Products API
**operationId**: `createSyncVariant`

---

## HTTP Method and Path

```
POST https://api.printful.com/store/products/{id}/variants
```

## Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | integer | **yes** | Sync Product ID (or `@{external_id}` for external IDs) |

## Authentication

```
Authorization: Bearer {oauth_token}
```

Required OAuth scope: `sync_products`

For account-level tokens, also include:
```
X-PF-Store-Id: {store_id}
```

---

## Request Body

**Content-Type**: `application/json`
**Required**: yes

Creates a new Sync Variant for an existing Sync Product.

### Schema

The request body is a SyncVariant object with `files` and `variant_id` required.

**Required fields**: `variant_id`, `files`

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `variant_id` | integer | **yes** | Printful Variant ID from the Printful Catalog | `4011` |
| `files` | array | **yes** | Array of attached printfiles / preview images | — |
| `external_id` | string | no | Variant ID from your Ecommerce platform | `"12312414"` |
| `retail_price` | string | no | Retail price that this item is sold for | `"19.00"` |
| `is_ignored` | boolean | no | Indicates if this Sync Variant is ignored | `false` |
| `sku` | string | no | SKU of this Sync Variant (nullable) | `"SKU1234"` |
| `options` | array | no | Array of additional options (ItemOption schema) | — |

### `files` Array (File schema)

Each file maps a placement to a design file URL. The `url` field is required on each file object.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `type` | string | no | Placement identifier: `"front"`, `"back"`, `"label_outside"`, etc. If omitted, uses default placement. | `"front"` |
| `url` | string | **yes** | Source URL where the file is downloaded from. Avoid .ai, .psd, .tiff (deprecated). | `"https://www.example.com/files/design.png"` |
| `id` | integer | no | File ID from Printful File Library (alternative to url) | `10` |
| `filename` | string | no | File name | `"shirt1.png"` |
| `visible` | boolean | no | Show file in Printfile Library (default true) | `true` |
| `options` | array | no | Array of FileOption objects for this file | — |

### `files[].options` Array (FileOption schema)

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `id` | string | **yes** | Option id | `"template_type"` |
| `value` | string | **yes** | Option value | `"native"` |

### `options` Array (ItemOption schema)

Used for product-level options such as embroidery type.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `id` | string | **yes** | Option id | `"embroidery_type"` |
| `value` | string | **yes** | Option value | `"flat"` |

---

## Response Body

**HTTP 200 OK**

```json
{
  "code": 200,
  "result": {
    "id": 10,
    "external_id": "12312414",
    "sync_product_id": 71,
    "name": "Red T-Shirt",
    "synced": true,
    "variant_id": 4011,
    "retail_price": "19.00",
    "currency": "USD",
    "is_ignored": false,
    "sku": null,
    "product": {
      "variant_id": 4011,
      "product_id": 71,
      "image": "https://files.cdn.printful.com/products/71/5309_1581412541.jpg",
      "name": "Bella + Canvas 3001 Unisex Short Sleeve Jersey T-Shirt (White / S)"
    },
    "files": [
      {
        "type": "front",
        "id": 10,
        "url": "https://www.example.com/files/design.png",
        "hash": "ea44330b887dfec278dbc4626a759547",
        "filename": "design.png",
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
        "is_temporary": false
      }
    ],
    "options": [],
    "main_category_id": 24,
    "warehouse_product_id": null,
    "warehouse_product_variant_id": null,
    "size": "S",
    "color": "White",
    "availability_status": "active"
  }
}
```

**HTTP 400 Bad Request**

```json
{
  "code": 400,
  "result": "Missing required parameters",
  "error": {
    "reason": "BadRequest",
    "message": "Missing required parameters"
  }
}
```

**HTTP 401 Unauthorized**

```json
{
  "code": 401,
  "result": "Unauthorized",
  "error": { "reason": "Unauthorized", "message": "Unauthorized" }
}
```

**HTTP 404 Not Found**

```json
{
  "code": 404,
  "result": "Not Found",
  "error": { "reason": "NotFound", "message": "Not Found" }
}
```

---

## Example Request (cURL)

```bash
curl --location --request POST 'https://api.printful.com/store/products/161636640/variants' \
--header 'Authorization: Bearer {oauth_token}' \
--data-raw '{
    "retail_price": "19.00",
    "variant_id": 4011,
    "files": [
        {
            "type": "back",
            "url": "https://picsum.photos/200/300?image=2"
        }
    ],
    "options": [
        {
            "id": "embroidery_type",
            "value": "flat"
        }
    ]
}'
```

---

## Notes

- Use the Printful **Variant ID** (not Product ID) for `variant_id`. Variant IDs map to specific size+color combinations in the Printful catalog.
- To reference a product by your external ID, use `@{external_id}` as the `{id}` path parameter.
- The `files` array maps each design file to a print placement. Common placement identifiers: `front`, `back`, `label_outside`. Use the [getPrintfiles endpoint](https://api.printful.com/mockup-generator/printfiles/{id}) to discover available placements for a specific product.
- You can use either `url` or `id` (from the Printful File Library) to reference a file.
- File formats `.ai`, `.psd`, `.tiff` are deprecated — use `.png` or `.jpg`.
- `retail_price` is a string type in the API schema.
- The `options` array supports product-level options such as embroidery type (`embroidery_type: flat|3d|digital`).
- Rate limit: 120 API calls per minute.
