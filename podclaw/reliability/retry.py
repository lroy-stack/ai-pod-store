"""
RetryManager — Exponential backoff retry with jitter (Python)

Implements retry logic with exponential backoff and jitter for PodClaw agents.
Handles transient failures in API calls, database operations, and external services.

Usage:
    from podclaw.reliability.retry import with_retry, RetryStrategies

    result = with_retry(
        'fetch-product',
        lambda: requests.get('https://api.example.com/products/123'),
        **RetryStrategies.network
    )
"""

import asyncio
import logging
import random
import time
from typing import Any, Callable, Dict, Optional, TypeVar, Union

logger = logging.getLogger(__name__)

T = TypeVar('T')


class RetryResult:
    """Result of a retry operation"""

    def __init__(
        self,
        success: bool,
        data: Any = None,
        error: Optional[Exception] = None,
        attempts: int = 0
    ):
        self.success = success
        self.data = data
        self.error = error
        self.attempts = attempts

    def __repr__(self) -> str:
        if self.success:
            return f"<RetryResult success=True attempts={self.attempts}>"
        else:
            return f"<RetryResult success=False error={self.error} attempts={self.attempts}>"


def with_retry(
    operation: str,
    fn: Callable[[], T],
    max_retries: int = 3,
    base_delay_ms: int = 1000,
    max_delay_ms: int = 30000,
    jitter: bool = True,
    on_retry: Optional[Callable[[Exception, int, int], None]] = None,
    should_retry: Optional[Callable[[Exception], bool]] = None
) -> RetryResult:
    """
    Execute a function with exponential backoff retry

    Args:
        operation: Operation name for logging
        fn: Function to execute
        max_retries: Maximum number of retries (default: 3)
        base_delay_ms: Base delay in milliseconds (default: 1000)
        max_delay_ms: Maximum delay in milliseconds (default: 30000)
        jitter: Add random jitter to delays (default: True)
        on_retry: Callback function(error, attempt, delay_ms) called before each retry
        should_retry: Function(error) -> bool to determine if error is retryable

    Returns:
        RetryResult with success, data, error, and attempts

    Example:
        >>> result = with_retry(
        ...     'api-call',
        ...     lambda: requests.get('https://api.example.com/data'),
        ...     max_retries=3,
        ...     base_delay_ms=1000
        ... )
        >>> if result.success:
        ...     print('Data:', result.data)
    """
    if should_retry is None:
        should_retry = lambda e: True

    last_error: Optional[Exception] = None
    attempt = 0

    while attempt <= max_retries:
        try:
            attempt += 1
            logger.info(f"[RetryManager] {operation}: attempt {attempt}/{max_retries + 1}")

            data = fn()

            if attempt > 1:
                logger.info(f"[RetryManager] {operation}: succeeded after {attempt} attempts")

            return RetryResult(success=True, data=data, attempts=attempt)

        except Exception as error:
            last_error = error

            # Check if we should retry this error
            if not should_retry(error):
                logger.info(f"[RetryManager] {operation}: non-retryable error")
                return RetryResult(success=False, error=error, attempts=attempt)

            # If this was the last attempt, fail
            if attempt > max_retries:
                logger.error(f"[RetryManager] {operation}: failed after {attempt} attempts")
                return RetryResult(success=False, error=error, attempts=attempt)

            # Calculate backoff delay with exponential growth
            # Formula: min(base_delay * 2^(attempt-1), max_delay)
            delay_ms = min(base_delay_ms * (2 ** (attempt - 1)), max_delay_ms)

            # Add jitter (±25% random variation) to prevent thundering herd
            if jitter:
                jitter_amount = delay_ms * 0.25
                jitter_offset = random.uniform(-jitter_amount, jitter_amount)
                delay_ms = max(0, int(delay_ms + jitter_offset))

            logger.info(
                f"[RetryManager] {operation}: retry {attempt}/{max_retries} "
                f"after {delay_ms}ms (error: {str(error)})"
            )

            # Call on_retry callback if provided
            if on_retry:
                try:
                    on_retry(error, attempt, delay_ms)
                except Exception as callback_error:
                    logger.error(f"[RetryManager] on_retry callback error: {callback_error}")

            # Wait before next retry
            time.sleep(delay_ms / 1000.0)

    # Should never reach here, but return failure just in case
    return RetryResult(
        success=False,
        error=last_error or Exception("Unknown error"),
        attempts=attempt
    )


async def with_retry_async(
    operation: str,
    fn: Callable[[], Any],
    max_retries: int = 3,
    base_delay_ms: int = 1000,
    max_delay_ms: int = 30000,
    jitter: bool = True,
    on_retry: Optional[Callable[[Exception, int, int], None]] = None,
    should_retry: Optional[Callable[[Exception], bool]] = None
) -> RetryResult:
    """
    Async version of with_retry for async functions

    Args:
        Same as with_retry

    Returns:
        RetryResult with success, data, error, and attempts
    """
    if should_retry is None:
        should_retry = lambda e: True

    last_error: Optional[Exception] = None
    attempt = 0

    while attempt <= max_retries:
        try:
            attempt += 1
            logger.info(f"[RetryManager] {operation}: attempt {attempt}/{max_retries + 1}")

            data = await fn()

            if attempt > 1:
                logger.info(f"[RetryManager] {operation}: succeeded after {attempt} attempts")

            return RetryResult(success=True, data=data, attempts=attempt)

        except Exception as error:
            last_error = error

            if not should_retry(error):
                logger.info(f"[RetryManager] {operation}: non-retryable error")
                return RetryResult(success=False, error=error, attempts=attempt)

            if attempt > max_retries:
                logger.error(f"[RetryManager] {operation}: failed after {attempt} attempts")
                return RetryResult(success=False, error=error, attempts=attempt)

            delay_ms = min(base_delay_ms * (2 ** (attempt - 1)), max_delay_ms)

            if jitter:
                jitter_amount = delay_ms * 0.25
                jitter_offset = random.uniform(-jitter_amount, jitter_amount)
                delay_ms = max(0, int(delay_ms + jitter_offset))

            logger.info(
                f"[RetryManager] {operation}: retry {attempt}/{max_retries} "
                f"after {delay_ms}ms (error: {str(error)})"
            )

            if on_retry:
                try:
                    on_retry(error, attempt, delay_ms)
                except Exception as callback_error:
                    logger.error(f"[RetryManager] on_retry callback error: {callback_error}")

            await asyncio.sleep(delay_ms / 1000.0)

    return RetryResult(
        success=False,
        error=last_error or Exception("Unknown error"),
        attempts=attempt
    )


# Predefined retry strategies for common scenarios
RetryStrategies = {
    'network': {
        'max_retries': 5,
        'base_delay_ms': 500,
        'max_delay_ms': 10000,
        'should_retry': lambda e: any(
            keyword in str(e).lower()
            for keyword in ['network', 'timeout', 'connection', 'refused', 'reset']
        ),
    },
    'rate_limit': {
        'max_retries': 3,
        'base_delay_ms': 5000,
        'max_delay_ms': 60000,
        'should_retry': lambda e: any(
            keyword in str(e).lower()
            for keyword in ['rate limit', '429', 'too many requests']
        ),
    },
    'database': {
        'max_retries': 3,
        'base_delay_ms': 1000,
        'max_delay_ms': 10000,
        'should_retry': lambda e: any(
            keyword in str(e).lower()
            for keyword in ['database', 'connection', 'deadlock']
        ) and not any(
            keyword in str(e).lower()
            for keyword in ['unique', 'constraint', 'duplicate']
        ),
    },
    'external_api': {
        'max_retries': 3,
        'base_delay_ms': 2000,
        'max_delay_ms': 30000,
        'should_retry': lambda e: any(
            keyword in str(e).lower()
            for keyword in ['500', '502', '503', '504', 'timeout']
        ),
    },
}
