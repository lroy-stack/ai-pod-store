---
name: Printful M2580 Hoodie Production
description: >-
  Complete pipeline for Cotton Heritage M2580 (catalog 380) PREMIUM pullover hoodies on Printful.
  Covers product creation, variant management, branding placement, mockup generation,
  and Supabase integration. Use when creating M2580 hoodie products, generating mockups,
  updating branding, or managing PREMIUM tier pullover hoodies.
---

# Printful M2580 Hoodie Production Pipeline — PREMIUM Tier

Full production pipeline for SKAPARA PREMIUM pullover hoodies on the Cotton Heritage M2580 blank via Printful API. This is the **PREMIUM tier hoodie** — the hoodie counterpart to the MC1087 PREMIUM tee.

For MC1087 PREMIUM tees, see the `printful-mc1087` skill.
For CC1717 SIGNATURE tees, see the `printful-cc1717` skill.
For Printify-based products (legacy DTG on P26), see the `design-dtg` skill.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | Cotton Heritage M2580 |
| **Full Name** | Unisex Premium Pullover Hoodie |
| **Catalog ID** | 380 |
| **Tier** | PREMIUM |
| **Material** | 100% cotton face / 65% ring-spun cotton, 35% polyester |
| **Fabric Weight** | 8.5 oz/yd² |
| **Fit** | Classic streetwear, kangaroo pocket, 3-panel hood, matching flat drawstrings |
| **Sizes** | S, M, L, XL, 2XL, 3XL (6 sizes) |
| **Total Colors** | 23 |
| **Dark EU (design-first selection)** | 9: Black, Navy Blazer, Charcoal Heather, Vintage Black, Maroon, Team Royal, Forest Green, Purple, Military Green |
| **Color selection** | **Design-first** — analyze design palette, select 2-5 colors that maximize contrast |
| **Light/Disabled** | 14: Team Red through White |
| **Print method** | DTG (Direct-to-Garment) |
| **Production facility** | Printful Latvia (EU) |
| **Sizing note** | Runs small — recommend ordering one size up |

**Key differentiators vs MC1087 tees:**
- Front canvas is **1800x1800 (square)**, NOT 1800x2400 like tees
- Sleeves are **450x1800 (vertical/tall)**, NOT 600x525 like tees — requires NEW branding assets
- Has `embroidery_wrist_left` and `embroidery_wrist_right` placements
- Has `label_inside` at 750x750 / 300 DPI (vs 450x450 / 150 DPI on MC1087)
- 23 colors (vs 5 on MC1087) with 9 EU-available dark colors
- 6 sizes S-3XL (vs 7 sizes S-4XL on MC1087, no 4XL)

---

## Placements & Dimensions

| Placement | Printfile ID | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `front` / `default` | #134 | **1800 x 1800** | 150 | $0.00 (included) | Main design — **SQUARE** |
| `back` | #1 | 1800 x 2400 | 150 | +$5.25 | SKAPARA wordmark |
| `sleeve_left` | #147 | **450 x 1800** | 150 | +$2.20 | S mark isotipo — **VERTICAL** |
| `sleeve_right` | #147 | 450 x 1800 | 150 | +$2.20 | (unused currently) |
| `label_outside` | #90 | 450 x 450 | 150 | +$2.20 | Neck label (nuca) |
| `label_inside` | #212 | 750 x 750 | 300 | +$0.99 | **Cotton Heritage exclusive** |
| `embroidery_wrist_left` | #338 | 600 x 900 | 300 | — | Wrist embroidery |
| `embroidery_wrist_right` | #338 | 600 x 900 | 300 | — | Wrist embroidery |

**IMPORTANT:** `back` and `label_outside` are **mutually exclusive** in Printful. We use `back` for SKAPARA wordmark.

**CRITICAL — CANVAS DIFFERENCES FROM MC1087 TEES:**
- Front is **1800x1800** (square), NOT 1800x2400 (portrait). Designs must be adapted.
- Sleeves are **450x1800** (tall/vertical), NOT 600x525 (wide/landscape). **NEW branding assets required** — MC1087 sleeve files (file_id: 950410444) will NOT work here.
- `label_inside` is **750x750 at 300 DPI** (vs 450x450 at 150 DPI on MC1087).

---

## Base Costs

| Size | Base Cost (front only) |
|---|---|
| S | $22.55 |
| M | $22.55 |
| L | $22.55 |
| XL | $22.55 |
| 2XL | TBD (check API) |
| 3XL | TBD (check API) |

Some colors (light/extended) may have a higher base cost of $24.95 for S-XL.

Additional placement costs stack on top of base cost. A product with front + back + sleeve_left costs:
- S-XL: $22.55 + $5.25 + $2.20 = **$30.00**
- 2XL: TBD + $5.25 + $2.20 = **TBD**
- 3XL: TBD + $5.25 + $2.20 = **TBD**

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
    "filename": "my-design-front-1800x1800.png"
  }'
```

### Method 2: Multipart Upload (for local files)

```bash
curl -X POST https://api.printful.com/files \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -F "file=@output/my-design-front-1800x1800.png" \
  -F "type=default"
```

**Response** returns `id` (integer file_id) and `url` (CDN preview URL). Save both:
- `id` is used in variant file placement updates
- `url` is used as `image_url` in mockup generation

---

## Workflow 1: Create New M2580 Hoodie Product

### Step 1: Prepare Design Files

Design the main front canvas at **1800x1800px** (SQUARE — different from tees). Render branding assets per [BRANDING.md](BRANDING.md).

Required files:
1. **Front design** — 1800x1800 PNG (main design, square canvas)
2. **Sleeve left** — 450x1800 PNG (S mark, **NEW vertical asset required** — cannot reuse MC1087 600x525)
3. **Back wordmark** — 1800x2400 PNG (SKAPARA wordmark, can reuse MC1087 file_id: 950410495)

### Step 2: Upload Design to Printful File Library

Upload the front design PNG via URL or multipart (see File Upload Pattern above). Save the returned `file_id`.

Upload the NEW sleeve branding file (450x1800 vertical). Save the returned `file_id`.

The back branding file can be reused from MC1087:
- `back`: **950410495**

**WARNING:** The MC1087 sleeve file (950410444) is 600x525 — it will NOT work on M2580's 450x1800 sleeve canvas. You MUST upload a new file.

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
        "variant_id": 10779,
        "retail_price": "59.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": NEW_SLEEVE_FILE_ID},
          {"type": "back", "id": 950410495}
        ]
      },
      {
        "variant_id": 10780,
        "retail_price": "59.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": NEW_SLEEVE_FILE_ID},
          {"type": "back", "id": 950410495}
        ]
      }
    ]
  }'
```

**IMPORTANT:** Include ALL active variants for the colors selected via **design-first analysis**. Select 2-5 colors from the 9 DARK EU palette based on design contrast (see [MOCKUPS.md](MOCKUPS.md) — Design Palette Analysis). Each color x 6 sizes. See [VARIANTS.md](VARIANTS.md) for complete variant ID table.

**CRITICAL — Adding variants to existing products (`POST /store/products/{id}/variants`):**
- Files MUST use `url` field (NOT `id` alone) — using only `id` causes `"There can only be one file for each placement"` error
- Correct: `{ "type": "default", "url": "https://...design.png" }`
- Wrong: `{ "type": "default", "id": 950267047 }` (fails with 400)
- The initial product creation (`POST /store/products`) can use `id`, but individual variant creation requires `url`

**Pricing:** Set `retail_price` on each variant. The margin fixer cron will overwrite if margin is below 35%, so set the correct retail price from the start.

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
  category_id: 'CATEGORY_UUID', // FK to categories table
  pod_provider: 'printful',
  product_template_id: '380', // Cotton Heritage M2580 catalog ID
  provider_product_id: String(pfProductId), // Printful sync product ID
  base_price_cents: 5995,
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  images: [
    { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Product Name - Black' },
    { src: `https://.../mockups/slug/navy-blazer-front.png?v=${ts}`, alt: 'Product Name - Navy Blazer' },
    { src: `https://.../mockups/slug/black-back.png?v=${ts}`, alt: 'Product Name - Black - Back' },
    { src: `https://.../mockups/slug/navy-blazer-back.png?v=${ts}`, alt: 'Product Name - Navy Blazer - Back' },
    { src: `https://.../mockups/slug/black-sleeve_left.png?v=${ts}`, alt: 'Product Name - Black - Sleeve' },
  ],
  product_details: {
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>...',
    material: '100% cotton face / 65% ring-spun cotton, 35% polyester, 8.5 oz/yd²',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    model: 'Cotton Heritage M2580',
    tier: 'PREMIUM',
    fit: 'Classic Streetwear / Pullover Hoodie',
    sizing_note: 'Runs small — recommend ordering one size up'
  },
  status: 'active'
})

// 2. Create product variants — select colors via DESIGN-FIRST ANALYSIS (see MOCKUPS.md)
// Analyze the design's color palette BEFORE choosing garment colors.
// DO NOT default to Black — e.g., a black penguin design is invisible on a black shirt.
const DARK_EU_PALETTE = [
  { color: 'Black', hex: '#080808', L: 8 },
  { color: 'Navy Blazer', hex: '#171f2c', L: 30 },
  { color: 'Charcoal Heather', hex: '#463e3d', L: 64 },
  { color: 'Vintage Black', hex: '#43413D', L: 65 },
  { color: 'Maroon', hex: '#7d263a', L: 66 },
  { color: 'Team Royal', hex: '#1b43ae', L: 67 },
  { color: 'Forest Green', hex: '#335231', L: 69 },
  { color: 'Purple', hex: '#623a7a', L: 77 },
  { color: 'Military Green', hex: '#5c4f32', L: 80 },
]
const selectedColors = DARK_EU_PALETTE.filter(c => /* design-first analysis */ true)
const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL']

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

// 3. Disable light color variants if they exist
await supabase
  .from('product_variants')
  .update({ is_enabled: false })
  .eq('product_id', productId)
  .in('color', ['White', 'Carbon Grey', 'Bone', 'Sky Blue', 'Light Pink', 'Lavender', 'Oatmeal Heather'])
```

### Step 6: GPSR Compliance

Every product MUST have GPSR data in `product_details` before going live. This is mandatory under EU Regulation 2023/988.

```json
{
  "safety_information": "<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% cotton face / 65% ring-spun cotton, 35% polyester</p><p><strong>Weight:</strong> 8.5 oz/yd²</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>",
  "material": "100% cotton face / 65% ring-spun cotton, 35% polyester, 8.5 oz/yd²",
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
          {"type": "sleeve_left", "id": NEW_SLEEVE_FILE_ID},
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
| Front | `"Title - ColorName"` | `"Void Hoodie - Black"` |
| Back | `"Title - ColorName - Back"` | `"Void Hoodie - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Void Hoodie - Black - Sleeve"` |

**Image order in `products.images[]`:** Fronts (all colors) then Backs (all colors) then Sleeves. First image = hero for shop listing.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Temporary URLs | Mockup S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib against Printful | Use curl or Node.js fetch |
| `back` vs `label_outside` | Mutually exclusive — cannot use both | We use `back` for wordmark |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` |
| Front canvas SQUARE | 1800x1800, not 1800x2400 like tees | Designs must be adapted for square |
| Sleeves VERTICAL | 450x1800, not 600x525 like MC1087 tees | NEW branding assets required |
| MC1087 sleeve reuse | File 950410444 is 600x525 — wrong for M2580 | Must upload new 450x1800 file |
| Runs small | M2580 runs small vs standard sizing | Add sizing_note to product_details |
| No UK region | M2580 ships EU + US but NOT UK | Acceptable for SKAPARA EU-first strategy |
| Some colors non-EU | Adobe, Latte, Khaki, Team Gold, Carolina Blue, Light Pink, Lavender, Oatmeal Heather | Only use EU-available colors |

---

## Variant Reference

See [VARIANTS.md](VARIANTS.md) for the complete table of all 138 variants (23 colors x 6 sizes) with catalog variant IDs, hex codes, luminance values, EU availability, and status.

## Branding Reference

See [BRANDING.md](BRANDING.md) for M2580-specific branding placements, render commands, file IDs, and anti-patterns.

## Mockup Reference

See [MOCKUPS.md](MOCKUPS.md) for M2580-specific mockup generation, option groups, gallery structure, and rate limits.
