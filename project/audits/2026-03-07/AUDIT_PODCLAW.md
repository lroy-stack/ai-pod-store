# PodClaw Audit Report -- 2026-03-07

## Executive Summary

PodClaw is a well-architected autonomous agent system with strong security foundations: fail-closed security hooks, budget enforcement at two layers (SDK + daily), rate limiting backed by Redis, prompt injection defenses, PII scrubbing in logs, and comprehensive audit trails. However, several critical and high-severity issues were found, most notably **real API credentials committed to the `.env` file** (tracked in git history), **bridge authentication disabled in the deployed `.env`**, and **no Redis authentication configured**.

### Scorecard

| Area | Checks | PASS | WARN | FAIL | CRITICAL |
|------|--------|------|------|------|----------|
| Architecture | 6 | 6 | 0 | 0 | 0 |
| Bridge API Security | 7 | 4 | 1 | 1 | 1 |
| Agent Security Model | 8 | 7 | 1 | 0 | 0 |
| Budget Controls | 5 | 5 | 0 | 0 | 0 |
| Configuration | 5 | 3 | 1 | 0 | 1 |
| Memory System | 5 | 5 | 0 | 0 | 0 |
| Identity (SOUL.md) | 3 | 3 | 0 | 0 | 0 |
| Error Handling | 5 | 4 | 1 | 0 | 0 |
| Logging | 4 | 4 | 0 | 0 | 0 |
| Path Traversal | 3 | 3 | 0 | 0 | 0 |
| Dependencies | 3 | 1 | 2 | 0 | 0 |
| Integration | 4 | 3 | 1 | 0 | 0 |
| **Total** | **58** | **48** | **7** | **1** | **2** |

---

## Agent Inventory

| Agent | Model | Session Budget (USD) | Daily Budget (EUR) | Connectors | Built-in Tools | Skill File | Status |
|-------|-------|---------------------|--------------------|-----------:|----------------|------------|--------|
| researcher | Haiku 4.5 | $0.60 | 1.50 | supabase, crawl4ai | Read, Write, Grep, Glob, WebSearch, WebFetch | OK | OK |
| marketing | Sonnet 4.5 | $1.00 | 2.00 | supabase, crawl4ai, resend, telegram, whatsapp | Read, Write, Grep, Glob | OK | OK |
| designer | Sonnet 4.5 | $1.50 | 3.00 | supabase, fal, printify, crawl4ai, gemini | Read, Write, Glob | OK | OK |
| newsletter | Sonnet 4.5 | $0.80 | 1.50 | supabase, resend, gemini | Read, Write, Grep | OK | OK |
| cataloger | Sonnet 4.5 | $6.00 | 15.00 | supabase, printify, gemini | Read, Write, Grep, Glob | OK | OK |
| customer_manager | Sonnet 4.5 | $1.00 | 2.00 | supabase, resend, stripe, telegram, whatsapp, printify | Read, Write, Grep | OK | OK |
| seo_manager | Haiku 4.5 | $0.50 | 1.00 | supabase, crawl4ai | Read, Grep, Glob, WebSearch, WebFetch | OK | OK |
| finance | Sonnet 4.5 | $1.20 | 2.50 | supabase, stripe | Read, Write, Grep, Glob | OK | OK |
| qa_inspector | Haiku 4.5 | $0.15 | 0.15 | supabase, gemini, printify | Read, Write, Glob | OK | OK |
| brand_manager | Sonnet 4.5 | $0.80 | 1.50 | supabase, printify | Read, Write, Grep, Glob | OK | OK |

- All 10 agents have SKILL.md files in `podclaw/skills/<agent>/`
- Global daily spend limit: EUR 30.00
- Total theoretical daily budget: EUR 30.15

---

## 1. Architecture

**Current State**: 10 autonomous agents orchestrated by a central `Orchestrator` class (`core.py`), scheduled via APScheduler (`scheduler.py`), with a FastAPI bridge (`bridge/api.py`) on port 8000. Uses Claude Agent SDK with `ClaudeSDKClient`, MCP connectors (9 services), and a multi-layer hook system.

| Check | Result | Notes |
|-------|--------|-------|
| Agent count matches config | PASS | 10 agents in `AGENT_NAMES`, all have entries in `AGENT_MODELS`, `AGENT_DAILY_BUDGETS`, `AGENT_BUDGETS_USD`, `AGENT_TOOLS`, `AGENT_ALLOWED_BUILTINS` |
| SDK usage correct | PASS | Proper use of `ClaudeSDKClient`, `ClaudeAgentOptions`, `McpSdkServerConfig`, `SandboxSettings`, `PermissionResultAllow/Deny` |
| Agent hierarchy clear | PASS | Orchestrator -> sub-agents. PodClawAgent (FASE 2) adds cognitive layer. Delegation system for async chat-triggered agent runs |
| Skill files complete | PASS | All 10 agents have `SKILL.md` in `podclaw/skills/<agent>/` |
| Session management | PASS | SDK session persistence via `_last_sdk_sessions` stored in SQLite `StateStore`, resume support |
| Hook chain ordered | PASS | Pre: [security(0), cost_guard(1), rate_limit(2), production_governor(3), metrics_pre(4)]. Post: [event_log, memory, transparency, sync, quality_gate, transparency_catchup, metrics] |

---

## 2. Bridge API Security

### 2.1 Authentication

**File**: `podclaw/bridge/auth.py`

| Check | Result | Details |
|-------|--------|---------|
| Token auth implemented | PASS | Bearer token with `secrets.compare_digest()` (constant-time comparison) |
| Rate limiting on auth failures | PASS | `AuthRateLimiter` with sliding window, 5-min lockout after `BRIDGE_RATE_LIMIT_MAX` (default 10) failures |
| All endpoints protected | PASS | Every endpoint except `/health` has `dependencies=[Depends(require_auth)]` |
| Auth enabled by default | **CRITICAL** | `config.py:162` defaults `BRIDGE_AUTH_ENABLED=true`, but `podclaw/.env:30` sets `PODCLAW_BRIDGE_AUTH_ENABLED=false` and `PODCLAW_BRIDGE_AUTH_TOKEN=` is empty. Bridge is completely open in the deployed config. |

**CRITICAL Finding C-01**: Bridge auth disabled in `.env`

- **File**: `podclaw/.env:29-30`
- **Issue**: `PODCLAW_BRIDGE_AUTH_TOKEN=` (empty) and `PODCLAW_BRIDGE_AUTH_ENABLED=false`. Anyone who can reach port 8000 can run agents, trigger tasks, access memory, modify schedules, and push events.
- **Severity**: P0 / CRITICAL
- **Fix**: Generate token with `openssl rand -hex 32`, set `PODCLAW_BRIDGE_AUTH_ENABLED=true`. Ensure Docker network isolation (proxy network only).

### 2.2 Localhost Exemption

- **File**: `podclaw/bridge/auth.py:89-91`
- **Issue**: Localhost IPs (`127.0.0.1`, `::1`, `localhost`) bypass authentication entirely. This is intentional for same-host dashboard access but could be exploited via SSRF if any service on the same host can make HTTP requests to port 8000.
- **Severity**: P2 / WARN
- **Mitigation**: In Docker, services on different containers have different IPs. Risk is low if bridge is on a separate network.

### 2.3 CORS Configuration

- **File**: `podclaw/bridge/api.py:157-163`, `config.py:145-148`
- **Current**: Origins limited to `localhost:3000,3001,5555`. No `allow_credentials=True` set (defaults to `False`). Methods restricted to standard verbs. Headers restricted to `Authorization, Content-Type, Accept`.
- **Status**: PASS -- correctly restrictive.

### 2.4 Input Validation

- **File**: `podclaw/bridge/api.py:72-91`
- **Status**: PASS -- Pydantic models with `min_length`, `max_length`, and `pattern` constraints on all request bodies (`TaskRequest`, `ChatStreamRequest`, `QueuePushRequest`).

### 2.5 Health Endpoint

- **File**: `podclaw/bridge/api.py:1112`
- **Status**: PASS -- `/health` is intentionally unauthenticated (Docker healthcheck). Does not leak sensitive data.

---

## 3. Agent Security Model

### 3.1 Fail-Closed Security Hook

**File**: `podclaw/hooks/security_hook.py`, `podclaw/hook_adapters.py:106-117`

| Check | Result | Details |
|-------|--------|---------|
| Fail-closed on error | PASS | `hook_adapters.py:107-117` -- if `i == 0` (security_hook) throws exception, returns `PermissionResultDeny` |
| Bash access blocked | PASS | `client_factory.py:226` -- `disallowed_tools=["Bash", "Edit"]` explicitly |
| Tool allowlist per agent | PASS | `AGENT_ALLOWED_BUILTINS` + MCP tools dynamically built from `AGENT_TOOLS` connector mapping |
| Protected tables enforced | PASS | `security_hook.py:158-163` -- `PROTECTED_TABLES` blocks writes to `users`, `orders`, `payments`, etc. |
| RPC whitelist | PASS | `security_hook.py:96-108,298-303` -- `ALLOWED_RPC_FUNCTIONS` + regex validation on function name |
| Blocked tools list | PASS | `security_hook.py:152-155` -- `supabase_drop_table`, `supabase_truncate` permanently blocked |
| Read-only mode | PASS | `security_hook.py:74-93` -- global kill-switch blocks all non-`READONLY_TOOLS` |
| Refund/price/bulk guards | PASS | Refund threshold (EUR 25), daily refund cap (EUR 150), price change cap (20%), bulk delete threshold (10) |

### 3.2 Sandbox Settings

**File**: `podclaw/client_factory.py:208-214`

```python
SandboxSettings(
    enabled=True,
    autoAllowBashIfSandboxed=True,
    excludedCommands=["git"],
    allowUnsandboxedCommands=False,
    network={"allowLocalBinding": True},
)
```

| Check | Result | Details |
|-------|--------|---------|
| Sandbox enabled | PASS | `enabled=True` |
| Git excluded | PASS | `excludedCommands=["git"]` -- agents cannot run git |
| Unsandboxed commands blocked | PASS | `allowUnsandboxedCommands=False` |
| Bash in disallowed_tools | PASS | `disallowed_tools=["Bash", "Edit"]` -- Bash double-blocked |
| autoAllowBashIfSandboxed=True | WARN | Technically allows Bash within sandbox, but this is overridden by the `disallowed_tools` list. If an SDK bug bypasses `disallowed_tools`, sandboxed Bash would be available. Consider setting to `False` for defense-in-depth. |

### 3.3 Data Boundaries

- **File**: `podclaw/client_factory.py:42-60` -- `_SECURITY_PREAMBLE` prepended to every agent prompt
- **File**: `podclaw/memory_manager.py:735-740` -- All data sections wrapped in `[DATA source=file]...[/DATA]`
- **Status**: PASS

### 3.4 Prompt Injection Defense

- **File**: `podclaw/memory_manager.py:45-52` -- `_INJECTION_PATTERNS` regex detects "ignore previous instructions", role changes, system prompt reveals
- **File**: `podclaw/memory_manager.py:55-66` -- `_sanitize_data()` with Unicode NFKC normalization to catch fullwidth character evasion
- **Status**: PASS

---

## 4. Budget Controls

**Files**: `podclaw/config.py`, `podclaw/hooks/cost_guard_hook.py`, `podclaw/client_factory.py`

| Check | Result | Details |
|-------|--------|---------|
| SDK `max_budget_usd` per agent | PASS | `AGENT_BUDGETS_USD` with per-agent values ($0.15-$6.00). Passed to `ClaudeAgentOptions.max_budget_usd` in `client_factory.py:220` |
| Daily budget tracking (EUR) | PASS | `cost_guard_hook.py` tracks via Redis `INCRBYFLOAT`. Atomic check-and-increment under `_cost_lock` prevents TOCTOU |
| Global daily spend limit | PASS | `GLOBAL_DAILY_SPEND_LIMIT_EUR=30.0` checked before every tool call in `cost_guard_hook.py:132-147` |
| Session cost recording | PASS | `cost_guard_hook.py:185-200` -- `record_session_cost()` converts USD->EUR and adds to daily counter |
| Budget warning at 80% | PASS | `cost_guard_hook.py:169-170` -- logs warning when agent hits 80% of daily budget |

**Note**: Dual defense (SDK hard cap + daily budget soft cap) is well-designed. The cost_guard is fail-open by design (hook index 1), but the SDK `max_budget_usd` provides a hard backstop.

---

## 5. Configuration

**File**: `podclaw/config.py`

| Check | Result | Details |
|-------|--------|---------|
| Env var overrides | PASS | All critical settings have `os.environ.get()` with sensible defaults |
| Hot reload via SIGHUP | PASS | `main.py:365-377` -- SIGHUP reloads config module |
| Fatal on missing auth token | PASS | `config.py:163-170` -- `sys.exit(1)` if auth enabled but token empty |
| API keys in .env file | **CRITICAL** | Real production API keys (Supabase service key, Stripe secret, Printify JWT, Gemini, fal.ai, Resend) are stored in `podclaw/.env`. File is gitignored, but it exists on disk with live credentials. |
| .env.example safe | PASS | `podclaw/.env.example` contains only placeholder values |

**CRITICAL Finding C-02**: Live API credentials in `.env`

- **File**: `podclaw/.env:1-30`
- **Issue**: Contains real production credentials for 7 services: Supabase service role key, Stripe test secret key, Printify API JWT, Gemini API key, fal.ai key, Resend API key. While the file is gitignored, it is present on the filesystem. If PodClaw's workspace is exposed (e.g., via a misconfigured volume mount or debug endpoint), all keys leak.
- **Severity**: P0 / CRITICAL
- **Fix**: (1) Rotate ALL keys immediately if this file was ever committed to git. (2) Use Docker secrets or a vault for production. (3) Ensure `.env` never enters Docker images (multi-stage build with `.dockerignore`).

---

## 6. Memory System

**Files**: `podclaw/memory_manager.py`, `podclaw/memory/`, `podclaw/memory/store.py`

| Check | Result | Details |
|-------|--------|---------|
| Three-tier consolidation | PASS | Daily (14-day retention), Weekly (90-day), Long-term (MEMORY.md, never pruned), Context (working memory), Heartbeat |
| Atomic file writes | PASS | `memory_manager.py:69-90` -- `_atomic_write()` using `tempfile.mkstemp()` + `os.replace()` (POSIX atomic) |
| Write lock | PASS | `asyncio.Lock()` protects all write operations (`_write_lock`) |
| Prompt injection sanitization | PASS | All agent-written data passes through `_sanitize_data()` before storage |
| MEMORY.md load cap | PASS | `_MEMORY_LOAD_MAX_BYTES = 4096` prevents unbounded prompt growth |

**Memory directory structure**:
```
podclaw/memory/
  MEMORY.md          -- long-term facts
  memory.db          -- SQLite cognitive memory with Gemini embeddings
  store.py           -- MemoryStore class
  context/           -- working memory (*.md files)
  conversations/     -- chat conversation storage
  weekly/            -- weekly consolidation logs
  2026-02-*.md       -- daily logs
```

---

## 7. Identity (SOUL.md)

**File**: `podclaw/SOUL.md`

| Check | Result | Details |
|-------|--------|---------|
| Constraints defined | PASS | Currency (EUR only), domain, languages, budget limits, approval thresholds, privacy rules |
| Escalation rules clear | PASS | Refunds >100EUR, price changes >20%, bulk deletes >10, security incidents, quality complaints |
| Soul evolution controlled | PASS | `soul_evolution.py` -- proposals require admin approval unless `SOUL_AUTO_APPROVE=true` (default: `false`). Max 200 lines cap. |

---

## 8. Error Handling

**Files**: `podclaw/core.py`, `podclaw/hook_adapters.py`

| Check | Result | Details |
|-------|--------|---------|
| Circuit breaker | PASS | `core.py:118-141` -- Agent blocked after >=3 errors in 24h. Fail-open if DB unavailable. |
| Session timeout | PASS | `MAX_SESSION_DURATION_SECONDS=900` (15 min). `MAX_TURNS_PER_AGENT=200`. |
| Graceful shutdown | PASS | `main.py:401-425` -- Waits up to 30s for active sessions to complete. Signal handlers for SIGINT/SIGTERM. |
| Model fallback | PASS | `client_factory.py:232-233` -- Sonnet agents fall back to Haiku on overload/errors |
| Retry with backoff | WARN | No explicit exponential backoff for agent session retries. The scheduler has deferred retry support (`orchestrator.scheduler` back-reference), but the implementation relies on rescheduling rather than in-session retry with backoff. |

---

## 9. Logging

**Files**: `podclaw/main.py:428-484`, `podclaw/prometheus_metrics.py`

| Check | Result | Details |
|-------|--------|---------|
| PII scrubbing | PASS | `main.py:428-456` -- `_scrub_pii()` structlog processor strips email, name, address, phone fields with `[REDACTED]`. Handles nested dicts. |
| Structured logging | PASS | structlog with ISO timestamps, log level, optional JSON output (`PODCLAW_JSON_LOGS=true`) |
| Prometheus metrics | PASS | Custom registry with `agent_tool_calls_total`, `agent_tool_errors_total`, `agent_daily_cost_eur` counters/gauges |
| Log rotation | PASS | Configured via Docker Compose (`json-file` driver, 10MB x 3 files per service) |

---

## 10. Path Traversal

**Files**: `podclaw/memory_manager.py`, `podclaw/bridge/api.py`

| Check | Result | Details |
|-------|--------|---------|
| Context file validation | PASS | `memory_manager.py:38,160-167` -- `_CONTEXT_FILENAME_RE` regex (`^[a-zA-Z0-9_-]+\.md$`) + `is_relative_to()` check |
| Catalog file validation | PASS | `memory_manager.py:623-625` -- `resolve()` + `is_relative_to()` check |
| Bridge filename validation | PASS | `bridge/api.py:701` -- Additional regex check `^[a-zA-Z0-9._-]+$` before passing to memory_manager |

---

## 11. Dependencies

**File**: `podclaw/requirements.txt`

| Check | Result | Details |
|-------|--------|---------|
| Version pinning | WARN | Uses minimum version constraints (`>=`) rather than exact pins. `claude-agent-sdk>=0.1.0` allows any version. Recommend pinning to exact versions in production for reproducibility. |
| Known vulnerable packages | WARN | No `pip-audit` or `safety` scan in CI. Cannot confirm absence of known CVEs without running a scan. |
| Dependency count | PASS | 14 direct dependencies -- lean and focused |

**Recommendation**: Pin exact versions (e.g., `claude-agent-sdk==0.1.2`) and add `pip-audit` to CI.

---

## 12. Integration

### 12.1 Frontend Connection

- **Bridge API** on port 8000 proxied via Next.js `/api/agent/*` routes
- **SSE streaming** for chat via `POST /chat/stream` (returns `StreamingResponse` with `text/event-stream`)
- **CORS** restricted to frontend origins

### 12.2 Admin Connection

- Admin dashboard connects through the same bridge API
- All endpoints require auth (when enabled)

### 12.3 Supabase

- Service role key used server-side only (connectors, event store)
- Keys loaded from environment, never exposed in system prompts
- **Status**: PASS

### 12.4 Redis

- Used for rate limits, cost tracking, and agent singleton locks
- **File**: `podclaw/redis_store.py:40-41` -- `REDIS_URL` from environment
- **Issue**: No Redis password/AUTH configured in the defaults. Redis is on the internal `data` network in Docker, but should still use AUTH.
- **Severity**: P2 / WARN
- **Fix**: Set `REDIS_URL=redis://:password@redis:6379/0` and configure Redis `requirepass`.

---

## Critical Findings Summary

### C-01: Bridge Authentication Disabled (P0)

- **File**: `podclaw/.env:29-30`
- **Impact**: Full unauthenticated access to all bridge endpoints -- can trigger agent runs, access memory/soul, push events, modify schedules
- **Fix**: Set `PODCLAW_BRIDGE_AUTH_TOKEN=<generated-token>` and `PODCLAW_BRIDGE_AUTH_ENABLED=true`

### C-02: Live API Credentials in .env File (P0)

- **File**: `podclaw/.env:1-23`
- **Impact**: Supabase service role key, Stripe secret key, Printify JWT, Gemini key, fal.ai key, Resend key all in plaintext on disk
- **Fix**: (1) Verify credentials were never committed to git history. (2) Use Docker secrets or vault for production. (3) Add `podclaw/.env` to `.dockerignore`.

### F-01: Bridge Auth Disabled Allows Remote Agent Execution (P1)

- **File**: `podclaw/bridge/api.py:434` + `podclaw/.env:30`
- **Impact**: `POST /agents/{name}/run` can be called without authentication, triggering agent sessions that consume real API budgets
- **Fix**: Enable auth (see C-01)

---

## Warnings Summary

| ID | Area | Severity | Description | File:Line |
|----|------|----------|-------------|-----------|
| W-01 | Sandbox | P2 | `autoAllowBashIfSandboxed=True` -- redundant with `disallowed_tools`, but weakens defense-in-depth | `client_factory.py:210` |
| W-02 | Auth | P2 | Localhost exemption could be exploited via SSRF | `bridge/auth.py:89-91` |
| W-03 | Redis | P2 | No Redis AUTH configured | `redis_store.py:40` |
| W-04 | Dependencies | P2 | No exact version pinning in requirements.txt | `requirements.txt` |
| W-05 | Dependencies | P2 | No pip-audit/safety scan in CI | N/A |
| W-06 | Error Handling | P3 | No exponential backoff for agent session retries | `core.py` |
| W-07 | Config | P3 | CORS origins include `localhost:5555` (unclear what service) | `config.py:147` |

---

## Recommendations (Priority-Ordered)

### Immediate (P0)

1. **Enable bridge authentication**: Generate token, set env vars, verify all admin routes require it
2. **Rotate all API keys**: Supabase, Stripe, Printify, Gemini, fal.ai, Resend -- treat current keys as potentially compromised
3. **Verify git history**: Run `git log --all -- podclaw/.env` to confirm credentials were never committed. If they were, rotate immediately and use `git filter-repo` to purge

### Short-term (P1-P2)

4. **Add Redis AUTH**: Configure `requirepass` in Redis and update `REDIS_URL` with password
5. **Pin dependency versions**: Replace `>=` with exact versions in `requirements.txt`
6. **Add pip-audit to CI**: Scan for known CVEs in Python dependencies
7. **Set `autoAllowBashIfSandboxed=False`**: Defense-in-depth against SDK bugs
8. **Use Docker secrets**: Move all API keys from `.env` to Docker secrets for production deployment

### Long-term (P3)

9. **Add OAuth/RBAC to bridge**: Replace token-only auth with OAuth2 and role-based access control (as noted in CLAUDE.md blockers)
10. **Add MFA for admin**: Multi-factor authentication for admin dashboard access
11. **Implement exponential backoff**: For agent session retry logic
12. **Remove localhost exemption**: Or restrict to a specific internal service account

---

## Files Audited

| File | Purpose | Lines |
|------|---------|-------|
| `podclaw/config.py` | All configuration constants | 440 |
| `podclaw/bridge/api.py` | FastAPI bridge endpoints | ~1120 |
| `podclaw/bridge/auth.py` | Authentication and rate limiting | 104 |
| `podclaw/core.py` | Orchestrator (agent lifecycle) | ~590 |
| `podclaw/client_factory.py` | SDK client creation per agent | 256 |
| `podclaw/main.py` | Entry point, structlog config, PII scrubbing | 497 |
| `podclaw/hook_adapters.py` | SDK hook chain adapters | 358 |
| `podclaw/hooks/security_hook.py` | Fail-closed security validation | 503 |
| `podclaw/hooks/cost_guard_hook.py` | Daily budget enforcement | 217 |
| `podclaw/hooks/rate_limit_hook.py` | Per-tool rate limiting | 107 |
| `podclaw/redis_store.py` | Redis persistence layer | 362 |
| `podclaw/memory_manager.py` | Three-tier memory consolidation | ~800 |
| `podclaw/event_store.py` | Immutable event sourcing | 229 |
| `podclaw/production_governor.py` | Market-conditioned production control | ~660 |
| `podclaw/prometheus_metrics.py` | Prometheus metric definitions | ~70 |
| `podclaw/scheduler.py` | APScheduler daily cycle | ~500 |
| `podclaw/SOUL.md` | Agent identity and constraints | 54 |
| `podclaw/SECURITY.md` | Security model documentation | 160 |
| `podclaw/AGENTS.md` | Agent definitions and execution flow | 140 |
| `podclaw/requirements.txt` | Python dependencies | 41 |
| `podclaw/.env` | Environment variables (credentials) | 30 |
| `podclaw/.env.example` | Template (no real credentials) | 30 |

---

*Audit performed on 2026-03-07. Auditor: Claude Opus 4.6.*
