#!/usr/bin/env node
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { getRedisClient, closeRedis } from './lib/redis.js';
import { getSupabaseClient } from './lib/supabase.js';
import { getStripeClient } from './lib/stripe.js';
import { getOrCreateSessionId } from './lib/session.js';
import {
  handleAuthorizationServerMetadata,
  handleProtectedResourceMetadata,
  handleAuthorize,
  handleToken,
  handleRevoke,
} from './auth/oauth-provider.js';

const PORT = parseInt(process.env.PORT || '8002', 10);
const MCP_BASE_URL = process.env.MCP_BASE_URL || `http://localhost:${PORT}`;
const MCP_CORS_ORIGINS = (process.env.MCP_CORS_ORIGINS || 'https://claude.ai,https://chatgpt.com')
  .split(',')
  .map((s) => s.trim());

// Initialize MCP Server
const mcpServer = new McpServer(
  {
    name: '@pod-ai/mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Track registered tools for health check
let toolCount = 0;

// TODO: Register tools, resources, prompts here
// For now, just initialize the server with no tools
// Tools will be registered in subsequent features

console.info('[MCP Server] Initialized');

// Create and connect the Streamable HTTP transport once at startup
const transport = new StreamableHTTPServerTransport();
await mcpServer.connect(transport);
console.info('[MCP Server] Transport connected');

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  // CORS headers
  if (origin && MCP_CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
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
        tools_count: toolCount,
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

  // MCP endpoint - handle via StreamableHTTPServerTransport
  if (req.url?.startsWith('/mcp') || req.url === '/') {
    try {
      // Get or create session ID
      const sessionId = await getOrCreateSessionId(req);

      // Wrap response to add session ID header
      const originalWriteHead = res.writeHead.bind(res);
      res.writeHead = function (statusCode: number, ...args: any[]) {
        // Add session ID header before writing
        res.setHeader('Mcp-Session-Id', sessionId);
        return originalWriteHead(statusCode, ...args);
      };

      // Use the pre-connected transport to handle the request
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('[MCP Server] Error handling request:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Graceful shutdown
const shutdown = async () => {
  console.info('[MCP Server] Shutting down...');
  server.close();
  await closeRedis();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(PORT, () => {
  console.info(`[MCP Server] Listening on port ${PORT}`);
  console.info(`[MCP Server] Base URL: ${MCP_BASE_URL}`);
  console.info(`[MCP Server] CORS origins:`, MCP_CORS_ORIGINS);
  console.info(`[MCP Server] Health check: http://localhost:${PORT}/health`);

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
