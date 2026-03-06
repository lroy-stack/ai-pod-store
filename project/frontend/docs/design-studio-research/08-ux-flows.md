# Flujos de Usuario End-to-End — Editores de Diseno de Productos Personalizados

---

## 1. Flujos por Plataforma

### 1.1 Printful Design Maker

**Entrada**: Landing `/design-maker`, pagina de producto, dashboard merchant, o EDM embebido.

**Flujo**:
1. Seleccion de producto (grid ~481 productos, filtros)
2. Editor principal: canvas central + toolbar derecha + panel de capas
3. Herramientas: Upload, Text (fuente/forma/color/outline), Clipart (3500+), Quick Designs, Background, Pattern
4. Tabs de posicion: FRONT | BACK | SLEEVE | LABEL
5. Color de prenda: swatches debajo del canvas, update en tiempo real
6. Preview = el canvas mismo ("WYSIWYG") + 1400+ estilos mockup
7. Guardar como template / publicar en tienda

### 1.2 CustomInk Design Lab

**Flujo**:
1. Producto desde catalogo -> "Start Designing"
2. Barra herramientas: Add Text, Add Art, Upload, Add Products
3. Switch FRONT/BACK/SLEEVE (esquina superior derecha)
4. Color de prenda en panel lateral
5. Review -> cantidad/tallas -> Cart -> Checkout
- Desktop-optimized. Mobile limitado.

### 1.3 Zazzle Design Tool

**Layout 5 secciones**:
- TOP BAR: Edit, Collaboration, Settings, Help, Share, Done
- LEFT TOOLBAR: Uploads, Text, Elements, Icons, Background, Product, Layers, Help
- CANVAS CENTRAL: producto renderizado
- RIGHT PROPERTIES: propiedades del elemento seleccionado
- PREVIEW WINDOW: bottom-right, scrollable

**Print Area Guidelines**:
- Bleed Line (roja): extra space
- Visible Area (azul): area final visible
- Safe Area (verde punteada): zona segura

### 1.4 Printify Personalization Hub

**Mobile-first** — campos one-at-a-time:
1. Product page con "Personalize & Order"
2. Hub modal: text fields + image upload + layers combinadas
3. Live preview instantaneo
4. Confirm -> Add to cart

### 1.5 Canva (Merch)

- Template gallery -> editor familiar
- Tabs FRONT/BACK/DOUBLE-SIDED
- Click "Print" -> tipo producto -> cantidad/color -> Preview 3D -> Checkout
- Ventaja: familiaridad. Desventaja: no maneja print areas con precision POD.

---

## 2. Patrones UX Criticos

### 2.1 Desktop — Layout Canonico (3 columnas)

```
TOP BAR: Logo | Product name | Undo/Redo | Zoom | Save | Done
LEFT PANEL: Upload, Text, Art, Shapes, BG, Layers
CANVAS CENTRAL: producto + safe zone + elementos
RIGHT PANEL: propiedades del elemento seleccionado (posicion, tamano, color, fuente, opacidad)
BOTTOM: Color swatches prenda | Size selector | Price
```

- Drag libre, snap a grilla, safe zone siempre visible
- Tabs de zona (FRONT/BACK/SLEEVE) bajo el canvas
- Undo/Redo: Cmd+Z, min 20 pasos
- Alineacion: snap magnetico, guias al acercarse

### 2.2 Tablet

- Canvas ~70% del ancho + panel colapsable acordeon
- Bottom toolbar: Upload, Text, Art, BG, Layers
- Touch: pinch-zoom, two-finger pan, long press context menu

### 2.3 Mobile — Patron Critico

```
TOP: ← Producto | [Done]
CANVAS: ~55-60% altura, pinch zoom
ZONE TABS: [F] [B] [SL]
PANEL CONTEXTUAL: Color swatches, Size slider, Delete/Duplicate
BOTTOM TOOLBAR: [Upload][Text][Art][BG]
```

**Patrones destacados**:
- **Zakeke 2024**: 2D+3D simultaneo, mobile-first rebuilt, Quick Action Bar repositionable
- **Printify mobile**: campos one-at-a-time (wizard lineal)
- **Zazzle mobile**: bottom panel con opciones del objeto seleccionado
- **Thumb Zone**: CTAs criticos en tercio inferior de pantalla

---

## 3. Flujos por Tipo de Producto

### Camisetas
- Tabs: [FRONT*] [BACK] [LEFT SLEEVE] [RIGHT SLEEVE] [INSIDE LABEL]
- Capas independientes por posicion
- Animacion flip/slide al cambiar (180ms)
- Badge "+" indica diseno en zona inactiva
- CTA secundario "Add back design (+$X)"

### Gorras
- Safe zone ~2.5" x 1.75" (la mas pequena)
- Color picker limitado a colores de hilo
- Min 1.5mm lineas, 5mm texto (bordado)
- Sin gradientes en modo bordado

### Tazas (Wrap-Around)
- MODO 1: Vista plana (360 grados desenrollado, handle zone no imprimible)
- MODO 2: Preview 3D rotacional (drag para girar)
- Usuario disena en flat, preview muestra curvatura

### Phone Cases
- Zona de camara como area bloqueada (gris)
- Zona de botones como restriccion lateral
- Safe zone con padding visible

---

## 4. Onboarding

**Nivel 1**: Sin onboarding (CustomInk, Printful) — directo al editor
**Nivel 2**: Templates como punto de partida (Zazzle, Canva) — reduce "blank canvas anxiety"
**Nivel 3**: Quick actions contextuales (Zakeke) — progressive disclosure
**Nivel 4**: Wizard step-by-step (Printify mobile) — un campo a la vez

**Patron emergente AI-assisted**: Quality check al subir imagen, AI upscale automatico, auto-proofing.

### Templates como entrada

```
1. "Personalizar con template" vs "Empezar desde cero"
2. Gallery filtrada por estilo/tema
3. Click → template cargado en editor
4. Solo cambiar texto/colores → 2-3 pasos
```

### Quick Personalize (patron 80/20)

```
Quick Personalize:
  Tu nombre: [___________]
  Linea 2: [___________]
  [Preview en vivo]  [Editor completo →]
```

Mantiene al 80% en flujo simple, editor completo solo para power users.

---

## 5. Checkout Flow

```
EDITOR → [Done] → REVIEW (preview + resumen + precio) → [Add to Cart] → CART → CHECKOUT → CONFIRMATION
```

### Guardado de disenos

| Plataforma | Auto-save | Editar post-cart | Historial |
|---|---|---|---|
| Printful | Si (template) | Si | Si |
| Zazzle | Si (logged in) | Si | Si |
| CustomInk | Si (cuenta) | Si (pre-pago) | Si |
| Printify Hub | Solo al completar | No | No |
| Zakeke | localStorage | Si | Si |

### Design History (patron maduro)

```
"My Designs" → [Thumbnail] | "Reorder" | "Edit" | "Share"
```

---

## 6. Errores y Edge Cases

### Imagen baja resolucion
```
⚠ Esta imagen puede salir borrosa. 72 DPI — Min: 150 DPI
[Mejorar con AI]  [Usar de todas formas]  [Cambiar]
```
Warning al upload, NO al checkout.

### Fuera del area de impresion
- Frame ROJO cuando sale del area, VERDE cuando esta bien
- Auto-fit button: "Centrar y ajustar"
- No bloqueante pero advertencia persistente

### Conexion perdida
- localStorage como fallback
- Al reconectar: "Tienes cambios sin guardar. Restaurar?" [Si] [Descartar]

### Salir sin guardar
- Dialog de confirmacion siempre

---

## 7. Wireframes de Referencia

### Desktop

```
╔══════════════════════════════════════════════════════════════════════╗
║  ← Volver   |  Producto: Camiseta Negra S/M/L    |  [Guardar] [✓] ║
╠══════════════╦═══════════════════════════════════════╦══════════════╣
║  PANEL IZQ   ║           CANVAS                      ║  PROPIEDADES ║
║ [Upload]     ║   [Producto con safe zone]             ║  Posicion XY ║
║ [Text]       ║   [Elementos interactivos]             ║  Tamano WH   ║
║ [Art]        ║                                        ║  Color       ║
║ [Shapes]     ║   [FRONT*] [BACK] [SLEEVE] [LABEL]   ║  Fuente      ║
║ [BG]         ║                                        ║  Opacidad    ║
║ [Layers]     ║   Color prenda: ●●●●●●●●●●           ║  Capas       ║
╚══════════════╩═══════════════════════════════════════╩══════════════╝
```

### Mobile

```
╔═══════════════════════════╗
║  ← Camiseta    [Listo ✓] ║
╠═══════════════════════════╣
║     [CANVAS ~60% alto]    ║
║     [Producto + diseno]   ║
╠═══════════════════════════╣
║  [F*] [B] [SL]            ║
╠═══════════════════════════╣
║  Color: [■][■][■][+]      ║
║  Tamano: [────O─────]     ║
║  [Duplicar] [Eliminar]    ║
╠═══════════════════════════╣
║ [↑][T][✦][▭][BG]         ║
╚═══════════════════════════╝
```

---

## 8. Gap del Mercado (Oportunidad SKAPARA)

- **Ninguna plataforma resuelve AI-generate + personalizar manualmente** de forma integrada
- El flujo "describe en texto natural -> AI genera -> ajustar en canvas" no existe
- Historia de disenos (recuperar, reordenar, modificar) sigue imperfecta en mobile

---

## Sources

- [Printful Design Maker — Enterprise](https://www.printful.com/enterprise/product-customization)
- [Printful Design Maker — Academy](https://www.printful.com/academy/lessons/how-does-printfuls-design-maker-work)
- [Zazzle Design Tool 101 — Desktop](https://help.zazzle.com/hc/en-us/articles/27999345528727)
- [Zazzle Design Tool 101 — Mobile](https://help.zazzle.com/hc/en-us/articles/28090961110679)
- [CustomInk Design Lab](https://www.customink.com/help_center/navigate-the-lab)
- [Zakeke New UI — Mobile-First](https://www.zakeke.com/blog/introducing-the-new-zakeke-customizer-ui/)
- [Printify Personalization Hub](https://help.printify.com/hc/en-us/articles/34997929259921)
- [Gelato Personalized Apparel Editor](https://www.gelato.com/personalization-studio/personalized-apparel-editor)
- [Canva Custom T-Shirts](https://www.canva.com/t-shirts/)
