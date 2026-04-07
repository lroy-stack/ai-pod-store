import { getRedisClient } from './lib/redis.js';

export interface SessionMetadata {
  session_id: string;
  user_id?: string; // From JWT auth
  created_at: string; // ISO timestamp
  last_used: string; // ISO timestamp
}

const SESSION_TTL = 3600; // 1 hour in seconds
const SESSION_KEY_PREFIX = 'mcp:session:';

/**
 * Save session metadata to Redis when a new session is initialized.
 * Sets TTL to 1 hour - session expires if not used within that time.
 */
export async function createSession(
  sessionId: string,
  userId?: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready') {
    console.warn('[Session] Redis unavailable, session metadata not persisted');
    return;
  }

  const now = new Date().toISOString();
  const metadata: SessionMetadata = {
    session_id: sessionId,
    user_id: userId,
    created_at: now,
    last_used: now,
  };

  try {
    const key = SESSION_KEY_PREFIX + sessionId;
    await redis.setex(key, SESSION_TTL, JSON.stringify(metadata));
    console.info(`[Session] Created: ${sessionId}${userId ? ` (user: ${userId})` : ''}`);
  } catch (err) {
    console.error('[Session] Failed to save metadata to Redis:', err);
  }
}

/**
 * Update last_used timestamp for an existing session.
 * Resets TTL to 1 hour from now.
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready') return;

  try {
    const key = SESSION_KEY_PREFIX + sessionId;
    const data = await redis.get(key);
    if (!data) {
      // Session not found in Redis (might have expired or server restarted)
      return;
    }

    const metadata: SessionMetadata = JSON.parse(data);
    metadata.last_used = new Date().toISOString();

    await redis.setex(key, SESSION_TTL, JSON.stringify(metadata));
  } catch (err) {
    console.error('[Session] Failed to update activity:', err);
  }
}

/**
 * Delete session metadata from Redis when session is closed.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready') return;

  try {
    const key = SESSION_KEY_PREFIX + sessionId;
    await redis.del(key);
    console.info(`[Session] Deleted: ${sessionId}`);
  } catch (err) {
    console.error('[Session] Failed to delete metadata:', err);
  }
}

/**
 * Get session metadata from Redis.
 */
export async function getSession(sessionId: string): Promise<SessionMetadata | null> {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready') return null;

  try {
    const key = SESSION_KEY_PREFIX + sessionId;
    const data = await redis.get(key);
    if (!data) return null;

    return JSON.parse(data);
  } catch (err) {
    console.error('[Session] Failed to get metadata:', err);
    return null;
  }
}

/**
 * List all active sessions from Redis.
 * Useful for monitoring and debugging.
 */
export async function listActiveSessions(): Promise<SessionMetadata[]> {
  const redis = getRedisClient();
  if (!redis || redis.status !== 'ready') return [];

  try {
    const keys = await redis.keys(SESSION_KEY_PREFIX + '*');
    const sessions: SessionMetadata[] = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        sessions.push(JSON.parse(data));
      }
    }

    return sessions;
  } catch (err) {
    console.error('[Session] Failed to list sessions:', err);
    return [];
  }
}
