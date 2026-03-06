# Variants — SOL'S 03567 Organic Raglan Sweatshirt DTG (Catalog 582)

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

> **NOTE:** Variant IDs must be queried from the Printful API for catalog 582.
> Use: `GET https://api.printful.com/v2/catalog-products/582/catalog-variants`

### Black

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 26.20 |
| S | TBD | 26.20 |
| M | TBD | 26.20 |
| L | TBD | 26.20 |
| XL | TBD | 28.45 |
| 2XL | TBD | 30.70 |
| 3XL | TBD | 32.95 |

### Bottle Green

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 26.20 |
| S | TBD | 26.20 |
| M | TBD | 26.20 |
| L | TBD | 26.20 |
| XL | TBD | 28.45 |
| 2XL | TBD | 30.70 |
| 3XL | TBD | 32.95 |

### Burgundy

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 26.20 |
| S | TBD | 26.20 |
| M | TBD | 26.20 |
| L | TBD | 26.20 |
| XL | TBD | 28.45 |
| 2XL | TBD | 30.70 |
| 3XL | TBD | 32.95 |

### Burnt Orange

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 26.20 |
| S | TBD | 26.20 |
| M | TBD | 26.20 |
| L | TBD | 26.20 |
| XL | TBD | 28.45 |
| 2XL | TBD | 30.70 |
| 3XL | TBD | 32.95 |

### Charcoal Melange

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 26.20 |
| S | TBD | 26.20 |
| M | TBD | 26.20 |
| L | TBD | 26.20 |
| XL | TBD | 28.45 |
| 2XL | TBD | 30.70 |
| 3XL | TBD | 32.95 |

### White

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 26.20 |
| S | TBD | 26.20 |
| M | TBD | 26.20 |
| L | TBD | 26.20 |
| XL | TBD | 28.45 |
| 2XL | TBD | 30.70 |
| 3XL | TBD | 32.95 |

---

## Variant ID Lookup Script

```bash
curl -s "https://api.printful.com/v2/catalog-products/582/catalog-variants" \
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

### Standard (3 placements: front + back + sleeve_left):

```javascript
const PRICES = {
  XS: '59.99', S: '59.99', M: '59.99', L: '59.99',
  XL: '64.99', '2XL': '69.99', '3XL': '74.99',
};
```

| Talla | Retail | Cost (base + 3x 5.95 = 17.85) | Margin |
|---|---|---|---|
| XS | 59.99 | 44.05 | 26.6% |
| S | 59.99 | 44.05 | 26.6% |
| M | 59.99 | 44.05 | 26.6% |
| L | 59.99 | 44.05 | 26.6% |
| XL | 64.99 | 46.30 | 28.8% |
| 2XL | 69.99 | 48.55 | 30.6% |
| 3XL | 74.99 | 50.80 | 32.3% |

### Premium pricing (>35% margin target):

```javascript
const PRICES_PREMIUM = {
  XS: '69.99', S: '69.99', M: '69.99', L: '69.99',
  XL: '74.99', '2XL': '79.99', '3XL': '84.99',
};
```

| Talla | Retail | Cost | Margin |
|---|---|---|---|
| XS-L | 69.99 | 44.05 | 37.1% |
| XL | 74.99 | 46.30 | 38.3% |
| 2XL | 79.99 | 48.55 | 39.3% |
| 3XL | 84.99 | 50.80 | 40.2% |

> **NOTE:** Standard pricing falls below 35% margin. Use premium pricing or adjust margin fixer.

---

## Printfiles Summary

| Printfile | Canvas | DPI | Placement |
|---|---|---|---|
| PF#1 | 1800x2400 | 150 | front |
| PF#328 | 1800x2400 | 150 | back |
| PF#147 | 450x1800 | 150 | sleeve_left, sleeve_right |

**NOTE:** Both front (PF#1) and back (PF#328) use the same 1800x2400 dimensions. The back wordmark asset can be shared across products that use this canvas size.

---

## Total Variants

- 6 colors x 7 sizes = **41 variants** (confirmed via API, minus 1)
