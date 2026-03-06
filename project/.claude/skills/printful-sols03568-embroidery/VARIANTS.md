# SOL'S 03568 Eco Raglan Hoodie Embroidery Variant Reference — Catalog 543

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 543 (same as DTG/DTFilm) |
| **Technique** | Embroidery |
| **Total Colors** | 6 (Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White) |
| **Total Sizes** | 7 (XS, S, M, L, XL, 2XL, 3XL) |
| **Total Variants** | 42 (6 colors x 7 sizes) |
| **EU Fulfillment** | ALL variants — Latvia |
| **Base Cost Range** | 35.20-42.25 EUR |
| **Embroidery Cost** | +2.95 EUR per placement |

---

## ALL Colors (Embroidery supports all)

Embroidery thread provides contrast on any garment color. All colors are viable.

### Black `#000000`

| Size | Catalog Variant ID | Base Cost | + 3x Emb | Total |
|---|---|---|---|---|
| XS | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| S | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| M | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| L | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| XL | TBD-API-QUERY | 37.50 | +8.85 | 46.35 |
| 2XL | TBD-API-QUERY | 39.85 | +8.85 | 48.70 |
| 3XL | TBD-API-QUERY | 42.25 | +8.85 | 51.10 |

### Bottle Green `#1A472A`

| Size | Catalog Variant ID | Base Cost | + 3x Emb | Total |
|---|---|---|---|---|
| XS | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| S | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| M | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| L | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| XL | TBD-API-QUERY | 37.50 | +8.85 | 46.35 |
| 2XL | TBD-API-QUERY | 39.85 | +8.85 | 48.70 |
| 3XL | TBD-API-QUERY | 42.25 | +8.85 | 51.10 |

### Burgundy `#800020`

| Size | Catalog Variant ID | Base Cost | + 3x Emb | Total |
|---|---|---|---|---|
| XS | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| S | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| M | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| L | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| XL | TBD-API-QUERY | 37.50 | +8.85 | 46.35 |
| 2XL | TBD-API-QUERY | 39.85 | +8.85 | 48.70 |
| 3XL | TBD-API-QUERY | 42.25 | +8.85 | 51.10 |

### Burnt Orange `#CC5500`

| Size | Catalog Variant ID | Base Cost | + 3x Emb | Total |
|---|---|---|---|---|
| XS | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| S | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| M | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| L | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| XL | TBD-API-QUERY | 37.50 | +8.85 | 46.35 |
| 2XL | TBD-API-QUERY | 39.85 | +8.85 | 48.70 |
| 3XL | TBD-API-QUERY | 42.25 | +8.85 | 51.10 |

### Charcoal Melange `#4A4A4A`

| Size | Catalog Variant ID | Base Cost | + 3x Emb | Total |
|---|---|---|---|---|
| XS | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| S | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| M | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| L | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| XL | TBD-API-QUERY | 37.50 | +8.85 | 46.35 |
| 2XL | TBD-API-QUERY | 39.85 | +8.85 | 48.70 |
| 3XL | TBD-API-QUERY | 42.25 | +8.85 | 51.10 |

### White `#FFFFFF`

| Size | Catalog Variant ID | Base Cost | + 3x Emb | Total |
|---|---|---|---|---|
| XS | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| S | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| M | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| L | TBD-API-QUERY | 35.20 | +8.85 | 44.05 |
| XL | TBD-API-QUERY | 37.50 | +8.85 | 46.35 |
| 2XL | TBD-API-QUERY | 39.85 | +8.85 | 48.70 |
| 3XL | TBD-API-QUERY | 42.25 | +8.85 | 51.10 |

---

## How to Get Variant IDs

Variant IDs are shared across techniques for the same catalog:

```bash
curl -s "https://api.printful.com/v2/catalog-products/543/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

---

## Embroidery Placement Costs

| Placement | Canvas @300dpi | Cost |
|---|---|---|
| `embroidery_chest_center` | 3000x1800 | +2.95 EUR |
| `embroidery_chest_left` | 1200x1200 | +2.95 EUR |
| `embroidery_wrist_left` | 600x900 (PF#396) | +2.95 EUR |
| `embroidery_wrist_right` | 600x900 (PF#396) | +2.95 EUR |

**CRITICAL:** `chest_center` and `chest_left` are MUTUALLY EXCLUSIVE.

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

| Color | Slug | Dark? | Recommended Thread |
|---|---|---|---|
| Black | `black` | YES | White, Gold, Kiwi Green |
| Bottle Green | `bottle-green` | YES | White, Gold |
| Burgundy | `burgundy` | YES | White, Gold, Grey |
| Burnt Orange | `burnt-orange` | MEDIUM | White, Black — test contrast with both |
| Charcoal Melange | `charcoal-melange` | YES | White, Gold, Kiwi Green |
| White | `white` | NO | Black, Navy, Royal, Maroon |
