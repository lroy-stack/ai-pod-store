# MCP Server — Tests & Infrastructure Audit

**Date**: 2026-03-09
**Scope**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/`
**Auditor**: Claude Opus 4.6

---

## Scorecard

| Area | Score | Verdict |
|---|---|---|
| Test Coverage | 3/10 | CRITICAL — only 3 of 17 tools tested |
| Test Quality | 5/10 | WARN — mostly smoke tests, limited edge cases |
| Mocking Strategy | 6/10 | WARN — decent mocks but Supabase mock is shallow |
| Auth Testing | 3/10 | CRITICAL — 2 test files fail, no actual OAuth flow tested |
| Rate Limit Testing | 7/10 | OK — good breadth but relies on mock leaking state |
| Integration Tests | 1/10 | CRITICAL — none exist |
| Test Isolation | 4/10 | WARN — in-memory fallback tests pollute mock state |
| Dockerfile Quality | 8/10 | GOOD — multi-stage, non-root, healthcheck |
| TypeScript Config | 9/10 | GOOD — strict mode, all important flags enabled |
| Package.json | 6/10 | WARN — 3 high-severity vulns, several outdated deps |
| Dev Scripts | 5/10 | WARN — hardcoded JWT secret in start-dev.sh |
| Loose Scripts | 3/10 | WARN — 5 orphaned debug scripts in project root |

**Overall**: 4.6/10 — Significant gaps in test coverage and 2 test suites broken.

---

## 1. Test Run Results

```
Test Files:  2 failed | 3 passed (5)
Tests:       33 passed (33)
Duration:    314ms
```

### Failures

Both OAuth test files (`oauth-flow.test.ts` and `oauth.test.ts`) **FAIL** at import time:

```
Error: MCP_JWT_SECRET environment variable is required
  at src/auth/oauth-provider.ts:10:9
```

**Root cause**: `oauth-provider.ts` throws at module load if `MCP_JWT_SECRET` is not set. The `oauth-flow.test.ts` file mocks Redis but does NOT mock `process.env.MCP_JWT_SECRET` before importing from `oauth-provider.ts`. The `oauth.test.ts` file does not even mock Redis at all.

**Fix**: Set `process.env.MCP_JWT_SECRET` in a `beforeAll` or in the vitest setup file, BEFORE any imports from `oauth-provider.ts`. Alternatively, refactor the module to lazy-read the env var.

### Passing Suites

| Suite | Tests | Time |
|---|---|---|
| `session.test.ts` | 12 | 7ms |
| `rate-limit.test.ts` | 15 | 13ms |
| `tools.test.ts` | 6 | 4ms |

---

## 2. Test Coverage Analysis

### Tools Tested vs Available

There are **17 tool files** in `src/tools/`:

| Tool | Tested? | Notes |
|---|---|---|
| `search-products.ts` | YES | 4 tests (search, SQL injection, limit, empty) |
| `get-cart.ts` | PARTIAL | 1 test (auth required only) |
| `create-checkout.ts` | PARTIAL | 1 test (auth required only) |
| `get-product-details.ts` | NO | |
| `get-product-reviews.ts` | NO | |
| `get-store-info.ts` | NO | |
| `get-store-policies.ts` | NO | |
| `get-my-profile.ts` | NO | |
| `get-order-status.ts` | NO | |
| `list-categories.ts` | NO | |
| `list-my-orders.ts` | NO | |
| `list-wishlist.ts` | NO | |
| `add-to-wishlist.ts` | NO | |
| `remove-from-wishlist.ts` | NO | |
| `track-shipment.ts` | NO | |
| `update-cart.ts` | NO | |
| `update-my-profile.ts` | NO | |

**Coverage**: 3/17 tools (17.6%), with `get-cart` and `create-checkout` only testing the "auth required" guard.

### Other Modules Tested

| Module | Tested? |
|---|---|
| `auth/oauth-provider.ts` | BROKEN (2 files fail) |
| `auth/session.ts` | NO (injectAuthInfo, JWT validation) |
| `middleware/rate-limit.ts` | YES (15 tests) |
| `session.ts` | YES (12 tests) |
| `lib/redis.ts` | NO |
| `lib/supabase.ts` | NO |
| `lib/stripe.ts` | NO |
| `lib/audit-log.ts` | NO |
| `lib/logger.ts` | NO |
| `lib/completions.ts` | NO |
| `resources/catalog.ts` | NO |
| `resources/policies.ts` | NO |
| `prompts/shopping-assistant.ts` | NO |
| `index.ts` (HTTP server/transport) | NO |

### Vitest Coverage Config

The `vitest.config.ts` sets coverage thresholds at:
- Lines: 30%, Functions: 40%, Branches: 25%, Statements: 30%

These thresholds are **extremely low** and only track 6 files (oauth-provider, rate-limit, session, search-products, get-cart, create-checkout). The `include` list in coverage config explicitly excludes `src/lib/**`, `src/index.ts`, `src/prompts/**`, `src/resources/**`, meaning most of the codebase is invisible to coverage reporting.

---

## 3. Test Quality Assessment

### Strengths

- **Rate limit tests** have good breadth: global limits, per-tool limits, in-memory fallback, header verification, IP extraction from multiple sources (X-Forwarded-For, X-Real-IP, socket)
- **SQL injection test** for search_products is a useful security check
- **Session tests** verify Redis unavailability is handled gracefully (no crashes)
- **OAuth flow tests** (when they run) verify OAuth 2.1 compliance: no implicit grant, no password grant, PKCE S256 required

### Weaknesses

- **Smoke test pattern**: Most tests only verify "does not throw" (`resolves.not.toThrow()`), not actual behavior. Session tests for `createSession`, `updateSessionActivity`, `deleteSession` never verify what was stored in Redis.
- **No assertion on Redis calls**: Session tests call `createSession('session-123', 'user-456')` but never assert that `mockRedis.set` was called with the expected key/value.
- **get_cart and create_checkout**: Only test the authentication guard (1 test each). The comment says "Additional tests require complex mocking tested in E2E" but no E2E tests exist in this package.
- **Duplicate test files**: `oauth-flow.test.ts` (245 lines) and `oauth.test.ts` (89 lines) test the **exact same two functions** (`handleAuthorizationServerMetadata` and `handleProtectedResourceMetadata`) with heavy overlap. The `oauth-flow.test.ts` is a superset of `oauth.test.ts`.
- **No negative path testing**: What happens when Supabase returns an error? When Stripe fails? When a tool receives invalid input (wrong types, missing required fields)?
- **No concurrency testing**: Rate limiter is never tested with concurrent requests to verify sliding window correctness.

---

## 4. Mocking Strategy

### Redis Mock (`test-utils.ts`)
- Well-implemented with sorted sets, key-value store, and proper spy functions
- Supports `get`, `set`, `setex`, `del`, `keys`, `expire`, `zadd`, `zremrangebyscore`, `zcard`, `zrange`
- **Gap**: `zrange` WITHSCORES parameter is positional string, real ioredis uses different API

### Supabase Mock (`tools.test.ts`)
- Simple chainable mock: `from().select().eq().or().order().limit()` returns hardcoded data
- **Shallow**: Does not verify which table was queried, what filters were applied, or what columns were selected
- **Not reusable**: Mock is inline in `tools.test.ts`, not extracted to `test-utils.ts` (even though `createMockSupabaseClient` exists in test-utils but is never used)

### Request/Response Mocks (`test-utils.ts`)
- Clean implementation with `getStatusCode()`, `getHeaders()`, `getBody()` accessors
- Socket mock with default `remoteAddress: '127.0.0.1'`
- AuthInfo mock factory with userId/email

### Missing Mocks
- **Stripe client**: No mock exists, so `create-checkout` behavior cannot be tested
- **Audit logger**: Not mocked, so tool invocation logging cannot be verified
- **JWT (jose)**: Not mocked for `auth/session.ts` testing

---

## 5. Auth Testing (CRITICAL)

Both auth test files are **completely broken** due to the env var issue. When they would run, they only test **metadata endpoints** (well-known JSON responses). There is NO testing of:

- `handleAuthorize` — the actual authorization endpoint
- `handleToken` — token exchange (auth code -> access token)
- `handleRevoke` — token revocation
- `injectAuthInfo` — JWT validation and AuthInfo injection
- Token expiration handling
- Token refresh flow
- Invalid/malformed token rejection
- PKCE code_verifier validation (only tests that S256 is advertised)
- Redirect URI validation
- State parameter verification

The OAuth implementation has **zero behavioral tests** — only metadata structure assertions.

---

## 6. Integration Tests

**None exist.** There are no tests that:

- Start the HTTP server and make real requests
- Test the full MCP protocol flow (initialize -> tools/call -> response)
- Test transport-per-session pattern
- Test CORS header handling
- Test SSE response format
- Verify tool registration is correct

The `supertest` package is listed in devDependencies but **never imported** in any test file.

---

## 7. Test Isolation

### Issues Found

1. **In-memory fallback tests mutate module-level state**: Rate limit tests for "Redis unavailable" reassign `getRedisClient` via `vi.mocked(await import(...)).getRedisClient = ...` which mutates the module for subsequent tests. This works because later tests use `vi.clearAllMocks()`, but the reassignment persists.

2. **Session tests have same mutation pattern**: Three tests reassign `getRedisClient` for Redis-down scenarios.

3. **Tools test mutates Supabase mock mid-suite**: The "empty results" test reassigns `getSupabaseClient` inline, potentially affecting subsequent tests if test order changes.

4. **No `afterEach` cleanup**: Only `beforeEach` with `vi.clearAllMocks()` — this clears mock call history but NOT module-level reassignments.

---

## 8. Dockerfile Quality

```dockerfile
FROM node:22-alpine AS builder
# ... build stage
FROM node:22-alpine
# ... runtime stage
```

### Strengths
- Multi-stage build (build artifacts only, no dev deps in runtime)
- `npm prune --omit=dev` removes dev dependencies
- `USER node` runs as non-root
- Healthcheck configured (`curl -f http://localhost:8002/health`)
- Alpine base for small image size

### Issues
- **No `.dockerignore` for dist/**: The `.dockerignore` excludes `node_modules`, `.env*`, `*.log`, `.vscode`, `coverage` — good coverage
- **`curl` installed in runtime**: `apk add --no-cache curl` adds attack surface just for healthcheck. Consider using `wget` (included in Alpine) or a Node.js healthcheck script instead
- **No pinned Alpine version**: `node:22-alpine` will float to latest Alpine minor, which could introduce unexpected changes
- **COPY order**: `package.json` and `package-lock.json` are copied before source, enabling layer caching for `npm ci` — correct pattern
- **No LABEL**: Missing OCI labels (maintainer, version, description)

---

## 9. TypeScript Config

```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

**Verdict: GOOD.** All important strict flags are enabled. Target ES2022 with NodeNext module resolution is correct for Node 22. Declaration maps and source maps are generated. The only minor note is that `exactOptionalPropertyTypes` is not enabled, but this is rarely used.

---

## 10. Package.json

### Scripts
| Script | Present | Notes |
|---|---|---|
| `dev` | YES | `tsx watch src/index.ts` |
| `build` | YES | `tsc` |
| `start` | YES | `node dist/index.js` |
| `typecheck` | YES | `tsc --noEmit` |
| `test` | YES | `vitest run` |
| `test:watch` | YES | `vitest` |
| `test:coverage` | YES | `vitest run --coverage` |
| `lint` | NO | Missing — no ESLint configured |
| `format` | NO | Missing — no Prettier configured |
| `clean` | NO | Missing — no `rm -rf dist` script |

### Dependency Audit

**3 high-severity vulnerabilities** found by `npm audit`:

| Package | Severity | Issue |
|---|---|---|
| `@hono/node-server` | HIGH | Authorization bypass for protected static paths via encoded slashes |
| `express-rate-limit` | HIGH | IPv4-mapped IPv6 addresses bypass per-client rate limiting |
| `hono` | HIGH | 4 vulnerabilities (IP spoofing, cookie injection, SSE injection, arbitrary file access) |

All fixable via `npm audit fix`.

**Outdated dependencies**:

| Package | Current | Latest | Semver Gap |
|---|---|---|---|
| `@modelcontextprotocol/sdk` | 1.26.0 | 1.27.1 | Minor |
| `@supabase/supabase-js` | 2.97.0 | 2.99.0 | Minor |
| `stripe` | 17.7.0 | 20.4.1 | **Major** (3 majors behind) |
| `jose` | 5.10.0 | 6.2.1 | **Major** |
| `zod` | 3.25.76 | 4.3.6 | **Major** |
| `@types/supertest` | 6.0.3 | 7.2.0 | **Major** |
| `ioredis` | 5.9.3 | 5.10.0 | Minor |

**Note**: `supertest` and `@types/supertest` are dev dependencies but **never used** in any test file. They should be removed or actually used for integration tests.

---

## 11. Dev Scripts

### `start-dev.sh`

```bash
set -a
source ../frontend/.env.local
set +a
export MCP_JWT_SECRET="development-secret-key-change-in-production-min-32-chars-required"
```

### Issues

1. **Hardcoded JWT secret**: The value `development-secret-key-change-in-production-min-32-chars-required` is committed to git. While labeled "development", this is a bad pattern — it should come from `.env` or `.env.local`.
2. **No error handling**: If `../frontend/.env.local` does not exist, the script will silently fail (no `set -e`, and `source` may or may not error depending on shell).
3. **No shebang validation**: Script uses `#!/bin/bash` but does not check for `bash` availability.
4. **Relative path fragile**: `../frontend/.env.local` depends on CWD being `mcp-server/`.
5. **Missing `set -e`**: Script continues on errors.

---

## 12. Loose Scripts

Five debug/test scripts sit in the project root:

| File | Purpose | Issues |
|---|---|---|
| `check-products.ts` | Query Supabase for active products | Uses real DB credentials, no env guard |
| `create-test-order.mjs` | Create test order in Supabase | **Hardcoded absolute path** to `.env.local` (`/Users/lr0y/POD-AI-PDR/pod-agent-harness-v2/pod_workspace/project/frontend/.env.local`), **hardcoded test user UUID** |
| `test-search-logic.mjs` | Test search query against real DB | Uses `dotenv` (not in dependencies), **wrong relative path** (`join(__dirname, 'project', 'frontend', '.env.local')`) |
| `test-search-mug.ts` | Test search_products tool directly | Runs against real DB |
| `test-search.ts` | Test search_products tool directly | Runs against real DB |

### Recommendations

- **Move to `scripts/` directory** or delete entirely — they clutter the project root
- **Add to `.gitignore`** or mark as developer-only
- `create-test-order.mjs` has a **hardcoded absolute path** that only works on one developer's machine
- `test-search-logic.mjs` references `dotenv` which is not in package.json dependencies
- All 5 scripts run against production Supabase — they are NOT safe for CI

---

## 13. Critical Findings Summary

### P0 — Fix Immediately

| # | Finding | Impact |
|---|---|---|
| 1 | **2 OAuth test suites broken** — `MCP_JWT_SECRET` not set before import | 0 OAuth tests actually running; false sense of security |
| 2 | **3 high-severity npm vulnerabilities** (hono, @hono/node-server, express-rate-limit) | Authorization bypass, IP spoofing, file access |
| 3 | **14 of 17 tools have zero tests** | No regression safety for get-product-details, update-cart, track-shipment, wishlist ops, etc. |

### P1 — Fix Soon

| # | Finding | Impact |
|---|---|---|
| 4 | **No integration tests** — supertest installed but unused | Cannot verify MCP protocol flow, SSE format, CORS, session management |
| 5 | **OAuth flow has zero behavioral tests** — only metadata structure tested | Token exchange, PKCE validation, token revocation completely untested |
| 6 | **JWT validation (auth/session.ts) untested** | Cannot verify token expiry, malformed tokens, or AuthInfo injection |
| 7 | **Duplicate test files** — oauth-flow.test.ts is superset of oauth.test.ts | Maintenance burden, confusion |
| 8 | **Coverage thresholds extremely low** (30% lines) and scope excludes most files | Coverage metric is meaningless |

### P2 — Technical Debt

| # | Finding | Impact |
|---|---|---|
| 9 | **Hardcoded JWT secret** in `start-dev.sh` committed to git | Security hygiene |
| 10 | **5 orphaned debug scripts** in project root with hardcoded paths | Messy project structure, broken on other machines |
| 11 | **stripe v17 is 3 majors behind** (v20 latest) | API deprecations, missing features |
| 12 | **Supabase mock in test-utils.ts created but never used** | Dead code, inconsistent mocking approach |
| 13 | **No linting or formatting scripts** | Code quality not enforced |
| 14 | **Session tests only verify "no throw"** — never assert Redis was called correctly | Tests pass even if implementation is completely wrong |

---

## 14. Recommended Action Plan

### Quick Wins (< 1 hour)

1. **Fix OAuth tests**: Add `process.env.MCP_JWT_SECRET = 'test-secret-at-least-32-chars-long!!';` to a vitest setup file or at the top of each OAuth test before imports
2. **Run `npm audit fix`**: Resolves all 3 high-severity vulnerabilities
3. **Delete `oauth.test.ts`**: It's a subset of `oauth-flow.test.ts`
4. **Move loose scripts**: Create `scripts/debug/` directory, move all 5 scripts there
5. **Remove unused deps**: `npm uninstall supertest @types/supertest` (or write integration tests)

### Medium Effort (1-3 hours)

6. **Add tests for remaining tools**: At minimum, test auth-required guard for all authenticated tools, and basic functionality for public tools (`get-product-details`, `get-store-info`, `list-categories`, `get-store-policies`)
7. **Write integration tests**: Use supertest to test HTTP endpoints (`/health`, `/mcp`, `/.well-known/oauth-authorization-server`)
8. **Test `injectAuthInfo`**: Mock `jose` and test JWT validation with valid/expired/malformed tokens
9. **Raise coverage thresholds**: 60% minimum for lines/statements, 50% for branches/functions
10. **Add assertions to session tests**: Verify `mockRedis.set`/`mockRedis.del` were called with correct args

### Longer Term

11. **Test OAuth behavioral flow**: handleAuthorize, handleToken, handleRevoke with various scenarios
12. **Add lint/format scripts**: ESLint + Prettier with pre-commit hook
13. **Pin Docker base image**: Use `node:22.x.x-alpine3.x` instead of floating tag
14. **Update major deps**: stripe (17->20), jose (5->6), zod (3->4) — each requires migration review
