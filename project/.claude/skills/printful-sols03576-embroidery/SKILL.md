---
name: Printful SOL'S 03576 Kids Eco Hoodie Embroidery
description: >-
  Complete pipeline for SOL'S 03576 Stellar Kids Eco Hoodie (catalog 483) EMBROIDERED products on Printful.
  Covers embroidery product creation with chest placements (chest_center/chest_left MUTUALLY EXCLUSIVE),
  thread color selection, variant management, mockup generation, and Supabase integration.
  Use when creating embroidered kids hoodie products. Kids sizes 4Y-12Y, 3 colors,
  EU Latvia fulfillment. Age-appropriate SKAPARA branding via S mark embroidery.
---

# Printful SOL'S 03576 Kids Eco Hoodie — Embroidery Pipeline

Full production pipeline for SKAPARA embroidered kids eco hoodies using the SOL'S 03576 Stellar blank on Printful. Same blank as the DTG version (catalog 483) but with **technique: EMBROIDERY**. Chest embroidery for premium branding on kids apparel.

---

## Product Overview

| Spec | Value |
|---|---|
| **Modelo** | SOL'S 03576 Stellar Kids Eco Hoodie |
| **Catalog ID** | 483 (same as DTG, different technique) |
| **Technique** | EMBROIDERY (not DTG) |
| **Material** | Organic cotton blend |
| **Fit** | Kids regular |
| **Sizes** | 4Y, 6Y, 8Y, 10Y, 12Y (5 kids sizes) |
| **Colors** | Black, Burnt Orange, French Navy (3 colors) |
| **EU Fulfillment** | Latvia (EU_LV) |
| **Base cost** | 24.95 EUR (4Y-8Y), 26.65 EUR (10Y-12Y) |
| **Embroidery cost** | +2.60 EUR per placement |
| **Total cost (1 placement)** | 27.55 EUR (4Y-8Y), 29.25 EUR (10Y-12Y) |

---

## Instructions

### Difference from 03576 DTG (skill `printful-sols03576-dtg`)

This skill uses the SAME blank (03576, catalog 483) but with **technique: EMBROIDERY**. Key differences:

| Aspect | 03576 DTG | 03576 Embroidery |
|---|---|---|
| Technique | DTG printing | EMBROIDERY |
| Placements | front, back | embroidery_chest_center, embroidery_chest_left |
| Design | PNG raster @150dpi | PNG raster @300dpi (digitized) |
| Max design colors | Unlimited | 15 thread colors (or unlimited +3.25 EUR) |
| Canvas | 1500x1800, 1500x1500 | ~3000x1800 (chest_center), ~1200x1200 (chest_left) — VERIFY |
| Use case | Full graphic designs | Logo/brand mark, minimal designs |

### Pre-requisites

1. Printful account with API token and Store ID
2. Supabase with tables `products` and `product_variants`
3. Embroidery designs in PNG @300dpi
4. Designs must respect thread color limits (max 6 colors per design recommended)

### Pipeline

#### Step 1: Design Embroidery (Chest Placement)

**CRITICAL: `embroidery_chest_center` and `embroidery_chest_left` are MUTUALLY EXCLUSIVE.** Cannot use both. Choose ONE.

**Recommended for kids:** `embroidery_chest_left` — small S mark or SKAPARA icon, age-appropriate.

| Placement | Canvas (estimated) | DPI | Printfile | Design Type |
|---|---|---|---|---|
| `embroidery_chest_center` | 3000x1800 px | 300 | PF#222 (standard) | Centered brand mark |
| `embroidery_chest_left` | 1200x1200 px | 300 | PF#136 (standard) | Small S mark / icon |

> **VERIFY BEFORE FIRST USE:** Canvas dimensions are estimated based on standard Printful embroidery printfiles (PF#222 for chest_center, PF#136 for chest_left). The kids hoodie may use smaller canvases. Query the API before first product creation:
> ```
> GET /v2/catalog-products/483/catalog-printfiles?technique=EMBROIDERY
> ```

**Kids branding approach:**
- Use SKAPARA S mark in 1-2 thread colors
- Keep it simple: kids embroidery should be clean and bold
- Avoid fine detail (min 1.5mm lines, min 5mm text)
- Consider fun color thread combinations (e.g., gradient S mark using unlimited_color)

#### Step 2: Render PNG @300dpi

```bash
# For chest_center (estimated 3000x1800 — VERIFY WITH API before first use)
magick -density 300 -background transparent design-chest-center.svg -resize 3000x1800! design-chest-center.png

# For chest_left (estimated 1200x1200 — VERIFY WITH API before first use)
magick -density 300 -background transparent design-chest-left.svg -resize 1200x1200! design-chest-left.png
```

#### Step 3: Upload to Supabase Storage (Public URL)

**Printful does NOT accept data URLs or base64.** Must use a public URL.

```javascript
await supabase.storage.from('designs').upload(
  'embroidery-sources/kids-hoodie/chest.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/kids-hoodie/chest.png`;
```

#### Step 4: Upload to Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({ url: publicUrl, filename: 'kids-hoodie-embroidery-chest.png' }),
});
const fileId = result.result.id;
```

**Rate limit:** `delay(3000)` between uploads.

#### Step 5: Create Sync Product

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — Kids Eco Hoodie',
      thumbnail: publicUrl,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: PRICES[v.size],
      is_enabled: true,
      files: [
        { type: 'embroidery_chest_left', id: chestFileId },
      ],
      options: [
        { id: 'thread_colors_chest_left', value: ['#000000', '#FFFFFF'] },
      ],
    })),
  }),
});
```

**Thread colors format:** `thread_colors_<placement_without_embroidery_prefix>`:
- `thread_colors_chest_left` (NOT `thread_colors_embroidery_chest_left`)
- `thread_colors_chest_center` (NOT `thread_colors_embroidery_chest_center`)

See [VARIANTS.md](VARIANTS.md) for variant_ids.

#### Step 6: GPSR — Supabase product_details

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Premium embroidered kids hoodie. Organic cotton, SKAPARA crafted.',
  category: 'kids',
  base_price_cents: 3999,
  compare_at_price_cents: 4499,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '483',
  category_id: 'KIDS_CATEGORY_UUID',
  translations: {
    es: { title: 'Nombre', description: 'Sudadera kids bordada premium...' },
    de: { title: 'Name', description: 'Premium bestickte Kinder-Hoodie...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: "SOL'S 03576 Stellar Kids Eco Hoodie",
    material: 'Organic cotton blend',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p><p><strong>Material:</strong> Organic cotton blend</p><p><strong>Technique:</strong> Embroidery</p><p><strong>Age range:</strong> 4-12 years</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>',
    age_range: '4-12 years',
  },
});
```

#### Step 7: Create Variants in Supabase

```javascript
variants.push({
  product_id: PRODUCT_UUID,
  title: `Product Name / ${color} / ${size}`,
  color,
  size,
  price_cents: PRICES_CENTS[size],
  is_enabled: true,
  is_available: true,
  external_variant_id: String(VARIANT_IDS[color][size]),
});
```

#### Step 8: Generate Mockups

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
    "options": ["Front"],
    "files": [
      { "placement": "embroidery_chest_left", "image_url": "DESIGN_URL", "position": { ... } }
    ]
  }'
```

#### Step 9: Update Images in Supabase

Alt text uses **hyphen** (`-`), required by `buildImageMap()` in the API.

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../black-front.png', alt: 'Title - Black' },
    { src: '.../burnt-orange-front.png', alt: 'Title - Burnt Orange' },
    { src: '.../french-navy-front.png', alt: 'Title - French Navy' },
  ],
}).eq('id', productId);
```

---

## Thread Colors

### Standard 15-Color Palette

Available for all embroidery placements:

| Color | Hex | Good for |
|---|---|---|
| White | #FFFFFF | On Black, Navy |
| Black | #000000 | On Burnt Orange |
| Silver Grey | #999999 | Subtle accents |
| Gold | #FFD700 | Premium accents |
| Red | #CC3333 | Bold accents |
| Navy | #1E3A5F | Classic |
| Royal Blue | #4169E1 | Bright accents |
| Forest Green | #228B22 | Nature themes |
| Burgundy | #800020 | Premium |
| Orange | #FF6600 | Kids-friendly |
| Purple | #6B5294 | SKAPARA brand |
| Pink | #FF69B4 | Kids designs |
| Brown | #8B4513 | Earth tones |
| Cream | #FFFDD0 | Soft accents |
| Sky Blue | #87CEEB | Kids-friendly |

### Unlimited Color Option

- +3.25 EUR per placement for `embroidery_chest_center` and `embroidery_chest_left`
- CMYK polyester thread — gradients possible
- Recommended for: SKAPARA gradient S mark on kids

---

## Pricing Breakdown (1 placement)

| Size | Base | 1x Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| 4Y-8Y | 24.95 | 2.60 | 27.55 | 39.99 | 31.1% |
| 10Y-12Y | 26.65 | 2.60 | 29.25 | 42.99 | 32.0% |

**With unlimited_color (+3.25):**

| Size | Total Cost | Retail | Margin |
|---|---|---|---|
| 4Y-8Y | 30.80 | 42.99 | 28.3% |
| 10Y-12Y | 32.50 | 44.99 | 27.8% |

---

## Known Issues

1. **chest_center / chest_left MUTUALLY EXCLUSIVE**: Printful rejects products using both.
2. **Printful does NOT accept data URLs**: Always upload to Supabase Storage first.
3. **GPSR endpoint may 404 for embroidery**: Handle GPSR in Supabase `product_details.safety_information`.
4. **thread_colors obligatorio**: Without specifying, Printful uses defaults that may not match design.
5. **thread_colors ID format**: Does NOT carry `embroidery_` prefix. Correct: `thread_colors_chest_left`.
6. **product_variants.title NOT NULL**: Supabase requires `title` field.
7. **Same catalog_id as DTG**: Both share catalog 483. Difference is in `file.type` used.
8. **Kids sizing**: Sizes are 4Y-12Y, not standard S-XL.
9. **Burnt Orange contrast**: Light-ish color — choose thread colors with sufficient contrast.
10. **Canvas dimensions ESTIMATED**: `embroidery_chest_center` (~3000x1800 PF#222) and `embroidery_chest_left` (~1200x1200 PF#136) are estimates based on standard Printful embroidery printfiles. Kids hoodie may use smaller canvases. MUST verify via `GET /v2/catalog-products/483/catalog-printfiles?technique=EMBROIDERY` before first product creation.

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (kids)
- [ ] All 3 colors show in ProductCard color toggles
- [ ] Kids sizes parsed correctly (4Y, 6Y, 8Y, 10Y, 12Y)
- [ ] Price correct per size tier
- [ ] Mockup images load (front view with embroidery visible)
- [ ] GPSR safety information in `product_details` with age_range
- [ ] Thread colors specified match design intent
- [ ] Description age-appropriate, mentions embroidery quality
- [ ] Alt text: "Title - Color" pattern with hyphens
- [ ] Cache-buster `?v=timestamp` on all image URLs
