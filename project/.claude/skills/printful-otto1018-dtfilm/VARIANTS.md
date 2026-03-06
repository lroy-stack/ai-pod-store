# Otto Cap 104-1018 DTFilm Variant Catalog

Otto Cap 104-1018 Distressed Dad Hat (Catalog ID 396) — **4 colors, 1 size (One size), 4 variants total.**

Data verified from Printful API v2. DTFilm technique selected (API key: `dtfilm`).

---

## All Variants

| Color | Hex | Variant ID | Size | Base Cost (EUR) | DTFilm Cost | Total Cost | Recommended Retail | Margin | EU |
|---|---|---|---|---|---|---|---|---|---|
| Black | #000000 | 10990 | One size | 11.95 | +2.60 | 14.55 | 24.99 EUR | 41.8% | YES |
| Charcoal Grey | #555555 | 10991 | One size | 11.95 | +2.60 | 14.55 | 24.99 EUR | 41.8% | YES |
| Khaki | #C3B091 | 10992 | One size | 14.45 | +2.60 | 17.05 | 27.99 EUR | 39.1% | YES |
| Navy | #1B2A4A | 10993 | One size | 11.95 | +2.60 | 14.55 | 24.99 EUR | 41.8% | YES |

**4 variants total. ALL have EU fulfillment (Latvia/Spain).**

---

## Color Compatibility Notes

### Dark Colors (White/Light Design Compatible)

| Color | Hex | L (Luminance) | White Text | Notes |
|---|---|---|---|---|
| Black | #000000 | ~5 | YES | Best for ghost text, gradient designs |
| Charcoal Grey | #555555 | ~33 | YES | Good for subtle/muted designs |
| Navy | #1B2A4A | ~16 | YES | Classic dark, good for bold designs |

### Light Colors (Dark Design Compatible)

| Color | Hex | L (Luminance) | White Text | Notes |
|---|---|---|---|---|
| Khaki | #C3B091 | ~69 | NO | Needs dark ink designs, neutral earthy tone |

**Design strategy:**
- For 3 dark colors (Black, Charcoal Grey, Navy): Use white/light-colored designs
- For Khaki: Use dark-colored designs or designs with both light and dark elements
- DTFlex CMYK includes white underbase, so light designs on dark hats will be vibrant

---

## Quick Lookup

```
Black:          10990 (One size) — 11.95 EUR base
Charcoal Grey:  10991 (One size) — 11.95 EUR base
Khaki:          10992 (One size) — 14.45 EUR base
Navy:           10993 (One size) — 11.95 EUR base
```

---

## DTFilm Placement Per Variant

All variants use the same single placement:

| Placement | Printfile | Canvas | DPI | Price |
|---|---|---|---|---|
| `front_dtf_hat` | PF#816 | 1500 x 600 px | 300 | +2.60 EUR |

**No additional placements available.** DTFilm on this product supports FRONT ONLY.

---

## Comparison: DTFilm vs Embroidery Pricing (Same Hat)

| Technique | Black Base | Placement Cost | Total | Recommended Retail |
|---|---|---|---|---|
| **DTFilm** (this skill) | 11.95 EUR | +2.60 EUR | 14.55 EUR | 24.99 EUR |
| Embroidery (front only) | 12.75 EUR | +2.95 EUR | 15.70 EUR | 26.99 EUR |
| Embroidery (front + back) | 12.75 EUR | +5.90 EUR | 18.65 EUR | 29.99 EUR |
| Embroidery (4 positions) | 12.75 EUR | +11.80 EUR | 24.55 EUR | 39.99 EUR |

**DTFilm is cheaper per unit** for front-only products, and allows unlimited colors/gradients that embroidery cannot achieve without the +3.25 EUR unlimited_color surcharge.

---

## EU Availability

| Color | Variant ID | EU Available | Fulfillment Center |
|---|---|---|---|
| Black | 10990 | YES | Latvia/Spain |
| Charcoal Grey | 10991 | YES | Latvia/Spain |
| Khaki | 10992 | YES | Latvia/Spain |
| Navy | 10993 | YES | Latvia/Spain |

**All 4 variants are EU-fulfilled.** No out-of-stock issues reported.

---

## API Creation Payload Template

```json
{
  "sync_product": {
    "name": "PRODUCT_NAME — Otto Cap 104-1018 DTFlex"
  },
  "sync_variants": [
    {
      "variant_id": 10990,
      "retail_price": "24.99",
      "files": [{ "type": "front_dtf_hat", "id": FILE_ID }],
      "options": [{ "id": "technique", "value": "dtfilm" }]
    },
    {
      "variant_id": 10991,
      "retail_price": "24.99",
      "files": [{ "type": "front_dtf_hat", "id": FILE_ID }],
      "options": [{ "id": "technique", "value": "dtfilm" }]
    },
    {
      "variant_id": 10992,
      "retail_price": "27.99",
      "files": [{ "type": "front_dtf_hat", "id": FILE_ID }],
      "options": [{ "id": "technique", "value": "dtfilm" }]
    },
    {
      "variant_id": 10993,
      "retail_price": "24.99",
      "files": [{ "type": "front_dtf_hat", "id": FILE_ID }],
      "options": [{ "id": "technique", "value": "dtfilm" }]
    }
  ]
}
```
