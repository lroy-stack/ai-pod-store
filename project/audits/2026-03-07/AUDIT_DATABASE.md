# Database Audit -- SKAPARA POD AI Store

**Date**: 2026-03-07
**Database**: PostgreSQL 16 + pgvector (Supabase Cloud)
**Host**: db.your-project.supabase.co

---

## Executive Summary

| Metric | Value |
|---|---|
| Total tables | 99 (including 21 partition tables) |
| Unique base tables | 78 |
| Tables with RLS enabled | 97/99 (98%) |
| Tables with RLS but NO policies | 35 (14 non-partition) |
| Total RLS policies | ~160 |
| Total indexes | ~200+ |
| FK columns missing indexes | 32 |
| Tables with `updated_at` but no trigger | 17 |
| Migration files | 299 |
| Max connections | 60 |
| Active connections | 12 |
| Total DB size | ~8 MB (small, development stage) |

### Scorecard

| Category | Status | Issues |
|---|---|---|
| Schema Design | WARN | 9 tables with user_id but no FK to users |
| RLS Coverage | CRITICAL | 14 non-partition tables with RLS enabled but 0 policies; 2 tables with RLS disabled |
| Indexes | WARN | 32 FK columns without indexes; 30+ unused indexes |
| Data Integrity | PASS | 0 orphaned records found |
| Triggers | WARN | 17 tables missing updated_at triggers |
| Storage | CRITICAL | 0 RLS policies on storage buckets; designs bucket has no mime/size limits |
| Sensitive Data | CRITICAL | password_hash exposed via SELECT policy on users table |
| Performance | PASS | Autovacuum active, small dataset, HNSW index on vectors |

**Total checks**: 11 categories
**PASS**: 3 | **WARN**: 4 | **CRITICAL**: 4

---

## 1. Schema Inventory

### 1.1 Table Counts & Sizes (Top 20 by size)

| Table | Rows | Total Size |
|---|---|---|
| agent_events_y2026m02 | 2,755 | 1,448 kB |
| product_variants | 913 | 1,216 kB |
| products | 27 | 976 kB |
| documents | 78 | 744 kB |
| store_themes | 12 | 256 kB |
| orders | 23 | 240 kB |
| audit_log_y2026m02 | 171 | 176 kB |
| cart_items | 0 | 160 kB |
| users | 24 | 160 kB |
| audit_log_y2026m03 | 27 | 152 kB |
| product_reviews | 0 | 144 kB |
| designs | 80 | 136 kB |
| categories | 61 | 128 kB |
| tenants | 2 | 128 kB |
| messages_y2026m02 | 58 | 128 kB |
| product_beliefs | 27 | 120 kB |
| notifications | 60 | 112 kB |
| error_logs | 2 | 96 kB |
| telegram_messages | 2 | 96 kB |
| agent_daily_costs | 11 | 88 kB |

### 1.2 Primary Key Types

- **UUID (gen_random_uuid)**: 80+ tables -- GOOD, consistent
- **BIGINT (serial/sequence)**: ab_events, agent_events, association_rules, demand_forecasts, marketing_content, newsletter_campaigns, newsletter_subscribers, price_history, system_events -- acceptable for append-only/high-volume tables
- **INTEGER**: admin_settings (id=1, singleton) -- acceptable

**Verdict**: PASS -- UUID usage is consistent for entity tables; BIGINT used appropriately for event/log tables.

### 1.3 Empty & Unreferenced Tables (32 tables)

These tables have 0 rows AND no other table references them via FK:

| Table | Assessment |
|---|---|
| abandoned_carts | Feature not yet active |
| association_rules | ML feature, not yet populated |
| blog_posts | CMS feature, not yet used |
| customer_segments | Marketing feature |
| demand_forecasts | ML feature |
| design_clipart | Design tool feature |
| design_templates_library | Design tool feature |
| drip_queue | Email drip campaigns |
| marketing_content | Marketing feature |
| price_history | Pricing pipeline |
| product_daily_metrics | Analytics pipeline |
| product_labels | Product tagging |
| product_lifecycle_decisions | Analytics pipeline |
| push_subscriptions | Push notifications |
| referrals | Referral system |
| returns | Returns system |
| shipping_addresses | Checkout flow |
| system_events | System monitoring |
| tenant_configs | Multi-tenancy config |
| tenant_members | Multi-tenancy membership |
| user_design_assets | Design tool |
| whatsapp_messages | Messaging channel |
| wishlist_items | Wishlist feature |
| processed_events | Webhook dedup |
| messaging_conversations | Messaging system |
| analytics_events | Analytics |

**Severity**: P3 (informational) -- Most are features not yet in production. None are orphan tables; they serve planned features.

### 1.4 Partitioned Tables

Three parent tables use monthly partitioning (Feb-Aug 2026):
- `agent_events` -> 7 partitions
- `audit_log` -> 7 partitions
- `messages` -> 7 partitions

**Verdict**: PASS -- Good use of partitioning for high-volume event/log data.

---

## 2. Row-Level Security (RLS)

### 2.1 RLS Activation

| Status | Count |
|---|---|
| RLS enabled | 97 |
| RLS disabled | 2 |

**Tables with RLS DISABLED** (CRITICAL):
1. `design_clipart` -- public clipart library, arguably OK for read-only
2. `design_templates_library` -- public templates, arguably OK for read-only

**Severity**: P1 -- Even if intended as public read, RLS should be enabled with explicit public SELECT policies to prevent accidental writes via anon/authenticated roles.

**Fix**:
```sql
ALTER TABLE design_clipart ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read clipart" ON design_clipart FOR SELECT USING (true);

ALTER TABLE design_templates_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read templates" ON design_templates_library FOR SELECT USING (true);
```

### 2.2 Tables with RLS Enabled but ZERO Policies (CRITICAL)

14 non-partition tables have RLS enabled but no policies, meaning **all access is denied** (including legitimate queries):

| Table | Impact | Severity |
|---|---|---|
| `admin_roles` | Admin role definitions inaccessible | P1 |
| `association_rules` | ML rules inaccessible | P3 |
| `customer_segments` | Segments inaccessible | P3 |
| `demand_forecasts` | Forecasts inaccessible | P3 |
| `documents` | Search documents inaccessible to non-service-role | P1 |
| `drip_queue` | Drip emails inaccessible | P2 |
| `heartbeat_events` | Health checks inaccessible | P3 |
| `marketing_content` | Marketing content inaccessible | P3 |
| `newsletter_campaigns` | Campaign data inaccessible | P2 |
| `price_history` | Price history inaccessible | P3 |
| `processed_events` | Event dedup inaccessible | P3 |
| `soul_change_log` | Agent logs inaccessible | P3 |
| `system_events` | System events inaccessible | P3 |
| `user_roles` | User role assignments inaccessible | P1 |

**Note**: These tables are only accessible via service_role (which bypasses RLS). If any frontend/authenticated query hits them, it will return empty results.

**Severity**: P1 for `admin_roles`, `documents`, `user_roles` -- these are referenced by application code.

**Fix** (example for documents):
```sql
CREATE POLICY "Public read documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Service role manages documents" ON documents FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');
```

### 2.3 Partition tables with no policies (21 tables)

All 21 partition tables (`agent_events_y2026m*`, `audit_log_y2026m*`, `messages_y2026m*`) have RLS enabled but no policies. Partitions inherit policies from the parent table in PostgreSQL 16, so this is **acceptable** if the parent has policies.

- `agent_events` parent: has ALL policy (service_role) -- OK
- `audit_log` parent: has ALL policy (service_role) -- OK
- `messages` parent: has SELECT/INSERT/ALL policies -- OK

**Verdict**: PASS -- Partition inheritance works correctly.

### 2.4 RLS Coverage Matrix (User-Scoped Tables)

| Table | SELECT | INSERT | UPDATE | DELETE | Status |
|---|---|---|---|---|---|
| orders | user_id=auth.uid() | user_id=auth.uid() | -- | -- | WARN: no UPDATE/DELETE |
| cart_items | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | PASS |
| conversations | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | -- | PASS |
| messages | conv.user_id=auth.uid() | conv.user_id=auth.uid() | -- | -- | PASS |
| notifications | user_id=auth.uid() | -- | user_id=auth.uid() | -- | PASS |
| wishlists | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | PASS |
| wishlist_items | via wishlists FK | via wishlists FK | via wishlists FK | via wishlists FK | PASS |
| shipping_addresses | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | PASS |
| user_consents | user_id=auth.uid() | user_id=auth.uid() | -- | -- | PASS |
| credit_transactions | user_id=auth.uid() | -- (service_role) | -- | -- | PASS |
| product_reviews | true (all visible) | user_id=auth.uid() | user_id=auth.uid() | -- | PASS |
| push_subscriptions | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | PASS |
| return_requests | user_id=auth.uid() | user_id=auth.uid() | user_id=auth.uid() | -- | PASS |
| users | id=auth.uid() | -- | id=auth.uid() | -- | PASS |

### 2.5 Overly Permissive Policies (CRITICAL)

**39 policies use `qual = true` or `with_check = true`**. Key concerns:

| Table | Policy | Risk | Severity |
|---|---|---|---|
| `error_logs` | anon_can_select_errors / anon_can_insert_errors | Anon users can read ALL error logs AND insert fake errors | P0 |
| `store_themes` | Authenticated users can insert themes / delete custom themes | ANY authenticated user can create/delete themes | P1 |
| `legal_page_versions` | Public can read | All versions public -- acceptable | P3 |
| `product_reviews` | Users can view all reviews | Public read -- acceptable by design | P3 |
| `seo_meta_tags` | Publicly readable | Public read -- acceptable | P3 |
| `product_variants` | Public read | Public read -- acceptable | P3 |
| `products` | Public read (SELECT only) | Public read -- acceptable | P3 |

**P0 -- error_logs anon access**:
```sql
-- Fix: Remove anon access, restrict to authenticated + service_role
DROP POLICY "anon_can_select_errors" ON error_logs;
DROP POLICY "anon_can_insert_errors" ON error_logs;
```

**P1 -- store_themes any authenticated user can INSERT/DELETE**:
```sql
-- Fix: Restrict to admin or service_role
DROP POLICY "Authenticated users can insert themes" ON store_themes;
DROP POLICY "Authenticated users can delete custom themes" ON store_themes;
CREATE POLICY "Admin can manage themes" ON store_themes FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'));
```

### 2.6 Cross-Tenant Data Leakage Analysis

- **Orders**: SELECT policy includes `get_current_tenant_id()` check -- PASS
- **Conversations**: SELECT policy includes tenant_id check -- PASS
- **Cart items**: No tenant_id check, but scoped by user_id -- acceptable (user can only be in one tenant at a time)
- **Messages**: Scoped via conversation -> user_id chain -- PASS
- **Products/Categories**: Public read, no tenant isolation -- by design (single-store)

**Verdict**: PASS -- Multi-tenancy is partially implemented with `get_current_tenant_id()` RPC.

### 2.7 Password Hash Exposure (CRITICAL)

The `users` table SELECT policy (`Users can view own profile`) allows `auth.uid() = id`, which means a user can read **all columns** of their own row, **including `password_hash`**.

**Severity**: P0

**Fix**: Create a view or use column-level grants:
```sql
-- Option 1: Revoke column-level SELECT on password_hash
REVOKE SELECT (password_hash) ON users FROM authenticated;
REVOKE SELECT (password_hash) ON users FROM anon;

-- Option 2 (better): Create a safe view and point app queries there
CREATE VIEW public.user_profiles AS
  SELECT id, email, name, role, avatar_url, locale, currency, phone,
         email_verified, notification_preferences, preferences,
         created_at, updated_at, tier, credit_balance,
         stripe_customer_id, subscription_status, referral_code, tags, account_status
  FROM users;
```

---

## 3. Indexes

### 3.1 FK Columns Missing Indexes (32)

Missing indexes on FK columns cause slow JOINs and CASCADE deletes:

| Table | Column | Severity |
|---|---|---|
| `order_items` | `product_id` | P1 |
| `order_items` | `variant_id` | P1 |
| `designs` | `product_id` | P2 |
| `designs` | `parent_design_id` | P3 |
| `designs` | `moderated_by` | P3 |
| `designs` | `tenant_id` | P3 |
| `cart_items` | `personalization_id` | P2 |
| `cart_items` | `tenant_id` | P3 |
| `blog_posts` | `author_id` | P3 |
| `ai_generations` | `parent_generation_id` | P3 |
| `ai_generations` | `session_id` | P3 |
| `analytics_events` | `tenant_id` | P3 |
| `analytics_events` | `user_id` | P3 |
| `design_compositions` | `product_id` | P3 |
| `design_compositions` | `session_id` | P3 |
| `design_sessions` | `product_id` | P3 |
| `marketing_content` | `product_id` | P3 |
| `newsletter_subscribers` | `user_id` | P3 |
| `products` | `deleted_by` | P3 |
| `products` | `tenant_id` | P2 |
| `orders` | `tenant_id` | P2 |
| `users` | `tenant_id` | P2 |
| `categories` | `tenant_id` | P3 |
| `conversations` | `tenant_id` | P3 |
| `return_requests` | `approved_by` | P3 |
| `returns` | `resolved_by` | P3 |
| `translations` | `reviewed_by` | P3 |
| `user_messaging_links` | `user_id` | P3 |
| `user_roles` | `assigned_by` | P3 |
| `wishlists` | `tenant_id` | P3 |
| `ab_events` | `user_id` | P3 |
| `product_reviews` | `moderated_by` | P3 |

**Priority fix** (P1):
```sql
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);
```

**Priority fix** (P2 -- tenant columns):
```sql
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_designs_product_id ON designs(product_id);
CREATE INDEX idx_cart_items_personalization_id ON cart_items(personalization_id);
```

### 3.2 Unused Indexes (30+ with 0 scans)

Top unused indexes by size:

| Table | Index | Size | Note |
|---|---|---|---|
| documents | idx_documents_embedding (HNSW) | 264 kB | Vector search not yet used in production |
| products | idx_products_product_details (GIN) | 112 kB | JSONB index, may be premature |
| agent_events_y2026m02 | session_id_idx | 48 kB | May be needed once queried |
| documents | idx_documents_content_fts (GIN) | 40 kB | Full-text search not yet used |

**Severity**: P3 -- Small database, unused indexes cost negligible storage. Monitor after production launch.

### 3.3 pgvector Index

```
idx_documents_embedding ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m='16', ef_construction='64')
```

**Verdict**: PASS -- HNSW is the recommended index type for pgvector. Parameters (m=16, ef=64) are reasonable defaults.

---

## 4. Data Integrity

### 4.1 Foreign Key Constraints

FK constraints are properly defined with appropriate cascade behavior:

| Relationship | Delete Rule | Assessment |
|---|---|---|
| orders.user_id -> users | SET NULL | PASS (preserve order history) |
| cart_items.user_id -> users | CASCADE | PASS (delete cart with user) |
| conversations.user_id -> users | CASCADE | PASS |
| wishlists.user_id -> users | CASCADE | PASS |
| order_items -> orders | CASCADE | PASS |
| product_variants -> products | CASCADE | PASS |
| agent_events -> agent_sessions | CASCADE | PASS |
| ab_events.user_id -> users | SET NULL | PASS |
| abandoned_carts.user_id -> users | CASCADE | PASS |

### 4.2 Missing FK Constraints

9 tables have `user_id` column but **no FK to users table**:

| Table | Severity |
|---|---|
| `ai_generations` | P2 |
| `analytics_events` | P3 |
| `design_compositions` | P2 |
| `design_sessions` | P2 |
| `newsletter_subscribers` | P3 |
| `personalizations` | P2 |
| `telegram_messages` | P3 |
| `tenant_members` | P2 |
| `user_design_assets` | P2 |

**Fix** (example):
```sql
ALTER TABLE ai_generations ADD CONSTRAINT fk_ai_generations_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

### 4.3 user_id Nullable on Critical Tables

| Table | user_id Nullable | Assessment |
|---|---|---|
| orders | YES | WARN -- guest checkout support? Should be documented |
| cart_items | YES | WARN -- anonymous cart? |
| conversations | YES | WARN -- should be NOT NULL |
| return_requests | YES | WARN -- should reference order owner |

**Severity**: P2 -- Nullable user_id on `conversations` and `cart_items` weakens RLS guarantees. If user_id is NULL, the RLS policy `auth.uid() = user_id` evaluates to FALSE, making the row invisible to everyone except service_role.

### 4.4 Orphaned Records

| Check | Count |
|---|---|
| Orders with invalid user_id | 0 |
| Cart items with invalid user_id | 0 |
| Conversations with invalid user_id | 0 |
| Notifications with invalid user_id | 0 |
| Product reviews with invalid user_id | 0 |
| Wishlists with invalid user_id | 0 |
| Order items with invalid order_id | 0 |
| Product variants with invalid product_id | 0 |

**Verdict**: PASS -- No orphaned records found.

### 4.5 Missing CHECK Constraints on Price Columns

31 price/money columns found. Only 14 have CHECK constraints, and **none enforce >= 0**:

The existing CHECK constraints are only NOT NULL checks. No `>= 0` guard exists on:
- `orders.total_cents`
- `order_items.unit_price_cents`, `order_items.cost_cents`
- `products.base_price_cents`, `products.cost_cents`
- `product_variants.price_cents`, `product_variants.cost_cents`
- All `*_amount` and `*_cents` columns

**Severity**: P1 -- Negative prices could cause financial errors.

**Fix**:
```sql
ALTER TABLE products ADD CONSTRAINT chk_products_base_price_positive
  CHECK (base_price_cents >= 0);
ALTER TABLE products ADD CONSTRAINT chk_products_cost_positive
  CHECK (cost_cents IS NULL OR cost_cents >= 0);
ALTER TABLE product_variants ADD CONSTRAINT chk_variants_price_positive
  CHECK (price_cents >= 0);
ALTER TABLE product_variants ADD CONSTRAINT chk_variants_cost_positive
  CHECK (cost_cents IS NULL OR cost_cents >= 0);
ALTER TABLE orders ADD CONSTRAINT chk_orders_total_positive
  CHECK (total_cents >= 0);
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_price_positive
  CHECK (unit_price_cents >= 0);
```

---

## 5. Migrations

### 5.1 Overview

| Metric | Value |
|---|---|
| Total migration files | 299 |
| Date range | 2026-02-13 to 2026-03+ |
| Naming convention | `YYYYMMDDHHMMSS_description.sql` |
| Files with destructive ops | 10 |

### 5.2 Destructive Migrations

| Migration | Destructive Ops | Risk |
|---|---|---|
| `20260223215719_fix_partitioned_tables_nullable_session.sql` | 11 DROP statements | High -- partition table rebuilds |
| `20260223222141_partition_tables_valid_fk_only.sql` | 3 DROPs | Medium |
| `20260224112001_store_themes_per_tenant_unique.sql` | 2 DROPs | Low |
| `20260222300000_variant_not_null.sql` | 2 DROPs | Low |
| `20260223223612_repair_partition_swap_damage.sql` | 1 DROP | Medium |
| `20260223215055_upgrade_vector_index_to_hnsw.sql` | 1 DROP INDEX | Low |
| `20260214132203_drop_old_search_documents.sql` | 1 DROP | Low |
| Various search function fixes | DROP FUNCTION | Low |

**Severity**: P2 -- Destructive migrations exist but are historical fixes. No reversibility mechanism (no down migrations).

### 5.3 Migration Quality

- **Naming**: Consistent `YYYYMMDDHHMMSS_snake_case.sql` -- PASS
- **Idempotency**: Most use `IF NOT EXISTS` / `IF EXISTS` -- PASS
- **Reversibility**: No down migrations exist -- WARN (P3)
- **Test data in migrations**: Several migrations insert test/mock data (`add_mock_products`, `insert_test_order`, etc.) -- WARN (P2, should be seeds not migrations)

---

## 6. Functions & RPCs

### 6.1 Custom Functions (excluding pgvector internals)

| Function | Type | Purpose |
|---|---|---|
| `add_credits` | RPC | Add credits to user account |
| `consume_credit_atomic` | RPC | Atomic credit consumption |
| `increment_usage` / `increment_usage_by` | RPC | Usage tracking |
| `decrement_usage` | RPC | Usage decrement |
| `migrate_usage` | RPC | Usage migration |
| `issue_refund_atomic` | RPC | Atomic refund processing |
| `compute_daily_product_metrics` | RPC | Analytics computation |
| `compute_portfolio_metrics` | RPC | Portfolio analytics |
| `update_product_belief` | RPC | Bayesian product beliefs |
| `search_documents` | RPC | Vector similarity search |
| `hybrid_search_documents` | RPC | Hybrid vector + FTS search |
| `handle_new_user` | Trigger fn | Auto-create user profile |
| `create_product_belief` | Trigger fn | Auto-create belief on product insert |
| `trigger_update_product_rating` | Trigger fn | Recalculate product rating |
| `calculate_cron_duration` | Trigger fn | Track cron job duration |
| `try_cron_lock` | RPC | Cron job locking |
| `get_current_tenant_id` | RPC | Multi-tenancy context |
| `get_user_roles` | RPC | Role lookup |
| `has_permission` | RPC | Permission check |
| `verify_partitioning` | RPC | Partition health check |
| `test_partition_pruning` | RPC | Test utility |
| `test_try_cron_lock_behavior` | RPC | Test utility |
| 10x `update_*_updated_at` | Trigger fn | Auto-update timestamps |

### 6.2 SQL Injection Check

**0 functions use dynamic SQL (EXECUTE statement)** -- PASS

All functions use parameterized queries or static SQL.

### 6.3 Test Functions in Production

`test_partition_pruning` and `test_try_cron_lock_behavior` are test utilities that should not exist in production.

**Severity**: P3

**Fix**:
```sql
DROP FUNCTION IF EXISTS test_partition_pruning();
DROP FUNCTION IF EXISTS test_try_cron_lock_behavior();
```

---

## 7. Triggers

### 7.1 Active Triggers (21)

| Table | Trigger | Event | Function |
|---|---|---|---|
| abandoned_carts | updated_at | BEFORE UPDATE | update_abandoned_carts_updated_at |
| blog_posts | updated_at | BEFORE UPDATE | update_blog_posts_updated_at |
| cart_items | updated_at (x2) | BEFORE UPDATE | update_cart_items_updated_at + update_updated_at_column |
| conversations | updated_at | BEFORE UPDATE | update_updated_at_column |
| cron_runs | calculate_duration | BEFORE UPDATE | calculate_cron_duration |
| documents | updated_at | BEFORE UPDATE | update_updated_at_column |
| error_logs | updated_at | BEFORE UPDATE | update_error_logs_updated_at |
| legal_pages | updated_at | BEFORE UPDATE | update_legal_pages_updated_at |
| legal_settings | updated_at | BEFORE UPDATE | update_legal_settings_updated_at |
| orders | updated_at | BEFORE UPDATE | update_updated_at_column |
| product_reviews | after_review_change | AFTER I/U/D | trigger_update_product_rating |
| products | updated_at | BEFORE UPDATE | update_updated_at_column |
| products | create_belief | AFTER INSERT | create_product_belief |
| return_requests | updated_at | BEFORE UPDATE | update_return_requests_updated_at |
| returns | updated_at | BEFORE UPDATE | update_returns_updated_at |
| store_themes | updated_at | BEFORE UPDATE | update_store_themes_updated_at |
| tenants | updated_at | BEFORE UPDATE | update_tenant_updated_at |
| users | updated_at | BEFORE UPDATE | update_updated_at_column |

### 7.2 Duplicate Trigger on cart_items

`cart_items` has TWO updated_at triggers (`cart_items_updated_at` and `update_cart_items_updated_at`), both firing BEFORE UPDATE. This is harmless but wasteful.

**Severity**: P3

**Fix**:
```sql
DROP TRIGGER IF EXISTS cart_items_updated_at ON cart_items;
-- Keep update_cart_items_updated_at
```

### 7.3 Tables with `updated_at` but NO Trigger (17)

| Table | Severity |
|---|---|
| admin_roles | P3 |
| admin_settings | P3 |
| agent_daily_costs | P3 |
| brand_config | P2 |
| categories | P2 |
| coupons | P2 |
| customer_segments | P3 |
| design_compositions | P3 |
| design_sessions | P3 |
| messaging_channels | P3 |
| personalizations | P2 |
| product_beliefs | P3 |
| seo_meta_tags | P3 |
| shipping_zones | P3 |
| tenant_configs | P3 |
| translations | P3 |
| user_usage | P3 |

**Fix** (batch):
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all missing tables
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'admin_roles','admin_settings','agent_daily_costs','brand_config',
        'categories','coupons','customer_segments','design_compositions',
        'design_sessions','messaging_channels','personalizations',
        'product_beliefs','seo_meta_tags','shipping_zones','tenant_configs',
        'translations','user_usage'
    ]) LOOP
        EXECUTE format(
            'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
            tbl, tbl
        );
    END LOOP;
END $$;
```

---

## 8. Storage

### 8.1 Buckets

| Bucket | Public | Mime Types | Size Limit |
|---|---|---|---|
| `designs` | YES | None (any file) | None |
| `product-images` | YES | image/jpeg, image/png, image/webp | 5 MB |

### 8.2 Storage RLS Policies

**0 policies on storage.objects** -- CRITICAL

Both buckets are public and have no RLS policies on `storage.objects`, meaning:
- Anyone can upload files to both buckets
- Anyone can delete/overwrite files
- The `designs` bucket accepts any file type with no size limit

**Severity**: P0

**Fix**:
```sql
-- Enable RLS on storage.objects (should already be enabled by Supabase)
-- Add policies to restrict uploads

-- product-images: only service_role can upload
CREATE POLICY "Service role manages product images"
ON storage.objects FOR ALL
USING (bucket_id = 'product-images' AND (auth.jwt() ->> 'role') = 'service_role');

-- product-images: public read
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- designs: authenticated users can upload own designs
CREATE POLICY "Users upload own designs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'designs' AND auth.uid() IS NOT NULL);

-- designs: public read
CREATE POLICY "Public read designs"
ON storage.objects FOR SELECT
USING (bucket_id = 'designs');

-- designs: add mime type and size restrictions
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'],
    file_size_limit = 20971520  -- 20 MB
WHERE id = 'designs';
```

---

## 9. Sensitive Data

### 9.1 PII Column Inventory

| Table | Column | Type | Risk |
|---|---|---|---|
| `users` | `email` | varchar | PII -- protected by RLS (own row only) |
| `users` | `phone` | varchar | PII -- protected by RLS (own row only) |
| `users` | `password_hash` | varchar | CRITICAL -- exposed via SELECT policy |
| `users` | `stripe_customer_id` | varchar | Sensitive -- exposed via SELECT |
| `users` | `stripe_subscription_id` | varchar | Sensitive -- exposed via SELECT |
| `orders` | `customer_email` | varchar | PII -- protected by RLS |
| `orders` | `shipping_address` (JSONB) | jsonb | PII (name, address, phone) |
| `shipping_addresses` | `phone` | varchar | PII -- protected by RLS |
| `abandoned_carts` | `email` | varchar | PII -- service_role only |
| `newsletter_subscribers` | `email` | text | PII -- service_role only |
| `newsletter_subscribers` | `confirmation_token` | text | Auth token -- service_role only |
| `user_consents` | `ip_address` | text | PII (GDPR) |
| `drip_queue` | `email` | varchar | PII -- service_role only |

### 9.2 Encryption Status

- **At rest**: Supabase Cloud provides disk encryption (AES-256) -- PASS
- **Column-level encryption**: None -- password_hash uses bcrypt (adequate)
- **In transit**: TLS enforced by Supabase -- PASS

### 9.3 Critical: password_hash Accessible via API

The `users` table SELECT policy `Users can view own profile` uses `auth.uid() = id`, which returns ALL columns including `password_hash`, `stripe_customer_id`, and `stripe_subscription_id`.

**Severity**: P0

Already covered in Section 2.7 with fix.

---

## 10. Performance

### 10.1 Table Sizes & Growth

Total database size: ~8 MB. This is a development/early-stage database. No performance concerns at this scale.

### 10.2 Vacuum Status

Autovacuum is active:
- `product_variants`: last autovacuum 2026-03-07 08:49 -- PASS
- `products`: last autovacuum 2026-03-07 08:19 -- PASS
- Most tables have dead tuples < 50 -- PASS

### 10.3 Connection Pool

- **Max connections**: 60 (Supabase free/pro tier default)
- **Active connections**: 12
- **Utilization**: 20% -- PASS

### 10.4 Bloat Concerns

No significant bloat detected. Highest dead tuple count is `product_variants` (157 dead / 913 live = 17%) -- within normal range and handled by autovacuum.

---

## 11. Backup & Recovery

### 11.1 Supabase Cloud Backup

- **Daily backups**: Enabled by Supabase (Pro plan: 7-day retention)
- **Point-in-time recovery (PITR)**: Available on Pro plan (up to 7 days)
- **pg_dump capability**: Accessible via direct connection string -- PASS

### 11.2 Manual Backup

```bash
PGPASSWORD='***' pg_dump -h db.your-project.supabase.co \
  -p 5432 -U postgres -d postgres \
  --no-owner --no-acl -Fc > backup_$(date +%Y%m%d).dump
```

**Recommendation**: Set up automated daily pg_dump to external storage (S3/GCS) as a secondary backup.

---

## Critical Findings Summary

### P0 -- Must Fix Immediately

| # | Issue | Table | Risk |
|---|---|---|---|
| 1 | `password_hash` exposed via users SELECT policy | `users` | Credential leakage |
| 2 | Zero RLS policies on storage buckets | `storage.objects` | Arbitrary file upload/delete |
| 3 | `error_logs` allows anon SELECT and INSERT | `error_logs` | Information disclosure + DoS via log injection |
| 4 | `designs` bucket accepts any file type, no size limit | `storage.buckets` | Storage abuse, malware upload |

### P1 -- Fix Before Production

| # | Issue | Table(s) | Risk |
|---|---|---|---|
| 5 | 2 tables with RLS disabled | `design_clipart`, `design_templates_library` | Unprotected write access |
| 6 | 14 tables with RLS enabled but 0 policies | `admin_roles`, `documents`, `user_roles`, etc. | Data inaccessible or silently empty |
| 7 | `store_themes` allows any authenticated user to INSERT/DELETE | `store_themes` | Theme vandalism |
| 8 | 32 FK columns missing indexes | Multiple | Slow JOINs and cascade deletes |
| 9 | No CHECK >= 0 on 31 price/money columns | Multiple | Negative prices |
| 10 | `stripe_customer_id` and `stripe_subscription_id` exposed in users SELECT | `users` | Sensitive data leakage |

### P2 -- Fix Soon

| # | Issue | Details |
|---|---|---|
| 11 | 9 tables with user_id but no FK to users | Missing referential integrity |
| 12 | Nullable user_id on orders, cart_items, conversations | Weakened RLS guarantees |
| 13 | 17 tables with updated_at but no auto-update trigger | Stale timestamps |
| 14 | Test data inserted via migrations instead of seeds | Migration hygiene |
| 15 | Destructive migrations without down scripts | No rollback capability |

### P3 -- Nice to Have

| # | Issue | Details |
|---|---|---|
| 16 | 32 empty unreferenced tables | Planned features, not yet active |
| 17 | Test functions in production DB | `test_partition_pruning`, `test_try_cron_lock_behavior` |
| 18 | Duplicate trigger on cart_items | Two updated_at triggers |
| 19 | 30+ unused indexes | Negligible cost at current scale |
| 20 | No automated external backup | Rely solely on Supabase built-in |

---

## Recommended Fix Priority

**Week 1** (P0):
1. Revoke SELECT on `users.password_hash` for authenticated/anon roles
2. Add storage RLS policies and restrict `designs` bucket
3. Remove anon access from `error_logs`
4. Add mime type + size limit to `designs` bucket

**Week 2** (P1):
5. Enable RLS on `design_clipart` and `design_templates_library`
6. Add policies to the 14 tables with RLS but no policies
7. Restrict `store_themes` write access to admin
8. Create indexes on FK columns (especially `order_items`)
9. Add CHECK >= 0 constraints on price columns
10. Restrict users SELECT to exclude sensitive columns

**Week 3** (P2):
11. Add missing FK constraints (9 tables)
12. Make user_id NOT NULL on conversations and cart_items (or document guest behavior)
13. Add missing updated_at triggers (17 tables)
14. Move test data from migrations to seed scripts
