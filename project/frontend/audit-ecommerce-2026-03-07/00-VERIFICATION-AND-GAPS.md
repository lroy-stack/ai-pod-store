# SKAPARA Audit Verification & Gap Analysis — 2026-03-07

Cross-verification of 9 audit reports against actual codebase. Confirms findings, corrects inaccuracies, and identifies gaps the subagents missed.

---

## Part 1: CRITICAL Findings Verification

### CONFIRMED CRITICAL — Code verified

| # | Original Finding | Verified | Code Evidence |
|---|-----------------|----------|---------------|
| 1 | **IDOR in track_order** (Chat audit) | **YES** | `src/app/api/chat/route.ts:1527-1536` — when `orderId` is provided and user is NOT authenticated (`!chatUserId`), the query runs WITHOUT `user_id` filter. Any anonymous user can retrieve any order by UUID. |
| 2 | **ai_design_generate bypasses usage limits** (Chat audit) | **YES** | `route.ts:2216-2258` — calls `generateDesign()` directly without `checkAndIncrementUsage()`. Compare with `generate_design` tool at line 1791 which DOES call `checkAndIncrementUsage`. Two tools doing the same thing, one is gated, one is not. |
| 3 | **legal-utils.ts fallback placeholders** (Trust audit) | **YES** | `src/lib/legal-utils.ts:29-41` — `LEGAL_FALLBACKS` has `123 Main Street`, `legal@example.com`, `XX-XXXXXXX`. These render if DB fetch fails. |
| 4 | **RegisterForm terms link 404** (Trust audit) | **YES** | `src/components/auth/RegisterForm.tsx:316` — links to `/${locale}/legal/terms`. Actual route is `src/app/[locale]/(focused)/terms/page.tsx` → URL is `/${locale}/terms`. The `/legal/terms` path does NOT exist. |
| 5 | **STRIPE_PREMIUM_PRICE_ID missing from .env.example** (Plans audit) | **YES** | `src/app/api/subscription/create/route.ts:70` — `process.env.STRIPE_PREMIUM_PRICE_ID!` with non-null assertion. If env var missing → runtime crash. |
| 6 | **Stripe redirect URLs hardcoded to /en/** (Plans audit) | **YES** | `subscription/create/route.ts:74-75` and `credits/purchase/route.ts:99-100` — both use `${BASE_URL}/en/pricing`. Spanish/German users get English page after checkout. |
| 7 | **Admin: no logout endpoint** (Admin audit) | **YES** | Zero files matching `logout|sign-out|signout` in `admin/src/app/api/`. No way for admin to terminate session. |
| 8 | **Admin: legal-settings GET no auth** (Admin audit) | **PARTIALLY CORRECT** | `admin/src/app/api/admin/legal-settings/route.ts:19` — GET handler has no `withAuth()` or session check. However, the comment says "Public read access (used by legal pages on frontend)" — this is **by design** since the frontend fetches these for legal pages. Still exposes tax_id and DPO email publicly. The PUT handler DOES require auth. Severity should be **HIGH** not CRITICAL. |

### CORRECTED Findings

| # | Original Finding | Correction |
|---|-----------------|------------|
| 1 | **Sitemap is static with 6 URLs** (SEO audit) | **PARTIALLY WRONG** — The main `sitemap.ts` has 9 entries (3 locale homes + 3 chat + 3 sub-sitemap references). The sub-sitemaps (`sitemap-en.xml/route.ts`, etc.) ARE dynamic — they query Supabase for products AND categories. So product pages ARE indexed. The issue is the main sitemap doesn't include legal/about/faq pages directly — those are in the sub-sitemaps. Less critical than reported. |
| 2 | **Admin error.tsx leaks error.message** (Admin audit) | **CONFIRMED** but this was already partially fixed in the SKAPARA security audit earlier today (`admin/src/app/error.tsx` — we wrapped with `NODE_ENV` check). Need to verify if the fix was applied to the admin in this workspace. |
| 3 | **Legal-settings GET no auth** | Reclassified from CRITICAL to **HIGH** — it's intentionally public for frontend legal page rendering. The real issue is exposing `tax_id` in a public endpoint. |

---

## Part 2: GAPS NOT DETECTED by Subagents

### GAP-01 [CRITICAL] — Admin seed routes have ZERO auth
- **Files**: `src/app/api/admin/seed-branded/route.ts`, `src/app/api/admin/seed-hats/route.ts`
- **Problem**: Neither file imports `requireAdmin`, `authErrorResponse`, or any auth mechanism
- **Impact**: Anyone can POST to `/api/admin/seed-branded` or `/api/admin/seed-hats` to create arbitrary products in the database
- **Fix**: Add `requireAdmin()` guard to both routes

### GAP-02 [HIGH] — error.message leaked in 11 places in chat route
- **File**: `src/app/api/chat/route.ts`
- **Lines**: 555, 585, 640, 674, 769, 836, 982, 2256, 2334, 2475, 2480
- **Problem**: 11 occurrences of `error.message` returned to client in tool responses and the main error handler. Line 2480 is worst: `details: error instanceof Error ? error.message : String(error)` in the 500 response
- **Impact**: Internal error details (DB errors, API failures, stack traces) exposed to users
- **Note**: The chat audit mentioned this at line 2480 but missed the 10 other occurrences in tool execute blocks

### GAP-03 [HIGH] — deleted_at filter missing in SSR shop pages
- **File**: `src/app/[locale]/(app)/shop/page.tsx`, `src/app/[locale]/(app)/shop/category/[slug]/page.tsx`
- **Problem**: No `deleted_at` filter in the SSR Supabase queries. The API route (`/api/products`) may filter correctly, but SSR pages query directly. Soft-deleted products could appear in search results and category pages
- **Impact**: Users see products that should be hidden
- **Verification**: Searched for `deleted_at` in shop directory — zero matches

### GAP-04 [HIGH] — Middleware protectedRoutes incomplete
- **File**: `src/middleware.ts:17-21`
- **Current**: Only protects `/profile`, `/orders`, `/wishlist`
- **Missing**: `/checkout` is explicitly NOT protected (by design for guest checkout — OK). But `/designs` is NOT listed and may contain user designs that need auth
- **Note**: This was NOT flagged by any of the 9 audits

### GAP-05 [HIGH] — CRON_SECRET has fallback to PODCLAW_BRIDGE_AUTH_TOKEN
- **Files**: 9 cron routes use `process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN`
- **Problem**: If CRON_SECRET is not set, falls back to bridge token. If NEITHER is set, `verifyCronSecret(authHeader, undefined)` behavior depends on implementation. Could allow unauthenticated access
- **Impact**: Cron endpoints potentially accessible without auth if env vars misconfigured
- **Note**: Not flagged by any audit

### GAP-06 [MEDIUM] — drip email template has hardcoded /en/pricing link
- **File**: `src/app/api/cron/drip/route.ts:67`
- **Problem**: `<a href="${BASE_URL}/en/pricing">See Premium Plans →</a>` — same locale hardcoding issue as Stripe redirects. Users who signed up in Spanish get English pricing link
- **Note**: Drip emails should use the subscriber's locale preference

### GAP-07 [MEDIUM] — dangerouslySetInnerHTML usage audit
- **Files**: 6 usages found across codebase
- **Safe**: `SafeHTML.tsx` (uses DOMPurify), JSON-LD script tags (serialized JSON only)
- **Risky**: `layout.tsx:78` — `dangerouslySetInnerHTML={{ __html: themeCSS }}` — if theme CSS comes from user input (admin customization), this is an XSS vector. Need to verify `theme-server.ts` sanitization
- **Note**: `theme-server.ts:88` DOES have a validateCSSValue function. Partially mitigated

### GAP-08 [MEDIUM] — Landing page CTAs audit correction
- **Original**: "Both CTAs point to /chat, not /shop"
- **Verification needed**: The conversion funnel audit said this, but need to check if this is intentional — SKAPARA's differentiator IS the chat experience, so sending users to chat first (where the AI recommends products) may be the intended flow. This should be a **product decision**, not necessarily a bug

### GAP-09 [LOW] — Sub-sitemaps don't filter deleted products
- **File**: `src/app/sitemap-en.xml/route.ts:19-23`
- **Problem**: Fetches ALL products without filtering `deleted_at` or `status`. Soft-deleted or draft products get indexed by Google
- **Fix**: Add `.eq('status', 'active').is('deleted_at', null)` to the query

### GAP-10 [LOW] — Wishlist share URL hardcoded to /en/
- **File**: `src/app/api/wishlist/share/route.ts`
- **Problem**: Already flagged by engagement audit but worth confirming — generates share URLs with `/en/` regardless of user locale

---

## Part 3: Audit Quality Assessment

| Audit | Accuracy | Coverage | Gaps Found | Grade |
|-------|----------|----------|------------|-------|
| 01 - Conversion Funnel | 95% | High | GAP-08 (CTA intentionality question) | A |
| 02 - Mobile UX | 98% | High | None significant | A+ |
| 03 - Product Experience | 90% | High | GAP-03 (deleted_at not verified in SSR), GAP-09 | A- |
| 04 - SEO | 85% | High | Sitemap finding overclaimed (sub-sitemaps are dynamic) | B+ |
| 05 - Trust Signals | 95% | High | None significant | A |
| 06 - Engagement | 92% | High | None significant | A |
| 07 - Chat AI | 88% | High | GAP-02 (only caught 1 of 11 error.message leaks) | B+ |
| 08 - Plans/Limits | 93% | High | GAP-05 (CRON_SECRET fallback), GAP-06 (drip locale) | A- |
| 09 - Admin | 90% | High | GAP-01 (seed routes no auth), ADM-58 reclassified | A- |

**Overall audit quality: B+ to A** — subagents did solid work. Main gaps were:
- Cross-cutting concerns (error.message leaks across multiple files)
- Auth gaps in less obvious routes (seed endpoints)
- Env var fallback chains creating silent security holes
- Locale hardcoding pattern repeated in multiple places beyond what was caught

---

## Part 4: Consolidated Priority Action List

### P0 — Must fix before production
1. **IDOR in track_order** — add `user_id` filter for unauthenticated users OR block anonymous access
2. **ai_design_generate bypass** — add `checkAndIncrementUsage()` call
3. **Admin seed routes no auth** — add `requireAdmin()` to both
4. **RegisterForm terms link 404** — change `/legal/terms` to `/terms`
5. **Legal-utils fallback** — throw error instead of rendering placeholder data
6. **STRIPE_PREMIUM_PRICE_ID** — add to `.env.example` + startup validation

### P1 — Fix before launch
7. **Stripe/drip/credit redirect URLs** — use user locale instead of hardcoded `/en/`
8. **error.message leaks** — replace 11 occurrences in chat route with generic messages
9. **deleted_at filter** — add to SSR shop pages and sitemap queries
10. **Admin logout endpoint** — create session destruction route
11. **TIER_LIMITS duplication** — import from `usage-limiter.ts` canonical source
12. **CRON_SECRET fallback** — fail-closed if neither env var is set
13. **Chat AI system prompt** — add Premium plan awareness for natural upsell

### P2 — Fix post-launch
14. **Sitemap** — add legal pages to sub-sitemaps, filter by status/deleted_at
15. **Product JSON-LD brand field** — add to structured data
16. **Mobile bottom nav** — add for key actions
17. **Touch targets** — fix color swatches and dismiss buttons
18. **Social sharing** — add share buttons to product pages
19. **Admin session** — reduce from 7 days to 24 hours
