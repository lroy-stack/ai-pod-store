#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getRedisClient, closeRedis } from './lib/redis.js';
import { getSupabaseClient } from './lib/supabase.js';
import { getStripeClient } from './lib/stripe.js';
import { injectAuthInfo } from './auth/session.js';
import {
  handleAuthorizationServerMetadata,
  handleProtectedResourceMetadata,
  handleAuthorize,
  handleToken,
  handleRevoke,
} from './auth/oauth-provider.js';
import {
  searchProductsSchema,
  searchProducts,
  type SearchProductsInput,
} from './tools/search-products.js';
import {
  getProductDetailsSchema,
  getProductDetails,
  type GetProductDetailsInput,
} from './tools/get-product-details.js';
import {
  getStoreInfoSchema,
  getStoreInfo,
  type GetStoreInfoInput,
} from './tools/get-store-info.js';
import {
  getStorePoliciesSchema,
  getStorePolicies,
  type GetStorePoliciesInput,
} from './tools/get-store-policies.js';

const PORT = parseInt(process.env.PORT || '8002', 10);
const MCP_BASE_URL = process.env.MCP_BASE_URL || `http://localhost:${PORT}`;
const MCP_CORS_ORIGINS = (process.env.MCP_CORS_ORIGINS || 'https://claude.ai,https://chatgpt.com')
  .split(',')
  .map((s) => s.trim());

// ===================================
// SESSION STORE
// ===================================

const transports = new Map<string, StreamableHTTPServerTransport>();

// Track tool count for health check
const TOOL_COUNT = 4; // Increment as tools are added

// ===================================
// MCP SERVER FACTORY
// ===================================

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: '@pod-ai/mcp-server', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );

  // Tool: search_products (PUBLIC — no auth required)
  server.registerTool(
    'search_products',
    {
      description: 'Search for products in the store catalog by title, description, or category',
      inputSchema: searchProductsSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (input: SearchProductsInput) => {
      const result = await searchProducts(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    }
  );

  // Tool: get_product_details (PUBLIC — no auth required)
  server.registerTool(
    'get_product_details',
    {
      description: 'Get detailed information about a specific product, including variants, images, and pricing',
      inputSchema: getProductDetailsSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (input: GetProductDetailsInput) => {
      const result = await getProductDetails(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    }
  );

  // Tool: get_store_info (PUBLIC — no auth required)
  server.registerTool(
    'get_store_info',
    {
      description: 'Get general information about the store, including name, description, supported currencies, and features',
      inputSchema: getStoreInfoSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (input: GetStoreInfoInput) => {
      const result = await getStoreInfo(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    }
  );

  // Tool: get_store_policies (PUBLIC — no auth required)
  server.registerTool(
    'get_store_policies',
    {
      description: 'Get store policies including shipping, returns/refunds, and privacy information',
      inputSchema: getStorePoliciesSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    async (input: GetStorePoliciesInput) => {
      const result = await getStorePolicies(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
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
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
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

  // Inject auth info from JWT (if Bearer token present)
  await injectAuthInfo(req);

  if (sessionId && transports.has(sessionId)) {
    // Existing session — reuse transport
    await transports.get(sessionId)!.handleRequest(req, res, body);
  } else if (!sessionId && isInitializeRequest(body)) {
    // New session — create transport + server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports.set(sid, transport);
        console.info(`[MCP] Session initialized: ${sid}`);
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) {
        console.info(`[MCP] Session closed: ${transport.sessionId}`);
        transports.delete(transport.sessionId);
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
  await transports.get(sessionId)!.handleRequest(req, res);
}

async function handleMcpDelete(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or missing session ID' }));
    return;
  }
  await transports.get(sessionId)!.handleRequest(req, res);
}

// ===================================
// HTTP SERVER
// ===================================

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  // CORS headers
  if (origin && MCP_CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        version: '1.0.0',
        tools_count: TOOL_COUNT,
        active_sessions: transports.size,
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

  // OAuth 2.1 endpoints
  if (req.url?.startsWith('/oauth/authorize')) {
    handleAuthorize(req, res);
    return;
  }

  if (req.method === 'POST' && req.url === '/oauth/token') {
    handleToken(req, res);
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
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null }));
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
  console.info(`[MCP Server] Tools: ${TOOL_COUNT}`);

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
