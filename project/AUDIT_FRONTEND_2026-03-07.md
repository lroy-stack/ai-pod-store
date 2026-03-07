# Frontend Audit -- 2026-03-07

## Summary
- Total checks: 20
- PASS: 11 | WARN: 4 | FAIL: 3 | CRITICAL: 2

---

## Critical Findings

### CRITICAL-1: Unauthenticated RAG/Admin Endpoints Expose Service-Key Operations

Multiple API routes under `/api/rag/` perform admin-level database operations (insert embeddings, install SQL functions, seed data, list all documents) with **zero authentication**:

| Route | Method | Impact |
|---|---|---|
| `/api/rag/add-documents` | POST | Insert arbitrary documents into vector store |
| `/api/rag/install-function` | POST | Execute DDL SQL (CREATE OR REPLACE FUNCTION) |
| `/api/rag/seed-products` | GET | Trigger bulk DB writes |
| `/api/rag/seed-embeddings` | POST | Trigger embedding generation + DB writes |
| `/api/rag/seed-faqs-policies` | GET | Trigger bulk DB writes |
| `/api/rag/list-all` | GET | Dump all RAG documents |
| `/api/rag/index` | POST/GET | Index documents, list indexes |
| `/api/rag/test-vector` | POST/GET | Test vector operations |
| `/api/rag/test-gemini` | POST/GET | Invoke Gemini API (cost) |

Similarly unprotected:
- `/api/test-db-schema` (GET) -- queries `information_schema.columns` with service key, no auth. File: `src/app/api/test-db-schema/route.ts:11`
- `/api/verify-schema` (GET) -- queries DB schema, executes arbitrary SQL via RPC with service key, no auth. File: `src/app/api/verify-schema/route.ts:9`
- `/api/marketing/content` (GET) -- reads marketing_content table with service key, no auth. File: `src/app/api/marketing/content/route.ts:7`
- `/api/marketing/test-ad-copy` (GET) -- uses service key, no auth.

**Risk**: Any external caller can invoke these endpoints to write data, execute SQL, consume API budget (Gemini), or enumerate internal schema. The CSRF middleware skips these on POST because they lack cookie-based auth to validate against.

**Recommendation**: Add `requireAdmin()` guard to all RAG/test/marketing endpoints, or gate behind `NODE_ENV !== 'production'` check (some test endpoints already do this, but the RAG ones do not).

---

### CRITICAL-2: Theme CSS Injection -- Stored XSS via Admin-Writable Database

File: `src/app/[locale]/layout.tsx:78`
```tsx
<style id="server-theme-style" dangerouslySetInnerHTML={{ __html: themeCSS }} />
```

The `themeCSS` string is built from `store_themes.css_variables` and `store_themes.css_variables_dark` JSONB columns in `src/lib/theme-server.ts:91-116`. The `themeToInlineCSS()` function interpolates raw values from the database into a CSS string with **no sanitization**:

```ts
const lightVars = Object.entries(theme.css_variables)
  .map(([key, value]) => `  --${key.replace(/_/g, '-')}: ${value};`)
  .join('\n');
```

If an admin (or attacker who compromises admin credentials) writes a malicious value like `red; } </style><script>alert(1)</script><style> .x {color: green` into `css_variables`, it would break out of the `<style>` tag and inject arbitrary HTML/JS.

**Risk**: Stored XSS affecting all visitors. Requires admin DB write access, but the admin panel and `/api/storefront/theme` route update these values.

**Recommendation**: Sanitize CSS variable values -- strip characters `<`, `>`, `"`, `'`, `;` (only allow CSS color/size tokens), or use a CSS sanitizer library.

---

## Warnings

### WARN-1: `/wishlist` Route Not Protected by Middleware Auth Guard

File: `src/middleware.ts:17-20`
```ts
const protectedRoutes = [
  '/profile',
  '/orders',
]
```

The `/wishlist` route is missing from `protectedRoutes`. While individual API endpoints (`/api/wishlist/*`) validate auth via cookies, the page itself at `/(app)/wishlist/` can be accessed by unauthenticated users without redirect to login. This results in a blank or error-prone experience rather than a clean redirect.

**Recommendation**: Add `'/wishlist'` to the `protectedRoutes` array.

---

### WARN-2: Order Detail API Fetches Before Ownership Check (IDOR Pattern)

File: `src/app/api/orders/[id]/route.ts:32-50`

The endpoint first fetches the order by ID with no `user_id` filter (using the service key which bypasses RLS), then checks ownership after:

```ts
const { data: order } = await supabase.from('orders').select('*').eq('id', id).single()
// ... then later:
if (order.user_id !== user.id && user.role !== 'admin') { ... }
```

While functionally correct (the unauthorized user gets 404), the full order row including sensitive data (`*`) is loaded into server memory before the check. The same pattern exists in `orders/[id]/invoice/route.ts:33-47`.

**Recommendation**: Add `.eq('user_id', user.id)` to the initial query (with an OR for admin), so RLS or query-level filtering prevents loading unauthorized data.

---

### WARN-3: Chat Route Uses Service Key for All Conversation/Message Writes

File: `src/app/api/chat/route.ts:52-55`

The chat endpoint creates a Supabase client with `SUPABASE_SERVICE_KEY` (bypasses RLS) and writes conversations/messages with `user_id` from the authenticated token or `null` for anonymous users. Since the service key bypasses RLS, any conversation record could theoretically be overwritten via `upsert` if the conversation ID is guessable (UUIDs, so low risk but architecturally wrong).

Lines `324-331`: Conversation upsert uses `onConflict: 'id'` with the service key, meaning an attacker who knows a conversation UUID could potentially overwrite another user's conversation metadata (title, session_id, locale).

**Recommendation**: Use the anon key with user's JWT for authenticated writes, or add `.eq('user_id', chatUserId)` guards on update operations.

---

### WARN-4: CSP Allows `unsafe-inline` for Scripts

File: `next.config.ts:126`
```
script-src 'self' 'unsafe-inline'
```

While `unsafe-eval` is correctly absent, `unsafe-inline` for scripts weakens CSP significantly. Combined with the theme CSS injection (CRITICAL-2), this could amplify XSS impact.

**Recommendation**: Migrate to nonce-based CSP for inline scripts (`script-src 'self' 'nonce-{random}'`) and remove `unsafe-inline`.

---

## Failures

### FAIL-1: Test/Debug Endpoints Accessible in Production

Several test endpoints rely on `NODE_ENV !== 'production'` checks, but others do not:

- `/api/test-db-schema` -- **NO production guard**, exposes DB schema. File: `src/app/api/test-db-schema/route.ts`
- `/api/verify-schema` -- **NO production guard**, can execute RPC SQL. File: `src/app/api/verify-schema/route.ts`
- `/api/newsletter/test-rate-limit` -- unknown guard status.
- `/api/test-rate-limit` -- unknown guard status.

Endpoints that DO have production guards (good):
- `/api/newsletter/test-drip` -- has `NODE_ENV === 'production'` check returning 404.
- `/api/telegram/test-command` -- has `NODE_ENV === 'production'` check returning 404.

**Recommendation**: Either add production guards or remove test endpoints before deployment.

---

### FAIL-2: Admin Migrate Endpoint Accepts Raw SQL

File: `src/app/api/admin/migrate/route.ts:22-29`

Despite requiring `requireAdmin()` and blocking in production (unless `ALLOW_ADMIN_MIGRATE` is set), this endpoint accepts arbitrary SQL and executes it via `supabaseAdmin.rpc('query', { query_text: sql })`. If the RPC function exists, this is a full SQL injection surface behind admin auth.

**Risk**: A compromised admin account has full database access. The `ALLOW_ADMIN_MIGRATE` env var override enables this in production.

**Recommendation**: Remove the `ALLOW_ADMIN_MIGRATE` override. Admin SQL execution should never be available via API in production.

---

### FAIL-3: Conversation DELETE Does Not Scope Final Delete by user_id

File: `src/app/api/conversations/[id]/route.ts:82-92`

The ownership check at line 71-76 correctly verifies `user_id`, but the subsequent delete operations at lines 84-92 delete by `conversation_id` and `id` only -- not by `user_id`:

```ts
await supabaseAdmin.from('messages').delete().eq('conversation_id', id)
await supabaseAdmin.from('conversations').delete().eq('id', id)
```

Since the service key bypasses RLS, a race condition between the ownership check and the delete could theoretically allow deletion of a conversation that was reassigned. Low probability but violates defense-in-depth.

**Recommendation**: Add `.eq('user_id', user.id)` to the delete query on conversations.

---

## Pass

1. **Supabase client separation** -- PASS. `supabase-admin.ts` is never imported in any client component (`src/components/`). All 107 files importing it are in `src/app/api/`, `src/lib/`, or `src/scripts/`. The admin client uses non-`NEXT_PUBLIC_` env vars (`SUPABASE_SERVICE_KEY`), which are not bundled into client code.

2. **Anon client configuration** -- PASS. `src/lib/supabase.ts` uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Session persistence and auto-refresh enabled. No service keys.

3. **Server client design** -- PASS. `src/lib/supabase-server.ts` extracts Bearer token from request headers and passes it to Supabase with the anon key. RLS is respected. Admin client function is separate and clearly documented.

4. **Orders API user isolation** -- PASS. `src/app/api/orders/route.ts:42` filters by `.eq('user_id', user.id)`. Auth enforced via `requireAuth()`.

5. **Wishlist API user isolation** -- PASS. All wishlist endpoints (`share`, `items`, `sync`, main `route.ts`) filter by `.eq('user_id', user.id)`.

6. **Conversation API user isolation** -- PASS. `src/app/api/conversations/route.ts:16` filters by `.eq('user_id', user.id)`. Individual conversation GET at `[id]/route.ts:22` verifies ownership.

7. **Middleware auth for protected routes** -- PASS. `src/middleware.ts:17-20` protects `/profile` and `/orders` with JWT validation via Supabase SSR client (not just cookie presence check). Redirects to login with `returnUrl`.

8. **CSRF protection** -- PASS. Middleware validates CSRF tokens on mutation requests (POST/PUT/PATCH/DELETE) for API routes. Webhooks, admin, and cron routes are correctly exempted (they use their own auth).

9. **Cron route auth** -- PASS. All 11 cron routes verify `CRON_SECRET` via `verifyCronSecret()` (timing-safe comparison in `src/lib/rate-limit.ts`).

10. **No secrets in client bundle** -- PASS. No `SUPABASE_SERVICE_KEY`, `PRINTFUL_API_TOKEN`, `STRIPE_SECRET`, `GEMINI_API_KEY`, or `RESEND_API_KEY` references found in `src/components/`.

11. **XSS protection** -- PASS (partial). `SafeHTML` component uses DOMPurify with strict tag/attribute allowlists. `SafeMarkdown` wraps react-markdown with DOMPurify. `dangerouslySetInnerHTML` usage in pages is limited to JSON-LD structured data (`application/ld+json` scripts) which is safe, and the theme CSS injection (see CRITICAL-2). Security headers include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, HSTS, and `frame-ancestors 'none'` in CSP.

---

## Recommendations (Priority Order)

1. **[P0] Gate all RAG endpoints** behind `requireAdmin()` or `NODE_ENV` production guard. These are the most exposed attack surface.

2. **[P0] Sanitize theme CSS values** in `themeToInlineCSS()` to prevent stored XSS via `dangerouslySetInnerHTML`. Validate values match `/^[a-zA-Z0-9#%(),.\s-]+$/` pattern.

3. **[P1] Remove or protect test/debug endpoints** (`test-db-schema`, `verify-schema`, `marketing/content`) before production deployment.

4. **[P1] Remove `ALLOW_ADMIN_MIGRATE`** env var escape hatch. No raw SQL execution in production.

5. **[P1] Add `/wishlist` to middleware `protectedRoutes`** array.

6. **[P2] Refactor order detail queries** to include `user_id` in the initial query rather than fetch-then-check pattern.

7. **[P2] Add `user_id` to conversation delete** queries for defense-in-depth.

8. **[P2] Migrate from `unsafe-inline` to nonce-based CSP** for scripts.

9. **[P3] Chat route**: Use user-scoped Supabase client for authenticated writes instead of service key.

10. **[P3] i18n**: `next-intl` routing validates locales via `defineRouting({ locales: ['en', 'es', 'de'] })` -- locale injection is handled by the library. No additional action needed.
