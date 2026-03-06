---
name: Printful CC1717 Production
description: >-
  Complete pipeline for Comfort Colors 1717 (catalog 586) SIGNATURE t-shirts on Printful.
  Covers product creation, variant management, branding placement, mockup generation,
  and Supabase integration. Use when creating CC1717 products, generating mockups,
  updating branding, or managing SIGNATURE tier t-shirts.
---

# Printful CC1717 Production Pipeline

Full production pipeline for SKAPARA SIGNATURE tier t-shirts using the Comfort Colors 1717 blank on Printful. The CC1717 is a garment-dyed, heavyweight relaxed tee — the premium blank that defines the SKAPARA brand feel.

For Printify-based products (DTG design creation on Textildruck Europa P26), see the `design-dtg` skill instead.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | Comfort Colors 1717 |
| **Catalog ID** | 586 |
| **Tier** | SIGNATURE |
| **Fabric** | 100% Ring-Spun Cotton |
| **Weight** | 6.1 oz/yd (heavyweight) |
| **Treatment** | Garment-dyed |
| **Fit** | Relaxed |
| **Sizes** | S, M, L, XL, 2XL, 3XL, 4XL |
| **Colors** | 45 total (see VARIANTS.md) |
| **Print Method** | DTG (Direct-to-Garment) |
| **Producer** | Printful (Latvia) |

---

## When to Use

- Create a new SIGNATURE tier t-shirt product on Printful
- Upload designs and apply SKAPARA branding to CC1717 products
- Generate mockups for CC1717 products
- Update branding (sleeve, back, label) on existing CC1717 products
- Manage CC1717 variant colors (enable/disable based on design compatibility)
- Update Supabase with CC1717 product data and mockup images

---

## Placements & Canvas Sizes

All canvases at 150 DPI:

| Placement | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|
| `front` / `default` | 1800 x 2400 | $0.00 (included) | Main design |
| `back` | 1800 x 2400 | +$5.25 | SKAPARA wordmark |
| `sleeve_left` | 600 x 525 | +$2.20 | S mark isotipo |
| `sleeve_right` | 600 x 525 | +$2.20 | Unused currently |
| `label_outside` | 450 x 450 | +$2.20 | Neck label (nuca) |

**IMPORTANT:** `back` and `label_outside` are **mutually exclusive** in Printful. We use `back` for SKAPARA wordmark.

---

## Base Costs (Production)

| Size | Base Cost |
|---|---|
| S | $13.25 |
| M | $13.25 |
| L | $13.25 |
| XL | $14.95 |
| 2XL | $16.25 |
| 3XL | $17.55 |
| 4XL | $18.25 - $18.85 |

Additional placement costs stack: front (included) + back (+$5.25) + sleeve_left (+$2.20) = $20.70 total extra per unit for S-L.

---

## Color Selection

### CORE DARK (Recommended for all SKAPARA designs)

These 9 colors are 100% safe for white/ghost text designs:

| Color | Hex | Size S Variant |
|---|---|---|
| Black | #1b1b1c | 15114 |
| True Navy | #1e2c4a | 15181 |
| Graphite | #3e3737 | 21264 |
| Pepper | #514f4c | 17693 |
| Navy | #424150 | 21555 |
| Midnight | #3a4e63 | 21541 |
| Sage | #49482e | 21562 |
| Hemp | #4F5232 | 22103 |
| Blue Spruce | #4c6151 | 17686 |

See [VARIANTS.md](VARIANTS.md) for the complete 45-color catalog with all variant IDs, tier classifications, and EU availability notes.

---

## Printful API Reference

**Auth headers (ALL requests):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
```

**Rate limits:**
- General API: ~120 req/min. Use `delay(2000)` between calls
- Mockup Generator: ~10 req/min. Use `delay(10000)` between tasks
- On 429: read `x-ratelimit-reset` header, wait that many seconds, retry

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry with jitter, proactive slowdown, and exponential backoff automatically.

**Key endpoints:**

| Endpoint | Method | Use |
|---|---|---|
| `/files` | POST | Upload image to File Library |
| `/store/products` | POST | Create new sync product |
| `/store/products/{id}` | GET/PUT | Read/update sync product + all variants |
| `/store/variants/{vid}` | PUT | Update single variant |
| `/mockup-generator/create-task/586` | POST | Create CC1717 mockup task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |
| `/mockup-generator/printfiles/586` | GET | List CC1717 print positions |

---

## Workflow 1: Create New CC1717 Product

### Step 1: Upload Design to File Library

Design PNGs must be uploaded to Printful's File Library before they can be assigned to products. Printful does not accept external URLs directly in product creation — you must use a File Library `id`.

**Upload pattern:** Upload to Supabase Storage first (for permanent hosting), then POST the public URL to Printful.

```bash
# Upload to Supabase Storage
curl -X POST "${SUPABASE_URL}/storage/v1/object/designs/uploads/${FILENAME}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary "@${LOCAL_FILE_PATH}"

# Get public URL
PUBLIC_URL="${SUPABASE_URL}/storage/v1/object/public/designs/uploads/${FILENAME}"

# Upload to Printful File Library
curl -X POST "https://api.printful.com/files" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'${PUBLIC_URL}'",
    "filename": "'${FILENAME}'"
  }'
```

**Response:** `{ "result": { "id": 123456789, "type": "default", "preview_url": "..." } }`

Save the `id` — this is the `file_id` used in all subsequent API calls.

**Upload all placement assets:**
1. Front design (1800x2400) → `FRONT_FILE_ID`
2. Sleeve S mark (600x525) → `SLEEVE_FILE_ID` (or reuse existing: `950410444`)
3. Back wordmark (1800x2400) → `BACK_FILE_ID` (or reuse existing: `950410495`)

### Step 2: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — CC1717",
      "thumbnail": "https://files.cdn.printful.com/files/.../preview.png"
    },
    "sync_variants": [
      {
        "variant_id": 15114,
        "retail_price": "34.99",
        "files": [
          { "type": "default", "id": FRONT_FILE_ID },
          { "type": "back", "id": BACK_FILE_ID },
          { "type": "sleeve_left", "id": SLEEVE_FILE_ID }
        ]
      },
      {
        "variant_id": 15115,
        "retail_price": "34.99",
        "files": [
          { "type": "default", "id": FRONT_FILE_ID },
          { "type": "back", "id": BACK_FILE_ID },
          { "type": "sleeve_left", "id": SLEEVE_FILE_ID }
        ]
      }
    ]
  }'
```

**Key points:**
- `variant_id` is the **catalog variant ID** from VARIANTS.md (NOT a sync variant ID)
- `retail_price` is the customer-facing price as a string (e.g., `"34.99"`)
- `files[].type` maps to placement names: `"default"` = front, `"back"`, `"sleeve_left"`, `"sleeve_right"`, `"label_outside"`
- Include ALL size variants for each color (S through 4XL = 7 variants per color)
- The `files` array is identical for all variants of the same color

**CRITICAL — Adding variants to existing products (`POST /store/products/{id}/variants`):**
- Files MUST use `url` field (NOT `id` alone) — using only `id` causes `"There can only be one file for each placement"` error
- Correct: `{ "type": "default", "url": "https://...design.png" }`
- Wrong: `{ "type": "default", "id": 950267047 }` (fails with 400)
- The initial product creation (`POST /store/products`) can use `id`, but individual variant creation requires `url`
- Use the Supabase Storage original URLs or Printful CDN preview URLs

### Step 3: Set Variant Prices

Pricing by size (SIGNATURE tier retail):

| Size | Retail Price | Base Cost | Margin |
|---|---|---|---|
| S-L | $34.99 | $13.25 + placements | ~38% |
| XL | $34.99 | $14.95 + placements | ~35% |
| 2XL | $37.99 | $16.25 + placements | ~36% |
| 3XL | $39.99 | $17.55 + placements | ~37% |
| 4XL | $42.99 | $18.85 + placements | ~36% |

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

### Step 4: Apply Branding

See [BRANDING.md](BRANDING.md) for the complete branding specification.

**Quick summary:**
- `sleeve_left`: S mark isotipo white, 32% of canvas (192px in 600px), centered — File ID `950410444`
- `back`: SKAPARA wordmark white, 37% of canvas (666px in 1800px), y=150px — File ID `950410495`

### Step 5: Generate Mockups

See [MOCKUPS.md](MOCKUPS.md) for the complete mockup generation specification.

**Quick summary:**
```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/586" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [15114],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Left", "Back"],
    "files": [
      { "placement": "front", "image_url": "DESIGN_PREVIEW_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } },
      { "placement": "sleeve_left", "image_url": "SLEEVE_PREVIEW_URL", "position": { "area_width": 600, "area_height": 525, "width": 600, "height": 525, "top": 0, "left": 0 } },
      { "placement": "back", "image_url": "BACK_PREVIEW_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } }
    ]
  }'
```

### Step 6: Download Mockups & Upload to Supabase Storage

Mockup S3 URLs expire in ~24h. Always download and re-upload to permanent storage:

```javascript
const storagePath = `designs/mockups/${productSlug}/${colorSlug}-${placement}.png`
const ts = Math.floor(Date.now() / 1000)
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`
```

### Step 7: Update Supabase products Table

```javascript
const ts = Math.floor(Date.now() / 1000)

const images = [
  // Fronts first (hero images)
  { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Title - Black' },
  { src: `https://.../mockups/slug/pepper-front.png?v=${ts}`, alt: 'Title - Pepper' },
  // Backs
  { src: `https://.../mockups/slug/black-back.png?v=${ts}`, alt: 'Title - Black - Back' },
  // Sleeves
  { src: `https://.../mockups/slug/black-sleeve_left.png?v=${ts}`, alt: 'Title - Black - Sleeve' },
]

// 1. Create or update product in Supabase
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative marketing description only. No specs here.',
  translations: {
    es: { title: 'Título en español', description: 'Descripción en español' },
    de: { title: 'Titel auf Deutsch', description: 'Beschreibung auf Deutsch' }
  },
  category_id: 'CATEGORY_UUID', // FK to categories table
  pod_provider: 'printful',
  product_template_id: '586', // Comfort Colors 1717 catalog ID
  provider_product_id: String(pfProductId), // Printful sync product ID
  base_price_cents: 3499,
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  images,
  product_details: {
    safety_information: GPSR_HTML,
    material: '100% Ring-Spun Cotton',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    blank: 'Comfort Colors 1717',
    weight: '6.1 oz/yd',
    fit: 'Relaxed',
    treatment: 'Garment-dyed'
  },
  status: 'active'
})

// 2. Create product variants (dark colors only)
const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

for (const { color, hex, variantId } of selectedColors) {
  for (const size of sizes) {
    await supabase.from('product_variants').upsert({
      product_id: productId,
      color,
      color_hex: hex,
      size,
      is_enabled: true,
      external_variant_id: String(variantId), // Printful catalog variant ID
      image_url: `https://.../mockups/slug/${colorSlug}-front.png?v=${ts}`
    })
  }
}
```

### Step 8: GPSR Compliance (MANDATORY for EU)

Every product MUST have GPSR data before going live. EU Regulation 2023/988.

```html
<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>
<p><strong>Material:</strong> 100% Ring-Spun Cotton (Comfort Colors 1717, 6.1 oz/yd)</p>
<p><strong>Treatment:</strong> Garment-dyed</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

Store in `products.product_details.safety_information` (JSONB).

---

## Workflow 2: Update Branding on Existing CC1717 Products

### Step 1: Get Product & Extract Variant IDs

```bash
curl -s "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" | jq '.result.sync_variants[].id'
```

### Step 2: Bulk Update with Branding Files

```bash
curl -X PUT "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_variants": [
      {
        "id": SYNC_VARIANT_ID_1,
        "files": [
          { "type": "default", "id": FRONT_FILE_ID },
          { "type": "sleeve_left", "id": 950410444 },
          { "type": "back", "id": 950410495 }
        ]
      }
    ]
  }'
```

**Note:** When updating via bulk PUT, use the **sync variant ID** (from GET response), NOT the catalog variant ID.

Rate limit: `delay(2000)` between variant updates, `delay(3000)` between products.

### Step 3: Regenerate Mockups

After branding update, regenerate all mockups to reflect the new sleeve/back assets. See [MOCKUPS.md](MOCKUPS.md).

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Graphite mockup bug | Variant 21264: API returns identical image for all placements | Use `options: ["Front"]` only for Graphite |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib against Printful API | Use curl or Node.js fetch |
| `back` vs `label_outside` | Mutually exclusive — cannot use both on same product | We use `back` for wordmark |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 403 | Missing User-Agent causes blocks on some endpoints | Always include `User-Agent: POD-AI-Store/1.0` if using curl directly |
| EU supplier OOS | Violet fully OOS; Butter partially OOS at EU supplier | Check VARIANTS.md before enabling these colors |
| 4XL EU unavailable | 10 colors have 4XL without EU region availability | Disable 4XL variants for those colors or accept non-EU shipping |
| Cache-busting | Browser/CDN cache images by URL | ALWAYS append `?v=timestamp` when overwriting Supabase Storage files |

---

## Description Rules

**What goes in `description`** (creative text only):
- Product context, design inspiration, target audience
- 2-3 sentences max, casual but smart tone
- Highlight the CC1717 premium feel: "garment-dyed heavyweight", "relaxed fit", "vintage wash"
- Must be translated to EN, ES, DE

**What does NOT go in `description`:**
- Material composition -> `product_details.material`
- Care instructions -> `product_details.care_instructions`
- Manufacturing info -> `product_details.manufacturing_country`
- Safety/compliance -> `product_details.safety_information`

---

## Post-Creation Checklist

After creating a CC1717 product, verify:

- [ ] Product appears in shop with correct category (t-shirts)
- [ ] All enabled variant colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (S, M, L, XL, 2XL, 3XL, 4XL)
- [ ] Price is correct per size tier (not overridden by margin fixer)
- [ ] Mockup images load for all placements (front, back, sleeve)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] Light colors (L > 50) disabled if design uses white/ghost text
- [ ] Alt text follows pattern: "Title - Color", "Title - Color - Back", "Title - Color - Sleeve"
- [ ] Images ordered: all fronts first, then backs, then sleeves
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
