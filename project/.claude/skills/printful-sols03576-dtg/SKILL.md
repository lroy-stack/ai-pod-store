---
name: Printful SOL'S 03576 Kids Eco Hoodie DTG
description: >-
  Complete pipeline for SOL'S 03576 Stellar Kids Eco Hoodie (catalog 483) DTG products on Printful.
  Covers product creation, variant management, branding placement, mockup generation,
  and Supabase integration. Use when creating DTG kids hoodie products, generating mockups,
  updating branding, or managing kids hoodie products. Kids sizes 4Y-12Y, 3 colors,
  EU Latvia fulfillment.
---

# Printful SOL'S 03576 Kids Eco Hoodie — DTG Pipeline

Full production pipeline for SKAPARA kids eco hoodies using the SOL'S 03576 Stellar blank on Printful. Organic cotton kids hoodie with DTG printing, available in 3 dark colors and kids sizes 4Y-12Y.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03576 Stellar Kids Eco Hoodie |
| **Catalog ID** | 483 |
| **Technique** | DTG (Direct-to-Garment) |
| **Material** | Organic cotton blend |
| **Fit** | Kids regular |
| **Sizes** | 4Y, 6Y, 8Y, 10Y, 12Y (5 kids sizes) |
| **Colors** | Black, Burnt Orange, French Navy (3 colors) |
| **Print Method** | DTG |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES — Latvia |

---

## When to Use

- Create a new SKAPARA kids hoodie product on Printful
- Upload designs and apply age-appropriate SKAPARA branding to 03576 products
- Generate mockups for kids hoodie products
- Update Supabase with kids hoodie product data and mockup images
- Manage 03576 variant sizes (4Y-12Y kids range)

---

## Placements & Canvas Sizes

All canvases at 150 DPI:

| Placement | Printfile | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|---|
| `front` | PF#9 | 1500 x 1800 | +5.25 EUR | Main design — age-appropriate |
| `back` | PF#57 | 1500 x 1500 | +5.25 EUR | SKAPARA wordmark or gradient S mark |

**BRANDING for Kids:**
- `front`: Main design — age-appropriate, fun, colorful. SKAPARA gradient S mark integrated into design
- `back`: SKAPARA wordmark (white on dark) or gradient S mark — kid-friendly sizing

**NOTE:** No sleeve placement available on this product. Branding goes on front + back only.

---

## Base Costs (Production)

| Size | Base Cost (EUR) |
|---|---|
| 4Y | 24.95 |
| 6Y | 24.95 |
| 8Y | 24.95 |
| 10Y | 26.65 |
| 12Y | 26.65 |

Additional placement costs: front (+5.25) + back (+5.25) = +10.50 EUR per unit.

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

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry with jitter, proactive slowdown, and exponential backoff automatically.

**Key endpoints:**

| Endpoint | Method | Use |
|---|---|---|
| `/files` | POST | Upload image to File Library |
| `/store/products` | POST | Create new sync product |
| `/store/products/{id}` | GET/PUT | Read/update sync product + all variants |
| `/mockup-generator/create-task/483` | POST | Create 03576 mockup task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |

---

## Workflow: Create New Kids Hoodie Product

### Step 1: Design for Kids

Design PNGs must be age-appropriate. Canvas sizes:
- Front: 1500x1800 @150dpi (PF#9)
- Back: 1500x1500 @150dpi (PF#57)

**Kids branding approach:**
- Use SKAPARA gradient S mark (colorful, not monochrome)
- Integrate brand into design naturally (not separate corporate feel)
- Bold, playful typography if text is used
- Back placement: SKAPARA wordmark white, centered, ~30% of canvas width

### Step 2: Upload Designs to File Library

Upload to Supabase Storage first (for permanent hosting), then POST the public URL to Printful.

```bash
# Upload to Supabase Storage
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
  -d '{
    "url": "'${PUBLIC_URL}'",
    "filename": "'${FILENAME}'"
  }'
```

Save the `result.id` — this is the `file_id` for product creation.

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "sync_product": {
      "name": "Product Name — Kids Hoodie",
      "thumbnail": "https://..."
    },
    "sync_variants": [
      {
        "variant_id": CATALOG_VARIANT_ID,
        "retail_price": "39.99",
        "files": [
          { "type": "front", "id": FRONT_FILE_ID },
          { "type": "back", "id": BACK_FILE_ID }
        ]
      }
    ]
  }'
```

See [VARIANTS.md](VARIANTS.md) for all variant IDs by color x size.

### Step 4: Set Variant Prices

| Size | Retail Price (EUR) | Base + Placements | Margin |
|---|---|---|---|
| 4Y-8Y | 39.99 | 24.95 + 10.50 = 35.45 | ~11.3% |
| 10Y-12Y | 42.99 | 26.65 + 10.50 = 37.15 | ~13.6% |

**NOTE:** Kids products have thinner margins due to high base costs. Consider single-placement (front only) for better margins:

| Size | Retail (front only) | Base + Front | Margin |
|---|---|---|---|
| 4Y-8Y | 34.99 | 24.95 + 5.25 = 30.20 | ~13.7% |
| 10Y-12Y | 37.99 | 26.65 + 5.25 = 31.90 | ~16.0% |

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%. Kids hoodies with 2 placements will likely be flagged — adjust `printify-sync.ts` margin threshold or use single placement.

### Step 5: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/483" \
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
      { "placement": "front", "image_url": "DESIGN_URL", "position": { "area_width": 1500, "area_height": 1800, "width": 1500, "height": 1800, "top": 0, "left": 0 } },
      { "placement": "back", "image_url": "BACK_URL", "position": { "area_width": 1500, "area_height": 1500, "width": 1500, "height": 1500, "top": 0, "left": 0 } }
    ]
  }'
```

### Step 6: Download Mockups & Upload to Supabase Storage

Mockup S3 URLs expire in ~24h. Always download and re-upload to permanent storage:

```javascript
const storagePath = `designs/mockups/${productSlug}/${colorSlug}-${placement}.png`
const ts = Math.floor(Date.now() / 1000)
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`
```

### Step 7: Update Supabase products Table

```javascript
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative description for kids hoodie. Fun, warm, eco-friendly.',
  translations: {
    es: { title: 'Nombre', description: 'Descripcion creativa kids...' },
    de: { title: 'Name', description: 'Kreative Beschreibung kids...' }
  },
  category_id: 'KIDS_CATEGORY_UUID',
  pod_provider: 'printful',
  product_template_id: '483',
  provider_product_id: String(pfProductId),
  base_price_cents: 3999,
  compare_at_price_cents: 4499,
  images: [
    { src: '.../black-front.png?v=ts', alt: 'Title - Black' },
    { src: '.../burnt-orange-front.png?v=ts', alt: 'Title - Burnt Orange' },
    { src: '.../french-navy-front.png?v=ts', alt: 'Title - French Navy' },
    { src: '.../black-back.png?v=ts', alt: 'Title - Black - Back' },
  ],
  product_details: {
    safety_information: GPSR_HTML,
    material: 'Organic cotton blend',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    blank: "SOL'S 03576 Stellar Kids Eco Hoodie",
    fit: 'Kids regular',
    age_range: '4-12 years'
  },
  status: 'active'
})
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>
<p><strong>Material:</strong> Organic cotton blend (SOL'S 03576)</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
<p><strong>Age range:</strong> 4-12 years</p>
```

Store in `products.product_details.safety_information` (JSONB).

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Kids sizing | Sizes are 4Y-12Y, not S-XL | Map correctly in variant creation |
| Thin margins | 2-placement kids hoodies have <15% margin | Consider front-only or higher retail |
| Margin fixer | Cron sync overwrites if margin <35% | These products will be flagged — adjust threshold or price |
| Burnt Orange | Light-ish color (L~58) — white text may have low contrast | Test contrast; consider dark-ink designs for Burnt Orange |
| Canvas differs from adult | Front=1500x1800, Back=1500x1500 (smaller than adult 1800x2400) | Do NOT reuse adult design files directly |
| No sleeve placement | Kids hoodie has no sleeve print option | All branding must go on front/back |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Cache-busting | Browser/CDN cache images by URL | ALWAYS append `?v=timestamp` when overwriting |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (kids)
- [ ] All 3 colors show in ProductCard color toggles
- [ ] Kids sizes correctly parsed (4Y, 6Y, 8Y, 10Y, 12Y)
- [ ] Price is correct per size tier
- [ ] Mockup images load for front and back
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean, age-appropriate
- [ ] Alt text follows pattern: "Title - Color", "Title - Color - Back"
- [ ] Images ordered: all fronts first, then backs
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
- [ ] Burnt Orange tested for design contrast
