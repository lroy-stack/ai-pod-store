---
name: Printful SOL'S 03569 Organic Apron Embroidery
description: >-
  Complete pipeline for SOL'S 03569 Organic Apron (catalog 565) EMBROIDERED products on Printful.
  Covers embroidery product creation with single chest_center placement, thread color selection,
  variant management, mockup generation, and Supabase integration. Use when creating embroidered
  apron products. Simple single-placement embroidery. 4 colors, one size, EU Latvia fulfillment.
---

# Printful SOL'S 03569 Organic Apron — Embroidery Pipeline

Full production pipeline for SKAPARA embroidered organic aprons using the SOL'S 03569 blank on Printful. Same blank as the DTG version (catalog 565) but with **technique: EMBROIDERY**. Single chest_center placement for clean, minimal branding.

---

## Product Overview

| Spec | Value |
|---|---|
| **Modelo** | SOL'S 03569 Organic Apron |
| **Catalog ID** | 565 (same as DTG, different technique) |
| **Technique** | EMBROIDERY (not DTG) |
| **Material** | Organic cotton |
| **Fit** | One size |
| **Sizes** | One size (single) |
| **Colors** | Black, Navy, Red, Rope (4 colors) |
| **EU Fulfillment** | Latvia (EU_LV) |
| **Base cost** | 20.95 EUR (flat) |
| **Embroidery cost** | +2.60 EUR (1 placement) |
| **Total cost** | 23.55 EUR |

---

## Instructions

### Difference from 03569 DTG (skill `printful-sols03569-dtg`)

| Aspect | 03569 DTG | 03569 Embroidery |
|---|---|---|
| Technique | DTG printing | EMBROIDERY |
| Placement | front (PF#235, 1800x1800) | embroidery_chest_center |
| Design | PNG @150dpi, full graphic | PNG @300dpi, max 15 thread colors |
| Extra cost | +5.25 EUR | +2.60 EUR |
| Total cost | 26.20 EUR | 23.55 EUR |
| Use case | Full graphic designs | Logo/wordmark, minimal branding |

**Embroidery is CHEAPER than DTG on this product** (2.60 vs 5.25 EUR placement cost).

### Pre-requisites

1. Printful account with API token and Store ID
2. Supabase with tables `products` and `product_variants`
3. Embroidery design in PNG @300dpi
4. Design must respect thread color limits

### Pipeline

#### Step 1: Design Embroidery (Single Placement)

Only **one** embroidery placement available: `embroidery_chest_center`.

**Design approach for aprons:**
- SKAPARA wordmark or S mark embroidered on the apron bib
- Keep design simple: 2-3 thread colors maximum
- Consider the apron context: kitchen/cooking/craft branding
- Min line width 1.5mm, min text height 5mm

#### Step 2: Render PNG @300dpi

```bash
magick -density 300 -background transparent design.svg -resize WxH! design.png
```

#### Step 3: Upload to Supabase Storage (Public URL)

**Printful does NOT accept data URLs or base64.** Must use a public URL.

```javascript
await supabase.storage.from('designs').upload(
  'embroidery-sources/apron/chest_center.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/apron/chest_center.png`;
```

#### Step 4: Upload to Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({ url: publicUrl, filename: 'apron-embroidery-chest.png' }),
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
      name: 'Product Name — Organic Apron',
      thumbnail: publicUrl,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: '34.99',
      is_enabled: true,
      files: [
        { type: 'embroidery_chest_center', id: chestFileId },
      ],
      options: [
        { id: 'thread_colors_chest_center', value: ['#FFFFFF', '#000000'] },
      ],
    })),
  }),
});
```

**Thread colors format:** `thread_colors_chest_center` (NO `embroidery_` prefix).

See [VARIANTS.md](VARIANTS.md) for variant_ids.

#### Step 6: Create Product in Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Premium embroidered organic apron. Kitchen-ready, SKAPARA crafted.',
  category: 'accessories',
  base_price_cents: 3499,
  compare_at_price_cents: 3999,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '565',
  category_id: 'ACCESSORIES_CATEGORY_UUID',
  translations: {
    es: { title: 'Nombre', description: 'Delantal organico bordado premium...' },
    de: { title: 'Name', description: 'Premium bestickter Bio-Schuerze...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: "SOL'S 03569 Organic Apron",
    material: 'Organic cotton',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p><p><strong>Material:</strong> Organic cotton</p><p><strong>Technique:</strong> Embroidery</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>',
  },
});
```

#### Step 7: Create Variants in Supabase

```javascript
for (const color of colors) {
  await supabase.from('product_variants').insert({
    product_id: PRODUCT_UUID,
    title: `Product Name / ${color} / One size`,
    color,
    size: 'One size',
    price_cents: 3499,
    is_enabled: true,
    is_available: true,
    external_variant_id: String(VARIANT_IDS[color]),
  });
}
```

#### Step 8: Generate Mockups

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
      { "placement": "embroidery_chest_center", "image_url": "DESIGN_URL", "position": { ... } }
    ]
  }'
```

#### Step 9: Update Images in Supabase

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../black-front.png', alt: 'Title - Black' },
    { src: '.../navy-front.png', alt: 'Title - Navy' },
    { src: '.../red-front.png', alt: 'Title - Red' },
    { src: '.../rope-front.png', alt: 'Title - Rope' },
  ],
}).eq('id', productId);
```

---

## Thread Colors

### Standard 15-Color Palette

| Color | Hex | Good for |
|---|---|---|
| White | #FFFFFF | On Black, Navy |
| Black | #000000 | On Red, Rope |
| Silver Grey | #999999 | Subtle accents |
| Gold | #FFD700 | Premium accents |
| Red | #CC3333 | Bold accents |
| Navy | #1E3A5F | Classic |
| Forest Green | #228B22 | Kitchen/nature |
| Burgundy | #800020 | Premium |
| Brown | #8B4513 | Earth/kitchen |
| Cream | #FFFDD0 | Soft on dark |

### Unlimited Color Option

- +3.25 EUR for `embroidery_chest_center`
- CMYK polyester thread — gradients possible
- Total cost with unlimited: 26.80 EUR

---

## Pricing Breakdown

### Standard embroidery (1 placement, standard threads):

| Size | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| One size | 20.95 | 2.60 | 23.55 | 34.99 | 32.7% |

### Premium pricing (>35% margin):

| Size | Total Cost | Retail | Margin |
|---|---|---|---|
| One size (standard) | 23.55 | 37.99 | 38.0% |
| One size (unlimited) | 26.80 | 42.99 | 37.7% |

---

## Known Issues

1. **Single placement only**: Only `embroidery_chest_center` for embroidery on aprons.
2. **Printful does NOT accept data URLs**: Upload to Supabase Storage first.
3. **thread_colors obligatorio**: Always specify to match design intent.
4. **thread_colors ID format**: `thread_colors_chest_center` (NO `embroidery_` prefix).
5. **product_variants.title NOT NULL**: Required in Supabase.
6. **Same catalog_id as DTG**: Both share catalog 565.
7. **Rope color**: Light/natural — use dark thread colors.
8. **Red color**: Medium tone — test thread visibility.
9. **Embroidery cheaper than DTG**: 2.60 vs 5.25 EUR.

---

## Post-Creation Checklist

- [ ] Product in shop with correct category (accessories)
- [ ] All 4 colors in ProductCard color toggles
- [ ] Size shows as "One size"
- [ ] Price correct (single tier)
- [ ] Mockup with visible embroidery
- [ ] GPSR in `product_details`
- [ ] Thread colors match design
- [ ] Alt text: "Title - Color"
- [ ] Cache-buster `?v=timestamp`
