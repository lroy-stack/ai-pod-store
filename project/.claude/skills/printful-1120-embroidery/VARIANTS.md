# Variants — AS Colour 1120 Embroidery (Catalog 809)

## Colores Disponibles (EU Latvia)

All 8 colors available for embroidery. EU fulfillment from Latvia. Flat pricing — 14.95 EUR base for all colors.

| Color | Slug | Thread Recommendation |
|---|---|---|
| **Athletic Heather** | `athletic-heather` | Black/dark threads |
| **Black** | `black` | White/light threads |
| **Cypress** | `cypress` | White/light threads |
| **Ecru** | `ecru` | Black/dark threads |
| **Gold** | `gold` | Black or white threads |
| **Petrol Blue** | `petrol-blue` | White/light threads |
| **Red** | `red` | White/black threads |
| **Walnut** | `walnut` | White/light threads |

---

## Variant IDs (One Size per Color)

| Color | variant_id | Base Cost (EUR) |
|---|---|---|
| Athletic Heather | — | 14.95 |
| Black | — | 14.95 |
| Cypress | — | 14.95 |
| Ecru | — | 14.95 |
| Gold | — | 14.95 |
| Petrol Blue | — | 14.95 |
| Red | — | 14.95 |
| Walnut | — | 14.95 |

**NOTE:** Variant IDs must be fetched from Printful API at product creation time:
```javascript
// GET /v2/catalog-products/809/catalog-variants
const response = await pf('/v2/catalog-products/809/catalog-variants');
// Map color_name -> variant_id from response
```

---

## Variant IDs (lookup rapido — fetch at runtime)

```javascript
// Variant IDs must be resolved from Printful API
// GET https://api.printful.com/v2/catalog-products/809/catalog-variants
// Then build map:
const VARIANTS = {};
for (const v of apiResponse.data) {
  VARIANTS[v.color] = { 'One size': v.id };
}
// Expected: 8 entries, one per color
```

---

## Retail Pricing (EUR)

```javascript
// 1 placement (front only — the ONLY option for this beanie)
const PRICES = { 'One size': '29.99' };

// With unlimited_color — consider higher price
const PRICES_UNLIMITED = { 'One size': '34.99' };
```

### Pricing — Standard (6 or fewer thread colors)

| Color | Retail | Cost (14.95 + 2.60 emb) | Margin |
|---|---|---|---|
| All colors | €29.99 | 17.55 EUR | 41.5% |

### Pricing — Unlimited Color (+3.25 EUR)

| Color | Retail | Cost (14.95 + 2.60 + 3.25) | Margin |
|---|---|---|---|
| All colors (at €29.99) | €29.99 | 20.80 EUR | 30.6% |
| All colors (at €34.99) | €34.99 | 20.80 EUR | 40.6% |

---

## Placement Summary

| Placement | Printfile | Canvas | Physical | Price |
|---|---|---|---|---|
| embroidery_front | PF#74 | 1500x525 @300dpi | 5.00"x1.75" | +2.60 EUR |

**CRITICAL: This is the ONLY placement available. No back, left, or right placements exist for this product.**

---

## Design Constraints for Beanie Front

- **Canvas**: 1500x525px @300dpi = 5.00"x1.75" physical
- **Orientation**: Wide and short — horizontal designs work best
- **S mark integration**: Must be part of the front design (no separate back/side placement)
- **Cuff area**: Design sits on the folded cuff — keep away from bottom edge
- **Simplicity**: Beanie is small — keep designs bold and simple, avoid fine details
- **No 3D Puff**: Unstructured knit does not support raised 3D puff embroidery

---

## GPSR Template

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 100% acrylic</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```
