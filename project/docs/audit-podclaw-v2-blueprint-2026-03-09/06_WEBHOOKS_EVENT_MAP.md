# Webhooks, Eventos y Triggers — Mapa Completo

*Generado por agente de exploración 2026-03-09*

## Resumen

El proyecto tiene **webhooks de Stripe y POD providers bien implementados**, 12 cron jobs con código existente (algunos no activados en producción), y **zero Supabase Realtime**. Seguridad webhook correcta (HMAC en todos).

## Webhooks Activos

### Stripe (7 eventos)

| Evento | Handler | Acción | Archivo |
|--------|---------|--------|---------|
| `checkout.session.completed` | checkout-completed | Crear orden + submit a POD | `frontend/src/lib/webhooks/stripe/checkout-completed.ts` |
| `customer.subscription.created` | subscription handler | Asignar tier + bonus credits | `frontend/src/app/api/webhooks/stripe/route.ts` |
| `customer.subscription.updated` | subscription handler | Update tier + recalc credits | mismo |
| `customer.subscription.deleted` | subscription handler | Downgrade a free tier | mismo |
| `invoice.payment_failed` | invoice handler | Status past-due + email retry | mismo |
| `charge.dispute.created` | dispute handler | Pausa fulfillment + alerta | mismo |
| `charge.refunded` | refund handler | Sync refund desde Stripe Dashboard | mismo |

**Verificación**: HMAC-SHA256 via `stripe-signature` header
**Idempotencia**: UNIQUE constraint en `stripe_session_id`

### POD Provider (Printful/Printify) (11 eventos normalizados)

| Evento Canonical | Handler | Acción | Archivo |
|-----------------|---------|--------|---------|
| `order.created` | order-created | Log + notification admin | `frontend/src/lib/pod/webhooks/handlers/` |
| `order.updated` | order-updated | Sync status en orders table | mismo |
| `order.shipped` | order-shipped | Update tracking + email cliente | mismo |
| `order.delivered` | (synthesized) | Mark delivered (via cron polling) | cron check-delivery |
| `order.failed` | order-failed | Auto-refund + email + alerta | mismo |
| `order.cancelled` | order-cancelled | Refund + notification | mismo |
| `product.created` | product-created | Sync producto a Supabase | mismo |
| `product.updated` | product-updated | Update datos en Supabase | mismo |
| `product.deleted` | product-deleted | Soft delete en Supabase | mismo |
| `stock.updated` | stock-updated | Update variant availability | mismo |
| `order.hold` | — | Notification admin | sin handler dedicado |

**Endpoint**: `POST /api/webhooks/pod/[provider]` (dynamic routing)
**Verificación Printful**: Query param `?secret=PRINTFUL_WEBHOOK_SECRET`
**Verificación Printify**: HMAC header `x-printify-hmac-sha256`
**Error handling**: Siempre retorna 200, fallos → `webhook_dead_letters` (DLQ)

### Telegram (Admin Commands)

| Comando | Acción | Respuesta |
|---------|--------|-----------|
| `/status` | Estado del sistema | Health check resumen |
| `/agents` | Lista agentes PodClaw | Estado de cada agente |
| `/run <agent>` | Ejecutar agente manualmente | Confirmación |
| `/pause <agent>` | Pausar agente | Confirmación |
| `/orders` | Últimos pedidos | Lista resumida |
| `/revenue` | Ingresos del día/semana | Métricas |

**Endpoint**: `POST /api/telegram/webhook`
**Verificación**: Secret token (fail-closed si falta)

### WhatsApp

**Endpoint**: `POST /api/webhooks/whatsapp`
- Command routing + message storage
- Fail-closed signature verification (HMAC-SHA256)
- Solo texto entrante, sin imágenes ni botones interactivos

## Cron Jobs (12)

### Activos / Documentados

| Cron Job | Schedule | Archivo | Qué Hace | ¿Event-driven posible? |
|----------|----------|---------|----------|----------------------|
| `sync-printify` | 30 min | `api/cron/sync-printify/route.ts` | Reconciliación completa con Printful | Parcial (webhooks cubren 80%) |
| `retry-printify-orders` | 5 min | `api/cron/retry-printify-orders/route.ts` | Reintenta pedidos fallidos, auto-refund 2h | Sí (webhook order.failed) |
| `check-delivery-status` | variable | `api/cron/check-delivery-status/` | Polling delivery status (workaround Printful) | No (Printful no envía delivered webhook) |
| `abandoned-cart-recovery` | 30-60 min | `api/cron/abandoned-cart-recovery/route.ts` | Email recovery 2 stages (1h + 24h) | Parcial (timer event) |
| `drip` | 15-30 min | `api/cron/drip/route.ts` | Procesa cola de emails drip | Sí (scheduled event) |
| `product-metrics` | diario | `api/cron/product-metrics/` | ETL analytics (producto + portfolio) | No (batch necesario) |
| `cleanup` | diario | `api/cron/cleanup/` | Limpieza datos temporales | No (maintenance) |
| `zombie-reaper` | variable | `api/cron/zombie-reaper/` | Mata sesiones zombi | Sí (timeout event) |
| `hard-delete-accounts` | diario | `api/cron/hard-delete-accounts/` | GDPR: borrado definitivo | No (compliance batch) |

### PodClaw Scheduler

**Archivo**: `podclaw/scheduler.py`

| Agente | Schedule | Qué Hace |
|--------|----------|----------|
| researcher | 06:00 UTC | Investigar tendencias |
| marketing | 07:00, 15:00 | Contenido marketing |
| designer | 08:00 | Crear diseños |
| newsletter | 09:00, 17:00 | Email campaigns |
| cataloger | 10:00, 14:00, 18:00 | Gestión catálogo |
| qa_inspector | 10:00 | Inspección calidad |
| customer_manager | 12:00, 22:00 | Soporte cliente |
| finance | 23:00 | Reporting financiero |
| seo_manager | Domingos 16:00 | SEO audit |
| brand_manager | Lunes 08:00 | Brand consistency |

**TODOS estos crons deben migrar a event-driven en PodClaw v2.**

## Event Store (PodClaw)

**Archivo**: `podclaw/event_store.py`

- Audit trail inmutable de TODAS las acciones de agentes
- Tabla: `agent_events` (particionada por mes)
- Columnas: `agent_name`, `event_type`, `tool_name`, `input/output` (JSONB), `cost_usd`, `created_at`
- Escritura via Supabase client (sync, envuelto en `asyncio.to_thread()`)

## Event Queue (PodClaw)

**Archivo**: `podclaw/event_queue.py`

- Cola interna para comunicación inter-agente
- Dead Letter Queue con TTL 7d (sin alerting)
- `wake_mode: "next-heartbeat"` — ignorado en implementación actual (bug M2)
- `drain()` procesa todos inmediatamente

## Heartbeat (PodClaw)

**Archivo**: `podclaw/heartbeat.py`

- Health monitoring periódico
- Alertas via Telegram + in-app notifications
- Dedup window: 5 min (previene spam)
- Sources: Disputes, payment failures, order issues

## Analytics Events (Frontend)

| Evento | Trigger | Datos |
|--------|---------|-------|
| `view_product` | Visitar producto | product_id, category |
| `add_to_cart` | Añadir al carrito | product_id, variant, quantity |
| `begin_checkout` | Iniciar checkout | cart total, item count |
| `purchase` | Compra completada | order_id, total, items |

- Tracking basado en sesión (sessionStorage)
- Consent-aware (respeta preferencias de cookies)

## Supabase Triggers/Functions

### Encontrados en Migraciones

| Trigger/Function | Tabla | Cuándo | Qué Hace |
|-----------------|-------|--------|----------|
| `update_updated_at` | Múltiples | BEFORE UPDATE | Set `updated_at = NOW()` |
| `on_auth_user_created` | auth.users | AFTER INSERT | Crear perfil en `profiles` |
| `notify_order_status` | orders | AFTER UPDATE | PG notify (no listener activo) |

### NO Encontrado
- **Supabase Realtime**: No hay suscripciones activas en el frontend
- **Edge Functions**: Directorio existe pero vacío
- **PG Listen/Notify**: `notify_order_status` existe pero no hay listener

## Mapa de Eventos: Source → Handler → Side Effects

```
STRIPE
  checkout.session.completed
    → crear order en Supabase
    → crear order_items
    → submit order a Printful
    → enviar email confirmación
    → analytics: purchase event

  charge.dispute.created
    → pausar fulfillment
    → alerta admin (Telegram + in-app)
    → log audit

PRINTFUL
  order.shipped
    → update order.status = 'shipped'
    → update tracking_number + tracking_url
    → enviar email "shipped" al cliente

  order.failed
    → update order.status = 'failed'
    → auto-refund via Stripe
    → enviar email "failed" al cliente
    → alerta admin

  stock.updated
    → update product_variants.stock_status
    → alerta si out_of_stock

TELEGRAM (Admin)
  /run <agent>
    → PodClaw bridge API: start agent session
    → ejecutar agente
    → retornar resultado via Telegram

CRON (Reconciliation)
  sync-printify (30 min)
    → fetch Printful products
    → create/update/delete en Supabase
    → audit márgenes
    → report via Telegram

  check-delivery (variable)
    → poll Printful order status
    → if shipped + 14d → mark delivered (synthesized event)
    → enviar email "delivered"
```

## Gaps Críticos para PodClaw v2

### CRITICAL

| Gap | Impacto | Solución |
|-----|---------|---------|
| No Supabase Realtime | Frontend no puede ver updates en vivo | Habilitar Realtime en tablas key |
| No inbound email webhook | No detecta respuestas de clientes | Resend inbound webhook |
| PodClaw agent actions no emiten eventos | Frontend desconectado de acciones de agentes | Event bridge PodClaw → webhook |
| Cron jobs no activados en prod | Funcionalidad muerta | Activar en Vercel/VPS cron |

### HIGH

| Gap | Impacto | Solución |
|-----|---------|---------|
| DLQ sin auto-retry | Webhooks fallidos se pierden después de 7d | Exponential backoff retry |
| Delivery polling (3+ días delay) | Cliente no sabe cuándo llegó | Polling más frecuente o carrier API |
| No monitoring dashboard | Solo Telegram + console logs | Grafana/admin panel |
| WhatsApp sin botones interactivos | CEO no puede aprobar/rechazar | Meta Interactive Messages API |

### MEDIUM

| Gap | Impacto | Solución |
|-----|---------|---------|
| notify_order_status sin listener | PG notify inútil | Supabase Realtime en su lugar |
| Event queue wake_mode ignorado | Eventos se procesan todos de golpe | Fix drain() para respetar modes |
| Analytics sin server-side | Solo client-side tracking | Server events para accuracy |

## Recomendaciones para PodClaw v2

### Eventos que deben migrar de cron a event-driven

| Actual (Cron) | Nuevo (Event) | Trigger |
|--------------|---------------|---------|
| PodClaw scheduler (10 agentes) | CEO command via WhatsApp | Mensaje del CEO |
| retry-printify-orders | Printful webhook `order.failed` | Webhook automático |
| abandoned-cart-recovery | Timer event (1h/24h después de add_to_cart) | Scheduled event |
| drip queue processor | Timer event (send_at) | Scheduled event |
| zombie-reaper | Session timeout event | Timeout trigger |

### Eventos que deben PERMANECER como cron

| Cron | Razón |
|------|-------|
| sync-printify | Reconciliación batch necesaria (webhooks cubren 80%, no 100%) |
| check-delivery-status | Printful no envía webhook delivered |
| product-metrics | ETL batch diario |
| cleanup | Maintenance batch |
| hard-delete-accounts | GDPR compliance batch |

### Nuevos eventos necesarios para PodClaw v2

| Evento | Source | Action |
|--------|--------|--------|
| `ceo.message` | WhatsApp/Telegram inbound | Route to appropriate agent |
| `ceo.image` | WhatsApp image upload | Start design pipeline |
| `ceo.approve` | WhatsApp button click | Confirm action (publish, order, etc.) |
| `ceo.reject` | WhatsApp button click | Cancel action |
| `customer.email` | Resend inbound webhook | Route to customer_manager agent |
| `agent.completed` | PodClaw agent finishes | Notify CEO via WhatsApp |
| `agent.needs_approval` | Agent needs CEO decision | Send approval request to WhatsApp |
| `design.ready` | Design pipeline complete | Send preview to CEO |
| `product.published` | Product live on store | Notify CEO |
| `sale.completed` | Stripe checkout done | Notify CEO + trigger fulfillment |
