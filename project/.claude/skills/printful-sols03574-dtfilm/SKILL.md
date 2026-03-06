---
name: Printful SOL'S 03574 DTFilm Sweatshirt
description: >-
  Complete pipeline for SOL'S 03574 Comet Organic Sweatshirt (catalog 506) with DTFilm/DTFlex
  technique on Printful. Covers product creation, variant management, DTFilm design placement,
  mockup generation, and Supabase integration. Use when creating DTFilm sweatshirt products,
  full-color printed sweatshirts, gradient sweatshirts, or managing SOL'S 03574 products
  with dtfilm printing. 8 colors, XS-XXL (6 sizes), EU fulfillment from Latvia.
---

# Printful SOL'S 03574 Comet DTFilm — Complete Pipeline

Full production pipeline for SKAPARA sweatshirts using the SOL'S 03574 Comet Organic Sweatshirt blank with DTFilm (DTFlex) printing technique on Printful.

For DTG or embroidery on this same blank, see `printful-sols03574-dtg` or `printful-sols03574-embroidery` skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03574 Comet Organic Sweatshirt |
| **Catalog ID** | 506 |
| **Technique** | DTFilm (API key: `dtfilm`, marketing: DTFlex) |
| **Material** | 80% organic cotton, 20% recycled polyester |
| **Fabric Weight** | ~9.2 oz/yd² (310 g/m²) |
| **Fit** | Regular, unisex |
| **Sizes** | XS, S, M, L, XL, XXL (6 sizes) |
| **Colors** | 8 (Black, Bottle Green, Deep Charcoal Grey, French Navy, Grey Melange, Red, Royal Blue, White) |
| **Print Method** | DTFilm — PET film + adhesive + heat press 165C + cold peel |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES |
| **Base Cost** | 22.40-26.95 EUR |

---

## When to Use

- Create a new DTFilm sweatshirt product on Printful using SOL'S 03574
- Upload full-color designs (gradients, photos, unlimited CMYK) to a sweatshirt
- Apply SKAPARA branding via DTFilm label placement
- Generate mockups for SOL'S 03574 DTFilm products
- Manage SOL'S 03574 DTFilm variant colors and sizes
- Update Supabase with product data and mockup images

---

## DTFilm Technique — Key Facts

- **Full CMYK color** — unlimited colors, gradients, photographic content
- **Smooth vinyl-like texture** — distinct from DTG's soft-ink feel
- **Process:** Design printed to PET film -> adhesive powder -> heat-cured -> heat-pressed at 165C -> cold peel
- **Works on polyester blends** (unlike DTG which requires high cotton content)
- **File types use `_dtf` suffix** in Printful API: `front_dtf`, `back_dtf`, etc.
- **50+ washes durability**

---

## Placements & Canvas Sizes

All DTFilm placements at 150 DPI:

| Placement | Printfile | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|---|
| `front_dtf` | PF#1 | 1800 x 2400 | +5.25 EUR | Main design |
| `back_dtf` | PF#1 | 1800 x 2400 | +5.25 EUR | Back design |
| `front_large_dtf` | PF#1 | 1800 x 2400 | +5.25 EUR | Front large variant |
| `back_large_dtf` | PF#1 | 1800 x 2400 | +5.25 EUR | Back large variant |
| `label_inside_dtf` | PF#249 | 255 x 255 | +0.95 EUR | Inside label — SKAPARA brand mark |

**IMPORTANT:** `front_dtf` and `front_large_dtf` are mutually exclusive. Same for `back_dtf` and `back_large_dtf`. Choose one size per side.

### Recommended SKAPARA Setup

- `front_dtf`: Main design (1800x2400 @150dpi)
- `back_dtf`: SKAPARA wordmark or complementary design (1800x2400 @150dpi)
- `label_inside_dtf`: SKAPARA S mark (255x255 @150dpi) — only +0.95 EUR

**Total extra cost:** +5.25 (front) + 5.25 (back) + 0.95 (label) = +11.45 EUR

---

## Base Costs (Production EUR)

| Size | Base Cost | + Front + Back + Label | Total Production |
|---|---|---|---|
| XS | 22.40 | +11.45 | 33.85 |
| S | 22.40 | +11.45 | 33.85 |
| M | 22.40 | +11.45 | 33.85 |
| L | 22.40 | +11.45 | 33.85 |
| XL | 24.70 | +11.45 | 36.15 |
| XXL | 26.95 | +11.45 | 38.40 |

### Suggested Retail Pricing (40%+ margin)

| Size | Production | Retail (EUR) | Margin |
|---|---|---|---|
| XS-L | 33.85 | 59.95 | 43.5% |
| XL | 36.15 | 62.95 | 42.6% |
| XXL | 38.40 | 66.95 | 42.6% |

---

## Printful API Reference

**Auth headers (ALL requests):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: 17795695
Content-Type: application/json
User-Agent: POD-AI-Store/1.0
```

**CRITICAL:** `User-Agent` is MANDATORY. Without it, Cloudflare returns 401.

**NEVER use Store ID 17595620** (different store).

**Rate limits:** ~120 req/min. Use `delay(2000)` between calls.

**Shared utility:** `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'`

---

## Workflow: Create New DTFilm Product

### Step 1: Upload Designs to Supabase Storage + Printful File Library

```bash
# Upload to Supabase Storage
curl -X POST "${SUPABASE_URL}/storage/v1/object/designs/uploads/${FILENAME}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary "@${LOCAL_FILE_PATH}"

PUBLIC_URL="${SUPABASE_URL}/storage/v1/object/public/designs/uploads/${FILENAME}"

# Upload to Printful File Library
curl -X POST "https://api.printful.com/files" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "url": "'${PUBLIC_URL}'",
    "filename": "'${FILENAME}'"
  }'
```

**Upload all placement assets:**
1. Front DTFilm design (1800x2400 @150dpi) -> `FRONT_FILE_ID`
2. Back DTFilm design (1800x2400 @150dpi) -> `BACK_FILE_ID`
3. Label inside S mark (255x255 @150dpi) -> `LABEL_FILE_ID`

### Step 2: Create Sync Product

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — SOL\'S 03574 DTFilm',
      thumbnail: publicUrlFront,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id, // From VARIANTS.md
      retail_price: PRICES[v.size],
      is_enabled: true,
      files: [
        { type: 'front_dtf', id: FRONT_FILE_ID },
        { type: 'back_dtf', id: BACK_FILE_ID },
        { type: 'label_inside_dtf', id: LABEL_FILE_ID },
      ],
    })),
  }),
});
```

**Key points:**
- `variant_id` is the catalog variant ID from VARIANTS.md (NOT a sync variant ID)
- `files[].type` uses DTFilm placement names with `_dtf` suffix
- Include ALL size variants for each color (XS through XXL = 6 variants per color)

### Step 3: Set Variant Prices

Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

### Step 4: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p>
<p><strong>Material:</strong> 80% organic cotton, 20% recycled polyester (SOL'S 03574)</p>
<p><strong>Print technique:</strong> DTFilm (DTFlex) — PET film heat transfer</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> OEKO-TEX Standard 100, REACH</p>
```

### Step 5: Create Product in Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description only.',
  category_id: 'SWEATSHIRT_CATEGORY_UUID',
  base_price_cents: 5995,
  compare_at_price_cents: 9995,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '506',
  translations: {
    es: { title: '...', description: '...' },
    de: { title: '...', description: '...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'SOL\'S 03574 Comet',
    material: '80% organic cotton, 20% recycled polyester',
    print_technique: 'DTFilm (DTFlex)',
    manufacturing_country: 'LV',
    safety_information: GPSR_HTML,
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.',
  },
});
```

### Step 6: Create Product Variants in Supabase

```javascript
for (const { color, hex, variantIds } of COLORS) {
  for (const [i, size] of SIZES.entries()) {
    await supabase.from('product_variants').insert({
      product_id: PRODUCT_UUID,
      title: `ProductName / ${color} / ${size}`,
      color,
      color_hex: hex,
      size,
      price_cents: PRICES_CENTS[size],
      is_enabled: true,
      is_available: true,
      external_variant_id: String(variantIds[i]),
    });
  }
}
```

### Step 7: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/506" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "variant_ids": [VARIANT_ID],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Back"],
    "files": [
      { "placement": "front_dtf", "image_url": "DESIGN_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } },
      { "placement": "back_dtf", "image_url": "BACK_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } }
    ]
  }'
```

### Step 8: Upload Mockups to Supabase Storage

Mockup URLs expire ~24h. Always download and re-upload with cache-buster `?v=timestamp`.

---

## Branding Strategy — DTFilm

- **`label_inside_dtf`**: SKAPARA S mark (255x255) — cheapest placement at only +0.95 EUR
- **`back_dtf`**: SKAPARA wordmark white on dark garments (1800x2400)
- **Alternative**: Use `front_dtf` for main design, skip back for cost savings
- **Color Notes:**
  - Grey Melange: medium tone — both light and dark designs work
  - Red: dark-medium color — white/light designs preferred
  - Royal Blue: dark color — white/light designs only
  - White: light color — use dark/black designs ONLY

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| DTFilm smooth texture | Vinyl-like feel, different from DTG soft ink | Expected — this is the DTFilm characteristic |
| Mutually exclusive placements | `front_dtf` vs `front_large_dtf`, `back_dtf` vs `back_large_dtf` | Choose one per side |
| Cron sync margin fixer | Overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Temporary mockup URLs | S3 URLs expire ~24h | Download + re-upload to Supabase Storage |
| Cloudflare 401 | Missing User-Agent | Always include `User-Agent: POD-AI-Store/1.0` |
| Python urllib blocked | Cloudflare rejects Python urllib | Use curl or Node.js fetch |
| Cache-busting | Browser/CDN cache by URL | Append `?v=timestamp` when overwriting |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (sweatshirts)
- [ ] All 8 colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (XS, S, M, L, XL, XXL)
- [ ] Price correct per size tier (not overridden by margin fixer)
- [ ] Mockup images load for all placements
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] Translations present (EN, ES, DE)
- [ ] Alt text follows pattern: "Title - Color", "Title - Color - Back"
- [ ] Images ordered: all fronts first, then backs
- [ ] Cache-buster `?v=timestamp` appended to all image URLs

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
