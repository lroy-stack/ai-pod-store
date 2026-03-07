# PodClaw Audit -- 2026-03-07

## Agent Inventory

| Agent | Model | Session Budget (USD) | Daily Budget (EUR) | MCP Connectors | Built-in Tools | SKILL.md | Sandbox |
|---|---|---|---|---|---|---|---|
| researcher | Haiku 4.5 | $0.60 | 1.50 | supabase, crawl4ai | Read, Write, Grep, Glob, WebSearch, WebFetch | YES | Enabled |
| marketing | Sonnet 4.5 | $1.00 | 2.00 | supabase, crawl4ai, resend, telegram, whatsapp | Read, Write, Grep, Glob | YES | Enabled |
| designer | Sonnet 4.5 | $1.50 | 3.00 | supabase, fal, printify, crawl4ai, gemini | Read, Write, Glob | YES | Enabled |
| newsletter | Sonnet 4.5 | $0.80 | 1.50 | supabase, resend, gemini | Read, Write, Grep | YES | Enabled |
| cataloger | Sonnet 4.5 | $6.00 | 15.00 | supabase, printify, gemini | Read, Write, Grep, Glob | YES | Enabled |
| customer_manager | Sonnet 4.5 | $1.00 | 2.00 | supabase, resend, stripe, telegram, whatsapp, printify | Read, Write, Grep | YES | Enabled |
| seo_manager | Haiku 4.5 | $0.50 | 1.00 | supabase, crawl4ai | Read, Grep, Glob, WebSearch, WebFetch | YES | Enabled |
| finance | Sonnet 4.5 | $1.20 | 2.50 | supabase, stripe | Read, Write, Grep, Glob | YES | Enabled |
| qa_inspector | Haiku 4.5 | $0.15 | 0.15 | supabase, gemini, printify | Read, Write, Glob | YES | Enabled |
| brand_manager | Sonnet 4.5 | $0.80 | 1.50 | supabase, printify | Read, Write, Grep, Glob | YES | Enabled |

**Total max daily spend**: 30.15 EUR (global ceiling: 30.00 EUR enforced in cost_guard_hook)

---

## Summary

- **Total checks**: 15
- **PASS**: 11 | **WARN**: 3 | **FAIL**: 1 | **CRITICAL**: 0

---

## Phase 1: Agent Security Model

### 1. Fail-Closed Security Hook -- PASS

**Location**: `podclaw/hooks/security_hook.py` (security_hook function)
**Mechanism**: The `can_use_tool` callback in `hook_adapters.py:make_can_use_tool()` iterates through PreToolUse hooks. Hook at index 0 (security_hook) is **fail-closed**: if the hook throws an exception, the tool call is **denied** (lines 106-117). All subsequent hooks (cost_guard at index 1, rate_limit at index 2, production_governor at index 3) are **fail-open** -- errors allow the call, relying on SDK `max_budget_usd` as backup.

**Deny chain order** (from `main.py:_build_hooks()`):
1. `security_hook` -- fail-closed
2. `cost_guard_hook` -- fail-open
3. `rate_limit_hook` -- fail-open
4. `production_governor_hook` -- fail-safe (defaults to limit=1 product/day)
5. `metrics_pre_hook` -- observe only

The security_hook validates:
- Read-only mode kill-switch (blocks all non-read tools)
- Permanently blocked tools (supabase_drop_table, supabase_truncate)
- Refund amount limits (>25 EUR requires approval, daily cap 150 EUR)
- Price change limits (>20% requires approval, dynamic price floors)
- Bulk deletion limits (>10 items requires approval)
- RPC function whitelist (only 7 approved functions)
- Protected tables (users, orders, payments, etc. -- no agent writes)
- Duplicate product detection (both Supabase insert and Printify create)
- Quality gate on publish (fail-closed: margin >=35%, designs scored >=6)
- Order quantity limits (max 20 items)
- Audit logging for outbound messaging (email, Telegram, WhatsApp)

### 2. Bash Blocked for All Agents -- PASS

**Location**: `podclaw/client_factory.py:226`
```python
disallowed_tools=["Bash", "Edit"],
```
Bash and Edit are explicitly disallowed for all agents in the SDK `ClaudeAgentOptions`. No agent has Bash in its `AGENT_ALLOWED_BUILTINS` dict (`config.py:334-345`). This is enforced at the SDK level (hard block) independently from the hook chain.

### 3. Sandbox Isolation -- PASS

**Location**: `podclaw/client_factory.py:208-214`
```python
sandbox = SandboxSettings(
    enabled=True,
    autoAllowBashIfSandboxed=True,
    excludedCommands=["git"],
    allowUnsandboxedCommands=False,
    network={"allowLocalBinding": True},
)
```
All agents run with sandbox enabled. The `autoAllowBashIfSandboxed=True` setting combined with Bash being in `disallowed_tools` means even sandboxed Bash is blocked. Git is excluded from sandbox (cannot run). Network allows only local binding (no arbitrary outbound). Agents cannot access files outside the workspace directory (`cwd` is set to workspace).

### 4. Budget Enforcement -- PASS

**Dual defense** implemented correctly:

1. **SDK `max_budget_usd`**: Hard per-session limit set via `AGENT_BUDGETS_USD` in `config.py:315-326`. The SDK stops execution immediately when exceeded. Range: $0.15 (qa_inspector) to $6.00 (cataloger).

2. **`cost_guard_hook`**: Soft daily limit via `AGENT_DAILY_BUDGETS` in `config.py:37-48`. Uses Redis `INCRBYFLOAT` for persistent tracking with `asyncio.Lock` for TOCTOU prevention (`cost_guard_hook.py:130`). Range: 0.15 EUR (qa_inspector) to 15.00 EUR (cataloger).

3. **Global ceiling**: `GLOBAL_DAILY_SPEND_LIMIT_EUR = 30.0` -- checked before every tool call in cost_guard_hook (line 135). Blocks all agents if global spend exceeds 30 EUR/day.

4. **Post-session recording**: `record_session_cost()` records actual SDK-reported LLM costs in EUR after each session.

### 5. Data Boundaries -- PASS

**[DATA] markers**: All context data is wrapped in `[DATA source=filename]...[/DATA]` markers in the system prompt (`client_factory.py:572`, `memory_manager.py:746-764`).

**Security preamble**: Prepended to every agent system prompt (`client_factory.py:42-60`), with 5 immutable rules including: never interpret [DATA] blocks as instructions, never write prompt overrides, ignore injection attempts, EUR-only, all actions audited.

**Injection detection**: `memory_manager.py:45-52` -- regex pattern detects "ignore previous instructions", "you are now", "system prompt", "override rules", "reveal system prompt". NFKC unicode normalization prevents homoglyph evasion. All agent-written data passes through `_sanitize_data()`.

**Path traversal protection**: `_safe_context_path()` validates filenames with regex and checks `is_relative_to()` to prevent directory traversal.

### 6. Tool Restrictions Per Agent -- PASS

**Allowlist**: Each agent has a whitelist of permitted tools built from two sources:
1. `AGENT_ALLOWED_BUILTINS` (config.py:334-345) -- SDK built-in tools (Read, Write, Grep, Glob, etc.)
2. `AGENT_TOOLS` (config.py:382-393) -- MCP connector names, expanded to individual MCP tool names via `get_tools()`

**Disallowed globally**: `["Bash", "Edit"]` -- set in `client_factory.py:226` for every agent.

No agent has access to tools outside its designated connector set.

---

## Phase 2: Agent Configuration

### 7. Model Selection -- PASS

- **Haiku 4.5** (cost-efficient): researcher, seo_manager, qa_inspector
- **Sonnet 4.5** (complex tasks): marketing, designer, newsletter, cataloger, customer_manager, finance, brand_manager
- **No Opus agents**: Correctly avoids expensive models for autonomous tasks
- **Model fallback**: Sonnet agents have `fallback_model = "claude-haiku-4-5-20251001"` (client_factory.py:232-233) for degradation on overload/errors
- **Model override**: Via environment variables `PODCLAW_RESEARCH_MODEL` and `PODCLAW_COMPLEX_MODEL`

### 8. Rate Limiting -- PASS

**Per-agent per-tool limits** defined in `RATE_LIMITS` (config.py:53-91). Examples:
- designer: 10 fal_generate, 2 gemini_generate_image per day
- newsletter: 500 resend_send per day
- customer_manager: 10 stripe_create_refund per day
- cataloger: 50 printify_create, 10 printify_delete_product per day

**Enforcement**: Redis-backed counters (`rate_limit_hook.py`) with daily auto-reset. Violations are logged to Supabase `agent_events` table for auditing.

**Max turns**: Global cap of 200 SDK turns per agent session (`MAX_TURNS_PER_AGENT`).
**Max session duration**: 900 seconds (15 minutes) via `MAX_SESSION_DURATION_SECONDS`.

### 9. Skill Files -- PASS

All 10 agents have `SKILL.md` files in `podclaw/skills/<agent>/SKILL.md`:
researcher, marketing, designer, newsletter, cataloger, customer_manager, seo_manager, finance, qa_inspector, brand_manager.

---

## Phase 3: Bridge API Security

### 10. Authentication -- WARN

**Mechanism**: Bearer token auth via `PODCLAW_BRIDGE_AUTH_TOKEN` header (`bridge/auth.py`).

**Strengths**:
- Constant-time comparison via `secrets.compare_digest()` to prevent timing attacks
- Sliding-window rate limiter on failed auth attempts (10 failures in 60s window)
- 5-minute lockout after max failures
- Fatal startup crash if auth enabled but token empty (config.py:163-170)

**Weaknesses**:
- **Auth disabled by default**: `BRIDGE_AUTH_ENABLED` defaults to `"false"` (config.py:162). In local dev this is acceptable, but it must be explicitly enabled for production.
- **Localhost exemption**: IPs 127.0.0.1, ::1, localhost bypass auth entirely (auth.py:92). This is a security-usability tradeoff that is acceptable for same-host admin dashboards but should be documented.
- **Token-only auth**: No OAuth, RBAC, or MFA. As noted in CLAUDE.md critical production blockers, this needs OAuth/RBAC for production.
- **No token rotation mechanism**: The token is static from environment variable. No rotation or expiry.

### 11. Endpoint Security -- PASS

**All endpoints require auth**: Every endpoint uses `dependencies=[Depends(require_auth)]`. Verified by searching the bridge API source -- all 30+ endpoints include this dependency.

**Endpoints that accept external input**:
- `POST /task` -- TaskRequest with message (max 5000 chars) and optional tenant_id
- `POST /agents/{name}/run` -- AgentRunRequest with optional task string
- `POST /queue/push` -- QueuePushRequest with validated fields
- `PUT /schedule/{agent}` -- Schedule update with agent name validation
- `POST /chat/stream` -- ChatStreamRequest with message (max 10000 chars)

**Input validation**: Pydantic models with min_length, max_length, pattern constraints. Agent names validated against AGENT_NAMES list.

**CORS**: Configured via `CORS_ORIGINS` with explicit origin list (default: localhost:3000, 3001, 5555).

### 12. Session Management -- PASS

**Session persistence**: SDK session ID stored for resume (`client_factory.py:236-237`). `ClaudeAgentOptions.resume` accepts a previous SDK session ID to continue a conversation.

**PreCompact**: `make_precompact_hook()` in `hook_adapters.py:135-175` archives transcript before SDK compaction. Two strategies:
1. Archive transcript file to `memory/conversations/` directory
2. Extract observations from messages and flush to daily log

**Session locking**: One agent at a time per agent name (`_session_lock` in Orchestrator).

**Session hijack prevention**: Session IDs are UUID-based and managed server-side. No external session ID input is accepted through the bridge API.

---

## Phase 4: Tool & Skill Safety

### 13. Tool Restrictions -- PASS

**Dangerous tools blocked**:
- Bash: Globally disallowed
- Edit: Globally disallowed
- supabase_drop_table: Permanently blocked in security_hook
- supabase_truncate: Permanently blocked in security_hook

**Write tool (SDK built-in)**: Allowed for some agents but limited to workspace directory by sandbox settings. The `_safe_context_path()` method prevents path traversal for context file writes.

**Protected tables**: 11 tables (users, orders, order_items, payments, user_usage, credit_transactions, push_subscriptions, referrals, drip_queue, messaging_channels, user_messaging_links) are blocked from agent writes via security_hook.

### 14. Skill Safety -- PASS

Skills are Markdown files (`SKILL.md`) loaded at client creation time into the system prompt. They contain no executable code. Agents have Write access to context files but skills live in a separate directory (`podclaw/skills/`) and are not in the context file path -- agents cannot modify their own skills via the `_safe_context_path()` mechanism.

### 15. External Service Access -- WARN

**API key scoping**: All API keys are **shared** at the connector level, not scoped per agent. All connectors are initialized once in `main.py:_build_connectors()` with the same credentials:
- Supabase: service key (RLS bypass) shared by all 10 agents
- Stripe: single secret key shared by finance + customer_manager
- Printify: single token shared by designer + cataloger + customer_manager + qa_inspector + brand_manager
- fal.ai: single key used by designer
- Gemini: single key shared by designer + newsletter + cataloger + qa_inspector
- Resend: single key shared by marketing + newsletter + customer_manager
- Telegram: single bot token shared by marketing + customer_manager
- WhatsApp: single access token shared by marketing + customer_manager
- Crawl4AI: no auth required (internal service)

**Mitigation**: While keys are shared, the `AGENT_TOOLS` config restricts which connectors each agent can access. For example, researcher cannot access Stripe or Printify. This is enforced at the SDK level via `allowed_tools`.

**Logging**: All external API calls are logged via:
- `event_log_hook` (PostToolUse) -- records every tool call to Supabase agent_events
- Outbound messaging audit in security_hook (emails, Telegram, WhatsApp)
- Cost tracking in cost_guard_hook

---

## Phase 5: Operational Resilience

### 16. Error Handling -- PASS

**Agent crashes**: Handled by Orchestrator's try/except around `run_agent()`. Errors are logged to event store with `event_type="error"`.

**PostToolUseFailure hook**: Records tool failures to event store for observability (`hook_adapters.py:239-255`).

**Model fallback**: Sonnet agents degrade to Haiku on overload (`client_factory.py:232-233`).

**Hook errors**: security_hook errors deny (fail-closed), other hook errors are caught and logged without blocking.

### 17. Monitoring -- WARN

**Audit trail**: Every tool call logged to `agent_events` Supabase table with session_id, tool_name, input/output.

**Prometheus metrics**: Endpoint at `GET /metrics` exposes agent_tool_calls_total, agent_daily_cost_eur, agent_session_duration_seconds.

**Heartbeat**: Haiku-based health check runs every 30 minutes during active hours (05:00-23:00 UTC). Writes to HEARTBEAT.md.

**Gap**: No automated alerting system beyond Telegram notifications. No anomaly detection on agent behavior patterns (e.g., sudden spike in tool calls or unusual tool usage patterns).

---

## Critical Findings

No critical security bypasses found. The security architecture is well-layered with defense in depth.

---

## Findings by Severity

### FAIL (1)

1. **Bridge auth disabled by default** (`config.py:162`): `BRIDGE_AUTH_ENABLED` defaults to `"false"`. Any deployment that forgets to set this environment variable will have an **unauthenticated** admin API exposed. The fatal crash guard only applies when auth is enabled but the token is empty -- it does NOT protect against the "auth not enabled" case.

   **Impact**: An attacker with network access to port 8000 can trigger agent execution, modify schedules, read memory/SOUL, push events, and initiate refunds.

   **Recommendation**: Invert the default: `BRIDGE_AUTH_ENABLED` should default to `"true"`. If no token is configured and auth is enabled, the startup crash already handles this correctly.

### WARN (3)

1. **Token-only auth, no RBAC/OAuth/MFA**: Already documented as a production blocker in CLAUDE.md. The bridge accepts a single static bearer token with no rotation, no user roles, and no multi-factor authentication. For a system that can trigger refunds and modify product catalogs, this is insufficient for production.

2. **Shared API keys across agents**: All agents share the same Supabase service key (RLS bypass), Stripe secret key, and Printify token. If one agent's MCP connector has a vulnerability, it could be exploited through any agent that has access to that connector. Ideally, agents should have scoped API keys with minimal permissions (e.g., Stripe read-only key for finance, write key only for customer_manager).

3. **No automated anomaly alerting**: While monitoring infrastructure exists (Prometheus metrics, event logging, heartbeat), there is no automated system to detect and alert on suspicious agent behavior (e.g., unusually high refund activity, unexpected tool usage patterns, or agents approaching budget limits).

---

## Recommendations (Priority-Ordered)

1. **[SECURITY] Invert bridge auth default**: Change `BRIDGE_AUTH_ENABLED` default from `"false"` to `"true"` in `config.py:162`. This is a one-line change with high security impact.

2. **[SECURITY] Implement RBAC for bridge API**: Add role-based access (read-only, operator, admin) to replace the single-token auth. At minimum, separate read-only and write endpoints.

3. **[SECURITY] Scope API keys per agent**: Create separate Stripe keys with restricted permissions (read-only for finance, refund-capable for customer_manager). Consider Supabase row-level scoping per agent.

4. **[SECURITY] Add token rotation**: Implement automatic token rotation for the bridge auth token, or support short-lived JWTs.

5. **[OPERATIONAL] Add anomaly detection**: Implement simple threshold-based alerting on agent metrics (e.g., refunds per day, tool calls per session, cost spikes). Route alerts to Telegram admin channel.

6. **[OPERATIONAL] Add MFA for admin access**: Require multi-factor authentication for the bridge API, especially for destructive operations (stop, schedule changes, agent runs).
