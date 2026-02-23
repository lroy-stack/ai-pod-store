# Auditoría Integral — Integración con Printify

**Fecha**: 2026-02-23
**Alcance**: Arquitectura, stock, productos, checkout/órdenes, gobernanza PodClaw
**Método**: Análisis estático exhaustivo del código fuente (read-only)
**Score General**: 6.5/10

---

## Resumen Ejecutivo

La integración Printify del POD AI Store es **funcionalmente completa** pero **operacionalmente frágil**. El flujo principal (diseño → producto → venta → fulfillment) funciona end-to-end con webhooks bidireccionales, idempotency checks y reconciliación cron. Sin embargo, se identificaron **28 hallazgos** (12 críticos, 9 moderados, 7 bajos) que impactan confiabilidad, consistencia de datos y experiencia del cliente.

### Hallazgos Críticos Top 7

| # | Hallazgo | Impacto | Ubicación |
|---|----------|---------|-----------|
| 1 | Retry cron existe PERO no recupera órdenes sin `printify_order_id` | Órdenes donde `createOrder()` falló quedan stuck | `cron/retry-printify-orders/route.ts` |
| 2 | Sin refund automático cuando Printify cancela | Cliente pagó, no recibe producto ni reembolso | `webhooks/printify/route.ts:327-365` |
| 3 | Race condition en sync de variantes (DELETE+INSERT) | Pérdida de datos durante sync concurrente | `printify-sync.ts:246-254` |
| 4 | Sin validación de stock real vs Printify API en checkout | Órdenes rechazadas post-pago | `checkout/create-session/route.ts:145-187` |
| 5 | Productos temp personalizados sin cleanup | Huérfanos acumulándose en Printify | `checkout/create-session/route.ts:189-302` |
| 6 | `DynamicPriceStock` hardcoded `inStock = true` | UI siempre muestra "In Stock" sin verificación | `components/products/DynamicPriceStock.tsx` |
| 7 | Race condition checkout concurrente sin lock | Dos usuarios compran misma variante simultáneamente | `checkout/create-session/route.ts:145` |

---

## 1. Mapa Arquitectónico

### 1.1 Sistemas Involucrados (10)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRINTIFY INTEGRATION MAP                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐  │
│  │  Printify    │◄───►│  PrintifyMCP  │◄───►│   PodClaw       │  │
│  │  API v1      │     │  Connector    │     │   Agents        │  │
│  │              │     │  (1072 lines) │     │  (Cataloger,    │  │
│  │  REST        │     │  31 methods   │     │   Designer,     │  │
│  │  Bearer auth │     │              │     │   QA, Finance)  │  │
│  └──────┬───────┘     └──────────────┘     └─────────────────┘  │
│         │                                                        │
│         │ Webhooks (HMAC-SHA256)                                 │
│         ▼                                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐  │
│  │  Frontend     │◄───►│  Supabase    │◄───►│   Admin Panel   │  │
│  │  Webhook      │     │  (source of  │     │   Products CRUD │  │
│  │  Handler      │     │   truth)     │     │   Orders view   │  │
│  └──────┬───────┘     └──────────────┘     └─────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────────┐  │
│  │  Stripe       │     │  Cron Jobs   │     │   MCP Server    │  │
│  │  Payments     │     │  sync (2h)   │     │   (17 tools)    │  │
│  │  Webhooks     │     │  reconcile   │     │   get-order     │  │
│  └──────────────┘     └──────────────┘     └─────────────────┘  │
│                                                                  │
│  ┌──────────────┐                                                │
│  │  Sync Hook   │ PostToolUse — auto-sync Printify→Supabase     │
│  │  (sync_hook  │ after every Cataloger tool call                │
│  │   .py)       │                                                │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 PrintifyMCPConnector — 31 Métodos

**Archivo**: `podclaw/connectors/printify_mcp_connector.py` (1072 líneas)

| Categoría | Métodos | Críticos |
|-----------|---------|----------|
| Productos | `create_product`, `update_product`, `delete_product`, `get_product`, `list_products` | create, delete |
| Publicación | `publish_product`, `unpublish_product`, `get_publish_status` | publish |
| Imágenes | `upload_image`, `upload_image_from_url`, `get_mockup` | upload |
| Variantes | `get_variants`, `update_variants` | update |
| Órdenes | `create_order`, `submit_order`, `cancel_order`, `get_order`, `list_orders` | create, submit |
| Blueprints | `get_blueprints`, `get_blueprint_providers`, `get_print_providers` | — |
| Shop | `get_shop`, `get_shops` | — |
| Webhooks | `create_webhook`, `list_webhooks`, `delete_webhook` | create |
| Uploads | `get_uploads`, `archive_upload` | — |

### 1.3 Flujo de Datos Principal

```
CREACIÓN:
  Designer → fal_remove_bg → supabase_upload → designs table
  Cataloger → printify_upload_image → printify_create_product
  Sync Hook → upsert products + insert variants (Supabase)

PUBLICACIÓN:
  Cataloger → printify_publish (3 ciclos/día: 10:00, 14:00, 18:00 UTC)
  Sync Hook → verify visible=true → status=active + published_at

VENTA:
  Cliente → checkout → Stripe payment → webhook → create order Supabase
  Webhook → create Printify order → submit to production
  Printify → webhook shipped → update tracking → notify cliente

SINCRONIZACIÓN:
  Cron (2h) → full reconciliation Printify↔Supabase
  Reconcile script → detect orphans/ghosts → fix
```

---

## 2. Stock e Inventario

### 2.1 Modelo: Make-to-Order (MTO)

POD AI no mantiene inventario físico. Printify produce bajo demanda. El "stock" se reduce a **disponibilidad de variantes** (talla/color) del proveedor.

### 2.2 Campos de Disponibilidad

**Tabla `product_variants`** (`supabase/migrations/20260213000000_initial_schema.sql:71-82`):

| Campo | Tipo | Significado |
|-------|------|-------------|
| `is_enabled` | BOOLEAN | Variante publicada (controlable) |
| `is_available` | BOOLEAN | Proveedor tiene stock (de Printify) |

### 2.3 Sincronización de Disponibilidad

**`printify-sync.ts:239`**: `is_available: v.is_available !== false`

La disponibilidad se sincroniza en 3 momentos:
1. **Webhook** `product:updated` → inmediato (pero Printify no siempre envía para cambios de variante)
2. **Cron sync** cada 2h → reconciliación completa
3. **Sync Hook** PostToolUse → después de cada acción del Cataloger

### 2.4 Validación en Checkout

**`checkout/create-session/route.ts:145-187`**:

```
✅ Producto activo (status='active') — línea 126-129
✅ Variante habilitada (is_enabled=true) — línea 151
✅ Variante disponible (is_available=true) — línea 168
❌ NO valida contra Printify API en tiempo real
```

**Respuesta si no disponible**: HTTP 409 `ITEMS_UNAVAILABLE` con lista de items afectados.

### 2.5 Frontend: DynamicPriceStock Hardcoded

**`components/products/DynamicPriceStock.tsx`**:
```typescript
const inStock = true  // ← HARDCODED, sin verificación real
```

El componente que renderiza disponibilidad de stock **siempre retorna "In Stock"**. No consulta ni Supabase ni Printify.

### 2.6 Campo `stock_quantity` Eliminado

El campo `stock_quantity INTEGER DEFAULT 0` **existía en `migrations_backup/`** pero fue removido intencionalmente del schema de producción. Solo quedan flags booleanos (`is_available`, `is_enabled`).

### 2.7 Race Condition en Checkout Concurrente

```
T0: User A valida is_available=true  ← No hay lock
T1: User B valida is_available=true  ← Simultáneo
T2: User A crea Stripe session
T3: User B crea Stripe session
T4: Ambos pagan → 2 órdenes a Printify para misma variante
```

Sin `SELECT FOR UPDATE` ni mecanismo de reserva. Apropiado para POD (producción infinita), pero problemático para variantes con disponibilidad limitada de proveedor.

### 2.8 Hallazgos de Stock

| ID | Hallazgo | Severidad | Detalle |
|----|----------|-----------|---------|
| S1 | Ventana de 2h sin sync de disponibilidad | ALTA | No hay webhook específico para cambios de `is_available` en variantes. Depende del cron cada 2h. |
| S2 | Carrito no valida continuamente | MEDIA | Cliente puede agregar producto, esperar días, y fallar en checkout sin advertencia previa. |
| S3 | Sin validación real-time vs Printify API | ALTA | Checkout valida contra tabla local (Supabase), no contra Printify. Si proveedor descontinúa entre syncs, orden puede ser rechazada. |
| S4 | Sin throttling/backoff en Printify API | MEDIA | Connection pooling (10 max) pero sin rate limiting, retry con backoff, o detección de 429. |
| S5 | Timeout fijo 30s sin retry | BAJA | Si Printify está lento, todas las llamadas fallan sin reintentar. |
| S6 | `DynamicPriceStock` hardcoded `inStock=true` | ALTA | UI siempre muestra disponible. Cliente no recibe señal visual de discontinuación. |
| S7 | `stock_quantity` removido del schema | MEDIA | Solo flags booleanos, sin tracking numérico de inventario/reservas. |
| S8 | Race condition checkout sin lock | ALTA | Dos usuarios checkout simultáneo, sin `SELECT FOR UPDATE` ni reserva. |

---

## 3. Ciclo de Vida de Productos

### 3.1 Creación (Designer + Cataloger)

```
1. Designer: genera imagen con fal.ai
2. Designer: fal_remove_bg → limpia fondo
3. Designer: supabase_upload → designs table (status=ready)
4. Cataloger: printify_upload_image → Printify CDN
5. Cataloger: printify_create_product → Printify API
6. Sync Hook (PostToolUse): upsert products + insert variants → Supabase
```

**Pricing**: `engagement_price(cost_eur, product_type)` con tabla de multiplicadores:
- Mínimo: 40% margen
- Máximo: 3x costo
- Variación ±20% permitida por actualización

### 3.2 Publicación

```
Cataloger → printify_publish → POST /publish.json
Sync Hook → verify visible=true en Printify
  SI visible → status=active + published_at=NOW()
  NO visible → status=publishing (transitional, cron reconcilia)
```

**Quality Gate**: Score ≥6 requerido para publicar (evaluado por QA agent).

### 3.3 Actualización

- `printify_update` solo permite: title, description, variant prices
- **NO se puede cambiar** blueprint/provider (requiere delete+recreate)
- Sync Hook auto-patch en Supabase después de cada update

### 3.4 Eliminación

```
Cataloger → printify_delete_product → Printify API DELETE
Sync Hook → hard delete en Supabase:
  1. Unlink designs (product_id = NULL, preserve)
  2. CASCADE DELETE: product_variants, cart_items, wishlist_items
  3. DELETE product
```

**Cron alternativo**: Marca orphans como `status=deleted` (soft mark).

### 3.5 Hallazgos de Productos

| ID | Hallazgo | Severidad | Detalle |
|----|----------|-----------|---------|
| P1 | DEDUP por título NO implementado | CRÍTICA | SKILL.md menciona "DEDUP CHECK" (línea 93) pero no existe en código. Solo `ON CONFLICT (printify_id)` previene dups de Printify ID, no de título. |
| P2 | Admin edits sobrescritos por Cataloger | CRÍTICA | Si admin edita título en UI y Cataloger re-ejecuta sync, se pierde el edit. No hay flag `edited_by_admin`. |
| P3 | Race condition en variantes | CRÍTICA | Webhook y cron hacen DELETE+INSERT simultáneamente en `product_variants`. Variantes insertadas entre DELETE e INSERT se pierden. |
| P4 | Sin transacción ACID Printify↔Supabase | ALTA | Sync Hook es fire-and-forget (PostToolUse). Si `printify_create` succeeds pero Supabase falla → producto orphan. Recovery eventual (cron 2h). |
| P5 | Estado "publishing" puede quedarse stuck | MEDIA | Si Printify no confirma `visible=true`, producto queda en estado transitional. Cron intenta reconfirmar pero sin timeout explícito. |
| P6 | Sin rollback mechanism | ALTA | Si creación falla a mitad (imagen subida, producto no creado), no hay compensación automática. |
| P7 | Sin revisión humana para publicación | ALTA | Quality gate automático (score ≥6) pero ningún humano revisa antes de publicar en la tienda. |
| P8 | Hard delete sin auditoría | MEDIA | `deleteProductCascade()` elimina permanentemente. Sin `deleted_at`, sin registro de quién/por qué eliminó. |

---

## 4. Flujo de Ventas y Órdenes

### 4.1 Diagrama de Flujo Completo

```
CHECKOUT:
  Cliente → POST /api/checkout/create-session
    1. Validar: cartItems, variants, stock (local)
    2. Si personalización: crear temp product en Printify
    3. Crear Stripe Checkout Session (metadata: cart_items)
    4. Redirect a Stripe

PAGO:
  Stripe → POST /api/webhooks/stripe
    1. Verify signature (STRIPE_WEBHOOK_SECRET)
    2. Event: checkout.session.completed
    3. Idempotency check (stripe_session_id)
    4. INSERT orders (status=paid)
    5. INSERT order_items
    6. Crear notificación
    7. Map Printify IDs (products + variants)
    8. POST Printify create order (external_id=order.id)
    9. POST Printify submit to production
    10. UPDATE orders (status=submitted, printify_order_id)
    11. Send confirmation email

FULFILLMENT:
  Printify → POST /api/webhooks/printify
    - order:shipped → tracking_number, email, notification
    - order:delivered → status update, audit log
    - order:cancelled → status update (NO refund automático)

RECONCILIACIÓN:
  Finance Agent (diario 23:00) → Stripe ↔ Supabase ↔ Printify
  Customer Manager (12:00 + 22:00) → return requests, refunds
```

### 4.2 Estados de Orden

```
pending → paid → submitted → in_production → shipped → delivered
                    ↓                            ↓
              requires_review              cancelled → refunded
```

### 4.3 Webhooks de Printify Soportados

| Evento | Handler | Email | Refund | Audit |
|--------|---------|-------|--------|-------|
| `order:created` | Log only | ❌ | ❌ | ❌ |
| `order:shipped` | Update + tracking | ✅ (si prefs) | ❌ | ✅ |
| `order:delivered` | Update status | ❌ | ❌ | ✅ |
| `order:cancelled` | Update status | ❌ | ❌ | ✅ |
| `order:updated` | **NO SOPORTADO** | — | — | — |
| `order:sent-to-production` | **NO SOPORTADO** | — | — | — |

### 4.4 Validación HMAC de Webhooks

**`webhooks/printify/route.ts:26-31`**:
```typescript
const hmac = createHmac('sha256', secret)
hmac.update(body)
const expected = hmac.digest('base64')
return signature === expected  // ← string comparison, NOT timingSafeEqual
```

**Vulnerabilidad**: Comparación con `===` en lugar de `crypto.timingSafeEqual()`. Susceptible a timing attack (hallazgo ya reportado en audit-360/01-security.md).

### 4.5 Hallazgos de Checkout/Órdenes

| ID | Hallazgo | Severidad | Detalle |
|----|----------|-----------|---------|
| O1 | Sin retry scheduler para órdenes stuck | CRÍTICA | `submitOrderForProduction` puede fallar. Se incrementa `printify_retry_count` pero NO hay scheduler que reintente. Órdenes quedan stuck en `submitted`. |
| O2 | Sin refund automático en cancelación | CRÍTICA | Si Printify cancela orden, `handleOrderCancelled` actualiza status pero NO llama `stripe.refunds.create()`. Requiere intervención manual del Customer Manager. |
| O3 | Productos temp personalizados sin cleanup | ALTA | Se crean ANTES de confirmar pago. Si cliente cancela checkout, quedan huérfanos en Printify sin cron de limpieza. |
| O4 | `requires_review` sin refund | ALTA | Si items no tienen `printify_variant_id` mapping, orden se marca `requires_review`. Cliente pagó pero no hay refund automático. |
| O5 | Solo primera remesa procesada | MEDIA | `shipments?.[0]` — si Printify envía múltiples paquetes, solo el primero tiene tracking. |
| O6 | Sin email de entrega | BAJA | `handleOrderDelivered` no envía email al cliente. |
| O7 | Shipping method hardcoded | BAJA | `shipping_method: 1` (estándar). No soporta express/priority. |
| O8 | Evento `order:updated` ignorado | MEDIA | Cambios de estado intermedios de Printify se pierden silenciosamente. |
| O9 | Race condition checkout concurrente | MEDIA | Dos clientes pueden validar stock simultáneamente para misma variante. Sin `SELECT FOR UPDATE`. |
| O10 | Webhook `order:failed` no manejado | ALTA | Si Printify falla producción, no hay evento capturado. Orden queda stuck. |
| O11 | `order_items` sin `personalization_id` | MEDIA | No se puede rastrear qué personalización se usó en cada item del pedido. |
| O12 | `charge.dispute.created` no manejado | ALTA | Chargebacks/disputes de banco no detectados ni auto-cancelados. |

---

## 5. Gobernanza PodClaw

### 5.1 Capas de Control (8)

```
Capa 1: config.py         — max_budget_usd, allowed_tools por agente
Capa 2: can_use_tool hooks — deny chain (security.py)
Capa 3: SKILL.md          — instrucciones por agente (Cataloger, Designer, QA)
Capa 4: Pricing Engine     — engagement_price() con floor/ceiling
Capa 5: Quality Gate       — score ≥6 para publicar
Capa 6: Sync Hook          — PostToolUse auto-sync Printify→Supabase
Capa 7: Audit Trail        — agent_events table
Capa 8: Cron Reconcile     — safety net cada 2h
```

### 5.2 Matriz de Capacidades por Agente

| Agente | Crear | Publicar | Precio | Eliminar | Órdenes |
|--------|-------|----------|--------|----------|---------|
| **Cataloger** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Designer** | Upload solo | ❌ | ❌ | ❌ | ❌ |
| **QA** | Read only | ❌ | ❌ | ❌ | ❌ |
| **Finance** | ❌ | ❌ | Advisory | ❌ | Read |
| **Customer Manager** | ❌ | ❌ | ❌ | ❌ | Cancel/Refund |

### 5.3 Protección de Precios

```
Mínimo margen: 40% (floor)
Máximo precio: 3x costo (ceiling)
Variación por update: ±20% máximo
Fuente: engagement_price() en sync_hook.py
```

### 5.4 Hallazgos de Gobernanza

| ID | Hallazgo | Severidad | Detalle |
|----|----------|-----------|---------|
| G1 | Sin revisión humana para publicación | ALTA | Score ≥6 es automático. Ningún humano aprueba antes de que producto esté visible en tienda. |
| G2 | DEDUP solo por printify_id | ALTA | `ON CONFLICT (printify_id) DO NOTHING`. No detecta duplicados por título, diseño, o blueprint similar. |
| G3 | Sin rollback de publicación | MEDIA | No hay mecanismo para "despublicar" productos automáticamente si se detecta problema post-publish. |
| G4 | Budget por día, no por operación | BAJA | `max_budget_usd` es global por agente. Un batch grande de productos podría consumir todo el budget antes de que Finance detecte. |

---

## 6. Devoluciones y Refunds

### 6.1 Flujo de Returns

```
Cliente → POST /api/orders/[id]/returns
  1. Validar: orden en estado elegible (paid, submitted, shipped, delivered)
  2. Prevenir duplicados (existing return request check)
  3. INSERT return_requests (status=pending, refund_amount=full)

Customer Manager Agent (12:00 + 22:00 UTC):
  - Refund < EUR 100 → auto-aprobado → stripe_create_refund
  - Refund ≥ EUR 100 → requiere human approval (security hook)
  - Si orden aún no en producción → printify_cancel_order
```

### 6.2 Schema Returns

```sql
return_requests:
  - order_id (FK orders)
  - reason (TEXT)
  - status: pending → approved → processing → completed
  - refund_amount_cents, refund_currency
  - stripe_refund_id
  - approved_by, approved_at, completed_at
```

---

## 7. Reconciliación y Monitoreo

### 7.1 Mecanismos de Reconciliación

| Mecanismo | Frecuencia | Alcance |
|-----------|------------|---------|
| Sync Hook (PostToolUse) | Después de cada tool call | Producto individual |
| Cron sync-printify | Cada 2h | Todos los productos (max 1000) |
| Reconcile script | Manual | Full reconciliation bidireccional |
| Finance Agent | Diario 23:00 | Stripe ↔ Supabase revenue |
| Customer Manager | 2x/día | Return requests + refunds |

### 7.2 Queries de Health Check

```sql
-- Órdenes stuck (pagadas pero no en Printify)
SELECT COUNT(*) FROM orders
WHERE status = 'paid' AND printify_order_id IS NULL
AND created_at < NOW() - INTERVAL '1 hour';

-- Órdenes con error Printify
SELECT COUNT(*) FROM orders
WHERE printify_error IS NOT NULL AND status IN ('paid', 'submitted');

-- Productos orphan (en Supabase sin Printify)
SELECT COUNT(*) FROM products
WHERE printify_id IS NOT NULL AND status = 'active'
AND NOT EXISTS (SELECT 1 FROM ... ); -- Requiere API call

-- Returns sin resolver > 7 días
SELECT COUNT(*) FROM return_requests
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '7 days';
```

---

## 8. Matriz Consolidada de Hallazgos

### Críticos (12)

| ID | Hallazgo | Componente | Archivo:Línea |
|----|----------|------------|---------------|
| O1 | Retry cron no recupera órdenes sin `printify_order_id` | Checkout | `cron/retry-printify-orders/route.ts` |
| O2 | Sin refund automático cancelación | Webhooks | `webhooks/printify/route.ts:327-365` |
| O10 | Webhook `order:failed` no manejado | Webhooks | `webhooks/printify/route.ts:71-135` |
| O12 | `charge.dispute.created` (chargeback) no manejado | Webhooks | `webhooks/stripe/route.ts:53-81` |
| P3 | Race condition variantes DELETE+INSERT | Sync | `printify-sync.ts:246-254` |
| S3 | Sin validación real-time vs Printify | Checkout | `checkout/create-session/route.ts:145-187` |
| S6 | `DynamicPriceStock` hardcoded `inStock=true` | Frontend | `components/products/DynamicPriceStock.tsx` |
| S8 | Race condition checkout sin lock | Checkout | `checkout/create-session/route.ts:145` |
| P1 | DEDUP por título no implementado | Cataloger | `skills/cataloger/SKILL.md:93` (spec only) |
| P2 | Admin edits sobrescritos por Cataloger | Admin/Sync | `sync_hook.py:411-469` |
| P4 | Sin transacción ACID Printify↔Supabase | Sync Hook | `sync_hook.py:276-408` |
| P6 | Sin rollback en creación parcial | Cataloger | `printify_connector.py:642-675` |

### Moderados (9)

| ID | Hallazgo | Componente | Archivo:Línea |
|----|----------|------------|---------------|
| S1 | Ventana 2h sin sync disponibilidad | Cron | `cron/sync-printify/route.ts` |
| S2 | Carrito no valida continuamente | Frontend | Cart UI |
| S4 | Sin throttling/backoff Printify API | Connector | `printify_connector.py:211-216` |
| S7 | `stock_quantity` removido, solo flags | Schema | `migrations/20260213000000_initial_schema.sql` |
| O4 | `requires_review` sin refund auto | Webhook | `webhooks/stripe/route.ts:331` |
| O5 | Solo primera remesa procesada | Webhook | `webhooks/printify/route.ts:171` |
| O8 | Evento `order:updated` ignorado | Webhook | `webhooks/printify/route.ts:134` |
| O11 | `order_items` sin `personalization_id` | Schema | `migrations/20260213000000_initial_schema.sql:127` |
| P5 | Estado publishing stuck sin timeout | Sync Hook | `sync_hook.py:593-715` |

### Bajos (7)

| ID | Hallazgo | Componente | Archivo:Línea |
|----|----------|------------|---------------|
| S5 | Timeout fijo 30s sin retry | Connector | `printify_connector.py:213` |
| O3 | Productos temp sin cleanup | Checkout | `checkout/create-session/route.ts:189-302` |
| O6 | Sin email de entrega | Webhook | `webhooks/printify/route.ts:284-325` |
| O7 | Shipping method hardcoded | Checkout | `webhooks/stripe/route.ts:374` |
| O9 | Race condition checkout concurrente | Checkout | `checkout/create-session/route.ts:145` |
| P8 | Hard delete sin auditoría | Sync | `printify-sync.ts:271-312` |
| G4 | Budget diario, no por operación | Config | `podclaw/config.py` |

---

## 9. Recomendaciones Priorizadas

### Semana 1 — Bloqueantes de Producción

1. **Implementar retry scheduler** para órdenes stuck (O1)
   - Cron cada 30min: buscar órdenes `WHERE printify_error IS NOT NULL AND printify_retry_count < 3`
   - `submitOrderForProduction()` con backoff exponencial
   - Después de 3 intentos → escalar a admin + refund automático

2. **Refund automático en cancelación** (O2)
   - En `handleOrderCancelled`: llamar `stripe.refunds.create({ payment_intent })`
   - Notificar cliente por email

3. **Fix HMAC timing attack** (ya reportado)
   - Reemplazar `===` con `crypto.timingSafeEqual()` en webhook verification

### Semana 2 — Integridad de Datos

4. **Transacción atómica para sync de variantes** (P3)
   - Reemplazar DELETE+INSERT con UPSERT (`ON CONFLICT (product_id, printify_variant_id)`)
   - Eliminar race condition

5. **Flag `edited_by_admin`** en products (P2)
   - Agregar columna `admin_edited_at TIMESTAMPTZ`
   - Sync Hook respeta campos editados manualmente

6. **Soft delete de productos** (P8)
   - Agregar `deleted_at`, `deleted_by` a tabla products
   - Webhook usa soft delete en lugar de hard delete

### Semana 3 — Operaciones

7. **Cleanup de productos temp** (O3)
   - Cron diario: buscar `personalizations WHERE printify_temp_product_id IS NOT NULL AND created_at < NOW() - '24h'`
   - Si no hay orden asociada → `printify_delete_product()`

8. **Backoff exponencial en Printify connector** (S4)
   - Implementar retry con `tenacity` o manual backoff
   - Detectar 429 → wait `Retry-After` header
   - Circuit breaker después de 5 fallos consecutivos

9. **Reducir cron sync de 2h a 30min** (S1)
   - Hasta que Printify ofrezca webhook de cambio de disponibilidad

### Sprint Siguiente — Mejoras

10. **Validación real-time en checkout** (S3) — Llamar Printify API para verificar disponibilidad
11. **Email de entrega** (O6) — Copiar lógica de `handleOrderShipped`
12. **Múltiples remesas** (O5) — Iterar `shipments[]` completo
13. **Soporte `order:updated`** (O8) — Handler para estados intermedios
14. **Revisión humana para publicación** (G1) — Admin approval queue
15. **DEDUP por título/diseño** (P1) — Similarity check antes de crear

---

## 10. Métricas de Éxito Post-Corrección

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Órdenes stuck > 1h | Sin tracking | 0 |
| Refunds automáticos en cancelación | 0% | 100% |
| Race conditions en sync | Posible | Eliminado (UPSERT) |
| Ventana de sync disponibilidad | 2h | 30min |
| Productos temp huérfanos | Sin cleanup | Cleanup diario |
| Retry automático fallidos | 0 | 3 intentos con backoff |
| Score integración | 6.5/10 | 8.5/10 |

---

---

## 11. Datos de Referencia — Printify API

### Rate Limits Oficiales

| Tipo | Límite |
|------|--------|
| Global | 600 req/min por integración |
| Catálogo | 100 req/min (separado) |
| Publishing | 200 req/30min |
| Umbral errores | ≤5% del total |
| Exceso | HTTP 429 Too Many Requests |

### Eventos Webhook Reales vs Manejados

| Evento Printify | Manejado | Recomendación |
|----------------|----------|---------------|
| `order:created` | ✅ | OK |
| `order:updated` | ❌ | Agregar handler → actualizar `printify_status` |
| `order:sent-to-production` | ❌ | Agregar → `status='in_production'` |
| `order:shipment:created` | ✅ | OK (como `order:shipped`) |
| `order:shipment:delivered` | ✅ | OK |
| `product:publish:started` | ✅ | OK |
| `product:publish:succeeded` | ✅ | OK |
| `product:publish:failed` | ❌ | Agregar → `status='draft'` + alertar admin |
| `product:deleted` | ✅ | OK |

### Comparativa con Competidores

| Aspecto | Printify | Printful | Gelato |
|---------|----------|----------|--------|
| Modelo | Marketplace (100+ proveedores) | Verticalizado | Producción local (30+ países) |
| Rate limit | 600/min | Leaky bucket | No documentado |
| Webhooks | HMAC-SHA256, 9 eventos | HMAC + expiration, 15 eventos | Limitado |
| Stock events | No específico | `catalog_stock_updated` (5min) | Limitado |
| Order routing | Automático entre proveedores | N/A | AI-driven |
| Idempotencia | Via `external_id` (no nativa) | Idempotency-Key header (v2) | No documentada |

### Recomendaciones Adicionales de Investigación

1. **Dead Letter Queue**: Tabla `webhook_events_failed` para reprocesamiento de webhooks
2. **Mapa de transiciones válidas**: Evitar regresiones de estado (shipped → in_production)
3. **`external_id` obligatorio**: Actualmente opcional en `PrintifyOrderRequest`
4. **Reconciliación de órdenes**: Cada 6h, detectar órdenes pagadas nunca enviadas a Printify
5. **Reconciliación de costos**: Semanal, detectar cambios de precios de proveedores

---

*Auditoría completada 2026-02-23. Basada en análisis estático del código fuente + investigación externa de API Printify. No se aplicaron cambios.*
