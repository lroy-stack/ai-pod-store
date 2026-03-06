# Beechfield B682 DTFilm Variant Catalog

Beechfield B682 Corduroy Hat (Catalog ID 532) — **4 colors, 1 size (One size), 4 variants total.**

Data verified from Printful API v2. DTFilm technique selected (API key: `dtfilm`).

**NOTE:** The B682 catalog variant IDs are NOT listed in the research data. They MUST be queried from the Printful API before product creation. Use the lookup method below.

---

## Variant ID Lookup

Query the Printful catalog API to get variant IDs:

```bash
curl -s "https://api.printful.com/v2/catalog-products/532/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "Content-Type: application/json" | jq '.data[] | {id, color, size}'
```

Expected output (4 variants, one per color):

| Color | Variant ID | Size | Base Cost (EUR) |
|---|---|---|---|
| Black | TBD (query API) | One size | 13.45 |
| Camel | TBD (query API) | One size | 13.45 |
| Dark Olive | TBD (query API) | One size | 13.45 |
| Oxford Navy | TBD (query API) | One size | 13.45 |

**ACTION REQUIRED:** Before creating ANY B682 product, run the lookup query above and fill in the variant IDs. Store them for reuse across all B682 DTFilm products.

---

## All Variants

| Color | Hex | Size | Base Cost (EUR) | DTFilm Cost | Total Cost | Recommended Retail | Margin | EU |
|---|---|---|---|---|---|---|---|---|
| Black | #000000 | One size | 13.45 | +2.60 | 16.05 | 27.99 EUR | 42.7% | YES |
| Camel | #C19A6B | One size | 13.45 | +2.60 | 16.05 | 27.99 EUR | 42.7% | YES |
| Dark Olive | #556B2F | One size | 13.45 | +2.60 | 16.05 | 27.99 EUR | 42.7% | YES |
| Oxford Navy | #1B2A4A | One size | 13.45 | +2.60 | 16.05 | 27.99 EUR | 42.7% | YES |

**4 variants total. ALL have EU fulfillment (Latvia/UK). Flat pricing across all colors.**

---

## Color Compatibility Notes

### Dark Colors (White/Light Design Compatible)

| Color | Hex | L (Luminance) | White Text | Notes |
|---|---|---|---|---|
| Black | #000000 | ~5 | YES | Maximum contrast, best for vibrant DTFlex prints |
| Dark Olive | #556B2F | ~40 | YES | Earthy military tone, good for outdoor/nature designs |
| Oxford Navy | #1B2A4A | ~16 | YES | Classic dark navy, versatile for most designs |

### Light/Medium Colors (Dark Design Compatible)

| Color | Hex | L (Luminance) | White Text | Notes |
|---|---|---|---|---|
| Camel | #C19A6B | ~64 | MARGINAL | Warm earthy tone, needs dark or high-contrast designs |

**Design strategy:**
- For 3 dark colors (Black, Dark Olive, Oxford Navy): Use white/light-colored designs
- For Camel: Use dark-colored designs or designs with strong contrast
- DTFlex CMYK includes white underbase, so light designs on dark corduroy will be vibrant
- Corduroy texture adds visual interest under the DTFlex print

---

## DTFilm Placement Per Variant

All variants use the same single placement:

| Placement | Printfile | Canvas | DPI | Price |
|---|---|---|---|---|
| `front_dtf_hat` | PF#816 | 1500 x 600 px | 300 | +2.60 EUR |

**No additional placements available.** DTFilm on this product supports FRONT ONLY.

---

## Comparison: B682 DTFilm vs B682 Embroidery Pricing

| Technique | Base Cost | Placement Cost | Total Cost | Recommended Retail |
|---|---|---|---|---|
| **DTFilm** (this skill) | 13.45 EUR | +2.60 EUR | 16.05 EUR | 27.99 EUR |
| Embroidery (front only) | 16.95 EUR | +2.95 EUR | 19.90 EUR | 31.99 EUR |
| Embroidery (front + back) | 16.95 EUR | +5.90 EUR | 22.85 EUR | 36.99 EUR |
| Embroidery (4 positions) | 16.95 EUR | +11.80 EUR | 28.75 EUR | 44.99 EUR |

**DTFilm is significantly cheaper** (16.05 vs 19.90 EUR front-only) AND supports unlimited colors/gradients. The B682 embroidery base cost is 16.95 EUR vs only 13.45 EUR for DTFilm — a 3.50 EUR saving on the base alone.

---

## Comparison: B682 DTFilm vs Otto Cap 104-1018 DTFilm

| Product | Base Cost | DTFilm | Total | Retail | Material |
|---|---|---|---|---|---|
| Otto Cap 104-1018 (Black) | 11.95 EUR | +2.60 | 14.55 EUR | 24.99 EUR | Cotton twill, distressed |
| **B682 (Black)** | 13.45 EUR | +2.60 | 16.05 EUR | 27.99 EUR | Cotton corduroy, unstructured |

The B682 commands a ~3.00 EUR premium over the Otto Cap due to the corduroy material and Beechfield brand positioning.

---

## EU Availability

| Color | EU Available | Fulfillment Center |
|---|---|---|
| Black | YES | Latvia/UK |
| Camel | YES | Latvia/UK |
| Dark Olive | YES | Latvia/UK |
| Oxford Navy | YES | Latvia/UK |

**All 4 variants are EU-fulfilled.** No out-of-stock issues reported.

---

## API Creation Payload Template

```json
{
  "sync_product": {
    "name": "PRODUCT_NAME — Beechfield B682 DTFlex"
  },
  "sync_variants": [
    {
      "variant_id": "VARIANT_ID_BLACK",
      "retail_price": "27.99",
      "files": [{ "type": "front_dtf_hat", "id": "FILE_ID" }],
      "options": [{ "id": "technique", "value": "dtfilm" }]
    },
    {
      "variant_id": "VARIANT_ID_CAMEL",
      "retail_price": "27.99",
      "files": [{ "type": "front_dtf_hat", "id": "FILE_ID" }],
      "options": [{ "id": "technique", "value": "dtfilm" }]
    },
    {
      "variant_id": "VARIANT_ID_DARK_OLIVE",
      "retail_price": "27.99",
      "files": [{ "type": "front_dtf_hat", "id": "FILE_ID" }],
      "options": [{ "id": "technique", "value": "dtfilm" }]
    },
    {
      "variant_id": "VARIANT_ID_OXFORD_NAVY",
      "retail_price": "27.99",
      "files": [{ "type": "front_dtf_hat", "id": "FILE_ID" }],
      "options": [{ "id": "technique", "value": "dtfilm" }]
    }
  ]
}
```

**IMPORTANT:** Replace `VARIANT_ID_*` placeholders with actual IDs from the Printful catalog API query (Step 1 in Variant ID Lookup section above).
