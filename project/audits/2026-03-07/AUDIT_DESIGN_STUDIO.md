# Design Studio Audit -- 2026-03-07

## Executive Summary

The SKAPARA Design Studio is a well-architected, Fabric.js v6-based canvas editor with multi-panel support, multi-provider AI generation, production-quality export, and a complete design-to-order pipeline. The codebase demonstrates strong engineering practices: Zustand state management, ghost template integration from Printful API, intent-based AI provider routing with automatic fallbacks, cost guards, content safety, rate limiting, and a robust persistence layer with both cloud (Supabase) and local (localStorage draft) fallback.

However, the audit reveals 3 CRITICAL security issues, 7 FAIL-level functional gaps, and 12 WARN-level improvements needed. The most urgent blocker is that `POST /api/designs` (the design save endpoint) allows unauthenticated writes with `user_id` set to `null`, which means anonymous users can create orphaned records. Additionally, the `POST /api/designs/generate` endpoint leaks internal error details in production responses. The `design_templates_clipart` table referenced in the skill file map does not exist in any migration -- templates and clipart endpoints hit external API routes without underlying data, meaning these panels will always show empty.

**Overall Production Readiness: CONDITIONAL GO** -- Fix the 3 CRITICALs and 2 highest-priority FAILs (error detail leakage and auth on POST /api/designs) before launch. The remaining items are V2 improvements.

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| Canvas Editor UX | 15 | 10 | 4 | 1 | 0 | 67% |
| AI Generation Pipeline | 12 | 10 | 1 | 1 | 0 | 83% |
| Composition & Production | 10 | 7 | 1 | 2 | 0 | 70% |
| API Security | 8 | 4 | 0 | 1 | 3 | 50% |
| Database Schema | 6 | 5 | 1 | 0 | 0 | 83% |
| Mobile UX | 6 | 2 | 3 | 1 | 0 | 33% |
| Performance & Bundle | 5 | 4 | 1 | 0 | 0 | 80% |
| **TOTAL** | **62** | **42** | **11** | **6** | **3** | **68%** |

## Findings

| ID | Severity | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|
| DS-001 | CRITICAL | API Security | `POST /api/designs` allows unauthenticated writes. `user_id` is set from `getAuthUser()` which returns `null` for unauthenticated requests, resulting in rows with `user_id = null`. No auth guard blocks the insert. | `src/app/api/designs/route.ts:97-119` | Use `requireAuth()` instead of `getAuthUser()` in POST handler. Return 401 if no user. |
| DS-002 | CRITICAL | API Security | `POST /api/designs/generate` leaks internal error details: `details: error instanceof Error ? error.message : String(error)`. Stack traces or internal module names can leak via `error.message` in production. | `src/app/api/designs/generate/route.ts:105-108` | Remove `details` field from 500 error responses, or sanitize to a generic message. Log full error server-side only. |
| DS-003 | CRITICAL | API Security | `POST /api/designs/ai-generate` also leaks error details in the catch block: `details: error instanceof Error ? error.message : String(error)` | `src/app/api/designs/ai-generate/route.ts:192-196` | Same fix as DS-002. Remove `details` from production 500 responses. |
| DS-004 | FAIL | Canvas UX | Layer names are not editable. `LayersPanel.tsx` renders `layer.name` as a `<span>` with no edit mechanism. Users cannot rename layers for organization. | `src/components/design-studio/LayersPanel.tsx:82-84` | Add an inline editable text field (double-click to edit) that calls a `setObjectName(id, name)` method on CanvasWorkspace. |
| DS-005 | FAIL | Canvas UX | No letter-spacing or line-height controls exist in TextTool. Both properties are absent from the UI and not wired to canvas object properties. | `src/components/design-studio/tools/TextTool.tsx` (entire file) | Add `charSpacing` and `lineHeight` Slider controls to TextTool, wire to Fabric.js `IText.charSpacing` and `IText.lineHeight`. |
| DS-006 | FAIL | Canvas UX | No text decoration controls (underline, strikethrough). Neither property is exposed in the TextTool UI. | `src/components/design-studio/tools/TextTool.tsx` (entire file) | Add toggle buttons for `underline` and `linethrough` fabric properties. |
| DS-007 | FAIL | Canvas UX | Layers panel has no drag-to-reorder. Z-order changes only via 4 buttons (bring forward/backward/front/back). No DnD support. | `src/components/design-studio/LayersPanel.tsx:68-106` | Integrate `@dnd-kit/sortable` or similar library for drag-and-drop reorder of layers. |
| DS-008 | FAIL | Composition & Production | `design_templates_clipart` table does not exist in any migration. ClipartPanel and TemplatesPanel call `/api/design-assets/clipart` and `/api/design-assets/templates` respectively, but no API route or table backs them. Both panels will always show empty. | `src/components/design-studio/ClipartPanel.tsx:39`, `src/components/design-studio/TemplatesPanel.tsx:39` | Create migration for `design_templates_clipart` table and implement `/api/design-assets/` routes. Or populate from a seed script. |
| DS-009 | FAIL | Composition & Production | Mockup templates only cover 5 product types (tshirt, hoodie, mug, phone-case, tote-bag) with 7 total images. Missing: hat, sneakers, desk-mat, tumbler, bottle, kids, tank-top, long-sleeve, crewneck, zip-hoodie. | `frontend/public/mockup-templates/` (7 files) | Generate or source mockup template images for remaining product types. |
| DS-010 | FAIL | Mobile UX | No pinch-to-zoom or two-finger pan support on canvas. The only touch gesture is `touchAction: 'none'` set on the container. Zoom/pan is keyboard+mouse only (Space+drag, mouse wheel). | `src/components/design-studio/CanvasWorkspace.tsx:1085` | Implement Hammer.js or Fabric.js touch gesture handling for pinch-zoom and two-finger pan. |
| DS-011 | WARN | Canvas UX | Undo history limited to 20 states (`MAX_STATES = 20`). Industry standard is 50+. With frequent text editing or object manipulation, users may quickly exhaust history. | `src/hooks/useCanvasHistory.ts:11` | Increase to 50 or implement a bounded-size approach based on JSON payload size rather than count. |
| DS-012 | WARN | Canvas UX | Zoom range clamped to 0.25x-5x (25%-500%). Functional but narrower than Canva (10%-3000%). Acceptable for V1 but could be expanded. | `src/components/design-studio/CanvasWorkspace.tsx:441` | Consider expanding to 0.1x-10x for fine detail work. |
| DS-013 | WARN | Canvas UX | Keyboard shortcuts are NOT documented in the UI. No help modal, tooltip, or shortcuts reference accessible to the user. | `src/components/design-studio/DesignStudioPage.tsx:433-489` | Add a keyboard shortcuts modal (triggered by `?` key or help button) listing all shortcuts. |
| DS-014 | WARN | Canvas UX | No image cropping or masking capability. ImageTool only supports upload and placement. Users cannot crop images within the editor. | `src/components/design-studio/tools/ImageTool.tsx` | Add a crop mode using Fabric.js `clipPath` or integrate a crop library. |
| DS-015 | WARN | AI Generation | Storage upload module creates bucket with `public: true` and no cleanup mechanism. Generated images accumulate indefinitely in Supabase Storage. | `src/lib/providers/storage-upload.ts:15` | Implement a scheduled cleanup job that removes orphaned images (not linked to any design or composition) older than 30 days. |
| DS-016 | WARN | Composition & Production | `PreviewMockupModal.tsx` is a stub (`export {}`). Preview is implemented inline in DesignStudioPage as a simple Dialog with a 2x PNG. No actual product mockup overlay is shown in the preview. | `src/components/design-studio/PreviewMockupModal.tsx:1-2` | Either remove the stub file or implement a proper mockup preview that calls `/api/designs/mockup` with the current canvas export. |
| DS-017 | WARN | API Security | `POST /api/designs/route.ts` GET endpoint uses `supabaseAdmin` (RLS bypass) for both authenticated and unauthenticated queries. The user_id filter is applied manually but RLS is bypassed. | `src/app/api/designs/route.ts:27-41` | Use server client with user auth for authenticated requests. Reserve admin client only for the unauthenticated public query. |
| DS-018 | WARN | Database Schema | `ai_generations` table has `session_id UUID NOT NULL` in migration but the code inserts `null` for session_id when session creation fails (line 126-128 of ai-generate/route.ts). This mismatch is resolved by a later migration making it nullable. | `supabase/migrations/20260228201500_ai_generations_session_nullable.sql` | Already fixed. Noting for completeness. |
| DS-019 | WARN | Mobile UX | Mobile toolbar buttons use `size="sm"` with `gap-1.5` and `text-xs`. With 6 tools + 2 undo/redo buttons, the bar may be cramped on 375px screens. Touch targets for undo/redo are `size-8` (32px), below the 44px minimum. | `src/components/design-studio/CanvasToolbar.tsx:67-99` | Increase mobile undo/redo to `size-10` (40px minimum). Consider collapsing tools into a scrollable row or popover. |
| DS-020 | WARN | Mobile UX | Bottom properties panel has `max-h-[35vh]` which may not leave enough canvas visible on short screens. No swipe-to-dismiss gesture. | `src/components/design-studio/DesignStudioPage.tsx:1004` | Make properties panel collapsible with a drag handle. Consider using Sheet component for consistency. |
| DS-021 | WARN | Performance | Fabric.js is dynamically imported via `loadFabric()` (good), but `fabric/extensions` is also lazily imported during canvas init. If the extensions bundle is large, it may cause a visible delay. | `src/components/design-studio/CanvasWorkspace.tsx:372-380` | Preload `fabric/extensions` during `loadFabric()` to avoid sequential lazy loads. |
| DS-022 | WARN | Composition & Production | Embroidery max thread colors is 6 (`MAX_THREAD_COLORS = 6`) but CLAUDE.md and design skills state max 3. This discrepancy could allow designs that fail embroidery validation at Printful. | `src/lib/embroidery-config.ts:32` | Align `MAX_THREAD_COLORS` with Printful's actual embroidery limit per product type (typically 3 for standard, 6 for unlimited_color). |

## Critical Blockers (Must Fix Before Production)

1. **[DS-001]** `POST /api/designs` allows unauthenticated inserts with `user_id = null`. Fix: Replace `getAuthUser(req)` with `requireAuth(req)` and return 401 for unauthenticated users. File: `src/app/api/designs/route.ts:97`.

2. **[DS-002]** `POST /api/designs/generate` leaks internal error details in 500 responses. Fix: Remove `details` field from catch block error response. File: `src/app/api/designs/generate/route.ts:105-108`.

3. **[DS-003]** `POST /api/designs/ai-generate` same error leakage issue. Fix: Remove `details` field from catch block. File: `src/app/api/designs/ai-generate/route.ts:192-196`.

## High Priority (Fix Within Sprint)

1. **[DS-008]** Templates and clipart panels are non-functional -- no `design_templates_clipart` table exists, and no API routes serve `/api/design-assets/`. Users see empty panels.

2. **[DS-009]** Only 7 mockup templates for 5 product types. Missing templates for hats, sneakers, desk mats, and 8 other product categories.

3. **[DS-010]** No touch gestures (pinch-zoom, two-finger pan) on mobile canvas. Mobile editing is severely limited.

4. **[DS-004]** Layer names not editable -- basic layer management feature expected in any canvas editor.

## Warnings (Fix Before V2)

1. **[DS-011]** Undo history limited to 20 states (industry standard: 50+)
2. **[DS-005]** No letter-spacing or line-height controls
3. **[DS-006]** No underline/strikethrough text decoration
4. **[DS-007]** No drag-to-reorder layers
5. **[DS-013]** Keyboard shortcuts not documented in UI
6. **[DS-014]** No image cropping/masking
7. **[DS-015]** No storage cleanup for generated images
8. **[DS-016]** Preview shows raw canvas PNG, not product mockup
9. **[DS-017]** Admin client used unnecessarily in GET /api/designs
10. **[DS-019]** Mobile toolbar touch targets below 44px minimum
11. **[DS-020]** Bottom properties panel not collapsible on mobile
12. **[DS-022]** Embroidery max colors mismatch (6 vs documented 3)

## Industry Benchmark Comparison

| Capability | SKAPARA | Canva | Printful | Printify | Status |
|---|---|---|---|---|---|
| Canvas zoom range | 25%-500% | 10%-3000% | 50%-400% | 50%-200% | PASS |
| Font count | 12 | 2000+ | 50+ | 40+ | FAIL (12 fonts) |
| Template count | 0 (no data) | 100K+ | 50+ | 20+ | FAIL |
| Undo depth | 20 | Unlimited | 50 | 20 | WARN (20 states) |
| Mobile editor | Partial | Yes | Yes | No | WARN |
| AI generation | Yes (4 providers) | Yes (Magic) | No | No | ADVANTAGE |
| Multi-position | Yes (front/back/sleeves) | N/A | Yes | Yes | PASS |
| Embroidery constraints | Yes (thread picker, text size) | N/A | Yes | No | PASS |
| Background removal | Yes (3 fallbacks) | Yes | Yes | No | PASS |
| DPI validation | Yes (300 DPI production export) | Yes | Yes | Yes | PASS |
| Design-to-order (no temp product) | Yes (direct files[] flow) | N/A | No | No | ADVANTAGE |
| Intent-based provider routing | Yes (7 intents, 4 providers) | N/A | N/A | N/A | ADVANTAGE |
| Cost guards & usage limits | Yes (per-user monthly budget) | Yes | N/A | N/A | PASS |
| Content safety filtering | Yes (prompt + NSFW detection) | Yes | N/A | N/A | PASS |
| Ghost templates (Printful API) | Yes | N/A | Built-in | Built-in | PASS |
| Auto-save (cloud + localStorage) | Yes (2s debounce + beforeunload) | Yes | No | No | ADVANTAGE |
| Draft restoration | Yes (localStorage, 7-day expiry) | Yes | No | No | ADVANTAGE |
| Multi-panel state persistence | Yes (Zustand per-panel) | N/A | Yes | Yes | PASS |
| Gradient fills (linear + radial) | Yes | Yes | No | No | ADVANTAGE |
| Shadow + outline effects | Yes | Yes | No | No | ADVANTAGE |

## Appendix: Known Bugs (from prior audits)

| Bug ID | Status | Description | Impact |
|---|---|---|---|
| BUG-05 | OPEN (LOW) | `getCanvasPrintArea` fallback ignores product type -- uses fixed 10% padding for all types | Low -- only triggers when ghost template is unavailable (fallback path). The `productCategory` param is accepted but unused due to simplified implementation. |
| BUG-06 | RESOLVED | `blankImages` not panel-specific | Fixed -- `blankImageUrl` now comes from `variants?.blankImages?.[variantColor]` and ghost templates provide panel-specific data via `resolveGhostTemplate(designTemplates, variantColor, activePanel)` at `DesignStudioPage.tsx:154-157`. |

## Phase-by-Phase Detail

### Phase 1: Canvas Editor UX (10 PASS, 4 WARN, 1 FAIL)

- **1.1 Canvas Initialization**: PASS. Fabric.js v6 initialized with `selection: true`, `preserveObjectStacking: true`, `enableRetinaScaling: true`. `canvas.dispose()` called on cleanup (line 539). ResizeObserver handles container resize with 50ms debounce. DPR capped at 2x for iOS Safari.
- **1.2 Object Manipulation**: PASS. Text (IText), images (FabricImage), SVGs (loadSVGFromString + groupSVGElements) all supported. Alignment guidelines via `fabric/extensions` `initAligningGuidelines`. Transform controls include snap angle (15 deg) and snap threshold (5px). Multi-select supported (Fabric.js default `selection: true`).
- **1.3 Undo/Redo**: WARN (DS-011). Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y work correctly. History cleared on panel switch. But stack limited to 20 states.
- **1.4 Keyboard Shortcuts**: PASS for functionality, WARN (DS-013) for documentation. Ctrl+S, Ctrl+D, Delete, Escape, Arrow nudge (1px/10px) all work. Input elements excluded from interception.
- **1.5 Zoom & Pan**: PASS. Mouse wheel zoom (0.25x-5x). Space+drag panning. UI shows percentage with +/- buttons and fit-to-canvas reset. Viewport reset before production export.
- **1.6 Color & Fill**: PASS. 16 preset swatches in ColorPicker. Hex input validated with regex. GradientEditor supports solid, linear, and radial with angle control.
- **1.7 Typography**: PASS for basics, FAIL (DS-005, DS-006) for advanced. 12 fonts. Font size (12-120), bold, italic, alignment (left/center/right) all work. Missing: letter-spacing, line-height, underline, strikethrough. Double-click editing works (IText default).
- **1.8 Image Handling**: PASS. Accepts PNG, JPG, SVG, WebP. 10MB max. Blob URLs converted to data URLs (line 91-100). Background removal via `/api/designs/remove-bg`. WARN (DS-014): No cropping.
- **1.9 Layers Panel**: PASS for basics, FAIL (DS-004, DS-007). Lists objects with type icons, visibility toggle, lock toggle. Z-order buttons work. Missing: editable names, drag-to-reorder.
- **1.10 Multi-Position Design**: PASS. Panels determined by `getAvailablePanels(productType)`. Panel switching serializes current state to Zustand. `PANEL_TO_PRINTFUL` maps panel IDs. Ghost templates load per panel. Copy panel functionality works.
- **1.11 Templates & Clipart**: FAIL (DS-008). UI exists but backend is missing.
- **1.12 Print Area Enforcement**: PASS. Visual clip path via `clipRectRef`. Objects clamped to print area on `object:moving` (line 419-424). Print area guide + safe zone drawn. Warning badge on out-of-bounds.
- **1.13 Embroidery Constraints**: PASS with WARN (DS-022). Thread color picker with 15 Madeira colors. At-limit warning. Text size warning (<5mm). Gradients/shadows hidden in embroidery mode. But MAX_THREAD_COLORS=6 vs documented 3.
- **1.14 Preview & Mockup**: WARN (DS-016). Preview renders 2x PNG in Dialog. Apply-to-cart button works. But no actual product mockup overlay.
- **1.15 DPI Validation**: PASS. PRODUCTION_DIMENSIONS defined per product type (e.g., tshirt: 3600x4800 = 300 DPI at 12x16"). Low resolution warning badge shown when `selectedObject.width < 200`. Production export calculates multiplier from print area to production dims.

### Phase 2: AI Generation Pipeline (10 PASS, 1 WARN, 1 FAIL)

- **2.1 Intent Classification**: PASS. 6 keyword-based intent categories with confidence scoring. Default path: `general` at 0.5 confidence.
- **2.2 Provider Routing**: PASS. Intent-based routing table with ordered providers per intent. Fallback chain to ALL_FACTORIES if primary intent has no available providers. Availability checked via `isAvailable()` (env key check).
- **2.3 Provider Implementations**: PASS. 4 providers (fal.ai, OpenAI, Ideogram, Recraft) all implement `ImageProvider` interface. API keys from env vars. Error handling per provider. Timeouts via fetch defaults. Response normalized to `GenerationResponse`.
- **2.4 Prompt Engineering**: PASS. Per-provider prompt adaptation. POD-specific suffix. Negative prompts adapted (OpenAI skipped). Style presets inject prompt suffixes.
- **2.5 Cost Guards**: PASS. Per-user monthly budget ($2.50 free, $25 premium). Per-generation limits. Fail-closed on query error. Monthly spend queried from `ai_generations`.
- **2.6 Generation API Security**: PASS. Both endpoints use `requireAuth()`. Rate limiting (5/min). Input validation via Zod (min 3 chars, max 1000). FAIL (DS-002, DS-003): Error details leaked.
- **2.7 Background Removal**: PASS. 3-provider fallback chain (fal rembg -> fal Bria -> Replicate 851). Auth required. Returns PNG with transparency.
- **2.8 Style Presets**: PASS. 8 presets (minimalist, vintage, geometric, watercolor, pop-art, line-art, botanical, typography). Each has prompt suffix, negative prompt, suggested colors, i18n names.
- **2.9 Generation Latency**: PASS. Inference time tracked and returned. Loading states in UI. fal.ai `enable_safety_checker: true`.
- **2.10 Generation Logging**: PASS. Every generation logged to `ai_generations` table with provider, prompt, cost, inference_ms, intent, confidence, style_preset.
- **2.11 Content Safety**: PASS. `checkPromptSafety()` called before generation. fal.ai safety checker enabled. NSFW results detected and returned with user-friendly message.
- **2.12 Storage Upload**: WARN (DS-015). Images uploaded to `designs/` bucket with UUID filenames. No cleanup mechanism.

### Phase 3: Composition & Production Pipeline (7 PASS, 1 WARN, 2 FAIL)

- **3.1 Production Export**: PASS. `exportProductionPNG` scales to PRODUCTION_DIMENSIONS per product type. Viewport reset before export. Guides/ghost hidden. Transparent background. Alignment guidelines disposed before export to prevent crash.
- **3.2 Composition Rendering (compose-v2)**: PASS. Auth required. Ownership verified on update. Preview + production PNGs uploaded to Supabase Storage. Multi-panel support with JSON URL map. Upsert to `design_compositions`.
- **3.3 Mockup Generation**: FAIL (DS-009). Only 7 templates for 5 product types.
- **3.4 Design-to-Product**: PASS. Creates product via provider API. EU provider validation. GPSR-ready (bg removal, brand config). Variants, pricing, tags supported.
- **3.5 Cart Integration**: PASS. `cart_items.composition_id` column exists (migration). `useCart` sends `composition_id` on add-to-cart. Checkout reads production URLs.
- **3.6 Order Print Files**: PASS. Stripe webhook reads `production_url` from `design_compositions`. Parses JSON for multi-panel. Passes `files[]` to Printful order. No temp products created.
- **3.7 Design Persistence**: PASS. Auto-save with 2s debounce. Draft restoration from localStorage (7-day expiry). `filterGuideObjectsFromJSON` excludes guides. User-scoped via RLS.
- **3.8 Session Management**: PASS. Session created on AI generation. Tracks product_type and status.
- **3.9 Asset Management**: WARN. `user_design_assets` table exists with RLS. But no UI component references this table -- uploaded images are placed directly on canvas without persisting to the assets library.
- **3.10 History Endpoint**: PASS. Returns user's AI generations ordered by date. Auth via cookie token. Limit parameter for pagination.

### Phase 4: API Security & Validation (4 PASS, 0 WARN, 1 FAIL, 3 CRITICAL)

- **4.1 Authentication**: CRITICAL (DS-001). `POST /api/designs` allows unauthenticated inserts. All other endpoints properly use `requireAuth()` or `createServerClient()`.
- **4.2 Input Validation**: PASS. Zod schemas on generate/estimate/mockup endpoints. File type and size validation on ImageTool (10MB, 4 MIME types).
- **4.3 Rate Limiting**: PASS. `designGenerateLimiter` (5/min) on both generate endpoints. `mockupGenerateLimiter` (10/min) on mockup. `designSaveLimiter` on POST /api/designs. Rate limit headers returned.
- **4.4 Error Handling**: FAIL (DS-002, DS-003). All endpoints have try-catch. But two generation endpoints leak `error.message` in production responses.
- **4.5 CORS & Headers**: PASS (Next.js defaults handle CORS). Rate limit headers returned.
- **4.6 Supabase Client Usage**: WARN (DS-017). `compose-v2` uses admin client correctly (RLS bypass for upsert). But `GET /api/designs` uses admin client with manual user_id filter instead of server client.
- **4.7 External Service Security**: PASS. All API keys in env vars. Provider files are server-side only (imported in API routes, not client components).
- **4.8 Storage Security**: PASS. `designs/` bucket created as public (needed for serving preview/production URLs). Files namespaced by composition ID (`compositions/{id}/`).

### Phase 5: Database Schema & Integrity (5 PASS, 1 WARN)

- **5.1 Table Schema**: PASS. All 5 tables have `created_at`. `design_compositions` and `design_sessions` have `updated_at`. User-scoped tables have `user_id` FK to `auth.users`. UUIDs as PKs.
- **5.2 RLS Policies**: PASS. All 4 design tables have RLS enabled + owner policies (`auth.uid() = user_id`). Service role policies exist for admin operations.
- **5.3 Indexes**: PASS. `idx_ai_generations_user` on `(user_id, created_at DESC)`. FK indexes on `design_compositions(product_id, session_id)`, `ai_generations(parent_generation_id, session_id)`, `design_sessions(product_id)`.
- **5.4 Foreign Keys**: PASS. All FKs in place: `user_id -> auth.users (CASCADE)`, `design_compositions.session_id -> design_sessions (SET NULL)`, `ai_generations.session_id -> design_sessions (CASCADE, now nullable)`.
- **5.5 Data Integrity**: PASS. `design_compositions.layers` is JSONB. `ai_generations.cost_usd` is DECIMAL(10,4). Status checks via CHECK constraints.
- **5.6 Storage Bucket**: WARN. Bucket created programmatically with `public: true`. No explicit file size limit or MIME type restriction configured at the bucket level (only validated client-side in ImageTool).

### Phase 6: Mobile UX (2 PASS, 3 WARN, 1 FAIL)

- **6.1 Responsive Layout**: PASS. Mobile-first CSS. Toolbar switches from vertical sidebar (lg:) to horizontal bottom bar. Properties panel moves to bottom sheet on mobile. Canvas scales proportionally.
- **6.2 Touch Targets**: WARN (DS-019). Desktop toolbar uses `size-10` (40px). Mobile undo/redo uses `size-8` (32px), below 44px minimum.
- **6.3 Touch Gestures**: FAIL (DS-010). No pinch-to-zoom or two-finger pan. `touchAction: 'none'` prevents default touch behavior but no custom handlers.
- **6.4 Panel Management**: PASS. Only one panel visible at a time on mobile (bottom sheet). Canvas not obscured (max-h-[35vh] constraint).
- **6.5 Performance on Mobile**: WARN (DS-020). 51 `useCallback`/`useMemo` usages across components (good memoization). Canvas operations debounced. But no explicit mobile performance optimizations.
- **6.6 Offline / Network Resilience**: WARN. Auto-save catches network errors gracefully (try-catch + fallback to localStorage draft). `beforeunload` + `visibilitychange` handlers save drafts. But no explicit retry queue or progress indicator for large uploads.

### Phase 7: Performance & Bundle (4 PASS, 1 WARN)

- **7.1 Bundle Size**: PASS. Fabric.js loaded via `dynamic import()` in `loadFabric()`. AI provider code is server-side only (in `lib/providers/`). Design studio page is code-split via route.
- **7.2 Canvas Performance**: PASS. `preserveObjectStacking: true` prevents visual glitches. Rendering batched via `renderAll()` calls. DPR capped at 2x for iOS memory limits.
- **7.3 Image Optimization**: WARN (DS-021). No explicit image resizing on upload. Large images (up to 10MB) are placed directly as data URLs in canvas state, which bloats JSON serialization and auto-save payloads.
- **7.4 Memory Management**: PASS. Canvas disposed on unmount. Alignment guidelines properly cleaned up. `fabricCanvasRef.current = null` on cleanup. `destroyed` flag prevents stale async operations.
- **7.5 API Response Times**: PASS. Design list paginated (limit 50). Composition fetch uses indexed query. History endpoint has limit parameter.
