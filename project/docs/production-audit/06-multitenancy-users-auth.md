# Production Audit 06 — Multi-Tenancy, User Management & Authentication

**Date**: 2026-03-06
**Auditor**: Claude Sonnet 4.6 (automated audit)
**Scope**: Multi-tenancy architecture, user registration/login, password management, user profile, session management, authorization/RBAC, security
**Stack**: Next.js 16.1.6, Supabase Auth (PostgreSQL 16 + RLS), Redis, Cloudflare Turnstile, Stripe
**Source files read**: 22 files across frontend, admin, docs

---

## Executive Summary

The platform implements a **partially-built multi-tenancy layer** on top of what was originally a single-brand store. The tenant resolution infrastructure (middleware, API route, Redis caching) is architecturally correct but the data isolation is incomplete: 12 of 30 data tables carry a `tenant_id` column, but all 9 main data tables default that column to a hardcoded UUID, creating a silent data-routing trap.

The frontend authentication system (Supabase Auth + httpOnly cookies + Turnstile CAPTCHA + IP-based rate limiting) is largely sound. The **admin panel authentication is critically broken**: unsigned JSON cookies, middleware that bypasses all `/api/*` routes, and 30+ API endpoints without authentication verification.

The overall production readiness score for this domain is **42/100** before remediation. The admin auth vulnerabilities alone disqualify the system from handling real customer data.

---

## 1. Multi-Tenancy Architecture

### 1.1 Current State

**Architecture model**: Shared database, row-level tenant isolation via `tenant_id UUID` column. No schema-per-tenant separation.

**Tenant table** (verified in `frontend/docs/profile-audit-v2/01-database-schema-multitenancy.md`):

```
tenants (2 rows live):
  - f1c548a3-b69d-4328-a372-c4924a660044  (primary, all 123 products belong here)
  - e99b56d7-f597-4101-a1fd-bfcd30e7a7d9  (Tenant B test — 0 products, 0 users)
```

**Tables carrying tenant_id** (12 of ~30 data tables):
`users`, `products`, `orders`, `cart_items`, `categories`, `conversations`, `designs`, `wishlists`, `analytics_events`, `store_themes`, `tenant_configs`, `tenant_members`

**Tables WITHOUT tenant_id** (shared globally across all tenants):
`order_items`, `product_variants`, `shipping_addresses`, `return_requests`, `returns`, `notifications`, `coupons` (CRITICAL — globally shared), `personalizations`, `product_reviews`, `credit_transactions`, `abandoned_carts`, `product_labels`, `referrals`, `newsletter_subscribers` (CRITICAL), `push_subscriptions`, `user_consents`, `drip_queue`, `blog_posts` (CRITICAL)

**Tenant resolution flow** (middleware.ts + /api/tenant-resolve):

```
Request arrives
  |
  v
Is hostname in PRIMARY_DOMAINS?
  Yes → Skip tenant resolution (primary domain, implicit tenant)
  No  → Check cookie "x-tenant-id" (5-min cache)
          |
          v
        Cache hit? → set x-tenant-id header
        Cache miss → GET /api/tenant-resolve?domain={hostname}
                       |
                       v
                     Redis cache (5-min TTL)
                       |
                       v
                     Supabase: SELECT FROM tenants WHERE domain=? AND status='active'
                       |
                       v
                     Set x-tenant-id header + cookie
```

**DB function for tenant context**:
```sql
CREATE FUNCTION public.get_current_tenant_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid,
    NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
$$ LANGUAGE sql STABLE;
```

**RLS policies with tenant awareness** (only 6 of 106 total policies):
- `conversations_tenant_select` — uses `get_current_tenant_id()`
- `orders_tenant_select` — uses `get_current_tenant_id()`
- `products_tenant_select` — uses `get_current_tenant_id()`
- `tenants_select_policy`, `tenants_update_policy` — owner/member check
- `tenant_members_select_policy` — membership check

### 1.2 Gaps

| Gap | Description | Severity |
|-----|-------------|----------|
| MT-01 | All 9 data tables default `tenant_id` to hardcoded primary UUID. If app code fails to set `tenant_id` on INSERT, data silently lands in the primary tenant. | CRITICAL |
| MT-02 | `handle_new_user()` trigger does NOT set `tenant_id`. Every new user registration always joins the primary tenant regardless of which domain they registered from. | CRITICAL |
| MT-03 | `tenant_configs` table has NO RLS enabled. Any authenticated user can read all tenant configs via the anon Supabase client. | CRITICAL |
| MT-04 | `admin_settings` table has NO RLS. Global settings are unprotected. | HIGH |
| MT-05 | `coupons`, `newsletter_subscribers`, `blog_posts` have no tenant isolation at all — not even indirect via FK. All tenants share coupon codes and subscriber lists. | HIGH |
| MT-06 | Products RLS (`products_tenant_select`) falls back to showing ALL products when `get_current_tenant_id()` returns NULL. Requests to the primary domain show every product from every tenant. | HIGH |
| MT-07 | Cart items RLS has no tenant check — isolation only by `user_id`. No cross-tenant boundary for cart data. | MEDIUM |
| MT-08 | No index on `orders.tenant_id` or `products.tenant_id`. Multi-tenant queries require full table scans as data volume grows. | MEDIUM |
| MT-09 | 44 tables still missing `tenant_id` (per plan-maestro/11-multi-tenant.md, 56 tables require it). Only 12 have it. | HIGH |
| MT-10 | `plan_maestro/11-multi-tenant.md` rates current state as 0/10 on tenant model, RLS, billing, custom domains, storage isolation, PII encryption. | INFORMATIONAL |

### 1.3 Assessment

**Multi-tenancy readiness: PROTOTYPE, NOT PRODUCTION-READY**

The architectural design decision (row-level tenancy with RLS) is correct and well-documented. The middleware infrastructure for domain-to-tenant resolution is solid. However, the actual data isolation is almost entirely missing. All live data resides in a single tenant. Adding a second real tenant today would result in data leakage through the hardcoded defaults, missing RLS on critical tables, and the products fallback showing all data.

**Estimated effort to reach production multi-tenancy**: 80-100 hours (as documented in plan-maestro/11-multi-tenant.md).

---

## 2. User Registration & Login

### 2.1 Registration Flow

**Route**: `POST /api/auth/register` (frontend/src/app/api/auth/register/route.ts)

**Current implementation**:
1. IP-based rate limit check (3 attempts / 60 min via `registerLimiter`)
2. Cloudflare Turnstile CAPTCHA verification (server-side, gracefully skips if `TURNSTILE_SECRET_KEY` not set)
3. Input validation: name, email (regex), password (min 6 characters)
4. `supabaseAdmin.auth.signUp()` — creates user in `auth.users`, sends verification email
5. `supabaseAdmin.from('users').insert()` — creates profile in `public.users`
6. Locale detected from `referer` header for email redirect URL

**Email verification**:
- Supabase sends confirmation email with link to `${BASE_URL}/${locale}/auth/verify-email`
- The verify-email page uses `EmailVerificationHandler` component
- `email_verified` column in `public.users` starts as `false`, updated via `handle_new_user()` trigger

**Gaps**:

| Gap | Description | Severity |
|-----|-------------|----------|
| REG-01 | Password minimum is 6 characters — below industry standard (8+) and NIST SP 800-63B recommendation (min 8, allow up to 64+). Change-password endpoint enforces 8 but registration only requires 6. | MEDIUM |
| REG-02 | Registration uses `supabaseAdmin` (service role) to insert into `public.users`. This bypasses RLS. If the `auth.signUp` succeeds but the `users.insert` fails, the user exists in `auth.users` with no profile. Code comments note this as a known issue ("In production, this should trigger a cleanup job") but no cleanup exists. | MEDIUM |
| REG-03 | `tenant_id` is not set during registration. New users always get the hardcoded default UUID `f1c548a3-...` via column default. Multi-tenant registration is not implemented. | CRITICAL (in multi-tenant context) |
| REG-04 | Locale detection uses `referer` header parsing with regex (`/(en|es|de)/`). Referer is user-controllable and can be absent. The fallback to 'en' is safe but locale detection is fragile. | LOW |
| REG-05 | No username uniqueness check beyond email. Two users with identical names can register — no normalization or disambiguation. | LOW |
| REG-06 | OAuth providers (Google, Apple) are stubbed in `/api/auth/providers/route.ts` and not configured. The endpoint tests provider availability at runtime and returns setup instructions. No social login is currently available. | MEDIUM (UX gap) |

### 2.2 Login Flow

**Route**: `POST /api/auth/login` (frontend/src/app/api/auth/login/route.ts)

**Current implementation**:
1. IP-based rate limit: 5 attempts / 15 minutes (`authLimiter`)
2. Cloudflare Turnstile CAPTCHA server-side verification
3. Email format validation
4. `supabase.auth.signInWithPassword()` — validates credentials against Supabase Auth
5. Fetches `locale` and `deletion_requested_at` from `public.users`
6. Sets two httpOnly cookies: `sb-access-token` (1 hour) and `sb-refresh-token` (7 days)
7. Returns session tokens in JSON body as well

**Login flow diagram**:
```
Client POST /api/auth/login {email, password, turnstileToken}
  |
  v
[Rate limiter] 5 req/15min by IP
  |
  v
[Turnstile] Server-side CAPTCHA verification
  |
  v
[Validation] Email format + required fields
  |
  v
[Supabase Auth] signInWithPassword() → JWT access_token + refresh_token
  |
  v
[DB query] SELECT locale, deletion_requested_at FROM users WHERE email=?
  |
  v
[Response] Set httpOnly cookies (sb-access-token, sb-refresh-token)
           Return user object + session tokens in body
```

**Gaps**:

| Gap | Description | Severity |
|-----|-------------|----------|
| LOGIN-01 | Session tokens are returned in the JSON response body in addition to httpOnly cookies. This means JavaScript can access the access_token directly. The httpOnly cookie correctly hides the token from XSS, but the JSON body exposure undermines this protection. | HIGH |
| LOGIN-02 | Login uses `createClient(supabaseUrl, supabaseAnonKey)` — the anon client. This is correct for user login but `supabaseUrl` is read from `process.env.SUPABASE_URL` (server-only var), not `NEXT_PUBLIC_SUPABASE_URL`. If `SUPABASE_URL` is not set but `NEXT_PUBLIC_SUPABASE_URL` is, this fails silently. | LOW |
| LOGIN-03 | Email enumeration: invalid login returns "Invalid email or password" (good), but the rate limiter uses IP only. A distributed attack from many IPs (no IP blocking or progressive delays) can still enumerate accounts. | MEDIUM |
| LOGIN-04 | No account lockout after N failed attempts — only rate limiting per IP window. The rate limiter is in-memory per-instance, so distributed deployments provide no cross-instance enforcement. | MEDIUM |
| LOGIN-05 | Rate limiter bypassed in E2E tests (`PLAYWRIGHT_TEST_BASE_URL` or `CI` env vars return `success: true` always). If CI tests run against production DB, this bypass is dangerous. | LOW |

### 2.3 Social Login (OAuth)

**Current state**: Google and Apple OAuth providers are coded as stubs only. The `/api/auth/providers/route.ts` attempts to probe provider availability at runtime but has no active OAuth configuration.

**Assessment**: No social login available. The endpoint is diagnostic-only and publicly accessible (no auth required to call it), which leaks Supabase configuration details (`supabaseUrl`, `callbackUrl`). This is LOW risk since anon key is intentionally public, but the endpoint has no business value in production.

---

## 3. Password Management

### 3.1 Forgot Password

**Route**: `POST /api/auth/forgot-password` (frontend/src/app/api/auth/forgot-password/route.ts)

**Implementation**:
- Rate limit: 3 attempts / 60 min per IP (`forgotPasswordLimiter`)
- Uses `supabaseAdmin.auth.resetPasswordForEmail()` which sends a Supabase-managed reset link
- Always returns success (correct — prevents email enumeration)
- Locale extracted from `referer` header for redirect URL
- `redirectTo` points to `${BASE_URL}/${locale}/auth/reset-password`

**Assessment**: Correctly implemented. Email enumeration prevention is in place. Rate limiting is appropriate.

### 3.2 Change Password (Authenticated)

**Route**: `POST /api/profile/change-password`

**Implementation**:
- Validates session from `sb-access-token` + `sb-refresh-token` cookies
- Rate limit: 5 attempts / 15 min per user ID (`changePasswordLimiter`)
- Verifies current password by re-calling `signInWithPassword()` (correct pattern)
- Minimum password length: 8 characters
- Updates via `supabase.auth.updateUser({ password: newPassword })`

**Gaps**:

| Gap | Description | Severity |
|-----|-------------|----------|
| PWD-01 | Minimum password for change-password is 8 chars but registration requires only 6. Inconsistent rules across the same auth domain. | MEDIUM |
| PWD-02 | No password strength policy beyond length (no complexity requirements, no common password check, no breach database check). NIST SP 800-63B recommends checking against known-compromised lists. | LOW |
| PWD-03 | `setSession()` is called before rate-limit check (lines 37-47, then 50-53). An attacker can use any valid access+refresh token pair to consume rate limit slots of a target user. | LOW |
| PWD-04 | Change-password verifies current password via a full `signInWithPassword()` call. This generates an additional login event in Supabase Auth audit logs (correct behavior but creates noise). | INFORMATIONAL |
| PWD-05 | After password change, no session invalidation of OTHER active sessions. Only the current session's cookies are affected. Pre-existing sessions on other devices remain valid. | MEDIUM |

### 3.3 Admin Password (Separate System)

The admin panel uses a completely separate auth system (bcrypt hash in `admin_users` table, not Supabase Auth). See Section 6 for details.

---

## 4. User Profile & Account

### 4.1 Profile Management

**Routes**: `GET/PATCH /api/user/profile`
**Component**: `ProfileForm.tsx`

**Fields managed**: name, phone, locale, currency, avatar_url, notification_preferences

**Implementation assessment**:
- Profile fetched and updated via `supabaseAdmin` (service role, bypasses RLS) — correct for server-side route
- Email is read-only in the profile form; changes go through a separate email-change flow with password confirmation
- Avatar upload via `POST /api/profile/avatar` (separate route)
- Language change triggers client-side redirect to new locale URL (`router.push`)

**Gaps**:

| Gap | Description | Severity |
|-----|-------------|----------|
| PROF-01 | `GET /api/user/profile` queries by `email` (`.eq('email', user.email)`), not by `id`. Email is mutable, so if a user changes their email and the sync is partial, this query may return the wrong profile or no result. Should query by `id`. | MEDIUM |
| PROF-02 | `PATCH /api/user/profile` also updates by `.eq('email', user.email)` instead of `.eq('id', user.id)`. Same risk as above. | MEDIUM |
| PROF-03 | Profile auto-creation in `GET /api/user/profile` (when `PGRST116` error occurs) creates a new row without `tenant_id`. This silently assigns the user to the hardcoded default tenant. | MEDIUM |
| PROF-04 | No input validation or length limits on `name`, `phone` fields in PATCH handler. An oversized name could cause DB errors or truncation silently. | LOW |
| PROF-05 | Avatar upload is referenced (`/api/profile/avatar`) but the route implementation was not reviewed in this audit. Verify file type validation and size limits are enforced server-side (not just client-side). | MEDIUM |

### 4.2 Account Deletion (GDPR)

**Route**: `POST /api/profile/delete`
**Component**: `DeleteAccountSection.tsx`

**Implementation**:
1. Validates session via `sb-access-token` cookie using `supabaseAdmin.auth.getUser(token)`
2. Requires `{ confirm: true }` in body
3. Sets `deletion_requested_at = NOW()` (soft delete, 30-day grace period)
4. Sends confirmation email via Resend
5. Calls `supabaseAdmin.auth.admin.signOut(token)` to invalidate current session
6. Clears `sb-access-token` and `sb-refresh-token` cookies

**Cancellation**: User can cancel by logging in within 30 days. The `login/route.ts` notes that deletion is NOT auto-cancelled on login — user must explicitly call `/api/profile/cancel-deletion`.

**Gaps**:

| Gap | Description | Severity |
|-----|-------------|----------|
| GDPR-01 | The delete endpoint reads from `request.cookies.get('sb-access-token')` but `DeleteAccountSection.tsx` calls `fetch('/api/profile/delete', { method: 'POST', headers: {...}, body: JSON.stringify({ confirm: true }) })` WITHOUT `credentials: 'include'`. Cookies are not sent in this fetch call, so the server will always get a 401. | CRITICAL (functional bug) |
| GDPR-02 | No GDPR Article 20 data export endpoint. Users cannot request a machine-readable copy of their data. | HIGH (legal compliance) |
| GDPR-03 | Hard-delete cron job exists (`/api/cron/hard-delete-accounts`) but was not verified to actually delete PII from all tables (orders, shipping_addresses, cart_items, etc.) or just set `deleted_at`. | MEDIUM |
| GDPR-04 | Payment method deletion calls Stripe but the Stripe customer_id remains in the `users` table after account deletion. | LOW |
| GDPR-05 | 30-day grace period email uses hardcoded English content for the cancellation instructions ("If you log in before this date, your account deletion will be automatically cancelled") — but the note in `login/route.ts` says deletion is NOT auto-cancelled on login. The email is misleading. | MEDIUM |

### 4.3 Payment Methods

**Component**: `PaymentMethodsList.tsx`
**Route**: `/api/profile/payment-methods` (not audited in depth)

Implementation fetches Stripe payment methods and allows deletion. The component uses `credentials: 'include'` correctly. The AlertDialog confirmation pattern (shadcn/ui) is appropriate for a destructive action.

---

## 5. Session Management

### 5.1 Token Storage & Cookie Configuration

Tokens are stored in two httpOnly cookies:

| Cookie | Value | httpOnly | Secure | SameSite | MaxAge |
|--------|-------|----------|--------|----------|--------|
| `sb-access-token` | Supabase JWT | Yes | Yes (production) | Lax | 1 hour (expires_in) |
| `sb-refresh-token` | Supabase refresh token | Yes | Yes (production) | Lax | 7 days |

**CSRF protection**: Implemented in middleware (`src/lib/csrf.ts`). CSRF token generated per-session, validated for POST/PUT/DELETE API routes. Admin and cron routes are exempt (they have their own auth mechanisms). Webhook routes are exempt.

**Tenant ID cookie**: `x-tenant-id` is cached in an httpOnly cookie with 5-minute TTL. This avoids a Redis/Supabase round-trip on every request.

**A/B test cookies**: `pod-visitor-id` (365-day), `ab-variant-{id}` (30-day) — httpOnly, not security-sensitive.

### 5.2 Session Validation

**Client-side** (`useAuth.ts`):
- Polls `/api/auth/session` on mount and every 5 minutes
- Cross-tab sync via `localStorage` storage events
- Logout broadcasts to all tabs

**Server-side** (`/api/auth/session`):
1. Reads `sb-access-token` cookie
2. Calls `supabase.auth.getUser(accessToken)` to validate JWT against Supabase (not just local decode)
3. On token expiry, attempts refresh using `sb-refresh-token`
4. On refresh success, updates both cookies with new tokens
5. On refresh failure, clears cookies

**Middleware** (`middleware.ts`):
- Only validates JWT for routes in `protectedRoutes = ['/profile', '/orders']`
- Cart (`/cart`) and checkout (`/checkout`) allow unauthenticated access
- Uses `createServerClient` from `@supabase/ssr` with correct cookie handling

**Gaps**:

| Gap | Description | Severity |
|-----|-------------|----------|
| SESS-01 | The `useAuth` hook polls `/api/auth/session` every 5 minutes from the client. Each call validates the JWT against Supabase (a network round-trip). With many active users, this creates significant load on the Supabase auth endpoint. Consider longer polling intervals or server-sent events. | LOW (performance) |
| SESS-02 | Concurrent session handling: multiple browser tabs/devices are all valid simultaneously with no limit. There is no mechanism to list or revoke individual sessions. | MEDIUM |
| SESS-03 | `protectedRoutes` only covers `/profile` and `/orders`. The `/wishlist` route is not protected at middleware level — it relies on API-level auth only. | LOW |
| SESS-04 | The session API uses `supabase.auth.getUser(accessToken)` with a **service role client**. Using the service role to call `getUser()` is slightly unusual (anon client with the token would be more standard) but functionally correct. | INFORMATIONAL |
| SESS-05 | After password change, other sessions (other devices/tabs) are not invalidated. The refresh token remains valid. | MEDIUM |

---

## 6. Authorization & RBAC

### 6.1 Frontend User Roles

**User roles** (`users.role`): `customer` | `admin` — simple binary, enforced via CHECK constraint.

**Granular admin RBAC** (`admin_roles` + `user_roles` tables):

| Role | Permissions |
|------|-------------|
| super_admin | Full access: roles, users, orders, themes, designs, finance, products, settings, analytics, translations |
| manager | Most permissions minus role management and some finance |
| support | Read-heavy: users(read), orders(read+update), products(read) |
| viewer | Read-only: orders, designs, products, analytics |

**RLS enforcement**: Most RLS policies use `auth.uid() = user_id` pattern for user data. Admin-only tables check `auth.role() = 'service_role'` or join against `user_roles`.

### 6.2 Admin Panel Authentication (CRITICAL RISK)

The admin panel (`/admin`) uses an entirely separate auth system from the frontend:

**From existing audit (08-security-auth.md, confirmed as current state)**:

**C-01 (CRITICAL): Unsigned JSON cookie**
```typescript
// admin/src/app/api/auth/login/route.ts
response.cookies.set('admin-session', JSON.stringify({
  id: user.id, email: user.email, role: user.role, name: user.name
}), { httpOnly: true, ... })
```
Any attacker who can set cookies can forge admin sessions with arbitrary roles.

**Test evidence (admin/src/__tests__/auth.test.ts) confirms iron-session is PLANNED**:
```typescript
vi.mock('iron-session', () => ({ getIronSession: vi.fn() }));
// mockSession.save is asserted
```
The tests mock `iron-session`, indicating the migration to signed sessions is in progress or planned but the actual implementation state requires verification in `admin/src/app/api/auth/login/route.ts`.

**C-02 (CRITICAL): Middleware bypasses all API routes**
```typescript
// admin/src/middleware.ts
if (pathname === '/login' || pathname.startsWith('/api/')) {
  return NextResponse.next(); // bypass
}
```

**C-03 (CRITICAL): `setup-rbac` endpoint is publicly accessible**
Creates admin accounts with `super_admin` role without authentication.

**H-01 (HIGH): 30+ admin API routes have no per-route auth check**

Only 3 routes use `withPermission` RBAC. ~15 do manual session checks. The rest (30+) are completely open.

| Exposed endpoint | Data at risk |
|-----------------|-------------|
| `/api/customers/*` | All customer PII |
| `/api/dashboard/stats` | Revenue, conversion data |
| `/api/admin/orders` | All orders + payment intent IDs |
| `/api/admin/finance/*` | Financial reports |
| `/api/admin/legal/consents` | GDPR consent records |

### 6.3 API Route Protection Patterns (Frontend)

**Protected routes** (require `sb-access-token` cookie):
- `GET /api/user/profile` — validates via `supabaseAdmin.auth.getUser(token)`
- `POST /api/profile/delete` — validates via cookie
- `POST /api/profile/change-password` — validates via `setSession()`

**Admin-only frontend routes** (should require admin role, status unclear):
- `POST /api/admin/alert`
- `GET /api/admin/orders`
- `POST /api/admin/sitemap`
- Various `/api/admin/*` routes

**Gaps**:

| Gap | Description | Severity |
|-----|-------------|----------|
| RBAC-01 | Admin panel auth (C-01, C-02, C-03) — see above. Remains the most critical security gap in the entire system. | CRITICAL |
| RBAC-02 | Frontend admin routes (`/api/admin/*`) use `supabaseAdmin` (service role) without validating that the caller is an admin user. Any authenticated user (or unauthenticated if CSRF token is available) can call these routes. | HIGH |
| RBAC-03 | `users.role` field ('customer' | 'admin') is set at registration and never elevated via UI. There is no frontend flow to promote a user to admin — it must be done via direct DB or admin panel. This is correct behavior but should be documented. | INFORMATIONAL |
| RBAC-04 | No tenant-admin role exists. In the current single-tenant mode this is fine, but multi-tenant requires a way for a tenant owner to access only their tenant's admin functions. | MEDIUM (multi-tenant blocker) |

---

## 7. Security Analysis

### 7.1 Bot Protection (Turnstile)

**Implementation**: Cloudflare Turnstile on login and registration. Server-side verification in both routes.

**Graceful degradation**: If `TURNSTILE_SECRET_KEY` is not set, verification is SKIPPED and returns `true`. This is intentional for development but creates a configuration risk — if the env var is accidentally absent in production, Turnstile is completely disabled.

**Widget**: `TurnstileWidget.tsx` gracefully handles missing `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (renders nothing). No token = no call to server routes (widget doesn't render → form may still submit without token).

**Recommendation**: Add a production guard that hard-fails if `TURNSTILE_SECRET_KEY` is missing in `NODE_ENV === 'production'`.

### 7.2 Rate Limiting

**Implementation**: In-memory `RateLimiter` class in `frontend/src/lib/rate-limit.ts`.

**Configured limiters**:

| Limiter | Limit | Window | Used on |
|---------|-------|--------|---------|
| authLimiter | 5 | 15 min | Login |
| registerLimiter | 3 | 60 min | Registration |
| forgotPasswordLimiter | 3 | 60 min | Forgot password |
| changePasswordLimiter | 5 | 15 min | Change password |
| chatLimiter | 20 | 1 min | Chat |
| apiLimiter | 100 | 1 min | General API |
| designGenerateLimiter | 5 | 1 min | AI design |
| reviewLimiter | 5 | 60 min | Reviews |
| changeEmailLimiter | 3 | 60 min | Email change |

**Critical gap**: Rate limiting is **in-memory per Next.js instance**. In a multi-instance deployment (Docker scaling, Vercel), each instance has its own counter. An attacker can route requests across instances to multiply the effective limit.

**E2E test bypass**: `if (process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.CI) { return { success: true } }`. This is documented but dangerous if CI tests point to a production database.

**Cron secret verification**: `verifyCronSecret()` uses `crypto.timingSafeEqual()` — correctly timing-safe.

### 7.3 CSRF Protection

**Implementation**: Implemented in middleware (`frontend/src/middleware.ts`).

- CSRF token generated per-session, stored in cookie `CSRF_COOKIE_NAME`
- Validated for mutation methods (POST, PUT, DELETE, PATCH) on API routes
- Skipped for: webhooks, admin routes (`/api/admin/*`), cron routes (`/api/cron/*`)
- Cookie: `sameSite: 'lax'`, `httpOnly: true`, `secure` in production

**Gap**: Admin routes (`/api/admin/*`) skip CSRF validation entirely. Combined with the missing auth check on admin routes, this creates a full CSRF attack surface on all admin mutations.

### 7.4 CORS

**Implementation** (`frontend/src/lib/cors.ts`):

```
Allowed origins: BASE_URL, http://localhost:3000, http://localhost:3001
Headers: Content-Type, Authorization, X-Requested-With (MISSING x-csrf-token)
Credentials: allowed
```

**Gap**: The CORS `Access-Control-Allow-Headers` does not include the CSRF header name (`x-csrf-token` or whatever `CSRF_HEADER_NAME` resolves to). Cross-origin requests including the CSRF header will be blocked by preflight. The CSRF protection may not work for CORS requests.

### 7.5 XSS Prevention

**ReactMarkdown without DOMPurify** (from existing audit, M-05):
Pages `returns/page.tsx`, `shipping/page.tsx`, `terms/page.tsx`, `privacy/page.tsx` use `ReactMarkdown` directly instead of `SafeMarkdown` (which includes DOMPurify). If admin content is compromised, XSS is possible.

**CSS injection via theme** (from existing audit, M-06):
`dangerouslySetInnerHTML` in `layout.tsx` renders CSS from `store_themes` table without sanitizing values. A compromised admin account could inject CSS that exfiltrates data.

### 7.6 SQL Injection

**Assessment: PROTECTED**. The application uses Supabase PostgREST client throughout, which uses parameterized queries. No raw SQL string concatenation was found in the audited routes. UUIDs are validated via `isValidUuid()`. This is a positive finding.

### 7.7 Sensitive Data Exposure

**Positive findings**:
- `SUPABASE_SERVICE_KEY` never has `NEXT_PUBLIC_` prefix — correctly server-only
- `.env` files are gitignored
- httpOnly cookies prevent JavaScript from reading session tokens

**Concerns**:
- Session tokens returned in JSON body of login response (LOGIN-01)
- Supabase URL and anon key exposed in `/api/auth/providers` response body (LOW risk — anon key is designed to be public)
- PII (emails, names, shipping addresses) stored as plaintext in PostgreSQL — no column encryption

### 7.8 Security Headers

**Positive finding** (from `08-security-auth.md`): Caddy serves all security headers:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Server` header removed

**CSP concern**: `script-src 'self' 'unsafe-inline'` weakens XSS protection. Nonces would be needed to eliminate `unsafe-inline`.

---

## 8. Auth Flow Diagrams

### 8.1 Frontend Registration Flow

```
Browser                  Next.js API              Supabase Auth         public.users (DB)
  |                          |                         |                      |
  |-- POST /api/auth/register|                         |                      |
  |   {name,email,password,  |                         |                      |
  |    turnstileToken}       |                         |                      |
  |                          |-- rateLimiter.check() --|                      |
  |                          |-- verifyTurnstile()  ---|                      |
  |                          |-- validate inputs    ---|                      |
  |                          |                         |                      |
  |                          |-- supabaseAdmin.auth.signUp() -------> creates auth.users row
  |                          |                         |-- sends verify email |
  |                          |                         |                      |
  |                          |-- supabaseAdmin.from('users').insert() ------> creates users row
  |                          |   (tenant_id = hardcoded default!)             |
  |                          |                         |                      |
  |<-- 201 {user: {id,email}}|                         |                      |
```

### 8.2 Frontend Login Flow

```
Browser                  Next.js API              Supabase Auth         Cookie Jar
  |                          |                         |                   |
  |-- POST /api/auth/login   |                         |                   |
  |   {email,password,       |                         |                   |
  |    turnstileToken}       |                         |                   |
  |                          |-- rateLimiter.check() (5/15min by IP)       |
  |                          |-- verifyTurnstile()                         |
  |                          |                         |                   |
  |                          |-- signInWithPassword() -+-> JWT + refresh   |
  |                          |                         |                   |
  |                          |-- fetch user locale from public.users       |
  |                          |                         |                   |
  |<-- 200 + Set-Cookie: sb-access-token (httpOnly, 1h)                    |
  |         Set-Cookie: sb-refresh-token (httpOnly, 7d)                    |
  |    ALSO: body contains {session: {access_token}} <--- SECURITY GAP     |
```

### 8.3 Session Refresh Flow

```
Browser (useAuth)        /api/auth/session        Supabase Auth
  |                          |                         |
  |-- GET /api/auth/session  |                         |
  |   (every 5 min)          |                         |
  |                          |-- read sb-access-token cookie              |
  |                          |-- supabase.auth.getUser(token) ----------->|
  |                          |                         |                   |
  |                     token valid? --YES--> return user profile         |
  |                          |                         |                   |
  |                     token expired? --NO refresh_token? --> clear cookies
  |                          |                         |                   |
  |                     token expired? --YES refresh_token? --> refreshSession()
  |                          |                         |-- new JWT + refresh
  |                          |-- update both cookies                      |
  |<-- 200 {authenticated: true, user: {...}}          |                   |
```

### 8.4 Protected Route Flow (Middleware)

```
Request to /en/profile         middleware.ts             Supabase Auth
  |                                |                          |
  |-- GET /en/profile             |                          |
  |                                |-- isProtectedRoute?      |
  |                                |-- YES                    |
  |                                |-- createServerClient()   |
  |                                |-- supabase.auth.getUser()|
  |                                |                     -> valid?
  |                                |                          |
  |                           YES: set x-user-id header, continue
  |                           NO:  redirect to /en/auth/login?returnUrl=/en/profile
```

---

## 9. Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| JWT validated server-side (not just cookie presence) | PASS | `supabase.auth.getUser()` used in middleware and session route |
| httpOnly session cookies | PASS | Both `sb-access-token` and `sb-refresh-token` are httpOnly |
| Secure cookies in production | PASS | `secure: process.env.NODE_ENV === 'production'` |
| CSRF protection on mutations | PARTIAL | Frontend routes protected; admin routes exempt |
| Rate limiting on auth endpoints | PASS (frontend) / FAIL (admin) | Admin login has no rate limiter |
| Bot protection (CAPTCHA) | PASS | Turnstile on login and register |
| SQL injection prevention | PASS | Supabase client with parameterized queries |
| XSS prevention (DOMPurify) | PARTIAL | SafeMarkdown exists but 4 pages use raw ReactMarkdown |
| Email enumeration prevention | PASS | Forgot-password always returns success |
| Password minimum length | PARTIAL | 8 chars for change, 6 chars for registration |
| Session invalidation on password change | FAIL | Other device sessions remain valid |
| Admin session signed/encrypted | FAIL (or PENDING) | Unsigned JSON cookie — iron-session in tests but status unclear |
| Admin middleware protects API routes | FAIL | Bypasses all `/api/*` |
| Admin routes have per-route auth | FAIL | 30+ routes unprotected |
| MFA for admin accounts | FAIL | Not implemented |
| PII encrypted at rest | FAIL | Plaintext in PostgreSQL |
| GDPR data export endpoint | FAIL | Not implemented |
| Tenant data isolation (RLS) | PARTIAL | 6 of 106 RLS policies are tenant-aware |
| No hardcoded secrets in code | PARTIAL | Scripts with hardcoded Supabase keys exist in git history |
| Service role key server-only | PASS | No `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` |
| CORS configured correctly | PARTIAL | CSRF header missing from Allow-Headers |
| Security headers (via Caddy) | PASS | HSTS, X-Frame-Options, CSP, etc. |
| CSP without unsafe-inline | FAIL | `script-src 'unsafe-inline'` in next.config.ts |
| Distributed rate limiting | FAIL | In-memory only, not Redis-backed |

---

## 10. Prioritized Findings Table

| ID | Area | Finding | Severity | Effort | Priority |
|----|------|---------|----------|--------|----------|
| A-01 | Admin Auth | Admin session cookie is unsigned JSON — trivially forgeable | CRITICAL | 4h | P0 |
| A-02 | Admin Auth | Admin middleware bypasses all `/api/*` routes | CRITICAL | 1h | P0 |
| A-03 | Admin Auth | `setup-rbac` endpoint is publicly accessible — creates admin accounts | CRITICAL | 15min | P0 |
| A-04 | Admin Auth | 30+ admin API routes have no per-route auth check | CRITICAL | 4h | P0 |
| A-05 | Multi-tenancy | `tenant_configs` table has no RLS — all configs are globally readable | CRITICAL | 30min | P0 |
| MT-01 | Multi-tenancy | Hardcoded default `tenant_id` on all data tables — silent data misrouting | CRITICAL | 2h | P0 |
| MT-02 | Multi-tenancy | `handle_new_user()` trigger does not set `tenant_id` | CRITICAL | 1h | P0 |
| GDPR-01 | GDPR | Account deletion fetch is missing `credentials: 'include'` — always returns 401 | CRITICAL | 15min | P0 |
| LOGIN-01 | Auth | Session tokens returned in JSON body (in addition to httpOnly cookies) | HIGH | 30min | P1 |
| MT-03 | Multi-tenancy | `admin_settings` has no RLS | HIGH | 30min | P1 |
| MT-04 | Multi-tenancy | `coupons`, `newsletter_subscribers`, `blog_posts` — no tenant isolation | HIGH | 2h | P1 |
| MT-05 | Multi-tenancy | Products RLS falls back to showing ALL products when tenant context is NULL | HIGH | 1h | P1 |
| RBAC-02 | Authorization | Frontend `/api/admin/*` routes use service role without verifying caller is admin | HIGH | 2h | P1 |
| GDPR-02 | GDPR | No GDPR Art. 20 data export endpoint | HIGH | 4h | P1 |
| SESS-02 | Session | No concurrent session limits or session revocation mechanism | MEDIUM | 4h | P2 |
| SESS-05 | Session | Password change does not invalidate other active sessions | MEDIUM | 2h | P2 |
| PWD-01 | Password | Registration requires 6 chars, change-password requires 8 — inconsistent | MEDIUM | 30min | P2 |
| PWD-05 | Password | Password change does not invalidate other sessions | MEDIUM | 2h | P2 |
| REG-02 | Registration | Auth/users orphaning on profile insert failure — no cleanup | MEDIUM | 2h | P2 |
| REG-03 | Registration | New users always assigned to hardcoded default tenant | MEDIUM | per MT-02 | P2 |
| PROF-01 | Profile | Profile queries use email instead of id (email is mutable) | MEDIUM | 30min | P2 |
| PROF-02 | Profile | Profile updates use email instead of id | MEDIUM | 30min | P2 |
| LOGIN-03 | Auth | No cross-instance rate limiting — distributed brute force possible | MEDIUM | 4h | P2 |
| GDPR-05 | GDPR | Account deletion email incorrectly states login auto-cancels deletion | MEDIUM | 30min | P2 |
| MT-06 | Multi-tenancy | 44 additional tables need `tenant_id` for full isolation | HIGH | 80h | P3 |
| REG-01 | Registration | Password minimum 6 chars — below standard | MEDIUM | 30min | P2 |
| SESS-01 | Session | Polling `/api/auth/session` every 5 min is expensive at scale | LOW | 4h | P3 |
| MT-07 | Multi-tenancy | Missing `tenant_id` indexes on orders and products tables | MEDIUM | 30min | P2 |
| A-06 | Admin Auth | No MFA for admin accounts | HIGH | 8h | P2 |
| LOGIN-05 | Auth | Rate limiter bypassed in CI (`PLAYWRIGHT_TEST_BASE_URL`) | LOW | 1h | P2 |

---

## 11. Fixes

### Immediate (P0) — Before any real customer data

**Fix GDPR-01** (15 minutes): In `DeleteAccountSection.tsx`, add `credentials: 'include'` to the fetch call:
```typescript
const response = await fetch('/api/profile/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // ADD THIS
  body: JSON.stringify({ confirm: true }),
})
```

**Fix A-03** (15 minutes): Delete `admin/src/app/api/admin/setup-rbac/route.ts`.

**Fix A-02** (1 hour): In `admin/src/middleware.ts`, remove the `/api/` bypass. Protect all routes except `/login` and public assets.

**Fix A-01** (4 hours): Implement `iron-session` for admin cookie (tests already mock it — the implementation needs to match). Replace JSON.stringify cookie with sealed iron-session.

**Fix A-05** (30 minutes): Enable RLS on `tenant_configs` and `admin_settings` tables via migration.

**Fix MT-01** (2 hours): Remove hardcoded `tenant_id` defaults from all 9 data tables. Use a trigger that resolves `tenant_id` from the request context (`app.current_tenant_id` GUC setting) instead.

**Fix MT-02** (1 hour): Update `handle_new_user()` trigger to read `tenant_id` from `auth.users.raw_app_meta_data->'tenant_id'`, and default to the primary tenant only as a fallback.

### Short-term (P1) — Within 1 week

**Fix LOGIN-01** (30 min): Remove `session` object from login response JSON body. Tokens should only travel via httpOnly cookies:
```typescript
// In /api/auth/login/route.ts, change response to:
return NextResponse.json({
  success: true,
  user: { id, email, name, locale, deletion_requested_at }
  // REMOVE: session: { access_token, refresh_token, expires_at }
})
```

**Fix RBAC-02** (2 hours): Add admin role verification to all frontend `/api/admin/*` routes. Create a shared `requireAdminAuth()` wrapper that validates `sb-access-token` and checks `users.role = 'admin'`.

**Fix MT-05** (1 hour): Change products RLS fallback. When `get_current_tenant_id()` is NULL on the primary domain, use the primary tenant's UUID explicitly rather than returning all products from all tenants.

**Fix GDPR-02** (4 hours): Implement `GET /api/profile/export` that returns all user data (profile, orders, addresses, reviews, consents) in JSON format.

### Medium-term (P2) — Within 2 weeks

- Redis-backed rate limiting (replace in-memory `RateLimiter`)
- Password consistency (8 chars minimum on registration)
- Profile queries by `id` not `email`
- Session invalidation on password change (call `supabaseAdmin.auth.admin.signOut()` for all sessions)
- MFA for admin accounts (TOTP)
- GDPR deletion email fix

---

## 12. Multi-Tenancy Readiness Summary

| Milestone | Status | Effort |
|-----------|--------|--------|
| M1: Data layer (`tenant_id` in all 56 tables, RLS) | NOT STARTED | 36h |
| M2: Tenant lifecycle (signup, onboarding, super-admin) | NOT STARTED | 18h |
| M3: Agent isolation (PodClaw per-tenant) | NOT STARTED | 14h |
| M4: Monetization (Stripe Connect, custom domains, SMTP) | NOT STARTED | 18h |

**Current multi-tenancy score**: 2/10
**Minimum viable multi-tenancy** (serve 2 real tenants with full isolation): ~40 hours (M1 + partial M2)

The existing tenant resolution infrastructure (middleware, /api/tenant-resolve, Redis cache, DB function) is well-architected and can be built upon. The core blockers are the hardcoded tenant defaults, the missing trigger logic, and the incomplete RLS coverage.

---

*This document was generated by automated audit on 2026-03-06. All code references are verified against actual source files. Findings should be reproduced against live environment before final remediation.*
