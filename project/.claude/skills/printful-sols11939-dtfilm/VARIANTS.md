# SOL'S 11939 Sports Jersey DTFilm Variant Reference — Catalog 715

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 715 |
| **Technique** | DTFilm (dtfilm) — DEFAULT for this product |
| **Total Colors** | 7 |
| **Total Sizes** | 5 (S, M, L, XL, 2XL) |
| **Total Variants** | 35 (7 colors x 5 sizes) |
| **EU Fulfillment** | ALL variants — Latvia |
| **Base Cost Range** | 13.95-17.25 EUR |
| **Material** | 100% polyester mesh (DTG NOT possible) |

---

## Color Catalog

### Dark Colors (white/light DTFilm designs)

#### Black `#000000`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 13.95 |
| M | TBD-API-QUERY | 13.95 |
| L | TBD-API-QUERY | 13.95 |
| XL | TBD-API-QUERY | 15.60 |
| 2XL | TBD-API-QUERY | 17.25 |

#### French Navy `#071429`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 13.95 |
| M | TBD-API-QUERY | 13.95 |
| L | TBD-API-QUERY | 13.95 |
| XL | TBD-API-QUERY | 15.60 |
| 2XL | TBD-API-QUERY | 17.25 |

#### Red `#CC0000`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 13.95 |
| M | TBD-API-QUERY | 13.95 |
| L | TBD-API-QUERY | 13.95 |
| XL | TBD-API-QUERY | 15.60 |
| 2XL | TBD-API-QUERY | 17.25 |

#### Royal Blue `#0033CC`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 13.95 |
| M | TBD-API-QUERY | 13.95 |
| L | TBD-API-QUERY | 13.95 |
| XL | TBD-API-QUERY | 15.60 |
| 2XL | TBD-API-QUERY | 17.25 |

### Light Colors (dark/black DTFilm designs)

#### White `#FFFFFF`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 13.95 |
| M | TBD-API-QUERY | 13.95 |
| L | TBD-API-QUERY | 13.95 |
| XL | TBD-API-QUERY | 15.60 |
| 2XL | TBD-API-QUERY | 17.25 |

### Neon Colors (dark/black DTFilm designs)

#### Neon Orange `#FF6600`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 13.95 |
| M | TBD-API-QUERY | 13.95 |
| L | TBD-API-QUERY | 13.95 |
| XL | TBD-API-QUERY | 15.60 |
| 2XL | TBD-API-QUERY | 17.25 |

#### Neon Yellow `#CCFF00`

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| S | TBD-API-QUERY | 13.95 |
| M | TBD-API-QUERY | 13.95 |
| L | TBD-API-QUERY | 13.95 |
| XL | TBD-API-QUERY | 15.60 |
| 2XL | TBD-API-QUERY | 17.25 |

---

## How to Get Variant IDs

```bash
curl -s "https://api.printful.com/v2/catalog-products/715/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

Replace `TBD-API-QUERY` with actual IDs from the response.

---

## DTFilm Placement Costs (per variant)

| Placement | Printfile | Canvas | Cost (EUR) |
|---|---|---|---|
| `front_dtf` | PF#1 | 1800x2400 @150dpi | +5.25 |
| `back_dtf` | PF#1 | 1800x2400 @150dpi | +5.25 |
| `short_sleeve_left_dtf` | PF#130 | 600x525 @150dpi | +2.20 |
| `short_sleeve_right_dtf` | PF#130 | 600x525 @150dpi | +2.20 |
| `label_inside_dtf` | PF#71 | 450x450 @150dpi | +0.99 |

### Production Cost Examples

**4 placements (front + back + sleeve + label):**

| Size | Base | Placements | Total |
|---|---|---|---|
| S-L | 13.95 | +13.69 | 27.64 |
| XL | 15.60 | +13.69 | 29.29 |
| 2XL | 17.25 | +13.69 | 30.94 |

**2 placements (front + back only):**

| Size | Base | Placements | Total |
|---|---|---|---|
| S-L | 13.95 | +10.50 | 24.45 |
| XL | 15.60 | +10.50 | 26.10 |
| 2XL | 17.25 | +10.50 | 27.75 |

---

## Design Strategy by Color

| Color | Garment Brightness | DTFilm Design Should Be |
|---|---|---|
| Black | Very Dark | White/light artwork, white text |
| French Navy | Dark | White/light artwork |
| Red | Dark | White/light artwork, white text |
| Royal Blue | Dark | White/light artwork, white text |
| White | Very Light | Black/dark artwork, dark text |
| Neon Orange | Very Light/Bright | Black/dark artwork, dark text |
| Neon Yellow | Very Light/Bright | Black/dark artwork, dark text |

**NOTE:** You need at minimum TWO design versions — white artwork (for Black, French Navy, Red, Royal Blue) and dark artwork (for White, Neon Orange, Neon Yellow).

---

## Color Slug Mapping

| Color | Slug | Dark? | EU |
|---|---|---|---|
| Black | `black` | YES | in_stock |
| French Navy | `french-navy` | YES | in_stock |
| Red | `red` | YES | in_stock |
| Royal Blue | `royal-blue` | YES | in_stock |
| White | `white` | NO | in_stock |
| Neon Orange | `neon-orange` | NO | in_stock |
| Neon Yellow | `neon-yellow` | NO | in_stock |
