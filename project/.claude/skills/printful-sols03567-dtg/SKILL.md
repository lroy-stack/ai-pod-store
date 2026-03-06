---
name: Printful SOL'S 03567 Organic Raglan Sweatshirt DTG
description: >-
  Complete pipeline for SOL'S 03567 Organic Raglan Sweatshirt (catalog 582) DTG products on Printful.
  Covers product creation, variant management, branding placement (front, back, sleeve_left,
  sleeve_right), mockup generation, and Supabase integration. Use when creating DTG organic
  raglan sweatshirts, generating mockups, updating branding, or managing organic raglan
  crewneck sweatshirts. 6 colors (Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange,
  White), 41 variants, XS-3XL, EU Latvia fulfillment.
---

# Printful SOL'S 03567 Organic Raglan Sweatshirt — DTG Pipeline

Full production pipeline for SKAPARA organic raglan sweatshirts using the SOL'S 03567 blank on Printful. Premium organic cotton raglan crewneck with 4 DTG placement options and wide size range XS-3XL.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03567 Organic Raglan Sweatshirt |
| **Catalog ID** | 582 |
| **Technique** | DTG (Direct-to-Garment) |
| **Material** | Organic cotton blend |
| **Fit** | Regular raglan crewneck |
| **Sizes** | XS, S, M, L, XL, 2XL, 3XL (7 sizes) |
| **Colors** | 6: Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White |
| **Variants** | 41 (6 colors x 7 sizes, minus 1) |
| **Print Method** | DTG |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES — Latvia |

---

## When to Use

- Create a new SKAPARA organic raglan sweatshirt product on Printful
- Upload designs and apply full SKAPARA branding (front + back + sleeves)
- Generate mockups for 03567 raglan sweatshirt products
- Update Supabase with raglan sweatshirt product data and mockup images
- Manage 03567 variant colors/sizes (XS-3XL range)

---

## Placements & Canvas Sizes

DTG canvases at 150 DPI:

| Placement | Printfile | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|---|
| `front` / `default` | PF#1 | 1800 x 2400 | +5.95 EUR | Main design |
| `back` | PF#328 | 1800 x 2400 | +5.95 EUR | SKAPARA wordmark |
| `sleeve_left` | PF#147 | 450 x 1800 | +5.95 EUR | S mark isotipo |
| `sleeve_right` | PF#147 | 450 x 1800 | +5.95 EUR | Optional |

**BRANDING:**
- `front`: Main design (1800x2400 @150dpi)
- `back`: SKAPARA wordmark white, centered, ~37% of canvas width, y=150px (PF#328 — 1800x2400)
- `sleeve_left`: S mark isotipo white, ~32% of canvas width (144px in 450px), centered vertically
- `sleeve_right`: Unused by default

**NOTE:** Unlike the 03568 hoodie (PF#134 = 1800x1800 back), this sweatshirt uses PF#328 (1800x2400) for back — same dimensions as front. The same back wordmark asset can be reused from CC1717/other DTG products.

---

## Base Costs (Production)

| Size | Base Cost (EUR) |
|---|---|
| XS | 26.20 |
| S | 26.20 |
| M | 26.20 |
| L | 26.20 |
| XL | 28.45 |
| 2XL | 30.70 |
| 3XL | 32.95 |

**Placement cost stacking (standard 3-placement: front + back + sleeve_left):**
- 3 placements: +17.85 EUR (3 x 5.95)
- Total: 44.05 (XS-L), 46.30 (XL), 48.55 (2XL), 50.80 (3XL)

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
| `/mockup-generator/create-task/582` | POST | Create mockup task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |

---

## Workflow: Create New Organic Raglan Sweatshirt Product

### Step 1: Design Assets

Prepare PNGs at 150dpi:
- Front design: 1800x2400 (PF#1)
- Back wordmark: 1800x2400 (PF#328) — same dimensions as front
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
      "name": "Product Name — Organic Raglan Sweatshirt",
      "thumbnail": "https://..."
    },
    "sync_variants": [
      {
        "variant_id": CATALOG_VARIANT_ID,
        "retail_price": "59.99",
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
| XS-L | 59.99 | 44.05 | ~26.6% |
| XL | 64.99 | 46.30 | ~28.8% |
| 2XL | 69.99 | 48.55 | ~30.6% |
| 3XL | 74.99 | 50.80 | ~32.3% |

**Premium pricing (>35% margin target):**

| Size | Retail (EUR) | Cost | Margin |
|---|---|---|---|
| XS-L | 69.99 | 44.05 | 37.1% |
| XL | 74.99 | 46.30 | 38.3% |
| 2XL | 79.99 | 48.55 | 39.3% |
| 3XL | 84.99 | 50.80 | 40.2% |

**CRITICAL:** Set prices in Printful FIRST. Standard pricing below 35% — use premium tier or adjust margin fixer.

### Step 5: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/582" \
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
      { "placement": "back", "image_url": "BACK_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } },
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
  description: 'Creative description. Organic raglan crewneck, everyday premium.',
  translations: {
    es: { title: 'Nombre', description: 'Sudadera raglan organica...' },
    de: { title: 'Name', description: 'Bio Raglan Sweatshirt...' }
  },
  category_id: 'SWEATSHIRT_CATEGORY_UUID',
  pod_provider: 'printful',
  product_template_id: '582',
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
    blank: "SOL'S 03567 Organic Raglan Sweatshirt",
    fit: 'Regular raglan crewneck'
  },
  status: 'active'
})
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>
<p><strong>Material:</strong> Organic cotton blend (SOL'S 03567)</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100, GOTS organic</p>
```

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Back uses PF#328 | Different printfile ID from front (PF#1) but same dimensions 1800x2400 | Can reuse same-dimension back assets |
| Raglan sleeve seams | Sleeve print may interact with raglan construction | Position S mark carefully |
| Sleeve canvas vertical | 450x1800 — tall/narrow | Vertical or rotated S mark |
| Thin margins (3 placements) | Standard pricing under 35% | Use premium pricing tier |
| Burgundy contrast | Dark red — verify white text | Test mockup rendering |
| Burnt Orange contrast | Warm medium tone — test contrast with both light/dark designs | Generate mockups for both to verify |
| Charcoal Melange | Dark heathered — white/light designs preferred | Heathered texture may affect fine detail |
| White garment | Light — use dark/black designs only | Avoid white-on-white text |
| Margin fixer | Cron sync overwrites if <35% | Set correct price in Printful FIRST |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (sweatshirts)
- [ ] All enabled colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (XS, S, M, L, XL, 2XL, 3XL)
- [ ] Price is correct per size tier
- [ ] Mockup images load for all placements (front, back, sleeve)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML, max 2000 chars)
- [ ] Alt text follows pattern: "Title - Color", "Title - Color - Back", "Title - Color - Sleeve"
- [ ] Images ordered: all fronts first, then backs, then sleeves
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
