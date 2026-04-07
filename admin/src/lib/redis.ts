/**
 * Redis client with graceful fallback for the admin panel.
 *
 * If Redis is unavailable, operations return null/undefined and the
 * rate limiter falls back to in-memory tracking.
 */

import Redis from 'ioredis'

let redisClient: Redis | null = null
let redisAvailable = false
let redisErrorLogged = false

function initRedis(): Redis | null {
  if (redisClient !== null) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    if (!redisErrorLogged) {
      console.warn('[Redis] REDIS_URL not configured — rate limiting uses in-memory fallback')
      redisErrorLogged = true
    }
    return null
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      lazyConnect: true,
    })

    client.on('error', (err) => {
      if (!redisErrorLogged) {
        console.warn('[Redis] Connection error (in-memory fallback active):', err.message)
        redisErrorLogged = true
      }
      redisAvailable = false
    })

    client.on('connect', () => {
      console.log('[Redis] Admin connected successfully')
      redisAvailable = true
      redisErrorLogged = false
    })

    client.connect().catch((err) => {
      if (!redisErrorLogged) {
        console.warn('[Redis] Failed to connect (in-memory fallback active):', err.message)
        redisErrorLogged = true
      }
      redisAvailable = false
    })

    redisClient = client
    return client
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.warn('[Redis] Initialization failed:', msg)
    return null
  }
}

export function getRedisClient(): Redis | null {
  if (!redisClient) {
    return initRedis()
  }
  return redisClient
}

export function isRedisAvailable(): boolean {
  return redisAvailable && redisClient !== null
}
