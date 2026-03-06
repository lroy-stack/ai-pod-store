# Printify — Custom Neck Labels

**Source**: https://help.printify.com/hc/en-us/articles/9691640023185-How-can-I-create-a-custom-neck-label
**Supplementary source**: https://printify.com/custom-branding/
**Retrieved**: 2026-03-01
**Note**: The Printify Help Center article (hc/en-us/articles/9691640023185) is protected by Cloudflare and returns HTTP 403 to automated requests. The content below is compiled from Printify's official public-facing pages (`printify.com/custom-branding/`, `printify.com/guide/design-guide/`). Verify any spec details directly in the Printify Product Creator before production use.

---

## Overview

Custom neck labels (also called "branded neck labels" or "custom neck tags") are printed labels placed inside the collar of garments. They replace or supplement the manufacturer's default care/size label and display your brand identity — logo, slogan, size, material composition, care instructions, discount codes, or country of origin.

Printify offers neck labels as an optional **Custom Branding** add-on. The feature is available only for garment products and only through supported print providers.

**Base price:** Starting at **$0.55 per label** (per unit produced).

---

## What Can a Neck Label Display

- Brand logo or wordmark
- Brand slogan or tagline
- Product size (XS / S / M / L / XL / XXL)
- Material composition (e.g., "100% Organic Cotton")
- Country of manufacture
- Care instructions (wash symbols)
- Discount codes or promotional text
- QR codes (linking to review pages, social media, etc.)
- Feedback prompts

---

## Supported Print Providers

Neck label support is **not universal** — it is tied to specific print providers. As of the date above, the confirmed neck-label-capable providers include:

| Provider | Notes |
|---|---|
| **Monster Digital** | DTG — US-based |
| **SwiftPOD** | DTG — US-based |
| **Dimona Tee** | DTG — US-based |
| **Print Clever** | DTG |
| **Duplium** | DTG |

> **EU provider note**: None of the confirmed neck-label providers above are EU-based. The EU-approved providers used in this project (P26 Textildruck Europa, P410 Printful Letonia, P90 Smart Printee, P23 WOYC, P30 OPT OnDemand) may or may not support the neck label feature. Verify in the Printify Product Creator for each blueprint before assuming support.

---

## Supported Products / Blueprints

Neck labels are available only on **garments with a physical collar or neck opening**, typically:

- T-shirts (crew neck, V-neck)
- Hoodies (pullover and zip)
- Sweatshirts / crewnecks
- Long sleeve shirts
- Kids clothing
- Tank tops

They are **not applicable** to:

- Hats / caps / beanies (no neck label area)
- Mugs, drinkware, bottles
- Bags and accessories
- Stickers, posters, prints
- Footwear

The exact list of compatible blueprints varies by print provider. Check the **Product Creator > Branding** tab when setting up a product to see if the neck label option is available for that specific blueprint + provider combination.

---

## How to Create a Custom Neck Label (Step-by-Step)

These steps reflect the workflow inside the Printify Product Creator:

1. **Open the Product Creator** — navigate to your Printify account, then My Products > Add New Product, or edit an existing product.

2. **Select a compatible blueprint** — choose a garment (t-shirt, hoodie, etc.) from a provider that supports neck labels (see Supported Print Providers above).

3. **Design your main print** — complete the front/back design as normal on the main print area tabs.

4. **Open the Branding tab** — in the Product Creator, look for a "Branding" or "Neck Label" tab (appears only if the selected provider supports it).

5. **Upload your neck label design file** — see File Requirements below. The upload interface accepts PNG and JPEG.

6. **Position and scale** — use the on-screen editor to fit your design within the label print area template. The template shows the safe zone and bleed area.

7. **Preview** — review the mockup to confirm the label looks correct at the expected printed size.

8. **Save the product** — the neck label configuration is saved as part of the product. Every unit produced will include the label.

9. **Publish to your store** — follow the normal Printify publish flow.

---

## File Requirements

The following specifications apply to neck label design files. These are derived from Printify's general design guide (RGB-only system, standard file formats). Confirm exact dimensions inside the Product Creator template for your specific blueprint.

| Parameter | Requirement |
|---|---|
| **File format** | PNG (preferred, supports transparency) or JPEG |
| **Color mode** | RGB only — Printify's system does not accept CMYK; any CMYK file is auto-converted, which can shift colors |
| **Resolution** | Minimum 300 DPI at print size — higher is better for small text and fine detail |
| **Transparency** | Supported via PNG with alpha channel — use for non-rectangular label shapes |
| **Background** | Transparent (PNG) for labels that bleed to the garment fabric; white/solid for labels with a printed background |
| **Max file size** | ~20 MB (general Printify upload limit) |
| **SVG** | Not confirmed as supported for branding uploads — use rasterized PNG/JPEG |

### Typical Neck Label Dimensions

Printify does not publish a single universal canvas size for neck labels — the size depends on the blueprint and the label area offered by the print provider. Common industry dimensions for DTG inside-neck labels are:

| Label size | Approx. canvas at 300 DPI |
|---|---|
| 2" × 2" (5 × 5 cm) | 600 × 600 px |
| 2" × 1" (5 × 2.5 cm) | 600 × 300 px |
| 3" × 1.5" (7.5 × 4 cm) | 900 × 450 px |

**Always use the template provided inside the Product Creator** — it will show the exact pixel dimensions and safe zone for the specific blueprint you selected. Do not guess dimensions.

---

## Design Recommendations

- **Keep text large enough to be legible at print size** — minimum ~5mm tall for body text (same rule as embroidery). At 300 DPI and a 2" wide label, that is roughly 60px tall.
- **Use high-contrast colors** — the label is printed directly onto fabric; low contrast bleeds into the garment color.
- **Avoid thin strokes** — lines thinner than 1pt at print size will not reproduce cleanly.
- **No gradients on white labels** — gradients may band on small DTG labels. Use flat color fills.
- **Leave a bleed / safe zone** — keep critical content (logo, text) at least 2–3mm inside the template edge.
- **Test with a sample order before launching** — order a single unit to verify the label placement, size, and color accuracy before selling at scale.

---

## Pricing

| Feature | Price |
|---|---|
| Branded neck label | Starting at **$0.55 per unit** |
| Packaging insert | Starting at $0.15 per unit |
| Gift message | Starting at $0.15 per unit |

Pricing is per unit produced and is added to your base product cost. The $0.55 figure is the minimum starting price — actual cost may vary by provider and product.

---

## Limitations and Restrictions

- **Provider lock-in**: Once you add a neck label to a product, orders for that product are routed **only to providers that support neck labels**. If the assigned provider is unavailable, Printify cannot reroute to an alternate provider (order routing is disabled for branding orders).
- **Express shipping incompatible**: Orders containing neck labels do **not** qualify for Express shipping. Only Standard shipping is available.
- **No minimum order quantity**: The feature is fully on-demand — every unit gets the label.
- **No storage fees**: Labels are not pre-printed; they are added per order.
- **One label per product**: Typically a single neck label design per product; you cannot add multiple label designs to the same product.
- **Not available on all products**: Only garments with a collar/neck opening. Accessories, homeware, and non-apparel products do not support neck labels.
- **Mockup accuracy**: The mockup in the Product Creator may not perfectly represent the final placement. Always order a physical sample.

---

## Order Workflow Impact

When a product with a neck label is ordered:

1. The order is sent directly to the designated print provider that supports neck labels.
2. Smart Order Routing (which normally reroutes to the fastest available provider) is **bypassed**.
3. The label is printed DTG on the inside neck area during production.
4. The order ships with the label already applied — no separate label fulfillment step.

---

## Relevance to This Project (SKAPARA / EU Context)

- **EU providers (P26, P410, P90, P23, P30)**: As of 2026-03-01, these are not listed among the confirmed neck-label providers on `printify.com/custom-branding/`. This means neck labels may **not be available** for EU-only product configurations.
- **GPSR compliance opportunity**: Neck labels are an excellent place to include EU GPSR-required information (material composition, country of origin, manufacturer details) in a professional format — but only if EU-compatible providers support the feature.
- **Fallback**: If neck labels are not supported by EU providers, GPSR information must be included in the `product_details` JSONB field (`safety_information`, `material`, `manufacturing_country`) and optionally printed in the inside-back print area as a text design.
- **Verify in Product Creator**: Before building any workflow that relies on neck labels, open the Product Creator for a specific blueprint + EU provider combination and check whether the Branding tab appears.

---

## Related Documentation

- `/frontend/docs/printify-packaging-inserts.md` — Packaging insert specifications and workflow
- `/frontend/CATALOGO_EU_DEFINITIVO.md` — Verified EU blueprints and providers
- `https://printify.com/custom-branding/` — Official Printify custom branding landing page
- `https://printify.com/guide/design-guide/` — General Printify design file specifications
- `https://help.printify.com/hc/en-us/articles/9691640023185` — Original help article (may require browser login to access)
