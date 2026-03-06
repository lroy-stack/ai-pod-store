# Embroidery Design Specs — STSU177 (Catalog 479)

## Available Embroidery Placements

| Placement | Canvas (px) | DPI | Physical | Cost | Unlimited Color |
|---|---|---|---|---|---|
| `embroidery_chest_center` | 3000×1800 | 300 | 10"×6" | €2.95 | YES (+€3.25) |
| `embroidery_chest_left` | 1200×1200 | 300 | 4"×4" | €2.95 | YES (+€3.25) |
| `embroidery_wrist_left` | 600×900 | 300 | 2"×3" | €2.95 | NO |
| `embroidery_wrist_right` | 600×900 | 300 | 2"×3" | €2.95 | NO |

**Wrist printfile confirmed:** #396 (600×900 @300dpi) from printfiles endpoint.
**Chest dimensions from M2475 (cat 674) standard — shared across Printful hoodies.**

---

## Embroidery Design Constraints

- **Maximum 15 thread colors** per placement (standard) or **unlimited** for +€3.25 (chest only)
- **NO gradients** — solid thread colors ONLY
- **NO semi-transparency** — all fills 100% opaque
- **NO photographic elements** — flat shapes and lines only
- **Minimum line width**: 1.5mm (~18px @300dpi)
- **Minimum text height**: 5mm (~60px @300dpi)
- **Closed paths only** — SVG paths must end with `Z`
- **Simple geometry** — avoid intricate details and thin serifs

---

## Thread Color Selection

### 15 Standard Colors

| Hex | Name (ID) | Use on Dark | Use on Light |
|---|---|---|---|
| `#FFFFFF` | 1801 White | YES | NO |
| `#000000` | 1800 Black | NO | YES |
| `#96A1A8` | 1718 Grey | MAYBE | MAYBE |
| `#A67843` | 1672 Old Gold | YES | NO |
| `#FFCC00` | 1951 Gold | YES | NO |
| `#E25C27` | 1987 Orange | YES | NO |
| `#CC3366` | 1910 Flamingo | YES | NO |
| `#CC3333` | 1839 Red | YES | YES |
| `#660000` | 1784 Maroon | NO | YES |
| `#333366` | 1966 Navy | NO | YES |
| `#005397` | 1842 Royal | YES | YES |
| `#3399FF` | 1695 Aqua/Teal | YES | NO |
| `#6B5294` | 1832 Purple | YES | YES |
| `#01784E` | 1751 Kelly Green | YES | YES |
| `#7BA35A` | 1848 Kiwi Green | YES | NO |

### Unlimited Color Option

For chest placements only. Enable in variant options:
```json
{ "id": "unlimited_color", "value": true }
```
Adds +€3.25/unit per chest placement. Allows ANY number of thread colors.

### Recommended Combos for SKAPARA

1. **Kelly Green + Kiwi Green + White** on Black/French Navy — "Recycled" eco branding
2. **White only** on Black/French Navy — clean, minimal
3. **Black + Purple + Red** on White/Desert Dust — "Origin" style
4. **Navy + Kelly Green** on Desert Dust — earth tones
5. **Black only** on White — ultra minimal

---

## Thread Colors API Format

```json
{
  "options": [
    { "id": "thread_colors_chest_center", "value": ["#01784E", "#7BA35A", "#FFFFFF"] },
    { "id": "thread_colors_wrist_left", "value": ["#01784E"] },
    { "id": "thread_colors_wrist_right", "value": ["#01784E", "#7BA35A"] }
  ]
}
```

**With unlimited color:**
```json
{
  "options": [
    { "id": "unlimited_color", "value": true },
    { "id": "thread_colors_chest_center", "value": ["#01784E", "#7BA35A", "#FFFFFF", "#E25C27", "#CC3366"] },
    { "id": "thread_colors_wrist_left", "value": ["#01784E"] },
    { "id": "thread_colors_wrist_right", "value": ["#01784E", "#7BA35A"] }
  ]
}
```

**CRITICAL:** Option ID is `thread_colors_<placement>` WITHOUT `embroidery_` prefix.

---

## Existing Design Assets

### Recycled — Chest Center (1200×1200)

**File:** `frontend/public/brand-designs/recycled-embroidery/chest-center.svg`

| Property | Value |
|---|---|
| Canvas | 1200×1200 (designed for 4"×4" — chest_left canvas) |
| Thread colors | Kelly Green #01784E, Kiwi Green #7BA35A, White #FFFFFF |
| Content | Official SKAPARA S mark + "RECYCLED" text |
| Target garments | Black, French Navy |

**NOTE:** 1200×1200 matches `embroidery_chest_left`. For `embroidery_chest_center` (3000×1800), it will be centered in larger area.

### S Mark — Wrist Left/Right

Source: `frontend/public/brand/skapara-mark-white.svg`
Render at 600×900 @300dpi, 1 thread color.

---

## Rendering Embroidery PNGs from SVG

```bash
# Chest center (3000×1800 @300dpi)
magick -density 300 -background transparent \
  design-chest-center.svg \
  -resize 3000x1800 \
  PNG32:chest-center-3000x1800.png

# Chest left (1200×1200 @300dpi)
magick -density 300 -background transparent \
  design-chest-left.svg \
  -resize 1200x1200 \
  PNG32:chest-left-1200x1200.png

# Wrist (600×900 @300dpi)
magick -density 300 -background transparent \
  design-wrist.svg \
  -resize 600x900 \
  PNG32:wrist-600x900.png
```

---

## Anti-Patterns (DO NOT)

- **DO NOT** mix `embroidery_chest_center` with `embroidery_chest_left`
- **DO NOT** mix embroidery wrist with DTG sleeve
- **DO NOT** use gradients in embroidery designs
- **DO NOT** use data URLs for Printful uploads
- **DO NOT** forget `thread_colors_<placement>` options
- **DO NOT** use `embroidery_` prefix in thread_colors option ID
- **DO NOT** assume unlimited_color works for wrists — CHEST ONLY
- **DO NOT** use STSU177's DTG label_inside file (600×600) for embroidery products — irrelevant
- **DO NOT** iron on embroidery
- **DO NOT** skip GPSR — Supabase product_details (API endpoint returns 404)
