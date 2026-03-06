---
name: Printful AS Colour 1120 Embroidery Fisherman Beanie
description: Complete pipeline for AS Colour 1120 (catalog 809) embroidered fisherman beanie on Printful. Covers embroidery product creation with SINGLE front placement only (NO back/side placements), thread color selection, variant management, mockup generation, and Supabase integration. Use when creating embroidered AS Colour 1120 beanie products, generating mockups, updating branding, or managing fisherman beanie headwear. 8 colors — EU Latvia fulfillment. Options: unlimited_color +3.25EUR. NO 3D puff (unstructured beanie).
---

# Printful AS Colour 1120 Embroidery — Complete Pipeline

## Product Overview

| Spec | Valor |
|---|---|
| **Modelo** | AS Colour 1120 Fisherman Beanie |
| **Catalog ID** | 809 |
| **Technique** | EMBROIDERY |
| **Material** | 100% acrylic, wide ribbed knit |
| **Construction** | Snug fit, cuffed fisherman style, unstructured |
| **Tallas** | One size |
| **Colores** | 8 colors (Athletic Heather, Black, Cypress, Ecru, Gold, Petrol Blue, Red, Walnut) |
| **EU Fulfillment** | Latvia (EU_LV) |
| **Base cost** | 14.95 EUR flat (all colors same price) |
| **Embroidery cost** | +2.60 EUR (front placement) |
| **Total cost** | 17.55 EUR |
| **Options** | unlimited_color +3.25 EUR (NO 3D puff — unstructured beanie) |
| **Retail target** | €29.99 |
| **Margin target** | >40% |

## Instructions

### Embroidery Specs — AS Colour 1120

- **Thread colors**: 15 standard colors available, max 6 per design
- **Unlimited color**: CMYK polyester thread, gradient-capable (+3.25 EUR per placement)
- **3D Puff**: NOT AVAILABLE — unstructured beanie does not support 3D puff embroidery
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
| `embroidery_front` | PF#74 | 1500x525 @300dpi | 5.00"x1.75" | +2.60 EUR |

**CRITICAL: This product has ONLY the front placement. NO back, left, or right placements available.**

### Branding Rules — Beanie (Front ONLY)

Since beanies only have a front placement, the S mark branding must be integrated INTO the front design:
- **Front**: Main design WITH integrated S mark (e.g., below main graphic, or as part of the composition)
- **NEVER rely on back/side placements for branding** — they do not exist on this product
- Design must be self-contained with both the creative element AND branding in the single 1500x525 canvas

### Pipeline Completo — 10 Steps

#### Paso 1: Disenar bordados (1 placement ONLY)

Design a single embroidery file for the front. The design must include both the main creative element and SKAPARA branding in one composition.

| Placement | Canvas | Design |
|---|---|---|
| `embroidery_front` | 1500x525 @300dpi | Main design + integrated S mark |

**Design tips for beanie front:**
- Canvas is wide and short (5.00"x1.75") — horizontal designs work best
- Integrate S mark small on the right or left side of the main design
- Keep designs simple — beanies are small, fine detail gets lost
- Consider the cuff fold — design sits on the cuff area

#### Paso 2: Renderizar PNGs @300dpi

```bash
# Front design (only placement)
magick -density 300 -background transparent design-front.svg -resize 1500x525! design-front.png
```

The PNG must match exactly 1500x525 pixels at 300dpi.

#### Paso 3: Subir PNGs a Supabase Storage (URL publica)

**Printful NO acepta data URLs ni base64.** Necesita una URL publica accesible.

```javascript
await supabase.storage.from('designs').upload(
  'embroidery-sources/1120-product-name/front.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/1120-product-name/front.png`;
```

#### Paso 4: Subir a Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({
    url: publicUrl,
    filename: '1120-product-embroidery_front.png',
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
      name: 'Product Name — Fisherman Beanie',
      thumbnail: publicUrlFront,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: '29.99',
      is_enabled: true,
      files: [
        { type: 'embroidery_front', id: frontFileId },
      ],
      options: [
        { id: 'thread_colors_front', value: ['#FFFFFF', '#000000'] },
      ],
    })),
  }),
});
```

See [VARIANTS.md](VARIANTS.md) for the complete variant_ids table.

**Thread colors format:** `thread_colors_<placement_without_embroidery_prefix>`:

```
thread_colors_front        (NOT thread_colors_embroidery_front)
```

**Thread color selection for beanie colors:**
- **Dark beanies** (Black, Cypress, Petrol Blue, Walnut): WHITE (#FFFFFF) or light threads
- **Medium beanies** (Red, Gold): WHITE (#FFFFFF) or contrasting threads
- **Light beanies** (Athletic Heather, Ecru): BLACK (#000000) or dark threads

#### Paso 6: GPSR — Supabase product_details

**NOTE:** The GPSR API endpoint (`/store/products/{id}/gpsr.json`) returns 404 for embroidery products. GPSR is managed in Supabase `product_details.safety_information`.

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 100% acrylic</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

#### Paso 7: Crear producto en Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description EN — fisherman beanie with embroidered design',
  category: 'beanies',
  base_price_cents: 2999,
  compare_at_price_cents: 3499,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '809',
  category_id: '<beanies-uuid>',
  translations: {
    es: { title: 'Product Name', description: 'Descripcion creativa ES...' },
    de: { title: 'Product Name', description: 'Kreative Beschreibung DE...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'AS Colour 1120',
    material: '100% acrylic',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '...GPSR HTML from Paso 6...',
  },
});
```

#### Paso 8: Crear variantes en Supabase

**IMPORTANT:** La tabla `product_variants` requiere campo `title` (NOT NULL).

```javascript
const colors = ['Athletic Heather', 'Black', 'Cypress', 'Ecru', 'Gold', 'Petrol Blue', 'Red', 'Walnut'];

for (const color of colors) {
  variants.push({
    product_id: PRODUCT_UUID,
    title: `Product Name / ${color} / One size`,
    color,
    size: 'One size',
    price_cents: 2999,
    is_enabled: true,
    is_available: true,
    external_variant_id: String(VARIANT_IDS[color]),
  });
}
```

#### Paso 9: Mockups

Generate mockups for each color. Beanies typically show front view only (since there is only one placement).

#### Paso 10: Actualizar imagenes en Supabase

Alt text uses **hyphen** (`-`), NOT em dash — required by `buildImageMap()` in the API.

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../athletic-heather-front.png', alt: 'Product Name - Athletic Heather' },
    { src: '.../black-front.png', alt: 'Product Name - Black' },
    { src: '.../cypress-front.png', alt: 'Product Name - Cypress' },
    { src: '.../ecru-front.png', alt: 'Product Name - Ecru' },
    { src: '.../gold-front.png', alt: 'Product Name - Gold' },
    { src: '.../petrol-blue-front.png', alt: 'Product Name - Petrol Blue' },
    { src: '.../red-front.png', alt: 'Product Name - Red' },
    { src: '.../walnut-front.png', alt: 'Product Name - Walnut' },
  ],
}).eq('id', productId);
```

### Pricing Breakdown

#### 1 placement (front only — the ONLY option)

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Standard | 14.95 EUR | +2.60 EUR | 17.55 EUR | €29.99 | 41.5% |
| With unlimited_color | 14.95 EUR | +2.60 + 3.25 EUR | 20.80 EUR | €29.99 | 30.6% |

**NOTE:** With unlimited_color, margin drops below 35%. Consider pricing at €34.99 for unlimited_color designs:

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Unlimited color | 14.95 EUR | +5.85 EUR | 20.80 EUR | €34.99 | 40.6% |

### Known Issues

1. **SINGLE PLACEMENT ONLY**: This product has ONLY `embroidery_front`. Do NOT attempt to add back/side placements — they will be rejected by the API.
2. **No 3D Puff**: Unstructured beanie does not support 3D puff embroidery. Do NOT add the 3D puff option.
3. **Printful NO acepta data URLs**: The `/files` endpoint rejects base64/data URLs. ALWAYS upload to Supabase Storage first.
4. **GPSR endpoint 404 for embroidery**: `GET /store/products/{id}/gpsr.json` returns 404. GPSR must be managed in Supabase.
5. **thread_colors obligatorio**: ALWAYS specify `thread_colors_front` in options.
6. **thread_colors ID format**: Correct: `thread_colors_front`, incorrect: `thread_colors_embroidery_front`.
7. **product_variants.title NOT NULL**: Use format `"ProductName / Color / One size"`.
8. **Flat pricing**: All 8 colors have the same base cost (14.95 EUR) — no size or color surcharges.
9. **No size field in API**: This product may not have an explicit size field in the Printful response. Handle as "One size" in Supabase.
10. **Rate limits**: Use `delay(1500-2000)` between API calls. Store ID header required for v1 endpoints.
11. **Store ID**: ALWAYS use 17795695 (Skapara). NEVER use 17595620 (different store).
