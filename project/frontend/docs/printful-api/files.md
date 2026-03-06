# Printful API — File Library

**Base URL:** `https://api.printful.com`  
**Authentication:** Bearer token via `Authorization` header  
**Rate Limit:** 120 requests/minute

---

## Overview

The File Library API lets you upload and manage design files (print files) for use in Sync Products and orders. Files uploaded here are reusable across multiple products without re-uploading.

---

## File Object

```json
{
  "type": "default",
  "id": 10,
  "url": "https://www.example.com/files/tshirts/example.png",
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
  "dpi": 72,
  "status": "ok",
  "created": 1590051937,
  "thumbnail_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_thumb.png",
  "preview_url": "https://files.cdn.printful.com/files/ea4/ea44330b887dfec278dbc4626a759547_preview.png",
  "visible": true
}
```

### File Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique file ID (use this in Sync Variant files array) |
| `type` | string | File type (see File Types section) |
| `url` | string | Original source URL of the file |
| `hash` | string | MD5 hash of the file (used for deduplication) |
| `filename` | string | Original filename |
| `mime_type` | string | MIME type (e.g., `image/png`) |
| `size` | integer | File size in bytes |
| `width` | integer | Image width in pixels |
| `height` | integer | Image height in pixels |
| `dpi` | integer | Image DPI |
| `status` | string | Processing status: `ok`, `waiting`, `failed` |
| `created` | integer | Unix timestamp of upload |
| `thumbnail_url` | string | URL to thumbnail preview |
| `preview_url` | string | URL to full preview |
| `visible` | boolean | Whether file is visible in dashboard |

---

## Endpoints

### POST /files — Upload a File

Adds a new file to the File Library. The file is fetched from the provided URL and stored.

**Request Body:**

```json
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
```

### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | File type (see File Types section below) |
| `url` | string | Yes | Publicly accessible URL to the file (HTTPS recommended) |
| `filename` | string | No | Override filename |
| `visible` | boolean | No | Show in dashboard (default: `true`) |
| `options` | object[] | No | File processing options |

**Response 200:**

```json
{
  "code": 200,
  "result": {
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
    "is_temporary": false
  }
}
```

---

### GET /files/{file_id} — Get File

Retrieves information about a previously uploaded file.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `file_id` | integer | File ID returned from POST /files |

**Response 200:**

```json
{
  "code": 200,
  "result": {
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
    "is_temporary": false
  }
}
```

---

### POST /files/thread-colors — Suggest Thread Colors

Returns thread color suggestions from an uploaded image (for embroidery products).

**Request Body:**

```json
{
  "file_url": "https://example.com/my-logo.png"
}
```

**Response 200:**

```json
{
  "code": 200,
  "thread_colors": [
    "#FFFFFF"
  ]
}
```

---

## File Types

The `type` field determines the print placement:

| `type` | Description | Usage |
|--------|-------------|-------|
| `default` | Front print | DTG t-shirts, hoodies (main placement) |
| `back` | Back print | Products with back placement |
| `label_outside` | Outside neck label | Custom neck labels |
| `label_inside` | Inside neck label | Custom inside labels |
| `sleeve_left` | Left sleeve | Products with sleeve prints |
| `sleeve_right` | Right sleeve | Products with sleeve prints |
| `embroidery_front` | Front embroidery | Hats, caps, embroidered items |
| `embroidery_back` | Back embroidery | Embroidery products |
| `embroidery_left` | Left embroidery | Hats with left placement |
| `embroidery_right` | Right embroidery | Hats with right placement |
| `embroidery_chest_left` | Left chest embroidery | Polos, hoodies |
| `embroidery_chest_right` | Right chest embroidery | Polos, hoodies |
| `preview` | Product preview | Not for printing, display only |

---

## File Status Values

| Status | Description |
|--------|-------------|
| `ok` | File processed and ready for use |
| `waiting` | File is being processed (check again in a few seconds) |
| `failed` | Processing failed — re-upload the file |

---

## File Options

The `options` array in the file upload request supports:

| Option `id` | Value | Description |
|-------------|-------|-------------|
| `template_type` | `native` | Use native print resolution |
| `template_type` | `legacy` | Use legacy template dimensions |

---

## Print File Requirements

| Requirement | Specification |
|-------------|---------------|
| Format | PNG (recommended), JPEG, SVG |
| Color mode | sRGB (not CMYK) |
| DPI | Minimum 150 DPI; 300 DPI recommended |
| Max file size | 200 MB |
| Max dimensions | 12000 × 12000 pixels |
| Transparency | Supported in PNG |

### Recommended Dimensions by Category

| Product Type | Width | Height | DPI |
|-------------|-------|--------|-----|
| T-Shirts (DTG) | 4500px | 5400px | 300 |
| Hoodies (DTG) | 4500px | 5400px | 300 |
| Mugs | 2700px | 1050px | 150 |
| Phone Cases | 1800px | 2700px | 150 |
| Posters | 4500px | 6300px | 150 |
| Tote Bags | 4500px | 5400px | 150 |

---

## Error Codes — File Library

| Code | Description |
|------|-------------|
| 400 | Bad request — invalid URL, unsupported format |
| 401 | Unauthorized |
| 404 | File not found |
| 413 | File too large (max 200 MB) |
| 422 | Unprocessable — file format not supported |
| 429 | Rate limit exceeded |

---

## Example: Upload and Use a File

```javascript
// 1. Upload file to library
const uploadResponse = await fetch("https://api.printful.com/files", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_TOKEN",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "type": "default",
    "url": "https://your-cdn.com/designs/ghost-dev-front.png",
    "filename": "ghost-dev-front.png"
  })
});

const { result: file } = await uploadResponse.json();
// file.id = 12345 (use this in variant files array)

// 2. Reference file by ID in a Sync Variant
const variantFiles = [
  {
    "id": file.id,  // use file ID instead of URL
    "type": "default"
  }
];
```
