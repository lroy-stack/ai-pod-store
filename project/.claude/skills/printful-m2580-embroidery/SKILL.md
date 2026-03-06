---
name: Printful M2580 Embroidery Hoodie
description: Complete pipeline for Cotton Heritage M2580 (catalog 380) PREMIUM embroidered pullover hoodies on Printful. Covers embroidery product creation with 3 placements (chest_center + wrist_left + wrist_right — chest_center/chest_left MUTUALLY EXCLUSIVE), thread color selection, variant management, auto-preview mockups, and Supabase integration. Use when creating embroidered M2580 hoodie products or managing PREMIUM tier embroidered pullover hoodies. Light colors only (White, Bone) — EU Latvia fulfillment. VERIFIED pipeline with Origin product (2026-03-03).
---

# Printful M2580 Embroidery Hoodie — Complete Pipeline

## Product Overview

| Spec | Valor |
|---|---|
| **Modelo** | Cotton Heritage M2580 Unisex Premium Pullover Hoodie |
| **Catalog ID** | 380 (mismo que DTG, pero technique = EMBROIDERY) |
| **Technique** | EMBROIDERY (no DTG) |
| **Material** | 100% cotton face / 65% ring-spun cotton, 35% polyester |
| **Fit** | Classic streetwear, kangaroo pocket, 3-panel hood |
| **Tallas** | S, M, L, XL, 2XL, 3XL (6 tallas) |
| **Colores** | White (#ffffff), Bone (#f5e8ce) — SOLO claros |
| **EU Fulfillment** | Latvia (EU_LV) — in_stock ambos colores |
| **Base cost** | $21.25 (S-XL), $22.55 (2XL), $23.85 (3XL) |
| **Embroidery cost** | +$2.60 por placement (3 placements = +$7.80) |
| **Total cost** | $29.05 (S-XL), $30.35 (2XL), $31.65 (3XL) |
| **Retail** | €59.99 (S-XL), €64.99 (2XL), €69.99 (3XL) |
| **Margin** | ~51.6% (S-XL), ~53.3% (2XL), ~54.8% (3XL) |

## Instructions

### Diferencia con M2580 DTG (skill `printful-m2580`)

Este skill usa el MISMO blank (M2580, catalog 380) pero con **technique: EMBROIDERY** en vez de DTG. Las diferencias clave:

| Aspecto | M2580 DTG | M2580 Embroidery |
|---|---|---|
| Technique | DTG printing | EMBROIDERY |
| Colores garment | Dark (9 EU) | Light (White, Bone) |
| Placements | front, back, sleeve, label | embroidery_chest_left, chest_center, wrist_left, wrist_right |
| Diseño | PNG raster @150dpi | PNG raster @300dpi (digitized) |
| Max colores diseño | Ilimitado | 15 colores de hilo (o unlimited +$3.25/placement) |
| Base cost | $21.25 | $21.25 + $10.40 embroidery |
| Uso | Diseños meme/gráficos | Branding premium, logos, motivos geométricos |

### Pre-requisitos

1. Cuenta Printful con API token y Store ID
2. Supabase con tablas `products` y `product_variants`
3. Diseños de bordado en formato PNG @300dpi (ver [BRANDING.md](BRANDING.md))
4. Diseños deben respetar límites de colores de hilo (ver [BRANDING.md](BRANDING.md))

### Pipeline Completo — VERIFICADO (Origin, 2026-03-03)

> Script de referencia: `frontend/scripts/create-origin-printful.mjs`

#### Paso 1: Diseñar bordados (3 placements)

**CRITICAL: `embroidery_chest_center` y `embroidery_chest_left` son MUTUAMENTE EXCLUYENTES.** No se pueden usar juntos. Elegir UNO.

| Placement | Canvas | DPI | Diseño tipo |
|---|---|---|---|
| `embroidery_chest_center` | 3000×1800 | 300 | Branding principal (SKAPARA + año) |
| `embroidery_wrist_left` | 600×900 | 300 | Logo S mark |
| `embroidery_wrist_right` | 600×900 | 300 | Diseño geométrico/decorativo |

**Alternativa (si se usa chest_left en vez de center):**

| `embroidery_chest_left` | 1200×1200 | 300 | Icono/número |

Ver [BRANDING.md](BRANDING.md) para specs detalladas y design files.

#### Paso 2: Renderizar PNGs @300dpi

```bash
magick -density 300 -background transparent design.svg -resize WxH! design.png
```

Cada PNG debe coincidir exactamente con las dimensiones del canvas del placement.

#### Paso 3: Subir PNGs a Supabase Storage (URL pública)

**Printful NO acepta data URLs ni base64.** Necesita una URL pública accesible.

```javascript
// Subir a Supabase Storage primero
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
    url: publicUrl,           // URL pública de Supabase Storage
    filename: 'origin-embroidery_chest_center.png',
  }),
});
const fileId = result.result.id;  // Guardar para paso 5
```

**Rate limit:** `delay(3000)` entre uploads.

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry with jitter, proactive slowdown, and exponential backoff automatically.

#### Paso 5: Crear Sync Product en Printful

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Origin',
      thumbnail: publicUrlChestCenter,  // URL pública, NO data URL
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
        { id: 'thread_colors_chest_center', value: ['#000000', '#6B5294', '#CC3333'] },
        { id: 'thread_colors_wrist_left', value: ['#000000'] },
        { id: 'thread_colors_wrist_right', value: ['#000000', '#6B5294', '#CC3333'] },
      ],
    })),
  }),
});
```

Ver [VARIANTS.md](VARIANTS.md) para la tabla completa de variant_ids por color × talla.

**Thread colors format:** `thread_colors_<placement_sin_embroidery_>`. El ID de la opción NO incluye `embroidery_`:

```
thread_colors_chest_center   (no embroidery_chest_center)
thread_colors_wrist_left     (no embroidery_wrist_left)
thread_colors_wrist_right    (no embroidery_wrist_right)
```

#### Paso 6: GPSR — Supabase product_details

**NOTA:** El endpoint API de GPSR (`/store/products/{id}/gpsr.json`) devuelve 404 para productos de bordado. GPSR se maneja en Supabase `product_details.safety_information`.

Copiar la safety_information del template Printful (obtenible de otros productos DTG) y guardarla en el JSON de product_details.

#### Paso 7: Crear producto en Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Origin',
  description: 'Descripción creativa EN',
  category: 'pullover-hoodies',
  base_price_cents: 5999,    // base = S-XL price
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',  // IMPORTANT: 'printful', no 'printify'
  provider_product_id: String(pfProductId),
  product_template_id: '380',
  category_id: 'cc59f09e-3391-4672-8bea-805fb0628a47',  // pullover-hoodies
  translations: {
    es: { title: 'Origin', description: '...' },
    de: { title: 'Origin', description: '...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'Cotton Heritage M2580',
    material: '65% ring-spun cotton, 35% polyester (100% cotton face)',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: '...GPSR HTML...',
  },
});
```

#### Paso 8: Crear variantes en Supabase

**IMPORTANT:** La tabla `product_variants` requiere campo `title` (NOT NULL).

```javascript
variants.push({
  product_id: PRODUCT_UUID,
  title: `Origin / ${color} / ${size}`,  // REQUIRED
  color,
  size,
  price_cents: PRICES[size],  // 5999, 6499, 6999
  is_enabled: true,
  is_available: true,
  external_variant_id: String(VARIANT_IDS[color][size]),
});
```

#### Paso 9: Ghost Mockups (Transparente)

Generar 4 vistas × 2 colores = 8 mockups Ghost. Ver [MOCKUPS.md](MOCKUPS.md) para el pipeline completo, estructura de respuesta y extracción de vistas.

**Clave:** Todos los placements devuelven las mismas URLs. Front = `mockup_url`, resto = `extra[].option` (Back/Left/Right). Usar solo `mockups[0]`.

#### Paso 10: Actualizar imágenes en Supabase

Alt text usa **hyphen** (`-`), no em dash — requerido por `buildImageMap()` en la API.

```javascript
await supabase.from('products').update({
  images: [
    { src: '.../white-front.png', alt: 'Title - White' },
    { src: '.../white-left.png',  alt: 'Title - White - Left' },
    { src: '.../white-back.png',  alt: 'Title - White - Back' },
    { src: '.../white-right.png', alt: 'Title - White - Right' },
    { src: '.../bone-front.png',  alt: 'Title - Bone' },
    { src: '.../bone-left.png',   alt: 'Title - Bone - Left' },
    { src: '.../bone-back.png',   alt: 'Title - Bone - Back' },
    { src: '.../bone-right.png',  alt: 'Title - Bone - Right' },
  ],
}).eq('id', productId);
```

### Pricing Breakdown (3 placements — VERIFICADO)

| Talla | Base | 3× Embroidery | Total Cost | Retail | Margin |
|---|---|---|---|---|---|
| S-XL | $21.25 | $7.80 | $29.05 | €59.99 | 51.6% |
| 2XL | $22.55 | $7.80 | $30.35 | €64.99 | 53.3% |
| 3XL | $23.85 | $7.80 | $31.65 | €69.99 | 54.8% |

**Con label_inside adicional (+$0.99):**

| Talla | Total Cost | Retail | Margin |
|---|---|---|---|
| S-XL | $30.04 | €59.99 | 49.9% |
| 2XL | $31.34 | €64.99 | 51.8% |
| 3XL | $32.64 | €69.99 | 53.4% |

### Known Issues — VERIFICADOS (Origin, 2026-03-03)

1. **chest_center / chest_left MUTUAMENTE EXCLUYENTES**: Printful rechaza productos que usan ambos. Error: `"Placement embroidery_chest_center cannot be used with placement: embroidery_chest_left"`. Elegir UNO de los dos.
2. **Printful NO acepta data URLs**: El endpoint `/files` rechaza base64/data URLs. Error: `"file URL is not a valid URL"`. SIEMPRE subir primero a Supabase Storage y usar la URL pública.
3. **GPSR endpoint 404 para embroidery**: `GET /store/products/{id}/gpsr.json` devuelve 404. GPSR debe gestionarse directamente en Supabase `product_details.safety_information`.
4. **Ghost mockup response**: Todos los placements devuelven las mismas URLs. Extraer vistas de `mockups[0]`: front=`mockup_url`, resto=`extra[].option`. Ver [MOCKUPS.md](MOCKUPS.md).
5. **thread_colors obligatorio**: Sin especificar colores de hilo, Printful usa defaults que pueden no coincidir. SIEMPRE especificar `thread_colors_<placement>` en options.
6. **thread_colors ID format**: El ID de la opción NO lleva prefijo `embroidery_`. Correcto: `thread_colors_chest_center`, incorrecto: `thread_colors_embroidery_chest_center`.
7. **product_variants.title NOT NULL**: Supabase requiere campo `title` en product_variants. Usar formato `"ProductName / Color / Size"`.
8. **Mismo catalog_id DTG/Embroidery**: Comparten catalog 380. La diferencia está en los `file.type` usados (`embroidery_*` vs `front/back/sleeve`).
9. **full_color pricing**: "Unlimited color" (+$3.25/placement) solo para `embroidery_chest_left` y `embroidery_chest_center`, NO para muñecas.
10. **Printfiles endpoint vacío**: `GET /mockup-generator/printfiles/380` no mapea placements de bordado. Los printfile IDs se infieren del M2475 (674).

### Producto de Referencia — Origin

| Campo | Valor |
|---|---|
| **Printful Product ID** | 422171595 |
| **Supabase Product ID** | a526af13-71b0-4f8f-95eb-27dcd92cb40e |
| **Printful File IDs** | chest_center=950723276, wrist_left=950723322, wrist_right=950723335 |
| **Placements** | chest_center + wrist_left + wrist_right (3) |
| **Thread colors** | Black #000000, Purple #6B5294, Red #CC3333 |
| **Variantes** | 12 (2 colores × 6 tallas) |
| **Script** | `frontend/scripts/create-origin-printful.mjs` |
