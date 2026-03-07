---
name: Audit Admin Production
description: >
  Comprehensive audit of the SKAPARA admin panel for production readiness. Use when asked to
  audit the admin, review admin security, assess admin CRUD operations, or verify the admin panel
  is ready for production. Covers iron-session auth, RBAC, product/order/customer/design management,
  SSE real-time updates, bulk operations, data validation, and responsive admin UI.
  Admin is at project/admin/ (separate Next.js app).
---

# Audit Admin Panel — Production Readiness

Systematic audit of `admin/` — the SKAPARA admin panel built with Next.js, iron-session auth,
and Supabase service-role client. This is the internal tool for managing the store.

## Prerequisites

- Read `CLAUDE.md` for architecture overview
- Read `admin/src/lib/` for auth, session, Supabase, and utility libraries
- Read `admin/src/app/api/` for all API routes
- Read `admin/src/app/(dashboard)/` for all dashboard pages
- Note: admin uses its OWN auth system (iron-session + bcrypt), NOT Supabase Auth

## Workflow

### Phase 1: Authentication & Session Security

1. **Auth system audit**:
   - Read `admin/src/lib/session.ts` — iron-session configuration
   - Check: session cookie name, httpOnly, secure, sameSite, maxAge
   - Check: is `IRON_SESSION_PASSWORD` strong enough? (min 32 chars)
   - Check: is the password in env vars or hardcoded? → CRITICAL if hardcoded
   - Read `admin/src/app/api/auth/login/route.ts` — login flow
   - Read `admin/src/app/api/auth/logout/route.ts` — logout flow

2. **Password security**:
   - How are admin passwords stored? (bcrypt hash? which cost factor?)
   - Minimum password requirements (length, complexity)
   - Read `admin/src/app/api/auth/change-password/route.ts`
   - Is there rate limiting on login attempts?
   - Is there account lockout after failed attempts?
   - Is `must_change_password` flag enforced?

3. **Session management**:
   - How long do sessions last? (check maxAge)
   - Is there session invalidation on password change?
   - Can multiple sessions exist simultaneously?
   - Is there a "remember me" option?
   - Check: is session data validated on each request?

4. **Auth middleware**:
   - Read `admin/src/lib/auth-middleware.ts` or equivalent
   - Is `withAuth()` wrapper applied to ALL API routes?
   - Search for API routes WITHOUT auth check → list them ALL
   - Check: can any dashboard page be accessed without login?
   - Read `admin/src/middleware.ts` — does it protect all routes?

### Phase 2: RBAC & Authorization

5. **Role system**:
   - What roles exist in the admin? (admin, editor, viewer?)
   - Where is the role defined? (users table? separate roles table?)
   - Is role checked on each request or only at login?
   - Can a non-admin user access admin features? (role escalation)
   - Check: are there role-specific UI restrictions?

6. **Permission granularity**:
   - Can roles be customized per resource? (e.g., view orders but not delete)
   - Is there an audit log of admin actions?
   - Who can create/delete admin users?
   - Can an admin change their own role? (self-escalation)

### Phase 3: CRUD Operations

7. **Products management**:
   - Read `admin/src/app/(dashboard)/products/page.tsx` and related routes
   - CRUD: create, read, update, delete products
   - Printful sync: how does admin trigger/view synced products?
   - Bulk operations: bulk edit prices, bulk delete, bulk status change
   - Product variants management
   - Image management: upload, reorder, delete
   - Check: data validation on product forms (required fields, price >= 0)

8. **Orders management**:
   - Read `admin/src/app/(dashboard)/orders/` and API routes
   - Order listing: filters, search, pagination
   - Order detail: items, customer info, shipping, payment status
   - Order status updates (processing → shipped → delivered)
   - Refund/cancellation handling
   - Check: can admin modify order after payment? (data integrity)

9. **Customers management**:
   - Read `admin/src/app/(dashboard)/customers/` and API routes
   - Customer listing, search, filtering
   - Customer detail: orders, profile, activity
   - Customer export (CSV/Excel)
   - GDPR: can admin delete customer data?
   - Check: is customer PII handled properly?

10. **Designs management**:
    - How does admin view/manage user-generated designs?
    - Design approval/moderation workflow
    - Design-to-product assignment
    - Bulk design operations
    - Storage management (Supabase storage)

### Phase 4: Dashboard & Analytics

11. **Dashboard overview**:
    - Read `admin/src/app/(dashboard)/page.tsx` (main dashboard)
    - What metrics are shown? (revenue, orders, customers, products)
    - Are metrics real-time or cached? (SSE updates?)
    - Date range filtering
    - Chart/graph components
    - Check: is data aggregation done client-side or server-side?

12. **SSE real-time updates**:
    - Read `admin/src/components/providers/SSEProvider.tsx`
    - What events are streamed? (new orders, stock alerts, etc.)
    - Is there only ONE EventSource connection? (check for duplicates)
    - Error handling: reconnection on disconnect?
    - Authentication: is SSE endpoint protected?
    - Check: notification system connected to SSE

### Phase 5: Data Validation & Error Handling

13. **Form validation**:
    - Are ALL admin forms validated? (client-side AND server-side)
    - What validation library? (Zod, yup, manual?)
    - Check each major form:
      - Product create/edit form
      - Customer create/edit form
      - Order status update form
      - Settings forms
    - Are error messages user-friendly?

14. **API error handling**:
    - Read ALL API routes under `admin/src/app/api/`
    - Do catch blocks return generic errors in production? (no error.message leak)
    - Are 500 errors logged server-side?
    - HTTP status codes: correct usage (400, 401, 403, 404, 500)?
    - Are there any uncaught promise rejections?

15. **Data integrity**:
    - SQL injection prevention (Supabase client parameterizes, but check `.or()` calls)
    - Mass assignment: are update payloads validated? (no arbitrary field updates)
    - Cascade deletes: what happens when a product is deleted? (orders referencing it?)
    - Optimistic locking: can two admins edit the same record simultaneously?

### Phase 6: UI & Responsiveness

16. **Admin UI quality**:
    - Component library: shadcn/ui? custom? consistent?
    - Layout: sidebar + main content pattern?
    - Navigation: clear hierarchy, breadcrumbs?
    - Loading states: skeletons, spinners?
    - Empty states: helpful messages?
    - Dark mode support?

17. **Responsive admin**:
    - Does admin work on tablet? (768px+)
    - Is admin usable on mobile? (375px) — at least for critical actions
    - Sidebar: collapsible on small screens?
    - Tables: horizontal scroll or responsive layout?
    - Forms: proper layout on small screens?

18. **Bulk operations**:
    - Bulk price editor: read `products/bulk-price-editor/page.tsx`
    - Bulk product selection: select all, select page, individual
    - Bulk delete: confirmation dialog? undo?
    - Export: CSV, Excel, PDF generation
    - Import: CSV upload with validation?

### Phase 7: Production Hardening

19. **Environment & config**:
    - Read `admin/next.config.ts` — any security headers?
    - Check for hardcoded secrets in source code
    - Environment variables: all documented? validated at startup?
    - Build: does `npm run build` succeed without errors?

20. **Performance**:
    - Large data sets: how does admin handle 1000+ products? pagination?
    - API response times: any slow queries?
    - Client bundle size: code splitting?
    - Image optimization in admin

21. **Logging & monitoring**:
    - Admin action audit log: who did what when?
    - Error logging: where do errors go? (console only? external service?)
    - Health check endpoint for admin?
    - Session activity tracking

## Output Format

Write the report to `audit-ecommerce-2026-03-07/09-admin-production.md` (or the directory specified by the user):

```markdown
# SKAPARA Admin Panel Audit — [DATE]

## Executive Summary
[2-3 sentences: admin production readiness, critical blockers, overall quality]

## Findings

### Phase 1: Authentication & Session Security
| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| ADM-01 | ... | CRITICAL/HIGH/MEDIUM/LOW | path:line | ... |

### Phase 2: RBAC & Authorization
...

### Phase 3: CRUD Operations
...

### Phase 4: Dashboard & Analytics
...

### Phase 5: Data Validation & Error Handling
...

### Phase 6: UI & Responsiveness
...

### Phase 7: Production Hardening
...

## Auth Security Checklist
| Check | Status | Notes |
|-------|--------|-------|
| iron-session password in env | OK/FAIL | ... |
| httpOnly cookie | OK/FAIL | ... |
| Login rate limiting | OK/FAIL | ... |
| All routes protected | OK/FAIL | X routes unprotected |
...

## API Route Coverage
| Route | Auth | Validation | Error Handling | Notes |
|-------|------|------------|----------------|-------|
| POST /api/auth/login | N/A | YES/NO | YES/NO | ... |
| GET /api/products | YES/NO | YES/NO | YES/NO | ... |
...

## Scorecard
| Category | Score /10 | Notes |
|----------|-----------|-------|
| Auth & Security | X | ... |
| RBAC | X | ... |
| CRUD Quality | X | ... |
| Dashboard | X | ... |
| Data Validation | X | ... |
| UI Quality | X | ... |
| Production Readiness | X | ... |

## Priority Action Items
1. [P0] ...
2. [P1] ...
3. [P2] ...
```

## Severity Levels

- **CRITICAL**: Auth bypass, unprotected routes, session hijack, data leakage → blocks production
- **HIGH**: Missing validation, error leaks, broken CRUD, no rate limiting → must fix
- **MEDIUM**: UI inconsistencies, missing loading states, no audit log → should fix
- **LOW**: Polish, nice-to-have features, minor UX improvements
