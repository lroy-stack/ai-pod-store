# SOL'S 03567 Organic Raglan Sweatshirt DTFilm Variant Reference — Catalog 582

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 582 |
| **Technique** | DTFilm (dtfilm) |
| **Total Colors** | 6 (Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White) |
| **Total Sizes** | 7 (XS, S, M, L, XL, 2XL, 3XL) |
| **Total Variants** | 41 (6 colors x 7 sizes, minus 1) |
| **EU Fulfillment** | ALL variants — Latvia |
| **Base Cost Range** | 26.20-32.95 EUR |

---

## Color Catalog

6 colors confirmed via API. Mix of dark, medium, and light tones.

### Black `#000000`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 26.20 |
| S | TBD-API-QUERY | 26.20 |
| M | TBD-API-QUERY | 26.20 |
| L | TBD-API-QUERY | 26.20 |
| XL | TBD-API-QUERY | 28.55 |
| 2XL | TBD-API-QUERY | 30.70 |
| 3XL | TBD-API-QUERY | 32.95 |

### Bottle Green `#1A472A`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 26.20 |
| S | TBD-API-QUERY | 26.20 |
| M | TBD-API-QUERY | 26.20 |
| L | TBD-API-QUERY | 26.20 |
| XL | TBD-API-QUERY | 28.55 |
| 2XL | TBD-API-QUERY | 30.70 |
| 3XL | TBD-API-QUERY | 32.95 |

### Burgundy `#800020`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 26.20 |
| S | TBD-API-QUERY | 26.20 |
| M | TBD-API-QUERY | 26.20 |
| L | TBD-API-QUERY | 26.20 |
| XL | TBD-API-QUERY | 28.55 |
| 2XL | TBD-API-QUERY | 30.70 |
| 3XL | TBD-API-QUERY | 32.95 |

### Burnt Orange `#CC5500`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 26.20 |
| S | TBD-API-QUERY | 26.20 |
| M | TBD-API-QUERY | 26.20 |
| L | TBD-API-QUERY | 26.20 |
| XL | TBD-API-QUERY | 28.55 |
| 2XL | TBD-API-QUERY | 30.70 |
| 3XL | TBD-API-QUERY | 32.95 |

### Charcoal Melange `#4A4A4A`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 26.20 |
| S | TBD-API-QUERY | 26.20 |
| M | TBD-API-QUERY | 26.20 |
| L | TBD-API-QUERY | 26.20 |
| XL | TBD-API-QUERY | 28.55 |
| 2XL | TBD-API-QUERY | 30.70 |
| 3XL | TBD-API-QUERY | 32.95 |

### White `#FFFFFF`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 26.20 |
| S | TBD-API-QUERY | 26.20 |
| M | TBD-API-QUERY | 26.20 |
| L | TBD-API-QUERY | 26.20 |
| XL | TBD-API-QUERY | 28.55 |
| 2XL | TBD-API-QUERY | 30.70 |
| 3XL | TBD-API-QUERY | 32.95 |

---

## How to Get Variant IDs

Variant IDs are shared across techniques (DTG/DTFilm/Embroidery) for the same catalog. Query:

```bash
curl -s "https://api.printful.com/v2/catalog-products/582/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

Replace `TBD-API-QUERY` with actual IDs from the API response.

---

## DTFilm Placement Costs (per variant)

| Placement | Printfile | Canvas | Cost (EUR) |
|---|---|---|---|
| `front_dtf` | PF#1 | 1800x2400 @150dpi | +5.25 |
| `back_dtf` | PF#328 | 1800x2400 @150dpi | +5.25 |
| `long_sleeve_left_dtf` | PF#147 | 450x1800 @150dpi | +5.25 |
| `long_sleeve_right_dtf` | PF#147 | 450x1800 @150dpi | +5.25 |

**NOTE:** Back uses PF#328 (different printfile than front PF#1, same canvas dimensions).

### Production Cost Examples

**3 placements (front + back + left sleeve):**

| Size | Base | Placements | Total |
|---|---|---|---|
| XS-L | 26.20 | +15.75 | 41.95 |
| XL | 28.55 | +15.75 | 44.30 |
| 2XL | 30.70 | +15.75 | 46.45 |
| 3XL | 32.95 | +15.75 | 48.70 |

**1 placement (front only):**

| Size | Base | Placements | Total |
|---|---|---|---|
| XS-L | 26.20 | +5.25 | 31.45 |
| XL | 28.55 | +5.25 | 33.80 |
| 2XL | 30.70 | +5.25 | 35.95 |
| 3XL | 32.95 | +5.25 | 38.20 |

---

## Color Slug Mapping

| Color | Slug | Dark? | EU |
|---|---|---|---|
| Black | `black` | YES | in_stock |
| Bottle Green | `bottle-green` | YES | in_stock |
| Burgundy | `burgundy` | YES | in_stock |
| Burnt Orange | `burnt-orange` | MEDIUM | in_stock |
| Charcoal Melange | `charcoal-melange` | YES | in_stock |
| White | `white` | NO | in_stock |
