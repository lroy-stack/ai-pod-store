#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { EventStore } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getRedisClient, closeRedis } from './lib/redis.js';
import { getSupabaseClient } from './lib/supabase.js';
import { getStripeClient } from './lib/stripe.js';
import { injectAuthInfo } from './auth/session.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import {
  createSession,
  updateSessionActivity,
  deleteSession,
} from './session.js';
import { logger } from './lib/logger.js';
import { getCompletions, type CompletionRequest } from './lib/completions.js';
import {
  handleAuthorizationServerMetadata,
  handleProtectedResourceMetadata,
  handleAuthorize,
  handleToken,
  handleRevoke,
} from './auth/oauth-provider.js';
import { registerAllTools } from './tools/registry.js';
import { readProductsCatalog } from './resources/catalog.js';
import { readStorePolicies } from './resources/policies.js';
import {
  shoppingAssistantSchema,
  getShoppingAssistantPrompt,
  type ShoppingAssistantInput,
} from './prompts/shopping-assistant.js';

const PORT = parseInt(process.env.PORT || '8002', 10);
const MCP_BASE_URL = process.env.MCP_BASE_URL || `http://localhost:${PORT}`;
const MCP_CORS_ORIGINS = (process.env.MCP_CORS_ORIGINS || 'https://claude.ai,https://chatgpt.com,http://localhost:3000')
  .split(',')
  .map((s) => s.trim());

// ===================================
// SESSION STORE
// ===================================

const transports = new Map<string, StreamableHTTPServerTransport>();

/**
 * In-memory event store for SSE resumability (Last-Event-ID support)
 */
class InMemoryEventStore implements EventStore {
  private events = new Map<string, { streamId: string; message: JSONRPCMessage }>();

  async storeEvent(streamId: string, message: JSONRPCMessage): Promise<string> {
    const eventId = `${streamId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    this.events.set(eventId, { streamId, message });
    return eventId;
  }

  async replayEventsAfter(
    lastEventId: string,
    { send }: { send: (eventId: string, message: JSONRPCMessage) => Promise<void> }
  ): Promise<string> {
    if (!lastEventId || !this.events.has(lastEventId)) return '';
    const streamId = lastEventId.split('_')[0] || '';
    if (!streamId) return '';

    let foundLast = false;
    const sorted = [...this.events.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [eventId, { streamId: evtStream, message }] of sorted) {
      if (evtStream !== streamId) continue;
      if (eventId === lastEventId) { foundLast = true; continue; }
      if (foundLast) await send(eventId, message);
    }
    return streamId;
  }
}

// ===================================
// MCP SERVER FACTORY
// ===================================

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: '@pod-ai/mcp-server', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {}, logging: {}, completions: {} } }
  );

  // Register all 17 tools via registry pattern
  registerAllTools(server);

  // ===================================
  // RESOURCES
  // ===================================

  // Resource: catalog://products
  // Note: Using deprecated resource() method for compatibility with SDK 1.0.4
  // Query parameters are handled inside readProductsCatalog() callback
  // Client should read from base URI (catalog://products) which returns paginated results
  // TODO: Migrate to registerResource() with template when SDK fully supports it
  // @ts-ignore - using deprecated method intentionally
  server.resource(
    'products',
    'catalog://products',
    {
      description: 'Product catalog with paginated list of all active products (default: limit=20, offset=0)',
      mimeType: 'application/json',
    },
    async (uri: URL) => {
      return readProductsCatalog(uri);
    }
  );

  // Resource: store://policies
  // @ts-ignore - using deprecated method intentionally
  server.resource(
    'policies',
    'store://policies',
    {
      description: 'Store policies including shipping, returns/refunds, and privacy policy',
      mimeType: 'text/plain',
    },
    async (uri: URL) => {
      return readStorePolicies(uri);
    }
  );

  // ===================================
  // PROMPTS
  // ===================================

  // Prompt: shopping_assistant
  // @ts-ignore - using deprecated method intentionally
  server.prompt(
    'shopping_assistant',
    'Multi-locale shopping assistant prompt template with system + user messages',
    shoppingAssistantSchema.shape,
    async (args: ShoppingAssistantInput) => {
      return getShoppingAssistantPrompt(args);
    }
  );

  return server;
}

// ===================================
// BODY PARSER
// ===================================

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// ===================================
// MCP REQUEST HANDLERS
// ===================================

async function handleMcpPost(
  req: IncomingMessage & { auth?: AuthInfo },
  res: ServerResponse
): Promise<void> {
  const body = await parseBody(req);
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Handle logging/setLevel notification
  if (
    body &&
    typeof body === 'object' &&
    'method' in body &&
    body.method === 'notifications/message'
  ) {
    const params = (body as any).params;
    if (params?.method === 'logging/setLevel' && params?.params?.level) {
      const level = params.params.level as 'debug' | 'info' | 'warning' | 'error';
      try {
        logger.setLevel(level);
        logger.info('Log level changed via MCP notification', { newLevel: level });
      } catch (err) {
        logger.error('Failed to set log level', {
          requestedLevel: level,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      // Send empty response for notification
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // Inject auth info from JWT (if Bearer token present)
  await injectAuthInfo(req);

  // Handle completion/complete request
  if (
    body &&
    typeof body === 'object' &&
    'method' in body &&
    body.method === 'completion/complete'
  ) {
    try {
      const params = (body as any).params as CompletionRequest;
      const userId = (req as any).auth?.extra?.userId as string | undefined;
      const result = await getCompletions(params, userId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: (body as any).id,
          result,
        })
      );
      return;
    } catch (err) {
      logger.error('Completion request failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: (body as any).id,
          error: {
            code: -32000,
            message: 'Completion failed',
          },
        })
      );
      return;
    }
  }

  // Extract tool name from request body for per-tool rate limiting
  let toolName: string | undefined;
  if (
    body &&
    typeof body === 'object' &&
    'method' in body &&
    body.method === 'tools/call' &&
    'params' in body &&
    typeof (body as any).params === 'object' &&
    'name' in (body as any).params
  ) {
    toolName = (body as any).params.name;
  }

  // Apply rate limiting (with optional per-tool limit)
  const allowed = await rateLimitMiddleware(req, res, toolName);
  if (!allowed) {
    // Rate limit exceeded, response already sent by middleware
    return;
  }

  if (sessionId && transports.has(sessionId)) {
    // Existing session — reuse transport
    await updateSessionActivity(sessionId);
    await transports.get(sessionId)!.handleRequest(req, res, body);
  } else if (!sessionId && isInitializeRequest(body)) {
    // New session — create transport + server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore: new InMemoryEventStore(),
      onsessioninitialized: async (sid) => {
        transports.set(sid, transport);
        console.info(`[MCP] Session initialized: ${sid}`);

        // Persist session metadata to Redis
        const userId = (req as any).auth?.extra?.userId;
        await createSession(sid, userId);
      },
    });
    transport.onclose = async () => {
      if (transport.sessionId) {
        console.info(`[MCP] Session closed: ${transport.sessionId}`);
        transports.delete(transport.sessionId);

        // Remove session metadata from Redis
        await deleteSession(transport.sessionId);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } else {
    // Invalid request — no session ID and not an initialization request
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      })
    );
  }
}

async function handleMcpGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
    return;
  }
  await updateSessionActivity(sessionId);
  await transports.get(sessionId)!.handleRequest(req, res);
}

async function handleMcpDelete(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
    return;
  }
  await updateSessionActivity(sessionId);
  await transports.get(sessionId)!.handleRequest(req, res);
}

// ===================================
// HTTP SERVER
// ===================================

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  // Security headers (all responses)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');

  // CORS headers
  if (origin && MCP_CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
  }

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint (basic liveness check)
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        version: '1.0.0',
        tools_count: 17,
        active_sessions: transports.size,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Readiness check endpoint (verifies dependencies)
  if (req.method === 'GET' && req.url === '/ready') {
    const checks = {
      supabase: { status: 'unknown', error: null as string | null },
      redis: { status: 'unknown', error: null as string | null },
      stripe: { status: 'unknown', error: null as string | null },
    };

    let overallStatus = 'ready';

    // Check Supabase connectivity
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error) {
        checks.supabase.status = 'degraded';
        checks.supabase.error = error.message;
        overallStatus = 'degraded';
      } else {
        checks.supabase.status = 'ready';
      }
    } catch (err) {
      checks.supabase.status = 'degraded';
      checks.supabase.error = err instanceof Error ? err.message : 'Unknown error';
      overallStatus = 'degraded';
    }

    // Check Redis connectivity (optional — not fatal if unavailable)
    try {
      const redis = getRedisClient();
      if (redis && redis.status === 'ready') {
        await redis.ping();
        checks.redis.status = 'ready';
      } else {
        checks.redis.status = 'unavailable';
        checks.redis.error = 'Redis not connected (graceful fallback enabled)';
        // Don't mark overall as degraded - Redis is optional
      }
    } catch (err) {
      checks.redis.status = 'unavailable';
      checks.redis.error = err instanceof Error ? err.message : 'Unknown error';
      // Don't mark overall as degraded - Redis is optional
    }

    // Check Stripe connectivity
    try {
      const stripe = getStripeClient();
      // Simple check: list 1 product to verify API connectivity
      await stripe.products.list({ limit: 1 });
      checks.stripe.status = 'ready';
    } catch (err) {
      checks.stripe.status = 'degraded';
      checks.stripe.error = err instanceof Error ? err.message : 'Unknown error';
      overallStatus = 'degraded';
    }

    // Return 503 if any critical dependency is degraded
    const statusCode = overallStatus === 'degraded' ? 503 : 200;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: overallStatus,
        checks,
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // OAuth 2.1 well-known endpoints
  if (req.method === 'GET' && req.url === '/.well-known/oauth-authorization-server') {
    handleAuthorizationServerMetadata(req, res);
    return;
  }

  if (req.method === 'GET' && req.url === '/.well-known/oauth-protected-resource') {
    handleProtectedResourceMetadata(req, res);
    return;
  }

  // OAuth 2.1 endpoints (with rate limiting)
  if (req.url?.startsWith('/oauth/authorize')) {
    const allowed = await rateLimitMiddleware(req, res, '__oauth_authorize');
    if (!allowed) return;
    handleAuthorize(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/oauth/token') {
    const allowed = await rateLimitMiddleware(req, res, '__oauth_token');
    if (!allowed) return;
    await handleToken(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/oauth/revoke') {
    handleRevoke(req, res);
    return;
  }

  // MCP endpoint — route by HTTP method
  if (req.url?.startsWith('/mcp') || req.url === '/') {
    try {
      if (req.method === 'POST') {
        await handleMcpPost(req as IncomingMessage & { auth?: AuthInfo }, res);
      } else if (req.method === 'GET') {
        await handleMcpGet(req, res);
      } else if (req.method === 'DELETE') {
        await handleMcpDelete(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      }
    } catch (error) {
      console.error('[MCP Server] Error handling request:', error);
      if (!res.headersSent) {
        if (error instanceof Error && error.message === 'Request body too large') {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Request body too large' }, id: null }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }));
        }
      }
    }
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ===================================
// GRACEFUL SHUTDOWN
// ===================================

const shutdown = async () => {
  console.info('[MCP Server] Shutting down...');
  // Close all active transports
  for (const [, transport] of transports) {
    try {
      await transport.close();
    } catch {
      // Ignore close errors during shutdown
    }
  }
  transports.clear();
  server.close();
  await closeRedis();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ===================================
// START SERVER
// ===================================

server.listen(PORT, () => {
  console.info(`[MCP Server] Listening on port ${PORT}`);
  console.info(`[MCP Server] Base URL: ${MCP_BASE_URL}`);
  console.info(`[MCP Server] CORS origins:`, MCP_CORS_ORIGINS);
  console.info(`[MCP Server] Health check: http://localhost:${PORT}/health`);
  console.info(`[MCP Server] Tools: ${17}`);

  // Initialize dependencies (lazy)
  try {
    getRedisClient(); // Optional
    getSupabaseClient(); // Required
    getStripeClient(); // Required
  } catch (error) {
    console.error('[MCP Server] Failed to initialize dependencies:', error);
    process.exit(1);
  }
});
