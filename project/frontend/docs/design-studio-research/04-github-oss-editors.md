# Editores Canvas Open-Source para Diseno de Productos POD

## Contexto del Proyecto

El `DesignStudio` actual en `frontend/src/components/products/DesignStudio.tsx` es un modal con tres tabs: texto personalizado (via `ProductPersonalizer`), generacion AI, y upload. El `AIPreviewCanvas` superpone la imagen del diseno sobre el mockup del producto usando posicionamiento CSS absoluto calculado desde `getPreviewZone()`. No existe ningun canvas interactivo real.

---

## Parte 1: Librerias Canvas Base

### 1. Fabric.js

**Repo**: https://github.com/fabricjs/fabric.js
- **Estrellas**: ~31,000
- **Licencia**: MIT
- **Stack**: JavaScript/TypeScript, v6 reescrito completamente en TS nativo con clases ES nativas
- **Bundle size**: ~25.7 MB minificado sin tree-shaking. Con tree-shaking en v6 (ESM imports) se reduce. Gzipped ~300-350 kB.
- **NPM weekly downloads**: ~485,000
- **Issues abiertas**: ~468

**Features**:
- Texto completo (bold, italic, underline, shadow, curvy text)
- Imagenes (upload, drag, resize, rotate, flip, filtros)
- Formas (rect, circle, triangle, polygon, path libre)
- Sistema de capas / z-index / agrupacion de objetos
- Undo/Redo (via historial manual o libreria adicional)
- Export PNG/SVG/JPEG con parametro `multiplier` (ej: x4 para 300dpi)
- Soporte mobile basico (touch events)
- Zoom/pan via `setZoom()` / `setViewportTransform()`

**Para 300 DPI**: usar `canvas.toDataURL({ multiplier: 4 })` para 1500px -> 6000px.

**Pros**: ecosistema masivo, documentacion extensa, SVG round-trip.
**Contras**: bundle grande, arquitectura imperativa (no declarativa como React), v6 rompe compatibilidad con v5, no tiene undo/redo built-in.

### 2. Konva.js / React-Konva

**Repos**:
- https://github.com/konvajs/konva — ~14,100 estrellas
- https://github.com/konvajs/react-konva — ~5,000 estrellas
- **Licencia**: MIT
- **Bundle size**: ~1.47 MB minificado / ~55 kB gzipped
- **NPM weekly downloads**: ~910,000

**Features**:
- Arquitectura declarativa React: shapes son componentes (`<Rect>`, `<Text>`, `<Image>`, `<Group>`)
- Sistema de capas (`<Layer>`) nativo
- Transformers (`<Transformer>`) built-in para resize/rotate
- Touch events nativos: multi-touch pinch-zoom
- Export: `stage.toDataURL({ pixelRatio: 4 })` para 4x resolution
- Hit detection eficiente con dirty region detection

**Para 300 DPI**: `stage.toDataURL({ pixelRatio: 4, mimeType: 'image/png', quality: 1 })`.

**Pros**: bundle liviano, React-first (declarativo), mejor performance, mas downloads que Fabric, 22 issues vs 468, excelente mobile.
**Contras**: texto editable requiere textarea HTML overlay, sin undo/redo ni snapping built-in.

### 3. Polotno SDK

- **Licencia**: Propietaria — $199/mes (10,000 loads), $399/mes Business. Codigo fuente: $50,000+ one-time.
- Construido sobre Konva internamente + MobX + Blueprint UI
- Editor completo out-of-the-box
- **Descartado para SKAPARA**: costo alto, no self-hosteable, incompatible con shadcn/ui, vendor lock-in.

---

## Parte 2: Repos de Design Editors

### 4. vue-fabric-editor / yft-design (Referencia)

- **vue-fabric-editor**: https://github.com/nihaojob/vue-fabric-editor — 7,800 estrellas, Vue 3, MIT
- **yft-design**: https://github.com/dromara/yft-design — 1,500 estrellas, Vue3 + Element Plus
- **Ambos son Vue, no React.** No portables directamente. Mejor referencia tecnica para editor con Fabric.js.

### 5. salgum1114/react-design-editor

- https://github.com/salgum1114/react-design-editor — 1,700 estrellas, MIT
- React + Fabric.js + Ant Design (legacy)
- Incompatible con shadcn/ui. Arquitectura legacy (CRA, no Vite/Next). **No apto para integrar.**

### 6. Webster (YaroslavChuiko) — EL MAS RELEVANTE

- **Repo**: https://github.com/YaroslavChuiko/Webster — 103 estrellas, MIT
- **Stack**: React + Redux + **Konva** + TypeScript + **Tailwind CSS** + **shadcn/ui** + Zustand + React Query
- **El unico editor de diseno OSS con stack identico al de SKAPARA.**
- Editor completo tipo Canva con Konva, layers, text, shapes, images, drag & drop.
- **Candidato de referencia tecnica primaria.**

### 7. Otros evaluados y descartados

| Repo | Razon de descarte |
|---|---|
| tolgaerdonmez/tshirt-designer | Abandonado 2022, demasiado basico |
| craft.js | Page builder DOM, NO canvas HTML5 |
| TUI Image Editor | Editor de fotos/filtros, no diseno POD |
| filerobot-image-editor | Misma situacion que TUI |
| LidoJS | Repo bloqueado por trademark de Canva |
| Three.js 3D designers | No genera archivos 2D para produccion |

---

## Tabla Comparativa Final

| Criterio | Konva + React | Fabric.js + React | Polotno SDK | Webster (ref) |
|---|---|---|---|---|
| **Licencia** | MIT | MIT | Propietaria | MIT |
| **Stars** | 14,100 + 5,000 | 31,000 | 1,300 | 103 |
| **Bundle (gzipped)** | ~55 kB | ~300-350 kB | Pesado | N/A |
| **NPM downloads/sem** | 910,000 | 485,000 | — | — |
| **React nativo** | Si (declarativo) | Parcial (imperativo) | Si | Si |
| **Tailwind + shadcn** | Compatible | Compatible | Incompatible | Nativo |
| **Mobile / Touch** | Excelente | Basico | Bueno | N/A |
| **Texto editable** | Transformer + overlay | Built-in IText | Built-in | Built-in |
| **Undo/Redo** | Manual (Zustand) | Manual | Built-in | Built-in |
| **Export PNG alta res** | `pixelRatio: 4` | `multiplier: 4` | Cloud API | Si |
| **Issues abiertas** | 22 | 468 | — | — |
| **Recomendacion** | **PRIMERA OPCION** | Segunda | Descartada | Referencia |

---

## Recomendacion Final: Konva + React-Konva

**Por que Konva gana para SKAPARA:**

1. **Stack compatible**: React declarativo, TypeScript, Next.js con `dynamic()` + `ssr: false`
2. **Bundle ligero**: 55 kB gzipped vs ~300+ kB Fabric
3. **Mas downloads**: 910k vs 485k semanales = mayor adopcion actual
4. **22 issues vs 468**: mejor mantenido
5. **Mobile prioritario**: multi-touch nativo (pinch-zoom, gestures)
6. **Export trivial**: `stage.toDataURL({ pixelRatio: 4 })` sin dependencias externas
7. **Webster como prueba**: stack identico (Konva + shadcn + Zustand) ya demostrado
8. **Sin vendor lock-in**: MIT, self-hosteable

### Arquitectura propuesta

```tsx
// Next.js 16 — dynamic import obligatorio
const DesignCanvas = dynamic(() => import('@/components/products/DesignCanvas'), { ssr: false })

// DesignCanvas.tsx — 'use client'
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Rect } from 'react-konva'

// Layer 0: Fondo fijo (mockup del producto, no interactivo)
// Layer 1: Print zone guide (rect con stroke dashed)
// Layer 2: Elementos del usuario (texto, imagenes, shapes — interactivos)
// Layer 3: UI overlay (handles, snap guides)

// Export:
const dataUrl = stageRef.current.toDataURL({
  pixelRatio: 4,
  mimeType: 'image/png',
  quality: 1,
  x: printZone.x, y: printZone.y,
  width: printZone.width, height: printZone.height,
})
```

---

## Sources

- [Fabric.js GitHub](https://github.com/fabricjs)
- [Konva.js GitHub](https://github.com/konvajs/konva)
- [React-Konva GitHub](https://github.com/konvajs/react-konva)
- [Konva High-Quality Export Docs](https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html)
- [npm-compare: Konva vs Fabric](https://npm-compare.com/fabric,konva)
- [DEV.to: Konva vs Fabric comparison](https://dev.to/lico/react-comparison-of-js-canvas-libraries-konvajs-vs-fabricjs-1dan)
- [Webster Design Editor](https://github.com/YaroslavChuiko/Webster)
- [vue-fabric-editor](https://github.com/nihaojob/vue-fabric-editor)
- [Polotno SDK Pricing](https://polotno.com/sdk/pricing)
- [DEV.to: Journey of building a POD Editor](https://dev.to/othman2001/the-journey-of-building-print-on-demand-editor-51jl)
