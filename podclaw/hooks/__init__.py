"""
PodClaw — Hook Chains
======================

PreToolUse chain:
  1. security_hook    → Validate inputs, block destructive ops
  2. cost_guard_hook  → Track daily cost per agent, deny if budget exceeded
  3. rate_limit_hook  → Per-tool rate limits

PostToolUse chain:
  1. event_log_hook   → Write immutable event to agent_events table
  2. memory_hook      → Append summary to today's daily log
  3. metrics_hook     → Track tool_calls, latency
"""
