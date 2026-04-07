# Skill: design-embroidery — Embroidery Design & Product Creation

## When to Use

Activate this skill when the user asks to:
- Design a cap, snapback, dad hat, beanie, bucket hat, or embroidered hoodie
- Create an embroidered design or embroidery-ready artwork
- Generate a design for any headwear product
- Create a product using Printful (P410) embroidery
- Make a new hat/beanie/cap for the store

## What This Skill Does

Generates embroidery-ready SVG designs AND knows the full Printify product creation pipeline for embroidered products: design constraints → upload → create product → set variants (colors/sizes) → GPSR → publish → sync.

---

## PART 1: Design Generation

### Embroidery Constraints (STRICT — violating these = production failure)

- **Maximum 3 thread colors** (prefer 2 for cleaner results and lower cost)
- **NO gradients** — solid colors ONLY (embroidery machines work with thread, not ink)
- **NO semi-transparency** — all fills must be 100% opaque
- **NO photographic elements** — embroidery = flat shapes and lines only
- **Minimum line width**: 1.5mm (~6px at 300 DPI for typical canvas)
- **Minimum text height**: 5mm (~20px at 300 DPI for typical canvas)
- **Closed paths only** — all SVG paths must be closed (ends with `Z`)
- **Simple geometry** — avoid intricate details, thin serifs, or fine patterns
- **Max stitch density**: Simpler = cheaper production. Each color = separate thread change = cost

### Canvas Specifications (P410 Printful)

| Blueprint | Product | Canvas (px) | Positions | Garment Colors |
|---|---|---|---|---|
| BP793 | Embroidered Hoodie | 1200×1200 | chest, left_chest | 15 colors |
| BP1744 | Structured Cap (Yupoong 6089M) | 1770×600 | front, side, back | 11 colors |
| BP1755 | Flat Bill Cap | 1890×765 | front, side, back | Varies |
| BP1743 | Snapback Trucker (Yupoong 6606) | 1770×600 | front, side | 7 colors |
| BP1729 | Dad Hat (Sportsman SP500) | 1650×600 | front ONLY | 4 colors |
| BP1691 | Cuffed Beanie (Yupoong 1501KC) | 1500×525 | front_fold ONLY | 12 colors |
| BP1910 | Bucket Hat (Big Accessories BA682) | 1650×600 | front ONLY | 3 colors |

### Recommended Thread Color Combos

1. **White only** on dark cap — cleanest, cheapest, most on-brand
2. **White + Coral (#F97066)** on dark cap — brand gradient accent
3. **White + Turquoise (#40ACCC)** on dark cap — brand gradient accent
4. **Navy (#0F172A) only** on light/khaki cap
5. **Coral (#F97066) + Navy (#0F172A)** on neutral cap

### What Works in Embroidery

- **Text logos**: "YOUR_BRAND", short phrases (2-4 words MAX)
- **Simple icons**: Geometric shapes, S mark silhouette, arrows, brackets
- **Monograms**: Single letters or 2-3 letter combos
- **Minimal badges**: Circle/shield outline with text inside
- **Code symbols**: `< />`, `{ }`, `>>`, cursor/caret, `>_`

### Composition Rules

- **Center the design** in canvas (especially caps — front panel center)
- **Leave 10% margin** on all sides (embroidery hoop needs clearance)
- **Caps**: Design at 60-80% of canvas width, 50-70% of canvas height
- **Beanies**: Extra compact — max 60% of canvas width (cuff is narrow)
- **Hoodie chest**: Center in 1200×1200 square, use ~50% of area

### SVG Requirements

```xml
<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
  <!-- All paths closed (end with Z) -->
  <!-- stroke-width >= 6 for visible lines -->
  <!-- font-size >= 20 for text elements -->
  <!-- Max 3 distinct fill/stroke colors -->
  <!-- NO linearGradient or radialGradient -->
  <!-- NO <image> elements (raster) -->
</svg>
```

---

## GOLDEN RULE: Multi-Position Embroidery (Recommended)

When creating headwear or embroidered hoodies, **always consider ALL available embroidery positions**. Each position is an opportunity for branding.

### Caps with Side/Back Positions (BP1744, BP1755, BP1743)

Products offering `back_hat_embroidery`, `right_hat_embroidery`, `left_hat_embroidery`:
- **Front**: Main design (text, illustration, or wordmark)
- **Back**: Small S mark or "yourdomain.com" text (1 thread color, white on dark caps)
- **Side (left or right)**: Mini S mark silhouette (1 thread color)
- Scale for side/back: `0.4-0.6` (subtle, not competing with front)
- Thread color: Match one of the front design's colors

### Embroidered Hoodies (BP793) — Use All 4 Positions

BP793 has 4 positions: `front_left_chest`, `front_center_chest`, `left_wrist`, `right_wrist`.
- **Origin & Synapse already use all 4** — follow this pattern for new products
- Ultra, Phantom, Abyss only use 1/4 — future products should use more
- **Wrist designs**: Small S mark or mini code symbol, 1-2 thread colors
- Wrist canvas is very small (~400x200px) — keep it extremely simple

### Key Principles

1. **Front = main design**, sides/back = brand accent
2. **Thread color consistency** — back/side should use a color already in the front design
3. **Don't over-complicate** — side/back are subtle branding touches, not competing designs
4. **Beanies (BP1691), Dad Hats (BP1729), Bucket Hats (BP1910)**: Only have `front` — no multi-position needed
5. **Brand assets**: For embroidery, create simplified S mark with closed paths (the complex SVG paths from `/frontend/public/brand/` need simplification for embroidery)

---

## PART 2: Product Creation on Printify (Full Pipeline)

### Step 1: Upload Design

```
POST /v1/uploads/images.json
```
- Use public URL method (NOT base64 — Cloudflare blocks urllib)
- Returns: `{ id: "printify_upload_id", preview_url: "..." }`

### Step 2: Create Product

```
POST /v1/shops/{shopId}/products.json
```

```json
{
  "title": "Cap Name",
  "description": "Creative description, 2-3 sentences",
  "blueprint_id": 1744,
  "print_provider_id": 410,
  "variants": [
    { "id": 67890, "price": 2999, "is_enabled": true }
  ],
  "print_areas": [
    {
      "variant_ids": [67890],
      "placeholders": [
        {
          "position": "front",
          "images": [{ "id": "upload_id", "x": 0.5, "y": 0.5, "scale": 1, "angle": 0 }]
        }
      ]
    }
  ],
  "tags": ["pod", "embroidered", "cap"]
}
```

### Step 3: Variants — Colors, Sizes, Prices

**Get available variants first:**
```
GET /v1/catalog/blueprints/{bp_id}/print_providers/410/variants.json
```

**Variant title format for headwear:**
- Caps: `"S/M / White"`, `"L/XL / Black"`, `"One size / Navy"`
- Beanies: `"One size / Heather Grey"`
- Bucket hats: `"S/M / Black"`, `"L/XL / White"`

**Available sizes by product type:**
| Product | Sizes | Notes |
|---|---|---|
| Structured Caps | S/M, L/XL, One size | Depends on variant |
| Snapback Trucker | One size (adjustable) | Snap closure |
| Dad Hat | One size (adjustable) | Buckle/slide closure |
| Beanie | One size | Stretchy fit |
| Bucket Hat | S/M, L/XL | Fixed sizes |
| Embroidered Hoodie | S, M, L, XL, 2XL | Standard sizing |

**Recommended colors for headwear** (dark-first brand):
- **Primary**: Black, Navy, Dark Grey
- **Secondary**: White, Khaki, Heather Grey
- **Accent**: Camo, Red, Royal Blue (for specific designs)

**Pricing** (EUR cents):
| Product | Price | Cost Range | Margin |
|---|---|---|---|
| Structured Cap (BP1744) | 2999 | €10-13 | ~57% |
| Flat Bill Cap (BP1755) | 3299 | €11-14 | ~58% |
| Snapback (BP1743) | 2999 | €10-13 | ~57% |
| Dad Hat (BP1729) | 2799 | €9-12 | ~57% |
| Beanie (BP1691) | 2499 | €8-11 | ~56% |
| Bucket Hat (BP1910) | 2999 | €10-13 | ~57% |
| Embroidered Hoodie (BP793) | 5999 | €22-28 | ~53% |

**CRITICAL**: Set price on Printify FIRST — cron sync margin fixer overwrites if <35%.

### Step 4: Print Placement

**Front center (default for all headwear):**
```json
{ "position": "front", "images": [{ "id": "...", "x": 0.5, "y": 0.5, "scale": 1, "angle": 0 }] }
```

**Side embroidery** (structured caps only):
```json
{ "position": "side", "images": [{ "id": "...", "x": 0.5, "y": 0.5, "scale": 0.5, "angle": 0 }] }
```

**Back embroidery** (structured caps only):
```json
{ "position": "back", "images": [{ "id": "...", "x": 0.5, "y": 0.5, "scale": 0.5, "angle": 0 }] }
```

**Hoodie chest (BP793):**
```json
{ "position": "chest", "images": [{ "id": "...", "x": 0.5, "y": 0.5, "scale": 1, "angle": 0 }] }
```

**Hoodie left chest (BP793):**
```json
{ "position": "left_chest", "images": [{ "id": "...", "x": 0.5, "y": 0.5, "scale": 1, "angle": 0 }] }
```

**Positions per BP:**
| BP | front | side | back | chest | left_chest |
|---|---|---|---|---|---|
| BP1744 | yes | yes | yes | - | - |
| BP1755 | yes | yes | yes | - | - |
| BP1743 | yes | yes | NO | - | - |
| BP1729 | yes | NO | NO | - | - |
| BP1691 | yes (fold) | NO | NO | - | - |
| BP1910 | yes | NO | NO | - | - |
| BP793 | - | - | - | yes | yes |

### Step 5: GPSR (General Product Safety Regulation) — MANDATORY

**EU law requires GPSR on ALL products sold in the EU.**

Before publishing:
1. `GET /v1/shops/{shopId}/products/{productId}/gpsr.json` → get template
2. Fill safety information:

**For embroidered headwear:**
```html
<p><strong>Manufacturer:</strong> Printful SIA, Latvia, EU</p>
<p><strong>Material:</strong> [see table below]</p>
<p><strong>Embroidery technique:</strong> Machine embroidery — polyester thread</p>
<p><strong>Care:</strong> Hand wash cold. Do not bleach. Air dry.</p>
<p><strong>Compliance:</strong> REACH compliant</p>
```

3. `PUT /v1/shops/{shopId}/products/{productId}/safety_information`

**NEVER publish without GPSR.**

### Step 6: Product Details (JSONB in Supabase)

```json
{
  "safety_information": "<GPSR HTML from above>",
  "material": "See table below",
  "care_instructions": "Hand wash cold. Air dry.",
  "print_technique": "Machine embroidery — polyester thread",
  "manufacturing_country": "Latvia (EU)",
  "brand": "YOUR_BRAND_NAME",
  "provider": "Printful (P410)",
  "thread_colors": "White, Coral"
}
```

**Material by blueprint:**
| BP | Product | Material |
|---|---|---|
| BP1744 | Structured Cap | 100% Acrylic (front), Nylon Mesh (back) |
| BP1755 | Flat Bill Cap | 100% Polyester |
| BP1743 | Snapback Trucker | 100% Polyester (front), Nylon Mesh (back) |
| BP1729 | Dad Hat | 100% Chino Cotton Twill |
| BP1691 | Cuffed Beanie | 100% Acrylic |
| BP1910 | Bucket Hat | 100% Cotton Twill |
| BP793 | Embroidered Hoodie | 50% Cotton / 50% Polyester |

**Finish types:**
| Product | Finish/Closure |
|---|---|
| Structured Cap | Structured crown, snapback or fitted |
| Flat Bill Cap | Flat brim, snapback closure |
| Snapback Trucker | Mesh back, snap closure |
| Dad Hat | Unstructured, buckle/slide closure |
| Beanie | Fold-over cuff |
| Bucket Hat | Unstructured, brim all around |

### Step 7: Description Rules

**What goes in `description`** (creative text only):
- Design story, vibe, who it's for
- 2-3 sentences max, casual tone
- Must be translated to EN, ES, DE
- Example: "For the dev who codes with dark mode everything — even their headwear. Clean embroidered wordmark on premium structured cap."

**What does NOT go in `description`**:
- Material composition → `product_details.material`
- Care instructions → `product_details.care_instructions`
- Thread colors → `product_details.thread_colors`
- Manufacturing info → `product_details.manufacturing_country`
- Safety/GPSR → `product_details.safety_information`

### Step 8: Publish + Confirm + Sync

```
POST .../publish.json → enters "publishing" state
POST .../publishing_succeeded.json → { "external": { "id": "db-uuid" } }
GET /api/cron/sync-printify → syncs variants, images, prices to DB
```

### Step 9: Post-Creation Verification

- [ ] Product in correct category (caps, snapbacks, dad-hats, beanies, bucket-hats)
- [ ] Variant colors show in ProductCard swatches
- [ ] Sizes parsed correctly (One size, S/M, L/XL)
- [ ] Price correct (not overridden by margin fixer)
- [ ] Mockup images load
- [ ] GPSR safety info stored in product_details
- [ ] Embroidery looks clean in mockups (no fine detail lost)
- [ ] Thread colors match design intent

---

## PART 3: Real Design References

**IMPORTANT**: Before creating any headwear design, study these real existing designs:

| Directory | Contains |
|---|---|
| `/frontend/public/hat-designs/` | 4 real hat designs — illustrative/geometric style |

**Real design examples from hat-designs/:**
| File | Description | Style | Colors |
|---|---|---|---|
| `neon-horizon.png` | Retro sunset circle (gradient coral→orange→yellow→purple) + palm tree silhouette + geometric accent lines | Illustrative, scenic | Warm: corals, oranges, yellows, purples |
| `ocean-lines.png` | Teal wave lines with varying thickness + small moon circle | Minimalist, line art | Cold: teal/turquoise |
| `street-script.png` | Bold "GRIND NEVER STOP" text + red separator line, distressed feel | Typography, urban | Black + red accent |
| `summit-moon.png` | Geometric mountain triangles in slate/navy + moon + dot stars | Geometric, nature | Cold: navy, slate, white |

**Key patterns from real hat designs:**
- **Hats use ILLUSTRATIONS** — unlike all other categories which are text-heavy
- **Scenic/geometric compositions**: sunsets, waves, mountains, moons — nature + vibes
- **3-4 colors max** — already compatible with embroidery constraints (2-3 thread colors)
- **Compact compositions** that work in the small 1770×600 cap canvas
- **Text on hats is rare** — only `street-script.png` uses text, and it's short motivational (not meme/code)
- **Exception**: Brand embroidery (YOUR_BRAND_NAME wordmark) is always text — see branded examples

**For branded embroidered hats:**
- Brand mark or wordmark in 1-2 thread colors (white on dark, navy on light)
- Simple, clean, small — embroidery shines with minimal designs
- Real examples: products "AI Wrote This", "Dark Mode", "It Works" use simple text/wordmark

---

## File Naming Convention

```
{collection}-{product-type}-{design-name}.svg
```

Examples:
- `core-cap-brand-wordmark.svg`
- `meme-beanie-404.svg`
- `terminal-snapback-cursor.svg`
- `devlife-dad-hat-git-push.svg`
- `ai-bucket-hat-neural.svg`
