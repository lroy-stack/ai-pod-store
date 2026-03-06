# SKAPARA Brand Assets Audit — 2026-03-04

## Estado Actual

El wordmark fue rediseñado (Montserrat ExtraBold + potrace) para corregir la S y A cortadas.
Los SVG maestros en `public/brand/` ya están actualizados.

**Fuente del wordmark**: Montserrat ExtraBold, compresión horizontal ~1.19x por letra, tracking variable.
**Herramienta**: Bitmap 4000px → potrace → SVG paths limpios.

---

## 1. SVGs Maestros (YA ACTUALIZADOS)

| Archivo | Variante | Estado |
|---------|----------|--------|
| `brand/skapara-wordmark-dark.svg` | Negro (#000000) | NUEVO |
| `brand/skapara-wordmark-white.svg` | Blanco (#FFFFFF) | NUEVO |
| `brand/skapara-mark-color.svg` | S mark gradiente | Sin cambios |
| `brand/skapara-mark-dark.svg` | S mark negro | Sin cambios |
| `brand/skapara-mark-white.svg` | S mark blanco | Sin cambios |

---

## 2. SVGs con WORDMARK PATHS ANTIGUOS (necesitan actualización)

Estos archivos contienen los paths PostScript originales (`M870 2310`) con la S cortada:

| Archivo | Uso | Prioridad |
|---------|-----|-----------|
| `brand-designs/new-wave/sleeve-skapara-multicolor.svg` | Sleeve branding multicolor | ALTA |
| `brand-designs/origin-embroidery/chest-center.svg` | Bordado pecho centro | ALTA |
| `brand-designs/trendi/back.svg` | Back branding Trendi | ALTA |
| `brand-designs/trendi/back copy.svg` | Copia backup | BAJA |
| `brand-designs/trendi/front.svg` | Front branding Trendi | ALTA |
| `hat-designs/flux-bucket/label-outside.svg` | Label exterior bucket hat | ALTA |
| `hat-designs/flux-bucket/outside-front.svg` | Frente exterior bucket hat | ALTA |
| `phase2-production/branding/back-wordmark-bp731.svg` | Back wordmark fase 2 | ALTA |
| `index.html` | Coming soon (referencia, no paths inline) | BAJA |

**Total SVGs a actualizar: 7 archivos con paths embebidos**

---

## 3. PNGs de Wordmark (necesitan re-render desde nuevo SVG)

Estos PNGs fueron renderizados desde el SVG antiguo y contienen el wordmark con S cortada:

| Archivo | Tamaño | Uso |
|---------|--------|-----|
| `printful-designs/back-wordmark-white.png` | Back print Printful | ALTA — subido a Printful |
| `phase1-production/branding/skapara-wordmark-white.png` | Back branding fase 1 | ALTA |
| `phase1-production/branding/printful-ready/back-wordmark-1800x2400.png` | Back print 1800x2400 | ALTA |
| `phase1-production/branding/printful-ready/back-wordmark-1800x2400-v2.png` | Back print v2 | ALTA |
| `kids-designs/branding-back-wordmark-white.png` | Kids back white | ALTA |
| `kids-designs/branding-back-wordmark-dark.png` | Kids back dark | ALTA |
| `expansion-designs/assets/skapara-wordmark-white.png` | Expansion assets | MEDIA |

**Total PNGs wordmark a re-renderizar: 7 archivos**

---

## 4. PNGs de S Mark (verificar si están afectados)

El S mark (`skapara-mark-*.svg`) NO fue modificado, pero estos PNGs derivados deben verificarse:

| Archivo | Uso |
|---------|-----|
| `brand/logo-mark-dark.png` | Logo mark para UI |
| `brand/logo-mark-white.png` | Logo mark para UI |
| `phase1-production/branding/skapara-mark-white-hires.png` | Chest/sleeve print |
| `expansion-designs/assets/skapara-mark-white-hires.png` | Expansion |
| `expansion-designs/previews/smark-test-dark.png` | Test preview |
| `kids-designs/branding-back-smark-dark.png` | Kids S mark dark |
| `kids-designs/branding-back-smark-white.png` | Kids S mark white |
| `kids-designs/branding-neck-smark-gradient.png` | Kids neck gradient |
| `printful-designs/label-outside-smark-white-hires.png` | Label outside |
| `printful-designs/label-outside-smark-white.png` | Label outside |
| `kids-designs/branding-back-lockup-dark.png` | Lockup (mark+wordmark) |
| `kids-designs/branding-back-lockup-white.png` | Lockup (mark+wordmark) |

**Total PNGs S mark: 12 archivos (verificar lockups que combinan mark+wordmark)**

---

## 5. Código TypeScript que referencia brand assets

| Archivo | Línea | Referencia |
|---------|-------|------------|
| `src/lib/store-config.ts` | 6-7 | `logoLight`, `logoDark` → S mark SVGs |
| `src/lib/brand-config-server.ts` | 31-32 | `logoLightUrl`, `logoDarkUrl` → S mark SVGs |
| `src/components/ui/brand-mark.tsx` | 26 | Fallback a `/brand/skapara-mark-*.svg` |
| `src/lib/mockup-generator.ts` | 103 | `<text>SKAPARA</text>` watermark (texto, no SVG) |
| `src/lib/mockup-backgrounds.ts` | 43 | `<text>SKAPARA</text>` brand mark (texto, no SVG) |

**Nota**: El código TS referencia los S mark SVGs (no modificados), no los wordmarks directamente.

---

## 6. Scripts que usan brand assets

| Script | Asset |
|--------|-------|
| `scripts/generate-fleece-designs.mjs` | `skapara-wordmark-dark.svg` (lee paths) |
| `scripts/create-branded-products.mjs` | `skapara-wordmark-dark.svg`, marks |
| `scripts/_fix-branded-v2.mjs` | `skapara-wordmark-dark.svg`, marks |
| `scripts/_fix-branded-v3.mjs` | marks only |
| `scripts/_convert-branding-pngs.mjs` | Convierte SVGs → PNGs |
| `scripts/generate-zip-hoodie-designs.mjs` | `skapara-mark-white.svg` |
| `scripts/create-phase1-products.mjs` | PNGs de wordmark + smark |
| `scripts/create-phase1-diverse.mjs` | `skapara-wordmark-white.png` |
| `scripts/migrate-phase1-01-render-designs.mjs` | SVGs → PNGs render |
| `scripts/migrate-phase1-02-upload-designs.mjs` | Upload `back-wordmark-white` |

---

## 7. Printful — Assets subidos remotamente

Estos assets están **subidos a Printful** y necesitan re-upload con el wordmark corregido:

| Printful Key | File ID | Posición | Prioridad |
|-------------|---------|----------|-----------|
| `back-wordmark-white` | 950267989 | back | CRITICA |

---

## Plan de Sustitución (siguiente sesión)

### Paso 1: Re-renderizar PNGs desde nuevo SVG
```bash
# Usar _convert-branding-pngs.mjs o cairosvg para generar:
# - back-wordmark-white.png (1800x2400)
# - back-wordmark-dark.png (1800x2400)
# - skapara-wordmark-white.png (4120x448)
```

### Paso 2: Actualizar SVGs con paths embebidos
Reemplazar `M870 2310 c-156 -12...` con los nuevos paths potrace en:
- 7 SVGs listados en sección 2

### Paso 3: Re-renderizar lockup PNGs
Los lockups (kids-designs) combinan S mark + wordmark. Re-render con nuevo wordmark.

### Paso 4: Re-upload a Printful
```bash
# Upload nuevo back-wordmark-white.png a Printful
# Actualizar file ID en productos existentes
```

### Paso 5: Verificar
- Abrir cada SVG en navegador
- Verificar que la S y A se renderizan completas
- Comparar PNGs antiguos vs nuevos
