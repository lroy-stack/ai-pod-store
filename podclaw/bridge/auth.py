"""
PodClaw Bridge — Authentication & Rate Limiting
=================================================

Bearer token auth with constant-time comparison and
sliding-window rate limiting on failed attempts.
Localhost is exempt (same-host dashboard access).
"""

from __future__ import annotations

import secrets
import time

from fastapi import HTTPException, Request

from podclaw.config import (
    BRIDGE_AUTH_ENABLED,
    BRIDGE_AUTH_TOKEN,
    BRIDGE_RATE_LIMIT_MAX,
    BRIDGE_RATE_LIMIT_WINDOW,
)

LOCALHOST_IPS = frozenset(("127.0.0.1", "::1", "localhost"))
LOCKOUT_SECONDS = 300  # 5 minutes


def extract_bearer_token(authorization: str) -> str | None:
    """Parse ``Authorization: Bearer <token>`` header (case-insensitive prefix)."""
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def verify_token(token: str, expected: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    return secrets.compare_digest(token, expected)


class AuthRateLimiter:
    """In-memory sliding-window rate limiter for failed auth attempts."""

    def __init__(self, max_failures: int, window: int) -> None:
        self._max = max_failures
        self._window = window
        self._failures: dict[str, list[float]] = {}
        self._locked: dict[str, float] = {}

    def _prune(self, ip: str) -> None:
        cutoff = time.monotonic() - self._window
        if ip in self._failures:
            self._failures[ip] = [t for t in self._failures[ip] if t > cutoff]

    def is_blocked(self, ip: str) -> bool:
        # Check lockout first
        if ip in self._locked:
            if time.monotonic() - self._locked[ip] < LOCKOUT_SECONDS:
                return True
            del self._locked[ip]

        self._prune(ip)
        return len(self._failures.get(ip, [])) >= self._max

    def record_failure(self, ip: str) -> None:
        self._prune(ip)
        self._failures.setdefault(ip, []).append(time.monotonic())
        if len(self._failures[ip]) >= self._max:
            self._locked[ip] = time.monotonic()


rate_limiter = AuthRateLimiter(BRIDGE_RATE_LIMIT_MAX, BRIDGE_RATE_LIMIT_WINDOW)


async def require_auth(request: Request) -> None:
    """FastAPI dependency — validates Bearer token on protected routes."""
    if not BRIDGE_AUTH_ENABLED:
        return
    if not BRIDGE_AUTH_TOKEN:
        raise HTTPException(
            503,
            "Bridge auth enabled but PODCLAW_BRIDGE_AUTH_TOKEN not configured"
        )

    ip = request.client.host if request.client else "unknown"

    # Health endpoint is always accessible (for Docker healthchecks)
    if request.url.path == "/health":
        return

    # Rate limit check
    if rate_limiter.is_blocked(ip):
        raise HTTPException(429, "Too many failed attempts")

    # Extract and verify token
    auth_header = request.headers.get("authorization", "")
    token = extract_bearer_token(auth_header)

    if not token or not verify_token(token, BRIDGE_AUTH_TOKEN):
        rate_limiter.record_failure(ip)
        raise HTTPException(401, "Unauthorized")
