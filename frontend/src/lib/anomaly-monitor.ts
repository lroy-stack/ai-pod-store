/**
 * Anomaly Monitor — Active Blocking
 *
 * Detects suspicious usage patterns and blocks abusive identifiers.
 * - chat > 80% of limit → warn
 * - >5 rate limit hits in 5 min → auto-block 30 min
 * - 5+ messages in <3s → velocity block 30 min (anti-bot)
 */

// In-memory counters for 429 tracking
const rateLimitHits = new Map<string, { count: number; firstAt: number }>()
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000 // 5 min

// Active blocking: identifier → blocked_until timestamp
const blockedIdentifiers = new Map<string, number>()
const DEFAULT_BLOCK_DURATION_MS = 30 * 60 * 1000 // 30 min

// Velocity tracking: identifier → array of timestamps
const velocityTracker = new Map<string, number[]>()
const VELOCITY_WINDOW_MS = 3_000 // 3 seconds
const VELOCITY_THRESHOLD = 5 // 5+ messages in window

/**
 * Check if an identifier is currently blocked.
 */
export function isBlocked(identifier: string): boolean {
  const blockedUntil = blockedIdentifiers.get(identifier)
  if (!blockedUntil) return false

  if (Date.now() >= blockedUntil) {
    blockedIdentifiers.delete(identifier)
    return false
  }
  return true
}

/**
 * Block an identifier for a duration.
 */
export function blockIdentifier(identifier: string, durationMs: number = DEFAULT_BLOCK_DURATION_MS): void {
  blockedIdentifiers.set(identifier, Date.now() + durationMs)

  console.warn('[Anomaly] identifier_blocked', {
    identifier: identifier.slice(0, 20),
    durationMin: Math.round(durationMs / 60_000),
  })

  // Periodic cleanup of expired blocks
  if (blockedIdentifiers.size > 200) {
    const now = Date.now()
    for (const [k, v] of blockedIdentifiers) {
      if (now >= v) blockedIdentifiers.delete(k)
    }
  }
}

export async function checkAnomaly(
  identifier: string,
  action: string,
  currentUsed: number,
  limit: number
): Promise<void> {
  // Check high usage ratio
  if (limit > 0 && currentUsed > limit * 0.8) {
    console.warn('[Anomaly] high_usage_anomaly', {
      identifier: identifier.slice(0, 20),
      action,
      used: currentUsed,
      limit,
      ratio: (currentUsed / limit).toFixed(2),
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

  // Auto-block after 5+ rate limit hits in the window
  if (entry.count > 5) {
    blockIdentifier(identifier, DEFAULT_BLOCK_DURATION_MS)
    rateLimitHits.delete(identifier)
    return
  }

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

/**
 * Velocity check: detect bot-like message speed.
 * Returns false if messages are arriving too fast (5+ in <3 seconds).
 */
export function checkVelocity(identifier: string): boolean {
  const now = Date.now()
  let timestamps = velocityTracker.get(identifier)

  if (!timestamps) {
    velocityTracker.set(identifier, [now])
    return true
  }

  // Remove timestamps outside the window
  timestamps = timestamps.filter(t => now - t < VELOCITY_WINDOW_MS)
  timestamps.push(now)
  velocityTracker.set(identifier, timestamps)

  if (timestamps.length >= VELOCITY_THRESHOLD) {
    // Too fast — block and return false
    blockIdentifier(identifier, DEFAULT_BLOCK_DURATION_MS)
    velocityTracker.delete(identifier)
    console.warn('[Anomaly] velocity_block', {
      identifier: identifier.slice(0, 20),
      messages: timestamps.length,
      windowMs: VELOCITY_WINDOW_MS,
    })
    return false
  }

  // Periodic cleanup
  if (velocityTracker.size > 1000) {
    for (const [k, v] of velocityTracker) {
      if (v.length === 0 || now - v[v.length - 1] > VELOCITY_WINDOW_MS * 2) {
        velocityTracker.delete(k)
      }
    }
  }

  return true
}
