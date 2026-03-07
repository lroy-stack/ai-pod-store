---
name: Audit Product Experience
description: >
  E-commerce product experience audit — images, descriptions, sizing, reviews, social proof,
  cross-sell, and stock urgency. Use when asked to audit product pages, review product
  presentation, assess product quality, or improve product conversion.
---

# Audit Product Experience

Systematic audit of how products are presented and whether they drive purchase decisions.

## Prerequisites

- Read `frontend/src/components/storefront/ProductCard.tsx` for grid cards
- Read `frontend/src/app/[locale]/(app)/shop/[slug]/page.tsx` for product detail
- Read `frontend/src/components/storefront/` for all product-related components
- Check actual product data in Supabase `products` and `product_variants` tables

## Workflow

### Phase 1: Product Images

1. **Image quality**:
   - Are images mockups or real photos? (POD stores typically use mockups)
   - Are mockups high quality and realistic?
   - How many images per product? (should be ≥3: front, back, detail/lifestyle)
   - Is there a zoom/lightbox on product detail page?

2. **Color variant images**:
   - When user selects a color, does the image change?
   - Are color swatches showing actual color or just named?
   - Is the `colorImages` mapping working? (product_variants.image_url)
   - Do all variants have images or are some showing fallback?

3. **Image performance**:
   - Are images using `next/image` with proper width/height?
   - Are images lazy-loaded below the fold?
   - What format? (WebP/AVIF vs PNG/JPG)
   - Are thumbnails properly sized (not loading full-res for grid)?

### Phase 2: Product Information

4. **Descriptions**:
   - Are descriptions persuasive or generic/AI-generated-feeling?
   - Do they highlight benefits (comfortable, sustainable) not just features?
   - Are descriptions translated for all 3 locales (en/es/de)?
   - Is there a consistent brand voice across products?

5. **Pricing presentation**:
   - Is the price clearly visible and well-formatted?
   - Is currency correct for locale? (EUR for EU store)
   - Are there comparison/original prices for perceived value?
   - Is VAT included/noted? (EU requirement)

6. **Size & fit information**:
   - Is there a size guide on every product that has sizes?
   - Does the size guide show measurements (cm/inches)?
   - Is there EU/US/UK size conversion?
   - Is there a "model is wearing size X, height Y" note?
   - Is there a size recommendation feature?

7. **Material & care**:
   - Are materials listed? (cotton %, polyester %, etc.)
   - Are care instructions shown? (wash, dry, iron)
   - Is the print technique explained? (DTG, embroidery, DTFilm)
   - Is there a sustainability angle? (organic, recycled)

### Phase 3: Social Proof & Trust

8. **Reviews & ratings**:
   - Is there a review system? Can users leave reviews?
   - Are star ratings shown on product cards and detail pages?
   - Is there verified purchase badge on reviews?
   - What happens with zero reviews? (empty state)

9. **Social proof elements**:
   - "X people viewed this" or "X sold"?
   - Best seller badges?
   - New arrival badges?
   - Customer photos in reviews?

10. **Stock & urgency**:
    - Is availability shown? (in stock / low stock / out of stock)
    - Is there urgency messaging? ("Only X left", "Selling fast")
    - Are out-of-stock variants properly disabled?
    - Is there "notify me when back in stock"?

### Phase 4: Cross-Sell & Discovery

11. **Related products**:
    - Are there "You may also like" recommendations?
    - Are there "Complete the look" suggestions?
    - Are recommendations relevant (same category, complementary)?
    - Where are they placed? (below product, sidebar, cart)

12. **Category navigation**:
    - Can users browse by category from product page?
    - Are breadcrumbs shown?
    - Is there a "back to shop" easy path?

13. **Search**:
    - Does search find products by name, description, category?
    - Is there search autocomplete/suggestions?
    - What happens with zero results? (suggestions, popular products)

## Output Format

Generate `AUDIT_PRODUCT_EXPERIENCE_[DATE].md` at workspace root with:

```markdown
# Product Experience Audit — [DATE]

## Product Presentation Score
| Aspect | Score (1-5) | Status | Notes |
|---|---|---|---|

## Critical Gaps
[Missing elements that hurt conversion]

## Quick Wins
[Easy improvements with high impact]

## Recommendations
[Prioritized improvements]
```
