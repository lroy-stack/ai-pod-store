import express from 'express'
import { createClient } from '@supabase/supabase-js'
import redis from 'redis'

const router = express.Router()

// Redis client cache (singleton pattern to avoid multiple connections)
let redisClient: any = null

router.get('/', async (req, res) => {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  }

  // Check database connection
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      // Verify Supabase URL is valid and accessible by making a simple REST API call
      const supabaseUrl = process.env.SUPABASE_URL
      const apiKey = process.env.SUPABASE_SERVICE_KEY

      // Use fetch with timeout to test connectivity
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        health.db = 'connected'
      } else {
        health.db = 'error'
        health.dbError = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        health.db = 'error'
        health.dbError = 'Connection timeout (3s)'
      } else {
        health.db = 'error'
        health.dbError = error.message
      }
    }
  } else {
    health.db = 'not_configured'
  }

  // Check Redis connection (with timeout to avoid hanging)
  // Redis is OPTIONAL - if not available, the app continues to work without it
  if (process.env.REDIS_URL) {
    try {
      // Create or reuse Redis client
      if (!redisClient) {
        redisClient = redis.createClient({
          url: process.env.REDIS_URL,
          socket: {
            connectTimeout: 2000, // 2 second timeout
            reconnectStrategy: false, // Don't auto-reconnect on health checks
          }
        })
        redisClient.on('error', (err: Error) => {
          // Redis errors are logged but don't block the app
          console.warn('Redis not available (this is OK):', err.message)
        })
      }

      if (!redisClient.isOpen) {
        await Promise.race([
          redisClient.connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 2000))
        ])
      }
      await redisClient.ping()
      health.redis = 'connected'
    } catch (error: any) {
      // Redis is optional - graceful degradation
      health.redis = 'not_available'
      health.redisNote = 'Redis not installed (optional - app works without it)'
      // Close the failed client so we can try again next time
      if (redisClient) {
        try {
          await redisClient.quit()
        } catch (e) {
          // Ignore quit errors
        }
        redisClient = null
      }
    }
  } else {
    health.redis = 'not_configured'
  }

  // Only return 503 if DB is in error state (Redis is optional for now)
  const statusCode = health.db === 'error' ? 503 : 200
  res.status(statusCode).json(health)
})

export default router
