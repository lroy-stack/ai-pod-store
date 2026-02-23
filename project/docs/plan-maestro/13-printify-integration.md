# Plan 13 — Printify Integration Hardening

**Prioridad**: P1 — ALTA
**Estimación**: 41-45h
**Dependencias**: Plan 01 (Seguridad, HMAC fix), Plan 03 (Database, indexes)
**Bloquea**: Producción estable de órdenes, confiabilidad de catálogo

---

## 1. Objetivo

Corregir los 22 hallazgos de la auditoría de integración Printify: eliminar race conditions, implementar retry automático de órdenes, refunds automáticos, cleanup de huérfanos, y protección de datos editados por admin. Elevar score de 6.5/10 a 8.5/10.

## 2. Estado Actual (Auditoría 2026-02-23)

| Área | Score | Evidencia |
|------|-------|-----------|
| Stock/Disponibilidad | 6/10 | Validación en checkout OK, pero ventana 2h sin sync, sin validación real-time |
| Ciclo de Productos | 5/10 | Funcional end-to-end, pero sin DEDUP, race conditions, admin edits sobrescritos |
| Checkout/Órdenes | 6/10 | Idempotency OK, HMAC OK, pero sin retry scheduler, sin refund auto |
| Gobernanza PodClaw | 7/10 | 8 capas de control, pero sin revisión humana, budget granular limitado |
| Reconciliación | 7/10 | Cron 2h + Finance diario + reconcile script, pero ventana amplia |

## 3. Gap Estructural

La integración fue construida feature-by-feature sin plan de resiliencia. Funciona en el "happy path" pero falla en edges: cancelaciones, fallos parciales, edits concurrentes, y discontinuación de productos. Las órdenes pagadas pueden quedar stuck indefinidamente sin retry automático.

## 4. Plan de Implementación

### Bloque A: Order Reliability (10h) — CRÍTICO

| # | Tarea | Esfuerzo |
|---|-------|----------|
| A1 | **Extender retry cron existente** (`/api/cron/retry-printify-orders`): actualmente solo reintenta órdenes CON `printify_order_id`. Agregar path para órdenes SIN ID → re-crear orden en Printify via `createOrder()` + `submitOrderForProduction()`. Agregar backoff exponencial | 3h |
| A2 | **Refund automático**: En `handleOrderCancelled`, llamar `stripe.refunds.create()` cuando Printify cancela. Actualizar `orders.status = 'refunded'` + notificar cliente | 2h |
| A3 | **Refund en `requires_review`**: Después de 24h sin resolución, auto-refund y notificar admin | 1.5h |
| A4 | **Email de entrega**: Agregar `sendOrderDeliveredEmail()` en `handleOrderDelivered` | 1h |
| A5 | **Múltiples remesas**: Iterar `shipments[]` completo, crear notificación por cada paquete | 1.5h |
| A6 | **Soporte `order:updated` + `order:failed`**: Handlers que actualizan `printify_status`. `order:failed` → auto-refund + notificar | 1.5h |
| A7 | **Soporte `charge.dispute.created` (Stripe)**: Handler para chargebacks → marcar orden, alertar admin, pausar fulfillment | 1.5h |

**Archivos**: `frontend/src/app/api/webhooks/printify/route.ts`, `frontend/src/app/api/webhooks/stripe/route.ts`, `frontend/src/app/api/cron/retry-printify-orders/route.ts` (existente, extender)

### Bloque B: Variant Sync Fix (6h) — CRÍTICO

| # | Tarea | Esfuerzo |
|---|-------|----------|
| B1 | **UPSERT variantes**: Reemplazar DELETE+INSERT con `ON CONFLICT (product_id, printify_variant_id) DO UPDATE` en `syncVariants()` | 2h |
| B2 | **Migración**: Agregar unique constraint `(product_id, printify_variant_id)` si no existe | 30min |
| B3 | **Flag `admin_edited_at`**: Agregar columna a `products`. Sync Hook respeta campos donde `admin_edited_at > last_synced_at` | 2h |
| B4 | **Soft delete**: Agregar `deleted_at`, `deleted_by` a products. `deleteProductCascade()` usa soft delete | 1.5h |

**Archivos**: `frontend/src/lib/printify-sync.ts`, `supabase/migrations/` (nueva), `frontend/src/app/api/webhooks/printify/route.ts`

### Bloque C: Printify Connector Resilience (6h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| C1 | **Backoff exponencial**: Implementar retry con backoff en `_get_client()` para 429/5xx. 3 intentos, wait 2s/4s/8s | 2h |
| C2 | **Circuit breaker**: Después de 5 fallos consecutivos a Printify API, abrir circuit por 60s. Log + alerta | 2h |
| C3 | **Detección 429**: Parsear `Retry-After` header, esperar antes de reintentar | 1h |
| C4 | **Timeout dinámico**: 30s para reads, 60s para writes, 120s para uploads | 1h |

**Archivos**: `podclaw/connectors/printify_mcp_connector.py`

### Bloque D: Cleanup y Consistencia (6h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| D1 | **Cleanup productos temp**: Cron diario que busca `personalizations WHERE printify_temp_product_id IS NOT NULL` sin orden asociada > 24h → delete en Printify | 2h |
| D2 | **Reducir cron sync a 30min**: Cambiar schedule de sync-printify de 2h a 30min | 30min |
| D3 | **Validación continua en carrito**: En la UI del carrito, re-validar `is_available` al abrir carrito y mostrar warning | 2h |
| D4 | **Audit log en eliminación**: Registrar en `audit_log` cada producto eliminado con actor, razón, timestamp | 1.5h |

**Archivos**: `frontend/src/app/api/cron/cleanup-temp-products/route.ts` (nuevo), `frontend/src/app/api/cron/sync-printify/route.ts`, `frontend/src/components/storefront/StorefrontSidebar.tsx`

### Bloque E: Gobernanza Mejorada (6h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| E1 | **DEDUP check**: Antes de `printify_create_product`, query Supabase por título similar (Levenshtein < 3 o trigram > 0.8) | 2h |
| E2 | **Admin approval queue**: Productos con score 6-7 → estado `pending_review`. Admin aprueba/rechaza desde panel | 2.5h |
| E3 | **Unpublish automático**: Si QA detecta problema post-publish (0 ventas + reporte), auto-unpublish | 1.5h |

**Archivos**: `podclaw/connectors/printify_mcp_connector.py`, `admin/src/app/products/page.tsx`, `podclaw/skills/qa/`

### Bloque F: Tests (4h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| F1 | **Test retry scheduler**: Mock Printify API failure → verify retry + eventual refund | 1h |
| F2 | **Test UPSERT variantes**: Concurrent sync → no data loss | 1h |
| F3 | **Test refund cancelación**: Mock Printify cancel webhook → verify Stripe refund created | 1h |
| F4 | **Test cleanup temp products**: Verify orphans deleted after 24h | 1h |

**Archivos**: `frontend/tests/integration/printify/` (nuevo directorio)

## 5. Orden de Ejecución

```
Bloque B (Variant Sync Fix) ── primero (elimina race conditions)
        ↓
Bloque A (Order Reliability) ──┐
Bloque C (Connector Resilience)┤── en paralelo
Bloque D (Cleanup)  ───────────┘
        ↓
Bloque E (Gobernanza) ── necesita B completado
        ↓
Bloque F (Tests) ── último
```

## 6. Validaciones Técnicas

| # | Validación | Criterio |
|---|-----------|----------|
| V1 | Retry scheduler | Orden con `printify_error` → reintentada en <30min → success o refund |
| V2 | Refund automático | Printify cancela → Stripe refund creado en <5min |
| V3 | UPSERT variantes | 2 syncs concurrentes → 0 variantes perdidas |
| V4 | Admin edit preservado | Admin edita título → Cataloger sync → título preservado |
| V5 | Soft delete | Producto eliminado → `deleted_at` set, recoverable |
| V6 | Backoff funcional | Printify 429 → retry after backoff → eventual success |
| V7 | Temp cleanup | Producto temp >24h sin orden → eliminado de Printify |
| V8 | DEDUP | Título duplicado → bloqueado antes de crear en Printify |

## 7. Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Órdenes stuck >1h | Sin tracking | 0 (retry cada 30min) |
| Refunds en cancelación | Manual | Automático <5min |
| Race conditions sync | Posible | Eliminado (UPSERT) |
| Admin edits sobrescritos | Siempre | Nunca (flag) |
| Productos temp huérfanos | Acumulándose | Cleanup diario |
| Printify API failures recuperados | 0% | >90% (backoff) |
| Score integración | 6.5/10 | 8.5/10 |

## 8. Estimación Total

| Bloque | Horas |
|--------|-------|
| A — Order Reliability | 13h |
| B — Variant Sync Fix | 6h |
| C — Connector Resilience | 6h |
| D — Cleanup y Consistencia | 6h |
| E — Gobernanza Mejorada | 6h |
| F — Tests | 4h |
| **Total** | **41h** |

**Con 2 agentes paralelos (A+C+D)**: ~24h elapsed

---

*Plan derivado de auditoría 12-printify-integration.md. 2026-02-23.*
