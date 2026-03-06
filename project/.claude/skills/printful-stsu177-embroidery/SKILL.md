---
name: Printful STSU177 Embroidery Hoodie
description: >-
  Complete pipeline for Stanley/Stella STSU177 (catalog 479) ESSENTIAL ECO embroidered organic pullover hoodies
  on Printful. Covers embroidery product creation with 4 placements (chest_center/chest_left MUTUALLY EXCLUSIVE + wrist_left + wrist_right),
  thread color selection (15 standard + unlimited_color option for chest), variant management, mockup generation,
  and Supabase integration. Use when creating embroidered STSU177 hoodie products, generating mockups,
  updating branding, or managing ESSENTIAL ECO tier embroidered organic hoodies.
---

# Printful STSU177 Embroidery Hoodie — Complete Pipeline

## Product Overview

| Spec | Valor |
|---|---|
| **Modelo** | Stanley/Stella STSU177 Unisex Essential Eco Hoodie |
| **Catalog ID** | 479 (same as DTG, but technique = EMBROIDERY) |
| **Technique** | EMBROIDERY (not DTG) |
| **Material** | 100% organic cotton (GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan) |
| **Fabric Weight** | 10.32 oz/yd² (350 g/m²) |
| **Fit** | Regular fit, set-in sleeves |
| **Features** | Self-fabric double-layered hood, front pouch pocket, 1×1 rib, metal eyelets |
| **Tallas** | S, M, L, XL, 2XL (5 tallas) |
| **Colores dark** | Black (#0b0b0b), French Navy (#071429) |
| **Colores light** | Desert Dust (#dcccb4), White (#ffffff) — ALL USABLE for embroidery |
| **EU Fulfillment** | Latvia — Embroidery in stock |
| **Base cost** | €39.75 (S-XL), €41.25 (2XL) |
| **Embroidery cost** | +€2.95/placement |
| **Total cost (3 placements)** | €48.60 (S-XL), €50.10 (2XL) |
| **Unlimited color** | +€3.25/placement (CHEST ONLY — chest_left and chest_center) |
| **Certifications** | GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan |
| **Sizing note** | EU sizes shown — US customers should order one size UP |

## Instructions

### Diferencia con STSU177 DTG (skill `printful-stsu177`)

Este skill usa el MISMO blank (STSU177, catalog 479) pero con **technique: EMBROIDERY** en vez de DTG.

| Aspecto | STSU177 DTG | STSU177 Embroidery |
|---|---|---|
| Technique | DTG printing | EMBROIDERY |
| Colores garment | Dark only (Black, French Navy) | ALL 4 colors usable |
| Placements | front, back, sleeve, label | embroidery_chest_left/center, wrist_left, wrist_right |
| Diseño | PNG raster @150dpi | PNG raster @300dpi (digitized) |
| Max colores diseño | Ilimitado | 15 standard (or unlimited +€3.25 for chest) |
| Base cost S-XL | €37.75 (DTG) | €39.75 (Embroidery) |
| Placement cost | €5.95/placement (DTG) | €2.95/placement (Embroidery) |
| Uso | Diseños meme/gráficos | Branding premium, logos, motivos geométricos |

### Pre-requisitos

1. Cuenta Printful con API token y Store ID
2. Supabase con tablas `products` y `product_variants`
3. Diseños de bordado en formato PNG @300dpi
4. Diseños deben respetar límites de colores de hilo (15 standard, unlimited for +€3.25)

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

> Reference script: `frontend/scripts/create-origin-printful.mjs` (M2580 version — adapt for STSU177)

#### Paso 1: Diseñar bordados (3 placements)

**CRITICAL: `embroidery_chest_center` y `embroidery_chest_left` son MUTUAMENTE EXCLUYENTES.**

| Placement | Canvas (px) | DPI | Physical | Diseño tipo |
|---|---|---|---|---|
| `embroidery_chest_center` | 3000×1800 | 300 | 10"×6" | Branding principal (logo + texto) |
| `embroidery_chest_left` | 1200×1200 | 300 | 4"×4" | Icono/logo |
| `embroidery_wrist_left` | 600×900 | 300 | 2"×3" | Logo S mark |
| `embroidery_wrist_right` | 600×900 | 300 | 2"×3" | Diseño geométrico/decorativo |

**Canvas dimensions inferred from M2475 (cat 674) standard — shared across Printful hoodies.**
- Wrist dimensions confirmed from printfiles endpoint: printfile #396 (600×900 @300dpi)

#### Paso 2: Renderizar PNGs @300dpi

```bash
magick -density 300 -background transparent design.svg -resize WxH! design.png
```

#### Paso 3: Subir PNGs a Supabase Storage (URL pública)

**Printful NO acepta data URLs ni base64.** Necesita URL pública accesible.

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
    filename: 'stsu177-embroidery_chest_center.png',
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

**Thread colors format:** `thread_colors_<placement_sin_embroidery_>`:

```
thread_colors_chest_center   (NOT embroidery_chest_center)
thread_colors_chest_left     (NOT embroidery_chest_left)
thread_colors_wrist_left     (NOT embroidery_wrist_left)
thread_colors_wrist_right    (NOT embroidery_wrist_right)
```

**UNLIMITED COLOR OPTION (chest only):**
```json
{
  "options": [
    { "id": "unlimited_color", "value": true },
    { "id": "thread_colors_chest_center", "value": ["#01784E", "#7BA35A", "#FFFFFF", "#E25C27"] }
  ]
}
```
Adds +€3.25/unit per chest placement. Only available for `embroidery_chest_left` and `embroidery_chest_center`, NOT wrists.

#### Paso 6: GPSR — Supabase product_details

**NOTA:** GPSR endpoint devuelve 404 para bordado. Gestionar en Supabase.

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
  product_template_id: '479',
  translations: {
    es: { title: '...', description: '...' },
    de: { title: '...', description: '...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Stanley/Stella STSU177',
    tier: 'ESSENTIAL ECO',
    material: '100% organic cotton (GOTS), 10.32 oz/yd² (350 g/m²)',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    certifications: 'GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan',
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% organic cotton (GOTS certified)</p><p><strong>Weight:</strong> 10.32 oz/yd² (350 g/m²)</p><p><strong>Technique:</strong> Machine embroidery — polyester thread</p><p><strong>Compliance:</strong> GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan, REACH</p><p><strong>Sourced from:</strong> Bangladesh</p>',
    sizing_note: 'EU sizes shown — US customers should order one size UP',
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

See [MOCKUPS.md](MOCKUPS.md).

#### Paso 10: Actualizar imágenes en Supabase

Alt text uses **hyphen** (`-`).

### Pricing Breakdown

#### 3 Placements (chest_center + wrist_left + wrist_right)

| Talla | Base | 3× Embroidery | Total Cost | Retail (sugerido) | Margin |
|---|---|---|---|---|---|
| S-XL | €39.75 | €8.85 | €48.60 | €89.95 | 46.0% |
| 2XL | €41.25 | €8.85 | €50.10 | €94.95 | 47.2% |

#### 3 Placements + Unlimited Color (chest)

| Talla | Base | 3× Emb | +Unlimited | Total | Retail | Margin |
|---|---|---|---|---|---|---|
| S-XL | €39.75 | €8.85 | €3.25 | €51.85 | €94.95 | 45.4% |
| 2XL | €41.25 | €8.85 | €3.25 | €53.35 | €99.95 | 46.6% |

#### 1 Placement (chest_center only)

| Talla | Base | 1× Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| S-XL | €39.75 | €2.95 | €42.70 | €79.95 | 46.6% |
| 2XL | €41.25 | €2.95 | €44.20 | €84.95 | 48.0% |

### Color Strategy — Embroidery vs DTG

**Unlike DTG (2 dark colors only), embroidery can use ALL 4 colors.** Thread provides contrast on any background.

- **Black/French Navy**: Light threads (White, Gold, Kiwi Green, Kelly Green)
- **Desert Dust**: Dark threads (Black, Navy, Kelly Green, Maroon)
- **White**: Dark threads (Black, Navy, Purple, Red)

Enable ALL 4 colors by default for embroidery products.

### Known Issues — Based on M2580-Embroidery (VERIFIED)

1. **chest_center / chest_left MUTUAMENTE EXCLUYENTES**: Error: `"Placement embroidery_chest_center cannot be used with placement: embroidery_chest_left"`.
2. **Printful NO acepta data URLs**: SIEMPRE subir a Supabase Storage primero.
3. **GPSR endpoint 404 para embroidery**: Gestionar en Supabase `product_details.safety_information`.
4. **Ghost mockup extraction**: Usar solo `mockups[0]`. Front=`mockup_url`, resto=`extra[].option`.
5. **thread_colors obligatorio**: SIEMPRE especificar `thread_colors_<placement>` en options.
6. **thread_colors ID format**: SIN prefijo `embroidery_`.
7. **product_variants.title NOT NULL**: Formato `"ProductName / Color / Size"`.
8. **Mismo catalog_id DTG/Embroidery**: Comparten catalog 479.
9. **unlimited_color SOLO chest**: Wrists NO soportan unlimited_color.
10. **User-Agent MANDATORY**: `User-Agent: POD-AI-Store/1.0` o 401.
11. **Wrist printfile #396**: 600×900 @300dpi — confirmed from printfiles endpoint.
12. **Embroidery care different from DTG**: "Hand wash cold, do not iron on embroidery".

### Embroidery Placement Conflicts (Verified from v2 API)

| Placement | Conflicts With |
|---|---|
| `embroidery_chest_left` | `embroidery_chest_center`, `embroidery_chest_right` |
| `embroidery_chest_center` | `embroidery_chest_left`, `embroidery_chest_right` |
| `embroidery_wrist_left` | `sleeve_left`, `sleeve_right`, `long_sleeve_left_dtf`, `short_sleeve_left_dtf`, `embroidery_sleeve_left_top`, `embroidery_sleeve_right_top` |
| `embroidery_wrist_right` | `sleeve_right`, `sleeve_left`, `long_sleeve_right_dtf`, `short_sleeve_right_dtf`, `embroidery_sleeve_left_top`, `embroidery_sleeve_right_top` |

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
See [MOCKUPS.md](MOCKUPS.md) for mockup generation pipeline.
See [BRANDING.md](BRANDING.md) for embroidery design specs and thread colors.
