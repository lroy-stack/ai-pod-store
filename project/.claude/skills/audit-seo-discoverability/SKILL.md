---
name: Audit SEO Discoverability
description: >
  E-commerce SEO and discoverability audit — meta tags, structured data, sitemap, Core Web
  Vitals, URL structure, image SEO, and crawlability. Use when asked to audit SEO, review
  search visibility, assess organic traffic potential, or check page speed.
---

# Audit SEO Discoverability

Systematic audit of organic search visibility and technical SEO.

## Prerequisites

- Read `frontend/src/app/[locale]/layout.tsx` for global meta tags
- Read `frontend/src/app/[locale]/(landing)/page.tsx` for landing page meta
- Read `frontend/src/app/[locale]/(app)/shop/[slug]/page.tsx` for product meta
- Check for `sitemap.ts`, `robots.ts` in the app directory
- Read `frontend/next.config.ts` for redirects and rewrites

## Workflow

### Phase 1: Technical SEO Foundation

1. **Meta tags per page**:
   - Landing page: unique title, description, og:image?
   - Product pages: dynamic title with product name? Description from product data?
   - Category pages: unique meta per category?
   - Are og:title, og:description, og:image set for social sharing?
   - Is `twitter:card` set?

2. **Structured data (JSON-LD)**:
   - Product pages: `Product` schema with name, price, availability, image?
   - Is `offers` included with price, currency, availability?
   - Is `brand` included?
   - Is `review` / `aggregateRating` included (if reviews exist)?
   - Is there `BreadcrumbList` schema?
   - Is there `Organization` schema on the landing page?

3. **Sitemap**:
   - Does `/sitemap.xml` exist?
   - Does it include all products with lastmod dates?
   - Does it include locale variants (hreflang)?
   - Is it registered in `robots.txt`?
   - Does it auto-update when products are added/removed?

4. **Robots.txt**:
   - Does `/robots.txt` exist?
   - Is it allowing search engines?
   - Are admin paths blocked? (/panel/)
   - Are API routes blocked?
   - Is sitemap URL referenced?

5. **URL structure**:
   - Are product URLs semantic? (`/shop/shadow-tee` vs `/shop/547be69f`)
   - Are URLs consistent across locales?
   - Are there canonical URLs to prevent duplicates?
   - Is there hreflang for multi-language? (en, es, de)

### Phase 2: Content SEO

6. **Product content**:
   - Are product titles unique and descriptive?
   - Are descriptions unique (not template-generated)?
   - Is there sufficient content per product page? (>150 words)
   - Are keywords natural and relevant?

7. **Image SEO**:
   - Do all product images have descriptive alt text?
   - Are image filenames descriptive? (not UUID-based)
   - Are images served in modern formats (WebP/AVIF)?
   - Are images appropriately sized (not oversized)?

8. **Internal linking**:
   - Are products linked from category pages?
   - Are there breadcrumbs?
   - Are there related product links?
   - Is there a logical site hierarchy?

### Phase 3: Performance (Core Web Vitals)

9. **LCP (Largest Contentful Paint)** — target <2.5s:
   - What is the LCP element on the landing page?
   - Is the hero image optimized?
   - Is there font loading delay?
   - Are critical CSS styles inlined?

10. **CLS (Cumulative Layout Shift)** — target <0.1:
    - Do images have width/height attributes?
    - Do ads or dynamic content cause layout shifts?
    - Are fonts loaded without FOUT/FOIT?

11. **INP (Interaction to Next Paint)** — target <200ms:
    - Are click handlers responsive?
    - Is there heavy JS blocking interaction?
    - Are filters/search responsive?

### Phase 4: Crawlability & Indexation

12. **Rendering**:
    - Are pages SSR or CSR? (SSR is critical for SEO)
    - Can Googlebot see the full content?
    - Is JavaScript-rendered content indexable?

13. **Internationalization SEO**:
    - Are hreflang tags correct for all 3 locales?
    - Is the default locale properly set?
    - Are locale URLs clean? (`/en/shop` vs `/shop?lang=en`)

## Output Format

Generate `AUDIT_SEO_[DATE].md` at workspace root with:

```markdown
# SEO & Discoverability Audit — [DATE]

## Technical SEO Scorecard
| Check | Status | Impact | Notes |
|---|---|---|---|

## Content SEO
| Page Type | Meta Tags | Structured Data | Content Quality |
|---|---|---|---|

## Core Web Vitals (estimated)
| Metric | Target | Estimated | Status |
|---|---|---|---|

## Critical Gaps
[Issues that prevent indexing or ranking]

## Recommendations
[Prioritized by organic traffic impact]
```
