---
name: Printful iPhone Snap Case Production
description: >-
  Complete pipeline for iPhone Snap Case (catalog 683) on Printful.
  12 iPhone models (iPhone 15 through iPhone 17 Pro Max), 2 finishes (Glossy + Matte), 24 variants.
  Covers sublimation design, product creation, variant management, mockup generation, and Supabase
  integration. Use when creating iPhone case products, generating phone case mockups, or managing
  sublimation-printed accessories.
---

# Printful iPhone Snap Case Production Pipeline

Full production pipeline for SKAPARA-branded iPhone Snap Cases using sublimation (heat press) on Printful. One design file works across all 12 supported iPhone models (iPhone 15 through 17 Pro Max). 2 finishes available (Glossy and Matte). 24 total variants. Produced in-house at Printful Latvia (Riga) — confirmed EU fulfillment.

For other phone case types (Samsung, MagSafe), refer to the API-VERIFIED-CATALOG.md for related CAT IDs (681, 682, 684, 686, 601, 605, 798, 799).

---

## Product Specifications

| Property | Value |
|---|---|
| **Blank** | iPhone Snap Case |
| **Catalog ID** | 683 |
| **Tier** | ACCESSORIES |
| **Material** | Polycarbonate |
| **Finish** | Glossy AND Matte |
| **Finishes** | 2 (Glossy, Matte) |
| **Models** | 12 iPhone models (iPhone 15 through iPhone 17 Pro Max) |
| **Variants** | 24 total (12 models x 2 finishes) |
| **Print Method** | Sublimation (heat press) |
| **Producer** | Printful (Latvia — Riga, in-house) |
| **EU Fulfillment** | YES — confirmed |

---

## When to Use

- Create a new iPhone Snap Case product on Printful
- Upload sublimation designs for phone cases
- Generate mockups for iPhone case products
- Manage iPhone model variants (12 models, 2 finishes)
- Update Supabase with iPhone case product data and mockup images
- Expand the accessories category in the SKAPARA catalog
- Choose between Glossy and Matte finish variants

---

## Sublimation (Heat Press) — Technique Specifications

Sublimation infuses ink INTO the polycarbonate surface using heat and pressure. The result is a durable, vibrant print that does not peel, crack, or fade.

| Property | Value |
|---|---|
| **Color space** | Full CMYK — vibrant, photographic quality |
| **Resolution** | 300 DPI |
| **Surface** | Flat polycarbonate + slight edge wrap |
| **Durability** | Scratch-resistant, will not peel or crack |
| **Opacity** | Full coverage — glossy finish |
| **Fill mode** | `cover` (design covers entire printable area, edges may crop) |

### Design Considerations for iPhone Snap Case

1. **ONE design = ALL 12 models**: A single printfile (PF#438, 1328x2197) works across all models. Printful scales and crops automatically per model.
2. **Edge wrap**: The design wraps slightly around the case edges. Content at the very edges (outer ~50px on each side) may wrap and be partially hidden.
3. **Safe zone**: Keep critical design elements (text, logos, faces) within a centered safe area. Recommended safe zone: 1128x1897 px (100px inset on all sides).
4. **Camera cutout**: Each iPhone model has a different camera cutout position. Printful handles this automatically — the design is printed, then the case is cut for the specific model. Avoid placing critical content in the upper-left area where camera cutouts are typically located.
5. **Vertical orientation**: The canvas is portrait (1328 wide x 2197 tall). Design for vertical viewing.
6. **TWO finishes available**:
   - **Glossy**: Colors appear saturated and vibrant. Blacks are deep. High contrast designs look excellent.
   - **Matte**: Softer, non-reflective surface. Colors appear slightly muted. Fingerprint-resistant. Premium feel.
   - **Design note**: Matte finish available — design should avoid glossy-dependent visual effects (e.g., metallic sheen, specular highlights) if targeting Matte variant. Flat colors, bold graphics, and matte-friendly palettes work best on Matte.

### Canvas & Printfile

| Placement | Printfile | Canvas (px) | DPI | Physical | Fill |
|---|---|---|---|---|---|
| `default` | PF#438 | 1328 x 2197 | 300 | ~4.43" x 7.32" | cover |

---

## SKAPARA Branding for iPhone Case

The iPhone Snap Case has a single `default` placement. SKAPARA branding must be **integrated into the case design itself**, with the brand mark positioned in the lower third.

### Recommended Layout (1328 x 2197 px)

```
+---------------------------+
|                           |
|  [Camera cutout zone]    |  <- Avoid upper-left ~300x300px
|                           |
|                           |
|                           |
|     MAIN DESIGN AREA      |
|     (centered content)    |
|                           |
|                           |
|                           |
|                           |
|  +---------------------+  |
|  | SKAPARA brand mark  |  |  <- Lower third (~bottom 600px)
|  | S mark or wordmark  |  |
|  | centered, ~200px h  |  |
|  +---------------------+  |
|                           |
+---------------------------+
  ^50px^              ^50px^
     EDGE WRAP ZONES
```

**Branding placement rules:**
- Position SKAPARA brand mark in the lower third of the design
- Use S mark isotipo (centered, ~200px height) or SKAPARA wordmark
- Brand mark should complement the design — not feel stamped on
- On dark backgrounds: white S mark or white wordmark
- On light backgrounds: dark S mark or gradient S mark
- On busy/photo backgrounds: semi-transparent S mark with subtle drop shadow

**Branding assets** (in `/frontend/public/brand/`):
- `skapara-mark-color.svg` — Full color S mark
- `skapara-mark-dark.svg` — Dark S mark
- `skapara-mark-white.svg` — White S mark
- `skapara-wordmark-dark.svg` — Dark wordmark

---

## Base Costs (Production)

All 24 variants (12 models x 2 finishes) have the same base cost:

| Model | Base Cost (EUR) | Notes |
|---|---|---|
| All iPhone models (Glossy) | 14.25 | Flat rate, single placement |
| All iPhone models (Matte) | 14.25 | Flat rate, single placement |

No additional placement costs — the `default` placement is included.

---

## Pricing Strategy

Target minimum 35% margin per SKAPARA pricing rules.

| Retail Price (EUR) | Base Cost | Margin | Notes |
|---|---|---|---|
| 22.99 | 14.25 | 38.0% | Minimum recommended |
| 24.99 | 14.25 | 43.0% | Standard pricing |
| 27.99 | 14.25 | 49.1% | Premium design pricing |
| 29.99 | 14.25 | 52.5% | Limited edition / collab |

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

---

## Printful API Reference

**Auth headers (ALL requests):**
```
Authorization: Bearer ${PRINTFUL_API_TOKEN}
X-PF-Store-Id: ${PRINTFUL_STORE_ID}
Content-Type: application/json
User-Agent: POD-AI-Store/1.0
```

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
| `/mockup-generator/create-task/683` | POST | Create iPhone case mockup task |
| `/mockup-generator/task?task_key=gt-xxx` | GET | Poll mockup task status |
| `/mockup-generator/printfiles/683` | GET | List iPhone case print positions |

---

## Workflow: Create New iPhone Snap Case Product

### Step 1: Design the Case (1328 x 2197 px @ 300 DPI)

Create the sublimation design as a PNG file:
- Canvas: 1328 x 2197 px
- Resolution: 300 DPI
- Color mode: sRGB
- Format: PNG (NO transparency — sublimation requires full coverage)
- Integrate SKAPARA branding into lower third (see Branding section above)
- Avoid critical content in upper-left camera cutout zone (~300x300px)

**Design safe zone:**
- All edges: 100px wrap buffer
- Camera zone: upper-left 300x300px
- Critical content: center 1128 x 1897 px

### Step 2: Upload Design to File Library

Upload to Supabase Storage first (permanent hosting), then POST the public URL to Printful.

```bash
# Upload to Supabase Storage
curl -X POST "${SUPABASE_URL}/storage/v1/object/designs/uploads/${FILENAME}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary "@${LOCAL_FILE_PATH}"

# Get public URL
PUBLIC_URL="${SUPABASE_URL}/storage/v1/object/public/designs/uploads/${FILENAME}"

# Upload to Printful File Library
curl -X POST "https://api.printful.com/files" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "url": "'${PUBLIC_URL}'",
    "filename": "'${FILENAME}'"
  }'
```

**Response:** `{ "result": { "id": 123456789, "type": "default", "preview_url": "..." } }`

Save the `id` — this is the `CASE_FILE_ID` used in all subsequent API calls.

### Step 3: Create Sync Product

Create the product with ALL 24 variants (12 models x 2 finishes). Every variant uses the same design file.

```bash
curl -X POST "https://api.printful.com/store/products" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "sync_product": {
      "name": "Product Name — iPhone Snap Case",
      "thumbnail": "https://files.cdn.printful.com/files/.../preview.png"
    },
    "sync_variants": [
      { "variant_id": VARIANT_ID_1, "retail_price": "24.99", "files": [{ "type": "default", "id": CASE_FILE_ID }] },
      { "variant_id": VARIANT_ID_2, "retail_price": "24.99", "files": [{ "type": "default", "id": CASE_FILE_ID }] }
    ]
  }'
```

**See VARIANTS.md for ALL 24 variant IDs.**

**Key points:**
- `variant_id` is the **catalog variant ID** — each iPhone model + finish combination has a unique ID
- `retail_price` is the same for all variants (same base cost)
- `files[].type` = `"default"` for the case print
- Include ALL 24 variants (12 models x 2 finishes) in a single product
- The `files` array is identical for all variants (one design scales to all models)

### Step 4: Set Variant Prices

All variants use the same price (flat base cost across all models and finishes):

| Models | Retail Price | Base Cost | Margin |
|---|---|---|---|
| All 12 models (Glossy) | 24.99 | 14.25 | 43.0% |
| All 12 models (Matte) | 24.99 | 14.25 | 43.0% |

**CRITICAL:** Set prices in Printful FIRST. The cron sync margin fixer overwrites prices if margin falls below 35%.

### Step 5: Generate Mockups

Generate mockups for representative models (not all 24 — choose 3-4 hero models in both finishes):

```bash
# iPhone 16 Pro as hero mockup
curl -X POST "https://api.printful.com/mockup-generator/create-task/683" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: POD-AI-Store/1.0" \
  -d '{
    "variant_ids": [IPHONE_16_PRO_VARIANT_ID],
    "format": "png",
    "width": 1000,
    "files": [
      {
        "placement": "default",
        "image_url": "DESIGN_PREVIEW_URL",
        "position": {
          "area_width": 1328,
          "area_height": 2197,
          "width": 1328,
          "height": 2197,
          "top": 0,
          "left": 0
        }
      }
    ]
  }'
```

**Recommended hero models for mockups:**
1. iPhone 17 Pro (newest flagship)
2. iPhone 16 Pro Max (current popular flagship)
3. iPhone 15 Pro (widely owned)
4. iPhone 15 (entry-level current gen)

**Generate both Glossy and Matte mockups for at least the primary hero model.**

Poll for completion:
```bash
curl -s "https://api.printful.com/mockup-generator/task?task_key=gt-XXXXXXXX" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "X-PF-Store-Id: ${PRINTFUL_STORE_ID}" \
  -H "User-Agent: POD-AI-Store/1.0"
```

### Step 6: Download Mockups & Upload to Supabase Storage

Mockup S3 URLs expire in ~24h. Always download and re-upload to permanent storage:

```javascript
const storagePath = `designs/mockups/${productSlug}/${modelSlug}-default.png`
const ts = Math.floor(Date.now() / 1000)
const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`
```

### Step 7: Update Supabase products Table

```javascript
const ts = Math.floor(Date.now() / 1000)

const images = [
  // Hero mockups first
  { src: `https://.../mockups/slug/iphone-16-pro-default.png?v=${ts}`, alt: 'Title - iPhone 16 Pro' },
  { src: `https://.../mockups/slug/iphone-17-pro-default.png?v=${ts}`, alt: 'Title - iPhone 17 Pro' },
  { src: `https://.../mockups/slug/iphone-15-pro-default.png?v=${ts}`, alt: 'Title - iPhone 15 Pro' },
  { src: `https://.../mockups/slug/iphone-15-default.png?v=${ts}`, alt: 'Title - iPhone 15' },
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
  category_id: 'PHONE_CASES_CATEGORY_UUID', // FK to categories table
  pod_provider: 'printful',
  product_template_id: '683', // iPhone Snap Case catalog ID
  provider_product_id: String(pfProductId), // Printful sync product ID
  base_price_cents: 2499,
  compare_at_price_cents: 3999, // Strikethrough price
  images,
  product_details: {
    safety_information: GPSR_HTML,
    material: 'Polycarbonate',
    care_instructions: 'Wipe clean with damp cloth. Avoid harsh chemicals or abrasives. Remove case before wireless charging if experiencing issues.',
    print_technique: 'Sublimation (heat press)',
    manufacturing_country: 'Latvia',
    brand: 'SKAPARA',
    blank: 'iPhone Snap Case',
    finish: 'Glossy / Matte',
    compatibility: '12 iPhone models (iPhone 15 - iPhone 17 Pro Max), 2 finishes'
  },
  status: 'active'
})

// 2. Create product variants (all 24 = 12 models x 2 finishes)
for (const { model, finish, variantId } of allVariants) {
  await supabase.from('product_variants').upsert({
    product_id: productId,
    color: finish, // 'Glossy' or 'Matte' — use finish as "color" dimension
    color_hex: finish === 'Glossy' ? '#FFFFFF' : '#E0E0E0',
    size: model, // e.g., "iPhone 15 Pro"
    is_enabled: true,
    external_variant_id: String(variantId),
    image_url: `https://.../mockups/slug/${modelSlug}-${finish.toLowerCase()}-default.png?v=${ts}`
  })
}
```

**NOTE on variant mapping**: iPhone cases use the `size` field for the model name (e.g., "iPhone 15 Pro") and the `color` field for the finish ("Glossy" or "Matte"). This gives 24 total variants (12 models x 2 finishes).

### Step 8: GPSR Compliance (MANDATORY for EU)

Every product MUST have GPSR data before going live. EU Regulation 2023/988.

```html
<p><strong>Manufacturer:</strong> Printful Inc., Riga, Latvia</p>
<p><strong>Material:</strong> Polycarbonate (snap-on case)</p>
<p><strong>Finish:</strong> Glossy or Matte sublimation print</p>
<p><strong>Print technique:</strong> Sublimation (heat press) — ink infused into polycarbonate surface</p>
<p><strong>Care:</strong> Wipe clean with damp cloth. Avoid harsh chemicals or abrasives.</p>
<p><strong>Compliance:</strong> REACH compliant, RoHS compliant</p>
<p><strong>Compatibility:</strong> 12 iPhone models (iPhone 15 through iPhone 17 Pro Max)</p>
```

Store in `products.product_details.safety_information` (JSONB).

### Step 9: Post-Creation Verification

- [ ] Product appears in shop with correct category (phone-cases or accessories)
- [ ] All 24 variants show (12 models x 2 finishes) in variant selector
- [ ] Glossy and Matte finishes appear as color options
- [ ] Price is correct for all variants (not overridden by margin fixer)
- [ ] Hero mockup images load (3-4 representative models)
- [ ] GPSR safety information stored in `product_details`
- [ ] Description is clean (no HTML tags, max 2000 chars)
- [ ] Alt text follows pattern: "Title - iPhone Model"
- [ ] Cache-buster `?v=timestamp` appended to all image URLs
- [ ] Translations present for ES and DE
- [ ] Variant selector shows iPhone model names (not generic sizes)

---

## Known Issues & Gotchas

| Issue | Detail | Workaround |
|---|---|---|
| 24 variants = many mockups | Generating mockups for all 24 variants is expensive (rate limit) | Generate for 3-4 hero models in both finishes, reuse for listing |
| Camera cutout position varies | Each model has different camera placement | Avoid critical content in upper-left ~300x300px |
| Fill mode is `cover` | Design may be cropped at edges to fill entire case | Keep critical content in safe zone (100px inset) |
| No transparency | Sublimation requires full coverage — transparent areas print as white | Use opaque designs only |
| TWO finishes (Glossy + Matte) | Both finishes available for all 12 models | Design should be finish-agnostic or provide variants |
| Matte visual differences | Colors appear slightly muted on Matte, no specular reflections | Avoid glossy-dependent visual effects for Matte variants |
| Size field as model name | The `size` field in product_variants stores "iPhone 15 Pro" etc. | Frontend VariantSelector must handle non-standard size strings |
| Finish as color field | The `color` field stores "Glossy" or "Matte" | Frontend must show finish selector alongside model selector |
| Temporary mockup URLs | S3 URLs expire ~24h | Always download + re-upload to Supabase Storage |
| Python urllib blocked | Cloudflare rejects Python urllib against Printful API | Use curl or Node.js fetch |
| Margin fixer | Cron sync overwrites prices if margin <35% | Set correct price in Printful FIRST |
| Cloudflare 403 | Missing User-Agent causes blocks | Always include `User-Agent: POD-AI-Store/1.0` |
| Cache-busting | Browser/CDN cache images by URL | ALWAYS append `?v=timestamp` when overwriting Supabase Storage files |
| iPhone 17 series new | iPhone 17, 17 Air, 17 Pro, 17 Pro Max recently added | Verify variant IDs from API before first use |

---

## Related Products (Other Case Types — NOT in this skill)

These share similar pipelines but have different CAT IDs and may have different printfiles:

| Product | CAT ID | Type | Notes |
|---|---|---|---|
| Samsung Galaxy Snap Case | 681 | Sublimation | Different printfile dimensions |
| Samsung Galaxy Case (variant) | 682 | Sublimation | — |
| iPhone Case (variant) | 684 | Sublimation | May be tough/rugged variant |
| iPhone Case (variant) | 686 | Sublimation | — |
| iPhone Case (variant) | 601 | Sublimation | Older catalog entry |
| iPhone Case (variant) | 605 | Sublimation | — |
| iPhone MagSafe Case | 798 | Sublimation | MagSafe compatible |
| iPhone MagSafe Case (variant) | 799 | Sublimation | — |

---

## Description Rules

**What goes in `description`** (creative text only):
- Product context, design inspiration, target audience
- 2-3 sentences max, casual but smart tone
- Highlight durability: "sublimation-printed — won't peel, crack, or fade"
- Mention compatibility: "fits 12 iPhone models from iPhone 15 to 17 Pro Max"
- Reference the finish options: "available in Glossy and Matte finish"
- Must be translated to EN, ES, DE

**What does NOT go in `description`:**
- Material composition -> `product_details.material`
- Care instructions -> `product_details.care_instructions`
- Manufacturing info -> `product_details.manufacturing_country`
- Safety/compliance -> `product_details.safety_information`
- Model list -> `product_details.compatibility`
