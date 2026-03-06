# Printful API Reference

Base URL: `https://api.printful.com`

## Authentication

ALL requests require:
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
```

Env vars are in `frontend/.env.local`:
- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID`

---

## File Library

### Upload File

```
POST /files
Content-Type: multipart/form-data
```

Two methods:
1. **URL upload**: `-F "url=https://example.com/image.png"`
2. **File upload**: `-F "file=@path/to/image.png"`

Both require: `-F "type=default"`

**Response:**
```json
{
  "code": 200,
  "result": {
    "id": 950357086,
    "type": "default",
    "hash": "abc123...",
    "url": "https://files.cdn.printful.com/files/abc/abc123_preview.png",
    "filename": "sleeve-left-600x525.png",
    "size": 12345,
    "width": 600,
    "height": 525,
    "status": "ok"
  }
}
```

The `id` (integer) is used in variant file updates. The `url` (preview URL) is used in mockup generation.

### List Files

```
GET /files?offset=0&limit=20
```

---

## Sync Products

### Get Product

```
GET /store/products/{sync_product_id}
```

Returns `sync_product` + `sync_variants[]`. Each variant has:
- `id`: Sync variant ID (for updates)
- `variant_id`: Catalog variant ID (for mockup generation)
- `files[]`: Array of `{type, id, preview_url}`
- `name`: Variant name (e.g., "Black / M")

### Update Product (Bulk Variants)

```
PUT /store/products/{sync_product_id}
```

Body:
```json
{
  "sync_variants": [
    {
      "id": 123456,
      "files": [
        {"type": "default", "id": 950357001},
        {"type": "sleeve_left", "id": 950357086},
        {"type": "back", "id": 950357114}
      ]
    }
  ]
}
```

This updates ALL listed variants in one call. More efficient than per-variant updates.

### Update Single Variant

```
PUT /store/variants/{sync_variant_id}
```

Body:
```json
{
  "files": [
    {"type": "default", "id": FRONT_FILE_ID},
    {"type": "sleeve_left", "id": SLEEVE_FILE_ID},
    {"type": "back", "id": BACK_FILE_ID}
  ]
}
```

---

## Mockup Generator

### Create Task

```
POST /mockup-generator/create-task/{catalog_product_id}
```

Body:
```json
{
  "variant_ids": [15114],
  "format": "png",
  "width": 1000,
  "option_groups": ["Ghost"],
  "options": ["Front", "Left", "Back"],
  "files": [
    {
      "placement": "front",
      "image_url": "https://...",
      "position": {
        "area_width": 1800,
        "area_height": 2400,
        "width": 1800,
        "height": 2400,
        "top": 0,
        "left": 0
      }
    }
  ]
}
```

**Parameters:**
- `variant_ids`: Array of **catalog** variant IDs (NOT sync variant IDs)
- `format`: `"png"` (transparent) or `"jpg"` (white background)
- `width`: Output image width in pixels
- `option_groups`: Mockup style (see MOCKUP_OPTIONS.md)
- `options`: Camera view angles
- `files[].placement`: Print position on garment
- `files[].image_url`: Public URL of the design to render
- `files[].position`: Canvas dimensions and position

**Response:**
```json
{
  "code": 200,
  "result": {
    "task_key": "gt-1234567890",
    "status": "pending"
  }
}
```

### Poll Task

```
GET /mockup-generator/task?task_key=gt-1234567890
```

**Status values:** `pending` | `completed` | `failed`

**Completed response:**
```json
{
  "result": {
    "status": "completed",
    "mockups": [
      {
        "placement": "front",
        "variant_ids": [15114],
        "mockup_url": "https://s3.amazonaws.com/..."
      },
      {
        "placement": "back",
        "variant_ids": [15114],
        "mockup_url": "https://s3.amazonaws.com/..."
      }
    ]
  }
}
```

Each `mockups[]` entry = one placement. URLs are temporary S3 (~24h).

### Get Printfiles (Available Positions)

```
GET /mockup-generator/printfiles/{catalog_product_id}
```

Returns available placements, dimensions, and variant coverage.

---

## Rate Limits

| Endpoint | Limit | Recommended Delay |
|---|---|---|
| General API | ~120 req/min | 2000ms between calls |
| Mockup Generator | ~10 req/min | 8000-10000ms between tasks |
| File uploads | ~30 req/min | 3000ms between uploads |

On HTTP 429:
1. Read `x-ratelimit-reset` header (seconds until reset)
2. Wait that many seconds
3. Retry the request

---

## Error Handling

| Code | Meaning | Action |
|---|---|---|
| 200 | Success | Process response |
| 400 | Bad request | Check payload structure |
| 401 | Unauthorized | Verify token + store ID |
| 404 | Not found | Check product/variant ID |
| 429 | Rate limited | Wait + retry |
| 500 | Server error | Wait 10s + retry once |
