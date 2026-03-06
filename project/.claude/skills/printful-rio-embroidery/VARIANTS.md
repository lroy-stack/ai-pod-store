# Variants — Atlantis RIO Embroidery (Catalog 519)

## Colores Disponibles (EU Latvia)

All 8 colors available for embroidery. EU fulfillment from Latvia. Sustainable material: 50% recycled polyester, 50% acrylic (GRS + OEKO-TEX certified).

| Color | Slug | Thread Recommendation |
|---|---|---|
| **Black** | `black` | White/light threads |
| **Olive** | `olive` | White/light threads |
| **Navy** | `navy` | White/light threads |
| **Mustard** | `mustard` | Black/dark or white threads |
| **Light Grey Melange** | `light-grey-melange` | Black/dark threads |
| **Beige** | `beige` | Black/dark threads |
| **Light Blue** | `light-blue` | Black/dark or navy threads |
| **Acid Green** | `acid-green` | Black/dark threads |

---

## Variant IDs (One Size per Color)

| Color | variant_id | Base Cost (EUR) |
|---|---|---|
| Black | — | ~16.95 |
| Olive | — | ~16.95 |
| Navy | — | ~16.95 |
| Mustard | — | ~16.95 |
| Light Grey Melange | — | ~16.95 |
| Beige | — | ~16.95 |
| Light Blue | — | ~16.95 |
| Acid Green | — | ~16.95 |

**NOTE:** Variant IDs must be fetched from Printful API at product creation time:
```javascript
// GET /v2/catalog-products/519/catalog-variants
const response = await pf('/v2/catalog-products/519/catalog-variants');
// Map color_name -> variant_id from response
```

---

## Variant IDs (lookup rapido — fetch at runtime)

```javascript
// Variant IDs must be resolved from Printful API
// GET https://api.printful.com/v2/catalog-products/519/catalog-variants
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
const PRICES = { 'One size': '34.99' };

// With unlimited_color — consider higher price
const PRICES_UNLIMITED = { 'One size': '39.99' };
```

### Pricing — Standard (6 or fewer thread colors)

| Color | Retail | Cost (~16.95 + 2.95 emb) | Margin |
|---|---|---|---|
| All colors | €34.99 | ~19.90 EUR | ~43.1% |

### Pricing — Unlimited Color (+3.25 EUR)

| Color | Retail | Cost (~16.95 + 2.95 + 3.25) | Margin |
|---|---|---|---|
| All colors (at €34.99) | €34.99 | ~23.15 EUR | ~33.8% |
| All colors (at €39.99) | €39.99 | ~23.15 EUR | ~42.1% |

---

## Placement Summary

| Placement | Printfile | Canvas | Physical | Price |
|---|---|---|---|---|
| embroidery_front | PF#74 | 1500x525 @300dpi | 5.00"x1.75" | +2.95 EUR |

**CRITICAL: This is the ONLY placement available. No back, left, or right placements exist for this product.**

---

## Design Constraints for Beanie Front

- **Canvas**: 1500x525px @300dpi = 5.00"x1.75" physical
- **Orientation**: Wide and short — horizontal designs work best
- **S mark integration**: Must be part of the front design (no separate back/side placement)
- **Cuff area**: Design sits on the folded cuff — keep away from bottom edge
- **Simplicity**: Beanie is small — keep designs bold and simple, avoid fine details
- **No 3D Puff**: Unstructured knit does not support raised 3D puff embroidery
- **Same canvas as AS Colour 1120**: Designs using PF#74 (1500x525) are interchangeable between both beanies

---

## Color Groupings (for product theming)

### Dark palette:
- Black, Olive, Navy

### Earth tones:
- Mustard, Beige, Olive

### Light/Bright palette:
- Light Grey Melange, Light Blue, Acid Green

### Best sellers (recommended initial launch):
- Black, Navy, Beige, Mustard, Light Grey Melange

---

## Comparison with AS Colour 1120 (CAT=809)

| Aspect | Atlantis RIO (CAT=519) | AS Colour 1120 (CAT=809) |
|---|---|---|
| Material | 50% recycled polyester, 50% acrylic | 100% acrylic |
| Certifications | GRS + OEKO-TEX | Standard |
| Construction | Double layer knit, cuffed | Wide ribbed knit, cuffed fisherman |
| Colors | 8 (earth + bright tones) | 8 (classic tones) |
| Base cost | ~16.95 EUR | 14.95 EUR |
| Embroidery price | +2.95 EUR | +2.60 EUR |
| Sustainability | YES (recycled content) | No |
| Canvas | PF#74 (same) | PF#74 (same) |
| Positioning | Eco-premium | Standard |

**Key differentiation**: RIO is the sustainable/eco option — higher price justified by recycled materials and certifications.

---

## GPSR Template

```html
<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p>
<p><strong>Material:</strong> 50% recycled polyester, 50% acrylic</p>
<p><strong>Print technique:</strong> Embroidery</p>
<p><strong>Care:</strong> Spot clean only.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100, GRS (Global Recycled Standard)</p>
```
