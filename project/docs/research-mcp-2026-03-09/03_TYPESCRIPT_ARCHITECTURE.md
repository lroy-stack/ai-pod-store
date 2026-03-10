# MCP Server TypeScript Architecture Research

**Date**: 2026-03-09
**Scope**: Production-ready MCP server architecture patterns in TypeScript
**Current SDK**: `@modelcontextprotocol/sdk ^1.0.4` (latest stable: 1.26.x)
**Protocol Revision**: 2025-06-18

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Official SDK Patterns](#2-official-sdk-patterns)
3. [Tool Design & Annotations](#3-tool-design--annotations)
4. [Middleware Patterns](#4-middleware-patterns)
5. [Authentication Architecture](#5-authentication-architecture)
6. [Resources & Prompts](#6-resources--prompts)
7. [Testing Patterns](#7-testing-patterns)
8. [Current Architecture Analysis](#8-current-architecture-analysis)
9. [Recommended Refactoring Plan](#9-recommended-refactoring-plan)
10. [Anti-Patterns to Avoid](#10-anti-patterns-to-avoid)

---

## 1. Executive Summary

Our MCP server (`@pod-ai/mcp-server`) is a well-structured, production-grade implementation with 17 tools, 2 resources, 1 prompt, OAuth 2.1 support, and Redis-backed rate limiting. After researching the official MCP specification, SDK reference implementations, community frameworks (FastMCP), and production patterns from Portal One, Dev.to guides, and MCPcat, the key findings are:

**What we do well:**
- Correct transport-per-session pattern with `StreamableHTTPServerTransport`
- Proper use of `registerTool()` (not deprecated `tool()`)
- Tool annotations on every tool (readOnlyHint, destructiveHint, idempotentHint, openWorldHint)
- Zod schemas for input validation
- `withAuditLog()` wrapper for cross-cutting audit concerns
- Structured JSON audit logging with sensitive field redaction
- Per-tool and global rate limiting with Redis + in-memory fallback
- JWT auth injection into request for SDK transport propagation
- Proper `isError` flag in tool results
- Both `content` (text) and `structuredContent` in tool responses
- Health and readiness endpoints with dependency checks
- CORS with allowlist
- Graceful shutdown with transport cleanup

**What needs improvement:**
- No centralized auth enforcement middleware (each tool manually checks auth)
- Massive `index.ts` (1018 lines) with 17 inline tool registrations
- Repetitive response wrapping pattern (identical `JSON.stringify` + `structuredContent` in every tool)
- `outputSchema` not declared on any tool (MCP spec supports it for structured results)
- Resources use deprecated `server.resource()` API with `@ts-ignore`
- No `InMemoryEventStore` for SSE resumability
- No integration tests against the full MCP protocol flow
- Tool tests only cover 3 of 17 tools
- SDK version pinned at `^1.0.4` -- missing features from 1.26.x

**Priority recommendations:**
1. Extract tool registrations into a registry pattern (reduce index.ts from ~1000 to ~150 lines)
2. Create `withAuth()` higher-order wrapper for centralized auth enforcement
3. Add `outputSchema` to tools that return structured data
4. Upgrade SDK to `^1.26.0` and migrate to non-deprecated resource/prompt APIs
5. Add `InMemoryEventStore` for SSE resumability
6. Expand test coverage with in-process MCP client tests

---

## 2. Official SDK Patterns

### 2.1 Transport-Per-Session (Reference Implementation)

The official SDK example (`simpleStreamableHttp.ts`) establishes the canonical pattern our server already follows:

```typescript
// Official pattern (Express version from SDK examples)
const transports = new Map<string, NodeStreamableHTTPServerTransport>();

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    // Existing session -- reuse transport
    await transports.get(sessionId)!.handleRequest(req, res, req.body);
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New session -- create transport + server
    const eventStore = new InMemoryEventStore();
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore, // Enables SSE resumability
      onsessioninitialized: (sid) => transports.set(sid, transport),
    });
    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };
    const server = getServer(); // Factory function
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } else {
    res.status(400).json({ error: 'Bad Request' });
  }
});
```

**Our implementation vs. reference:**

| Aspect | Our Implementation | SDK Reference |
|--------|-------------------|---------------|
| Transport map | `Map<string, StreamableHTTPServerTransport>` | Same pattern |
| Session ID generation | `randomUUID()` | Same |
| Server factory | `createMcpServer()` | `getServer()` |
| HTTP framework | Raw `node:http` | Express |
| Event store | Not used | `InMemoryEventStore` |
| Body parsing | Custom `parseBody()` | Express built-in |

**Gap: InMemoryEventStore**

The SDK provides `InMemoryEventStore` for SSE stream resumability. When a client reconnects after a disconnect, events that were sent during the disconnect can be replayed. Our server does not use this, meaning SSE reconnections lose events.

```typescript
// Recommended addition
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/inMemory.js';

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  eventStore: new InMemoryEventStore(), // ADD THIS
  onsessioninitialized: async (sid) => { ... },
});
```

### 2.2 Tool Registration API (`registerTool`)

SDK 1.26+ uses `server.registerTool()` (our code correctly uses this). The deprecated `server.tool()` method is from SDK 1.0.x.

```typescript
// Current correct pattern (we already use this)
server.registerTool('tool_name', {
  description: 'What this tool does',
  title: 'Human-Readable Title',
  inputSchema: zodSchema,   // Full Zod schema, not .shape
  outputSchema: zodOutputSchema, // NEW: structured output validation
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}, async (input, extra) => {
  // extra.authInfo?: AuthInfo
  // extra.sessionId?: string
  // extra.signal: AbortSignal
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,       // For clients that support structured output
    isError: false,
  };
});
```

### 2.3 Framework Middleware Packages

The SDK publishes thin runtime adapters:
- `@modelcontextprotocol/node` -- wraps Node.js `IncomingMessage`/`ServerResponse`
- `@modelcontextprotocol/express` -- Express integration
- `@modelcontextprotocol/hono` -- Hono framework support

These are optional and handle transport binding only, not business logic middleware.

---

## 3. Tool Design & Annotations

### 3.1 Naming Conventions

The MCP specification uses `snake_case` for tool names (e.g., `search_products`, `get_cart`). Our server follows this convention correctly.

**Best practices from the spec:**
- Names should be descriptive and action-oriented
- Use verb-noun pattern: `search_products`, `create_checkout`, `get_order_status`
- Avoid generic names like `run`, `execute`, `do`
- Keep names unique within a server instance

### 3.2 Input Schema Best Practices

From the official docs and production guides:

```typescript
// GOOD: Detailed schemas with descriptions on every property
const searchProductsSchema = z.object({
  query: z.string()
    .min(1)
    .max(200)
    .describe('Search query to find products (searches title, description, category)'),
  limit: z.number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum number of products to return (default: 10, max: 50)'),
});

// BAD: Missing descriptions, no constraints
const schema = z.object({
  q: z.string(),
  n: z.number().optional(),
});
```

Our schemas already follow the good pattern with `.describe()` on every field.

### 3.3 Output Schema (NEW Feature)

The MCP spec (2025-06-18) supports `outputSchema` for tools that return structured data. This enables:
- Client-side validation of structured responses
- Better TypeScript integration for consuming applications
- Documentation of return value structure

```typescript
// Recommended: Add outputSchema to tools
server.registerTool('search_products', {
  description: 'Search for products...',
  inputSchema: searchProductsSchema,
  outputSchema: z.object({           // NEW
    success: z.boolean(),
    total: z.number(),
    products: z.array(z.object({
      id: z.string(),
      title: z.string(),
      price: z.number(),
      currency: z.string(),
      image: z.string(),
      rating: z.number(),
      category: z.string(),
      description: z.string(),
    })),
  }),
  annotations: { ... },
}, handler);
```

**Current gap:** None of our 17 tools declare `outputSchema`, despite all returning structured JSON in `structuredContent`.

### 3.4 Tool Annotations Reference

| Annotation | Type | Default | Description |
|------------|------|---------|-------------|
| `readOnlyHint` | boolean | `false` | Tool does NOT modify its environment |
| `destructiveHint` | boolean | `true` | Tool may perform destructive updates (only meaningful when readOnlyHint=false) |
| `idempotentHint` | boolean | `false` | Repeated calls with same args have no additional effect (only meaningful when readOnlyHint=false) |
| `openWorldHint` | boolean | `true` | Tool interacts with external entities beyond our system |

**Critical semantic note:** `destructiveHint` and `idempotentHint` are only meaningful when `readOnlyHint` is `false`. For read-only tools, these hints carry no semantic weight.

**Audit of our current annotations:**

| Tool | readOnly | destructive | idempotent | openWorld | Issues |
|------|----------|-------------|------------|-----------|--------|
| search_products | true | false | true | true | openWorld should be false (queries our DB only) |
| get_product_details | true | false | true | true | openWorld should be false |
| get_store_info | true | false | true | true | openWorld should be false |
| get_store_policies | true | false | true | true | openWorld should be false |
| list_categories | true | false | true | true | openWorld should be false |
| get_product_reviews | true | false | true | true | openWorld should be false |
| get_my_profile | true | false | true | true | openWorld should be false |
| list_my_orders | true | false | true | true | openWorld should be false |
| get_order_status | true | false | true | true | openWorld should be false |
| track_shipment | true | false | true | true | openWorld=true is correct (may call carrier APIs) |
| get_cart | true | false | true | true | openWorld should be false |
| list_wishlist | true | false | true | true | openWorld should be false |
| update_my_profile | false | true | false | true | openWorld should be false (only modifies our DB) |
| update_cart | false | false | false | true | openWorld should be false; idempotent could be true for set-quantity semantics |
| create_checkout | true | false | false | true | readOnly=true is debatable (creates Stripe session); openWorld=true is correct |
| add_to_wishlist | false | true | false | true | openWorld should be false; destructive should be false (additive operation) |
| remove_from_wishlist | false | true | true | true | openWorld should be false |

**Key annotation fixes needed:**
- Most tools incorrectly set `openWorldHint: true` when they only query our Supabase database
- `add_to_wishlist` should not be marked `destructiveHint: true` (it's additive, not destructive)
- Several read-only tools have redundant `destructiveHint: false` and `idempotentHint: true` (these are meaningless when readOnlyHint is true)

### 3.5 Error Response Patterns

The MCP spec defines two error levels:

**1. Protocol Errors (JSON-RPC level):** For unknown tools, invalid arguments, server crashes.
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Unknown tool: invalid_tool_name"
  }
}
```

**2. Tool Execution Errors (isError flag):** For business logic failures the LLM should see.
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [{ "type": "text", "text": "Failed to fetch weather: API rate limit exceeded" }],
    "isError": true
  }
}
```

**Best practice:** Tool errors should be reported via `isError: true` in the result, NOT as protocol-level errors. This allows the LLM to see and potentially handle the error. Our implementation correctly follows this pattern with `isError: !result.success`.

### 3.6 Content Types in Tool Results

Tools can return multiple content types:

| Type | Use Case |
|------|----------|
| `text` | Plain text or serialized JSON |
| `image` | Base64-encoded images (product photos, charts) |
| `audio` | Base64-encoded audio |
| `resource_link` | URI reference to a server resource |
| `resource` | Embedded resource content |

All content types support optional annotations (`audience`, `priority`, `lastModified`).

Our tools currently only return `text` content. For product-related tools, we could enhance results with `resource_link` to the catalog resource or `image` content for product thumbnails.

---

## 4. Middleware Patterns

### 4.1 Current State of SDK Middleware

**The official MCP TypeScript SDK does NOT have built-in middleware support.** This is a known gap:

- **GitHub Issue #1238** (opened Dec 2025): Feature request for `server.use()` method
- **Status**: Labeled P2 (moderate priority), "ready for work"
- **PR #1345**: Open PR to implement middleware hooks
- The issue notes: "Currently, developers have to manually wrap every single tool handler function to add cross-cutting logic"

This means middleware must be implemented at the application level, not the SDK level.

### 4.2 Our Current Approach: Higher-Order Functions

We use `withAuditLog()` as a function wrapper pattern:

```typescript
// Current pattern (audit-log.ts)
export function withAuditLog<TInput, TExtra>(
  toolName: string,
  handler: (input: TInput, extra?: TExtra) => Promise<any>
): (input: TInput, extra?: TExtra) => Promise<any> {
  return async (input, extra) => {
    const startTime = Date.now();
    try {
      const result = await handler(input, extra);
      // ... audit logging
      return result;
    } catch (e) {
      // ... error logging
      throw e;
    }
  };
}
```

This is the **recommended pattern** per the community, but it needs extension for auth enforcement.

### 4.3 Recommended: Composable Wrapper Chain

Extend the HOF pattern to support multiple cross-cutting concerns:

```typescript
// Proposed: Composable middleware chain for tool handlers

type ToolHandler<TInput> = (
  input: TInput,
  extra?: { authInfo?: AuthInfo }
) => Promise<ToolResult>;

type ToolMiddleware<TInput> = (
  handler: ToolHandler<TInput>
) => ToolHandler<TInput>;

// Auth enforcement middleware
function withAuth<TInput>(toolName: string): ToolMiddleware<TInput> {
  return (handler) => async (input, extra) => {
    const userId = (extra?.authInfo?.extra as Record<string, unknown>)?.userId as string;
    if (!userId) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: false,
          error: 'Authentication required',
        }) }],
        isError: true,
      };
    }
    return handler(input, extra);
  };
}

// Rate limiting per tool (at MCP handler level, not HTTP level)
function withToolRateLimit<TInput>(
  toolName: string,
  maxPerMinute: number
): ToolMiddleware<TInput> {
  return (handler) => async (input, extra) => {
    // Check tool-specific rate limit
    const allowed = await checkToolRateLimit(toolName, extra?.authInfo);
    if (!allowed) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: false,
          error: `Rate limit exceeded for ${toolName}`,
        }) }],
        isError: true,
      };
    }
    return handler(input, extra);
  };
}

// Compose middleware
function compose<TInput>(
  ...middlewares: ToolMiddleware<TInput>[]
): ToolMiddleware<TInput> {
  return (handler) => {
    return middlewares.reduceRight(
      (next, middleware) => middleware(next),
      handler
    );
  };
}

// Usage in tool registration
const protectedTool = compose<GetCartInput>(
  withAuth('get_cart'),
  withAuditLog('get_cart'),
);

server.registerTool('get_cart', metadata, protectedTool(getCartHandler));
```

### 4.4 FastMCP Middleware Reference

FastMCP (community framework) provides the most mature middleware system for MCP servers:

**Hook hierarchy:**
- `on_message` -- all traffic
- `on_request` / `on_notification` -- specific message types
- `on_call_tool` / `on_read_resource` / `on_get_prompt` -- operation-specific
- `on_list_tools` / `on_list_resources` / `on_list_prompts` -- listing operations
- `on_initialize` -- client connection

**Built-in middleware types:**
- `LoggingMiddleware` / `StructuredLoggingMiddleware`
- `TimingMiddleware` / `DetailedTimingMiddleware`
- `ResponseCachingMiddleware` (TTL-based, per operation type)
- `RateLimitingMiddleware` (token bucket) / `SlidingWindowRateLimitingMiddleware`
- `ErrorHandlingMiddleware` / `RetryMiddleware`
- `ResponseLimitingMiddleware` (output size constraints)

**Key design principle:** Error handling middleware goes FIRST (catches all downstream errors), logging goes LAST (records actual execution), auth goes in the middle.

While FastMCP is Python-focused, its middleware design patterns translate well to TypeScript HOFs.

### 4.5 Portal One Pattern: withWorkspaceAccess

Production pattern from Portal One (TypeScript MCP server with OAuth):

```typescript
// HOC for workspace-level authorization
export function withWorkspaceAccess(db, inputSchema, handler) {
  return async (args, req) => {
    const userId = req.authInfo?.extra?.userId || '';
    const hasAccess = await checkWorkspaceAccess(db, userId, args.workspace_id);

    if (!hasAccess) {
      throw new Error('You do not have access to this workspace.');
    }

    return handler(args, req);
  };
}
```

This maps to our use case as `withAuth()` for user-scoped tools.

---

## 5. Authentication Architecture

### 5.1 Our Current Auth Flow

```
Client -> Bearer JWT in Authorization header
       -> injectAuthInfo() validates JWT with jose
       -> Sets req.auth = AuthInfo
       -> SDK passes to tool handlers as extra.authInfo
       -> Each tool manually checks authInfo.extra.userId
```

**Strengths:**
- JWT validation with issuer check
- Token revocation (Redis + in-memory fallback)
- OAuth 2.1 well-known endpoints for discovery
- Full OAuth authorize/token/revoke flow

**Weakness:**
- No centralized auth enforcement -- each protected tool must individually check `extra?.authInfo?.extra?.userId`
- A developer forgetting to add the check creates an auth bypass vulnerability
- Public vs. protected tool distinction is enforced by convention, not by code

### 5.2 SDK Bearer Auth Middleware

The official SDK provides `requireBearerAuth` middleware (available in newer versions):

```typescript
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';

const tokenMiddleware = requireBearerAuth({
  requiredScopes: ['default'],
  verifier: {
    verifyAccessToken: async (token: string) => {
      // Custom validation logic
      return {
        token,
        clientId: 'mcp-client',
        scopes: ['read', 'write'],
        extra: { userId: '...' },
      };
    },
  },
});
```

This is designed for Express middleware integration. Since we use raw `node:http`, we'd need to adapt it or use our current `injectAuthInfo()` approach.

### 5.3 Recommended: Declarative Auth on Tool Registration

```typescript
// Define which tools require auth in the registry
interface ToolRegistration {
  name: string;
  metadata: ToolMetadata;
  handler: ToolHandler;
  auth: 'public' | 'required';  // Declarative auth level
}

const TOOL_REGISTRY: ToolRegistration[] = [
  {
    name: 'search_products',
    metadata: { ... },
    handler: searchProducts,
    auth: 'public',
  },
  {
    name: 'get_cart',
    metadata: { ... },
    handler: getCart,
    auth: 'required',  // Enforced automatically
  },
];

// Registration loop applies auth automatically
for (const tool of TOOL_REGISTRY) {
  const wrappedHandler = tool.auth === 'required'
    ? compose(withAuth(tool.name), withAuditLog(tool.name))(tool.handler)
    : withAuditLog(tool.name)(tool.handler);

  server.registerTool(tool.name, tool.metadata, wrappedHandler);
}
```

This ensures every protected tool has auth enforcement without relying on developers to remember.

---

## 6. Resources & Prompts

### 6.1 Resources: When to Use vs. Tools

From the MCP specification:

| Aspect | Resources | Tools |
|--------|-----------|-------|
| Controlled by | Application | Model/LLM |
| Interaction model | Application-driven | Model-controlled |
| Purpose | Provide context/data | Perform actions |
| Side effects | Read-only | May modify state |
| Discovery | `resources/list` | `tools/list` |

**Resources are for data that provides context.** Use resources when:
- The data is reference material (store policies, product catalog)
- The application/client decides when to fetch it
- No side effects or mutations
- Data can be subscribed to for updates

**Tools are for actions.** Use tools when:
- The LLM decides when to invoke
- There may be side effects
- Input parameters customize behavior
- Results depend on dynamic conditions

**Our current resources are appropriate:**
- `catalog://products` -- reference data (product catalog)
- `store://policies` -- reference data (store policies)

### 6.2 Resource Subscriptions

Resources support subscriptions for real-time updates:

```typescript
// Server capability declaration
{
  capabilities: {
    resources: {
      subscribe: true,   // Client can subscribe to changes
      listChanged: true,  // Server notifies when resource list changes
    }
  }
}

// Client subscribes to a resource
// Server sends notification when resource changes:
{
  "method": "notifications/resources/updated",
  "params": { "uri": "catalog://products" }
}
```

We could use this for real-time catalog updates (new products, price changes).

### 6.3 Resource Templates

Resource templates allow parameterized URIs:

```typescript
// Template: catalog://products/{category}
server.registerResourceTemplate(
  'product-by-category',
  'catalog://products/{category}',
  {
    description: 'Products filtered by category',
    mimeType: 'application/json',
  },
  async (uri, variables) => {
    const category = variables.category;
    return readProductsByCategory(category);
  }
);
```

**Gap:** Our `catalog://products` resource handles pagination via query params inside the callback, but doesn't use the template system for category filtering.

### 6.4 Deprecated Resource/Prompt APIs

Our code uses `@ts-ignore` with deprecated methods:

```typescript
// Current (deprecated):
// @ts-ignore - using deprecated method intentionally
server.resource('products', 'catalog://products', { ... }, handler);

// @ts-ignore - using deprecated method intentionally
server.prompt('shopping_assistant', description, schema, handler);
```

**After SDK upgrade, use:**
```typescript
// Modern API (SDK 1.26+):
server.registerResource('products', 'catalog://products', { ... }, handler);
server.registerPrompt('shopping_assistant', { ... }, handler);
```

### 6.5 Prompts: Template Patterns

Prompts are user-controlled templates. Our `shopping_assistant` prompt is a good use case -- it provides a pre-built conversation starter with locale customization.

From the spec, prompts support:
- Arguments with auto-completion
- Multi-message templates (system + user roles)
- Embedded resources in messages
- Image and audio content

---

## 7. Testing Patterns

### 7.1 Current Test Coverage

| Test File | Tools Covered | Pattern |
|-----------|--------------|---------|
| `tools.test.ts` | search_products, get_cart, create_checkout | Unit tests with mocked Supabase |
| `session.test.ts` | Session management | Unit tests |
| `rate-limit.test.ts` | Rate limiting | Unit tests |
| `oauth.test.ts` | OAuth provider | Unit tests |
| `oauth-flow.test.ts` | OAuth flow | Integration-style |

**Gap:** Only 3 of 17 tools have tests. No end-to-end MCP protocol tests.

### 7.2 Recommended: In-Memory MCP Client Tests (Vitest)

The SDK provides `InMemoryTransport` for testing without spawning processes:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('MCP Server E2E', () => {
  let client: Client;
  let server: McpServer;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeEach(async () => {
    server = createMcpServer(); // Our factory

    // Create linked in-memory transports
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client({ name: 'test-client', version: '1.0.0' });

    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('should list all 17 tools', async () => {
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(17);
    expect(tools.map(t => t.name)).toContain('search_products');
    expect(tools.map(t => t.name)).toContain('get_cart');
  });

  it('should search products', async () => {
    const result = await client.callTool('search_products', {
      query: 'shirt',
      limit: 5,
    });

    expect(result.isError).toBe(false);
    const data = JSON.parse(result.content[0].text);
    expect(data.success).toBe(true);
    expect(data.products.length).toBeLessThanOrEqual(5);
  });

  it('should require auth for protected tools', async () => {
    const result = await client.callTool('get_cart', {});

    expect(result.isError).toBe(true);
    const data = JSON.parse(result.content[0].text);
    expect(data.error).toContain('Authentication required');
  });

  it('should list resources', async () => {
    const { resources } = await client.listResources();
    expect(resources).toHaveLength(2);
    expect(resources.map(r => r.uri)).toContain('catalog://products');
    expect(resources.map(r => r.uri)).toContain('store://policies');
  });

  it('should read catalog resource', async () => {
    const result = await client.readResource('catalog://products');
    const data = JSON.parse(result.contents[0].text);
    expect(data.success).toBe(true);
    expect(data.pagination).toBeDefined();
  });

  it('should list prompts', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].name).toBe('shopping_assistant');
  });
});
```

### 7.3 Unit Testing Individual Tool Handlers

Our current pattern of testing tool functions directly (without MCP protocol) is valid for unit tests:

```typescript
// Good: Test the handler function directly
describe('search_products handler', () => {
  it('should sanitize SQL injection attempts', async () => {
    const result = await searchProducts({
      query: "'; DROP TABLE products; --",
      limit: 10,
    });
    expect(result.success).toBe(true); // Sanitized, no crash
  });
});
```

### 7.4 Testing with Auth Context

```typescript
describe('Protected tools', () => {
  it('should return user profile when authenticated', async () => {
    const authInfo = createMockAuthInfo('user-123', 'test@example.com');
    const result = await getMyProfile({}, authInfo);
    expect(result.success).toBe(true);
    expect(result.profile.email).toBe('test@example.com');
  });

  it('should reject unauthenticated requests', async () => {
    const result = await getMyProfile({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication required');
  });
});
```

### 7.5 HTTP Integration Tests with Supertest

For testing the full HTTP layer (CORS, rate limiting, OAuth endpoints):

```typescript
import supertest from 'supertest';

describe('MCP HTTP Server', () => {
  it('should handle CORS preflight', async () => {
    const response = await supertest(server)
      .options('/mcp')
      .set('Origin', 'https://claude.ai')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('https://claude.ai');
  });

  it('should return health check', async () => {
    const response = await supertest(server)
      .get('/health')
      .expect(200);

    expect(response.body.tools_count).toBe(17);
  });

  it('should reject unknown routes', async () => {
    await supertest(server)
      .get('/unknown')
      .expect(404);
  });
});
```

---

## 8. Current Architecture Analysis

### 8.1 Directory Structure (Current)

```
mcp-server/src/
  index.ts              -- 1018 lines: HTTP server + ALL tool registrations
  session.ts            -- Session metadata (Redis)
  auth/
    session.ts          -- JWT validation -> AuthInfo
    oauth-provider.ts   -- OAuth 2.1 endpoints
  tools/
    search-products.ts  -- Schema + handler (PUBLIC)
    get-product-details.ts
    get-store-info.ts
    get-store-policies.ts
    get-my-profile.ts   -- (PROTECTED)
    update-my-profile.ts
    list-my-orders.ts
    get-order-status.ts
    track-shipment.ts
    get-cart.ts
    update-cart.ts
    create-checkout.ts
    list-wishlist.ts
    add-to-wishlist.ts
    remove-from-wishlist.ts
    list-categories.ts
    get-product-reviews.ts
  lib/
    supabase.ts         -- Admin client singleton
    stripe.ts           -- Stripe client singleton
    redis.ts            -- ioredis client singleton
    audit-log.ts        -- withAuditLog() HOF
    logger.ts           -- Structured logger
    completions.ts      -- Auto-completion handler
  middleware/
    rate-limit.ts       -- Redis sliding window rate limiter
  resources/
    catalog.ts          -- catalog://products
    policies.ts         -- store://policies
  prompts/
    shopping-assistant.ts
  __tests__/
    test-utils.ts
    tools.test.ts       -- 3/17 tools tested
    session.test.ts
    rate-limit.test.ts
    oauth.test.ts
    oauth-flow.test.ts
```

### 8.2 Code Repetition in index.ts

Every tool registration in `index.ts` follows an identical pattern:

```typescript
server.registerTool(
  'tool_name',
  {
    description: '...',
    inputSchema: schema,
    title: '...',
    annotations: { ... },
  },
  withAuditLog('tool_name', async (input: InputType, extra?: { authInfo?: AuthInfo }) => {
    const result = await toolHandler(input, extra?.authInfo);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: !result.success,
    };
  })
);
```

This pattern is repeated 17 times with only the tool name, schema, description, annotations, and handler function changing. The response wrapping (JSON.stringify + structuredContent + isError) is identical every time.

### 8.3 Strengths Summary

1. **Correct SDK usage**: `registerTool()`, `StreamableHTTPServerTransport`, `isInitializeRequest()`
2. **Type safety**: Full TypeScript with Zod schemas
3. **Security**: JWT validation, rate limiting, input sanitization, audit logging
4. **Operational**: Health/readiness endpoints, graceful shutdown, CORS allowlist
5. **Tool design**: Proper annotations, descriptive names, detailed schema descriptions
6. **Dual response format**: Both `content` (text) and `structuredContent` for backward compatibility

### 8.4 Weaknesses Summary

1. **Monolithic index.ts**: 1018 lines, hard to navigate
2. **No centralized auth**: Each tool checks auth individually (security risk)
3. **No outputSchema**: Missing structured output validation
4. **Deprecated APIs**: `server.resource()` and `server.prompt()` with `@ts-ignore`
5. **No SSE resumability**: Missing `InMemoryEventStore`
6. **Low test coverage**: Only 3/17 tools tested, no protocol-level tests
7. **Incorrect annotations**: Most tools incorrectly marked `openWorldHint: true`
8. **Repetitive code**: Same response wrapping pattern 17 times

---

## 9. Recommended Refactoring Plan

### Phase 1: Tool Registry Pattern (Reduce index.ts)

Create a tool registry that auto-registers tools with middleware:

```typescript
// src/tools/registry.ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { ZodTypeAny } from 'zod';
import { withAuditLog } from '../lib/audit-log.js';

interface ToolRegistration {
  name: string;
  description: string;
  title: string;
  inputSchema: ZodTypeAny;
  outputSchema?: ZodTypeAny;
  annotations: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  auth: 'public' | 'required';
  handler: (input: any, authInfo?: AuthInfo) => Promise<any>;
}

// Standard response wrapper (eliminates repetition)
function wrapToolHandler(
  tool: ToolRegistration
): (input: any, extra?: { authInfo?: AuthInfo }) => Promise<any> {
  const baseHandler = async (input: any, extra?: { authInfo?: AuthInfo }) => {
    // Auth enforcement for protected tools
    if (tool.auth === 'required') {
      const userId = (extra?.authInfo?.extra as Record<string, unknown>)?.userId;
      if (!userId) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            success: false,
            error: 'Authentication required'
          }, null, 2) }],
          isError: true,
        };
      }
    }

    const result = await tool.handler(input, extra?.authInfo);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: !result.success,
    };
  };

  return withAuditLog(tool.name, baseHandler);
}

export function registerAllTools(server: McpServer, tools: ToolRegistration[]): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        title: tool.title,
        inputSchema: tool.inputSchema,
        ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
        annotations: tool.annotations,
      },
      wrapToolHandler(tool)
    );
  }
}

export type { ToolRegistration };
```

```typescript
// src/tools/index.ts -- Tool definitions (separate from handler logic)
import type { ToolRegistration } from './registry.js';
import { searchProductsSchema, searchProducts } from './search-products.js';
import { getCartSchema, getCart } from './get-cart.js';
// ... other imports

export const TOOLS: ToolRegistration[] = [
  {
    name: 'search_products',
    description: 'Search for products in the store catalog by title, description, or category',
    title: 'Search Products',
    inputSchema: searchProductsSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    auth: 'public',
    handler: searchProducts,
  },
  {
    name: 'get_cart',
    description: "Get the authenticated user's current shopping cart",
    title: 'Get Cart',
    inputSchema: getCartSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
    },
    auth: 'required',
    handler: (input, authInfo) => getCart(input, authInfo),
  },
  // ... remaining 15 tools
];
```

```typescript
// src/index.ts -- Reduced to ~150 lines
import { createMcpServer } from './server.js';
// ... HTTP server setup, OAuth routes, health checks
```

### Phase 2: Fix Tool Annotations

Update all tools to use correct `openWorldHint` values. Only tools that interact with external APIs (Stripe, carrier tracking) should have `openWorldHint: true`.

### Phase 3: Add outputSchema

Add Zod output schemas to all tools that return structured JSON. This enables client-side validation and better documentation.

### Phase 4: SDK Upgrade & API Migration

1. Upgrade `@modelcontextprotocol/sdk` from `^1.0.4` to `^1.26.0`
2. Replace deprecated `server.resource()` with `server.registerResource()`
3. Replace deprecated `server.prompt()` with `server.registerPrompt()`
4. Add `InMemoryEventStore` to `StreamableHTTPServerTransport`
5. Remove `@ts-ignore` comments

### Phase 5: Test Coverage

1. Add in-memory MCP client tests for all 17 tools
2. Add HTTP integration tests with supertest
3. Add auth flow integration tests
4. Target: 100% tool coverage, >80% line coverage

---

## 10. Anti-Patterns to Avoid

### 10.1 Tool Registration Anti-Patterns

```typescript
// ANTI-PATTERN: Using deprecated tool() method
server.tool('search', schema.shape, handler); // OLD API

// CORRECT: Use registerTool()
server.registerTool('search_products', { inputSchema: schema }, handler);

// ANTI-PATTERN: Passing schema.shape instead of full schema
server.registerTool('search', { inputSchema: schema.shape }, handler);

// CORRECT: Pass the full Zod schema
server.registerTool('search', { inputSchema: schema }, handler);
```

### 10.2 Auth Anti-Patterns

```typescript
// ANTI-PATTERN: Each tool manually checks auth (easy to forget)
withAuditLog('get_cart', async (input, extra) => {
  if (!extra?.authInfo?.extra?.userId) {
    return { content: [...], isError: true };
  }
  // ... handler logic
});

// CORRECT: Centralized auth enforcement
const protectedHandler = compose(
  withAuth('get_cart'),
  withAuditLog('get_cart'),
)(getCartHandler);
```

### 10.3 Error Handling Anti-Patterns

```typescript
// ANTI-PATTERN: Throwing errors from tool handlers (becomes protocol error)
async (input) => {
  throw new Error('Product not found'); // LLM cannot see this
}

// CORRECT: Return isError in result (LLM sees and can handle)
async (input) => {
  return {
    content: [{ type: 'text', text: 'Product not found' }],
    isError: true,
  };
}
```

### 10.4 Resource Anti-Patterns

```typescript
// ANTI-PATTERN: Using resources for actions/mutations
server.resource('create-order', 'store://create-order', handler);

// CORRECT: Resources are READ-ONLY context; use tools for actions

// ANTI-PATTERN: Returning non-serializable data in resources
return { contents: [{ text: circularRefObject }] };

// CORRECT: Always return valid JSON or text
return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data) }] };
```

### 10.5 Annotation Anti-Patterns

```typescript
// ANTI-PATTERN: Setting all annotations to true/false without thinking
annotations: {
  readOnlyHint: true,
  destructiveHint: false,   // Meaningless when readOnlyHint=true
  idempotentHint: true,     // Meaningless when readOnlyHint=true
  openWorldHint: true,      // Wrong if tool only queries internal DB
}

// CORRECT: Only set meaningful annotations
annotations: {
  readOnlyHint: true,
  openWorldHint: false,     // Only queries our Supabase DB
}
```

### 10.6 Testing Anti-Patterns

```typescript
// ANTI-PATTERN: Testing with subprocess spawning (slow, flaky)
const proc = spawn('node', ['dist/index.js']);
// ... send JSON-RPC over stdin

// CORRECT: Use InMemoryTransport for fast in-process testing
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
```

### 10.7 Session Anti-Patterns

```typescript
// ANTI-PATTERN: Reusing a single McpServer across sessions
const server = createMcpServer(); // Created once
// All sessions share the same server instance

// CORRECT: One McpServer per session (our current pattern is correct)
if (isInitializeRequest(body)) {
  const server = createMcpServer(); // New server per session
  await server.connect(transport);
}
```

---

## Sources

### Official Documentation
- [MCP Tools Specification](https://modelcontextprotocol.io/docs/concepts/tools) -- Protocol revision 2025-06-18
- [MCP Resources Specification](https://modelcontextprotocol.io/docs/concepts/resources) -- Resource types, subscriptions, templates
- [MCP Prompts Specification](https://modelcontextprotocol.io/docs/concepts/prompts) -- Prompt templates and arguments
- [MCP Tool Annotations (Legacy)](https://modelcontextprotocol.io/legacy/concepts/tools) -- Detailed annotation semantics

### SDK & Examples
- [TypeScript SDK Repository](https://github.com/modelcontextprotocol/typescript-sdk) -- Official SDK
- [SDK Middleware Feature Request #1238](https://github.com/modelcontextprotocol/typescript-sdk/issues/1238) -- Middleware discussion
- [Build an MCP Server](https://modelcontextprotocol.io/docs/develop/build-server) -- Official getting started

### Community Implementations
- [FastMCP Framework](https://github.com/punkpeye/fastmcp) -- TypeScript MCP framework with middleware
- [FastMCP Middleware Documentation](https://gofastmcp.com/servers/middleware) -- Comprehensive middleware patterns
- [Portal One: MCP Server with OAuth](https://portal.one/blog/mcp-server-with-oauth-typescript/) -- Production OAuth integration
- [Building Production-Ready MCP Servers (DEV.to)](https://dev.to/quantbit/building-production-ready-mcp-servers-with-typescript-a-complete-guide-2mg1) -- Complete guide
- [MCP Server with Authentication](https://atlassc.net/2026/02/25/building-an-mcp-server-with-authentication) -- Auth middleware pattern

### Testing
- [Unit Testing MCP Servers (MCPcat)](https://mcpcat.io/guides/writing-unit-tests-mcp-servers/) -- Testing patterns
- [MCP E2E Testing Example](https://creati.ai/mcp/mcp-server-e2e-testing-example/) -- Vitest E2E patterns
- [MCP Server with Vitest & K6](https://medium.com/@rajasekaran.parthiban7/%EF%B8%8F-mcp-server-node-js-typescript-vitest-k6-f056dad97288) -- Performance testing

### Tool Annotations
- [MCP Tool Annotations Introduction](https://blog.marcnuri.com/mcp-tool-annotations-introduction) -- Annotation semantics
- [Quick Fix: MCP Tools as Write Tools](https://dev.to/nickytonline/quick-fix-my-mcp-tools-were-showing-as-write-tools-in-chatgpt-dev-mode-3id9) -- Practical annotation impact
