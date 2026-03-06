# Production Audit — Frontend UX, Performance, PWA, SEO, and Email

**Date**: 2026-03-06
**Auditor**: Production Readiness Agent
**Stack**: Next.js 16+ App Router, React 19, Tailwind v4, shadcn/ui, next-intl (en/es/de), Serwist PWA

---

## Executive Summary

The frontend is architecturally mature and production-capable, with ISR, React Server Components, structured data, multilingual support, a real service worker, and a complete transactional email suite. However, several concrete gaps exist that must be resolved before launch: native browser `alert()` calls in checkout, a critical URL mismatch in the sitemap (`/products/` vs `/shop/`), missing `x-default` hreflang on the shop index, no unsubscribe mechanism in transactional emails (CAN-SPAM/EU breach), missing PWA icon assets (`icon-192.png`, `icon-512.png`), and an incomplete robots.txt that does not disallow crawling of private user pages. The pagination implementation renders every page number as a button, which will fail at scale. Color variant selection at checkout has no validation that the cart variant still matches an available stock combination. These are the P0 blockers. Everything else is P1 or improvement-grade.

---

## 1. Core Shopping UX

### Current State

**Shop landing** (`shop/page.tsx`) renders a `ShopCategoryLanding` when no search query is present, and a filtered `ShopPageClient` with 20-items-per-page SSR data when a search query exists. Category tree and counts are Redis-cached with a 5-minute TTL. ISR revalidates every 5 minutes.

**Category pages** (`shop/category/[slug]/page.tsx`) support parent/child hierarchy with subcategory chips, breadcrumbs, ISR at 10-minute TTL, and `generateStaticParams` for all active DB categories. Category-level JSON-LD (ItemList) is emitted.

**Product card** (`ProductCard.tsx`) supports: color swatch hover preview (image switches), wishlist toggle (optimistic), quick view via storefront context artifact system, "add to cart" with smart variant detection (single variant → direct add, multiple → opens detail panel), sale price strikethrough + percentage badge, stock-out overlay, and `priority` for LCP images.

**Product detail** (`ProductDetailClient.tsx`) supports: multi-image gallery with thumbnail grid, cross-filtering of size/color availability (unavailable combinations shown as strikethrough in dropdowns), per-variant pricing, `useRecentlyViewed` tracking, analytics events, GPSR safety section (collapsible `<details>`), size guide, share API, wishlist, SmartStickyCTA (mobile sticky bar), social proof indicator, and related products.

**Search** is client-side debounced (300ms) with a server SSR initial pass. The search only queries title and description with `ilike`; there is no full-text index or fuzzy matching.

**Sorting**: 5 options (featured, price asc/desc, newest, top rated). "Featured" maps to `created_at DESC` — there is no true merchandising/pinning field.

**ProductGrid** uses an auto-fill CSS grid (`neu-grid`) allowing 1 to 5 columns adaptively.

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **Pagination renders all page buttons** — `Array.from({ length: totalPages }, ...)` renders every page as a button. At 300 products (15 pages) this is fine, at 10,000 products it breaks. | High at scale | P1 |
| **No price-range filter** | Missing e-commerce standard | P1 |
| **Search is `ilike` only** — no full-text search, no typo tolerance, no synonym matching | Poor search UX | P1 |
| **"Featured" sort = `created_at DESC`** — no merchandising/pinning logic | Editorial control gap | P2 |
| **No product count on category chips** in search mode (only shown on category landing chips) | Minor | P2 |
| **`fetchVariantsByProductId` is duplicated** in `shop/page.tsx` and `shop/category/[slug]/page.tsx` | Maintainability | P2 |
| **Lack of "in stock" filter** | Missing filter for POD where variants may go out of stock | P2 |
| **Color swatch images on ProductCard** only work if `product_variants.image_url` is populated; any product with NULL image_url shows no swatches | Data dependency | P1 |

### Recommendations

- Replace full-page-number pagination with ellipsis pagination (first, prev, …, current±1, …, last).
- Add Supabase full-text index on `products(title, description)` and use `textSearch()` instead of `ilike`.
- Add a `featured_order` integer column to products for editorial sort.

---

## 2. Cart and Checkout UX

### Current State

**CartView** (`CartView.tsx`) is feature-rich: quantity +/- with undo-on-remove toast (5 seconds), variant edit (size/color) in-place, coupon code with `sessionStorage` persistence across cart→checkout, shipping estimator by ZIP+country, free-shipping progress bar, cross-sell block, and guest/auth branching for checkout CTA.

**CheckoutView** (`CheckoutView.tsx`) implements: multi-step breadcrumb, saved address selection for authenticated users, guest email capture with email regex validation, tax calculation (auto-triggered on address change), gift message toggle, coupon code restore from `sessionStorage`, exit intent dialog, trust badges, and Stripe Checkout redirect.

Guest checkout is supported via `?guest=true` parameter and email collection before Stripe redirect.

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **Native `alert()` used in 3 places** in `CheckoutView.tsx` (lines 195, 199, 275): `alert('Failed to save address...')` and `alert('Failed to proceed to payment...')` — these are browser-native modals with no i18n, no brand styling, and block the event loop. Must be replaced with `toast.error()`. | Broken UX on error paths, untranslated | P0 |
| **Shipping estimator calls `/api/cart/shipping-estimate`** — this endpoint does not exist in the codebase (not found in routes). Will 404 silently since no error is shown for network failures. | Feature appears broken | P0 |
| **Coupon API calls `/api/coupons/validate`** — this endpoint does not appear to exist in the routes. Cart view has complete coupon UI but the backing route may be missing. | Feature appears broken | P0 |
| **Tax calculation calls `/api/checkout/calculate-tax`** — this endpoint was not found in the audited routes. | Feature may be broken | P1 |
| **Cart persists only for authenticated users** — guest cart uses localStorage context but there is no server backup; closing the tab loses the cart | Guest abandonment | P1 |
| **No explicit stock re-validation at checkout** before Stripe redirect — the Stripe session creation at `/api/checkout/create-session` has 409 handling, but variant availability is not re-checked client-side before the user is blocked from proceeding | Minor UX confusion at 409 | P2 |
| **Authenticated checkout requires no shipping address entry** — the user is blocked from "Proceed to Payment" if they have saved addresses but haven't selected one, but there is no explicit validation message shown; the button is simply not disabled for this case (only disabled for `cartItems.length === 0` or `creatingSession`) | Subtle checkout blocker | P1 |

---

## 3. Engagement Features

### Current State

**WelcomePopup** (`WelcomePopup.tsx`): Full-screen dialog shown on `/chat` for unauthenticated users. Session-storage keyed, re-shows on new browser session. Fully translated via `engagement.welcome` namespace. Has sign-up/log-in CTAs and a benefits list.

**AuthWallModal** (`AuthWallModal.tsx`): Two-variant modal (`subtle` and `wall`). Wall variant shows brand mark, benefit checklist, premium teaser. Dismissible. Used by `useEngagement` hook.

**InstallPrompt** (`InstallPrompt.tsx`): PWA install banner shown bottom-right after 3 visits, with 7-day dismiss cooldown. Listens to `beforeinstallprompt`. Does not use i18n (install prompt text is hardcoded in English).

**useEngagement** hook: Usage check against `/api/usage/status`, shows auth wall for unauthenticated users trying non-chat actions, upgrade modal for free-tier users at limit. Fail-open (returns `true`) on network error.

**Wishlist** (`useWishlist.tsx`): Dual-mode (guest localStorage + server). Guest sync on login. Optimistic UI with rollback. Max 50 guest items. Guest wishlist page shows promo banner urging sign-up.

**Recently Viewed** (`useRecentlyViewed.ts`): localStorage only, max 8 items. No server persistence. Used in ProductDetailClient to render a "Recently Viewed" section.

**Newsletter**: Double opt-in (GDPR/UWG compliant), localized confirmation email, crypto-random token.

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **InstallPrompt is not translated** — text is hardcoded English: `"Add to your home screen for a faster experience"` | Broken UX for ES/DE users | P1 |
| **WelcomePopup only shown on `/chat`** — users who enter via `/shop` or `/` see no onboarding prompt | Missed conversion opportunity | P2 |
| **useEngagement has hardcoded English reason strings** — `'Sign up free to create AI designs'`, `'Create a free account to continue'`, `'Get more with Premium'` — not i18n | Untranslated engagement copy | P1 |
| **Guest wishlist: "Added to wishlist" / "Removed from wishlist" toasts in English only** (lines 143, 144, 153 of `useWishlist.tsx`) | Untranslated toasts for ES/DE | P1 |
| **Wishlist page guest mode**: Link `href="/shop"` is locale-free (should be `/${locale}/shop`) | Broken routing | P1 |
| **Wishlist page guest mode**: Link `href="/auth/register"` is locale-free | Broken routing | P1 |
| **`addAllToCart` in wishlist page** has no success/error toast feedback; also does not use optimistic UI — it fires sequential `fetch` calls with no visible progress | Silent failure possible | P2 |

---

## 4. Landing Page

### Current State

**Landing page** (`(landing)/page.tsx` + `LandingPageClient.tsx`): Server component fetches 12 products (seasonal sort), reviews (locale-filtered, approved, max 6), total paid orders count, and average rating — all in a single `Promise.all()`. Full i18n via `landing` namespace. JSON-LD for Organization + WebSite with SearchAction. ISR revalidates at default (no `revalidate` export — falls back to Next.js default, likely `false` = static at build time).

**Sections**: Hero (full-viewport, WebGL metaballs background with CSS gradient fallback, floating brand mark), How It Works (3-step cards, scroll-reveal), Product Showcase (carousel with autoplay, SSR data), Testimonials (live reviews + stats), Newsletter Signup, Final CTA.

**MetaballsBackground** is dynamically imported with `ssr: false` — good; the CSS gradient fallback ensures instant paint. Hero has `priority={index < 3}` on carousel images.

**Social proof**: `totalOrders` count, `averageRating` from DB, verified purchase badges.

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **Landing page has no `revalidate` export** — it will be statically generated at build time and never refreshed until next deploy. Product showcase shows stale data. | Stale data in production | P1 |
| **`organizationSchema` uses `${baseUrl}/logo.png`** — this file likely does not exist (brand assets are under `/brand/`). Invalid logo URL in structured data. | SEO structured data error | P1 |
| **`organizationSchema.sameAs` is an empty array** — no social profile links | SEO completeness | P2 |
| **MetaballsBackground WebGL**: no `prefers-reduced-motion` respect — the animation plays regardless of accessibility settings | Accessibility | P1 |
| **Carousel autoplay** (`Autoplay({ delay: 4500, stopOnInteraction: true })`): no `prefers-reduced-motion` check | Accessibility | P1 |
| **Hero has no OG image** — the `generateMetadata` function does not set `openGraph.images` | Social sharing preview absent | P1 |
| **`totalOrders` count query selects `'*'` with `head: true`** which is correct for counting, but also fetches all `orders` data — should use `select('id', { count: 'exact', head: true })` | Minor performance inefficiency | P2 |

---

## 5. Performance

### Current State

**ISR strategy**:
- Shop page: `revalidate = 300` (5 min)
- Category pages: `revalidate = 600` (10 min)
- Product detail pages: `revalidate = 3600` (1 hour), `generateStaticParams` pre-renders top 50 products × 3 locales = 150 pages

**Image optimization**: `next/image` used throughout with `fill`, `sizes`, and `priority` props. Remote patterns cover Printify CDN, Supabase storage, fal.ai, Printful CDN, and placeholder services. WebP/AVIF is automatic via Next.js image optimization.

**Bundle splitting**: `splitChunks` configured with `maxSize: 450000` (450 KB) and `optimizePackageImports` for heavy packages (`lucide-react`, `@supabase/supabase-js`, etc.).

**React Compiler**: Enabled (`reactCompiler: true`) — automatic memoization, eliminates need for manual `useMemo`/`useCallback` annotations.

**Caching layers**:
- React `cache()` for `getCatalogProducts` and `getProductCategories` (request-level dedup)
- Redis (via `getCachedCategoryTree`, `getCachedCategoryCounts`) with TTL
- Product detail cache (`product-detail-cache.ts`) — not read in this audit but referenced

**Service worker caching**: Serwist (Workbox fork) with:
- `NetworkOnly` for all `/api/` routes
- `StaleWhileRevalidate` for Printify CDN images (200-entry cap)
- `CacheFirst` for Supabase storage, fal.ai images (100-entry cap)
- `defaultCache` includes static assets precaching

**Skeleton loaders**: Present for shop, wishlist, designs, cart, checkout (loading.tsx), and per-product card (`ProductCardSkeleton`). Cart loading shows `<Loader2>` spinner rather than skeleton — inconsistent.

**Standalone output**: `output: 'standalone'` set, correct for Docker deployment.

**`cacheComponents` disabled**: Commented out with `TODO: Re-enable once chat API is refactored`. This is a Next.js 16 Server Component caching feature that would reduce DB calls on repeated renders; its absence is a missed optimization.

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **Landing page no `revalidate`** — statically rendered at build time, never refreshes | Stale product showcase | P1 |
| **`fetchVariantsByProductId` is a full table scan** — `product_variants` is queried with `.in('product_id', productIds)` without a limit; for a large catalog this can return thousands of rows per page load | Slow queries at scale | P1 |
| **ShopPageClient uses `{ cache: 'no-store' }` for all client-side product fetches** — bypasses HTTP cache entirely for every filter/sort change | Unnecessary network overhead | P2 |
| **`getCatalogProducts` (product-cache.ts)** selects all active products with no limit — suitable for small catalogs but will degrade at 250+ products | Scalability | P2 |
| **Cart loading shows spinner, not skeleton** — inconsistent with rest of UI | UX inconsistency | P2 |
| **`cacheComponents: true` disabled** — edge runtime conflict with chat API prevents this optimization | Lost perf optimization | P1 (architectural TODO) |
| **No `<Image>` lazy loading for below-fold landing carousel** — only first 3 items have `priority`, remaining are lazy-loaded. Correct. But the carousel auto-advances, which triggers layout shifts when new images load | Minor LCP/CLS risk | P2 |
| **ProductCardSkeleton does not match ProductCard exact layout** — `<p className="text-muted-foreground leading-relaxed">` description block is in card but skeleton renders a shorter block — minor CLS when cards appear | Minor CLS | P3 |
| **No HTTP cache headers on dynamic sitemap routes** — sitemaps are generated on every request with no `Cache-Control` header | Unnecessary DB load from crawlers | P2 |

---

## 6. PWA

### Current State

**Manifest** (`manifest.ts`): Dynamic manifest (generated per request). Properties: `name`, `short_name`, `description`, `start_url: '/'`, `display: standalone`, `orientation: portrait-primary`, `theme_color: #09090b`, categories, icons for 192/512/180 sizes, `lang: en`.

**Service Worker** (`sw.ts` compiled to `public/sw.js`): Serwist-based. Handles:
- Precaching of Next.js static assets
- NetworkOnly for all `/api/*`
- StaleWhileRevalidate for Printify CDN images
- CacheFirst for Supabase storage, fal.ai, placeholder images
- Offline fallback to `/en/offline` for document requests
- Web Push notification handlers
- Background sync for cart actions (via `sync-cart` tag and IndexedDB)
- Old cache cleanup on activate (`printify-images` → `printify-images-v2`)

**ServiceWorkerRegistration** (`ServiceWorkerRegistration.tsx`): Production-only registration. Update detection with `updatefound` event, shows `toast` with "Refresh" action (persistent `duration: Infinity`).

**Offline page** (`offline/page.tsx`): Shows WifiOff icon, localized title/description, refresh button, and cached products from IndexedDB (`getCachedProducts`).

**Push notifications** (`push-notifications.ts`): Server-side VAPID-based via `web-push`. Reads subscriptions from Supabase `push_subscriptions` table. Cleans expired subscriptions (410/404). Graceful skip if VAPID keys not configured.

**Install prompt** (`InstallPrompt.tsx`): After 3 visits, 7-day dismiss cooldown.

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **PWA icons are referenced but likely absent** — `manifest.ts` references `/brand/icon-192.png`, `/brand/icon-512.png`, `/brand/apple-touch-icon.png`. These files are not listed in the git status as tracked files. If they don't exist, the PWA install fails and Chrome DevTools will report manifest icon errors. | PWA install broken | P0 |
| **`start_url: '/'`** — root URL redirects to `/en` (or locale detected by middleware); a user opening the PWA from their home screen will follow that redirect, but the `start_url` in the manifest is not locale-aware. Android will track the exact URL including locale mismatch. | Minor PWA UX | P2 |
| **Offline fallback only covers `/en/offline`** — Spanish or German users who go offline will see the EN offline page (no locale passed to the SW fallback matcher) | i18n gap in offline | P1 |
| **Background sync `syncCartActions`** references `getPendingCartActions()` and `removePendingAction()` which use `indexedDB.open('pod-ai-sync')` — but there is no corresponding client-side code that writes to this IndexedDB store when offline. The sync handler exists but the client side that queues actions is missing. | Background sync non-functional | P1 |
| **`manifest.ts` `lang: 'en'`** is hardcoded — the manifest is not locale-specific. For multilingual PWA, Google recommends locale-specific manifests or at minimum not hardcoding `lang`. | i18n completeness | P3 |
| **Push notification permission is not requested in the app** — no UI component calls `Notification.requestPermission()`. The server-side sender exists but there is no client-side subscription flow visible in the audit. | Push notifications non-functional | P1 |
| **Service Worker registration console.log in production** — `console.log('[SW] Service Worker registered:', registration.scope)` should be `console.debug` or removed | Minor | P3 |

---

## 7. SEO

### Current State

**robots.txt**: Disallows `/api/`, `/auth/`, `/checkout/`. Sitemap pointer to `${baseUrl}/sitemap.xml`.

**Sitemap architecture**:
- `sitemap.xml` (via `sitemap.ts`): Index listing home pages (en/es/de) + chat pages + sub-sitemap URLs (`sitemap-en.xml`, `sitemap-es.xml`, `sitemap-de.xml`)
- `sitemap-en.xml`, `sitemap-es.xml`, `sitemap-de.xml` (separate route handlers): Each independently queries Supabase for products and categories, generates per-locale XML with product and page URLs.

**Structured data (JSON-LD)**:
- Landing page: `Organization` + `WebSite` with `SearchAction`
- Shop index: `CollectionPage` (no-search) or `ItemList` (search)
- Category pages: `ItemList`
- Product detail: `Product` with `Offer`/`AggregateOffer`, `AggregateRating`, plus `BreadcrumbList`

**Meta tags**: All pages have `title`, `description`, `openGraph` (title, description, url, siteName, locale, type), `twitter` (card, title, description), `alternates.canonical`, and `alternates.languages` for hreflang.

**hreflang**: Set on landing page, shop page, product detail pages, and category pages — all with en/es/de. Product detail also includes `x-default` pointing to `/en/shop/{id}`.

**Breadcrumbs**: ARIA breadcrumb component used consistently across shop, category, and product detail pages. JSON-LD BreadcrumbList also emitted from product detail.

**ISR**: All product and category pages use ISR — crawlers will get pre-rendered HTML with full structured data.

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **Sitemap product URLs use `/products/` path** (`${baseUrl}/${locale}/products/${product.id}`) but the actual route in the app is `/shop/${product.id}`. This means all product URLs in the sitemap are 404s. | Critical SEO breakage — crawlers indexing wrong URLs | P0 |
| **`x-default` hreflang missing from shop index page** (`shop/page.tsx` alternates only set en/es/de) | Incomplete hreflang | P1 |
| **`x-default` hreflang missing from category pages** | Incomplete hreflang | P1 |
| **Landing page has no OG image** — `generateMetadata` does not set `openGraph.images`. Twitter card type is `summary_large_image` but no image is supplied. | Social sharing shows no preview image | P1 |
| **robots.txt does not disallow user-specific pages** — `/orders`, `/profile`, `/wishlist`, `/designs` are all crawlable even though they require authentication and return 401/redirect | Crawler waste, possible index of auth-wall pages | P2 |
| **`organizationSchema.logo` is `${baseUrl}/logo.png`** — this file likely does not exist | Broken logo in rich results | P1 |
| **Sitemap `lastModified` for all static pages is `new Date()`** — every request generates the current timestamp, meaning sitemap-diff crawlers will always re-crawl all pages | Crawler inefficiency | P2 |
| **Sitemap sub-routes have no `Cache-Control` header** — queries Supabase on every crawl request | DB pressure from crawlers | P2 |
| **No sitemap for blog pages** — `blog/page.tsx` and `blog/[slug]/page.tsx` exist but are not included in any sitemap | Missing blog SEO | P1 |
| **Category sitemap includes ALL categories** (active) including parent categories that may redirect to subcategory listing — could generate soft 404s if parent categories have no products | Indexing quality | P2 |
| **Product detail `openGraph.type: 'website'`** should be `product` (or `og:type = 'og:product'`) for proper product card rendering on Facebook/WhatsApp | Social sharing quality | P2 |
| **No `noindex` on search results pages** — `?q=` generates unique URLs that are indexable but have low-value duplicate content | Thin content indexing | P2 |

---

## 8. Transactional Emails

### Current State

**Provider**: Resend API via `resend.ts`. Lazy singleton initialization. Falls back gracefully if `RESEND_API_KEY` is not configured (logs warning, does not crash).

**Email types implemented** (all localized EN/ES/DE):
1. `sendOrderConfirmationEmail` — order number, item count, total, shipping-to-come note
2. `sendOrderShippedEmail` — tracking number, carrier, tracking URL CTA button
3. `sendOrderCancelledEmail` — refund amount, reason, 5-10 business day note
4. `sendOrderDeliveredEmail` — delivery confirmation, review CTA, contact support
5. `sendOrderFailedEmail` — problem notice, refund issued, contact support CTA
6. `sendCreditPurchaseEmail` — credits added, new balance, start creating CTA

**Password reset**: Handled by Supabase Auth (`resetPasswordForEmail`) — email is sent by Supabase, not Resend. Anti-enumeration pattern (always returns success).

**Newsletter**: Double opt-in via Resend HTTP API directly (not via `resend.ts` helper). Localized confirmation email in EN/ES/DE.

**Email HTML**: Pure inline-CSS HTML strings. Responsive meta viewport set. Brand header gradient (purple: `#667eea → #764ba2`). All strings are localized via hardcoded dictionaries (not next-intl).

**Localization approach**: All transactional emails use hardcoded object literals (`{ en: ..., es: ..., de: ... }`) — not connected to next-intl translation files.

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **No unsubscribe link or `List-Unsubscribe` header in any transactional email** — CAN-SPAM (US) requires a physical address and unsubscribe mechanism in commercial emails. EU ePrivacy similarly. Even order confirmation emails that mention "future emails" must comply. | Legal compliance breach | P0 |
| **Email gradient colors (`#667eea`, `#764ba2`) do not match SKAPARA brand** (`theme_color: #09090b` in manifest). The email header has a purple gradient that does not reflect the dark/minimal brand identity. | Off-brand | P1 |
| **Order confirmation email does not include item names/images** — only item count and total. A customer cannot see what they ordered without checking the portal. | Poor email UX | P1 |
| **Order shipped email uses `orderId` (UUID) in subject** instead of `orderNumber` (human-readable) — inconsistent with other email subjects | UX inconsistency | P1 |
| **Credit purchase email CTA links to `/en/chat` hardcoded** — locale is not applied to this link | Broken locale routing | P1 |
| **Review CTA in order-delivered email links to `/shop`** (shop listing page) — should link directly to the product detail page for the ordered product to enable one-click review | Missed conversion | P2 |
| **No physical business address** in email footer — CAN-SPAM requires a valid physical address | Legal compliance | P0 |
| **Email localization uses hardcoded string objects** — translation drift possible as the main `messages/*.json` files are updated | Maintainability | P2 |
| **No text/plain alternative** — emails are HTML-only. Some anti-spam systems penalize HTML-only emails | Deliverability risk | P2 |
| **`from` address falls back to `onboarding@resend.dev`** if `RESEND_FROM_EMAIL` is not configured — all production emails must use a verified custom domain | Production configuration | P1 |
| **No email bounce/complaint handling** — Resend webhooks for delivery events are not connected to suppress future sends | Deliverability degradation | P2 |
| **Newsletter confirmation email is sent via raw `fetch` to Resend API** instead of using the `resend` singleton from `resend.ts` — inconsistent pattern | Maintainability | P3 |

---

## 9. Error Handling UX

### Current State

**Focused layout** wraps children with `<ErrorBoundary>` component — client error boundaries present for auth/checkout pages.

**404**: `notFound()` is called in product detail when product is not found. Shop category page also calls `notFound()` for invalid slugs.

**Loading states**: `loading.tsx` files present for: shop, wishlist, cart, orders, profile, checkout, designs, design editor. All use skeleton UI except cart (spinner).

**Empty states**: Present in CartView (empty cart with CTA), WishlistPage (empty state with heart icon + CTA), ProductGrid (configurable `emptyMessage`), CheckoutView (empty cart).

**Form validation**: Guest email validated with regex before checkout. Coupon input validated non-empty before API call. Size/color required validation in product detail (button disabled, no explicit toast shown).

**Toast system**: `sonner` used consistently for success/error feedback throughout cart, wishlist, variant editing. Exceptions: `alert()` in CheckoutView (3 locations) and ChatArea (4 locations).

### Gaps

| Gap | Impact | Priority |
|-----|--------|----------|
| **`alert()` in CheckoutView (lines 195, 199, 275)** — see Cart section above | Broken error UX | P0 |
| **`alert()` in ChatArea (4 instances)** — image validation errors use browser `alert()` | Broken error UX | P0 |
| **Size/color not selected: button disabled but no tooltip or message** — user may not understand why the button is disabled if they haven't scrolled to see the selectors | Poor UX on mobile | P1 |
| **Network errors in product fetch** (ShopPageClient) only `console.error` — no user-visible error state or retry mechanism | Silent failure | P1 |
| **Checkout address save failure**: the `catch` block in `handleAddressSubmit` uses `alert('Failed to save address...')` — not a toast | Already noted above | P0 |
| **Wishlist `addAllToCart` has no loading state or toast** | Silent failure | P2 |
| **ErrorBoundary only in focused layout** — app layout (`(app)/layout.tsx`) does not wrap children with ErrorBoundary | Unhandled React errors crash entire app | P1 |

---

## Performance Checklist

| Check | Status | Notes |
|-------|--------|-------|
| `next/image` with `fill` + `sizes` | PASS | Used throughout |
| `priority` on above-fold images | PASS | First 4 cards + first 3 carousel |
| ISR on product pages | PASS | 1-hour TTL + static top 50 |
| ISR on shop/category pages | PASS | 5-10 min TTL |
| Landing page ISR | FAIL | No `revalidate` — static at build |
| React Compiler enabled | PASS | `reactCompiler: true` |
| Bundle splitting < 500 KB | PASS | `maxSize: 450000` |
| `optimizePackageImports` | PASS | 5 heavy packages configured |
| Skeleton loaders on all routes | PARTIAL | Cart uses spinner |
| Service Worker caching images | PASS | StaleWhileRevalidate for CDN |
| API routes not cached by SW | PASS | NetworkOnly |
| `cacheComponents` | FAIL | Disabled due to Edge runtime conflict |
| No N+1 queries in shop | PASS | Batch variant fetch |
| No N+1 in category tree | PARTIAL | `Promise.all` on parents but each does a Supabase call |
| React `cache()` for per-request dedup | PASS | `getCatalogProducts`, `getProductCategories` |
| Standalone Docker output | PASS | `output: 'standalone'` |

---

## SEO Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Canonical URLs | PASS | Set on all key pages |
| hreflang en/es/de | PASS | On all pages with localized variants |
| `x-default` hreflang | PARTIAL | Only on product detail; missing from shop, categories, landing |
| JSON-LD Product schema | PASS | Product detail |
| JSON-LD ItemList schema | PASS | Shop + category pages |
| JSON-LD Organization + Website | PASS | Landing page |
| JSON-LD BreadcrumbList | PASS | Product detail |
| OG image on landing | FAIL | No `openGraph.images` set |
| OG image on products | PASS | Product image set |
| Sitemap product URLs correct | FAIL | `/products/` vs `/shop/` mismatch |
| robots.txt disallows API | PASS | `/api/` blocked |
| robots.txt disallows auth pages | PARTIAL | `/auth/` blocked, but `/orders`, `/profile` etc. not |
| Breadcrumbs on all listing pages | PASS | |
| `noindex` on search result pages | FAIL | Search `?q=` pages are indexable |
| Blog in sitemap | FAIL | Blog not included in any sitemap |
| Sitemap caching | FAIL | No Cache-Control header |
| Structured data logo URL | FAIL | `${baseUrl}/logo.png` likely 404 |

---

## UX Completeness Matrix

| Feature | Implemented | i18n | Guest Support | Notes |
|---------|-------------|------|---------------|-------|
| Product listing | Yes | Yes | Yes | |
| Category navigation | Yes | Yes | Yes | |
| Product search | Yes | Yes | Yes | `ilike` only |
| Product detail | Yes | Yes | Yes | |
| Size guide | Yes | Partial | Yes | Only for apparel categories |
| Color variant preview | Yes | Yes | Yes | Requires DB image_url |
| Quantity selector | Yes | Yes | Yes | Max 10 in detail, configurable max in cart |
| Add to cart | Yes | Yes | Yes | |
| Cart management | Yes | Yes | Yes | Undo on remove |
| Variant edit in cart | Yes | Yes | Auth only | |
| Coupon codes | Yes | Yes | Yes | API may be missing |
| Shipping estimate | Yes | Yes | Yes | API may be missing |
| Free shipping progress | Yes | Yes | Yes | |
| Guest checkout | Yes | Yes | Yes | |
| Address management | Yes | Yes | Auth only | |
| Gift message | Yes | Yes | Yes | |
| Wishlist | Yes | Partial | Yes (localStorage) | Toast not translated |
| Wishlist sharing | Yes | Yes | Auth only | |
| Recently viewed | Yes | Yes | Yes | localStorage only |
| Reviews | Yes | Yes | Auth only | |
| Social share | Yes | Yes | Yes | Web Share API |
| Push notifications | Partial | No | No | Server ready, no client subscription UI |
| PWA install prompt | Yes | No | Yes | Text hardcoded EN |
| Offline page | Yes | Partial | Yes | Only EN fallback URL |
| Welcome popup | Yes | Yes | Yes | Only on /chat |
| Auth wall | Yes | Yes | Yes | English reason strings |
| Newsletter | Yes | Yes | Yes | Double opt-in |

---

## Final Gaps Table (Sorted by Priority)

| ID | Area | Gap | Priority | Effort |
|----|------|-----|----------|--------|
| G01 | Email | No unsubscribe link / physical address in transactional emails (CAN-SPAM/EU breach) | P0 | Medium |
| G02 | Cart/Checkout | `alert()` used in CheckoutView (3 places) and ChatArea (4 places) | P0 | Low |
| G03 | SEO | Sitemap product URLs use `/products/` instead of `/shop/` — all 404 | P0 | Low |
| G04 | PWA | PWA icon files (`icon-192.png`, `icon-512.png`) may not exist — PWA install broken | P0 | Medium |
| G05 | Cart | `/api/cart/shipping-estimate` and `/api/coupons/validate` may not exist | P0 | Verify |
| G06 | Landing | No `revalidate` export — product showcase is frozen at build time | P1 | Low |
| G07 | Landing | OG image not set — no social sharing preview on landing page | P1 | Low |
| G08 | SEO | Organization JSON-LD logo URL (`/logo.png`) likely 404 | P1 | Low |
| G09 | SEO | Blog pages not in sitemap | P1 | Low |
| G10 | SEO | `x-default` hreflang missing from shop index and category pages | P1 | Low |
| G11 | PWA | Offline SW fallback only for `/en/offline` — ES/DE users see wrong locale | P1 | Low |
| G12 | PWA | No client-side push notification subscription flow | P1 | Medium |
| G13 | PWA | Background sync `syncCartActions` exists but no client writes to the IndexedDB queue | P1 | Medium |
| G14 | Email | Order shipped email uses UUID in subject instead of order number | P1 | Low |
| G15 | Email | Credit purchase CTA links to hardcoded `/en/chat` | P1 | Low |
| G16 | Email | `RESEND_FROM_EMAIL` fallback to `onboarding@resend.dev` | P1 | Config |
| G17 | Email | Order confirmation doesn't list product names/images | P1 | Medium |
| G18 | UX | `useEngagement` hardcoded English reason strings | P1 | Low |
| G19 | UX | `useWishlist` toast messages hardcoded English | P1 | Low |
| G20 | UX | Wishlist page guest links missing locale prefix (`/shop`, `/auth/register`) | P1 | Low |
| G21 | UX | `InstallPrompt` text hardcoded English | P1 | Low |
| G22 | Checkout | Authenticated checkout: no message when user has addresses but none selected | P1 | Low |
| G23 | Search | Search uses `ilike` — no full-text or fuzzy matching | P1 | High |
| G24 | UX | `prefers-reduced-motion` not respected in MetaballsBackground or carousel autoplay | P1 | Low |
| G25 | Cart | Error handling in `fetchProducts` (ShopPageClient) is silent — no user feedback | P1 | Low |
| G26 | Performance | `fetchVariantsByProductId` can return unbounded rows at large catalog scale | P1 | Medium |
| G27 | SEO | `robots.txt` does not disallow `/orders`, `/profile`, `/wishlist`, `/designs` | P2 | Low |
| G28 | SEO | `?q=` search pages not `noindex` — thin content indexing | P2 | Low |
| G29 | SEO | Sitemap `lastModified` is `new Date()` on every request | P2 | Low |
| G30 | SEO | Sitemap routes have no HTTP `Cache-Control` header | P2 | Low |
| G31 | SEO | Product OG `type` is `'website'` instead of `'product'` | P2 | Low |
| G32 | Email | No email bounce/complaint handling | P2 | Medium |
| G33 | Email | `sendOrderDeliveredEmail` review CTA links to shop index, not product page | P2 | Low |
| G34 | Performance | `cacheComponents` disabled — architectural TODO | P2 | High |
| G35 | UX | Pagination renders all page buttons — breaks at scale | P1 | Medium |
| G36 | UX | ErrorBoundary missing from `(app)/layout.tsx` | P1 | Low |
| G37 | UX | No "sticky" variant required message when add-to-cart is disabled | P1 | Low |

---

## Recommendations by Sprint

### Sprint 1 — Legal and Critical Blockers (P0)

1. Add `List-Unsubscribe` header and unsubscribe link + physical address to all Resend emails
2. Replace all `alert()` calls in `CheckoutView.tsx` and `ChatArea.tsx` with `toast.error()`
3. Fix sitemap product URLs from `/products/` to `/shop/`
4. Verify and create PWA icon files at `/public/brand/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`
5. Verify or create `/api/coupons/validate` and `/api/cart/shipping-estimate` routes

### Sprint 2 — SEO and Email Quality (P1)

6. Add `revalidate = 300` to landing page
7. Set `openGraph.images` on landing page (use a brand hero image)
8. Fix `organizationSchema.logo` to a real URL
9. Add blog URLs to sitemap
10. Fix `x-default` hreflang on shop, categories, and landing
11. Fix offline SW fallback to use locale-aware URLs
12. Fix credit purchase email CTA locale
13. Fix order shipped email to use `orderNumber` in subject
14. Set `RESEND_FROM_EMAIL` in production `.env`
15. Fix wishlist locale-free links (`/shop` → `/${locale}/shop`)
16. Translate `useEngagement` reason strings
17. Translate `useWishlist` toasts
18. Translate `InstallPrompt` text
19. Fix `(app)/layout.tsx` to add ErrorBoundary
20. Implement ellipsis pagination in `ShopPageClient`

### Sprint 3 — UX Polish and Performance (P1/P2)

21. Add `prefers-reduced-motion` to MetaballsBackground and carousel
22. Show variant-required message when add-to-cart is disabled
23. Add error state (not just `console.error`) in ShopPageClient `fetchProducts`
24. Add `noindex` to search result pages
25. Update `robots.txt` to disallow `/orders`, `/profile`, `/wishlist`, `/designs`
26. Add `Cache-Control: s-maxage=3600` to sitemap routes
27. Set real `lastModified` dates in sitemap from DB `updated_at`
28. Add order item details to order confirmation email
29. Implement push notification subscription UI
30. Fix background sync IndexedDB write on the client side
