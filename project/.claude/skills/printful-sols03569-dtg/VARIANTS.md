# Variants — SOL'S 03569 Organic Apron DTG (Catalog 565)

## Colors Available (EU Latvia)

| Color | Hex | Slug | White Text OK? |
|---|---|---|---|
| **Black** | `#000000` | `black` | YES |
| **Navy** | `#1E2D53` | `navy` | YES |
| **Red** | `#CC0000` | `red` | BORDERLINE — test contrast |
| **Rope** | `#C4A77D` | `rope` | NO — use dark ink |

---

## Sizes

| Size | Notes |
|---|---|
| One size | Single size, no variants by size |

---

## Variant IDs por Color

> **NOTE:** Variant IDs must be queried from the Printful API for catalog 565.
> Use: `GET https://api.printful.com/v2/catalog-products/565/catalog-variants`

| Color | variant_id | Base Cost (EUR) |
|---|---|---|
| Black | TBD | 20.95 |
| Navy | TBD | 20.95 |
| Red | TBD | 20.95 |
| Rope | TBD | 20.95 |

---

## Variant ID Lookup Script

```bash
curl -s "https://api.printful.com/v2/catalog-products/565/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

```javascript
const VARIANTS = {
  Black: { 'One size': TBD },
  Navy: { 'One size': TBD },
  Red: { 'One size': TBD },
  Rope: { 'One size': TBD },
};
```

---

## Retail Pricing (EUR)

### Standard (single front placement):

```javascript
const PRICES = {
  'One size': '39.99',
};
```

| Color | Retail | Cost (20.95 + 5.25) | Margin |
|---|---|---|---|
| All | 39.99 | 26.20 | 34.5% |

### Premium pricing (>35% margin):

```javascript
const PRICES_PREMIUM = {
  'One size': '42.99',
};
```

| Color | Retail | Cost | Margin |
|---|---|---|---|
| All | 42.99 | 26.20 | 39.1% |

> **NOTE:** Flat base price across all colors (20.95 EUR). Single placement (+5.25 EUR). Recommend 42.99 retail for safe >35% margin.

---

## Printfiles Summary

| Printfile | Canvas | DPI | Placement |
|---|---|---|---|
| PF#235 | 1800x1800 | 150 | front (SQUARE) |

---

## Total Variants

- 4 colors x 1 size = **4 variants**

Simplest product in the catalog. Minimal variant management.
