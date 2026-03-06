---
name: Printful Beechfield B682 Embroidery Corduroy Hat
description: Complete pipeline for Beechfield B682 (catalog 532) embroidered corduroy hat on Printful. Covers embroidery product creation with 4 placements (front, back, left, right), thread color selection, variant management, mockup generation, and Supabase integration. Use when creating embroidered Beechfield B682 corduroy hat products, generating mockups, updating branding, or managing corduroy hat headwear. 4 colors (Black, Camel, Dark Olive, Oxford Navy) — EU Latvia fulfillment. Options: unlimited_color +3.25EUR. Premium corduroy material.
---

# Printful Beechfield B682 Embroidery — Complete Pipeline

## Product Overview

| Spec | Valor |
|---|---|
| **Modelo** | Beechfield B682 Corduroy Hat |
| **Catalog ID** | 532 |
| **Technique** | EMBROIDERY |
| **Material** | 100% cotton corduroy, cotton twill sweatband |
| **Construction** | Soft unstructured crown, curved brim |
| **Tallas** | One size |
| **Colores** | Black, Camel, Dark Olive, Oxford Navy (4 colors) |
| **EU Fulfillment** | Latvia/UK (EU_LV) |
| **Base cost** | 16.95 EUR flat (all colors same price) |
| **Embroidery cost** | +2.95 EUR per placement |
| **Options** | unlimited_color +3.25 EUR (NO 3D puff — unstructured crown) |
| **Retail target** | €34.99 (1-2 placements), €39.99 (3+ placements) |
| **Margin target** | >40% |

## Instructions

### Embroidery Specs — Beechfield B682

- **Thread colors**: 15 standard colors available, max 6 per design
- **Unlimited color**: CMYK polyester thread, gradient-capable (+3.25 EUR per placement)
- **3D Puff**: NOT recommended — soft unstructured crown does not hold 3D puff reliably
- **Min text height**: 5mm / 0.25"
- **Min line width**: 1.5mm
- **File format**: PNG @300dpi preferred
- **Stitch count**: Max ~15,000 stitches standard

### Pre-requisitos

1. Cuenta Printful con API token y Store ID (17795695 — Skapara)
2. Supabase con tablas `products` y `product_variants`
3. Diseños de bordado en formato PNG @300dpi
4. Diseños deben respetar limites de colores de hilo (max 6 standard, or unlimited_color)

### Placements Disponibles

| Placement | Printfile | Canvas (px) | Physical | Price |
|---|---|---|---|---|
| `embroidery_front` | PF#78 | 1200x525 @300dpi | 4.00"x1.75" | +2.95 EUR |
| `embroidery_back` | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |
| `embroidery_left` | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |
| `embroidery_right` | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |

**NOTE:** No `embroidery_front_large` placement on this product — only standard `embroidery_front`.

**NOTE:** Front canvas (PF#78, 1200x525) is SMALLER than Otto Cap (PF#75, 1650x600) and Yupoong (PF#478, 1890x765). Design accordingly.

### Branding Rules — Corduroy Hat

- **Front**: Main design (logo, icon, text) — compact canvas (4.00"x1.75"), keep designs clean
- **Back** (where used): S mark or `skapara.com` — white thread on dark hats (Black, Dark Olive, Oxford Navy), dark thread on light hats (Camel)
- **Left/Right sides** (where used): Mini S mark
- **NEVER copy the front design to other placements** — each position has its own design

### Pipeline Completo — 10 Steps

#### Paso 1: Disenar bordados

Design embroidery files for each placement you plan to use. Recommended config:

**Standard config (2 placements — front + back):**

| Placement | Canvas | Design |
|---|---|---|
| `embroidery_front` | 1200x525 @300dpi | Main design (logo/icon/text) |
| `embroidery_back` | 600x300 @300dpi | S mark or skapara.com |

**Premium config (3-4 placements — front + back + sides):**

| Placement | Canvas | Design |
|---|---|---|
| `embroidery_front` | 1200x525 @300dpi | Main design |
| `embroidery_back` | 600x300 @300dpi | S mark or skapara.com |
| `embroidery_left` | 600x300 @300dpi | Mini S mark |
| `embroidery_right` | 600x300 @300dpi | Mini S mark |

#### Paso 2: Renderizar PNGs @300dpi

```bash
# Front design (smaller canvas than other hats — 4.00"x1.75")
magick -density 300 -background transparent design-front.svg -resize 1200x525! design-front.png

# Back design
magick -density 300 -background transparent design-back.svg -resize 600x300! design-back.png

# Side designs (if used)
magick -density 300 -background transparent design-side.svg -resize 600x300! design-side.png
```

Each PNG must match exactly the canvas dimensions of its placement.

#### Paso 3: Subir PNGs a Supabase Storage (URL publica)

**Printful NO acepta data URLs ni base64.** Necesita una URL publica accesible.

```javascript
await supabase.storage.from('designs').upload(
  'embroidery-sources/b682-product-name/front.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/b682-product-name/front.png`;
```

#### Paso 4: Subir a Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({
    url: publicUrl,
    filename: 'b682-product-embroidery_front.png',
  }),
});
const fileId = result.result.id;
```

**Rate limit:** `delay(3000)` between uploads.

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry with jitter, proactive slowdown, and exponential backoff automatically.

**API Auth headers (ALL calls):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
User-Agent: POD-AI-Store/1.0
X-PF-Store-Id: 17795695          // Skapara store — NEVER 17595620
Content-Type: application/json
```

#### Paso 5: Crear Sync Product en Printful

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — Corduroy Hat',
      thumbnail: publicUrlFront,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: '34.99',
      is_enabled: true,
      files: [
        { type: 'embroidery_front', id: frontFileId },
        { type: 'embroidery_back', id: backFileId },
      ],
      options: [
        { id: 'thread_colors_front', value: ['#FFFFFF', '#000000'] },
        { id: 'thread_colors_back', value: ['#FFFFFF'] },
      ],
    })),
  }),
});
```

See [VARIANTS.md](VARIANTS.md) for the complete variant_ids table.

**Thread colors format:** `thread_colors_<placement_without_embroidery_prefix>`:

```
thread_colors_front        (NOT thread_colors_embroidery_front)
thread_colors_back         (NOT thread_colors_embroidery_back)
thread_colors_left         (NOT thread_colors_embroidery_left)
thread_colors_right        (NOT thread_colors_embroidery_right)
```

**Thread color selection for hat colors:**
- **Dark hats** (Black, Dark Olive, Oxford Navy): WHITE (#FFFFFF) or light threads
- **Light hats** (Camel): BLACK (#000000) or dark threads — corduroy texture adds visual interest

#### Paso 6: GPSR — Supabase product_details

**NOTE:** The GPSR API endpoint (`/store/products/{id}/gpsr.json`) returns 404 for embroidery products. GPSR is managed in Supabase `product_details.safety_information`.

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 100% cotton corduroy, cotton twill sweatband</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

#### Paso 7: Crear producto en Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description EN — premium corduroy hat with embroidered design',
  category: 'caps',
  base_price_cents: 3499,
  compare_at_price_cents: 3999,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '532',
  category_id: '<caps-uuid>',
  translations: {
    es: { title: 'Product Name', description: 'Descripcion creativa ES...' },
    de: { title: 'Product Name', description: 'Kreative Beschreibung DE...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Beechfield B682',
    material: '100% cotton corduroy',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '...GPSR HTML from Paso 6...',
  },
});
```

#### Paso 8: Crear variantes en Supabase

**IMPORTANT:** La tabla `product_variants` requiere campo `title` (NOT NULL).

```javascript
const colors = ['Black', 'Camel', 'Dark Olive', 'Oxford Navy'];

for (const color of colors) {
  variants.push({
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

#### Paso 9: Mockups

Generate mockups for each color. Corduroy hats show front and side views well — the texture is visible.

#### Paso 10: Actualizar imagenes en Supabase

Alt text uses **hyphen** (`-`), NOT em dash — required by `buildImageMap()` in the API.

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../black-front.png', alt: 'Product Name - Black' },
    { src: '.../black-side.png', alt: 'Product Name - Black - Side' },
    { src: '.../camel-front.png', alt: 'Product Name - Camel' },
    { src: '.../camel-side.png', alt: 'Product Name - Camel - Side' },
    { src: '.../dark-olive-front.png', alt: 'Product Name - Dark Olive' },
    { src: '.../dark-olive-side.png', alt: 'Product Name - Dark Olive - Side' },
    { src: '.../oxford-navy-front.png', alt: 'Product Name - Oxford Navy' },
    { src: '.../oxford-navy-side.png', alt: 'Product Name - Oxford Navy - Side' },
  ],
}).eq('id', productId);
```

### Pricing Breakdown

#### 1 placement (front only)

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Standard | 16.95 EUR | +2.95 EUR | 19.90 EUR | €34.99 | 43.1% |

#### 2 placements (front + back) — Recommended

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Standard | 16.95 EUR | +5.90 EUR | 22.85 EUR | €34.99 | 34.7% |
| Priced higher | 16.95 EUR | +5.90 EUR | 22.85 EUR | €39.99 | 42.9% |

#### 4 placements (front + back + sides)

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Premium | 16.95 EUR | +11.80 EUR | 28.75 EUR | €44.99 | 36.1% |

**With unlimited_color (+3.25 EUR per placement):** Add to each placement that uses it.

**NOTE:** B682 has a higher base cost (16.95 EUR) than other hats. Pricing should reflect the premium corduroy material.

### Known Issues

1. **Printful NO acepta data URLs**: The `/files` endpoint rejects base64/data URLs. ALWAYS upload to Supabase Storage first.
2. **GPSR endpoint 404 for embroidery**: `GET /store/products/{id}/gpsr.json` returns 404. GPSR must be managed in Supabase.
3. **thread_colors obligatorio**: ALWAYS specify `thread_colors_<placement>` in options.
4. **thread_colors ID format**: Correct: `thread_colors_front`, incorrect: `thread_colors_embroidery_front`.
5. **product_variants.title NOT NULL**: Use format `"ProductName / Color / One size"`.
6. **No front_large placement**: Unlike Otto Cap and Yupoong, B682 does NOT have `embroidery_front_large`. Only `embroidery_front` with PF#78 (1200x525).
7. **Smaller front canvas**: PF#78 is 1200x525 (4.00"x1.75") — smaller than PF#75 (5.50"x2.00") and PF#478 (6.30"x2.55"). Design files from other hats need resizing.
8. **Premium material pricing**: Base cost 16.95 EUR is significantly higher than other hats. Price retail accordingly to maintain margins.
9. **Corduroy texture**: The wale texture of corduroy can affect how embroidery looks — bold, simple designs work best.
10. **Unstructured crown**: Soft crown means 3D puff embroidery is NOT recommended — flat embroidery only.
11. **Rate limits**: Use `delay(1500-2000)` between API calls. Store ID header required for v1 endpoints.
12. **Store ID**: ALWAYS use 17795695 (Skapara). NEVER use 17595620 (different store).
