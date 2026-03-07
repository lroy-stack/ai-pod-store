# Database Audit — 2026-03-07

## Summary

- **Tables**: 99 (74 base + 25 partition children)
- **With RLS enabled**: 74 | **Without RLS**: 25
- **RLS enabled but 0 policies** (locked to service_role only): 22
- **Total RLS policies**: 106
- **Total indexes**: 393
- **Total FK constraints**: 93 (deduplicated)
- **Partitioned tables**: 3 (agent_events, audit_log, messages)
- **pgvector**: 1 column (documents.embedding), HNSW index present

### Verdict

| Category | PASS | WARN | FAIL | CRITICAL |
|---|---|---|---|---|
| RLS Coverage | 14 | 8 | 3 | 7 |
| Data Integrity | 6 | 2 | 0 | 1 |
| Schema Design | 5 | 3 | 1 | 0 |
| Performance | 4 | 2 | 0 | 0 |
| **Totals** | **29** | **15** | **4** | **8** |

---

## Critical Findings

### CRITICAL-1: `messages` table has NO user-scoped SELECT policy

The `messages` table (60 rows, partitioned) only has a single policy: `service_role_messages` (ALL, `auth.role() = 'service_role'`). There is **no SELECT policy for authenticated users**. This means:
- Regular users cannot read their own chat messages via Supabase client
- All message access must go through service_role, bypassing RLS entirely
- If any API endpoint exposes messages without filtering by conversation ownership, cross-user data leakage occurs

**Impact**: Chat messages are inaccessible to users via RLS, or if service_role is used without filtering, any user could see any message.

### CRITICAL-2: `orders` table has NO INSERT/UPDATE/DELETE policies for users

Orders only have two SELECT policies. Users cannot:
- Create orders (INSERT) via Supabase client
- Cancel/update orders (UPDATE)
- Delete orders

All order mutations must use service_role. While this may be intentional (orders created server-side), it means the service_role path has no RLS guardrails.

### CRITICAL-3: `product_variants` table — RLS enabled, 0 policies (913 rows)

Product variants (913 rows) have RLS enabled but zero policies. This means:
- **No authenticated user or anon user can read product variants**
- All variant access must bypass RLS via service_role
- The storefront product display likely breaks without service_role client usage

### CRITICAL-4: `order_items` table — RLS enabled, 0 policies

Same issue as product_variants. Order items are completely invisible to all roles except service_role.

### CRITICAL-5: Admin users with NULL password_hash

19 users (including 2 admins: `admin@podplatform.test`, `test-admin-telegram@podai.com`) have NULL password_hash. If the application authenticates against the public.users table rather than auth.users, these accounts could be accessed without a password.

| Email | Role | password_hash |
|---|---|---|
| admin@podplatform.test | admin | NULL |
| test-admin-telegram@podai.com | admin | NULL |
| + 17 customer accounts | customer | NULL |

### CRITICAL-6: `admin_settings` — RLS disabled, contains store configuration

The `admin_settings` table has **RLS completely disabled** (not just enabled with no policies). Any Supabase client (including anon) can read and modify store settings including:
- Store name, email, currency
- PodClaw bridge URL
- Feature flags (maintenance mode, registration, guest checkout)

### CRITICAL-7: `tenant_configs` — RLS disabled

Tenant configuration table has RLS disabled. Any client can read/modify tenant configs.

### CRITICAL-8: Partition children have NO RLS

All 21 partition children (agent_events_y2026m02..m08, audit_log_y2026m02..m08, messages_y2026m02..m08) have RLS **disabled**. While the parent tables have RLS, if a query targets a partition directly, RLS is bypassed.

**Affected partitions** (no RLS, no policies):
- `agent_events_y2026m02` through `agent_events_y2026m08` (7)
- `audit_log_y2026m02` through `audit_log_y2026m08` (7)
- `messages_y2026m02` through `messages_y2026m08` (7)

---

## RLS Coverage Matrix

### User-Scoped Tables (MUST enforce auth.uid() = user_id)

| Table | Rows | SELECT | INSERT | UPDATE | DELETE | Status |
|---|---|---|---|---|---|---|
| users | 25 | auth.uid()=id | - | auth.uid()=id | - | WARN: no INSERT/DELETE; has deleted_at filter |
| orders | 23 | auth.uid()=user_id | NONE | NONE | NONE | **CRITICAL**: read-only, no write policies |
| order_items | 0 | NONE | NONE | NONE | NONE | **CRITICAL**: RLS on, 0 policies |
| conversations | 14 | auth.uid()=user_id + tenant | service_role only | NONE | NONE | WARN: no user INSERT/UPDATE |
| messages | 60 | NONE (service_role only) | NONE | NONE | NONE | **CRITICAL**: no user access |
| cart_items | 0 | auth.uid()=user_id | auth.uid() (with_check) | auth.uid()=user_id | auth.uid()=user_id | PASS |
| wishlists | 5 | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | PASS |
| wishlist_items | 0 | via wishlists join | via wishlists join | via wishlists join | via wishlists join | PASS |
| notifications | 60 | auth.uid()=user_id | NONE | auth.uid()=user_id | NONE | PASS (server creates) |
| shipping_addresses | 0 | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | PASS |
| personalizations | - | auth.uid()=user_id | open INSERT | auth.uid()=user_id | NONE | WARN: INSERT has no user_id check |
| credit_transactions | 4 | NONE | NONE | NONE | NONE | WARN: RLS on, 0 policies |
| designs | 80 | NONE | NONE | NONE | NONE | WARN: RLS on, 0 policies, has user_id col |
| user_consents | - | auth.uid()=user_id | open INSERT | NONE | NONE | PASS |
| user_design_assets | - | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | PASS |
| design_sessions | - | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | PASS |
| design_compositions | - | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | PASS |
| ai_generations | - | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | auth.uid()=user_id | PASS |
| return_requests | 2 | auth.uid()=user_id + admin | open INSERT | admin only | NONE | WARN: INSERT no user_id check |
| returns | 0 | customer_id + admin | open INSERT | admin only | NONE | PASS |
| product_reviews | 0 | true (public) | open INSERT | auth.uid()=user_id | NONE | WARN: INSERT no user_id check |
| push_subscriptions | - | NONE | NONE | NONE | NONE | WARN: RLS on, 0 policies |
| referrals | - | NONE | NONE | NONE | NONE | WARN: RLS on, 0 policies |
| newsletter_subscribers | - | NONE | NONE | NONE | NONE | WARN: RLS on, 0 policies |
| abandoned_carts | - | service_role only | service_role only | service_role only | service_role only | PASS (server-managed) |

### Shared/Public Tables (read-only for users)

| Table | Rows | SELECT | Write Access | Status |
|---|---|---|---|---|
| products | 27 | tenant-scoped | NONE (service_role) | WARN: no service_role ALL policy |
| product_variants | 913 | NONE | NONE | **CRITICAL**: 0 policies |
| categories | 61 | is_active=true | service_role ALL | PASS |
| coupons | - | active=true | NONE | PASS |
| blog_posts | - | status=published | service_role ALL | PASS |
| legal_pages | - | is_active=true | admin ALL | PASS |
| legal_settings | - | true | admin UPDATE | PASS |
| legal_page_versions | - | true | admin INSERT | PASS |
| seo_meta_tags | 3 | true | admin UPDATE | PASS |
| brand_config | - | is_active=true | service_role ALL | PASS |
| product_labels | - | true | service_role ALL | PASS |
| shipping_zones | - | active=true | NONE | PASS |
| store_themes | 12 | true | authenticated (all ops) | **FAIL**: see below |
| translations | 3 | NONE | NONE | WARN: RLS on, 0 policies |

### Admin/System Tables (service_role only)

| Table | RLS | Policies | Status |
|---|---|---|---|
| admin_settings | **OFF** | 0 | **CRITICAL**: no RLS at all |
| tenant_configs | **OFF** | 0 | **CRITICAL**: no RLS at all |
| design_clipart | **OFF** | 0 | WARN: public assets, low risk |
| design_templates_library | **OFF** | 0 | WARN: public assets, low risk |
| admin_roles | ON | 0 | PASS (locked) |
| agent_sessions | ON | service_role | PASS |
| agent_events | ON | service_role | PASS |
| agent_daily_costs | ON | service_role | PASS |
| audit_log | ON | service_role | PASS |
| cron_runs | ON | true (ALL) | **FAIL**: qual=true allows any role |
| error_logs | ON | anon+auth read/write | **FAIL**: any user can UPDATE errors |
| user_usage | ON | service_role | PASS |
| system_events | ON | 0 | PASS (locked) |
| heartbeat_events | ON | 0 | PASS (locked) |
| processed_events | ON | 0 | PASS (locked) |
| soul_change_log | ON | 0 | PASS (locked) |
| documents | ON | 0 | WARN: 78 rows locked, may break RAG search |
| drip_queue | ON | 0 | PASS (locked) |
| marketing_content | ON | 0 | PASS (locked) |
| customer_segments | ON | 0 | PASS (locked) |
| demand_forecasts | ON | 0 | PASS (locked) |
| price_history | ON | 0 | PASS (locked) |
| association_rules | ON | 0 | PASS (locked) |

### Multi-Tenancy Tables

| Table | RLS | Policies | Status |
|---|---|---|---|
| tenants | ON | CRUD (owner_id + members) | PASS |
| tenant_members | ON | CRUD (owner/admin scoped) | PASS |
| tenant_configs | **OFF** | 0 | **CRITICAL** |

---

## Overly Permissive Policies (qual = true on write operations)

| Table | Policy | Command | Roles | Risk |
|---|---|---|---|---|
| cron_runs | Service role full access | ALL | public | HIGH: any role can read/write cron state |
| error_logs | anon_can_update_errors | UPDATE | anon | MEDIUM: anon can modify error records |
| error_logs | authenticated_can_update_errors | UPDATE | authenticated | MEDIUM: any user can modify errors |
| store_themes | Authenticated users can update themes | UPDATE | authenticated | HIGH: any user can modify store themes |
| ai_generations | Service role full access | ALL | public | MEDIUM: named service_role but qual=true |
| design_compositions | Service role full access | ALL | public | MEDIUM: same issue |
| design_sessions | Service role full access | ALL | public | MEDIUM: same issue |
| returns | Service role full access | ALL | public | MEDIUM: same issue |
| user_design_assets | Service role full access | ALL | public | MEDIUM: same issue |

**Pattern issue**: Multiple policies named "Service role full access" use `qual = true` with `roles = {public}`. This means ANY user (including anon) matches these policies, not just service_role. The policy name is misleading -- the actual restriction should use `auth.role() = 'service_role'` in the qual clause.

---

## Data Integrity

### Foreign Key Relationships

93 FK constraints found (deduplicated). Key observations:

**ON DELETE CASCADE (appropriate)**:
- `cart_items.user_id` -> users (CASCADE) -- correct
- `notifications.user_id` -> users (CASCADE) -- correct
- `order_items.order_id` -> orders (CASCADE) -- correct
- `product_variants.product_id` -> products (CASCADE) -- correct
- `wishlist_items.wishlist_id` -> wishlists (CASCADE) -- correct

**ON DELETE SET NULL (review needed)**:
- `orders.user_id` -> users (SET NULL) -- preserves order history after user deletion
- `conversations.user_id` -> users (SET NULL) -- preserves chat history
- `designs.user_id` -> users (SET NULL) -- preserves designs

**ON DELETE RESTRICT (correct for referential integrity)**:
- `order_items.product_id` -> products (RESTRICT) -- cannot delete ordered products
- `order_items.variant_id` -> product_variants (RESTRICT) -- cannot delete ordered variants

**ON DELETE NO ACTION (potential issue)**:
- `credit_transactions.user_id` -> users (NO ACTION) -- will block user deletion if transactions exist
- `push_subscriptions.user_id` -> users (NO ACTION) -- same issue
- `products.category_id` -> categories (NO ACTION) -- will block category deletion
- `marketing_content.product_id` -> products (NO ACTION) -- will block product deletion

### Orphaned Records Check

| Relationship | Orphans |
|---|---|
| order_items -> products | 0 |
| order_items -> orders | 0 |
| wishlist_items -> wishlists | 0 |
| cart_items -> products | 0 |
| messages -> conversations | 0 |
| product_variants -> products | 0 |

No orphaned records found.

### NULL password_hash on Users

19 of 25 users have NULL password_hash, including 2 admin accounts. If authentication falls back to the public.users table (rather than auth.users exclusively), NULL password_hash could allow bypass.

---

## Schema Design Observations

### Positive
- UUID primary keys on all tables
- Proper CHECK constraints on status/enum fields (agent_sessions, ab_experiments, ai_generations)
- Good use of `admin_settings_id_check (id = 1)` to enforce singleton
- HNSW vector index on documents.embedding with good parameters (m=16, ef_construction=64)
- Proper partitioning for high-volume tables (agent_events, messages, audit_log)

### Issues
- **FAIL**: `users.password_hash` column exists in public schema -- passwords should only live in `auth.users`. If this is a shadow column, it should be removed or kept strictly in sync
- **WARN**: `telegram_messages.user_id` is `text` type, not `uuid` -- inconsistent with all other user_id columns
- **WARN**: `designs` table (80 rows) has user_id column but RLS enabled with 0 policies -- completely locked
- **WARN**: `documents` table (78 rows, RAG embeddings) has RLS enabled with 0 policies -- search functions likely require service_role

---

## Indexes

393 total indexes across all tables (including partition children). Partition indexes are properly inherited.

### Notable Index Coverage
- Products: 18 indexes (status, category, slug, printify_id, tenant, price, created_at, tags GIN, product_details GIN)
- Product variants: 7 indexes (product_id, sku, printify_variant_id, color, size)
- Orders: 7 indexes (user_id, status, stripe, created_at, tenant)
- Documents: HNSW for vector similarity + GIN for full-text search

### Potential Missing Indexes
- `designs.user_id` -- no index found for user lookup (80 rows, low priority)
- `credit_transactions.user_id` -- no dedicated index (4 rows, low priority)

---

## Partitioning

Three tables use range partitioning by `created_at`:

| Parent Table | Partitions | Data Location |
|---|---|---|
| agent_events | 7 (Feb-Aug 2026) | 2,755 rows in Feb |
| audit_log | 7 (Feb-Aug 2026) | ~163 rows in Feb |
| messages | 7 (Feb-Aug 2026) | ~54 rows in Feb |

**Issue**: Partition children lack RLS (see CRITICAL-8). Future months (Sep+ 2026) have no partitions defined yet.

---

## Table Sizes (Top 10)

| Table | Total Size | Data | Indexes |
|---|---|---|---|
| agent_events_y2026m02 | 1,448 kB | 736 kB | 712 kB |
| product_variants | 1,216 kB | 768 kB | 448 kB |
| products | 976 kB | 256 kB | 720 kB |
| documents | 744 kB | 40 kB | 704 kB |
| store_themes | 256 kB | 88 kB | 168 kB |
| orders | 240 kB | 24 kB | 216 kB |
| audit_log_y2026m02 | 176 kB | 48 kB | 128 kB |
| users | 160 kB | 16 kB | 144 kB |
| cart_items | 160 kB | 8 kB | 152 kB |
| audit_log_y2026m03 | 152 kB | 40 kB | 112 kB |

Total database is very small (~8 MB). Index-to-data ratio is high on some tables (products: 720 kB indexes for 256 kB data), but at this scale it does not matter.

---

## Recommendations (Priority Order)

### P0 — Fix Immediately

1. **Enable RLS on `admin_settings` and `tenant_configs`** -- these are writable by anon clients right now
2. **Add SELECT policy for `product_variants`** -- `SELECT true` for public read, otherwise storefront breaks
3. **Add user-scoped SELECT policy for `messages`** -- join through conversations.user_id
4. **Fix "Service role full access" policies that use `qual = true`** -- change to `auth.role() = 'service_role'`
5. **Enable RLS on partition children** or verify Supabase routes all queries through parent tables
6. **Remove or rotate admin accounts with NULL password_hash** (`admin@podplatform.test`, `test-admin-telegram@podai.com`)

### P1 — Fix Soon

7. **Add INSERT policy for `orders`** with service_role or user-scoped check
8. **Add SELECT policy for `order_items`** -- users should see items for their orders
9. **Fix `store_themes` UPDATE policy** -- restrict to admin role, not all authenticated users
10. **Fix `error_logs` UPDATE policies** -- anon/authenticated should not be able to modify error records
11. **Fix `cron_runs` policy** -- change from `qual = true` to `auth.role() = 'service_role'`
12. **Add policies for `designs` table** -- 80 rows with user_id but completely locked

### P2 — Improve

13. **Add policies for `product_reviews` INSERT** with `auth.uid() = user_id` in with_check
14. **Add policies for `return_requests` INSERT** with user_id validation
15. **Add policies for `personalizations` INSERT** with user_id validation
16. **Change `credit_transactions`, `push_subscriptions`, `referrals`, `newsletter_subscribers`** -- add appropriate policies or document service_role-only access
17. **Consider removing `password_hash` from public.users** if authentication is handled by auth.users
18. **Standardize `telegram_messages.user_id`** to UUID type
19. **Change FK `credit_transactions.user_id`** from NO ACTION to CASCADE or SET NULL
20. **Create partition definitions for Sep-Dec 2026** before August ends

---

## Migration Count

224 migration files in `/Users/lr0y/POD-AI-PDR/pod_workspace/project/supabase/migrations/`. The schema has evolved significantly with frequent small migrations rather than fewer large ones.

---

*Audit performed on 2026-03-07 by database security auditor. This is a research-only report -- no code was modified.*
