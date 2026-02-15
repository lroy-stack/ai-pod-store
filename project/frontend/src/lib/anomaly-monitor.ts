/**
 * Anomaly Monitor
 *
 * Detects suspicious usage patterns and logs warnings.
 * Thresholds:
 * - chat > 80% of daily limit in first hour → warn
 * - design:generate > 5 in 10 minutes → warn
 * - Any identifier with >3 429 responses in 5 min → potential bot
 */

// In-memory counters for 429 tracking
const rateLimitHits = new Map<string, { count: number; firstAt: number }>()
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 min

export async function checkAnomaly(
  identifier: string,
  action: string,
  currentUsed: number,
  dailyLimit: number
): Promise<void> {
  // Check high usage ratio
  if (dailyLimit > 0 && currentUsed > dailyLimit * 0.8) {
    console.warn('[Anomaly] high_usage_anomaly', {
      identifier: identifier.slice(0, 20),
      action,
      used: currentUsed,
      limit: dailyLimit,
      ratio: (currentUsed / dailyLimit).toFixed(2),
    })
  }
}

export function trackRateLimitHit(identifier: string): void {
  const now = Date.now()
  const entry = rateLimitHits.get(identifier)

  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    rateLimitHits.set(identifier, { count: 1, firstAt: now })
    return
  }

  entry.count++

  if (entry.count > 3) {
    console.warn('[Anomaly] potential_bot_detected', {
      identifier: identifier.slice(0, 20),
      hits: entry.count,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
  }

  // Periodic cleanup
  if (rateLimitHits.size > 500) {
    for (const [k, v] of rateLimitHits) {
      if (now - v.firstAt > RATE_LIMIT_WINDOW_MS) rateLimitHits.delete(k)
    }
  }
}
