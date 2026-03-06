# Printful Research: Embroidered/Printed Hats (Part 2)

## Research Date: 2026-03-04
## Status: Complete

Data sources: Printful public catalog API (`GET /products/{id}`), authenticated mockup-generator printfiles API (`GET /mockup-generator/printfiles/{id}?technique=...`), Printful website, web search. All canvas dimensions verified against live API responses.

---

## 1. All-Over Print Reversible Bucket Hat

### Product Info

| Field | Value |
|---|---|
| **Full Name** | All-Over Print Reversible Bucket Hat |
| **Brand** | None (Printful-made) |
| **Model** | All-Over Print Reversible Bucket Hat |
| **Printful Catalog ID** | **654** |
| **API Type** | `CUT-SEW` |
| **Type Name** | All-Over Print Reversible Bucket Hat |
| **Variant Count** | 3 (one color, three sizes) |
| **Discontinued** | No |

### EU Fulfillment

| Region | Status |
|---|---|
| **EU (Europe)** | In stock |
| **EU_LV (Latvia)** | In stock |
| **US (United States)** | In stock |

EU fulfillment is confirmed from Printful Latvia, AS (Raina bulvaris 25, Riga, Latvia, LV-1050). All three size variants ship from Latvia.

### Print Technique (AOP Sublimation — Cut and Sew)

This product uses **All-Over Synthetic** (`CUT-SEW`) technique — NOT embroidery. It is placed in Printful's embroidered hats navigation category but the technique is dye sublimation on polyester. The hat is assembled via cut-and-sew after printing, allowing full seam-to-seam coverage on both sides independently.

**How it works:**
1. Design is sublimation-printed onto flat polyester fabric panels before cutting.
2. Panels are cut to hat pattern pieces.
3. Hat is sewn together, creating two complete independent sides (outside and inside).
4. Reversible construction means both sides are fully printed and wearable.

**Key properties:**
- Full-color, unlimited colors — no thread palette restriction
- Vibrant, fade-resistant results (dye bonds with polyester at molecular level)
- No tactile texture — smooth flat print, unlike embroidery
- Color accuracy depends on sRGB/CMYK conversion; actual colors may shift slightly

### Design Requirements (Both Sides)

#### Placements (from API — `GET /mockup-generator/printfiles/654`)

| Placement ID | Type | Printfile ID | Canvas (px) | DPI | Physical Size | Fill Mode |
|---|---|---|---|---|---|---|
| `outside_front` | outside_front | 410 | 2700 × 3150 | 150 | 18.0" × 21.0" (45.7 × 53.3 cm) | cover |
| `outside_back` | outside_back | 410 | 2700 × 3150 | 150 | 18.0" × 21.0" (45.7 × 53.3 cm) | cover |
| `inside_front` | inside_front | 410 | 2700 × 3150 | 150 | 18.0" × 21.0" (45.7 × 53.3 cm) | cover |
| `inside_back` | inside_back | 410 | 2700 × 3150 | 150 | 18.0" × 21.0" (45.7 × 53.3 cm) | cover |
| `label_outside` | label_outside | 411 | 450 × 300 | 150 | 3.0" × 2.0" (7.6 × 5.1 cm) | cover |
| `label_inside` | label_inside | 411 | 450 × 300 | 150 | 3.0" × 2.0" (7.6 × 5.1 cm) | cover |

**All four main panels share the same canvas template (printfile_id: 410)**:
- `2700 × 3150 px` @ 150 DPI
- Physical representation: 18" × 21" — this covers the full cut-and-sew panel area including crown and brim
- `fill_mode: cover` — design is stretched/cropped to fully cover the print area (no white gaps)
- Seams will cut into the printed area — keep critical elements (text, logos) in safe zone away from seam lines
- Design must be provided as a continuous flat panel (not a hat mockup)

**Critical design notes for AOP bucket hat:**
- Each side (outside / inside) is designed independently — different designs per side are allowed
- `outside_front` and `outside_back` = two halves of the exterior (split at side seams)
- `inside_front` and `inside_back` = two halves of the interior lining
- Stitch color selectable: White, Black, or Clear — set via `stitch_color` option
- Design should use `fill_mode: cover` — ensure design extends edge-to-edge with bleed
- Label placements are for custom branding labels on inside/outside

**File format:**
- PNG or JPEG (PNG preferred for transparency)
- Minimum 150 DPI (at 2700 × 3150 px canvas)
- sRGB color space
- No specific template download required — design fills the flat panel canvas

### Colors & Sizes

**Color:** White only — AOP sublimation requires a white base fabric for accurate color reproduction. All design colors are printed; there is no selectable hat body color.

**Sizes (from API variants):**

| Variant ID | Size | Price (USD) |
|---|---|---|
| 19255 | XS | $25.95 |
| 16360 | S/M | $25.95 |
| 16361 | L/XL | $25.95 |

**Physical measurements (from Fourthwall/product research):**

| Size | Head Circumference | Crown Height | Brim Height |
|---|---|---|---|
| XS | ~21.85" (55.5 cm) | 3.15"–3.94" | 2.76" |
| S/M | ~23.43" (59.5 cm) | 3.15"–3.94" | 2.76" |
| L/XL | ~25.00" (63.5 cm) | 3.15"–3.94" | 2.76" |

### Material & Construction

- **Material:** 100% polyester, 8.1 oz/yd² (275 g/m²) — moisture-wicking, breathable, linen-feel texture
- **Construction:** Reversible — two complete sides joined at brim; both sides fully printed and wearable
- **Closure:** None (pull-on style bucket hat)
- **Origin:** Manufactured by Printful (assembled in-house after sublimation printing)

### Pricing

| Cost | Value |
|---|---|
| Base cost (all sizes) | $25.95 USD |
| Suggested retail (35% margin) | ~$39.95–$44.95 USD |
| EUR equivalent (approx.) | €23.95–€24.95 |

Note: Printful's margin calculator may differ; price via dashboard or API for exact EUR pricing in EU store context.

### Production Time

- `avg_fulfillment_time`: null (not published in API; typically 2–5 business days for AOP products)
- Shipping from Latvia to EU: 3–7 business days standard

### Notes

- **This is NOT embroidery** — the product appears in the "embroidered hats" URL path on printful.com but uses `CUT-SEW` (sublimation + cut and sew). Do not present it as embroidered.
- Technique API key: `CUT-SEW`, display name: "All-over synthetic"
- Both sides are fully customizable — a common use case is two complementary colorways on each side
- "No bleed between A and B sides" confirmed by reviewers — the two sides are fully independent
- Stitch color (White/Black/Clear) is a small detail at the brim join — choose to match design edge colors
- For EU store: EU provider confirmed (Latvia). This product is GPSR-compliant candidate.
- **SKAPARA use case:** AOP bucket hats are excellent for loud pattern-based designs. Consider full-canvas patterns (geometric, abstract, brand pattern) rather than simple logo placement. Both sides allow different colorway of the same pattern.

---

## 2. Ribbed Knit Beanie — Atlantis

### Product Info

| Field | Value |
|---|---|
| **Full Name** | Ribbed Knit Beanie \| Atlantis |
| **Brand** | Atlantis Headwear |
| **Model** | RIO |
| **Printful Catalog ID** | **519** |
| **API Type** | `EMBROIDERY` |
| **Type Name** | Recycled Cuffed Beanie |
| **Variant Count** | 8 colors, one size |
| **Discontinued** | No |

### EU Fulfillment

| Region | Status |
|---|---|
| **EU (Europe)** | In stock |
| **EU_LV (Latvia)** | In stock |
| **US (United States)** | In stock |
| **CA (Canada)** | In stock (Black, Light Grey Melange, Mustard, Navy, Olive only) |

All 8 color variants are confirmed in stock for EU/EU_LV (Latvia). Canada availability varies by color.

### Embroidery Details

#### Technique

Standard embroidery — thread is stitched directly onto the knit fabric.

**Embroidery type options:**

| Type | API Key | Additional Price |
|---|---|---|
| Flat Embroidery | `flat` | $0.00 |
| 3D Puff | `3d` | +$1.50 |
| Partial 3D Puff | `both` | +$1.50 |

**Important note on 3D Puff for beanies:** 3D Puff adds raised foam under stitching for a dimensional effect. Works well on logos and text but requires minimum 5mm (0.2") element height. NOT recommended for fine details or text under 5mm. The ribbed knit texture of the RIO may slightly affect 3D puff uniformity — flat embroidery is recommended for most designs on this beanie.

#### Thread Colors & Stitch Count

**15 thread colors available, max 6 colors per design:**

| Color Code | Color Name |
|---|---|
| #FFFFFF | 1801 White |
| #000000 | 1800 Black |
| #96A1A8 | 1718 Grey |
| #A67843 | 1672 Old Gold |
| #FFCC00 | 1951 Gold |
| #E25C27 | 1987 Orange |
| #CC3366 | 1910 Flamingo |
| #CC3333 | 1839 Red |
| #660000 | 1784 Maroon |
| #333366 | 1966 Navy |
| #005397 | 1842 Royal |
| #3399FF | 1695 Aqua/Teal |
| #6B5294 | 1832 Purple |
| #01784E | 1751 Kelly Green |
| #7BA35A | 1848 Kiwi Green |

**Stitch limits:**
- Maximum 15,000 stitches per design
- Minimum line width (flat): 0.05" (1.3 mm)
- Minimum text height: 0.25" (6.4 mm)

**Note:** There is NO "unlimited color" option on the beanie (unlike the B682 corduroy hat). The 15-color palette with max 6 applies strictly.

#### Placements & Canvas Sizes

**From API (`GET /mockup-generator/printfiles/519`):**

| Placement ID | Type | Printfile ID | Canvas (px) | DPI | Physical Size | Fill Mode |
|---|---|---|---|---|---|---|
| `default` | embroidery_front | 74 | 1500 × 525 | 300 | **5.00" × 1.75"** (12.7 × 4.4 cm) | fit |

**Only one placement available on the Atlantis RIO beanie — front only.**

The 5.00" × 1.75" front panel is Printful's standard beanie embroidery area. This matches published guidelines for knit hats.

**Physical constraints:**
- Width: 5.00" (127 mm) — spans across the full front cuff
- Height: 1.75" (44.5 mm) — constrained by the cuff fold depth
- `fill_mode: fit` — design is scaled to fit within the canvas without cropping (letterboxed)

### Design Requirements

**File formats accepted:** AI, PDF, EPS (vector preferred), high-resolution PNG

**For raster files:**
- Minimum 300 DPI at print size
- Submit at canvas dimensions: 1500 × 525 px @ 300 DPI
- Color mode: sRGB (Printful converts to thread palette)

**Design best practices for ribbed knit:**
- Bold, simple shapes work best — the rib texture slightly affects fine details
- Minimum line/stroke: 0.05" (1.3 mm) for flat; 0.2" (5 mm) for 3D puff
- Avoid complex gradients — only 15 solid thread colors available; gradients are approximated with fill patterns
- Text minimum: 0.25" tall (outlined text); 0.5" for filled/block text
- Keep design within the 5" × 1.75" canvas; the cuff fold covers the bottom of the design when worn — account for this in vertical placement
- Simple logos, wordmarks, and minimal illustrations are ideal for this format

### Colors & Sizes

**Size:** One size fits most (OSFA)

**Available colors (8 variants, all EU in-stock):**

| Variant ID | Color | Hex |
|---|---|---|
| 13238 | Black | #0a0a0a |
| 13242 | Olive | #655b3b |
| 13241 | Navy | #052438 |
| 13240 | Mustard | #f19f00 |
| 13239 | Light Grey Melange | #b8b3af |
| 15016 | Beige | #f4d8b5 |
| 15019 | Light Blue | #e4f3ff |
| 15020 | Acid Green | #e3ff82 |

**SKAPARA thread recommendations per hat color:**
- Black → White (1801), Gold (1951), or Aqua/Teal (1695)
- Olive → White (1801), Old Gold (1672), or Kiwi Green (1848)
- Navy → White (1801), Gold (1951), or Aqua/Teal (1695)
- Mustard → Black (1800), Maroon (1784), or Royal (1842)
- Light Grey Melange → Black (1800), Navy (1966), or Maroon (1784)
- Beige → Black (1800), Maroon (1784), or Old Gold (1672)
- Light Blue → Navy (1966), Royal (1842), or White (1801)
- Acid Green → Black (1800) or Maroon (1784)

### Material

**From Atlantis Headwear official specs (RIO model):**
- 50% recycled polyester, 50% acrylic
- Narrow 1×1 rib knit construction
- Double-layer (two layers of knit for warmth)
- Cuffed style
- Length: 8.27" (21 cm)
- Width (flat): ~7.5" (19 cm)
- **Sustainability certifications:** GRS (Global Recycled Standard), OEKO-TEX
- One plastic bottle recycled per hat

### Pricing

| Cost | Value |
|---|---|
| Base cost (all colors) | $16.75 USD |
| Suggested retail (35% margin) | ~$25.95–$29.95 USD |
| EUR equivalent (approx.) | €15.50–€16.50 base |

### Production Time

- `avg_fulfillment_time`: null (typical embroidery: 2–5 business days)
- Shipping EU (Latvia): 3–7 business days standard

### Notes

- **Printful type name is "Recycled Cuffed Beanie"** — the model is the Atlantis RIO, a sustainable product with recycled content. This is a strong GPSR/sustainability selling point.
- API confirms ONLY `embroidery_front` placement — no back, side, or wrist placements on this beanie (unlike hoodies). This is a single-placement product.
- No `unlimited_color` option available (unlike B682 corduroy hat which offers it at +$3.50). Designs are strictly limited to 15-thread palette, max 6 colors.
- The ribbed knit texture affects fine embroidery detail reproduction — bold, clean logos work significantly better than intricate illustrations.
- GRS/OEKO-TEX certifications make this product marketable for sustainability-focused product lines. Document in `product_details.safety_information` and GPSR fields.
- **For SKAPARA:** The S-mark at 5" × 1.75" with 1–2 thread colors is the ideal use case. Consider using the wordmark in a single color (White on Black, White on Navy) for clean minimal brand expression.

---

## 3. Corduroy Hat — Beechfield B682 (DTFilm)

### Product Info

| Field | Value |
|---|---|
| **Full Name** | Corduroy Hat \| Beechfield B682 |
| **Brand** | Beechfield |
| **Model** | B682 (Heritage Cord Cap) |
| **Printful Catalog ID** | **532** |
| **API Type** | `EMBROIDERY` (default), `DTFILM` (alternate) |
| **Type Name** | Hat |
| **Variant Count** | 4 colors, one size |
| **Discontinued** | No |

### EU Fulfillment

| Region | Status |
|---|---|
| **EU (Europe)** | In stock |
| **EU_LV (Latvia)** | In stock |
| **US (United States)** | In stock |
| **UK (United Kingdom)** | In stock |

All 4 color variants confirmed in-stock for EU/EU_LV. This is a strong EU-candidate product — manufactured and fulfilled from Latvia for EU orders.

### DTFilm Technique Details

#### What is DTFilm?

DTFilm is Printful's branded implementation of **DTF (Direct-to-Film) printing**, marketed as **DTFlex** in their consumer-facing branding. The `DTFILM` key in the API corresponds to the same technology.

**Process (step by step):**
1. The design is inkjet-printed in CMYK onto a special PET transfer film using water-based pigment inks.
2. A fine adhesive powder (hot-melt adhesive) is applied evenly over the wet ink.
3. The powder-coated film is cured in an oven to activate and bond the adhesive.
4. The cured film is positioned face-down on the hat fabric.
5. A heat press applies heat (~165°C / 329°F) and pressure for 15–20 seconds.
6. The film is peeled off (cold-peel method in Printful's DTFlex implementation), leaving the printed design bonded to the fabric.
7. A second pressing seals and enhances durability.

**Key differentiator (DTFlex vs generic DTF):** Printful's DTFlex uses a proprietary glue application that eliminates the visible glue halo common in third-party DTF transfers. The result is clean, defined edges without residue — critical for logo and text legibility on hat fabric.

**Launched:** October 2025 (DTFlex brand name). The underlying DTF technology was in use prior to this rebrand.

#### DTFilm vs Embroidery Comparison

| Attribute | DTFilm (DTFlex) | Embroidery |
|---|---|---|
| **Color range** | Unlimited — full CMYK, gradients, photos | 15 thread colors, max 6 per design |
| **Detail capability** | Very high — fine lines, gradients, photorealistic | Limited — min 1.3mm lines, no gradients |
| **Minimum line width** | ~0.5mm (printable) | 1.3mm (1801-standard), 5mm (3D puff) |
| **Texture/feel** | Flat printed film layer on surface | Raised 3D texture, tactile stitching |
| **Premium feel** | Good (clean, vibrant) | Higher — embroidery signals quality/craft |
| **Durability** | Excellent — survives repeated washing if properly applied | Excellent — thread does not fade |
| **Complex artwork** | Excellent — ideal for detailed logos, gradients, photos | Poor — detail lost in stitching |
| **Solid fill areas** | Less breathable (film sits on top) | Breathable (thread allows airflow) |
| **Price (base hat)** | $16.95 + $2.95 for front print placement | $16.95 base (front included in base price) |
| **Best for** | Multi-color logos, gradients, fine text, illustrations | Bold simple logos, text, brand marks |
| **Look** | Flat, graphic/screen-print aesthetic | Dimensional, luxury/artisanal aesthetic |
| **Stitch upcharge** | N/A | +$1.50 for 3D puff or partial 3D puff |

**When to choose DTFilm for this hat:**
- Design uses more than 6 colors or has gradients
- Design includes photographic elements or complex illustrations
- Design has very fine text below 1.3mm line width
- Target market expects a streetwear/graphic-print aesthetic over a luxury embroidered one

**When to choose Embroidery:**
- Design is a clean, bold logo or wordmark (2–4 colors)
- Target market expects premium headwear feel
- Design does NOT have gradients or fine detail
- Back/side placements are needed (embroidery supports back, left, right; DTFilm front-only)

#### Print Area & Canvas Sizes

**DTFilm (DTFILM technique) — from authenticated API (`GET /mockup-generator/printfiles/532?technique=DTFILM`):**

| Placement ID | Type | Printfile ID | Canvas (px) | DPI | Physical Size | Fill Mode |
|---|---|---|---|---|---|---|
| `front_dtf_hat` | Front print | 816 | 1500 × 600 | 300 | **5.00" × 2.00"** (12.7 × 5.1 cm) | fit |

**DTFilm front print area: 5.00" × 2.00" (1500 × 600 px @ 300 DPI)**

**Embroidery placements — from API (`GET /mockup-generator/printfiles/532`, default EMBROIDERY technique):**

| Placement ID | Type | Printfile ID | Canvas (px) | DPI | Physical Size | Fill Mode | Additional Price |
|---|---|---|---|---|---|---|---|
| `default` | embroidery_front | 78 | 1200 × 525 | 300 | **4.00" × 1.75"** (10.2 × 4.4 cm) | fit | Included |
| `back` | embroidery_back | 76 | 600 × 300 | 300 | **2.00" × 1.00"** (5.1 × 2.5 cm) | fit | +$2.95 |
| `left` | embroidery_left | 76 | 600 × 300 | 300 | **2.00" × 1.00"** (5.1 × 2.5 cm) | fit | +$2.95 |
| `right` | embroidery_right | 76 | 600 × 300 | 300 | **2.00" × 1.00"** (5.1 × 2.5 cm) | fit | +$2.95 |
| `front_dtf_hat` | Front print (DTF) | 816 | 1500 × 600 | 300 | **5.00" × 2.00"** | fit | +$2.95 |

**Key observation:** DTFilm front area (5.00" × 2.00") is **25% wider and 14% taller** than the embroidery front (4.00" × 1.75"), giving more design space for DTF.

**DTFilm is front-only.** The API `available_placements` for DTFILM technique returns only `front_dtf_hat`. If back, left, or right placements are needed, embroidery must be used (or combined via the embroidery technique with multi-placement).

**Unlimited color embroidery option:**
The `front` embroidery placement has a `full_color` option available (+$3.50) — this is Printful's "Unlimited Color" embroidery for complex designs. This is a different product from DTFilm; it uses specialized thread techniques to achieve gradient-like effects.

### Design Requirements

**For DTFilm (front_dtf_hat placement):**
- Canvas: 1500 × 600 px at 300 DPI
- Physical: 5.00" × 2.00"
- File format: PNG (recommended), JPEG accepted
- Color mode: sRGB (DTF printers are calibrated to sRGB)
- Transparency: supported (PNG) — design can have transparent background; hat fabric shows through
- `fill_mode: fit` — design is scaled to fit within 5" × 2" without cropping
- Avoid large solid background fills — these feel stiff/less breathable on the fabric when worn
- Fine details render well down to ~0.5mm — much finer than embroidery allows
- Gradients and multi-color blends are fully supported
- No color palette restrictions — full CMYK gamut

**For Embroidery (front placement):**
- Canvas: 1200 × 525 px at 300 DPI
- Physical: 4.00" × 1.75"
- 15 thread colors, max 6 per design
- Minimum line: 0.05" (1.3 mm) flat, 0.2" (5 mm) 3D puff
- Vector files preferred (AI, EPS, PDF) for cleaner digitization

### Colors & Sizes

**Size:** One size fits all (adjustable)

**Adjustable closure:** Corduroy strap with silver-colored metal buckle and grommet

**Available colors (4 variants, all EU in-stock):**

| Variant ID | Color | Hex | Character |
|---|---|---|---|
| 13351 | Black | #0f0f0f | Classic, versatile |
| 13352 | Camel | #b3753d | Warm, vintage |
| 13353 | Dark Olive | #374225 | Earthy, outdoor |
| 13354 | Oxford Navy | #181e42 | Traditional, premium |

### Material & Construction

**From Beechfield official specs (B682 Heritage Cord Cap):**
- **Material:** 100% cotton corduroy (Heritage Cord fabric)
- **Sweatband:** Cotton twill with cotton taping
- **Profile:** Low profile, unstructured crown
- **Panels:** 6-panel construction
- **Closure:** Adjustable corduroy strap with metal buckle
- **Brim:** Pre-curved brim
- **Origin:** Blank sourced from China (Beechfield manufacture); decorated in Latvia by Printful

### Pricing

| Cost | Value |
|---|---|
| Base hat (all colors) | $16.95 USD |
| DTFilm front print | +$2.95 USD |
| **Total with DTFilm front** | **$19.90 USD** |
| Embroidery back (optional) | +$2.95 USD |
| Embroidery left/right side (optional each) | +$2.95 USD |
| Unlimited color embroidery front | +$3.50 USD |
| Suggested retail DTFilm (35% margin) | ~$29.95–$34.95 USD |
| Suggested retail Embroidery (35% margin) | ~$26.95–$29.95 USD |

### Production Time

- `avg_fulfillment_time`: null (typical hat embroidery: 2–5 business days; DTF similar)
- Shipping EU from Latvia: 4–10 business days depending on destination

### Notes

- **DTFilm = DTFlex** — Printful's API key is `DTFILM`, consumer brand name is DTFlex (since October 2025). Both refer to the same direct-to-film process.
- The B682 is notable for being one of the few Printful hat products that supports BOTH embroidery AND DTFilm — most hats offer only one technique.
- Embroidery includes back, left, and right placements; DTFilm is front-only. For SKAPARA's multi-position branding strategy, consider: DTFilm front (detailed design) + cannot add embroidered back with DTFilm — a multi-technique approach would require separate product setups.
- The corduroy texture is compatible with DTFilm — the film bonds to the corduroy surface adequately. Embroidery also works well on corduroy.
- For GPSR compliance: Blank sourced from China (Beechfield) but decorated in Latvia by Printful Latvia, AS. Manufacturing country in `product_details` should be documented as "Latvia" (where decoration/fulfillment occurs) or "China/Latvia" depending on interpretation. Confirm with Printful support for regulatory precision.
- **For SKAPARA DTFilm use case:** The Camel and Dark Olive colors are most distinctive for corduroy. DTFilm allows full-color SKAPARA gradient logos — the gradient wordmark or S-mark gradient would be impossible with standard embroidery but works beautifully with DTFilm.
- The `unlimited_color` embroidery option (+$3.50 front) is an alternative to DTFilm for complex designs while retaining embroidery texture — worth testing.

---

## Technique Comparison Notes

### DTFilm vs Embroidery vs AOP for Hats

| Dimension | DTFilm (DTFlex) | Standard Embroidery | Unlimited Color Embroidery | AOP Sublimation |
|---|---|---|---|---|
| **Colors** | Unlimited CMYK | 15 colors, max 6 | Unlimited (via complex threading) | Unlimited CMYK |
| **Detail** | Very high | Low-medium | Medium-high | Very high |
| **Texture** | Flat graphic | Raised 3D thread | Raised (less than flat) | Flat |
| **Premium perception** | Medium-high | High | Very high | Medium |
| **Best design type** | Complex logos, gradients, illustrations | Bold logos, wordmarks | Gradient logos, medium complexity | Full patterns, both-side coverage |
| **Coverage** | Front panel only (hat) | Front, back, sides | Front only (+$3.50) | Full hat coverage |
| **EU availability** | Yes (Latvia) | Yes (Latvia) | Yes (Latvia) | Yes (Latvia) |
| **Products available** | Select dad hats, trucker hats | Most hats, beanies | Select hats | Reversible bucket hat (special) |
| **File format** | PNG/JPEG, sRGB, 300 DPI | Vector (AI/EPS/PDF) preferred | Vector preferred | PNG/JPEG, sRGB, 150 DPI |
| **Washability** | Excellent | Excellent | Excellent | Excellent |

### Summary Recommendations for SKAPARA Hat Line

1. **AOP Reversible Bucket Hat (ID: 654):** Best for bold all-over pattern designs — use for statement accessories. Both sides can carry the SKAPARA pattern in different colorways. Not for simple logo placement.

2. **Atlantis Ribbed Knit Beanie (ID: 519):** Best for minimal S-mark or wordmark in 1–2 thread colors. EU sustainability story (GRS-certified recycled polyester). Limited to front embroidery only, so SKAPARA branding must be impactful at 5" × 1.75".

3. **Beechfield B682 Corduroy Hat (ID: 532):**
   - With **Embroidery**: Classic heritage-style hat with traditional logo. Use S-mark or wordmark in 2–3 colors. Supports multi-position (front + back or sides).
   - With **DTFilm**: Enables gradient and full-color SKAPARA logo that embroidery cannot achieve. Front-only, but higher design fidelity. Best for the Camel and Dark Olive colorways where the contrast against the corduroy is striking.

---

## API Notes

```bash
# Get product catalog data (public, no auth)
curl 'https://api.printful.com/products/654' -H 'User-Agent: POD-AI-Store/1.0'
curl 'https://api.printful.com/products/519' -H 'User-Agent: POD-AI-Store/1.0'
curl 'https://api.printful.com/products/532' -H 'User-Agent: POD-AI-Store/1.0'

# Get printfile specs (requires auth + store ID)
# Default technique (EMBROIDERY for 519/532, CUT-SEW for 654):
curl 'https://api.printful.com/mockup-generator/printfiles/{id}' \
  -H 'Authorization: Bearer $PRINTFUL_API_TOKEN' \
  -H 'X-PF-Store-Id: $PRINTFUL_STORE_ID' \
  -H 'User-Agent: POD-AI-Store/1.0'

# DTFilm technique specifically (for B682):
curl 'https://api.printful.com/mockup-generator/printfiles/532?technique=DTFILM' \
  -H 'Authorization: Bearer $PRINTFUL_API_TOKEN' \
  -H 'X-PF-Store-Id: $PRINTFUL_STORE_ID' \
  -H 'User-Agent: POD-AI-Store/1.0'
```

### Canvas Dimensions Quick Reference

| Product | Placement | Printfile ID | Pixels | DPI | Physical |
|---|---|---|---|---|---|
| 654 AOP Bucket Hat | outside_front, outside_back, inside_front, inside_back | 410 | 2700 × 3150 | 150 | 18.0" × 21.0" |
| 654 AOP Bucket Hat | label_outside, label_inside | 411 | 450 × 300 | 150 | 3.0" × 2.0" |
| 519 Atlantis Beanie | embroidery_front | 74 | 1500 × 525 | 300 | 5.00" × 1.75" |
| 532 B682 Corduroy | embroidery_front | 78 | 1200 × 525 | 300 | 4.00" × 1.75" |
| 532 B682 Corduroy | embroidery_back, left, right | 76 | 600 × 300 | 300 | 2.00" × 1.00" |
| 532 B682 Corduroy | front_dtf_hat (DTFILM) | 816 | 1500 × 600 | 300 | 5.00" × 2.00" |

### Product IDs Summary

| Product | Catalog ID | Default Technique | EU Provider |
|---|---|---|---|
| All-Over Print Reversible Bucket Hat | 654 | CUT-SEW (AOP sublimation) | Printful Latvia |
| Ribbed Knit Beanie \| Atlantis RIO | 519 | EMBROIDERY | Printful Latvia |
| Corduroy Hat \| Beechfield B682 | 532 | EMBROIDERY (+ DTFILM available) | Printful Latvia |

---

*Sources: Printful Public Catalog API, Printful Authenticated Mockup-Generator API, [Printful DTFlex overview](https://www.printful.com/dtflex), [Printful customization techniques](https://www.printful.com/customization-techniques), [Printful hat embroidery guide](https://www.printful.com/blog/custom-embroidered-hats-guide-to-creating-a-design-and-embroidery-file), [Atlantis Headwear RIO specs](https://atlantisheadwear.com/en/collection-products/rio/), Beechfield B682 product data*
