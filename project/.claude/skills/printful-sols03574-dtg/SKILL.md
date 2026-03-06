---
name: Printful SOL'S 03574 Comet Organic Sweatshirt DTG
description: >-
  Complete pipeline for SOL'S 03574 Comet Organic Sweatshirt (catalog 506) DTG products on Printful.
  Covers product creation, variant management, branding placement (front, back, sleeve_left,
  sleeve_right, label_outside), mockup generation, and Supabase integration. Use when creating
  DTG organic sweatshirt products, generating mockups, updating branding, or managing
  organic crewneck sweatshirts. 8 colors, XS-XXL (6 sizes), EU Latvia fulfillment.
---

# Printful SOL'S 03574 Comet Organic Sweatshirt — DTG Pipeline

Full production pipeline for SKAPARA organic crewneck sweatshirts using the SOL'S 03574 Comet blank on Printful. Premium organic cotton sweatshirt with 5 DTG placement options including sleeves and neck label.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03574 Comet Organic Sweatshirt |
| **Catalog ID** | 506 |
| **Technique** | DTG (Direct-to-Garment) |
| **Material** | Organic cotton |
| **Fit** | Regular |
| **Sizes** | XS, S, M, L, XL, XXL (6 sizes) |
| **Colors** | Black, Bottle Green, Deep Charcoal Grey, French Navy, Grey Melange, Red, Royal Blue, White (8 colors) |
| **Print Method** | DTG |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES — Latvia |

---

## When to Use

- Create a new SKAPARA organic sweatshirt product on Printful
- Upload designs and apply full SKAPARA branding (front + back + sleeves + label)
- Generate mockups for 03574 Comet sweatshirt products
- Update Supabase with sweatshirt product data and mockup images
- Manage 03574 variant colors/sizes

---

## Placements & Canvas Sizes

All DTG canvases at 150 DPI:

| Placement | Printfile | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|---|
| `front` / `default` | PF#1 | 1800 x 2400 | +5.95 EUR | Main design |
| `back` | PF#1 | 1800 x 2400 | +5.95 EUR | SKAPARA wordmark (white) |
| `sleeve_left` | PF#147 | 450 x 1800 | +5.95 EUR | S mark isotipo |
| `sleeve_right` | PF#147 | 450 x 1800 | +5.95 EUR | Optional — unused by default |
| `label_outside` | PF#249 | 255 x 255 | +2.50 EUR | Neck label (nuca) |

**BRANDING:**
- `front`: Main design (1800x2400 @150dpi)
- `back`: SKAPARA wordmark white, centered, ~37% of canvas width, y=150px
- `sleeve_left`: S mark isotipo white, ~32% of canvas width (144px in 450px), centered vertically
- `sleeve_right`: Unused by default (available for premium products)
- `label_outside`: SKAPARA micro logo (255x255)

**NOTE:** `sleeve_left` and `sleeve_right` are long sleeve placements (450x1800) — vertical orientation.

---

## Base Costs (Production)

| Size | Base Cost (EUR) |
|---|---|
| XS | 22.40 |
| S | 22.40 |
| M | 22.40 |
| L | 22.40 |
| XL | 24.70 |
| XXL | 26.95 |

**Placement cost stacking (standard 3-placement: front + back + sleeve_left):**
- 3 placements: +17.85 EUR (3 x 5.95)
- Total: 40.25 (XS-L), 42.55 (XL), 44.80 (XXL)

**With label_outside (+2.50):**
- Total: 42.75 (XS-L), 45.05 (XL), 47.30 (XXL)

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
- On 429: read `x-ratelimit-reset` header, wait that many seconds, retry

**Shared utility:** `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'`

**Key endpoints:**

| Endpoint | Method | Use |
|---|---|---|
| `/files` | POST | Upload image to File Library |
| `/store/products` | POST | Create new sync product |
| `/store/products/{id}` | GET/PUT | Read/update sync product |
| `/mockup-generator/create-task/506` | POST | Create mockup task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |

---

## Workflow: Create New Organic Sweatshirt Product

### Step 1: Design Assets

Prepare PNGs at 150dpi:
- Front design: 1800x2400 (PF#1)
- Back wordmark: 1800x2400 (PF#1) — reuse existing SKAPARA wordmark file
- Sleeve S mark: 450x1800 (PF#147) — reuse existing S mark file
- Label (optional): 255x255 (PF#249)

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
      "name": "Product Name — Organic Sweatshirt",
      "thumbnail": "https://..."
    },
    "sync_variants": [
      {
        "variant_id": CATALOG_VARIANT_ID,
        "retail_price": "54.99",
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
| XS-L | 54.99 | 40.25 | ~26.8% |
| XL | 57.99 | 42.55 | ~26.6% |
| XXL | 59.99 | 44.80 | ~25.3% |

**CRITICAL:** Set prices in Printful FIRST. Margins are below 35% with 3 placements — the cron sync margin fixer will flag these. Options:
1. Raise retail prices to 59.99/62.99/64.99
2. Use 2 placements only (front + sleeve = 11.90 EUR extra)
3. Adjust margin threshold for sweatshirts

### Step 5: Generate Mockups

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
    "options": ["Front", "Back", "Left"],
    "files": [
      { "placement": "front", "image_url": "FRONT_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } },
      { "placement": "back", "image_url": "BACK_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } },
      { "placement": "sleeve_left", "image_url": "SLEEVE_URL", "position": { "area_width": 450, "area_height": 1800, "width": 450, "height": 1800, "top": 0, "left": 0 } }
    ]
  }'
```

### Step 6: Download Mockups & Upload to Supabase Storage

Mockup S3 URLs expire in ~24h. Download and re-upload to permanent storage with cache-buster.

### Step 7: Update Supabase products Table

```javascript
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative description. Organic cotton, everyday comfort.',
  translations: {
    es: { title: 'Nombre', description: 'Descripcion organica...' },
    de: { title: 'Name', description: 'Bio-Baumwolle Beschreibung...' }
  },
  category_id: 'SWEATSHIRT_CATEGORY_UUID',
  pod_provider: 'printful',
  product_template_id: '506',
  provider_product_id: String(pfProductId),
  base_price_cents: 5499,
  compare_at_price_cents: 6499,
  images: [...],
  product_details: {
    safety_information: GPSR_HTML,
    material: 'Organic cotton',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    blank: "SOL'S 03574 Comet Organic Sweatshirt",
    fit: 'Regular'
  },
  status: 'active'
})
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>
<p><strong>Material:</strong> Organic cotton (SOL'S 03574 Comet)</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100, GOTS organic</p>
```

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Sleeve canvas vertical | 450x1800 is tall/narrow — design accordingly | S mark rotated or vertically oriented |
| Thin margins | 3 DTG placements at 5.95 each = 17.85 extra | Use 2 placements or raise prices |
| Margin fixer | Will flag products under 35% margin | Adjust pricing or threshold |
| Bottle Green | Dark green may not render well in mockups | Verify mockup quality |
| Deep Charcoal Grey | Very dark — similar to Black in mockups | Ensure distinct mockup lighting |
| Grey Melange | Medium tone — both light and dark designs work | Test contrast for both design styles |
| Red | Dark-medium color — white/light designs preferred | Avoid red-on-red or dark designs |
| Royal Blue | Dark color — white/light designs only | High contrast white designs recommended |
| White | Light color — use dark/black designs ONLY | Never use white/light designs on White |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload |
| back vs label_outside | May be mutually exclusive | Test both before committing |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (sweatshirts)
- [ ] All 8 colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (XS, S, M, L, XL, XXL)
- [ ] Price is correct per size tier
- [ ] Mockup images load for all placements (front, back, sleeve)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML, max 2000 chars)
- [ ] Alt text follows pattern: "Title - Color", "Title - Color - Back", "Title - Color - Sleeve"
- [ ] Images ordered: all fronts first, then backs, then sleeves
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
