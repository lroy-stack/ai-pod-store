---
name: Audit API
description: >
  Comprehensive audit of ALL API routes across frontend, admin, and mcp-server. Use when asked
  to audit APIs, review endpoints, or assess API security — covering auth middleware, input
  validation, rate limiting, error handling, CORS, and data exposure.
---

# Audit API

Systematic audit of every API route in the system: frontend (`/api/`), admin (`/panel/api/`), mcp-server (`/api/`), and PodClaw bridge (`/bridge/`).

## Prerequisites

- Read `frontend/src/app/api/` — all frontend API routes
- Read `admin/src/app/api/` — all admin API routes
- Read `mcp-server/src/` — MCP server routes if they exist
- Read `podclaw/bridge/api.py` — PodClaw FastAPI bridge

## Workflow

### Phase 1: Endpoint Inventory

1. **Catalog all endpoints**:
   - List every API route with HTTP method, path, auth requirement
   - Classify: public, authenticated, admin-only, service-internal
   - Format as table for easy review

2. **Auth middleware coverage**:
   - For each endpoint, identify which auth middleware is applied
   - Frontend: `withAuth()`, Supabase auth header validation
   - Admin: `withAuth()`, `withPermission()`, iron-session
   - PodClaw: token-based auth
   - List any endpoint WITHOUT auth → CRITICAL if it mutates data

### Phase 2: Input Validation

3. **Schema validation**:
   - Does every POST/PATCH/PUT endpoint validate input with Zod or equivalent?
   - List endpoints with unvalidated input → FAIL
   - Check for overly permissive schemas (e.g., `z.any()`, `z.unknown()`)

4. **Injection vectors**:
   - Search for string interpolation in SQL queries → CRITICAL
   - Search for `dangerouslySetInnerHTML` with user input → CRITICAL
   - Check for command injection in any shell exec calls
   - Check for path traversal in file-serving endpoints

5. **Mass assignment**:
   - Can users update fields they shouldn't? (e.g., `role`, `is_admin`, `status`)
   - Are update schemas restrictive (allowlist) vs permissive (blocklist)?
   - Check for `.update(req.body)` patterns without filtering

### Phase 3: Response Security

6. **Data exposure**:
   - Do responses include sensitive fields? (passwords, tokens, internal IDs)
   - Are error responses sanitized? (no stack traces, no DB schema leaks)
   - Check for verbose error messages in production mode

7. **CORS configuration**:
   - What origins are allowed?
   - Are credentials allowed cross-origin?
   - Is CORS too permissive? (e.g., `*` origin with credentials)

8. **Response headers**:
   - Is `Cache-Control: no-store` set on sensitive endpoints?
   - Are security headers present? (X-Content-Type-Options, X-Frame-Options)
   - Is HSTS configured?

### Phase 4: Rate Limiting & Abuse Prevention

9. **Rate limiting**:
   - Which endpoints have rate limiting?
   - Auth endpoints (login, register, password reset) — MUST have rate limiting
   - Data export endpoints — should have rate limiting
   - List unprotected endpoints → WARN

10. **Abuse vectors**:
    - Can unauthenticated users trigger expensive operations? (AI calls, email sends)
    - Are file upload endpoints size-limited?
    - Is there pagination enforcement on list endpoints?

### Phase 5: Inter-Service Communication

11. **Service-to-service auth**:
    - How do frontend → PodClaw bridge calls authenticate?
    - How do cron jobs authenticate to API routes?
    - Are internal service tokens rotated?

12. **Webhook security**:
    - Are incoming webhooks (Stripe, Printful) validated? (signatures, source IP)
    - Do webhooks use idempotency keys?
    - Are webhook endpoints protected from replay attacks?

13. **MCP server**:
    - What tools does the MCP server expose?
    - Is there auth on MCP tool invocations?
    - Can MCP tools access data they shouldn't?

## Output Format

Generate `AUDIT_API_[DATE].md` at workspace root with:

```markdown
# API Audit — [DATE]

## Endpoint Inventory
| Service | Method | Path | Auth | Validation | Rate Limit | Status |
|---|---|---|---|---|---|---|

## Summary
- Total endpoints: X
- PASS: X | WARN: X | FAIL: X | CRITICAL: X

## Critical Findings
[Unprotected endpoints, injection vectors, auth bypasses]

## Recommendations
[Priority-ordered fixes]
```
