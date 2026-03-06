# SOL'S 03568 Eco Raglan Hoodie DTFilm Variant Reference — Catalog 543

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 543 |
| **Technique** | DTFilm (dtfilm) |
| **Total Colors** | 6 (Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White) |
| **Total Sizes** | 7 (XS, S, M, L, XL, 2XL, 3XL) |
| **Total Variants** | 42 (6 colors x 7 sizes) |
| **EU Fulfillment** | ALL variants — Latvia |
| **Base Cost Range** | 35.20-42.25 EUR |

---

## Color Catalog

6 colors confirmed via API. Mix of dark, medium, and light tones.

### Black `#000000`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 35.20 |
| S | TBD-API-QUERY | 35.20 |
| M | TBD-API-QUERY | 35.20 |
| L | TBD-API-QUERY | 35.20 |
| XL | TBD-API-QUERY | 37.50 |
| 2XL | TBD-API-QUERY | 39.85 |
| 3XL | TBD-API-QUERY | 42.25 |

### Bottle Green `#1A472A`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 35.20 |
| S | TBD-API-QUERY | 35.20 |
| M | TBD-API-QUERY | 35.20 |
| L | TBD-API-QUERY | 35.20 |
| XL | TBD-API-QUERY | 37.50 |
| 2XL | TBD-API-QUERY | 39.85 |
| 3XL | TBD-API-QUERY | 42.25 |

### Burgundy `#800020`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 35.20 |
| S | TBD-API-QUERY | 35.20 |
| M | TBD-API-QUERY | 35.20 |
| L | TBD-API-QUERY | 35.20 |
| XL | TBD-API-QUERY | 37.50 |
| 2XL | TBD-API-QUERY | 39.85 |
| 3XL | TBD-API-QUERY | 42.25 |

### Burnt Orange `#CC5500`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 35.20 |
| S | TBD-API-QUERY | 35.20 |
| M | TBD-API-QUERY | 35.20 |
| L | TBD-API-QUERY | 35.20 |
| XL | TBD-API-QUERY | 37.50 |
| 2XL | TBD-API-QUERY | 39.85 |
| 3XL | TBD-API-QUERY | 42.25 |

### Charcoal Melange `#4A4A4A`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 35.20 |
| S | TBD-API-QUERY | 35.20 |
| M | TBD-API-QUERY | 35.20 |
| L | TBD-API-QUERY | 35.20 |
| XL | TBD-API-QUERY | 37.50 |
| 2XL | TBD-API-QUERY | 39.85 |
| 3XL | TBD-API-QUERY | 42.25 |

### White `#FFFFFF`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 35.20 |
| S | TBD-API-QUERY | 35.20 |
| M | TBD-API-QUERY | 35.20 |
| L | TBD-API-QUERY | 35.20 |
| XL | TBD-API-QUERY | 37.50 |
| 2XL | TBD-API-QUERY | 39.85 |
| 3XL | TBD-API-QUERY | 42.25 |

---

## How to Get Variant IDs

Variant IDs are shared across techniques (DTG/DTFilm/Embroidery) for the same catalog. Query:

```bash
curl -s "https://api.printful.com/v2/catalog-products/543/catalog-variants" \
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
| `back_dtf` | PF#1 | 1800x2400 @150dpi | +5.25 |
| `long_sleeve_left_dtf` | PF#147 | 450x1800 @150dpi | +5.25 |
| `long_sleeve_right_dtf` | PF#147 | 450x1800 @150dpi | +5.25 |

### Production Cost Examples

**3 placements (front + back + left sleeve):**

| Size | Base | Placements | Total |
|---|---|---|---|
| XS-L | 35.20 | +15.75 | 50.95 |
| XL | 37.50 | +15.75 | 53.25 |
| 2XL | 39.85 | +15.75 | 55.60 |
| 3XL | 42.25 | +15.75 | 58.00 |

**1 placement (front only):**

| Size | Base | Placements | Total |
|---|---|---|---|
| XS-L | 35.20 | +5.25 | 40.45 |
| XL | 37.50 | +5.25 | 42.75 |
| 2XL | 39.85 | +5.25 | 45.10 |
| 3XL | 42.25 | +5.25 | 47.50 |

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
