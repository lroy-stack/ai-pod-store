# Mockup Generation — G18600 (Catalog 692) STANDARD Zip Hoodie

---

## Que Generamos

**Ghost transparente, 3 vistas por color.** Nada mas.

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
| **Front** | `mockup_url` (raiz) | Diseno frontal con zip overlay (hero) | `{color}-front.png` |
| **Back** | `extra[].title === "Back"` -> `.url` | SKAPARA wordmark | `{color}-back.png` |
| **Left** | `extra[].title === "Left"` -> `.url` | S mark manga izquierda | `{color}-left.png` |

**IMPORTANT:** The front mockup template (198414) includes a `background_url` with the zip overlay. The API automatically composites the zipper on top of the design.

---

## Seleccion de Colores: Design-First Analysis (OBLIGATORIO)

**REGLA FUNDAMENTAL:** Los colores se eligen EN FUNCIÓN DEL DISEÑO, no como lista fija. No existe "siempre usar Black". Cada diseño se analiza antes de elegir colores.

### Paso 0 — Paleta de colores disponibles (dark, EU)

| Color | Hex | L | Neutro? | Sizes | Notas |
|---|---|---|---|---|---|
| Black | `#0b0b0b` | 11 | SI | S-5XL (8) | Muy oscuro — malo para diseños con elementos negros |
| Navy | `#15263c` | 35 | CASI | S-5XL (8) | Azul muy oscuro, casi negro |
| Dark Heather | `#3c3d44` | 61 | SI | S-3XL (6) | Gris medio — excelente contraste para elementos oscuros. OJO: solo 6 tallas |
| Royal | `#1d57a5` | 79 | NO | S-5XL (8) | Azul evidente — verificar conflicto de hue con azules del diseño |

### Paso 1 — Analizar la paleta del diseño

Antes de elegir CUALQUIER color de prenda, responder estas preguntas:

1. **¿Qué colores dominantes tiene el diseño?** (no solo el texto — también siluetas, iconos, fondos)
2. **¿Tiene el diseño elementos OSCUROS?** (siluetas negras, sombras, outlines dark)
3. **¿Tiene el diseño elementos en colores saturados?** (azul, verde, rojo, púrpura)
4. **¿Es mayoritariamente texto blanco sobre transparente?** (el caso más simple)

### Paso 2 — Evaluar contraste: 3 reglas

**Regla 1 — Visibilidad de elementos claros (texto blanco)**
Los 4 colores dark pasan (L < 100). Texto blanco es legible en todos.

**Regla 2 — Visibilidad de elementos OSCUROS del diseño**
- Diseño con **silueta/elementos negros** → EXCLUIR Black (#0b0b0b, L=11) — se pierde
- Diseño con **elementos gris oscuro** → EXCLUIR Dark Heather si el gris es similar
- Diseño con **solo texto blanco, sin elementos oscuros** → Todos los colores funcionan

**Regla 3 — Conflicto de matiz (hue clash)**
- Diseño con **elementos azules** → EXCLUIR Royal (#1d57a5) — se confunden
- Diseño **neutro (blanco/negro/gris)** → Sin conflicto de hue con ningún color

### Paso 3 — Seleccionar 2-4 colores óptimos

Aplicar los 3 filtros y seleccionar los colores que pasan todos.

**Ejemplo: diseño con silueta negra + texto blanco**
- Black → EXCLUIDO (silueta invisible)
- Navy → OK (L=35, muy oscuro pero distinguible)
- Dark Heather → MEJOR (L=61, excelente contraste para negro)
- Royal → BUENO (azul, silueta negra destaca)
- Resultado: 3 colores (Navy + Dark Heather + Royal)

**Ejemplo: diseño solo texto blanco**
- Todos los 4 colores funcionan
- Resultado: 4 colores

### Resultado por producto

**Mínimo 2 colores x 3 vistas = 6 mockups Ghost transparentes.**
**Máximo 4 colores x 3 vistas = 12 mockups Ghost transparentes.**
**Típico: 2-3 colores x 3 vistas = 6-9 mockups** por producto.

---

## API Response Structure

Templates API returns NO explicit option_groups (all "default"). Template URLs contain path segments like:
```
unisex_heavy_blend_zip_hoodie_gildan_18600/medium/ghost/front/
unisex_heavy_blend_zip_hoodie_gildan_18600/medium/ghost/back/
unisex_heavy_blend_zip_hoodie_gildan_18600/medium/ghost/left/
unisex_heavy_blend_zip_hoodie_gildan_18600/medium/ghost/right/
```

98 total templates available.

### Response Structure (same pattern as MC1087)

**UN objeto por color** en `mockups[]`, vistas adicionales en `extra[]`.

```json
{
  "result": {
    "status": "completed",
    "mockups": [
      {
        "placement": "front",
        "variant_ids": [17295],
        "mockup_url": "https://s3.amazonaws.com/.../front-view.png",
        "generator_mockup_id": 198414,
        "extra": [
          { "title": "Back", "url": "https://s3...", "option": "Back", "option_group": "Ghost" },
          { "title": "Left", "url": "https://s3...", "option": "Left", "option_group": "Ghost" }
        ]
      }
    ]
  }
}
```

### Campos `mockups[]`:

| Campo | Tipo | Descripcion |
|---|---|---|
| `placement` | string | Siempre `"front"` para apparel Ghost |
| `variant_ids` | number[] | IDs de variantes |
| `mockup_url` | string | Vista Front (principal) — includes zip overlay |
| `generator_mockup_id` | number | ID template interno (198414 for front) |
| `extra` | array | Vistas adicionales |

### Campos `extra[]` (`MockupExtraItem`):

| Campo | Tipo | Descripcion |
|---|---|---|
| `title` | string | "Back", "Left". **Puede cambiar** |
| `url` | string | URL directa a la imagen |
| `option` | string | Identificador del angulo |
| `option_group` | string | Grupo de estilo |

**`extra[]` NO tiene `variant_id`.**

---

## Workflow de Generacion

### 1. Recoger URLs de diseno

```
front:        https://files.cdn.printful.com/files/xxx/xxx_preview.png  (2250x1500 LANDSCAPE!)
sleeve_left:  https://files.cdn.printful.com/files/xxx/xxx_preview.png  (450x1800 VERTICAL)
back:         https://files.cdn.printful.com/files/d52/d52...preview.png  (wordmark v2, shared)
```

### 2. Crear N tasks (1 por color seleccionado via design-first analysis)

**Colores disponibles EU dark (seleccionar 2-4 tras análisis del diseño):**

| # | Color | variant_id (S) | Delay antes |
|---|---|---|---|
| 1 | Black | 17295 | — |
| 2 | Navy | 17311 | 10s |
| 3 | Dark Heather | 17347 | 10s |
| 4 | Royal | 17319 | 10s |

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/692" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [17295],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Left", "Back"],
    "files": [
      {
        "placement": "front",
        "image_url": "https://DESIGN_URL",
        "position": { "area_width": 2250, "area_height": 1500, "width": 2250, "height": 1500, "top": 0, "left": 0 }
      },
      {
        "placement": "sleeve_left",
        "image_url": "https://SLEEVE_BRANDING_URL",
        "position": { "area_width": 450, "area_height": 1800, "width": 450, "height": 1800, "top": 0, "left": 0 }
      },
      {
        "placement": "back",
        "image_url": "https://BACK_BRANDING_URL",
        "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 }
      }
    ]
  }'
```

**IMPORTANT:** Note the front position uses `area_width: 2250, area_height: 1500` (LANDSCAPE) — NOT 1800x2400.

### 3. Poll + Extraer + Descargar

**Polling endpoint:** `GET /mockup-generator/task?task_key={task_key}`

Poll every 3-4 seconds. Status values: `pending` → `completed` or `failed`.

```javascript
// Correct polling pattern
const statusRes = await pf.fetch(`/mockup-generator/task?task_key=${taskKey}`);
if (statusRes.status === 'completed') { /* extract mockups */ }
if (statusRes.status === 'failed') { /* handle error */ }
```

```javascript
async function extractMockups(taskResult, colorSlug, productSlug) {
  const images = [];
  // CRITICAL: Use mockups[0] — all placements share the same mockup_url (front view)
  // Other views are in extra[]
  const m = taskResult.mockups[0];

  images.push({ url: m.mockup_url, path: `designs/mockups/${productSlug}/${colorSlug}-front.png` });

  for (const extra of m.extra || []) {
    const view = extra.title.toLowerCase(); // "back" or "left"
    images.push({ url: extra.url, path: `designs/mockups/${productSlug}/${colorSlug}-${view}.png` });
  }

  return images; // Download from temporary S3 and upload to Supabase Storage
}
```

### 4. Upload a Supabase Storage

```javascript
const buf = await fetch(tempUrl).then(r => r.arrayBuffer());
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

**SIEMPRE `?v=timestamp`** en URLs guardadas en DB (cache-busting).

---

## Storage y Galeria

### Archivos generados por producto (minimo 6, maximo 12)

**Archivos por color seleccionado (3 vistas cada uno):**
```
designs/mockups/{slug}/{color-slug}-front.png
designs/mockups/{slug}/{color-slug}-back.png
designs/mockups/{slug}/{color-slug}-left.png
```

**Ejemplo: diseño con 3 colores seleccionados (Navy + Dark Heather + Royal) = 9 archivos:**
```
designs/mockups/{slug}/navy-front.png
designs/mockups/{slug}/navy-back.png
designs/mockups/{slug}/navy-left.png
designs/mockups/{slug}/dark-heather-front.png
designs/mockups/{slug}/dark-heather-back.png
designs/mockups/{slug}/dark-heather-left.png
designs/mockups/{slug}/royal-front.png
designs/mockups/{slug}/royal-back.png
designs/mockups/{slug}/royal-left.png
```

### Orden en `products.images[]`

1. **Fronts** — Black, Navy, [Dark Heather], [Royal] (primer front = hero)
2. **Backs** — mismos colores
3. **Sleeves** — mismos colores

### Alt Text (critico para el frontend)

| Vista | Patron | Ejemplo |
|---|---|---|
| Front | `"Title - ColorName"` | `"Zip Code - Black"` |
| Back | `"Title - ColorName - Back"` | `"Zip Code - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Zip Code - Black - Sleeve"` |

**ColorName debe coincidir exactamente** con `product_variants.color`: "Navy" (not "Navy Blue" or "navy"), "Dark Heather" (not "Dark-Heather").

---

## Rate Limits

| Operacion | Limite | Delay |
|---|---|---|
| API general | ~120 req/min | `delay(2000)` |
| Crear task mockup | ~10 tasks/min | `delay(10000)` |
| Polling | Sin limite | cada 3000ms |

G18600 minimal (2 colors) = 2 tasks x 10s = **~20s de creacion + ~30s polling = ~1.5 min por producto**.
G18600 typical (3 colors) = 3 tasks x 10s = **~30s de creacion + ~45s polling = ~2 min por producto**.
G18600 full (4 colors) = 4 tasks x 10s = **~40s de creacion + ~60s polling = ~3 min por producto**.

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.

---

## G18600 vs MC1087: Diferencias Clave de Mockup

| Aspecto | G18600 (STANDARD Zip) | MC1087 (PREMIUM Tee) |
|---|---|---|
| Catalog ID | 692 | 917 |
| Front canvas | **2250x1500 LANDSCAPE** | 1800x2400 portrait |
| Sleeve canvas | 450x1800 vertical | 600x525 horizontal |
| Zip overlay | YES (template 198414 has background_url) | No |
| Colores EU dark | 2-4 via design-first analysis | 3 (siempre todos) |
| Seleccion de color | Design-first analysis (contrast + hue) | Automatica (siempre 3) |
| Mockups por producto | 6-12 (variable) | 9 fijos |
| Total templates | 98 | ~50 |
| option_groups explcitos | None (all "default") | 7 named groups |
| Size range | S-5XL (8 sizes) | S-4XL (7 sizes) |
| Product type | Zip hoodie (front splits) | T-shirt (front continuous) |

---

## Referencia: Templates Disponibles

Templates API returns 98 templates, all under "default" option_group. Key patterns in template URLs:

| View | URL Pattern | Notes |
|---|---|---|
| Ghost Front | `.../ghost/front/...` | Template 198414, has background_url (zip overlay) |
| Ghost Back | `.../ghost/back/...` | Standard back view |
| Ghost Left | `.../ghost/left/...` | Shows sleeve branding |
| Ghost Right | `.../ghost/right/...` | Available but unused |
| Flat | `.../flat/...` | Top-down flat lay |
| Model variants | Various | Multiple model shots available |

**We use only Ghost (Front, Back, Left).** The rest is reference for future expansion.

---

## Bug Prevention: Ghost "Duplicate" Extraction

Same bug risk as MC1087 — see MC1087 MOCKUPS.md for full details. Summary:

**The API returns multiple objects in `mockups[]` but ALL share the same `mockup_url` (front view).** Different views are in `extra[]` of the FIRST mockup.

```javascript
// CORRECT extraction:
const m = result.mockups[0];
m.mockup_url                                    // -> front.png
m.extra.find(e => e.title === 'Back').url        // -> back.png
m.extra.find(e => e.title === 'Left').url        // -> left.png

// WRONG — do NOT iterate mockups[]:
// mockups[0].mockup_url -> front (correct)
// mockups[1].mockup_url -> front AGAIN (wrong! not back!)
// mockups[2].mockup_url -> front AGAIN (wrong! not left!)
```

---

## Front Mockup Zip Overlay

The G18600 front mockup template (198414) includes a `background_url` that renders the zipper on top of the design. This means:

1. You do NOT need to add the zipper in your design file
2. The mockup API automatically composites the zip overlay
3. The final mockup accurately shows how the design looks with the zipper splitting it
4. This is why testing your design on the mockup is CRITICAL — you can verify the zip split before production

Always generate a test mockup for the front view before committing to a design.
