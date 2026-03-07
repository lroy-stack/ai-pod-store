# API Audit Report -- 2026-03-07

## Executive Summary

- **Total endpoints audited**: 201 (113 frontend + 88 admin)
- **PASS**: 142 | **WARN**: 36 | **FAIL**: 16 | **CRITICAL**: 7
- **Critical findings**: SQL injection via `.or()` in admin routes, unauthenticated file uploads, error message leaks, missing rate limiting on checkout

---

## 1. Endpoint Inventory

### Frontend API (`/api/`) -- 113 routes

| # | Method | Path | Auth | Validation | Rate Limit | Status |
|---|--------|------|------|------------|------------|--------|
| 1 | POST | /api/auth/login | None (public) | Manual | authLimiter | PASS |
| 2 | POST | /api/auth/register | None (public) | Manual | registerLimiter | PASS |
| 3 | POST | /api/auth/logout | None (cookie) | None | None | PASS |
| 4 | GET | /api/auth/me | Cookie token | None | None | PASS |
| 5 | GET | /api/auth/session | Cookie token | None | None | PASS |
| 6 | POST | /api/auth/forgot-password | None (public) | Manual | forgotPasswordLimiter | PASS |
| 7 | POST | /api/auth/reset-password | None (public) | Manual | None | WARN |
| 8 | POST | /api/auth/verify-email | None (public) | Manual | None | WARN |
| 9 | GET | /api/auth/providers | None (public) | None | None | PASS |
| 10 | GET | /api/products | None (public) | sanitizeForLike | None | PASS |
| 11 | GET | /api/products/[id] | None (public) | None | None | PASS |
| 12 | GET | /api/products/[id]/cross-sell | None (public) | None | None | PASS |
| 13 | GET | /api/products/[id]/social-proof | None (public) | None | None | PASS |
| 14 | GET | /api/products/trending | None (public) | None | None | PASS |
| 15 | GET | /api/categories | None (public) | None | None | PASS |
| 16 | GET | /api/categories/[slug] | None (public) | None | None | PASS |
| 17 | GET/POST | /api/orders | requireAuth | None (GET), Manual (POST) | None | PASS |
| 18 | GET | /api/orders/[id] | requireAuth | None | None | PASS |
| 19 | POST | /api/orders/[id]/reorder | requireAuth | None | None | PASS |
| 20 | GET | /api/orders/[id]/invoice | requireAuth | None | None | PASS |
| 21 | POST | /api/orders/[id]/returns | requireAuth | Zod | None | PASS |
| 22 | GET/POST | /api/cart | Cookie token | None | None | PASS |
| 23 | POST | /api/cart/merge | Cookie token | None | None | PASS |
| 24 | POST | /api/cart/shipping-estimate | None (public) | Manual | None | PASS |
| 25 | POST | /api/checkout/create-session | None (public) | Manual | None | **FAIL** |
| 26 | POST | /api/checkout/calculate-tax | None (public) | Manual | None | WARN |
| 27 | POST | /api/chat | Anomaly+Usage | Zod (TrackEventSchema) | chatLimiter+slots | PASS |
| 28 | POST | /api/webhooks/stripe | Stripe signature | None | None | PASS |
| 29 | POST | /api/webhooks/telegram | None | None | None | WARN |
| 30 | POST | /api/webhooks/whatsapp | None | None | None | WARN |
| 31 | POST | /api/webhooks/pod/[provider] | Provider signature | None | None | PASS |
| 32 | POST | /api/webhooks/cache-invalidate | None | None | None | WARN |
| 33 | POST | /api/profile/avatar | Cookie token | File type+size | avatarUploadLimiter | PASS |
| 34 | POST | /api/profile/change-password | requireAuth | Manual | None | WARN |
| 35 | POST | /api/profile/change-email | requireAuth | Manual | None | WARN |
| 36 | POST | /api/profile/delete | requireAuth | None | None | PASS |
| 37 | POST | /api/profile/cancel-deletion | requireAuth | None | None | PASS |
| 38 | GET | /api/profile/export | requireAuth | None | None | PASS |
| 39 | GET/POST | /api/profile/payment-methods | requireAuth | None | None | PASS |
| 40 | DELETE | /api/profile/payment-methods/[id] | requireAuth | None | None | PASS |
| 41 | GET/POST | /api/user/profile | Cookie token | Manual | None | PASS |
| 42 | GET/POST | /api/designs | getAuthUser | Zod (saveDesignSchema) | designSaveLimiter | PASS |
| 43 | POST | /api/designs/generate | requireAuth | Zod | designGenerateLimiter | PASS |
| 44 | POST | /api/designs/ai-generate | requireAuth | Zod | Usage limiter | PASS |
| 45 | POST | /api/designs/ai-generate/refine | requireAuth | Zod | Usage limiter | PASS |
| 46 | POST | /api/designs/estimate | requireAuth | Zod | None | PASS |
| 47 | POST | /api/designs/mockup | requireAuth | Zod | Usage limiter | PASS |
| 48 | POST | /api/designs/compose | requireAuth | Manual | None | PASS |
| 49 | POST | /api/designs/compose-v2 | requireAuth | Manual | None | PASS |
| 50 | GET | /api/designs/history | requireAuth | None | None | PASS |
| 51 | POST | /api/designs/[id]/create-product | requireAuth | Manual | None | PASS |
| 52 | GET/PUT/DELETE | /api/designs/composition/[id] | requireAuth | Manual | None | PASS |
| 53 | POST | /api/designs/remove-bg | requireAuth | Manual | Usage limiter | PASS |
| 54 | GET | /api/design-assets/clipart | None (public) | None | None | PASS |
| 55 | GET | /api/design-assets/templates | None (public) | None | None | PASS |
| 56 | GET | /api/wishlist | getAuthUser | None | None | PASS |
| 57 | POST | /api/wishlist | requireAuth | Manual | None | PASS |
| 58 | POST | /api/wishlist/items | requireAuth | Manual | None | PASS |
| 59 | POST | /api/wishlist/sync | requireAuth | Manual | None | PASS |
| 60 | POST | /api/wishlist/share | requireAuth | Manual | None | PASS |
| 61 | GET | /api/wishlist/shared/[token] | None (public) | None | None | PASS |
| 62 | GET/POST | /api/shipping-addresses | Cookie token | Manual | None | PASS |
| 63 | PUT/DELETE | /api/shipping-addresses/[id] | Cookie token | Manual | None | PASS |
| 64 | GET/POST | /api/reviews | Cookie token | Manual | reviewLimiter | PASS |
| 65 | POST | /api/reviews/upload-photos | **NONE** | File type+size | **NONE** | **CRITICAL** |
| 66 | GET | /api/notifications | Cookie token | None | None | PASS |
| 67 | PATCH | /api/notifications/[id]/read | Cookie token | None | None | PASS |
| 68 | GET | /api/notifications/count | Cookie token | None | None | PASS |
| 69 | POST | /api/notifications/read-all | Cookie token | None | None | PASS |
| 70 | GET | /api/notifications/unread-count | Cookie token | None | None | PASS |
| 71 | POST | /api/newsletter/subscribe | None (public) | Zod | None | PASS |
| 72 | POST/GET | /api/newsletter/unsubscribe | None (public) | Manual | newsletterLimiter | PASS |
| 73 | GET | /api/newsletter/confirm/[token] | None (public) | None | None | PASS |
| 74 | GET | /api/newsletter/campaigns | None (public) | None | newsletterLimiter | PASS |
| 75 | GET | /api/newsletter/drip-sequence-docs | **NONE** | None | **NONE** | **FAIL** |
| 76 | POST | /api/consent | Cookie token (opt) | Manual | None | PASS |
| 77 | POST | /api/referral | requireAuth | Manual | None | PASS |
| 78 | POST | /api/billing/portal | requireAuth | None | None | PASS |
| 79 | POST | /api/subscription/create | requireAuth | None | subscriptionCreateLimiter | PASS |
| 80 | POST | /api/subscription/portal | requireAuth | None | None | PASS |
| 81 | GET | /api/subscription/usage | requireAuth | None | None | PASS |
| 82 | GET | /api/usage/status | getAuthUser | None | None | PASS |
| 83 | POST | /api/captcha/verify | None (public) | Manual | None | PASS |
| 84 | POST | /api/coupons/validate | None (public) | Manual | couponLimiter | PASS |
| 85 | POST | /api/push/subscribe | requireAuth | Manual | None | PASS |
| 86 | POST | /api/push/send | requireAdmin | Manual | None | PASS |
| 87 | POST | /api/admin/alert | requireAdmin | Manual | None | PASS |
| 88 | POST | /api/admin/designs/moderate | requireAdmin | Zod | None | PASS |
| 89 | GET | /api/admin/fix-publishing | verifyCronSecret | None | None | PASS |
| 90 | POST | /api/admin/migrate | requireAdmin | None | None | PASS (disabled) |
| 91 | GET | /api/admin/orders | requireAdmin | sanitize | None | PASS |
| 92 | GET | /api/admin/seed-branded | N/A | N/A | N/A | PASS (deprecated) |
| 93 | GET | /api/admin/seed-hats | N/A | N/A | N/A | PASS (deprecated) |
| 94 | POST | /api/admin/sitemap | requireAdmin | None | None | PASS |
| 95 | GET | /api/admin/translations | requireAdmin | None | None | PASS |
| 96 | GET | /api/admin/returns | requireAdmin | None | None | PASS |
| 97 | PUT | /api/admin/returns/[id] | requireAdmin | Zod | None | PASS |
| 98 | POST | /api/analytics/track | None (public) | Zod | None | WARN |
| 99 | GET | /api/analytics/[type] | requireAdmin | Validated type | None | PASS |
| 100 | POST | /api/ab-test/events | None (dev only) | Manual | None | PASS |
| 101 | GET | /api/ab-test/experiments | requireAdmin (dev) | None | None | PASS |
| 102 | GET | /api/ab-test/experiments/[id] | None (dev only) | None | None | WARN |
| 103 | GET/POST | /api/conversations | requireAuth | None | None | PASS |
| 104 | GET/DELETE | /api/conversations/[id] | requireAuth + ownership | None | None | PASS |
| 105 | GET | /api/health | None (public) | None | None | PASS |
| 106 | GET | /api/ping | None (public) | None | None | PASS |
| 107 | GET | /api/metrics | **NONE** | None | **NONE** | **FAIL** |
| 108 | GET | /api/test-rate-limit | None (dev only) | None | TestRateLimiter | PASS |
| 109 | POST | /api/session/migrate | requireAuth | Manual | None | PASS |
| 110 | GET | /api/proxy-image | None (public) | Domain allowlist | None | PASS |
| 111 | GET | /api/verify-domain | None (internal) | None | None | PASS |
| 112 | GET | /api/tenant-resolve | None (internal) | None | None | PASS |
| 113 | GET | /api/tenant/gate | None (internal) | Manual | None | WARN |
| 114 | GET | /api/translations/cache | None (public) | None | None | PASS |
| 115 | GET/PUT | /api/storefront/branding | None (public) | None | None | PASS |
| 116 | GET | /api/storefront/theme | None (public) | None | None | PASS |
| 117 | GET | /api/storefront/personalization-surcharge | None (public) | None | None | PASS |
| 118 | POST | /api/revalidate/theme | verifyCronSecret | None | None | PASS |
| 119 | GET | /api/policies | None (public) | None | None | PASS |
| 120 | POST | /api/errors/report | None (public) | Manual | None | WARN |
| 121 | GET | /api/seo/[locale] | None (public) | None | None | PASS |
| 122 | POST | /api/telegram/test-command | None (dev only) | None | None | PASS |
| 123 | GET | /api/telegram/test-admin-status | None (dev only) | None | None | PASS |
| 124 | POST | /api/credits/purchase | requireAuth | Manual | None | PASS |
| 125 | GET/POST | /api/marketing/content | requireAdmin | None | None | PASS |
| 126 | POST | /api/marketing/test-ad-copy | requireAdmin (dev) | None | None | PASS |
| 127 | POST | /api/rag/add-documents | requireAdmin | Manual | None | PASS |
| 128 | POST | /api/rag/index | requireAdmin | Manual | None | PASS |
| 129 | GET | /api/rag/list-all | requireAdmin | None | None | PASS |
| 130 | POST | /api/rag/search | requireAuth | Manual | None | PASS |
| 131 | GET | /api/rag/stats | requireAdmin | None | None | PASS |
| 132 | GET | /api/rag/verify-schema | None | None | None | PASS (stub) |
| 133 | GET | /api/cron/sync-printify | verifyCronSecret | None | Lock | PASS |
| 134 | GET | /api/cron/cleanup | verifyCronSecret | None | None | PASS |
| 135 | GET | /api/cron/cleanup-personal | verifyCronSecret | None | None | PASS |
| 136 | GET | /api/cron/zombie-reaper | verifyCronSecret | None | None | PASS |
| 137 | GET | /api/cron/product-metrics | verifyCronSecret | None | None | PASS |
| 138 | GET | /api/cron/hard-delete-accounts | verifyCronSecret | None | None | PASS |
| 139 | GET | /api/cron/abandoned-cart-recovery | verifyCronSecret | None | None | PASS |
| 140 | GET | /api/cron/drip | verifyCronSecret | None | None | PASS |
| 141 | GET | /api/cron/retry-printify-orders | verifyCronSecret | None | None | PASS |
| 142 | GET | /api/cron/check-delivery-status | verifyCronSecret | None | Lock | PASS |
| 143 | GET | /api/cron/cleanup-temp-products | verifyCronSecret | None | Lock | PASS |
| 144 | GET | /api/returns/[id]/tracking | Cookie token | None | None | PASS |

### Admin API (`/api/`) -- 88 routes

| # | Method | Path | Auth | Validation | Rate Limit | Status |
|---|--------|------|------|------------|------------|--------|
| 1 | POST | /api/auth/login | None (public) | Manual | adminLoginLimiter | PASS |
| 2 | POST | /api/auth/change-password | None (user_id) | Manual | **NONE** | **FAIL** |
| 3 | GET | /api/health | None (public) | None | None | PASS |
| 4 | GET/POST | /api/products | withPermission | Zod (POST) | None | PASS |
| 5 | GET/PATCH | /api/products/[id] | withPermission | Zod (PATCH) | None | PASS |
| 6 | GET/PATCH | /api/products/[id]/variants | withPermission | Zod (PATCH) | None | PASS |
| 7 | GET | /api/products/[id]/metrics | withPermission | None | None | PASS |
| 8 | GET | /api/products/[id]/mockup-status | withAuth | None | None | PASS |
| 9 | PATCH | /api/products/bulk | withPermission | Zod | None | PASS |
| 10 | GET/PATCH | /api/products/bulk-price | withPermission | Zod (PATCH) | None | PASS |
| 11 | GET | /api/orders | requireAuth | Manual | None | WARN |
| 12 | GET/PATCH | /api/orders/[id] | withAuth | Manual | None | PASS |
| 13 | POST | /api/orders/[id]/notes | withAuth | Manual | None | PASS |
| 14 | GET | /api/customers | withAuth | None | None | PASS |
| 15 | GET/PATCH | /api/customers/[id] | withAuth/withPermission | Zod (PATCH) | None | PASS |
| 16 | GET | /api/returns | withAuth | None | None | PASS |
| 17 | POST | /api/returns/[id]/approve | withPermission | Manual | None | PASS |
| 18 | POST | /api/returns/[id]/reject | withPermission | Manual | None | PASS |
| 19 | POST | /api/returns/[id]/receive | withPermission | Manual | None | PASS |
| 20 | GET | /api/reviews | withAuth | None | None | PASS |
| 21 | PUT | /api/reviews/[id] | withPermission | Manual | None | PASS |
| 22 | GET | /api/designs | getAdminSession | None | None | PASS |
| 23 | GET/PUT/DELETE | /api/designs/[id] | withAuth/withPermission | Zod (PUT) | None | PASS |
| 24 | PUT | /api/designs/[id]/moderate | withPermission | Zod | None | PASS |
| 25 | DELETE | /api/designs/bulk-delete | withPermission | Zod | None | PASS |
| 26 | GET | /api/designs/mapping | getAdminSession | None | None | PASS |
| 27 | POST | /api/designs/upload | withPermission | File type+size | None | PASS |
| 28 | GET/PUT | /api/translations | withAuth | None (GET) | None | PASS |
| 29 | POST | /api/translations/auto-translate | withAuth | Manual | None | PASS |
| 30 | GET/POST | /api/blog | withAuth/withPermission | Zod (POST) | None | PASS |
| 31 | DELETE | /api/blog/[id] | withPermission | None | None | PASS |
| 32 | GET | /api/tenants | withAuth | None | None | PASS |
| 33 | PATCH | /api/tenants/[id] | withPermission | Manual | None | PASS |
| 34 | GET | /api/tenants/[id]/billing | withAuth | None | None | PASS |
| 35 | GET | /api/tenants/check-slug | withAuth | Manual | None | PASS |
| 36 | POST | /api/tenants/create | withAuth | Manual | None | PASS |
| 37 | GET | /api/dashboard/stats | requireAuth | None | None | PASS |
| 38 | GET | /api/dashboard/recent-orders | withAuth | None | None | PASS |
| 39 | GET | /api/dashboard/revenue-trend | withAuth | None | None | PASS |
| 40 | GET | /api/dashboard/top-products | withAuth | None | None | PASS |
| 41 | GET | /api/dashboard/customer-acquisition | withAuth | None | None | PASS |
| 42 | GET (SSE) | /api/dashboard/activity-feed | withAuth | None | None | PASS |
| 43 | GET | /api/analytics/demand | withAuth | None | None | PASS |
| 44 | GET | /api/analytics/rfm | withAuth | None | None | PASS |
| 45 | GET | /api/analytics/funnel | withAuth | None | None | PASS |
| 46 | GET | /api/search | withAuth | Manual | None | **CRITICAL** |
| 47 | GET | /api/metrics | withAuth | None | None | PASS |
| 48 | GET | /api/audit | withAuth | None | None | PASS |
| 49 | POST | /api/task | withAuth | Manual | None | PASS |
| 50 | GET (SSE) | /api/events/stream | withAuth | None | None | PASS |
| 51 | GET/PUT | /api/admin/settings | iron-session | None | None | PASS |
| 52 | GET/PUT | /api/admin/seo | withAuth | None | None | PASS |
| 53 | GET/PUT | /api/admin/roles | withAuth/withPermission | Manual | None | PASS |
| 54 | GET/PUT | /api/admin/brand-config | None(GET)/withPermission(PUT) | Zod (PUT) | None | **FAIL** |
| 55 | GET/POST | /api/admin/categories | withAuth/withPermission | Zod (POST) | None | PASS |
| 56 | GET/PATCH/DELETE | /api/admin/categories/[id] | withAuth/withPermission | Zod | None | PASS |
| 57 | GET/POST | /api/admin/themes | withAuth/withPermission | Zod (POST) | None | PASS |
| 58 | GET/PUT | /api/admin/themes/[id] | withAuth/withPermission | Zod (PUT) | None | PASS |
| 59 | POST | /api/admin/themes/[id]/activate | withPermission | None | None | PASS |
| 60 | GET | /api/admin/legal-pages | withAuth | None | None | PASS |
| 61 | GET/PUT | /api/admin/legal-pages/[slug] | withAuth/withPermission | None | None | PASS |
| 62 | GET | /api/admin/legal-pages/[slug]/versions | withAuth | None | None | PASS |
| 63 | GET/PUT | /api/admin/legal-settings | None(GET)/iron-session(PUT) | None | None | **FAIL** |
| 64 | GET | /api/admin/legal/consents | withAuth | None | None | PASS |
| 65 | GET | /api/admin/subscribers | withAuth | None | None | PASS |
| 66 | GET | /api/admin/notifications | withAuth | None | None | PASS |
| 67 | POST | /api/admin/notifications/mark-all-read | withPermission | None | None | PASS |
| 68 | POST | /api/admin/finance/export | withAuth | Manual | None | PASS |
| 69 | GET | /api/admin/finance/report | withAuth | None | None | PASS |
| 70 | POST | /api/admin/analytics/export | withAuth | None | None | PASS |
| 71 | GET/PUT | /api/admin/agent/soul | withAuth | None | None | PASS |
| 72 | POST | /api/admin/credits/adjust | withPermission | Manual | None | PASS |
| 73 | POST | /api/admin/orders/bulk | withPermission | Manual | None | PASS |
| 74 | POST | /api/admin/orders/[id]/retry | withPermission | None | None | PASS |
| 75 | POST | /api/admin/sitemap | withAuth | None | None | PASS |
| 76 | GET/POST/PUT/DELETE | /api/agent/[...path] | withAuth | None | None | PASS |
| 77 | POST | /api/agent/chat/stream | withAuth | None | None | PASS |
| 78 | GET | /api/agent/chat/conversations | withAuth | None | None | PASS |
| 79 | GET/DELETE | /api/agent/chat/conversations/[id] | withAuth | None | None | PASS |
| 80 | GET | /api/agent/metrics | withAuth | None | None | PASS |
| 81 | GET/PUT/POST | /api/agent/schedule | withAuth | None | None | PASS |
| 82 | GET | /api/agent/memory | iron-session | None | None | PASS |
| 83 | GET | /api/agent/sessions | withAuth | None | None | PASS |
| 84 | GET | /api/agent/sessions/[id]/events | withAuth | None | None | PASS |
| 85 | GET | /api/monitoring/health | withAuth | None | None | PASS |
| 86 | GET | /api/monitoring/errors | withAuth | None | None | PASS |
| 87 | GET | /api/monitoring/crons | withAuth | None | None | PASS |
| 88 | GET | /api/monitoring/webhooks | withAuth | None | None | PASS |
| 89 | GET | /api/monitoring/integrity | withAuth | None | None | PASS |
| 90 | GET/POST | /api/messaging/config | withAuth | Manual | None | PASS |
| 91 | GET/POST | /api/ab-tests | withAuth/withPermission | Zod (POST) | None | PASS |
| 92 | POST | /api/ab-tests/[id]/start | withPermission | None | None | PASS |
| 93 | POST | /api/ab-tests/[id]/stop | withPermission | None | None | PASS |
| 94 | GET | /api/dev/check-index | withAuth | None | None | PASS |

---

## 2. Critical Findings (P0)

### C1. SQL Injection via `.or()` filter in Admin Routes

**Severity**: P0 CRITICAL
**Routes affected**:
- `/admin/src/app/api/orders/route.ts:42` -- `query.or(\`id.ilike.%${search}%,customer_email.ilike.%${search}%\`)`
- `/admin/src/app/api/search/route.ts:21,28,35` -- Multiple `.or()` with unsanitized `searchTerm`
- `/admin/src/app/api/products/route.ts:25` -- `query.or(\`title.ilike.%${search}%,category.ilike.%${search}%\`)`
- `/admin/src/app/api/designs/route.ts:46` -- `query.or(\`prompt.ilike.%${search}%,style.ilike.%${search}%\`)`

**Issue**: User input is interpolated directly into PostgREST `.or()` filter strings without sanitization. The admin `search` input is only stripped of `[.,()]` characters but not PostgREST operators like `.eq.`, `.is.`, etc. An authenticated admin could craft a search like `%,role.eq.admin` to modify the filter logic.

The frontend routes correctly use `sanitizeForLike()` and `sanitizeForPostgrest()` from `@/lib/query-sanitizer`, but the admin routes do NOT import or use these utilities.

**Recommended fix**: Import and use `sanitizeForLike`/`sanitizeForPostgrest` in all admin routes that use `.or()` with user input. The `session/migrate/route.ts` already has a security comment noting this exact pattern should be avoided.

---

### C2. Unauthenticated File Upload -- `/api/reviews/upload-photos`

**Severity**: P0 CRITICAL
**File**: `frontend/src/app/api/reviews/upload-photos/route.ts`
**Line**: Full file

**Issue**: This endpoint accepts file uploads (up to 3 photos, 5MB each) with **zero authentication**. Any unauthenticated user can upload files to Supabase Storage bucket `review-photos`. This could be exploited for:
- Storage abuse (uploading arbitrary content until quota is exhausted)
- Serving malicious content from a trusted domain
- No rate limiting means automated abuse is trivial

**Recommended fix**: Add `requireAuth` and a per-user rate limiter. Verify the user has actually purchased the product before allowing review photo uploads.

---

### C3. Password Reset Bypasses Auth Verification

**Severity**: P0 CRITICAL
**File**: `frontend/src/app/api/auth/reset-password/route.ts`
**Line**: Full file

**Issue**: The reset-password endpoint calls `supabaseAdmin.auth.updateUser({ password })` using the **admin service key**, NOT the user's access token. The `accessToken` parameter received from the client is never actually used to authenticate the request. This means:
- The route updates the password for whatever user the admin client's context points to, not the user identified by the access token
- Missing rate limiting allows brute-force attempts
- No validation that the access token corresponds to a valid reset flow

**Recommended fix**: Use the user's access token to create a scoped Supabase client and call `updateUser` through that, not through `supabaseAdmin`. Add rate limiting (e.g., `forgotPasswordLimiter`).

---

### C4. Admin Change-Password Has No Rate Limiting

**Severity**: P0 CRITICAL
**File**: `admin/src/app/api/auth/change-password/route.ts`

**Issue**: The admin change-password route accepts `user_id`, `current_password`, and `new_password` with **no rate limiting** and **no session requirement**. An attacker who knows a `user_id` can brute-force the current password. The route only checks that the user has role `admin`, but does not require an active session.

**Recommended fix**: Add rate limiting by IP. Require either an active iron-session OR restrict the endpoint to only be callable during the `must_change_password` flow (validate a temporary token).

---

### C5. Prometheus Metrics Endpoint Unprotected

**Severity**: P0 CRITICAL
**File**: `frontend/src/app/api/metrics/route.ts`

**Issue**: The `/api/metrics` endpoint exposes Prometheus metrics (memory usage, heap stats, uptime, service version) with **no authentication**. This information aids attackers in profiling the application. The admin metrics endpoint correctly uses `withAuth`, but the frontend one does not.

**Recommended fix**: Add authentication or restrict to internal network only. At minimum, require `verifyCronSecret` or a static bearer token.

---

### C6. Drip Sequence Docs Endpoint Exposes Internal Data

**Severity**: P0 CRITICAL
**File**: `frontend/src/app/api/newsletter/drip-sequence-docs/route.ts`

**Issue**: This endpoint has **no authentication** and exposes the complete internal drip email campaign configuration including campaign IDs, subject lines (A/B variants), CTAs, and sequence timing. This is sensitive marketing data that should be admin-only.

**Recommended fix**: Add `requireAdmin` guard.

---

### C7. Admin Brand Config GET Is Unauthenticated

**Severity**: P0 CRITICAL
**File**: `admin/src/app/api/admin/brand-config/route.ts`

**Issue**: The `GET` handler for brand-config does not use `withAuth` or any authentication middleware. While the `PUT` handler correctly uses `withPermission`, the `GET` handler is a raw `export async function GET()` that anyone can access. This exposes the full brand configuration including personalization surcharge settings.

**Recommended fix**: Wrap the GET handler with `withAuth`.

---

## 3. High-Priority Findings (P1)

### H1. Error Message Leaks to Client Responses

**Severity**: P1
**Routes affected** (non-exhaustive):
- `frontend/src/app/api/auth/me/route.ts:38` -- `{ error: err.message }` in catch block
- `frontend/src/app/api/auth/providers/route.ts:107` -- `details: error instanceof Error ? error.message : 'Unknown error'`
- `frontend/src/app/api/shipping-addresses/route.ts:31,109` -- `{ error: error.message }`
- `frontend/src/app/api/shipping-addresses/[id]/route.ts:87,142` -- `{ error: error.message }`
- `frontend/src/app/api/designs/route.ts:46` -- `details: error instanceof Error ? error.message : String(error)`
- `frontend/src/app/api/profile/export/route.ts:156` -- `{ error: err.message }`
- `frontend/src/app/api/design-assets/clipart/route.ts:23` -- `{ error: error.message }`
- `frontend/src/app/api/design-assets/templates/route.ts:25` -- `{ error: error.message }`
- `frontend/src/app/api/chat/route.ts:2480` -- `details: error instanceof Error ? error.message : String(error)`
- `frontend/src/app/api/analytics/[type]/route.ts:65` -- `details: error.message`
- Multiple cron routes expose error details (acceptable for internal/admin routes)

**Issue**: Raw error messages from Supabase, Stripe, or internal exceptions are returned to clients. These can reveal database schema details, table names, constraint names, and internal service topology.

**Recommended fix**: Return generic error messages to clients. Log full error details server-side only. Pattern: `return NextResponse.json({ error: 'Operation failed' }, { status: 500 })`.

---

### H2. Checkout Create-Session Lacks Authentication and Rate Limiting

**Severity**: P1
**File**: `frontend/src/app/api/checkout/create-session/route.ts`

**Issue**: The checkout session creation endpoint has **no authentication** and **no rate limiting**. While allowing guest checkout is a business requirement, the absence of rate limiting means an attacker can:
- Spam Stripe Checkout session creation (each session costs API calls)
- Enumerate valid product/variant IDs
- DOS the checkout pipeline

**Recommended fix**: Add IP-based rate limiting (e.g., 5 sessions per minute per IP). The captcha integration (Turnstile) should also be considered here.

---

### H3. Webhook Endpoints Missing Signature Verification

**Severity**: P1
**Routes affected**:
- `frontend/src/app/api/webhooks/telegram/route.ts` -- No signature verification visible
- `frontend/src/app/api/webhooks/whatsapp/route.ts` -- No signature verification visible
- `frontend/src/app/api/webhooks/cache-invalidate/route.ts` -- No authentication at all

**Issue**: The Stripe webhook correctly uses `stripe.webhooks.constructEvent()` for signature verification. The POD webhook uses provider-specific signature verification. But the Telegram, WhatsApp, and cache-invalidate webhooks appear to have no verification, allowing anyone to trigger webhook processing by sending crafted requests.

**Recommended fix**: Telegram webhooks should verify using the bot token secret. WhatsApp webhooks should verify the `X-Hub-Signature-256` header. Cache-invalidate should require `verifyCronSecret`.

---

### H4. Admin Legal Settings GET Is Unauthenticated

**Severity**: P1
**File**: `admin/src/app/api/admin/legal-settings/route.ts`

**Issue**: The `GET` handler has no authentication (designed for "public read" access by the frontend). However, being in the admin API, it's likely used by the frontend to load legal settings publicly, which is fine, but the route also returns all settings including internal configuration fields.

**Recommended fix**: If public read is intended, move to the frontend API. If admin-only, add `withAuth`.

---

### H5. Missing IDOR Protection on Several Routes

**Severity**: P1
**Routes affected**:
- `frontend/src/app/api/returns/[id]/tracking/route.ts` -- May not verify user ownership of the return
- `admin/src/app/api/orders/route.ts:11` -- Uses `requireAuth` instead of `withAuth` (non-admin users with valid session could potentially access)

**Issue**: Some routes that access resources by ID don't verify the requesting user owns that resource. While admin routes generally don't need per-resource ownership checks (admins see everything), the frontend `orders/[id]/route.ts` correctly filters by `user_id`, which is good.

**Recommended fix**: Audit each `[id]` route to ensure ownership checks exist for user-facing routes.

---

## 4. Medium-Priority Findings (P2)

### M1. Missing Zod Validation on POST/PATCH Routes

**Severity**: P2
**Routes without schema validation on body parsing**:
- `frontend/src/app/api/checkout/create-session/route.ts` -- Manual validation only
- `frontend/src/app/api/shipping-addresses/route.ts` (POST) -- Manual field checks
- `frontend/src/app/api/wishlist/items/route.ts` (POST) -- Manual field checks
- `frontend/src/app/api/consent/route.ts` (POST) -- `typeof consents !== 'object'` only
- `frontend/src/app/api/push/subscribe/route.ts` (POST) -- Manual field checks
- `frontend/src/app/api/profile/change-password/route.ts` -- Manual validation
- `frontend/src/app/api/profile/change-email/route.ts` -- Manual validation
- `admin/src/app/api/tenants/create/route.ts` -- Manual validation
- `admin/src/app/api/orders/[id]/notes/route.ts` -- Manual validation

**Issue**: While manual validation works, it's error-prone and inconsistent. Zod schemas provide type safety, automatic error messages, and strip unknown fields (preventing mass assignment).

**Recommended fix**: Migrate to Zod schemas for all POST/PATCH/PUT endpoints. The codebase already has good patterns to follow (e.g., `designs/route.ts`, `products/[id]/route.ts`).

---

### M2. Missing Rate Limiting on Sensitive Operations

**Severity**: P2
**Routes lacking rate limiting**:
- `frontend/src/app/api/auth/reset-password` -- Password reset (P0 overlap)
- `frontend/src/app/api/auth/verify-email` -- Email verification
- `frontend/src/app/api/profile/change-password` -- Password change
- `frontend/src/app/api/profile/change-email` -- Email change
- `frontend/src/app/api/profile/delete` -- Account deletion
- `frontend/src/app/api/analytics/track` -- Unauthenticated event tracking (abuse vector)
- `frontend/src/app/api/errors/report` -- Unauthenticated error reporting (abuse vector)
- `admin/src/app/api/auth/change-password` -- Admin password change (P0 overlap)

**Recommended fix**: Add rate limiters per IP or per user for sensitive operations. The codebase has established patterns with `authLimiter`, `reviewLimiter`, etc.

---

### M3. Supabase Auth Error Messages Leaked in Login

**Severity**: P2
**File**: `frontend/src/app/api/auth/login/route.ts:68`

**Issue**: When the Supabase auth error is NOT "Invalid login credentials", the raw `authError.message` is returned to the client. This can leak information about the auth system (e.g., "Email not confirmed", "User banned").

**Recommended fix**: Map all Supabase auth errors to generic messages. Only differentiate between "invalid credentials" and "something went wrong".

---

### M4. Missing `Cache-Control: no-store` on Authenticated Routes

**Severity**: P2

**Issue**: Most authenticated routes (orders, profile, notifications, conversations) do not set `Cache-Control: no-store` headers. This means proxies or CDNs could cache authenticated responses. The `metrics` endpoint correctly sets `no-cache, no-store, must-revalidate`.

**Recommended fix**: Add `Cache-Control: private, no-store` to all responses from authenticated endpoints.

---

### M5. Register Route Leaks Supabase Auth Errors

**Severity**: P2
**File**: `frontend/src/app/api/auth/register/route.ts:66`

**Issue**: `authError.message || 'Failed to create user account'` -- The raw Supabase error message (e.g., "User already registered") is returned, enabling email enumeration.

**Recommended fix**: Return a generic success message regardless of whether the account exists. Or return a generic error: "Registration failed. If you already have an account, try logging in."

---

## 5. Low-Priority Findings (P3)

### L1. CORS Configuration

**Status**: PASS (mostly)

Only three routes use explicit CORS headers: `/api/health`, `/api/ping`, `/api/test-rate-limit`, and `/api/proxy-image`. These use a `getCorsHeaders()` helper from `@/lib/cors`. The proxy-image route uses `Access-Control-Allow-Origin: *` which is acceptable since it only proxies images from an allowlisted domain.

Most routes rely on Next.js default same-origin policy, which is correct.

---

### L2. Stripe Webhook Idempotency

**Status**: PASS

The Stripe webhook handler (`/api/webhooks/stripe/route.ts`) has idempotency checks:
- Line 159: Checks if order already exists before creating
- Line 669: Handles UNIQUE constraint violations gracefully

---

### L3. File Upload Security

**Status**: PASS (with exceptions noted in C2)

- `profile/avatar`: Validates type (`image/*`), size (2MB), resizes to 256x256 WebP, rate limited
- `reviews/upload-photos`: Validates type (`image/*`), size (5MB), count (max 3), but **NO AUTH** (C2)
- `admin/designs/upload`: Validates type (PNG/JPG/SVG), size (10MB), requires `withPermission`

---

### L4. Deprecated/Dead Routes

**Status**: INFO
- `frontend/src/app/api/admin/seed-branded/route.ts` -- Deprecated, exports empty `{}`
- `frontend/src/app/api/admin/seed-hats/route.ts` -- Deprecated, exports empty `{}`
- `frontend/src/app/api/rag/verify-schema/route.ts` -- Returns 404 (stub)
- `frontend/src/app/api/admin/migrate/route.ts` -- Permanently disabled (returns 403)

**Recommended fix**: Remove these files or add a comment explaining they're kept for route registration purposes.

---

### L5. Test/Dev Endpoints Protected by NODE_ENV

**Status**: PASS

Several endpoints correctly check `process.env.NODE_ENV === 'production'` and return 404:
- `/api/test-rate-limit`
- `/api/telegram/test-command`
- `/api/telegram/test-admin-status`
- `/api/marketing/test-ad-copy`
- `/api/ab-test/events` and `/api/ab-test/experiments/[id]`

---

### L6. Auth Pattern Inconsistency in Admin

**Status**: WARN

The admin app uses three different auth patterns:
1. `withAuth` -- iron-session based middleware wrapper
2. `withPermission` -- RBAC middleware (includes auth check)
3. `requireAuth` -- standalone function (used in `orders/route.ts`, `dashboard/stats`)
4. `getAdminSession` -- manual session check (used in `designs/route.ts`, `designs/mapping/route.ts`)

This inconsistency makes it harder to audit and could lead to auth bypasses if the wrong pattern is used.

**Recommended fix**: Standardize on `withAuth`/`withPermission` for all admin routes.

---

## 6. Webhook Security Summary

| Webhook | Signature Verification | Idempotency | Status |
|---------|----------------------|-------------|--------|
| Stripe (`/webhooks/stripe`) | `constructEvent()` with HMAC | Order existence check + UNIQUE constraint | PASS |
| POD Provider (`/webhooks/pod/[provider]`) | Provider-specific (HMAC/secret) | Audit log + dedup via `processed_events` | PASS |
| Telegram (`/webhooks/telegram`) | None visible | None | **FAIL** |
| WhatsApp (`/webhooks/whatsapp`) | None visible | None | **FAIL** |
| Cache Invalidate (`/webhooks/cache-invalidate`) | None | None | **FAIL** |

---

## 7. Inter-Service Communication

| Path | Auth Method | Status |
|------|-------------|--------|
| Frontend crons -> API | `CRON_SECRET` via Bearer token (timing-safe verify) | PASS |
| Admin -> PodClaw Bridge | `PODCLAW_BRIDGE_AUTH_TOKEN` via Bearer token | PASS |
| Admin -> Frontend (sitemap proxy) | No auth on proxy call | **FAIL** |
| Frontend Revalidation | `REVALIDATION_SECRET` or `CRON_SECRET` | PASS |

---

## 8. Recommendations (Priority-Ordered)

### Immediate (P0) -- Fix within 24 hours

1. **Add `sanitizeForLike`/`sanitizeForPostgrest` to all admin `.or()` queries** (C1)
   - Files: `admin/orders/route.ts`, `admin/search/route.ts`, `admin/products/route.ts`, `admin/designs/route.ts`
   - Import from `@/lib/query-sanitizer` (already exists in frontend)

2. **Add auth to `/api/reviews/upload-photos`** (C2)
   - Add `requireAuth` guard
   - Add per-user rate limiter

3. **Fix reset-password to use user's access token** (C3)
   - Replace `supabaseAdmin.auth.updateUser` with user-scoped client
   - Add rate limiting

4. **Add rate limiting to admin change-password** (C4)
   - Reuse `adminLoginLimiter` pattern

5. **Add auth to `/api/metrics`** (C5)
   - Add `verifyCronSecret` or move behind internal network

6. **Add auth to `/api/newsletter/drip-sequence-docs`** (C6)
   - Add `requireAdmin` guard

7. **Add auth to admin `brand-config` GET** (C7)
   - Wrap with `withAuth`

### Short-term (P1) -- Fix within 1 week

8. **Sanitize all error responses** -- Replace `error.message` leaks with generic messages (H1)
9. **Add rate limiting to checkout** (H2)
10. **Add signature verification to Telegram/WhatsApp webhooks** (H3)
11. **Add auth to admin legal-settings GET or move to frontend** (H4)
12. **Add auth to admin sitemap proxy call** (inter-service)

### Medium-term (P2) -- Fix within 1 month

13. **Migrate all POST routes to Zod validation** (M1)
14. **Add rate limiting to remaining sensitive routes** (M2)
15. **Fix email enumeration in register/login** (M3, M5)
16. **Add `Cache-Control: private, no-store` to authenticated responses** (M4)
17. **Standardize admin auth patterns** (L6)

### Low-priority (P3) -- Fix when convenient

18. Remove deprecated route files (L4)
19. Document CORS policy

---

## Appendix: Auth Middleware Reference

### Frontend Auth Patterns
- `requireAuth(req)` -- Extracts user from `sb-access-token` cookie via `supabaseAdmin.auth.getUser()`. Throws on failure.
- `getAuthUser(req)` -- Same as `requireAuth` but returns `null` instead of throwing.
- `requireAdmin(req)` -- Calls `requireAuth` then checks `role === 'admin'` in users table.
- `verifyCronSecret(header, secret)` -- Timing-safe comparison of Bearer token against `CRON_SECRET`.

### Admin Auth Patterns
- `withAuth(handler)` -- HOC that validates `iron-session` cookie, passes `session` to handler.
- `withPermission(resource, action, handler)` -- HOC that validates session + RBAC permissions.
- `requireAuth()` -- Reads iron-session from cookies, returns `{ authenticated, session, response }`.
- `getAdminSession()` -- Direct iron-session read, returns session or null.

---

*Generated: 2026-03-07 | Auditor: Claude Opus 4.6 | Scope: 201 API routes across frontend + admin*
