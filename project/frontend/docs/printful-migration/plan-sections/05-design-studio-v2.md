# Section 5 — Design Studio V2: Next-Gen Product Personalization

**Migration Plan: Printify → Printful**
**Section**: 5 of N
**Date**: 2026-03-02
**Depends on**: Section 3 (Printful API Client), Section 4 (Product Catalog Migration)

---

## Table of Contents

1. [Architecture Decision: Build vs Printful EDM](#1-architecture-decision-build-vs-printful-edm)
2. [Canvas Library Decision: Fabric.js vs Konva.js](#2-canvas-library-decision-fabricjs-vs-konvajs)
3. [Component Architecture](#3-component-architecture)
4. [Feature Roadmap — Phased](#4-feature-roadmap--phased)
5. [Printful Mockup Generator Integration](#5-printful-mockup-generator-integration)
6. [Export Pipeline](#6-export-pipeline)
7. [Migration from Current Module](#7-migration-from-current-module)

---

## 1. Architecture Decision: Build vs Printful EDM

### Current State

The current design module (`DesignStudio.tsx`, 415 lines, orchestrating `ProductPersonalizer.tsx`, 1052 lines) provides:
- Three tabs: Text personalization, AI generation (fal.ai/Gemini), image upload
- Text: 12 fonts, 16 color swatches, 3 position presets (top/center/bottom), 3 sizes (S/M/L), 3 alignments
- Preview: CSS absolute overlay on product image (imprecise), or debounced server-side Sharp render (~500ms)
- Export: `composition-renderer.ts` — Sharp + node-canvas at production resolution, uploaded to Supabase Storage
- No drag/drop, no free positioning, no rotation, no layers, no text effects, no undo/redo

### Option A: Build Custom Canvas Editor

**Description**: Replace the CSS overlay with a Fabric.js or Konva.js interactive canvas. Build all tooling from scratch (text effects, layer panel, template system, export pipeline). No dependency on Printful for the design experience itself.

**Pros**:
- Full control over UX — can match SKAPARA brand exactly
- No external approval or enterprise access required
- Works with any fulfillment backend (Printify today, Printful tomorrow, any provider in the future)
- MIT licensed dependencies, zero licensing cost
- Can be built incrementally — Phase 1 drops in without breaking existing features
- The canvas JSON serialization format (Fabric.js or Konva.js) is under our control, stored in our own DB

**Cons**:
- Significant development time (estimated 14–20 weeks to reach full feature parity)
- We own all bugs and maintenance
- Text rendering in the browser is different from print rendering — must maintain server-side re-render pipeline for print-quality output
- Font loading on canvas is asynchronous — requires careful sequencing to avoid blank renders
- Mobile canvas performance requires careful optimization

**Effort**: High — ~14–20 developer-weeks across all phases

**Risk Level**: Medium — canvas libraries are mature and battle-tested, but integration complexity is real

---

### Option B: Embed Printful EDM (Enterprise)

**Description**: Replace our design UI entirely with Printful's Embedded Design Maker (EDM), an iframe-based white-label design tool accessible via a nonce token.

**How it works**:
1. Our server calls `POST /embedded-designer/nonces` with `external_product_id` and `external_customer_id`
2. Frontend initializes `new PFDesignMaker({ elemId, nonce, initProduct: { productId } })`
3. Customer designs in the Printful iframe — full Design Maker features (text, clipart, upload, patterns, curved text, shadows, layers, live pricing, 3500+ clipart assets)
4. `onTemplateSaved(templateId)` callback fires — we persist the `templateId` in our DB
5. Orders are placed with `source: "product_template"` and `product_template_id: templateId` — no separate file upload step

**Pros**:
- Zero canvas development time — Printful maintains the editor
- Immediate access to enterprise-grade features: curved text, shadows, outlines, 3500+ clipart, background removal, all-over pattern tool, real-time pricing, multi-position design
- Built-in embroidery support with auto thread color detection
- Localized in en_US, es_ES, de_DE (matches our i18n)
- CSS custom properties for white-labeling (`--pf-sys-background: #0F172A`, `--pf-sys-primary-surface-700: #40ACCC`)
- AI injection via `sendMessage({ event: 'setUrlImageLayer', imageUrl })` — preserves our AI generation pipeline
- No separate file upload step in orders (template-based ordering)
- Mockups are generated from the saved template automatically

**Cons**:
- **CRITICAL BLOCKER**: Requires enterprise approval at `printful.com/enterprise/embedded-design-maker`. Not available to standard API users. Approval timeline is unknown and not guaranteed.
- We cannot ship if approval is denied or delayed
- Locked into Printful's roadmap and UX decisions
- Customization is limited to CSS custom properties and feature flags — no deep structural changes
- If Printful changes the EDM (pricing, behavior, breaking changes), we absorb the impact
- Templates created in EDM are invisible in Printful's regular dashboard (and vice versa) — extra operational complexity
- Nonces expire — must handle token lifecycle carefully
- Cannot use EDM for non-Printful fulfillment (the template is Printful-specific)

**Effort**: Low (2–3 weeks to integrate) — but conditional on enterprise access approval

**Risk Level**: High — single point of failure on enterprise approval

---

### Option C: Hybrid (Build MVP Canvas + Apply for EDM as Enhancement)

**Description**: Build a custom Fabric.js canvas editor as the primary design experience (Phase 1–3). Simultaneously apply for EDM enterprise access. If approved, add EDM as an optional "Advanced Design Studio" mode that can be toggled per product or per user segment. The custom canvas remains the baseline that always works.

**How it works**:
- Phases 1–3 deliver a working custom canvas (MVP → text effects → templates) using Fabric.js
- In parallel, submit the EDM enterprise application with the SKAPARA business case
- If EDM access is granted: add a `PrintfulEDMStudio.tsx` component that replaces the canvas for products where the full Printful feature set is valuable (e.g., complex embroidery, all-over prints)
- If EDM access is denied: the custom canvas covers all use cases, nothing is blocked
- The two modes share the same export pipeline (client canvas PNG → server production render → Printful file upload)

**Pros**:
- Risk-free: we can ship on schedule regardless of EDM approval
- Best of both worlds if EDM is approved — enterprise features as an enhancement
- The custom canvas gives us full control and provider-independence
- EDM integration is contained to a single wrapper component (`PrintfulEDMStudio.tsx`)
- Can offer EDM as a "power user" or "premium" feature, custom canvas as the standard

**Cons**:
- We build more than we strictly need if EDM is approved quickly
- Two code paths to maintain if both modes are active
- UX complexity: must ensure consistent behavior across both modes

**Effort**: High for custom canvas (same as Option A) + 2–3 weeks if EDM is later approved

---

### Recommendation: Option C (Hybrid)

**Rationale**:

The EDM enterprise access requirement is a hard dependency we cannot control. Building around a single external approval is unacceptable risk for our product roadmap. The correct strategy is to build the custom canvas (which we control entirely) and submit the EDM application in parallel.

The custom canvas investment is not wasted even if EDM is approved — it provides:
1. Provider-independence (works with Printify, Printful, or any future fulfillment partner)
2. Full customizability (we can implement SKAPARA-specific features like brand mark injection, EU GPSR compliance indicators, and AI-generated design injection at the canvas layer level)
3. Control over the data format (Fabric.js JSON stored in our `design_compositions` table)

**Immediate actions**:
1. Start Phases 1–3 of the custom canvas build (this section's roadmap)
2. Submit EDM enterprise application at `printful.com/enterprise/embedded-design-maker` with SKAPARA business case (EU market, 3 languages, POD focus)
3. If EDM approved before Phase 3 is complete: implement `PrintfulEDMStudio.tsx` in parallel
4. If EDM approved after Phase 3: evaluate whether EDM adds enough value to justify two code paths

---

## 2. Canvas Library Decision: Fabric.js vs Konva.js

### The Two Candidates

Both research documents were consulted. There is a genuine disagreement between them:
- `design-generator-architecture.md` recommends **Fabric.js**
- `design-personalization-research.md` recommends **Konva.js (react-konva)**

This section resolves that conflict with a definitive recommendation backed by evidence.

### Comparison Matrix (SKAPARA-Specific)

| Criterion | Fabric.js v6 | Konva.js + react-konva | Winner |
|---|---|---|---|
| React integration | Manual (useEffect + fabricRef.current) | Native declarative JSX (`<Stage><Layer><Text>`) | Konva |
| TypeScript support | Full in v6, `@types/fabric` for v5 | Full native types | Tie |
| Bundle size | ~300KB minified | ~150KB minified | Konva |
| Serialization (save/load) | Built-in `canvas.toJSON()` / `loadFromJSON()` | Manual JSON | Fabric |
| Text effects (shadow, stroke) | Built-in `fabric.Shadow`, stroke property | Manual Canvas API | Fabric |
| SVG import/export | Built-in `loadSVGFromURL()`, bidirectional | Limited (no SVG export) | Fabric |
| Object manipulation (drag/resize/rotate) | Built-in transform controls | `<Transformer>` component | Tie |
| Layer management | Manual (object stack) | Built-in multi-layer architecture | Konva |
| 300 DPI export | Tricky — `multiplier` param, data URI limits | Reliable — `stage.toDataURL({ pixelRatio: 4.17 })` | Konva |
| Next.js SSR | Requires `ssr: false` + webpack config for `utf-8-validate`, `bufferutil` | Requires only `ssr: false` | Konva |
| Mobile performance (complex scenes) | Moderate (single canvas) | Better (dirty region redraw) | Konva |
| POD industry adoption | CustomInk, early Printful editor | Polotno SDK (powers many POD tools) | Tie |
| Community/stars | 25k+ GitHub stars, very mature | 10k+ stars, active | Fabric |
| Inline text editing | Built-in `IText` (double-click to edit) | No inline edit — requires external input | Fabric |
| Image filters | 20+ built-in | Basic | Fabric |
| Curved text | Via opentype.js (manual) | Via opentype.js (manual) | Tie |
| Gradient fills on text | Built-in `fabric.Gradient` | Manual Canvas API | Fabric |
| Pattern fills on text | Built-in `fabric.Pattern` | Manual Canvas API | Fabric |

### Bundle Size Impact on Next.js

Both libraries are client-only (browser Canvas API). They must be loaded via `next/dynamic` with `ssr: false`.

**Fabric.js**: ~300KB minified + ~50KB for opentype.js = ~350KB total added to the design editor chunk.
**Konva.js + react-konva**: ~150KB minified + ~50KB opentype.js = ~200KB total.

With dynamic import, this chunk is only loaded when the user opens the design studio. The bundle impact is negligible for a design editor flow — users navigating to this feature are already committed to a richer experience. Neither library's size is a disqualifier.

**For comparison**: A single fal.ai-generated PNG is 200–500KB. Fabric.js is smaller than one AI image.

### SSR Compatibility

Neither library works with Next.js SSR — both require `window` and the Canvas API. Both require `next/dynamic` with `ssr: false`:

```tsx
// Works identically for both libraries
const DesignEditor = dynamic(
  () => import('@/components/design-editor/DesignEditor'),
  { ssr: false, loading: () => <DesignEditorSkeleton /> }
)
```

Fabric.js additionally requires webpack configuration in `next.config.ts` to externalize `canvas`, `utf-8-validate`, and `bufferutil`. This is a known issue with Fabric.js v6 in Next.js environments and adds a small amount of configuration complexity.

### Mobile Performance

Konva.js has a genuine advantage on mobile: its layer-based dirty rectangle redraws only repaint changed areas, not the entire canvas. This matters when a user is dragging a text object — Konva redraws only the changed region, Fabric.js redraws the entire canvas.

For our use case (typically 3–8 objects on canvas: a product background, 1–2 text layers, optional AI image layer, optional brand mark), this difference is minor. Both libraries perform acceptably on modern mid-range phones (iPhone SE 3, Pixel 7a) for this object count.

### Final Decision: Fabric.js v6

**Rationale**:

The decisive factors for a POD design editor are:
1. **Inline text editing**: Fabric's `IText` allows double-click-to-edit directly on the canvas. With Konva, text editing requires managing an external DOM input and syncing it to the canvas — significantly more complex to implement correctly, especially for multi-line text.
2. **Built-in text effects**: Fabric.js has native support for `shadow`, `stroke`, `strokeWidth`, `textAlign`, `charSpacing`, `lineHeight`, gradient fills, and pattern fills on text objects. These are Phase 2 features that are much simpler to build with Fabric.
3. **Serialization**: `canvas.toJSON()` / `loadFromJSON()` are essential for saving and loading user designs. Fabric's built-in serialization handles all object types, including custom properties marked with `excludeFromExport`. Konva requires manual serialization code.
4. **SVG import**: Fabric's `loadSVGFromURL()` is critical for importing brand mark SVGs and any user-uploaded SVG files.

The webpack configuration requirement (one extra `next.config.ts` entry) is a small one-time cost that does not outweigh Fabric's superior text and serialization capabilities.

**Decision**: Fabric.js v6

```bash
# Install commands
npm install fabric@^6.0.0 opentype.js@^1.3.4
npm install -D @types/opentype.js
```

```typescript
// next.config.ts — required for Fabric.js
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.externals = config.externals || {}
      // Fabric.js uses canvas for server-side, externalize to prevent bundling issues
      config.externals['canvas'] = 'canvas'
    }
    return config
  },
}
```

---

## 3. Component Architecture

### 3.1 New File Structure

```
frontend/src/components/design-editor/
├── DesignEditor.tsx                     # Main entry point — replaces DesignStudio.tsx
│                                        # 280 lines estimated
├── DesignCanvas.tsx                     # Fabric.js canvas wrapper (core engine)
│                                        # 350 lines estimated
├── DesignToolbar.tsx                    # Top toolbar: tools, undo/redo, zoom, grid toggle
│                                        # 180 lines estimated
├── DesignLayerPanel.tsx                 # Layer list with visibility/lock/reorder
│                                        # 220 lines estimated
├── DesignPropertyPanel.tsx              # Right sidebar: properties of selected object
│                                        # 350 lines estimated
├── DesignTextEffectsPanel.tsx           # Sub-panel: shadow, outline, gradient, curve
│                                        # 280 lines estimated
├── DesignTemplateGallery.tsx            # Template browser with category filters
│                                        # 240 lines estimated
├── DesignColorPicker.tsx                # Enhanced color picker (swatches + HSL + palette gen)
│                                        # 200 lines estimated
├── DesignPositionTabs.tsx               # Multi-position tab selector (front/back/sleeve/neck)
│                                        # 160 lines estimated
├── DesignMockupPreview.tsx              # Printful 3D mockup preview (async + polling)
│                                        # 200 lines estimated
├── DesignExportButton.tsx               # Export/apply-to-cart CTA with progress state
│                                        # 140 lines estimated
├── PrintfulEDMStudio.tsx                # (Phase 3/EDM only) Iframe wrapper for Printful EDM
│                                        # 180 lines estimated
│
├── hooks/
│   ├── useDesignCanvas.ts               # Fabric.js canvas init, object management
│   │                                    # 180 lines estimated
│   ├── useDesignHistory.ts              # Undo/redo stack (command pattern)
│   │                                    # 120 lines estimated
│   ├── useDesignExport.ts               # Canvas export → server Sharp → Printful upload
│   │                                    # 160 lines estimated
│   ├── useDesignTemplates.ts            # Template loading, parametrization, application
│   │                                    # 120 lines estimated
│   ├── usePrintfulMockup.ts             # Mockup API polling logic + caching
│   │                                    # 140 lines estimated
│   └── useDesignFonts.ts                # Dynamic font loading (Google Fonts + local)
│                                        # 100 lines estimated
│
└── types/
    └── design-editor.ts                 # All TypeScript interfaces for this module
                                         # 180 lines estimated

frontend/src/lib/
├── design-canvas-utils.ts               # Helpers: snap-to-grid, alignment guides, boundary check
│                                        # 140 lines estimated
├── design-text-effects.ts               # Text effect algorithms: curved text, warp, glow
│                                        # 220 lines estimated
├── design-template-engine.ts            # Template parametrization ({{USER_TEXT}} replacement)
│                                        # 100 lines estimated
├── design-color-utils.ts                # Palette generation (HSL), WCAG contrast, color extraction
│                                        # 120 lines estimated
├── design-export.ts                     # Production export pipeline (replaces composition-renderer)
│                                        # 200 lines estimated
├── printful-mockup.ts                   # Printful Mockup API client (v2/mockup-tasks)
│                                        # 160 lines estimated
├── printful-edm.ts                      # (Phase 3/EDM only) EDM config, nonce management
│                                        # 120 lines estimated
└── print-areas.ts                       # EXISTING — extend with Printful product dimensions

frontend/src/app/api/
├── designs/
│   ├── export/route.ts                  # NEW: client canvas PNG → Sharp production render → upload
│   ├── templates/route.ts               # NEW: list/get serialized Fabric.js JSON templates
│   ├── ai-generate/route.ts             # EXISTING: fal.ai/Gemini generation (keep as-is)
│   ├── personalize/route.ts             # EXISTING: server-side text preview (keep, deprecate later)
│   ├── preview-text/route.ts            # EXISTING: fast text preview (keep, deprecate later)
│   ├── compose/route.ts                 # EXISTING: composition from layers (keep, refactor later)
│   └── history/route.ts                 # EXISTING: user design history (keep as-is)
│
└── edm/
    └── nonce/route.ts                   # NEW (Phase 3/EDM): server-side nonce generation
```

### 3.2 Component Prop Interfaces

#### `DesignEditor`

The top-level replacement for `DesignStudio.tsx`. Opens as `Dialog` on desktop, `Sheet` on mobile. This is the public API that product pages call.

```typescript
interface DesignEditorProps {
  // Product context
  productId: string
  productTitle: string
  productImage?: string           // Product thumbnail (initial display)
  category?: string               // For print area lookup
  productColor?: string           // Current variant color
  printfulProductId?: number      // Printful catalog product ID (for mockup templates)

  // Available positions from Printful catalog
  availablePositions?: PrintfulPlacement[]  // e.g. ['front', 'back', 'left_sleeve']

  // Callbacks
  onApply?: (result: DesignApplyResult) => void
  onClose?: () => void

  // Display
  trigger?: React.ReactNode       // Custom trigger button
  mode?: 'canvas' | 'edm'        // 'canvas' default; 'edm' if EDM approved
}

interface DesignApplyResult {
  type: 'canvas' | 'personalization' | 'composition' | 'edm_template'
  // For canvas: JSON export of Fabric.js state per position
  canvasData?: Record<string, object>
  // For legacy personalization (backwards compat during transition)
  personalizationId?: string
  // For EDM: template ID from Printful
  templateId?: string
  // Preview URL for cart display (generated client-side or server-side)
  previewUrl?: string
}
```

**Estimated lines**: 280
**Replaces**: `DesignStudio.tsx` (415 lines)

---

#### `DesignCanvas`

The core Fabric.js canvas wrapper. This is a client component that manages the Fabric.js canvas lifecycle. It does not render any UI controls — it is a pure canvas engine exposed via a ref-forwarded handle.

```typescript
interface DesignCanvasProps {
  // Canvas dimensions (display resolution, not print resolution)
  width: number
  height: number

  // Print area boundary (dashed guide, excludeFromExport)
  printArea: PrintArea  // { x, y, w, h } from print-areas.ts

  // Product photography background (from Printful mockup-templates endpoint)
  templateImageUrl?: string

  // Initial state (for loading saved designs)
  initialJson?: object

  // Show/hide helpers
  showGrid?: boolean
  showSafeZone?: boolean          // 10% inset from print area boundary

  // Callbacks
  onStateChange?: (json: object) => void
  onObjectSelected?: (obj: FabricObjectInfo | null) => void
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
}

// Imperative handle (forwarded via useImperativeHandle)
interface DesignCanvasHandle {
  addText: (text: string, options?: TextObjectOptions) => void
  addImage: (url: string) => Promise<void>
  addShape: (type: 'rect' | 'circle' | 'triangle', options?: ShapeOptions) => void
  updateSelectedObject: (props: Partial<FabricObjectOptions>) => void
  removeSelected: () => void
  undo: () => void
  redo: () => void
  setZoom: (zoom: number) => void
  exportPNG: (multiplier?: number) => string    // returns data URL
  exportJSON: () => object
  loadFromJSON: (json: object) => Promise<void>
  clear: () => void
  bringForward: () => void
  sendBackward: () => void
  getObjects: () => FabricObjectInfo[]
  selectObjectById: (id: string) => void
}
```

**Estimated lines**: 350

---

#### `DesignToolbar`

Top horizontal toolbar. Uses shadcn `Button`, `Separator`, `Tooltip` (from `@/components/ui/tooltip`).

```typescript
interface DesignToolbarProps {
  activeTool: 'select' | 'text' | 'image' | 'shape'
  onToolChange: (tool: 'select' | 'text' | 'image' | 'shape') => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomChange: (zoom: number) => void
  showGrid: boolean
  onToggleGrid: () => void
  showSafeZone: boolean
  onToggleSafeZone: () => void
}
```

**Estimated lines**: 180

---

#### `DesignLayerPanel`

Left sidebar panel showing all canvas objects as a draggable layer list. Each layer has: eye icon (visibility), lock icon (lock/unlock), label (auto-named: "Text 1", "Image 1", etc.), up/down controls. Uses `@dnd-kit/core` for drag-to-reorder.

```typescript
interface DesignLayerPanelProps {
  layers: FabricObjectInfo[]          // Ordered list (top = highest z-index first)
  selectedId: string | null
  onSelectLayer: (id: string) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onDelete: (id: string) => void
}

interface FabricObjectInfo {
  id: string                          // fabric object's custom 'id' property
  type: 'text' | 'image' | 'shape' | 'group'
  label: string                       // Display name
  visible: boolean
  locked: boolean
  zIndex: number
}
```

**Estimated lines**: 220

---

#### `DesignPropertyPanel`

Right sidebar. Shows different controls based on `selectedObjectType`. For text: font, size, color, effects. For image: opacity, filters. For shape: fill, stroke. For nothing selected: canvas settings (background color).

```typescript
interface DesignPropertyPanelProps {
  selectedObject: SelectedObjectProps | null
  onUpdateProps: (props: Partial<FabricObjectOptions>) => void
  onOpenTextEffects: () => void       // Opens DesignTextEffectsPanel
  productColor?: string               // For contrast warning
}

type SelectedObjectProps =
  | { type: 'text'; fontFamily: string; fontSize: number; fill: string;
      stroke: string; strokeWidth: number; textAlign: string;
      charSpacing: number; lineHeight: number;
      shadow: FabricShadowProps | null; opacity: number;
      left: number; top: number; angle: number; }
  | { type: 'image'; opacity: number; left: number; top: number;
      scaleX: number; scaleY: number; angle: number; }
  | { type: 'shape'; fill: string; stroke: string; strokeWidth: number;
      opacity: number; left: number; top: number; angle: number; }
```

**Estimated lines**: 350

---

#### `DesignTextEffectsPanel`

Sub-panel within `DesignPropertyPanel`, or as a separate popover. Houses complex text effects that don't fit in the main panel.

```typescript
interface DesignTextEffectsPanelProps {
  // Current effect states
  shadowEnabled: boolean
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number

  outlineEnabled: boolean
  outlineColor: string
  outlineWidth: number

  gradientEnabled: boolean
  gradientColors: [string, string]
  gradientDirection: 'horizontal' | 'vertical' | 'diagonal'

  curveEnabled: boolean
  curveRadius: number    // positive = arc up, negative = arc down
  curveAngle: number     // spread angle in degrees

  // Update handlers
  onShadowChange: (props: ShadowProps) => void
  onOutlineChange: (props: OutlineProps) => void
  onGradientChange: (props: GradientProps) => void
  onCurveChange: (props: CurveProps) => void
}
```

**Estimated lines**: 280

---

#### `DesignTemplateGallery`

Browsable grid of parametric templates, categorized by style (Typography, Vintage, Minimalist, Badge, etc.) and product type. Each template is a Fabric.js JSON stored as a static file under `public/design-templates/` or fetched from `/api/designs/templates`.

```typescript
interface DesignTemplateGalleryProps {
  productType?: string              // Filter templates by product type
  onSelectTemplate: (templateId: string) => void
  selectedTemplateId?: string
}

interface DesignTemplate {
  id: string
  name: Record<string, string>     // i18n names
  category: 'typography' | 'vintage' | 'minimalist' | 'badge' | 'meme' | 'brand'
  productTypes: string[]           // Compatible product types
  thumbnail: string                // Preview image path
  fabricJson: object               // Serialized Fabric.js canvas state
  parameters: TemplateParameter[]  // Editable slots
}

interface TemplateParameter {
  key: string                      // e.g. 'USER_TEXT', 'PRIMARY_COLOR'
  type: 'text' | 'color' | 'font'
  defaultValue: string
  label: Record<string, string>
}
```

**Estimated lines**: 240

---

#### `DesignMockupPreview`

Displays a real Printful product mockup once the design is applied. Shows a placeholder (client-side canvas composite on template image) immediately, then overlays the Printful mockup when the async task completes.

```typescript
interface DesignMockupPreviewProps {
  // Client-side preview (immediate)
  previewDataUrl?: string           // Canvas exportPNG() result

  // Printful async mockup
  printfulProductId?: number        // Triggers mockup task creation
  designFileUrl?: string            // Uploaded PNG URL for mockup task
  variantId?: number                // Catalog variant for color-accurate mockup
  placement?: string                // 'front', 'back', etc.

  // Display
  showPositionLabel?: boolean
}

// Internal states:
// 'client'    — showing client canvas export (instant)
// 'loading'   — Printful task submitted, polling
// 'printful'  — Printful mockup loaded (replace client preview)
// 'error'     — mockup task failed, keep showing client preview
```

**Estimated lines**: 200

---

#### `DesignPositionTabs`

Tab bar for multi-position editing. Each tab represents a print position (front, back, left_sleeve, right_sleeve, neck_outer). Only shows tabs for positions available on the product (from `availablePositions` prop).

```typescript
interface DesignPositionTabsProps {
  positions: PrintfulPlacement[]
  activePosition: PrintfulPlacement
  onPositionChange: (position: PrintfulPlacement) => void
  // Per-position design status (for "has content" indicator)
  positionStatus: Record<PrintfulPlacement, 'empty' | 'has_design'>
}

type PrintfulPlacement =
  | 'front'
  | 'back'
  | 'left_sleeve'
  | 'right_sleeve'
  | 'neck_outer'
  | 'embroidery_chest_center'
  | 'embroidery_chest_left'
```

**Estimated lines**: 160

---

### 3.3 State Management: Zustand Store

React Context alone is insufficient for a design editor — updates to canvas state trigger re-renders throughout the tree. Zustand provides:
- Selective subscriptions (components subscribe only to the slice they need)
- Middleware for immer (immutable updates), devtools integration
- No Provider boilerplate — store is a module-level singleton

**Why Zustand over React Context**: The design editor has frequent state updates (every canvas object:modified event). Context re-renders all consumers on every update. With 6+ components subscribed to design state, Context would cause cascading re-renders on every drag operation. Zustand's fine-grained subscriptions prevent this.

**Why Zustand over Redux**: Redux requires significantly more boilerplate (actions, reducers, slices) for the same functionality. Zustand is 8x smaller (~1.1KB vs ~8KB), has first-class TypeScript support, and is simpler to test.

```typescript
// src/lib/design-editor-store.ts

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface DesignEditorState {
  // Per-position canvas JSON state
  canvasStates: Record<PrintfulPlacement, object | null>
  activePosition: PrintfulPlacement

  // History (per position)
  undoStacks: Record<PrintfulPlacement, string[]>
  redoStacks: Record<PrintfulPlacement, string[]>

  // Active selection
  selectedObjectId: string | null
  selectedObjectProps: SelectedObjectProps | null

  // Canvas UI state
  zoom: number
  showGrid: boolean
  showSafeZone: boolean
  activeTool: 'select' | 'text' | 'image' | 'shape'

  // Product context
  productId: string
  productType: string
  availablePositions: PrintfulPlacement[]
  printfulProductId?: number

  // Mockup state
  mockupTaskId: string | null
  mockupStatus: 'idle' | 'pending' | 'completed' | 'error'
  mockupUrls: Record<PrintfulPlacement, string | null>

  // Export state
  exportStatus: 'idle' | 'exporting' | 'uploading' | 'done' | 'error'
  exportedFileUrls: Record<PrintfulPlacement, string | null>

  // Actions
  setActivePosition: (position: PrintfulPlacement) => void
  saveCanvasState: (position: PrintfulPlacement, json: object) => void
  pushUndoState: (position: PrintfulPlacement, json: string) => void
  undo: () => void
  redo: () => void
  setSelectedObject: (id: string | null, props: SelectedObjectProps | null) => void
  setZoom: (zoom: number) => void
  toggleGrid: () => void
  toggleSafeZone: () => void
  setActiveTool: (tool: 'select' | 'text' | 'image' | 'shape') => void
  setMockupState: (taskId: string, status: string, urls?: Record<string, string>) => void
  setExportState: (status: string, urls?: Record<string, string>) => void
  reset: (productId: string, productType: string, positions: PrintfulPlacement[]) => void
}
```

**Install command**: `npm install zustand` (zustand is already a common Next.js dependency; verify it is not already in package.json before adding)

---

### 3.4 How Existing Components Are Replaced or Wrapped

| Current File | Fate | Reasoning |
|---|---|---|
| `DesignStudio.tsx` (415 lines) | **Replaced** by `DesignEditor.tsx` | Same Dialog/Sheet responsive pattern, but orchestrates new canvas components instead of old tabs |
| `ProductPersonalizer.tsx` (1052 lines) | **Deprecated, kept temporarily** | Phase 1 replaces visual preview. Full deprecation in Phase 3. |
| `AIPromptEditor.tsx` | **Kept, integrated** | The prompt editor UI is unchanged. Wired to inject AI result into canvas as an image layer. |
| `StyleSelector.tsx` | **Kept, integrated** | Style presets remain useful as template suggestions. Wired to `loadTemplate` action. |
| `AIPreviewCanvas.tsx` | **Replaced** by `DesignCanvas.tsx` | The CSS overlay preview is eliminated; the canvas is the preview. |
| `AuthGateOverlay.tsx` | **Kept, reused** | Auth gate for AI tab and template gallery still needed. |
| `GenerationCostBadge.tsx` | **Kept, reused** | AI budget tracking unchanged. |
| `DesignHistoryPanel.tsx` | **Replaced** by `DesignLayerPanel.tsx` | New layer panel also shows history; separate history panel is redundant. |

---

## 4. Feature Roadmap — Phased

### Phase 1: Canvas Foundation (MVP — Replaces Current DesignStudio)

**Goal**: Replace the CSS overlay preview with a real Fabric.js canvas. Users get drag/resize/rotate and basic text/image/AI layers. Export pipeline is unchanged (canvas → server Sharp → Supabase Storage).

**Duration estimate**: 4 weeks

**Exact features**:
- Fabric.js canvas replacing `AIPreviewCanvas.tsx` CSS overlay
- Drag-and-drop positioning of text and image objects (free placement)
- Resize and rotate handles (Fabric.js built-in transform controls)
- Double-click inline text editing on canvas (`fabric.IText`)
- Basic text properties: font family (12 existing fonts), font size (continuous slider replaces S/M/L), text color (16 swatches + hex input), text alignment (L/C/R)
- Image layer: upload PNG/JPEG/WebP (5MB max, existing validation) → placed on canvas, drag/resize/rotate
- AI image layer: AI generation result injected as a canvas image layer (replaces static CSS overlay)
- Undo/redo (history stack, max 30 states, per the `useDesignHistory` hook)
- Print area boundary visualization (dashed rect, `excludeFromExport: true`)
- Safe zone visualization (10% inset, toggleable)
- Grid overlay (toggleable, 20px cells)
- Canvas background: Printful mockup-templates image loaded as non-selectable background layer (replaces CSS product photo)
- Export: `canvas.toDataURL('image/png', 1.0)` → POST to `/api/designs/export` → server Sharp re-render at production resolution → upload to Supabase Storage → return URL

**Components to create**:
- `DesignEditor.tsx` — replaces `DesignStudio.tsx`
- `DesignCanvas.tsx` — Fabric.js wrapper with imperative handle
- `DesignToolbar.tsx` — text/image/select/undo-redo tools
- `DesignPropertyPanel.tsx` — font/size/color controls for selected text

**Components to modify**:
- `AIPromptEditor.tsx` — connect result injection to `DesignCanvas.addImage()`
- `ProductDetailClient.tsx` — swap `DesignStudio` import to `DesignEditor`

**New hooks**:
- `useDesignCanvas.ts` — canvas init, lifecycle, object management
- `useDesignHistory.ts` — undo/redo stack

**New lib files**:
- `design-canvas-utils.ts` — boundary validation, snap helpers
- `design-export.ts` — wraps `/api/designs/export` call with progress state

**New API routes**:
- `src/app/api/designs/export/route.ts` — receives base64 PNG + composition metadata, re-renders at production resolution, uploads to Supabase, returns URL

**Libraries to install**:
- `fabric@^6.0.0`
- `opentype.js@^1.3.4` (deferred to Phase 2, but install now)

**Dependencies on other migration sections**:
- **Requires Section 3 (Printful API Client)**: The `GET /v2/catalog-products/{id}/mockup-templates` endpoint is used to load the product photography background image and print area coordinates. If Section 3 is not complete, fall back to `CSS_PREVIEW_ZONES` from `print-areas.ts`.
- **No dependency on Section 4 (Product Catalog)**: Phase 1 works with any product.

**Backwards compatibility**:
- `ProductPersonalizer.tsx` is NOT deleted. It remains importable for the `(focused)/checkout` flow that may still reference it.
- The `onApply` callback signature of `DesignEditor` is backwards compatible with `DesignStudio`'s interface.
- Existing `design_sessions`, `ai_generations`, and `design_compositions` DB records are not touched.

---

### Phase 2: Text Effects (Shadow, Outline, Gradient, Curve)

**Goal**: Elevate text quality to compete with Kittl's key differentiators. These are the features that make POD text designs look professional.

**Duration estimate**: 3 weeks

**Exact features**:
- **Drop shadow**: Color, blur (0–40px), offset X, offset Y. Fabric.js built-in `new fabric.Shadow({ ... })`.
- **Outline/stroke**: Color, width (0–20px). Fabric.js built-in `stroke` + `strokeWidth`. Use the double-render technique (stroke layer + fill layer grouped) for thick outlines that don't clip.
- **Gradient fill**: Linear gradient on text fill. Horizontal, vertical, or diagonal direction. Two-color stop picker. `new fabric.Gradient({ type: 'linear', ... })`.
- **Neon glow**: Multi-pass shadow (outer glow). Preset colors: green `#10B981`, purple `#A78BFA`, red `#EF4444`, cyan `#40ACCC`. Implemented as a composite shadow effect.
- **Letter spacing**: `charSpacing` property slider (-200 to +500, in 1/1000 em units).
- **Line height**: `lineHeight` property slider (0.8 to 2.5).
- **Curved text**: Arc up, arc down, circle. Implemented via opentype.js glyph-path extraction + per-glyph rotation placement. Radius slider (-400 to +400, where negative = arc down). The curved text result is added to canvas as a `fabric.Group` of `fabric.Path` objects.
- **Font expansion**: 12 → 30 fonts. Add 18 more fonts loaded via Google Fonts API on demand. Font files already in `/public/fonts/` for the original 12; new fonts loaded dynamically via `document.fonts.load()`.
- **Font preview in selector**: Each option in the font dropdown renders the font family name in its own face.
- **WCAG contrast warning**: When selected text color has < 3:1 contrast against product color, show a warning badge in `DesignPropertyPanel`.

**Components to create**:
- `DesignTextEffectsPanel.tsx` — shadow/outline/gradient/curve controls

**Components to modify**:
- `DesignPropertyPanel.tsx` — add "Effects" section with open-panel button
- `DesignCanvas.tsx` — handle curved text (addCurvedText method)

**New hooks**:
- `useDesignFonts.ts` — dynamic font loading from Google Fonts + /public/fonts

**New lib files**:
- `design-text-effects.ts` — curved text algorithm (opentype.js), neon glow composite, outline group
- `design-color-utils.ts` — palette generation (HSL rotation), WCAG contrast, color extraction from canvas

**Libraries to install**: None new (opentype.js installed in Phase 1)

**Dependencies**: Requires Phase 1 complete. No dependency on Printful migration sections.

---

### Phase 3: Template Gallery + Non-AI Generators

**Goal**: Provide starting points so users do not face a blank canvas. POD research confirms template-first workflows convert significantly better than blank canvas.

**Duration estimate**: 3 weeks

**Exact features**:
- **Template gallery**: 20 initial parametric Fabric.js JSON templates stored as static files under `public/design-templates/`. Categories: Typography (5 templates), Vintage (3), Minimalist (4), Badge/Emblem (3), Meme-style (3), SKAPARA Brand (2).
- **Template parameters**: Each template has 2–4 editable slots (`{{USER_TEXT}}`, `{{PRIMARY_COLOR}}`, `{{FONT_FAMILY}}`, `{{SECONDARY_TEXT}}`). The `design-template-engine.ts` handles token replacement before `canvas.loadFromJSON()`.
- **Template thumbnails**: Static preview images at 200×200px in `/public/design-template-thumbnails/`.
- **Template search**: Simple client-side filter by category and keyword.
- **Color palette generator**: From the `DesignColorPicker.tsx`, "Generate Palette" button produces 4–5 harmonious colors using HSL rotation (complementary, analogous, triadic). Uses `design-color-utils.ts`.
- **Advanced color picker**: Replace 16-swatch grid with a full HSL color wheel (using `@uiw/react-color-wheel` or a custom canvas implementation — 15KB component). Keeps 16 quick-access swatches as a "Recent" row.
- **Shape library**: Basic geometric shapes (rectangle, circle, triangle, line, star) added to canvas via `DesignToolbar`. These are `fabric.Rect`, `fabric.Circle`, `fabric.Triangle` objects with configurable fill/stroke.
- **Duplicate element**: Button in `DesignLayerPanel` to clone selected object with offset.
- **Group/ungroup**: Group multiple selected objects into `fabric.Group`.

**Components to create**:
- `DesignTemplateGallery.tsx`
- `DesignColorPicker.tsx` (enhanced)

**Components to modify**:
- `DesignToolbar.tsx` — add Shape button and shape type picker
- `DesignLayerPanel.tsx` — add Duplicate and Group buttons
- `DesignEditor.tsx` — add Templates tab

**New API routes**:
- `src/app/api/designs/templates/route.ts` — returns list of available templates (can be static JSON initially)

**New lib files**:
- `design-template-engine.ts`

**Static assets to create**:
- `public/design-templates/` — 20 Fabric.js JSON files
- `public/design-template-thumbnails/` — 20 PNG thumbnails

**Libraries to install**:
- `@uiw/react-color` — color picker components (wheel, swatch, hex, hsl). ~20KB. Alternative: build a minimal custom color wheel.

**Dependencies**: Requires Phase 1 and Phase 2 complete.

---

### Phase 4: Multi-Position Editing + Printful Mockup Integration

**Goal**: Allow customers to design front AND back (and sleeves) in one session. Replace client-side canvas composite with photorealistic Printful mockups for the "before checkout" preview.

**Duration estimate**: 3 weeks

**Exact features**:
- **Multi-position tabs**: `DesignPositionTabs.tsx` renders one tab per available Printful placement. Each position maintains its own Fabric.js canvas JSON in the Zustand store.
- **Position switching**: Canvas state is serialized to JSON before switching tabs, loaded from JSON when returning. No state loss on tab switch.
- **Position-specific print areas**: Each position has its own dimensions from `GET /v2/catalog-products/{id}/mockup-templates`. These replace the hardcoded `PRINT_AREAS` dict for products with Printful mockup template data.
- **Position-specific background images**: Each tab loads the product photography template image specific to that placement from Printful's `image_url` in mockup-templates response.
- **Printful Mockup Generator integration** (see Section 5 for full details):
  - After user clicks "Preview on Product", trigger `POST /api/mockups/generate`
  - Show client-side canvas composite immediately
  - When Printful task completes (polled at 2s intervals, max 30s), overlay the photorealistic mockup in `DesignMockupPreview.tsx`
- **Brand mark auto-injection**: On canvas init for each position, optionally pre-place the SKAPARA S mark as a small, locked, semi-transparent layer at a predefined corner position (configurable per product type).
- **Print area boundary warning**: If any canvas object extends outside the print area, show a warning badge on that position tab.

**Components to create**:
- `DesignPositionTabs.tsx`
- `DesignMockupPreview.tsx`

**Components to modify**:
- `DesignCanvas.tsx` — accept `templateImageUrl` per position, dynamic print area dimensions
- `DesignEditor.tsx` — add position tabs above canvas
- `DesignExportButton.tsx` — export all positions in one call

**New hooks**:
- `usePrintfulMockup.ts`

**New API routes**:
- `src/app/api/mockups/generate/route.ts` — POST to Printful `/v2/mockup-tasks`, returns task ID
- `src/app/api/mockups/[taskId]/route.ts` — GET, polls Printful `/v2/mockup-tasks/{id}`, returns status + URLs
- (Optional) `src/app/api/webhooks/printful/mockup/route.ts` — Printful `mockup_task_finished` webhook (faster than polling for production)

**New lib files**:
- `printful-mockup.ts`

**Dependencies**:
- **Requires Section 3 (Printful API Client)**: The mockup templates and mockup task endpoints require an authenticated Printful API client.
- **Requires Phase 1–3** complete.

---

### Phase 5: Advanced (Layers Panel, Snap-to-Grid, Collaborative)

**Goal**: Professional-grade features for power users and SKAPARA's own design workflow (using the design editor to create and publish catalog products, not just customer personalization).

**Duration estimate**: 5–6 weeks

**Exact features**:
- **Full layer panel**: `DesignLayerPanel.tsx` with drag-to-reorder via `@dnd-kit/core`. Visibility toggle, lock toggle, rename on double-click, delete button, duplicate button.
- **Alignment guides**: When dragging objects, red/blue snap lines appear when aligned with center axes or other objects' edges. Implemented in `design-canvas-utils.ts` using Fabric.js `object:moving` event.
- **Snap-to-grid**: Objects snap to 10px grid when moved with grid visible.
- **Snap-to-print-area**: Objects snap to print area boundaries.
- **SVG import**: Drag and drop SVG file → `fabric.loadSVGFromURL()` → placed on canvas as a group of `fabric.Path` objects, fully editable.
- **Image filters** (on image layers): Brightness, contrast, saturation, grayscale, blur. Fabric.js has 20+ built-in filters via `fabric.Image.filters.*`.
- **Background removal in canvas**: "Remove BG" button on selected image layer → POST to `/api/rembg` (existing sidecar) → replace image on canvas with transparent result.
- **Clipping masks**: Apply a shape as a clipping mask to an image layer (`fabric.Image.clipPath`).
- **Warp text effects**: Wave, flag, inflate, fisheye using `warpjs`. Each warp type generates a `fabric.Path` group from the text SVG paths.
- **Vintage/distressed effect**: Canvas blend mode overlay of a noise/grunge texture on text (applied as a `fabric.Image` with `multiply` blend mode in a `fabric.Group` with the text).
- **Bulk design**: "Apply this design to multiple products" — opens a product picker, creates a design session for each product with the current canvas state.
- **Save/load from library**: Users can name and save designs to their account (`design_compositions` table), then load them in future sessions.
- **Design sharing**: Generate a read-only share URL (`/designs/share/[token]`) that renders the canvas state.

**Components to create**:
- Full implementation of `DesignLayerPanel.tsx` (Phase 1 has a minimal version)

**Components to modify**:
- `DesignCanvas.tsx` — snap guides, alignment lines, SVG import, filters
- `DesignPropertyPanel.tsx` — image filter controls
- `DesignTextEffectsPanel.tsx` — warp effects, vintage effect

**New lib files**:
- Full implementation of `design-canvas-utils.ts` (snap/align algorithms)

**Libraries to install**:
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-to-reorder layer panel
- `warpjs` — SVG text warping (lazy loaded on text effects panel open)

**Dependencies**:
- Requires Phases 1–4 complete.
- Collaborative editing (if pursued): Requires Supabase Realtime setup (out of scope for this plan, tracked separately).

---

## 5. Printful Mockup Generator Integration

### Overview

The Printful Mockup Generator API (`/v2/mockup-tasks`) generates photorealistic product mockups from design files. It is an async, task-based API. For our design editor, it serves two purposes:
1. **Real-time product preview** — after the user finalizes their design and clicks "Preview on Product"
2. **Cart thumbnail** — the mockup URL is stored with the cart item for display throughout checkout

### API Flow

```
User clicks "Preview on Product"
         |
         v
Client: canvas.toDataURL('image/png', 1.0)
         |
         v
POST /api/designs/export
  ├── Sharp re-render at production resolution (e.g. 3600×4800 for DTG tshirt)
  ├── Upload to Supabase Storage → public URL: https://[supabase].storage.../design-123.png
  └── Returns: { fileUrl: "...", position: "front" }
         |
         v
POST /api/mockups/generate
  Body: {
    printfulProductId: 438,          // Printful catalog product ID
    variantId: 4011,                 // Current selected variant
    placement: "front",
    fileUrl: "https://[supabase].../design-123.png"
  }
         |
         v
Server: POST https://api.printful.com/v2/mockup-tasks
  Body: {
    format: "png",
    catalog_product_id: 438,
    catalog_variant_ids: [4011],
    mockup_style_ids: [1, 2],        // First two styles (front view + lifestyle)
    placements: [{
      placement: "front",
      technique: "dtg",
      layers: [{
        type: "file",
        url: "https://[supabase].../design-123.png"
      }]
    }]
  }
  Response: { id: "task_abc123", status: "pending" }
         |
         v
Client: Poll GET /api/mockups/task_abc123 every 2 seconds
  Client shows: client-side canvas composite as immediate preview
         |
         v
         ... Printful generates mockup (typically 5–15 seconds) ...
         |
         v
GET /api/mockups/task_abc123
  Server proxies: GET https://api.printful.com/v2/mockup-tasks/task_abc123
  Response: {
    status: "completed",
    catalog_variant_mockups: [{
      catalog_variant_id: 4011,
      mockups: [{
        mockup_style_id: 1,
        url: "https://files.cdn.printful.com/mockup/..."
      }]
    }]
  }
         |
         v
Client: DesignMockupPreview replaces client composite with Printful URL
         |
         v
Zustand store: mockupUrls["front"] = "https://files.cdn.printful.com/mockup/..."
```

### Implementation: `printful-mockup.ts`

```typescript
// frontend/src/lib/printful-mockup.ts

export interface MockupTaskRequest {
  printfulProductId: number
  variantIds: number[]
  mockupStyleIds?: number[]
  placements: Array<{
    placement: string
    technique: 'dtg' | 'embroidery' | 'sublimation'
    fileUrl: string
  }>
}

export interface MockupTaskResult {
  taskId: string
  status: 'pending' | 'completed' | 'failed'
  variantMockups?: Array<{
    variantId: number
    mockups: Array<{ styleId: number; url: string }>
  }>
}

export async function createMockupTask(
  request: MockupTaskRequest
): Promise<string> {
  const response = await fetch('/api/mockups/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error('Failed to create mockup task')
  const data = await response.json()
  return data.taskId
}

export async function pollMockupTask(
  taskId: string,
  onComplete: (result: MockupTaskResult) => void,
  timeoutMs = 30000
): Promise<void> {
  const interval = 2000
  const maxAttempts = Math.ceil(timeoutMs / interval)
  let attempts = 0

  const poll = async () => {
    attempts++
    const response = await fetch(`/api/mockups/${taskId}`)
    const data: MockupTaskResult = await response.json()

    if (data.status === 'completed') {
      onComplete(data)
      return
    }
    if (data.status === 'failed' || attempts >= maxAttempts) {
      onComplete({ taskId, status: 'failed' })
      return
    }
    setTimeout(poll, interval)
  }

  setTimeout(poll, interval)
}
```

### Hook: `usePrintfulMockup.ts`

```typescript
// frontend/src/components/design-editor/hooks/usePrintfulMockup.ts

import { useState, useCallback, useRef } from 'react'
import { createMockupTask, pollMockupTask } from '@/lib/printful-mockup'

export type MockupStatus = 'idle' | 'pending' | 'completed' | 'error'

export function usePrintfulMockup() {
  const [status, setStatus] = useState<MockupStatus>('idle')
  const [mockupUrl, setMockupUrl] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const abortRef = useRef(false)

  const generateMockup = useCallback(async (params: {
    printfulProductId: number
    variantId: number
    placement: string
    fileUrl: string
    technique?: 'dtg' | 'embroidery' | 'sublimation'
  }) => {
    abortRef.current = false
    setStatus('pending')
    setMockupUrl(null)

    try {
      const id = await createMockupTask({
        printfulProductId: params.printfulProductId,
        variantIds: [params.variantId],
        placements: [{
          placement: params.placement,
          technique: params.technique || 'dtg',
          fileUrl: params.fileUrl,
        }],
      })
      setTaskId(id)

      await pollMockupTask(id, (result) => {
        if (abortRef.current) return
        if (result.status === 'completed' && result.variantMockups?.[0]?.mockups?.[0]) {
          setMockupUrl(result.variantMockups[0].mockups[0].url)
          setStatus('completed')
        } else {
          setStatus('error')
        }
      })
    } catch {
      if (!abortRef.current) setStatus('error')
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current = true
    setStatus('idle')
  }, [])

  return { status, mockupUrl, taskId, generateMockup, cancel }
}
```

### Caching Strategy

Mockup generation is expensive (5–15 seconds) and should not be repeated for identical inputs. Cache at two levels:

**Level 1 — In-memory (per session)**: The Zustand store holds `mockupUrls: Record<PrintfulPlacement, string | null>`. Once a mockup URL is stored, the same design session reuses it without re-requesting.

**Level 2 — Database cache**: When a design is saved (user clicks "Save Design" or proceeds to cart), the mockup URLs are stored in the `design_compositions.mockup_urls` JSONB column. On subsequent loads of the same composition, these cached URLs are used directly.

**Cache invalidation**: If the design changes (canvas `onStateChange` fires after the mockup was generated), the cached URLs are cleared (`setMockupState('idle', null)`) and the "Preview on Product" button is re-enabled.

**CDN caching**: Printful's mockup URLs are served from `files.cdn.printful.com`. These URLs are stable for the lifetime of the task. We do not need to re-upload or re-proxy them — link directly.

### Fallback: Client-Side Composite While Printful Generates

The `DesignMockupPreview` component uses a two-layer pattern:

```tsx
function DesignMockupPreview({
  previewDataUrl,         // Client canvas export (available immediately)
  printfulProductId,
  designFileUrl,
  variantId,
  placement,
}: DesignMockupPreviewProps) {
  const { status, mockupUrl, generateMockup } = usePrintfulMockup()

  return (
    <div className="relative rounded-lg overflow-hidden bg-muted">
      {/* Layer 1: Client-side composite (always visible as fallback) */}
      {previewDataUrl && (
        <img
          src={previewDataUrl}
          alt="Design preview"
          className={cn(
            'w-full transition-opacity duration-500',
            status === 'completed' ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}

      {/* Layer 2: Printful photorealistic mockup (fades in when ready) */}
      {mockupUrl && (
        <img
          src={mockupUrl}
          alt="Product mockup"
          className="absolute inset-0 w-full transition-opacity duration-500 opacity-100"
        />
      )}

      {/* Loading indicator */}
      {status === 'pending' && (
        <div className="absolute bottom-2 right-2">
          <Badge variant="secondary" className="gap-1.5 text-xs">
            <Loader2 className="size-3 animate-spin" />
            Generating mockup...
          </Badge>
        </div>
      )}

      {/* Trigger mockup generation button */}
      {status === 'idle' && printfulProductId && designFileUrl && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-2 right-2"
          onClick={() => generateMockup({ printfulProductId, variantId, placement, fileUrl: designFileUrl })}
        >
          Preview on Product
        </Button>
      )}
    </div>
  )
}
```

### Mockup Templates for Canvas Background

Beyond the async mockup generation, Printful's `GET /v2/catalog-products/{id}/mockup-templates` endpoint returns synchronous data used as the canvas background:

```typescript
// In DesignCanvas init, called by useDesignCanvas hook
async function loadPrintfulTemplate(printfulProductId: number, placement: string) {
  // Response includes: image_url (product photography), print_area_top,
  // print_area_left, print_area_width, print_area_height (in inches)
  const response = await fetch(`/api/printful/catalog/${printfulProductId}/mockup-templates`)
  const templates = await response.json()
  const template = templates.find(t => t.placement === placement)

  if (template) {
    return {
      backgroundUrl: template.image_url,
      printArea: {
        // Convert inches to pixels at our canvas resolution (1024px)
        x: Math.round((template.print_area_left / template.template_width) * 1024),
        y: Math.round((template.print_area_top / template.template_height) * 1024),
        w: Math.round((template.print_area_width / template.template_width) * 1024),
        h: Math.round((template.print_area_height / template.template_height) * 1024),
      }
    }
  }
  // Fallback to hardcoded print-areas.ts values
  return { backgroundUrl: null, printArea: getPrintArea(category) }
}
```

This gives us exact print area coordinates derived from Printful's own data, replacing the hardcoded `PRINT_AREAS` dictionary in `print-areas.ts` for Printful products.

---

## 6. Export Pipeline

The export pipeline converts the client-side Fabric.js canvas state to a production-quality PNG file suitable for Printful fulfillment.

### Pipeline Diagram

```
┌─────────────────────────────────────────────────────┐
│  CLIENT (browser)                                    │
│                                                      │
│  Fabric.js canvas (interactive, display resolution)  │
│  canvas.toDataURL('image/png', 1.0)                  │
│  → base64 PNG (typically 600–900KB at 1024×1024)     │
│                                                      │
│  Also: canvas.toJSON() → composition state JSON      │
│        Saved to design_compositions table            │
└──────────────────────────┬──────────────────────────┘
                           │  POST /api/designs/export
                           │  Body: {
                           │    canvasDataUrl: "data:image/png;base64,...",
                           │    canvasJson: { ... },
                           │    productType: "tshirt",
                           │    position: "front",
                           │    compositionId?: "uuid"
                           │  }
                           ▼
┌─────────────────────────────────────────────────────┐
│  SERVER (/api/designs/export/route.ts)               │
│                                                      │
│  1. Decode base64 PNG from client                    │
│  2. Sharp resize to production dimensions:           │
│     tshirt front: 3600×4800px (300 DPI, 12×16 in)   │
│     hoodie: 3000×3600px                              │
│     mug wrap: 2850×1050px                            │
│     hat front: 1650×750px                            │
│     (See PRODUCTION_DIMENSIONS in print-areas.ts)    │
│  3. Sharp outputs PNG with transparent background    │
│  4. Upload to Supabase Storage:                      │
│     designs/compositions/{compositionId}/            │
│       {position}-production.png                      │
│  5. Save composition JSON to design_compositions     │
│  6. Return: { fileUrl, compositionId, position }     │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│  PRINTFUL FILE LIBRARY                               │
│                                                      │
│  POST https://api.printful.com/v2/files              │
│  Body: {                                             │
│    type: "default",                                  │
│    url: "[supabase-storage-public-url]"              │
│  }                                                   │
│  Response: { id: 98765, url: "...", status: "ok" }   │
│                                                      │
│  Note: Printful downloads from our Supabase URL.     │
│  Supabase Storage public URLs must be accessible     │
│  without auth (public bucket, no signed URL).        │
└──────────────────────────┬──────────────────────────┘
                           │  file_id: 98765
                           ▼
┌─────────────────────────────────────────────────────┐
│  ORDER CREATION (at checkout)                        │
│                                                      │
│  POST https://api.printful.com/v2/orders             │
│  items[].placements[]:                               │
│  {                                                   │
│    placement: "front",                               │
│    technique: "dtg",                                 │
│    layers: [{ type: "file", id: 98765 }]             │
│  }                                                   │
│                                                      │
│  (file_id reference — no re-upload at order time)   │
└─────────────────────────────────────────────────────┘
```

### Client Canvas Export (`DesignExportButton.tsx` internal flow)

```typescript
async function handleExport(canvasRef: DesignCanvasHandle, options: ExportOptions) {
  // Step 1: Get preview PNG (display resolution, for immediate cart thumbnail)
  const previewDataUrl = canvasRef.exportPNG(1.0)  // 1x multiplier = display size

  // Step 2: Serialize canvas state for storage
  const canvasJson = canvasRef.exportJSON()

  // Step 3: Call server export route
  const response = await fetch('/api/designs/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      canvasDataUrl: previewDataUrl,   // Server will upscale via Sharp
      canvasJson,
      productType: options.productType,
      position: options.position,
      compositionId: options.compositionId,  // Existing session UUID, or null
    }),
    credentials: 'include',
  })

  const { fileUrl, compositionId } = await response.json()

  // Step 4: Upload to Printful File Library (via server proxy)
  const printfulResponse = await fetch('/api/printful/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: fileUrl }),
    credentials: 'include',
  })
  const { fileId } = await printfulResponse.json()

  return { compositionId, fileUrl, fileId, previewDataUrl }
}
```

### Server Export Route (`/api/designs/export/route.ts`)

```typescript
// This route replaces the functionality of composition-renderer.ts
// for the canvas-based design editor path.

export async function POST(request: Request) {
  const { canvasDataUrl, canvasJson, productType, position, compositionId } = await request.json()

  // Decode base64 PNG
  const base64Data = canvasDataUrl.replace(/^data:image\/png;base64,/, '')
  const inputBuffer = Buffer.from(base64Data, 'base64')

  // Get production dimensions
  const dims = PRODUCTION_DIMENSIONS[productType] || PRODUCTION_DIMENSIONS['tshirt']

  // Sharp upscale to production resolution
  const productionBuffer = await sharp(inputBuffer)
    .resize(dims.w, dims.h, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: 'lanczos3',   // Best quality for upscaling
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()

  // Upsert composition record (create or update)
  const id = compositionId || crypto.randomUUID()
  const { data: comp } = await supabaseAdmin
    .from('design_compositions')
    .upsert({
      id,
      product_type: productType,
      layers: canvasJson,  // Store full Fabric.js JSON for re-editing
      [`${position}_production_url`]: null,  // Will be set after upload
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  // Upload production PNG to Supabase Storage
  const filename = `compositions/${id}/${position}-production.png`
  await supabaseAdmin.storage
    .from('designs')
    .upload(filename, productionBuffer, {
      contentType: 'image/png',
      cacheControl: '31536000',
      upsert: true,
    })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('designs')
    .getPublicUrl(filename)

  // Update composition with production URL
  await supabaseAdmin
    .from('design_compositions')
    .update({ [`${position}_production_url`]: publicUrl })
    .eq('id', id)

  return Response.json({ fileUrl: publicUrl, compositionId: id })
}
```

### Print Resolution Notes

| Product Type | Canvas Size | Production Size | Effective DPI |
|---|---|---|---|
| T-shirt / hoodie DTG | 1024×1024 (display) | 3600×4800px | 300 DPI at 12×16" |
| Mug sublimation | 1024×1024 (display) | 2850×1050px | ~300 DPI at 9.5×3.5" |
| Hat embroidery | 1024×1024 (display) | 1650×750px | 300 DPI at 5.5×2.5" |
| Tote bag | 1024×1024 (display) | 3600×3600px | 300 DPI at 12×12" |

The current `PRODUCTION_DIMENSIONS` in `print-areas.ts` already matches Printful's minimum requirements (DTG minimum is 2250×2700, our export is 3600×4800 — above minimum). No changes to production dimensions are required.

**Sharp upscaling quality**: Lanczos3 kernel provides the best quality for upscaling rasterized design files. For text-heavy designs where the client canvas renders at 1024×1024, the upscaling will smooth edges — this is acceptable and matches what other POD platforms do. For maximum sharpness on text, a future optimization is to re-render text layers at production resolution server-side using the saved `canvasJson` (Phase 5 enhancement, not required for MVP).

---

## 7. Migration from Current Module

### 7.1 Files: Kept, Modified, or Deleted

| File | Action | When | Notes |
|---|---|---|---|
| `src/components/products/DesignStudio.tsx` | **Replaced** | Phase 1 | Swap import to `DesignEditor` in `ProductDetailClient.tsx`. Keep file for reference until Phase 3. |
| `src/components/products/ProductPersonalizer.tsx` | **Deprecated** | Phase 3 | Keep until Phase 3. After Phase 3, only used if there is a non-canvas path. Remove after full validation. |
| `src/components/products/AIPromptEditor.tsx` | **Kept + modified** | Phase 1 | Connects result injection to `DesignCanvas.addImage()` instead of setting `designUrl` state. Change: add `onImageReady` prop. |
| `src/components/products/StyleSelector.tsx` | **Kept** | — | No changes. Passes selected preset to template gallery as a filter hint. |
| `src/components/products/AIPreviewCanvas.tsx` | **Deleted** | Phase 1 | The Fabric.js canvas replaces this CSS overlay component entirely. |
| `src/components/products/AuthGateOverlay.tsx` | **Kept** | — | Reused in `DesignEditor` for AI and templates tabs. |
| `src/components/products/GenerationCostBadge.tsx` | **Kept** | — | No changes. |
| `src/components/products/DesignHistoryPanel.tsx` | **Deleted** | Phase 3 | Replaced by `DesignLayerPanel.tsx` which includes object management. |
| `src/lib/composition-renderer.ts` | **Deprecated** | Phase 4 | Keep for backwards compatibility with existing `design_compositions` that used the old format. New exports go through `design-export.ts`. Mark with `@deprecated`. |
| `src/lib/print-areas.ts` | **Extended** | Phase 4 | Add Printful-specific dimension data from mockup-templates API. Keep `PRINT_AREAS` as fallback. Add `getPrintfulPrintArea(productId, placement)` async function. |
| `src/lib/design-presets.ts` | **Kept** | — | Style presets remain as template gallery category suggestions. |
| `src/lib/ai-design-orchestrator.ts` | **Kept** | — | AI generation pipeline unchanged. Only the result injection point changes (canvas `addImage` instead of state). |
| `src/lib/design-cost-guard.ts` | **Kept** | — | Budget enforcement unchanged. |
| `src/lib/mockup-generator.ts` | **Deprecated** | Phase 4 | Replaced by Printful Mockup API. Keep for legacy mockup serving. |
| `src/app/api/designs/ai-generate/route.ts` | **Kept** | — | AI generation endpoint unchanged. |
| `src/app/api/designs/personalize/route.ts` | **Deprecated** | Phase 3 | Keep for backwards compat. New path goes through `/api/designs/export`. |
| `src/app/api/designs/preview-text/route.ts` | **Deprecated** | Phase 1 | Server-side text preview is replaced by real-time canvas preview. Keep until `ProductPersonalizer` is removed. |
| `src/app/api/designs/compose/route.ts` | **Deprecated** | Phase 3 | Canvas JSON export replaces server-side composition. Keep for loading existing `design_compositions`. |
| `src/app/api/designs/history/route.ts` | **Kept** | — | Design history (user's past designs) remains. |
| `src/app/api/designs/personalizations/route.ts` | **Kept** | — | CRUD for personalization data. Kept until full deprecation. |
| `src/components/storefront/DesignContext.tsx` | **Kept + extended** | Phase 1 | Add `editorMode: 'canvas' | 'edm'` field. Existing context API preserved. |

### 7.2 Data Migration

**Existing `design_sessions` records**: No migration required. The table schema is provider-agnostic. New sessions will reference Printful product IDs in the session metadata JSONB.

**Existing `ai_generations` records**: No migration required. These store AI image URLs and prompt data — not tied to Printify.

**Existing `design_compositions` records**: These use `layers: CompositionLayer[]` format (the old `{ type, url, text, font, color, ... }` format). They are not compatible with the new Fabric.js JSON format.

Migration strategy:
- Do NOT migrate old records. They remain readable by `composition-renderer.ts` (kept as deprecated).
- New compositions created with the canvas editor store `layers: fabric.Canvas.toJSON()` (Fabric.js JSON).
- The `design_compositions` table needs a new column to distinguish old vs. new format:
  ```sql
  -- New migration required (add to supabase/migrations/)
  ALTER TABLE design_compositions
    ADD COLUMN IF NOT EXISTS editor_version VARCHAR(10) DEFAULT 'v1',
    ADD COLUMN IF NOT EXISTS front_production_url TEXT,
    ADD COLUMN IF NOT EXISTS back_production_url TEXT,
    ADD COLUMN IF NOT EXISTS left_sleeve_production_url TEXT,
    ADD COLUMN IF NOT EXISTS right_sleeve_production_url TEXT,
    ADD COLUMN IF NOT EXISTS mockup_urls JSONB DEFAULT '{}'::jsonb;
  -- Existing records: editor_version = 'v1'
  -- New canvas records: editor_version = 'v2'
  ```
- Load path: If `editor_version = 'v1'`, use `composition-renderer.ts`. If `editor_version = 'v2'`, use new `design-export.ts` + Fabric.js canvas.

**Existing `user_design_assets` records**: No migration required. These are upload URLs — accessible by either the old or new design path.

**Existing `cart_items` with `composition_id`**: Cart items referencing old `v1` compositions will still render correctly at checkout using `composition-renderer.ts` for the production export step. No migration needed.

### 7.3 Backwards Compatibility During Transition

**Phase 1 (canvas replaces preview only)**: `DesignEditor` accepts the same `onApply` props as `DesignStudio`. The `onApply` result type is extended but backwards-compatible:

```typescript
// Old signature (DesignStudio)
onApply?: (result: { type: 'personalization' | 'composition'; id: string }) => void

// New signature (DesignEditor) — compatible superset
onApply?: (result: DesignApplyResult) => void
// where DesignApplyResult includes type: 'canvas' | 'personalization' | 'composition' | 'edm_template'
// Consumers that only check type === 'personalization' or 'composition' continue to work.
```

**Phase 1–2 (canvas + text effects)**: `ProductPersonalizer.tsx` remains importable and functional. It is not deleted until Phase 3 validation is complete.

**Phase 3 (template gallery)**: `DesignHistoryPanel.tsx` is deleted. Any code path that imported it must be updated. Search: `grep -r "DesignHistoryPanel" src/` before deletion.

**Phase 4 (multi-position)**: `mockup-generator.ts` is deprecated but not deleted. The `generateMockup()` function from the old module is called by any existing API routes that reference it. Add a `@deprecated` JSDoc comment.

**EDM path (if approved, Phase 3 parallel)**: `PrintfulEDMStudio.tsx` is gated behind `mode="edm"` prop on `DesignEditor`. The canvas path (`mode="canvas"`) remains the default and is unaffected by EDM development.

---

## Summary

| Phase | Duration | Key Deliverable | Risk |
|---|---|---|---|
| 1 — Canvas Foundation | 4 weeks | Fabric.js canvas replaces CSS overlay; drag/resize/rotate; undo/redo | Low |
| 2 — Text Effects | 3 weeks | Shadow, outline, gradient, curved text, 30+ fonts | Low |
| 3 — Templates + Generators | 3 weeks | 20 parametric templates; color palette generator; shapes | Low |
| 4 — Multi-Position + Mockups | 3 weeks | Front/back/sleeve tabs; Printful real mockups | Medium (Printful API dependency) |
| 5 — Advanced | 5–6 weeks | Layer panel; snap guides; SVG import; warp text; filters | Medium |
| EDM (parallel, conditional) | 2–3 weeks | Printful iframe design studio (enterprise access required) | High (approval-dependent) |

**Total Phase 1–4**: ~13 weeks to reach a competitive, multi-position design studio with real mockup previews.
**Total Phase 1–5**: ~18–19 weeks for the full advanced feature set.
**EDM conditional path**: Always in parallel, never blocking the main roadmap.

**New npm dependencies** (total across all phases):
- `fabric@^6.0.0` — canvas engine (~300KB)
- `opentype.js@^1.3.4` — curved text and font path extraction (~50KB, lazy loaded)
- `zustand` — state management (~1.1KB, likely already present)
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-to-reorder in layer panel (~30KB, Phase 5 only)
- `warpjs` — SVG text warping (~15KB, Phase 5, lazy loaded)
- `@uiw/react-color` — enhanced color picker (~20KB, Phase 3)

**Files created**: ~30 new files across components, hooks, lib, and API routes
**Files deleted**: `AIPreviewCanvas.tsx`, `DesignHistoryPanel.tsx` (Phase 3), eventual deprecation of `ProductPersonalizer.tsx`
**Files modified**: `ProductDetailClient.tsx`, `AIPromptEditor.tsx`, `print-areas.ts`, `DesignContext.tsx`, `next.config.ts`
**New DB migration**: 1 migration to add `editor_version`, multi-position production URL columns, and `mockup_urls` JSONB to `design_compositions`
