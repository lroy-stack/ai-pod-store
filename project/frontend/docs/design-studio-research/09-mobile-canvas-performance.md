# Optimizacion de Editores de Canvas en Dispositivos Moviles

---

## 1. Canvas HTML5 en Movil — Limites

### Limites de tamano por navegador

| Navegador | Max pixels (area) | Max dimension | Memoria total |
|---|---|---|---|
| iOS Safari | **16,777,216 px** (4096x4096) | ~4096px | **384 MB** |
| Android Chrome | ~268,435,456 px | 32,767px | ~2 GB |
| Firefox movil | ~125 MP | 11,180px | ~2 GB |

**Problema critico iOS**: con `devicePixelRatio = 3` (iPhone Pro), un canvas CSS de 1500x1500 = 4500x4500 = **20.25 MP**, excede el limite. Safari devuelve canvas en blanco silenciosamente.

**Solucion obligatoria**:
```javascript
function safeCanvasSize(cssWidth, cssHeight) {
  const dpr = Math.min(window.devicePixelRatio, 2);
  const MAX_PIXELS = 16_777_216;
  const w = cssWidth * dpr, h = cssHeight * dpr;
  if (w * h > MAX_PIXELS) {
    const scalar = Math.sqrt(MAX_PIXELS / (w * h));
    return { width: Math.floor(w * scalar), height: Math.floor(h * scalar), dpr };
  }
  return { width: w, height: h, dpr };
}
```

### Memoria

- Canvas 800x800 @3x DPR = 2400x2400 = **21.6 MB**
- **iOS NO libera canvas automaticamente.** Destruir explicitamente:

```javascript
function destroyCanvas(canvas) {
  canvas.width = 1;
  canvas.height = 1;
  canvas.getContext('2d')?.clearRect(0, 0, 1, 1);
}
```

---

## 2. Benchmarks: Fabric vs Konva vs PixiJS

### 8000 objetos animados

| Engine | Chrome | Firefox | Safari |
|---|---|---|---|
| PixiJS (WebGL) | 60 FPS | 48 FPS | 24 FPS |
| Konva (Canvas 2D) | 23 FPS | 7 FPS | 19 FPS |
| Fabric.js | 9 FPS | 4 FPS | 9 FPS |

Konva supera Fabric **2.5x**. Para editor POD (3-10 objetos), cualquiera es suficiente.

### Objetos manejables @60fps por dispositivo

| Dispositivo | Fabric | Konva | PixiJS |
|---|---|---|---|
| iPhone SE (A15) | 30-50 | 80-120 | 500+ |
| iPhone 14 Pro (A16) | 80-100 | 200+ | 1000+ |
| Android gama baja | 10-20 | 30-50 | 200+ |
| Android gama media | 50-80 | 100-150 | 500+ |

---

## 3. Fabric.js en Movil — Problemas

- Issue #3089 "Poor performance on mobile" — abierto desde 2015, nunca resuelto completamente.
- Touch events problemáticos en v6.
- **Selective rendering** NO existe — re-renderiza **todo el canvas** cada frame.
- Pinch/rotate requiere implementacion custom.

### Optimizaciones criticas

```javascript
const canvas = new fabric.Canvas('c', {
  renderOnAddRemove: false,
  enableRetinaScaling: false,
  stopContextMenu: true,
});
// Batch changes, then requestRenderAll() una vez
```

---

## 4. Konva.js en Movil — Ventajas

### Touch nativo
Multi-touch scale + rotate disponible oficialmente.

### Performance
- Dirty region detection
- Capas separadas (scene + hit graph por capa)
- `listening(false)` en capas/shapes no interactivos

### Pixel ratio

```javascript
Konva.pixelRatio = Math.min(window.devicePixelRatio, 2);
```

---

## 5. Estrategias de Optimizacion

### Rendering

1. **Off-screen canvas** para fondo estatico
2. **RequestAnimationFrame** con dirty tracking
3. **Layer separation**: fondo (estatico) | objetos (interactivo) | UI overlay
4. **Resolucion adaptativa durante drag** (bajar calidad -> restaurar al soltar)
5. Max **3 capas** en movil

### DevicePixelRatio

Cap a 2x en movil. Verificar limite iOS siempre.

### Imagenes

Max 2000x2000px en movil. Downscale en cliente antes de canvas. `createImageBitmap` + `close()` para liberar memoria.

### Touch gestures

```css
.canvas-container { touch-action: none; } /* Desactiva scroll/zoom del browser */
```

Min touch targets: 44x44px CSS. Usar Pointer Events API (97% browser support).

---

## 6. Export Alta Resolucion desde Canvas Pequeno

### Opcion A: OffscreenCanvas en Worker (recomendada)

```javascript
// main thread
const worker = new Worker('export-worker.js');
worker.postMessage({ state: canvas.toJSON(), outputPx: 3000 });
worker.onmessage = (e) => { const blob = e.data.blob; };

// worker
self.onmessage = async ({ data: { state, outputPx } }) => {
  const canvas = new OffscreenCanvas(outputPx, outputPx);
  // ... re-render desde JSON ...
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  self.postMessage({ blob }, [blob]);
};
```

### Opcion B: Canvas virtual en main thread

`toBlob()` es mas eficiente que `toDataURL()` (no crea string base64 que consume 33% mas memoria).

### OffscreenCanvas — Soporte (Marzo 2026)

~95% global. iOS Safari 16.4+, Chrome 69+, Firefox 105+.

**Limitacion**: Fabric.js y Konva.js NO funcionan en workers (dependen del DOM).

---

## 7. Progressive Enhancement — Tiers

| Feature | Movil (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|---|---|---|---|
| Canvas de edicion | 375px, 1x DPR | 600px, 1.5x DPR | 800px, 2x DPR |
| Max objetos | 5 | 10 | Sin limite |
| Texto | Si | Si | Si |
| Upload imagen | Si (con resize) | Si | Si |
| Filtros/efectos | No | Simple | Full |
| Layers panel | No | Simplificado | Full |
| Pinch/rotate | Si | Si | Mouse |
| Export | Diferida a servidor | Local o servidor | Local |

### Feature detection

```javascript
const capabilities = {
  isLowEnd: navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 2,
  hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 1,
  hasOffscreenCanvas: 'OffscreenCanvas' in window,
};
const maxDPR = capabilities.isLowEnd ? 1 : Math.min(devicePixelRatio, 2);
```

---

## 8. Auto-save con IndexedDB

```javascript
import { openDB } from 'idb';
const db = await openDB('design-editor', 1, {
  upgrade(db) { db.createObjectStore('drafts', { keyPath: 'id' }); },
});
// Auto-save cada 10s
const state = {
  id: 'current-design',
  timestamp: Date.now(),
  json: fabricCanvas.toJSON(),
  thumbnail: fabricCanvas.toDataURL('image/jpeg', 0.3),
};
await db.put('drafts', state);
```

### Crash recovery

```javascript
const SESSION_KEY = 'editor-session-active';
const hadCrash = sessionStorage.getItem(SESSION_KEY);
sessionStorage.setItem(SESSION_KEY, 'true');
window.addEventListener('beforeunload', () => sessionStorage.removeItem(SESSION_KEY));
if (hadCrash) await recoverDraft();
```

---

## 9. Recomendacion Final para POD Movil

1. **Konva.js + react-konva** como engine (mejor balance mobile/API/React).
2. **OffscreenCanvas Worker** para export final (3000-4000px), no bloquear main thread.
3. **Cap DPR a 2x** para iOS Safari.
4. **IndexedDB** auto-save cada 10-30s.
5. **HTML overlay** para controles de transformacion.
6. **touch-action: none** en canvas element.
7. **Downscale imagenes a max 2000px** antes de cargar.
8. **Capa Konva separada** para objeto en drag.
9. **Destruir canvas explicitamente** al desmontar (iOS).
10. **Feature detection** para tier lite en `deviceMemory <= 2`.

---

## Sources

- [Canvas Area Exceeds Maximum Limit - PQINA](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit)
- [Konva Canvas limits in Safari iOS (2024)](https://longviewcoder.com/2024/02/09/konva-canvas-limits-in-safari-ios-explainer/)
- [OffscreenCanvas - MDN](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [High DPI Canvas - web.dev](https://web.dev/articles/canvas-hidipi)
- [Konva All Performance Tips](https://konvajs.org/docs/performance/All_Performance_Tips.html)
- [Fabric.js Performance Best Practices - HackerNoon](https://hackernoon.com/optimizing-performance-in-fabricjs-5-14-best-practices-and-tips)
- [Canvas Engines Benchmarks](https://benchmarks.slaylines.io/)
- [IndexedDB Best Practices - web.dev](https://web.dev/articles/indexeddb-best-practices-app-state)
