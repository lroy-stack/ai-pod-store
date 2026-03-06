# Mockup Generation — STSU177 (Catalog 479) ESSENTIAL ECO Hoodie

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

**Mockup Option Groups disponibles (11 grupos — mas que M2580):**
Flat, Flat 2, Folded, Ghost, Labels, Men's, Men's Lifestyle, On Hanger, Product details, Women's, Women's Lifestyle

**Mockup Options (vistas) disponibles:**
Back, Front, Inside label, Left, Left Front, Left sleeve, Product details, Right, Right sleeve

Usamos **Ghost** con vistas **Front**, **Back**, y **Left** para consistencia con el resto del catalogo SKAPARA.

| Vista | En la respuesta API | Muestra | Archivo |
|---|---|---|---|
| **Front** | `mockup_url` (raiz) | Diseno frontal (hero) | `{color}-front.png` |
| **Back** | `extra[].title === "Back"` -> `.url` | SKAPARA wordmark / back design | `{color}-back.png` |
| **Left** | `extra[].title === "Left"` -> `.url` | S mark manga izquierda | `{color}-left.png` |

---

## Seleccion de Colores: Design-First Analysis (OBLIGATORIO)

**REGLA FUNDAMENTAL:** Los colores se eligen EN FUNCION DEL DISENO, no como lista fija. Cada diseno se analiza antes de elegir colores.

### Paso 0 — Paleta de colores disponibles (dark, EU)

STSU177 tiene **solo 2 colores oscuros** — la seleccion es mucho mas simple que M2580.

| Color | Hex | L | Neutro? | Notas |
|---|---|---|---|---|
| Black | `#0b0b0b` | 11 | SI | Negro profundo — malo para disenos con elementos negros |
| French Navy | `#071429` | 20 | CASI | Azul navy muy oscuro, excelente contraste general |

### Paso 1 — Analizar la paleta del diseno

Antes de elegir CUALQUIER color de prenda, responder estas preguntas:

1. **Que colores dominantes tiene el diseno?** (no solo el texto — tambien siluetas, iconos, fondos)
2. **Tiene el diseno elementos OSCUROS?** (siluetas negras, sombras, outlines dark)
3. **Es mayoritariamente texto blanco sobre transparente?** (el caso mas simple)

### Paso 2 — Evaluar contraste: 2 reglas

**Regla 1 — Visibilidad de elementos claros (texto blanco)**
Ambos colores dark pasan (L < 50). Texto blanco es legible en ambos.

**Regla 2 — Visibilidad de elementos OSCUROS del diseno**
- Diseno con **silueta/elementos negros** → EXCLUIR Black (#0b0b0b, L=11) — se pierde. Usar SOLO French Navy.
- Diseno con **solo texto blanco, sin elementos oscuros** → Ambos colores funcionan.
- Diseno con **elementos azul oscuro** → Verificar contraste contra French Navy (#071429).

### Paso 3 — Seleccionar 1-2 colores

Con solo 2 colores oscuros, la decision es binaria:
- **Caso tipico (texto blanco):** Usar AMBOS colores (Black + French Navy) = 2 colores x 3 vistas = **6 mockups**
- **Caso especial (elementos negros):** Usar SOLO French Navy = 1 color x 3 vistas = **3 mockups**
- **Caso raro (elementos azul navy):** Usar SOLO Black = 1 color x 3 vistas = **3 mockups**

### Resultado por producto

**Minimo 1 color x 3 vistas = 3 mockups Ghost transparentes.**
**Maximo 2 colores x 3 vistas = 6 mockups Ghost transparentes.**
**Tipico: 2 colores x 3 vistas = 6 mockups** por producto.

---

## API Response Structure

Similar a M2580. **UN objeto por color** en `mockups[]`, vistas adicionales en `extra[]`.

```json
{
  "result": {
    "status": "completed",
    "mockups": [
      {
        "placement": "front",
        "variant_ids": [12372],
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
sleeve_left:  https://files.cdn.printful.com/files/yyy/yyy_preview.png  (shared M2580/M2480 wordmark)
back:         https://files.cdn.printful.com/files/zzz/zzz_preview.png  (if using back placement)
```

### 2. Crear N tasks (1 por color dark seleccionado)

**Dark EU palette (typically both):**

| # | Color | variant_id (S) | Delay antes |
|---|---|---|---|
| 1 | Black | 12372 | — |
| 2 | French Navy | 12387 | 10s |

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/479" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [12372],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "front",
        "image_url": "https://DESIGN_URL",
        "position": { "area_width": 2100, "area_height": 2100, "width": 2100, "height": 2100, "top": 0, "left": 0 }
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

**CRITICAL DIFFERENCES FROM M2580:**
- `front` position uses `area_width: 2100, area_height: 2100` (**BIGGER** than M2580's 1800x1800)
- `sleeve_left` position uses `area_width: 450, area_height: 1800` (SAME as M2580 — compatible)
- `back` position is the same as M2580 (1800x2400)
- Catalog ID is **479** (not 380)
- `label_inside` is NOT included in mockup generation (not visible externally)

**If NOT using back placement (saves $6.95/unit), omit the back file from the request.**

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

### Archivos generados por producto (minimo 3, maximo 6)

**Design-first selected colors (1-2 from Dark palette) x 3 vistas:**
```
designs/mockups/{slug}/{color-slug}-front.png
designs/mockups/{slug}/{color-slug}-back.png
designs/mockups/{slug}/{color-slug}-left.png
```

**Typical (both dark colors — 6 mockups):**
```
designs/mockups/{slug}/black-front.png
designs/mockups/{slug}/black-back.png
designs/mockups/{slug}/black-left.png
designs/mockups/{slug}/french-navy-front.png
designs/mockups/{slug}/french-navy-back.png
designs/mockups/{slug}/french-navy-left.png
```

**All 2 possible color slugs:** `black`, `french-navy`

### Orden en `products.images[]`

1. **Fronts** — selected colors in order (primer front = hero)
2. **Backs** — mismos colores en mismo orden
3. **Sleeves** — mismos colores en mismo orden

### Alt Text (critico para el frontend)

| Vista | Patron | Ejemplo |
|---|---|---|
| Front | `"Title - ColorName"` | `"Eco Hoodie - Black"` |
| Back | `"Title - ColorName - Back"` | `"Eco Hoodie - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Eco Hoodie - Black - Sleeve"` |

**ColorName debe coincidir exactamente** con `product_variants.color`: "French Navy" (no "Navy" ni "french-navy").

---

## Rate Limits

| Operacion | Limite | Delay |
|---|---|---|
| API general | ~120 req/min | `delay(2000)` |
| Crear task mockup | ~10 tasks/min | `delay(10000)` |
| Polling | Sin limite | cada 3000ms |

**Timing estimates:**
- Typical (2 colors): 2 tasks x 10s = **~20s creation + ~20s polling = ~40s total**
- Minimum (1 color): 1 task = **~10s creation + ~10s polling = ~20s total**

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.

---

## STSU177 vs M2580: Diferencias Clave de Mockups

| Aspecto | STSU177 (ECO Hoodie) | M2580 (PREMIUM Hoodie) |
|---|---|---|
| Catalog ID | 479 | 380 |
| Front position | **2100x2100** (biggest square) | 1800x1800 (square) |
| Sleeve position | 450x1800 (same) | 450x1800 (same) |
| Back position | 1800x2400 (same) | 1800x2400 (same) |
| Colores dark usables | 2 (Black, French Navy) | 9 Dark EU palette |
| Seleccion de color | Casi siempre ambos | Design-First (2-5 from 9) |
| Mockups por producto | 3-6 (simple) | 6-27 (variable) |
| Option groups | 11 (Flat, Ghost, Men's, Women's, etc.) | None explicit |
| Templates | TBD | 184 |
| Silueta | Regular fit hoodie, set-in sleeves, pouch pocket | Classic streetwear, kangaroo pocket, 3-panel hood |
| Mockup generation time | ~20-40s (1-2 tasks) | ~1-3 min (2-9 tasks) |

---

## Bug Reference: Ghost "Duplicate" (Same as M2580/MC1087)

**The same extraction bug documented in M2580's MOCKUPS.md applies here.** The API may return multiple objects in `mockups[]` that share the same `mockup_url`. Always extract views from `extra[]` of the first mockup object.

**Correct extraction:**
```javascript
const m = result.mockups[0];
m.mockup_url                                    // -> front.png
m.extra.find(e => e.title === 'Back').url        // -> back.png
m.extra.find(e => e.title === 'Left').url        // -> left.png
```

**DO NOT** iterate `mockups[]` and use each `mockup_url` as a different view — they may all be the front view.
