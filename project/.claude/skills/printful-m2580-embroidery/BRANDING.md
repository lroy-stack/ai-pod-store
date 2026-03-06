# Branding & Embroidery Design — M2580 Embroidery

## 3 Placements de Bordado (VERIFICADO)

**CRITICAL:** `embroidery_chest_center` y `embroidery_chest_left` son **MUTUAMENTE EXCLUYENTES** en Printful. Solo se puede usar uno de los dos.

### Layout del producto "Origin" (3 placements: chest_center + wrist_left + wrist_right)

```
           ┌─────────────────────────┐
           │         HOOD            │
           │                         │
           ├─────────────────────────┤
           │                         │
           │    ┌─────────────┐      │
           │    │  SKAPARA    │      │
           │    │    2026     │      │
           │    │ chest_center│      │
           │    │ 3000×1800   │      │
           │    └─────────────┘      │
           │                         │
           │                         │
    ┌──────┤                         ├──────┐
    │WRIST │    KANGAROO POCKET      │WRIST │
    │LEFT  │                         │RIGHT │
    │600×  │                         │600×  │
    │900   │                         │900   │
    │S mark│                         │Geom. │
    └──────┤                         ├──────┘
           │                         │
           │                         │
           └─────────────────────────┘
```

### Layout alternativo (chest_left en vez de chest_center)

```
           ┌─────────────────────────┐
           │         HOOD            │
           ├─────────────────────────┤
           │                         │
           │  ┌──────┐               │
           │  │ Icon │               │
           │  │ left │               │
           │  │chest │               │
           │  │1200× │               │
           │  │1200  │               │
           │  └──────┘               │
           │                         │
    ┌──────┤                         ├──────┐
    │WRIST │    KANGAROO POCKET      │WRIST │
    │LEFT  │                         │RIGHT │
    └──────┤                         ├──────┘
           └─────────────────────────┘
```

---

## Canvas por Placement

### 1. `embroidery_chest_center` — 3000×1800 @300dpi

**Diseño**: Branding principal SKAPARA + año.

- Canvas: 3000×1800px (landscape)
- Equivale a ~25.4 × 15.2 cm en impresión
- Printfile ID: #222 (inferido de M2475/BP793)
- Coste: +$2.60

**Contenido tipo Origin:**
```
     S K A P A R A
        2 0 2 6
```
- "SKAPARA" en tipografía blocky/sans-serif, tracking abierto
- "2026" debajo, más pequeño, centrado
- Color hilo: Black (#000000)
- Alternativa: Navy (#333366) para aspecto más sutil

**Reglas de diseño:**
- Centrado horizontal y vertical en el canvas
- El texto ocupa ~60-70% del ancho del canvas
- Espacio entre SKAPARA y año: ~150-200px
- Mínimo grosor de línea: 1.5mm (4.5px @300dpi)
- Mínimo tamaño de texto: 5mm (15px @300dpi)

### 2. `embroidery_chest_left` — 1200×1200 @300dpi

**Diseño**: Icono/número identificativo.

- Canvas: 1200×1200px (cuadrado)
- Equivale a ~10.2 × 10.2 cm en impresión
- Printfile ID: #136 (inferido de M2475/BP793)
- Coste: +$2.60

**Contenido tipo Origin:**
```
    2 6
   ─────
```
- "26" en tipografía bold, oversized
- Línea horizontal debajo (roja)
- Colores hilo: Black (#000000) + Red (#CC3333)

**Reglas de diseño:**
- Centrado en el canvas
- Número ocupa ~50% del canvas
- La línea roja: ~40% del ancho, grosor 3-4mm
- Máximo 3 colores de hilo por placement

### 3. `embroidery_wrist_left` — 600×900 @300dpi

**Diseño**: Logo S mark SKAPARA.

- Canvas: 600×900px (portrait/vertical)
- Equivale a ~5.1 × 7.6 cm en impresión
- Printfile ID: #338
- Coste: +$2.60

**Contenido:**
- S mark isotipo SKAPARA (de `public/brand/skapara-mark-dark.svg` para garments claros)
- Centrado en el canvas
- El mark ocupa ~60% del ancho (360px)
- Color hilo: Black (#000000) o Navy (#333366)

**Reglas de diseño:**
- El S mark debe ser lo suficientemente grande para ser legible como bordado
- Mínimo 360px de ancho en el canvas
- Sin texto adicional, solo el isotipo
- Para garments blancos: usar mark-dark (oscuro sobre claro)

### 4. `embroidery_wrist_right` — 600×900 @300dpi

**Diseño**: Motivo geométrico/decorativo de color.

- Canvas: 600×900px (portrait/vertical)
- Printfile ID: #338
- Coste: +$2.60

**Contenido tipo Origin:**
- Patrón geométrico abstracto con 2-3 colores
- Ejemplo: triángulos/líneas en Royal (#005397) + Red (#CC3333) + Black (#000000)

**Reglas de diseño:**
- Diseño decorativo, NO texto
- Máximo 3 colores de hilo
- Formas geométricas simples (el bordado no reproduce bien los detalles finos)
- Mínimo grosor de línea: 1.5mm

---

## Paleta de Hilos — 15 Colores Disponibles

Todos los placements comparten la misma paleta de 15 colores de hilo:

| # | Nombre | Hex | Madeira # | Uso recomendado |
|---|---|---|---|---|
| 1 | **White** | `#FFFFFF` | 1801 | Textos sobre dark (NO usar en White garment) |
| 2 | **Black** | `#000000` | 1800 | Principal para textos y logos sobre claro |
| 3 | **Grey** | `#96A1A8` | 1718 | Detalles sutiles, sombras |
| 4 | **Old Gold** | `#A67843` | 1672 | Premium feel, metalizado |
| 5 | **Gold** | `#FFCC00` | 1951 | Highlights brillantes |
| 6 | **Orange** | `#E25C27` | 1987 | Acentos cálidos |
| 7 | **Flamingo** | `#CC3366` | 1910 | Rosa/magenta |
| 8 | **Red** | `#CC3333` | 1839 | Acentos, líneas destacadas |
| 9 | **Maroon** | `#660000` | 1784 | Rojo oscuro, premium |
| 10 | **Navy** | `#333366` | 1966 | Alternativa a Black, más sutil |
| 11 | **Royal** | `#005397` | 1842 | Azul vivo, geométricos |
| 12 | **Aqua/Teal** | `#3399FF` | 1695 | Azul claro, agua |
| 13 | **Purple** | `#6B5294` | 1832 | Acentos, detalles |
| 14 | **Kelly Green** | `#01784E` | 1751 | Verde vivo |
| 15 | **Kiwi Green** | `#7BA35A` | 1848 | Verde claro, natural |

### Reglas de Selección de Hilos

1. **Máximo 3 colores por placement** — mantiene el bordado limpio y reduce costes
2. **Black (#000000) como base** — sobre garments White/Bone, Black es el color principal
3. **NUNCA White sobre White** — texto blanco sobre hoodie blanco es invisible
4. **Red (#CC3333) para acentos** — la línea roja del Origin usa este hilo
5. **Royal (#005397) para geométricos** — el diseño geométrico del wrist derecho
6. **"Unlimited color" (+$3.25)** — solo en chest placements, para diseños con >3 colores. Evitar si posible.

### Combinaciones Probadas (Origin)

| Placement | Hilos usados |
|---|---|
| chest_center | Black (#000000) + Purple (#6B5294) + Red (#CC3333) |
| chest_left | Black (#000000) + Purple (#6B5294) + Red (#CC3333) |
| wrist_left | Black (#000000) |
| wrist_right | Black (#000000) + Purple (#6B5294) + Red (#CC3333) |

### Design Files (SVG Sources)

```
frontend/public/brand-designs/origin-embroidery/
├── chest-center.svg   # 3000×1800 — SKAPARA wordmark + purple line + "2026" blocks + dots
├── chest-left.svg     # 1200×1200 — "26" pixel blocks (2=black, 6=purple) + red underline
├── wrist-left.svg     # 600×900  — S mark isotipo (black)
└── wrist-right.svg    # 600×900  — Play triangle + purple bar + red dot
```

---

## Diferencias con DTG Branding

| Aspecto | DTG (dark garments) | Embroidery (light garments) |
|---|---|---|
| Assets source | SVG → PNG @150dpi | SVG → PNG @300dpi |
| Color del diseño | White/light (sobre dark) | Black/dark (sobre light) |
| S mark variant | `skapara-mark-white.svg` | `skapara-mark-dark.svg` |
| Wordmark variant | `skapara-wordmark-white.svg` | Texto en Black hilo (#000000) |
| Gradientes | NUNCA en DTG | IMPOSIBLE en bordado |
| Detalles finos | OK hasta 1px | Mínimo 1.5mm / 4.5px @300dpi |
| Colores | Ilimitados | 15 hilos (o +$3.25 unlimited) |

---

## Design Files del Origin (Printify)

Archivos originales del producto Origin en Printify (BP793/P410):

| Placement | URL Printify S3 |
|---|---|
| front_left_chest | `https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com/19461159/d2bb6223-aec6-442f-b547-8d106b4707c3` |
| front_center_chest | `https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com/19461159/345c7cb4-cd8d-4a18-8815-6e2aed1a757f` |
| left_wrist | `https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com/19461159/d9c88811-7380-4a5a-a080-2c09ff0da613` |
| right_wrist | `https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com/19461159/ccaac72c-0afc-4ec3-96ba-197688f9366f` |

**NOTA:** Estos diseños deben ser re-renderizados para Printful (diferentes DPI/posiciones pueden variar ligeramente). Usar como referencia visual, no copiar directamente.

---

## Restricciones de Bordado (CRÍTICAS)

1. **Sin gradientes** — el bordado es hilo sobre tela, no hay transiciones suaves
2. **Sin transparencias** — cada píxel es un puntada o no lo es
3. **Grosor mínimo de línea: 1.5mm** — líneas más finas no se bordan correctamente
4. **Tamaño mínimo de texto: 5mm** — texto más pequeño es ilegible en bordado
5. **Máximo ~15,000 puntadas por placement** — diseños muy densos aumentan coste y tiempo
6. **Colores sólidos** — cada zona usa un color de hilo, sin mezcla
7. **Formas simples** — curvas suaves, no detalles intrincados (el hilo no reproduce bien)
