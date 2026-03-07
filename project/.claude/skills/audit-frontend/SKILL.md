---
name: Audit Frontend
description: >
  Comprehensive audit of the Next.js frontend storefront. Use when asked to audit, review, or
  assess the frontend app — covering multi-tenancy user isolation, auth flows, i18n, state
  management, component quality, routing, performance, accessibility, and security.
---

# Audit Frontend

Systematic audit of `frontend/` — the Next.js 16 storefront with React 19, Tailwind v4, shadcn/ui, next-intl, and AI SDK.

## Prerequisites

- Read `CLAUDE.md` for architecture overview (route groups, component standards, semantic tokens)
- Read `frontend/src/app/[locale]/` to understand the route group structure
- Read `frontend/src/lib/` for client libraries (supabase, auth, cart, store-config)

## Workflow

### Phase 1: Authentication & Session Isolation

1. **Auth flow audit**:
   - Read `frontend/src/lib/supabase.ts`, `supabase-server.ts`, `supabase-admin.ts`
   - Verify anon client uses `NEXT_PUBLIC_*` keys only
   - Verify server client extracts user Bearer token from request headers
   - Verify admin client is NEVER imported in client components
   - Check: Is `supabase-admin.ts` imported anywhere in `src/app/` client components? → CRITICAL if yes

2. **Session management**:
   - Check how user sessions are created and validated
   - Verify session tokens are httpOnly, secure, sameSite
   - Check for session fixation vulnerabilities
   - Verify logout clears all session data

3. **User data isolation**:
   - Search for `.from('orders')` calls — do ALL include `.eq('user_id', userId)`?
   - Search for `.from('wishlists')` — same check
   - Search for `.from('profiles')` — same check
   - Any query without user_id filter on user-scoped tables → CRITICAL

### Phase 2: Route & Layout Architecture

4. **Route group structure**:
   - Verify `(landing)/page.tsx` exists and is the root page
   - Verify `(app)/` has NO `page.tsx` (must not exist)
   - Verify `(focused)/` contains only auth and checkout flows
   - Check that all pages under `(app)/` use StorefrontLayout

5. **Protected routes**:
   - Which routes require authentication?
   - Is there middleware or layout-level auth guards?
   - Can unauthenticated users access `/orders`, `/profile`, `/wishlist`?
   - Check for auth bypass via direct URL navigation

6. **i18n isolation**:
   - Verify `[locale]` param is validated against allowed locales (en, es, de)
   - Check for locale injection attacks (e.g., `/../admin/` as locale)
   - Verify translations load correctly for all 3 locales

### Phase 3: State Management & Data Flow

7. **Client state**:
   - Audit CartProvider — is cart scoped per user?
   - Check if cart persists across sessions correctly
   - Verify no cross-user state leakage in React context providers

8. **Server components vs client components**:
   - Are data-fetching components properly marked as server components?
   - Is sensitive data (API keys, service keys) ever exposed to client bundles?
   - Search for `SUPABASE_SERVICE_KEY` in any file under `src/` that uses `"use client"`

9. **API route security**:
   - Read all files under `frontend/src/app/api/`
   - Does every mutating endpoint (POST/PATCH/DELETE) validate auth?
   - Are there any endpoints that bypass RLS?
   - Check for mass assignment vulnerabilities in update endpoints

### Phase 4: Component Quality & Standards

10. **shadcn/ui compliance**:
    - Search for raw HTML elements that should use shadcn/ui (see CLAUDE.md mapping)
    - Search for prohibited color tokens: `bg-blue-`, `bg-gray-`, `bg-white`, `text-gray-`
    - Verify `cn()` is used for conditional class merging

11. **Mobile-first responsive**:
    - Check key pages for mobile-first patterns (base → md: → lg:)
    - Verify touch targets are minimum `p-3` (44px)
    - Check Sheet/Drawer usage on mobile vs full layout on desktop

12. **Accessibility (a11y)**:
    - Check for missing `alt` attributes on images
    - Verify form labels are associated with inputs
    - Check for keyboard navigation support
    - Verify ARIA attributes on interactive components

### Phase 5: Performance & Security

13. **Image optimization**:
    - Are product images using `next/image` with proper sizing?
    - Check for `unoptimized` prop usage — justified or lazy?
    - Verify external image domains in `next.config.ts`

14. **Bundle security**:
    - Search for hardcoded secrets or API keys in client code
    - Check CSP headers in `next.config.ts`
    - Verify no `dangerouslySetInnerHTML` without sanitization
    - Check `react-markdown` usage for XSS vectors

15. **Chat/AI isolation**:
    - Verify chat history is scoped per user
    - Check AI SDK streaming responses don't leak between users
    - Verify conversation memory is user-isolated

## Output Format

Generate `AUDIT_FRONTEND_[DATE].md` at workspace root with:

```markdown
# Frontend Audit — [DATE]

## Summary
- Total checks: X
- PASS: X | WARN: X | FAIL: X | CRITICAL: X

## Critical Findings
[List any CRITICAL issues — these block production]

## Warnings
[List WARN items — should fix before production]

## Pass
[List passing checks — brief confirmation]

## Recommendations
[Ordered by priority]
```

Severity levels:
- **CRITICAL**: Security vulnerability, data leakage, auth bypass → blocks production
- **FAIL**: Broken functionality, missing validation → must fix
- **WARN**: Sub-optimal pattern, missing best practice → should fix
- **PASS**: Meets standards
