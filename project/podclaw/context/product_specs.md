# Product Specifications — POD AI

Reference for Designer and Cataloger agents: print area dimensions,
resolution requirements, and product type selection by design style.

---

## Print Area Specs

### Apparel

| Product | Print Area | Resolution (min) | Aspect Ratio | Notes |
|---------|-----------|-------------------|--------------|-------|
| T-Shirt (front) | 12" x 16" | 3600 x 4800 px | 3:4 | Centered on chest |
| T-Shirt (back) | 12" x 16" | 3600 x 4800 px | 3:4 | Full back |
| Hoodie (front) | 10" x 12" | 3000 x 3600 px | 5:6 | Smaller due to pocket |
| Hoodie (back) | 12" x 14" | 3600 x 4200 px | 6:7 | Full back |
| Tank Top | 10" x 14" | 3000 x 4200 px | 5:7 | Narrower chest |
| All-Over Print | Full garment | 4500 x 5400 px | — | Seamless tile or full coverage |

### Drinkware

| Product | Print Area | Resolution (min) | Aspect Ratio | Notes |
|---------|-----------|-------------------|--------------|-------|
| Mug 11oz (wrap) | 9.5" x 3.5" | 2850 x 1050 px | ~3:1 | Wraps around — panoramic |
| Mug 15oz (wrap) | 9.5" x 4" | 2850 x 1200 px | ~2.5:1 | Slightly taller |
| Mug (single side) | 3.5" x 3.5" | 1050 x 1050 px | 1:1 | One-sided print |

### Accessories

| Product | Print Area | Resolution (min) | Aspect Ratio | Notes |
|---------|-----------|-------------------|--------------|-------|
| Phone Case | 2.5" x 5" | 750 x 1500 px | 1:2 | Tall portrait |
| Tote Bag | 12" x 12" | 3600 x 3600 px | 1:1 | Square centered |
| Tote Bag (AOP) | Full bag | 4500 x 4500 px | 1:1 | All-over print |
| Sticker (small) | 3" x 3" | 900 x 900 px | 1:1 | Kiss-cut |
| Sticker (large) | 6" x 6" | 1800 x 1800 px | 1:1 | Kiss-cut |
| Sticker (bumper) | 8" x 3" | 2400 x 900 px | 8:3 | Landscape |

### Home & Art

| Product | Print Area | Resolution (min) | Aspect Ratio | Notes |
|---------|-----------|-------------------|--------------|-------|
| Poster 18x24" | 18" x 24" | 5400 x 7200 px | 3:4 | Portrait standard |
| Poster 24x36" | 24" x 36" | 7200 x 10800 px | 2:3 | Large format |
| Canvas A4 | 8.3" x 11.7" | 2490 x 3510 px | ~1:1.4 | Standard A4 |
| Canvas A3 | 11.7" x 16.5" | 3510 x 4950 px | ~1:1.4 | Standard A3 |
| Throw Pillow 18x18" | 18" x 18" | 5400 x 5400 px | 1:1 | Square |
| Throw Pillow 20x20" | 20" x 20" | 6000 x 6000 px | 1:1 | Square |
| Blanket 50x60" | 50" x 60" | 6000 x 7200 px | 5:6 | Oversized |
| Blanket 60x80" | 60" x 80" | 7200 x 9600 px | 3:4 | Throw size |

## Product Priorities (MANDATORY)

### Restricted Products — Require Catalog Validation
| Product | Condition |
|---------|-----------|
| Bumper stickers | Low demand — avoid unless trending data supports it |

> Posters and AOP apparel are ALLOWED. Consult the EU catalog
> (catalog/10-arte-decoracion.md and catalog/01-camisetas.md) for
> providers, costs, and margins before creating.

### Priority Tiers (aligned with EU Catalog)

| Tier | Products | Margin Target | Catalog Source |
|------|----------|--------------|----------------|
| **1 — Launch first** | T-shirts DTG, Mugs, Tote Bags, Stickers | 45-65% | catalog/01, 05, 09 |
| **2 — Core catalog** | Hoodies, Canvas/Posters, Phone Cases | 40-55% | catalog/02, 10 |
| **3 — Premium** | Embroidery, Caps, Bottles/Tumblers | 50-65% | catalog/03, 04, 06 |
| **4 — Specialty** | AOP apparel, Candles, Pajamas, Blankets | 40-55% | catalog/07, 08, 11 |

### Aspect Ratio Quick Reference

Only 3 aspect ratios cover ALL high-value products:
- **1:1** → Mugs (single side), tote bags, stickers, throw pillows
- **3:4** → T-shirts, hoodies, canvas prints, posters
- **9:16** → Phone cases
- **Full coverage** → AOP apparel, blankets, tapestries

### Dimension Validation (for Cataloger)

Before creating a product, validate design aspect ratio vs product:
- 1:1 design → mugs, totes, stickers, pillows. NOT t-shirts or phone cases
- 3:4 design → t-shirts, hoodies, canvas, posters. Acceptable for mugs (crop center)
- 9:16 design → phone cases only
- Full coverage → AOP t-shirts, AOP hoodies, blankets, tapestries
If mismatch → SKIP that design-product combination.

---

## Design Positioning Guide

### Centered Artwork (most products)
- Design sits in the CENTER of the print area
- Leave ~0.5" margin from all edges (safe zone)
- Works for: T-shirts, hoodies, canvas, posters, phone cases

### Wrap-Around (mugs, AOP)
- Design tiles seamlessly OR spans the full wrap area
- Important: left and right edges must MEET when wrapped
- Works for: Mugs, AOP t-shirts, AOP tote bags

### Tile/Pattern (blankets, AOP, pillows)
- Design repeats seamlessly in all directions
- Test by placing 4 copies in a 2x2 grid — edges should be invisible
- Works for: Blankets, throw pillows, AOP apparel

---

## Resolution Guidelines

| Quality Level | DPI | Use Case |
|---|---|---|
| Minimum | 150 DPI | Small products (stickers, phone cases) |
| Standard | 300 DPI | Most products (apparel, mugs, accessories) |
| High | 300+ DPI | Large format (posters, canvas, blankets) |

**Rule of thumb**: `pixel width = print_width_inches x 300`

All AI-generated images at 2048x2048px meet the 300 DPI requirement for:
- Stickers, phone cases, mugs (single side), small canvas
- T-shirts and hoodies (when centered, not edge-to-edge)

For larger products (posters 24x36", blankets), consider upscaling or
generating at higher resolution when available.

---

## Product Type Selection by Design Style

| Design Style | Best Products | Avoid |
|---|---|---|
| Vector illustration | T-shirts, stickers, mugs, phone cases | Blankets (too small at standard res) |
| Watercolor / artistic | Canvas, posters, throw pillows, tote bags | Stickers (detail lost at small size) |
| Bold graphic / text | T-shirts, hoodies, stickers | Canvas art (text feels cheap) |
| Pattern / seamless | AOP apparel, blankets, pillows, mugs (wrap) | Single-placement apparel |
| Photography-based | Canvas, posters, phone cases | Stickers, small items |
| Minimalist / line art | T-shirts, mugs, stickers, canvas | AOP (too sparse) |
| Dark background | Hoodies, dark t-shirts, canvas, posters | White mugs (background mismatch) |
| Retro / vintage | T-shirts, tote bags, mugs, stickers | Formal canvas (style mismatch) |
| ANY style | See Product Priorities above | Bumper stickers (restricted) |

---

## Print Techniques

| Technique | Products | Pros | Cons |
|---|---|---|---|
| DTG (Direct to Garment) | T-shirts, hoodies | Photo-quality, unlimited colors | Slower, higher cost |
| Sublimation | Mugs, AOP, phone cases, pillows | Vibrant, durable, full coverage | Polyester/white base only |
| Screen Print Transfer | T-shirts (bulk) | Cost-effective at scale | Limited colors, setup cost |
| UV Print | Phone cases, stickers | Sharp, scratch-resistant | Small area only |
| Dye Sublimation | Blankets, flags | Full coverage, soft feel | White/light base required |

---

---

## Catalog Reference

For EU product pricing, providers, and margin targets, consult the catalog:
- **Quick overview**: `catalog/INDEX.md`
- **Full pricing table**: `catalog/PRICING-MODEL.md`
- **Per-category details**: `catalog/01-*.md` through `catalog/11-*.md`

The catalog is the AUTHORITATIVE source for pricing and product availability.
This file (product_specs.md) provides print area specs and design guidelines.

*Reference for Designer and Cataloger agents. Updated 2026-02-17.*
