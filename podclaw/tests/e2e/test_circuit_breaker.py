"""
E2E Tests — Circuit Breaker
==============================

Tests the circuit breaker pattern in _shared.py:
- Starts closed (requests pass through)
- Opens after N consecutive failures
- Blocks requests when open
- Resets after timeout
"""

from __future__ import annotations

import time

import pytest

from podclaw.connectors._shared import CircuitBreaker


class TestCircuitBreaker:
    def test_starts_closed(self):
        cb = CircuitBreaker(name="test", failure_threshold=3, timeout=10)
        assert cb.can_attempt() is True

    def test_stays_closed_under_threshold(self):
        cb = CircuitBreaker(name="test", failure_threshold=3, timeout=10)
        cb.record_failure()
        cb.record_failure()
        assert cb.can_attempt() is True  # 2 failures < threshold 3

    def test_opens_at_threshold(self):
        cb = CircuitBreaker(name="test", failure_threshold=3, timeout=10)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.can_attempt() is False  # 3 failures = threshold

    def test_blocks_when_open(self):
        cb = CircuitBreaker(name="test", failure_threshold=2, timeout=60)
        cb.record_failure()
        cb.record_failure()
        # Should be blocked
        assert cb.can_attempt() is False
        assert cb.can_attempt() is False  # Still blocked

    def test_success_resets_counter(self):
        cb = CircuitBreaker(name="test", failure_threshold=3, timeout=10)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()  # Reset
        cb.record_failure()
        cb.record_failure()
        assert cb.can_attempt() is True  # Only 2 failures since last success

    def test_resets_after_timeout(self):
        cb = CircuitBreaker(name="test", failure_threshold=2, timeout=0.1)  # 100ms timeout
        cb.record_failure()
        cb.record_failure()
        assert cb.can_attempt() is False
        time.sleep(0.15)  # Wait for reset
        assert cb.can_attempt() is True  # Should be reset now

    def test_half_open_success_closes(self):
        cb = CircuitBreaker(name="test", failure_threshold=2, timeout=0.1)
        cb.record_failure()
        cb.record_failure()
        assert cb.can_attempt() is False
        time.sleep(0.15)
        assert cb.can_attempt() is True  # Half-open
        cb.record_success()
        assert cb.can_attempt() is True  # Fully closed again

    def test_half_open_failure_stays_half_open(self):
        """In current implementation, half-open failure increments counter
        but doesn't re-open. The next timeout cycle will allow another probe."""
        cb = CircuitBreaker(name="test", failure_threshold=2, timeout=0.1)
        cb.record_failure()
        cb.record_failure()
        time.sleep(0.15)
        assert cb.can_attempt() is True  # Half-open
        cb.record_failure()
        # State is still half-open (record_failure only opens from "closed")
        assert cb.state == "half-open"
