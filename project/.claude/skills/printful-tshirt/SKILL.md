---
name: Printful T-Shirt Production
description: >-
  Complete pipeline for producing t-shirts via Printful API: branding placement,
  mockup generation, variant management, and Supabase updates.
  Use when creating Printful products, generating mockups, updating branding,
  managing sync products, or uploading designs to Printful File Library.
---

# Printful T-Shirt Production Pipeline

Full production pipeline for SKAPARA t-shirts via Printful API. Covers branding placement, mockup generation, variant management, and Supabase database integration.

For Printify-based products (DTG design creation, SVG generation, product creation on Printify), see the `design-dtg` skill instead.

---

## When to Use

- Upload branding assets or designs to Printful File Library
- Create or update Printful sync products (variants, files, placements)
- Generate mockups via the Mockup Generator API
- Update Supabase `products.images[]` with mockup URLs
- Manage variant colors (enable/disable light colors)
- Add/change branding on existing products (sleeve, back, label)

---

## Printful API Reference

See [API_REFERENCE.md](API_REFERENCE.md) for full endpoint documentation.

**Quick reference:**

| Endpoint | Method | Use |
|---|---|---|
| `/files` | POST | Upload image to File Library |
| `/store/products/{id}` | GET/PUT | Read/update sync product + all variants |
| `/store/variants/{vid}` | PUT | Update single variant |
| `/mockup-generator/create-task/{catalog_id}` | POST | Create mockup generation task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |
| `/mockup-generator/printfiles/{catalog_id}` | GET | List available print positions |

**Auth headers (ALL requests):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
```

**Rate limits:**
- General API: ~120 req/min. Use `delay(2000)` between calls
- Mockup Generator: ~10 req/min. Use `delay(8000-10000)` between tasks
- On 429: read `x-ratelimit-reset` header, wait that many seconds, retry

---

## T-Shirt Catalogs (EU Production)

### CC1717 — Comfort Colors 1717 (Catalog ID 586) — SIGNATURE

| Color | Catalog Variant ID | Hex | Status |
|---|---|---|---|
| Black | 15114 | #1b1b1c | ACTIVE |
| Pepper | 17693 | #433b38 | ACTIVE |
| Graphite | 21264 | #5c5c5c | ACTIVE |
| True Navy | 15181 | #2a3244 | ACTIVE |
| Ivory | — | #F5F0E1 | DISABLED (white text invisible) |

### MC1087 — Cotton Heritage MC1087 (Catalog ID 917) — PREMIUM

| Color | Catalog Variant ID | Hex | Status |
|---|---|---|---|
| Black | 23577 | #0e0e0e | ACTIVE |
| Navy Blazer | 23584 | #1c2841 | ACTIVE |
| Vintage Black | 23591 | #3a3a3a | ACTIVE |
| White | — | #FFFFFF | DISABLED (white text invisible) |
| Vintage White | — | #E8E0D0 | DISABLED (white text invisible) |

---

## Canvas & Placements

All canvases at 150 DPI:

| Placement | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|
| `front` / `default` | 1800 x 2400 | $0.00 (included) | Main design |
| `back` | 1800 x 2400 | +$5.25 | SKAPARA wordmark |
| `sleeve_left` | 600 x 525 | +$2.20 | S mark isotipo |
| `sleeve_right` | 600 x 525 | +$2.20 | (unused currently) |
| `label_outside` | 450 x 450 | +$2.20 | Neck label (nuca) |

**IMPORTANT:** `back` and `label_outside` are **mutually exclusive** in Printful. We use `back` for SKAPARA wordmark.

---

## Branding Rules

See [BRANDING.md](BRANDING.md) for full branding specification.

### Quick Summary

| Position | Asset | Size | Placement |
|---|---|---|---|
| `sleeve_left` | S mark isotipo (white) | **32%** of canvas width (192px in 600px) | Centered |
| `back` | SKAPARA wordmark (white) | **37%** of canvas width (666px in 1800px) | Centered horizontal, zona alta (y=150) |

### Exception: Back Design Products

If the main design goes on the **back** instead of the front:
- The SKAPARA **brandname** goes on the **left chest** (heart side) instead
- Position: `front` placement with `x: 0.28, y: 0.22, scale: 0.3`

### Branding Asset Pipeline

1. Source SVGs in `/frontend/public/brand/`:
   - `skapara-mark-white.svg` — S mark for sleeve
   - `skapara-wordmark-white.svg` — SKAPARA for back
2. Render to PNG at density 300 for maximum quality
3. Upload to Printful File Library via `POST /files`
4. Reference by `file_id` in variant updates

---

## Workflow 1: Update Branding on Existing Products

### Step 1: Render Branding PNGs from SVG

```bash
# Sleeve: S mark at 32% of 600px = 192px wide, centered in 600x525
magick -density 300 -background none \
  public/brand/skapara-mark-white.svg \
  -resize 192x \
  -gravity center -extent 600x525 \
  PNG32:output/sleeve-left-600x525.png

# Back: Wordmark at 37% of 1800px = 666px wide, centered horizontal, y=150
magick -density 300 -background none \
  public/brand/skapara-wordmark-white.svg \
  -resize 666x \
  PNG32:tmp-wordmark.png

magick -size 1800x2400 xc:transparent \
  tmp-wordmark.png -gravity North -geometry +0+150 \
  -composite PNG32:output/back-wordmark-1800x2400.png
```

### Step 2: Upload to Printful File Library

```bash
curl -X POST https://api.printful.com/files \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -F "file=@output/sleeve-left-600x525.png" \
  -F "type=default"
```

Save the returned `id` (integer) for each file.

### Step 3: Update All Variants (Bulk)

Use the bulk product update to set files on ALL variants in 1 API call:

```bash
# Get product to find variant IDs
curl -s "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" | jq '.result.sync_variants[].id'

# Build bulk update payload
curl -X PUT "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_variants": [
      {
        "id": VARIANT_ID_1,
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_FILE_ID},
          {"type": "back", "id": BACK_WORDMARK_FILE_ID}
        ]
      },
      {
        "id": VARIANT_ID_2,
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_FILE_ID},
          {"type": "back", "id": BACK_WORDMARK_FILE_ID}
        ]
      }
    ]
  }'
```

**Alternative: Per-variant update** (when bulk exceeds payload limit):
```bash
curl -X PUT "https://api.printful.com/store/variants/${VARIANT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"type": "default", "id": FRONT_DESIGN_FILE_ID},
      {"type": "sleeve_left", "id": SLEEVE_FILE_ID},
      {"type": "back", "id": BACK_WORDMARK_FILE_ID}
    ]
  }'
```

Rate limit: `delay(2000)` between variant updates, `delay(3000)` between products.

---

## Workflow 2: Generate Mockups

### Step 1: Create Mockup Task

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/${CATALOG_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [15114],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Left", "Back"],
    "files": [
      {
        "placement": "front",
        "image_url": "https://cdn.printful.com/.../design_preview.png",
        "position": {
          "area_width": 1800, "area_height": 2400,
          "width": 1800, "height": 2400,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "sleeve_left",
        "image_url": "https://cdn.printful.com/.../sleeve_preview.png",
        "position": {
          "area_width": 600, "area_height": 525,
          "width": 600, "height": 525,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "back",
        "image_url": "https://cdn.printful.com/.../back_preview.png",
        "position": {
          "area_width": 1800, "area_height": 2400,
          "width": 1800, "height": 2400,
          "top": 0, "left": 0
        }
      }
    ]
  }'
```

**Response:** `{ "result": { "task_key": "gt-XXXXXXXX" } }`

**Key parameters:**
- `format: "png"` — transparent background (recommended)
- `option_groups`: Mockup style. See [MOCKUP_OPTIONS.md](MOCKUP_OPTIONS.md)
- `options`: View angles — `"Front"`, `"Left"`, `"Right"`, `"Back"` (these are CAMERA angles, not placements)
- `files[].placement`: The actual print position on the garment
- `files[].image_url`: **Must be a public URL** (Printful CDN preview URLs work)

### Step 2: Poll for Completion

```bash
curl -s "https://api.printful.com/mockup-generator/task?task_key=gt-XXXXXXXX" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}"
```

Poll every 3 seconds. Status values: `pending`, `completed`, `failed`.

**Completed response structure:**
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
      },
      {
        "placement": "sleeve_left",
        "variant_ids": [15114],
        "mockup_url": "https://s3.amazonaws.com/..."
      }
    ]
  }
}
```

Each mockup entry = one **placement**. The `mockup_url` is temporary S3 (~24h expiry).

### Step 3: Download and Upload to Permanent Storage

```javascript
// Download from temporary S3
const imageBuffer = await fetch(mockup_url).then(r => r.arrayBuffer())

// Upload to Supabase Storage
const storagePath = `mockups/${productSlug}/${colorSlug}-${placement}.png`
await fetch(`${SUPABASE_URL}/storage/v1/object/designs/${storagePath}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    apikey: SUPABASE_SERVICE_KEY,
    'Content-Type': 'image/png',
    'x-upsert': 'true',
  },
  body: Buffer.from(imageBuffer),
})

// Public URL — ALWAYS add cache-buster when overwriting existing files
const ts = Math.floor(Date.now() / 1000)
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`
```

**CRITICAL: Cache-busting.** Browser and CDN cache images by URL. If you overwrite a file at the same path in Supabase Storage, the old version will be served from cache. ALWAYS append `?v=timestamp` to force browsers to fetch the new version.

### Step 4: Update Supabase products.images[]

```javascript
const ts = Math.floor(Date.now() / 1000)
const images = [
  // Fronts first (hero images for each color)
  { src: `https://.../mockups/prism-tee/black-front.png?v=${ts}`, alt: 'Prism Tee - Black' },
  { src: `https://.../mockups/prism-tee/pepper-front.png?v=${ts}`, alt: 'Prism Tee - Pepper' },
  { src: `https://.../mockups/prism-tee/true-navy-front.png?v=${ts}`, alt: 'Prism Tee - True Navy' },
  // Backs
  { src: `https://.../mockups/prism-tee/black-back.png?v=${ts}`, alt: 'Prism Tee - Black - Back' },
  { src: `https://.../mockups/prism-tee/pepper-back.png?v=${ts}`, alt: 'Prism Tee - Pepper - Back' },
  // Sleeves
  { src: 'https://.../mockups/prism-tee/black-sleeve_left.png', alt: 'Prism Tee - Black - Sleeve' },
]

await supabase.from('products').update({ images }).eq('id', productId)
```

**Alt text pattern is critical** for frontend color-image mapping:
- Front: `"Title - ColorName"` (no suffix)
- Back: `"Title - ColorName - Back"`
- Sleeve: `"Title - ColorName - Sleeve"`

The `buildVariantImageMap()` function in `product-detail-cache.ts` uses `"- ColorName"` pattern to match images to variants.

**Image order:** Fronts first (all colors) → Backs → Sleeves. First image = hero for shop listing.

---

## Workflow 3: Disable Light Color Variants

95% of SKAPARA designs use white/ghost text. Light colors make designs invisible.

```javascript
// Supabase: disable Ivory/White/Vintage White variants
const LIGHT_COLORS = ['Ivory', 'White', 'Vintage White']

for (const color of LIGHT_COLORS) {
  await supabase
    .from('product_variants')
    .update({ is_enabled: false })
    .eq('product_id', productId)
    .eq('color', color)
}
```

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Graphite mockup bug | CC1717 variant 21264: API returns identical image for all placements | Accept front-only for Graphite |
| Temporary URLs | Mockup S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib against Printful | Use curl or Node.js fetch |
| `back` vs `label_outside` | Mutually exclusive — cannot use both | We use `back` for wordmark |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` |

---

## GPSR Compliance (EU Regulation 2023/988)

Every product MUST have GPSR data before going live:

```json
{
  "safety_information": "<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>...",
  "material": "100% Cotton (CC1717) / 100% Cotton (MC1087)",
  "care_instructions": "Machine wash cold, inside out. Tumble dry low.",
  "print_technique": "DTG (Direct-to-Garment)",
  "manufacturing_country": "Latvia",
  "brand": "SKAPARA"
}
```

Stored in `products.product_details` (JSONB) in Supabase.
