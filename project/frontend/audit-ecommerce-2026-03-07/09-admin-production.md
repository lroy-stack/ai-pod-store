# SKAPARA Admin Panel Audit — 2026-03-07

## Executive Summary

The admin panel is architecturally solid with iron-session encrypted cookies, Zod validation, RBAC with granular permissions, rate limiting, audit logging, and comprehensive security headers. However, **three critical issues** block production: (1) no logout endpoint exists, making session termination impossible; (2) the error boundary at `error.tsx:34` leaks `error.message` to the UI in production; and (3) the `GET /api/admin/legal-settings` endpoint is unauthenticated, exposing company legal data. Overall quality is high -- the codebase demonstrates mature patterns with consistent auth wrappers, Zod schemas, and proper error handling across ~60 API routes.

---

## Findings

### Phase 1: Authentication & Session Security

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ADM-01 | **No logout endpoint exists.** No `/api/auth/logout` route. No `session.destroy()` call anywhere. Admins cannot terminate their sessions. | CRITICAL | (missing file) | Create `POST /api/auth/logout` that calls `session.destroy()` and clears the cookie. Add logout button to Sidebar/TopBar. |
| ADM-02 | Session cookie `maxAge` is 7 days (`60*60*24*7`). For an admin panel this is excessively long. | HIGH | `src/lib/session.ts:52` | Reduce to 8-12 hours for admin sessions. Add idle timeout. |
| ADM-03 | `SESSION_SECRET` validated at module load with `throw new Error()` -- good. Password is from env, not hardcoded. | OK | `src/lib/session.ts:38-40` | -- |
| ADM-04 | Cookie config: `httpOnly: true`, `sameSite: 'strict'`, `secure: production-only`, `path: '/'` -- all correct. | OK | `src/lib/session.ts:49-54` | -- |
| ADM-05 | Login rate limiting: 5 attempts per 15 minutes per IP via in-memory `RateLimiter`. Resets on success. | OK | `src/lib/rate-limit.ts:72`, `src/app/api/auth/login/route.ts:21-37` | For multi-instance deployments, migrate to Redis-backed rate limiting. |
| ADM-06 | Rate limiter bypass for E2E tests: `PLAYWRIGHT_TEST_BASE_URL` or `CI` env vars skip rate limiting entirely. | MEDIUM | `src/lib/rate-limit.ts:30-31` | Ensure these env vars are never set in production. Add explicit `NODE_ENV !== 'production'` guard. |
| ADM-07 | `must_change_password` flag enforced: login returns 200 with `must_change_password: true` instead of creating session, requiring password change first. | OK | `src/app/api/auth/login/route.ts:75-85` | -- |
| ADM-08 | Password change requires min 12 characters. bcrypt cost factor 12. No complexity requirements (uppercase, digits, symbols). | MEDIUM | `src/app/api/auth/change-password/route.ts:36-41,65` | Add complexity validation (at least one uppercase, one digit, one symbol). |
| ADM-09 | No session invalidation on password change. Old sessions remain valid after password update. | HIGH | `src/app/api/auth/change-password/route.ts:82-89` | On password change, invalidate all existing sessions (rotate session secret or store session IDs server-side). |
| ADM-10 | No account lockout after failed login attempts -- rate limiting slows down but doesn't lock the account. | MEDIUM | `src/app/api/auth/login/route.ts` | After 10 failed attempts, lock the account and require admin intervention or email verification. |
| ADM-11 | `create-admin.mjs` is deprecated and exits immediately with a security warning. Hardcoded credentials are commented out. | OK | `create-admin.mjs:1-19` | Remove file entirely from the repo. |

### Phase 2: RBAC & Authorization

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ADM-12 | Granular RBAC via `withPermission()`: checks `user_roles` + `admin_roles.permissions` JSONB per resource/action. `super_admin` bypasses all checks. | OK | `src/lib/rbac.ts:53-98,181-229` | -- |
| ADM-13 | `withAuth()` middleware enforces `role === 'admin'` on all wrapped routes. Returns 403 for non-admin roles. | OK | `src/lib/auth-middleware.ts:131-135` | -- |
| ADM-14 | RBAC permission check does 2 DB queries per request (`isSuperAdmin` + `hasPermission`). No caching. | MEDIUM | `src/lib/rbac.ts:206-214` | Cache user permissions in session or short-TTL memory cache to reduce DB roundtrips. |
| ADM-15 | Role update (`PUT /api/admin/roles`) prevents modifying `super_admin` role. | OK | `src/app/api/admin/roles/route.ts:43-44` | -- |
| ADM-16 | No validation that `permissions` payload in role update is a valid `Record<string, string[]>`. Accepts arbitrary JSON. | MEDIUM | `src/app/api/admin/roles/route.ts:29-33` | Add Zod schema validation for the `permissions` field. |
| ADM-17 | Self-escalation possible: an admin with `roles.update` permission can grant themselves any permission including `roles.manage_roles`. | HIGH | `src/app/api/admin/roles/route.ts:27` | Only `super_admin` should be able to modify roles. Add explicit super_admin check. |

### Phase 3: CRUD Operations

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ADM-18 | **Products CRUD**: GET (list with search/pagination), POST (create with Zod validation), PATCH (update with before/after audit log), bulk status update, bulk price update. All use `withPermission()`. Comprehensive. | OK | `src/app/api/products/` | -- |
| ADM-19 | **Orders CRUD**: GET list uses `requireAuth()` from `auth.ts` (no RBAC permission check), unlike products which use `withPermission()`. Inconsistent auth pattern. | MEDIUM | `src/app/api/orders/route.ts:3-4` | Migrate to `withPermission('orders', 'read', ...)` for consistency. |
| ADM-20 | **Customers CRUD**: GET list (`withAuth`), GET detail (`withAuth`), PATCH update (`withPermission`), POST actions (`withPermission`). Read operations lack RBAC granularity. | LOW | `src/app/api/customers/route.ts:49`, `src/app/api/customers/[id]/route.ts:17` | Consider adding `withPermission('customers', 'read', ...)`. |
| ADM-21 | Customers GET fetches ALL users then filters/paginates in JS. Will degrade with 10K+ users. | HIGH | `src/app/api/customers/route.ts:60-64` | Push search/filter/pagination to Supabase query level. |
| ADM-22 | **Designs CRUD**: GET list uses `getAdminSession()` inline check (not `withAuth`/`withPermission`). Creates new Supabase client per request instead of using shared `supabaseAdmin`. | MEDIUM | `src/app/api/designs/route.ts:5-9,22-23` | Standardize to `withPermission()` and `supabaseAdmin`. |
| ADM-23 | Designs bulk delete: validated with Zod, max 100 IDs, uses `withPermission('designs', 'delete')`, audit logged. | OK | `src/app/api/designs/bulk-delete/route.ts` | -- |
| ADM-24 | No product DELETE endpoint. Products can only be archived via PATCH status. This is safe for data integrity. | OK | -- | -- |
| ADM-25 | Bulk price editor: Zod validation (min 1, max 500 updates), margin calculation with Stripe fees, per-product audit logging. | OK | `src/app/api/products/bulk-price/route.ts:7-14` | -- |
| ADM-26 | Bulk price updates run sequentially in a `for` loop (up to 500 items). No transaction wrapping -- partial failures possible. | MEDIUM | `src/app/api/products/bulk-price/route.ts:78-103` | Use batch update or wrap in a Supabase RPC transaction. |

### Phase 4: Dashboard & Analytics

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ADM-27 | Dashboard stats: 8+ DB queries per request (revenue current/previous, orders current/previous, products, conversion, subscribers, churn). All server-side aggregation. | MEDIUM | `src/app/api/dashboard/stats/route.ts:21-160` | Add caching (e.g., 5-minute TTL) for dashboard stats. |
| ADM-28 | Dashboard revenue fetches ALL completed orders to sum client-side (`reduce`). Will degrade with volume. | HIGH | `src/app/api/dashboard/stats/route.ts:21-30` | Use `supabaseAdmin.rpc()` with a server-side aggregate function or add a materialized view. |
| ADM-29 | SSE stream: single `EventSource` connection, authenticated via `withAuth`, heartbeat every 30s, cleanup on abort. | OK | `src/app/api/events/stream/route.ts:19-65` | -- |
| ADM-30 | SSE `onerror` closes the connection and does NOT reconnect. Admin loses real-time updates until page refresh. | MEDIUM | `src/components/providers/SSEProvider.tsx:159-161` | Implement exponential backoff reconnection (e.g., retry after 5s, 10s, 30s). |
| ADM-31 | SSE emitter is in-memory singleton. Will not work across multiple server instances. | MEDIUM | `src/lib/sse-emitter.ts:3-4` | Document as single-instance limitation. For multi-instance, use Redis pub/sub. |
| ADM-32 | Dashboard page has loading skeletons, empty states for orders, chart loading states. | OK | `src/app/(dashboard)/page.tsx:136-155,432-433` | -- |

### Phase 5: Data Validation & Error Handling

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ADM-33 | **error.tsx leaks `error.message` in production.** The dashboard error boundary displays `error.message` unconditionally (no `NODE_ENV` check). | CRITICAL | `src/app/(dashboard)/error.tsx:34-38` | Wrap in `process.env.NODE_ENV === 'development'` guard, like `ErrorBoundary.tsx:78` does correctly. |
| ADM-34 | `ErrorBoundary.tsx` correctly gates error details behind `NODE_ENV === 'development'`. | OK | `src/components/ErrorBoundary.tsx:78` | -- |
| ADM-35 | All API routes return generic error messages (`'Failed to fetch products'`, `'Internal server error'`). No `error.message` leaks in API responses. | OK | All API routes | -- |
| ADM-36 | **SQL injection via `.or()` with user input.** Search terms are sanitized by stripping `.,()%_*\` characters, but NOT commas. A search input like `title.ilike.%x%,password_hash.ilike.%` could inject additional filter columns into the `.or()` call. | HIGH | `src/app/api/products/route.ts:14,25`, `src/app/api/orders/route.ts:15,42`, `src/app/api/designs/route.ts:31,46`, `src/app/api/search/route.ts:15,21,28,35` | Strip commas from search input OR use parameterized `.ilike()` with `.or()` filter objects instead of string interpolation. |
| ADM-37 | Comprehensive Zod schemas for all major entities: products, orders, designs, categories, brand config, settings, blog posts, themes. | OK | `src/lib/validation.ts`, `src/lib/schemas/extended.ts` | -- |
| ADM-38 | `withValidation()` wrapper catches `ZodError` and returns structured 400 with field-level messages. Non-Zod errors are re-thrown (caught by outer handler). | OK | `src/lib/validation.ts:8-34` | -- |
| ADM-39 | Settings PUT at `admin/settings/route.ts:80-216` uses inline validation (not Zod). Validates required fields and email format manually. | LOW | `src/app/api/admin/settings/route.ts:97-138` | Migrate to the existing `settingsSchema` from `validation.ts`. |
| ADM-40 | `dev/check-index/route.ts:123` leaks `err.message` in 500 response. | MEDIUM | `src/app/api/dev/check-index/route.ts:123` | Return generic error. This route should be disabled in production. |
| ADM-41 | Product update passes `validatedData` directly to `.update()`. Since Zod strips unknown fields, mass assignment is prevented. | OK | `src/app/api/products/[id]/route.ts:112-114` | -- |

### Phase 6: UI & Responsiveness

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ADM-42 | Uses shadcn/ui consistently: Button, Input, Card, Badge, Table, Dialog, Sheet, Checkbox, Select, Tabs, Avatar, DropdownMenu, AlertDialog, Tooltip, Skeleton, ScrollArea, Popover. | OK | Throughout `src/components/ui/` | -- |
| ADM-43 | DashboardLayout: desktop sidebar (hidden on mobile via `hidden lg:block`), mobile Sheet sidebar with hamburger menu, sticky TopBar. Touch target min 44px (`min-h-[44px] min-w-[44px]`). | OK | `src/components/DashboardLayout.tsx:17-62` | -- |
| ADM-44 | Breadcrumbs component present for navigation hierarchy. | OK | `src/components/Breadcrumbs.tsx` | -- |
| ADM-45 | Command palette (`Cmd+K`) for global search. Keyboard shortcuts (`j/k/Enter/Escape/?`). | OK | `src/components/CommandPalette.tsx`, `src/hooks/useKeyboardShortcuts.ts` | -- |
| ADM-46 | DataTable with sortable column headers, row selection (checkboxes), toolbar with search/filter. | OK | `src/components/ui/data-table.tsx`, `data-table-column-header.tsx`, `data-table-toolbar.tsx` | -- |
| ADM-47 | **Hardcoded Tailwind color tokens** in multiple files: `text-green-600`, `text-red-600`, `bg-blue-500/10`, `bg-purple-100`, etc. Violates semantic token policy. | MEDIUM | `src/app/(dashboard)/page.tsx:68-69`, `src/app/(dashboard)/customers/[id]/page.tsx:57-60`, `src/components/ActivityFeed.tsx:52,55`, `src/components/orders/OrderKanbanBoard.tsx:17,25,28`, `src/app/(dashboard)/analytics/page.tsx:575-647` | Replace with `text-success`, `text-destructive`, `bg-primary/10`, etc. |
| ADM-48 | Dark mode support: uses CSS variables (`hsl(var(--primary))`), `dark:` Tailwind variants on RFM badges. Charts use semantic tokens. | OK | Throughout | -- |
| ADM-49 | Loading states: skeleton cards on dashboard, "Loading chart..." text, `animate-pulse` placeholders. Tables show loading via React Query `isLoading`. | OK | `src/app/(dashboard)/page.tsx:136-155` | -- |
| ADM-50 | Empty states: "No recent orders" message, DataTable empty state component. | OK | `src/app/(dashboard)/page.tsx:433`, `src/components/ui/data-table-empty.tsx` | -- |
| ADM-51 | Products/Orders pages fetch 500 items (`limit: 500`) and paginate client-side via DataTable. | MEDIUM | `src/app/(dashboard)/products/page.tsx:23`, `src/app/(dashboard)/orders/page.tsx:58` | For large catalogs, implement server-side pagination. |

### Phase 7: Production Hardening

| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ADM-52 | Security headers configured: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `HSTS` (1 year), `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` (restrictive). | OK | `next.config.ts:40-56` | -- |
| ADM-53 | CSP allows `'unsafe-inline'` for both `script-src` and `style-src`. | MEDIUM | `next.config.ts:49` | Use nonce-based CSP for scripts. `style-src 'unsafe-inline'` is acceptable for Tailwind. |
| ADM-54 | API routes set `Cache-Control: no-store`. | OK | `next.config.ts:54` | -- |
| ADM-55 | `output: "standalone"` configured for Docker deployment. | OK | `next.config.ts:6` | -- |
| ADM-56 | No hardcoded secrets in source code. All credentials from env vars. Deprecated `create-admin.mjs` has commented-out secrets and exits immediately. | OK | -- | -- |
| ADM-57 | `GET /api/health` has NO authentication check. Returns service status and uptime. | LOW | `src/app/api/health/route.ts:3-9` | Acceptable for health checks by load balancers, but remove `process.uptime()` to avoid information leakage. |
| ADM-58 | `GET /api/admin/legal-settings` has NO authentication. Returns company legal data (company name, address, tax ID, DPO email). | HIGH | `src/app/api/admin/legal-settings/route.ts:19-67` | Add authentication. Even if frontend reads it, the admin API should not expose it unauthenticated. |
| ADM-59 | Structured logging via Pino with JSON output in production, pretty-print in dev. Log levels configurable via `LOG_LEVEL` env var. | OK | `src/lib/logger.ts` | -- |
| ADM-60 | Audit log records all admin API requests via `withAuth` wrapper (fire-and-forget). Separate `logCreate/logUpdate/logDelete` for CRUD audit trails. | OK | `src/lib/auth-middleware.ts:61-88`, `src/lib/audit.ts` | -- |
| ADM-61 | Health check endpoint at `/api/monitoring/health` checks Supabase, Printful, Stripe, Redis, PodClaw connectivity. Protected by `withAuth`. | OK | `src/app/api/monitoring/health/route.ts` | -- |
| ADM-62 | Prometheus metrics endpoint at `/api/metrics` returns memory usage, uptime. Protected by `withAuth`. | OK | `src/app/api/metrics/route.ts` | -- |
| ADM-63 | Directory traversal protection in agent memory route: validates `filePath.startsWith(CONTEXT_DIR)`. | OK | `src/app/api/agent/memory/route.ts:47,68` | -- |
| ADM-64 | Middleware at `src/middleware.ts` only checks cookie EXISTENCE (not validity) due to Edge runtime limitations. Actual session decryption happens in API routes. | OK | `src/middleware.ts:15-16` | -- |
| ADM-65 | Middleware allows ALL `/api/*` routes without cookie check (`pathname.startsWith('/api/')`). Auth is enforced per-route by `withAuth`/`withPermission`. | OK | `src/middleware.ts:7` | -- |

---

## Auth Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| iron-session password in env | OK | `SESSION_SECRET` validated at startup, throws if missing |
| httpOnly cookie | OK | `httpOnly: true` in session config |
| Secure cookie in production | OK | `secure: process.env.NODE_ENV === 'production'` |
| SameSite strict | OK | `sameSite: 'strict'` |
| Login rate limiting | OK | 5 attempts / 15 min per IP |
| API rate limiting | OK | 60 GET/min, 20 write/min per IP |
| Password hashing (bcrypt) | OK | Cost factor 12 |
| must_change_password enforced | OK | Blocks session creation until changed |
| All API routes protected | FAIL | `GET /api/health` (intentional), `GET /api/admin/legal-settings` (unprotected) |
| Logout endpoint | FAIL | No logout route exists |
| Session invalidation on password change | FAIL | Old sessions remain valid |
| Error message leak prevention (API) | OK | All catch blocks return generic messages |
| Error message leak prevention (UI) | FAIL | `error.tsx:34` shows `error.message` unconditionally |
| CSRF protection | OK | SameSite=strict + iron-session encryption |
| Security headers | OK | CSP, HSTS, X-Frame-Options, etc. |

---

## API Route Coverage

| Route | Auth Method | Validation | Error Handling | Notes |
|-------|-------------|------------|----------------|-------|
| `POST /api/auth/login` | Rate limit only (pre-auth) | Manual (email+password required) | OK -- generic errors | Correct: no auth needed for login |
| `POST /api/auth/change-password` | Rate limit + user_id verification | Manual (min 12 chars) | OK | No session required (pre-auth flow) |
| `GET /api/health` | **NONE** | N/A | OK | Leaks `process.uptime()` |
| `GET /api/events/stream` | `withAuth` | N/A | OK | SSE endpoint |
| `GET /api/products` | `withPermission('products','read')` | Search sanitized | OK | `.or()` injection risk (ADM-36) |
| `POST /api/products` | `withPermission('products','create')` | Zod `productSchema` | OK | Audit logged |
| `GET /api/products/[id]` | `withPermission('products','read')` | UUID from route | OK | |
| `PATCH /api/products/[id]` | `withPermission('products','update')` | Zod `productUpdateSchema` | OK | Before/after audit |
| `GET /api/products/bulk-price` | `withPermission('products','read')` | N/A | OK | |
| `PATCH /api/products/bulk-price` | `withPermission('products','update')` | Zod (1-500 updates) | OK | Sequential, no txn |
| `PATCH /api/products/bulk` | `withPermission('products','update')` | Zod `bulkProductUpdateSchema` | OK | |
| `GET /api/orders` | `requireAuth()` (auth.ts) | Search sanitized | OK | **No RBAC check** (ADM-19) |
| `GET /api/orders/[id]` | `withAuth` | UUID from route | OK | |
| `GET /api/customers` | `withAuth` | Search in JS | OK | Fetches all users (ADM-21) |
| `GET /api/customers/[id]` | `withAuth` | UUID from route | OK | |
| `PATCH /api/customers/[id]` | `withPermission('customers','update')` | Zod | OK | |
| `POST /api/customers/[id]` | `withPermission('customers','update')` | Manual (action field) | OK | |
| `GET /api/designs` | `getAdminSession()` inline | Search sanitized | OK | **Inconsistent auth** (ADM-22) |
| `GET /api/designs/[id]` | `withAuth` | UUID from route | OK | |
| `PATCH /api/designs/[id]` | `withPermission('designs','update')` | Zod `designUpdateSchema` | OK | |
| `PUT /api/designs/[id]/moderate` | `withPermission('designs','moderate')` | Zod `designModerationSchema` | OK | |
| `DELETE /api/designs/bulk-delete` | `withPermission('designs','delete')` | Zod (1-100 UUIDs) | OK | Audit logged |
| `GET /api/designs/mapping` | `getAdminSession()` inline | N/A | OK | |
| `GET /api/dashboard/stats` | `requireAuth()` (auth.ts) | N/A | OK | 8+ DB queries |
| `GET /api/search` | `withAuth` | Search sanitized | OK | `.or()` injection risk |
| `GET /api/admin/roles` | `withAuth` | N/A | OK | |
| `PUT /api/admin/roles` | `withPermission('roles','update')` | Manual | OK | No Zod validation (ADM-16) |
| `GET /api/admin/settings` | inline iron-session | N/A | OK | |
| `PUT /api/admin/settings` | inline iron-session | Manual | OK | No Zod schema (ADM-39) |
| `GET /api/admin/legal-settings` | **NONE** | N/A | OK | **UNPROTECTED** (ADM-58) |
| `PUT /api/admin/legal-settings` | inline iron-session | Manual | OK | |
| `GET /api/agent/memory` | inline iron-session | Path traversal check | OK | |
| `GET /api/metrics` | `withAuth` | N/A | OK | Prometheus format |
| `GET /api/monitoring/health` | `withAuth` | N/A | OK | Multi-service checks |
| `POST /api/task` | `withAuth` | Manual (message required) | OK | |
| `GET /api/dev/check-index` | `withAuth` | N/A | FAIL | Leaks `err.message` (ADM-40) |

---

## Scorecard

| Category | Score /10 | Notes |
|----------|-----------|-------|
| Auth & Security | 6 | Strong foundation (iron-session, bcrypt, rate limiting) but missing logout, no session invalidation on password change, error.message leak |
| RBAC | 8 | Granular permissions with super_admin bypass, but self-escalation possible and no permission caching |
| CRUD Quality | 8 | Zod validation, audit trails, before/after tracking. Minor inconsistencies in auth wrappers across routes |
| Dashboard | 7 | Rich analytics with charts, SSE real-time, activity feed. Performance concerns with full-table scans |
| Data Validation | 8 | Comprehensive Zod schemas, `withValidation` wrapper, search input sanitization (with comma gap) |
| UI Quality | 8 | Consistent shadcn/ui, responsive layout, loading/empty states, keyboard shortcuts, dark mode. Some hardcoded color tokens |
| Production Readiness | 7 | Security headers, structured logging, audit log, health checks, standalone build. Missing logout is a production blocker |

---

## Priority Action Items

1. **[P0] Create logout endpoint.** Add `POST /api/auth/logout` with `session.destroy()`. Add logout button to TopBar/Sidebar. Without this, admins cannot terminate sessions. (`ADM-01`)

2. **[P0] Fix error.message leak in error.tsx.** Gate `error.message` display behind `process.env.NODE_ENV === 'development'` check at `src/app/(dashboard)/error.tsx:34`. (`ADM-33`)

3. **[P0] Protect `GET /api/admin/legal-settings`.** Add `withAuth` or iron-session check. Currently exposes company legal data (tax ID, DPO email) without authentication. (`ADM-58`)

4. **[P1] Fix `.or()` SQL injection vector.** Strip commas from search input in the sanitization regex at `products/route.ts:14`, `orders/route.ts:15`, `designs/route.ts:31`, `search/route.ts:15`. Change `replace(/[.,()%_*\\]/g, '')` to `replace(/[.,()%_*\\,]/g, '')` (add comma). Alternatively, use Supabase filter objects instead of string interpolation. (`ADM-36`)

5. **[P1] Invalidate sessions on password change.** After updating the password hash, rotate the session secret or implement server-side session tracking to invalidate old sessions. (`ADM-09`)

6. **[P1] Reduce session maxAge.** Change from 7 days to 8-12 hours for an admin panel. (`ADM-02`)

7. **[P1] Fix self-escalation in role updates.** Add `isSuperAdmin()` check to `PUT /api/admin/roles` instead of relying on `withPermission('roles', 'update')`. (`ADM-17`)

8. **[P1] Fix customers full-table-scan.** Push search/filter/pagination to Supabase instead of fetching all users and filtering in JS. (`ADM-21`)

9. **[P2] Add reconnection logic to SSE.** Implement exponential backoff in `SSEProvider.tsx` instead of silently closing on error. (`ADM-30`)

10. **[P2] Standardize auth wrappers.** Migrate `orders/route.ts`, `designs/route.ts`, `dashboard/stats/route.ts` to use `withPermission()` instead of mixed `requireAuth()`/`getAdminSession()` patterns. (`ADM-19, ADM-22`)

11. **[P2] Add rate limiter production guard.** Ensure `PLAYWRIGHT_TEST_BASE_URL`/`CI` bypass cannot be set in production. (`ADM-06`)

12. **[P2] Cache dashboard stats.** Add 5-minute TTL cache for the 8+ DB queries in `/api/dashboard/stats`. (`ADM-27`)

13. **[P2] Replace hardcoded color tokens** with semantic tokens (`text-success`, `text-destructive`, `bg-primary/10`). (`ADM-47`)

14. **[P3] Add password complexity requirements.** Require uppercase, digit, and symbol in addition to 12-char minimum. (`ADM-08`)

15. **[P3] Remove `process.uptime()` from health endpoint.** Minor information leakage. (`ADM-57`)

16. **[P3] Disable `dev/check-index` route in production** or remove `err.message` from its 500 response. (`ADM-40`)
