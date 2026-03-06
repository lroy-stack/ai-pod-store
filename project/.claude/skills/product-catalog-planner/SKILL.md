# Skill: product-catalog-planner — SKAPARA Catalog Expansion Planner

## When to Use

Activate this skill when the user asks to:
- Plan new products for the catalog
- Expand the product line
- Suggest what products to create next
- Plan a product collection or batch
- Figure out what categories need more products
- Create a product roadmap or launch plan

## What This Skill Does

Plans the expansion of the SKAPARA catalog from current inventory toward 250 products. Knows EU-approved blueprints/providers, category distribution targets, pricing rules, and brand identity. Generates detailed product specs ready for creation.

## Current State (as of 2026-02-28)

- **Active products**: ~32
- **Target**: 250
- **Gap**: ~218 products to create

## EU-Approved Providers ONLY

| Provider ID | Name | Location | Method | Products |
|---|---|---|---|---|
| P26 | Textildruck Europa | Germany | DTG | T-shirts, hoodies, crewnecks, LS, mugs, kids, totes |
| P410 | Printful | Latvia | Embroidery/UV | Caps, snapbacks, dad hats, beanies, bucket hats, tumblers, embroidered hoodies |
| P90 | Smart Printee | EU | Sublimation | Sneakers, desk mats |
| P23 | WOYC | EU | Sublimation | SS water bottles |
| P30 | OPT OnDemand | EU | UV | Mouse pads, stickers |
| P86 | The Dream Junction | EU | UV | Tumblers (Vagabond) |
| P255 | Dimona Tee | EU | DTG | Alternative tee source |

**NEVER use non-EU providers.** All products must ship from EU fulfillment centers.

## Category Distribution Target

| Category | Current | Target | Priority |
|---|---|---|---|
| T-Shirts | 6 | 40 | P0 — highest margin, most versatile |
| Pullover Hoodies | 5 | 25 | P0 — high AOV |
| Caps (embroidered) | 3 | 15 | P0 — 55-65% margins |
| Crewnecks | 2 | 15 | P1 |
| Long Sleeves | 0 | 12 | P1 |
| Stickers | 0 | 10 | P1 — quick to create, catalog padding |
| Mugs | 3 | 12 | P1 |
| Tote Bags | 0 | 10 | P1 |
| Beanies | 1 | 10 | P1 |
| Snapbacks | 1 | 8 | P1 |
| Dad Hats | 1 | 8 | P1 |
| Zip-Up Hoodies | 1 | 8 | P2 |
| Bucket Hats | 3 | 8 | P2 |
| Kids T-Shirts | 0 | 15 | P2 |
| Kids Hoodies | 0 | 8 | P2 |
| Baby Bodysuits | 0 | 6 | P2 |
| Tank Tops | 0 | 6 | P2 |
| Bottles | 2 | 6 | P2 |
| Tumblers | 2 | 6 | P2 |
| Sneakers | 1 | 6 | P3 |
| Mouse Pads | 0 | 5 | P3 |
| Desk Mats | 1 | 4 | P3 |
| Phone Cases | 0 | 8 | P3 — needs BP research first |

## Design Collections

1. **SKAPARA Core** — Brand logo, wordmark, gradient. Minimalista
2. **Meme Collection** — Tech humor phrases. Bold text.
3. **Terminal Series** — Code/Matrix aesthetic. Monospace, green on dark
4. **Outdoor Tech** — Nature + tech fusion. Sol, mar, montaña + circuitos
5. **Color Block** — Gradientes geométricos minimalistas
6. **Mini Collection (Kids)** — Robots, emojis tech, frases sencillas
7. **Developer Life** — Insider humor. "Friday Deploy", "git push --force"
8. **AI Era** — Claude, GPT, Neural, Synapse. Futurista minimalista

## Pricing Rules

See PRICING_RULES.md for detailed pricing by category.

**Quick reference**:
- T-Shirts: €24.99–€29.99
- Hoodies: €44.99–€54.99
- Embroidered Caps: €29.99–€34.99
- Mugs: €16.99–€19.99
- Stickers: €4.99–€6.99
- Sneakers: €79.99–€89.99

## GOLDEN RULE: Multi-Position Design Checklist

When planning ANY new product, evaluate all available print positions. This is **recommended practice** — not every product needs every position, but you MUST consciously decide.

### Checklist per Product Type

**DTG Apparel (BP6, BP12, BP145, BP454, BP49, BP457, BP80):**
- [ ] Front design (MANDATORY)
- [ ] Back design — branding (wordmark, S mark, or lockup) or complementary design (RECOMMENDED)
- [ ] Neck outer — S mark in correct color variant (RECOMMENDED for BP6/12/145)
- [ ] Sleeve mark — mini S mark or tech icon (OPTIONAL, premium products only)

**Embroidered Headwear (BP1744, BP1755, BP1743):**
- [ ] Front embroidery (MANDATORY)
- [ ] Back embroidery — S mark or "skapara.com" (RECOMMENDED)
- [ ] Side embroidery — mini S mark (OPTIONAL)

**Embroidered Hoodies (BP793):**
- [ ] Primary chest position (MANDATORY)
- [ ] Secondary chest position (RECOMMENDED)
- [ ] Left wrist (RECOMMENDED)
- [ ] Right wrist (RECOMMENDED)

**Drinkware (BP1018):**
- [ ] Choose `front` (meme) or `all` (branded wrap) — decide intentionally

**Sneakers / Multi-area products:**
- [ ] Design ALL available areas (MANDATORY — incomplete areas look unfinished)

### Neck Position Branding Logic

| Garment Color | Brand Asset | File |
|---|---|---|
| Dark (Black, Navy, Dark Heather) | White S mark | `skapara-mark-white.svg` |
| Light (White, Sport Grey, Khaki) | Dark S mark (#0F172A) | `skapara-mark-dark.svg` |
| Kids products (any color) | Gradient S mark (colorful) | `skapara-mark-color.svg` |

Assets: `/frontend/public/brand/`

### Back Print Rotation Strategy

Alternate between products to avoid monotony:
- **Product 1**: Wordmark "SKAPARA" (small, upper back)
- **Product 2**: S mark only (small, upper back)
- **Product 3**: S mark + wordmark horizontal lockup
- **Product 4**: Design-specific back (complementary to front)
- Repeat cycle

### Branding Add-ons (Setup in Printify Dashboard)

| Feature | Available | Cost | Action |
|---|---|---|---|
| Packaging insert | P410 confirmed, P26 verify | $0.15/unit | Design A6 card with branding + QR + discount |
| Gift message | API field `gift_message` | Free | Integrate in checkout flow |
| Neck labels | NOT available EU providers | N/A | Use `neck_outer` DTG instead |

---

## Output Format

When planning products, output in this format for each product:

```
### Product: {Title}

- **Collection**: {collection name}
- **Category**: {category slug}
- **Blueprint**: BP{id} — {product name}
- **Provider**: P{id} — {provider name}
- **Method**: DTG / Embroidery / Sublimation
- **Colors**: {garment/product colors to offer}
- **Price**: €{price}
- **Design brief**: {1-2 sentence description of the design}
- **Translations**:
  - EN: {title} — {description}
  - ES: {título} — {descripción}
  - DE: {Titel} — {Beschreibung}
```

## Phase Roadmap

### Phase 1 (32→80): High-Impact — 48 products
15 tees, 8 caps, 5 crewnecks, 5 hoodies, 5 stickers, 5 mugs, 5 long sleeves

### Phase 2 (80→150): Complete Categories — 70 products
10 tees, 10 totes, 8 zip hoodies, 8 crewnecks, 7 snapbacks, 7 dad hats, 5 beanies, 5 bucket hats, 5 hoodies, 5 mouse pads

### Phase 3 (150→200): Kids + Premium — 50 products
15 kids tees, 8 kids hoodies, 6 baby bodysuits, 6 tank tops, 5 sneakers, 4 desk mats, 6 tumblers/bottles

### Phase 4 (200→250): Complete + Diversify — 50 products
8 phone cases, 9 tees, 5 beanies, 4 caps, 5 long sleeves, 5 stickers, 4 embroidered hoodies, 5 hoodies, 5 mugs

## GPSR (General Product Safety Regulation) — MANDATORY FOR ALL PRODUCTS

**EU Regulation 2023/988** requires ALL products sold in the EU to have General Product Safety Regulation compliance documentation.

### What GPSR Requires

Every product MUST have before publishing:
1. **Manufacturer identification**: Name, address, country
2. **Material composition**: Exact materials used
3. **Print technique**: How the design is applied
4. **Care instructions**: Washing, cleaning, maintenance
5. **Compliance standards**: REACH, OEKO-TEX, FDA (for food-contact), etc.
6. **Country of manufacture**: Where the blank is produced

### GPSR by Method

**DTG Products (P26 — Textildruck Europa):**
```
Manufacturer: Textildruck Europa GmbH, Germany
Material: [depends on blank — see design-dtg skill]
Print: DTG (Direct-to-Garment) — water-based OEKO-TEX certified inks
Care: Machine wash cold, inside out. Tumble dry low.
Compliance: REACH, OEKO-TEX Standard 100
```

**Embroidered Products (P410 — Printful):**
```
Manufacturer: Printful SIA, Latvia, EU
Material: [depends on blank — see design-embroidery skill]
Print: Machine embroidery — polyester thread
Care: Hand wash cold (headwear). Machine wash cold (hoodies).
Compliance: REACH compliant
```

**Sublimation Products (P26/P23/P30/P90/P86):**
```
Manufacturer: [varies by provider]
Material: [depends on product — see design-sublimation skill]
Print: Sublimation / UV direct print
Care: [varies — hand wash for drinkware, wipe for accessories]
Compliance: REACH, FDA (food-contact items)
```

### Printify GPSR Flow (MANDATORY before publish)

```
1. GET /v1/shops/{shopId}/products/{productId}/gpsr.json → get template
2. Fill in safety_information HTML string
3. PUT /v1/shops/{shopId}/products/{productId}/safety_information → submit
4. THEN publish
```

**NEVER skip GPSR. Products without it violate EU law and can be removed.**

---

## Product Details Checklist (for product_details JSONB)

Every product in the DB should have these fields populated:

| Field | Required | Example |
|---|---|---|
| `safety_information` | YES (GPSR) | HTML string with manufacturer + material + compliance |
| `material` | YES | "100% Cotton", "Ceramic", "18/8 Stainless Steel" |
| `care_instructions` | YES | "Machine wash cold, inside out" |
| `print_technique` | YES | "DTG", "Machine embroidery", "Sublimation" |
| `manufacturing_country` | YES | "Germany", "Latvia (EU)", "China (EU shipping)" |
| `brand` | YES | "SKAPARA" |
| `provider` | Recommended | "Textildruck Europa (P26)" |
| `finish` | If applicable | "Glossy", "Matte", "Embroidered" |
| `thread_colors` | Embroidery only | "White, Coral" |
| `food_contact` | Drinkware only | "FDA approved, EU food-contact safe" |

---

## Description vs Product Details — STRICT separation

**Description** (the `description` field — shown on product page):
- ONLY creative/marketing text
- 2-3 sentences max
- Must be translated to EN, ES, DE
- Describes: design story, vibe, who it's for, why it's cool
- NO material specs, NO care instructions, NO dimensions

**Product Details** (the `product_details` JSONB — shown in specs tab):
- ALL technical information
- Material composition, care, manufacturing, compliance
- Not user-facing prose — structured data for the specs section
- GPSR safety_information goes here

---

## Variant Configuration Reference

When planning products, specify:

### For Apparel (DTG)
- **Colors to offer**: Minimum 3 (Black, White, Navy recommended)
- **Sizes**: S through 3XL minimum (4XL, 5XL if available)
- **Price per variant**: Same price for all sizes/colors within a product

### For Headwear (Embroidery)
- **Colors to offer**: Minimum 2 (Black + one accent)
- **Sizes**: "One size" (adjustable) or S/M + L/XL
- **Thread colors**: Specify 1-3 thread colors per design
- **Closure**: Note closure type (snapback, buckle, slide, none)

### For Drinkware (Sublimation)
- **Size options**: 11oz for mugs, 12/18/32oz for bottles
- **Finish**: Glossy or Matte (specify per product)
- **Color**: Typically White or Black base
- **Food safety**: MUST note FDA/EU food-contact compliance

### For Accessories (Sublimation/UV)
- **Sticker sizes**: Plan which sizes (2", 3", 4", 5", 6")
- **Sneaker sizes**: US 5-13 range (converted to EU 36-48 in DB)
- **Mouse pad/desk mat**: Usually one or two size options

---

## Output Format (Updated — Complete Spec)

When planning products, output in this format for each product:

```
### Product: {Title}

- **Collection**: {collection name}
- **Category**: {category slug}
- **Blueprint**: BP{id} — {product name}
- **Provider**: P{id} — {provider name}
- **Method**: DTG / Embroidery / Sublimation
- **Garment Colors**: {colors to enable}
- **Sizes**: {sizes to enable}
- **Finish**: {Glossy/Matte/N/A}
- **Price**: €{price} (all variants same price)
- **Material**: {material composition}
- **Care**: {care instructions}
- **GPSR**: {manufacturer + compliance standards}
- **Design brief**: {1-2 sentence description of the design}
- **Design position**: front / front+back / wrap / multi-area
- **Translations**:
  - EN: {title} — {description}
  - ES: {título} — {descripción}
  - DE: {Titel} — {Beschreibung}
```

---

## Real Design References — Study Before Planning

Before planning new products, study the actual SKAPARA designs to understand the real brand language:

| Directory | Content | Patterns |
|---|---|---|
| `/frontend/public/meme-designs/` | 10 meme text designs | Two-Tone Text Hierarchy (ghost setup + bold punchline) |
| `/frontend/public/meme-previews/` | 6 UI simulation memes | ChatGPT/Claude Code interface recreation |
| `/frontend/public/branded-previews/` | 8 branded designs at exact canvas sizes | Logo lockup (horizontal/vertical per product) |
| `/frontend/public/brand-designs/` | 6 brand variants (Noir/White/Gradient/Ocean/Warm) | Per-product color variants |
| `/frontend/public/hat-designs/` | 4 illustrative hat designs | Geometric scenes (sunset, waves, mountains) |
| `/frontend/public/fleece-designs/` | 2 premium fleece chest designs | S mark + decorative corner brackets |

**CRITICAL insights for planning:**
- Garments (DTG) = text-heavy, 1-2 accent colors, NEVER gradient
- Headwear = illustrative/geometric, NOT text (except branded wordmark)
- Drinkware = branded lockup with 5 color variants (Noir, White, Full Gradient, Ocean, Warm)
- Stickers = ONLY product using full SKAPARA gradient
- Desk mats = repeating S mark pattern OR terminal-style meme text
- Accent colors: Green #10B981, Purple #A78BFA, Red #EF4444, Amber #F59E0B, Copper #D97706

See `BRAND_IDENTITY.md` and `design-dtg/DESIGN_GUIDELINES.md` for complete pattern analysis.

---

## Validation Before Creating

Before ANY product creation:
1. Confirm blueprint exists and has the correct provider via Printify API
2. Verify provider is in `EU_APPROVED_PROVIDERS` (P26, P410, P90, P23, P30, P255, P86)
3. Ensure category exists in DB (create migration if needed)
4. Check design meets method constraints (DTG/embroidery/sublimation)
5. Verify no duplicate title in existing catalog
6. Confirm GPSR template is available for the product
7. Verify material composition is known for the blank
8. Ensure pricing meets minimum 35% margin over cost
9. Check that translations (EN/ES/DE) are prepared
