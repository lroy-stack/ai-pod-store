# Mockup Generation Task Result

**Source**: Printful API OpenAPI Specification (extracted 2026-03-03)
**Tag**: Mockup Generator API
**operationId**: `getTask`

---

## HTTP Method and Path

```
GET https://api.printful.com/mockup-generator/task?task_key={task_key}
```

## Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `task_key` | string | **yes** | Task key retrieved when creating the generation task (from `createGeneratorTask` response) |

## Authentication

```
Authorization: Bearer {oauth_token}
```

For account-level tokens, also include:
```
X-PF-Store-Id: {store_id}
```

---

## Description

Returns the result of an asynchronous mockup generation task created via `POST /mockup-generator/create-task/{id}`.

If the generation task is completed, the response will contain a list of generated mockup image URLs.

Poll this endpoint after creating a task until `status` is `"completed"` or `"failed"`.

---

## Response Body

**HTTP 200 OK**

```json
{
  "code": 200,
  "result": {
    "task_key": "123456",
    "status": "completed",
    "error": null,
    "mockups": [
      {
        "placement": "front",
        "display_name": "Front Print",
        "variant_ids": [4012, 4013, 4014, 4017, 4018, 4019],
        "url": "https://files.cdn.printful.com/mockup-generator/result/mockup-front.jpg",
        "extra": []
      },
      {
        "placement": "back",
        "display_name": "Back Print",
        "variant_ids": [4012, 4013, 4014, 4017, 4018, 4019],
        "url": "https://files.cdn.printful.com/mockup-generator/result/mockup-back.jpg",
        "extra": []
      }
    ],
    "printfiles": [
      {
        "variant_ids": [4012, 4013, 4014, 4017, 4018, 4019],
        "placement": "front",
        "url": "https://url-to/printfile.png"
      }
    ]
  }
}
```

### GenerationTask schema

| Field | Type | Description | Values |
|---|---|---|---|
| `task_key` | string | Task identifier | `"123456"` |
| `status` | string | Status of the generation task | `"pending"`, `"completed"`, `"failed"` |
| `error` | string | If task failed, the reason is provided here. `null` if no error. | — |
| `mockups` | array | If completed, list of generated mockups (GenerationTaskMockup schema). Empty array when `pending`. | — |
| `printfiles` | array | If completed, list of generated printfiles (GenerationTaskTemplateFile schema). Empty array when `pending`. | — |

### `mockups` Array (GenerationTaskMockup schema)

One mockup entry per placement. A single mockup can cover multiple variant IDs (e.g. all sizes share the same front print mockup).

| Field | Type | Description | Example |
|---|---|---|---|
| `placement` | string | Placement identifier | `"front"` |
| `display_name` | string | Human-readable name for the placement, suitable for showing to end customers | `"Front Print"` |
| `variant_ids` | array of integer | List of Printful variant IDs that use this mockup | `[4011, 4012, 4013]` |
| `url` | string | Temporary URL of the generated mockup image | `"https://files.cdn.printful.com/..."` |
| `extra` | array | Optional extra mockups for alternative style views (GenerationTaskExtraMockup schema) | `[]` |

### `mockups[].extra` Array (GenerationTaskExtraMockup schema)

Extra mockups for different style options or angles.

| Field | Type | Description | Example |
|---|---|---|---|
| `title` | string | Display name of the extra mockup | — |
| `url` | string | Temporary URL of the extra mockup image | `"https://url-to/extra-mockup.png"` |
| `option` | string | Style option name associated with this extra mockup | — |
| `option_group` | string | Style option group name | — |

### `printfiles` Array (GenerationTaskTemplateFile schema)

Generated printfile URLs, organized by placement.

| Field | Type | Description | Example |
|---|---|---|---|
| `variant_ids` | array of integer | List of variant IDs associated with these printfiles | `[4012, 4013, 4014]` |
| `placement` | string | Placement identifier | `"front"` |
| `url` | string | Public URL of the generated printfile | `"https://url-to/printfile.png"` |

**HTTP 401 Unauthorized**

```json
{
  "code": 401,
  "result": "Unauthorized",
  "error": { "reason": "Unauthorized", "message": "Unauthorized" }
}
```

**HTTP 404 Not Found** — returned if the `task_key` is invalid or the task does not exist.

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
curl --location --request GET 'https://api.printful.com/mockup-generator/task?task_key=3123' \
--header 'Authorization: Bearer {oauth_token}'
```

---

## Response When Still Pending

When the task is not yet completed, the response will look like:

```json
{
  "code": 200,
  "result": {
    "task_key": "3123",
    "status": "pending",
    "error": null,
    "mockups": [],
    "printfiles": []
  }
}
```

## Response When Failed

```json
{
  "code": 200,
  "result": {
    "task_key": "3123",
    "status": "failed",
    "error": "Failed to download image from provided URL",
    "mockups": [],
    "printfiles": []
  }
}
```

---

## Polling Workflow

```
1. POST /mockup-generator/create-task/{product_id}
   → response: { task_key: "abc123", status: "pending" }

2. GET /mockup-generator/task?task_key=abc123
   → if status === "pending": wait and retry
   → if status === "completed": read mockups[].url
   → if status === "failed": read error field, fix and retry

3. Download and store mockup images from mockups[].url
   (URLs are temporary — persist them if needed)
```

---

## Notes

- **Poll with backoff**: The task is processed asynchronously. A reasonable polling interval is 1-3 seconds. Do not hammer the endpoint.
- Generated mockup URLs are **temporary** — download and store them if you need to persist them for product listings.
- One mockup entry can cover multiple `variant_ids`. For example, all size variants of a white T-shirt share the same front print mockup, so you don't need to store one per size.
- The `display_name` field is intended for display to end customers in product listings.
- The `extra` array in each mockup contains alternative views (e.g. different lifestyle backgrounds, angles, or embroidery thread color views).
- Rate limit for the create endpoint: 10 requests/60s for established stores. The get endpoint follows the general 120 requests/minute limit.
