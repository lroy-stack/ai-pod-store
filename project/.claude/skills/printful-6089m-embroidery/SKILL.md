---
name: Printful Yupoong 6089M Embroidery Wool Blend Snapback
description: Complete pipeline for Yupoong 6089M (catalog 99) embroidered wool blend snapback on Printful. Covers embroidery product creation with 5 placements (front, front_large, back, left, right), thread color selection, variant management, mockup generation, and Supabase integration. Use when creating embroidered Yupoong 6089M snapback products, generating mockups, updating branding, or managing snapback headwear. 18 colors (21 variants) including two-tone combinations — EU Latvia fulfillment. Options: unlimited_color +3.25EUR, 3D puff +1.50EUR.
---

# Printful Yupoong 6089M Embroidery — Complete Pipeline

## Product Overview

| Spec | Valor |
|---|---|
| **Modelo** | Yupoong 6089M Wool Blend Snapback |
| **Catalog ID** | 99 |
| **Technique** | EMBROIDERY |
| **Material** | 80% acrylic / 20% wool (Green Camo: 60% cotton / 40% polyester) |
| **Construction** | Structured, 6-panel, high-profile, flat brim, plastic snap closure |
| **Tallas** | One size |
| **Colores** | 18 colors, 21 variants (including two-tone combos — see VARIANTS.md) |
| **EU Fulfillment** | Latvia (EU_LV) |
| **Base cost** | 12.49-14.75 EUR |
| **Embroidery cost** | +2.95 EUR per extra placement |
| **Options** | unlimited_color +3.25 EUR, 3D puff +1.50 EUR |
| **Retail target** | €29.99 (1 placement), €34.99 (2 placements), €39.99 (3+ placements) |
| **Margin target** | >40% |

## Instructions

### Embroidery Specs — Yupoong 6089M

- **Thread colors**: 15 standard colors available, max 6 per design
- **Unlimited color**: CMYK polyester thread, gradient-capable (+3.25 EUR per placement)
- **3D Puff**: Available (+1.50 EUR) — structured high-profile cap supports 3D puff well
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
| `embroidery_front` | PF#478 | 1890x765 @300dpi | 6.30"x2.55" | +2.95 EUR |
| `embroidery_front_large` | PF#478 | 1890x765 @300dpi | 6.30"x2.55" | +2.95 EUR |
| `embroidery_back` | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |
| `embroidery_left` | PF#706 | 675x675 @300dpi | 2.25"x2.25" | +2.95 EUR |
| `embroidery_right` | PF#706 | 675x675 @300dpi | 2.25"x2.25" | +2.95 EUR |

**NOTE:** `embroidery_front` and `embroidery_front_large` share the same printfile (PF#478). Use ONE of them, not both.

**NOTE:** Side placements (left/right) use PF#706 which is SQUARE (675x675) — different from other hats that use PF#76 (600x300). Design accordingly.

### Branding Rules — Snapback

- **Front**: Main design (logo, icon, text) — this hat has the LARGEST front canvas of any hat (1890x765)
- **Back** (where used): S mark or `skapara.com` — white thread on dark hats, dark thread on light hats
- **Left/Right sides** (where used): Mini S mark — square canvas (675x675) allows circular/square designs
- **NEVER copy the front design to other placements** — each position has its own design

### Pipeline Completo — 10 Steps

#### Paso 1: Disenar bordados

Design embroidery files for each placement you plan to use. Recommended config:

**Standard config (2 placements — front + back):**

| Placement | Canvas | Design |
|---|---|---|
| `embroidery_front` | 1890x765 @300dpi | Main design (logo/icon/text) |
| `embroidery_back` | 600x300 @300dpi | S mark or skapara.com |

**Premium config (4 placements — front + back + sides):**

| Placement | Canvas | Design |
|---|---|---|
| `embroidery_front` | 1890x765 @300dpi | Main design |
| `embroidery_back` | 600x300 @300dpi | S mark or skapara.com |
| `embroidery_left` | 675x675 @300dpi | Mini S mark (square) |
| `embroidery_right` | 675x675 @300dpi | Mini S mark (square) |

#### Paso 2: Renderizar PNGs @300dpi

```bash
# Front design (largest hat front — 6.30"x2.55")
magick -density 300 -background transparent design-front.svg -resize 1890x765! design-front.png

# Back design
magick -density 300 -background transparent design-back.svg -resize 600x300! design-back.png

# Side designs (SQUARE — different from other hats)
magick -density 300 -background transparent design-side.svg -resize 675x675! design-side.png
```

Each PNG must match exactly the canvas dimensions of its placement.

#### Paso 3: Subir PNGs a Supabase Storage (URL publica)

**Printful NO acepta data URLs ni base64.** Necesita una URL publica accesible.

```javascript
await supabase.storage.from('designs').upload(
  'embroidery-sources/6089m-product-name/front.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/6089m-product-name/front.png`;
```

#### Paso 4: Subir a Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({
    url: publicUrl,
    filename: '6089m-product-embroidery_front.png',
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
      name: 'Product Name — Snapback',
      thumbnail: publicUrlFront,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: '29.99',
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

See [VARIANTS.md](VARIANTS.md) for the complete variant_ids table (18 colors, 21 variants).

**Thread colors format:** `thread_colors_<placement_without_embroidery_prefix>`:

```
thread_colors_front        (NOT thread_colors_embroidery_front)
thread_colors_front_large  (NOT thread_colors_embroidery_front_large)
thread_colors_back         (NOT thread_colors_embroidery_back)
thread_colors_left         (NOT thread_colors_embroidery_left)
thread_colors_right        (NOT thread_colors_embroidery_right)
```

**Thread color selection for hat colors (18 API-verified colors):**
- **Dark hats** (Black, Dark Grey, Dark Navy, Navy, Maroon, Spruce, Green Camo): WHITE (#FFFFFF) or light threads
- **Light hats** (Silver, Heather Grey, Natural/Black, White): BLACK (#000000) or dark threads
- **Two-tone hats** (Black/Neon Pink, Black/Red, Black/Silver, Black/Teal, Heather/Black): Match thread to the front panel color

#### Paso 6: GPSR — Supabase product_details

**NOTE:** The GPSR API endpoint (`/store/products/{id}/gpsr.json`) returns 404 for embroidery products. GPSR is managed in Supabase `product_details.safety_information`.

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 80% acrylic, 20% wool</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

**NOTE for Green Camo variant:** Material is 60% cotton, 40% polyester — different from the standard blend. Consider noting this in product_details or as a variant-level note.

#### Paso 7: Crear producto en Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description EN — wool blend snapback with embroidered design',
  category: 'snapbacks',
  base_price_cents: 2999,
  compare_at_price_cents: 3499,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '99',
  category_id: '<snapbacks-uuid>',
  translations: {
    es: { title: 'Product Name', description: 'Descripcion creativa ES...' },
    de: { title: 'Product Name', description: 'Kreative Beschreibung DE...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Yupoong 6089M',
    material: '80% acrylic, 20% wool',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '...GPSR HTML from Paso 6...',
  },
});
```

#### Paso 8: Crear variantes en Supabase

**IMPORTANT:** La tabla `product_variants` requiere campo `title` (NOT NULL).

```javascript
// 18 colors (21 variants), each color with one size
for (const [color, variantId] of Object.entries(VARIANT_IDS)) {
  variants.push({
    product_id: PRODUCT_UUID,
    title: `Product Name / ${color} / One size`,
    color,
    size: 'One size',
    price_cents: 2999,
    is_enabled: true,
    is_available: true,
    external_variant_id: String(variantId),
  });
}
```

#### Paso 9: Mockups

Generate mockups for each color (or a representative subset). Snapbacks typically show front, side, and back views.

With 18 colors, consider generating mockups for the most popular 8-10 colors and adding the rest later.

#### Paso 10: Actualizar imagenes en Supabase

Alt text uses **hyphen** (`-`), NOT em dash — required by `buildImageMap()` in the API.

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../black-front.png', alt: 'Product Name - Black' },
    { src: '.../black-side.png', alt: 'Product Name - Black - Side' },
    { src: '.../dark-navy-front.png', alt: 'Product Name - Dark Navy' },
    { src: '.../dark-navy-side.png', alt: 'Product Name - Dark Navy - Side' },
    // ... more colors
  ],
}).eq('id', productId);
```

### Pricing Breakdown

#### 1 placement (front only)

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Standard | ~13.62 EUR avg | +2.95 EUR | ~16.57 EUR | €29.99 | ~44.7% |

#### 2 placements (front + back)

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Standard | ~13.62 EUR avg | +5.90 EUR | ~19.52 EUR | €34.99 | ~44.2% |

#### 4 placements (front + back + sides)

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Premium | ~13.62 EUR avg | +11.80 EUR | ~25.42 EUR | €39.99 | ~36.4% |

**With unlimited_color (+3.25 EUR per placement):** Add to each placement that uses it.
**With 3D puff (+1.50 EUR):** Add to front placement if 3D effect desired.

### Known Issues

1. **Printful NO acepta data URLs**: The `/files` endpoint rejects base64/data URLs. Error: `"file URL is not a valid URL"`. ALWAYS upload to Supabase Storage first and use the public URL.
2. **GPSR endpoint 404 for embroidery**: `GET /store/products/{id}/gpsr.json` returns 404. GPSR must be managed directly in Supabase `product_details.safety_information`.
3. **thread_colors obligatorio**: Without specifying thread colors, Printful uses defaults that may not match the design. ALWAYS specify `thread_colors_<placement>` in options.
4. **thread_colors ID format**: The option ID does NOT carry the `embroidery_` prefix. Correct: `thread_colors_front`, incorrect: `thread_colors_embroidery_front`.
5. **product_variants.title NOT NULL**: Supabase requires `title` field in product_variants. Use format `"ProductName / Color / One size"`.
6. **embroidery_front vs embroidery_front_large**: Both use PF#478 and same canvas. They are aliases — use ONE, not both.
7. **18 colors, 21 variants**: API-verified as of 2026-03-04. 3 two-tone combos from original catalog (Heather Grey/Navy, Heather Grey/Red, Navy/Red) are no longer available. White was added. Some colors may have multiple variants (total 21). Consider which colors to enable initially.
8. **Green Camo material difference**: Green Camo is 60% cotton / 40% polyester (NOT 80% acrylic / 20% wool). This may affect embroidery quality.
9. **Two-tone color names**: Colors like "Black/Neon Pink" have slashes — handle carefully in slug generation and alt text.
10. **Square side placements**: Left/Right use PF#706 (675x675) — SQUARE, unlike other hats that use PF#76 (600x300 rectangular). Design files must be square.
11. **Rate limits**: Use `delay(1500-2000)` between API calls. Store ID header required for v1 endpoints.
12. **Store ID**: ALWAYS use 17795695 (Skapara). NEVER use 17595620 (different store).
