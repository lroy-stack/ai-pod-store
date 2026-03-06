# Variants — SOL'S 03569 Organic Apron Embroidery (Catalog 565)

## Colors Available (EU Latvia)

| Color | Hex | Slug | Thread Recommendation |
|---|---|---|---|
| **Black** | `#000000` | `black` | White or cream thread |
| **Navy** | `#1E2D53` | `navy` | White or gold thread |
| **Red** | `#CC0000` | `red` | Black or white thread |
| **Rope** | `#C4A77D` | `rope` | Black or brown thread |

---

## Sizes

| Size | Notes |
|---|---|
| One size | Single size, no size variants |

---

## Variant IDs por Color

> **NOTE:** Variant IDs must be queried from the Printful API for catalog 565.
> Same variant IDs for both DTG and Embroidery — difference is in file types.
> Use: `GET https://api.printful.com/v2/catalog-products/565/catalog-variants`

| Color | variant_id | Base Cost (EUR) |
|---|---|---|
| Black | TBD | 20.95 |
| Navy | TBD | 20.95 |
| Red | TBD | 20.95 |
| Rope | TBD | 20.95 |

---

## Variant ID Lookup Script

```bash
curl -s "https://api.printful.com/v2/catalog-products/565/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

```javascript
const VARIANTS = {
  Black: { 'One size': TBD },
  Navy: { 'One size': TBD },
  Red: { 'One size': TBD },
  Rope: { 'One size': TBD },
};
```

---

## Embroidery Placement

Single placement only:

| Placement | Cost | Notes |
|---|---|---|
| `embroidery_chest_center` | +2.60 EUR | Only available embroidery placement |

---

## Retail Pricing (EUR)

### Standard embroidery (1 placement):

```javascript
const PRICES = {
  'One size': '34.99',
};
```

| Color | Retail | Cost (20.95 + 2.60) | Margin |
|---|---|---|---|
| All | 34.99 | 23.55 | 32.7% |

### Premium pricing (>35% margin):

```javascript
const PRICES_PREMIUM = {
  'One size': '37.99',
};
```

| Color | Retail | Cost | Margin |
|---|---|---|---|
| All | 37.99 | 23.55 | 38.0% |

### With unlimited_color (+3.25):

| Color | Retail | Cost (20.95 + 2.60 + 3.25) | Margin |
|---|---|---|---|
| All | 42.99 | 26.80 | 37.7% |

> **NOTE:** Standard embroidery at 34.99 gives 32.7% margin — below threshold. Use 37.99+ for >35%.

---

## Thread Color Recommendations by Garment Color

| Garment | Primary Thread | Accent Thread | Notes |
|---|---|---|---|
| Black | White (#FFFFFF) | — | Clean minimal look |
| Navy | White (#FFFFFF) | Gold (#FFD700) | Nautical/premium |
| Red | Black (#000000) | White (#FFFFFF) | Bold contrast |
| Rope | Black (#000000) | Brown (#8B4513) | Natural/earthy |

---

## Comparison: Embroidery vs DTG on Apron

| Factor | Embroidery | DTG |
|---|---|---|
| Cost per unit | 23.55 EUR | 26.20 EUR |
| Design freedom | Limited (15 threads) | Unlimited colors |
| Durability | Excellent (raised) | Good (30-50 washes) |
| Premium feel | High (textured) | Moderate (flat) |
| Best for | Logos, wordmarks, simple | Full graphics, photos |

**Recommendation:** Use embroidery for SKAPARA-branded "premium kitchen" aprons. Use DTG for graphic/design-heavy aprons.

---

## Total Variants

- 4 colors x 1 size = **4 variants**

Simplest embroidery product in the catalog.
