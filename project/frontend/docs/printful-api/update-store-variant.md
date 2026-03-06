# Modify a Sync Variant

**Source**: Printful API OpenAPI Specification (extracted 2026-03-03)
**Tag**: Products API
**operationId**: `updateSyncVariant`

---

## HTTP Method and Path

```
PUT https://api.printful.com/store/variants/{id}
```

## Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | integer | **yes** | Sync Variant ID (or `@{external_id}` for external IDs) |

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

Modifies an existing Sync Variant. Only specify the fields that need to be changed — all fields are optional.

### Schema

The request body is a SyncVariant object. All fields are optional; only send what you want to update.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `id` | integer | no | Sync Variant ID. Specify the IDs of all Sync Variants you wish to keep. | `10` |
| `variant_id` | integer | no | Printful Variant ID to re-link this Sync Variant to | `4011` |
| `external_id` | string | no | Variant ID from your Ecommerce platform | `"12312414"` |
| `retail_price` | string | no | Retail price that this item is sold for | `"25.00"` |
| `is_ignored` | boolean | no | Indicates if this Sync Variant is ignored | `false` |
| `sku` | string | no | SKU of this Sync Variant (nullable) | `"SKU1234"` |
| `files` | array | no | Array of attached printfiles / preview images (File schema) | — |
| `options` | array | no | Array of additional options (ItemOption schema) | — |

### `files` Array (File schema)

When updating files, provide the complete new set of files you want associated. Each file requires `url`.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `type` | string | no | Placement identifier: `"front"`, `"back"`, etc. | `"front"` |
| `url` | string | **yes** | Source URL where the file is downloaded from | `"https://www.example.com/files/design.png"` |
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
    "retail_price": "25.00",
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

## Example Request (cURL) — Update price and variant link

```bash
curl --location --request PUT 'https://api.printful.com/store/variants/161636640' \
--header 'Authorization: Bearer {oauth_token}' \
--data-raw '{
    "retail_price": "25.00",
    "variant_id": 4011
}'
```

## Example Request (cURL) — Update design file

```bash
curl --location --request PUT 'https://api.printful.com/store/variants/161636640' \
--header 'Authorization: Bearer {oauth_token}' \
--data-raw '{
    "files": [
        {
            "type": "front",
            "url": "https://www.example.com/files/new-design.png"
        },
        {
            "type": "back",
            "url": "https://www.example.com/files/new-back-design.png"
        }
    ]
}'
```

---

## Notes

- **Partial updates**: Only include fields you want to change. Unspecified fields retain their existing values.
- To reference a variant by your external ID, use `@{external_id}` as the `{id}` path parameter (e.g. `@32142`).
- When updating `files`, the provided array replaces the existing files for those placements.
- `retail_price` is a string type in the API schema (e.g. `"25.00"`, not `25.00`).
- The `availability_status` field in the response reflects the linked Printful catalog variant's status: `active`, `discontinued`, `out_of_stock`, `temporary_out_of_stock`.
- Rate limit: 120 API calls per minute.
