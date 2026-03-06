# Design Personalization Research: Tools, UX Patterns & Ideas for Next-Gen POD Design Studio

> **Date**: 2026-03-02
> **Purpose**: Comprehensive research to inform the architecture of SKAPARA's next-generation design studio -- an Adobe-like design page where customers can personalize products end-to-end.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Competitive Analysis](#2-competitive-analysis)
3. [Technical Approaches: Canvas Libraries](#3-technical-approaches-canvas-libraries)
4. [Non-AI Design Features](#4-non-ai-design-features)
5. [Text Effect Techniques](#5-text-effect-techniques)
6. [UX Patterns for Design Studios](#6-ux-patterns-for-design-studios)
7. [Integration Recommendations for Next.js](#7-integration-recommendations-for-nextjs)
8. [Feature Roadmap Ideas](#8-feature-roadmap-ideas)

---

## 1. Current State Analysis

### What SKAPARA Has Today

The current design studio (`DesignStudio.tsx` + `ProductPersonalizer.tsx`) provides three tabs:

| Tab | Capabilities | Limitations |
|-----|-------------|-------------|
| **Text** | 12 Google Fonts, 16 color swatches, hex input, 3 sizes (S/M/L), 3 positions (top/center/bottom), L/C/R alignment, contrast warning, overflow detection, CSS quick preview + server accurate preview | No text effects (no warping, shadows, outlines, gradients). No drag-and-drop positioning. No rotation. Font sizes are presets, not continuous. Max 3 lines / 50 chars. |
| **AI Design** | Style presets, AI prompt generation via fal.ai/Gemini, opacity control, auth-gated, generation budget tracking | AI-only -- no manual design editing of generated results. No layering. No combining text + AI. |
| **Upload** | PNG/JPEG/WebP up to 5MB, background removal via rembg sidecar | No positioning/scaling of uploaded image. No combining with text. No image editing. |

**Backend infrastructure already in place:**
- `composition-renderer.ts` -- Sharp + node-canvas for server-side compositing with production-resolution output
- `ai-design-orchestrator.ts` -- Intent classification + prompt engineering pipeline
- `design-presets.ts` -- Curated style presets with i18n
- `print-areas.ts` -- Per-category print area definitions with preview zone calibration
- 12 font files in `/public/fonts/`
- Design sessions, AI generations, and design compositions tables in Supabase

### Gap Analysis

The biggest gaps compared to market leaders:

1. **No canvas-based editor** -- Everything is CSS overlays, not an interactive canvas
2. **No drag-and-drop** -- Users cannot freely position, resize, or rotate elements
3. **No layers** -- Cannot combine text + images + shapes in a single composition
4. **No text effects** -- No warping, shadows, outlines, gradients, neon, 3D
5. **No templates** -- Users start from scratch every time
6. **No real-time mockup** -- Preview is either CSS approximate or server-rendered (slow)
7. **No non-AI generators** -- No pattern, monogram, badge, or emblem generators

---

## 2. Competitive Analysis

### 2.1 Graffiti Empire Generator

**URL**: https://www.graffiti-empire.com/graffiti-generator/

**What it offers:**
- Three-step process: Choose font > Enter word > Style graffiti
- 10+ graffiti font styles: Wildstyle, Bubble, Block, Simple, Throwie, Tag, Stencil, Neon, decorative variations
- Effects: 3D rendering, drips, outline treatments
- 200+ preset gradients (solid color or gradient fill)
- Layer-by-layer color adjustment for different graffiti components
- Toggle visibility of individual layers
- Emoji overlay support
- Undo/redo functionality
- Export at customizable sizes

**Technical approach**: JavaScript-based canvas/SVG hybrid rendering. Each graffiti letter is decomposed into layers (outline, fill, 3D extrusion, drips, highlights) that can be independently colored.

**What we can learn:**
- Layer decomposition for text effects is powerful and engaging
- Preset gradient libraries make color selection feel premium
- The "style first, customize second" workflow is intuitive for non-designers
- Layer visibility toggles give users control without overwhelming them

### 2.2 Kittl -- The POD Design Leader

**URL**: https://www.kittl.com/

Kittl is widely regarded as the best design tool for POD sellers in 2025-2026.

**Key features:**
- Real-time text warping (arc, wave, flag, bulge, inflate) with one-click application
- Layered text effects: shadows, outlines, textures, 3D depth combinable
- Exclusive font library beyond Google Fonts
- Templates designed specifically for POD products (t-shirts, hoodies, tote bags, mugs, hats)
- AI art generation integrated into the editor
- One-click product mockup generation
- Vector export capability
- "Text Quote" templates that auto-arrange typography into professional layouts

**Pricing**: Pro $15/month, Expert $30/month

**What we can learn:**
- Text effects are THE differentiator for POD. Most POD designs are text-based.
- Warping/curving text with a single click is the killer feature
- Templates specifically designed for POD products (not generic design templates) are more valuable
- Combining AI generation with manual editing in one workflow is the future

### 2.3 Custom Ink Design Lab

**URL**: https://www.customink.com/

**Key features:**
- Drag-and-drop art images and fonts onto any product
- Multi-position printing: front, back, pocket, sleeves
- Tens of thousands of high-quality clipart graphics
- Upload your own artwork or request expert design assistance
- Real-time product visualization
- Group ordering features

**What we can learn:**
- Massive clipart library is a moat -- we should build a curated design element library
- Multi-position design (front + back + sleeves) is expected for apparel
- "Expert design assistance" is a premium upsell opportunity (our AI chat could fill this role)

### 2.4 Spreadshirt Designer

**Key features:**
- Clean, mobile-friendly customizer interface
- Multi-position printing (front, back, sleeves)
- Quick design upload with good mobile UX
- Free marketplace listing for creators

**What we can learn:**
- Mobile-first design editor is critical -- Spreadshirt's mobile UX is better than most
- Simple is better for casual customers; power features should be progressive disclosure

### 2.5 Zazzle

**Key features:**
- 1,000+ product types
- Single design, multiple products auto-generation
- Customizable by end customers

**Limitations:**
- Outdated UI
- Tedious upload and listing creation process
- No analytics or A/B testing tools

**What we can learn:**
- Auto-applying one design to multiple products saves massive time
- UI freshness matters -- even a feature-rich tool gets abandoned if it feels old

### 2.6 Redbubble

**Key features:**
- Upload single JPEG, auto-apply to 75+ products
- Seller-controlled profit margins
- Minimal design tool -- upload-focused

**What we can learn:**
- The simplest possible upload experience has value for artists who design externally
- Not every user needs a full design editor -- a quick upload path must always exist

### 2.7 Fancy Product Designer (FPD)

**URL**: https://fancyproductdesigner.com/

**Key features:**
- Works with WooCommerce, WordPress, Shopify
- Flexible layer system with lock/move/visibility controls
- Applied to any product type: shirts, shoes, caps, phone cases, mugs, business cards
- Watermark support for downloadable products
- Print-ready file export extension
- Fully responsive
- Modal, inline, or replace-product-image display modes

**Pricing**: $59 one-time (WordPress), $15/month (Shopify)

**What we can learn:**
- Layer management (lock, move up/down, visibility) is essential for a real design editor
- Multiple display modes (modal vs inline vs replace image) serve different contexts
- Print-ready export is a must-have, not a nice-to-have

### 2.8 IMG.LY CreativeEditor SDK (CE.SDK)

**URL**: https://img.ly/products/creative-sdk

**Key features:**
- Fully customizable, white-label design editor
- Cross-platform: web (React, Angular, Vue, Svelte), iOS, Android
- Template-based workflows and automations
- Custom asset libraries (stickers, filters, frames, fonts)
- Export in PNG, JPEG, TGA, PDF
- Dark/light theming, configurable toolbar
- Custom sources for assets with filtering/sorting

**Pricing**: Enterprise licensing (contact sales -- likely $$$)

**What we can learn:**
- This is the "buy" option if we want to skip building from scratch
- However, enterprise pricing likely makes it impractical for our scale
- Their feature set is the benchmark for what a "complete" editor looks like

---

## 3. Technical Approaches: Canvas Libraries

### 3.1 Fabric.js

**URL**: https://fabricjs.com/

| Aspect | Details |
|--------|---------|
| **License** | MIT |
| **Size** | ~300KB minified |
| **React support** | Via wrapper libraries; not native React |
| **TypeScript** | Full support in v6+ |
| **Key strength** | Object manipulation, filters, serialization, SVG-to-canvas parser |

**Capabilities:**
- Interactive object model on top of HTML5 Canvas
- On-canvas text editing with rich styling
- Complex SVG path support
- Serialization (save/load canvas state as JSON)
- SVG-to-canvas and canvas-to-SVG parsing
- Built-in image filters
- Free-form drawing

**300 DPI Export:**
- Use `multiplier` parameter (4.17x for 300 DPI from 72 DPI)
- CAUTION: multiplier > 2 can exceed browser data URI limits (2MB in Chrome)
- Solution: Use Blob conversion + JPEG format (quality 0.98) instead of PNG data URI
- For production print files: render server-side with node-canvas at full resolution

**Next.js Integration:**
- Requires webpack configuration for canvas runtime errors
- Must externalize `utf-8-validate` and `bufferutil` in `next.config.js`
- Step-by-step guide available at DEV Community

**Verdict**: Best for design editors requiring extensive object manipulation, filters, and save/load. The serialization feature is critical for persisting user designs. However, React integration requires extra work.

### 3.2 Konva.js + react-konva

**URL**: https://konvajs.org/

| Aspect | Details |
|--------|---------|
| **License** | MIT (but see commercial note) |
| **Size** | ~150KB minified |
| **React support** | Native via react-konva |
| **TypeScript** | Full support |
| **Key strength** | Performance, layer management, React-native integration |

**Capabilities:**
- Declarative and reactive bindings for React
- Layer-based architecture (dirty region detection -- only repaints changed areas)
- Virtual DOM-like structure for efficient rendering
- Excellent event system for drag-and-drop and scaling
- Stage > Layer > Shape hierarchy
- `pixelRatio` export for high-resolution output

**300 DPI Export:**
- `stage.toDataURL({ pixelRatio: 4.17 })` for 300 DPI
- Works more reliably than Fabric.js for large exports
- Supports quality parameter for JPEG

**Next.js Integration:**
- react-konva works naturally with React component model
- May need dynamic import (`next/dynamic` with `ssr: false`) since canvas is browser-only
- No special webpack configuration needed beyond SSR exclusion

**Verdict**: Best for React/Next.js applications. Native React integration eliminates wrapper overhead. Layer management is built-in. Better performance for complex scenes. Recommended as the primary canvas library.

### 3.3 Polotno SDK

**URL**: https://polotno.com/

| Aspect | Details |
|--------|---------|
| **License** | Proprietary (free tier available) |
| **Built on** | Konva.js + React |
| **Key strength** | Complete design editor framework out of the box |

**Capabilities:**
- Complete visual editor with texts, images, filters, selection, transformations
- Built-in Google Fonts support
- Stock photo integration
- Template system
- Undo/redo
- Export to PNG/JPEG/PDF
- JSON schema for saving/loading designs
- White-label customization (colors, icons, typography, layout)
- Custom asset panels

**Key advantage**: Polotno gives you 80% of a Canva-like editor with minimal code. You embed it, customize the UI, and connect your asset library.

**Considerations:**
- Proprietary license may limit customization depth
- Check pricing tiers for commercial use
- Less control over low-level rendering compared to raw Konva.js

**Verdict**: Best if you want to ship fast. The trade-off is less control and a dependency on their licensing. Could be used as Phase 1 while building a custom solution for Phase 2.

### 3.4 Penpot

**URL**: https://penpot.app/

| Aspect | Details |
|--------|---------|
| **License** | MPL 2.0 (open source) |
| **Self-hosted** | Yes (Docker/Kubernetes) |
| **Key strength** | Full design tool, SVG-native, CSS Grid Layout |

**Capabilities:**
- Full-featured design tool comparable to Figma
- SVG-native (open standards)
- CSS Grid Layout support
- Plugin ecosystem
- REST API + webhooks
- Component system

**Verdict**: Overkill for a POD product customizer. Penpot is a design collaboration tool (Figma alternative), not a product customization widget. Not recommended for integration.

### 3.5 react-design-editor

**URL**: https://github.com/salgum1114/react-design-editor

| Aspect | Details |
|--------|---------|
| **License** | MIT |
| **Built on** | React + Ant Design + Fabric.js |
| **Key strength** | Ready-made editor with PowerPoint-like features |

**Capabilities:**
- Image creation and diagram drawing
- Composition arrangement
- Multiple export formats
- Business process modelling (BPM)

**Verdict**: Good reference implementation but uses Ant Design (not shadcn/ui) and Fabric.js. Could serve as architectural inspiration but would need significant refactoring to match our stack.

### Comparison Matrix

| Feature | Fabric.js | Konva.js | Polotno | react-design-editor |
|---------|-----------|----------|---------|---------------------|
| React native | No (wrapper) | Yes (react-konva) | Yes | Yes (Ant Design) |
| TypeScript | Yes | Yes | Yes | Partial |
| Layer management | Basic | Built-in | Built-in | Built-in |
| Serialization | JSON (excellent) | JSON | JSON | JSON |
| SVG parsing | Yes (bidirectional) | Limited | Via Konva | Via Fabric |
| Image filters | 20+ built-in | Basic | Via Konva | Via Fabric |
| Text editing | On-canvas rich text | Basic text | Rich text | Via Fabric |
| 300 DPI export | Tricky (data URI limits) | Reliable (pixelRatio) | Via Konva | Via Fabric |
| Performance (1000 objects) | Moderate | Excellent | Good | Moderate |
| Bundle size | ~300KB | ~150KB | ~500KB+ | ~600KB+ |
| SSR compatibility | Manual config | `ssr: false` | `ssr: false` | Manual config |

**RECOMMENDATION**: **Konva.js (react-konva)** as the primary canvas library, with Polotno as a potential accelerator for the initial launch.

---

## 4. Non-AI Design Features

### 4.1 Template System

**What**: Pre-designed layouts that users customize with their text, colors, and images.

**Implementation approach:**
- Store templates as Konva JSON in Supabase
- Categories: Typography layouts, Badge/emblem, Vintage, Minimalist, Sports team, Event, Holiday
- Each template has editable zones (text placeholders, image slots, color swatches)
- Templates tagged by product type (apparel, mug, hat, tote) and style

**Template types for POD:**
1. **Text Quote layouts** -- Pre-arranged typography with 1-3 text zones (like Kittl's Text Quotes)
2. **Badge/Emblem frames** -- Circular, shield, ribbon-banner frames with text arc paths
3. **Monogram layouts** -- 1-3 initial letters with decorative frames
4. **Split designs** -- Two-tone layouts for front/back or top/bottom
5. **Border/frame designs** -- Decorative borders around edge of print area
6. **Icon + text combos** -- Pre-paired icon slot + text layout

### 4.2 Pattern Generators

**Libraries to integrate:**

| Library | What it does | Integration effort |
|---------|-------------|-------------------|
| **GeoPattern** (btmills/geopattern) | Generates unique SVG patterns from any string input (originally for GitHub Guides) | Low -- npm install, render SVG, convert to canvas |
| **Pattern Monster** concepts | Repeatable SVG patterns for backgrounds, apparel, packaging | Medium -- curate patterns, build color customizer |
| **fffuel generators** (gggyrate, rrreplicate) | Rotating geometric shapes, line patterns with configurable parameters | Low -- embed or port algorithms |

**Custom generators to build:**
1. **Geometric tile generator** -- Select shape (triangle, hexagon, diamond), set colors, spacing, rotation
2. **Wave/stripe generator** -- Configurable wave amplitude, frequency, colors
3. **Dot grid generator** -- Grid spacing, dot size, color gradient
4. **Noise texture generator** -- Perlin/simplex noise with color mapping

### 4.3 Monogram/Initial Generator

**Concept**: Enter 1-3 initials, select a frame style, choose fonts + colors.

**Implementation:**
- Use opentype.js to render text to SVG paths for precise control
- Pre-built frame styles: Circle, Diamond, Square, Wreath, Script flourish, Stacked, Interlocked
- Font pairing: Auto-suggest complementary fonts (display + script)
- Color themes from brand palette

**Libraries:**
- **opentype.js** -- Parse fonts, extract glyph paths, render to SVG/canvas
- Google Fonts API for font loading

### 4.4 Badge/Emblem Creator

**Concept**: Layered badge builder with outer shape, inner elements, text arcs, and icons.

**Layers:**
1. Outer shape (circle, shield, rectangle, pentagon, ribbon banner)
2. Border ring (solid, dashed, double, ornamental)
3. Inner background (solid, gradient, texture)
4. Text arc (top arc text, bottom arc text) -- using SVG `<textPath>` or Warp.js
5. Central element (icon, monogram, image, or secondary text)
6. Decorative elements (stars, laurels, lines, dots)

**This is particularly valuable for:**
- Sports teams and clubs
- Event merchandise
- Company branded apparel
- Vintage/retro style designs (very popular in POD)

### 4.5 Color Palette Generator

**Libraries:**

| Library | Capabilities |
|---------|-------------|
| **chroma.js** | Color manipulation, scale generation, WCAG contrast checking, 0 dependencies, 13.5KB |
| **palette.js** (Google) | Categorical color palettes optimized for distinction |
| **kolorwheel.js** | Color palette generation from base color with transformation chains |
| **@14ch/color-palette-generator** | OKLCH color space, balanced tones across hues |

**Features to build:**
- Extract dominant colors from uploaded images (using canvas `getImageData`)
- Generate complementary/analogous/triadic palettes from any base color
- Ensure WCAG contrast compliance for text-on-product
- Save favorite palettes to user profile
- Brand color presets (SKAPARA palette + seasonal collections)

### 4.6 Typography Tools

**Font pairing:**
- Integrate curated pairings from Fontpair.co concepts (heading + body font combos)
- Use Fontjoy-style algorithm: select heading font, auto-suggest body font
- Google Fonts API for loading 1500+ fonts on demand

**Typography layout presets:**
- Stacked (heading + subheading + tagline)
- Side-by-side
- Diagonal
- Circular
- Arc
- Perspective/3D

### 4.7 Vintage/Retro Effect Generator

**Concept**: One-click vintage treatments applied to any design.

**Effects:**
- Distressed/worn texture overlay (using canvas blend modes)
- Halftone dot effect (SVG filter or canvas pixel manipulation)
- Paper texture background
- Faded color palette (desaturated, warm-shifted)
- Ink stamp effect (rough edges, imperfect registration)
- Screen print effect (limited colors, slight misalignment)

---

## 5. Text Effect Techniques

### 5.1 CSS-Based Text Effects

Usable for quick preview (not print-ready):

```css
/* Neon glow */
text-shadow:
  0 0 7px #fff,
  0 0 10px #fff,
  0 0 21px #fff,
  0 0 42px #0fa,
  0 0 82px #0fa;

/* 3D extrusion */
text-shadow:
  1px 1px 0 #ccc,
  2px 2px 0 #c9c9c9,
  3px 3px 0 #bbb,
  4px 4px 0 #b9b9b9,
  5px 5px 5px rgba(0,0,0,0.3);

/* Gradient text */
background: linear-gradient(to right, #f32170, #ff6b08, #cf23cf, #eedd44);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;

/* Outline/stroke */
-webkit-text-stroke: 2px #000;
color: transparent;

/* Emboss */
text-shadow: 0px 1px 0px rgba(255,255,255,0.3), 0px -1px 0px rgba(0,0,0,0.7);
```

### 5.2 SVG Text Effects

Print-ready via SVG export:

**Text on path (arc, wave, circle):**
```xml
<defs>
  <path id="curve" d="M 50 200 Q 200 50 350 200" />
</defs>
<text>
  <textPath href="#curve">Text along a curve</textPath>
</text>
```

**SVG Filters for text:**
```xml
<!-- Neon glow -->
<filter id="neon">
  <feGaussianBlur stdDeviation="4" result="blur" />
  <feMerge>
    <feMergeNode in="blur" />
    <feMergeNode in="SourceGraphic" />
  </feMerge>
</filter>

<!-- Displacement/distortion -->
<filter id="distort">
  <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" />
  <feDisplacementMap in="SourceGraphic" scale="10" />
</filter>
```

### 5.3 Warp.js for SVG Text Warping

**URL**: https://github.com/benjamminf/warpjs

Warp.js can distort, bend, twist, and smudge SVGs directly in the browser:

```javascript
import Warp from 'warpjs'

const svg = document.getElementById('text-svg')
const warp = new Warp(svg)

// Interpolate for smoother curves
warp.interpolate(4)

// Wave effect
warp.transform(([x, y]) => [x, y + 10 * Math.sin(x / 40)])

// Arc effect
warp.transform(([x, y]) => {
  const cx = width / 2
  const angle = (x - cx) / cx * Math.PI * 0.3
  const radius = height + 200
  return [
    cx + (radius - y) * Math.sin(angle),
    radius - (radius - y) * Math.cos(angle)
  ]
})

// Flag wave
warp.transform(([x, y]) => [x, y + 15 * Math.sin(x / 50) * (x / width)])
```

**Warp presets to implement:**
1. **Arc Up** -- Text curves upward in an arc
2. **Arc Down** -- Text curves downward
3. **Wave** -- Sine wave distortion
4. **Flag** -- Increasing wave amplitude (flag in wind)
5. **Bulge** -- Center expands outward
6. **Pinch** -- Center contracts inward
7. **Inflate** -- Letters balloon outward
8. **Fisheye** -- Circular distortion from center
9. **Perspective** -- Converging lines (3D depth)
10. **Squeeze** -- Vertical compression varying by position

### 5.4 opentype.js for Advanced Typography

**URL**: https://github.com/opentypejs/opentype.js

```javascript
import opentype from 'opentype.js'

// Load font
const font = await opentype.load('/fonts/BebasNeue-Regular.ttf')

// Get text as SVG path
const path = font.getPath('SKAPARA', 0, 150, 72)
const svgPath = path.toSVG()

// Get individual glyph paths for per-letter effects
const glyphs = font.stringToGlyphs('HELLO')
glyphs.forEach((glyph, i) => {
  const path = glyph.getPath(x + offset, y, fontSize)
  // Apply per-letter transformations (rotation, scale, color)
})
```

**Use cases:**
- Per-letter color gradients
- Per-letter rotation/scale animations
- Text-to-path for precise warping with Warp.js
- Custom kerning adjustments
- Outline extraction for stroke effects

### 5.5 Canvas-Based Text Rendering

For production-quality output:

```javascript
const canvas = document.createElement('canvas')
canvas.width = 4167  // 300 DPI * ~14 inches
canvas.height = 4167
const ctx = canvas.getContext('2d')

// Text shadow (neon effect)
ctx.shadowColor = '#0fa'
ctx.shadowBlur = 20
ctx.font = '200px "Bebas Neue"'
ctx.fillStyle = '#fff'
ctx.fillText('SKAPARA', x, y)

// Text outline
ctx.strokeStyle = '#000'
ctx.lineWidth = 4
ctx.strokeText('SKAPARA', x, y)

// Gradient fill
const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
gradient.addColorStop(0, '#f32170')
gradient.addColorStop(0.5, '#cf23cf')
gradient.addColorStop(1, '#eedd44')
ctx.fillStyle = gradient
ctx.fillText('SKAPARA', x, y)
```

### 5.6 Text Effect Catalog (Proposed)

| Effect | Preview Tech | Print Tech | Difficulty |
|--------|-------------|------------|------------|
| **Solid fill** | CSS | Canvas fillText | Easy |
| **Outline/stroke** | CSS -webkit-text-stroke | Canvas strokeText | Easy |
| **Drop shadow** | CSS text-shadow | Canvas shadowBlur | Easy |
| **Gradient fill** | CSS background-clip | Canvas createLinearGradient | Medium |
| **Neon glow** | CSS multi text-shadow | Canvas multi-pass shadowBlur | Medium |
| **3D extrusion** | CSS stacked text-shadow | Canvas multi-offset fillText | Medium |
| **Arc/curve** | SVG textPath | opentype.js + Warp.js | Medium |
| **Wave** | Warp.js on SVG | Warp.js + rasterize | Medium |
| **Distortion** | SVG feDisplacementMap | Canvas pixel manipulation | Hard |
| **Graffiti layers** | Canvas multi-layer | Canvas multi-layer + filters | Hard |
| **Halftone** | SVG filter | Canvas pixel-level | Hard |
| **Chrome/metallic** | CSS gradient + reflection | Canvas gradient + reflection | Hard |
| **Emboss/deboss** | CSS text-shadow pair | Canvas light/dark shadow pair | Medium |
| **Vintage/distressed** | Canvas texture overlay | Canvas blend mode + texture | Medium |

---

## 6. UX Patterns for Design Studios

### 6.1 Core UX Principles

**Progressive Disclosure**: Show simple controls first, reveal advanced options on demand.
- Level 1: Choose template > Change text > Pick color > Done
- Level 2: Change font, adjust size, add effects
- Level 3: Layer management, custom positioning, image upload, advanced effects

**Real-time Preview**: Every change must be visible immediately.
- Target: <16ms for simple operations (color, font change)
- Acceptable: <200ms for effects (warp, filter)
- Background: <2s for production-quality server render

**Mobile-First**: Design for touch first, enhance for desktop.
- Pinch-to-zoom on canvas
- Touch-friendly control sizes (min 44px targets)
- Bottom sheet for tool panels on mobile
- Side panels on desktop

### 6.2 Layout Patterns

**Split View (Desktop)**:
```
+------------------+------------+
|                  |            |
|    Canvas        |   Tools    |
|    Preview       |   Panel    |
|                  |            |
+------------------+------------+
```

**Stacked View (Mobile)**:
```
+--------------------+
|    Canvas Preview  |
+--------------------+
|    Tool Tabs       |
+--------------------+
|    Tool Panel      |
|    (scrollable)    |
+--------------------+
|    Apply Button    |
+--------------------+
```

### 6.3 Tool Organization

**Top toolbar (Desktop) / Bottom toolbar (Mobile):**
- Select/Move tool
- Text tool
- Shape tool
- Image/Upload tool
- Effects tool
- Undo/Redo

**Properties panel (contextual):**
- Shows properties for currently selected object
- Font family, size, color, effects for text
- Opacity, blend mode, filters for images
- Fill, stroke, size for shapes

### 6.4 Workflow Patterns

**Template-First Flow** (for casual users):
1. Browse templates by category/style
2. Select template
3. Edit text placeholders
4. Customize colors
5. Preview on product mockup
6. Add to cart

**Blank Canvas Flow** (for creators):
1. Select product + print area
2. Add elements (text, images, shapes)
3. Arrange and style
4. Preview on mockup
5. Export or add to cart

**AI-Assisted Flow** (hybrid):
1. Describe design in natural language
2. AI generates initial composition
3. User refines with manual editing tools
4. Preview on mockup
5. Add to cart

### 6.5 Product Mockup Preview Patterns

**Editor Mockup** (while designing):
- Flat/schematic representation
- Fast to update (no perspective transform)
- Shows print area boundaries
- Grid/snap guides

**Preview Mockup** (before checkout):
- Photorealistic product image
- Design wrapped/warped to product surface
- Multiple angles (front, back, detail)
- Color variants shown side-by-side

**Implementation approaches:**
1. **CSS transform + overlay** (current approach) -- fast but imprecise
2. **Canvas perspective transform** -- better accuracy, client-side
3. **Three.js 3D model** -- best quality, heaviest
4. **Server-side compositing** (Sharp/Puppeteer) -- production quality, async

### 6.6 Drag-and-Drop Patterns

With Konva.js, drag-and-drop is built-in:

```jsx
<Stage width={800} height={600}>
  <Layer>
    <Text
      text="SKAPARA"
      x={100}
      y={200}
      draggable
      fontSize={48}
      onDragEnd={(e) => {
        updatePosition(e.target.x(), e.target.y())
      }}
    />
    <Transformer
      ref={transformerRef}
      // Enables resize handles + rotation
    />
  </Layer>
</Stage>
```

### 6.7 Snap-to-Grid and Alignment Guides

Essential for non-designer users to create professional-looking layouts:

- Snap to center (horizontal and vertical)
- Snap to other objects (edges and centers)
- Snap to print area boundaries
- Alignment guides (red/blue lines showing alignment)
- Smart spacing (equal distance between objects)

---

## 7. Integration Recommendations for Next.js

### 7.1 Recommended Architecture

```
DesignStudioV2/
  index.tsx              -- Entry point, Dialog/Sheet responsive wrapper
  DesignCanvas.tsx       -- react-konva canvas with layers
  ToolPanel.tsx          -- Contextual property editor
  TemplateGallery.tsx    -- Browse/apply templates
  TextEditor.tsx         -- Text properties + effects
  ImageEditor.tsx        -- Image upload, crop, filters
  ShapeLibrary.tsx       -- Shapes, icons, decorative elements
  EffectsPanel.tsx       -- Text effects (warp, shadow, glow)
  ColorPicker.tsx        -- Advanced color picker + palette generator
  LayerPanel.tsx         -- Layer list with visibility/lock/reorder
  MockupPreview.tsx      -- Real-time product mockup overlay
  ExportManager.tsx      -- High-res export + add-to-cart
  hooks/
    useDesignState.ts    -- Zustand store for design state
    useCanvasHistory.ts  -- Undo/redo stack
    useSnapGuides.ts     -- Alignment snapping logic
    useExport.ts         -- Canvas-to-PNG/SVG export
  lib/
    templates.ts         -- Template loading/saving
    effects.ts           -- Text effect renderers
    warp.ts              -- Warp.js integration
    palette.ts           -- Color palette generation
```

### 7.2 State Management

Use Zustand for the design state (lighter than Redux, works well with canvas):

```typescript
interface DesignState {
  layers: DesignLayer[]
  selectedLayerId: string | null
  canvasSize: { width: number; height: number }
  zoom: number
  history: DesignState[]
  historyIndex: number

  // Actions
  addLayer: (layer: DesignLayer) => void
  updateLayer: (id: string, updates: Partial<DesignLayer>) => void
  removeLayer: (id: string) => void
  reorderLayer: (id: string, newIndex: number) => void
  selectLayer: (id: string | null) => void
  undo: () => void
  redo: () => void
}

type DesignLayer =
  | TextLayer
  | ImageLayer
  | ShapeLayer
  | PatternLayer

interface TextLayer {
  type: 'text'
  id: string
  text: string
  font: string
  fontSize: number
  fontColor: string
  effects: TextEffect[]
  x: number
  y: number
  rotation: number
  width: number
  height: number
  locked: boolean
  visible: boolean
}
```

### 7.3 Dynamic Import for react-konva

Since canvas APIs are browser-only:

```typescript
import dynamic from 'next/dynamic'

const DesignCanvas = dynamic(
  () => import('./DesignCanvas').then((mod) => mod.DesignCanvas),
  { ssr: false, loading: () => <CanvasSkeleton /> }
)
```

### 7.4 High-Resolution Export Pipeline

```
Client Canvas (72 DPI, interactive)
    |
    v
Konva stage.toJSON()  -- Serialize design state
    |
    v
POST /api/designs/render  -- Send to server
    |
    v
Server: Re-render at 300 DPI using node-canvas
    (composition-renderer.ts already does this!)
    |
    v
Upload to Supabase Storage / Printify
    |
    v
Return URL to client for mockup/cart
```

This pipeline already partially exists in `composition-renderer.ts`. The gap is converting from Konva JSON format to the server's layer format.

### 7.5 Font Loading Strategy

```typescript
// Load fonts on demand from Google Fonts
const loadFont = async (fontFamily: string) => {
  const link = document.createElement('link')
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(' ', '+')}&display=swap`
  link.rel = 'stylesheet'
  document.head.appendChild(link)

  // Wait for font to be loaded
  await document.fonts.load(`16px "${fontFamily}"`)
}

// For canvas text rendering, also load via opentype.js
const font = await opentype.load(`/fonts/${fontFile}`)
```

### 7.6 Performance Considerations

- **Canvas size**: Keep interactive canvas at screen resolution (1x or 2x for Retina)
- **Debounce updates**: Text input changes should debounce canvas re-render (100ms)
- **Layer caching**: Use Konva's `cache()` for layers that don't change often
- **Off-screen rendering**: Generate effects off-screen, composite results
- **Web Workers**: Move heavy operations (color extraction, pattern generation) to workers
- **Lazy load effects**: Load Warp.js, opentype.js only when text effects panel opens

---

## 8. Feature Roadmap Ideas

### Phase 1: Enhanced Text Editor (2-3 weeks)

Upgrade the current `ProductPersonalizer.tsx` without a full canvas rewrite:

- [ ] **Continuous font size slider** (replace S/M/L presets)
- [ ] **Text outline effect** (CSS -webkit-text-stroke for preview, canvas strokeText for production)
- [ ] **Text shadow effect** (CSS text-shadow for preview)
- [ ] **Gradient text color** (CSS background-clip for preview)
- [ ] **More fonts** (expand from 12 to 30+ with Google Fonts on-demand loading)
- [ ] **Font preview** (show each font name rendered in its own face)
- [ ] **Expandable color picker** (full hue wheel + brightness/saturation, not just 16 swatches)
- [ ] **Opacity slider** for text
- [ ] **Letter spacing control**
- [ ] **Line height control**

### Phase 2: Canvas-Based Editor (4-6 weeks)

Replace CSS overlay with react-konva interactive canvas:

- [ ] **react-konva canvas** replacing CSS overlay preview
- [ ] **Drag-and-drop positioning** (free placement, not just top/center/bottom)
- [ ] **Resize handles** (scale text/images freely)
- [ ] **Rotation** (rotate any element)
- [ ] **Multi-layer support** (text + image + shape layers)
- [ ] **Layer panel** (reorder, visibility, lock)
- [ ] **Snap-to-grid** and alignment guides
- [ ] **Undo/redo** (history stack)
- [ ] **Save/load designs** (serialize Konva state to Supabase)
- [ ] **Print area boundary** visualization on canvas

### Phase 3: Text Effects Engine (3-4 weeks)

- [ ] **Text warping** via Warp.js (arc, wave, flag, bulge -- 10 presets)
- [ ] **Neon glow effect** (canvas multi-pass shadow)
- [ ] **3D extrusion effect** (canvas stacked offset)
- [ ] **Emboss/deboss effect**
- [ ] **Text on path** (circle, custom curve)
- [ ] **Per-letter coloring** (via opentype.js glyph extraction)
- [ ] **Distressed/vintage texture** overlay on text
- [ ] **Chrome/metallic gradient** effect

### Phase 4: Templates & Generators (3-4 weeks)

- [ ] **Template gallery** (20-50 POD-specific templates)
- [ ] **Monogram generator** (1-3 initials + frame style)
- [ ] **Badge/emblem creator** (layered builder with arced text)
- [ ] **Pattern generator** (geometric tiles, waves, dots)
- [ ] **Color palette generator** (from image extraction or color theory)
- [ ] **Font pairing suggestions** (auto-suggest complementary fonts)
- [ ] **Vintage/retro effect one-click presets**

### Phase 5: Advanced Features (4-6 weeks)

- [ ] **Multi-position design** (front + back + sleeves in one session)
- [ ] **Real-time 3D mockup** (Three.js basic product models)
- [ ] **Collaborative design** (share link, real-time co-editing)
- [ ] **Design marketplace** (users sell/share templates)
- [ ] **AI design refinement** (generate base with AI, edit with tools)
- [ ] **Vector shape library** (500+ icons/clipart curated for POD)
- [ ] **Background removal** integrated into canvas (already have rembg)
- [ ] **Image filters** (brightness, contrast, saturation, blur, sharpen)
- [ ] **Clipping masks** (text filled with image/pattern)
- [ ] **SVG import** (upload SVG, edit as vector objects)
- [ ] **Bulk design** (apply one design to multiple products simultaneously)

### Phase 6: Print Production Pipeline (2-3 weeks)

- [ ] **300 DPI server-side render** (extend composition-renderer.ts for Konva JSON)
- [ ] **CMYK color space warning** (flag colors that won't reproduce well in print)
- [ ] **Bleed area visualization** (show safe zone vs bleed)
- [ ] **DPI indicator** (show effective DPI for uploaded images at current scale)
- [ ] **Print-ready PDF export** (with bleeds, crop marks)
- [ ] **Direct Printify upload** from editor

---

## Appendix A: Library Links & Resources

### Canvas Libraries
- [Fabric.js](https://fabricjs.com/) -- Powerful canvas library with serialization
- [Konva.js](https://konvajs.org/) -- High-performance canvas with React bindings
- [react-konva](https://konvajs.org/docs/react/index.html) -- React wrapper for Konva
- [Polotno SDK](https://polotno.com/) -- Complete design editor framework

### Text Effects
- [Warp.js](https://github.com/benjamminf/warpjs) -- SVG warping in the browser
- [opentype.js](https://github.com/opentypejs/opentype.js) -- Font parsing and glyph path extraction
- [CSS 3D Text Effects collection](https://freefrontend.com/css-3d-text-effects/)
- [SVG Filters for 80s effects](https://www.coding-dude.com/wp/css/svg-filters/)
- [Neon text with CSS](https://css-tricks.com/how-to-create-neon-text-with-css/)

### Pattern & Color
- [GeoPattern](https://github.com/btmills/geopattern) -- SVG patterns from strings
- [Pattern Monster](https://pattern.monster) -- SVG pattern generator
- [chroma.js](https://gka.github.io/chroma.js/) -- Color manipulation (13.5KB, 0 deps)
- [palette.js](https://github.com/google/palette.js) -- Categorical color palettes (Google)
- [kolorwheel.js](https://github.com/ern0/kolorwheel.js/) -- Palette generator from base color

### Typography
- [Fontpair](https://www.fontpair.co/) -- Google Fonts pairing (1000+ combos)
- [Fontjoy](https://fontjoy.com/) -- AI font pairing generator
- [Google Fonts API](https://fonts.google.com/) -- 1500+ free fonts

### Design References
- [Kittl](https://www.kittl.com/) -- Best-in-class POD design tool
- [Custom Ink Design Lab](https://www.customink.com/) -- Leading apparel customizer
- [Fancy Product Designer](https://fancyproductdesigner.com/) -- Product customization plugin
- [IMG.LY CE.SDK](https://img.ly/products/creative-sdk) -- Enterprise design editor SDK
- [Graffiti Empire Generator](https://www.graffiti-empire.com/graffiti-generator/) -- Text effect inspiration

### Export & Print
- [Konva High-Quality Export](https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html)
- [Canvas to print-optimized file](https://dev.to/doener48/export-the-html-canvas-as-print-optimized-file-61m)

### Open Source Design Editors
- [react-design-editor](https://github.com/salgum1114/react-design-editor) -- React + Fabric.js
- [Webster](https://github.com/YaroslavChuiko/Webster) -- React + Konva + NestJS
- [Penpot](https://penpot.app/) -- Full open-source design tool (Figma alternative)

---

## Appendix B: Quick Wins (Can Implement This Week)

These improvements require no new libraries and enhance the current CSS-based preview:

1. **Text outline effect** -- Add `-webkit-text-stroke` toggle with width + color pickers
2. **Text shadow effect** -- Add `text-shadow` toggle with blur, offset, color controls
3. **Gradient text** -- Add `background: linear-gradient` + `background-clip: text` option
4. **Expanded font list** -- Add 18+ more Google Fonts with `@import` on demand
5. **Full color picker** -- Replace 16 swatches with a full HSL wheel (use an existing shadcn-compatible component)
6. **Continuous font size** -- Replace S/M/L buttons with a range slider
7. **Letter spacing** -- Add a range slider for CSS `letter-spacing`
8. **Opacity control** -- Add a range slider for text opacity
9. **Duplicate recent** -- Let users duplicate a recent personalization as starting point
10. **Multi-product preview** -- Show the same text on 2-3 product types side by side
