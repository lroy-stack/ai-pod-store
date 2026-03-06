# FASE 1 — Catálogo Definitivo de 20 Productos

## HALLAZGO CRITICO: MUGS

BP1018 "Two-Tone Mug" = exterior SIEMPRE cerámica **BLANCA**, los "colores" son el interior/handle.
Los diseños actuales usan texto off-white (#F0EDE8) que sera **INVISIBLE** sobre cerámica blanca.

**ACCION REQUERIDA**: Cambiar colores de texto en mugs a oscuro (#0F172A navy) antes de producción.
- B02: "my commute is" y "SECONDS" deben ser navy. "7" verde OK. "bed → desk" gris OK.
- A05: "going my own way" debe ser navy. Penguin negro OK. Footprints amber OK.

---

## CONVENCIONES

- **Nombres**: 1-3 palabras, catchy, sin el quote completo. Ejemplos tienda: "Ghost Tee", "Bug Free", "Scope Creep"
- **Precios**: terminan en .95 o .99 (ambos aceptados)
- **Variantes**: solo colores OSCUROS para prendas (texto blanco). NO cruzar color×talla — usar variant IDs exactos
- **GPSR**: obligatorio ANTES de publish, por técnica de impresión
- **Descripciones**: 2-3 frases creativas EN/ES/DE. Specs técnicas van en product_details JSONB

---

## ASSETS DE BRANDING (3 posiciones adicionales)

| Asset | Archivo | Canvas | Posición |
|---|---|---|---|
| Neck S mark | `branding/neck-label-skapara-white.png` | 1181×1181 | neck_outer (T-Shirts) |
| Sleeve S mark | `branding/neck-label-skapara-white.png` | 1181×1181 | left_sleeve (T-Shirts) — mismo asset |
| Back wordmark | `branding/skapara-wordmark-white.png` | 4120×448 | back (T-Shirts, Hoodies, Crewnecks, LS) |
| Cap back | **CREAR** SVG S mark | 600×300 | back_hat_embroidery |
| Cap sides | **CREAR** SVG S mark | 600×300 | left/right_hat_embroidery |

---

## ZONAS DE IMPRESION POR TIPO

| Tipo | front | back | neck_outer | left_sleeve | Otras |
|---|---|---|---|---|---|
| T-Shirt BP6 | DISEÑO | WORDMARK | S MARK | S MARK mini | — |
| Hoodie BP77 | DISEÑO | WORDMARK | — | — | — |
| Crewneck BP49 | DISEÑO | WORDMARK | — | — | — |
| Long Sleeve BP80 | DISEÑO | WORDMARK | — | — | — |
| Mug BP1018 | DISEÑO (wrap) | — | — | — | — |
| Cap BP1744 | DISEÑO | S MARK 600×300 | — | — | left+right S MARK 600×300 |

---

## LOS 20 PRODUCTOS

### T-SHIRTS (8) — BP6/P26 — €29.99

**Variantes oscuras** (8 colores × tallas variables = 49 variantes):

| Color | Tallas | Variant IDs |
|---|---|---|
| Black | S=12126, M=12125, L=12124, XL=12127, 2XL=12128, 3XL=12129 | 6 |
| Navy | S=11988, M=11987, L=11986, XL=11989, 2XL=11990, 3XL=11991 | 6 |
| Dark Heather | S=11904, M=11903, L=11902, XL=11905, 2XL=11906 | 5 |
| Charcoal | S=11874, M=11873, L=11872, XL=11875, 2XL=11876 | 5 |
| Dark Chocolate | S=11898, M=11897, L=11896, XL=11899, 2XL=11900, 3XL=11901 | 6 |
| Forest Green | S=12144, M=12143, L=12142, XL=12145, 2XL=12146 | 5 |
| Maroon | S=11976, M=11975, L=11974, XL=11977, 2XL=11978, 3XL=11979 | 6 |
| Military Green | S=12192, M=12191, L=12190, XL=12193, 2XL=12194, 3XL=12195 | 6 |

**Posiciones**: front (diseño 4606×5787) + back (wordmark) + neck_outer (S mark 1181×1181) + left_sleeve (S mark 1181×1181)

**Material**: 100% Cotton (Gildan 5000)
**GPSR**: Textildruck Europa GmbH, Germany | REACH, OEKO-TEX Standard 100
**Care**: Machine wash cold inside out. Tumble dry low. Do not iron on print.

---

#### T01. "Soup Fork"
- **ID**: A01
- **SVG**: `tshirts/a01-life-is-soup.svg`
- **Diseño**: "Life is soup. I am fork." — Two-Tone Text
- **Categoría**: t-shirts
- **EN**: A philosophical crisis served in a bowl. For those who feel slightly out of place — everywhere.
- **ES**: Una crisis filosófica servida en un plato. Para los que se sienten un poco fuera de lugar — en todas partes.
- **DE**: Eine philosophische Krise, serviert in einer Schüssel. Für alle, die sich überall leicht fehl am Platz fühlen.

#### T02. "Existential Dread"
- **ID**: A04
- **SVG**: `tshirts/a04-existential-dread.svg`
- **Diseño**: "Existential Dread? In This Economy?" — Two-Tone Text
- **Categoría**: t-shirts
- **EN**: Can't even afford a proper crisis anymore. At least the shirt is worth it.
- **ES**: Ya ni una crisis existencial se puede permitir. Al menos la camiseta lo vale.
- **DE**: Man kann sich nicht mal mehr eine richtige Krise leisten. Wenigstens ist das Shirt es wert.

#### T03. "Social Battery"
- **ID**: C01
- **SVG**: `tshirts/c01-social-battery.svg`
- **Diseño**: "Social Battery: 3%" — Minimalism + icon
- **Categoría**: t-shirts
- **EN**: Low battery, high standards. Your official excuse to leave early.
- **ES**: Batería baja, estándares altos. Tu excusa oficial para irte antes.
- **DE**: Akku leer, Ansprüche hoch. Deine offizielle Ausrede, früher zu gehen.

#### T04. "Plans Cancelled"
- **ID**: C02
- **SVG**: `tshirts/c02-plans-cancelled.svg`
- **Diseño**: "Plans Cancelled: Best Day Ever" — Two-Tone Text
- **Categoría**: t-shirts
- **EN**: The notification you secretly hope for. Introvert approved.
- **ES**: La notificación que secretamente esperas. Aprobado por introvertidos.
- **DE**: Die Benachrichtigung, auf die du insgeheim hoffst. Von Introvertierten genehmigt.

#### T05. "Self-Care Mode"
- **ID**: D03
- **SVG**: `tshirts/d03-self-care-aggressive.svg`
- **Diseño**: "Self-Care Level: Aggressive" — Two-Tone Text
- **Categoría**: t-shirts
- **EN**: Setting boundaries like a firewall. Self-care is not optional — it's mandatory.
- **ES**: Poniendo límites como un firewall. El autocuidado no es opcional — es obligatorio.
- **DE**: Grenzen setzen wie eine Firewall. Selbstfürsorge ist keine Option — sie ist Pflicht.

#### T06. "Caffeine Anxiety"
- **ID**: F02
- **SVG**: `tshirts/f02-caffeine-anxiety.svg`
- **Diseño**: "Powered by Caffeine & Anxiety" — Two-Tone Text
- **Categoría**: t-shirts
- **EN**: The two fuels that keep modern life running. Warning: explosive combination.
- **ES**: Los dos combustibles que mueven la vida moderna. Advertencia: combinación explosiva.
- **DE**: Die zwei Treibstoffe des modernen Lebens. Warnung: explosive Mischung.

#### T07. "Next Line"
- **ID**: G04
- **SVG**: `tshirts/g04-do-not-read.svg`
- **Diseño**: "Do Not Read the Next Line" — Minimalism
- **Categoría**: t-shirts
- **EN**: You read it anyway. We knew you would. Welcome to the club.
- **ES**: Lo leíste de todas formas. Sabíamos que lo harías. Bienvenido al club.
- **DE**: Du hast es trotzdem gelesen. Wir wussten es. Willkommen im Club.

#### T08. "Just For You"
- **ID**: H03
- **SVG**: `tshirts/h03-made-just-for-you.svg`
- **Diseño**: "This Shirt Was Made Just for You" — Minimalism
- **Categoría**: t-shirts
- **EN**: No warehouse. No overstock. Made when you wanted it, just for you.
- **ES**: Sin almacén. Sin excedentes. Hecha cuando la pediste, solo para ti.
- **DE**: Kein Lager. Keine Überproduktion. Hergestellt als du sie wolltest, nur für dich.

---

### HOODIES (4) — BP77/P26 — €49.99

**Variantes oscuras** (7 colores × tallas variables = 43 variantes):

| Color | Tallas | Variant IDs |
|---|---|---|
| Black | S=32918, M=32919, L=32920, XL=32921, 2XL=32922, 3XL=32923 | 6 |
| Navy | S=32894, M=32895, L=32896, XL=32897, 2XL=32898, 3XL=32899 | 6 |
| Dark Heather | S=32878, M=32879, L=32880, XL=32881, 2XL=32882 | 5 |
| Forest Green | S=33417, M=33418, L=33419, XL=33420, 2XL=33421, 3XL=33422 | 6 |
| Maroon | S=32886, M=32887, L=32888, XL=32889, 2XL=32890, 3XL=32891 | 6 |
| Military Green | S=33425, M=33426, L=33427, XL=33428, 2XL=33429 | 5 |
| Dark Chocolate | M=42220, L=42221, XL=42222, 2XL=42223, 3XL=42224 | 5 (NO S!) |

**Posiciones**: front (diseño 4016×3307 LANDSCAPE) + back (wordmark 4500×5100)

**Material**: 50% Cotton / 50% Polyester (Gildan 18500)
**GPSR**: Textildruck Europa GmbH, Germany | REACH, OEKO-TEX Standard 100
**Care**: Machine wash cold inside out. Tumble dry low. Do not iron on print.

---

#### H01. "Hang In There"
- **ID**: A03
- **SVG**: `hoodies/a03-hang-in-there.svg`
- **Diseño**: "Hang In There — It Gets Worse" — Two-Tone, vertical stack landscape
- **Categoría**: pullover-hoodies
- **EN**: Motivational poster energy — with an honest twist. The hoodie that understands you.
- **ES**: Energía de póster motivacional — con un giro honesto. La hoodie que te entiende.
- **DE**: Motivationsposter-Vibes — mit einer ehrlichen Wendung. Der Hoodie, der dich versteht.

#### H02. "Nervous System"
- **ID**: D01
- **SVG**: `hoodies/d01-regulate-nervous-system.svg`
- **Diseño**: "Regulate Your Nervous System" — ECG + 3D purple + turquoise, landscape
- **Categoría**: pullover-hoodies
- **EN**: A gentle reminder with an ECG heartbeat. Regulate, breathe, repeat.
- **ES**: Un recordatorio suave con latido ECG. Regula, respira, repite.
- **DE**: Eine sanfte Erinnerung mit EKG-Herzschlag. Regulieren, atmen, wiederholen.

#### H03. "Main Character"
- **ID**: E05
- **SVG**: `hoodies/e05-main-character.svg`
- **Diseño**: "Main Character Energy" — 3D amber + violet, landscape
- **Categoría**: pullover-hoodies
- **EN**: Main character energy on a side character budget. Own every scene anyway.
- **ES**: Energía de protagonista con presupuesto de secundario. Domina cada escena de todos modos.
- **DE**: Hauptrollen-Energie mit Nebenrollen-Budget. Beherrsche trotzdem jede Szene.

#### H04. "Nope"
- **ID**: G01
- **SVG**: `hoodies/g01-nope.svg`
- **Diseño**: "NOPE." — Massive 3D red, X marks, landscape
- **Categoría**: pullover-hoodies
- **EN**: One word. Full sentence. Absolutely not.
- **ES**: Una palabra. Frase completa. Absolutamente no.
- **DE**: Ein Wort. Ganzer Satz. Absolut nicht.

---

### CREWNECKS (3) — BP49/P26 — €44.99

**Variantes oscuras** (6 colores × tallas variables = 39 variantes):

| Color | Tallas | Variant IDs |
|---|---|---|
| Black | S=25397, M=25428, L=25459, XL=25490, 2XL=25521, 3XL=25552 | 6 |
| Navy | S=25388, M=25419, L=25450, XL=25481, 2XL=25512, 3XL=25543 | 6 |
| Dark Heather | S=25381, M=25412, L=25443, XL=25474, 2XL=25505 | 5 |
| Forest Green | S=25400, M=25431, L=25462, XL=25493, 2XL=25524, 3XL=25555 | 6 |
| Maroon | S=25387, M=25418, L=25449, XL=25480, 2XL=25511, 3XL=25542 | 6 |
| Military Green | S=25404, M=25435, L=25466, XL=25497, 2XL=25528, 3XL=25559 | 6 |

**Posiciones**: front (diseño 4500×5100) + back (wordmark 4500×5100)

**Material**: 50% Cotton / 50% Polyester (Gildan 18000)
**GPSR**: Textildruck Europa GmbH, Germany | REACH, OEKO-TEX Standard 100
**Care**: Machine wash cold inside out. Tumble dry low. Do not iron on print.

---

#### C01. "Loading Motivation"
- **ID**: B07
- **SVG**: `crewnecks/b07-loading-motivation.svg`
- **Diseño**: "Thinking... Motivation" — Progress bar UI simulation
- **Categoría**: crewnecks
- **EN**: ETA: undefined. Still loading that Monday motivation since 2019.
- **ES**: ETA: indefinido. Cargando la motivación del lunes desde 2019.
- **DE**: ETA: undefiniert. Montags-Motivation wird seit 2019 geladen.

#### C02. "404 Purpose"
- **ID**: A07
- **SVG**: `crewnecks/a07-404-purpose.svg`
- **Diseño**: "404: Purpose Not Found" — Terminal window simulation
- **Categoría**: crewnecks
- **EN**: The meaning you were looking for has been permanently deleted. Try again tomorrow.
- **ES**: El significado que buscabas fue eliminado permanentemente. Inténtalo mañana.
- **DE**: Die Bedeutung, die du gesucht hast, wurde dauerhaft gelöscht. Versuch's morgen nochmal.

#### C03. "New 2016"
- **ID**: E01
- **SVG**: `crewnecks/e01-2026-new-2016.svg`
- **Diseño**: "2026 Is the New 2016" — Two-Tone years
- **Categoría**: crewnecks
- **EN**: Same chaos, different year. At least the fashion is better this time.
- **ES**: Mismo caos, año diferente. Al menos la moda es mejor esta vez.
- **DE**: Gleiches Chaos, anderes Jahr. Wenigstens ist die Mode diesmal besser.

---

### LONG SLEEVES (2) — BP80/P26 — €34.99

**Variantes oscuras** (2 colores SOLO × 5 tallas = 10 variantes):

| Color | Tallas | Variant IDs |
|---|---|---|
| Black | S=33796, M=33797, L=33798, XL=33799, 2XL=33800 | 5 |
| Navy | S=42711, M=42712, L=42713, XL=42714, 2XL=42715 | 5 |

**NOTA**: BP80 solo ofrece 2 colores oscuros. Muy limitado pero suficiente.

**Posiciones**: front (diseño 4500×5100) + back (wordmark 4500×5100)

**Material**: 100% Cotton (Gildan 2400)
**GPSR**: Textildruck Europa GmbH, Germany | REACH, OEKO-TEX Standard 100
**Care**: Machine wash cold inside out. Tumble dry low. Do not iron on print.

---

#### L01. "On Mute"
- **ID**: B01
- **SVG**: `longsleeves/b01-youre-on-mute.svg`
- **Diseño**: "You're On Mute" — Mic icon con strike-through rojo
- **Categoría**: long-sleeves
- **EN**: The most repeated phrase of the remote era. We still can't hear you.
- **ES**: La frase más repetida de la era remota. Seguimos sin oírte.
- **DE**: Der meistgesagte Satz der Remote-Ära. Wir können dich immer noch nicht hören.

#### L02. "On Demand"
- **ID**: H02
- **SVG**: `longsleeves/h02-made-on-demand.svg`
- **Diseño**: "Made on Demand. Not on a Sweatshop Floor." — Brand statement
- **Categoría**: long-sleeves
- **EN**: Ethical fashion that says it out loud. Made when you order, where workers are paid fairly.
- **ES**: Moda ética que lo dice en voz alta. Hecha cuando pides, donde los trabajadores cobran justo.
- **DE**: Ethische Mode, die es laut sagt. Hergestellt auf Bestellung, wo Arbeiter fair bezahlt werden.

---

### MUGS (2) — BP1018/P26 — €16.99

**Variantes**: TODOS los 11 colores (el color es interior/handle, exterior siempre blanco):

| Color | Variant ID |
|---|---|
| Black | 79701 |
| Pink | 79702 |
| Gold | 80021 |
| Red | 80022 |
| Cambridge Blue | 80023 |
| Dark Green | 80024 |
| Light Green | 80026 |
| Maroon | 80027 |
| Orange | 80028 |
| Yellow | 80029 |
| Dark Blue | 80030 |

**Posiciones**: front (diseño wrap-around 2244×945) — UNICA posición

**CRITICO**: Diseños necesitan texto OSCURO (#0F172A) en vez de off-white para cerámica blanca.

**Material**: Ceramic, dishwasher safe
**GPSR**: Textildruck Europa GmbH, Germany | REACH, FDA food-contact (21 CFR 177)
**Care**: Dishwasher and microwave safe.

---

#### M01. "Seven Seconds"
- **ID**: B02
- **SVG**: `mugs/b02-my-commute.svg` — **REQUIERE FIX de colores para cerámica blanca**
- **Diseño**: "My Commute Is 7 Seconds" — Hero number verde + texto
- **Categoría**: mugs
- **EN**: Remote work in a mug. Seven seconds from bed to desk — no traffic, no pants required.
- **ES**: Trabajo remoto en una taza. Siete segundos de la cama al escritorio — sin tráfico, sin pantalones.
- **DE**: Remote-Arbeit in einer Tasse. Sieben Sekunden vom Bett zum Schreibtisch — kein Verkehr, keine Hose nötig.

#### M02. "Nihilist Penguin"
- **ID**: A05
- **SVG**: `mugs/a05-nihilist-penguin.svg` — **REQUIERE FIX de colores para cerámica blanca**
- **Diseño**: Tux penguin + "going my own way" + footprints
- **Categoría**: mugs
- **EN**: Going my own way — just slowly and without purpose. The existential penguin on your desk.
- **ES**: Yendo a mi aire — despacio y sin propósito. El pingüino existencial en tu escritorio.
- **DE**: Meinen eigenen Weg gehen — langsam und ohne Ziel. Der existenzielle Pinguin auf deinem Schreibtisch.

---

### CAP BORDADA (1) — BP1744/P410 — €29.99

**Variantes oscuras** (4 colores × 2 tallas = 8 variantes):

| Color | Tallas | Variant IDs |
|---|---|---|
| Black | S/M=118702, L/XL=118703 | 2 |
| Dark Navy | S/M=118704, L/XL=118705 | 2 |
| Dark Grey | S/M=118706, L/XL=118707 | 2 |
| Multicam Black | S/M=118716, L/XL=118717 | 2 |

**Posiciones**: front (diseño 1770×600) + back_hat (S mark 600×300) + left_hat (S mark 600×300) + right_hat (S mark 600×300)
**Colores hilo**: Teal #14B8A6 + White #FFFFFF (2 colores)

**Material**: 100% Acrylic front, Nylon Mesh back (Yupoong 6089M)
**GPSR**: Printful SIA, Latvia, EU | REACH compliant
**Care**: Spot clean only. Do not machine wash.

---

#### K01. "Assignment"
- **ID**: E03
- **SVG front**: `caps/e03-assignment-understood.svg`
- **SVG back/sides**: **CREAR** S mark teal en 600×300
- **Diseño**: Checkmark teal + "UNDERSTOOD / the assignment" — bordado
- **Categoría**: caps
- **EN**: The cap for those who show up prepared. Understood the assignment — every single time.
- **ES**: La gorra para los que llegan preparados. Entendió la tarea — cada vez.
- **DE**: Die Cap für alle, die vorbereitet sind. Aufgabe verstanden — jedes Mal.

---

## RESUMEN DE TRABAJO PENDIENTE

### Assets a crear ANTES del script:
1. [x] **Fix mugs**: Cambiar texto off-white a navy (#0F172A) en B02 y A05 — DONE
2. [x] **Cap side/back SVGs**: S mark teal a 600×300 `branding/cap-smark-teal.svg` — DONE
3. [x] **Back wordmark positioning**: sube 1x, posiciona via API (x:0.5, y:0.15, scale:0.35) — en script
4. [x] **Neck S mark positioning**: sube 1x, posiciona (x:0.5, y:0.5, scale:0.8) — en script
5. [x] **Sleeve S mark positioning**: Mismo PNG que neck, posiciona (x:0.5, y:0.3, scale:0.35) — en script

### Prevención de cruce color×talla:
- Usar EXACTAMENTE los variant IDs listados arriba
- Dark Chocolate en Hoodie NO tiene talla S (empieza en M)
- Black y Navy en T-Shirt llegan hasta 5XL, los demás solo hasta 2XL o 3XL
- Long Sleeve SOLO tiene Black y Navy
- Mugs NO tienen tallas (solo 11oz)
- Caps solo S/M y L/XL

### Orden de creación en script:
1. Upload branding assets (wordmark, neck label, sleeve mark) — 3 uploads
2. Upload cap embroidery S marks (back, left, right) — 1 upload (reutilizar)
3. Por cada producto:
   a. Render SVG→PNG (sharp, tamaño exacto del canvas)
   b. Upload design PNG
   c. Create product (BP, provider, variants con precios, print_areas con posiciones)
   d. GET GPSR → PUT safety_information
   e. Set product_details JSONB
   f. Publish + publishing_succeeded
   g. Delay 2000ms
4. Trigger cron sync
5. Verificar en DB: categoría, precio, variantes, imágenes
