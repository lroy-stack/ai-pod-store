# SVG to PNG Rendering Pipeline -- Investigacion Completa

*Generado: 2026-03-09*

---

## 1. Estado Actual del Proyecto

### 1.1 Herramientas de renderizado EXISTENTES

El proyecto tiene **3 pipelines de imagen activos**, pero **ninguno hace SVG-a-PNG puro para print-ready**:

#### A) `composition-renderer.ts` (Server-side, Next.js)
- **Archivo**: `/frontend/src/lib/composition-renderer.ts`
- **Dependencias**: `sharp` (v0.34.5) + `canvas` (v3.2.1, node-canvas)
- **Funcion**: Renderiza composiciones multi-capa (texto + imagenes) a PNG
- **Resolucion**: Preview 1024x1024 y produccion (PRODUCTION_DIMENSIONS por producto)
- **Texto**: Usa `node-canvas` (basado en Cairo) con `registerFont()` para fuentes custom
- **SVG**: NO renderiza SVGs directamente -- solo compone PNGs y texto
- **Fuentes registradas** (12): Inter, Roboto, Montserrat, Playfair Display, Oswald, Lato, Pacifico, Dancing Script, Great Vibes, Caveat, Permanent Marker, Bebas Neue

#### B) `mockup-generator.ts` + `branded-mockup-generator.ts` (Server-side)
- **Archivos**: `/frontend/src/lib/mockup-generator.ts`, `/frontend/src/lib/branded-mockup-generator.ts`
- **Dependencias**: `sharp` (libvips)
- **Funcion**: Compone disenos sobre templates de producto (mockups) + branded backgrounds
- **SVG parcial**: Sharp renderiza SVGs simples internamente (watermark SVG inline, background SVGs de `mockup-backgrounds.ts`)
- **Limitacion**: Solo SVGs triviales (texto simple, gradientes basicos). No soporta fuentes custom via SVG -- usa las del sistema operativo via fontconfig/librsvg

#### C) Design Studio Export (Client-side, Fabric.js)
- **Archivo**: `/frontend/src/components/design-studio/CanvasWorkspace.tsx`
- **Dependencias**: Fabric.js v6 (canvas HTML5 del navegador)
- **Funcion**: Exporta disenos del editor a PNG via `canvas.toDataURL()` con multiplier
- **Resolucion produccion**: Calcula multiplier = `PRODUCTION_DIMENSIONS[type].w / printArea.width`
- **SVG**: NO -- exporta directamente desde el canvas HTML5 del navegador
- **Limitacion**: Depende del navegador del usuario. No hay pipeline server-side para Fabric.js JSON -> PNG print-ready

#### D) rembg Sidecar (Background Removal)
- **Archivos**: `/deploy/rembg/server.py`, `/deploy/rembg/Dockerfile`
- **Dependencias**: Python 3.12, rembg (u2net), PIL/Pillow, FastAPI
- **Funcion**: Elimina fondos de imagenes (PNG in -> PNG out). NO renderiza SVGs
- **Endpoint**: `POST /remove` (acepta image_url, devuelve PNG bytes)

#### E) PodClaw Designer Agent
- **Archivo**: `/podclaw/agents/designer.py`
- **Pipeline**: Fuente imagenes (crawl4ai) o genera (fal.ai FLUX) -> rembg -> upscale (ESRGAN) -> Printify upload
- **SVG**: **CERO soporte**. PodClaw trabaja exclusivamente con PNGs raster
- **Dependencias Python**: httpx, PIL/Pillow, structlog. **Sin cairosvg, sin resvg, sin svglib**

### 1.2 GAP CRITICO Identificado

**No existe ningun pipeline SVG -> PNG @300dpi print-ready en todo el proyecto.**

Los skills de diseno (`design-dtg`, `design-embroidery`, `design-sublimation`) documentan que Claude genera SVGs... pero no hay tooling para convertir esos SVGs a PNG print-ready. El flujo actual depende de que:

1. Claude Code genera un SVG como texto
2. Se guarda como archivo `.svg` en disco
3. **FALTA**: Conversion a PNG @300dpi con dimensiones exactas del canvas
4. Se sube a Printify/Printful como PNG

El paso 3 se ha hecho **manualmente** o no se ha hecho en absoluto -- los SVGs se suben directamente o se convierten ad-hoc.

---

## 2. Canvas Specs Disponibles por Blueprint

### 2.1 DTG (Direct-to-Garment) -- P26 Textildruck Europa

Documentado en `/project/.claude/skills/design-dtg/CANVAS_SPECS.md`:

| Blueprint | Producto | Canvas (px) | DPI | Posiciones |
|---|---|---|---|---|
| BP6 | Gildan 5000 Heavy Cotton Tee | 4606 x 5787 | 300 | front, back, sleeves, neck |
| BP12 | Bella+Canvas 3001 | 2953 x 3710 | 300 | front, back, sleeves, neck |
| BP145 | Gildan Softstyle 64000 | 3402 x 4264 | 300 | front, back, sleeves |
| BP454 | B&C TU01T (EU) | 3543 x 4452 | 300 | front, back |
| BP77 | Gildan 18500 Hoodie | 3531 x 2908 | 300 | front only |
| BP49 | Gildan 18000 Crewneck | 3319 x 3761 | 300 | front, back |
| BP80 | Gildan 2400 Long Sleeve | 4110 x 4658 | 300 | front, back |
| BP455 | Gildan 18600 Zip Hoodie | 2776 x 2285 | 300 | front only |
| BP457 | B&C WUI23 Crew (EU) | 3366 x 4230 | 300 | front, back |

### 2.2 Embroidery -- P410 Printful Latvia

Documentado en `/project/.claude/skills/design-embroidery/SKILL.md`:

| Blueprint | Producto | Canvas (px) | Posiciones |
|---|---|---|---|
| BP793 | Embroidered Hoodie | 1200 x 1200 | chest, left_chest, wrist x2 |
| BP1744 | Structured Cap (Yupoong 6089M) | 1770 x 600 | front, side, back |
| BP1755 | Flat Bill Cap | 1890 x 765 | front, side, back |
| BP1743 | Snapback Trucker | 1770 x 600 | front, side |
| BP1729 | Dad Hat | 1650 x 600 | front only |
| BP1691 | Cuffed Beanie | 1500 x 525 | front_fold only |
| BP1910 | Bucket Hat | 1650 x 600 | front only |

### 2.3 Sublimation/UV

Documentado en `/project/.claude/skills/design-sublimation/SKILL.md`:

| Blueprint | Producto | Canvas (px) | Provider | Tipo |
|---|---|---|---|---|
| BP1018 | Two-Tone Mug 11oz | 2244 x 945 | P26 | Wrap-around |
| BP854 | SS Water Bottle | 2759 x 1500 | P23 | Full wrap |
| BP1927 | Tumbler 20oz | 2776 x 2374 | P410 | Full wrap |
| BP966 | Vagabond 20oz | 3058 x 1715 | P86 | Full wrap |
| BP969 | Desk Mat LED | 7205 x 3661 | P90 | Flat |
| BP442 | Mouse Pad | 2894 x 2421 | P30 | Flat |
| BP476 | Vinyl Sticker | 4500 x 4500 | P30 | Die-cut |
| BP767 | Low Top Sneaker | 1433 x 649/area | P90 | 6 areas |

### 2.4 Design Studio Production Dimensions (Fallback generico)

Documentado en `/frontend/src/lib/print-areas.ts`:

| Tipo Producto | Produccion (px) | Uso |
|---|---|---|
| tshirt | 3600 x 4800 | Design Studio export |
| hoodie | 3000 x 3600 | Design Studio export |
| mug | 2850 x 1050 | Design Studio export |
| phone-case | 750 x 1500 | Design Studio export |
| tote-bag | 3600 x 3600 | Design Studio export |
| hat | 1650 x 750 | Design Studio export |

**NOTA**: Estas dimensiones son DIFERENTES de las canvas specs de los skills. Los skills usan las dimensiones exactas de Printify/Printful. El Design Studio usa dimensiones genericas por tipo de producto.

---

## 3. Analisis de Librerias SVG -> PNG

### 3.1 Opciones Evaluadas

| Libreria | Lenguaje | Motor | Texto/Fuentes | Gradientes | Filtros SVG | DPI Control | Velocidad |
|---|---|---|---|---|---|---|---|
| **@resvg/resvg-js** | Node (Rust/NAPI) | resvg (Rust) | Custom fonts via API | linearGradient, radialGradient | Parcial (basicos) | Si (nativo) | 12 ops/s |
| **sharp** (libvips+librsvg) | Node (C/C++) | librsvg + Cairo | Solo system fonts (fontconfig) | Si | Si (via librsvg) | Indirecto (resize) | 9 ops/s |
| **node-canvas** (ya instalado) | Node (C) | Cairo | registerFont() | Si | No (requiere extension) | Indirecto | Media |
| **cairosvg** | Python | Cairo | System fonts (limitado) | Si | Si (via Cairo) | Si (dpi param) | Media |
| **Puppeteer/Playwright** | Node | Chrome/Chromium | Todas las del navegador | 100% SVG spec | 100% SVG spec | Via viewport + scale | Lento (~1-3s) |
| **Inkscape CLI** | Sistema | Inkscape | 100% SVG spec | 100% SVG spec | 100% SVG spec | `--export-dpi=300` | Lento (~2-5s) |

### 3.2 Analisis Detallado

#### `@resvg/resvg-js` -- RECOMENDADO para PodClaw v2

**Pros:**
- Mas rapido que sharp para SVG puro (12 ops/s vs 9 ops/s en benchmarks basicos)
- Zero dependencias nativas (binding NAPI precompilado, o WASM para entornos restringidos)
- API simple: `new Resvg(svgString, opts).render().asPng()`
- Soporte nativo de DPI: `{ dpi: 300 }`
- Fuentes custom via `loadFontFromPath()` -- no depende de fontconfig
- SVG 1.1 estatico casi completo: texto, gradientes, masks, clip-paths
- Ideal para Docker (sin dependencias del sistema)
- Seguro para uso en PodClaw (Rust, sin ejecucion de JS/scripts dentro del SVG)

**Contras:**
- No soporta SVG animado (irrelevante para print)
- Filtros SVG complejos (`feConvolveMatrix`, `feTurbulence`) pueden tener diferencias vs browser
- No soporta `<foreignObject>` (HTML embebido en SVG)

**Instalacion:**
```bash
npm install @resvg/resvg-js
# O para Python:
pip install resvg
```

**Uso Node.js:**
```typescript
import { Resvg } from '@resvg/resvg-js'
import fs from 'fs'

const svg = fs.readFileSync('design.svg', 'utf-8')
const resvg = new Resvg(svg, {
  dpi: 300,
  fitTo: { mode: 'width', value: 4606 }, // BP6 canvas width
  font: {
    fontFiles: ['./fonts/Inter-Regular.ttf'],
    loadSystemFonts: false,
  },
  background: 'rgba(0,0,0,0)', // transparent
})
const png = resvg.render().asPng()
fs.writeFileSync('design.png', png)
```

#### `sharp` (ya instalado en el proyecto)

**Pros:**
- YA esta en el proyecto (v0.34.5)
- Excelente para compositing (overlay, resize, format conversion)
- Rapido para operaciones raster
- Soporta SVG basico via librsvg (que usa Cairo internamente)

**Contras para SVG -> PNG:**
- Fuentes: solo las del sistema (fontconfig). En Docker necesita instalar fuentes + configurar fontconfig
- No acepta SVG strings directamente con fuentes custom
- No controla DPI directamente para SVG -- solo resize
- SVG rendering es "best effort" via librsvg, no es su funcion principal
- Ya se usa en el proyecto para watermark SVGs simples (sin fuentes custom)

**Uso actual en el proyecto:**
```typescript
// mockup-generator.ts -- watermark SVG simple (Arial, sin fuentes custom)
const watermarkSvg = Buffer.from(`<svg>...<text font-family="Arial">SKAPARA</text></svg>`)
composite = composite.composite([{ input: watermarkSvg, blend: 'over' }])

// branded-mockup-generator.ts -- background SVGs (gradientes, sin texto)
const bgBuffer = await sharp(Buffer.from(background.svg)).resize(width, height).png().toBuffer()
```

#### `cairosvg` (Python, para PodClaw)

**Pros:**
- Maduro y estable (v2.8.1, mayo 2025)
- Simple: `cairosvg.svg2png(url='file.svg', write_to='out.png', dpi=300)`
- Buen soporte de gradientes y paths complejos
- Corre nativamente en Python (ideal para PodClaw)

**Contras:**
- **Fuentes: "poorly supported"** segun la documentacion oficial
- Solo fuentes Latin/Cyrillic basicas funcionan bien
- Font family, size, weight, style soportados para "common simple values"
- Requiere Cairo como dependencia del sistema (`apt-get install libcairo2-dev`)
- DPI metadata: solo afecta dimensiones, NO escribe metadata DPI en el PNG (workaround: PIL `save(dpi=(300,300))`)

#### `Puppeteer/Playwright` (Headless Chrome)

**Pros:**
- 100% fidelidad SVG -- renderiza exactamente como un navegador
- Soporta TODAS las fuentes (via @font-face o system fonts)
- Soporta TODOS los filtros SVG, gradientes, mascaras, etc.
- Playwright YA esta en el proyecto como deferred tool (testing)

**Contras:**
- Lento (~1-3 segundos por render)
- Heavy: requiere Chromium instalado (~400MB)
- Overhead de memoria significativo
- No ideal para batch processing (30+ disenos por ciclo)
- Riesgo de seguridad: ejecuta JS dentro del SVG (XSS si SVG no es trusted)

#### `Inkscape CLI`

**Pros:**
- Gold standard de fidelidad SVG
- `inkscape input.svg --export-type=png --export-dpi=300 --export-filename=output.png`
- Soporta TODO

**Contras:**
- Requiere instalar Inkscape en el container (~200MB)
- Lento (2-5 segundos startup + render)
- No tiene API programatica (solo CLI)
- Overkill para SVGs simples

---

## 4. Recomendacion Tecnica para PodClaw v2

### 4.1 Arquitectura Propuesta: Dual-Engine

```
PodClaw v2 SVG -> PNG Pipeline
================================

[Claude genera SVG]
       |
       v
[Validacion SVG] -- dimensiones, viewBox, colores
       |
       v
[Renderer seleccion por complejidad]
       |
       +-- SVGs simples (texto, paths, gradientes basicos)
       |        |
       |        v
       |   [@resvg/resvg-js] -- rapido, preciso, sin deps
       |        |
       |        v
       |   [PNG @300dpi con dimensiones exactas del blueprint]
       |
       +-- SVGs complejos (filtros, foreignObject, fuentes exoticas)
                |
                v
           [Playwright headless] -- fallback 100% fidelidad
                |
                v
           [PNG @300dpi con dimensiones exactas del blueprint]
       |
       v
[Post-processing con sharp]
   - Verificar transparencia (alpha channel)
   - Resize a canvas exacto si necesario
   - Verificar dimensiones finales
   - Embeber metadata DPI
       |
       v
[Upload a Printify/Printful]
```

### 4.2 Implementacion Recomendada

**Engine principal: `@resvg/resvg-js`** (Node.js) o **`resvg` Python package** (PodClaw)

- Cubre el 95% de los SVGs que Claude genera (texto + paths + gradientes)
- Performance adecuada para batches de 30 disenos
- Sin dependencias del sistema (precompilado)
- Fuentes custom controladas (no depende de fontconfig)

**Fallback: Playwright headless** (ya disponible en el proyecto)

- Solo para SVGs con filtros complejos o features exoticos
- Se activa via flag o deteccion automatica de features no soportadas

**Post-processing: `sharp`** (ya instalado)

- Verificar/ajustar dimensiones
- Componer multiples posiciones (front + back + neck)
- Comprimir/optimizar el PNG final

### 4.3 Para PodClaw (Python)

Opcion A -- **`resvg` package nativo** (preferido):
```bash
pip install resvg
```
```python
import resvg

svg_data = open('design.svg', 'rb').read()
png_data = resvg.svg_to_png(
    svg_data,
    dpi=300,
    width=4606,  # BP6 canvas width
    font_files=['fonts/Inter-Regular.ttf'],
)
with open('design.png', 'wb') as f:
    f.write(png_data)
```

Opcion B -- **`cairosvg` + PIL** (si resvg Python da problemas):
```bash
pip install cairosvg pillow
# + apt-get install libcairo2-dev (en Dockerfile)
```
```python
import cairosvg
from PIL import Image
import io

# Render a 300 DPI
png_bytes = cairosvg.svg2png(
    url='design.svg',
    output_width=4606,
    output_height=5787,
    dpi=300,
)

# Embeber metadata DPI
img = Image.open(io.BytesIO(png_bytes))
img.save('design.png', dpi=(300, 300))
```

### 4.4 Para Frontend (Node.js, ya existente)

Complementar `composition-renderer.ts` con resvg-js:
```bash
npm install @resvg/resvg-js
```
```typescript
// Nuevo: svg-renderer.ts
import { Resvg } from '@resvg/resvg-js'
import path from 'path'
import { FONT_FILES } from '@/lib/font-config'

const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')

export function renderSvgToPng(
  svgString: string,
  targetWidth: number,
  targetHeight: number,
  dpi: number = 300
): Buffer {
  const fontFiles = Object.values(FONT_FILES).map(
    f => path.join(FONT_DIR, f)
  )

  const resvg = new Resvg(svgString, {
    dpi,
    fitTo: { mode: 'width', value: targetWidth },
    font: {
      fontFiles,
      loadSystemFonts: false,
    },
    background: 'rgba(0,0,0,0)',
  })

  return Buffer.from(resvg.render().asPng())
}
```

---

## 5. Consideraciones de Calidad de Impresion

### 5.1 Resolucion (DPI)

- **Minimo para print**: 300 DPI (estandar de la industria POD)
- **Optimo**: 300 DPI -- ir mas alto NO mejora la calidad en DTG/sublimacion
- **Las canvas specs de los blueprints ya estan calculadas para 300 DPI**
  - BP6: 4606x5787px a 300dpi = ~39x49cm de area imprimible
  - Embroidery es diferente: las dimensiones del canvas representan la resolucion de la digitalizacion, no DPI de impresion

### 5.2 Espacio de Color: sRGB vs CMYK

- **Print-on-demand (DTG, sublimacion) trabaja en sRGB**, NO CMYK
- Los proveedores (Printful, Textildruck Europa) aceptan PNG en sRGB y hacen la conversion internamente
- **NO necesitamos convertir a CMYK** -- seria contraproducente
- Si el SVG usa colores fuera del gamut sRGB, se clampean automaticamente al renderizar
- **Recomendacion**: Asegurar que los SVGs usan colores en rango sRGB (#hex o rgb())
- **ICC profile**: No es necesario embeber un perfil ICC para POD. Si se quiere, usar sRGB IEC61966-2.1

### 5.3 Formato de Archivo

- **PNG-24 con alpha channel** (transparencia) -- OBLIGATORIO para todos los disenos
- PNG sin compresion (o compresion minima) para maxima calidad
- **NO usar JPEG** -- pierde transparencia y tiene artefactos de compresion
- **NO usar WebP** para upload a Printify/Printful -- solo aceptan PNG
- Los SVGs se renderizan a PNG -- el SVG es el formato de edicion, el PNG es el de produccion

### 5.4 Transparencia

- **TODAS las impresiones DTG/sublimacion requieren fondo transparente**
- El color del garment/producto se ve a traves de la transparencia
- Verificar que no hay pixeles blancos residuales despues del render
- `sharp` puede verificar transparencia: leer raw pixels y comprobar alpha channel
- Embroidery: fondo transparente tambien, pero las maquinas ignoran la transparencia (solo ven los paths rellenos)

### 5.5 Zona Segura y Bleed

- **Safe zone**: 5% margin desde los bordes del canvas (DTG)
- **Bleed**: 2-3% extension fuera del canvas para wrap-around (sublimacion/mugs)
- El SVG debe tener `viewBox` exacto del canvas spec
- Si el SVG es mas pequeno que el canvas, se centra con transparencia alrededor

### 5.6 Validacion Pre-Upload

Checklist automatizado que deberia ejecutarse despues del render:

```
[x] Dimensiones exactas del canvas del blueprint
[x] 300 DPI (metadata)
[x] PNG-24 con alpha channel
[x] Fondo transparente (no blanco)
[x] Tamano de archivo < 10MB (limite Printify upload)
[x] Sin pixeles fuera del safe zone (warning)
[x] Colores en rango sRGB
```

---

## 6. Resumen de Cambios Necesarios

### 6.1 Prioridad Alta (Habilitar el pipeline)

| Accion | Donde | Dependencia | Esfuerzo |
|---|---|---|---|
| Instalar `@resvg/resvg-js` en frontend | `frontend/package.json` | npm install | 5 min |
| Crear `svg-renderer.ts` | `frontend/src/lib/` | resvg-js | 1 hora |
| Instalar `resvg` en PodClaw | `podclaw/requirements.txt` | pip install | 5 min |
| Crear `svg_renderer.py` en PodClaw | `podclaw/` | resvg | 2 horas |
| Blueprint canvas lookup table | `podclaw/` o `frontend/src/lib/` | Canvas specs de skills | 1 hora |

### 6.2 Prioridad Media (Robustez)

| Accion | Donde | Esfuerzo |
|---|---|---|
| Validacion pre-upload automatica | `podclaw/hooks/` | 2 horas |
| Fallback Playwright para SVGs complejos | `frontend/src/lib/` | 3 horas |
| Embeber metadata DPI en PNG | Post-processing | 30 min |
| Tests unitarios del renderer | `podclaw/tests/` + `frontend/src/__tests__/` | 2 horas |

### 6.3 Prioridad Baja (Optimizacion)

| Accion | Esfuerzo |
|---|---|
| Cache de fuentes en PodClaw (evitar re-cargar en cada render) | 1 hora |
| Batch rendering paralelo (worker threads) | 3 horas |
| Monitoring de calidad de render (diff visual vs referencia) | 4 horas |

---

## 7. Archivos Clave Referenciados

| Archivo | Funcion |
|---|---|
| `/frontend/src/lib/composition-renderer.ts` | Renderer actual (sharp + node-canvas, NO SVG) |
| `/frontend/src/lib/mockup-generator.ts` | Mockup compositor (sharp) |
| `/frontend/src/lib/branded-mockup-generator.ts` | Branded mockups (sharp + rembg) |
| `/frontend/src/lib/print-areas.ts` | Dimensiones de produccion + preview zones |
| `/frontend/src/lib/font-config.ts` | 12 fuentes registradas |
| `/frontend/src/lib/canvas-helpers.ts` | Fabric.js helpers (client-side) |
| `/frontend/src/components/design-studio/CanvasWorkspace.tsx` | Export client-side (toDataURL) |
| `/deploy/rembg/server.py` | Background removal sidecar |
| `/podclaw/agents/designer.py` | Designer agent (fal.ai, NO SVG) |
| `/podclaw/connectors/fal_connector.py` | fal.ai + upscale ESRGAN |
| `/.claude/skills/design-dtg/CANVAS_SPECS.md` | Canvas specs DTG |
| `/.claude/skills/design-dtg/SKILL.md` | Pipeline DTG completo |
| `/.claude/skills/design-embroidery/SKILL.md` | Pipeline embroidery + canvas specs |
| `/.claude/skills/design-sublimation/SKILL.md` | Pipeline sublimation + canvas specs |

---

## Fuentes de Investigacion Online

- [resvg-js (GitHub)](https://github.com/thx/resvg-js) -- High-performance SVG renderer, Rust-based
- [resvg SVG Support Table](https://linebender.org/resvg-test-suite/svg-support-table.html) -- Feature support matrix
- [sharp vs resvg-js benchmark](https://github.com/privatenumber/sharp-vs-resvgjs) -- Performance comparison
- [CairoSVG Documentation](https://cairosvg.org/documentation/) -- Python SVG converter
- [CairoSVG PyPI](https://pypi.org/project/CairoSVG/) -- v2.8.1 (May 2025)
- [sharp Font Issues with SVG](https://github.com/lovell/sharp/issues/2458) -- Custom font limitations
- [sharp SVG Font Rendering](https://github.com/lovell/sharp/issues/1220) -- librsvg/fontconfig dependency
- [node-svg2img (switched to resvg-js)](https://github.com/fuzhenn/node-svg2img) -- Proof of industry shift to resvg
- [SVG to PNG with Sharp](https://codeforgeek.com/convert-svg-to-png/) -- Basic guide
- [resvg (Rust core)](https://github.com/linebender/resvg) -- Underlying rendering engine
- [node-colorvert (ICC profiles)](https://github.com/jpederson/node-colorvert) -- Color space conversion
- [pyCMS (Python ICC)](https://www.cazabon.com/pyCMS/) -- Python color management
