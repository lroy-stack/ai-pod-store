# SASU024 Variant Reference — Stanley/Stella SASU024 (Catalog 831)

Complete variant table for the Stanley/Stella SASU024 PREMIUM ECO organic relaxed hoodie blank on Printful.

---

## Summary

| Property | Value |
|---|---|
| **Catalog ID** | 831 |
| **Total Colors** | 4 |
| **Total Sizes** | 5 (S through 2XL) |
| **Total Variants** | 20 (4 colors x 5 sizes) |
| **Dark (always use)** | 2 colors (L < 50) |
| **Light/Disabled** | 2 colors (L >= 200) |
| **EU Available** | 4/4 (100%) |
| **Sizing Note** | US sizes shown — European customers should order a size DOWN |

---

## DARK Colors (ALWAYS USE)

Estos 2 colores tienen el contraste mas profundo (L < 50) y deben **SIEMPRE incluirse** en cada producto SASU024. Texto blanco y ghost text son maximamente visibles.

### Black `#121212` — L=18

| Size | Catalog Variant ID |
|---|---|
| S | 21149 |
| M | 21153 |
| L | 21157 |
| XL | 21161 |
| 2XL | 21165 |

### French Navy `#071429` — L=20

| Size | Catalog Variant ID |
|---|---|
| S | 21150 |
| M | 21154 |
| L | 21158 |
| XL | 21162 |
| 2XL | 21166 |

---

## LIGHT Colors (DISABLED — DO NOT USE FOR WHITE TEXT DESIGNS)

Texto blanco es invisible o de bajo contraste en estos colores. Deshabilitados por defecto para todos los productos SKAPARA con disenos de texto blanco/ghost. Ambos son EU-available.

### Heather Grey `#e5e5e1` — L=229 — EU: YES

| Size | Catalog Variant ID |
|---|---|
| S | 21151 |
| M | 21155 |
| L | 21159 |
| XL | 21163 |
| 2XL | 21167 |

### White `#ffffff` — L=255 — EU: YES

| Size | Catalog Variant ID |
|---|---|
| S | 21152 |
| M | 21156 |
| L | 21160 |
| XL | 21164 |
| 2XL | 21168 |

---

## Quick-Reference: Dark Variant IDs

Para copiar-pegar en API calls y scripts:

### Black (all sizes)
```
21149, 21153, 21157, 21161, 21165
```

### French Navy (all sizes)
```
21150, 21154, 21158, 21162, 21166
```

### All 10 dark variant IDs (flat array)
```
21149, 21153, 21157, 21161, 21165,
21150, 21154, 21158, 21162, 21166
```

---

## Quick-Reference: Light/Disabled Variant IDs

### Heather Grey (all sizes)
```
21151, 21155, 21159, 21163, 21167
```

### White (all sizes)
```
21152, 21156, 21160, 21164, 21168
```

### All 10 light/disabled variant IDs (flat array)
```
21151, 21155, 21159, 21163, 21167,
21152, 21156, 21160, 21164, 21168
```

---

## All 20 Variant IDs (flat array, complete)

```
21149, 21153, 21157, 21161, 21165,
21150, 21154, 21158, 21162, 21166,
21151, 21155, 21159, 21163, 21167,
21152, 21156, 21160, 21164, 21168
```

---

## Base Costs by Size (DTG)

| Size | Base Cost |
|---|---|
| S | $45.89 |
| M | $45.89 |
| L | $45.89 |
| XL | $45.89 |
| 2XL | $47.89 |

**Nota:** El front placement cuesta $5.95 extra (no viene incluido como en otros blanks). El base cost total con front = $51.84 (S-XL) / $53.84 (2XL).

### Placement Costs (DTG, acumulativos)

| Placement | Cost |
|---|---|
| front | +$5.95 |
| back | +$5.95 |
| back_large | +$5.95 |
| sleeve_left | +$5.95 |
| sleeve_right | +$5.95 |
| label_inside | +$0.99 |
| label_outside | +$2.49 |

---

## Variant ID to Color Slug Mapping

Usado para file naming de mockups y paths de Supabase Storage:

| Color | Slug | First Variant ID (S) | Luminance | EU | Status |
|---|---|---|---|---|---|
| Black | `black` | 21149 | 18 | YES | ACTIVE |
| French Navy | `french-navy` | 21150 | 20 | YES | ACTIVE |
| Heather Grey | `heather-grey` | 21151 | 229 | YES | DISABLED |
| White | `white` | 21152 | 255 | YES | DISABLED |

---

## Comparison: SASU024 vs M2580 vs MC1087

| Property | SASU024 (PREMIUM ECO Hoodie) | M2580 (PREMIUM Hoodie) | MC1087 (PREMIUM Tee) |
|---|---|---|---|
| Catalog ID | 831 | 380 | 917 |
| Brand | Stanley/Stella | Cotton Heritage | Cotton Heritage |
| Product type | Relaxed Organic Hoodie | Pullover Hoodie | T-Shirt |
| Total colors | 4 | 23 | 5 |
| Dark colors | 2 (Black, French Navy) | 9 (Black, Navy Blazer + 7 extended) | 3 (Black, Navy Blazer, Vintage Black) |
| Sizes | S-2XL (5) | S-3XL (6) | S-4XL (7) |
| Front canvas | **1875x1875** (square) | 1800x1800 (square) | 1800x2400 (portrait) |
| Back canvas | 1800x2400 | 1800x2400 | 1800x2400 |
| `back_large` | **YES** (2250x2700) | No | No |
| Sleeve canvas | 450x1800 (vertical) | 450x1800 (vertical) | 600x525 (landscape) |
| `label_inside` | 600x600 / 300 DPI | 750x750 / 300 DPI | 450x450 / 150 DPI |
| Base cost S-XL | $45.89 | $22.55 | $14.75 |
| Material | 100% organic cotton (GOTS) | 100% cotton face / 65/35 blend | 100% combed ring-spun cotton |
| Fit | Relaxed | Classic streetwear | Boxy / structured |
| Sizing | Runs large (order DOWN) | Runs small (order UP) | Standard |
| EU fulfillment | Latvia | Latvia | Latvia |
| Certifications | GOTS, OCS, OEKO-TEX, PETA Vegan | OEKO-TEX | OEKO-TEX |

**NOTA CRITICA:** Sleeves (450x1800) son compatibles entre SASU024, M2580, y M2480 — se puede reutilizar el mismo archivo de branding de sleeve. Pero `label_inside` tiene diferentes dimensiones en cada blank — NO reutilizar.
