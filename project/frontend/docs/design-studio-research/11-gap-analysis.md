# Analisis de Gaps — Informes de Investigacion del Modulo de Diseno

---

## Metodologia

Todos los hechos contrastados directamente contra el codebase. Se verificaron: conteos de lineas, constantes en codigo, existencia de rutas, estructura de directorios.

---

## Informe 1 — Modulo de Diseno AI (Codebase)

### Verificado correcto
- Lineas de archivos clave: DesignStudio.tsx ~415, ProductPersonalizer.tsx ~1051, AIPromptEditor.tsx ~71, AIPreviewCanvas.tsx ~137
- Endpoint que llama DesignStudio: `POST /api/designs/generate` (NO `/ai-generate`)
- `generationsRemaining = 10` hardcodeado (linea 70)
- PRINT_AREAS en canvas 1024x1024
- 12 fuentes y 16 swatches

### Gaps encontrados

| Gap | Detalle |
|---|---|
| **AuthGateOverlay + GenerationCostBadge** | No leidos, descripcion especulativa. AuthGateOverlay=42 lineas, GenerationCostBadge=27 |
| **Categorizacion fuentes** | Dice "4 sans, 3 serif, 1 display, 4 script". Real: 4 sans, 1 serif, 3 display, 4 script |
| **Providers individuales omitidos** | fal-provider.ts, ideogram-provider.ts, openai-provider.ts, recraft-provider.ts, background-removal.ts |
| **CartContext.tsx omitido** | Gestiona personalization?.surcharge — eslabon entre personalizationId y checkout |
| **Mockup templates** | Solo 7 archivos en /public/mockup-templates/. Faltan: hat, sneakers, tumblers, stickers, desk mats, kids, tanks |
| **Migracion 201500** | Archivo existe como untracked pero no se verifico si aplicada en produccion |

---

## Informe 2 — Capacidades Printful API (Codebase + Skills)

### Verificado correcto
- Embroidery placements, canvas sizes, restricciones MUTEX
- Endpoints del cliente Printful
- PRODUCTION_DIMENSIONS coinciden con codigo
- Pipeline branded mockups (rembg + Sharp + SVG composite)

### Gaps encontrados

| Gap | Detalle |
|---|---|
| **Contradiccion checkout** | Dice "temp product se crea en checkout" pero Informe 1 dice "no implementado". Verificacion: `provider_temp_product_id: null` siempre → Informe 1 tiene razon |
| **"479 productos"** | Numero sin fuente verificable. Accion: query real a Supabase |
| **Skill stsu177 omitido** | CLAUDE.md documenta 3 skills embroidery, informe solo investiga 2 |
| **22 docs internos no leidos** | Especialmente `design-module-audit.md` — auditoria previa relevante |
| **DTG-Film EU** | Afirmacion sin evidencia del skill o error especifico |
| **Directorio src/lib/pod/** | Omite sync/, webhooks/, models/, monitoring.ts |
| **v1 vs v2 API** | No distingue que endpoints son v1 y cuales v2 |

---

## Informe 3 — Mercado: Plataformas, Librerias y Referencias

### Verificado correcto
- 24 URLs de fuentes reales y verificables
- Datos de GitHub con fechas para librerias principales
- Mejores practicas UX bien documentadas
- Tabla comparativa util

### Gaps encontrados

| Gap | Detalle |
|---|---|
| **Contradice decision existente** | `design-generator-architecture.md` ya eligio Fabric.js. Informe 3 recomienda Konva/Polotno sin mencionar la decision previa |
| **IMG.LY CE.SDK** | Doc interno lo investigo, informe solo lo menciona como nota al pie |
| **layerhub-io/react-design-editor** | Doc interno lo referencia pero informe no verifica estado actual |
| **Datos sin fecha** | Paper.js, Three.js, PixiJS sin fecha de verificacion |
| **Customily omitido** | SaaS white-label relevante no evaluado |
| **konva-node omitido** | Mencionado pero no evaluado para Next.js 16.x |
| **React 19.x compatibilidad** | Ninguna libreria evaluada contra React 19 |

---

## Acciones por Prioridad

### Alta (bloquean decisiones de arquitectura)

1. **Leer `design-generator-architecture.md`** completo y contrastar eleccion Fabric vs Konva. La decision existente fue Fabric pero los informes nuevos sugieren Konva. Resolver antes de implementar.

2. **Verificar migracion `201500`** en produccion (riesgo de fallo silencioso en ai_generations).

3. **Leer checkout real** — `src/app/[locale]/(focused)/checkout/` y `api/checkout/create-session/route.ts` para confirmar si personalizationId se usa o ignora.

### Media

4. Leer los 4 providers individuales (fal, ideogram, openai, recraft) — documentar parametros y costos.
5. Leer CartContext.tsx — como viaja personalizationId.
6. Leer skill stsu177 — diferencias vs SASU024.
7. Verificar estado de layerhub-io/react-design-editor.

### Baja

8. Query count real de productos activos.
9. Evaluar Customily como alternativa white-label.
10. Evaluar konva-node para Next.js 16.x.

---

## Tabla de Confianza

| Dimension | Informe 1 | Informe 2 | Informe 3 |
|---|---|---|---|
| Archivos leidos con evidencia | 80% | 70% | N/A |
| Valores precisos | Alta | Alta | Media |
| Flujos de usuario | Media | Baja | N/A |
| Consistencia interna | Alta | Media | Alta |
| Consistencia entre informes | — | Media | Media |
| Cobertura de archivos | 75% | 65% | 70% |
