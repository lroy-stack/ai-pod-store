# SKAPARA Branding Specification — MC1087 PREMIUM Tier

Filosofia: **"No parece merch, parece marca."**

Conservativo. Reconocible. Escalable.

---

## Available Placements

MC1087 has **6 placements** — one more than CC1717:

| Placement | Canvas (px) | Extra Cost | Current Use | Notes |
|---|---|---|---|---|
| `front` / `default` | 1800 x 2400 | $0.00 | Main design | Always used |
| `back` | 1800 x 2400 | +$5.25 | **Unused** | Mutually exclusive with label_outside |
| `sleeve_left` | 600 x 525 | +$2.20 | S mark isotipo | Always used |
| `sleeve_right` | 600 x 525 | +$2.20 | Unused | Reserved for future |
| `label_inside` | 450 x 450 | +$0.99 | Unused | **UNIQUE to MC1087** |
| `label_outside` | 450 x 450 | +$2.20 | SKAPARA wordmark (neck label) | Always used |

**`label_inside` is MC1087's unique advantage** over CC1717. At only $0.99/unit, it is the cheapest branding placement. Potential future uses:
- S mark isotipo at 450x450
- Custom care label with SKAPARA branding
- QR code linking to product page or brand story

**CONSTRAINT:** `back` and `label_outside` are mutually exclusive in Printful. We use `label_outside` for the SKAPARA wordmark (neck label, ~18% of visible garment width). This saves $3.05/unit vs `back`.

---

## Current Branding Setup

### Standard Rule (Design on Front)

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `front` | Main design | Full canvas (1800x2400) | Centered |
| `sleeve_left` | S mark isotipo (white) | **32%** of canvas width (192px in 600px) | Centered in 600x525 |
| `label_outside` | SKAPARA wordmark (white) | **~18%** of visible garment width | Neck label, centered in 450x450 |
| `sleeve_right` | — | — | Unused |
| `label_inside` | — | — | Unused (potential future) |

### Exception: Design on Back

When the main design goes on the **back** instead of the front:

| Position | Asset | Size | Placement Details |
|---|---|---|---|
| `back` | Main design | Full canvas (1800x2400) | Centered |
| `sleeve_left` | S mark isotipo (white) | **32%** of canvas width (192px) | Centered in 600x525 |
| `label_outside` | SKAPARA wordmark (white) | **~18%** of garment | Neck label (always present) |
| `front` (left chest) | SKAPARA brandname | **~30%** scale | `x: 0.28, y: 0.22, scale: 0.3` (heart side) |
| `sleeve_right` | — | — | Unused |
| `label_inside` | — | — | Unused |

---

## Branding Dimensions

### Sleeve — S Mark

- Canvas: 600 x 525 px
- S mark width: **192px** (32% of 600)
- S mark height: proportional (~148px based on SVG aspect ratio)
- Position: centered vertical and horizontal
- Visual margin: minimum 12-15% around the mark
- Source file: `public/brand/skapara-mark-white.svg`

### Label Outside — Wordmark (Neck Label)

- Canvas: 450 x 450 px
- Size: **~18%** of visible garment width — subtle, luxury-brand feel
- Position: outer nape of the neck, centered in the 450x450 canvas
- Source file: `public/brand/skapara-wordmark-white.svg`
- File ID: **951280113** (`label-outside-wordmark-450x450.png`)
- Reference mockup: `public/brand/dangerous-flag-back-mockup.png`

### Left Chest — Wordmark (back-design products only)

- Canvas: shared with front (1800 x 2400)
- Printful position: `x: 0.28, y: 0.22, scale: 0.3`
- Visible size: ~540px wide (30% of 1800)
- This places the brandname on the left chest, heart side

### Label Inside (future) — S Mark

- Canvas: 450 x 450 px
- S mark width: **~144px** (32% of 450)
- Position: centered in 450x450
- Cost: $0.99/unit (cheapest placement)

---

## v2 Branding File IDs (Pre-Uploaded)

These branding assets are already uploaded to the Printful File Library and can be reused across all MC1087 products:

| Placement | File ID | Preview URL |
|---|---|---|
| `sleeve_left` | **950410444** | `files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png` |
| `label_outside` | **951280113** | `files.cdn.printful.com/files/701/701ca6a13818e0063bfb4652165fcabb_preview.png` |

These are the same file IDs used for CC1717 — branding assets are shared across both tiers since both use white SVG assets on dark garments.

---

## Rendering Branding from SVG

### ImageMagick Commands

```bash
# 1. Sleeve: S mark 32% centered in 600x525
magick -density 300 -background none \
  public/brand/skapara-mark-white.svg \
  -resize 192x \
  -gravity center -extent 600x525 \
  PNG32:printful-ready/sleeve-left-600x525.png

# 2. Label Outside: Wordmark centered in 450x450
magick -density 300 -background none \
  public/brand/skapara-wordmark-white.svg \
  -resize 81x \
  -gravity center -extent 450x450 \
  PNG32:printful-ready/label-outside-wordmark-450x450.png

# 3. Label Inside (future): S mark 32% centered in 450x450
magick -density 300 -background none \
  public/brand/skapara-mark-white.svg \
  -resize 144x \
  -gravity center -extent 450x450 \
  PNG32:printful-ready/label-inside-450x450.png
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

| Garment Background | Sleeve Asset | Back Asset |
|---|---|---|
| Dark (Black, Navy Blazer, Vintage Black) | `skapara-mark-white.svg` | `skapara-wordmark-white.svg` |
| Light (if enabled in future) | `skapara-mark-dark.svg` | `skapara-wordmark-dark.svg` |

Currently all active MC1087 colors are dark, so we always use the white variant.

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
          {"type": "sleeve_left", "id": 950410444},
          {"type": "label_outside", "id": 951280113}
        ]
      }
    ]
  }'
```

### Per-Variant Update (Fallback)

```bash
curl -X PUT "https://api.printful.com/store/variants/${SYNC_VARIANT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"type": "default", "id": FRONT_DESIGN_FILE_ID},
      {"type": "sleeve_left", "id": 950410444},
      {"type": "label_outside", "id": 951280113}
    ]
  }'
```

Rate limit: `delay(2000)` between per-variant updates.

---

## Anti-Patterns (DO NOT)

- **DO NOT** use S mark at 70%+ of canvas width — looks like promotional merch, not brand
- **DO NOT** place wordmark at mid-back — it must be in the upper zone (between shoulder blades, y=150)
- **DO NOT** copy the front design to the back — each position has its own purpose
- **DO NOT** use gradients in DTG — gradients only for stickers and drinkware
- **DO NOT** scale existing PNGs — always render from source SVG
- **DO NOT** use `label_outside` + `back` together — they are mutually exclusive in Printful
- **DO NOT** use different branding sizes per product — 32% sleeve and ~18% label_outside are the SKAPARA standard
- **DO NOT** mix white and dark branding variants on the same product (all MC1087 active colors are dark)
