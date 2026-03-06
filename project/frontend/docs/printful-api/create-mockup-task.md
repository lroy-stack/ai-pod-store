# Create a Mockup Generation Task

**Source**: Printful API OpenAPI Specification (extracted 2026-03-03)
**Tag**: Mockup Generator API
**operationId**: `createGeneratorTask`

---

## HTTP Method and Path

```
POST https://api.printful.com/mockup-generator/create-task/{id}
```

## Path Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | integer | **yes** | Printful Product ID (catalog product, e.g. `71` for Bella+Canvas 3001) |

## Authentication

```
Authorization: Bearer {oauth_token}
```

For account-level tokens, also include:
```
X-PF-Store-Id: {store_id}
```

---

## Rate Limiting

This endpoint has stricter rate limits than the general API:

- **Established stores**: up to **10 requests per 60 seconds**
- **New stores**: up to **2 requests per 60 seconds**
- A **60-second lockout** is applied if the request count is exceeded.
- Maximum **20,000 files per account per 24-hour period**.

Currently available rate is returned in response headers.

---

## Request Body

**Content-Type**: `application/json`
**Required**: yes

Creates an asynchronous mockup generation task. The result is retrieved using the [getGeneratorTask endpoint](./get-mockup-task.md) with the returned `task_key`.

### Schema (CreateGenerationTask)

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `variant_ids` | array of integer | no | List of Printful variant IDs you want to generate mockups for | `[4012, 4013, 4014]` |
| `format` | string | no | Generated file format. `"png"` has transparent background; `"jpg"` has smaller file size. Enum: `jpg`, `png` | `"jpg"` |
| `width` | integer | no | Width of resulting mockup images in pixels. Min: 50, Max: 2000, Default: 1000 | `1000` |
| `files` | array | no | Placement-to-file mappings (GenerationTaskFile schema). Use instead of `product_template_id`. | — |
| `product_template_id` | integer | no | Product template ID. Use instead of `files` parameter. | `123` |
| `product_options` | object | no | Key-value map of product options (e.g. embroidery thread, stitch colors). Options found in Catalog API. | `{"thread_colors": ["#000000"]}` |
| `option_groups` | array of string | no | List of option group names to generate. Found in printfile API response. | `["Flat Embroidery"]` |
| `options` | array of string | no | List of option names to generate. Found in printfile API response. | `["Front"]` |

### `files` Array (GenerationTaskFile schema)

Each item maps a placement to a design file. Either `files` or `product_template_id` must be provided.

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `placement` | string | no | Placement identifier (e.g. `"front"`, `"back"`, `"label_outside"`) | `"front"` |
| `image_url` | string | no | Public URL where your design file is stored | `"http://your-site/path-to-front-printfile.jpg"` |
| `position` | object | no | Positioning data (GenerationTaskFilePosition schema) | — |
| `options` | array | no | Array of FileOption objects for this file | — |

### `files[].position` Object (GenerationTaskFilePosition schema)

Controls how the design image is positioned within the print area.

| Field | Type | Read-only | Description | Example |
|---|---|---|---|---|
| `area_width` | integer | no | Positioning area width on print area in pixels (nullable) | `1800` |
| `area_height` | integer | no | Positioning area height on print area in pixels (nullable) | `2400` |
| `width` | integer | no | Width of the image in the given area in pixels | `1800` |
| `height` | integer | no | Height of the image in the given area in pixels | `1800` |
| `top` | integer | no | Image top offset in given area in pixels | `300` |
| `left` | integer | no | Image left offset in given area in pixels | `0` |

### `files[].options` Array (FileOption schema)

| Field | Type | Required | Description | Example |
|---|---|---|---|---|
| `id` | string | **yes** | Option id | `"template_type"` |
| `value` | string | **yes** | Option value | `"native"` |

---

## Response Body

**HTTP 200 OK** — Returns the generation task. The task is asynchronous; poll the `getGeneratorTask` endpoint with the `task_key` until status is `completed` or `failed`.

```json
{
  "code": 200,
  "result": {
    "task_key": "123456",
    "status": "pending",
    "error": null,
    "mockups": [],
    "printfiles": []
  }
}
```

### GenerationTask schema

| Field | Type | Description | Values |
|---|---|---|---|
| `task_key` | string | Task identifier used to retrieve generated mockups | `"123456"` |
| `status` | string | Status of the generation task | `"pending"`, `"completed"`, `"failed"` |
| `error` | string | If task failed, reason is provided here | — |
| `mockups` | array | If completed, list of generated mockups (GenerationTaskMockup schema) | — |
| `printfiles` | array | If completed, list of generated printfiles (GenerationTaskTemplateFile schema) | — |

### `mockups` Array (GenerationTaskMockup schema) — present when status is `completed`

| Field | Type | Description | Example |
|---|---|---|---|
| `placement` | string | Placement identifier | `"front"` |
| `display_name` | string | Display name for end customers | `"Front Print"` |
| `variant_ids` | array of integer | List of variant IDs this mockup is used for | `[4011, 4012, 4013]` |
| `url` | string | URL of the generated mockup image | `"https://..."` |
| `extra` | array | Optional extra mockups (GenerationTaskExtraMockup schema) | — |

### `mockups[].extra` Array (GenerationTaskExtraMockup schema)

| Field | Type | Description | Example |
|---|---|---|---|
| `title` | string | Display name of the extra mockup | — |
| `url` | string | Temporary URL of the mockup image | `"https://url-to/extra-mockup.png"` |
| `option` | string | Style option name | — |
| `option_group` | string | Style option group name | — |

### `printfiles` Array (GenerationTaskTemplateFile schema) — present when status is `completed`

| Field | Type | Description | Example |
|---|---|---|---|
| `variant_ids` | array of integer | List of variant IDs associated with printfiles | `[4012, 4013, 4014]` |
| `placement` | string | Placement identifier | `"front"` |
| `url` | string | Public URL of the generated printfile | `"https://url-to/printfile.png"` |

**HTTP 400 Bad Request**

```json
{
  "code": 400,
  "result": "Missing required parameters",
  "error": { "reason": "BadRequest", "message": "Missing required parameters" }
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
curl --location --request POST 'https://api.printful.com/mockup-generator/create-task/71' \
--header 'Authorization: Bearer {oauth_token}' \
--data-raw '{
    "variant_ids": [4012, 4013, 4014, 4017, 4018, 4019],
    "format": "jpg",
    "files": [
        {
            "placement": "front",
            "image_url": "http://your-site/path-to-front-printfile.jpg",
            "position": {
                "area_width": 1800,
                "area_height": 2400,
                "width": 1800,
                "height": 1800,
                "top": 300,
                "left": 0
            }
        },
        {
            "placement": "back",
            "image_url": "http://your-site/path-to-back-printfile.jpg",
            "position": {
                "area_width": 1800,
                "area_height": 2400,
                "width": 1800,
                "height": 1800,
                "top": 300,
                "left": 0
            }
        }
    ]
}'
```

---

## Workflow

This endpoint is the first step of the async mockup generation flow:

1. **POST** `/mockup-generator/create-task/{product_id}` — submit generation request, get `task_key`
2. **GET** `/mockup-generator/task?task_key={task_key}` — poll until `status === "completed"` or `"failed"`
3. Read `mockups[].url` for the generated mockup image URLs (temporary URLs)

## Notes

- The generation task is **asynchronous** — the response with `status: "pending"` does not contain mockups yet. Poll the retrieval endpoint.
- Use the **Printful catalog Product ID** (not your store's product ID) in the path parameter.
- `variant_ids` should be Printful catalog variant IDs (from `GET /products/{id}`), not your Sync Variant IDs.
- Either `files` or `product_template_id` must be provided to specify the design.
- The `position` object uses pixel coordinates relative to the print area. Use `GET /mockup-generator/printfiles/{id}` to get the `area_width` and `area_height` for each product's print placements.
- Generated mockup URLs are **temporary** — download and store them if you need to persist them.
- For products with multiple printing techniques (e.g. DTG + embroidery), DTG is the default. Specify `technique` query parameter on printfile retrieval if needed.
- Rate limit: 10 requests/60s for established stores, 2 requests/60s for new stores. 20,000 file limit per account per 24 hours.
