# Variants — Beechfield B682 Embroidery (Catalog 532)

## Colores Disponibles (EU Latvia)

All 4 colors available for embroidery. EU fulfillment from Latvia/UK. Flat pricing — 16.95 EUR base for all colors.

| Color | Slug | Thread Recommendation |
|---|---|---|
| **Black** | `black` | White/light threads |
| **Camel** | `camel` | Black/dark threads |
| **Dark Olive** | `dark-olive` | White/light threads |
| **Oxford Navy** | `oxford-navy` | White/light threads |

---

## Variant IDs (One Size per Color)

| Color | variant_id | Base Cost (EUR) |
|---|---|---|
| Black | — | 16.95 |
| Camel | — | 16.95 |
| Dark Olive | — | 16.95 |
| Oxford Navy | — | 16.95 |

**NOTE:** Variant IDs must be fetched from Printful API at product creation time:
```javascript
// GET /v2/catalog-products/532/catalog-variants
const response = await pf('/v2/catalog-products/532/catalog-variants');
// Map color_name -> variant_id from response
```

---

## Variant IDs (lookup rapido — fetch at runtime)

```javascript
// Variant IDs must be resolved from Printful API
// GET https://api.printful.com/v2/catalog-products/532/catalog-variants
// Then build map:
const VARIANTS = {};
for (const v of apiResponse.data) {
  VARIANTS[v.color] = { 'One size': v.id };
}
// Expected: 4 entries, one per color
```

---

## Retail Pricing (EUR)

```javascript
// 1 placement (front only)
const PRICES_1P = { 'One size': '34.99' };

// 2 placements (front + back) — recommended
const PRICES_2P = { 'One size': '34.99' };  // or '39.99' for better margin

// 4 placements (front + back + sides)
const PRICES_4P = { 'One size': '44.99' };
```

### Pricing with 2 placements (front + back) — Recommended

| Color | Retail | Cost (16.95 + 2x emb 5.90) | Margin |
|---|---|---|---|
| Black | €39.99 | 22.85 EUR | 42.9% |
| Camel | €39.99 | 22.85 EUR | 42.9% |
| Dark Olive | €39.99 | 22.85 EUR | 42.9% |
| Oxford Navy | €39.99 | 22.85 EUR | 42.9% |

### Pricing with 1 placement (front only)

| Color | Retail | Cost (16.95 + 2.95) | Margin |
|---|---|---|---|
| All | €34.99 | 19.90 EUR | 43.1% |

### Additional Costs

| Option | Cost | Notes |
|---|---|---|
| Extra placement | +2.95 EUR each | Back, left, right |
| Unlimited color | +3.25 EUR per placement | CMYK polyester thread |

---

## Placement Summary

| Placement | Printfile | Canvas | Physical | Price |
|---|---|---|---|---|
| embroidery_front | PF#78 | 1200x525 @300dpi | 4.00"x1.75" | +2.95 EUR |
| embroidery_back | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |
| embroidery_left | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |
| embroidery_right | PF#76 | 600x300 @300dpi | 2.00"x1.00" | +2.95 EUR |

**NOTE**: No `embroidery_front_large` on this product. Only `embroidery_front` (PF#78).

**KEY DIFFERENCE**: Front canvas PF#78 (1200x525) is smaller than PF#75 (1650x600) used on Otto Cap and PF#478 (1890x765) used on Yupoong.

---

## Material & Premium Positioning

The Beechfield B682 uses premium 100% cotton corduroy — a distinctive material that justifies higher pricing:

- **Corduroy texture**: Visible wale pattern adds tactile and visual interest
- **Cotton twill sweatband**: Comfortable and breathable
- **Unstructured crown**: Relaxed, casual aesthetic — popular in streetwear
- **Curved brim**: Classic dad hat silhouette

**Positioning**: Premium casual headwear. Price 10-15% above standard dad hats.

---

## GPSR Template

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 100% cotton corduroy, cotton twill sweatband</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```
