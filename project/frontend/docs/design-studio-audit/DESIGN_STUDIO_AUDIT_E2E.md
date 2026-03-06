# Design Studio V2 — Auditoría End-to-End

> Fecha original: 2026-03-05
> Actualizado: 2026-03-06
> Scope: Estado actual del Design Studio tras completar Fases 1-3. Bugs pendientes y roadmap Fase 4.

---

## Tabla de Contenidos

1. [Resumen de lo Completado (Fases 1-3)](#1-resumen-de-lo-completado-fases-1-3)
2. [Bugs Pendientes](#2-bugs-pendientes)
3. [Features Existentes](#3-features-existentes)
4. [Fase 4: Diferenciación — Roadmap](#4-fase-4-diferenciación--roadmap)
5. [Datos y Cobertura](#5-datos-y-cobertura)
6. [Referencia Técnica](#6-referencia-técnica)

---

## 1. Resumen de lo Completado (Fases 1-3)

### Fase 1 — Estabilización del Canvas (8/8 items)

- [x] Fix serialización: `filterGuideObjectsFromJSON` filtra guides/ghost/background de `exportJSON()`
- [x] Fix restauración: `enlivenObjects` + `canvas.add()` aditivo en vez de `loadFromJSON` destructivo
- [x] Fix color change: serializa diseño a Zustand antes de `setVariantColor`, canvas re-init preserva objetos
- [x] Fix history: `clearHistory()` explícito en `handlePanelChange`, stacks independientes por panel
- [x] Fix placement names: `PANEL_TO_PRINTFUL` normalización bidireccional (`left_sleeve` ↔ `sleeve_left`)
- [x] Fix category mappings: 34 categorías en `CATEGORY_TO_PRODUCT_TYPE` (todas las del catálogo EU)
- [x] Fix image persistence: `blobUrlToDataUrl()` convierte blob URLs a data URLs en `addImage`
- [x] Fix gradient: `extractObjectInfo` lee `fillMode`, `gradientAngle`, `gradientStartColor`, `gradientEndColor`

**Bugs resueltos**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-08, BUG-09, BUG-10, BUG-14, BUG-15, BUG-16, BUG-17, BUG-19, BUG-21

### Fase 2 — Pipeline de Producción (5/5 items)

- [x] `exportProductionPNG(productType)`: escala canvas a `PRODUCTION_DIMENSIONS`, reset viewport, crop a print area
- [x] Cart integration: `cart_items.composition_id` + migración + API cart lee/escribe composición
- [x] Order print files: stripe webhook construye `productionUrlsMap` → pasa `files[]` a Printful orders
- [x] Keyboard shortcuts: Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+D, Delete, Escape, arrows (1px/10px)
- [x] Print area per product: ghost templates proveen coordenadas exactas de Printful; fallback genérico 80%

### Fase 3 — UX Competitiva (5 batches completados)

**Batch 0 — Production Export Client-Side**:
- [x] `exportProductionPNG` en CanvasHandle con lookup PRODUCTION_DIMENSIONS
- [x] `productionDataUrl` en panel state Zustand
- [x] `handleSave` exporta production PNG y lo pasa a compose-v2 API
- [x] compose-v2 API sube PNGs a Supabase Storage, guarda `production_url` en DB

**Batch 1 — Printful `files` param (eliminar temp products)**:
- [x] `CreateOrderLineItem.files` en `pod/types.ts`
- [x] Printful mapper pasa `files` en `fromCreateOrderInput`
- [x] Checkout simplificado: NO crea temp products, lee `production_url` de composición
- [x] Stripe webhook pasa `files[]` con URLs de producción a Printful orders

**Batch 2 — Zoom/Pan + Opacity**:
- [x] `zoomLevel` + `setZoomLevel` en Zustand store
- [x] Mouse wheel zoom (`canvas.zoomToPoint`, clamp 0.25-5x)
- [x] Space+drag pan (keyboard listeners + viewportTransform)
- [x] Zoom controls UI flotante (Plus/Minus/Fit + porcentaje)
- [x] Viewport reset antes de export (exportPNG + exportProductionPNG)
- [x] Opacity slider en CanvasProperties (shadcn Slider 0-100%)
- [x] `setObjectOpacity` en CanvasHandle

**Batch 3 — clipPath Visual**:
- [x] `clipRectRef` con `fabric.Rect({ absolutePositioned: true })` del print area
- [x] Aplicado a addText, addImage, addSVG, duplicate, loadFromJSON, panel restore
- [x] Actualización de dimensiones en resize

**Batch 4 — Preview + Polish**:
- [x] Preview button (Eye icon) en EditorHeader con `onPreview` callback
- [x] Preview modal (shadcn Dialog) en DesignStudioPage con export PNG 2x
- [x] Apply-to-cart desde el modal de preview
- [x] i18n loading.tsx (`getTranslations` server component)
- [x] i18n keys: `loading`, `preview`, `previewTitle`, `zoom.*`, `properties.opacity` en en/es/de
- [x] Fix `clearRect` crash: dispose alignment guidelines antes de `toDataURL` (bug Fabric.js v6 — `initAligningGuidelines` before:render listener accede `contextTop` cuando `toCanvasElement` lo pone `undefined`)

---

## 2. Bugs Pendientes

### BUG-05 (LOW) — `getCanvasPrintArea` fallback ignora product type

**Estado**: Parcialmente resuelto. Ghost templates proveen coordenadas exactas (path principal). El fallback `getCanvasPrintArea()` sigue usando 10% padding fijo — `_productCategory` param sin usar.

**Impacto**: Solo afecta productos SIN ghost template (18 legacy Printify). La mayoría de productos activos (39/57) tienen templates.

**Fix futuro**: Cuando se migren los productos legacy a Printful, se resolverá automáticamente.

---

### BUG-06 (MEDIUM) — `blankImages` no son panel-specific

**Ubicación**: `page.tsx:46-57` + `DesignStudioPage.tsx`

**Problema**: `blankImages[color]` es un único URL por color (vista frontal). Si ghost template no disponible para panel "back", el fallback muestra la foto FRONTAL.

**Impacto**: Solo afecta productos sin ghost templates. Moderado.

---

### BUG-07 (MEDIUM) — `design_templates` vacío para productos legacy

**Problema**: 18 productos (Printify legacy) sin `product_template_id` → `design_templates` = NULL → sin ghost template → fallback a color sólido + print area genérica.

**Productos afectados**: mugs, bottles, tumblers, tote-bags, long-sleeves, baby-clothing, home-decor.

**Fix**: Migrar estos productos a Printful o mapear manualmente sus templates.

---

### BUG-11 (LOW) — Composition GET endpoint sin autenticación

**Ubicación**: `/api/designs/composition/[id]/route.ts`

**Problema**: Cualquier persona con el UUID puede leer el diseño de otro usuario. Falta verificar `user_id` del composition contra la sesión.

---

### BUG-13 (LOW) — Font list duplicada

**Ubicación**: `fabric-init.ts` vs `composition-renderer.ts`

**Problema**: Lista de 12 fuentes definida en dos lugares. Si se añade una fuente, hay que actualizar ambos.

**Fix**: Extraer a constante compartida.

---

### BUG-18 (MEDIUM) — Missing i18n en ImageTool y FontPicker

**Ubicación**: `ImageTool.tsx`, `FontPicker.tsx`

**Problema**: Textos hardcoded: "Drop image here", "Upload Image", font display names.

---

### BUG-20 (MEDIUM) — Apply-to-cart falla silenciosamente si save falla

**Ubicación**: `DesignStudioPage.tsx` → `handleApplyToCart()`

**Problema**: Si `handleSave()` falla (network error, auth expired), el redirect se ejecuta sin `compositionId` → diseño se pierde.

**Fix**: Verificar que save fue exitoso antes de redirect. Mostrar toast de error si falla.

---

## 3. Features Existentes

### Implementado y Funcional

- [x] Canvas Fabric.js v6 con SSR-safe dynamic import
- [x] Texto: fuentes, tamaño, color, alignment, bold, italic
- [x] Texto avanzado: shadow, outline, gradient fills (linear/radial)
- [x] Upload imágenes (PNG/JPG/WebP) + drag-and-drop + blob→data URL
- [x] Import SVG como vector
- [x] Multi-panel (front/back/sleeves) con state per-panel en Zustand
- [x] Capas: lista, z-order, visibilidad, lock
- [x] Undo/redo con snapshot history (panel-independiente)
- [x] Guías print area + safe zone (dashed rects)
- [x] clipPath visual: diseños recortados al borde del print area
- [x] Alignment snap guidelines (Fabric.js v6 extension)
- [x] Object clamping dentro del print area
- [x] Save/load composiciones (API compose-v2, schema v3)
- [x] Ghost template overlay (39 productos con datos Printful)
- [x] Color swatches (selector de variante, preserva diseño)
- [x] Responsive: desktop sidebar + mobile bottom panels
- [x] Unsaved changes warning dialog
- [x] i18n (en/es/de) para designEditor namespace
- [x] CORS image proxy
- [x] Zoom: mouse wheel + space+drag pan + floating controls
- [x] Opacity slider por objeto
- [x] Keyboard shortcuts (Ctrl+Z/Y/S/D, Delete, Escape, arrows)
- [x] Production export: client-side PNG a resolución Printful (3600×4800 etc.)
- [x] Pipeline producción: compose-v2 → Supabase Storage → cart → checkout → Printful `files[]`
- [x] Preview mockup modal con exportPNG 2x

---

## 4. Fase 4: Diferenciación — Roadmap

> Objetivo: Features que nos diferencian de la competencia. Desarrollo paralelo posible.

### P1 — Necesarios para competir

| # | Feature | Descripción | Complejidad |
|---|---------|-------------|-------------|
| F4-01 | **AI design generation** | Integrar `/api/designs/ai-generate` en el editor (fal.ai, Gemini). Botón "Generate with AI" en toolbar → prompt → imagen generada → addImage al canvas | Media |
| F4-02 | **Background removal** | Conectar rembg sidecar (ya desplegado en Docker) para limpieza de uploads. Botón "Remove background" en ImageTool | Baja |
| F4-03 | **Text curving** | Texto en arco/círculo. Esencial para gorras y mugs. Fabric.js soporta `path` en textbox | Media |
| F4-04 | **Embroidery panels** | Soporte para placements de bordado: `chest_left`, `chest_center`, `wrist_left`, `wrist_right`, `back_neck`. Nuevos panels en PanelSwitcher | Media |

### P2 — Ventaja competitiva

| # | Feature | Descripción | Complejidad |
|---|---------|-------------|-------------|
| F4-05 | **Templates library** | Diseños predefinidos por categoría. Galería en sidebar → click → load JSON | Media |
| F4-06 | **Clipart library** | Elementos gráficos categorizados (iconos, formas, badges). SVGs en storage | Media |
| F4-07 | **Color palette autogen** | Extraer colores predominantes de imagen subida → sugerir paleta | Baja |
| F4-08 | **Duplicate panel** | Copiar diseño de front a back con adaptación de aspect ratio | Baja |

### P3 — Nice-to-have

| # | Feature | Descripción | Complejidad |
|---|---------|-------------|-------------|
| F4-09 | **Auth gate** | Warning/login antes de guardar sin auth | Baja |
| F4-10 | **Auto-save** | Debounced save cada 30s si hay cambios (analizar costes Storage) | Media |
| F4-11 | **Rulers/medidas** | Reglas en bordes del canvas con escala real (pulgadas/cm) | Media |
| F4-12 | **3D preview** | Preview 3D interactivo con Three.js (CustomInk style) | Alta |
| F4-13 | **Collaborative editing** | Real-time multiplayer (Canva style) | Muy Alta |

### Bug fixes pendientes (integrar en Fase 4)

| # | Bug | Fix | Complejidad |
|---|-----|-----|-------------|
| F4-B1 | BUG-06: blankImages no panel-specific | Pasar blank images por panel desde page.tsx | Baja |
| F4-B2 | BUG-11: Composition GET sin auth | Añadir verificación user_id en el endpoint | Baja |
| F4-B3 | BUG-13: Font list duplicada | Extraer a constante compartida | Baja |
| F4-B4 | BUG-18: i18n ImageTool/FontPicker | Añadir useTranslations + keys en messages/*.json | Baja |
| F4-B5 | BUG-20: Apply-to-cart silent fail | Verificar save exitoso antes de redirect + toast error | Baja |

---

## 5. Datos y Cobertura

### Ghost Templates (Printful API)

| Categoría | Productos | Con template | Cobertura |
|-----------|-----------|-------------|-----------|
| t-shirts | ~15 | ~15 | 100% |
| pullover-hoodies | ~8 | ~8 | 100% |
| crewneck-sweatshirts | ~3 | ~3 | 100% |
| zip-hoodies | ~2 | ~2 | 100% |
| caps/snapbacks/dad-hats | ~6 | ~6 | 100% |
| beanies | ~1 | ~1 | 100% |
| sneakers | ~2 | ~2 | 100% |
| kids | ~3 | ~3 | 100% |
| mugs | ~2 | 0 | **0%** (Printify legacy) |
| bottles | ~2 | 0 | **0%** (Printify legacy) |
| tumblers | ~1 | 0 | **0%** (Printify legacy) |
| tote-bags | ~1 | 0 | **0%** (Printify legacy) |

**Total**: 39 de 57 productos activos (68%) con ghost templates.

### Color Map Coverage

`color-map.ts` tiene 76 entries. Faltan ~10 colores Printful (pepper, graphite heather, army heather, stargazer, glazed green, cotton pink, stem green, etc.). Impacto bajo — solo afecta bg color cuando no hay ghost template.

---

## 6. Referencia Técnica

### Arquitectura de Componentes

```
(editor)/layout.tsx → full-viewport wrapper (h-dvh)
  └─ design/[productId]/
       ├─ page.tsx (Server) — fetch product + variants + design_templates
       ├─ DesignEditorClient.tsx — dynamic import (ssr: false)
       ├─ loading.tsx — i18n spinner
       └─ DesignStudioPage.tsx (Client) — orquestador principal
            ├─ EditorHeader — back, título, undo/redo, preview, save, apply-to-cart
            ├─ CanvasToolbar — herramientas + undo/redo
            ├─ CanvasWorkspace — Fabric.js v6 canvas
            ├─ CanvasProperties — propiedades del objeto seleccionado
            ├─ PanelSwitcher — tabs front/back/sleeves
            └─ Zoom controls (flotante)
```

### Layer Order en Canvas

```
[0] productBackground  (blank garment image, evented:false)
[1..N] user objects     (text, images, SVGs — seleccionables, con clipPath)
[N+1] ghostOverlay      (ghost template PNG, evented:false)
[N+2] printAreaGuide    (dashed rect, evented:false)
[N+3] safeZone          (dashed rect, evented:false)
```

### Pipeline de Producción (E2E)

```
1. Editor: usuario diseña en canvas (~600px)
2. Save: exportProductionPNG(productType) → PNG a PRODUCTION_DIMENSIONS
3. compose-v2 API: sube PNG a Supabase Storage → production_url en DB
4. Cart: cart_items.composition_id referencia la composición
5. Checkout: create-session lee production_url → metadata en Stripe session
6. Webhook: stripe → lee production_urls → Printful order con files[]
7. Printful: recibe archivos de producción por panel → imprime
```

### Dimensiones de Producción

```
tshirt:    3600 × 4800  (12" × 16" @300dpi)
hoodie:    3600 × 4200  (12" × 14" @300dpi)
crewneck:  3600 × 4200  (12" × 14" @300dpi)
mug:       2850 × 1050  (9.5" × 3.5" @300dpi)
hat:       1650 × 750   (5.5" × 2.5" @300dpi)
tote:      3600 × 4200  (12" × 14" @300dpi)
phone:     1440 × 2880  (variable por modelo)
```

### Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `CanvasWorkspace.tsx` | Canvas Fabric.js v6, imperative API, zoom/pan, clipPath, export |
| `DesignStudioPage.tsx` | Orquestador: Zustand, history, save/load, keyboard, preview modal |
| `useDesignEditor.ts` | Zustand store central (product, variant, tool, selection, panels, zoom) |
| `useCanvasHistory.ts` | Undo/redo con JSON snapshots |
| `useDesignPersistence.ts` | Save/load via compose-v2 API |
| `canvas-helpers.ts` | Guías, clamping, DPR cap, filterGuideObjects |
| `print-areas.ts` | PRODUCTION_DIMENSIONS, CATEGORY_TO_PRODUCT_TYPE, MULTI_PANEL_AREAS |
| `compose-v2/route.ts` | API: guardar composición + production PNGs a Storage |
| `create-session/route.ts` | Checkout: lee production_url, NO crea temp products |
| `webhooks/stripe/route.ts` | Webhook: pasa files[] con production URLs a Printful orders |
| `pod/types.ts` | `CreateOrderLineItem.files` para custom print files |
| `printful/mapper.ts` | Mapea files[] a formato Printful en órdenes |

### Bug Fix Notable: Fabric.js v6 `toDataURL` crash

**Problema**: `initAligningGuidelines` registra `before:render` → `canvas.clearContext(canvas.contextTop)`. Durante `toDataURL()`, `Canvas.toCanvasElement()` pone `upper.ctx = undefined` → crash `clearRect of undefined`.

**Solución**: Dispose alignment guidelines antes de `toDataURL`, re-inicializar después. Aplicado en `exportPNG` y `exportProductionPNG`.

**Referencia**: Fabric.js issues #6572, #10036. Fixed upstream en v7.0.0 (PR #10820).
