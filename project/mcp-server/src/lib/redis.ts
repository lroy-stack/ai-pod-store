import Redis, { type Redis as RedisClient } from 'ioredis';

let redisClient: RedisClient | null = null;

export function getRedisClient(): RedisClient | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('[Redis] Max retries reached, disabling Redis');
          return null;
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redisClient.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.info('[Redis] Connected successfully');
    });

    // Attempt connection (lazy connect)
    redisClient.connect().catch((err: Error) => {
      console.error('[Redis] Failed to connect:', err.message);
      console.warn('[Redis] Running without Redis (graceful fallback)');
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize client:', error);
    return null;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
