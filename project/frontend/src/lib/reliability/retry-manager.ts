/**
 * RetryManager — Exponential backoff retry with jitter
 *
 * Implements retry logic with exponential backoff and jitter to handle
 * transient failures (network errors, API rate limits, temporary outages).
 *
 * @module reliability/retry-manager
 */

export interface RetryOptions {
  maxRetries?: number // Default: 3
  baseDelayMs?: number // Default: 1000 (1 second)
  maxDelayMs?: number // Default: 30000 (30 seconds)
  jitter?: boolean // Default: true
  onRetry?: (error: Error, attempt: number, delayMs: number) => void
  shouldRetry?: (error: Error) => boolean // Default: retry all errors
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
}

/**
 * Execute a function with exponential backoff retry
 *
 * @param operation - Operation name for logging
 * @param fn - Async function to execute
 * @param opts - Retry options
 * @returns Promise<RetryResult<T>>
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   'fetch-user',
 *   async () => {
 *     const response = await fetch('/api/users/123')
 *     if (!response.ok) throw new Error('API error')
 *     return response.json()
 *   },
 *   {
 *     maxRetries: 3,
 *     baseDelayMs: 1000,
 *     onRetry: (err, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${err.message}`)
 *     }
 *   }
 * )
 * if (result.success) {
 *   console.log('User:', result.data)
 * } else {
 *   console.error('Failed after retries:', result.error)
 * }
 * ```
 */
export async function withRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitter = true,
    onRetry,
    shouldRetry = () => true,
  } = opts

  let lastError: Error | undefined
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      attempt++
      console.log(`[RetryManager] ${operation}: attempt ${attempt}/${maxRetries + 1}`)

      const data = await fn()

      if (attempt > 1) {
        console.log(`[RetryManager] ${operation}: succeeded after ${attempt} attempts`)
      }

      return {
        success: true,
        data,
        attempts: attempt,
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry this error
      if (!shouldRetry(lastError)) {
        console.log(`[RetryManager] ${operation}: non-retryable error`)
        return {
          success: false,
          error: lastError,
          attempts: attempt,
        }
      }

      // If this was the last attempt, fail
      if (attempt > maxRetries) {
        console.error(`[RetryManager] ${operation}: failed after ${attempt} attempts`)
        return {
          success: false,
          error: lastError,
          attempts: attempt,
        }
      }

      // Calculate backoff delay with exponential growth
      // Formula: min(baseDelay * 2^(attempt-1), maxDelay)
      let delayMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs)

      // Add jitter (±25% random variation) to prevent thundering herd
      if (jitter) {
        const jitterAmount = delayMs * 0.25
        const jitterOffset = Math.random() * jitterAmount * 2 - jitterAmount
        delayMs = Math.max(0, Math.round(delayMs + jitterOffset))
      }

      console.log(
        `[RetryManager] ${operation}: retry ${attempt}/${maxRetries} after ${delayMs}ms (error: ${lastError.message})`
      )

      // Call onRetry callback if provided
      if (onRetry) {
        try {
          onRetry(lastError, attempt, delayMs)
        } catch (callbackError) {
          console.error('[RetryManager] onRetry callback error:', callbackError)
        }
      }

      // Wait before next retry
      await sleep(delayMs)
    }
  }

  // Should never reach here, but TypeScript requires a return
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: attempt,
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Predefined retry strategies for common scenarios
 */
export const RetryStrategies = {
  /**
   * Network errors: aggressive retries (5 attempts, 500ms base)
   */
  network: {
    maxRetries: 5,
    baseDelayMs: 500,
    maxDelayMs: 10000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase()
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnreset') ||
        message.includes('econnrefused')
      )
    },
  },

  /**
   * API rate limits: patient retries (3 attempts, 5s base)
   */
  rateLimit: {
    maxRetries: 3,
    baseDelayMs: 5000,
    maxDelayMs: 60000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase()
      return message.includes('rate limit') || message.includes('429')
    },
  },

  /**
   * Database errors: moderate retries (3 attempts, 1s base)
   */
  database: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase()
      // Retry on transient DB errors, but not constraint violations
      return (
        (message.includes('database') ||
          message.includes('connection') ||
          message.includes('deadlock')) &&
        !message.includes('unique') &&
        !message.includes('constraint')
      )
    },
  },

  /**
   * External API errors: standard retries (3 attempts, 2s base)
   */
  externalApi: {
    maxRetries: 3,
    baseDelayMs: 2000,
    maxDelayMs: 30000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase()
      // Retry on 5xx errors, but not 4xx (client errors)
      return (
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504') ||
        message.includes('timeout')
      )
    },
  },
}

/**
 * Execute multiple operations in parallel with retries
 *
 * @param operations - Array of {name, fn, opts} operations
 * @returns Promise<RetryResult<T>[]> - Results for all operations
 */
export async function withRetryAll<T>(
  operations: Array<{
    name: string
    fn: () => Promise<T>
    opts?: RetryOptions
  }>
): Promise<RetryResult<T>[]> {
  return Promise.all(
    operations.map(({ name, fn, opts }) => withRetry(name, fn, opts))
  )
}
