---
name: Printful SOL'S 03567 DTFilm Sweatshirt
description: >-
  Complete pipeline for SOL'S 03567 Organic Raglan Sweatshirt (catalog 582) with DTFilm/DTFlex
  technique on Printful. Covers product creation, variant management, DTFilm design placement
  including long sleeves, mockup generation, and Supabase integration. Use when creating DTFilm
  raglan sweatshirt products, full-color printed crewnecks, gradient sweatshirts, or managing
  SOL'S 03567 products with dtfilm printing. 6 colors (Black, Bottle Green, Burgundy, Burnt Orange,
  Charcoal Melange, White), 41 variants, EU fulfillment from Latvia.
---

# Printful SOL'S 03567 Organic Raglan DTFilm Sweatshirt — Complete Pipeline

Full production pipeline for SKAPARA raglan crewneck sweatshirts using the SOL'S 03567 Organic Raglan Sweatshirt blank with DTFilm (DTFlex) printing technique on Printful.

For DTG or embroidery on this same blank, see `printful-sols03567-dtg` or `printful-sols03567-embroidery` skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 03567 Organic Raglan Sweatshirt |
| **Catalog ID** | 582 |
| **Technique** | DTFilm (API key: `dtfilm`, marketing: DTFlex) |
| **Material** | 80% organic cotton, 20% recycled polyester |
| **Fabric Weight** | ~9.2 oz/yd² (310 g/m²) |
| **Fit** | Regular, raglan sleeves, crew neck |
| **Sizes** | XS, S, M, L, XL, 2XL, 3XL |
| **Colors** | 6: Black, Bottle Green, Burgundy, Burnt Orange, Charcoal Melange, White |
| **Variants** | 41 (6 colors x 7 sizes, minus 1) |
| **Print Method** | DTFilm — PET film + adhesive + heat press 165C + cold peel |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES |
| **Base Cost** | 26.20-32.95 EUR |

---

## When to Use

- Create a new DTFilm crewneck sweatshirt on Printful using SOL'S 03567
- Upload full-color designs (gradients, photos, unlimited CMYK) to a raglan crewneck
- Apply SKAPARA branding via DTFilm sleeve placement
- Generate mockups for SOL'S 03567 DTFilm products
- Manage variant colors and sizes
- Update Supabase with product data and mockup images

---

## DTFilm Technique — Key Facts

- **Full CMYK color** — unlimited colors, gradients, photographic content
- **Smooth vinyl-like texture** — distinct from DTG's soft-ink feel
- **Process:** Design printed to PET film -> adhesive powder -> heat-cured -> heat-pressed at 165C -> cold peel
- **Works on polyester blends** (unlike DTG)
- **File types use `_dtf` suffix**: `front_dtf`, `back_dtf`, `long_sleeve_left_dtf`, `long_sleeve_right_dtf`
- **50+ washes durability**

---

## Placements & Canvas Sizes

| Placement | Printfile | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `front_dtf` | PF#1 | 1800 x 2400 | 150 | +5.25 EUR | Main design |
| `back_dtf` | PF#328 | 1800 x 2400 | 150 | +5.25 EUR | Back design (uses PF#328, NOT PF#1) |
| `long_sleeve_left_dtf` | PF#147 | 450 x 1800 | 150 | +5.25 EUR | Left sleeve branding |
| `long_sleeve_right_dtf` | PF#147 | 450 x 1800 | 150 | +5.25 EUR | Right sleeve |

**NOTE:** This product uses PF#328 (1800x2400 @150dpi) for back DTFilm, which is a different printfile than the front (PF#1). Canvas dimensions are the same but the printfile ID matters for API calls.

### Recommended SKAPARA Setup

- `front_dtf`: Main design (1800x2400 @150dpi)
- `back_dtf`: SKAPARA wordmark or complementary design (1800x2400 @150dpi)
- `long_sleeve_left_dtf`: SKAPARA S mark vertical (450x1800 @150dpi) — branding

**Total extra cost (3 placements):** +5.25 + 5.25 + 5.25 = +15.75 EUR

---

## Base Costs (Production EUR)

| Size | Base Cost | + 3 Placements | Total Production |
|---|---|---|---|
| XS | 26.20 | +15.75 | 41.95 |
| S | 26.20 | +15.75 | 41.95 |
| M | 26.20 | +15.75 | 41.95 |
| L | 26.20 | +15.75 | 41.95 |
| XL | 28.55 | +15.75 | 44.30 |
| 2XL | 30.70 | +15.75 | 46.45 |
| 3XL | 32.95 | +15.75 | 48.70 |

### Suggested Retail Pricing (40%+ margin)

| Size | Production | Retail (EUR) | Margin |
|---|---|---|---|
| XS-L | 41.95 | 72.95 | 42.5% |
| XL | 44.30 | 76.95 | 42.4% |
| 2XL | 46.45 | 79.95 | 41.9% |
| 3XL | 48.70 | 84.95 | 42.7% |

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

**Rate limits:** ~120 req/min. Use `delay(2000)` between calls.

---

## Workflow: Create New DTFilm Sweatshirt Product

### Step 1: Upload Designs to Supabase Storage + Printful File Library

Upload all placement assets:
1. Front DTFilm design (1800x2400 @150dpi) -> `FRONT_FILE_ID`
2. Back DTFilm design (1800x2400 @150dpi) -> `BACK_FILE_ID`
3. Sleeve S mark (450x1800 @150dpi) -> `SLEEVE_FILE_ID`

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
      name: 'Product Name — SOL\'S 03567 DTFilm',
      thumbnail: publicUrlFront,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: PRICES[v.size],
      is_enabled: true,
      files: [
        { type: 'front_dtf', id: FRONT_FILE_ID },
        { type: 'back_dtf', id: BACK_FILE_ID },
        { type: 'long_sleeve_left_dtf', id: SLEEVE_FILE_ID },
      ],
    })),
  }),
});
```

### Step 3: GPSR Compliance (MANDATORY for EU)

```html
<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p>
<p><strong>Material:</strong> 80% organic cotton, 20% recycled polyester (SOL'S 03567)</p>
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
  category_id: 'SWEATSHIRT_CATEGORY_UUID',
  base_price_cents: 7295,
  compare_at_price_cents: 11995,
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
    print_technique: 'DTFilm (DTFlex)',
    manufacturing_country: 'LV',
    safety_information: GPSR_HTML,
    care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Do not iron directly on print.',
  },
});
```

### Step 5: Create Product Variants + Mockups

See [VARIANTS.md](VARIANTS.md) for variant IDs. Generate mockups via:

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/582" \
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
      { "placement": "front_dtf", "image_url": "DESIGN_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } },
      { "placement": "back_dtf", "image_url": "BACK_URL", "position": { "area_width": 1800, "area_height": 2400, "width": 1800, "height": 2400, "top": 0, "left": 0 } }
    ]
  }'
```

---

## Branding Strategy — DTFilm

- **`long_sleeve_left_dtf`**: SKAPARA S mark vertical (450x1800 @150dpi)
- **`back_dtf`**: SKAPARA wordmark white on dark garments
- **No label_inside_dtf** available on this product

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| PF#328 for back | Back uses different printfile (PF#328) vs front (PF#1) — same dimensions | Use correct printfile ID |
| DTFilm smooth texture | Vinyl-like feel | Expected DTFilm characteristic |
| Cron sync margin fixer | Overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Burnt Orange contrast | Warm medium tone — test contrast with both light/dark designs | Generate mockups for both to verify |
| Charcoal Melange | Dark heathered — white/light designs preferred | Heathered texture may affect fine detail |
| White garment | Light — use dark/black designs only | Avoid white-on-white text |
| Temporary mockup URLs | S3 URLs expire ~24h | Download + re-upload to Supabase Storage |
| Cloudflare 401 | Missing User-Agent | Always include `User-Agent: POD-AI-Store/1.0` |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category (crewneck-sweatshirts)
- [ ] All colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (XS through 3XL)
- [ ] Price correct per size tier
- [ ] Mockup images load for all placements
- [ ] GPSR safety information stored in `product_details`
- [ ] Translations present (EN, ES, DE)
- [ ] Cache-buster `?v=timestamp` appended to all image URLs

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
