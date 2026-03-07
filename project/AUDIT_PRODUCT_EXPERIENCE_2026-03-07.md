# Product Experience Audit — 2026-03-07

## Executive Summary

The SKAPARA POD store has a **solid foundation** for product presentation with well-structured components, proper use of shadcn/ui, semantic tokens, and i18n support across 3 locales. The architecture includes variant-aware image galleries, social proof indicators, cross-sell recommendations, and a review system with photo uploads. However, several critical gaps in image zoom, VAT transparency, size recommendations, and search UX reduce conversion potential.

---

## Product Presentation Score

| # | Aspect | Score (1-5) | Status | Evidence / Notes |
|---|--------|:-----------:|--------|------------------|
| 1 | Image quality (mockups) | 4 | Good | Uses Printful mockups via `product_variants.image_url`. Color-variant images swap correctly via `colorImageIndices` mapping in `product-detail-cache.ts:14-81`. Fallback placeholder with `ImageOff` icon present. |
| 2 | Image count per product | 3 | Adequate | Multiple images supported (thumbnail gallery in `ProductDetailClient.tsx:374-398`). Depends on Printful data — some products may only have 1-2 mockups. |
| 3 | Image zoom / lightbox | 1 | Missing | **No zoom/lightbox anywhere.** Grep for `zoom|lightbox|magnif` returns zero product-related results. Users cannot inspect print details, fabric texture, or design quality. |
| 4 | Color variant images | 5 | Excellent | `ProductCard.tsx:34-47` — color swatches with mini-mockup thumbnails on hover/click. `ProductDetailClient.tsx:186-198` — gallery filters by `colorImageIndices`. URL param `?color=` carries selection from card to detail page. |
| 5 | Image performance | 4 | Good | All images use `next/image` with `fill` + `sizes` prop (responsive loading). `priority` on first 4 grid items (`ProductGrid.tsx:49`). Format depends on Printful CDN (typically JPG). No explicit AVIF/WebP optimization at app level. |
| 6 | Description quality | 3 | Adequate | Descriptions rendered as plain text (`ProductDetailClient.tsx:442`). `SafeHTML` used for GPSR safety info only. No rich formatting, no benefit-focused structure. Quality depends on seed data — risk of generic AI-generated feel. |
| 7 | i18n / translations | 4 | Good | Full 3-locale support (en/es/de) via `next-intl`. Category names, UI labels, and prices all localized. Product descriptions stored per-locale in Supabase. `ProductBadge.tsx` labels are **hardcoded in English** ("Trending", "Bestseller", "New") — not translated. |
| 8 | Pricing presentation | 4 | Good | `formatPrice()` uses `Intl.NumberFormat` with locale-aware currency. Compare-at price with strikethrough + discount badge (`StrikethroughPrice.tsx`). "From" price for variant pricing (`hasVariantPricing`). Per-variant price updates reactively. |
| 9 | VAT / tax transparency | 1 | Missing | **No VAT indication anywhere.** EU stores are legally required to show "incl. VAT" or equivalent. Grep for `VAT|vat|tax|incl` returns zero relevant matches. |
| 10 | Size guide | 4 | Good | `SizeGuide.tsx` — Dialog with measurement table (cm). Covers tshirt, hoodie, tank, sweatpants. Category mapping (`t-shirts` -> `tshirt`, etc.) is correct. Conditionally shown for apparel categories (`ProductDetailClient.tsx:515`). |
| 11 | Size recommendation | 1 | Missing | No fit finder, no "model is wearing size X", no body measurement input. Grep for `size.*recommend|fit.*finder` returns nothing. |
| 12 | Material & care info | 5 | Excellent | `ProductDetailClient.tsx:446-489` — dedicated specs section with icons (Shirt, Droplets, Printer, Globe). Shows materials, care instructions, print technique, manufacturing country. Sourced from `product_details` JSONB. |
| 13 | GPSR safety information | 5 | Excellent | `ProductDetailClient.tsx:493-505` — collapsible `<details>` with `SafeHTML` rendering. EU 2023/988 compliance. Shield icon. Present on all products with safety data. |
| 14 | Review system | 4 | Good | `ReviewForm.tsx` — star rating, text comment (min 10 chars), photo upload (up to 3, max 5MB each). `product_reviews` table with `is_verified_purchase` flag. Verified purchase badge shown. Review count displayed on cards and detail page. |
| 15 | Review empty state | 4 | Good | "Be the first to review" message (`ProductDetailClient.tsx:670-672`). "Write a Review" CTA button. Not pushy, but functional. |
| 16 | Social proof (views/orders) | 4 | Good | `SocialProofIndicator.tsx` — fetches `/api/products/[id]/social-proof`. Shows "Selling Fast" badge (>5 orders/week), "X bought this week", "X viewed today". Data from `product_daily_metrics` table. |
| 17 | Product badges / labels | 3 | Adequate | `ProductBadge.tsx` supports: trending, bestseller, new, sale, limited. Styled with semantic tokens. **But labels are English-only** — not i18n translated. Only first label shown. |
| 18 | Stock / availability | 3 | Adequate | In stock / Out of stock badges shown. Out-of-stock variants disabled with strikethrough + text. Cross-filtering: unavailable color/size combos auto-disabled. **No "Only X left" urgency.** No low-stock threshold. |
| 19 | "Notify me" (back in stock) | 1 | Missing | No waitlist or email notification for OOS products. Grep returns zero results. |
| 20 | Related products | 4 | Good | "Customers Also Bought" section (`ProductDetailClient.tsx:728-741`). Uses `association_rules` table (co-purchase ML data) with category-based fallback. Up to 4 products. |
| 21 | Cross-sell in cart | 4 | Good | `CartCrossSell.tsx` — "You might also like" in cart. Same association_rules + category fallback. Up to 4 items. |
| 22 | Recently viewed | 4 | Good | `ProductDetailClient.tsx:744-770` — localStorage-based tracking via `useRecentlyViewed()`. Shows up to 4 products on detail page. Color images carried through. |
| 23 | Breadcrumbs | 5 | Excellent | Full breadcrumb chain: Home > Shop > Category > Product (`ProductDetailClient.tsx:323-351`). JSON-LD BreadcrumbList structured data for SEO (`page.tsx:134-172`). |
| 24 | Category navigation | 4 | Good | Category chips with product counts on shop page. Subcategory chips for hierarchical navigation. Collapsible with "+N" expand button. Sort by: featured, price, newest, top rated. |
| 25 | Search | 3 | Adequate | Debounced search input (300ms). Searches by API. Empty state messages. **No autocomplete/suggestions.** No search on product detail page. No "popular products" on zero results. |
| 26 | Quick view | 5 | Excellent | `QuickViewModal.tsx` — full modal with image, price, variants, quantity, add-to-cart. Also `DetailPanel.tsx` — side panel with tabs for multiple products. "View Full Details" link to full page. |
| 27 | Mobile sticky CTA | 5 | Excellent | `SmartStickyCTA.tsx` — IntersectionObserver-based. Shows when main CTA scrolls out. Price, mini color dots, quantity +/-, add-to-cart. `md:hidden` — mobile only. |
| 28 | SEO / structured data | 5 | Excellent | JSON-LD Product schema with AggregateOffer (variant pricing), AggregateRating. OG tags, Twitter cards. Canonical URLs with `hreflang` alternates. ISR with 1-hour revalidation. `generateStaticParams` for top 50 products x 3 locales. |
| 29 | Share functionality | 4 | Good | `navigator.share()` with clipboard fallback. Toast notification on copy. |
| 30 | Custom design integration | 4 | Good | "Design" button (Paintbrush2 icon) links to `/design/[productId]` from detail page and detail panel. `compositionId` param for AI-generated designs. |

**Overall Score: 3.5 / 5** (106 / 150)

---

## Critical Gaps

### 1. No Image Zoom / Lightbox (Score: 1/5)
- **Impact**: HIGH — Users cannot inspect print quality, fabric texture, or design details. Critical for a POD store where customers can't touch the product.
- **Location**: `ProductDetailClient.tsx:356-371` (main image), `ProductImageGallery.tsx:32-43` (detail panel)
- **Fix complexity**: Medium — add a lightbox library (e.g., `yet-another-react-lightbox`) or pinch-to-zoom on mobile.

### 2. No VAT Indication (Score: 1/5)
- **Impact**: HIGH — EU legal requirement. Prices must show "incl. VAT" or "inkl. MwSt." for German locale.
- **Location**: `formatPrice()` in `currency.ts` returns price only; `ProductDetailClient.tsx:419`, `ProductCard.tsx:231-236`.
- **Fix complexity**: Low — add `<span className="text-xs text-muted-foreground">incl. VAT</span>` below prices, localized via i18n.

### 3. No Size Recommendation / Fit Finder (Score: 1/5)
- **Impact**: MEDIUM-HIGH — POD apparel has high return rates when sizing is unclear. No "model is wearing" notes, no body measurement tool.
- **Location**: `SizeGuide.tsx` has measurements but no recommendation engine.
- **Fix complexity**: Medium — add a simple fit quiz (height + weight -> recommended size) or "True to size / Runs small / Runs large" indicator.

### 4. No "Back in Stock" Notification (Score: 1/5)
- **Impact**: MEDIUM — Lost sales when items are temporarily unavailable. No email capture for OOS products.
- **Fix complexity**: Low — email input + `notify_restock` table + webhook on variant availability change.

---

## Quick Wins

### 1. Add "incl. VAT" text (Effort: 1h)
Add a localized string below every price display. Three files to update:
- `ProductCard.tsx` (grid card price)
- `ProductDetailClient.tsx` (detail page price)
- `StrikethroughPrice.tsx` (sale prices)

i18n keys: `product.inclVAT` -> "incl. VAT" / "IVA incl." / "inkl. MwSt."

### 2. Translate ProductBadge labels (Effort: 30min)
`ProductBadge.tsx:12-18` — `LABEL_TEXT` is hardcoded English. Replace with `useTranslations('product.labels')` and add keys for trending/bestseller/new/sale/limited in all 3 locale files.

### 3. Add "Only X left" urgency for low stock (Effort: 2h)
The `SocialProofIndicator` already fetches order data. Add a stock threshold check (e.g., <10 units). Show "Only X left in stock" on product detail. The `product_variants.is_available` flag exists but no numeric stock count is tracked — would need a `stock_quantity` field or Printful sync.

### 4. Add "Popular searches" on empty search results (Effort: 1h)
`ShopPageClient.tsx:327-333` — current empty state is just text. Add links to popular categories or trending products.

### 5. Add basic image zoom on click (Effort: 3h)
Wrap the main product image in a dialog/modal that shows the full-resolution image. No external library needed — use the existing `Dialog` component from shadcn/ui.

---

## Recommendations (Prioritized)

### P0 — Legal / Compliance
1. **Add VAT indication** on all price displays (EU legal requirement)
2. **Verify GPSR data completeness** — ensure ALL active products have `safety_information` populated

### P1 — High-Impact Conversion
3. **Image zoom/lightbox** — critical for print-on-demand where design quality is the selling point
4. **Size recommendation** — even a simple "True to size" indicator reduces return anxiety
5. **"Back in stock" email capture** — recovers lost sales from OOS products

### P2 — Polish & Trust
6. **Translate ProductBadge labels** — labels like "Trending" and "Bestseller" should be in user's language
7. **Low stock urgency** ("Only X left") — needs stock quantity data from Printful
8. **Search autocomplete** — debounced suggestions as user types
9. **"Model is wearing size X"** notes — add to product_details JSONB for apparel

### P3 — Advanced
10. **Customer review photos in gallery** — allow review photos to appear alongside product mockups
11. **Fit quiz / size finder** — interactive tool that recommends sizes based on body measurements
12. **Product comparison** — side-by-side comparison for similar items (already have `ComparisonTableArtifact`)
13. **Real-time exchange rates** — replace hardcoded `convertPrice()` rates in `currency.ts:75-78`

---

## Architecture Strengths Noted

- **Three-tier product types** (`ProductBase` / `ProductCard` / `ProductDetail`) in `types/product.ts` — clean data hierarchy
- **Redis + React.cache dual caching** in `product-detail-cache.ts` — efficient for ISR pages
- **Association rules engine** for cross-sell — ML-powered recommendations, not just category-based
- **Unavailable combination cross-filtering** — when selecting a color, unavailable sizes are auto-disabled and vice versa
- **Smart sticky CTA** with IntersectionObserver — mobile UX best practice
- **JSON-LD structured data** with AggregateOffer for variant pricing — proper SEO
- **Multiple product views** — full page, quick view modal, detail panel (side panel with tabs) — all share the same data layer

## Key Files Referenced

| File | Role |
|------|------|
| `frontend/src/components/products/ProductCard.tsx` | Grid card with color swatches, wishlist, quick view |
| `frontend/src/components/products/ProductDetailClient.tsx` | Full product detail page (client component) |
| `frontend/src/app/[locale]/(app)/shop/[id]/page.tsx` | Server component: ISR, metadata, JSON-LD, data fetching |
| `frontend/src/lib/product-detail-cache.ts` | Product data assembly, variant-image mapping, caching |
| `frontend/src/components/products/SizeGuide.tsx` | Size guide dialog with measurement tables |
| `frontend/src/components/products/SocialProofIndicator.tsx` | Views/orders social proof badges |
| `frontend/src/components/products/SmartStickyCTA.tsx` | Mobile sticky add-to-cart bar |
| `frontend/src/components/products/ReviewForm.tsx` | Review submission with photo upload |
| `frontend/src/components/products/StrikethroughPrice.tsx` | Sale price with discount badge |
| `frontend/src/components/products/ProductBadge.tsx` | Product labels (trending, bestseller, etc.) |
| `frontend/src/components/products/QuickViewModal.tsx` | Quick view modal from grid |
| `frontend/src/components/storefront/DetailPanel.tsx` | Side panel with artifact tabs |
| `frontend/src/components/cart/CartCrossSell.tsx` | Cart cross-sell recommendations |
| `frontend/src/components/shop/ShopPageClient.tsx` | Shop page with search, filters, pagination |
| `frontend/src/lib/currency.ts` | Price formatting and currency conversion |
| `frontend/src/types/product.ts` | Product type hierarchy |
