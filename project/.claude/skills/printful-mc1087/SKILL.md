---
name: Printful MC1087 Production
description: >-
  Complete pipeline for Cotton Heritage MC1087 (catalog 917) PREMIUM t-shirts on Printful.
  Covers product creation, variant management, branding placement, mockup generation,
  and Supabase integration. Use when creating MC1087 products, generating mockups,
  updating branding, or managing PREMIUM tier t-shirts.
---

# Printful MC1087 Production Pipeline — PREMIUM Tier

Full production pipeline for SKAPARA PREMIUM t-shirts on the Cotton Heritage MC1087 blank via Printful API. This is the **PREMIUM tier** counterpart to the CC1717 SIGNATURE tier.

For CC1717 SIGNATURE tier, see the `printful-cc1717` skill.
For Printify-based products (legacy DTG on P26), see the `design-dtg` skill.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | Cotton Heritage MC1087 |
| **Catalog ID** | 917 |
| **Tier** | PREMIUM |
| **Material** | 100% combed ring-spun cotton, 6.5 oz |
| **Fit** | Boxy, structured streetwear silhouette |
| **Sizes** | S, M, L, XL, 2XL, 3XL, 4XL |
| **Colors (active)** | 3 dark: Black, Navy Blazer, Vintage Black |
| **Colors (disabled)** | 2 light: White, Vintage White |
| **Print method** | DTG (Direct-to-Garment) |
| **Production facility** | Printful Latvia (EU) |
| **EU regions** | EU, EU_LV, US (no UK) |

**Key differentiator vs CC1717:** MC1087 has `label_inside` placement (CC1717 does not). MC1087 has only 5 colors vs CC1717's 45 — all 3 dark colors should ALWAYS be used for every product on this blank.

---

## Placements & Dimensions

All canvases at 150 DPI:

| Placement | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|
| `front` / `default` | 1800 x 2400 | $0.00 (included) | Main design |
| `back` | 1800 x 2400 | +$5.25 | SKAPARA wordmark |
| `sleeve_left` | 600 x 525 | +$2.20 | S mark isotipo |
| `sleeve_right` | 600 x 525 | +$2.20 | (unused currently) |
| `label_inside` | 450 x 450 | +$0.99 | **UNIQUE to MC1087** — CC1717 does NOT have this |
| `label_outside` | 450 x 450 | +$2.20 | Neck label (nuca) |

**IMPORTANT:** `back` and `label_outside` are **mutually exclusive** in Printful. We use `back` for SKAPARA wordmark.

**`label_inside` is the MC1087's unique advantage** — potential future use for S mark or care label branding at only $0.99/unit (cheapest branding placement available).

---

## Base Costs (Uniform Across All Colors)

| Size | Base Cost |
|---|---|
| S | $14.75 |
| M | $14.75 |
| L | $14.75 |
| XL | $14.75 |
| 2XL | $16.05 |
| 3XL | $17.35 |
| 4XL | $18.65 |

Additional placement costs stack on top of base cost. A product with front + back + sleeve_left costs:
- S-XL: $14.75 + $5.25 + $2.20 = **$22.20**
- 2XL: $16.05 + $5.25 + $2.20 = **$23.50**
- 3XL: $17.35 + $5.25 + $2.20 = **$24.80**
- 4XL: $18.65 + $5.25 + $2.20 = **$26.10**

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

## Workflow 1: Create New MC1087 Product

### Step 1: Prepare Design Files

Design the main front canvas at 1800x2400px. Render branding assets per [BRANDING.md](BRANDING.md).

Required files:
1. **Front design** — 1800x2400 PNG (main design)
2. **Sleeve left** — 600x525 PNG (S mark, pre-rendered, file_id: 950410444)
3. **Back wordmark** — 1800x2400 PNG (SKAPARA wordmark, pre-rendered, file_id: 950410495)

### Step 2: Upload Design to Printful File Library

Upload the front design PNG via URL or multipart (see File Upload Pattern above). Save the returned `file_id`.

The sleeve and back branding files are already uploaded with known file IDs:
- `sleeve_left`: **950410444**
- `back`: **950410495**

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
        "variant_id": 23577,
        "retail_price": "39.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": 950410444},
          {"type": "back", "id": 950410495}
        ]
      },
      {
        "variant_id": 23578,
        "retail_price": "39.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": 950410444},
          {"type": "back", "id": 950410495}
        ]
      }
    ]
  }'
```

**IMPORTANT:** Include ALL active variants (3 colors x 7 sizes = 21 variants). See [VARIANTS.md](VARIANTS.md) for complete variant ID table.

**CRITICAL — Adding variants to existing products (`POST /store/products/{id}/variants`):**
- Files MUST use `url` field (NOT `id` alone) — using only `id` causes `"There can only be one file for each placement"` error
- Correct: `{ "type": "default", "url": "https://...design.png" }`
- Wrong: `{ "type": "default", "id": 950267047 }` (fails with 400)
- The initial product creation (`POST /store/products`) can use `id`, but individual variant creation requires `url`

**Pricing:** Set `retail_price` on each variant. The margin fixer cron will overwrite if margin is below 35%, so set the correct retail price from the start.

### Step 4: Generate Mockups

Follow [MOCKUPS.md](MOCKUPS.md) workflow. Generate Ghost mockups for all 3 dark colors with Front, Left, and Back views.

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
  product_template_id: '917', // Cotton Heritage MC1087 catalog ID
  provider_product_id: String(pfProductId), // Printful sync product ID
  base_price_cents: 3995,
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  images: [
    { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Product Name - Black' },
    { src: `https://.../mockups/slug/navy-blazer-front.png?v=${ts}`, alt: 'Product Name - Navy Blazer' },
    { src: `https://.../mockups/slug/vintage-black-front.png?v=${ts}`, alt: 'Product Name - Vintage Black' },
    { src: `https://.../mockups/slug/black-back.png?v=${ts}`, alt: 'Product Name - Black - Back' },
    { src: `https://.../mockups/slug/navy-blazer-back.png?v=${ts}`, alt: 'Product Name - Navy Blazer - Back' },
    { src: `https://.../mockups/slug/vintage-black-back.png?v=${ts}`, alt: 'Product Name - Vintage Black - Back' },
    { src: `https://.../mockups/slug/black-sleeve_left.png?v=${ts}`, alt: 'Product Name - Black - Sleeve' },
  ],
  product_details: {
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>...',
    material: '100% combed ring-spun cotton, 6.5 oz',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    model: 'Cotton Heritage MC1087',
    tier: 'PREMIUM',
    fit: 'Boxy / Structured Streetwear'
  },
  status: 'active'
})

// 2. Create product variants (only dark colors)
const darkVariants = [
  { color: 'Black', hex: '#0e0e0e' },
  { color: 'Navy Blazer', hex: '#1b2229' },
  { color: 'Vintage Black', hex: '#363533' },
]
const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

for (const { color, hex, variantId } of darkVariants) {
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
  .in('color', ['White', 'Vintage White'])
```

### Step 6: GPSR Compliance

Every product MUST have GPSR data in `product_details` before going live. This is mandatory under EU Regulation 2023/988.

```json
{
  "safety_information": "<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% combed ring-spun cotton</p><p><strong>Weight:</strong> 6.5 oz</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>",
  "material": "100% combed ring-spun cotton, 6.5 oz",
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
          {"type": "sleeve_left", "id": 950410444},
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
| Front | `"Title - ColorName"` | `"Prism Tee - Black"` |
| Back | `"Title - ColorName - Back"` | `"Prism Tee - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Prism Tee - Black - Sleeve"` |

**Image order in `products.images[]`:** Fronts (all colors) → Backs (all colors) → Sleeves. First image = hero for shop listing.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Temporary URLs | Mockup S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib against Printful | Use curl or Node.js fetch |
| `back` vs `label_outside` | Mutually exclusive — cannot use both | We use `back` for wordmark |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` |
| Only 5 colors | MC1087 has no room for color expansion | Always use all 3 dark colors for every product |
| No UK region | MC1087 ships EU + US but NOT UK | Acceptable for SKAPARA EU-first strategy |

---

## Variant Reference

See [VARIANTS.md](VARIANTS.md) for the complete table of all 35 variants with catalog variant IDs, hex codes, sizes, and status.

## Branding Reference

See [BRANDING.md](BRANDING.md) for MC1087-specific branding placements, render commands, file IDs, and anti-patterns.

## Mockup Reference

See [MOCKUPS.md](MOCKUPS.md) for MC1087-specific mockup generation, option groups, gallery structure, and rate limits.
