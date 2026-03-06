# Mockup Generation — SASU024 Embroidery (Catalog 831)

## What We Generate

**Ghost transparente, 3-4 vistas por color.**

### Views

| Vista | En respuesta API | Archivo |
|---|---|---|
| **Front** | `mockup_url` (root) | `{color}-front.png` |
| **Back** | `extra[].title === "Back"` | `{color}-back.png` |
| **Left** | `extra[].title === "Left"` | `{color}-left.png` |
| **Right** | `extra[].title === "Right"` (optional) | `{color}-right.png` |

---

## Color Selection — Embroidery

Unlike DTG (2 dark colors only), embroidery can use ALL 4 colors. Decision depends on thread contrast:

- **Dark on dark** (Black garment + Kelly Green thread): WORKS — green thread visible
- **Light on light** (White garment + White thread): FAILS — invisible
- **Dark thread on light** (White garment + Black/Navy thread): WORKS
- **Light thread on dark** (Black garment + White/Gold thread): WORKS

**Typical:** 2-4 colors × 3-4 views = 6-16 mockups per product.

---

## Mockup Generation Workflow

### 1. Collect Design URLs

```
embroidery_chest_center:  https://files.cdn.printful.com/files/xxx/xxx_preview.png
embroidery_wrist_left:    https://files.cdn.printful.com/files/yyy/yyy_preview.png
embroidery_wrist_right:   https://files.cdn.printful.com/files/zzz/zzz_preview.png
```

### 2. Create Tasks (1 per color)

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/831" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [21149],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "embroidery_chest_center",
        "image_url": "https://CHEST_DESIGN_URL",
        "position": { "area_width": 3000, "area_height": 1800, "width": 3000, "height": 1800, "top": 0, "left": 0 }
      },
      {
        "placement": "embroidery_wrist_left",
        "image_url": "https://WRIST_LEFT_URL",
        "position": { "area_width": 600, "area_height": 900, "width": 600, "height": 900, "top": 0, "left": 0 }
      },
      {
        "placement": "embroidery_wrist_right",
        "image_url": "https://WRIST_RIGHT_URL",
        "position": { "area_width": 600, "area_height": 900, "width": 600, "height": 900, "top": 0, "left": 0 }
      }
    ]
  }'
```

### 3. Poll + Extract + Download

**Polling endpoint:** `GET /mockup-generator/task?task_key={task_key}`

Poll every 3-4 seconds. Status values: `pending` → `completed` or `failed`.

```javascript
// Correct polling pattern
const statusRes = await pf.fetch(`/mockup-generator/task?task_key=${taskKey}`);
if (statusRes.status === 'completed') { /* extract mockups */ }
if (statusRes.status === 'failed') { /* handle error */ }
```

```javascript
const m = result.mockups[0];
m.mockup_url                                    // -> front.png
m.extra.find(e => e.title === 'Back')?.url       // -> back.png
m.extra.find(e => e.title === 'Left')?.url       // -> left.png
m.extra.find(e => e.title === 'Right')?.url      // -> right.png (optional)
```

**DO NOT** iterate `mockups[]` — multiple entries may share the same `mockup_url`.

### 4. Upload to Supabase Storage

Same pattern as DTG. Always use `?v=timestamp` cache-busting.

---

## Rate Limits

| Operation | Limit | Delay |
|---|---|---|
| API general | ~120 req/min | `delay(2000)` |
| Mockup task creation | ~10 tasks/min | `delay(10000)` |
| Polling | No limit | every 3000ms |

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.

---

## Storage & Gallery

### Files per product (typical: 8-12)

```
designs/mockups/{slug}/black-front.png
designs/mockups/{slug}/black-back.png
designs/mockups/{slug}/black-left.png
designs/mockups/{slug}/french-navy-front.png
designs/mockups/{slug}/french-navy-back.png
designs/mockups/{slug}/french-navy-left.png
designs/mockups/{slug}/heather-grey-front.png  (if enabled)
designs/mockups/{slug}/white-front.png         (if enabled)
```

### Alt Text Convention

| Vista | Pattern | Example |
|---|---|---|
| Front | `"Title - ColorName"` | `"Recycled - Black"` |
| Back | `"Title - ColorName - Back"` | `"Recycled - Black - Back"` |
| Left | `"Title - ColorName - Left"` | `"Recycled - Black - Left"` |

**ColorName must match exactly** with `product_variants.color`.
