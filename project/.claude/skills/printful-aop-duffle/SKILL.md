---
name: Printful AOP Duffle Bag Production
description: >-
  Complete pipeline for AOP Duffle Bag (catalog 465) on Printful.
  CUT-SEW all-over sublimation on 100% polyester. 7 placements including
  front, back, sides, top, bottom, pocket, and inside label. Use when
  creating AOP duffle bag products, designing all-over-print travel bags,
  gym duffles, weekend bags, or managing premium AOP bag accessories.
  Covers multi-panel design, variant management, mockup generation, and
  Supabase integration. Most complex AOP product with 7 placements.
---

# Printful AOP Duffle Bag Production Pipeline

Full production pipeline for SKAPARA AOP Duffle Bags on Printful. This is a CUT-SEW product — the design is sublimated onto white polyester fabric before the duffle is assembled. With 7 placements, this is the most complex AOP product in the catalog. The premium price point (59.00 EUR base) positions it as a high-end statement piece.

For simpler AOP bags, see the `printful-aop-drawstring` or `printful-aop-backpack` skills.
For DTG-based apparel products, see the `printful-cc1717` or `printful-tshirt` skills instead.

---

## Product Specifications

| Property | Value |
|---|---|
| **Product** | AOP Duffle Bag |
| **Catalog ID** | 465 |
| **Technique** | CUT-SEW (AOP sublimation) |
| **Material** | 100% polyester |
| **Colors** | White only (sublimation base) |
| **Sizes** | One size |
| **Placements** | 7 (front, back, sides, top, bottom, pocket, label_inside) |
| **Producer** | Printful |
| **EU Fulfillment** | NEEDS VERIFICATION |
| **Base Price** | 59.00 EUR |

---

## When to Use

- Create a new AOP duffle bag product on Printful
- Design all-over-print patterns for a premium duffle/weekender bag (7 placements)
- Generate mockups for AOP duffle bag products
- Update Supabase with AOP duffle bag product data
- Create premium AOP accessories for the SKAPARA catalog

---

## AOP / CUT-SEW Technical Notes

**How CUT-SEW sublimation works:**
1. Your design is printed onto transfer paper using sublimation ink
2. The ink is heat-pressed onto flat white polyester fabric panels
3. The panels are then cut and sewn into the final duffle bag shape
4. Result: seamless, edge-to-edge print coverage on each panel

**Design requirements:**
- **DPI**: 150 (standard AOP resolution)
- **Fill mode**: `cover` for all main panels; `fit` for label_inside
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

## Multi-Panel Design — 7 PLACEMENTS

This duffle bag has the most placements of any AOP product. 6 external panels + 1 inside label.

### Panel Layout & Design Strategy

| Panel | Canvas (px) | Printfile | Fill | Design Approach |
|---|---|---|---|---|
| `front` | 4050 x 2700 | PF#239 | cover | Primary face — hero design |
| `back` | 4050 x 2700 | PF#239 | cover | Mirror or complement of front |
| `sides` | 4050 x 2700 | PF#239 | cover | Pattern continuation or accent |
| `top` | 4050 x 2700 | PF#239 | cover | Handle area — visible when carried |
| `bottom` | 4050 x 2700 | PF#239 | cover | Base panel — pattern continuation |
| `pocket` | 4050 x 2700 | PF#239 | cover | Front pocket — accent or brand element |
| `label_inside` | 375 x 150 | PF#64 | fit | SKAPARA mark or brand tag |

**IMPORTANT:** All 6 external panels share the same printfile spec (PF#239, 4050x2700@150dpi). This means you CAN use the same design for all exterior panels for a truly unified all-over look, OR create distinct designs for each panel.

### Design Strategies

**Strategy A — Unified Pattern:**
- Use the SAME seamless repeat pattern for all 6 exterior panels
- Result: the entire duffle looks like one continuous surface
- Simplest approach: 1 design file + 1 label = 2 total files
- Works best with: geometric patterns, abstract textures, repeat motifs

**Strategy B — Themed Zones:**
- Front/back: hero graphic or primary pattern
- Sides/top/bottom: complementary or tonal pattern
- Pocket: accent design or brand statement
- Result: varied but cohesive look

**Strategy C — Contrast Design:**
- Front: bold graphic
- Back: subtle version or tonal complement
- Sides/top/bottom: bridging pattern
- Result: different look from every angle

### BRANDING

- **Label placement** (`label_inside`): SKAPARA mark (S isotipo or wordmark) — 375x150px, fit mode
- **Panel designs**: Incorporate SKAPARA branding subtly into the all-over pattern
- **Pocket placement**: Ideal for a prominent SKAPARA integration within the design

---

## Placements & Canvas Sizes

All canvases at 150 DPI:

| Placement | Printfile | Canvas (px) | Physical | Fill | Cost |
|---|---|---|---|---|---|
| `front` | PF#239 | 4050 x 2700 | 27.0" x 18.0" | cover | included |
| `back` | PF#239 | 4050 x 2700 | 27.0" x 18.0" | cover | included |
| `sides` | PF#239 | 4050 x 2700 | 27.0" x 18.0" | cover | included |
| `top` | PF#239 | 4050 x 2700 | 27.0" x 18.0" | cover | included |
| `bottom` | PF#239 | 4050 x 2700 | 27.0" x 18.0" | cover | included |
| `pocket` | PF#239 | 4050 x 2700 | 27.0" x 18.0" | cover | included |
| `label_inside` | PF#64 | 375 x 150 | 2.5" x 1.0" | fit | included |

**IMPORTANT:** All 7 placements are included in the base price (59.00 EUR). No additional charges.

**Total design files needed: Up to 7** (minimum 2 if using same design for all exterior panels + 1 label)

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

## Workflow: Create New AOP Duffle Bag Product

### Step 1: Design All Panels

Create up to 7 PNG files at exact canvas dimensions:

| File | Canvas (px) | Purpose |
|---|---|---|
| `duffle-front.png` | 4050 x 2700 | Front panel design |
| `duffle-back.png` | 4050 x 2700 | Back panel design (or same as front) |
| `duffle-sides.png` | 4050 x 2700 | Side panels design (or same as front) |
| `duffle-top.png` | 4050 x 2700 | Top panel design (or same as front) |
| `duffle-bottom.png` | 4050 x 2700 | Bottom panel design (or same as front) |
| `duffle-pocket.png` | 4050 x 2700 | Pocket panel design (or same as front) |
| `duffle-label.png` | 375 x 150 | Inside label — SKAPARA mark |

**Minimum files:** 2 (1 shared exterior + 1 label) if using unified pattern approach.

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

Repeat for each unique design file. Save all File IDs.

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — AOP Duffle Bag"
    },
    "sync_variants": [
      {
        "variant_id": 12021,
        "retail_price": "99.99",
        "files": [
          { "type": "front", "id": FRONT_FILE_ID },
          { "type": "back", "id": BACK_FILE_ID },
          { "type": "sides", "id": SIDES_FILE_ID },
          { "type": "top", "id": TOP_FILE_ID },
          { "type": "bottom", "id": BOTTOM_FILE_ID },
          { "type": "pocket", "id": POCKET_FILE_ID },
          { "type": "label_inside", "id": LABEL_FILE_ID }
        ]
      }
    ]
  }'
```

**Key points:**
- `variant_id`: 12021 (single variant — one size, one color)
- If using unified pattern, all exterior `id` values can be the same File ID
- `label_inside` uses the small 375x150 design
- Only 1 variant needed

### Step 4: Set Pricing

| Size | Base Cost (EUR) | Retail Price (EUR) | Margin |
|---|---|---|---|
| One size | 59.00 | 99.99 | 41.0% |

**Minimum retail (35% margin):** 90.77 EUR

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

**Price positioning:** At 99.99 EUR retail, this is a premium statement piece. The high base cost (59.00 EUR) is the most expensive AOP product. Price it confidently — customers buying AOP duffle bags expect premium pricing.

### Step 5: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/465" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [12021],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "front",
        "image_url": "FRONT_PREVIEW_URL",
        "position": {
          "area_width": 4050, "area_height": 2700,
          "width": 4050, "height": 2700,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "back",
        "image_url": "BACK_PREVIEW_URL",
        "position": {
          "area_width": 4050, "area_height": 2700,
          "width": 4050, "height": 2700,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "pocket",
        "image_url": "POCKET_PREVIEW_URL",
        "position": {
          "area_width": 4050, "area_height": 2700,
          "width": 4050, "height": 2700,
          "top": 0, "left": 0
        }
      }
    ]
  }'
```

**Note:** You may not need to include ALL placements in the mockup request — front, back, and pocket are usually sufficient for product listing images. Test which mockup angles are available for CAT 465.

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
  category_id: 'CATEGORY_UUID', // FK to categories table (bags / duffle-bags)
  pod_provider: 'printful',
  product_template_id: '465',
  provider_product_id: String(pfProductId),
  base_price_cents: 9999,
  compare_at_price_cents: 14999,
  images: [
    { src: `https://.../mockups/slug/front.png?v=${ts}`, alt: 'Title - Front' },
    { src: `https://.../mockups/slug/back.png?v=${ts}`, alt: 'Title - Back' },
    { src: `https://.../mockups/slug/pocket.png?v=${ts}`, alt: 'Title - Pocket Detail' }
  ],
  product_details: {
    safety_information: GPSR_HTML,
    material: '100% Polyester',
    care_instructions: 'Spot clean or wipe with damp cloth. Do not machine wash. Do not bleach. Air dry.',
    print_technique: 'CUT-SEW (All-Over Sublimation)',
    manufacturing_country: 'NEEDS VERIFICATION',
    brand: 'SKAPARA',
    blank: 'AOP Duffle Bag'
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
  external_variant_id: '12021',
  image_url: `https://.../mockups/slug/front.png?v=${ts}`
})
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc.</p>
<p><strong>Material:</strong> 100% Polyester</p>
<p><strong>Print technique:</strong> All-over sublimation — dye-sublimation inks</p>
<p><strong>Care:</strong> Spot clean or wipe with damp cloth. Do not machine wash. Do not bleach. Air dry.</p>
<p><strong>Compliance:</strong> REACH, EU Regulation 2023/988 (GPSR)</p>
```

Store in `products.product_details.safety_information` (JSONB).

**NOTE:** EU fulfillment status NEEDS VERIFICATION. Check Printful dashboard for fulfillment center confirmation before listing as EU-fulfilled.

---

## Pricing Strategy

| Metric | Value |
|---|---|
| Base cost | 59.00 EUR |
| Recommended retail | 99.99 EUR |
| Margin | 41.0% |
| Minimum retail (35% margin) | 90.77 EUR |
| Alternative retail | 89.99 EUR (34.4% margin — just below threshold, use with caution) |

All 7 placements included — no additional costs. This is the most expensive AOP product but also the most premium.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| High base cost | 59.00 EUR is the highest AOP base — requires premium retail pricing | Position as premium/statement piece, price at 89.99-109.99 EUR |
| 7 design files | Most complex AOP product — 7 separate files to manage | Use unified pattern approach to reduce to 2 files minimum |
| Same printfile spec | All 6 exterior panels use PF#239 (4050x2700) | Can reuse same design, but test how it maps to each panel |
| Panel-to-surface mapping | How the flat 4050x2700 design maps to each 3D surface varies | Request mockups to verify visual result before finalizing |
| EU fulfillment uncertain | Needs dashboard verification | Verify before listing as EU-fulfilled |
| Seam alignment | AOP patterns may show misalignment at panel seams | Use patterns tolerant of seam breaks |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Cache-busting | Browser/CDN cache images by URL | ALWAYS append `?v=timestamp` |
| Mockup coverage | Not all 7 placements may have mockup angles | Focus on front, back, and pocket for listing images |

---

## Description Rules

**What goes in `description`** (creative text only):
- Product context, lifestyle use cases (gym, travel, weekender, festival)
- 2-3 sentences max, casual but smart tone
- Highlight premium AOP coverage, duffle versatility, statement piece quality
- Must be translated to EN, ES, DE

**What does NOT go in `description`:**
- Material composition -> `product_details.material`
- Care instructions -> `product_details.care_instructions`
- Manufacturing info -> `product_details.manufacturing_country`
- Safety/compliance -> `product_details.safety_information`

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (bags / duffle-bags)
- [ ] Single variant shows correctly (One size, White)
- [ ] All available mockup images load correctly
- [ ] Price is correct (not overridden by margin fixer)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] Label inside shows SKAPARA mark
- [ ] SKAPARA branding integrated into panel designs
- [ ] EU fulfillment status verified in Printful dashboard
- [ ] All design files uploaded to both Supabase Storage and Printful File Library
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
