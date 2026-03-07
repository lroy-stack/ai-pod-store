---
name: Frontend Performance Audit
description: >
  Comprehensive audit of frontend performance — bundle size, code splitting, image optimization,
  font loading, service worker caching, Core Web Vitals, unused dependencies, and memory management.
  Use when asked to audit performance, bundle size, page speed, loading time, or Core Web Vitals.
allowed-tools: Read, Grep, Glob, Bash
---

# Frontend Performance Audit

Systematic audit of the Next.js frontend performance: bundle analysis, code splitting, dynamic imports, image and font optimization, service worker strategy, Core Web Vitals readiness, unused dependencies, and runtime memory management.

## Prerequisites

Before starting, read these files for architectural context:

- `CLAUDE.md` — architecture, route groups, Docker config, component standards
- `frontend/next.config.ts` — Next.js configuration (141 lines)
- `frontend/package.json` — dependency inventory

## File Map

Keep this reference open throughout the audit. All paths relative to `frontend/`.

### Build Configuration

| File | Role |
|---|---|
| `next.config.ts` | Next.js config: output standalone, reactCompiler true, optimizePackageImports, webpack chunk splitting (maxSize 450KB), 11 remote image patterns, security headers |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `postcss.config.mjs` | PostCSS plugins |
| `tsconfig.json` | TypeScript compiler options |
| `package.json` | 113 total packages (59 prod + 54 dev) |

### Dynamic Imports (5 known)

| Component | File |
|---|---|
| MetaballsBackground (2 instances) | Landing page and app layout |
| WelcomePopup | App layout |
| ChatArea | StorefrontLayout or app layout |
| DesignStudioPage | Design editor page |

### Loading States (8 known)

| Route | File |
|---|---|
| Checkout | `src/app/[locale]/(focused)/checkout/loading.tsx` |
| Cart | `src/app/[locale]/(app)/cart/loading.tsx` |
| Orders | `src/app/[locale]/(app)/orders/loading.tsx` |
| Shop | `src/app/[locale]/(app)/shop/loading.tsx` |
| Profile | `src/app/[locale]/(app)/profile/loading.tsx` |
| Designs | `src/app/[locale]/(app)/designs/loading.tsx` |
| Wishlist | `src/app/[locale]/(app)/wishlist/loading.tsx` |
| Editor | `src/app/[locale]/(editor)/design/[productId]/loading.tsx` |

### Service Worker

| File | Role |
|---|---|
| `src/app/sw.ts` | Serwist service worker (251 lines): StaleWhileRevalidate for images, NetworkOnly for API, Web Push support, Background Sync |

### Font Configuration

| File | Role |
|---|---|
| `src/app/[locale]/layout.tsx` | next/font/google Inter (variable font) |
| Various components | JetBrains Mono preloaded |
| `package.json` | 5 UNUSED @fontsource packages (lato, montserrat, oswald, playfair-display, roboto) — ~1-2MB dead weight |

### Heavy Dependencies

| Package | Estimated Size | Usage |
|---|---|---|
| fabric | ~200KB+ | Design studio canvas editor |
| stripe | ~60KB | Checkout payment processing |
| @supabase/supabase-js | ~50KB | Database client |
| react-markdown | ~30KB | Chat message rendering |
| ai (Vercel AI SDK) | ~40KB | Chat streaming |

### Key Architecture Notes

| Aspect | Status |
|---|---|
| React Compiler | Enabled (auto-memoization) |
| Suspense boundaries | 1 root-level only, no page-level |
| Image optimization | All next/image use sizes prop, no priority={true} on hero images |
| Preconnect links | None found |
| Lighthouse CI | Not configured |
| Total .tsx components | 226 |

---

## Workflow

Execute each phase sequentially. Record every finding with severity, file path, and line number.

### Phase 1: Bundle Size & Code Splitting (10 checks)

#### 1.1 Build Output Analysis

- Run `cd /Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend && npm run build 2>&1 | tail -100` (capture route sizes)
- **Check**: Total First Load JS is under 200KB (gzipped)
- **Check**: No individual page exceeds 300KB First Load JS
- **Check**: Shared chunks are reasonable (not one mega-chunk)
- **Benchmark**: Next.js recommends <70KB shared JS for good LCP

#### 1.2 Webpack Chunk Configuration

- Read `next.config.ts` — webpack splitChunks configuration
- **Check**: maxSize is set (current: 450KB) — is this appropriate?
- **Check**: Vendor splitting separates heavy deps (fabric, stripe, supabase)
- **Check**: No duplicate modules across chunks (check build output for warnings)
- **Benchmark**: Industry target is chunks under 250KB for good caching

#### 1.3 Dynamic Imports

- Search for `dynamic(`, `import(`, `React.lazy` across all `.tsx` and `.ts` files
- **Check**: Fabric.js is dynamically imported (not in initial page bundle)
- **Check**: Design studio page uses `next/dynamic` with `ssr: false`
- **Check**: ChatArea is dynamically imported (heavy dep: ai SDK + react-markdown)
- **Check**: MetaballsBackground is dynamically imported (animation library)
- **Check**: WelcomePopup is dynamically imported
- **Check**: Are there OTHER heavy components that should be dynamically imported but are not?
- Search for top-level `import` of fabric, stripe, or other heavy libs in page files

#### 1.4 optimizePackageImports

- Read `next.config.ts` — `experimental.optimizePackageImports` list
- **Check**: Current list: ai-sdk, supabase, lucide-react, react-markdown
- **Check**: Are there other barrel-export packages that should be listed? (e.g., `date-fns`, `lodash`, `@radix-ui/*`)
- **Check**: `lucide-react` tree-shaking is effective (only used icons are bundled)

#### 1.5 Unused Dependencies

- Read `package.json` dependencies
- Search codebase for imports of each suspicious dependency
- **Known Issue**: 5 @fontsource packages (lato, montserrat, oswald, playfair-display, roboto) are installed but likely unused
- **Check**: Grep for `@fontsource/lato`, `@fontsource/montserrat`, `@fontsource/oswald`, `@fontsource/playfair-display`, `@fontsource/roboto` — are any imported?
- **Check**: Are there other unused dependencies? Check for packages imported nowhere
- **Benchmark**: Each unused package adds to install time and potential supply chain risk

#### 1.6 Tree Shaking Effectiveness

- Search for `import * as` patterns (prevents tree shaking)
- **Check**: No `import * as` for large libraries (lodash, date-fns, icons)
- **Check**: Named imports used consistently (`import { format } from 'date-fns'` not `import * as dateFns`)
- **Check**: Re-export barrels (`index.ts` files) don't prevent tree shaking

#### 1.7 CSS Bundle Size

- Check Tailwind CSS configuration for purge/content settings
- **Check**: `content` array in Tailwind config covers all component paths
- **Check**: No unused CSS utility classes shipped to production
- **Check**: CSS is extracted (not inline JS) for cacheability
- **Benchmark**: Tailwind v4 with proper purge should produce <50KB CSS

#### 1.8 Server Components vs Client Components

- Search for `"use client"` directives across all components
- **Check**: Count of `"use client"` components vs total components
- **Check**: Are there components marked `"use client"` that could be server components?
- **Check**: Layout files avoid `"use client"` (pushes client boundary to leaves)
- **Check**: Data fetching happens in server components (not client-side useEffect)

#### 1.9 Third-Party Script Impact

- Search for `<Script`, `<script`, external script URLs in layout and page files
- **Check**: Third-party scripts use `next/script` with appropriate `strategy` (lazyOnload, afterInteractive)
- **Check**: No render-blocking third-party scripts
- **Check**: Analytics/tracking scripts are deferred
- **Check**: No inline scripts that could be externalized

#### 1.10 Route-Level Code Splitting

- Check that Next.js route-based code splitting is effective
- **Check**: Design studio code is not loaded on shop/cart/checkout pages
- **Check**: Admin-only code is not in frontend bundle
- **Check**: Auth pages don't load shop components
- **Check**: Each route group ((app), (landing), (focused), (editor)) has independent bundles

### Phase 2: Image Optimization (7 checks)

#### 2.1 next/image Usage

- Search for `<img` tags (should be `<Image>` from next/image)
- **Check**: All product images use `next/image` component
- **Check**: No raw `<img>` tags for content images (exceptions: email templates, SVG icons)
- **Check**: `alt` text is provided on all images
- **Severity**: FAIL for raw `<img>` with remote URLs (no optimization, no lazy loading)

#### 2.2 Image Sizes Prop

- Search for `<Image` usage and check for `sizes` prop
- **Check**: All `<Image>` components have `sizes` prop (prevents downloading oversized images)
- **Check**: `sizes` values are responsive (`(max-width: 768px) 100vw, 50vw` pattern)
- **Check**: No `fill` images without `sizes` (causes full-viewport download)

#### 2.3 Priority Images

- Search for `priority` prop on `<Image>` components
- **Check**: Hero/above-the-fold images on landing page have `priority={true}`
- **Known Issue**: No priority={true} on hero images — verify current status
- **Check**: Product grid images do NOT have priority (only first visible row should)
- **Benchmark**: LCP image should always have priority

#### 2.4 Remote Image Patterns

- Read `next.config.ts` — `images.remotePatterns` configuration
- **Check**: 11 remote patterns are configured (Printify, Supabase, fal.ai, Printful)
- **Check**: Patterns are not overly broad (no wildcard `*` hostname)
- **Check**: All actual image sources are covered (no runtime errors from missing patterns)

#### 2.5 Image Formats

- Check `next.config.ts` for image format configuration
- **Check**: WebP or AVIF format is enabled (`formats: ['image/webp']` or `['image/avif', 'image/webp']`)
- **Check**: AVIF is preferred over WebP (30-50% smaller)
- **Benchmark**: AVIF support is 90%+ in modern browsers

#### 2.6 Placeholder / Loading States

- Search for `placeholder`, `blurDataURL`, `loading=` on Image components
- **Check**: Product images have placeholder="blur" or skeleton loading
- **Check**: Large hero images have blur placeholder
- **Check**: No layout shift when images load (proper width/height or aspect-ratio)

#### 2.7 Static Asset Optimization

- Check `public/` directory for large unoptimized assets
- Run `find public/ -type f -size +500k` equivalent
- **Check**: No unoptimized PNG/JPG files over 500KB in public/
- **Check**: SVG files are minified (no unnecessary whitespace/comments)
- **Check**: Favicon and PWA icons are properly sized

### Phase 3: Font Loading (5 checks)

#### 3.1 next/font Strategy

- Read `src/app/[locale]/layout.tsx` — font initialization
- **Check**: Primary font (Inter) uses `next/font/google` (self-hosted, no CLS)
- **Check**: Font variable is applied to `<html>` or `<body>` className
- **Check**: `display: 'swap'` is set (or font is preloaded to avoid FOIT)
- **Check**: Font subset is specified (e.g., `subsets: ['latin']`) to reduce size

#### 3.2 Unused @fontsource Packages

- Grep for imports of each @fontsource package
- **Known Issue**: 5 packages installed: lato, montserrat, oswald, playfair-display, roboto
- **Check**: Are ANY of these imported in the codebase?
- **Check**: If unused, they add ~1-2MB to node_modules and potential bundle risk
- **Recommendation**: Remove unused @fontsource packages from package.json

#### 3.3 JetBrains Mono Usage

- Search for `JetBrains`, `jetbrains`, `font-mono` in components
- **Check**: How is JetBrains Mono loaded? (next/font, @fontsource, or Google Fonts CDN?)
- **Check**: Is it only used in code blocks / monospace contexts?
- **Check**: Is it preloaded or lazy-loaded appropriately?

#### 3.4 Font File Size

- Check total font weight being downloaded
- **Check**: Variable fonts are used where possible (single file vs multiple weights)
- **Check**: Total font download is under 100KB (gzipped)
- **Check**: Only needed weights are loaded (not all 9 weights of Inter)

#### 3.5 FOUT/FOIT Prevention

- **Check**: `font-display: swap` prevents invisible text during load
- **Check**: System font fallback is specified (`font-family: Inter, system-ui, sans-serif`)
- **Check**: No observable font flash on initial load
- **Benchmark**: CLS from font swap should be <0.01

### Phase 4: Service Worker & Caching (6 checks)

#### 4.1 Service Worker Registration

- Search for `serviceWorker`, `register`, `navigator.serviceWorker` in app code
- **Check**: SW is registered on page load
- **Check**: Registration handles unsupported browsers gracefully
- **Check**: SW scope covers the full application

#### 4.2 Caching Strategy

- Read `src/app/sw.ts` (251 lines)
- **Check**: StaleWhileRevalidate for images (correct — shows cached, fetches fresh)
- **Check**: NetworkOnly for API routes (correct — no stale data)
- **Check**: Are static assets (JS, CSS) cached with CacheFirst? (they should be — hashed filenames)
- **Check**: Is there a cache size limit? (unbounded caches can fill device storage)
- **Check**: Cache versioning handles deployments (old caches are purged)

#### 4.3 Offline Support

- **Check**: Does the app work offline (at least show cached pages)?
- **Check**: Is there an offline fallback page?
- **Check**: API failures when offline show appropriate UI (not blank screen)

#### 4.4 Web Push

- Read push notification handling in `sw.ts`
- **Check**: Push subscription is requested at appropriate time (not on first load)
- **Check**: Push payload is validated
- **Check**: Notification click handler navigates correctly

#### 4.5 Background Sync

- Read background sync handling in `sw.ts`
- **Check**: Failed requests are queued for retry
- **Check**: Queue has a maximum size / TTL
- **Check**: Sync events handle network recovery correctly

#### 4.6 Precaching

- Search for `precacheEntries`, `__WB_MANIFEST` in SW files
- **Check**: Critical resources are precached on SW install
- **Check**: Precache list is not too large (slows initial SW install)
- **Check**: Precache includes offline fallback page

### Phase 5: Core Web Vitals Readiness (8 checks)

#### 5.1 Largest Contentful Paint (LCP)

- Identify LCP candidates for key pages: landing, shop, product detail
- **Check**: Landing page hero image has `priority` and `fetchpriority="high"`
- **Check**: No render-blocking resources before LCP element
- **Check**: Server-side rendering delivers LCP content in initial HTML
- **Check**: Preconnect to image CDN domains
- **Known Issue**: No preconnect links found — verify current status
- **Benchmark**: LCP < 2.5s (good), < 4.0s (needs improvement)

#### 5.2 Cumulative Layout Shift (CLS)

- Search for elements without explicit dimensions that could cause CLS
- **Check**: All images have width/height or aspect-ratio
- **Check**: Fonts use `font-display: swap` with proper fallback metrics
- **Check**: Dynamic content (ads, banners, popups) reserves space
- **Check**: No content injected above the fold after initial render
- **Check**: WelcomePopup does not cause layout shift (overlay, not inline)
- **Benchmark**: CLS < 0.1 (good), < 0.25 (needs improvement)

#### 5.3 Interaction to Next Paint (INP)

- Search for heavy event handlers, synchronous operations on click/input
- **Check**: Click handlers don't perform synchronous heavy computation
- **Check**: Form submissions are async (no blocking the main thread)
- **Check**: Long task detection — any single task >50ms?
- **Check**: React Compiler (enabled) helps with re-render performance
- **Benchmark**: INP < 200ms (good), < 500ms (needs improvement)

#### 5.4 Suspense Boundaries

- Search for `<Suspense` across all files
- **Known Issue**: Only 1 root-level Suspense boundary, no page-level
- **Check**: Pages with async data should have Suspense boundaries for streaming
- **Check**: Shop page (product grid) should have Suspense for progressive loading
- **Check**: Product detail page should have Suspense for reviews/related products
- **Recommendation**: Add page-level Suspense boundaries for streaming SSR

#### 5.5 Preconnect & Preload

- Search for `<link rel="preconnect"`, `<link rel="preload"`, `<link rel="dns-prefetch"` in layouts
- **Known Issue**: No preconnect links found
- **Check**: Preconnect to Supabase API domain
- **Check**: Preconnect to image CDN (Printful/Printify image hosts)
- **Check**: Preconnect to Stripe (if checkout is a common flow)
- **Check**: dns-prefetch for less critical external domains

#### 5.6 Loading States Coverage

- Glob for `loading.tsx` files
- **Check**: 8 known loading.tsx files — verify all routes have them
- **Check**: Any routes WITHOUT loading.tsx? (causes full-page loading state)
- **Check**: Loading states use skeleton UI (not spinners) for better perceived performance
- **Check**: Loading states match the layout of the loaded page (reduce CLS)

#### 5.7 Streaming SSR

- Search for `generateMetadata`, `generateStaticParams`, server component data fetching
- **Check**: Product pages use streaming (data fetching in server components, not useEffect)
- **Check**: Meta tags are generated server-side (not client-side)
- **Check**: Static pages use `generateStaticParams` where appropriate

#### 5.8 Lighthouse CI

- Search for `.lighthouserc`, `lighthouse`, `lhci` in project config files
- **Known Issue**: No Lighthouse CI configuration found
- **Check**: Is there any automated performance testing?
- **Recommendation**: Add Lighthouse CI to CI/CD pipeline with performance budgets

### Phase 6: Memory & Runtime Performance (6 checks)

#### 6.1 Memory Leaks — Canvas Editor

- Read design studio components for cleanup patterns
- **Check**: Fabric.js canvas is disposed on unmount (`canvas.dispose()`)
- **Check**: Event listeners are removed on unmount
- **Check**: Object URLs are revoked (`URL.revokeObjectURL`)
- **Check**: No growing arrays/maps held in component state indefinitely
- **Benchmark**: Long design sessions (30+ min) should not show memory growth

#### 6.2 Memory Leaks — Chat

- Search for chat-related state management, message history
- **Check**: Chat message history is bounded (max messages in state)
- **Check**: Streaming connections are properly closed
- **Check**: AI SDK response objects are cleaned up
- **Check**: Chat images/previews don't accumulate in memory

#### 6.3 React Re-render Optimization

- Search for `useMemo`, `useCallback`, `React.memo` in key components
- **Check**: React Compiler is enabled (handles most memoization automatically)
- **Check**: Context providers don't cause unnecessary re-renders (value stability)
- **Check**: Large lists use virtualization (react-window, react-virtuoso) or pagination
- **Check**: Product grid doesn't re-render all items on filter change

#### 6.4 Event Listener Cleanup

- Search for `addEventListener`, `useEffect.*return` patterns
- **Check**: Every addEventListener has a corresponding removeEventListener in cleanup
- **Check**: Window/document event listeners in useEffect have cleanup returns
- **Check**: ResizeObserver / IntersectionObserver are disconnected on unmount

#### 6.5 Debouncing & Throttling

- Search for `debounce`, `throttle`, `setTimeout` in interactive components
- **Check**: Search/filter inputs are debounced (300-500ms)
- **Check**: Resize handlers are throttled
- **Check**: Auto-save in design studio is debounced (not on every keystroke)
- **Check**: Scroll handlers are throttled or use IntersectionObserver

#### 6.6 Web Worker Usage

- Search for `Worker`, `SharedWorker`, `web-worker` in codebase
- **Check**: Heavy computations (image processing, canvas export) offloaded to workers?
- **Check**: If not using workers, do heavy operations block the main thread?
- **Recommendation**: Consider Web Workers for design studio export and image processing

---

## Output Format

Generate `AUDIT_PERFORMANCE_[DATE].md` at the workspace root with the following structure:

```markdown
# Frontend Performance Audit — [DATE]

## Executive Summary

[2-3 paragraph overview: bundle health, loading performance, runtime efficiency, key bottlenecks. State Core Web Vitals readiness.]

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| Bundle Size & Code Splitting | 10 | X | X | X | X | X% |
| Image Optimization | 7 | X | X | X | X | X% |
| Font Loading | 5 | X | X | X | X | X% |
| Service Worker & Caching | 6 | X | X | X | X | X% |
| Core Web Vitals Readiness | 8 | X | X | X | X | X% |
| Memory & Runtime Performance | 6 | X | X | X | X | X% |
| **TOTAL** | **42** | **X** | **X** | **X** | **X** | **X%** |

## Findings

| ID | Severity | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|
| PF-001 | CRITICAL | Bundle | [description] | `next.config.ts:XX` | [fix] |
| PF-002 | FAIL | Images | [description] | `src/components/XX.tsx:XX` | [fix] |
| PF-003 | WARN | Fonts | [description] | `package.json` | [fix] |
| ... | ... | ... | ... | ... | ... |

## Critical Blockers (Must Fix Before Production)

1. [PF-001] — [description and fix]
2. ...

## High Priority (Fix Within Sprint)

1. [PF-0XX] — [description]
2. ...

## Warnings (Fix Before V2)

1. [PF-0XX] — [description]
2. ...

## Bundle Analysis

| Metric | Value | Target | Status |
|---|---|---|---|
| Total First Load JS (shared) | X KB | <70 KB | [PASS/FAIL] |
| Largest page bundle | X KB | <200 KB | [PASS/FAIL] |
| Total CSS | X KB | <50 KB | [PASS/FAIL] |
| Unused dependencies | X packages | 0 | [PASS/FAIL] |
| Dynamic imports count | X | 5+ for heavy deps | [PASS/FAIL] |
| "use client" components | X / 226 total | <50% | [PASS/FAIL] |

## Dependency Audit

| Package | Size (est.) | Used? | Dynamic Import? | Recommendation |
|---|---|---|---|---|
| fabric | ~200KB | Yes (design studio) | Yes | OK |
| stripe | ~60KB | Yes (checkout) | [check] | [recommendation] |
| @fontsource/lato | ~150KB | [check] | N/A | Remove if unused |
| @fontsource/montserrat | ~200KB | [check] | N/A | Remove if unused |
| @fontsource/oswald | ~150KB | [check] | N/A | Remove if unused |
| @fontsource/playfair-display | ~200KB | [check] | N/A | Remove if unused |
| @fontsource/roboto | ~200KB | [check] | N/A | Remove if unused |

## Core Web Vitals Estimate

| Metric | Estimated | Good | Needs Improvement | Poor |
|---|---|---|---|---|
| LCP | X s | <2.5s | 2.5-4.0s | >4.0s |
| CLS | X | <0.1 | 0.1-0.25 | >0.25 |
| INP | X ms | <200ms | 200-500ms | >500ms |

## Priority Actions

1. [Numbered list of fixes ordered by impact and effort]
```

## Severity Levels

- **CRITICAL**: >500KB JS on critical path, render-blocking resources, memory leaks causing crashes, security headers missing. Blocks production launch.
- **FAIL**: Missing optimization with measurable impact (>100ms LCP, >0.1 CLS), unused heavy dependencies in bundle, broken caching. Must fix before release.
- **WARN**: Sub-optimal pattern, missing best practice, minor performance gap. Should fix before V2.
- **PASS**: Meets performance targets and industry standards.

## Notes

- Always verify findings against actual code (read the file, cite the line number). Never report speculative issues.
- Run `npm run build` to get actual bundle sizes — do not estimate without build data.
- Bundle sizes in build output are gzipped. Raw sizes are typically 3-4x larger.
- React Compiler (enabled) automatically handles most memoization — don't flag missing useMemo/useCallback unless React Compiler is ineffective for that case.
- Core Web Vitals estimates should note they are code-analysis based, not field data (which requires RUM).
- Compare against competitors: Printful storefront, Redbubble, TeeSpring for POD-specific benchmarks.
