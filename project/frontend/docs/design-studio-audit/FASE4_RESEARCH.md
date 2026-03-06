# Design Studio V2 — Fase 4: Investigación y Análisis

> Fecha: 2026-03-06
> Objetivo: Investigación exhaustiva para planificar la Fase 4 (Diferenciación) del Design Studio.
> Fuentes: 5 agentes especialistas (AI generation, Fabric.js text curving, templates/clipart, análisis codebase, UX patterns)

---

## Tabla de Contenidos

1. [Análisis del Codebase Actual](#1-análisis-del-codebase-actual)
2. [AI Design Generation — Investigación](#2-ai-design-generation--investigación)
3. [Text Curving (Fabric.js) — Investigación](#3-text-curving-fabricjs--investigación)
4. [Templates & Clipart Library — Investigación](#4-templates--clipart-library--investigación)
5. [UX Patterns Avanzados — Investigación](#5-ux-patterns-avanzados--investigación)
6. [Consolidación y Plan Recomendado](#6-consolidación-y-plan-recomendado)

---

## 1. Análisis del Codebase Actual

> Fuente: Agente "Analyze current codebase for Fase 4"

### Resumen Ejecutivo

El codebase tiene una **base madura y production-ready** para Fase 4:
- ✅ AI generation endpoint con provider routing y fallback chain
- ✅ Background removal service (rembg sidecar + fal.ai chain)
- ✅ Design composition system con multi-panel support
- ✅ Usage limiting y cost guardrails
- ✅ Embroidery panel configurations en `print-areas.ts`
- ✅ 143+ design assets existentes en 4 directorios
- ✅ Docker Compose con rembg corriendo en port 8080
- ⚠️ **Gaps**: No template library UI, no design history/refinement UI, sin botones AI en editor

**Estimación**: ~70% de la infraestructura ya existe. El 30% restante es UI glue y embroidery validation.

### 1.1 AI Generation Endpoint

**Archivo**: `/api/designs/ai-generate/route.ts`

**Arquitectura existente**:
```
User Request → Auth + Rate Limit (5/min) → Safety Check
  → Usage Limit Check (tier-based) → Orchestration (intent classification)
  → Cost Guard → Design Session Creation → Generator (provider routing)
  → Save to ai_generations table → Return metadata
```

**Providers configurados**:

| Provider | Modelo | Coste | Caso de uso |
|----------|--------|-------|-------------|
| fal.ai FLUX schnell | schnell | $0.003 | Drafts rápidos, preview instantáneo |
| fal.ai FLUX dev | dev | $0.025 | Balance calidad/velocidad |
| fal.ai FLUX pro | flux-pro | $0.05 | Alta calidad, artístico |
| OpenAI DALL-E 3 | dall-e-3 | $0.08 | Fotorrealista, escenas complejas |
| Ideogram | v2 | $0.015 | Diseños con texto |
| Recraft | 3 | $0.04 | Vector/SVG generation |

**Intent Classification** (`ai-design-orchestrator.ts`):
- `photorealistic` → OpenAI > FLUX-pro > FLUX-dev
- `text-heavy` → Ideogram > OpenAI > FLUX-pro
- `vector` → Recraft > Ideogram > FLUX-dev
- `artistic` → FLUX-pro > FLUX-dev > OpenAI
- `pattern` → FLUX-pro > FLUX-dev > Ideogram
- `quick-draft` → FLUX-schnell > FLUX-dev
- `general` → FLUX-dev > OpenAI > Ideogram

**Límites de uso**:

| Tier | Generaciones/mes | Coste máx/generación | Budget mensual |
|------|-------------------|----------------------|----------------|
| free | 5 | $0.05 | $2.50 |
| premium | 50 | $0.15 | $25.00 |

### 1.2 Background Removal (rembg)

**Sidecar**: `deploy/rembg/server.py` — FastAPI, modelo u2net pre-cargado (~176MB)
- Endpoint: `POST /remove` (JSON `{ image_url }` → PNG bytes)
- Health: `GET /health`
- Docker: red `ai-services`, port 8080
- Coste: $0 (u2net es free)

**Fallback chain** (`lib/providers/background-removal.ts`):
1. fal.ai rembg (free, más rápido)
2. fal.ai Bria RMBG 2.0 ($0.018)
3. Replicate 851-labs ($0.0006)

### 1.3 Design Assets Existentes

| Directorio | Archivos | Formato | Propósito |
|------------|----------|---------|-----------|
| `public/meme-designs/` | 21 | PNG | Diseños meme AI-generated |
| `public/branded-previews/` | 18 | PNG | Mockups con branding |
| `public/brand-designs/` | 104 | PNG/SVG | Wordmarks, S marks, packaging |
| `public/hat-designs/` | ~15 | PNG | Referencia bordado |
| Otros (phase1, fleece, etc.) | ~260 | PNG | Históricos |

**Total**: ~408 archivos que podrían alimentar una template library.

### 1.4 Extension Points del Editor

**Toolbar** (`CanvasToolbar.tsx`):
```typescript
const TOOLS = [
  { id: 'select', icon: MousePointer2 },
  { id: 'text', icon: Type },
  { id: 'image', icon: ImageIcon },
  { id: 'layers', icon: Layers },
  // ← Añadir aquí: templates, ai-generate, remove-bg
]
```

**Properties Panel** (`CanvasProperties.tsx`):
```typescript
{activeTool === 'text' && <TextTool />}
{activeTool === 'image' && <ImageTool />}
{activeTool === 'layers' && <LayersPanel />}
// ← Añadir: templates, ai-generate, remove-bg, history
```

**Canvas Handle** (`CanvasWorkspace.tsx`) — métodos disponibles:
- `addImage(url)` — para AI generation y templates
- `addSVG(svgText)` — para clipart
- `exportJSON()` / `loadFromJSON()` — serialización
- `exportPNG(scale)` / `exportProductionPNG(type)` — export

### 1.5 Database Schema — Tablas Listas

| Tabla | Estado | Propósito Fase 4 |
|-------|--------|------------------|
| `ai_generations` | ✅ Ready | Track AI generations, refinements, cost |
| `design_compositions` | ✅ Ready | Multi-panel Fabric.js JSON, production URLs |
| `user_design_assets` | ✅ Ready | BG-removed images, processed assets |
| `design_sessions` | ✅ Ready | Group related AI generations |

### 1.6 Archivos Nuevos Necesarios

```
frontend/src/components/design-studio/
  ✨ TemplateLibraryPanel.tsx (~120 líneas)
  ✨ AIGenerationModal.tsx (~200 líneas)
  ✨ BackgroundRemovalPanel.tsx (~100 líneas)
  ✨ DesignHistoryPanel.tsx (~150 líneas)
  ✨ EmbroideryPlacementOverlay.tsx (~100 líneas)

frontend/src/app/api/designs/
  ✨ templates/route.ts (~50 líneas)
  ✨ remove-background/route.ts (~80 líneas)

frontend/src/lib/
  ✨ template-loader.ts (~40 líneas)
  ✨ embroidery-config.ts (~100 líneas)
```

### 1.7 Archivos a Modificar

```
📝 CanvasToolbar.tsx (añadir 3 tools al array TOOLS)
📝 CanvasProperties.tsx (añadir 4-5 ramas de panel nuevas)
📝 DesignStudioPage.tsx (añadir handlers nuevos)
📝 print-areas.ts (añadir embroidery placements y constraints)
📝 design-presets.ts (añadir intent 'embroidery')
📝 messages/{en,es,de}.json (i18n keys)
```

---

## 2. AI Design Generation — Investigación

> Fuente: Agente "Research AI design generation APIs"
> Estado: ✅ Completado

### 2.1 fal.ai FLUX Models (Estado Actual vs Disponible)

**En nuestro codebase** (`fal-provider.ts`): FLUX.1 schnell, dev, pro v1.1

**FLUX.1 Family (legacy, en uso)**:

| Modelo | Endpoint | Coste | Velocidad | Calidad | Max Resolución |
|--------|----------|-------|-----------|---------|----------------|
| FLUX.1 Schnell | `fal-ai/flux/schnell` | ~$0.003 | ~1-3s (4 steps) | Buena | 1024x1024 |
| FLUX.1 Dev | `fal-ai/flux/dev` | ~$0.025/MP | ~10-30s | Muy buena | 2048x2048 |
| FLUX.1 Pro v1.1 | `fal-ai/flux-pro/v1.1` | ~$0.05 | ~10-15s | Excelente | 2048x2048 |

**FLUX.2 Family (⚡ NO en el codebase aún — UPGRADE RECOMENDADO)**:

| Modelo | Endpoint | Coste | Mejora vs FLUX.1 |
|--------|----------|-------|-------------------|
| FLUX.2 Dev | `fal-ai/flux-2` | **$0.012/MP** | 52% más barato que FLUX.1 Dev, mejor calidad |
| FLUX.2 Pro | `fal-ai/flux-2-pro` | **$0.03/MP** | 40% más barato que FLUX.1 Pro, 6x más eficiente |
| FLUX.2 Flex | `fal-ai/flux-2-flex` | $0.05/MP | Control/conditioning avanzado |
| FLUX.2 Max | `fal-ai/flux-2-max` | $0.07/MP | 32B params, mejor typography, prompt adherence |

**FLUX Kontext (⚡ Image editing — NO en codebase)**:

| Modelo | Endpoint | Coste | Uso |
|--------|----------|-------|-----|
| Kontext Dev | `fal-ai/flux-kontext/dev` | $0.025/MP | Reference-based editing (open-weight) |
| Kontext Pro | `fal-ai/flux-pro/kontext` | $0.04 | Edits locales, style transfer, text-in-image |
| Kontext Max | `fal-ai/flux-pro/kontext/max` | Superior | Premium consistency + typography |

**Kontext capabilities**: Style transfer, text replacement en imágenes, edición element-level sin regenerar. Feature diferenciador que ningún competidor POD ofrece.

### 2.2 Otros Providers — Tabla Comparativa Completa

| Provider | Modelo | Coste/img (1024x1024) | Transparency | Text Quality | SVG | Best For |
|----------|--------|----------------------|-------------|-------------|-----|----------|
| fal.ai | FLUX.2 Pro | **$0.030** | No | 4/5 | No | General quality, POD |
| fal.ai | FLUX.2 Dev | **$0.012** | No | 3/5 | No | Budget quality |
| fal.ai | FLUX.1 Schnell | $0.003 | No | 2/5 | No | Quick drafts |
| fal.ai | FLUX Kontext Pro | $0.040 | No | 4/5 | No | Editing/iteración |
| fal.ai | FLUX.2 Max | $0.070 | No | 5/5 | No | Premium typography |
| OpenAI | GPT Image 1 Mini (low) | **$0.005** | **Sí** | 3/5 | No | Cheap + transparency |
| OpenAI | GPT Image 1 (medium) | $0.042 | **Sí** | 4/5 | No | Quality + transparency |
| OpenAI | GPT Image 1.5 (medium) | ~$0.040 | **Sí** | 5/5 | No | Best overall |
| Google | Imagen 4 Fast | $0.020 | No | 4/5 | No | Budget text-capable |
| Ideogram | V3 Turbo | **$0.030** | No | **5/5** | No | **Typography leader** |
| Recraft | V3 SVG | $0.080 | N/A | 3/5 | **Sí** | **Vector/logo** |
| Recraft | 20B Raster | $0.022 | No | 3/5 | No | Budget illustrations |
| Stability | SDXL | $0.003-0.006 | No | 1/5 | No | Ultra-budget |

### 2.3 Análisis Competitivo

| Competidor | Motor AI | UX | Límites | Diferenciador |
|------------|----------|-----|---------|---------------|
| **Printify** | OpenAI | Prompt → 13 estilos → mockup → publish | 15/día gratis | Integrado en Product Creator |
| **Canva Magic Design** | Propio | NL → 8-10 opciones completas (layout+type+colors) | Varía | Layout generation completo |
| **Kittl** | Ideogram | AI + 40K templates + typography avanzada | 3,000/mes (Expert) | Best typography en POD |
| **Placeit** | Template-first | Template → customize → mockup → download | $7.47/mes | Mockups realistas |

**Ventajas SKAPARA que ningún competidor tiene**:
1. Multi-provider intelligent routing (ya implementado)
2. Intent-based automatic provider selection (ya implementado)
3. Native SVG generation via Recraft
4. Cost transparency (mostrar coste real al usuario)
5. Kontext-based iterative editing (planificado)
6. Multi-position design awareness (front, back, neck, sleeves)

### 2.4 Pipeline de Resolución Recomendado

```
User Prompt
    ↓
[Orchestrator: intent classification + prompt engineering]
    ↓
[Cost Guard: check user budget]
    ↓
[Router: select provider chain based on intent]
    ↓
[Generation: 1024x1024, provider-specific params]
    ↓
[NSFW Post-Check: secondary API validation] ← NUEVO
    ↓
[BG Removal: BiRefNet → rembg → Bria RMBG → Replicate]
    ↓
[Upscale: Real-ESRGAN 4x → 4096x4096] ← NUEVO
    ↓
[Canvas Placement: map to product print area specs]
    ↓
[Storage: upload to Supabase Storage]
    ↓
[Record: save to ai_generations table]
```

**Coste estimado por pipeline completo**: $0.02-0.10 dependiendo del provider y tier.

### 2.5 Upgrades Recomendados (Sin cambio de arquitectura)

| # | Upgrade | Impacto | Esfuerzo |
|---|---------|---------|----------|
| 1 | FLUX.1 Pro → FLUX.2 Pro | -40% coste, mejor calidad | Cambiar endpoint en `fal-provider.ts` |
| 2 | FLUX.1 Dev → FLUX.2 Dev | -52% coste | Cambiar endpoint |
| 3 | Fix Ideogram cost estimate | Accuracy ($0.03, no $0.04) | 1 línea en `ideogram-provider.ts` |
| 4 | Añadir GPT Image 1 Mini | $0.005 draft con transparency | Nuevo provider entry |
| 5 | Añadir BiRefNet a BG removal | Free, mejor calidad que rembg | Insert en fallback chain |
| 6 | Añadir Kontext para edición iterativa | Nuevo intent `editing` | Nuevo `kontext-provider.ts` |
| 7 | Añadir upscale step | Print-ready resolution | fal.ai ESRGAN post-BG removal |

### 2.6 Routing Table Actualizado (Propuesto)

```
artistic:       FLUX.2 Pro → FLUX.2 Dev → GPT Image 1.5
text-heavy:     Ideogram V3 → FLUX.2 Max → GPT Image 1.5
photorealistic: GPT Image 1.5 → FLUX.2 Pro → FLUX.2 Dev
vector:         Recraft V3 → Ideogram V3 → FLUX.2 Dev
pattern:        FLUX.2 Pro → FLUX.2 Dev → Ideogram V3
quick-draft:    FLUX.1 Schnell → GPT Image 1 Mini → FLUX.2 Dev
general:        FLUX.2 Dev → GPT Image 1 → Ideogram V3
editing:        FLUX Kontext Pro → FLUX Kontext Dev  ← NUEVO
```

### 2.7 Prompt Engineering para POD

**Best practices**:
1. Generar sobre **fondo gris claro** (no transparente ni blanco) — mejor BG removal
2. Usar terminología **"sticker"**: "sticker-style design", "outlined subject"
3. Especificar **"isolated subject"** y "no background elements"
4. Añadir contexto print: "suitable for t-shirt print", "high contrast for fabric"
5. Negative prompts: "blurry, low quality, watermark, text, signature, busy background"

**Implementación actual**: `prompt-engineer.ts` usa `', isolated on solid background, clean edges, print-ready, high resolution'` como POD suffix — buena baseline.

---

## 3. Text Curving (Fabric.js) — Investigación

> Fuente: Agente "Research Fabric.js text curving"
> Estado: ✅ Completado

### 3.1 Estado Nativo de Fabric.js v6

Fabric.js v6 (nuestro proyecto usa `^6.9.1`) tiene una propiedad nativa `path` en objetos de texto (`Text`, `IText`, `Textbox`), introducida en v4.6.0 via [PR #6543](https://github.com/fabricjs/fabric.js/pull/6543).

**API disponible**:

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `path` | `fabric.Path \| undefined` | SVG path para que el texto lo siga |
| `pathSide` | `"left" \| "right"` | Lado del path donde renderizar |
| `pathStartOffset` | `number` | Offset inicial a lo largo del path (px) |
| `pathAlign` | `"baseline" \| "center" \| "ascender" \| "descender"` | Alineación perpendicular |

**⚠️ Limitaciones conocidas**:
1. **IText/Textbox editing roto**: Cursor positioning incorrecto durante edición inline
2. **Bounding box inexacto**: Rectángulo de selección no envuelve el texto curvado
3. **SVG export no soportado**: [Issue #6958](https://github.com/fabricjs/fabric.js/issues/6958) — `toSVG()` no produce `<textPath>`
4. **Serialización rota con Textbox**: [Issue #7173](https://github.com/fabricjs/fabric.js/issues/7173) — `loadFromJSON()` crashea
5. **Feature "unfinished"**: Los docs oficiales lo marcan como incompleto

### 3.2 Comparación de Enfoques

| Enfoque | Editabilidad | Curva Ajustable | Serialización | Export Quality | Esfuerzo | Production-Ready |
|---------|-------------|-----------------|---------------|----------------|----------|-----------------|
| **A: fabric.Text + path nativo** | Pobre (no inline) | Fair | Fair (solo Text, no Textbox) | Buena | Bajo | Medio |
| **B: Custom CurvedText class** ⭐ | Pobre (input externo) | Excelente | Excelente | Buena | Medio (~150-200 líneas) | **Alto** |
| **C: SVG textPath import** | Muy pobre (se convierte en Group) | Pobre (regenerar SVG) | Buena | Buena | Bajo | Bajo |
| **D: Third-party libs** | Varía | Varía | Varía | Varía | Bajo | Bajo (incompatibles con v6) |

### 3.3 Recomendación: Approach B — Custom `CurvedText` Class

**Razones**:
- Control total sobre rendering, serialización y UI
- No depende de features experimentales de Fabric.js
- `classRegistry.setClass()` garantiza serialize/deserialize limpio
- `diameter` + `kerning` + `flipped` mapean directamente a sliders
- Patrón probado por múltiples implementaciones comunitarias

**Core rendering**:
```typescript
import { FabricObject, classRegistry } from 'fabric';

export class CurvedText extends FabricObject {
  static type = 'curved-text';

  declare text: string;
  declare diameter: number;      // arc diameter (px)
  declare kerning: number;       // spacing entre chars (-10 to 10)
  declare flipped: boolean;      // texto inward vs outward
  declare curveAngle: number;    // degrees, for UI slider
  declare fontSize: number;
  declare fontFamily: string;
  declare fill: string;

  _render(ctx: CanvasRenderingContext2D) {
    const radius = this.diameter / 2;
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    ctx.fillStyle = this.fill as string;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Medir ancho total para centrar
    let totalWidth = 0;
    for (let i = 0; i < this.text.length; i++) {
      totalWidth += ctx.measureText(this.text[i]).width + this.kerning;
    }

    const totalAngle = totalWidth / radius;
    let currentAngle = -totalAngle / 2;

    for (let i = 0; i < this.text.length; i++) {
      const char = this.flipped ? this.text[this.text.length - 1 - i] : this.text[i];
      const charWidth = ctx.measureText(char).width + this.kerning;
      const halfCharAngle = (charWidth / 2) / radius;
      currentAngle += halfCharAngle;
      ctx.save();
      ctx.rotate(currentAngle);
      ctx.translate(0, this.flipped ? radius : -radius);
      if (this.flipped) ctx.rotate(Math.PI);
      ctx.fillText(char, 0, 0);
      ctx.restore();
      currentAngle += halfCharAngle;
    }
  }

  toObject(propertiesToInclude: string[] = []) {
    return super.toObject([
      'text', 'diameter', 'kerning', 'flipped',
      'fontSize', 'fontFamily', 'fill', 'curveAngle',
      ...propertiesToInclude,
    ]);
  }

  static async fromObject(object: Record<string, unknown>): Promise<CurvedText> {
    return new CurvedText(object as Partial<CurvedText>);
  }
}

classRegistry.setClass(CurvedText, 'curved-text');
```

### 3.4 Cómo lo Hacen los Competidores

**Canva**: Seleccionar texto → "Effects" → "Curve" → Slider **-100 a +100** (positivo = arco abajo, negativo = arco arriba). Círculo visual muestra radio actual.

**Printful DM**: Text tool con effects panel. Curved text como uno de varios efectos.

**Patrón universal de la industria**:
1. **Arc Angle Slider**: -360 a +360 (o -100 a +100 mapeado a radio)
2. **Direction toggle**: "Arc Up" / "Arc Down"
3. **Preview circle**: Línea de arco tenue mostrando el path actual

### 3.5 UI Controls Propuestos

Añadir sección "Curve" al `TextTool.tsx` existente:
```
[Curve] ────────────────────────────
  Enable curve:     [Toggle Switch]
  Arc angle:        [-360 ───●── +360]  180°
  Spacing:          [-10 ───●── +10]    0
  Direction:        [↑ Up] [↓ Down]
```

### 3.6 Tipos de Curva Comunes para POD

| Tipo | Uso | Productos |
|------|-----|-----------|
| **Arc (semicircle up)** | Cap front, badge top text, mug wrap | Gorras, mugs, badges |
| **Arc (semicircle down)** | "EST. 2024" bajo logo, badge bottom | Badges, camisetas |
| **Full circle** | Logos circulares, stamps, sellos | Todos |
| **Wave** | Texto decorativo/playful | Camisetas, mugs |
| **Bridge (up gentle)** | Product names suaves | Camisetas |

### 3.7 Export a Producción (300 DPI)

- **Custom `CurvedText`**: Usa `ctx.fillText()` por carácter → rasterizado por el browser text engine al scale correcto
- Con `multiplier: 6` sobre canvas de 500px → output 3000px → texto nítido
- Nuestro `exportProductionPNG` ya maneja esto correctamente con el pattern dispose/restore de alignment guidelines
- **Caveat**: Shadows no escalan con multiplier ([Issue #2939](https://github.com/fabricjs/fabric.js/issues/2939)). Si texto curvado tiene shadows, escalar manualmente antes de export

### 3.8 Archivos para Implementación

```
frontend/src/lib/curved-text.ts          # CurvedText class + classRegistry
frontend/src/lib/arc-path-helpers.ts     # generateArcPath() utility
```

Los curve controls se integran en el `TextTool.tsx` existente — no necesita componente UI nuevo.

### 3.9 Integración con CanvasWorkspace

1. Añadir `addCurvedText` al interface `CanvasHandle`
2. Importar `CurvedText` class (registrada con `classRegistry`)
3. Cuando usuario toggle "Enable curve" en texto seleccionado → convertir `IText` → `CurvedText` (preservar text, font, color) y viceversa
4. Extender `extractObjectInfo` para detectar `type === 'curved-text'` y extraer `curveAngle`, `kerning`, `flipped`

---

## 4. Templates & Clipart Library — Investigación

> Fuente: Agente "Research templates and clipart libraries"
> Estado: ✅ Completado

### 4.1 Análisis Competitivo

| Editor | Escala | UX Flow | Diferenciador |
|--------|--------|---------|---------------|
| **Printful Design Maker** | 50+ colecciones, ~3,500 gráficos, 790+ fuentes, 668+ fondos | Tabs por categoría → drag al canvas → personalizar | Templates editables, product-type specific |
| **Kittl** | 500,000+ assets, 10,000+ vectores premium | Buscar → drag-and-drop → customizar | Todo creado in-house, no stock scraped |
| **Placeit (Envato)** | 150,000+ templates | Categoría → editor → editar → export | Browser-based, fuerte en mockups |
| **CustomInk Design Lab** | Miles de clipart y templates | Producto → Design Lab → tema → personalizar | Artists profesionales in-house |

**Patrones comunes**:
1. **Browse-first UX**: Categorías visuales (thumbnails) antes que búsqueda
2. **One-click apply**: Click aplica template al canvas instantáneamente
3. **Todo es editable**: Templates son puntos de partida, no diseños bloqueados
4. **Product-type binding**: Templates asociados a tipo de producto (dimensiones correctas)
5. **50-100 templates = MVP creíble**: Editores POD especializados empiezan con sets enfocados

### 4.2 Templates como Fabric.js JSON

El codebase ya usa `canvas.toJSON()` / `canvas.loadFromJSON()` extensivamente:
- `CanvasWorkspace.tsx` — `exportJSON()` (línea 906) y `loadFromJSON()` (línea 912)
- `useDesignPersistence.ts` — save/load a Supabase

**Template = Fabric.js JSON con contenido placeholder**:
```json
{
  "version": "6.4.0",
  "objects": [
    {
      "type": "i-text",
      "text": "YOUR TEXT HERE",
      "fontFamily": "Bebas Neue",
      "fontSize": 48,
      "fill": "#ffffff",
      "data": { "id": "text-placeholder-1", "type": "userText", "placeholder": true }
    }
  ]
}
```

**Product-type scoping**: Obligatorio porque aspect ratios difieren (tshirt 3600x4800 = 0.75, mug 2850x1050 = 2.71, hat 1650x750 = 2.2). Ya definido en `PRODUCTION_DIMENSIONS` de `print-areas.ts`.

**Thumbnails**: Pre-rendered PNG (300x400) almacenados en Supabase Storage. Generar al crear/actualizar template.

### 4.3 Schema de Base de Datos Recomendado

```sql
-- Templates pre-diseñados
CREATE TABLE design_templates_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name JSONB NOT NULL DEFAULT '{}',          -- {"en": "...", "es": "...", "de": "..."}
  description JSONB DEFAULT '{}',
  product_type TEXT NOT NULL,                 -- tshirt, hoodie, mug, hat, tote-bag, phone-case
  panel TEXT NOT NULL DEFAULT 'front',
  category TEXT NOT NULL,                     -- tech-humor, minimalist, retro, bold-text, gradient
  tags TEXT[] DEFAULT '{}',
  fabric_json JSONB NOT NULL,
  fabric_version TEXT NOT NULL DEFAULT '6.4.0',
  thumbnail_path TEXT,
  panels JSONB,                               -- Multi-panel: {"front": {...}, "back": {...}}
  is_premium BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_product_type ON design_templates_library(product_type);
CREATE INDEX idx_templates_category ON design_templates_library(category);
CREATE INDEX idx_templates_tags ON design_templates_library USING gin(tags);

-- Clipart / Elementos
CREATE TABLE design_clipart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL,                     -- shapes, icons, badges, borders, patterns, tech, seasonal
  tags TEXT[] DEFAULT '{}',
  svg_path TEXT NOT NULL,                     -- Supabase Storage path
  thumbnail_path TEXT,
  svg_viewbox TEXT,
  colors TEXT[] DEFAULT '{}',
  is_premium BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  use_count INTEGER DEFAULT 0,
  source TEXT DEFAULT 'original',
  license_type TEXT DEFAULT 'commercial',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clipart_category ON design_clipart(category);
CREATE INDEX idx_clipart_tags ON design_clipart USING gin(tags);
```

### 4.4 Categorías de Clipart para SKAPARA

| Categoría | Descripción | Target MVP |
|-----------|-------------|------------|
| **tech-icons** | CPU, código, terminal, robot, neural network | 50 |
| **geometric** | Círculos, triángulos, hex grids, wireframes | 40 |
| **badges-frames** | Marcos circulares, shields, banners, stamps | 30 |
| **typography-extras** | Underlines, swooshes, flechas, comillas | 25 |
| **borders-dividers** | Glitch lines, circuit traces, wavy separators | 25 |
| **meme-culture** | Speech bubbles, pixel art, chat interfaces | 30 |
| **streetwear** | Graffiti, drips, tags, spray paint | 30 |
| **patterns** | Dot grids, noise textures, gradient meshes | 20 |
| **brand-elements** | S mark variaciones, wordmark, gradients | 15 |
| **seasonal** | Copos de nieve, estrellas, corazones | 15 |
| **Total** | | **~280** |

**Formato**: SVG (escalable sin pérdida, 2-15 KB vs 50-200 KB PNG, editable colores en Fabric.js). `CanvasWorkspace.addSVG()` ya lo soporta.

**Sourcing**: AI-generated (fal.ai) como fuente primaria + Iconoir (MIT) para iconos tech genéricos.

### 4.5 Storage y Entrega

**Supabase Storage (bucket público)** — ya en uso para compositions y product images.

```
design-assets/                    (public bucket)
  templates/thumbs/{id}.png       (300x400 thumbnails)
  clipart/{category}/{slug}.svg   (archivos SVG)
  clipart/thumbs/{id}.png         (120x120 thumbnails)
```

| Asset Type | Count | Avg Size | Total |
|------------|-------|----------|-------|
| Template JSON | 100 | 5-15 KB | ~1 MB |
| Template thumbs | 100 | 20-40 KB | ~3 MB |
| Clipart SVGs | 500 | 3-15 KB | ~4 MB |
| Clipart thumbs | 500 | 5-10 KB | ~4 MB |
| **Total** | | | **~12 MB** |

**Lazy loading**: IntersectionObserver para thumbnails, fetch SVG solo al click, prefetch on hover.

### 4.6 Templates Target por Producto (MVP)

| Producto | Templates | Notas |
|----------|-----------|-------|
| tshirt | 30 | Mayor demanda |
| hoodie | 20 | Comparte diseños con tshirt, ajustados |
| mug | 15 | Landscape, enfoque diferente |
| tote-bag | 10 | Formato cuadrado |
| hat | 10 | Espacio limitado, text-heavy |
| phone-case | 5 | Portrait, mercado menor |
| **Total** | **90** | |

### 4.7 Plan de Rollout

| Fase | Alcance | Estimación |
|------|---------|------------|
| **Phase 0**: Infraestructura | Migration SQL, bucket Storage, API routes con filtros | 1-2 días |
| **Phase 1**: Templates Panel MVP | UI panel, grid thumbnails, click-to-apply, seed 30 templates | 3-4 días |
| **Phase 2**: Clipart Panel | UI panel, categorías, búsqueda, fetch SVG on-click, seed 120 items | 3-4 días |
| **Phase 3**: Search & Discovery | Text search, Popular sort, Recently Used (localStorage) | 2-3 días |
| **Phase 4**: Content Expansion | 100 templates, 500 clipart, colecciones estacionales | Ongoing |
| **Phase 5**: Advanced | Semantic search (pgvector), color-based filter, Community section | Future |

### 4.8 Puntos de Integración

| Componente Existente | Integración |
|---------------------|-------------|
| `CanvasWorkspace.loadFromJSON()` | Templates cargan via este método |
| `CanvasWorkspace.addSVG()` | Clipart carga via este método |
| `useDesignEditor.ts` (DesignTool) | Añadir `'templates'` y `'clipart'` |
| `CanvasToolbar.tsx` (TOOLS array) | 2 nuevos tools con iconos |
| `CanvasProperties.tsx` (activeTool) | Casos para templates y clipart panels |
| `useDesignPersistence.ts` | Sin cambios — templates cargan en el mismo canvas |
| `sw.js` (Service Worker) | Extender cache para SVGs de clipart |

---

## 5. UX Patterns Avanzados — Investigación

> Fuente: Agente "Research POD editor UX patterns"
> Estado: ✅ Completado

### 5.1 Background Removal en Editores

**Estado del arte (2025-2026)**:

| Tier | Herramienta | Precisión | Coste | Caso de uso |
|------|-------------|-----------|-------|-------------|
| Tier 1 (Cloud API) | remove.bg | 90-95% (pelo/bordes complejos) | Pro: ilimitado | Canva usa su tecnología |
| Tier 1 (Cloud API) | Photoroom | Comparable | Premium | Fotoproducto especializado |
| Tier 2 (ML hosted) | fal.ai BRIA RMBG 2.0 | Cerca de comercial | $0.018/img | Batch processing |
| Tier 2 (ML hosted) | Replicate 851-labs | Buena | $0.0006/img | Alto volumen |
| Tier 3 (Open source) | rembg (U2-Net) | 85-90% | $0 | Local, zero cost |

**Para contexto POD** (logos, clipart, fotos de producto), rembg via fal.ai es suficiente. Los casos complejos (pelo, encaje) raramente aparecen en workflows POD.

**Nuestro estado**: Ya tenemos fallback chain en `lib/providers/background-removal.ts` + API route en `/api/designs/remove-bg/route.ts`.

**UX Flow recomendado**:
```
Upload imagen → Auto-detectar fondo → Botón "Remove Background"
→ Loading spinner (1-3s) → Resultado con checkerboard transparency
→ Toggle "Restaurar original" → Colocar en canvas
```

**Detalles UX clave**:
- **Checkerboard pattern** detrás del resultado (transparencia visible)
- **Before/After slider** — comparar original vs procesado (Canva lo hace)
- **Restore/Undo** — almacenar original en `data: { originalSrc, bgRemovedSrc }`
- **Auto-suggest** — tooltip proactivo cuando imagen tiene fondo sólido

**Gap actual**: `ImageTool.tsx` no tiene integración con BG removal. Necesita botón contextual en imagen seleccionada.

**Prioridad**: **ALTA** — Feature de mayor impacto para un editor POD.

### 5.2 Extracción de Paleta de Color

**Bibliotecas comparadas**:

| Librería | Tamaño | Método | Features |
|----------|--------|--------|----------|
| ColorThief | ~3KB | MMCQ | `getColor()`, `getPalette(count)` |
| node-vibrant | ~25KB | MMCQ + semántico | Vibrant, Muted, DarkVibrant, LightVibrant, etc. |
| color-thief-ts | ~4KB | MMCQ (TypeScript) | Web Worker support, a11y metadata |

**Recomendación**: `node-vibrant` por su sistema de swatches semánticos (Vibrant, Muted, DarkVibrant...) — colores que realmente funcionan bien juntos.

**Flujo**:
```
Upload imagen → Extraer 6 swatches semánticos (client-side, ~50-200ms)
→ Mostrar paleta bajo la imagen → Click en swatch
→ Aplicar como color de texto / fill de forma / fondo
```

**Integración**: Almacenar paleta en `data: { palette: ['#FF5722', ...] }` del objeto Fabric.js. Mostrar swatches en `CanvasProperties` cuando imagen seleccionada.

**Prioridad**: **MEDIA** — Diferenciador nice-to-have, reduce fricción.

### 5.3 Constraints de Bordado en Editor

**Printful Design Maker — Thread System**:
- Standard: **15 colores de hilo**, max **6 por diseño**
- Unlimited color: Miles de colores, surcharge (+3.25 EUR chest)
- Los colores NO son RGB — Printful mapea a hilos Madeira/Isacord reales

**Stitch types y restricciones**:
- **Satin stitch**: 0.05" (1.3mm) a 0.5" (12.5mm) ancho
- **Tatami stitch**: formas > 0.5" ancho
- **Run stitch**: línea simple, último recurso
- **Mínimo línea**: 1.5mm
- **Mínimo texto**: ~5mm (~8pt)

**Placements y dimensiones máximas**:

| Placement | Max Size | Notas |
|-----------|----------|-------|
| chest_left | 4" x 4" (100x100mm) | Más común para logos |
| chest_center | 4" x 4" (std), 10" x 6" (large) | Standard vs large |
| wrist | ~2.5" x 1" | Diseños simples only |
| hat front | 4" x 1.75" (dad hat), 5" x 1.75" (knit) | Varía por tipo |
| hat back | 2" x 1" | Espacio mínimo |
| bucket hat | 5" x 2" | Más espacio que caps |

**Recomendaciones para el editor**:
1. **Thread color picker** — 15 swatches Madeira, NO color picker genérico
2. **Warnings visuales** — Texto < 5mm → warning rojo
3. **EMBROIDERY_AREA_LIMITS** en `print-area-config.ts`
4. **Deshabilitar gradientes** cuando producto es bordado
5. **NO construir stitch simulation** — Printful no lo ofrece, flat-color mockup es estándar

**Prioridad**: **ALTA** — Obligatorio para productos bordados (hats, hoodies).

### 5.4 Auto-Save

**Benchmarks industria**:
- **Canva**: Save automático después de cada cambio (batched, no por keystroke). "All changes saved" en header
- **Google Docs**: Save por operación (sub-segundo), Operational Transformation
- **Estándar**: **2-3 segundos** debounce para editores de diseño

**Arquitectura recomendada**:
```
Cambio del usuario → setDirty(true) → Debounce timer (2s)
→ Si nuevo cambio dentro de 2s, timer se reinicia
→ Tras 2s inactividad, auto-save dispara
→ "Saving..." → "Saved" indicator
```

**Estrategia de conflictos**:
- `concatMap`: nunca disparar save nuevo hasta que el anterior complete
- On blur (tab switch): save inmediato, cancelar debounce
- Hash/checksum del fabricJSON para evitar saves redundantes
- localStorage fallback para offline/guest: `draft-{productId}`

**Estado actual**: Save manual only (Ctrl+S o botón). Auto-save no implementado.

**Prioridad**: **ALTA** — Perder trabajo = frustración #1 de usuarios en editores web.

### 5.5 Rulers y Medidas

**Análisis competitivo**:
- **Figma**: Rulers completos, medidas en px, conversión unidades con plugins
- **Photoshop**: Rulers configurables (px, in, cm, mm, pt)
- **Canva**: NO rulers — muestra dimensiones como propiedad de objetos
- **Printful DM**: Label simple "12 x 16 inches", NO rulers interactivos

**Recomendación**: **NO construir rulers interactivos** — over-engineering para POD.

Implementar en su lugar:
1. **Label estático** del print area real: "Print area: 12.0 x 16.0 in / 30.5 x 40.6 cm"
2. **Dimensiones del objeto seleccionado** en properties panel (pulgadas reales)
3. **Fórmula**: `inches = (canvasPx × scale) / 300` donde scale = `productionDimension / canvasWidth`

**Prioridad**: **BAJA** — Label simple suficiente para POD.

### 5.6 Duplicar Panel (Front → Back)

**Pattern de la industria**: Printful no copia automáticamente entre panels. Kittl duplica elementos dentro del mismo canvas.

**Recomendación**: Botón "Copy to..." con escalado proporcional:
- Copy NO es 1:1 pixel — adapta al aspect ratio y print area del target
- Elementos escalados proporcionalmente (fit, no stretch)
- Preview antes de confirmar
- Posición relativa al centro del print area

**Prioridad**: **MEDIA** — Útil para apparel con front+back.

### 5.7 Auth Gates en Editores

**Canva (gold standard)**:
- Guest editing completamente soportado
- Save requiere auth
- Download requiere auth en free tier
- Principio: "Users want to quickly evaluate value"

**Patrón universal**:

| Acción | Auth Requerido? | Razón |
|--------|----------------|-------|
| Abrir editor | NO | Exploración inmediata |
| Añadir texto/imágenes | NO | Edición core sin fricción |
| Undo/redo | NO | Flujo básico |
| Save to cloud | SÍ | Requiere user identity |
| Add to cart | SÍ | Requiere session |
| AI generation | SÍ | Consume créditos |

**Implementación recomendada**:
1. **Abrir editor sin auth** — mayor oportunidad de conversión
2. **Save**: Auth gate + preservar en localStorage → `AuthWallModal` → tras auth, cargar draft automáticamente
3. **Cart**: Auto-save a localStorage → auth gate → restaurar y proceder
4. **Draft expiry**: 7 días en localStorage

**Ya tenemos**: `AuthWallModal` con variantes `subtle` y `wall`, benefit lists, "Continue as Guest".

**Prioridad**: **ALTA** — Impacto directo en conversión.

### 5.8 Resumen de Prioridades

| Feature | Prioridad | Esfuerzo | Impacto |
|---------|-----------|----------|---------|
| BG Removal en editor | **ALTA** | Bajo (API existe) | Muy Alto |
| Auto-save | **ALTA** | Medio | Muy Alto |
| Auth gate (guest editing) | **ALTA** | Medio | Muy Alto |
| Embroidery constraints | **ALTA** | Medio | Alto (bordado) |
| Duplicate panel | **MEDIA** | Medio | Medio |
| Color palette extraction | **MEDIA** | Bajo | Medio |
| Rulers / medidas | **BAJA** | Bajo (label) | Bajo |

---

## 6. Consolidación y Plan Recomendado

> Basado en investigación de 5 agentes especialistas + análisis de codebase

### 6.1 Estrategia de Desarrollo

> **Decisión del usuario**: El módulo de IA (generation UI, BG removal UI, provider upgrades) se reserva para la **etapa final**. El foco es: UI/UX polish, renders correctos, personalización, responsiveness, y gestión del proceso de diseño y creación.

### 6.2 Matriz de Prioridad Final (Reordenada)

| # | Feature | Prioridad | Esfuerzo | Impacto | Infra Existente | Riesgo |
|---|---------|-----------|----------|---------|-----------------|--------|
| 1 | Auto-save + Draft Recovery | **P0** | Medio | Muy Alto | Parcial (useDesignPersistence) | Bajo |
| 2 | Auth Gate (guest editing) | **P0** | Medio | Muy Alto | AuthWallModal existe | Bajo |
| 3 | Responsiveness (mobile editor) | **P0** | Medio | Muy Alto | Mobile parcial | Medio |
| 4 | Export/Render Quality fixes | **P0** | Bajo | Alto | exportProductionPNG existe | Bajo |
| 5 | Embroidery Constraints | **P1** | Medio | Alto (bordado) | print-areas.ts parcial | Medio |
| 6 | Text Curving | **P1** | Medio | Alto | Custom class needed | Medio |
| 7 | Template Library | **P1** | Medio-Alto | Alto | addImage/loadFromJSON listos | Medio |
| 8 | Clipart Library | **P1** | Medio | Medio | addSVG() listo | Medio |
| 9 | Duplicate Panel (Front→Back) | **P2** | Medio | Medio | PanelSwitcher existe | Bajo |
| 10 | Color Palette Extraction | **P2** | Bajo | Medio | N/A | Bajo |
| 11 | Dimension Labels | **P2** | Bajo | Bajo | PRODUCTION_DIMENSIONS | Bajo |
| 12 | AI Generation UI | **P3 (Final)** | Medio | Alto | Endpoint completo | Bajo |
| 13 | BG Removal en editor | **P3 (Final)** | Bajo | Muy Alto | API + sidecar listos | Bajo |
| 14 | AI Provider Upgrades | **P3 (Final)** | Bajo | Medio | Providers listos | Bajo |

### 6.3 Batches de Implementación

#### Batch 0: Foundation UX + Responsiveness (P0) — ~4-5 días

**Objetivo**: Base UX sólida, editor mobile-first, gestión de proceso robusta.

| Task | Archivos | Descripción |
|------|----------|-------------|
| Auto-save (2s debounce) | `DesignStudioPage.tsx`, `EditorHeader.tsx` | `setDirty` → debounce timer → save → "Saved ✓" indicator |
| localStorage draft | `useDesignPersistence.ts` | Fallback offline/guest, draft key por productId, expiry 7 días |
| Auth gate pattern | `DesignStudioPage.tsx` | Abrir editor sin auth, gate save/cart con AuthWallModal |
| Draft restoration | `DesignStudioPage.tsx` | Tras auth, cargar draft de localStorage automáticamente |
| Responsive toolbar | `CanvasToolbar.tsx` | Bottom toolbar en mobile, vertical sidebar en desktop |
| Responsive properties | `CanvasProperties.tsx` | Sheet/drawer en mobile, panel lateral en desktop |
| Touch-friendly canvas | `CanvasWorkspace.tsx` | Touch events, pinch-to-zoom, tap-to-select |
| Mobile panel switcher | `PanelSwitcher.tsx` | Swipe/tabs compactos para Front/Back/Sleeve |

#### Batch 1: Render Quality + Export Pipeline (P0) — ~2-3 días

**Objetivo**: Renders correctos, exports production-ready, preview fiel.

| Task | Archivos | Descripción |
|------|----------|-------------|
| Export quality audit | `CanvasWorkspace.tsx` | Verificar multiplier correcto para cada product type |
| Preview accuracy | `DesignStudioPage.tsx` | Mockup preview que refleje fielmente el resultado final |
| Print area validation | `print-areas.ts` | Warnings cuando diseño excede safe zone |
| DPI indicator | `EditorHeader.tsx` o status bar | Mostrar DPI efectivo del diseño actual |
| Blank image per panel | `page.tsx` → `CanvasWorkspace` | BUG-06: pasar blank images por panel, no global |

#### Batch 2: Text Curving + Embroidery Constraints (P1) — ~4-5 días

**Objetivo**: Personalización avanzada de texto y soporte bordado correcto.

| Task | Archivos | Descripción |
|------|----------|-------------|
| CurvedText class | Nuevo: `lib/curved-text.ts` | Custom FabricObject + classRegistry, render char-by-char |
| Arc path helpers | Nuevo: `lib/arc-path-helpers.ts` | `generateArcPath(width, angle)` utility |
| Curve UI controls | `TextTool.tsx` | Toggle curve, angle slider (-360/+360), spacing, direction |
| IText ↔ CurvedText | `CanvasWorkspace.tsx` | Convert entre IText y CurvedText al toggle |
| Embroidery thread picker | `TextTool.tsx`, nuevo: `EmbroideryConstraints.tsx` | 15 Madeira swatches, disable gradients, size warnings |
| Embroidery area limits | `print-areas.ts` o nuevo `embroidery-config.ts` | `EMBROIDERY_AREA_LIMITS` por placement (chest, wrist, hat) |
| Min size enforcement | Editor validation | Warning rojo cuando texto < 5mm o línea < 1.5mm |
| Font list dedup | BUG-13: `TextTool.tsx`, `FontPicker.tsx` | Extraer a constante compartida |

#### Batch 3: Template & Clipart System (P1) — ~5-6 días

**Objetivo**: Content library para acelerar el proceso de diseño.

| Task | Archivos | Descripción |
|------|----------|-------------|
| DB migration | Nuevo: migration SQL | `design_templates_library` + `design_clipart` tables |
| Storage bucket | Supabase dashboard | `design-assets` public bucket |
| API routes | Nuevo: `/api/design-assets/templates/route.ts`, `clipart/route.ts` | CRUD con filtros category/tags/search |
| Templates Panel UI | Nuevo: `TemplatesPanel.tsx`, `CanvasToolbar.tsx` | Grid thumbnails, category filter, click-to-apply |
| Clipart Panel UI | Nuevo: `ClipartPanel.tsx`, `CanvasToolbar.tsx` | Category tabs, search, lazy load SVGs, click-to-add |
| Seed content | Scripts | 30 templates + 120 clipart items iniciales |
| i18n | `messages/{en,es,de}.json` | BUG-18 + keys para nuevos panels |

#### Batch 4: Polish & Process Management (P2) — ~3-4 días

**Objetivo**: Refinamientos de UX y gestión completa del proceso.

| Task | Archivos | Descripción |
|------|----------|-------------|
| Duplicate panel | `PanelSwitcher.tsx`, `EditorHeader.tsx` | "Copy to..." con scaling proporcional al target panel |
| Color palette extraction | `ImageTool.tsx`, `CanvasProperties.tsx` | node-vibrant, swatches clickables en panel |
| Dimension labels | Status bar | Real-world inches/cm del print area y objeto seleccionado |
| Apply-to-cart error handling | BUG-20 | Verificar save exitoso antes de cart, toast error |
| Composition auth check | BUG-11 | Verificar user_id en GET endpoint |
| Search & discovery | Templates/Clipart panels | Text search, Popular sort, Recently Used |

#### Batch 5: AI Module (P3 — Etapa Final) — ~4-5 días

**Objetivo**: Integración completa del módulo AI en el editor.

| Task | Archivos | Descripción |
|------|----------|-------------|
| BG Removal button | `ImageTool.tsx` | Botón contextual en imagen seleccionada → `/api/designs/remove-bg` |
| BG Removal preview | Nuevo: `BackgroundRemovalPreview.tsx` | Checkerboard, before/after, restore original |
| AI Generation panel | Nuevo: `AIGenerationPanel.tsx` | Prompt input, style selector, generate → place on canvas |
| Provider upgrades | `fal-provider.ts`, `router.ts` | FLUX.1 → FLUX.2, añadir GPT Image 1 Mini, BiRefNet |
| Upscale pipeline | Post BG-removal | fal.ai ESRGAN 4x para print-ready resolution |
| Kontext editing | Nuevo: `kontext-provider.ts` | Image-to-image refinement ("make skull bigger") |

### 6.4 Bug Fixes Integrados en Batches

| Bug | Fix | Batch |
|-----|-----|-------|
| BUG-06: blankImages no panel-specific | Pasar blank images por panel desde page.tsx | Batch 1 |
| BUG-11: Composition GET sin auth | Verificar user_id en endpoint | Batch 4 |
| BUG-13: Font list duplicada | Extraer a constante compartida | Batch 2 |
| BUG-18: i18n ImageTool/FontPicker | Añadir useTranslations + keys | Batch 3 |
| BUG-20: Apply-to-cart silent fail | Verificar save exitoso + toast error | Batch 4 |

### 6.5 Dependencias Tecnológicas

| Dependencia | Para | Acción |
|-------------|------|--------|
| `node-vibrant` | Color palette extraction | `npm install node-vibrant` (Batch 4) |
| Supabase Storage bucket | Templates/Clipart | Crear `design-assets` bucket público |
| Supabase migration | Templates/Clipart tables | 2 tablas + indexes + RLS |
| i18n keys | Nuevos panels | ~40-50 keys en en.json, es.json, de.json |

### 6.6 Archivos Clave (Resumen)

**Nuevos archivos** (~12):
```
Batch 2:
  src/lib/curved-text.ts
  src/lib/arc-path-helpers.ts
  src/components/design-studio/EmbroideryConstraints.tsx
  src/lib/embroidery-config.ts

Batch 3:
  src/components/design-studio/TemplatesPanel.tsx
  src/components/design-studio/ClipartPanel.tsx
  src/app/api/design-assets/templates/route.ts
  src/app/api/design-assets/clipart/route.ts
  supabase/migrations/XXXXXX_create_templates_clipart.sql

Batch 5 (Final - AI):
  src/components/design-studio/AIGenerationPanel.tsx
  src/components/design-studio/BackgroundRemovalPreview.tsx
  src/lib/providers/kontext-provider.ts
```

**Archivos a modificar** (~14):
```
Batch 0 (Foundation):
  src/app/[locale]/(editor)/design/[productId]/page.tsx (auth gate, auto-save)
  src/hooks/useDesignPersistence.ts (localStorage draft, auto-save)
  src/components/design-studio/EditorHeader.tsx (save indicator)
  src/components/design-studio/CanvasToolbar.tsx (responsive layout)
  src/components/design-studio/CanvasProperties.tsx (responsive drawer)
  src/components/design-studio/CanvasWorkspace.tsx (touch events, pinch zoom)
  src/components/design-studio/PanelSwitcher.tsx (mobile tabs)

Batch 1 (Render):
  src/lib/print-areas.ts (validation, embroidery limits)

Batch 2 (Text/Embroidery):
  src/components/design-studio/tools/TextTool.tsx (curve controls, thread picker)
  src/hooks/useDesignEditor.ts (new tool types)

Batch 3 (Templates):
  messages/{en,es,de}.json (i18n keys)

Batch 5 (AI - Final):
  src/components/design-studio/tools/ImageTool.tsx (BG removal, palette)
  src/lib/providers/fal-provider.ts (FLUX.2 upgrade)
  src/lib/providers/router.ts (updated routing)
```

### 6.6 Métricas de Éxito

| Métrica | Target | Cómo Medir |
|---------|--------|------------|
| Design completion rate | +30% vs actual | % usuarios que exportan o add-to-cart |
| Time to first design | < 2 min | Analytics: editor open → first save |
| AI generation usage | 60%+ de sesiones | ai_generations table |
| Template usage | 40%+ de sesiones nuevas | use_count increments |
| Work loss incidents | 0 | Auto-save + drafts eliminan pérdida |
| Embroidery rejection rate | < 5% | Printful order failures |
