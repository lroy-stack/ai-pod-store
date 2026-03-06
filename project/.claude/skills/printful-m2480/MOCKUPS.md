# Mockup Generation — M2480 (Catalog 411) PREMIUM Crewneck

---

## Que Generamos

**Ghost transparente, 2 vistas por color (front + sleeve).** Nada mas.

```json
{
  "option_groups": ["Ghost"],
  "options": ["Front", "Left"],
  "format": "png",
  "width": 1000
}
```

| Vista | En la respuesta API | Muestra | Archivo |
|---|---|---|---|
| **Front** | `mockups.find(m => m.placement === 'front').mockup_url` | Diseno frontal (hero) | `{color}-front.png` |
| **Sleeve** | `mockups.find(m => m.placement === 'sleeve_left').mockup_url` | SKAPARA wordmark manga izquierda | `{color}-sleeve.png` |

**v3 branding:** No back placement. Solo front + sleeve_left. Cada placement devuelve un entry separado en `mockups[]`, NO en `extra[]`.

---

## Seleccion de Colores: Design-First Analysis (OBLIGATORIO)

**REGLA FUNDAMENTAL:** Los colores se eligen EN FUNCIÓN DEL DISEÑO, no como lista fija. No existe "siempre usar Black". Cada diseño se analiza antes de elegir colores.

### Paso 0 — Paleta de colores disponibles (dark, EU)

| Color | Hex | L | Neutro? | Notas |
|---|---|---|---|---|
| Black | `#101010` | 16 | SI | Muy oscuro — malo para diseños con elementos negros |
| Navy Blazer | `#171f2c` | 30 | CASI | Azul muy oscuro, casi negro |
| Charcoal Heather | `#3a3a38` | 58 | SI | Gris medio — excelente contraste para elementos oscuros |
| Team Royal | `#2d407d` | 65 | NO | Azul evidente — verificar conflicto de hue |
| Vintage Black | `#43413D` | 65 | SI | Gris-oliva — buen contraste general |
| Forest Green | `#335231` | 69 | NO | Verde evidente — verificar conflicto de hue |

### Paso 1 — Analizar la paleta del diseño

Antes de elegir CUALQUIER color de prenda, responder estas preguntas:

1. **¿Qué colores dominantes tiene el diseño?** (no solo el texto — también siluetas, iconos, fondos)
2. **¿Tiene el diseño elementos OSCUROS?** (siluetas negras, sombras, outlines dark)
3. **¿Tiene el diseño elementos en colores saturados?** (azul, verde, rojo, púrpura)
4. **¿Es mayoritariamente texto blanco sobre transparente?** (el caso más simple)

### Paso 2 — Evaluar contraste: 3 reglas

**Regla 1 — Visibilidad de elementos claros (texto blanco)**
Los 6 colores dark pasan (L < 100). Texto blanco es legible en todos.

**Regla 2 — Visibilidad de elementos OSCUROS del diseño**
- Diseño con **silueta/elementos negros** → EXCLUIR Black (#101010, L=16) — se pierde
- Diseño con **elementos gris oscuro** → EXCLUIR Charcoal Heather si el gris es similar
- Diseño con **solo texto blanco, sin elementos oscuros** → Todos los colores funcionan

**Regla 3 — Conflicto de matiz (hue clash)**
- Diseño con **elementos azules** → EXCLUIR Team Royal (#2d407d) — se confunden
- Diseño con **elementos verdes (#10B981)** → EXCLUIR Forest Green (#335231) — se pierden
- Diseño con **elementos púrpura** → Team Royal puede chocar (azul vs púrpura)
- Diseño **neutro (blanco/negro/gris)** → Sin conflicto de hue con ningún color

### Paso 3 — Seleccionar 2-5 colores óptimos

Aplicar los 3 filtros y seleccionar los colores que pasan todos:

**Ejemplo real: Nihilist Penguin (silueta negra de pingüino + texto blanco)**
- Black → **EXCLUIDO** (pingüino negro invisible sobre #101010)
- Navy Blazer → **OK** (L=30, oscuro pero el pingüino se distingue ligeramente)
- Charcoal Heather → **MEJOR** (L=58, excelente contraste para silueta negra)
- Team Royal → **BUENO** (azul, pingüino negro destaca)
- Vintage Black → **BUENO** (L=65, gris-oliva, buen contraste)
- Forest Green → **BUENO** (verde, pingüino negro visible)
- **Resultado:** 5 colores (Navy Blazer + 4 extended)

**Ejemplo: diseño solo texto blanco (sin elementos oscuros)**
- Todos los 6 colores funcionan
- Seleccionar 3-4 para variedad: Black, Navy Blazer, Charcoal Heather, Team Royal
- **Resultado:** 4 colores

### Resultado por producto

**Mínimo 2 colores x 2 vistas = 4 mockups Ghost transparentes.**
**Máximo 6 colores x 2 vistas = 12 mockups Ghost transparentes.**
**Típico: 3-5 colores x 2 vistas = 6-10 mockups** por producto.

---

## Templates API — Particularidades del M2480

A diferencia del MC1087 que tiene option_groups explicitos (Ghost, Flat, Men's...), el M2480 **devuelve todos los templates como "default"** sin option_groups explicitos.

### Template URL Patterns

Los templates se identifican por sus URL paths en lugar de option_groups:

```
.../fleece_pullover/medium/ghost/front/...   -> Front Ghost
.../fleece_pullover/medium/ghost/back/...    -> Back Ghost
.../fleece_pullover/medium/ghost/left/...    -> Left Ghost
```

**152 templates totales.** Filtrar por URL path para encontrar Ghost templates.

### Extraccion de vistas

**DIFERENTE A MC1087:** El M2480 devuelve un **mockup separado por placement** en `mockups[]`, NO en `extra[]`.

```javascript
// M2480: cada placement es una entrada separada en mockups[]
const front  = result.mockups.find(m => m.placement === 'front');
const sleeve = result.mockups.find(m => m.placement === 'sleeve_left');
front.mockup_url   // -> front ghost mockup
sleeve.mockup_url  // -> sleeve ghost mockup
```

---

## API Response Structure (verificada 2026-03-03)

**NO es identica a MC1087.** M2480 devuelve **un mockup entry por placement**, con `extra: []` vacio.

```json
{
  "result": {
    "status": "completed",
    "mockups": [
      {
        "placement": "front",
        "variant_ids": [11254],
        "mockup_url": "https://printful-upload.s3-accelerate.amazonaws.com/tmp/.../front.png",
        "extra": []
      },
      {
        "placement": "sleeve_left",
        "variant_ids": [11254],
        "mockup_url": "https://printful-upload.s3-accelerate.amazonaws.com/tmp/.../sleeve.png",
        "extra": []
      }
    ]
  }
}
```

### Campos `mockups[]`:

| Campo | Tipo | Descripcion |
|---|---|---|
| `placement` | string | `"front"` o `"sleeve_left"` — uno por entry |
| `variant_ids` | number[] | IDs de variantes |
| `mockup_url` | string | URL temporal S3 (expira ~24h) |
| `extra` | array | **Siempre vacio** en M2480 (NO como MC1087) |

### M2480 vs MC1087 — Estructura de respuesta

| Aspecto | M2480 (Crewneck) | MC1087 (Tee) |
|---|---|---|
| Entries en `mockups[]` | **N** (1 por placement) | **1** (solo front) |
| Vistas adicionales | Entries separadas | `extra[]` del primer mockup |
| `extra[]` | Siempre vacio | Contiene Back y Left |
| Extraccion front | `mockups.find(m => m.placement === 'front')` | `mockups[0].mockup_url` |
| Extraccion sleeve | `mockups.find(m => m.placement === 'sleeve_left')` | `mockups[0].extra.find(e => e.title === 'Left')` |

---

## Workflow de Generacion

### 1. Recoger URLs de diseno

```
front:        https://files.cdn.printful.com/files/xxx/xxx_preview.png  (main design 1800x2400)
sleeve_left:  https://files.cdn.printful.com/files/xxx/xxx_preview.png  (wordmark vertical 450x1800)
```

**v3 branding:** No back placement. Only front + sleeve_left + label_inside.
Note: `label_inside` is NOT visible in mockups (it's inside the collar), so mockup generation only uses front + sleeve_left.

### 2. Crear N tasks (1 por color seleccionado via design-first analysis)

**Dark EU palette (seleccionar 2-5 tras análisis del diseño — ver sección anterior):**

| # | Color | variant_id (S) | Delay antes |
|---|---|---|---|
| 1 | Black | 11254 | — |
| 2 | Navy Blazer | 13252 | 10s |
| 3 | Charcoal Heather | 11259 | 10s |
| 4 | Team Royal | 13869 | 10s |
| 5 | Vintage Black | 20363 | 10s |
| 6 | Forest Green | 16156 | 10s |

**NO usar todos — seleccionar solo los que pasen el análisis de contraste del Paso 2.**

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/411" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [11254],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Left"],
    "files": [
      {
        "placement": "front",
        "image_url": "https://DESIGN_URL",
        "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 }
      },
      {
        "placement": "sleeve_left",
        "image_url": "https://SLEEVE_WORDMARK_URL",
        "position": { "area_width": 450, "area_height": 1800, "width": 450, "height": 1800, "top": 0, "left": 0 }
      }
    ]
  }'
```

**NOTES:**
- `options: ["Front", "Left"]` — NO "Back" since v3 branding has no back placement
- The sleeve_left position uses `area_width: 450, area_height: 1800` (vertical), NOT the MC1087's `area_width: 600, area_height: 525`
- `label_inside` is NOT included in mockup files — it's inside the collar and not visible in external mockups

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
    // M2480: each placement is a separate entry (NOT in extra[])
    const viewName = mock.placement === 'front' ? 'front' : 'sleeve';
    images.push({
      url: mock.mockup_url,
      path: `designs/mockups/${productSlug}/${colorSlug}-${viewName}.png`,
    });
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

### Archivos generados por producto (mínimo 4, máximo 12)

**v3 branding: 2 vistas por color (front + sleeve). NO back.**

**Design-first selected colors (2-5 from Dark EU palette) x 2 vistas:**
```
designs/mockups/{slug}/{color-slug}-front.png
designs/mockups/{slug}/{color-slug}-sleeve.png
```

**Ejemplo: Nihilist Penguin (5 colores — Black excluido por contraste) = 10 archivos:**
```
designs/mockups/{slug}/navy-blazer-front.png
designs/mockups/{slug}/navy-blazer-sleeve.png
designs/mockups/{slug}/charcoal-heather-front.png
designs/mockups/{slug}/charcoal-heather-sleeve.png
designs/mockups/{slug}/team-royal-front.png
designs/mockups/{slug}/team-royal-sleeve.png
designs/mockups/{slug}/vintage-black-front.png
designs/mockups/{slug}/vintage-black-sleeve.png
designs/mockups/{slug}/forest-green-front.png
designs/mockups/{slug}/forest-green-sleeve.png
```

**Todos los color slugs posibles:** `black`, `navy-blazer`, `charcoal-heather`, `team-royal`, `vintage-black`, `forest-green`

### Orden en `products.images[]`

1. **Fronts** — colores seleccionados en orden (primer front = hero)
2. **Sleeves** — mismos colores en mismo orden

### Alt Text (critico para el frontend)

| Vista | Patron | Ejemplo |
|---|---|---|
| Front | `"Title - ColorName"` | `"Nihilist Penguin - Black"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Nihilist Penguin - Black - Sleeve"` |

**ColorName debe coincidir exactamente** con `product_variants.color`: "Navy Blazer" (no "Navy" ni "navy-blazer").

---

## Rate Limits

| Operacion | Limite | Delay |
|---|---|---|
| API general | ~120 req/min | `delay(2000)` |
| Crear task mockup | ~10 tasks/min | `delay(10000)` |
| Polling | Sin limite | cada 3000ms |

**Timing estimates:**
- Típico (3-4 colores): 3-4 tasks x 10s = **~30-40s creación + ~20s polling = ~1 min**
- Máximo (5-6 colores): 5-6 tasks x 10s = **~50-60s creación + ~30s polling = ~1.5 min**

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.

---

## M2480 vs MC1087: Diferencias Clave en Mockups

| Aspecto | M2480 (Crewneck) | MC1087 (Tee) |
|---|---|---|
| Catalog ID | 411 | 917 |
| Colores dark usables | 6 EU (design-first: 2-5) | 3 (siempre todos) |
| Selección de color | Design-first analysis (contraste + hue) | Automática (siempre 3) |
| Mockups por producto (min) | **4** (2 colores x 2 vistas) | 9 (3 x 3 vistas) |
| Mockups por producto (max) | **12** (6 colores x 2 vistas) | 9 (fijo) |
| Vistas por color | 2 (front + sleeve) | 3 (front + back + left) |
| Respuesta API | **Entries separadas** en mockups[] | `extra[]` en mockups[0] |
| `extra[]` | **Siempre vacio** | Contiene Back y Left |
| Sleeve canvas | 450x1800 (vertical) | 600x525 (horizontal) |
| Silueta | Crewneck sweatshirt | Boxy t-shirt |

---

## Diferencia Critica: Extraccion de Mockups (verificada 2026-03-03)

**M2480 NO usa `extra[]` como MC1087.** Cada placement es un entry separado en `mockups[]`.

**Extraccion correcta (M2480):**
```javascript
const front  = result.mockups.find(m => m.placement === 'front');
const sleeve = result.mockups.find(m => m.placement === 'sleeve_left');
front.mockup_url   // -> front ghost mockup
sleeve.mockup_url  // -> sleeve ghost mockup
```

**NO hacer (patron MC1087 — NO funciona para M2480):**
```javascript
// MAL — M2480 no tiene extra[]
mockups[0].extra.find(e => e.title === 'Left')  // UNDEFINED — extra is []
```

---

## Bug en Codigo del Proyecto

`frontend/src/lib/pod/printful/client.ts`:

```typescript
// MAL (actual):
extra?: Array<{ variant_id?: number; url?: string }>

// BIEN (API real):
extra?: Array<{ title: string; url: string; option: string; option_group: string }>
```
