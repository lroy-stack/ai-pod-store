# Variants — SOL'S 32000 Unisex Windbreaker Embroidery (Catalog 661)

## Colors Available (EU Latvia)

All dark colors — white thread embroidery compatible.

| Color | Hex | Slug | Thread Recommendation |
|---|---|---|---|
| **Black** | `#000000` | `black` | White thread |
| **Forest Green** | `#228B22` | `forest-green` | White thread |
| **Navy** | `#1E2D53` | `navy` | White or gold thread |

---

## Sizes

| Size | Notes |
|---|---|
| S | Base tier |
| M | Base tier |
| L | Base tier |
| XL | Base tier |
| 2XL | Higher base cost |

---

## Variant IDs por Color x Talla

> **NOTE:** Variant IDs must be queried from the Printful API for catalog 661.
> Use: `GET https://api.printful.com/v2/catalog-products/661/catalog-variants`

### Black

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 17.95 |
| M | TBD | 17.95 |
| L | TBD | 17.95 |
| XL | TBD | 17.95 |
| 2XL | TBD | 19.25 |

### Forest Green

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 17.95 |
| M | TBD | 17.95 |
| L | TBD | 17.95 |
| XL | TBD | 17.95 |
| 2XL | TBD | 19.25 |

### Navy

| Talla | variant_id | Base Cost (EUR) |
|---|---|---|
| S | TBD | 17.95 |
| M | TBD | 17.95 |
| L | TBD | 17.95 |
| XL | TBD | 17.95 |
| 2XL | TBD | 19.25 |

---

## Variant ID Lookup Script

```bash
curl -s "https://api.printful.com/v2/catalog-products/661/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | {id, color, size}'
```

```javascript
const VARIANTS = {
  Black: { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD },
  'Forest Green': { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD },
  Navy: { S: TBD, M: TBD, L: TBD, XL: TBD, '2XL': TBD },
};
```

---

## Embroidery Placement

Single placement only:

| Placement | Printfile | Canvas | DPI | Cost |
|---|---|---|---|---|
| `embroidery_chest_left` | PF#136 | 1200x1200 | 300 | +2.60 EUR |

**Back printfile reference (NOT available as placement):**

| Printfile | Canvas | DPI | Notes |
|---|---|---|---|
| PF#222 | 3000x1800 | 300 | Listed in catalog but not as available placement |

---

## Retail Pricing (EUR)

### Standard (1 embroidery placement):

```javascript
const PRICES = {
  S: '34.99', M: '34.99', L: '34.99', XL: '34.99', '2XL': '37.99',
};
```

| Talla | Retail | Cost (base + 1x emb 2.60) | Margin |
|---|---|---|---|
| S | 34.99 | 20.55 | 41.3% |
| M | 34.99 | 20.55 | 41.3% |
| L | 34.99 | 20.55 | 41.3% |
| XL | 34.99 | 20.55 | 41.3% |
| 2XL | 37.99 | 21.85 | 42.5% |

**Excellent margins!** Well above the 35% threshold. No margin fixer issues.

---

## Product Characteristics

| Feature | Detail |
|---|---|
| Water-repellent | Yes — polyester shell |
| Lightweight | Yes — no lining |
| Sporty fit | Unisex regular |
| Hood | Typically yes (windbreaker style) |
| Zipper | Full front zip |
| Pockets | Zip pockets |

**Care instructions:** Machine wash cold. Do not iron on embroidery. Do not tumble dry. Hang dry.

---

## Total Variants

- 3 colors x 5 sizes = **15 variants**
