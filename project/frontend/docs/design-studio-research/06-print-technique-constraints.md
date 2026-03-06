# Restricciones de Diseno por Tecnica de Impresion — Guia Tecnica para Editor Inteligente POD

**Fuentes verificadas**: Printify Help Center, Printful official docs, Kornit Digital, Coastal Business, T-Shirt Forums, Printful Academy.

---

## 1. DTG — Direct-to-Garment

### Como funciona
La impresora inyecta tintas acuosas CMYK (mas blanco para fondos oscuros) directamente sobre la tela.

### Capacidades

- **Colores**: Sin limite. 16 millones, fotos fotorrealistas posibles.
- **Gradientes solidos** (color a color): Completamente soportados.
- **Gradientes con transparencia (fade-to-transparent)**: En prendas oscuras, la underbase blanca genera un halo. Solucion: usar halftones.
- **Fotos**: Totalmente soportadas en cotton 100%.

### Telas y resultado

| Tela | Resultado |
|---|---|
| 100% algodon (tight weave) | Optimo. Colores vibrantes. |
| 50/50 Cotton-Polyester | Aceptable. Aspecto "vintage" leve. |
| Tri-blend | Resultado "faded/vintage" notable. |
| 100% Poliester | Problematico. Usar DTF o Sublimacion. |
| Ribbed/canaletas | Huecos en movimiento. Evitar. |

### Colores de prenda

- **Clara**: Sin underbase. Colores tal cual.
- **Oscura**: Pretreatment + underbase blanca + CMYK. Cuesta mas, ligeramente menos vibrante.

### Areas de impresion (P26)

| Posicion | Medida tipica |
|---|---|
| Front chest (adulto) | ~30 x 40 cm (12" x 16") |
| Back | Similar al front |
| Sleeve | ~7.5 x 7.5 cm |
| Left chest (logo) | ~10 x 10 cm |
| Neck inside | ~4 x 4 cm |

### Limites tecnicos

- **DPI minimo**: 150 DPI aceptable, 300 DPI recomendado, >300 DPI sin ganancia visible.
- **Lineas finas**: Min 2px a 300 DPI (~0.17mm). Ideal 4px+.
- **Durabilidad**: 50-100 lavados con cuidados correctos.

---

## 2. Bordado (Embroidery)

### Restricciones absolutas

- **NO gradientes**: Hilo no mezcla colores.
- **NO fotos**: Demasiados colores.
- **NO transparencias**: Todo 100% opaco.
- **NO paths abiertos**: SVG debe usar paths cerrados (terminados en `Z`).

### Limites de colores

- **Estandar (P410)**: Hasta 6 colores de paleta fija de 15. SKAPARA usa max 3 (idealmente 2).
- **Unlimited Color (Coloreel)**: CMYK en tiempo real, gradientes posibles. Min 2cm ancho, NO neon ni metalico.

### Tipos de puntada

| Tipo | Cuando usar | Ancho minimo |
|---|---|---|
| Running stitch | Contornos finos, lineas | < 1.3mm |
| Satin stitch | Texto, bordes (2-12mm ancho) | 1.5mm |
| Fill stitch (tatami) | Areas grandes (> 12mm) | Cualquier tamano |

### Limites de detalle minimos

| Elemento | Minimo absoluto | Recomendado |
|---|---|---|
| Ancho de linea | 1.5mm | 2mm |
| Alto de texto | 5mm | 7mm+ |
| Detalle general | 2mm | 3mm+ |
| Espaciado letras | 0.5mm | 1mm |

### 3D Puff (relieve)

- Solo en frente de gorras estructuradas.
- NO en lados (se deforma).
- Solo fill/satin stitch grueso.
- Mas simple y grande que flat.

### Distorsion en curvas

- Gorras: curvatura deforma lineas rectas.
- Sides: curva doble — disenos mas simples.

---

## 3. Sublimacion / All-Over Print (AOP)

### Restriccion fundamental

**Solo funciona en poliester blanco o muy claro.** Tintas traslucidas, no se puede imprimir blanco.

### Capacidades

- Colores ilimitados, calidad fotografica, gradientes perfectos.
- **NO hay blanco**: el blanco es la tela.
- **Negro** puede verse como charcoal.

### Safe zone vs Bleed

- **Safe zone**: Area interior para elementos criticos.
- **Bleed**: Extension del diseno mas alla (1-3 cm).
- Costuras interrumpen el diseno en AOP.

---

## 4. DTF — Direct-to-Film

### Ventajas sobre DTG

1. Funciona en **cualquier tela**.
2. Prendas oscuras sin underbase separada.
3. Sin pretreatment.

### Limitaciones

- **Tacto elevado** (se siente el transfer).
- **Borde visible** donde termina el film.
- **Min detalle**: 6.35mm (0.25") para elementos aislados.
- Durabilidad: 50-100 lavados.

---

## 5. UV Print

- Funciona en superficies rigidas (fundas, botellas, acrilicos).
- Colores ilimitados + **blanco opaco real**.
- Gradientes y fotos soportados.
- Alta resistencia (rayones, agua, UV exterior).

---

## 6. Tabla Resumen para el Editor

| Tecnica | Gradientes | Fotos | Max colores | Min detalle | Transparencia | Full-bleed |
|---|---|---|---|---|---|---|
| **DTG** | Si | Si | Ilimitados | ~0.17mm | Si (halo en oscuro) | No |
| **Embroidery std** | NO | NO | 6 (de 15) | 1.5mm | NO | No |
| **Embroidery unlimited** | Si (>2cm) | No | Ilimitados (sin neon) | 2cm | NO | No |
| **Sublimacion/AOP** | Si | Si | Ilimitados (sin blanco) | 1px@150DPI | Si (=prenda) | Si |
| **DTF** | Si | Si | Ilimitados | 6.35mm | Si (borde visible) | No |
| **UV** | Si | Si | Ilimitados + blanco | ~0.5mm | Si | Limitado |

---

## 7. Comportamiento del Editor por Tecnica

### DTG
- **Warnings**: Transparencias + prenda oscura = halo blanco. DPI < 150. Poliester alto.
- **Preview**: Simular underbase en prendas oscuras.

### Embroidery (standard)
- **Deshabilitar**: Gradientes, transparencias, sombras, filtros. Paleta libre -> 15 hilos.
- **Warnings**: Elemento < 1.5mm, texto < 5mm, foto subida, > 6 colores.

### Sublimacion/AOP
- **Deshabilitar**: Prendas oscuras, algodon puro.
- **Warnings**: Blanco en diseno = sin tinta. Elementos fuera del safe zone.

### DTF
- **Warnings**: Elementos aislados < 6mm. Borde de film visible.

---

## 8. Transformaciones Automaticas del Editor

| Problema | Tecnica | Transformacion |
|---|---|---|
| Transparencias en oscuro | DTG | Convertir a halftones |
| Demasiados colores | Embroidery | Quantizacion a 6 colores |
| Foto en embroidery | Embroidery | Posterizacion + vectorizacion |
| Texto < 5mm | Embroidery | Aumentar al minimo |
| DPI bajo | Todos | Rechazar, pedir re-subida |
| Fuera del safe zone | Sublimacion | Mover o preview con corte |

---

## 9. Mapeo Producto -> Tecnica

| Categoria | Tecnica | Proveedor |
|---|---|---|
| Camisetas | DTG | P26 |
| Hoodies pullover | DTG | P26 |
| Crewnecks | DTG | P26 |
| Gorras estructuradas | Embroidery | P410 |
| Snapbacks | Embroidery | P410 |
| Dad hats | Embroidery | P410 |
| Beanies | Embroidery | P410 |
| Bucket hats | Embroidery | P410 |
| Hoodies bordadas | Embroidery | P410 |
| Mugs | Sublimacion | P26 |
| Botellas SS | Sublimacion | P23 |
| Tumblers | Sublimacion | P410/P86 |
| AOP bags/backpacks | AOP (sublimacion) | P410 |
| Gorras DTFilm | DTFilm | P410 |

---

## Sources

- [DTG printing guide - Printify](https://printify.com/blog/direct-to-garment-printing-cheat-code/)
- [Gradients for DTG - Printify Help](https://help.printify.com/hc/en-us/articles/4483625121681)
- [Transparency in DTG - Printful](https://www.printful.com/transparency-in-dtg-files)
- [Embroidery guide - Printify](https://printify.com/guide/embroidery-guide/)
- [Standard vs Unlimited Color Embroidery - Printful](https://www.printful.com/academy/lessons/standard-embroidery-vs-unlimited-color-embroidery)
- [What is AOP - Printful](https://help.printful.com/hc/en-us/articles/21045992765468)
- [DTG vs DTF - Printful](https://www.printful.com/blog/dtg-vs-dtf-printing)
- [Mastering Halftones - Printed Mint](https://printedmint.com/blog/drop-shipping-business-tips-5/mastering-halftones-simulating-transparency-in-dtf-t-shirt-printing-985)
