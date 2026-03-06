---
name: Printful SOL'S 32000 Unisex Windbreaker Embroidery
description: >-
  Complete pipeline for SOL'S 32000 Unisex Windbreaker (catalog 661) EMBROIDERY ONLY products on Printful.
  No DTG possible on polyester shell. Covers embroidery product creation with chest_left placement,
  thread color selection, variant management, mockup generation, and Supabase integration.
  Use when creating embroidered windbreaker products. Water-repellent, sporty, lightweight.
  3 colors, S-2XL, EU Latvia fulfillment.
---

# Printful SOL'S 32000 Unisex Windbreaker — Embroidery Pipeline

Full production pipeline for SKAPARA embroidered windbreakers using the SOL'S 32000 blank on Printful. **EMBROIDERY ONLY** product — no DTG possible on polyester shell. Water-repellent, lightweight, sporty jacket with left chest embroidery.

---

## Product Overview

| Spec | Value |
|---|---|
| **Modelo** | SOL'S 32000 Unisex Windbreaker |
| **Catalog ID** | 661 |
| **Technique** | EMBROIDERY ONLY (no DTG — polyester shell) |
| **Material** | 100% polyester, water-repellent |
| **Fit** | Unisex regular, sporty |
| **Sizes** | S, M, L, XL, 2XL (5 sizes) |
| **Colors** | Black, Forest Green, Navy (3 colors) |
| **EU Fulfillment** | Latvia (EU_LV) |
| **Base cost** | 17.95 EUR (S-XL), 19.25 EUR (2XL) |
| **Embroidery cost** | +2.60 EUR per placement |
| **Total cost (1 placement)** | 20.55 EUR (S-XL), 21.85 EUR (2XL) |

---

## Instructions

### Why Embroidery Only

The SOL'S 32000 is a **polyester shell windbreaker**. DTG printing requires cotton-based fabrics for ink absorption. Polyester surfaces reject DTG ink. Therefore:
- **No DTG** available
- **No DTFilm** listed for this product
- **EMBROIDERY is the only option**

This makes the product ideal for clean, minimal branding — S mark or SKAPARA text embroidered on the chest.

### Pre-requisites

1. Printful account with API token and Store ID
2. Supabase with tables `products` and `product_variants`
3. Embroidery design in PNG @300dpi
4. Design must be simple (embroidery on windbreaker nylon is more constrained)

### Available Placements

| Placement | Printfile | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `embroidery_chest_left` | PF#136 | 1200 x 1200 | 300 | +2.60 EUR | **Primary — S mark or SKAPARA text** |

**Back embroidery printfile exists (PF#222, 3000x1800 @300dpi)** but the API only lists `embroidery_chest_left` as an available placement for this product. The back printfile may be for reference/future use.

**BRANDING:**
- `embroidery_chest_left`: SKAPARA S mark (white thread on dark) or "SKAPARA" text embroidery
- Keep it minimal — windbreaker aesthetic is clean and sporty
- 2-3 thread colors maximum
- Consider: S mark in white, or SKAPARA text in white with small accent color

### Pipeline

#### Step 1: Design Embroidery

Single placement: `embroidery_chest_left` (1200x1200 @300dpi, PF#136).

**Design constraints for windbreaker:**
- Polyester nylon surface — embroidery must be well-digitized
- Min line width 1.5mm (important on slippery nylon)
- Min text height 5mm
- Avoid very fine detail — nylon puckers more than cotton
- Bold, clean designs work best
- Max 15 thread colors (6 recommended)

#### Step 2: Render PNG @300dpi

```bash
magick -density 300 -background transparent design.svg -resize 1200x1200! design.png
```

#### Step 3: Upload to Supabase Storage

```javascript
await supabase.storage.from('designs').upload(
  'embroidery-sources/windbreaker/chest_left.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/windbreaker/chest_left.png`;
```

#### Step 4: Upload to Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({ url: publicUrl, filename: 'windbreaker-embroidery-chest.png' }),
});
const fileId = result.result.id;
```

#### Step 5: Create Sync Product

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — Windbreaker',
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
        { id: 'thread_colors_chest_left', value: ['#FFFFFF'] },
      ],
    })),
  }),
});
```

**Thread colors format:** `thread_colors_chest_left` (NO `embroidery_` prefix).

See [VARIANTS.md](VARIANTS.md) for variant_ids.

#### Step 6: Create Product in Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Lightweight windbreaker with embroidered SKAPARA mark. Water-repellent, sporty.',
  category: 'outerwear',
  base_price_cents: 3499,
  compare_at_price_cents: 3999,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '661',
  category_id: 'OUTERWEAR_CATEGORY_UUID',
  translations: {
    es: { title: 'Nombre', description: 'Cortavientos ligero con bordado SKAPARA...' },
    de: { title: 'Name', description: 'Leichte Windbreaker mit SKAPARA Stickerei...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: "SOL'S 32000 Unisex Windbreaker",
    material: '100% polyester, water-repellent',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p><p><strong>Material:</strong> 100% polyester, water-repellent</p><p><strong>Technique:</strong> Embroidery</p><p><strong>Care:</strong> Machine wash cold. Do not iron on embroidery. Do not tumble dry.</p><p><strong>Compliance:</strong> REACH</p>',
    care_instructions: 'Machine wash cold. Do not iron on embroidery. Do not tumble dry.',
    features: 'Water-repellent, lightweight, sporty',
  },
});
```

#### Step 7: Create Variants in Supabase

```javascript
for (const { color, size, variantId } of allVariants) {
  await supabase.from('product_variants').insert({
    product_id: PRODUCT_UUID,
    title: `Product Name / ${color} / ${size}`,
    color,
    size,
    price_cents: PRICES_CENTS[size],
    is_enabled: true,
    is_available: true,
    external_variant_id: String(variantId),
  });
}
```

#### Step 8: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/661" \
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
      { "placement": "embroidery_chest_left", "image_url": "DESIGN_URL", "position": { "area_width": 1200, "area_height": 1200, "width": 1200, "height": 1200, "top": 0, "left": 0 } }
    ]
  }'
```

#### Step 9: Update Images in Supabase

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../black-front.png', alt: 'Title - Black' },
    { src: '.../forest-green-front.png', alt: 'Title - Forest Green' },
    { src: '.../navy-front.png', alt: 'Title - Navy' },
  ],
}).eq('id', productId);
```

---

## Thread Colors

### Recommended for Windbreaker (Clean Sporty Look)

| Garment | Primary Thread | Accent Thread |
|---|---|---|
| Black | White (#FFFFFF) | — |
| Forest Green | White (#FFFFFF) | — |
| Navy | White (#FFFFFF) | Gold (#FFD700) |

**Keep it simple:** 1-2 thread colors on windbreaker. The sporty aesthetic demands minimalism.

### Full 15-Color Palette

Same standard palette as other embroidery products. See Embroidery Shared Specs in API-VERIFIED-CATALOG.md.

---

## Pricing Breakdown (1 placement)

| Size | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| S | 17.95 | 2.60 | 20.55 | 34.99 | 41.3% |
| M | 17.95 | 2.60 | 20.55 | 34.99 | 41.3% |
| L | 17.95 | 2.60 | 20.55 | 34.99 | 41.3% |
| XL | 17.95 | 2.60 | 20.55 | 34.99 | 41.3% |
| 2XL | 19.25 | 2.60 | 21.85 | 37.99 | 42.5% |

**Excellent margins!** This is one of the best-margin products in the catalog. Low base cost + single embroidery placement = healthy 41%+ margin.

---

## Known Issues

1. **EMBROIDERY ONLY**: No DTG, no DTFilm on polyester windbreaker. Only embroidery.
2. **Single placement**: Only `embroidery_chest_left` available.
3. **Nylon puckering**: Polyester nylon can pucker around embroidery. Use well-digitized designs with appropriate underlay.
4. **Printful does NOT accept data URLs**: Upload to Supabase Storage first.
5. **thread_colors obligatorio**: Always specify to match design.
6. **thread_colors ID format**: `thread_colors_chest_left` (NO `embroidery_` prefix).
7. **product_variants.title NOT NULL**: Required in Supabase.
8. **Water-repellent care**: Special care instructions — do not tumble dry, do not iron on embroidery.
9. **PF#222 back printfile**: Listed in catalog but not as available placement. May be for future use or other techniques.

---

## Post-Creation Checklist

- [ ] Product in shop with correct category (outerwear/jackets)
- [ ] All 3 colors in ProductCard color toggles
- [ ] Sizes correctly parsed (S, M, L, XL, 2XL)
- [ ] Price correct per size tier (excellent margins)
- [ ] Mockup with visible chest embroidery
- [ ] GPSR in `product_details` with water-repellent care
- [ ] Thread colors: white on all dark colors
- [ ] Description mentions: water-repellent, lightweight, sporty
- [ ] Alt text: "Title - Color"
- [ ] Cache-buster `?v=timestamp`
