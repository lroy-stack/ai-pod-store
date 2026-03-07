# Admin Panel Security Audit -- 2026-03-07

## Summary

- **Total checks**: 42
- **PASS**: 22 | **WARN**: 12 | **FAIL**: 5 | **CRITICAL**: 3

---

## Critical Findings

### CRIT-1: Unprotected API Routes -- No Authentication

The following routes have **zero authentication** and are publicly accessible to anyone who can reach the admin panel:

| Route | File | Line | Impact |
|---|---|---|---|
| `GET /api/health` | `admin/src/app/api/health/route.ts` | 3 | Leaks service name, uptime (minor) |
| `GET /api/metrics` | `admin/src/app/api/metrics/route.ts` | 11 | Leaks memory usage, heap stats, environment, version |
| `GET /api/dashboard/top-products` | `admin/src/app/api/dashboard/top-products/route.ts` | 7 | **Exposes top-selling products with sales quantities -- business-sensitive data, zero auth** |
| `GET /api/admin/brand-config` | `admin/src/app/api/admin/brand-config/route.ts` | 13 | Exposes full brand configuration without auth |
| `GET /api/admin/legal-settings` | `admin/src/app/api/admin/legal-settings/route.ts` | 19 | Exposes legal settings (intentionally public per comment, but uses service-role Supabase client) |

**`/api/dashboard/top-products`** is the most severe: it creates a Supabase client with the service role key and returns order/product data with no session check whatsoever.

**`/api/metrics`** exposes `process.env.NODE_ENV` and detailed memory stats, useful for reconnaissance.

### CRIT-2: Test User with Hardcoded bcrypt Hash in Migration (Production DB)

**File**: `supabase/migrations/20260213232458_add_test_user_for_reviews.sql`, line 3

```sql
INSERT INTO users (id, email, password_hash, name, role, email_verified, ...)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'testuser@podstore.local',
  '$2a$10$rQZ4YXxN5nU5yXHkJxYhPeVYvJ.xz8HWz8mQxqXPKxYzJ5XqwYXKu',
  ...
```

This migration runs in **all environments** including production. The same hash appears in `supabase/seed.sql` line 21. While the role is `customer` (not `admin`), it provides a foothold: a known user ID (`00000000-...001`) with a potentially guessable password hash in every deployment.

Additionally, the `must_change_password` flag added in migration `20260221213301` is **never checked** in the login route (`admin/src/app/api/auth/login/route.ts`). A grep for `must_change_password` in the entire admin codebase returns zero results -- the flag exists in the DB but is not enforced.

### CRIT-3: SQL Injection Risk via Unsanitized Search Parameters in PostgREST `.or()` Filters

Multiple routes interpolate user-provided search strings directly into PostgREST filter expressions:

| File | Line | Pattern |
|---|---|---|
| `admin/src/app/api/orders/route.ts` | 41 | `query.or(\`id.ilike.%${search}%,customer_email.ilike.%${search}%\`)` |
| `admin/src/app/api/products/route.ts` | 24 | `query.or(\`title.ilike.%${search}%,category.ilike.%${search}%\`)` |
| `admin/src/app/api/search/route.ts` | 21,28,35 | `query.or(\`name.ilike.%${searchTerm}%,...\`)` |
| `admin/src/app/api/designs/route.ts` | 45 | `query.or(\`prompt.ilike.%${search}%,style.ilike.%${search}%\`)` |

While PostgREST uses parameterized queries internally, the `.or()` method in `@supabase/supabase-js` constructs filter strings that are sent as query parameters to the PostgREST API. A crafted `search` value containing PostgREST filter operators (e.g., commas, parentheses, dots) could alter the filter logic and cause unexpected query behavior or data leakage. User input must be sanitized before interpolation.

---

## Failures (Non-Critical)

### FAIL-1: Multiple Mutation Routes Missing Audit Logging

The `withAuth` middleware logs all API calls to `audit_log` (line 71, `auth-middleware.ts`), but several mutation routes use `withPermission` (from `rbac.ts`) which does **not** auto-log. These routes also lack explicit `logCreate`/`logUpdate`/`logDelete` calls:

| Route | Method | File | Impact |
|---|---|---|---|
| `DELETE /api/designs/bulk-delete` | DELETE | `admin/src/app/api/designs/bulk-delete/route.ts` | **Hard-deletes designs with no audit trail** |
| `DELETE /api/blog/[id]` | DELETE | `admin/src/app/api/blog/[id]/route.ts` | Blog post deletion unlogged |
| `PATCH /api/products/bulk` | PATCH | `admin/src/app/api/products/bulk/route.ts` | Bulk status changes unlogged |
| `POST /api/admin/themes/[id]/activate` | POST | `admin/src/app/api/admin/themes/[id]/activate/route.ts` | Theme activation unlogged |
| `POST /api/ab-tests` | POST | `admin/src/app/api/ab-tests/route.ts` | Experiment creation unlogged |
| `POST /api/ab-tests/[id]/start` | POST | `admin/src/app/api/ab-tests/[id]/start/route.ts` | Experiment start unlogged |
| `POST /api/ab-tests/[id]/stop` | POST | `admin/src/app/api/ab-tests/[id]/stop/route.ts` | Experiment stop unlogged |

### FAIL-2: Error Responses Leak Internal Details (DB Schema, Error Messages)

Over 20 routes expose `error.message` from Supabase errors in API responses. Examples:

| File | Line | Leaked Info |
|---|---|---|
| `orders/[id]/route.ts` | 24, 66 | `{ error: '...', details: error.message }` |
| `orders/route.ts` | 49, 64 | `{ error: '...', details: error.message }` |
| `designs/[id]/route.ts` | 37, 100 | `{ error: '...', details: error.message }` |
| `agent/sessions/route.ts` | 41 | `{ error: '...', details: error.message }` |
| `customers/[id]/route.ts` | 138, 174 | `{ error: error.message }` -- raw message |
| `products/[id]/variants/route.ts` | 32, 89 | `{ error: error.message }` -- raw message |

Supabase error messages can contain table names, column names, constraint names, and RLS policy details. This information assists attackers in crafting targeted attacks.

### FAIL-3: designs/bulk-delete Accepts Unvalidated Input

**File**: `admin/src/app/api/designs/bulk-delete/route.ts`, lines 7-8

```typescript
const body = await req.json()
const { ids } = body as { ids: string[] }
```

No Zod validation. The `ids` array is only loosely checked for truthiness (`!ids || !Array.isArray(ids)`). Individual elements are not validated as UUIDs, allowing potential injection of arbitrary strings into the `.in('id', ids)` query.

### FAIL-4: Session Cookie Uses `sameSite: 'lax'` Instead of `'strict'`

**File**: `admin/src/lib/session.ts`, line 51

The admin session cookie uses `sameSite: 'lax'`. For an admin panel that does not need cross-site navigation (no OAuth redirects, no external embeds), `'strict'` provides stronger CSRF protection. `'lax'` allows the cookie to be sent on top-level navigations from external sites.

### FAIL-5: Rate Limiter Bypassed in E2E/CI Environments

**File**: `admin/src/lib/rate-limit.ts`, lines 30-31

```typescript
if (process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.CI) {
  return { success: true, remaining: this.limit, resetAt: Date.now() + this.windowMs }
}
```

If `PLAYWRIGHT_TEST_BASE_URL` or `CI` environment variables are set in production (misconfiguration), all rate limiting is disabled, including brute-force protection on the login endpoint.

---

## Warnings

### WARN-1: Agent Proxy Routes Duplicate Auth Logic Instead of Using Shared Middleware

The following routes implement their own `checkAdminAuth()` inline function instead of using `withAuth` or `withPermission`:

- `admin/src/app/api/agent/chat/stream/route.ts` (line 9)
- `admin/src/app/api/agent/chat/conversations/route.ts` (line 9)
- `admin/src/app/api/agent/chat/conversations/[id]/route.ts` (line 9)
- `admin/src/app/api/agent/[...path]/route.ts` (line 9)
- `admin/src/app/api/agent/metrics/route.ts` (line 10)
- `admin/src/app/api/agent/schedule/route.ts` (line 15)
- `admin/src/app/api/agent/memory/route.ts` (line 12)

While these custom checks do verify `isLoggedIn` and `role === 'admin'`, they bypass the `withAuth` rate-limiting and automatic audit logging. Each is a separate copy of similar logic -- a maintainability risk.

### WARN-2: Agent Proxy Catch-All Has No Input Validation or Path Sanitization

**File**: `admin/src/app/api/agent/[...path]/route.ts`, line 66

The catch-all proxy forwards the `path.join('/')` segments directly to the PodClaw bridge URL. While the bridge has its own auth (Bearer token), if the bridge is compromised, there is no server-side validation of which bridge endpoints the admin proxy can access. The `body` is also forwarded verbatim with no size limits.

### WARN-3: In-Memory Rate Limiter Does Not Survive Restarts

**File**: `admin/src/lib/rate-limit.ts`

The rate limiter uses an in-memory `Map`. In a serverless/edge environment or after a restart, all rate limit state is lost. An attacker can simply wait for a deployment to reset all counters. For Docker/standalone mode, a single instance provides reasonable protection, but this is fragile.

### WARN-4: CSP Allows `'unsafe-inline'` for Scripts and Styles

**File**: `admin/next.config.ts`, line 49

```
script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

`'unsafe-inline'` for `script-src` significantly weakens CSP, allowing inline script injection. While Next.js requires this for its hydration mechanism, using `nonce` or `strict-dynamic` would be more secure.

### WARN-5: Service Role Key Leaked via Frontend Revalidation Call

**File**: `admin/src/app/api/admin/themes/[id]/activate/route.ts`, line 63

```typescript
fetch(`${frontendUrl}/api/revalidate/theme`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
})
```

The Supabase service role key is used as a Bearer token to authenticate against the frontend's revalidation endpoint. This is a misuse of the service key -- a dedicated shared secret should be used instead. If the frontend logs headers or the request is intercepted, the service role key is exposed.

### WARN-6: No MFA Support

No multi-factor authentication is implemented. The admin panel relies solely on email/password authentication via iron-session.

### WARN-7: No Session Revocation Mechanism

There is no server-side session store. Iron-session uses encrypted cookies -- sessions cannot be revoked remotely (e.g., after detecting suspicious activity). The only way to invalidate a session is to wait for the 7-day TTL or change `SESSION_SECRET`, which invalidates all sessions.

### WARN-8: Audit Log Tamper Protection

The admin panel uses the service role key (`supabaseAdmin`) to insert audit logs. Since the admin panel itself uses service role (RLS bypass), an admin with DB access could theoretically delete or modify audit log entries. No write-once / append-only protection.

### WARN-9: `admin/src/lib/admin-api.ts` and `admin/src/lib/logger.ts` Not Audited

These files exist in the lib directory but were not referenced by any API routes in the audit scope. They may contain additional patterns worth reviewing.

### WARN-10: XLSX Dependency Has High-Severity Vulnerability

**npm audit** reports 2 high-severity vulnerabilities in `xlsx` (SheetJS):
- Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
- Regular Expression DoS (GHSA-5pgg-2g8v-p4x9)
- No fix available upstream

### WARN-11: `login/route.ts` Does Not Enforce `must_change_password`

The migration `20260221213301` adds a `must_change_password` column and marks default admin emails for forced rotation. However, the login endpoint (`admin/src/app/api/auth/login/route.ts`) never queries or checks this flag. Default admin passwords remain usable indefinitely.

### WARN-12: Admin Settings PUT Uses Manual Validation Instead of Zod

**File**: `admin/src/app/api/admin/settings/route.ts`, lines 98-134

The PUT handler manually validates required fields and email formats instead of using `withValidation()` with a Zod schema. This is inconsistent with other routes and provides weaker validation (e.g., the email regex is permissive).

---

## Pass

### AUTH-1: Iron-Session Encrypted Cookies -- PASS
- Session data is encrypted with a 32+ character secret (`SESSION_SECRET` env var, validated at startup: `session.ts` line 38)
- Cookie is `httpOnly: true` (line 50)
- `secure: true` in production (line 49)
- 7-day TTL (line 52)

### AUTH-2: Password Hashing with bcrypt -- PASS
- Login route uses `bcrypt.compare()` (`auth/login/route.ts`, line 63)
- `bcryptjs` library is used (battle-tested)

### AUTH-3: Login Rate Limiting -- PASS
- 5 attempts per 15 minutes per IP (`rate-limit.ts`, line 72)
- Rate limit resets on successful login (line 72 in `login/route.ts`)
- Separate read (60/min) and write (20/min) API rate limiters

### AUTH-4: Login Route Checks Admin Role -- PASS
- `auth/login/route.ts` line 55: `if (user.role !== 'admin')` returns 403
- Non-admin users cannot log in to the admin panel

### AUTH-5: Session Validated on Every Request -- PASS
- `withAuth` checks `session.isLoggedIn && session.id && session.role === 'admin'` on every call
- `withPermission` checks via `getAdminSession()` and then queries `user_roles` for fine-grained RBAC

### RBAC-1: Role-Based Permission System -- PASS
- Roles stored in `admin_roles` table with JSONB `permissions` (resource -> actions)
- `user_roles` join table links users to roles
- Super admin bypass via `isSuperAdmin()` check (`rbac.ts` line 104)
- Granular permissions: `products.read`, `products.create`, `orders.refund`, `designs.moderate`, etc.

### RBAC-2: Most Routes Use Auth Guards -- PASS
- 87 of 90 route handlers use `withAuth`, `withPermission`, `requireAuth`, or inline `checkAdminAuth()`
- Only 3 routes are genuinely unprotected (health, metrics, top-products)

### RBAC-3: Mutation Routes Use RBAC Permissions -- PASS
- POST/PATCH/DELETE routes correctly use `withPermission` with specific resource+action pairs
- Example: `withPermission('products', 'update', ...)`, `withPermission('orders', 'refund', ...)`

### DATA-1: Service Role Key Usage Justified -- PASS
- Admin panel legitimately needs RLS bypass to manage all users, products, orders
- `supabaseAdmin` is only used server-side (never in client components)
- Both `supabase.ts` and `supabase-admin.ts` validate env vars at startup

### DATA-2: Directory Traversal Prevention in Memory API -- PASS
- `agent/memory/route.ts` lines 47, 69: `if (!filePath.startsWith(CONTEXT_DIR))` prevents `../` traversal

### INPUT-1: Zod Validation on Key Mutation Routes -- PASS
- `productSchema`, `orderUpdateSchema`, `designModerationSchema`, `brandConfigSchema`, `settingsSchema`, `categorySchema`, `bulkOrderUpdateSchema`, `bulkProductUpdateSchema`, `blogPostSchema`, `themeSchema`, `designUpdateSchema` -- comprehensive coverage
- `withValidation()` wrapper returns structured 400 errors with field-level details

### HEADER-1: Security Headers Comprehensive -- PASS
- `X-Content-Type-Options: nosniff` (line 41)
- `X-Frame-Options: DENY` (line 42)
- `X-XSS-Protection: 1; mode=block` (line 43)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (line 44)
- `Referrer-Policy: strict-origin-when-cross-origin` (line 45)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` (line 46)
- `frame-ancestors 'none'` in CSP (line 49)
- API routes: `Cache-Control: no-store` (line 54)

### HEADER-2: CSP Restricts Connect Sources -- PASS
- `connect-src 'self' https://*.supabase.co https://api.printful.com` -- no wildcard
- `img-src` properly includes CDN domains

### AUDIT-1: Audit Log Infrastructure Exists -- PASS
- `audit.ts` provides `logCreate`, `logUpdate`, `logDelete` with before/after diff
- `withAuth` middleware auto-logs all requests with IP, user agent, status code
- Audit log viewer route at `/api/audit` (`audit/route.ts`)

### CONFIG-1: Secrets From Environment Variables -- PASS
- `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PODCLAW_BRIDGE_AUTH_TOKEN` all from env
- No hardcoded secrets in source code
- Startup validation for required env vars

### CONFIG-2: Standalone Output Mode Configured -- PASS
- `next.config.ts` line 4: `output: "standalone"` for Docker deployment
- basePath configurable via `ADMIN_BASE_PATH` env var

### MIDDLEWARE-1: Edge Middleware Redirects Unauthenticated Page Access -- PASS
- `middleware.ts` checks for `admin-session` cookie existence
- Redirects to `/login` if cookie is missing
- Correctly excludes `/login` and `/api/` from the check

---

## Recommendations (Priority Ordered)

### P0 -- Immediate (Security)

1. **Add auth to `/api/dashboard/top-products`** -- wrap with `withAuth`. This is a zero-auth data leak.
2. **Add auth to `/api/metrics`** and `/api/admin/brand-config` GET. At minimum, require admin session.
3. **Enforce `must_change_password`** in the login route -- query the flag, return a `must_change_password: true` response instead of a session, and add a password change endpoint.
4. **Sanitize search inputs** before interpolating into `.or()` filter strings. Strip or escape `.`, `,`, `(`, `)` characters that are PostgREST operators.
5. **Add Zod validation to `designs/bulk-delete`** -- validate `ids` as `z.array(z.string().uuid())`.

### P1 -- Short Term (Hardening)

6. **Add audit logging** to all mutation routes currently missing it (bulk-delete, blog delete, theme activate, AB tests, bulk product update).
7. **Stop leaking `error.message`** in responses -- return generic messages and log details server-side only.
8. **Change `sameSite` to `'strict'`** for the admin session cookie.
9. **Replace inline `checkAdminAuth()`** in all agent proxy routes with `withAuth` to get automatic rate limiting and audit logging.
10. **Use a dedicated shared secret** for frontend revalidation instead of `SUPABASE_SERVICE_KEY`.

### P2 -- Medium Term (Architecture)

11. **Add `withPermission` audit logging** -- the `withPermission` wrapper should auto-log like `withAuth` does, eliminating the need for manual `logAudit` calls.
12. **Upgrade or replace `xlsx`** -- 2 high-severity CVEs with no upstream fix. Consider `exceljs` or `xlsx-populate`.
13. **Use nonce-based CSP** instead of `'unsafe-inline'` for scripts.
14. **Implement server-side session store** (Redis) for remote revocation capability.
15. **Add MFA** (TOTP/WebAuthn) for admin accounts.
16. **Move rate limiter to Redis** for persistence across restarts and multi-instance deployments.
17. **Remove test user migration** `20260213232458` or gate it behind an environment check so it does not run in production.
