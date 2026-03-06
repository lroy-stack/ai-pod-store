# Product Plan: SKAPARA Kids Collection — 8 Productos Junior

**Fecha**: 2026-02-28
**Estado**: EN PROGRESO — blueprints verificados, diseños pendientes
**Colección**: Kids / Junior (bebé a adolescente)
**Provider principal**: P26 — Textildruck Europa (Alemania) | P90 — Smart Printee (clogs)
**Método**: DTG + Sublimación AOP (clogs)

---

## Blueprints EU Verificados (API consultada 2026-02-28)

| BP | Producto | Provider | Colores | Tallas | Variantes | Rango edad |
|---|---|---|---|---|---|---|
| BP81 | Kids Softstyle Tee (Gildan 64000B) | P26 | 10: Charcoal, Irish Green, Light Blue, Navy, Purple, Red, Sport Grey, White, Black, Light Pink | XS, S, M, L, XL | 49 | 2-14 años |
| BP157 | Kids Heavy Cotton Tee (Gildan 5000B) | P26 | 6: Navy, Red, Black, Irish Green, White, Light Pink | XS, S, M, L, XL | 29 | 2-14 años |
| BP67 | Kids Hoodie (AWDIS JH001J) | P26 | 11: Arctic White, Baby Pink, Bottle Green, Candyfloss Pink, Charcoal, Fire Red, Heather Grey, Jet Black, Oxford Navy, Sky Blue, Sun Yellow | 2XS, XS, S, M, L, XL | 66 | 3-14 años |
| BP65 | Kids Sweatshirt/Crewneck (AWDIS JH030J) | P26 | 10: Arctic White, Bottle Green, Charcoal, Fire Red, Heather Grey, Jet Black, Oxford Navy, Sky Blue, Sun Yellow, Baby Pink | XS, S, M, L, XL | 50 | 3-14 años |
| BP1025 | Baby T-Shirt | P26 | 7: Black, Dusty Blue, Heather Grey Melange, Nautical Navy, Powder Pink, Red, White | NB (0-3M), 3-6M, 6-12M, 12-18M, 18-24M, 2-3 yrs | 41 | 0-3 años |
| BP1045 | Baby Organic SS Bodysuit | P26 | 6: Dusty Blue, Heather Grey Melange, Nautical Navy, Powder Pink, Red, White | NB (0-3M), 3-6M, 6-12M, 12-18M | 22 | 0-18 meses |
| BP974 | Baby LS Organic Bodysuit | P26 | 2: Black, White | NB (0-3M), 3-6M, 6-12M, 12-18M | 8 | 0-18 meses |
| BP1534 | Kids EVA Foam Clogs (AOP) | P90 | 2: Black, White | US 6.5, 8, 9.5, 11, 12, 13.5 (Kids) | 12 | 3-10 años |

**Nota**: BP157 y BP65 tienen formato de variante invertido (Size / Color en vez de Color / Size). El parseColorSize() del script ya lo maneja.

---

## 8 Productos — Definición

### 1. "I'm Not Crying, I'm Compiling"
- **Prenda**: BP1045 Baby Organic SS Bodysuit (P26)
- **Categoría**: baby-clothing
- **Colores**: White, Powder Pink, Dusty Blue
- **Tallas**: NB (0-3M), 3-6M, 6-12M, 12-18M
- **Precio**: €19.99
- **Concepto diseño**: Barra de progreso estilo loading al 73% + texto monospace "compiling tears.exe..." arriba, "I'm Not Crying, I'm Compiling" como punchline. Ilustración minimalista de carita de bebé pixelada o emoji robot bebé.
- **Paleta diseño**: Verde terminal (#10B981) + texto blanco ghost + punchline bold
- **Canvas**: PENDIENTE consultar API
- **Traducciones**:
  - EN: "I'm Not Crying, I'm Compiling" — Every build has its tears. Your baby's first debug session starts here.
  - ES: "I'm Not Crying, I'm Compiling" — Cada build tiene sus lágrimas. La primera sesión de debug de tu bebé empieza aquí.
  - DE: "I'm Not Crying, I'm Compiling" — Jeder Build hat seine Tränen. Die erste Debug-Session deines Babys beginnt hier.

### 2. "Bug Reporter (Junior Dev)"
- **Prenda**: BP1025 Baby T-Shirt (P26)
- **Categoría**: baby-clothing
- **Colores**: White, Heather Grey Melange, Nautical Navy
- **Tallas**: NB (0-3M), 3-6M, 6-12M, 12-18M, 18-24M, 2-3 yrs
- **Precio**: €17.99
- **Concepto diseño**: Estilo badge/credencial de empresa tech con borde redondeado. "SKAPARA INC." arriba, ilustración minimalista de bichito (bug) con antenas simpáticas, debajo "BUG REPORTER" en bold, "Junior Dev — Level 0" en small.
- **Paleta diseño**: Rojo bug (#EF4444) + navy texto + ilustración línea simple
- **Canvas**: PENDIENTE
- **Traducciones**:
  - EN: "Bug Reporter (Junior Dev)" — Officially certified to find bugs in everything. Minimum experience required: 0 days.
  - ES: "Bug Reporter (Junior Dev)" — Certificado oficialmente para encontrar bugs en todo. Experiencia mínima requerida: 0 días.
  - DE: "Bug Reporter (Junior Dev)" — Offiziell zertifiziert, Bugs in allem zu finden. Mindesterfahrung: 0 Tage.

### 3. "sudo give me ice cream"
- **Prenda**: BP81 Kids Softstyle Tee (P26)
- **Categoría**: kids-tshirts
- **Colores**: Black, Navy, Charcoal, Purple
- **Tallas**: XS, S, M, L, XL
- **Precio**: €22.99
- **Concepto diseño**: Terminal window con borde y botones (rojo/amarillo/verde). Dentro: `$ sudo give me ice cream` en verde monospace, respuesta `[sudo] password for kid:` → `Permission granted. 🍦` con icono de helado minimalista.
- **Paleta diseño**: Verde terminal (#10B981) para comandos + blanco para respuesta + icono helado en color
- **Canvas**: PENDIENTE
- **Traducciones**:
  - EN: "sudo give me ice cream" — Root access to the freezer. For the kid who knows that with great permissions comes great ice cream.
  - ES: "sudo give me ice cream" — Acceso root al congelador. Para el niño que sabe que con grandes permisos viene gran helado.
  - DE: "sudo give me ice cream" — Root-Zugang zum Gefrierschrank. Für das Kind, das weiß: mit großen Berechtigungen kommt großes Eis.

### 4. "Error 404: Bedtime Not Found"
- **Prenda**: BP81 Kids Softstyle Tee (P26)
- **Categoría**: kids-tshirts
- **Colores**: Navy, Purple, Black, Light Blue
- **Tallas**: XS, S, M, L, XL
- **Precio**: €22.99
- **Concepto diseño**: Browser error page con icono de luna/estrella dormida en estilo pixel art o línea minimalista. Título grande "404" en bold, subtítulo "Bedtime Not Found", mensaje "The page you're looking for has been moved to: NEVER" en monospace.
- **Paleta diseño**: Púrpura (#A78BFA) para el 404 + amarillo estrella (#F59E0B) + blanco texto
- **Canvas**: PENDIENTE
- **Traducciones**:
  - EN: "Error 404: Bedtime Not Found" — This page has been permanently moved to NEVER. For the night owl who runs on infinite loops.
  - ES: "Error 404: Bedtime Not Found" — Esta página se ha movido permanentemente a NUNCA. Para el búho nocturno que corre en bucles infinitos.
  - DE: "Error 404: Bedtime Not Found" — Diese Seite wurde dauerhaft nach NIE verschoben. Für die Nachteule im Endlosloop.

### 5. "Ctrl+Z My Homework"
- **Prenda**: BP157 Kids Heavy Cotton Tee (P26)
- **Categoría**: kids-tshirts
- **Colores**: Black, Navy, White
- **Tallas**: XS, S, M, L, XL
- **Precio**: €22.99
- **Concepto diseño**: Teclas de teclado estilo 3D (con sombra) grandes mostrando "Ctrl" y "Z", entre ellas un "+" . Debajo en monospace: "Undo: Homework.docx" con un icono de papelera o flecha undo. Estilo keyboard retro/mecánico.
- **Paleta diseño**: Teclas en gris claro con borde oscuro + texto rojo (#EF4444) para "Homework.docx" + fondo transparente
- **Canvas**: PENDIENTE
- **Traducciones**:
  - EN: "Ctrl+Z My Homework" — The keyboard shortcut every student wishes actually worked. Undo level: expert.
  - ES: "Ctrl+Z My Homework" — El atajo de teclado que todo estudiante desearía que funcionara de verdad. Nivel de undo: experto.
  - DE: "Ctrl+Z My Homework" — Die Tastenkombination, die sich jeder Schüler wünscht. Undo-Level: Experte.

### 6. "AI Raised Me"
- **Prenda**: BP67 Kids Hoodie (P26)
- **Categoría**: kids-sweatshirts
- **Colores**: Jet Black, Oxford Navy, Sky Blue, Sun Yellow
- **Tallas**: 2XS, XS, S, M, L, XL
- **Precio**: €34.99
- **Concepto diseño**: Chat UI estilo los memes adultos de SKAPARA. Kid bubble: "How do I tie my shoes?" → AI bubble: "I'd be happy to help! Step 1: Take the lace..." → Kid: "Actually just use velcro" . Minimalista con icono de robot simpático arriba.
- **Paleta diseño**: Burbujas gris oscuro + texto blanco + acento turquesa (#40ACCC) para el nombre AI
- **Canvas**: PENDIENTE
- **Traducciones**:
  - EN: "AI Raised Me" — Generation Alpha's parenting co-pilot. For the kid who asks Siri before asking Mom.
  - ES: "AI Raised Me" — El copiloto de crianza de la Generación Alpha. Para el niño que le pregunta a Siri antes que a mamá.
  - DE: "AI Raised Me" — Der Erziehungs-Copilot der Generation Alpha. Für das Kind, das Siri vor Mama fragt.

### 7. "My Code Works (I Have No Idea Why)"
- **Prenda**: BP65 Kids Crewneck (P26)
- **Categoría**: kids-sweatshirts
- **Colores**: Jet Black, Charcoal, Oxford Navy
- **Tallas**: XS, S, M, L, XL
- **Precio**: €32.99
- **Concepto diseño**: Terminal con output de test results. Checkmarks verdes "✓ math.test — passed", "✓ reading.test — passed", "✓ code.test — passed", "✗ explaining_how.test — FAILED". Debajo en grande: "My Code Works" en bold, "(I Have No Idea Why)" en ghost text. Carita confusa minimalista ¯\_(ツ)_/¯
- **Paleta diseño**: Verde (#10B981) para checks + rojo (#EF4444) para fail + blanco texto
- **Canvas**: PENDIENTE
- **Traducciones**:
  - EN: "My Code Works (I Have No Idea Why)" — All tests passing. Zero understanding. The junior developer origin story.
  - ES: "My Code Works (I Have No Idea Why)" — Todos los tests pasan. Cero comprensión. El origin story del junior developer.
  - DE: "My Code Works (I Have No Idea Why)" — Alle Tests bestanden. Null Verständnis. Die Origin Story des Junior-Developers.

### 8. "Future Prompt Engineer"
- **Prenda**: BP1534 Kids EVA Foam Clogs AOP (P90)
- **Categoría**: kids (calzado)
- **Colores**: Black, White
- **Tallas**: US 6.5, 8, 9.5, 11, 12, 13.5
- **Precio**: €29.99
- **Concepto diseño**: All-over print con pattern repetitivo de prompts estilo terminal: "> imagine", "> create", "> dream big", "> play", "> learn" en tipografía monospace con diferentes opacidades. Mezcla de iconos minimalistas (estrella, rayo, cerebro, cohete) entre los textos.
- **Paleta diseño**: Gradiente suave SKAPARA (coral → turquesa) para los textos sobre fondo transparente/oscuro
- **Canvas**: PENDIENTE (6 áreas: left/right outer, inner, etc.)
- **Traducciones**:
  - EN: "Future Prompt Engineer" — Every step is a new prompt. For the kid who's already engineering the future, one word at a time.
  - ES: "Future Prompt Engineer" — Cada paso es un nuevo prompt. Para el niño que ya está ingenieriando el futuro, una palabra a la vez.
  - DE: "Future Prompt Engineer" — Jeder Schritt ist ein neuer Prompt. Für das Kind, das die Zukunft schon engineert, ein Wort nach dem anderen.

---

## Resumen de precios

| # | Producto | Prenda | Precio |
|---|---|---|---|
| 1 | I'm Not Crying, I'm Compiling | Baby Bodysuit | €19.99 |
| 2 | Bug Reporter (Junior Dev) | Baby T-Shirt | €17.99 |
| 3 | sudo give me ice cream | Kids Softstyle Tee | €22.99 |
| 4 | Error 404: Bedtime Not Found | Kids Softstyle Tee | €22.99 |
| 5 | Ctrl+Z My Homework | Kids Heavy Cotton Tee | €22.99 |
| 6 | AI Raised Me | Kids Hoodie | €34.99 |
| 7 | My Code Works (I Have No Idea Why) | Kids Crewneck | €32.99 |
| 8 | Future Prompt Engineer | Kids EVA Clogs | €29.99 |

## Distribución por edad

- **0-18 meses**: #1 Bodysuit
- **0-3 años**: #2 Baby Tee
- **2-14 años**: #3, #4, #5 Kids Tees + #6 Hoodie + #7 Crewneck
- **3-10 años**: #8 Clogs

## Siguiente paso

1. Consultar canvas dimensions para cada BP
2. Generar diseños SVG/PNG uno por uno
3. Crear productos en Printify
4. Sync + verificar mockups
