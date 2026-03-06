# SKAPARA Branding — CC1717 Specification

Branding philosophy: **"No parece merch, parece marca."**

Conservative. Recognizable. Scalable. The branding should be subtle enough that the tee looks like a fashion brand, not a promotional item.

---

## Available Placements

| Placement | Canvas (px) | Extra Cost | Current Use |
|---|---|---|---|
| `front` / `default` | 1800 x 2400 | $0.00 (included) | Main design |
| `back` | 1800 x 2400 | +$5.25 | **Unused** (mutually exclusive with label_outside) |
| `sleeve_left` | 600 x 525 | +$2.20 | S mark isotipo |
| `sleeve_right` | 600 x 525 | +$2.20 | Unused |
| `label_outside` | 450 x 450 | +$2.20 | SKAPARA wordmark (neck label) |

**CRITICAL:** `back` and `label_outside` are **mutually exclusive** in Printful. You cannot use both on the same product. We use `label_outside` for the SKAPARA wordmark — positioned at the outer nape of the neck, subtle and brand-like (~18% of visible garment width). This saves $3.05/unit vs the `back` placement.

---

## Standard Branding Layout (Design on Front)

This is the default layout for 95% of SKAPARA CC1717 products.

### Front — Main Design

- Canvas: 1800 x 2400 px
- Content: Full design (occupies entire canvas)
- Position: centered (`x: 0.5, y: 0.45, scale: 1`)

### Sleeve Left — S Mark Isotipo

- Canvas: 600 x 525 px
- Asset: `skapara-mark-white.svg` (white S mark)
- Size: **32% of canvas width = 192px wide**
- Height: proportional (~148px based on SVG aspect ratio)
- Position: centered vertically and horizontally in the 600x525 canvas
- Margin: minimum 12-15% around the mark
- File ID (v2, already uploaded): **950410444**
- Preview: `files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png`

### Label Outside — SKAPARA Wordmark (Neck Label)

- Canvas: 450 x 450 px
- Asset: `skapara-wordmark-white.svg` (white SKAPARA text)
- Size: **~18% of visible garment width** — subtle, luxury-brand feel
- Position: outer nape of the neck, centered in the 450x450 canvas
- File ID (already uploaded): **951280113**
- Filename: `label-outside-wordmark-450x450.png`
- Preview: `files.cdn.printful.com/files/701/701ca6a13818e0063bfb4652165fcabb_preview.png`
- Reference mockup: `public/brand/dangerous-flag-back-mockup.png`

---

## Exception Layout (Design on Back)

When the main design goes on the **back** instead of the front, the branding uses `label_outside` as usual (neck label visible from both front and back views):

### Back — Main Design

- Canvas: 1800 x 2400 px
- Content: Full design
- Position: centered (`x: 0.5, y: 0.45, scale: 1`)

### Front (Left Chest) — SKAPARA Brandname

- Canvas: shared with front (1800 x 2400 px)
- Position: `x: 0.28, y: 0.22, scale: 0.3` (heart side, left chest)
- Visible size: ~540px wide (30% of 1800px)

### Sleeve Left — S Mark Isotipo

- Same as standard layout (32%, centered, File ID 950410444)

### Label Outside — SKAPARA Wordmark

- Same as standard layout (450x450, File ID 951280113)

---

## Branding File IDs (Printful File Library)

These are the current v2 branding assets already uploaded and verified:

| Placement | File ID | Asset | Preview URL |
|---|---|---|---|
| `sleeve_left` | **950410444** | S mark isotipo white (192px in 600x525) | `files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png` |
| `label_outside` | **951280113** | SKAPARA wordmark white (450x450, neck label) | `files.cdn.printful.com/files/701/701ca6a13818e0063bfb4652165fcabb_preview.png` |

**Reuse these IDs** for all new CC1717 products. No need to re-upload unless the branding assets change.

---

## Rendering Branding from SVG Sources

If the branding assets need to be re-rendered (new version, different size, etc.):

### Source Files

Located in `/frontend/public/brand/`:
- `skapara-mark-white.svg` (3967 bytes) — S mark for sleeve
- `skapara-wordmark-white.svg` (6190 bytes) — SKAPARA for back
- `skapara-mark-dark.svg` — S mark for light garments (navy #0F172A)
- `skapara-wordmark-dark.svg` — SKAPARA for light garments

### ImageMagick Render Commands

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
```

### Rendering Rules

- **ALWAYS render from SVG** (never upscale existing PNGs)
- **Density 300** for maximum rasterization quality
- **PNG32** format to preserve alpha channel (transparency)
- **Visually verify** over a dark background before uploading
- After rendering, upload to Printful via `POST /files` with URL method

---

## Color Variants for Branding Assets

| Garment Background | Sleeve Asset | Label Outside Asset |
|---|---|---|
| Dark (L < 50) | `skapara-mark-white.svg` | `skapara-wordmark-white.svg` |
| Light (L > 50, si se habilita) | `skapara-mark-dark.svg` | `skapara-wordmark-dark.svg` |

Actualmente todos los colores activos CC1717 son oscuros (L < 50), así que usamos exclusivamente las variantes white. Si en algún producto se habilitan colores claros (L > 50), renderizar y subir las variantes dark por separado.

---

## Applying Branding via API

### On New Product (during creation)

Include branding files in the `sync_variants[].files` array:

```json
{
  "sync_variants": [
    {
      "variant_id": 15114,
      "retail_price": "34.99",
      "files": [
        { "type": "default", "id": FRONT_DESIGN_FILE_ID },
        { "type": "label_outside", "id": 951280113 },
        { "type": "sleeve_left", "id": 950410444 }
      ]
    }
  ]
}
```

### On Existing Product (bulk update)

```bash
# 1. Get sync variant IDs
curl -s "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  | jq '.result.sync_variants[] | {id: .id, name: .name}'

# 2. Bulk update all variants
curl -X PUT "https://api.printful.com/store/products/${SYNC_PRODUCT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_variants": [
      {
        "id": SYNC_VARIANT_ID,
        "files": [
          { "type": "default", "id": FRONT_DESIGN_FILE_ID },
          { "type": "label_outside", "id": 951280113 },
          { "type": "sleeve_left", "id": 950410444 }
        ]
      }
    ]
  }'
```

**Important:** When updating existing products, use the **sync variant ID** (from GET response `.result.sync_variants[].id`), NOT the catalog variant ID.

---

## Anti-Patterns (DO NOT)

- **DO NOT** use the S mark at 70%+ of canvas width — it looks like promotional merchandise, not a fashion brand
- **DO NOT** place the wordmark at mid-back (y=1200) — it must sit in the upper zone between shoulder blades (y=150)
- **DO NOT** copy the front design to the back — each placement has its own purpose
- **DO NOT** use gradient on DTG garments — gradient is reserved for stickers and drinkware only
- **DO NOT** upscale existing PNGs — always re-render from SVG source at density 300
- **DO NOT** use `label_outside` together with `back` — they are mutually exclusive in Printful
- **DO NOT** place branding on `sleeve_right` without a specific design reason — currently unused to keep the look clean
- **DO NOT** use dark branding assets on dark garments — always match: white branding on dark fabric, dark branding on light fabric
