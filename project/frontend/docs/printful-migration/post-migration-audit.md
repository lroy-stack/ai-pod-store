# Auditoría Post-Migración Printful — Estado Real

Fecha: 2026-03-02
Productos auditados: 20 camisetas (6 PREMIUM MC1087 + 14 SIGNATURE CC1717)

---

## 1. ESTADO DE LAS IMÁGENES EN LA FICHA DE PRODUCTO

### Problema confirmado: `colorImageIndices` vacío

La API `/api/products/[id]` devuelve `colorImageIndices: {}` para TODOS los productos Printful.

**Causa**: `buildImageMap()` en `route.ts:91-108` busca `printify_variant_id` en las URLs de imagen. Las variantes Printful tienen `printify_variant_id = NULL` y las URLs de Printful (`files.cdn.printful.com/files/xxx/...`) no contienen variant IDs.

**Resultado**: La galería muestra las 10 imágenes mezcladas. Al seleccionar un color no se filtra nada.

### Contenido actual de `images[]` por producto

Cada producto tiene **10 imágenes**:
- `[0-4]` Mockups planos con diseño impreso (uno por color, 800x800px PNG)
  - Generados automáticamente por Printful como `type=preview` (CC1717) o `type=mockup` (MC1087)
  - MUESTRAN el diseño correctamente
- `[5-9]` Fotos de modelo SIN diseño (uno por color, 700x1000px JPG)
  - Son `product.image` del catálogo Printful — fotos genéricas del blank
  - NO muestran el diseño — **confunden al usuario**

### Ejemplo: "Absolutely Right" (SIGNATURE CC1717)

| Índice | Tipo | Color | Contenido | URL |
|--------|------|-------|-----------|-----|
| 0 | Mockup con diseño | Black | ✅ Camiseta negra con texto "YOU'RE ABSOLUTELY RIGHT!" | `files/5dc/...preview.png` |
| 1 | Mockup con diseño | Pepper | ✅ Camiseta gris con diseño | `files/453/...preview.png` |
| 2 | Mockup con diseño | Graphite | ✅ Camiseta grafito con diseño | `files/bd7/...preview.png` |
| 3 | Mockup con diseño | Ivory | ⚠️ Diseño apenas visible sobre fondo claro | `files/b59/...preview.png` |
| 4 | Mockup con diseño | True Navy | ✅ Camiseta navy con diseño | `files/89e/...preview.png` |
| 5 | Foto modelo SIN diseño | Black | ❌ Persona con camiseta negra lisa | `products/586/15114_...jpg` |
| 6 | Foto modelo SIN diseño | Pepper | ❌ Persona con camiseta lisa | `products/586/17693_...jpg` |
| 7 | Foto modelo SIN diseño | Graphite | ❌ Persona con camiseta lisa | `products/586/21264_...jpg` |
| 8 | Foto modelo SIN diseño | Ivory | ❌ Persona con camiseta crema lisa | `products/586/16523_...jpg` |
| 9 | Foto modelo SIN diseño | True Navy | ❌ Persona con camiseta lisa | `products/586/15181_...jpg` |

### Origen de cada tipo de imagen

| Tipo | Campo Printful | `visible` | Dimensiones | Muestra diseño |
|------|---------------|-----------|-------------|----------------|
| Mockup plano | `files[type=preview/mockup].preview_url` | false | 800x800 / 1000x1000 | ✅ Sí |
| Foto modelo blank | `sync_variant.product.image` | N/A | 700x1000 | ❌ No |
| Design file | `files[type=default/front].preview_url` | true | 1800x2400 | Solo diseño, no camiseta |
| Label file | `files[type=label_outside].preview_url` | true | 450x450 | Solo S mark |

---

## 2. COLORES INCOMPATIBLES CON DISEÑOS

### Regla: 95% de diseños son para fondos oscuros

Los diseños usan texto blanco/fantasma + colores brillantes (cobre, púrpura, verde). Sobre fondo claro el texto blanco desaparece.

### Colores actuales por tier

**SIGNATURE (CC1717) — 5 colores:**
| Color | Hex aprox. | Compatible | Nota |
|-------|-----------|:---:|------|
| Black | #000000 | ✅ | Hero color |
| Pepper | #3B3B3B | ✅ | Gris oscuro garment-dyed |
| Graphite | #5C5C5C | ✅ | Gris medio |
| **Ivory** | **#F5F0E1** | **❌** | **Fondo crema — diseño invisible** |
| True Navy | #1B2A4A | ✅ | Azul oscuro |

**PREMIUM (MC1087) — 5 colores:**
| Color | Hex aprox. | Compatible | Nota |
|-------|-----------|:---:|------|
| Black | #000000 | ✅ | Hero color |
| Navy Blazer | #1B2A4A | ✅ | Azul oscuro |
| Vintage Black | #2A2A2A | ✅ | Negro lavado |
| **Vintage White** | **#E8E0D0** | **❌** | **Fondo blanco vintage — diseño invisible** |
| **White** | **#FFFFFF** | **❌** | **Fondo blanco — diseño invisible** |

### Acción: desactivar via `is_enabled = false`
- SIGNATURE: Ivory (14 productos × 7 tallas = 98 variantes)
- PREMIUM: White + Vintage White (6 productos × 7 tallas × 2 = 84 variantes)
- **Total a desactivar: 182 variantes**

---

## 3. PRODUCT_DETAILS Y GPSR

### Estado actual: ✅ CORRECTO (ya es de Printful)

El script `migrate-phase1-04` ya actualizó `product_details` con datos de Printful:

```json
{
  "brand": "SKAPARA",
  "model": "Comfort Colors 1717",  // o "Cotton Heritage MC1087"
  "material": "100% ring-spun cotton, 6.1oz (207gsm), garment-dyed",
  "provider_name": "Printful",
  "print_technique": "DTG (Direct-to-Garment)",
  "care_instructions": "Machine wash cold inside out. Tumble dry low. Do not bleach. Do not iron on print.",
  "manufacturing_country": "LV",
  "safety_information": "<div class='gpsr-info'><h4>EU Product Safety (GPSR 2023/988)</h4><p><strong>Manufacturer:</strong> SIA Printful Latvia, Gandiju iela 88, Marupe, LV-2167, Latvia</p>...</div>"
}
```

El `safety_information` ya menciona **SIA Printful Latvia** como manufacturer. NO son datos residuales de Printify.

La ficha de producto muestra estos datos en dos secciones:
- **Especificaciones**: material, care instructions, print technique, manufacturing country
- **GPSR**: colapsable `<details>` con HTML sanitizado

---

## 4. CANVAS / POSICIONES DE IMPRESIÓN DISPONIBLES

### CC1717 (Comfort Colors 1717) — Catalog ID 586

| Posición | ID Printful | Coste adicional USD | Canvas | Uso actual |
|----------|------------|-------------------:|--------|-----------|
| `front` (default) | default | $0.00 (incluido) | 1800×2400 @150dpi | ✅ Diseño principal |
| `back` | back | +$5.25 | 1800×2400 @150dpi | ❌ No usado |
| `sleeve_left` | sleeve_left | +$2.20 | 600×525 @150dpi | ❌ No usado |
| `sleeve_right` | sleeve_right | +$2.20 | 600×525 @150dpi | ❌ No usado |
| `label_outside` | label_outside | +$2.20 | 450×450 @150dpi | ✅ S mark blanco |
| `front_dtf` | front_dtf | +$5.25 | (DTF alternativo) | ❌ |
| `back_dtf` | back_dtf | +$5.25 | (DTF alternativo) | ❌ |
| `short_sleeve_left_dtf` | short_sleeve_left_dtf | +$2.20 | (DTF alternativo) | ❌ |
| `short_sleeve_right_dtf` | short_sleeve_right_dtf | +$2.20 | (DTF alternativo) | ❌ |
| `embroidery_chest_left` | embroidery_chest_left | +$2.60 | Bordado | ❌ |
| `embroidery_chest_center` | embroidery_chest_center | +$2.60 | Bordado | ❌ |
| `embroidery_sleeve_left_top` | embroidery_sleeve_left_top | +$2.60 | Bordado | ❌ |
| `embroidery_sleeve_right_top` | embroidery_sleeve_right_top | +$2.60 | Bordado | ❌ |

**Resumen DTG relevante**: front (incluido), back (+$5.25), sleeve_left (+$2.20), sleeve_right (+$2.20), label_outside (+$2.20)

### MC1087 (Cotton Heritage MC1087) — Catalog ID 917

| Posición | ID Printful | Coste adicional USD | Canvas | Uso actual |
|----------|------------|-------------------:|--------|-----------|
| `front` | front | $0.00 (incluido) | 1800×2400 @150dpi | ✅ Diseño principal |
| `back` | back | +$5.25 | 1800×2400 @150dpi | ✅ Wordmark blanco |
| `sleeve_left` | sleeve_left | +$2.20 | 600×525 @150dpi | ❌ No usado |
| `sleeve_right` | sleeve_right | +$2.20 | 600×525 @150dpi | ❌ No usado |
| `label_outside` | label_outside | +$2.20 | 450×450 @150dpi | ❌ No usado |
| `label_inside` | label_inside | +$0.99 | 450×450 @150dpi | ❌ No usado |
| `front_dtf` | front_dtf | +$5.25 | (DTF alternativo) | ❌ |
| `back_dtf` | back_dtf | +$5.25 | (DTF alternativo) | ❌ |
| `embroidery_*` (4 posiciones) | — | +$2.60 cada | Bordado | ❌ |

**Resumen DTG relevante**: front (incluido), back (+$5.25), sleeve_left (+$2.20), sleeve_right (+$2.20), label_outside (+$2.20), label_inside (+$0.99)

### Assets de branding disponibles (`public/brand/`)

| Archivo | Formato | Uso sugerido |
|---------|---------|-------------|
| `skapara-mark-white.svg` | SVG vectorial | sleeve_left (→ render 600×525), label_outside (→ render 450×450) |
| `skapara-mark-dark.svg` | SVG vectorial | Para fondos claros (si hubiese) |
| `skapara-mark-color.svg` | SVG vectorial | Gradiente, para uso especial |
| `skapara-wordmark-dark.svg` | SVG vectorial | Back print para fondos claros |
| `skapara-wordmark-white.svg` | SVG vectorial | Back print — **ya subido a Printful como `back-wordmark-white`** |

### Assets ya subidos a Printful File Library

| Nombre | Printful File ID | Posición | Estado |
|--------|-----------------|----------|--------|
| `label-outside-smark-white` | 950267951 | label_outside | ✅ En uso (SIGNATURE) |
| `back-wordmark-white` | 950267989 | back | ✅ En uso (PREMIUM) |
| **Falta: sleeve S mark** | — | sleeve_left | ❌ No existe |
| **Falta: back lockup** | — | back (SIGNATURE) | ❌ No existe |

---

## 5. FLUJO FRONTEND: CÓMO SE RENDERIZAN LAS IMÁGENES

### Pipeline completo

```
Supabase products.images[] (array de {src, alt})
  ↓
/api/products/[id]/route.ts
  ├── Extrae src de cada imagen → allImages[] (array de strings)
  ├── buildImageMap('color') → busca printify_variant_id en URLs
  │   └── FALLA para Printful (printify_variant_id = NULL)
  ├── buildImageMap('size') → mismo problema
  └── Devuelve: images[], colorImageIndices: {}, sizeImageIndices: {}
  ↓
ProductDetailClient.tsx
  ├── visibleImages =
  │   ├── SI colorImageIndices[selectedColor] → filtrar por índices
  │   ├── ELSE SI sizeImageIndices[selectedSize] → filtrar por índices
  │   └── ELSE → TODAS las imágenes (fallback actual)
  ├── Galería: main image + thumbnails de visibleImages[]
  └── Al cambiar color → colorImageIndices vacío → NO filtra → muestra todo
```

### Para ProductCard (listado /shop)

```
/api/products/route.ts
  ├── Queries product_variants WHERE is_enabled=true AND is_available=true
  ├── Agrupa por color → primera image_url por color = colorImages{}
  └── Devuelve: colorImages: { "Black": "url...", "Pepper": "url..." }
  ↓
ProductCard.tsx
  ├── Muestra swatches de color con image thumbnails
  ├── Al hover/click cambia displayImage al mockup de ese color
  └── FUNCIONA correctamente (usa image_url directo, no printify_variant_id)
```

**Resultado**: El listado de la tienda (/shop) SÍ funciona. La ficha individual NO filtra.

---

## 6. RESUMEN DE PROBLEMAS Y ACCIONES

| # | Problema | Severidad | Acción |
|---|---------|-----------|--------|
| 1 | `colorImageIndices` vacío → galería mezclada | **CRÍTICO** | Modificar `buildImageMap()` para usar `image_url` de variantes |
| 2 | Fotos modelo sin diseño en galería | **ALTO** | Eliminar `product.image` (blanks) de `images[]` — solo mockups con diseño |
| 3 | Colores claros incompatibles | **ALTO** | `is_enabled=false` para Ivory, White, Vintage White |
| 4 | Falta branding en sleeve_left | **MEDIO** | Renderizar S mark → subir → recrear sync products |
| 5 | Falta branding back (SIGNATURE) | **MEDIO** | Renderizar lockup → subir → recrear sync products |
| 6 | GPSR/specs | **OK** | Ya es de Printful, datos correctos |
