# Printful API — Mockup Generator

**Base URL:** `https://api.printful.com`  
**Authentication:** Bearer token via `Authorization` header  
**Rate Limit:** Lower than standard (resource-intensive). Recommended: 1-2 requests/second.

---

## Overview

The Mockup Generator API creates product preview images (mockups) by combining print files with product templates. The process is asynchronous:

1. **POST** `/mockup-generator/create-task/{product_id}` — submit a task
2. **GET** `/mockup-generator/task?task_key={key}` — poll until `status: completed`
3. Download mockup URLs from the response `mockups[].mockup_url`

---

## Endpoints

### POST /mockup-generator/create-task/{product_id} — Create Mockup Task

Creates a new mockup generation task for a specific Printful catalog product.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `product_id` | integer | Printful catalog product ID (from Catalog API) |

**Request Body:**

```json
{
  "variant_ids": [
    4012,
    4013,
    4014,
    4017,
    4018,
    4019
  ],
  "format": "jpg",
  "width": 0,
  "product_options": {},
  "option_groups": [
    "string"
  ],
  "options": [
    "string"
  ],
  "files": [
    {
      "placement": "front",
      "image_url": "\u200bhttp://your-site/path-to-front-printfile.jpg",
      "position": {
        "area_width": 1800,
        "area_height": 2400,
        "width": 1800,
        "height": 1800,
        "top": 300,
        "left": 0
      },
      "options": [
        {
          "id": "template_type",
          "value": "native"
        }
      ]
    }
  ],
  "product_template_id": 123
}
```

### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `variant_ids` | integer[] | Yes | Array of catalog variant IDs to generate mockups for |
| `files` | object[] | Yes | Array of file objects with placement and image URL |
| `files[].placement` | string | Yes | Print placement (e.g., `front`, `back`, `embroidery_front`) |
| `files[].image_url` | string | Yes | Publicly accessible URL to the design file |
| `files[].position` | object | No | Custom x/y position override |
| `format` | string | No | Output format: `jpg` (default) or `png` |
| `width` | integer | No | Output image width in pixels (0 = default) |
| `option_groups` | string[] | No | Filter mockup types by group name |
| `options` | string[] | No | Filter mockup types by specific option names |
| `product_options` | object | No | Product-specific options (e.g., lifelike rendering) |
| `product_template_id` | integer | No | Use a saved product template instead of files |

**Response 200 — Task Created:**

```json
{
  "code": 200,
  "result": {
    "task_key": "gt-123456789",
    "status": "pending"
  }
}
```

---

### GET /mockup-generator/task?task_key={key} — Get Task Result

Polls for the status of a mockup generation task.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `task_key` | string | The `task_key` returned from the create-task endpoint |

**Response 200 — Task Completed:**

```json
{
  "code": 200,
  "result": {
    "task_key": "123456",
    "status": "completed",
    "error": "string",
    "mockups": [
      {
        "placement": "front",
        "display_name": "Front Print",
        "variant_ids": [
          4011,
          4012,
          4013
        ],
        "extra": [
          {
            "title": "string",
            "url": "\u200bhttps://url-to/extra-mockup.png",
            "option": "string",
            "option_group": "string"
          }
        ]
      }
    ],
    "printfiles": [
      {
        "variant_ids": [
          4012,
          4013,
          4014,
          4017,
          4018,
          4019
        ],
        "placement": "front",
        "url": "\u200bhttps://url-to/printfile.png"
      }
    ]
  }
}
```

### Task Status Values

| Status | Description |
|--------|-------------|
| `pending` | Task is in the queue |
| `running` | Task is currently being processed |
| `completed` | Mockups are ready — download from `mockup_url` fields |
| `failed` | Task failed — check `error` field for reason |

### Mockup Response Structure

| Field | Type | Description |
|-------|------|-------------|
| `task_key` | string | Unique task identifier |
| `status` | string | Task status (see above) |
| `error` | string | Error message if status is `failed` |
| `mockups` | object[] | Array of generated mockup objects |
| `mockups[].placement` | string | Print placement this mockup represents |
| `mockups[].display_name` | string | Human-readable placement name |
| `mockups[].variant_ids` | integer[] | Variant IDs this mockup covers |
| `mockups[].mockup_url` | string | URL to the generated mockup image |
| `mockups[].extra` | object[] | Additional mockup angles/views |
| `mockups[].extra[].title` | string | Name for the extra view |
| `mockups[].extra[].url` | string | URL to the extra view image |

---

### GET /mockup-generator/printfiles/{product_id} — Get Printfiles

Returns available printfiles (print areas) and their specifications for a product.

**Response 200:**

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
        "width": 1800,
        "height": 2400,
        "dpi": 150,
        "fill_mode": "fit",
        "can_rotate": false
      }
    ],
    "variant_printfiles": [
      {
        "variant_id": 4012,
        "placements": {
          "front": 1,
          "back": 1,
          "label_outside": 1
        }
      }
    ],
    "option_groups": [
      "string"
    ],
    "options": [
      "string"
    ]
  }
}
```

### Printfile Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `product_id` | integer | Printful catalog product ID |
| `available_placements` | object | Map of placement_key → display_name |
| `printfiles` | object[] | Array of printfile specifications |
| `printfiles[].printfile_id` | integer | ID of this printfile spec |
| `printfiles[].width` | integer | Required print area width in pixels |
| `printfiles[].height` | integer | Required print area height in pixels |
| `printfiles[].dpi` | integer | Required DPI (typically 150 or 300) |
| `printfiles[].fill_mode` | string | `fit` or `cover` |
| `printfiles[].can_rotate` | boolean | Whether design can be rotated |
| `variant_printfiles` | object[] | Map of variant_id → printfile_id |

---

### GET /mockup-generator/templates/{product_id} — Get Layout Templates

Returns layout template images for use in design tools (shows where to place artwork on the product image).

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `orientation` | string | `horizontal` or `vertical` (optional) |
| `technique` | string | Print technique filter (optional) |

**Response 200:**

```json
{
  "code": 200,
  "result": {
    "version": 1,
    "min_dpi": 300,
    "variant_mapping": [
      {
        "variant_id": 1,
        "templates": [
          {
            "placement": "front",
            "template_id": 1
          }
        ]
      }
    ],
    "templates": [
      {
        "template_id": 919,
        "image_url": "https://www.printful.com/files/generator/40/11oz_template.png",
        "background_url": null,
        "background_color": null,
        "printfile_id": 43,
        "template_width": 560,
        "template_height": 295,
        "print_area_width": 520,
        "print_area_height": 202,
        "print_area_top": 18,
        "print_area_left": 20,
        "is_template_on_front": true,
        "orientation": "any"
      }
    ],
    "conflicting_placements": [
      {
        "placement": "label_outside",
        "conflicts": [
          "back",
          "label_inside"
        ]
      }
    ]
  }
}
```

---

## Complete Workflow Example

```javascript
// Step 1: Submit mockup task
const taskResponse = await fetch(
  "https://api.printful.com/mockup-generator/create-task/71",
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_TOKEN",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "variant_ids": [4011, 4012, 4013],
      "format": "jpg",
      "files": [
        {
          "placement": "front",
          "image_url": "https://example.com/design-front.png",
          "position": {
            "area_width": 1800,
            "area_height": 2400,
            "width": 1500,
            "height": 1500,
            "top": 450,
            "left": 150
          }
        }
      ]
    })
  }
);

const { result: { task_key } } = await taskResponse.json();

// Step 2: Poll for completion
let mockups = null;
while (!mockups) {
  await new Promise(r => setTimeout(r, 2000)); // wait 2s
  
  const pollResponse = await fetch(
    `https://api.printful.com/mockup-generator/task?task_key=${task_key}`,
    { headers: { "Authorization": "Bearer YOUR_TOKEN" } }
  );
  
  const { result } = await pollResponse.json();
  
  if (result.status === "completed") {
    mockups = result.mockups;
  } else if (result.status === "failed") {
    throw new Error(result.error);
  }
}

// Step 3: Use mockup URLs
for (const mockup of mockups) {
  console.log(`${mockup.placement}: ${mockup.mockup_url}`);
  // Also check mockup.extra for additional angles
}
```

---

## Position Object Reference

When using custom positioning in the `files[].position` field:

```json
{
  "position": {
    "area_width": 1800,
    "area_height": 2400,
    "width": 1500,
    "height": 1500,
    "top": 450,
    "left": 150
  }
}
```

| Field | Description |
|-------|-------------|
| `area_width` | Total printable area width (pixels) |
| `area_height` | Total printable area height (pixels) |
| `width` | Design width within the area |
| `height` | Design height within the area |
| `top` | Distance from top of print area |
| `left` | Distance from left of print area |

---

## Error Codes — Mockup Generator

| Code | Description |
|------|-------------|
| 400 | Bad request — invalid variant IDs, missing files, or bad position values |
| 401 | Unauthorized |
| 404 | Product not found |
| 429 | Rate limit exceeded — slow down requests |
| 500 | Internal server error |
