---
name: Printful SOL'S 03568 Eco Raglan Hoodie DTG
description: >-
  Complete pipeline for SOL'S 03568 Eco Raglan Hoodie (catalog 543) DTG products on Printful.
  Covers product creation, variant management, branding placement (front, back, sleeve_left,
  sleeve_right), mockup generation, and Supabase integration. Use when creating DTG raglan
  hoodie products, generating mockups, updating branding, or managing eco raglan hoodies.
  6 colors (Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White), 42 variants,
  XS-3XL, EU Latvia fulfillment.
---

# Printful SOL'S 03568 Eco Raglan Hoodie — DTG Pipeline

Full production pipeline for SKAPARA eco raglan hoodies using the SOL'S 03568 blank on Printful. Premium organic hoodie with raglan sleeves, 4 DTG placement options, and wide size range XS-3XL.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03568 Eco Raglan Hoodie |
| **Catalog ID** | 543 |
| **Technique** | DTG (Direct-to-Garment) |
| **Material** | Organic cotton blend |
| **Fit** | Regular raglan |
| **Sizes** | XS, S, M, L, XL, 2XL, 3XL (7 sizes) |
| **Colors** | 6: Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White |
| **Variants** | 42 (6 colors x 7 sizes) |
| **Print Method** | DTG |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES — Latvia |

---

## When to Use

- Create a new SKAPARA eco raglan hoodie product on Printful
- Upload designs and apply full SKAPARA branding (front + back + sleeves)
- Generate mockups for 03568 raglan hoodie products
- Update Supabase with raglan hoodie product data and mockup images
- Manage 03568 variant colors/sizes (XS-3XL range)

---

## Placements & Canvas Sizes

DTG canvases at 150 DPI:

| Placement | Printfile | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|---|
| `front` / `default` | PF#1 | 1800 x 2400 | +5.95 EUR | Main design |
| `back` | PF#134 | 1800 x 1800 | +5.95 EUR | SKAPARA wordmark |
| `sleeve_left` | PF#147 | 450 x 1800 | +5.95 EUR | S mark isotipo |
| `sleeve_right` | PF#147 | 450 x 1800 | +5.95 EUR | Optional |

**BRANDING:**
- `front`: Main design (1800x2400 @150dpi)
- `back`: SKAPARA wordmark white, ~37% of canvas width, centered — **NOTE: Back canvas is 1800x1800 (square), NOT 1800x2400**
- `sleeve_left`: S mark isotipo white, ~32% of 450px width, centered vertically
- `sleeve_right`: Unused by default

**IMPORTANT:** The back printfile is PF#134 (1800x1800) — different from the front PF#1 (1800x2400). Do NOT reuse front design files for back placement without resizing.

---

## Base Costs (Production)

| Size | Base Cost (EUR) |
|---|---|
| XS | 35.20 |
| S | 35.20 |
| M | 35.20 |
| L | 35.20 |
| XL | 37.50 |
| 2XL | 39.95 |
| 3XL | 42.25 |

**Placement cost stacking (standard 3-placement: front + back + sleeve_left):**
- 3 placements: +17.85 EUR (3 x 5.95)
- Total: 53.05 (XS-L), 55.35 (XL), 57.80 (2XL), 60.10 (3XL)

---

## Printful API Reference

**Auth headers (ALL requests):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: 17795695
Content-Type: application/json
User-Agent: POD-AI-Store/1.0
```

**Rate limits:**
- General API: ~120 req/min. Use `delay(2000)` between calls
- Mockup Generator: ~10 req/min. Use `delay(10000)` between tasks

**Shared utility:** `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'`

**Key endpoints:**

| Endpoint | Method | Use |
|---|---|---|
| `/files` | POST | Upload image to File Library |
| `/store/products` | POST | Create new sync product |
| `/store/products/{id}` | GET/PUT | Read/update sync product |
| `/mockup-generator/create-task/543` | POST | Create mockup task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |

---

## Workflow: Create New Eco Raglan Hoodie Product

### Step 1: Design Assets

Prepare PNGs at 150dpi:
- Front design: 1800x2400 (PF#1)
- Back wordmark: 1800x1800 (PF#134) — **SQUARE canvas, not rectangular**
- Sleeve S mark: 450x1800 (PF#147) — vertical orientation

### Step 2: Upload Designs to File Library

```bash
# Upload to Supabase Storage first
curl -X POST "${SUPABASE_URL}/storage/v1/object/designs/uploads/${FILENAME}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary "@${LOCAL_FILE_PATH}"

# Upload to Printful File Library
curl -X POST "https://api.printful.com/files" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{ "url": "'${PUBLIC_URL}'", "filename": "'${FILENAME}'" }'
```

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "sync_product": {
      "name": "Product Name — Eco Raglan Hoodie",
      "thumbnail": "https://..."
    },
    "sync_variants": [
      {
        "variant_id": CATALOG_VARIANT_ID,
        "retail_price": "69.99",
        "files": [
          { "type": "default", "id": FRONT_FILE_ID },
          { "type": "back", "id": BACK_FILE_ID },
          { "type": "sleeve_left", "id": SLEEVE_FILE_ID }
        ]
      }
    ]
  }'
```

See [VARIANTS.md](VARIANTS.md) for all variant IDs.

### Step 4: Set Variant Prices

| Size | Retail (EUR) | Cost (3 placements) | Margin |
|---|---|---|---|
| XS-L | 69.99 | 53.05 | ~24.2% |
| XL | 74.99 | 55.35 | ~26.2% |
| 2XL | 79.99 | 57.80 | ~27.7% |
| 3XL | 84.99 | 60.10 | ~29.3% |

**CRITICAL:** Set prices in Printful FIRST. Margins are below 35%. Options:
1. Raise retail prices (79.99/84.99/89.99/94.99 for >35% margin)
2. Use 2 placements (front + sleeve = 11.90 extra)
3. Adjust margin fixer threshold for premium hoodies

### Step 5: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/543" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "variant_ids": [VARIANT_ID],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Back", "Left"],
    "files": [
      { "placement": "front", "image_url": "FRONT_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } },
      { "placement": "back", "image_url": "BACK_URL", "position": { "area_width": 1800, "area_height": 1800, "width": 1800, "height": 1800, "top": 0, "left": 0 } },
      { "placement": "sleeve_left", "image_url": "SLEEVE_URL", "position": { "area_width": 450, "area_height": 1800, "width": 450, "height": 1800, "top": 0, "left": 0 } }
    ]
  }'
```

### Step 6: Download Mockups & Upload to Supabase Storage

Mockup S3 URLs expire ~24h. Download and re-upload with cache-buster `?v=timestamp`.

### Step 7: Update Supabase products Table

```javascript
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative description. Eco raglan hoodie, organic cotton, premium comfort.',
  translations: {
    es: { title: 'Nombre', description: 'Sudadera raglan eco...' },
    de: { title: 'Name', description: 'Eco Raglan Hoodie...' }
  },
  category_id: 'HOODIE_CATEGORY_UUID',
  pod_provider: 'printful',
  product_template_id: '543',
  provider_product_id: String(pfProductId),
  base_price_cents: 6999,
  compare_at_price_cents: 7999,
  images: [...],
  product_details: {
    safety_information: GPSR_HTML,
    material: 'Organic cotton blend',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    blank: "SOL'S 03568 Eco Raglan Hoodie",
    fit: 'Regular raglan'
  },
  status: 'active'
})
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>
<p><strong>Material:</strong> Organic cotton blend (SOL'S 03568)</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100, GOTS organic</p>
```

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Back canvas square | PF#134 is 1800x1800, not 1800x2400 | Design back assets at correct dimensions |
| High base cost | 35.20-42.25 EUR before placements | Premium pricing tier required |
| Thin margins | 3 placements push costs >53 EUR | Higher retail or fewer placements |
| Raglan sleeve seams | Sleeve print may cross raglan seam | Position design carefully on 450x1800 canvas |
| Burgundy contrast | Dark red — verify white text legibility | Test mockup before production |
| Burnt Orange contrast | Warm medium tone — test contrast with both light/dark designs | Generate mockups for both to verify |
| Charcoal Melange | Dark heathered — white/light designs preferred | Heathered texture may affect fine detail |
| White garment | Light — use dark/black designs only | Avoid white-on-white text |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload |
| Sleeve canvas vertical | 450x1800 is tall/narrow | S mark vertical or rotated orientation |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (hoodies)
- [ ] All enabled colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (XS, S, M, L, XL, 2XL, 3XL)
- [ ] Price is correct per size tier
- [ ] Mockup images load for all placements (front, back, sleeve)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML, max 2000 chars)
- [ ] Back design uses 1800x1800 canvas (not 1800x2400)
- [ ] Alt text follows pattern: "Title - Color", "Title - Color - Back", "Title - Color - Sleeve"
- [ ] Images ordered: all fronts first, then backs, then sleeves
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
