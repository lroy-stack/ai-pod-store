# Skill: design-sublimation — Sublimation/UV Design & Product Creation

## When to Use

Activate this skill when the user asks to:
- Design a mug, water bottle, tumbler, desk mat, mouse pad, sticker, or sneaker
- Create a wrap-around or all-over print design
- Generate artwork for sublimation or UV printing
- Make a design for drinkware, accessories, or footwear
- Create a new non-garment, non-headwear product

## What This Skill Does

Generates print-ready designs for sublimation/UV products AND knows the full Printify creation pipeline: canvas/wrap rules → upload → create product → variants (sizes/colors/finishes) → GPSR → publish → sync.

---

## PART 1: Design Generation

### Sublimation/UV Design Rules

- **Colors**: Unlimited — sublimation is photographic quality (full CMYK gamut)
- **Gradients**: ALLOWED and encouraged (unlike embroidery)
- **Resolution**: 300 DPI minimum (canvas pixel dimensions account for this)
- **Wrap-around products** (mugs, bottles, tumblers): Design wraps around a cylinder — left edge meets right edge
- **Edge bleed**: Extend design 2-3% beyond canvas on wrap products to avoid white edges
- **Stickers**: Can be transparent (die-cut) or opaque (white background)
- **Sneakers**: 6 separate design areas per pair — each area is its own canvas

### Canvas Specifications

#### Drinkware

| Blueprint | Product | Canvas (px) | Provider | Wrap? | Finish Options |
|---|---|---|---|---|---|
| BP1018 | Two-Tone Mug 11oz | 2244×945 | P26 | Wrap-around | Glossy, Matte |
| BP854 | SS Water Bottle | 2759×1500 | P23 | Full wrap | Matte (stainless) |
| BP1927 | Tumbler 20oz | 2776×2374 | P410 | Full wrap | Glossy |
| BP966 | Vagabond 20oz | 3058×1715 | P86 | Full wrap | Matte |

**Drinkware design tips:**
- Design center = front face (what user sees when holding product)
- Left/right 15% = side/back (less visible but still printed)
- Mugs: Handle gap exists — design doesn't print under handle area
- Bottles/Tumblers: Vertical text works well on tall cylinders

#### Desk & Office

| Blueprint | Product | Canvas (px) | Provider | Finish |
|---|---|---|---|---|
| BP969 | Desk Mat LED | 7205×3661 | P90 | Cloth surface, rubber base |
| BP442 | Mouse Pad | 2894×2421 | P30 | Cloth surface, rubber base |

**Desk/office design tips:**
- Desk mat: HUGE canvas (7205px wide) — can be very detailed
- Mouse pad: Keep central area simpler (that's where the mouse moves)
- Great for: code cheat sheets, circuit board patterns, space themes, grid designs

#### Stickers

| Blueprint | Product | Canvas (px) | Provider | Type |
|---|---|---|---|---|
| BP476 | Vinyl Sticker | 4500×4500 | P30 | Die-cut or kiss-cut |

**Sticker design tips:**
- **Die-cut**: Transparent background — sticker shape follows the design outline
- **Kiss-cut**: White background with border
- Quick to design, cheap to produce, great catalog padding
- Sizes: 2", 3", 4", 5", 6" (square)

#### Footwear

| Blueprint | Product | Canvas (px) | Provider | Areas |
|---|---|---|---|---|
| BP767 | Low Top Sneaker | 1433×649 per area | P90 | 6 areas per shoe |
| BP1470 | High Top Sneaker | varies per area | P90 | 6 areas per shoe |

**Sneaker design areas** (per shoe, 12 total for the pair):
1. Left outer panel
2. Left inner panel
3. Left tongue
4. Left heel
5. Right outer panel
6. Right inner panel
7. Right tongue
8. Right heel
9. Left toe cap
10. Right toe cap
11. Left sole accent
12. Right sole accent

**Sneaker design tips:**
- Tongue + heel are most visible — put key design elements there
- Outer panels are the largest surfaces
- Can mix: solid color on some areas + pattern/logo on others
- Keep designs consistent across L/R pairs

---

## GOLDEN RULE: Multi-Position & Wrap Design (Recommended)

### Mugs (BP1018) — `front` vs `all`

BP1018 has two positions: `front` (single face) and `all` (full wrap-around):
- **Branded mugs**: Use `all` (wrap) — logo lockup wraps around the entire mug for premium feel
- **Meme mugs**: Use `front` — text-based designs work better on one face
- When using `all`: design the full 2244x945 canvas as a continuous wrap. Left edge meets right edge behind the handle

### Sneakers (BP767, BP1534) — Design ALL Areas

Sneakers have 6+ areas per shoe. **Always design ALL areas**:
- **Outer panels**: Main design (pattern, brand, or illustration)
- **Tongue**: S mark or brand element (most visible when worn)
- **Inner panels**: Complement or simplified version of outer
- **Heel**: S mark or color accent
- Each area is a SEPARATE design file — they don't need to match exactly but should be cohesive

### Key Principles

1. **Wrap products benefit from brand gradient** — sublimation handles gradients beautifully
2. **Consider viewing angle**: Mugs are held → front face matters most. Bottles sit on desks → all angles visible
3. **Stickers, desk mats, mouse pads**: Single position (`front`) — no multi-position needed

---

## PART 2: Product Creation on Printify (Full Pipeline)

### Step 1: Upload Design

```
POST /v1/uploads/images.json
```
- Use public URL method (NOT base64)
- For sneakers: upload EACH area as a separate image
- Returns: `{ id: "printify_upload_id" }`

### Step 2: Create Product

```json
{
  "title": "Product Name",
  "description": "Creative description, 2-3 sentences",
  "blueprint_id": 1018,
  "print_provider_id": 26,
  "variants": [
    { "id": 45678, "price": 1699, "is_enabled": true }
  ],
  "print_areas": [
    {
      "variant_ids": [45678],
      "placeholders": [
        { "position": "front", "images": [{ "id": "upload_id", "x": 0.5, "y": 0.5, "scale": 1, "angle": 0 }] }
      ]
    }
  ],
  "tags": ["pod", "mug", "drinkware"]
}
```

### Step 3: Variants — Sizes, Colors, Finishes, Prices

**Get available variants:**
```
GET /v1/catalog/blueprints/{bp_id}/print_providers/{provider_id}/variants.json
```

**Variant title format by product type:**
- Mugs: `"11oz / Black / Glossy"`, `"11oz / White / Matte"`
- Bottles: `"12oz / Stainless Steel"`, `"18oz / White"`, `"32oz / Black"`
- Tumblers: `"20oz / Black"`, `"20oz / Silver"`
- Stickers: `"3x3" / White"`, `"4x4" / Transparent"`, `"6x6" / White"`
- Mouse Pads: `"Standard / Black edge"`, `"Large / Black edge"`
- Desk Mats: `"36x18" / LED"`, `"31x15" / LED"`
- Sneakers: `"US 7 / White"`, `"US 10 / Black"` (converted to EU sizes in DB)

**Size variants by product:**
| Product | Sizes | Notes |
|---|---|---|
| Mug | 11oz (standard) | One size typically |
| Water Bottle | 12oz, 18oz, 32oz | Multiple volumes |
| Tumbler | 20oz | One size typically |
| Sticker | 2", 3", 4", 5", 6" | Square inches |
| Mouse Pad | 7.5"×8.5" (standard) | Usually one size |
| Desk Mat | 31"×15", 36"×18" | Two sizes |
| Sneaker | US 5–13 (→ EU 36–48) | Full shoe range |

**Finish options (affects variant):**
| Product | Finishes |
|---|---|
| Mug | Glossy, Matte |
| Bottle | Matte stainless, Matte colored |
| Tumbler | Glossy, Matte |
| Sticker | Vinyl (outdoor), Paper (indoor) |
| Mouse Pad | Cloth top / rubber base |
| Desk Mat | Cloth top / rubber base / LED strip |
| Sneaker | Canvas upper / rubber sole |

**Shoe size conversion** (stored in DB with EU equivalents):
| US | EU | US | EU |
|---|---|---|---|
| 5 | 36 | 10 | 44 |
| 6 | 38 | 11 | 45 |
| 7 | 39.5 | 12 | 46 |
| 7.5 | 40.5 | 13 | 48 |
| 8 | 41 | | |
| 9 | 42.5 | | |

**Pricing** (EUR cents):
| Product | Price | Cost Range | Margin |
|---|---|---|---|
| Mug 11oz | 1699 | €5-7 | ~59% |
| Water Bottle | 2999 | €10-14 | ~53% |
| Tumbler 20oz | 3299 | €12-16 | ~52% |
| Sticker (per unit) | 499 | €1.50-2.50 | ~50% |
| Mouse Pad | 1499 | €4-6 | ~60% |
| Desk Mat | 4499 | €15-20 | ~56% |
| Sneaker Low | 7999 | €25-35 | ~56% |
| Sneaker High | 8999 | €28-38 | ~58% |

### Step 4: Print Placement

**Wrap-around products (mugs, bottles, tumblers):**
```json
{ "position": "wrap", "images": [{ "id": "...", "x": 0.5, "y": 0.5, "scale": 1, "angle": 0 }] }
```

**Flat products (mouse pads, desk mats, stickers):**
```json
{ "position": "front", "images": [{ "id": "...", "x": 0.5, "y": 0.5, "scale": 1, "angle": 0 }] }
```

**Sneakers (multiple positions per shoe):**
```json
[
  { "position": "left_outer", "images": [{ "id": "outer_design", "x": 0.5, "y": 0.5, "scale": 1 }] },
  { "position": "left_inner", "images": [{ "id": "inner_design", "x": 0.5, "y": 0.5, "scale": 1 }] },
  { "position": "left_tongue", "images": [{ "id": "tongue_design", "x": 0.5, "y": 0.5, "scale": 1 }] },
  { "position": "left_heel", "images": [{ "id": "heel_design", "x": 0.5, "y": 0.5, "scale": 1 }] },
  { "position": "right_outer", "images": [{ "id": "outer_design", "x": 0.5, "y": 0.5, "scale": 1 }] },
  { "position": "right_inner", "images": [{ "id": "inner_design", "x": 0.5, "y": 0.5, "scale": 1 }] }
]
```

### Step 5: GPSR (General Product Safety Regulation) — MANDATORY

**EU law requires GPSR on ALL products sold in the EU.**

Before publishing:
1. `GET /v1/shops/{shopId}/products/{productId}/gpsr.json`
2. Fill safety information per product type:

**Drinkware:**
```html
<p><strong>Manufacturer:</strong> [Provider name], [Country]</p>
<p><strong>Material:</strong> [See material table below]</p>
<p><strong>Printing technique:</strong> Sublimation / UV direct print</p>
<p><strong>Food contact:</strong> FDA approved / EU food-contact safe (where applicable)</p>
<p><strong>Care:</strong> Hand wash recommended. Not microwave safe (for metallic). Dishwasher safe (ceramic mugs).</p>
<p><strong>Compliance:</strong> REACH, FDA (food contact)</p>
```

**Stickers/Mouse Pads/Desk Mats:**
```html
<p><strong>Manufacturer:</strong> OPT OnDemand / Smart Printee</p>
<p><strong>Material:</strong> [See table]</p>
<p><strong>Printing technique:</strong> UV direct print</p>
<p><strong>Care:</strong> Wipe clean with damp cloth.</p>
<p><strong>Compliance:</strong> REACH compliant</p>
```

**Sneakers:**
```html
<p><strong>Manufacturer:</strong> Smart Printee</p>
<p><strong>Material:</strong> Canvas upper, rubber sole</p>
<p><strong>Printing technique:</strong> Sublimation print on canvas</p>
<p><strong>Care:</strong> Spot clean with damp cloth. Air dry.</p>
<p><strong>Compliance:</strong> REACH compliant</p>
```

3. `PUT .../safety_information`

**NEVER publish without GPSR.**

### Step 6: Product Details (JSONB in Supabase)

```json
{
  "safety_information": "<GPSR HTML>",
  "material": "See material table",
  "care_instructions": "See care table",
  "print_technique": "Sublimation / UV",
  "manufacturing_country": "See provider",
  "brand": "YOUR_BRAND_NAME",
  "provider": "Provider name (PXX)",
  "finish": "Glossy / Matte / etc."
}
```

**Material by product:**
| Product | BP | Material |
|---|---|---|
| Mug Two-Tone | BP1018 | Ceramic, dishwasher safe |
| Water Bottle SS | BP854 | 18/8 Stainless Steel, BPA-free |
| Tumbler 20oz | BP1927 | Stainless Steel, vacuum insulated |
| Vagabond 20oz | BP966 | Stainless Steel, double-walled |
| Sticker Vinyl | BP476 | Vinyl (waterproof, UV-resistant) |
| Mouse Pad | BP442 | Polyester cloth top, natural rubber base |
| Desk Mat LED | BP969 | Polyester cloth top, natural rubber base, LED strip |
| Sneaker Low | BP767 | Canvas upper, rubber sole, cushioned insole |

**Care instructions by product:**
| Product | Care |
|---|---|
| Ceramic Mug | Dishwasher safe. Microwave safe. |
| SS Bottle | Hand wash only. Not microwave safe. |
| SS Tumbler | Hand wash only. Not microwave safe. Not dishwasher safe. |
| Sticker | Waterproof. UV-resistant for 3+ years outdoor. |
| Mouse Pad | Wipe clean with damp cloth. |
| Desk Mat | Wipe clean with damp cloth. Do not submerge. |
| Sneaker | Spot clean. Air dry. Do not machine wash. |

### Step 7: Description Rules

**What goes in `description`** (creative text only):
- Design story, vibe, use case
- 2-3 sentences max
- Must be translated to EN, ES, DE
- Example (mug): "Start your morning with a stack trace and a smile. Full wrap-around code design on premium two-tone ceramic."
- Example (sticker): "Die-cut YOUR_BRAND_NAME mark in full gradient. Stick it on your laptop, water bottle, or that one meeting room whiteboard nobody cleans."

**What does NOT go in `description`**:
- Material/composition → `product_details.material`
- Care instructions → `product_details.care_instructions`
- Dimensions/capacity → handled by variant data
- Food safety → `product_details.safety_information`
- Finish type → `product_details.finish`

### Step 8: Publish + Confirm + Sync

```
POST .../publish.json
POST .../publishing_succeeded.json → { "external": { "id": "db-uuid" } }
GET /api/cron/sync-printify → syncs variants, images, prices, product_details
```

### Step 9: Post-Creation Verification

- [ ] Product in correct category (mugs, drinkware, stickers, sneakers, etc.)
- [ ] Variant sizes/finishes show correctly
- [ ] Color options work in ProductCard swatches (if multiple colors)
- [ ] Price correct (not overridden by margin fixer)
- [ ] Mockup images load
- [ ] Wrap-around design looks correct in mockup (no seam issues)
- [ ] GPSR safety info stored in product_details
- [ ] Food-contact compliance noted (drinkware)
- [ ] Shoe sizes show EU equivalents
- [ ] Description clean (no HTML, max 2000 chars)

---

## PART 3: Real Design References

**IMPORTANT**: Before creating any sublimation design, study these real existing designs:

### Branded Drinkware & Accessories (`/frontend/public/branded-previews/` + `/frontend/public/brand-designs/`)

| File | Product | Canvas | Design |
|---|---|---|---|
| `branded-previews/01-brand-noir-mug.png` | Mug 11oz BP1018 | 2244×945 | Brand mark + wordmark, horizontal lockup, white bg |
| `branded-previews/02-brand-signal-bottle.png` | Bottle BP854 | 2759×1500 | Brand mark + wordmark, horizontal lockup |
| `branded-previews/05-brand-grip-deskmat.png` | Desk Mat BP969 | 7205×3661 | Repeating brand mark pattern, B&W tiled diagonal |
| `branded-previews/06-brand-step-sneaker-*.png` | Sneaker BP767 | 1433×649/area | Brand mark + wordmark (body), mark only (tongue) |
| `branded-previews/07-brand-pack-sticker.png` | Sticker BP476 | 4500×4500 | Brand mark with FULL gradient fill, die-cut |
| `brand-designs/bottle-dark.png` | Bottle | landscape | Noir variant — navy S mark + wordmark horizontal |
| `brand-designs/bottle-gradient.png` | Bottle | landscape | Full gradient — coral→magenta→purple→blue→turquoise |
| `brand-designs/tumbler-ocean.png` | Tumbler | landscape | Ocean variant — blue→turquoise gradient subset |
| `brand-designs/tumbler-warm.png` | Tumbler | portrait | Warm variant — coral→magenta→purple gradient subset |

### Meme Accessories (`/frontend/public/meme-designs/`)

| File | Product | Design |
|---|---|---|
| `meme-designs/07-git-reset-mousepad.png` | Mouse Pad | Terminal: green "$" prompt + massive space + red "// when Claude rewrites your entire codebase" |
| `meme-designs/10-404-dev-gaming-pad.png` | Gaming/Desk Mat | Red "404" + ghost "DEVELOPER NOT FOUND" + separator + ghost footnote |
| `meme-designs/09-full-credit-laptop.png` | Laptop sleeve/accessory | Two-tone: ghost "I DIDN'T WRITE THIS CODE." + amber "But I take full credit." |

**Key patterns for sublimation products:**

1. **Drinkware branded**: Logo lockup horizontal, 5 variantes (Noir, White, Full Gradient, Ocean, Warm)
2. **Sticker**: ONLY product using full brand gradient — S mark die-cut
3. **Desk mat branded**: Repeating S mark pattern tiled diagonally
4. **Desk mat meme**: Same two-tone text pattern as garments but landscape canvas
5. **Mouse pad meme**: Extreme minimalism — huge empty space with tiny text element
6. **Sneakers**: White S mark + wordmark positioned in upper area of body panels, S mark alone on tongues

**Color rules for sublimation:**
- Drinkware supports full gradient (photographic quality sublimation)
- Gradient variants per "mood": Ocean (cool), Warm (hot), Noir (corporate), Gradient (full brand)
- Meme accessories use same color rules as garments (1-2 accent colors, not gradient)
- Stickers = only die-cut product using full brand gradient

---

## File Naming Convention

```
{collection}-{product-type}-{design-name}.png
```

Examples:
- `terminal-mug-coffee-code.png`
- `colorblock-bottle-gradient-wrap.png`
- `core-sticker-smark-diecut.png`
- `meme-mousepad-click-here.png`
- `core-sneaker-gradient-tongue.png`
- `devlife-deskmat-shortcuts.png`
