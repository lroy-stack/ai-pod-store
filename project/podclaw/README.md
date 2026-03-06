# PodClaw — Autonomous Store Manager

PodClaw is an autonomous AI agent that manages a Print-on-Demand e-commerce store (podai.com) 24/7. Built on the **Anthropic Claude Agent SDK**, it coordinates 8 specialized sub-agents to handle research, marketing, design, cataloging, customer service, SEO, newsletters, and finance.

## Quick Start

```bash
# IMPORTANT: Always use the harness virtualenv
# The venv lives at pod-agent-harness/venv/ and contains all dependencies
# including claude_agent_sdk, structlog, fastapi, supabase, etc.

# From project root (pod_workspace/project/)
cd pod_workspace/project

# Dry run — initialize everything without starting scheduler
../../venv/bin/python -m podclaw.main --workspace ../../ --dry-run

# Full run — start scheduler + FastAPI bridge (port 8000)
../../venv/bin/python3 -m podclaw.main --workspace ../../

# No bridge — scheduler only
../../venv/bin/python -m podclaw.main --workspace ../../ --no-bridge
```

### Environment

PodClaw loads environment variables from:
1. `config/.env.required` (harness config)
2. `project/frontend/.env.local` (overrides with real keys)

Key variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `PRINTIFY_API_TOKEN`, `FAL_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `WHATSAPP_ACCESS_TOKEN`.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   main.py                        │
│  (env loading, connector init, hook chains)      │
└──────────┬──────────────────────────┬────────────┘
           │                          │
  ┌────────▼────────┐     ┌──────────▼──────────┐
  │   Orchestrator   │     │   FastAPI Bridge    │
  │    (core.py)     │     │   (bridge/api.py)   │
  │                  │     │   Port 8000         │
  └────────┬─────────┘     └─────────────────────┘
           │
  ┌────────▼─────────┐
  │  ClientFactory    │
  │ (client_factory)  │
  │                   │
  │ • System prompt   │
  │ • MCP servers     │
  │ • Hook adapters   │
  │ • Budget/sandbox  │
  │ • Tool restrict.  │
  └────────┬──────────┘
           │
  ┌────────▼──────────────────────────────────────┐
  │           Claude Agent SDK Client              │
  │  max_budget_usd │ allowed_tools │ sandbox     │
  │  can_use_tool   │ hooks         │ resume      │
  └────────┬──────────────────────────────────────┘
           │
  ┌────────▼──────────────────────────────────────┐
  │              MCP Connectors (11)               │
  │  supabase │ stripe │ printify │ fal │ gemini  │
  │  resend │ crawl4ai │ telegram │ wa           │
  └───────────────────────────────────────────────┘
```

## Agents

| Agent | Model | Schedule | Budget/Session | Key Tools |
|-------|-------|----------|----------------|-----------|
| researcher | Haiku | 06:00 UTC | $0.30 | crawl4ai, supabase |
| marketing | Sonnet | 07:00, 15:00 UTC | $0.50 | resend, telegram, whatsapp, supabase |
| designer | Sonnet | 07:30 UTC | $0.80 | fal, printify, supabase |
| newsletter | Sonnet | 09:00, 15:30 UTC | $0.40 | resend, gemini, supabase |
| cataloger | Sonnet | 09:30, 18:00 UTC | $0.50 | printify, gemini, supabase |
| customer_manager | Sonnet | 12:00, 22:00 UTC | $0.50 | resend, stripe, telegram, whatsapp |
| seo_manager | Haiku | 10:00 UTC | $0.20 | crawl4ai, supabase |
| finance | Sonnet | 22:30 UTC | $0.40 | stripe, supabase |

## Security

- **Fail-closed security hook**: If the security hook errors, tool calls are denied (not allowed)
- **Budget enforcement**: Dual defense — SDK `max_budget_usd` + custom `cost_guard_hook` for daily limits
- **Tool restrictions**: `allowed_tools` per agent — no agent has Bash access
- **Sandbox**: OS-level isolation via `SandboxSettings` for filesystem and network
- **Prompt injection defense**: Security preamble + `[DATA]` boundary markers in all prompts
- **Rate limiting**: Per-session limits + global daily limits per tool

See [SECURITY.md](SECURITY.md) for the full threat model.

## Memory System

Three-tier consolidation with LLM summarization:

1. **Daily** (`memory/YYYY-MM-DD.md`) — append-only, 14 days retention
2. **Weekly** (`memory/weekly/YYYY-WNN.md`) — Sonnet summarizes daily → weekly at 23:30 UTC
3. **Long-term** (`memory/MEMORY.md`) — Sonnet extracts learnings weekly → permanent

Plus: SOUL.md (identity), HEARTBEAT.md (health), context files, transcript archives.

See [MEMORY.md](MEMORY.md) for the full documentation.

## Bridge API

FastAPI on port 8000. Auth via `PODCLAW_BRIDGE_AUTH_TOKEN` header.

Key endpoints:
- `GET /status` — orchestrator status
- `GET /agents` — agent list with tools and models
- `POST /agents/{name}/run` — trigger agent manually
- `GET /events` — query event store
- `GET /memory/soul` — read SOUL.md
- `GET /heartbeat/status` — heartbeat health
- `GET /queue/peek` — peek at event queue
- `GET /soul/history` — soul change log

## Configuration

All config lives in `podclaw/config.py`. Override via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PODCLAW_DAILY_BUDGET` | 5.0 | Total daily budget (EUR) |
| `PODCLAW_MAX_TURNS_PER_AGENT` | 200 | Max SDK turns per session |
| `PODCLAW_BRIDGE_PORT` | 8000 | Bridge API port |
| `PODCLAW_HEARTBEAT_INTERVAL` | 30 | Heartbeat interval (min) |
| `PODCLAW_JSON_LOGS` | false | JSON structured logging |
| `PODCLAW_HEARTBEAT_ENABLED` | true | Enable heartbeat runner |
| `PODCLAW_SOUL_EVOLUTION_ENABLED` | true | Enable soul evolution |

## Documentation

- [AGENTS.md](AGENTS.md) — Agent definitions and development guide
- [SECURITY.md](SECURITY.md) — Threat model and hardening
- [TOOLS.md](TOOLS.md) — MCP connector reference
- [MEMORY.md](MEMORY.md) — Memory system and consolidation pipeline
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to add agents, connectors, hooks
- [SOUL.md](SOUL.md) — Agent identity (immutable constraints + evolving values)
