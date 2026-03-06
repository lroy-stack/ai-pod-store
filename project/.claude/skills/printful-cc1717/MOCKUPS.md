# Mockup Generation — CC1717 (Catalog 586) SIGNATURE Tier

---

## Qué Generamos

**Ghost transparente, 3 vistas por color.** Nada más.

```json
{
  "option_groups": ["Ghost"],
  "options": ["Front", "Left", "Back"],
  "format": "png",
  "width": 1000
}
```

| Vista | En la respuesta API | Muestra | Archivo |
|---|---|---|---|
| **Front** | `mockup_url` (raíz) | Diseño frontal (hero) | `{color}-front.png` |
| **Back** | `extra[].title === "Back"` → `.url` | SKAPARA wordmark | `{color}-back.png` |
| **Left** | `extra[].title === "Left"` → `.url` | S mark manga izquierda | `{color}-left.png` |

**Total por producto = N colores compatibles × 3 vistas**

---

## Selección de Colores: Design-First Contrast

La paleta del DISEÑO determina qué colores de prenda son compatibles. No hay un número fijo — se evalúa por diseño.

### Regla 1 — Visibilidad de tinta blanca (luminancia < 50)

El 90% de nuestros diseños usan texto blanco/ghost. DTG imprime tinta blanca opaca sobre tela oscura. Para legibilidad a 3m, la prenda necesita luminancia relativa < ~50.

**24 colores pasan este filtro:**

| Color | Hex | L | Familia |
|---|---|---|---|
| Black | `#1b1b1c` | 10 | Neutro |
| True Navy | `#1e2c4a` | 16 | Azul |
| Graphite | `#3e3737` | 22 | Neutro |
| Navy | `#424150` | 26 | Azul |
| Sage | `#49482e` | 28 | Verde |
| Midnight | `#3a4e63` | 30 | Azul |
| Red | `#bb1035` | 30 | Rojo |
| Hemp | `#4F5232` | 31 | Verde |
| Pepper | `#514f4c` | 32 | Neutro |
| Grape | `#644E6D` | 34 | Púrpura |
| Denim | `#565a67` | 36 | Azul |
| Blue Spruce | `#4c6151` | 37 | Verde |
| Brick | `#8d4b54` | 37 | Rojo |
| Berry | `#8e5a7b` | 42 | Rosa |
| Crimson | `#bb5151` | 42 | Rojo |
| Espresso | `#87634a` | 43 | Marrón |
| Mystic Blue | `#5068AB` | 43 | Azul |
| Moss | `#6b7053` | 44 | Verde |
| Flo Blue | `#5669be` | 45 | Azul |
| Paprika | `#fe4747` | 47 | Naranja |
| Watermelon | `#d15c68` | 48 | Rojo |
| Yam | `#db642f` | 48 | Naranja |
| Light Green | `#608267` | 49 | Verde |
| Blue Jean | `#707e8d` | 50 | Azul |

**21 colores NO pasan (L > 50) — texto blanco ilegible:**

| Color | Hex | L | Familia |
|---|---|---|---|
| Ice Blue | `#7a9096` | 57 | Azul |
| Burnt Orange | `#FF7842` | 58 | Naranja |
| Grey | `#92928f` | 59 | Neutro |
| Crunchberry | `#ff748e` | 59 | Rosa |
| Violet | `#9a8ad2` | 60 | Púrpura |
| Seafoam | `#69a999` | 63 | Verde |
| Terracotta | `#ff9364` | 66 | Naranja |
| Granite | `#a6abaa` | 68 | Neutro |
| Washed Denim | `#98aed1` | 68 | Azul |
| Khaki | `#b3ab8b` | 69 | Neutro |
| Bay | `#b8bfab` | 75 | Verde-gris |
| Mustard | `#ffbc5a` | 78 | Amarillo |
| Lagoon Blue | `#92dedb` | 83 | Aqua |
| Orchid | `#ead3f2` | 86 | Púrpura |
| Blossom | `#ffd6e1` | 88 | Rosa |
| Butter | `#ffe09e` | 90 | Amarillo |
| Chalky Mint | `#a1f2dc` | 90 | Aqua |
| Island Reef | `#b8ffca` | 94 | Verde |
| Chambray | `#d9f3ff` | 95 | Azul |
| Ivory | `#fff4d9` | 97 | Neutro |
| White | `#ffffff` | 100 | Neutro |

### Regla 2 — Conflicto de matiz (hue clash)

Si el diseño usa un color de acento, excluir prendas donde ese acento se pierde por matiz similar:

| Color del diseño | Hex | Excluir prendas |
|---|---|---|
| Naranja (punchlines) | `#F97316` | Paprika, Yam, Burnt Orange, Terracotta, Mustard |
| Verde (terminal) | `#10B981` | Light Green, Seafoam, Moss, Blue Spruce (borderline) |
| Rojo (errores, diffs) | `#EF4444` | Red, Crimson, Brick, Paprika, Watermelon |
| Púrpura (definiciones) | `#A78BFA` | Violet, Grape, Orchid |
| Ámbar (highlights) | `#F59E0B` | Mustard, Yam, Espresso |
| Índigo (Sonnet label) | `#6366F1` | Flo Blue, Mystic Blue |
| Cobre (atribuciones) | `#D97706` | Espresso, Yam, Burnt Orange |

### Regla 3 — Armonía estética

De los colores que pasan Reglas 1 y 2, seleccionar por mood:

| Mood del diseño | Colores que encajan |
|---|---|
| Tech / terminal / code | Neutrales fríos: Black, Graphite, Pepper, True Navy, Navy, Midnight, Denim |
| Vintage / orgánico | Tierra: Sage, Hemp, Espresso, Pepper, Blue Spruce, Moss |
| Saturado / maximalista | Color: Red, Grape, Berry, Flo Blue, Mystic Blue, Crimson |
| Universal (todos) | Black, Graphite, Pepper, True Navy — **estos 4 van SIEMPRE** |

### Ejemplo: "Three Models"

```
Paleta: white ghost, #10B981 (verde), #6366F1 (índigo), #F97316 (naranja)

Regla 1: 24 colores con L < 50
Regla 2:
  - Verde → -Light Green, -Seafoam, -Moss
  - Índigo → -Flo Blue, -Mystic Blue
  - Naranja → -Yam, -Paprika
Regla 3: Mood tech → priorizar neutrales fríos + azules

→ Black, Graphite, Pepper, True Navy, Navy, Midnight, Denim,
  Sage, Hemp, Blue Spruce, Grape, Berry, Brick, Red,
  Espresso, Crimson, Watermelon, Blue Jean
→ 18 colores × 3 vistas = 54 mockups
```

### Ejemplo: "Scope Creep"

```
Paleta: white ghost, #F97316 (naranja), #10B981 (verde), #EF4444 (rojo)

Regla 2:
  - Naranja → -Yam, -Paprika
  - Verde → -Light Green, -Seafoam, -Moss
  - Rojo → -Red, -Crimson, -Brick, -Watermelon

→ Black, Graphite, Pepper, True Navy, Navy, Midnight, Denim,
  Sage, Hemp, Blue Spruce, Grape, Berry, Espresso,
  Mystic Blue, Flo Blue, Blue Jean
→ 16 colores × 3 vistas = 48 mockups
```

### Ejemplo: "Dangerous Flag" (monocromático)

```
Paleta: SOLO white ghost (sin acentos de color)

Regla 2: Sin conflictos de hue (no hay acentos)

→ TODOS los 24 colores con L < 50
→ 24 colores × 3 vistas = 72 mockups
```

---

## API Response Structure (VERIFICADO 2026-03-05)

**CRÍTICO:** Cuando se envían los 3 file placements (front, back, sleeve_left), la API devuelve **UN objeto `mockups[]` por placement** — cada vista es un entry separado, NO extras.

```json
{
  "result": {
    "status": "completed",
    "mockups": [
      {
        "placement": "front",
        "variant_ids": [15114],
        "mockup_url": "https://s3.amazonaws.com/.../front-view.png"
      },
      {
        "placement": "back",
        "variant_ids": [15114],
        "mockup_url": "https://s3.amazonaws.com/.../back-view.png"
      },
      {
        "placement": "sleeve_left",
        "variant_ids": [15114],
        "mockup_url": "https://s3.amazonaws.com/.../left-view.png"
      }
    ]
  }
}
```

### Campos de `mockups[]`:

| Campo | Tipo | Descripción |
|---|---|---|
| `placement` | string | `"front"`, `"back"`, o `"sleeve_left"` — uno por file enviado |
| `variant_ids` | number[] | IDs de variantes usados |
| `mockup_url` | string | URL directa a la imagen de esa vista |
| `extra` | array | Opcional, presente si se envían menos files que options |

### Nota sobre `extra[]`:

Si se envían **menos** file placements que options solicitados, las vistas faltantes aparecen como `extra[]` en otro mockup. Ejemplo: si solo envías front + sleeve_left pero pides option "Back", el Back aparece como extra en el mockup de sleeve_left.

**Regla: SIEMPRE enviar los 3 files** (front, back, sleeve_left) para obtener 3 mockups separados sin ambigüedad.

---

## Código de Extracción (CORRECTO — verificado 2026-03-05)

```javascript
async function extractMockups(taskResult, colorSlug, productSlug) {
  const images = [];
  // Cada placement viene como un mockups[] entry separado
  for (const mock of taskResult.mockups) {
    const placement = mock.placement; // 'front', 'back', 'sleeve_left'
    const viewName = placement === 'sleeve_left' ? 'left' : placement;
    images.push({
      url: mock.mockup_url,
      placement: viewName,
      path: `designs/mockups/${productSlug}/${colorSlug}-${viewName}.png`
    });
  }
  return images;
}
```

**NO buscar en `extra[]`** cuando se envían los 3 file placements. Cada vista es un `mockups[]` entry con su propio `mockup_url`.

---

## API Call Completo

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/586" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [15114],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Left", "Back"],
    "files": [
      {
        "placement": "front",
        "image_url": "https://PERMANENT_URL/design-front.png",
        "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 }
      },
      {
        "placement": "sleeve_left",
        "image_url": "https://PERMANENT_URL/sleeve-branding.png",
        "position": { "area_width": 600, "area_height": 525, "width": 600, "height": 525, "top": 0, "left": 0 }
      },
      {
        "placement": "back",
        "image_url": "https://PERMANENT_URL/back-branding.png",
        "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 }
      }
    ]
  }'
```

**Polling:** `GET /mockup-generator/task?task_key=gt-XXX` cada 3s. Status: `pending`, `completed`, `failed`.

---

## Storage y Galería

### Path en Supabase Storage

```
designs/mockups/{product-slug}/{color-slug}-{placement}.png
```

### Upload (S3 temporal → Supabase permanente)

```javascript
const buf = await fetch(mockupUrl).then(r => r.arrayBuffer());
await fetch(`${SUPABASE_URL}/storage/v1/object/designs/mockups/${slug}/${color}-${view}.png`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    apikey: SUPABASE_SERVICE_KEY,
    'Content-Type': 'image/png',
    'x-upsert': 'true',
  },
  body: Buffer.from(buf),
});
```

**SIEMPRE `?v=timestamp` en URLs guardadas en DB** (cache-busting).

### Orden en `products.images[]`

1. **Fronts** de todos los colores (primer front = hero del listing)
2. **Backs** de todos los colores
3. **Sleeves** de todos los colores

### Alt Text (crítico para el frontend)

| Vista | Patrón | Ejemplo |
|---|---|---|
| Front | `"Title - ColorName"` | `"Three Models - Black"` |
| Back | `"Title - ColorName - Back"` | `"Three Models - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Three Models - Black - Sleeve"` |

`buildVariantImageMap()` usa el substring `"- ColorName"` para mapear imágenes a variantes. **ColorName debe coincidir exactamente** con `product_variants.color`.

---

## Rate Limits

| Operación | Límite | Delay |
|---|---|---|
| API general | ~120 req/min | `delay(2000)` |
| Crear task mockup | ~10 tasks/min | `delay(10000)` entre tasks |
| Polling task | Sin límite específico | cada 3000ms |

Estimación: N colores × 10s = tiempo de creación. 16 colores = ~2.7 min + polling.

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.

---

## Referencia: Option Groups Disponibles (15)

Usamos **solo Ghost**. El resto es referencia para expansión futura.

| # | option_group | Fondo | Descripción |
|---|---|---|---|
| 1 | **Ghost** | **Transparente** | **EL QUE USAMOS.** Camiseta flotante, 4 ángulos |
| 2 | Flat | Blanco | Top-down plana, etiqueta visible |
| 3 | Flat 2 | Blanco | Variación flat |
| 4 | Flat 3 | Blanco | Tercera variación flat |
| 5 | Folded | Blanco | Plegada 3D |
| 6 | Men's | Blanco | Modelo masculino frontal |
| 7 | Men's 2 | Blanco | Modelo masculino cuerpo completo |
| 8 | Men's 3 | Blanco | Modelo masculino 3/4 |
| 9 | Women's | Blanco | Modelo femenina |
| 10 | Women's 2 | Blanco | Modelo femenina alternativa |
| 11 | Zoomed in | Color de tela | Macro textura DTG |
| 12 | Collage | Blanco | Composición multi-vista |
| 13 | Collage Ghost | Transparente | Collage ghost |
| 14 | Labels | Blanco | Detalle etiqueta |
| 15 | Product details | Blanco | Detalles de construcción |

---

## IMPORTANTE: Estructura de Respuesta según Files Enviados (Verificado 2026-03-05)

La estructura de `mockups[]` depende de cuántos `files` placements se envían:

| Files enviados | Respuesta |
|---|---|
| front + back + sleeve_left (3) | **3 mockups[]** separados, cada uno con `placement` y `mockup_url`. Sin `extra[]`. |
| front + sleeve_left (2) | **2 mockups[]** + Back aparece como `extra[]` en mockups[1] |
| front solo (1) | **1 mockup[]** + Back/Left aparecen como `extra[]` |

**Regla: SIEMPRE enviar los 3 files** para obtener la estructura más limpia (3 mockups separados).

**NO hay Ghost Duplicate Bug** cuando se envían los 3 file placements correctamente. Todos los colores (Black, Pepper, True Navy, Brick, Navy, Sage, Grape, Graphite, etc.) generan mockups front/back/sleeve distintos.

El supuesto "duplicate bug" documentado anteriormente era causado por un error en el código de extracción que buscaba vistas en `extra[]` en vez de iterar sobre `mockups[]`.

---

## Bug en Código del Proyecto

`frontend/src/lib/pod/printful/client.ts` tiene el tipo mal:

```typescript
// MAL (actual):
extra?: Array<{ variant_id?: number; url?: string }>

// BIEN (API real):
extra?: Array<{ title: string; url: string; option: string; option_group: string }>
```
