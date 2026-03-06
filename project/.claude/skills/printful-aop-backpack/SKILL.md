---
name: Printful AOP Minimalist Backpack Production
description: >-
  Complete pipeline for AOP Minimalist Backpack (catalog 279) on Printful.
  CUT-SEW all-over sublimation on 100% polyester. 4 independent print panels
  (front, top, bottom, pocket). Use when creating AOP backpack products,
  designing all-over-print backpacks, generating backpack mockups, or managing
  AOP minimalist backpack accessories. Covers multi-panel design, variant
  management, mockup generation, and Supabase integration. EU fulfillment
  CONFIRMED.
---

# Printful AOP Minimalist Backpack Production Pipeline

Full production pipeline for SKAPARA AOP Minimalist Backpacks on Printful. This is a CUT-SEW product — the design is sublimated onto white polyester fabric before the backpack is assembled. Four independently printable panels allow for cohesive yet varied designs across the bag's surfaces.

For DTG-based apparel products, see the `printful-cc1717` or `printful-tshirt` skills instead.
For simpler AOP bags, see the `printful-aop-drawstring` skill.
For larger AOP bags, see the `printful-aop-duffle` or `printful-aop-utility-backpack` skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Product** | AOP Minimalist Backpack |
| **Catalog ID** | 279 |
| **Technique** | CUT-SEW (AOP sublimation) |
| **Material** | 100% polyester |
| **Weight** | 9 oz/yd2 (305 g/m2) |
| **Dimensions** | H 16 1/8" x W 12 1/4" x D 3 7/8" |
| **Max Weight Capacity** | 44 lbs (20 kg) |
| **Colors** | White only (sublimation base) |
| **Sizes** | One size |
| **Panels** | 4 (front, top, bottom, pocket) |
| **Producer** | Printful |
| **EU Fulfillment** | YES (confirmed) |
| **Base Price** | 32.70 EUR |

---

## When to Use

- Create a new AOP minimalist backpack product on Printful
- Design all-over-print patterns for a multi-panel backpack (4 panels)
- Generate mockups for AOP backpack products
- Update Supabase with AOP backpack product data
- Create mid-range AOP accessories with confirmed EU fulfillment

---

## AOP / CUT-SEW Technical Notes

**How CUT-SEW sublimation works:**
1. Your design is printed onto transfer paper using sublimation ink
2. The ink is heat-pressed onto flat white polyester fabric panels
3. The panels are then cut and sewn into the final backpack shape
4. Result: seamless, edge-to-edge print coverage on each panel

**Design requirements:**
- **DPI**: 150 (standard AOP resolution)
- **Fill mode**: `cover` — design fills the entire panel area
- **Format**: PNG, no transparency needed
- **Color mode**: sRGB (sublimation inks reproduce sRGB accurately)
- **Base fabric**: White only (sublimation requires white/light base)
- **Each panel is a SEPARATE design file** at exact canvas dimensions

**Color considerations:**
- Sublimation produces vibrant, saturated colors on polyester
- Very dark designs (near-black) may show slight variation at seams
- Neon/fluorescent colors will NOT reproduce accurately — use standard sRGB gamut
- White areas = no ink = shows the white base fabric

---

## Multi-Panel Design — 4 PANELS

This backpack has **4 placements** — each is a separate panel of the backpack that receives its own design file.

### Panel Layout & Design Strategy

| Panel | Canvas (px) | Physical Size | Design Approach |
|---|---|---|---|
| `front` | 2175 x 3075 | 14.5" x 20.5" | Main visible surface — hero design |
| `top` | 1950 x 1200 | 13.0" x 8.0" | Top flap — subtle branding or pattern continuation |
| `bottom` | 4200 x 1200 | 28.0" x 8.0" | Base panel (wide!) — pattern continuation or contrast |
| `pocket` | 4200 x 750 | 28.0" x 5.0" | Front pocket (wide, narrow) — accent or brand element |

**IMPORTANT DIMENSIONS:**
- `front` is tall/portrait — standard backpack front panel
- `top` is landscape — handle/zipper flap area
- `bottom` is VERY wide (28") — wraps around the bag base
- `pocket` is VERY wide (28") and narrow (5") — front pocket exterior

### Design Coherence

**GOLDEN RULE:** All 4 panels should feel like ONE cohesive design. Strategies:
- **Continuous pattern**: Same seamless repeat across all panels
- **Gradient flow**: Colors transition from top to front to bottom
- **Themed zones**: Front = hero graphic, top/bottom/pocket = supporting pattern
- **Brand integration**: SKAPARA elements woven into the all-over pattern

**BRANDING:** Since there are no label placements, incorporate SKAPARA branding directly into the panel designs. The `pocket` panel (wide, narrow, prominent) is ideal for a subtle wordmark integration.

---

## Placements & Canvas Sizes

All canvases at 150 DPI:

| Placement | Printfile | Canvas (px) | Physical | Fill | Cost |
|---|---|---|---|---|---|
| `front` | PF#126 | 2175 x 3075 | 14.5" x 20.5" | cover | included |
| `top` | PF#127 | 1950 x 1200 | 13.0" x 8.0" | cover | included |
| `bottom` | PF#128 | 4200 x 1200 | 28.0" x 8.0" | cover | included |
| `pocket` | PF#129 | 4200 x 750 | 28.0" x 5.0" | cover | included |

**IMPORTANT:** All 4 placements are included in the base price (32.70 EUR). No additional placement charges.

**Total design files needed: 4**

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

## Workflow: Create New AOP Backpack Product

### Step 1: Design All Panels

Create 4 PNG files at exact canvas dimensions:

| File | Canvas (px) | Purpose |
|---|---|---|
| `backpack-front.png` | 2175 x 3075 | Main front panel design |
| `backpack-top.png` | 1950 x 1200 | Top flap design |
| `backpack-bottom.png` | 4200 x 1200 | Bottom base panel design |
| `backpack-pocket.png` | 4200 x 750 | Front pocket design |

### Step 2: Upload Designs to File Library

Upload each to Supabase Storage first, then POST to Printful File Library:

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
4. Pocket → `POCKET_FILE_ID`

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — AOP Backpack"
    },
    "sync_variants": [
      {
        "variant_id": 9063,
        "retail_price": "54.99",
        "files": [
          { "type": "front", "id": FRONT_FILE_ID },
          { "type": "top", "id": TOP_FILE_ID },
          { "type": "bottom", "id": BOTTOM_FILE_ID },
          { "type": "pocket", "id": POCKET_FILE_ID }
        ]
      }
    ]
  }'
```

**Key points:**
- `variant_id`: 9063 (single variant — one size, one color)
- `files[].type` maps to placement names: `"front"`, `"top"`, `"bottom"`, `"pocket"`
- Only 1 variant needed

### Step 4: Set Pricing

| Size | Base Cost (EUR) | Retail Price (EUR) | Margin |
|---|---|---|---|
| One size | 32.70 | 54.99 | 40.5% |

**Minimum retail (35% margin):** 50.31 EUR

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

### Step 5: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/279" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [9063],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "front",
        "image_url": "FRONT_PREVIEW_URL",
        "position": {
          "area_width": 2175, "area_height": 3075,
          "width": 2175, "height": 3075,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "top",
        "image_url": "TOP_PREVIEW_URL",
        "position": {
          "area_width": 1950, "area_height": 1200,
          "width": 1950, "height": 1200,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "bottom",
        "image_url": "BOTTOM_PREVIEW_URL",
        "position": {
          "area_width": 4200, "area_height": 1200,
          "width": 4200, "height": 1200,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "pocket",
        "image_url": "POCKET_PREVIEW_URL",
        "position": {
          "area_width": 4200, "area_height": 750,
          "width": 4200, "height": 750,
          "top": 0, "left": 0
        }
      }
    ]
  }'
```

### Step 6: Download Mockups & Upload to Supabase Storage

```javascript
const storagePath = `designs/mockups/${productSlug}/${placement}.png`
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
  product_template_id: '279',
  provider_product_id: String(pfProductId),
  base_price_cents: 5499,
  compare_at_price_cents: 7999,
  images: [
    { src: `https://.../mockups/slug/front.png?v=${ts}`, alt: 'Title - Front' },
    { src: `https://.../mockups/slug/top.png?v=${ts}`, alt: 'Title - Top' },
    { src: `https://.../mockups/slug/pocket.png?v=${ts}`, alt: 'Title - Pocket Detail' }
  ],
  product_details: {
    safety_information: GPSR_HTML,
    material: '100% Polyester (305 g/m2)',
    care_instructions: 'Spot clean or wipe with damp cloth. Do not machine wash. Do not bleach. Air dry.',
    print_technique: 'CUT-SEW (All-Over Sublimation)',
    manufacturing_country: 'EU',
    brand: 'SKAPARA',
    blank: 'AOP Minimalist Backpack',
    weight: '9 oz/yd2 (305 g/m2)',
    dimensions: 'H 16 1/8" x W 12 1/4" x D 3 7/8"',
    max_weight: '44 lbs (20 kg)'
  },
  status: 'active'
})

// Single variant
await supabase.from('product_variants').upsert({
  product_id: productId,
  color: 'White',
  color_hex: '#ffffff',
  size: 'One size',
  is_enabled: true,
  external_variant_id: '9063',
  image_url: `https://.../mockups/slug/front.png?v=${ts}`
})
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., EU</p>
<p><strong>Material:</strong> 100% Polyester (9 oz/yd2 / 305 g/m2)</p>
<p><strong>Dimensions:</strong> H 16 1/8" x W 12 1/4" x D 3 7/8"</p>
<p><strong>Max weight capacity:</strong> 44 lbs (20 kg)</p>
<p><strong>Print technique:</strong> All-over sublimation — dye-sublimation inks</p>
<p><strong>Care:</strong> Spot clean or wipe with damp cloth. Do not machine wash. Do not bleach. Air dry.</p>
<p><strong>Compliance:</strong> REACH, EU Regulation 2023/988 (GPSR)</p>
```

Store in `products.product_details.safety_information` (JSONB).

---

## Pricing Strategy

| Metric | Value |
|---|---|
| Base cost | 32.70 EUR |
| Recommended retail | 54.99 EUR |
| Margin | 40.5% |
| Minimum retail (35% margin) | 50.31 EUR |

All 4 placements included — no additional costs.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Seam alignment | AOP patterns may show misalignment at seams between panels | Use designs that tolerate seam breaks — avoid designs requiring precise cross-panel alignment |
| Bottom panel width | Bottom panel is 28" wide (4200px) — wraps around base | Design should work as a wrap or seamless repeat |
| Pocket panel ratio | Pocket is very wide (28") but narrow (5") — 5.6:1 aspect ratio | Use horizontal patterns or repeats — avoid tall/portrait elements |
| White base shows at edges | Dark designs may show white at seam allowances | Extend dark areas with bleed |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Single variant | Only one size/color — no variant toggles in ProductCard | ProductCard will show a single option |
| No label placement | No dedicated label area on this product | Incorporate SKAPARA branding into panel designs |
| Cache-busting | Browser/CDN cache images by URL | ALWAYS append `?v=timestamp` when overwriting Supabase Storage files |

---

## Description Rules

**What goes in `description`** (creative text only):
- Product context, lifestyle use cases (commute, school, travel, daily carry)
- 2-3 sentences max, casual but smart tone
- Highlight minimalist design, AOP coverage, durability
- Must be translated to EN, ES, DE

**What does NOT go in `description`:**
- Material composition -> `product_details.material`
- Dimensions/capacity -> `product_details.dimensions` / `product_details.max_weight`
- Care instructions -> `product_details.care_instructions`
- Manufacturing info -> `product_details.manufacturing_country`
- Safety/compliance -> `product_details.safety_information`

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (bags / backpacks)
- [ ] Single variant shows correctly (One size, White)
- [ ] All panel mockup images load correctly (front, top, pocket)
- [ ] Price is correct (not overridden by margin fixer)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] SKAPARA branding integrated into panel designs
- [ ] Alt text follows pattern: "Title - Front", "Title - Top", "Title - Pocket Detail"
- [ ] All 4 design files uploaded to both Supabase Storage and Printful File Library
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
