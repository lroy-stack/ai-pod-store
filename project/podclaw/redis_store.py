"""
PodClaw — Redis Storage Module
================================

Persistent storage for rate limits and daily costs using Redis.
Replaces in-memory dictionaries to survive PodClaw restarts.

Key patterns:
- Rate limits: podclaw:rate:{agent}:{date} → HASH {tool: count}
- Daily costs: podclaw:cost:{agent}:{date} → FLOAT (total cost in EUR)
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as redis
import structlog

logger = structlog.get_logger(__name__)

# Redis connection pool (initialized once)
_redis_pool: Optional[redis.ConnectionPool] = None
_redis_client: Optional[redis.Redis] = None


def init_redis() -> redis.Redis | None:
    """
    Initialize Redis connection pool from environment variable.

    Returns None if REDIS_URL is not set (graceful degradation).
    """
    global _redis_pool, _redis_client

    if _redis_client is not None:
        return _redis_client

    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        logger.warning("redis_disabled", reason="REDIS_URL not set")
        return None

    try:
        _redis_pool = redis.ConnectionPool.from_url(
            redis_url,
            decode_responses=True,
            max_connections=10,
        )
        _redis_client = redis.Redis(connection_pool=_redis_pool)
        logger.info("redis_initialized", url=redis_url.split("@")[-1])  # Hide password
        return _redis_client
    except Exception as e:
        logger.error("redis_init_failed", error=str(e))
        return None


def get_redis() -> redis.Redis | None:
    """Get initialized Redis client, or None if unavailable."""
    return _redis_client


async def close_redis() -> None:
    """Close Redis connection pool (call on shutdown)."""
    global _redis_pool, _redis_client
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None
        _redis_client = None
        logger.info("redis_closed")


def _today_key() -> str:
    """Return current date in YYYY-MM-DD format (UTC)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Rate Limit Operations (HASH)
# ---------------------------------------------------------------------------

async def increment_rate_limit(agent_name: str, tool_name: str) -> int:
    """
    Increment rate limit counter for agent+tool+today.

    Returns the new count, or 1 if Redis is unavailable (fallback mode).
    """
    client = get_redis()
    if not client:
        return 1  # Fallback: always allow (no persistence)

    today = _today_key()
    key = f"podclaw:rate:{agent_name}:{today}"

    try:
        new_count = await client.hincrby(key, tool_name, 1)
        # Set expiration on first write (24 hours)
        if new_count == 1:
            await client.expire(key, 86400)  # 24 hours
        return int(new_count)
    except Exception as e:
        logger.warning("redis_rate_limit_incr_failed", agent=agent_name, tool=tool_name, error=str(e))
        return 1  # Fallback


async def get_rate_limit(agent_name: str, tool_name: str) -> int:
    """
    Get current rate limit count for agent+tool+today.

    Returns 0 if Redis is unavailable or key doesn't exist.
    """
    client = get_redis()
    if not client:
        return 0

    today = _today_key()
    key = f"podclaw:rate:{agent_name}:{today}"

    try:
        count = await client.hget(key, tool_name)
        return int(count) if count else 0
    except Exception as e:
        logger.warning("redis_rate_limit_get_failed", agent=agent_name, tool=tool_name, error=str(e))
        return 0


async def reset_rate_limits(agent_name: str | None = None) -> None:
    """
    Reset rate limit counters for an agent (or all agents if None).

    Used for testing and manual resets.
    """
    client = get_redis()
    if not client:
        return

    today = _today_key()

    try:
        if agent_name:
            key = f"podclaw:rate:{agent_name}:{today}"
            await client.delete(key)
            logger.info("redis_rate_limit_reset", agent=agent_name, date=today)
        else:
            # Delete all rate limit keys for today
            pattern = f"podclaw:rate:*:{today}"
            async for key in client.scan_iter(match=pattern, count=100):
                await client.delete(key)
            logger.info("redis_rate_limit_reset_all", date=today)
    except Exception as e:
        logger.warning("redis_rate_limit_reset_failed", agent=agent_name, error=str(e))


# ---------------------------------------------------------------------------
# Daily Cost Operations (INCRBYFLOAT)
# ---------------------------------------------------------------------------

async def increment_daily_cost(agent_name: str, cost_eur: float) -> float:
    """
    Increment daily cost for agent+today.

    Returns the new total cost in EUR, or the input cost if Redis is unavailable.
    """
    client = get_redis()
    if not client:
        return cost_eur  # Fallback: no persistence

    today = _today_key()
    key = f"podclaw:cost:{agent_name}:{today}"

    try:
        new_total = await client.incrbyfloat(key, cost_eur)
        # Set expiration on first write (7 days for cost records)
        if new_total == cost_eur:
            await client.expire(key, 604800)  # 7 days
        return float(new_total)
    except Exception as e:
        logger.warning("redis_cost_incr_failed", agent=agent_name, cost=cost_eur, error=str(e))
        return cost_eur  # Fallback


async def get_daily_cost(agent_name: str) -> float:
    """
    Get current daily cost for agent+today.

    Returns 0.0 if Redis is unavailable or key doesn't exist.
    """
    client = get_redis()
    if not client:
        return 0.0

    today = _today_key()
    key = f"podclaw:cost:{agent_name}:{today}"

    try:
        cost = await client.get(key)
        return float(cost) if cost else 0.0
    except Exception as e:
        logger.warning("redis_cost_get_failed", agent=agent_name, error=str(e))
        return 0.0


async def get_all_daily_costs() -> dict[str, float]:
    """
    Get daily costs for all agents today.

    Returns empty dict if Redis is unavailable.
    """
    client = get_redis()
    if not client:
        return {}

    today = _today_key()
    pattern = f"podclaw:cost:*:{today}"
    costs = {}

    try:
        async for key in client.scan_iter(match=pattern, count=100):
            # Extract agent_name from key: podclaw:cost:{agent}:{date}
            parts = key.split(":")
            if len(parts) == 4:
                agent_name = parts[2]
                cost = await client.get(key)
                if cost:
                    costs[agent_name] = float(cost)
        return costs
    except Exception as e:
        logger.warning("redis_cost_get_all_failed", error=str(e))
        return {}


async def reset_daily_costs(agent_name: str | None = None) -> None:
    """
    Reset daily cost counters for an agent (or all agents if None).

    Used for testing and manual resets.
    """
    client = get_redis()
    if not client:
        return

    today = _today_key()

    try:
        if agent_name:
            key = f"podclaw:cost:{agent_name}:{today}"
            await client.delete(key)
            logger.info("redis_cost_reset", agent=agent_name, date=today)
        else:
            # Delete all cost keys for today
            pattern = f"podclaw:cost:*:{today}"
            async for key in client.scan_iter(match=pattern, count=100):
                await client.delete(key)
            logger.info("redis_cost_reset_all", date=today)
    except Exception as e:
        logger.warning("redis_cost_reset_failed", agent=agent_name, error=str(e))
