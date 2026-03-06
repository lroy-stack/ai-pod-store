---
name: Printful SASU024 Organic Hoodie Production
description: >-
  Complete pipeline for Stanley/Stella SASU024 (catalog 831) PREMIUM ECO organic relaxed hoodies
  on Printful. Covers product creation, variant management, branding placement, mockup generation,
  and Supabase integration. Use when creating SASU024 hoodie products, generating mockups,
  updating branding, or managing PREMIUM ECO tier organic hoodies.
---

# Printful SASU024 Organic Hoodie Production Pipeline — PREMIUM ECO Tier

Full production pipeline for SKAPARA PREMIUM ECO organic relaxed hoodies on the Stanley/Stella SASU024 blank via Printful API. Este es el **PREMIUM ECO tier hoodie** — la version organica y sostenible del catalogo SKAPARA, posicionada por encima del M2580 PREMIUM.

Para M2580 PREMIUM hoodies (Cotton Heritage), ver el skill `printful-m2580`.
Para MC1087 PREMIUM tees, ver el skill `printful-mc1087`.
Para CC1717 SIGNATURE tees, ver el skill `printful-cc1717`.
Para productos Printify (legacy DTG on P26), ver el skill `design-dtg`.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | Stanley/Stella SASU024 |
| **Full Name** | Unisex Organic Relaxed Hoodie |
| **Catalog ID** | 831 |
| **Tier** | PREMIUM ECO |
| **Material EU** | 100% organic combed ring-spun cotton (GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan) |
| **Material US** | 80% organic cotton, 20% recycled polyester |
| **Fabric Weight** | 10.3 oz/yd² (350 g/m²) |
| **Fit** | Relaxed, unisex |
| **Features** | Soft light suede finish, 2x2 ribbed cuffs/hem, kangaroo pocket |
| **Sourced from** | Bangladesh |
| **Fulfillment** | EU (Latvia) — DTG and Embroidery in stock. DTF NOT available in EU. |
| **Sizes** | S, M, L, XL, 2XL (5 sizes, NO 3XL) |
| **Total Colors** | 4 |
| **Dark (design-first selection)** | 2: Black, French Navy |
| **Light/Disabled** | 2: Heather Grey, White |
| **Color selection** | **Design-first** — analizar paleta del diseno, seleccionar colores que maximicen contraste |
| **Certifications** | GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan |
| **Sizing note** | US sizes shown — European customers should order a size DOWN |

**Diferencias clave vs M2580 (Cotton Heritage PREMIUM):**
- Front canvas es **1875x1875 (square)**, NO 1800x1800 como M2580
- Tiene `back_large` placement **2250x2700** — M2580 NO tiene este placement
- Solo 4 colores (vs 23 en M2580) con solo 2 colores dark
- 5 tallas S-2XL (vs 6 S-3XL en M2580, no hay 3XL)
- 100% algodon organico EU (vs algodon/poly blend del M2580)
- Base cost mas alto: $45.89 (vs ~$22.55 del M2580)
- Sizing EU: pedir talla MENOR (vs M2580: pedir talla MAYOR)
- Sleeves mismas: 450x1800 (compatibles con branding M2580/M2480)
- `label_inside` printfile_id 232: **600x600** at 300 DPI (vs M2580's 750x750)

---

## Placements & Dimensions

| Placement | Printfile ID | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `front` / `default` | #752 | **1875 x 1875** | 150 | $5.95 | Main design — **SQUARE** |
| `back` | #1 | 1800 x 2400 | 150 | +$5.95 | SKAPARA wordmark — conflicts with `label_outside` y `back_large` |
| `back_large` | #333 | **2250 x 2700** | 150 | +$5.95 | Diseno grande trasero — conflicts with `label_outside` y `back` |
| `sleeve_left` | #147 | **450 x 1800** | 150 | +$5.95 | S mark / wordmark vertical — conflicts con `embroidery_wrist_*` |
| `sleeve_right` | #147 | 450 x 1800 | 150 | +$5.95 | (sin uso actualmente) — conflicts con `embroidery_wrist_*` |
| `label_outside` | #748 | 300 x 300 | 150 | +$2.49 | Neck label (nuca) — conflicts con `back` y `back_large` |
| `label_inside` | #232 | **600 x 600** | 300 | +$0.99 | Interior label — conflicts con `label_outside` |
| `embroidery_chest_left` | — | 4" x 4" (1200x1200 @300dpi) | — | — | Embroidery — conflicts con `embroidery_chest_center` |
| `embroidery_chest_center` | — | 10" x 6" (3000x1800 @300dpi) | — | — | Embroidery — conflicts con `embroidery_chest_left` |
| `embroidery_wrist_left` | — | 2" x 3" (600x900 @300dpi) | — | — | Embroidery — conflicts con `sleeve_left/right` |
| `embroidery_wrist_right` | — | 2" x 3" (600x900 @300dpi) | — | — | Embroidery — conflicts con `sleeve_left/right` |

### Placement Conflicts (verificado de la API)

| Placement | Conflictos con |
|---|---|
| `back` | `label_outside`, `back_large` |
| `back_large` | `label_outside`, `back` |
| `label_inside` | `label_outside` |
| `sleeve_left` | `embroidery_wrist_left`, `embroidery_wrist_right` |
| `sleeve_right` | `embroidery_wrist_left`, `embroidery_wrist_right` |
| `embroidery_chest_left` | `embroidery_chest_center`, `embroidery_chest_right` |

**IMPORTANT:** `back`, `back_large`, y `label_outside` son **mutuamente excluyentes**. Solo se puede usar UNO de los tres. En v3 usamos `back` para SKAPARA wordmark (si se aplica).

---

## Base Costs (DTG)

| Size | Base Cost (front only) |
|---|---|
| S | $45.89 |
| M | $45.89 |
| L | $45.89 |
| XL | $45.89 |
| 2XL | $47.89 |

Additional placement costs stack on base cost. Un producto con front + back + sleeve_left cuesta:
- S-XL: $45.89 + $5.95 + $5.95 = **$57.79**
- 2XL: $47.89 + $5.95 + $5.95 = **$59.79**

### Retail Pricing Recommendation

Con base cost alto ($45.89-$47.89) + placement costs, el margen minimo 35% requiere precios retail significativamente mas altos que M2580:

| Config | Base+Placements (S-XL) | Min Retail (35%) | Sugerido |
|---|---|---|---|
| front only | $51.84 | $79.75 | $79.95 |
| front + sleeve_left | $57.79 | $88.91 | $89.95 |
| front + sleeve_left + label_inside | $58.78 | $90.43 | $89.95-$94.95 |
| front + back + sleeve_left | $63.74 | $98.06 | $99.95 |
| front + back + sleeve_left + label_inside | $64.73 | $99.58 | $99.95 |

---

## Printful API Authentication

ALL requests require these headers:

```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
```

Env vars en `frontend/.env.local`:
- `PRINTFUL_API_TOKEN`
- `PRINTFUL_STORE_ID` (17795695 — "Skapara")

---

## Rate Limits

| Endpoint | Limit | Recommended Delay |
|---|---|---|
| General API | ~120 req/min | 2000ms between calls |
| Mockup Generator | ~10 req/min | 10000ms between tasks |
| File uploads | ~30 req/min | 3000ms between uploads |

On HTTP 429: read `x-ratelimit-reset` header, wait that many seconds, retry.

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry with jitter, proactive slowdown, and exponential backoff automatically.

---

## File Upload Pattern

Printful requiere que los archivos esten en su File Library antes de poder usarlos en productos. Dos metodos:

### Method 1: URL Upload (preferido para archivos en Supabase)

```bash
curl -X POST https://api.printful.com/files \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-supabase.supabase.co/storage/v1/object/public/designs/my-design.png",
    "filename": "my-design-front-1875x1875.png"
  }'
```

### Method 2: Multipart Upload (para archivos locales)

```bash
curl -X POST https://api.printful.com/files \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -F "file=@output/my-design-front-1875x1875.png" \
  -F "type=default"
```

**Response** devuelve `id` (integer file_id) y `url` (CDN preview URL). Guardar ambos:
- `id` se usa en variant file placement updates
- `url` se usa como `image_url` en mockup generation

---

## Workflow 1: Create New SASU024 Organic Hoodie Product

### Step 1: Prepare Design Files

Disenar el canvas frontal a **1875x1875px** (SQUARE — diferente de tees y diferente de M2580 1800x1800). Renderizar branding assets per [BRANDING.md](BRANDING.md).

Required files:
1. **Front design** — 1875x1875 PNG (main design, square canvas)
2. **Sleeve left** — 450x1800 PNG (SKAPARA wordmark vertical — compatible con M2580/M2480, mismo archivo)
3. **Back wordmark** — 1800x2400 PNG (SKAPARA wordmark, si se aplica back branding)

### Step 2: Upload Design to Printful File Library

Upload the front design PNG via URL o multipart (ver File Upload Pattern arriba). Guardar el `file_id` retornado.

El archivo de sleeve branding (450x1800 vertical) puede reutilizarse de M2580/M2480 si ya esta subido.

### Step 3: Create Sync Product

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — SKAPARA",
      "thumbnail": "https://cdn.printful.com/.../design_preview.png"
    },
    "sync_variants": [
      {
        "variant_id": 21149,
        "retail_price": "89.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": LABEL_INSIDE_SMARK_FILE_ID}
        ]
      },
      {
        "variant_id": 21153,
        "retail_price": "89.95",
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": LABEL_INSIDE_SMARK_FILE_ID}
        ]
      }
    ]
  }'
```

**IMPORTANT:** Incluir TODAS las variantes activas para los colores seleccionados via **design-first analysis**. Con solo 2 colores dark (Black, French Navy), normalmente se usan ambos. Cada color x 5 tallas. Ver [VARIANTS.md](VARIANTS.md) para tabla completa.

**CRITICAL — Agregar variantes a productos existentes (`POST /store/products/{id}/variants`):**
- Files DEBEN usar campo `url` (NO `id` solo) — usar solo `id` causa error `"There can only be one file for each placement"`
- Correcto: `{ "type": "default", "url": "https://...design.png" }`
- Incorrecto: `{ "type": "default", "id": 950267047 }` (falla con 400)
- La creacion inicial (`POST /store/products`) puede usar `id`, pero la creacion individual de variantes requiere `url`

**Pricing:** Setear `retail_price` en cada variante. El margin fixer cron sobreescribira si el margen es <35%, asi que poner precio correcto desde el inicio.

### Step 4: Generate Mockups

Seguir workflow de [MOCKUPS.md](MOCKUPS.md). Generar Ghost mockups para todos los colores dark seleccionados con vistas Front, Left, y Back.

### Step 5: Update Supabase

```javascript
const ts = Math.floor(Date.now() / 1000)

// 1. Crear o actualizar producto en Supabase
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Solo texto creativo/marketing. Sin specs aqui.',
  translations: {
    es: { title: 'Título en español', description: 'Descripción en español' },
    de: { title: 'Titel auf Deutsch', description: 'Beschreibung auf Deutsch' }
  },
  base_price_cents: 8995,
  compare_at_price_cents: 6499, // Original price (strikethrough) — must be > base_price_cents
  images: [
    { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Product Name - Black' },
    { src: `https://.../mockups/slug/french-navy-front.png?v=${ts}`, alt: 'Product Name - French Navy' },
    { src: `https://.../mockups/slug/black-back.png?v=${ts}`, alt: 'Product Name - Black - Back' },
    { src: `https://.../mockups/slug/french-navy-back.png?v=${ts}`, alt: 'Product Name - French Navy - Back' },
    { src: `https://.../mockups/slug/black-sleeve_left.png?v=${ts}`, alt: 'Product Name - Black - Sleeve' },
  ],
  product_details: {
    safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% organic combed ring-spun cotton</p><p><strong>Weight:</strong> 10.3 oz/yd² (350 g/m²)</p><p><strong>Compliance:</strong> GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan, REACH</p>',
    material: '100% organic combed ring-spun cotton, 10.3 oz/yd² (350 g/m²)',
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.',
    print_technique: 'DTG (Direct-to-Garment)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    model: 'Stanley/Stella SASU024',
    tier: 'PREMIUM ECO',
    fit: 'Relaxed / Unisex Organic Hoodie',
    sizing_note: 'US sizes shown — European customers should order a size DOWN',
    certifications: 'GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan'
  },
  pod_provider: 'printful',
  product_template_id: '831',
  provider_product_id: String(pfProductId),
  status: 'active'
})

// 2. Crear variantes de producto — solo 2 colores dark, ambos EU
const DARK_PALETTE = [
  { color: 'Black', hex: '#121212', L: 18 },
  { color: 'French Navy', hex: '#071429', L: 20 },
]
const sizes = ['S', 'M', 'L', 'XL', '2XL']

for (const { color, hex } of DARK_PALETTE) {
  for (const size of sizes) {
    await supabase.from('product_variants').upsert({
      product_id: productId,
      color,
      color_hex: hex,
      size,
      is_enabled: true,
      image_url: `https://.../mockups/slug/${colorSlug}-front.png?v=${ts}`,
      external_variant_id: String(variantId), // Printful catalog variant ID
    })
  }
}

// 3. Deshabilitar variantes de colores claros
await supabase
  .from('product_variants')
  .update({ is_enabled: false })
  .eq('product_id', productId)
  .in('color', ['Heather Grey', 'White'])
```

### Step 6: GPSR Compliance

Cada producto DEBE tener datos GPSR en `product_details` antes de ir a produccion. Obligatorio bajo EU Regulation 2023/988.

```json
{
  "safety_information": "<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% organic combed ring-spun cotton</p><p><strong>Weight:</strong> 10.3 oz/yd² (350 g/m²)</p><p><strong>Certifications:</strong> GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan</p><p><strong>Compliance:</strong> REACH, EU Regulation 2023/988 (GPSR)</p><p><strong>Sourced from:</strong> Bangladesh</p>",
  "material": "100% organic combed ring-spun cotton, 10.3 oz/yd² (350 g/m²)",
  "care_instructions": "Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.",
  "print_technique": "DTG (Direct-to-Garment)",
  "manufacturing_country": "Latvia",
  "brand": "SKAPARA",
  "certifications": "GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan"
}
```

---

## Workflow 2: Update Existing Product Branding

Usar cuando cambian los assets de branding o al agregar branding a productos existentes.

### Step 1: Get Current Product State

```bash
curl -s "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" | jq '.result.sync_variants[] | {id, name, files: [.files[].type]}'
```

### Step 2: Render Updated Branding (si es necesario)

Ver [BRANDING.md](BRANDING.md) para comandos ImageMagick de renderizado. Omitir si se usan file IDs existentes.

### Step 3: Upload New Files (si es necesario)

Upload via `POST /files`. Guardar el `id` retornado.

### Step 4: Update All Variants (Bulk)

```bash
curl -X PUT "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "X-PF-Store-Id: ${STORE}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_variants": [
      {
        "id": SYNC_VARIANT_ID_1,
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": LABEL_INSIDE_SMARK_FILE_ID}
        ]
      },
      ...repetir para todas las variantes activas...
    ]
  }'
```

Rate limit: `delay(2000)` entre updates per-variant, `delay(3000)` entre productos.

### Step 5: Regenerate Mockups

Despues del branding update, regenerar mockups per [MOCKUPS.md](MOCKUPS.md) y actualizar `products.images[]` en Supabase con fresh `?v=timestamp` cache-busting.

---

## Supabase Integration

### Image URL Pattern

Todas las imagenes de mockup se almacenan en Supabase Storage bajo `designs/mockups/{product-slug}/`:

```
designs/mockups/{product-slug}/{color-slug}-front.png
designs/mockups/{product-slug}/{color-slug}-back.png
designs/mockups/{product-slug}/{color-slug}-sleeve_left.png
```

Public URLs SIEMPRE incluyen cache-buster:
```
${SUPABASE_URL}/storage/v1/object/public/designs/mockups/{slug}/{color}-{placement}.png?v={timestamp}
```

### Alt Text Convention (Critico para el Frontend)

La funcion `buildVariantImageMap()` en `product-detail-cache.ts` parsea alt text para mapear imagenes a variantes de color:

| Placement | Alt Text Pattern | Example |
|---|---|---|
| Front | `"Title - ColorName"` | `"Eco Hoodie - Black"` |
| Back | `"Title - ColorName - Back"` | `"Eco Hoodie - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Eco Hoodie - Black - Sleeve"` |

**Orden de imagenes en `products.images[]`:** Fronts (todos los colores) luego Backs (todos los colores) luego Sleeves. Primera imagen = hero para shop listing.

---

## Techniques Available

| Technique | EU Available | Notes |
|---|---|---|
| DTG printing | YES (in stock) | Default — full color, photo-quality |
| Embroidery | YES (in stock) | Max 15 thread colors (ver BRANDING.md) |
| DTF printing | NO | NOT fulfillable in EU |

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| Temporary URLs | Mockup S3 URLs expiran ~24h | Siempre descargar + re-upload a Supabase Storage |
| Python urllib blocked | Cloudflare rechaza Python urllib contra Printful | Usar curl o Node.js fetch |
| `back` vs `label_outside` vs `back_large` | Mutuamente excluyentes — no se pueden combinar | Elegir UNO de los tres |
| Margin fixer | Cron sync sobreescribe precios si margen <35% | Poner precio correcto en Printful PRIMERO |
| Cloudflare 403 | Missing User-Agent causa bloqueos | Siempre incluir `User-Agent: POD-AI-Store/1.0` |
| Front canvas 1875x1875 | Diferente de M2580 (1800x1800) y tees (1800x2400) | Disenos deben adaptarse al canvas especifico |
| Sleeves VERTICAL | 450x1800, igual que M2580, NO como MC1087 (600x525) | Usar archivos de branding compartidos M2580/M2480 |
| Solo 2 colores dark | Menos variedad que M2580 (9 dark) | Normalmente usar ambos (Black + French Navy) |
| Alto base cost | $45.89 S-XL, $47.89 2XL | Retail price debe ser $80-100+ para 35% margen |
| EU sizing runs large | Stanley/Stella talla europea tiende a ser mas grande | Agregar sizing_note: pedir talla MENOR |
| No 3XL | Solo hasta 2XL (vs M2580 que tiene 3XL) | Aceptable — 5 tallas cubren 95%+ del mercado |
| `label_inside` 600x600 | Diferente de M2580 (750x750) — NO reutilizar archivo | Renderizar nuevo archivo a 600x600 DPI 300 |
| `front` cost $5.95 | NO incluido gratis (a diferencia de M2580) | Incluir en calculo de pricing |

---

## Variant Reference

Ver [VARIANTS.md](VARIANTS.md) para la tabla completa de las 20 variantes (4 colores x 5 tallas) con catalog variant IDs, hex codes, luminance values, EU availability, y status.

## Branding Reference

Ver [BRANDING.md](BRANDING.md) para SASU024-specific branding placements, render commands, file IDs, y anti-patterns.

## Mockup Reference

Ver [MOCKUPS.md](MOCKUPS.md) para SASU024-specific mockup generation, option groups, gallery structure, y rate limits.
