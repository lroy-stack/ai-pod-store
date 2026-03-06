---
name: Printful AOP Reversible Bucket Hat Production
description: >-
  Complete pipeline for AOP Reversible Bucket Hat (catalog 654) on Printful.
  CUT-SEW all-over sublimation on 100% polyester. Reversible — 4 independent
  print panels + 2 labels. Use when creating AOP bucket hat products,
  designing reversible bucket hats, generating bucket hat mockups, or
  managing all-over-print headwear. Covers multi-panel design, variant
  management, mockup generation, and Supabase integration.
---

# Printful AOP Reversible Bucket Hat Production Pipeline

Full production pipeline for SKAPARA AOP Reversible Bucket Hats on Printful. This is a CUT-SEW product — the design is sublimated onto white polyester fabric before the hat is assembled. Both the outside and inside surfaces are independently printable, making it a truly reversible accessory.

For DTG-based apparel products, see the `printful-cc1717` or `printful-tshirt` skills instead.
For embroidered headwear, see the `printful-6089m-embroidery` or other embroidery skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Product** | AOP Reversible Bucket Hat |
| **Catalog ID** | 654 |
| **Technique** | CUT-SEW (all-over sublimation) |
| **Material** | 100% polyester |
| **Weight** | 8.1 oz/yd2 (275 g/m2) |
| **Colors** | White only (sublimation base) |
| **Sizes** | XS, S/M, L/XL |
| **Construction** | Reversible — both sides independently printable |
| **Producer** | Printful (Latvia — CUT-SEW in-house) |
| **EU Fulfillment** | LIKELY YES (cut-sew in-house Latvia) |
| **Base Price** | 21.74 EUR |

---

## When to Use

- Create a new AOP reversible bucket hat product on Printful
- Design all-over-print patterns for a reversible bucket hat (4 panels + 2 labels)
- Generate mockups for AOP bucket hat products
- Update Supabase with AOP bucket hat product data
- Manage bucket hat variant sizing (XS, S/M, L/XL)

---

## AOP / CUT-SEW Technical Notes

**How CUT-SEW sublimation works:**
1. Your design is printed onto transfer paper using sublimation ink
2. The ink is heat-pressed onto flat white polyester fabric panels
3. The fabric is then cut and sewn into the final product shape
4. Result: seamless, edge-to-edge print coverage on every surface

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

## Multi-Panel Design — REVERSIBLE HAT

This hat has **6 placements** — 4 print panels + 2 labels. The CRITICAL feature is that the hat is REVERSIBLE: the wearer can flip it inside-out to show a completely different design.

### Design Strategy

| Panel | Purpose | Design Approach |
|---|---|---|
| `outside_front` | Primary exterior front | Main AOP pattern (hero design) |
| `outside_back` | Primary exterior back | Continuation or complement of front pattern |
| `inside_front` | Reversible interior front | Contrasting/complementary AOP pattern |
| `inside_back` | Reversible interior back | Continuation of inside pattern |
| `label_outside` | Exterior label | SKAPARA mark (S isotipo or wordmark) |
| `label_inside` | Interior label | SKAPARA mark (matching interior aesthetic) |

**GOLDEN RULE:** Design the outside and inside as TWO DISTINCT but brand-coherent looks. The reversibility IS the product feature — do not waste it with identical designs.

**Pattern ideas for reversible hat:**
- Outside: bold pattern / Inside: subtle tone-on-tone version
- Outside: dark colorway / Inside: light colorway (same motif)
- Outside: graphic/illustrated / Inside: geometric/abstract
- Outside: brand pattern / Inside: complementary solid-feel with subtle repeat

---

## Placements & Canvas Sizes

All canvases at 150 DPI:

| Placement | Printfile | Canvas (px) | Physical | Fill | Cost |
|---|---|---|---|---|---|
| `outside_front` | PF#410 | 2700 x 3150 | 18.0" x 21.0" | cover | included |
| `outside_back` | PF#410 | 2700 x 3150 | 18.0" x 21.0" | cover | included |
| `inside_front` | PF#410 | 2700 x 3150 | 18.0" x 21.0" | cover | included |
| `inside_back` | PF#410 | 2700 x 3150 | 18.0" x 21.0" | cover | included |
| `label_outside` | PF#411 | 450 x 300 | 3.0" x 2.0" | cover | included |
| `label_inside` | PF#411 | 450 x 300 | 3.0" x 2.0" | cover | included |

**IMPORTANT:** All 6 placements are included in the base price (21.74 EUR). No additional placement charges.

**Total design files needed: 6** (or fewer if outside_front == outside_back pattern, etc.)

---

## Branding for AOP Products

Since AOP covers the entire surface, branding is integrated INTO the design:

- **Label placements** (`label_outside` + `label_inside`): Use SKAPARA S mark or wordmark
- **Panel designs**: Incorporate SKAPARA branding elements subtly into the all-over pattern (watermark repeat, pattern element, etc.)
- **No separate branding placement** — everything is part of the AOP design

**Label design specs:**
- Canvas: 450 x 300 px @ 150 DPI
- Recommended: SKAPARA S mark centered, white or dark depending on label background
- Keep it simple — this is a small woven-label-sized area

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

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'`

---

## Workflow: Create New AOP Bucket Hat Product

### Step 1: Design All Panels

Create 6 PNG files at exact canvas dimensions:

| File | Canvas (px) | Purpose |
|---|---|---|
| `bucket-outside-front.png` | 2700 x 3150 | Primary exterior design |
| `bucket-outside-back.png` | 2700 x 3150 | Exterior back design |
| `bucket-inside-front.png` | 2700 x 3150 | Reversible interior design |
| `bucket-inside-back.png` | 2700 x 3150 | Interior back design |
| `bucket-label-outside.png` | 450 x 300 | Exterior SKAPARA label |
| `bucket-label-inside.png` | 450 x 300 | Interior SKAPARA label |

### Step 2: Upload Designs to File Library

Upload to Supabase Storage first, then POST to Printful File Library:

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

Save the `id` from each response — needed for product creation.

Repeat for all 6 design files:
1. Outside front → `OUTSIDE_FRONT_FILE_ID`
2. Outside back → `OUTSIDE_BACK_FILE_ID`
3. Inside front → `INSIDE_FRONT_FILE_ID`
4. Inside back → `INSIDE_BACK_FILE_ID`
5. Label outside → `LABEL_OUTSIDE_FILE_ID`
6. Label inside → `LABEL_INSIDE_FILE_ID`

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — AOP Bucket Hat"
    },
    "sync_variants": [
      {
        "variant_id": 19255,
        "retail_price": "39.99",
        "files": [
          { "type": "outside_front", "id": OUTSIDE_FRONT_FILE_ID },
          { "type": "outside_back", "id": OUTSIDE_BACK_FILE_ID },
          { "type": "inside_front", "id": INSIDE_FRONT_FILE_ID },
          { "type": "inside_back", "id": INSIDE_BACK_FILE_ID },
          { "type": "label_outside", "id": LABEL_OUTSIDE_FILE_ID },
          { "type": "label_inside", "id": LABEL_INSIDE_FILE_ID }
        ]
      },
      {
        "variant_id": 16360,
        "retail_price": "39.99",
        "files": [
          { "type": "outside_front", "id": OUTSIDE_FRONT_FILE_ID },
          { "type": "outside_back", "id": OUTSIDE_BACK_FILE_ID },
          { "type": "inside_front", "id": INSIDE_FRONT_FILE_ID },
          { "type": "inside_back", "id": INSIDE_BACK_FILE_ID },
          { "type": "label_outside", "id": LABEL_OUTSIDE_FILE_ID },
          { "type": "label_inside", "id": LABEL_INSIDE_FILE_ID }
        ]
      },
      {
        "variant_id": 16361,
        "retail_price": "39.99",
        "files": [
          { "type": "outside_front", "id": OUTSIDE_FRONT_FILE_ID },
          { "type": "outside_back", "id": OUTSIDE_BACK_FILE_ID },
          { "type": "inside_front", "id": INSIDE_FRONT_FILE_ID },
          { "type": "inside_back", "id": INSIDE_BACK_FILE_ID },
          { "type": "label_outside", "id": LABEL_OUTSIDE_FILE_ID },
          { "type": "label_inside", "id": LABEL_INSIDE_FILE_ID }
        ]
      }
    ]
  }'
```

**Key points:**
- `variant_id` is the **catalog variant ID** from VARIANTS.md
- `retail_price` is the customer-facing price as string
- `files[].type` maps to placement names
- Same files array for all 3 size variants (same color = White)
- All 6 placements included at no extra cost

### Step 4: Set Pricing

| Size | Base Cost (EUR) | Retail Price (EUR) | Margin |
|---|---|---|---|
| XS | 21.74 | 39.99 | 45.7% |
| S/M | 21.74 | 39.99 | 45.7% |
| L/XL | 21.74 | 39.99 | 45.7% |

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

### Step 5: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/654" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [16360],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "outside_front",
        "image_url": "OUTSIDE_FRONT_PREVIEW_URL",
        "position": {
          "area_width": 2700, "area_height": 3150,
          "width": 2700, "height": 3150,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "outside_back",
        "image_url": "OUTSIDE_BACK_PREVIEW_URL",
        "position": {
          "area_width": 2700, "area_height": 3150,
          "width": 2700, "height": 3150,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "inside_front",
        "image_url": "INSIDE_FRONT_PREVIEW_URL",
        "position": {
          "area_width": 2700, "area_height": 3150,
          "width": 2700, "height": 3150,
          "top": 0, "left": 0
        }
      },
      {
        "placement": "inside_back",
        "image_url": "INSIDE_BACK_PREVIEW_URL",
        "position": {
          "area_width": 2700, "area_height": 3150,
          "width": 2700, "height": 3150,
          "top": 0, "left": 0
        }
      }
    ]
  }'
```

Poll task status:
```bash
curl "https://api.printful.com/mockup-generator/task?task_key=${TASK_KEY}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}"
```

### Step 6: Download Mockups & Upload to Supabase Storage

Mockup S3 URLs expire in ~24h. Always download and re-upload:

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
  category_id: 'CATEGORY_UUID', // FK to categories table (headwear / bucket-hats)
  pod_provider: 'printful',
  product_template_id: '654',
  provider_product_id: String(pfProductId),
  base_price_cents: 3999,
  compare_at_price_cents: 5999,
  images: [
    { src: `https://.../mockups/slug/outside-front.png?v=${ts}`, alt: 'Title - Outside' },
    { src: `https://.../mockups/slug/inside-front.png?v=${ts}`, alt: 'Title - Inside (Reversible)' }
  ],
  product_details: {
    safety_information: GPSR_HTML,
    material: '100% Polyester (275 g/m2)',
    care_instructions: 'Machine wash cold, gentle cycle. Do not bleach. Tumble dry low. Do not iron directly on print.',
    print_technique: 'CUT-SEW (All-Over Sublimation)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    blank: 'AOP Reversible Bucket Hat',
    weight: '8.1 oz/yd2 (275 g/m2)',
    construction: 'Reversible — both sides independently printed'
  },
  status: 'active'
})

// Create product variants (single color — White)
const sizes = [
  { size: 'XS', variantId: 19255 },
  { size: 'S/M', variantId: 16360 },
  { size: 'L/XL', variantId: 16361 }
]

for (const { size, variantId } of sizes) {
  await supabase.from('product_variants').upsert({
    product_id: productId,
    color: 'White',
    color_hex: '#ffffff',
    size,
    is_enabled: true,
    external_variant_id: String(variantId),
    image_url: `https://.../mockups/slug/outside-front.png?v=${ts}`
  })
}
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>
<p><strong>Material:</strong> 100% Polyester (8.1 oz/yd2 / 275 g/m2)</p>
<p><strong>Construction:</strong> Reversible bucket hat, CUT-SEW assembly</p>
<p><strong>Print technique:</strong> All-over sublimation — dye-sublimation inks</p>
<p><strong>Care:</strong> Machine wash cold, gentle cycle. Do not bleach. Tumble dry low. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, EU Regulation 2023/988 (GPSR)</p>
```

Store in `products.product_details.safety_information` (JSONB).

---

## Pricing Strategy

| Metric | Value |
|---|---|
| Base cost (all sizes) | 21.74 EUR |
| Recommended retail | 39.99 EUR |
| Margin | 45.7% |
| Minimum retail (35% margin) | 33.45 EUR |

All placements included — no additional costs.

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Seam alignment | AOP patterns may show slight misalignment at seams due to cut-sew process | Use patterns that tolerate seam breaks (abstract, geometric, repeat patterns) — avoid designs that require precise alignment across seams |
| White base shows at edges | If design has dark edges, white polyester may peek through at seam allowances | Extend dark areas slightly beyond canvas edges (bleed) |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Single color (White) | Cannot offer color variants — base is always white | Design variety comes from the AOP pattern itself |
| Reversible complexity | 6 separate design files needed | Plan both sides as a cohesive design package upfront |
| Cache-busting | Browser/CDN cache images by URL | ALWAYS append `?v=timestamp` when overwriting Supabase Storage files |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` if using curl directly |

---

## Description Rules

**What goes in `description`** (creative text only):
- Product context, design story, reversibility feature highlight
- 2-3 sentences max, casual but smart tone
- Emphasize the reversible feature: "two looks in one", "flip it for a fresh vibe"
- Must be translated to EN, ES, DE

**What does NOT go in `description`:**
- Material composition -> `product_details.material`
- Care instructions -> `product_details.care_instructions`
- Manufacturing info -> `product_details.manufacturing_country`
- Safety/compliance -> `product_details.safety_information`

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (headwear / bucket-hats)
- [ ] All 3 size variants show (XS, S/M, L/XL)
- [ ] Both outside and inside mockup images load correctly
- [ ] Price is correct (not overridden by margin fixer)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] Labels show SKAPARA branding
- [ ] Alt text follows pattern: "Title - Outside", "Title - Inside (Reversible)"
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
- [ ] All 6 design files uploaded to both Supabase Storage and Printful File Library
