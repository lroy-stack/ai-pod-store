# SKAPARA Brand Identity — Based on Real Product Designs

## Core Identity

**SKAPARA** — European POD (Print-on-Demand) tech merch brand.
EU-made, AI-designed. Where tech culture meets streetwear.

**Target audience**: Tech professionals 25-45 con dinero, europeos. Devs, designers, data scientists, AI engineers, startup founders. Ironic humor, aprecian calidad. Un poco freaky.

---

## Logo Assets (`/frontend/public/brand/`)

- `skapara-mark-color.svg` — S mark con gradiente completo
- `skapara-mark-dark.svg` — S mark en Navy #0F172A
- `skapara-mark-white.svg` — S mark en blanco
- `skapara-wordmark-dark.svg` — "SKAPARA" wordmark

### Variantes de Brand por Producto (de `brand-designs/` y `branded-previews/`)

| Variante | S Mark | Wordmark | Usar para |
|---|---|---|---|
| **Noir** | Navy #0F172A sólido | Navy #0F172A | Mugs, bottles (fondo blanco), prendas claras |
| **White** | Blanco sólido | Blanco | Prendas oscuras (Black, Navy, Charcoal) |
| **Full Gradient** | Coral→Magenta→Púrpura→Azul→Turquesa | Gradiente completo | SOLO stickers, select sublimación |
| **Ocean** | Azul→Turquesa (subset frío) | Azul→Turquesa | Tumblers fríos, bottles |
| **Warm** | Coral→Magenta→Púrpura (subset cálido) | Coral→Magenta→Púrpura | Tumblers cálidos, mugs especiales |

**REGLA**: Gradiente NUNCA en DTG garments. Garments usan Noir o White según color de prenda.

---

## Paleta de Colores REAL (extraída de diseños existentes)

### Colores de acento para memes/text designs
| Color | Hex | Uso real |
|---|---|---|
| Verde | `#10B981` | Punchlines, terminal text, diffs "+", ChatGPT responses |
| Púrpura | `#A78BFA` | Definiciones, coding terms, statements sutiles |
| Cobre/Orange | `#D97706` | Atribuciones ("— Every Claude response ever"), warm accents |
| Rojo | `#EF4444` | Error codes (404), debugging, diffs "-", alertas |
| Ámbar/Gold | `#F59E0B` | Highlights, créditos, flechas transicionales |

### Colores brand
| Color | Hex | Uso real |
|---|---|---|
| Navy | `#0F172A` | S mark/wordmark sobre fondo claro, color base |
| White | `#FFFFFF` | Ghost text sobre prendas oscuras, S mark dark garment |
| Turquesa | `#40ACCC` | Corner brackets decorativos, underlines, ocean variant |
| Coral | `#F97066` | Inicio del gradiente warm, sticker fills |

### Gradiente oficial (7 stops)
```
#F97066 (coral) → #E22C8B (magenta) → #C42E86 (fuchsia) → #9C5BD6 (purple) → #5438CD (violet) → #2536A4 (dark blue) → #40ACCC (turquoise)
```

---

## Voice & Tone

### Product Names
- Short, punchy, 1-3 palabras
- Tech terms, code references, meme phrases, conceptos abstractos
- Existentes: "Vibe Coder", "Ghost Tee", "Shadow Tee", "Friday Deploy", "Dark Mode", "Prompt Me", "404 Dev", "Git Reset", "Full Credit", "Refactor Anyway"

### Product Descriptions (el campo `description`)
- Casual pero smart. Como un dev explicando su side project
- Referencia tech culture naturalmente, sin forzar
- 2-3 frases max
- SOLO texto creativo/marketing — NO material, NO care, NO specs
- Traducir a EN, ES, DE

### Meme Phrases REALES (del catálogo actual)
**AI/Claude humor:**
- "You're absolutely right!" — Every Claude response ever
- "I didn't write this code. But I take full credit."
- `--dangerously-skip-permissions`
- `> claude "change button color to blue"` → edita 47 archivos
- Haiku: "OK I go do the thing" / Sonnet: "let me think about the best way" / Opus: "are you sure it is the right choice"

**Developer life:**
- "I don't write code anymore. I write prompts."
- "My code has no bugs. It has AI-generated features."
- "I'll refactor it anyway."
- "( spent 6 hours debugging )"
- `career_progression.js — 2026 edition: SENIOR DEV → PROMPT ENGINEER`
- `// when Claude rewrites your entire codebase`
- `404 — DEVELOPER NOT FOUND — replaced by Claude, ChatGPT & Cursor`
- "vibe coding" (definición de diccionario)

**ChatGPT memes:**
- "How many R in strawberry?" → "3 strawberries"
- "Look under there" → "Under where?" → prompt injection
- Classic AI fails y quirks

---

## Patrones de Diseño por Categoría

### DTG Garments (T-Shirts, Hoodies, Crewnecks, Long Sleeves, Zip Hoodies)
- **Patrón dominante**: Two-Tone Text Hierarchy (setup ghost + punchline bold)
- **Patrón secundario**: UI Simulation (ChatGPT/Claude Code interfaces)
- **Patrón minoritario**: Extreme Minimalism (1 frase, 80% vacío)
- **Colores**: 1-2 colores acento sobre fondo transparente
- **Font**: Sans-serif bold (Inter, Bebas Neue) + monospace para tech elements
- **NUNCA**: gradiente, ilustraciones complejas, múltiples colores

### Headwear (Caps, Snapbacks, Beanies, Bucket Hats)
- **Patrón dominante**: Ilustrativo/Geométrico (escenas simplificadas)
- **Temática**: Nature + vibes (sunsets, waves, mountains, urban)
- **Colores**: 3-4 max (compatible con bordado: 2-3 hilos)
- **NUNCA**: texto largo, UI simulations, patterns complejos

### Fleece/Premium Hoodies
- **Patrón**: Decorative Branding (S mark + corner brackets + underline)
- **Colores**: Blanco + turquesa + púrpura sobre prenda oscura
- **Estilo**: Premium, sutil, no grita

### Drinkware (Mugs, Bottles, Tumblers)
- **Patrón branded**: Logo lockup horizontal (S mark + wordmark)
- **Variantes**: Noir (blanco bg), Ocean (azul gradient), Warm (coral gradient)
- **Patrón meme**: Terminal-style text (para mousepad/desk accessories)

### Stickers
- **Patrón**: S mark con FULL gradient, die-cut
- ÚNICO producto que usa el gradiente completo de forma prominente

### Desk Mats
- **Patrón**: Repeating S mark tiled pattern (B&W)
- O terminal-style text para meme gaming pads

### Sneakers
- **Patrón**: White S mark + wordmark en body panels, S mark solo en tongues
- Diseño sobrio, branding sutil

---

## What SKAPARA is NOT

- Not generic AI-generated art slop (Redbubble/Teepublic quality)
- Not corporate tech merch (boring logos en polo shirts)
- Not heavily illustrated (TEXT > drawings, excepto headwear)
- Not American streetwear (European clean, not NYC gritty)
- Not cheap-looking (premium blanks, quality print, considered design)
- Not trend-chasing (timeless minimalism > TikTok trends)
- Not rainbow/multicolor (1-2 colores acento por diseño, SIEMPRE)
- Not using gradiente en ropa DTG (gradiente = sublimación/stickers ONLY)
