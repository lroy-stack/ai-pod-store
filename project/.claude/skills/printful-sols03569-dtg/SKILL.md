---
name: Printful SOL'S 03569 Organic Apron DTG
description: >-
  Complete pipeline for SOL'S 03569 Organic Apron (catalog 565) DTG products on Printful.
  Covers product creation, variant management, front-only design placement, mockup generation,
  and Supabase integration. Use when creating DTG apron products, generating mockups,
  or managing organic apron products. 4 colors, one size, EU Latvia fulfillment.
  Single placement only (front).
---

# Printful SOL'S 03569 Organic Apron — DTG Pipeline

Full production pipeline for SKAPARA organic aprons using the SOL'S 03569 blank on Printful. Single-placement DTG product with a large square front canvas. Available in 4 colors, one size fits all.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03569 Organic Apron |
| **Catalog ID** | 565 |
| **Technique** | DTG (Direct-to-Garment) |
| **Material** | Organic cotton |
| **Fit** | One size |
| **Sizes** | One size (single) |
| **Colors** | Black, Navy, Red, Rope (4 colors) |
| **Print Method** | DTG |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES — Latvia |

---

## When to Use

- Create a new SKAPARA organic apron product on Printful
- Upload designs for the single front placement
- Generate mockups for apron products
- Update Supabase with apron product data
- Manage 03569 apron variant colors

---

## Placements & Canvas Sizes

Single DTG placement at 150 DPI:

| Placement | Printfile | Canvas (px) | Extra Cost | Notes |
|---|---|---|---|---|
| `front` | PF#235 | 1800 x 1800 | +5.25 EUR | Main and ONLY placement |

**BRANDING for Aprons:**
- Front-only product — integrate SKAPARA brand INTO the design
- Options: SKAPARA wordmark as part of design composition, S mark watermark, or subtle brand integration
- No separate back/sleeve/label placements available
- Design should be square (1800x1800) — centered on the apron bib area

**IMPORTANT:** This is a single-placement product. ALL branding must be incorporated into the front design itself. There is no separate back or label option.

---

## Base Costs (Production)

| Size | Base Cost (EUR) |
|---|---|
| One size | 20.95 |

**Total with front placement:**
- 1 placement: +5.25 EUR
- Total cost: 26.20 EUR

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
| `/mockup-generator/create-task/565` | POST | Create mockup task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |

---

## Workflow: Create New Organic Apron Product

### Step 1: Design for Apron

Design PNG at 150dpi, 1800x1800 (PF#235). Square canvas.

**Design considerations:**
- Square format — center the main design element
- Incorporate SKAPARA branding naturally (e.g., small wordmark at bottom, S mark integrated)
- Consider the apron context: cooking, grilling, kitchen, craft, BBQ themes
- Use white/light design on dark apron colors (Black, Navy)
- For Red and Rope (lighter colors) — consider dark-ink designs

### Step 2: Upload Design to File Library

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
      "name": "Product Name — Organic Apron",
      "thumbnail": "https://..."
    },
    "sync_variants": [
      {
        "variant_id": CATALOG_VARIANT_ID,
        "retail_price": "34.99",
        "files": [
          { "type": "front", "id": FRONT_FILE_ID }
        ]
      }
    ]
  }'
```

See [VARIANTS.md](VARIANTS.md) for all variant IDs.

### Step 4: Set Variant Prices

| Size | Retail (EUR) | Cost (base + front) | Margin |
|---|---|---|---|
| One size | 34.99 | 26.20 | ~25.1% |

**Better margin option:**

| Size | Retail (EUR) | Cost | Margin |
|---|---|---|---|
| One size | 39.99 | 26.20 | ~34.5% |
| One size | 42.99 | 26.20 | ~39.1% |

**CRITICAL:** At 34.99 retail, margin is 25.1% — below the 35% threshold. Recommend 39.99-42.99 for safe margin.

### Step 5: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/565" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "variant_ids": [VARIANT_ID],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front"],
    "files": [
      { "placement": "front", "image_url": "DESIGN_URL", "position": { "area_width": 1800, "area_height": 1800, "width": 1800, "height": 1800, "top": 0, "left": 0 } }
    ]
  }'
```

### Step 6: Download Mockups & Upload to Supabase Storage

Mockup S3 URLs expire ~24h. Download and re-upload with `?v=timestamp`.

### Step 7: Update Supabase products Table

```javascript
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative description. Organic cotton apron, perfect for the kitchen.',
  translations: {
    es: { title: 'Nombre', description: 'Delantal organico...' },
    de: { title: 'Name', description: 'Bio-Baumwoll Schuerze...' }
  },
  category_id: 'ACCESSORIES_CATEGORY_UUID',
  pod_provider: 'printful',
  product_template_id: '565',
  provider_product_id: String(pfProductId),
  base_price_cents: 3999,
  compare_at_price_cents: 4499,
  images: [
    { src: '.../black-front.png?v=ts', alt: 'Title - Black' },
    { src: '.../navy-front.png?v=ts', alt: 'Title - Navy' },
    { src: '.../red-front.png?v=ts', alt: 'Title - Red' },
    { src: '.../rope-front.png?v=ts', alt: 'Title - Rope' },
  ],
  product_details: {
    safety_information: GPSR_HTML,
    material: 'Organic cotton',
    care_instructions: 'Machine wash cold. Tumble dry low. Do not bleach.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    blank: "SOL'S 03569 Organic Apron",
    fit: 'One size'
  },
  status: 'active'
})
```

### Step 8: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>
<p><strong>Material:</strong> Organic cotton (SOL'S 03569)</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold. Tumble dry low. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Single placement only | No back, sleeve, or label options | All branding in front design |
| Square canvas | 1800x1800 — different from typical apparel | Design specifically for square format |
| Rope color | Light/natural tone — white text will not work | Use dark-ink design for Rope |
| Red color | Medium-light — test white text contrast | May need dark or colorful designs |
| One size only | No size variants | Single variant per color |
| Low variant count | Only 4 variants total | Good for niche/specialty products |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (accessories/kitchen)
- [ ] All 4 colors show in ProductCard color toggles
- [ ] Size shows as "One size"
- [ ] Price is correct (single tier)
- [ ] Mockup images load for front view
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean, mentions apron use case
- [ ] Brand is integrated into the front design
- [ ] Alt text follows pattern: "Title - Color"
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
- [ ] Rope and Red tested for design contrast with chosen colors
