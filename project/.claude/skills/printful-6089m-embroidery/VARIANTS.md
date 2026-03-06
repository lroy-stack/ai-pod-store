# Variants — Yupoong 6089M Embroidery (Catalog 99)

## Colores Disponibles (EU Latvia) — API-Verified 2026-03-04

18 colors, 21 variants available for embroidery. EU fulfillment from Latvia.

| Color | Type | Thread Recommendation |
|---|---|---|
| **Black** | Solid dark | White/light threads |
| **Black/Neon Pink** | Two-tone | White or pink threads |
| **Black/Red** | Two-tone | White or red threads |
| **Black/Silver** | Two-tone | White threads |
| **Black/Teal** | Two-tone | White or teal threads |
| **Dark Grey** | Solid dark | White/light threads |
| **Dark Navy** | Solid dark | White/light threads |
| **Green Camo** | Pattern | White/light threads |
| **Heather Grey** | Solid light | Black/dark threads |
| **Heather/Black** | Two-tone | White or dark threads |
| **Maroon** | Solid dark | White/gold threads |
| **Natural/Black** | Two-tone | Black/dark threads |
| **Navy** | Solid dark | White/light threads |
| **Red** | Solid medium | White or black threads |
| **Royal Blue** | Solid medium | White threads |
| **Silver** | Solid light | Black/dark threads |
| **Spruce** | Solid dark | White/light threads |
| **White** | Solid light | Black/dark threads |

**Material note:** All colors are 80% acrylic / 20% wool EXCEPT Green Camo which is 60% cotton / 40% polyester.

**Discontinued colors (no longer in API as of 2026-03-04):** Heather Grey/Navy, Heather Grey/Red, Navy/Red. These two-tone combos were in the original catalog but are not returned by the Printful API.

---

## Variant IDs (18 Colors, 21 Variants)

| Color | variant_id | Base Cost (EUR) |
|---|---|---|
| Black | — | 12.49-14.75 |
| Black/Neon Pink | — | 12.49-14.75 |
| Black/Red | — | 12.49-14.75 |
| Black/Silver | — | 12.49-14.75 |
| Black/Teal | — | 12.49-14.75 |
| Dark Grey | — | 12.49-14.75 |
| Dark Navy | — | 12.49-14.75 |
| Green Camo | — | 12.49-14.75 |
| Heather Grey | — | 12.49-14.75 |
| Heather/Black | — | 12.49-14.75 |
| Maroon | — | 12.49-14.75 |
| Natural/Black | — | 12.49-14.75 |
| Navy | — | 12.49-14.75 |
| Red | — | 12.49-14.75 |
| Royal Blue | — | 12.49-14.75 |
| Silver | — | 12.49-14.75 |
| Spruce | — | 12.49-14.75 |
| White | — | 12.49-14.75 |

**NOTE:** 18 colors produce 21 variants (some colors may have multiple variants for different specs). Variant IDs must be fetched from Printful API at product creation time:
```javascript
// GET /v2/catalog-products/99/catalog-variants
const response = await pf('/v2/catalog-products/99/catalog-variants');
// Map color_name -> variant_id from response
// Expect 21 variants across 18 colors
```

---

## Variant IDs (lookup rapido — fetch at runtime)

```javascript
// Variant IDs must be resolved from Printful API
// GET https://api.printful.com/v2/catalog-products/99/catalog-variants
// Then build map:
const VARIANTS = {};
for (const v of apiResponse.data) {
  if (!VARIANTS[v.color]) VARIANTS[v.color] = {};
  VARIANTS[v.color][v.size || 'One size'] = v.id;
}
// Expected: 18 color entries, 21 total variants
```

---

## Retail Pricing (EUR)

```javascript
// 1 placement (front only)
const PRICES_1P = { 'One size': '29.99' };

// 2 placements (front + back)
const PRICES_2P = { 'One size': '34.99' };

// 4 placements (front + back + sides)
const PRICES_4P = { 'One size': '39.99' };
```

### Pricing with 2 placements (front + back) — Recommended

| Config | Retail | Cost (base ~13.62 + 2x emb 5.90) | Margin |
|---|---|---|---|
| All colors | €34.99 | ~19.52 EUR | ~44.2% |

### Additional Costs

| Option | Cost | Notes |
|---|---|---|
| Extra placement | +2.95 EUR each | Back, left, right |
| Unlimited color | +3.25 EUR per placement | CMYK polyester thread |
| 3D Puff | +1.50 EUR | Front placement — works well on structured cap |

---

## Placement Summary

| Placement | Printfile | Canvas | Physical | Price |
|---|---|---|---|---|
| embroidery_front | PF#478 | 1890x765 @300dpi | 6.30"x2.55" | +2.95 EUR |
| embroidery_front_large | PF#478 | 1890x765 @300dpi | 6.30"x2.55" | +2.95 EUR |
| embroidery_back | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |
| embroidery_left | PF#706 | 675x675 @300dpi | 2.25"x2.25" | +2.95 EUR |
| embroidery_right | PF#706 | 675x675 @300dpi | 2.25"x2.25" | +2.95 EUR |

**KEY DIFFERENCE:** Side placements (PF#706) are SQUARE 675x675 — different from other hats that use PF#76 (600x300).

**NOTE**: `embroidery_front` and `embroidery_front_large` share PF#478. Use ONE, not both.

---

## Color Groupings (for selective enablement)

### Recommended initial launch colors (8):
- Black, Dark Navy, Navy, Heather Grey, Red, Royal Blue, Maroon, White

### Two-tone colors (add later):
- Black/Neon Pink, Black/Red, Black/Silver, Black/Teal, Heather/Black, Natural/Black

### Special:
- Green Camo (different material), Dark Grey, Silver, Spruce

---

## GPSR Template

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 80% acrylic, 20% wool</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

**Green Camo variant GPSR:**
```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 60% cotton, 40% polyester</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```
