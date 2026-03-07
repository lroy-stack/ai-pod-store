---
name: Audit PodClaw
description: >
  Comprehensive audit of PodClaw — the autonomous agent system (Claude Agent SDK, Python).
  Use when asked to audit, review, or assess PodClaw — covering agent security, sandbox
  isolation, tool restrictions, budget limits, bridge API, and fail-closed patterns.
---

# Audit PodClaw

Systematic audit of `podclaw/` — 9 autonomous agents on Claude Agent SDK with FastAPI bridge.

## Prerequisites

- Read `podclaw/README.md` and `podclaw/AGENTS.md` for architecture
- Read `podclaw/SECURITY.md` for security model
- Read `podclaw/SOUL.md` for identity and constraints
- Read `podclaw/config.py` for budgets, tools, models, rate limits
- Read `podclaw/bridge/api.py` for the FastAPI bridge

## Workflow

### Phase 1: Agent Security Model

1. **Fail-closed security hook**:
   - Does a pre-tool-use hook exist that denies by default?
   - Is Bash access blocked for all agents? (per CLAUDE.md)
   - What tools are allowed per agent? (`allowed_tools` in config)
   - Is `can_use_tool` deny chain implemented?

2. **Sandbox isolation**:
   - Are agents running in sandboxed environments? (`SandboxSettings`)
   - Can agents access the filesystem outside their workspace?
   - Can agents access the network directly?
   - Can agents modify their own configuration?

3. **Budget enforcement**:
   - Is `max_budget_usd` set per agent?
   - What are the current budget limits?
   - Is there a global budget ceiling?
   - What happens when budget is exceeded? (graceful degradation or hard stop?)

4. **Data boundaries**:
   - Are `[DATA]` boundaries enforced for sensitive data?
   - Can agents access user PII directly?
   - Is there data classification (public, internal, sensitive, restricted)?

### Phase 2: Agent Configuration

5. **Agent inventory**:
   - List all 9 agents with their roles
   - For each: model, budget, allowed tools, skill files
   - Verify each has a SKILL.md in `podclaw/skills/<agent>/`

6. **Model selection**:
   - Which Claude model does each agent use?
   - Are expensive models (Opus) limited to high-value tasks?
   - Is there model fallback on failure?

7. **Rate limiting**:
   - Are API calls rate-limited per agent?
   - Is there a global rate limit across all agents?
   - What happens on rate limit hit?

### Phase 3: Bridge API Security

8. **Authentication**:
   - How does the bridge API authenticate requests?
   - Is it token-only? (per CLAUDE.md — needs OAuth/RBAC)
   - Is the token rotated? How is it stored?
   - Can the bridge be accessed from outside the Docker network?

9. **Endpoint security**:
   - List all bridge API endpoints
   - Which accept external input?
   - Is input validated and sanitized?
   - Are there any endpoints that trigger agent execution without auth?

10. **Session management**:
    - How are agent sessions managed? (`session resume`)
    - Is `PreCompact` transcript archiving working?
    - Can sessions be hijacked or replayed?

### Phase 4: Tool & Skill Safety

11. **Tool restrictions**:
    - Are dangerous tools (file write, network access) restricted?
    - Is there a tool allowlist per agent?
    - Can agents install packages or modify dependencies?

12. **Skill safety**:
    - Do skills contain executable code?
    - Are skill files read-only for agents?
    - Can agents modify their own skills?

13. **External service access**:
    - Which external services can agents access? (Printful, fal.ai, Gemini, etc.)
    - Are API keys scoped per agent or shared?
    - Is there logging of external API calls?

### Phase 5: Operational Resilience

14. **Error handling & recovery**:
    - What happens when an agent crashes?
    - Is there automatic retry with backoff?
    - Are failures logged and alerted?

15. **Monitoring & observability**:
    - Are agent actions logged? (decisions, tool calls, costs)
    - Is there a dashboard for agent activity?
    - Can suspicious agent behavior be detected?

## Output Format

Generate `AUDIT_PODCLAW_[DATE].md` at workspace root with:

```markdown
# PodClaw Audit — [DATE]

## Agent Inventory
| Agent | Model | Budget | Tools | Sandbox | Status |
|---|---|---|---|---|---|

## Summary
- Total checks: X
- PASS: X | WARN: X | FAIL: X | CRITICAL: X

## Critical Findings
[Security bypasses, missing sandboxing, uncontrolled access]

## Recommendations
[Priority-ordered — security first]
```
