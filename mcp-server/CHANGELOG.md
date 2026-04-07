# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-18

### Added
- 32 MCP tools (12 public, 20 authenticated) for e-commerce operations
- OAuth 2.1 with mandatory PKCE (S256), refresh token rotation, and replay detection
- Dynamic Client Registration (RFC 7591) via `POST /oauth/register`
- Built-in OAuth clients: Claude Desktop, Claude (claude.ai), ChatGPT, Store Web
- JWT access tokens (15 min) + opaque refresh tokens (7 days)
- Token revocation (RFC 7009) with dual Redis + in-memory blacklist
- Per-tool rate limiting with Redis sliding window and in-memory fallback (fail-closed)
- HMAC-signed consent cookies to skip repeat OAuth approvals
- Structured JSON audit logging with PII field sanitization
- SSRF protection on `save_design` (HTTPS-only, private IP block, DNS rebinding check)
- User content boundaries (`[USER_CONTENT]...[/USER_CONTENT]`) on all UGC fields
- ILIKE wildcard sanitization on all text search queries
- MCP Apps UI widgets (product-grid, product-detail, cart-view)
- MCP Resources: product catalog (paginated), store policies
- MCP Prompt: multi-locale shopping assistant template
- Completions for tool arguments (categories, product IDs, order IDs)
- Dual Supabase clients: admin (service role) for auth tools, anon (RLS) for public tools
- Docker multi-stage build with non-root user and healthcheck
- Graceful shutdown on SIGTERM/SIGINT
- SSE resumability via in-memory event store (Last-Event-ID)

### Security
- IDOR protection on 100% of protected tools (20/20) via user_id ownership checks
- Scope enforcement: `write` scope required for all mutation tools
- Context injection: userId always from JWT `sub` claim, never from client input
- Body size limits: 1MB (MCP), 4KB (OAuth approve), 16KB (OAuth token)
- CORS allowlist with DNS rebinding prevention
- Security headers: X-Content-Type-Options, X-Frame-Options, Cache-Control
- Generic error messages (no stack traces, table names, or architecture details)
- Cart item limit: max 50 distinct items per user
- Open redirect prevention on checkout success/cancel URLs
