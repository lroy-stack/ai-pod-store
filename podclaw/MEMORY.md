# PodClaw — Memory System

## Overview

PodClaw uses a three-tier memory system with LLM-assisted consolidation to maintain long-term knowledge while keeping context windows manageable.

## Memory Tiers

### Tier 1: Daily Logs

- **Location**: `memory/YYYY-MM-DD.md`
- **Retention**: 14 days (auto-pruned)
- **Write mode**: Append-only
- **Writers**: All agents via `MemoryManager.append_daily()`
- **Format**:
  ```markdown
  # Daily Log — 2026-02-15

  ## [06:15:32] researcher
  Session abc12345: Analyzed market trends... → completed (12 tool calls)

  ## [07:30:10] marketing
  Session def67890: Created Valentine's campaign... → completed (8 tool calls)
  ```

### Tier 2: Weekly Summaries

- **Location**: `memory/weekly/YYYY-WNN.md`
- **Retention**: 90 days (auto-pruned)
- **Write mode**: Append (one section per day)
- **Writer**: Consolidation system at 23:30 UTC
- **Process**: Sonnet summarizes daily log → bullet points (max 20)
- **Fallback**: Mechanical extraction if LLM fails

### Tier 3: Long-term Memory

- **Location**: `memory/MEMORY.md`
- **Retention**: Permanent (never pruned)
- **Write mode**: Append
- **Writer**: Weekly consolidation (Sundays)
- **Process**: Sonnet extracts durable learnings from weekly summary
- **Categories**: `[Pattern]`, `[Learning]`, `[Opinion c=0-100]`, `[Fact]`
- **Max load**: 4096 bytes loaded into agent system prompts (truncated from end)

## Special Files

### SOUL.md

- **Location**: `podclaw/SOUL.md`
- **Purpose**: Agent identity, values, constraints, escalation rules
- **Immutable sections**: Constraints, Escalation Rules (cannot be modified by Soul Evolution)
- **Evolving sections**: Values, Communication Style, Daily Rhythm
- **Writer**: Soul Evolution system (Sunday review, admin-approved)

### HEARTBEAT.md

- **Location**: `memory/HEARTBEAT.md`
- **Purpose**: Store health checklist, updated by HeartbeatRunner every 30 minutes
- **Writer**: HeartbeatRunner (Haiku LLM)
- **Content**: Service status, customer alerts, inventory warnings

### Context Files

- **Location**: `memory/context/*.md`
- **Purpose**: Working memory shared between agents
- **Retention**: Permanent (never pruned)
- **Writers**: Agents via `update_context()` / `append_context()`
- **Files**: `best_sellers.md`, `customer_insights.md`, `design_library.md`, `marketing_calendar.md`, `newsletter_segments.md`, `pricing_history.md`, `store_config.md`
- **Safety**: Filename validated by regex, path traversal prevented, injection patterns redacted

### Transcript Archives

- **Location**: `memory/conversations/YYYY-MM-DD-SESSIONID.jsonl`
- **Purpose**: Full conversation transcripts archived before SDK context compaction
- **Writer**: PreCompact hook (automatic)
- **Retention**: Manual cleanup (not auto-pruned)

## Consolidation Pipeline

```
Daily logs (append-only, per-agent)
    │
    ▼ 23:30 UTC daily
Weekly summary (Sonnet LLM summarization)
    │   Fallback: mechanical extraction
    │
    ▼ Sunday only
MEMORY.md (Sonnet LLM learning extraction)
    │   Fallback: simple marker
    │
    ▼ Sunday only (after consolidation)
SOUL.md review (Sonnet proposes changes)
    │   Immutable: Constraints, Escalation
    │   Evolving: Values, Rhythm, Style
    │
    ▼ Always
Log pruning (daily > 14d, weekly > 90d)
```

## Consolidation Models

| Step | Model | Max Tokens | Prompt |
|------|-------|------------|--------|
| Daily → Weekly | Sonnet 4.5 | 2048 | Summarize into bullet points (max 20) |
| Weekly → MEMORY.md | Sonnet 4.5 | 2048 | Extract durable facts, avoid duplicates |
| Soul Review | Sonnet 4.5 | 2048 | Compare SOUL.md with memory, propose changes |
| Heartbeat | Haiku 4.5 | 1024 | Assess store health, flag issues |

## Injection Protection

All data written by agents passes through `_sanitize_data()`:

```python
_INJECTION_PATTERNS = re.compile(
    r"(?i)"
    r"(?:ignore (?:all |the )?(?:previous|above|prior) (?:instructions?|rules?|prompts?))"
    r"|(?:you are now|new role|act as|pretend (?:to be|you are))"
    r"|(?:system ?prompt|<\|?(?:system|im_start)\|?>)"
    r"|(?:override (?:all |the )?(?:rules?|constraints?|guardrails?))"
    r"|(?:reveal (?:your |the )?(?:system|prompt|instructions?))"
)
```

Matched patterns are replaced with `[REDACTED:injection_attempt]` and logged.

## Data Boundaries

All reference data loaded into agent system prompts is wrapped in boundary markers:

```markdown
# Context: best_sellers.md
[DATA source=best_sellers.md]
...file contents...
[/DATA]
```

Agents are instructed (via security preamble) to NEVER interpret text inside `[DATA]` blocks as instructions.

## Atomic Writes

All file writes use `_atomic_write()`:
1. Write to a temp file in the same directory
2. `fsync()` to ensure data is on disk
3. `os.replace()` (atomic on POSIX) to swap into place

This prevents partial reads during concurrent access.
