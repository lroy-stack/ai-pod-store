# Printful API para Editor de Diseno Personalizado por Cliente

---

## 1. File Management API

### Endpoint principal

- **v1:** `POST https://api.printful.com/files`
- **v2:** `POST https://api.printful.com/v2/files`

### Formatos aceptados

| Tecnica | Formato | Resolucion min | Max tamano |
|---|---|---|---|
| DTG | **PNG** (transparente) | 150 DPI | 200 MB |
| AOP/Sublimacion | JPG/JPEG | 150 DPI | 200 MB |
| Bordado | PNG preferido | 300 DPI | 200 MB |

**SVG NO soportado via API.** Rasterizar a PNG antes de subir.

### Thread colors (bordado)

`POST /files/thread-colors` — acepta URL de imagen, devuelve colores de hilo Madeira sugeridos.

---

## 2. Catalogo y Placements

### Estructura de placements

```json
{
  "placements": [
    {
      "placement": "front_large",
      "display_name": "Front large",
      "technique": "dtg",
      "print_area_width": 15,
      "print_area_height": 18,
      "dpi": 150
    }
  ]
}
```

**IMPORTANTE**: El placement `front` esta descontinuado (mayo 2025). Usar `front_large`.

### Printfiles — Dimensiones del canvas

`GET /v2/catalog-products/{id}/catalog-printfiles`:

```json
{
  "printfile_id": 1,
  "width": 4500,
  "height": 5400,
  "dpi": 300,
  "fill_mode": "fit"
}
```

### Precios en tiempo real

`GET /v2/catalog-variants/{variant_id}/prices`:

```json
{
  "currency": "EUR",
  "placements": [
    { "id": "front_large", "price": "12.95" },
    { "id": "back", "price": "4.50" }
  ]
}
```

Primer placement incluido en base; adicionales con coste extra. Permite **pricing en tiempo real** mientras el cliente anade posiciones.

---

## 3. Mockup Generator API

### Flujo actual (v1 — ya implementado)

- `POST /mockup-generator/create-task/{catalog_product_id}` -> task_id
- `GET /mockup-generator/task?task_key={key}` -> polling
- Tiempo tipico: **10-30 segundos**

### v2

```json
// POST /v2/mockup-tasks
{
  "format": "jpg",
  "products": [{
    "source": "catalog",
    "catalog_product_id": 438,
    "catalog_variant_ids": [9231],
    "placements": [{
      "placement": "front_large",
      "technique": "dtg",
      "layers": [{
        "type": "file",
        "url": "https://storage.skapara.com/designs/mi-diseno.png",
        "position": {
          "area_width": 1800, "area_height": 2400,
          "width": 1800, "height": 1800,
          "top": 300, "left": 0
        }
      }]
    }]
  }]
}
```

### Preview en tiempo real

**No directamente.** Mockups son asincronos (10-30s). Estrategia:
- **Preview local** en canvas del browser (composicion con imagen del producto)
- Mockup API solo para mockup final (carrito/checkout)
- Pre-generar mockups por variante y servir desde cache

### Rate limits mockup

~20-30 tareas/min (no publicado oficialmente). Sin coste por llamada.

---

## 4. Embedded Design Maker (EDM)

**Estado**: BETA, requiere **aprobacion enterprise**. No hay precio publico.

### Integracion tecnica

```javascript
const dm = new PFDesignMaker({
  elemId: 'design-container',
  nonce: 'server-generated-nonce',
  initProduct: { productId: 438, technique: 'dtg' },
  featureConfig: {
    clipart_layers: true,
    file_layers: true,
    text_layers: true,
    custom_external_file_library: true
  },
  livePricingConfig: {
    useLivePricing: true,
    livePricingCurrency: 'EUR'
  },
  style: {
    variables: { 'color-scheme': 'dark' }
  },
  onTemplateSaved: (templateId) => { /* guardar en DB */ },
  onDesignStatusUpdate: ({ designValid }) => { /* UI */ },
})
```

### Limitaciones del EDM

- `embroidery_large_center` siempre oculto
- Max 5 file layers por placement
- Templates EDM separados del dashboard
- Tecnica fija al inicializar
- Requiere contrato enterprise

---

## 5. Order con Diseno Custom

### v2 — Sin sync product (API Store)

```json
// POST /v2/orders/{id}/order-items
{
  "quantity": 1,
  "catalog_variant_id": 9231,
  "source": "catalog",
  "placements": [{
    "placement": "front_large",
    "technique": "dtg",
    "layers": [{
      "type": "file",
      "url": "https://storage.skapara.com/designs/custom-123.png"
    }]
  }]
}
```

### Bordado con thread colors

```json
{
  "placements": [{
    "placement": "embroidery_chest_left",
    "technique": "embroidery",
    "layers": [{
      "type": "file",
      "url": "https://storage.skapara.com/designs/logo.png",
      "layer_options": [{
        "name": "thread_colors",
        "value": ["#FFFFFF", "#000000"]
      }]
    }]
  }]
}
```

### v1 — Con position

```json
{
  "items": [{
    "variant_id": 9231,
    "files": [{
      "type": "front",
      "url": "https://storage.skapara.com/designs/custom.png",
      "position": {
        "area_width": 1800, "area_height": 2400,
        "width": 1350, "height": 1350,
        "top": 525, "left": 225
      }
    }]
  }]
}
```

---

## 6. Bordado — Opciones Avanzadas

| Tecnica | Key API | Descripcion |
|---|---|---|
| Flat | `embroidery` | Estandar plano |
| 3D Puff | `embroidery_3d_puff` | Relieve 3D |
| Unlimited Color | option extra | +3.25 EUR |

- **Standard**: 15 colores, max 6 por diseno
- **Thread colors auto**: v2 detecta automaticamente; solo especificar para override.

---

## 7. Webhooks

| Evento | Cuando |
|---|---|
| `mockup_task_finished` | Mockup listo (alternativa al polling) |
| `order_created` | Pedido creado |
| `order_failed` | Pedido fallido |
| `catalog_price_changed` | Precio cambiado (v2) |
| `stock_updated` | Stock actualizado (cada 5 min) |

---

## 8. Rate Limits

| Contexto | Limite |
|---|---|
| General | **120 req/min** (leaky bucket) |
| Mockup generator | ~20-30/min |
| Catalogo sin auth | 30 req/60s |
| Headers | `X-Ratelimit-Remaining`, `X-Ratelimit-Reset` |

---

## 9. Limitaciones Conocidas

| Limitacion | Impacto |
|---|---|
| SVG no soportado en files | Rasterizar a PNG |
| Product templates solo v1 | Usar v1 para templates |
| EDM requiere Enterprise | Sin aprobacion, no hay embed |
| Mockups asincronos | No hay preview instantaneo |
| Solo sRGB (no CMYK) | Colores pueden diferir |

---

## 10. Arquitectura Recomendada para SKAPARA

```
Cliente Browser (Konva canvas)
    |
    v composicion local (preview instantaneo)
    |
API Route: POST /api/designs/compose
    |
1. Upload imagen -> Supabase Storage
2. GET /v2/catalog-products/{id} -> placements + dimensions
3. GET /v2/catalog-variants/{id}/prices -> pricing real-time
4. Composicion -> PNG final via Canvas API server-side
5. POST /v2/mockup-tasks -> mockup fotorrealista (async)
    |
Checkout:
6. POST /v2/orders -> draft
7. POST /v2/orders/{id}/order-items -> placements + URL diseno
8. POST /v2/orders/{id}/confirm -> fulfillment
```

---

## Sources

- [Printful API Documentation](https://developers.printful.com/docs/)
- [Printful API v2 Beta](https://developers.printful.com/docs/v2-beta/)
- [Embedded Design Maker](https://developers.printful.com/docs/edm/)
- [Graphics and Embroidery Guide](https://www.printful.com/graphics-and-embroidery-guide)
- [New standard print placement](https://help.printful.com/hc/en-us/articles/19074453565852)
- [PHP SDK — MockupGenerationTest](https://github.com/printful/php-api-sdk/blob/master/tests/MockupGenerator/MockupGenerationTest.php)
