# Skills & Design Pipeline — Auditoría Completa

*Generado por agente de exploración 2026-03-09*

## Resumen

4 skills core + 16 skills Printful-específicos documentan cada aspecto de la creación de productos.

## Skills Core

### design-dtg (P26 Textildruck Europa, Alemania)
- 10-step pipeline: diseño → PNG transparente → upload → crear producto → GPSR → publish → sync
- 9 blueprints con canvas specs exactos (BP6: 4606x5787, BP12: 2953x3710, etc.)
- Reglas: PNG-24 transparente, 300 DPI mínimo, 5% margins, 1-2 colores acento
- Pricing: Tees €24.99-29.99 (~60% margin), Hoodies €44.99-54.99 (~55%)
- Multi-position: front (obligatorio) + back + neck (S mark) + sleeves

### design-embroidery (P410 Printful, Latvia)
- MAX 3 colores de hilo (preferir 2), SIN gradientes, SIN transparencia
- Líneas mín 1.5mm, texto mín 5mm, paths cerrados (SVG Z)
- 7 blueprints: BP793 Hoodie (1200x1200), BP1744 Cap (1770x600), etc.
- Pricing: Caps €27.99-32.99 (~57%), Hoodies bordadas €59.99 (~53%)

### design-sublimation (Multiple providers)
- Colores ILIMITADOS, gradientes PERMITIDOS
- Wrap-around para drinkware, 2-3% bleed
- Mugs, botellas, tumblers, desk mats, stickers, sneakers
- Sneakers: 12 áreas de diseño por par

### product-catalog-planner
- Estado: 32 productos → target 250
- Solo EU providers (P26, P410, P90, P23, P30, P86, P255)
- GPSR obligatorio para CADA producto
- 8 colecciones de diseño definidas
- Roadmap en 4 fases

## 16 Skills Printful-Específicos (Embroidery)
- M2580 Premium Hoodie (verificado, 15 known issues documentados)
- SASU024 Stanley/Stella (orgánico)
- STSU177 con unlimited_color option
- 13 modelos de gorras/beanies/bucket hats

## Puntos Críticos para PodClaw v2
- SVG → PNG @300dpi pipeline no definida (qué herramienta renderiza?)
- Canvas specs disponibles como lookup tables por blueprint
- GPSR templates listos por método de impresión
- Brand identity completa (gradiente 7 stops, paleta de colores, patrones de diseño)
- Multi-position orchestration necesita lógica por tipo de producto

## Archivos Referencia
- `/project/.claude/skills/design-dtg/` (SKILL.md, CANVAS_SPECS.md, DESIGN_GUIDELINES.md)
- `/project/.claude/skills/design-embroidery/` (SKILL.md)
- `/project/.claude/skills/design-sublimation/` (SKILL.md)
- `/project/.claude/skills/product-catalog-planner/` (SKILL.md, PRICING_RULES.md, BRAND_IDENTITY.md)
- `/project/.claude/skills/printful-*-embroidery/` (16 directorios)
