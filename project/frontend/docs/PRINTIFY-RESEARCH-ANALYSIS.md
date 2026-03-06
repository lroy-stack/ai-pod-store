# Análisis de Investigación Printify — Mejora de Skills SKAPARA

> Compilado: 2026-03-01 | Basado en 6 documentos de investigación + auditoría de placeholders

---

## 1. HALLAZGOS CLAVE

### 1.1 Placeholders Multi-Posición (GAP CRÍTICO)

**Problema detectado**: Todos nuestros productos solo usan la posición `front`. Hay posiciones disponibles sin usar en la mayoría de blueprints.

| Tipo | Posiciones disponibles | Posiciones usadas | GAP |
|---|---|---|---|
| T-Shirts BP6/12/145 | front, back, left_sleeve, right_sleeve, neck_outer | solo front | 4 vacías |
| Hoodies DTG BP77 | front, back | solo front | 1 vacía |
| Crewnecks BP49/457 | front, back | solo front | 1 vacía |
| Long Sleeves BP80 | front, back | solo front | 1 vacía |
| Zip Hoodies BP455 | front, back | solo front | 1 vacía |
| Caps BP1744/1755/1729 | front, back_hat, right_hat, left_hat | solo front | 3 vacías |
| Hoodies bordadas BP793 | front_left_chest, front_center_chest, left_wrist, right_wrist | varía (1-4) | 0-3 vacías |
| Mugs BP1018 | front, all (wrap) | solo front | 1 vacía |

**Impacto**:
- Valor percibido menor (producto parece "sin terminar" vs competencia)
- Oportunidad perdida de branding (back logo, sleeve marks)
- Gorras con solo frontal → sin diferenciación lateral

### 1.2 Neck Labels — NO DISPONIBLES para EU

- Solo proveedores US confirmados (Monster Digital, SwiftPOD, Dimona Tee)
- Nuestros proveedores EU (P26, P410, P90, P23, P30) **NO están confirmados**
- **Acción**: NO crear skill para neck labels. Verificar manualmente en Product Creator si P26/P410 lo ofrecen
- **Alternativa**: Usar posición `neck_outer` (disponible en BP6/12/145) para poner un mini-logo DTG

### 1.3 Packaging Inserts — VIABLES para P410

- $0.15/unidad ($0.10 con Premium)
- P410 (Printful Latvia) **confirma soporte**
- P26 (Textildruck Europa) — verificar en dashboard
- Setup: Dashboard → Branding → Package inserts
- **Acción**: Diseñar insert A6 con branding SKAPARA + QR + discount code

### 1.4 Gift Messages — API DISPONIBLE

- Campo `gift_message` en `POST /v1/shops/{shop_id}/orders.json`
- `send_shipping_notification: false` para regalos sorpresa
- Provider-dependent para ejecución física
- **Acción**: Añadir campo gift message en CheckoutView.tsx (futuro)

### 1.5 AOP (All-Over-Print) — LIMITADO para EU

- Solo 100% poliéster, base blanca obligatoria
- P26 es DTG only → **NO soporta AOP**
- P410 tiene AOP limitado (hoodies, leggings)
- Base costs altos (hoodie AOP: $59.29 vs DTG: ~$20)
- **Acción**: NO priorizar AOP. Si se hace, solo via P410 y verificar BPs específicos

### 1.6 Mockups — Parámetros de Posicionamiento

- API: `x`, `y`, `scale`, `angle` (0-1 fracciones)
- `y: 0.45` → centro visual (ligeramente arriba del geométrico) para pecho
- `pattern: true` para AOP/repeat
- Mockups son read-only via API — se generan al publicar
- `is_default: true` determina imagen principal
- **Acción**: Documentar posicionamiento óptimo por posición en skills

---

## 2. RECOMENDACIONES PARA SKILLS

### 2.1 Skill `design-dtg` — MEJORAS NECESARIAS

**Cambios**:

1. **Añadir sección MULTI-POSITION** en SKILL.md:
   - Definir diseños por posición: front (principal), back (logo/tagline), sleeves (mini icon), neck_outer (marca)
   - Canvas sizes por posición (necesita query API)
   - Regla: NUNCA copiar el diseño front a otras posiciones. Cada posición tiene su propio diseño

2. **Añadir BACK PRINT estándar SKAPARA**:
   - Logo SKAPARA pequeño centrado (S mark + wordmark)
   - Tamaño: ~15-20% del canvas back
   - Posición: y:0.15 (parte superior espalda, entre hombros)
   - Alternativa: tagline "Designed by AI, worn by humans"

3. **Añadir SLEEVE PRINTS** (BP6, BP12, BP145):
   - Mini S mark o icono tech (⌘, /, #)
   - Tamaño muy pequeño, centrado en manga
   - Solo para productos premium (no todos)

4. **Añadir NECK_OUTER print** (BP6, BP12, BP145):
   - S mark pequeño como alternativa a neck label
   - Funciona como branding DTG en cuello exterior
   - Canvas probablemente ~600x600px (verificar)

5. **Posicionamiento API** en CANVAS_SPECS.md:
   ```
   front:  x:0.5, y:0.45, scale:0.8-1.0
   back:   x:0.5, y:0.15, scale:0.2-0.3 (logo) o y:0.45, scale:0.8 (diseño completo)
   sleeve: x:0.5, y:0.5, scale:0.3-0.5
   neck:   x:0.5, y:0.5, scale:0.8
   ```

### 2.2 Skill `design-embroidery` — MEJORAS NECESARIAS

**Cambios**:

1. **Añadir MULTI-POSITION para gorras** (BP1744, BP1755, BP1729):
   - `front`: diseño principal (actual)
   - `back_hat_embroidery`: S mark pequeño o URL "skapara.com"
   - `right_hat_embroidery` o `left_hat_embroidery`: mini S mark o icono

2. **Añadir WRIST EMBROIDERY** para BP793 hoodies:
   - Origin y Synapse ya lo usan (4/4 posiciones)
   - Ultra, Phantom, Abyss solo usan 1/4 → añadir left_wrist + right_wrist
   - Diseño wrist: S mark simple o código binario corto

3. **Documentar canvas por posición** (BP793):
   ```
   front_left_chest:    ~800x800
   front_center_chest:  ~1200x1200
   left_wrist:          ~400x200
   right_wrist:         ~400x200
   ```

4. **Documentar canvas gorras por posición**:
   ```
   front:              1770x600 (BP1744), 1890x765 (BP1755)
   back_hat_embroidery: ~800x300 (estimar, verificar)
   left/right_hat:     ~400x300 (estimar, verificar)
   ```

### 2.3 Skill `design-sublimation` — MEJORAS MENORES

**Cambios**:

1. **Añadir nota sobre posición `all` vs `front`** en mugs BP1018:
   - `front`: solo cara frontal del mug
   - `all`: wrap-around completo (diseño envuelve todo el mug)
   - Recomendación: usar `all` para diseños branded, `front` para diseños simples

2. **Añadir sección AOP** (limitada):
   - Solo si se verifica que P410 tiene BPs AOP con shipping EU
   - Notas: solo poliéster blanco, RGB, 300 DPI, bleed 0.5-1 inch
   - Precio base alto → retail alto

3. **Posicionamiento para sneakers** ya bien documentado (6 posiciones)

### 2.4 Skill `product-catalog-planner` — MEJORAS NECESARIAS

**Cambios**:

1. **Añadir checklist MULTI-POSITION** en pipeline de creación:
   - [ ] Diseño front (obligatorio)
   - [ ] Diseño back (recomendado para apparel)
   - [ ] Diseño sleeves (opcional, solo tees con BP6/12/145)
   - [ ] Diseño neck_outer (opcional, branding)
   - [ ] Diseño hat sides (recomendado para gorras)

2. **Añadir sección BRANDING**:
   - Packaging inserts: diseño A6, setup en dashboard
   - Gift messages: campo API, integración checkout
   - Neck labels: NO disponible EU (fallback: neck_outer DTG)

3. **Actualizar prioridades** de expansión:
   - Antes de crear más productos: mejorar los 32 existentes con multi-position
   - Prioridad 1: Back print SKAPARA en todas las camisetas/hoodies
   - Prioridad 2: Hat sides en gorras
   - Prioridad 3: Wrist embroidery en hoodies bordadas
   - Prioridad 4: Expansion a 80 productos

### 2.5 NUEVO Skill: `branding-assets` — CREAR

**Ubicación**: `.claude/skills/branding-assets/`

**Propósito**: Gestionar assets de branding físico (packaging inserts, gift messages, branded elements)

**Contenido**:
- `SKILL.md` — Pipeline de creación de inserts y branding
- `INSERT_SPECS.md` — Dimensiones A6, bleed, safe zone, CMYK
- `GIFT_MESSAGE_TEMPLATES.md` — Templates de mensajes por ocasión
- `BRAND_ELEMENTS.md` — Qué incluir (QR, discount code, social links, care instructions)

**Diseño del packaging insert SKAPARA** (A6, 105x148mm):
```
FRONT:
- S mark gradient (centrado superior)
- "Thank you for your order" / "Gracias por tu pedido"
- QR code → skapara.com/review
- Discount code: SKAPARA10 (10% next order)
- Social: @skapara en Instagram/TikTok

BACK:
- Care instructions (lavar en frío, no lejía)
- "Designed by AI, worn by humans"
- GPSR info (manufacturer, country, material)
- "Made in EU 🇪🇺"
```

---

## 3. ACCIONES INMEDIATAS (Orden de prioridad)

### Paso 0: Obtener canvas sizes de TODAS las posiciones
```
Script: scripts/research-position-canvas.mjs
Query: GET /v1/catalog/blueprints/{bp_id}/print_providers/{provider_id}/printing.json
Para cada BP activo → documentar canvas de CADA posición
```

### Paso 1: Diseñar assets estándar multi-posición
- **back-logo-skapara.svg** — S mark + wordmark para back print
- **sleeve-mark-skapara.svg** — S mark mini para sleeves
- **neck-mark-skapara.svg** — S mark para neck_outer
- **hat-back-skapara.svg** — S mark o "skapara.com" para back gorras
- **hat-side-skapara.svg** — S mark mini para lateral gorras
- **wrist-mark-skapara.svg** — S mark para wrist embroidery

### Paso 2: Actualizar skills con multi-position
- Editar SKILL.md de cada skill con secciones de posición
- Añadir canvas por posición en CANVAS_SPECS.md
- Añadir posicionamiento API (x, y, scale) por posición

### Paso 3: Crear skill branding-assets
- Crear archivos del skill
- Diseñar packaging insert A6

### Paso 4: Aplicar multi-position a productos existentes
- Añadir back print a 18+ productos apparel
- Añadir hat sides a 4 gorras
- Añadir wrist embroidery a 3 hoodies bordadas

### Paso 5: Continuar con expansión del catálogo
- Recrear 6 productos kids (solo front, correctamente)
- Seguir plan de expansión 32→250

---

## 4. RESUMEN DE DOCS CREADOS

| Documento | Ruta | Hallazgo principal |
|---|---|---|
| Placeholders Audit | `docs/printify-placeholders-audit.md` | 43 productos, mayoría solo front |
| Neck Labels | `docs/printify-neck-labels.md` | NO disponible EU, $0.55/unit |
| Packaging Inserts | `docs/printify-packaging-inserts.md` | $0.15/unit, P410 confirma |
| Branding + Gift | `docs/printify-branding-gift-message.md` | API gift_message, branding dashboard |
| Mockups | `docs/printify-mockups.md` | x/y/scale/angle API, PlaceIt |
| AOP Products | `docs/printify-aop-products.md` | Solo poliéster, EU limitado, caro |

---

## 5. LO QUE NO CAMBIA

- **Productos solo front siguen siendo válidos** — no todos necesitan multi-position
- **El flujo Printify de 10 pasos sigue igual** — solo añadimos más placeholders en paso 3
- **EU-only sigue obligatorio** — AOP queda descartado salvo P410 verificado
- **GPSR obligatorio** — sin cambios
- **Pricing rules** — sin cambios (35% min margin)
