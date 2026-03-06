# Mockup Generator — Option Groups & Views

Verified option groups for t-shirt catalogs CC1717 (586) and MC1087 (917).

---

## Option Groups (Mockup Styles)

| # | option_group | Tipo | Diseno Visible | Modelo | Descripcion |
|---|---|---|---|---|---|
| 1 | **Ghost** | Camiseta flotante, sin fondo | Si | No | Vista plana estandar. 4 vistas: Front, Left, Right, Back |
| 2 | **Flat** | Vista cenital, camiseta extendida | Si | No | Muestra etiqueta Comfort Colors visible |
| 3 | **Folded** | Camiseta doblada en angulo 3D | Si | No | Presentacion lifestyle sobre superficie |
| 4 | **Men's** | Modelo hombre frontal | Si | Hombre asiatico, pelo corto | Pose de pie mirando camara |
| 5 | **Men's 2** | Modelo hombre cuerpo completo | Si | Hombre negro, talla grande | Pose caminando, cuerpo completo |
| 6 | **Men's 3** | Modelo hombre 3/4 lateral | Si | Hombre negro, barba | Pose 3/4, mirando a la derecha |
| 7 | **Women's** | Mujer modelo cuerpo completo | Si | Mujer pelo largo | Pose dinamica caminando |
| 8 | **Zoomed in** | Macro del diseno sobre tela | Si | No | Close-up de la textura + diseno DTG |

**No probados** (existen pero sin verificar): Women's 2, Collage, Collage Ghost, Flat 2, Flat 3, Product details

---

## Options (Camera View Angles)

Las `options` controlan el **angulo de camara**, NO la posicion de impresion:

```
Front, Back, Left, Right,
Front 2, Front 3, Front and Back,
Left Front, Left Zoomed, Right Zoomed,
Outside label, Product details, Product details 2
```

### Uso recomendado para galeria

Para generar las 3 vistas estandar:
```json
{
  "option_groups": ["Ghost"],
  "options": ["Front", "Left", "Back"]
}
```

- `"Front"` — Vista frontal (muestra diseno front + branding back visible por detras)
- `"Left"` — Vista lateral izquierda (muestra manga con S mark)
- `"Back"` — Vista trasera (muestra wordmark SKAPARA)

---

## Galeria Ideal por Producto

### Set minimo (3 imagenes por color) — Actual

| # | option_group | options | Muestra |
|---|---|---|---|
| 1 | Ghost | Front | Diseno frontal (hero image) |
| 2 | Ghost | Back | Wordmark SKAPARA en espalda |
| 3 | Ghost | Left | S mark en manga izquierda |

### Set completo (10 imagenes por color) — Futuro

| # | option_group | options | Muestra | Prioridad |
|---|---|---|---|---|
| 1 | Ghost | Front | Diseno frontal (hero) | OBLIGATORIO |
| 2 | Men's | Front | Modelo hombre con diseno | OBLIGATORIO |
| 3 | Women's | Front | Modelo mujer con diseno | OBLIGATORIO |
| 4 | Flat | Front | Vista cenital clara | ALTO |
| 5 | Folded | Front | Presentacion 3D | ALTO |
| 6 | Men's 3 | Front | Angulo alternativo | MEDIO |
| 7 | Men's 2 | Front | Diversidad corporal | MEDIO |
| 8 | Zoomed in | Front | Textura DTG close-up | MEDIO |
| 9 | Ghost | Left | Manga con S mark | MEDIO |
| 10 | Ghost | Back | Wordmark SKAPARA | MEDIO |

**Total set completo**: 10 imagenes x 4-5 colores = 40-50 imagenes por producto

---

## Fondos

| option_group | Fondo |
|---|---|
| Ghost | **Transparente** (con format: "png") o blanco (con format: "jpg") |
| Flat | Blanco |
| Folded | Blanco |
| Men's / Women's | Blanco |
| Zoomed in | Color de la tela |

Printful NO genera mockups con fondo de escenario/lifestyle via API.

---

## Limitaciones Conocidas

1. **Graphite (variant 21264, CC1717)**: El API devuelve la MISMA imagen para todos los placements. Bug confirmado sin workaround.

2. **Mockup URLs temporales**: S3 URLs expiran en ~24h. SIEMPRE descargar y re-subir a Supabase Storage.

3. **Rate limit mockups**: ~10 tasks/min. Con 4 colores y 3 vistas = 4 tasks por producto. Delay 8-10s entre tasks.

4. **Sin lifestyle backgrounds**: No hay templates de modelo con fondo de escenario via API. Para lifestyle se necesitaria post-produccion externa.
