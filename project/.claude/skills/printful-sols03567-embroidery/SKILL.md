---
name: Printful SOL'S 03567 Embroidery Sweatshirt
description: >-
  Complete pipeline for SOL'S 03567 Organic Raglan Sweatshirt (catalog 582) with EMBROIDERY
  technique on Printful. Covers embroidery product creation with 4 placements
  (chest_center/chest_left MUTUALLY EXCLUSIVE + wrist_left + wrist_right), thread color
  selection, variant management, mockup generation, and Supabase integration. Use when
  creating embroidered raglan crewneck sweatshirts, premium branded crewnecks, or managing
  SOL'S 03567 embroidery products. 6 colors (Black, Bottle Green, Burgundy, Burnt Orange,
  Charcoal Melange, White), 41 variants, EU fulfillment from Latvia.
---

# Printful SOL'S 03567 Organic Raglan Embroidery Sweatshirt — Complete Pipeline

Full production pipeline for SKAPARA embroidered raglan crewneck sweatshirts using the SOL'S 03567 Organic Raglan Sweatshirt blank with embroidery technique on Printful.

For DTG or DTFilm on this same blank, see `printful-sols03567-dtg` or `printful-sols03567-dtfilm` skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03567 Organic Raglan Sweatshirt |
| **Catalog ID** | 582 (same as DTG/DTFilm — technique differs) |
| **Technique** | EMBROIDERY |
| **Material** | 80% organic cotton, 20% recycled polyester |
| **Fabric Weight** | ~9.2 oz/yd² (310 g/m²) |
| **Fit** | Regular, raglan sleeves, crew neck |
| **Sizes** | XS, S, M, L, XL, 2XL, 3XL |
| **Colors** | 6: Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White |
| **Variants** | 41 (6 colors x 7 sizes, minus 1) |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES |
| **Base Cost** | 26.20-32.95 EUR |
| **Embroidery Cost** | +2.95 EUR per placement |

---

## When to Use

- Create an embroidered raglan crewneck sweatshirt on Printful using SOL'S 03567
- Apply premium SKAPARA branding via embroidered chest logo
- Create embroidered S mark on wrist placement
- Generate mockups for embroidered crewneck products
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
| XS-L | 26.20 | +8.85 | 35.05 | 62.95 | 44.3% |
| XL | 28.55 | +8.85 | 37.40 | 64.95 | 42.4% |
| 2XL | 30.70 | +8.85 | 39.55 | 69.95 | 43.5% |
| 3XL | 32.95 | +8.85 | 41.80 | 72.95 | 42.7% |

### 1 Placement (chest_center only)

| Size | Base | 1x Embroidery | Total Cost | Retail (EUR) | Margin |
|---|---|---|---|---|---|
| XS-L | 26.20 | +2.95 | 29.15 | 49.95 | 41.6% |
| XL | 28.55 | +2.95 | 31.50 | 54.95 | 42.7% |
| 2XL | 30.70 | +2.95 | 33.65 | 57.95 | 41.9% |
| 3XL | 32.95 | +2.95 | 35.90 | 62.95 | 43.0% |

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

## Workflow: Create New Embroidered Crewneck

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
      name: 'Product Name — SKAPARA Embroidered Crewneck',
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

### Step 4: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p>
<p><strong>Material:</strong> 80% organic cotton, 20% recycled polyester (SOL'S 03567)</p>
<p><strong>Technique:</strong> Machine embroidery — polyester thread</p>
<p><strong>Care:</strong> Hand wash cold, inside out. Do not bleach. Air dry. Do not iron on embroidery.</p>
<p><strong>Compliance:</strong> OEKO-TEX Standard 100, REACH</p>
```

### Step 5: Create Product in Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description only.',
  category_id: 'SWEATSHIRT_CATEGORY_UUID',
  base_price_cents: 6295,
  compare_at_price_cents: 9995,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '582',
  translations: {
    es: { title: '...', description: '...' },
    de: { title: '...', description: '...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'SOL\'S 03567 Organic Raglan Sweatshirt',
    material: '80% organic cotton, 20% recycled polyester',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: GPSR_HTML,
    care_instructions: 'Hand wash cold, inside out. Do not bleach. Air dry. Do not iron on embroidery.',
  },
});
```

### Step 6: Create Product Variants + Mockups

Same pattern as other embroidery skills. See [VARIANTS.md](VARIANTS.md) for variant IDs.

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

- [ ] Product appears in shop with correct category (crewneck-sweatshirts)
- [ ] All colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (XS through 3XL)
- [ ] Thread colors specified for all placements
- [ ] GPSR safety information stored in `product_details`
- [ ] Embroidery care instructions (hand wash, no iron on embroidery)
- [ ] Translations present (EN, ES, DE)

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
