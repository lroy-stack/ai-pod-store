---
name: Printful SOL'S 11362 DTFilm Polo
description: >-
  Complete pipeline for SOL'S 11362 Polo (catalog 810) with DTFilm/DTFlex technique on Printful.
  7 colors (Black, Grey Melange, Mouse Grey, Navy, Red, Sand, White), 8 sizes (S-5XL), 50 variants.
  Covers product creation, variant management, DTFilm design placement including the ultra-cheap
  chest_left_dtf at only +0.99 EUR, mockup generation, and Supabase integration. Use when creating
  DTFilm polo products, corporate polo shirts, branded polos, or managing SOL'S 11362 products
  with dtfilm printing. EU fulfillment from Latvia.
---

# Printful SOL'S 11362 DTFilm Polo — Complete Pipeline

Full production pipeline for SKAPARA polo shirts using the SOL'S 11362 Polo blank with DTFilm (DTFlex) printing technique on Printful.

For embroidery on this same blank, see `printful-sols11362-embroidery` skill.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 11362 Polo |
| **Catalog ID** | 810 |
| **Technique** | DTFilm (API key: `dtfilm`, marketing: DTFlex) |
| **Material** | 100% cotton pique, thick soft fabric |
| **Construction** | Button placket, ribbed collar and cuffs |
| **Fit** | Classic, unisex |
| **Sizes** | S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| **Colors** | 7 (Black, Grey Melange, Mouse Grey, Navy, Red, Sand, White) |
| **Total Variants** | 50 (7 colors x 8 sizes = 56 catalog, 50 enabled) |
| **Print Method** | DTFilm — PET film + adhesive + heat press 165C + cold peel |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES |
| **Base Cost** | 16.99-17.99 EUR |

---

## When to Use

- Create a new DTFilm polo product on Printful using SOL'S 11362
- Create corporate/business branded polo shirts
- Upload small logos or full designs to polo shirts
- Use the ultra-cheap `chest_left_dtf` placement (+0.99 EUR only)
- Generate mockups for polo products
- Manage variant colors (7 colors) and sizes (up to 5XL)

---

## DTFilm Technique — Key Facts

- **Full CMYK color** — unlimited colors, gradients, photographic content
- **Smooth vinyl-like texture** — distinct from DTG's soft-ink feel
- **Process:** Design printed to PET film -> adhesive powder -> heat-cured -> heat-pressed at 165C -> cold peel
- **File types use `_dtf` suffix**: `chest_left_dtf`, `back_dtf`, etc.
- **50+ washes durability**

---

## Placements & Canvas Sizes

| Placement | Printfile | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `chest_left_dtf` | PF#136 | 1200 x 1200 | 300 | **+0.99 EUR** | Small chest logo — CHEAPEST DTFilm placement |
| `back_dtf` | PF#222 | 3000 x 1800 | 300 | +5.25 EUR | Back design |
| `back_large_dtf` | PF#222 | 3000 x 1800 | 300 | +5.25 EUR | Back large variant |
| `short_sleeve_left_dtf` | PF#396 | 600 x 900 | 300 | +2.20 EUR | Left sleeve |
| `short_sleeve_right_dtf` | PF#396 | 600 x 900 | 300 | +2.20 EUR | Right sleeve |
| `label_inside_dtf` | — | — | — | +0.99 EUR | Inside label |

**IMPORTANT:** `back_dtf` and `back_large_dtf` are mutually exclusive. Choose one.

**NOTE:** This product uses **300 DPI** printfiles (not 150 like the other DTFilm products).

### Recommended SKAPARA Setup — Minimal Cost

- `chest_left_dtf`: SKAPARA S mark or logo (1200x1200 @300dpi) — only **+0.99 EUR**
- `label_inside_dtf`: SKAPARA brand mark — only **+0.99 EUR**

**Total extra cost (minimal):** +0.99 + 0.99 = **+1.98 EUR** (cheapest branding in entire catalog!)

### Recommended SKAPARA Setup — Full Branding

- `chest_left_dtf`: SKAPARA logo (1200x1200 @300dpi) — +0.99 EUR
- `back_dtf`: SKAPARA wordmark or design (3000x1800 @300dpi) — +5.25 EUR
- `short_sleeve_left_dtf`: S mark (600x900 @300dpi) — +2.20 EUR
- `label_inside_dtf`: Brand mark — +0.99 EUR

**Total extra cost (full):** +0.99 + 5.25 + 2.20 + 0.99 = **+9.43 EUR**

---

## Base Costs (Production EUR)

| Size | Base Cost | + Chest Only | + Full Branding | Full Retail |
|---|---|---|---|---|
| S | 16.99 | 17.98 | 26.42 | 44.95 |
| M | 16.99 | 17.98 | 26.42 | 44.95 |
| L | 16.99 | 17.98 | 26.42 | 44.95 |
| XL | 16.99 | 17.98 | 26.42 | 44.95 |
| 2XL | 17.99 | 18.98 | 27.42 | 46.95 |
| 3XL | 17.99 | 18.98 | 27.42 | 46.95 |
| 4XL | 17.99 | 18.98 | 27.42 | 46.95 |
| 5XL | 17.99 | 18.98 | 27.42 | 46.95 |

### Pricing Strategy Options

**Option A — Chest-only branding (ultra-cheap):**

| Size | Production | Retail (EUR) | Margin |
|---|---|---|---|
| S-XL | 17.98 | 34.95 | 48.6% |
| 2XL-5XL | 18.98 | 36.95 | 48.6% |

**Option B — Full branding (4 placements):**

| Size | Production | Retail (EUR) | Margin |
|---|---|---|---|
| S-XL | 26.42 | 44.95 | 41.2% |
| 2XL-5XL | 27.42 | 46.95 | 41.6% |

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

## Workflow: Create New DTFilm Polo Product

### Step 1: Upload Designs

Upload placement assets (NOTE: **300 DPI** for this product):
1. Chest left logo (1200x1200 @300dpi) -> `CHEST_FILE_ID`
2. Back design (3000x1800 @300dpi) -> `BACK_FILE_ID` (optional)
3. Sleeve S mark (600x900 @300dpi) -> `SLEEVE_FILE_ID` (optional)

```bash
curl -X POST "https://api.printful.com/files" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: 17795695" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{ "url": "'${PUBLIC_URL}'", "filename": "'${FILENAME}'" }'
```

### Step 2: Create Sync Product

```javascript
const product = await pf('/store/products', {
  method: 'POST',
  body: JSON.stringify({
    sync_product: {
      name: 'Product Name — SOL\'S 11362 DTFilm Polo',
      thumbnail: publicUrlChest,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: PRICES[v.size],
      is_enabled: true,
      files: [
        { type: 'chest_left_dtf', id: CHEST_FILE_ID },
        // Optional:
        { type: 'back_dtf', id: BACK_FILE_ID },
        { type: 'short_sleeve_left_dtf', id: SLEEVE_FILE_ID },
        { type: 'label_inside_dtf', id: LABEL_FILE_ID },
      ],
    })),
  }),
});
```

### Step 3: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p>
<p><strong>Material:</strong> 100% cotton pique (SOL'S 11362)</p>
<p><strong>Print technique:</strong> DTFilm (DTFlex) — PET film heat transfer</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> OEKO-TEX Standard 100, REACH</p>
```

### Step 4: Create Product in Supabase

```javascript
await supabase.from('products').insert({
  id: crypto.randomUUID(),
  title: 'Product Name',
  description: 'Creative marketing description only.',
  category_id: 'POLO_CATEGORY_UUID',
  base_price_cents: 4495,
  compare_at_price_cents: 7995,
  currency: 'EUR',
  status: 'active',
  pod_provider: 'printful',
  provider_product_id: String(pfProductId),
  product_template_id: '810',
  translations: {
    es: { title: '...', description: '...' },
    de: { title: '...', description: '...' },
  },
  product_details: {
    brand: 'SKAPARA',
    model: 'SOL\'S 11362 Polo',
    material: '100% cotton pique',
    print_technique: 'DTFilm (DTFlex)',
    manufacturing_country: 'LV',
    safety_information: GPSR_HTML,
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.',
  },
});
```

### Step 5: Create Product Variants + Mockups

See [VARIANTS.md](VARIANTS.md) for variant IDs. Generate mockups:

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/810" \
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
      { "placement": "chest_left_dtf", "image_url": "LOGO_URL", "position": { "area_width": 1200, "area_height": 1200, "width": 1200, "height": 1200, "top": 0, "left": 0 } }
    ]
  }'
```

---

## Branding Strategy — DTFilm Polo

- **`chest_left_dtf`**: SKAPARA logo/S mark (1200x1200 @300dpi) — ONLY +0.99 EUR — the standout value
- **`label_inside_dtf`**: Brand identity mark — +0.99 EUR
- **`back_dtf`**: Optional skapara.com or larger design
- **`short_sleeve_left_dtf`**: S mark (600x900 @300dpi) — corporate branding

**The chest_left_dtf at +0.99 EUR makes this the cheapest branded product in the entire SKAPARA catalog.**

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| 300 DPI printfiles | This product uses 300 DPI, not 150 | Design at correct DPI |
| back_dtf vs back_large_dtf | Mutually exclusive | Choose one |
| Grey Melange texture | Heathered fabric may affect print appearance | Test mockups first |
| Navy — dark garment | Use white/light designs for best contrast | Same as Black treatment |
| Red — medium-dark | White/light designs preferred for readability | Test mockups for vibrance |
| Sand — light warm | Use dark/rich designs for contrast | Similar treatment to White |
| White — light garment | Dark/black designs ONLY — no white-on-white | Requires inverted design palette |
| Extended sizes 3XL-5XL | Same base cost as 2XL (17.99 EUR) | Good margin on large sizes |
| Cron sync margin fixer | Overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 401 | Missing User-Agent | Always include `User-Agent: POD-AI-Store/1.0` |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (polo-shirts)
- [ ] All colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (S through 5XL — 8 sizes!)
- [ ] Price correct per size tier
- [ ] Mockup images load for all placements
- [ ] GPSR safety information stored in `product_details`
- [ ] Translations present (EN, ES, DE)
- [ ] Cache-buster `?v=timestamp` appended to all image URLs

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
