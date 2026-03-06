---
name: Printful Otto Cap 104-1018 DTFilm Production
description: >-
  Complete pipeline for Otto Cap 104-1018 Distressed Dad Hat (catalog 396) with DTFlex/DTFilm
  technique on Printful. Covers product creation, variant management, DTFilm design placement,
  mockup generation, and Supabase integration. Use when creating DTFlex dad hat products,
  DTFilm hats, direct to film hats, full color hats, gradient hats, photo hats, or managing
  distressed dad hat products with dtf printing.
---

# Printful Otto Cap 104-1018 DTFilm Production Pipeline

Full production pipeline for SKAPARA distressed dad hats using the Otto Cap 104-1018 blank with DTFlex (DTFilm) technique on Printful. The 104-1018 is a pre-shrunk cotton twill dad hat with intentional distressing on the brim and fabric for a vintage, worn-in aesthetic.

For embroidered hats (thread-based designs), see the `design-embroidery` skill instead.
For DTG t-shirts and apparel, see the `printful-cc1717` or `printful-tshirt` skills.

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | Otto Cap 104-1018 |
| **Catalog ID** | 396 |
| **Material** | 100% pre-shrunk cotton twill |
| **Construction** | Soft crown, distressed brim/fabric |
| **Sizes** | One size |
| **Colors** | 4 (Black, Charcoal Grey, Khaki, Navy) |
| **Print Method** | DTFlex / DTFilm (API key: `dtfilm`) |
| **Producer** | Printful (Latvia) |
| **EU Fulfillment** | YES — Latvia/Spain |

---

## When to Use

- Create a new DTFlex/DTFilm dad hat product on Printful
- Upload full-color, gradient, or photographic designs to distressed dad hats
- Generate mockups for Otto Cap 104-1018 DTFilm products
- Update Supabase with hat product data and mockup images
- Manage 104-1018 variant colors (enable/disable based on design compatibility)

---

## DTFlex Technical Process

DTFlex is Printful's premium Direct-to-Film (DTF) technique, perfected over a decade of testing and offered exclusively through Printful.

### Process Steps

1. **Design printed to PET film** — CMYK inks + white underbase layer
2. **Adhesive powder applied** — thermoplastic powder coating
3. **Heat-cured** — powder fused to ink layer
4. **Heat-pressed onto fabric at 165C** — transferred to the hat
5. **Cold peel** — produces clean edges without glue halo

### DTFlex vs Embroidery Comparison

| Factor | DTFlex (this skill) | Embroidery |
|---|---|---|
| **Colors** | Unlimited CMYK | 15 threads (6 max/design) |
| **Gradients** | YES — full gradient support | Only with unlimited_color (+3.25EUR) |
| **Photographic content** | YES | NO |
| **Fine detail** | Thin lines, small text OK | 1.5mm min line, 5mm min text |
| **Texture/feel** | Smooth vinyl-like finish | Raised textured 3D feel |
| **Durability** | 50+ washes | Excellent (best) |
| **Print area** | 5.00" x 2.00" (larger) | 5.50" x 2.00" (front), 4.00" x 1.75" (others) |
| **Cost per placement** | +2.60 EUR | +2.95 EUR |
| **Placements available** | FRONT ONLY | Front + Back + Left + Right |
| **Premium feel** | Modern/clean/graphic | Classic/luxury/artisan |
| **Best for** | Logos with gradients, photo prints, complex multi-color designs | Simple iconic marks, monochrome text, classic branding |

### Key Advantage

DTFlex allows **unlimited colors, gradients, and photographic content** on hats at a **lower cost** (+2.60 EUR vs +2.95 EUR) and **larger print area** (5.00"x2.00" vs 4.00"x1.75" for standard embroidery front).

### Key Limitation

DTFlex on hats supports **FRONT PLACEMENT ONLY**. No back, left, or right side printing. All branding must be integrated into the front design itself.

---

## Placement & Canvas Size

Single placement only — all at 300 DPI:

| Placement | API File Type | Printfile | Canvas (px) | Physical | Extra Cost |
|---|---|---|---|---|---|
| `front_dtf_hat` | `front_dtf_hat` | PF#816 | 1500 x 600 @300dpi | 5.00" x 2.00" | +2.60 EUR |

**CRITICAL:** This is the ONLY available placement for DTFilm hats. No `back`, `left`, `right`, or `label` placements exist in DTFilm mode.

**BRANDING RULE:** Since only front placement exists, the SKAPARA brand mark or text MUST be integrated INTO the front design itself. Options:
- Small S mark in corner of design (recommended)
- "SKAPARA" text as part of the design composition
- S mark watermark integrated into the artwork
- Brand signature line at bottom of design area

---

## Base Costs (Production)

| Color | Base Cost (EUR) | DTFilm Placement | Total Production Cost |
|---|---|---|---|
| Black | 11.95 | +2.60 | 14.55 |
| Charcoal Grey | 11.95 | +2.60 | 14.55 |
| Khaki | 14.45 | +2.60 | 17.05 |
| Navy | 11.95 | +2.60 | 14.55 |

---

## Pricing (>=35% Margin Rule)

**CRITICAL:** The cron sync margin fixer overwrites prices if margin falls below 35%. Set correct prices in Printful FIRST.

| Color | Production Cost | Min Retail (35%) | Recommended Retail | Margin |
|---|---|---|---|---|
| Black | 14.55 EUR | 22.39 EUR | 24.99 EUR | 41.8% |
| Charcoal Grey | 14.55 EUR | 22.39 EUR | 24.99 EUR | 41.8% |
| Khaki | 17.05 EUR | 26.23 EUR | 27.99 EUR | 39.1% |
| Navy | 14.55 EUR | 22.39 EUR | 24.99 EUR | 41.8% |

Formula: `retail_price >= production_cost / 0.65`

**Recommended strategy:** Set all variants to 24.99 EUR (Black/Charcoal/Navy) and 27.99 EUR (Khaki) for consistent >=35% margins.

---

## 8-Step Production Pipeline

### Step 1: Design the DTFilm Artwork

Create a 1500x600px @300dpi PNG design for the front placement.

**Design capabilities (DTFilm allows ALL of these):**
- Full CMYK unlimited colors
- Smooth gradients and color transitions
- Photographic/raster content
- Fine lines and small text
- Transparency (will show hat fabric through transparent areas)

**BRANDING INTEGRATION (MANDATORY):**
Since DTFilm only supports front placement, integrate SKAPARA branding INTO the front design:
- Option A: Small S mark (isotipo) in bottom-right corner (~100x100px area)
- Option B: "SKAPARA" text as subtle part of design composition
- Option C: S mark watermark blended into artwork

**Canvas specs:**
```
Width:  1500px (5.00")
Height:  600px (2.00")
DPI:     300
Format:  PNG (transparent background OK)
Color:   sRGB
```

### Step 2: Upload Design to Supabase Storage

```bash
# Upload to Supabase Storage (permanent hosting)
curl -X POST "${SUPABASE_URL}/storage/v1/object/designs/uploads/${FILENAME}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary "@${LOCAL_FILE_PATH}"

# Get public URL
PUBLIC_URL="${SUPABASE_URL}/storage/v1/object/public/designs/uploads/${FILENAME}"
```

### Step 3: Upload Design to Printful File Library

```bash
curl -X POST "https://api.printful.com/files" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'${PUBLIC_URL}'",
    "filename": "'${FILENAME}'"
  }'
```

**Response:** `{ "result": { "id": 123456789, "type": "default", "preview_url": "..." } }`

Save the `id` as `FRONT_FILE_ID`.

### Step 4: Create Sync Product on Printful

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "sync_product": {
      "name": "Product Name — Otto Cap 104-1018 DTFlex",
      "thumbnail": "https://files.cdn.printful.com/files/.../preview.png"
    },
    "sync_variants": [
      {
        "variant_id": 10990,
        "retail_price": "24.99",
        "files": [
          { "type": "front_dtf_hat", "id": FRONT_FILE_ID }
        ],
        "options": [
          { "id": "technique", "value": "dtfilm" }
        ]
      },
      {
        "variant_id": 10991,
        "retail_price": "24.99",
        "files": [
          { "type": "front_dtf_hat", "id": FRONT_FILE_ID }
        ],
        "options": [
          { "id": "technique", "value": "dtfilm" }
        ]
      },
      {
        "variant_id": 10992,
        "retail_price": "27.99",
        "files": [
          { "type": "front_dtf_hat", "id": FRONT_FILE_ID }
        ],
        "options": [
          { "id": "technique", "value": "dtfilm" }
        ]
      },
      {
        "variant_id": 10993,
        "retail_price": "24.99",
        "files": [
          { "type": "front_dtf_hat", "id": FRONT_FILE_ID }
        ],
        "options": [
          { "id": "technique", "value": "dtfilm" }
        ]
      }
    ]
  }'
```

**Key points:**
- `variant_id` is the catalog variant ID from VARIANTS.md
- `retail_price` is the customer-facing price as a string
- `files[].type` MUST be `"front_dtf_hat"` (NOT `"default"` or `"embroidery_front"`)
- `options` MUST include `{ "id": "technique", "value": "dtfilm" }` to select DTFilm technique
- Only ONE file entry per variant (front only — no back/side placements available)

### Step 5: Set Variant Prices

Verify prices are set correctly. Update individual variants if needed:

```bash
curl -X PUT "https://api.printful.com/store/variants/${SYNC_VARIANT_ID}" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "retail_price": "24.99"
  }'
```

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites if margin <35%.

### Step 6: Generate Mockups

```bash
curl -X POST "https://api.printful.com/mockup-generator/create-task/396" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "variant_ids": [10990],
    "format": "png",
    "width": 1000,
    "option_groups": ["Front"],
    "files": [
      {
        "placement": "front_dtf_hat",
        "image_url": "DESIGN_PREVIEW_URL",
        "position": {
          "area_width": 1500,
          "area_height": 600,
          "width": 1500,
          "height": 600,
          "top": 0,
          "left": 0
        }
      }
    ]
  }'
```

**Poll task status:**
```bash
curl -s "https://api.printful.com/mockup-generator/task?task_key=gt-XXXXX" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}"
```

**Rate limits for mockups:** ~10 req/min. Use `delay(10000)` between tasks.

Generate mockups for each color variant (10990=Black, 10991=Charcoal Grey, 10992=Khaki, 10993=Navy).

**Download and re-upload:** Mockup S3 URLs expire ~24h. Always download and re-upload to Supabase Storage:

```javascript
const storagePath = `designs/mockups/${productSlug}/${colorSlug}-front.png`
const ts = Math.floor(Date.now() / 1000)
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`
```

### Step 7: Update Supabase — Product + Variants

```javascript
const ts = Math.floor(Date.now() / 1000)

const images = [
  { src: `https://.../mockups/slug/black-front.png?v=${ts}`, alt: 'Title - Black' },
  { src: `https://.../mockups/slug/charcoal-grey-front.png?v=${ts}`, alt: 'Title - Charcoal Grey' },
  { src: `https://.../mockups/slug/khaki-front.png?v=${ts}`, alt: 'Title - Khaki' },
  { src: `https://.../mockups/slug/navy-front.png?v=${ts}`, alt: 'Title - Navy' },
]

// 1. Create or update product in Supabase
await supabase.from('products').upsert({
  id: productId,
  title: 'Product Name',
  description: 'Creative marketing description only. No specs here.',
  translations: {
    es: { title: 'Titulo en espanol', description: 'Descripcion en espanol' },
    de: { title: 'Titel auf Deutsch', description: 'Beschreibung auf Deutsch' }
  },
  category_id: 'CATEGORY_UUID', // FK to categories table — dad-hats or caps
  pod_provider: 'printful',
  product_template_id: '396', // Otto Cap 104-1018 catalog ID
  provider_product_id: String(pfProductId), // Printful sync product ID
  base_price_cents: 2499,
  compare_at_price_cents: 4499, // Strikethrough price — must be > base_price_cents
  images,
  product_details: {
    safety_information: GPSR_HTML, // See Step 8
    material: '100% Pre-Shrunk Cotton Twill',
    care_instructions: 'Spot clean recommended. Hand wash cold. Air dry. Do not bleach. Do not iron directly on print.',
    print_technique: 'DTFlex (Direct-to-Film)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    blank: 'Otto Cap 104-1018',
    construction: 'Soft crown, distressed brim/fabric',
    fit: 'One size adjustable'
  },
  status: 'active'
})

// 2. Create product variants (all 4 colors, one size each)
const colors = [
  { color: 'Black', hex: '#000000', variantId: 10990, price: 2499 },
  { color: 'Charcoal Grey', hex: '#555555', variantId: 10991, price: 2499 },
  { color: 'Khaki', hex: '#C3B091', variantId: 10992, price: 2799 },
  { color: 'Navy', hex: '#1B2A4A', variantId: 10993, price: 2499 },
]

for (const { color, hex, variantId, price } of colors) {
  await supabase.from('product_variants').upsert({
    product_id: productId,
    color,
    color_hex: hex,
    size: 'One size',
    is_enabled: true,
    external_variant_id: String(variantId),
    image_url: `https://.../mockups/slug/${colorSlug}-front.png?v=${ts}`
  })
}
```

### Step 8: GPSR Compliance (MANDATORY for EU)

Every product MUST have GPSR data before going live. EU Regulation 2023/988.

```html
<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p>
<p><strong>Material:</strong> 100% Pre-Shrunk Cotton Twill (Otto Cap 104-1018)</p>
<p><strong>Construction:</strong> Soft crown, distressed brim/fabric</p>
<p><strong>Print technique:</strong> DTFlex (Direct-to-Film) — CMYK + white underbase, heat-pressed at 165C, cold peel</p>
<p><strong>Care:</strong> Spot clean recommended. Hand wash cold. Air dry. Do not bleach. Do not iron directly on print.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

Store in `products.product_details.safety_information` (JSONB).

---

## Printful API Reference

**Auth headers (ALL requests):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
User-Agent: POD-AI-Store/1.0
```

**Store ID:** `17795695` (Skapara)

**Rate limits:**
- General API: ~120 req/min. Use `delay(2000)` between calls
- Mockup Generator: ~10 req/min. Use `delay(10000)` between tasks
- On 429: read `x-ratelimit-reset` header, wait that many seconds, retry

**Shared utility:** For scripts, use `import { createPrintfulClient } from './lib/printful-rate-limiter.mjs'`

**Key endpoints:**

| Endpoint | Method | Use |
|---|---|---|
| `/files` | POST | Upload image to File Library |
| `/store/products` | POST | Create new sync product |
| `/store/products/{id}` | GET/PUT | Read/update sync product + all variants |
| `/store/variants/{vid}` | PUT | Update single variant |
| `/mockup-generator/create-task/396` | POST | Create Otto Cap 104-1018 mockup task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |
| `/mockup-generator/printfiles/396` | GET | List 104-1018 print positions |

---

## Description Rules

**What goes in `description`** (creative text only):
- Product context, design inspiration, target audience
- 2-3 sentences max, casual but smart tone
- Highlight the DTFlex technique: "full-color DTFlex print", "vibrant gradient detail", "photo-quality transfer"
- Mention the vintage distressed aesthetic: "worn-in cotton twill", "distressed vintage look"
- Must be translated to EN, ES, DE

**What does NOT go in `description`:**
- Material composition -> `product_details.material`
- Care instructions -> `product_details.care_instructions`
- Manufacturing info -> `product_details.manufacturing_country`
- Safety/compliance -> `product_details.safety_information`

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| FRONT ONLY | DTFilm on hats has no back/side placements | Integrate branding into front design |
| Technique option required | Must pass `{ "id": "technique", "value": "dtfilm" }` in variant options | Always include in create/update calls |
| File type confusion | API type is `front_dtf_hat`, NOT `default` or `embroidery_front` | Use exact string `front_dtf_hat` |
| Temporary mockup URLs | S3 URLs expire ~24h | Download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib | Use curl or Node.js fetch |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` |
| Cache-busting | Browser/CDN caches images by URL | ALWAYS append `?v=timestamp` to image URLs |
| Khaki higher base | Khaki variant costs 14.45 EUR vs 11.95 EUR | Price Khaki at 27.99 EUR to maintain margin |

---

## Post-Creation Checklist

After creating a DTFilm dad hat product, verify:

- [ ] Product appears in shop with correct category (dad-hats or caps)
- [ ] All 4 color variants show in ProductCard color toggles
- [ ] Size shows as "One size"
- [ ] Price is correct per color (24.99 EUR or 27.99 EUR for Khaki)
- [ ] Price not overridden by margin fixer (>=35% margin)
- [ ] Mockup images load for front view (only placement available)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] SKAPARA branding integrated into front design (no separate back/side branding possible)
- [ ] Alt text follows pattern: "Title - Color"
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
- [ ] Translations present (EN, ES, DE)
