# Variants — SOL'S 03568 Eco Raglan Hoodie DTG (Catalog 543)

## Colors Available (EU Latvia)

6 colors confirmed via API. Mix of dark and light — design contrast varies.

| Color | Hex | Slug | Tone | Design Notes |
|---|---|---|---|---|
| **Black** | `#000000` | `black` | Dark | White/ghost text compatible |
| **Bottle Green** | `#004225` | `bottle-green` | Dark | White/ghost text compatible |
| **Burgundy** | `#800020` | `burgundy` | Dark | White/ghost text compatible |
| **Burnt Orange** | `#CC5500` | `burnt-orange` | Medium | Warm medium tone — test contrast with both light/dark designs |
| **Charcoal Melange** | `#4A4A4A` | `charcoal-melange` | Dark | Dark heathered — white/light designs preferred |
| **White** | `#FFFFFF` | `white` | Light | Use dark/black designs only |

---

## Sizes

| Size | Notes |
|---|---|
| XS | Base tier |
| S | Base tier |
| M | Base tier |
| L | Base tier |
| XL | Mid tier |
| 2XL | Upper tier |
| 3XL | Top tier |

---

## Variant IDs por Color x Talla

> **NOTE:** Variant IDs must be queried from the Printful API for catalog 543.
> Use: `GET https://api.printful.com/v2/catalog-products/543/catalog-variants`

### Black

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 35.20 |
| S | TBD | 35.20 |
| M | TBD | 35.20 |
| L | TBD | 35.20 |
| XL | TBD | 37.50 |
| 2XL | TBD | 39.95 |
| 3XL | TBD | 42.25 |

### Bottle Green

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 35.20 |
| S | TBD | 35.20 |
| M | TBD | 35.20 |
| L | TBD | 35.20 |
| XL | TBD | 37.50 |
| 2XL | TBD | 39.95 |
| 3XL | TBD | 42.25 |

### Burgundy

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 35.20 |
| S | TBD | 35.20 |
| M | TBD | 35.20 |
| L | TBD | 35.20 |
| XL | TBD | 37.50 |
| 2XL | TBD | 39.95 |
| 3XL | TBD | 42.25 |

### Burnt Orange

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 35.20 |
| S | TBD | 35.20 |
| M | TBD | 35.20 |
| L | TBD | 35.20 |
| XL | TBD | 37.50 |
| 2XL | TBD | 39.95 |
| 3XL | TBD | 42.25 |

### Charcoal Melange

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 35.20 |
| S | TBD | 35.20 |
| M | TBD | 35.20 |
| L | TBD | 35.20 |
| XL | TBD | 37.50 |
| 2XL | TBD | 39.95 |
| 3XL | TBD | 42.25 |

### White

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 35.20 |
| S | TBD | 35.20 |
| M | TBD | 35.20 |
| L | TBD | 35.20 |
| XL | TBD | 37.50 |
| 2XL | TBD | 39.95 |
| 3XL | TBD | 42.25 |

---

## Variant ID Lookup Script

```bash
curl -s "https://api.printful.com/v2/catalog-products/543/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

```javascript
const VARIANTS = {
  Black: { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD },
  'Bottle Green': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD },
  Burgundy: { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD },
  'Burnt Orange': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD },
  'Charcoal Melange': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD },
  White: { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD },
};
```

---

## Retail Pricing (EUR)

### With 3 placements (front + back + sleeve_left):

```javascript
const PRICES = {
  XS: '69.99', S: '69.99', M: '69.99', L: '69.99',
  XL: '74.99', '2XL': '79.99', '3XL': '84.99',
};
```

| Talla | Retail | Cost (base + 3x 5.95 = 17.85) | Margin |
|---|---|---|---|
| XS | 69.99 | 53.05 | 24.2% |
| S | 69.99 | 53.05 | 24.2% |
| M | 69.99 | 53.05 | 24.2% |
| L | 69.99 | 53.05 | 24.2% |
| XL | 74.99 | 55.35 | 26.2% |
| 2XL | 79.99 | 57.80 | 27.7% |
| 3XL | 84.99 | 60.10 | 29.3% |

### Premium pricing (>35% margin target):

```javascript
const PRICES_PREMIUM = {
  XS: '84.99', S: '84.99', M: '84.99', L: '84.99',
  XL: '89.99', '2XL': '94.99', '3XL': '99.99',
};
```

| Talla | Retail | Cost | Margin |
|---|---|---|---|
| XS-L | 84.99 | 53.05 | 37.6% |
| XL | 89.99 | 55.35 | 38.5% |
| 2XL | 94.99 | 57.80 | 39.2% |
| 3XL | 99.99 | 60.10 | 39.9% |

> **NOTE:** Standard pricing falls below 35% margin. Use premium pricing or adjust margin fixer threshold.

---

## Printfiles Summary

| Printfile | Canvas | DPI | Placement |
|---|---|---|---|
| PF#1 | 1800x2400 | 150 | front |
| PF#134 | 1800x1800 | 150 | back (SQUARE) |
| PF#147 | 450x1800 | 150 | sleeve_left, sleeve_right |

---

## Total Variants

- 6 colors x 7 sizes = **42 variants** (confirmed via API)
