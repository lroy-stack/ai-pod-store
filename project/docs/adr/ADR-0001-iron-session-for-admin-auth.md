# ADR-0001: Use iron-session for Admin Panel Authentication

## Status

Accepted

## Context

The POD AI platform has two distinct user-facing applications:
1. **Frontend storefront** (`/frontend`) - Customer-facing e-commerce site requiring Supabase Auth for user accounts, order tracking, and chat history persistence
2. **Admin panel** (`/admin`) - Internal management interface for store operations, agent monitoring, and system configuration

Initially, we considered using Supabase Auth for both applications to maintain consistency. However, the admin panel has fundamentally different authentication requirements:

- **Single user model**: Admin is designed for a small, trusted team (1-5 users), not thousands of customers
- **Separate user table**: Admin users need different permissions, roles, and metadata than storefront customers
- **Session persistence**: Admin sessions need to survive across deployments and container restarts
- **Security isolation**: Admin authentication should be completely independent from customer auth to prevent cross-contamination attacks
- **Custom bcrypt workflow**: Admin already uses bcrypt for password hashing directly in the `users` table (distinct from Supabase's auth.users)

## Decision

We will use **iron-session** for admin panel authentication instead of Supabase Auth.

**Implementation details**:
- Admin users are stored in the public `users` table with `role = 'admin'`
- Passwords are hashed with bcrypt (10 rounds)
- Sessions use encrypted, signed cookies via iron-session with 24-hour expiration
- Session data includes: `userId`, `email`, `role`, `isLoggedIn`
- All admin API routes (except `/api/auth/login` and `/api/health`) validate the session cookie
- Admin login is rate-limited to 5 attempts per 15 minutes per IP

**Why iron-session**:
- Stateless, cryptographically signed cookies - no database lookups per request
- Works seamlessly with Next.js middleware and API routes
- Simple mental model: if cookie is valid and not expired, user is authenticated
- No dependency on Supabase Auth infrastructure
- Built-in CSRF protection via SameSite cookies

## Consequences

**Positive**:
- ✅ **Complete separation of concerns**: Admin auth is independent from Supabase, reducing attack surface
- ✅ **Better performance**: No auth database queries per request - session validation is CPU-bound (HMAC verification)
- ✅ **Simpler debugging**: Session issues are self-contained in cookie inspection, not distributed across Supabase and app state
- ✅ **Custom user model**: Can add admin-specific fields (e.g., `last_login_ip`, `mfa_enabled`) without polluting Supabase auth.users
- ✅ **Portable**: Admin panel could be extracted to a separate repository without Supabase dependency

**Negative**:
- ❌ **Two auth systems to maintain**: Frontend uses Supabase Auth, admin uses iron-session - developers must remember which context they're in
- ❌ **No built-in MFA**: Supabase Auth has TOTP MFA out-of-the-box; iron-session requires custom implementation
- ❌ **Manual session invalidation**: Cannot revoke all sessions for a user without tracking session IDs in the database
- ❌ **Cookie size limits**: Session data is stored in the cookie (max 4KB), not server-side

**Mitigations**:
- Document both auth systems clearly in README and CLAUDE.md
- Use consistent naming: `getSession()` (admin) vs `getUser()` (frontend)
- Consider adding a server-side session store (Redis) if MFA or session revocation becomes necessary
- Keep session payloads minimal (user ID, email, role only)

## References

- iron-session: https://github.com/vvo/iron-session
- Admin auth implementation: `admin/src/lib/session.ts`
- Session validation middleware: `admin/src/middleware.ts`
