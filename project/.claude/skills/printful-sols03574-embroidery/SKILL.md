---
name: Printful SOL'S 03574 Embroidery Sweatshirt
description: >-
  Complete pipeline for SOL'S 03574 Comet Organic Sweatshirt (catalog 506) with EMBROIDERY
  technique on Printful. Covers embroidery product creation with 4 placements
  (chest_center/chest_left MUTUALLY EXCLUSIVE + wrist_left + wrist_right), thread color
  selection, variant management, mockup generation, and Supabase integration. Use when
  creating embroidered sweatshirt products, premium branded crewnecks, or managing SOL'S 03574
  embroidery products. 8 colors, XS-XXL (6 sizes), EU fulfillment from Latvia.
---

# Printful SOL'S 03574 Comet Embroidery Sweatshirt — Complete Pipeline

Full production pipeline for SKAPARA embroidered sweatshirts using the SOL'S 03574 Comet Organic Sweatshirt blank with embroidery technique on Printful.

For DTG or DTFilm on this same blank, see `printful-sols03574-dtg` or `printful-sols03574-dtfilm` skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03574 Comet Organic Sweatshirt |
| **Catalog ID** | 506 (same as DTG/DTFilm — technique differs) |
| **Technique** | EMBROIDERY |
| **Material** | 80% organic cotton, 20% recycled polyester |
| **Fabric Weight** | ~9.2 oz/yd² (310 g/m²) |
| **Fit** | Regular, unisex |
| **Sizes** | XS, S, M, L, XL, XXL (6 sizes) |
| **Colors** | 8 (Black, Bottle Green, Deep Charcoal Grey, French Navy, Grey Melange, Red, Royal Blue, White) |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES |
| **Base Cost** | 22.40-26.95 EUR |
| **Embroidery Cost** | +2.95 EUR per placement |

---

## When to Use

- Create an embroidered sweatshirt product on Printful using SOL'S 03574
- Apply premium SKAPARA branding via embroidered chest logo
- Create embroidered S mark on wrist placement
- Generate mockups for embroidered sweatshirt products
- Manage variant colors and sizes

---

## Embroidery Placements & Canvas Sizes

All embroidery at **300 DPI**:

| Placement | Printfile | Canvas (px) | Physical | Extra Cost | Notes |
|---|---|---|---|---|---|
| `embroidery_chest_center` | — | 3000 x 1800 | 10" x 6" | +2.95 EUR | Main branding (logo + text) |
| `embroidery_chest_left` | — | 1200 x 1200 | 4" x 4" | +2.95 EUR | Small icon/logo |
| `embroidery_wrist_left` | PF#396 | 600 x 900 | 2" x 3" | +2.95 EUR | S mark branding |
| `embroidery_wrist_right` | PF#396 | 600 x 900 | 2" x 3" | +2.95 EUR | Decorative/geometric |

**CRITICAL: `embroidery_chest_center` and `embroidery_chest_left` are MUTUALLY EXCLUSIVE.** You cannot use both. Choose ONE per product.

### Recommended SKAPARA Setup — Option A (chest_center + wrists)

- `embroidery_chest_center`: SKAPARA logo + brand name (3000x1800 @300dpi)
- `embroidery_wrist_left`: S mark (600x900 @300dpi)
- `embroidery_wrist_right`: Decorative motif (600x900 @300dpi)

**Total extra cost:** +2.95 x 3 = **+8.85 EUR**

### Recommended SKAPARA Setup — Option B (chest_left + wrists)

- `embroidery_chest_left`: S mark icon (1200x1200 @300dpi)
- `embroidery_wrist_left`: SKAPARA text (600x900 @300dpi)

**Total extra cost:** +2.95 x 2 = **+5.90 EUR**

---

## Thread Colors (15 available)

| Hex | Name | Best on |
|---|---|---|
| `#FFFFFF` | 1801 White | Dark garments |
| `#000000` | 1800 Black | Light garments |
| `#96A1A8` | 1718 Grey | All |
| `#A67843` | 1672 Old Gold | Dark garments |
| `#FFCC00` | 1951 Gold | Dark garments |
| `#E25C27` | 1987 Orange | Dark garments |
| `#CC3366` | 1910 Flamingo | Dark garments |
| `#CC3333` | 1839 Red | All |
| `#660000` | 1784 Maroon | Light garments |
| `#333366` | 1966 Navy | Light garments |
| `#005397` | 1842 Royal | All |
| `#3399FF` | 1695 Aqua/Teal | Dark garments |
| `#6B5294` | 1832 Purple | All |
| `#01784E` | 1751 Kelly Green | All |
| `#7BA35A` | 1848 Kiwi Green | Dark garments |

Max 6 thread colors per design. Max 15 total available.

**Thread colors option format:** `thread_colors_<placement_without_embroidery_prefix>`:
```
thread_colors_chest_center   (NOT thread_colors_embroidery_chest_center)
thread_colors_chest_left     (NOT thread_colors_embroidery_chest_left)
thread_colors_wrist_left
thread_colors_wrist_right
```

---

## Base Costs (Production EUR)

### 3 Placements (chest_center + wrist_left + wrist_right)

| Size | Base | 3x Embroidery | Total Cost | Retail (EUR) | Margin |
|---|---|---|---|---|---|
| XS | 22.40 | +8.85 | 31.25 | 54.95 | 43.1% |
| S | 22.40 | +8.85 | 31.25 | 54.95 | 43.1% |
| M | 22.40 | +8.85 | 31.25 | 54.95 | 43.1% |
| L | 22.40 | +8.85 | 31.25 | 54.95 | 43.1% |
| XL | 24.70 | +8.85 | 33.55 | 57.95 | 42.1% |
| XXL | 26.95 | +8.85 | 35.80 | 62.95 | 43.1% |

### 1 Placement (chest_left only)

| Size | Base | 1x Embroidery | Total Cost | Retail (EUR) | Margin |
|---|---|---|---|---|---|
| XS-L | 22.40 | +2.95 | 25.35 | 44.95 | 43.6% |
| XL | 24.70 | +2.95 | 27.65 | 47.95 | 42.3% |
| XXL | 26.95 | +2.95 | 29.90 | 52.95 | 43.5% |

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

## Workflow: Create New Embroidered Sweatshirt

### Step 1: Design Embroidery PNGs (@300dpi)

Each PNG must match the exact canvas dimensions. Max 6 thread colors per design.

```bash
magick -density 300 -background transparent design.svg -resize WxH! design.png
```

### Step 2: Upload to Supabase Storage + Printful File Library

```javascript
// Upload to Supabase first (Printful needs public URL)
await supabase.storage.from('designs').upload(
  'embroidery-sources/product-name/placement.png',
  pngBuffer,
  { contentType: 'image/png', upsert: true }
);
const publicUrl = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/product-name/placement.png`;

// Then upload to Printful File Library
const result = await pf('/files', {
  method: 'POST',
  body: JSON.stringify({ url: publicUrl, filename: 'placement.png' }),
});
const fileId = result.result.id;
```

### Step 3: Create Sync Product

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — SKAPARA Embroidered',
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
<p><strong>Material:</strong> 80% organic cotton, 20% recycled polyester (SOL'S 03574)</p>
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
  base_price_cents: 5495,
  compare_at_price_cents: 8995,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '506',
  translations: {
    es: { title: '...', description: '...' },
    de: { title: '...', description: '...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'SOL\'S 03574 Comet',
    material: '80% organic cotton, 20% recycled polyester',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: GPSR_HTML,
    care_instructions: 'Hand wash cold, inside out. Do not bleach. Air dry. Do not iron on embroidery.',
  },
});
```

### Step 6: Create Product Variants

```javascript
for (const { color, hex } of ALL_COLORS) {
  for (const size of SIZES) {
    await supabase.from('product_variants').insert({
      product_id: PRODUCT_UUID,
      title: `ProductName / ${color} / ${size}`,
      color,
      color_hex: hex,
      size,
      price_cents: PRICES_CENTS[size],
      is_enabled: true,
      is_available: true,
      external_variant_id: String(VARIANT_IDS[color][size]),
    });
  }
}
```

### Step 7: Generate Mockups + Upload to Supabase

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/506" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "variant_ids": [VARIANT_ID],
    "format": "png",
    "width": 1000,
    "option_groups": ["Ghost"],
    "options": ["Front", "Back"],
    "files": [
      { "placement": "embroidery_chest_center", "image_url": "DESIGN_URL", "position": { "area_width": 3000, "area_height": 1800, "width": 3000, "height": 1800, "top": 0, "left": 0 } }
    ]
  }'
```

---

## Branding Strategy — Embroidery

- **`embroidery_chest_center`**: SKAPARA logo + text embroidered (primary branding)
- **`embroidery_wrist_left`**: S mark in white thread on dark garments
- **`embroidery_wrist_right`**: Geometric/decorative motif or skapara.com text
- **All 8 colors viable**: Embroidery thread provides contrast on any garment color
- **Color Notes:**
  - Grey Melange: medium tone — both light and dark thread colors work
  - Red: dark-medium color — white/light thread preferred
  - Royal Blue: dark color — white/light thread
  - White: light color — use dark/black thread only

---

## Embroidery Design Rules

1. **Max 6 thread colors per design** (15 total available)
2. **Min text height**: 5mm / 0.25"
3. **Min line width**: 1.5mm
4. **No gradients** (unless using unlimited_color — check availability)
5. **File format**: PNG @300dpi preferred
6. **chest_center vs chest_left**: MUTUALLY EXCLUSIVE — choose one

---

## Known Issues

| Issue | Detail | Workaround |
|---|---|---|
| chest_center vs chest_left | Mutually exclusive | Choose ONE per product |
| GPSR endpoint 404 | `/store/products/{id}/gpsr.json` returns 404 for embroidery | Manage GPSR in Supabase directly |
| Printful rejects data URLs | `/files` rejects base64 | Upload to Supabase Storage first |
| thread_colors format | Option ID omits `embroidery_` prefix | Use `thread_colors_chest_center` |
| Ghost mockup response | All placements return same URLs | Extract views from `mockups[0]` |
| User-Agent mandatory | Cloudflare blocks without it | Always include `User-Agent: POD-AI-Store/1.0` |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (sweatshirts)
- [ ] All 8 colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (XS through XXL)
- [ ] Price correct per size tier
- [ ] Thread colors specified for all placements
- [ ] GPSR safety information stored in `product_details`
- [ ] Embroidery care instructions (NOT DTG care)
- [ ] Translations present (EN, ES, DE)

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
