# Production Audit: Admin Panel, Configuration, and Monitoring

**Date**: 2026-03-06
**Auditor**: Claude Sonnet 4.6 (automated)
**Scope**: `project/admin/`, `project/frontend/src/lib/store-config.ts`, `project/frontend/src/lib/brand-config-server.ts`, `project/frontend/src/lib/theme-loader.ts`, `project/frontend/src/lib/pod/monitoring.ts`, `project/frontend/src/lib/reliability/`, `project/frontend/src/app/api/health/route.ts`, `project/frontend/src/app/api/admin/alert/route.ts`, `project/admin/src/app/api/admin/settings/route.ts`
**Prior Audit Reference**: `docs/audit-360/01-admin-dashboard.md` (2026-02-23, score 5.5/10)

---

## Executive Summary

The admin panel, configuration system, and monitoring infrastructure represent a **mixed state** of production readiness. Several components are excellent: the health check endpoint is thorough, the reliability library is well-engineered, the RBAC module exists and is functional, and the legal/GDPR settings coverage is strong. However, three critical blockers remain unresolved from the prior audit:

1. **Authentication inconsistency**: The login endpoint and settings API correctly use iron-session, but the notifications endpoints (`/api/admin/notifications/`) still use plain JSON cookie parsing — trivially bypassable.
2. **66 of 69 admin API routes still lack authentication**: Any unauthenticated HTTP client can read customer data, orders, and finances.
3. **Escalation manager calls non-existent endpoints**: `escalation.ts` invokes `/api/internal/send-escalation-email` and `/api/internal/record-escalation` which do not exist, making L3 alerts silently fail.

Additional issues of note: the alert dedup is in-memory (resets on every deployment), translations are read-only from files (no write-back), the rate limiter is in-memory per-process (does not survive restarts), the store configuration is split across hardcoded constants and DB with no single admin UI to manage it all, and the EscalationManager references Slack and PagerDuty integrations that have no corresponding env vars documented in `.env.example`.

**Overall production readiness for this domain: 5/10**. The foundations are sound but the gaps are not cosmetic — they are security blockers that must be resolved before any production traffic carries real customer data.

---

## 1. Admin Authentication and Security

### 1.1 Current State

**Auth mechanism**: iron-session (`iron-session` npm package) with an encrypted, signed, httpOnly cookie named `admin-session`.

**Login flow** (`admin/src/app/api/auth/login/route.ts`):
- Looks up user in `users` table (Supabase, service role).
- Verifies `role === 'admin'`.
- Verifies password via `bcrypt.compare` against `password_hash`.
- Creates an encrypted iron-session cookie (7-day TTL, `secure: true` in production, `sameSite: 'lax'`).
- Resets the rate limit counter on success.

**Rate limiting** (`admin/src/lib/rate-limit.ts`):
- In-memory `RateLimiter` class: 5 attempts per 15 minutes per IP.
- **Gap**: In-memory only. Resets on every server restart and does not work across multiple Docker instances. Under Caddy load balancing with two frontend/admin containers, each instance has its own counter — effective limit becomes 10 attempts per IP.
- **Gap**: Rate limiting is bypassed entirely when `process.env.PLAYWRIGHT_TEST_BASE_URL || process.env.CI` is set (line 30) — ensure these variables are never present in production containers.

**Session configuration** (`admin/src/lib/session.ts`):
```typescript
password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_default_dev_only',
maxAge: 60 * 60 * 24 * 7,  // 7 days
```
- **Gap (CRITICAL)**: The fallback password `'complex_password_at_least_32_characters_long_default_dev_only'` is a known string. Any deployment that forgets to set `SESSION_SECRET` will use this publicly-known key, making all session cookies forgeable.
- **Gap**: No session rotation on privilege change (no logout-all-sessions mechanism).
- **Gap**: 7-day TTL with no absolute expiry or inactivity timeout. A stolen cookie is valid for a full week.

**Middleware** (`admin/src/middleware.ts`):
- Correctly redirects to `/login` if `admin-session` cookie is absent.
- **Critical flaw** (line 7): ALL `/api/` routes are excluded from the middleware check. The comment says "actual session validation happens in API routes", but only 3 of 69 API routes (`products/route.ts`, `products/[id]/route.ts`, `designs/[id]/moderate/route.ts`) use the proper `withPermission` wrapper. The other 66 API routes receive no authentication check.

**Notification routes inconsistency** (`admin/src/app/api/admin/notifications/route.ts` and `mark-all-read/route.ts`):
```typescript
// INSECURE — still uses plain JSON parse of cookie:
function checkAdminAuth(req: NextRequest): boolean {
  const sessionCookie = req.cookies.get('admin-session');
  const sessionData = JSON.parse(sessionCookie.value);  // ← plain JSON, not iron-session
  return sessionData.role === 'admin';
}
```
Iron-session signs and encrypts the cookie. Parsing it as plain JSON will always fail (the value is an opaque encrypted string), meaning this `checkAdminAuth` returns `false` for every request, making notifications silently inaccessible — or, if cookies somehow arrive as legacy plain-JSON (from an older session), it bypasses iron-session entirely.

**RBAC** (`admin/src/lib/rbac.ts`):
- Fully implemented: `withPermission(resource, action, handler)`, `requireAuth(handler)`, `isSuperAdmin(userId)`, `hasPermission(userId, resource, action)`, `getUserPermissions(userId)`.
- Reads from `user_roles` and `admin_roles` tables in Supabase.
- The infrastructure is solid. The gap is adoption: only 3 of 69 routes use it.

**MFA**: None. No TOTP, no backup codes, no WebAuthn.

**Password Reset**: No `/api/auth/forgot-password` route exists in the admin app.

**CSRF Protection**: None. The `sameSite: 'lax'` cookie attribute provides partial protection for top-level navigations (GET requests from external sites won't carry the cookie), but direct POST requests via AJAX/fetch from a malicious page on a different domain will carry the session cookie on modern browsers unless `sameSite: 'strict'` is used or CSRF tokens are implemented.

### 1.2 Gaps

| ID | Gap | Severity | File |
|---|---|---|---|
| A-SEC-1 | 66/69 API routes have no authentication check | CRITICAL | `admin/src/middleware.ts` line 7 |
| A-SEC-2 | `SESSION_SECRET` falls back to a publicly-known hardcoded string | CRITICAL | `admin/src/lib/session.ts` line 39 |
| A-SEC-3 | `notifications/` and `mark-all-read/` use broken plain-JSON cookie auth | CRITICAL | `admin/src/app/api/admin/notifications/` |
| A-SEC-4 | In-memory rate limiter does not survive restarts, not multi-instance | HIGH | `admin/src/lib/rate-limit.ts` |
| A-SEC-5 | No MFA (TOTP) for admin accounts | HIGH | `admin/src/app/login/page.tsx` |
| A-SEC-6 | No password reset flow | HIGH | Missing route |
| A-SEC-7 | Session TTL is 7 days with no inactivity timeout | MEDIUM | `admin/src/lib/session.ts` |
| A-SEC-8 | No CSRF tokens on mutation endpoints | MEDIUM | All POST/PUT/PATCH/DELETE routes |
| A-SEC-9 | Rate limit bypass when `CI` env var is set | MEDIUM | `admin/src/lib/rate-limit.ts` line 30 |
| A-SEC-10 | RBAC infrastructure exists but is only applied to 3 routes | MEDIUM | `admin/src/lib/rbac.ts` |

### 1.3 Priority and Fix

| Gap | Priority | Fix |
|---|---|---|
| A-SEC-1 | P0 | Wrap all 66 routes with `requireAuth()` or `withPermission()` from `admin/src/lib/rbac.ts`. Mechanical 3-hour task. |
| A-SEC-2 | P0 | Remove the fallback string; throw at startup if `SESSION_SECRET` is not set and is not 32+ chars. |
| A-SEC-3 | P0 | Replace `checkAdminAuth()` in notifications routes with `getAdminSession()` from `rbac.ts`. |
| A-SEC-4 | P1 | Replace with Redis-backed rate limiter (`@upstash/ratelimit` or `ioredis` counter with TTL). |
| A-SEC-5 | P2 | Implement TOTP via `otplib`. Add `totp_secret` column to users table. |
| A-SEC-6 | P2 | Add `/api/auth/forgot-password` route (Resend email + time-limited token). |
| A-SEC-7 | P2 | Add absolute expiry check in session validation (e.g., reject sessions older than 24h of inactivity). |
| A-SEC-8 | P2 | Add `X-CSRF-Token` header verification or use double-submit cookie pattern. |
| A-SEC-9 | P1 | Validate that `CI` and `PLAYWRIGHT_TEST_BASE_URL` are never set in production Dockerfile/env. |
| A-SEC-10 | P1 | Systematically apply `withPermission` to write routes; use `requireAuth` for all read routes. |

---

## 2. Admin Dashboard Feature Completeness

### 2.1 Feature Inventory (44 pages in current state)

The prior audit counted 34 pages; the current glob reveals 44 pages total (additional tenant, legal sub-pages, and agent sub-pages confirmed).

| Section | Pages | Feature Status |
|---|---|---|
| **Core Commerce** | orders, orders/[id], products, products/[id], products/new, customers, customers/[email] | Functional |
| **Returns** | returns, returns/[id]/approve, returns/[id]/reject | Functional |
| **Designs** | designs, designs/[id] (with moderation) | Functional |
| **Reviews** | reviews, reviews/[id] | Functional |
| **Analytics** | analytics (RFM + demand), finance | Functional |
| **Agent (PodClaw)** | agent, agent/[id], agent/chat, agent/soul, agent/memory, agent/schedule, agent/errors, agent/metrics | Excellent |
| **SEO** | seo (meta tags + sitemap trigger) | Functional |
| **Branding** | branding (theme editor) | Partial (save not implemented) |
| **Translations** | translations (read-only view) | Partial (no write-back to files) |
| **Legal/GDPR** | legal, legal/[slug], legal/consents, legal/settings | Functional |
| **Configuration** | settings, messaging (Telegram/WhatsApp) | Partial (settings: stub with setTimeout; messaging: test endpoints missing) |
| **Monitoring** | monitoring (error logs with trend chart) | Functional |
| **Content** | blog | Functional |
| **A/B Testing** | ab-tests | Partial (View Results button is a no-op) |
| **Audit Log** | audit | Functional |
| **Tenants** | tenants, tenants/new, tenants/[id] | Present (multi-tenancy scope) |
| **Categories** | categories | Functional |

### 2.2 Feature Completeness Matrix

| Feature | Implemented | Works in Production | Notes |
|---|---|---|---|
| Order list + detail | Yes | Yes | Pagination exists (20/page) |
| Order bulk operations | Yes | Yes | `admin/orders/bulk/route.ts` |
| Printify order retry | Yes | Yes | `admin/orders/[id]/retry/route.ts` |
| Product CRUD | Yes | Partial | Product editor is basic; no rich variant management |
| Product bulk operations | Yes | Yes | |
| Customer list + detail | Yes | Yes | No server-side pagination (risk at scale) |
| Credit adjustment | Yes | Yes | `admin/credits/adjust/route.ts` |
| Returns lifecycle | Yes | Yes | Approve/reject with reason |
| Design moderation | Yes | Yes | Uses `withPermission` |
| Review moderation | Yes | Yes | |
| RFM analytics | Yes | Yes | Processed client-side (no scale) |
| Demand analytics | Yes | Yes | |
| Finance report + export | Yes | Yes | CSV export |
| Analytics CSV export | Yes | Yes | |
| SEO meta tag editor | Yes | Yes | 3 locales (en/es/de) |
| Sitemap trigger | Yes | Yes | Uses Next.js `revalidatePath` |
| Brand config (themes) | Yes | Partial | Save not wired |
| Legal page editor | Yes | Yes | Versioned markdown |
| Legal consent records | Yes | Yes | GDPR |
| Legal entity settings | Yes | Yes | DPO, VAT, retention |
| Messaging config | Yes | Partial | Test endpoints missing |
| Admin settings | Yes | Yes | iron-session protected |
| Notification system | Yes | Broken | Auth check broken (see A-SEC-3) |
| Error monitoring | Yes | Yes | `error_logs` table |
| Audit log | Yes | Yes | |
| A/B tests start/stop | Yes | Yes | |
| A/B tests results | No | No | Button is a no-op |
| Password reset | No | No | Not implemented |
| MFA | No | No | Not implemented |
| Translation write-back | No | No | Read-only from files |
| Branding save | No | No | TODO comment in page |
| Test messaging | No | No | Routes don't exist |

### 2.3 What Is Missing for Production

**P0 (blockers)**:
- Fix notification route auth (A-SEC-3 above).
- Fix 66 unauthenticated API routes (A-SEC-1 above).

**P1 (required before real traffic)**:
- Admin password reset flow.
- Settings page: remove `setTimeout` stub, wire to actual API.
- Branding page: implement save to `/api/admin/brand-config`.
- Test messaging endpoints (`/api/messaging/telegram/test`, `/api/messaging/whatsapp/test`).

**P2 (important)**:
- A/B test results view.
- Translation write-back (currently read-only — admins cannot update translations from the UI).
- Pagination on: customers, designs, reviews, audit log (loads all rows).
- MFA for admin accounts.
- Session pagination in agent view.

---

## 3. Store Configuration

### 3.1 Current State

The store configuration lives in three separate layers with no unified admin UI for all of them:

**Layer 1 — Hardcoded constants** (`frontend/src/lib/store-config.ts`):
```typescript
export const STORE_DEFAULTS = {
  platformName: _brandName,    // from NEXT_PUBLIC_SITE_NAME env var
  currency: 'EUR',             // hardcoded
  freeShippingThreshold: 50,   // hardcoded
  ...
}
export const SHIPPING_RATES = { DE: [...], ES: [...], ... }   // hardcoded
export const PRICING = { premium: { priceCents: 999, ... } }  // hardcoded
```
These values cannot be changed without a code deployment. The free shipping threshold, shipping rates, and subscription pricing require code edits.

**Layer 2 — Database-backed brand config** (`frontend/src/lib/brand-config-server.ts`):
- Reads from `brand_config` table (Supabase), with `is_active = true` filter.
- Caches in Redis (via `setCachedBrandConfig`).
- Falls back to hardcoded `fallbackConfig` if DB is unavailable.
- Fields: `brand_name`, `brand_tagline`, `logo_light_url`, `logo_dark_url`, `seo_titles`, `seo_descriptions`.
- This IS editable via the admin branding API (`/api/admin/brand-config`), but the branding page save is not implemented.

**Layer 3 — Admin settings in DB** (`admin/src/app/api/admin/settings/route.ts`):
- Reads/writes `admin_settings` table, row `id=1`.
- Protected with iron-session correctly.
- Fields: `store_name`, `store_description`, `contact_email`, `support_email`, `currency`, `timezone`.
- Creates an audit log entry on every write.
- **Gap**: Defaults include hardcoded `currency: 'USD'` but the actual store uses EUR. Discrepancy between this and `store-config.ts`.

**Layer 4 — Theme system** (`frontend/src/lib/theme-loader.ts`):
- Dynamic CSS variable injection via `<style>` tag.
- Fetches from `/api/storefront/theme` and `/api/storefront/branding` in parallel.
- Has CSS injection sanitization (`sanitizeValue` strips `<>{};`).
- Loads Google Fonts dynamically based on theme.
- **Gap**: CSS sanitization only strips 4 characters. A more robust allowlist of valid CSS values (colors, font names) would be safer for admin-controlled content.

**Theme management** (`admin/src/app/api/admin/themes/`):
- Full CRUD: list themes, create, update, delete, activate.
- Admin-managed themes stored in DB.
- The theme activation endpoint exists and appears functional.

**Legal settings** (`admin/src/app/(dashboard)/legal/settings/page.tsx`):
- Full form: company name, address, tax ID, DPO name/email, trade register, legal page URLs, data retention periods.
- Properly saves to backend via `adminFetch('/api/admin/legal-settings', { method: 'PUT' })`.
- Client-side validation for required fields and email formats.

### 3.2 Gaps

| ID | Gap | Severity | Notes |
|---|---|---|---|
| C-CFG-1 | Shipping rates are hardcoded in `store-config.ts` — cannot change without deployment | HIGH | Rates for DE, ES, FR, EU, GB, US are static TypeScript constants |
| C-CFG-2 | Free shipping threshold (€50) is hardcoded | HIGH | Same file, line 17 |
| C-CFG-3 | Subscription pricing is hardcoded (`999` cents/month) | HIGH | `PRICING.premium.priceCents` |
| C-CFG-4 | Admin settings page is a stub with `setTimeout` simulation | HIGH | `admin/src/app/(dashboard)/settings/page.tsx` |
| C-CFG-5 | Admin settings defaults have `currency: 'USD'` but store uses EUR | MEDIUM | Inconsistency between settings API default and `store-config.ts` |
| C-CFG-6 | Branding page save not implemented | MEDIUM | `admin/src/app/(dashboard)/branding/page.tsx` TODO comment |
| C-CFG-7 | CSS variable injection sanitization is minimal (strips only 4 chars) | LOW | `theme-loader.ts` line 53 |
| C-CFG-8 | No admin UI to manage shipping countries (`ALLOWED_SHIPPING_COUNTRIES`) | MEDIUM | Hardcoded list in `store-config.ts` |

### 3.3 Priority and Fix

| Gap | Priority | Fix |
|---|---|---|
| C-CFG-1, C-CFG-2, C-CFG-3 | P1 | Move shipping rates, free shipping threshold, and subscription price to `admin_settings` JSONB. Expose in Settings page UI. |
| C-CFG-4 | P1 | Remove `setTimeout` stub. Wire Settings page to the existing `PUT /api/admin/settings` endpoint (already implemented). |
| C-CFG-5 | P1 | Update default `currency` in settings API from `'USD'` to `'EUR'` to match `store-config.ts`. |
| C-CFG-6 | P1 | Wire branding page `handleSave` to `adminFetch('/api/admin/brand-config', { method: 'PUT' })`. |
| C-CFG-7 | P3 | Expand `sanitizeValue` to an allowlist (valid CSS color formats + font name characters). |
| C-CFG-8 | P2 | Add shipping countries management to Settings page; read from `admin_settings`. |

---

## 4. Monitoring and Observability

### 4.1 Current State — Structured Logging

**Logger** (`frontend/src/lib/logger.ts` — referenced by `pod/monitoring.ts`):
- Used by `logInfo`, `logWarn`, `logError` exported from the logger module.
- `pod/monitoring.ts` wraps these for sync lifecycle, margin fix, webhook, and divergence events.
- All log calls include structured key-value fields (provider, productId, durationMs, etc.).
- **Gap**: The underlying logger implementation was not directly audited, but the log format is structured JSON-friendly (consistent with Pino usage referenced in `admin/src/lib/logger.ts`).

**Admin-side logger** (`admin/src/lib/logger.ts`):
- Separate logger for the admin app.

### 4.2 Current State — Error Tracking

**Client-side error monitoring** (`admin/src/app/api/monitoring/errors/route.ts`):
- Reads from `error_logs` table (Supabase), ordered by `count DESC`.
- Supports `limit` and `days` query params.
- Returns trend data (errors per day) by aggregating `first_seen` timestamps.
- Displayed in `admin/src/app/(dashboard)/monitoring/page.tsx` with Recharts bar chart.
- **Gap**: Route has no authentication check — any unauthenticated caller can read error logs (A-SEC-1 applies here too).
- **Gap**: No Sentry or third-party error tracking. Error collection relies entirely on client-side code sending errors to `error_logs` table. If the app crashes before error reporting runs (e.g., React render error), the error may not be captured.

### 4.3 Current State — Health Checks

**Health endpoint** (`frontend/src/app/api/health/route.ts`) is the best-implemented component in this entire audit:
- Checks Supabase (HTTP ping to REST endpoint with 5s timeout).
- Checks Redis (PING command with latency measurement).
- Checks POD provider (Printful/Printify) health via `provider.healthCheck()`.
- Checks Stripe API (`/v1/balance` endpoint with 5s timeout).
- Checks Printful token expiry (warns if < 7 days).
- Checks last sync staleness (warns if `sync-printify` cron hasn't completed in 90 minutes).
- Returns structured `{ status, memory, supabase, redis, pod, stripe }` with per-dependency latency.
- Returns 503 only if Supabase is down; other failures downgrade to `degraded` but still return 200.
- Logs health check results via `logInfo`.
- **Gap**: Health check endpoint is unauthenticated and exposes internal system topology (DB URLs are not in the response, but service connectivity status is). For external uptime monitors this is appropriate. Consider adding `?internal=true` auth check for detailed response.

### 4.4 Current State — Cron Job Monitoring

**CronLockManager** (`frontend/src/lib/reliability/cron-lock.ts`):
- Uses PostgreSQL advisory locks via `try_cron_lock` RPC function.
- Tracks execution in `cron_runs` table with status, duration, error_message.
- Advisory locks auto-release on session end — note that `releaseLock()` is a no-op with a warning comment.
- Well-designed: single-instance guarantee via DB advisory locks.
- **Gap**: `releaseLock()` logs a warning instead of actually releasing the lock. If a cron job crashes mid-execution without the session ending cleanly (e.g., OOM), the advisory lock may persist until the Supabase connection pool times out. There is no explicit `pg_advisory_unlock` implementation.

**Cron runs visible in health check**: The health check reads `cron_runs` to check `sync-printify` staleness — this is good practice.

### 4.5 Current State — Alerting

**Alert endpoint** (`frontend/src/app/api/admin/alert/route.ts`):
- Protected with `requireAdmin` (from `auth-guard`).
- In-memory dedup: 1 alert per type per 5 minutes (using a `Map`).
- **Gap**: `alertDedup` Map is in-memory — resets on deployment. Back-to-back deployments could flood alerts.
- Sends to Telegram if `TELEGRAM_BOT_TOKEN` and `ADMIN_TELEGRAM_CHAT_ID` are configured.
- Writes to `notifications` table for all admin users.
- Called by `pod/monitoring.ts:alertOnSyncError()` when error count >= 5 or failure rate >= 50%.

**EscalationManager** (`frontend/src/lib/reliability/escalation.ts`):
- Three tiers: L1 (console), L2 (console + Slack), L3 (console + Slack + PagerDuty + email).
- Slack notification: calls `SLACK_WEBHOOK_URL` — **not documented in `.env.example`**.
- PagerDuty notification: calls `PAGERDUTY_INTEGRATION_KEY` — **not documented in `.env.example`**.
- Email notification: calls `fetch('/api/internal/send-escalation-email')` — **this endpoint does not exist**.
- Database recording: calls `fetch('/api/internal/record-escalation')` — **this endpoint does not exist**.
- **Critical gap**: For L3 escalations, both email and DB recording will silently fail (404). The escalation will appear successful (`notified: ['console', 'slack', 'pagerduty']`) but no email is sent and no DB record is created.
- `escalate()` catches all errors and always returns `{ success: false }` if something goes wrong — but the missing endpoints fail silently within `notifyEmail` (which returns `false` rather than throwing).

**Telegram admin notifications**: The `ADMIN_TELEGRAM_CHAT_ID` env var controls where alerts go. This is a single flat channel — no routing by severity.

### 4.6 Current State — Reliability Infrastructure

The reliability library is well-engineered and comprehensive:

**RetryManager** (`frontend/src/lib/reliability/retry-manager.ts`):
- Exponential backoff with jitter (±25%).
- Pre-defined strategies: `network`, `rateLimit`, `database`, `externalApi`.
- `withRetryAll` for parallel retries.

**WebhookProcessor** (`frontend/src/lib/reliability/webhook-processor.ts`):
- Idempotent webhook processing via `processed_events` table.
- Uses `INSERT ... ON CONFLICT DO NOTHING` pattern.
- Updates `status_code` on success/failure.

**RefundGuard** (`frontend/src/lib/reliability/refund-guard.ts`):
- Atomic refund via `issue_refund_atomic` PostgreSQL RPC function.
- Two-phase: create Stripe refund → atomically record in DB.
- If DB indicates duplicate, cancels the Stripe refund.

**StateTransitionValidator** (`frontend/src/lib/reliability/state-transition.ts`):
- Transition matrices for orders, products, returns, agent_sessions, users.
- Optimistic locking via `WHERE status = fromState` on UPDATE.
- Idempotency check: if already in target state, returns success.

**DivergenceDetector** (`frontend/src/lib/reliability/divergence-detector.ts`):
- Compares local Supabase products against POD provider catalog.
- Checks: title, description, blueprint_id, print_provider_id, variant title/price/enabled.
- Handles 404 from provider (product deleted remotely).

### 4.7 Gaps

| ID | Gap | Severity | File |
|---|---|---|---|
| M-OBS-1 | `/api/monitoring/errors` has no auth check | CRITICAL | `admin/src/app/api/monitoring/errors/route.ts` |
| M-OBS-2 | L3 escalation emails call non-existent `/api/internal/send-escalation-email` | CRITICAL | `frontend/src/lib/reliability/escalation.ts` line 281 |
| M-OBS-3 | L3 escalation DB recording calls non-existent `/api/internal/record-escalation` | CRITICAL | `frontend/src/lib/reliability/escalation.ts` line 313 |
| M-OBS-4 | `SLACK_WEBHOOK_URL` and `PAGERDUTY_INTEGRATION_KEY` not in `.env.example` | HIGH | `.env.example` |
| M-OBS-5 | Alert dedup Map resets on deployment | HIGH | `frontend/src/app/api/admin/alert/route.ts` line 19 |
| M-OBS-6 | `releaseLock()` is a no-op — advisory locks not explicitly released | MEDIUM | `frontend/src/lib/reliability/cron-lock.ts` line 218 |
| M-OBS-7 | No server-side error tracking (Sentry or equivalent) | MEDIUM | Global |
| M-OBS-8 | Health endpoint exposes service connectivity to unauthenticated callers | LOW | `frontend/src/app/api/health/route.ts` |
| M-OBS-9 | Alert routing is flat (all alerts go to single Telegram chat) | LOW | `frontend/src/app/api/admin/alert/route.ts` |

### 4.8 Priority and Fix

| Gap | Priority | Fix |
|---|---|---|
| M-OBS-1 | P0 | Add `requireAuth`/`requireAdmin` to `monitoring/errors/route.ts`. |
| M-OBS-2, M-OBS-3 | P0 | Create the two missing internal endpoints, or replace with direct Supabase write + Resend call. |
| M-OBS-4 | P1 | Document `SLACK_WEBHOOK_URL` and `PAGERDUTY_INTEGRATION_KEY` in `.env.example` with `[OPTIONAL]` tags. |
| M-OBS-5 | P1 | Replace in-memory `alertDedup` with a Redis key with 5-minute TTL for dedup. |
| M-OBS-6 | P2 | Implement a `pg_advisory_unlock_shared` RPC function and call it in `releaseLock()`. |
| M-OBS-7 | P2 | Add `@sentry/nextjs` to frontend and admin; configure DSN in `.env.example`. |
| M-OBS-8 | P3 | Add an authenticated `/api/health/internal` variant that includes additional diagnostic details. |
| M-OBS-9 | P3 | Add severity-based routing (L3 → separate Telegram chat or PagerDuty when configured). |

---

## 5. Admin Legal Settings

### 5.1 Current State

The legal configuration system is one of the strongest areas:

**Legal entity settings** (`admin/src/app/(dashboard)/legal/settings/page.tsx`):
- Full GDPR-compliant form: company name, address, tax ID/VAT, trade register (court + number), DPO name, DPO email.
- Legal page URL configuration (privacy, terms, cookies).
- Data retention configuration (conversations: 365 days, audit logs: 730 days, marketing events: 180 days).
- Client-side validation for required fields and email formats.
- Saves to backend via `adminFetch('/api/admin/legal-settings', { method: 'PUT' })`.

**Legal pages** (`admin/src/app/api/admin/legal-pages/`):
- Reads from `legal_pages` table.
- Versioned: `/api/admin/legal-pages/[slug]/versions/route.ts` exists.
- Editor in `admin/src/app/(dashboard)/legal/[slug]/page.tsx`.
- **Gap**: Legal pages API GET route has no authentication check (falls under A-SEC-1).

**Legal consent records** (`admin/src/app/(dashboard)/legal/consents/page.tsx`):
- Displays GDPR consent log.
- CSV export available.

**Gap summary for Legal**:
- The feature is functionally complete and GDPR-aware.
- Primary gap is the auth issue inherited from the broader A-SEC-1 problem.
- `legal-pages` GET route is unauthenticated — anyone can read legal page content (low sensitivity), but the write/update routes should also be checked.

---

## 6. SEO Management

### 6.1 Current State

**SEO page** (`admin/src/app/(dashboard)/seo/page.tsx`):
- Three-tab editor for `en/es/de` meta tags (title, description, keywords).
- Fetches from and saves to `/api/admin/seo` route.
- Manual sitemap regeneration trigger via POST to `/api/admin/sitemap`.

**Sitemap API** (`frontend/src/app/api/admin/sitemap/route.ts`):
- `POST`: Calls `revalidatePath` for `/sitemap.xml` and each locale sitemap — triggers Next.js ISR cache invalidation.
- `GET`: Returns sitemap metadata (product count, URLs, last generated timestamp).
- Protected with `requireAdmin` from `auth-guard`.
- **Gap**: `lastGenerated` in the GET response is `new Date().toISOString()` — always returns the current time, not the actual last regeneration time. No timestamp is stored.

**Translations API** (`frontend/src/app/api/admin/translations/route.ts`):
- Read-only: loads translation files from `messages/${locale}.json` via dynamic import.
- Protected with `requireAdmin`.
- **Gap**: Read-only. No write-back. Admins can view but cannot edit translations from the UI.

### 6.2 Gaps

| ID | Gap | Severity | Notes |
|---|---|---|---|
| S-SEO-1 | Sitemap `lastGenerated` always returns current time (misleading) | MEDIUM | Should persist last regen timestamp in DB or cache |
| S-SEO-2 | Translations are read-only — no write-back to `messages/*.json` | MEDIUM | Admins cannot update copy without deployment |
| S-SEO-3 | No structured data (JSON-LD) management in admin | LOW | Product schema.org markup not editable |
| S-SEO-4 | Keyword field in SEO editor (comma-separated string) is not validated | LOW | Meta keywords are ignored by Google; field is vestigial |

---

## 7. Admin Feature Completeness Matrix

| Feature Area | Pages | API Routes | Auth Protected | Working E2E | Production Ready |
|---|---|---|---|---|---|
| Login / Session | login page | auth/login | Yes (iron-session) | Yes | Yes (missing MFA, reset) |
| Order Management | orders, orders/[id] | orders, orders/[id], admin/orders/bulk | Partial (3/66 use withPermission) | Yes | No (auth gap) |
| Product Management | products, products/[id], products/new | products, products/[id], products/bulk | Partial | Yes | No (auth gap) |
| Customer Management | customers | customers, customers/[email]/* | No | Yes | No (auth gap) |
| Design Moderation | designs, designs/[id] | designs, designs/[id]/moderate | Partial (moderate uses withPermission) | Yes | No (auth gap) |
| Returns | returns | returns, returns/[id]/approve,reject | No | Yes | No (auth gap) |
| Reviews | reviews | reviews, reviews/[id] | No | Yes | No (auth gap) |
| Analytics | analytics, finance | analytics/rfm, analytics/demand, finance/* | No | Yes | No (auth gap) |
| PodClaw Agent | agent/* (7 pages) | agent/* (9 routes) | No | Yes | No (auth gap) |
| SEO | seo | admin/seo, admin/sitemap | Partial | Yes | Mostly |
| Branding/Themes | branding | admin/themes/*, admin/brand-config | No | Partial (save not wired) | No |
| Translations | translations | translations/* | Partial | Read-only | No (write missing) |
| Legal Settings | legal/settings | admin/legal-settings | No | Yes | No (auth gap) |
| Legal Pages | legal, legal/[slug], legal/consents | admin/legal-pages/*, admin/legal/consents | No | Yes | No (auth gap) |
| Messaging Config | messaging | messaging/config | No | Partial (test endpoints missing) | No |
| Admin Settings | settings (stub) | admin/settings | Yes (iron-session) | No (stub) | No |
| Notifications | (via TopBar) | admin/notifications | Broken (JSON parse) | No | No |
| Error Monitoring | monitoring | monitoring/errors | No | Yes | No (auth gap) |
| Audit Log | audit | audit | No | Yes | No (auth gap) |
| A/B Tests | ab-tests | ab-tests, ab-tests/[id]/start,stop | No | Partial | No |
| Blog | blog | blog, blog/[id] | No | Yes | No (auth gap) |
| Categories | categories | admin/categories, admin/categories/[id] | No | Yes | No (auth gap) |
| Tenants | tenants, tenants/[id], tenants/new | (pending) | Unknown | Unknown | Unknown |
| Health Check | (no admin page) | health | No (intentional) | Yes | Yes |

---

## 8. Production Monitoring Checklist

### 8.1 Health Checks
- [x] `/api/health` endpoint with Supabase, Redis, POD provider, Stripe checks
- [x] Per-dependency latency measurement
- [x] POD provider token expiry warning (< 7 days)
- [x] Sync staleness detection (> 90 minutes since last `sync-printify`)
- [x] Overall health status: `healthy` / `degraded` / `unhealthy` with appropriate HTTP status codes
- [ ] Uptime monitoring service configured (UptimeRobot, Checkly, or Grafana Cloud)
- [ ] Health check alerting on `unhealthy` status (no webhook or notification configured)
- [ ] `/api/health` not rate-limited (could be DoS'd to trigger cascading failures)

### 8.2 Cron Job Monitoring
- [x] PostgreSQL advisory locks prevent overlapping runs
- [x] `cron_runs` table records all job executions with status, duration, error
- [x] Sync staleness checked in health endpoint
- [ ] Alerting if cron job fails 2+ consecutive times
- [ ] Dashboard showing cron run history and durations
- [ ] `releaseLock()` actually releases the advisory lock

### 8.3 Alerting
- [x] Telegram alerts for sync errors (>= 5 errors or >= 50% failure rate)
- [x] Alert dedup (5-minute window, in-memory)
- [x] Notifications written to DB for all admin users
- [ ] L2 Slack alerts (`SLACK_WEBHOOK_URL` not documented, may not be set)
- [ ] L3 PagerDuty alerts (`PAGERDUTY_INTEGRATION_KEY` not documented, may not be set)
- [ ] L3 email alerts (endpoint `/api/internal/send-escalation-email` does not exist)
- [ ] Alert dedup must survive deployments (needs Redis backend)
- [ ] Severity-based alert routing

### 8.4 Error Tracking
- [x] `error_logs` table stores client-side errors with dedup by hash
- [x] Admin monitoring page with trend chart and top-errors list
- [ ] Server-side error tracking (Sentry or equivalent)
- [ ] Error rate alerting (no threshold-based alerting on error_logs spike)
- [ ] Source maps uploaded for meaningful stack traces

### 8.5 Logging
- [x] Structured logging in `pod/monitoring.ts` (sync, webhooks, divergence, margins)
- [x] Pino-style logger in frontend (`logInfo`, `logWarn`, `logError`)
- [x] Separate logger in admin app
- [ ] Log aggregation service (Loki + Grafana, Datadog, or similar)
- [ ] Log retention policy configured
- [ ] Request ID / correlation ID in all log entries

### 8.6 Database
- [x] Webhook deduplication via `processed_events` table
- [x] Atomic refunds via `issue_refund_atomic` RPC
- [x] State transition validation with optimistic locking
- [x] Divergence detection between local DB and POD provider
- [ ] Database connection pool monitoring
- [ ] Slow query logging threshold configured in Supabase

---

## 9. Final Gaps Table

### Priority Matrix

| ID | Area | Gap | Severity | Effort | Priority |
|---|---|---|---|---|---|
| A-SEC-1 | Auth | 66/69 API routes unauthenticated | CRITICAL | 3h | P0 |
| A-SEC-2 | Auth | SESSION_SECRET fallback to known string | CRITICAL | 30min | P0 |
| A-SEC-3 | Auth | Notifications routes use broken JSON cookie parse | CRITICAL | 1h | P0 |
| M-OBS-2 | Monitoring | L3 escalation email endpoint missing | CRITICAL | 2h | P0 |
| M-OBS-3 | Monitoring | L3 escalation DB record endpoint missing | CRITICAL | 1h | P0 |
| M-OBS-1 | Monitoring | Error monitoring route unauthenticated | CRITICAL | 30min | P0 |
| C-CFG-4 | Config | Settings page is a stub (setTimeout) | HIGH | 2h | P1 |
| C-CFG-1 | Config | Shipping rates hardcoded — cannot change without deployment | HIGH | 4h | P1 |
| C-CFG-2 | Config | Free shipping threshold hardcoded | HIGH | 2h | P1 |
| C-CFG-3 | Config | Subscription pricing hardcoded | HIGH | 2h | P1 |
| C-CFG-6 | Config | Branding save not implemented | HIGH | 1h | P1 |
| A-SEC-4 | Auth | Rate limiter in-memory, not multi-instance | HIGH | 3h | P1 |
| M-OBS-4 | Monitoring | SLACK/PAGERDUTY env vars not in .env.example | HIGH | 30min | P1 |
| M-OBS-5 | Monitoring | Alert dedup Map resets on deployment | HIGH | 2h | P1 |
| A-SEC-5 | Auth | No MFA for admin accounts | HIGH | 8h | P2 |
| A-SEC-6 | Auth | No password reset flow | HIGH | 4h | P2 |
| A-SEC-7 | Auth | 7-day session with no inactivity timeout | MEDIUM | 2h | P2 |
| A-SEC-8 | Auth | No CSRF tokens | MEDIUM | 4h | P2 |
| A-SEC-10 | Auth | RBAC barely adopted (3/69 routes) | MEDIUM | 6h | P1 |
| C-CFG-5 | Config | Settings default currency USD vs store EUR | MEDIUM | 15min | P1 |
| S-SEO-1 | SEO | Sitemap lastGenerated always returns current time | MEDIUM | 1h | P2 |
| S-SEO-2 | SEO | Translations read-only from files | MEDIUM | 6h | P2 |
| M-OBS-6 | Monitoring | releaseLock() is a no-op | MEDIUM | 2h | P2 |
| M-OBS-7 | Monitoring | No Sentry or server-side error tracking | MEDIUM | 4h | P2 |
| A-SEC-9 | Auth | Rate limit bypass via CI env var | MEDIUM | 30min | P1 |
| C-CFG-7 | Config | CSS variable sanitization minimal | LOW | 2h | P3 |
| C-CFG-8 | Config | No admin UI for shipping countries | MEDIUM | 3h | P2 |
| M-OBS-8 | Monitoring | Health endpoint exposes topology unauthenticated | LOW | 1h | P3 |
| M-OBS-9 | Monitoring | Flat alert routing (all severity to same channel) | LOW | 2h | P3 |
| S-SEO-3 | SEO | No JSON-LD management in admin | LOW | 4h | P3 |

### P0 Summary (Must fix before any production traffic)

1. **Add `requireAuth()` to 66 API routes** — 3 hours, entirely mechanical, no logic changes.
2. **Remove `SESSION_SECRET` fallback string** — throw at startup if missing.
3. **Fix notifications routes auth** — replace `JSON.parse(cookie)` with `getAdminSession()`.
4. **Create `/api/internal/send-escalation-email`** — L3 alerts currently silently fail.
5. **Create `/api/internal/record-escalation`** — escalation audit trail is broken.
6. **Add auth to `/api/monitoring/errors`** — error logs include stack traces and user agent data.

### Total Estimated Effort

| Phase | Items | Effort |
|---|---|---|
| P0: Critical blockers | A-SEC-1/2/3, M-OBS-1/2/3 | ~8h |
| P1: Pre-launch required | A-SEC-4/9/10, C-CFG-1/2/3/4/5/6, M-OBS-4/5 | ~22h |
| P2: Important improvements | A-SEC-5/6/7/8, S-SEO-1/2, M-OBS-6/7, C-CFG-8 | ~39h |
| P3: Nice-to-have | C-CFG-7, M-OBS-8/9, S-SEO-3 | ~9h |
| **Total** | | **~78h** |
