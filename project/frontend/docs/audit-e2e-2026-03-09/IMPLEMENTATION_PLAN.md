# Auditoría E2E — Verificación contra Codebase y DB Real
**Fecha**: 2026-03-09
**Verificado por**: Opus — lectura directa de código + queries a DB producción

---

## Estado Real de la Base de Datos (producción)

```
orders:         21 total (8 delivered, 6 paid stuck, 6 cancelled, 1 shipped)
order_items:    0 items en los 6 orders "paid" (son inserts de test, no ventas reales)
product_variants: 913 total, 0 unavailable, 146 disabled
audit_log:      0 eventos stock_updated, 0 sync_completed
                Último evento webhook: 2026-02-22 (order lifecycle tests)
```

**Conclusión**: No hay ventas reales aún. Los 6 orders en `paid` son test/audit
(emails: test@example.com, audit-test@example.com, notif-test@example.com).
Los bugs son **latentes** — explotarán con la primera venta real.

---

## Hallazgos Verificados

### H3 — submitOrderToPOD lee columna inexistente | CONFIRMADO CRÍTICO

**Evidencia de código** (`src/lib/pod/submit-order-to-pod.ts`):
- Línea 25: `.select('id, customer_email, shipping_address_id, currency, locale')`
- Línea 44-48: `.from('shipping_addresses').eq('id', order.shipping_address_id)`

**Evidencia de DB**:
```sql
-- La columna shipping_address_id NO EXISTE:
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'orders' AND column_name = 'shipping_address_id'
);
-- Resultado: false

-- Lo que SÍ existe es shipping_address JSONB:
-- {"city":"San Francisco","name":"John Doe","line1":"123 Test Street",...}
```

**Cadena de fallo completa**:
1. `checkout-completed.ts:108` → guarda `shipping_address: shippingAddress` (JSONB inline)
2. Path inicial (líneas 247-391) funciona porque usa la variable en memoria `shippingAddress`
3. Si el path inicial falla → order queda `paid` sin `external_order_id`
4. `retry-printify-orders/route.ts:115` → llama `submitOrderToPOD(order.id)`
5. `submit-order-to-pod.ts:25` → pide `shipping_address_id` (columna que no existe → devuelve `null`)
6. Línea 47 → `.eq('id', null)` → 0 rows → "Shipping address not found"
7. Cron incrementa `retry_count` → tras 3 intentos → `requires_review` → 24h → auto-refund

**Detalle adicional**: El cron usa `retry_count` (línea 50/70/126) pero la tabla tiene AMBAS
columnas: `retry_count` (genérica, migración 20260223) y `pod_retry_count` (específica POD,
migración 20260302). `submit-order-to-pod.ts` escribe a `pod_last_attempt_at` y `pod_error`
pero el cron lee `retry_count`. Hay una desincronización de columnas.

**Otro detalle**: `checkout-completed.ts` NO importa ni usa `submitOrderToPOD`. Tiene ~140 líneas
de lógica inline duplicada (líneas 247-417). Si el initial path falla, el retry path es
completamente diferente y roto.

**Fix requerido**:
- `submit-order-to-pod.ts:25` → cambiar `shipping_address_id` por `shipping_address`
- Eliminar el query a `shipping_addresses` table (líneas 44-51)
- Parsear el JSONB directamente: `order.shipping_address` ya tiene {name, line1, line2, city, state, postal_code, country}
- Unificar `retry_count` vs `pod_retry_count` (el cron debería usar `pod_retry_count`)

---

### G4 — Printful mapper usa `synced` en vez de `availability_status` | CONFIRMADO

**Evidencia de código** (`src/lib/pod/printful/mapper.ts:60`):
```typescript
isAvailable: (v as Record<string, unknown>).synced === true,
```

**Evidencia de DB** (Supabase producción):
```sql
SELECT COUNT(*) FILTER (WHERE is_available = false) FROM product_variants;
-- Resultado: 0 de 913 variantes — NINGUNA marcada como sin stock
```

**Evidencia de Printful API** (verificado 2026-03-09):
```
Scan completo: 28 productos, 925 variantes
availability_status distribution: active=925 (100%)
synced values: {True} (100%)

Campos por variante (keys reales):
  id, external_id, sync_product_id, name, synced, variant_id,
  main_category_id, retail_price, sku, currency, product, files,
  options, is_ignored, size, color, availability_status
                                     ^^^^^^^^^^^^^^^^^^^
  El campo CORRECTO para stock es availability_status (no synced)
```

**Diagnóstico preciso**:
- `synced` (boolean) = "variante vinculada al catálogo Printful" → configuración, NO stock
- `availability_status` (string) = "active" | "temporarily_out_of_stock" | "discontinued" → STOCK REAL
- El mapper lee `synced` e ignora `availability_status`
- **Ahora mismo** ambos producen el mismo resultado (todo en stock), pero cuando Printful
  marque variantes como `temporarily_out_of_stock`, el mapper seguirá diciendo `isAvailable: true`
- 913 variantes en Supabase vs 925 en Printful (12 huérfanas — verificar en sync)

**Sobre las notificaciones del usuario**: Printful envía emails/notificaciones de stock
que pueden ser sobre el catálogo base (blueprint variants), no sobre sync variants
específicas. Las notificaciones de "out of stock" pueden referirse a variantes del catálogo
que afectarán cuando alguien ordene, no necesariamente reflejadas en `availability_status`
del sync product endpoint en tiempo real.

**Cadena del cron sync** (`sync-printify/route.ts:204-208`):
```typescript
providerAvailMap.set(v.externalId, v.isAvailable !== false)
// ↑ Lee v.isAvailable del mapper → basado en synced, no availability_status
```

**Fix requerido**:
- `mapper.ts:60` → leer `availability_status === 'active'` en vez de `synced === true`
- Esto es un fix de 1 línea que usa el campo correcto de la API de Printful
- El cron sync de reconciliación (líneas 204-258) entonces propagará el valor correcto
- El webhook `stock.updated` sigue funcionando independientemente (bypass del mapper)

---

### G1 — Webhooks de Printful nunca registrados | CONFIRMADO

**Evidencia de código**: `scripts/register-printful-webhooks.mjs` existe, funcional,
requiere `DOMAIN` en `.env.local`. Es un script manual one-shot.

**Evidencia de DB**:
```sql
SELECT * FROM audit_log WHERE actor_id LIKE '%webhook%' AND action = 'stock_updated';
-- Resultado: 0 rows
```
Cero eventos de stock recibidos en toda la historia de la app.

**Impacto**: Sin webhooks registrados, el handler `stock-updated.ts` (que SÍ funciona
correctamente) nunca recibe eventos. El fix de G4 es inútil sin G1.

---

### G2 — Cron sync sin scheduler en Docker | CONFIRMADO

**Evidencia**: `vercel.json` tiene `*/30 * * * *` pero el proyecto es self-hosted Docker.
`docker-compose.yml` no tiene scheduler. `CRON_SECRET` está como env var pero nada lo invoca.

**Evidencia de DB**:
```sql
SELECT * FROM audit_log WHERE action IN ('sync_completed','product_sync');
-- Resultado: 0 rows
```
El cron de sync nunca se ha ejecutado contra la DB de producción.

---

### C1 — Stripe metadata truncation | CONFIRMADO (latente)

**Evidencia de código** (`create-session/route.ts:391-400`):
```typescript
metadata: {
  locale,
  cart_items: JSON.stringify(cartItems.map((item: any) => ({
    product_id: item.product_id,       // UUID = 36 chars
    variant_id: item.variant_id,       // UUID = 36 chars
    quantity: item.quantity,
    personalization_id: item.personalization_id || null,
    composition_id: item.composition_id || null,
    production_urls: item._production_urls || null,  // ← URLs completas
  }))),
}
```

**Cálculo**: Stripe limita metadata values a 500 chars.
- 1 item estándar (sin custom design): ~130 chars JSON
- 4 items estándar: ~520 chars → **EXCEDE límite**
- 1 item con production_urls (custom design): ~300+ chars
- 2 items custom: ~600+ chars → **EXCEDE límite**

**Impacto**: Checkout con 4+ items estándar o 2+ custom designs → Stripe API error 400 →
usuario no puede pagar. Actualmente no hay ventas reales así que no ha ocurrido.

**Cadena downstream**: `checkout-completed.ts:31-32` parsea `session.metadata?.cart_items`.
Si metadata fue truncada, el JSON es inválido → `JSON.parse` lanza excepción → order
se crea sin items → POD submission se salta ("Missing shipping address or items").

---

### C4 — EU tax desactivado | CONFIRMADO (intencional)

**Evidencia** (`create-session/route.ts:358-361`):
```typescript
automatic_tax: {
  enabled: false, // Disabled for now, will enable when Stripe Tax is activated
},
```

No es un bug — es una decisión pendiente de configuración en Stripe Dashboard.
Requiere: registrar dirección fiscal en Stripe → activar Stripe Tax → luego cambiar a `true`.
**Pre-launch blocker** para compliance EU pero NO es un cambio de código aislado.

---

### Return policy inconsistencia | CONFIRMADO

**Evidencia directa** (messages JSON, todas las líneas verificadas):

| Namespace | Línea | EN | ES | DE |
|---|---|---|---|---|
| `Checkout.trustReturns` | 665 | "30-day returns" | "30 días" | "30 Tage" |
| `landing.trustReturns` | 1024 | "14-day returns" | "14 días" | "14 Tage" |

La landing page es la outlier. FAQ, checkout, y policies API dicen 30 días.
**Fix**: Cambiar línea 1024 en los 3 archivos de 14 → 30.

---

### PDP shipping info | CONFIRMADO

**Evidencia** (`ProductDetailClient.tsx:660-663`):
```typescript
<Truck className="h-4 w-4 shrink-0" />
<span>
  {locale === 'es' ? 'Envio gratuito +50 €' : locale === 'de' ? 'Gratis ab 50 €' : 'Free shipping over €50'}
</span>
```

- Strings hardcoded, no usan `useTranslations`
- Sin tiempos de entrega (Stripe shipping_options tiene 5-7 business days pero no se muestra)
- Sin política de devolución
- `TrustBar` existe pero solo se usa en landing y shop, no en PDP
- Sección `<details>` de specifications existe (línea 668-700) — se puede usar como patrón

---

## FALSOS POSITIVOS (descartados)

### C3 — Cancel page 404 | FALSO

**Verificación**: El archivo existe en `src/app/[locale]/(focused)/checkout/cancel/page.tsx`.
Server component de 60 líneas con icono, mensaje i18n, y botones de navegación.
`create-session/route.ts:274` lo referencia correctamente como `cancelUrl`.

### G5 — Cart no valida stock | FALSO

**Verificación**: Cart POST (`route.ts:296-297`) filtra `.eq('is_enabled', true).eq('is_available', true)`.
Cart GET marca `unavailable: p.status !== 'active'`. Checkout POST (`create-session:91-133`)
bloquea con HTTP 409 `ITEMS_UNAVAILABLE`. La validación es correcta y está en el lugar correcto.

---

## Hallazgo Adicional: Doble columna retry_count

**No estaba en el audit original.** Descubierto al verificar contra DB.

La tabla `orders` tiene DOS columnas de retry:
- `retry_count` (INTEGER DEFAULT 0) — creada en migración 20260223 para "refund retry attempts"
- `pod_retry_count` (INTEGER DEFAULT 0) — creada en migración 20260302 para "POD submission retries"

El cron `retry-printify-orders` usa `retry_count` (línea 50/70/126).
El `submit-order-to-pod.ts` escribe a `pod_error` y `pod_last_attempt_at` (pero no toca retry count).
El index `idx_orders_pod_retry` está en `pod_retry_count` — **el cron nunca beneficia de este index**.

**Fix**: El cron debería usar `pod_retry_count` (la columna diseñada para este propósito).

---

## Priorización Final — Orden de Implementación

### CRÍTICO — Bloquea primera venta real

| # | Hallazgo | Archivo | Cambio |
|---|----------|---------|--------|
| 1 | H3 | `src/lib/pod/submit-order-to-pod.ts` | Leer `shipping_address` JSONB en vez de `shipping_address_id` FK. Eliminar query a `shipping_addresses`. Usar `canonicalAddressFromStripe` (ya existe en `printify/mapper.ts:374`). |
| 2 | retry_count | `src/app/api/cron/retry-printify-orders/route.ts` | Cambiar `retry_count` → `pod_retry_count` en SELECT y UPDATEs |
| 3 | C1 | `src/app/api/checkout/create-session/route.ts` | Reducir metadata: solo `product_id`, `variant_id`, `quantity` (quitar `production_urls`). Almacenar `composition_id` + `personalization_id` en tabla aparte o en la order misma post-creation. |

### ALTO — Stock invisible al usuario

| # | Hallazgo | Archivo | Cambio |
|---|----------|---------|--------|
| 4 | G4 | `src/lib/pod/printful/mapper.ts:60` | Cambiar `synced === true` → `availability_status === 'active'` (1 línea) |
| 5 | G4-cron | `src/app/api/cron/sync-printify/route.ts:204-258` | Sin cambios — la reconciliación ya funciona correctamente, solo necesita que el mapper devuelva el valor correcto |
| 6 | G1 | Post-deploy | Ejecutar `register-printful-webhooks.mjs` cuando haya dominio público |
| 7 | G2 | `docker-compose.yml` o `start.sh` | Agregar scheduler para cron sync (sidecar container o host cron) |

### MEDIO — Compliance y UX

| # | Hallazgo | Archivo | Cambio |
|---|----------|---------|--------|
| 8 | Return policy | `messages/{en,es,de}.json:1024` | Cambiar "14" → "30" en `landing.trustReturns` |
| 9 | PDP shipping | `src/components/products/ProductDetailClient.tsx` | Reemplazar hardcoded con i18n keys. Agregar sección envío + devoluciones. |
| 10 | C4 | Stripe Dashboard + `create-session/route.ts:360` | Activar Stripe Tax en dashboard, luego `enabled: true` |

### NO TOCAR

| Archivo | Razón verificada |
|---------|-----------------|
| `checkout/cancel/page.tsx` | Existe y funciona (C3 falso) |
| `api/cart/route.ts` | Validación correcta en POST/PATCH/checkout (G5 falso) |
| `stock-updated.ts` | Handler correcto, bypasea mapper |
| `api/webhooks/pod/[provider]/route.ts` | Routing correcto |
| `checkout-completed.ts` initial path | Funciona con datos en memoria (no necesita fix inmediato, refactor futuro) |

---

## Tests E2E con Playwright

### Flujo 1: Compra completa (usuario registrado)
1. Login → Navegar shop → Añadir producto al carrito → Checkout
2. Verificar que variant `is_available=true` pasa validación
3. Completar pago con Stripe test card (`4242 4242 4242 4242`)
4. Verificar order creado en DB con `shipping_address` JSONB
5. Verificar `external_order_id` asignado (POD submission exitosa)
6. Verificar email de confirmación enviado

### Flujo 2: Stock agotado
1. Marcar una variante como `is_available=false` en DB
2. Intentar añadir al carrito → debe rechazar
3. Intentar checkout con item en carrito → HTTP 409 `ITEMS_UNAVAILABLE`
4. Verificar badge "Out of Stock" en PDP

### Flujo 3: Retry de order fallido
1. Crear order con `external_order_id=NULL`, `status=paid`
2. Ejecutar cron `retry-printify-orders`
3. Verificar que lee `shipping_address` JSONB (no `shipping_address_id`)
4. Verificar que incrementa `pod_retry_count` (no `retry_count`)

### Flujo 4: Metadata no se trunca
1. Añadir 6 productos estándar al carrito
2. Intentar checkout → debe completar sin error Stripe
3. Verificar que `cart_items` metadata ≤ 500 chars

### Flujo 5: Información de envío/devoluciones en PDP
1. Navegar a cualquier producto
2. Verificar sección de envío con tiempos estimados (5-7 días)
3. Verificar sección de devoluciones (30 días)
4. Verificar en los 3 idiomas (en, es, de)
