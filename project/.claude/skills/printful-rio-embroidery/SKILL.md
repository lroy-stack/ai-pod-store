---
name: Printful Atlantis RIO Embroidery Ribbed Knit Beanie
description: Complete pipeline for Atlantis RIO (catalog 519) embroidered ribbed knit beanie on Printful. Covers embroidery product creation with SINGLE front placement only (NO back/side placements), thread color selection, variant management, mockup generation, and Supabase integration. Use when creating embroidered Atlantis RIO beanie products, generating mockups, updating branding, or managing ribbed knit beanie headwear. 8 colors — EU Latvia fulfillment. Sustainable: 50% recycled polyester / 50% acrylic (GRS + OEKO-TEX certified). Options: unlimited_color +3.25EUR. NO 3D puff (unstructured beanie).
---

# Printful Atlantis RIO Embroidery — Complete Pipeline

## Product Overview

| Spec | Valor |
|---|---|
| **Modelo** | Atlantis RIO Ribbed Knit Beanie |
| **Catalog ID** | 519 |
| **Technique** | EMBROIDERY |
| **Material** | 50% recycled polyester, 50% acrylic (GRS + OEKO-TEX certified) |
| **Construction** | Double layer knit, cuffed beanie, unstructured |
| **Tallas** | One size |
| **Colores** | 8 colors (Black, Olive, Navy, Mustard, Light Grey Melange, Beige, Light Blue, Acid Green) |
| **EU Fulfillment** | Latvia (EU_LV) |
| **Base cost** | ~16.95 EUR |
| **Embroidery cost** | +2.95 EUR (front placement) |
| **Total cost** | ~19.90 EUR |
| **Options** | unlimited_color +3.25 EUR (NO 3D puff — unstructured beanie) |
| **Retail target** | €34.99 |
| **Margin target** | >40% |
| **Sustainability** | GRS (Global Recycled Standard) + OEKO-TEX Standard 100 certified |

## Instructions

### Embroidery Specs — Atlantis RIO

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
| `embroidery_front` | PF#74 | 1500x525 @300dpi | 5.00"x1.75" | +2.95 EUR |

**CRITICAL: This product has ONLY the front placement. NO back, left, or right placements available.**

### Branding Rules — Beanie (Front ONLY)

Since beanies only have a front placement, the S mark branding must be integrated INTO the front design:
- **Front**: Main design WITH integrated S mark (e.g., below main graphic, or as part of the composition)
- **NEVER rely on back/side placements for branding** — they do not exist on this product
- Design must be self-contained with both the creative element AND branding in the single 1500x525 canvas
- **Sustainability angle**: Consider incorporating eco/recycled messaging into product descriptions (NOT the embroidery design)

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
- Same canvas as AS Colour 1120 (PF#74) — designs are interchangeable between the two beanies

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
  'embroidery-sources/rio-product-name/front.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/rio-product-name/front.png`;
```

#### Paso 4: Subir a Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({
    url: publicUrl,
    filename: 'rio-product-embroidery_front.png',
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
      name: 'Product Name — Ribbed Knit Beanie',
      thumbnail: publicUrlFront,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: '34.99',
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
- **Dark beanies** (Black, Olive, Navy): WHITE (#FFFFFF) or light threads
- **Medium beanies** (Mustard, Acid Green): WHITE (#FFFFFF) or contrasting threads
- **Light beanies** (Light Grey Melange, Beige, Light Blue): BLACK (#000000) or dark threads

#### Paso 6: GPSR — Supabase product_details

**NOTE:** The GPSR API endpoint (`/store/products/{id}/gpsr.json`) returns 404 for embroidery products. GPSR is managed in Supabase `product_details.safety_information`.

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 50% recycled polyester, 50% acrylic</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100, GRS (Global Recycled Standard)</p>
```

**NOTE:** This is the ONLY hat with GRS certification — include it in GPSR compliance for sustainability marketing.

#### Paso 7: Crear producto en Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description EN — sustainable ribbed knit beanie made from 50% recycled polyester with embroidered design',
  category: 'beanies',
  base_price_cents: 3499,
  compare_at_price_cents: 3999,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '519',
  category_id: '<beanies-uuid>',
  translations: {
    es: { title: 'Product Name', description: 'Descripcion creativa ES — gorro sostenible de punto acanalado...' },
    de: { title: 'Product Name', description: 'Kreative Beschreibung DE — nachhaltige gerippte Strickmutze...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Atlantis RIO',
    material: '50% recycled polyester, 50% acrylic (GRS + OEKO-TEX certified)',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '...GPSR HTML from Paso 6...',
  },
});
```

#### Paso 8: Crear variantes en Supabase

**IMPORTANT:** La tabla `product_variants` requiere campo `title` (NOT NULL).

```javascript
const colors = ['Black', 'Olive', 'Navy', 'Mustard', 'Light Grey Melange', 'Beige', 'Light Blue', 'Acid Green'];

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

Generate mockups for each color. Beanies typically show front view only (since there is only one placement).

#### Paso 10: Actualizar imagenes en Supabase

Alt text uses **hyphen** (`-`), NOT em dash — required by `buildImageMap()` in the API.

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../black-front.png', alt: 'Product Name - Black' },
    { src: '.../olive-front.png', alt: 'Product Name - Olive' },
    { src: '.../navy-front.png', alt: 'Product Name - Navy' },
    { src: '.../mustard-front.png', alt: 'Product Name - Mustard' },
    { src: '.../light-grey-melange-front.png', alt: 'Product Name - Light Grey Melange' },
    { src: '.../beige-front.png', alt: 'Product Name - Beige' },
    { src: '.../light-blue-front.png', alt: 'Product Name - Light Blue' },
    { src: '.../acid-green-front.png', alt: 'Product Name - Acid Green' },
  ],
}).eq('id', productId);
```

### Pricing Breakdown

#### 1 placement (front only — the ONLY option)

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Standard | ~16.95 EUR | +2.95 EUR | ~19.90 EUR | €34.99 | ~43.1% |
| With unlimited_color | ~16.95 EUR | +2.95 + 3.25 EUR | ~23.15 EUR | €34.99 | ~33.8% |

**NOTE:** With unlimited_color, margin drops below 35%. Consider pricing at €39.99 for unlimited_color designs:

| Config | Base | Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| Unlimited color | ~16.95 EUR | +6.20 EUR | ~23.15 EUR | €39.99 | ~42.1% |

### Known Issues

1. **SINGLE PLACEMENT ONLY**: This product has ONLY `embroidery_front`. Do NOT attempt to add back/side placements — they will be rejected by the API.
2. **No 3D Puff**: Unstructured beanie does not support 3D puff embroidery. Do NOT add the 3D puff option.
3. **Printful NO acepta data URLs**: The `/files` endpoint rejects base64/data URLs. ALWAYS upload to Supabase Storage first.
4. **GPSR endpoint 404 for embroidery**: `GET /store/products/{id}/gpsr.json` returns 404. GPSR must be managed in Supabase.
5. **thread_colors obligatorio**: ALWAYS specify `thread_colors_front` in options.
6. **thread_colors ID format**: Correct: `thread_colors_front`, incorrect: `thread_colors_embroidery_front`.
7. **product_variants.title NOT NULL**: Use format `"ProductName / Color / One size"`.
8. **Same printfile as AS Colour 1120**: Both beanies use PF#74 (1500x525 @300dpi). Designs are interchangeable.
9. **RIO vs NELSON confusion**: Atlantis RIO (CAT=519) uses recycled polyester/acrylic. Atlantis NELSON (CAT=449) uses organic cotton. This skill is for RIO only.
10. **Sustainability marketing**: GRS + OEKO-TEX certifications are a key differentiator. Include in descriptions but NOT in embroidery designs.
11. **Rate limits**: Use `delay(1500-2000)` between API calls. Store ID header required for v1 endpoints.
12. **Store ID**: ALWAYS use 17795695 (Skapara). NEVER use 17595620 (different store).
