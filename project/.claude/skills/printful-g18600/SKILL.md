---
name: Printful G18600 Zip Hoodie Production
description: >-
  Complete pipeline for Gildan 18600 (catalog 692) zip hoodies on Printful.
  Covers product creation, variant management, branding placement, mockup generation,
  and Supabase integration. Use when creating G18600 zip hoodie products, generating mockups,
  updating branding, or managing zip hoodie products. ONLY zip hoodie with EU fulfillment.
---

# Printful G18600 Zip Hoodie Production Pipeline — STANDARD Tier

Full production pipeline for SKAPARA zip hoodies on the Gildan 18600 blank via Printful API. This is the **STANDARD tier** zip hoodie — the only zip hoodie blank with EU fulfillment.

For premium t-shirts (MC1087), see the `printful-mc1087` skill.
For signature t-shirts (CC1717), see the `printful-cc1717` skill.
For Printify-based products (legacy DTG on P26), see the `design-dtg` skill.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | Gildan 18600 |
| **Full Name** | Unisex Heavy Blend Zip Hoodie |
| **Catalog ID** | 692 |
| **Tier** | STANDARD |
| **Material** | 50% cotton, 50% polyester, 8 oz/yd2 (271 g/m2) |
| **Fit** | Regular fit, metal zipper, front pouch pockets, unlined hood with color-matched drawcords |
| **Sizes** | S, M, L, XL, 2XL, 3XL, 4XL, 5XL (8 sizes — biggest range!) |
| **Dark EU (design-first selection)** | 4: Black, Navy, Dark Heather, Royal |
| **Color selection** | **Design-first** — analyze design palette, select 2-4 colors that maximize contrast |
| **Colors (NO EU)** | 5: Dark Chocolate, Forest Green, Purple, Cardinal Red, Red |
| **Colors (light/disabled)** | 5: Irish Green, Carolina Blue, Sport Grey, Ash, White |
| **Print method** | DTG (Direct-to-Garment) |
| **Production facility** | Printful Latvia (EU) |
| **Special features** | Air-jet spun yarn for reduced piling, soft fleece inside and outside |

**Key differentiator:** This is a ZIP hoodie — the front canvas is **2250x1500px LANDSCAPE** because the zipper splits the design down the center. Designs MUST account for the center zip line. Also has the biggest size range (S-5XL, 8 sizes).

---

## Placements & Dimensions

All canvases at 150 DPI unless noted:

| Placement | Printfile ID | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `front` / `default` | #466 | **2250 x 1500** | 150 | $0.00 (included) | **LANDSCAPE** — zipper splits center! |
| `back` | #1 | 1800 x 2400 | 150 | +$5.25 | SKAPARA wordmark |
| `sleeve_left` | #147 | 450 x 1800 | 150 | +$2.20 | S mark isotipo (vertical!) |
| `sleeve_right` | #147 | 450 x 1800 | 150 | +$2.20 | Unused currently |
| `label_outside` | #464 | **600 x 600** | 150 | +$2.20 | Neck label (larger than MC1087's 450x450) |
| `embroidery_wrist_left` | #396 | 600 x 900 | 300 | — | Reserved for future |
| `embroidery_wrist_right` | #396 | 600 x 900 | 300 | — | Reserved for future |

**CRITICAL DIFFERENCES vs other blanks:**
- **Front is 2250x1500 LANDSCAPE** (NOT 1800x2400 portrait like t-shirts). The zipper runs down the center!
- **NO `label_inside`** — only `label_outside` at 600x600
- **`label_outside` is 600x600** (larger than MC1087/CC1717's 450x450)
- **Sleeve is 450x1800 VERTICAL** (not 600x525 horizontal like MC1087)
- `back` and `label_outside` are **mutually exclusive** in Printful. We use `back` for SKAPARA wordmark.

---

## Base Costs

| Size | Base Cost |
|---|---|
| S | $22.50 |
| M | $22.50 |
| L | $22.50 |
| XL | $22.50 |
| 2XL | varies |
| 3XL-5XL | varies (up to $28.15) |

EU colors cost ~$1.75 more ($24.25 for S-XL).

Additional placement costs stack on top of base cost. A product with front + back + sleeve_left costs:
- S-XL: $22.50 + $5.25 + $2.20 = **$29.95** (non-EU) / **$31.70** (EU)

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
    "filename": "my-design-front-2250x1500.png"
  }'
```

### Method 2: Multipart Upload (for local files)

```bash
curl -X POST https://api.printful.com/files \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -F "file=@output/my-design-front-2250x1500.png" \
  -F "type=default"
```

**Response** returns `id` (integer file_id) and `url` (CDN preview URL). Save both:
- `id` is used in variant file placement updates
- `url` is used as `image_url` in mockup generation

---

## Workflow 1: Create New G18600 Product

### Step 1: Prepare Design Files

Design the main front canvas at **2250x1500px LANDSCAPE**. The zipper splits the design down the center — either:
1. **Avoid the center** — use left-chest or right-chest placement
2. **Design across the zip** — create a split design that works when the zipper separates the two halves

Render branding assets per [BRANDING.md](BRANDING.md).

Required files:
1. **Front design** — **2250x1500** PNG (LANDSCAPE — unique to zip hoodies!)
2. **Sleeve left** — 450x1800 PNG (S mark, vertical — needs new render for G18600!)
3. **Back wordmark** — 1800x2400 PNG (SKAPARA wordmark, can reuse file_id: 950410495)

**NOTE:** The sleeve canvas for G18600 is 450x1800 (vertical), NOT 600x525 (horizontal) like MC1087. A new sleeve branding file must be rendered. See [BRANDING.md](BRANDING.md).

### Step 2: Upload Design to Printful File Library

Upload the front design PNG via URL or multipart (see File Upload Pattern above). Save the returned `file_id`.

The back branding file is already uploaded:
- `back`: **950410495** (same wordmark as MC1087/CC1717)

The sleeve branding file needs a **NEW upload** for the 450x1800 vertical canvas. See [BRANDING.md](BRANDING.md) for render instructions.

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
        "variant_id": 17295,
        "retail_price": "59.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_LEFT_FILE_ID},
          {"type": "back", "id": 950410495}
        ]
      },
      {
        "variant_id": 17296,
        "retail_price": "59.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_LEFT_FILE_ID},
          {"type": "back", "id": 950410495}
        ]
      }
    ]
  }'
```

**IMPORTANT:** Include ALL active EU variants for the colors selected via design-first analysis (see [MOCKUPS.md](MOCKUPS.md)). For example, 3 colors x 8 sizes = 24 variants. See [VARIANTS.md](VARIANTS.md) for complete variant ID table.

**CRITICAL — Adding variants to existing products (`POST /store/products/{id}/variants`):**
- Files MUST use `url` field (NOT `id` alone) — using only `id` causes `"There can only be one file for each placement"` error
- Correct: `{ "type": "default", "url": "https://...design.png" }`
- Wrong: `{ "type": "default", "id": 950267047 }` (fails with 400)
- The initial product creation (`POST /store/products`) can use `id`, but individual variant creation requires `url`

**Pricing:** Set `retail_price` on each variant. The margin fixer cron will overwrite if margin is below 35%, so set the correct retail price from the start.

### Step 4: Generate Mockups

Follow [MOCKUPS.md](MOCKUPS.md) workflow. Generate Ghost mockups for all active dark colors with Front, Left, and Back views.

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
  base_price_cents: 5995,
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  images: [
    { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Product Name - Black' },
    { src: `https://.../mockups/slug/navy-front.png?v=${ts}`, alt: 'Product Name - Navy' },
    { src: `https://.../mockups/slug/black-back.png?v=${ts}`, alt: 'Product Name - Black - Back' },
    { src: `https://.../mockups/slug/navy-back.png?v=${ts}`, alt: 'Product Name - Navy - Back' },
    { src: `https://.../mockups/slug/black-left.png?v=${ts}`, alt: 'Product Name - Black - Sleeve' },
  ],
  product_details: {
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>...',
    material: '50% cotton, 50% polyester, 8 oz/yd2 (271 g/m2)',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    model: 'Gildan 18600',
    tier: 'STANDARD',
    fit: 'Regular / Zip Hoodie'
  },
  pod_provider: 'printful',
  product_template_id: '692',
  provider_product_id: String(pfProductId),
  status: 'active'
})

// 2. Create product variants (only EU dark colors)
// Select colors via DESIGN-FIRST ANALYSIS (see MOCKUPS.md)
// Analyze the design's color palette BEFORE choosing garment colors.
const DARK_EU_PALETTE = [
  { color: 'Black', hex: '#0b0b0b', L: 11 },
  { color: 'Navy', hex: '#15263c', L: 35 },
  { color: 'Dark Heather', hex: '#3c3d44', L: 61 },
  { color: 'Royal', hex: '#1d57a5', L: 79 },
]
const selectedColors = DARK_EU_PALETTE.filter(c => /* design-first analysis */ true)
const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']

for (const { color, hex } of selectedColors) {
  // NOTE: Dark Heather only has 6 sizes (S-3XL), no 4XL/5XL
  const colorSizes = color === 'Dark Heather'
    ? sizes.filter(s => !['4XL', '5XL'].includes(s))
    : sizes
  for (const size of colorSizes) {
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
  .in('color', ['Sport Grey', 'Carolina Blue', 'White', 'Ash', 'Irish Green'])
```

### Step 6: GPSR Compliance

Every product MUST have GPSR data in `product_details` before going live. This is mandatory under EU Regulation 2023/988.

```json
{
  "safety_information": "<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 50% cotton, 50% polyester</p><p><strong>Weight:</strong> 8 oz/yd2 (271 g/m2)</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p><p><strong>Features:</strong> Air-jet spun yarn for reduced piling, metal zipper, unlined hood</p>",
  "material": "50% cotton, 50% polyester, 8 oz/yd2 (271 g/m2)",
  "care_instructions": "Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.",
  "print_technique": "DTG (Direct-to-Garment)",
  "manufacturing_country": "Latvia",
  "brand": "SKAPARA"
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

See [BRANDING.md](BRANDING.md) for ImageMagick render commands. The G18600 requires a unique sleeve render (450x1800 vertical).

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
          {"type": "sleeve_left", "id": SLEEVE_LEFT_FILE_ID},
          {"type": "back", "id": 950410495}
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
designs/mockups/{product-slug}/{color-slug}-left.png
```

Public URLs ALWAYS include cache-buster:
```
${SUPABASE_URL}/storage/v1/object/public/designs/mockups/{slug}/{color}-{placement}.png?v={timestamp}
```

### Alt Text Convention (Critical for Frontend)

The `buildVariantImageMap()` function in `product-detail-cache.ts` parses alt text to map images to color variants:

| Placement | Alt Text Pattern | Example |
|---|---|---|
| Front | `"Title - ColorName"` | `"Zip Code - Black"` |
| Back | `"Title - ColorName - Back"` | `"Zip Code - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Zip Code - Black - Sleeve"` |

**Image order in `products.images[]`:** Fronts (all colors) -> Backs (all colors) -> Sleeves. First image = hero for shop listing.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| **LANDSCAPE front** | 2250x1500 — zipper splits center | Design for left/right chest OR split design |
| **Vertical sleeve** | 450x1800 — NOT same as MC1087 (600x525) | Render new sleeve branding file |
| No `label_inside` | Only `label_outside` available | Use `label_outside` at 600x600 if needed |
| `back` vs `label_outside` | Mutually exclusive | We use `back` for wordmark |
| Temporary URLs | Mockup S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib | Use curl or Node.js fetch |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` |
| Dark Heather sizes | Only S-2XL (6 sizes, no 3XL-5XL) | Account for missing large sizes |
| NO-EU colors | 5 colors have no EU fulfillment | NEVER use for SKAPARA EU-first products |
| Front mockup overlay | Template 198414 has background_url (zip overlay) | Front mockup includes zip rendering automatically |
| Size range | S-5XL (8 sizes) — biggest range | Great for plus-size inclusivity marketing |

---

## Variant Reference

See [VARIANTS.md](VARIANTS.md) for the complete table of all 94 variants across 14 colors with catalog variant IDs, hex codes, sizes, EU availability, and status.

## Branding Reference

See [BRANDING.md](BRANDING.md) for G18600-specific branding placements, render commands (including the unique landscape front and vertical sleeve), and anti-patterns.

## Mockup Reference

See [MOCKUPS.md](MOCKUPS.md) for G18600-specific mockup generation, template structure, gallery layout, and rate limits.
