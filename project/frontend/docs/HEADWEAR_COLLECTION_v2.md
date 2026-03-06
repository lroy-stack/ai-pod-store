# SKAPARA Headwear Collection v2 — Production Reference

> **Fecha**: 2026-03-04
> **Reemplaza**: 10 gorras antiguas (4 bucket hats Printify activos + 6 eliminados por P99 non-EU)
> **Provider**: Printful (Latvia) — EU fulfillment confirmado
> **Principio**: Max 5 variantes de color por producto, diseños light/dark text, branding premium integrado

---

## Resumen de la Coleccion

| # | Producto | Modelo Printful | CAT | Tecnica | Variantes | Retail (EUR) |
|---|---------|----------------|-----|---------|-----------|-------------|
| 1 | GPT — Dad Hat | Otto Cap 104-1018 | 396 | Embroidery | 4 colores | 29.99 |
| 2 | Prompt Me — Dad Hat | Otto Cap 104-1018 | 396 | DTFilm | 4 colores | 24.99 |
| 3 | NPC — Snapback | Yupoong 6089M | 99 | Embroidery | 5 colores | 29.99 |
| 4 | Nova — Snapback | Yupoong 6089M | 99 | Embroidery | 5 colores | 34.99 |
| 5 | Vibe Coded — Fisherman Beanie | AS Colour 1120 | 809 | Embroidery | 5 colores | 29.99 |
| 6 | Dark Mode — Eco Beanie | Atlantis RIO | 519 | Embroidery | 5 colores | 34.99 |
| 7 | AI Wrote This — Corduroy Hat | Beechfield B682 | 532 | Embroidery | 4 colores | 34.99 |
| 8 | Friday Deploy — Corduroy Hat | Beechfield B682 | 532 | DTFilm | 4 colores | 27.99 |
| 9 | Flux — AOP Bucket Hat | AOP Reversible | 654 | CUT-SEW | 3 tallas | 39.99 |
| 10 | Facet — AOP Bucket Hat | AOP Reversible | 654 | CUT-SEW | 3 tallas | 39.99 |

**Total SKUs**: 42 variantes (sin contar tallas de bucket hats)

---

## Estrategia de Branding por Modelo

### Principio general

El branding SKAPARA debe sentirse integrado, NO estampado. Cada placement tiene una funcion:

| Placement | Funcion | Contenido |
|-----------|---------|-----------|
| **Front** | Diseno principal | Texto/icono del producto |
| **Back** | Marca secundaria | `skapara.com` en texto pequeno o S mark |
| **Left side** | Branding sutil | S mark isotipo pequeno |
| **Right side** | Reservado | Solo si el diseno lo requiere |

### Regla de branding por modelo

| Modelo | Front | Back | Left | Right | Total placements |
|--------|-------|------|------|-------|-----------------|
| Otto Cap 104-1018 (Emb) | Diseno principal | `skapara.com` (PF#76, 2"x1") | S mark (PF#76, 2"x1") | - | 3 |
| Otto Cap 104-1018 (DTF) | Diseno principal (PF#816) | - | - | - | 1 (solo front DTF) |
| Yupoong 6089M (Emb) | Diseno principal (PF#478) | `skapara.com` (PF#76) | S mark (PF#706, 2.25"x2.25") | - | 3 |
| AS Colour 1120 (Emb) | Diseno principal (PF#74) | - | - | - | 1 (solo front) |
| Atlantis RIO (Emb) | Diseno principal (PF#74) | - | - | - | 1 (solo front) |
| Beechfield B682 (Emb) | Diseno principal (PF#78) | `skapara.com` (PF#76) | S mark (PF#76) | - | 3 |
| Beechfield B682 (DTF) | Diseno principal (PF#816) | - | - | - | 1 (solo front DTF) |
| AOP Bucket (CUT-SEW) | Diseno all-over | Diseno all-over (cont.) | N/A | N/A | 4 (out_front, out_back, in_front, in_back) + 2 labels |

**NOTA sobre beanies**: AS Colour 1120 y Atlantis RIO solo tienen front placement. No hay espacio para branding secundario. El S mark SKAPARA debe integrarse dentro del diseno principal (esquina inferior, <15% del canvas).

---

## Estrategia de Colores Light/Dark

### Regla de hilo/tinta

| Tipo de gorra | Hilos/tinta claros (white, cream, gold) | Hilos/tinta oscuros (black, navy, dark grey) |
|---------------|----------------------------------------|---------------------------------------------|
| **Dark garments** (Black, Navy, Charcoal, Dark Olive, Olive, Cypress, Petrol Blue) | SI — disenar con texto claro | NO |
| **Light garments** (Khaki, Camel, Beige, Ecru, Gold, Light Grey, White, Mustard, Acid Green) | NO | SI — disenar con texto oscuro |
| **Medium garments** (Athletic Heather, Walnut, Red) | Ambos posibles — evaluar contraste | Ambos posibles — evaluar contraste |

### Regla de diseno

Cada producto necesita **2 versiones del diseno**:
1. **VERSION LIGHT** (para gorras oscuras): Texto/elementos en blanco/cream/gold sobre fondo oscuro
2. **VERSION DARK** (para gorras claras): Texto/elementos en negro/navy/charcoal sobre fondo claro

Para embroidery, esto se traduce en elegir 2 sets de colores de hilo (max 6 por diseno, pero SKAPARA usa max 3 por simplicidad premium).

---

## Productos — Fichas de Produccion

---

### PRODUCTO 1: GPT — Embroidered Dad Hat

**Modelo**: Otto Cap 104-1018 Distressed Dad Hat (CAT 396)
**Tecnica**: Embroidery
**Skill**: `printful-otto1018-embroidery`

**Concepto de diseno**: Letras "GPT" en bold block, estilo tech. Tricolor: G=Teal (#14B8A6), P=Purple (#A855F7), T=White/Black (segun version). Acento gold dot.

**Variantes de color (4)**:

| # | Color gorra | Hex | Tono | Version diseno | Hilos principales |
|---|------------|-----|------|---------------|-------------------|
| 1 | Black | #000000 | Dark | LIGHT | White, Teal, Purple |
| 2 | Navy | #1B3A4B | Dark | LIGHT | White, Teal, Purple |
| 3 | Charcoal Grey | #4A4A4A | Dark | LIGHT | White, Teal, Purple |
| 4 | Khaki | #C3B091 | Light | DARK | Black, Teal, Purple |

**Placements (3)**:

| Placement | Contenido | Canvas | Coste |
|-----------|-----------|--------|-------|
| `embroidery_front` (PF#75) | "GPT" tricolor block letters | 1650x600 @300dpi (5.5"x2") | +2.95 |
| `embroidery_back` (PF#76) | `skapara.com` en hilo matching | 600x300 @300dpi (2"x1") | +2.95 |
| `embroidery_left` (PF#76) | S mark isotipo | 600x300 @300dpi (2"x1") | +2.95 |

**Pricing**:
| Base | Placements (x3) | Total produccion | Retail | Margen |
|------|-----------------|-----------------|--------|--------|
| ~14.85 avg | +8.85 | ~23.70 | 29.99 | ~20.9% |

**ALERTA MARGEN**: Con 3 placements el margen cae bajo 35%. Opciones:
- **Opcion A**: Subir retail a 34.99 EUR (margen ~32.3%) — sigue bajo 35%
- **Opcion B**: Reducir a 2 placements (front + back, sin side) → produccion ~20.75, retail 29.99 = 30.6%
- **Opcion C**: Reducir a 1 placement (solo front) → produccion ~17.80, retail 29.99 = 40.6%
- **RECOMENDACION**: **Opcion C** (1 placement, solo front) o **Opcion B** (2 placements, retail 34.99)

**Mockups**: Ghost front + Ghost back (si 2P). Usar `option_groups: ["Ghost"]`, `options: ["Front"]`.

---

### PRODUCTO 2: Prompt Me — DTFilm Dad Hat

**Modelo**: Otto Cap 104-1018 Distressed Dad Hat (CAT 396)
**Tecnica**: DTFilm (DTFlex)
**Skill**: `printful-otto1018-dtfilm`

**Concepto de diseno**: "PROMPT ME" en tipografia bold sans-serif, full color con gradiente sutil SKAPARA (teal→purple). DTFilm permite colores ilimitados y gradientes, a diferencia de embroidery.

**Variantes de color (4)**:

| # | Color gorra | Hex | Tono | Version diseno | Palette DTFilm |
|---|------------|-----|------|---------------|----------------|
| 1 | Black | #000000 | Dark | LIGHT | Texto blanco con gradiente teal→purple |
| 2 | Navy | #1B3A4B | Dark | LIGHT | Texto blanco con gradiente teal→purple |
| 3 | Charcoal Grey | #4A4A4A | Dark | LIGHT | Texto blanco con gradiente teal→purple |
| 4 | Khaki | #C3B091 | Light | DARK | Texto negro con gradiente teal→purple |

**Placements (1)**:

| Placement | Contenido | Canvas | Coste |
|-----------|-----------|--------|-------|
| `front_dtf_hat` (PF#816) | "PROMPT ME" gradiente | 1500x600 @300dpi (5"x2") | +2.60 |

**Pricing**:
| Base | Placements (x1) | Total produccion | Retail | Margen |
|------|-----------------|-----------------|--------|--------|
| ~13.20 avg | +2.60 | ~15.80 | 24.99 | 36.8% |

**Ventaja DTFilm**: Full color + gradientes, coste menor que embroidery, area de impresion 5"x2" (vs embroidery 5.5"x2"). Margen OK con 1 placement.

**Mockups**: Ghost front. `technique` option requerida: `{ "id": "technique", "value": "dtfilm" }`.

---

### PRODUCTO 3: NPC — Embroidered Snapback

**Modelo**: Yupoong 6089M Wool Blend Snapback (CAT 99)
**Tecnica**: Embroidery
**Skill**: `printful-6089m-embroidery`

**Concepto de diseno**: "NPC" en giant block letters tricolor — N=Pink (#EC4899), P=Orange (#F97316), C=Violet (#8B5CF6). Estilo gamer/meme. Front canvas mas grande de todos los hats (6.3"x2.55") permite letras XXL.

**Variantes de color (5)**:

| # | Color gorra | Hex | Tono | Version diseno | Hilos principales |
|---|------------|-----|------|---------------|-------------------|
| 1 | Black | #000000 | Dark | LIGHT | White outline + Pink, Orange, Violet fill |
| 2 | Dark Navy | #1B1B3A | Dark | LIGHT | White outline + Pink, Orange, Violet fill |
| 3 | Dark Grey | #4A4A4A | Dark | LIGHT | White outline + Pink, Orange, Violet fill |
| 4 | Silver | #C0C0C0 | Light | DARK | Black outline + Pink, Orange, Violet fill |
| 5 | Natural | #F5F0E1 | Light | DARK | Black outline + Pink, Orange, Violet fill |

**Placements (2)**:

| Placement | Contenido | Canvas | Coste |
|-----------|-----------|--------|-------|
| `embroidery_front` (PF#478) | "NPC" tricolor block | 1890x765 @300dpi (6.3"x2.55") | +2.95 |
| `embroidery_left` (PF#706) | S mark isotipo | 675x675 @300dpi (2.25"x2.25") | +2.95 |

**Pricing**:
| Base | Placements (x2) | Total produccion | Retail | Margen |
|------|-----------------|-----------------|--------|--------|
| ~13.62 avg | +5.90 | ~19.52 | 29.99 | 34.9% |

**NOTA**: 3D puff (+1.50 EUR) disponible en este modelo estructurado — considerar para las letras principales. Subiria produccion a ~21.02, margen a 29.9% con retail 29.99 o 39.9% con retail 34.99.

**RECOMENDACION**: Sin 3D puff a 29.99 (margen ~35%) o con 3D puff a 34.99 (premium positioning).

**Mockups**: Ghost front. Side placements dificiles de mockear. Generar solo front mockup.

---

### PRODUCTO 4: Nova — Embroidered Snapback (Premium)

**Modelo**: Yupoong 6089M Wool Blend Snapback (CAT 99)
**Tecnica**: Embroidery + 3D Puff
**Skill**: `printful-6089m-embroidery`

**Concepto de diseno**: Burst geometrico concentrico — circulos expandiendose desde el centro, estilo "supernova". Diseno iconico, no texto. Ideal para 3D puff en el circulo central + flat embroidery en los rayos.

**Variantes de color (5)**:

| # | Color gorra | Hex | Tono | Version diseno | Hilos principales |
|---|------------|-----|------|---------------|-------------------|
| 1 | Black | #000000 | Dark | LIGHT | White (3D puff centro), Gold rays |
| 2 | Dark Navy | #1B1B3A | Dark | LIGHT | White (3D puff centro), Silver rays |
| 3 | Royal Blue | #4169E1 | Dark | LIGHT | White (3D puff centro), Gold rays |
| 4 | Heather Grey | #B0B0B0 | Medium | DARK | Black (3D puff centro), Gold rays |
| 5 | Natural | #F5F0E1 | Light | DARK | Black (3D puff centro), Navy rays |

**Placements (2)**:

| Placement | Contenido | Canvas | Coste |
|-----------|-----------|--------|-------|
| `embroidery_front` (PF#478) + 3D Puff | Burst geometrico + circulo 3D puff central | 1890x765 @300dpi | +2.95 + 1.50 (puff) |
| `embroidery_back` (PF#76) | `skapara.com` mini | 600x300 @300dpi | +2.95 |

**Pricing**:
| Base | Front + Puff + Back | Total produccion | Retail | Margen |
|------|---------------------|-----------------|--------|--------|
| ~13.62 avg | +7.40 | ~21.02 | 34.99 | 39.9% |

**RECOMENDACION**: 34.99 EUR — posicionamiento premium con 3D puff justifica el precio.

**Mockups**: Ghost front (el 3D puff se ve en mockup como area elevada).

---

### PRODUCTO 5: Vibe Coded — Fisherman Beanie

**Modelo**: AS Colour 1120 Fisherman Beanie (CAT 809)
**Tecnica**: Embroidery
**Skill**: `printful-1120-embroidery`

**Concepto de diseno**: "VIBE CODED" en una sola linea, tipografia condensed bold, centered. Minimalista — max 2 colores de hilo. El cuff ancho del beanie da buena visibilidad al texto frontal.

**Variantes de color (5)**:

| # | Color gorra | Hex | Tono | Version diseno | Hilos principales |
|---|------------|-----|------|---------------|-------------------|
| 1 | Black | #000000 | Dark | LIGHT | White text |
| 2 | Cypress | #4A5D3A | Dark | LIGHT | White text |
| 3 | Petrol Blue | #2B4F6E | Dark | LIGHT | White text |
| 4 | Ecru | #F5F0E1 | Light | DARK | Black text |
| 5 | Gold | #DAA520 | Light | DARK | Black text |

**Placements (1)**:

| Placement | Contenido | Canvas | Coste |
|-----------|-----------|--------|-------|
| `embroidery_front` (PF#74) | "VIBE CODED" condensed bold | 1500x525 @300dpi (5"x1.75") | +2.60 |

**Pricing**:
| Base | Placements (x1) | Total produccion | Retail | Margen |
|------|-----------------|-----------------|--------|--------|
| 14.95 | +2.60 | 17.55 | 29.99 | 41.5% |

**Branding**: Sin placement secundario (solo front disponible). S mark SKAPARA integrado en el diseno, esquina inferior derecha del canvas, ~150px height, mismo color que el texto principal.

**Mockups**: Ghost front. Un solo placement = un solo mockup por color.

---

### PRODUCTO 6: Dark Mode — Eco Beanie

**Modelo**: Atlantis RIO Ribbed Knit Beanie (CAT 519)
**Tecnica**: Embroidery
**Skill**: `printful-rio-embroidery`

**Concepto de diseno**: "DARK MODE" en tipografia monospace/terminal (como codigo). Referencia al tema oscuro de los IDEs. La certificacion GRS (recycled) refuerza el posicionamiento eco-tech.

**Variantes de color (5)**:

| # | Color gorra | Hex | Tono | Version diseno | Hilos principales |
|---|------------|-----|------|---------------|-------------------|
| 1 | Black | #000000 | Dark | LIGHT | Green (#00FF00, estilo terminal) |
| 2 | Navy | #1B3A4B | Dark | LIGHT | Green (#00FF00, estilo terminal) |
| 3 | Olive | #556B2F | Dark | LIGHT | White text |
| 4 | Beige | #F5DEB3 | Light | DARK | Black text |
| 5 | Light Grey Melange | #C0C0C0 | Light | DARK | Black text |

**Placements (1)**:

| Placement | Contenido | Canvas | Coste |
|-----------|-----------|--------|-------|
| `embroidery_front` (PF#74) | "DARK MODE" monospace + cursor block | 1500x525 @300dpi (5"x1.75") | +2.95 |

**Pricing**:
| Base | Placements (x1) | Total produccion | Retail | Margen |
|------|-----------------|-----------------|--------|--------|
| ~16.95 | +2.95 | ~19.90 | 34.99 | 43.1% |

**USP eco**: GRS certified (Global Recycled Standard) + OEKO-TEX. 50% recycled polyester. Mencionar en GPSR y descripcion.

**Branding**: S mark SKAPARA integrado en diseno (mismo que Vibe Coded). Sin placement secundario.

**Mockups**: Ghost front.

---

### PRODUCTO 7: AI Wrote This — Corduroy Hat

**Modelo**: Beechfield B682 Corduroy Hat (CAT 532)
**Tecnica**: Embroidery
**Skill**: `printful-b682-embroidery`

**Concepto de diseno**: "AI WROTE THIS" en tipografia serif elegante, estilo editorial. La textura corduroy da feel premium/vintage. Diseno 2 colores max (texto + acento).

**Variantes de color (4)**:

| # | Color gorra | Hex | Tono | Version diseno | Hilos principales |
|---|------------|-----|------|---------------|-------------------|
| 1 | Black | #000000 | Dark | LIGHT | White text, Gold acento |
| 2 | Dark Olive | #4B5320 | Dark | LIGHT | White text, Gold acento |
| 3 | Oxford Navy | #1C2541 | Dark | LIGHT | White text, Gold acento |
| 4 | Camel | #C19A6B | Light | DARK | Black text, Navy acento |

**Placements (3)**:

| Placement | Contenido | Canvas | Coste |
|-----------|-----------|--------|-------|
| `embroidery_front` (PF#78) | "AI WROTE THIS" serif | 1200x525 @300dpi (4"x1.75") | +2.95 |
| `embroidery_back` (PF#76) | `skapara.com` | 600x300 @300dpi | +2.95 |
| `embroidery_left` (PF#76) | S mark | 600x300 @300dpi | +2.95 |

**Pricing**:
| Base | Placements (x3) | Total produccion | Retail | Margen |
|------|-----------------|-----------------|--------|--------|
| 16.95 | +8.85 | 25.80 | 34.99 | 26.3% |

**ALERTA MARGEN**: 26.3% con 3 placements. Opciones:
- **Opcion A**: Subir a 39.99 EUR → margen 35.5% — OK pero caro para corduroy hat
- **Opcion B**: 2 placements (front + back) → 22.85, retail 34.99 = 34.6% — casi 35%
- **Opcion C**: 1 placement (solo front) → 19.90, retail 34.99 = 43.1%
- **RECOMENDACION**: **Opcion B** (front + back, 34.99 EUR)

**NOTA front canvas**: El B682 tiene el front canvas MAS PEQUENO de todas las gorras (4"x1.75"). El texto debe ser compacto y bien legible a esta escala.

**Mockups**: Ghost front + Ghost back.

---

### PRODUCTO 8: Friday Deploy — Corduroy Hat (DTFilm)

**Modelo**: Beechfield B682 Corduroy Hat (CAT 532)
**Tecnica**: DTFilm (DTFlex)
**Skill**: `printful-b682-dtfilm`

**Concepto de diseno**: "FRIDAY DEPLOY" en tipografia bold tech con icono de rocket/deploy. Full color DTFilm permite degradados y mas detalle que embroidery. Area de impresion DTFilm es 25% mas grande que embroidery front (5"x2" vs 4"x1.75").

**Variantes de color (4)**:

| # | Color gorra | Hex | Tono | Version diseno | Palette DTFilm |
|---|------------|-----|------|---------------|----------------|
| 1 | Black | #000000 | Dark | LIGHT | Texto blanco + rocket gradiente orange→red |
| 2 | Dark Olive | #4B5320 | Dark | LIGHT | Texto blanco + rocket gradiente orange→red |
| 3 | Oxford Navy | #1C2541 | Dark | LIGHT | Texto blanco + rocket gradiente orange→red |
| 4 | Camel | #C19A6B | Light | DARK | Texto negro + rocket gradiente teal→blue |

**Placements (1)**:

| Placement | Contenido | Canvas | Coste |
|-----------|-----------|--------|-------|
| `front_dtf_hat` (PF#816) | "FRIDAY DEPLOY" + rocket icon | 1500x600 @300dpi (5"x2") | +2.60 |

**Pricing**:
| Base | Placements (x1) | Total produccion | Retail | Margen |
|------|-----------------|-----------------|--------|--------|
| 13.45 | +2.60 | 16.05 | 27.99 | 42.7% |

**Ventaja DTFilm**: Coste menor (13.45 vs 16.95 base embroidery), canvas mas grande, colores ilimitados, gradientes. Excelente margen.

**Mockups**: Ghost front. `technique` option requerida.

---

### PRODUCTO 9: Flux — AOP Reversible Bucket Hat

**Modelo**: AOP Reversible Bucket Hat (CAT 654)
**Tecnica**: CUT-SEW (sublimacion all-over)
**Skill**: `printful-aop-bucket`

**Concepto de diseno**: Patron diagonal de 4 franjas en Pink/Orange/Teal/Violet sobre fondo negro. Diseno geometrico bold que cubre toda la superficie. Cara interior: patron invertido (colores intercambiados). Reversible = 2 looks en 1.

**Variantes (3 tallas, mismo diseno)**:

| # | Talla | Variant ID | Coste base |
|---|-------|-----------|-----------|
| 1 | XS | 19255 | 21.74 |
| 2 | S/M | 16360 | 21.74 |
| 3 | L/XL | 16361 | 21.74 |

**NO hay variantes de color** — la gorra es White y el diseno sublimado ES el color.

**Placements (6, todos incluidos)**:

| Placement | Printfile | Canvas | Contenido |
|-----------|-----------|--------|-----------|
| `outside_front` (PF#410) | 2700x3150 @150dpi | Patron diagonal Flux — lado A |
| `outside_back` (PF#410) | 2700x3150 @150dpi | Continuacion patron diagonal |
| `inside_front` (PF#410) | 2700x3150 @150dpi | Patron invertido — lado B |
| `inside_back` (PF#410) | 2700x3150 @150dpi | Continuacion patron invertido |
| `label_outside` (PF#411) | 450x300 @150dpi | SKAPARA wordmark + S mark |
| `label_inside` (PF#411) | 450x300 @150dpi | SKAPARA + "skapara.com" |

**Pricing**:
| Base (incluye 6P) | Total produccion | Retail | Margen |
|-------------------|-----------------|--------|--------|
| 21.74 | 21.74 | 39.99 | 45.6% |

**Branding**: Labels personalizados (PF#411). El branding se integra en las labels, no en el diseno principal. El patron Flux ES la identidad.

**IMPORTANTE DPI**: AOP Bucket es 150 DPI (NO 300). Canvases de 2700x3150 = 18"x21" fisicos.

**Mockups**: Ghost es la unica opcion disponible para AOP bucket hats. Generar front y back de ambos lados (outside + inside).

---

### PRODUCTO 10: Facet — AOP Reversible Bucket Hat

**Modelo**: AOP Reversible Bucket Hat (CAT 654)
**Tecnica**: CUT-SEW (sublimacion all-over)
**Skill**: `printful-aop-bucket`

**Concepto de diseno**: Patron geometrico de diamantes/cristales facetados en degradado teal→purple sobre fondo dark. Estilo low-poly/faceted. Cara interior: version monocromo del patron en grises sobre negro. Reversible = bold exterior, stealth interior.

**Variantes (3 tallas, mismo diseno)**:

| # | Talla | Variant ID | Coste base |
|---|-------|-----------|-----------|
| 1 | XS | 19255 | 21.74 |
| 2 | S/M | 16360 | 21.74 |
| 3 | L/XL | 16361 | 21.74 |

**Placements (6, todos incluidos)**: Misma estructura que Flux.

| Placement | Contenido |
|-----------|-----------|
| `outside_front` | Patron faceted teal→purple |
| `outside_back` | Continuacion patron |
| `inside_front` | Version monocromo grises/negro |
| `inside_back` | Continuacion monocromo |
| `label_outside` | SKAPARA wordmark + S mark |
| `label_inside` | SKAPARA + "skapara.com" |

**Pricing**: Identico a Flux — 21.74 produccion, 39.99 retail, 45.6% margen.

**Mockups**: Ghost front y back, ambos lados.

---

## Resumen de Costes y Margenes

| # | Producto | Modelo | Tecnica | Placements | Produccion (EUR) | Retail (EUR) | Margen |
|---|---------|--------|---------|------------|-----------------|-------------|--------|
| 1 | GPT | Otto Cap | Emb 1P | 1 | ~17.80 | 29.99 | 40.6% |
| 2 | Prompt Me | Otto Cap | DTF 1P | 1 | ~15.80 | 24.99 | 36.8% |
| 3 | NPC | 6089M | Emb 2P | 2 | ~19.52 | 29.99 | 34.9% |
| 4 | Nova | 6089M | Emb 2P+Puff | 2+puff | ~21.02 | 34.99 | 39.9% |
| 5 | Vibe Coded | AS 1120 | Emb 1P | 1 | 17.55 | 29.99 | 41.5% |
| 6 | Dark Mode | RIO | Emb 1P | 1 | ~19.90 | 34.99 | 43.1% |
| 7 | AI Wrote This | B682 | Emb 2P | 2 | 22.85 | 34.99 | 34.7% |
| 8 | Friday Deploy | B682 | DTF 1P | 1 | 16.05 | 27.99 | 42.7% |
| 9 | Flux | AOP Bucket | CUT-SEW | 6 (incl) | 21.74 | 39.99 | 45.6% |
| 10 | Facet | AOP Bucket | CUT-SEW | 6 (incl) | 21.74 | 39.99 | 45.6% |

**Margen promedio**: 40.5%
**Producto con mejor margen**: Flux/Facet AOP Bucket (45.6%)
**Producto con peor margen**: NPC Snapback (34.9%) — considerar subir a 34.99 para 39.9%
**Rango de precios**: 24.99 - 39.99 EUR

---

## Mockup Strategy

### Tipo preferido: Ghost

Todos los mockups se generan con `option_groups: ["Ghost"]` (gorra flotando sin modelo humano).

### Mockups por producto

| Producto | Mockups a generar | Variantes para mock |
|---------|-------------------|---------------------|
| GPT | 1x Ghost Front | 1 dark (Black) + 1 light (Khaki) = 2 |
| Prompt Me | 1x Ghost Front | 1 dark (Black) + 1 light (Khaki) = 2 |
| NPC | 1x Ghost Front, 1x Ghost Side-Left | 1 dark (Black) + 1 light (Silver) = 2-4 |
| Nova | 1x Ghost Front, 1x Ghost Back | 1 dark (Black) + 1 light (Natural) = 2-4 |
| Vibe Coded | 1x Ghost Front | 1 dark (Black) + 1 light (Ecru) = 2 |
| Dark Mode | 1x Ghost Front | 1 dark (Black) + 1 light (Beige) = 2 |
| AI Wrote This | 1x Ghost Front, 1x Ghost Back | 1 dark (Black) + 1 light (Camel) = 2-4 |
| Friday Deploy | 1x Ghost Front | 1 dark (Black) + 1 light (Camel) = 2 |
| Flux | 1x Ghost Front Outside, 1x Ghost Front Inside | 1 talla (S/M) = 2 |
| Facet | 1x Ghost Front Outside, 1x Ghost Front Inside | 1 talla (S/M) = 2 |

**Total mockups estimados**: ~22-28 mockups

### Proceso de mockup

```bash
# Ejemplo: Generar mockup Ghost para Otto Cap
curl -X POST "https://api.printful.com/mockup-generator/create-task/396" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "variant_ids": [10990],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front"],
    "files": [{
      "placement": "embroidery_front",
      "image_url": "DESIGN_URL",
      "position": {
        "area_width": 1650,
        "area_height": 600,
        "width": 1650,
        "height": 600,
        "top": 0,
        "left": 0
      }
    }]
  }'
```

---

## GPSR Template (para todos los headwear)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p>
<p><strong>Material:</strong> [MATERIAL_PER_MODEL]</p>
<p><strong>Print technique:</strong> [TECHNIQUE]</p>
<p><strong>Care:</strong> [CARE_PER_MODEL]</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

### Care instructions por modelo

| Modelo | Care |
|--------|------|
| Otto Cap 104-1018 | Spot clean only. Do not machine wash. Do not iron directly on embroidery/print. |
| Yupoong 6089M | Spot clean only. Do not machine wash. Do not bleach. Reshape while damp. |
| AS Colour 1120 | Hand wash cold. Lay flat to dry. Do not bleach. |
| Beechfield B682 | Spot clean only. Do not machine wash. Do not iron directly on embroidery/print. |
| Atlantis RIO | Hand wash cold. Lay flat to dry. Do not bleach. Do not tumble dry. |
| AOP Bucket Hat | Machine wash cold, inside out. Lay flat to dry. Do not bleach. |

### Material por modelo

| Modelo | Material |
|--------|----------|
| Otto Cap 104-1018 | 100% pre-shrunk cotton twill |
| Yupoong 6089M | 80% acrylic, 20% wool |
| AS Colour 1120 | 100% acrylic, ribbed knit |
| Beechfield B682 | 100% cotton corduroy |
| Atlantis RIO | 50% recycled polyester, 50% acrylic (GRS certified) |
| AOP Bucket Hat | 100% polyester, 275 g/m2 |

---

## Orden de Creacion Recomendado

| Paso | Producto | Modelo | Razon |
|------|---------|--------|-------|
| 1 | Vibe Coded | AS 1120 | 1 placement, simple, buen margen — warm-up |
| 2 | Dark Mode | RIO | 1 placement, simple, eco angle |
| 3 | Prompt Me | Otto DTF | 1 placement DTFilm, testea pipeline DTF |
| 4 | Friday Deploy | B682 DTF | 1 placement DTFilm, segundo test |
| 5 | GPT | Otto Emb | 1 placement embroidery, diseño validado |
| 6 | NPC | 6089M Emb | 2 placements, primer snapback |
| 7 | Nova | 6089M Emb+Puff | 2P + 3D puff, mas complejo |
| 8 | AI Wrote This | B682 Emb | 2 placements, premium |
| 9 | Flux | AOP Bucket | 6 archivos, pipeline AOP |
| 10 | Facet | AOP Bucket | 6 archivos, segundo AOP |

---

## Checklist Pre-Produccion (por producto)

- [ ] Diseno front creado en canvas correcto (ver tabla de placements por modelo)
- [ ] Version LIGHT del diseno (para gorras oscuras) — exportado PNG @300dpi
- [ ] Version DARK del diseno (para gorras claras) — exportado PNG @300dpi
- [ ] Diseno branding back (si aplica) — `skapara.com` en el canvas PF#76 (600x300)
- [ ] Diseno S mark side (si aplica) — S mark en canvas PF#76 o PF#706
- [ ] Labels AOP (si bucket hat) — SKAPARA en PF#411 (450x300)
- [ ] Todos los archivos subidos a Supabase Storage (permanente)
- [ ] Todos los archivos subidos a Printful File Library
- [ ] Producto creado en Printful con todas las variantes de color
- [ ] Precios correctos en Printful (verificar margen >35%)
- [ ] GPSR aceptado y safety_information en product_details
- [ ] Mockups Ghost generados (min 1 dark + 1 light por producto)
- [ ] Mockups descargados y subidos a Supabase Storage con `?v=timestamp`
- [ ] Producto en Supabase con traducciones EN/ES/DE
- [ ] Categoria correcta asignada (caps, snapbacks, beanies, bucket-hats)
- [ ] Verificado en shop: colores visibles, precio correcto, mockups cargando
