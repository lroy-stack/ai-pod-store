# Product Workflow Reference

## Design-to-Product Flow (Complete)

For each approved design without a linked product:

### 0. DEDUP CHECK (OBLIGATORY)
Call `supabase_query` on `products` with `filters: {"title": "<exact product title>"}`.
If ANY result with status != 'deleted' → SKIP this product entirely.

### 1. Select Blueprint (with Dimension Validation)
Check design width/height ratio. Match to allowed products from product_specs.md:
- **1:1** → Mugs (single side), Tote Bags, Stickers, Throw Pillows
- **3:4** → T-Shirts, Hoodies, Canvas (A4/A3)
- **9:16** → Phone Cases
- **NEVER** create Posters (banned), AOP apparel (banned), Bumper Stickers (banned)
Create Tier 1 products (mugs, totes, stickers) before Tier 2 (t-shirts, hoodies).
`printify_get_blueprints` → select blueprint IDs for dimension-compatible types only.

### 2. Select Provider
`printify_get_providers` → select EU-based provider (lowest cost, good reviews).
Record: provider_name, manufacturing_country (location.country).

### 3. Get Blueprint Details
`printify_get_blueprint_detail` with the selected blueprint_id → extract:
- description → parse material info (e.g. "100% ring-spun cotton, pre-shrunk")
- brand + model → save (e.g. brand="Bella+Canvas", model="3001")

### 4. Select Variants
`printify_get_variants` → select a DIVERSE range:
- **Sizes**: minimum S, M, L, XL (or all available)
- **Colors**: MANDATORY minimum 4 distinct colors
  - 1-2 neutrals (Black, White, Navy) + 2-3 colors (Red, Royal Blue, Forest Green)
  - If provider offers <4 colors, use ALL available

### 5. Upload Image
`printify_upload_image` → upload design, get image_id.
Use `bg_removed_url` when available, fall back to `image_url`.

### 6. Create Product
`printify_create` → create with conservative price EUR 29.99 (2999 cents) for all variants.

### 7. Extract Real Data
**IMMEDIATELY** `printify_get_product` → extract:
- Real cost per variant (each variant has `cost` field in USD cents)
- **ALL mockup images** from the `images` array (front, back, lifestyle, detail)
  Save as: `[{"src": "https://…mockup1.jpg", "alt": "Title - Front"}, …]`
  Minimum 4 distinct images if Printify provides them.
- Variant details: id, title, options (size/color), cost, price

### 8. Convert Currency
`cost_eur_cents = int(cost_usd_cents * PRINTIFY_USD_TO_EUR_RATE)` (rate from config.py, currently 0.92)

### 9. Calculate Final Price
Use the Pricing Quick-Reference Table below.

### 10. Update Prices
`printify_update` → update ALL variants with corrected prices.
If Cost Benchmarks exist in pricing_history.md and price deviates >30% → flag for review.

### 11. Generate Descriptions
- English description as plain text → `products.description`
- Spanish and German translations → `products.translations` as JSONB:
  `{"es": {"title": "…", "description": "…"}, "de": {"title": "…", "description": "…"}}`
- **CRITICAL**: `description` = plain English text. `translations` = JSONB. Never put JSON in description.

### 12. Save to Supabase
`supabase_insert` into `products` (single dict, NOT a list):
title, description, translations, category (kebab-case), base_price_cents, cost_cents,
currency="EUR", images (JSONB array), printify_id, status="draft", product_details (JSONB).

### 13. Save Variants
`supabase_insert` into `product_variants` — ONE record per variant with:
product_id, printify_variant_id, title, size, color, price_cents, cost_cents,
is_enabled=true, is_available=true, image_url (from variant_image_map if available).

### 14. Generate Embedding
`gemini_embed_text` → 768-dim embedding for semantic search.

### 15. Link Design
`supabase_update` on `designs` → set product_id.

### 16. GPSR Compliance (EU) — MANDATORY before publish
`printify_get_gpsr` with product_id → returns `{safety_information: "<HTML>"}`.
`printify_update` with safety_information HTML.
Store in `product_details.safety_information` JSONB via `supabase_update`.
If GPSR not available for this blueprint, log warning and flag for manual review — do NOT skip silently.

### 17. Publish
`printify_publish` → publish to sales channel.
The `sync_hook` verifies actual Printify state (`visible=true`) before activating:
- If verified visible → `status='active'` + `published_at` in Supabase.
- If not yet visible → `status='publishing'` (transitional — cron reconciles within 2h).

**CRITICAL**: Complete all steps for each product BEFORE starting the next one.

---

## Pricing Quick-Reference Table

| Product Type | Multiplier | Min Price | Example: Cost €5 | Example: Cost €26 |
|---|---|---|---|---|
| Stickers, Pins | x2.5 | €3.99 | €12.99 | €64.99 |
| Mugs, Phone Cases | x2.0 | €9.99 | €10.99 | €52.99 |
| T-Shirts, Tote Bags | x1.8 | €14.99 | €14.99 | €46.99 |
| Hoodies, Sweaters | x1.7 | €29.99 | €29.99 | €44.99 |
| Posters, Canvas | x2.0 | €7.99 | €10.99 | €52.99 |
| Blankets, Premium Home | x1.55 | €39.99 | €39.99 | €40.99 |

**Hard rules**:
- FLOOR: price >= cost × 1.4 (40% minimum margin)
- CEILING: price <= cost × 3.0
- Round UP to nearest .99 ending
- If multiplier gives price below Min Price, use Min Price

---

## Pricing Procedure (Cycle 2 — 14:00)

1. Read pricing_history.md Active Alerts — URGENT first, then OPEN
2. For each alert: recalculate price = max(cost_eur * 1.4, current_price * 0.8)
3. Clamp all changes to ±20% of current price (security hook enforces)
4. `supabase_update` + `printify_update` to sync
5. Mark alerts as RESOLVED in pricing_history.md
6. Cost backfill: `supabase_query` products WHERE cost_cents IS NULL LIMIT 20
   → `printify_get_product` → extract cost → `supabase_update`
7. Demand adjustments: high predicted_quantity → +10%, low → -10%
8. Metadata backfill: products WHERE product_details IS NULL → fill from Printify
9. GPSR backfill: products WHERE safety_information IS NULL → fill from Printify
10. Log all changes to pricing_history.md

---

## GPSR Compliance Detail

For EU-sold products:
1. `printify_get_gpsr` with product_id → `{safety_information: "<HTML>"}`
2. `printify_update` with safety_information HTML
3. Store in product_details JSONB via `supabase_update`
4. If not available for blueprint, skip silently

---

## Product Details JSONB Structure

```json
{
  "material": "100% ring-spun cotton, pre-shrunk",
  "care_instructions": "Machine wash cold, tumble dry low",
  "print_technique": "DTG",
  "manufacturing_country": "DE",
  "provider_name": "Monster Digital",
  "brand": "Bella+Canvas",
  "model": "3001",
  "blueprint_description": "Premium unisex t-shirt...",
  "safety_information": "<HTML from GPSR>"
}
```
