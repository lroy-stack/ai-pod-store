/**
 * Redis client with graceful fallback
 *
 * If Redis is not available, operations gracefully fail and return null/undefined.
 * The application continues to work without caching.
 */

import Redis from 'ioredis'

let redisClient: Redis | null = null
let redisAvailable = false
let redisErrorLogged = false

/**
 * Initialize Redis client with graceful error handling
 */
function initRedis(): Redis | null {
  if (redisClient !== null) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL not configured - caching disabled')
    return null
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      lazyConnect: true, // Don't connect immediately
    })

    client.on('error', (err) => {
      if (!redisErrorLogged) {
        console.warn('[Redis] Connection error (caching disabled):', err.message)
        redisErrorLogged = true
      }
      redisAvailable = false
    })

    client.on('connect', () => {
      console.log('[Redis] Connected successfully')
      redisAvailable = true
      redisErrorLogged = false
    })

    // Try to connect
    client.connect().catch((err) => {
      if (!redisErrorLogged) {
        console.warn('[Redis] Failed to connect (caching disabled):', err.message)
        redisErrorLogged = true
      }
      redisAvailable = false
    })

    redisClient = client
    return client
  } catch (error: any) {
    console.warn('[Redis] Initialization failed (caching disabled):', error.message)
    return null
  }
}

/**
 * Get Redis client (returns null if Redis is not available)
 */
export function getRedisClient(): Redis | null {
  if (!redisClient) {
    return initRedis()
  }
  return redisClient
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisAvailable && redisClient !== null
}

/**
 * Get a value from Redis cache
 * Returns null if Redis is unavailable or key doesn't exist
 */
export async function getCached(key: string): Promise<any | null> {
  const client = getRedisClient()
  if (!client || !redisAvailable) {
    return null
  }

  try {
    const value = await client.get(key)
    if (!value) {
      return null
    }
    return JSON.parse(value)
  } catch (error: any) {
    console.warn('[Redis] Get failed:', error.message)
    return null
  }
}

/**
 * Set a value in Redis cache with TTL (in seconds)
 * Silently fails if Redis is unavailable
 */
export async function setCached(
  key: string,
  value: any,
  ttl: number = 3600
): Promise<void> {
  const client = getRedisClient()
  if (!client || !redisAvailable) {
    return
  }

  try {
    await client.setex(key, ttl, JSON.stringify(value))
  } catch (error: any) {
    console.warn('[Redis] Set failed:', error.message)
  }
}

/**
 * Delete a key from Redis cache
 * Silently fails if Redis is unavailable
 */
export async function deleteCached(key: string): Promise<void> {
  const client = getRedisClient()
  if (!client || !redisAvailable) {
    return
  }

  try {
    await client.del(key)
  } catch (error: any) {
    console.warn('[Redis] Delete failed:', error.message)
  }
}

/**
 * Clear all keys matching a pattern
 * Silently fails if Redis is unavailable
 */
export async function clearPattern(pattern: string): Promise<void> {
  const client = getRedisClient()
  if (!client || !redisAvailable) {
    return
  }

  try {
    const keys = await client.keys(pattern)
    if (keys.length > 0) {
      await client.del(...keys)
    }
  } catch (error: any) {
    console.warn('[Redis] Clear pattern failed:', error.message)
  }
}

/**
 * Get Redis connection status for health checks
 */
export async function getRedisStatus(): Promise<{
  available: boolean
  status: 'connected' | 'disconnected' | 'not_configured'
}> {
  if (!process.env.REDIS_URL) {
    return { available: false, status: 'not_configured' }
  }

  const client = getRedisClient()
  if (!client || !redisAvailable) {
    return { available: false, status: 'disconnected' }
  }

  try {
    await client.ping()
    return { available: true, status: 'connected' }
  } catch (error) {
    return { available: false, status: 'disconnected' }
  }
}
