# PLAN DEFINITIVO: Migración Printify → Printful (SKAPARA)

## Contexto

SKAPARA es una tienda POD (Print on Demand) con 79 productos activos, 1,435 variantes, 5 providers (P26, P410, P86, P23, P90). El frontend es Next.js 16 con Supabase Cloud. Se migra de Printify a Printful para mejor fulfillment EU (Riga, Latvia).

**Investigación completada**: 20 documentos (444KB, 11,478 líneas) en `frontend/docs/printful-migration/`. 6 secciones de plan detallado (10,331 líneas) en `plan-sections/`. Schema real verificado contra DB live (77 tablas, 13 columnas Printify-specific en 6 tablas).

**Objetivo del plan**: Definir exactamente qué se construye en cada sesión. No se desarrolla — se define para proceder sesión por sesión con Claude.

---

## Resumen Ejecutivo: 3 Sesiones

| Sesión | Nombre | Horas | Archivos nuevos | Archivos modificados | Resultado |
|---|---|---|---|---|---|
| 1 | Provider Abstraction + Printful Adapter | ~11h | ~28 | ~16 | `src/lib/pod/` completo, Printify envuelto, Printful adapter funcional, todos los consumers migrados |
| 2 | Sync Engine + Webhooks + DB Migration + Catalog Migration | ~11h | ~12 | ~20 | Sync provider-agnostico, webhooks unificados, DB migrada, 79 productos en Printful |
| 3 | Tests + Monitoring + Phase 5 DROP + Cleanup | ~10h | ~8 | ~20 | Tests completos, health endpoint, alertas, DROP columnas legacy, cleanup código Printify |

**Total**: ~32 horas de trabajo asistido (3 sesiones × ~11h)

---

## Schema DB Real (verificado 2026-03-02 contra Supabase live)

### 13 Columnas Printify-specific que migran

| # | Tabla | Columna actual | Tipo | Columna nueva |
|---|---|---|---|---|
| 1 | `products` | `printify_id` | VARCHAR(255) UNIQUE | `provider_product_id` TEXT |
| 2 | `products` | `blueprint_id` | INTEGER | `product_template_id` TEXT |
| 3 | `products` | `print_provider_id` | INTEGER | `provider_facility_id` TEXT |
| 4 | `product_variants` | `printify_variant_id` | VARCHAR(255) | `external_variant_id` TEXT |
| 5 | `orders` | `printify_order_id` | VARCHAR(255) | `external_order_id` TEXT |
| 6 | `orders` | `printify_cost_cents` | INTEGER | `pod_cost_cents` INTEGER |
| 7 | `orders` | `printify_retry_count` | INTEGER | `pod_retry_count` INTEGER |
| 8 | `orders` | `printify_error` | TEXT | `pod_error` TEXT |
| 9 | `orders` | `printify_last_attempt_at` | TIMESTAMPTZ | `pod_last_attempt_at` TIMESTAMPTZ |
| 10 | `orders` | `printify_status` | VARCHAR(50) | `pod_status` VARCHAR(50) |
| 11 | `order_items` | `printify_line_item_id` | VARCHAR(255) | `external_line_item_id` TEXT |
| 12 | `designs` | `printify_upload_id` | VARCHAR(255) | `provider_upload_id` TEXT |
| 13 | `designs` | `printify_image_url` | TEXT | `provider_upload_url` TEXT |

**Columna adicional**: `personalizations.printify_temp_product_id` TEXT → `provider_temp_product_id` TEXT (tabla vacía actualmente)

**Nueva columna**: `products.pod_provider` VARCHAR(20) DEFAULT 'printify' — discriminador de provider

### Conteo real (DB live)

- 79 productos activos, 38 deleted (117 total)
- P26: 51, P410: 16, P86: 5, P23: 4, P90: 3
- 77 tablas, solo 6 tienen columnas Printify-specific

---

## SESIÓN 1: Provider Abstraction + Printful Adapter (~11h)

### Pre-requisito del usuario
- Crear cuenta Printful en printful.com
- Generar Private Token en developers.printful.com (scopes: orders, sync_products, file_library, webhooks)
- Proporcionar `PRINTFUL_API_TOKEN`, `PRINTFUL_STORE_ID`, fecha expiración del token

### Bloque 1A — Domain Models + Interfaces (3h)

**Crear** `src/lib/pod/` con la siguiente estructura:

```
src/lib/pod/
  models/
    product.ts          — CanonicalProduct, CanonicalVariant, CanonicalImage, CanonicalPrintArea
    order.ts            — CanonicalOrder, CanonicalLineItem, CanonicalAddress, CanonicalShipment
    catalog.ts          — Blueprint, BlueprintVariant, VariantPricing, CatalogFilters
    design.ts           — DesignUploadInput, UploadedDesign, MockupInput, MockupResult
    shipping.ts         — ShippingRateInput, ShippingRate
    index.ts            — barrel export
  interfaces/
    catalog-provider.ts — PODCatalogProvider (getBlueprints, getVariants, getVariantPricing)
    product-provider.ts — PODProductProvider (createProduct, getProduct, listProducts, updateProduct, deleteProduct, publishProduct)
    design-provider.ts  — PODDesignProvider (uploadDesign, getMockupStatus, generateMockup)
    order-provider.ts   — PODOrderProvider (createOrder, getOrder, submitForProduction, cancelOrder, getShippingRates)
    webhook-provider.ts — PODWebhookProvider (verifySignature, normalizeEvent)
    index.ts            — barrel export
  errors.ts             — PODProviderError, PODRateLimitError, PODNotFoundError, PODAuthError, PODValidationError
  registry.ts           — ProviderRegistry + getProvider() factory
  index.ts              — barrel re-export
```

**Referencia**: Sección 01 tiene TypeScript completo para todos los models e interfaces. Verificado que mapea 1:1 con los 18 métodos reales de `PrintifyClient`.

### Bloque 1B — PrintifyAdapter (shim wrapper) (2h)

**Crear** `src/lib/pod/printify/`:

```
src/lib/pod/printify/
  adapter.ts    — PrintifyAdapter implements all 5 interfaces, wraps existing PrintifyClient
  mapper.ts     — PrintifyMapper (toCanonicalProduct, toCanonicalOrder, fromCreateProductInput, etc.)
  index.ts      — export
```

**Clave**: El `PrintifyAdapter` importa el `PrintifyClient` existente de `src/lib/printify.ts` y lo envuelve. NO se modifica `printify.ts`. Los mappers traducen entre DTOs Printify y modelos canónicos.

**Referencia**: Sección 01 §9b tiene implementaciones completas de `PrintifyMapper` con parseo de variantes verificado contra el código real de `printify-sync.ts`.

### Bloque 1C — PrintfulClient + PrintfulAdapter (4h)

**Crear** `src/lib/pod/printful/`:

```
src/lib/pod/printful/
  client.ts            — PrintfulClient HTTP wrapper (rate limiter, cache, retry, token expiry warning)
  adapter.ts           — PrintfulAdapter implements all 5 interfaces
  mapper.ts            — PrintfulMapper (toCanonicalProduct, fromCreateOrderInput, parsePrintfulVariantName, etc.)
  webhook-verifier.ts  — URL-secret verification (no HMAC — Printful uses query param secret)
  constants.ts         — API base URL, rate limits, event maps
  index.ts             — export
```

**Diferencias clave vs Printify** (documentadas en Sección 02):
- No publish step (createProduct → activo inmediatamente)
- Order draft+confirm → usar `?confirm=true` en createOrder
- File upload por URL (no base64)
- Token expira → warning en constructor si < 30 días
- Response envelope `{ code, result }` → unwrap en cada request
- Mockup generation async (task → poll)
- EU availability check por variant (no por provider ID)

**Referencia**: Sección 02 tiene implementación completa del client y mapper con los 16 métodos mapeados.

### Bloque 1D — Consumer Migration (2h)

**Modificar** los 14+2 archivos que importan `@/lib/printify` o llaman a Printify API directamente:

| Archivo | Cambio |
|---|---|
| `src/lib/printify-sync.ts` | Import `getProvider()` en vez de `printify` singleton |
| `src/app/api/cron/sync-printify/route.ts` | `getProvider().listProducts()` |
| `src/app/api/cron/retry-printify-orders/route.ts` | `getProvider().createOrder()` |
| `src/app/api/webhooks/printify/route.ts` | Mantener — sigue activo durante dual-run |
| `src/app/api/webhooks/stripe/route.ts` | `getProvider().createOrder()` + `canonicalAddressFromStripe()` |
| `src/app/api/checkout/create-session/route.ts` | Imports canónicos |
| `src/app/api/designs/[id]/create-product/route.ts` | `getProvider().createProduct()` |
| `src/app/api/products/[id]/route.ts` | `getProvider().getProduct()` |
| `src/app/api/admin/fix-publishing/route.ts` | `getProvider().publishProduct()` |
| `src/app/api/admin/seed-branded/route.ts` | `getProvider().createProduct()` |
| `src/app/api/admin/seed-hats/route.ts` | `getProvider().createProduct()` |
| `src/app/api/admin/orders/route.ts` | Imports canónicos |
| `src/lib/mockup-generator.ts` | `getProvider().getProduct()` — **FIX bug**: usa `PRINTIFY_TOKEN` (env var incorrecta) |
| `src/app/api/health/route.ts` | `getProvider().listProducts()` — **FIX**: usa fetch() directo |

**Shim strategy**: `src/lib/printify.ts` se convierte en re-export stub durante transición.

### Verificación Sesión 1
1. `npx next build` — 0 errores
2. `grep -r "from '@/lib/printify'" src/` → solo el stub y archivos en transición
3. `POD_PROVIDER=printify` → toda la app funciona exactamente igual (zero behavior change)
4. `POD_PROVIDER=printful` → el adapter se instancia correctamente
5. Test manual: navegar a `/shop`, verificar que productos cargan con el adapter Printify envuelto

---

## SESIÓN 2: Sync Engine + Webhooks + DB + Catalog Migration (~11h)

### Bloque 2A — Database Migration (2h)

**Crear** migración SQL `supabase/migrations/20260303100000_phase3_add_provider_columns.sql`:

Operaciones:
1. `products`: ADD `pod_provider`, `provider_product_id`, `product_template_id`, `provider_facility_id` → backfill desde `printify_id`, `blueprint_id`, `print_provider_id`
2. `product_variants`: ADD `external_variant_id` → backfill desde `printify_variant_id`
3. `orders`: ADD `external_order_id`, `pod_cost_cents`, `pod_retry_count`, `pod_error`, `pod_last_attempt_at`, `pod_status` → backfill desde columnas `printify_*`
4. `order_items`: ADD `external_line_item_id` → backfill desde `printify_line_item_id`
5. `designs`: ADD `provider_upload_id`, `provider_upload_url` → backfill desde `printify_upload_id`, `printify_image_url`
6. `personalizations`: ADD `provider_temp_product_id` → backfill desde `printify_temp_product_id`
7. Indexes: UNIQUE on `provider_product_id`, INDEX on `pod_provider`, UNIQUE on `(product_id, external_variant_id)`

**Aplicar** con Supabase Dashboard SQL Editor.

**Verificar**: 7 queries de validación (backfill completeness).

### Bloque 2B — Sync Engine Refactor (3h)

**Crear** `src/lib/pod/sync/`:

```
src/lib/pod/sync/
  sync-engine.ts       — ProductSyncEngine class (fullSync, syncSingle, deleteProduct)
  category-inferrer.ts — inferCategorySlug() movido verbatim
  margin-auditor.ts    — calculateEngagementPrice() + 35% floor
  conflict-resolver.ts — shouldPreserveAdminEdits()
  index.ts
```

**Modificar** `printify-sync.ts` → thin wrapper que delega a `ProductSyncEngine`

**Crear** nuevos crons:
- `src/app/api/cron/sync-products/route.ts` (nuevo, Printful)
- `src/app/api/cron/check-delivery-status/route.ts` (nuevo — Printful no tiene `order_delivered` event)

### Bloque 2C — Webhook Unification (2h)

**Crear** `src/lib/pod/webhooks/`:

```
webhook-router.ts + handlers/ (order-shipped, order-cancelled, order-failed, product-updated, product-deleted, stock-updated)
```

**Crear** `src/app/api/webhooks/pod/[provider]/route.ts` — unified endpoint

**Mantener** webhook Printify activo durante dual-run.

### Bloque 2D — Catalog Migration Scripts + Ejecución (4h)

**Crear** 3 scripts en `frontend/scripts/`:
1. `migrate-01-audit-printful-catalog.mjs` — 33 blueprints → equivalentes Printful
2. `migrate-02-upload-designs.mjs` — ~115 archivos → Printful File Library
3. `migrate-03-create-sync-products.mjs` — 79 products → Printful sync products

**Orden**: P410 primero (16, low risk) → P26 (51, core) → P86+P23 (9, drinkware) → P90 (3, si hay equiv)

**Post-migración**: UPDATE GPSR `manufacturing_country` → "LV", `safety_information` → "HONSON VENTURES LIMITED" para 51 P26

### Verificación Sesión 2
1. Migration SQL: `SELECT count(*) FROM products WHERE provider_product_id IS NOT NULL` = 79
2. 79 sync products en Printful dashboard
3. `POD_PROVIDER=printful` + sync cron → productos se actualizan
4. Webhook Printful test → procesado correctamente
5. Flip: `UPDATE products SET pod_provider = 'printful'`
6. Shop carga desde Printful

---

## SESIÓN 3: Tests + Monitoring + Phase 5 DROP + Cleanup (~10h)

### Bloque 3A — Tests Unitarios Exhaustivos (3h)

**Crear** `src/__tests__/pod/`:

```
src/__tests__/pod/
  printify-mapper.test.ts    — toCanonicalProduct, parseVariantTitle (4 formatos), price USD→EUR
  printful-mapper.test.ts    — toCanonicalProduct, parsePrintfulVariantName, decimal→cents, EU availability
  sync-engine.test.ts        — inferCategorySlug, calculateEngagementPrice, margin floor, conflict resolver
  webhook-router.test.ts     — signature verification, event normalization, idempotency
  provider-contract.test.ts  — ambos adapters producen CanonicalProduct/CanonicalOrder válidos
```

**Tests clave**:
- Variant parsing: "Black / S", "S/M / White", "Black / White / One size", "Natural" (4 formatos reales de SKAPARA)
- Price conversion: USD→EUR con `0.92` factor vs Printful EUR nativo
- EU availability: `isEUProvider(providerId)` viejo vs `isEUAvailable(variant.availability_status)` nuevo
- Webhook idempotency: mismo evento 2 veces → 1 acción
- Contract: `PrintifyAdapter.getProduct()` y `PrintfulAdapter.getProduct()` retornan mismo shape

### Bloque 3B — Monitoring + Health Endpoint (2h)

**Crear** `src/app/api/health/pod/route.ts`:
- GET → verifica conexión a provider activo (1 llamada `listProducts(1)`)
- Verifica token Printful no expirado
- Verifica último sync exitoso < 2h
- Retorna `{ provider, status, lastSync, tokenExpiresIn, productCount }`

**Crear** `src/lib/pod/monitoring.ts`:
- Structured logging `[POD-Sync]` format para Vercel log drain
- Métricas en `audit_log`: sync_success, sync_error, webhook_received, order_submitted, margin_violation, variant_mismatch, delivery_checked
- Alert thresholds → Telegram via `admin/alert/route.ts` existente

**Modificar** cron `sync-products/route.ts`: añadir logging estructurado + alerta si error_count > 3

**Crear** SQL para weekly drift detection:
```sql
SELECT id, title, pod_provider, provider_product_id,
  CASE WHEN printify_id != provider_product_id THEN 'DRIFT' ELSE 'OK' END
FROM products WHERE status = 'active'
```

### Bloque 3C — Consumer Code Cleanup (2h)

**Actualizar** los 17 archivos de código que aún referencian columnas `printify_*`:

| Archivo | Cambio |
|---|---|
| `src/lib/printify-sync.ts` | Queries usan `provider_product_id` en vez de `printify_id` |
| `src/lib/product-detail-cache.ts` | `.select('provider_product_id')` |
| `src/lib/reliability/divergence-detector.ts` | Queries canónicas |
| `src/app/api/cron/sync-printify/route.ts` | Renombrar a `sync-products`, queries canónicas |
| `src/app/api/cron/retry-printify-orders/route.ts` | Renombrar a `retry-orders`, queries canónicas |
| `src/app/api/checkout/create-session/route.ts` | `external_order_id` |
| `src/app/api/designs/[id]/create-product/route.ts` | `provider_product_id` |
| `src/app/api/products/[id]/route.ts` | `provider_product_id` |
| `src/app/api/admin/orders/route.ts` | `external_order_id`, `pod_status` |
| `src/app/api/webhooks/stripe/route.ts` | `external_order_id` (7 write sites) |
| `src/app/api/webhooks/printify/route.ts` | Stub: return `{received: true}` sin procesar |

**Grep final**: Verificar 0 referencias a columnas `printify_*` en `src/` (excepto archivos deprecated con `@deprecated` tag).

### Bloque 3D — Phase 5 DROP Migration (1.5h)

**Pre-condiciones** (TODAS deben cumplirse):
```sql
-- Debe retornar 0 filas cada una:
SELECT count(*) FROM products WHERE pod_provider = 'printify' AND status = 'active';
SELECT count(*) FROM orders WHERE printify_order_id IS NOT NULL AND external_order_id IS NULL;
SELECT count(*) FROM orders WHERE status IN ('in_production', 'shipped') AND pod_provider IS NULL;
```

**Crear** migración `supabase/migrations/20260303500000_phase5_drop_printify_columns.sql`:

```sql
-- Guard: abort if any active Printify products remain
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE pod_provider = 'printify' AND status = 'active') THEN
    RAISE EXCEPTION 'Cannot drop: active Printify products exist';
  END IF;
END $$;

-- DROP products
ALTER TABLE products DROP COLUMN IF EXISTS printify_id;
ALTER TABLE products DROP COLUMN IF EXISTS blueprint_id;
ALTER TABLE products DROP COLUMN IF EXISTS print_provider_id;

-- DROP product_variants
ALTER TABLE product_variants DROP COLUMN IF EXISTS printify_variant_id;

-- DROP orders
ALTER TABLE orders DROP COLUMN IF EXISTS printify_order_id;
ALTER TABLE orders DROP COLUMN IF EXISTS printify_cost_cents;
ALTER TABLE orders DROP COLUMN IF EXISTS printify_retry_count;
ALTER TABLE orders DROP COLUMN IF EXISTS printify_error;
ALTER TABLE orders DROP COLUMN IF EXISTS printify_last_attempt_at;
ALTER TABLE orders DROP COLUMN IF EXISTS printify_status;

-- DROP order_items
ALTER TABLE order_items DROP COLUMN IF EXISTS printify_line_item_id;

-- DROP designs
ALTER TABLE designs DROP COLUMN IF EXISTS printify_upload_id;
ALTER TABLE designs DROP COLUMN IF EXISTS printify_image_url;

-- DROP personalizations
ALTER TABLE personalizations DROP COLUMN IF EXISTS printify_temp_product_id;
```

**NOTA**: Esta migración solo se ejecuta si las pre-condiciones pasan. Si no, se postpone.

### Bloque 3E — Validación Final Completa (1.5h)

1. `npx next build` — 0 errores
2. `grep -r "printify_id\|printify_order_id\|printify_variant_id" src/` → 0 resultados (excepto deprecated)
3. `grep -r "PRINTIFY_API_TOKEN\|PRINTIFY_SHOP_ID" src/` → solo en `src/lib/pod/printify/` (adapter legacy)
4. Health check: `GET /api/health/pod` → `{ provider: "printful", status: "ok" }`
5. Sync cron: trigger manual → productos sync OK
6. Webhook: test event desde Printful dashboard → procesado
7. Test order E2E: crear orden → aparece en Printful dashboard → tracking recibido
8. Rollback test: `POD_PROVIDER=printify` → app sigue funcionando (adapter Printify intacto)
9. Todos los tests pasan: `npx jest --passWithNoTests`
10. Phase 5 migration: ejecutar si pre-condiciones OK

---

## Env Vars Nuevas

| Variable | Sesión | Descripción |
|---|---|---|
| `PRINTFUL_API_TOKEN` | 1 | Private token |
| `PRINTFUL_STORE_ID` | 1 | Store ID (account-level tokens) |
| `PRINTFUL_TOKEN_EXPIRES_AT` | 1 | ISO date expiración |
| `PRINTFUL_WEBHOOK_SECRET` | 2 | Secret para webhook URL |
| `POD_PROVIDER` | 1 | `printify` → `printful` |

## Archivos de Referencia

| Archivo | Contenido |
|---|---|
| `plan-sections/01-provider-abstraction.md` | TypeScript completo: models, interfaces, mappers (3,379 líneas) |
| `plan-sections/02-printful-adapter.md` | PrintfulClient, mapper, 16 métodos (2,101 líneas) |
| `plan-sections/03-sync-webhooks-cron.md` | Sync engine, webhook mapping, crons (719 líneas) |
| `plan-sections/04-catalog-migration.md` | 33 blueprints mapeados, scripts, GPSR (680 líneas) |
| `plan-sections/05-design-studio-v2.md` | Fabric.js architecture, export, migration (1,560 líneas) |
| `plan-sections/06-database-testing.md` | SQL migrations, 17 code files, testing (1,892 líneas) |

## Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| P90 sin equivalente Printful (sneakers, clogs) | Bajo (3 productos, 3.8%) | Archivar |
| Token Printful expira | Bajo | Warning < 30 días |
| Mugs pierden variantes color | Medio (5 productos) | Aceptar 2 colores o buscar alternativa |
| Mockup API lenta (async) | Medio | Polling 120s + fallback local |

## Rollback

- **Per-product**: `UPDATE products SET pod_provider = 'printify' WHERE id = ?`
- **Global**: `POD_PROVIDER=printify` env var
- **DB**: Columnas `printify_*` se mantienen hasta validación completa
- **Phase 5 DROP**: Solo cuando 0 productos Printify AND 0 órdenes activas Printify
