# Printful API — Mockup Generator API

**Source:** https://developers.printful.com/docs/#tag/Mockup-Generator-API
**Fetched:** 2026-03-02

---

## Overview

The Mockup Generator API creates product preview images (mockups) by compositing your design files onto product photos. This is an asynchronous API — you create a task, then poll for results.

**Authentication:** Required (Bearer token)
**Rate limit:** Lower than general API (resource-intensive). The general 120 req/min does NOT apply — rate limit is significantly lower. Space requests out generously.

---

## How It Works

```
1. GET /mockup-generator/printfiles/{id}    →  Discover available print areas and sizes
2. POST /mockup-generator/create-task/{id}  →  Submit mockup generation task (async)
3. GET /mockup-generator/task?task_key={key} →  Poll for task completion
4. Download mockup images from result URLs
```

---

## Endpoints

### 1. GET /mockup-generator/printfiles/{id} — Get Printfiles

**URL:** `GET https://api.printful.com/mockup-generator/printfiles/{id}`

Returns the printfile specifications for a product — the available print areas, their dimensions, and variants.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | Printful Product ID (from Catalog API) |

**Example Request:**
```bash
curl 'https://api.printful.com/mockup-generator/printfiles/71' \
  --header 'Authorization: Bearer {token}'
```

**Response:**
```json
{
  "code": 200,
  "result": {
    "product_id": 71,
    "available_placements": {
      "front": "Front print",
      "back": "Back print",
      "label_outside": "Outside label"
    },
    "printfiles": [
      {
        "printfile_id": 1,
        "width": 4500,
        "height": 5400,
        "dpi": 300,
        "fill_mode": "fit",
        "can_rotate": false
      }
    ],
    "variant_printfiles": [
      {
        "variant_id": 4011,
        "placements": {
          "front": 1,
          "back": 2
        }
      }
    ]
  }
}
```

**Response Fields:**

| Field | Description |
|---|---|
| `available_placements` | Map of placement ID → display name |
| `printfiles` | Array of printfile specs (dimensions, DPI) |
| `variant_printfiles` | Per-variant mapping of placements to printfile IDs |

**Printfile Object:**

| Field | Type | Description |
|---|---|---|
| `printfile_id` | integer | Printfile specification ID |
| `width` | integer | Canvas width in pixels |
| `height` | integer | Canvas height in pixels |
| `dpi` | integer | DPI for print quality |
| `fill_mode` | string | `fit` (maintain aspect) or `cover` (fill canvas) |
| `can_rotate` | boolean | Whether design can be rotated |

---

### 2. GET /mockup-generator/layouts — Get Available Layouts (Optional)

**URL:** `GET https://api.printful.com/mockup-generator/layouts/{id}`

Returns available layout/lifestyle templates for mockup generation. These are the background/scene options.

---

### 3. POST /mockup-generator/create-task/{id} — Create Mockup Task

**URL:** `POST https://api.printful.com/mockup-generator/create-task/{id}`

Submits an asynchronous mockup generation task.

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | integer | Printful Product ID |

**Request Body:**
```json
{
  "variant_ids": [4011, 4012, 4013],
  "format": "jpg",
  "width": 1000,
  "product_options": {},
  "optionGroups": ["Front"],
  "files": [
    {
      "placement": "front",
      "image_url": "https://your-cdn.com/design-front.png",
      "position": {
        "area_width": 1800,
        "area_height": 2400,
        "width": 1200,
        "height": 1200,
        "top": 600,
        "left": 300
      }
    },
    {
      "placement": "back",
      "image_url": "https://your-cdn.com/design-back.png"
    }
  ]
}
```

**Request Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `variant_ids` | array | Yes | Array of catalog variant IDs to generate mockups for |
| `format` | string | No | Output format: `jpg` (default) or `png` |
| `width` | integer | No | Output image width in pixels (maintains aspect ratio) |
| `product_options` | object | No | Product-specific options |
| `optionGroups` | array | No | Which placement groups to render |
| `files` | array | Yes | Design files with placement and positioning |

**files Array — Each Item:**

| Field | Type | Required | Description |
|---|---|---|---|
| `placement` | string | Yes | Print area (`front`, `back`, `sleeve_left`, etc.) |
| `image_url` | string | Yes | Publicly accessible URL to your design |
| `position` | object | No | Explicit positioning within print area |

**position Object:**

| Field | Type | Description |
|---|---|---|
| `area_width` | integer | Total printable area width (from printfiles spec) |
| `area_height` | integer | Total printable area height |
| `width` | integer | Your design width within the area |
| `height` | integer | Your design height within the area |
| `top` | integer | Top offset (pixels from area top) |
| `left` | integer | Left offset (pixels from area left) |

**Response (Task Created):**
```json
{
  "code": 200,
  "result": {
    "task_key": "gt-12345678-abcd-1234-efgh-123456789012"
  }
}
```

Save the `task_key` — you need it to retrieve results.

---

### 4. GET /mockup-generator/task — Get Task Result

**URL:** `GET https://api.printful.com/mockup-generator/task`

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `task_key` | string | Yes | Task key returned from create-task |

**Example Request:**
```bash
curl 'https://api.printful.com/mockup-generator/task?task_key=gt-12345678-...' \
  --header 'Authorization: Bearer {token}'
```

**Response (In Progress):**
```json
{
  "code": 200,
  "result": {
    "status": "waiting",
    "task_key": "gt-12345678-..."
  }
}
```

**Response (Completed):**
```json
{
  "code": 200,
  "result": {
    "status": "completed",
    "task_key": "gt-12345678-...",
    "mockups": [
      {
        "variant_ids": [4011],
        "placement": "front",
        "mockup_url": "https://printful-mockups.s3.amazonaws.com/..."
      },
      {
        "variant_ids": [4011],
        "placement": "lifestyle",
        "mockup_url": "https://printful-mockups.s3.amazonaws.com/..."
      }
    ],
    "printfiles": [
      {
        "variant_ids": [4011],
        "placement": "front",
        "url": "https://..."
      }
    ]
  }
}
```

**Task Status Values:**

| Status | Description |
|---|---|
| `waiting` | Task queued, not yet started |
| `in_progress` | Task currently generating |
| `completed` | Mockups ready, URLs available |
| `failed` | Task failed (retry needed) |

**mockups Array:**

| Field | Type | Description |
|---|---|---|
| `variant_ids` | array | Variant IDs this mockup applies to |
| `placement` | string | Which placement (front, back, lifestyle, etc.) |
| `mockup_url` | string | Direct URL to the generated mockup image |

---

## Polling Strategy

Mockup generation is asynchronous. Poll every 3-5 seconds:

```typescript
async function generateMockup(
  productId: number,
  variantIds: number[],
  files: MockupFile[]
): Promise<MockupResult[]> {
  // Step 1: Create task
  const createRes = await fetch(
    `https://api.printful.com/mockup-generator/create-task/${productId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ variant_ids: variantIds, format: 'jpg', files }),
    }
  );
  const { result: { task_key } } = await createRes.json();

  // Step 2: Poll for completion
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 4000)); // Wait 4 seconds

    const pollRes = await fetch(
      `https://api.printful.com/mockup-generator/task?task_key=${task_key}`,
      { headers: { 'Authorization': `Bearer ${process.env.PRINTFUL_API_TOKEN}` } }
    );
    const { result } = await pollRes.json();

    if (result.status === 'completed') {
      return result.mockups;
    }
    if (result.status === 'failed') {
      throw new Error(`Mockup generation failed for task ${task_key}`);
    }
    // 'waiting' or 'in_progress' — keep polling
  }

  throw new Error('Mockup generation timed out');
}
```

---

## Rate Limiting Notes

The mockup generator has **strict rate limits** below the standard 120 req/min:

- Do not batch-create many tasks in parallel
- Space out create-task calls by at least 2-3 seconds
- Poll retrieve calls can be more frequent but still throttled
- For bulk catalog mockup generation, implement a queue with delays

---

## Migration Notes: Printify vs Printful Mockups

| Feature | Printify | Printful |
|---|---|---|
| Mockup API type | Synchronous (returns image directly) | Asynchronous (task + poll) |
| Position params | `x`, `y`, `scale`, `angle` | `area_width/height`, `width/height`, `top/left` |
| Output format | PNG | JPG or PNG |
| Variant selection | Not specified in request | `variant_ids` array |
| Lifestyle mockups | Not documented | Available via `optionGroups` |
| API endpoint | `POST /v1/products/{id}/images.json` | `POST /mockup-generator/create-task/{id}` |
| Printfile specs | `GET /v1/catalog/blueprints/{id}/print_files.json` | `GET /mockup-generator/printfiles/{id}` |
