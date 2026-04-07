# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

**Email**: security@example.com
**Subject**: `[MCP-SERVER] Security Vulnerability Report`

Do NOT open a public GitHub issue for security vulnerabilities.

We will acknowledge receipt within 48 hours and provide a timeline for resolution within 5 business days.

## Security Model

### Authentication

- **OAuth 2.1** with mandatory PKCE (S256) — plain code challenge rejected
- **JWT access tokens** (HS256, 15-minute expiry) with issuer + audience validation
- **Refresh token rotation** with family-based replay detection
- **Token revocation** via dual Redis + in-memory blacklist (RFC 7009)
- **Client registry** with redirect URI allowlist — unknown clients rejected

### Authorization

- **3-layer auth enforcement**: JWT validation → `withAuth()` middleware → handler-level check
- **Scope enforcement**: `write` scope required for all mutation tools
- **IDOR protection**: 100% of protected tools (20/20) verify resource ownership via `user_id` filter
- **Context injection**: userId always extracted from JWT `sub` claim, never from client input

### Input Validation

- **Zod schemas** on all 32 tools with strict constraints
- **UUID format validation** for all entity IDs before database queries
- **Pagination limits** on all list endpoints (max 50)
- **SQL injection prevention** via Supabase parameterized queries
- **ILIKE wildcard sanitization** (`%`, `_`, `\` escaped before pattern matching)

### Content Safety (Prompt Injection Mitigation)

All user-generated content returned to LLM clients is wrapped with boundary markers:

```
[USER_CONTENT]user text here[/USER_CONTENT]
```

This helps LLM clients distinguish trusted system data from untrusted user input, reducing the risk of indirect prompt injection via review text, return reasons, or shipping addresses.

### Network Security

- **CORS allowlist** — only configured origins accepted
- **DNS rebinding prevention** — origin validation on MCP endpoint
- **Rate limiting** — per-tool and global, Redis-backed with fail-closed in-memory fallback
- **Body size limits** — 1MB (MCP), 4KB (OAuth approve), 16KB (OAuth token)
- **SSRF protection** on image downloads — HTTPS-only, private IP block, DNS rebinding check
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`

### Operational Security

- **Non-root Docker container** with minimal Alpine base
- **No secrets in responses** — generic error messages, no stack traces
- **Audit logging** with PII field sanitization
- **Graceful shutdown** on SIGTERM/SIGINT
- **Fail-fast in production** if critical URLs point to localhost

## Supported Versions

| Version | Supported |
|---|---|
| 1.x | Yes |

## Security Audit History

| Date | Scope | Findings | Status |
|---|---|---|---|
| 2026-03-18 | Full codebase (32 tools, auth, middleware) | 3 MEDIUM, 5 LOW | All remediated |

## Dependencies

We monitor dependencies for known vulnerabilities via `npm audit`. Key security-relevant dependencies:

- `jose` — JWT operations (no native crypto bindings, pure JS)
- `@supabase/supabase-js` — database access (parameterized queries)
- `stripe` — payment processing (PCI DSS compliant)
- `zod` — input validation (no code execution)
