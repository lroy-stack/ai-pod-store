# PodClaw — Contributing Guide

## Project Structure

```
podclaw/
├── __init__.py
├── main.py              # Entry point, env loading, component wiring
├── core.py              # Orchestrator — routes tasks to agents
├── client_factory.py    # Creates SDK clients with hooks/tools/budget
├── config.py            # All configuration constants
├── connector_adapter.py # Converts MCP connectors to SDK servers
├── hook_adapters.py     # Adapts hooks to SDK interfaces
├── memory_manager.py    # Three-tier memory consolidation
├── event_store.py       # Immutable event sourcing (Supabase)
├── event_queue.py       # Inter-agent communication queue
├── scheduler.py         # APScheduler cron-based scheduling
├── heartbeat.py         # 30-min health check runner
├── soul_evolution.py    # Controlled SOUL.md mutation
├── bridge/
│   └── api.py           # FastAPI admin bridge (port 8000)
├── hooks/
│   ├── security_hook.py    # Tool allowlist, dangerous pattern detection
│   ├── cost_guard_hook.py  # Daily budget enforcement
│   ├── rate_limit_hook.py  # Per-session rate limits
│   ├── event_log_hook.py   # Event store logging
│   ├── memory_hook.py      # Memory and context updates
│   └── metrics_hook.py     # Timing and metrics
├── connectors/
│   ├── supabase_connector.py
│   ├── stripe_connector.py
│   ├── printify_connector.py
│   ├── fal_connector.py
│   ├── gemini_connector.py
│   ├── resend_connector.py
│   ├── crawl4ai_connector.py     # Web crawling with JS rendering via Crawl4AI service
│   ├── telegram_connector.py
│   └── whatsapp_connector.py
├── skills/
│   ├── researcher/     # SKILL.md + template.md
│   ├── marketing/
│   ├── designer/
│   ├── newsletter/
│   ├── cataloger/
│   ├── customer_manager/
│   ├── seo_manager/
│   └── finance/
├── SOUL.md              # Agent identity (immutable constraints)
├── README.md            # Overview and quickstart
├── AGENTS.md            # Agent definitions and dev guide
├── SECURITY.md          # Threat model and hardening
├── TOOLS.md             # MCP connector reference
├── MEMORY.md            # Memory system documentation
└── CONTRIBUTING.md      # This file
```

## Adding a New Agent

### 1. Create skill files

```bash
mkdir -p skills/my_agent
```

`skills/my_agent/SKILL.md`:
```markdown
# my_agent — Role Description

You are PodClaw's my_agent sub-agent. Your role is to...

## Capabilities
- Tool 1: description
- Tool 2: description

## Task
Your default task each cycle:
1. Step one
2. Step two
3. Update context files with findings
```

`skills/my_agent/template.md` (optional output template):
```markdown
## My Agent Report — {date}

### Key Findings
- ...

### Actions Taken
- ...

### Recommendations
- ...
```

### 2. Register in config.py

```python
# Models
AGENT_MODELS["my_agent"] = MODEL_COMPLEX  # or MODEL_RESEARCH

# Budget
AGENT_DAILY_BUDGETS["my_agent"] = 0.50
AGENT_BUDGETS["my_agent"] = 0.30

# Tools
AGENT_ALLOWED_BUILTINS["my_agent"] = ["Read", "Grep", "Glob"]
AGENT_TOOLS["my_agent"] = ["supabase", "crawl4ai"]

# Context
AGENT_CONTEXT_FILES["my_agent"] = ["relevant_file.md"]

# Rate limits
RATE_LIMITS["my_agent"] = {"crawl_url": 10}
```

### 3. Register in core.py

Add to `AGENT_NAMES` list and `_default_task()` dict.

### 4. Add schedule

In `scheduler.py`, add a cron trigger:
```python
scheduler.add_job(
    orchestrator.run_agent, "cron",
    args=["my_agent"],
    hour=10, minute=0,
    id="my_agent",
)
```

## Adding a New MCP Connector

### 1. Create connector file

`connectors/my_service_connector.py`:
```python
from __future__ import annotations
from typing import Any
import httpx

class MyServiceMCPConnector:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._client = httpx.AsyncClient(
            base_url="https://api.myservice.com/v1",
            headers={"Authorization": f"Bearer {api_key}"},
        )

    def get_tools(self) -> dict[str, dict]:
        return {
            "myservice_action": {
                "description": "Perform an action via MyService API",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "param1": {"type": "string", "description": "..."},
                    },
                    "required": ["param1"],
                },
                "handler": self._handle_action,
            },
        }

    async def _handle_action(self, params: dict[str, Any]) -> dict:
        response = await self._client.post("/action", json=params)
        response.raise_for_status()
        return response.json()
```

### 2. Register in main.py

```python
from podclaw.connectors.my_service_connector import MyServiceMCPConnector

connectors["my_service"] = MyServiceMCPConnector(config.MY_SERVICE_API_KEY)
```

### 3. Add config

In `config.py`:
```python
MY_SERVICE_API_KEY = os.environ.get("MY_SERVICE_API_KEY", "")
```

The `connector_adapter.py` automatically wraps it as an SDK MCP server.

## Adding a New Hook

### PreToolUse deny hook

Add to `hooks/my_hook.py`:
```python
async def my_deny_hook(input_data, tool_use_id, context):
    tool_name = input_data.get("tool_name", "")
    agent_name = input_data.get("_agent_name", "")

    if should_deny(tool_name, agent_name):
        return {
            "hookSpecificOutput": {
                "permissionDecision": "deny",
                "permissionDecisionReason": "Reason for denial",
            }
        }
    return None  # Allow
```

Register in `main.py` → `_build_hooks()`:
```python
"pre_tool_use": [
    security_hook,  # index 0: FAIL-CLOSED
    cost_guard_hook,
    rate_limit_hook,
    my_deny_hook,   # new hook (FAIL-OPEN by default)
    metrics_pre_hook,
],
```

### PostToolUse observation hook

```python
def my_observation_hook(some_dependency):
    async def hook(input_data, tool_use_id, context):
        # Log, record, observe — never block
        tool_name = input_data.get("tool_name", "")
        # ... do observation work ...
    return hook
```

## Task Source of Truth

The **authoritative** default task for each agent is defined in `core.py:_default_task()`.
The `skills/<agent>/SKILL.md` files provide contextual instructions that are injected into
the agent's system prompt — they are supplementary context, not the task definition.

When the scheduler dispatches an agent without an explicit task, `_default_task()` generates
the prompt. Cycle-specific variants (e.g. `cataloger_pricing`, `cataloger_peakprep`) are
also defined there, mapped via `scheduler.py:CYCLE_TASKS`.

**To modify an agent's default behavior**: edit `_default_task()` in `core.py`.
**To modify an agent's knowledge/context**: edit `skills/<agent>/SKILL.md`.

## Code Style

- **Python**: 3.10+ (type hints, `match`, walrus operator OK)
- **Async**: All I/O operations are async/await
- **Logging**: structlog (structured, JSON-capable)
- **Naming**: snake_case for Python, PascalCase for SDK builtins
- **Types**: Use type hints everywhere, prefer `dict[str, Any]` over `Dict[str, Any]`
- **Imports**: `from __future__ import annotations` in every file
- **Error handling**: Fail-closed for security, fail-open for non-critical hooks

## Testing

```bash
# Import check — verifies all modules load without errors
python3 -c "from podclaw.client_factory import ClientFactory; print('OK')"

# Dry run — initializes everything without starting scheduler
python3 -m podclaw.main --workspace ../../ --dry-run

# Bridge health check
curl http://localhost:8000/health
```
