# Variants — SOL'S 03576 Kids Eco Hoodie DTG (Catalog 483)

## Colors Available (EU Latvia)

| Color | Hex | Slug | White Text OK? |
|---|---|---|---|
| **Black** | `#000000` | `black` | YES |
| **Burnt Orange** | `#CC5500` | `burnt-orange` | BORDERLINE (L~58) — test contrast |
| **French Navy** | `#1E2D53` | `french-navy` | YES |

---

## Sizes

Kids sizes only:

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

Once retrieved, populate the TBD fields above and update the JS lookup:

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

## Retail Pricing (EUR)

### With 2 placements (front + back):

```javascript
const PRICES = {
  '4Y': '39.99', '6Y': '39.99', '8Y': '39.99', '10Y': '42.99', '12Y': '42.99',
};
```

| Talla | Retail | Cost (base + 2x DTG 10.50) | Margin |
|---|---|---|---|
| 4Y | 39.99 | 35.45 | 11.3% |
| 6Y | 39.99 | 35.45 | 11.3% |
| 8Y | 39.99 | 35.45 | 11.3% |
| 10Y | 42.99 | 37.15 | 13.6% |
| 12Y | 42.99 | 37.15 | 13.6% |

### With 1 placement (front only — RECOMMENDED for better margin):

```javascript
const PRICES_SINGLE = {
  '4Y': '34.99', '6Y': '34.99', '8Y': '34.99', '10Y': '37.99', '12Y': '37.99',
};
```

| Talla | Retail | Cost (base + front 5.25) | Margin |
|---|---|---|---|
| 4Y | 34.99 | 30.20 | 13.7% |
| 6Y | 34.99 | 30.20 | 13.7% |
| 8Y | 34.99 | 30.20 | 13.7% |
| 10Y | 37.99 | 31.90 | 16.0% |
| 12Y | 37.99 | 31.90 | 16.0% |

> **WARNING:** Both pricing tiers fall below the 35% margin threshold. The cron sync margin fixer WILL flag these. Either:
> 1. Raise retail prices significantly (e.g., 44.99/47.99 for 2-placement)
> 2. Use front-only placement and raise prices
> 3. Adjust the margin fixer threshold for kids products

---

## Total Variants

- 3 colors x 5 sizes = **15 variants**
