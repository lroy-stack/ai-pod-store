# Mockup Generation — SASU024 (Catalog 831) PREMIUM ECO Organic Hoodie

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

### Option Groups Disponibles (verificado de API)

Duet, Flat, Folded, Folded Lifestyle, Ghost, Labels, Lifestyle, Men's, Women's

### Options (vistas disponibles, verificado de API)

Back, Front, Front 2, Inside label, Left, Outside label, Right

**Para SKAPARA usamos Ghost con Front, Back, y Left.** Las demas vistas son opcionales para marketing adicional.

| Vista | En la respuesta API | Muestra | Archivo |
|---|---|---|---|
| **Front** | `mockup_url` (raiz) | Diseno frontal (hero) | `{color}-front.png` |
| **Back** | `extra[].title === "Back"` -> `.url` | SKAPARA wordmark (si back branding activo) | `{color}-back.png` |
| **Left** | `extra[].title === "Left"` -> `.url` | Wordmark vertical manga izquierda | `{color}-left.png` |

---

## Seleccion de Colores: Solo 2 Dark (Simplificado)

A diferencia del M2580 (9 colores dark, requiere design-first analysis complejo), el SASU024 solo tiene **2 colores dark**. La seleccion es directa:

### Paleta dark completa

| Color | Hex | L | Status |
|---|---|---|---|
| Black | `#121212` | 18 | SIEMPRE USAR |
| French Navy | `#071429` | 20 | SIEMPRE USAR |

### Regla de seleccion

**USAR AMBOS.** Con solo 2 opciones dark, ambos colores se incluyen en cada producto SASU024, salvo que el diseno tenga un conflicto especifico:

- Diseno con **elementos azul muy oscuro** → Considerar excluir French Navy (podria perderse el contraste)
- Diseno con **elementos negros puros** → Considerar excluir Black (siluetas invisibles)
- En la practica, ambos colores son tan oscuros (L=18 y L=20) que el 95% de disenos funcionan en ambos

### Resultado por producto

**Tipico: 2 colores x 3 vistas = 6 mockups Ghost transparentes.**

---

## API Response Structure

Similar a M2580/MC1087. **UN objeto por color** en `mockups[]`, vistas adicionales en `extra[]`.

```json
{
  "result": {
    "status": "completed",
    "mockups": [
      {
        "placement": "front",
        "variant_ids": [21149],
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
sleeve_left:  https://files.cdn.printful.com/files/yyy/yyy_preview.png  (wordmark vertical — shared M2580/M2480)
back:         https://files.cdn.printful.com/files/zzz/zzz_preview.png  (wordmark, si back branding activo)
```

### 2. Crear 2 tasks (1 por color dark)

| # | Color | variant_id (S) | Delay antes |
|---|---|---|---|
| 1 | Black | 21149 | — |
| 2 | French Navy | 21150 | 10s |

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/831" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [21149],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "front",
        "image_url": "https://DESIGN_URL",
        "position": { "area_width": 1875, "area_height": 1875, "width": 1875, "height": 1875, "top": 0, "left": 0 }
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

**DIFERENCIAS CRITICAS vs M2580:**
- `front` position usa `area_width: 1875, area_height: 1875` (NO 1800x1800 como M2580)
- `sleeve_left` position es la MISMA que M2580 (450x1800, compatible)
- `back` position es la MISMA que M2580 (1800x2400)
- Catalog ID es **831** (no 380)
- Si se usa `back_large` en vez de `back`: `area_width: 2250, area_height: 2700`

**Nota sobre `back` branding:** Si en v3 no se aplica back branding (como en M2580), omitir el file de back del payload. Esto reduce el costo por unidad en $5.95.

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

### Archivos generados por producto (tipico: 6)

**2 colores dark x 3 vistas:**
```
designs/mockups/{slug}/black-front.png
designs/mockups/{slug}/black-back.png
designs/mockups/{slug}/black-left.png
designs/mockups/{slug}/french-navy-front.png
designs/mockups/{slug}/french-navy-back.png
designs/mockups/{slug}/french-navy-left.png
```

**Todos los color slugs posibles (4):** `black`, `french-navy`, `heather-grey`, `white`

(Solo `black` y `french-navy` se generan normalmente — los light colors se deshabilitan.)

### Orden en `products.images[]`

1. **Fronts** — colores en orden (primer front = hero)
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

**Timing estimates (SASU024 — solo 2 colores):**
- 2 tasks x 10s = **~20s creation + ~20s polling = ~40s total**

Mucho mas rapido que M2580 (9 colores potenciales, ~3 min).

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.

---

## SASU024 vs M2580 vs MC1087: Diferencias Clave de Mockups

| Aspecto | SASU024 (PREMIUM ECO) | M2580 (PREMIUM Hoodie) | MC1087 (PREMIUM Tee) |
|---|---|---|---|
| Catalog ID | 831 | 380 | 917 |
| Front position | **1875x1875** (square) | 1800x1800 (square) | 1800x2400 (portrait) |
| Sleeve position | 450x1800 (vertical, same) | 450x1800 (vertical, same) | 600x525 (landscape) |
| Back position | 1800x2400 (same) | 1800x2400 (same) | 1800x2400 (same) |
| `back_large` position | **2250x2700** (exclusive!) | N/A | N/A |
| Colores dark usables | 2 (siempre ambos) | 9 (design-first, 2-5) | 3 (siempre todos) |
| Mockups por producto | **6 fijos** (2 x 3 vistas) | 6-27 (variable) | 9 fijos |
| Option groups | Ghost, Duet, Flat, Folded, etc. | Default (sin nombre) | 7 (usamos Ghost) |
| Tiempo estimado | ~40s | ~1-3 min | ~1 min |
| Silueta | Relaxed hoodie, suede finish | Streetwear hoodie, kangaroo pocket | Boxy tee |

---

## Referencia: Mockup Options Completas

Documentacion de todas las option groups y views disponibles para futuro uso (lifestyle, marketing, etc.):

### Option Groups
| Group | Uso actual |
|---|---|
| Ghost | **ACTIVO** — ghost transparente para web |
| Duet | Futuro — dos vistas combinadas |
| Flat | Futuro — prenda plana |
| Folded | Futuro — prenda doblada |
| Folded Lifestyle | Futuro — prenda doblada en contexto |
| Labels | Futuro — close-up de etiquetas |
| Lifestyle | Futuro — modelo con prenda |
| Men's | Futuro — modelo masculino |
| Women's | Futuro — modelo femenino |

### Options (Views)
| View | Uso actual |
|---|---|
| Front | **ACTIVO** — vista frontal (hero) |
| Front 2 | Futuro — segunda vista frontal (angulo diferente) |
| Back | **ACTIVO** — vista trasera |
| Left | **ACTIVO** — vista lateral izquierda (sleeve visible) |
| Right | Futuro — vista lateral derecha |
| Inside label | Futuro — close-up label interior |
| Outside label | Futuro — close-up label exterior |

---

## Bug Reference: Ghost "Duplicate" (Same as M2580/MC1087)

**El mismo bug de extraccion documentado en M2580/MC1087 aplica aqui.** La API puede retornar multiples objetos en `mockups[]` que comparten el mismo `mockup_url`. Siempre extraer vistas de `extra[]` del primer mockup object.

**Extraccion correcta:**
```javascript
const m = result.mockups[0];
m.mockup_url                                    // -> front.png
m.extra.find(e => e.title === 'Back').url        // -> back.png
m.extra.find(e => e.title === 'Left').url        // -> left.png
```

**NO** iterar `mockups[]` y usar cada `mockup_url` como vista diferente — pueden ser todas la vista front.
