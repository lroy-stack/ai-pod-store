# SKAPARA Product Experience Audit -- 2026-03-07

## Executive Summary

**Overall Score: 7.5/10 -- Strong Foundation with Key Gaps**

The product experience is well-architected with a solid data pipeline from Supabase through API to UI. Strengths include: hybrid vector+keyword search (RRF), variant-level pricing, color swatches on cards, cross-sell via association rules, recently viewed tracking, social proof indicators, photo reviews, shared wishlists, mobile sticky CTA, and full JSON-LD structured data. Critical gaps: no image zoom/lightbox on PDP, SQL injection vulnerability in two SSR pages, SSR shop pages missing `deleted_at` filter, hardcoded size guide data not from provider, no back-in-stock notifications, review photos not displayed, and hardcoded exchange rates.

---

## Findings

### 1. Product Listing

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-01 | API returns comprehensive data: id, title, description, price, compareAtPrice, currency, image, images[], rating, reviewCount, category, tags, inStock, variants (sizes/colors/colorImages), labels, createdAt | INFO | `src/app/api/products/route.ts:664-684` | N/A -- well-structured response |
| PX-02 | Images use Next.js `<Image>` with `fill` and responsive `sizes` attribute. `priority` prop passed for above-fold cards. Fallback ImageOff icon when image fails. | GOOD | `src/components/products/ProductCard.tsx:109-117` | N/A |
| PX-03 | Price formatting uses `Intl.NumberFormat` with locale-aware currency conversion (EUR base). Sale prices show strikethrough + percentage badge. "From" prefix for variant pricing. | GOOD | `src/components/products/ProductCard.tsx:95-243` | N/A |
| PX-04 | ProductCard shows: image, category label, star rating+count, title (1-line clamp), description (2-line clamp), price, add-to-cart button, quick-view button, wishlist heart, color swatches, out-of-stock overlay, product badges (trending/bestseller/new/sale/limited) | GOOD | `src/components/products/ProductCard.tsx:101-266` | N/A |
| PX-05 | Color swatches on card use miniature product images (not solid color dots), supporting click and hover to change displayed image. Well-implemented variant preview. | GOOD | `src/components/products/ProductCard.tsx:138-164` | N/A |
| PX-06 | Quick add-to-cart from grid: single-variant products add directly; multi-variant products open detail panel for selection. Smart behavior. | GOOD | `src/components/products/ProductCard.tsx:65-81` | N/A |
| PX-07 | Category filtering resolves slugs to IDs, supports parent+children hierarchy. Subcategory chips on category pages with product counts. | GOOD | `src/app/api/products/route.ts:14-36` | N/A |
| PX-08 | Hybrid search: Gemini embeddings (768-dim) for vector search + PostgreSQL ilike for keyword search, combined via Reciprocal Rank Fusion (k=60). Falls back to text-only if GEMINI_API_KEY missing. | GOOD | `src/app/api/products/route.ts:154-269` | N/A |
| PX-09 | **SQL INJECTION in SSR shop page**: Search query is interpolated directly into `.or()` without sanitization: `productsQuery = productsQuery.or(\`title.ilike.%${query}%,...\`)`. The API route (`route.ts`) uses `sanitizeForLike()`, but the SSR page does not. | CRITICAL | `src/app/[locale]/(app)/shop/page.tsx:320` | Apply `sanitizeForLike()` from `@/lib/query-sanitizer` before interpolating `query` into the PostgREST filter |
| PX-10 | **SQL INJECTION in SSR category page**: Same unsanitized interpolation pattern. | CRITICAL | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx:241` | Same fix: sanitize `query` before interpolation |
| PX-11 | **SSR shop page missing `deleted_at` filter**: The SSR query uses `.eq('status', 'active')` but does NOT filter `.is('deleted_at', null)`. The API route does both. Soft-deleted products could appear in SSR. | HIGH | `src/app/[locale]/(app)/shop/page.tsx:296` | Add `.is('deleted_at', null)` to the SSR product query |
| PX-12 | **SSR category page also missing `deleted_at` filter**: Same issue. | HIGH | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx:237` | Add `.is('deleted_at', null)` |
| PX-13 | ProductBadge labels are hardcoded in English ("Trending", "Bestseller", etc.) -- not i18n-ized | LOW | `src/components/products/ProductBadge.tsx:12-18` | Use `useTranslations()` for label text |
| PX-14 | Default pagination limit is 10 in API but 20 in SSR pages. Mismatch could cause confusion for client-side pagination. | LOW | `src/app/api/products/route.ts:518` vs `shop/page.tsx:173` | Align defaults or always pass explicit limit |

### 2. Product Detail Page

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-15 | Image gallery: main image with thumbnail strip below (grid-cols-4). Thumbnails clickable to select. Images filtered by selected color/size variant via colorImageIndices/sizeImageIndices mapping. | GOOD | `src/components/products/ProductDetailClient.tsx:355-398` | N/A |
| PX-16 | **No image zoom or lightbox**: PDP has no zoom-on-hover, pinch-to-zoom, or fullscreen lightbox. Users cannot inspect print details. Major UX gap for POD store. | HIGH | `src/components/products/ProductDetailClient.tsx:356-371` | Add a lightbox library (e.g., yet-another-react-lightbox) or zoom-on-hover component |
| PX-17 | Variant selection uses `<Select>` dropdowns for both size and color. Unavailable combinations show strikethrough + "Out of Stock" text. Cross-filtering: selecting a color updates available sizes and vice versa. | GOOD | `src/components/products/ProductDetailClient.tsx:510-591` | Consider visual color swatches (circles) instead of dropdown for color selection on PDP |
| PX-18 | Size guide: exists as dialog component, triggered by link next to size selector. Only shown for apparel categories (t-shirts, hoodies, etc.). | GOOD | `src/components/products/ProductDetailClient.tsx:515` | N/A |
| PX-19 | Product description rendered as plain text via `<p>` tag. | GOOD | `src/components/products/ProductDetailClient.tsx:442` | N/A |
| PX-20 | GPSR/safety information displayed in a collapsible `<details>` element with `<SafeHTML>` renderer (DOMPurify expected). Shield icon indicator. | GOOD | `src/components/products/ProductDetailClient.tsx:493-505` | N/A |
| PX-21 | Material, care instructions, print technique, and manufacturing country all displayed with icon indicators when data is present. | GOOD | `src/components/products/ProductDetailClient.tsx:446-489` | N/A |
| PX-22 | Breadcrumb navigation: Home > Shop > Category > Product. Uses shadcn/ui Breadcrumb components. JSON-LD BreadcrumbList also generated. | GOOD | `src/app/[locale]/(app)/shop/[id]/page.tsx:134-172` | N/A |
| PX-23 | Mobile sticky CTA (SmartStickyCTA): appears when main add-to-cart button scrolls out of viewport. Shows price, mini color dots (first 5), quantity +/- controls, and add-to-cart button. `md:hidden` so desktop-only hidden. | GOOD | `src/components/products/SmartStickyCTA.tsx` | N/A |
| PX-24 | Share button: uses Web Share API (native share sheet on mobile) with clipboard fallback. | GOOD | `src/components/products/ProductDetailClient.tsx:300-318` | N/A |
| PX-25 | Design Studio link: PDP has a "customize" button linking to `/design/{productId}`. | GOOD | `src/components/products/ProductDetailClient.tsx:623-627` | N/A |
| PX-26 | Per-variant pricing: when variants have different prices, the UI shows the exact price for the selected size+color combination, updating reactively. | GOOD | `src/components/products/ProductDetailClient.tsx:76-89, 220-223` | N/A |
| PX-27 | ISR with 1-hour revalidation for PDP, 5-minute for shop page, 10-minute for category pages. Top 50 products x 3 locales = 150 pages pre-rendered at build time. | GOOD | `src/app/[locale]/(app)/shop/[id]/page.tsx:9, 12-24` | N/A |

### 3. Product Data Quality

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-28 | Products table fields used: id, title, description, category_id, tags, base_price_cents, compare_at_price_cents, currency, images (JSONB array), branded_hero_url, status, avg_rating, review_count, created_at, translations (JSONB), product_details (JSONB), provider_product_id, deleted_at, tenant_id | INFO | `src/app/api/products/route.ts:579` | N/A |
| PX-29 | product_details JSONB fields: material, care_instructions, print_technique, manufacturing_country, brand, safety_information, finish | INFO | `src/app/api/products/[id]/route.ts:90, 202-208` | N/A |
| PX-30 | Translations support: JSONB `translations` field with `{locale: {title, description}}` structure. Applied server-side in API route. SSR shop page applies translations for API responses but NOT for its own SSR-rendered products. | MEDIUM | `src/app/[locale]/(app)/shop/page.tsx:379-396` | SSR shop page should also apply locale translations to product titles/descriptions |
| PX-31 | SEO metadata generated per product: title with price, description, OG tags, Twitter cards, canonical URLs with hreflang alternates for en/es/de. | GOOD | `src/app/[locale]/(app)/shop/[id]/page.tsx:27-78` | N/A |
| PX-32 | JSON-LD structured data: Product schema with AggregateOffer (variant pricing) or Offer (single price), AggregateRating, BreadcrumbList, seller Organization. Also ItemList on shop/category pages. | GOOD | `src/app/[locale]/(app)/shop/[id]/page.tsx:97-132` | N/A |
| PX-33 | Product images come from Printful sync (images JSONB array with src/url/alt). branded_hero_url prepended as first image when available. | INFO | `src/app/api/products/[id]/route.ts:93-101` | N/A |
| PX-34 | **Hardcoded exchange rates**: Currency conversion uses hardcoded rates (EUR=1, USD=1.09, GBP=0.86). No real-time rate updates. | MEDIUM | `src/lib/currency.ts:75-79` | Integrate a live exchange rate API (e.g., ECB daily rates) or at minimum update rates via cron |
| PX-35 | **Category page SSR does not apply locale translations**: Products on category pages always show English title/description regardless of locale. | MEDIUM | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx:272-289` | Apply `applyTranslations()` to product data in SSR |

### 4. Sizing & Fit

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-36 | Size guide exists as `SizeGuide` component using shadcn Dialog. Shows measurements in a table (size, chest, length, shoulder, sleeve). | GOOD | `src/components/products/SizeGuide.tsx` | N/A |
| PX-37 | **Hardcoded size data**: Size measurements are hardcoded in the component for 4 product types (tshirt, hoodie, sweatpants, tank). Not synced from Printful provider data. | HIGH | `src/components/products/SizeGuide.tsx:30-76` | Fetch size charts from Printful API or store them per blueprint in the database |
| PX-38 | Size guide only shown for apparel categories: t-shirts, pullover-hoodies, zip-hoodies, crewnecks, tanks. Not shown for: kids clothing, long-sleeves, or any non-apparel. | MEDIUM | `src/components/products/ProductDetailClient.tsx:515` | Expand category matching or make size guide data-driven |
| PX-39 | Size availability per variant: implemented. Unavailable sizes show strikethrough + "Out of Stock" text in dropdown. Cross-filtering resets selections when combination becomes unavailable. | GOOD | `src/components/products/ProductDetailClient.tsx:119-154` | N/A |
| PX-40 | No size recommendation / fit finder tool. Users must rely on static size charts. | LOW | N/A | Consider adding a "find my size" questionnaire (height/weight/preferred fit) |

### 5. Reviews & Social Proof

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-41 | Review system fully implemented: submit reviews (POST /api/reviews), fetch approved reviews (GET /api/reviews), star rating (1-5), text comment (min 10 chars), photo upload (up to 3 photos, 5MB each). | GOOD | `src/app/api/reviews/route.ts` | N/A |
| PX-42 | Review moderation: reviews have `moderation_status` field, GET only returns `approved` reviews. | GOOD | `src/app/api/reviews/route.ts:189` | N/A |
| PX-43 | Verified purchase badge: API checks if user has a completed order for the product. | GOOD | `src/app/api/reviews/route.ts:80-88` | N/A |
| PX-44 | Review credit reward: 1 credit awarded for first review per product (idempotent). | GOOD | `src/app/api/reviews/route.ts:123-154` | N/A |
| PX-45 | Star rating display on product card and PDP. Average rating shown with decimal. | GOOD | `src/components/products/ProductCard.tsx:192-198` | N/A |
| PX-46 | **Review photos stored but never displayed**: Reviews accept `image_urls` in the API, but `getProductReviews()` in `product-detail-cache.ts` does NOT select `image_urls`. The PDP review rendering only shows text. | HIGH | `src/lib/product-detail-cache.ts:206-223` | Add `image_urls` to the select query and render photos in the review card |
| PX-47 | **Review author always "Verified Buyer"**: `getProductReviews()` hardcodes `author: 'Verified Buyer'` for all reviews. No actual user name resolution. | MEDIUM | `src/lib/product-detail-cache.ts:217` | Join with `users` table or `profiles` table to get display name |
| PX-48 | Social proof indicator on PDP: shows "Selling Fast" badge, "X bought this week", "Y viewed today" -- data from `product_daily_metrics` table. | GOOD | `src/components/products/SocialProofIndicator.tsx` | N/A |
| PX-49 | **No review pagination**: PDP limits to 10 reviews (`limit(10)`). No "load more" or pagination for products with many reviews. | LOW | `src/lib/product-detail-cache.ts:209` | Add pagination or "load more" button |
| PX-50 | Rate limiting on review submission: `reviewLimiter.check()` prevents spam. | GOOD | `src/app/api/reviews/route.ts:45-47` | N/A |

### 6. Cross-Sell & Upsell

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-51 | "Customers Also Bought" section: uses `association_rules` table (co-purchase data) with lift-based ranking. Falls back to same-category products. Up to 4 products shown. | GOOD | `src/lib/product-detail-cache.ts:258-344` | N/A |
| PX-52 | Dedicated cross-sell API: `GET /api/products/[id]/cross-sell` with same logic. | GOOD | `src/app/api/products/[id]/cross-sell/route.ts` | N/A |
| PX-53 | Recently viewed products: tracked in localStorage (max 8 items), displayed on PDP excluding current product (up to 4 shown). | GOOD | `src/hooks/useRecentlyViewed.ts`, `src/components/products/ProductDetailClient.tsx:744-770` | N/A |
| PX-54 | Trending products API: uses `trending_products` materialized view with weighted 7-day score (views + orders). Falls back to review_count ordering. | GOOD | `src/app/api/products/trending/route.ts` | N/A |
| PX-55 | **No bundle suggestions**: No "complete the look" or "buy together and save" bundle functionality. | LOW | N/A | Consider creating curated bundles (hat + tee, mug + coaster) with discount |
| PX-56 | **No complementary product logic**: Cross-sell is same-category. No cross-category recommendations (e.g., "You liked this hoodie? Try matching hat"). | MEDIUM | `src/lib/product-detail-cache.ts:316-322` | Add cross-category recommendations using tags or manual curation |

### 7. Wishlist & Save

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-57 | Dual-mode wishlist: guests use localStorage (product IDs), authenticated users use server-side wishlists via `/api/wishlist`. | GOOD | `src/app/[locale]/(app)/wishlist/page.tsx` | N/A |
| PX-58 | Multiple wishlists: authenticated users can create named wishlists, share them (public link with share token), add all to cart. | GOOD | `src/app/[locale]/(app)/wishlist/page.tsx:124-142, 162-179` | N/A |
| PX-59 | Wishlist heart on every product card and PDP. Toggle state reflects immediately. | GOOD | `src/components/products/ProductCard.tsx:166-180` | N/A |
| PX-60 | Share product via Web Share API or clipboard copy. | GOOD | `src/components/products/ProductDetailClient.tsx:300-318` | N/A |
| PX-61 | **No back-in-stock notification**: No mechanism to subscribe for alerts when an out-of-stock product becomes available. | MEDIUM | N/A | Add email notification signup for out-of-stock products |
| PX-62 | Guest wishlist promo banner: non-authenticated users see a sign-up prompt to persist their wishlist. Dismissible. | GOOD | `src/app/[locale]/(app)/wishlist/page.tsx:234-253` | N/A |

### 8. Inventory & Availability

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-63 | Stock status: derived from variant availability (`is_enabled=true AND is_available=true`). Product shows "In Stock" / "Out of Stock" badge on PDP. | GOOD | `src/components/products/ProductDetailClient.tsx:428-436` | N/A |
| PX-64 | Out-of-stock overlay on product cards: semi-transparent overlay with "Out of Stock" badge. Add-to-cart button disabled. | GOOD | `src/components/products/ProductCard.tsx:131-135, 249` | N/A |
| PX-65 | Variant-level availability: unavailable size/color combinations shown with strikethrough in dropdowns. Cross-filtering prevents selecting invalid combos. | GOOD | `src/components/products/ProductDetailClient.tsx:250-263` | N/A |
| PX-66 | **No low-stock indicators**: No "Only X left" or "Limited availability" warnings. POD products are made-to-order so this may be N/A, but could be useful for limited editions. | LOW | N/A | Consider for limited edition products |
| PX-67 | **No pre-order capability**: No mechanism to accept orders for upcoming products. | LOW | N/A | Not critical for POD model |
| PX-68 | inStock determination is binary (any available variant = in stock). No granular stock count exposed to frontend. Appropriate for POD where stock is effectively unlimited for available variants. | INFO | `src/app/api/products/[id]/route.ts:199` | N/A |

### 9. Product Performance

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| PX-69 | PDP is server-rendered (ISR, 1h revalidation) with client-side interactivity. Product data fetched at build/revalidation time. Reviews and related products fetched server-side. | GOOD | `src/app/[locale]/(app)/shop/[id]/page.tsx:9` | N/A |
| PX-70 | React.cache deduplication: `getProduct()`, `getProductReviews()`, `getRelatedProducts()` use React.cache to avoid duplicate DB calls within the same request. | GOOD | `src/lib/product-detail-cache.ts:84, 204, 258` | N/A |
| PX-71 | Redis caching: product detail and related products cached in Redis (cross-request). Category tree and counts also cached. | GOOD | `src/lib/product-detail-cache.ts:86-87, 198, 261, 308` | N/A |
| PX-72 | Image loading: Next.js Image component with `fill` layout and responsive `sizes`. `priority` set for first product card and PDP main image. | GOOD | `src/components/products/ProductCard.tsx:114`, `ProductDetailClient.tsx:364` | N/A |
| PX-73 | Batch variant fetching: `fetchVariantsByProductId()` makes a single query for all product IDs on a page, avoiding N+1. | GOOD | `src/app/api/products/route.ts:72-115` | N/A |
| PX-74 | Social proof indicator makes an extra API call per product view (`/api/products/{id}/social-proof`). Not cached. | LOW | `src/components/products/SocialProofIndicator.tsx:23-33` | Add short TTL cache (1-5 min) to social proof API |
| PX-75 | QuickViewModal available for rapid product browsing without full page navigation. Opens in dialog overlay. | GOOD | `src/components/products/QuickViewModal.tsx` | N/A |
| PX-76 | **Duplicate fetchVariantsByProductId implementations**: The same function is duplicated in 3 files: `api/products/route.ts`, `shop/page.tsx`, and `shop/category/[slug]/page.tsx`. | LOW | Multiple files | Extract to shared utility (e.g., `lib/variant-queries.ts`) |

---

## Product Data Completeness Matrix

| Field | products table | product_details JSONB | product_variants | translations |
|-------|---------------|----------------------|-----------------|-------------|
| title | YES | N/A | N/A | YES (en/es/de) |
| description | YES | N/A | N/A | YES (en/es/de) |
| price | YES (base_price_cents) | N/A | YES (price_cents per variant) | N/A |
| compare_at_price | YES (compare_at_price_cents) | N/A | N/A | N/A |
| currency | YES | N/A | N/A | N/A |
| images | YES (JSONB array) | N/A | YES (image_url per variant) | N/A |
| branded_hero_url | YES | N/A | N/A | N/A |
| category | YES (category_id FK) | N/A | N/A | N/A |
| tags | YES (text array) | N/A | N/A | N/A |
| avg_rating | YES | N/A | N/A | N/A |
| review_count | YES | N/A | N/A | N/A |
| material | N/A | YES | N/A | NO |
| care_instructions | N/A | YES | N/A | NO |
| print_technique | N/A | YES | N/A | NO |
| manufacturing_country | N/A | YES | N/A | NO |
| brand | N/A | YES | N/A | N/A |
| safety_information | N/A | YES (HTML) | N/A | NO |
| finish | N/A | YES (derived from variants) | N/A | N/A |
| size | N/A | N/A | YES | N/A |
| color | N/A | N/A | YES | N/A |
| is_enabled | N/A | N/A | YES | N/A |
| is_available | N/A | N/A | YES | N/A |
| external_variant_id | N/A | N/A | YES | N/A |
| SEO meta_title | NO (generated from title) | N/A | N/A | N/A |
| SEO meta_description | NO (generated from desc) | N/A | N/A | N/A |

**Notable gaps**: Material/care/safety fields are NOT translated (only English). No dedicated SEO meta fields per product.

---

## Priority Action Items

1. **[P0] SQL Injection in SSR pages** (PX-09, PX-10): Both `shop/page.tsx:320` and `shop/category/[slug]/page.tsx:241` interpolate raw user input into PostgREST `.or()` filters. Apply `sanitizeForLike()` from `@/lib/query-sanitizer` immediately.

2. **[P0] Missing `deleted_at` filter in SSR pages** (PX-11, PX-12): SSR product queries in `shop/page.tsx:296` and `category/[slug]/page.tsx:237` do not filter `.is('deleted_at', null)`. Soft-deleted products may appear.

3. **[P1] No image zoom/lightbox on PDP** (PX-16): Users cannot inspect print quality or design details. Critical for a print-on-demand store where design is the primary value proposition. Add lightbox with zoom capability.

4. **[P1] Review photos stored but never shown** (PX-46): The review submission flow accepts and stores photos, but `getProductReviews()` does not query `image_urls` and the review display component does not render photos. Users upload photos that disappear.

5. **[P1] Hardcoded size guide data** (PX-37): Size measurements are hardcoded for 4 product types. They may not match actual Printful product dimensions. Should be data-driven from the provider.

6. **[P2] Review author always "Verified Buyer"** (PX-47): All reviews show the same anonymous author name, reducing trust and social proof.

7. **[P2] SSR pages missing locale translations** (PX-30, PX-35): Products on SSR-rendered shop and category pages always show English text regardless of user locale.

8. **[P2] Hardcoded exchange rates** (PX-34): EUR/USD/GBP rates hardcoded at `1.09` and `0.86`. Will become inaccurate over time.

9. **[P2] No back-in-stock notifications** (PX-61): Users cannot subscribe to availability alerts for out-of-stock items.

10. **[P3] Extract duplicate fetchVariantsByProductId** (PX-76): Same function appears in 3 files -- DRY violation.
