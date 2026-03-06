# iPhone Snap Case Variant Catalog — Complete Reference

iPhone Snap Case (Catalog ID 683) — **2 finishes (Glossy + Matte), 12 modelos iPhone (15-17), 24 variantes totales.**

Datos de la API v2 verificados. Producido en Printful Latvia (Riga) — EU fulfillment confirmado.

---

## EU Fulfillment Status

> **CONFIRMED**: iPhone Snap Cases se producen in-house en la planta de Printful en Riga, Latvia. Cumplimiento EU garantizado.

---

## All Variants (12 models x 2 finishes = 24 total)

### Glossy Finish (12 variants)

| # | Model | Variant ID | Finish | Base Cost (EUR) | Recommended Retail | Margin | EU |
|---|---|---|---|---|---|---|---|
| 1 | iPhone 15 | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 2 | iPhone 15 Plus | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 3 | iPhone 15 Pro | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 4 | iPhone 15 Pro Max | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 5 | iPhone 16 | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 6 | iPhone 16 Plus | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 7 | iPhone 16 Pro | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 8 | iPhone 16 Pro Max | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 9 | iPhone 17 | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 10 | iPhone 17 Air | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 11 | iPhone 17 Pro | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |
| 12 | iPhone 17 Pro Max | TBD* | Glossy | 14.25 | 24.99 | 43.0% | YES |

### Matte Finish (12 variants)

| # | Model | Variant ID | Finish | Base Cost (EUR) | Recommended Retail | Margin | EU |
|---|---|---|---|---|---|---|---|
| 13 | iPhone 15 | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 14 | iPhone 15 Plus | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 15 | iPhone 15 Pro | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 16 | iPhone 15 Pro Max | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 17 | iPhone 16 | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 18 | iPhone 16 Plus | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 19 | iPhone 16 Pro | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 20 | iPhone 16 Pro Max | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 21 | iPhone 17 | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 22 | iPhone 17 Air | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 23 | iPhone 17 Pro | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |
| 24 | iPhone 17 Pro Max | TBD* | Matte | 14.25 | 24.99 | 43.0% | YES |

> **\*TBD — Variant IDs**: Individual per-model variant IDs were not returned in the bulk catalog query. They MUST be resolved before product creation via:
> ```bash
> curl -s "https://api.printful.com/v2/catalog-products/683/catalog-variants" \
>   -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
>   -H "User-Agent: POD-AI-Store/1.0"
> ```
> This will return the full variant list with IDs mapped to each iPhone model. Filter for iPhone 15-17 models only.

---

## Variant Resolution Script

Run this BEFORE creating any product to populate variant IDs:

```bash
# Fetch all variants for CAT 683, filter for iPhone 15-17
curl -s "https://api.printful.com/v2/catalog-products/683/catalog-variants" \
  -H "Authorization: Bearer ${PRINTFUL_API_TOKEN}" \
  -H "User-Agent: POD-AI-Store/1.0" | jq '.data[] | select(.name | test("iPhone 1[567]")) | {id: .id, name: .name, size: .size}'
```

Expected output format:
```json
{ "id": XXXXX, "name": "iPhone 15 - Glossy", "size": "iPhone 15" }
{ "id": XXXXX, "name": "iPhone 15 - Matte", "size": "iPhone 15" }
{ "id": XXXXX, "name": "iPhone 15 Plus - Glossy", "size": "iPhone 15 Plus" }
{ "id": XXXXX, "name": "iPhone 15 Plus - Matte", "size": "iPhone 15 Plus" }
...
```

**IMPORTANT:** Once resolved, update this VARIANTS.md with the actual IDs for permanent reference.

---

## Model Details

### iPhone 15 Series (4 models)

| Model | Screen | Year | Camera Config | Notes |
|---|---|---|---|---|
| iPhone 15 | 6.1" | 2023 | Dual rear | USB-C, Dynamic Island |
| iPhone 15 Plus | 6.7" | 2023 | Dual rear | Large non-pro |
| iPhone 15 Pro | 6.1" | 2023 | Triple rear + LiDAR | Titanium frame |
| iPhone 15 Pro Max | 6.7" | 2023 | Triple rear + LiDAR | Largest 15-gen |

### iPhone 16 Series (4 models)

| Model | Screen | Year | Camera Config | Notes |
|---|---|---|---|---|
| iPhone 16 | 6.1" | 2024 | Dual rear | Camera Control button |
| iPhone 16 Plus | 6.7" | 2024 | Dual rear | Large non-pro |
| iPhone 16 Pro | 6.3" | 2024 | Triple rear + LiDAR | Titanium, A18 Pro |
| iPhone 16 Pro Max | 6.9" | 2024 | Triple rear + LiDAR | Largest 16-gen |

### iPhone 17 Series (4 models)

| Model | Screen | Year | Camera Config | Notes |
|---|---|---|---|---|
| iPhone 17 | 6.1" | 2025 | Dual rear | A19 chip |
| iPhone 17 Air | 6.6" | 2025 | Single rear | Ultra-thin, new form factor |
| iPhone 17 Pro | 6.3" | 2025 | Triple rear + LiDAR | A19 Pro |
| iPhone 17 Pro Max | 6.9" | 2025 | Triple rear + LiDAR | Largest 17-gen |

---

## Design Compatibility

Since all models use the same printfile (PF#438), design compatibility is uniform:

| Design Style | Compatibility | Notes |
|---|---|---|
| Full-bleed artwork | Excellent | Fill mode `cover` ensures complete coverage |
| Pattern/repeat | Excellent | Seamless patterns work perfectly |
| Photo/portrait | Good | Keep subject centered — edges may crop per model |
| Typography | Good | Keep text in safe zone (100px inset) |
| Minimal/centered | Excellent | Centered elements safe across all models |
| SKAPARA ghost text | Good | Position in center, avoid camera zone |
| Logo-centric | Excellent | Center logo, brand mark in lower third |

### Camera Cutout Zones (approximate)

Different models have different camera module positions. The upper-left quadrant is the highest-risk area:

```
+---------------------------+
| [!] CAMERA ZONE           |
| (upper-left ~300x400px)   |
|                           |
|      SAFE AREA            |
|                           |
|                           |
+---------------------------+
```

**Conservative approach:** Avoid placing any critical design elements in the top 400px of the design. This covers all camera module positions across all 12 models.

---

## Printfile Specifications

| Placement | Printfile ID | Canvas Width | Canvas Height | DPI | Physical Width | Physical Height | Fill Mode |
|---|---|---|---|---|---|---|---|
| default | PF#438 | 1328 px | 2197 px | 300 | 4.43" | 7.32" | cover |

### Canvas Layout Guide

```
+-------- 1328px total --------+
|                               |
| 100px   CAMERA AVOIDANCE     | 100px
| inset   ZONE (~300x400px)    | inset
|         upper-left           |
|                               |
|    +-------------------+      |
|    |                   |      |
|    | SAFE AREA         |      |
|    | 1128 x 1597 px    |      |
|    | (recommended)     |      |
|    |                   |      |
|    |                   |      |
|    +-------------------+      |
|                               |
|    SKAPARA BRAND ZONE         |
|    (lower third, ~600px h)    |
|                               |
+-------------------------------+

Total height: 2197px
```

---

## Pricing Tiers

Two finishes, single placement — straightforward pricing (same base cost for Glossy and Matte):

| Tier | Retail (EUR) | Base Cost | Margin | When to Use |
|---|---|---|---|---|
| Standard | 22.99 | 14.25 | 38.0% | Minimum viable |
| Recommended | 24.99 | 14.25 | 43.0% | Default for most SKAPARA designs |
| Premium | 27.99 | 14.25 | 49.1% | Complex art, photo cases |
| Collector | 29.99 | 14.25 | 52.5% | Limited runs, collab designs |

**CRITICAL:** The cron sync margin fixer overwrites prices if margin <35%. At a base cost of 14.25 EUR, the absolute minimum retail is 21.93 EUR. Always use 22.99+ to stay safe.

---

## Finish Comparison

| Property | Glossy | Matte |
|---|---|---|
| Surface | Smooth, reflective | Soft, non-reflective |
| Color saturation | High — vibrant, punchy | Slightly muted — understated |
| Blacks | Deep, glossy | Rich, non-reflective |
| Fingerprints | Visible | Resistant |
| Premium feel | Classic | Modern/premium |
| Design notes | Metallic/sheen effects work well | Avoid glossy-dependent visuals; flat colors and bold graphics preferred |

**Matte finish available — design should avoid glossy-dependent visual effects if targeting Matte variant.**

---

## Totals

| Property | Value |
|---|---|
| Finishes | 2 (Glossy + Matte) |
| Models | 12 iPhone models (iPhone 15 - 17 Pro Max) |
| Total Variants | 24 (12 models x 2 finishes) |
| Base Cost (all) | 14.25 EUR flat |
| EU Availability | YES (Latvia, in-house) |
| Placement | 1 (default) |
| Printfile | PF#438 (1328x2197 @300dpi) |
