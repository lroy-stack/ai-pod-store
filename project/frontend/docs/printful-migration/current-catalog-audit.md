# SKAPARA Current Product Catalog Audit

> **Generated**: 2026-03-02
> **Source**: Supabase production database (direct REST API queries)
> **Purpose**: Baseline audit for Printify-to-Printful migration planning

---

## 1. Product Count Summary

| Status   | Count |
|----------|-------|
| Active   | 79    |
| Deleted  | 38    |
| **Total** | **117** |

- No draft products exist. All products are either `active` or `deleted`.
- 0 active products are missing variants.
- 0 active products are missing `product_details` or GPSR `safety_information`.

---

## 2. Category Tree & Product Distribution

### Active Categories with Products

| Category (Parent > Child) | Products | Price Range (EUR) |
|---------------------------|----------|-------------------|
| T-Shirts (top-level) | 20 | 24.99 -- 37.99 |
| Hoodies & Sweatshirts > Pullover Hoodies | 10 | 44.99 -- 67.99 |
| Hoodies & Sweatshirts > Crewneck Sweatshirts | 6 | 33.99 -- 50.99 |
| Drinkware > Mugs | 5 | 16.99 |
| Drinkware (top-level, tumblers/bottles misc) | 4 | 19.99 -- 29.99 |
| Accessories > Tote Bags | 4 | 31.99 |
| Headwear > Caps | 4 | 26.99 -- 32.99 |
| Long Sleeves (top-level) | 3 | 29.99 -- 44.99 |
| Kids > Kids T-Shirts | 3 | 22.99 |
| Headwear > Bucket Hats | 3 | 29.99 |
| Home Decor (stickers) | 2 | 12.99 |
| Kids > Kids Sweatshirts | 2 | 32.99 -- 34.99 |
| Kids > Baby Clothing | 2 | 17.99 -- 19.99 |
| Shoes > Sneakers | 2 | 29.99 -- 54.99 |
| Drinkware > Tumblers | 2 | 27.99 -- 30.99 |
| Drinkware > Bottles | 2 | 36.99 -- 39.99 |
| Headwear > Snapbacks | 1 | 27.99 |
| Headwear > Dad Hats | 1 | 25.99 |
| Headwear > Beanies | 1 | 24.99 |
| Accessories > Desk Mats | 1 | 34.99 |
| Hoodies & Sweatshirts > Zip-Up Hoodies | 1 | 56.99 |

**Total active products across categories: 79**

### Full Category Tree (all categories in DB)

```
T-Shirts (slug: t-shirts) [ACTIVE] -- 20 products
Clothing (slug: apparel) [ACTIVE]
  |-- Hoodies (slug: hoodies) [INACTIVE]
  |-- Sweatshirts (slug: sweatshirts) [INACTIVE]
  |-- Tank Tops (slug: tank-tops) [ACTIVE] -- 0 products
  |-- Outerwear (slug: outerwear) [INACTIVE]
  |-- Bottoms (slug: bottoms) [INACTIVE]
Hoodies & Sweatshirts (slug: hoodies-sweatshirts) [ACTIVE]
  |-- Pullover Hoodies (slug: pullover-hoodies) [ACTIVE] -- 10 products
  |-- Zip-Up Hoodies (slug: zip-hoodies) [ACTIVE] -- 1 product
  |-- Crewneck Sweatshirts (slug: crewnecks) [ACTIVE] -- 6 products
Long Sleeves (slug: long-sleeves) [ACTIVE] -- 3 products
Headwear (slug: headwear) [ACTIVE]
  |-- Caps (slug: caps) [ACTIVE] -- 4 products
  |-- Snapbacks (slug: snapbacks) [ACTIVE] -- 1 product
  |-- Dad Hats (slug: dad-hats) [ACTIVE] -- 1 product
  |-- 5-Panel Caps (slug: 5-panel-caps) [ACTIVE] -- 0 products
  |-- Beanies (slug: beanies) [ACTIVE] -- 1 product
  |-- Bucket Hats (slug: bucket-hats) [ACTIVE] -- 3 products
Drinkware (slug: drinkware) [ACTIVE]
  |-- Mugs (slug: mugs) [ACTIVE] -- 5 products
  |-- Bottles (slug: bottles) [ACTIVE] -- 2 products
  |-- Tumblers (slug: tumblers) [ACTIVE] -- 2 products
  |-- Bottles & Tumblers (slug: bottles-tumblers) [INACTIVE]
  |-- Glassware (slug: glassware) [INACTIVE]
Accessories (slug: accessories) [ACTIVE]
  |-- Bags (slug: bags) [INACTIVE]
  |-- Hats (slug: hats) [INACTIVE] (legacy)
  |-- Phone Cases (slug: phone-cases) [ACTIVE] -- 0 products
  |-- Stickers (slug: stickers) [ACTIVE] -- 0 products
  |-- Socks (slug: socks) [ACTIVE] -- 0 products
  |-- Mouse Pads (slug: mouse-pads) [ACTIVE] -- 0 products
  |-- Tech Accessories (slug: tech-accessories) [INACTIVE]
  |-- Desk Mats (slug: desk-mats) [ACTIVE] -- 1 product
  |-- Laptop Sleeves (slug: laptop-sleeves) [ACTIVE] -- 0 products
  |-- Tote Bags (slug: tote-bags) [ACTIVE] -- 4 products
Home Decor (slug: home-decor) [INACTIVE] -- 2 products (stickers miscategorized)
  |-- Posters [INACTIVE]
  |-- Wall Art [INACTIVE]
  |-- Canvas [INACTIVE]
  |-- Blankets [INACTIVE]
  |-- Pillows [INACTIVE]
  |-- Rugs & Mats [INACTIVE]
Sportswear [INACTIVE]
  |-- Activewear [INACTIVE]
  |-- Swimwear [INACTIVE]
Kitchen [INACTIVE]
  |-- Kitchen Towels [INACTIVE]
Kids (slug: kids) [ACTIVE]
  |-- Kids T-Shirts [ACTIVE] -- 3 products
  |-- Kids Sweatshirts [ACTIVE] -- 2 products
  |-- Baby Clothing [ACTIVE] -- 2 products
Games [INACTIVE]
  |-- Puzzles [INACTIVE]
Shoes (slug: shoes) [ACTIVE]
  |-- Sneakers [ACTIVE] -- 2 products
Stationery [INACTIVE]
  |-- Journals [INACTIVE]
  |-- Notebooks [INACTIVE]
  |-- Postcards [INACTIVE]
```

### Category Issues Found

1. **Home Decor is INACTIVE but has 2 active products** (404 Purpose, NOPE -- stickers categorized under Home Decor instead of Accessories > Stickers)
2. **Drinkware top-level has 4 products** that should probably be in subcategories (Mugs or Tumblers)
3. **Several active categories have 0 products**: Tank Tops, 5-Panel Caps, Phone Cases, Stickers, Socks, Mouse Pads, Laptop Sleeves
4. **Legacy "Hats" category** under Accessories is inactive (replaced by top-level Headwear tree)

---

## 3. Blueprint-to-Product Type Mapping

This is the critical mapping for migration. Each Printify blueprint_id corresponds to a specific product type and blank.

### Active Blueprints (used by active products)

| Blueprint ID | Product Type | Blank/Model | Provider | Products |
|-------------|-------------|-------------|----------|----------|
| BP6 | Unisex Heavy Cotton Tee | Gildan 5000 | P26 (Textildruck Europa, DE) | 16 |
| BP12 | Unisex Softstyle T-Shirt | Gildan 64000 | P26 | 1 |
| BP49 | Unisex Heavy Blend Crewneck | Gildan 18000 | P26 | 4 |
| BP65 | Kids Organic Sweatshirt | Stanley/Stella | P26 | 1 |
| BP67 | Baby/Toddler Organic Sweatshirt | Stanley/Stella | P26 | 1 |
| BP77 | Unisex Heavy Blend Hoodie | Gildan 18500 | P26 | 5 |
| BP80 | Unisex Ultra Cotton Long Sleeve | Gildan 2400 | P26 | 3 |
| BP81 | Kids Heavy Cotton Tee | Gildan 5000B | P26 | 2 |
| BP145 | Unisex Long Sleeve Tee | Gildan 2400 variant | P26 | 1 |
| BP157 | Kids Tee | B&C | P26 | 1 |
| BP454 | Unisex T-Shirt | B&C E190 | P26 | 1 |
| BP455 | Zip-Up Hoodie | B&C WM647 | P26 | 1 |
| BP457 | Unisex Crewneck Sweatshirt | B&C WU600 | P26 | 2 |
| BP620 | Insulated Water Bottle (12oz) | Generic | P86 (T-Shirt and Sons, PL) | 2 |
| BP633 | Travel Mug (16oz) | Generic | P86 | 2 |
| BP731 | Organic Tote Bag | EarthAware | P26 | 4 |
| BP767 | Low Top Sneaker | Generic | P90 (Printy6, CZ) | 1 |
| BP793 | Premium Embroidered Hoodie | Cotton Heritage M2580 | P410 (Printful, LV) | 5 |
| BP854 | Insulated Bottle (12/18/32oz) | Generic | P23 (Art Gun, EU) | 2 |
| BP966 | Insulated Tumbler (20oz) | Generic | P86 | 1 |
| BP969 | Desk Mat | Generic | P90 | 1 |
| BP1018 | Ceramic Mug (11oz) | Generic | P26 | 5 |
| BP1025 | Baby Bodysuit (Organic) | Stanley/Stella | P26 | 1 |
| BP1045 | Baby Bodysuit (Organic, alt) | Stanley/Stella | P26 | 1 |
| BP1462 | Unisex T-Shirt (Organic) | Stanley/Stella Creator | P26 | 1 |
| BP1523 | Sticker (Round/Square) | Generic | P23 | 2 |
| BP1534 | Kids Clogs | Generic | P90 | 1 |
| BP1691 | Beanie (Cuffed) | Generic | P410 | 1 |
| BP1729 | Dad Hat (Unstructured) | Generic | P410 | 1 |
| BP1743 | Snapback (Flat Brim) | Generic | P410 | 1 |
| BP1744 | Trucker Cap | Generic | P410 | 4 |
| BP1910 | Bucket Hat (Embroidered) | Generic | P410 | 3 |
| BP1927 | Insulated Tumbler (20oz, alt) | Generic | P410 | 1 |

**Total unique blueprints in active catalog: 33**

### Deleted Blueprints (no longer in active catalog)

| Blueprint ID | Product Type | Was Provider | Reason for Deletion |
|-------------|-------------|-------------|---------------------|
| BP5 | T-Shirt | P99 (non-EU) | E2E test product |
| BP353 | Tumbler | P1 (non-EU) | Non-EU provider |
| BP482 | Bottle | P28 (non-EU) | Non-EU provider |
| BP693 | Tumbler | P75 (non-EU) | Non-EU provider |
| BP794 | Sticker | P73 (non-EU) | Non-EU provider |
| BP879 | Long Sleeve (Premium) | P217 (non-EU) | Non-EU provider |
| BP1108 | Hat | P99 (non-EU) | Non-EU provider |
| BP1446 | Hat | P217 (non-EU) | Non-EU provider |
| BP1447 | Hat | P217 (non-EU) | Non-EU provider |

---

## 4. Print Provider Mapping

### EU-Approved Providers (from `store-config.ts`)

Code reference: `EU_APPROVED_PROVIDERS = new Set([26, 410, 90, 23, 30, 255, 86])`

| Provider ID | Name | Location | Active Products | Print Techniques |
|-------------|------|----------|-----------------|------------------|
| P26 | Textildruck Europa | Germany (DE) | 51 | DTG |
| P410 | Printful | Latvia (LV) | 16 | Embroidery, Sublimation, DTG |
| P90 | Printy6 | Czech Republic (CZ) | 3 | Sublimation, UV |
| P86 | T-Shirt and Sons | Poland (PL) | 5 | Sublimation, Dye-sub |
| P23 | Art Gun | EU | 4 | UV printing, Sublimation |
| P30 | (not used) | -- | 0 | -- |
| P255 | (not used) | -- | 0 | -- |

### Non-EU Providers (all deleted products)

| Provider ID | Active Products | Deleted Products |
|-------------|-----------------|------------------|
| P99 | 0 | 12 |
| P217 | 0 | 10 |
| P103 | 0 | 7 |
| P73 | 0 | 1 |
| P75 | 0 | 1 |
| P1 | 0 | 1 |
| P28 | 0 | 1 |
| P34 | 0 | 1 |

**All active products use EU-approved providers. Non-EU providers exist only in deleted products.**

---

## 5. Variant Structure

### Overall Variant Statistics

| Metric | Value |
|--------|-------|
| Total variants | 1,435 |
| Products with variants | All 79 active |
| Average variants per product | ~18.2 |
| Min variants per product | 1 |
| Max variants per product | 29+ |
| Enabled variants | 1,435 (100%) |
| Disabled variants | 0 |
| Variants with image_url | 1,432 (99.8%) |
| Variants missing image_url | 3 |
| Price range | EUR 12.99 -- EUR 59.99 |

### Variant Structure Per Product Type

| Blueprint | Product Type | Colors | Sizes | Variants/Product |
|-----------|-------------|--------|-------|------------------|
| BP6 (Tee) | Heavy Cotton Tee | 12 (Black, White, Navy, Dark Heather, Charcoal, Maroon, Ash, Sport Grey, Forest Green, Military Green, Dark Chocolate, Natural) | 8 (S-5XL) | ~34 |
| BP12 (Tee) | Softstyle T-Shirt | 5 (Black, Dark Grey, Dark Grey Heather, Heather Navy, Heather Olive) | 8 (XS-4XL) | 32 |
| BP49 (Crewneck) | Heavy Blend Crewneck | 6 (Black, Dark Heather, Forest Green, Maroon, Military Green, Navy) | 8 (S-5XL) | ~31 |
| BP77 (Hoodie) | Heavy Blend Hoodie | 7 (Black, Dark Chocolate, Dark Heather, Forest Green, Maroon, Military Green, Navy) | 8 (S-5XL) | ~37 |
| BP80 (Long Sleeve) | Ultra Cotton LS | 2 (Black, Navy) | 5 (S-2XL) | 10 |
| BP793 (Emb Hoodie) | Premium Emb Hoodie | 4 (Black, Bone, Maroon, White) | 6 (S-3XL) | ~6 |
| BP1018 (Mug) | Ceramic Mug 11oz | 11 colors | 1 size (11oz) | 11 |
| BP1744 (Cap) | Trucker Cap | 14 color combos | 3 (S/M, L/XL, One size) | ~9 |
| BP731 (Tote) | Organic Tote Bag | 3 (Black, Classic Red, French Navy) | 1 (15"x16.5") | 3 |
| BP767 (Sneaker) | Low Top Sneaker | 2 (Black sole, White sole) | 11 (EU 38-48.5) | 22 |
| BP1910 (Bucket Hat) | Bucket Hat | 3 (Black, Navy, White) | 1 (One size) | 3 |

### Top 15 Colors Across All Variants

| Color | Variant Count |
|-------|--------------|
| Black | 250+ |
| Navy | 150+ |
| White | 80+ |
| Dark Heather | 70+ |
| Charcoal | 50+ |
| Maroon | 45+ |
| Dark Grey | 30+ |
| Bone | 25+ |
| Anthracite | 20+ |
| French Navy | 18+ |
| Sport Grey | 15+ |
| Forest Green | 15+ |
| Military Green | 15+ |
| Ash | 10+ |
| Dark Chocolate | 10+ |

### Size Distribution

| Size | Variant Count | Notes |
|------|--------------|-------|
| L | 66+ | Most common adult size |
| M | 61+ | |
| S | 61+ | |
| XL | 59+ | |
| 2XL | 54+ | |
| 3XL | 36+ | |
| XS | 24+ | |
| One size | 23+ | Hats, beanies |
| 4XL | 18+ | |
| 5XL | 12+ | |
| 11oz | 11 | Mugs only |
| S/M, L/XL | 20 | Caps only |
| Baby sizes (NB-24M) | 17 | Baby clothing |
| EU shoe sizes (38-48.5) | 22 | Sneakers |
| Kids shoes (US 6.5-13.5) | 12 | Clogs |

### Image URL Coverage Issue

**1 product has variants missing image_url:**
- SKAPARA Grip (desk mat): 0/4 variants have image_url

This means the color toggle feature in ProductCard will not work for this product.

---

## 6. Pricing Analysis

### Price Ranges by Product Category

| Category | Min (EUR) | Max (EUR) | Average (EUR) |
|----------|-----------|-----------|---------------|
| Stickers | 12.99 | 12.99 | 12.99 |
| Mugs (11oz) | 16.99 | 16.99 | 16.99 |
| Baby Clothing | 17.99 | 19.99 | 18.99 |
| Travel Mugs/Insulated | 19.99 | 29.99 | 24.99 |
| Kids T-Shirts | 22.99 | 22.99 | 22.99 |
| T-Shirts | 24.99 | 37.99 | 29.49 |
| Beanies | 24.99 | 24.99 | 24.99 |
| Dad Hats | 25.99 | 25.99 | 25.99 |
| Caps | 26.99 | 32.99 | 29.49 |
| Snapbacks | 27.99 | 27.99 | 27.99 |
| Tumblers | 27.99 | 30.99 | 29.49 |
| Long Sleeves | 29.99 | 44.99 | 39.99 |
| Kids Clogs | 29.99 | 29.99 | 29.99 |
| Bucket Hats | 29.99 | 29.99 | 29.99 |
| Tote Bags | 31.99 | 31.99 | 31.99 |
| Kids Sweatshirts | 32.99 | 34.99 | 33.99 |
| Crewneck Sweatshirts | 33.99 | 50.99 | 44.49 |
| Desk Mats | 34.99 | 34.99 | 34.99 |
| Bottles | 36.99 | 39.99 | 38.49 |
| Pullover Hoodies (DTG) | 49.99 | 60.99 | 55.99 |
| Pullover Hoodies (Emb) | 44.99 | 67.99 | 54.39 |
| Sneakers (Adult) | 54.99 | 54.99 | 54.99 |
| Zip-Up Hoodies | 56.99 | 56.99 | 56.99 |

### Price Point Distribution

| Price Range (EUR) | Product Count |
|-------------------|---------------|
| 10.00 -- 19.99 | 11 |
| 20.00 -- 29.99 | 32 |
| 30.00 -- 39.99 | 19 |
| 40.00 -- 49.99 | 7 |
| 50.00 -- 59.99 | 7 |
| 60.00 -- 69.99 | 3 |

**Median price: ~29.99 EUR**
**Most common price point: 24.99 EUR (13 products)**

---

## 7. GPSR & Product Details Structure

### Coverage (79 active products)

| Field | Coverage | Percentage |
|-------|----------|------------|
| brand | 79/79 | 100% |
| material | 79/79 | 100% |
| print_technique | 79/79 | 100% |
| safety_information | 79/79 | 100% |
| manufacturing_country | 79/79 | 100% |
| model | 62/79 | 78% |
| care_instructions | 47/79 | 59% |
| provider_name | 32/79 | 41% |
| provider | 17/79 | 22% |

**GPSR compliance: 100% -- all active products have safety_information**

### Brand Field Values

| Brand | Count | Notes |
|-------|-------|-------|
| SKAPARA | 47 | Own brand label |
| Generic brand | 9 | Needs standardization |
| Gildan | 6 | Blank manufacturer |
| Cotton Heritage | 5 | BP793 blanks |
| B&C | 3 | European blanks |
| Flexfit | 2 | Cap blanks |
| OTTO Cap | 2 | Cap blanks |
| Generic | 2 | Needs standardization |
| Yupoong | 1 | Cap blank |
| Richardson | 1 | Cap blank |
| Big Accessories | 1 | Bucket hat blank |

**Issue**: 11 products use "Generic brand" or "Generic" instead of "SKAPARA". These should be standardized.

### Manufacturing Country Values

| Country | Count | Notes |
|---------|-------|-------|
| Germany | 39 | Full name |
| LV | 15 | ISO code (Latvia) |
| DE | 12 | ISO code (Germany) |
| EU | 11 | Generic, not specific |
| Latvia | 1 | Full name |
| US | 1 | Should be EU only? |

**Issue**: Inconsistent country format -- mix of full names (Germany), ISO codes (DE, LV), and generic (EU). Should standardize to ISO 3166-1 alpha-2 codes.

**Issue**: 1 product lists "US" as manufacturing country. This needs investigation.

### Print Technique Values

| Technique | Count |
|-----------|-------|
| DTG | 31 |
| DTG (Direct-to-Garment) | 16 |
| Sublimation | 12 |
| Embroidery | 10 |
| DTG -- water-based eco-friendly inks | 4 |
| Dye-sublimation on ceramic | 2 |
| UV printing -- scratch and dishwasher resistant | 2 |
| Dye-sublimation -- full wrap | 2 |

**Issue**: DTG is listed 3 different ways. Should standardize to one format.

### Sample GPSR safety_information Content

Products contain HTML-formatted GPSR blocks with:
- EU representative: HONSON VENTURES LIMITED (Printful products)
- Manufacturer: Textildruck Europa GmbH (P26 products)
- Material composition
- EU Regulation 2023/988 compliance statement
- Contact information

---

## 8. Design Asset Inventory

### Files on Disk

| Directory | File Count | Formats | Total Size | Purpose |
|-----------|-----------|---------|------------|---------|
| `/public/meme-designs/` | 10 PNGs | PNG | ~1.6 MB | Original meme T-shirt designs (01-10) |
| `/public/meme-previews/` | 12 files (6 designs + 6 previews) | PNG | ~1.8 MB | Meme designs 11-16 with preview thumbnails |
| `/public/branded-previews/` | 18 files (9 designs + 9 previews) | PNG | ~1.3 MB | Branded product designs (mug, bottle, crewneck, LS, desk mat, sneaker, sticker) |
| `/public/brand-designs/` | 8 files | PNG + SVG | ~270 KB | Branding assets (hoodie, bottle, tumbler variants, packaging insert, gift card) |
| `/public/hat-designs/` | 4 PNGs | PNG | ~160 KB | Embroidery designs for headwear |
| `/public/kids-designs/` | 21 files (8 SVGs + 8 PNGs + 5 branding PNGs) | SVG + PNG | ~3.8 MB | Kids clothing designs (01-08) + back branding assets |
| `/public/fleece-designs/` | 5 PNGs | PNG | ~165 KB | Fleece/crewneck chest designs + previews |
| `/public/expansion-designs/` | 19 SVGs + subdirs | SVG | ~5.9 MB | Latest expansion designs (a01-h03) for new products |
| `/public/zip-hoodie-designs/` | 5 PNGs | PNG | ~320 KB | Zip hoodie front design + color previews |
| `/public/brand/` | 13 files | SVG + PNG | ~160 KB | Brand identity (S mark, wordmark, favicons, OG image) |

### Design Asset Details

**Brand Mark Variants** (`/public/brand/`):
- `skapara-mark-color.svg` -- Full color S mark
- `skapara-mark-dark.svg` -- Dark S mark (for light backgrounds)
- `skapara-mark-white.svg` -- White S mark (for dark backgrounds)
- `skapara-wordmark-dark.svg` -- Dark wordmark
- `skapara-wordmark-white.svg` -- White wordmark (added 2026-03-01)
- `skapara-lockup-white.svg` -- White lockup (mark + wordmark)

**Hat Designs** (`/public/hat-designs/`):
- `neon-horizon.png` -- Geometric/illustrative (NO text)
- `ocean-lines.png` -- Wave pattern
- `street-script.png` -- Script/lettering style
- `summit-moon.png` -- Mountain/moon scene

**Kids Designs** (`/public/kids-designs/`):
- 01: "Not Crying, Compiling" (baby bodysuit)
- 02: "Bug Reporter" (baby bodysuit)
- 03: "sudo ice cream" (kids tee)
- 04: "Bedtime Not Found" (kids tee)
- 05: "Ctrl+Z Homework" (kids tee)
- 06: "AI Raised Me" (kids sweatshirt)
- 07: "My Code Works" (kids sweatshirt)
- 08: "Future Prompt Engineer" (kids hoodie)

**Expansion Designs** (`/public/expansion-designs/`):
- a01: "Life is Soup, I am Fork"
- a03: "Hang In There"
- a04: "Existential Dread"
- a05: "Nihilist Penguin"
- a07: "404 Purpose Not Found"
- b01: "You're On Mute"
- b02: "My Commute Now"
- b07: "Loading Motivation"
- c01: "Social Battery"
- c02: "Plans Cancelled"
- d01: "Regulate Your Nervous System"
- d03: "Self-Care is Aggressive"
- e01: "2026 is the New 2016"
- e03: "Understood the Assignment"
- e05: "Main Character Energy"
- f02: "Caffeine & Anxiety"
- g01: "Nope"
- g04: "Do Not Read This"
- h02: "Made on Demand"
- h03: "Made Just for You"

---

## 9. Print Area Configurations

Source: `/frontend/src/lib/print-areas.ts`

### Preview Print Areas (1024x1024 canvas, pixels)

| Product Type | X | Y | Width | Height |
|-------------|---|---|-------|--------|
| tshirt | 312 | 200 | 400 | 500 |
| hoodie | 300 | 220 | 420 | 480 |
| mug | 150 | 180 | 350 | 300 |
| phone-case | 100 | 150 | 300 | 550 |
| tote-bag | 200 | 150 | 400 | 500 |
| hat | 262 | 280 | 500 | 280 |

### Production Dimensions (final print resolution, pixels)

| Product Type | Width | Height |
|-------------|-------|--------|
| tshirt | 3600 | 4800 |
| hoodie | 3000 | 3600 |
| mug | 2850 | 1050 |
| phone-case | 750 | 1500 |
| tote-bag | 3600 | 3600 |
| hat | 1650 | 750 |

### Category-to-Product Type Mapping

| Category Slug | Maps to Print Area |
|---------------|--------------------|
| apparel, t-shirts | tshirt |
| hoodies, sweatshirts | hoodie |
| mugs, drinkware, kitchen | mug |
| phone-cases | phone-case |
| bags, accessories | tote-bag |
| hats | hat |
| posters, wall-art, stickers, stationery, home-decor, kids | tshirt (fallback) |

### Missing Print Area Definitions

The following active product categories do NOT have dedicated print area definitions:
- **Long Sleeves** -- falls back to tshirt
- **Crewneck Sweatshirts** -- falls back to hoodie (via sweatshirts)
- **Zip-Up Hoodies** -- no mapping, falls back to tshirt
- **Sneakers** -- no mapping, falls back to tshirt
- **Desk Mats** -- no mapping, falls back to tshirt
- **Tumblers** -- no mapping, falls back to tshirt
- **Bottles** -- no mapping, falls back to tshirt
- **Bucket Hats** -- falls back to tshirt (hats maps to hat, but slug is "bucket-hats")
- **Beanies** -- no mapping, falls back to tshirt
- **Tote Bags** -- mapped via "bags" key but slug is "tote-bags" (mismatch)
- **Baby Clothing** -- no mapping, falls back to tshirt
- **Kids Sweatshirts** -- no mapping, falls back to tshirt

---

## 10. Complete Active Product List

### T-Shirts (20 products)

| # | Title | Blueprint | Provider | Price (EUR) |
|---|-------|-----------|----------|-------------|
| 1 | Absolutely Right | BP6 | P26 | 24.99 |
| 2 | Caffeine Anxiety | BP6 | P26 | 37.99 |
| 3 | Dangerous Flag | BP12 | P26 | 27.99 |
| 4 | Existential Dread | BP6 | P26 | 37.99 |
| 5 | Ghost Tee | BP6 | P26 | 24.99 |
| 6 | Just For You | BP6 | P26 | 37.99 |
| 7 | Next Line | BP6 | P26 | 37.99 |
| 8 | Option Two | BP454 | P26 | 26.99 |
| 9 | Plans Cancelled | BP6 | P26 | 37.99 |
| 10 | Prism Tee | BP6 | P26 | 26.99 |
| 11 | Scope Creep | BP6 | P26 | 24.99 |
| 12 | Self-Care Mode | BP6 | P26 | 37.99 |
| 13 | Shadow Tee | BP6 | P26 | 24.99 |
| 14 | Social Battery | BP6 | P26 | 37.99 |
| 15 | Soup Fork | BP6 | P26 | 37.99 |
| 16 | Strawberry Count | BP6 | P26 | 24.99 |
| 17 | Three Models | BP1462 | P26 | 29.99 |
| 18 | Under Where | BP145 | P26 | 24.99 |
| 19 | Vibe Coder | BP6 | P26 | 24.99 |
| 20 | Zero Bugs | BP6 | P26 | 24.99 |

### Pullover Hoodies (10 products)

| # | Title | Blueprint | Provider | Price (EUR) | Technique |
|---|-------|-----------|----------|-------------|-----------|
| 1 | Abyss Hood | BP793 | P410 | 44.99 | Embroidery |
| 2 | Hang In There | BP77 | P26 | 60.99 | DTG |
| 3 | Just One Button | BP77 | P26 | 49.99 | DTG |
| 4 | Main Character | BP77 | P26 | 60.99 | DTG |
| 5 | Nervous System | BP77 | P26 | 60.99 | DTG |
| 6 | Nope | BP77 | P26 | 60.99 | DTG |
| 7 | Origin | BP793 | P410 | 67.99 | Embroidery |
| 8 | Phantom Hood | BP793 | P410 | 44.99 | Embroidery |
| 9 | Synapse | BP793 | P410 | 67.99 | Embroidery |
| 10 | Ultra Hood | BP793 | P410 | 46.99 | Embroidery |

### Crewneck Sweatshirts (6 products)

| # | Title | Blueprint | Provider | Price (EUR) |
|---|-------|-----------|----------|-------------|
| 1 | 404 Purpose | BP49 | P26 | 50.99 |
| 2 | AI Personalities | BP49 | P26 | 44.99 |
| 3 | Bug Free | BP457 | P26 | 33.99 |
| 4 | Loading Motivation | BP49 | P26 | 50.99 |
| 5 | New 2016 | BP49 | P26 | 50.99 |
| 6 | SKAPARA Core | BP457 | P26 | 35.99 |

### Mugs (5 products)

| # | Title | Blueprint | Provider | Price (EUR) |
|---|-------|-----------|----------|-------------|
| 1 | Full Credit | BP1018 | P26 | 16.99 |
| 2 | Nihilist Penguin | BP1018 | P26 | 16.99 |
| 3 | Prompt Engineer | BP1018 | P26 | 16.99 |
| 4 | SKAPARA Noir | BP1018 | P26 | 16.99 |
| 5 | Seven Seconds | BP1018 | P26 | 16.99 |

### Drinkware -- Other (4 products at top-level category)

| # | Title | Blueprint | Provider | Price (EUR) | Actual Type |
|---|-------|-----------|----------|-------------|-------------|
| 1 | Caffeine Anxiety | BP633 | P86 | 19.99 | Travel Mug 16oz |
| 2 | Hang In There | BP620 | P86 | 29.99 | Insulated Bottle 12oz |
| 3 | Self-Care | BP620 | P86 | 29.99 | Insulated Bottle 12oz |
| 4 | Soup Fork | BP633 | P86 | 19.99 | Travel Mug 16oz |

### Tote Bags (4 products)

| # | Title | Blueprint | Provider | Price (EUR) |
|---|-------|-----------|----------|-------------|
| 1 | NOPE | BP731 | P26 | 31.99 |
| 2 | Plans Cancelled | BP731 | P26 | 31.99 |
| 3 | Social Battery | BP731 | P26 | 31.99 |
| 4 | Soup Fork | BP731 | P26 | 31.99 |

### Headwear (10 products total)

| # | Title | Subcategory | Blueprint | Provider | Price (EUR) |
|---|-------|-------------|-----------|----------|-------------|
| 1 | AI Wrote This | Caps | BP1744 | P410 | 26.99 |
| 2 | Assignment | Caps | BP1744 | P410 | 30.99 |
| 3 | Dark Mode | Caps | BP1744 | P410 | 26.99 |
| 4 | It Works | Caps | BP1744 | P410 | 32.99 |
| 5 | Flux | Bucket Hats | BP1910 | P410 | 29.99 |
| 6 | GPT | Bucket Hats | BP1910 | P410 | 29.99 |
| 7 | NPC | Bucket Hats | BP1910 | P410 | 29.99 |
| 8 | Friday Deploy | Snapbacks | BP1743 | P410 | 27.99 |
| 9 | Prompt Me | Dad Hats | BP1729 | P410 | 25.99 |
| 10 | Vibe Coded | Beanies | BP1691 | P410 | 24.99 |

### Long Sleeves (3 products)

| # | Title | Blueprint | Provider | Price (EUR) |
|---|-------|-----------|----------|-------------|
| 1 | On Demand | BP80 | P26 | 44.99 |
| 2 | On Mute | BP80 | P26 | 44.99 |
| 3 | Prompt Injection | BP80 | P26 | 29.99 |

### Kids (7 products)

| # | Title | Subcategory | Blueprint | Provider | Price (EUR) |
|---|-------|-------------|-----------|----------|-------------|
| 1 | Bedtime 404 | Kids T-Shirts | BP81 | P26 | 22.99 |
| 2 | Ctrl+Z Homework | Kids T-Shirts | BP157 | P26 | 22.99 |
| 3 | Sudo Ice Cream | Kids T-Shirts | BP81 | P26 | 22.99 |
| 4 | AI Raised Me | Kids Sweatshirts | BP67 | P26 | 34.99 |
| 5 | Code Works | Kids Sweatshirts | BP65 | P26 | 32.99 |
| 6 | Bug Reporter | Baby Clothing | BP1025 | P26 | 17.99 |
| 7 | Compiling Tears | Baby Clothing | BP1045 | P26 | 19.99 |

### Bottles & Tumblers (4 products)

| # | Title | Subcategory | Blueprint | Provider | Price (EUR) |
|---|-------|-------------|-----------|----------|-------------|
| 1 | Refactor Anyway | Bottles | BP854 | P23 | 36.99 |
| 2 | SKAPARA Signal | Bottles | BP854 | P23 | 39.99 |
| 3 | 404 Dev | Tumblers | BP1927 | P410 | 27.99 |
| 4 | Git Reset | Tumblers | BP966 | P86 | 30.99 |

### Shoes (2 products)

| # | Title | Blueprint | Provider | Price (EUR) |
|---|-------|-----------|----------|-------------|
| 1 | Prompt Engineer | BP1534 | P90 | 29.99 |
| 2 | SKAPARA Step | BP767 | P90 | 54.99 |

### Other

| # | Title | Category | Blueprint | Provider | Price (EUR) |
|---|-------|----------|-----------|----------|-------------|
| 1 | SKAPARA Grip | Desk Mats | BP969 | P90 | 34.99 |
| 2 | GPU | Zip-Up Hoodies | BP455 | P26 | 56.99 |
| 3 | 404 Purpose | Home Decor (sticker) | BP1523 | P23 | 12.99 |
| 4 | NOPE | Home Decor (sticker) | BP1523 | P23 | 12.99 |

---

## 11. Issues & Inconsistencies Found

### Data Quality Issues

1. **Inconsistent brand naming**: 11 products use "Generic brand" or "Generic" instead of "SKAPARA"
2. **Inconsistent country format**: Mix of "Germany" (39), "DE" (12), "LV" (15), "EU" (11), "Latvia" (1), "US" (1)
3. **Inconsistent print technique names**: DTG appears as 3 variants ("DTG", "DTG (Direct-to-Garment)", "DTG -- water-based eco-friendly inks")
4. **Inconsistent provider field**: Some products use `provider_name`, others use `provider` in product_details
5. **Missing care_instructions**: 32/79 products (41%) lack care instructions
6. **Missing model**: 17/79 products (22%) lack the garment model identifier

### Category Issues

7. **Stickers miscategorized**: 2 sticker products (404 Purpose, NOPE) are under "Home Decor" (which is INACTIVE) instead of "Accessories > Stickers"
8. **Drinkware products at wrong level**: 4 products sit at the top-level "Drinkware" category instead of their correct subcategories (Travel Mugs should be in Mugs or a new subcategory; Insulated Bottles should be in Bottles)
9. **Empty active categories**: Tank Tops, 5-Panel Caps, Phone Cases, Stickers, Socks, Mouse Pads, Laptop Sleeves have 0 products but are active
10. **Duplicate product names**: "NOPE" appears as both a tote bag and a sticker; "Caffeine Anxiety" appears as both a T-shirt and a travel mug; "Soup Fork" appears as a T-shirt, tote bag, and travel mug -- these are intentional design-across-product-types duplicates

### Print Area Issues

11. **Missing print area mappings**: 12+ category slugs have no dedicated print area definition and fall back to the tshirt default (sneakers, desk-mats, tumblers, bottles, zip-hoodies, beanies, bucket-hats, baby-clothing, etc.)
12. **Slug mismatch for tote bags**: Category slug is "tote-bags" but CATEGORY_TO_PRODUCT_TYPE maps "bags" -- relies on "accessories" fallback

### Variant Issues

13. **SKAPARA Grip has no variant images**: 0/4 variants have image_url, breaking color toggles
14. **BP793 limited colors**: Only 4 colors (Black, Bone, Maroon, White) vs 7+ for DTG hoodies -- expected for embroidery

### Pricing Issues

15. **Wide price variance within T-Shirts**: EUR 24.99 to EUR 37.99 for the same product type (BP6). The 37.99 group may have different cost basis or need price alignment
16. **Expansion T-Shirts are 37.99**: The latest batch (Just For You, Next Line, etc.) are priced at EUR 37.99 while OG T-shirts are EUR 24.99 -- same blueprint and provider

---

## 12. Migration Considerations

### Provider Dependency Summary

For the Printify-to-Printful migration, note that:

| Current Provider | Products | Product Types | Migration Impact |
|-----------------|----------|---------------|------------------|
| P26 (Textildruck Europa) | 51 | Tees, crewnecks, hoodies, LS, mugs, totes, kids | **HIGH** -- majority of catalog |
| P410 (Printful) | 16 | Emb hoodies, caps, bucket hats, beanies, dad hats, snapbacks, tumblers | **LOW** -- already on Printful |
| P86 (T-Shirt and Sons) | 5 | Travel mugs, insulated bottles, tumblers | **MEDIUM** -- need Printful equivalents |
| P23 (Art Gun) | 4 | Bottles, stickers | **MEDIUM** -- need Printful equivalents |
| P90 (Printy6) | 3 | Sneakers, desk mat, kids clogs | **MEDIUM** -- need Printful equivalents |

### Key Migration Data Points

- **33 unique blueprints** need Printful equivalents
- **1,435 variants** need remapping to Printful variant IDs
- **79 products** with complete GPSR data need re-publishing
- **All design assets** (PNGs/SVGs) are stored locally and reusable
- **P410 products** (16) are already Printful -- these may only need API reconfiguration
- **Print area definitions** need updating for Printful's coordinate systems

---

*End of audit. All data sourced from production Supabase database queries on 2026-03-02.*
