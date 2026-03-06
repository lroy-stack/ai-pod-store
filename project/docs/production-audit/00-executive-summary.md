# Production Audit — Executive Summary

**Date**: 2026-03-06
**Scope**: Frontend + Admin + Database + Integrations (PodClaw excluded)
**Auditors**: 7 parallel agents covering all domains

---

## Overall Production Readiness: ~55%

| Domain | Score | Report |
|---|---|---|
| Purchase/Payment/Returns | 72% | [01-purchase-payment-returns.md](./01-purchase-payment-returns.md) |
| Printful + Stripe Config | 60% | [02-printful-stripe-config.md](./02-printful-stripe-config.md) |
| Legal / GDPR / i18n | 87% | [03-legal-compliance-i18n.md](./03-legal-compliance-i18n.md) |
| Admin / Config / Monitoring | 50% | [04-admin-config-monitoring.md](./04-admin-config-monitoring.md) |
| Database / Performance | 72% | [05-database-performance.md](./05-database-performance.md) |
| Multi-tenancy / Users / Auth | 42% | [06-multitenancy-users-auth.md](./06-multitenancy-users-auth.md) |
| Frontend UX / Perf / SEO | 65% | [07-frontend-ux-performance-seo.md](./07-frontend-ux-performance-seo.md) |

---

## P0 Blockers — Must Fix Before ANY Production Traffic

### Security (CRITICAL — data breach risk)

| # | Issue | Domain | Impact |
|---|---|---|---|
| S1 | **66/69 admin API routes have NO authentication** — middleware excludes `/api/` | Admin | Full data access to anyone |
| S2 | **`SESSION_SECRET` falls back to hardcoded public string** | Admin | Session forgery trivial |
| S3 | **`POST /api/admin/setup-rbac` has no auth** — anyone can create super_admin | Auth | Complete system takeover |
| S4 | **`admin-session` cookie is plain JSON, no signature** | Auth | Cookie forgery trivial |
| S5 | **`/api/monitoring/errors` has no auth** — stack traces publicly readable | Admin | Information disclosure |
| S6 | **`user_usage` RLS policy is `USING (true)`** — all rows readable by anon | Database | User data leak |
| S7 | **`ab_events` + `analytics_events` open INSERT** — anonymous flood | Database | Data contamination + DoS |
| S8 | **Session token exposed in JSON response body** (in addition to httpOnly cookie) | Auth | Token theft via XSS |

### Data Integrity (CRITICAL — wrong data in production)

| # | Issue | Domain | Impact |
|---|---|---|---|
| D1 | **`auth.users` / `public.users` identity split** — different UUIDs, no FK, no trigger | Database | RLS policies silently return 0 rows |
| D2 | **`pod_provider` hardcoded to `'printful'`** in Stripe webhook | Stripe | Orders misrouted in multi-provider |
| D3 | **Cart→line item positional index mapping** — Stripe doesn't guarantee order | Payment | Wrong product/variant on orders |
| D4 | **`charge.refunded` webhook not handled** — Stripe Dashboard refunds invisible | Payment | DB out of sync with Stripe |
| D5 | **`async_payment_succeeded` not handled** — SEPA/bank transfers never create orders | Payment | Lost orders, money received but no fulfillment |

### Revenue (CRITICAL — legal/financial risk)

| # | Issue | Domain | Impact |
|---|---|---|---|
| R1 | **No EU VAT/IOSS collection** — `automatic_tax: false`, US tax rates hardcoded | Stripe | EU tax non-compliance |
| R2 | **No VAT-inclusive price display** — EU Omnibus Directive violation | Legal | Regulatory risk in DE/ES |
| R3 | **Emails lack unsubscribe link + physical address** — CAN-SPAM/ePrivacy violation | Frontend | Legal liability |
| R4 | **Coupon race condition** — `times_used` read-then-write non-atomic | Payment | Revenue loss |

### Functionality (CRITICAL — broken features)

| # | Issue | Domain | Impact |
|---|---|---|---|
| F1 | **Sitemap URLs all 404** — generates `/products/${id}` but route is `/shop/${id}` | SEO | Zero product indexing |
| F2 | **Account deletion broken** — missing `credentials: 'include'` → always 401 | Auth | GDPR non-compliance |
| F3 | **Admin retry endpoint doesn't exist** — button returns 404 | Admin | Cannot retry failed orders |
| F4 | **Admin bulk actions don't exist** — cancel/ship/deliver → 404 | Admin | Cannot manage orders at scale |
| F5 | **`/api/cart/shipping-estimate` doesn't exist** — CartView calls it | Frontend | Broken cart UX |
| F6 | **`/api/coupons/validate` doesn't exist** — CartView calls it | Frontend | Broken coupon UX |
| F7 | **Legal pages 404 if DB not seeded** | Legal | No terms/privacy on fresh deploy |
| F8 | **Guest→auth cart merge missing** — cart lost on login | Cart | Lost sales |
| F9 | **`getVariantPricing()` is stub** — returns `[]`, margin auditor blind | Printful | Cannot enforce pricing |
| F10 | **`confirmPublishing!()` non-null assertion** — crashes against Printful | Sync | Cron crash |
| F11 | **`STRIPE_PREMIUM_PRICE_ID` missing from env** — subscription creation crashes | Stripe | Runtime crash |

---

## P1 — Must Fix Within 30 Days of Launch

| # | Issue | Domain |
|---|---|---|
| P1-01 | Impressum not linked from FocusedFooter (TMG violation) | Legal |
| P1-02 | Right of withdrawal not explicitly stated for non-custom items | Legal |
| P1-03 | Placeholder emails (`privacy@podai.com`) in translations | Legal |
| P1-04 | No partial refunds — always refunds full total | Returns |
| P1-05 | No return window enforcement (no time limit) | Returns |
| P1-06 | In-production returns don't cancel Printful order | Returns |
| P1-07 | Printful double-confirm (createOrder + submitForProduction) | Printful |
| P1-08 | `trending_products` materialized view never refreshed | Database |
| P1-09 | `documents` table missing GIN text search index | Database |
| P1-10 | `association_rules.antecedents` missing GIN index | Database |
| P1-11 | IVFFlat instead of HNSW on vector embeddings | Database |
| P1-12 | Product cache fetches ALL products with no LIMIT | Performance |
| P1-13 | Only 12/30 tables have `tenant_id` | Multi-tenancy |
| P1-14 | Only 6/106 RLS policies are tenant-aware | Multi-tenancy |
| P1-15 | Profile routes query by email instead of id (mutable) | Auth |
| P1-16 | No session invalidation after password change | Auth |
| P1-17 | RBAC module implemented but unused (66 unprotected routes) | Admin |
| P1-18 | 2 internal escalation endpoints don't exist | Admin |
| P1-19 | Landing page has no `revalidate` — frozen at build time | Frontend |
| P1-20 | Offline SW hardcoded to `/en/offline` | PWA |
| P1-21 | No OG image on landing page | SEO |
| P1-22 | Blog pages missing from sitemaps | SEO |
| P1-23 | `alert()` used in checkout and chat (unstyled, untranslated) | UX |
| P1-24 | PWA icon files may not exist | PWA |
| P1-25 | Wishlist/InstallPrompt text hardcoded English | i18n |
| P1-26 | No GDPR Article 20 data export UI (endpoint exists) | GDPR |
| P1-27 | `updateProduct()` is stub — no actual API call | Printful |
| P1-28 | Printful env vars tagged `[OPTIONAL]` in .env.example | Config |
| P1-29 | Store config fragmented (hardcoded TS + DB) — cannot change without deploy | Config |
| P1-30 | Alert dedup Map in-memory — resets on deploy | Monitoring |

---

## Phase 5 DROP Migration Status

The Phase 5 migration (`20260302200000_phase5_drop_printify_columns.sql.hold`) **should remain on hold**. The DB audit confirmed that while the safety guards will pass (Batch 1 backfill relabeled products to `'printify_legacy'`), two code paths still read `blueprint_id` / `print_provider_id`:

1. `lib/pod/printify/mapper.ts` (lines 237-238, 318-319) — inside inactive Printify provider
2. `lib/reliability/divergence-detector.ts` (lines 122-136, 308-322) — field name strings in divergence reports

Both are non-critical (inactive code and string constants), but should be cleaned before executing the DROP.

---

## Recommended Execution Order

### Phase 1: Security Hardening (Week 1)
Fix S1-S8 — admin auth, session secret, RLS policies, setup-rbac removal

### Phase 2: Payment Pipeline (Week 1-2)
Fix D1-D5, R1-R4 — Stripe webhook gaps, VAT, cart merge, line item mapping

### Phase 3: Broken Features (Week 2)
Fix F1-F11 — sitemap URLs, missing endpoints, stubs, env vars

### Phase 4: Legal Compliance (Week 2-3)
Fix legal blockers + P1-01 to P1-03

### Phase 5: Database & Performance (Week 3)
Fix P1-08 to P1-12, execute Phase 5 DROP migration

### Phase 6: Multi-tenancy & Polish (Week 4+)
Fix P1-13 to P1-30, tenant isolation, i18n gaps

---

## Files in This Audit

```
docs/production-audit/
  00-executive-summary.md          (this file)
  01-purchase-payment-returns.md   (43 gaps, 6 P0)
  02-printful-stripe-config.md     (Printful + Stripe integration)
  03-legal-compliance-i18n.md      (87% compliant, 3 blockers)
  04-admin-config-monitoring.md    (66/69 routes unauthed)
  05-database-performance.md       (schema 72/100)
  06-multitenancy-users-auth.md    (42/100, auth critically broken)
  07-frontend-ux-performance-seo.md (sitemap 404s, email compliance)
```
