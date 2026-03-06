# Section 4 — Product Catalog Migration Strategy

> **Document**: Printify → Printful Migration Plan — Section 4 of N
> **Generated**: 2026-03-02
> **Baseline**: 79 active products, 1,435 variants, 33 unique blueprints
> **Source files**: `current-catalog-audit.md`, `printful-catalog-api.md`, `printful-products-api.md`, `printful-file-library-api.md`, `printify-integration-audit.md`

---

## A. Current Catalog Inventory

### A.1 Summary by Provider

| Provider | ID | Location | Active Products | Product Types | Migration Status |
|---|---|---|---|---|---|
| Textildruck Europa | P26 | Germany (DE) | 51 | Tees, hoodies, crewnecks, LS, mugs, totes, kids clothing, zip hoodie | REQUIRES MIGRATION |
| Printful | P410 | Latvia (LV) | 16 | Embroidered hoodies, caps, bucket hats, beanie, dad hat, snapback, tumbler | ALREADY PRINTFUL |
| T-Shirt and Sons | P86 | Poland (PL) | 5 | Travel mugs (16oz), insulated bottles (12oz), tumbler (20oz) | REQUIRES MIGRATION |
| Art Gun | P23 | EU | 4 | Stainless bottles (12/18/32oz), stickers | REQUIRES MIGRATION |
| Printy6 | P90 | Czech Republic (CZ) | 3 | Low-top sneakers, kids clogs, desk mat | REQUIRES MIGRATION — HIGH RISK |
| **TOTAL** | | | **79** | | |

### A.2 P410 Products (Already on Printful — 16 products)

These 16 products are already fulfilled by Printful (P410 = Printful's Printify provider ID). They are listed below with their current Printify blueprint IDs. The migration for this group does NOT require new product creation at Printful — it requires re-linking these products from Printify's API to Printful's API directly, and updating the `printify_id` / `print_provider_id` columns in the `products` table to point to Printful sync product IDs.

| Product Title | Category | Blueprint | Printful Product Type |
|---|---|---|---|
| Abyss Hood | Pullover Hoodies | BP793 | Premium Embroidered Hoodie (Cotton Heritage M2580) |
| Origin | Pullover Hoodies | BP793 | Premium Embroidered Hoodie (Cotton Heritage M2580) |
| Phantom Hood | Pullover Hoodies | BP793 | Premium Embroidered Hoodie (Cotton Heritage M2580) |
| Synapse | Pullover Hoodies | BP793 | Premium Embroidered Hoodie (Cotton Heritage M2580) |
| Ultra Hood | Pullover Hoodies | BP793 | Premium Embroidered Hoodie (Cotton Heritage M2580) |
| AI Wrote This | Caps | BP1744 | Trucker Cap |
| Assignment | Caps | BP1744 | Trucker Cap |
| Dark Mode | Caps | BP1744 | Trucker Cap |
| It Works | Caps | BP1744 | Trucker Cap |
| Flux | Bucket Hats | BP1910 | Bucket Hat (Embroidered) |
| GPT | Bucket Hats | BP1910 | Bucket Hat (Embroidered) |
| NPC | Bucket Hats | BP1910 | Bucket Hat (Embroidered) |
| Friday Deploy | Snapbacks | BP1743 | Snapback (Flat Brim) |
| Prompt Me | Dad Hats | BP1729 | Dad Hat (Unstructured) |
| Vibe Coded | Beanies | BP1691 | Beanie (Cuffed) |
| 404 Dev | Tumblers | BP1927 | Insulated Tumbler (20oz) |

**Key fact**: The 16 P410 products exist inside Printify's system only because Printify uses Printful as a print provider internally. The blank products and fulfillment already come from Printful's Latvia facility. After migration, these products will be managed directly via Printful's Products API (`POST /sync_products`) instead of through Printify's mediation layer.

### A.3 Products Requiring New Printful Equivalents (63 products)

These 63 products currently use P26, P86, P23, or P90 as providers. Each requires a verified Printful equivalent before migration can proceed.

| Provider | Products Needing Equivalents | Risk Level |
|---|---|---|
| P26 (Textildruck Europa, DE) | 51 | MEDIUM — large volume, Printful has most equivalents |
| P86 (T-Shirt and Sons, PL) | 5 | MEDIUM — drinkware category |
| P23 (Art Gun, EU) | 4 | MEDIUM — bottles + stickers |
| P90 (Printy6, CZ) | 3 | HIGH — sneakers + kids clogs + desk mat, uncertain Printful equivalents |

---

## B. Blueprint → Printful Product Mapping

This is the definitive mapping table for all 33 active Printify blueprints. Printful catalog product IDs are provisional — they must be confirmed via `GET https://api.printful.com/products` before migration begins.

### B.1 Garments — P26 (DTG, Germany)

| Blueprint | Product Name | SKAPARA Count | Printful Equivalent | Printful Catalog ID (provisional) | EU Available | Cost Delta | Notes |
|---|---|---|---|---|---|---|---|
| BP6 | Unisex Heavy Cotton Tee (Gildan 5000) | 16 | Gildan 5000 Unisex Heavy Cotton Tee | ~4 | YES | ~+$1.00/unit | Printful stocks Gildan 5000 EU |
| BP12 | Unisex Softstyle T-Shirt (Gildan 64000) | 1 | Gildan 64000 Unisex Softstyle Tee | ~64 | YES | ~+$0.50/unit | 32 color options |
| BP49 | Unisex Heavy Blend Crewneck (Gildan 18000) | 4 | Gildan 18000 Crewneck Sweatshirt | ~28 | YES | ~+$1.50/unit | |
| BP65 | Kids Organic Sweatshirt (Stanley/Stella) | 1 | Stanley/Stella Kids Organic Sweatshirt | TBD | VERIFY | UNKNOWN | Stanley/Stella is EU-aligned brand |
| BP67 | Baby/Toddler Organic Sweatshirt (Stanley/Stella) | 1 | Stanley/Stella STSK915 / similar | TBD | VERIFY | UNKNOWN | May need alternative |
| BP77 | Unisex Heavy Blend Hoodie (Gildan 18500) | 5 | Gildan 18500 Unisex Heavy Blend Hoodie | ~18 | YES | ~+$2.00/unit | Colors may differ slightly |
| BP80 | Unisex Ultra Cotton Long Sleeve (Gildan 2400) | 3 | Gildan 2400 Long Sleeve Tee | ~2 | YES | ~$0/unit | |
| BP81 | Kids Heavy Cotton Tee (Gildan 5000B) | 2 | Gildan 5000B Heavy Cotton Youth Tee | ~7 | YES | ~+$0.50/unit | |
| BP145 | Unisex Long Sleeve Tee (Gildan 2400 alt) | 1 | Gildan 2400 Long Sleeve (alt spec) | ~2 | YES | ~$0/unit | Verify exact spec matches BP80 |
| BP157 | Kids Tee (B&C) | 1 | B&C TK300 Kids Tee or equivalent | TBD | VERIFY | UNKNOWN | B&C brand available at Printful EU |
| BP454 | Unisex T-Shirt (B&C E190) | 1 | B&C E190 Exact 190 T-Shirt | TBD | VERIFY | UNKNOWN | B&C E190 may not be in Printful catalog |
| BP455 | Zip-Up Hoodie (B&C WM647) | 1 | Alternative zip hoodie (B&C WM647 absent) | TBD | VERIFY | UNKNOWN | **HIGH RISK** — specific model may not be available |
| BP457 | Unisex Crewneck Sweatshirt (B&C WU600) | 2 | B&C WU600 or Printful alternative | TBD | VERIFY | UNKNOWN | |
| BP731 | Organic Tote Bag (EarthAware) | 4 | Organic Tote Bag (Printful equivalent) | ~73 | YES | ~+$0.50/unit | Multiple Printful tote options |
| BP1018 | Ceramic Mug 11oz | 5 | White Glossy Mug 11oz | ~19 | YES | ~$0/unit | Standard white mug is universal |
| BP1025 | Baby Bodysuit Organic (Stanley/Stella) | 1 | Stanley/Stella Baby Bodysuit or alt | TBD | VERIFY | UNKNOWN | |
| BP1045 | Baby Bodysuit Organic Alt (Stanley/Stella) | 1 | Stanley/Stella STBZ520 or similar | TBD | VERIFY | UNKNOWN | |
| BP1462 | Unisex Organic T-Shirt (Stanley/Stella Creator) | 1 | Stanley/Stella Creator STTU755 | TBD | VERIFY | UNKNOWN | |

### B.2 Drinkware — P86 (T-Shirt and Sons, Poland)

| Blueprint | Product Name | SKAPARA Count | Printful Equivalent | Printful Catalog ID (provisional) | EU Available | Cost Delta |
|---|---|---|---|---|---|---|
| BP620 | Insulated Water Bottle 12oz | 2 | Printful Insulated Bottle 12oz | TBD | YES | UNKNOWN |
| BP633 | Travel Mug 16oz | 2 | Printful Travel Mug or 16oz equiv | TBD | YES | UNKNOWN |
| BP966 | Insulated Tumbler 20oz | 1 | Printful Insulated Tumbler | ~388 | YES | UNKNOWN |

### B.3 Bottles + Stickers — P23 (Art Gun, EU)

| Blueprint | Product Name | SKAPARA Count | Printful Equivalent | Printful Catalog ID (provisional) | EU Available | Cost Delta |
|---|---|---|---|---|---|---|
| BP854 | Insulated Bottle 12/18/32oz | 2 | Printful Stainless Bottle (various sizes) | TBD | YES | UNKNOWN |
| BP1523 | Sticker Round/Square | 2 | Printful Kiss-Cut Stickers | ~358 | YES | UNKNOWN |

### B.4 Shoes + Desk Mat — P90 (Printy6, Czech Republic) — HIGH RISK

| Blueprint | Product Name | SKAPARA Count | Printful Equivalent | EU Available | Risk |
|---|---|---|---|---|---|
| BP767 | Low Top Sneaker | 1 | NO direct Printful equivalent | UNKNOWN | **CRITICAL** — unique sublimation sneaker |
| BP1534 | Kids Clogs | 1 | NO direct Printful equivalent | UNKNOWN | **CRITICAL** — niche product type |
| BP969 | Desk Mat | 1 | Printful Desk Mat / Extended Mousepad | TBD | MEDIUM |

**P90 Risk Assessment**: Printy6 offers sublimation sneakers and kids clogs that are highly specific. Printful does not appear to offer sublimation sneakers (they offer AOP canvas shoes, which have different aesthetics and production process). The 3 P90 products represent **2 products at risk of no migration path** and 1 (desk mat) that likely has a Printful equivalent.

### B.5 Headwear + Embroidered Hoodie — P410 (Printful, Latvia) — ALREADY PRINTFUL

| Blueprint | Product Name | SKAPARA Count | Printful Catalog ID (confirmed equivalent) | Notes |
|---|---|---|---|---|
| BP793 | Premium Embroidered Hoodie (Cotton Heritage M2580) | 5 | Cotton Heritage M2580 (Printful) | Same blank, re-link only |
| BP1691 | Beanie (Cuffed) | 1 | Cuffed Beanie (Printful) | |
| BP1729 | Dad Hat (Unstructured) | 1 | Dad Hat (Printful) | |
| BP1743 | Snapback (Flat Brim) | 1 | Flat Bill Cap (Printful) | |
| BP1744 | Trucker Cap | 4 | Foam Trucker Hat (Printful) | |
| BP1910 | Bucket Hat (Embroidered) | 3 | Bucket Hat (Printful) | |
| BP1927 | Insulated Tumbler 20oz | 1 | Insulated Tumbler (Printful) | |

### B.6 Variant Coverage Gap Analysis

After mapping blueprints to Printful, the following variant differences are expected:

| Product Type | Printify (P26) Colors | Expected Printful Colors | Gap |
|---|---|---|---|
| Gildan 5000 Tee (BP6) | 12 colors | Printful offers 65+ Gildan 5000 colors EU | GAIN — more options |
| Gildan 18500 Hoodie (BP77) | 7 colors | Printful offers 20+ Gildan 18500 colors EU | GAIN |
| Gildan 18000 Crewneck (BP49) | 6 colors | Printful offers 15+ colors EU | GAIN |
| Gildan 2400 Long Sleeve (BP80) | 2 colors (Black, Navy) | Printful offers 10+ EU | GAIN |
| Ceramic Mug 11oz (BP1018) | 11 colors | Printful 11oz mug: 2 colors (Black, White) | LOSS — 9 colors unavailable |
| Organic Tote (BP731) | 3 colors | Printful totes: varies by model | VERIFY |
| BP793 Emb Hoodie | 4 colors (Black, Bone, Maroon, White) | Same — Cotton Heritage M2580 | NO CHANGE |

**Critical gap**: The 11oz ceramic mug at Printful is typically available in white and black only. The 11 color mug variants currently on Printify (P26) will not be reproducible. This affects 5 products with up to 11 variants each (55 variants at risk). The recommended approach is to consolidate to the 2 Printful-available colors (White and Black) during migration and remove unavailable color variants from the store.

---

## C. Design Assets Migration

### C.1 Current Design Asset Locations

Design files exist in three locations:

**1. Local disk (`/frontend/public/` subdirectories) — PRIMARY SOURCE**

| Directory | File Count | Formats | Purpose |
|---|---|---|---|
| `public/meme-designs/` | 10 PNGs | PNG | Meme T-shirt designs 01-10 |
| `public/meme-previews/` | 12 files (6 designs + 6 previews) | PNG | Meme designs 11-16 |
| `public/branded-previews/` | 18 files | PNG | Branded product designs |
| `public/brand-designs/` | 8 files | PNG + SVG | Branding assets |
| `public/hat-designs/` | 4 PNGs | PNG | Embroidery hat designs |
| `public/kids-designs/` | 21 files (8 SVG + 8 PNG + 5 brand PNG) | SVG + PNG | Kids clothing designs |
| `public/fleece-designs/` | 5 PNGs | PNG | Crewneck/fleece designs |
| `public/expansion-designs/` | 19 SVGs + subdirs | SVG | Latest expansion designs (a01-h03) |
| `public/zip-hoodie-designs/` | 5 PNGs | PNG | Zip hoodie design |
| `public/brand/` | 13 files | SVG + PNG | Brand identity assets |

**Total local disk design files: ~115 files across 10 directories.**

**2. Printify CDN — NOT TRANSFERABLE**

All print files currently attached to Printify products are stored on Printify's CDN (`files.cdn.printify.com`). These URLs are not accessible for direct download by Printful. Design files must be re-uploaded from local disk or a public URL.

**3. Supabase Storage — PARTIAL**

Design assets generated by the AI design pipeline may be stored in Supabase Storage buckets. Query `SELECT storage_path FROM user_design_assets` to enumerate these. These are accessible via public Supabase Storage URLs and can be used as upload sources for Printful's File Library API.

### C.2 Resolution Requirements Comparison

| Print Technique | Printify Required DPI | Printful Required DPI | Format | Notes |
|---|---|---|---|---|
| DTG T-Shirt front | 150 DPI (min) | 150 DPI (min), 300 recommended | PNG, transparent | Both accept 4500x5400px at 300 DPI |
| DTG Hoodie front | 150 DPI | 150 DPI min, 300 recommended | PNG, transparent | |
| DTG Mug wrap | 150 DPI | 150 DPI | PNG | Printful mug: 2700x2025px recommended |
| DTG Tote Bag | 150 DPI | 150 DPI, 300 recommended | PNG | Both use same 4500x5400px target |
| Embroidery (Hat/Cap) | PNG, flat colors | PNG, min 300 DPI, flat colors | PNG | Printful performs digitization |
| Embroidery (Hoodie BP793) | PNG, max 3 colors | PNG, 300 DPI, max 6 colors | PNG | Printful allows more thread colors |
| Sublimation (Drinkware) | 150 DPI | 150 DPI | PNG | Full-wrap design required |

**Conclusion**: The existing design files on disk are already at adequate resolution for Printful. PNG files at 300 DPI created for Printify will transfer without modification to Printful. SVG designs in `/expansion-designs/` can be rasterized to 4500x5400px at 300 DPI as part of the migration script.

### C.3 Designs That Need Recreation vs. Direct Transfer

**Direct transfer (no modification needed):**
- All PNG files in `meme-designs/`, `meme-previews/`, `fleece-designs/`, `hat-designs/`
- Branded PNG previews in `branded-previews/`
- Kids PNGs in `kids-designs/`
- Zip hoodie PNGs in `zip-hoodie-designs/`

**Require rasterization (SVG → PNG at 4500x5400px 300 DPI):**
- All 19+ SVG files in `expansion-designs/` (a01-h03 series)
- Kids SVG source files in `kids-designs/` (01-08.svg)
- Brand SVG assets used as print files

**Require design recreation / special handling:**
- **Mug wrap designs**: The current mug print file format for Printify (P26 uses 2850x1050px canvas) must be confirmed against Printful's mug spec (2700x2025px). If different, mug designs need to be reformatted.
- **P90 sneaker/clogs designs**: If no Printful equivalent exists, these designs are only relevant for the P90 products that may be discontinued.
- **Embroidery hat designs**: Hat embroidery designs created for Printify/P410 should transfer directly since the same Printful blanks are used, but Printful's digitization service will re-process the PNG files.

### C.4 Printful File Library Upload Strategy

Printful's File Library API (`POST https://api.printful.com/files`) accepts file uploads by URL, which eliminates the base64 encoding and Cloudflare bypass complexity that plagued Printify uploads. The migration script will:

1. Serve local design files from the Next.js `public/` directory (files are already public-accessible at `https://skapara.com/meme-designs/01.png` etc.)
2. Call `POST /files` with the public URL for each design file
3. Cache the returned Printful file ID (`id` field in response) in a local mapping JSON file
4. Reuse the same file ID for all variants of a product (Printful deduplicates by file hash)

File IDs are stable — the same file uploaded twice returns the same ID. This means a design used across 16 T-shirt variants only needs one upload call.

---

## D. Migration Execution Plan

### D.1 Phase Overview

```
Phase 1: Audit (2-3 days)
  └── Verify Printful equivalents for all 33 blueprints
  └── Confirm EU availability for all required variants
  └── Identify hard blockers (P90 products, B&C-specific models)
  └── Decision gate: proceed / replace unsupported products

Phase 2: Design Upload (1 day)
  └── Batch upload all design files to Printful File Library
  └── Build printify-blueprint → printful-file-id mapping table
  └── Verify DPI and file status for all uploaded files

Phase 3: Product Recreation — P410 Re-link (1 day)
  └── 16 existing P410 products re-created as Printful sync products
  └── No design changes needed — same Printful blanks
  └── Update DB: external_product_id, external_variant_id

Phase 4: Product Recreation — P26 (2-3 days)
  └── 51 P26 products created as Printful sync products
  └── Map Printify variant IDs → Printful catalog variant IDs
  └── Set retail_price on each sync variant
  └── Update DB records

Phase 5: Product Recreation — P86 + P23 (1 day)
  └── 5 P86 products (drinkware) + 4 P23 products
  └── Same process as Phase 4

Phase 6: P90 Decision (1 day)
  └── Confirm if Printful has desk mat equivalent → create if yes
  └── Sneakers + kids clogs: archive if no Printful equivalent
  └── Update DB accordingly

Phase 7: DB Update + Verification (1-2 days)
  └── Rename printify_id → external_product_id
  └── Rename printify_variant_id → external_variant_id
  └── Verify mockup URLs for all 79 products
  └── Spot-check 10 products across categories

Phase 8: Cutover (1 day)
  └── Update PRINTIFY_API_TOKEN env → PRINTFUL_API_TOKEN
  └── Deploy updated printify.ts → printful.ts client
  └── Switch cron sync to Printful endpoints
  └── Enable Printful webhooks
  └── Disable Printify webhooks

Phase 9: Post-cutover monitoring (3-5 days)
  └── Monitor first 10 orders through Printful
  └── Verify shipping notifications
  └── Confirm GPSR data on packing slips
```

### D.2 Phase 1: Audit — Verification Checklist

For each of the 33 blueprints, execute:

```javascript
// Verification script outline
const BLUEPRINT_AUDIT = [
  { bp: 'BP6',   product: 'Gildan 5000', printful_id_candidate: 4 },
  { bp: 'BP12',  product: 'Gildan 64000', printful_id_candidate: 64 },
  { bp: 'BP49',  product: 'Gildan 18000 Crewneck', printful_id_candidate: 28 },
  { bp: 'BP77',  product: 'Gildan 18500 Hoodie', printful_id_candidate: 18 },
  // ... all 33 blueprints
]

for (const item of BLUEPRINT_AUDIT) {
  const res = await fetch(`https://api.printful.com/products/${item.printful_id_candidate}`)
  const { result } = await res.json()
  const euVariants = result.variants.filter(v =>
    v.availability_status.some(s => s.region === 'EU' && s.status === 'in_stock')
  )
  console.log(`${item.bp} → ${result.product.title}: ${euVariants.length} EU variants available`)
}
```

Gate condition: Phase 2 does not begin until all 33 blueprints have a confirmed Printful equivalent with EU availability, OR a documented exception (product archived/replaced).

### D.3 Phase 2: Design Upload — Batch Script

```javascript
// scripts/migrate-upload-designs-to-printful.mjs
// Uploads all local design files to Printful File Library
// Outputs: printful-file-map.json (filename → printful file ID)

const DESIGN_DIRS = [
  { dir: 'public/meme-designs', prefix: 'meme' },
  { dir: 'public/meme-previews', prefix: 'meme-preview' },
  { dir: 'public/branded-previews', prefix: 'branded' },
  { dir: 'public/hat-designs', prefix: 'hat' },
  { dir: 'public/kids-designs', prefix: 'kids' },
  { dir: 'public/fleece-designs', prefix: 'fleece' },
  { dir: 'public/expansion-designs', prefix: 'expansion' },
  { dir: 'public/zip-hoodie-designs', prefix: 'zip-hoodie' },
]

const BASE_URL = 'https://skapara.com'  // files must be publicly accessible
const TOKEN = process.env.PRINTFUL_API_TOKEN

async function uploadFile(filename, localPath) {
  const url = `${BASE_URL}/${localPath}`
  const res = await fetch('https://api.printful.com/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url, filename, visible: true })
  })
  const { result } = await res.json()
  // result.status may be 'waiting' — poll GET /files/{id} until 'ok'
  return result.id
}
```

**Estimated upload count**: ~115 design files. At 120 req/min rate limit with 500ms delay between calls, total upload time is approximately 60-90 seconds. However, SVG files must first be rasterized — add 5-10 minutes for that step.

**Important**: Printful deduplicates files by hash. If the same PNG is used for multiple products (e.g., brand mark used across 10 products), it is uploaded once and the same file ID is reused.

### D.4 Phase 3-5: Product Recreation

For each product migrated from Printify to Printful:

```javascript
// Core migration function
async function migrateProduct(supabaseProduct, printfulFileId, printfulVariantMap) {
  // Build sync_variants from current Supabase variants
  const syncVariants = supabaseProduct.product_variants.map(v => ({
    external_id: v.id,  // Supabase variant UUID — becomes external_id
    variant_id: printfulVariantMap[v.color][v.size],  // Printful catalog variant ID
    retail_price: (v.price_cents / 100).toFixed(2),
    is_enabled: true,
    files: [
      { placement: 'front', id: printfulFileId },
      // Add back/neck files if applicable
    ]
  }))

  const res = await fetch('https://api.printful.com/sync_products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PRINTFUL_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sync_product: {
        external_id: supabaseProduct.id,  // Supabase product UUID
        name: supabaseProduct.title,
        thumbnail: supabaseProduct.image_url,
      },
      sync_variants: syncVariants,
    })
  })

  const { result } = await res.json()
  return result.sync_product.id  // Printful sync product ID
}
```

### D.5 Phase 7: DB Update

Migration of Supabase schema and data after Printful products are created:

```sql
-- Step 1: Add new vendor-agnostic columns alongside old ones
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS print_provider text DEFAULT 'printful';

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS external_variant_id text;

-- Step 2: Migration script populates new columns with Printful IDs
-- (executed by migration Node script, not SQL)

-- Step 3: After verification, rename legacy columns
ALTER TABLE products RENAME COLUMN printify_id TO printify_id_deprecated;
ALTER TABLE product_variants RENAME COLUMN printify_variant_id TO printify_variant_id_deprecated;

-- Step 4: Create unique index on new column
CREATE UNIQUE INDEX products_external_product_id_idx ON products(external_product_id)
  WHERE external_product_id IS NOT NULL;
```

The `printify_id` and `printify_variant_id` columns must be kept (renamed, not dropped) for at least 30 days post-migration as rollback references.

### D.6 Rollback Strategy Per Phase

| Phase | Rollback Trigger | Rollback Action | Time to Rollback |
|---|---|---|---|
| Phase 1 (Audit) | Hard blocker found (>5 products with no Printful equivalent) | Halt migration, assess alternatives | Immediate — no code changes yet |
| Phase 2 (File Upload) | >10% files fail to upload or status=failed | Delete uploaded files, fix source files, re-run | 30 min |
| Phase 3-5 (Product Recreation) | Sync product creation fails >5% | Delete Printful sync products for that batch, investigate, retry | 1 hour per batch |
| Phase 7 (DB Update) | Data inconsistency detected | Execute rollback migration: restore `printify_id` as primary, mark `external_product_id` as inactive | 15 min |
| Phase 8 (Cutover) | Order failures in first 24h | Revert `PRINTFUL_API_TOKEN` env, re-enable Printify webhooks, disable Printful webhooks | 5 min (env change + redeploy) |

**Critical protection**: Do not delete Printify products until Phase 9 (post-cutover monitoring) is complete. Run both Printify and Printful in parallel for a minimum of 72 hours during Phase 8-9.

---

## E. Pricing Strategy

### E.1 Current Pricing Model

Pricing is calculated in `src/lib/printify-sync.ts` via the `calculateEngagementPrice` function. The multiplier map is:

```typescript
// From printify-sync.ts
const multipliers: Record<string, number> = {
  sticker:  2.5,  // e.g., cost $5.00 → retail $12.50
  mug:      2.0,
  bottle:   2.2,
  tumbler:  2.0,
  sneaker:  2.0,
  hoodie:   1.7,
  'zip hoodie': 1.8,
  sweatshirt: 1.8,
  crewneck: 1.8,
  'long sleeve': 1.8,
  tote:     1.8,
  'desk mat': 1.6,
  default:  1.8,  // fallback for apparel (tees, kids, etc.)
}
```

The cron sync enforces a minimum 35% margin (`margin < 0.35 → recalculate`). Retail prices are stored in EUR. The USD→EUR conversion rate is hardcoded at **0.92** in `printify-sync.ts`.

### E.2 Printful Base Costs vs. Printify — Estimated Impact

Printful's wholesale prices are generally 5-15% higher than Printify/P26 for comparable EU blanks. The following are rough estimates based on market knowledge; **exact costs must be confirmed from the Printful catalog API before migration**:

| Product Type | Printify P26 Cost (approx EUR) | Printful EU Cost (approx EUR) | Delta | Margin Impact |
|---|---|---|---|---|
| Gildan 5000 Tee | ~$8.50 (~€7.82) | ~$9.50-10.50 (~€8.74-9.66) | +€1-2 | ~3-7% margin reduction |
| Gildan 18500 Hoodie | ~$19-22 (~€17.48-20.24) | ~$21-25 (~€19.32-23.00) | +€2-3 | ~3-5% margin reduction |
| Gildan 18000 Crewneck | ~$14-16 (~€12.88-14.72) | ~$16-18 (~€14.72-16.56) | +€2 | ~3-5% margin reduction |
| 11oz Ceramic Mug | ~$5.50 (~€5.06) | ~$5.50-7.00 (~€5.06-6.44) | +€0-1.50 | 0-5% margin reduction |
| Cotton Heritage M2580 Emb Hoodie (BP793) | ~$22-28 (~€20-26) | Same (already Printful) | +€0 | No change |

**Worst case**: A Gildan 5000 tee currently at EUR 24.99 retail with ~€7.82 cost has a margin of ~68.7%. After migration, if Printful cost is ~€9.50, the same retail price yields ~62% margin. The 35% minimum is not at risk for any garment category. However, the `calculateEngagementPrice` function will need its hardcoded costs updated to reflect Printful pricing after migration.

### E.3 EUR Currency — Printful Multi-Currency

Printful **natively supports multi-currency pricing**. Sync product `retail_price` can be set in any supported currency. Since the SKAPARA store operates entirely in EUR, set `retail_price` in EUR on all Printful sync products during creation. This avoids the USD→EUR 0.92 conversion currently hardcoded in `printify-sync.ts`.

The updated sync engine should:
1. Read `retail_price` from Printful directly (already in EUR)
2. Remove the `* 0.92` USD→EUR conversion factor
3. Keep the 35% margin guard using EUR costs directly from Printful

### E.4 Pricing for Migrated Products — Carry-Over Strategy

During migration, **preserve all current retail prices** from the Supabase `base_price_cents` column. Do not recalculate prices during migration. Post-migration price review (if any) is a separate task after the system is stable.

The only exception: if a Printful base cost exceeds the current retail price (yielding a negative margin), that product must be flagged and repriced before cutover.

---

## F. GPSR Compliance

### F.1 Current GPSR Coverage

All 79 active products have 100% GPSR coverage in the `product_details` JSONB column:
- `safety_information` — 79/79 (100%)
- `material` — 79/79 (100%)
- `manufacturing_country` — 79/79 (100%)
- `print_technique` — 79/79 (100%)
- `brand` — 79/79 (100%)

The `safety_information` field contains full HTML-formatted GPSR blocks including:
- EU representative: HONSON VENTURES LIMITED (for Printful P410 products)
- Manufacturer: Textildruck Europa GmbH (for P26 products)
- EU Regulation 2023/988 compliance statement
- Material composition
- Contact information

### F.2 GPSR Data — What Transfers, What Changes

**Stays in our DB (no change):**
The `product_details` JSONB is our own data stored in Supabase. It is not synced from Printify and will not be lost during migration. All GPSR data (`safety_information`, `material`, `care_instructions`, `manufacturing_country`) continues to live in our `products.product_details` column regardless of which print provider is used.

**Changes required after migration:**

| Field | Current Value | Post-Migration Value | Action |
|---|---|---|---|
| `manufacturing_country` | "Germany" / "DE" (for P26 products) | "Latvia" / "LV" (Printful ships from Riga) | UPDATE all 51 P26 products |
| `safety_information` EU rep block | HONSON VENTURES LIMITED (P410) or Textildruck Europa GmbH (P26) | HONSON VENTURES LIMITED (Printful's EU representative for all products) | UPDATE all 51 P26 products |
| `print_technique` | "DTG" / "DTG (Direct-to-Garment)" | Same technique names (Printful also uses DTG) | Standardize format only |
| `provider_name` | "Textildruck Europa" (P26) / "Printful" (P410) | "Printful" for all | UPDATE 51 products |

**Standardization opportunity**: During migration, normalize the inconsistent format issues identified in the audit:
- Unify `manufacturing_country` to ISO 3166-1 alpha-2 codes ("DE", "LV", etc.)
- Unify `print_technique` to a single canonical string per technique
- Unify `brand` to "SKAPARA" for the 11 products currently using "Generic"

This standardization should be executed as a Supabase migration SQL file applied in Phase 7.

### F.3 Printful-Specific Compliance

Printful does not have a separate GPSR compliance API — GPSR is a seller responsibility, not provider responsibility. However, post-migration:

1. **Packing slips**: Printful allows custom packing slip content via the dashboard. Add GPSR manufacturer information to the packing slip template.
2. **Product labels**: Printful offers inside-label printing for select products (not all). Check availability per product type in Printful dashboard.
3. **HONSON VENTURES LIMITED**: This is Printful's EU representative under GPSR. For all products fulfilled from Printful's Latvia facility, this entity becomes the responsible party in the EU. Update `safety_information` HTML blocks accordingly.

---

## G. Migration Scripts

### G.1 Complete Migration Script Architecture

The migration requires three main scripts. All scripts are located in `frontend/scripts/` and follow the existing `.mjs` pattern.

#### Script 1: `migrate-01-audit-printful-catalog.mjs`

Queries Printful Catalog API to verify equivalents for all 33 blueprints.

```javascript
// Output: frontend/scripts/printful-catalog-map.json
// Format:
{
  "BP6":   { "printful_id": 4,  "title": "Gildan 5000 Tee",    "eu_variants": 156, "confirmed": true },
  "BP12":  { "printful_id": 64, "title": "Gildan 64000 Tee",   "eu_variants": 88,  "confirmed": true },
  "BP767": { "printful_id": null, "title": null,                "eu_variants": 0,   "confirmed": false, "note": "No Printful equivalent" },
  // ... all 33 blueprints
}
```

Rate limit: Catalog API allows 30 req/60s unauthenticated. With 33 blueprints, this takes ~70 seconds with 2s delays.

#### Script 2: `migrate-02-upload-designs.mjs`

Uploads all design files from `public/` to Printful File Library. Produces a file ID map.

```javascript
// Output: frontend/scripts/printful-file-map.json
// Format:
{
  "meme-designs/01.png": 98765001,
  "meme-designs/02.png": 98765002,
  "expansion-designs/a01/front.png": 98765020,
  // ... all ~115 design files
}
```

Handles:
- Status polling (retry every 2s until `status === 'ok'` or `status === 'failed'`)
- Deduplication (same hash → same ID, skip re-upload)
- Dry-run mode: `--dry-run` flag skips actual API calls, logs what would be uploaded

Estimated execution time: 3-5 minutes (115 files × ~2s each)

#### Script 3: `migrate-03-create-sync-products.mjs`

The main migration script. Reads from Supabase, creates Printful sync products, updates Supabase.

```javascript
// Usage:
// node migrate-03-create-sync-products.mjs --dry-run     # Validate only
// node migrate-03-create-sync-products.mjs --provider p26  # Migrate only P26 products
// node migrate-03-create-sync-products.mjs --provider p410 # Re-link P410 products
// node migrate-03-create-sync-products.mjs --all           # Full migration (use with care)
// node migrate-03-create-sync-products.mjs --product-id <uuid>  # Single product test

// Output: frontend/scripts/migration-results.json
// Format:
{
  "migrated": [
    {
      "supabase_id": "uuid-here",
      "title": "Ghost Tee",
      "printful_sync_product_id": 123456,
      "variants_created": 34,
      "status": "ok"
    }
  ],
  "failed": [
    {
      "supabase_id": "uuid-here",
      "title": "SKAPARA Step (Sneaker)",
      "error": "No Printful equivalent for BP767",
      "action": "archived"
    }
  ],
  "skipped": []
}
```

**Dry-run mode behavior**: In `--dry-run`, the script:
- Reads all Supabase products
- Validates variant mapping against the catalog map from Script 1
- Checks that all required design file IDs exist in the file map from Script 2
- Prints a full summary of what would be created, with estimated variant counts
- Does NOT call `POST /sync_products`

### G.2 Error Handling Strategy

| Error Type | Detection | Action |
|---|---|---|
| Missing Printful catalog equivalent | Script 1 output: `confirmed: false` | Flag product, human review required before Script 3 |
| File upload failed (`status: failed`) | Script 2 polling loop | Log error, skip file, continue. Report at end. Require manual retry before Script 3 |
| Variant not available in EU | Catalog API: no EU availability_status | Exclude variant from sync product, log warning |
| `POST /sync_products` returns 4xx | HTTP error | Retry up to 3 times with exponential backoff (2s, 4s, 8s). If still failing, write to failed array and continue next product |
| Partial product creation (some variants fail) | Variant count mismatch | Log delta, continue. Product still created with available variants |
| Supabase update fails after Printful product created | DB write error | Log Printful product ID to `migration-results.json`. Re-run Script 3 with `--product-id` to retry DB update only |
| Rate limit exceeded (120 req/min) | HTTP 429 | Automatic backoff: wait 60s and retry |

### G.3 Estimated Execution Time

| Script | Operations | Rate Limit | Estimated Time |
|---|---|---|---|
| Script 1 (Audit) | 33 catalog lookups + variant checks | 30 req/60s | ~3-5 minutes |
| Script 2 (File Upload) | ~115 file uploads + status polling | 120 req/min | ~8-12 minutes |
| Script 3 (Create Products) | 79 products × avg 18 variants = ~1,422 variant operations | 120 req/min | ~15-25 minutes |
| DB Updates (Phase 7) | 79 PATCH + rename columns | Supabase REST | ~2-3 minutes |
| **Total** | | | **~30-45 minutes** |

### G.4 Pre-Migration Validation Checklist

Before running any script:

- [ ] `PRINTFUL_API_TOKEN` is set in `.env.local` and verified with `GET https://api.printful.com/store` (returns store info)
- [ ] All design files in `public/` subdirectories are accessible via `https://skapara.com/` (test 3 URLs manually)
- [ ] Script 1 output (`printful-catalog-map.json`) has been reviewed and all hard blockers documented
- [ ] Supabase admin client credentials confirmed (`SUPABASE_URL` + `SUPABASE_SERVICE_KEY`)
- [ ] A full Supabase backup has been taken (pg_dump or Supabase dashboard backup)
- [ ] All P90 products (sneakers, kids clogs, desk mat) have a documented decision: archive or find alternative

### G.5 Post-Migration Verification Checklist

After all scripts complete:

- [ ] 79 Printful sync products exist (verify with `GET /sync_products?limit=100`)
- [ ] Spot-check 5 products: compare Printify variant count vs. Printful variant count
- [ ] Verify `external_product_id` is populated for all 79 Supabase products
- [ ] Verify `external_variant_id` is populated for all 1,435 Supabase variants (minus P90 if archived)
- [ ] Pull 5 random product pages in the storefront, confirm images load from Printful CDN
- [ ] Confirm the cron sync (`/api/cron/sync-printify`) has been updated to Printful endpoints
- [ ] Confirm Printful webhooks are registered and Printify webhooks are disabled
- [ ] Place 1 test order end-to-end and verify it appears in Printful dashboard

---

## H. Summary — Migration Priority Matrix

| Priority | Group | Products | Effort | Risk |
|---|---|---|---|---|
| 1 | P410 re-link (already Printful) | 16 | LOW | LOW |
| 2 | P26 Gildan basics (BP6, BP49, BP77, BP80) | 28 | MEDIUM | LOW |
| 3 | P26 specialty (BP731 totes, BP1018 mugs, kids) | 23 | MEDIUM | MEDIUM |
| 4 | P86 drinkware (BP620, BP633, BP966) | 5 | MEDIUM | MEDIUM |
| 5 | P23 bottles + stickers (BP854, BP1523) | 4 | MEDIUM | MEDIUM |
| 6 | P90 products (sneakers, clogs, desk mat) | 3 | HIGH | HIGH |

**The 16 P410 products should be migrated first as a low-risk validation pass.** They confirm the migration pipeline works end-to-end before tackling the 51 P26 products that form the core of the catalog.

---

*Section 4 complete. See Section 5 (Database Schema Migration) and Section 6 (API Client Rewrite) for the technical implementation details that enable this catalog migration plan.*
