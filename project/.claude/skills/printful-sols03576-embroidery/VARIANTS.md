# Variants — SOL'S 03576 Kids Eco Hoodie Embroidery (Catalog 483)

## Colors Available (EU Latvia)

| Color | Hex | Slug | Thread Recommendation |
|---|---|---|---|
| **Black** | `#000000` | `black` | White or gradient S mark |
| **Burnt Orange** | `#CC5500` | `burnt-orange` | Black or dark thread |
| **French Navy** | `#1E2D53` | `french-navy` | White or gradient S mark |

---

## Sizes (Kids)

| Size | Age Range |
|---|---|
| 4Y | ~4 years |
| 6Y | ~6 years |
| 8Y | ~8 years |
| 10Y | ~10 years |
| 12Y | ~12 years |

---

## Variant IDs por Color x Talla

> **NOTE:** Variant IDs must be queried from the Printful API for catalog 483.
> The same variant IDs are used for both DTG and Embroidery — the difference is in the file types.
> Use: `GET https://api.printful.com/v2/catalog-products/483/catalog-variants`

### Black

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| 4Y | TBD | 24.95 |
| 6Y | TBD | 24.95 |
| 8Y | TBD | 24.95 |
| 10Y | TBD | 26.65 |
| 12Y | TBD | 26.65 |

### Burnt Orange

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| 4Y | TBD | 24.95 |
| 6Y | TBD | 24.95 |
| 8Y | TBD | 24.95 |
| 10Y | TBD | 26.65 |
| 12Y | TBD | 26.65 |

### French Navy

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| 4Y | TBD | 24.95 |
| 6Y | TBD | 24.95 |
| 8Y | TBD | 24.95 |
| 10Y | TBD | 26.65 |
| 12Y | TBD | 26.65 |

---

## Variant ID Lookup Script

```bash
curl -s "https://api.printful.com/v2/catalog-products/483/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

```javascript
const VARIANTS = {
  Black: {
    '4Y': TBD, '6Y': TBD, '8Y': TBD, '10Y': TBD, '12Y': TBD,
  },
  'Burnt Orange': {
    '4Y': TBD, '6Y': TBD, '8Y': TBD, '10Y': TBD, '12Y': TBD,
  },
  'French Navy': {
    '4Y': TBD, '6Y': TBD, '8Y': TBD, '10Y': TBD, '12Y': TBD,
  },
};
```

---

## Embroidery Placements (MUTUALLY EXCLUSIVE)

| Placement | Cost | Notes |
|---|---|---|
| `embroidery_chest_center` | +2.60 EUR | Centered — larger design area |
| `embroidery_chest_left` | +2.60 EUR | Left chest — small logo/mark |

**ONLY ONE can be used per product.** They cannot coexist.

---

## Retail Pricing (EUR)

### With 1 embroidery placement (chest_left — RECOMMENDED):

```javascript
const PRICES = {
  '4Y': '39.99', '6Y': '39.99', '8Y': '39.99', '10Y': '42.99', '12Y': '42.99',
};
```

| Talla | Retail | Cost (base + 1x emb 2.60) | Margin |
|---|---|---|---|
| 4Y | 39.99 | 27.55 | 31.1% |
| 6Y | 39.99 | 27.55 | 31.1% |
| 8Y | 39.99 | 27.55 | 31.1% |
| 10Y | 42.99 | 29.25 | 32.0% |
| 12Y | 42.99 | 29.25 | 32.0% |

### With unlimited_color (+3.25 per chest placement):

| Talla | Retail | Cost | Margin |
|---|---|---|---|
| 4Y-8Y | 42.99 | 30.80 | 28.3% |
| 10Y-12Y | 44.99 | 32.50 | 27.8% |

> **NOTE:** Margins hover around 30-32% — close to but below the 35% threshold. May need margin fixer adjustment for kids embroidery products.

---

## Thread Color Recommendations by Garment Color

| Garment | Primary Thread | Accent Thread | Notes |
|---|---|---|---|
| Black | White (#FFFFFF) | Purple (#6B5294) | Classic SKAPARA combo |
| Burnt Orange | Black (#000000) | White (#FFFFFF) | High contrast needed |
| French Navy | White (#FFFFFF) | Gold (#FFD700) | Premium nautical feel |

---

## Total Variants

- 3 colors x 5 sizes = **15 variants**
