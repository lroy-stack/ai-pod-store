# Variants — SOL'S 03574 Comet Organic Sweatshirt DTG (Catalog 506)

## Colors Available (EU Latvia)

8 colors total. Mix of dark, medium, and light tones.

| Color | Hex | Slug | Tone | Design Guidance |
|---|---|---|---|---|
| **Black** | `#000000` | `black` | Dark | White/light designs |
| **Bottle Green** | `#004225` | `bottle-green` | Dark | White/light designs |
| **Deep Charcoal Grey** | `#3C3C3C` | `deep-charcoal-grey` | Dark | White/light designs |
| **French Navy** | `#1E2D53` | `french-navy` | Dark | White/light designs |
| **Grey Melange** | `#B0B0B0` | `grey-melange` | Medium | Both light and dark designs work |
| **Red** | `#CC0000` | `red` | Dark-Medium | White/light designs preferred |
| **Royal Blue** | `#003DA5` | `royal-blue` | Dark | White/light designs |
| **White** | `#FFFFFF` | `white` | Light | Dark/black designs ONLY |

---

## Sizes

| Size | Notes |
|---|---|
| XS | Standard |
| S | Standard |
| M | Standard |
| L | Standard |
| XL | Higher base cost |
| XXL | Highest base cost |

---

## Variant IDs por Color x Talla

> **NOTE:** Variant IDs must be queried from the Printful API for catalog 506.
> Use: `GET https://api.printful.com/v2/catalog-products/506/catalog-variants`

### Black

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 22.40 |
| S | TBD | 22.40 |
| M | TBD | 22.40 |
| L | TBD | 22.40 |
| XL | TBD | 24.70 |
| XXL | TBD | 26.95 |

### Bottle Green

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 22.40 |
| S | TBD | 22.40 |
| M | TBD | 22.40 |
| L | TBD | 22.40 |
| XL | TBD | 24.70 |
| XXL | TBD | 26.95 |

### Deep Charcoal Grey

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 22.40 |
| S | TBD | 22.40 |
| M | TBD | 22.40 |
| L | TBD | 22.40 |
| XL | TBD | 24.70 |
| XXL | TBD | 26.95 |

### French Navy

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 22.40 |
| S | TBD | 22.40 |
| M | TBD | 22.40 |
| L | TBD | 22.40 |
| XL | TBD | 24.70 |
| XXL | TBD | 26.95 |

### Grey Melange

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 22.40 |
| S | TBD | 22.40 |
| M | TBD | 22.40 |
| L | TBD | 22.40 |
| XL | TBD | 24.70 |
| XXL | TBD | 26.95 |

### Red

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 22.40 |
| S | TBD | 22.40 |
| M | TBD | 22.40 |
| L | TBD | 22.40 |
| XL | TBD | 24.70 |
| XXL | TBD | 26.95 |

### Royal Blue

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 22.40 |
| S | TBD | 22.40 |
| M | TBD | 22.40 |
| L | TBD | 22.40 |
| XL | TBD | 24.70 |
| XXL | TBD | 26.95 |

### White

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| XS | TBD | 22.40 |
| S | TBD | 22.40 |
| M | TBD | 22.40 |
| L | TBD | 22.40 |
| XL | TBD | 24.70 |
| XXL | TBD | 26.95 |

---

## Variant ID Lookup Script

```bash
curl -s "https://api.printful.com/v2/catalog-products/506/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

```javascript
const VARIANTS = {
  Black: { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, XXL: TBD },
  'Bottle Green': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, XXL: TBD },
  'Deep Charcoal Grey': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, XXL: TBD },
  'French Navy': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, XXL: TBD },
  'Grey Melange': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, XXL: TBD },
  'Red': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, XXL: TBD },
  'Royal Blue': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, XXL: TBD },
  'White': { XS: TBD, S: TBD, M: TBD, L: TBD, XL: TBD, XXL: TBD },
};
```

---

## Retail Pricing (EUR)

### With 3 placements (front + back + sleeve_left):

```javascript
const PRICES = {
  XS: '54.99', S: '54.99', M: '54.99', L: '54.99', XL: '57.99', XXL: '59.99',
};
```

| Talla | Retail | Cost (base + 3x 5.95 = 17.85) | Margin |
|---|---|---|---|
| S | 54.99 | 40.25 | 26.8% |
| M | 54.99 | 40.25 | 26.8% |
| L | 54.99 | 40.25 | 26.8% |
| XL | 57.99 | 42.55 | 26.6% |
| XXL | 59.99 | 44.80 | 25.3% |

### With 2 placements (front + sleeve_left):

```javascript
const PRICES_2P = {
  XS: '44.99', S: '44.99', M: '44.99', L: '44.99', XL: '47.99', XXL: '49.99',
};
```

| Talla | Retail | Cost (base + 2x 5.95 = 11.90) | Margin |
|---|---|---|---|
| S | 44.99 | 34.30 | 23.8% |
| M | 44.99 | 34.30 | 23.8% |
| L | 44.99 | 34.30 | 23.8% |
| XL | 47.99 | 36.60 | 23.7% |
| XXL | 49.99 | 38.85 | 22.3% |

> **WARNING:** All pricing tiers fall below the 35% margin threshold. Adjust retail prices or margin fixer threshold.

---

## Total Variants

- 8 colors x 5 sizes = **40 variants** from API (not all colors may have XS — verify via API query)
