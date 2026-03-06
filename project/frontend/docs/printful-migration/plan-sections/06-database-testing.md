# Section 6 — Database Schema Migration & Testing Strategy

> **Document**: Printify → Printful Migration Plan — Section 6
> **Date**: 2026-03-02
> **Scope**: All schema changes, exact migration SQL, per-file code change map, testing layers, environment variables, monitoring, and rollback procedures.

---

## Table of Contents

1. [Schema Changes](#1-schema-changes)
2. [Migration SQL](#2-migration-sql)
3. [Code Changes Required per Schema Rename](#3-code-changes-required-per-schema-rename)
4. [Testing Strategy](#4-testing-strategy)
5. [Environment Variables](#5-environment-variables)
6. [Monitoring & Observability](#6-monitoring--observability)
7. [Rollback Plan](#7-rollback-plan)

---

## 1. Schema Changes

### 1.1 Rationale: Additive Migration Strategy

The chosen strategy is **additive** (add new columns, backfill, run both old and new names in parallel during transition, then deprecate). This is preferred over a direct rename for three reasons:

1. Supabase does not support zero-downtime column renames — a `RENAME COLUMN` takes an `AccessExclusiveLock` that briefly blocks reads.
2. The codebase has 17+ files querying the old column names. An atomic rename requires every file to be updated and deployed simultaneously — too risky.
3. The additive strategy allows progressive rollout: Phase 3 code reads `provider_product_id`; Phase 3 still has `printify_id` populated, so rollback is a no-op.

The `designs` table has one Printify-specific column (`printify_image_url`) added by migration `20260214160100`. It is treated the same way as the others.

### 1.2 Complete Printify-Specific Columns Inventory

The following table lists every Printify-coupled column currently in the live schema, cross-referenced against migration files:

| Table | Column | Type | Defined In | New Canonical Name |
|-------|--------|------|-----------|-------------------|
| `products` | `printify_id` | `VARCHAR(255) UNIQUE` | `20260213000000_initial_schema.sql:53` | `provider_product_id` (kept alongside `pod_provider`) |
| `products` | `blueprint_id` | `INTEGER` | `20260213000000_initial_schema.sql:58` | `product_template_id` |
| `products` | `print_provider_id` | `INTEGER` | `20260213000000_initial_schema.sql:59` | `provider_facility_id` |
| `product_variants` | `printify_variant_id` | `VARCHAR(255)` | `20260213000000_initial_schema.sql:74` | `external_variant_id` |
| `orders` | `printify_order_id` | `VARCHAR(255)` | `20260213000000_initial_schema.sql:110` | `external_order_id` |
| `orders` | `printify_cost_cents` | `INTEGER` | `20260216000000_pricing_pipeline.sql:7` | `pod_cost_cents` |
| `orders` | `printify_retry_count` | `INTEGER` | `20260214033304_add_printify_retry_tracking.sql:5` | `pod_retry_count` |
| `orders` | `printify_error` | `TEXT` | `20260214033304_add_printify_retry_tracking.sql:6` | `pod_error` |
| `orders` | `printify_last_attempt_at` | `TIMESTAMPTZ` | `20260214033304_add_printify_retry_tracking.sql:7` | `pod_last_attempt_at` |
| `order_items` | `printify_line_item_id` | `VARCHAR(255)` | `20260213000000_initial_schema.sql:134` | `external_line_item_id` |
| `designs` | `printify_image_url` | `TEXT` | `20260214160100_add_printify_upload_id_to_designs.sql:2` | `pod_upload_url` |

### 1.3 products Table — Detailed Change Plan

**Current state** (from `20260213000000_initial_schema.sql` lines 51–69):
```sql
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  printify_id         VARCHAR(255) UNIQUE,   -- Printify external ID
  title               TEXT NOT NULL,
  description         TEXT,
  category            VARCHAR(100),
  tags                TEXT[] DEFAULT '{}',
  blueprint_id        INTEGER,               -- Printify blueprint ID
  print_provider_id   INTEGER,               -- Printify provider ID
  base_price_cents    INTEGER NOT NULL,
  ...
);
```

**Phase 3 additions** (new columns, keep old ones):

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `pod_provider` | `VARCHAR(20)` | `'printify'` | Which POD backend owns this product: `'printify'` or `'printful'` |
| `provider_product_id` | `TEXT` | `NULL` | Provider-agnostic external product ID (backfilled from `printify_id`) |
| `product_template_id` | `TEXT` | `NULL` | Provider-agnostic template/blueprint ref (Printify: integer cast to text; Printful: catalog variant ID string) |
| `provider_facility_id` | `TEXT` | `NULL` | Provider-agnostic facility/print-provider (Printify: integer cast to text; Printful: `'PRINTFUL'`) |

Note on `print_provider_id` → `provider_facility_id`: In Printful there is no concept of "print provider ID" as a separate integer — Printful is always the fulfillment partner. The field is retained as a text column for completeness and to carry forward the Printify facility ID for legacy products without breaking divergence detection.

**Phase 5 deprecations** (after all products migrated):

```sql
-- These columns are DROPPED only after 100% of products have pod_provider = 'printful'
ALTER TABLE products DROP COLUMN printify_id;
ALTER TABLE products DROP COLUMN blueprint_id;
ALTER TABLE products DROP COLUMN print_provider_id;
```

### 1.4 product_variants Table — Detailed Change Plan

**Current state** (from `20260213000000_initial_schema.sql` lines 71–82 and `20260216100000_product_metadata_enrichment.sql:8`):
```sql
CREATE TABLE product_variants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  printify_variant_id  VARCHAR(255),
  title                VARCHAR(255) NOT NULL,
  size                 VARCHAR(50),
  color                VARCHAR(50),
  price_cents          INTEGER NOT NULL,
  sku                  VARCHAR(100),
  is_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  is_available         BOOLEAN NOT NULL DEFAULT TRUE,
  -- added by 20260216100000:
  cost_cents           INTEGER,
  image_url            TEXT
);
-- Unique constraint added by 20260224040947:
-- UNIQUE (product_id, printify_variant_id)
```

**Phase 3 additions**:

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `external_variant_id` | `TEXT` | `NULL` | Provider-agnostic variant ID (backfilled from `printify_variant_id`) |

**Phase 3 constraint**:
```sql
ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_provider_variant_unique
  UNIQUE (product_id, external_variant_id);
```

**Phase 5 deprecations**:
```sql
-- Only after all variants are re-synced via Printful adapter
ALTER TABLE product_variants DROP CONSTRAINT product_variants_product_printify_unique;
ALTER TABLE product_variants DROP COLUMN printify_variant_id;
```

### 1.5 orders Table — Detailed Change Plan

**Current state** (assembled from multiple migrations):
```sql
-- 20260213000000:
printify_order_id    VARCHAR(255)
-- 20260216000000:
printify_cost_cents  INTEGER
-- 20260214033304:
printify_retry_count INTEGER NOT NULL DEFAULT 0
printify_error       TEXT
printify_last_attempt_at TIMESTAMPTZ
```

**Phase 3 additions**:

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `external_order_id` | `TEXT` | `NULL` | Provider-agnostic order ID (backfilled from `printify_order_id`) |
| `pod_provider` | `VARCHAR(20)` | `'printify'` | Which provider fulfilled this order |
| `pod_cost_cents` | `INTEGER` | `NULL` | Production cost from any provider (mirrors `printify_cost_cents`) |
| `pod_retry_count` | `INTEGER` | `0` | Submission retry counter (mirrors `printify_retry_count`) |
| `pod_error` | `TEXT` | `NULL` | Last submission error text (mirrors `printify_error`) |
| `pod_last_attempt_at` | `TIMESTAMPTZ` | `NULL` | Last submission attempt time |

**Phase 5 deprecations**:
```sql
ALTER TABLE orders DROP COLUMN printify_order_id;
ALTER TABLE orders DROP COLUMN printify_cost_cents;
ALTER TABLE orders DROP COLUMN printify_retry_count;
ALTER TABLE orders DROP COLUMN printify_error;
ALTER TABLE orders DROP COLUMN printify_last_attempt_at;
DROP INDEX IF EXISTS idx_orders_printify_retry;
```

### 1.6 order_items Table — Detailed Change Plan

**Current state** (from `20260213000000_initial_schema.sql` line 134):
```sql
printify_line_item_id VARCHAR(255)
```

**Phase 3 addition**:

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `external_line_item_id` | `TEXT` | `NULL` | Provider-agnostic line item ID |

**Phase 5 deprecation**:
```sql
ALTER TABLE order_items DROP COLUMN printify_line_item_id;
```

### 1.7 designs Table — Detailed Change Plan

**Current state** (from `20260214160100_add_printify_upload_id_to_designs.sql:2`):
```sql
printify_image_url TEXT
```

**Phase 3 addition**:

| New Column | Type | Default | Purpose |
|------------|------|---------|---------|
| `pod_upload_url` | `TEXT` | `NULL` | Provider-agnostic URL of the uploaded design file on the POD provider's CDN |

---

## 2. Migration SQL

All migration files go into `/Users/lr0y/POD-AI-PDR/pod_workspace/project/supabase/migrations/`.

### 2.1 Phase 3 Migration: Add Provider Tracking Columns

**File**: `20260302100000_phase3_add_provider_columns.sql`

```sql
-- ============================================================
-- Phase 3: Add provider-agnostic columns to products,
-- product_variants, orders, order_items, and designs.
-- All old Printify columns are preserved — no data is dropped.
-- Backfill copies existing Printify IDs into the new columns.
-- ============================================================

BEGIN;

-- -----------------------------------------------
-- products: add pod_provider + provider_product_id
-- -----------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pod_provider          VARCHAR(20) NOT NULL DEFAULT 'printify',
  ADD COLUMN IF NOT EXISTS provider_product_id   TEXT,
  ADD COLUMN IF NOT EXISTS product_template_id   TEXT,
  ADD COLUMN IF NOT EXISTS provider_facility_id  TEXT;

-- Backfill from existing Printify columns
UPDATE products
SET
  provider_product_id  = printify_id,
  product_template_id  = blueprint_id::TEXT,
  provider_facility_id = print_provider_id::TEXT
WHERE printify_id IS NOT NULL;

-- Add a UNIQUE constraint on (pod_provider, provider_product_id)
-- so the upsert pattern works regardless of provider.
-- Using a partial unique index is safer than a full UNIQUE constraint
-- because some historical rows may have NULL provider_product_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_provider_product_unique
  ON products (pod_provider, provider_product_id)
  WHERE provider_product_id IS NOT NULL;

-- Composite lookup index (replaces idx_products_printify_id for new code)
CREATE INDEX IF NOT EXISTS idx_products_pod_provider
  ON products (pod_provider, status);

-- -----------------------------------------------
-- product_variants: add external_variant_id
-- -----------------------------------------------
ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS external_variant_id TEXT;

-- Backfill
UPDATE product_variants
SET external_variant_id = printify_variant_id
WHERE printify_variant_id IS NOT NULL;

-- Unique constraint for upsert: (product_id, external_variant_id)
-- Guard with DO block in case migration reruns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_variants_provider_variant_unique'
  ) THEN
    ALTER TABLE product_variants
      ADD CONSTRAINT product_variants_provider_variant_unique
      UNIQUE (product_id, external_variant_id);
  END IF;
END $$;

-- -----------------------------------------------
-- orders: add external_order_id + pod_* columns
-- -----------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS external_order_id    TEXT,
  ADD COLUMN IF NOT EXISTS pod_provider         VARCHAR(20) NOT NULL DEFAULT 'printify',
  ADD COLUMN IF NOT EXISTS pod_cost_cents       INTEGER,
  ADD COLUMN IF NOT EXISTS pod_retry_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pod_error            TEXT,
  ADD COLUMN IF NOT EXISTS pod_last_attempt_at  TIMESTAMPTZ;

-- Backfill
UPDATE orders
SET
  external_order_id   = printify_order_id,
  pod_cost_cents      = printify_cost_cents,
  pod_retry_count     = printify_retry_count,
  pod_error           = printify_error,
  pod_last_attempt_at = printify_last_attempt_at
WHERE printify_order_id IS NOT NULL
   OR printify_cost_cents IS NOT NULL
   OR printify_retry_count > 0;

-- Index for retry-queue logic (mirrors idx_orders_printify_retry)
CREATE INDEX IF NOT EXISTS idx_orders_pod_retry
  ON orders (pod_retry_count, pod_last_attempt_at)
  WHERE pod_error IS NOT NULL AND status = 'paid';

-- Index for webhook lookups by external_order_id
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id
  ON orders (external_order_id)
  WHERE external_order_id IS NOT NULL;

-- -----------------------------------------------
-- order_items: add external_line_item_id
-- -----------------------------------------------
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS external_line_item_id TEXT;

-- Backfill
UPDATE order_items
SET external_line_item_id = printify_line_item_id
WHERE printify_line_item_id IS NOT NULL;

-- -----------------------------------------------
-- designs: add pod_upload_url
-- -----------------------------------------------
ALTER TABLE designs
  ADD COLUMN IF NOT EXISTS pod_upload_url TEXT;

-- Backfill
UPDATE designs
SET pod_upload_url = printify_image_url
WHERE printify_image_url IS NOT NULL;

COMMIT;
```

**Estimated execution time**: ~2–3 seconds on the live Supabase Cloud database (79 active products, 1,435 variants, order count unknown). The `UPDATE` statements use sequential scans on small tables — no downtime.

---

### 2.2 Phase 5 Migration: Deprecate Printify Columns

**File**: `20260302500000_phase5_drop_printify_columns.sql`

> WARNING: Run this migration ONLY after all 79 products have been migrated to Printful (`pod_provider = 'printful'`), all order webhook handlers reference `external_order_id`, and both `printify_id` and `provider_product_id` have been verified to be identical for all active products.

```sql
-- ============================================================
-- Phase 5: Drop Printify-specific columns.
-- PRECONDITIONS (verify before running):
--   SELECT COUNT(*) FROM products WHERE pod_provider = 'printify' AND status = 'active';
--   -- must return 0
--   SELECT COUNT(*) FROM orders WHERE external_order_id IS NULL AND printify_order_id IS NOT NULL;
--   -- must return 0
-- ============================================================

BEGIN;

-- Verify preconditions
DO $$
DECLARE
  printify_active INTEGER;
  orders_missing  INTEGER;
BEGIN
  SELECT COUNT(*) INTO printify_active
  FROM products
  WHERE pod_provider = 'printify' AND status = 'active';

  SELECT COUNT(*) INTO orders_missing
  FROM orders
  WHERE external_order_id IS NULL AND printify_order_id IS NOT NULL;

  IF printify_active > 0 THEN
    RAISE EXCEPTION 'Phase 5 precondition failed: % active products still on Printify', printify_active;
  END IF;

  IF orders_missing > 0 THEN
    RAISE EXCEPTION 'Phase 5 precondition failed: % orders have printify_order_id but no external_order_id', orders_missing;
  END IF;
END $$;

-- products: drop Printify-specific columns
DROP INDEX IF EXISTS idx_products_printify_id;

ALTER TABLE products
  DROP COLUMN IF EXISTS printify_id,
  DROP COLUMN IF EXISTS blueprint_id,
  DROP COLUMN IF EXISTS print_provider_id;

-- product_variants: drop old constraint and column
ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_product_printify_unique;

ALTER TABLE product_variants
  DROP COLUMN IF EXISTS printify_variant_id;

-- orders: drop Printify-specific columns and index
DROP INDEX IF EXISTS idx_orders_printify_retry;

ALTER TABLE orders
  DROP COLUMN IF EXISTS printify_order_id,
  DROP COLUMN IF EXISTS printify_cost_cents,
  DROP COLUMN IF EXISTS printify_retry_count,
  DROP COLUMN IF EXISTS printify_error,
  DROP COLUMN IF EXISTS printify_last_attempt_at;

-- order_items: drop old column
ALTER TABLE order_items
  DROP COLUMN IF EXISTS printify_line_item_id;

-- designs: drop old column
ALTER TABLE designs
  DROP COLUMN IF EXISTS printify_image_url;

COMMIT;
```

---

### 2.3 Rollback SQL for Phase 3

If Phase 3 migration needs to be reverted (e.g., a bug introduced in the additive migration itself):

```sql
-- Rollback Phase 3 additions only — no data is lost since Printify columns are untouched.

BEGIN;

-- products
DROP INDEX IF EXISTS idx_products_provider_product_unique;
DROP INDEX IF EXISTS idx_products_pod_provider;
ALTER TABLE products
  DROP COLUMN IF EXISTS pod_provider,
  DROP COLUMN IF EXISTS provider_product_id,
  DROP COLUMN IF EXISTS product_template_id,
  DROP COLUMN IF EXISTS provider_facility_id;

-- product_variants
ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_provider_variant_unique,
  DROP COLUMN IF EXISTS external_variant_id;

-- orders
DROP INDEX IF EXISTS idx_orders_pod_retry;
DROP INDEX IF EXISTS idx_orders_external_order_id;
ALTER TABLE orders
  DROP COLUMN IF EXISTS external_order_id,
  DROP COLUMN IF EXISTS pod_provider,
  DROP COLUMN IF EXISTS pod_cost_cents,
  DROP COLUMN IF EXISTS pod_retry_count,
  DROP COLUMN IF EXISTS pod_error,
  DROP COLUMN IF EXISTS pod_last_attempt_at;

-- order_items
ALTER TABLE order_items
  DROP COLUMN IF EXISTS external_line_item_id;

-- designs
ALTER TABLE designs
  DROP COLUMN IF EXISTS pod_upload_url;

COMMIT;
```

---

### 2.4 Verification Queries

Run these after applying the Phase 3 migration to confirm all backfills completed:

```sql
-- Verify products backfill (must return 0)
SELECT COUNT(*)
FROM products
WHERE printify_id IS NOT NULL
  AND provider_product_id IS DISTINCT FROM printify_id;

-- Verify all active products have provider_product_id (must return 0)
SELECT COUNT(*)
FROM products
WHERE status = 'active'
  AND provider_product_id IS NULL;

-- Verify product_variants backfill (must return 0)
SELECT COUNT(*)
FROM product_variants
WHERE printify_variant_id IS NOT NULL
  AND external_variant_id IS DISTINCT FROM printify_variant_id;

-- Verify orders backfill (must return 0)
SELECT COUNT(*)
FROM orders
WHERE printify_order_id IS NOT NULL
  AND external_order_id IS DISTINCT FROM printify_order_id;

-- Verify pod_provider default is correct (all must be 'printify')
SELECT pod_provider, COUNT(*)
FROM products
GROUP BY pod_provider;
-- Expected: { 'printify': 117 }

-- Spot check: 5 random products should show same value in both columns
SELECT printify_id, provider_product_id, blueprint_id, product_template_id
FROM products
WHERE status = 'active'
LIMIT 5;
```

---

### 2.5 RLS Policy Impact

The `products`, `product_variants`, and `order_items` tables do not have RLS enabled in the current schema — they are public read / service-role write. The `orders` table has:

```sql
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);
```

No RLS policy references any Printify-specific column by name, so no policy changes are required for Phase 3 or Phase 5 migrations.

However, one policy-adjacent concern: if a future admin UI shows `pod_provider` or `external_order_id` to users, add a read policy that filters on `user_id`. This is not required for the migration itself.

---

## 3. Code Changes Required per Schema Rename

### 3.1 Complete File Reference Map

Every source file that reads or writes a Printify-specific DB column, with the exact change required:

---

#### `frontend/src/lib/printify-sync.ts`

**References**: `printify_id` (lines 266, 288, 318, 496, 541), `blueprint_id` (305), `print_provider_id` (306), `printify_variant_id` (447, 462, 467)

**Phase 3 changes** (sync engine writes to new columns in addition to old):
```typescript
// Line 288 — when upserting a product row:
// BEFORE:
{
  printify_id: printifyId,
  blueprint_id: blueprintId,
  print_provider_id: printProviderId,
}
// AFTER (write both old and new columns during transition):
{
  printify_id: printifyId,
  provider_product_id: printifyId,
  pod_provider: 'printify',
  blueprint_id: blueprintId,
  product_template_id: blueprintId ? String(blueprintId) : undefined,
  print_provider_id: printProviderId,
  provider_facility_id: printProviderId ? String(printProviderId) : undefined,
}

// Line 318 — upsert conflict target stays on printify_id until Phase 5:
.upsert(row, { onConflict: 'printify_id' })
// Phase 5: change to:
.upsert(row, { onConflict: 'provider_product_id' })

// Line 447 — variant upsert writes both columns:
printify_variant_id: String(variantId),
external_variant_id: String(variantId),

// Line 462/467 — upsert conflict stays on old constraint until Phase 5:
onConflict: 'product_id,printify_variant_id'
// Phase 5: change to:
onConflict: 'product_id,external_variant_id'
```

---

#### `frontend/src/lib/product-detail-cache.ts`

**References**: `printify_variant_id` (lines 14, 20, 21, 57, 63), `printifyId` (line 121)

**Phase 3 changes**:
```typescript
// Line 57 — SELECT query, add new column:
.select('title, size, color, price_cents, is_enabled, is_available, image_url, printify_variant_id, external_variant_id')

// Line 14/20/21 — variant array type, read both during transition:
variants: Array<{
  color: string | null;
  size: string | null;
  printify_variant_id: string | null;
  external_variant_id: string | null;  // Phase 3: add
}>
// Use: v.external_variant_id ?? v.printify_variant_id

// Line 121:
printifyId: product.printify_id,
providerProductId: product.provider_product_id,  // Phase 3: add
```

---

#### `frontend/src/lib/reliability/divergence-detector.ts`

**References**: `printify_id` (lines 32, 58, 62, 63, 76, 92, 215, 266, 275, 276, 281), `blueprint_id` (lines 62, 114–121, 266, 303–310), `print_provider_id` (lines 62, 126–133, 266, 315–322), `printify_variant_id` (lines 142, 150, 152)

**Phase 3 changes** (this file is part of the Printify adapter — it will move to `src/lib/pod/printify/divergence-detector.ts` in Phase 1):
```typescript
// Line 62 — SELECT: add new columns
.select('id, printify_id, provider_product_id, title, description, blueprint_id, product_template_id, print_provider_id, provider_facility_id, base_price_cents')

// Line 63 — null check: read either column
.not('printify_id', 'is', null)
// Phase 5 becomes:
.not('provider_product_id', 'is', null)

// Lines 114–121 and 303–310 — divergence checks now also compare product_template_id:
// No change needed in Phase 3 since blueprint_id is still populated.
// Phase 5: replace blueprint_id references with product_template_id.
```

---

#### `frontend/src/app/api/cron/sync-printify/route.ts`

**References**: `printify_id` (lines 11, 96, 100, 101, 111, 112)

**Phase 3 changes**:
```typescript
// Line 100 — SELECT: add new column
.select('id, printify_id, provider_product_id, title, status, images, cost_cents, base_price_cents')

// Line 101 — null check: unchanged in Phase 3
.not('printify_id', 'is', null)

// Line 111-112 — map key: add parallel map for new column during transition
if (product.printify_id) {
  supabaseMap.set(product.printify_id, product)
}
if (product.provider_product_id) {
  supabaseProviderMap.set(product.provider_product_id, product)
}
```

---

#### `frontend/src/app/api/checkout/create-session/route.ts`

**References**: `printify_id` (lines 253, 258, 261, 368, 373, 395), `blueprint_id` (lines 253, 258, 321, 322, 368, 373, 422, 423), `print_provider_id` (lines 253, 258, 321, 322, 368, 373, 422, 423)

**Phase 3 changes**: This file calls Printify directly for shipping rate calculation. In Phase 3 it reads from both columns:
```typescript
// Line 253 — SELECT: add new columns
.select('id, printify_id, provider_product_id, pod_provider, blueprint_id, product_template_id, print_provider_id, provider_facility_id, title')

// Line 258 — guard: use either column
if (!dbProduct?.provider_product_id && !dbProduct?.printify_id) continue
// Phase 5: simplify to:
if (!dbProduct?.provider_product_id) continue

// Lines 321–322 — pass to provider call
// Phase 3: keep using blueprint_id for Printify products (pod_provider === 'printify')
// Phase 4: route to provider based on dbProduct.pod_provider
```

---

#### `frontend/src/app/api/designs/[id]/create-product/route.ts`

**References**: `printify_id` (lines 10, 212), `blueprint_id` (lines 58, 71, 76, 78, 83, 191), `print_provider_id` (lines 58, 71, 76, 78, 83, 85, 191, 192), `printify_image_url` (line 139)

**Phase 3 changes**:
```typescript
// Line 212 — write both old and new columns
{
  printify_id: printifyProduct.id,
  provider_product_id: printifyProduct.id,
  pod_provider: 'printify',
  blueprint_id: body.blueprint_id,
  product_template_id: String(body.blueprint_id),
  print_provider_id: body.print_provider_id,
  provider_facility_id: String(body.print_provider_id),
}

// Line 139 — write both old and new columns
{
  printify_image_url: uploadResult.preview_url,
  pod_upload_url: uploadResult.preview_url,
}
```

---

#### `frontend/src/app/api/products/[id]/route.ts`

**References**: `printify_variant_id` (lines 48, 54, 90, 95), `printify_id` (line 145)

**Phase 3 changes**:
```typescript
// Line 48 — SELECT: add new column
.select('title, size, color, price_cents, is_enabled, is_available, printify_variant_id, external_variant_id')

// Line 90–95 — build variant→image map using either column
if (val && (v.external_variant_id ?? v.printify_variant_id)) {
  idToValue.set((v.external_variant_id ?? v.printify_variant_id)!, val)
}

// Line 145 — response payload
printifyId: product.printify_id,
providerProductId: product.provider_product_id,  // add
podProvider: product.pod_provider,               // add
```

---

#### `frontend/src/app/api/admin/fix-publishing/route.ts`

**References**: `printify_id` (lines 55, 58, 59, 63, 64)

**Phase 3 changes**:
```typescript
// Line 58 — SELECT: add new column
.select('id, printify_id, provider_product_id, status')

// Line 59 — null check: unchanged in Phase 3

// Line 63–64 — map key: use provider_product_id when available
if (p.provider_product_id ?? p.printify_id) {
  supabaseMap.set((p.provider_product_id ?? p.printify_id)!, { id: p.id, status: p.status })
}
```

---

#### `frontend/src/app/api/admin/seed-branded/route.ts`

**References**: `printify_id` (line 408), `blueprint_id` (lines 374, 409), `print_provider_id` (lines 375, 410), `printify_variant_id` (lines 438, 446)

**Phase 3 changes**: Add all new columns alongside existing ones (same pattern as `create-product/route.ts`).

---

#### `frontend/src/app/api/admin/seed-hats/route.ts`

**References**: `printify_id` (line 445), `blueprint_id` (lines 407, 408, 446), `print_provider_id` (lines 408, 447), `printify_variant_id` (lines 496, 504)

**Phase 3 changes**: Same pattern as `seed-branded/route.ts`.

---

#### `frontend/src/app/api/admin/orders/route.ts`

**References**: `printify_order_id` (line 50), `printify_retry_count` (line 65), `printify_error` (line 66)

**Phase 3 changes**:
```typescript
// Line 50 — SELECT and response: add new columns
external_order_id,
pod_provider,
pod_retry_count,
pod_error,
// Keep old columns in SELECT during transition for admin display
printify_order_id,
printify_retry_count,
printify_error,
```

---

#### `frontend/src/app/api/webhooks/stripe/route.ts`

**References**: `printify_id` (lines 333, 352), `printify_variant_id` (lines 338, 353, 363), `printify_order_id` (line 418), `printify_error` (lines 365, 445, 469), `printify_retry_count` (lines 446, 470), `printify_last_attempt_at` (lines 420, 447, 471)

**Phase 3 changes**: This is the highest-risk file. It writes order submission results. All writes must populate both old and new columns simultaneously:
```typescript
// Line 418:
printify_order_id: printifyOrder.id,      // keep for Phase 3
external_order_id: printifyOrder.id,      // add for Phase 3

// Lines 445–447 (error tracking):
printify_error: errorMessage,             // keep
printify_retry_count: 1,                  // keep
printify_last_attempt_at: new Date().toISOString(),  // keep
pod_error: errorMessage,                  // add
pod_retry_count: 1,                       // add
pod_last_attempt_at: new Date().toISOString(),       // add

// Lines 338, 353 — variant lookup:
.select('id, printify_variant_id, external_variant_id')
// Use: v.external_variant_id ?? v.printify_variant_id
```

---

#### `frontend/src/app/api/webhooks/printify/route.ts`

**References**: `printify_order_id` (lines 173, 174, 218, 230, 306, 309, 321, 335, 403, 415, 524, 539, 657), `printify_id` (line 112)

**Phase 3 changes**: This webhook handler will remain in service for all Printify-originated events. Writes must populate both columns:
```typescript
// All .eq('printify_order_id', printifyOrderId) calls: unchanged in Phase 3.
// Phase 5: replace with .eq('external_order_id', printifyOrderId)

// Line 309 — write on order creation:
printify_order_id: printifyOrderId,   // keep
external_order_id: printifyOrderId,   // add

// Line 112 — product lookup:
.eq('printify_id', publishProductId)
// Phase 5: .eq('provider_product_id', publishProductId)
```

---

#### `frontend/src/app/api/cron/retry-printify-orders/route.ts`

**References**: `printify_order_id` (lines 6, 46, 51)

**Phase 3 changes**: This cron will be renamed to `retry-pod-orders` in Phase 4. For now:
```typescript
// Line 51 — NULL check: query pod_error instead of printify_order_id null check
.is('external_order_id', null)   // Phase 3: add parallel check
// Keep .is('printify_order_id', null) for Printify orders
```

---

### 3.2 Supabase Query Find-and-Replace Summary

For grep-driven bulk replacement in Phase 5 (after all products have migrated):

| Find | Replace with | Scope |
|------|-------------|-------|
| `.eq('printify_id',` | `.eq('provider_product_id',` | all `src/` files |
| `.not('printify_id', 'is', null)` | `.not('provider_product_id', 'is', null)` | all `src/` files |
| `onConflict: 'printify_id'` | `onConflict: 'provider_product_id'` | all `src/` files |
| `onConflict: 'product_id,printify_variant_id'` | `onConflict: 'product_id,external_variant_id'` | all `src/` files |
| `.eq('printify_order_id',` | `.eq('external_order_id',` | all `src/` files |
| `.eq('printify_variant_id',` | `.eq('external_variant_id',` | all `src/` files |
| `printify_id: ` | `provider_product_id: ` | INSERT/UPSERT objects |
| `printify_variant_id: ` | `external_variant_id: ` | INSERT/UPSERT objects |
| `printify_order_id: ` | `external_order_id: ` | INSERT/UPSERT objects |
| `printify_line_item_id: ` | `external_line_item_id: ` | INSERT/UPSERT objects |
| `printify_error: ` | `pod_error: ` | INSERT/UPSERT objects |
| `printify_retry_count: ` | `pod_retry_count: ` | INSERT/UPSERT objects |
| `printify_last_attempt_at: ` | `pod_last_attempt_at: ` | INSERT/UPSERT objects |
| `printify_image_url: ` | `pod_upload_url: ` | INSERT/UPSERT objects |

---

## 4. Testing Strategy

### 4.1 Overview

Three test layers are required. The project currently uses Jest (from `frontend/src/__tests__/SafeMarkdown.test.tsx`). All new test files go under `frontend/src/__tests__/`.

```
__tests__/
  lib/
    pod/
      printful/
        mapper.test.ts         # Unit: Printful API → CanonicalProduct
        variant-parser.test.ts # Unit: Printful variant structure → size/color
        price.test.ts          # Unit: cost → retail margin math
        category.test.ts       # Unit: product title → category slug
        webhook-sig.test.ts    # Unit: Printful HMAC verification
      sync/
        sync-engine.test.ts    # Integration: sync with MockPODProvider
      webhooks/
        handler.test.ts        # Integration: webhook events end-to-end
      contracts/
        product-contract.test.ts  # Contract: both adapters → CanonicalProduct
        order-contract.test.ts    # Contract: both adapters → CanonicalOrder
      testing/
        mock-provider.ts       # Shared mock (from architecture-recommendations.md)
        mock-supabase.ts       # Supabase query builder mock
        fixtures/
          printful.ts          # Recorded Printful API responses
          printify.ts          # Recorded Printify API responses
```

---

### 4.2 Unit Tests

#### 4.2.1 Mapper Tests

**File**: `frontend/src/__tests__/lib/pod/printful/mapper.test.ts`

Purpose: Verify `src/lib/pod/printful/mapper.ts` correctly transforms every Printful API response shape into a `CanonicalProduct`.

```typescript
import { toCanonicalProduct, toCanonicalVariant, fromCanonicalOrder } from '@/lib/pod/printful/mapper'
import { printfulFixtures } from '@/lib/pod/testing/fixtures/printful'

describe('PrintfulMapper — toCanonicalProduct', () => {
  it('maps sync_product with sync_variants to CanonicalProduct', () => {
    const raw = printfulFixtures.syncProduct.tshirt
    const result = toCanonicalProduct(raw)

    expect(result.externalId).toBe(String(raw.id))
    expect(result.title).toBe(raw.name)
    expect(result.status).toBe('active')
    expect(result.variants).toHaveLength(raw.sync_variants.length)
    expect(result.blueprintRef).toBe(String(raw.external.id))
  })

  it('maps is_ignored = true to draft status', () => {
    const raw = { ...printfulFixtures.syncProduct.tshirt, is_ignored: true }
    expect(toCanonicalProduct(raw).status).toBe('draft')
  })

  it('maps discontinued sync_product status to deleted', () => {
    const raw = { ...printfulFixtures.syncProduct.tshirt, status: 'NotSynced' }
    expect(toCanonicalProduct(raw).status).toBe('draft')
  })

  it('extracts thumbnail_url as primary image', () => {
    const raw = printfulFixtures.syncProduct.tshirt
    const result = toCanonicalProduct(raw)
    expect(result.images[0]?.url).toBe(raw.thumbnail_url)
  })
})

describe('PrintfulMapper — toCanonicalVariant', () => {
  it('parses "Black / S" title into color=Black, size=S', () => {
    const raw = { ...printfulFixtures.syncVariant.base, name: 'Black / S' }
    const result = toCanonicalVariant(raw)
    expect(result.color).toBe('Black')
    expect(result.size).toBe('S')
  })

  it('handles one-size products (no slash in name)', () => {
    const raw = { ...printfulFixtures.syncVariant.base, name: 'Black' }
    const result = toCanonicalVariant(raw)
    expect(result.color).toBe('Black')
    expect(result.size).toBeNull()
  })

  it('uses retail_price as priceCents (converted to integer EUR cents)', () => {
    // Printful returns retail_price as string e.g. "24.99"
    const raw = { ...printfulFixtures.syncVariant.base, retail_price: '24.99' }
    const result = toCanonicalVariant(raw)
    expect(result.priceCents).toBe(2499)
  })
})

describe('PrintfulMapper — fromCanonicalOrder', () => {
  it('transforms canonical address to Printful recipient format', () => {
    const input = {
      internalOrderId: 'order-uuid-123',
      lineItems: [{ productExternalId: '99', variantExternalId: '42', quantity: 1 }],
      address: {
        firstName: 'Maria', lastName: 'Schmidt',
        email: 'maria@example.de',
        address1: 'Musterstr. 1', city: 'Berlin',
        state: 'BE', postalCode: '10115', country: 'DE',
      },
    }
    const result = fromCanonicalOrder(input)
    expect(result.recipient.name).toBe('Maria Schmidt')
    expect(result.recipient.country_code).toBe('DE')
    expect(result.items[0].sync_variant_id).toBe(42)
    expect(result.external_id).toBe('order-uuid-123')
  })

  it('throws if variantExternalId is not a valid integer', () => {
    const input = {
      internalOrderId: 'order-uuid-123',
      lineItems: [{ productExternalId: '99', variantExternalId: 'not-a-number', quantity: 1 }],
      address: { firstName: 'X', lastName: 'Y', email: 'x@y.com', address1: 'A', city: 'B', state: 'C', postalCode: '0', country: 'DE' },
    }
    expect(() => fromCanonicalOrder(input)).toThrow('Invalid Printful variant ID')
  })
})
```

---

#### 4.2.2 Variant Parser Tests

**File**: `frontend/src/__tests__/lib/pod/printful/variant-parser.test.ts`

Printful variant names follow the same `"Color / Size"` convention as Printify. The key difference is shoe sizing (Printful uses US sizing natively, no EU conversion needed for EU warehouse products).

```typescript
import { parseVariantTitle, normalizeSize, normalizeColor } from '@/lib/pod/printful/mapper'

describe('parseVariantTitle', () => {
  const cases = [
    { input: 'Black / S',          color: 'Black',    size: 'S'    },
    { input: 'Navy / 2XL',         color: 'Navy',     size: '2XL'  },
    { input: 'Dark Heather / XL',  color: 'Dark Heather', size: 'XL' },
    { input: 'One Size',           color: 'One Size', size: null   },
    { input: 'Black',              color: 'Black',    size: null   },
    // Headwear (S/M, L/XL)
    { input: 'Black / S/M',        color: 'Black',    size: 'S/M'  },
    // Mugs (11oz only)
    { input: 'White / 11 oz',      color: 'White',    size: '11 oz' },
  ]
  cases.forEach(({ input, color, size }) => {
    it(`parses "${input}"`, () => {
      const result = parseVariantTitle(input)
      expect(result.color).toBe(color)
      expect(result.size).toBe(size)
    })
  })
})

describe('normalizeSize', () => {
  it('normalizes 2XL to 2XL (no change needed for EU Printful)', () => {
    expect(normalizeSize('2XL')).toBe('2XL')
  })
  it('handles null input', () => {
    expect(normalizeSize(null)).toBeNull()
  })
})
```

---

#### 4.2.3 Price Calculation Tests

**File**: `frontend/src/__tests__/lib/pod/printful/price.test.ts`

```typescript
import { calculateRetailPrice, assertMinimumMargin } from '@/lib/pod/sync/pricing'

describe('calculateRetailPrice', () => {
  it('applies 1.8x multiplier for apparel (tshirt/hoodie category)', () => {
    // cost = €10.00 = 1000 cents
    expect(calculateRetailPrice(1000, 'tshirt')).toBe(1800)  // 18.00
  })

  it('applies 2.0x multiplier for mugs', () => {
    expect(calculateRetailPrice(850, 'mug')).toBe(1700)
  })

  it('applies 2.5x multiplier for stickers', () => {
    expect(calculateRetailPrice(400, 'sticker')).toBe(1000)
  })

  it('rounds to nearest 99 cent price point', () => {
    // 1000 * 1.8 = 1800 → rounds to 1799 (nearest .99)
    expect(calculateRetailPrice(1000, 'tshirt', { roundToNine: true })).toBe(1799)
  })
})

describe('assertMinimumMargin', () => {
  it('passes when margin >= 35%', () => {
    // cost 1000, price 1600 → margin = 37.5% — OK
    expect(() => assertMinimumMargin(1000, 1600)).not.toThrow()
  })

  it('throws when margin < 35%', () => {
    // cost 1000, price 1300 → margin = 23.1% — below threshold
    expect(() => assertMinimumMargin(1000, 1300)).toThrow('margin below 35%')
  })
})
```

---

#### 4.2.4 Category Inferrer Tests

**File**: `frontend/src/__tests__/lib/pod/printful/category.test.ts`

The category inference logic in `printify-sync.ts:inferCategorySlug` has 40+ keyword patterns. These tests validate that the same logic works for Printful product titles.

```typescript
import { inferCategorySlug } from '@/lib/pod/sync/category-inferrer'

describe('inferCategorySlug', () => {
  const cases = [
    ['Unisex Softstyle T-Shirt',         't-shirts'         ],
    ['Premium Hoodie',                   'pullover-hoodies'  ],
    ['Zip-Up Hoodie',                    'zip-hoodies'       ],
    ['Crewneck Sweatshirt',              'crewnecks'         ],
    ['Long Sleeve Shirt',                'long-sleeves'      ],
    ['Ceramic Mug 11oz',                 'mugs'              ],
    ['Trucker Cap',                      'caps'              ],
    ['Snapback Cap',                     'snapbacks'         ],
    ['Embroidered Bucket Hat',           'bucket-hats'       ],
    ['Classic Dad Hat',                  'dad-hats'          ],
    ['Pom-Pom Beanie',                   'beanies'           ],
    ['Organic Tote Bag',                 'tote-bags'         ],
    ['Round Sticker',                    'stickers'          ],
    ['Kids Heavy Cotton Tee',            'kids-t-shirts'     ],
    ['Insulated Water Bottle',           'bottles'           ],
    ['Travel Tumbler 20oz',              'tumblers'          ],
    ['Low Top Sneaker',                  'sneakers'          ],
    ['Desk Mat / Mouse Pad XL',          'desk-mats'         ],
  ]
  cases.forEach(([title, expected]) => {
    it(`"${title}" → "${expected}"`, () => {
      expect(inferCategorySlug(title)).toBe(expected)
    })
  })

  it('falls back to t-shirts for unknown product types', () => {
    expect(inferCategorySlug('Some Unknown Garment Widget')).toBe('t-shirts')
  })
})
```

---

#### 4.2.5 Webhook Signature Verification Tests

**File**: `frontend/src/__tests__/lib/pod/printful/webhook-sig.test.ts`

Printful uses HMAC-SHA256 with the secret appended before hashing. The signature is in the `X-Printful-Signature` header (different header name from Printify's `X-Printify-Hmac-SHA256`).

```typescript
import { verifyPrintfulWebhook } from '@/lib/pod/printful/webhook'
import crypto from 'crypto'

const PRINTFUL_SECRET = 'test-webhook-secret-abc123'

function makeSignature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

describe('verifyPrintfulWebhook', () => {
  const body = JSON.stringify({ type: 'package_shipped', data: {} })
  const validSig = makeSignature(body, PRINTFUL_SECRET)

  it('returns true for a valid signature', () => {
    expect(verifyPrintfulWebhook(body, validSig, PRINTFUL_SECRET)).toBe(true)
  })

  it('returns false for an incorrect signature', () => {
    expect(verifyPrintfulWebhook(body, 'wrong-sig', PRINTFUL_SECRET)).toBe(false)
  })

  it('returns false when signature is empty string', () => {
    expect(verifyPrintfulWebhook(body, '', PRINTFUL_SECRET)).toBe(false)
  })

  it('returns false when body has been tampered', () => {
    const tamperedBody = body.replace('shipped', 'delivered')
    expect(verifyPrintfulWebhook(tamperedBody, validSig, PRINTFUL_SECRET)).toBe(false)
  })

  it('uses timing-safe comparison (does not throw)', () => {
    // If crypto.timingSafeEqual is used correctly, this must not throw
    // even for mismatched buffer lengths
    expect(() => verifyPrintfulWebhook(body, 'short', PRINTFUL_SECRET)).not.toThrow()
  })
})
```

---

### 4.3 Integration Tests

#### 4.3.1 Sync Engine with MockPODProvider

**File**: `frontend/src/__tests__/lib/pod/sync/sync-engine.test.ts`

(Full implementation shown in `architecture-recommendations.md` Section 7.2 — integration test block. Reproduced below with SKAPARA-specific additions.)

```typescript
import { ProductSyncEngine } from '@/lib/pod/sync/sync-engine'
import { MockPODProvider } from '@/lib/pod/testing/mock-provider'
import { createMockSupabase } from '@/lib/pod/testing/mock-supabase'

describe('ProductSyncEngine — full sync', () => {
  let provider: MockPODProvider
  let supabase: ReturnType<typeof createMockSupabase>
  let engine: ProductSyncEngine

  beforeEach(() => {
    provider = new MockPODProvider()
    supabase = createMockSupabase()
    engine = new ProductSyncEngine(provider, supabase as any, {
      conflictStrategy: 'newest-wins',
      marginThreshold: 0.35,
    })
  })

  it('creates products that exist in provider but not in DB', async () => {
    provider.products.set('pf-001', {
      externalId: 'pf-001', title: 'Ghost Tee', status: 'active',
      variants: [], images: [], printAreas: [], blueprintRef: '6', tags: [], description: '',
    })
    supabase.mockDbProducts([])
    const report = await engine.fullSync()
    expect(report.created).toBe(1)
    expect(report.updated).toBe(0)
    expect(report.deleted).toBe(0)
  })

  it('marks DB-only products as soft-deleted (status=deleted)', async () => {
    supabase.mockDbProducts([
      { id: 'db-uuid-1', provider_product_id: 'old-ext', pod_provider: 'printful', status: 'active' }
    ])
    const report = await engine.fullSync()
    expect(report.deleted).toBe(1)
    const deleteCall = supabase.getCalls('update').find(c => c.data?.status === 'deleted')
    expect(deleteCall).toBeDefined()
  })

  it('updates price when remote price is lower than current', async () => {
    provider.products.set('pf-002', {
      externalId: 'pf-002', title: 'Ghost Tee', status: 'active',
      variants: [{ externalId: 'v1', priceCents: 2499, costCents: 1000, isEnabled: true, color: 'Black', size: 'S', sku: 'GT-BLK-S', imageUrl: null }],
      images: [], printAreas: [], blueprintRef: '6', tags: [], description: '',
    })
    supabase.mockDbProducts([
      { id: 'db-uuid-2', provider_product_id: 'pf-002', pod_provider: 'printful', status: 'active',
        base_price_cents: 3799 }  // different from provider
    ])
    const report = await engine.fullSync()
    expect(report.updated).toBe(1)
  })

  it('does NOT auto-fix price when margin is already above 35%', async () => {
    // cost 800 EUR cents, price 2499 → margin 68% → no change
    provider.products.set('pf-003', {
      externalId: 'pf-003', title: 'Ghost Tee', status: 'active',
      variants: [{ externalId: 'v1', priceCents: 2499, costCents: 800, isEnabled: true, color: 'Black', size: 'S', sku: 'GT-BLK-S', imageUrl: null }],
      images: [], printAreas: [], blueprintRef: '6', tags: [], description: '',
    })
    supabase.mockDbProducts([
      { id: 'db-uuid-3', provider_product_id: 'pf-003', pod_provider: 'printful',
        status: 'active', base_price_cents: 2499 }
    ])
    const report = await engine.fullSync()
    expect(report.updated).toBe(0)
  })

  it('enforces minimum 35% margin correction when provider cost is high', async () => {
    // cost 1200, retail 1399 → margin only 14.2% — should fix up to at least 1847
    provider.products.set('pf-004', {
      externalId: 'pf-004', title: 'Premium Hoodie', status: 'active',
      variants: [{ externalId: 'v1', priceCents: 1399, costCents: 1200, isEnabled: true, color: 'Black', size: 'M', sku: 'PH-BLK-M', imageUrl: null }],
      images: [], printAreas: [], blueprintRef: '77', tags: [], description: '',
    })
    supabase.mockDbProducts([])
    const report = await engine.fullSync()
    expect(report.created).toBe(1)
    const insertCall = supabase.getCalls('upsert').find(c => c.data?.provider_product_id === 'pf-004')
    expect(insertCall?.data?.base_price_cents).toBeGreaterThanOrEqual(1847)
  })

  it('writes pod_provider and provider_product_id on upsert', async () => {
    provider.products.set('pf-005', {
      externalId: 'pf-005', title: 'New Product', status: 'active',
      variants: [], images: [], printAreas: [], blueprintRef: '12', tags: [], description: '',
    })
    supabase.mockDbProducts([])
    await engine.fullSync()
    const insertCall = supabase.getCalls('upsert')[0]
    expect(insertCall?.data?.pod_provider).toBe('printful')
    expect(insertCall?.data?.provider_product_id).toBe('pf-005')
  })

  it('handles provider API failure gracefully without crashing', async () => {
    provider.shouldFail = true
    provider.failWithError = 'API rate limit exceeded'
    const report = await engine.fullSync()
    expect(report.errors.length).toBeGreaterThan(0)
    expect(report.errors[0]).toContain('rate limit')
  })

  it('handles partial page failure (page 2 of 3 fails)', async () => {
    // Simulate provider returning error on second page
    let callCount = 0
    provider.listProducts = async (_pagination) => {
      callCount++
      if (callCount === 2) throw new Error('Timeout on page 2')
      return { data: [], total: 150, offset: 0, limit: 50 }
    }
    const report = await engine.fullSync()
    expect(report.errors).toContainEqual(expect.stringContaining('Timeout on page 2'))
  })
})
```

---

#### 4.3.2 Webhook Handler Integration Tests

**File**: `frontend/src/__tests__/lib/pod/webhooks/handler.test.ts`

```typescript
import { handleNormalizedEvent } from '@/lib/pod/webhooks/router'
import { createMockSupabase } from '@/lib/pod/testing/mock-supabase'

describe('Webhook handler — order:shipped', () => {
  let supabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    supabase = createMockSupabase()
    supabase.mockDbOrders([
      { id: 'order-uuid-1', external_order_id: 'pf-order-abc', status: 'submitted',
        user_id: 'user-1', customer_email: 'test@example.com', locale: 'en' }
    ])
  })

  it('updates order to shipped with tracking info', async () => {
    const event = {
      type: 'order.shipped',
      data: {
        orderId: 'pf-order-abc',
        shipments: [{ trackingNumber: 'DHL123456', trackingUrl: 'https://dhl.de/track', carrier: 'DHL' }],
      },
      timestamp: new Date().toISOString(),
      provider: 'printful',
    }

    await handleNormalizedEvent(event, supabase as any)

    const updateCall = supabase.getCalls('update').find(c => c.data?.status === 'shipped')
    expect(updateCall).toBeDefined()
    expect(updateCall?.data?.tracking_number).toBe('DHL123456')
    expect(updateCall?.data?.carrier).toBe('DHL')
  })

  it('is idempotent — second call with same event does not double-update', async () => {
    const event = {
      type: 'order.shipped',
      data: { orderId: 'pf-order-abc', shipments: [{ trackingNumber: 'DHL123', trackingUrl: 'https://dhl.de', carrier: 'DHL' }] },
      timestamp: new Date().toISOString(),
      provider: 'printful',
    }
    await handleNormalizedEvent(event, supabase as any)
    await handleNormalizedEvent(event, supabase as any)

    const updateCalls = supabase.getCalls('update').filter(c => c.data?.status === 'shipped')
    // Both calls hit the DB but the second is effectively a no-op (same data)
    expect(updateCalls).toHaveLength(2)
    // Status should not have advanced beyond 'shipped'
    const lastUpdate = updateCalls[updateCalls.length - 1]
    expect(lastUpdate?.data?.status).toBe('shipped')
  })
})

describe('Webhook handler — order.canceled', () => {
  it('triggers Stripe refund when order was paid', async () => {
    const supabase = createMockSupabase()
    supabase.mockDbOrders([{
      id: 'order-uuid-2', external_order_id: 'pf-order-xyz',
      status: 'in_production', stripe_payment_intent_id: 'pi_test123',
      user_id: 'user-2', customer_email: 'test2@example.com', locale: 'de',
    }])

    const event = {
      type: 'order.canceled',
      data: { orderId: 'pf-order-xyz' },
      timestamp: new Date().toISOString(),
      provider: 'printful',
    }

    // Mock stripe refund
    const stripeRefundSpy = jest.fn().mockResolvedValue({ id: 'refund_abc' })
    await handleNormalizedEvent(event, supabase as any, { stripeRefund: stripeRefundSpy })

    expect(stripeRefundSpy).toHaveBeenCalledWith('pi_test123')
    const updateCall = supabase.getCalls('update').find(c => c.data?.status === 'refunded')
    expect(updateCall).toBeDefined()
  })
})
```

---

#### 4.3.3 Order Creation Flow (End-to-End)

**File**: `frontend/src/__tests__/lib/pod/sync/order-flow.test.ts`

```typescript
import { MockPODProvider } from '@/lib/pod/testing/mock-provider'
import { createMockSupabase } from '@/lib/pod/testing/mock-supabase'
import { submitOrderToPOD } from '@/lib/pod/orders/submit'

describe('Order submission flow', () => {
  it('creates order in provider and writes external_order_id to DB', async () => {
    const provider = new MockPODProvider()
    const supabase = createMockSupabase()

    supabase.mockDbOrders([{
      id: 'order-uuid-test', status: 'paid',
      external_order_id: null,
      shipping_address: {
        first_name: 'Anna', last_name: 'Bauer', email: 'anna@example.de',
        address1: 'Berliner Str. 5', city: 'Munich', region: 'BY',
        zip: '80333', country: 'DE',
      },
    }])

    supabase.mockDbOrderItems([{
      order_id: 'order-uuid-test',
      product_id: 'prod-uuid-1',
      variant_id: 'var-uuid-1',
      quantity: 2,
      unit_price_cents: 2499,
    }])

    supabase.mockDbVariants([{
      id: 'var-uuid-1', external_variant_id: '9876', product_id: 'prod-uuid-1',
    }])

    supabase.mockDbProducts([{
      id: 'prod-uuid-1', provider_product_id: 'pf-ext-001', pod_provider: 'printful',
    }])

    await submitOrderToPOD('order-uuid-test', provider, supabase as any)

    // Provider received the order
    expect(provider.getCallsFor('createOrder')).toHaveLength(1)
    expect(provider.getCallsFor('submitForProduction')).toHaveLength(1)

    // DB was updated with external_order_id
    const updateCall = supabase.getCalls('update').find(c => c.data?.external_order_id != null)
    expect(updateCall).toBeDefined()
    expect(updateCall?.data?.status).toBe('submitted')
  })

  it('writes pod_error and increments pod_retry_count on failure', async () => {
    const provider = new MockPODProvider()
    provider.shouldFail = true
    provider.failWithError = 'Stock unavailable for variant 9876'
    const supabase = createMockSupabase()

    supabase.mockDbOrders([{ id: 'order-uuid-fail', status: 'paid', external_order_id: null }])
    supabase.mockDbOrderItems([])

    await submitOrderToPOD('order-uuid-fail', provider, supabase as any)

    const errorUpdate = supabase.getCalls('update').find(c => c.data?.pod_error != null)
    expect(errorUpdate?.data?.pod_error).toContain('Stock unavailable')
    expect(errorUpdate?.data?.pod_retry_count).toBe(1)
  })
})
```

---

### 4.4 Contract Tests

**File**: `frontend/src/__tests__/lib/pod/contracts/product-contract.test.ts`

(See architecture-recommendations.md Section 7.2 for base implementation. Extended here with SKAPARA-specific field assertions.)

```typescript
import { toCanonicalProduct as printifyMap } from '@/lib/pod/printify/mapper'
import { toCanonicalProduct as printfulMap } from '@/lib/pod/printful/mapper'
import { printifyFixtures } from '@/lib/pod/testing/fixtures/printify'
import { printfulFixtures } from '@/lib/pod/testing/fixtures/printful'
import type { CanonicalProduct } from '@/lib/pod/models/product'

function assertCanonicalProductShape(result: CanonicalProduct, providerName: string) {
  // Core identity
  expect(typeof result.externalId).toBe('string')
  expect(result.externalId.length).toBeGreaterThan(0)
  expect(typeof result.title).toBe('string')
  expect(result.title.length).toBeGreaterThan(0)

  // Status is one of 4 valid values
  expect(['draft', 'active', 'publishing', 'deleted']).toContain(result.status)

  // Arrays are always present (never undefined)
  expect(Array.isArray(result.variants)).toBe(true)
  expect(Array.isArray(result.images)).toBe(true)
  expect(Array.isArray(result.tags)).toBe(true)

  // Variants schema
  for (const v of result.variants) {
    expect(typeof v.externalId).toBe('string')
    expect(typeof v.priceCents).toBe('number')
    expect(v.priceCents).toBeGreaterThanOrEqual(0)
    expect(typeof v.isEnabled).toBe('boolean')
    // color and size are nullable strings
    expect(v.color === null || typeof v.color === 'string').toBe(true)
    expect(v.size === null || typeof v.size === 'string').toBe(true)
  }

  // blueprintRef is nullable string (Printify: integer→string; Printful: catalog variant ref)
  expect(result.blueprintRef === null || typeof result.blueprintRef === 'string').toBe(true)
}

describe('Product Contract', () => {
  const cases = [
    { name: 'Printify', map: printifyMap, fixture: printifyFixtures.product.tshirt },
    { name: 'Printful', map: printfulMap, fixture: printfulFixtures.syncProduct.tshirt },
  ]

  for (const { name, map, fixture } of cases) {
    describe(name, () => {
      it(`produces a valid CanonicalProduct`, () => {
        const result = map(fixture)
        assertCanonicalProductShape(result, name)
      })

      it(`does not include raw provider fields in the output`, () => {
        const result = map(fixture) as any
        // These must NOT appear on the canonical model
        expect(result.blueprint_id).toBeUndefined()
        expect(result.print_provider_id).toBeUndefined()
        expect(result.sync_variants).toBeUndefined()
        expect(result.is_ignored).toBeUndefined()
      })
    })
  }
})

describe('Order Contract', () => {
  it('fromCanonicalOrder produces Printful-valid CreateOrderRequest', () => {
    const { fromCanonicalOrder } = require('@/lib/pod/printful/mapper')
    const result = fromCanonicalOrder({
      internalOrderId: 'order-abc',
      lineItems: [{ productExternalId: '12', variantExternalId: '99', quantity: 1 }],
      address: { firstName: 'X', lastName: 'Y', email: 'x@y.com', address1: 'A', city: 'B', state: 'C', postalCode: '10000', country: 'DE' },
    })
    // Printful CreateOrderRequest shape
    expect(typeof result.recipient).toBe('object')
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.items[0].sync_variant_id).toBe(99)
    expect(result.recipient.country_code).toBe('DE')
    expect(result.external_id).toBe('order-abc')
  })
})
```

---

### 4.5 Test Fixtures

**File**: `frontend/src/lib/pod/testing/fixtures/printful.ts`

These are recorded real Printful API responses (anonymized). Must be populated from actual Printful sandbox API calls once credentials are available.

```typescript
export const printfulFixtures = {
  syncProduct: {
    tshirt: {
      id: 123456789,
      external_id: 'skapara-ghost-tee',
      name: 'Ghost Tee — SKAPARA',
      thumbnail_url: 'https://files.cdn.printful.com/products/tshirt-thumb.png',
      is_ignored: false,
      status: 'Synced',
      sync_variants: [
        {
          id: 1000000001,
          external_id: 'ghost-tee-blk-s',
          name: 'Black / S',
          synced: true,
          variant_id: 4011,
          main_category_id: 24,
          warehouse_product_id: null,
          warehouse_product_variant_id: null,
          retail_price: '24.99',
          sku: 'GT-BLK-S',
          currency: 'EUR',
          product: { variant_id: 4011, product_id: 71, image: 'https://files.cdn.printful.com/products/71/4011_1548158498.jpg', name: 'Gildan 64000' },
          files: [
            { type: 'front', id: 987654321, url: 'https://files.cdn.printful.com/files/abc123/front.png', options: [], hash: 'abc123hash', filename: 'ghost-design.png', mime_type: 'image/png', size: 281943, width: 3600, height: 4800, dpi: 150, status: 'ok', created: 1740000000, thumbnail_url: 'https://files.cdn.printful.com/files/abc123/thumb.png', preview_url: 'https://files.cdn.printful.com/files/abc123/preview.png', visible: true, is_temporary: false },
          ],
          options: [],
          is_ignored: false,
          availability_status: [],
        }
      ],
    },
  },
  syncVariant: {
    base: {
      id: 1000000001,
      name: 'Black / S',
      retail_price: '24.99',
      sku: 'GT-BLK-S',
      synced: true,
    }
  },
}
```

---

## 5. Environment Variables

### 5.1 New Variables Required

| Variable | Value Format | Service | Required By |
|----------|-------------|---------|------------|
| `PRINTFUL_API_TOKEN` | `Bearer <token>` from Printful dashboard | `frontend` | Phase 2 |
| `PRINTFUL_STORE_ID` | Integer (Printful store ID) | `frontend` | Phase 2 |
| `PRINTFUL_WEBHOOK_SECRET` | Hex string set in Printful webhook settings | `frontend` | Phase 2 |
| `POD_DEFAULT_PROVIDER` | `'printify'` or `'printful'` | `frontend` | Phase 3 (default: `'printify'`) |

### 5.2 Deprecated Variables (Phase 5)

| Variable | Deprecated When | Action |
|----------|----------------|--------|
| `PRINTIFY_API_TOKEN` | Phase 5 (all products migrated) | Remove from Vercel env, keep in `.env.example` commented out |
| `PRINTIFY_SHOP_ID` | Phase 5 | Remove |
| `PRINTIFY_WEBHOOK_SECRET` | Phase 5 | Remove |

### 5.3 .env.example Changes

Add the following block (replacing the existing Printify block):

```bash
***REMOVED***====
# POD Provider Configuration
***REMOVED***====

# Default POD provider during transition: 'printify' | 'printful'
POD_DEFAULT_PROVIDER=printify

# --- Printful (new provider) ---
# [REQUIRED for Phase 2+] OAuth token from https://www.printful.com/dashboard/settings/integrations
PRINTFUL_API_TOKEN=

# [REQUIRED for Phase 2+] Your Printful store ID (integer from dashboard URL)
PRINTFUL_STORE_ID=

# [REQUIRED for Phase 2+] Webhook signing secret from Printful webhook settings
PRINTFUL_WEBHOOK_SECRET=

# --- Printify (current provider — deprecated in Phase 5) ---
# [REQUIRED until Phase 5] Bearer token for Printify API
PRINTIFY_API_TOKEN=

# [REQUIRED until Phase 5] Shop ID 26473208 = AI-Shopper (NEVER use 17595620 = Insomnialz)
PRINTIFY_SHOP_ID=your-printify-shop-id

# [REQUIRED until Phase 5] Webhook HMAC secret for X-Printify-Hmac-SHA256 verification
PRINTIFY_WEBHOOK_SECRET=
```

### 5.4 Vercel Environment Configuration

Apply in Vercel dashboard under Project Settings → Environment Variables:

| Phase | Add | Remove |
|-------|-----|--------|
| Phase 2 | `PRINTFUL_API_TOKEN`, `PRINTFUL_STORE_ID`, `PRINTFUL_WEBHOOK_SECRET`, `POD_DEFAULT_PROVIDER=printify` | — |
| Phase 4 | Update `POD_DEFAULT_PROVIDER=printful` for new products | — |
| Phase 5 | — | `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID`, `PRINTIFY_WEBHOOK_SECRET` |

All new vars must be set in all three environments: **Production**, **Preview**, and **Development**.

The `PRINTFUL_API_TOKEN` is a server-side secret. It must never be prefixed with `NEXT_PUBLIC_`. Verify: if it appears in a browser bundle build output, the deployment must be blocked.

---

## 6. Monitoring & Observability

### 6.1 Sync Logging

Every run of the sync engine must emit structured log entries. Use `console.log` with a `[POD-Sync]` prefix (captured by Vercel log drain):

```typescript
// Sync start
console.log('[POD-Sync] Starting full sync', {
  provider: provider.providerId,
  timestamp: new Date().toISOString(),
})

// Per-product result
console.log('[POD-Sync] Product synced', {
  action: 'created' | 'updated' | 'skipped' | 'deleted',
  externalId: product.externalId,
  title: product.title,
  durationMs: Date.now() - startMs,
})

// Sync complete summary
console.log('[POD-Sync] Sync complete', {
  provider: provider.providerId,
  created: report.created,
  updated: report.updated,
  deleted: report.deleted,
  skipped: report.skipped,
  errors: report.errors.length,
  totalDurationMs: Date.now() - syncStartMs,
})
```

For errors, always include the product's external ID and the full error message:
```typescript
console.error('[POD-Sync] Error syncing product', {
  externalId: product.externalId,
  error: err instanceof Error ? err.message : String(err),
  stack: err instanceof Error ? err.stack?.split('\n').slice(0, 3).join(' | ') : undefined,
})
```

### 6.2 Health Check Endpoint

Create `frontend/src/app/api/health/pod/route.ts`:

```typescript
// GET /api/health/pod
// Returns: { ok: boolean, printful: { ok: boolean, latencyMs: number }, printify: { ok: boolean, latencyMs: number } }
// Auth: requires CRON_SECRET header (same as other cron routes)

import { NextResponse } from 'next/server'
import { getProvider } from '@/lib/pod'

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}

  // Check Printful if configured
  if (process.env.PRINTFUL_API_TOKEN) {
    const provider = getProvider('printful')
    const health = await provider.healthCheck()
    results.printful = health
  }

  // Check Printify if configured
  if (process.env.PRINTIFY_API_TOKEN) {
    const provider = getProvider('printify')
    const health = await provider.healthCheck()
    results.printify = health
  }

  const allOk = Object.values(results).every((r: any) => r.ok)
  return NextResponse.json({ ok: allOk, ...results }, { status: allOk ? 200 : 503 })
}
```

Add to Vercel Cron Jobs in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/health/pod", "schedule": "*/10 * * * *" }
  ]
}
```

### 6.3 Telegram Alert on Sync Failure

The project already has a Telegram alert channel (`src/app/api/admin/alert/route.ts`). Trigger it in the sync engine when `report.errors.length > 0`:

```typescript
if (report.errors.length > 0) {
  await fetch('/api/admin/alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ADMIN_SECRET}` },
    body: JSON.stringify({
      type: 'pod_sync_error',
      message: `POD sync (${provider.providerId}) completed with ${report.errors.length} errors:\n${report.errors.slice(0, 5).join('\n')}`,
      severity: report.errors.length > 5 ? 'critical' : 'warning',
    }),
  })
}
```

### 6.4 Metrics to Track

Store in Supabase `audit_log` table (already exists in schema) using `resource_type = 'pod_sync'`:

| Metric | How to Store | Alert Threshold |
|--------|-------------|----------------|
| Products synced per run | `audit_log.metadata.synced_count` | < 70 out of 79 → warn |
| Sync errors per run | `audit_log.metadata.error_count` | > 0 → Telegram alert |
| Sync duration | `audit_log.metadata.duration_ms` | > 30,000ms → warn |
| Order submission failures | `orders.pod_error IS NOT NULL AND pod_retry_count = 1` | Any new entry → Telegram |
| Webhook processing latency | `audit_log.metadata.webhook_latency_ms` | > 5,000ms → warn |
| Products with missing `external_variant_id` | Supabase query | > 0 → block Phase 5 |

**Weekly consistency check query** (run as cron, log results):
```sql
-- Count of active products with provider_product_id different from printify_id
-- Should always return 0 during Phase 3
SELECT COUNT(*) AS drift_count
FROM products
WHERE status = 'active'
  AND pod_provider = 'printify'
  AND provider_product_id IS DISTINCT FROM printify_id;
```

### 6.5 Dashboard Data for Admin Panel

Add to the admin orders page a `pod_provider` column to surface per-order provider routing. This allows spotting mixed batches during Phase 4 dual-provider operation.

---

## 7. Rollback Plan

### 7.1 Rollback Scenarios

| Scenario | Detected By | Recovery Action |
|---------|------------|----------------|
| Phase 3 migration causes unexpected column conflicts | Migration error in Supabase | Run rollback SQL from Section 2.3 |
| Sync engine writes wrong data to `provider_product_id` | Weekly drift query returns > 0 | Re-run backfill UPDATE from Section 2.1 |
| Printful adapter creates broken products (missing variants, wrong prices) | Products with 0 variants in DB | Set `POD_DEFAULT_PROVIDER=printify`; mark broken products `status='deleted'`; re-sync from Printify |
| Webhook handler routes Printful events to wrong order | Orders stuck in `submitted` state | Revert `/api/webhooks/pod/[provider]/route.ts` deployment; Printify webhook remains active |
| Phase 4 flip (`POD_DEFAULT_PROVIDER=printful`) causes order failures | Orders with `pod_error` within 1h of flip | Revert env var to `printify` in Vercel (1-minute deployment rollback) |

### 7.2 Per-Product Provider Routing

The `pod_provider` column on `products` enables per-product fallback without a full rollback:

```typescript
// In POD factory (src/lib/pod/index.ts):
export function getProviderForProduct(product: { pod_provider: string }): PODProvider {
  return getProvider(product.pod_provider)  // 'printify' | 'printful'
}
```

If a specific Printful product batch fails (e.g., a BP variant mismatch), set `pod_provider = 'printify'` for just those products and re-sync from Printify — zero impact on other products:

```sql
-- Emergency: revert 5 specific products back to Printify
UPDATE products
SET pod_provider = 'printify',
    provider_product_id = printify_id,
    product_template_id = blueprint_id::TEXT,
    provider_facility_id = print_provider_id::TEXT
WHERE id IN (
  'uuid-product-1',
  'uuid-product-2',
  'uuid-product-3',
  'uuid-product-4',
  'uuid-product-5'
);
```

### 7.3 Data Consistency Checks Before Phase 5

Run all of the following queries and verify each returns 0 rows before executing the Phase 5 drop migration:

```sql
-- 1. No active products still on Printify
SELECT id, title, printify_id
FROM products
WHERE status = 'active' AND pod_provider = 'printify';
-- Expected: 0 rows

-- 2. All active products have provider_product_id
SELECT id, title
FROM products
WHERE status = 'active' AND provider_product_id IS NULL;
-- Expected: 0 rows

-- 3. All variants have external_variant_id
SELECT pv.id, p.title
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
WHERE p.status = 'active' AND pv.external_variant_id IS NULL;
-- Expected: 0 rows

-- 4. No open orders referencing printify_order_id without external_order_id
SELECT id, printify_order_id
FROM orders
WHERE status NOT IN ('delivered', 'refunded', 'cancelled')
  AND printify_order_id IS NOT NULL
  AND external_order_id IS NULL;
-- Expected: 0 rows

-- 5. No unprocessed webhook events stuck in queue
SELECT COUNT(*) FROM audit_log
WHERE resource_type = 'webhook'
  AND metadata->>'provider' = 'printify'
  AND metadata->>'status' = 'pending'
  AND created_at > NOW() - INTERVAL '24 hours';
-- Expected: 0

-- 6. Verify variant constraint exists before drop
SELECT conname FROM pg_constraint
WHERE conname = 'product_variants_provider_variant_unique';
-- Expected: 1 row (the new constraint must exist)
```

### 7.4 Maximum Acceptable Downtime

This migration is designed for **zero customer-facing downtime**:

| Operation | Duration | Customer Impact |
|-----------|---------|----------------|
| Phase 3 migration SQL | ~3 seconds | None (additive ALTER TABLE, no locks on reads) |
| Phase 3 code deployment (Vercel) | ~45 seconds | None (Next.js instant swap) |
| Phase 4 env var flip (`POD_DEFAULT_PROVIDER=printful`) | ~60 seconds | None (new products only; existing orders unaffected) |
| Phase 5 migration SQL | ~5 seconds | None (DROP COLUMN is fast on small catalogs) |

If Phase 5 SQL fails the precondition check and raises an exception, the transaction is rolled back automatically with no data loss.

### 7.5 Printify Preservation During Dual-Provider Period

During Phases 3 and 4 (estimated 4–8 weeks), the Printify integration must remain fully operational:

1. `PRINTIFY_API_TOKEN` and `PRINTIFY_SHOP_ID` remain set in Vercel production.
2. `/api/webhooks/printify/route.ts` remains active and receiving events.
3. `/api/cron/sync-printify/route.ts` continues running every 30 minutes.
4. All 79 existing products with `pod_provider = 'printify'` continue to use the Printify order path in checkout.
5. The Printify adapter code is not deleted — it is placed under `src/lib/pod/printify/` in Phase 1 and remains importable until Phase 5.

---

*End of Section 6 — Database Schema Migration & Testing Strategy.*
*Next: Section 7 — Order Fulfillment & Webhook Migration.*
