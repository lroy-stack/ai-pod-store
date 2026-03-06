# Variants — SOL'S 11362 Polo Embroidery (Catalog 810)

## Colors Available (EU Latvia)

| Color | Hex | Slug | Thread Recommendation |
|---|---|---|---|
| **Black** | `#000000` | `black` | White thread |
| **Grey Melange** | `#B0B0B0` | `grey-melange` | Black thread |
| **Mouse Grey** | `#808080` | `mouse-grey` | White or black thread |
| **Navy** | `#000080` | `navy` | White thread (dark garment) |
| **Red** | `#CC0000` | `red` | White thread (medium-dark) |
| **Sand** | `#C2B280` | `sand` | Black thread (light warm) |
| **White** | `#FFFFFF` | `white` | Black thread (light garment) |

> **7 colors confirmed via API.** 50 enabled variants total (7 colors x 8 sizes = 56 catalog, 50 enabled).

---

## Sizes

Wide size range — 8 sizes:

| Size | Base Cost (EUR) | Notes |
|---|---|---|
| S | 16.99 | Base tier |
| M | 16.99 | Base tier |
| L | 16.99 | Base tier |
| XL | 16.99 | Base tier |
| 2XL | 17.99 | Upper tier |
| 3XL | 17.99 | Upper tier |
| 4XL | 17.99 | Upper tier |
| 5XL | 17.99 | Upper tier |

---

## Variant IDs por Color x Talla

> **NOTE:** Variant IDs must be queried from the Printful API for catalog 810.
> Use: `GET https://api.printful.com/v2/catalog-products/810/catalog-variants`

### Black

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 16.99 |
| M | TBD | 16.99 |
| L | TBD | 16.99 |
| XL | TBD | 16.99 |
| 2XL | TBD | 17.99 |
| 3XL | TBD | 17.99 |
| 4XL | TBD | 17.99 |
| 5XL | TBD | 17.99 |

### Grey Melange

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 16.99 |
| M | TBD | 16.99 |
| L | TBD | 16.99 |
| XL | TBD | 16.99 |
| 2XL | TBD | 17.99 |
| 3XL | TBD | 17.99 |
| 4XL | TBD | 17.99 |
| 5XL | TBD | 17.99 |

### Mouse Grey

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 16.99 |
| M | TBD | 16.99 |
| L | TBD | 16.99 |
| XL | TBD | 16.99 |
| 2XL | TBD | 17.99 |
| 3XL | TBD | 17.99 |
| 4XL | TBD | 17.99 |
| 5XL | TBD | 17.99 |

### Navy

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 16.99 |
| M | TBD | 16.99 |
| L | TBD | 16.99 |
| XL | TBD | 16.99 |
| 2XL | TBD | 17.99 |
| 3XL | TBD | 17.99 |
| 4XL | TBD | 17.99 |
| 5XL | TBD | 17.99 |

### Red

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 16.99 |
| M | TBD | 16.99 |
| L | TBD | 16.99 |
| XL | TBD | 16.99 |
| 2XL | TBD | 17.99 |
| 3XL | TBD | 17.99 |
| 4XL | TBD | 17.99 |
| 5XL | TBD | 17.99 |

### Sand

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 16.99 |
| M | TBD | 16.99 |
| L | TBD | 16.99 |
| XL | TBD | 16.99 |
| 2XL | TBD | 17.99 |
| 3XL | TBD | 17.99 |
| 4XL | TBD | 17.99 |
| 5XL | TBD | 17.99 |

### White

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 16.99 |
| M | TBD | 16.99 |
| L | TBD | 16.99 |
| XL | TBD | 16.99 |
| 2XL | TBD | 17.99 |
| 3XL | TBD | 17.99 |
| 4XL | TBD | 17.99 |
| 5XL | TBD | 17.99 |

---

## Variant ID Lookup Script

```bash
curl -s "https://api.printful.com/v2/catalog-products/810/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

```javascript
const VARIANTS = {
  Black: { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD, '4XL': TBD, '5XL': TBD },
  'Grey Melange': { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD, '4XL': TBD, '5XL': TBD },
  'Mouse Grey': { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD, '4XL': TBD, '5XL': TBD },
  Navy: { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD, '4XL': TBD, '5XL': TBD },
  Red: { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD, '4XL': TBD, '5XL': TBD },
  Sand: { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD, '4XL': TBD, '5XL': TBD },
  White: { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD, '3XL': TBD, '4XL': TBD, '5XL': TBD },
};
```

---

## Embroidery Placements

| Placement | Printfile | Canvas | DPI | Cost | Notes |
|---|---|---|---|---|---|
| `embroidery_chest_left` | PF#136 | 1200x1200 | 300 | +2.60 EUR | Primary — S mark |
| `embroidery_sleeve_left_top` | PF#396 | 600x900 | 300 | +2.60 EUR | Secondary — mini S mark |
| `embroidery_sleeve_right_top` | PF#396 | 600x900 | 300 | +2.60 EUR | Optional |

**Reference printfiles (may not be available for embroidery):**

| Printfile | Canvas | DPI | Notes |
|---|---|---|---|
| PF#222 | 3000x1800 | 300 | Back — likely DTFilm only |

---

## Retail Pricing (EUR)

### With 1 placement (chest_left — CLASSIC):

```javascript
const PRICES_1P = {
  S: '29.99', M: '29.99', L: '29.99', XL: '29.99',
  '2XL': '32.99', '3XL': '32.99', '4XL': '32.99', '5XL': '32.99',
};
```

| Talla | Retail | Cost (base + 1x 2.60) | Margin |
|---|---|---|---|
| S | 29.99 | 19.59 | 34.7% |
| M | 29.99 | 19.59 | 34.7% |
| L | 29.99 | 19.59 | 34.7% |
| XL | 29.99 | 19.59 | 34.7% |
| 2XL | 32.99 | 20.59 | 37.6% |
| 3XL | 32.99 | 20.59 | 37.6% |
| 4XL | 32.99 | 20.59 | 37.6% |
| 5XL | 32.99 | 20.59 | 37.6% |

### With 2 placements (chest + sleeve):

```javascript
const PRICES_2P = {
  S: '34.99', M: '34.99', L: '34.99', XL: '34.99',
  '2XL': '37.99', '3XL': '37.99', '4XL': '37.99', '5XL': '37.99',
};
```

| Talla | Retail | Cost (base + 2x 2.60) | Margin |
|---|---|---|---|
| S-XL | 34.99 | 22.19 | 36.6% |
| 2XL-5XL | 37.99 | 23.19 | 39.0% |

### Premium pricing:

```javascript
const PRICES_PREMIUM = {
  S: '34.99', M: '34.99', L: '34.99', XL: '34.99',
  '2XL': '37.99', '3XL': '37.99', '4XL': '37.99', '5XL': '37.99',
};
```

| Talla | Retail | Cost (1 placement) | Margin |
|---|---|---|---|
| S-XL | 34.99 | 19.59 | 44.0% |
| 2XL-5XL | 37.99 | 20.59 | 45.8% |

> **Excellent margins** across all configurations. Polo is one of the best-margin products in the SKAPARA catalog.

---

## Printfiles Summary

| Printfile | Canvas | DPI | Placement |
|---|---|---|---|
| PF#136 | 1200x1200 | 300 | embroidery_chest_left |
| PF#222 | 3000x1800 | 300 | back (may be DTFilm only) |
| PF#396 | 600x900 | 300 | embroidery_sleeve_left_top, embroidery_sleeve_right_top |

---

## Thread Color Recommendations by Garment Color

| Garment | Primary Thread | Accent | Notes |
|---|---|---|---|
| Black | White (#FFFFFF) | — | Classic polo look |
| Grey Melange | Black (#000000) | — | High contrast on heather |
| Mouse Grey | White (#FFFFFF) | — | Clean on medium grey |
| Navy | White (#FFFFFF) | — | White on dark — classic polo |
| Red | White (#FFFFFF) | — | White/light preferred |
| Sand | Black (#000000) | — | Dark thread on light warm |
| White | Black (#000000) | — | Dark/black only — no white-on-white |

---

## Total Variants

- 7 colors x 8 sizes = **56 catalog variants** (50 enabled)
- All 7 colors confirmed via API: Black, Grey Melange, Mouse Grey, Navy, Red, Sand, White
- Largest variant count among the polo skills (due to 7 colors x 8 sizes)
