# SOL'S 11362 Polo DTFilm Variant Reference — Catalog 810

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 810 |
| **Technique** | DTFilm (dtfilm) |
| **Total Colors** | 7 (Black, Grey Melange, Mouse Grey, Navy, Red, Sand, White) |
| **Total Sizes** | 8 (S, M, L, XL, 2XL, 3XL, 4XL, 5XL) |
| **Total Variants** | 50 (7 colors x 8 sizes = 56 catalog, 50 enabled) |
| **EU Fulfillment** | ALL variants — Latvia |
| **Base Cost Range** | 16.99-17.99 EUR |

---

## Color Catalog

### Black `#000000`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 16.99 |
| M | TBD-API-QUERY | 16.99 |
| L | TBD-API-QUERY | 16.99 |
| XL | TBD-API-QUERY | 16.99 |
| 2XL | TBD-API-QUERY | 17.99 |
| 3XL | TBD-API-QUERY | 17.99 |
| 4XL | TBD-API-QUERY | 17.99 |
| 5XL | TBD-API-QUERY | 17.99 |

### Grey Melange `#808080`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 16.99 |
| M | TBD-API-QUERY | 16.99 |
| L | TBD-API-QUERY | 16.99 |
| XL | TBD-API-QUERY | 16.99 |
| 2XL | TBD-API-QUERY | 17.99 |
| 3XL | TBD-API-QUERY | 17.99 |
| 4XL | TBD-API-QUERY | 17.99 |
| 5XL | TBD-API-QUERY | 17.99 |

### Mouse Grey `#646464`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 16.99 |
| M | TBD-API-QUERY | 16.99 |
| L | TBD-API-QUERY | 16.99 |
| XL | TBD-API-QUERY | 16.99 |
| 2XL | TBD-API-QUERY | 17.99 |
| 3XL | TBD-API-QUERY | 17.99 |
| 4XL | TBD-API-QUERY | 17.99 |
| 5XL | TBD-API-QUERY | 17.99 |

### Navy `#000080`

Dark color — use white/light designs for best contrast.

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 16.99 |
| M | TBD-API-QUERY | 16.99 |
| L | TBD-API-QUERY | 16.99 |
| XL | TBD-API-QUERY | 16.99 |
| 2XL | TBD-API-QUERY | 17.99 |
| 3XL | TBD-API-QUERY | 17.99 |
| 4XL | TBD-API-QUERY | 17.99 |
| 5XL | TBD-API-QUERY | 17.99 |

### Red `#CC0000`

Medium-dark — white/light designs preferred for readability.

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 16.99 |
| M | TBD-API-QUERY | 16.99 |
| L | TBD-API-QUERY | 16.99 |
| XL | TBD-API-QUERY | 16.99 |
| 2XL | TBD-API-QUERY | 17.99 |
| 3XL | TBD-API-QUERY | 17.99 |
| 4XL | TBD-API-QUERY | 17.99 |
| 5XL | TBD-API-QUERY | 17.99 |

### Sand `#C2B280`

Light warm tone — use dark designs for contrast.

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 16.99 |
| M | TBD-API-QUERY | 16.99 |
| L | TBD-API-QUERY | 16.99 |
| XL | TBD-API-QUERY | 16.99 |
| 2XL | TBD-API-QUERY | 17.99 |
| 3XL | TBD-API-QUERY | 17.99 |
| 4XL | TBD-API-QUERY | 17.99 |
| 5XL | TBD-API-QUERY | 17.99 |

### White `#FFFFFF`

Light — dark/black designs ONLY.

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 16.99 |
| M | TBD-API-QUERY | 16.99 |
| L | TBD-API-QUERY | 16.99 |
| XL | TBD-API-QUERY | 16.99 |
| 2XL | TBD-API-QUERY | 17.99 |
| 3XL | TBD-API-QUERY | 17.99 |
| 4XL | TBD-API-QUERY | 17.99 |
| 5XL | TBD-API-QUERY | 17.99 |

---

## How to Get Variant IDs

```bash
curl -s "https://api.printful.com/v2/catalog-products/810/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

Replace `TBD-API-QUERY` with actual IDs. All 7 colors confirmed via API (50 enabled variants total).

---

## DTFilm Placement Costs (per variant)

| Placement | Printfile | Canvas | DPI | Cost (EUR) |
|---|---|---|---|---|
| `chest_left_dtf` | PF#136 | 1200x1200 | 300 | **+0.99** |
| `back_dtf` | PF#222 | 3000x1800 | 300 | +5.25 |
| `back_large_dtf` | PF#222 | 3000x1800 | 300 | +5.25 |
| `short_sleeve_left_dtf` | PF#396 | 600x900 | 300 | +2.20 |
| `short_sleeve_right_dtf` | PF#396 | 600x900 | 300 | +2.20 |
| `label_inside_dtf` | — | — | — | +0.99 |

**NOTE:** `back_dtf` and `back_large_dtf` are mutually exclusive.

### Production Cost Examples

**Chest-only (minimum viable branding):**

| Size | Base | Placements | Total |
|---|---|---|---|
| S-XL | 16.99 | +0.99 | 17.98 |
| 2XL-5XL | 17.99 | +0.99 | 18.98 |

**Chest + label (branded minimum):**

| Size | Base | Placements | Total |
|---|---|---|---|
| S-XL | 16.99 | +1.98 | 18.97 |
| 2XL-5XL | 17.99 | +1.98 | 19.97 |

**Full branding (chest + back + sleeve + label):**

| Size | Base | Placements | Total |
|---|---|---|---|
| S-XL | 16.99 | +9.43 | 26.42 |
| 2XL-5XL | 17.99 | +9.43 | 27.42 |

---

## Color Slug Mapping

| Color | Slug | Dark? | Design Palette | EU |
|---|---|---|---|---|
| Black | `black` | YES | White/light designs | in_stock |
| Grey Melange | `grey-melange` | MEDIUM | Both dark and light work | in_stock |
| Mouse Grey | `mouse-grey` | MEDIUM | Both dark and light work | in_stock |
| Navy | `navy` | YES | White/light designs | in_stock |
| Red | `red` | MEDIUM-DARK | White/light preferred | in_stock |
| Sand | `sand` | NO (light warm) | Dark designs | in_stock |
| White | `white` | NO (light) | Dark/black designs only | in_stock |

**NOTE:** Grey Melange and Mouse Grey are medium-tone — both dark and light DTFilm designs may work depending on contrast. Test mockups. Navy behaves like Black for design contrast. Sand and White require inverted (dark) design palettes.

---

## Key Differentiator

The `chest_left_dtf` placement at **+0.99 EUR** is uniquely cheap across the entire SKAPARA Printful catalog. This makes the SOL'S 11362 Polo ideal for:
- Corporate/branded polos with small chest logo
- Low-cost entry point for DTFilm products
- High-margin products (48%+ margin on chest-only branding)
