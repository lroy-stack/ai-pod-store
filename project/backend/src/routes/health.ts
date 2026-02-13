import express from 'express'
import { createClient } from '@supabase/supabase-js'
import redis from 'redis'

const router = express.Router()

// Initialize Supabase client (optional - only if env vars are set)
let supabase: any = null
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )
}

// Initialize Redis client (optional - only if env var is set)
let redisClient: any = null
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL,
  })
  redisClient.on('error', (err: Error) => {
    console.error('Redis error:', err)
  })
}

router.get('/', async (req, res) => {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  }

  // Check database connection
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('_health_check')
        .select('*')
        .limit(1)

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "table not found" which is acceptable for health check
        health.db = 'error'
        health.dbError = error.message
      } else {
        health.db = 'connected'
      }
    } catch (error: any) {
      health.db = 'error'
      health.dbError = error.message
    }
  } else {
    health.db = 'not_configured'
  }

  // Check Redis connection
  if (redisClient) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect()
      }
      await redisClient.ping()
      health.redis = 'connected'
    } catch (error: any) {
      health.redis = 'error'
      health.redisError = error.message
    }
  } else {
    health.redis = 'not_configured'
  }

  const statusCode = health.db === 'error' || health.redis === 'error' ? 503 : 200
  res.status(statusCode).json(health)
})

export default router
