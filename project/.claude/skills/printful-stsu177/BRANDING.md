# SKAPARA Branding Specification — STSU177 ESSENTIAL ECO Hoodie

Filosofia: **"No parece merch, parece marca."**

Conservativo. Reconocible. Escalable.

---

## Available Placements

STSU177 has **5 DTG placements** + **4 embroidery placements**:

| Placement | Canvas (px) | DPI | Extra Cost | Current Use | Notes |
|---|---|---|---|---|---|
| `front` / `default` | **2100 x 2100** | 150 | $6.95 | Main design | **BIGGEST SQUARE** canvas |
| `back` | 1800 x 2400 | 150 | +$6.95 | Optional — back design or wordmark | Most expensive placement |
| `sleeve_left` | **450 x 1800** | 150 | +$6.95 | SKAPARA wordmark vertical | Same canvas as M2580/M2480 — files compatible |
| `sleeve_right` | 450 x 1800 | 150 | +$6.95 | Unused | Reserved for future |
| `label_inside` | **600 x 600** | 300 | +$1.50 | **S mark isotipo** | STSU177-specific — NOT shared with M2580 |

**Embroidery placements (separate technique, conflicts with DTG sleeves):**

| Placement | Canvas (px) | DPI | Physical | Notes |
|---|---|---|---|---|
| `embroidery_chest_left` | 1200 x 1200 | 300 | 4" x 4" | Conflicts with `embroidery_chest_center` |
| `embroidery_chest_center` | 3000 x 1800 | 300 | 10" x 6" | Conflicts with `embroidery_chest_left` |
| `embroidery_wrist_left` | 600 x 900 | 300 | 2" x 3" | Conflicts with `sleeve_left`/`sleeve_right` |
| `embroidery_wrist_right` | 600 x 900 | 300 | 2" x 3" | Conflicts with `sleeve_left`/`sleeve_right` |

**CONSTRAINT:** `sleeve_left`/`sleeve_right` (DTG) and `embroidery_wrist_left`/`embroidery_wrist_right` are mutually exclusive. Cannot mix DTG sleeves with embroidery wrists.

**CONSTRAINT:** `back` conflicts with `label_outside` and `back_large` — but neither exists in STSU177 DTG, so this is a non-issue.

---

## CRITICAL: Canvas Differences from M2580

| Placement | M2580 (PREMIUM Hoodie) | STSU177 (ECO Hoodie) | Compatible? |
|---|---|---|---|
| `front` | 1800 x 1800 (square) | **2100 x 2100 (bigger square)** | NO — STSU177 canvas is LARGER. M2580 designs can be upscaled, STSU177 designs must be downscaled for M2580 |
| `back` | 1800 x 2400 | 1800 x 2400 | YES — same canvas |
| `sleeve_left` | 450 x 1800 (vertical) | 450 x 1800 (vertical) | **YES — same canvas, files shared** |
| `label_inside` | 750 x 750 / 300 DPI | **600 x 600 / 300 DPI** | **NO — different dimensions, STSU177 needs own file** |

**The M2580 sleeve branding file (450x1800 wordmark) CAN be reused on STSU177.** Same canvas, same orientation.

**The M2580 `label_inside` file (750x750) CANNOT be used on STSU177.** STSU177 requires 600x600 @300DPI.

---

## Current Branding Setup

### Standard Rule (Design on Front) — v3

**Total extra branding cost: $8.45** (sleeve $6.95 + label $1.50)

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `front` | Main design | Full canvas (**2100x2100**) | Centered — BIGGEST SQUARE canvas |
| `sleeve_left` | SKAPARA wordmark vertical (white) | 20% scale wordmark rotated 90 degrees CW | Shared with M2580/M2480: `sleeve-left-wordmark-450x1800.png` (~11.8KB) |
| `label_inside` | S mark isotipo (white) | **~192px** (32% of 600px) | STSU177-specific: `label-inside-smark-600x600.png` |
| `back` | — | — | **NOT USED by default** — saves $6.95/unit. Can be added for back-design products. |
| `sleeve_right` | — | — | Unused |
| `embroidery_wrist_*` | — | — | Unused (potential future) |

### Exception: Design on Back

When the main design goes on the **back** instead of the front:

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `back` | Main design | Full canvas (1800x2400) | Centered — portrait canvas |
| `sleeve_left` | SKAPARA wordmark vertical (white) | Full wordmark rotated 90 degrees CW | Same shared file |
| `label_inside` | S mark isotipo (white) | **~192px** (32% of 600px) | Same STSU177-specific file |
| `front` (left chest) | SKAPARA brandname | **~30%** scale | `x: 0.28, y: 0.22, scale: 0.3` (heart side) — 30% of 2100 = ~630px visible |
| `sleeve_right` | — | — | Unused |

---

## Branding Dimensions

### Sleeve — SKAPARA Wordmark Vertical (shared with M2580/M2480)

- Canvas: **450 x 1800 px** (VERTICAL — tall and narrow)
- Asset: SKAPARA wordmark at **20% scale**, rotated **90 degrees clockwise**
- The wordmark reads bottom-to-top when the arm hangs naturally
- Pre-rotation dimensions: **360px wide x ~37px tall** (20% width-based scale)
- Post-rotation dimensions: **~37px wide x 360px tall**
- Pre-rendered file: `frontend/printful-ready/sleeve-left-wordmark-450x1800.png` (~11.8KB)
- **Shared with M2580 and M2480** — same file, same dimensions, same 20% scale
- Source file: `public/brand/skapara-wordmark-white.svg` (rotated during render)

> **CRITICAL: Width-based vs Height-based resize.**
> The wordmark SVG is extremely wide relative to its height (~9.7:1 aspect ratio).
> `-resize 360x` = **width** to 360px, height scales proportionally (~37px) = CORRECT (20% scale).
> `-resize x360` = **height** to 360px, width scales proportionally (~3500px) = WRONG (would be ~80% scale and clip outside canvas).
> Always use `-resize 360x` (width-based) for the sleeve wordmark.

### Back — NOT USED by default (saves $6.95/unit)

- Canvas: 1800 x 2400 px (SAME as M2580)
- **NOT applied by default** — saves $6.95/unit
- If back branding is desired, can reuse M2580's back wordmark file (same canvas: 1800x2400)
- If re-enabled: wordmark width 666px (37%), y=150px, `skapara-wordmark-white.svg`

### Left Chest — Wordmark (back-design products only)

- Canvas: shared with front (2100 x 2100)
- Printful position: `x: 0.28, y: 0.22, scale: 0.3`
- Visible size: ~630px wide (30% of 2100) — slightly larger than M2580's ~540px (30% of 1800)
- NOTE: y=0.22 on 2100x2100 = 462px from top. The visual result may differ slightly from M2580's 396px.

### Label Inside — S Mark (STSU177-specific)

- Canvas: **600 x 600 px** at **300 DPI**
- S mark width: **~192px** (32% of 600)
- Position: centered in 600x600
- Cost: $1.50/unit
- Pre-rendered file: `frontend/printful-ready/label-inside-smark-600x600.png`
- **NOT shared with M2580** — M2580 uses 750x750, STSU177 uses 600x600
- Source: `public/brand/skapara-mark-white.svg`

---

## Branding File IDs

### v3 Active Placements

| Placement | Rendered File | Canvas | File ID | Status |
|---|---|---|---|---|
| `sleeve_left` | `sleeve-left-wordmark-450x1800.png` (~11.8KB) | 450x1800 | Shared with M2580 — use same file_id | Shared with M2580/M2480 |
| `label_inside` | `label-inside-smark-600x600.png` | 600x600 | TBD — upload and update this doc | STSU177-specific |

### NOT USED by default

| Placement | File ID | Canvas | Notes |
|---|---|---|---|
| `back` | Reuse M2580 back file if enabled | 1800x2400 | **NOT applied by default** — saves $6.95/unit |

**After uploading the label_inside asset, update this document with the assigned file_id.**

---

## Rendering Branding from SVG

### ImageMagick Commands

```bash
# 1. Sleeve (shared with M2580/M2480): SKAPARA wordmark at 20% scale, rotated 90 degrees CW in 450x1800 vertical canvas
# SKIP IF ALREADY RENDERED for M2580/M2480 — same file, same dimensions.
# CRITICAL: Use -resize 360x (WIDTH-based), NOT -resize x360 (height-based).
magick -density 300 -background none \
  public/brand/skapara-wordmark-white.svg \
  -resize 360x \
  -rotate 90 \
  PNG32:tmp-wordmark-rotated.png

magick -size 450x1800 xc:transparent \
  tmp-wordmark-rotated.png -gravity Center \
  -composite PNG32:printful-ready/sleeve-left-wordmark-450x1800.png

rm tmp-wordmark-rotated.png

# 2. Label Inside (STSU177-specific): S mark 32% centered in 600x600
# NOTE: This is DIFFERENT from M2580's 750x750. Must render separately.
magick -density 300 -background none \
  public/brand/skapara-mark-white.svg \
  -resize 192x \
  -gravity center -extent 600x600 \
  PNG32:printful-ready/label-inside-smark-600x600.png

# 3. Back: NOT USED by default — saves $6.95/unit
# If back branding is re-enabled, reuse M2580's back wordmark file (same 1800x2400 canvas).
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
| Dark (Black, French Navy) | `skapara-wordmark-white.svg` (rotated 90 degrees CW) | `skapara-mark-white.svg` | NOT USED |
| Light (Desert Dust, White — if enabled in future) | `skapara-wordmark-dark.svg` (rotated 90 degrees CW) | `skapara-mark-dark.svg` | NOT USED |

Currently all active STSU177 colors used are dark, so we always use the white variant.

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
          {"type": "sleeve_left", "id": SHARED_SLEEVE_WORDMARK_FILE_ID},
          {"type": "label_inside", "id": STSU177_LABEL_INSIDE_SMARK_FILE_ID}
        ]
      }
    ]
  }'
```

**NOTE: No `back` in files array by default.** This is intentional — saves $6.95/unit. Add `{"type": "back", "id": BACK_FILE_ID}` only for back-design products.

### Per-Variant Update (Fallback)

```bash
curl -X PUT "https://api.printful.com/store/variants/${SYNC_VARIANT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"type": "default", "id": FRONT_DESIGN_FILE_ID},
      {"type": "sleeve_left", "id": SHARED_SLEEVE_WORDMARK_FILE_ID},
      {"type": "label_inside", "id": STSU177_LABEL_INSIDE_SMARK_FILE_ID}
    ]
  }'
```

Rate limit: `delay(2000)` between per-variant updates.

---

## Anti-Patterns (DO NOT)

- **DO NOT** reuse M2580 `label_inside` file (750x750) on STSU177 — STSU177 requires 600x600
- **DO NOT** reuse MC1087 sleeve file (600x525) on STSU177 sleeves (450x1800) — wrong dimensions
- **DO NOT** use 1800x1800 or 1800x2400 front designs on STSU177 front — front canvas is **2100x2100**
- **DO NOT** use S mark isotipo on STSU177 sleeves — v3 uses SKAPARA WORDMARK rotated 90 degrees CW
- **DO NOT** include `back` in the files array by default — v3 does NOT use back branding (saves $6.95/unit)
- **DO NOT** copy the front design to other positions — each position has its own purpose
- **DO NOT** use gradients in DTG — gradients only for stickers and drinkware
- **DO NOT** scale existing PNGs — always render from source SVG
- **DO NOT** mix DTG sleeves with embroidery wrists on the same product — they conflict
- **DO NOT** mix white and dark branding variants on the same product (all active colors are dark)
- **DO NOT** forget `label_inside` in the files array — it is ACTIVE in v3 ($1.50/unit for brand presence)
- **DO NOT** confuse `label_inside` dimensions — STSU177 is 600x600 @300DPI, M2580 is 750x750 @300DPI, MC1087 is 450x450 @150DPI. Each blank has its own label file.
- **DO NOT** assume STSU177 `front` cost is included — STSU177 charges $6.95 for `front` (unlike M2580/MC1087 which include it)
