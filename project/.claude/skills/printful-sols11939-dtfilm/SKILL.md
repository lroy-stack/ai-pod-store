---
name: Printful SOL'S 11939 DTFilm Sports Jersey
description: >-
  Complete pipeline for SOL'S 11939 Sports Jersey (catalog 715) with DTFilm/DTFlex
  technique on Printful. 7 colors (Black, French Navy, Neon Orange, Neon Yellow, Red,
  Royal Blue, White), 5 sizes, 35 variants. DTFilm is the DEFAULT technique for this
  product because it is 100% polyester mesh and DTG fails on polyester. Covers product
  creation, variant management, DTFilm design placement including short sleeves and inside
  label, mockup generation, and Supabase integration. Use when creating DTFilm sports
  jerseys, athletic wear, gym shirts, neon sports apparel, or managing SOL'S 11939
  products. EU fulfillment from Latvia.
---

# Printful SOL'S 11939 DTFilm Sports Jersey — Complete Pipeline

Full production pipeline for SKAPARA sports jerseys using the SOL'S 11939 Sports Jersey blank with DTFilm (DTFlex) printing technique on Printful.

**CRITICAL:** DTFilm is the DEFAULT technique for this product. The SOL'S 11939 is 100% polyester mesh — DTG fails on polyester. DTFilm is the only viable full-color print method.

For embroidery on this same blank, see `printful-sols11939-embroidery` skill.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | SOL'S 11939 Sports Jersey |
| **Catalog ID** | 715 |
| **Technique** | DTFilm (API key: `dtfilm`, marketing: DTFlex) — DEFAULT |
| **Material** | 100% polyester mesh |
| **Fabric** | Breathable sports mesh, lightweight |
| **Fit** | Athletic, regular |
| **Sizes** | S, M, L, XL, 2XL |
| **Colors** | 7 (Black, French Navy, Neon Orange, Neon Yellow, Red, Royal Blue, White) |
| **Print Method** | DTFilm — PET film + adhesive + heat press 165C + cold peel |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES |
| **Base Cost** | 13.95-17.25 EUR |

**WHY DTFilm:** 100% polyester mesh cannot be printed with DTG (water-based inks do not adhere to polyester). DTFilm uses adhesive film that bonds to any fabric including polyester.

---

## When to Use

- Create a new sports jersey product on Printful using SOL'S 11939
- Upload full-color designs to polyester athletic wear
- Create SKAPARA athletic/gym branded products
- Work with neon colors (Neon Orange, Neon Yellow) and classic colors (Red, Royal Blue, White)
- Generate mockups for sports jersey products
- Manage variant colors and sizes (7 colors x 5 sizes = 35 variants)

---

## Placements & Canvas Sizes

| Placement | Printfile | Canvas (px) | DPI | Extra Cost | Notes |
|---|---|---|---|---|---|
| `front_dtf` | PF#1 | 1800 x 2400 | 150 | +5.25 EUR | Main design |
| `back_dtf` | PF#1 | 1800 x 2400 | 150 | +5.25 EUR | Back number/design |
| `short_sleeve_left_dtf` | PF#130 | 600 x 525 | 150 | +2.20 EUR | Left sleeve — SKAPARA mark |
| `short_sleeve_right_dtf` | PF#130 | 600 x 525 | 150 | +2.20 EUR | Right sleeve |
| `label_inside_dtf` | PF#71 | 450 x 450 | 150 | +0.99 EUR | Inside label — brand mark |

### Recommended SKAPARA Setup

- `front_dtf`: Main design (1800x2400 @150dpi)
- `back_dtf`: SKAPARA wordmark or jersey number (1800x2400 @150dpi)
- `short_sleeve_left_dtf`: SKAPARA S mark (600x525 @150dpi) — only +2.20 EUR
- `label_inside_dtf`: SKAPARA brand mark (450x450 @150dpi) — only +0.99 EUR

**Total extra cost (4 placements):** +5.25 + 5.25 + 2.20 + 0.99 = +13.69 EUR

---

## Base Costs (Production EUR)

| Size | Base Cost | + 4 Placements | Total Production |
|---|---|---|---|
| S | 13.95 | +13.69 | 27.64 |
| M | 13.95 | +13.69 | 27.64 |
| L | 13.95 | +13.69 | 27.64 |
| XL | 15.60 | +13.69 | 29.29 |
| 2XL | 17.25 | +13.69 | 30.94 |

### Suggested Retail Pricing (40%+ margin)

| Size | Production | Retail (EUR) | Margin |
|---|---|---|---|
| S-L | 27.64 | 47.95 | 42.3% |
| XL | 29.29 | 49.95 | 41.4% |
| 2XL | 30.94 | 52.95 | 41.6% |

**This is the most affordable SKAPARA apparel product** — great for sports/gym positioning.

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

## Workflow: Create New DTFilm Sports Jersey

### Step 1: Upload Designs to Supabase Storage + Printful File Library

Upload all placement assets:
1. Front DTFilm design (1800x2400 @150dpi) -> `FRONT_FILE_ID`
2. Back DTFilm design (1800x2400 @150dpi) -> `BACK_FILE_ID`
3. Sleeve S mark (600x525 @150dpi) -> `SLEEVE_FILE_ID`
4. Label brand mark (450x450 @150dpi) -> `LABEL_FILE_ID`

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
      name: 'Product Name — SOL\'S 11939 DTFilm',
      thumbnail: publicUrlFront,
    },
    sync_variants: variants.map(v => ({
      variant_id: v.variant_id,
      retail_price: PRICES[v.size],
      is_enabled: true,
      files: [
        { type: 'front_dtf', id: FRONT_FILE_ID },
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
<p><strong>Material:</strong> 100% polyester mesh (SOL'S 11939)</p>
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
  category_id: 'JERSEY_CATEGORY_UUID',
  base_price_cents: 4795,
  compare_at_price_cents: 7995,
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
curl -X POST "https://api.printful.com/mockup-generator/create-task/715" \
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

- **`short_sleeve_left_dtf`**: SKAPARA S mark (600x525 @150dpi) — only +2.20 EUR
- **`label_inside_dtf`**: SKAPARA brand mark (450x450 @150dpi) — only +0.99 EUR
- **`back_dtf`**: SKAPARA wordmark or skapara.com URL
- **Neon garments**: Use dark/black DTFilm branding on Neon Orange and Neon Yellow
- **White garments**: Use dark/black DTFilm branding (same as Neon colors)

---

## Color Notes

- **Black** and **French Navy** are dark — use white/light DTFilm designs
- **Red** is a dark color — use white/light DTFilm designs
- **Royal Blue** is a dark color — use white/light DTFilm designs
- **White** is a light color — use dark/black DTFilm designs (same treatment as Neon colors)
- **Neon Orange** and **Neon Yellow** are vibrant/light — use dark/black DTFilm designs
- **Neon colors** are unique to this product in the SKAPARA catalog — great for sports positioning
- **Design groups:** You need at minimum TWO design versions — white artwork (for Black, French Navy, Red, Royal Blue) and dark artwork (for White, Neon Orange, Neon Yellow)

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| DTG NOT possible | 100% polyester — DTG inks do not adhere | Use DTFilm (default) or embroidery |
| Neon/White colors need dark designs | Neon Orange/Yellow/White are light | Use black/dark DTFilm artwork |
| Cron sync margin fixer | Overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Temporary mockup URLs | S3 URLs expire ~24h | Download + re-upload to Supabase Storage |
| Cloudflare 401 | Missing User-Agent | Always include `User-Agent: POD-AI-Store/1.0` |

---

## Post-Creation Checklist

- [ ] Product appears in shop with correct category
- [ ] All 7 colors show in ProductCard color toggles
- [ ] Sizes correctly parsed (S through 2XL)
- [ ] Price correct per size tier
- [ ] Mockup images load for all placements
- [ ] GPSR safety information stored in `product_details`
- [ ] Translations present (EN, ES, DE)
- [ ] Neon and White color variants have dark-ink design mockups (not white text)
- [ ] Red and Royal Blue variants have white/light design mockups
- [ ] Cache-buster `?v=timestamp` appended to all image URLs

See [VARIANTS.md](VARIANTS.md) for complete variant ID table.
