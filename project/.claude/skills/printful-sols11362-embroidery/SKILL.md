---
name: Printful SOL'S 11362 Polo Embroidery
description: >-
  Complete pipeline for SOL'S 11362 Polo (catalog 810) EMBROIDERED products on Printful.
  7 colors (Black, Grey Melange, Mouse Grey, Navy, Red, Sand, White), 8 sizes (S-5XL), 50 variants.
  Covers embroidery product creation with chest_left and sleeve placements, thread color selection,
  variant management, mockup generation, and Supabase integration. Use when creating embroidered
  polo products. Classic polo with button placket, thick soft fabric.
  EU Latvia fulfillment. Embroidery is the default technique for this product.
---

# Printful SOL'S 11362 Polo — Embroidery Pipeline

Full production pipeline for SKAPARA embroidered polos using the SOL'S 11362 blank on Printful. Classic polo with button placket and thick soft fabric. Embroidery is the **default and recommended technique** for polos — gives the premium, professional look expected from polo branding.

---

## Product Overview

| Spec | Value |
|---|---|
| **Modelo** | SOL'S 11362 Polo |
| **Catalog ID** | 810 |
| **Technique** | EMBROIDERY (default for this product) |
| **Material** | Thick soft cotton blend, button placket |
| **Fit** | Classic polo fit |
| **Sizes** | S, M, L, XL, 2XL, 3XL, 4XL, 5XL (8 sizes) |
| **Colors** | 7: Black, Grey Melange, Mouse Grey, Navy, Red, Sand, White |
| **Total Variants** | 50 (7 colors x 8 sizes = 56 catalog, 50 enabled) |
| **EU Fulfillment** | Latvia (EU_LV) |
| **Base cost** | 16.99 EUR (S-XL), 17.99 EUR (2XL-5XL) |
| **Embroidery cost** | +2.60 EUR per placement |

---

## Instructions

### Why Embroidery for Polos

Polos are traditionally embroidered — it is the expected premium technique. The SOL'S 11362 also supports DTFilm, but embroidery is the **default** and gives the classic polo look:
- Professional/corporate branding
- Raised texture = premium feel
- Durable — outlasts the garment
- Classic chest-left logo placement

### Pre-requisites

1. Printful account with API token and Store ID
2. Supabase with tables `products` and `product_variants`
3. Embroidery designs in PNG @300dpi
4. Designs must respect thread color limits

### Available Placements

| Placement | Printfile | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `embroidery_chest_left` | PF#136 | 1200 x 1200 | 300 | +2.60 EUR | **Primary — S mark or SKAPARA logo** |
| `embroidery_sleeve_left_top` | PF#396 | 600 x 900 | 300 | +2.60 EUR | Sleeve branding — S mark mini |
| `embroidery_sleeve_right_top` | PF#396 | 600 x 900 | 300 | +2.60 EUR | Optional sleeve |

**Back embroidery printfile exists (PF#222, 3000x1800 @300dpi)** in the catalog data but is not listed as an available placement for embroidery. The back may be DTFilm-only.

**BRANDING:**
- `embroidery_chest_left`: SKAPARA S mark (1200x1200 @300dpi) — primary branding
- `embroidery_sleeve_left_top`: Mini S mark (600x900 @300dpi) — optional secondary
- `embroidery_sleeve_right_top`: Unused by default

**Recommended configuration:** Chest left only (1 placement) for classic polo look. Add sleeve for premium tier.

### Pipeline

#### Step 1: Design Embroidery

| Placement | Canvas | DPI | Design Type |
|---|---|---|---|
| `embroidery_chest_left` | 1200x1200 | 300 | S mark / SKAPARA logo |
| `embroidery_sleeve_left_top` | 600x900 | 300 | Mini S mark (optional) |

**Design guidelines for polo:**
- Clean, minimal design (1-3 thread colors)
- S mark in single color (white on dark, black on light)
- Professional appearance — avoid complex/busy designs
- Min line width 1.5mm, min text height 5mm

#### Step 2: Render PNG @300dpi

```bash
# Chest
magick -density 300 -background transparent chest-design.svg -resize 1200x1200! chest.png
# Sleeve (optional)
magick -density 300 -background transparent sleeve-design.svg -resize 600x900! sleeve.png
```

#### Step 3: Upload to Supabase Storage

```javascript
await supabase.storage.from('designs').upload(
  'embroidery-sources/polo/chest_left.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/polo/chest_left.png`;
```

#### Step 4: Upload to Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({ url: publicUrl, filename: 'polo-embroidery-chest.png' }),
});
const chestFileId = result.result.id;
```

**Rate limit:** `delay(3000)` between uploads.

#### Step 5: Create Sync Product

**With chest only (1 placement):**

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — Polo',
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

**With chest + sleeve (2 placements):**

```javascript
files: [
  { type: 'embroidery_chest_left', id: chestFileId },
  { type: 'embroidery_sleeve_left_top', id: sleeveFileId },
],
options: [
  { id: 'thread_colors_chest_left', value: ['#FFFFFF'] },
  { id: 'thread_colors_sleeve_left_top', value: ['#FFFFFF'] },
],
```

**Thread colors format:** `thread_colors_<placement_without_embroidery_>`:
- `thread_colors_chest_left` (NOT `thread_colors_embroidery_chest_left`)
- `thread_colors_sleeve_left_top` (NOT `thread_colors_embroidery_sleeve_left_top`)

See [VARIANTS.md](VARIANTS.md) for variant_ids.

#### Step 6: Create Product in Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Classic embroidered polo. Thick soft fabric, SKAPARA crafted.',
  category: 'polos',
  base_price_cents: 2999,
  compare_at_price_cents: 3499,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '810',
  category_id: 'POLO_CATEGORY_UUID',
  translations: {
    es: { title: 'Nombre', description: 'Polo clasico bordado SKAPARA...' },
    de: { title: 'Name', description: 'Klassisches besticktes Polo SKAPARA...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: "SOL'S 11362 Polo",
    material: 'Thick soft cotton blend, button placket',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p><p><strong>Material:</strong> Cotton blend polo with button placket</p><p><strong>Technique:</strong> Embroidery</p><p><strong>Care:</strong> Machine wash cold. Do not iron on embroidery.</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>',
    care_instructions: 'Machine wash cold. Do not iron on embroidery. Tumble dry low.',
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
curl -X POST "https://api.printful.com/mockup-generator/create-task/810" \
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
    { src: '.../grey-melange-front.png', alt: 'Title - Grey Melange' },
    { src: '.../mouse-grey-front.png', alt: 'Title - Mouse Grey' },
    { src: '.../navy-front.png', alt: 'Title - Navy' },
    { src: '.../red-front.png', alt: 'Title - Red' },
    { src: '.../sand-front.png', alt: 'Title - Sand' },
    { src: '.../white-front.png', alt: 'Title - White' },
  ],
}).eq('id', productId);
```

---

## Thread Colors

### Recommended for Polo (Professional Look)

| Garment | Primary Thread | Notes |
|---|---|---|
| Black | White (#FFFFFF) | Classic |
| Grey Melange | Black (#000000) | High contrast |
| Mouse Grey | White (#FFFFFF) or Black (#000000) | Either works |
| Navy | White (#FFFFFF) | White on dark — classic polo look |
| Red | White (#FFFFFF) | White/light preferred for readability |
| Sand | Black (#000000) | Dark thread on light warm fabric |
| White | Black (#000000) | Dark/black designs only — no white-on-white |

**Keep it simple:** 1 thread color on polos. The professional aesthetic demands clean minimalism. S mark in a single contrasting color.

### Full 15-Color Palette

Same standard palette as other embroidery products. See Embroidery Shared Specs in API-VERIFIED-CATALOG.md.

---

## Pricing Breakdown

### With 1 placement (chest_left — RECOMMENDED):

| Size | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| S-XL | 16.99 | 2.60 | 19.59 | 29.99 | 34.7% |
| 2XL-5XL | 17.99 | 2.60 | 20.59 | 32.99 | 37.6% |

### With 2 placements (chest_left + sleeve_left):

| Size | Base | 2x Emb | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| S-XL | 16.99 | 5.20 | 22.19 | 34.99 | 36.6% |
| 2XL-5XL | 17.99 | 5.20 | 23.19 | 37.99 | 39.0% |

**Excellent margins!** Both 1-placement and 2-placement configurations meet or approach the 35% threshold. Low base cost makes this one of the best-margin products.

### Premium pricing (if desired):

| Size | Total (1 placement) | Retail | Margin |
|---|---|---|---|
| S-XL | 19.59 | 34.99 | 44.0% |
| 2XL-5XL | 20.59 | 37.99 | 45.8% |

---

## Known Issues

1. **Embroidery is default technique**: The product type is listed as "DTFILM" in the API but embroidery is the traditional and recommended approach for polos.
2. **Wide size range**: S-5XL (8 sizes) means more variants. Plan accordingly.
3. **Grey Melange**: Heathered fabric — embroidery may interact with texture. Test mockup.
4. **Mouse Grey**: Similar to Grey Melange — verify they are visually distinct in mockups.
4b. **Navy**: Dark garment — use white thread, same treatment as Black.
4c. **Red**: Medium-dark garment — white thread preferred for readability.
4d. **Sand**: Light warm garment — use dark/black thread.
4e. **White**: Light garment — dark/black thread ONLY, no white-on-white.
5. **Printful does NOT accept data URLs**: Upload to Supabase Storage first.
6. **thread_colors obligatorio**: Always specify to match design.
7. **thread_colors ID format**: `thread_colors_chest_left`, `thread_colors_sleeve_left_top` (NO `embroidery_` prefix).
8. **product_variants.title NOT NULL**: Required in Supabase.
9. **DTFilm alternative**: If full-color chest design is needed, DTFilm at +0.99 EUR (chest_left_dtf) is available. But embroidery is preferred for SKAPARA branding.
10. **PF#222 back printfile**: Listed (3000x1800 @300dpi) but may be DTFilm-only, not available for embroidery placement.

---

## Post-Creation Checklist

- [ ] Product in shop with correct category (polos)
- [ ] All enabled colors in ProductCard color toggles
- [ ] Sizes parsed correctly (S through 5XL — 8 sizes)
- [ ] Price correct per size tier (S-XL / 2XL-5XL)
- [ ] Mockup with visible chest embroidery
- [ ] GPSR in `product_details`
- [ ] Thread colors: professional single-color look
- [ ] Description mentions: classic polo, thick fabric, embroidered
- [ ] Alt text: "Title - Color"
- [ ] Cache-buster `?v=timestamp`
- [ ] Grey Melange and Mouse Grey visually distinct in mockups
- [ ] Navy, Red, Sand, White mockups with correct thread contrast
- [ ] All 7 colors present in ProductCard color toggles
