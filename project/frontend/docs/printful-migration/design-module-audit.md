# Design Module -- Complete Codebase Audit

**Date**: 2026-03-02
**Purpose**: Full documentation of the AI Design module for the Printify-to-Printful migration.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Components](#2-components)
3. [Libraries](#3-libraries)
4. [API Routes](#4-api-routes)
5. [Image Generation Providers](#5-image-generation-providers)
6. [Database Schema](#6-database-schema)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Migration Impact -- Printify-Coupled Code](#8-migration-impact----printify-coupled-code)

---

## 1. Architecture Overview

The Design Module enables three customer-facing design capabilities:

1. **Text Personalization** -- customers add custom text (font, color, position, alignment) to products
2. **AI Design Generation** -- customers describe a design via prompt; the system generates images using multi-provider AI (fal.ai, OpenAI, Ideogram, Recraft) with intent-based routing
3. **Image Upload** -- customers upload their own image (PNG/JPEG/WebP, max 5MB) with optional background removal

The module spans:
- **7 React components** (client-side UI)
- **8 library files** (server-side orchestration, rendering, cost management)
- **7 API routes** (CRUD, generation, preview, composition, create-product pipeline)
- **4 database tables** + 1 altered table (design_sessions, ai_generations, user_design_assets, design_compositions, cart_items)
- **4 image generation providers** (fal.ai variants, OpenAI, Ideogram, Recraft)
- **1 context provider** (DesignContext for cross-component state)

---

## 2. Components

### 2.1 DesignStudio

**File**: `src/components/products/DesignStudio.tsx`

**Purpose**: Main design studio modal/sheet that provides a tabbed interface for all three design modes (Text, AI Design, Upload). Desktop uses a Dialog, mobile uses a bottom Sheet.

**Key interfaces**:
```typescript
interface DesignStudioProps {
  productId: string
  productTitle: string
  productImage?: string
  category?: string
  productColor?: string
  onApply?: (result: { type: 'personalization' | 'composition'; id: string }) => void
  onClose?: () => void
  trigger?: React.ReactNode
}
```

**External dependencies**: None directly. Delegates to child components.

**Printify coupling**: None. Product-agnostic -- uses generic product properties.

**User-facing features**:
- Three tabs: Text (personalization), AI Design (generation), Upload (own image)
- Tracks generation budget (remaining/total)
- Auth gate on AI tab (unauthenticated users see lock overlay)
- Calls `/api/designs/generate` for AI generation (NOTE: different from `/api/designs/ai-generate`; the `handleGenerate` sends to `/api/designs/generate` which may be a legacy/alternate endpoint or mapped differently)
- Apply button returns result via `onApply` callback with type discriminator

**Data flow**: User interaction -> child component -> DesignStudio state -> `onApply` callback to parent (typically ProductDetailClient)

---

### 2.2 AIPreviewCanvas

**File**: `src/components/products/AIPreviewCanvas.tsx`

**Purpose**: Displays a preview of an AI-generated design overlaid on the product image, with opacity control and generation metadata badges (provider, inference time).

**Key interfaces**:
```typescript
interface AIPreviewCanvasProps {
  productImage?: string
  designUrl?: string
  category?: string
  opacity?: number
  provider?: string
  inferenceMs?: number
  onOpacityChange?: (opacity: number) => void
}
```

**External dependencies**: Imports `getPreviewZone` from `@/lib/print-areas`.

**Printify coupling**: **INDIRECT** -- uses `getPreviewZone(category)` which returns CSS percentage positions calibrated to Printify product photography. The `CSS_PREVIEW_ZONES` in `print-areas.ts` are tuned to how Printify mockup photos look, not production print areas.

**User-facing features**: Product image with design overlay, opacity slider (50-100%), provider/timing badges.

---

### 2.3 AIPromptEditor

**File**: `src/components/products/AIPromptEditor.tsx`

**Purpose**: Simple textarea for AI design prompts with a generate button. Supports Cmd/Ctrl+Enter shortcut.

**Key interfaces**:
```typescript
interface AIPromptEditorProps {
  onGenerate: (prompt: string, stylePreset?: string) => void
  isGenerating: boolean
  disabled?: boolean
  stylePreset?: string | null
}
```

**External dependencies**: None.

**Printify coupling**: None.

**User-facing features**: Textarea with placeholder, generate button with loading state.

---

### 2.4 ProductPersonalizer

**File**: `src/components/products/ProductPersonalizer.tsx`

**Purpose**: Full-featured text personalization dialog with live preview, font selection (12 fonts), color picker (16 swatches + hex input), position control (top/center/bottom), text alignment (L/C/R), font size (S/M/L), profanity filter, WCAG contrast warnings, overflow detection, image upload with background removal, recent personalizations history, and quick vs accurate preview modes.

**Key interfaces**:
```typescript
export interface PersonalizationData {
  text: string
  font: string
  fontColor: string
  fontSize: 'small' | 'medium' | 'large'
  position: 'top' | 'center' | 'bottom'
  textAlign?: 'left' | 'center' | 'right'
  surcharge?: number | null
}

// Printify-specific position/size mappings
export const POSITION_MAP = { top: 0.15, center: 0.50, bottom: 0.85 } as const
export const SIZE_MAP = { small: 16, medium: 24, large: 36 } as const
```

**External dependencies**:
- `getPreviewZone`, `getPrintArea`, `LINE_HEIGHT` from `@/lib/print-areas`
- `containsProfanity`, `getProfanityErrorMessage` from `@/lib/profanity-filter`
- Fetches `/api/storefront/personalization-surcharge` (surcharge config)
- Fetches `/api/designs/personalizations/history` (recent history)
- Fetches `/api/designs/preview-text` (server-rendered accurate preview)
- Fetches `/api/designs/remove-bg` (background removal for uploaded images)

**Printify coupling**: **YES** -- `POSITION_MAP` and `SIZE_MAP` constants map to **Printify y-coordinate and font_size values** used when creating personalized products in Printify. The `getMockupTemplate()` function maps categories to local mockup template files that simulate Printify product photography. The `getPrintArea()` call returns pixel dimensions calibrated for Printify print specifications.

**User-facing features**: Full text editor, color picker, font selector, position/alignment/size controls, live CSS preview (instant) or server-rendered preview (1-2s), image upload with bg removal, recent personalizations, overflow warning, contrast warning, surcharge display.

---

### 2.5 DesignHistoryPanel

**File**: `src/components/products/DesignHistoryPanel.tsx`

**Purpose**: Horizontal scrollable strip showing thumbnails of user's previous AI-generated designs. Clicking a thumbnail fires `onSelect` callback.

**Key interfaces**:
```typescript
interface Generation {
  id: string
  prompt: string
  image_url: string
  provider: string
  inference_ms: number
  created_at: string
}
```

**External dependencies**: Fetches `/api/designs/history`.

**Printify coupling**: None.

**User-facing features**: Thumbnail grid of past designs, loading skeleton, empty state.

---

### 2.6 GenerationCostBadge

**File**: `src/components/products/GenerationCostBadge.tsx`

**Purpose**: Visual badge showing remaining/total generations with color coding (green >50%, yellow 20-50%, red <20%).

**External dependencies**: None.

**Printify coupling**: None.

---

### 2.7 AuthGateOverlay

**File**: `src/components/products/AuthGateOverlay.tsx`

**Purpose**: Blurred overlay with lock icon and sign-in CTA shown over AI design features for unauthenticated users.

**External dependencies**: None.

**Printify coupling**: None.

---

### 2.8 StyleSelector

**File**: `src/components/products/StyleSelector.tsx`

**Purpose**: Grid of 8 design style presets (Minimalist, Vintage, Geometric, Watercolor, Pop Art, Line Art, Botanical, Typography) with i18n support. Toggleable selection.

**External dependencies**: Imports `DESIGN_PRESETS` from `@/lib/design-presets`.

**Printify coupling**: None.

---

### 2.9 DesignContext (State Management)

**File**: `src/components/storefront/DesignContext.tsx`

**Purpose**: React context providing shared design state across components. Tracks active product, latest design URL, and latest generation ID.

**Key interfaces**:
```typescript
interface DesignContextType {
  activeProductId: string | null
  setActiveProductId: (id: string | null) => void
  latestDesignUrl: string | null
  setLatestDesignUrl: (url: string | null) => void
  latestGenerationId: string | null
  setLatestGenerationId: (id: string | null) => void
}
```

**Printify coupling**: None.

---

## 3. Libraries

### 3.1 ai-design-orchestrator.ts

**File**: `src/lib/ai-design-orchestrator.ts`

**Purpose**: Classifies user prompts into design intents via keyword heuristics, then engineers prompts with style preset suffixes and product-type context. Produces both positive and negative prompts.

**Key interfaces**:
```typescript
export interface OrchestrationResult {
  engineeredPrompt: string
  negativePrompt: string
  intent: DesignIntent  // 'artistic' | 'text-heavy' | 'photorealistic' | 'vector' | 'pattern' | 'quick-draft' | 'general'
  confidence: number    // 0-1
}
```

**External dependencies**: Imports from `./providers/router` (DesignIntent type), `./providers/prompt-engineer`, `./design-presets`.

**Printify coupling**: None. Intent classification and prompt engineering are POD-provider-agnostic.

---

### 3.2 design-generation.ts

**File**: `src/lib/design-generation.ts`

**Purpose**: Core design generation logic. Uses the intent-based router to select the best provider, adapts prompts per-provider, and executes generation with automatic fallbacks.

**Key interfaces**:
```typescript
export interface DesignGenerationParams {
  prompt: string
  style?: string
  negativePrompt?: string
  intent?: DesignIntent
  transparentBg?: boolean
  format?: 'png' | 'svg'
}

export interface DesignGenerationResult {
  success: boolean
  imageUrl?: string
  provider?: string
  costUsd?: number
  seed?: number
  timings?: { inference: number }
  // ...
}
```

**External dependencies**: Provider implementations (FalProvider, OpenAIProvider, IdeogramProvider, RecraftProvider).

**Printify coupling**: None. This generates design images that are provider-agnostic.

---

### 3.3 composition-renderer.ts

**File**: `src/lib/composition-renderer.ts`

**Purpose**: Server-side renderer using Sharp (libvips) and node-canvas for multi-layer design compositions. Supports preview (1024x1024) and production-resolution export. Registers 12 custom fonts from `public/fonts/`.

**Key interfaces**:
```typescript
export interface CompositionLayer {
  type: 'text' | 'image' | 'ai'
  url?: string
  text?: string
  font?: string
  color?: string
  fontSize?: string   // 'small' | 'medium' | 'large' or pixel value
  position?: string   // 'top' | 'center' | 'bottom'
  textAlign?: string  // 'left' | 'center' | 'right'
}
```

**External dependencies**:
- `sharp` (libvips image processing)
- `canvas` (node-canvas for text rendering)
- `@/lib/print-areas` (PRINT_AREAS, PRODUCTION_DIMENSIONS)
- `@/lib/supabase-admin` (storage upload + DB updates)

**Printify coupling**: **YES** -- The `PRINT_AREAS` and `PRODUCTION_DIMENSIONS` imported from `print-areas.ts` define pixel coordinates and production sizes that correspond to **Printify blueprint specifications**. The `exportForProduction()` function generates images at Printify production dimensions (e.g., 3600x4800 for t-shirts) and uploads to Supabase Storage, from which they are submitted to Printify.

---

### 3.4 design-presets.ts

**File**: `src/lib/design-presets.ts`

**Purpose**: Library of 8 curated design style presets with i18n names/descriptions, prompt suffixes, negative prompts, preferred intents, and suggested color palettes.

**Presets**: minimalist, vintage, geometric, watercolor, pop-art, line-art, botanical, typography.

**Printify coupling**: None. Style presets are POD-provider-agnostic.

---

### 3.5 design-cost-guard.ts

**File**: `src/lib/design-cost-guard.ts`

**Purpose**: Server-side spending limiter. Queries `ai_generations` table for monthly cost totals and enforces per-generation and per-month budget caps by user tier.

**Cost limits**:
| Tier | Per Generation | Monthly Budget |
|------|---------------|----------------|
| free | $0.05 | $2.50 |
| premium | $0.15 | $25.00 |

**External dependencies**: `@/lib/supabase-admin` (queries `ai_generations.cost_usd`).

**Printify coupling**: None.

---

### 3.6 mockup-generator.ts

**File**: `src/lib/mockup-generator.ts`

**Purpose**: Composes AI-generated designs onto product mockup templates using Sharp. Supports watermarking for anonymous users. Uploads results to Supabase Storage. Also has a `generatePrintifyMockup()` function that fetches mockups directly from Printify's API.

**Key interfaces**:
```typescript
export interface MockupOptions {
  designUrl: string
  productType: 'tshirt' | 'hoodie' | 'mug' | 'phone-case' | 'tote-bag'
  color?: string
  watermark?: boolean
}
```

**External dependencies**:
- `sharp` (image compositing)
- `@/lib/supabase-admin` (storage upload)
- `@/lib/print-areas` (PRINT_AREAS, TEMPLATE_COLORS)
- **Printify API** (in `generatePrintifyMockup()`)

**Printify coupling**: **HEAVY**
- `generatePrintifyMockup()` calls `https://api.printify.com/v1/shops/{id}/products/{id}.json` to fetch mockup images directly from Printify
- Uses `PRINTIFY_TOKEN` and `PRINTIFY_SHOP_ID` env vars
- Template paths follow the pattern `mockup-templates/{productType}-{color}.png` which are Printify-style mockup photos
- `PRINT_AREAS` coordinates are calibrated for Printify product templates

---

### 3.7 branded-mockup-generator.ts

**File**: `src/lib/branded-mockup-generator.ts`

**Purpose**: Composites Printify mockups onto branded backgrounds. Pipeline: fetch mockup from Printify CDN -> remove white background (rembg sidecar or Sharp threshold) -> composite on branded SVG background -> output.

**External dependencies**:
- `sharp` (image processing)
- `@/lib/mockup-backgrounds` (SVG background templates per category)
- rembg HTTP sidecar (`http://localhost:8080/api/remove`)

**Printify coupling**: **HEAVY**
- Fetches mockup images from **Printify CDN URLs** (`input.mockupUrl`)
- Background removal is specifically tuned for Printify's white-background mockup photos
- The `WHITE_THRESHOLD = 235` constant is calibrated for Printify mockup backgrounds
- Category-to-background mapping assumes Printify product photography style

---

### 3.8 print-areas.ts

**File**: `src/lib/print-areas.ts`

**Purpose**: Central definition of print area coordinates, preview zones, and production dimensions. Shared between mockup generator, composition renderer, and frontend preview components.

**Key data structures**:

```typescript
// Print areas on 1024x1024 canvas (for mockup generation & composition)
export const PRINT_AREAS: Record<string, PrintArea> = {
  'tshirt':     { x: 312, y: 200, w: 400, h: 500 },
  'hoodie':     { x: 300, y: 220, w: 420, h: 480 },
  'mug':        { x: 150, y: 180, w: 350, h: 300 },
  'phone-case': { x: 100, y: 150, w: 300, h: 550 },
  'tote-bag':   { x: 200, y: 150, w: 400, h: 500 },
  'hat':        { x: 262, y: 280, w: 500, h: 280 },
}

// Production resolution per product type (for Printify fulfillment)
export const PRODUCTION_DIMENSIONS: Record<string, { w: number; h: number }> = {
  'tshirt':     { w: 3600, h: 4800 },
  'hoodie':     { w: 3000, h: 3600 },
  'mug':        { w: 2850, h: 1050 },
  'phone-case': { w: 750,  h: 1500 },
  'tote-bag':   { w: 3600, h: 3600 },
  'hat':        { w: 1650, h: 750 },
}

// CSS preview zones for frontend overlay on Printify product photos
export const CSS_PREVIEW_ZONES: Record<string, PreviewZone> = {
  'tshirt':     { top: '28%', left: '27%', width: '46%', height: '34%' },
  'hoodie':     { top: '32%', left: '25%', width: '50%', height: '30%' },
  // ...
}

// Category-to-product-type mapping
export const CATEGORY_TO_PRODUCT_TYPE: Record<string, string> = {
  'apparel': 'tshirt',
  't-shirts': 'tshirt',
  'hoodies': 'hoodie',
  // ...
}
```

**Printify coupling**: **CRITICAL -- THIS IS THE CENTRAL COUPLING POINT**
- `PRINT_AREAS` pixel coordinates correspond to Printify mockup template geometry
- `PRODUCTION_DIMENSIONS` are **Printify blueprint print file specifications** (3600x4800 for t-shirts, etc.)
- `CSS_PREVIEW_ZONES` are calibrated for **Printify product photography** visual positioning
- `TEMPLATE_COLORS` lists available Printify mockup color variants
- All downstream code (composition-renderer, mockup-generator, ProductPersonalizer, AIPreviewCanvas) depends on these values

---

## 4. API Routes

### 4.1 POST /api/designs (CRUD)

**File**: `src/app/api/designs/route.ts`

**Purpose**: Save (POST) and list (GET) user designs. POST saves a generated design with `moderation_status='pending'`. GET returns user's own designs (authenticated) or publicly approved designs (unauthenticated).

**External dependencies**: Supabase `designs` table, auth-guard, rate-limit.

**Printify coupling**: None. Stores design metadata, not POD-provider-specific data.

---

### 4.2 POST /api/designs/personalize

**File**: `src/app/api/designs/personalize/route.ts`

**Purpose**: Saves a text personalization to the `personalizations` table as a draft. Anonymous users can personalize (user_id=null). Does NOT create a Printify product -- that happens at checkout.

**Validation**: Profanity filter, max 3 lines, 50 chars/line, valid fontSize/position/textAlign.

**Key DB fields saved**:
```
user_id, product_id, variant_id, text_content, font_family,
font_color, font_size, position, text_align, surcharge_amount,
printify_temp_product_id (null at this stage), status='draft'
```

**Printify coupling**: **INDIRECT** -- The `personalizations` table has a `printify_temp_product_id` column, indicating that at checkout a temporary Printify product is created for the personalized item. The personalization data (position, fontSize) uses values from `POSITION_MAP` and `SIZE_MAP` that map to Printify coordinates.

---

### 4.3 POST /api/designs/preview-text

**File**: `src/app/api/designs/preview-text/route.ts`

**Purpose**: Server-side text preview generation. Uses Sharp + node-canvas to render custom text onto a local mockup template, returns base64 PNG. Rate limited to 20 req/min per IP.

**External dependencies**: Sharp, node-canvas (12 fonts registered), mockup templates from `public/mockup-templates/`.

**Printify coupling**: **INDIRECT** -- Uses local mockup template files at `public/mockup-templates/{productType}-{color}.png` which are screenshots/exports of Printify product photography.

---

### 4.4 POST /api/designs/compose

**File**: `src/app/api/designs/compose/route.ts`

**Purpose**: Creates a multi-layer design composition. Accepts an array of layers (text, image, AI), renders a 1024x1024 preview using `renderCompositionPreview()`, uploads preview to Supabase Storage, and saves to `design_compositions` table.

**External dependencies**: `composition-renderer.ts`, Supabase admin client (storage + DB).

**Printify coupling**: **INDIRECT via composition-renderer** -- The render uses `PRINT_AREAS` from `print-areas.ts` which are Printify-calibrated.

---

### 4.5 POST /api/designs/ai-generate

**File**: `src/app/api/designs/ai-generate/route.ts`

**Purpose**: Primary AI design generation endpoint. Full pipeline: auth -> rate limit (5/min) -> content safety -> usage limits (tier-based) -> orchestrate (intent classification + prompt engineering) -> cost guard -> create design session -> generate image (multi-provider with fallbacks) -> save to ai_generations table.

**External dependencies**:
- `auth-guard` (requireAuth)
- `content-safety` (checkPromptSafety)
- `usage-limiter` (tier-based usage tracking)
- `ai-design-orchestrator` (intent classification)
- `design-generation` (multi-provider generation)
- `design-cost-guard` (spending limits)
- Supabase admin (design_sessions + ai_generations tables)

**Printify coupling**: None. Generates images that are POD-provider-agnostic.

---

### 4.6 POST /api/designs/:id/create-product

**File**: `src/app/api/designs/[id]/create-product/route.ts`

**Purpose**: **THE PRIMARY PRINTIFY INTEGRATION POINT**. Converts an approved design into a Printify product. Full pipeline: validate design approved -> auto-remove background if needed -> upload image to Printify -> create product with blueprint/provider/variants -> publish -> save to products table -> confirm publishing.

**Auth**: Bearer token (PodClaw/cron only, not user-facing).

**Request body**:
```typescript
{
  blueprint_id: number           // Printify blueprint ID
  print_provider_id: number      // Printify print provider ID
  variants: Array<{ id: number; price: number; is_enabled: boolean }>
  title?: string
  description?: string
  tags?: string[]
  has_neck_position?: boolean    // Whether to add neck label
}
```

**External dependencies**:
- `@/lib/printify` (PrintifyClient: uploadImage, createProduct, publishProduct, publishingSucceeded)
- `@/lib/store-config` (isEUProvider validation)
- `@/lib/providers/background-removal` (auto bg-removal)
- Supabase admin (designs, products, brand_config tables)

**Printify coupling**: **CRITICAL -- MOST TIGHTLY COUPLED FILE**
- Calls Printify API directly via PrintifyClient:
  - `printify.uploadImage()` -- uploads design image to Printify
  - `printify.createProduct()` -- creates product with blueprint_id, print_provider_id, variants, print_areas
  - `printify.publishProduct()` -- publishes to connected sales channels
  - `printify.publishingSucceeded()` -- confirms custom integration publishing
- Uses Printify-specific concepts: blueprint_id, print_provider_id, variant IDs, print_areas with placeholders (position: 'front', 'neck')
- EU provider validation via `isEUProvider()`
- Stores `printify_id` and `printify_upload_id` in database

---

### 4.7 GET /api/designs/history

**File**: `src/app/api/designs/history/route.ts`

**Purpose**: Returns user's AI generation history from `ai_generations` table. Supports limit and product_type query params.

**Printify coupling**: None.

---

### 4.8 GET /api/designs/personalizations/history

**File**: `src/app/api/designs/personalizations/history/route.ts`

**Purpose**: Returns 10 most recent personalizations for the authenticated user from `personalizations` table via RLS-protected query.

**Printify coupling**: None directly (data may contain Printify-specific position/size values).

---

## 5. Image Generation Providers

### Provider Architecture

**File**: `src/lib/providers/`

The system uses a multi-provider abstraction with intent-based routing:

```
types.ts          -- ImageProvider interface + GenerationRequest/Response types
router.ts         -- Intent-to-provider routing table with fallbacks
prompt-engineer.ts -- Per-provider prompt adaptation
fal-provider.ts   -- fal.ai (Flux Schnell/Dev/Pro) implementation
openai-provider.ts -- OpenAI GPT Image implementation
ideogram-provider.ts -- Ideogram API implementation
recraft-provider.ts -- Recraft API implementation
background-removal.ts -- rembg sidecar integration
storage-upload.ts -- Supabase Storage upload helper
```

### Routing Table (Intent -> Providers)

| Intent | Primary | Fallback 1 | Fallback 2 |
|--------|---------|-----------|-----------|
| artistic | fal/flux-pro | fal/dev | OpenAI |
| text-heavy | Ideogram | OpenAI | fal/flux-pro |
| photorealistic | OpenAI | fal/flux-pro | fal/dev |
| vector | Recraft | Ideogram | fal/dev |
| pattern | fal/flux-pro | fal/dev | Ideogram |
| quick-draft | fal/schnell | fal/dev | -- |
| general | fal/dev | OpenAI | Ideogram |

### Provider Capabilities (from types.ts)

```typescript
interface ProviderCapabilities {
  maxWidth: number
  maxHeight: number
  supportsTransparentBg: boolean
  supportsSvg: boolean
  supportsImg2Img: boolean
  textQuality: 1-5
  photorealism: 1-5
  maxBatchSize: number
}
```

**Printify coupling**: None. The provider layer is entirely POD-agnostic.

---

## 6. Database Schema

### 6.1 design_sessions

```sql
CREATE TABLE design_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_type TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'abandoned')),
  style_preset TEXT,
  total_generations INTEGER DEFAULT 0,
  total_cost_usd DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

**Purpose**: Groups multiple AI generations into a single design session for a product.

**RLS**: Enabled (owner-only read/write + service role bypass).

**Printify coupling**: None.

---

### 6.2 ai_generations

```sql
CREATE TABLE ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES design_sessions(id) ON DELETE CASCADE,  -- nullable (migration 201500)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  engineered_prompt TEXT,
  negative_prompt TEXT,
  intent TEXT CHECK (intent IN ('artistic','text-heavy','photorealistic','vector','pattern','quick-draft','general')),
  provider TEXT NOT NULL,
  image_url TEXT,
  cost_usd DECIMAL(10,4) DEFAULT 0,
  inference_ms INTEGER,
  is_refinement BOOLEAN DEFAULT false,
  parent_generation_id UUID REFERENCES ai_generations(id),
  moderation_status TEXT DEFAULT 'approved',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Added via migration 201100:
  confidence DECIMAL(3,2),
  style_preset TEXT,
  product_type TEXT,
  product_id TEXT,
  seed TEXT
);
```

**Purpose**: Records every AI image generation with full audit trail (prompt, engineered prompt, provider, cost, timing, seed).

**Printify coupling**: None.

---

### 6.3 user_design_assets

```sql
CREATE TABLE user_design_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  processed_url TEXT,
  thumbnail_url TEXT,
  filename TEXT,
  mime_type TEXT,
  file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  has_transparency BOOLEAN DEFAULT false,
  source TEXT NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload', 'ai_generation', 'chat')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Stores metadata about user-uploaded or AI-generated design assets.

**Printify coupling**: None.

---

### 6.4 design_compositions

```sql
CREATE TABLE design_compositions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES design_sessions(id),
  product_id UUID REFERENCES products(id),
  product_type TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1,
  layers JSONB NOT NULL DEFAULT '[]'::jsonb,
  preview_url TEXT,
  production_url TEXT,
  surcharge_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'applied', 'ordered')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Stores multi-layer design compositions with preview and production URLs. The `layers` JSONB column holds `CompositionLayer[]` data.

**Printify coupling**: **INDIRECT** -- `production_url` is the URL of the production-resolution image rendered at Printify-specific dimensions (via `PRODUCTION_DIMENSIONS` in `print-areas.ts`).

---

### 6.5 cart_items (altered)

```sql
ALTER TABLE cart_items ADD COLUMN composition_id UUID REFERENCES design_compositions(id);
```

**Purpose**: Links cart items to design compositions, enabling custom-designed products in the cart/checkout flow.

**Printify coupling**: The composition's `production_url` is what gets uploaded to Printify at checkout time.

---

### 6.6 personalizations (pre-existing, not in design migrations)

Referenced in API routes. Key columns:
```
id, user_id, product_id, variant_id, text_content, font_family,
font_color, font_size, position, text_align, surcharge_amount,
printify_temp_product_id, status, preview_url, created_at
```

**Printify coupling**: `printify_temp_product_id` column stores the Printify product ID created at checkout for personalized items.

---

## 7. Data Flow Diagrams

### 7.1 Text Personalization Flow

```
User opens ProductPersonalizer dialog
    |
    v
[Frontend] Fetches surcharge config (GET /api/storefront/personalization-surcharge)
[Frontend] Fetches recent personalizations (GET /api/designs/personalizations/history)
    |
    v
User configures: text, font, color, size, position, alignment
    |
    +--> [Quick Preview] CSS overlay on product image (instant, client-side)
    |         Uses getPreviewZone(category) from print-areas.ts
    |
    +--> [Accurate Preview] POST /api/designs/preview-text
    |         Server renders with Sharp + node-canvas on mockup template
    |
    v
User clicks "Apply"
    |
    v
[Frontend] Validates (profanity, overflow), calls onPersonalized(data)
    |
    v
[Parent] Sends PersonalizationData to cart or POST /api/designs/personalize
    |
    v
[DB] personalizations table (status='draft', printify_temp_product_id=null)
    |
    v
[Checkout] Creates temp Printify product with personalized print_areas
           Stores printify_temp_product_id in personalizations
```

### 7.2 AI Design Generation Flow

```
User opens DesignStudio -> AI Design tab
    |
    v
[Auth Gate] If not authenticated, show AuthGateOverlay
    |
    v
User selects style preset (optional) + enters prompt
    |
    v
[Frontend] POST /api/designs/ai-generate
    |
    v
[Server] Pipeline:
    1. requireAuth(req) --> user
    2. designGenerateLimiter.check() --> rate limit (5/min)
    3. aiGenerateSchema.safeParse() --> input validation
    4. checkPromptSafety(prompt) --> content safety
    5. checkAndIncrementUsage() --> tier-based usage limit
    6. orchestrateDesign(prompt, productType, stylePreset)
       |-- classifyIntent(prompt) --> intent + confidence
       |-- findPreset(stylePreset) --> preset.promptSuffix
       |-- Add "suitable for {productType} print"
       |-- Build negativePrompt (preset + defaults)
    7. estimateDesignCost({ intent }) --> costEstimate
    8. checkCostGuard(userId, tier, cost)
       |-- getMonthlySpend(userId) from ai_generations
    9. Create design_sessions row
   10. generateDesign({prompt, negativePrompt, intent, transparentBg})
       |-- routeDesign(intent) --> primary + fallback providers
       |-- engineerPrompt(providerName, prompt, style)
       |-- provider.generate(request) [tries each until success]
   11. Save to ai_generations table
    |
    v
[Frontend] Receives { image_url, provider, inference_ms }
    |
    v
AIPreviewCanvas displays design overlaid on product image
    |
    v
User clicks "Apply Design"
    |
    v
onApply({ type: 'composition', id: designUrl })
```

### 7.3 Design-to-Product Pipeline (Admin/PodClaw)

```
Approved design in designs table
    |
    v
POST /api/designs/:id/create-product (Bearer auth, PodClaw/cron)
    |
    v
[Server] Pipeline:
    1. Verify design moderation_status = 'approved'
    2. Get image URL (prefer bg_removed_url, else auto-remove via rembg)
    3. Upload image to Printify:
       POST /v1/uploads/images.json --> printify_upload_id
    4. Create Printify product:
       POST /v1/shops/{shopId}/products.json
       {
         blueprint_id,
         print_provider_id,
         variants: [{ id, price, is_enabled }],
         print_areas: [{
           variant_ids,
           placeholders: [
             { position: 'front', images: [{ id, x: 0.5, y: 0.5, scale: 1 }] },
             { position: 'neck', images: [...] }  // optional neck label
           ]
         }]
       }
    5. Publish: POST .../publish.json
    6. Insert into products table (printify_id, status='draft')
    7. Confirm: POST .../publishing_succeeded.json (external.id = DB UUID)
    |
    v
Product available in shop after cron sync
```

### 7.4 Composition Flow

```
User creates multi-layer design (text + AI image + upload)
    |
    v
POST /api/designs/compose
    {
      layers: [
        { type: 'text', text: '...', font: '...', color: '...' },
        { type: 'ai', url: 'https://...' },
        { type: 'image', url: 'https://...' }
      ],
      product_type: 'tshirt',
      product_id: '...'
    }
    |
    v
[Server] renderCompositionPreview(layers, productType)
    |-- Create 1024x1024 transparent canvas (Sharp)
    |-- For each layer:
    |     text -> renderTextToBuffer() via node-canvas
    |     image/ai -> fetch URL -> Sharp resize to PRINT_AREAS[type]
    |-- Composite all layers at PRINT_AREAS[type] coordinates
    |
    v
Upload preview to Supabase Storage (designs/compositions/{id}/preview.png)
    |
    v
Save to design_compositions table (layers JSONB, preview_url)
    |
    v
[At checkout] exportForProduction(compositionId)
    |-- Load layers from DB
    |-- Render at PRODUCTION_DIMENSIONS (e.g. 3600x4800)
    |-- Upload to Supabase Storage
    |-- Update design_compositions.production_url
    |-- Upload production image to Printify
```

---

## 8. Migration Impact -- Printify-Coupled Code

### 8.1 Summary Table

| File | Coupling Level | What Needs to Change |
|------|---------------|---------------------|
| `src/lib/print-areas.ts` | **CRITICAL** | All PRINT_AREAS, PRODUCTION_DIMENSIONS, CSS_PREVIEW_ZONES must be remapped to Printful equivalents |
| `src/app/api/designs/[id]/create-product/route.ts` | **CRITICAL** | Entire file must be rewritten for Printful API (different product creation flow, no blueprint_id concept) |
| `src/lib/mockup-generator.ts` | **HIGH** | `generatePrintifyMockup()` must become `generatePrintfulMockup()`; Printful mockup API is different |
| `src/lib/branded-mockup-generator.ts` | **HIGH** | Fetches mockups from Printify CDN; must switch to Printful mockup URLs |
| `src/lib/composition-renderer.ts` | **MEDIUM** | Production export uses PRODUCTION_DIMENSIONS from print-areas.ts; will change when print-areas is updated |
| `src/components/products/ProductPersonalizer.tsx` | **MEDIUM** | POSITION_MAP and SIZE_MAP export Printify-specific y-coordinates and font sizes; getMockupTemplate() references local Printify mockup templates |
| `src/components/products/AIPreviewCanvas.tsx` | **LOW** | Uses getPreviewZone() which will auto-update when print-areas.ts changes |
| `src/app/api/designs/personalize/route.ts` | **LOW** | Stores `printify_temp_product_id` column; need `printful_temp_product_id` or generic `fulfillment_product_id` |
| `src/app/api/designs/preview-text/route.ts` | **LOW** | Uses local mockup template images; need Printful-style templates |
| `src/app/api/designs/compose/route.ts` | **LOW** | Indirectly coupled via composition-renderer |

### 8.2 Detailed Impact by File

#### CRITICAL: `print-areas.ts` (Central Coupling Point)

This file is imported by 5+ other files. Every constant must be re-derived for Printful:

- **PRINT_AREAS**: Pixel coordinates on 1024x1024 canvas. Must be recalculated based on Printful product template geometry.
- **PRODUCTION_DIMENSIONS**: Print file dimensions per product type. Printful uses different specs (check Printful's product specs API: `GET /v2/catalog-products/{id}/print-files`).
- **CSS_PREVIEW_ZONES**: Percentage-based zones for frontend preview overlay. Must be recalibrated to Printful mockup photography.
- **TEMPLATE_COLORS**: Available colors per product type. Must match Printful variant structure.
- **CATEGORY_TO_PRODUCT_TYPE**: Category mapping. May need updating if Printful product types differ.

**Migration strategy**: Create a `print-areas-printful.ts` with Printful-specific values, then swap the import. Or make the module configurable to load from either provider.

#### CRITICAL: `create-product/route.ts` (Printify API Direct Calls)

This file makes 4 Printify API calls and uses Printify-specific concepts:

| Printify Concept | Printful Equivalent | Notes |
|-----------------|---------------------|-------|
| `blueprint_id` | Catalog product ID (`catalog_product_id`) | Different ID scheme |
| `print_provider_id` | N/A (Printful is its own provider) | Printful doesn't have third-party providers |
| `variants[].id` | Variant ID | Different ID scheme |
| `print_areas[].placeholders[].position` | `files[].type` | Printful uses 'front', 'back', etc. in a different structure |
| `printify.uploadImage()` | `POST /v2/files` | Different upload endpoint |
| `printify.createProduct()` | `POST /v2/products` | Different payload structure |
| `printify.publishProduct()` | Automatic (Printful products go live differently) | Printful doesn't have a separate publish step |
| `printify.publishingSucceeded()` | N/A | Printful-specific equivalent would be product sync confirmation |
| `isEUProvider(providerId)` | N/A | Printful handles fulfillment location differently |

**Migration strategy**: Rewrite the entire file. The Printful product creation flow is fundamentally different:
1. Upload file: `POST /v2/files` (multipart form)
2. Create product: `POST /v2/products` with `sync_product` + `sync_variants[]` structure
3. No separate publish step

#### HIGH: `mockup-generator.ts`

The `generatePrintifyMockup()` function (lines 163-195) calls Printify API directly. Must be replaced with Printful's mockup generation API:
- Printful: `POST /v2/mockup-generator/create-task/{id}` (async task-based)
- Different response structure (task ID -> poll for result)

The `generateMockup()` function (lines 36-158) uses local templates and PRINT_AREAS. Will auto-update when print-areas.ts changes, but mockup template images in `public/mockup-templates/` may need replacement with Printful-style photography.

#### HIGH: `branded-mockup-generator.ts`

Fetches mockup images from Printify CDN. The URL pattern and image characteristics (white background, resolution) may differ with Printful. Background removal thresholds may need recalibration.

#### MEDIUM: `composition-renderer.ts`

The `exportForProduction()` function renders at `PRODUCTION_DIMENSIONS` and references `PRINT_AREAS` for scale calculations. These will auto-update when print-areas.ts changes, but the rendering logic may need adjustment if Printful's print file specs have different requirements (e.g., bleed areas, safe zones, DPI requirements).

#### MEDIUM: `ProductPersonalizer.tsx`

Exports `POSITION_MAP` and `SIZE_MAP` that map to Printify-specific coordinates. The `getMockupTemplate()` function maps categories to local template files. These will need updating for Printful's product specs.

### 8.3 Database Changes Required

| Table | Column | Change Needed |
|-------|--------|--------------|
| `personalizations` | `printify_temp_product_id` | Rename to `printful_order_item_id` or generic `fulfillment_reference_id` |
| `products` | `printify_id` | Rename to `printful_id` or generic `fulfillment_id` |
| `designs` | `printify_upload_id` | Rename to `printful_file_id` or generic `fulfillment_file_id` |
| `designs` | `printify_image_url` | Rename to `printful_image_url` or generic `fulfillment_image_url` |

### 8.4 Files with ZERO Printify Coupling (No Changes Needed)

- `src/lib/ai-design-orchestrator.ts` -- pure prompt engineering
- `src/lib/design-presets.ts` -- style preset library
- `src/lib/design-cost-guard.ts` -- cost management
- `src/lib/design-generation.ts` -- multi-provider image generation
- `src/lib/providers/*` -- all image generation providers
- `src/components/products/AIPromptEditor.tsx` -- prompt input UI
- `src/components/products/DesignHistoryPanel.tsx` -- history display
- `src/components/products/GenerationCostBadge.tsx` -- cost badge
- `src/components/products/AuthGateOverlay.tsx` -- auth gate
- `src/components/products/StyleSelector.tsx` -- style presets
- `src/components/storefront/DesignContext.tsx` -- state management
- `src/app/api/designs/route.ts` -- design CRUD
- `src/app/api/designs/ai-generate/route.ts` -- AI generation
- `src/app/api/designs/history/route.ts` -- generation history
- `src/app/api/designs/personalizations/history/route.ts` -- personalization history
- All database tables except column renames

### 8.5 Recommended Migration Order

1. **Phase 1 -- Data Layer**: Create Printful equivalents for `print-areas.ts` dimensions. Research Printful's product specs API to get exact print file dimensions and positions for each product type.

2. **Phase 2 -- Mockup Layer**: Replace local mockup templates with Printful-sourced product images. Update `branded-mockup-generator.ts` to fetch from Printful CDN. Implement Printful's async mockup generation API.

3. **Phase 3 -- Product Creation**: Rewrite `create-product/route.ts` for Printful API. Replace `PrintifyClient` with `PrintfulClient`. Update the checkout flow for personalized products.

4. **Phase 4 -- Database**: Add migration to rename Printify-specific columns to generic or Printful-specific names. Keep old columns temporarily for backward compatibility.

5. **Phase 5 -- Frontend Preview**: Recalibrate `CSS_PREVIEW_ZONES` for Printful product photography. Update `getMockupTemplate()` in ProductPersonalizer. Update `POSITION_MAP` and `SIZE_MAP` for Printful specs.

---

## Appendix: File Index

| Category | File | Lines |
|----------|------|-------|
| Component | `src/components/products/DesignStudio.tsx` | 416 |
| Component | `src/components/products/AIPreviewCanvas.tsx` | 138 |
| Component | `src/components/products/AIPromptEditor.tsx` | 72 |
| Component | `src/components/products/ProductPersonalizer.tsx` | 1052 |
| Component | `src/components/products/DesignHistoryPanel.tsx` | 88 |
| Component | `src/components/products/GenerationCostBadge.tsx` | 28 |
| Component | `src/components/products/AuthGateOverlay.tsx` | 43 |
| Component | `src/components/products/StyleSelector.tsx` | 73 |
| Context | `src/components/storefront/DesignContext.tsx` | 42 |
| Library | `src/lib/ai-design-orchestrator.ts` | 122 |
| Library | `src/lib/design-generation.ts` | 145 |
| Library | `src/lib/composition-renderer.ts` | 379 |
| Library | `src/lib/design-presets.ts` | 180 |
| Library | `src/lib/design-cost-guard.ts` | 102 |
| Library | `src/lib/mockup-generator.ts` | 196 |
| Library | `src/lib/branded-mockup-generator.ts` | 268 |
| Library | `src/lib/print-areas.ts` | 140 |
| Provider | `src/lib/providers/types.ts` | 68 |
| Provider | `src/lib/providers/router.ts` | 133 |
| Provider | `src/lib/providers/prompt-engineer.ts` | 63 |
| API Route | `src/app/api/designs/route.ts` | 147 |
| API Route | `src/app/api/designs/personalize/route.ts` | 146 |
| API Route | `src/app/api/designs/preview-text/route.ts` | 221 |
| API Route | `src/app/api/designs/compose/route.ts` | 165 |
| API Route | `src/app/api/designs/ai-generate/route.ts` | 201 |
| API Route | `src/app/api/designs/[id]/create-product/route.ts` | 249 |
| API Route | `src/app/api/designs/history/route.ts` | 46 |
| API Route | `src/app/api/designs/personalizations/history/route.ts` | 56 |
| Migration | `supabase/migrations/20260228200000_create_design_sessions.sql` | 14 |
| Migration | `supabase/migrations/20260228200300_create_ai_generations.sql` | 19 |
| Migration | `supabase/migrations/20260228200500_create_user_design_assets.sql` | 17 |
| Migration | `supabase/migrations/20260228200700_create_design_compositions.sql` | 16 |
| Migration | `supabase/migrations/20260228200900_cart_items_composition_id.sql` | 1 |
| Migration | `supabase/migrations/20260228201100_ai_generations_add_missing_columns.sql` | 6 |
| Migration | `supabase/migrations/20260228201500_ai_generations_session_nullable.sql` | 1 |
