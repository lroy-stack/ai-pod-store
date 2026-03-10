# Printful API — Integración Completa

*Generado por agente de exploración 2026-03-09*

## Resumen

Frontend **completamente migrado** a Printful con Anti-Corruption Layer (provider-agnostic). PodClaw backend **sigue en Printify** — necesita nuevo conector Printful.

## Arquitectura de Integración

### Anti-Corruption Layer (Provider-Agnostic)

```
frontend/src/lib/pod/
├── types.ts               (165 LOC) — Provider interface (ISP: 5 interfaces segregadas)
├── provider-registry.ts   (69 LOC)  — Singleton instance management
├── index.ts               (144 LOC) — Inicialización + entry point
├── submit-order-to-pod.ts (125 LOC) — Order submission logic
├── models/                          — Webhook, order, product, design, catalog
├── webhooks/
│   ├── webhook-router.ts  (44 LOC)
│   ├── handlers/          — order-*, product-*, stock-updated
│   └── index.ts           (45 LOC)
└── printful/
    ├── client.ts          (315 LOC) — HTTP client + all endpoints
    ├── mapper.ts          (301 LOC) — Data transformation Printful↔Canonical
    ├── constants.ts       (55 LOC)  — Event maps, position maps
    ├── webhook-verifier.ts (32 LOC) — Query param secret verification
    └── index.ts           (287 LOC) — PrintfulProvider implementation
```

### Interfaces Segregadas (ISP)

```typescript
interface IProductOperations {
  createProduct(design): Promise<CanonicalProduct>
  updateProduct(id, changes): Promise<CanonicalProduct>
  deleteProduct(id): Promise<void>
  listProducts(options): Promise<PaginatedResult<CanonicalProduct>>
}

interface ICatalogOperations {
  getCatalogProducts(): Promise<CatalogProduct[]>
  getCatalogVariants(catalogId): Promise<CatalogVariant[]>
  getShippingRates(address, items): Promise<ShippingRate[]>
}

interface IOrderOperations {
  submitOrder(order): Promise<CanonicalOrder>
  getOrder(id): Promise<CanonicalOrder>
  cancelOrder(id): Promise<void>
}

interface IDesignOperations {
  uploadDesign(file): Promise<DesignFile>
  generateMockup(productId, designs): Promise<MockupResult>
}

interface IWebhookOperations {
  verifyWebhook(req): Promise<boolean>
  normalizeEvent(raw): NormalizedWebhookEvent
}
```

## Printful HTTP Client

**Archivo**: `frontend/src/lib/pod/printful/client.ts` (315 LOC)

### Características
- **Rate limiting**: Token bucket (120 req/min) con sliding window 60s
- **Response handling**: Unwrap automático de envelope `{ code, result, paging? }`
- **Retry**: Hasta 2 reintentos para 5xx, respeta `Retry-After` para 429
- **Caching**: 10-min TTL para GET requests de catálogo
- **Headers**: Bearer auth + User-Agent + optional X-PF-Store-Id

### Endpoints Implementados (18)

| Operación | Endpoint | Método | Uso |
|-----------|----------|--------|-----|
| Create sync product | `/store/products` | POST | Design→Product pipeline |
| List products | `/store/products` | GET | Cron reconciliation |
| Get product | `/store/products/{id}` | GET | Product detail |
| Update product | `/store/products/{id}` | PUT | Sync updates |
| Delete product | `/store/products/{id}` | DELETE | Cleanup |
| Upload file | `/files` | POST | Design upload |
| Create order | `/orders?confirm=true` | POST | Checkout completion |
| Get order | `/orders/{id}` | GET | Status check |
| Confirm order | `/orders/{id}/confirm` | POST | Submit for production |
| Cancel order | `/orders/{id}` | DELETE | Cancellation |
| Get shipping rates | `/shipping/rates` | POST | Cart/checkout |
| Create mockup task | `/mockup-generator/create-task/{id}` | POST | Design preview |
| Poll mockup task | `/mockup-generator/task` | GET | Async result polling |
| Get catalog products | `/products` | GET | Cached (10 min TTL) |
| Get catalog variants | `/products/{id}` | GET | Variant details |
| Get printfiles | `/products/{id}/printfiles` | GET | Canvas specs |
| Get countries | `/countries` | GET | Shipping form |
| Get tax rates | `/tax/rates` | GET | Tax calculation |

## Data Transformation (Mapper)

**Archivo**: `frontend/src/lib/pod/printful/mapper.ts` (301 LOC)

### Printful → Canonical

```typescript
// Blueprint reference format
"printful:{catalogProductId}"  // vs Printify: "printify:{blueprintId}:{providerId}"

// Variant parsing: extrae size/color del título
"Black / M" → { color: "Black", size: "M" }

// Position mapping
const POSITION_MAP = {
  'front':       'front',
  'back':        'back',
  'label_outside': 'neck_outer',
  'sleeve_left': 'sleeve_left',
  'sleeve_right': 'sleeve_right',
  'embroidery_chest_center': 'chest_center',
  'embroidery_chest_left': 'chest_left',
  'embroidery_wrist': 'wrist',
}
```

### Canonical → Printful (Order submission)

```typescript
// Address mapping
canonical.address → {
  name: address.name,
  address1: address.line1,
  city: address.city,
  state_code: address.state,
  country_code: address.country,
  zip: address.zip,
}

// Line items
canonical.items → [{
  sync_variant_id: item.externalVariantId,
  quantity: item.quantity,
  retail_price: (item.priceCents / 100).toFixed(2),
}]
```

## Webhooks Printful

### Endpoint
`POST /api/webhooks/pod/[provider]`

### Verificación
- **Printful**: Query param `?secret=PRINTFUL_WEBHOOK_SECRET`
- **Printify**: HMAC header `x-printify-hmac-sha256`

### Eventos Normalizados (11)

| Evento Printful | Evento Canonical | Handler | Acción |
|----------------|------------------|---------|--------|
| `order_created` | `order.created` | order-created | Log + notification |
| `order_updated` | `order.updated` | order-updated | Status sync |
| `order_shipped` | `order.shipped` | order-shipped | Tracking update + email |
| `order_failed` | `order.failed` | order-failed | Auto-refund + email |
| `order_canceled` | `order.cancelled` | order-cancelled | Refund + notification |
| `product_synced` | `product.created` | product-created | DB sync |
| `product_updated` | `product.updated` | product-updated | DB update |
| `product_deleted` | `product.deleted` | product-deleted | Soft delete |
| `stock_updated` | `stock.updated` | stock-updated | Variant availability |
| `order_put_hold` | `order.hold` | — | Notification |
| `order_remove_hold` | `order.resume` | — | Notification |

### Error handling
- Siempre retorna HTTP 200 (prevenir retry loops)
- Fallos persisten en tabla `webhook_dead_letters` (DLQ)

## PodClaw Legacy: Printify Connector

**Archivo**: `podclaw/connectors/printify_connector.py` (1,366 LOC)

### Tools que necesitan equivalente Printful

| Tool Printify | Equivalente Printful Necesario |
|---------------|-------------------------------|
| `printify_list_products` | `printful_list_products` |
| `printify_get_product` | `printful_get_product` |
| `printify_create_product` | `printful_create_product` |
| `printify_update_product` | `printful_update_product` |
| `printify_delete_product` | `printful_delete_product` |
| `printify_publish_product` | N/A (Printful auto-publica) |
| `printify_get_blueprints` | `printful_get_catalog` |
| `printify_get_blueprint_providers` | `printful_get_catalog_variants` |
| `printify_get_provider_variants` | `printful_get_printfiles` |
| `printify_upload_image` | `printful_upload_file` |
| `printify_create_order` | `printful_create_order` |
| `printify_get_order` | `printful_get_order` |
| `printify_cancel_order` | `printful_cancel_order` |
| `printify_get_shipping` | `printful_get_shipping_rates` |
| `printify_calculate_shipping` | (mismo endpoint) |
| `printify_get_mockup` | `printful_create_mockup` |
| `printify_accept_gpsr` | N/A (Printful diferente flow) |
| `printify_set_gpsr` | N/A (GPSR en product_details) |
| `printify_list_shops` | N/A (single store) |

### Tools sin equivalente directo
- `printify_publish_product` → Printful no tiene publish step separado
- `printify_accept_gpsr` / `printify_set_gpsr` → GPSR se maneja via product_details JSONB en Supabase
- `printify_list_shops` → Printful usa store ID directo

## Reconciliación Cron (Existente)

**Archivo**: `frontend/src/app/api/cron/sync-printify/route.ts` (342 LOC)

### Ciclo de 30 minutos
1. Fetch ALL productos del proveedor (paginado, max 500)
2. Crea missing en Supabase
3. Actualiza stale (nombre, precio, variantes)
4. Marca orphaned como deleted
5. Reconcilia variant availability (10% sampling)
6. Audita márgenes <35% y corrige pricing
7. Reporta via monitoring + Telegram alerts

### Order Retry Cron

**Archivo**: `frontend/src/app/api/cron/retry-printify-orders/route.ts` (227 LOC)

- Ejecuta cada 5 minutos
- Reintenta pedidos fallidos (hasta 3 intentos en 30 min)
- Auto-refund después de timeout (2h)
- Usa `submitOrderToPOD()` (provider-agnostic)

## Variables de Entorno

```bash
PRINTFUL_API_TOKEN              # [REQUIRED] Bearer token
PRINTFUL_WEBHOOK_SECRET         # [REQUIRED] Verificación webhooks
PRINTFUL_STORE_ID               # [OPTIONAL] X-PF-Store-Id header
PRINTFUL_TOKEN_EXPIRES_AT       # [OPTIONAL] Rotación warning
POD_PROVIDER=printful           # [DEFAULT] Selector de provider
```

## Gap Analysis: PodClaw v2

### Lo que ya existe (frontend, reutilizable)
- HTTP client completo con rate limiting y retry
- Mapper Printful↔Canonical bidireccional
- Webhook normalization y DLQ
- Order submission con confirm=true
- Reconciliation cron

### Lo que falta para PodClaw v2

| Gap | Descripción | Prioridad |
|-----|-------------|-----------|
| Conector Python Printful | PodClaw usa Python, no hay client Printful | CRITICAL |
| Mockup async polling | Crear mockup → poll → preview al CEO | HIGH |
| GPSR flow Printful | Diferente a Printify (no hay accept_gpsr endpoint) | HIGH |
| Multi-position upload | Upload diseño por posición (front, back, neck) | HIGH |
| Variant selection logic | Elegir colores/tallas según catálogo Printful | MEDIUM |
| Tax calculation | `POST /tax/calculate` no integrado | LOW |

### Decisión arquitectónica: ¿Nuevo conector Python o reutilizar Node?

**Opción A**: Nuevo conector Python en `podclaw/connectors/printful_connector.py`
- Pro: Nativo en el stack PodClaw
- Contra: Duplica lógica ya implementada en TypeScript

**Opción B**: PodClaw llama al frontend como API gateway
- Pro: Reutiliza mapper, rate limiter, caching existentes
- Contra: Acoplamiento frontend↔backend, latencia

**Opción C** (Recomendada): MCP tools en mcp-server que wrappean el frontend client
- Pro: Reutiliza todo, PodClaw accede via MCP protocol
- Contra: Requiere mcp-server como intermediario

## Archivos de Referencia

| Archivo | LOC | Propósito |
|---------|-----|-----------|
| `frontend/src/lib/pod/printful/client.ts` | 315 | HTTP client |
| `frontend/src/lib/pod/printful/mapper.ts` | 301 | Data transformation |
| `frontend/src/lib/pod/printful/constants.ts` | 55 | Event/position maps |
| `frontend/src/lib/pod/printful/index.ts` | 287 | Provider implementation |
| `frontend/src/lib/pod/types.ts` | 165 | Provider interface |
| `frontend/src/lib/pod/submit-order-to-pod.ts` | 125 | Order submission |
| `frontend/src/app/api/webhooks/pod/[provider]/route.ts` | 159 | Webhook endpoint |
| `frontend/src/app/api/cron/sync-printify/route.ts` | 342 | Reconciliation |
| `frontend/src/app/api/cron/retry-printify-orders/route.ts` | 227 | Order retry |
| `podclaw/connectors/printify_connector.py` | 1366 | Legacy Printify (a reemplazar) |
