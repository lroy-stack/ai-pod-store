---
name: Printful SOL'S 03568 Embroidery Hoodie
description: >-
  Complete pipeline for SOL'S 03568 Eco Raglan Hoodie (catalog 543) with EMBROIDERY
  technique on Printful. Covers embroidery product creation with 4 placements
  (chest_center/chest_left MUTUALLY EXCLUSIVE + wrist_left + wrist_right), thread color
  selection, variant management, mockup generation, and Supabase integration. Use when
  creating embroidered hoodie products, premium branded hoodies, or managing SOL'S 03568
  embroidery products. 6 colors (Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange,
  White), 42 variants, EU fulfillment from Latvia.
---

# Printful SOL'S 03568 Eco Raglan Embroidery Hoodie — Complete Pipeline

Full production pipeline for SKAPARA embroidered hoodies using the SOL'S 03568 Eco Raglan Hoodie blank with embroidery technique on Printful.

For DTG or DTFilm on this same blank, see `printful-sols03568-dtg` or `printful-sols03568-dtfilm` skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03568 Eco Raglan Hoodie |
| **Catalog ID** | 543 (same as DTG/DTFilm — technique differs) |
| **Technique** | EMBROIDERY |
| **Material** | 80% organic cotton, 20% recycled polyester |
| **Fabric Weight** | ~10.8 oz/yd² (365 g/m²) |
| **Fit** | Regular, raglan sleeves, kangaroo pocket, drawstring hood |
| **Sizes** | XS, S, M, L, XL, 2XL, 3XL |
| **Colors** | 6: Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White |
| **Variants** | 42 (6 colors x 7 sizes) |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES |
| **Base Cost** | 35.20-42.25 EUR |
| **Embroidery Cost** | +2.95 EUR per placement |

---

## When to Use

- Create an embroidered hoodie product on Printful using SOL'S 03568
- Apply premium SKAPARA branding via embroidered chest logo
- Create embroidered S mark on wrist placement
- Generate mockups for embroidered raglan hoodie products
- Manage variant colors and sizes (XS through 3XL)

---

## Embroidery Placements & Canvas Sizes

All embroidery at **300 DPI**:

| Placement | Printfile | Canvas (px) | Physical | Extra Cost | Notes |
|---|---|---|---|---|---|
| `embroidery_chest_center` | — | 3000 x 1800 | 10" x 6" | +2.95 EUR | Main branding (logo + text) |
| `embroidery_chest_left` | — | 1200 x 1200 | 4" x 4" | +2.95 EUR | Small icon/logo |
| `embroidery_wrist_left` | PF#396 | 600 x 900 | 2" x 3" | +2.95 EUR | S mark branding |
| `embroidery_wrist_right` | PF#396 | 600 x 900 | 2" x 3" | +2.95 EUR | Decorative/geometric |

**CRITICAL: `embroidery_chest_center` and `embroidery_chest_left` are MUTUALLY EXCLUSIVE.**

### Recommended SKAPARA Setup

- `embroidery_chest_center`: SKAPARA logo + brand name (3000x1800 @300dpi)
- `embroidery_wrist_left`: S mark (600x900 @300dpi) — wrist branding
- `embroidery_wrist_right`: Decorative motif (600x900 @300dpi)

**Total extra cost (3 placements):** +2.95 x 3 = **+8.85 EUR**

---

## Thread Colors (15 available)

| Hex | Name | Best on |
|---|---|---|
| `#FFFFFF` | 1801 White | Dark garments |
| `#000000` | 1800 Black | Light garments |
| `#96A1A8` | 1718 Grey | All |
| `#A67843` | 1672 Old Gold | Dark |
| `#FFCC00` | 1951 Gold | Dark |
| `#E25C27` | 1987 Orange | Dark |
| `#CC3366` | 1910 Flamingo | Dark |
| `#CC3333` | 1839 Red | All |
| `#660000` | 1784 Maroon | Light |
| `#333366` | 1966 Navy | Light |
| `#005397` | 1842 Royal | All |
| `#3399FF` | 1695 Aqua/Teal | Dark |
| `#6B5294` | 1832 Purple | All |
| `#01784E` | 1751 Kelly Green | All |
| `#7BA35A` | 1848 Kiwi Green | Dark |

Max 6 thread colors per design.

**Thread colors option format:** `thread_colors_<placement_without_embroidery_prefix>`:
```
thread_colors_chest_center
thread_colors_chest_left
thread_colors_wrist_left
thread_colors_wrist_right
```

---

## Base Costs (Production EUR)

### 3 Placements (chest_center + wrist_left + wrist_right)

| Size | Base | 3x Embroidery | Total Cost | Retail (EUR) | Margin |
|---|---|---|---|---|---|
| XS-L | 35.20 | +8.85 | 44.05 | 79.95 | 44.9% |
| XL | 37.50 | +8.85 | 46.35 | 82.95 | 44.1% |
| 2XL | 39.85 | +8.85 | 48.70 | 84.95 | 42.7% |
| 3XL | 42.25 | +8.85 | 51.10 | 89.95 | 43.2% |

### 1 Placement (chest_center only)

| Size | Base | 1x Embroidery | Total Cost | Retail (EUR) | Margin |
|---|---|---|---|---|---|
| XS-L | 35.20 | +2.95 | 38.15 | 66.95 | 43.0% |
| XL | 37.50 | +2.95 | 40.45 | 69.95 | 42.2% |
| 2XL | 39.85 | +2.95 | 42.80 | 74.95 | 42.9% |
| 3XL | 42.25 | +2.95 | 45.20 | 79.95 | 43.5% |

---

## Printful API Reference

**Auth headers (ALL requests):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: 17795695
Content-Type: application/json
User-Agent: POD-AI-Store/1.0
```

**CRITICAL:** `User-Agent` is MANDATORY. Without it, Cloudflare returns 401.

**NEVER use Store ID 17595620** (different store).

---

## Workflow: Create New Embroidered Hoodie

### Step 1: Design Embroidery PNGs (@300dpi)

Max 6 thread colors per design. Min text 5mm. Min line 1.5mm.

### Step 2: Upload to Supabase Storage + Printful File Library

```javascript
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({ url: publicUrl, filename: 'placement.png' }),
});
```

### Step 3: Create Sync Product

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — SKAPARA Embroidered Hoodie',
      thumbnail: publicUrlChest,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: PRICES[v.size],
      is_enabled: true,
      files: [
        { type: 'embroidery_chest_center', id: chestFileId },
        { type: 'embroidery_wrist_left', id: wristLeftFileId },
        { type: 'embroidery_wrist_right', id: wristRightFileId },
      ],
      options: [
        { id: 'thread_colors_chest_center', value: ['#FFFFFF', '#01784E'] },
        { id: 'thread_colors_wrist_left', value: ['#FFFFFF'] },
        { id: 'thread_colors_wrist_right', value: ['#FFFFFF', '#01784E'] },
      ],
    })),
  }),
});
```

### Step 4: GPSR + Supabase Product + Variants + Mockups

Same pattern as SOL'S 03574 Embroidery. See that skill for full code examples.

```html
<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p>
<p><strong>Material:</strong> 80% organic cotton, 20% recycled polyester (SOL'S 03568)</p>
<p><strong>Technique:</strong> Machine embroidery — polyester thread</p>
<p><strong>Care:</strong> Hand wash cold, inside out. Do not bleach. Air dry. Do not iron on embroidery.</p>
<p><strong>Compliance:</strong> OEKO-TEX Standard 100, REACH</p>
```

---

## Branding Strategy — Embroidery

- **`embroidery_chest_center`**: SKAPARA logo + text embroidered
- **`embroidery_wrist_left`**: S mark in white thread on dark garments
- **`embroidery_wrist_right`**: Geometric motif or skapara.com text
- **All colors viable**: Thread provides contrast on any garment

---

## Known Issues

| Issue | Detail | Workaround |
|---|---|---|
| chest_center vs chest_left | Mutually exclusive | Choose ONE per product |
| GPSR endpoint 404 | Returns 404 for embroidery products | Manage GPSR in Supabase directly |
| Printful rejects data URLs | `/files` rejects base64 | Upload to Supabase Storage first |
| thread_colors format | Option ID omits `embroidery_` prefix | Use `thread_colors_chest_center` |
| Ghost mockup response | All placements return same URLs | Extract views from `mockups[0]` |
| Care instructions different | Embroidery: "Hand wash, no iron on embroidery" | NOT same as DTG care |
| Burnt Orange contrast | Warm medium tone — test contrast with both light/dark thread | Generate mockups to verify thread visibility |
| Charcoal Melange | Dark heathered — white/light thread preferred | Heathered texture may affect fine embroidery detail |
| White garment | Light — use dark/black thread only | Avoid white thread on white garment |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (pullover-hoodies)
- [ ] All colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (XS through 3XL)
- [ ] Thread colors specified for all placements
- [ ] GPSR safety information stored in `product_details`
- [ ] Embroidery care instructions (hand wash, no iron on embroidery)
- [ ] Translations present (EN, ES, DE)

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
