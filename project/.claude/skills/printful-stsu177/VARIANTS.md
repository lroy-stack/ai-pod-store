# STSU177 Variant Reference — Stanley/Stella STSU177 (Catalog 479)

Complete variant table for the Stanley/Stella STSU177 ESSENTIAL ECO pullover hoodie blank on Printful.

---

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 479 |
| **Total Colors** | 4 |
| **Total Sizes** | 5 (S through 2XL) |
| **Total Variants** | 20 (4 colors x 5 sizes) |
| **Dark (always use)** | 2 colors (Black, French Navy) |
| **Light/Disabled** | 2 colors (Desert Dust, White) |
| **EU Available** | 4/4 (100%) |
| **Sizing Note** | EU sizes shown — US customers should order one size UP |
| **Material** | 100% organic cotton (GOTS, OCS, OEKO-TEX Standard 100, PETA-Approved Vegan) |

---

## DARK Colors (ALWAYS USE)

These 2 colors provide high contrast for white text and light-colored designs. Both should be included in **every** STSU177 product unless the design has a specific color conflict.

### Black `#0b0b0b` — L=11

| Size | Catalog Variant ID |
|---|---|
| S | 12372 |
| M | 12373 |
| L | 12374 |
| XL | 12375 |
| 2XL | 12376 |

### French Navy `#071429` — L=20

| Size | Catalog Variant ID |
|---|---|
| S | 12387 |
| M | 12388 |
| L | 12389 |
| XL | 12390 |
| 2XL | 12391 |

---

## LIGHT Colors (DISABLED — DO NOT USE FOR WHITE TEXT DESIGNS)

White text is invisible or low-contrast on these colors. Disabled by default for all SKAPARA products with white/ghost text designs. Both are EU available.

### Desert Dust `#dcccb4` — L=204 — EU: YES

| Size | Catalog Variant ID |
|---|---|
| S | 12382 |
| M | 12383 |
| L | 12384 |
| XL | 12385 |
| 2XL | 12386 |

### White `#ffffff` — L=255 — EU: YES

| Size | Catalog Variant ID |
|---|---|
| S | 12402 |
| M | 12403 |
| L | 12404 |
| XL | 12405 |
| 2XL | 12406 |

---

## Quick-Reference: Dark Variant IDs

For copy-paste into API calls and scripts:

### Black (all sizes)
```
12372, 12373, 12374, 12375, 12376
```

### French Navy (all sizes)
```
12387, 12388, 12389, 12390, 12391
```

### All 10 dark variant IDs (flat array)
```
12372, 12373, 12374, 12375, 12376,
12387, 12388, 12389, 12390, 12391
```

---

## Quick-Reference: Light/Disabled Variant IDs

### Desert Dust (all sizes)
```
12382, 12383, 12384, 12385, 12386
```

### White (all sizes)
```
12402, 12403, 12404, 12405, 12406
```

### All 10 light/disabled variant IDs (flat array)
```
12382, 12383, 12384, 12385, 12386,
12402, 12403, 12404, 12405, 12406
```

---

## Base Costs by Size (DTG)

| Size | Base Cost |
|---|---|
| S | $44.75 |
| M | $44.75 |
| L | $44.75 |
| XL | $44.75 |
| 2XL | $46.25 |

### Placement Costs (DTG)

| Placement | Cost |
|---|---|
| front | $6.95 |
| back | $6.95 |
| sleeve_left | $6.95 |
| sleeve_right | $6.95 |
| label_inside | $1.50 |

---

## Variant ID to Color Slug Mapping

Used for mockup file naming and Supabase Storage paths:

| Color | Slug | First Variant ID (S) | Luminance | Dark? | EU |
|---|---|---|---|---|---|
| Black | `black` | 12372 | 11 | YES | YES |
| French Navy | `french-navy` | 12387 | 20 | YES | YES |
| Desert Dust | `desert-dust` | 12382 | 204 | NO | YES |
| White | `white` | 12402 | 255 | NO | YES |

---

## Thread Colors (Embroidery — 15 colors)

Available for embroidery placements (`embroidery_chest_left`, `embroidery_chest_center`, `embroidery_wrist_left`, `embroidery_wrist_right`). `unlimited_color` option available for chest placements.

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

## Placement Conflicts

| Placement | Conflicts With |
|---|---|
| `back` | `label_outside`, `back_large` |
| `label_inside` | `label_outside` |
| `sleeve_left` | `embroidery_wrist_left`, `embroidery_wrist_right` |
| `sleeve_right` | `embroidery_wrist_left`, `embroidery_wrist_right` |
| `embroidery_chest_left` | `embroidery_chest_center`, `embroidery_chest_right` |

**NOTE:** `back_large`, `label_outside`, and `embroidery_chest_right` are NOT available in STSU177 DTG placements — conflicts listed for completeness.

---

## Comparison: STSU177 vs M2580 vs MC1087

| Property | STSU177 (ECO Hoodie) | M2580 (PREMIUM Hoodie) | MC1087 (PREMIUM Tee) |
|---|---|---|---|
| Catalog ID | 479 | 380 | 917 |
| Product type | Pullover Hoodie | Pullover Hoodie | T-Shirt |
| Tier | ESSENTIAL ECO | PREMIUM | PREMIUM |
| Material | 100% organic cotton | Cotton/poly blend | 100% cotton |
| Total colors | 4 | 23 | 5 |
| Dark colors | 2 (Black, French Navy) | 9 (Black, Navy Blazer + 7 extended) | 3 (Black, Navy Blazer, Vintage Black) |
| Sizes | S-2XL (5) | S-3XL (6) | S-4XL (7) |
| Front canvas | **2100x2100** (biggest) | 1800x1800 | 1800x2400 (portrait) |
| Sleeve canvas | 450x1800 (same) | 450x1800 (same) | 600x525 (landscape) |
| `label_inside` | **600x600** / 300 DPI | 750x750 / 300 DPI | 450x450 / 150 DPI |
| `label_inside` cost | $1.50 | $0.99 | $0.99 |
| Base cost S-XL | **$44.75** (highest) | $22.55 | $14.75 |
| Placement cost (front) | $6.95 | $0.00 (included) | $0.00 (included) |
| DTF in EU | YES | No | No |
| Fit | Regular | Classic streetwear | Boxy / structured |
| Sizing | EU (order UP) | Runs small (order UP) | Standard |
| Certifications | GOTS, OCS, OEKO-TEX, PETA | REACH, OEKO-TEX | REACH, OEKO-TEX |

**CRITICAL:** M2580 sleeve branding files (450x1800) ARE compatible with STSU177 sleeves (same 450x1800 canvas). However, M2580 `label_inside` files (750x750) are NOT compatible with STSU177 `label_inside` (600x600). Each needs its own label file.
