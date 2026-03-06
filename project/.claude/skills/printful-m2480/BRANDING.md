# SKAPARA Branding Specification — M2480 PREMIUM Crewneck

Filosofia: **"No parece merch, parece marca."**

Conservativo. Reconocible. Escalable.

---

## Available Placements

M2480 has **8 placements** — the most of any Cotton Heritage blank:

| Placement | Canvas (px) | DPI | Extra Cost | Current Use | Notes |
|---|---|---|---|---|---|
| `front` / `default` | 1800 x 2400 | 150 | $0.00 | Main design | Always used |
| `back` | 1800 x 2400 | 150 | +$5.25 | **NOT USED (v3)** | Clean back, saves $5.25/unit |
| `sleeve_left` | **450 x 1800** | 150 | +$2.20 | SKAPARA wordmark (20%) | Always used |
| `sleeve_right` | 450 x 1800 | 150 | +$2.20 | Unused | Reserved for future |
| `label_outside` | 450 x 450 | 150 | +$2.20 | Unused | Mutually exclusive with `back` |
| `label_inside` | 750 x 750 | 300 | +$0.99 | Unused | Cheapest branding placement |
| `embroidery_wrist_left` | 600 x 900 | 300 | — | Unused | Embroidery option |
| `embroidery_wrist_right` | 600 x 900 | 300 | — | Unused | Embroidery option |

**`label_inside` opportunity:** At $0.99/unit, this is the cheapest branding placement available. Same as MC1087 and M2580. Potential future uses:
- S mark isotipo at 750x750 (note: M2480 label_inside is 750x750 at 300 DPI, vs MC1087's 450x450 at 150 DPI)
- Custom care label with SKAPARA branding
- QR code linking to product page or brand story

**CONSTRAINT:** `back` and `label_outside` are mutually exclusive in Printful. Since v3 does NOT use `back`, `label_outside` (450x450) is technically available as a future option.

---

## Current Branding Setup (v3 — Approved 2026-03-03)

### Standard Rule (Design on Front)

| Position | Asset | Size | Placement Details | Extra Cost |
|---|---|---|---|---|
| `front` | Main design | Full canvas (1800x2400) | Centered | $0.00 |
| `sleeve_left` | SKAPARA wordmark (white, vertical) | Rotated 90° CW, **20% scale** (360px text length, ~37px thick) | Centered in 450x1800 | +$2.20 |
| `label_inside` | S mark isotipo (white) | **32%** of canvas width (240px in 750px) | Centered in 750x750 | +$0.99 |
| `back` | — | — | Unused (clean back, no branding) | — |
| `sleeve_right` | — | — | Unused | — |
| **Total extra** | | | | **$3.19** |

**Rationale:** The 450x1800 vertical canvas is ideal for text running along the sleeve. At 20% scale, the wordmark is subtle and premium — legible but not dominant. The S mark (square-ish icon) fits naturally in the 750x750 label_inside. No back branding reduces cost by $5.25/unit and gives a cleaner look.

### Exception: Design on Back

When the main design goes on the **back** instead of the front:

| Position | Asset | Size | Placement Details | Extra Cost |
|---|---|---|---|---|
| `back` | Main design | Full canvas (1800x2400) | Centered | +$5.25 |
| `sleeve_left` | SKAPARA wordmark (white, vertical) | Rotated 90° CW, **20% scale** (360px text length) | Centered in 450x1800 | +$2.20 |
| `label_inside` | S mark isotipo (white) | **32%** of canvas width (240px) | Centered in 750x750 | +$0.99 |
| `front` (left chest) | SKAPARA brandname | **~30%** scale | `x: 0.28, y: 0.22, scale: 0.3` (heart side) | $0.00 |
| `sleeve_right` | — | — | Unused | — |

---

## Branding Dimensions

### Sleeve — SKAPARA Wordmark Vertical (VERTICAL CANVAS)

- Canvas: **450 x 1800 px** (tall/vertical — NOT 600x525 like MC1087 tees!)
- Wordmark SVG aspect ratio: ~10:1 (2040x208 viewBox)
- Rendered: width scaled to **360px** (20% of canvas height), then **rotated 90° CW**
- Pre-rotation: 360px wide × ~37px tall
- Post-rotation: ~37px wide × 360px tall → subtle, legible text along the sleeve
- Position: centered horizontal and vertical in 450x1800 canvas
- Text reads top-to-bottom (standard streetwear convention for left sleeve)
- Source file: `public/brand/skapara-wordmark-white.svg`

**CRITICAL:** The MC1087 sleeve file (950410444, 600x525) CANNOT be reused. A new 450x1800 PNG must be rendered and uploaded to Printful.

**Scale rationale (verified 2026-03-03):** 20% produces a subtle, premium look — the wordmark is legible but not dominant. Higher scales (40%+) look oversized on the crewneck sleeve. The SVG's 10:1 aspect ratio means width-based scaling (`-resize 360x`) is the correct approach; height-based scaling (`-resize xH`) explodes the width and produces an unusable result.

### Label Inside — S Mark Isotipo

- Canvas: **750 x 750 px** at **300 DPI** (larger and higher-res than MC1087's 450x450)
- S mark width: **240px** (32% of 750)
- S mark height: proportional (~185px based on SVG aspect ratio 1431:1100)
- Position: centered in 750x750
- Cost: **$0.99/unit** (cheapest branding placement)
- Source file: `public/brand/skapara-mark-white.svg`
- This is a DIFFERENT canvas than MC1087's label_inside (450x450 at 150 DPI)

### Back — NOT USED (v3 decision)

Back placement (+$5.25) is **not used** in the v3 branding layout. The clean back reduces cost and gives a less "merch" aesthetic. The wordmark branding moves to the sleeve (vertical).

**Note:** `back` and `label_outside` are mutually exclusive in Printful. Since we don't use `back`, `label_outside` (450x450) is technically available as a future option.

### Left Chest — Wordmark (back-design products only)

- Canvas: shared with front (1800 x 2400)
- Printful position: `x: 0.28, y: 0.22, scale: 0.3`
- Visible size: ~540px wide (30% of 1800)
- This places the brandname on the left chest, heart side
- Only used when the main design is on the back

---

## v3 Branding File IDs

| Placement | File ID | Canvas | Status | Notes |
|---|---|---|---|---|
| `sleeve_left` | **950653078** | 450x1800 | Active | SKAPARA wordmark vertical (20% scale) |
| `label_inside` | **950649786** | 750x750 | **DASHBOARD ONLY** | S mark isotipo — API rejects, add via dashboard |
| `back` | ~~950410495~~ | 1800x2400 | **NOT USED in v3** | Available if back branding is reinstated |

**Rendered PNGs** in `frontend/printful-ready/`:
- `sleeve-left-wordmark-450x1800.png` (11.8KB) — file_id 950653078 (20% scale, verified 2026-03-03)
- `label-inside-smark-750x750.png` (8.8KB) — file_id 950649786

**API LIMITATION (verified 2026-03-03):** `label_inside` placement is rejected by the Printful sync product API (both POST /store/products and PUT /store/variants) with error "Unsupported file type: label_inside". Despite being listed as a valid placement for catalog 411, it can ONLY be added through the Printful dashboard UI. After creating each product via API, manually add label_inside in: Dashboard → Products → Edit → Inside label → Upload `label-inside-smark-750x750.png`.

---

## Rendering Branding from SVG

### ImageMagick Commands

```bash
# 1. Sleeve: SKAPARA wordmark rotated 90° CW in 450x1800 vertical canvas (20% scale)
# CRITICAL: Use width-based resize (-resize Wx), NOT height-based (-resize xH)
# The SVG is 10:1 ratio (2040x208). Height-based explodes width to ~14000px = unusable
magick -density 300 -background none \
  public/brand/skapara-wordmark-white.svg \
  -resize 360x \
  -rotate 90 \
  -gravity center -extent 450x1800 \
  PNG32:printful-ready/sleeve-left-wordmark-450x1800.png

# 2. Label Inside: S mark 32% centered in 750x750
magick -density 300 -background none \
  public/brand/skapara-mark-white.svg \
  -resize 240x \
  -gravity center -extent 750x750 \
  PNG32:printful-ready/label-inside-smark-750x750.png

# 3. Back (NOT USED in v3, kept for reference if reinstated)
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

| Garment Background | Sleeve Asset (wordmark) | Label Inside Asset (S mark) |
|---|---|---|
| Dark (Black, Navy Blazer, Charcoal Heather, Team Royal, Vintage Black, Forest Green) | `skapara-wordmark-white.svg` | `skapara-mark-white.svg` |
| Light (if enabled in future) | `skapara-wordmark-dark.svg` | `skapara-mark-dark.svg` |

Currently all active M2480 colors are dark, so we always use the white variant.

---

## API: Applying Branding to Variants

### At Product Creation (POST /store/products)

Files are assigned per-variant in the `sync_variants` array.
**NOTE:** Do NOT include `label_inside` — API rejects it. Add via dashboard after creation.

```json
{
  "sync_product": { "name": "Product Name" },
  "sync_variants": [
    {
      "variant_id": 11254,
      "retail_price": "49.99",
      "is_enabled": true,
      "files": [
        { "type": "front", "id": FRONT_DESIGN_FILE_ID },
        { "type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID }
      ]
    }
  ]
}
```

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
          {"type": "front", "id": FRONT_DESIGN_FILE_ID},
          {"type": "sleeve_left", "id": SLEEVE_WORDMARK_FILE_ID}
        ]
      }
    ]
  }'
```

Rate limit: `delay(2000)` between API calls.

**Post-creation:** Add `label_inside` (S mark isotipo, file_id 950649786) manually via Printful Dashboard → Products → Edit → Inside label.

---

## Anti-Patterns (DO NOT)

- **DO NOT** put S mark on the sleeve — the 450x1800 vertical canvas is for the wordmark (v3 decision)
- **DO NOT** copy the front design to other positions — each placement has its own purpose
- **DO NOT** use gradients in DTG — gradients only for stickers and drinkware
- **DO NOT** scale existing PNGs — always render from source SVG at density 300
- **DO NOT** use `label_outside` + `back` together — they are mutually exclusive in Printful
- **DO NOT** mix white and dark branding variants on the same product (all active M2480 colors are dark)
- **DO NOT** reuse MC1087 sleeve branding (600x525) for M2480 — canvas is 450x1800, a completely different aspect ratio
- **DO NOT** confuse M2480 label_inside (750x750 @ 300 DPI) with MC1087 label_inside (450x450 @ 150 DPI)
- **DO NOT** use back branding unless specifically reinstated — v3 layout omits back for cost savings ($5.25/unit)
