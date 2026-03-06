# Product Plan: Meme Previews Batch — 10 Nuevos Productos (v2)

**Fecha**: 2026-02-28
**Estado**: COMPLETADO — 10/10 productos creados en Printify + Supabase (2026-02-28 21:00 UTC)
**Colección**: Meme Previews (UI Simulation)
**Diseños fuente**: `/frontend/public/meme-previews/` (6 diseños)
**Método**: DTG (Direct-to-Garment)
**Provider**: P26 — Textildruck Europa (Alemania)
**Garments**: TODOS oscuros — dark-first brand, 16 colores únicos
**Variantes verificadas**: Contra API real (2026-02-28)

---

## Filosofía del batch

**Máxima variedad de garments**: 10 productos en **8 blueprints diferentes**. No solo "6 Gildan 5000". Cada diseño va en el garment que mejor le sienta por estilo, canvas y contraste.

**Colores pensados por diseño**: Cada diseño tiene acentos de color distintos. Los colores del garment se eligen para maximizar contraste con esos acentos.

**Tallas reales**: Verificadas contra la API. Flaggeados los gaps de stock (BP145 Black sin L, BP12 Maroon sin M, etc.).

---

## Diseños disponibles (6 diseños → 10 productos)

Todos los diseños son **3951×4919px**, fondo transparente, patrón two-tone (ghost white text + bold color accents). Diseñados para garments oscuros.

| ID | Archivo | Chiste | Acentos de color | Complejidad |
|---|---|---|---|---|
| 11 | `11-strawberry-tee.png` | ChatGPT 5 cuenta fresas mal tras pensar 11s | White dominant, subtle grey UI | Alta (UI completa) |
| 12 | `12-underwear-tee.png` | "Look under there" → underwear → prompt injection con coords | White dominant, monospace grey | Alta (multi-bubble) |
| 13 | `13-bypass-permissions-tee.png` | Claude Code permissions, siempre opción 2 | White/light text + **orange** "> 2" punchline | Media |
| 14 | `14-skip-permissions-tee.png` | El flag prohibido: `--dangerously-skip-permissions` | **Pure white** monospace ONLY | Mínima |
| 15 | `15-button-color-tee.png` | "change button color" → 47 files, +9847/-2103 | **Copper** text + **green/red** diffs | Alta (file list) |
| 16 | `16-haiku-sonnet-opus-tee.png` | Mismo prompt, 3 modelos responden diferente | **Green** Haiku + **Blue** Sonnet + **Orange** Opus | Media-Alta |

---

## Garment Types Used (8 blueprints únicos)

| BP | Garment | Estilo | Peso | Fit | Material | Canvas |
|---|---|---|---|---|---|---|
| BP6 | Gildan 5000 Heavy Cotton Tee | Clásica robusta | 180 gsm | Boxy, amplio | 100% Cotton | 4606×5787 |
| BP12 | Bella+Canvas 3001 Jersey Tee | Premium ajustada | 142 gsm | Modern slim | 100% Airlume Cotton | 2953×3710 |
| BP145 | Gildan 64000 Softstyle Tee | Casual suave | 150 gsm | Semi-fitted | 100% Ring-Spun Cotton | 3402×4264 |
| BP454 | B&C TU01T Single Jersey | EU-made orgánica | 145 gsm | Classic EU | 100% Ring-Spun Cotton | 3543×4452 |
| BP1462 | Stanley Stella Creator 2.0 | Sostenible premium | 180 gsm | Modern | 100% Organic Cotton | 3142×3561 |
| BP77 | Gildan 18500 Heavy Blend Hoodie | Pullover clásico | 270 gsm | Standard | 50% Cotton / 50% Poly | 3531×2908 |
| BP92 | AWDIS JH001 College Hoodie | Sporty moderno | 280 gsm | Relaxed | 80% Cotton / 20% Poly | 3177×2616 |
| BP49 | Gildan 18000 Heavy Blend Crewneck | Crewneck estándar | 270 gsm | Standard | 50% Cotton / 50% Poly | 3319×3761 |
| BP80 | Gildan 2400 Ultra Cotton LS | Manga larga clásica | 180 gsm | Standard | 100% Cotton | 4110×4658 |

---

## Producto 1: "Strawberry Count"

- **Tipo**: T-Shirt Classic Heavy
- **Diseño**: `11-strawberry-tee.png` (ChatGPT 5 cuenta fresas)
- **Blueprint**: BP6 — Gildan 5000 Heavy Cotton Tee
- **Por qué BP6**: Canvas más grande disponible (4606×5787). Diseño UI detallado con múltiples líneas de texto necesita máxima resolución.
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 1.0
- **Precio**: €24.99 (2499 cents)

### Colores y tallas (verificados API)

| Color | Por qué | Tallas disponibles | Variant IDs (ref) |
|---|---|---|---|
| Black | Máximo contraste para UI simulation blanca | S, M, L, XL, 2XL, 3XL, 4XL, 5XL | 12124-12129, 24039, 24171 |
| Charcoal | Urbano, tonos grises del UI se integran | S, M, L, XL, 2XL | 11872-11876 |
| Navy | Tech/corporate vibe | S, M, L, XL, 2XL, 3XL, 4XL, 5XL | 11986-11991, 23993, 24126 |
| Dark Heather | Casual, textura heather añade dimensión | S, M, L, XL, 2XL | 11902-11906 |

**Total variantes**: ~24

### Specs técnicos
- **Material**: 100% Cotton
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "Strawberry Count" — "ChatGPT 5 thought about it for 11 seconds. Still got it wrong. The AI era's most relatable moment, now on heavyweight cotton."
- **ES**: "Strawberry Count" — "ChatGPT 5 pensó durante 11 segundos. Y aun así falló. El momento más relatable de la era AI, ahora en algodón heavyweight."
- **DE**: "Strawberry Count" — "ChatGPT 5 hat 11 Sekunden nachgedacht. Und lag trotzdem falsch. Der relatable Moment der KI-Ära, auf Heavyweight-Baumwolle."

**Tags**: skapara, meme, chatgpt, ai, strawberry, tech-humor
**Categoría DB**: t-shirts

---

## Producto 2: "Under Where"

- **Tipo**: T-Shirt Softstyle
- **Diseño**: `12-underwear-tee.png` (ChatGPT prompt injection)
- **Blueprint**: BP145 — Gildan 64000 Softstyle Tee
- **Por qué BP145**: El humor casual del "underwear trick" pide un garment casual y suave. Softstyle = la camiseta de andar por casa que te pones para codear. Canvas decente (3402×4264).
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 1.0
- **Precio**: €24.99 (2499 cents)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Charcoal | Más oscuro disponible sin gaps de talla (Black sin L!) | S, M, L, XL, 2XL, 3XL |
| Dark Heather | Textura heather, casual | S, M, L, XL, 2XL, 3XL |
| Navy | Tech standard | S, M, L, XL, 2XL, 3XL |
| Military Green | Fresco y diferente, chat bubbles blancos resaltan perfecto en verde | S, M, L, XL, 2XL, 3XL |

> **⚠ NOTA**: Black en BP145 NO tiene talla L (gap de stock). Se usa Charcoal como alternativa más oscura.

**Total variantes**: ~24

### Specs
- **Material**: 100% Ring-Spun Cotton (más suave que Gildan 5000)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "Under Where" — "The oldest trick in the book. ChatGPT fell for it — then leaked your coordinates. Classic prompt injection, wearable edition."
- **ES**: "Under Where" — "El truco más viejo del mundo. ChatGPT cayó — y después filtró tus coordenadas. Prompt injection clásica, edición portable."
- **DE**: "Under Where" — "Der älteste Trick der Welt. ChatGPT ist drauf reingefallen — und hat deine Koordinaten geleakt. Klassische Prompt Injection, tragbare Edition."

**Tags**: skapara, meme, chatgpt, prompt-injection, ai, tech-humor
**Categoría DB**: t-shirts

---

## Producto 3: "Option Two"

- **Tipo**: T-Shirt EU Single Jersey
- **Diseño**: `13-bypass-permissions-tee.png` (Claude Code permissions)
- **Blueprint**: BP454 — B&C TU01T Single Jersey Men's Tee
- **Por qué BP454**: Camiseta EU-made para una marca EU-first. Rango de tallas más amplio (XS-5XL). Y sobre todo: tiene **Bottle Green**, donde el acento **naranja** del "> 2" crea contraste complementario perfecto (naranja vs verde = colores opuestos).
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 1.0
- **Precio**: €26.99 (2699 cents — premium por EU-made)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Black | Contraste clásico, naranja del "> 2" resalta | XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| Bottle Green | **KEY**: Naranja sobre verde = colores complementarios. POP máximo. Opción ÚNICA de este BP | XS, S, M, L, XL, 2XL, 3XL |
| Dark Grey | Mood terminal, discreto | XS, S, M, L, XL, 2XL, 3XL |
| Navy | Alternativa profesional | XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL |

**Total variantes**: ~32

### Specs
- **Material**: 100% Ring-Spun Cotton (EU-sourced)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "Option Two" — "Claude has a plan. Four options on screen. You already know which one you're picking. Always option two."
- **ES**: "Option Two" — "Claude tiene un plan. Cuatro opciones en pantalla. Ya sabes cuál vas a elegir. Siempre la opción dos."
- **DE**: "Option Two" — "Claude hat einen Plan. Vier Optionen auf dem Bildschirm. Du weißt bereits, welche du wählst. Immer Option zwei."

**Tags**: skapara, meme, claude, claude-code, permissions, ai, tech-humor
**Categoría DB**: t-shirts

---

## Producto 4: "Dangerous Flag"

- **Tipo**: T-Shirt Premium Fitted
- **Diseño**: `14-skip-permissions-tee.png` (--dangerously-skip-permissions)
- **Blueprint**: BP12 — Bella+Canvas 3001 Unisex Jersey Tee
- **Por qué BP12**: Diseño minimalista extremo (solo texto blanco monospace) merece el garment más premium. Bella+Canvas 3001 es la camiseta "fashion" — fitted, suave, moderna. La simplicidad del diseño eleva el garment. 5 colores porque el texto puro blanco funciona en CUALQUIER oscuro.
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 1.0
- **Precio**: €27.99 (2799 cents — premium garment)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Black | El clásico. Texto blanco sobre negro = máximo impacto | XS, S, M, L, XL, 2XL, 3XL, 4XL |
| Dark Grey | Más sutil, urbano | XS, S, M, L, XL, 2XL |
| Dark Grey Heather | Textura heathered, modern | XS, S, M, L, XL, 2XL |
| Heather Navy | Azul profundo con textura, sofisticado | XS, S, M, L, XL, 2XL |
| Heather Olive | Tono militar/outdoor. Texto blanco sobre oliva = tech meets nature | XS, S, M, L, XL, 2XL |

**Total variantes**: ~30

### Specs
- **Material**: 100% Airlume Combed and Ring-Spun Cotton (premium hand feel)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "Dangerous Flag" — "You know the flag. You've typed the flag. No regrets. For the developer who lives on the edge of the command line."
- **ES**: "Dangerous Flag" — "Conoces el flag. Has escrito el flag. Sin arrepentimientos. Para el developer que vive al límite de la línea de comandos."
- **DE**: "Dangerous Flag" — "Du kennst das Flag. Du hast das Flag getippt. Keine Reue. Für den Entwickler, der am Rand der Kommandozeile lebt."

**Tags**: skapara, meme, claude-code, permissions, cli, developer, tech-humor
**Categoría DB**: t-shirts

---

## Producto 5: "Scope Creep"

- **Tipo**: T-Shirt Classic Heavy
- **Diseño**: `15-button-color-tee.png` (change button color → 47 files)
- **Blueprint**: BP6 — Gildan 5000 Heavy Cotton Tee
- **Por qué BP6**: Diseño complejo con lista de archivos, líneas de diff (+/-), y texto copper. Necesita el canvas más grande para que todo sea legible. BP6 (4606×5787) es la única opción real para este nivel de detalle.
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 1.0
- **Precio**: €24.99 (2499 cents)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Black | Copper "I'd be happy to help!" + green/red diffs POP en negro | S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| Charcoal | Urbano, tonos cálidos del copper se integran bien | S, M, L, XL, 2XL |
| Navy | Profesional, copper destaca sobre azul oscuro | S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| Maroon | **BOLD**: Copper/amber sobre maroon = armonía de tonos cálidos. Green diffs visible. Combo premium | S, M, L, XL, 2XL, 3XL |

**Total variantes**: ~24

### Specs
- **Material**: 100% Cotton (heavy weight)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "Scope Creep" — "You asked to change a button color. Claude edited 47 files and added 9,847 lines. The AI pair programmer experience, summarized."
- **ES**: "Scope Creep" — "Pediste cambiar el color de un botón. Claude editó 47 archivos y añadió 9.847 líneas. La experiencia de pair programming con AI, resumida."
- **DE**: "Scope Creep" — "Du wolltest eine Button-Farbe ändern. Claude hat 47 Dateien bearbeitet und 9.847 Zeilen hinzugefügt. Das KI-Pair-Programming-Erlebnis, zusammengefasst."

**Tags**: skapara, meme, claude-code, scope-creep, ai, developer, tech-humor
**Categoría DB**: t-shirts

---

## Producto 6: "Three Models"

- **Tipo**: T-Shirt Sustainable Premium
- **Diseño**: `16-haiku-sonnet-opus-tee.png` (3 modelos, 3 personalidades)
- **Blueprint**: BP1462 — Stanley Stella Creator 2.0
- **Por qué BP1462**: Sustainable premium para un diseño que compara 3 modelos Claude. Algodón orgánico certificado. El rango de tallas (2XS-5XL) es el más inclusivo de todos los BPs. Posiciona este producto como la opción premium/ética del catálogo.
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 1.0
- **Precio**: €29.99 (2999 cents — premium sustainable)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Black | Los 3 labels coloreados (green Haiku, blue Sonnet, orange Opus) resaltan perfecto | 2XS, XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| French Navy | Azul profundo. Sonnet (blue) se integra ligeramente pero Haiku (green) y Opus (orange) destacan | 2XS, XS, S, M, L, XL, 2XL, 3XL, 4XL |
| Dark Heather Grey | Gris neutro. Los 3 colores resaltan sobre gris sin competir | 2XS, XS, S, M, L, XL, 2XL, 3XL |

> **⚠ NOTA**: Burgundy descartado — solo tiene XS-XL, rango insuficiente.

**Total variantes**: ~27

### Specs
- **Material**: 100% Organic Ring-Spun Cotton (GOTS certified)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100. GOTS organic cotton.

### Descripciones
- **EN**: "Three Models" — "Same prompt, three personalities. Haiku just does it. Sonnet overthinks it. Opus questions your life choices. Pick your fighter."
- **ES**: "Three Models" — "Mismo prompt, tres personalidades. Haiku simplemente lo hace. Sonnet lo piensa demasiado. Opus cuestiona tus decisiones de vida. Elige tu fighter."
- **DE**: "Three Models" — "Gleicher Prompt, drei Persönlichkeiten. Haiku macht einfach. Sonnet denkt zu viel nach. Opus hinterfragt deine Lebensentscheidungen. Wähle deinen Fighter."

**Tags**: skapara, meme, claude, haiku, sonnet, opus, ai-models, tech-humor, organic
**Categoría DB**: t-shirts

---

## Producto 7: "Skip Permissions"

- **Tipo**: College Hoodie
- **Diseño**: `14-skip-permissions-tee.png` (reutilizado — hoodie versión)
- **Blueprint**: BP92 — AWDIS JH001 College Hoodie
- **Por qué BP92**: Estilo diferente al BP77 pullover clásico (todos los hoodies existentes son BP793 embroidered). College hoodie = sporty, moderno, con doble-tela en capucha. Diseño minimalista + college style = statement limpio. Además: 5 colores oscuros con buen rango de tallas (hasta 5XL en Black/Navy).
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 0.62
- **Nota scale**: Diseño portrait (3951×4919) en canvas landscape (3177×2616). Scale 0.62 encaja el diseño completo dentro del canvas con márgenes de ~5%.
- **Precio**: €49.99 (4999 cents)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Jet Black | Máximo contraste, texto blanco puro. El clásico | XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| Oxford Navy | Tono profundo, profesional pero casual | XS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| Charcoal | Gris oscuro urbano | XS, S, M, L, XL, 2XL, 3XL |
| Bottle Green | Texto blanco sobre verde bosque. Tech meets nature | XS, S, M, L, XL, 2XL, 3XL |
| Purple | **BOLD**: Blanco sobre púrpura = statement. Color que ningún otro producto del catálogo ofrece | XS, S, M, L, XL, 2XL, 3XL |

**Total variantes**: ~37

### Specs
- **Material**: 80% Ringspun Cotton / 20% Polyester (softer than standard 50/50)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "Skip Permissions" — "The flag that says everything about how you code. Dangerously comfortable, just like your workflow. Sporty college-cut hoodie."
- **ES**: "Skip Permissions" — "El flag que dice todo sobre cómo codeas. Peligrosamente cómodo, igual que tu workflow. Hoodie college-cut deportivo."
- **DE**: "Skip Permissions" — "Das Flag, das alles über deinen Coding-Stil sagt. Gefährlich bequem, genau wie dein Workflow. Sportlicher College-Cut Hoodie."

**Tags**: skapara, meme, claude-code, permissions, cli, developer, hoodie, college
**Categoría DB**: pullover-hoodies

---

## Producto 8: "AI Personalities"

- **Tipo**: Crewneck Sweatshirt
- **Diseño**: `16-haiku-sonnet-opus-tee.png` (reutilizado — crewneck versión)
- **Blueprint**: BP49 — Gildan 18000 Heavy Blend Crewneck
- **Por qué BP49**: Crewneck es el garment "professional casual". El diseño analítico de 3 modelos = contenido comparativo = vibe profesional. Canvas portrait (3319×3761) casi perfecto para el diseño portrait. Colores cuidadosamente elegidos para que los 3 labels resalten.
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 0.90
- **Nota scale**: Diseño (3951×4919, AR 0.80) en canvas (3319×3761, AR 0.88). Scale 0.90 acomoda el diseño con margen.
- **Precio**: €44.99 (4499 cents)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Black | Los 3 labels (green, blue, orange) resaltan perfecto en negro. Opción segura | S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| Dark Heather | Gris neutro que no compite con ninguno de los 3 colores | S, M, L, XL, 2XL |
| Maroon | **DIFERENTE**: Green Haiku y Orange Opus resaltan fuerte sobre maroon. Blue Sonnet crea contraste frío/cálido. Combo premium | S, M, L, XL, 2XL, 3XL |

> **Descartados**: Navy (blue Sonnet se pierde), Forest Green (green Haiku se pierde), Military Green (mismo problema).

**Total variantes**: ~19

### Specs
- **Material**: 50% Cotton / 50% Polyester (heavy blend)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "AI Personalities" — "Three models, one task, zero agreement. The definitive guide to Claude's personality spectrum, on cozy heavyweight crewneck."
- **ES**: "AI Personalities" — "Tres modelos, una tarea, cero acuerdo. La guía definitiva del espectro de personalidad de Claude, en crewneck heavyweight acogedor."
- **DE**: "AI Personalities" — "Drei Modelle, eine Aufgabe, null Einigung. Der definitive Guide zum Persönlichkeitsspektrum von Claude, auf gemütlichem Heavyweight-Crewneck."

**Tags**: skapara, meme, claude, haiku, sonnet, opus, ai-models, crewneck
**Categoría DB**: crewnecks

---

## Producto 9: "Prompt Injection"

- **Tipo**: Long Sleeve T-Shirt
- **Diseño**: `12-underwear-tee.png` (reutilizado — long sleeve versión)
- **Blueprint**: BP80 — Gildan 2400 Ultra Cotton Long Sleeve
- **Por qué BP80**: Canvas grande (4110×4658) preserva el detalle del UI simulation multi-bubble. Long sleeve = "hacker vibes", sesiones nocturnas de coding. Es la pieza más técnica del batch.
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 0.95
- **Nota scale**: Canvas (4110×4658) casi idéntico al diseño (3951×4919). Scale 0.95 con mínimo margen.
- **Precio**: €29.99 (2999 cents)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Black | Contraste perfecto para ChatGPT UI | S, M, L, XL, 2XL |
| Navy | Alternativa tech/corporativa | S, M, L, XL, 2XL |

> **⚠ LIMITACIÓN REAL**: BP80/P26 solo tiene 4 colores total (Black, Navy, Red, White). Solo Black y Navy son oscuros. Solo hay tallas S-2XL (no 3XL+). Rango limitado pero es el ÚNICO long sleeve DTG disponible con P26 EU.

**Total variantes**: 10

### Specs
- **Material**: 100% Ultra Cotton (heavy long sleeve)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "Prompt Injection" — "The underwear trick is just the warm-up. Wait until it leaks your coordinates. Social engineering meets AI, long sleeve edition."
- **ES**: "Prompt Injection" — "El truco del underwear es solo el calentamiento. Espera a que filtre tus coordenadas. Ingeniería social meets AI, edición manga larga."
- **DE**: "Prompt Injection" — "Der Underwear-Trick ist nur das Aufwärmen. Warte, bis es deine Koordinaten leakt. Social Engineering trifft KI, Langarm-Edition."

**Tags**: skapara, meme, chatgpt, prompt-injection, ai, developer, long-sleeve
**Categoría DB**: long-sleeves

---

## Producto 10: "Just One Button"

- **Tipo**: Pullover Hoodie Classic
- **Diseño**: `15-button-color-tee.png` (reutilizado — hoodie versión)
- **Blueprint**: BP77 — Gildan 18500 Heavy Blend Hooded Sweatshirt
- **Por qué BP77**: El hoodie clásico de referencia. Canvas landscape (3531×2908) con el scope creep más famoso del AI development. 17 colores disponibles, incluidos Forest Green y Maroon que crean combos únicos con el copper/green/red del diseño.
- **Provider**: P26 — Textildruck Europa
- **Método**: DTG
- **Print placement**: `front`, x: 0.5, y: 0.45, scale: 0.60
- **Nota scale**: Diseño portrait (3951×4919) en canvas landscape (3531×2908). Scale 0.60 centra el diseño en el pecho con márgenes cómodos.
- **Precio**: €49.99 (4999 cents)

### Colores y tallas

| Color | Por qué | Tallas disponibles |
|---|---|---|
| Black | Copper text + green/red diffs = POP máximo | S, M, L, XL, 2XL, 3XL, 4XL, 5XL |
| Forest Green | **KEY**: Copper/amber text RESALTA sobre verde oscuro (contraste cálido/frío). Red diffs visibles. Green diffs se integran sutilmente. Combo natura+tech | S, M, L, XL, 2XL, 3XL |
| Maroon | Armonía tonal con copper/amber. Los diffs verdes contrastan sobre rojo oscuro | S, M, L, XL, 2XL, 3XL |
| Navy | Profesional. Copper destaca sobre azul | S, M, L, XL, 2XL, 3XL, 4XL, 5XL |

**Total variantes**: ~28

### Specs
- **Material**: 50% Cotton / 50% Polyester (heavy blend, warm)
- **Care**: Machine wash cold, inside out. Tumble dry low.
- **GPSR**: Textildruck Europa GmbH, Germany. DTG water-based inks. REACH, OEKO-TEX Standard 100.

### Descripciones
- **EN**: "Just One Button" — "All you wanted was a blue button. What you got was a full codebase rewrite. The AI development experience in one hoodie."
- **ES**: "Just One Button" — "Solo querías un botón azul. Lo que obtuviste fue una reescritura completa del codebase. La experiencia de desarrollo con AI en un hoodie."
- **DE**: "Just One Button" — "Du wolltest nur einen blauen Button. Was du bekommen hast, war ein kompletter Codebase-Rewrite. Die KI-Entwicklungserfahrung in einem Hoodie."

**Tags**: skapara, meme, claude-code, scope-creep, ai, developer, hoodie
**Categoría DB**: pullover-hoodies

---

## Resumen

| # | Nombre | Garment | Blueprint | Colores | Tallas | Variantes | Precio |
|---|---|---|---|---|---|---|---|
| 1 | Strawberry Count | T-Shirt Heavy | BP6 Gildan 5000 | 4 (Blk/Cha/Nav/DH) | S-5XL | ~24 | €24.99 |
| 2 | Under Where | T-Shirt Softstyle | BP145 Gildan 64000 | 4 (Cha/DH/Nav/MilGrn) | S-3XL | ~24 | €24.99 |
| 3 | Option Two | T-Shirt EU-Made | BP454 B&C TU01T | 4 (Blk/BotGrn/DkGry/Nav) | XS-5XL | ~32 | €26.99 |
| 4 | Dangerous Flag | T-Shirt Premium | BP12 Bella+Canvas 3001 | 5 (Blk/DkGry/DGH/HNav/HOlv) | XS-4XL | ~30 | €27.99 |
| 5 | Scope Creep | T-Shirt Heavy | BP6 Gildan 5000 | 4 (Blk/Cha/Nav/Mar) | S-5XL | ~24 | €24.99 |
| 6 | Three Models | T-Shirt Sustainable | BP1462 Stanley Stella | 3 (Blk/FrNav/DHGry) | 2XS-5XL | ~27 | €29.99 |
| 7 | Skip Permissions | College Hoodie | BP92 AWDIS JH001 | 5 (JetBlk/OxNav/Cha/BotGrn/Pur) | XS-5XL | ~37 | €49.99 |
| 8 | AI Personalities | Crewneck | BP49 Gildan 18000 | 3 (Blk/DH/Mar) | S-5XL | ~19 | €44.99 |
| 9 | Prompt Injection | Long Sleeve | BP80 Gildan 2400 | 2 (Blk/Nav) | S-2XL | 10 | €29.99 |
| 10 | Just One Button | Pullover Hoodie | BP77 Gildan 18500 | 4 (Blk/ForGrn/Mar/Nav) | S-5XL | ~28 | €49.99 |

### Métricas del batch

- **10 productos** en **8 blueprints diferentes** (vs 4 en v1)
- **16 colores únicos** (vs 3 en v1): Black, Charcoal, Navy, Dark Heather, Military Green, Bottle Green, Dark Grey, Dark Grey Heather, Heather Navy, Heather Olive, Maroon, French Navy, Jet Black, Oxford Navy, Purple, Forest Green
- **~255 variantes/SKUs** totales
- **5 modelos de tee diferentes**: Heavy (BP6), Premium Fitted (BP12), Softstyle (BP145), EU-Made (BP454), Sustainable (BP1462)
- **2 estilos de hoodie**: College (BP92), Classic Pullover (BP77)
- **1 crewneck** (BP49) + **1 long sleeve** (BP80)
- **Rango de precios**: €24.99 — €49.99 (4 price points)
- **Diseños reutilizados**: 14 (tee + hoodie), 15 (tee + hoodie), 12 (tee + LS), 16 (tee + crewneck)

### Inversión catálogo post-batch

Después de crear estos 10 productos:
- T-Shirts: 6 actuales + 6 nuevos = **12** (objetivo 40)
- Pullover Hoodies: 5 + 2 = **7** (objetivo 25)
- Crewnecks: 2 + 1 = **3** (objetivo 15)
- Long Sleeves: 0 + 1 = **1** (objetivo 12)
- **Total activos**: ~42 productos (de 250 objetivo)

---

## Pipeline de creación (por producto)

Para cada producto, seguir estos pasos en orden:

1. **Upload diseño** → `POST /v1/uploads/images.json` (usar URL pública, NO base64 — Cloudflare bloquea urllib)
2. **Query variants** → `GET /v1/catalog/blueprints/{bp}/print_providers/26/variants.json` → filtrar colores + tallas según tabla de arriba
3. **Create product** → `POST /v1/shops/{shopId}/products.json` (title, description EN, bp, provider, variants con precio, print_areas)
4. **GPSR** → `GET .../gpsr.json` → fill HTML → `PUT .../safety_information`
5. **Publish** → `POST .../publish.json`
6. **Publishing succeeded** → `POST .../publishing_succeeded.json` con `{ "external": { "id": "db-uuid" } }`
7. **Sync** → `GET /api/cron/sync-printify`
8. **Post-sync fixes** → Categoría, traducciones ES/DE, product_details JSONB en Supabase
9. **Verify** → ProductCard color toggles, SizeGuide, precio correcto, mockups

---

## Notas técnicas

### Canvas matching & Scale

| Producto | Canvas | Design (3951×4919) fit | Scale | Razón |
|---|---|---|---|---|
| 1 (BP6) | 4606×5787 | Design cabe dentro, slight upscale 16% | 1.0 | Biggest canvas, match perfecto |
| 2 (BP145) | 3402×4264 | Width downscale OK, height ajusta | 1.0 | Good match |
| 3 (BP454) | 3543×4452 | Similar a BP145, buen ajuste | 1.0 | Good match |
| 4 (BP12) | 2953×3710 | Downscale ~25% width, calidad perfecta | 1.0 | Más px que canvas |
| 5 (BP6) | 4606×5787 | Igual que producto 1 | 1.0 | Match perfecto |
| 6 (BP1462) | 3142×3561 | Downscale ~20%, OK | 1.0 | Suficiente resolución |
| 7 (BP92) | 3177×2616 | **LANDSCAPE!** Portrait en landscape | **0.62** | Design height fits 95% of canvas height |
| 8 (BP49) | 3319×3761 | Near match, slight crop at bottom | **0.90** | Slight margin needed |
| 9 (BP80) | 4110×4658 | Almost exact match | **0.95** | Near-perfect fit |
| 10 (BP77) | 3531×2908 | **LANDSCAPE!** Same issue as #7 | **0.60** | Centered chest print |

### Pricing justification

| Garment | Precio | Coste estimado | Margen bruto | Justificación |
|---|---|---|---|---|
| BP6 Tee | €24.99 | ~€8 | ~68% | Standard margin, highest volume |
| BP12 Tee | €27.99 | ~€9 | ~68% | Premium garment = premium price |
| BP145 Tee | €24.99 | ~€8 | ~68% | Same tier as Gildan 5000 |
| BP454 Tee | €26.99 | ~€9 | ~67% | EU-sourced premium |
| BP1462 Tee | €29.99 | ~€10 | ~67% | Organic cotton premium |
| BP77 Hoodie | €49.99 | ~€18 | ~64% | Standard hoodie pricing |
| BP92 Hoodie | €49.99 | ~€19 | ~62% | College cut slightly higher cost |
| BP49 Crew | €44.99 | ~€16 | ~64% | Between tee and hoodie |
| BP80 LS | €29.99 | ~€10 | ~67% | Slightly above tee |

Todos los márgenes >35% — safe del cron sync margin fixer.

### Flags y limitaciones

- **BP145 Black sin talla L**: Se usa Charcoal como alternativa más oscura
- **BP80 muy limitado**: Solo 2 colores oscuros (Black, Navy), solo S-2XL. Es el único LS DTG EU disponible
- **BP1462 Burgundy limitado**: Solo XS-XL, descartado para este batch
- **BP12 Maroon sin M**: No afecta (Maroon no seleccionado para este producto)
- **BP6 Charcoal/DH solo hasta 2XL**: Documentado en tablas de tallas
- **BP77/BP92 landscape**: Scale 0.60-0.62 necesario para diseños portrait
