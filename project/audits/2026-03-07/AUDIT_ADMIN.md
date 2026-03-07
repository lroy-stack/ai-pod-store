# Admin Panel Audit -- 2026-03-07

## Summary

| Metric | Count |
|--------|-------|
| Total checks | 48 |
| PASS | 27 |
| WARN | 14 |
| FAIL | 5 |
| CRITICAL | 2 |

**Codebase scope**: 233 source files, 94 API route files, 55 write handlers, ~40 dashboard pages.

---

## 1. Authentication

### 1.1 Session Mechanism

**PASS** -- iron-session with encrypted, signed cookies.

- Cookie name: `admin-session`
- `httpOnly: true`, `sameSite: 'strict'`, `secure` in production
- TTL: 7 days (`maxAge: 60 * 60 * 24 * 7`)
- Encryption key from `SESSION_SECRET` env var (required at startup)
- File: `admin/src/lib/session.ts`

### 1.2 Login Security

**PASS** -- bcrypt password hashing, rate limiting on login.

- `bcryptjs` with cost factor 12 for new passwords
- Rate limiter: 5 attempts per 15 minutes per IP (`adminLoginLimiter`)
- Constant-time error messages ("Invalid email or password") -- no user enumeration
- File: `admin/src/app/api/auth/login/route.ts`

### 1.3 must_change_password Enforcement

**PASS** -- Properly enforced. When `must_change_password=true`, login returns the flag without creating a session (line 75-84 of login/route.ts). Session is only created after password change via `/api/auth/change-password`.

### 1.4 Change-Password Route: No Rate Limiting

| Severity | P1 |
|----------|----|

**FAIL** -- `admin/src/app/api/auth/change-password/route.ts` does NOT use `adminLoginLimiter` or `checkApiRateLimit`. An attacker knowing a `user_id` (UUID) can brute-force the current password with unlimited attempts. The login route is rate-limited, but this endpoint is not.

### 1.5 Session Rotation

**WARN** -- No session rotation after privilege change. When a user changes their password, a new session is created, but existing sessions (if any) are not invalidated. iron-session has no server-side session store, so remote revocation is not possible without adding one (e.g., Redis-based session tracking).

### 1.6 MFA

**WARN** -- No MFA support exists. Known blocker documented in project memory.

---

## 2. Authorization (RBAC)

### 2.1 Role Definitions

**PASS** -- Roles stored in `admin_roles` table with JSONB `permissions` field. Permission checks via `user_roles` join. `super_admin` bypasses all checks.

- File: `admin/src/lib/rbac.ts`
- Functions: `hasPermission()`, `isSuperAdmin()`, `withPermission()`, `requireAuth()`

### 2.2 Auth Coverage Across API Routes

**94 total route files** examined. Auth usage breakdown:

| Guard | Routes Using |
|-------|-------------|
| `withAuth` (from auth-middleware) | 65 route files |
| `withPermission` (from rbac) | 33 route files |
| Inline session check (manual) | 4 route files |
| No auth at all | 2 route files |

### 2.3 Unprotected Routes (CRITICAL)

| Severity | P0 |
|----------|----|

**CRITICAL** -- The following route has a GET handler with NO authentication:

| Route | Method | Issue |
|-------|--------|-------|
| `/api/admin/legal-settings` | GET | No auth -- exposes company legal settings (company name, address, tax ID, DPO email) to unauthenticated users |

The GET handler at `admin/src/app/api/admin/legal-settings/route.ts:19` is a bare `export async function GET()` with no session check. The comment says "Public read access (used by legal pages on frontend)" but this admin API should not be the source for public frontend pages.

### 2.4 Routes with Inline Auth (Not Using withAuth/withPermission)

| Severity | P2 |
|----------|----|

**WARN** -- 4 routes use manual inline session checking instead of `withAuth`/`withPermission`:

| Route | File |
|-------|------|
| `/api/admin/settings` GET + PUT | `admin/src/app/api/admin/settings/route.ts` |
| `/api/admin/legal-settings` PUT | `admin/src/app/api/admin/legal-settings/route.ts` |
| `/api/agent/memory` GET | `admin/src/app/api/agent/memory/route.ts` |
| `/api/designs` GET | `admin/src/app/api/designs/route.ts` (uses `getAdminSession` directly) |
| `/api/designs/mapping` GET | `admin/src/app/api/designs/mapping/route.ts` (uses `getAdminSession` directly) |

These routes ARE authenticated but miss the benefits of `withAuth`: automatic audit logging, rate limiting, and consistent error responses. The `designs/route.ts` and `designs/mapping/route.ts` routes use `getAdminSession()` from rbac.ts which validates the session but does not enforce rate limits.

### 2.5 withAuth vs withPermission Usage

**WARN** -- Many write operations use `withAuth` (any admin can access) instead of `withPermission` (granular RBAC):

| Route | Method | Current Guard |
|-------|--------|---------------|
| `/api/admin/sitemap` | POST | `withAuth` |
| `/api/admin/agent/soul` | POST | `withAuth` |
| `/api/admin/finance/export` | POST | `withAuth` |
| `/api/admin/seo` | POST | `withAuth` |
| `/api/admin/analytics/export` | POST | `withAuth` |
| `/api/agent/schedule` | PUT, POST | `withAuth` |
| `/api/agent/chat/stream` | POST | `withAuth` |
| `/api/tenants/create` | POST | `withAuth` |
| `/api/translations` | PUT | `withAuth` |
| `/api/messaging/config` | POST | `withAuth` |

These skip RBAC permission checks entirely. Any admin-role user can modify SEO, sitemap, agent schedules, tenant creation, etc.

### 2.6 Health Endpoint

**PASS** -- `/api/health` (line 3) is intentionally unauthenticated. Returns only `status`, `service`, `timestamp`, and `uptime`. No sensitive data exposed.

---

## 3. API Security

### 3.1 Input Validation (Zod)

| Severity | P2 |
|----------|----|

**FAIL** -- Only **11 out of 55 write handlers** (20%) use `withValidation` with Zod schemas. The remaining 40 authenticated write handlers accept unvalidated JSON bodies.

Routes with Zod validation:
- Products: create, update, bulk update
- Designs: update, moderate
- Blog: create
- Categories: create, update
- Themes: create, update
- Brand config: update

Routes **without** Zod validation (authenticated but no schema):
- Customers update (`PATCH /api/customers/[id]`)
- Bulk price update (`PATCH /api/products/bulk-price`)
- Variant update (`PATCH /api/products/[id]/variants`)
- All order updates and notes
- All return actions (approve, reject, receive)
- A/B test create, start, stop
- Tenant create, update
- Agent schedule, chat, soul
- Translations PUT
- Messaging config POST
- Admin roles, notifications, legal pages, sitemap, SEO
- Credits adjust

### 3.2 SQL Injection

**PASS** -- All database queries use the Supabase client (parameterized queries). The `.ilike.%${search}%` patterns in designs, products, orders, and search routes use Supabase's PostgREST filters which are parameterized server-side. No raw SQL string interpolation found.

However, the search in `designs/route.ts:46` does sanitize input: `const search = rawSearch.replace(/[.,()]/g, '').trim()`. Other routes (orders, products, global search) do NOT sanitize the search parameter before passing to `.ilike`.

### 3.3 Error Message Leaks

| Severity | P2 |
|----------|----|

**WARN** -- The dashboard error page (`admin/src/app/error.tsx:34`) renders `error.message` to the user in production:
```tsx
{error.message && (
  <div className="rounded-lg bg-muted p-3">
    <p className="text-sm text-muted-foreground font-mono break-all">
      {error.message}
    </p>
  </div>
)}
```

The `ErrorBoundary` component (`admin/src/components/ErrorBoundary.tsx:78`) correctly gates error details behind `process.env.NODE_ENV === 'development'`, but the Next.js error page does not.

### 3.4 Rate Limiting

**PASS** -- Rate limiting is implemented:
- Login: 5 attempts / 15 min per IP (`adminLoginLimiter`)
- Read APIs: 60 req/min per IP (`readApiLimiter`)
- Write APIs: 20 req/min per IP (`writeApiLimiter`)
- Applied by both `withAuth` and `withPermission` wrappers

**WARN** -- Rate limiting is in-memory (`Map`), per-instance. Effective for single-server deployment but bypassed in multi-instance scenarios. The code documents this limitation.

**WARN** -- Rate limiting is bypassed when `PLAYWRIGHT_TEST_BASE_URL` or `CI` env vars are set (rate-limit.ts:30). Ensure these are never set in production.

### 3.5 CORS & CSP

**PASS** -- Security headers are comprehensive:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy` with `frame-ancestors 'none'`, restrictive `connect-src`
- `Permissions-Policy` disables camera, microphone, geolocation

**WARN** -- CSP allows `script-src 'self' 'unsafe-inline'`. Inline scripts are permitted, which weakens XSS protection. Consider using nonces.

### 3.6 XSS Vectors

| Severity | P2 |
|----------|----|

**WARN** -- `dangerouslySetInnerHTML` used in `admin/src/components/agent/artifacts/MermaidDiagram.tsx:74`. The SVG comes from the Mermaid library with `securityLevel: 'strict'` (line 27), which sanitizes output. Risk is low but present -- if the mermaid library has a vulnerability, SVG injection is possible.

---

## 4. Audit Logging

### 4.1 Audit Infrastructure

**PASS** -- Well-structured audit system:
- `admin/src/lib/audit.ts` -- `logAudit()`, `logCreate()`, `logUpdate()`, `logDelete()`, `getChanges()`
- `admin/src/lib/auth-middleware.ts` -- `withAuth` automatically logs all API requests to `audit_log` (fire-and-forget)
- Structured logging via Pino (`admin/src/lib/logger.ts`)

### 4.2 Explicit Audit Coverage

| Severity | P2 |
|----------|----|

**WARN** -- Only 7 route files use explicit `logCreate`/`logUpdate`/`logDelete`:

| Route | Audit Function |
|-------|---------------|
| Products create | `logCreate` |
| Products update | `logUpdate` |
| Products bulk-price | `logUpdate` |
| Product variants | `logUpdate` |
| Customers update | `logUpdate` |
| Designs bulk-delete | `logDelete` |
| Blog create | `logCreate` |

Routes that perform mutations but do NOT log explicitly:
- Order status updates, notes
- Returns (approve, reject, receive)
- A/B tests (create, start, stop)
- Tenant create/update
- Roles update
- Legal pages/settings update
- Categories create/update/delete
- Themes create/update/activate/delete
- Credits adjust
- Agent soul/schedule/memory modifications
- SEO, sitemap, messaging config updates
- Translations update

The `withAuth` wrapper does log all requests at the API level (method + path + status), but without capturing the specific `changes` payload (before/after). The `withPermission` wrapper does NOT auto-log at all.

### 4.3 Audit Log Tamper Resistance

**WARN** -- The admin Supabase client (`supabaseAdmin`) bypasses RLS and has INSERT access to `audit_log`. There is no evidence of DELETE or UPDATE restrictions on the audit_log table for the service role. An attacker with service key access could delete audit entries.

---

## 5. Data Handling

### 5.1 Supabase Client Usage

**PASS** -- Two admin-side Supabase clients:
- `admin/src/lib/supabase.ts` -- singleton `supabaseAdmin` (used by auth-middleware, audit, rbac)
- `admin/src/lib/supabase-admin.ts` -- factory `createClient()` (used by settings, legal-settings)

Both use `SUPABASE_SERVICE_KEY` (bypasses RLS). This is correct for admin operations.

### 5.2 adminFetch Usage

**PASS** -- Client-side components use `adminFetch()` from `admin/src/lib/admin-api.ts` for basePath-aware fetch calls. Found in 56 files. No instances of raw `fetch('/api/...')` that would break under basePath configuration.

### 5.3 Data Exposure

**WARN** -- The `/api/customers/[id]` route returns full customer profiles including email, addresses, order history, and computed CLV. This is expected for admin but should be noted for PII compliance.

---

## 6. UI Components

### 6.1 shadcn/ui Compliance

**PASS** -- Good adoption of shadcn/ui components. 25 UI components in `admin/src/components/ui/`:
`alert-dialog`, `avatar`, `badge`, `button`, `card`, `checkbox`, `command`, `data-table`, `data-table-column-header`, `data-table-empty`, `data-table-toolbar`, `dialog`, `dropdown-menu`, `input`, `label`, `popover`, `progress`, `safe-markdown`, `scroll-area`, `select`, `separator`, `sheet`, `skeleton`, `sparkline`, `switch`, `table`, `tabs`, `textarea`, `tooltip`

### 6.2 Prohibited Token Usage

| Severity | P3 |
|----------|----|

**FAIL** -- 27 occurrences of prohibited color tokens across 7 files:

| File | Violations |
|------|-----------|
| `monitoring/page.tsx` | 7 (bg-green-, bg-red-, bg-yellow-) |
| `OrderKanbanBoard.tsx` | 6 |
| `customers/page.tsx` | 4 |
| `customers/[id]/page.tsx` | 4 |
| `MarginCalculator.tsx` | 2 |
| `products/page.tsx` | 3 |
| `products/bulk-price-editor/page.tsx` | 1 |

Additionally, 7 instances of `bg-white`/`bg-black` in 4 files (3 in shadcn primitives, 4 in ImageGallery).

### 6.3 DataTable Adoption

**PASS** -- 5 major list pages use the shared `DataTable` + `DataTableColumnHeader`:
- Products, Customers, Orders, Designs, Blog

Other list pages (returns, reviews, translations, A/B tests, tenants, monitoring, etc.) use custom tables or lists.

---

## 7. SSE / Real-time

### 7.1 Duplicate SSE Connections

| Severity | P1 |
|----------|----|

**FAIL** -- Both `SSEProvider` and `NotificationsContext` independently create `EventSource` connections to `/api/events/stream`. Every authenticated admin page opens **2 concurrent SSE connections** to the same endpoint.

- `admin/src/components/providers/SSEProvider.tsx:12` -- creates EventSource
- `admin/src/contexts/NotificationsContext.tsx:78` -- creates another EventSource
- Both are mounted in `admin/src/app/layout.tsx` (lines 24-27)

This doubles server load, doubles memory usage, and means event handlers fire redundantly.

### 7.2 SSE Emitter

**PASS** -- In-memory `SSEEmitter` singleton is simple and correct for single-instance deployments. Documented limitation for multi-instance (needs Redis pub/sub).

### 7.3 SSEProvider Error Handling

**WARN** -- `SSEProvider` closes the connection on error (`eventSource.onerror = () => { eventSource.close() }`) with no reconnection logic. If the connection drops, SSE is permanently lost until page reload. `NotificationsContext` does not close on error (EventSource auto-reconnects by default).

---

## 8. React Query

### 8.1 Hook Adoption

**PASS** -- 4 custom query hooks exist:
- `useProducts`, `useOrders`, `useDesigns`, `useCustomers`

Used by: Products list, Orders list, Designs list, Customers list, Dashboard, Categories, Blog (7 pages).

### 8.2 Pages Still Using useEffect+fetch

| Severity | P3 |
|----------|----|

**WARN** -- At least **11 dashboard pages** still use raw `useEffect`+`useState`+`fetch` instead of React Query:

| Page | useState/useEffect count |
|------|------------------------|
| `monitoring/page.tsx` | 24 |
| `returns/page.tsx` | 11 |
| `settings/page.tsx` | 9 |
| `translations/page.tsx` | 9 |
| `orders/[id]/page.tsx` | 8 |
| `analytics/page.tsx` | 7 |
| `reviews/page.tsx` | 7 |
| `ab-tests/page.tsx` | 7 |
| `seo/page.tsx` | 6 |
| `messaging/page.tsx` | 5 |
| `finance/page.tsx` | 5 |

These pages lack automatic caching, refetching, and error/loading state management that React Query provides.

---

## 9. Build & Config

### 9.1 next.config.ts

**PASS** -- Well-configured:
- `output: "standalone"` for Docker
- `basePath` from env var
- Security headers comprehensive
- API routes get `Cache-Control: no-store`
- Turbopack persistent cache disabled (zombie process prevention)

### 9.2 TypeScript Errors

**PASS** (production code) -- 0 TypeScript errors in production source files.

**WARN** (test files) -- 14 TypeScript errors in test files (`src/__tests__/`), all related to Supabase mock typing. Tests may not compile.

### 9.3 Env Var Handling

**PASS** -- Critical env vars validated at module load:
- `SESSION_SECRET` -- throws if missing (`session.ts:38`)
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` -- throws if missing (`supabase.ts:8`, `supabase-admin.ts:8`)
- `ADMIN_BASE_PATH` -- defaults to empty string (non-critical)

---

## 10. Printful/Provider Terminology

### 10.1 Printify References

**PASS** -- Zero occurrences of "Printify" or "printify" found in admin source code. Migration to Printful terminology is complete.

---

## Critical Findings

### CRITICAL-1: Unauthenticated Legal Settings GET (P0)

**File**: `admin/src/app/api/admin/legal-settings/route.ts:19`
**Impact**: Company legal information (name, address, tax ID, DPO email) exposed without authentication.
**Fix**: Wrap GET handler with `withAuth` or `withPermission('settings', 'read', ...)`.

### CRITICAL-2: Duplicate SSE Connections (P1)

**Files**: `admin/src/components/providers/SSEProvider.tsx`, `admin/src/contexts/NotificationsContext.tsx`
**Impact**: Every admin page opens 2 SSE connections. Doubles server resource consumption. Toast notifications may fire twice for overlapping event types.
**Fix**: Remove the EventSource from `NotificationsContext` and have it consume events from `SSEProvider` via a shared context or callback.

---

## Other Findings (P1)

### FAIL-3: Change-Password Not Rate-Limited (P1)

**File**: `admin/src/app/api/auth/change-password/route.ts`
**Impact**: Brute-force attack on current password via unlimited attempts.
**Fix**: Add `adminLoginLimiter.check(clientIP)` check at the start of the handler.

---

## Recommendations (Ordered by Priority)

### P0 -- Immediate

1. **Add auth to legal-settings GET** -- Wrap with `withAuth` or move public data to a dedicated frontend API route that does not live under `/api/admin/`.

### P1 -- This Sprint

2. **Rate-limit change-password endpoint** -- Apply `adminLoginLimiter` or `checkApiRateLimit`.
3. **Consolidate SSE connections** -- Remove duplicate EventSource in NotificationsContext; have it consume from SSEProvider.
4. **Add reconnection to SSEProvider** -- Instead of `eventSource.close()` on error, implement exponential backoff reconnection.

### P2 -- Next Sprint

5. **Add Zod validation to remaining write handlers** -- Priority routes: customers update, order updates, returns actions, tenant create, credits adjust, roles update.
6. **Gate error.message behind NODE_ENV** in `admin/src/app/error.tsx` -- only show in development.
7. **Migrate inline-auth routes to withAuth/withPermission** -- settings, legal-settings PUT, agent/memory, designs GET.
8. **Upgrade withAuth routes to withPermission** for sensitive operations (sitemap, SEO, agent soul/schedule, tenant creation, finance export).
9. **Add explicit audit logging** to categories, themes, legal pages, roles, returns, orders, credits, agent schedule mutations.
10. **Sanitize search params** consistently -- designs route sanitizes, but orders/products/global search do not.

### P3 -- Backlog

11. **Replace prohibited color tokens** (27 occurrences) with semantic tokens (bg-success, bg-destructive, bg-warning).
12. **Migrate 11 dashboard pages** from useEffect+fetch to React Query hooks.
13. **Fix test file TypeScript errors** (14 errors in `__tests__/`).
14. **Remove `unsafe-inline` from CSP** script-src -- use nonces instead.
15. **Add server-side session store** (Redis) for remote session revocation.
16. **Add MFA** for admin accounts.

---

## Architecture Notes

- **94 API routes** across auth, dashboard, products, orders, customers, designs, agent, tenants, monitoring, analytics, admin settings, blog, reviews, translations, returns, A/B tests, messaging, events.
- **Auth wrappers**: `withAuth` (auth-middleware.ts, auto-audit + rate-limit) and `withPermission` (rbac.ts, RBAC + rate-limit, no auto-audit).
- **Validation**: `withValidation` (validation.ts) + Zod schemas in `validation.ts` and `schemas/extended.ts`.
- **SSE**: In-memory event emitter (`sse-emitter.ts`) with singleton pattern. Single-instance only.
- **React Query**: `QueryProvider` wrapping app, 4 custom hooks, 7 pages using them.
- **Error handling**: Global ErrorBoundary + Next.js error.tsx at root and dashboard level.
