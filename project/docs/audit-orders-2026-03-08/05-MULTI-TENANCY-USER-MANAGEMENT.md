# Multi-Tenancy & User Management Audit

**Date**: 2026-03-08
**Auditor**: Claude Opus 4.6 (automated)
**Scope**: Tenant architecture, tenant isolation, user management, session management, admin access control, RLS analysis

---

## Executive Summary

The multi-tenancy system is **architecturally incomplete and non-functional in production**. While the schema supports multi-tenancy (12 tables have `tenant_id`, RLS policies reference `get_current_tenant_id()`), the system operates as a **single-tenant application with multi-tenant scaffolding**. All 25 users and all data belong to a single hardcoded tenant (`f1c548a3`). The `get_current_tenant_id()` SQL function **always returns NULL** because no JWT claims or GUC settings are ever populated. Since the app uses the service-role key (which bypasses RLS) for virtually all API routes, tenant isolation depends entirely on application-level `x-tenant-id` header filtering -- which is implemented in only **7 out of 80+ routes**. This means that if a second tenant is ever created, **cross-tenant data leakage is guaranteed** across 73+ API routes.

**Overall Risk: CRITICAL** -- The system must not be operated as a multi-tenant platform without fundamental redesign.

---

## 1. Tenant Architecture

### 1.1 Schema

**`tenants` table** (19 columns):

| Column | Type | Notable |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `name` | VARCHAR | NOT NULL |
| `slug` | VARCHAR | NOT NULL |
| `owner_id` | UUID FK | References auth user |
| `domain` | TEXT | Custom domain for tenant resolution |
| `plan` | TEXT | Default `'free'` |
| `status` | TEXT | Default `'active'` |
| `subscription_tier` | VARCHAR | Default `'starter'` |
| `max_products` | INT | Default 25 |
| `max_orders_per_month` | INT | Default 50 |
| `max_team_members` | INT | Default 1 |
| `stripe_customer_id` | VARCHAR | Nullable |
| `stripe_subscription_id` | VARCHAR | Nullable |

**`tenant_configs`** -- KV store for per-tenant configuration. **Currently empty** (0 rows).

**`tenant_members`** -- Team membership table. **Currently empty** (0 rows).

### 1.2 Existing Tenants

| Tenant ID | Name | Slug | Owner | Domain | Plan | Status |
|---|---|---|---|---|---|---|
| `f1c548a3-b69d-4328-a372-c4924a660044` | Test Tenant for Grace Period | test-tenant-1771763386450 | `75a30307` (e2e-test@example.com) | (none) | free | active |
| `e99b56d7-f597-4101-a1fd-bfcd30e7a7d9` | Tenant B Test Store | tenant-b-test | `75a30307` (e2e-test@example.com) | tenantb.test | free | active |

**Finding [CRITICAL]**: Only 2 tenants exist, both created by the same test user. The primary tenant (`f1c548a3`) is named "Test Tenant for Grace Period" -- this is clearly test data serving as the default tenant for all users. The second tenant (`e99b56d7`) has no users, orders, or products assigned to it.

### 1.3 Tables With `tenant_id` Column

12 tables have the column: `analytics_events`, `cart_items`, `categories`, `conversations`, `designs`, `orders`, `products`, `store_themes`, `tenant_configs`, `tenant_members`, `users`, `wishlists`.

### 1.4 Tables Missing `tenant_id` (That Should Have It)

**87 tables lack `tenant_id`**, including high-risk tables:

| Table | Has user_id | Risk if Multi-Tenant |
|---|---|---|
| `order_items` | No (has order_id FK) | HIGH -- items visible cross-tenant via service role |
| `shipping_addresses` | Yes | HIGH -- no tenant scoping |
| `notifications` | Yes | MEDIUM -- user-scoped but no tenant isolation |
| `product_reviews` | Yes | HIGH -- reviews visible cross-tenant |
| `product_variants` | No (has product_id FK) | HIGH -- variants exposed cross-tenant |
| `credit_transactions` | Yes | MEDIUM |
| `design_compositions` | Yes | MEDIUM |
| `coupons` | No | HIGH -- coupons shared across tenants |
| `newsletter_subscribers` | Nullable | HIGH |
| `push_subscriptions` | Yes | LOW |
| `referrals` | Yes | LOW |
| `return_requests` | Yes | MEDIUM |
| `abandoned_carts` | Yes | LOW |

---

## 2. Tenant Isolation -- CRITICAL ANALYSIS

### 2.1 `get_current_tenant_id()` Function

```sql
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
$$;
```

**Finding [CRITICAL]**: This function **ALWAYS returns NULL** because:
1. No JWT `app_metadata.tenant_id` claim is ever set during login/registration
2. No `SET LOCAL app.tenant_id = '...'` is ever executed before queries
3. Verified by direct query: `SELECT get_current_tenant_id(); -- returns NULL`

### 2.2 RLS Policies Referencing Tenants

The tenant-aware RLS policies on `products`, `orders`, and `conversations` all follow this pattern:

```sql
USING (
  auth.role() = 'service_role'
  OR get_current_tenant_id() IS NULL
  OR tenant_id = get_current_tenant_id()
)
```

**Finding [CRITICAL]**: Because `get_current_tenant_id()` always returns NULL, the `IS NULL` clause **always matches**, making every tenant-aware policy **effectively a pass-through**. Even if the anon key were used instead of service-role, all data from all tenants would be visible.

### 2.3 Service-Role Key Usage

The `supabaseAdmin` client uses `SUPABASE_SERVICE_KEY` which has the `service_role` role and **bypasses ALL RLS policies entirely**.

**Finding [CRITICAL]**: Virtually all API routes (estimated 76 out of 80+) use `supabaseAdmin` or a direct `createClient(...serviceKey)`. This means:
- RLS policies are **irrelevant** for API route queries
- Tenant isolation depends **entirely** on application-level `.eq('tenant_id', ...)` filtering
- Any route that forgets the filter exposes all tenants' data

### 2.4 API Route Tenant Isolation Matrix

Routes that **DO** filter by `x-tenant-id`:

| Route | Method | Auth Required | Tenant Filter | Notes |
|---|---|---|---|---|
| `/api/products` | GET | No | Yes (conditional) | Only when header present |
| `/api/products` | POST | No* | Yes (conditional) | Sets tenant_id on insert |
| `/api/orders` | GET | Yes | Yes (conditional) | Only when header present |
| `/api/storefront/theme` | GET | No | Yes | Falls back to global theme |
| `/api/storefront/branding` | GET | No | Yes | Returns empty if no header |
| `/api/shipping-addresses` | GET | Yes | Yes (conditional) | Only when header present |
| `/api/user/profile` | GET | Yes | Yes (conditional) | Only when header present |
| `/api/checkout/create-session` | POST | No | Yes (conditional) | Plan gate check |

Routes that **DO NOT** filter by tenant_id (critical omissions):

| Route | Method | Auth | Accesses Table | Risk |
|---|---|---|---|---|
| `/api/cart` | GET/POST/PATCH/DELETE | Optional | cart_items | **HIGH** -- cart_items has tenant_id but route ignores it |
| `/api/cart/merge` | POST | Yes | cart_items | **HIGH** |
| `/api/wishlist` | GET/POST/DELETE/PATCH | Yes | wishlists | **HIGH** -- wishlists has tenant_id but route ignores it |
| `/api/wishlist/items` | POST/DELETE | Yes | wishlist_items | **HIGH** |
| `/api/wishlist/share` | POST | Yes | wishlists | MEDIUM |
| `/api/wishlist/sync` | POST | Yes | wishlists | **HIGH** |
| `/api/conversations` | GET | Yes | conversations | **HIGH** -- has tenant_id, not filtered |
| `/api/conversations/[id]` | GET/DELETE | Yes | conversations, messages | **HIGH** |
| `/api/designs` | GET/POST | Optional | designs | **HIGH** -- has tenant_id, not filtered |
| `/api/designs/generate` | POST | Yes | ai_generations | MEDIUM |
| `/api/designs/compose` | POST | Yes | design_compositions | MEDIUM |
| `/api/designs/history` | GET | Yes | designs | **HIGH** |
| `/api/notifications` | GET | Yes | notifications | MEDIUM -- no tenant_id column exists |
| `/api/notifications/[id]/read` | PATCH | Yes | notifications | LOW |
| `/api/reviews` | GET/POST | Optional | product_reviews | **HIGH** -- no tenant_id |
| `/api/orders/[id]` | GET | Yes | orders, order_items | MEDIUM -- user-scoped but no tenant check |
| `/api/orders/[id]/returns` | GET/POST | Yes | return_requests | MEDIUM |
| `/api/orders/[id]/reorder` | POST | Yes | orders, cart_items | **HIGH** |
| `/api/products/[id]` | GET | No | products, variants | MEDIUM -- single product fetch, public |
| `/api/products/[id]/cross-sell` | GET | No | products | LOW |
| `/api/products/trending` | GET | No | products | MEDIUM -- no tenant filter on trending |
| `/api/categories` | GET | No | categories | MEDIUM -- has tenant_id, not filtered |
| `/api/coupons/validate` | POST | No | coupons | **HIGH** -- no tenant scoping at all |
| `/api/newsletter/subscribe` | POST | No | newsletter_subscribers | MEDIUM |
| `/api/referral` | GET/POST | Yes | referrals | LOW |
| `/api/profile/*` | Various | Yes | users, shipping_addresses | MEDIUM |
| `/api/admin/orders` | GET | Admin | orders (ALL) | **CRITICAL** -- admin sees ALL tenants' orders |
| `/api/admin/returns` | GET | Admin | returns (ALL) | **CRITICAL** -- admin sees ALL tenants' returns |
| `/api/admin/designs/moderate` | PATCH | Admin | designs (ALL) | HIGH |
| `/api/checkout/create-session` | POST | No | products, cart_items | **HIGH** (only checks gate, not data) |
| `/api/push/send` | POST | Admin | push_subscriptions | HIGH -- sends to ALL tenants |
| `/api/cron/*` (all 7 routes) | GET | Cron | various | N/A -- internal, but no tenant scoping |

**Summary**: Of ~80 data-accessing routes, only **7 routes** filter by tenant. **73+ routes have zero tenant isolation**.

---

## 3. User Management

### 3.1 User Roles

| Role | Count | Emails |
|---|---|---|
| `admin` | 4 | admin@podclaw.com, admin@podai.com, admin@podstore.local, viewer@podstore.local |
| `customer` | 21 | Mix of real and test accounts |

**Finding [MEDIUM]**: `viewer@podstore.local` has `role=admin` -- this appears to be a test account with elevated privileges. The name "viewer" suggests it should have read-only access.

### 3.2 Role Assignment

- Roles are set in the `users` table (column `role`, default `'customer'`)
- The `user_roles` table exists (RLS enabled) but is separate from the `users.role` column
- Registration (`/api/auth/register`) does NOT set a role -- it uses the DB default (`'customer'`)
- **No API endpoint exists to change roles** -- role changes require direct DB access
- The `users` RLS UPDATE policy prevents users from changing their own role:
  ```sql
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM users WHERE id = auth.uid()))
  ```

**Finding [MEDIUM]**: Role management is purely manual (direct DB). No admin UI or API for promoting/demoting users.

### 3.3 Registration Flow

1. Client POSTs to `/api/auth/register` with name, email, password, turnstileToken
2. Turnstile CAPTCHA verification (gracefully skips if not configured)
3. Password validation (8+ chars, 1 uppercase, 1 number)
4. `supabaseAdmin.auth.signUp()` creates auth user
5. Insert into `users` table with hardcoded defaults:
   - `locale: 'en'`, `currency: 'EUR'`, `email_verified: false`
   - **No tenant_id set** -- falls through to column default `'f1c548a3...'`

**Finding [HIGH]**: Registration always assigns users to the hardcoded default tenant. There is no mechanism to register a user for a specific tenant, even if accessed via a custom domain.

### 3.4 Test Users in Production Database

**22 out of 25 users** have test/example email addresses:

- `e2e-test@example.com`, `testuser@example.com`, `test@example.com`
- `past-due-test@example.com`, `cancelled-test@example.com`
- `admin@podstore.local`, `viewer@podstore.local`
- `admin@podplatform.test`, `customer1@podplatform.test`, `customer2@podplatform.test`
- Various `testuser*.example.com` addresses
- `deleted_*.deleted.local` (soft-deleted account)

**Finding [HIGH]**: The production database is contaminated with test data. Only 3 accounts appear to be real: `admin@podclaw.com`, `admin@podai.com`, `l.roy.lwe@gmail.com`.

---

## 4. Session Management

### 4.1 Authentication Flow

1. **Login**: Client POSTs to `/api/auth/login` with email/password
2. **Supabase Auth**: `signInWithPassword()` using anon key
3. **Tokens in httpOnly cookies**:
   - `sb-access-token` (Supabase JWT, 1 hour TTL)
   - `sb-refresh-token` (7 day TTL)
4. **Session check**: Client polls `/api/auth/session` on mount + every 5 minutes
5. **Token refresh**: `/api/auth/session` auto-refreshes expired access tokens
6. **Cross-tab sync**: `localStorage` event (`pod-auth-sync`) broadcasts login/logout to other tabs

### 4.2 Session Isolation

**Finding [HIGH]**: Sessions have **zero tenant isolation**:
- The JWT token contains no tenant_id claim (confirmed: `get_current_tenant_id()` returns NULL)
- The `sb-access-token` cookie has `path: '/'` and `sameSite: 'lax'` -- it would be sent to any domain that resolves to the same application
- If two tenants share the same Next.js instance (as designed), a user logged into Tenant A's domain could access Tenant B's data via API calls

### 4.3 x-tenant-id Cookie

The middleware caches the resolved `x-tenant-id` in a cookie (5 min TTL, httpOnly, lax). This cookie is:
- Set when a non-primary domain is resolved to a tenant
- Forwarded as a request header to API routes

**Finding [MEDIUM]**: The `x-tenant-id` cookie could be manipulated by a client (it's set via middleware but a malicious client could set it before the request). However, since it's httpOnly, this requires intercepting the request flow, which is lower risk.

---

## 5. Admin Access Control

### 5.1 Admin Authentication

Admin routes use `requireAdmin()` from `auth-guard.ts`:
1. Extracts JWT from `sb-access-token` cookie
2. Verifies with `supabase.auth.getUser(token)` (service role client)
3. Queries `users.role` for the authenticated user
4. Rejects if role is not `'admin'`

### 5.2 Admin Route Inventory

| Route | Auth | Tenant-Scoped | Description |
|---|---|---|---|
| `/api/admin/orders` | `requireAdmin` | **NO** | View ALL orders across ALL tenants |
| `/api/admin/returns` | `requireAdmin` | **NO** | View ALL returns |
| `/api/admin/returns/[id]` | `requireAdmin` | **NO** | Manage specific return |
| `/api/admin/designs/moderate` | `requireAdmin` | **NO** | Moderate ALL designs |
| `/api/admin/fix-publishing` | `requireAdmin` | **NO** | Fix product publishing status |
| `/api/admin/translations` | `requireAdmin` | **NO** | Manage translations |
| `/api/admin/sitemap` | `requireAdmin` | **NO** | Regenerate sitemap |
| `/api/admin/alert` | `requireAdmin` | **NO** | Send alerts |
| `/api/admin/migrate` | `requireAdmin` | **NO** | Run migrations |
| `/api/admin/seed-branded` | None visible | **NO** | Seed products (no auth check!) |
| `/api/admin/seed-hats` | None visible | **NO** | Seed hat products (no auth check!) |
| `/api/analytics/[type]` | `requireAdmin` | **NO** | View analytics |
| `/api/marketing/content` | `requireAdmin` | **NO** | Marketing content |
| `/api/marketing/test-ad-copy` | `requireAdmin` | **NO** | Test ad copy |
| `/api/push/send` | `requireAdmin` | **NO** | Send push to ALL users |
| `/api/rag/*` | `requireAdmin` | **NO** | RAG document management |

**Finding [CRITICAL]**: Admin access is **global, not tenant-scoped**. Any admin from any tenant can see and manage ALL tenants' data. In a true multi-tenant scenario, admin@podclaw.com could see orders from Tenant B.

**Finding [HIGH]**: `/api/admin/seed-branded` and `/api/admin/seed-hats` appear to lack authentication checks. These are seed routes but could be invoked by anyone.

### 5.3 Admin Role is Not Tenant-Bound

The `requireAdmin()` function checks `users.role === 'admin'` globally. There is no concept of "admin of Tenant X". All 4 admin accounts belong to tenant `f1c548a3` but could theoretically administer any tenant's data.

---

## 6. User Data Isolation

### 6.1 Per-Table Analysis

| Table | Has user_id | Has tenant_id | API Filters by user_id | API Filters by tenant_id | Effective Isolation |
|---|---|---|---|---|---|
| `orders` | Yes | Yes | Yes | Conditional (7 routes) | User-level only |
| `order_items` | No (FK) | No | Via order FK | No | User-level via FK |
| `cart_items` | Yes | Yes | Yes | **No** | User-level only |
| `wishlists` | Yes | Yes | Yes | **No** | User-level only |
| `wishlist_items` | No (FK) | No | Via wishlist FK | No | User-level via FK |
| `designs` | Yes | Yes | Yes | **No** | User-level only |
| `conversations` | Yes | Yes | Yes | **No** | User-level only |
| `messages` | No (FK) | No | Via conversation FK | No | User-level via FK |
| `notifications` | Yes | No | Yes | N/A | User-level only |
| `shipping_addresses` | Yes | **No** | Yes | Conditional | User-level only |
| `product_reviews` | Yes | No | Partial | No | Mixed (public read) |
| `products` | No | Yes | N/A (public) | Conditional | Tenant-conditional |
| `categories` | No | Yes | N/A (public) | **No** | **None** |
| `coupons` | No | No | N/A | N/A | **None** |
| `newsletter_subscribers` | Nullable | No | N/A | N/A | **None** |
| `credit_transactions` | Yes | No | Yes | No | User-level only |

### 6.2 Cross-Tenant Data Leak Scenarios

Currently no actual leak exists because only 1 tenant has data. However, if Tenant B were populated:

1. **Products**: GET `/api/products` without `x-tenant-id` header returns ALL tenants' products
2. **Categories**: Always returns all categories regardless of tenant
3. **Coupons**: No tenant scoping -- Tenant A's coupon works on Tenant B
4. **Cart**: User from Tenant A can add Tenant B's products to cart
5. **Admin**: Any admin can manage all tenants' orders, returns, designs
6. **Newsletter**: All subscribers in one pool
7. **Trending**: `/api/products/trending` shows products from all tenants
8. **Search**: Hybrid search has no tenant filter

---

## 7. RLS (Row Level Security) Analysis

### 7.1 RLS Enablement

**All 99 tables** (74 base + 25 partitions) have RLS enabled. No table lacks RLS.

### 7.2 Policy Effectiveness

| Category | Count | Assessment |
|---|---|---|
| `service_role` bypass policies (`qual = true`) | 30+ | Expected -- service role inherently bypasses, these are redundant |
| User-scoped policies (`auth.uid() = user_id`) | ~15 | Correct for user isolation when anon key used |
| Tenant-aware policies (reference `get_current_tenant_id()`) | 3 | **Broken** -- always return NULL |
| Public read policies (`qual = true` for SELECT) | ~10 | Expected for public data (translations, legal pages, etc.) |
| Admin-gated policies | ~5 | Check `users.role = 'admin'` via subquery |

### 7.3 Critical RLS Issues

**Finding [CRITICAL]**: The 3 tenant-aware policies (on `products`, `orders`, `conversations`) are **non-functional** because `get_current_tenant_id()` always returns NULL, and the policies have `OR get_current_tenant_id() IS NULL` which makes them pass-through.

**Finding [HIGH]**: The `products_tenant_select` policy is the ONLY RLS policy on `products`. This means:
- No INSERT, UPDATE, or DELETE policies exist for products (only service_role can write)
- The SELECT policy allows reading ALL products when `get_current_tenant_id()` is NULL (which is always)

**Finding [MEDIUM]**: Many tables have only `service_role ALL = true` policies, meaning if the anon key were ever used to query them, all data would be exposed. This is currently mitigated by consistent use of service-role key.

### 7.4 RLS Is Irrelevant in Current Architecture

Since 76+ out of 80 API routes use the service-role key, RLS policies serve as a **secondary defense that is never exercised**. The application relies entirely on application-level filtering (`.eq('user_id', user.id)`), which:
- Works for user isolation (each route explicitly filters)
- **Fails completely for tenant isolation** (most routes don't filter by tenant_id)

---

## 8. Middleware & Request Flow

### 8.1 Request Flow

```
Browser Request
  |
  v
middleware.ts
  |-- Tenant Resolution: hostname -> /api/tenant-resolve -> x-tenant-id header
  |-- CSRF Protection: validate double-submit cookie
  |-- Auth Check: verify sb-access-token for protected routes (/profile, /orders, /wishlist)
  |-- A/B Testing: assign variant cookies
  |
  v
API Route Handler
  |-- Optional: getAuthUser() or requireAuth() from auth-guard.ts
  |-- Uses supabaseAdmin (service-role, bypasses RLS)
  |-- Optional: reads x-tenant-id header and applies .eq('tenant_id', tenantId)
  |
  v
Supabase (service-role connection)
  |-- RLS bypassed
  |-- Returns unfiltered data unless app-level filter was applied
```

### 8.2 Tenant Resolution Path

1. Middleware checks if hostname is a primary domain (skapara.com, etc.)
2. If not primary, checks `x-tenant-id` cookie cache (5 min TTL)
3. If no cache, calls `/api/tenant-resolve?domain=hostname`
4. Tenant-resolve queries `tenants` table for matching domain
5. If found, sets `x-tenant-id` header on the request
6. API routes can optionally read this header

**Finding [MEDIUM]**: The tenant resolution only works for custom domains. Users on the primary domain (skapara.com) will **never** have `x-tenant-id` set, meaning their requests skip all tenant filtering. This is by design (primary domain = "platform" tenant) but means the primary tenant's data is always unscoped.

### 8.3 CSRF Protection Gaps

The middleware exempts admin and cron routes from CSRF:
```typescript
const isAdminOrCron = pathname.startsWith('/api/admin/') || pathname.startsWith('/api/cron/')
```

**Finding [LOW]**: Admin routes skip CSRF protection. While they require admin auth, a CSRF attack against an admin session could trigger admin operations.

---

## 9. Known Issues Verified

### 9.1 `get_current_tenant_id()` Always Returns NULL

**CONFIRMED**: Verified by direct SQL query. The function exists but neither data source (JWT claim, GUC setting) is ever populated.

### 9.2 Service-Role Key Bypasses ALL RLS

**CONFIRMED**: `supabaseAdmin` uses `SUPABASE_SERVICE_KEY` and is used in 76+ routes. All RLS policies are bypassed.

### 9.3 Anonymous Cart Session Leak

Cart items use `session_id` for guest carts (UUID generated and stored in `cart-session-id` cookie). The cookie is:
- httpOnly, secure in production, sameSite=lax, 30-day TTL
- The `session_id` is a random UUID -- low risk of collision
- **Finding [LOW]**: Cart sessions are adequately isolated for single-tenant. For multi-tenant, guest carts would need tenant scoping.

### 9.4 Test Users in Production

**CONFIRMED**: 22 out of 25 users are test accounts. Notable risks:
- `past-due-test@example.com` has `tier=premium` with `subscription_status=past_due`
- `cancelled-test@example.com` has `subscription_status=cancelled`
- Multiple admin accounts with test domains (`@podstore.local`, `@podplatform.test`)

---

## 10. Recommendations

### P0 -- Must Fix Before Production (Multi-Tenant)

| # | Finding | Severity | Recommendation |
|---|---|---|---|
| 1 | `get_current_tenant_id()` always returns NULL | CRITICAL | Either: (a) Set `app_metadata.tenant_id` in JWT during login/registration, OR (b) Abandon RLS-based tenant isolation entirely and enforce at app level |
| 2 | 73+ routes have no tenant filtering | CRITICAL | Create middleware-level tenant injection that wraps supabaseAdmin queries, or add tenant filter to every route |
| 3 | Admin routes are not tenant-scoped | CRITICAL | Add tenant context to admin routes; admins should only manage their own tenant's data |
| 4 | Registration doesn't set tenant from request context | HIGH | Read `x-tenant-id` from middleware and set `tenant_id` on new user records |
| 5 | 87 tables missing `tenant_id` column | HIGH | Add `tenant_id` to `order_items`, `shipping_addresses`, `notifications`, `product_reviews`, `product_variants`, `coupons`, and other data tables |
| 6 | Service-role key used everywhere | HIGH | Migrate to user-scoped Supabase clients where possible, use service-role only for admin/cron operations |

### P1 -- Must Fix Before Production (Any Mode)

| # | Finding | Severity | Recommendation |
|---|---|---|---|
| 7 | 22 test users in production DB | HIGH | Purge all test accounts before production launch |
| 8 | Default tenant named "Test Tenant for Grace Period" | HIGH | Rename or recreate the primary tenant with production-appropriate metadata |
| 9 | `viewer@podstore.local` has admin role | MEDIUM | Remove or downgrade this test account |
| 10 | No role management API/UI | MEDIUM | Build admin endpoint for role assignment with audit logging |
| 11 | `/api/admin/seed-*` routes may lack auth | HIGH | Add `requireAdmin()` check or remove seed routes from production |
| 12 | CSRF exemption for admin/cron routes | LOW | Add CSRF protection to admin routes (cron routes can remain exempt if using internal auth) |

### P2 -- Architecture Decision Required

| # | Decision | Options |
|---|---|---|
| 13 | Multi-tenancy model | **Option A**: Abandon multi-tenancy, operate as single-tenant SaaS (simplest). Remove `tenant_id` columns and related complexity. **Option B**: Fix multi-tenancy properly -- populate JWT claims, enforce at every layer, add tenant context to all 87 missing tables. **Option C**: Database-per-tenant isolation (most secure but operationally complex). |
| 14 | RLS strategy | If keeping multi-tenancy: switch from service-role to user-scoped clients for user-facing routes. If single-tenant: RLS provides defense-in-depth for user isolation -- keep but simplify policies. |
| 15 | Admin model | If multi-tenant: implement tenant-admin vs super-admin roles. If single-tenant: current global admin is sufficient but limit to named accounts. |

### Recommended Priority

If the system is intended to remain **single-tenant** (which appears to be the actual use case -- a single Skapara store):
1. Clean test data (users, tenants) -- P1
2. Remove unused multi-tenant scaffolding to reduce complexity -- P2
3. Ensure all routes use `requireAuth()` + user_id filtering -- P1
4. Remove seed routes or protect them -- P1

If the system will become **multi-tenant**:
1. Fix `get_current_tenant_id()` by embedding tenant_id in JWT -- P0
2. Add tenant_id to all 87 missing tables -- P0
3. Add tenant filter to all 73+ routes -- P0
4. Implement tenant-scoped admin -- P0
5. Switch to user-scoped Supabase clients -- P0/P1
6. Add integration tests for cross-tenant isolation -- P0

---

## Appendix A: Full Route Auth & Tenant Matrix

| Route | Method | Auth Method | Uses Service Role | Tenant Filter | Risk Level |
|---|---|---|---|---|---|
| `/api/auth/login` | POST | None (login endpoint) | No (anon key) | No | LOW |
| `/api/auth/register` | POST | None (public) | Yes | No (hardcoded default) | HIGH |
| `/api/auth/session` | GET | Cookie check | Yes | No | LOW |
| `/api/auth/logout` | POST | None | No | N/A | LOW |
| `/api/auth/verify-email` | POST | Token param | Yes | No | LOW |
| `/api/auth/forgot-password` | POST | None (public) | Yes | No | LOW |
| `/api/auth/me` | GET | Cookie check | Yes | No | LOW |
| `/api/products` | GET | None (public) | Yes | **Yes** | LOW |
| `/api/products` | POST | None visible | Yes | **Yes** | MEDIUM |
| `/api/products/[id]` | GET | None (public) | Yes | No | MEDIUM |
| `/api/products/[id]/cross-sell` | GET | None (public) | Yes | No | LOW |
| `/api/products/[id]/social-proof` | GET | None (public) | Yes | No | LOW |
| `/api/products/trending` | GET | None (public) | Yes | No | MEDIUM |
| `/api/categories` | GET | None (public) | Yes | No | MEDIUM |
| `/api/categories/[slug]` | GET | None (public) | Yes | No | LOW |
| `/api/orders` | GET | `requireAuth` | Yes | **Yes** | LOW |
| `/api/orders/[id]` | GET | `requireAuth` | Yes | No | MEDIUM |
| `/api/orders/[id]/returns` | GET/POST | `requireAuth` | Yes | No | MEDIUM |
| `/api/orders/[id]/reorder` | POST | `requireAuth` | Yes | No | HIGH |
| `/api/orders/[id]/invoice` | GET | `requireAuth` | Yes | No | MEDIUM |
| `/api/cart` | GET/POST/PATCH/DEL | Cookie/session | Yes | No | HIGH |
| `/api/cart/merge` | POST | Cookie | Yes | No | HIGH |
| `/api/cart/shipping-estimate` | POST | None | Yes | No | LOW |
| `/api/checkout/create-session` | POST | None | Yes | Partial (gate) | HIGH |
| `/api/checkout/calculate-tax` | POST | None | Yes | No | LOW |
| `/api/wishlist` | GET/POST/DEL/PATCH | `requireAuth` | Yes | No | HIGH |
| `/api/wishlist/items` | POST/DELETE | `requireAuth` | Yes | No | HIGH |
| `/api/wishlist/share` | POST | `requireAuth` | Yes | No | MEDIUM |
| `/api/wishlist/sync` | POST | `requireAuth` | Yes | No | HIGH |
| `/api/wishlist/shared/[token]` | GET | None (public) | Yes | No | LOW |
| `/api/conversations` | GET | `requireAuth` | Yes | No | HIGH |
| `/api/conversations/[id]` | GET/DELETE | `requireAuth` | Yes | No | HIGH |
| `/api/designs` | GET/POST | `getAuthUser` | Yes | No | HIGH |
| `/api/designs/generate` | POST | `requireAuth` | Yes | No | MEDIUM |
| `/api/designs/ai-generate` | POST | `requireAuth` | Yes | No | MEDIUM |
| `/api/designs/ai-generate/refine` | POST | `requireAuth` | Yes | No | MEDIUM |
| `/api/designs/compose` | POST | Cookie check | Yes | No | MEDIUM |
| `/api/designs/compose-v2` | POST | Cookie check | Yes | No | MEDIUM |
| `/api/designs/remove-bg` | POST | `requireAuth` | Yes | No | LOW |
| `/api/designs/estimate` | POST | `getAuthUser` | No | No | LOW |
| `/api/designs/history` | GET | Cookie check | Yes | No | HIGH |
| `/api/designs/mockup` | POST | `getAuthUser` | No | No | LOW |
| `/api/design-assets/clipart` | GET | None | Yes | No | LOW |
| `/api/design-assets/templates` | GET | None | Yes | No | LOW |
| `/api/notifications` | GET | Cookie check | Yes | No | MEDIUM |
| `/api/notifications/[id]/read` | PATCH | Cookie check | Yes | No | LOW |
| `/api/notifications/read-all` | PATCH | Cookie check | Yes | No | LOW |
| `/api/notifications/count` | GET | Cookie check | Yes | No | LOW |
| `/api/notifications/unread-count` | GET | Cookie check | Yes | No | LOW |
| `/api/reviews` | GET/POST | Cookie check | Yes | No | HIGH |
| `/api/reviews/upload-photos` | POST | Cookie check | Yes | No | LOW |
| `/api/shipping-addresses` | GET/POST | Cookie check | Yes | **Yes** (GET only) | HIGH |
| `/api/shipping-addresses/[id]` | PATCH/DELETE | Cookie check | Yes | No | MEDIUM |
| `/api/user/profile` | GET/PATCH | Cookie check | Yes | **Yes** (GET only) | MEDIUM |
| `/api/profile/avatar` | POST | Cookie check | Yes | No | LOW |
| `/api/profile/change-password` | POST | Cookie check | Yes | No | LOW |
| `/api/profile/change-email` | POST | Cookie check | Yes | No | LOW |
| `/api/profile/delete` | POST | Cookie check | Yes | No | LOW |
| `/api/profile/cancel-deletion` | POST | Cookie check | Yes | No | LOW |
| `/api/profile/export` | GET | Cookie check | Yes | No | MEDIUM |
| `/api/profile/payment-methods` | GET | Cookie check | Yes | No | LOW |
| `/api/profile/payment-methods/[id]` | DELETE | Cookie check | Yes | No | LOW |
| `/api/consent` | POST | Cookie check | Yes | No | LOW |
| `/api/referral` | GET/POST | `requireAuth` | Yes | No | LOW |
| `/api/push/subscribe` | POST | `requireAuth` | Yes | No | LOW |
| `/api/push/send` | POST | `requireAdmin` | Yes | No | HIGH |
| `/api/newsletter/subscribe` | POST | None | Yes | No | MEDIUM |
| `/api/newsletter/unsubscribe` | GET/POST | None (token) | Yes | No | LOW |
| `/api/newsletter/campaigns` | GET | None visible | Yes | No | MEDIUM |
| `/api/newsletter/confirm/[token]` | GET | None (token) | Yes | No | LOW |
| `/api/coupons/validate` | POST | None | Yes | No | HIGH |
| `/api/subscription/create` | POST | `requireAuth` | Yes | No | LOW |
| `/api/subscription/portal` | POST | `requireAuth` | Yes | No | LOW |
| `/api/subscription/usage` | GET | `requireAuth` | Yes | No | LOW |
| `/api/billing/portal` | POST | `requireAuth` | Yes | No | LOW |
| `/api/usage/status` | GET | `getAuthUser` | No | No | LOW |
| `/api/session/migrate` | POST | `requireAuth` | Yes | No | LOW |
| `/api/ab-test/events` | POST | `getAuthUser` | Yes | No | LOW |
| `/api/ab-test/experiments` | GET/POST | `requireAdmin` | Yes | No | LOW |
| `/api/ab-test/experiments/[id]` | GET/PATCH | `requireAdmin` | Yes | No | LOW |
| `/api/analytics/[type]` | GET | `requireAdmin` | Yes | No | MEDIUM |
| `/api/analytics/track` | POST | None | Yes | No | LOW |
| `/api/storefront/theme` | GET | None | Yes | **Yes** | LOW |
| `/api/storefront/branding` | GET | None | Yes | **Yes** | LOW |
| `/api/storefront/personalization-surcharge` | GET | None | No | No | LOW |
| `/api/tenant-resolve` | GET | None | Yes | N/A (infra) | LOW |
| `/api/tenant/gate` | GET/POST | None | Yes | N/A (infra) | MEDIUM |
| `/api/verify-domain` | GET | None | Yes | N/A (infra) | LOW |
| `/api/admin/orders` | GET | `requireAdmin` | Yes | **No** | CRITICAL |
| `/api/admin/returns` | GET | `requireAdmin` | Yes | **No** | CRITICAL |
| `/api/admin/returns/[id]` | PATCH | `requireAdmin` | Yes | **No** | HIGH |
| `/api/admin/designs/moderate` | PATCH | `requireAdmin` | Yes | **No** | HIGH |
| `/api/admin/fix-publishing` | POST | `requireAdmin` | Yes | **No** | HIGH |
| `/api/admin/translations` | GET/POST | `requireAdmin` | Yes | **No** | MEDIUM |
| `/api/admin/sitemap` | GET/POST | `requireAdmin` | Yes | **No** | LOW |
| `/api/admin/alert` | POST | `requireAdmin` | Yes | **No** | MEDIUM |
| `/api/admin/migrate` | POST | `requireAdmin` | Yes | **No** | LOW |
| `/api/admin/seed-branded` | POST | None visible | Yes | **No** | HIGH |
| `/api/admin/seed-hats` | POST | None visible | Yes | **No** | HIGH |
| `/api/marketing/content` | GET | `requireAdmin` | Yes | **No** | MEDIUM |
| `/api/marketing/test-ad-copy` | POST | `requireAdmin` | Yes | **No** | LOW |
| `/api/rag/*` (5 routes) | Various | `requireAdmin` | Yes | **No** | LOW |
| `/api/cron/*` (7 routes) | Various | Cron auth | Yes | **No** | LOW (internal) |
| `/api/webhooks/*` (4 routes) | Various | Webhook auth | Yes | **No** | LOW (inbound) |
| `/api/health` | GET | None | No | N/A | LOW |
| `/api/ping` | GET | None | No | N/A | LOW |
| `/api/errors/report` | POST | None | Yes | No | LOW |
| `/api/policies` | GET | None | Yes | No | LOW |
| `/api/seo/[locale]` | GET | None | Yes | No | LOW |
| `/api/proxy-image` | GET | None | No | No | LOW |
| `/api/returns/[id]/tracking` | GET/PATCH | Token auth | Yes | No | MEDIUM |
| `/api/telegram/*` | Various | Various | Yes | No | LOW |
| `/api/translations/cache` | DELETE | None | No | No | LOW |
| `/api/revalidate/theme` | POST | None | No | No | LOW |

---

## Appendix B: Scorecard

| Area | Score | Max | Rating |
|---|---|---|---|
| Tenant Schema Design | 5 | 10 | Partial -- schema exists but incomplete |
| Tenant Isolation (Application) | 1 | 10 | CRITICAL -- 7/80 routes filter |
| Tenant Isolation (Database/RLS) | 0 | 10 | CRITICAL -- always NULL function |
| User Authentication | 7 | 10 | Good -- JWT + httpOnly cookies |
| User Authorization (RBAC) | 4 | 10 | Basic -- admin/customer only |
| Session Management | 6 | 10 | Good -- auto-refresh, cross-tab sync |
| Session Isolation | 2 | 10 | No tenant binding in sessions |
| Admin Access Control | 3 | 10 | Auth works, but global scope |
| Data Isolation (User-level) | 7 | 10 | Good -- most routes filter by user_id |
| Data Isolation (Tenant-level) | 1 | 10 | CRITICAL -- almost no filtering |
| Test Data Hygiene | 1 | 10 | 22/25 users are test accounts |
| **Overall** | **37** | **110** | **34% -- FAIL** |
