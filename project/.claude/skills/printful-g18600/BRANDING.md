# SKAPARA Branding Specification — G18600 STANDARD Zip Hoodie

Filosofia: **"No parece merch, parece marca."**

Conservativo. Reconocible. Escalable.

---

## Available Placements

G18600 has **7 placements** — including embroidery wrist options:

| Placement | Canvas (px) | Extra Cost | Current Use | Notes |
|---|---|---|---|---|
| `front` / `default` | **2250 x 1500** | $0.00 | Main design | **LANDSCAPE** — zipper splits center! |
| `back` | 1800 x 2400 | +$5.25 | **NOT USED** | Saves $5.25/unit |
| `sleeve_left` | 450 x 1800 | +$2.20 | SKAPARA wordmark vertical | **VERTICAL** — rotated 90° CW |
| `sleeve_right` | 450 x 1800 | +$2.20 | Unused | Reserved for future |
| `label_outside` | **600 x 600** | +$2.20 | Unused | Larger than MC1087's 450x450 |
| `embroidery_wrist_left` | 600 x 900 | — | Unused | 300 DPI embroidery |
| `embroidery_wrist_right` | 600 x 900 | — | Unused | 300 DPI embroidery |

**NO `label_inside`** — unlike MC1087, the G18600 does not have an inside label placement.

**NO `label_outside`** — G18600 does not have label_inside or label_outside placements available for branding.

**v3 Branding**: Only `sleeve_left` is used for branding (+$2.20/unit total). Back is NOT used — saves $5.25/unit.

---

## CRITICAL: Landscape Front Canvas

The G18600 front canvas is **2250x1500px (LANDSCAPE)** — NOT portrait like t-shirts. The metal zipper runs down the center of the garment, splitting the front into two halves.

### Design Strategies for the Zip Split

**Strategy 1: Avoid the center (RECOMMENDED)**
Place the design on one side only — left chest (heart side) is the most natural.
- Design area: roughly the left or right 40% of the canvas
- Safe zone: keep the main design at least 200px away from the center line (x=1125)

**Strategy 2: Split design**
Create a design that works when separated by the zipper. Examples:
- Mirrored/symmetrical designs that look intentional when split
- Text that reads across both sides (the zipper becomes part of the design)
- Abstract patterns where the break is aesthetic

**Strategy 3: Full-width but zip-tolerant**
Large designs that span the full front, but where the center zip doesn't destroy readability.
- Works best with graphic/illustrative designs, NOT text-heavy designs
- The zip line will cut through approximately 30-40px of design width

### Center Line Reference

```
Canvas: 2250px wide
Center (zip): x = 1125px
Left half:  x = 0 to 1125
Right half: x = 1125 to 2250
Safe margins: 100px from edges, 200px from center
```

---

## Current Branding Setup

### Standard Rule (v3 — Design on Front)

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `front` | Main design | Varies — LANDSCAPE 2250x1500 | See zip strategies above |
| `sleeve_left` | SKAPARA wordmark vertical (white) | **20% scale** (360px text length, ~37px thick), rotated 90° CW | Centered in 450x1800, reads bottom-to-top |
| `back` | — | — | **NOT USED** — saves $5.25/unit |
| `sleeve_right` | — | — | Unused |
| `label_outside` | — | — | Not available on G18600 |

**Total branding cost: +$2.20/unit** (sleeve_left only)

### Exception: Design on Back

When the main design goes on the **back** instead of the front:

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `back` | Main design | Full canvas (1800x2400) | Centered (+$5.25 for this placement) |
| `sleeve_left` | SKAPARA wordmark vertical (white) | **20% scale** (360px text length), rotated 90° CW | Centered in 450x1800 |
| `front` (left chest) | SKAPARA brandname | ~25% scale | Placed in left 40% of landscape canvas, avoiding center zip |
| `sleeve_right` | — | — | Unused |

---

## Branding Dimensions

### Sleeve — SKAPARA Wordmark Vertical (450x1800)

**v3 Branding**: The sleeve now uses the SKAPARA **wordmark** (not the S mark isotipo), rotated 90° clockwise so it reads bottom-to-top along the sleeve.

- Canvas: 450 x 1800 px (vertical orientation)
- **Scale: 20%** — width-based resize to 360px (`-resize 360x`)
- Pre-rotation dimensions: 360px wide x ~37px tall
- Post-rotation dimensions: ~37px wide x 360px tall (rotated 90° CW)
- Pre-rendered file: `frontend/printful-ready/sleeve-left-wordmark-450x1800.png` (11.8KB)
- Shared with M2480/M2580 — same file, same dimensions
- Wordmark is rotated 90° CW and centered in the canvas
- Source file: `public/brand/skapara-wordmark-white.svg` (rendered rotated)

**Scale rationale (verified 2026-03-03):** 20% produces a subtle, premium look — the wordmark is legible but not dominant. Higher scales (40%+) look oversized on the zip hoodie sleeve. The SVG's ~10:1 aspect ratio means width-based scaling (`-resize 360x`) is the correct approach; height-based scaling (`-resize xH`) explodes the width and produces an unusable result.

### Back — NOT USED

- Canvas: 1800 x 2400 px
- **NOT USED in v3** — saves $5.25/unit
- No branding file needed for back placement

### Label Inside / Label Outside — NOT AVAILABLE

- G18600 does **not** have `label_inside` or `label_outside` placements
- The only branding placement is `sleeve_left`

---

## Branding File IDs (Pre-Uploaded)

| Placement | File ID | Canvas | Notes |
|---|---|---|---|
| `sleeve_left` | **TBD** | 450x1800 | Wordmark vertical (20% scale, rotated 90° CW) — shared with M2480/M2580 |
| `back` | **NOT USED** | 1800x2400 | No back branding in v3 — saves $5.25/unit |

**Pre-rendered file:** `frontend/printful-ready/sleeve-left-wordmark-450x1800.png` (11.8KB) — upload to Printful File Library and record the File ID.

**IMPORTANT:** The MC1087 sleeve branding file (ID 950410444, 600x525) CANNOT be used for G18600. The G18600 sleeve canvas is 450x1800 (vertical).

---

## Rendering Branding from SVG

### ImageMagick Commands

```bash
# 1. Sleeve: SKAPARA wordmark rotated 90° CW in 450x1800 vertical canvas (20% scale)
# CRITICAL: Use width-based resize (-resize Wx), NOT height-based (-resize xH)
# The SVG has ~10:1 aspect ratio — height-based resize explodes the width!
# This file is SHARED with M2480/M2580 — render once, use for all three products
magick -density 300 -background none \
  public/brand/skapara-wordmark-white.svg \
  -resize 360x \
  -rotate 90 \
  PNG32:tmp-wordmark-rotated.png

# Pre-rotation: 360px wide × ~37px tall
# Post-rotation: ~37px wide × 360px tall

magick -size 450x1800 xc:transparent \
  tmp-wordmark-rotated.png -gravity Center \
  -composite PNG32:printful-ready/sleeve-left-wordmark-450x1800.png

rm tmp-wordmark-rotated.png

# Back: NOT USED in v3 — no command needed (saves $5.25/unit)
# Label: NOT AVAILABLE on G18600 — no command needed
```

### Quality Rules

- **ALWAYS render from SVG** (never scale existing PNGs)
- **Density 300** for maximum rasterization quality
- **PNG32** format to preserve alpha channel (transparency)
- **Visually verify** against a dark background before uploading
- **Pre-rendered file available**: `frontend/printful-ready/sleeve-left-wordmark-450x1800.png` (11.8KB)
- Source SVG for sleeve wordmark: `/frontend/public/brand/skapara-wordmark-white.svg` (6190 bytes)

---

## Color Variants

| Garment Background | Sleeve Asset | Back |
|---|---|---|
| Dark (Black, Navy, Dark Heather) | `sleeve-left-wordmark-450x1800.png` (white) | NOT USED |
| Medium (Royal) | `sleeve-left-wordmark-450x1800.png` (white) | NOT USED |
| Light (if enabled in future) | Needs dark variant render | NOT USED |

All active EU dark colors use the white wordmark variant. Royal (L=79) is dark enough for white branding.

**Single rendered file** covers all current dark/medium variants: `frontend/printful-ready/sleeve-left-wordmark-450x1800.png`

---

## API: Applying Branding to Variants

### Bulk Update (All Variants at Once)

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
          {"type": "sleeve_left", "id": SLEEVE_LEFT_WORDMARK_FILE_ID}
        ]
      }
    ]
  }'
```

**v3: Only 2 files per variant** — `default` (front design) + `sleeve_left` (wordmark vertical). No back, no label.

### Per-Variant Update (Fallback)

```bash
curl -X PUT "https://api.printful.com/store/variants/${SYNC_VARIANT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"type": "default", "id": FRONT_DESIGN_FILE_ID},
      {"type": "sleeve_left", "id": SLEEVE_LEFT_WORDMARK_FILE_ID}
    ]
  }'
```

Rate limit: `delay(2000)` between per-variant updates.

---

## Anti-Patterns (DO NOT)

- **DO NOT** place text across the center zip line — it will be unreadable when the zipper splits it
- **DO NOT** use the MC1087 sleeve file (950410444, 600x525) — G18600 sleeve is 450x1800 vertical
- **DO NOT** use S mark isotipo on sleeve — v3 uses SKAPARA wordmark vertical (rotated 90° CW)
- **DO NOT** add back branding — v3 deliberately omits back to save $5.25/unit
- **DO NOT** add `label_inside` or `label_outside` — G18600 does not have these placements
- **DO NOT** include `{"type": "back", ...}` in the files array — only `default` + `sleeve_left`
- **DO NOT** copy the front design to the sleeve — sleeve is ONLY for the SKAPARA wordmark
- **DO NOT** use gradients in DTG — gradients only for stickers and drinkware
- **DO NOT** scale existing PNGs — always render from source SVG (or use the pre-rendered file)
- **DO NOT** mix white and dark branding variants on the same product (all active G18600 dark colors use white)
- **DO NOT** design for portrait orientation (1800x2400) — the G18600 front is LANDSCAPE (2250x1500)
- **DO NOT** render a separate sleeve file per product — `sleeve-left-wordmark-450x1800.png` is shared with M2480/M2580
