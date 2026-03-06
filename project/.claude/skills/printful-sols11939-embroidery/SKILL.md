---
name: Printful SOL'S 11939 Embroidery Sports Jersey
description: >-
  Complete pipeline for SOL'S 11939 Sports Jersey (catalog 715) with EMBROIDERY technique
  on Printful. 7 colors (Black, French Navy, Neon Orange, Neon Yellow, Red, Royal Blue,
  White), 5 sizes, 35 variants. Covers embroidery product creation with 4 placements
  (chest_center/chest_left MUTUALLY EXCLUSIVE + sleeve_left_top + sleeve_right_top), thread
  color selection, variant management, mockup generation, and Supabase integration. Use when
  creating embroidered sports jerseys, athletic branded wear, or managing SOL'S 11939
  embroidery products. 100% polyester mesh. EU fulfillment from Latvia.
---

# Printful SOL'S 11939 Embroidery Sports Jersey — Complete Pipeline

Full production pipeline for SKAPARA embroidered sports jerseys using the SOL'S 11939 Sports Jersey blank with embroidery technique on Printful.

**NOTE:** This product is 100% polyester mesh. Both DTFilm (default) and Embroidery work on polyester, but DTG does NOT. For DTFilm on this blank, see `printful-sols11939-dtfilm` skill.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 11939 Sports Jersey |
| **Catalog ID** | 715 (same as DTFilm — technique differs) |
| **Technique** | EMBROIDERY |
| **Material** | 100% polyester mesh |
| **Fabric** | Breathable sports mesh, lightweight |
| **Fit** | Athletic, regular |
| **Sizes** | S, M, L, XL, 2XL |
| **Colors** | 7 (Black, French Navy, Neon Orange, Neon Yellow, Red, Royal Blue, White) |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES |
| **Base Cost** | 13.95-17.25 EUR |
| **Embroidery Cost** | +2.60 EUR per placement |

---

## When to Use

- Create an embroidered sports jersey on Printful using SOL'S 11939
- Apply premium SKAPARA branding via embroidered chest logo on athletic wear
- Create embroidered team/corporate sports jerseys
- Generate mockups for embroidered jersey products
- Manage variant colors including neon options and classic colors (Red, Royal Blue, White)
- 7 colors x 5 sizes = 35 variants total

---

## Embroidery Placements & Canvas Sizes

**IMPORTANT:** This product uses **sleeve_left_top / sleeve_right_top** placements (NOT wrist). These are SHORT SLEEVE positions.

All embroidery at **300 DPI**:

| Placement | Printfile | Canvas (px) | Physical | Extra Cost | Notes |
|---|---|---|---|---|---|
| `embroidery_chest_center` | PF#136 | 1200 x 1200 | 4" x 4" | +2.60 EUR | Main branding |
| `embroidery_chest_left` | PF#136 | 1200 x 1200 | 4" x 4" | +2.60 EUR | Small icon/logo |
| `embroidery_sleeve_left_top` | — | 600 x 525 | 2" x 1.75" | +2.60 EUR | Left sleeve |
| `embroidery_sleeve_right_top` | — | 600 x 525 | 2" x 1.75" | +2.60 EUR | Right sleeve |

**CRITICAL: `embroidery_chest_center` and `embroidery_chest_left` are MUTUALLY EXCLUSIVE.**

### Key Differences from Hoodie/Sweatshirt Embroidery

1. **+2.60 EUR per placement** (not +2.95 EUR like hoodies/sweatshirts)
2. **Sleeve placements are `sleeve_left_top` / `sleeve_right_top`** (not `wrist_left` / `wrist_right`)
3. **Chest canvas is 1200x1200** for BOTH chest_center and chest_left (same size)
4. **No wrist placements** (short sleeves)

### Recommended SKAPARA Setup

- `embroidery_chest_left`: SKAPARA S mark (1200x1200 @300dpi) — clean athletic look
- `embroidery_sleeve_left_top`: S mark small (600x525 @300dpi) — sleeve branding

**Total extra cost (2 placements):** +2.60 x 2 = **+5.20 EUR**

---

## Thread Colors (15 available)

| Hex | Name | Best on |
|---|---|---|
| `#FFFFFF` | 1801 White | Dark garments (Black, French Navy) |
| `#000000` | 1800 Black | Neon garments (Orange, Yellow) |
| `#96A1A8` | 1718 Grey | All |
| `#A67843` | 1672 Old Gold | Dark |
| `#FFCC00` | 1951 Gold | Dark |
| `#E25C27` | 1987 Orange | Dark |
| `#CC3366` | 1910 Flamingo | Dark |
| `#CC3333` | 1839 Red | All |
| `#660000` | 1784 Maroon | Neon/Light |
| `#333366` | 1966 Navy | Neon/Light |
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
thread_colors_sleeve_left_top
thread_colors_sleeve_right_top
```

---

## Base Costs (Production EUR)

### 2 Placements (chest_left + sleeve_left_top)

| Size | Base | 2x Embroidery | Total Cost | Retail (EUR) | Margin |
|---|---|---|---|---|---|
| S-L | 13.95 | +5.20 | 19.15 | 34.95 | 45.2% |
| XL | 15.60 | +5.20 | 20.80 | 36.95 | 43.7% |
| 2XL | 17.25 | +5.20 | 22.45 | 39.95 | 43.8% |

### 1 Placement (chest_left only)

| Size | Base | 1x Embroidery | Total Cost | Retail (EUR) | Margin |
|---|---|---|---|---|---|
| S-L | 13.95 | +2.60 | 16.55 | 29.95 | 44.7% |
| XL | 15.60 | +2.60 | 18.20 | 32.95 | 44.8% |
| 2XL | 17.25 | +2.60 | 19.85 | 34.95 | 43.2% |

**This is the most affordable SKAPARA embroidered product** — great entry price point.

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

## Workflow: Create New Embroidered Sports Jersey

### Step 1: Design Embroidery PNGs (@300dpi)

Max 6 thread colors. Min text 5mm. Min line 1.5mm.

**Design considerations by garment color:**
- Black, French Navy, Red, Royal Blue: Use white/light thread
- Neon Orange, Neon Yellow, White: Use black/dark thread (Navy, Maroon, Black)

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
      name: 'Product Name — SKAPARA Embroidered Jersey',
      thumbnail: publicUrlChest,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: PRICES[v.size],
      is_enabled: true,
      files: [
        { type: 'embroidery_chest_left', id: chestFileId },
        { type: 'embroidery_sleeve_left_top', id: sleeveFileId },
      ],
      options: [
        { id: 'thread_colors_chest_left', value: threadColorsForColor(v.color) },
        { id: 'thread_colors_sleeve_left_top', value: threadColorsForColor(v.color) },
      ],
    })),
  }),
});

// Thread color helper
function threadColorsForColor(color) {
  if (['Neon Orange', 'Neon Yellow', 'White'].includes(color)) {
    return ['#000000', '#333366']; // Dark thread on light/neon garments
  }
  return ['#FFFFFF', '#01784E']; // Light thread on dark garments (Black, French Navy, Red, Royal Blue)
}
```

### Step 4: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p>
<p><strong>Material:</strong> 100% polyester mesh (SOL'S 11939)</p>
<p><strong>Technique:</strong> Machine embroidery — polyester thread</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Do not bleach. Do not iron on embroidery. Air dry.</p>
<p><strong>Compliance:</strong> OEKO-TEX Standard 100, REACH</p>
```

### Step 5: Create Product in Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description only.',
  category_id: 'JERSEY_CATEGORY_UUID',
  base_price_cents: 3495,
  compare_at_price_cents: 5995,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '715',
  translations: {
    es: { title: '...', description: '...' },
    de: { title: '...', description: '...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'SOL\'S 11939 Sports Jersey',
    material: '100% polyester mesh',
    print_technique: 'Embroidery',
    manufacturing_country: 'LV',
    safety_information: GPSR_HTML,
    care_instructions: 'Machine wash cold, inside out. Do not bleach. Do not iron on embroidery. Air dry.',
  },
});
```

### Step 6: Create Product Variants + Mockups

See [VARIANTS.md](VARIANTS.md) for variant IDs.

---

## Branding Strategy — Embroidery

- **`embroidery_chest_left`**: SKAPARA S mark (1200x1200 @300dpi) — clean athletic logo
- **`embroidery_sleeve_left_top`**: Small S mark (600x525 @300dpi)
- **Neon/White garments**: Use dark thread colors (Black, Navy, Maroon)
- **Dark garments** (Black, French Navy, Red, Royal Blue): Use light thread colors (White, Gold, Kiwi Green)

---

## Color-Specific Thread Strategy

| Garment Color | Primary Thread | Secondary Thread | Accent |
|---|---|---|---|
| Black | `#FFFFFF` White | `#01784E` Kelly Green | `#7BA35A` Kiwi |
| French Navy | `#FFFFFF` White | `#FFCC00` Gold | `#CC3333` Red |
| Red | `#FFFFFF` White | `#FFCC00` Gold | `#000000` Black |
| Royal Blue | `#FFFFFF` White | `#FFCC00` Gold | `#01784E` Kelly Green |
| White | `#000000` Black | `#333366` Navy | `#CC3333` Red |
| Neon Orange | `#000000` Black | `#333366` Navy | `#660000` Maroon |
| Neon Yellow | `#000000` Black | `#333366` Navy | `#01784E` Kelly Green |

---

## Known Issues

| Issue | Detail | Workaround |
|---|---|---|
| DTG NOT possible | 100% polyester — DTG inks fail | Use Embroidery or DTFilm |
| chest_center vs chest_left | Mutually exclusive | Choose ONE per product |
| Neon/White colors need dark thread | White thread invisible on neon/white | Use Black/Navy/Maroon thread |
| GPSR endpoint 404 | Returns 404 for embroidery | Manage GPSR in Supabase directly |
| Printful rejects data URLs | `/files` rejects base64 | Upload to Supabase Storage first |
| thread_colors format | Option ID omits `embroidery_` prefix | Use `thread_colors_chest_left` |
| sleeve_left_top NOT wrist | Short sleeve placements | Different from hoodie embroidery |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category
- [ ] All 7 colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (S through 2XL)
- [ ] Thread colors specified per color group (dark vs neon)
- [ ] GPSR safety information stored in `product_details`
- [ ] Care instructions for embroidered polyester
- [ ] Translations present (EN, ES, DE)
- [ ] Neon and White variants have dark-thread embroidery designs
- [ ] Red and Royal Blue variants have white/light-thread embroidery designs

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
