# Skill: design-dtg — DTG (Direct-to-Garment) Design & Product Creation

## When to Use

Activate this skill when the user asks to:
- Design a t-shirt, hoodie, crewneck, long sleeve, zip-up hoodie, tote bag, or kids clothing
- Create a DTG print design
- Generate artwork for garment printing
- Make a design for any product using Textildruck Europa (P26)
- Create a new DTG product on Printify

## What This Skill Does

Generates print-ready SVG/PNG designs for DTG products AND knows the full Printify product creation pipeline: design → upload → create product → set variants/colors/sizes/prices → GPSR compliance → publish → sync to DB.

---

## PART 1: Design Generation

### Workflow

1. **Identify the product type** → Look up canvas specs in CANVAS_SPECS.md
2. **Determine the design style** → Check DESIGN_GUIDELINES.md for YOUR_BRAND_NAME brand rules
3. **Generate the SVG** → Create an SVG at the exact canvas dimensions
4. **Export to PNG** → PNG-24 with alpha transparency, 300 DPI minimum
5. **Save to** `/frontend/public/brand-designs/` with naming: `{collection}-{product-type}-{name}.png`

### Critical Design Rules

- **ALWAYS transparent background** (PNG-24 with alpha channel)
- **NEVER exceed canvas dimensions** — design must fit EXACTLY within the blueprint canvas
- **Safe zone**: Keep all important elements within 95% of canvas (5% margin on each edge)
- **Minimum text height**: 2% of canvas height for legibility at print distance
- **Resolution**: 300 DPI minimum — the canvas pixel dimensions already account for this
- **Colors**: Unlimited (DTG = direct ink injection, full CMYK gamut)
- **File format**: SVG for vector designs, PNG-24 for raster/complex designs

### Canvas Quick Reference

| Blueprint | Product | Canvas (px) | Positions | Garment Colors |
|---|---|---|---|---|
| BP6 | Gildan 5000 Tee | 4606×5787 | front, back, sleeves, neck | 25 colors |
| BP12 | Bella+Canvas 3001 | 2953×3710 | front, back, sleeves, neck | 100+ colors |
| BP145 | Gildan Softstyle | 3402×4264 | front, back, sleeves | Standard palette |
| BP454 | B&C TU01T (EU) | 3543×4452 | front, back | Standard palette |
| BP77 | Gildan 18500 Hoodie | 3531×2908 | front ONLY | 17 colors |
| BP49 | Gildan 18000 Crew | 3319×3761 | front, back | 15 colors |
| BP80 | Gildan 2400 LS | 4110×4658 | front, back | 4 colors |
| BP455 | Gildan 18600 Zip | 2776×2285 | front ONLY | 5 colors |
| BP457 | B&C WUI23 Crew (EU) | 3366×4230 | front, back | Standard palette |

See CANVAS_SPECS.md for full details. See DESIGN_GUIDELINES.md for brand rules.

---

## GOLDEN RULE: Multi-Position Design (Recommended)

When creating a new product, **always consider ALL available print positions** — not just front. This is not mandatory for every product, but you MUST actively think about it and decide intentionally.

### Neck Position (`neck_outer`) — YOUR_BRAND_NAME Branding

Products offering `neck_outer` (BP6, BP12, BP145) **should use it for YOUR_BRAND_NAME branding**:
- **Dark garments** (Black, Navy, Dark Heather): Use `brand-mark-white.svg` (white brand mark)
- **Light garments** (White, Sport Grey): Use `brand-mark-dark.svg` (dark brand mark)
- **Kids products**: Use `brand-mark-color.svg` (colorful brand mark — more fun)
- Assets location: `/frontend/public/brand/`
- Position: `x: 0.5, y: 0.5, scale: 0.8` (centered in neck canvas)
- Canvas neck_outer is small (~600x600px estimated) — only the S mark, NO wordmark

### Back Position (`back`) — Branded Back Print

Products with `back` position should get a back design. Options (alternate between products):
- **Option A: Wordmark only** — "YOUR_BRAND_NAME" text centered, small (~15-20% of canvas), `y: 0.15` (upper back between shoulders)
- **Option B: S mark only** — S mark centered small, same position
- **Option C: S mark + wordmark lockup** — horizontal lockup, small, upper back
- **Option D: Design-specific back** — complementary design (e.g., meme text continuation, code snippet)
- Variant selection: Use white assets on dark garments, dark assets on light garments

### Sleeve Positions (`left_sleeve`, `right_sleeve`)

Optional for premium products (BP6, BP12, BP145):
- Small S mark or tech icon (⌘, `>_`, `{ }`)
- Scale: 0.3-0.5 (very small, subtle)
- Only one sleeve typically (left preferred)
- Skip for standard/budget products

### Key Principles

1. **NEVER copy the front design to other positions** — each position has its own purpose
2. **Front = main design**, back = branding/complement, neck = brand mark, sleeves = accent
3. **Brand assets are in** `/frontend/public/brand/` — use the correct variant for garment color
4. **Kids products** prefer the colorful gradient mark (`brand-mark-color.svg`)

---

## PART 2: Product Creation on Printify (Full Pipeline)

### Step 1: Upload Design Image

```
POST /v1/uploads/images.json
```

- Use **public URL method** (NOT base64 — Cloudflare blocks Python urllib)
- If using curl: `curl -X POST ... -d '{"url": "https://...", "file_name": "design.png"}'`
- Returns: `{ id: "printify_upload_id", preview_url: "..." }`

### Step 2: Create Product

```
POST /v1/shops/{shopId}/products.json
```

**REQUIRED fields:**

```json
{
  "title": "Product Name",
  "description": "Original creative description (NO material/manufacturing info here)",
  "blueprint_id": 6,
  "print_provider_id": 26,
  "variants": [
    { "id": 12345, "price": 2499, "is_enabled": true },
    { "id": 12346, "price": 2499, "is_enabled": true }
  ],
  "print_areas": [
    {
      "variant_ids": [12345, 12346],
      "placeholders": [
        {
          "position": "front",
          "images": [{ "id": "printify_upload_id", "x": 0.5, "y": 0.45, "scale": 1, "angle": 0 }]
        }
      ]
    }
  ],
  "tags": ["pod", "tech", "meme"]
}
```

### Step 3: Variants — Colors, Sizes, Prices

**Variant structure**: Each variant = a specific color + size combination.

Query available variants FIRST:
```
GET /v1/catalog/blueprints/{bp_id}/print_providers/{provider_id}/variants.json
```

**Variant title format** (Printify returns these):
- T-shirts: `"Black / M"`, `"White / XL"`, `"Navy / S"`
- Caps: `"S/M / White"`, `"L/XL / Black"`
- Drinkware: `"11oz / Black / Glossy"`

**Available sizes by product type:**
| Product | Sizes |
|---|---|
| T-Shirts | S, M, L, XL, 2XL, 3XL (some have XXS-5XL) |
| Hoodies | S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| Crewnecks | S, M, L, XL, 2XL, 3XL |
| Long Sleeves | S, M, L, XL, 2XL, 3XL |
| Kids | XS (2T), S (4-5), M (6-7), L (8-10), XL (12-14) |

**Recommended garment colors** (dark-first brand):
- **Primary**: Black, Dark Heather, Navy
- **Secondary**: White, Sport Grey, Charcoal
- **Accent**: Forest Green, Maroon, Royal Blue (for specific collections)

**Pricing** (EUR cents, set on EACH variant):
| Product | Price | Min Margin |
|---|---|---|
| T-Shirt (Gildan) | 2499 | 35% over cost |
| T-Shirt (Bella+Canvas) | 2799 | 35% over cost |
| Pullover Hoodie | 4999 | 35% over cost |
| Crewneck | 4499 | 35% over cost |
| Long Sleeve | 2999 | 35% over cost |
| Zip Hoodie | 5499 | 35% over cost |

**CRITICAL**: Set price on Printify FIRST — the cron sync margin fixer overwrites prices below 35% margin.

### Step 4: Print Placement

**Front print (default)**:
```json
{ "position": "front", "images": [{ "id": "...", "x": 0.5, "y": 0.45, "scale": 1, "angle": 0 }] }
```

- `x: 0.5` = centered horizontally
- `y: 0.45` = slightly above center (natural chest position)
- `scale: 1` = full canvas size

**Back print** (if blueprint supports it):
```json
{ "position": "back", "images": [{ "id": "...", "x": 0.5, "y": 0.45, "scale": 1, "angle": 0 }] }
```

**Left-chest logo placement**:
```json
{ "position": "front", "images": [{ "id": "...", "x": 0.28, "y": 0.22, "scale": 0.3, "angle": 0 }] }
```

**Neck label** (brand tag inside collar — requires `has_neck_position: true`):
```json
{ "position": "neck", "images": [{ "id": "neck_label_upload_id", "x": 0.5, "y": 0.5, "scale": 1, "angle": 0 }] }
```

**Positions available per BP:**
| BP | front | back | sleeves | neck |
|---|---|---|---|---|
| BP6 | yes | yes | yes | yes |
| BP12 | yes | yes | yes | yes |
| BP77 | yes | NO | NO | NO |
| BP455 | yes | NO | NO | NO |
| BP49 | yes | yes | NO | NO |
| BP80 | yes | yes | NO | NO |

### Step 5: GPSR (General Product Safety Regulation) — MANDATORY

**EU law requires GPSR information on ALL products sold in the EU.**

Before publishing, you MUST:

1. **Get GPSR template**: `GET /v1/shops/{shopId}/products/{productId}/gpsr.json`
2. **Fill in safety information**: HTML-formatted string with manufacturer, materials, compliance
3. **Submit**: `PUT /v1/shops/{shopId}/products/{productId}/safety_information`

**Required GPSR fields for DTG products:**
```html
<p><strong>Manufacturer:</strong> Textildruck Europa GmbH, Germany</p>
<p><strong>Material:</strong> 100% Cotton (Gildan) / 50% Cotton 50% Polyester (heavy blend)</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low.</p>
<p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>
```

**NEVER publish without GPSR** — products without it can be removed from EU marketplaces.

### Step 6: Product Details (JSONB in Supabase)

After creation, the `product_details` field should contain:

```json
{
  "safety_information": "<GPSR HTML>",
  "material": "100% Cotton" or "50% Cotton / 50% Polyester",
  "care_instructions": "Machine wash cold, inside out. Tumble dry low.",
  "print_technique": "DTG (Direct-to-Garment)",
  "manufacturing_country": "Germany",
  "brand": "YOUR_BRAND_NAME",
  "provider": "Textildruck Europa (P26)"
}
```

**Material by blueprint:**
| BP | Material |
|---|---|
| BP6 (Gildan 5000) | 100% Cotton |
| BP12 (Bella+Canvas 3001) | 100% Airlume Combed Cotton |
| BP145 (Gildan Softstyle) | 100% Ring-Spun Cotton |
| BP454 (B&C TU01T) | 100% Ring-Spun Cotton |
| BP77 (Gildan 18500) | 50% Cotton / 50% Polyester |
| BP49 (Gildan 18000) | 50% Cotton / 50% Polyester |
| BP80 (Gildan 2400) | 100% Cotton |
| BP455 (Gildan 18600) | 50% Cotton / 50% Polyester |
| BP457 (B&C WUI23) | 80% Cotton / 20% Polyester |

### Step 7: Description Rules

**What goes in `description`** (creative text only):
- Product name context, design inspiration, target audience
- 2-3 sentences max, casual but smart tone
- Must be translated to EN, ES, DE
- Example: "For the developer who pushes to production on Friday and doesn't look back. Bold statement, premium cotton, perfect fit."

**What does NOT go in `description`**:
- Material composition → goes in `product_details.material`
- Care instructions → goes in `product_details.care_instructions`
- Manufacturing info → goes in `product_details.manufacturing_country`
- Safety/compliance → goes in `product_details.safety_information`

**Description is HTML-stripped during sync** (regex `/<[^>]*>/g`), max 2000 chars.

### Step 8: Publish + Confirm

```
POST /v1/shops/{shopId}/products/{productId}/publish.json
→ Product enters "publishing" state

POST /v1/shops/{shopId}/products/{productId}/publishing_succeeded.json
→ Body: { "external": { "id": "db-uuid", "handle": "/shop/db-uuid" } }
→ CRITICAL: Without this, variants never sync to database
```

### Step 9: Sync to Database

Trigger cron sync: `GET /api/cron/sync-printify`

This will:
- Upsert product to `products` table (with blueprint_id, print_provider_id)
- Parse variant titles → extract color + size per variant
- Map mockup images to variants (for color swatches in ProductCard)
- Calculate/verify pricing margins
- Extract GPSR safety_information into product_details

### Step 10: Post-Creation Verification

After sync, verify:
- [ ] Product appears in shop with correct category
- [ ] All variant colors show in ProductCard color toggles
- [ ] Sizes are correctly parsed (S, M, L, XL, etc.)
- [ ] Price is correct (not overridden by margin fixer)
- [ ] Images load (mockups from Printify)
- [ ] SizeGuide shows for applicable categories (t-shirts, hoodies, crewnecks)
- [ ] GPSR safety information is stored in product_details
- [ ] Description is clean (no HTML tags, max 2000 chars)

---

## PART 3: Size Guide

SizeGuide component (`/components/products/SizeGuide.tsx`) auto-activates for these categories:
- t-shirts, pullover-hoodies, crewnecks, sweatshirts, long-sleeves, zip-up-hoodies

Displays measurement tables (chest, length, sleeve) in cm. No action needed — just ensure the product is in the correct category.

---

## PART 4: Real Design References

**IMPORTANT**: Before creating any design, study the real existing designs in these directories:

| Directory | Contains | Design Pattern |
|---|---|---|
| `/frontend/public/meme-designs/` | 10 meme text designs for garments | Two-Tone Text Hierarchy, Extreme Minimalism |
| `/frontend/public/meme-previews/` | 6 UI simulation designs | ChatGPT/Claude Code interface memes |
| `/frontend/public/branded-previews/` | 8 branded lockup designs at exact canvas sizes | S mark + wordmark compositions |
| `/frontend/public/brand-designs/` | 6 drinkware brand variants (Noir, White, Gradient, Ocean, Warm) | Logo lockup per product |
| `/frontend/public/fleece-designs/` | 2 chest designs for fleece/hoodies | Decorative S mark + corner brackets |

See **DESIGN_GUIDELINES.md** for detailed analysis of each pattern with concrete examples.

**Key takeaways from real designs:**
- **Garments use 1-2 solid accent colors** — NEVER the full gradient
- **Ghost/outline text** (white, stroke-only) for setup lines, **bold solid color** for punchlines
- **Green #10B981** and **Purple #A78BFA** are the most-used accent colors
- **Massive negative space** — even text-heavy designs leave 30%+ empty
- **Dark garment default** — all ghost text is white, invisible on white bg

---

## File Naming Convention

```
{collection}-{product-type}-{design-name}.png
```

Examples:
- `meme-tee-404-developer.png`
- `terminal-hoodie-sudo-sandwich.png`
- `core-tee-brand-mark.png`
- `devlife-crew-friday-deploy.png`
