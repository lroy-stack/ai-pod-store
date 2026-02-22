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
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { withAuditLog } from './lib/audit-log.js';
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
import {
  getMyProfileSchema,
  getMyProfile,
  type GetMyProfileInput,
} from './tools/get-my-profile.js';
import {
  updateMyProfileSchema,
  updateMyProfile,
  type UpdateMyProfileInput,
} from './tools/update-my-profile.js';
import {
  listMyOrdersSchema,
  listMyOrders,
  type ListMyOrdersInput,
} from './tools/list-my-orders.js';
import {
  getOrderStatusSchema,
  getOrderStatus,
  type GetOrderStatusInput,
} from './tools/get-order-status.js';
import {
  getCartSchema,
  getCart,
  type GetCartInput,
} from './tools/get-cart.js';
import {
  updateCartSchema,
  updateCart,
  type UpdateCartInput,
} from './tools/update-cart.js';
import {
  createCheckoutSchema,
  createCheckout,
  type CreateCheckoutInput,
} from './tools/create-checkout.js';
import {
  listWishlistSchema,
  listWishlist,
  type ListWishlistInput,
} from './tools/list-wishlist.js';
import {
  addToWishlistSchema,
  addToWishlist,
  type AddToWishlistInput,
} from './tools/add-to-wishlist.js';
import {
  removeFromWishlistSchema,
  removeFromWishlist,
  type RemoveFromWishlistInput,
} from './tools/remove-from-wishlist.js';
import { readProductsCatalog } from './resources/catalog.js';
import { readStorePolicies } from './resources/policies.js';
import {
  shoppingAssistantSchema,
  getShoppingAssistantPrompt,
  type ShoppingAssistantInput,
} from './prompts/shopping-assistant.js';

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
const TOOL_COUNT = 14; // Increment as tools are added

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
    withAuditLog('search_products', async (input: SearchProductsInput) => {
      const result = await searchProducts(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
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
    withAuditLog('get_product_details', async (input: GetProductDetailsInput) => {
      const result = await getProductDetails(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
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
    withAuditLog('get_store_info', async (input: GetStoreInfoInput) => {
      const result = await getStoreInfo(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
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
    withAuditLog('get_store_policies', async (input: GetStorePoliciesInput) => {
      const result = await getStorePolicies(input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: get_my_profile (PROTECTED — authentication required)
  server.registerTool(
    'get_my_profile',
    {
      description: 'Get the authenticated user\'s profile information including name, email, locale, and currency preferences',
      inputSchema: getMyProfileSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    withAuditLog('get_my_profile', async (input: GetMyProfileInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await getMyProfile(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: update_my_profile (PROTECTED + DESTRUCTIVE — authentication required)
  server.registerTool(
    'update_my_profile',
    {
      description: 'Update the authenticated user\'s profile information (name, locale). Uses context injection - userId comes from auth token.',
      inputSchema: updateMyProfileSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: true,
      },
    },
    withAuditLog('update_my_profile', async (input: UpdateMyProfileInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await updateMyProfile(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: list_my_orders (PROTECTED — authentication required)
  server.registerTool(
    'list_my_orders',
    {
      description: 'Get the authenticated user\'s order history with optional filters for status and limit',
      inputSchema: listMyOrdersSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    withAuditLog('list_my_orders', async (input: ListMyOrdersInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await listMyOrders(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: get_order_status (PROTECTED — authentication required)
  server.registerTool(
    'get_order_status',
    {
      description: 'Get detailed information about a specific order by ID, including status and line items. Returns error if the order belongs to another user.',
      inputSchema: getOrderStatusSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    withAuditLog('get_order_status', async (input: GetOrderStatusInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await getOrderStatus(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: get_cart (PROTECTED — authentication required)
  server.registerTool(
    'get_cart',
    {
      description: 'Get the authenticated user\'s current shopping cart contents, including product details, quantities, and prices',
      inputSchema: getCartSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    withAuditLog('get_cart', async (input: GetCartInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await getCart(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: update_cart (PROTECTED — authentication required)
  server.registerTool(
    'update_cart',
    {
      description: 'Add, update, or remove items from the shopping cart. Set quantity > 0 to add/update, or quantity = 0 to remove.',
      inputSchema: updateCartSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        destructiveHint: false, // Cart operations can be undone - not permanently destructive
      },
    },
    withAuditLog('update_cart', async (input: UpdateCartInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await updateCart(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: create_checkout (PROTECTED — authentication required)
  // CRITICAL: This tool NEVER processes payments - only returns Stripe Checkout URLs
  server.registerTool(
    'create_checkout',
    {
      description: 'Create a Stripe Checkout Session for cart items and return the checkout URL. NEVER processes payment directly - user completes payment on Stripe\'s hosted page.',
      inputSchema: createCheckoutSchema,
      annotations: {
        readOnlyHint: true, // Read-only from MCP perspective (Stripe processes payment externally)
        idempotentHint: false, // Creates a new session each time
        destructiveHint: false, // Does not modify data in our system
      },
    },
    withAuditLog('create_checkout', async (input: CreateCheckoutInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await createCheckout(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: list_wishlist (PROTECTED — authentication required)
  server.registerTool(
    'list_wishlist',
    {
      description: 'List all items in the authenticated user\'s default wishlist with product details',
      inputSchema: listWishlistSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
      },
    },
    withAuditLog('list_wishlist', async (input: ListWishlistInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await listWishlist(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: add_to_wishlist (PROTECTED + DESTRUCTIVE — authentication required)
  server.registerTool(
    'add_to_wishlist',
    {
      description: 'Add a product (and optionally a variant) to the authenticated user\'s default wishlist',
      inputSchema: addToWishlistSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: false, // Adding the same product twice may fail due to UNIQUE constraint
        destructiveHint: true,
      },
    },
    withAuditLog('add_to_wishlist', async (input: AddToWishlistInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await addToWishlist(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

  // Tool: remove_from_wishlist (PROTECTED + DESTRUCTIVE — authentication required)
  server.registerTool(
    'remove_from_wishlist',
    {
      description: 'Remove a product (and optionally a variant) from the authenticated user\'s default wishlist',
      inputSchema: removeFromWishlistSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true, // Removing the same product twice is safe
        destructiveHint: true,
      },
    },
    withAuditLog('remove_from_wishlist', async (input: RemoveFromWishlistInput, extra?: { authInfo?: AuthInfo }) => {
      const result = await removeFromWishlist(input, extra?.authInfo);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    })
  );

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

  // Apply rate limiting
  const allowed = await rateLimitMiddleware(req, res);
  if (!allowed) {
    // Rate limit exceeded, response already sent by middleware
    return;
  }

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
