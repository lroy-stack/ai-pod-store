# Database Schema & Multi-Tenancy Audit

**Date**: 2026-03-04
**Database**: PostgreSQL 16 (Supabase Cloud)
**Total public tables**: 97 (including 21 partition children)
**RLS-enabled tables**: 74 of 76 base tables

---

## 1. Multi-Tenancy Model

### 1.1 Architecture: Shared Database, Row-Level Isolation

The platform uses a **single shared PostgreSQL database** with **row-level tenant isolation** via a `tenant_id UUID` column on key tables. There is no schema-per-tenant separation. All tenants share the same tables and indexes.

### 1.2 Tenants Table

```sql
SELECT * FROM tenants;
```

| id | name | slug | domain | plan | status | subscription_tier | subscription_status | max_products | max_orders_per_month | max_team_members |
|---|---|---|---|---|---|---|---|---|---|---|
| `f1c548a3-b69d-4328-a372-c4924a660044` | Test Tenant for Grace Period | test-tenant-1771763386450 | *(null)* | free | active | pro | active | 100 | 500 | 5 |
| `e99b56d7-f597-4101-a1fd-bfcd30e7a7d9` | Tenant B Test Store | tenant-b-test | tenantb.test | free | active | starter | none | 25 | 50 | 1 |

**Full schema** (19 columns):

| Column | Type | Default | Nullable |
|---|---|---|---|
| id | uuid | gen_random_uuid() | NO |
| name | varchar(255) | - | NO |
| slug | varchar(100) | - | NO |
| owner_id | uuid | - | NO |
| stripe_customer_id | varchar(255) | - | YES |
| stripe_subscription_id | varchar(255) | - | YES |
| subscription_tier | varchar(20) | 'starter' | NO |
| subscription_status | varchar(20) | 'none' | NO |
| subscription_period_end | timestamptz | - | YES |
| grace_period_ends_at | timestamptz | - | YES |
| max_products | integer | 25 | NO |
| max_orders_per_month | integer | 50 | NO |
| max_team_members | integer | 1 | NO |
| settings | jsonb | '{}' | YES |
| created_at | timestamptz | now() | NO |
| updated_at | timestamptz | now() | NO |
| domain | text | - | YES |
| plan | text | 'free' | NO |
| status | text | 'active' | NO |

**Unique constraints**: `tenants_pkey (id)`, `tenants_slug_key (slug)`, `tenants_domain_key (domain)`

### 1.3 Tenant Members Table

Implements team-based access to tenants.

| Column | Type | Default | Nullable |
|---|---|---|---|
| id | uuid | gen_random_uuid() | NO |
| tenant_id | uuid | - | NO |
| user_id | uuid | - | NO |
| role | varchar(20) | 'member' | NO |
| invited_at | timestamptz | now() | NO |
| accepted_at | timestamptz | - | YES |

**Unique constraint**: `tenant_members_tenant_id_user_id_key (tenant_id, user_id)`
**Current data**: 0 rows (no team members configured beyond owners)

### 1.4 Tenant Configs Table (Key-Value)

| Column | Type | Default | Nullable |
|---|---|---|---|
| id | uuid | gen_random_uuid() | NO |
| tenant_id | uuid | - | NO |
| key | text | - | NO |
| value | jsonb | '{}' | NO |
| created_at | timestamptz | now() | NO |
| updated_at | timestamptz | now() | NO |

**Unique constraint**: `tenant_configs_tenant_id_key_key (tenant_id, key)`
**Current data**: 0 rows
**CRITICAL**: RLS is **NOT enabled** on `tenant_configs`. Any authenticated user could potentially read all tenant configs via the anon client.

### 1.5 Tables with tenant_id Column

12 tables carry a `tenant_id` column:

| Table | tenant_id Default | FK to tenants? |
|---|---|---|
| users | `f1c548a3-...` (hardcoded) | YES |
| products | `f1c548a3-...` (hardcoded) | YES |
| orders | `f1c548a3-...` (hardcoded) | YES |
| cart_items | `f1c548a3-...` (hardcoded) | YES |
| categories | `f1c548a3-...` (hardcoded) | YES |
| conversations | `f1c548a3-...` (hardcoded) | YES |
| designs | `f1c548a3-...` (hardcoded) | YES |
| wishlists | `f1c548a3-...` (hardcoded) | YES |
| analytics_events | `f1c548a3-...` (hardcoded) | YES |
| store_themes | *(no default)* | YES |
| tenant_configs | *(no default)* | YES |
| tenant_members | *(no default)* | YES |

**CRITICAL FINDING**: All 9 data tables default `tenant_id` to `f1c548a3-b69d-4328-a372-c4924a660044` (the primary tenant). This means:
- If application code fails to set `tenant_id`, data silently lands in the primary tenant
- There is no database-level enforcement preventing cross-tenant data leakage via default values
- New tenants would need explicit `tenant_id` on every INSERT or the default swallows their data

### 1.6 Tables MISSING tenant_id (18 tables)

These tables participate in the purchase flow or user lifecycle but have **no tenant isolation**:

| Table | Rows | Isolation Method |
|---|---|---|
| order_items | 1 | Via FK to orders (which has tenant_id) |
| product_variants | 1863 | Via FK to products (which has tenant_id) |
| shipping_addresses | 0 | Via FK to users (which has tenant_id) |
| return_requests | 2 | Via FK to orders |
| returns | 0 | Via FK to orders |
| notifications | 60 | Via FK to users |
| coupons | 4 | **NO isolation at all** |
| personalizations | 0 | Via FK to products |
| product_reviews | 0 | Via FK to products |
| credit_transactions | 4 | Via FK to users |
| abandoned_carts | 0 | Via FK to users |
| product_labels | 0 | Via FK to products |
| referrals | - | Via FK to users |
| newsletter_subscribers | 2 | **NO isolation at all** |
| push_subscriptions | - | Via FK to users |
| user_consents | - | Via FK to users |
| drip_queue | - | Via FK to users |
| blog_posts | 0 | **NO isolation at all** |

**RISK**: `coupons`, `newsletter_subscribers`, and `blog_posts` have **no tenant isolation** -- neither direct `tenant_id` nor indirect via FK. All tenants share the same coupon codes and subscriber lists.

### 1.7 Tenant Resolution Mechanism

Tenant resolution is done via **custom domain lookup** in the Edge middleware:

1. **Middleware** (`src/middleware.ts`): On every request, checks if the hostname is a primary domain. If not, calls `/api/tenant-resolve?domain={hostname}`
2. **Tenant Resolve API** (`src/app/api/tenant-resolve/route.ts`): Queries `tenants` table for an active tenant with matching `domain`. Caches in Redis (5 min TTL)
3. **Header propagation**: Sets `x-tenant-id` header on request (for API routes) and response (for Server Components)
4. **Cookie caching**: Stores `x-tenant-id` in an httpOnly cookie (5 min TTL) to skip the HTTP roundtrip on subsequent requests
5. **Database function** `get_current_tenant_id()`: Reads `tenant_id` from JWT `app_metadata` or from the `app.tenant_id` PostgreSQL GUC setting

```sql
CREATE FUNCTION public.get_current_tenant_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
$$ LANGUAGE sql STABLE;
```

**FINDING**: The `PRIMARY_DOMAINS` list is defined in `src/lib/store-config.ts`. Requests to primary domains skip tenant resolution entirely, meaning the primary tenant operates without explicit tenant filtering on many routes.

### 1.8 RLS Policies -- Complete List (106 policies)

#### Tables with Tenant-Aware RLS Policies (6 policies use tenant filtering):

| Table | Policy Name | Command | Tenant Check |
|---|---|---|---|
| conversations | conversations_tenant_select | SELECT | `auth.uid() + get_current_tenant_id()` |
| orders | orders_tenant_select | SELECT | `auth.uid() + get_current_tenant_id()` |
| products | products_tenant_select | SELECT | `get_current_tenant_id()` |
| tenants | tenants_select_policy | SELECT | Owner or member check |
| tenants | tenants_update_policy | UPDATE | Owner or admin member check |
| tenant_members | tenant_members_select_policy | SELECT | Tenant membership check |

#### Purchase-Critical Table Policies (detailed):

**orders** (2 policies):
- `Users can view own orders` (SELECT): `auth.uid() = user_id`
- `orders_tenant_select` (SELECT): `service_role OR (auth.uid() = user_id AND (get_current_tenant_id() IS NULL OR tenant_id = get_current_tenant_id()))`

**FINDING**: Orders have no INSERT, UPDATE, or DELETE RLS policies for authenticated users. All order creation/modification must go through service_role (server-side API routes).

**order_items** (0 user-facing policies):
- No RLS policies found. RLS is enabled but with no policies, meaning **no authenticated user can access order_items directly** -- all access must go through service_role.

**cart_items** (6 policies):
- `Service role can manage all cart items` (ALL): service_role check
- `Users can manage own cart` (ALL): `auth.uid() = user_id`
- `Users can view their own cart items` (SELECT): `auth.uid() = user_id`
- `Users can insert their own cart items` (INSERT): `auth.uid() = user_id` (with_check)
- `Users can update their own cart items` (UPDATE): `auth.uid() = user_id`
- `Users can delete their own cart items` (DELETE): `auth.uid() = user_id`

**FINDING**: Cart items have **no tenant filtering** in RLS. Users can only see their own items (by user_id), but there is no tenant boundary check. If a user's `tenant_id` were changed, their cart would still be accessible.

**products** (1 policy):
- `products_tenant_select` (SELECT): `service_role OR get_current_tenant_id() IS NULL OR tenant_id = get_current_tenant_id()`

**FINDING**: Products have no INSERT/UPDATE/DELETE policies. All product mutations go through service_role. The SELECT policy allows tenant-scoped reads, but falls back to showing ALL products when `get_current_tenant_id()` returns NULL (i.e., on the primary domain).

**return_requests** (4 policies):
- `Admins can update return requests` (UPDATE): admin role check
- `Admins can view all return requests` (SELECT): admin role check
- `Users can create return requests for their own orders` (INSERT): checks order ownership
- `Users can view their own return requests` (SELECT): `auth.uid() = user_id`

**returns** (5 policies):
- `Service role full access` (ALL): true
- `Admins can view/update all returns`: admin/staff role check
- `Customers can create their own returns` (INSERT): `auth.uid() = customer_id` + order ownership check
- `Customers can view their own returns` (SELECT): `auth.uid() = customer_id`

**wishlists** (1 policy):
- `Users can manage own wishlists` (ALL): `auth.uid() = user_id`

**wishlist_items** (1 policy):
- `Users can manage own wishlist items` (ALL): Checks ownership via wishlists join

**users** (3 policies):
- `Users can view own profile` (SELECT): `auth.uid() = id`
- `Users can update own profile` (UPDATE): `auth.uid() = id`
- `users_hide_deleted` (SELECT): `deleted_at IS NULL`

#### Tables WITHOUT RLS Enabled (SECURITY RISK):

| Table | Type | Risk |
|---|---|---|
| admin_settings | base table | Contains global settings -- no RLS means any authenticated user can query via anon client |
| tenant_configs | base table | Tenant-specific config -- no RLS means cross-tenant config exposure |
| 21 partition children | `*_y2026m*` | Inherit RLS from parent in PostgreSQL, but these show as not enabled |

---

## 2. Users & Auth Schema

### 2.1 Users Table (26 columns)

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK, matches auth.users.id |
| email | varchar(255) | - | NO | UNIQUE |
| password_hash | varchar(255) | - | YES | For local auth |
| name | varchar(255) | - | YES | |
| role | varchar(20) | 'customer' | NO | CHECK: customer, admin |
| avatar_url | text | - | YES | |
| locale | varchar(5) | 'en' | NO | |
| currency | varchar(3) | 'EUR' | NO | |
| phone | varchar(30) | - | YES | |
| email_verified | boolean | false | NO | |
| notification_preferences | jsonb | `{"sms":false,"push":true,"email":true}` | NO | |
| preferences | jsonb | '{}' | YES | |
| created_at | timestamptz | now() | NO | |
| updated_at | timestamptz | now() | NO | |
| last_login_at | timestamptz | - | YES | |
| deleted_at | timestamptz | - | YES | Soft delete |
| tier | varchar(20) | 'free' | YES | CHECK: free, premium |
| credit_balance | integer | 0 | YES | |
| stripe_customer_id | varchar(255) | - | YES | |
| stripe_subscription_id | varchar(255) | - | YES | |
| subscription_status | varchar(20) | 'none' | YES | CHECK: none, active, cancelled, past_due |
| subscription_period_end | timestamptz | - | YES | |
| must_change_password | boolean | false | YES | |
| deletion_requested_at | timestamptz | - | YES | GDPR deletion request |
| referral_code | varchar(20) | - | YES | UNIQUE |
| tenant_id | uuid | `f1c548a3-...` | NO | FK to tenants |

**CHECK constraints**:
- `users_role_check`: role IN ('customer', 'admin')
- `users_tier_check`: tier IN ('free', 'premium')
- `users_subscription_status_check`: subscription_status IN ('none', 'active', 'cancelled', 'past_due')

**Indexes**:
- `users_pkey (id)` -- primary key
- `users_email_key (email)` -- unique
- `users_referral_code_key (referral_code)` -- unique
- `idx_users_deleted_at (deleted_at) WHERE deleted_at IS NULL` -- partial, for active users
- `idx_users_deletion_requested` -- partial, for pending GDPR deletions
- `idx_users_must_change_password` -- partial, for password change enforcement
- `idx_users_pending_hard_delete (deleted_at) WHERE deleted_at IS NOT NULL` -- for cleanup
- `idx_users_referral_code (referral_code)` -- for referral lookups

### 2.2 Auth Integration (Supabase auth.users)

A trigger on `auth.users` automatically creates/updates a `public.users` row:

```sql
-- Trigger: on_auth_user_created -> handle_new_user()
CREATE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, email_verified, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    email_verified = EXCLUDED.email_verified,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**FINDING**: The `handle_new_user()` trigger does NOT set `tenant_id`. New users always get the hardcoded default `f1c548a3-...`. There is no mechanism in the trigger to assign a user to the correct tenant based on the domain they signed up from.

### 2.3 User-Tenant Relationship

- Users link to tenants via `users.tenant_id` FK
- The `tenant_members` table provides an additional many-to-many relationship (for team access)
- Currently all 25 users belong to the primary tenant

**User distribution**:

| Role | Tenant | Count |
|---|---|---|
| admin | test-tenant-1771763386450 | 6 |
| customer | test-tenant-1771763386450 | 19 |

**No users exist in Tenant B** despite it being an active tenant.

### 2.4 Roles & Permissions Model

**Two-layer role system**:

1. **Simple role** (`users.role`): Either `customer` or `admin`. Used in RLS policies.
2. **Granular RBAC** (`admin_roles` + `user_roles`): Fine-grained permission sets.

**admin_roles** (4 system roles):

| Name | Display | Permissions (keys) |
|---|---|---|
| super_admin | Super Administrator | roles, users, orders, themes, designs, finance, products, settings, analytics, translations |
| manager | Manager | users(read), orders, themes(read,update), designs, finance(read), products, settings(read), analytics, translations(read,update) |
| support | Support Agent | users(read), orders(read,update), designs(read), products(read), settings(read), analytics(read) |
| viewer | Viewer | orders(read), designs(read), products(read), analytics(read) |

**user_roles** (2 assignments):

| User Email | Role |
|---|---|
| admin@podstore.local | super_admin |
| viewer@podstore.local | viewer |

**Database function** `get_user_roles(user_uuid)`: Returns all roles for a user with their permissions (SECURITY DEFINER).

---

## 3. E-Commerce Tables

### 3.1 Orders Table (39 columns)

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK |
| user_id | uuid | - | YES | FK to users -- nullable for guest checkout |
| stripe_session_id | varchar(255) | - | YES | |
| stripe_payment_intent_id | varchar(255) | - | YES | |
| printify_order_id | varchar(255) | - | YES | Legacy Printify |
| status | varchar(30) | 'pending' | NO | CHECK: pending, paid, submitted, in_production, shipped, delivered, cancelled, refunded |
| total_cents | integer | - | NO | |
| currency | varchar(10) | 'EUR' | NO | |
| shipping_address | jsonb | - | YES | Denormalized address snapshot |
| customer_email | varchar(255) | - | YES | |
| tracking_number | varchar(255) | - | YES | |
| tracking_url | text | - | YES | |
| carrier | varchar(100) | - | YES | |
| locale | varchar(5) | 'en' | NO | |
| created_at | timestamptz | now() | NO | |
| updated_at | timestamptz | now() | NO | |
| paid_at | timestamptz | - | YES | |
| shipped_at | timestamptz | - | YES | |
| delivered_at | timestamptz | - | YES | |
| printify_retry_count | integer | 0 | NO | Legacy |
| printify_error | text | - | YES | Legacy |
| printify_last_attempt_at | timestamptz | - | YES | Legacy |
| printify_status | varchar(50) | - | YES | Legacy |
| printify_cost_cents | integer | - | YES | Legacy |
| stripe_fee_cents | integer | - | YES | |
| gift_message | text | - | YES | |
| payment_method | varchar(50) | - | YES | |
| stripe_refund_id | varchar(255) | - | YES | UNIQUE |
| refunded_at | timestamptz | - | YES | |
| refund_amount_cents | integer | - | YES | |
| refund_reason | text | - | YES | |
| retry_count | integer | 0 | NO | |
| tenant_id | uuid | `f1c548a3-...` | NO | FK to tenants |
| external_order_id | text | - | YES | Generic POD provider order ID |
| pod_provider | varchar(20) | 'printify' | NO | |
| pod_cost_cents | integer | - | YES | |
| pod_retry_count | integer | 0 | NO | |
| pod_error | text | - | YES | |
| pod_last_attempt_at | timestamptz | - | YES | |

**Indexes** (13):
- `orders_pkey (id)`
- `idx_orders_user_created (user_id, created_at DESC)`
- `idx_orders_user_status (user_id, status)`
- `idx_orders_status_created (status, created_at DESC)`
- `idx_orders_stripe_session (stripe_session_id)`
- `idx_orders_stripe_session_unique (stripe_session_id) WHERE NOT NULL` -- unique partial
- `orders_stripe_refund_id_key (stripe_refund_id)` -- unique
- `idx_orders_printify_status (printify_status)`
- `idx_orders_printify_retry` -- partial, for retry processing
- `idx_orders_pod_retry` -- partial, for retry processing
- `idx_orders_external_order_id (external_order_id) WHERE NOT NULL`
- `idx_orders_payment_method (payment_method) WHERE NOT NULL`

**FINDING**: No index on `orders.tenant_id`. As the number of tenants/orders grows, tenant-scoped queries will require a full scan. Should add `idx_orders_tenant_id (tenant_id)` or composite `(tenant_id, created_at DESC)`.

### 3.2 Order Items Table (9 columns)

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK |
| order_id | uuid | - | NO | FK to orders |
| product_id | uuid | - | NO | FK to products |
| variant_id | uuid | - | NO | FK to product_variants |
| quantity | integer | - | NO | CHECK: > 0 |
| unit_price_cents | integer | - | NO | |
| printify_line_item_id | varchar(255) | - | YES | Legacy |
| cost_cents | integer | - | YES | |
| external_line_item_id | text | - | YES | Generic POD provider line item ID |

**Indexes**: Only `order_items_pkey (id)`.

**MISSING INDEX**: No index on `order_items.order_id`. Every order detail lookup requires a sequential scan. This is a critical missing index.

### 3.3 Cart Items Table (11 columns)

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK |
| session_id | varchar(255) | - | YES | For guest carts |
| user_id | uuid | - | YES | FK to users |
| product_id | uuid | - | NO | FK to products |
| variant_id | uuid | - | NO | FK to product_variants |
| quantity | integer | - | NO | CHECK: > 0 |
| created_at | timestamptz | now() | NO | |
| updated_at | timestamptz | now() | NO | |
| personalization_id | uuid | - | YES | FK to personalizations |
| tenant_id | uuid | `f1c548a3-...` | NO | FK to tenants |
| composition_id | uuid | - | YES | FK to design_compositions |

**Indexes** (8):
- `cart_items_pkey (id)`
- `idx_cart_items_product_id (product_id)`
- `idx_cart_items_session_id (session_id)`
- `idx_cart_items_user_id (user_id)`
- `idx_cart_items_user_created (user_id, created_at DESC)`
- `idx_cart_items_unique_session_product_variant` -- unique partial for guest carts
- `idx_cart_items_unique_user_product_variant` -- unique partial for authenticated users
- `idx_cart_items_composition (composition_id) WHERE NOT NULL`

### 3.4 Return Requests Table (18 columns)

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK |
| order_id | uuid | - | NO | FK to orders |
| user_id | uuid | - | YES | FK to users |
| reason | text | - | NO | |
| status | varchar(20) | 'pending' | NO | CHECK: pending, approved, rejected, processing, completed |
| refund_amount_cents | integer | - | YES | |
| refund_currency | varchar(10) | 'eur' | YES | |
| stripe_refund_id | varchar(255) | - | YES | |
| admin_notes | text | - | YES | |
| approved_by | uuid | - | YES | FK to users |
| approved_at | timestamptz | - | YES | |
| completed_at | timestamptz | - | YES | |
| created_at | timestamptz | now() | NO | |
| updated_at | timestamptz | now() | NO | |
| tracking_number | text | - | YES | |
| tracking_carrier | text | - | YES | |
| customer_shipped_at | timestamptz | - | YES | |
| item_received_at | timestamptz | - | YES | |

**Indexes**: `return_requests_pkey`, `idx_return_requests_order_id`, `idx_return_requests_status`, `idx_return_requests_user_id`

### 3.5 Returns Table (12 columns)

A separate returns table (appears to be an alternative/legacy returns model):

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK |
| order_id | uuid | - | NO | FK to orders |
| customer_id | uuid | - | NO | FK to users |
| status | varchar(30) | 'return_requested' | NO | CHECK: return_requested, return_approved, item_shipped, item_received, return_completed, rejected, expired |
| reason | text | - | NO | |
| admin_notes | text | - | YES | |
| return_tracking_number | varchar(255) | - | YES | |
| refund_amount_cents | integer | - | YES | |
| created_at | timestamptz | now() | NO | |
| updated_at | timestamptz | now() | NO | |
| resolved_at | timestamptz | - | YES | |
| resolved_by | uuid | - | YES | FK to users |

**FINDING**: There are TWO returns tables (`returns` and `return_requests`) with overlapping purpose. `return_requests` has 2 rows, `returns` has 0 rows. This creates confusion about which table is the source of truth for the returns lifecycle.

### 3.6 Shipping Addresses Table (13 columns)

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK |
| user_id | uuid | - | NO | FK to users |
| label | varchar(50) | - | YES | e.g., "Home", "Work" |
| full_name | varchar(255) | - | YES | |
| street_line1 | text | - | NO | |
| street_line2 | text | - | YES | |
| city | varchar(100) | - | NO | |
| state | varchar(100) | - | YES | |
| postal_code | varchar(20) | - | NO | |
| country_code | char(2) | - | NO | |
| phone | varchar(30) | - | YES | |
| is_default | boolean | false | NO | |
| created_at | timestamptz | now() | NO | |

**Index**: `idx_shipping_addresses_user_id (user_id)`

### 3.7 Products Table (32 columns)

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK |
| printify_id | varchar(255) | - | YES | UNIQUE, legacy |
| title | text | - | NO | |
| description | text | - | YES | |
| category | varchar(100) | - | YES | Legacy text category |
| tags | text[] | '{}' | YES | GIN indexed |
| blueprint_id | integer | - | YES | |
| print_provider_id | integer | - | YES | |
| base_price_cents | integer | - | YES | |
| currency | varchar(10) | 'EUR' | NO | |
| images | jsonb | '[]' | YES | |
| status | varchar(20) | 'draft' | NO | CHECK: draft, active, archived, deleted, publishing |
| avg_rating | numeric | 0 | YES | |
| review_count | integer | 0 | NO | |
| created_at | timestamptz | now() | NO | |
| updated_at | timestamptz | now() | NO | |
| published_at | timestamptz | - | YES | |
| translations | jsonb | '{}' | YES | |
| cost_cents | integer | - | YES | |
| product_details | jsonb | '{}' | YES | GIN indexed; GPSR, materials, etc. |
| category_id | uuid | - | YES | FK to categories |
| deleted_at | timestamptz | - | YES | |
| deleted_by | uuid | - | YES | FK to users |
| admin_edited_at | timestamptz | - | YES | |
| last_synced_at | timestamptz | - | YES | |
| tenant_id | uuid | `f1c548a3-...` | NO | FK to tenants |
| compare_at_price_cents | integer | - | YES | CHECK: > base_price_cents |
| branded_hero_url | text | - | YES | |
| pod_provider | varchar(20) | 'printify' | NO | |
| provider_product_id | text | - | YES | |
| product_template_id | text | - | YES | |
| provider_facility_id | text | - | YES | |

**Indexes** (16):
- `products_pkey (id)`
- `products_printify_id_key (printify_id)` -- unique
- `idx_products_printify_id (printify_id)`
- `idx_products_category_status (category, status)`
- `idx_products_category_id_status (category_id) WHERE status='active'`
- `idx_products_tags` -- GIN
- `idx_products_product_details` -- GIN
- `idx_products_avg_rating (avg_rating DESC)`
- `idx_products_deleted_at (deleted_at) WHERE deleted_at IS NULL`
- `idx_products_cost (cost_cents) WHERE NOT NULL`
- `idx_products_compare_at_price (compare_at_price_cents) WHERE NOT NULL`
- `idx_products_branded_hero (branded_hero_url) WHERE NOT NULL`
- `idx_products_pod_provider (pod_provider, status)`
- `idx_products_provider_product_unique (pod_provider, provider_product_id) WHERE NOT NULL` -- unique

### 3.8 Product Variants Table (13 columns)

| Column | Type | Default | Nullable | Notes |
|---|---|---|---|---|
| id | uuid | gen_random_uuid() | NO | PK |
| product_id | uuid | - | NO | FK to products |
| printify_variant_id | varchar(255) | - | YES | Legacy |
| title | varchar(255) | - | NO | |
| size | varchar(50) | - | YES | |
| color | varchar(50) | - | YES | |
| price_cents | integer | - | NO | |
| sku | varchar(100) | - | YES | |
| is_enabled | boolean | true | NO | |
| is_available | boolean | true | NO | |
| cost_cents | integer | - | YES | |
| image_url | text | - | YES | |
| external_variant_id | text | - | YES | Generic POD provider variant ID |

**Unique constraints**:
- `product_variants_product_printify_unique (product_id, printify_variant_id)`
- `product_variants_provider_variant_unique (product_id, external_variant_id)`

### 3.9 Wishlists & Wishlist Items

**wishlists** (7 columns):

| Column | Type | Default | Nullable |
|---|---|---|---|
| id | uuid | gen_random_uuid() | NO |
| user_id | uuid | - | NO |
| name | varchar | 'My Wishlist' | NO |
| is_public | boolean | false | NO |
| share_token | varchar | - | YES (UNIQUE) |
| created_at | timestamptz | now() | NO |
| tenant_id | uuid | `f1c548a3-...` | NO |

**wishlist_items** (5 columns):

| Column | Type | Default | Nullable |
|---|---|---|---|
| id | uuid | gen_random_uuid() | NO |
| wishlist_id | uuid | - | NO |
| product_id | uuid | - | NO |
| variant_id | uuid | - | YES |
| added_at | timestamptz | now() | NO |

### 3.10 Notifications Table (8 columns)

| Column | Type | Default | Nullable |
|---|---|---|---|
| id | uuid | gen_random_uuid() | NO |
| user_id | uuid | - | NO |
| type | varchar | - | NO |
| title | text | - | NO |
| body | text | - | YES |
| data | jsonb | '{}' | YES |
| is_read | boolean | false | NO |
| created_at | timestamptz | now() | NO |

### 3.11 Coupons Table (13 columns)

| Column | Type | Default | Nullable |
|---|---|---|---|
| id | uuid | gen_random_uuid() | NO |
| code | varchar | - | NO (UNIQUE) |
| discount_type | varchar | - | NO (CHECK: percentage, fixed_amount) |
| discount_value | numeric | - | NO (CHECK: > 0) |
| min_purchase_amount | numeric | - | YES |
| max_discount_amount | numeric | - | YES |
| usage_limit | integer | - | YES |
| times_used | integer | 0 | YES |
| valid_from | timestamptz | now() | YES |
| valid_until | timestamptz | - | YES |
| active | boolean | true | YES |
| created_at | timestamptz | now() | YES |
| updated_at | timestamptz | now() | YES |

Current coupons:

| Code | Type | Value | Min Purchase | Max Discount | Limit |
|---|---|---|---|---|---|
| WELCOME10 | percentage | 10% | 25.00 | - | - |
| SAVE5 | fixed_amount | 5.00 | 15.00 | - | - |
| FREESHIP | fixed_amount | 10.00 | 50.00 | - | 100 |
| BIGDEAL | percentage | 20% | 100.00 | 50.00 | 50 |

### 3.12 Other Purchase-Related Tables

**personalizations** (17 columns): Custom text/image overlays on products. FK to products and users.

**product_reviews** (16 columns): Ratings (1-5), moderation workflow (pending/approved/rejected), verified purchase flag, FK to products, users, orders.

**credit_transactions** (7 columns): Credit balance changes. FK to users. 4 rows exist.

**abandoned_carts** (11 columns): Cart recovery tracking with two-stage email workflow.

**product_labels** (4 columns): Tags like "new", "sale", "trending". FK to products.

**shipping_zones** (12 columns): Shipping rate configuration by country code.

---

## 4. Relationships & Integrity

### 4.1 Foreign Key Map (78 unique FKs)

All foreign keys across purchase-related tables:

| Source Table | Column | Target Table | Target Column |
|---|---|---|---|
| cart_items | product_id | products | id |
| cart_items | variant_id | product_variants | id |
| cart_items | user_id | users | id |
| cart_items | tenant_id | tenants | id |
| cart_items | personalization_id | personalizations | id |
| cart_items | composition_id | design_compositions | id |
| order_items | order_id | orders | id |
| order_items | product_id | products | id |
| order_items | variant_id | product_variants | id |
| orders | user_id | users | id |
| orders | tenant_id | tenants | id |
| products | category_id | categories | id |
| products | deleted_by | users | id |
| products | tenant_id | tenants | id |
| product_variants | product_id | products | id |
| product_reviews | product_id | products | id |
| product_reviews | user_id | users | id |
| product_reviews | order_id | orders | id |
| product_reviews | moderated_by | users | id |
| return_requests | order_id | orders | id |
| return_requests | user_id | users | id |
| return_requests | approved_by | users | id |
| returns | order_id | orders | id |
| returns | customer_id | users | id |
| returns | resolved_by | users | id |
| shipping_addresses | user_id | users | id |
| wishlists | user_id | users | id |
| wishlists | tenant_id | tenants | id |
| wishlist_items | wishlist_id | wishlists | id |
| wishlist_items | product_id | products | id |
| wishlist_items | variant_id | product_variants | id |
| users | tenant_id | tenants | id |
| categories | parent_id | categories | id |
| categories | tenant_id | tenants | id |
| notifications | user_id | users | id |
| credit_transactions | user_id | users | id |
| referrals | referrer_id | users | id |
| referrals | referred_id | users | id |
| coupons | *(none)* | *(none)* | *(none)* |

### 4.2 Missing Foreign Keys & Integrity Gaps

| Table | Column | Expected FK | Issue |
|---|---|---|---|
| coupons | *(no FK at all)* | Should FK to tenants if multi-tenant | Coupons are global; any tenant can use any coupon |
| newsletter_subscribers | *(no FK)* | Should FK to tenants | Subscriber lists are global |
| blog_posts | author_id | users | FK exists, but no tenant_id means blog content is shared across tenants |
| order_items | *(no index on order_id)* | - | FK exists but no index for joins |
| shipping_zones | *(no FK)* | Should FK to tenants | Shipping rates are global |
| admin_settings | *(no FK)* | Should FK to tenants | Settings are global (single row, id=1) |
| product_variants | *(no index on product_id beyond unique)* | - | Only unique composite index, no simple FK index for range scans |

### 4.3 Index Coverage Analysis

**Well-indexed tables**:
- `users`: 8 indexes including partial indexes for deletion lifecycle
- `products`: 16 indexes covering status, category, tags, cost, provider
- `orders`: 13 indexes covering user, status, Stripe session, retry logic
- `cart_items`: 8 indexes including unique constraints for deduplication

**Under-indexed tables**:

| Table | Missing Index | Impact |
|---|---|---|
| order_items | `idx_order_items_order_id (order_id)` | Every order detail lookup is a seq scan |
| order_items | `idx_order_items_product_id (product_id)` | Product sales queries are slow |
| orders | `idx_orders_tenant_id (tenant_id)` | Tenant-scoped order queries lack index |
| products | `idx_products_tenant_id (tenant_id)` | Tenant-scoped product queries (beyond the partial on category_id) |
| notifications | No tenant index | Already filtered by user_id which is good |
| product_variants | Simple `idx_product_variants_product_id` | Only unique composite exists |

### 4.4 Orphan Risk Analysis

```sql
-- All FK integrity checks pass:
```

| FK Path | Orphan Count |
|---|---|
| order_items -> orders | 0 |
| order_items -> products | 0 |
| order_items -> product_variants | 0 |
| cart_items -> products | 0 |
| wishlist_items -> products | 0 |
| returns -> orders | 0 |
| return_requests -> orders | 0 |

**No orphan records detected.** All FK constraints are properly enforced.

**Potential orphan risks**:
- Soft-deleted products (`deleted_at IS NOT NULL`) are still referenced by `order_items`, `cart_items`, `wishlist_items`. This is correct behavior (preserving history) but could cause display issues if the UI does not handle deleted products gracefully.
- `orders.user_id` is nullable (for guest checkout). 6 orders have NULL `user_id`, meaning they cannot be associated with a user account.

---

## 5. Data State

### 5.1 Row Counts

| Table | Rows |
|---|---|
| tenants | 2 |
| tenant_members | 0 |
| tenant_configs | 0 |
| users | 25 |
| products | 123 |
| product_variants | 1,863 |
| categories | 61 |
| orders | 24 |
| order_items | 1 |
| cart_items | 0 |
| wishlists | 5 |
| wishlist_items | 0 |
| return_requests | 2 |
| returns | 0 |
| shipping_addresses | 0 |
| notifications | 60 |
| coupons | 4 |
| product_reviews | 0 |
| personalizations | 0 |
| credit_transactions | 4 |
| abandoned_carts | 0 |
| designs | 80 |
| product_labels | 0 |
| analytics_events | 0 |
| conversations | 14 |
| blog_posts | 0 |
| newsletter_subscribers | 2 |
| admin_roles | 4 |
| user_roles | 2 |
| store_themes | 12 |

### 5.2 Order Status Distribution

| Status | Count | Earliest | Latest |
|---|---|---|---|
| delivered | 10 | 2026-02-13 | 2026-02-22 |
| shipped | 8 | 2026-02-09 | 2026-02-22 |
| paid | 6 | 2026-02-14 | 2026-02-14 |

No orders in pending, submitted, in_production, cancelled, or refunded status.

### 5.3 Product Status by Tenant

| Status | Tenant | Count |
|---|---|---|
| active | test-tenant-1771763386450 | 75 |
| deleted | test-tenant-1771763386450 | 39 |
| archived | test-tenant-1771763386450 | 9 |

All 123 products belong to the primary tenant. Tenant B has 0 products.

### 5.4 Product Variants Quality

| Metric | Count |
|---|---|
| Total variants | 1,863 |
| Enabled | 1,675 |
| Disabled | 188 |
| With image_url | 1,848 |
| Without image_url | 15 |
| With cost_cents | 1,330 |
| Without cost_cents | 533 |

**FINDING**: 533 variants (28.6%) have no cost_cents. This means margin calculations will fail for these variants.

### 5.5 Orders with Missing Required Fields

| Issue | Count | IDs |
|---|---|---|
| user_id IS NULL | 6 | All 6 are in 'paid' status -- these appear to be test/guest orders |
| customer_email IS NULL | 9 | Mix of delivered and shipped -- no email for order confirmations |
| shipping_address IS NULL | 5 | 2 delivered (no address?), 1 paid, 2 delivered (recent) |

**17 of 24 orders (70.8%)** have at least one missing required field. This indicates the orders are mostly test data, not real transactions.

**Breakdown of orders missing data**:
- 2 orders: missing email AND address (both delivered -- suspicious)
- 7 orders: missing email only
- 3 orders: missing address only
- 6 orders: missing user_id (paid status)

### 5.6 Users with Deletion Requests

```sql
SELECT * FROM users WHERE deletion_requested_at IS NOT NULL OR deleted_at IS NOT NULL;
-- 0 rows
```

No users have pending deletion requests or have been soft-deleted.

---

## 6. Critical Findings Summary

### CRITICAL (Security / Data Integrity)

1. **Hardcoded default tenant_id**: All data tables default to the primary tenant UUID. The `handle_new_user()` trigger does not set `tenant_id`, so all new users silently join the primary tenant regardless of which domain they register from.

2. **Incomplete tenant isolation**: 18 tables lack `tenant_id`, including `coupons`, `newsletter_subscribers`, `blog_posts`, `shipping_zones`, and `admin_settings`. These are shared globally across all tenants.

3. **`tenant_configs` has NO RLS**: Any authenticated user can read all tenant configurations via the anon Supabase client.

4. **`admin_settings` has NO RLS**: Global settings table is unprotected.

5. **Products RLS fallback**: The `products_tenant_select` policy shows ALL products when `get_current_tenant_id()` returns NULL. This is intentional for the primary domain but means any unauthenticated request (or one without JWT/GUC tenant context) sees all products across all tenants.

6. **Cart items have no tenant check in RLS**: Isolation is only by `user_id`, not `tenant_id`.

### HIGH (Performance / Data Quality)

7. **Missing index on `order_items.order_id`**: Every order detail lookup requires a sequential scan.

8. **Missing tenant_id indexes**: `orders` and `products` lack indexes on `tenant_id` for multi-tenant query performance.

9. **23 out of 24 orders have no order_items**: Only 1 order has associated line items. This means order totals cannot be verified against item-level data.

10. **70.8% of orders have missing fields**: Likely test data, but indicates no server-side validation enforcing required fields.

11. **Duplicate returns tables**: Both `return_requests` (2 rows) and `returns` (0 rows) exist with overlapping purpose.

### MEDIUM (Design)

12. **533 variants (28.6%) missing cost_cents**: Margin calculations will be inaccurate.

13. **15 variants missing image_url**: These will show broken images or fallback in the storefront.

14. **No `product_variants.product_id` simple index**: Only unique composite indexes exist; range scans on product_id are not optimized.

15. **Coupons are tenant-agnostic**: All tenants share the same coupon codes. No way to create tenant-specific promotions.
