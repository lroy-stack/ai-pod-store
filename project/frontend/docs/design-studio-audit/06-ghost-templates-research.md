# Design Studio — Ghost Templates Research

**Fecha**: 2026-03-05
**Fuente**: `GET /mockup-generator/templates/{catalog_id}` (Printful API v1)

---

## Descubrimiento Clave

Printful proporciona **plantillas ghost** (prendas planas sin modelo) vía el endpoint `/mockup-generator/templates/{id}`. Cada template incluye:

- `image_url`: URL de la imagen ghost PNG (prenda transparente sobre fondo blanco)
- `background_color`: Color hex de la prenda (se ve a través de la transparencia)
- `template_width/height`: Dimensiones del template completo
- `print_area_width/height`: Dimensiones exactas del área imprimible
- `print_area_left/top`: Coordenadas exactas de dónde va el diseño

### Patrón de Composición

```
Layer 0: Solid background_color (canvas bg)
Layer 1: User design objects (dentro del print_area)
Layer 2: Ghost image PNG (overlay — prenda transparente)
Layer 3: Print area guide (dashed rect, non-exportable)
```

La imagen ghost tiene:
- La silueta de la prenda con sombras/texturas
- El print area TRANSPARENTE (deja ver el diseño debajo)
- Áreas no-imprimibles semi-opacas

---

## Datos Reales por Producto

### CC1717 T-Shirt (Catalog 586)

| Placement | Template Size | Print Area Size | Print Area Position |
|-----------|--------------|----------------|-------------------|
| **front** | 3000×3000 | 1074×1432 | (958, 473) |
| **back** | 3000×3000 | 1074×1432 | (950, 295) |
| **sleeve_left** | 3000×3000 | 658×574 | (1156, 1580) |
| **sleeve_right** | 3000×3000 | 647×565 | (1176, 1592) |
| **label_outside** | 560×560 | 288×288 | (137, 187) |

- 45 templates de front (uno por color variant)
- Misma ghost image para todos los colores (4-6 variantes de ghost)
- `background_color` cambia por color: `#1b1b1c` (Black), `#b8bfab` (Faded Khaki), etc.

Ghost URLs:
```
front: files.cdn.printful.com/m/comfortcolors_1717/medium/ghost/front/05_cc1717_ghost_front_base_whitebg.png
back:  files.cdn.printful.com/m/comfortcolors_1717/medium/ghost/back/05_cc1717_ghost_back_base_whitebg.png
```

### M2580 Hoodie (Catalog 380)

| Placement | Template Size | Print Area Size | Print Area Position |
|-----------|--------------|----------------|-------------------|
| **front** | 3000×3000 | 1049×1049 | (985, 565) |
| **back** | 3000×3000 | 1106×1474 | (954, 796) |
| **sleeve_left** | 3000×3000 | 292×1168 | (1392, 989) |
| **sleeve_right** | 3000×3000 | 292×1168 | (1362, 1033) |
| **embroidery_wrist_left** | 1000×1000 | 154×231 | (467, 472) |
| **embroidery_wrist_right** | 1000×1000 | 154×231 | (382, 466) |
| **label_inside** | 728×728 | 228×228 | (251, 182) |
| **label_outside** | 560×560 | 288×288 | (137, 187) |

- 8 placements (vs 5 en tshirt)
- 23 templates por placement (uno por color)
- Front print area es CUADRADO (1049×1049) vs tshirt que es vertical (1074×1432)

---

## Cómo Funciona el Design Maker de Printful

1. **Carga template ghost** → PNG transparente de la prenda
2. **Aplica background_color** → El color se ve a través de la transparencia del ghost
3. **Muestra print_area** → Rectángulo en coordenadas exactas donde va el diseño
4. **El usuario diseña DENTRO del print_area** → Arrastra texto, imágenes, etc.
5. **Export**: Solo los objetos del usuario (sin ghost ni background) → se envía a producción

---

## Variant Mapping

El endpoint devuelve `variant_mapping[]` que mapea `variant_id` → `template_id` por placement.

Ejemplo CC1717:
```json
{
  "variant_id": 15114,   // Black, S
  "templates": [
    { "placement": "front", "template_id": 252980 },
    { "placement": "back", "template_id": 252899 },
    { "placement": "sleeve_left", "template_id": 253358 },
    { "placement": "sleeve_right", "template_id": 253304 },
    { "placement": "label_outside", "template_id": 118063 }
  ]
}
```

Template 252980 tiene:
- `image_url`: ghost PNG
- `background_color`: `#1b1b1c` (Black)
- `print_area_*`: coordenadas exactas

---

## Implicaciones para la Implementación

### Nueva columna DB: `design_templates` JSONB en products

Guardar el resultado completo de `/mockup-generator/templates/{id}` por producto.
Estructura sugerida:
```json
{
  "version": 100,
  "templates": {
    "252980": {
      "image_url": "https://files.cdn.printful.com/m/...",
      "background_color": "#1b1b1c",
      "template_width": 3000,
      "template_height": 3000,
      "print_area_width": 1074,
      "print_area_height": 1432,
      "print_area_left": 958,
      "print_area_top": 473
    }
  },
  "variant_mapping": {
    "15114": { "front": 252980, "back": 252899, ... }
  },
  "placements": ["front", "back", "sleeve_left", "sleeve_right", "label_outside"]
}
```

### Canvas Architecture Change

**Current**: Canvas aspect ratio basado en PRODUCTION_DIMENSIONS, print area = 10% padding
**New**: Canvas aspect ratio basado en `template_width:template_height`, print area = coordenadas exactas del template

```
canvas_width = container fits template aspect ratio
canvas_height = ...

scale = canvas_width / template_width

print_area_left_on_canvas = template.print_area_left * scale
print_area_top_on_canvas = template.print_area_top * scale
print_area_width_on_canvas = template.print_area_width * scale
print_area_height_on_canvas = template.print_area_height * scale
```

### Ghost Image Loading

```
1. Cargar ghost image URL vía /api/proxy-image (CORS)
2. Escalar para llenar el canvas exactamente
3. Marcar como non-selectable, evented:false
4. Posicionar como OVERLAY (encima de user objects)
5. Excluir de production export
```

### Color Change

Cuando el usuario cambia color:
1. Lookup variant_id del nuevo color (vía external_variant_id)
2. Buscar template_id para ese variant y placement actual
3. Cambiar canvas backgroundColor = template.background_color
4. Si hay ghost image diferente, recargar; si no, solo cambiar bg color

---

## API Rate Limits

- Templates endpoint no tiene rate limit documentado extra (vs mockup-generator que sí)
- Los datos son estáticos por catalog product — cachear agresivamente
- Recomendación: sync una vez y guardar en DB, no llamar en real-time
