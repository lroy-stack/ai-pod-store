"""
PodClaw — Shared Connector Utilities
======================================

Cross-cutting concerns extracted for reuse across all 8 MCP connectors:
CircuitBreaker, RateLimiter, response helpers, validators, retry logic.
"""

from __future__ import annotations

import asyncio
import ipaddress
import os
import re
import socket
import time
from typing import Any, Callable
from urllib.parse import urlparse

import httpx
import structlog

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Safe ID pattern
# ---------------------------------------------------------------------------

_SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9\-_]+$")

# Stripe ID pattern: prefix + alphanumeric
_STRIPE_ID_RE = re.compile(r"^(ch_|in_|re_|dp_|po_|pi_|sub_|cus_|pm_|txn_|pyr_)[a-zA-Z0-9]+$")

# Docker service names to block (SSRF protection)
_BLOCKED_HOSTNAMES = frozenset({
    "localhost", "redis", "caddy", "frontend", "admin", "podclaw",
    "mcp-server", "svg-renderer", "rembg", "crawl4ai", "db", "kong",
    "auth", "rest", "realtime", "storage", "imgproxy", "analytics",
    "vector", "supavisor", "studio", "grafana",
})

# Private IP ranges (SSRF protection)
_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


# ---------------------------------------------------------------------------
# MCP Response helpers
# ---------------------------------------------------------------------------

def _ok(data: Any) -> dict[str, Any]:
    """Standard MCP success response."""
    return {"result": data}


def _err(message: str, status: int = 0) -> dict[str, Any]:
    """Standard MCP error response."""
    return {
        "error": True,
        "message": message[:500],
        "status": status,
        "isError": True,
    }


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

def validate_id(value: str, field_name: str, pattern: re.Pattern = _SAFE_ID_RE) -> None:
    """Validate that an ID parameter is safe for URL interpolation.

    Raises ValueError if invalid.
    """
    if not value or not pattern.match(str(value)):
        raise ValueError(f"Invalid {field_name}: must match {pattern.pattern} (got '{str(value)[:50]}')")


def validate_stripe_id(value: str, field_name: str) -> None:
    """Validate Stripe ID format (prefix + alphanumeric)."""
    validate_id(value, field_name, _STRIPE_ID_RE)


def validate_url(url: str, allowed_hosts: frozenset[str] | None = None) -> None:
    """Validate URL: HTTPS only, optional host allowlist, SSRF check.

    Raises ValueError if invalid.
    """
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"Only HTTPS URLs allowed, got: {parsed.scheme}")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL has no hostname")
    if allowed_hosts and hostname not in allowed_hosts:
        raise ValueError(f"Host not allowed: {hostname}")
    _resolve_and_check_ssrf(hostname)


def validate_ssrf(url: str) -> None:
    """Full SSRF protection: block private IPs, Docker names, unsafe schemes.

    Use for crawl4ai and any connector that fetches user-provided URLs.
    Raises ValueError if blocked.
    """
    parsed = urlparse(url)

    # Block unsafe schemes
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Blocked scheme: {parsed.scheme} (only http/https allowed)")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("URL has no hostname")

    # Block internal Docker service names
    hostname_lower = hostname.lower()
    if hostname_lower in _BLOCKED_HOSTNAMES:
        raise ValueError(f"SSRF blocked: internal hostname '{hostname}'")

    # Block *.internal pattern
    if hostname_lower.endswith(".internal") or hostname_lower.endswith(".local"):
        raise ValueError(f"SSRF blocked: internal domain '{hostname}'")

    # DNS resolution + IP check
    _resolve_and_check_ssrf(hostname)


def _resolve_and_check_ssrf(hostname: str) -> None:
    """Resolve hostname to IP and block private/reserved addresses."""
    try:
        infos = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise ValueError(f"DNS resolution failed for '{hostname}': {e}")

    for info in infos:
        ip_str = info[4][0]
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError(
                f"SSRF blocked: '{hostname}' resolves to private/reserved IP {ip_str}"
            )


def get_supabase_host() -> str:
    """Extract hostname from SUPABASE_URL env var (avoids hardcoding project ID)."""
    url = os.environ.get("SUPABASE_URL", "")
    if url:
        return urlparse(url).hostname or ""
    return ""


# ---------------------------------------------------------------------------
# Circuit Breaker
# ---------------------------------------------------------------------------

class CircuitBreaker:
    """Circuit breaker to prevent cascading failures.

    Opens circuit after `failure_threshold` consecutive failures,
    stays open for `timeout` seconds before allowing a half-open probe.
    """

    def __init__(
        self,
        name: str = "unknown",
        failure_threshold: int = 5,
        timeout: float = 60.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time: float | None = None
        self.state = "closed"  # closed, open, half-open

    def record_success(self) -> None:
        self.failure_count = 0
        if self.state == "half-open":
            self.state = "closed"
            logger.info("circuit_breaker_closed", provider=self.name)

    def record_failure(self) -> None:
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold and self.state == "closed":
            self.state = "open"
            logger.warning(
                "circuit_breaker_opened",
                provider=self.name,
                count=self.failure_count,
            )

    def can_attempt(self) -> bool:
        if self.state == "closed":
            return True
        if self.state == "open":
            if self.last_failure_time and (time.time() - self.last_failure_time) >= self.timeout:
                self.state = "half-open"
                return True
            return False
        return True  # half-open


# ---------------------------------------------------------------------------
# Rate Limiter
# ---------------------------------------------------------------------------

class RateLimiter:
    """Simple token bucket rate limiter.

    Tracks calls within a rolling window and sleeps if limit exceeded.
    """

    def __init__(self, rate_per_minute: int, window: float = 60.0):
        self.rate_per_minute = rate_per_minute
        self.window = window
        self._count = 0
        self._window_start = time.time()

    async def acquire(self) -> None:
        """Wait if rate limit is about to be exceeded."""
        now = time.time()
        if now - self._window_start > self.window:
            self._count = 0
            self._window_start = now
        self._count += 1
        if self._count > self.rate_per_minute:
            wait = self.window - (now - self._window_start) + 0.1
            logger.debug("rate_limit_wait", wait=round(wait, 1))
            await asyncio.sleep(wait)
            self._count = 0
            self._window_start = time.time()


# ---------------------------------------------------------------------------
# Retry with backoff
# ---------------------------------------------------------------------------

async def retry_with_backoff(
    operation: str,
    request_fn: Callable[[], Any],
    circuit_breaker: CircuitBreaker,
    max_attempts: int = 3,
) -> httpx.Response:
    """Retry HTTP requests with exponential backoff for 429/5xx errors.

    Integrates with CircuitBreaker for cascading failure prevention.
    """
    backoff_delays = [2.0, 4.0, 8.0]
    resp = None

    for attempt in range(max_attempts):
        if not circuit_breaker.can_attempt():
            raise httpx.HTTPStatusError(
                f"Circuit breaker open for {circuit_breaker.name}",
                request=None,  # type: ignore[arg-type]
                response=None,  # type: ignore[arg-type]
            )

        try:
            resp = await request_fn()

            if resp.status_code < 400:
                circuit_breaker.record_success()
                return resp

            if resp.status_code == 429 and attempt < max_attempts - 1:
                retry_after = resp.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else backoff_delays[attempt]
                logger.warning(
                    "rate_limited",
                    provider=circuit_breaker.name,
                    op=operation,
                    attempt=attempt + 1,
                    delay=delay,
                )
                await asyncio.sleep(delay)
                continue

            if resp.status_code >= 500 and attempt < max_attempts - 1:
                delay = backoff_delays[attempt]
                logger.warning(
                    "server_error",
                    provider=circuit_breaker.name,
                    op=operation,
                    status=resp.status_code,
                    delay=delay,
                )
                circuit_breaker.record_failure()
                await asyncio.sleep(delay)
                continue

            if resp.status_code >= 400:
                circuit_breaker.record_failure()
                return resp

        except (httpx.RequestError, httpx.TimeoutException) as exc:
            circuit_breaker.record_failure()
            if attempt < max_attempts - 1:
                delay = backoff_delays[attempt]
                logger.warning(
                    "network_error",
                    provider=circuit_breaker.name,
                    op=operation,
                    error=str(exc)[:200],
                    delay=delay,
                )
                await asyncio.sleep(delay)
                continue
            raise

    circuit_breaker.record_failure()
    return resp  # type: ignore[return-value]
