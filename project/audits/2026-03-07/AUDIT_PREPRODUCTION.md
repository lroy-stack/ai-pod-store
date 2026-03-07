# Pre-Production Readiness Audit — SKAPARA POD AI Store

**Date**: 2026-03-07
**Auditor**: Claude Opus 4.6 (automated)
**Scope**: Full-stack production readiness across security, legal, payments, operations, performance, deployment

---

## GO / NO-GO Decision: NO-GO

**Rationale**: 5 blockers identified that must be resolved before production launch. The most critical are: (1) all 3 admin accounts retain default passwords with `must_change_password=true`, (2) the `UNSUBSCRIBE_SECRET` falls back to a hardcoded `'default-secret-change-me'` string, (3) the DOMPurify dependency has a known XSS vulnerability (v3.1.3-3.3.1), (4) legal settings contain placeholder company data ("Updated PodClaw Store", "Jane Smith"), and (5) 35 tables have RLS enabled but zero policies, making them completely inaccessible via anon/authenticated roles (silent data loss risk). Once these 5 blockers are resolved, the system is well-architected for launch.

---

## 1. SECURITY READINESS

### 1.1 Authentication Flow

| Component | Mechanism | Status | Notes |
|---|---|---|---|
| Frontend (storefront) | Supabase Auth (JWT via `sb-access-token` cookie) | PASS | Middleware validates JWT via `supabase.auth.getUser()` for protected routes (`/profile`, `/orders`, `/wishlist`) |
| Admin panel | iron-session (encrypted cookie) + bcrypt password hashing (cost 12) | PASS | Rate-limited login (IP-based), `must_change_password` enforcement, RBAC via `withPermission()` |
| API routes (frontend) | Token extracted from `sb-access-token` cookie, validated server-side | PASS | `requireAuth()` / `getAuthUser()` guards on sensitive endpoints |
| API routes (admin) | `getAdminSession()` / `withPermission()` / `withAuth()` on all 94 routes | PASS | All admin API routes verified to have auth checks |
| Cron endpoints | `CRON_SECRET` bearer token comparison | PASS | Timing-safe comparison used |
| Webhook endpoints | Stripe signature verification (`constructEvent`), Printify HMAC, Printful token match, Telegram secret header | PASS | All webhook routes verify signatures |

### 1.2 RLS Coverage

| Category | Count | Status | Notes |
|---|---|---|---|
| Tables with RLS enabled | 97/99 | WARN | 2 tables (`design_clipart`, `design_templates_library`) have RLS disabled |
| Tables with RLS + policies | 64 | PASS | Core user-facing tables have proper policies |
| Tables with RLS + 0 policies | 35 | BLOCKER | These tables are effectively locked out for anon/auth roles. While this prevents data leakage, it also means silent query failures if any frontend code queries them directly. Partition tables (agent_events_y*, audit_log_y*, messages_y*) account for 21 of these. |
| Tables without RLS | 2 | WARN | `design_clipart`, `design_templates_library` - read-only catalog data, low risk |

### 1.3 CSRF Protection

- CSRF token generated in middleware, validated on all non-GET API requests
- Exempt: webhooks, admin routes (own auth), cron routes
- **Status**: PASS

### 1.4 Security Headers

All headers configured in `next.config.ts` and Caddy:

| Header | Value | Status |
|---|---|---|
| Content-Security-Policy | `strict-dynamic` for scripts, allowlisted img/connect sources, `frame-ancestors 'none'` | PASS |
| X-Content-Type-Options | `nosniff` | PASS |
| X-Frame-Options | `DENY` | PASS |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | PASS |
| Referrer-Policy | `strict-origin-when-cross-origin` | PASS |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | PASS |
| Server header | Removed (`-Server` in Caddy) | PASS |

### 1.5 Secret Management

| Item | Status | Notes |
|---|---|---|
| `.env.example` with `[REQUIRED]`/`[OPTIONAL]` tags | PASS | Clear documentation |
| No hardcoded secrets in source | WARN | `UNSUBSCRIBE_SECRET` fallback is `'default-secret-change-me'` in `src/lib/unsubscribe-token.ts:10` |
| Dockerfile secret handling | PASS | `SUPABASE_SERVICE_KEY` injected via BuildKit `--mount=type=secret` (never in image layers) |
| `.env` gitignored | PASS | |
| Secret rotation documentation | FAIL | No runbook for rotating secrets |

### 1.6 XSS Prevention

| Vector | Status | Notes |
|---|---|---|
| react-markdown | PASS | All usage through `SafeMarkdown` component with DOMPurify sanitization |
| `dangerouslySetInnerHTML` | PASS | Only used for JSON-LD structured data (developer-controlled) |
| `<img>` tags | PASS | All images use `next/image` (0 raw `<img>` tags found) |
| DOMPurify version | BLOCKER | v3.3.1 has known XSS vulnerability (GHSA-v2wj-7wpq-c8vv). Must upgrade. |
| SafeHTML component | PASS | Dedicated sanitization component exists |

### 1.7 SSRF Prevention

- Image proxy (`/api/proxy-image`) has domain allowlist: only `files.cdn.printful.com` and `files.cdn.printify.com`
- URL validation before fetch
- **Status**: PASS

---

## 2. OWASP Top 10 Matrix

| # | Category | Status | Source | Notes |
|---|---|---|---|---|
| A01 | Broken Access Control | WARN | RLS audit | 35 tables with RLS but 0 policies (partition tables mostly). Core tables protected. |
| A02 | Cryptographic Failures | WARN | Secret audit | `UNSUBSCRIBE_SECRET` hardcoded fallback. HTTPS enforced via Caddy. bcrypt cost 12 for admin passwords. |
| A03 | Injection | PASS | Code audit | All DB queries via Supabase client (parameterized). XSS mitigated via DOMPurify + CSP. |
| A04 | Insecure Design | PASS | Architecture | Multi-tenancy via `x-tenant-id` header from middleware. Chat isolation via `user_id` FK. Agent sandboxing via `SandboxSettings`. |
| A05 | Security Misconfiguration | BLOCKER | DB audit | 3 admin accounts with default passwords still active (`must_change_password=true`). |
| A06 | Vulnerable Components | WARN | npm audit | Frontend: 1 critical, 4 high, 3 moderate. Admin: 0 critical, 2 high, 2 moderate. DOMPurify XSS is most concerning. |
| A07 | Authentication Failures | PASS | Auth audit | Brute force protection on admin login (IP-based rate limiter). JWT validation on all protected routes. No MFA (noted as nice-to-have). |
| A08 | Data Integrity Failures | PASS | Webhook audit | Stripe webhook signature verification. Lockfile pinning. Idempotency on checkout webhook (stripe_session_id unique check). |
| A09 | Logging & Monitoring | PASS | Infra audit | Pino structured JSON logger. Error reporting to `error_logs` table with dedup. Prometheus + Grafana + Loki stack available. |
| A10 | SSRF | PASS | Code audit | Image proxy has domain allowlist. No open URL fetching from user input. |

---

## 3. LEGAL / COMPLIANCE

### 3.1 GDPR Compliance

| Requirement | Status | Notes |
|---|---|---|
| Privacy Policy | PASS | `/privacy` page, DB-backed with i18n (EN/ES/DE), 690 chars EN |
| Cookie Consent Banner | PASS | `CookieConsent` component with accept all/reject all/customize. Non-essential cookies blocked until consent. |
| Cookie Settings (revocable) | PASS | `CookieSettingsButton` component. Consent recorded in `user_consents` table with IP + timestamp. |
| Data Export (Right of Access) | PASS | `GET /api/profile/export` - ZIP file with profile, orders, conversations, designs, wishlists, personalizations, notifications, addresses, credit transactions. Rate-limited to 1/24h. |
| Account Deletion (Right to Erasure) | PASS | `POST /api/profile/delete` - 30-day grace period soft delete with `deletion_requested_at`. Hard delete via `cron/hard-delete-accounts`. Cancel deletion available. |
| Consent Tracking | PASS | `user_consents` table with audit trail (consent_type, granted, timestamp, IP, user_agent). API at `/api/consent`. |
| Data Retention Policy | PASS | Privacy policy states: account data until deletion, orders 7 years (tax), analytics 24 months. |
| DPO Contact | WARN | Listed as "Jane Smith" / `privacy@podclaw.store` - placeholder data not updated for SKAPARA |

### 3.2 EU Consumer Protection

| Requirement | Status | Notes |
|---|---|---|
| Returns Policy | PASS | `/returns` page: 30-day window, defective/wrong/damaged eligible. Non-returnable custom items. |
| Terms of Service | PASS | `/terms` page with i18n |
| Shipping Policy | PASS | `/shipping` page with i18n |
| Imprint (Impressum) | PASS | `/legal` page - required for EU |
| Price Transparency | PASS | Server-side price authority in checkout (DB prices override client prices). Currency in EUR. |
| Cancellation Rights | WARN | 14-day withdrawal right (EU Directive 2011/83/EU) not explicitly stated in returns policy. Returns policy says 30 days but only for defective items. |

### 3.3 GPSR Compliance (EU Product Safety)

| Requirement | Status | Notes |
|---|---|---|
| Safety Information | PASS | 27/27 active products have `product_details.safety_information` |
| Material Composition | PASS | 27/27 products have `product_details.material` |
| Care Instructions | PASS | 27/27 products have `product_details.care_instructions` |
| Manufacturing Country | PASS | 27/27 products have `product_details.manufacturing_country` |
| Manufacturer Info | PASS | Embedded in safety_information field |

### 3.4 Legal Settings

| Item | Status | Notes |
|---|---|---|
| Company Name | BLOCKER | Set to "Updated PodClaw Store" - must be updated to SKAPARA legal entity |
| Company Email | WARN | `legal@podclaw.store` - must be updated to SKAPARA domain |
| DPO Name | WARN | "Jane Smith" - placeholder, must be real person |
| Company Address | WARN | "456 Technology Drive, Silicon Valley, CA 94025, USA" - must be real EU address |
| Trade Register | WARN | "HRB 123456" - placeholder |

---

## 4. PAYMENT / FINANCIAL

### 4.1 Stripe Integration

| Item | Status | Notes |
|---|---|---|
| Webhook Signature Verification | PASS | `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` |
| Idempotency (order creation) | PASS | Checks `stripe_session_id` uniqueness before creating order |
| Idempotency (credit purchase) | PASS | UNIQUE(user_id, stripe_payment_id) constraint prevents double-crediting |
| Error Handling | PASS | Non-throwing handlers (don't cause Stripe retry loops). POD failures marked for retry. |
| Server-side Price Authority | PASS | Checkout route overrides client prices with DB variant prices |
| Chargeback Handling | PASS | `charge.dispute.created` handler cancels order, alerts admin, creates audit log |
| Payment Failure Handling | PASS | `invoice.payment_failed` updates status to `past_due`, emails customer, alerts admin |

### 4.2 Price Accuracy

| Item | Status | Notes |
|---|---|---|
| Currency | PASS | EUR throughout (store default) |
| Rounding | PASS | All prices in cents (integer), divided at display time |
| VAT Display | WARN | No explicit VAT/IVA breakdown shown to customer (EU requires VAT-inclusive prices to be labeled) |
| Coupon Validation | PASS | Server-side validation in checkout route (active, min purchase, usage limit) |

### 4.3 Subscription System

| Item | Status | Notes |
|---|---|---|
| Tier Enforcement | PASS | `subscription.created/updated/deleted` handlers update user tier |
| Credit System | PASS | Atomic balance updates via `add_credits` RPC function (no race conditions) |
| Subscription Cancellation | PASS | Sets tier to `free`, status to `cancelled` |
| Bonus Credits | PASS | 10 monthly credits on activation |

### 4.4 Refund Flow

| Item | Status | Notes |
|---|---|---|
| Atomic Refund Guard | PASS | `issue_refund_atomic()` DB function prevents double refunds |
| Return Request Flow | PASS | Customer initiates return, admin approves/rejects, receive/refund flow |
| Stripe Refund | PASS | Via `refund-guard.ts` with automatic Stripe refund cancellation if DB rejects |

---

## 5. OPERATIONAL READINESS

### 5.1 Error Monitoring

| Item | Status | Notes |
|---|---|---|
| Error Boundaries | PASS | Error boundaries at all route group levels: `[locale]/error.tsx`, `(app)/error.tsx`, `(focused)/error.tsx`, `(landing)/error.tsx` |
| Client Error Reporting | PASS | `POST /api/errors/report` stores errors in `error_logs` table with dedup (SHA-256 hash) |
| ErrorBoundary Component | PASS | Custom `ErrorBoundary.tsx` component |
| Sentry Integration | FAIL | No Sentry configured. Error monitoring relies on `error_logs` table + console.error. No real-time alerting for errors. |

### 5.2 Health Checks

| Item | Status | Notes |
|---|---|---|
| Frontend Health | PASS | `GET /api/health` checks Supabase, Redis, POD provider, Stripe with latency measurements |
| Overall Status Logic | PASS | Supabase down = unhealthy (503). Others = degraded (200). |
| Token Expiry Monitoring | PASS | Health endpoint checks Printful OAuth token expiry, warns at <7 days |
| Sync Staleness | PASS | Health endpoint flags if last sync >90 minutes ago |
| Admin Health | PASS | `/api/health` in admin panel |

### 5.3 Monitoring Stack

| Item | Status | Notes |
|---|---|---|
| Prometheus | PASS | Configured in docker-compose, metrics endpoint at `/api/metrics` |
| Grafana | PASS | Dashboards, default password in `.env.example` flagged as change-me |
| Loki (Log Aggregation) | PASS | Configured for log collection |
| Alerting | WARN | No alerting rules configured in Prometheus/Grafana. Admin Telegram notifications exist for POD failures and chargebacks. |

### 5.4 Logging

| Item | Status | Notes |
|---|---|---|
| Structured Logging | PASS | Pino with JSON output in production, pino-pretty in development |
| PII in Logs | WARN | `console.log` statements include customer email in some webhook handlers (Stripe). Should use structured logger with PII redaction. |
| Log Rotation | PASS | Docker json-file driver with 10MB x 3 files per service |
| Audit Log | PASS | `audit_log` table with partitioning. Webhook actions logged. |

### 5.5 Backup & Recovery

| Item | Status | Notes |
|---|---|---|
| Database Backup | PASS | Supabase Cloud handles automated backups |
| Backup Verification | FAIL | No documented restore procedure or regular restore testing |
| Rollback Procedure | FAIL | No documented rollback procedure for deployments |
| Runbook | FAIL | No operations runbook for common failures |

### 5.6 DNS / SSL

| Item | Status | Notes |
|---|---|---|
| TLS Configuration | PASS | Caddy auto-HTTPS via Let's Encrypt. On-demand TLS for custom tenant domains with verification endpoint. |
| HSTS | PASS | `max-age=31536000; includeSubDomains` |
| Rate Limiting (TLS) | PASS | Caddy on-demand TLS: max 5 new certs per 2-minute interval |

---

## 6. PERFORMANCE

### 6.1 Core Web Vitals Concerns

| Item | Status | Notes |
|---|---|---|
| Image Optimization | PASS | All images via `next/image` with automatic optimization. CDN domains configured (`files.cdn.printful.com`, `pfy-prod-image-storage.s3.amazonaws.com`). |
| Font Loading | WARN | 5 @fontsource packages installed (Inter, Lato, Montserrat, Oswald, Playfair Display). All local, no external font requests, but bundle impact of 5 font families is significant. |
| Bundle Analyzer | PASS | `@next/bundle-analyzer` configured |
| Compression | PASS | Caddy: zstd + gzip compression |

### 6.2 Database Performance

| Item | Status | Notes |
|---|---|---|
| Index Coverage | PASS | 395+ indexes across 99 tables. Extensive coverage. |
| Table Partitioning | PASS | `agent_events`, `audit_log`, `messages` partitioned by month |
| Query Patterns | PASS | All queries via Supabase client (parameterized, typed). No raw SQL from frontend. |
| N+1 Queries | WARN | Checkout route fetches products, then variants, then compositions sequentially. Could be optimized with joins but not a blocker at current scale. |

### 6.3 CDN Readiness

| Item | Status | Notes |
|---|---|---|
| Static Assets | PASS | Next.js standalone build with `_next/static` served by Caddy |
| External CDN | WARN | No Cloudflare or dedicated CDN in front of Caddy. Recommended for production. |
| Image CDN | PASS | Product images served from Printful/Printify CDN |

---

## 7. DEPLOYMENT

### 7.1 Docker Infrastructure

| Item | Status | Notes |
|---|---|---|
| Multi-stage Dockerfile | PASS | deps -> builder -> runner stages. Non-root user (`nextjs:1001`). |
| Security Hardening | PASS | `cap_drop: ALL` on all services. Selective `cap_add`. No `env_file:`. |
| Orchestration Script | PASS | `start.sh` with --local/--prod/--down/--build/--clean/--status modes |
| Health Checks | PASS | All services have Docker health checks |
| Resource Limits | PASS | Memory limits configured via `deploy.resources.limits.memory` |
| Secret Injection | PASS | BuildKit secrets for build-time sensitive vars |

---

## Blocker Issues (MUST fix before launch)

| # | Domain | Issue | File/Location | Fix |
|---|---|---|---|---|
| B1 | Security | 3 admin accounts with default passwords (`must_change_password=true`) | DB: `users` table | Login to admin panel and change all 3 passwords. Or reset via DB migration. |
| B2 | Security | `UNSUBSCRIBE_SECRET` falls back to hardcoded `'default-secret-change-me'` | `frontend/src/lib/unsubscribe-token.ts:10` | Add `UNSUBSCRIBE_SECRET` to `.env.local` and `.env.example`. Generate with `openssl rand -hex 32`. |
| B3 | Security | DOMPurify v3.3.1 has known XSS vulnerability | `package.json` / npm audit | Run `npm audit fix` to upgrade DOMPurify to >=3.3.2 |
| B4 | Legal | Legal settings contain placeholder data (company name, DPO, address, trade register) | DB: `legal_settings` table | Update all fields to real SKAPARA legal entity data. This affects all legal pages via `{{placeholder}}` substitution. |
| B5 | Database | 35 tables with RLS enabled but 0 policies | DB: partition tables + `admin_roles`, `user_roles`, `documents`, etc. | Add appropriate read/write policies. For admin-only tables: `USING (false)` default deny + service role access. For partitions: inherit parent policies or add explicit ones. |

---

## High Priority (fix within first week)

| # | Domain | Issue | Fix |
|---|---|---|---|
| H1 | Security | npm audit: 1 critical (basic-ftp path traversal via fabric), 4 high (minimatch ReDoS, tar path traversal) | Run `npm audit fix --force` and test. The critical `basic-ftp` is via fabric -> jsdom chain. |
| H2 | Legal | EU 14-day withdrawal/cancellation right not explicitly stated in returns policy | Update returns policy in `legal_pages` table to include mandatory 14-day EU withdrawal right per Directive 2011/83/EU |
| H3 | Legal | Company email/DPO in legal settings points to podclaw.store domain | Update to skapara.com domain |
| H4 | Operations | No Sentry or real-time error alerting | Integrate Sentry or configure Prometheus alerting rules for error rate thresholds |
| H5 | Operations | PII (customer email) logged in console.log statements in Stripe webhook handler | Replace `console.log`/`console.error` with structured logger (`logInfo`/`logError`) and redact email addresses |
| H6 | Payments | No explicit VAT/IVA label on prices (EU requires "incl. VAT" indication) | Add "incl. VAT" text next to prices in `ProductCard`, `ProductDetailClient`, checkout |
| H7 | Security | 2 tables without RLS (`design_clipart`, `design_templates_library`) | Enable RLS and add public read policy |
| H8 | Operations | No documented backup restore procedure, rollback procedure, or operations runbook | Create `docs/OPERATIONS_RUNBOOK.md` |

---

## Medium Priority (fix within first month)

| # | Domain | Issue | Fix |
|---|---|---|---|
| M1 | Security | No MFA for admin accounts | Implement TOTP-based MFA for admin login |
| M2 | Security | Secret rotation not documented | Create secret rotation runbook with schedule |
| M3 | Performance | No CDN (Cloudflare) in front of Caddy | Deploy Cloudflare or similar CDN for edge caching and DDoS protection |
| M4 | Performance | 5 font families bundled (Inter, Lato, Montserrat, Oswald, Playfair Display) | Audit which fonts are actually used; remove unused ones |
| M5 | Operations | No alerting rules in Prometheus/Grafana | Configure alerts for: error rate >1%, 5xx responses, health check failures, disk usage |
| M6 | Operations | Admin npm audit: 2 high, 2 moderate vulnerabilities | Run `npm audit fix` in admin directory |
| M7 | Performance | Checkout N+1 queries (products, variants, compositions fetched sequentially) | Optimize with parallel queries or joins |
| M8 | Security | `admin-session` cookie maxAge is 7 days (long-lived admin session) | Consider reducing to 8h or implementing sliding window |

---

## 8. Production Launch Checklist

### Pre-Launch (Blockers)

- [ ] **B1**: Change all 3 admin default passwords
- [ ] **B2**: Set `UNSUBSCRIBE_SECRET` env var (generate with `openssl rand -hex 32`)
- [ ] **B3**: Upgrade DOMPurify to >=3.3.2 (`npm audit fix`)
- [ ] **B4**: Update `legal_settings` with real SKAPARA company data (name, address, DPO, email, trade register)
- [ ] **B5**: Add RLS policies to 35 tables missing them (or verify they are only accessed via service role)

### Pre-Launch (Strongly Recommended)

- [ ] **H1**: Run `npm audit fix` to resolve critical/high vulnerabilities
- [ ] **H2**: Add EU 14-day withdrawal right to returns policy
- [ ] **H6**: Add "incl. VAT" labels on all customer-facing prices
- [ ] Set `DOMAIN` env var to production domain
- [ ] Verify Stripe webhook endpoint is configured for production domain
- [ ] Verify Caddy TLS certificate issuance works
- [ ] Test full checkout flow end-to-end in production environment
- [ ] Verify email delivery (Resend) from production domain
- [ ] Test POD order submission to Printful in production

### Infrastructure

- [x] Docker multi-stage build with non-root user
- [x] `cap_drop: ALL` security hardening
- [x] `start.sh` orchestration script with multi-phase startup
- [x] Health checks on all services
- [x] Log rotation configured (10MB x 3)
- [x] Redis command restriction (FLUSHALL/DEBUG/CONFIG blocked)
- [x] BuildKit secrets for sensitive build args
- [ ] CDN (Cloudflare) in front of Caddy
- [ ] Monitoring alerting rules configured
- [ ] Backup restore procedure tested

### Security

- [x] CSRF protection on all mutation API routes
- [x] CSP with `strict-dynamic` for scripts
- [x] HSTS with 1-year max-age
- [x] Webhook signature verification (Stripe, POD, Telegram)
- [x] Rate limiting on auth endpoints
- [x] Iron-session encrypted admin cookies
- [x] Supabase JWT validation in middleware
- [x] SSRF prevention (domain allowlist on image proxy)
- [x] DOMPurify on all user-generated markdown
- [ ] MFA for admin accounts
- [ ] Secret rotation runbook

### Legal / Compliance

- [x] Privacy policy with i18n (EN/ES/DE)
- [x] Terms of service
- [x] Returns policy
- [x] Shipping policy
- [x] Imprint (Impressum)
- [x] Cookie consent banner with granular controls
- [x] Consent tracking in database
- [x] GDPR data export
- [x] GDPR account deletion (30-day grace period)
- [x] GPSR: All 27 products have safety info, material, care instructions, manufacturing country
- [ ] EU 14-day withdrawal right in returns policy
- [ ] VAT-inclusive price labeling
- [ ] Real company data in legal settings

### Payments

- [x] Stripe webhook idempotency
- [x] Server-side price authority
- [x] Atomic refund guard (no double refunds)
- [x] Chargeback handling
- [x] Payment failure email + admin notification
- [x] Coupon server-side validation
- [x] POD order retry mechanism

### Monitoring

- [x] Health endpoint with dependency checks + latency
- [x] Structured JSON logging (Pino)
- [x] Error deduplication in `error_logs` table
- [x] Audit log with partitioning
- [x] Prometheus + Grafana + Loki stack
- [ ] Sentry or equivalent real-time error tracking
- [ ] Alerting rules configured
- [ ] Operations runbook

---

## Domain Audit Summary

| Domain | BLOCKER | FAIL | WARN | PASS |
|---|---|---|---|---|
| Security (Auth, RLS, Headers, XSS) | 2 | 1 | 3 | 12 |
| Legal / GDPR / GPSR | 1 | 0 | 5 | 10 |
| Payments / Financial | 0 | 0 | 1 | 10 |
| Operations (Monitoring, Logging, Backup) | 0 | 3 | 2 | 8 |
| Performance | 0 | 0 | 3 | 5 |
| Deployment / Infrastructure | 0 | 0 | 0 | 7 |
| **TOTAL** | **3** | **4** | **14** | **52** |

*Note: B4 (legal settings placeholder) and B5 (RLS zero-policy tables) are classified under Legal and Security respectively in the breakdown above. Some items overlap categories.*

---

**Bottom line**: The architecture is solid -- Supabase Auth + iron-session, CSRF protection, CSP `strict-dynamic`, webhook verification, atomic refund guards, GPSR compliance, GDPR data export/deletion, structured logging, and Docker security hardening are all in place. The 5 blockers are all configuration/data issues (not architectural) and can be resolved in 1-2 hours of focused work. After fixing blockers B1-B5 and addressing high-priority items H1-H2-H6, the system is ready for production launch.
