import { vi } from 'vitest';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

/**
 * Test utilities for MCP server tests
 */

/**
 * Mock AuthInfo for authenticated requests
 */
export function createMockAuthInfo(userId: string, email: string): AuthInfo {
  return {
    extra: {
      userId,
      email,
    },
  };
}

/**
 * Mock Supabase client
 */
export function createMockSupabaseClient() {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
}

/**
 * Mock Redis client
 */
export function createMockRedisClient() {
  const store = new Map<string, string>();
  const sortedSets = new Map<string, Array<{ score: number; value: string }>>();

  return {
    status: 'ready',
    get: vi.fn(async (key: string) => store.get(key) || null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    keys: vi.fn(async (pattern: string) => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return Array.from(store.keys()).filter(k => regex.test(k));
    }),
    expire: vi.fn(async () => 1),
    zadd: vi.fn(async (key: string, score: number, value: string) => {
      if (!sortedSets.has(key)) {
        sortedSets.set(key, []);
      }
      sortedSets.get(key)!.push({ score, value });
      return 1;
    }),
    zremrangebyscore: vi.fn(async (key: string, min: number, max: number) => {
      if (!sortedSets.has(key)) return 0;
      const set = sortedSets.get(key)!;
      const filtered = set.filter(item => item.score < min || item.score > max);
      sortedSets.set(key, filtered);
      return set.length - filtered.length;
    }),
    zcard: vi.fn(async (key: string) => {
      return sortedSets.get(key)?.length || 0;
    }),
    zrange: vi.fn(async (key: string, start: number, stop: number, withScores?: string) => {
      const set = sortedSets.get(key) || [];
      const slice = set.slice(start, stop + 1);
      if (withScores === 'WITHSCORES') {
        return slice.flatMap(item => [item.value, item.score.toString()]);
      }
      return slice.map(item => item.value);
    }),
  };
}

/**
 * Mock HTTP request
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  auth?: AuthInfo;
}) {
  return {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || {},
    socket: {
      remoteAddress: '127.0.0.1',
    },
    auth: options.auth,
  };
}

/**
 * Mock HTTP response
 */
export function createMockResponse() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = '';

  return {
    writeHead: vi.fn((code: number, hdrs?: Record<string, string>) => {
      statusCode = code;
      if (hdrs) Object.assign(headers, hdrs);
    }),
    setHeader: vi.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    end: vi.fn((data?: string) => {
      if (data) body = data;
    }),
    getStatusCode: () => statusCode,
    getHeaders: () => headers,
    getBody: () => body,
  };
}
