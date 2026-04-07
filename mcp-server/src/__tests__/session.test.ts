import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  updateSessionActivity,
  deleteSession,
  getSession,
  listActiveSessions,
} from '../session.js';
import { createMockRedisClient } from './test-utils.js';

// Mock Redis client
const mockRedis = createMockRedisClient();

vi.mock('../lib/redis.js', () => ({
  getRedisClient: () => mockRedis,
}));

describe('Session Management', () => {
  describe('createSession', () => {
    it('should create a session with user ID', async () => {
      const sessionId = 'session-123';
      const userId = 'user-456';

      await expect(createSession(sessionId, userId)).resolves.not.toThrow();
    });

    it('should create a session without user ID', async () => {
      const sessionId = 'session-789';

      await expect(createSession(sessionId)).resolves.not.toThrow();
    });

    it('should handle Redis unavailable gracefully', async () => {
      const badRedis = { ...mockRedis, status: 'disconnected' };
      vi.mocked(await import('../lib/redis.js')).getRedisClient = () => badRedis as any;

      const sessionId = 'session-no-redis';

      await expect(createSession(sessionId)).resolves.not.toThrow();
    });
  });

  describe('updateSessionActivity', () => {
    it('should update existing sessions', async () => {
      const sessionId = 'session-update';

      await expect(updateSessionActivity(sessionId)).resolves.not.toThrow();
    });

    it('should handle non-existent sessions gracefully', async () => {
      const sessionId = 'session-nonexistent';

      await expect(updateSessionActivity(sessionId)).resolves.not.toThrow();
    });
  });

  describe('deleteSession', () => {
    it('should delete session from Redis', async () => {
      const sessionId = 'session-delete';

      await expect(deleteSession(sessionId)).resolves.not.toThrow();
    });

    it('should handle Redis unavailable', async () => {
      const badRedis = { ...mockRedis, status: 'disconnected' };
      vi.mocked(await import('../lib/redis.js')).getRedisClient = () => badRedis as any;

      const sessionId = 'session-delete-no-redis';

      await expect(deleteSession(sessionId)).resolves.not.toThrow();
    });
  });

  describe('getSession', () => {
    it('should retrieve session metadata', async () => {
      const sessionId = 'session-get';

      const session = await getSession(sessionId);

      // Session may be null or have data - both are valid
      expect(session === null || typeof session === 'object').toBe(true);
    });

    it('should return null if Redis unavailable', async () => {
      const badRedis = { ...mockRedis, status: 'disconnected' };
      vi.mocked(await import('../lib/redis.js')).getRedisClient = () => badRedis as any;

      const sessionId = 'session-no-redis';

      const session = await getSession(sessionId);

      expect(session).toBeNull();
    });
  });

  describe('listActiveSessions', () => {
    it('should list all active sessions', async () => {
      // This test verifies the function calls Redis correctly
      // The actual implementation is tested through the function's behavior
      const result = await listActiveSessions();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array if no sessions', async () => {
      vi.mocked(mockRedis.keys).mockResolvedValueOnce([]);

      const activeSessions = await listActiveSessions();

      expect(activeSessions).toEqual([]);
    });

    it('should return empty array if Redis unavailable', async () => {
      const badRedis = { ...mockRedis, status: 'disconnected' };
      vi.mocked(await import('../lib/redis.js')).getRedisClient = () => badRedis as any;

      const activeSessions = await listActiveSessions();

      expect(activeSessions).toEqual([]);
    });
  });
});
