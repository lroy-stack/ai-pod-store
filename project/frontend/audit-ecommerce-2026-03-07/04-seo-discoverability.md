# SKAPARA SEO & Discoverability Audit -- 2026-03-07

## Executive Summary

**Overall SEO Readiness: 7.0/10 -- Good foundation, notable gaps**

The SKAPARA frontend has a solid SEO foundation: every page exports `generateMetadata`, the root layout produces locale-aware OG/Twitter/hreflang tags, JSON-LD structured data covers products, organization, website, breadcrumbs, and articles, and a `robots.ts` + `sitemap.ts` exist. However, several high-impact gaps remain:

- **Sitemap is static and incomplete** -- does not enumerate product or category URLs.
- **Product URLs use UUIDs** (`/shop/abc123-...`) instead of human-readable slugs.
- **No `brand` field in Product JSON-LD** -- Google Merchant Center requirement.
- **No FAQ structured data** despite having a full FAQ page.
- **OG image (`/brand/og-image.png`) referenced but file lives at `/brand/og-image.png`** -- path mismatch risk (relative URL in metadata, not absolute).
- **No `noindex` on private/auth pages** -- robots.txt disallows `/auth/` and `/checkout/` but in-page `noindex` meta tags are absent.
- **Legal pages (terms, privacy, shipping, returns) have no metadata** -- no title, description, OG, or canonical.
- **Wishlist and pricing pages are `'use client'`** with no server-side metadata export.
- **Several pages missing `x-default` hreflang** in their alternates.
- **No `favicon.ico` in `src/app/`** (Next.js convention) -- relies on `public/favicon.ico` which works but misses the metadata API icon generation.

---

## Findings

### 1. Meta Tags & Head

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-01 | Root layout has localized SEO titles and descriptions from DB (`brand_config`) with fallbacks. Good. | OK | `src/app/[locale]/layout.tsx:18-58` | -- |
| SEO-02 | OG image uses relative path `/brand/og-image.png` -- may resolve incorrectly in some crawlers. | Medium | `src/app/[locale]/layout.tsx:52` | Use absolute URL: `${baseUrl}/brand/og-image.png` |
| SEO-03 | Landing page metadata includes OG, Twitter, canonical, alternates. Good. | OK | `src/app/[locale]/(landing)/page.tsx:23-57` | -- |
| SEO-04 | Product detail page includes full OG with images, Twitter card, canonical, hreflang, and `x-default`. Good. | OK | `src/app/[locale]/(app)/shop/[id]/page.tsx:27-78` | -- |
| SEO-05 | Shop page metadata is complete with OG, Twitter, canonical, alternates. Good. | OK | `src/app/[locale]/(app)/shop/page.tsx:179-222` | -- |
| SEO-06 | Category page metadata is complete. Good. | OK | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx:102-138` | -- |
| SEO-07 | **Legal pages (terms, privacy, shipping, returns) have NO metadata export** -- no title, description, OG, canonical, or alternates. | Critical | `src/app/[locale]/(focused)/terms/page.tsx`, `privacy/page.tsx`, `shipping/page.tsx`, `returns/page.tsx` | Add `generateMetadata` with title, description, OG, canonical, and hreflang alternates to each. |
| SEO-08 | **Wishlist page is `'use client'` -- no server metadata possible.** Falls back to root layout metadata. | Medium | `src/app/[locale]/(app)/wishlist/page.tsx:1` | Extract metadata to a separate `layout.tsx` or convert to server component wrapper with client child. However, since wishlist is auth-gated, this is lower priority. |
| SEO-09 | **Pricing page is `'use client'` -- no server metadata.** | Medium | `src/app/[locale]/(app)/pricing/page.tsx:1` | This is a public marketing page -- should have proper SEO metadata. Add a server wrapper or separate layout. |
| SEO-10 | **Offline page is `'use client'` -- no metadata.** | Low | `src/app/[locale]/(app)/offline/page.tsx:1` | Low priority (only shown offline). |
| SEO-11 | Blog listing page metadata is minimal -- has title and description but no OG, Twitter, canonical, or alternates. | Medium | `src/app/[locale]/(app)/blog/page.tsx:23-37` | Add full OG, Twitter card, canonical, and hreflang alternates. |
| SEO-12 | Blog post page metadata has OG with `type: 'article'` and `publishedTime`. Good. But missing canonical and hreflang alternates. | Medium | `src/app/[locale]/(app)/blog/[slug]/page.tsx:48-77` | Add `alternates.canonical` and `alternates.languages`. |
| SEO-13 | Cookies page metadata is minimal -- title and description only, no OG/canonical/alternates. | Low | `src/app/[locale]/(focused)/cookies/page.tsx:7-15` | Add OG, canonical, alternates. |
| SEO-14 | Legal notice page metadata is minimal -- title and description only. | Low | `src/app/[locale]/(focused)/legal/page.tsx:7-15` | Add OG, canonical, alternates. |
| SEO-15 | Referrals page metadata is minimal -- title and description only. | Low | `src/app/[locale]/(app)/referrals/page.tsx:14-26` | This page requires auth, so low priority. |
| SEO-16 | `theme-color` meta tags are set for light/dark. Good. | OK | `src/app/[locale]/layout.tsx:87-88` | -- |
| SEO-17 | Apple mobile web app tags present. Good. | OK | `src/app/[locale]/layout.tsx:89-91` | -- |
| SEO-18 | No favicon link in `<head>` -- relies on Next.js auto-discovery of `public/favicon.ico`. Works but lacks explicit `<link rel="icon">`. | Low | `src/app/[locale]/layout.tsx:77-92` | Add `<link rel="icon" href="/brand/favicon.ico" sizes="any" />` and `<link rel="icon" href="/icon.svg" type="image/svg+xml" />` for clarity. |
| SEO-19 | Category page description is hardcoded in English: `"Browse our collection of..."` -- not localized for es/de. | Medium | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx:112` | Use i18n translation key for the category description template. |

### 2. Structured Data (JSON-LD)

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-20 | **Organization schema** on landing page. Includes name, url, logo, description. `sameAs` array is empty. | Medium | `src/app/[locale]/(landing)/page.tsx:148-158` | Populate `sameAs` with social media URLs when available. |
| SEO-21 | **WebSite schema** with `SearchAction` on landing page. Correct `urlTemplate` pattern. Good. | OK | `src/app/[locale]/(landing)/page.tsx:160-174` | -- |
| SEO-22 | **Product schema** on product detail page. Includes name, description, image, sku, offers (Offer or AggregateOffer), availability, seller, aggregateRating. Good implementation. | OK | `src/app/[locale]/(app)/shop/[id]/page.tsx:97-132` | -- |
| SEO-23 | **Product schema missing `brand` field.** Google requires `brand` for product rich results. | Critical | `src/app/[locale]/(app)/shop/[id]/page.tsx:97-132` | Add `brand: { '@type': 'Brand', name: 'SKAPARA' }` to the Product JSON-LD. |
| SEO-24 | **Product schema missing `mpn` or `gtin`.** Recommended by Google for product identification. | Medium | `src/app/[locale]/(app)/shop/[id]/page.tsx:97-132` | Add `mpn` (could use product ID or Printful SKU) or `gtin` if available. |
| SEO-25 | **BreadcrumbList schema** on product detail page. Correct hierarchy: Home > Shop > Category > Product. Good. | OK | `src/app/[locale]/(app)/shop/[id]/page.tsx:134-172` | -- |
| SEO-26 | **ItemList schema** on shop search results page. Includes top 10 products with nested Product+Offer schemas. Good. | OK | `src/app/[locale]/(app)/shop/page.tsx:398-434` | -- |
| SEO-27 | **CollectionPage schema** on shop category landing. Good. | OK | `src/app/[locale]/(app)/shop/page.tsx:244-250` | -- |
| SEO-28 | **ItemList schema** on category pages with nested products. Good. | OK | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx:297-333` | -- |
| SEO-29 | **Article schema** on blog post pages. Includes headline, datePublished, image, author. Good. | OK | `src/app/[locale]/(app)/blog/[slug]/page.tsx:101-111` | Add `dateModified` if available. |
| SEO-30 | **No FAQPage schema** on the FAQ page despite having structured Q&A data. | High | `src/app/[locale]/(focused)/faq/page.tsx` | Add `FAQPage` JSON-LD with `mainEntity` array of `Question`+`acceptedAnswer` pairs. The data is already structured for this. |
| SEO-31 | **No Review schema** in product JSON-LD. Only `aggregateRating` is present, individual reviews are not included as structured data. | Low | `src/app/[locale]/(app)/shop/[id]/page.tsx` | Consider adding individual `review` entries (top 5) to the Product JSON-LD. |
| SEO-32 | ItemList URLs use `/products/${id}` but actual routes are `/shop/${id}` -- mismatch. | High | `src/app/[locale]/(app)/shop/page.tsx:409,419,425` and `category/[slug]/page.tsx:308,318,324` | Change `${baseUrl}/${locale}/products/${product.id}` to `${baseUrl}/${locale}/shop/${product.id}` in both files. |

### 3. Sitemap

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-33 | **Sitemap is static and hardcoded** -- only lists 3 locale home pages and 3 chat pages. Does NOT enumerate product pages, category pages, legal pages, about, FAQ, contact, blog, or any other content. | Critical | `src/app/sitemap.ts:4-66` | Rewrite as a dynamic sitemap that queries Supabase for all active products, categories, blog posts, and includes all static pages with proper localization. |
| SEO-34 | Sitemap references non-existent locale-specific sitemaps (`/sitemap-en.xml`, `/sitemap-es.xml`, `/sitemap-de.xml`). These files do not exist. | High | `src/app/sitemap.ts:46-62` | Either create these sub-sitemaps via `generateSitemaps()` or remove the references. |
| SEO-35 | `lastModified` uses `new Date()` for all entries -- always returns current time, never reflects actual content modification. | Medium | `src/app/sitemap.ts:12,18,24` | Use actual `updated_at` timestamps from database records. |
| SEO-36 | Priority values: home pages all set to 1, chat pages set to 0.9. No differentiation for product pages. | Low | `src/app/sitemap.ts` | Once products are added, use priority 1.0 for home, 0.8 for categories, 0.7 for products, 0.5 for legal pages. |

### 4. Robots & Crawlability

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-37 | `robots.ts` exists with Allow `/` and Disallow `/api/`, `/auth/`, `/checkout/`. Sitemap reference included. Good baseline. | OK | `src/app/robots.ts:4-21` | -- |
| SEO-38 | **Cart page not blocked** in robots.txt. Cart is a private page with no SEO value. | Low | `src/app/robots.ts:12-16` | Add `/cart/` to disallow list. |
| SEO-39 | **No `noindex` meta tags** on auth/checkout/cart/profile/orders pages. Robots.txt disallow is not a guarantee -- crawlers may still index these pages if linked from elsewhere. | Medium | Multiple pages | Add `robots: { index: false }` to the metadata of auth, checkout, cart, profile, orders, settings, and wishlist pages. |
| SEO-40 | Disallow paths use `/auth/` and `/checkout/` but actual URL structure is `/{locale}/auth/` and `/{locale}/checkout/`. Robots.txt disallow `/auth/` may not match `/en/auth/login`. | High | `src/app/robots.ts:14-16` | Change to `'/*/auth/'`, `'/*/checkout/'`, `'/*/cart/'`, `'/*/orders/'`, `'/*/profile/'`, `'/*/settings/'` or list all locale variants explicitly. |

### 5. URL Structure

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-41 | **Product URLs use UUIDs** (`/en/shop/a1b2c3d4-e5f6-...`) instead of human-readable slugs (`/en/shop/ghost-tee-black`). | High | `src/app/[locale]/(app)/shop/[id]/page.tsx` | Add a `slug` column to the `products` table and use it in URLs. Implement redirects from old UUID URLs. |
| SEO-42 | Category URLs use clean slugs (`/shop/category/t-shirts`). Good. | OK | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx` | -- |
| SEO-43 | Locale prefix handling via next-intl works correctly (`/en/`, `/es/`, `/de/`). | OK | `src/app/[locale]/layout.tsx:14-16` | -- |
| SEO-44 | No trailing slash configuration in `next.config.ts`. Next.js defaults to no trailing slash, which is fine, but should be explicit. | Low | `next.config.ts` | Add `trailingSlash: false` to make the behavior explicit. |
| SEO-45 | No redirects configured in `next.config.ts` for old or moved URLs. | Info | `next.config.ts` | Configure redirects when URL structure changes (e.g., UUID to slug migration). |

### 6. Content & On-Page SEO

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-46 | H1 tags present on all checked pages (landing, shop, product, about, FAQ, contact, blog, legal pages). Good. | OK | Multiple | -- |
| SEO-47 | Landing page H1 comes from i18n translations -- dynamically rendered. Good. | OK | `src/components/landing/LandingPageClient.tsx` | -- |
| SEO-48 | Product detail page H1 uses the product title. Good. | OK | `src/components/products/ProductDetailClient.tsx` | -- |
| SEO-49 | All images use `next/image` (`Image` component) -- 18 files import it. No raw `<img>` tags found in `.tsx` files. Excellent. | OK | 18 component files | -- |
| SEO-50 | Blog post featured image uses raw `<img>` tag instead of `next/image`. | Medium | `src/app/[locale]/(app)/blog/[slug]/page.tsx:138-141` | Replace `<img>` with `<Image>` from `next/image` with proper width/height or `fill`. |
| SEO-51 | Product descriptions may be Printful defaults (not unique). The cron sync strips HTML tags but does not ensure uniqueness. | Medium | `src/lib/printify-sync.ts` | Write unique SEO-optimized descriptions for top-selling products. Use `product_details` JSONB for specs. |
| SEO-52 | Visual breadcrumbs (shadcn/ui `<Breadcrumb>`) present on shop, category, and product pages. Good for UX and internal linking. | OK | `src/app/[locale]/(app)/shop/page.tsx:259-271`, `category/[slug]/page.tsx:343-375` | -- |
| SEO-53 | Heading hierarchy: FAQ page uses H1 > H2 > (accordion items). Good. About page uses H1 > Card titles. Good. | OK | Multiple | -- |
| SEO-54 | Internal linking: category cards link to category pages, product cards link to product pages, breadcrumbs link back. Good. | OK | Multiple | -- |

### 7. Performance (Core Web Vitals Impact)

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-55 | `next/image` used consistently for product images (optimized loading, lazy loading, responsive). Good. | OK | 18 files | -- |
| SEO-56 | Google Fonts loaded via `next/font` (`Inter` with latin subset). Good -- font is self-hosted at build time. | OK | `src/app/[locale]/layout.tsx:8` | -- |
| SEO-57 | Additional Google Fonts loaded via `<link>` in head for theme fonts. Includes `preconnect` hints. Acceptable but adds render-blocking resource. | Low | `src/app/[locale]/layout.tsx:79-84` | Consider using `next/font` for theme fonts too, or add `font-display: swap` if not already present in the CSS URL. The URL already includes `display=swap`. OK. |
| SEO-58 | `optimizePackageImports` configured for large packages (ai-sdk, supabase, lucide-react, react-markdown). Good. | OK | `next.config.ts:33-39` | -- |
| SEO-59 | Webpack `splitChunks` configured with 450KB max chunk size. Good. | OK | `next.config.ts:52-67` | -- |
| SEO-60 | React Compiler enabled (`reactCompiler: true`). Good for performance. | OK | `next.config.ts:28` | -- |
| SEO-61 | Dynamic imports used in 7 files (fabric-init, design editor, landing page, storefront layout, auth background, i18n). Good code splitting. | OK | 7 files | -- |
| SEO-62 | ISR configured: product detail (3600s), shop (300s), category (600s). Good balance of freshness and performance. | OK | `shop/[id]/page.tsx:9`, `shop/page.tsx:176`, `category/[slug]/page.tsx:83` | -- |
| SEO-63 | `generateStaticParams` pre-renders top 50 products x 3 locales = 150 pages at build time. Good. | OK | `src/app/[locale]/(app)/shop/[id]/page.tsx:12-24` | -- |
| SEO-64 | Category pages pre-rendered via `generateStaticParams` fetching active categories. Good. | OK | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx:89-98` | -- |
| SEO-65 | Standalone output mode (`output: 'standalone'`) for Docker deployment. Good. | OK | `next.config.ts:19` | -- |

### 8. International SEO

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-66 | `<html lang={locale}>` set correctly per locale. Good. | OK | `src/app/[locale]/layout.tsx:76` | -- |
| SEO-67 | Root layout sets `alternates.languages` with `x-default` pointing to `/en`. Good. | OK | `src/app/[locale]/layout.tsx:37-44` | -- |
| SEO-68 | Product pages include `x-default` hreflang. Good. | OK | `src/app/[locale]/(app)/shop/[id]/page.tsx:60` | -- |
| SEO-69 | **Landing page alternates missing `x-default`.** | Medium | `src/app/[locale]/(landing)/page.tsx:49-56` | Add `'x-default': '${baseUrl}/en'` to alternates.languages. |
| SEO-70 | **Shop, category, about, FAQ, contact, size-guide alternates all missing `x-default`.** | Medium | Multiple files | Add `'x-default'` to all pages that have hreflang alternates. |
| SEO-71 | SEO titles and descriptions are localized (en/es/de) via `brand_config` table + `next-intl` translations. Good. | OK | `src/lib/brand-config-server.ts:28-43` | -- |
| SEO-72 | OG `locale` field set to proper format (`es_ES`, `de_DE`, `en_US`). Good. | OK | `src/app/[locale]/layout.tsx:50` | -- |
| SEO-73 | Product OG `alternateLocale` set correctly, filtering current locale. Good. | OK | `src/app/[locale]/(app)/shop/[id]/page.tsx:69` | -- |
| SEO-74 | Category page meta description is English-only (`"Browse our collection of..."`) even for es/de locales. | Medium | `src/app/[locale]/(app)/shop/category/[slug]/page.tsx:112` | Use an i18n translation key with interpolation for the category name. |
| SEO-75 | About page meta description is English-only. | Medium | `src/app/[locale]/(focused)/about/page.tsx:19` | Use `t('metaDescription')` instead of hardcoded English string. |
| SEO-76 | FAQ page meta description is English-only. | Medium | `src/app/[locale]/(focused)/faq/page.tsx:19` | Use `t('metaDescription')` instead of hardcoded English string. |
| SEO-77 | `generateStaticParams` in root layout generates all 3 locales. Good. | OK | `src/app/[locale]/layout.tsx:14-16` | -- |

### 9. Technical SEO

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| SEO-78 | Custom 404 pages exist at 3 levels: root (`src/app/not-found.tsx`), locale (`src/app/[locale]/not-found.tsx`), and product-specific (`src/app/[locale]/(app)/shop/[id]/not-found.tsx`). Good coverage. | OK | 3 files | -- |
| SEO-79 | 404 pages are helpful with "Back to Store" / "Browse Products" buttons. Locale-aware. Translated via i18n. Good. | OK | Multiple | -- |
| SEO-80 | Security headers configured: HSTS, X-Frame-Options DENY, CSP with strict-dynamic, Referrer-Policy. Good. | OK | `next.config.ts:117-131` | -- |
| SEO-81 | Service worker (Serwist) configured, disabled in development. Good for PWA but ensure it does not interfere with crawling. | OK | `next.config.ts:12-16` | -- |
| SEO-82 | `manifest.json` linked in head. Good for PWA discoverability. | OK | `src/app/[locale]/layout.tsx:86` | -- |
| SEO-83 | **Favicon exists at `public/favicon.ico` (5.4KB) and `public/icon.svg`** plus `public/brand/favicon-16.png`, `favicon-32.png`, `icon-192.png`, `icon-512.png`. But no explicit `<link rel="icon">` tags in head -- relies on Next.js auto-discovery. | Low | `src/app/[locale]/layout.tsx:77-92` | Consider adding explicit icon links for maximum compatibility, or use Next.js `metadata.icons` API. |
| SEO-84 | `apple-touch-icon` linked to `/icon-192.png` in head. Brand directory also has `apple-touch-icon.png`. Potential inconsistency. | Low | `src/app/[locale]/layout.tsx:91` | Ensure `/icon-192.png` and `/brand/apple-touch-icon.png` are the same file, or consolidate. |
| SEO-85 | No `<link rel="icon">` in the metadata API -- only in manual head tags. | Low | `src/app/[locale]/layout.tsx` | Add `icons` to the `Metadata` export for better Next.js integration. |

---

## SEO Scorecard

| Category | Score | Notes |
|----------|-------|-------|
| Meta Tags & Head | 7/10 | Good coverage on key pages; legal/pricing/wishlist pages missing metadata; some hardcoded English descriptions |
| Structured Data (JSON-LD) | 8/10 | Excellent Product, Organization, WebSite, BreadcrumbList, Article, ItemList schemas. Missing FAQ schema, Product `brand` field, and URL mismatch in ItemList |
| Sitemap | 2/10 | Static, only 6 URLs + broken sub-sitemap references. Does not include products, categories, blog, legal pages |
| Robots & Crawlability | 5/10 | Exists but disallow paths don't match locale-prefixed URLs; no in-page noindex on private pages; cart not blocked |
| URL Structure | 6/10 | Clean category slugs but product URLs use UUIDs; locale handling is correct |
| Content & On-Page SEO | 8/10 | Proper H1s, heading hierarchy, next/image usage, breadcrumbs, internal linking. One raw `<img>` in blog |
| Performance (CWV) | 9/10 | next/font, next/image, ISR, SSG, code splitting, React Compiler, optimizePackageImports. Excellent |
| International SEO | 7/10 | hreflang on most pages but missing `x-default` on many; some hardcoded English meta descriptions |
| Technical SEO | 8/10 | Custom 404s at 3 levels, security headers, PWA manifest, ISR + SSG. Minor icon inconsistencies |
| **Overall** | **7.0/10** | |

---

## Priority Action Items

### P0 -- Critical (blocks organic traffic / rich results)

1. **[SEO-33] Rewrite sitemap.ts to be dynamic.** Query Supabase for all active products, categories, blog posts. Include all static pages (about, FAQ, contact, legal) with all 3 locale variants. This is the single biggest SEO gap -- Google cannot discover most of the site.

2. **[SEO-23] Add `brand` field to Product JSON-LD.** Required by Google for product rich results. Add `brand: { '@type': 'Brand', name: 'SKAPARA' }`.

3. **[SEO-07] Add metadata to legal pages (terms, privacy, shipping, returns).** These are important for E-E-A-T signals and are currently invisible to search engines.

4. **[SEO-32] Fix URL mismatch in ItemList JSON-LD.** Product URLs in structured data use `/products/` but actual routes use `/shop/`. This will cause Google validation errors.

### P1 -- High (significant SEO impact)

5. **[SEO-40] Fix robots.txt disallow paths** to match locale-prefixed URLs (`/*/auth/`, `/*/checkout/`, `/*/cart/`).

6. **[SEO-41] Migrate product URLs from UUIDs to slugs.** Human-readable URLs improve CTR in SERPs and keyword relevance. Implement 301 redirects from old URLs.

7. **[SEO-30] Add FAQPage JSON-LD** to the FAQ page. The data is already structured -- just needs the schema wrapper.

8. **[SEO-34] Remove or implement locale-specific sub-sitemaps** referenced in the main sitemap.

### P2 -- Medium (incremental improvements)

9. **[SEO-69/70] Add `x-default` hreflang** to all pages with alternates (landing, shop, category, about, FAQ, contact, size-guide).

10. **[SEO-74/75/76] Localize hardcoded English meta descriptions** on category, about, and FAQ pages using i18n translation keys.

11. **[SEO-39] Add `robots: { index: false }` metadata** to auth, checkout, cart, profile, orders, settings pages.

12. **[SEO-09] Add server-side metadata to the pricing page** -- this is a public marketing page that should rank.

13. **[SEO-02] Use absolute URL for OG image** in root layout metadata.

14. **[SEO-11/12] Add full OG, canonical, and hreflang to blog pages** (listing and individual posts).

15. **[SEO-50] Replace raw `<img>` with `next/image`** in blog post featured image.

### P3 -- Low (polish)

16. **[SEO-24] Add `mpn` to Product JSON-LD** using the Printful variant ID or product SKU.
17. **[SEO-38] Add `/cart/` to robots.txt disallow** list.
18. **[SEO-44] Add explicit `trailingSlash: false`** to next.config.ts.
19. **[SEO-83/85] Add `icons` to metadata API** for explicit favicon/icon control.
20. **[SEO-20] Populate Organization schema `sameAs`** with social media URLs.
