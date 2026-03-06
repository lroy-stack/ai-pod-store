# Printful API — File Library API

**Source:** https://developers.printful.com/docs/#tag/File-Library-API
**Fetched:** 2026-03-02

---

## Overview

The File Library API manages design files — uploading, retrieving, and analyzing print-ready assets. Files uploaded here can be referenced across multiple products and orders.

**Authentication:** Required (Bearer token)
**Required Scope:** `file_library` (read+write) or `file_library/read` (read only)
**Rate limit:** 120 requests per minute

---

## Endpoints

### 1. POST /files — Add File

**URL:** `POST https://api.printful.com/files`

Uploads a new file to the Printful File Library. Files can be added by URL (Printful fetches from your server) or by direct upload.

**Method 1: Upload by URL (Recommended)**

```bash
curl --request POST 'https://api.printful.com/files' \
  --header 'Authorization: Bearer {token}' \
  --header 'Content-Type: application/json' \
  --data '{
    "url": "https://your-cdn.com/design-front.png",
    "type": "default",
    "filename": "ghost-tee-front-v1.png",
    "visible": true
  }'
```

**Request Body (URL method):**
```json
{
  "url": "https://your-cdn.com/design-front.png",
  "type": "default",
  "filename": "ghost-tee-front-v1.png",
  "visible": true
}
```

**Method 2: Upload Multipart (Direct binary)**

```bash
curl --request POST 'https://api.printful.com/files' \
  --header 'Authorization: Bearer {token}' \
  --form 'file=@/path/to/design.png' \
  --form 'type=default' \
  --form 'filename=ghost-tee-front-v1.png'
```

**Request Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | Yes* | Public URL of the file (*required for URL method) |
| `filename` | string | No | Custom filename (defaults to filename from URL) |
| `type` | string | No | File type (`default`, `front`, `back`, `label_outside`, `embroidery`, etc.) |
| `visible` | boolean | No | Whether file appears in file library UI (default: true) |

**Response:**
```json
{
  "code": 200,
  "result": {
    "id": 98765432,
    "type": "default",
    "hash": "abc123def456",
    "url": null,
    "filename": "ghost-tee-front-v1.png",
    "mime_type": "image/png",
    "size": 2048576,
    "width": 4500,
    "height": 5400,
    "dpi": 300,
    "status": "ok",
    "created": 1677700000,
    "thumbnail_url": "https://files.cdn.printful.com/files/abc/preview.png",
    "preview_url": "https://files.cdn.printful.com/files/abc/preview_large.png",
    "visible": true,
    "is_temporary": false
  }
}
```

**Response File Object Fields:**

| Field | Type | Description |
|---|---|---|
| `id` | integer | Printful file ID — use this to reference in products |
| `type` | string | File type designation |
| `hash` | string | File hash for deduplication |
| `url` | string | Original source URL (null if uploaded by file) |
| `filename` | string | File name |
| `mime_type` | string | MIME type (e.g., `image/png`, `application/pdf`) |
| `size` | integer | File size in bytes |
| `width` | integer | Image width in pixels |
| `height` | integer | Image height in pixels |
| `dpi` | integer | DPI resolution |
| `status` | string | Processing status (`ok`, `waiting`, `failed`) |
| `created` | integer | UNIX timestamp of upload |
| `thumbnail_url` | string | Small preview URL |
| `preview_url` | string | Larger preview URL |
| `visible` | boolean | Visibility in file library |
| `is_temporary` | boolean | Whether file is temporary (auto-deleted) |

**File Status Values:**

| Status | Description |
|---|---|
| `ok` | File processed and ready for use |
| `waiting` | File being processed |
| `failed` | Processing failed |

---

### 2. GET /files/{id} — Retrieve File

**URL:** `GET https://api.printful.com/files/{id}`

Retrieves details for a specific file by its ID.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | File ID returned from POST /files |

**Example Request:**
```bash
curl 'https://api.printful.com/files/98765432' \
  --header 'Authorization: Bearer {token}'
```

**Response:** Same File object structure as POST /files response.

---

### 3. POST /files/colors — Get Thread Colors

**URL:** `POST https://api.printful.com/files/colors`

Analyzes an image and returns suggested embroidery thread colors that match the image's color palette. Useful for embroidery products.

**Request Body:**
```json
{
  "url": "https://your-cdn.com/embroidery-design.png"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | Yes | Public URL to the image to analyze |

**Response:**
```json
{
  "code": 200,
  "result": {
    "thread_colors": [
      {
        "name": "Black",
        "code": "1-1",
        "hex_code": "#0A0A0A",
        "r": 10,
        "g": 10,
        "b": 10
      },
      {
        "name": "White",
        "code": "1-2",
        "hex_code": "#FFFFFF",
        "r": 255,
        "g": 255,
        "b": 255
      },
      {
        "name": "Forest Green",
        "code": "3-15",
        "hex_code": "#228B22",
        "r": 34,
        "g": 139,
        "b": 34
      }
    ]
  }
}
```

**Thread Color Object:**

| Field | Type | Description |
|---|---|---|
| `name` | string | Thread color name |
| `code` | string | Thread color code (for Printful's thread catalog) |
| `hex_code` | string | Hex color value |
| `r` | integer | Red channel (0-255) |
| `g` | integer | Green channel (0-255) |
| `b` | integer | Blue channel (0-255) |

---

## File Requirements for Print

### DTG (Direct-to-Garment)
- **Format:** PNG preferred (transparent background supported)
- **Resolution:** Minimum 150 DPI, recommended 300 DPI
- **Color space:** RGB
- **Max file size:** Typically 200MB

### Embroidery
- **Format:** PNG (Printful converts to embroidery format)
- **Resolution:** Minimum 300 DPI
- **Colors:** Design should have flat/solid colors (no gradients for embroidery)
- **Max colors:** 3-6 thread colors depending on product
- **Additional cost:** Embroidery digitization fee applies

### Sublimation / All-Over Print
- **Format:** PNG
- **Resolution:** 150+ DPI
- **Color space:** RGB
- **Full bleed:** Design should cover entire print area

### Print File Size Guidelines by Product

| Product Type | Recommended Canvas | DPI |
|---|---|---|
| T-Shirt (front) | 4500 x 5400 px | 300 |
| T-Shirt (back) | 4500 x 5400 px | 300 |
| Hoodie (front) | 4500 x 5400 px | 300 |
| Hat (front) | 2000 x 800 px | 300 |
| Hat (side) | 1800 x 700 px | 300 |
| Mug (front) | 2700 x 2025 px | 150 |
| Tote bag | 4500 x 5400 px | 300 |

> Always verify exact dimensions with `GET /mockup-generator/printfiles/{product_id}`

---

## File Deduplication

Printful deduplicates files by hash. If you upload the same file twice, the second upload returns the same `id` as the first. This avoids bloating your file library.

---

## Using File IDs in Products

Once uploaded, reference files in sync product creation:

```json
{
  "sync_variants": [
    {
      "variant_id": 4011,
      "files": [
        {
          "id": 98765432,
          "placement": "front"
        }
      ]
    }
  ]
}
```

OR reference by URL (Printful will auto-upload):

```json
{
  "files": [
    {
      "placement": "front",
      "url": "https://your-cdn.com/design.png"
    }
  ]
}
```

---

## Migration Notes: Printify vs Printful File Uploads

| Feature | Printify | Printful |
|---|---|---|
| Upload endpoint | `POST /v1/uploads/images.json` | `POST /files` |
| Upload method | Base64 encoded in JSON body | URL or multipart |
| Cloudflare protection | Yes — blocks Python urllib, use curl | Not documented as an issue |
| File ID returned | `id` (used in print_areas) | `id` (used in files array) |
| Deduplication | No explicit mention | Yes — by file hash |
| Thread color analysis | No equivalent | `POST /files/colors` |
| File status | Not documented | `status`: ok/waiting/failed |
| Preview URLs | Not documented | `thumbnail_url` + `preview_url` |

### Key Difference: Upload Method

Printify requires **base64 encoding** in the request body:
```json
{ "file_name": "design.png", "contents": "base64-encoded-string..." }
```

Printful accepts a **public URL** — much simpler:
```json
{ "url": "https://your-cdn.com/design.png" }
```

This eliminates the base64 encoding step and the Cloudflare-related issues that made Python uploads fail with Printify.
