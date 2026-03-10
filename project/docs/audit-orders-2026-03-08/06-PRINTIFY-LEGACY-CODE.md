# 06 - Printify Legacy Code Audit

**Date**: 2026-03-08
**Scope**: All code, configuration, infrastructure, and database references to "printify" (case-insensitive)
**Project Root**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/`

---

## Executive Summary

The project migrated from Printify to Printful as its POD provider. A provider abstraction layer (`frontend/src/lib/pod/`) was built, and the main entry point (`index.ts`) now exclusively initializes Printful. However, **massive Printify residue remains across the codebase**:

| Area | Files with References | Status |
|---|---|---|
| Frontend API Routes | 12 files | Active logic + legacy route names |
| Frontend Library Code (`src/lib/`) | 30+ files | Full Printify provider still present |
| PodClaw (Backend Agents) | 40+ files | Entirely Printify-based, no Printful migration |
| Database Columns | 12 columns across 5 tables | Legacy, data backfilled to pod_* columns |
| Database Indexes/Constraints | 5 indexes, 2 constraints | Legacy, need DROP |
| Migrations | 15+ migration files | Historical, safe |
| Environment Variables | 7 files | PRINTIFY_* vars still required by Docker/CI |
| i18n Strings | 3 files (en/es/de) | User-facing "Printify" text |
| Test Files | 3 files | Testing Printify-specific flows |
| Config/Infrastructure | 8 files | docker-compose, CI, setup wizard |
| Scripts | 90+ migration/creation scripts | Historical, most prefixed with `_` |

**Risk Assessment**: MEDIUM-HIGH. The frontend provider abstraction cleanly routes to Printful, but:
1. PodClaw backend is **100% Printify** -- agents will fail if invoked against Printful
2. Route names like `/api/cron/sync-printify` are cosmetic but confusing
3. 12 legacy database columns add schema bloat and confusion
4. Docker Compose still passes `PRINTIFY_*` env vars to services
5. i18n strings expose "Printify" to end users in privacy/legal pages

---

## 1. API Routes

### 1.1 Active Routes with Printify References

| File | Line(s) | Type | Status | Details |
|---|---|---|---|---|
| `frontend/src/app/api/cron/sync-printify/route.ts` | 4, 33 | Route NAME | **Active** | Route path is `/api/cron/sync-printify` but logic is provider-agnostic (uses `getProvider()`) |
| `frontend/src/app/api/cron/retry-printify-orders/route.ts` | 4 | Route NAME | **Active** | Route path is `/api/cron/retry-printify-orders` but logic uses generic `external_order_id`, no Printify API calls |
| `frontend/src/app/api/cron/cleanup-temp-products/route.ts` | 2, 5, 67 | COMMENT | **Active** | Comments say "Printify" but logic uses provider abstraction |
| `frontend/src/app/api/cron/zombie-reaper/route.ts` | 68-69, 90 | COMMENT + STRING | **Active** | String literals: `'retry_printify_submission'`, `'Auto-refund: Printify submission failed...'` |
| `frontend/src/app/api/webhooks/pod/[provider]/route.ts` | 5, 11, 28, 33, 73 | LOGIC | **Active** | `KNOWN_PROVIDERS` includes `'printify'`, signature header map has `printify: 'x-printify-hmac-sha256'` |
| `frontend/src/app/api/health/route.ts` | 39, 138, 167 | COMMENT + QUERY | **Active** | Comment says "Printify", queries `cron_name = 'sync-printify'` |
| `frontend/src/app/api/checkout/create-session/route.ts` | 49 | COMMENT | **Active** | Comment: "required for Printify fulfillment" |
| `frontend/src/app/api/designs/[id]/create-product/route.ts` | 199, 223, 231, 249, 261 | VARIABLE NAME | **Active** | Variable named `printifyProduct` but logic uses `provider.createProduct()` |
| `frontend/src/app/api/admin/fix-publishing/route.ts` | 7, 21, 33, 39, 49, 66 | COMMENT + VARIABLE | **Active** | Comments say "Printify", variable `allPrintifyProducts` and `report.printifyTotal` |
| `frontend/src/app/api/proxy-image/route.ts` | 18 | LOGIC | **Active** | Allowlist includes `'files.cdn.printify.com'` for image proxying |
| `frontend/src/app/api/admin/seed-branded/route.ts` | 1 | COMMENT | **Deprecated** | Single comment: "DEPRECATED: Printify seed data route removed" |
| `frontend/src/app/api/admin/seed-hats/route.ts` | 1 | COMMENT | **Deprecated** | Single comment: "DEPRECATED: Printify seed data route removed" |

### 1.2 Risk Assessment for Routes

- **sync-printify route**: Logic is fully provider-agnostic. Only the URL path and `cronName` string reference Printify. Renaming the route path would require updating cron job configurations (Vercel cron, health check queries).
- **retry-printify-orders route**: Same -- path only. Logic uses `external_order_id`.
- **webhook route**: Actively handles `'printify'` as a valid provider in `KNOWN_PROVIDERS`. This is needed if any Printify webhooks could still fire for legacy orders.
- **proxy-image**: `files.cdn.printify.com` in allowlist. Safe to keep temporarily for cached/legacy product images.

---

## 2. Library Code (`frontend/src/lib/`)

### 2.1 Full Printify Provider Implementation (`frontend/src/lib/pod/printify/`)

This directory contains a **complete, functional Printify provider** that is NO LONGER initialized by `index.ts`:

| File | Lines | Purpose | Key Exports |
|---|---|---|---|
| `client.ts` | ~270 | Raw Printify API client | `PrintifyClient` class |
| `index.ts` | ~200 | PODProvider implementation | `PrintifyProvider` class (implements `PODProvider`) |
| `mapper.ts` | ~470 | Anti-corruption layer (Printify raw types to canonical) | `mapProduct()`, `mapOrder()`, `canonicalAddressFromStripe()` |
| `constants.ts` | ~20 | API URL, page size, EU providers, webhook events | `PRINTIFY_BASE_URL`, `PRINTIFY_MAX_PAGE_SIZE`, etc. |
| `webhook-verifier.ts` | ~20 | HMAC-SHA256 webhook verification | `verifyPrintifyWebhook()` |
| `compat.ts` | ~130 | Backward-compatible shim for old `@/lib/printify` imports | `printify` proxy object, `buildPrintifyAddress()` |

**Status**: Dead code -- not imported by `index.ts` provider initialization. However:
- `mapper.ts` function `canonicalAddressFromStripe` is **actively imported** by `frontend/src/lib/webhooks/stripe/checkout-completed.ts:11`
- `compat.ts` provides backward compatibility for any code still importing from the old path

### 2.2 Other Library Files with Printify References

| File | Line(s) | Type | Details |
|---|---|---|---|
| `webhooks/stripe/checkout-completed.ts` | 11, 332-397 | IMPORT + VARIABLE | Imports `canonicalAddressFromStripe` from printify mapper; variables named `printifyOrder`, `printifyError` |
| `mockup-generator.ts` | 163-171 | FUNCTION NAME | `generatePrintifyMockup()` function, uses provider abstraction internally |
| `print-areas.ts` | 121, 124, 165 | COMMENT | Comments reference "Printify product photos" and "production-quality images for Printify" |
| `product-detail-cache.ts` | 175 | KEY NAME | Object key `printifyId: product.provider_product_id` |
| `composition-renderer.ts` | 221 | COMMENT | "for Printify fulfillment" |
| `branded-mockup-generator.ts` | 2, 21, 94, 157 | COMMENT | "Printify mockups", "Printify CDN" |
| `store-config.ts` | 59 | COMMENT | "EU-approved Printify providers" |
| `reliability/webhook-processor.ts` | 22 | COMMENT | JSDoc mentions `'printify'` as provider example |
| `reliability/divergence-detector.ts` | 14, 21 | COMMENT + LOGIC | Parses `blueprintRef` like `"printify:6:26"` |
| `pod/types.ts` | 45, 47, 55, 83, 124-128, 135 | COMMENT | JSDoc comments reference Printify throughout type definitions |
| `pod/models/product.ts` | 7, 18 | COMMENT | JSDoc: "Printify product ID", "printify:{blueprintId}:{providerId}" |
| `pod/models/design.ts` | 8 | COMMENT | "Printify supports this" |
| `pod/sync/sync-product.ts` | 28 | COMMENT | Example: `"printify:6:26"` |
| `pod/sync/types.ts` | 25 | COMMENT | "Write to old printify_* columns" |
| `pod/sync/category-inferrer.ts` | 3 | COMMENT | "Copied from printify-sync.ts" |
| `pod/sync/conflict-resolver.ts` | 3 | COMMENT | "Extracted from printify-sync.ts" |
| `pod/sync/margin-auditor.ts` | 3 | COMMENT | "Copied from printify-sync.ts" |
| `pod/webhooks/webhook-router.ts` | 5 | COMMENT | "Printify, Printful, or a future provider" |
| `pod/webhooks/handlers/order-shipped.ts` | 6, 22, 26 | COMMENT | "Logic extracted from webhooks/printify/route.ts" |
| `pod/webhooks/handlers/order-failed.ts` | 5 | COMMENT | "Logic extracted from webhooks/printify/route.ts" |
| `pod/webhooks/handlers/order-cancelled.ts` | 5 | COMMENT | "Logic extracted from webhooks/printify/route.ts" |
| `pod/webhooks/handlers/order-delivered.ts` | 5 | COMMENT | "Logic extracted from webhooks/printify/route.ts" |
| `pod/webhooks/handlers/stock-updated.ts` | 6 | COMMENT | "Printify does not currently" send this |
| `pod/printful/constants.ts` | 41 | COMMENT | "Printify position names to Printful placement names" |
| `pod/printful/client.ts` | 4 | COMMENT | "Key differences from Printify" |
| `pod/printful/index.ts` | 4 | COMMENT | "Key differences from PrintifyProvider" |

### 2.3 Provider Abstraction Assessment

The provider abstraction layer is **well-architected**:

- `frontend/src/lib/pod/index.ts` -- Main entry point. Only initializes Printful. Does NOT import or register PrintifyProvider.
- `frontend/src/lib/pod/provider-registry.ts` -- Generic registry. No Printify references.
- `frontend/src/lib/pod/types.ts` -- Provider-agnostic interfaces (with Printify comments).
- All sync cron routes use `getProvider()` which resolves to Printful.

**One active dependency on Printify code**: `checkout-completed.ts` imports `canonicalAddressFromStripe` from the Printify mapper. This function is actually provider-agnostic (converts Stripe address format) and should be moved to a shared location.

---

## 3. Environment Variables & Configuration

### 3.1 Environment Files

| File | Lines | Variables |
|---|---|---|
| `.env.example` | 41-45, 114 | `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `PRINTIFY_WEBHOOK_SECRET` |
| `frontend/.env.local.example` | 37-40 | `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `PRINTIFY_WEBHOOK_SECRET` |
| `config/.env.required` | 23-25 | `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID` |
| `podclaw/.env.example` | 11-13 | `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID` |

### 3.2 Docker Compose

| File | Lines | Details |
|---|---|---|
| `docker-compose.yml` | 74 | `PRINTIFY_WEBHOOK_SECRET` passed to frontend service |
| `docker-compose.yml` | 149-151 | `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `PRINTIFY_WEBHOOK_SECRET` passed to podclaw service |

### 3.3 start.sh

| File | Line | Details |
|---|---|---|
| `start.sh` | 152 | Validates `PRINTIFY_API_TOKEN` as required env var |

### 3.4 CI/CD

| File | Lines | Details |
|---|---|---|
| `.github/workflows/ci.yml` | 120, 202-204, 261-263, 282 | Mock `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `PRINTIFY_WEBHOOK_SECRET` in test environments |

### 3.5 Next.js Config

| File | Lines | Details |
|---|---|---|
| `frontend/next.config.ts` | 76, 80 | Image domains: `images.printify.com`, `images-api.printify.com` in remotePatterns allowlist |

### 3.6 Setup Wizard

| File | Lines | Details |
|---|---|---|
| `setup/setup.mjs` | 136, 149-151, 564-585, 796-801, 1030-1031, 1239-1275 | Full Printify section in setup wizard UI (form fields, validation, summary) |

---

## 4. Database Schema

### 4.1 Legacy Printify Columns (Still Present)

| Table | Column | Data Type | Current Data |
|---|---|---|---|
| `products` | `printify_id` | varchar(255) | 0 rows populated (all migrated to `provider_product_id`) |
| `product_variants` | `printify_variant_id` | varchar(255) | 0 rows populated (all migrated to `external_variant_id`) |
| `orders` | `printify_order_id` | varchar(255) | 6 rows (legacy test orders, also in `external_order_id`) |
| `orders` | `printify_cost_cents` | integer | Backfilled to `pod_cost_cents` |
| `orders` | `printify_retry_count` | integer | Backfilled to `pod_retry_count` |
| `orders` | `printify_error` | text | Backfilled to `pod_error` |
| `orders` | `printify_last_attempt_at` | timestamptz | Backfilled to `pod_last_attempt_at` |
| `orders` | `printify_status` | varchar(50) | Legacy |
| `order_items` | `printify_line_item_id` | varchar(255) | Backfilled to `external_line_item_id` |
| `designs` | `printify_upload_id` | varchar(255) | 2 rows (also in `provider_upload_id`) |
| `designs` | `printify_image_url` | text | 2 rows (also in `pod_upload_url`) |
| `personalizations` | `printify_temp_product_id` | text | Backfilled to `provider_temp_product_id` |

### 4.2 Legacy Indexes

| Index Name | Table | Status |
|---|---|---|
| `products_printify_id_key` | products | UNIQUE constraint -- legacy |
| `idx_products_printify_id` | products | B-tree index -- legacy |
| `idx_orders_printify_retry` | orders | Partial index on retry columns -- legacy |
| `idx_orders_printify_status` | orders | Index on printify_status -- legacy |
| `product_variants_product_printify_unique` | product_variants | UNIQUE constraint -- legacy |

### 4.3 Legacy Constraints

| Constraint Name | Table |
|---|---|
| `products_printify_id_key` | products |
| `product_variants_product_printify_unique` | product_variants |

### 4.4 Current Provider Column State

All data has been successfully migrated to provider-agnostic columns:

| Table | Legacy Column | New Column | Migration State |
|---|---|---|---|
| products | `printify_id` (0 populated) | `provider_product_id` (27 populated) | COMPLETE |
| products | - | `pod_provider` = 'printful' (27/27) | COMPLETE |
| product_variants | `printify_variant_id` (0 populated) | `external_variant_id` (895 populated) | COMPLETE |
| orders | `printify_order_id` (6) | `external_order_id` (6) | BACKFILLED |
| designs | `printify_upload_id` (2) | `provider_upload_id` (2) | BACKFILLED |

### 4.5 Phase 5 DROP Migration (ON HOLD)

File: `supabase/migrations/20260302200000_phase5_drop_printify_columns.sql.hold`

This migration exists but is **held** (`.sql.hold` extension prevents execution). It contains:
- Safety guards checking zero `pod_provider='printify'` products
- Safety guards checking all backfills completed
- DROP statements for all 12 legacy columns
- DROP statements for all 5 legacy indexes
- DROP statements for legacy constraints

**Status**: Ready to execute. All safety guard conditions are met based on current data.

---

## 5. Migration History Timeline

| Migration | Date | Purpose |
|---|---|---|
| `20260213000000_initial_schema.sql` | 2026-02-13 | Created `printify_id`, `printify_variant_id`, `printify_order_id`, `printify_line_item_id` |
| `20260214003934_insert_mock_products.sql` | 2026-02-14 | Mock data with `printify_id` |
| `20260214030914_add_printify_variant_ids.sql` | 2026-02-14 | Test variant IDs |
| `20260214031125_update_products_with_printify_ids.sql` | 2026-02-14 | Test IDs |
| `20260214033304_add_printify_retry_tracking.sql` | 2026-02-14 | Added retry columns to orders |
| `20260214092444_add_test_products.sql` | 2026-02-14 | Test products |
| `20260214160100_add_printify_upload_id_to_designs.sql` | 2026-02-14 | Added upload tracking to designs |
| `20260215131133_add_printify_status_to_orders.sql` | 2026-02-15 | Added printify_status |
| `20260216000000_pricing_pipeline.sql` | 2026-02-16 | Added printify_cost_cents |
| `20260221120000_personalizations.sql` | 2026-02-21 | Added printify_temp_product_id |
| `20260224040947_add_unique_constraint_product_variants.sql` | 2026-02-24 | UNIQUE on (product_id, printify_variant_id) |
| `20260225000100_expand_categories_printify.sql` | 2026-02-25 | Category expansion for Printify catalog |
| `20260302100000_phase3_add_provider_columns.sql` | 2026-03-02 | **MIGRATION**: Added provider-agnostic columns + backfill |
| `20260306200000_printify_cleanup_and_backfill.sql` | 2026-03-06 | **CLEANUP**: Soft-deleted Printify products, backfilled all columns, set pod_provider='printify_legacy' |
| `20260302200000_phase5_drop_printify_columns.sql.hold` | (HELD) | **DROP**: Removes all legacy columns (not yet executed) |

---

## 6. PodClaw Backend (CRITICAL - No Printful Migration)

The entire PodClaw backend agent system is **100% Printify-based**. This is the largest gap in the migration.

### 6.1 Core Files

| File | References | Impact |
|---|---|---|
| `podclaw/connectors/printify_connector.py` | ~350 refs | **Full Printify API connector** -- all agent tools point here |
| `podclaw/main.py` | 76, 88-90, 138 | Imports `PrintifyMCPConnector`, initializes with `PRINTIFY_API_TOKEN` |
| `podclaw/config.py` | 60-92, 107, 213-215, 320, 385-392 | All agent tool budgets, configs, rate limits reference `printify_*` tools |
| `podclaw/hooks/sync_hook.py` | ~250 refs | Syncs `printify_create/update/publish/delete` to Supabase |
| `podclaw/hooks/security_hook.py` | ~60 refs | Security rules for `printify_*` tools |
| `podclaw/hooks/cost_guard_hook.py` | ~30 refs | Cost tracking for `printify_*` tools |
| `podclaw/hooks/quality_gate_hook.py` | ~40 refs | Quality gates for `printify_create/publish` |
| `podclaw/hooks/memory_hook.py` | 44, 59 | Tracks `printify_delete_product` as high-priority |
| `podclaw/pricing.py` | 5, 20, 73-74 | USD-to-EUR conversion using `PRINTIFY_USD_TO_EUR_RATE` |
| `podclaw/pricing_utils.py` | 5, 22, 65, 75 | Same pricing logic |
| `podclaw/production_governor.py` | 624, 631 | Counts `printify_create` calls |

### 6.2 Agent Definitions

| File | Tools Used |
|---|---|
| `podclaw/agents/designer.py` | `["supabase", "fal", "printify", "crawl4ai", "gemini"]` |
| `podclaw/agents/cataloger.py` | `["supabase", "printify", "gemini"]` |
| `podclaw/agents/brand_manager.py` | `["supabase", "printify"]` |
| `podclaw/agents/qa_inspector.py` | `["supabase", "gemini", "printify"]` |
| `podclaw/agents/finance.py` | References Printify reconciliation |

### 6.3 Agent Skills

All skill definitions in `podclaw/skills/` reference Printify tools:
- `cataloger/SKILL.md` -- 30+ printify tool references
- `designer/SKILL.md` -- printify_upload_image, printify_get_blueprints, etc.
- `brand_manager/SKILL.md` -- printify_list_products, printify_update, etc.
- `qa_inspector/SKILL.md` -- printify_list_products, printify_get_product
- `customer_manager/SKILL.md` -- printify_cancel_order, printify_send_to_production
- `researcher/SKILL.md` -- Printify sync checks

### 6.4 Scripts

| File | Purpose |
|---|---|
| `podclaw/scripts/reconcile_printify.py` | Full reconciliation script against Printify API |
| `podclaw/scripts/reconcile_and_fix.py` | Extended reconciliation with variant population |

### 6.5 Documentation

All PodClaw documentation references Printify:
- `podclaw/README.md`, `TOOLS.md`, `SECURITY.md`, `AGENTS.md`, `USAGE.md`, `CONTRIBUTING.md`
- `podclaw/context/` (product_workflow.md, best_sellers.md, design_library.md, etc.)
- `podclaw/catalog/` (all category planning docs)

### 6.6 Tests

| File | Tests |
|---|---|
| `podclaw/tests/connectors/test_printify_connector.py` | Full connector test suite (~40 tests) |
| `podclaw/tests/test_production_governor.py` | Tests `printify_create` tool counting |
| `podclaw/tests/hooks/test_security_hook.py` | Tests `printify_publish` quality gate |
| `podclaw/tests/hooks/test_event_log_hook.py` | Uses `printify_create` as test tool |
| `podclaw/tests/hooks/test_memory_hook.py` | Uses `printify_delete_product` as test tool |

---

## 7. Frontend Tests

| File | Lines | Details |
|---|---|---|
| `frontend/tests/integration/webhooks/printify.spec.ts` | 1-298 | Full Printify webhook integration test suite. Tests `POST /api/webhooks/printify` endpoint with HMAC signatures. |
| `frontend/tests/e2e/shop/personalizer-mockup-fix.spec.ts` | 6, 10, 82-85, 126 | Asserts mockup URLs do NOT use `printify.com` CDN |

---

## 8. i18n Strings (User-Facing)

| File | Line | Content |
|---|---|---|
| `frontend/messages/en.json` | 1169 | `"Printify: order fulfillment and shipping"` |
| `frontend/messages/en.json` | 1219 | `"Print-on-demand fulfillment through our partner network (Printify)"` |
| `frontend/messages/es.json` | 1169 | `"Printify: cumplimiento y envio de pedidos"` |
| `frontend/messages/es.json` | 1219 | `"Cumplimiento de impresion bajo demanda a traves de nuestra red de socios (Printify)"` |
| `frontend/messages/de.json` | 1169 | `"Printify: Auftragsabwicklung und Versand"` |
| `frontend/messages/de.json` | 1219 | `"Print-on-Demand-Erfullung uber unser Partnernetzwerk (Printify)"` |

These appear in privacy policy / data processing disclosures. **Risk**: Legal inaccuracy -- users are told data is shared with Printify when it is actually shared with Printful.

---

## 9. Service Worker

| File | Line | Details |
|---|---|---|
| `frontend/public/sw.js` | 2 | CDN URL list includes `printify.com` domain in cache configuration |

---

## 10. Frontend Scripts (Historical)

Over 90 scripts in `frontend/scripts/` reference Printify. These are historical product creation/migration scripts. Most are prefixed with `_` (indicating one-time use). Key ones:

| Script | Purpose |
|---|---|
| `migrate-phase1-05-archive-printify.mjs` | Phase 1: Archive/unpublish Printify products |
| `migrate-phase1-00-audit.mjs` | Phase 1: Audit Printify products for migration |
| `create-phase1-products.mjs` | Create products on Printful (references Printify for comparison) |
| `_sync-db-printify.mjs` | Legacy sync script |
| `_force-full-sync.mjs` | Legacy force sync |
| Various `create-*.mjs` | Product creation scripts (Printify API calls) |

---

## 11. Documentation Files with Printify References

| File | Type |
|---|---|
| `CLAUDE.md` | Project instructions -- multiple Printify API references |
| `README.md` | Project README |
| `SETUP.md` | Setup instructions |
| `docs/ONBOARDING.md` | Onboarding guide |
| `docs/runbooks/deployment.md` | Deployment runbook |
| `docs/production-audit/02-printful-stripe-config.md` | Production audit |
| `docs/audit-360/12-printify-integration.md` | Audit report |
| `frontend/docs/printful-migration/` | 7 migration planning docs |
| Various audit `.md` files | Historical audit reports |

---

## 12. Recommendations for Cleanup

### Priority 1: CRITICAL (Legal/User-Facing)

1. **Update i18n strings** (en.json, es.json, de.json) -- Replace "Printify" with "Printful" in privacy/legal text. **Risk if not fixed**: Legal inaccuracy in data processing disclosures.

### Priority 2: HIGH (Database Cleanup)

2. **Execute Phase 5 DROP migration** -- Rename `.sql.hold` to `.sql` and run. All safety conditions are met:
   - 0 products with `pod_provider='printify'`
   - 0 products with `printify_id` populated
   - 0 variants with `printify_variant_id` but no `external_variant_id`
   - All orders backfilled

   This drops 12 columns, 5 indexes, 2 constraints.

### Priority 3: HIGH (Infrastructure)

3. **Remove PRINTIFY_* env vars** from:
   - `docker-compose.yml` (lines 74, 149-151)
   - `.env.example` (lines 41-45, 114)
   - `frontend/.env.local.example` (lines 37-40)
   - `config/.env.required` (lines 23-25)
   - `start.sh` (line 152 -- validation)
   - `.github/workflows/ci.yml` (multiple lines)

   **Prerequisite**: Verify PodClaw does not run in production. If it does, PodClaw must be migrated first.

### Priority 4: MEDIUM (Code Cleanup)

4. **Move `canonicalAddressFromStripe`** from `pod/printify/mapper.ts` to a shared location (e.g., `pod/utils/address.ts`). This is the only active import from the Printify provider.

5. **Rename API routes**:
   - `/api/cron/sync-printify` to `/api/cron/sync-provider`
   - `/api/cron/retry-printify-orders` to `/api/cron/retry-pod-orders`
   - Update `cronName` strings and health check queries accordingly

6. **Rename variables** in active code:
   - `printifyProduct` to `podProduct` in `create-product/route.ts`
   - `allPrintifyProducts` to `allProviderProducts` in `fix-publishing/route.ts`
   - `printifyOrder` to `podOrder` in `checkout-completed.ts`
   - `generatePrintifyMockup` to `generateProviderMockup` in `mockup-generator.ts`
   - `printifyId` to `providerProductId` in `product-detail-cache.ts`

7. **Clean up comments** across `pod/types.ts`, `pod/models/`, `pod/sync/`, `pod/webhooks/handlers/` -- Replace "Printify" with "provider" or "POD provider" in JSDoc.

8. **Update `next.config.ts`** -- Remove `images.printify.com` and `images-api.printify.com` from remotePatterns after confirming no product images reference those domains.

9. **Update `proxy-image/route.ts`** -- Remove `files.cdn.printify.com` from allowlist after confirming no cached references exist.

### Priority 5: LOW (Can Remove Entirely)

10. **Delete `frontend/src/lib/pod/printify/`** directory (6 files) once `canonicalAddressFromStripe` is relocated. This is dead code -- the provider is never initialized.

11. **Delete or archive `frontend/scripts/` Printify scripts** -- 90+ one-time scripts. Move to an archive branch.

### Priority 6: DEFERRED (PodClaw Migration)

12. **PodClaw Printful migration** -- This is a full rewrite of the backend agent system:
    - Create `podclaw/connectors/printful_connector.py` with Printful API v2
    - Update all agent definitions to use `printful` connector
    - Update all hooks (`sync_hook.py`, `security_hook.py`, `cost_guard_hook.py`, `quality_gate_hook.py`)
    - Update all skill docs
    - Update pricing logic (Printful returns EUR directly, no USD conversion needed)
    - Update `podclaw/config.py` tool budgets
    - Update all tests

    **Scope**: ~40 files, ~2000+ lines of code. This should be its own migration project.

---

## Summary Statistics

| Metric | Count |
|---|---|
| Total files with "printify" references | **482** (case-insensitive) |
| Total files with "PRINTIFY" references | **157** (uppercase, config/code) |
| Database columns to drop | **12** |
| Database indexes to drop | **5** |
| Database constraints to drop | **2** |
| Environment variables to remove | **3** (`PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `PRINTIFY_WEBHOOK_SECRET`) |
| i18n strings to update | **6** (2 per language x 3 languages) |
| Active code files needing rename/cleanup | **~15** |
| PodClaw files needing full migration | **~40** |
| Historical/documentation files (safe to ignore) | **~400** |
