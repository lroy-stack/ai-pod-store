# SVG → Print-Ready PNG Pipeline — Estado y Recomendaciones

*Generado por agente de exploración 2026-03-09*

## Resumen

El proyecto tiene **herramientas dispersas** para generación y conversión de imágenes, pero **NO tiene un pipeline end-to-end automatizado** de SVG → PNG print-ready @300dpi. Las piezas existen; la orquestación no.

## Generadores de Imagen Disponibles

### Frontend (TypeScript/Next.js)

| Provider | Archivo | Output | Capacidad | Coste |
|----------|---------|--------|-----------|-------|
| **Recraft V3** | `frontend/src/lib/providers/recraft-provider.ts` | SVG nativo | Vector illustrations, logos | $0.04-0.08/img |
| **FLUX.1 (FAL)** | `frontend/src/lib/providers/fal-provider.ts` | PNG | Artístico, detallado, 1024×1024 | $0.003-0.04/img |
| **OpenAI DALL-E** | `frontend/src/lib/providers/openai-provider.ts` | PNG | General, fotorealismo | $0.08-0.12/img |
| **Ideogram** | `frontend/src/lib/providers/ideogram-provider.ts` | PNG | Texto pesado | $0.08/img |

**Router de intención**: `frontend/src/lib/providers/router.ts` clasifica prompts y selecciona provider + fallback chain.

### Backend (PodClaw/Python)

| Provider | Archivo | Output | Capacidad |
|----------|---------|--------|-----------|
| **FAL.ai** | `podclaw/connectors/fal_connector.py` | PNG | FLUX models + ESRGAN upscale |
| **Gemini** | `podclaw/connectors/gemini_connector.py` | PNG | Image gen + quality check vision |

## Conversión SVG → PNG (Sharp)

### Lo que existe

Sharp (npm) puede convertir SVG a PNG. Patrón encontrado en scripts:

```typescript
// frontend/scripts/generate-meme-designs.mjs
const badge = await sharp(Buffer.from(svgBuffer))
  .resize(size, size)
  .png()
  .toBuffer()
```

```typescript
// frontend/scripts/generate-brand-designs.mjs
// Construye SVG programáticamente desde path data (S_MARK, WORDMARK)
// Renderiza con Sharp a PNG
```

### Lo que NO existe

- **No hay flow automatizado**: Recraft SVG → download → convert PNG → store
- **No hay targeting de dimensiones exactas**: No code path para canvas exactos (4606×5787 para BP6)
- **No hay DPI metadata**: Sharp outputea 72 DPI por defecto, print requiere 300 DPI
- **No hay orquestación**: Las piezas están desconectadas

## Composition Renderer (Existente)

**Archivo**: `frontend/src/lib/composition-renderer.ts`

### Preview (1024×1024)
```typescript
export async function renderCompositionPreview(
  layers: CompositionLayer[],
  productType: string
): Promise<Buffer>
// Crea canvas transparente, composite layers, retorna PNG buffer
```

### Production Export (Full Resolution)
```typescript
export async function exportForProduction(compositionId: string): Promise<string>
// Renderiza a dimensiones de producción, sube a Supabase Storage
// PRODUCTION_DIMENSIONS[productType] → { w, h }
```

### Layers soportados
- `text`: Renderizado con node-canvas (fuentes custom, color, alineación)
- `image` / `ai`: Composición via Sharp.composite() con blend modes
- Upload a Supabase Storage bucket `designs`

## Dimensiones de Producto (PodClaw)

**Archivo**: `podclaw/image_pipeline/dimensions.py`

```python
PRODUCT_DIMENSIONS = {
    "t-shirt":    (1024, 1365, 4500, 5400, "3:4"),
    "hoodie":     (1024, 1365, 4500, 5400, "3:4"),
    "tank-top":   (1024, 1365, 4500, 5400, "3:4"),
    "mug":        (1365, 568,  2700, 1125, "12:5"),
    "poster":     (1024, 1365, 5400, 7200, "3:4"),
}
# (gen_width, gen_height, print_width, print_height, aspect_ratio)
```

**Upscale factor**: `target_w / gen_w` → 4x si >2.5, 2x si menor

## Canvas Specs por Blueprint (Skills)

**Archivo**: `.claude/skills/design-dtg/CANVAS_SPECS.md`

| Blueprint | Posición | Dimensiones | DPI |
|-----------|----------|-------------|-----|
| BP6 T-Shirt | front | 4606×5787 | 300 |
| BP6 T-Shirt | back | 4606×5787 | 300 |
| BP6 T-Shirt | neck_outer | 1181×614 | 300 |
| BP12 Hoodie | front | 2953×3710 | 300 |
| BP12 Hoodie | back | 2953×3710 | 300 |
| BP145 Crewneck | front | 2953×3710 | 300 |
| BP793 Hoodie Embroidery | chest_center | 3000×1800 | 300 |
| BP793 Hoodie Embroidery | chest_left | 1200×1200 | 300 |
| BP793 Hoodie Embroidery | wrist | 600×900 | 300 |
| BP1744 Cap | front | 1770×600 | 300 |

## Background Removal (rembg)

**Archivo**: `podclaw/bg_removal.py` + `deploy/rembg/server.py`

### Cadena de prioridad
1. **Local rembg sidecar** (`REMBG_URL`) — $0, ~200ms, u2net model
2. **FAL.ai rembg** — $0, cloud
3. **FAL.ai bria/rmbg v2** — $0.018, cloud

### Validación de transparencia
```python
def validate_transparency(png_bytes):
    # transparent_ratio: >15% (bg removido)
    # opaque_ratio: >3% (sujeto preservado)
    # semi_transparent: <40% (bordes limpios)
```

## Upscaling (ESRGAN)

**Archivo**: `podclaw/connectors/fal_connector.py`

- **Modelo**: `fal-ai/esrgan` (2x o 4x)
- **Alpha preservation**: Separa RGBA → upscale RGB con ESRGAN + alpha con PIL bicubic → recombina
- **No integrado automáticamente** con el pipeline de diseño

## GAPS CRÍTICOS para PodClaw v2

### Gap 1: No hay pipeline SVG → PNG automatizado
```
LO QUE FALTA:
CEO envía imagen/prompt via WhatsApp
  ↓
[Agente diseñador] genera SVG (Recraft o Claude)
  ↓
[??? NO EXISTE ???] Descarga SVG → Convierte a PNG @exactas dimensiones
  ↓
[??? NO EXISTE ???] Set 300 DPI metadata
  ↓
[??? PARCIAL ???] Upscale si necesario (ESRGAN)
  ↓
[EXISTE] Upload a Supabase Storage
```

### Gap 2: No hay Claude SVG generation
- No hay integración de Claude para generar SVGs
- Solo Recraft genera SVG nativo, pero URLs expiran en 24h
- PodClaw v2 necesitará que Claude diseñe SVGs directamente (prompt → SVG code)

### Gap 3: DPI metadata ausente
```typescript
// LO QUE SE NECESITA (no implementado):
const pngBuffer = await sharp(svgBuffer, { density: 300 })
  .resize(4606, 5787)  // Canvas exacto para BP6
  .png()
  .toBuffer()
```

### Gap 4: Sin targeting de canvas specs
- `CANVAS_SPECS.md` documenta dimensiones, pero NO hay código que las consulte automáticamente
- El pipeline debería: producto tipo → blueprint → canvas specs → render a esas dimensiones

## Recomendación Técnica para PodClaw v2

### Opción recomendada: Sharp + @resvg/resvg-js (Node.js)

| Herramienta | SVG Text | Gradientes | Filtros | DPI | Performance |
|-------------|----------|------------|---------|-----|-------------|
| **Sharp (libvips)** | Parcial | Sí | Parcial | Sí (density) | Excelente |
| **@resvg/resvg-js** | Excelente | Sí | Sí | Sí | Muy buena |
| **Puppeteer** | Excelente | Sí | Sí | Configurable | Lenta (browser) |
| **cairosvg (Python)** | Buena | Sí | Parcial | Sí | Buena |
| **Inkscape CLI** | Excelente | Sí | Sí | Sí | Lenta |

**Recomendación**: `@resvg/resvg-js` como renderer SVG primario (mejor fidelidad que Sharp para SVG complejos) + Sharp para post-processing (resize, composite, DPI).

### Pipeline propuesto para PodClaw v2

```
1. CEO envía prompt + imagen referencia via WhatsApp
   ↓
2. Agente Diseñador clasifica intención (DTG/embroidery/sublimation)
   ↓
3. Consulta CANVAS_SPECS para obtener dimensiones target
   ↓
4. Genera diseño SVG (Claude code generation o Recraft API)
   ↓
5. Renderiza SVG → PNG (@resvg/resvg-js, density:300, exact canvas dims)
   ↓
6. Background removal si necesario (rembg sidecar)
   ↓
7. Upscale si gen_dims < target_dims (ESRGAN 2x/4x)
   ↓
8. Validación de calidad (dimensiones, transparencia, DPI)
   ↓
9. Upload a Supabase Storage
   ↓
10. Preview al CEO via WhatsApp para aprobación
   ↓
11. Si aprobado → crear producto en Printful
```

## Archivos de Referencia

| Archivo | Propósito |
|---------|-----------|
| `frontend/src/lib/providers/recraft-provider.ts` | SVG generation (Recraft V3) |
| `frontend/src/lib/providers/router.ts` | Intent routing |
| `frontend/src/lib/composition-renderer.ts` | Sharp + canvas composition |
| `podclaw/image_pipeline/dimensions.py` | Product dimensions table |
| `podclaw/connectors/fal_connector.py` | ESRGAN upscaling |
| `podclaw/bg_removal.py` | Transparency validation + rembg |
| `deploy/rembg/server.py` | Local rembg sidecar |
| `frontend/scripts/generate-brand-designs.mjs` | SVG→PNG via Sharp ejemplo |
| `.claude/skills/design-dtg/CANVAS_SPECS.md` | Dimensiones por blueprint |
