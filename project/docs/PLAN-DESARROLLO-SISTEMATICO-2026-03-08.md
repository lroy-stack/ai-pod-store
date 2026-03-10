# Plan de Desarrollo Sistemático — SKAPARA POD AI Store

**Fecha**: 2026-03-08
**Basado en**: Auditoría consolidada de 5 reportes (3,572 líneas), verificación contra codebase end-to-end
**Estado**: Pre-producción — NOT READY para launch

---

## 1. Resumen Ejecutivo

### Hallazgos Verificados

| Severidad | Reportados | Verificados | Ajustados | Denegados |
|---|---|---|---|---|
| CRITICAL | 8 | 8 | 1 → CRITICAL, 2 → HIGH, 2 → MEDIUM, 1 → LOW (unused), 2 → DEFERRED | 0 |
| HIGH | 13 | 13 | 8 confirmados, 1 → MEDIUM, 1 → LOW, 2 → DEFERRED, 1 denegado | 1 |
| MEDIUM | 13 | 13 | 11 confirmados, 1 parcialmente, 1 → DEFERRED | 0 |

**Tras verificación**: 1 CRITICAL, 8 HIGH, 11 MEDIUM, 5 LOW, 1 DENEGADO, 6 DEFERRED (multi-tenancy)

### Correcciones post-verificación MEDIUM
- **M4**: Techo real es **500 productos** (10 páginas × 50), NO 1000. El comentario en código es incorrecto.
- **M8**: Downgraded a LOW — Stripe valida el email internamente; el riesgo es solo UX (error de Stripe vs 400 limpio).
- **C8**: Confirmado como dead code — componente NO importado en ningún sitio. Severidad negligible.

### Fixes Ya Aplicados (sesión anterior)

Los siguientes hallazgos del plan previo ya están resueltos en el codebase:

- [x] Cart PATCH ownership guard — `cart/route.ts:458` tiene check `!userId && !sessionId`
- [x] Order detail SELECT explícito — `orders/[id]/route.ts:35` usa columnas explícitas (no `*`)
- [x] Order detail admin_notes stripping — `orders/[id]/route.ts:76-80` filtra para non-admin
- [x] Invoice SELECT explícito — `orders/[id]/invoice/route.ts:36` usa columnas explícitas
- [x] Subscription bonus idempotencia — `subscription-handlers.ts:67` verifica `stripe_payment_id` antes de add_credits
- [x] ChatArea wishlist 405 — Corregido endpoint a `/api/wishlist`
- [x] manifest.json → manifest.webmanifest — `layout.tsx:86`
- [x] Invoice oklch error — Renderizado en iframe aislado

---

## 2. Decisiones de Arquitectura Pendientes

Estas decisiones **bloquean** grupos de hallazgos y deben tomarse ANTES de implementar.

### Decisión 1: Multi-Tenancy — Abandonar o Implementar

**Estado actual**: `get_current_tenant_id()` SIEMPRE retorna NULL. Solo 7/80+ rutas filtran por `tenant_id`. El sistema opera de facto como single-tenant.

| Opción | Esfuerzo | Impacto |
|---|---|---|
| **A: Abandonar** (recomendado) | 1-2 días | Eliminar columnas `tenant_id`, simplificar RLS, eliminar código muerto |
| **B: Implementar** | 4-6 semanas | JWT tenant claims, 73+ rutas, admin scoping, testing |
| **C: DB-per-tenant** | 8-12 semanas | Máximo aislamiento, complejidad operacional alta |

**Bloquea**: C2, C3, C4, H11, H12, M13 (6 hallazgos)
**Recomendación**: Opción A — SKAPARA opera como tienda única. Complejidad multi-tenant no aporta valor ahora.

### Decisión 2: Consolidación del Sistema de Devoluciones

Existen dos tablas: `return_requests` (usada por API) y `returns` (usada por zombie-reaper, schema más rico).

| Opción | Esfuerzo |
|---|---|
| **A: Mantener `return_requests`** | S — actualizar zombie-reaper para consultar `return_requests` |
| **B: Migrar a `returns`** | M — migrar datos, actualizar API, drop `return_requests` |

**Bloquea**: H1
**Recomendación**: Opción A (más simple, API ya usa `return_requests`)

### Decisión 3: Columnas de Retry

TRES columnas de retry: `retry_count` (zombie-reaper), `pod_retry_count` (checkout-completed), y una tercera en migrations.

**Recomendación**: Unificar en `pod_retry_count` (ya es la más usada), migrar referencias de `retry_count`.

### Decisión 4: Estrategia RLS

76+ rutas usan service-role key (bypass RLS). Opciones:
- **Mantener service-role** (actual): Más simple, ownership check manual en código
- **User-scoped clients**: RLS como safety net, requiere corregir policies

**Recomendación**: Mantener service-role para V1 producción. Migrar a user-scoped en V2.

---

## 3. Fases de Implementación

### FASE 1: Bloqueadores de Seguridad [MUST FIX antes de producción]

**Estimación**: 1-2 días de trabajo
**Riesgo si no se corrige**: Datos corruptos, flujos rotos, pérdida de ingresos

#### 1.1 — [CRITICAL] C1: CHECK constraint de orders.status incompleto

**Problema**: La base de datos tiene un CHECK constraint en `orders.status` que no incluye `requires_review` ni `failed`. Cualquier intento de escribir estos estados falla silenciosamente en PostgreSQL.

**Archivo**: `supabase/migrations/` (nueva migración)

**Fix**:
```sql
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'pending', 'paid', 'submitted', 'in_production',
    'shipped', 'delivered', 'cancelled', 'refunded',
    'requires_review', 'failed', 'disputed'
  ));
```

**Verificación**: Intentar `UPDATE orders SET status = 'requires_review' WHERE id = (SELECT id FROM orders LIMIT 1)` y confirmar que no da error.

---

#### 1.2 — [HIGH] C5: Webhook `charge.refunded` no manejado

**Problema**: Reembolsos emitidos desde el dashboard de Stripe NUNCA actualizan el estado del pedido en Supabase. El pedido queda como `paid`/`submitted` indefinidamente.

**Archivo**: `frontend/src/app/api/webhooks/stripe/route.ts` + nuevo handler

**Fix**: Agregar handler para `charge.refunded`:
```typescript
case 'charge.refunded': {
  const charge = event.data.object as Stripe.Charge
  const paymentIntentId = charge.payment_intent as string

  // Find order by payment intent
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, total_cents')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single()

  if (order && !['refunded', 'cancelled'].includes(order.status)) {
    const isFullRefund = charge.amount_refunded >= (order.total_cents || 0)
    await supabase.from('orders').update({
      status: isFullRefund ? 'refunded' : order.status,
      refunded_at: new Date().toISOString(),
      refund_amount_cents: charge.amount_refunded,
      refund_reason: 'stripe_dashboard',
    }).eq('id', order.id)
  }
  break
}
```

**Verificación**: Crear un refund desde Stripe Dashboard y confirmar que el pedido se actualiza.

---

#### 1.3 — [HIGH] C7: Dispute handler usa status incorrecto

**Problema**: El handler de disputes establece `status = 'cancelled'` en vez de `'disputed'`. No se puede distinguir una cancelación voluntaria de un chargeback. Además, `'disputed'` no existe en el CHECK constraint (fix 1.1 lo agrega).

**Archivo**: `frontend/src/lib/webhooks/stripe/dispute-handlers.ts:47`

**Fix**:
```typescript
// Cambiar 'cancelled' a 'disputed'
status: 'disputed',
```

**Dependencia**: Requiere que 1.1 (CHECK constraint) esté aplicado primero.

---

#### 1.4 — [HIGH] H3: Zombie-reaper referencia columna inexistente

**Problema**: `zombie-reaper/route.ts:76` selecciona `total_price_cents` pero la columna real es `total_cents`. El auto-refund pasa `undefined` como monto.

**Archivo**: `frontend/src/app/api/cron/zombie-reaper/route.ts`

**Fix**: Cambiar `total_price_cents` a `total_cents` en el SELECT y en la referencia de refund.

**Verificación**: Ejecutar cron manualmente y verificar que los pedidos zombie se procesan correctamente.

---

### FASE 2: Integridad de Datos [Previene pérdida/corrupción]

**Estimación**: 3-4 días de trabajo
**Riesgo si no se corrige**: Datos inconsistentes, reintentos fallidos, pérdida de ingresos silenciosa

#### 2.1 — [HIGH] H1: Tablas de devoluciones duplicadas

**Problema**: `return_requests` (usada por API) y `returns` (usada por zombie-reaper) tienen schemas incompatibles. Devoluciones creadas por clientes nunca son monitoreadas por crons.

**Fix** (asumiendo Decisión 2 = Opción A):
- Actualizar zombie-reaper para consultar `return_requests` en vez de `returns`
- Agregar cron monitoring para `return_requests` pendientes >7 días
- Considerar DROP de tabla `returns` si no tiene datos de producción

---

#### 2.2 — [HIGH] H2: Columnas de retry triplicadas

**Problema**: `retry_count`, `pod_retry_count`, y una tercera columna divergen silenciosamente. Decisiones de retry/refund basadas en datos incorrectos.

**Fix** (asumiendo Decisión 3 = unificar en `pod_retry_count`):
```sql
-- Migración
UPDATE orders SET pod_retry_count = GREATEST(retry_count, pod_retry_count)
WHERE retry_count > pod_retry_count;
-- Actualizar zombie-reaper para usar pod_retry_count
-- Eventualmente DROP retry_count
```

---

#### 2.3 — [HIGH] H4: Retry cron no re-envía a Printful

**Problema**: `retry-printify-orders/route.ts` solo marca pedidos para review o auto-refund. NUNCA re-envía a Printful. Ingresos perdidos cuando Printful estaba temporalmente caído.

**Archivo**: `frontend/src/app/api/cron/retry-printify-orders/route.ts`

**Fix**: Agregar lógica de re-submission real usando el provider abstraction layer:
```typescript
import { submitOrder } from '@/lib/pod/submit-order'

// Para pedidos con < 3 retries y edad < 48h:
const result = await submitOrder(order)
if (result.success) {
  await supabase.from('orders').update({
    status: 'submitted',
    pod_retry_count: order.pod_retry_count + 1,
    external_order_id: result.externalOrderId,
  }).eq('id', order.id)
}
```

---

#### 2.4 — [HIGH] H5: costCents siempre null del mapper

**Problema**: `printful/mapper.ts:58` nunca asigna `costCents`. El margin auditor no puede calcular márgenes reales.

**Archivo**: `frontend/src/lib/pod/printful/mapper.ts`

**Fix**: Mapear el campo de costo de la respuesta de Printful al modelo normalizado:
```typescript
costCents: variant.retail_price
  ? Math.round(parseFloat(variant.retail_price) * 100)
  : null,
```

---

#### 2.5 — [HIGH] H6: `package_returned` mapeado a `cancelled`

**Problema**: Un paquete devuelto por el carrier (fallo de entrega) dispara cancelación + reembolso automático. Debería intentar re-envío o manejo separado.

**Archivo**: `frontend/src/lib/pod/printful/constants.ts:28`

**Fix**: Crear un nuevo mapping:
```typescript
'package_returned': 'requires_review', // NO auto-cancel — needs human review
```

**Dependencia**: Requiere Fase 1.1 (CHECK constraint con `requires_review`).

---

#### 2.6 — [MEDIUM] C6: Coupon `times_used` no idempotente

**Problema**: `times_used` se incrementa en cada delivery del webhook sin verificar si ya se contó para esta sesión. Retries de Stripe causan over-counting.

**Archivo**: `frontend/src/lib/webhooks/stripe/checkout-completed.ts:224-244`

**Fix**: UNIQUE constraint en `coupon_uses(coupon_id, order_id)` o check antes de incrementar:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_uses_unique
ON coupon_uses(coupon_id, order_id);
```

---

#### 2.7 — [MEDIUM] M1: Coupon usage no atómico

**Problema**: SELECT + UPDATE separados. Checkouts concurrentes con el mismo cupón pueden incrementar incorrectamente.

**Fix**: RPC o SQL directo con increment atómico:
```sql
UPDATE coupons SET times_used = times_used + 1
WHERE id = $1 AND (max_uses IS NULL OR times_used < max_uses)
RETURNING times_used;
```

---

#### 2.8 — [MEDIUM] H7: Sin Dead Letter Queue para webhooks

**Problema**: Si el handler de un webhook de Printful lanza error después de verificar firma, el evento se pierde para siempre. La ruta siempre retorna 200.

**Fix**: Crear tabla `webhook_dead_letters` y almacenar eventos fallidos:
```sql
CREATE TABLE webhook_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB NOT NULL,
  error TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  retried_at TIMESTAMPTZ
);
```

---

### FASE 3: UX y Operacional [Mejora experiencia de usuario]

**Estimación**: 2-3 días de trabajo
**Riesgo si no se corrige**: UX confusa, datos falsos mostrados, vulnerabilidades menores

#### 3.1 — [MEDIUM] H9: Sin límite de items en carrito

**Problema**: Un atacante puede agregar miles de productos distintos, causando queries costosas y posible overflow de metadata de Stripe (500 chars/key limit).

**Archivo**: `frontend/src/app/api/cart/route.ts` (POST handler)

**Fix**: Agregar check antes de insertar:
```typescript
const { count } = await supabase
  .from('cart_items')
  .select('id', { count: 'exact', head: true })
  .eq(userId ? 'user_id' : 'session_id', userId || sessionId)

if ((count || 0) >= 50) {
  return NextResponse.json(
    { error: 'Cart item limit reached (50)' },
    { status: 400 }
  )
}
```

---

#### 3.2 — [MEDIUM] M7: Tax rates US hardcodeados para tienda EU

**Problema**: `stripe.ts:126-136` usa tasas de impuesto de estados de EEUU (CA 7.25%, default 7%) para una tienda que vende en EUR en Europa.

**Archivo**: `frontend/src/lib/stripe.ts`

**Fix**: Reemplazar con VAT rates EU o delegar a Stripe Tax:
```typescript
// Opción 1: Delegar a Stripe Tax (recomendado)
automatic_tax: { enabled: true },

// Opción 2: VAT fallback por país
const euVatRates: Record<string, number> = {
  'DE': 0.19, 'ES': 0.21, 'FR': 0.20, 'IT': 0.22,
  'AT': 0.20, 'NL': 0.21, 'BE': 0.21, // ...
}
const rate = euVatRates[country] || 0.21 // 21% default EU
```

---

#### 3.3 — [LOW] M8: Email de guest no validado server-side

**Problema**: El email de guest solo se valida client-side. El servidor pasa el email directamente a Stripe sin validación. Stripe valida internamente, pero genera errores confusos en vez de un 400 limpio.

**Archivo**: `frontend/src/app/api/checkout/create-session/route.ts`

**Fix**:
```typescript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (guestEmail && !emailRegex.test(guestEmail)) {
  return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
}
```

**Nota**: Riesgo bajo — Stripe actúa como safety net. Fix es para UX, no seguridad.

---

#### 3.4 — [MEDIUM] M10: ISR cache no se invalida con webhooks de stock

**Problema**: PDP cacheado 1 hora via ISR. Cambios de stock via webhook no disparan revalidación. Usuarios ven "En Stock" para variantes no disponibles.

**Archivos**: `shop/[id]/page.tsx` (revalidate=3600), webhooks de stock

**Fix**: Trigger `revalidatePath`/`revalidateTag` desde el webhook handler de stock:
```typescript
// En stock-updated webhook handler:
import { revalidatePath } from 'next/cache'

revalidatePath(`/en/shop/${productId}`)
revalidatePath(`/es/shop/${productId}`)
revalidatePath(`/de/shop/${productId}`)
```

---

#### 3.5 — [MEDIUM] M11: QuickViewModal no verifica disponibilidad

**Problema**: QuickViewModal muestra todas las variantes como seleccionables. Solo muestra badge "inStock" a nivel producto, no por variante. CTA no bloquea variantes no disponibles.

**Archivo**: `frontend/src/components/products/QuickViewModal.tsx`

**Fix**: Pasar datos de disponibilidad por variante al selector y deshabilitar CTA cuando la variante seleccionada no esté disponible.

---

#### 3.6 — [MEDIUM] M5: Eventos webhook desconocidos → product.updated

**Problema**: `mapper.ts:286` — eventos desconocidos de Printful se mapean a `product.updated`, disparando re-syncs innecesarios de producto completo.

**Archivo**: `frontend/src/lib/pod/printful/mapper.ts:286`

**Fix**:
```typescript
const type: WebhookEventType = PRINTFUL_EVENT_MAP[rawType] || 'unknown'
// En el handler: if (type === 'unknown') { log warning + skip }
```

---

#### 3.7 — [LOW] M4: Sync cron con techo de 500 productos

**Problema**: `sync-printify/route.ts:91` limita a 10 páginas × 50 = 500 productos (el comentario en código dice "1000" incorrectamente). Catálogo actual ~32 productos, pero expansión planificada a 250.

**Archivo**: `frontend/src/app/api/cron/sync-printify/route.ts`

**Fix**: Aumentar a 50 páginas (2500 productos) o usar paginación dinámica hasta que no haya más resultados.

**Nota**: No urgente — catálogo actual muy por debajo del techo.

---

### FASE 4: Prioridad Baja [Se puede lanzar sin estos]

**Estimación**: 1 día de trabajo

#### 4.1 — [LOW] C8: DynamicPriceStock hardcodea inStock=true

**Estado**: Componente UNUSED en producción. Riesgo latente solo si se importa en futuro.
**Fix**: Eliminar componente o conectar a API real de inventario.

#### 4.2 — [LOW] H8: Rate limiter in-memory

**Estado**: No compartido entre instancias. PERO: SKAPARA corre en single-instance Docker, no serverless.
**Fix**: Ninguno necesario para V1. Migrar a Redis si se escala a múltiples instancias.

#### 4.3 — [LOW] M12: Cart GET — check parcial de variant availability

**Estado**: El cart YA filtra `is_available` (línea 174) para obtener variantes disponibles. Sin embargo, los items del carrito no se marcan como no disponibles individualmente si su variante específica desapareció.
**Fix**: Cross-check cada item del carrito contra la lista de variantes disponibles y agregar flag `unavailable` al response.

#### 4.4 — [LOW] M6: Sin almacenamiento de idempotency key para webhooks

**Fix**: Agregar tabla `processed_webhook_events(event_id, provider, processed_at)` con UNIQUE en event_id.

#### 4.5 — [LOW] M2: Agregar columnas de dispute a orders

**Fix**: `stripe_dispute_id`, `dispute_reason`, `dispute_amount_cents` en tabla orders.

#### 4.6 — [LOW] M9: Sin reserva de inventario entre validación y pago

**Estado**: Riesgo bajo con volumen actual. Stripe Checkout session dura 30min.
**Fix**: Evaluar variant reservation/lock para V2 cuando el volumen lo justifique.

---

## 4. Hallazgos Denegados

| ID | Razón |
|---|---|
| H13 | Seed routes (`/api/admin/seed-branded`, `seed-hats`) ya están deprecadas y no se usan en producción. No requieren fix. |

---

## 5. Deferred — Multi-Tenancy (Bloqueado por Decisión 1)

Estos hallazgos se resuelven automáticamente al tomar la Decisión 1.

| ID | Finding | Si se abandona MT | Si se implementa MT |
|---|---|---|---|
| C2 | `get_current_tenant_id()` retorna NULL | Eliminar función | Poblar JWT claims |
| C3 | 73/80+ rutas sin filtro tenant | Eliminar código tenant | Agregar filtro a 73 rutas |
| C4 | Admin routes globalmente scoped | No aplica | Implementar tenant-admin |
| H11 | Registration asigna tenant hardcodeado | Eliminar tenant_id de registro | Routing por dominio |
| H12 | 22/25 users son test accounts | Purgar en migración | Purgar + tenant cleanup |
| M13 | `viewer@podstore.local` es admin | Purgar con H12 | Fix role + purge |

---

## 6. Printify Legacy (Documentado, No Prioritario)

Según instrucción del usuario, la limpieza de referencias legacy de Printify **NO es prioridad** y debe documentarse correctamente antes de actuar. Los reportes `06-PRINTIFY-LEGACY-CODE.md` y `07-PRINTIFY-LEGACY-DOCS.md` contienen el inventario completo.

### Hallazgos clave de la auditoría Printify:

**Código** (`06-PRINTIFY-LEGACY-CODE.md`):
- 482 archivos con referencias Printify (~400 son docs/scripts históricos)
- `frontend/src/lib/pod/printify/` es dead code (nunca registrado como provider) — excepción: `canonicalAddressFromStripe` importado por checkout
- **PodClaw es 100% Printify** (~40 archivos, ~2000+ líneas) — NO se ha migrado a Printful
- DB tiene 12 columnas legacy, 5 índices, 2 constraints listos para DROP (migración `.sql.hold` existe)
- i18n (en/es/de) dice "Printify" al usuario en texto de fulfillment y política de privacidad — **riesgo legal**

**Documentación** (`07-PRINTIFY-LEGACY-DOCS.md`):
- ~2,405 menciones en 190 archivos markdown + ~11,705 en JSON (backups)
- **P0 CRITICAL**: `CLAUDE.md` (9 refs), `MEMORY.md` (16 refs), `printify-supabase-connections.md`, `printify-product-rules.md`
- **P1 HIGH**: 30 archivos de PodClaw skills + design skills con pipelines Printify
- 7 archivos safe-to-delete, 26 archivos de migración correctamente históricos

**Acción pendiente**: Cuando se priorice, los i18n strings (riesgo legal) deben corregirse primero, seguidos de CLAUDE.md/MEMORY.md (afectan cada sesión de agente).

---

## 7. Orden de Ejecución Recomendado

```
Semana 1 — Seguridad (Fase 1)
├── Día 1: Migración CHECK constraint (1.1) + dispute fix (1.3) + zombie-reaper fix (1.4)
├── Día 2: charge.refunded webhook (1.2) + Decisión multi-tenancy

Semana 1-2 — Integridad (Fase 2)
├── Día 3: Return tables (2.1) + retry columns (2.2) + coupon idempotencia (2.6, 2.7)
├── Día 4: Retry re-submission (2.3) + costCents mapper (2.4)
├── Día 5: package_returned mapping (2.5) + webhook DLQ (2.8)

Semana 2 — UX (Fase 3)
├── Día 6: Cart limit (3.1) + tax rates EU (3.2) + email validation (3.3)
├── Día 7: ISR revalidation (3.4) + QuickViewModal (3.5) + webhook event handling (3.6, 3.7)

Semana 2-3 — Low Priority (Fase 4)
├── Backlog: DynamicPriceStock, rate limiter, M12, M6, M2, M9

Cuando se decida — Multi-Tenancy (Sección 5)
├── Si abandono: 1 día de cleanup
├── Si implementación: 4-6 semanas adicionales
```

---

## 8. Verificación Post-Implementación

### Tests E2E Críticos (Playwright)

1. **Checkout completo**: Producto → Carrito → Stripe → Pedido creado → Status = `paid`
2. **Refund desde Dashboard**: Crear refund en Stripe → Verificar status = `refunded` en app
3. **Dispute webhook**: Simular dispute → Verificar status = `disputed` (no `cancelled`)
4. **Zombie-reaper**: Crear pedido antiguo → Ejecutar cron → Verificar auto-refund con monto correcto
5. **Cart limit**: Intentar agregar 51 items → Esperar error 400
6. **Retry cron**: Crear pedido fallido → Ejecutar retry → Verificar re-submission a Printful
7. **QuickViewModal**: Producto con variantes no disponibles → Verificar CTA deshabilitado
8. **Invoice PDF**: Descargar invoice → Verificar que no crashea (oklch fix)

### Queries de Validación DB

```sql
-- Verificar CHECK constraint actualizado
SELECT conname, consrc FROM pg_constraint
WHERE conrelid = 'orders'::regclass AND contype = 'c';

-- Verificar no hay datos de test en producción
SELECT COUNT(*) FROM users WHERE email LIKE '%test%' OR email LIKE '%example%';

-- Verificar columnas de retry unificadas
SELECT DISTINCT retry_count, pod_retry_count FROM orders WHERE retry_count != pod_retry_count;

-- Verificar webhook DLQ operativa
SELECT COUNT(*) FROM webhook_dead_letters WHERE created_at > now() - interval '7 days';
```

---

## 9. Archivos Afectados por Fase

### Fase 1 (7 archivos)
- `supabase/migrations/XXXXXXXX_fix_order_status_check.sql` (NUEVO)
- `frontend/src/app/api/webhooks/stripe/route.ts` (EDITAR)
- `frontend/src/lib/webhooks/stripe/charge-refunded.ts` (NUEVO)
- `frontend/src/lib/webhooks/stripe/dispute-handlers.ts` (EDITAR)
- `frontend/src/app/api/cron/zombie-reaper/route.ts` (EDITAR)

### Fase 2 (8 archivos)
- `frontend/src/app/api/cron/zombie-reaper/route.ts` (EDITAR — return_requests)
- `supabase/migrations/XXXXXXXX_unify_retry_columns.sql` (NUEVO)
- `frontend/src/app/api/cron/retry-printify-orders/route.ts` (EDITAR)
- `frontend/src/lib/pod/printful/mapper.ts` (EDITAR — costCents)
- `frontend/src/lib/pod/printful/constants.ts` (EDITAR — package_returned)
- `frontend/src/lib/webhooks/stripe/checkout-completed.ts` (EDITAR — coupon)
- `supabase/migrations/XXXXXXXX_webhook_dlq.sql` (NUEVO)
- `frontend/src/app/api/webhooks/pod/[provider]/route.ts` (EDITAR — DLQ)

### Fase 3 (7 archivos)
- `frontend/src/app/api/cart/route.ts` (EDITAR — limit)
- `frontend/src/lib/stripe.ts` (EDITAR — EU VAT)
- `frontend/src/app/api/checkout/create-session/route.ts` (EDITAR — email validation)
- `frontend/src/lib/pod/printful/mapper.ts` (EDITAR — unknown events)
- `frontend/src/components/products/QuickViewModal.tsx` (EDITAR — availability)
- `frontend/src/app/api/cron/sync-printify/route.ts` (EDITAR — ceiling)
- Webhook handler de stock (EDITAR — revalidatePath)

### Fase 4 (5 archivos)
- `frontend/src/components/products/DynamicPriceStock.tsx` (ELIMINAR o EDITAR)
- `frontend/src/app/api/cart/route.ts` (EDITAR — M12 variant check)
- `supabase/migrations/XXXXXXXX_processed_events.sql` (NUEVO)
- `supabase/migrations/XXXXXXXX_dispute_columns.sql` (NUEVO)
- `frontend/src/app/api/webhooks/pod/[provider]/route.ts` (EDITAR — idempotency)

**Total**: ~27 archivos (19 ediciones, 5 nuevas migraciones, 1 nuevo handler, 1 posible eliminación)

---

## 10. Métricas de Éxito

| Métrica | Antes | Después |
|---|---|---|
| CHECK constraint statuses | 8 | 11 (+ requires_review, failed, disputed) |
| Webhook event types handled | 8 | 9 (+ charge.refunded) |
| Zombie-reaper refund accuracy | 0% (undefined amount) | 100% (total_cents) |
| Retry cron re-submission | 0% (never retries) | >0% (actual Printful calls) |
| Coupon idempotency | No | Sí (UNIQUE constraint) |
| Cart item limit | ∞ | 50 |
| Tax rates | US (7% default) | EU VAT (21% default) |
| Webhook DLQ | No existe | Operativa |
| ISR invalidation on stock change | Manual (1h cache) | Automática (revalidatePath) |

---

*Documento generado por auditoría automatizada + verificación manual contra codebase.*
*Hallazgos originales: 5 reportes, 3,572 líneas de documentación.*
*Verificación: 34 hallazgos auditados individualmente contra código fuente.*
