# Supabase Product & Order Schema — Referencia para PodClaw v2

*Generado por agente de exploración 2026-03-09*

## Resumen

Schema provider-agnostic preparado para Printful. Tablas clave: products, product_variants, orders, order_items, categories. RLS activo en todas.

## Products Table (30+ columnas)

### Columnas Core
- `id` (UUID, PK)
- `name`, `description` (text)
- `slug` (unique, generado automáticamente)
- `base_price_cents` (integer) — precio base en EUR cents
- `compare_at_price_cents` (integer, nullable) — precio tachado
- `category_id` (FK → categories)
- `status` ('draft' | 'active' | 'archived')
- `featured` (boolean)
- `is_new` (boolean)

### Columnas Provider-Agnostic (migración Printify→Printful)
- `pod_provider` ('printify' | 'printful') — identifica proveedor
- `provider_product_id` (text) — ID en el proveedor externo
- `printify_id` (text, legacy) — deprecated, usar provider_product_id
- `blueprint_id` (integer) — catalog/blueprint ID del proveedor
- `print_provider_id` (integer) — ID del print provider

### product_details JSONB (GPSR + Specs)
```json
{
  "safety_information": "EU GPSR 2023/988...",
  "material": "100% Organic Cotton",
  "care_instructions": "Machine wash cold...",
  "print_technique": "DTG | Embroidery | Sublimation",
  "manufacturing_country": "Germany | Latvia",
  "brand": "SKAPARA",
  "model": "Cotton Heritage M2580",
  "weight_grams": 340
}
```

### Imágenes y SEO
- `image_url` (text) — imagen principal
- `images` (JSONB array) — todas las imágenes del producto
- `meta_title`, `meta_description` (text) — SEO por producto
- `name_en`, `name_es`, `name_de` (text) — traducciones
- `description_en`, `description_es`, `description_de` (text)

### Timestamps
- `created_at`, `updated_at` (timestamptz)
- `published_at` (timestamptz, nullable)

## Product Variants Table

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `product_id` | UUID | FK → products |
| `external_variant_id` | text | ID en proveedor (para upsert sync) |
| `size` | text | S, M, L, XL, 2XL... |
| `color` | text | Black, White, Navy... |
| `color_hex` | text | #000000, #FFFFFF... |
| `price_cents` | integer | Precio específico de esta variante |
| `sku` | text | SKU generado |
| `stock_status` | text | in_stock, out_of_stock |
| `is_enabled` | boolean | Variante activa para venta |
| `image_url` | text | Mockup específico de color (genera syncProductFromPrintify) |
| `sort_order` | integer | Orden de display |

### Notas clave para PodClaw v2
- `external_variant_id` es la clave de upsert durante sync con Printful
- `image_url` se genera durante cron sync cruzando variant_ids con imágenes del proveedor
- Sin `image_url` → sin color toggle en ProductCard frontend
- `price_cents` puede ser diferente al `base_price_cents` del producto padre

## Orders Table

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `status` | text | pending → paid → submitted → in_production → shipped → delivered → cancelled |
| `total_cents` | integer | Total del pedido |
| `currency` | text | EUR |
| `stripe_payment_intent_id` | text | Referencia Stripe |
| `stripe_checkout_session_id` | text | Referencia Stripe checkout |
| `pod_order_id` | text | ID del pedido en Printful |
| `pod_provider` | text | printify \| printful |
| `shipping_address` | JSONB | Dirección completa |
| `shipping_method` | text | Método de envío seleccionado |
| `tracking_number` | text | Número de seguimiento |
| `tracking_url` | text | URL de tracking |
| `notes` | text | Notas del pedido |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Lifecycle de un pedido
```
1. pending    — Checkout iniciado, pago pendiente
2. paid       — Stripe confirma pago (webhook checkout.session.completed)
3. submitted  — Pedido enviado a Printful (submit-order-to-pod.ts)
4. in_production — Printful confirma producción (webhook)
5. shipped    — Printful confirma envío con tracking (webhook)
6. delivered  — Entrega confirmada
7. cancelled  — Cancelado (manual o por error)
```

## Order Items Table

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `order_id` | UUID | FK → orders |
| `product_id` | UUID | FK → products |
| `variant_id` | UUID | FK → product_variants |
| `quantity` | integer | Cantidad |
| `unit_price_cents` | integer | Precio unitario al momento de compra |
| `product_name` | text | Snapshot del nombre (desnormalizado) |
| `variant_info` | JSONB | {size, color} snapshot |

## Categories Table

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID | PK |
| `name` | text | Nombre canónico |
| `name_en`, `name_es`, `name_de` | text | Traducciones |
| `slug` | text | URL-friendly |
| `parent_id` | UUID | FK self-referential (jerárquica) |
| `sort_order` | integer | Orden de display |
| `image_url` | text | Imagen de categoría |
| `is_active` | boolean | Categoría visible |

### Categorías existentes (activas)
- T-Shirts, Hoodies, Crewnecks, Long Sleeves, Zip Hoodies
- Caps & Hats (parent → Snapbacks, Dad Hats, Beanies, Bucket Hats)
- Tote Bags, Kids
- Mugs, Bottles, Tumblers, Desk Mats, Stickers
- Phone Cases, Sneakers

## RLS Policies

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| products | public (status=active) | service_role | service_role | service_role |
| product_variants | public (product active) | service_role | service_role | service_role |
| orders | user owns (user_id=auth.uid()) | authenticated | service_role | DENY |
| order_items | user owns order | service_role | DENY | DENY |
| categories | public | service_role | service_role | service_role |

### Implicaciones para PodClaw v2
- **Agentes usan service_role key** — bypass RLS para crear/editar productos
- **Nunca exponer service_role key** a canales externos (WhatsApp/Telegram)
- **Orders son READ-ONLY** para usuarios — solo service_role puede mutar status
- **Products son READ-ONLY** para público — agentes crean/editan via service_role

## API Response Shapes (Frontend → PodClaw referencia)

### GET /api/products (lista)
```json
{
  "products": [{
    "id": "uuid",
    "name": "...",
    "slug": "...",
    "base_price_cents": 2499,
    "image_url": "https://...",
    "category": { "id": "uuid", "name": "T-Shirts", "slug": "t-shirts" },
    "variants": [{ "color": "Black", "color_hex": "#000", "image_url": "..." }],
    "is_new": true,
    "featured": false
  }]
}
```

### GET /api/products/[slug] (detalle)
```json
{
  "product": {
    "...": "same as list",
    "description": "...",
    "product_details": { "material": "...", "safety_information": "..." },
    "variants": [{ "id": "uuid", "size": "M", "color": "Black", "price_cents": 2499, "stock_status": "in_stock" }],
    "images": ["url1", "url2"]
  }
}
```

## Query Patterns para PodClaw v2 Agents

### Cataloger Agent — Crear producto
```sql
INSERT INTO products (name, slug, description, base_price_cents, category_id,
  pod_provider, provider_product_id, blueprint_id, print_provider_id,
  product_details, status, image_url, images)
VALUES (..., 'printful', 'pf_123', 586, 410,
  '{"material":"...","safety_information":"..."}', 'draft', ...);

INSERT INTO product_variants (product_id, external_variant_id, size, color,
  color_hex, price_cents, sku, is_enabled, sort_order)
VALUES (...);
```

### Finance Agent — Consultar ventas
```sql
SELECT DATE(o.created_at), COUNT(*), SUM(o.total_cents)
FROM orders o
WHERE o.status IN ('paid','shipped','delivered')
  AND o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(o.created_at);
```

### Customer Manager — Pedidos de cliente
```sql
SELECT o.*, oi.product_name, oi.variant_info, oi.quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = $1
ORDER BY o.created_at DESC;
```

### QA Inspector — Productos sin GPSR
```sql
SELECT id, name, pod_provider
FROM products
WHERE status = 'active'
  AND (product_details->>'safety_information' IS NULL
       OR product_details->>'material' IS NULL);
```

## Tablas Auxiliares Relevantes

### user_messaging_links
- Vincula user_id con platform (whatsapp/telegram) y platform_user_id
- `is_admin_mode` flag para distinguir CEO de clientes

### whatsapp_messages / telegram_messages
- Historial de mensajes entrantes/salientes
- Schema listo para inbound webhook processing

### agent_events (Event Store)
- Audit trail inmutable de todas las acciones de agentes PodClaw
- Columnas: agent_name, event_type, tool_name, input/output JSONB, cost_usd, created_at
- Particionado por mes

### store_settings
- Configuración key-value de la tienda
- currency, shipping_zones, tax_rates, etc.

## Gaps para PodClaw v2

| Gap | Descripción | Criticidad |
|-----|-------------|------------|
| Sin tabla de tareas/queue | No hay tabla para event queue persistente | CRITICAL |
| Sin tabla de diseños | Diseños SVG no se almacenan en DB | HIGH |
| Sin tabla de aprobaciones CEO | No hay workflow approve/reject | HIGH |
| provider_product_id mixed | Algunos productos tienen printify_id, otros provider_product_id | MEDIUM |
| Sin tabla de costos de producción | Costos Printful no se trackean separados | MEDIUM |
