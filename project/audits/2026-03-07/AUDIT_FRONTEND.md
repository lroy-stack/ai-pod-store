# Frontend Audit -- 2026-03-07

**Scope**: SKAPARA POD AI Store frontend (`frontend/`)
**Stack**: Next.js 16.1.6, React 19.2, Tailwind v4, shadcn/ui, next-intl, AI SDK 6, Supabase
**Files scanned**: 154 components, 143 API routes, 3 locale files, 60+ lib modules

---

## Summary

| Category | PASS | WARN | FAIL | CRITICAL |
|---|---|---|---|---|
| Architecture | 7 | 1 | 0 | 0 |
| Authentication & Authorization | 5 | 2 | 1 | 1 |
| Security | 8 | 2 | 1 | 0 |
| Data Fetching | 4 | 1 | 0 | 0 |
| i18n | 4 | 0 | 0 | 0 |
| Performance | 5 | 2 | 0 | 0 |
| Accessibility | 3 | 2 | 0 | 0 |
| Error Handling | 4 | 1 | 0 | 0 |
| Forms | 4 | 1 | 0 | 0 |
| SEO | 5 | 1 | 0 | 0 |
| Component Quality | 5 | 0 | 0 | 0 |
| Dependencies | 2 | 1 | 1 | 0 |
| **Total** | **56** | **14** | **3** | **1** |

---

## Critical Findings

### [CRITICAL] C-1: Session tokens exposed in login response body

**File**: `src/app/api/auth/login/route.ts:108-110`

The login API returns `access_token` and `refresh_token` in the JSON response body alongside setting httpOnly cookies. This means:
- XSS on any page can read tokens from the login response stored in JavaScript variables
- Tokens may be cached in browser history, dev tools Network tab, or logging middleware
- The httpOnly cookie approach is correct, but the body exposure undermines it

```typescript
session: {
  access_token: authData.session.access_token,
  refresh_token: authData.session.refresh_token,
  expires_at: authData.session.expires_at,
},
```

**Severity**: P0 Critical
**Fix**: Remove `session.access_token` and `session.refresh_token` from the response body. The client should rely solely on httpOnly cookies for auth. Return only `session.expires_at` if needed.

---

## Failures (FAIL)

### [FAIL] F-1: Profile API routes use inconsistent auth pattern

**Files**:
- `src/app/api/profile/avatar/route.ts:29-36`
- `src/app/api/profile/delete/route.ts:21-27`
- `src/app/api/profile/export/route.ts:9-19`
- `src/app/api/profile/change-password/route.ts:12-21`
- `src/app/api/profile/change-email/route.ts`
- `src/app/api/profile/cancel-deletion/route.ts`
- `src/app/api/profile/payment-methods/route.ts`

All profile routes implement their own auth logic instead of using the centralized `requireAuth()` from `@/lib/auth-guard`. Most manually read `sb-access-token` cookie and call `supabaseAdmin.auth.getUser(token)`. This creates:
- Inconsistent behavior if `auth-guard.ts` is updated
- No `AuthUser` type with tier/role info
- Duplicated error handling patterns

**Severity**: P1 High
**Fix**: Refactor all profile routes to use `requireAuth(req)` from `@/lib/auth-guard`. The `getAccessToken()` function in auth-guard already reads the same cookie.

### [FAIL] F-2: npm audit reports 11 vulnerabilities (1 critical, 4 high)

**Source**: `npm audit` output

Vulnerable transitive dependencies:
- `tar` (via `@mapbox/node-pre-gyp` via `canvas`): 5 high-severity path traversal vulnerabilities
- `http-proxy-agent` (via `@tootallnate/once` via `canvas`): low severity
- Several moderate-severity issues in `canvas` dependency chain

**Severity**: P1 High
**Fix**: Run `npm audit fix`. If breaking changes, consider replacing `canvas` with an alternative for server-side image processing or pinning `tar` to a fixed version.

### [FAIL] F-3: Weak password policy

**File**: `src/app/api/auth/register/route.ts:44-45`

Minimum password length is only 6 characters. No requirements for:
- Uppercase/lowercase mix
- Numbers or special characters
- Check against common/breached passwords

**Severity**: P2 Medium
**Fix**: Increase minimum to 8+ characters. Add complexity validation (at minimum, reject passwords that match email or common patterns).

---

## Warnings

### Architecture

#### [WARN] A-1: Extra route groups beyond documented architecture

**Finding**: The codebase has `(editor)` and `(storefront)` route groups not documented in CLAUDE.md. The `(storefront)` directory appears empty. The `(editor)/design/[productId]/` route exists with its own layout.

**Files**:
- `src/app/[locale]/(editor)/layout.tsx`
- `src/app/[locale]/(storefront)/` (empty)

**Severity**: P3 Low
**Fix**: Remove empty `(storefront)` group. Document `(editor)` in CLAUDE.md architecture section.

### Authentication & Authorization

#### [WARN] B-1: Orders API uses service key instead of user-scoped client

**File**: `src/app/api/orders/route.ts:12-15`

```typescript
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
```

The orders API creates a module-level admin client (bypasses RLS) and manually adds `.eq('user_id', user.id)`. While the user filter is present, using service key means:
- A code change that removes the user filter would expose all orders
- RLS is the intended safety net, bypassed here

Same pattern in `src/app/api/orders/[id]/route.ts:12-15`.

**Severity**: P2 Medium
**Fix**: Use a user-scoped Supabase client (anon key + user JWT) so RLS enforces isolation even if code has bugs.

#### [WARN] B-2: `settings` route not protected

**Finding**: `/settings/billing` exists under `(app)` but `settings` is not in the `protectedRoutes` array in middleware.

**File**: `src/middleware.ts:17-21`

```typescript
const protectedRoutes = [
  '/profile',
  '/orders',
  '/wishlist',
]
```

Missing: `/settings`, `/designs`, `/referrals`.

**Severity**: P2 Medium
**Fix**: Add `/settings`, `/designs`, and `/referrals` to `protectedRoutes` in middleware.

### Security

#### [WARN] S-1: CSRF cookie name lacks `__Host-` prefix

**File**: `src/lib/csrf.ts:74`

The comment at line 67-73 describes using the `__Host-` prefix for additional security, but the actual cookie name is just `'csrf-token'`:

```typescript
export const CSRF_COOKIE_NAME = 'csrf-token'
```

The `__Host-` prefix prevents subdomain-based attacks and requires Secure flag.

**Severity**: P3 Low
**Fix**: In production, use `__Host-csrf-token` as the cookie name.

#### [WARN] S-2: In-memory rate limiting only (no shared state)

**File**: `src/lib/rate-limit.ts:1-10`

Rate limiting is per-instance (in-memory Map). In multi-instance deployments (multiple pods/containers), each instance has independent limits. An attacker can distribute requests across instances.

The file acknowledges this in comments (lines 7-10) and notes Supabase-backed usage limiter is the real enforcement, but burst protection is weakened.

**Severity**: P2 Medium
**Fix**: For production, use Redis-backed rate limiting. The project already has `ioredis` as a dependency and `src/lib/redis.ts`.

### Data Fetching

#### [WARN] D-1: Chat API conversation history uses admin client without per-user RLS

**File**: `src/app/api/chat/route.ts:52-55`

The chat route creates a service-role Supabase client at module level for product reads (acceptable), but also uses it for conversation creation. While the code manually scopes by user_id, RLS would be a better safety net.

The file does have `createUserScopedClient()` at line 62-68 which is used for some operations -- good practice, but not consistently applied.

**Severity**: P2 Medium
**Fix**: Ensure all conversation/message writes use the user-scoped client, not the admin client.

### Performance

#### [WARN] P-1: Only 8 loading.tsx files for ~20+ routes

**Finding**: Loading skeletons exist for:
- `checkout`, `profile`, `cart`, `orders`, `designs`, `shop`, `wishlist`, `design editor`

Missing for: `chat`, `blog`, `blog/[slug]`, `referrals`, `pricing`, `settings/billing`, `shop/[id]`, `shop/category/[slug]`

**Severity**: P3 Low
**Fix**: Add loading.tsx files for remaining routes, especially `shop/[id]` (product detail) and `blog/[slug]` which have data fetching.

#### [WARN] P-2: Only 4 files use `dynamic()` or `lazy()`

**Files**:
- `src/app/[locale]/(editor)/design/[productId]/DesignEditorClient.tsx`
- `src/components/landing/LandingPageClient.tsx`
- `src/components/storefront/StorefrontLayout.tsx`
- `src/components/auth/AuthBackground.tsx`

Heavy components like the Design Studio (fabric.js), ChatArea, and ProductDetailClient could benefit from dynamic imports to reduce initial bundle size.

**Severity**: P3 Low
**Fix**: Use `dynamic(() => import(...), { ssr: false })` for fabric.js components, chat area, and other heavy client-side components.

### Accessibility

#### [WARN] X-1: One empty alt attribute found

**File**: `src/components/shop/CategoryCard.tsx:74`

```tsx
<Image src={img} alt="" fill className="object-cover" sizes="40px" />
```

This is a category color swatch image that should have a descriptive alt text for screen readers.

**Severity**: P3 Low
**Fix**: Use `alt={colorName}` or appropriate descriptive text.

#### [WARN] X-2: Skip-to-content link only on landing layout

**File**: `src/app/[locale]/(landing)/layout.tsx:11-16`

The skip-to-main-content link only exists in the landing layout. The (app) layout (StorefrontLayout) and (focused) layout lack this accessibility feature.

**Severity**: P3 Low
**Fix**: Add skip-to-content links to StorefrontLayout and FocusedLayout.

### Error Handling

#### [WARN] E-1: Global error page not localized

**File**: `src/app/global-error.tsx`

The global error page has hardcoded English text ("Something went wrong", "An unexpected error occurred"). It doesn't use next-intl since it operates outside the locale layout.

**Severity**: P3 Low
**Fix**: Accept this as a limitation since global-error is a fallback. Consider adding a basic language detection from `navigator.language`.

### Forms

#### [WARN] FO-1: Only 12 of 143 API routes use Zod validation

**Files with Zod**: `chat`, `orders/returns`, `newsletter/subscribe`, `designs` (5 routes), `admin/returns`, `analytics/track`, `admin/designs/moderate`, `designs/mockup`, `designs/generate`

**Missing Zod in**: `auth/register`, `auth/login`, `reviews`, `consent`, `profile/*`, `shipping-addresses/*`, `push/subscribe`, `cart/*`, `checkout/*`

Many routes do manual `if (!field)` checks instead of schema validation.

**Severity**: P2 Medium
**Fix**: Standardize on Zod schemas for all API routes that accept request bodies. This provides type safety, consistent error messages, and defense against unexpected fields.

### SEO

#### [WARN] SE-1: Sitemap does not include product pages dynamically

**File**: `src/app/sitemap.ts`

The main sitemap only lists homepage URLs for 3 locales and chat pages plus references to locale-specific sitemaps. Individual product URLs are not included unless the locale-specific sitemaps (sitemap-en.xml, sitemap-es.xml, sitemap-de.xml) handle them -- these appear to be static files.

**Severity**: P2 Medium
**Fix**: Generate dynamic sitemaps that include all active product URLs (`/[locale]/shop/[id]`) and category pages. Use `src/app/api/admin/sitemap/route.ts` which already exists for admin sitemap generation.

### Dependencies

#### [WARN] DEP-1: `SUPABASE_ANON_KEY` (non-NEXT_PUBLIC) used in API routes

**Files**:
- `src/app/api/reviews/route.ts:8` -- `process.env.SUPABASE_ANON_KEY!`
- `src/app/api/auth/login/route.ts:7` -- `process.env.SUPABASE_ANON_KEY!`
- `src/app/api/profile/change-password/route.ts:7` -- `process.env.SUPABASE_ANON_KEY!`

The env var should be `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the only one typically set in .env.local). Using `SUPABASE_ANON_KEY` (without NEXT_PUBLIC prefix) requires a separate env var to be set, and will be `undefined` if only the public version is configured.

**Severity**: P2 Medium
**Fix**: Use `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` or ensure `SUPABASE_ANON_KEY` is set in the environment. The NEXT_PUBLIC version is safe to use in server code.

---

## Pass (Detailed)

### Architecture (7 PASS)

- **PASS**: Route group structure correct -- `(landing)/page.tsx` exists as root page
- **PASS**: `(app)` has NO `page.tsx` (verified)
- **PASS**: `(focused)` contains auth, checkout, and legal pages as expected
- **PASS**: `(app)/layout.tsx` wraps children with StorefrontLayout
- **PASS**: `[locale]` parameter validated via next-intl routing (locales: en, es, de)
- **PASS**: `output: 'standalone'` in next.config.ts for Docker deployment
- **PASS**: Middleware matcher correctly routes API and locale paths

### Authentication & Authorization (5 PASS)

- **PASS**: Protected routes (`/profile`, `/orders`, `/wishlist`) require JWT validation in middleware via `supabase.auth.getUser()` -- not just cookie presence check
- **PASS**: Session cookies (`sb-access-token`, `sb-refresh-token`) are httpOnly, secure in production, sameSite: lax
- **PASS**: All admin API routes use `requireAdmin()` guard (verified 8 routes under `/api/admin/`)
- **PASS**: All cron routes use `verifyCronSecret()` with timing-safe comparison (verified 11 routes)
- **PASS**: `supabaseAdmin` is never imported in any client component (only in `src/app/api/` and `src/lib/` server files)

### Security (8 PASS)

- **PASS**: CSP headers configured with `strict-dynamic` for script-src (Feature #36)
- **PASS**: Full security header suite: X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy
- **PASS**: CSRF protection via double-submit cookie pattern in middleware for all mutation requests
- **PASS**: CSRF validation skips webhooks (which have their own signature verification) and cron routes
- **PASS**: Stripe webhook signature verification via `stripe.webhooks.constructEvent()`
- **PASS**: `dangerouslySetInnerHTML` usage is either JSON-LD schema injection (safe -- JSON.stringify) or goes through `SafeHTML` component with DOMPurify sanitization
- **PASS**: `react-markdown` wrapped in `SafeMarkdown` component with DOMPurify
- **PASS**: Theme CSS injection in layout.tsx uses `sanitizeCSSValue()` function that rejects `<`, `>`, `script`, `javascript`, etc.
- **PASS**: Query sanitizer (`src/lib/query-sanitizer.ts`) protects PostgREST `.or()` queries from injection
- **PASS**: Proxy image endpoint (`/api/proxy-image`) restricts to allowlisted domains only
- **PASS**: CORS configuration restricts origins to known domains

### Data Fetching (4 PASS)

- **PASS**: Orders API scopes by `user_id` -- `src/app/api/orders/route.ts:42`
- **PASS**: Wishlists API scopes by `user_id` -- `src/app/api/wishlist/route.ts:41`
- **PASS**: Conversations API scopes by `user_id` -- `src/app/api/conversations/route.ts:16`
- **PASS**: Order detail API has ownership check -- `src/app/api/orders/[id]/route.ts:38-39`

### i18n (4 PASS)

- **PASS**: All 3 locale files exist and have identical structure (1491 keys each)
- **PASS**: Zero missing translation keys between en, es, and de
- **PASS**: Locale routing uses `localePrefix: 'always'` (URLs always contain locale)
- **PASS**: `generateStaticParams` generates all 3 locales for SSG

### Performance (5 PASS)

- **PASS**: All product images use `next/image` (18 files import it, zero raw `<img>` tags found)
- **PASS**: No `unoptimized` prop usage found
- **PASS**: Webpack chunk splitting configured (450KB max per chunk)
- **PASS**: `optimizePackageImports` for heavy packages (ai-sdk, supabase, lucide-react, react-markdown)
- **PASS**: Service worker configured via `@serwist/next` for PWA with offline support

### Accessibility (3 PASS)

- **PASS**: 51 `aria-label`/`aria-describedby`/`role` attributes across 25 component files
- **PASS**: 56 `htmlFor` attributes across 17 form component files (proper label association)
- **PASS**: Landing layout has skip-to-content link for keyboard navigation

### Error Handling (4 PASS)

- **PASS**: `global-error.tsx` exists as catch-all error boundary
- **PASS**: `not-found.tsx` exists at root level
- **PASS**: Error boundaries in all route groups (`(app)/error.tsx`, `(landing)/error.tsx`, `(focused)/error.tsx`, `[locale]/error.tsx`)
- **PASS**: `ErrorBoundary` component wraps `(focused)` children

### Forms (4 PASS)

- **PASS**: CSRF protection active for all POST/PUT/PATCH/DELETE API requests
- **PASS**: Turnstile CAPTCHA on register and login forms
- **PASS**: Rate limiting on auth routes (5/15min login, 3/60min register, 3/60min forgot-password)
- **PASS**: File upload validation in avatar route (size limit, type check, sharp resizing)

### SEO (5 PASS)

- **PASS**: Structured data (JSON-LD) on landing page (Organization, WebSite), product pages (Product), shop page (ItemList), blog posts (Article), category pages
- **PASS**: `robots.ts` disallows `/api/`, `/auth/`, `/checkout/`
- **PASS**: Open Graph and Twitter card metadata with localized titles/descriptions
- **PASS**: `hreflang` alternates for all 3 locales plus `x-default`
- **PASS**: PWA manifest with proper icons and metadata

### Component Quality (5 PASS)

- **PASS**: 358 imports from `@/components/ui/` across 142 files (strong shadcn/ui adoption)
- **PASS**: 61 files import `cn()` from `@/lib/utils` for conditional class merging
- **PASS**: Zero prohibited color tokens found (`bg-blue-*`, `bg-gray-*`, `text-gray-*`, `bg-white`, `bg-black`)
- **PASS**: Only 1 raw `<button>` found (in InstallPrompt.tsx) -- everything else uses `<Button>`
- **PASS**: Zero raw `<input>`, `<select>`, or `<textarea>` elements found outside `@/components/ui/`

### Dependencies (2 PASS)

- **PASS**: 28 shadcn/ui components installed
- **PASS**: All major dependencies are recent versions (Next.js 16.1.6, React 19.2, Supabase 2.45+)

---

## Recommendations (Priority-Ordered)

### P0 -- Blocks Production

1. **Remove session tokens from login response body** (C-1)
   - File: `src/app/api/auth/login/route.ts`
   - Remove `session.access_token` and `session.refresh_token` from JSON response
   - Client should use httpOnly cookies exclusively

### P1 -- Must Fix Before Production

2. **Standardize profile routes on centralized auth guard** (F-1)
   - 7 profile routes need refactoring to use `requireAuth()`
   - Effort: ~2 hours

3. **Fix npm vulnerabilities** (F-2)
   - Run `npm audit fix` or update `canvas` dependency
   - Consider `@napi-rs/canvas` as a native alternative to `canvas`

4. **Strengthen password policy** (F-3)
   - Minimum 8 characters, require at least 1 number and 1 special character
   - Effort: ~30 minutes

### P2 -- Should Fix

5. **Add missing routes to middleware protection** (B-2): `/settings`, `/designs`, `/referrals`
6. **Use Redis-backed rate limiting** (S-2) for production multi-instance deployment
7. **Standardize Zod validation** (FO-1) across all API routes accepting bodies
8. **Fix `SUPABASE_ANON_KEY` env var naming** (DEP-1) to use `NEXT_PUBLIC_SUPABASE_ANON_KEY`
9. **Generate dynamic product sitemaps** (SE-1) for better search engine indexing
10. **Use user-scoped Supabase clients** (B-1) in orders API instead of service key

### P3 -- Nice to Have

11. Remove empty `(storefront)` route group (A-1)
12. Add `__Host-` prefix to CSRF cookie (S-1)
13. Add loading.tsx for remaining routes (P-1)
14. Add dynamic imports for heavy components (P-2)
15. Fix empty alt text on category card image (X-1)
16. Add skip-to-content links to all layouts (X-2)
17. Localize global error page (E-1)

---

## Appendix: File Inventory

| Category | Count |
|---|---|
| Components (src/components/) | 154 |
| shadcn/ui components | 28 |
| API routes | 143 |
| Translation keys per locale | 1,491 |
| Loading skeletons | 8 |
| Error boundaries | 5 |
| Lib modules | 60+ |
| Protected routes (middleware) | 3 |
| Admin-guarded routes | 8 |
| Cron-secret-guarded routes | 11 |
