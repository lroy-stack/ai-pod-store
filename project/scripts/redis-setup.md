# Redis Setup Guide

Redis is used for sessions, caching, and semantic cache in the POD AI Store platform.

## Quick Start

### Option 1: Homebrew (macOS)

```bash
# Install Redis
brew install redis

# Start Redis as a service
brew services start redis

# Or start manually
redis-server

# Test connection
redis-cli ping
# Should return: PONG
```

### Option 2: Docker

```bash
# Run Redis in Docker
docker run -d \
  --name pod-redis \
  -p 6379:6379 \
  redis:alpine

# Test connection
docker exec -it pod-redis redis-cli ping
# Should return: PONG
```

### Option 3: Cloud Redis

Use a managed Redis service:

- **Upstash** (free tier): https://upstash.com
- **Redis Cloud** (free tier): https://redis.com/try-free
- **Railway**: https://railway.app

Example Upstash URL:
```env
REDIS_URL=rediss://default:your-password@your-endpoint.upstash.io:6379
```

## Environment Configuration

Add to `backend/.env`:

```env
# Local Redis
REDIS_URL=redis://localhost:6379

# Or cloud Redis with password
REDIS_URL=redis://username:password@host:port

# Or Redis with TLS (rediss://)
REDIS_URL=rediss://default:password@host:port
```

## Health Check

Test Redis connection:

```bash
curl http://localhost:3000/api/health

# Expected response:
{
  "status": "ok",
  "db": "connected",
  "redis": "connected"  # ← Should show "connected"
}
```

## Redis Usage in POD Platform

### 1. Session Storage

```typescript
// User sessions (with 7-day TTL)
await redis.setex(`session:${sessionId}`, 604800, JSON.stringify(sessionData))
```

### 2. Product Catalog Cache

```typescript
// Cache product list (1 hour TTL)
await redis.setex('products:all', 3600, JSON.stringify(products))
```

### 3. Semantic Cache (RAG Pipeline)

```typescript
// Cache RAG query results by embedding hash
const cacheKey = `rag:${hashEmbedding(queryEmbedding)}`
await redis.setex(cacheKey, 3600, JSON.stringify(results))
```

### 4. Translation Cache

```typescript
// Cache translations per locale
await redis.setex(`translations:${locale}`, 86400, JSON.stringify(messages))
```

### 5. Rate Limiting

```typescript
// API rate limiting (100 requests per minute)
const key = `ratelimit:${userId}:${minute}`
await redis.incr(key)
await redis.expire(key, 60)
```

## Monitoring

### CLI Commands

```bash
# Connect to Redis
redis-cli

# View all keys
KEYS *

# Get a value
GET products:all

# Check memory usage
INFO memory

# Monitor live commands
MONITOR

# Clear all data (DANGER!)
FLUSHALL
```

### Redis Commander (GUI)

```bash
# Install Redis Commander
npm install -g redis-commander

# Start GUI
redis-commander

# Open http://localhost:8081
```

## Production Recommendations

1. **Enable persistence**: Add `appendonly yes` to redis.conf
2. **Set max memory**: `maxmemory 256mb` + eviction policy
3. **Use connection pooling**: Configure `ioredis` with pool settings
4. **Enable TLS**: Use `rediss://` protocol in production
5. **Set up monitoring**: Use Redis monitoring tools

## Troubleshooting

### Connection refused

```bash
# Check if Redis is running
ps aux | grep redis

# Restart Redis
brew services restart redis
# Or
docker restart pod-redis
```

### Memory issues

```bash
# Check memory usage
redis-cli INFO memory

# Clear cache
redis-cli FLUSHDB
```

### Permission denied

```bash
# Check Redis config
redis-cli CONFIG GET requirepass

# Set password if needed
redis-cli CONFIG SET requirepass "your-password"
```

## Next Steps

After Redis setup:

1. ✅ Test `/api/health` endpoint shows `"redis": "connected"`
2. ✅ Implement session management (`backend/src/middleware/session.ts`)
3. ✅ Add RAG semantic cache (`backend/src/services/rag/cache.ts`)
4. ✅ Configure rate limiting middleware
