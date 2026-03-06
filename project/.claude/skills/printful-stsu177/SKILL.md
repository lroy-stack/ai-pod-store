---
name: Printful STSU177 Hoodie Production
description: >-
  Complete pipeline for Stanley/Stella STSU177 (catalog 479) ESSENTIAL ECO pullover hoodies on Printful.
  Covers product creation, variant management, branding placement, mockup generation,
  and Supabase integration. Use when creating STSU177 hoodie products, generating mockups,
  updating branding, or managing ESSENTIAL ECO tier organic pullover hoodies.
---

# Printful STSU177 Hoodie Production Pipeline — ESSENTIAL ECO Tier

Full production pipeline for SKAPARA ESSENTIAL ECO pullover hoodies on the Stanley/Stella STSU177 blank via Printful API. This is the **ESSENTIAL ECO tier hoodie** — 100% organic cotton (GOTS certified), regular fit, EU sizing.

For M2580 PREMIUM hoodies (Cotton Heritage), see the `printful-m2580` skill.
For MC1087 PREMIUM tees, see the `printful-mc1087` skill.
For CC1717 SIGNATURE tees, see the `printful-cc1717` skill.
For Printify-based products (legacy DTG on P26), see the `design-dtg` skill.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | Stanley/Stella STSU177 |
| **Full Name** | Unisex Essential Eco Hoodie |
| **Catalog ID** | 479 |
| **Tier** | ESSENTIAL ECO |
| **Material** | 100% organic cotton (GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan) |
| **Fabric Weight** | 10.32 oz/yd² (350 g/m²) |
| **Fit** | Regular fit |
| **Features** | Set-in sleeves, self-fabric double-layered hood, front pouch pocket, 1x1 rib at sleeve/bottom hem, single-needle topstitch at neckline, metal eyelets, inside tape at back neck, self-fabric half-moon at back neck |
| **Sizes** | S, M, L, XL, 2XL (5 sizes) |
| **Total Colors** | 4 |
| **Dark (design-first selection)** | 2: Black, French Navy |
| **Light/Disabled** | 2: Desert Dust, White |
| **Color selection** | **Design-first** — analyze design palette, select colors that maximize contrast |
| **Print methods** | DTG, Embroidery, DTF — ALL available in EU |
| **Production facility** | Printful Latvia (EU) |
| **Sourced from** | Bangladesh |
| **Sizing note** | EU sizes shown — US customers should order one size UP. Comes with manufacturer's side tag (required by law). |

**Key differentiators vs M2580 PREMIUM hoodies:**
- Front canvas is **2100x2100 (BIGGEST square)**, vs M2580's 1800x1800
- **Only 4 colors** (vs M2580's 23) — 2 dark, 2 light
- **NO `back_large` or `label_outside` placements** (M2580 has `label_outside`)
- **DTF available in EU** (M2580 has no DTF)
- **100% organic cotton** (vs M2580's cotton/poly blend)
- Much higher base cost: **$44.75** (vs M2580's ~$22.55)
- 5 sizes S-2XL (vs M2580's 6 sizes S-3XL, no 3XL)
- Sleeves same: 450x1800 (compatible with M2580/M2480 branding)
- `label_inside` uses 600x600 @300DPI (vs M2580's 750x750 @300DPI) — **NOT compatible, needs own file**

**Key differentiators vs SASU024 (if exists):**
- Front canvas **2100x2100** (BIGGER than SASU024's 1875x1875)
- NO `back_large` placement (SASU024 has 2250x2700 `back_large`)
- NO `label_outside` placement (SASU024 has it)
- DTF available in EU (SASU024: DTF NOT available in EU)
- Has "Desert Dust" color instead of "Heather Grey"
- Slightly cheaper: $44.75 vs $45.89
- "Regular fit" vs SASU024's "Relaxed fit"
- Set-in sleeves vs SASU024's dropped shoulders
- Placement costs higher: $6.95 (vs SASU024's $5.95)
- `label_inside` higher: $1.50 (vs SASU024's $0.99)

---

## Placements & Dimensions

| Placement | Printfile ID | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `front` / `default` | #139 | **2100 x 2100** | 150 | $6.95 | Main design — **BIGGEST SQUARE** |
| `back` | #1 | 1800 x 2400 | 150 | +$6.95 | SKAPARA wordmark |
| `sleeve_left` | #147 | **450 x 1800** | 150 | +$6.95 | S mark / wordmark — **VERTICAL** (shared canvas with M2580/M2480) |
| `sleeve_right` | #147 | 450 x 1800 | 150 | +$6.95 | (unused currently) |
| `label_inside` | #232 | **600 x 600** | 300 | +$1.50 | S mark isotipo |

**IMPORTANT:** `back` conflicts with `label_outside` and `back_large` — but neither of those exist in STSU177's DTG placements, so this is a non-issue.

**IMPORTANT:** `sleeve_left` and `sleeve_right` conflict with `embroidery_wrist_left` and `embroidery_wrist_right`. Cannot mix DTG sleeves with embroidery wrists on the same product.

**Physical Placement Dimensions (inches):**

| Placement | Width | Height |
|---|---|---|
| front | 14" | 14" |
| back | 12" | 16" |
| sleeve_left | 3" | 12" |
| sleeve_right | 3" | 12" |
| label_inside | 2" | 2" |

**Embroidery Placements (separate technique):**

| Placement | Printfile ID | Canvas (px) | DPI | Physical Size |
|---|---|---|---|---|
| `embroidery_chest_left` | — | 1200 x 1200 | 300 | 4" x 4" |
| `embroidery_chest_center` | — | 3000 x 1800 | 300 | 10" x 6" |
| `embroidery_wrist_left` | #396 | 600 x 900 | 300 | 2" x 3" |
| `embroidery_wrist_right` | #396 | 600 x 900 | 300 | 2" x 3" |

**Thread colors (embroidery):** 15 colors available. Has `unlimited_color` option for `embroidery_chest` placements. See [VARIANTS.md](VARIANTS.md) for the full thread color table.

**CRITICAL — CANVAS DIFFERENCES FROM M2580:**
- Front is **2100x2100** (BIGGER square), NOT 1800x1800. Designs can be **larger** on STSU177.
- Sleeves are **450x1800** (SAME as M2580/M2480). **Branding files are compatible.**
- `label_inside` is **600x600 at 300 DPI** (vs M2580's 750x750 at 300 DPI). **NOT compatible — needs own file.**

---

## Base Costs

| Size | Base Cost (front only) |
|---|---|
| S | $44.75 |
| M | $44.75 |
| L | $44.75 |
| XL | $44.75 |
| 2XL | $46.25 |

Additional placement costs stack on top of base cost. A product with front + back + sleeve_left costs:
- S-XL: $44.75 + $6.95 + $6.95 = **$58.65**
- 2XL: $46.25 + $6.95 + $6.95 = **$60.15**

A product with front + sleeve_left + label_inside costs:
- S-XL: $44.75 + $6.95 + $1.50 = **$53.20**
- 2XL: $46.25 + $6.95 + $1.50 = **$54.70**

---

## Printful API Authentication

ALL requests require these headers:

```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
```

Env vars are in `frontend/.env.local`:
- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID`

---

## Rate Limits

| Endpoint | Limit | Recommended Delay |
|---|---|---|
| General API | ~120 req/min | 2000ms between calls |
| Mockup Generator | ~10 req/min | 10000ms between tasks |
| File uploads | ~30 req/min | 3000ms between uploads |

On HTTP 429: read `x-ratelimit-reset` header, wait that many seconds, retry.

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry with jitter, proactive slowdown, and exponential backoff automatically.

---

## File Upload Pattern

Printful requires files to be in its File Library before they can be used on products. Two upload methods:

### Method 1: URL Upload (preferred for Supabase-hosted files)

```bash
curl -X POST https://api.printful.com/files \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-supabase.supabase.co/storage/v1/object/public/designs/my-design.png",
    "filename": "my-design-front-2100x2100.png"
  }'
```

### Method 2: Multipart Upload (for local files)

```bash
curl -X POST https://api.printful.com/files \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -F "file=@output/my-design-front-2100x2100.png" \
  -F "type=default"
```

**Response** returns `id` (integer file_id) and `url` (CDN preview URL). Save both:
- `id` is used in variant file placement updates
- `url` is used as `image_url` in mockup generation

---

## Workflow 1: Create New STSU177 Hoodie Product

### Step 1: Prepare Design Files

Design the main front canvas at **2100x2100px** (BIGGEST SQUARE — larger than M2580's 1800x1800). Render branding assets per [BRANDING.md](BRANDING.md).

Required files:
1. **Front design** — 2100x2100 PNG (main design, square canvas)
2. **Sleeve left** — 450x1800 PNG (SKAPARA wordmark vertical — shared with M2580/M2480)
3. **Label inside** — 600x600 PNG (S mark isotipo — STSU177-specific, NOT shared with M2580)

Optional:
4. **Back wordmark** — 1800x2400 PNG (SKAPARA wordmark — adds $6.95/unit)

### Step 2: Upload Design to Printful File Library

Upload the front design PNG via URL or multipart (see File Upload Pattern above). Save the returned `file_id`.

The sleeve branding file can be reused from M2580/M2480 if already uploaded:
- `sleeve_left`: Use the existing M2580 sleeve wordmark file_id (450x1800 vertical — compatible canvas)

The `label_inside` file MUST be a **600x600 @300DPI** file — M2580's 750x750 label file is **NOT compatible**.

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — SKAPARA",
      "thumbnail": "https://cdn.printful.com/.../design_preview.png"
    },
    "sync_variants": [
      {
        "variant_id": 12372,
        "retail_price": "89.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": STSU177_LABEL_INSIDE_FILE_ID}
        ]
      },
      {
        "variant_id": 12373,
        "retail_price": "89.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": STSU177_LABEL_INSIDE_FILE_ID}
        ]
      }
    ]
  }'
```

**IMPORTANT:** Include ALL active variants for the colors selected via **design-first analysis**. With only 2 dark colors available (Black and French Navy), most STSU177 products will use both. Each color x 5 sizes = 10 dark variants. See [VARIANTS.md](VARIANTS.md) for complete variant ID table.

**CRITICAL — Adding variants to existing products (`POST /store/products/{id}/variants`):**
- Files MUST use `url` field (NOT `id` alone) — using only `id` causes `"There can only be one file for each placement"` error
- Correct: `{ "type": "default", "url": "https://...design.png" }`
- Wrong: `{ "type": "default", "id": 950267047 }` (fails with 400)
- The initial product creation (`POST /store/products`) can use `id`, but individual variant creation requires `url`

**Pricing:** STSU177 is a premium organic blank. Retail price must account for the higher base cost ($44.75-$46.25). Recommended retail: $89.95-$99.95 depending on placements used. The margin fixer cron will overwrite if margin is below 35%, so set the correct retail price from the start.

### Step 4: Generate Mockups

Follow [MOCKUPS.md](MOCKUPS.md) workflow. Generate Ghost mockups for all selected dark colors with Front, Left, and Back views.

### Step 5: Update Supabase

```javascript
const ts = Math.floor(Date.now() / 1000)

// 1. Create or update product in Supabase
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative marketing description only. No specs here.',
  translations: {
    es: { title: 'Título en español', description: 'Descripción en español' },
    de: { title: 'Titel auf Deutsch', description: 'Beschreibung auf Deutsch' }
  },
  base_price_cents: 8995,
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  images: [
    { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Product Name - Black' },
    { src: `https://.../mockups/slug/french-navy-front.png?v=${ts}`, alt: 'Product Name - French Navy' },
    { src: `https://.../mockups/slug/black-back.png?v=${ts}`, alt: 'Product Name - Black - Back' },
    { src: `https://.../mockups/slug/french-navy-back.png?v=${ts}`, alt: 'Product Name - French Navy - Back' },
    { src: `https://.../mockups/slug/black-sleeve_left.png?v=${ts}`, alt: 'Product Name - Black - Sleeve' },
  ],
  product_details: {
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>...',
    material: '100% organic cotton (GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan), 350 g/m² (10.32 oz/yd²)',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    model: 'Stanley/Stella STSU177',
    tier: 'ESSENTIAL ECO',
    fit: 'Regular Fit / Pullover Hoodie',
    sizing_note: 'EU sizes shown — US customers should order one size UP. Comes with manufacturer side tag.',
    certifications: 'GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan'
  },
  pod_provider: 'printful',
  product_template_id: '479',
  provider_product_id: String(pfProductId),
  status: 'active'
})

// 2. Create product variants — STSU177 has only 2 dark colors
const DARK_PALETTE = [
  { color: 'Black', hex: '#0b0b0b', L: 11 },
  { color: 'French Navy', hex: '#071429', L: 20 },
]
const sizes = ['S', 'M', 'L', 'XL', '2XL']

for (const { color, hex } of DARK_PALETTE) {
  for (const size of sizes) {
    await supabase.from('product_variants').upsert({
      product_id: productId,
      color,
      color_hex: hex,
      size,
      is_enabled: true,
      image_url: `https://.../mockups/slug/${colorSlug}-front.png?v=${ts}`,
      external_variant_id: String(variantId), // Printful catalog variant ID
    })
  }
}

// 3. Disable light color variants if they exist
await supabase
  .from('product_variants')
  .update({ is_enabled: false })
  .eq('product_id', productId)
  .in('color', ['Desert Dust', 'White'])
```

### Step 6: GPSR Compliance

Every product MUST have GPSR data in `product_details` before going live. This is mandatory under EU Regulation 2023/988.

```json
{
  "safety_information": "<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% organic cotton (GOTS certified)</p><p><strong>Weight:</strong> 350 g/m² (10.32 oz/yd²)</p><p><strong>Compliance:</strong> GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan, REACH</p><p><strong>Sourced from:</strong> Bangladesh</p>",
  "material": "100% organic cotton (GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan), 350 g/m² (10.32 oz/yd²)",
  "care_instructions": "Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.",
  "print_technique": "DTG (Direct-to-Garment)",
  "manufacturing_country": "Latvia",
  "brand": "SKAPARA",
  "certifications": "GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan"
}
```

---

## Workflow 2: Update Existing Product Branding

Use this when branding assets change or when adding branding to products that lack it.

### Step 1: Get Current Product State

```bash
curl -s "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" | jq '.result.sync_variants[] | {id, name, files: [.files[].type]}'
```

### Step 2: Render Updated Branding (if needed)

See [BRANDING.md](BRANDING.md) for ImageMagick render commands. Skip if using existing file IDs.

### Step 3: Upload New Files (if needed)

Upload via `POST /files`. Save returned `id`.

### Step 4: Update All Variants (Bulk)

```bash
curl -X PUT "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_variants": [
      {
        "id": SYNC_VARIANT_ID_1,
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": STSU177_LABEL_INSIDE_FILE_ID}
        ]
      },
      ...repeat for all active variants...
    ]
  }'
```

Rate limit: `delay(2000)` between per-variant updates, `delay(3000)` between products.

### Step 5: Regenerate Mockups

After branding update, regenerate mockups per [MOCKUPS.md](MOCKUPS.md) and update `products.images[]` in Supabase with fresh `?v=timestamp` cache-busting.

---

## Supabase Integration

### Image URL Pattern

All mockup images stored in Supabase Storage under `designs/mockups/{product-slug}/`:

```
designs/mockups/{product-slug}/{color-slug}-front.png
designs/mockups/{product-slug}/{color-slug}-back.png
designs/mockups/{product-slug}/{color-slug}-sleeve_left.png
```

Public URLs ALWAYS include cache-buster:
```
${SUPABASE_URL}/storage/v1/object/public/designs/mockups/{slug}/{color}-{placement}.png?v={timestamp}
```

### Alt Text Convention (Critical for Frontend)

The `buildVariantImageMap()` function in `product-detail-cache.ts` parses alt text to map images to color variants:

| Placement | Alt Text Pattern | Example |
|---|---|---|
| Front | `"Title - ColorName"` | `"Eco Hoodie - Black"` |
| Back | `"Title - ColorName - Back"` | `"Eco Hoodie - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Eco Hoodie - Black - Sleeve"` |

**Image order in `products.images[]`:** Fronts (all colors) then Backs (all colors) then Sleeves. First image = hero for shop listing.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Temporary URLs | Mockup S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib against Printful | Use curl or Node.js fetch |
| `back` conflicts | `back` conflicts with `label_outside` and `back_large` | Neither exists in STSU177 DTG — non-issue |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST ($89.95+) |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` |
| Front canvas BIGGEST | 2100x2100, bigger than M2580's 1800x1800 | Designs can be larger on STSU177 |
| Sleeves VERTICAL | 450x1800, same as M2580/M2480 | Branding files ARE compatible |
| `label_inside` DIFFERENT | 600x600 @300DPI, NOT 750x750 like M2580 | Must render STSU177-specific label file |
| Only 2 dark colors | Black + French Navy are the only darks | Both should almost always be included |
| EU sizing | Sizes run EU — US customers must order UP | Add sizing_note to product_details |
| Side tag | Comes with manufacturer's side tag (legal requirement) | Mention in product description |
| Sleeve conflicts | DTG sleeves conflict with embroidery wrists | Cannot mix techniques on same arm |
| High base cost | $44.75-$46.25 — highest hoodie blank | Retail $89.95+ for 35%+ margin |
| Only 5 sizes | S-2XL, no 3XL | Different from M2580's S-3XL |

---

## Variant Reference

See [VARIANTS.md](VARIANTS.md) for the complete table of all 20 variants (4 colors x 5 sizes) with catalog variant IDs, hex codes, luminance values, EU availability, and status.

## Branding Reference

See [BRANDING.md](BRANDING.md) for STSU177-specific branding placements, render commands, file IDs, and anti-patterns.

## Mockup Reference

See [MOCKUPS.md](MOCKUPS.md) for STSU177-specific mockup generation, option groups, gallery structure, and rate limits.
