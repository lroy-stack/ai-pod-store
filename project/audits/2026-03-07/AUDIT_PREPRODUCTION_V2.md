# Pre-Production Audit V2 -- SKAPARA POD AI Store

**Date**: 2026-03-07
**Auditor**: Claude Opus 4.6 (automated)
**Scope**: Full-stack production readiness -- security, legal, payments, operations, performance, deployment
**Inputs**: 6 domain audits (frontend, admin, database, API, PodClaw, infrastructure) + direct verification
**Previous audit**: AUDIT_PREPRODUCTION.md (same date, 5 blockers identified)
**Fixes applied**: Commit 240fb3b (52 fixes), commit 4e6f403 (PDP redesign)

---

## GO / NO-GO Decision: NO-GO

**Blocker count**: 12

**Rationale**: While significant progress was made (DOMPurify upgraded, session tokens removed from login response body, UNSUBSCRIBE_SECRET hardcoded fallback removed), 12 blockers remain across security, builds, database, and legal. The two most urgent are: (1) frontend build fails on missing `UNSUBSCRIBE_SECRET` env var, making deployment impossible, and (2) admin build fails on jsdom ESM/CJS incompatibility in `/agent/chat` page. Additionally, critical security issues from the API and database audits (unauthenticated file uploads, password hash exposure via RLS, zero storage RLS policies, SQL injection in admin `.or()` queries) must be resolved before launch.

---

## Blockers (MUST fix before launch)

### B01. Frontend build fails -- UNSUBSCRIBE_SECRET env var missing [BUILD]

**Source**: Direct verification (build test)
**File**: `frontend/src/lib/unsubscribe-token.ts:11-12`
**Impact**: `next build` crashes at page data collection for `/api/cron/drip` because `UNSUBSCRIBE_SECRET` (and `NEXTAUTH_SECRET`) are not set. The module-level IIFE throws at import time. Build cannot produce a deployable artifact.
**Fix**: Add `UNSUBSCRIBE_SECRET` to `.env.local`, `.env.example`, and Docker Compose `frontend.environment`. Generate with `openssl rand -hex 32`.

### B02. Admin build fails -- jsdom ESM/CJS incompatibility [BUILD]

**Source**: Direct verification (build test)
**File**: `admin/node_modules/html-encoding-sniffer/lib/html-encoding-sniffer.js` (via jsdom dependency chain)
**Error**: `require() of ES Module @exodus/bytes/encoding-lite.js not supported` -- prerendering `/agent/chat` page fails.
**Impact**: Admin panel cannot be built for production deployment.
**Fix**: Either (a) mark `/agent/chat` as `dynamic = 'force-dynamic'` to skip prerendering, (b) downgrade/replace the `@exodus/bytes` transitive dependency, or (c) add `jsdom` to `serverExternalPackages` in `next.config.ts`.

### B03. Unauthenticated file upload -- /api/reviews/upload-photos [SECURITY/P0]

**Source**: API audit C2
**File**: `frontend/src/app/api/reviews/upload-photos/route.ts`
**Impact**: Zero authentication, zero rate limiting. Anyone can upload up to 3 files (5MB each) to Supabase Storage. Enables storage abuse, malware hosting on trusted domain.
**Fix**: Add `requireAuth` guard and per-user rate limiter. Verify purchase before allowing review photo upload.

### B04. Password hash exposed via RLS SELECT policy [SECURITY/P0]

**Source**: Database audit, Section 2.7
**Table**: `users`
**Impact**: Authenticated users can read their own `password_hash`, `stripe_customer_id`, and `stripe_subscription_id` via the `Users can view own profile` SELECT policy (which uses `auth.uid() = id` without column restriction).
**Fix**: `REVOKE SELECT (password_hash) ON users FROM authenticated, anon;` or create a safe view excluding sensitive columns.

### B05. Zero RLS policies on storage buckets [SECURITY/P0]

**Source**: Database audit, Section 8.2
**Buckets**: `designs` (no mime/size limits), `product-images`
**Impact**: Anyone can upload, overwrite, or delete files in both buckets. The `designs` bucket accepts any file type with no size limit.
**Fix**: Add storage RLS policies restricting uploads to authenticated users (designs) and service_role (product-images). Set mime type and size limits on `designs` bucket.

### B06. SQL injection via `.or()` in admin search routes [SECURITY/P0]

**Source**: API audit C1
**Files**:
- `admin/src/app/api/orders/route.ts:42`
- `admin/src/app/api/search/route.ts:21,28,35`
- `admin/src/app/api/products/route.ts:25`
- `admin/src/app/api/designs/route.ts:46`
**Impact**: Authenticated admin user input is interpolated directly into PostgREST `.or()` filter strings without sanitization. An admin could craft search input containing PostgREST operators to modify query logic.
**Fix**: Import and use `sanitizeForLike`/`sanitizeForPostgrest` from `@/lib/query-sanitizer` (already exists in frontend codebase).

### B07. Anon access to error_logs table [SECURITY/P0]

**Source**: Database audit, Section 2.5
**Table**: `error_logs`
**Impact**: Anonymous users can SELECT all error logs (information disclosure -- stack traces, table names) AND INSERT fake error entries (log injection / DoS).
**Fix**: `DROP POLICY "anon_can_select_errors" ON error_logs; DROP POLICY "anon_can_insert_errors" ON error_logs;`

### B08. Password reset bypasses auth verification [SECURITY/P0]

**Source**: API audit C3
**File**: `frontend/src/app/api/auth/reset-password/route.ts`
**Impact**: Uses `supabaseAdmin.auth.updateUser()` with the admin service key instead of the user's access token. The client-provided `accessToken` is never validated. No rate limiting.
**Fix**: Create a user-scoped Supabase client using the access token and call `updateUser` through it. Add rate limiting.

### B09. Unprotected Prometheus metrics endpoint [SECURITY/P0]

**Source**: API audit C5
**File**: `frontend/src/app/api/metrics/route.ts`
**Impact**: Exposes memory usage, heap stats, uptime, and service version to unauthenticated users. Aids attacker profiling.
**Fix**: Add `verifyCronSecret` guard or restrict to internal network.

### B10. Unauthenticated admin endpoints [SECURITY/P0]

**Source**: API audit C6, C7; Admin audit 2.3
**Files**:
- `admin/src/app/api/admin/legal-settings/route.ts:19` (GET -- exposes company name, address, tax ID, DPO email)
- `admin/src/app/api/admin/brand-config/route.ts` (GET -- exposes full brand config including surcharge settings)
- `frontend/src/app/api/newsletter/drip-sequence-docs/route.ts` (GET -- exposes internal drip campaign config)
**Fix**: Wrap each with `withAuth` or `requireAdmin`.

### B11. Legal settings contain placeholder data [LEGAL/P0]

**Source**: Pre-production audit V1, B4
**Location**: DB `legal_settings` table
**Current values**: Company name = "Updated PodClaw Store", DPO = "Jane Smith", Address = "456 Technology Drive, Silicon Valley, CA 94025, USA", Trade register = "HRB 123456", Email = `legal@podclaw.store`
**Impact**: EU Impressum and privacy policy display fake company data. Legal non-compliance.
**Fix**: Update all fields to real SKAPARA legal entity data.

### B12. PodClaw bridge authentication disabled [SECURITY/P0]

**Source**: PodClaw audit C-01
**File**: `podclaw/.env:29-30`
**Impact**: `PODCLAW_BRIDGE_AUTH_TOKEN=` (empty) and `PODCLAW_BRIDGE_AUTH_ENABLED=false`. Anyone reaching port 8000 can run agents, access memory/soul, modify schedules, and push events.
**Fix**: Generate token with `openssl rand -hex 32`, set `PODCLAW_BRIDGE_AUTH_ENABLED=true`.

---

## OWASP Top 10 Matrix

| # | Category | Status | Source | Notes |
|---|---|---|---|---|
| A01 | Broken Access Control | FAIL | API, DB, Admin audits | Unauthenticated endpoints (B03, B09, B10), storage buckets without RLS (B05), error_logs anon access (B07), admin routes missing RBAC granularity |
| A02 | Cryptographic Failures | WARN | Frontend, Infra audits | UNSUBSCRIBE_SECRET not in .env.example (B01). HTTPS enforced via Caddy. bcrypt cost 12 for admin. No secret rotation docs. |
| A03 | Injection | FAIL | API audit | SQL injection via PostgREST `.or()` in 4 admin routes (B06). Frontend uses sanitizers correctly. XSS mitigated via DOMPurify 3.3.2 + CSP. |
| A04 | Insecure Design | PASS | Architecture | Multi-tenancy via tenant_id + RLS. Chat isolation via user_id FK. Agent sandboxing via SandboxSettings. |
| A05 | Security Misconfiguration | FAIL | DB, PodClaw audits | password_hash exposed (B04), bridge auth disabled (B12), Grafana "admin" password fallback, 14 tables with RLS but 0 policies |
| A06 | Vulnerable Components | WARN | npm audit | Frontend: 1 critical, 4 high (canvas/fabric chain). Admin: 2 high, 2 moderate. DOMPurify upgraded to 3.3.2 (FIXED). |
| A07 | Authentication Failures | WARN | API audit | Password reset bypasses auth (B08). Admin change-password has no rate limiting. No MFA for admin. Brute force protection on login is present. |
| A08 | Data Integrity Failures | PASS | API audit | Stripe webhook signature verification. Lockfile pinning. Idempotency on checkout (stripe_session_id unique). |
| A09 | Logging & Monitoring | WARN | Infra audit | Prometheus + Grafana + Loki configured but Grafana cannot reach Loki (network misconfiguration). No alerting rules active. PII in some console.log statements. |
| A10 | SSRF | PASS | Frontend audit | Image proxy has domain allowlist. No open URL fetching from user input. |

---

## GDPR Compliance

| Requirement | Status | Notes |
|---|---|---|
| Privacy Policy | PASS | `/privacy` page, DB-backed with i18n (EN/ES/DE) |
| Cookie Consent Banner | PASS | `CookieConsent` component with accept/reject/customize. Non-essential cookies blocked until consent. |
| Cookie Settings (revocable) | PASS | `CookieSettingsButton` component. Consent recorded in `user_consents` table with IP + timestamp. |
| Data Export (Right of Access) | PASS | `GET /api/profile/export` -- ZIP with profile, orders, conversations, designs, wishlists, personalizations, notifications, addresses, credit transactions. Rate-limited 1/24h. |
| Account Deletion (Right to Erasure) | PASS | `POST /api/profile/delete` -- 30-day grace period soft delete. Hard delete via `cron/hard-delete-accounts`. Cancel deletion available. |
| Consent Tracking | PASS | `user_consents` table with audit trail (consent_type, granted, timestamp, IP, user_agent). |
| Data Retention Policy | PASS | Privacy policy states: account data until deletion, orders 7 years (tax), analytics 24 months. |
| DPO Contact | BLOCKER | "Jane Smith" / `privacy@podclaw.store` -- placeholder, not real (see B11) |

---

## GPSR Compliance (EU Product Safety Regulation 2023/988)

| Requirement | Status | Notes |
|---|---|---|
| Safety Information | PASS | 27/27 active products have `product_details.safety_information` |
| Material Composition | PASS | 27/27 products have `product_details.material` |
| Care Instructions | PASS | 27/27 products have `product_details.care_instructions` |
| Manufacturing Country | PASS | 27/27 products have `product_details.manufacturing_country` |
| Manufacturer Info | PASS | Embedded in safety_information field |
| PDP Display | PASS | `ProductDetailClient.tsx` renders safety info, materials, care instructions in product detail tabs |

---

## Should Fix (first week post-blocker resolution)

| # | Domain | Severity | Issue | Source |
|---|---|---|---|---|
| S01 | Security | P1 | Admin change-password has no rate limiting -- brute force vector | Admin audit 1.4 |
| S02 | Security | P1 | Frontend npm audit: 1 critical (basic-ftp via fabric/canvas chain), 4 high (tar path traversal) | Frontend audit F-2 |
| S03 | Security | P1 | Duplicate SSE connections in admin (SSEProvider + NotificationsContext both create EventSource) | Admin audit 7.1 |
| S04 | Security | P1 | Webhook endpoints missing signature verification: Telegram, WhatsApp, cache-invalidate | API audit H3 |
| S05 | Security | P1 | store_themes RLS allows any authenticated user to INSERT/DELETE themes | DB audit 2.5 |
| S06 | Security | P1 | Missing FK indexes on order_items.product_id and order_items.variant_id (slow JOINs) | DB audit 3.1 |
| S07 | Security | P1 | No CHECK >= 0 on 31 price/money columns -- negative prices possible | DB audit 4.5 |
| S08 | Security | P1 | Checkout create-session lacks rate limiting (Stripe session spam) | API audit H2 |
| S09 | Legal | P1 | EU 14-day withdrawal/cancellation right not explicitly stated in returns policy | Pre-prod V1 H2 |
| S10 | Legal | P1 | No explicit "incl. VAT" label on customer-facing prices (EU requirement) | Pre-prod V1 H6 |
| S11 | Security | P1 | 2 tables with RLS disabled (design_clipart, design_templates_library) | DB audit 2.1 |
| S12 | Security | P1 | 14 non-partition tables with RLS enabled but 0 policies (admin_roles, documents, user_roles, etc.) | DB audit 2.2 |
| S13 | Operations | P1 | No backup strategy for Docker volumes (redis-data, podclaw-data, caddy-data) | Infra audit F04 |
| S14 | Operations | P1 | Grafana cannot reach Loki -- no shared network between them | Infra audit F01 |
| S15 | Security | P1 | Error message leaks in ~12 API routes return raw Supabase/Stripe error.message to clients | API audit H1 |
| S16 | Security | P1 | Profile routes use inconsistent auth pattern (7 routes bypass centralized requireAuth) | Frontend audit F-1 |
| S17 | Security | P1 | Live API credentials in podclaw/.env on disk (Supabase, Stripe, Printful, Gemini, fal.ai, Resend) | PodClaw audit C-02 |

---

## Nice to Have (backlog)

| # | Domain | Severity | Issue | Source |
|---|---|---|---|---|
| N01 | Security | P2 | Only 12/143 frontend API routes use Zod validation; only 11/55 admin write handlers | Frontend FO-1, Admin 3.1 |
| N02 | Security | P2 | Missing routes in middleware protection: /settings, /designs, /referrals | Frontend B-2 |
| N03 | Security | P2 | In-memory rate limiting only (no Redis-backed shared state for multi-instance) | Frontend S-2 |
| N04 | Security | P2 | Admin error.tsx renders error.message in production (information disclosure) | Admin 3.3 |
| N05 | Security | P2 | Admin withAuth routes that should use withPermission (sitemap, SEO, agent soul, tenant create) | Admin 2.5 |
| N06 | Security | P2 | Weak frontend password policy (minimum 6 chars, no complexity) | Frontend F-3 |
| N07 | Security | P2 | Orders API uses service key instead of user-scoped client (bypasses RLS) | Frontend B-1 |
| N08 | Security | P2 | Redis AUTH not configured in PodClaw defaults | PodClaw W-03 |
| N09 | Security | P2 | PodClaw autoAllowBashIfSandboxed=True (defense-in-depth concern) | PodClaw W-01 |
| N10 | Security | P2 | PodClaw bridge localhost exemption could be exploited via SSRF | PodClaw W-02 |
| N11 | Security | P2 | Grafana admin password fallback to "admin" in compose | Infra W02 |
| N12 | Security | P2 | No secret rotation documentation | Infra W09, PodClaw W-04 |
| N13 | Operations | P2 | PodClaw Dockerfile not multi-stage (build artifacts in runtime image) | Infra W05 |
| N14 | Operations | P2 | start.sh health check depends on python3 (may not be on minimal VPS) | Infra F03 |
| N15 | Operations | P2 | No Caddy-level rate limiting (all rate limiting delegated to app layer) | Infra audit |
| N16 | Performance | P2 | Dynamic product sitemaps missing (only static locale-specific sitemaps) | Frontend SE-1 |
| N17 | Performance | P2 | Checkout N+1 queries (products, variants, compositions fetched sequentially) | Pre-prod V1 M7 |
| N18 | Database | P2 | 9 tables with user_id but no FK to users table | DB audit 4.2 |
| N19 | Database | P2 | Nullable user_id on orders, cart_items, conversations (weakened RLS) | DB audit 4.3 |
| N20 | Database | P2 | 17 tables with updated_at column but no auto-update trigger | DB audit 7.3 |
| N21 | Database | P2 | Test data inserted via migrations instead of seeds | DB audit 5.3 |
| N22 | Admin | P2 | Only 7/55 admin mutation routes have explicit audit logging (logCreate/logUpdate/logDelete) | Admin 4.2 |
| N23 | Operations | P2 | No Sentry or equivalent real-time error alerting | Pre-prod V1 5.1 |
| N24 | Operations | P2 | No documented rollback or restore procedure | Pre-prod V1 5.5 |
| N25 | Security | P2 | SUPABASE_ANON_KEY (non-NEXT_PUBLIC prefix) used in 3 API routes -- undefined if only public var set | Frontend DEP-1 |
| N26 | Security | P2 | admin-session cookie maxAge is 7 days (long-lived admin session) | Pre-prod V1 M8 |
| N27 | Admin | P3 | 27 prohibited color tokens across 7 admin files | Admin 6.2 |
| N28 | Admin | P3 | 11 dashboard pages still use raw useEffect+fetch instead of React Query | Admin 8.2 |
| N29 | Admin | P3 | 14 TypeScript errors in admin test files | Admin 9.2 |
| N30 | Frontend | P3 | Only 8 loading.tsx files for ~20+ routes | Frontend P-1 |
| N31 | Frontend | P3 | Skip-to-content link only on landing layout, missing from (app) and (focused) | Frontend X-2 |
| N32 | Database | P3 | 30+ unused indexes (negligible cost at current scale) | DB audit 3.2 |
| N33 | Database | P3 | Test functions in production DB (test_partition_pruning, test_try_cron_lock_behavior) | DB audit 6.3 |
| N34 | Security | P3 | No MFA for admin accounts | Admin 1.6 |
| N35 | Operations | P3 | No CD pipeline (deployment is manual via start.sh) | Infra 11 |
| N36 | Operations | P3 | No Dependabot/Renovate for automated dependency updates | Infra 11 |
| N37 | Performance | P3 | 5 font families bundled (Inter, Lato, Montserrat, Oswald, Playfair Display) | Pre-prod V1 M4 |

---

## Domain Audit Summary

| Audit | Date | CRITICAL | FAIL | WARN | PASS |
|---|---|---|---|---|---|
| Frontend | 2026-03-07 | 1 | 3 | 14 | 56 |
| Admin | 2026-03-07 | 2 | 5 | 14 | 27 |
| Database | 2026-03-07 | 4 | 0 | 4 | 3 |
| API | 2026-03-07 | 7 | 16 | 36 | 142 |
| PodClaw | 2026-03-07 | 2 | 1 | 7 | 48 |
| Infrastructure | 2026-03-07 | 1 | 4 | 9 | 48 |
| **Totals** | | **17** | **29** | **84** | **324** |

---

## Fixes Verified Since V1

The following items from the first pre-production audit (or prior audits) have been confirmed as resolved:

| V1 ID | Issue | Status | Evidence |
|---|---|---|---|
| V1-B2 | UNSUBSCRIBE_SECRET hardcoded fallback to 'default-secret-change-me' | FIXED | `unsubscribe-token.ts:11-12` now throws if env var missing (no fallback) |
| V1-B3 | DOMPurify v3.3.1 XSS vulnerability | FIXED | `dompurify@3.3.2` installed (verified in node_modules) |
| V1-C1 | Session tokens (access_token, refresh_token) exposed in login response body | FIXED | `login/route.ts:97-109` returns only `user`, `success`, `expires_at` -- no tokens in body |
| -- | Raw `<img>` tags in components | FIXED | Zero raw `<img>` tags found; all use `next/image` |
| -- | `dangerouslySetInnerHTML` without sanitization | FIXED | SafeHTML + SafeMarkdown components with DOMPurify in use |

---

## Pending from V1 (Not Yet Resolved)

| V1 ID | Issue | Status |
|---|---|---|
| V1-B1 | 3 admin accounts with default passwords (must_change_password=true) | UNVERIFIED (requires DB query) |
| V1-B4 | Legal settings placeholder data | STILL OPEN (B11 above) |
| V1-B5 | 35 tables with RLS enabled but 0 policies | STILL OPEN (B05 storage + S12 above) |

---

## Payment / Financial Readiness

| Item | Status | Notes |
|---|---|---|
| Stripe webhook signature verification | PASS | `constructEvent()` with HMAC |
| Checkout idempotency | PASS | `stripe_session_id` uniqueness check |
| Server-side price authority | PASS | DB prices override client prices in checkout |
| Atomic refund guard | PASS | `issue_refund_atomic()` DB function |
| Chargeback handling | PASS | Dispute handler cancels order, alerts admin |
| Credit system | PASS | Atomic `add_credits` RPC, no race conditions |
| Subscription lifecycle | PASS | created/updated/deleted handlers update user tier |
| Currency | PASS | EUR throughout |
| Price rounding | PASS | All prices in cents (integer), divided at display |
| Coupon validation | PASS | Server-side in checkout route |
| VAT labeling | FAIL | No "incl. VAT" indication on customer-facing prices (S10) |

---

## Deployment Readiness

| Item | Status | Notes |
|---|---|---|
| Frontend build | FAIL | Crashes on missing UNSUBSCRIBE_SECRET (B01) |
| Admin build | FAIL | jsdom ESM/CJS incompatibility (B02) |
| Docker multi-stage builds | PASS | Frontend + Admin: 3-stage, non-root. MCP: 2-stage. |
| cap_drop: ALL | PASS | All 11 services |
| Health checks | PASS | All services have Docker health checks |
| Resource limits | PASS | Memory + CPU limits on all services |
| Log rotation | PASS | json-file, 10MB x 3 per service |
| Network segmentation | WARN | Grafana/Loki network issue (S14) |
| start.sh orchestration | PASS | Multi-phase startup with validation |
| TLS/HTTPS | PASS | Caddy auto-HTTPS via Let's Encrypt |
| Security headers | PASS | Full suite in Caddy + Next.js |

---

## Critical Path to GO Decision

To move from NO-GO to GO, resolve these 12 blockers in priority order:

### Phase 1: Build Fixes (unblocks deployment testing)
1. **B01**: Add `UNSUBSCRIBE_SECRET` env var everywhere
2. **B02**: Fix admin jsdom ESM issue (`serverExternalPackages` or `force-dynamic`)

### Phase 2: Critical Security (unblocks any public exposure)
3. **B03**: Auth on `/api/reviews/upload-photos`
4. **B04**: Revoke SELECT on `users.password_hash`
5. **B05**: Storage bucket RLS policies + designs mime/size limits
6. **B06**: Sanitize admin `.or()` queries
7. **B07**: Remove anon error_logs policies
8. **B08**: Fix password reset to use user-scoped client
9. **B09**: Auth on `/api/metrics`
10. **B10**: Auth on 3 unauthenticated admin/internal endpoints
11. **B12**: Enable PodClaw bridge authentication

### Phase 3: Legal (unblocks public launch)
12. **B11**: Replace all placeholder legal entity data

**Estimated effort**: 4-6 hours for all 12 blockers. All are configuration or targeted code changes, not architectural.

---

*Generated: 2026-03-07 | Auditor: Claude Opus 4.6 | Scope: 6 domain audits + direct build verification | Inputs: 454 total checks across all domains*
