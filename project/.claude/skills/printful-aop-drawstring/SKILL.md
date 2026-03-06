---
name: Printful AOP Drawstring Bag Production
description: >-
  Complete pipeline for AOP Drawstring Bag (catalog 262) on Printful.
  CUT-SEW all-over sublimation on 100% polyester. Single-panel design
  covering the entire bag surface. Use when creating AOP drawstring bag
  products, designing gym bags, cinch bags, sport bags, or managing
  all-over-print drawstring accessories. Covers design, variant management,
  mockup generation, and Supabase integration.
---

# Printful AOP Drawstring Bag Production Pipeline

Full production pipeline for SKAPARA AOP Drawstring Bags on Printful. This is a CUT-SEW product — the design is sublimated onto white polyester fabric before the bag is assembled. Single-panel design with one placement covering the entire bag surface.

For DTG-based apparel products, see the `printful-cc1717` or `printful-tshirt` skills instead.
For multi-panel AOP bags, see the `printful-aop-backpack` or `printful-aop-duffle` skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Product** | AOP Drawstring Bag |
| **Catalog ID** | 262 |
| **Technique** | CUT-SEW (AOP sublimation) |
| **Material** | 100% polyester |
| **Dimensions** | 15" x 17" (38.1 x 43.2 cm) |
| **Max Weight Capacity** | 33 lbs (15 kg) |
| **Colors** | White only (sublimation base) |
| **Sizes** | 15" x 17" (single size) |
| **Closure** | Drawstring cord |
| **Producer** | Printful |
| **EU Fulfillment** | NEEDS VERIFICATION (blank sourced from Israel) |
| **Base Price** | 15.72 EUR |

---

## When to Use

- Create a new AOP drawstring bag product on Printful
- Design all-over-print patterns for a drawstring/gym/cinch bag
- Generate mockups for AOP drawstring bag products
- Update Supabase with AOP drawstring bag product data
- Create affordable AOP accessories for the SKAPARA catalog

---

## AOP / CUT-SEW Technical Notes

**How CUT-SEW sublimation works:**
1. Your design is printed onto transfer paper using sublimation ink
2. The ink is heat-pressed onto flat white polyester fabric
3. The fabric is then cut and sewn into the final bag shape
4. Result: seamless, edge-to-edge print coverage

**Design requirements:**
- **DPI**: 150 (standard AOP resolution)
- **Fill mode**: `cover` — design fills the entire panel area
- **Format**: PNG, no transparency needed
- **Color mode**: sRGB (sublimation inks reproduce sRGB accurately)
- **Base fabric**: White only (sublimation requires white/light base)
- **Single design file** covers the entire bag surface

**Color considerations:**
- Sublimation produces vibrant, saturated colors on polyester
- Very dark designs (near-black) may show slight variation at seams
- Neon/fluorescent colors will NOT reproduce accurately — use standard sRGB gamut
- White areas = no ink = shows the white base fabric

---

## Single-Panel Design

This is the simplest AOP product — a single design covers the entire bag. The design wraps around both sides of the flat bag shape.

### Design Strategy

| Consideration | Recommendation |
|---|---|
| Pattern type | Seamless repeat patterns work best (the bag is flat, design wraps) |
| Branding | Incorporate SKAPARA elements into the pattern itself |
| Orientation | Consider that the bag hangs vertically when worn — design accordingly |
| Center focus | Place key design elements in the center-upper area (most visible when worn) |

**BRANDING:** Since there is only one placement, SKAPARA branding must be integrated INTO the all-over pattern. Consider adding a subtle SKAPARA S mark or wordmark as a pattern element within the design.

---

## Placement & Canvas Size

Single placement at 150 DPI:

| Placement | Printfile | Canvas (px) | Physical | Fill | Cost |
|---|---|---|---|---|---|
| `default` | PF#117 | 2400 x 2850 | 16.0" x 19.0" | cover | included |

**IMPORTANT:** Single placement included in base price (15.72 EUR). No additional charges.

**Total design files needed: 1**

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

## Workflow: Create New AOP Drawstring Bag Product

### Step 1: Design the Panel

Create 1 PNG file at exact canvas dimensions:

| File | Canvas (px) | Purpose |
|---|---|---|
| `drawstring-design.png` | 2400 x 2850 | Full bag surface AOP design |

### Step 2: Upload Design to File Library

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

Save the `id` → `DESIGN_FILE_ID`

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — AOP Drawstring Bag"
    },
    "sync_variants": [
      {
        "variant_id": 8894,
        "retail_price": "29.99",
        "files": [
          { "type": "default", "id": DESIGN_FILE_ID }
        ]
      }
    ]
  }'
```

**Key points:**
- `variant_id`: 8894 (single variant — one size, one color)
- `files[].type`: `"default"` for the single placement
- Only 1 variant needed

### Step 4: Set Pricing

| Size | Base Cost (EUR) | Retail Price (EUR) | Margin |
|---|---|---|---|
| 15" x 17" | 15.72 | 29.99 | 47.5% |

**Minimum retail (35% margin):** 24.19 EUR

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

### Step 5: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/262" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [8894],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "default",
        "image_url": "DESIGN_PREVIEW_URL",
        "position": {
          "area_width": 2400, "area_height": 2850,
          "width": 2400, "height": 2850,
          "top": 0, "left": 0
        }
      }
    ]
  }'
```

### Step 6: Download Mockups & Upload to Supabase Storage

```javascript
const storagePath = `designs/mockups/${productSlug}/front.png`
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
  category_id: 'CATEGORY_UUID', // FK to categories table (bags / drawstring-bags)
  pod_provider: 'printful',
  product_template_id: '262',
  provider_product_id: String(pfProductId),
  base_price_cents: 2999,
  compare_at_price_cents: 4499,
  images: [
    { src: `https://.../mockups/slug/front.png?v=${ts}`, alt: 'Title - Front' }
  ],
  product_details: {
    safety_information: GPSR_HTML,
    material: '100% Polyester',
    care_instructions: 'Machine wash cold, gentle cycle. Do not bleach. Line dry. Do not iron directly on print.',
    print_technique: 'CUT-SEW (All-Over Sublimation)',
    manufacturing_country: 'NEEDS VERIFICATION',
    brand: 'SKAPARA',
    blank: 'AOP Drawstring Bag',
    dimensions: '15" x 17" (38.1 x 43.2 cm)',
    max_weight: '33 lbs (15 kg)'
  },
  status: 'active'
})

// Single variant
await supabase.from('product_variants').upsert({
  product_id: productId,
  color: 'White',
  color_hex: '#ffffff',
  size: '15"x17"',
  is_enabled: true,
  external_variant_id: '8894',
  image_url: `https://.../mockups/slug/front.png?v=${ts}`
})
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc.</p>
<p><strong>Material:</strong> 100% Polyester</p>
<p><strong>Dimensions:</strong> 15" x 17" (38.1 x 43.2 cm)</p>
<p><strong>Max weight capacity:</strong> 33 lbs (15 kg)</p>
<p><strong>Print technique:</strong> All-over sublimation — dye-sublimation inks</p>
<p><strong>Care:</strong> Machine wash cold, gentle cycle. Do not bleach. Line dry. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, EU Regulation 2023/988 (GPSR)</p>
```

Store in `products.product_details.safety_information` (JSONB).

**NOTE:** EU fulfillment status NEEDS VERIFICATION — blank is sourced from Israel. Check Printful dashboard for fulfillment center confirmation before listing as EU-fulfilled.

---

## Pricing Strategy

| Metric | Value |
|---|---|
| Base cost | 15.72 EUR |
| Recommended retail | 29.99 EUR |
| Margin | 47.5% |
| Minimum retail (35% margin) | 24.19 EUR |

Single placement included — no additional costs. This is the most affordable AOP product in the catalog.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Seam alignment | Design may show slight misalignment where front/back panels are sewn | Use seamless repeat patterns or designs that tolerate seam breaks |
| Drawstring area | Top of design may be partially obscured by drawstring channel | Keep important design elements below the top 1-2 inches |
| EU fulfillment uncertain | Blank sourced from Israel — EU fulfillment needs dashboard verification | Verify before labeling as EU-fulfilled in product listing |
| White base shows | Dark edges may show white polyester at seam allowances | Extend dark areas with bleed beyond canvas edges |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Single variant | Only one size/color — no variant toggles in ProductCard | ProductCard will show a single option |
| Cache-busting | Browser/CDN cache images by URL | ALWAYS append `?v=timestamp` when overwriting Supabase Storage files |

---

## Description Rules

**What goes in `description`** (creative text only):
- Product context, lifestyle use cases (gym, travel, everyday carry)
- 2-3 sentences max, casual but smart tone
- Highlight lightweight, AOP design coverage, drawstring convenience
- Must be translated to EN, ES, DE

**What does NOT go in `description`:**
- Material composition -> `product_details.material`
- Dimensions/capacity -> `product_details.dimensions` / `product_details.max_weight`
- Care instructions -> `product_details.care_instructions`
- Manufacturing info -> `product_details.manufacturing_country`
- Safety/compliance -> `product_details.safety_information`

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (bags / drawstring-bags)
- [ ] Single variant shows correctly (15"x17", White)
- [ ] Mockup images load correctly
- [ ] Price is correct (not overridden by margin fixer)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] SKAPARA branding integrated into AOP design
- [ ] EU fulfillment status verified in Printful dashboard
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
