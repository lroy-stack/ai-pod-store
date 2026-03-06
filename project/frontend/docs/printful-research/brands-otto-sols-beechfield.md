# Printful Brand Research: Otto Cap, SOLS, Beechfield

## Research Date: 2026-03-04
## Status: Partial — Dashboard URLs inaccessible (require auth + JS rendering). All data sourced from public Printful product pages, Printful demo store, web searches, and Printful help documentation.

---

## Access Notes

- `printful.com/es/dashboard/custom/brands/*` — redirect to login, inaccessible without auth
- `printful.com/custom/brands/*` — page loads but requires JavaScript rendering; WebFetch only returns nav/metadata shell
- `printful-demo-store.myshopify.com` — MOST USEFUL source; renders full product data including Printful catalog IDs (`pfProductId`), exact colors, SKUs, prices
- Printful Help Center (`help.printful.com`) — blocked by 403 for some pages
- Individual product pages (`printful.com/custom/embroidered/...`) — partially rendered, gives prices and reviews but not colors/dimensions consistently

---

## General Printful EU Fulfillment (All Brands)

Printful has three EU in-house fulfillment facilities:

| Location | Country | Products / Techniques |
|---|---|---|
| Riga | Latvia (EU) | DTG, embroidery, sublimation, all-over print, knitting |
| Sant Climent de Llobregat | Spain (EU) | DTG, embroidery, accessories |
| Leeds / London area | UK (post-Brexit, NOT EU) | DTG, embroidery, home & living |

**Important for SKAPARA (EU-only store):** Latvia and Spain facilities are EU-based. The UK facility ships to EU but with potential customs complications post-Brexit. Orders are routed automatically by Printful; you cannot force a specific EU facility per product.

**Embroidery is available from EU locations (Latvia confirmed via customer reviews for hats, Spain also handles embroidery).** This is critical: all three brands below use embroidery as the primary or only decoration technique for hats.

---

## 1. Otto Cap

### Overview

Otto Cap is a US-based headwear manufacturer. Their blanks are sourced from China, then decorated by Printful (embroidery is the primary technique). All Otto Cap products on Printful are **embroidery-only** (no DTG, no sublimation). Printful fulfills from EU facilities (Latvia/Spain) for EU customers.

### Products Available

| Product Name | Otto Cap Model | Printful Cat. ID | Type | Base Price (USD) |
|---|---|---|---|---|
| Vintage Cap | 18-1248 | 327 | Dad hat / low profile | $19.25 |
| Denim Hat | 18-204 | — | Dad hat / 6-panel denim | $16.95 |
| Distressed Dad Hat | 104-1018 | 396 | Dad hat / distressed | $17.25 |
| 5 Panel Mid Profile Baseball Cap | 31-069 | 952 | Dad hat / 5-panel | $11.25 |
| Foam Trucker Hat | 39-165 | — | Trucker | $11.95 |
| Snapback | 125-978 | — | Snapback / flat visor | $14.95 |
| Mesh Back Snapback | 154-1124 | 182 | Snapback / trucker hybrid | $13.39–$19.50 |
| Knit Beanie | 82-480 | 81 | Beanie | $13.50 |

> Note: Catalog IDs recovered from demo store page source (`pfProductId` variable) or URL parameter `productId=`. Dashes indicate IDs not yet confirmed.

### Colors Available (Confirmed per Model)

**Otto Cap 18-1248 Vintage Cap (Cat. 327):**
- Black, Navy, Charcoal Grey (3 colors confirmed)

**Otto Cap 104-1018 Distressed Dad Hat (Cat. 396):**
- Black, Navy, Charcoal Grey, Khaki (4 colors confirmed)

**Otto Cap 154-1124 Mesh Back Snapback (Cat. 182):**
- Charcoal Gray confirmed; additional colors likely available on full Printful catalog (5-panel trucker style typically 10–15 color options)

**Other models (18-204, 39-165, 125-978, 31-069, 82-480):**
- Colors not confirmed from available sources. Expect 3–8 colorways per model based on Otto Cap's standard wholesale lineup. Check individual Printful product pages.

### Construction & Materials

| Model | Material | Construction |
|---|---|---|
| 18-1248 | 100% cotton twill | 6-panel, unstructured, low profile, metal snap buckle, vintage wash |
| 18-204 | Denim (cotton) | 6-panel, adjustable strap |
| 104-1018 | 100% pre-shrunk cotton twill | 6-panel, unstructured, low profile, hook-and-loop closure, distressed brim/crown |
| 154-1124 | 100% cotton front, 100% polyester mesh back | 5-panel, high profile, buckram front, flat visor, plastic snap closure |
| 82-480 | Acrylic knit | Form-fitting beanie, one size |

All blanks sourced from China.

### EU Fulfillment

- All Otto Cap products decorated and fulfilled from Printful EU facilities (Latvia/Spain)
- Embroidery is performed at EU locations for EU customer orders
- No EU-manufactured blank restriction applies (Printful adds embroidery in EU)
- Standard production time: 2–5 business days

### Print / Decoration Techniques

**Only embroidery is available for Otto Cap hats on Printful.** No DTG, no sublimation, no DTFilm (DTFlex).

Two embroidery variants are offered on **select** models:
1. **Standard Embroidery** — Up to 15 thread colors per design, max 15,000 stitches
2. **Unlimited Color Embroidery** — CMYK ink-dyed white polyester thread, gradient-capable; adds **+$3.50 USD / €3.25 EUR** per unit

Check individual product pages for which technique is available on each specific model.

### Print / Embroidery Area Dimensions

Printful hat embroidery dimensions (applies to all hat brands, including Otto Cap):

| Placement | Dimensions | Notes |
|---|---|---|
| Front panel (standard) | **5.5″ × 2″** (140 × 51 mm) | Old standard, still applies to some models |
| Front panel (new expanded) | **6.3″ × 2.56″** (160 × 65 mm) | Upgraded on select structured hats |
| Front panel (low profile/dad hat) | **4″ × 1.75″** (102 × 44 mm) | Lower profile hats have smaller area |
| Side panel | **2″ × 1″** (51 × 25 mm) | 10 characters per line max |
| Back panel | **2″ × 1″** (51 × 25 mm) | Text only recommended |
| Knit beanie | **5″ × 1.75″** (127 × 44 mm) | Stretchable fabric, stitch count more critical |

Confirm exact dimensions for each model on the Printful product page, as the canvas varies by hat profile and brand.

### File Requirements for Embroidery

- **Format:** High-resolution PNG (150–300 DPI) or vector EPS preferred
- **DPI:** 150–300 DPI (NOT higher — embroidery digitizing does not benefit from 300+ DPI)
- **Min text height:** 0.25″ (6.35 mm); outlined text min 0.5″
- **Min element thickness:** 0.05″ for flat embroidery; 0.2″–0.5″ for 3D puff
- **Standard embroidery color limit:** Up to 15 thread colors available from Printful palette, but **max 6 colors per design** for standard embroidery
- **Max stitches:** 15,000 per design
- **Unlimited embroidery:** No color limit, uses CMYK ink-dyed polyester thread; min element width 0.79″ (2 cm) per color blend

### Pricing

| Model | Base Price (USD) | Est. EUR |
|---|---|---|
| Foam Trucker 39-165 | $11.95 | ~€11 |
| Mesh Back Snapback 154-1124 | ~$13.39 | ~€12.50 |
| 5 Panel Mid Profile 31-069 | $11.25 | ~€10.50 |
| Snapback 125-978 | $14.95 | ~€14 |
| Knit Beanie 82-480 | $13.50 | ~€12.50 |
| Denim Hat 18-204 | $16.95 | ~€15.50 |
| Vintage Cap 18-1248 | $19.25 | ~€17.50 |
| Distressed Dad Hat 104-1018 | $17.25 | ~€16 |

> Demo store retail prices (with Printful markup applied): 18-1248 retails at $30.50, 104-1018 retails at $29.00. Apply your own margin on top of base prices.

Unlimited color embroidery adds +$3.50 / €3.25 to base price.

### Notes & Limitations

1. **All blanks sourced from China** — Otto Cap manufactures in Asia. The embroidery is applied in EU (Latvia/Spain). For GPSR compliance, manufacturer is Otto Cap (USA), decoration in Latvia/Spain.
2. **No DTG option** — If you need printed hats (not embroidered), Otto Cap is not the right blank.
3. **Embroidery area is small** — Complex multi-element designs will not translate well. Logos and text work best.
4. **Distressed models** — Front panel of 104-1018 has no buckram; structural designs may look uneven.
5. **Wool Blend Snapback 125-978** — Customer reviews note firm structure, flat visor. Good for bold embroidery.
6. **Beanie 82-480** — Acrylic knit (not cotton/merino). Review feedback suggests it runs thin. Embroidery creates slight surface impression on the knit.
7. **GPSR EU Compliance:** Printful generates product safety documentation. Required fields: manufacturer (Otto Cap, Inc., 19416 S. Vermont Ave., Torrance, CA 90502, USA), material (cotton twill or acrylic), care instructions.

---

## 2. SOLS (SOL'S)

### Overview

SOLS (SOL'S) is a French brand (SOLS Europe SAS, headquarters in France) that manufactures eco-friendly, GOTS-certified organic cotton and recycled polyester apparel. The brand is EU-origin for some products. Printful offers SOL'S apparel primarily with **DTG printing** and **embroidery**; some models also support DTFilm (DTFlex). EU fulfillment from Latvia and Spain.

### Products Available

#### Confirmed on Printful:

| Product Name | SOL'S Model | Printful Cat. ID | Type | Base Price (USD) |
|---|---|---|---|---|
| Unisex Eco Raglan Hoodie | 03568 | — | Pullover hoodie | $40.50 |
| Unisex Organic Raglan Sweatshirt | 03567 | — | Crewneck sweatshirt | $29.75 |
| Unisex Organic Sweatshirt | 03574 | — | Crewneck sweatshirt | $25.25 |
| Women's Basic Organic T-Shirt | 02077 | — | Women's t-shirt | ~$15–18 est. |
| Unisex Sports Jersey | 11939 | — | Sports jersey | $16.75 |
| Unisex Premium Pique Polo Shirt | 11362 | — | Polo shirt | $20.25 |
| Unisex Basic Zip Hoodie | 01714 | — | Zip hoodie | ~$30–35 est. |
| Kids Eco Hoodie | 03576 | — | Kids hoodie | $29.75 |
| Organic Cotton Apron | 03569 | 565 | Apron | $25.25 |

> Catalog IDs: Only 03569 confirmed (Cat. 565). Others require Printful API query or dashboard access.

**Additional products referenced but model numbers not confirmed:**
- SOL'S joggers / sweatpants (mentioned in Printful marketing copy)
- Women's polo shirts
- Men's basic t-shirts (non-organic variants)

### Colors Available (Partial)

**SOL'S 03567 Organic Raglan Sweatshirt:**
- 6 colors confirmed (including Black, Burnt Orange; others not named)

**SOL'S 03574 Organic Sweatshirt:**
- Black, White, Blue, Gray variants confirmed from reviews. Full palette likely 8–12 colors.

**SOL'S 03569 Organic Apron:**
- Black, Red, Rope (natural/beige) confirmed from reviews

**SOL'S 02077 Women's Organic T-Shirt:**
- 100% organic cotton; colors not confirmed from available sources

**Other models:** Colors not confirmed. Check Printful catalog pages.

### Materials & Construction

| Model | Material | Notes |
|---|---|---|
| 03568 | Organic cotton + recycled polyester blend | Fleece lining, soft exterior |
| 03567 | Organic cotton blend | Fleece lining, raglan sleeves, 6 colors |
| 03574 | 80% organic cotton, 20% recycled polyester | "Comet" — lighter weight, woven texture interior (not fluffy) |
| 02077 | 100% organic cotton | 155 g/m² (4.57 oz/yd²), slim fit, ribbed collar, enzyme-treated for softness |
| 11939 | 100% polyester mesh | 140 g/m² (4.13 oz/yd²), relaxed fit, breathable |
| 11362 | Premium pique cotton blend | Polo construction |
| 03569 | 100% cotton | Adjustable neck closure, front pockets |
| 03576 | Organic cotton + recycled polyester | Kids sizes by age (4Y–12Y range) |

**Origin:** SOL'S garments are manufactured in Bangladesh (02077 confirmed). SOL'S is a French brand but blanks are not EU-manufactured. Printful EU decoration (DTG/embroidery) applied in Latvia or Spain.

### EU Fulfillment

- DTG and embroidery fulfilled from Printful EU facilities (Latvia and Spain confirmed)
- SOL'S 03574 review confirms Spain warehouse for blue colorway
- SOL'S 03569 apron ships from Latvia (confirmed in review)
- Standard production: 2–5 business days
- EU-to-EU shipping avoids customs for end customers

### Print / Decoration Techniques

SOL'S products support multiple techniques depending on the model:

| Technique | Available On |
|---|---|
| DTG (Direct-to-Garment) | 03567, 03574, 03568, 11939, 02077, 03576, 01714 |
| Embroidery (standard, up to 15 colors) | 03567, 03574, 03568, 03569, 11362, 03576 |
| Unlimited Color Embroidery | 03574 confirmed (reviews mention it), others need verification |
| DTFilm / DTFlex | 11939 confirmed (Fourthwall listing shows "DTFX") |
| All-over print (AOP) | NOT available on SOL'S blanks (Printful AOP uses different blank suppliers) |
| Sublimation | NOT available on SOL'S cotton blanks |

### Print Area Dimensions

Printful standard DTG print areas (applies to SOL'S apparel):

| Placement | New Standard (from ~2023) | Old Standard |
|---|---|---|
| Front chest (large) | **15″ × 18″** (381 × 457 mm) | 12″ × 16″ (305 × 406 mm) |
| Back | **15″ × 18″** (381 × 457 mm) | 12″ × 16″ (305 × 406 mm) |
| Left chest (small logo) | ~4″ × 4″ (102 × 102 mm) | — |
| Sleeve | ~3″ × 13″ (76 × 330 mm) | — |

> Note: Smaller sizes (XS, S) may not support the full 15×18 area. Always check per-product size guide on Printful.

For **embroidery on SOL'S apparel:**
- Chest center: ~5″ × 3″ (127 × 76 mm) typical for sweatshirts/hoodies
- Left chest (logo placement): 2.5″–4″ wide × 1″–2″ tall
- Back yoke: Up to 5″ wide × 3″ tall

### File Requirements (DTG)

- **Format:** PNG with transparent background
- **Resolution:** 150–300 DPI at print size
- **Color mode:** RGB (sRGB color space)
- **White underbase:** Auto-applied by Printful for dark fabrics
- **File size:** Max 200 MB

### Pricing

| Model | Base Price (USD) | Est. Retail w/ Margin |
|---|---|---|
| Sports Jersey 11939 | $16.75 | ~$35–45 |
| Polo Shirt 11362 | $20.25 | ~$42–55 |
| Organic Sweatshirt 03574 | $25.25 | ~$55–70 |
| Apron 03569 | $25.25 | ~$50–65 |
| Organic Raglan Sweatshirt 03567 | $29.75 | ~$65–80 |
| Kids Eco Hoodie 03576 | $29.75 | ~$60–75 |
| Eco Raglan Hoodie 03568 | $40.50 | ~$85–110 |

> EUR pricing: Printful's EU store prices in EUR. Contact Printful or use API v2 (returns EUR for EU stores) for exact EUR base costs.

### Notes & Limitations

1. **Eco-premium positioning** — SOL'S organic/recycled materials command higher prices. Target eco-conscious consumers.
2. **Sizing runs small** — Multiple products (03567, 03574, 03568) consistently reviewed as running small. Recommend size-up messaging in product listings.
3. **03574 is a lightweight sweatshirt** — Not a traditional fleece hoodie; woven interior texture. Marketing should describe accurately.
4. **GPSR:** Manufacturer is SOL'S Europe SAS (French company). Material, composition, and care instructions required. Printful auto-generates some compliance fields.
5. **Sports Jersey 11939** — 100% polyester, DTFlex confirmed on Fourthwall. Good for sublimation-style designs at lower price point but not true sublimation.
6. **Apron 03569 (Cat. 565)** — Embroidery only (not DTG). One-size-fits-most with adjustable ties. Latvia fulfillment confirmed.
7. **Kids Eco Hoodie 03576** — Sizing by age label runs ~2 years larger than labeled per reviews (labeled 4Y actually fits 6-year-old).
8. **Polo 11362** — Embroidery is primary technique for polos (logo on chest). DTG generally not used on pique polo fabric.
9. **Zip Hoodie 01714** — DTG and embroidery; check which placements are available on the product page.
10. **No AOP option** — SOL'S blanks are not offered in Printful's all-over print catalog.

---

## 3. Beechfield Hats

### Overview

Beechfield is a UK-based headwear brand ("Original Headwear Designed to Decorate") with a strong EU distribution network. Beechfield blanks are manufactured in various countries (China, Bangladesh) but the brand is specifically designed and marketed for embroidery and print decoration. On Printful, all Beechfield products use **embroidery** (standard or unlimited color). EU fulfillment from Latvia confirmed.

### Products Available

#### Confirmed on Printful:

| Product Name | Beechfield Model | Printful Cat. ID | Type | Base Price (USD) |
|---|---|---|---|---|
| Pastel Baseball Hat | B653 | 481 | Dad hat / low profile | $16.95 |
| Vintage Dad Hat | B655 | — | Dad hat / vintage wash | $22.50 est. |
| Corduroy Hat | B682 | 532 | Dad hat / corduroy | $16.25 |
| Organic Ribbed Beanie | B50 | 449 | Beanie | $17.95 |

> Retail prices from demo store: B653 retails $25.50, B682 retails $24.00, B50 retails $25.50, B655 retails $34.00.

**Additional Beechfield products potentially available (found via web search but not confirmed on Printful):**
- B45 / B45N Original Cuffed Beanie (organic cotton)
- B686 Reversible Bucket Hat
- B688 Vintage Bucket Hat
- B84R Recycled Polyester Bucket Hat

Search Printful's embroidered bucket hats and beanies catalog to confirm current availability.

### Colors Available (Confirmed per Model)

**B653 Pastel Baseball Hat (Cat. 481):**
- Pastel Blue, Pastel Pink, Pastel Lemon, Pastel Mint (4 colors)

**B655 Vintage Dad Hat:**
- Vintage Black, Vintage Denim, Vintage Light Denim (sold out), Vintage Stone (4 colors, 1 currently OOS)

**B682 Corduroy Hat (Cat. 532):**
- Camel, Dark Olive, Oxford Navy, Black (4 colors)

**B50 Organic Ribbed Beanie (Cat. 449):**
- Black, Oxford Navy, Olive Green, Sand (4 colors)

### Construction & Materials

| Model | Material | Construction | Weight |
|---|---|---|---|
| B653 | 100% chino cotton | 6-panel, low profile, unstructured, pre-curved peak, tri-glide buckle | 75g |
| B655 | 100% brushed washed cotton | 6-panel, low profile, unstructured, vintage wash, pre-curved peak, brass-effect buckle | 79g |
| B682 | 100% cotton corduroy | Soft unstructured crown, cotton twill sweatband, adjustable buckle | 80g |
| B50 | 100% organic cotton | Double layer knit, cuffed beanie, 21 cm length | — |

All blanks sourced from China (B653, B682 confirmed).

### EU Fulfillment

- Beechfield hat embroidery fulfilled from Printful EU facilities
- Latvia confirmed for B653 (customer review: "ships from Latvia")
- B50 beanie: EU fulfillment expected based on Printful's general hat embroidery routing
- Standard production: 2–5 business days

### Print / Decoration Techniques

All Beechfield products on Printful use **embroidery only**.

| Technique | Notes |
|---|---|
| Standard Embroidery | Up to 6 colors per design from 15 available thread colors |
| Unlimited Color Embroidery | Available on select Beechfield models (check per product); +$3.50/€3.25 |
| DTG / DTFilm / AOP | NOT available on Beechfield hats |

### Print / Embroidery Area Dimensions

Same dimensional standards as Otto Cap (see Section 1). Key dimensions for these models:

**B653 (low profile dad hat):** Front area approximately 4″–5.5″ × 1.75″–2″ depending on panel width.
**B655 (low profile dad hat):** Same approximate range as B653.
**B682 (corduroy, unstructured):** Corduroy fabric limits maximum design complexity; smaller designs recommended (embroidery on corduroy can look less defined than on twill). Target 3–4″ wide × 1.5″ tall for best results.
**B50 (beanie):** Front embroidery approximately 5″ × 1.75″; stretchy fabric requires conservative stitch count.

One reviewer noted B682's embroidery area is "too small to make good sized designs" — this confirms the smaller canvas of the corduroy/unstructured construction.

File requirements are identical to Otto Cap embroidery (see Section 1).

### Pricing

| Model | Base Price (USD) | Demo Store Retail | Est. EUR Base |
|---|---|---|---|
| B682 Corduroy Hat | $16.25 | $24.00 | ~€15 |
| B653 Pastel Baseball Hat | $16.95 | $25.50 | ~€15.50 |
| B50 Organic Ribbed Beanie | $17.95 | $25.50 | ~€16.50 |
| B655 Vintage Dad Hat | ~$22.50 est. | $34.00 | ~€21 |

Unlimited color embroidery adds +$3.50 / €3.25.

### Notes & Limitations

1. **B653 pastel colors** — Niche colorway. Excellent for pastel/aesthetic branding. All 4 colors are soft-toned. No neutral/black option on this model — B655 or B682 cover neutral palette.
2. **B655 Vintage Dad Hat** — Most premium-looking option ($34 retail). Vintage Light Denim was sold out at time of research; check current availability. The worn-in aesthetic differentiates from standard dad hats.
3. **B682 Corduroy** — Unique texture, visually distinctive. Oxford Navy and Black are the most commercially versatile. Embroidery design must be kept simple due to corduroy texture absorbing detail.
4. **B50 Organic Beanie** — Only 4 colors (vs. Beechfield's full B50N range of 9+ colors). May be limited vs. Otto Cap 82-480 (acrylic) which may offer more colorways on Printful. B50 is organic cotton — better eco story.
5. **Blank origin is China** despite Beechfield being a UK brand. Embroidery decoration applied in EU. GPSR manufacturer field should list Beechfield's contact; EU responsible person is Printful.
6. **GPSR compliance:** Manufacturer — Beechfield (UK). EU Responsible Person for GPSR purposes — typically Printful as the EU-based fulfillment entity. Material (cotton), care instructions required.
7. **B50 sizing runs small** — Multiple reviews note it cannot be worn by people with larger head sizes. The relaxed circumference is 38 cm; stretched max 50 cm.
8. **Demo store shows limited colorways** — The full production catalog at Printful may offer more color options per model than what's shown in the demo store. Always check the Printful design tool for the live palette.
9. **Bucket hats (B686, B688, B84R)** — Found on third-party resellers and Beechfield's direct site but NOT confirmed on Printful at time of research. May require direct inquiry to Printful or catalog API check.

---

## API Investigation Notes

### Printful Public Catalog API (v2)

Base URL: `https://api.printful.com/v2`

Key endpoints for further programmatic investigation:

```
GET /v2/catalog-products                        # List all products in catalog
GET /v2/catalog-products/{id}                   # Get single product details
GET /v2/catalog-products/{id}/catalog-variants  # All variants (colors, sizes) with IDs
GET /v2/catalog-variants/{id}                   # Single variant: price, technique, dimensions
GET /v2/catalog-products/{id}/sizes             # Size guide for a product
```

Catalog IDs confirmed in this research (usable in API calls):

| Product | Printful Catalog ID |
|---|---|
| Otto Cap 18-1248 Vintage Cap | 327 |
| Otto Cap 104-1018 Distressed Dad Hat | 396 |
| Otto Cap 31-069 5 Panel Mid Profile | 952 |
| Otto Cap 82-480 Knit Beanie | 81 |
| Otto Cap 154-1124 Mesh Back Snapback | 182 |
| Beechfield B653 Pastel Baseball Hat | 481 |
| Beechfield B682 Corduroy Hat | 532 |
| Beechfield B50 Organic Ribbed Beanie | 449 |
| SOL'S 03569 Organic Cotton Apron | 565 |

**To resolve missing catalog IDs** (18-204, 39-165, 125-978 for Otto Cap; B655, B45, B686 for Beechfield; all SOL'S apparel), query the Printful v2 API:

```bash
# Replace TOKEN with your PRINTFUL_API_TOKEN
curl -H "Authorization: Bearer $TOKEN" \
     -H "User-Agent: POD-AI-Store/1.0" \
     "https://api.printful.com/v2/catalog-products?limit=100&keyword=otto+cap"
```

### Printful v1 vs v2 API Notes

- **v1** (`api.printful.com/v1`) — Store operations (create products, orders, sync). Requires `X-PF-Store-Id` header.
- **v2** (`api.printful.com/v2`) — Catalog browsing, pricing, printfiles. No store header needed. Returns prices in store currency (EUR for EU stores).
- **Authentication:** Bearer token from `PRINTFUL_API_TOKEN` env var.
- **User-Agent required:** `User-Agent: POD-AI-Store/1.0` — without it, Cloudflare returns 401/403.

### Printful Embroidery Technique API Field

When checking if a product supports embroidery via the catalog API, look for the `technique` field in variant data:
- `"technique": "EMBROIDERY"` — standard
- `"technique": "EMBROIDERY_UNLIMITED_COLORS"` — unlimited color embroidery

---

## Summary: SKAPARA Relevance Assessment

| Brand | Technique | EU Fulfillment | Eco Story | Price Range (Base) | Recommendation |
|---|---|---|---|---|---|
| **Otto Cap** | Embroidery only | Latvia / Spain | None (China blanks) | $11–$20 | Good for affordable structured caps, mesh snapbacks, beanies |
| **SOLS** | DTG + Embroidery + DTFlex | Latvia / Spain | Strong (organic/recycled, French brand) | $16–$41 | Excellent for eco-positioning; sweatshirts/hoodies competitive with other EU brands |
| **Beechfield** | Embroidery only | Latvia / Spain | B50 organic cotton | $16–$23 | Best for distinctive aesthetics: pastel (B653), vintage (B655), corduroy (B682) |

**Priority for SKAPARA catalog expansion:**
1. **Beechfield B653 (Cat. 481)** — Pastel colorways unique in EU POD headwear; low risk, 4 colors, embroidery-ready
2. **Beechfield B682 (Cat. 532)** — Corduroy texture differentiates from twill; keep designs simple
3. **SOLS 03574 (Organic Sweatshirt)** — Eco story, DTG+embroidery, $25 base is competitive vs. P26 offerings
4. **SOLS 03569 Apron (Cat. 565)** — Niche but low competition; embroidery only; good for gifting/kitchen branding
5. **Otto Cap 18-1248 (Cat. 327)** or **104-1018 (Cat. 396)** — If adding a second hat style alongside existing P410 caps

---

## Sources

- [Otto Cap brand page — Printful](https://www.printful.com/custom/brands/otto-cap)
- [Vintage Cap Otto Cap 18-1248 — Printful](https://www.printful.com/custom/embroidered/dad-hats/vintage-cap-otto-cap-18-1248)
- [Snapback Otto Cap 125-978 — Printful](https://www.printful.com/custom/embroidered/snapbacks/snapback-otto-cap-125-978)
- [Denim Hat Otto Cap 18-204 — Printful](https://www.printful.com/custom/embroidered/dad-hats/denim-hat-otto-cap-18-204)
- [Foam Trucker Hat Otto Cap 39-165 — Printful](https://www.printful.com/custom/embroidered/trucker-hats/foam-trucker-hat-otto-cap-39-165)
- [5 Panel Mid Profile Otto Cap 31-069 — Printful](https://www.printful.com/custom/embroidered/dad-hats/5-panel-mid-profile-baseball-cap-otto-cap-31-069)
- [Distressed Dad Hat Otto Cap 104-1018 — Printful](https://www.printful.com/custom/embroidered/hats/distressed-dad-hat-otto-cap-104-1018)
- [Knit Beanie Otto Cap 82-480 — Printful](https://www.printful.com/custom/embroidered/beanies/knit-beanie-otto-cap-82-480)
- [Mesh Back Snapback Otto Cap 154-1124 — Printful](https://www.printful.com/custom/embroidered/snapbacks/mesh-back-snapback-otto-cap-154-1124)
- [SOL'S brand page — Printful](https://www.printful.com/custom/brands/sols)
- [Custom SOL'S Products — Printful](https://www.printful.com/custom-sols-products)
- [Unisex Eco Raglan Hoodie SOL'S 03568 — Printful](https://www.printful.com/custom/mens/hoodies/unisex-eco-raglan-hoodie-sols-03568)
- [Unisex Organic Raglan Sweatshirt SOL'S 03567 — Printful](https://www.printful.com/custom/mens/sweatshirts/unisex-organic-raglan-sweatshirt-sols-03567)
- [Unisex Organic Sweatshirt SOL'S 03574 — Printful](https://www.printful.com/custom/mens/sweatshirts/unisex-organic-sweatshirt-sols-03574)
- [Women's Basic Organic T-Shirt SOL'S 02077 — Printful](https://www.printful.com/custom/womens/t-shirts/womens-basic-organic-t-shirt-sols-02077)
- [Unisex Sports Jersey SOL'S 11939 — Printful](https://www.printful.com/custom/mens/t-shirts/unisex-sports-jersey-sols-11939)
- [Unisex Premium Pique Polo SOL'S 11362 — Printful](https://www.printful.com/custom/mens/polo-shirts/unisex-premium-pique-polo-shirt-sols-11362)
- [Kids Eco Hoodie SOL'S 03576 — Printful](https://www.printful.com/custom/kids-teen/hoodies/kids-eco-hoodie-sols-03576)
- [Organic Cotton Apron SOL'S 03569 — Printful](https://www.printful.com/custom/collections/embroidery/organic-cotton-apron-sols-03569)
- [Beechfield brand page — Printful](https://www.printful.com/custom/brands/beechfield-hats)
- [Corduroy Hat Beechfield B682 — Printful](https://www.printful.com/custom/embroidered/dad-hats/corduroy-hat-beechfield-b682)
- [Pastel Baseball Hat Beechfield B653 — Printful](https://www.printful.com/custom/embroidered/dad-hats/pastel-baseball-hat-beechfield-b653)
- [Vintage Dad Hat Beechfield B655 — Printful](https://www.printful.com/custom/embroidered/hats/vintage-dad-hat-beechfield-b655)
- [Organic Ribbed Beanie Beechfield B50 — Printful](https://www.printful.com/custom/embroidered/beanies/organic-ribbed-beanie-beechfield-b50)
- [Printful Demo Store — Hats Collection](https://printful-demo-store.myshopify.com/collections/hats)
- [Hat Logo Size Guide — Printful Blog](https://www.printful.com/blog/custom-embroidered-hats-guide-to-creating-a-design-and-embroidery-file)
- [Unlimited Color Embroidery — Printful](https://www.printful.com/unlimited-color-embroidery)
- [Print on Demand Europe — Printful](https://www.printful.com/print-on-demand-europe)
- [Printful API Documentation](https://developers.printful.com/docs/)
- [Embroidery Guidelines — Cre8iveSkill](https://www.cre8iveskill.com/blog/how-to-design-graphics-as-per-printful-embroidery-guidelines)
- [New Larger Hat Embroidery Area — Printful Help Center](https://help.printful.com/hc/en-us/articles/10345468617756-Does-the-new-larger-embroidery-area-of-the-hat-front-panel-change-anything-for-me)
- [DTG Print Placement Standard Update — Printful Help Center](https://help.printful.com/hc/en-us/articles/18532732956828-What-should-I-know-about-the-new-standard-print-placement-for-select-DTG-products)
