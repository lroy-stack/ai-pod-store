# Design Guidelines — Your Brand — Based on Real Product Designs

## Brand Identity

**YOUR_BRAND_NAME** — European POD tech merch. Minimalist, text-heavy, AI/dev humor, premium feel. Público: tech professionals europeos con dinero, un poco freaky. Streetwear + Silicon Valley, diseñado en EU.

---

## PATRONES DE DISEÑO REALES (extraídos de productos existentes)

### Patrón A: Jerarquía de Texto a Dos Tonos (60% de los diseños meme)

El patrón MÁS usado. Estructura de "setup + punchline":

1. **Texto setup** (ghost/outline): Blanco, solo trazo sin relleno. Apenas visible en fondo blanco pero destaca en prendas oscuras
2. **Texto punchline** (bold sólido): Color de acento fuerte — verde, púrpura, cobre, ámbar
3. **Separador**: Línea horizontal fina entre setup y punchline
4. **Atribución/pie** (opcional): Texto ghost o pequeño en color acento

**Ejemplos reales:**
| Archivo | Setup (ghost) | Punchline (bold) | Color | Pie |
|---|---|---|---|---|
| `meme-designs/01-prompts-crewneck.png` | "I DON'T WRITE CODE ANYMORE." | "I WRITE PROMPTS." | Verde #10B981 | — |
| `meme-designs/02-absolutely-right-tee.png` | "YOU'RE" + "RIGHT!" | "ABSOLUTELY" | Cobre #D97706 | "— Every Claude response ever" |
| `meme-designs/05-no-bugs-tee.png` | "MY CODE HAS" + "It has" + "FEATURES." | "NO BUGS." + "AI-GENERATED" | Verde #10B981 | — |
| `meme-designs/09-full-credit-laptop.png` | "I DIDN'T WRITE THIS CODE." | "But I take full credit." | Ámbar #F59E0B | — |
| `meme-designs/10-404-dev-gaming-pad.png` | "DEVELOPER NOT FOUND" | "404" | Rojo #EF4444 | "replaced by Claude, ChatGPT & Cursor — since 2026" |

**Reglas del patrón:**
- Texto ghost: `fill: none; stroke: white; stroke-width: 2-3px` (o `opacity: 0.15` sobre blanco)
- Texto punchline: `font-weight: 800-900; fill: [color acento]`
- Separador: `stroke: [gris claro]; stroke-width: 1-2px; width: ~40% del canvas`
- Centrado vertical, ligeramente arriba del centro (y: 0.40-0.45)
- Font: Inter Bold / Bebas Neue para texto grande, sistema monospace para atribuciones

### Patrón B: Simulación de UI Tech (30% de los meme-previews)

Diseños que simulan interfaces reales de herramientas tech. Humor basado en reconocimiento de la UI.

**Ejemplos reales:**
| Archivo | Interfaz simulada | Chiste |
|---|---|---|
| `meme-previews/11-strawberry-tee.png` | ChatGPT 5 chat | "How many R in strawberry" → piensa 11s → "3" |
| `meme-previews/12-underwear-tee.png` | ChatGPT chat | "Look under there" → "Under where?" → prompt injection con coordenadas |
| `meme-previews/13-bypass-permissions-tee.png` | Claude Code terminal | Prompt de permisos, opción 2 "bypass permissions" seleccionada |
| `meme-previews/14-skip-permissions-tee.png` | Flag de CLI | `--dangerously-skip-permissions` en monospace blanco |
| `meme-previews/15-button-color-tee.png` | Claude Code terminal | "change button color to blue" → edita 47 archivos, +9847/-2103 líneas |
| `meme-previews/16-haiku-sonnet-opus-tee.png` | Comparación AI models | Haiku/Sonnet/Opus responden diferente al mismo task |

**Reglas del patrón:**
- Replicar la UI real lo más fielmente posible (burbujas chat, prompts terminal, diff stats)
- Monospace para elementos de terminal (JetBrains Mono / Courier)
- User messages: dark bubbles con texto blanco
- AI responses: texto en color acento (verde para ChatGPT, coral para Claude)
- Green `+lines` / Red `-lines` para diffs
- Fondo transparente (se imprime sobre la prenda)
- El humor viene del reconocimiento de la interfaz — NO explicar el chiste

### Patrón C: Minimalismo Extremo (10% de memes)

Una frase o elemento ultra-reducido con masivo espacio negativo (80%+ vacío).

**Ejemplos reales:**
| Archivo | Contenido | Posición | Color |
|---|---|---|---|
| `meme-designs/04-built-2hours-ls.png` | `( spent 6 hours debugging )` | Centro-bajo | Rojo #EF4444 monospace |
| `meme-designs/08-refactor-anyway-zip.png` | "I'LL REFACTOR IT ANYWAY." | Centro | Púrpura #A78BFA bold |
| `meme-previews/14-skip-permissions-tee.png` | `--dangerously-skip-permissions` | Centro | Blanco monospace |

**Reglas del patrón:**
- Máximo 1 línea de texto
- 80%+ del canvas vacío (fondo transparente)
- Texto en posición inesperada (no siempre centrado perfecto)
- Monospace para strings que parecen código, sans-serif bold para statements
- Un solo color de acento

### Patrón D: Poster/Diagrama (memes complejos)

Composiciones multi-elemento que cuentan una "historia" visual tipo poster/infographic.

**Ejemplos reales:**
| Archivo | Estructura |
|---|---|
| `meme-designs/06-prompt-engineer-poster.png` | Título monospace verde ("career_progression.js — 2026 edition") + ghost "SENIOR DEV" → flecha → bold verde "PROMPT ENGINEER" + separador + pie ghost |
| `meme-designs/03-vibe-coding-tee.png` | Estilo diccionario: ghost "VIBE" + bold púrpura "CODING" + fonética + definición italic + atribución |
| `meme-designs/07-git-reset-mousepad.png` | Terminal: "$" verde arriba + espacio masivo + pie rojo monospace abajo |

**Reglas del patrón:**
- Múltiples "zonas" de contenido separadas por espacio o separadores
- Mezcla de fonts: monospace para elementos tech + sans-serif para statements
- Mezcla de colores: verde para tech, ghost para setup, bold color para énfasis
- Más complejo que Patrón A pero mantiene el minimalismo de la marca

---

## PATRONES DE DISEÑO BRANDED (colección Core)

### Patrón E: Logo Lockup (branded-previews/)

Composición S mark + wordmark "YOUR_BRAND_NAME" adaptada al canvas de cada producto.

**Variantes de color:**
| Variante | S Mark | Wordmark | Uso |
|---|---|---|---|
| Noir/Dark | Navy #0F172A sólido | Navy #0F172A | Prendas claras, mugs, bottles (fondo blanco) |
| White | Blanco sólido | Blanco | Prendas oscuras (Black, Navy, Charcoal) |
| Full Gradient | Coral→Magenta→Púrpura→Azul→Turquesa | Mismo gradiente | SOLO stickers y select sublimación |
| Ocean | Azul→Turquesa (subset frío) | Mismo gradiente | Tumblers, bottles, accesorios fríos |
| Warm | Coral→Magenta→Púrpura (subset cálido) | Mismo gradiente | Tumblers, mugs, accesorios cálidos |

**Ejemplos reales:**
| Archivo | Variante | Orientación | Canvas target |
|---|---|---|---|
| `branded-previews/01-brand-noir-mug.png` | Noir | Horizontal | 2244×945 (mug BP1018) |
| `branded-previews/02-brand-signal-bottle.png` | Noir | Horizontal | 2759×1500 (bottle BP854) |
| `branded-previews/03-brand-core-crewneck.png` | White | Vertical | 3366×4230 (crew BP457) |
| `branded-previews/04-brand-edge-longsleeve.png` | White | Vertical, upper-left | 4110×4658 (LS BP80) |
| `branded-previews/05-brand-grip-deskmat.png` | Pattern B&W | Tiled diagonal | 7205×3661 (desk BP969) |
| `branded-previews/06-brand-step-sneaker-*.png` | White | Small, positioned | 1433×649 per area |
| `branded-previews/07-brand-pack-sticker.png` | Full Gradient | Mark only (die-cut) | 4500×4500 (sticker BP476) |
| `brand-designs/bottle-dark.png` | Noir | Horizontal | Bottle shape |
| `brand-designs/bottle-gradient.png` | Full Gradient | Horizontal | Bottle shape |
| `brand-designs/tumbler-ocean.png` | Ocean | Horizontal | Tumbler shape |
| `brand-designs/tumbler-warm.png` | Warm | Vertical | Tumbler shape |
| `brand-designs/hoodie-dark.png` | Noir | Vertical | Hoodie chest |
| `brand-designs/hoodie-white.png` | White | Vertical | Hoodie chest (dark garment) |

**Reglas del lockup:**
- **Horizontal** para productos landscape (mugs, bottles, tumblers, desk mats): S mark izquierda + wordmark derecha
- **Vertical** para productos portrait (tees, hoodies, crewnecks): S mark arriba + wordmark abajo
- **Upper-left** para long sleeves (posición chest/left-chest)
- **Mark only** (sin wordmark) para áreas pequeñas: sneaker tongues, stickers
- **Pattern/tiled** para superficies grandes: desk mats
- NUNCA usar gradiente en garments DTG — usar Noir o White según color de prenda
- Gradiente SOLO en sublimación/UV: stickers, drinkware, accesorios

### Patrón F: Decorativo Branded (fleece-designs/)

S mark centrado con elementos decorativos geométricos.

**Ejemplos reales:**
- `fleece-designs/preview-chest-black.png` — S mark blanco 3D centrado + bracket angular turquesa (#40ACCC) esquina superior-izquierda + bracket angular púrpura esquina inferior-derecha + línea de subrayado turquesa
- `fleece-designs/preview-chest-charcoal.png` — Mismo diseño sobre fondo charcoal

**Reglas del patrón:**
- S mark centrado como elemento principal
- Corner brackets decorativos en colores brand (turquesa + púrpura)
- Efecto 3D/profundidad sutil en el S mark
- Underline accent en turquesa
- Para fleece, zip hoodies, prendas premium

---

## PATRONES PARA HEADWEAR (hat-designs/)

### Patrón G: Ilustrativo/Geométrico (gorras y sombreros)

A diferencia de TODO el resto del catálogo, los headwear usan **ilustraciones**, NO texto.

**Ejemplos reales:**
| Archivo | Composición | Paleta |
|---|---|---|
| `hat-designs/neon-horizon.png` | Círculo de sunset retro (degradado coral→naranja→amarillo→púrpura) + silueta de palmera + líneas geométricas de acento | Cálida: corales, naranjas, púrpuras |
| `hat-designs/ocean-lines.png` | Líneas ondulantes con grosor variable (representando olas) + círculo de luna + minimalista | Fría: teal/turquesa sobre transparente |
| `hat-designs/street-script.png` | Texto bold "GRIND NEVER STOP" en negro + línea separadora roja + textura distressed | B&W + rojo acento |
| `hat-designs/summit-moon.png` | Triángulos geométricos (montañas) en tonos slate/navy + luna + puntos de estrellas | Fría: navy, slate, blanco |

**Reglas del patrón hat:**
- **Escenas geométricas simplificadas** — no realistas, siluetas y formas
- **Temática**: naturaleza + vibes (sunset, ocean, mountain, urban)
- **Paleta limitada**: 3-4 colores máx (compatible con bordado si se adapta)
- **Centrado en canvas pequeño** (1770×600 para caps): diseño compacto, ~60-80% del canvas
- **Excepto street-script**: texto motivacional bold en gorras es aceptable pero menos frecuente
- Para SUBLIMACIÓN en gorras: colores ilimitados. Para BORDADO: adaptar a 2-3 colores sólidos

---

## PALETA DE COLORES REAL (usada en productos existentes)

### Colores de acento para texto (meme collection)
| Color | Hex | Uso real | Frecuencia |
|---|---|---|---|
| Verde | `#10B981` | Punchlines, terminal, diffs, ChatGPT | Alta |
| Púrpura | `#A78BFA` | Definiciones, coding terms, statements | Alta |
| Cobre/Orange | `#D97706` | Atribuciones, warm accents | Media |
| Rojo | `#EF4444` | Error codes (404), debugging, diffs negativos | Media |
| Ámbar/Gold | `#F59E0B` | Highlights, créditos, arrows | Baja |

### Colores brand
| Color | Hex | Uso real |
|---|---|---|
| Navy | `#0F172A` | S mark en prendas claras, base color |
| White | `#FFFFFF` | Ghost text en prendas oscuras, S mark dark garment |
| Turquesa | `#40ACCC` | Corner brackets, underlines, ocean variant |
| Coral | `#F97066` | Warm gradient start, sticker fills |

### Lo que NO se usa en la práctica
- **Full gradient en garments** — NUNCA. El gradiente va SOLO en stickers y drinkware (sublimación)
- **Azul link #3B82F6** — No aparece en ningún diseño real
- **Grises (#94A3B8)** — Solo como separadores, nunca como color principal
- **Múltiples colores de acento juntos** — Cada diseño usa 1-2 colores max (no arcoíris)

---

## TIPOGRAFÍA REAL (observada en diseños)

### Para texto de impacto (Patrones A, C, D)
- **Sans-serif bold/black** (Inter, Oswald, Bebas Neue): titulares, punchlines
- Weight 800-900 para máximo impacto
- All-caps para statements

### Para texto ghost/outline
- Misma font que el punchline pero `fill: none; stroke: white; stroke-width: 2-3px`
- O bien `opacity: 0.12-0.18` sobre fondo transparente

### Para elementos tech (Patrón B, terminal)
- **Monospace** (JetBrains Mono, Courier): prompts, CLI, code snippets
- `letter-spacing: 0.05em`
- Para diffs: verde para adiciones, rojo para eliminaciones

### Para atribuciones/pies
- Sans-serif regular weight
- Color acento al 60-70% opacity o italic
- Tamaño ~40-50% del texto principal

### Font Sizing (relativo al canvas)
| Elemento | % del alto del canvas |
|---|---|
| Hero text (1-3 palabras) | 8-15% |
| Punchline phrase | 5-8% |
| Setup text (ghost) | 5-8% (mismo tamaño que punchline) |
| Attribution/footnote | 2-4% |
| Micro decorativo | 1.5-2% |

---

## COMPOSICIÓN

### Posicionamiento vertical
- **Centro alto**: y: 0.40-0.45 (ligeramente arriba del centro real)
- **Para Patrón A**: setup text arriba + punchline abajo del separador
- **Para Patrón C**: texto puede estar descentrado (bajo, lateral)
- **print_areas y:0.45**: en Printify, posicionar a `y: 0.45` para garments

### Espacio negativo
- **Mínimo 30% vacío** — incluso los diseños más densos (Patrón D) respetan espacio
- **Patrón C: 80%+ vacío** — el espacio ES el diseño
- **Márgenes safe zone**: 5% desde bordes del canvas

### Jerarquía
- **1 elemento dominante** + 1 supporting max
- El ojo debe ir: punchline → setup → separator → attribution
- NUNCA competir — si el texto es el héroe, no hay iconos/gráficos (y viceversa en hats)

### Dark Garment Default
- **SIEMPRE diseñar para prenda oscura** como base (90% del catálogo es Black/Navy)
- Ghost text y S mark en blanco son invisibles en PNG viewer pero perfectos en prenda oscura
- Si se necesita versión para prenda clara: Navy #0F172A reemplaza al blanco

---

## ASSET DIRECTORIES — Referencia Rápida

```
/frontend/public/
├── brand/                    # SVG logos oficiales (mark + wordmark, dark/white/color)
├── brand-designs/            # Variantes branded para drinkware (hoodie, bottle, tumbler)
├── branded-previews/         # Diseños production-ready al tamaño exacto del canvas por BP
├── meme-designs/             # Diseños meme Patrón A/C/D (01-10, text-heavy)
├── meme-previews/            # Diseños meme Patrón B (11-16, UI simulation)
├── hat-designs/              # Diseños ilustrativos para headwear (Patrón G)
├── fleece-designs/           # Diseños decorativo-branded para fleece (Patrón F)
├── zip-hoodie-designs/       # Diseños para zip hoodies
└── fonts/                    # Bebas Neue, Caveat, Dancing Script, Great Vibes, Pacifico, Permanent Marker
```

---

## CHECKLIST DE CALIDAD

- [ ] Fondo transparente (PNG-24, alpha channel)
- [ ] Dimensiones exactas del canvas target (ver CANVAS_SPECS.md)
- [ ] Safe zone respetada (5% margins)
- [ ] Texto legible a 2%+ del alto del canvas
- [ ] Máx 1-2 colores de acento por diseño
- [ ] Sigue uno de los patrones documentados (A, B, C, D, E, F, G)
- [ ] Funciona sobre prenda oscura (default)
- [ ] Ghost text visible SOLO en prenda oscura (no accidentalmente visible en blanco)
- [ ] Nombrado: `{collection}-{product-type}-{design-name}.png`
- [ ] Colores de la paleta real de la marca (NO azul, NO múltiples acentos)
- [ ] Si branded: variante correcta (Noir/White/Gradient) según producto
- [ ] Si meme: humor tech insider, no explicar el chiste
