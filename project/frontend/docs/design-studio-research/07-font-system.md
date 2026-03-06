# Sistema de Fuentes para Editor de Diseno POD

---

## 1. Fuentes que Soporta Printful

### Printful Design Maker
790+ fuentes profesionales gratuitas dentro de la herramienta.

### Custom fonts
**Printful NO acepta subida de archivos de fuente custom.** El texto debe entregarse como **PNG rasterizado** (transparent background, 300 DPI minimo). **Printify SI permite subir fuentes custom** (TTF/OTF).

### Conclusion critica
Como entregamos PNGs rasterizados a Printful, podemos usar **cualquier fuente cargada en el navegador**. El texto se convierte a pixeles antes de enviarse. La licencia aplica al uso en el editor web y en el producto impreso.

---

## 2. Fuentes Disponibles en el Codebase

### TTF descargadas (`/frontend/public/fonts/`)

| Archivo | Fuente | Categoria | Licencia |
|---|---|---|---|
| BebasNeue-Regular.ttf | Bebas Neue | Display | OFL |
| Caveat-Regular.ttf | Caveat | Script | OFL |
| DancingScript-Regular.ttf | Dancing Script | Script | OFL |
| GreatVibes-Regular.ttf | Great Vibes | Script Elegante | OFL |
| Inter-Regular.ttf | Inter | Sans-serif | OFL |
| Lato-Regular.ttf | Lato | Sans-serif | OFL |
| Montserrat-Regular.ttf | Montserrat | Sans-serif | OFL |
| Oswald-Regular.ttf | Oswald | Display | OFL |
| Pacifico-Regular.ttf | Pacifico | Script | OFL |
| PermanentMarker-Regular.ttf | Permanent Marker | Display | OFL |
| PlayfairDisplay-Regular.ttf | Playfair Display | Serif | OFL |
| Roboto-Regular.ttf | Roboto | Sans-serif | Apache 2.0 |

**Todas 100% comercialmente libres.**

### FONT_OPTIONS en ProductPersonalizer.tsx (lineas 35-51)

12 fuentes en 3 categorias: sans (4), serif/display (4), script (4).

**Problemas detectados**: Sin monospace ni condensed. Sin filtrado por tecnica (DTG/Bordado/Sublimacion). Sin pesos multiples.

### Google Fonts en layout

Solo Inter y JetBrains Mono pre-cargados. Las otras 10 fuentes causan **FOUT** al cambiar en el editor.

---

## 3. Licencias para Uso Comercial POD

### OFL (SIL Open Font License)
- SI permite: productos impresos, editores web, modificar fuente, logos, packaging.
- NO permite: vender archivos de fuente por si solos.

### Apache 2.0 (Roboto)
Equivalente a OFL para uso comercial.

### Fuentes PROHIBIDAS en POD

| Fuente | Propietario | Problema |
|---|---|---|
| Helvetica | Monotype | Propietaria |
| Futura | Monotype | Comercial |
| Arial | Monotype/Microsoft | EULA no permite POD |
| Proxima Nova | Mark Simonson | Comercial (Adobe Fonts) |
| Gotham | Hoefler&Co | Exclusiva |

**Las fuentes del sistema (Arial, Times) NO pueden usarse en un editor POD web.**

---

## 4. Categorias de Fuentes para el Editor

### Sans-serif

| Fuente | DTG | Bordado | Sublimacion | Nota |
|---|---|---|---|---|
| Inter | Excelente | Si (Bold) | Excelente | UI de referencia |
| Roboto | Excelente | Si (Bold) | Excelente | Google standard |
| Montserrat | Excelente | Si | Excelente | Geometrico versatil |
| Poppins | Excelente | Si (Bold) | Excelente | Muy en tendencia |

### Serif

| Fuente | DTG | Bordado | Sublimacion |
|---|---|---|---|
| Playfair Display | Excelente | NO (serifs finos) | Excelente |
| Merriweather | Bueno | Solo Bold | Bueno |

### Script/Handwriting

| Fuente | DTG | Bordado | Sublimacion |
|---|---|---|---|
| Pacifico | Excelente | Limitado | Excelente |
| Permanent Marker | Excelente | Limitado | Excelente |
| Dancing Script | Bueno | NO (finos) | Bueno |
| Great Vibes | Bueno | NO (muy fino) | Bueno |

### Display/Decorativa

| Fuente | DTG | Bordado | Sublimacion |
|---|---|---|---|
| Bebas Neue | Excelente | Excelente | Excelente |
| Oswald | Excelente | Excelente | Excelente |
| Anton | Excelente | Excelente | Excelente |
| Bangers | Excelente | Bueno | Excelente |

### Monospace (audiencia tech SKAPARA)

| Fuente | DTG | Bordado | Sublimacion |
|---|---|---|---|
| JetBrains Mono | Excelente | Bueno (Bold) | Excelente |
| Source Code Pro | Bueno | Bueno | Bueno |
| Space Mono | Excelente | Bueno | Excelente |

### Condensada (gorras)

| Fuente | Bordado (Gorras) |
|---|---|
| Bebas Neue | Excelente |
| Oswald | Excelente |
| Anton | Excelente |

---

## 5. Rendering en Canvas

### Patron correcto — Font Loading API

```typescript
const font = new FontFace('Bebas Neue', 'url(/fonts/BebasNeue-Regular.ttf)')
document.fonts.add(font)
await document.fonts.load('1em "Bebas Neue"')
setFont('Bebas Neue')
```

### Export a 300 DPI

```typescript
const exportCanvas = document.createElement('canvas')
const scaleFactor = 1772 / 400  // ~4.43x
exportCanvas.width = 1772
exportCanvas.height = 1772
const ctx = exportCanvas.getContext('2d')!
ctx.scale(scaleFactor, scaleFactor)
await document.fonts.load(`900 ${fontSize}px "${fontFamily}"`)
ctx.font = `900 ${fontSize}px "${fontFamily}"`
ctx.fillText(text, x, y)
```

---

## 6. Fuentes para Bordado — Restricciones

### Requisitos minimos (P410)

| Parametro | Minimo | Recomendado |
|---|---|---|
| Alto texto | 6.35mm (0.25") | 10mm+ |
| Alto scripts | 8.89mm (0.35") | 15mm+ |
| Grosor trazo | 1.3mm (0.05") | 2mm+ |

### Funcionan en bordado
Bebas Neue, Oswald Bold/Black, Montserrat Black, Anton, Barlow Condensed Bold

### NO funcionan en bordado
Great Vibes, Dancing Script, Sacramento, Playfair Display Regular, Inter Regular/Light, Fira Code (ligaduras)

### Logica de filtrado

```typescript
type PrintTechnique = 'dtg' | 'embroidery' | 'sublimation'
const FONT_RESTRICTIONS: Record<string, PrintTechnique[]> = {
  'Great Vibes': ['dtg', 'sublimation'],
  'Dancing Script': ['dtg', 'sublimation'],
  'Bebas Neue': ['dtg', 'embroidery', 'sublimation'],
  // ...
}
```

---

## 7. Top 20 Fuentes POD (2025-2026)

1. Bebas Neue, 2. Montserrat, 3. Oswald, 4. Pacifico, 5. Anton, 6. Graduate, 7. Dancing Script, 8. Bangers, 9. Permanent Marker, 10. Playfair Display, 11. Roboto, 12. Lato, 13. Josefin Sans, 14. Special Elite, 15. Amatic SC, 16. Unica One, 17. Open Sans, 18. Poppins, 19. JetBrains Mono, 20. Caveat

---

## 8. Brechas y Mejoras

| Tema | Estado | Accion |
|---|---|---|
| Licencias actuales | Todas seguras | Ninguna |
| FOUT en editor | 10 de 12 fuentes | Pre-cargar via FontFace API |
| Filtrado bordado vs DTG | No existe | Implementar `techniques[]` |
| Monospace | Solo en UI | Agregar JetBrains Mono a FONT_OPTIONS |
| Agrupacion visual | Sin categorias | Usar `<SelectGroup>` de shadcn/ui |
| Pesos multiples | Solo Regular | Agregar Bold/Black para bordado |

### Estructura mejorada propuesta

```typescript
const FONT_OPTIONS = [
  { value: 'Bebas Neue', label: 'Bebas Neue', category: 'display-condensed',
    techniques: ['dtg', 'embroidery', 'sublimation'],
    weights: ['400'],
    popular: true, embroideryMinHeight: 8 },
  { value: 'Great Vibes', label: 'Great Vibes', category: 'script',
    techniques: ['dtg', 'sublimation'],
    weights: ['400'] },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', category: 'monospace',
    techniques: ['dtg', 'embroidery', 'sublimation'],
    weights: ['400', '700'],
    popular: true },
]
```

---

## Sources

- [Top 10 Free Fonts for POD - Printful](https://www.printful.com/academy/lessons/top-10-fonts-for-print-on-demand-designs)
- [Best Fonts for Embroidery - Printful](https://www.printful.com/uk/blog/best-fonts-for-embroidery)
- [Google Fonts FAQ — Commercial Use](https://developers.google.com/fonts/faq)
- [SIL Open Font License](https://openfontlicense.org/)
- [Konva — Custom Font Loading](https://konvajs.org/docs/sandbox/Custom_Font.html)
- [Fabric.js — Loading Custom Fonts](https://fabricjs.com/demos/loading-custom-fonts/)
- [Best Fonts For Embroidery - Gelato](https://www.gelato.com/blog/fonts-for-embroidery)
