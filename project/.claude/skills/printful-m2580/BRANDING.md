# SKAPARA Branding Specification — M2580 PREMIUM Hoodie

Filosofia: **"No parece merch, parece marca."**

Conservativo. Reconocible. Escalable.

---

## Available Placements

M2580 has **8 placements** — the most of any SKAPARA blank:

| Placement | Canvas (px) | DPI | Extra Cost | Current Use | Notes |
|---|---|---|---|---|---|
| `front` / `default` | **1800 x 1800** | 150 | $0.00 | Main design | **SQUARE** canvas |
| `back` | 1800 x 2400 | 150 | +$5.25 | **NOT USED** | Saves $5.25/unit — file_id 950410495 available but not applied |
| `sleeve_left` | **450 x 1800** | 150 | +$2.20 | SKAPARA wordmark vertical | Rotated 90° CW — shared with M2480 |
| `sleeve_right` | 450 x 1800 | 150 | +$2.20 | Unused | Reserved for future |
| `label_outside` | 450 x 450 | 150 | +$2.20 | Unused | Mutually exclusive with `back` |
| `label_inside` | 750 x 750 | 300 | +$0.99 | **S mark isotipo** | Cotton Heritage exclusive — ACTIVE |
| `embroidery_wrist_left` | 600 x 900 | 300 | — | Unused | Embroidery, not DTG |
| `embroidery_wrist_right` | 600 x 900 | 300 | — | Unused | Embroidery, not DTG |

**`label_inside` is a Cotton Heritage exclusive** — available on both M2580 and MC1087. At only $0.99/unit, it is the cheapest branding placement. **ACTIVE in v3** with S mark isotipo at 750x750. Rendered file: `frontend/printful-ready/label-inside-smark-750x750.png` (8.8KB, shared with M2480).

**`embroidery_wrist` placements** are for embroidered elements (thread), not DTG prints. Potential future use for small S mark embroidery on premium tier.

**CONSTRAINT:** `back` and `label_outside` are mutually exclusive in Printful. In v3 we do NOT use `back` (saves $5.25/unit), so `label_outside` is technically available but currently unused.

---

## CRITICAL: Canvas Differences from MC1087 Tees

| Placement | MC1087 (Tee) | M2580 (Hoodie) | Compatible? |
|---|---|---|---|
| `front` | 1800 x 2400 (portrait) | **1800 x 1800 (square)** | NO — design must be adapted |
| `back` | 1800 x 2400 | 1800 x 2400 | Same canvas but **NOT USED in v3** (saves $5.25) |
| `sleeve_left` | 600 x 525 (landscape) | **450 x 1800 (vertical)** | NO — uses WORDMARK vertical (shared with M2480) |
| `label_inside` | 450 x 450 / 150 DPI | 750 x 750 / 300 DPI | NO — different dimensions and DPI (shared with M2480) |

**The MC1087 sleeve branding file (file_id: 950410444, 600x525) CANNOT be used on M2580.** A new 450x1800 vertical asset must be rendered and uploaded.

---

## Current Branding Setup

### Standard Rule (Design on Front) — v3

**Total extra branding cost: $3.19** (sleeve $2.20 + label $0.99) — down from $7.45 in v2

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `front` | Main design | Full canvas (**1800x1800**) | Centered — SQUARE canvas |
| `sleeve_left` | SKAPARA wordmark vertical (white) | 20% scale wordmark rotated 90° CW | Pre-rendered: `sleeve-left-wordmark-450x1800.png` (~11.8KB, shared with M2480) |
| `label_inside` | S mark isotipo (white) | **~240px** (32% of 750px) | Pre-rendered: `label-inside-smark-750x750.png` (8.8KB, shared with M2480) |
| `back` | — | — | **NOT USED** — saves $5.25/unit (file_id 950410495 available if needed) |
| `sleeve_right` | — | — | Unused |
| `embroidery_wrist_*` | — | — | Unused (potential future) |

### Exception: Design on Back

When the main design goes on the **back** instead of the front:

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `back` | Main design | Full canvas (1800x2400) | Centered — this IS a used placement when design goes on back |
| `sleeve_left` | SKAPARA wordmark vertical (white) | Full wordmark rotated 90° CW | Same pre-rendered file as standard rule |
| `label_inside` | S mark isotipo (white) | **~240px** (32% of 750px) | Same pre-rendered file as standard rule |
| `front` (left chest) | SKAPARA brandname | **~30%** scale | `x: 0.28, y: 0.22, scale: 0.3` (heart side) — adapted for 1800x1800 |
| `sleeve_right` | — | — | Unused |

---

## Branding Dimensions

### Sleeve — SKAPARA Wordmark Vertical (v3)

- Canvas: **450 x 1800 px** (VERTICAL — tall and narrow)
- Asset: SKAPARA wordmark at **20% scale**, rotated **90 degrees clockwise**
- The wordmark reads bottom-to-top when the arm hangs naturally
- Pre-rotation dimensions: **360px wide x ~37px tall** (20% width-based scale)
- Post-rotation dimensions: **~37px wide x 360px tall**
- Pre-rendered file: `frontend/printful-ready/sleeve-left-wordmark-450x1800.png` (~11.8KB)
- **Shared with M2480** — same file, same dimensions, same 20% scale
- Source file: `public/brand/skapara-wordmark-white.svg` (rotated during render)

> **CRITICAL: Width-based vs Height-based resize.**
> The wordmark SVG is extremely wide relative to its height (~9.7:1 aspect ratio).
> `-resize 360x` = **width** to 360px, height scales proportionally (~37px) = CORRECT (20% scale).
> `-resize x360` = **height** to 360px, width scales proportionally (~3500px) = WRONG (would be ~80% scale and clip outside canvas).
> Always use `-resize 360x` (width-based) for the sleeve wordmark.

**This is NOT the S mark isotipo.** The v3 branding uses the full SKAPARA wordmark rotated vertically, providing stronger brand recognition on the sleeve. The MC1087 sleeve file (600x525) cannot be reused here.

### Back — NOT USED in v3 (saves $5.25/unit)

- Canvas: 1800 x 2400 px (SAME as MC1087)
- **file_id 950410495 is available** but NOT applied in v3 branding layout
- Removing back branding reduces per-unit cost from $7.45 to $3.19
- If re-enabled in future: wordmark width 666px (37%), y=150px, `skapara-wordmark-white.svg`

### Left Chest — Wordmark (back-design products only)

- Canvas: shared with front (1800 x 1800)
- Printful position: `x: 0.28, y: 0.22, scale: 0.3`
- Visible size: ~540px wide (30% of 1800)
- NOTE: y=0.22 on 1800x1800 = 396px vs y=0.22 on 1800x2400 = 528px. The visual result is slightly higher on the hoodie front. Adjust if needed.

### Label Inside — S Mark (ACTIVE in v3)

- Canvas: **750 x 750 px** at **300 DPI**
- S mark width: **~240px** (32% of 750)
- Position: centered in 750x750
- Cost: $0.99/unit (cheapest placement)
- Pre-rendered file: `frontend/printful-ready/label-inside-smark-750x750.png` (8.8KB)
- **Shared with M2480** — same file, same dimensions
- NOTE: Higher resolution than MC1087's label_inside (450x450 at 150 DPI)

---

## Branding File IDs

### v3 Active Placements

| Placement | Rendered File | Canvas | File ID | Status |
|---|---|---|---|---|
| `sleeve_left` | `sleeve-left-wordmark-450x1800.png` (~11.8KB) | 450x1800 | TBD — upload and update this doc | Shared with M2480 |
| `label_inside` | `label-inside-smark-750x750.png` (8.8KB) | 750x750 | TBD — upload and update this doc | Shared with M2480 |

### NOT USED in v3

| Placement | File ID | Canvas | Notes |
|---|---|---|---|
| `back` | 950410495 (available) | 1800x2400 | **NOT applied** — saves $5.25/unit. Reusable from MC1087 if re-enabled. |

**After uploading the sleeve and label_inside assets, update this document with the assigned file_ids.**

**Rendered files are in `frontend/printful-ready/` and are shared with M2480 (same files, same dimensions).**

---

## Rendering Branding from SVG

### ImageMagick Commands

```bash
# 1. Sleeve (M2580 + M2480): SKAPARA wordmark at 20% scale, rotated 90° CW in 450x1800 vertical canvas
# CRITICAL: Use -resize 360x (WIDTH-based), NOT -resize x360 (height-based).
#   -resize 360x → 360px wide × ~37px tall (20% scale) = CORRECT
#   -resize x360 → ~3500px wide × 360px tall (80% scale) = WRONG — clips outside canvas
magick -density 300 -background none \
  public/brand/skapara-wordmark-white.svg \
  -resize 360x \
  -rotate 90 \
  PNG32:tmp-wordmark-rotated.png

magick -size 450x1800 xc:transparent \
  tmp-wordmark-rotated.png -gravity Center \
  -composite PNG32:printful-ready/sleeve-left-wordmark-450x1800.png

rm tmp-wordmark-rotated.png

# 2. Label Inside (M2580 + M2480): S mark 32% centered in 750x750
magick -density 300 -background none \
  public/brand/skapara-mark-white.svg \
  -resize 240x \
  -gravity center -extent 750x750 \
  PNG32:printful-ready/label-inside-smark-750x750.png

# 3. Back: NOT USED in v3 — saves $5.25/unit
# file_id 950410495 is available if back branding is re-enabled.
# To recreate if needed:
# magick -density 300 -background none \
#   public/brand/skapara-wordmark-white.svg \
#   -resize 666x \
#   PNG32:tmp-wordmark.png
# magick -size 1800x2400 xc:transparent \
#   tmp-wordmark.png -gravity North -geometry +0+150 \
#   -composite PNG32:printful-ready/back-wordmark-1800x2400.png
# rm tmp-wordmark.png
```

### Quality Rules

- **ALWAYS render from SVG** (never scale existing PNGs)
- **Density 300** for maximum rasterization quality
- **PNG32** format to preserve alpha channel (transparency)
- **Visually verify** against a dark background before uploading
- Source SVGs are in `/frontend/public/brand/`:
  - `skapara-mark-white.svg` (3967 bytes)
  - `skapara-wordmark-white.svg` (6190 bytes)

---

## Color Variants

| Garment Background | Sleeve Asset | Label Inside Asset | Back |
|---|---|---|---|
| Dark (Black, Navy Blazer, Charcoal Heather, Vintage Black, Maroon, Team Royal, Forest Green, Purple, Military Green) | `skapara-wordmark-white.svg` (rotated 90° CW) | `skapara-mark-white.svg` | NOT USED |
| Light (if enabled in future) | `skapara-wordmark-dark.svg` (rotated 90° CW) | `skapara-mark-dark.svg` | NOT USED |

Currently all active M2580 colors used are dark, so we always use the white variant. Both rendered files are shared with M2480.

---

## API: Applying Branding to Variants

### Bulk Update (All Variants at Once) — v3

```bash
curl -X PUT "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_variants": [
      {
        "id": SYNC_VARIANT_ID,
        "files": [
          {"type": "default", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": M2580_SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": M2580_LABEL_INSIDE_SMARK_FILE_ID}
        ]
      }
    ]
  }'
```

**NOTE: No `back` in files array.** This is intentional in v3 -- saves $5.25/unit.

### Per-Variant Update (Fallback)

```bash
curl -X PUT "https://api.printful.com/store/variants/${SYNC_VARIANT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"type": "default", "id": FRONT_DESIGN_FILE_ID},
      {"type": "sleeve_left", "id": M2580_SLEEVE_WORDMARK_FILE_ID},
      {"type": "label_inside", "id": M2580_LABEL_INSIDE_SMARK_FILE_ID}
    ]
  }'
```

Rate limit: `delay(2000)` between per-variant updates.

---

## Anti-Patterns (DO NOT)

- **DO NOT** reuse MC1087 sleeve file (950410444, 600x525) on M2580 sleeves (450x1800) -- wrong dimensions
- **DO NOT** use 1800x2400 front designs on M2580 -- front canvas is 1800x1800 SQUARE
- **DO NOT** use S mark isotipo on M2580 sleeves -- v3 uses SKAPARA WORDMARK rotated 90 degrees CW
- **DO NOT** include `back` in the files array -- v3 does NOT use back branding (saves $5.25/unit)
- **DO NOT** copy the front design to other positions -- each position has its own purpose
- **DO NOT** use gradients in DTG -- gradients only for stickers and drinkware
- **DO NOT** scale existing PNGs -- always render from source SVG
- **DO NOT** use `label_outside` + `back` together -- they are mutually exclusive in Printful
- **DO NOT** mix white and dark branding variants on the same product (all active M2580 colors are dark)
- **DO NOT** confuse `label_inside` dimensions -- M2580 is 750x750 at 300 DPI, MC1087 is 450x450 at 150 DPI
- **DO NOT** render separate sleeve/label files for M2580 and M2480 -- they share the same pre-rendered files
- **DO NOT** forget `label_inside` in the files array -- it is ACTIVE in v3 ($0.99/unit for brand presence)
