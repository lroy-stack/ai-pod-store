# Create a new Sync Product

**Source**: Printful API OpenAPI Specification (extracted 2026-03-03)
**Tag**: Products API
**operationId**: `createSyncProduct`

---

## HTTP Method and Path

```
POST https://api.printful.com/store/products
```

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

### Schema

```json
{
  "type": "object",
  "title": "Product",
  "description": "Information about the Sync Product",
  "required": ["sync_product", "sync_variants"],
  "properties": {
    "sync_product": { "$ref": "SyncProduct" },
    "sync_variants": {
      "type": "array",
      "description": "Information about the Sync Variants",
      "items": {
        "required": ["files", "variant_id"],
        "$ref": "SyncVariant"
      }
    }
  }
}
```

### `sync_product` Object (SyncProduct schema)

| Field | Type | Required | Read-only | Description | Example |
|---|---|---|---|---|---|
| `id` | integer | no | yes | SyncProduct ID | `13` |
| `external_id` | string | no | no | Product ID from the Ecommerce platform | `"4235234213"` |
| `name` | string | **yes** | no | Product name | `"T-shirt"` |
| `variants` | integer | no | yes | Total number of Sync Variants belonging to this product | `10` |
| `synced` | integer | no | yes | Number of synced Sync Variants belonging to this product | `10` |
| `thumbnail` | string | no | no (write-only) | Thumbnail image URL. Max 250 chars. Recommended to keep small. | `"http://your-domain.com/path/to/thumbnail.png"` |
| `thumbnail_url` | string | no | yes | Thumbnail image for the product (returned in responses) | `"https://your-domain.com/path/to/image.png"` |
| `is_ignored` | boolean | no | no | Indicates if this Sync Product is ignored | `false` |

### `sync_variants` Array Items (SyncVariant schema)

**Required fields on creation**: `files`, `variant_id`

| Field | Type | Required | Read-only | Description | Example |
|---|---|---|---|---|---|
| `id` | integer | no | yes | Sync Variant ID | `10` |
| `external_id` | string | no | no | Variant ID from the Ecommerce platform | `"12312414"` |
| `sync_product_id` | integer | no | yes | Sync Product ID that this variant belongs to | `71` |
| `name` | string | no | yes | Sync Variant name | `"Red T-Shirt"` |
| `synced` | boolean | no | yes | Indicates if this Sync Variant is properly linked with Printful product | `true` |
| `variant_id` | integer | **yes** | no | Printful Variant ID that this Sync Variant is synced to | `3001` |
| `retail_price` | string | no | no | Retail price that this item is sold for | `"29.99"` |
| `currency` | string | no | yes | Currency in which prices are returned | `"USD"` |
| `is_ignored` | boolean | no | no | Indicates if this Sync Variant is ignored | `true` |
| `sku` | string | no | no | SKU of this Sync Variant (nullable) | `"SKU1234"` |
| `product` | object | no | yes | Short info about the Printful Product and Variant (ProductVariant schema) | — |
| `files` | array | **yes** | no | Array of attached printfiles / preview images (SyncVariantFile schema) | — |
| `options` | array | no | no | Array of additional options for the configured product/variant (ItemOption schema) | — |
| `main_category_id` | integer | no | yes | Printful Variant catalog category ID (nullable) | `24` |
| `warehouse_product_id` | integer | no | yes | Warehousing product ID (nullable) | `3002` |
| `warehouse_product_variant_id` | integer | no | yes | Warehousing variant ID (nullable) | `3002` |
| `size` | string | no | yes | The size of the associated Catalog Variant (nullable) | `"XS"` |
| `color` | string | no | yes | The color of the associated Catalog Variant (nullable) | `"White"` |
| `availability_status` | string | no | no | Status of the Sync Variant. Enum: `active`, `discontinued`, `out_of_stock`, `temporary_out_of_stock` | `"active"` |

### `files` Array (SyncVariantFile / File schema)

Each file in the `files` array on a variant. The `url` field is required.

| Field | Type | Required | Read-only | Description | Example |
|---|---|---|---|---|---|
| `type` | string | no | no | Role/placement of the file (e.g. `"front"`, `"back"`, `"default"`) | `"front"` |
| `id` | integer | no | yes | File ID (from Printful File Library) | `10` |
| `url` | string | **yes** | no | Source URL where the file is downloaded from. Avoid .ai, .psd, .tiff (deprecated). | `"https://www.example.com/files/tshirts/example.png"` |
| `options` | array | no | no | Array of FileOption objects | — |
| `hash` | string | no | yes | MD5 checksum of the file | `"ea44330b887dfec278dbc4626a759547"` |
| `filename` | string | no | no | File name | `"shirt1.png"` |
| `mime_type` | string | no | yes | MIME type of the file | `"image/png"` |
| `size` | integer | no | yes | Size in bytes | `45582633` |
| `width` | integer | no | yes | Width in pixels | `1000` |
| `height` | integer | no | yes | Height in pixels | `1000` |
| `dpi` | integer | no | yes | Resolution DPI | `300` |
| `status` | string | no | yes | File processing status: `ok`, `waiting`, `failed` | `"ok"` |
| `created` | integer | no | yes | File creation timestamp (Unix) | `1590051937` |
| `thumbnail_url` | string | no | yes | Small thumbnail URL | `"https://files.cdn.printful.com/..."` |
| `preview_url` | string | no | yes | Medium preview image URL | `"https://files.cdn.printful.com/..."` |
| `visible` | boolean | no | no | Show file in the Printfile Library (default true) | `true` |
| `is_temporary` | boolean | no | yes | Whether it is a temporary printfile | `false` |
| `stitch_count_tier` | string | no | yes | Stitch count tier for embroidery (nullable) | `"stitch_tier_1"` |

### `options` Array (ItemOption schema)

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `id` | string | **yes** | Option id | `"embroidery_type"` |
| `value` | string | **yes** | Option value | `"flat"` |

### `files[].options` Array (FileOption schema)

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `id` | string | **yes** | Option id | `"template_type"` |
| `value` | string | **yes** | Option value | `"native"` |

---

## Response Body

**HTTP 200 OK**

```json
{
  "code": 200,
  "result": {
    /* SyncProduct object — see sync_product schema above */
  }
}
```

The `result` object is a SyncProduct with all read-only fields populated.

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
  "error": {
    "reason": "Unauthorized",
    "message": "Unauthorized"
  }
}
```

---

## Example Request (cURL)

```bash
curl --location --request POST 'https://api.printful.com/store/products' \
--header 'Authorization: Bearer {oauth_token}' \
--data-raw '{
    "sync_product": {
        "name": "T-Shirt",
        "thumbnail": "https://picsum.photos/200/300"
    },
    "sync_variants": [
        {
            "retail_price": 21.00,
            "variant_id": 4011,
            "files": [
                {
                    "url": "https://picsum.photos/200/300?image=1"
                },
                {
                    "type": "back",
                    "url": "https://picsum.photos/200/300?image=1"
                }
            ]
        },
        {
            "retail_price": 21.00,
            "variant_id": 4012,
            "files": [
                {
                    "url": "https://picsum.photos/200/300?image=1"
                },
                {
                    "type": "back",
                    "url": "https://picsum.photos/200/300?image=1"
                }
            ]
        }
    ]
}'
```

---

## Notes

- **Always use Variant IDs, not Product IDs** when creating products or orders. Variant IDs refer to specific SKUs (size + color combinations) in the Printful catalog.
- The `files` array on each sync variant maps print placement positions to design files. The `type` field in each file object identifies the placement (e.g. `"front"`, `"back"`, `"label_outside"`).
- If `type` is omitted, the default placement for the product is used.
- File `.ai`, `.psd`, and `.tiff` formats are deprecated — use `.png` or `.jpg`.
- `retail_price` is a string type (not number) in the schema.
- The `thumbnail` field is write-only on creation; the read-only `thumbnail_url` is returned in responses.
- Rate limit: 120 API calls per minute.
