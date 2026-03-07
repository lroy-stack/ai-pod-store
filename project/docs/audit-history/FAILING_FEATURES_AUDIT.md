# Failing Features Audit Report
## POD AI Store — Feature List Analysis
**Generated:** 2026-02-24
**Total Features:** 335
**Passing:** 119 (35.5%)
**Failing:** 216 (64.5%)

---

## Executive Summary

The feature list contains 335 features across 22 sections. Only 35.5% are currently passing. The codebase is in early-to-mid development stage, with 8 completely unstarted sections (0% pass rate) and significant gaps in:

- **Multi-tenant infrastructure** (Section 11 — 0% complete, 25 features)
- **Advanced personalization** (Section 15 — 0% complete, 15 features)
- **Design studio system** (Section 16 — 0% complete, 28 features)
- **Advanced checkout features** (Section 18 — 0% complete, 15 features)
- **Seasonal/promotional features** (Sections 19-22 — 0% complete, 30 features)

---

## Statistics by Section

| Section | Features | Passing | Failing | Pass Rate | Status |
|---------|----------|---------|---------|-----------|--------|
| Section 0 - Reliability | 25 | 13 | 12 | 52% | PARTIAL |
| Section 1 - Security | 22 | 12 | 10 | 55% | PARTIAL |
| Section 2 - Admin UI | 17 | 11 | 6 | 65% | PARTIAL |
| Section 3 - Database | 11 | 5 | 6 | 45% | PARTIAL |
| Section 4 - Frontend SEO/Pages | 29 | 19 | 10 | 66% | PARTIAL |
| Section 5 - Categories | 16 | 9 | 7 | 56% | PARTIAL |
| Section 6 - PodClaw | 16 | 7 | 9 | 44% | PARTIAL |
| Section 7 - MCP Server | 11 | 5 | 6 | 45% | PARTIAL |
| Section 8 - Testing/CI | 11 | 4 | 7 | 36% | PARTIAL |
| Section 9 - Observability | 11 | 3 | 8 | 27% | PARTIAL |
| Section 10 - Marketing | 20 | 8 | 12 | 40% | PARTIAL |
| **Section 11 - Multi-Tenant** | **25** | **0** | **25** | **0%** | **UNSTARTED** |
| Section 12 - Documentation | 8 | 3 | 5 | 38% | PARTIAL |
| Section 13 - Fulfillment | 20 | 10 | 10 | 50% | PARTIAL |
| Section 14 - Branding | 15 | 10 | 5 | 67% | PARTIAL |
| **Section 15 - Personalization** | **15** | **0** | **15** | **0%** | **UNSTARTED** |
| **Section 16 - Design Studio** | **28** | **0** | **28** | **0%** | **UNSTARTED** |
| **Section 18 - Advanced Checkout** | **15** | **0** | **15** | **0%** | **UNSTARTED** |
| **Section 19 - Social/Trending** | **7** | **0** | **7** | **0%** | **UNSTARTED** |
| **Section 20 - Affiliates** | **3** | **0** | **3** | **0%** | **UNSTARTED** |
| **Section 21 - Popup Campaigns** | **5** | **0** | **5** | **0%** | **UNSTARTED** |
| **Section 22 - Seasonal Themes** | **5** | **0** | **5** | **0%** | **UNSTARTED** |
| **TOTALS** | **335** | **119** | **216** | **35.5%** | — |

---

## Completely Unstarted Sections (0% Pass Rate)

Eight sections have not been started at all:

### Section 11 — Multi-Tenant Infrastructure (25 features)
**Severity:** CRITICAL — Foundation feature blocking all other multi-tenant work
**Key gaps:**
- Tenants table and tenant_id column on all 64 tables (IDs 76-82, 228-243)
- RLS policies with tenant_id dimension
- Custom domain resolution and Caddy on-demand TLS
- Per-tenant Stripe Connect billing
- Per-tenant Printify shop mapping
- Tenant creation wizard (5 steps)
- Plan feature gates (Free/Starter/Pro)
- Cross-tenant data isolation verification

### Section 15 — Personalization System (15 features)
**Severity:** HIGH — Core product feature
**Key gaps:**
- Personizations table integration (IDs 244-258)
- Text personalization with fonts, colors, alignment
- Image upload with rembg background removal
- Safe zone visualization
- Contrast warnings
- Consistent font sizing across preview modes
- Surcharge persistence in database
- 12+ font library with script/handwriting fonts
- Color swatch grid with custom hex input
- Production DPI proportional sizing
- Personalization history UI

### Section 16 — Design Studio System (28 features)
**Severity:** CRITICAL — Major feature system (AI design + composition)
**Key gaps:**
- Database tables: design_sessions, ai_generations, user_design_assets, design_compositions (IDs 259-263)
- RLS policies on all design tables
- AI design orchestrator module
- POST /api/designs/ai-generate endpoint
- Design refinement endpoint
- 8 style presets library
- Cost guard for AI operations
- DesignStudio UI components (desktop/mobile)
- AIPromptEditor, StyleSelector, AIPreviewCanvas
- Design history API and panel
- Server-side composition renderer
- Production export for Printify
- Chat tools for AI design integration (2 tools)
- DesignContext shared state

### Section 18 — Advanced Checkout Features (15 features)
**Severity:** MEDIUM — Enhanced checkout UX
**Key gaps:**
- Trust badges strip on checkout
- Coupon persistence via sessionStorage (ID 288)
- Compare-at-price and StrikethroughPrice (ID 290)
- Product labels with ProductBadge component (ID 291)
- Cross-sell in cart (ID 293)
- SmartStickyCTA mobile (2 versions) (IDs 294, 304)
- RecentlyViewed carousel (ID 295)
- Exit-intent warning modal (ID 296)
- Mobile search in header (ID 298)
- Product labels API (ID 319)

### Section 19 — Social Proof & Trending (7 features)
**Severity:** MEDIUM — Conversion optimization
**Key gaps:**
- trending_products materialized view (ID 299)
- Social proof toast + scarcity indicator (ID 300)
- Free shipping progress bar (ID 301)
- Product bundles system (ID 302)
- Admin labels/bundles dashboards (IDs 303, 318)

### Section 20 — Affiliate Products (3 features)
**Severity:** LOW — Secondary revenue stream
**Key gaps:**
- affiliate_products table with tracking
- AffiliateBlock component with EU compliance
- Admin affiliate CRUD + analytics

### Section 21 — Popup Campaigns (5 features)
**Severity:** LOW — Marketing automation
**Key gaps:**
- popup_campaigns table with display types
- PopupManager provider with max 1 per session enforcement
- 4 popup display types (Modal, SlideIn, Banner, Contextual)
- Exit-intent detection hook
- Admin campaign CRUD + analytics

### Section 22 — Seasonal Themes (5 features)
**Severity:** LOW — Cosmetic/seasonal features
**Key gaps:**
- seasonal_themes table with 5 pre-seeded themes
- useSeasonalTheme hook + SeasonalBanner
- Seasonal animations (CSS/Canvas, <16ms)
- SeasonalCSSOverrides with temporary variable injection
- Admin seasonal themes management with calendar view

---

## Critical Gaps in Partially-Complete Sections

### Section 0 — Reliability (52% complete, 12 failing)
**RED FLAGS:**
- **ID 119:** Agent singleton via Redis SET NX — essential for PodClaw concurrency control
- **ID 120:** Audit completeness — withAuth() auto-logging missing
- **ID 121:** PII boundary enforcement — [DATA] markers not implemented
- **ID 122:** Fail-closed security pattern — needs systematic security audit
- **ID 123-127:** Order/Product/Return state machines — StateTransitionValidator not comprehensive
- **ID 125-127:** ZombieReaper cron — incomplete zombie state detection logic
- **ID 128-129:** PodClaw reliability modules — escalation.py and retry.py missing
- **ID 130:** Cron runs table — not all 10 crons record executions

**Impact:** Without these, reliability and observability are compromised.

---

### Section 1 — Security (55% complete, 10 failing)
**RED FLAGS:**
- **ID 118:** Admin MFA (TOTP) — missing completely
- **ID 131:** Admin middleware protecting /api/* — may have incorrect exclusions
- **ID 132:** Admin password 12-char minimum — validation missing
- **ID 133-135:** RLS policies — incomplete coverage (user-scoped, messaging, service_role-only tables)
- **ID 136:** Content Security Policy headers — not in admin/next.config.ts
- **ID 137:** Forged admin cookie rejection — iron-session validation may be incomplete
- **ID 138:** withValidation Zod wrapper — top 10 mutations not validated
- **ID 139:** Newsletter PII protection via RLS — missing

**Impact:** Security posture is incomplete. Multiple auth/validation gaps.

---

### Section 3 — Database (45% complete, 6 failing)
**RED FLAGS:**
- **ID 146:** Auth FK constraint — orphaned user records possible
- **ID 147:** Auth reconciliation script — no migration to sync auth.users ↔ public.users
- **ID 148:** Individual compound indexes — 11 indexes not verified (EXPLAIN analysis needed)
- **ID 149:** Seed data separation — test data in production migrations
- **ID 150:** pgvector HNSW index — tuning parameters missing, may use slower IVFFlat
- **ID 151:** Table partitioning — no auto-create cron for future partitions

**Impact:** Database performance and data consistency at risk.

---

### Section 6 — PodClaw (44% complete, 9 failing)
**RED FLAGS:**
- **ID 115:** Event queue in Redis — using in-memory queue (lost on restart)
- **ID 175:** Disabled agents persistence — not in Redis
- **ID 176:** Task status tracking — GET /task/{id} not implemented
- **ID 177:** Custom Prometheus metrics — incomplete custom metrics
- **ID 178:** Health endpoint — missing Redis connectivity check
- **ID 179:** Admin cost dashboard — not fully functional
- **ID 180-182:** Test files missing (production_governor, chat_session, soul_evolution)

**Impact:** No way to track async agent runs; metrics incomplete; restart loses state.

---

### Section 8 — Testing/CI (36% complete, 7 failing)
**RED FLAGS:**
- **ID 152-154:** CI pipeline stages — lint, unit tests, integration, Docker build not in GitHub Actions
- **ID 155:** Branch protection — not enforcing CI pass before merge
- **ID 156-158:** Test files — Frontend Vitest, Playwright E2E specs missing

**Impact:** No automated testing gates; risky deployments.

---

### Section 9 — Observability (27% complete, 8 failing)
**RED FLAGS:**
- **ID 203-210:** Prometheus/Grafana/Loki/cAdvisor services missing from docker-compose
- **ID 207-208:** /api/metrics endpoints missing on frontend and admin
- **ID 209:** Observability RAM budget — unknown if <768MB
- **ID 210:** Grafana alert rules — not configured

**Impact:** No visibility into production system behavior.

---

### Section 10 — Marketing (40% complete, 12 failing)
**RED FLAGS:**
- **ID 211-222:** Newsletter/reviews/abandoned cart/blog/drip system incomplete
- **ID 213:** Trust signals fetching — not implemented
- **ID 214:** Reviews using mockUserId — not real auth.uid()
- **ID 217-218:** Abandoned cart table missing; cron not implemented
- **ID 219:** Blog table + admin editor missing

**Impact:** Marketing and customer engagement features partially broken.

---

### Section 12 — Documentation (38% complete, 5 failing)
**RED FLAGS:**
- **ID 223:** 6 specific ADRs — not written
- **ID 224:** FastAPI /docs — may not be accessible
- **ID 225:** Deployment runbook — missing
- **ID 226-227:** Database ERD + table descriptions — missing

**Impact:** Team lacks reference documentation for architectural decisions and database schema.

---

### Section 13 — Fulfillment (50% complete, 10 failing)
**RED FLAGS:**
- **ID 93:** Return lifecycle flow — incomplete implementation
- **ID 189-191:** Printify webhook handlers — delivery notifications, multiple shipments, order:updated/order:failed missing
- **ID 192:** Retry-After header parsing — not implemented
- **ID 193:** Cart product availability re-validation — missing
- **ID 194-197:** Audit logging, admin approval queue, test coverage — incomplete

**Impact:** Return flow broken; Printify webhook incomplete; no test coverage.

---

## Recommendations by Priority

### P0 — Foundation (Must fix before any launches)
1. **Section 11** — Multi-tenant infrastructure (25 features) — BLOCKER for multiple-tenant support
2. **Section 1 (ID 131-132)** — Admin API middleware + password validation
3. **Section 1 (ID 118)** — Admin MFA implementation
4. **Section 0 (ID 119-122)** — Redis locks, audit logging, PII boundaries, fail-closed patterns

### P1 — Core Features (Needed for MVP)
5. **Section 15** — Personalization system (15 features) — core product feature
6. **Section 8** — CI/CD pipeline with tests
7. **Section 3** — Database indexes and partitioning
8. **Section 6** — PodClaw reliability modules (escalation, retry, task tracking)

### P2 — Enhanced Features (Improve UX/Operations)
9. **Section 9** — Observability (Prometheus/Grafana/Loki stack)
10. **Section 16** — Design studio (AI design generation) — 28 features
11. **Section 13 (ID 189-197)** — Advanced fulfillment (returns, webhooks, tests)

### P3 — Nice-to-Have (Marketing/Growth)
12. **Section 18-22** — Checkout enhancements, affiliates, campaigns, seasonal themes (73 features)

---

## Red Flags & Pattern Analysis

### Database Query Issues (None explicitly detected)
The failing features do not explicitly mention:
- ❌ `.eq('category', ...)` without JOIN
- ❌ `createClient` with anon key in Server Components
- ❌ Selecting `variants` from products table
But given 45% failure rate on database features, these should be audited.

### Vague/Unclear Requirements
Several features have unclear or incomplete step definitions:
- ID 239 (Tenant wizard) — "Stripe Connect OAuth requires manual human intervention"
- ID 116-117 (Multi-tenant migration) — scope of "all 64 tables" needs clarification
- ID 125-127 (ZombieReaper) — complex detection logic needs detailed spec

### Implementation Blockers
- **Section 11** blocks all multi-tenant features; should be parallelized with shared schema design
- **Section 16** requires multiple new database tables and API endpoints; could start with basic AI design
- **Section 18** depends on completed Section 5 (categories) and Section 10 (cart)

---

## File Paths Mentioned in Failing Features

### Missing Frontend Files
```
frontend/src/app/api/cron/zombie-reaper/route.ts
frontend/src/lib/reliability/state-transition.ts (partial)
frontend/src/lib/reliability/retry-manager.ts (partial)
frontend/src/lib/reliability/escalation.ts
frontend/src/lib/brand-config-server.ts
frontend/src/lib/push-notifications.ts (needs VAPID_SUBJECT update)
frontend/src/components/products/PersonalizerComponent.tsx
frontend/src/components/products/DesignStudio.tsx
frontend/src/components/products/AIPromptEditor.tsx
frontend/src/app/api/designs/ai-generate/route.ts
frontend/src/app/api/designs/compose/route.ts
frontend/src/app/api/portals/route.ts
```

### Missing Admin Files
```
admin/src/middleware.ts (may have gaps)
admin/src/lib/validation.ts (incomplete)
admin/src/lib/auth-middleware.ts (incomplete)
admin/src/app/(dashboard)/error.tsx or admin/src/app/error.tsx
admin/src/hooks/queries/useProducts.ts (may be incomplete)
admin/src/hooks/mutations/ (likely missing)
admin/src/components/Sidebar.tsx (needs 5 nav groups)
```

### Missing PodClaw Files
```
podclaw/reliability/escalation.py
podclaw/reliability/retry.py
podclaw/reliability/state-transition.ts (frontend only)
podclaw/tests/test_production_governor.py
podclaw/tests/test_chat_session.py
podclaw/tests/test_soul_evolution.py
podclaw/redis_store.py (partial)
```

### Missing MCP Files
```
mcp-server/src/middleware/rate-limit.ts (incomplete)
mcp-server/vitest.config.ts
mcp-server/tests/oauth-flow.test.ts
mcp-server/tests/tools/*.test.ts
```

### Missing Documentation
```
docs/adr/ADR-0001.md through ADR-0006.md
docs/runbooks/deployment.md
docs/database-erd.md (or .svg)
docs/ONBOARDING.md
```

---

## Estimated Implementation Effort

| Section | Complexity | Dev Days | Status |
|---------|------------|----------|--------|
| Section 11 (Multi-tenant) | CRITICAL | 40-60 | Unstarted |
| Section 15 (Personalization) | HIGH | 30-40 | Unstarted |
| Section 16 (Design Studio) | CRITICAL | 50-70 | Unstarted |
| Section 18 (Checkout) | MEDIUM | 15-20 | Unstarted |
| Section 0 (Reliability) | HIGH | 20-30 | 52% done |
| Section 1 (Security) | HIGH | 15-25 | 55% done |
| Sections 19-22 (Growth) | LOW | 25-35 | Unstarted |

**Total estimated:** 200-315 dev days to reach 100% feature completion.

---

## Conclusion

The codebase is in a viable but incomplete state. **35.5% of features are implemented**, with solid progress on:
- Frontend SEO/pages (66%)
- Admin UI (65%)
- Branding (67%)
- Security basics (55%)

However, **critical gaps exist** in:
- **Multi-tenant infrastructure** — completely unstarted, foundational
- **Personalization & Design Studio** — core product features, 43 features combined
- **Testing & CI/CD** — 36% complete, risky for deployments
- **Observability** — 27% complete, no production visibility

**The team should prioritize:**
1. **Sections 1, 0** (Security + Reliability foundations)
2. **Section 11** (Multi-tenant support)
3. **Section 15** (Personalization)
4. **Section 8** (CI/CD pipeline)
5. **Section 16** (Design Studio)

This would unlock 40-50% more features and establish a solid foundation for the remaining marketing/growth features.
