---
name: Printful M2480 Crewneck Production
description: >-
  Complete pipeline for Cotton Heritage M2480 (catalog 411) PREMIUM crewneck sweatshirts on Printful.
  Covers product creation, variant management, branding placement, mockup generation,
  and Supabase integration. Use when creating M2480 crewneck products, generating mockups,
  updating branding, or managing PREMIUM tier crewneck sweatshirts.
---

# Printful M2480 Production Pipeline — PREMIUM Tier

Full production pipeline for SKAPARA PREMIUM crewneck sweatshirts on the Cotton Heritage M2480 blank via Printful API. This is the **PREMIUM tier** crewneck counterpart to the MC1087 PREMIUM tee and M2580 PREMIUM hoodie.

For MC1087 PREMIUM tees, see the `printful-mc1087` skill.
For CC1717 SIGNATURE tees, see the `printful-cc1717` skill.
For Printify-based products (legacy DTG on P26), see the `design-dtg` skill.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | Cotton Heritage M2480 |
| **Catalog ID** | 411 |
| **Tier** | PREMIUM |
| **Material** | 100% cotton face / 65% cotton, 35% polyester (Charcoal Heather: 55% cotton, 45% polyester) |
| **Fabric Weight** | 8.5 oz/yd² (288.2 g/m²) |
| **Fit** | Classic, ribbed crew neck, long sleeve cuffs, flat hem, side-seamed, self-fabric patch on back |
| **Sizes** | S, M, L, XL, 2XL, 3XL |
| **Colors (total)** | 19 |
| **Colors (DARK EU — design-first selection)** | 6: Black, Navy Blazer, Charcoal Heather, Team Royal, Vintage Black, Forest Green |
| **Colors (disabled — light/no-EU)** | 13 (see VARIANTS.md) |
| **Color selection** | **Design-first** — analyze design palette, select 2-5 colors that maximize contrast |
| **Print method** | DTG (Direct-to-Garment) |
| **Production facility** | Printful Latvia (EU) |

**Key differentiator vs MC1087 tee:** M2480 has 8 placements including `label_inside` (same as M2580 hoodie). Sleeves are **450x1800px VERTICAL** (NOT 600x525 like MC1087 tees). Front/back share the same 1800x2400 canvas as MC1087.

**Key differentiator vs M2580 hoodie:** M2480 is a crewneck (no hood, no kangaroo pocket). Same Cotton Heritage PREMIUM brand family. Shares the vertical sleeve canvas format (450x1800).

---

## Placements & Dimensions

All canvases at 150 DPI unless noted:

| Placement | Printfile ID | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `front` | #1 | 1800 x 2400 | 150 | $0.00 (included) | Main design |
| `back` | #1 | 1800 x 2400 | 150 | +$5.25 | **NOT USED (v3)** — clean back |
| `sleeve_left` | #147 | **450 x 1800** | 150 | +$2.20 | SKAPARA wordmark 20% (VERTICAL) |
| `sleeve_right` | #147 | 450 x 1800 | 150 | +$2.20 | Unused currently |
| `label_outside` | #90 | 450 x 450 | 150 | +$2.20 | Neck label |
| `label_inside` | #212 | 750 x 750 | 300 | +$0.99 | Inside label (cheapest branding) |
| `embroidery_wrist_left` | #338 | 600 x 900 | 300 | — | Wrist embroidery |
| `embroidery_wrist_right` | #338 | 600 x 900 | 300 | — | Wrist embroidery |

**IMPORTANT — SLEEVE DIFFERENCE:**
- MC1087 tees: 600x525 (horizontal)
- M2480 crewnecks: **450x1800 (vertical)** — requires NEW branding asset!
- The sleeve_left branding file_id from MC1087 (950410444) is 600x525 and **CANNOT be reused** for M2480

**CONSTRAINT:** `back` and `label_outside` are mutually exclusive in Printful. v3 does NOT use `back` (saves $5.25/unit), so `label_outside` is technically available but currently unused.

---

## Base Costs

| Size | Base Cost (front only) |
|---|---|
| S | $22.09 |
| M | $22.09 |
| L | $22.09 |
| XL | $22.09 |
| 2XL | TBD |
| 3XL | TBD |

Some non-EU colors have slightly higher base cost ($22.25 for S-XL). Use the EU colors which are $22.09.

Additional placement costs stack on top of base cost. A product with front + back + sleeve_left costs:
- S-XL: $22.09 + $5.25 + $2.20 = **$29.54**
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
    "filename": "my-design-front-1800x2400.png"
  }'
```

### Method 2: Multipart Upload (for local files)

```bash
curl -X POST https://api.printful.com/files \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -F "file=@output/my-design-front-1800x2400.png" \
  -F "type=default"
```

**Response** returns `id` (integer file_id) and `url` (CDN preview URL). Save both:
- `id` is used in variant file placement updates
- `url` is used as `image_url` in mockup generation

---

## Workflow 1: Create New M2480 Product

### Step 1: Prepare Design Files

Design the main front canvas at 1800x2400px. Render branding assets per [BRANDING.md](BRANDING.md).

Required files (v3 branding — no back):
1. **Front design** — 1800x2400 PNG (main design)
2. **Sleeve left** — 450x1800 PNG (SKAPARA wordmark vertical at 20% scale, file_id: **950653078**)

**CRITICAL:** The sleeve_left branding asset for M2480 must be rendered at 450x1800 (vertical) with `-resize 360x` (20% width-based). See [BRANDING.md](BRANDING.md) for render commands. The MC1087 sleeve file (600x525) is INCOMPATIBLE.

**v3 decision:** No back branding (saves $5.25/unit). `label_inside` (S mark, file_id: 950649786) can only be added via Printful dashboard — API rejects it.

### Step 2: Upload Design to Printful File Library

Upload the front design PNG via URL or multipart (see File Upload Pattern above). Save the returned `file_id`.

The sleeve_left branding file is already uploaded (20% scale wordmark):
- `sleeve_left`: **950653078** (450x1800, SKAPARA wordmark vertical, verified 2026-03-03)

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
        "variant_id": 11254,
        "retail_price": "49.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": 950653078}
        ]
      },
      {
        "variant_id": 11255,
        "retail_price": "49.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": 950653078}
        ]
      }
    ]
  }'
```

**IMPORTANT:** Include ALL active variants for the colors selected via **design-first analysis**. Select 2-5 colors from the 6 DARK EU palette based on design contrast (see [MOCKUPS.md](MOCKUPS.md) — Design Palette Analysis). Each color x 6 sizes. See [VARIANTS.md](VARIANTS.md) for complete variant ID table.

**CRITICAL — Adding variants to existing products (`POST /store/products/{id}/variants`):**
- Files MUST use `url` field (NOT `id` alone) — using only `id` causes `"There can only be one file for each placement"` error
- Correct: `{ "type": "default", "url": "https://...design.png" }`
- Wrong: `{ "type": "default", "id": 950267047 }` (fails with 400)
- The initial product creation (`POST /store/products`) can use `id`, but individual variant creation requires `url`

**Pricing:** Set `retail_price` on each variant. The margin fixer cron will overwrite if margin is below 35%, so set the correct retail price from the start. Recommended retail for PREMIUM crewneck: $49.95-$54.95.

### Step 4: Generate Mockups

Follow [MOCKUPS.md](MOCKUPS.md) workflow. Generate Ghost mockups for all active dark colors with Front and Left views (v3 — no Back).

### Step 5: Update Supabase

```javascript
const ts = Math.floor(Date.now() / 1000)

// 1. Create or update product in Supabase
// CRITICAL: Set BOTH category (slug string) AND category_id (FK UUID)
// The breadcrumb uses `category` (string), the DB relations use `category_id`
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative marketing description only. No specs here.',
  translations: {
    es: { title: 'Título en español', description: 'Descripción en español' },
    de: { title: 'Titel auf Deutsch', description: 'Beschreibung auf Deutsch' }
  },
  category: 'crewnecks',
  category_id: '3213a34b-0eeb-4195-8531-29e65f442384',
  pod_provider: 'printful',
  product_template_id: '411', // Cotton Heritage M2480 catalog ID
  provider_product_id: String(pfProductId), // Printful sync product ID
  base_price_cents: 4995,
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  images: [
    // v3: Fronts first (hero), then sleeves. No backs.
    { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Product Name - Black' },
    { src: `https://.../mockups/slug/navy-blazer-front.png?v=${ts}`, alt: 'Product Name - Navy Blazer' },
    { src: `https://.../mockups/slug/black-sleeve.png?v=${ts}`, alt: 'Product Name - Black - Sleeve' },
    { src: `https://.../mockups/slug/navy-blazer-sleeve.png?v=${ts}`, alt: 'Product Name - Navy Blazer - Sleeve' },
  ],
  product_details: {
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>...',
    material: '100% cotton face / 65% cotton, 35% polyester, 8.5 oz/yd²',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    model: 'Cotton Heritage M2480',
    tier: 'PREMIUM',
    fit: 'Classic / Ribbed Crew Neck'
  },
  status: 'active'
})

// 2. Select colors via DESIGN-FIRST ANALYSIS (see MOCKUPS.md)
// Analyze the design's color palette BEFORE choosing garment colors.
// DO NOT default to Black — e.g., a black penguin design is invisible on a black shirt.
// Select 2-5 colors from the DARK EU palette that maximize contrast with the design.
const DARK_EU_PALETTE = [
  { color: 'Black', hex: '#101010', L: 16 },
  { color: 'Navy Blazer', hex: '#171f2c', L: 30 },
  { color: 'Charcoal Heather', hex: '#3a3a38', L: 58 },
  { color: 'Team Royal', hex: '#2d407d', L: 65 },
  { color: 'Vintage Black', hex: '#43413D', L: 65 },
  { color: 'Forest Green', hex: '#335231', L: 69 },
]

// Example: Nihilist Penguin (black penguin silhouette + white text)
// Black → EXCLUDED (penguin invisible on #101010)
// Navy Blazer → OK (L=30, dark but penguin silhouette visible)
// Charcoal Heather → BEST (L=58, great contrast for black elements)
// Team Royal → GOOD (blue background, black penguin pops)
// Vintage Black → GOOD (L=65, olive-gray, decent contrast)
// Forest Green → GOOD (green, black penguin visible)
const selectedColors = DARK_EU_PALETTE.filter(c => /* design-first analysis */ true)

const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL']

for (const { color, hex, variantId } of activeVariants) {
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

// 4. Disable light/no-EU color variants if they exist
await supabase
  .from('product_variants')
  .update({ is_enabled: false })
  .eq('product_id', productId)
  .in('color', ['White', 'Bone', 'Carbon Grey', 'Dusty Rose', 'Team Red',
                'Cardinal', 'Adobe', 'Latte', 'Khaki', 'Agave',
                'Light Pink', 'Lavender', 'Sky Blue'])
```

### Step 6: GPSR Compliance

Every product MUST have GPSR data in `product_details` before going live. This is mandatory under EU Regulation 2023/988.

```json
{
  "safety_information": "<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% cotton face / 65% cotton, 35% polyester</p><p><strong>Weight:</strong> 8.5 oz/yd² (288.2 g/m²)</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>",
  "material": "100% cotton face / 65% cotton, 35% polyester, 8.5 oz/yd² (288.2 g/m²)",
  "care_instructions": "Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.",
  "print_technique": "DTG (Direct-to-Garment)",
  "manufacturing_country": "Latvia",
  "brand": "SKAPARA"
}
```

**Note:** Charcoal Heather has a different composition (55% cotton, 45% polyester). If using that color, add a note in safety_information.

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
          {"type": "sleeve_left", "id": 950653078}
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
designs/mockups/{product-slug}/{color-slug}-sleeve.png
```

Public URLs ALWAYS include cache-buster:
```
${SUPABASE_URL}/storage/v1/object/public/designs/mockups/{slug}/{color}-{placement}.png?v={timestamp}
```

### Alt Text Convention (Critical for Frontend)

The `buildVariantImageMap()` function in `product-detail-cache.ts` parses alt text to map images to color variants:

| Placement | Alt Text Pattern | Example |
|---|---|---|
| Front | `"Title - ColorName"` | `"Nihilist Penguin - Black"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Nihilist Penguin - Black - Sleeve"` |

**Image order in `products.images[]`:** Fronts (all colors) -> Sleeves (all colors). First image = hero for shop listing. No backs in v3 branding.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Temporary URLs | Mockup S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib against Printful | Use curl or Node.js fetch |
| `back` vs `label_outside` | Mutually exclusive — cannot use both | v3 does NOT use `back` (saves $5.25/unit) — `label_outside` available |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` |
| Sleeve asset incompatible | MC1087 sleeve is 600x525, M2480 is 450x1800 | Render NEW vertical sleeve asset |
| Charcoal Heather material | 55% cotton / 45% polyester (different from other colors) | Note in GPSR if using |
| No UK region | M2480 ships EU + US but NOT UK | Acceptable for SKAPARA EU-first strategy |
| Cardinal no-EU | Cardinal red is NOT available in EU | Never include in EU products |
| Templates API | Returns NO explicit option_groups (all "default") | Extract views from URL paths |
| 2XL/3XL pricing | Base costs TBD for these sizes | Query API before production |

---

## Variant Reference

See [VARIANTS.md](VARIANTS.md) for the complete table of all 114 variants (19 colors x 6 sizes) with catalog variant IDs, hex codes, luminance values, EU availability, and status.

## Branding Reference

See [BRANDING.md](BRANDING.md) for M2480-specific branding placements, vertical sleeve render commands, file IDs, and anti-patterns.

## Mockup Reference

See [MOCKUPS.md](MOCKUPS.md) for M2480-specific mockup generation, template URL patterns, gallery structure, and rate limits.
