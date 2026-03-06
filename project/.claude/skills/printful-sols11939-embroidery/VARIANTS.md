# SOL'S 11939 Sports Jersey Embroidery Variant Reference — Catalog 715

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 715 (same as DTFilm) |
| **Technique** | Embroidery |
| **Total Colors** | 7 |
| **Total Sizes** | 5 (S, M, L, XL, 2XL) |
| **Total Variants** | 35 (7 colors x 5 sizes) |
| **EU Fulfillment** | ALL variants — Latvia |
| **Base Cost Range** | 13.95-17.25 EUR |
| **Embroidery Cost** | +2.60 EUR per placement |
| **Material** | 100% polyester mesh (DTG NOT possible) |

---

## Color Catalog

### Dark Colors (white/light thread)

#### Black `#000000`

| Size | Catalog Variant ID | Base Cost | + 2x Emb | Total |
|---|---|---|---|---|
| S | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| M | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| L | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| XL | TBD-API-QUERY | 15.60 | +5.20 | 20.80 |
| 2XL | TBD-API-QUERY | 17.25 | +5.20 | 22.45 |

#### French Navy `#071429`

| Size | Catalog Variant ID | Base Cost | + 2x Emb | Total |
|---|---|---|---|---|
| S | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| M | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| L | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| XL | TBD-API-QUERY | 15.60 | +5.20 | 20.80 |
| 2XL | TBD-API-QUERY | 17.25 | +5.20 | 22.45 |

#### Red `#CC0000`

| Size | Catalog Variant ID | Base Cost | + 2x Emb | Total |
|---|---|---|---|---|
| S | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| M | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| L | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| XL | TBD-API-QUERY | 15.60 | +5.20 | 20.80 |
| 2XL | TBD-API-QUERY | 17.25 | +5.20 | 22.45 |

#### Royal Blue `#0033CC`

| Size | Catalog Variant ID | Base Cost | + 2x Emb | Total |
|---|---|---|---|---|
| S | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| M | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| L | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| XL | TBD-API-QUERY | 15.60 | +5.20 | 20.80 |
| 2XL | TBD-API-QUERY | 17.25 | +5.20 | 22.45 |

### Light Colors (dark/black thread)

#### White `#FFFFFF`

| Size | Catalog Variant ID | Base Cost | + 2x Emb | Total |
|---|---|---|---|---|
| S | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| M | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| L | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| XL | TBD-API-QUERY | 15.60 | +5.20 | 20.80 |
| 2XL | TBD-API-QUERY | 17.25 | +5.20 | 22.45 |

### Neon Colors (dark/black thread)

#### Neon Orange `#FF6600`

| Size | Catalog Variant ID | Base Cost | + 2x Emb | Total |
|---|---|---|---|---|
| S | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| M | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| L | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| XL | TBD-API-QUERY | 15.60 | +5.20 | 20.80 |
| 2XL | TBD-API-QUERY | 17.25 | +5.20 | 22.45 |

#### Neon Yellow `#CCFF00`

| Size | Catalog Variant ID | Base Cost | + 2x Emb | Total |
|---|---|---|---|---|
| S | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| M | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| L | TBD-API-QUERY | 13.95 | +5.20 | 19.15 |
| XL | TBD-API-QUERY | 15.60 | +5.20 | 20.80 |
| 2XL | TBD-API-QUERY | 17.25 | +5.20 | 22.45 |

---

## How to Get Variant IDs

Variant IDs are shared across techniques (DTFilm/Embroidery) for the same catalog:

```bash
curl -s "https://api.printful.com/v2/catalog-products/715/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

---

## Embroidery Placement Costs

| Placement | Canvas @300dpi | Cost |
|---|---|---|
| `embroidery_chest_center` | 1200x1200 (PF#136) | +2.60 EUR |
| `embroidery_chest_left` | 1200x1200 (PF#136) | +2.60 EUR |
| `embroidery_sleeve_left_top` | 600x525 | +2.60 EUR |
| `embroidery_sleeve_right_top` | 600x525 | +2.60 EUR |

**CRITICAL:** `chest_center` and `chest_left` are MUTUALLY EXCLUSIVE.

**NOTE:** This product uses `sleeve_left_top` / `sleeve_right_top` (NOT `wrist_left` / `wrist_right` like hoodies).

---

## Thread Color Strategy by Garment

| Garment | Thread Colors (recommended) |
|---|---|
| Black | `#FFFFFF` White, `#01784E` Kelly Green, `#FFCC00` Gold |
| French Navy | `#FFFFFF` White, `#CC3333` Red, `#FFCC00` Gold |
| Red | `#FFFFFF` White, `#FFCC00` Gold, `#000000` Black |
| Royal Blue | `#FFFFFF` White, `#FFCC00` Gold, `#01784E` Kelly Green |
| White | `#000000` Black, `#333366` Navy, `#CC3333` Red |
| Neon Orange | `#000000` Black, `#333366` Navy, `#660000` Maroon |
| Neon Yellow | `#000000` Black, `#333366` Navy, `#01784E` Kelly Green |

---

## Thread Colors (15 available)

| Hex | Name |
|---|---|
| `#FFFFFF` | 1801 White |
| `#000000` | 1800 Black |
| `#96A1A8` | 1718 Grey |
| `#A67843` | 1672 Old Gold |
| `#FFCC00` | 1951 Gold |
| `#E25C27` | 1987 Orange |
| `#CC3366` | 1910 Flamingo |
| `#CC3333` | 1839 Red |
| `#660000` | 1784 Maroon |
| `#333366` | 1966 Navy |
| `#005397` | 1842 Royal |
| `#3399FF` | 1695 Aqua/Teal |
| `#6B5294` | 1832 Purple |
| `#01784E` | 1751 Kelly Green |
| `#7BA35A` | 1848 Kiwi Green |

---

## Color Slug Mapping

| Color | Slug | Dark? | EU |
|---|---|---|---|
| Black | `black` | YES | in_stock |
| French Navy | `french-navy` | YES | in_stock |
| Red | `red` | YES | in_stock |
| Royal Blue | `royal-blue` | YES | in_stock |
| White | `white` | NO | in_stock |
| Neon Orange | `neon-orange` | NO (bright) | in_stock |
| Neon Yellow | `neon-yellow` | NO (bright) | in_stock |

---

## Key Differentiator

At **+2.60 EUR per embroidery placement** (vs +2.95 EUR on hoodies/sweatshirts), the SOL'S 11939 offers the cheapest embroidery in the SKAPARA apparel catalog. Combined with the lowest base cost (13.95 EUR), this is the most affordable embroidered product available.
