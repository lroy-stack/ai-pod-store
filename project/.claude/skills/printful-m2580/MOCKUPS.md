# Mockup Generation — M2580 (Catalog 380) PREMIUM Hoodie

---

## Que Generamos

**Ghost transparente, 3 vistas por color.** Nada mas.

```json
{
  "option_groups": [],
  "options": [],
  "format": "png",
  "width": 1000
}
```

**IMPORTANT:** M2580 templates API returns NO explicit `option_groups` — all templates are "default" group. Unlike MC1087 which has named groups like "Ghost", M2580 mockup generation should work **WITHOUT specifying `option_groups`** or `options`. Template URLs contain path segments like `ghost/front/`, `ghost/back/`, `ghost/left/` which indicate the API generates the correct views automatically.

The `background_color` field in templates matches each color variant hex. There are **184 total templates** available.

| Vista | En la respuesta API | Muestra | Archivo |
|---|---|---|---|
| **Front** | `mockup_url` (raiz) | Diseno frontal (hero) | `{color}-front.png` |
| **Back** | `extra[].title === "Back"` -> `.url` | SKAPARA wordmark | `{color}-back.png` |
| **Left** | `extra[].title === "Left"` -> `.url` | S mark manga izquierda | `{color}-left.png` |

---

## Seleccion de Colores: Design-First Analysis (OBLIGATORIO)

**REGLA FUNDAMENTAL:** Los colores se eligen EN FUNCION DEL DISENO, no como lista fija. No existe "siempre usar Black". Cada diseno se analiza antes de elegir colores.

### Paso 0 — Paleta de colores disponibles (dark, EU)

| Color | Hex | L | Neutro? | Notas |
|---|---|---|---|---|
| Black | `#080808` | 8 | SI | Muy oscuro — malo para disenos con elementos negros |
| Navy Blazer | `#171f2c` | 30 | CASI | Azul muy oscuro, casi negro |
| Charcoal Heather | `#463e3d` | 64 | SI | Gris medio — excelente contraste para elementos oscuros |
| Vintage Black | `#43413D` | 65 | SI | Gris-oliva — buen contraste general |
| Maroon | `#7d263a` | 66 | NO | Rojo oscuro — verificar conflicto con rojos del diseno |
| Team Royal | `#1b43ae` | 67 | NO | Azul evidente — verificar conflicto de hue |
| Forest Green | `#335231` | 69 | NO | Verde evidente — verificar conflicto de hue |
| Purple | `#623a7a` | 77 | NO | Purpura — verificar conflicto con purpuras del diseno |
| Military Green | `#5c4f32` | 80 | SI | Verde-oliva neutro — buen contraste general |

### Paso 1 — Analizar la paleta del diseno

Antes de elegir CUALQUIER color de prenda, responder estas preguntas:

1. **Que colores dominantes tiene el diseno?** (no solo el texto — tambien siluetas, iconos, fondos)
2. **Tiene el diseno elementos OSCUROS?** (siluetas negras, sombras, outlines dark)
3. **Tiene el diseno elementos en colores saturados?** (azul, verde, rojo, purpura)
4. **Es mayoritariamente texto blanco sobre transparente?** (el caso mas simple)

### Paso 2 — Evaluar contraste: 3 reglas

**Regla 1 — Visibilidad de elementos claros (texto blanco)**
Los 9 colores dark pasan (L < 100). Texto blanco es legible en todos.

**Regla 2 — Visibilidad de elementos OSCUROS del diseno**
- Diseno con **silueta/elementos negros** → EXCLUIR Black (#080808, L=8) — se pierde
- Diseno con **elementos gris oscuro** → EXCLUIR Charcoal Heather si el gris es similar
- Diseno con **solo texto blanco, sin elementos oscuros** → Todos los colores funcionan

**Regla 3 — Conflicto de matiz (hue clash)**
- Diseno con **elementos rojos (#EF4444)** → EXCLUIR Maroon (#7d263a)
- Diseno con **elementos azules** → EXCLUIR Team Royal (#1b43ae)
- Diseno con **elementos verdes (#10B981)** → EXCLUIR Forest Green (#335231)
- Diseno con **elementos purpura (#A78BFA)** → EXCLUIR Purple (#623a7a)
- Diseno **neutro (blanco/negro/gris)** → Sin conflicto de hue con ningun color

### Paso 3 — Seleccionar 2-5 colores optimos

Aplicar los 3 filtros y seleccionar los colores que pasan todos.

**Ejemplo: diseno con silueta negra + texto blanco**
- Black → EXCLUIDO (silueta invisible)
- Navy Blazer → OK (muy oscuro pero distinguible)
- Charcoal Heather → MEJOR (L=64, excelente contraste)
- Vintage Black → BUENO (L=65, buen contraste)
- Resultado: 3-4 colores

**Ejemplo: diseno solo texto blanco**
- Todos los 9 colores funcionan
- Seleccionar 4-5 para variedad visual
- Resultado: 4-5 colores

### Resultado por producto

**Minimo 2 colores x 3 vistas = 6 mockups Ghost transparentes.**
**Maximo 9 colores x 3 vistas = 27 mockups Ghost transparentes.**
**Tipico: 3-5 colores x 3 vistas = 9-15 mockups** por producto.

---

## API Response Structure

Similar a MC1087. **UN objeto por color** en `mockups[]`, vistas adicionales en `extra[]`.

```json
{
  "result": {
    "status": "completed",
    "mockups": [
      {
        "placement": "front",
        "variant_ids": [10779],
        "mockup_url": "https://s3.amazonaws.com/.../front-view.png",
        "generator_mockup_id": 12345,
        "extra": [
          { "title": "Back", "url": "https://s3...", "option": "Back", "option_group": "..." },
          { "title": "Left", "url": "https://s3...", "option": "Left", "option_group": "..." }
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
| `mockup_url` | string | Vista Front (principal) |
| `generator_mockup_id` | number | ID template interno |
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
front:        https://files.cdn.printful.com/files/xxx/xxx_preview.png
sleeve_left:  https://files.cdn.printful.com/files/yyy/yyy_preview.png  (NEW M2580 vertical S mark)
back:         https://files.cdn.printful.com/files/d52/d52...preview.png  (wordmark v2 — reused from MC1087)
```

### 2. Crear N tasks (1 por color dark seleccionado)

**Dark EU palette (select 2-5 via design-first analysis):**

| # | Color | variant_id (S) | Delay antes |
|---|---|---|---|
| 1 | Black | 10779 | — |
| 2 | Navy Blazer | 11491 | 10s |
| 3 | Charcoal Heather | 11481 | 10s |
| 4 | Vintage Black | 20272 | 10s |
| 5 | Maroon | 11486 | 10s |
| 6 | Team Royal | 13905 | 10s |
| 7 | Forest Green | 16162 | 10s |
| 8 | Purple | 13911 | 10s |
| 9 | Military Green | 13893 | 10s |

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/380" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [10779],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "front",
        "image_url": "https://DESIGN_URL",
        "position": { "area_width": 1800, "area_height": 1800, "width": 1800, "height": 1800, "top": 0, "left": 0 }
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

**CRITICAL DIFFERENCES FROM MC1087:**
- `front` position uses `area_width: 1800, area_height: 1800` (SQUARE, not 2400)
- `sleeve_left` position uses `area_width: 450, area_height: 1800` (VERTICAL, not 600x525)
- `back` position is the same as MC1087 (1800x2400)
- Catalog ID is **380** (not 917)
- Do NOT include `option_groups` or `options` — M2580 templates have no explicit option groups

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
  for (const mock of taskResult.mockups) {
    images.push({ url: mock.mockup_url, path: `designs/mockups/${productSlug}/${colorSlug}-front.png` });
    for (const extra of mock.extra || []) {
      const view = extra.title.toLowerCase();
      images.push({ url: extra.url, path: `designs/mockups/${productSlug}/${colorSlug}-${view}.png` });
    }
  }
  return images; // Descargar de S3 temporal y subir a Supabase Storage
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

### Archivos generados por producto (minimo 6, maximo 27)

**Design-first selected colors (2-5 from Dark EU palette) x 3 vistas:**
```
designs/mockups/{slug}/{color-slug}-front.png
designs/mockups/{slug}/{color-slug}-back.png
designs/mockups/{slug}/{color-slug}-left.png
```

**Example (3 colors selected after design analysis):**
```
designs/mockups/{slug}/charcoal-heather-front.png
designs/mockups/{slug}/charcoal-heather-back.png
designs/mockups/{slug}/charcoal-heather-left.png
designs/mockups/{slug}/navy-blazer-front.png
designs/mockups/{slug}/navy-blazer-back.png
designs/mockups/{slug}/navy-blazer-left.png
designs/mockups/{slug}/military-green-front.png
designs/mockups/{slug}/military-green-back.png
designs/mockups/{slug}/military-green-left.png
```

**All 9 possible color slugs:** `black`, `navy-blazer`, `charcoal-heather`, `vintage-black`, `maroon`, `team-royal`, `forest-green`, `purple`, `military-green`

### Orden en `products.images[]`

1. **Fronts** — selected colors in order (primer front = hero)
2. **Backs** — mismos colores en mismo orden
3. **Sleeves** — mismos colores en mismo orden

### Alt Text (critico para el frontend)

| Vista | Patron | Ejemplo |
|---|---|---|
| Front | `"Title - ColorName"` | `"Void Hoodie - Black"` |
| Back | `"Title - ColorName - Back"` | `"Void Hoodie - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Void Hoodie - Black - Sleeve"` |

**ColorName debe coincidir exactamente** con `product_variants.color`: "Navy Blazer" (no "Navy" ni "navy-blazer").

---

## Rate Limits

| Operacion | Limite | Delay |
|---|---|---|
| API general | ~120 req/min | `delay(2000)` |
| Crear task mockup | ~10 tasks/min | `delay(10000)` |
| Polling | Sin limite | cada 3000ms |

**Timing estimates:**
- Typical (3-5 colors): 3-5 tasks x 10s = **~30-50s creation + ~30s polling = ~1-2 min**
- All 9 colors: 9 tasks x 10s = **~90s creation + ~60s polling = ~3 min**

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.

---

## M2580 vs MC1087: Diferencias Clave de Mockups

| Aspecto | M2580 (PREMIUM Hoodie) | MC1087 (PREMIUM Tee) |
|---|---|---|
| Catalog ID | 380 | 917 |
| Front position | 1800x1800 (square) | 1800x2400 (portrait) |
| Sleeve position | 450x1800 (vertical) | 600x525 (landscape) |
| Back position | 1800x2400 (same) | 1800x2400 (same) |
| Colores dark usables | 9 Dark EU palette | 3 (siempre todos) |
| Seleccion de color | Design-First Analysis (2-5 from 9) | Automatica (siempre 3) |
| Mockups por producto | 6-27 (variable) | 9 fijos |
| Option groups | None explicit (all "default") | 7 (usamos Ghost) |
| `option_groups` param | NOT used | `["Ghost"]` |
| `options` param | NOT used | `["Front", "Left", "Back"]` |
| Templates totales | 184 | Fewer |
| Template URL pattern | `ghost/front/`, `ghost/back/`, `ghost/left/` | Named option groups |
| Silueta | Hoodie with kangaroo pocket, 3-panel hood | Boxy tee |

---

## Referencia: Template URL Patterns

M2580 templates use path-based identification instead of named option groups:

```
.../ghost/front/...  -> Front view (ghost transparent)
.../ghost/back/...   -> Back view (ghost transparent)
.../ghost/left/...   -> Left view (ghost transparent)
```

The `background_color` field in each template matches the variant hex color, allowing automatic color matching.

---

## Bug Reference: Ghost "Duplicate" (Same as MC1087)

**The same extraction bug documented in MC1087's MOCKUPS.md applies here.** The API may return multiple objects in `mockups[]` that share the same `mockup_url`. Always extract views from `extra[]` of the first mockup object.

**Correct extraction:**
```javascript
const m = result.mockups[0];
m.mockup_url                                    // -> front.png
m.extra.find(e => e.title === 'Back').url        // -> back.png
m.extra.find(e => e.title === 'Left').url        // -> left.png
```

**DO NOT** iterate `mockups[]` and use each `mockup_url` as a different view — they may all be the front view.
