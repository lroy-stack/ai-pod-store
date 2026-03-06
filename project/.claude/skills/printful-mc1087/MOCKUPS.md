# Mockup Generation — MC1087 (Catalog 917) PREMIUM Tier

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

---

## Selección de Colores: Design-First Contrast

MC1087 solo tiene **5 colores** (vs 45 del CC1717). La selección es más directa.

### Los 5 colores disponibles

| Color | Hex | L | Compatible con texto blanco |
|---|---|---|---|
| Black | `#0e0e0e` | ~5 | SI — siempre |
| Navy Blazer | `#1b2229` | ~13 | SI — siempre |
| Vintage Black | `#363533` | ~21 | SI — siempre |
| Vintage White | `#fff9f2` | ~98 | NO — texto blanco invisible |
| White | `#ffffff` | ~100 | NO — texto blanco invisible |

### Regla 1 — Visibilidad de tinta blanca

3 de 5 colores pasan (L < 50). Todos nuestros diseños meme usan texto blanco → **siempre los 3 dark**.

### Regla 2 — Conflicto de matiz

Los 3 colores dark son casi-negros/neutros muy oscuros. **No hay conflicto de hue posible** con ningún color de acento de nuestros diseños. Navy Blazer tiene un leve tinte azul pero a L=13 es prácticamente indistinguible.

### Regla 3 — Armonía estética

Los 3 colores son universales — todos funcionan con cualquier diseño. No hay selección que hacer.

### Resultado para CUALQUIER diseño MC1087

**Siempre 3 colores × 3 vistas = 9 mockups Ghost transparentes por producto.**

No existe diseño que excluya alguno de los 3 dark de MC1087.

---

## API Response Structure (VERIFICADO)

Idéntica a CC1717. **UN objeto por color** en `mockups[]`, vistas adicionales en `extra[]`.

```json
{
  "result": {
    "status": "completed",
    "mockups": [
      {
        "placement": "front",
        "variant_ids": [23577],
        "mockup_url": "https://s3.amazonaws.com/.../front-view.png",
        "generator_mockup_id": 12345,
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

| Campo | Tipo | Descripción |
|---|---|---|
| `placement` | string | Siempre `"front"` para apparel Ghost |
| `variant_ids` | number[] | IDs de variantes |
| `mockup_url` | string | Vista Front (principal) |
| `generator_mockup_id` | number | ID template interno |
| `extra` | array | Vistas adicionales |

### Campos `extra[]` (`MockupExtraItem`):

| Campo | Tipo | Descripción |
|---|---|---|
| `title` | string | "Back", "Left". **Puede cambiar** |
| `url` | string | URL directa a la imagen |
| `option` | string | Identificador del ángulo |
| `option_group` | string | Grupo de estilo |

**`extra[]` NO tiene `variant_id`.**

---

## Workflow de Generación

### 1. Recoger URLs de diseño

```
front:        https://files.cdn.printful.com/files/xxx/xxx_preview.png
sleeve_left:  https://files.cdn.printful.com/files/7a4/7a4...preview.png  (S mark v2)
back:         https://files.cdn.printful.com/files/d52/d52...preview.png  (wordmark v2)
```

### 2. Crear 3 tasks (1 por color dark)

| # | Color | variant_id (S) | Delay antes |
|---|---|---|---|
| 1 | Black | 23577 | — |
| 2 | Navy Blazer | 23584 | 10s |
| 3 | Vintage Black | 23591 | 10s |

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/917" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [23577],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Left", "Back"],
    "files": [
      {
        "placement": "front",
        "image_url": "https://DESIGN_URL",
        "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 }
      },
      {
        "placement": "sleeve_left",
        "image_url": "https://SLEEVE_BRANDING_URL",
        "position": { "area_width": 600, "area_height": 525, "width": 600, "height": 525, "top": 0, "left": 0 }
      },
      {
        "placement": "back",
        "image_url": "https://BACK_BRANDING_URL",
        "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 }
      }
    ]
  }'
```

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

## Storage y Galería

### Archivos generados por producto (9 total)

```
designs/mockups/{slug}/black-front.png
designs/mockups/{slug}/black-back.png
designs/mockups/{slug}/black-left.png
designs/mockups/{slug}/navy-blazer-front.png
designs/mockups/{slug}/navy-blazer-back.png
designs/mockups/{slug}/navy-blazer-left.png
designs/mockups/{slug}/vintage-black-front.png
designs/mockups/{slug}/vintage-black-back.png
designs/mockups/{slug}/vintage-black-left.png
```

### Orden en `products.images[]`

1. **Fronts** — Black, Navy Blazer, Vintage Black (primer front = hero)
2. **Backs** — mismos colores
3. **Sleeves** — mismos colores

### Alt Text (crítico para el frontend)

| Vista | Patrón | Ejemplo |
|---|---|---|
| Front | `"Title - ColorName"` | `"Social Battery - Black"` |
| Back | `"Title - ColorName - Back"` | `"Social Battery - Black - Back"` |
| Sleeve | `"Title - ColorName - Sleeve"` | `"Social Battery - Black - Sleeve"` |

**ColorName debe coincidir exactamente** con `product_variants.color`: "Navy Blazer" (no "Navy" ni "navy-blazer").

---

## Rate Limits

| Operación | Límite | Delay |
|---|---|---|
| API general | ~120 req/min | `delay(2000)` |
| Crear task mockup | ~10 tasks/min | `delay(10000)` |
| Polling | Sin límite | cada 3000ms |

MC1087 = 3 tasks × 10s = **~30s de creación + ~30s polling = ~2 min por producto**.

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.

---

## MC1087 vs CC1717: Diferencias Clave

| Aspecto | MC1087 (PREMIUM) | CC1717 (SIGNATURE) |
|---|---|---|
| Catalog ID | 917 | 586 |
| Colores totales | 5 | 45 |
| Colores dark usables | 3 (siempre todos) | Depende del diseño (hasta 24) |
| Selección de color | Automática (siempre 3) | Design-First Contrast (3 reglas) |
| Mockups por producto | 9 fijos | Variable (N×3) |
| Option groups | 7 | 15 |
| Modelos femeninas | No | Sí (Women's, Women's 2) |
| Men's models | Men's, Men's Lifestyle | Men's, Men's 2, Men's 3 |
| Zoomed in | No | Sí |
| Collage | No | Sí |
| Silueta | Boxy / streetwear | Relaxed / oversized |
| `label_inside` | Sí (+$0.99) | No |

---

## Referencia: Option Groups Disponibles (7)

Usamos **solo Ghost**. El resto es referencia para expansión futura.

| # | option_group | Fondo | Descripción |
|---|---|---|---|
| 1 | **Ghost** | **Transparente** | **EL QUE USAMOS.** Silueta boxy, 4 ángulos |
| 2 | Flat | Blanco | Top-down plana, corte boxy visible |
| 3 | Folded | Blanco | Plegada 3D |
| 4 | Men's | Blanco | Modelo masculino frontal |
| 5 | Men's Lifestyle | Blanco | Modelo masculino streetwear |
| 6 | Labels | Blanco | Detalle etiqueta |
| 7 | Product details | Blanco | Detalles construcción |

**NO disponibles en MC1087:** Women's, Women's 2, Men's 2, Men's 3, Zoomed in, Collage, Flat 2, Flat 3.

---

## Bug Resuelto: Ghost "Duplicate" (Error de Extracción)

**Síntoma original:** Al generar Ghost mockups, los 3 archivos (front, back, left) contenían la misma imagen idéntica.

**Causa raíz:** NO era un bug de la API. La API devuelve 3 objetos en `mockups[]` (uno por placement: front, back, sleeve_left), pero **TODOS comparten el mismo `mockup_url`** (la vista front). Las vistas distintas están en `extra[]` del primer mockup.

**El script erróneo hacía:**
```javascript
// MAL — los 3 placements tienen el MISMO mockup_url (front)
mockups[0].mockup_url → front.png   (correcto)
mockups[1].mockup_url → back.png    (INCORRECTO — es front otra vez!)
mockups[2].mockup_url → left.png    (INCORRECTO — es front otra vez!)
```

**La extracción correcta es:**
```javascript
// BIEN — usar extra[] del primer mockup
const m = result.mockups[0];
m.mockup_url                                    → front.png  (317KB)
m.extra.find(e => e.title === 'Back').url        → back.png   (273KB)
m.extra.find(e => e.title === 'Left').url        → left.png   (146KB)
```

**Verificado con test (Black S, variant 23577):**
- Front: 317,058 bytes
- Back: 272,921 bytes
- Left: 145,990 bytes
- **3 imágenes DISTINTAS** — la API funciona correctamente

**Script fix:** `scripts/_fix-mc1087-mockups-v2.mjs`

---

## Bug en Código del Proyecto

`frontend/src/lib/pod/printful/client.ts`:

```typescript
// MAL (actual):
extra?: Array<{ variant_id?: number; url?: string }>

// BIEN (API real):
extra?: Array<{ title: string; url: string; option: string; option_group: string }>
```
