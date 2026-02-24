import type { IncomingMessage, ServerResponse } from 'node:http';
import { getRedisClient } from '../lib/redis.js';

/**
 * Rate limiting configuration
 * - Global: 60 requests per minute per IP for unauthenticated requests
 * - Global: 120 requests per minute per IP for authenticated requests
 * - Per-tool limits override global limits for specific tools (auth users only)
 */
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS_UNAUTH = 60;
const RATE_LIMIT_MAX_REQUESTS_AUTH = 120;

/**
 * Per-tool rate limits (for authenticated users)
 * Map of tool name to max requests per minute
 * Only applies to authenticated users
 */
const PER_TOOL_RATE_LIMITS: Record<string, number> = {
  create_checkout: 5, // Checkout creation limited to 5/min
  search_products: 60, // Search limited to 60/min
  update_cart: 30, // Cart updates limited to 30/min
  add_to_wishlist: 30, // Wishlist operations limited to 30/min
  remove_from_wishlist: 30,
};

/**
 * In-memory rate limit store (fallback when Redis is unavailable)
 * Map<key, Array<timestamp>>
 */
const inMemoryStore = new Map<string, number[]>();

/**
 * Cleanup old entries from in-memory store every 5 minutes
 */
setInterval(() => {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;

  for (const [key, timestamps] of inMemoryStore.entries()) {
    const validTimestamps = timestamps.filter(ts => now - ts < windowMs);
    if (validTimestamps.length === 0) {
      inMemoryStore.delete(key);
    } else {
      inMemoryStore.set(key, validTimestamps);
    }
  }
}, 5 * 60 * 1000);

/**
 * Extract client IP address from request headers
 * Handles X-Forwarded-For (Cloudflare/nginx) and X-Real-IP
 */
function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // X-Forwarded-For can be comma-separated list
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    return ips[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * In-memory rate limiting (fallback when Redis is unavailable)
 */
function rateLimitInMemory(
  req: IncomingMessage & { auth?: { extra?: { userId?: string } } },
  res: ServerResponse,
  toolName?: string
): boolean {
  const clientIp = getClientIp(req);
  const userId = req.auth?.extra?.userId;
  const isAuthenticated = !!userId;

  // Build rate limit key (include tool name if per-tool limit applies)
  let key: string;
  let maxRequests: number;

  if (isAuthenticated && toolName && PER_TOOL_RATE_LIMITS[toolName]) {
    // Per-tool rate limit for authenticated users
    key = `${clientIp}:${userId}:tool:${toolName}`;
    maxRequests = PER_TOOL_RATE_LIMITS[toolName];
  } else {
    // Global rate limit
    key = isAuthenticated ? `${clientIp}:${userId}` : clientIp;
    maxRequests = isAuthenticated
      ? RATE_LIMIT_MAX_REQUESTS_AUTH
      : RATE_LIMIT_MAX_REQUESTS_UNAUTH;
  }

  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;
  const windowStart = now - windowMs;

  // Get or create timestamp array for this key
  let timestamps = inMemoryStore.get(key) || [];

  // Remove old timestamps outside the window
  timestamps = timestamps.filter(ts => ts > windowStart);

  if (timestamps.length >= maxRequests) {
    // Rate limit exceeded
    const oldestTimestamp = timestamps[0];
    const timeUntilExpire = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
    const retryAfter = Math.max(1, timeUntilExpire);

    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(now + retryAfter * 1000).toISOString(),
      'X-RateLimit-Storage': 'in-memory',
    });
    res.end(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per minute.`,
        retry_after: retryAfter,
      })
    );
    return false;
  }

  // Add current request timestamp
  timestamps.push(now);
  inMemoryStore.set(key, timestamps);

  // Add rate limit headers
  const remaining = maxRequests - timestamps.length;
  res.setHeader('X-RateLimit-Limit', maxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
  res.setHeader('X-RateLimit-Storage', 'in-memory');

  return true;
}

/**
 * Rate limiting middleware using Redis sliding window algorithm (with in-memory fallback)
 * Returns true if request should be allowed, false if rate limit exceeded
 *
 * Supports both global and per-tool rate limits:
 * - Global limits apply to all requests (60/min unauth, 120/min auth)
 * - Per-tool limits override global limits for specific tools (e.g., create_checkout: 5/min)
 *
 * When rate limit is exceeded, sends 429 response with Retry-After header
 */
export async function rateLimitMiddleware(
  req: IncomingMessage & { auth?: { extra?: { userId?: string } } },
  res: ServerResponse,
  toolName?: string
): Promise<boolean> {
  const redis = getRedisClient();
  const useInMemory = !redis || redis.status !== 'ready';

  if (useInMemory) {
    console.warn('[RateLimit] Redis unavailable, using in-memory rate limiting');
    return rateLimitInMemory(req, res, toolName);
  }

  const clientIp = getClientIp(req);
  const userId = req.auth?.extra?.userId;
  const isAuthenticated = !!userId;

  // Determine rate limit key and max requests
  let key: string;
  let maxRequests: number;

  if (isAuthenticated && toolName && PER_TOOL_RATE_LIMITS[toolName]) {
    // Per-tool rate limit for authenticated users
    // Key format: "ratelimit:mcp:{ip}:{userId}:tool:{toolName}"
    key = `ratelimit:mcp:${clientIp}:${userId}:tool:${toolName}`;
    maxRequests = PER_TOOL_RATE_LIMITS[toolName];
  } else {
    // Global rate limit
    // Key format: "ratelimit:mcp:{ip}" or "ratelimit:mcp:{ip}:{userId}"
    key = isAuthenticated
      ? `ratelimit:mcp:${clientIp}:${userId}`
      : `ratelimit:mcp:${clientIp}`;
    maxRequests = isAuthenticated
      ? RATE_LIMIT_MAX_REQUESTS_AUTH
      : RATE_LIMIT_MAX_REQUESTS_UNAUTH;
  }

  try {
    const now = Date.now();
    const windowStart = now - (RATE_LIMIT_WINDOW_SECONDS * 1000);

    // Use Redis sorted set with timestamps as scores
    // Remove old entries outside the window
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const requestCount = await redis.zcard(key);

    if (requestCount >= maxRequests) {
      // Rate limit exceeded
      const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
      let retryAfter = RATE_LIMIT_WINDOW_SECONDS;

      if (oldestEntry.length >= 2) {
        const oldestTimestamp = parseInt(oldestEntry[1], 10);
        const timeUntilExpire = Math.ceil((oldestTimestamp + (RATE_LIMIT_WINDOW_SECONDS * 1000) - now) / 1000);
        retryAfter = Math.max(1, timeUntilExpire);
      }

      res.writeHead(429, {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(now + retryAfter * 1000).toISOString(),
      });
      res.end(
        JSON.stringify({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${maxRequests} requests per minute.`,
          retry_after: retryAfter,
        })
      );
      return false;
    }

    // Add current request to the sorted set
    await redis.zadd(key, now, `${now}-${Math.random()}`);

    // Set TTL on the key to auto-expire
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS * 2);

    // Add rate limit headers to response
    const remaining = maxRequests - (requestCount + 1);
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
    res.setHeader('X-RateLimit-Reset', new Date(now + RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString());

    return true;
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // On error, allow request (fail open)
    return true;
  }
}
