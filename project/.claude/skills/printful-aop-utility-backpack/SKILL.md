---
name: Printful AOP Utility Backpack Production
description: >-
  Complete pipeline for AOP Utility Backpack (catalog 963) on Printful.
  CUT-SEW all-over sublimation on 100% polyester at 216 DPI (NOT standard
  150 DPI!). 4 placements (front, top, bottom, label_inside). Available in
  Black AND White — the ONLY AOP product with 2 color options. Use when
  creating AOP utility backpack products, designing all-over-print utility
  backpacks, generating backpack mockups, or managing high-DPI AOP
  accessories. Covers multi-panel design, variant management, mockup
  generation, and Supabase integration.
---

# Printful AOP Utility Backpack Production Pipeline

Full production pipeline for SKAPARA AOP Utility Backpacks on Printful. This is a CUT-SEW product — the design is sublimated onto polyester fabric before the backpack is assembled. **This product has TWO CRITICAL differences from other AOP products:**

1. **DPI is 216 (NOT 150!)** — higher resolution required for all panel design files
2. **Available in Black AND White** — the ONLY AOP product with 2 color options

For the standard AOP backpack at 150 DPI, see the `printful-aop-backpack` skill.
For DTG-based apparel products, see the `printful-cc1717` or `printful-tshirt` skills instead.

---

## Product Specifications

| Property | Value |
|---|---|
| **Product** | AOP Utility Backpack |
| **Catalog ID** | 963 |
| **Technique** | CUT-SEW (AOP sublimation) |
| **Material** | 100% polyester |
| **Weight** | 9.73 oz/yd2 (330 g/m2) |
| **Capacity** | 4.3 gallons (16.1 L) |
| **Max Weight** | 11 lbs (5 kg) |
| **Colors** | Black, White (2 options!) |
| **Sizes** | One size |
| **Panels** | 3 print panels + 1 inside label |
| **DPI** | **216** (NOT 150 — CRITICAL) |
| **Producer** | Printful |
| **EU Fulfillment** | NEEDS VERIFICATION |
| **Base Price** | 38.50 EUR |

---

## When to Use

- Create a new AOP utility backpack product on Printful
- Design all-over-print patterns for a utility backpack at 216 DPI
- Generate mockups for AOP utility backpack products (Black or White base)
- Update Supabase with AOP utility backpack product data
- Create AOP accessories with color variant options (Black/White)

---

## AOP / CUT-SEW Technical Notes

**How CUT-SEW sublimation works:**
1. Your design is printed onto transfer paper using sublimation ink
2. The ink is heat-pressed onto flat polyester fabric panels
3. The panels are then cut and sewn into the final backpack shape
4. Result: seamless, edge-to-edge print coverage on each panel

### CRITICAL: DPI IS 216 (NOT 150!)

This product requires **216 DPI** for all print panels (front, top, bottom). This is HIGHER than the standard 150 DPI used by all other AOP products. The label_inside placement still uses 150 DPI.

**Design requirements:**
- **DPI**: **216** for panels, 150 for label_inside
- **Fill mode**: `cover` for panels; `fit` for label_inside
- **Format**: PNG, no transparency needed
- **Color mode**: sRGB (sublimation inks reproduce sRGB accurately)
- **Base fabric**: Black OR White (2 options)
- **Each panel is a SEPARATE design file** at exact canvas dimensions

### Two Color Options — Design Implications

| Base Color | Design Notes |
|---|---|
| **White** (#ffffff) | Standard sublimation base. Full color gamut. White areas = white fabric |
| **Black** (#000000) | Sublimation on dark fabric — LIGHT/WHITE areas of design will NOT print. Dark base shows through transparent/light areas. Best for designs with bold, saturated colors |

**IMPORTANT for Black base:** Sublimation ink is translucent — it cannot print white or very light colors on a dark base. Design accordingly:
- Use saturated, bold colors
- Avoid pastels, whites, and light tones
- Dark background areas of the design will blend with the black fabric
- Consider designing specifically for black vs white variants

---

## Multi-Panel Design — 3 Panels + 1 Label

### Panel Layout & Design Strategy

| Panel | Canvas (px) | DPI | Physical | Design Approach |
|---|---|---|---|---|
| `front` | 2754 x 4340 | **216** | 12.75" x 20.09" | Main visible surface — hero design |
| `top` | 2929 x 1633 | **216** | 13.56" x 7.56" | Top flap/handle area — continuation or accent |
| `bottom` | 5998 x 1508 | **216** | 27.77" x 6.98" | Base panel (VERY wide!) — wrap pattern |
| `label_inside` | 1050 x 600 | 150 | 7.0" x 4.0" | Inside label — SKAPARA mark |

**IMPORTANT DIMENSIONS:**
- `front` is tall/portrait (2754x4340) — standard backpack front
- `top` is landscape (2929x1633) — handle/zipper flap
- `bottom` is EXTREMELY wide (5998px = ~28") — wraps around the bag base
- `label_inside` is relatively large (1050x600 at 150 DPI) — use for detailed SKAPARA branding

### Design Coherence

**GOLDEN RULE:** All 3 panels should feel like ONE cohesive design despite the DPI difference from other AOP products.

**BRANDING:**
- `label_inside` (1050x600 at 150 DPI, fill: fit): SKAPARA mark with details — this is a larger label than other AOP products
- Integrate SKAPARA elements into panel designs for exterior branding

---

## Placements & Canvas Sizes

**CRITICAL: DPI varies between panels!**

| Placement | Printfile | Canvas (px) | DPI | Physical | Fill | Cost |
|---|---|---|---|---|---|---|
| `front` | PF#1342 | 2754 x 4340 | **216** | 12.75" x 20.09" | cover | included |
| `top` | PF#1343 | 2929 x 1633 | **216** | 13.56" x 7.56" | cover | included |
| `bottom` | PF#1344 | 5998 x 1508 | **216** | 27.77" x 6.98" | cover | included |
| `label_inside` | PF#356 | 1050 x 600 | 150 | 7.0" x 4.0" | fit | included |

**IMPORTANT:** All 4 placements are included in the base price (38.50 EUR). No additional charges.

**Total design files needed: 4** (same files for both Black and White variants, unless designing color-specific versions)

---

## Printful API Reference

**Auth headers (ALL requests):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
```

**Store ID:** `17795695` (Skapara)

**Rate limits:**
- General API: ~120 req/min. Use `delay(2000)` between calls
- Mockup Generator: ~10 req/min. Use `delay(10000)` between tasks
- On 429: read `x-ratelimit-reset` header, wait that many seconds, retry

---

## Workflow: Create New AOP Utility Backpack Product

### Step 1: Design All Panels

Create 4 PNG files at exact canvas dimensions and DPI:

| File | Canvas (px) | DPI | Purpose |
|---|---|---|---|
| `utility-front.png` | 2754 x 4340 | **216** | Main front panel design |
| `utility-top.png` | 2929 x 1633 | **216** | Top flap design |
| `utility-bottom.png` | 5998 x 1508 | **216** | Bottom base panel design |
| `utility-label.png` | 1050 x 600 | 150 | Inside label — SKAPARA mark |

**DPI VERIFICATION CHECKLIST:**
- [ ] Front: Created at 216 DPI (NOT 150)
- [ ] Top: Created at 216 DPI (NOT 150)
- [ ] Bottom: Created at 216 DPI (NOT 150)
- [ ] Label: Created at 150 DPI (standard)

### Step 2: Upload Designs to File Library

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
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'${PUBLIC_URL}'",
    "filename": "'${FILENAME}'"
  }'
```

Repeat for all 4 files:
1. Front → `FRONT_FILE_ID`
2. Top → `TOP_FILE_ID`
3. Bottom → `BOTTOM_FILE_ID`
4. Label → `LABEL_FILE_ID`

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — AOP Utility Backpack"
    },
    "sync_variants": [
      {
        "variant_id": 24563,
        "retail_price": "64.99",
        "files": [
          { "type": "front", "id": FRONT_FILE_ID },
          { "type": "top", "id": TOP_FILE_ID },
          { "type": "bottom", "id": BOTTOM_FILE_ID },
          { "type": "label_inside", "id": LABEL_FILE_ID }
        ]
      },
      {
        "variant_id": 24564,
        "retail_price": "64.99",
        "files": [
          { "type": "front", "id": FRONT_FILE_ID },
          { "type": "top", "id": TOP_FILE_ID },
          { "type": "bottom", "id": BOTTOM_FILE_ID },
          { "type": "label_inside", "id": LABEL_FILE_ID }
        ]
      }
    ]
  }'
```

**Key points:**
- `variant_id` 24563 = Black, 24564 = White
- Same design files for both variants (unless creating color-specific versions)
- 2 variants to create (Black + White)
- All 4 placements per variant

**NOTE:** If creating color-specific designs (optimized for Black vs White base), upload separate files and use different File IDs for each variant.

### Step 4: Set Pricing

| Color | Base Cost (EUR) | Retail Price (EUR) | Margin |
|---|---|---|---|
| Black | 38.50 | 64.99 | 40.8% |
| White | 38.50 | 64.99 | 40.8% |

**Minimum retail (35% margin):** 59.23 EUR

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

### Step 5: Generate Mockups

Generate mockups for BOTH color variants:

```bash
# Black variant mockup
curl -X POST "https://api.printful.com/mockup-generator/create-task/963" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [24563],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "front",
        "image_url": "FRONT_PREVIEW_URL",
        "position": {
          "area_width": 2754, "area_height": 4340,
          "width": 2754, "height": 4340,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "top",
        "image_url": "TOP_PREVIEW_URL",
        "position": {
          "area_width": 2929, "area_height": 1633,
          "width": 2929, "height": 1633,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "bottom",
        "image_url": "BOTTOM_PREVIEW_URL",
        "position": {
          "area_width": 5998, "area_height": 1508,
          "width": 5998, "height": 1508,
          "top": 0, "left": 0
        }
      }
    ]
  }'

# White variant mockup (same structure, variant_id 24564)
# Use delay(10000) between mockup generation tasks
```

### Step 6: Download Mockups & Upload to Supabase Storage

```javascript
const storagePath = `designs/mockups/${productSlug}/${colorSlug}-${placement}.png`
const ts = Math.floor(Date.now() / 1000)
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`
```

### Step 7: Update Supabase products Table

```javascript
const ts = Math.floor(Date.now() / 1000)

await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative marketing description only. No specs here.',
  translations: {
    es: { title: 'Titulo en espanol', description: 'Descripcion en espanol' },
    de: { title: 'Titel auf Deutsch', description: 'Beschreibung auf Deutsch' }
  },
  category_id: 'CATEGORY_UUID', // FK to categories table (bags / backpacks)
  pod_provider: 'printful',
  product_template_id: '963',
  provider_product_id: String(pfProductId),
  base_price_cents: 6499,
  compare_at_price_cents: 9999,
  images: [
    { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Title - Black' },
    { src: `https://.../mockups/slug/white-front.png?v=${ts}`, alt: 'Title - White' },
    { src: `https://.../mockups/slug/black-top.png?v=${ts}`, alt: 'Title - Black - Top' }
  ],
  product_details: {
    safety_information: GPSR_HTML,
    material: '100% Polyester (330 g/m2)',
    care_instructions: 'Spot clean or wipe with damp cloth. Do not machine wash. Do not bleach. Air dry.',
    print_technique: 'CUT-SEW (All-Over Sublimation at 216 DPI)',
    manufacturing_country: 'NEEDS VERIFICATION',
    brand: 'SKAPARA',
    blank: 'AOP Utility Backpack',
    weight: '9.73 oz/yd2 (330 g/m2)',
    capacity: '4.3 gallons (16.1 L)',
    max_weight: '11 lbs (5 kg)'
  },
  status: 'active'
})

// Create product variants (2 colors)
const colors = [
  { color: 'Black', hex: '#000000', variantId: 24563 },
  { color: 'White', hex: '#ffffff', variantId: 24564 }
]

for (const { color, hex, variantId } of colors) {
  const colorSlug = color.toLowerCase()
  await supabase.from('product_variants').upsert({
    product_id: productId,
    color,
    color_hex: hex,
    size: 'One size',
    is_enabled: true,
    external_variant_id: String(variantId),
    image_url: `https://.../mockups/slug/${colorSlug}-front.png?v=${ts}`
  })
}
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc.</p>
<p><strong>Material:</strong> 100% Polyester (9.73 oz/yd2 / 330 g/m2)</p>
<p><strong>Capacity:</strong> 4.3 gallons (16.1 L)</p>
<p><strong>Max weight:</strong> 11 lbs (5 kg)</p>
<p><strong>Print technique:</strong> All-over sublimation at 216 DPI — dye-sublimation inks</p>
<p><strong>Care:</strong> Spot clean or wipe with damp cloth. Do not machine wash. Do not bleach. Air dry.</p>
<p><strong>Compliance:</strong> REACH, EU Regulation 2023/988 (GPSR)</p>
```

Store in `products.product_details.safety_information` (JSONB).

**NOTE:** EU fulfillment status NEEDS VERIFICATION. Check Printful dashboard.

---

## Pricing Strategy

| Metric | Value |
|---|---|
| Base cost (both colors) | 38.50 EUR |
| Recommended retail | 64.99 EUR |
| Margin | 40.8% |
| Minimum retail (35% margin) | 59.23 EUR |

All 4 placements included — no additional costs.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| **DPI is 216 NOT 150** | Most critical difference from other AOP products — designs at 150 DPI will appear blurry/upscaled | ALWAYS create panel designs at 216 DPI. Triple-check before upload |
| Black base limitations | Sublimation ink is translucent — white/pastel colors will NOT print on black | Design with saturated colors for black variant. Consider separate designs per color |
| Bottom panel width | Bottom panel is ~28" wide (5998px at 216 DPI) | Use repeating patterns or designs that wrap gracefully |
| No pocket placement | Unlike the Minimalist Backpack (CAT 279), this product has no pocket panel | Front panel is the primary design surface |
| Label is larger | label_inside at 1050x600 @150 DPI (vs 375x150 on duffle, 450x300 on bucket) | Use for detailed SKAPARA branding — more space available |
| EU fulfillment uncertain | Needs dashboard verification | Verify before listing as EU-fulfilled |
| Seam alignment | AOP patterns may show misalignment at panel seams | Use tolerant patterns |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| 2 color mockups | Need to generate mockups for BOTH Black and White | Use delay(10000) between mockup tasks |
| Cache-busting | Browser/CDN cache images by URL | ALWAYS append `?v=timestamp` |

---

## DPI Comparison — Utility Backpack vs Other AOP Products

| Product | Catalog | Panel DPI | Label DPI | Pixel Density |
|---|---|---|---|---|
| AOP Bucket Hat | 654 | 150 | 150 | Standard |
| AOP Drawstring Bag | 262 | 150 | N/A | Standard |
| AOP Minimalist Backpack | 279 | 150 | N/A | Standard |
| AOP Duffle Bag | 465 | 150 | 150 | Standard |
| **AOP Utility Backpack** | **963** | **216** | 150 | **HIGH** |

**Why 216 DPI?** The Utility Backpack is a newer product with higher resolution printing capability. The physical print area is slightly smaller than other products, so Printful uses higher DPI for sharper detail. Designs created at 150 DPI will be upscaled and may appear soft/blurry.

---

## Description Rules

**What goes in `description`** (creative text only):
- Product context, lifestyle use cases (daily carry, urban, commute, light travel)
- 2-3 sentences max, casual but smart tone
- Highlight utility features, 16L capacity, AOP design, Black/White options
- Must be translated to EN, ES, DE

**What does NOT go in `description`:**
- Material composition -> `product_details.material`
- Capacity/dimensions -> `product_details.capacity` / `product_details.max_weight`
- Care instructions -> `product_details.care_instructions`
- Manufacturing info -> `product_details.manufacturing_country`
- Safety/compliance -> `product_details.safety_information`

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (bags / backpacks)
- [ ] BOTH color variants show (Black, White) with color toggles in ProductCard
- [ ] Mockup images load for both colors
- [ ] Price is correct (not overridden by margin fixer)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] Label inside shows SKAPARA branding
- [ ] SKAPARA branding integrated into panel designs
- [ ] EU fulfillment status verified in Printful dashboard
- [ ] **DPI VERIFIED: All panel designs at 216 DPI (NOT 150)**
- [ ] Alt text: "Title - Black", "Title - White", "Title - Black - Top"
- [ ] All design files uploaded to both Supabase Storage and Printful File Library
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
- [ ] Black variant designs tested for sublimation on dark base (no white/pastel areas)
