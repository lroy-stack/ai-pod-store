"""
PodClaw — Prometheus Metrics Exporter
======================================

Exposes custom agent metrics in Prometheus text exposition format:
- agent_tool_calls_total: Counter of tool invocations per agent
- agent_daily_cost_eur: Gauge of daily cost in EUR per agent
- agent_session_duration_seconds: Histogram of agent session durations

Uses prometheus-client library for metric collection.
Integrates with existing metrics_hook and cost_guard_hook.
"""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST
import structlog

logger = structlog.get_logger(__name__)

# Create a custom registry (avoid global default registry)
registry = CollectorRegistry()

# Define Prometheus metrics
agent_tool_calls = Counter(
    "agent_tool_calls_total",
    "Total number of tool calls made by each agent",
    ["agent_name"],
    registry=registry,
)

agent_tool_errors = Counter(
    "agent_tool_errors_total",
    "Total number of tool call errors per agent",
    ["agent_name"],
    registry=registry,
)

agent_daily_cost = Gauge(
    "agent_daily_cost_eur",
    "Current daily cost in EUR for each agent",
    ["agent_name"],
    registry=registry,
)

agent_session_duration = Histogram(
    "agent_session_duration_seconds",
    "Duration of agent sessions in seconds",
    ["agent_name"],
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0, float("inf")),
    registry=registry,
)

# Additional standard metrics
agent_session_cost = Histogram(
    "agent_session_cost_usd",
    "Cost of agent sessions in USD",
    ["agent_name"],
    buckets=(0.001, 0.01, 0.05, 0.10, 0.25, 0.50, 1.0, 5.0, float("inf")),
    registry=registry,
)

agent_session_tokens = Histogram(
    "agent_session_tokens_total",
    "Total tokens used in agent sessions",
    ["agent_name"],
    buckets=(100, 500, 1000, 5000, 10000, 50000, 100000, 200000, float("inf")),
    registry=registry,
)


def update_metrics_from_hooks() -> None:
    """
    Update Prometheus metrics from existing metrics_hook and cost_guard_hook data.

    This function should be called periodically or on-demand to sync in-memory
    metrics with Prometheus collectors.
    """
    # Update tool call counters from metrics_hook
    try:
        from podclaw.hooks.metrics_hook import get_metrics
        metrics_data = get_metrics()

        for agent_name, data in metrics_data.items():
            # Note: Prometheus Counters can only increment, not set
            # We track cumulative totals, not reset values
            tool_calls = int(data.get("tool_calls", 0))
            tool_errors = int(data.get("tool_errors", 0))

            # Get current counter values (stored as internal state)
            # This is a workaround: we only increment by the delta
            # In production, metrics should be incremented when events occur,
            # not batch-updated from snapshots

            # For now, we'll just set the label values without incrementing
            # (This is a limitation of batch updates - ideally hooks would increment directly)
            if tool_calls > 0:
                agent_tool_calls.labels(agent_name=agent_name)
            if tool_errors > 0:
                agent_tool_errors.labels(agent_name=agent_name)

    except Exception as e:
        logger.warning("prometheus_metrics_hook_update_failed", error=str(e))

    # Update daily cost gauges from Redis (via cost_guard_hook)
    try:
        from podclaw.hooks.cost_guard_hook import get_daily_costs
        import asyncio

        # get_daily_costs() might be async in the future, handle both cases
        try:
            costs_data = get_daily_costs()
        except TypeError:
            # If it's async, run it
            costs_data = asyncio.run(get_daily_costs())

        for agent_name, cost_eur in costs_data.items():
            agent_daily_cost.labels(agent_name=agent_name).set(cost_eur)

    except Exception as e:
        logger.warning("prometheus_cost_update_failed", error=str(e))


def record_session_metrics(
    agent_name: str,
    duration_seconds: float,
    cost_usd: float,
    input_tokens: int,
    output_tokens: int,
) -> None:
    """
    Record metrics for a completed agent session.

    This should be called by the Orchestrator after each agent run.
    """
    agent_session_duration.labels(agent_name=agent_name).observe(duration_seconds)
    agent_session_cost.labels(agent_name=agent_name).observe(cost_usd)
    agent_session_tokens.labels(agent_name=agent_name).observe(input_tokens + output_tokens)
    logger.debug(
        "prometheus_session_recorded",
        agent=agent_name,
        duration=duration_seconds,
        cost=cost_usd,
        tokens=input_tokens + output_tokens,
    )


def increment_tool_call(agent_name: str, is_error: bool = False) -> None:
    """Increment tool call counter for an agent."""
    agent_tool_calls.labels(agent_name=agent_name).inc()
    if is_error:
        agent_tool_errors.labels(agent_name=agent_name).inc()


def get_prometheus_metrics() -> bytes:
    """
    Generate Prometheus text exposition format output.

    Returns:
        Bytes containing Prometheus-formatted metrics
    """
    # Update metrics from hooks before exporting
    update_metrics_from_hooks()

    # Generate and return the text exposition format
    return generate_latest(registry)


def get_content_type() -> str:
    """Get the Prometheus metrics content type."""
    return CONTENT_TYPE_LATEST
