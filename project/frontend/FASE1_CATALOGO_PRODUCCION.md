# FASE 1 — Catalogo de Produccion (20 Productos)

> Estado: LISTO PARA CREAR
> Fecha: 2026-03-01
> Todos los disenos ya creados en `public/expansion-designs/`

---

## REGLAS GENERALES

1. **Solo colores oscuros** — disenos en blanco/claro sobre transparente
2. **Precio T-Shirt**: 2995 cents (29.95 EUR) — margen >50%
3. **Precio Crewneck**: 4495 cents (44.95 EUR)
4. **GPSR obligatorio** antes de publish
5. **Logo-mark-white** = S mark SKAPARA (blanco, para pecho delantero)
6. **Wordmark-white** = "SKAPARA" texto (para espalda branding)
7. **Neck label** = S mark en 1181x1181 canvas (para neck_outer en BP6)

---

## POSICIONES POR BLUEPRINT

| BP | front | back | sleeves | neck_outer | neck |
|---|---|---|---|---|---|
| BP6 T-Shirt | 4606x5787 | 4606x5787 | 1181x1181 | 1181x1181 | 1063x1063 |
| BP49 Crewneck | 3319x3761 | 3319x3761 | — | — | 750x750 |

---

## COLORES HABILITADOS (Solo oscuros)

### BP6 — 9 colores x 6 tallas (S-3XL) = 51 variantes

| Color | S | M | L | XL | 2XL | 3XL |
|---|---|---|---|---|---|---|
| Black | 12126 | 12125 | 12124 | 12127 | 12128 | 12129 |
| Navy | 11988 | 11987 | 11986 | 11989 | 11990 | 11991 |
| Dark Heather | 11904 | 11903 | 11902 | 11905 | 11906 | — |
| Charcoal | 11874 | 11873 | 11872 | 11875 | 11876 | — |
| Maroon | 11976 | 11975 | 11974 | 11977 | 11978 | 11979 |
| Forest Green | 12144 | 12143 | 12142 | 12145 | 12146 | — |
| Military Green | 12192 | 12191 | 12190 | 12193 | 12194 | 12195 |
| Dark Chocolate | 11898 | 11897 | 11896 | 11899 | 11900 | 11901 |
| Purple | 12018 | 12017 | 12016 | 12019 | 12020 | 12021 |

---

## ESTRATEGIA DE COLOCACION

### DISEÑO EN ESPALDA (5 productos)
> Diseños con frases de impacto que se leen al caminar.
> Front: S mark (logo-mark-white) en pecho izquierdo (x:0.28, y:0.22, scale:0.3)
> Back: diseño principal (x:0.5, y:0.45, scale:1)
> Neck_outer: S mark SKAPARA (x:0.5, y:0.5, scale:0.8)

| ID | Diseño | Razon espalda |
|---|---|---|
| G01 | "NOPE." | Una palabra. Maximo impacto al caminar |
| A03 | "Hang In There / It Gets Worse" | Statement bold, se lee detras |
| D01 | "Regulate Your Nervous System" | Texto vertical largo, llena la espalda |
| E05 | "Main Character Energy" | Actitud, vibes al caminar |
| H02 | "Made on Demand" | Brand statement etico |

### DISEÑO EN FRONTAL (14 productos)
> Diseños conversacionales, interactivos o con iconos que necesitan verse de frente.
> Front: diseño principal (x:0.5, y:0.45, scale:1)
> Back: wordmark SKAPARA pequeño arriba (x:0.5, y:0.15, scale:0.25)
> Neck_outer: S mark SKAPARA (x:0.5, y:0.5, scale:0.8)

| ID | Diseño | Razon frontal |
|---|---|---|
| A01 | "Life Is Soup. I Am Fork." | Humor conversacional cara a cara |
| A04 | "Existential Dread? In This Economy?" | Pregunta directa al lector |
| A05 | "Nihilist Penguin" | Ilustracion, se ve de frente |
| A07 | "404: Purpose Not Found" | UI simulation detallada |
| B01 | "You're On Mute" | Dirigido al interlocutor |
| B02 | "My Commute Is 7 Seconds" | Conversacional |
| C01 | "Social Battery: 3%" | Icono bateria, frontal |
| C02 | "Plans Cancelled: Best Day Ever" | Tachado visual, necesita lectura |
| D03 | "Self-Care Level: Aggressive" | Progresion visual |
| E01 | "2026 Is the New 2016" | Referencia cultural |
| E03 | "Understood the Assignment" | Checkmark + texto |
| F02 | "Powered by Caffeine & Anxiety" | Relatable face-to-face |
| G04 | "Do Not Read the Next Line" | Interactivo, DEBE ser frontal |
| H03 | "This Shirt Was Made Just for You" | Meta/personal |

### B07 — CREWNECK (BP49, caso especial)
> "Loading... Motivation" — Crewneck BP49/P26
> Front: diseño principal (x:0.5, y:0.45, scale:1)
> Back: wordmark SKAPARA (x:0.5, y:0.15, scale:0.25)
> Neck: S mark 750x750 (x:0.5, y:0.5, scale:0.8)
> NOTA: Diseño SVG actual es 4606x5787 (BP6). Necesita renderizar a 3319x3761 (BP49).

---

## ASSETS DE BRANDING NECESARIOS

| Asset | Uso | Archivo | Upload a Printify |
|---|---|---|---|
| S mark white (hires) | Pecho izq (front) en productos back-design | `assets/skapara-mark-white-hires.png` | Si |
| Neck label white | neck_outer en todos BP6 | `assets/neck-label-skapara-white.png` | Si |
| Wordmark white | Back branding en productos front-design | `assets/skapara-wordmark-white.png` | Si |

---

## LOS 20 PRODUCTOS — FICHAS DE PRODUCCION

### A01 — "Life is soup. I am fork."
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `a01-life-is-soup.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, existential, humor, absurd, soup, fork

### A03 — "Hang In There — It Gets Worse"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: BACK ← diseño en espalda
- **Front**: S mark white pecho izq (x:0.28, y:0.22, scale:0.3)
- **Diseno back**: `a03-hang-in-there.svg` → render PNG 4606x5787
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, sarcastic, humor, dark, pessimist

### A04 — "Existential Dread? In This Economy?"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `a04-existential-dread.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, existential, economy, anxiety, humor

### A05 — "Nihilist Penguin"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `a05-nihilist-penguin.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, penguin, nihilist, meme, 2026, cute

### A07 — "404: Purpose Not Found"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `a07-404-purpose.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, 404, tech, developer, purpose, error

### B01 — "You're On Mute"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `b01-youre-on-mute.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, remote, work, zoom, mute, wfh

### B02 — "My Commute Is 7 Seconds"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `b02-my-commute.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, remote, commute, wfh, bed, desk

### B07 — "Loading... Motivation"
- **BP**: 49 | **Provider**: 26 | **Tipo**: Crewneck
- **Colocacion**: FRONT
- **Diseno front**: `b07-loading-motivation.svg` → render PNG 3319x3761 (REDIMENSIONAR)
- **Back**: wordmark SKAPARA white
- **Neck**: S mark 750x750
- **Colores**: Black, Dark Heather, Navy, Maroon, Forest Green, Military Green (6 oscuros)
- **Tallas**: S-3XL | **Precio**: 4495 cents
- **Tags**: skapara, loading, motivation, monday, progress

### C01 — "Social Battery: 3%"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `c01-social-battery.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, introvert, battery, social, antisocial

### C02 — "Plans Cancelled: Best Day Ever"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `c02-plans-cancelled.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, introvert, plans, cancelled, happy

### D01 — "Regulate Your Nervous System"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: BACK ← diseño en espalda
- **Front**: S mark white pecho izq (x:0.28, y:0.22, scale:0.3)
- **Diseno back**: `d01-regulate-nervous-system.svg` → render PNG 4606x5787
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, wellness, nervous, system, regulate, therapy

### D03 — "Self-Care Level: Aggressive"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `d03-self-care-aggressive.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, selfcare, aggressive, wellness, level

### E01 — "2026 Is the New 2016"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `e01-2026-new-2016.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, 2026, 2016, nostalgia, meme, viral

### E03 — "Understood the Assignment"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `e03-understood-assignment.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, assignment, understood, genz, slang

### E05 — "Main Character Energy"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: BACK ← diseño en espalda
- **Front**: S mark white pecho izq (x:0.28, y:0.22, scale:0.3)
- **Diseno back**: `e05-main-character.svg` → render PNG 4606x5787
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, main, character, energy, tiktok, self

### F02 — "Powered by Caffeine & Anxiety"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `f02-caffeine-anxiety.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, caffeine, anxiety, coffee, powered

### G01 — "NOPE."
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: BACK ← diseño en espalda
- **Front**: S mark white pecho izq (x:0.28, y:0.22, scale:0.3)
- **Diseno back**: `g01-nope.svg` → render PNG 4606x5787
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, nope, attitude, bold, streetwear

### G04 — "Do Not Read the Next Line"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `g04-do-not-read.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, rebel, interactive, humor, read

### H02 — "Made on Demand. Not on a Sweatshop Floor."
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: BACK ← diseño en espalda
- **Front**: S mark white pecho izq (x:0.28, y:0.22, scale:0.3)
- **Diseno back**: `h02-made-on-demand.svg` → render PNG 4606x5787
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, ethical, demand, sustainable, pod

### H03 — "This Shirt Was Made Just for You"
- **BP**: 6 | **Provider**: 26 | **Tipo**: T-Shirt
- **Colocacion**: FRONT
- **Diseno front**: `h03-made-just-for-you.svg` → render PNG 4606x5787
- **Back**: wordmark SKAPARA white
- **Neck_outer**: S mark white
- **Colores**: 9 oscuros | **Tallas**: S-3XL | **Variantes**: 51
- **Precio**: 2995 cents
- **Tags**: skapara, pod, unique, custom, meta

---

## PIPELINE DE CREACION (por producto)

1. **Render SVG → PNG** (canvas exacto del BP)
2. **Upload PNG** a Printify (front design + brand assets)
3. **Create product** con variantes oscuras, print_areas multi-posicion
4. **GPSR** — GET template, fill safety_info, PUT
5. **Publish** + publishing_succeeded
6. **Sync** via cron endpoint
7. **Verificar** en DB (precio, categoria, variantes, imagenes)

## UPLOADS GLOBALES (hacer una sola vez)

| Asset | Uso | Subir primero |
|---|---|---|
| S mark white hires | Pecho izq (5 productos back) | Si |
| Neck label white 1181x1181 | neck_outer (19 BP6 productos) | Si |
| Wordmark white | Back branding (14 productos front) | Si |

---

## RESUMEN

| Metrica | Valor |
|---|---|
| Total productos | 20 |
| T-Shirts (BP6) | 19 |
| Crewnecks (BP49) | 1 |
| Diseño en espalda | 5 (G01, A03, D01, E05, H02) |
| Diseño en frontal | 15 |
| Colores por T-Shirt | 9 oscuros |
| Variantes por T-Shirt | 51 |
| Precio T-Shirt | 29.95 EUR |
| Precio Crewneck | 44.95 EUR |
| Total variantes estimadas | ~960 |
