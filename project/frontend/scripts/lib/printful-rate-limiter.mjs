/**
 * Printful API Rate Limiter — Reusable ESM utility for migration scripts.
 *
 * Features:
 *   - Token bucket: 120 req/min with sliding 60s window
 *   - 429 handling: reads Retry-After header, fallback 60s, jitter +/-25%
 *   - Proactive slowdown: pauses 5s when x-ratelimit-remaining < 10
 *   - Exponential backoff: base*2^attempt, max 3 retries for 429 and 5xx
 *   - Envelope unwrap: Printful's { code, result } -> returns .result
 *   - Diagnostic logging with timestamps
 *
 * Usage:
 *   import { createPrintfulClient, delay } from './lib/printful-rate-limiter.mjs';
 *   const pf = createPrintfulClient(PF_TOKEN, PF_STORE);
 *   const product = await pf.fetch('/store/products/123');
 */

const PRINTFUL_API_BASE = 'https://api.printful.com';
const RATE_LIMIT_PER_MIN = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1_000;
const PROACTIVE_PAUSE_MS = 5_000;
const PROACTIVE_THRESHOLD = 10;
const DEFAULT_RETRY_AFTER_S = 60;
const JITTER_FACTOR = 0.25;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * Exported for use in scripts that need inter-call delays.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ISO timestamp for log lines.
 * @returns {string}
 */
function ts() {
  return new Date().toISOString();
}

/**
 * Apply jitter of +/-25% to a duration.
 * @param {number} ms  base duration in milliseconds
 * @returns {number}
 */
function withJitter(ms) {
  const factor = 1 + (Math.random() * 2 - 1) * JITTER_FACTOR;
  return Math.round(ms * factor);
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a rate-limited Printful API client.
 *
 * @param {string} token   Printful OAuth / API token
 * @param {string} storeId Printful Store ID (passed as X-PF-Store-Id header)
 * @returns {{ fetch: (endpoint: string, options?: RequestInit) => Promise<any> }}
 */
export function createPrintfulClient(token, storeId) {
  if (!token) throw new Error('createPrintfulClient: token is required');
  if (!storeId) throw new Error('createPrintfulClient: storeId is required');

  const defaultHeaders = {
    Authorization: `Bearer ${token}`,
    'X-PF-Store-Id': storeId,
    'Content-Type': 'application/json',
    'User-Agent': 'POD-AI-Store/1.0',
  };

  // Token bucket state (sliding window)
  const bucket = { count: 0, windowStart: Date.now() };

  // ── Rate limiter (proactive) ────────────────────────────────────────────

  async function enforceRateLimit() {
    const now = Date.now();

    // Reset window if expired
    if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
      bucket.count = 0;
      bucket.windowStart = now;
    }

    bucket.count++;

    // If bucket exhausted, wait for the window to end + small buffer
    if (bucket.count > RATE_LIMIT_PER_MIN) {
      const waitMs = RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart) + 100;
      console.log(
        `[${ts()}] [rate-limiter] Bucket exhausted (${bucket.count}/${RATE_LIMIT_PER_MIN}). ` +
          `Waiting ${waitMs}ms for window reset.`,
      );
      await delay(waitMs);
      bucket.count = 0;
      bucket.windowStart = Date.now();
    }
  }

  // ── Proactive slowdown based on response header ─────────────────────────

  async function proactiveSlowdown(response) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining !== null) {
      const value = parseInt(remaining, 10);
      if (!Number.isNaN(value) && value < PROACTIVE_THRESHOLD) {
        console.log(
          `[${ts()}] [rate-limiter] x-ratelimit-remaining=${value} (< ${PROACTIVE_THRESHOLD}). ` +
            `Proactive pause ${PROACTIVE_PAUSE_MS}ms.`,
        );
        await delay(PROACTIVE_PAUSE_MS);
      }
    }
  }

  // ── Core fetch with retries ─────────────────────────────────────────────

  /**
   * Fetch a Printful API endpoint with automatic rate limiting, retries, and
   * envelope unwrapping.
   *
   * @param {string} endpoint  API path starting with `/`, e.g. `/store/products/123`
   * @param {RequestInit} [options]  Standard fetch options (method, body, headers, etc.)
   * @returns {Promise<any>}  The unwrapped `.result` from Printful's response envelope
   * @throws {Error} On non-retryable HTTP errors or after retry exhaustion
   */
  async function pfFetch(endpoint, options = {}) {
    const method = (options.method ?? 'GET').toUpperCase();
    const url = `${PRINTFUL_API_BASE}${endpoint}`;

    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Enforce token bucket before every request
      await enforceRateLimit();

      if (attempt > 0) {
        console.log(
          `[${ts()}] [rate-limiter] Retry ${attempt}/${MAX_RETRIES} for ${method} ${endpoint}`,
        );
      }

      let response;
      try {
        response = await fetch(url, {
          ...options,
          method,
          headers: {
            ...defaultHeaders,
            ...(options.headers ?? {}),
          },
        });
      } catch (err) {
        // Network errors (DNS, timeout, connection refused)
        lastError = err;
        if (attempt < MAX_RETRIES) {
          const backoff = withJitter(BACKOFF_BASE_MS * Math.pow(2, attempt));
          console.log(
            `[${ts()}] [rate-limiter] Network error on ${method} ${endpoint}: ${err.message}. ` +
              `Backoff ${backoff}ms.`,
          );
          await delay(backoff);
          continue;
        }
        throw new Error(
          `Printful network error after ${MAX_RETRIES} retries: ${err.message}`,
        );
      }

      // ── 429 Too Many Requests ─────────────────────────────────────

      if (response.status === 429) {
        const retryAfterRaw = response.headers.get('Retry-After');
        const retryAfterS = retryAfterRaw
          ? parseInt(retryAfterRaw, 10)
          : DEFAULT_RETRY_AFTER_S;
        const retryAfterMs = withJitter(
          (Number.isNaN(retryAfterS) ? DEFAULT_RETRY_AFTER_S : retryAfterS) * 1000,
        );

        console.log(
          `[${ts()}] [rate-limiter] 429 on ${method} ${endpoint}. ` +
            `Retry-After: ${retryAfterRaw ?? 'absent'} -> waiting ${retryAfterMs}ms.`,
        );

        if (attempt < MAX_RETRIES) {
          await delay(retryAfterMs);
          // Reset bucket since we were told to wait
          bucket.count = 0;
          bucket.windowStart = Date.now();
          continue;
        }
        throw new Error(
          `Printful rate limited (429) after ${MAX_RETRIES} retries on ${method} ${endpoint}`,
        );
      }

      // ── 5xx Server Errors ─────────────────────────────────────────

      if (response.status >= 500) {
        const backoff = withJitter(BACKOFF_BASE_MS * Math.pow(2, attempt));
        console.log(
          `[${ts()}] [rate-limiter] ${response.status} on ${method} ${endpoint}. ` +
            `Backoff ${backoff}ms.`,
        );

        if (attempt < MAX_RETRIES) {
          await delay(backoff);
          continue;
        }

        const body = await response.text().catch(() => '');
        throw new Error(
          `Printful server error ${response.status} after ${MAX_RETRIES} retries ` +
            `on ${method} ${endpoint}: ${body}`,
        );
      }

      // ── Proactive slowdown check ──────────────────────────────────

      await proactiveSlowdown(response);

      // ── 401 Unauthorized ──────────────────────────────────────────

      if (response.status === 401) {
        throw new Error(
          `Printful auth failed (401) on ${method} ${endpoint}. Check your API token.`,
        );
      }

      // ── Other client errors (4xx except 429) ──────────────────────

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        let message = `${response.status} ${response.statusText}`;
        try {
          const parsed = JSON.parse(body);
          message =
            parsed.error?.message ?? parsed.message ?? parsed.result ?? message;
        } catch {
          if (body) message += `: ${body}`;
        }
        throw new Error(
          `Printful API error on ${method} ${endpoint}: ${message}`,
        );
      }

      // ── Success — unwrap envelope ─────────────────────────────────

      const json = await response.json();

      // Printful wraps all responses in { code, result, paging? }
      // Return .result when the envelope exists, otherwise the raw payload
      const result = json.result !== undefined ? json.result : json;

      console.log(
        `[${ts()}] [rate-limiter] ${method} ${endpoint} -> ${response.status} OK` +
          (Array.isArray(result)
            ? ` (${result.length} items)`
            : ''),
      );

      return result;
    }

    // Should not reach here, but just in case
    throw lastError ?? new Error(`Printful request failed on ${method} ${endpoint}`);
  }

  return { fetch: pfFetch };
}
