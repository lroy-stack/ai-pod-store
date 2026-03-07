---
name: Audit Admin
description: >
  Comprehensive audit of the admin panel (Next.js on /panel). Use when asked to audit, review,
  or assess the admin — covering RBAC, permission guards, API auth, data isolation, audit
  logging, session management, and operational security.
---

# Audit Admin

Systematic audit of `admin/` — the Next.js 16 admin panel with iron-session auth, RBAC, and Supabase admin client.

## Prerequisites

- Read `admin/src/lib/auth.ts` and `admin/src/lib/auth-middleware.ts` for session/auth
- Read `admin/src/lib/rbac.ts` for role-based access control
- Read `admin/src/lib/supabase.ts` and `admin/src/lib/supabase-admin.ts` for DB clients
- Read `admin/next.config.ts` for basePath, CSP, security headers

## Workflow

### Phase 1: Authentication & Session Security

1. **Session mechanism**:
   - How are admin sessions created? (iron-session, JWT, cookies?)
   - Are session cookies httpOnly, secure, sameSite=strict?
   - What is the session TTL? Is it configurable?
   - Is there session rotation on privilege change?

2. **Login security**:
   - Is there brute force protection (rate limiting, lockout)?
   - Are passwords hashed with bcrypt/argon2 (not MD5/SHA)?
   - Is there a default admin password in migrations? → CRITICAL
   - Is MFA available or planned?

3. **Logout & session invalidation**:
   - Does logout destroy the server-side session?
   - Are expired sessions cleaned up?
   - Can sessions be revoked remotely?

### Phase 2: RBAC & Permission Guards

4. **Role definitions**:
   - What roles exist? (super_admin, admin, editor, viewer?)
   - Where are roles defined and stored?
   - Can roles be modified at runtime?

5. **Permission enforcement**:
   - Read ALL files under `admin/src/app/api/` — does every route use `withPermission()` or `withAuth()`?
   - List any unprotected API routes → CRITICAL
   - Check if permission checks are at the route level (good) or component level (fragile)
   - Verify RBAC is enforced server-side, not just UI-hidden

6. **UI vs API consistency**:
   - Are there UI elements hidden by role but the API still accessible?
   - Can a viewer role call admin-only API endpoints directly?
   - Test: remove `withPermission` mentally — what breaks?

### Phase 3: Data Access & Isolation

7. **Supabase client usage**:
   - Does admin use `supabaseAdmin` (service role, bypasses RLS)?
   - Is this justified? Admin panels typically need RLS bypass
   - Are there any client-side Supabase calls that should be server-side?

8. **Data exposure**:
   - Do product list endpoints expose all products (correct for admin)?
   - Do customer endpoints expose sensitive data (emails, addresses)?
   - Is customer PII properly handled (no logging, no caching)?
   - Are API responses filtered to only necessary fields?

9. **Audit logging**:
   - Is there an audit log for admin actions? (`logUpdate`, `logDelete`, etc.)
   - What actions are logged? (product changes, order updates, user changes?)
   - Where are audit logs stored? Are they tamper-resistant?
   - Can admins delete their own audit logs? → CRITICAL if yes

### Phase 4: API Route Security

10. **Input validation**:
    - Do all POST/PATCH routes use Zod schemas (`withValidation`)?
    - Are there any routes accepting unvalidated user input?
    - Check for SQL injection vectors (raw queries, string interpolation)
    - Check for XSS in admin-rendered content

11. **CORS & CSP**:
    - Is CORS configured correctly? (admin should not accept cross-origin requests)
    - Review CSP headers — are they restrictive enough?
    - Check `frame-ancestors` — should be `'none'` for admin

12. **Rate limiting**:
    - Are API routes rate-limited?
    - Is there protection against automated data extraction?
    - Check for missing rate limits on auth endpoints

### Phase 5: Operational Security

13. **Error handling**:
    - Do error responses leak internal details (stack traces, DB schema)?
    - Is there a global error boundary?
    - Are errors logged server-side with appropriate detail?

14. **Dependencies**:
    - Are there known vulnerabilities in dependencies? (`npm audit`)
    - Is the Node.js version up to date?
    - Are there unused dependencies that increase attack surface?

15. **Configuration**:
    - Are secrets properly loaded from env vars (not hardcoded)?
    - Is the `basePath` correctly enforced?
    - Is standalone output mode working for Docker deployment?

## Output Format

Generate `AUDIT_ADMIN_[DATE].md` at workspace root with:

```markdown
# Admin Panel Audit — [DATE]

## Summary
- Total checks: X
- PASS: X | WARN: X | FAIL: X | CRITICAL: X

## Critical Findings
[Security vulnerabilities, auth bypasses, data exposure]

## Warnings
[Sub-optimal patterns, missing best practices]

## Pass
[Confirmed secure patterns]

## Recommendations
[Ordered by priority — security first, then quality]
```
