# Auditoria de Webhooks, Eventos y Triggers

**Fecha**: 2026-03-09
**Scope**: Frontend API routes, Stripe handlers, POD webhooks, Cron jobs, PodClaw scheduler, DB triggers

---

## 1. Webhook Endpoints

### 1.1 Stripe Webhook

| Endpoint | Metodo | Auth | Archivo |
|---|---|---|---|
| `/api/webhooks/stripe` | POST | `stripe-signature` header + `STRIPE_WEBHOOK_SECRET` | `frontend/src/app/api/webhooks/stripe/route.ts` |

**Eventos Stripe procesados:**

| Evento Stripe | Handler | Accion | Side Effects |
|---|---|---|---|
| `checkout.session.completed` | `handleCheckoutCompleted` | Crea order en DB, crea order_items, submit a POD provider, send email confirmacion | DB: `orders`, `order_items`, `notifications`, `audit_log`, `credit_transactions`. Email: order confirmation. POD: createOrder + submitForProduction. Coupon: increment usage |
| `customer.subscription.created` | `handleSubscriptionUpdate` | Actualiza tier usuario a premium, agrega bonus credits | DB: `users` (tier, subscription_status), `credit_transactions`. Email: drip welcome sequence |
| `customer.subscription.updated` | `handleSubscriptionUpdate` | Mismo que created | Mismos side effects |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Revierte tier a free, status=cancelled | DB: `users` (tier=free, subscription_status=cancelled) |
| `payment_intent.succeeded` | (log only) | Solo console.log | Ninguno |
| `payment_intent.payment_failed` | (log only) | Solo console.log | Ninguno |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Marca subscription como past_due, notifica user + admin | DB: `users` (subscription_status=past_due). Email: payment failed. API: admin alert |
| `charge.dispute.created` | `handleChargeDisputeCreated` | Marca order como disputed, pausa fulfillment | DB: `orders` (status=disputed), `audit_log`, `notifications` (admin). API: admin alert |
| `charge.refunded` | `handleChargeRefunded` | Actualiza order con refund info, notifica user | DB: `orders` (status=refunded, refund details), `notifications`, `audit_log` |

**Archivos handler:**
- `frontend/src/lib/webhooks/stripe/checkout-completed.ts` (mas complejo, ~550 lineas)
- `frontend/src/lib/webhooks/stripe/subscription-handlers.ts`
- `frontend/src/lib/webhooks/stripe/invoice-handlers.ts`
- `frontend/src/lib/webhooks/stripe/dispute-handlers.ts`
- `frontend/src/lib/webhooks/stripe/charge-refunded.ts`
- `frontend/src/lib/webhooks/stripe/shared.ts` (supabase client, helper emails)

### 1.2 POD Provider Webhook (Printify/Printful)

| Endpoint | Metodo | Auth | Archivo |
|---|---|---|---|
| `/api/webhooks/pod/[provider]` | POST | HMAC signature (Printify: `x-printify-hmac-sha256`, Printful: `?secret=`) | `frontend/src/app/api/webhooks/pod/[provider]/route.ts` |

**Eventos POD procesados (via WebhookRouter):**

| Evento Normalizado | Handler | Accion | Archivo Handler |
|---|---|---|---|
| `order.created` | `handleOrderCreated` | Log/audit | `handlers/order-created.ts` |
| `order.updated` | `handleOrderCreated` | Log (same as created) | `handlers/order-created.ts` |
| `order.shipped` | `handleOrderShipped` | Actualiza order status, tracking | `handlers/order-shipped.ts` |
| `order.delivered` | `handleOrderDelivered` | Marca order delivered | `handlers/order-delivered.ts` |
| `order.cancelled` | `handleOrderCancelled` | Marca order cancelled | `handlers/order-cancelled.ts` |
| `order.failed` | `handleOrderFailed` | Marca order failed, triggers retry | `handlers/order-failed.ts` |
| `product.created` | `handleProductUpdated` | Sync producto a DB | `handlers/product-updated.ts` |
| `product.updated` | `handleProductUpdated` | Sync producto a DB | `handlers/product-updated.ts` |
| `product.publish_succeeded` | `handleProductUpdated` | Sync producto a DB | `handlers/product-updated.ts` |
| `product.deleted` | `handleProductDeleted` | Marca producto deleted | `handlers/product-deleted.ts` |
| `stock.updated` | `handleStockUpdated` | Actualiza variant availability | `handlers/stock-updated.ts` |

**Infraestructura:**
- `frontend/src/lib/pod/webhooks/webhook-router.ts` — Router generico (Map de eventType -> handler)
- `frontend/src/lib/pod/webhooks/index.ts` — Barrel export con `createWebhookRouter()`
- Dead Letter Queue: errores van a tabla `webhook_dead_letters`
- Audit log: cada evento raw se registra en `audit_log`

### 1.3 Telegram Webhook

| Endpoint | Metodo | Auth | Archivo |
|---|---|---|---|
| `/api/webhooks/telegram` | POST | `x-telegram-bot-api-secret-token` header vs `TELEGRAM_WEBHOOK_SECRET` | `frontend/src/app/api/webhooks/telegram/route.ts` |

**Funcionalidad:**
- Almacena mensajes en `telegram_messages`
- Verifica si user es admin via `user_messaging_links`
- **Comandos Admin**: `/status`, `/agents`, `/run <agent>`, `/pause <agent>`, `/orders`, `/revenue`, `/help`
- **Comandos Customer**: `/start`, `/help`, `/link`
- Los comandos admin llaman al PodClaw Bridge API (`PODCLAW_BRIDGE_URL`)
- Mensajes no-comando: placeholder "AI assistant will respond shortly"

### 1.4 WhatsApp Webhook

| Endpoint | Metodo | Auth | Archivo |
|---|---|---|---|
| `/api/webhooks/whatsapp` | GET | `hub.verify_token` vs `WHATSAPP_VERIFY_TOKEN` (verification challenge) | `frontend/src/app/api/webhooks/whatsapp/route.ts` |
| `/api/webhooks/whatsapp` | POST | `x-hub-signature-256` HMAC vs `WHATSAPP_APP_SECRET` | `frontend/src/app/api/webhooks/whatsapp/route.ts` |

**Funcionalidad:**
- Almacena mensajes en `whatsapp_messages`
- Comandos basicos: `/start`, `/help`, `/status`
- NO tiene verificacion de admin role (a diferencia de Telegram)
- Mensajes no-comando: placeholder "AI assistant will respond shortly"

### 1.5 Cache Invalidation Webhook

| Endpoint | Metodo | Auth | Archivo |
|---|---|---|---|
| `/api/webhooks/cache-invalidate` | POST | `x-api-key` header vs `CACHE_INVALIDATE_API_KEY` | `frontend/src/app/api/webhooks/cache-invalidate/route.ts` |

**Tipos soportados:**
- `product-sync` — Invalida cache de producto especifico
- `brand-update` — Invalida cache de marca
- `full` — Invalida todos los caches Redis

---

## 2. Cron Jobs (Frontend)

### Configuracion Vercel (`vercel.json`)

Solo **1 cron** configurado en Vercel:
```json
{ "path": "/api/cron/sync-printify", "schedule": "*/30 * * * *" }
```

**HALLAZGO CRITICO**: Los demas 10 cron jobs NO tienen schedule en `vercel.json`. Dependen de un scheduler externo o no estan activos.

### Tabla de Cron Jobs

| Cron Job | Archivo | Schedule Sugerido | Que Hace | Auth | Lock | Event-Driven Posible? |
|---|---|---|---|---|---|---|
| **sync-printify** | `cron/sync-printify/route.ts` | `*/30 * * * *` (unico en vercel.json) | Full reconciliacion Provider <-> Supabase: crea missing, update stale, mark orphans, fix margins, availability reconciliation, divergence check (10% sample) | CRON_SECRET | Si (acquireLock) | Parcialmente: product.updated webhook cubre updates, pero el full reconciliation sigue siendo util como safety net |
| **retry-printify-orders** | `cron/retry-printify-orders/route.ts` | Cada 5-10 min | Retry stuck paid orders (max 3 attempts, 30min window), auto-refund after 3 fails o 2h timeout, auto-refund requires_review > 24h | CRON_SECRET | No | Si: podria ser event-driven desde checkout.completed failure callback |
| **check-delivery-status** | `cron/check-delivery-status/route.ts` | Cada 6-12h | Poll shipped orders > 3 dias, query provider status, synthesize delivery events via webhook router | CRON_SECRET | Si (acquireLock) | NO: necesario porque Printful NO envia webhook de delivery |
| **abandoned-cart-recovery** | `cron/abandoned-cart-recovery/route.ts` | Cada 30-60 min | Busca carts abandonados >1h (1er email) y >24h (2do email), envia recovery emails via Resend | CRON_SECRET | No | Parcialmente: podria usar DB trigger on cart_items.updated_at para encolar |
| **cleanup** | `cron/cleanup/route.ts` | Diario | GDPR retention cleanup: conversations (configurable), audit_logs (730d), ab_events (180d), anonymous convs (7d), user_usage (90d), drip_queue sent (30d) | CRON_SECRET | No | No: batch cleanup inherentemente periodico |
| **cleanup-temp-products** | `cron/cleanup-temp-products/route.ts` | Diario | Elimina productos temporales Printify de personalizations orphanadas (>24h, no ordered) | CRON_SECRET | Si (acquireLock) | Si: podria ser event-driven desde order.completed o personalization.expired |
| **cleanup-personal** | `cron/cleanup-personal/route.ts` | Diario | Elimina designs con privacy_level=personal y expires_at < now(). Borra de Storage + DB | CRON_SECRET | No | Si: podria usar pg_cron o DB trigger on expires_at |
| **drip** | `cron/drip/route.ts` | Cada 15-30 min | Procesa drip_queue: envia pending emails donde send_at <= now via Resend. Verifica GDPR (confirmed subscribers). CAN-SPAM compliant (unsubscribe links) | CRON_SECRET | No | Parcialmente: la cola ya es event-driven (drip_queue), el cron solo procesa la cola |
| **zombie-reaper** | `cron/zombie-reaper/route.ts` | Cada 15 min | Detecta y corrige estados zombie: orders (pending>1h, paid>30m, exhausted>2h, submitted>7d, in_production>14d, shipped>30d), products (publishing>1h, pending_review>7d), agents (queued>30m), returns (pending>7d, approved>14d). Auto-refund y auto-confirm delivery | CRON_SECRET | No | No: inherentemente periodico — state timeout detection |
| **hard-delete-accounts** | `cron/hard-delete-accounts/route.ts` | Diario | GDPR right to erasure: hard-delete accounts con deletion_requested_at > 30 dias. Anonymiza orders, borra PII, deletes from auth | CRON_SECRET | No | Si: podria usar pg_cron con date comparison |
| **product-metrics** | `cron/product-metrics/route.ts` | Diario ~01:00 UTC | ETL: compute_daily_product_metrics(yesterday) + compute_portfolio_metrics(yesterday) via Supabase RPCs | CRON_SECRET | No | No: batch ETL inherentemente periodico |

---

## 3. PodClaw Scheduler (Backend Python)

**Archivo**: `podclaw/scheduler.py`
**Engine**: APScheduler AsyncIOScheduler (UTC timezone)

### Schedule de Agentes

| Agente | Schedule (Cron) | Descripcion | Modelo |
|---|---|---|---|
| researcher | `0 6 * * *` | Investigacion diaria de tendencias | haiku |
| designer | `0 7 * * *` | Genera designs basados en tendencias | sonnet |
| cataloger | `0 8,14,18 * * *` | Crea/actualiza productos (3x diario). Cycle tasks: 08=new products, 14=pricing, 18=peak prep | sonnet |
| marketing | `0 7,15 * * *` | Campanas social media (2x diario) | sonnet |
| newsletter | `0 9,17 * * *` | Email campaigns (2x diario) | sonnet |
| customer_manager | `0 12,22 * * *` | Soporte al cliente (2x diario) | sonnet |
| seo_manager | `0 16 * * 0` | SEO optimization (semanal, domingo) | haiku |
| finance | `0 23 * * *` | Reconciliacion financiera diaria | sonnet |
| qa_inspector | `0 10 * * *` | Verificacion calidad designs/products | haiku |
| brand_manager | `0 8 * * 1` | Auditoria semanal de marca (lunes) | sonnet |

### Jobs de Sistema (Scheduler)

| Job | Schedule | Que Hace |
|---|---|---|
| production_governor | `0 5:55 * * *` | Calcula limites diarios de produccion |
| memory_consolidation | `0 23:30 * * *` | Consolidacion de memoria + soul review (domingos) |
| session_reaper | Cada 1h (interval) | Marca sessions stuck >24h como error |
| event_cleanup | `0 2:00 * * *` | TTL-based cleanup de eventos antiguos |
| memory_decay | `0 4:00 * * *` | Decay + pruning de memorias de conversacion |
| memory_health_check | `0 4:10 * * *` | Evaluacion de salud cognitiva (diagnostico, no mutaciones) |
| memory_snapshot | `0 5:00 * * dom` | Telemetria semanal de memoria (read-only) |

### PodClaw Heartbeat

**Archivo**: `podclaw/heartbeat.py`
- **Intervalo**: 30 minutos (configurable)
- **Horas activas**: 05:00-23:00 UTC
- **Costo estimado**: ~$0.04/dia
- **Funcionalidad**:
  1. Checks mecanicos (zero LLM): heartbeat gap, Supabase connectivity, agent error rates (circuit breaker >=3 errors/24h)
  2. Lee HEARTBEAT.md + daily log + event queue
  3. Llama Haiku para decidir: HEARTBEAT_OK / ALERT / DISPATCH
  4. Dedup de alertas por fingerprint SHA256
  5. Dispatch de agentes con circuit breaker
  6. Notificacion admin via Telegram
  7. **Urgent drain loop**: cada 60s busca eventos wake_mode="now" y despacha inmediatamente

### PodClaw Event Queue

**Archivo**: `podclaw/event_queue.py`
- **Prioridad storage**: Redis LIST > Supabase `system_events` > in-memory deque
- **Redis keys**: `podclaw:events:queue` (main), `podclaw:events:dlq` (dead-letter, 7d TTL)
- **Max retries**: 3 antes de enviar a DLQ
- **Drain pattern**: LRANGE + DEL atomico, FIFO order

### PodClaw Event Store

**Archivo**: `podclaw/event_store.py`
- Immutable event sourcing a tabla `agent_events`
- Records: tool_call, decision, error, approval_request
- Session tracking en `agent_sessions`
- Audit log en `audit_log` (actor_type=ai_agent)

---

## 4. Database Triggers

### Triggers de Logica de Negocio

| Trigger | Tabla | Evento | Funcion | Que Hace |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` | Crea row en `public.users` con id, email, name, avatar. ON CONFLICT DO UPDATE. **CRITICO: auth sync** |
| `after_review_change` | `product_reviews` | AFTER INSERT/UPDATE/DELETE | `trigger_update_product_rating()` | Recalcula rating promedio y count en `products` |
| `trg_product_create_belief` | `products` | AFTER INSERT | `create_product_belief()` | Auto-crea row en `product_beliefs` con defaults Bayesian |
| `cron_runs_calculate_duration` | `cron_runs` | (insert) | Calcula duracion del cron run | Auto-calcula duration_ms |

### Triggers de updated_at (Housekeeping)

| Trigger | Tabla | Funcion |
|---|---|---|
| `update_users_updated_at` | `users` | `update_updated_at_column()` |
| `update_products_updated_at` | `products` | `update_updated_at_column()` |
| `update_orders_updated_at` | `orders` | `update_updated_at_column()` |
| `update_conversations_updated_at` | `conversations` | `update_updated_at_column()` |
| `update_documents_updated_at` | `documents` | `update_updated_at_column()` |
| `update_cart_items_updated_at` | `cart_items` | `update_updated_at_column()` |
| `return_requests_updated_at` | `return_requests` | `update_updated_at_column()` |
| `legal_pages_updated_at` | `legal_pages` | `update_updated_at_column()` |
| `update_error_logs_updated_at` | `error_logs` | `update_updated_at_column()` |
| `store_themes_updated_at` | `store_themes` | `update_updated_at_column()` |
| `abandoned_carts_updated_at` | `abandoned_carts` | `update_updated_at_column()` |
| `blog_posts_updated_at` | `blog_posts` | `update_updated_at_column()` |
| `legal_settings_updated_at` | `legal_settings` | `update_updated_at_column()` |
| `returns_updated_at` | `returns` | `update_updated_at_column()` |
| + 17 tablas mas | (via migration 20260307100002) | `update_updated_at_column()` |

**Nota**: Migration `20260307100002_updated_at_triggers.sql` aplica trigger a 17 tablas adicionales que no tenian el trigger.

### Supabase Edge Functions

**NINGUNA encontrada**. El directorio `supabase/functions/` no existe.

---

## 5. Mapa de Flujo de Eventos

### Flujo de Compra (Happy Path)

```
Customer checkout
  |
  v
Stripe checkout.session.completed
  |
  v
handleCheckoutCompleted
  |-- INSERT orders (status=paid)
  |-- INSERT order_items
  |-- INSERT notifications
  |-- INSERT audit_log
  |-- increment_coupon_usage (if coupon)
  |-- POD createOrder + submitForProduction
  |     |-- SUCCESS: UPDATE orders (status=submitted, external_order_id)
  |     |-- FAILURE: UPDATE orders (pod_error, pod_retry_count=1)
  |                    |-- notifyAdminOfProviderFailure
  |                    |-- sendOrderIssueEmail
  |-- handleCreditPackPurchase (if type=credit_pack)
  |-- sendOrderConfirmationEmail
  v
POD webhook: order.shipped
  |
  v
handleOrderShipped
  |-- UPDATE orders (status=shipped, tracking)
  v
Cron check-delivery-status (polls provider)
  |
  v
Synthetic order.delivered event
  |-- UPDATE orders (status=delivered, delivered_at)
```

### Flujo de Fallo de Pedido

```
checkout.session.completed (POD submission fails)
  |
  v
orders.pod_error set, pod_retry_count=1
  |
  v
Cron retry-printify-orders (cada 5-10 min)
  |-- retry_count < 3 AND within 30min window: re-submit
  |-- retry_count >= 3 OR > 2h: auto-refund via issueRefund
  |-- requires_review > 24h: auto-refund
  v
Zombie-reaper (cada 15 min)
  |-- paid exhausted (>2h, retries>=3): auto-refund
  |-- requires_review > 24h: auto-refund
  |-- shipped > 30d: auto-confirm delivery
```

### Flujo de Suscripcion

```
customer.subscription.created/updated
  |
  v
handleSubscriptionUpdate
  |-- UPDATE users (tier=premium, subscription_status=active)
  |-- add_credits RPC (10 bonus credits, idempotent)
  |-- triggerDripSequence('welcome')
  v
invoice.payment_failed (si falla renovacion)
  |
  v
handleInvoicePaymentFailed
  |-- UPDATE users (subscription_status=past_due)
  |-- Email: payment failed
  |-- Admin alert
  v
customer.subscription.deleted
  |-- UPDATE users (tier=free, subscription_status=cancelled)
```

### Flujo PodClaw (Inter-Agent Communication)

```
Scheduler (APScheduler cron jobs)
  |-- cron trigger fires
  v
PodClawAgent.enqueue_event(source="cron:<agent>")
  |
  v
SystemEventQueue (Redis LIST / Supabase / in-memory)
  |
  v
HeartbeatRunner._loop() (cada 30 min)
  |-- drain event queue
  |-- call Haiku LLM for decision
  |-- HEARTBEAT_OK: log
  |-- ALERT: notify admin via Telegram
  |-- DISPATCH: run agent via orchestrator
  v
HeartbeatRunner._urgent_drain_loop() (cada 60s)
  |-- peek for wake_mode="now" events
  |-- dispatch immediately
```

---

## 6. Hallazgos y Recomendaciones

### CRITICO

| # | Hallazgo | Impacto | Recomendacion |
|---|---|---|---|
| C1 | **Solo 1 de 11 cron jobs configurado en vercel.json** | Los otros 10 cron jobs NO se ejecutan automaticamente en Vercel. `retry-printify-orders`, `zombie-reaper`, `abandoned-cart-recovery`, `drip` — todos requieren ejecucion periodica | Agregar TODOS los cron jobs a `vercel.json` o configurar scheduler externo en Docker |
| C2 | **`payment_intent.succeeded` y `payment_intent.payment_failed` son log-only** | No hay accion real cuando un payment intent falla. La logica depende 100% de checkout.session.completed | Evaluar si payment_intent.payment_failed deberia notificar al usuario o registrar el intento fallido |
| C3 | **Overlap entre `retry-printify-orders` y `zombie-reaper`** | Ambos auto-refund orders en `requires_review` > 24h. Posible double-refund si ambos corren simultaneamente | Agregar idempotency check en ambos, o consolidar la logica de auto-refund en un solo cron |
| C4 | **WhatsApp webhook NO verifica admin role** para `/status` | A diferencia de Telegram, cualquier usuario puede ejecutar `/status` en WhatsApp | Implementar verificacion admin via `user_messaging_links` como en Telegram |

### ALTO

| # | Hallazgo | Recomendacion |
|---|---|---|
| H1 | **No hay webhook de Printful para delivery** — se compensa con polling cron | Documentar esta limitacion. Verificar si Printful ha agregado webhook de delivery desde implementacion |
| H2 | **Telegram/WhatsApp customer commands son placeholder** | `/browse`, `/search`, `/cart`, `/orders`, `/track` no estan implementados — solo responden con mensaje generico. Integrar con PodClaw customer_manager agent |
| H3 | **`cleanup` cron NO tiene lock** | Puede ejecutarse concurrentemente, causando delete races | Agregar `acquireLock` como en otros crons |
| H4 | **`abandoned-cart-recovery` NO tiene lock** | Puede enviar emails duplicados si se ejecuta concurrentemente | Agregar `acquireLock` |

### MEDIO

| # | Hallazgo | Recomendacion |
|---|---|---|
| M1 | **Cache invalidation webhook** usa API key simple | Considerar migrar a HMAC signature para mayor seguridad |
| M2 | **Drip cron procesa max 20 emails/run** | Con cola grande, puede quedarse atrasado. Considerar aumentar batch size o usar worker dedicado |
| M3 | **No hay Supabase Edge Functions** | El proyecto usa API routes de Next.js para todo. Para event-driven architecture, considerar Supabase Edge Functions para triggers en DB |

### Cron Jobs Migrables a Event-Driven

| Cron | Mecanismo Alternativo | Viabilidad |
|---|---|---|
| `retry-printify-orders` | Trigger en `orders` cuando status='paid' AND pod_error IS NOT NULL, con Supabase Edge Function o pg_cron job | Alta — el trigger point es claro |
| `cleanup-temp-products` | Event desde order.completed o personalization status change | Alta |
| `cleanup-personal` | `pg_cron` con DELETE WHERE expires_at < NOW() | Alta — trivial SQL |
| `drip` | Ya es semi-event-driven (cola). Solo falta procesador continuo o pg_cron | Media |
| `hard-delete-accounts` | `pg_cron` con DELETE WHERE deletion_requested_at < NOW() - INTERVAL '30 days' | Alta — trivial SQL |

### Webhooks Faltantes

| Webhook | Que Faltaria | Prioridad |
|---|---|---|
| Printful order.in_production | No se detecta cambio a "in production" — se infiere del polling | Baja (el cron lo cubre) |
| Stripe `charge.dispute.closed` | No se maneja cierre de disputa (won/lost) | Media |
| Stripe `customer.subscription.trial_will_end` | No se notifica fin de trial | Baja (no hay trials actualmente) |
| Stripe `payment_method.attached/detached` | No se trackea cambios en metodos de pago | Baja |
| Resend webhook (email bounce/complaint) | No se maneja bounces/complaints de Resend | Alta — requerido para mantener sender reputation |

---

## 7. Resumen Cuantitativo

| Categoria | Cantidad |
|---|---|
| **Webhook endpoints** | 5 (Stripe, POD/[provider], Telegram, WhatsApp, cache-invalidate) |
| **Eventos Stripe procesados** | 9 (7 con handler, 2 log-only) |
| **Eventos POD procesados** | 11 (via WebhookRouter) |
| **Cron jobs (Frontend)** | 11 (solo 1 en vercel.json) |
| **Agentes PodClaw (Scheduler)** | 10 agentes + 7 jobs de sistema |
| **DB triggers de negocio** | 4 (auth sync, review rating, product belief, cron duration) |
| **DB triggers updated_at** | ~30+ tablas |
| **Supabase Edge Functions** | 0 |
| **Dead Letter Queues** | 2 (POD webhook DLQ tabla, PodClaw Redis DLQ) |
