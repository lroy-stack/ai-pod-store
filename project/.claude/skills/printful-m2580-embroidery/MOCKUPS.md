# Mockup Generation — M2580 Embroidery (Catalog 380)

## Ghost Mockup Generator

`POST /mockup-generator/create-task/380` con `option_groups: ["Ghost"]`.

**Requisito:** Esperar ~5s después de crear/actualizar el producto antes de generar mockups. Sin este delay, Printful devuelve ISE.

**Requisito:** Las `image_url` de los files deben ser URLs públicas accesibles (Supabase Storage). Printful no acepta data URLs ni base64.

### Request

```javascript
const COLORS = { White: 10774, Bone: 20284 };

for (const [color, variantId] of Object.entries(COLORS)) {
  const task = await pf('/mockup-generator/create-task/380', {
    method: 'POST',
    body: JSON.stringify({
      variant_ids: [variantId],
      format: 'png',
      option_groups: ['Ghost'],
      files: [
        {placement: 'embroidery_chest_center', image_url: chestUrl,
         position: {area_width: 3000, area_height: 1800, width: 3000, height: 1800, top: 0, left: 0}},
        {placement: 'embroidery_wrist_left', image_url: wristLUrl,
         position: {area_width: 600, area_height: 900, width: 600, height: 900, top: 0, left: 0}},
        {placement: 'embroidery_wrist_right', image_url: wristRUrl,
         position: {area_width: 600, area_height: 900, width: 600, height: 900, top: 0, left: 0}}
      ]
    })
  });
  // Poll task_key hasta status: 'completed'
}

// Polling endpoint: GET /mockup-generator/task?task_key={task_key}
// Poll every 3-4 seconds. Status values: pending → completed or failed.
const statusRes = await pf('/mockup-generator/task?task_key=' + task.task_key);
if (statusRes.status === 'completed') { /* extract mockups */ }
if (statusRes.status === 'failed') { /* handle error */ }
```

### Estructura de respuesta

La respuesta contiene `mockups[]` con 3 entries (uno por placement). **Todos los placements devuelven las mismas 4 URLs** — la vista depende de `mockup_url` vs `extra[].option`, NO del placement:

```javascript
// mockups[0] (cualquier placement — todos idénticos)
{
  placement: 'embroidery_chest_center',
  mockup_url: '...bone-front-xxx.png',     // ← FRONT
  extra: [
    { option: 'Back',  option_group: 'Ghost', url: '...bone-back-xxx.png' },
    { option: 'Left',  option_group: 'Ghost', url: '...bone-left-xxx.png' },
    { option: 'Right', option_group: 'Ghost', url: '...bone-right-xxx.png' },
  ]
}
```

### Extracción correcta de vistas

```javascript
const m = mockups[0]; // Usar SOLO el primer entry
const views = {
  front: m.mockup_url,
  back:  m.extra.find(e => e.option === 'Back').url,
  left:  m.extra.find(e => e.option === 'Left').url,
  right: m.extra.find(e => e.option === 'Right').url,
};
```

**Resultado:** 4 vistas Ghost (PNG con alfa) × 2 colores = 8 mockups.

---

## Storage en Supabase

### Archivos por producto (4 vistas × 2 colores = 8 mockups)

```
designs/mockups/{slug}/{color}-front.png
designs/mockups/{slug}/{color}-left.png
designs/mockups/{slug}/{color}-back.png
designs/mockups/{slug}/{color}-right.png
```

### `products.images[]`

Agrupados por color, White primero (hero):

```javascript
images: [
  { src: '.../white-front.png', alt: 'Title - White' },
  { src: '.../white-left.png',  alt: 'Title - White - Left' },
  { src: '.../white-back.png',  alt: 'Title - White - Back' },
  { src: '.../white-right.png', alt: 'Title - White - Right' },
  { src: '.../bone-front.png',  alt: 'Title - Bone' },
  { src: '.../bone-left.png',   alt: 'Title - Bone - Left' },
  { src: '.../bone-back.png',   alt: 'Title - Bone - Back' },
  { src: '.../bone-right.png',  alt: 'Title - Bone - Right' },
]
```

### Alt text — patrón obligatorio

El frontend (`/api/products/[id]/route.ts`) usa `alt.includes('- ColorName')` para mapear imágenes a colores. Usar **hyphen** (`-`), nunca em dash (`—`).

| Vista | Patrón |
|---|---|
| Front | `"Title - Color"` |
| Otras | `"Title - Color - View"` |

### `product_variants.image_url`

Todas las tallas del mismo color apuntan al front:

```javascript
for (const color of ['White', 'Bone']) {
  const imageUrl = `${SB_URL}/storage/v1/object/public/designs/mockups/${slug}/${color.toLowerCase()}-front.png`;
  await supabase.from('product_variants')
    .update({ image_url: imageUrl })
    .eq('product_id', productId)
    .eq('color', color);
}
```

---

## Rate Limits

| Operación | Delay |
|---|---|
| API general | `delay(2000)` |
| Mockup generation | `delay(5000)` post-create |
| File upload | `delay(3000)` |

---

## Known Issues — Mockup Generation

| Issue | Affected Colors | Detail | Workaround |
|---|---|---|---|
| **Duplicate placement entries** | Vintage Black (all blanks) | Printful API returns duplicate `sleeve_left` entries for Vintage Black variants | Dedup by placement: `const seen = new Set(); for (const m of mockups) { if (seen.has(m.placement)) continue; seen.add(m.placement); ... }` |
| **Temporary S3 URLs** | All | Mockup URLs expire after ~24h | Always download + re-upload to Supabase Storage immediately |
| **Rate limit on mockup tasks** | All | ~10 tasks/min limit | Use `delay(10000-12000)` between color tasks |

**Shared rate limiter:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'` — handles token bucket, 429 retry, proactive slowdown, and exponential backoff automatically.
