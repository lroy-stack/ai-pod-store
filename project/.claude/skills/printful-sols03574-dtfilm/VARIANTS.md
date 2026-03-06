# SOL'S 03574 Comet DTFilm Variant Reference — Catalog 506

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 506 |
| **Technique** | DTFilm (dtfilm) |
| **Total Colors** | 8 |
| **Total Sizes** | 6 (XS, S, M, L, XL, XXL) |
| **Total Variants** | 40 |
| **EU Fulfillment** | ALL variants — Latvia |
| **Base Cost Range** | 22.40-26.95 EUR |

---

## Color Catalog

8 colors. Mix of dark, medium, and light — design accordingly.

### Black `#000000` (Dark)

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 22.40 |
| S | TBD-API-QUERY | 22.40 |
| M | TBD-API-QUERY | 22.40 |
| L | TBD-API-QUERY | 22.40 |
| XL | TBD-API-QUERY | 24.70 |
| XXL | TBD-API-QUERY | 26.95 |

### Bottle Green `#1A472A` (Dark)

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 22.40 |
| S | TBD-API-QUERY | 22.40 |
| M | TBD-API-QUERY | 22.40 |
| L | TBD-API-QUERY | 22.40 |
| XL | TBD-API-QUERY | 24.70 |
| XXL | TBD-API-QUERY | 26.95 |

### Deep Charcoal Grey `#333333` (Dark)

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 22.40 |
| S | TBD-API-QUERY | 22.40 |
| M | TBD-API-QUERY | 22.40 |
| L | TBD-API-QUERY | 22.40 |
| XL | TBD-API-QUERY | 24.70 |
| XXL | TBD-API-QUERY | 26.95 |

### French Navy `#071429` (Dark)

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 22.40 |
| S | TBD-API-QUERY | 22.40 |
| M | TBD-API-QUERY | 22.40 |
| L | TBD-API-QUERY | 22.40 |
| XL | TBD-API-QUERY | 24.70 |
| XXL | TBD-API-QUERY | 26.95 |

### Grey Melange `#B0B0B0` (Medium)

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 22.40 |
| S | TBD-API-QUERY | 22.40 |
| M | TBD-API-QUERY | 22.40 |
| L | TBD-API-QUERY | 22.40 |
| XL | TBD-API-QUERY | 24.70 |
| XXL | TBD-API-QUERY | 26.95 |

### Red `#CC0000` (Dark-Medium)

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 22.40 |
| S | TBD-API-QUERY | 22.40 |
| M | TBD-API-QUERY | 22.40 |
| L | TBD-API-QUERY | 22.40 |
| XL | TBD-API-QUERY | 24.70 |
| XXL | TBD-API-QUERY | 26.95 |

### Royal Blue `#003DA5` (Dark)

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 22.40 |
| S | TBD-API-QUERY | 22.40 |
| M | TBD-API-QUERY | 22.40 |
| L | TBD-API-QUERY | 22.40 |
| XL | TBD-API-QUERY | 24.70 |
| XXL | TBD-API-QUERY | 26.95 |

### White `#FFFFFF` (Light)

| Size | Catalog Variant ID | Base Cost (EUR) |
|---|---|---|
| XS | TBD-API-QUERY | 22.40 |
| S | TBD-API-QUERY | 22.40 |
| M | TBD-API-QUERY | 22.40 |
| L | TBD-API-QUERY | 22.40 |
| XL | TBD-API-QUERY | 24.70 |
| XXL | TBD-API-QUERY | 26.95 |

---

## How to Get Variant IDs

Variant IDs are shared across techniques (DTG/DTFilm/Embroidery) for the same catalog. Query the API:

```bash
curl -s "https://api.printful.com/v2/catalog-products/506/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

Replace `TBD-API-QUERY` with actual IDs from the response.

---

## DTFilm Placement Costs (per variant)

| Placement | Cost (EUR) |
|---|---|
| `front_dtf` | +5.25 |
| `back_dtf` | +5.25 |
| `front_large_dtf` | +5.25 |
| `back_large_dtf` | +5.25 |
| `label_inside_dtf` | +0.95 |

### Production Cost Examples

**3 placements (front + back + label):**

| Size | Base | Placements | Total |
|---|---|---|---|
| XS-L | 22.40 | +11.45 | 33.85 |
| XL | 24.70 | +11.45 | 36.15 |
| XXL | 26.95 | +11.45 | 38.40 |

**1 placement (front only):**

| Size | Base | Placements | Total |
|---|---|---|---|
| XS-L | 22.40 | +5.25 | 27.65 |
| XL | 24.70 | +5.25 | 29.95 |
| XXL | 26.95 | +5.25 | 32.20 |

---

## Color Slug Mapping

| Color | Slug | Tone | Design Guidance | EU |
|---|---|---|---|---|
| Black | `black` | Dark | White/light designs | in_stock |
| Bottle Green | `bottle-green` | Dark | White/light designs | in_stock |
| Deep Charcoal Grey | `deep-charcoal-grey` | Dark | White/light designs | in_stock |
| French Navy | `french-navy` | Dark | White/light designs | in_stock |
| Grey Melange | `grey-melange` | Medium | Both light and dark designs work | in_stock |
| Red | `red` | Dark-Medium | White/light designs preferred | in_stock |
| Royal Blue | `royal-blue` | Dark | White/light designs | in_stock |
| White | `white` | Light | Dark/black designs ONLY | in_stock |
