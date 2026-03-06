# Production Audit 05 — Database Schema, Performance, Stability & Maintenance

> **Date:** 2026-03-06
> **Auditor:** Claude Sonnet 4.6 (automated)
> **Scope:** Supabase Cloud (PostgreSQL 16 + pgvector) — schema integrity, indexing, RLS, migration health, performance, data maintenance, and scalability
> **Source files audited:** 221 migration files, 10 application-layer files, 3 existing audit docs
> **Builds on:** `docs/audit-360/07-database-schema.md` (2026-02-23)

---

## Executive Summary

The database is in a materially better state than the February 23 audit, but several critical and high-priority gaps remain before production is safe. The biggest achievement since the last audit is the complete RLS remediation pass (migration `20260223201642` + `20260223201800`) and the phased Printify-to-Printful provider migration (Phases 3–5). The Phase 5 DROP migration remains on `.hold` pending verification — this is the correct cautious approach.

**Schema Completeness Score: 72 / 100**

| Area | Score | Trend since Feb 23 |
|---|---|---|
| Schema integrity | 75/100 | Up from ~55 (Printify migration complete) |
| Indexing | 70/100 | Up from ~60 (several new indexes added) |
| RLS coverage | 82/100 | Up from ~40 (mass RLS remediation applied) |
| Migration health | 85/100 | Stable (221 files, one .hold) |
| Performance | 65/100 | Stable (new design tables uncached) |
| Data maintenance | 60/100 | Stable (partitioning still not implemented) |
| Data integrity | 70/100 | Improved (new design tables have proper FKs) |
| Scalability | 55/100 | Unchanged (IVFFlat not replaced, no partitioning) |

**Production blockers (must fix before go-live):**

1. `auth.users` / `public.users` ID desynchronization — RLS policies may silently never match (CRITICAL)
2. No `handle_new_user()` trigger — new signups do not sync to `public.users` (CRITICAL)
3. `user_usage` RLS policy uses `USING (true)` — any authenticated user can read any other user's usage counts (HIGH)
4. `analytics_events` INSERT policy uses `WITH CHECK (true)` — unlimited write abuse vector (HIGH)
5. `ab_events` INSERT policy uses `WITH CHECK (true)` — unlimited write abuse vector (HIGH)
6. `trending_products` materialized view has no refresh schedule — data goes stale (HIGH)
7. IVFFlat vector index on `documents` — suboptimal for small datasets, must migrate to HNSW (HIGH)
8. Phase 5 DROP migration (`.hold`) still pending — 14 legacy Printify columns occupy space and risk application code confusion (MEDIUM)

---

## 1. Schema Integrity

### 1.1 Current State

**221 migration files** spanning 2026-02-13 to 2026-03-06 (21 days of development). The schema has evolved from 24 tables to approximately 64+ tables across 9 domain clusters. The rate of migrations (221 files in 21 days = ~10.5/day) is extremely high for a production schema — this reflects rapid feature development.

**Table count by domain:**

| Domain | Tables |
|---|---|
| Core (users, products, variants, orders, items) | 8 |
| Feature (wishlists, reviews, cart, notifications, coupons, translations) | 8 |
| Agent (sessions, events, costs, heartbeat, soul_change_log) | 5 |
| Analytics/Lifecycle (segments, forecasts, prices, association, A/B, beliefs, metrics, decisions) | 10 |
| Marketing (content, campaigns, subscribers, drip, referrals) | 5 |
| Messaging (channels, conversations, telegram, whatsapp, user_links) | 5 |
| Usage/Credits (user_usage, credit_transactions, push_subscriptions) | 3 |
| Legal (consents, legal_settings, legal_pages, legal_page_versions) | 4 |
| RBAC (admin_roles, user_roles) | 2 |
| Design Studio (design_sessions, ai_generations, user_design_assets, design_compositions, design_templates_library, design_clipart) | 6 |
| Themes, Reliability, Infra (store_themes, processed_events, cron_runs, audit_log, error_logs, analytics_events) | 6 |
| **Total** | **~72** |

### 1.2 Critical Structural Issue: auth.users vs public.users Identity Split

**This is the most critical structural defect in the entire schema.**

The initial schema creates `public.users` with `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. This generates an independent UUID that has no relationship to the `auth.users.id` that Supabase Auth uses.

Consequence: All RLS policies that check `auth.uid() = user_id` (e.g., on `orders`, `cart_items`, `wishlists`) will **never match** unless the application explicitly ensures both IDs are identical. If a user signs up via Supabase Auth (which creates a row in `auth.users` with its own UUID), but the application then creates a `public.users` row with a different `gen_random_uuid()` UUID, the two IDs diverge — and RLS policies that check `auth.uid() = user_id` silently return empty results or block legitimate access.

Seven newer tables (`design_sessions`, `ai_generations`, `user_design_assets`, `design_compositions`, `personalizations`, `newsletter_subscribers`, `analytics_events`) correctly reference `REFERENCES auth.users(id)`. The older core tables (`orders`, `cart_items`, `wishlists`, `notifications`, `shipping_addresses`) reference `REFERENCES users(id)` pointing at `public.users`.

There is no `handle_new_user()` trigger to copy the `auth.users.id` into `public.users.id` at signup, nor any FK from `public.users.id` to `auth.users.id`.

**Fix required:** Add `ALTER TABLE public.users ADD CONSTRAINT users_auth_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;` and create a trigger `handle_new_user()` on `auth.users` AFTER INSERT.

### 1.3 Orphaned Legacy Columns (Post-Printify Migration)

The Phase 3 migration (`20260302100000`) added provider-agnostic columns (`pod_provider`, `provider_product_id`, `external_variant_id`, `external_order_id`, etc.) and backfilled them from the old Printify columns. The Phase 5 DROP migration is on `.hold`. Until Phase 5 executes, the following legacy columns still exist on live tables:

| Table | Orphaned Columns |
|---|---|
| `products` | `printify_id`, `blueprint_id`, `print_provider_id` |
| `product_variants` | `printify_variant_id` |
| `orders` | `printify_order_id`, `printify_cost_cents`, `printify_retry_count`, `printify_error`, `printify_last_attempt_at` |
| `order_items` | `printify_line_item_id` |
| `designs` | `printify_upload_id`, `printify_image_url` |
| `personalizations` | `printify_temp_product_id` |

Code inspection confirms `blueprint_id` and `print_provider_id` are still read in `src/lib/pod/printify/mapper.ts` (lines 237-238) and `src/lib/reliability/divergence-detector.ts` (lines 122-136, 308-322) using a dual-read fallback pattern (`provider_product_id || printify_id`). This means Phase 5 cannot be safely executed until those code paths are updated. The `.hold` extension is appropriate.

**Assessment of Phase 5 readiness:** The cleanup migration `20260306200000` already ran, marking all legacy Printify products as `pod_provider = 'printify_legacy'`, so the Phase 5 safety guard (checking for `pod_provider = 'printify'`) will pass. However, the code references to `blueprint_id` and `print_provider_id` in the application layer must be updated first.

### 1.4 Missing Foreign Keys

| Table | Column | Issue |
|---|---|---|
| `personalizations` | `product_id` | Declared as `UUID NOT NULL` but no FK to `products(id)` in initial migration `20260221120000` |
| `ai_generations` | `product_id` | Added in migration `20260228201100` as `TEXT DEFAULT NULL` — not a proper UUID FK |
| `association_rules` | `antecedents`, `consequents` | `TEXT[]` arrays — no FK enforcement on product IDs; invalid UUIDs are silently accepted |
| `marketing_content` | `product_id` | Has FK `REFERENCES products(id)` but no index on `product_id` |

### 1.5 Schema Consistency Issues

- **Dual role system:** `users.role` (simple `CHECK (role IN ('customer', 'admin'))`) and `admin_roles`/`user_roles` RBAC tables coexist. The `ab_experiments` and `ab_events` RLS policies check `users.role = 'admin'`, while newer admin operations check through RBAC tables. No reconciliation exists between the two systems.
- **Currency inconsistency legacy:** Migration `20260216000000` attempted to fix `usd` → `EUR` but the initial schema defaults remain as `'usd'`. New records use `EUR` but old records may still carry `usd` or `eur` (lowercase) depending on when they were created.
- **`products.status` CHECK constraint:** Extended to include `'publishing'` and `'deleted'` in `20260216000000`. The ERD lists these as valid but the initial schema only had `('draft', 'active', 'archived')`. Constraint was dropped and recreated — this is correct but creates a migration dependency risk.
- **`base_price_cents` NOT NULL dropped:** Migration `20260216000000` made `base_price_cents` nullable for a two-step pricing flow. This means aggregation queries (`MIN(base_price_cents)`) must filter for `IS NOT NULL`.
- **`cart_items` duplicate trigger:** Migration `20260214000344` adds `update_cart_items_updated_at` trigger, but `20260213000000` also adds `update_cart_items_updated_at`. The `CREATE OR REPLACE` pattern on the function prevents a hard error but the duplicate trigger on the same table may fire twice.
- **Soft delete inconsistency:** `products` uses `status = 'deleted'` AND `deleted_at IS NOT NULL` as dual soft-delete indicators. `product-detail-cache.ts` queries `.is('deleted_at', null)` but `product-cache.ts` queries `.eq('status', 'active')`. These can diverge if a product has `status = 'active'` but `deleted_at IS NOT NULL` (or vice versa), leading to products appearing in one query but not the other.

---

## 2. Indexing Strategy

### 2.1 Index Inventory (confirmed from migrations)

**Indexes confirmed present:**

| Table | Index | Type | Purpose |
|---|---|---|---|
| `products` | `idx_products_tags` | GIN | Tag filtering |
| `products` | `idx_products_category_status` | BTree | Category + status filter |
| `products` | `idx_products_avg_rating` | BTree | Rating sort |
| `products` | `idx_products_printify_id` | BTree | Printify sync (to be dropped by Phase 5) |
| `products` | `idx_products_provider_product_unique` | Unique partial | Provider upsert |
| `products` | `idx_products_pod_provider` | BTree | Provider + status filter |
| `products` | `idx_products_cost` | Partial BTree | Finance queries |
| `products` | `idx_products_product_details` | GIN | JSONB containment queries |
| `products` | `idx_products_compare_at_price` | Partial BTree | Sale price lookups |
| `products` | `idx_products_branded_hero` | Partial BTree | Branded hero URL |
| `products` | `idx_products_design_templates` | ? | design_templates column (20260305200000 — no index created) |
| `product_variants` | (product_id CASCADE) | BTree | From FK |
| `orders` | `idx_orders_user_status` | BTree | User order lookups |
| `orders` | `idx_orders_stripe_session` | BTree | Stripe webhook |
| `orders` | `idx_orders_pod_retry` | Partial BTree | Retry queue |
| `orders` | `idx_orders_external_order_id` | Partial BTree | Webhook lookups |
| `order_items` | `idx_order_items_order_id` | BTree | Added 20260304100000 |
| `order_items` | `idx_order_items_composition` | Partial BTree | Composition FK |
| `messages` | `idx_messages_conversation_id` | BTree | Chat history |
| `documents` | `idx_documents_embedding` | IVFFlat | Vector search (WRONG TYPE) |
| `notifications` | `idx_notifications_user_read` | BTree | User notification feed |
| `translations` | `idx_translations_namespace_locale` | BTree | i18n lookup |
| `audit_log` | `idx_audit_log_actor`, `_resource`, `_created_at` | BTree | Audit queries |
| `agent_events` | `idx_agent_events_session`, `_created_at` | BTree | Agent monitoring |
| `categories` | `idx_categories_slug` | BTree | Category resolution |
| `categories` | (parent_id, is_active) | ? | Category tree |
| `analytics_events` | `idx_analytics_events_created_at`, `_event_name`, `_session_id` | BTree | Analytics queries |
| `user_consents` | `idx_user_consents_user_id`, `_type`, `_user_type_timestamp` | BTree | GDPR queries |
| `cron_runs` | `idx_cron_runs_name_started`, `_status`, `_started_at` | BTree | Cron management |
| `user_usage` | `idx_user_usage_lookup` | BTree (identifier, action, period) | Usage rate limiting |
| `design_sessions` | (from 20260228200100) | ? | Session lookup |
| `ai_generations` | `idx_ai_generations_user` | BTree | User generation history |
| `trending_products` | `idx_trending_products_id` | Unique BTree | Materialized view |
| `design_templates_library` | `idx_templates_category` | Partial BTree | Template browser |
| `design_clipart` | `idx_clipart_category` | Partial BTree | Clipart browser |
| `product_labels` | `idx_product_labels_product_id`, `_type` | BTree | Label lookups |

### 2.2 Missing Indexes — High Priority

| Table | Missing Index | Query Pattern | Impact |
|---|---|---|---|
| `product_variants` | `(product_id)` explicit index | Every product detail page, batch variant fetch | MEDIUM — FK creates implicit index in most PG versions, but explicit is better for stats |
| `product_variants` | `(product_id, is_enabled, is_available)` composite | `getProduct()` and `fetchVariantsByProductId()` filter on all three | HIGH — current queries scan all variants then filter |
| `product_variants` | `(product_id, color)` for `fetchColorVariants()` | Shop page, related products | HIGH — color join done in memory from full table scan |
| `products` | `(status, created_at DESC)` composite | Default shop sort (`.eq('status','active').order('created_at')`) | HIGH — category_status index does not cover this sort |
| `products` | `(category_id, status, created_at DESC)` | Category-filtered shop with default sort | HIGH — requires merge of category_status index and created_at sort |
| `products` | `(deleted_at)` partial WHERE `deleted_at IS NULL` | `getProduct()` calls `.is('deleted_at', null)` | MEDIUM |
| `orders` | `(created_at DESC)` | Admin order list, date-range reports | MEDIUM |
| `orders` | `(paid_at)` | Portfolio metrics cron, revenue reporting | HIGH — `compute_daily_product_metrics` uses paid_at |
| `order_items` | `(product_id)` | Portfolio metrics, cross-sell, co-purchase analysis | HIGH — `association_rules` are computed from this |
| `order_items` | `(variant_id)` | Variant-level fulfillment queries | MEDIUM |
| `designs` | `(user_id)` | Design history page | HIGH — no index confirmed in migrations |
| `designs` | `(product_id)` | Product-design join | MEDIUM |
| `cart_items` | `(session_id)` explicit | Guest cart lookup | MEDIUM — session_id is present as column but no index migration found |
| `notifications` | `(user_id, created_at DESC)` | Notification feed ordering | MEDIUM — `_user_read` index does not cover order |
| `blog_posts` | `(status, published_at DESC)` partial | Blog listing | MEDIUM |
| `documents` | GIN `to_tsvector('english', content)` | `hybrid_search_documents()` keyword component is O(n) without it | HIGH |
| `user_consents` | Already has good coverage | — | OK |
| `newsletter_subscribers` | `(email)` | Already has UNIQUE on email | OK |
| `credit_transactions` | `(user_id, created_at DESC)` | Already exists | OK |
| `association_rules` | `(antecedents)` GIN | `getRelatedProducts()` uses `.contains('antecedents', [productId])` | HIGH — array containment without GIN is sequential scan |
| `marketing_content` | `(product_id)` | Product-campaign joins | LOW |
| `design_compositions` | `(user_id, status)` | User composition history | MEDIUM |
| `ai_generations` | `(session_id)` | Session detail view | MEDIUM |
| `processed_events` | `(processed_at)` | Cleanup cron | LOW — already has UNIQUE(provider, event_id) |

### 2.3 Vector Index — Critical Issue

The initial schema creates:
```sql
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

**IVFFlat is the wrong choice here.** The `documents` table is used for RAG — at catalog scale (<10,000 product documents), IVFFlat requires at least 100 × lists = 10,000 rows to perform optimally (the recommended rule is `rows >= lists × 3`). Below that threshold, IVFFlat performs worse than a sequential scan. HNSW (`USING hnsw (embedding vector_ip_ops)`) provides superior recall and speed at any dataset size and does not require a training phase.

Additionally, the ERD says "HNSW index" but the initial migration created IVFFlat. This indicates the ERD was aspirational, not descriptive.

**Fix:**
```sql
DROP INDEX idx_documents_embedding;
CREATE INDEX idx_documents_embedding_hnsw ON documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

### 2.4 Over-Indexing Concerns

- `audit_log` has three separate single-column indexes (`actor`, `resource`, `created_at`). A compound `(resource_type, resource_id, created_at DESC)` would cover most query patterns better.
- `products` has 10+ indexes. While most are justified, `idx_products_branded_hero` (a partial index on `branded_hero_url IS NOT NULL`) is of questionable value — this column is unlikely to be filtered directly.
- `cron_runs` has 3 separate indexes on a table that will have low cardinality. The `_status` and `_started_at` indexes are redundant with the compound `_name_started` index for most query patterns.

---

## 3. Row Level Security (RLS)

### 3.1 RLS Coverage Matrix

| Table | RLS Enabled | Policy | Safe? |
|---|---|---|---|
| `users` | Yes | Users read/update own row | OK |
| `products` | Yes | Public read (active + not deleted); service_role write | OK |
| `product_variants` | Yes | Public read; service_role write | OK |
| `product_reviews` | Yes | Public select; user creates own | OK |
| `orders` | Yes | User reads own orders | OK |
| `order_items` | Yes | Service role only (post-RLS mass enable) | REVIEW |
| `cart_items` | Yes | User manages own cart (auth.uid() = user_id) | OK — but guest carts (user_id NULL) inaccessible via RLS |
| `wishlists` | Yes | User manages own | OK |
| `wishlist_items` | Yes | Via wishlist ownership check | OK |
| `shipping_addresses` | Yes | User manages own | OK |
| `notifications` | Yes | User reads own | OK |
| `conversations` | Yes | Service role only | OK |
| `messages` | Yes | Service role only | OK |
| `designs` | Yes | (enabled in mass RLS pass) | VERIFY — no user policy confirmed |
| `personalizations` | Yes | User reads/creates/updates own | OK |
| `translations` | Yes | (enabled in mass RLS pass) | VERIFY — public read policy needed |
| `audit_log` | Yes | (enabled in mass RLS pass) | VERIFY — service_role only correct |
| `agent_sessions` | Yes | Service role only | OK |
| `agent_events` | Yes | Service role only | OK |
| `agent_daily_costs` | Yes | Service role only | OK |
| `ab_experiments` | Yes | Admin-only (checks users.role = 'admin') | RISK — relies on public.users role, not auth.users |
| `ab_events` | Yes | INSERT WITH CHECK (true) + admin SELECT | RISK — open INSERT (DoS/pollution vector) |
| `user_usage` | Yes | Service role USING(true) | CRITICAL — `USING (true)` grants ANY role full access |
| `analytics_events` | Yes | INSERT WITH CHECK (true) | RISK — open INSERT (no rate limiting at DB level) |
| `newsletter_subscribers` | Not confirmed | — | VERIFY |
| `drip_queue` | Not confirmed | — | VERIFY |
| `credit_transactions` | Not confirmed | — | VERIFY — financial data |
| `push_subscriptions` | Not confirmed | — | VERIFY — device tokens |
| `telegram_messages` | Yes | Service role only (fixed in 20260223201800) | OK |
| `whatsapp_messages` | Yes | Service role only (fixed in 20260223201800) | OK |
| `user_messaging_links` | Yes | Service role only (fixed in 20260223201800) | OK |
| `messaging_conversations` | Yes | Service role only (fixed in 20260223201800) | OK |
| `messaging_channels` | Yes | Service role only | OK |
| `store_themes` | Yes | (enabled; write policy unknown) | VERIFY — admin-only write needed |
| `brand_config` | Yes | (enabled) | VERIFY |
| `cron_runs` | Yes | Service role only | OK |
| `processed_events` | Yes | (enabled in mass pass) | VERIFY |
| `user_consents` | Yes | User reads/inserts own; service_role full | OK |
| `design_sessions` | Yes | auth.uid() = user_id + service_role | OK |
| `ai_generations` | Yes | auth.uid() = user_id + service_role | OK |
| `user_design_assets` | Yes | auth.uid() = user_id + service_role | OK |
| `design_compositions` | Yes | auth.uid() = user_id + service_role | OK |
| `product_labels` | Yes | Public SELECT; service_role write | OK |
| `design_templates_library` | Not confirmed | — | VERIFY |
| `design_clipart` | Not confirmed | — | VERIFY |
| `trending_products` (matview) | N/A — materialized view | Public read implicitly | OK for read |
| `categories` | Yes | Added in 20260223233615 | VERIFY policy |

### 3.2 Critical RLS Gaps

**Gap 1: `user_usage` — USING(true) policy**

Migration `20260214180000` creates:
```sql
CREATE POLICY "Service role full access on user_usage"
  ON user_usage FOR ALL
  USING (true)
  WITH CHECK (true);
```

`USING (true)` means ALL roles (including `anon` and `authenticated`) can read and write ALL rows. This exposes every user's daily usage counts to anyone with the anon key. The `increment_usage()` RPC function uses `SECURITY DEFINER` which bypasses RLS, but direct table queries through the anon client are wide open.

**Gap 2: `ab_events` open INSERT**

```sql
CREATE POLICY "Anyone can insert events"
  ON ab_events
  FOR INSERT
  WITH CHECK (true);
```

Any client can flood `ab_events` with unlimited fake impressions, conversions, or revenue events — contaminating A/B test results and causing unbounded table growth.

**Gap 3: `analytics_events` open INSERT**

Same pattern as ab_events — `WITH CHECK (true)` on INSERT with no rate limiting at the DB level.

**Gap 4: `ab_experiments` admin policy checks `public.users.role`**

```sql
EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
```

This only works if `public.users.id = auth.uid()`. Given the auth split issue (Section 1.2), this check may silently fail for all users — meaning no one can read or write experiments through the anon/authenticated client.

**Gap 5: Mass RLS enable without verifying policies**

Migration `20260223201642` blindly enables RLS on all tables, but does not add policies to many of them. Tables with RLS enabled but no `FOR SELECT` policy visible to `anon`/`authenticated` roles will silently return zero rows (deny by default). This is the secure behavior, but may cause unexpected "empty table" bugs in tables like `translations`, `coupons`, `shipping_zones`, `categories` if they lack a public-read policy.

**Gap 6: `designs` table — no user-facing read policy confirmed**

The `designs` table has RLS enabled, but the only confirmed policy from the mass-enable migration is service_role. Users should be able to read their own designs on the Design History page. No user-read policy was found in the audited migrations.

---

## 4. Migration Health

### 4.1 Overview

- **Total migration files:** 221 (220 executable `.sql` + 1 `.hold`)
- **Date range:** 2026-02-13 to 2026-03-06 (21 days)
- **Average rate:** 10.5 migrations/day (very high — reflects dev-speed-first approach)
- **Naming convention:** Consistent `YYYYMMDDHHMMSS_description.sql` pattern throughout

### 4.2 Positive Patterns

- Safety guards in Phase 5 DROP migration (verifies backfill complete before destructive operations)
- `BEGIN` / `COMMIT` transaction wrapping on complex multi-statement migrations
- `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` guard patterns
- `DO $$ BEGIN ... END $$` blocks for conditional constraint creation
- Compensating migrations for bugs (multiple `fix_*` migrations instead of in-place edits)
- Clear version sequencing for design studio tables (200000–201500)

### 4.3 Concerns

**High-density timestamp collisions:** Many migrations share the same date prefix with sequential suffixes (e.g., `20260228200000` through `20260228201500` = 16 migrations in a single day). While sequential, this fragile approach breaks if two developers run migrations simultaneously.

**Test/seed data in production migrations:**
- `20260213223557_add_mock_products.sql` — mock products in production schema
- `20260214003934_insert_mock_products.sql` — additional mock product inserts
- `20260213232458_add_test_user_for_reviews.sql` — test user inserted into production users table
- `20260214032311_insert_test_order_for_returns.sql` — test order in production orders table
- `20260214165431_insert_three_order_items.sql` — test order items in production
- `20260214165229_add_multiple_order_items_for_testing.sql` — more test data

These records are permanently in the production schema. The cleanup migration `20260306200000` marks E2E products as deleted (`status = 'deleted'`) but does not DELETE the rows. Depending on Supabase's RLS policies for `status = 'deleted'`, these rows may appear in some admin queries.

**Duplicate `cron_runs` table:** Two migrations create `cron_runs`:
- `20260223184253_create_processed_events_table.sql` — processed_events table (same day)
- `20260223184627_create_cron_runs_table.sql` — cron_runs table
- `20260223185917_create_cron_runs_table.sql` — another cron_runs table (2 minutes later, same name)

Both `20260223184627` and `20260223185917` create `cron_runs`. Because one uses `CREATE TABLE` and the other uses implicit CREATE (check both), the later one may conflict. `IF NOT EXISTS` guards prevent hard errors but the second migration's additions (triggers, indexes) may partially duplicate those from the first.

**Phase 5 DROP migration readiness:**

Preconditions for safely executing `20260302200000_phase5_drop_printify_columns.sql.hold`:

| Precondition | Status |
|---|---|
| No products with `pod_provider = 'printify'` | PASS — `20260306200000` changed all to `'printify_legacy'` |
| All orders backfilled to `external_order_id` | LIKELY — cleanup migration ran UPDATE |
| All variants backfilled to `external_variant_id` | LIKELY — cleanup migration ran UPDATE |
| Application code updated to not read `printify_id`/`blueprint_id` | PARTIAL — `src/lib/pod/printify/mapper.ts` still reads `blueprint_id`/`print_provider_id` as fallback (dual-read pattern) |
| Monitoring confirms zero reads of `printify_*` columns | UNKNOWN — no observability for column access patterns |

**Recommendation:** Phase 5 should remain on `.hold` until the dual-read fallback code in `mapper.ts` and `divergence-detector.ts` is removed and verified in staging.

---

## 5. Performance Concerns

### 5.1 Caching Architecture

The caching strategy is well-designed for a POD storefront at this scale:

**Layer 1: React.cache (within-request deduplication)**
- `getCatalogProducts()`, `getProductCategories()`, `getCategoryProductCount()` in `product-cache.ts`
- `getProduct()`, `getProductReviews()`, `getRelatedProducts()` in `product-detail-cache.ts`
- These deduplicate concurrent server-component calls within the same RSC render tree

**Layer 2: Redis (cross-request, TTL-based)**
- Products catalog: 5 min TTL
- Category counts/tree: 10 min TTL
- Product detail: 5 min TTL
- Related products: 15 min TTL
- Brand config: 30 min TTL
- Implemented in `cached-queries.ts` with graceful fallthrough when Redis is unavailable

**Gap: New Design Studio tables are not cached.** `design_sessions`, `ai_generations`, `user_design_assets`, `design_compositions` are all queried directly without any caching layer. For AI generation history pages with many generations per user, this could generate significant database load.

**Gap: `product-cache.ts` fetches ALL active products without pagination.** `getCatalogProducts()` runs:
```typescript
.from('products')
.select('...')
.eq('status', 'active')
.order('created_at', { ascending: false })
```
With no `.range()` limit. As the catalog grows from the current ~30 products toward the 250-product target, this will eventually fetch hundreds of rows per request — even with `React.cache` deduplication, this runs on every cold RSC render. At 250 products × ~2KB/row = 500KB of data per uncached page load.

### 5.2 N+1 Query Analysis

**`/api/products` route — GOOD pattern:**
The route uses batch fetching (`fetchVariantsByProductId()`, `fetchLabelsByProductId()`) with `.in('product_id', productIds)` queries. This is 3 queries total for a product listing page: 1 products, 1 variants, 1 labels. Well-structured.

**`/api/products` hybrid search — POTENTIAL N+1:**
In `hybridSearch()`, the function calls `resolveCategoryIds(category)` inside both `getVectorSearchResults()` AND `getKeywordSearchResults()`. If both run in parallel via `Promise.all`, this executes 2 identical category resolution queries (2× queries to `categories` table). Minor issue, but unnecessary.

**`getRelatedProducts()` — CASCADING QUERY:**
When no association rules exist (the fallback path), the function calls `getProduct(productId)` first (which may hit Redis), then makes a separate products query. This is a 2-query waterfall. Acceptable for the fallback path.

**Checkout: sequential variant queries:**
In `create-session/route.ts`, variant availability and pricing are checked in two separate queries against `product_variants` (lines 85-90 and 182-189), both filtering `.in('product_id', productIds)`. These could be merged into a single query.

**Category resolution on every request:**
`resolveCategoryIds()` makes 1-2 DB queries per request to resolve category slugs to IDs. This data is stable and should be cached in Redis. Currently there is a `getCachedCategoryTree()` function, but `resolveCategoryIds()` does not use it.

### 5.3 Large Table Scans Without Pagination

- `getCatalogProducts()` (product-cache.ts:15) — fetches ALL active products, no LIMIT
- `getVectorSearchResults()` (products/route.ts) — fetches `limit * 3` documents from `search_documents()` RPC, then fetches full product details for all results in a second query
- `association_rules` table — queried with `.contains('antecedents', [productId])` which requires a GIN index on `antecedents` for performance (currently using default BTree from `idx_association_rules_created_at` which does not support array containment)

### 5.4 Connection Configuration

**Supabase-js HTTP connection pooling (supabase-admin.ts):** The admin client uses a Proxy singleton pattern with `autoRefreshToken: false` and `persistSession: false`. The custom header `'x-connection-pool': 'true'` does not configure actual connection pooling — it is just a header. Real connection pooling is provided by Supabase's pgBouncer (Supavisor), which must be enabled in the Supabase dashboard (the Feb 23 audit flagged this as disabled).

**No explicit connection count limits or timeout configuration** in the Supabase client. Under concurrent webhook + cron + SSR load, without pgBouncer enabled, PostgreSQL connections can be exhausted (Supabase free tier: 60 connections; Pro: 200 connections).

### 5.5 Materialized View — Refresh Strategy Missing

`trending_products` materialized view (created in `20260227003000`) has `CREATE UNIQUE INDEX` but no refresh mechanism:
- No `pg_cron` job is configured in migrations
- No cron route calls `REFRESH MATERIALIZED VIEW CONCURRENTLY trending_products`
- Data becomes stale immediately after creation
- The view is queried via the trending products API endpoint

The `/api/products/trending` route presumably reads from this view. Without refresh, the view contains stale data indefinitely.

---

## 6. Data Maintenance

### 6.1 Soft Delete Strategy

**Inconsistent dual soft-delete across tables:**

| Table | Soft Delete Method | Hard Delete Trigger |
|---|---|---|
| `products` | `status = 'deleted'` AND `deleted_at` | None — orphaned |
| `users` | `deleted_at IS NOT NULL` (GDPR) + 30-day grace | `deletion_requested_at` + cron cleanup |
| `designs` | `moderation_status = 'rejected'` (partial) | None |
| `personalizations` | `status = 'expired'` | Cron cleanup |
| Others | Physical DELETE (via cascade) | Cascade from parent |

The `products` table has BOTH `status = 'deleted'` AND `deleted_at` as soft-delete signals but they are not always set together. `product-cache.ts` only checks `status = 'active'` while `product-detail-cache.ts` checks `.is('deleted_at', null)`. A product with `status = 'deleted'` but `deleted_at = NULL` would appear in product detail queries but not catalog queries.

### 6.2 High-Growth Tables Without Archival Strategy

| Table | Growth Pattern | Risk | Current Strategy |
|---|---|---|---|
| `messages` | Every chat message, unbounded | HIGH — no partition, no TTL | None |
| `agent_events` | BIGSERIAL, every agent action | HIGH — `created_at` cleanup referenced in ERD but no migration found | Mentioned in ERD but no cron migration |
| `ab_events` | BIGSERIAL, every impression | HIGH — open INSERT policy (Section 3.2) | `created_at DESC` index only |
| `analytics_events` | Every page view/click | HIGH — open INSERT policy | `created_at DESC` index, no cleanup |
| `audit_log` | Every admin/agent action | MEDIUM — planned partitioning | No partition migration found |
| `heartbeat_events` | Regular heartbeats | MEDIUM | ERD mentions 90-day cron; no migration |
| `notifications` | Per user notification | LOW | No TTL |
| `cron_runs` | Per cron execution | LOW | No TTL |
| `processed_events` | Per webhook event | MEDIUM — can grow unboundedly | Cleanup by `processed_at` index but no TTL migration |

**The ERD states partitioning for `messages`, `agent_events`, `audit_log` (monthly partitions) — but NO partition migrations were found.** The ERD is aspirational, not implemented.

### 6.3 Cleanup Cron Jobs Assessment

From migration `20260223185917_create_cron_runs_table.sql`, the `cron_runs` table has `status IN ('running', 'completed', 'failed', 'skipped')` — proper cleanup tracking exists.

However, the actual cron implementations (`/api/cron/cleanup-temp-products/route.ts`, `/api/cron/drip/route.ts`, etc.) do not appear to include DB row cleanup for `processed_events`, `heartbeat_events`, `agent_events`, `ab_events`, or `notifications`. These tables will grow unboundedly.

### 6.4 GDPR Data Deletion

`user_consents` table is well-designed (append-only consent log with immutable records). `account_deletion_grace_period` migration adds `deletion_requested_at` and `deleted_at` columns with appropriate partial indexes. However:

- No migration implements the **hard-delete cron job** that actually removes `public.users` rows after the 30-day grace period
- No migration removes PII from related tables (orders, cart_items, designs) when a user is hard-deleted — CASCADE deletes on these tables will remove the data, but `orders.shipping_address` is a JSONB column that embeds the address directly in the order row and is NOT cascaded

---

## 7. Data Integrity

### 7.1 Trigger Coverage

**Present triggers:**

| Trigger | Table | Function | Purpose |
|---|---|---|---|
| `after_review_change` | `product_reviews` | `trigger_update_product_rating()` | Updates `products.avg_rating` + `review_count` |
| `update_*_updated_at` | `users`, `products`, `orders`, `conversations`, `documents`, `cart_items` | `update_updated_at_column()` | Keeps `updated_at` fresh |
| `cron_runs_calculate_duration` | `cron_runs` | `calculate_cron_duration()` | Auto-fills `duration_ms` |

**Missing triggers:**

- No `updated_at` trigger on `product_variants` — variant price/availability changes are not timestamped
- No `updated_at` trigger on `designs` — design status changes have no timestamp
- No `updated_at` trigger on `notifications` — read-status changes are not timestamped
- No audit trigger on `orders` — order status transitions are not logged to `audit_log` (an order going from `paid` → `cancelled` leaves no record beyond the status column change)

### 7.2 Race Conditions in Critical Paths

**Checkout flow — stock race condition:**
`create-session/route.ts` checks variant availability via `is_available = true` THEN creates a Stripe session. There is no optimistic locking or reservation mechanism. Two users can simultaneously pass the availability check for the same out-of-stock item.

**Coupon race condition:**
```typescript
const hasUsesLeft = !coupon.usage_limit || (coupon.times_used || 0) < coupon.usage_limit;
```
This reads `times_used` without a transaction lock. Two users can simultaneously validate the last use of a coupon and both proceed to create sessions with it. The `times_used` increment presumably happens at webhook time — not at session creation — creating a window for coupon over-redemption.

**`increment_usage()` RPC — correct pattern:**
The UPSERT with `ON CONFLICT DO UPDATE SET count = count + 1` is atomic and correct. This is the right pattern and should be used for coupon redemption too.

**Order creation in Stripe webhook:**
The `handleCheckoutSessionCompleted()` function in `webhooks/stripe/route.ts` creates a `processed_events` record with `UNIQUE(provider, event_id)` to prevent duplicate processing. This is idempotent and correct.

### 7.3 Transaction Usage

No API routes use explicit PostgreSQL transactions (BEGIN/COMMIT through supabase-js). Multi-step operations like order creation (insert order + insert order_items + update coupon + send email) are done as sequential individual operations. If a step fails mid-way, partial state is left in the database.

For the critical checkout webhook path, the lack of a transaction means:
- Order inserted but order_items fails → order exists with no items
- Order + items inserted but coupon increment fails → coupon is under-counted
- All DB ops succeed but email fails → acceptable (email is fire-and-forget)

---

## 8. Scalability

### 8.1 Estimated Table Sizes at Production Scale

Based on 250 products, 1,000 monthly active users, and typical POD conversion rates (2-3%):

| Table | Rows (1K MAU) | Rows (10K MAU) | Notes |
|---|---|---|---|
| `products` | 250 | 250 | Static catalog |
| `product_variants` | ~5,000 | ~5,000 | ~20 variants/product |
| `orders` | ~600/mo | ~6,000/mo | 2% conversion of 30K monthly visits |
| `order_items` | ~900/mo | ~9,000/mo | 1.5 items/order average |
| `messages` | ~50,000/mo | ~500,000/mo | 50 messages/active user |
| `agent_events` | ~200,000/mo | ~2,000,000/mo | High-frequency agent actions |
| `analytics_events` | ~500,000/mo | ~5,000,000/mo | Every page view |
| `ab_events` | ~100,000/mo | ~1,000,000/mo | If open INSERT is exploited |
| `audit_log` | ~10,000/mo | ~100,000/mo | Every admin action |
| `notifications` | ~3,000/mo | ~30,000/mo | Accumulating without TTL |

At 10K MAU, `messages` and `agent_events` will reach 6M+ rows/year without cleanup. Without partitioning, PostgreSQL query planner efficiency degrades significantly beyond ~50M rows per table on a standard Supabase instance.

### 8.2 Connection Pool Reality

Supabase Pro plan: 200 direct connections. Typical Next.js SSR pattern under load:
- Each SSR render: 1-3 Supabase queries via `supabaseAdmin`
- Under 100 concurrent requests: 100-300 connections needed
- Serverless/Edge functions amplify this: each invocation opens a new connection

Without pgBouncer (Supavisor) enabled, Supabase's connection limit will be hit at moderate traffic (~50-100 concurrent users on the Pro plan). The `x-connection-pool: 'true'` header in `supabase-admin.ts` is cosmetic and does not enable pooling.

### 8.3 pgvector Scalability

Current setup: IVFFlat with `lists = 100` on `documents`. At the current catalog scale (<1,000 documents), IVFFlat is sub-optimal. At 10,000+ documents, IVFFlat performance depends on maintaining `nprobe` (the number of lists to probe) — which defaults to 1 in pgvector and must be set per-session: `SET ivfflat.probes = 10`. There is no evidence this is set in the application's search RPC calls.

HNSW does not require this tuning and delivers better recall at any scale.

---

## 9. Index Audit Table

| Table | Confirmed Indexes | Missing (Priority) |
|---|---|---|
| `products` | GIN(tags), (category,status), (avg_rating DESC), (printify_id), UNIQ(pod_provider,provider_product_id), (pod_provider,status), (cost_cents) partial, GIN(product_details), (compare_at_price) partial, (branded_hero_url) partial | **(HIGH)** (status, created_at DESC); **(HIGH)** (category_id, status, created_at DESC) |
| `product_variants` | From FK (product_id implicit) | **(HIGH)** (product_id, is_enabled, is_available); **(HIGH)** (product_id, color) |
| `orders` | (user_id, status), (stripe_session_id), (pod_retry) partial, (external_order_id) partial | **(HIGH)** (paid_at); **(MEDIUM)** (created_at DESC) |
| `order_items` | (order_id) | **(HIGH)** (product_id); **(MEDIUM)** (variant_id) |
| `designs` | None confirmed | **(HIGH)** (user_id); **(MEDIUM)** (product_id) |
| `messages` | (conversation_id) | **(MEDIUM)** (conversation_id, created_at DESC) composite |
| `documents` | IVFFlat(embedding) | **(HIGH)** Replace with HNSW; **(HIGH)** GIN(to_tsvector) for text search |
| `association_rules` | (created_at DESC) | **(HIGH)** GIN(antecedents) for `.contains()` queries |
| `categories` | (slug) | **(MEDIUM)** (parent_id, is_active) |
| `design_sessions` | (from 20260228200100 — unclear) | **(MEDIUM)** (user_id, status) |
| `ai_generations` | (user_id, created_at DESC) | **(MEDIUM)** (session_id) |
| `design_compositions` | (from 20260228201400) | **(MEDIUM)** (user_id, status) |
| `trending_products` | UNIQUE(id) | N/A (materialized view) |

---

## 10. RLS Coverage Matrix Summary

| Category | Tables Protected | Tables with Issues | Tables Unverified |
|---|---|---|---|
| User data (PII) | users, orders, cart_items, wishlists, shipping_addresses, notifications, user_consents | user_usage (USING true) | credit_transactions, push_subscriptions |
| Product catalog | products, product_variants, product_reviews, product_labels | — | translations, coupons, shipping_zones |
| Design studio | design_sessions, ai_generations, user_design_assets, design_compositions | designs (no user read policy) | design_templates_library, design_clipart |
| Agent/system | agent_sessions, agent_events, agent_daily_costs, messaging tables, cron_runs | — | processed_events, error_logs |
| Analytics | analytics_events (RLS on), ab_experiments, ab_events | analytics_events INSERT open, ab_events INSERT open | newsletter_subscribers, drip_queue |
| Legal | user_consents | — | legal_settings, legal_pages |

---

## 11. Performance Hotspots

Priority list of queries most likely to cause production latency:

1. **`getCatalogProducts()` — unlimited full-table scan** (product-cache.ts:15). At 250+ products with no LIMIT, this returns all rows on every cold SSR render. Should be paginated or cached with a hard product cap.

2. **`hybrid_search_documents()` without GIN text index** — the keyword component of hybrid search calls `to_tsvector()` on every `documents` row. At 5,000 documents, this is a 5,000-row sequential scan on every search request.

3. **`association_rules` `.contains()` without GIN index** — `getRelatedProducts()` calls `.contains('antecedents', [productId])` on `association_rules`. Array containment on a non-GIN-indexed column is a full table scan.

4. **Category resolution on every product API request** — `resolveCategoryIds()` makes 1-2 DB queries per request (slug → id, then children lookup). With 10K+ requests/hour, this adds 10K-20K small DB queries/hour that could be eliminated by caching the ~30-row `categories` table.

5. **`getProduct()` — 3 parallel Supabase queries per product page** (productResult + variantsResult + allEnabledResult). With Redis miss, this executes on every cold request. The product detail cache TTL is 5 min — acceptable, but the 3-query waterfall on cache miss should be noted.

6. **`trending_products` materialized view — stale without refresh** — reads from a view that is never refreshed after initial creation, returning permanently stale trending data.

7. **Checkout route — 4 sequential product_variants queries** — the checkout session creation queries `product_variants` twice (availability check at line 85, pricing at line 182) when these could be merged into one query with both `is_available` and `price_cents` in a single call.

---

## 12. Final Gaps Summary

| Gap | Severity | Impact | Effort | Fix |
|---|---|---|---|---|
| No `handle_new_user()` trigger — `public.users.id` not synced to `auth.users.id` | CRITICAL | RLS policies may silently never match; auth broken | LOW (1 migration) | Add trigger on `auth.users` INSERT |
| `public.users` not FK-linked to `auth.users` | CRITICAL | Auth identity split | LOW | `ADD CONSTRAINT users_auth_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)` |
| `user_usage` RLS `USING(true)` | HIGH | Any client can read all users' usage data | LOW | Replace with user-scoped + service_role policies |
| `ab_events` + `analytics_events` open INSERT | HIGH | Unlimited writes, data contamination, DoS | LOW | Add per-session rate limiting or require authenticated INSERT |
| `trending_products` matview never refreshed | HIGH | Stale trending data permanently | LOW | Add cron route + pg_cron job |
| IVFFlat instead of HNSW on `documents.embedding` | HIGH | Poor vector search recall at small dataset sizes | MEDIUM | DROP + recreate with HNSW |
| `association_rules.antecedents` missing GIN index | HIGH | Full table scan on every "related products" request | LOW (1 migration) | `CREATE INDEX ... USING GIN (antecedents)` |
| `product_variants` missing composite index | HIGH | Variant queries scan all variants then filter in memory | LOW | `CREATE INDEX (product_id, is_enabled, is_available)` |
| Phase 5 DROP migration blocked on code | MEDIUM | 14 orphaned Printify columns in live tables | MEDIUM | Update `mapper.ts` + `divergence-detector.ts` dual-read code |
| `getCatalogProducts()` no pagination limit | MEDIUM | Full catalog fetched on every cold SSR render | LOW | Add `.limit(500)` or paginate |
| `designs` table no user read policy | MEDIUM | Design history page may return empty for users | LOW | Add user-scoped SELECT policy |
| Checkout stock race condition | MEDIUM | Two users can buy same last unit | MEDIUM | Add inventory reservation or post-purchase rollback |
| Coupon race condition | MEDIUM | Coupon can be redeemed more than usage_limit | MEDIUM | Atomic increment on coupon validation |
| No updated_at trigger on `product_variants` | MEDIUM | Variant changes untimtestamped | LOW | Add trigger |
| Soft-delete inconsistency (status vs deleted_at) | MEDIUM | Products appear in some queries but not others | LOW | Ensure both fields always set together |
| No partitioning on `messages`, `agent_events`, `audit_log` | MEDIUM | Query degradation at >10M rows | HIGH | Monthly partition tables |
| `credit_transactions`, `push_subscriptions` RLS unverified | MEDIUM | Financial + device token data potentially exposed | LOW | Audit and confirm policies |
| pgBouncer/Supavisor not confirmed enabled | MEDIUM | Connection exhaustion at moderate load | LOW (config only) | Enable in Supabase dashboard |
| Category resolution not cached | LOW | 10K+ extra DB queries/hour at scale | LOW | Use `getCachedCategoryTree()` in `resolveCategoryIds()` |
| Test data rows in production tables | LOW | Admin confusion, noisy analytics | MEDIUM | Add DELETE migrations for test rows |
| Duplicate `cron_runs` table migrations | LOW | Potential duplicate triggers | LOW | Audit actual DB state |
| `documents` missing GIN text search index | HIGH | `hybrid_search_documents()` keyword component is O(n) | LOW | `CREATE INDEX ... USING GIN (to_tsvector('english', content))` |
| `order_items.product_id` missing index | HIGH | Portfolio metrics are slow | LOW | `CREATE INDEX idx_order_items_product_id ON order_items(product_id)` |

---

## Appendix: SQL Fixes for Top-Priority Items

### A. Fix auth.users / public.users sync (CRITICAL)

```sql
-- Add FK so public.users.id must exist in auth.users
ALTER TABLE public.users
  ADD CONSTRAINT users_auth_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Trigger: sync new auth.users row into public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### B. Fix user_usage RLS (HIGH)

```sql
-- Drop the open policy
DROP POLICY IF EXISTS "Service role full access on user_usage" ON user_usage;

-- Service role: full access
CREATE POLICY "service_role_full_access" ON user_usage
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users: read own usage (identifier = auth.uid() or email)
CREATE POLICY "users_read_own_usage" ON user_usage
  FOR SELECT USING (identifier = auth.uid()::text OR identifier = auth.email());
```

### C. Replace IVFFlat with HNSW (HIGH)

```sql
DROP INDEX IF EXISTS idx_documents_embedding;
CREATE INDEX CONCURRENTLY idx_documents_embedding_hnsw
  ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### D. Add missing critical indexes (HIGH)

```sql
-- product_variants composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variants_product_enabled_available
  ON product_variants (product_id, is_enabled, is_available);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variants_product_color
  ON product_variants (product_id, color)
  WHERE color IS NOT NULL;

-- order_items product_id (for portfolio metrics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id
  ON order_items (product_id);

-- association_rules antecedents GIN (for related products)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_association_rules_antecedents
  ON association_rules USING GIN (antecedents);

-- documents text search GIN
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_content_fts
  ON documents USING GIN (to_tsvector('english', content));

-- products default sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status_created
  ON products (status, created_at DESC);

-- designs user lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_designs_user_id
  ON designs (user_id)
  WHERE user_id IS NOT NULL;
```

### E. Fix trending_products refresh (HIGH)

```sql
-- Add a Next.js cron route: /api/cron/refresh-trending
-- Or add to existing sync cron:
REFRESH MATERIALIZED VIEW CONCURRENTLY trending_products;
```

---

*End of Production Audit 05 — Database Schema, Performance, Stability & Maintenance*
