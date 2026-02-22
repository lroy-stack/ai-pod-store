import { randomBytes } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { getRedisClient } from './redis.js';

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Get or create a session ID from the request headers
 * If Redis is available, store session state with 30-min TTL
 */
export async function getOrCreateSessionId(req: IncomingMessage): Promise<string> {
  // Check if client provided a session ID
  let sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId) {
    // Generate new session ID
    sessionId = generateSessionId();
    console.info(`[Session] Created new session: ${sessionId}`);
  } else {
    console.info(`[Session] Using existing session: ${sessionId}`);
  }

  // Store in Redis if available (30 minute TTL)
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      const key = `mcp:session:${sessionId}`;
      await redis.setex(key, 1800, JSON.stringify({ createdAt: Date.now() }));
    } catch (error) {
      console.warn('[Session] Failed to store session in Redis:', error);
    }
  }

  return sessionId;
}

/**
 * Validate that a session exists (in Redis if available)
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      const key = `mcp:session:${sessionId}`;
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      console.warn('[Session] Failed to validate session in Redis:', error);
      return true; // Graceful fallback - assume valid if Redis fails
    }
  }
  return true; // No Redis - all sessions valid
}
