# PodClaw — Agent Definitions

## Agent Table

| Agent | Model | Schedule | Session Budget | Daily Budget | MCP Connectors | Built-in Tools | Context Files |
|-------|-------|----------|---------------|-------------|----------------|----------------|---------------|
| researcher | Haiku 4.5 | 06:00 | $0.60 | €1.50 | supabase, crawl4ai | Read, Write, Grep, Glob, WebSearch, WebFetch | best_sellers.md, customer_insights.md, pricing_history.md |
| marketing | Sonnet 4.5 | 07:00, 15:00 | $1.00 | €2.00 | supabase, crawl4ai, resend, telegram, whatsapp | Read, Write, Grep, Glob | best_sellers.md, customer_insights.md, design_library.md, marketing_calendar.md |
| designer | Sonnet 4.5 | 07:00 | $1.50 | €3.00 | supabase, fal, printify, crawl4ai, gemini | Read, Write, Glob | design_library.md, best_sellers.md, product_specs.md, design_workflow.md, qa_report.md |
| newsletter | Sonnet 4.5 | 09:00, 17:00 | $0.80 | €1.50 | supabase, resend, gemini | Read, Write, Grep | customer_insights.md, marketing_calendar.md, newsletter_segments.md |
| cataloger | Sonnet 4.5 | 08:00, 14:00, 18:00 | $6.00 | €15.00 | supabase, printify, gemini | Read, Write, Grep, Glob | best_sellers.md, pricing_history.md, product_specs.md, product_workflow.md, design_library.md, qa_report.md |
| customer_manager | Sonnet 4.5 | 12:00, 22:00 | $1.00 | €2.00 | supabase, resend, stripe, telegram, whatsapp, printify | Read, Write, Grep | customer_insights.md, store_config.md |
| seo_manager | Haiku 4.5 | 16:00 (Sun) | $0.50 | €1.00 | supabase, crawl4ai | Read, Grep, Glob, WebSearch, WebFetch | best_sellers.md |
| finance | Sonnet 4.5 | 23:00 | $1.20 | €2.50 | supabase, stripe | Read, Write, Grep, Glob | pricing_history.md, store_config.md |
| qa_inspector | Haiku 4.5 | 10:00 | $0.15 | €0.15 | supabase, gemini, printify | Read, Write, Glob | design_library.md, qa_report.md, last_session_feedback.md |
| brand_manager | Sonnet 4.5 | 08:00 (Mon) | $0.80 | €1.50 | supabase, printify | Read, Write, Grep, Glob | brand_config.md, store_config.md |

## Execution Flow

```
APScheduler cron trigger
    → Orchestrator.run_agent(agent_name)
        → Check: agent not already running (session lock)
        → Reset rate limit counters
        → ClientFactory.create_client(agent_name, session_id, resume)
            → Build system prompt (security preamble + SKILL.md + context)
            → Select MCP servers (AGENT_TOOLS mapping)
            → Build allowed_tools (builtins + MCP tools)
            → Configure hooks (can_use_tool, PreCompact, Stop, PostToolUseFailure)
            → Set budget (max_budget_usd), sandbox, output_format
        → SDK Client.connect()
        → SDK Client.query(task)
        → Stream ResultMessage (tool calls + text)
        → Persist SDK session ID for resume
        → Log to daily memory + event store
```

## Agent-Specific Notes

### researcher
- Uses Haiku for cost efficiency — research tasks are read-heavy, not generative
- Updates `best_sellers.md` and `customer_insights.md` context files
- Structured output: `{trends, opportunities, threats}` JSON schema

### marketing
- Manages multi-channel campaigns: email (Resend), Telegram, WhatsApp
- Reads marketing_calendar.md to coordinate with newsletter and designer
- Rate limited: 30 emails, 50 Telegram/WhatsApp messages per session

### designer
- Highest budget ($1.50/session) due to fal.ai image generation costs
- Creates product designs and uploads to Printify
- Rate limited: 10 fal_generate, 10 crawl_url for design inspiration per session
- Reads qa_report.md for quality feedback from QA inspector

### newsletter
- Manages email campaigns with Gemini embeddings for personalization
- Uses subscriber segments from newsletter_segments.md
- Rate limited: 500 emails per session (bulk sends)

### cataloger
- Syncs products between Supabase and Printify
- Uses Gemini embeddings for product similarity/recommendation
- Rate limited: 50 creates, 50 publishes, 10 deletes per session

### customer_manager
- Handles customer support tickets, refund requests, retention emails
- Refunds > EUR 100 require admin approval (escalation rule)
- Can process up to 10 refunds per session via Stripe

### seo_manager
- Uses Haiku for efficiency — SEO tasks are analytical
- Audits meta tags, analyzes competitor pages, optimizes descriptions
- Rate limited: 10 crawl_url, 2 crawl_site, 5 capture_screenshot per session

### finance
- Generates structured daily revenue reports (JSON schema)
- Reconciles Stripe payments with Supabase order records
- Rate limited: 5 refunds per session (safety constraint)

### qa_inspector
- Lightweight verification using Haiku ($0.15/session)
- Verifies design quality, product integrity, variant sync
- Writes qa_report.md consumed by designer and cataloger
- Rate limited: 20 gemini_check_image, 10 printify_get_product per session

### brand_manager
- Weekly brand audit (Monday 08:00 UTC)
- Audits neck labels on apparel products only (skips if not configured)
- Structured output: `{products_audited, labels_applied, issues_found}`
- Rate limited: 50 printify_update, 30 printify_get_product per session

## Development Guide

### Adding a New Agent

1. Create `skills/<agent_name>/SKILL.md` with the agent's role, capabilities, and task description
2. Create `skills/<agent_name>/template.md` with output format template
3. Add entry to `config.py`:
   - `AGENT_MODELS` — model selection
   - `AGENT_DAILY_BUDGETS` — daily cost limit
   - `AGENT_BUDGETS` — per-session SDK budget
   - `AGENT_ALLOWED_BUILTINS` — permitted built-in tools
   - `AGENT_TOOLS` — MCP connector mapping
   - `AGENT_CONTEXT_FILES` — context files loaded into prompt
   - `RATE_LIMITS` — per-tool rate limits
4. Add name to `core.py` → `AGENT_NAMES` list
5. Add default task to `Orchestrator._default_task()`
6. Add schedule entry in `scheduler.py`
7. (Optional) Add output schema to `AGENT_OUTPUT_SCHEMAS`

### Naming Conventions

- Agent names: `snake_case` (e.g., `customer_manager`)
- MCP connector names: `snake_case` (e.g., `crawl4ai`)
- MCP tool names: `snake_case` (e.g., `stripe_create_refund`)
- SDK tool names: `PascalCase` for builtins (e.g., `Read`, `Grep`, `Glob`)
- MCP tool refs in SDK: `mcp__{connector}__{tool_name}`

### Multi-Agent Safety

- **No concurrent writes**: Only one agent runs at a time per agent name (enforced by `_session_lock`)
- **Context file ownership**: Multiple agents may read the same context file, but writes should be coordinated through the memory manager's `_write_lock`
- **Rate limit isolation**: Each agent session resets its own rate limit counters
- **Budget isolation**: Each agent has its own `max_budget_usd` — one agent cannot consume another's budget

### Testing

```bash
# Import check
python3 -c "from podclaw.client_factory import ClientFactory; print('OK')"

# Dry run (init without scheduling)
python3 -m podclaw.main --workspace ../../ --dry-run

# Single agent test (via bridge API)
curl -X POST http://localhost:8000/agents/researcher/run \
  -H "Authorization: Bearer $PODCLAW_BRIDGE_AUTH_TOKEN"
```
