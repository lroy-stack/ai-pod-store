# SKAPARA Branding Specification — Printful T-Shirts

Filosofia: **"No parece merch, parece marca."**

Conservativo. Reconocible. Escalable.

---

## Distribución de Branding

### Regla General (Diseño en Front)

| Posicion | Asset | Tamano | Colocacion |
|---|---|---|---|
| `sleeve_left` | S mark isotipo (blanco) | **32%** del ancho del canvas | Centrado en canvas 600x525 |
| `back` | SKAPARA wordmark (blanco) | **37%** del ancho del canvas | Centrado horizontal, zona alta (y=150px) |
| `front` | Diseno principal | 100% del canvas | Centrado (x=0.5, y=0.45) |

### Excepcion: Diseno en Back

Cuando el diseno principal va en la **espalda** en vez del frente:

| Posicion | Asset | Tamano | Colocacion |
|---|---|---|---|
| `sleeve_left` | S mark isotipo (blanco) | **32%** del ancho | Centrado en canvas 600x525 |
| `back` | Diseno principal | 100% del canvas | Centrado |
| `front` (left chest) | SKAPARA brandname | **~30%** scale | `x: 0.28, y: 0.22, scale: 0.3` (lado corazon) |

---

## Dimensiones Exactas

### Sleeve — S Mark

- Canvas: 600 x 525 px
- S mark width: **192px** (32% de 600)
- S mark height: proporcional (~148px basado en aspect ratio del SVG)
- Posicion: centrado vertical y horizontal
- Margen visual: minimo 12-15% alrededor del mark
- Archivo fuente: `public/brand/skapara-mark-white.svg`

### Back — Wordmark

- Canvas: 1800 x 2400 px
- Wordmark width: **666px** (37% de 1800)
- Wordmark height: proporcional (~68px basado en aspect ratio del SVG)
- Posicion: centrado horizontal, **y = 150px** desde el borde superior (zona alta, entre omoplatos)
- Tracking: ligeramente abierto (el SVG ya incluye el spacing correcto)
- Archivo fuente: `public/brand/skapara-wordmark-white.svg`

### Left Chest — Wordmark (solo para back-design products)

- Canvas: compartido con front (1800 x 2400)
- Posicion Printify: `x: 0.28, y: 0.22, scale: 0.3`
- Esto coloca el brandname en el pecho izquierdo, lado del corazon
- Tamano visible: ~540px wide (30% de 1800)

---

## Renderizado de Assets

### Comandos ImageMagick

```bash
# 1. Sleeve: S mark 32% centered
magick -density 300 -background none \
  public/brand/skapara-mark-white.svg \
  -resize 192x \
  -gravity center -extent 600x525 \
  PNG32:printful-ready/sleeve-left-600x525.png

# 2. Back: Wordmark 37% zona alta
magick -density 300 -background none \
  public/brand/skapara-wordmark-white.svg \
  -resize 666x \
  PNG32:tmp-wordmark.png

magick -size 1800x2400 xc:transparent \
  tmp-wordmark.png -gravity North -geometry +0+150 \
  -composite PNG32:printful-ready/back-wordmark-1800x2400.png

rm tmp-wordmark.png
```

### Reglas de Calidad

- **SIEMPRE renderizar desde SVG** (no escalar PNG existentes)
- **Density 300** para maxima calidad de rasterizacion
- **PNG32** formato para preservar canal alpha (transparencia)
- **Verificar visualmente** sobre fondo oscuro antes de subir
- Los SVG fuente estan en `/frontend/public/brand/`:
  - `skapara-mark-white.svg` (3967 bytes)
  - `skapara-wordmark-white.svg` (6190 bytes)

---

## Variantes de Color de Branding

| Garment Background | Sleeve Asset | Back Asset |
|---|---|---|
| Oscuro (Black, Navy, Pepper, Graphite) | `skapara-mark-white.svg` | `skapara-wordmark-white.svg` |
| Claro (si se habilitara) | `skapara-mark-dark.svg` | `skapara-wordmark-dark.svg` |

Actualmente todos los colores activos son oscuros, por lo que siempre usamos la variante blanca.

---

## Anti-Patrones (NO hacer)

- **NO** usar el S mark al 70%+ del canvas — parece merchandising promocional
- **NO** poner el wordmark a media espalda — debe ir en zona alta (entre omoplatos)
- **NO** copiar el diseno front al back — cada posicion tiene su proposito
- **NO** usar gradiente en DTG — gradiente solo para stickers y drinkware
- **NO** escalar PNGs existentes — siempre renderizar desde SVG fuente
- **NO** usar `label_outside` + `back` juntos — son mutuamente excluyentes en Printful
