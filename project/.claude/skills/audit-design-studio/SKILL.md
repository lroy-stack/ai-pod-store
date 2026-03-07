---
name: Design Studio Production Audit
description: >
  Comprehensive audit of the SKAPARA design studio — canvas editor, AI generation pipeline,
  composition rendering, mockup generation, and design-to-product flow. Use when asked to audit
  the design studio, design editor, canvas, AI generation, or product creation pipeline.
---

# Design Studio Production Audit

Systematic audit of the Fabric.js-based design studio: canvas editor, AI multi-provider generation, composition rendering, mockup generation, persistence, and the full design-to-product pipeline.

## Prerequisites

Before starting, read these files for architectural context:

- `CLAUDE.md` — component standards, semantic tokens, route groups, Printful/Supabase connection reference
- `frontend/docs/design-studio-audit/DESIGN_STUDIO_AUDIT_E2E.md` — prior E2E audit (Phases 1-3 status, known bugs)
- `frontend/docs/design-studio-research/11-gap-analysis.md` — gap analysis across prior research reports

## File Map

Keep this reference open throughout the audit. All paths relative to `frontend/src/`.

### Canvas Editor

| File | Role |
|---|---|
| `components/design-studio/DesignStudioPage.tsx` | Top-level orchestrator — mounts canvas, panels, header |
| `components/design-studio/CanvasWorkspace.tsx` | Fabric.js canvas init, object manipulation, export, clipboard |
| `components/design-studio/EditorHeader.tsx` | Save, preview, undo/redo, product info bar |
| `components/design-studio/CanvasToolbar.tsx` | Tool selection (text, image, shapes, draw) |
| `components/design-studio/CanvasProperties.tsx` | Object properties panel (fill, stroke, opacity, shadow, font) |
| `components/design-studio/LayersPanel.tsx` | Layer list, z-order, visibility, lock |
| `components/design-studio/PanelSwitcher.tsx` | Multi-position panel switching (front, back, sleeves) |
| `components/design-studio/ClipartPanel.tsx` | Clipart/asset browser |
| `components/design-studio/TemplatesPanel.tsx` | Template gallery |
| `components/design-studio/PreviewMockupModal.tsx` | Preview overlay with mockup rendering |
| `components/design-studio/EmbroideryConstraints.tsx` | Embroidery-specific validation (colors, line width) |

### Canvas Tools

| File | Role |
|---|---|
| `components/design-studio/tools/TextTool.tsx` | Text object creation and editing |
| `components/design-studio/tools/ImageTool.tsx` | Image upload and placement |
| `components/design-studio/tools/ColorPicker.tsx` | Color selection with brand palette |
| `components/design-studio/tools/FontPicker.tsx` | Font browser and selection |
| `components/design-studio/tools/GradientEditor.tsx` | Gradient fill configuration |
| `components/design-studio/tools/ShadowControl.tsx` | Drop shadow configuration |

### State Management

| File | Role |
|---|---|
| `hooks/useDesignEditor.ts` | Zustand store — canvas state, panels, selected object, variant color |
| `hooks/useCanvasHistory.ts` | Undo/redo stack management |
| `hooks/useCanvasExport.ts` | PNG/production export utilities |
| `hooks/useDesignPersistence.ts` | Auto-save and load from Supabase |

### AI Generation Pipeline

| File | Role |
|---|---|
| `lib/ai-design-orchestrator.ts` | Intent classification, provider selection, prompt routing |
| `lib/design-generation.ts` | Generation execution, retry logic, result processing |
| `lib/design-presets.ts` | Style presets (meme, branded, minimalist, etc.) |
| `lib/design-cost-guard.ts` | Per-user generation limits, tier enforcement |
| `lib/providers/router.ts` | Multi-provider routing (cost, quality, speed) |
| `lib/providers/fal-provider.ts` | fal.ai provider (Flux, SDXL) |
| `lib/providers/openai-provider.ts` | DALL-E 3 provider |
| `lib/providers/ideogram-provider.ts` | Ideogram provider (text rendering) |
| `lib/providers/recraft-provider.ts` | Recraft provider (vector, brand) |
| `lib/providers/prompt-engineer.ts` | Prompt enhancement and safety filtering |
| `lib/providers/background-removal.ts` | Background removal via rembg sidecar |
| `lib/providers/storage-upload.ts` | Supabase Storage upload for generated images |
| `lib/providers/types.ts` | Shared TypeScript types for provider system |

### Composition & Mockup

| File | Role |
|---|---|
| `lib/composition-renderer.ts` | Sharp-based server-side composition rendering |
| `lib/mockup-generator.ts` | Product mockup overlay generation |
| `lib/canvas-helpers.ts` | Canvas utility functions (print area, scaling, crop) |
| `lib/fabric-init.ts` | Fabric.js initialization and configuration |

### API Endpoints

| Endpoint | Route File |
|---|---|
| `GET/POST /api/designs` | `app/api/designs/route.ts` |
| `POST /api/designs/ai-generate` | `app/api/designs/ai-generate/route.ts` |
| `POST /api/designs/generate` | `app/api/designs/generate/route.ts` |
| `POST /api/designs/compose` | `app/api/designs/compose/route.ts` |
| `POST /api/designs/compose-v2` | `app/api/designs/compose-v2/route.ts` |
| `GET /api/designs/composition/[id]` | `app/api/designs/composition/[id]/route.ts` |
| `GET /api/designs/history` | `app/api/designs/history/route.ts` |
| `POST /api/designs/estimate` | `app/api/designs/estimate/route.ts` |
| `POST /api/designs/mockup` | `app/api/designs/mockup/route.ts` |
| `POST /api/designs/remove-bg` | `app/api/designs/remove-bg/route.ts` |
| `GET /api/designs/logs` | `app/api/designs/logs/route.ts` |
| `POST /api/designs/[id]/create-product` | `app/api/designs/[id]/create-product/route.ts` |

### Database Tables

| Table | Purpose |
|---|---|
| `designs` | Saved design documents (canvas JSON, metadata) |
| `design_sessions` | Active editing sessions (user, product, timestamps) |
| `ai_generations` | AI generation log (provider, prompt, cost, result) |
| `design_compositions` | Rendered compositions (production URLs, panel data) |
| `user_design_assets` | Uploaded user images/assets |
| `design_templates_clipart` | Template and clipart library entries |

### Pages

| Page | File |
|---|---|
| Design editor | `app/[locale]/(editor)/design/[productId]/page.tsx` |
| Editor client wrapper | `app/[locale]/(editor)/design/[productId]/DesignEditorClient.tsx` |
| Designs gallery | `app/[locale]/(app)/designs/page.tsx` |

---

## Workflow

Execute each phase sequentially. Record every finding with severity, file path, and line number.

### Phase 1: Canvas Editor UX (15 checks)

#### 1.1 Canvas Initialization

- Read `lib/fabric-init.ts` and `CanvasWorkspace.tsx`
- **Check**: Is Fabric.js initialized with correct defaults (selection, rendering, retina)?
- **Check**: Is `canvas.dispose()` called on unmount to prevent memory leaks?
- **Check**: Does canvas resize correctly on window resize / container resize?
- **Benchmark**: Canvas should initialize in <500ms on desktop

#### 1.2 Object Manipulation

- Read `CanvasWorkspace.tsx` — object add/select/transform methods
- **Check**: Can user add text, images, shapes, and SVGs?
- **Check**: Do alignment guidelines work (snap to center, edges)?
- **Check**: Are transform controls (scale, rotate, skew) functional and constrained?
- **Check**: Is multi-select supported (Shift+click or drag selection)?

#### 1.3 Undo/Redo

- Read `hooks/useCanvasHistory.ts`
- **Check**: Does Ctrl+Z undo the last operation?
- **Check**: Does Ctrl+Shift+Z (or Ctrl+Y) redo?
- **Check**: Is history cleared correctly on panel switch?
- **Check**: Are undo/redo stacks bounded (memory limit)?
- **Benchmark**: Industry standard is 50+ undo steps

#### 1.4 Keyboard Shortcuts

- Search for `keydown` or `addEventListener.*key` in `CanvasWorkspace.tsx` and `DesignStudioPage.tsx`
- **Check**: Ctrl+S (save), Ctrl+D (duplicate), Delete (remove), Escape (deselect), Arrows (nudge 1px), Shift+Arrows (nudge 10px)
- **Check**: Are shortcuts documented in UI (tooltip or help modal)?
- **Check**: Do shortcuts conflict with browser defaults?

#### 1.5 Zoom & Pan

- Search for `zoomToPoint`, `viewportTransform`, `zoomLevel` in canvas files
- **Check**: Mouse wheel zoom works (clamp 0.25x-5x)
- **Check**: Space+drag panning works
- **Check**: Zoom controls UI shows percentage and has fit-to-canvas
- **Check**: Viewport is reset before export (critical for production PNG)
- **Benchmark**: Industry standard supports at least 10x-2000% zoom range

#### 1.6 Color & Fill

- Read `tools/ColorPicker.tsx`, `tools/GradientEditor.tsx`
- **Check**: Brand palette is available as preset swatches
- **Check**: Custom hex/RGB input works
- **Check**: Gradient editor supports linear and radial gradients
- **Check**: Color changes apply to selected object immediately

#### 1.7 Typography

- Read `tools/TextTool.tsx`, `tools/FontPicker.tsx`
- **Check**: At least 12 fonts available (verify count in `FontPicker`)
- **Check**: Font size, weight, style (italic), decoration (underline/strikethrough) all work
- **Check**: Text alignment (left, center, right) works
- **Check**: Letter spacing and line height adjustable
- **Check**: Text editing on double-click canvas object
- **Benchmark**: Competitors (Canva, Printful) offer 50+ fonts

#### 1.8 Image Handling

- Read `tools/ImageTool.tsx`
- **Check**: Upload accepts PNG, JPG, SVG, WebP
- **Check**: Blob URLs are converted to data URLs for persistence (`blobUrlToDataUrl`)
- **Check**: Image cropping or masking available?
- **Check**: Background removal integration works (calls `/api/designs/remove-bg`)
- **Check**: Max file size validation exists

#### 1.9 Layers Panel

- Read `LayersPanel.tsx`
- **Check**: Layer list displays all canvas objects with names/thumbnails
- **Check**: Drag-to-reorder changes z-index
- **Check**: Visibility toggle (eye icon) hides/shows objects
- **Check**: Lock toggle prevents selection/editing
- **Check**: Layer names are editable

#### 1.10 Multi-Position Design

- Read `PanelSwitcher.tsx` and panel-related state in `useDesignEditor.ts`
- **Check**: Panels available per product type (front, back, sleeves, neck, wrist)
- **Check**: Switching panels preserves design state for each panel
- **Check**: Panel names map correctly to Printful placement names (`PANEL_TO_PRINTFUL`)
- **Check**: Each panel has correct canvas dimensions per product type
- **Check**: Ghost templates load for each panel (not just front)
- **Known Bug**: BUG-06 — `blankImages` not panel-specific. Verify current status.

#### 1.11 Templates & Clipart

- Read `TemplatesPanel.tsx`, `ClipartPanel.tsx`
- **Check**: Template gallery loads and templates can be applied to canvas
- **Check**: Clipart browser loads assets from `design_templates_clipart` table
- **Check**: At least 10 templates exist (query `design_templates_clipart` count)
- **Benchmark**: Competitors offer 100+ templates per category

#### 1.12 Print Area Enforcement

- Search for `clipPath`, `clipRectRef`, `getCanvasPrintArea` in canvas files
- **Check**: Visual clip path restricts objects to print area
- **Check**: Objects outside print area are visually clipped (not hard-deleted)
- **Check**: Ghost template outlines show safe zone
- **Check**: Print area dimensions match Printful specs per product type
- **Known Bug**: BUG-05 — fallback `getCanvasPrintArea` ignores product type. Verify status.

#### 1.13 Embroidery Constraints

- Read `EmbroideryConstraints.tsx`
- **Check**: Max 3 thread colors enforced for embroidery products
- **Check**: No gradients allowed on embroidery products
- **Check**: Minimum line width enforced (1.5mm)
- **Check**: Minimum text size enforced (5mm)
- **Check**: Constraints activate only for embroidery product types

#### 1.14 Preview & Mockup

- Read `PreviewMockupModal.tsx`
- **Check**: Preview modal renders canvas at 2x resolution
- **Check**: Mockup overlay shows design on product photo
- **Check**: Apply-to-cart button works from preview modal
- **Check**: Multiple views available (front, back) if multi-position

#### 1.15 DPI Validation

- Search for `dpi`, `resolution`, `PRODUCTION_DIMENSIONS` across design studio files
- **Check**: Production export outputs at 300+ DPI
- **Check**: User is warned if uploaded image resolution is too low for print size
- **Check**: `PRODUCTION_DIMENSIONS` match Printful printfile specs
- **Benchmark**: 300 DPI minimum for print, 150 DPI minimum warning threshold

### Phase 2: AI Generation Pipeline (12 checks)

#### 2.1 Intent Classification

- Read `lib/ai-design-orchestrator.ts`
- **Check**: User prompt is classified into intent categories (meme, branded, text-only, photo, illustration, etc.)
- **Check**: Classification drives provider selection (not random/hardcoded)
- **Check**: Unknown/ambiguous intents have a sensible default path

#### 2.2 Provider Routing

- Read `lib/providers/router.ts`
- **Check**: Router selects provider based on intent, quality preference, and cost
- **Check**: Fallback chain exists (if primary provider fails, try secondary)
- **Check**: Provider health/availability is checked before routing
- **Check**: Routing decision is logged for debugging

#### 2.3 Provider Implementations

- Read each provider file: `fal-provider.ts`, `openai-provider.ts`, `ideogram-provider.ts`, `recraft-provider.ts`
- **Check**: Each provider implements a consistent interface (from `types.ts`)
- **Check**: API keys are read from server-side env vars (never exposed to client)
- **Check**: Error handling catches provider-specific errors and returns normalized errors
- **Check**: Timeouts are configured (no infinite hangs)
- **Check**: Response format is normalized across providers

#### 2.4 Prompt Engineering

- Read `lib/providers/prompt-engineer.ts`
- **Check**: Prompts are enhanced with style-specific suffixes
- **Check**: Content safety filtering rejects harmful/prohibited content
- **Check**: Prompt length is validated (provider-specific max lengths)
- **Check**: Brand-specific keywords are injected when appropriate

#### 2.5 Cost Guards

- Read `lib/design-cost-guard.ts`
- **Check**: Per-user generation limits exist (daily/monthly)
- **Check**: Limits differ by user tier (free, pro, etc.)
- **Check**: Cost estimation endpoint (`/api/designs/estimate`) returns accurate costs
- **Check**: Generation is blocked when limit is exceeded (not just warned)
- **Check**: Admin/staff bypass exists for testing

#### 2.6 Generation API Security

- Read `app/api/designs/ai-generate/route.ts` and `app/api/designs/generate/route.ts`
- **Check**: Auth required (user must be logged in)
- **Check**: Rate limiting exists (per-user, per-IP)
- **Check**: Input validation (prompt length, parameters)
- **Check**: Response does not leak internal error details
- **Check**: Cost is deducted from user's balance/quota atomically

#### 2.7 Background Removal

- Read `lib/providers/background-removal.ts` and `app/api/designs/remove-bg/route.ts`
- **Check**: Routes to self-hosted rembg sidecar (port 7000/8080)
- **Check**: Fallback if rembg is unavailable
- **Check**: Input validation (file type, size)
- **Check**: Result quality — verify PNG with alpha channel is returned

#### 2.8 Style Presets

- Read `lib/design-presets.ts`
- **Check**: Preset list covers key styles (meme, minimalist, branded, vintage, neon, etc.)
- **Check**: Each preset defines provider preference, prompt template, and post-processing
- **Check**: Presets are selectable in the UI
- **Benchmark**: At least 8-10 presets for good coverage

#### 2.9 Generation Latency

- Search for timeout values, `AbortController`, `signal` in generation files
- **Check**: Timeouts are set per provider (fal ~10s, DALL-E ~30s)
- **Check**: User sees loading indicator during generation
- **Check**: User can cancel in-progress generation
- **Benchmark**: Quick generation <10s, quality generation <30s

#### 2.10 Generation Logging

- Read `app/api/designs/logs/route.ts` and search for `ai_generations` table inserts
- **Check**: Every generation attempt is logged (provider, prompt, cost, duration, success/failure)
- **Check**: Failed generations record the error reason
- **Check**: Logs are queryable for cost analytics and debugging

#### 2.11 Content Safety

- Search for `safety`, `nsfw`, `moderation`, `filter`, `block` in provider and prompt files
- **Check**: Prompt is checked against blocked terms/patterns before sending to provider
- **Check**: Generated images are checked for NSFW content (provider-side or post-generation)
- **Check**: Rejected content returns a user-friendly message (not a raw error)
- **Benchmark**: All major POD platforms (Printful, Printify, Redbubble) enforce content policies

#### 2.12 Storage Upload

- Read `lib/providers/storage-upload.ts`
- **Check**: Generated images are uploaded to Supabase Storage `designs/` bucket
- **Check**: File naming includes user ID and timestamp (prevents collisions)
- **Check**: Public URL is returned for use in canvas
- **Check**: Old/unused generations are cleaned up (or storage cost is bounded)

### Phase 3: Composition & Production Pipeline (10 checks)

#### 3.1 Production Export

- Search for `exportProductionPNG`, `PRODUCTION_DIMENSIONS` in hooks and canvas files
- **Check**: Export scales canvas to Printful-required dimensions per product type
- **Check**: Viewport is reset before export (zoom/pan must not affect output)
- **Check**: Guide objects, ghost templates, and background are excluded from export
- **Check**: Output is PNG with transparency (no white background unless DTG on white)

#### 3.2 Composition Rendering (compose-v2)

- Read `app/api/designs/compose-v2/route.ts` and `lib/composition-renderer.ts`
- **Check**: Server-side composition uses Sharp (not client-side canvas)
- **Check**: All panels are composed (front + back + sleeves if designed)
- **Check**: Production URLs are saved to `design_compositions` table
- **Check**: Composition images are uploaded to Supabase Storage
- **Check**: Error handling for Sharp failures (memory, format)

#### 3.3 Mockup Generation

- Read `app/api/designs/mockup/route.ts` and `lib/mockup-generator.ts`
- **Check**: Mockup overlays design onto product photo at correct position/scale
- **Check**: Perspective transform applied (design wraps on curved surfaces)
- **Check**: Multiple mockup views available (if templates exist)
- **Check**: Mockup templates exist for major product types
- Search `public/mockup-templates/` — count available templates
- **Known Gap**: Prior audit found only 7 templates — hats, sneakers, tumblers, desk mats, kids, tanks missing

#### 3.4 Design-to-Product Pipeline

- Read `app/api/designs/[id]/create-product/route.ts`
- **Check**: Creates product on Printful with correct blueprint, provider, and variants
- **Check**: Print areas map correctly from canvas panels to Printful placements
- **Check**: Pricing is set per PRICING_RULES (margin >= 35%)
- **Check**: GPSR compliance data is attached before publish
- **Check**: Product is synced to Supabase after Printful creation

#### 3.5 Cart Integration

- Search for `composition_id`, `design_id` in cart-related files
- **Check**: `cart_items` table has `composition_id` column
- **Check**: Adding designed product to cart stores composition reference
- **Check**: Cart displays design preview (not generic product image)

#### 3.6 Order Print Files

- Search for `files`, `productionUrlsMap`, `production_url` in checkout/order files
- **Check**: Stripe webhook reads `production_url` from composition
- **Check**: Printful order includes `files[]` param with production URLs
- **Check**: No temp products are created (direct `files[]` flow)
- **Check**: Print file URLs are accessible to Printful (public or signed URLs)

#### 3.7 Design Persistence

- Read `hooks/useDesignPersistence.ts`
- **Check**: Auto-save triggers on canvas change (debounced, not on every stroke)
- **Check**: Canvas JSON is serialized correctly (guides/ghost excluded via `filterGuideObjectsFromJSON`)
- **Check**: Loading a saved design restores all objects, positions, and styles
- **Check**: Designs list page (`/designs`) shows user's saved designs
- **Check**: Designs are user-scoped (RLS or explicit `user_id` filter)

#### 3.8 Session Management

- Search for `design_sessions` in API and hook files
- **Check**: Session is created on editor open
- **Check**: Session tracks active editing time
- **Check**: Concurrent editing is handled (lock or last-write-wins)

#### 3.9 Asset Management

- Search for `user_design_assets` in API and component files
- **Check**: Uploaded images are stored in Supabase Storage
- **Check**: Asset library shows user's uploaded images
- **Check**: Assets are user-scoped (no cross-user access)
- **Check**: File size and type validation on upload

#### 3.10 History Endpoint

- Read `app/api/designs/history/route.ts`
- **Check**: Returns user's design history (saved designs + generations)
- **Check**: Auth required
- **Check**: Pagination implemented
- **Check**: Includes metadata (timestamps, thumbnails, product type)

### Phase 4: API Security & Validation (8 checks)

#### 4.1 Authentication on All Endpoints

- Read every route file under `app/api/designs/`
- **Check**: Every endpoint validates user auth (extracts user from session/token)
- **Check**: Unauthenticated requests return 401
- **Check**: User ID is extracted server-side (never trusted from request body)
- **Severity**: CRITICAL if any mutating endpoint lacks auth

#### 4.2 Input Validation

- For each POST endpoint, check request body parsing:
- **Check**: Prompt text is sanitized (no script injection)
- **Check**: Image URLs are validated (no SSRF via internal URLs)
- **Check**: Numeric parameters are bounded (width, height, count)
- **Check**: File uploads validate type and size

#### 4.3 Rate Limiting

- Search for `rateLimit`, `throttle`, `X-RateLimit` in design API files
- **Check**: AI generation endpoints have rate limits
- **Check**: Upload endpoints have rate limits
- **Check**: Rate limit headers are returned in responses
- **Benchmark**: Typical limits: 10 generations/hour free tier, 50/hour pro

#### 4.4 Error Handling

- Search for `try.*catch`, `NextResponse.json.*500` in design API files
- **Check**: All endpoints wrap logic in try-catch
- **Check**: Internal errors return generic message (not stack traces)
- **Check**: Supabase/Printful errors are caught and normalized
- **Check**: Error responses use consistent format `{ error: string, code?: string }`

#### 4.5 CORS & Headers

- Search for `headers`, `Access-Control`, `Content-Security-Policy` in design API files
- **Check**: API responses include appropriate security headers
- **Check**: CORS is not overly permissive (no wildcard `*` in production)
- **Check**: File upload responses set correct `Content-Type`

#### 4.6 Supabase Client Usage

- Search for `supabase-admin`, `SUPABASE_SERVICE_KEY` in design API files
- **Check**: Admin client is used only where RLS bypass is needed (cron, admin ops)
- **Check**: User-facing endpoints use server client with user auth
- **Check**: No admin client usage in client-side code
- **Severity**: CRITICAL if admin client is imported in any `"use client"` file

#### 4.7 External Service Security

- Check provider files for API key handling:
- **Check**: fal.ai, OpenAI, Ideogram, Recraft keys are in env vars (not hardcoded)
- **Check**: Keys are only accessed server-side (API routes, not `lib/` imported by client)
- **Check**: Provider responses are validated before processing (no blind trust)

#### 4.8 Storage Security

- Check Supabase Storage bucket configuration:
- **Check**: `designs/` bucket has appropriate RLS policies
- **Check**: Users can only access their own uploads
- **Check**: Public URLs are only generated for shared/published designs
- **Check**: No directory traversal possible in upload paths

### Phase 5: Database Schema & Integrity (6 checks)

#### 5.1 Table Schema Completeness

- Query or read migrations for `designs`, `design_sessions`, `ai_generations`, `design_compositions`, `user_design_assets`, `design_templates_clipart`
- **Check**: All tables have `created_at`, `updated_at` timestamps
- **Check**: All user-scoped tables have `user_id` with FK to `auth.users`
- **Check**: Primary keys are UUIDs (consistent with rest of schema)

#### 5.2 RLS Policies

- Search for `CREATE POLICY` on design tables in migrations
- **Check**: Every design table has RLS enabled
- **Check**: SELECT policies enforce `user_id = auth.uid()`
- **Check**: INSERT policies set `user_id = auth.uid()` (not user-provided)
- **Check**: UPDATE/DELETE policies enforce ownership
- **Severity**: CRITICAL if any table lacks RLS

#### 5.3 Indexes

- Search for `CREATE INDEX` on design tables
- **Check**: `designs` has index on `user_id`
- **Check**: `ai_generations` has index on `user_id` and `created_at` (for cost queries)
- **Check**: `design_compositions` has index on `design_id`
- **Check**: Any table queried by `user_id` has an index on it

#### 5.4 Foreign Keys

- **Check**: `designs.user_id` references `auth.users`
- **Check**: `design_compositions.design_id` references `designs.id`
- **Check**: `ai_generations.user_id` references `auth.users`
- **Check**: ON DELETE behavior is appropriate (CASCADE or SET NULL)

#### 5.5 Data Integrity

- **Check**: `designs.canvas_data` is JSONB (not text)
- **Check**: `ai_generations.cost` is numeric/decimal (not text)
- **Check**: `design_compositions.production_url` is text (valid URL format)
- **Check**: No orphaned compositions (compositions without valid design reference)

#### 5.6 Storage Bucket Configuration

- **Check**: `designs` bucket exists in Supabase Storage
- **Check**: Max file size limit is configured
- **Check**: Allowed MIME types are restricted (image/png, image/jpeg, image/svg+xml, image/webp)

### Phase 6: Mobile UX (6 checks)

#### 6.1 Responsive Layout

- Read `DesignStudioPage.tsx` and check for responsive breakpoints
- **Check**: Editor uses mobile-first CSS (base styles for 375px, md: for tablet, lg: for desktop)
- **Check**: Panels collapse or switch to bottom sheets on mobile
- **Check**: Canvas scales proportionally on small screens
- **Check**: No horizontal scroll on mobile viewport

#### 6.2 Touch Targets

- Search for `p-2`, `p-3`, `w-8`, `h-8`, `w-10`, `h-10` in toolbar and panel components
- **Check**: All interactive elements have minimum 44px touch targets (p-3 or h-10+)
- **Check**: Toolbar buttons are not cramped on mobile
- **Check**: Close/dismiss buttons are easy to tap

#### 6.3 Touch Gestures

- Search for `touch`, `pinch`, `gesture`, `pointer` in canvas files
- **Check**: Pinch-to-zoom supported on canvas
- **Check**: Two-finger pan supported
- **Check**: Long-press for context menu (alternative to right-click)
- **Benchmark**: Canva and Printful both support pinch-zoom on mobile editor

#### 6.4 Panel Management

- **Check**: Only one panel visible at a time on mobile (not stacked)
- **Check**: Panel switching is intuitive (bottom tabs or swipe)
- **Check**: Canvas is not obscured by panels on small screens
- **Check**: Keyboard does not break layout when editing text

#### 6.5 Performance on Mobile

- Search for `useMemo`, `useCallback`, `React.memo` in design studio components
- **Check**: Heavy components are memoized
- **Check**: Canvas operations are debounced for touch input
- **Check**: No layout thrashing from frequent re-renders
- **Benchmark**: Canvas should maintain 30fps during object manipulation on mobile

#### 6.6 Offline / Network Resilience

- **Check**: Auto-save handles network failures gracefully (retry, queue)
- **Check**: AI generation shows clear loading states on slow connections
- **Check**: Large image uploads show progress indicator

### Phase 7: Performance & Bundle (5 checks)

#### 7.1 Bundle Size

- Check if Fabric.js is dynamically imported (not in initial bundle)
- **Check**: `fabric` import uses `dynamic()` or `import()` (not top-level import in page)
- **Check**: AI provider code is only loaded server-side (not bundled for client)
- **Check**: Design studio page uses code splitting from the route

#### 7.2 Canvas Performance

- Search for `requestAnimationFrame`, `renderAll`, `renderOnAddRemove` in canvas files
- **Check**: `renderOnAddRemove` is set to false for batch operations
- **Check**: Canvas does not re-render on every state update (batched rendering)
- **Check**: Large canvases (4000x5000px) do not cause OOM

#### 7.3 Image Optimization

- **Check**: Uploaded images are resized/compressed before storage (not raw 20MB files)
- **Check**: Thumbnails are generated for design gallery
- **Check**: Canvas preview images use appropriate resolution (not full production size)

#### 7.4 Memory Management

- **Check**: Canvas is disposed on component unmount
- **Check**: Object URLs are revoked after use (`URL.revokeObjectURL`)
- **Check**: Large data URLs are not held in React state unnecessarily
- **Check**: Generation results are garbage-collected after placement

#### 7.5 API Response Times

- Check for caching, pagination, query optimization in design API routes
- **Check**: Design list endpoint is paginated
- **Check**: Composition fetch uses indexed queries
- **Check**: Heavy operations (compose, mockup) return quickly or use streaming/polling

---

## Output Format

Generate `AUDIT_DESIGN_STUDIO_[DATE].md` at the workspace root with the following structure:

```markdown
# Design Studio Audit — [DATE]

## Executive Summary

[2-3 paragraph overview: what works well, what is broken, what is missing. State overall production-readiness.]

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| Canvas Editor UX | 15 | X | X | X | X | X% |
| AI Generation Pipeline | 12 | X | X | X | X | X% |
| Composition & Production | 10 | X | X | X | X | X% |
| API Security | 8 | X | X | X | X | X% |
| Database Schema | 6 | X | X | X | X | X% |
| Mobile UX | 6 | X | X | X | X | X% |
| Performance & Bundle | 5 | X | X | X | X | X% |
| **TOTAL** | **62** | **X** | **X** | **X** | **X** | **X%** |

## Findings

| ID | Severity | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|
| DS-001 | CRITICAL | API Security | [description] | `src/app/api/designs/generate/route.ts:42` | [fix] |
| DS-002 | FAIL | Canvas UX | [description] | `src/components/design-studio/CanvasWorkspace.tsx:310` | [fix] |
| DS-003 | WARN | Mobile UX | [description] | `src/components/design-studio/CanvasToolbar.tsx:88` | [fix] |
| ... | ... | ... | ... | ... | ... |

## Critical Blockers (Must Fix Before Production)

1. [DS-001] — [description and fix]
2. ...

## High Priority (Fix Within Sprint)

1. [DS-0XX] — [description]
2. ...

## Warnings (Fix Before V2)

1. [DS-0XX] — [description]
2. ...

## Industry Benchmark Comparison

| Capability | SKAPARA | Canva | Printful | Printify | Status |
|---|---|---|---|---|---|
| Canvas zoom range | 25%-500% | 10%-3000% | 50%-400% | 50%-200% | PASS |
| Font count | X | 2000+ | 50+ | 40+ | [PASS/FAIL] |
| Template count | X | 100K+ | 50+ | 20+ | [PASS/FAIL] |
| Undo depth | X | Unlimited | 50 | 20 | [PASS/FAIL] |
| Mobile editor | [Y/N] | Yes | Yes | No | [PASS/FAIL] |
| AI generation | [Y/N] | Yes (Magic) | No | No | ADVANTAGE |
| Multi-position | [Y/N] | N/A | Yes | Yes | [PASS/FAIL] |
| Embroidery constraints | [Y/N] | N/A | Yes | No | [PASS/FAIL] |
| Background removal | [Y/N] | Yes | Yes | No | [PASS/FAIL] |
| DPI validation | [Y/N] | Yes | Yes | Yes | [PASS/FAIL] |
| Design-to-order (no temp product) | [Y/N] | N/A | No | No | ADVANTAGE |

## Appendix: Known Bugs (from prior audits)

| Bug ID | Status | Description | Impact |
|---|---|---|---|
| BUG-05 | Open (LOW) | `getCanvasPrintArea` fallback ignores product type | Low — only affects legacy products |
| BUG-06 | Open (MEDIUM) | `blankImages` not panel-specific | Moderate — back panel shows front image |
| ... | ... | ... | ... |
```

## Severity Levels

- **CRITICAL**: Security vulnerability, data leakage, auth bypass, production data corruption. Blocks production launch.
- **FAIL**: Broken functionality, missing validation, incorrect output. Must fix before release.
- **WARN**: Sub-optimal pattern, missing best practice, UX gap. Should fix before V2.
- **PASS**: Meets standards and industry benchmarks.

## Notes

- Always verify findings against actual code (read the file, cite the line number). Never report speculative issues.
- Cross-reference with prior audits in `frontend/docs/design-studio-audit/` to avoid duplicating known issues.
- If a prior bug has been fixed, note it as RESOLVED with the fixing commit/PR.
- For each CRITICAL or FAIL finding, include a concrete code-level recommendation (not just "fix this").
- The benchmark comparison table should use real numbers from the codebase (count fonts, templates, etc.), not estimates.
