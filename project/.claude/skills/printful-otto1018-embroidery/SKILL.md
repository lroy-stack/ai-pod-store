---
name: Printful Otto Cap 104-1018 Embroidery Distressed Dad Hat
description: Complete pipeline for Otto Cap 104-1018 (catalog 396) embroidered distressed dad hat on Printful. Covers embroidery product creation with 5 placements (front, front_large, back, left, right), thread color selection, variant management, mockup generation, and Supabase integration. Use when creating embroidered Otto Cap 104-1018 dad hat products, generating mockups, updating branding, or managing distressed dad hat headwear. 4 colors (Black, Charcoal Grey, Khaki, Navy) — EU Latvia fulfillment. Options: unlimited_color +3.25EUR, 3D puff +1.50EUR.
---

# Printful Otto Cap 104-1018 Embroidery — Complete Pipeline

## Product Overview

| Spec | Valor |
|---|---|
| **Modelo** | Otto Cap 104-1018 Distressed Dad Hat |
| **Catalog ID** | 396 |
| **Technique** | EMBROIDERY |
| **Material** | 100% pre-shrunk cotton twill, soft crown, distressed brim/fabric |
| **Fit** | Unstructured, low-profile, curved distressed brim, buckle closure |
| **Tallas** | One size |
| **Colores** | Black, Charcoal Grey, Khaki, Navy (4 colors) |
| **EU Fulfillment** | Latvia (EU_LV) |
| **Base cost** | 12.75-16.95 EUR (embroidery) |
| **Embroidery cost** | +2.95 EUR per extra placement |
| **Options** | unlimited_color +3.25 EUR, 3D puff +1.50 EUR |
| **Retail target** | €29.99 (1 placement), €34.99 (2 placements), €39.99 (3+ placements) |
| **Margin target** | >40% |

## Instructions

### Embroidery Specs — Otto Cap 104-1018

- **Thread colors**: 15 standard colors available, max 6 per design
- **Unlimited color**: CMYK polyester thread, gradient-capable (+3.25 EUR per placement)
- **3D Puff**: Available on structured areas (+1.50 EUR) — usable on front placement
- **Min text height**: 5mm / 0.25"
- **Min line width**: 1.5mm
- **File format**: PNG @300dpi preferred
- **Stitch count**: Max ~15,000 stitches standard

### Pre-requisitos

1. Cuenta Printful con API token y Store ID (17795695 — Skapara)
2. Supabase con tablas `products` y `product_variants`
3. Diseños de bordado en formato PNG @300dpi
4. Diseños deben respetar límites de colores de hilo (max 6 standard, or unlimited_color)

### Placements Disponibles

| Placement | Printfile | Canvas (px) | Physical | Price |
|---|---|---|---|---|
| `embroidery_front` | PF#75 | 1650x600 @300dpi | 5.50"x2.00" | +2.95 EUR |
| `embroidery_front_large` | PF#75 | 1650x600 @300dpi | 5.50"x2.00" | +2.95 EUR |
| `embroidery_back` | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |
| `embroidery_left` | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |
| `embroidery_right` | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |

**NOTE:** `embroidery_front` and `embroidery_front_large` share the same printfile (PF#75). Use ONE of them, not both.

### Branding Rules — Dad Hat

- **Front**: Main design (logo, icon, text)
- **Back** (where used): S mark or `skapara.com` — white thread on dark hats (Black, Charcoal Grey, Navy), dark thread on light hats (Khaki)
- **Left/Right sides** (where used): Mini S mark
- **NEVER copy the front design to other placements** — each position has its own design

### Pipeline Completo — 10 Steps

#### Paso 1: Disenar bordados

Design embroidery files for each placement you plan to use. Recommended config:

**Standard config (2 placements — front + back):**

| Placement | Canvas | Design |
|---|---|---|
| `embroidery_front` | 1650x600 @300dpi | Main design (logo/icon/text) |
| `embroidery_back` | 600x300 @300dpi | S mark or skapara.com |

**Premium config (3-4 placements — front + back + sides):**

| Placement | Canvas | Design |
|---|---|---|
| `embroidery_front` | 1650x600 @300dpi | Main design |
| `embroidery_back` | 600x300 @300dpi | S mark or skapara.com |
| `embroidery_left` | 600x300 @300dpi | Mini S mark |
| `embroidery_right` | 600x300 @300dpi | Mini S mark |

#### Paso 2: Renderizar PNGs @300dpi

```bash
# Front design
magick -density 300 -background transparent design-front.svg -resize 1650x600! design-front.png

# Back design
magick -density 300 -background transparent design-back.svg -resize 600x300! design-back.png

# Side designs (if used)
magick -density 300 -background transparent design-side.svg -resize 600x300! design-side.png
```

Each PNG must match exactly the canvas dimensions of its placement.

#### Paso 3: Subir PNGs a Supabase Storage (URL publica)

**Printful NO acepta data URLs ni base64.** Necesita una URL publica accesible.

```javascript
// Upload to Supabase Storage first
await supabase.storage.from('designs').upload(
  'embroidery-sources/otto1018-product-name/front.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/otto1018-product-name/front.png`;
```

#### Paso 4: Subir a Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({
    url: publicUrl,           // Public URL from Supabase Storage
    filename: 'otto1018-product-embroidery_front.png',
  }),
});
const fileId = result.result.id;  // Save for step 5
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
      name: 'Product Name — Distressed Dad Hat',
      thumbnail: publicUrlFront,  // Public URL, NOT data URL
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,   // See VARIANTS.md
      retail_price: '29.99',      // EUR
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
thread_colors_front_large  (NOT thread_colors_embroidery_front_large)
thread_colors_back         (NOT thread_colors_embroidery_back)
thread_colors_left         (NOT thread_colors_embroidery_left)
thread_colors_right        (NOT thread_colors_embroidery_right)
```

**Thread color selection for hat colors:**
- **Dark hats** (Black, Charcoal Grey, Navy): Use WHITE (#FFFFFF) or light thread for visibility
- **Light hats** (Khaki): Use BLACK (#000000) or dark thread for contrast

#### Paso 6: GPSR — Supabase product_details

**NOTE:** The GPSR API endpoint (`/store/products/{id}/gpsr.json`) returns 404 for embroidery products. GPSR is managed in Supabase `product_details.safety_information`.

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 100% pre-shrunk cotton twill</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

#### Paso 7: Crear producto en Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description EN — distressed dad hat with embroidered design',
  category: 'dad-hats',
  base_price_cents: 2999,      // base = 1 placement price
  compare_at_price_cents: 3499, // Strikethrough price — must be > base_price_cents
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',    // IMPORTANT: 'printful', NOT 'printify'
  provider_product_id: String(pfProductId),
  product_template_id: '396',  // Catalog ID
  category_id: '<dad-hats-uuid>',
  translations: {
    es: { title: 'Product Name', description: 'Descripcion creativa ES...' },
    de: { title: 'Product Name', description: 'Kreative Beschreibung DE...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Otto Cap 104-1018',
    material: '100% pre-shrunk cotton twill',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '...GPSR HTML from Paso 6...',
  },
});
```

#### Paso 8: Crear variantes en Supabase

**IMPORTANT:** La tabla `product_variants` requiere campo `title` (NOT NULL).

```javascript
const colors = ['Black', 'Charcoal Grey', 'Khaki', 'Navy'];
const variantIds = { Black: 10990, 'Charcoal Grey': 10991, Khaki: 10992, Navy: 10993 };

for (const color of colors) {
  variants.push({
    product_id: PRODUCT_UUID,
    title: `Product Name / ${color} / One size`,  // REQUIRED — NOT NULL
    color,
    size: 'One size',
    price_cents: 2999,
    is_enabled: true,
    is_available: true,
    external_variant_id: String(variantIds[color]),
  });
}
```

#### Paso 9: Mockups

Generate mockups for each color. Dad hats typically show front and side views.

Request mockups from Printful mockup generator or use product photos. Update Supabase images array.

#### Paso 10: Actualizar imagenes en Supabase

Alt text uses **hyphen** (`-`), NOT em dash — required by `buildImageMap()` in the API.

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../black-front.png', alt: 'Product Name - Black' },
    { src: '.../black-side.png', alt: 'Product Name - Black - Side' },
    { src: '.../charcoal-grey-front.png', alt: 'Product Name - Charcoal Grey' },
    { src: '.../charcoal-grey-side.png', alt: 'Product Name - Charcoal Grey - Side' },
    { src: '.../khaki-front.png', alt: 'Product Name - Khaki' },
    { src: '.../khaki-side.png', alt: 'Product Name - Khaki - Side' },
    { src: '.../navy-front.png', alt: 'Product Name - Navy' },
    { src: '.../navy-side.png', alt: 'Product Name - Navy - Side' },
  ],
}).eq('id', productId);
```

### Pricing Breakdown

#### 1 placement (front only)

| Color | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| All | ~14.85 EUR avg | +2.95 EUR | ~17.80 EUR | €29.99 | ~40.6% |

#### 2 placements (front + back)

| Color | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| All | ~14.85 EUR avg | +5.90 EUR | ~20.75 EUR | €34.99 | ~40.7% |

#### 3 placements (front + back + side)

| Color | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| All | ~14.85 EUR avg | +8.85 EUR | ~23.70 EUR | €39.99 | ~40.7% |

**With unlimited_color (+3.25 EUR per placement):** Add to each placement that uses it.
**With 3D puff (+1.50 EUR):** Add to front placement if 3D effect desired.

### Known Issues

1. **Printful NO acepta data URLs**: The `/files` endpoint rejects base64/data URLs. Error: `"file URL is not a valid URL"`. ALWAYS upload to Supabase Storage first and use the public URL.
2. **GPSR endpoint 404 for embroidery**: `GET /store/products/{id}/gpsr.json` returns 404. GPSR must be managed directly in Supabase `product_details.safety_information`.
3. **thread_colors obligatorio**: Without specifying thread colors, Printful uses defaults that may not match the design. ALWAYS specify `thread_colors_<placement>` in options.
4. **thread_colors ID format**: The option ID does NOT carry the `embroidery_` prefix. Correct: `thread_colors_front`, incorrect: `thread_colors_embroidery_front`.
5. **product_variants.title NOT NULL**: Supabase requires `title` field in product_variants. Use format `"ProductName / Color / One size"`.
6. **embroidery_front vs embroidery_front_large**: Both use the same printfile PF#75 and same canvas. They are aliases — use ONE, not both simultaneously.
7. **One size variants**: This product has no size dimension — each color = 1 variant. Total 4 variants.
8. **Distressed look**: The hat comes pre-distressed (fabric and brim). This is intentional, not a defect.
9. **Rate limits**: Use `delay(1500-2000)` between API calls. Store ID header required for v1 endpoints.
10. **Store ID**: ALWAYS use 17795695 (Skapara). NEVER use 17595620 (different store).
