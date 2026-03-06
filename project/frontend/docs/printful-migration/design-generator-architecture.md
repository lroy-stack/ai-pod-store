# Design Generator Architecture — SKAPARA Design Studio V2

## Executive Summary

This document consolidates the architecture research for building a next-generation design personalization editor for SKAPARA. The goal is to evolve from the current basic text/AI/upload studio into a full **canvas-based design editor** (Canva/Adobe-like) with real-time product preview, non-AI design generation, and deep Printful API integration.

### Current State vs Target

| Capability | Current (`DesignStudio.tsx`) | Target (Design Studio V2) |
|---|---|---|
| Text placement | 3 positions (top/center/bottom), 3 sizes | Free-drag anywhere, pixel-precise |
| Font control | 12 fonts, color picker, alignment | 50+ fonts, curved text, effects, shadows |
| Image upload | Static overlay on product photo | Drag/resize/rotate on canvas |
| AI generation | fal.ai/Gemini → single image output | AI + manual editing on same canvas |
| Preview | CSS overlay (quick) or Sharp server-render (accurate) | Real-time canvas render, instant |
| Layers | None — single design only | Full layer system (z-order, lock, visibility) |
| Templates | Style presets for AI prompts only | Full template gallery with parameterized designs |
| Export | Server-side Sharp composition (1024×1024 preview → production) | Client canvas export at print resolution |
| Product mockup | Static image with CSS-positioned overlay | Printful Mockup Generator API (real 3D mockups) |
| Multi-position | Not supported client-side | Front, back, sleeves, neck label |
| Non-AI design | Not available | Text effects, SVG manipulation, procedural patterns |

---

## 1. Architecture Overview

### 1.1 Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    USER INPUTS                          │
├──────────┬──────────┬───────────┬──────────┬───────────┤
│ Free Text│ Style    │ Upload    │ Template │ AI Prompt │
│ (phrase) │ Selector │ (image)   │ Gallery  │ (fal.ai)  │
└────┬─────┴────┬─────┴─────┬─────┴────┬─────┴─────┬─────┘
     │          │           │          │           │
     ▼          ▼           ▼          ▼           ▼
┌─────────────────────────────────────────────────────────┐
│              CANVAS ENGINE (Fabric.js)                   │
│                                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │Text  │  │Image │  │Shape │  │Effect│  │AI Img│     │
│  │Object│  │Object│  │Object│  │Layer │  │Layer │     │
│  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘     │
│     └─────────┴─────────┴─────────┴─────────┘           │
│                    ▼                                     │
│           Composition State                              │
│     (layers[], transforms, effects)                      │
└──────────────────┬──────────────────────────────────────┘
                   │
         ┌─────────┴──────────┐
         ▼                    ▼
┌──────────────┐    ┌──────────────────┐
│ Client-side  │    │ Server Export     │
│ Preview      │    │ (Sharp/node-     │
│ (canvas PNG) │    │  canvas at prod   │
│              │    │  resolution)      │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│ Printful     │    │ Printful File    │
│ Mockup API   │    │ Library Upload   │
│ (3D preview) │    │ (production PNG) │
└──────────────┘    └──────────────────┘
```

### 1.2 Key Design Decisions

1. **Fabric.js over Konva.js** — Better object manipulation API, larger ecosystem for POD use cases, built-in serialization (JSON save/load)
2. **Client-side canvas for preview** — Eliminates server round-trips for instant feedback (replacing current 500ms debounced Sharp previews)
3. **Server-side Sharp for production export** — Guarantees print-quality resolution (300dpi in print area)
4. **Printful Mockup Generator API for 3D previews** — Real mockups on product photos (async task-based API)
5. **Hybrid AI + Manual** — AI generates on the canvas as a layer, then user manipulates freely

---

## 2. Current SKAPARA Design Module — Detailed Analysis

### 2.1 Component Architecture (What We're Replacing)

```
DesignStudio.tsx (415 lines)
├── Tab: Text → ProductPersonalizer.tsx (1052 lines)
│   ├── Text input (3 lines max, 50 chars/line, profanity filter)
│   ├── Font selector (12 fonts: 4 sans, 3 serif, 1 display, 4 script)
│   ├── Color picker (16 swatches + hex input, WCAG contrast check)
│   ├── Position selector (top/center/bottom)
│   ├── Text alignment (left/center/right)
│   ├── Font size (small/medium/large)
│   ├── Image upload tab (PNG/JPEG/WebP, 5MB max)
│   ├── Background removal (rembg server)
│   └── Preview: CSS overlay on product photo OR server-generated mockup
│
├── Tab: AI Design → AIPromptEditor.tsx + StyleSelector.tsx
│   ├── 8 style presets (minimalist, vintage, geometric, watercolor, pop-art, line-art, botanical, typography)
│   ├── AI prompt → fal.ai/Gemini via ai-design-orchestrator.ts
│   ├── Intent classification (keyword heuristics → 7 intents)
│   └── Preview: AIPreviewCanvas.tsx (CSS positioned overlay + opacity slider)
│
└── Tab: Upload → Direct image upload with preview
```

### 2.2 Server-Side Rendering Pipeline

```
composition-renderer.ts (379 lines)
├── renderCompositionPreview(layers, productType) → 1024×1024 PNG
│   ├── node-canvas for text rendering (12 registered fonts)
│   ├── Sharp for image compositing
│   └── Print area positioning from print-areas.ts
│
└── exportForProduction(compositionId) → production-resolution PNG
    ├── Loads from design_compositions DB table
    ├── Scales to PRODUCTION_DIMENSIONS (e.g., tshirt: 3600×4800)
    └── Uploads to Supabase Storage → public URL
```

### 2.3 Print Area System

```typescript
// print-areas.ts — coordinates on 1024×1024 canvas
PRINT_AREAS = {
  tshirt:     { x: 312, y: 200, w: 400, h: 500 },
  hoodie:     { x: 300, y: 220, w: 420, h: 480 },
  mug:        { x: 150, y: 180, w: 350, h: 300 },
  hat:        { x: 262, y: 280, w: 500, h: 280 },
  // ...
}

// Production dimensions (pixels, 300dpi equivalent)
PRODUCTION_DIMENSIONS = {
  tshirt:     { w: 3600, h: 4800 },  // 12×16 inches at 300dpi
  hoodie:     { w: 3000, h: 3600 },  // 10×12 inches
  mug:        { w: 2850, h: 1050 },  // wrap-around
  hat:        { w: 1650, h: 750 },   // front panel
  // ...
}
```

### 2.4 Critical Gaps in Current Module

| Gap | Impact | Solution |
|---|---|---|
| No free-form positioning | Users can't place text/images precisely | Canvas-based drag/drop |
| No rotation/scale | Fixed size presets only | Fabric.js transform controls |
| No layers | Single design only, no compositing | Fabric.js object stack |
| No text effects | Plain text only (no shadow, outline, curve) | Canvas text manipulation + SVG effects |
| No real-time preview | 500ms debounced server call or imprecise CSS overlay | Client-side canvas render |
| No multi-position | Front only | Tab-based position editor, each with its own canvas |
| No undo/redo | Users can't revert changes | Command pattern on canvas state |
| No template system | Only AI style presets, not editable templates | Serialized Fabric.js JSON templates |
| Server-only production export | Requires Sharp + node-canvas on server | Hybrid: client preview + server production |

---

## 3. Canvas Engine — Fabric.js Integration

### 3.1 Why Fabric.js

| Criteria | Fabric.js | Konva.js | Paper.js |
|---|---|---|---|
| Object model | Rich (Text, Image, Path, Group) | Good (Shape, Text, Image) | Excellent (Path, CompoundPath) |
| Manipulation | Built-in controls (drag, resize, rotate) | Built-in via Transformer | Manual |
| Serialization | `canvas.toJSON()` / `loadFromJSON()` | Manual | Manual |
| React integration | `fabricjs-react`, `react-fabric` wrappers | `react-konva` (official) | None |
| Text effects | Built-in (shadow, stroke, underline) | Basic | N/A |
| SVG import/export | Built-in `fabric.loadSVGFromURL()` | Limited | Excellent |
| Community | 25k+ GitHub stars, mature | 10k+ stars | 14k+ stars |
| License | MIT | MIT | MIT |
| POD use cases | Widely used (CustomInk, Printful Design Maker) | Used in some editors | Rare for POD |
| Bundle size | ~300KB minified | ~150KB | ~200KB |

**Verdict**: Fabric.js wins for POD editors due to built-in serialization (save/load designs), rich text manipulation, SVG I/O, and proven POD industry adoption.

### 3.2 Core Canvas Setup

```tsx
// components/design-editor/DesignCanvas.tsx
'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import * as fabric from 'fabric' // v6+ ESM import

interface DesignCanvasProps {
  width: number
  height: number
  printArea: { x: number; y: number; w: number; h: number }
  productImage?: string
  onStateChange?: (json: object) => void
}

export function DesignCanvas({
  width,
  height,
  printArea,
  productImage,
  onStateChange,
}: DesignCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const [undoStack, setUndoStack] = useState<string[]>([])
  const [redoStack, setRedoStack] = useState<string[]>([])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
    })

    fabricRef.current = canvas

    // Draw print area boundary (non-selectable guide)
    const printAreaRect = new fabric.Rect({
      left: printArea.x,
      top: printArea.y,
      width: printArea.w,
      height: printArea.h,
      fill: 'transparent',
      stroke: 'rgba(99, 102, 241, 0.3)',
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    })
    canvas.add(printAreaRect)

    // Listen for state changes (for undo/redo and save)
    canvas.on('object:modified', () => {
      saveState()
      onStateChange?.(canvas.toJSON())
    })

    return () => {
      canvas.dispose()
    }
  }, [width, height, printArea])

  const saveState = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const json = JSON.stringify(canvas.toJSON())
    setUndoStack(prev => [...prev, json])
    setRedoStack([]) // Clear redo on new action
  }, [])

  const undo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack(r => [...r, JSON.stringify(canvas.toJSON())])
    setUndoStack(u => u.slice(0, -1))
    canvas.loadFromJSON(prev, () => canvas.renderAll())
  }, [undoStack])

  const redo = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack(u => [...u, JSON.stringify(canvas.toJSON())])
    setRedoStack(r => r.slice(0, -1))
    canvas.loadFromJSON(next, () => canvas.renderAll())
  }, [redoStack])

  return <canvas ref={canvasRef} />
}
```

### 3.3 Text Object with Effects

```tsx
function addTextToCanvas(
  canvas: fabric.Canvas,
  text: string,
  options: {
    fontFamily?: string
    fill?: string
    fontSize?: number
    shadow?: string      // e.g., 'rgba(0,0,0,0.3) 2px 2px 4px'
    stroke?: string      // outline color
    strokeWidth?: number
    textAlign?: string
    charSpacing?: number // letter-spacing in 1/1000 em
  }
) {
  const textObj = new fabric.IText(text, {
    left: 100,
    top: 100,
    fontFamily: options.fontFamily || 'Inter',
    fill: options.fill || '#000000',
    fontSize: options.fontSize || 48,
    shadow: options.shadow,
    stroke: options.stroke,
    strokeWidth: options.strokeWidth || 0,
    textAlign: options.textAlign || 'center',
    charSpacing: options.charSpacing || 0,
    editable: true, // Double-click to edit inline
  })
  canvas.add(textObj)
  canvas.setActiveObject(textObj)
}
```

---

## 4. Non-AI Design Generation Techniques

### 4.1 How Tools Like Graffiti Generator Work

Graffiti generators (e.g., graffiti-empire.com) use a combination of:

1. **Pre-rendered letter sets** — Each letter is a separate SVG/PNG with a specific graffiti style. The generator maps user input characters → letter images → composites them.

2. **SVG path manipulation** — Letters are defined as SVG paths. The generator applies transforms:
   - `skewX()` / `skewY()` for italic/slant
   - `scale()` for size variation
   - Path distortion for "wildstyle" effects
   - Color fills with gradients and patterns

3. **Canvas compositing** — Multiple layers composed:
   - Background layer (wall texture, plain color)
   - Shadow/drip layer (offset + blur of letter paths)
   - Fill layer (gradient, solid, pattern)
   - Outline layer (stroked paths at various widths)
   - Highlight layer (white strokes for 3D effect)
   - Splatter/texture overlay

4. **NO AI involved** — Pure algorithmic transformation of predefined vector assets.

### 4.2 Text Effects We Can Implement (No AI Required)

#### A) Shadow & Glow
```tsx
// Fabric.js shadow (built-in)
textObj.set('shadow', new fabric.Shadow({
  color: 'rgba(0,0,0,0.5)',
  blur: 10,
  offsetX: 3,
  offsetY: 3,
}))

// Glow effect (shadow with no offset, bright color)
textObj.set('shadow', new fabric.Shadow({
  color: '#00ff00',
  blur: 20,
  offsetX: 0,
  offsetY: 0,
}))
```

#### B) Outline / Stroke
```tsx
// Double-render technique for thick outlines
// 1. Render stroke version (background)
const outlineText = new fabric.Text(text, {
  stroke: '#000000',
  strokeWidth: 6,
  fill: 'transparent',
  // ... same position
})
// 2. Render fill version (foreground)
const fillText = new fabric.Text(text, {
  fill: '#FF0000',
  stroke: 'transparent',
  // ... same position
})
// Group them
const group = new fabric.Group([outlineText, fillText])
canvas.add(group)
```

#### C) Curved / Arc Text
```tsx
// Using fabric.js textPath (v6+) or manual path placement
import opentype from 'opentype.js'

async function renderCurvedText(text: string, radius: number, font: string) {
  const openFont = await opentype.load(`/fonts/${font}.ttf`)
  const path = openFont.getPath(text, 0, 0, 72)

  // Calculate arc positions for each glyph
  const glyphs = openFont.stringToGlyphs(text)
  let totalWidth = 0
  const glyphWidths = glyphs.map(g => {
    const w = g.advanceWidth * (72 / openFont.unitsPerEm)
    totalWidth += w
    return w
  })

  // Place each glyph along circular path
  const startAngle = -totalWidth / (2 * radius)
  let currentAngle = startAngle

  for (let i = 0; i < glyphs.length; i++) {
    const angle = currentAngle + glyphWidths[i] / (2 * radius)
    const x = radius * Math.sin(angle)
    const y = -radius * Math.cos(angle) + radius

    // Create SVG path for glyph at rotated position
    const glyphPath = glyphs[i].getPath(0, 0, 72)
    const fabricPath = new fabric.Path(glyphPath.toPathData(), {
      left: x,
      top: y,
      angle: (angle * 180) / Math.PI,
      fill: '#000000',
    })
    canvas.add(fabricPath)

    currentAngle += glyphWidths[i] / radius
  }
}
```

#### D) Gradient Text Fill
```tsx
// Fabric.js gradient fill on text
textObj.set('fill', new fabric.Gradient({
  type: 'linear',
  coords: { x1: 0, y1: 0, x2: textObj.width, y2: 0 },
  colorStops: [
    { offset: 0, color: '#667eea' },
    { offset: 1, color: '#764ba2' },
  ],
}))
```

#### E) Pattern/Texture Fill
```tsx
// Fill text with a texture pattern
fabric.util.loadImage('/textures/grunge.png', (img) => {
  textObj.set('fill', new fabric.Pattern({
    source: img,
    repeat: 'repeat',
  }))
  canvas.renderAll()
})
```

### 4.3 Template System (Parametric Design)

Templates are serialized Fabric.js JSON with placeholder tokens:

```json
{
  "version": "6.0.0",
  "objects": [
    {
      "type": "IText",
      "text": "{{USER_TEXT}}",
      "fontFamily": "Permanent Marker",
      "fill": "{{PRIMARY_COLOR}}",
      "fontSize": 72,
      "shadow": "rgba(0,0,0,0.5) 3px 3px 5px",
      "left": 200,
      "top": 150
    },
    {
      "type": "Image",
      "src": "/templates/graffiti-bg-01.png",
      "left": 0,
      "top": 0,
      "selectable": false
    }
  ]
}
```

Template parameters:
- `{{USER_TEXT}}` — replaced with user's input
- `{{PRIMARY_COLOR}}` — from selected palette
- `{{SECONDARY_COLOR}}` — complementary
- `{{FONT_FAMILY}}` — from style selection

```tsx
async function applyTemplate(
  canvas: fabric.Canvas,
  templateJson: object,
  params: Record<string, string>
) {
  // Serialize template to string
  let jsonStr = JSON.stringify(templateJson)

  // Replace all placeholders
  for (const [key, value] of Object.entries(params)) {
    jsonStr = jsonStr.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  // Load onto canvas
  const parsed = JSON.parse(jsonStr)
  await canvas.loadFromJSON(parsed, () => canvas.renderAll())
}
```

### 4.4 Color Palette Generation (Algorithmic)

```tsx
// Generate complementary/analogous palettes without AI
function generatePalette(baseHex: string, scheme: 'complementary' | 'analogous' | 'triadic'): string[] {
  const hsl = hexToHSL(baseHex)

  switch (scheme) {
    case 'complementary':
      return [
        baseHex,
        hslToHex((hsl.h + 180) % 360, hsl.s, hsl.l),
      ]
    case 'analogous':
      return [
        hslToHex((hsl.h - 30 + 360) % 360, hsl.s, hsl.l),
        baseHex,
        hslToHex((hsl.h + 30) % 360, hsl.s, hsl.l),
      ]
    case 'triadic':
      return [
        baseHex,
        hslToHex((hsl.h + 120) % 360, hsl.s, hsl.l),
        hslToHex((hsl.h + 240) % 360, hsl.s, hsl.l),
      ]
  }
}
```

---

## 5. UX Patterns for the Design Editor

### 5.1 Layer Panel

```
┌──────────────────────────┐
│ Layers                 + │
├──────────────────────────┤
│ 👁 🔒 [AI Design]    ▲▼ │  ← AI-generated background
│ 👁 🔓 [Custom Text]  ▲▼ │  ← User's text with effects
│ 👁 🔓 [Uploaded Logo] ▲▼│  ← Uploaded PNG
│ 👁 🔓 [S Mark]       ▲▼ │  ← SKAPARA brand mark (locked)
└──────────────────────────┘
```

Features:
- Eye icon: toggle visibility
- Lock icon: prevent editing
- Drag handle: reorder z-index
- Click to select on canvas
- Double-click to rename

### 5.2 Toolbar

```
┌────────────────────────────────────────────────────────┐
│ [T] [🖼] [⬜] [✨] [📐] │ [↩] [↪] │ [🔍+] [🔍-] [📏] │
│ Text Image Shape AI   Align │ Undo Redo │ Zoom  Zoom  Grid │
└────────────────────────────────────────────────────────┘
```

### 5.3 Properties Panel (Right Sidebar)

When a text object is selected:
```
┌──────────────────────────┐
│ Text Properties          │
├──────────────────────────┤
│ Font:     [Permanent M▾] │
│ Size:     [48]    [+][-] │
│ Color:    [■ #FF0000   ] │
│ Align:    [L] [C] [R]   │
│ ─────────────────────── │
│ Effects                  │
│ Shadow:   [✓] ...        │
│ Outline:  [✓] ...        │
│ Curve:    [ ] ...        │
│ Gradient: [ ] ...        │
│ ─────────────────────── │
│ Position                 │
│ X: [312]  Y: [200]      │
│ W: [400]  H: [auto]     │
│ Rotate: [0°]            │
└──────────────────────────┘
```

### 5.4 Print Area Visualization

```
┌─ Canvas (1024×1024) ──────────────────────────────┐
│                                                     │
│   ┌─ Product Photo ─────────────────────────────┐  │
│   │                                              │  │
│   │   ┌─ Print Area (dashed border) ──────────┐ │  │
│   │   │                                        │ │  │
│   │   │   ┌─ Safe Zone (10% inset) ─────────┐│ │  │
│   │   │   │                                   ││ │  │
│   │   │   │   [User's design lives here]     ││ │  │
│   │   │   │                                   ││ │  │
│   │   │   └──────────────────────────────────┘│ │  │
│   │   │                                        │ │  │
│   │   └────────────────────────────────────────┘ │  │
│   │                                              │  │
│   └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.5 Multi-Position Editor

Tab-based approach — each position is a separate canvas:

```
┌────────────────────────────────────────┐
│ [Front] [Back] [Left Sleeve] [Neck]    │
├────────────────────────────────────────┤
│                                        │
│     ┌─ Canvas for selected tab ─┐     │
│     │                            │     │
│     │    [Design area]           │     │
│     │                            │     │
│     └────────────────────────────┘     │
│                                        │
└────────────────────────────────────────┘
```

Each tab stores its own canvas JSON. On export, all positions are composited for Printful submission.

---

## 6. Integration with Printful API

### 6.1 Design → Product Flow

```
User completes design in editor
         │
         ▼
Client: canvas.toDataURL('image/png', 1.0)
         │
         ▼
Server: POST /api/designs/export
  ├── Re-render at production resolution (Sharp)
  ├── Upload to Printful: POST /v2/files
  │   Body: { type: "default", url: "<supabase-storage-url>" }
  │   Response: { id: 12345, url: "..." }
  │
  ├── Create Sync Product: POST /v2/store/products
  │   Body: {
  │     sync_product: { name, thumbnail },
  │     sync_variants: [{
  │       variant_id: 4011,  // Printful catalog variant
  │       files: [{
  │         type: "default",    // front print
  │         id: 12345,          // file ID from upload
  │         position: { ... }   // area_width, area_height, etc.
  │       }]
  │     }]
  │   }
  │
  ├── Generate Mockup: POST /v2/mockup-generator/create-task/{product_id}
  │   Body: {
  │     variant_ids: [4011],
  │     files: [{ placement: "front", image_url: "..." }]
  │   }
  │   Response: { task_key: "abc123" }
  │
  └── Poll: GET /v2/mockup-generator/task?task_key=abc123
      Response: { status: "completed", mockups: [{ mockup_url: "..." }] }
```

### 6.2 File Upload Requirements (Printful)

| Product Type | Min Resolution | Format | Notes |
|---|---|---|---|
| T-shirts (DTG) | 3600×4800px (300dpi) | PNG, transparent bg | No bleed needed |
| Hoodies | 3000×3600px | PNG | |
| Mugs (sublimation) | 2850×1050px | PNG | Wrap-around, full bleed |
| Hats (embroidery) | 1650×750px | PNG | Max 3 colors, no gradients |
| Phone cases | 750×1500px | PNG | Edge-to-edge |
| Tote bags | 3600×3600px | PNG | |

**Mapping to our `PRODUCTION_DIMENSIONS`**: Our current dimensions align with Printful requirements. No changes needed.

### 6.3 Printful Mockup Generator API

```typescript
// POST /v2/mockup-generator/create-task/{product_id}
interface PrintfulMockupRequest {
  variant_ids: number[]
  format: 'jpg' | 'png'
  files: Array<{
    placement: 'front' | 'back' | 'left' | 'right'
    image_url: string
    position?: {
      area_width: number
      area_height: number
      width: number
      height: number
      top: number
      left: number
    }
  }>
}

// Response (async — poll for completion)
interface PrintfulMockupTask {
  task_key: string
  status: 'pending' | 'completed' | 'failed'
  mockups?: Array<{
    placement: string
    variant_ids: number[]
    mockup_url: string
    extra: Array<{ title: string; url: string }>
  }>
}
```

### 6.4 Printful Public App API (Design Customization)

The Public App API could power the "design your own" feature:

- **Token type**: OAuth 2.0 with user consent flow
- **Key capability**: Users can create products in THEIR Printful account (marketplace model)
- **For SKAPARA**: More relevant as a **Private Token** integration — we control the store, users design within our app

**Conclusion**: The Public App API is NOT needed for our design editor. We use the Private Token API for all backend operations. The design editor is 100% client-side (Fabric.js), only calling our API routes which proxy to Printful.

---

## 7. Component Architecture — Target Design

### 7.1 File Structure

```
src/components/design-editor/
├── DesignEditor.tsx          # Main entry (replaces DesignStudio.tsx)
├── DesignCanvas.tsx          # Fabric.js canvas wrapper
├── DesignToolbar.tsx         # Top toolbar (tools, undo/redo, zoom)
├── DesignLayerPanel.tsx      # Layer list panel
├── DesignPropertyPanel.tsx   # Right sidebar (properties of selected object)
├── DesignTemplateGallery.tsx # Template browser
├── DesignTextEffects.tsx     # Text effect controls (shadow, outline, curve, gradient)
├── DesignColorPicker.tsx     # Enhanced color picker (swatches + palette generator)
├── DesignPositionTabs.tsx    # Multi-position tab selector (front/back/sleeve/neck)
├── DesignExportButton.tsx    # Export/apply button with resolution selector
├── DesignMockupPreview.tsx   # Printful 3D mockup preview (async)
└── hooks/
    ├── useDesignCanvas.ts    # Canvas state management
    ├── useDesignHistory.ts   # Undo/redo command pattern
    ├── useDesignExport.ts    # Export and upload logic
    └── useDesignTemplates.ts # Template loading and parametrization

src/lib/
├── design-canvas-utils.ts    # Canvas helpers (snap-to-grid, alignment)
├── design-text-effects.ts    # Text effect algorithms (curve, warp, shadow)
├── design-template-engine.ts # Template parametrization engine
├── design-color-utils.ts     # Color palette generation, contrast check
├── design-export.ts          # Production export (Sharp, Printful upload)
└── print-areas.ts            # (existing — extend with Printful dimensions)
```

### 7.2 State Management

```typescript
// Design editor state (React context or Zustand store)
interface DesignEditorState {
  // Canvas
  canvasJson: Record<string, object>  // key = position (front, back, etc.)
  activePosition: string
  zoom: number
  showGrid: boolean
  showSafeZone: boolean

  // Selection
  selectedObjectId: string | null
  selectedObjectType: 'text' | 'image' | 'shape' | null
  selectedObjectProps: Record<string, any>

  // History
  undoStack: string[]
  redoStack: string[]
  isDirty: boolean

  // Product context
  productId: string
  productType: string
  availablePositions: string[]
  printAreaDimensions: Record<string, PrintArea>

  // Actions
  addText: (text: string, options?: TextOptions) => void
  addImage: (url: string) => void
  addShape: (type: 'rect' | 'circle' | 'triangle') => void
  removeSelected: () => void
  updateSelectedProps: (props: Record<string, any>) => void
  undo: () => void
  redo: () => void
  setActivePosition: (position: string) => void
  exportForPreview: () => Promise<string>   // PNG data URL
  exportForProduction: () => Promise<string> // Uploaded URL
  saveDesign: () => Promise<string>         // Saved to DB
  loadDesign: (id: string) => Promise<void>
  loadTemplate: (templateId: string, params: Record<string, string>) => Promise<void>
}
```

---

## 8. Migration Path — Current → V2

### Phase 1: Canvas Foundation (MVP)
- Replace CSS overlay preview with Fabric.js canvas
- Keep existing text/AI/upload tabs but render on canvas
- Add drag/resize/rotate for all objects
- Undo/redo
- **No breaking changes** — same export pipeline (canvas → server Sharp → Printful upload)
- **Estimated files**: 5 new components, 2 new hooks, 1 new lib

### Phase 2: Text Effects & Templates
- Add shadow, outline, gradient fill controls
- Template gallery (10-20 parametric templates)
- Enhanced color picker with palette generation
- Font preview in selector
- **Estimated files**: 3 new components, 2 new libs, 20 template JSONs

### Phase 3: Non-AI Design Generation
- Curved text (arc, wave, circle)
- SVG import/manipulation
- Shape library (geometric, decorative)
- Pattern fills (texture overlays)
- **Estimated files**: 2 new components, 1 new lib

### Phase 4: Multi-Position & Printful Mockups
- Tab-based multi-position editor
- Printful Mockup Generator integration (async 3D previews)
- Position-specific constraints (hat front panel vs t-shirt chest)
- **Estimated files**: 2 new components, extend design-export.ts

### Phase 5: Advanced Features
- Layer panel with full controls
- Snap-to-grid and alignment guides
- Collaborative design (real-time via Supabase Realtime)
- Design marketplace (users share/sell templates)
- **Estimated files**: 3 new components, 1 new hook

---

## 9. Build vs Buy Analysis

| Capability | Build | Buy/Integrate | Recommendation |
|---|---|---|---|
| Canvas editor | Fabric.js (free, MIT) | Polotno ($299/mo) | **Build** — full control, lower cost |
| Text effects | Custom (shadow, outline, curve) | — | **Build** — Fabric.js has built-in support |
| AI generation | Existing fal.ai/Gemini pipeline | — | **Keep** — already working |
| Mockup generation | Printful Mockup API (free with account) | Placeit ($7.47/mo) | **Printful API** — integrated with fulfillment |
| Template system | Custom Fabric.js JSON templates | — | **Build** — simple serialization |
| Background removal | Existing rembg sidecar | remove.bg API ($0.20/img) | **Keep** — self-hosted, free |
| SVG manipulation | Fabric.js + opentype.js | — | **Build** — good library support |
| Color palette | Algorithmic (HSL rotation) | Coolors API | **Build** — simple algorithm |
| Font rendering | Google Fonts + local files | — | **Build** — already have 12 fonts |

**Total cost to build**: $0 in new dependencies (Fabric.js is MIT). Main cost is development time.

---

## 10. Dependencies to Add

```json
{
  "dependencies": {
    "fabric": "^6.0.0",         // Canvas manipulation engine
    "opentype.js": "^1.3.4"     // Font parsing for curved text
  },
  "devDependencies": {
    "@types/fabric": "^5.3.0"   // TypeScript definitions
  }
}
```

**Bundle impact**: ~300KB (Fabric.js) + ~50KB (opentype.js) = ~350KB added. Acceptable for a design editor page that's loaded on-demand via dynamic import.

```tsx
// Dynamic import to avoid loading on non-design pages
const DesignEditor = dynamic(
  () => import('@/components/design-editor/DesignEditor'),
  { ssr: false, loading: () => <DesignEditorSkeleton /> }
)
```

---

## 11. Printful Integration Points Summary

| Operation | Printful API Endpoint | When |
|---|---|---|
| Upload design file | `POST /v2/files` | User clicks "Export" / "Add to Cart" |
| Create product | `POST /v2/store/products` | Design applied to specific product |
| Generate mockup | `POST /v2/mockup-generator/create-task/{id}` | Real-time preview after design |
| Poll mockup | `GET /v2/mockup-generator/task?task_key=...` | Poll until completed |
| Get print templates | `GET /v2/mockup-generator/printfiles/{id}` | Load available print areas |
| Create order | `POST /v2/orders` | Checkout with custom design |

---

## 12. Key Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Fabric.js bundle size (300KB) | Slower page load | Dynamic import, code splitting |
| Complex state management | Bug-prone editor | Zustand store with strict typing |
| Print resolution mismatch | Blurry prints | Server-side re-render at production DPI |
| Printful mockup API latency (5-15s) | Poor UX | Show client-side preview immediately, overlay Printful mockup when ready |
| Mobile canvas performance | Laggy on low-end devices | Limit object count, reduce canvas resolution on mobile |
| Template versioning | Breaking changes on Fabric.js updates | Pin version, migration scripts |
