---
name: SEO & Structured Data Audit
description: >
  Comprehensive audit of SEO implementation — sitemap, robots.txt, metadata, JSON-LD structured data,
  Open Graph tags, canonical URLs, hreflang alternates, and image alt text. Use when asked to audit
  SEO, structured data, metadata, Open Graph, sitemaps, or search engine optimization.
allowed-tools: Read, Grep, Glob, Bash
---

# SEO & Structured Data Audit

Systematic audit of the SKAPARA storefront SEO implementation: sitemap generation, robots rules, page metadata, JSON-LD schemas, Open Graph/Twitter cards, canonical URLs, hreflang alternates, and image accessibility for search engines.

## Prerequisites

Before starting, read these files for architectural context:

- `CLAUDE.md` — route groups, architecture overview, component standards
- `frontend/src/app/[locale]/layout.tsx` (lines 18-59) — root layout with metadata, OG, hreflang
- `frontend/src/app/sitemap.ts` — sitemap generation (67 lines)
- `frontend/src/app/robots.ts` — robots.txt rules (23 lines)

## File Map

Keep this reference open throughout the audit. All paths relative to `frontend/src/`.

### Core SEO Files

| File | Role |
|---|---|
| `app/sitemap.ts` | Dynamic sitemap generation — 3 locales, daily priority |
| `app/robots.ts` | Robots.txt — disallows /api/, /auth/, /checkout/ |
| `app/manifest.ts` | PWA manifest with icons (47 lines) |
| `app/[locale]/layout.tsx` | Root layout — OG image, twitter card, hreflang alternates (lines 18-59) |

### Metadata Coverage (32/39 pages have generateMetadata)

| Status | Pages |
|---|---|
| HAS metadata | 32 pages across all route groups |
| MISSING metadata | `offline`, `pricing`, `wishlist` (2 pages), `editor`, `auth/callback`, `notifications` |

### JSON-LD Structured Data

| Schema Type | Location |
|---|---|
| Organization + WebSite | Landing page |
| Product | Shop, category, product detail pages |
| BreadcrumbList | Navigation breadcrumbs |
| BlogPosting | Blog/content pages |

### Open Graph & Social

| Feature | Implementation |
|---|---|
| OG image | Root layout sets `og-image.png` 1200x630 |
| Twitter card | `twitter:summary_large_image` |
| Canonical URLs | 17 pages with explicit canonical |
| hreflang | `alternates.languages` for en/es/de + x-default |

---

## Workflow

Execute each phase sequentially. Record every finding with severity, file path, and line number.

### Phase 1: Sitemap & Robots (6 checks)

#### 1.1 Sitemap Completeness

- Read `app/sitemap.ts`
- **Check**: Sitemap includes ALL public pages (landing, shop, categories, product details, blog, about, legal)
- **Check**: Sitemap generates entries for all 3 locales (en, es, de)
- **Check**: Dynamic product pages are included (fetched from Supabase at build time)
- **Check**: Priority and changeFrequency values are reasonable (homepage=1.0/daily, products=0.8/weekly, legal=0.3/monthly)
- **Check**: `lastModified` uses real dates (product updated_at, not hardcoded)
- **Benchmark**: Google recommends sitemaps under 50,000 URLs and 50MB uncompressed

#### 1.2 Robots.txt Rules

- Read `app/robots.ts`
- **Check**: Disallows sensitive paths: /api/, /auth/, /checkout/, /admin/
- **Check**: Does NOT disallow public pages (/shop/, /[locale]/, etc.)
- **Check**: References sitemap URL correctly (absolute URL with domain)
- **Check**: User-agent is set to `*` (applies to all crawlers)
- **Severity**: CRITICAL if /api/ or /auth/ endpoints are crawlable

#### 1.3 Sitemap Discoverability

- **Check**: Sitemap is referenced in robots.txt
- **Check**: Sitemap URL is accessible at `/sitemap.xml`
- **Check**: Sitemap follows XML schema (xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

### Phase 2: Page Metadata (8 checks)

#### 2.1 Metadata Coverage

- Glob for `generateMetadata` or `metadata` exports across all page files in `app/[locale]/`
- **Check**: All 39 pages export `generateMetadata` or a static `metadata` object
- **Check**: The 7 MISSING pages are identified: `offline`, `pricing`, `wishlist` (2), `editor`, `auth/callback`, `notifications`
- **Severity**: FAIL for user-facing pages missing metadata; WARN for internal/utility pages

#### 2.2 Title & Description Quality

- Read metadata from at least 10 representative pages
- **Check**: Titles are unique per page (not all "SKAPARA")
- **Check**: Titles are 50-60 characters (Google truncates at ~60)
- **Check**: Descriptions are 150-160 characters
- **Check**: Titles include primary keyword + brand name pattern ("Product Name | SKAPARA")
- **Check**: Dynamic product pages use actual product names in title

#### 2.3 Metadata Translations

- **Check**: `generateMetadata` uses `getTranslations` for localized titles/descriptions
- **Check**: Metadata is different per locale (not all English)
- **Check**: Keywords/descriptions are culturally appropriate per locale
- **Severity**: FAIL if metadata is hardcoded English on localized pages

#### 2.4 Root Layout Metadata

- Read `app/[locale]/layout.tsx` lines 18-59
- **Check**: `metadataBase` is set (required for OG image resolution)
- **Check**: Default title template includes brand name
- **Check**: Default description is meaningful
- **Check**: `applicationName` is set
- **Check**: `icons` are configured (favicon, apple-touch-icon)

### Phase 3: Structured Data / JSON-LD (8 checks)

#### 3.1 Organization Schema

- Search for `Organization` JSON-LD in landing page files
- **Check**: Schema includes `name`, `url`, `logo`, `sameAs` (social links)
- **Check**: `logo` URL is absolute and accessible
- **Check**: Validates against Google's Rich Results Test schema
- **Benchmark**: Google requires Organization for knowledge panel eligibility

#### 3.2 WebSite Schema

- Search for `WebSite` JSON-LD
- **Check**: Schema includes `name`, `url`, `potentialAction` (SearchAction)
- **Check**: SearchAction target URL pattern is correct for site search
- **Check**: Schema is on the homepage/root layout only (not every page)

#### 3.3 Product Schema

- Search for `Product` JSON-LD in shop/product pages
- **Check**: Schema includes required fields: `name`, `description`, `image`, `offers`
- **Check**: `offers` includes `price`, `priceCurrency`, `availability`, `url`
- **Check**: `priceCurrency` matches locale (EUR for all — EU-only store)
- **Check**: `availability` uses schema.org values (InStock, OutOfStock, PreOrder)
- **Check**: `image` is absolute URL
- **Check**: `brand` includes `@type: Brand` with `name: SKAPARA`
- **Severity**: FAIL if Product schema is missing on product detail pages (critical for Google Shopping)

#### 3.4 BreadcrumbList Schema

- Search for `BreadcrumbList` JSON-LD
- **Check**: Schema includes correct hierarchy (Home > Category > Product)
- **Check**: Each item has `name` and `item` (URL)
- **Check**: Position numbering starts at 1 and is sequential

#### 3.5 BlogPosting Schema

- Search for `BlogPosting` or `Article` JSON-LD
- **Check**: Includes `headline`, `datePublished`, `author`, `image`
- **Check**: `datePublished` is ISO 8601 format
- **Check**: `author` references Organization or Person

#### 3.6 JSON-LD Injection Method

- **Check**: JSON-LD is injected via `<script type="application/ld+json">` in page components
- **Check**: JSON is properly escaped (no XSS via product names in JSON-LD)
- **Check**: Multiple schemas on same page use `@graph` or separate script tags
- **Severity**: CRITICAL if user-supplied data in JSON-LD is unescaped

#### 3.7 Structured Data Validation

- **Check**: No duplicate schemas on same page (e.g., two Product schemas)
- **Check**: No conflicting data between metadata and JSON-LD (title vs name)
- **Check**: All URLs in schemas are absolute (not relative paths)

#### 3.8 Missing Schema Opportunities

- **Check**: FAQ schema on FAQ/help pages (if they exist)
- **Check**: Review/Rating schema (if product reviews exist)
- **Check**: CollectionPage schema on category pages
- **Benchmark**: Competitors with rich results get 20-30% higher CTR

### Phase 4: Open Graph & Social (6 checks)

#### 4.1 OG Tags Coverage

- Search for `openGraph` in metadata exports
- **Check**: All public pages have `og:title`, `og:description`, `og:image`, `og:url`, `og:type`
- **Check**: `og:type` is correct per page (website for home, product for product pages, article for blog)
- **Check**: `og:image` dimensions are 1200x630 (Facebook recommended)
- **Check**: `og:url` matches canonical URL

#### 4.2 Twitter Card Tags

- Search for `twitter` in metadata exports
- **Check**: `twitter:card` is `summary_large_image` for pages with images
- **Check**: `twitter:title` and `twitter:description` are set
- **Check**: `twitter:image` is set and accessible
- **Check**: `twitter:site` handle is set (if SKAPARA has Twitter)

#### 4.3 Dynamic OG Images

- **Check**: Product pages generate dynamic OG images with product photo + branding
- **Check**: Category pages have category-specific OG images
- **Check**: Fallback OG image exists for pages without specific images
- **Benchmark**: Dynamic OG images increase social sharing CTR by 2-3x

#### 4.4 OG Image Accessibility

- **Check**: OG images are publicly accessible (no auth required)
- **Check**: OG images load within 2 seconds
- **Check**: OG image URLs do not contain query parameters that expire (signed URLs)

#### 4.5 Social Preview Testing

- **Check**: Landing page would render correctly in Facebook/Twitter/LinkedIn card preview
- **Check**: Product pages would show product image, title, price in social previews
- **Check**: No truncation of critical information in social cards

#### 4.6 WhatsApp/Telegram Preview

- **Check**: Pages include og:image for WhatsApp link previews
- **Check**: og:description is concise enough for messaging app previews (under 100 chars ideal)

### Phase 5: Canonical URLs & hreflang (6 checks)

#### 5.1 Canonical URL Coverage

- Search for `canonical` in metadata exports and layout files
- **Check**: All pages have canonical URLs (either explicit or via metadataBase)
- **Check**: Canonical URLs use the preferred domain (with or without www — consistent)
- **Check**: Canonical URLs include locale prefix (/en/, /es/, /de/)
- **Check**: No pages have self-referencing canonical loops
- **Check**: Paginated pages reference the canonical first page (if pagination exists)

#### 5.2 hreflang Implementation

- Read `app/[locale]/layout.tsx` — alternates.languages section
- **Check**: Every page has hreflang tags for all 3 locales (en, es, de)
- **Check**: `x-default` hreflang points to English version
- **Check**: hreflang URLs are absolute
- **Check**: hreflang is reciprocal (en page links to es/de, es page links to en/de, etc.)
- **Severity**: FAIL if hreflang is missing — causes duplicate content penalties for multilingual sites

#### 5.3 Locale URL Structure

- **Check**: URL prefix pattern is consistent: `/en/shop`, `/es/shop`, `/de/shop`
- **Check**: No mixed patterns (some with prefix, some without)
- **Check**: Default locale (en) still uses prefix (per `prefix: 'always'` config)

#### 5.4 Redirect Rules

- Read `middleware.ts` for locale redirects
- **Check**: Root `/` redirects to `/en/` (or detected locale)
- **Check**: Missing locale prefix redirects to default locale version
- **Check**: No redirect chains (A->B->C, should be A->C)
- **Check**: Redirects use 301 (permanent) not 302 (temporary) for SEO

#### 5.5 Duplicate Content Prevention

- **Check**: Only one URL resolves to each page (no /shop and /en/shop both working without redirect)
- **Check**: Trailing slash behavior is consistent (all with or all without)
- **Check**: Query parameters don't create duplicate pages (sort, filter params)

#### 5.6 Language Selector SEO

- **Check**: Language switcher links use proper hreflang-compatible URLs
- **Check**: Language switcher is not JavaScript-only (search engines can discover alternate versions)

### Phase 6: Image SEO & Alt Text (5 checks)

#### 6.1 Product Image Alt Text

- Search for `<img` and `<Image` tags in product-related components
- **Check**: All product images have descriptive alt text (product name + color/variant)
- **Check**: Alt text is NOT just "product image" or empty for meaningful images
- **Check**: Decorative images use `alt=""` (empty alt, not missing alt)
- **Severity**: FAIL if product images lack alt text — impacts Google Image Search ranking

#### 6.2 Next.js Image Optimization

- Search for `next/image` usage vs raw `<img>` tags
- **Check**: Product images use `<Image>` component (automatic WebP, lazy loading, srcset)
- **Check**: Image `sizes` prop is set correctly for responsive images
- **Check**: `priority` prop is used for above-the-fold images (LCP optimization)
- **Check**: No raw `<img>` tags for content images (only acceptable for SVG icons)

#### 6.3 Image File Names

- **Check**: Product image URLs contain descriptive slugs (not UUIDs or hashes only)
- **Check**: Image CDN preserves or rewrites to SEO-friendly filenames
- **Benchmark**: Google Images uses filename as ranking signal

#### 6.4 Lazy Loading

- **Check**: Below-the-fold images have `loading="lazy"` (default in next/image)
- **Check**: Hero/banner images do NOT have lazy loading (they need priority loading)
- **Check**: Placeholder blur or skeleton shown during image load

#### 6.5 Image Sitemap

- **Check**: Product images are included in sitemap (image:image extension)
- **Check**: Image captions/titles are included where available
- **Benchmark**: Image sitemap helps Google discover images faster

### Phase 7: Technical SEO (5 checks)

#### 7.1 Page Load Performance

- **Check**: Core Web Vitals friendly: no render-blocking scripts in head
- **Check**: Critical CSS is inlined or loaded with priority
- **Check**: Third-party scripts are deferred or loaded async
- **Benchmark**: LCP < 2.5s, FID < 100ms, CLS < 0.1

#### 7.2 Semantic HTML

- Search for `<main>`, `<nav>`, `<header>`, `<footer>`, `<article>`, `<section>` usage
- **Check**: Pages use semantic HTML elements (not just div soup)
- **Check**: Only one `<h1>` per page
- **Check**: Heading hierarchy is correct (h1 > h2 > h3, no skipping levels)

#### 7.3 Internal Linking

- **Check**: Navigation includes links to key category pages
- **Check**: Product pages link to related products
- **Check**: Breadcrumbs provide upward navigation links
- **Check**: Footer contains links to legal/policy pages

#### 7.4 404 & Error Pages

- **Check**: Custom 404 page exists with helpful navigation
- **Check**: 404 page returns proper HTTP 404 status code
- **Check**: Error pages are localized
- **Check**: Soft 404s are avoided (don't return 200 for missing content)

#### 7.5 URL Structure

- **Check**: URLs are clean and descriptive (`/en/shop/category/product-slug` not `/en/shop?id=123`)
- **Check**: URLs use hyphens (not underscores)
- **Check**: URLs are lowercase
- **Check**: No special characters in URLs (encoded properly if needed)

---

## Output Format

Generate `AUDIT_SEO_STRUCTURED_DATA_[DATE].md` at the workspace root with the following structure:

```markdown
# SEO & Structured Data Audit — [DATE]

## Executive Summary

[2-3 paragraph overview: overall SEO health, structured data coverage, critical gaps affecting search visibility. State readiness for Google indexing and rich results.]

## Scorecard

| Category | Checks | Pass | Warn | Fail | Critical | Score |
|---|---|---|---|---|---|---|
| Sitemap & Robots | 6 | X | X | X | X | X% |
| Page Metadata | 8 | X | X | X | X | X% |
| Structured Data / JSON-LD | 8 | X | X | X | X | X% |
| Open Graph & Social | 6 | X | X | X | X | X% |
| Canonical URLs & hreflang | 6 | X | X | X | X | X% |
| Image SEO & Alt Text | 5 | X | X | X | X | X% |
| Technical SEO | 5 | X | X | X | X | X% |
| **TOTAL** | **44** | **X** | **X** | **X** | **X** | **X%** |

## Findings

| ID | Severity | Category | Finding | File:Line | Recommendation |
|---|---|---|---|---|---|
| SEO-001 | CRITICAL | Structured Data | [description] | `src/app/[locale]/(app)/shop/[slug]/page.tsx:42` | [fix] |
| SEO-002 | FAIL | Metadata | [description] | `src/app/[locale]/(app)/wishlist/page.tsx:1` | [fix] |
| SEO-003 | WARN | Image SEO | [description] | `src/components/storefront/ProductCard.tsx:88` | [fix] |
| ... | ... | ... | ... | ... | ... |

## Critical Blockers (Must Fix Before Production)

1. [SEO-001] — [description and fix]
2. ...

## High Priority (Fix Within Sprint)

1. [SEO-0XX] — [description]
2. ...

## Warnings (Fix Before V2)

1. [SEO-0XX] — [description]
2. ...

## Priority Actions

1. Add `generateMetadata` to the 7 pages currently missing it
2. [Next highest priority]
3. ...
```

## Severity Levels

- **CRITICAL**: Missing structured data on product pages (blocks Google Shopping), robots blocking public pages, XSS in JSON-LD, broken canonical causing deindexing. Blocks search visibility.
- **FAIL**: Missing metadata on user-facing pages, broken hreflang, missing OG tags on shareable pages. Must fix before launch.
- **WARN**: Suboptimal title length, missing image alt text on non-product images, missing schema opportunities. Fix for V2.
- **PASS**: Meets SEO best practices and search engine requirements.

## Notes

- Always verify findings against actual code (read the file, cite the line number). Never report speculative issues.
- Test JSON-LD by reading the actual script tags rendered in pages, not just the data objects.
- For each CRITICAL or FAIL finding, include a concrete code-level recommendation (not just "fix this").
- Use Google's official documentation as the standard for structured data requirements.
- The 7 pages missing metadata are known — confirm they are still missing and note any that have been fixed.
