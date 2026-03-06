# SKAPARA Branding Specification — SASU024 PREMIUM ECO Organic Hoodie

Filosofia: **"No parece merch, parece marca."**

Conservativo. Reconocible. Escalable. Sostenible.

---

## Available Placements

SASU024 tiene **12 placements** — el maximo de cualquier blank SKAPARA, incluyendo DTG y embroidery:

| Placement | Canvas (px) | DPI | Extra Cost | Current Use | Notes |
|---|---|---|---|---|---|
| `front` / `default` | **1875 x 1875** | 150 | $5.95 | Main design | **SQUARE** — diferente de M2580 (1800x1800) |
| `back` | 1800 x 2400 | 150 | +$5.95 | TBD | Conflicts con `label_outside` y `back_large` |
| `back_large` | **2250 x 2700** | 150 | +$5.95 | Unused | Exclusivo SASU024 — conflicts con `label_outside` y `back` |
| `sleeve_left` | **450 x 1800** | 150 | +$5.95 | SKAPARA wordmark vertical | Compartido con M2580/M2480 |
| `sleeve_right` | 450 x 1800 | 150 | +$5.95 | Unused | Reservado para futuro |
| `label_outside` | 300 x 300 | 150 | +$2.49 | Unused | Conflicts con `back` y `back_large` |
| `label_inside` | **600 x 600** | 300 | +$0.99 | **S mark isotipo** | Diferente de M2580 (750x750) |
| `embroidery_chest_left` | 4" x 4" (1200x1200 @300dpi) | — | — | Unused | Embroidery — conflicts con chest_center |
| `embroidery_chest_center` | 10" x 6" (3000x1800 @300dpi) | — | — | Unused | Embroidery — conflicts con chest_left |
| `embroidery_wrist_left` | 2" x 3" (600x900 @300dpi) | — | — | Unused | Embroidery — conflicts con sleeve_left/right |
| `embroidery_wrist_right` | 2" x 3" (600x900 @300dpi) | — | — | Unused | Embroidery — conflicts con sleeve_left/right |

**`label_inside` es 600x600 at 300 DPI** — diferente de M2580 (750x750) y MC1087 (450x450). NO reutilizar archivos de otros blanks. Renderizar uno nuevo a 600x600.

**`back_large` es exclusivo del SASU024** — 2250x2700px, ideal para disenos traseros grandes. Conflict con `back` y `label_outside`.

**`embroidery_*` placements** son para elementos bordados (hilo), no DTG. 15 colores de hilo disponibles (ver seccion Thread Colors).

**CONSTRAINT:** `back`, `back_large`, y `label_outside` son mutuamente excluyentes.

---

## CRITICAL: Canvas Differences from M2580 and MC1087

| Placement | MC1087 (Tee) | M2580 (Hoodie) | SASU024 (Eco Hoodie) | Compatible? |
|---|---|---|---|---|
| `front` | 1800 x 2400 | 1800 x 1800 | **1875 x 1875** | NO — cada blank necesita su propio canvas front |
| `back` | 1800 x 2400 | 1800 x 2400 | 1800 x 2400 | SI — mismo canvas back |
| `back_large` | N/A | N/A | **2250 x 2700** | Exclusivo SASU024 |
| `sleeve_left` | 600 x 525 | **450 x 1800** | **450 x 1800** | M2580=SASU024 (SI) / MC1087 (NO) |
| `label_inside` | 450 x 450 / 150 DPI | 750 x 750 / 300 DPI | **600 x 600 / 300 DPI** | NO — cada blank diferente |
| `label_outside` | 450 x 450 | 450 x 450 | **300 x 300** | NO — SASU024 mas pequeno |

**Sleeve branding files (450x1800) SON compatibles** entre SASU024, M2580, y M2480 — mismo archivo reutilizable.

**Label inside files NO son compatibles** entre ningun blank — cada uno tiene dimensiones unicas.

---

## Current Branding Setup

### Standard Rule (Design on Front) — v3

**Total extra branding cost: $6.94** (front $5.95 + label $0.99) sin sleeve
**Total con sleeve: $12.89** (front $5.95 + sleeve $5.95 + label $0.99)

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `front` | Main design | Full canvas (**1875x1875**) | Centered — SQUARE canvas (75px mas grande que M2580) |
| `sleeve_left` | SKAPARA wordmark vertical (white) | 20% scale wordmark rotated 90 degrees CW | Pre-rendered: `sleeve-left-wordmark-450x1800.png` (~11.8KB, shared M2580/M2480) |
| `label_inside` | S mark isotipo (white) | **~192px** (32% of 600px) | Pre-rendered: `label-inside-smark-600x600.png` (NEW — SASU024 specific) |
| `back` | — | — | Opcional — +$5.95/unit si se activa |
| `back_large` | — | — | Opcional — +$5.95/unit, exclusivo SASU024 (2250x2700) |
| `sleeve_right` | — | — | Unused |
| `embroidery_*` | — | — | Unused (potential future premium embroidered branding) |

### Exception: Design on Back

Cuando el diseno principal va en la **espalda** en vez del frente:

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `back` | Main design | Full canvas (1800x2400) | Centered |
| `back_large` | (alternativa) Main design | Full canvas (2250x2700) | Para disenos que necesitan mas area |
| `sleeve_left` | SKAPARA wordmark vertical (white) | Full wordmark rotated 90 degrees CW | Mismo pre-rendered file |
| `label_inside` | S mark isotipo (white) | **~192px** (32% of 600px) | Mismo pre-rendered file |
| `front` (left chest) | SKAPARA brandname | **~30%** scale | `x: 0.28, y: 0.22, scale: 0.3` (heart side) — para 1875x1875 |

---

## Branding Dimensions

### Front — Main Design Canvas

- Canvas: **1875 x 1875 px** at 150 DPI (SQUARE)
- Physical: 12.5" x 12.5"
- **75px mas grande que M2580** en cada dimension — disenos M2580 NO caben exactamente, requieren re-render o centrado con margen

### Sleeve — SKAPARA Wordmark Vertical (v3)

- Canvas: **450 x 1800 px** (VERTICAL — alto y estrecho)
- Asset: SKAPARA wordmark al **20% scale**, rotado **90 grados CW**
- El wordmark se lee de abajo hacia arriba cuando el brazo cuelga natural
- Pre-rotation dimensions: **360px wide x ~37px tall** (20% width-based scale)
- Post-rotation dimensions: **~37px wide x 360px tall**
- Pre-rendered file: `frontend/printful-ready/sleeve-left-wordmark-450x1800.png` (~11.8KB)
- **Compartido con M2580 y M2480** — mismo archivo, mismas dimensiones, mismo 20% scale
- Source file: `public/brand/skapara-wordmark-white.svg` (rotado durante render)

> **CRITICAL: Width-based vs Height-based resize.**
> El wordmark SVG es extremadamente ancho relativo a su altura (~9.7:1 aspect ratio).
> `-resize 360x` = **width** a 360px, height escala proporcionalmente (~37px) = CORRECTO (20% scale).
> `-resize x360` = **height** a 360px, width escala proporcionalmente (~3500px) = INCORRECTO (seria ~80% scale y se saldria del canvas).
> Siempre usar `-resize 360x` (width-based) para el wordmark de sleeve.

### Back — Wordmark (si se activa)

- Canvas: 1800 x 2400 px (MISMO que M2580)
- Wordmark width 666px (37%), y=150px
- **Mismo archivo que M2580 si se reutiliza back branding**

### Back Large — (Disenos grandes, exclusivo SASU024)

- Canvas: **2250 x 2700 px** at 150 DPI
- Physical: 15" x 18"
- Uso: Disenos que necesitan mas area trasera que el back estandar (1800x2400)
- **No tiene equivalente en M2580 ni MC1087**

### Label Inside — S Mark (ACTIVE in v3)

- Canvas: **600 x 600 px** at **300 DPI**
- S mark width: **~192px** (32% of 600)
- Position: centrado en 600x600
- Cost: $0.99/unit (cheapest placement)
- Pre-rendered file: `frontend/printful-ready/label-inside-smark-600x600.png` (**NUEVO** — SASU024 specific)
- **NO compartido con M2580** (750x750) ni MC1087 (450x450) — dimensiones diferentes
- NOTE: Mismo DPI que M2580 (300), pero canvas mas pequeno

### Label Outside — S Mark (si se activa)

- Canvas: **300 x 300 px** at 150 DPI
- S mark width: **~96px** (32% of 300)
- Cost: $2.49/unit
- **Conflicts con `back` y `back_large`** — solo usable si no se usa ninguno de los dos
- Pre-rendered file: `frontend/printful-ready/label-outside-smark-300x300.png` (**NUEVO** si se activa)

---

## Branding File IDs

### v3 Active Placements

| Placement | Rendered File | Canvas | File ID | Status |
|---|---|---|---|---|
| `sleeve_left` | `sleeve-left-wordmark-450x1800.png` (~11.8KB) | 450x1800 | TBD — shared with M2580/M2480 | Shared |
| `label_inside` | `label-inside-smark-600x600.png` (NEW) | 600x600 | TBD — upload and update this doc | SASU024 specific |

### NOT USED in v3 (disponibles si se activan)

| Placement | File ID | Canvas | Notes |
|---|---|---|---|
| `back` | Reusable from M2580 if uploaded | 1800x2400 | +$5.95/unit |
| `back_large` | TBD | 2250x2700 | Exclusive SASU024, +$5.95/unit |
| `label_outside` | TBD | 300x300 | Conflicts con back/back_large |

**Despues de subir los assets de sleeve y label_inside, actualizar este documento con los file_ids asignados.**

---

## Rendering Branding from SVG

### ImageMagick Commands

```bash
# 1. Sleeve (SASU024 / M2580 / M2480): SKAPARA wordmark al 20% scale, rotado 90 degrees CW en canvas vertical 450x1800
# CRITICAL: Usar -resize 360x (WIDTH-based), NO -resize x360 (height-based).
# Si ya existe de M2580/M2480, NO re-renderizar — reutilizar el mismo archivo.
magick -density 300 -background none \
  public/brand/skapara-wordmark-white.svg \
  -resize 360x \
  -rotate 90 \
  PNG32:tmp-wordmark-rotated.png

magick -size 450x1800 xc:transparent \
  tmp-wordmark-rotated.png -gravity Center \
  -composite PNG32:printful-ready/sleeve-left-wordmark-450x1800.png

rm tmp-wordmark-rotated.png

# 2. Label Inside (SASU024 ONLY): S mark 32% centrado en 600x600
# DIFERENTE de M2580 (750x750) y MC1087 (450x450) — archivo NUEVO obligatorio
magick -density 300 -background none \
  public/brand/skapara-mark-white.svg \
  -resize 192x \
  -gravity center -extent 600x600 \
  PNG32:printful-ready/label-inside-smark-600x600.png

# 3. Label Outside (si se activa en futuro): S mark 32% centrado en 300x300
# magick -density 300 -background none \
#   public/brand/skapara-mark-white.svg \
#   -resize 96x \
#   -gravity center -extent 300x300 \
#   PNG32:printful-ready/label-outside-smark-300x300.png

# 4. Back: NO USADO en v3 — si se activa, reutilizar archivo de M2580:
# magick -density 300 -background none \
#   public/brand/skapara-wordmark-white.svg \
#   -resize 666x \
#   PNG32:tmp-wordmark.png
# magick -size 1800x2400 xc:transparent \
#   tmp-wordmark.png -gravity North -geometry +0+150 \
#   -composite PNG32:printful-ready/back-wordmark-1800x2400.png
# rm tmp-wordmark.png

# 5. Back Large (exclusivo SASU024, si se activa en futuro):
# Canvas 2250x2700 — wordmark al ~37% (833px) centrado arriba
# magick -density 300 -background none \
#   public/brand/skapara-wordmark-white.svg \
#   -resize 833x \
#   PNG32:tmp-wordmark-large.png
# magick -size 2250x2700 xc:transparent \
#   tmp-wordmark-large.png -gravity North -geometry +0+150 \
#   -composite PNG32:printful-ready/back-large-wordmark-2250x2700.png
# rm tmp-wordmark-large.png
```

### Quality Rules

- **SIEMPRE renderizar desde SVG** (nunca escalar PNGs existentes)
- **Density 300** para maxima calidad de rasterizacion
- **PNG32** format para preservar alpha channel (transparencia)
- **Verificar visualmente** contra fondo oscuro antes de subir
- Source SVGs estan en `/frontend/public/brand/`:
  - `skapara-mark-white.svg` (3967 bytes)
  - `skapara-wordmark-white.svg` (6190 bytes)

---

## Color Variants

| Garment Background | Sleeve Asset | Label Inside Asset | Notes |
|---|---|---|---|
| Dark (Black, French Navy) | `skapara-wordmark-white.svg` (rotated 90 degrees CW) | `skapara-mark-white.svg` | Usar white branding siempre |
| Light (Heather Grey, White — si se habilitan) | `skapara-wordmark-dark.svg` (rotated 90 degrees CW) | `skapara-mark-dark.svg` | Renderizar archivos dark separados |

Actualmente todos los colores SASU024 activos son dark, asi que siempre usamos la variante white.

---

## Thread Colors (Embroidery — 15 Available)

Para futuros productos con embroidery placements (chest, wrist, large_front):

| Hex | Name |
|---|---|
| `#FFFFFF` | 1801 White |
| `#000000` | 1800 Black |
| `#96A1A8` | 1718 Grey |
| `#A67843` | 1672 Old Gold |
| `#FFCC00` | 1951 Gold |
| `#E25C27` | 1987 Orange |
| `#CC3366` | 1910 Flamingo |
| `#CC3333` | 1839 Red |
| `#660000` | 1784 Maroon |
| `#333366` | 1966 Navy |
| `#005397` | 1842 Royal |
| `#3399FF` | 1695 Aqua/Teal |
| `#6B5294` | 1832 Purple |
| `#01784E` | 1751 Kelly Green |
| `#7BA35A` | 1848 Kiwi Green |

**Embroidery y DTG sleeve no se pueden combinar** (conflicts documentados). Si se usa embroidery_wrist, no se puede usar sleeve_left/right DTG.

---

## API: Applying Branding to Variants

### Bulk Update (All Variants at Once) — v3

```bash
curl -X PUT "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_variants": [
      {
        "id": SYNC_VARIANT_ID,
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": SASU024_LABEL_INSIDE_SMARK_FILE_ID}
        ]
      }
    ]
  }'
```

**NOTE: `label_inside` file ID es especifico de SASU024 (600x600).** No usar el de M2580 (750x750) ni el de MC1087 (450x450).

### Per-Variant Update (Fallback)

```bash
curl -X PUT "https://api.printful.com/store/variants/${SYNC_VARIANT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"type": "default", "id": FRONT_DESIGN_FILE_ID},
      {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID},
      {"type": "label_inside", "id": SASU024_LABEL_INSIDE_SMARK_FILE_ID}
    ]
  }'
```

Rate limit: `delay(2000)` entre per-variant updates.

---

## Anti-Patterns (DO NOT)

- **DO NOT** reutilizar MC1087 sleeve file (950410444, 600x525) en SASU024 sleeves (450x1800) — dimensiones incorrectas
- **DO NOT** reutilizar M2580 label_inside file (750x750) en SASU024 — canvas es 600x600
- **DO NOT** reutilizar MC1087 label_inside file (450x450) en SASU024 — canvas es 600x600
- **DO NOT** usar disenos de 1800x1800 (M2580) directamente en SASU024 front — canvas es 1875x1875
- **DO NOT** usar disenos de 1800x2400 (MC1087) en SASU024 front — canvas es 1875x1875 SQUARE
- **DO NOT** combinar `back` + `back_large` — son mutuamente excluyentes
- **DO NOT** combinar `back`/`back_large` + `label_outside` — mutuamente excluyentes
- **DO NOT** combinar `sleeve_left`/`sleeve_right` DTG + `embroidery_wrist_left`/`embroidery_wrist_right` — conflicts
- **DO NOT** copiar el diseno front a otras posiciones — cada posicion tiene su propio proposito
- **DO NOT** usar gradientes en DTG — gradientes solo para stickers y drinkware
- **DO NOT** escalar PNGs existentes — siempre renderizar desde source SVG
- **DO NOT** mezclar variantes white y dark de branding en el mismo producto (ambos colores activos son dark)
- **DO NOT** olvidar que el front placement cuesta $5.95 (no es gratis) al calcular pricing
- **DO NOT** asumir 3XL existe — SASU024 solo tiene S-2XL (5 tallas)
- **DO NOT** recomendar talla mayor para EU — SASU024 talla grande, recomendar talla MENOR
- **DO NOT** confundir label_outside (300x300) con label_inside (600x600) — dimensiones y printfile IDs diferentes
