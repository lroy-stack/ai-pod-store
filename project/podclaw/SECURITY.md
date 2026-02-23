# PodClaw — Security Model

## Threat Model

| Actor | Trust Level | Threats | Mitigations |
|-------|-------------|---------|-------------|
| Sub-agent (Claude) | Trusted, budget-limited | Excessive spending, unintended actions | `max_budget_usd`, `allowed_tools`, rate limits, audit log |
| MCP Connector | Semi-trusted (code we control) | API key leakage, injection via responses | Auth handled internally, `[DATA]` boundaries, sanitization |
| User/Customer Data | Untrusted input | Prompt injection, PII exposure | Security preamble, injection pattern detection, PII stripping in logs |
| External APIs | Untrusted responses | Injection via API responses, data corruption | `[DATA]` boundary markers, response validation in connectors |
| Admin (Bridge API) | Trusted, authenticated | Unauthorized access | Bearer token auth, rate limiting, CORS |

## Permission System

### can_use_tool — PreToolUse Deny Chain

Every tool call passes through a three-hook deny chain before execution:

1. **security_hook** (index 0) — **FAIL-CLOSED**
   - Validates tool name against allowlist
   - Checks for dangerous patterns in tool input
   - On error: **DENIES** the tool call (never fails open)

2. **cost_guard_hook** (index 1) — FAIL-OPEN
   - Checks daily cumulative cost against `AGENT_DAILY_BUDGETS`
   - On error: allows the tool call (SDK `max_budget_usd` provides backup)

3. **rate_limit_hook** (index 2) — FAIL-OPEN
   - Enforces per-session tool call limits from `RATE_LIMITS` config
   - On error: allows the tool call (agent still bounded by `max_turns`)

### allowed_tools — SDK-Level Restriction

Each agent has a whitelist of permitted tools:

- **Built-in tools**: Configured in `AGENT_ALLOWED_BUILTINS` (Read, Grep, Glob, etc.)
- **MCP tools**: Auto-derived from `AGENT_TOOLS` connector mapping
- **Disallowed globally**: `Bash`, `Edit` — no agent has direct shell access

### Sandbox — OS-Level Isolation

`SandboxSettings` provides filesystem and network isolation:

```python
SandboxSettings(
    enabled=True,
    autoAllowBashIfSandboxed=True,
    excludedCommands=["git"],
    allowUnsandboxedCommands=False,
    network={"allowLocalBinding": True},
)
```

Agents cannot:
- Read files outside the workspace directory
- Make unauthorized network requests
- Execute arbitrary binaries

## Budget Enforcement

### Dual Defense

1. **SDK `max_budget_usd`** — Hard limit per session, enforced by the Claude Agent SDK
   - Stops execution immediately when exceeded
   - Per-agent values in `AGENT_BUDGETS` config

2. **`cost_guard_hook`** — Soft limit on daily cumulative spending
   - Tracks costs across all sessions for each agent
   - Warns and denies when daily budget in `AGENT_DAILY_BUDGETS` is exceeded
   - Resets at UTC midnight

### Budget Table

| Agent | Per-Session (USD) | Daily Limit (EUR) | Model |
|-------|-------------------|-------------------|-------|
| researcher | $0.60 | €1.50 | Haiku |
| marketing | $1.00 | €2.00 | Sonnet |
| designer | $1.50 | €3.00 | Sonnet |
| newsletter | $0.80 | €1.50 | Sonnet |
| cataloger | $6.00 | €15.00 | Sonnet |
| customer_manager | $1.00 | €2.00 | Sonnet |
| seo_manager | $0.50 | €1.00 | Haiku |
| finance | $1.20 | €2.50 | Sonnet |
| qa_inspector | $0.15 | €0.15 | Haiku |
| brand_manager | $0.80 | €1.50 | Sonnet |
| **Total daily max** | — | **€30.15** | — |

> Source of truth: `podclaw/config.py` → `AGENT_BUDGETS` (per-session) and `AGENT_DAILY_BUDGETS` (daily).

## Rate Limiting

Per-session tool call limits prevent runaway agents:

| Agent | Tool | Max/Session |
|-------|------|-------------|
| researcher | crawl_url | 20 |
| marketing | resend_send | 30 |
| marketing | telegram_send, telegram_broadcast, whatsapp_send | 50 each |
| designer | crawl_url | 10 |
| designer | fal_generate | 10 |
| designer | gemini_generate_image | 2 |
| newsletter | resend_send | 500 |
| cataloger | printify_create, printify_publish, printify_upload_image | 50 each |
| cataloger | printify_delete_product | 10 |
| customer_manager | resend_send, telegram_send, whatsapp_send | 100 each |
| customer_manager | stripe_create_refund | 10 |
| seo_manager | crawl_url | 10 |
| finance | stripe_create_refund | 5 |
| qa_inspector | gemini_check_image | 20 |
| qa_inspector | printify_get_product | 10 |
| brand_manager | printify_update | 50 |
| brand_manager | printify_get_product | 30 |

## Escalation Rules

Actions requiring admin approval (from SOUL.md):

- Refunds > EUR 100
- Price changes > 20%
- Bulk deletes > 10 items
- Security incidents
- Customer complaints about quality
- Legal/compliance concerns

## Prompt Injection Defense

1. **Security preamble**: Prepended to every agent system prompt (immutable rules)
2. **`[DATA]` boundaries**: All reference data wrapped in `[DATA source=file]...[/DATA]`
3. **Injection detection**: `_INJECTION_PATTERNS` regex in `memory_manager.py` detects and redacts:
   - "ignore previous instructions"
   - "you are now / act as / pretend to be"
   - "system prompt / override rules"
4. **Sanitization**: All agent-written data passes through `_sanitize_data()` before storage

## Credential Handling

- No environment variables are exposed to agents in their system prompts
- MCP connectors handle authentication internally (keys loaded at init)
- Bridge API uses `PODCLAW_BRIDGE_AUTH_TOKEN` bearer auth
- Supabase service key is used server-side only

## Audit Trail

Every agent action is recorded in the `agent_events` Supabase table:
- `session_start`, `session_end` — lifecycle events
- `tool_call` — every tool invocation with input/output
- `tool_failure` — failed tool calls (via PostToolUseFailure hook)
- `agent_stop` — agent stop events (via Stop hook)
- `error` — execution errors

The `audit_log` table provides a secondary trail with actor/action/resource tracking.

## Reporting Security Issues

If you discover a security vulnerability in PodClaw:

1. Do NOT create a public issue
2. Contact the admin via the configured Telegram channel (`ADMIN_TELEGRAM_CHAT_ID`)
3. Include: description, reproduction steps, potential impact
