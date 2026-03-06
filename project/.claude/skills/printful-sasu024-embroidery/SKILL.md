---
name: Printful SASU024 Embroidery Hoodie
description: >-
  Complete pipeline for Stanley/Stella SASU024 (catalog 831) PREMIUM ECO embroidered organic relaxed hoodies
  on Printful. Covers embroidery product creation with 4 placements (chest_center/chest_left MUTUALLY EXCLUSIVE + wrist_left + wrist_right),
  thread color selection, variant management, mockup generation, and Supabase integration.
  Use when creating embroidered SASU024 hoodie products, generating mockups, updating branding,
  or managing PREMIUM ECO tier embroidered organic hoodies.
---

# Printful SASU024 Embroidery Hoodie — Complete Pipeline

## Product Overview

| Spec | Valor |
|---|---|
| **Modelo** | Stanley/Stella SASU024 Unisex Organic Relaxed Hoodie |
| **Catalog ID** | 831 (same as DTG, but technique = EMBROIDERY) |
| **Technique** | EMBROIDERY (not DTG) |
| **Material EU** | 100% organic combed ring-spun cotton (GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan) |
| **Material US** | 80% organic cotton, 20% recycled polyester |
| **Fabric Weight** | 10.3 oz/yd² (350 g/m²) |
| **Fit** | Relaxed, unisex, soft light suede finish |
| **Tallas** | S, M, L, XL, 2XL (5 tallas, NO 3XL) |
| **Colores dark** | Black (#121212), French Navy (#071429) |
| **Colores light** | Heather Grey (#e5e5e1), White (#ffffff) — ALL USABLE for embroidery |
| **EU Fulfillment** | Latvia — Embroidery in stock |
| **Base cost** | €40.95 (S-XL), €42.50 (2XL) |
| **Embroidery cost** | +€2.75/placement |
| **Total cost (3 placements)** | €49.20 (S-XL), €50.75 (2XL) |
| **Unlimited color** | NOT AVAILABLE on SASU024 |
| **Certifications** | GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan |
| **Sizing note** | US sizes shown — European customers should order a size DOWN |

## Instructions

### Diferencia con SASU024 DTG (skill `printful-sasu024`)

Este skill usa el MISMO blank (SASU024, catalog 831) pero con **technique: EMBROIDERY** en vez de DTG.

| Aspecto | SASU024 DTG | SASU024 Embroidery |
|---|---|---|
| Technique | DTG printing | EMBROIDERY |
| Colores garment | Dark only (Black, French Navy) | ALL 4 colors usable (embroidery thread provides contrast) |
| Placements | front, back, back_large, sleeve, label | embroidery_chest_left/center, wrist_left, wrist_right |
| Diseño | PNG raster @150dpi | PNG raster @300dpi (digitized) |
| Max colores diseño | Ilimitado | 15 colores de hilo |
| Base cost S-XL | €39.25 (DTG) | €40.95 (Embroidery) |
| Placement cost | €5.25/placement (DTG) | €2.75/placement (Embroidery) |
| Uso | Diseños meme/gráficos | Branding premium, logos, motivos geométricos |

### Pre-requisitos

1. Cuenta Printful con API token y Store ID
2. Supabase con tablas `products` y `product_variants`
3. Diseños de bordado en formato PNG @300dpi
4. Diseños deben respetar límites de 15 colores de hilo

### Printful API Authentication

ALL requests require these headers:

```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
User-Agent: POD-AI-Store/1.0
```

**CRITICAL:** The `User-Agent` header is MANDATORY. Without it, Printful/Cloudflare returns 401 Unauthorized.

Env vars in `frontend/.env.local`:
- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID` (17795695 — "Skapara")

### Pipeline Completo (Based on M2580-Embroidery Origin — VERIFIED)

> Reference script: `frontend/scripts/create-origin-printful.mjs` (M2580 version — adapt for SASU024)

#### Paso 1: Diseñar bordados (3 placements)

**CRITICAL: `embroidery_chest_center` y `embroidery_chest_left` son MUTUAMENTE EXCLUYENTES.** No se pueden usar juntos. Elegir UNO.

| Placement | Canvas (px) | DPI | Physical | Diseño tipo |
|---|---|---|---|---|
| `embroidery_chest_center` | 3000×1800 | 300 | 10"×6" | Branding principal (logo + texto) |
| `embroidery_chest_left` | 1200×1200 | 300 | 4"×4" | Icono/logo |
| `embroidery_wrist_left` | 600×900 | 300 | 2"×3" | Logo S mark |
| `embroidery_wrist_right` | 600×900 | 300 | 2"×3" | Diseño geométrico/decorativo |

**Canvas dimensions inferred from M2475 (cat 674) standard — shared across Printful hoodies.**
- Printfiles endpoint does NOT list embroidery chest canvases for SASU024 (same behavior as M2580)
- Wrist dimensions confirmed: printfile #338 (600×900 @300dpi)

#### Paso 2: Renderizar PNGs @300dpi

```bash
magick -density 300 -background transparent design.svg -resize WxH! design.png
```

Each PNG must match exactly the canvas dimensions of the placement.

#### Paso 3: Subir PNGs a Supabase Storage (URL pública)

**Printful NO acepta data URLs ni base64.** Necesita una URL pública accesible.

```javascript
await supabase.storage.from('designs').upload(
  'embroidery-sources/product-name/placement.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/product-name/placement.png`;
```

#### Paso 4: Subir a Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({
    url: publicUrl,
    filename: 'sasu024-embroidery_chest_center.png',
  }),
});
const fileId = result.result.id;
```

**Rate limit:** `delay(3000)` entre uploads.

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry with jitter, proactive slowdown, and exponential backoff automatically.

#### Paso 5: Crear Sync Product en Printful

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — SKAPARA',
      thumbnail: publicUrlChestCenter,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: PRICES[v.size],
      is_enabled: true,
      files: [
        { type: 'embroidery_chest_center', id: chestCenterFileId },
        { type: 'embroidery_wrist_left', id: wristLeftFileId },
        { type: 'embroidery_wrist_right', id: wristRightFileId },
      ],
      options: [
        { id: 'thread_colors_chest_center', value: ['#01784E', '#7BA35A', '#FFFFFF'] },
        { id: 'thread_colors_wrist_left', value: ['#01784E'] },
        { id: 'thread_colors_wrist_right', value: ['#01784E', '#7BA35A'] },
      ],
    })),
  }),
});
```

**Thread colors format:** `thread_colors_<placement_sin_embroidery_>`. El ID de la opción NO incluye `embroidery_`:

```
thread_colors_chest_center   (NOT embroidery_chest_center)
thread_colors_chest_left     (NOT embroidery_chest_left)
thread_colors_wrist_left     (NOT embroidery_wrist_left)
thread_colors_wrist_right    (NOT embroidery_wrist_right)
```

**IMPORTANT:** `unlimited_color` is NOT AVAILABLE on SASU024. Max 15 thread colors per placement.

#### Paso 6: GPSR — Supabase product_details

**NOTA:** El endpoint API de GPSR (`/store/products/{id}/gpsr.json`) devuelve 404 para productos de bordado. GPSR se maneja directamente en Supabase `product_details.safety_information`.

#### Paso 7: Crear producto en Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description only.',
  category: 'pullover-hoodies',
  base_price_cents: 8995,
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '831',
  translations: {
    es: { title: '...', description: '...' },
    de: { title: '...', description: '...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Stanley/Stella SASU024',
    tier: 'PREMIUM ECO',
    material: '100% organic combed ring-spun cotton, 10.3 oz/yd² (350 g/m²)',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    certifications: 'GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan',
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% organic combed ring-spun cotton</p><p><strong>Weight:</strong> 10.3 oz/yd² (350 g/m²)</p><p><strong>Technique:</strong> Machine embroidery — polyester thread</p><p><strong>Compliance:</strong> GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan, REACH</p><p><strong>Sourced from:</strong> Bangladesh</p>',
    sizing_note: 'US sizes shown — European customers should order a size DOWN',
    care_instructions: 'Hand wash cold, inside out. Do not bleach. Air dry. Do not iron on embroidery.',
  },
});
```

#### Paso 8: Crear variantes en Supabase

**IMPORTANT:** La tabla `product_variants` requiere campo `title` (NOT NULL).

```javascript
for (const { color, hex } of ALL_COLORS) {
  for (const size of sizes) {
    await supabase.from('product_variants').insert({
      product_id: PRODUCT_UUID,
      title: `ProductName / ${color} / ${size}`,
      color,
      color_hex: hex,
      size,
      price_cents: PRICES[size],
      is_enabled: DARK_COLORS.includes(color),
      is_available: true,
      external_variant_id: String(VARIANT_IDS[color][size]),
    });
  }
}
```

#### Paso 9: Ghost Mockups

Generate 3 views × N colors = mockups. See [MOCKUPS.md](MOCKUPS.md).

**Key:** All placements return same URLs. Front = `mockup_url`, rest = `extra[].option` (Back/Left/Right). Use only `mockups[0]`.

#### Paso 10: Actualizar imágenes en Supabase

Alt text uses **hyphen** (`-`), not em dash — required by `buildImageMap()` in the API.

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../black-front.png', alt: 'Title - Black' },
    { src: '.../black-left.png',  alt: 'Title - Black - Left' },
    { src: '.../black-back.png',  alt: 'Title - Black - Back' },
    { src: '.../french-navy-front.png', alt: 'Title - French Navy' },
    ...
  ],
}).eq('id', productId);
```

### Pricing Breakdown

#### 3 Placements (chest_center + wrist_left + wrist_right)

| Talla | Base | 3× Embroidery | Total Cost | Retail (sugerido) | Margin |
|---|---|---|---|---|---|
| S-XL | €40.95 | €8.25 | €49.20 | €89.95 | 45.3% |
| 2XL | €42.50 | €8.25 | €50.75 | €94.95 | 46.6% |

#### 1 Placement (chest_center only)

| Talla | Base | 1× Embroidery | Total Cost | Retail (sugerido) | Margin |
|---|---|---|---|---|---|
| S-XL | €40.95 | €2.75 | €43.70 | €79.95 | 45.3% |
| 2XL | €42.50 | €2.75 | €45.25 | €84.95 | 46.7% |

### Color Strategy — Embroidery vs DTG

**CRITICAL DIFFERENCE:** Unlike DTG (where only dark colors work for white designs), embroidery thread provides contrast on ANY garment color. This means:

- **Dark garments** (Black, French Navy): Use light thread colors (White, Gold, Kiwi Green)
- **Light garments** (Heather Grey, White): Use dark thread colors (Kelly Green, Navy, Black)
- **ALL 4 SASU024 colors are viable** for embroidery, not just the 2 dark ones

Decision: Enable ALL 4 colors by default for embroidery products (vs only 2 dark for DTG).

### Known Issues — Based on M2580-Embroidery (VERIFIED)

1. **chest_center / chest_left MUTUAMENTE EXCLUYENTES**: Printful rechaza productos que usan ambos. Error: `"Placement embroidery_chest_center cannot be used with placement: embroidery_chest_left"`.
2. **Printful NO acepta data URLs**: `/files` rechaza base64/data URLs. Error: `"file URL is not a valid URL"`. SIEMPRE subir a Supabase Storage primero.
3. **GPSR endpoint 404 para embroidery**: `GET /store/products/{id}/gpsr.json` devuelve 404. GPSR debe gestionarse directamente en Supabase `product_details.safety_information`.
4. **Ghost mockup response**: Todos los placements devuelven las mismas URLs. Extraer vistas de `mockups[0]`. Ver [MOCKUPS.md](MOCKUPS.md).
5. **thread_colors obligatorio**: Sin especificar colores de hilo, Printful usa defaults que pueden no coincidir. SIEMPRE especificar `thread_colors_<placement>` en options.
6. **thread_colors ID format**: El ID de la opción NO lleva prefijo `embroidery_`. Correcto: `thread_colors_chest_center`, incorrecto: `thread_colors_embroidery_chest_center`.
7. **product_variants.title NOT NULL**: Supabase requiere campo `title` en product_variants. Usar formato `"ProductName / Color / Size"`.
8. **Mismo catalog_id DTG/Embroidery**: Comparten catalog 831. La diferencia está en los `file.type` usados (`embroidery_*` vs `front/back/sleeve`).
9. **NO unlimited_color**: A diferencia de STSU177, SASU024 NO tiene opción `unlimited_color`. Máximo 15 colores de hilo por placement.
10. **Printfiles endpoint no mapea chest embroidery**: `GET /mockup-generator/printfiles/831` no devuelve chest dimensions. Canvas specs inferidos de M2475 (cat 674).
11. **User-Agent MANDATORY**: Todas las requests necesitan `User-Agent: POD-AI-Store/1.0` o Cloudflare devuelve 401.
12. **DTF NOT available EU**: DTF returns "not fulfillable" for EU region. Solo DTG y Embroidery disponibles.
13. **Embroidery care different from DTG**: "Hand wash cold, do not iron on embroidery" vs DTG "Machine wash cold".

### Embroidery Placement Conflicts (Verified from v2 API)

| Placement | Conflicts With |
|---|---|
| `embroidery_chest_left` | `embroidery_chest_center`, `embroidery_chest_right` |
| `embroidery_chest_center` | `embroidery_chest_left`, `embroidery_chest_right` |
| `embroidery_wrist_left` | `sleeve_left`, `sleeve_right`, `long_sleeve_left_dtf`, `short_sleeve_left_dtf`, `embroidery_sleeve_left_top`, `embroidery_sleeve_right_top` |
| `embroidery_wrist_right` | `sleeve_right`, `sleeve_left`, `long_sleeve_right_dtf`, `short_sleeve_right_dtf`, `embroidery_sleeve_left_top`, `embroidery_sleeve_right_top` |

**CANNOT mix DTG sleeves with embroidery wrists on the same product.**

### Reference Products

For reference: M2580-Embroidery "Origin" product (Printful ID: 422171595, Supabase ID: a526af13-71b0-4f8f-95eb-27dcd92cb40e). Script: `frontend/scripts/create-origin-printful.mjs`.

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
See [MOCKUPS.md](MOCKUPS.md) for mockup generation pipeline.
See [BRANDING.md](BRANDING.md) for embroidery design specs and thread colors.
