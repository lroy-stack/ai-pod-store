# MCP Specification, SDK & Authorization -- Research Document

**Date**: 2026-03-09
**Sources**: Official MCP spec (modelcontextprotocol.io), TypeScript SDK GitHub (modelcontextprotocol/typescript-sdk), npm registry
**Purpose**: Inform the design of SKAPARA's e-commerce MCP server (17 tools, public + authenticated users)

---

## Table of Contents

1. [Protocol Version & Lifecycle](#1-protocol-version--lifecycle)
2. [Transport Mechanisms](#2-transport-mechanisms)
3. [Session Management](#3-session-management)
4. [Authorization Specification](#4-authorization-specification)
5. [TypeScript SDK](#5-typescript-sdk)
6. [Tool Design Specification](#6-tool-design-specification)
7. [Security Best Practices](#7-security-best-practices)
8. [Recommendations for SKAPARA MCP Server](#8-recommendations-for-skapara-mcp-server)

---

## 1. Protocol Version & Lifecycle

### Current Protocol Version

**`2025-11-25`** (marked as "Current" -- ready for use, may receive backwards-compatible changes).

Previous revisions:
- `2025-03-26` (Final)
- `2024-11-05` (Final -- introduced HTTP+SSE transport, now deprecated in favor of Streamable HTTP)

Version format is `YYYY-MM-DD`, indicating the last date backwards-incompatible changes were made. The version is NOT incremented for backwards-compatible changes.

### Lifecycle Phases

The protocol defines three mandatory phases:

#### Phase 1: Initialization

The initialization phase **MUST** be the first interaction. During this phase:

- Client sends `initialize` request with: protocol version, client capabilities, client info
- Server responds with: agreed protocol version, server capabilities, server info
- Client sends `notifications/initialized` notification

**Initialize Request** (from spec):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": { "form": {}, "url": {} }
    },
    "clientInfo": {
      "name": "ExampleClient",
      "version": "1.0.0"
    }
  }
}
```

**Initialize Response** (from spec):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "logging": {},
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true }
    },
    "serverInfo": {
      "name": "ExampleServer",
      "version": "1.0.0"
    },
    "instructions": "Optional instructions for the client"
  }
}
```

**Version Negotiation**: Client sends the latest version it supports. If server supports it, responds with same version. Otherwise, server responds with a different supported version. If client doesn't support the server's version, it SHOULD disconnect.

**Key Rule for HTTP**: After initialization, the client **MUST** include `MCP-Protocol-Version: <version>` header on ALL subsequent HTTP requests.

#### Phase 2: Operation

Normal protocol communication. Both parties MUST respect negotiated capabilities and protocol version.

#### Phase 3: Shutdown

For HTTP transports: shutdown is indicated by closing the associated HTTP connection(s). Clients SHOULD send HTTP DELETE to the MCP endpoint with session ID to explicitly terminate.

### Capability Negotiation

Key **server** capabilities:

| Capability | Description |
|---|---|
| `tools` | Exposes callable tools |
| `resources` | Provides readable resources |
| `prompts` | Offers prompt templates |
| `logging` | Emits structured log messages |
| `completions` | Supports argument autocompletion |
| `tasks` (experimental) | Task-augmented execution |

Sub-capabilities: `listChanged` (notifications when lists change), `subscribe` (resource subscription).

### Timeouts

Implementations SHOULD establish timeouts for all sent requests. When timeout expires, sender SHOULD issue a cancellation notification and stop waiting. SDKs SHOULD allow per-request timeout configuration.

---

## 2. Transport Mechanisms

MCP defines two standard transports:

### 2.1 stdio Transport

- Client launches MCP server as a subprocess
- Server reads JSON-RPC from stdin, writes to stdout
- Messages delimited by newlines, MUST NOT contain embedded newlines
- Best for: local, process-spawned integrations (Claude Desktop, CLI tools)

### 2.2 Streamable HTTP Transport (RECOMMENDED for remote servers)

**This is the transport we need for SKAPARA.**

Replaces the deprecated HTTP+SSE transport from protocol version 2024-11-05.

The server provides a **single HTTP endpoint** (the "MCP endpoint") supporting POST, GET, and DELETE methods. Example: `https://example.com/mcp`

#### Client-to-Server Messages (POST)

- Every JSON-RPC message from client = new HTTP POST to the MCP endpoint
- Client MUST include `Accept: application/json, text/event-stream` header
- POST body = single JSON-RPC request, notification, or response
- For notifications/responses: server returns `202 Accepted` (no body)
- For requests: server returns either `Content-Type: application/json` (single response) or `Content-Type: text/event-stream` (SSE stream)

When server opens an SSE stream for a request:
- Server SHOULD immediately send an SSE event with event ID and empty data (for reconnection priming)
- Server MAY close connection without terminating stream; client SHOULD reconnect ("polling")
- Server SHOULD send `retry` field before closing connection
- Stream SHOULD eventually include the JSON-RPC response
- Server MAY send additional requests/notifications before the response
- After response is sent, server SHOULD terminate the SSE stream

#### Server-to-Client Messages (GET)

- Client MAY issue HTTP GET to open an SSE stream for server-initiated messages
- Client MUST include `Accept: text/event-stream`
- Server MUST return `text/event-stream` or `405 Method Not Allowed`
- Used for server-initiated requests/notifications unrelated to any current client request

#### Session Termination (DELETE)

- Client SHOULD send HTTP DELETE with `MCP-Session-Id` to terminate session
- Server MAY respond with `405 Method Not Allowed` if it doesn't support client-initiated termination

#### JSON Response Mode

For servers that don't need SSE, set `enableJsonResponse: true`. Returns plain JSON to every POST, rejects GET with `405`.

#### Security Warning (from spec)

> When implementing Streamable HTTP transport:
> 1. Servers **MUST** validate the `Origin` header on all incoming connections to prevent DNS rebinding attacks
> 2. When running locally, servers **SHOULD** bind only to localhost (127.0.0.1)
> 3. Servers **SHOULD** implement proper authentication for all connections

#### Backwards Compatibility

To support older clients (2024-11-05 HTTP+SSE):
1. Client POSTs InitializeRequest to server URL
2. If succeeds: new Streamable HTTP transport
3. If fails (400/404/405): issue GET, expect SSE with `endpoint` event = old transport

---

## 3. Session Management

### How Sessions Work

An MCP "session" = logically related interactions beginning with initialization.

1. Server **MAY** assign a session ID at initialization by including `MCP-Session-Id` header in the HTTP response containing the `InitializeResult`
2. Session ID requirements:
   - SHOULD be globally unique and cryptographically secure (e.g., securely generated UUID, JWT, or cryptographic hash)
   - MUST only contain visible ASCII characters (0x21 to 0x7E)
3. Client MUST include `MCP-Session-Id` header on ALL subsequent HTTP requests
4. Server SHOULD respond with `400 Bad Request` to requests missing required session ID
5. Server MAY terminate session at any time; MUST respond with `404 Not Found` to requests for terminated sessions
6. When client gets `404` for a session, it MUST start a new session with a fresh `InitializeRequest`
7. Client SHOULD send HTTP DELETE to terminate session when no longer needed

### Resumability and Redelivery

For surviving broken connections:

- Servers MAY attach `id` fields to SSE events (globally unique within session)
- Client reconnects via HTTP GET with `Last-Event-ID` header
- Server MAY replay messages that would have been sent after that event ID
- Server MUST NOT replay messages from a different stream
- Resumption is ALWAYS via HTTP GET with `Last-Event-ID` (regardless of original stream type)

### Stateless vs Stateful

The SDK supports both modes:
- **Stateless**: `sessionIdGenerator: undefined` -- no session tracking, ideal for simple API-style servers
- **Stateful**: `sessionIdGenerator: () => randomUUID()` -- sessions with IDs, resumability, advanced features

### Protocol Version Header

Client MUST include `MCP-Protocol-Version: 2025-11-25` on all subsequent HTTP requests. If server receives invalid/unsupported version, it MUST respond with `400 Bad Request`.

If no header and no other way to identify version, server SHOULD assume `2025-03-26`.

---

## 4. Authorization Specification

### Overview

Authorization is **OPTIONAL** for MCP implementations. The 2025-11-25 spec has significant changes from 2025-03-26.

Key standards:
- **OAuth 2.1** (draft-ietf-oauth-v2-1-13)
- **RFC 9728**: OAuth 2.0 Protected Resource Metadata (NEW in 2025-11-25)
- **RFC 8414**: OAuth 2.0 Authorization Server Metadata
- **RFC 7591**: Dynamic Client Registration
- **RFC 8707**: Resource Indicators for OAuth 2.0 (NEW in 2025-11-25)
- **Client ID Metadata Documents** (draft-ietf-oauth-client-id-metadata-document-00) (NEW in 2025-11-25)

### Roles (2025-11-25)

- **MCP Server** = OAuth 2.1 Resource Server (accepts access tokens)
- **MCP Client** = OAuth 2.1 Client (makes protected requests)
- **Authorization Server** = Issues tokens (can be same as MCP server or separate)

### Major Changes from 2025-03-26 to 2025-11-25

1. **RFC 9728 Protected Resource Metadata is now REQUIRED** for MCP servers (was not in 2025-03-26)
2. **Client ID Metadata Documents** are the new preferred registration mechanism (replacing Dynamic Client Registration as primary)
3. **RFC 8707 Resource Indicators** are now REQUIRED in auth/token requests
4. **Fallback URL defaults** (`/authorize`, `/token`, `/register`) have been REMOVED -- servers MUST implement RFC 9728 discovery
5. More explicit separation of MCP server (resource server) from authorization server

### Authorization Server Discovery Flow (2025-11-25)

1. Client sends MCP request without token
2. Server responds `401 Unauthorized` with `WWW-Authenticate` header:
   ```
   WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource",
                            scope="files:read"
   ```
3. Client fetches Protected Resource Metadata from that URL
4. Metadata document contains `authorization_servers` field with auth server URL(s)
5. Client fetches Authorization Server Metadata (`/.well-known/oauth-authorization-server` or `/.well-known/openid-configuration`)
6. Client proceeds with OAuth 2.1 flow

### Client Registration (Priority Order)

1. **Pre-registered** client info (if available)
2. **Client ID Metadata Documents** (if AS supports `client_id_metadata_document_supported`)
3. **Dynamic Client Registration** (if AS has `registration_endpoint`)
4. Prompt user to enter client info manually

### OAuth Grant Types

- **Authorization Code**: For human users (e.g., agent calling MCP tool on behalf of user)
- **Client Credentials**: For machine-to-machine (e.g., agent checking inventory, no human needed)

### PKCE Requirements

- MCP clients **MUST** implement PKCE
- **MUST** use `S256` code challenge method when technically capable
- Clients MUST verify PKCE support via `code_challenge_methods_supported` in AS metadata
- If AS doesn't declare PKCE support, clients MUST refuse to proceed

### Token Requirements

- Clients MUST use `Authorization: Bearer <token>` header
- Authorization MUST be included in EVERY HTTP request (even within same session)
- Tokens MUST NOT be in URI query string
- Servers MUST validate that tokens were issued specifically for them (audience validation)
- Invalid/expired tokens MUST receive HTTP 401
- Insufficient scopes SHOULD receive HTTP 403

### Resource Parameter (RFC 8707)

Clients MUST include `resource` parameter in both authorization and token requests:
```
&resource=https%3A%2F%2Fmcp.example.com
```
This binds tokens to their intended audience, preventing token reuse across services.

### Scope Selection Strategy

Priority order:
1. Use `scope` from initial `WWW-Authenticate` header
2. If unavailable, use all `scopes_supported` from Protected Resource Metadata
3. Progressive scope elevation via `403 Forbidden` with `WWW-Authenticate: Bearer error="insufficient_scope", scope="needed_scope"`

### Third-Party Authorization Flow

MCP servers MAY delegate authorization to third-party auth servers. The MCP server acts as both:
- OAuth client (to third-party AS)
- OAuth authorization server (to MCP client)

Requirements:
- Maintain secure mapping between third-party tokens and MCP tokens
- Validate third-party token status before honoring MCP tokens
- MUST NOT pass through third-party tokens

### Error Handling

| Status Code | Description | Usage |
|---|---|---|
| 401 | Unauthorized | Auth required or token invalid |
| 403 | Forbidden | Invalid scopes or insufficient permissions |
| 400 | Bad Request | Malformed authorization request |

---

## 5. TypeScript SDK

### Package Landscape

**v1.x (Current stable -- RECOMMENDED for production)**:
- **Package**: `@modelcontextprotocol/sdk` (monolithic)
- **Latest**: `1.27.1` (published 2026-02-24)
- **npm**: https://www.npmjs.com/package/@modelcontextprotocol/sdk
- **Peer dep**: `zod` (v3.x)

**v2 (In development -- pre-alpha)**:
- **Packages** (split monorepo):
  - `@modelcontextprotocol/server` -- build MCP servers
  - `@modelcontextprotocol/client` -- build MCP clients
  - `@modelcontextprotocol/node` -- Node.js Streamable HTTP transport
  - `@modelcontextprotocol/express` -- Express helpers + DNS rebinding protection
  - `@modelcontextprotocol/hono` -- Hono helpers
- **Peer dep**: `zod` (v4 -- `zod/v4`)
- **Status**: "We anticipate a stable v2 release in Q1 2026"
- v1.x will receive bug fixes and security updates for 6 months after v2 ships

### v2 SDK -- Server API (from docs/server.md)

#### Creating a Server

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { createMcpExpressApp } from '@modelcontextprotocol/express';

const server = new McpServer(
  {
    name: 'my-server',
    version: '1.0.0',
    icons: [{ src: './icon.svg', sizes: ['512x512'], mimeType: 'image/svg+xml' }],
    websiteUrl: 'https://example.com'
  },
  {
    capabilities: { logging: {} }
  }
);
```

#### Registering Tools (v2: `registerTool()`)

```typescript
import * as z from 'zod/v4';

server.registerTool(
  'calculate-bmi',
  {
    title: 'BMI Calculator',
    description: 'Calculate Body Mass Index',
    inputSchema: z.object({
      weightKg: z.number(),
      heightM: z.number()
    }),
    outputSchema: z.object({ bmi: z.number() })
  },
  async ({ weightKg, heightM }) => {
    const output = { bmi: weightKg / (heightM * heightM) };
    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
      structuredContent: output
    };
  }
);
```

Key differences from v1:
- v2 uses `registerTool()` (not `tool()`)
- v2 uses Zod v4 (`zod/v4`)
- v2 supports `outputSchema` and `structuredContent`
- v2 handler receives `(args, ctx)` where `ctx` provides `ctx.mcpReq.log()`, `ctx.mcpReq.requestSampling()`, etc.

#### Tool Annotations

```typescript
server.registerTool(
  'multi-greet',
  {
    description: 'A tool that sends different greetings',
    inputSchema: z.object({ name: z.string() }),
    annotations: {
      title: 'Multiple Greeting Tool',
      readOnlyHint: true,
      openWorldHint: false
    }
  },
  async ({ name }, ctx): Promise<CallToolResult> => { /* ... */ }
);
```

#### Registering Resources

Static resource:
```typescript
server.registerResource(
  'config',
  'config://app',
  { title: 'Application Config', description: '...', mimeType: 'text/plain' },
  async uri => ({ contents: [{ uri: uri.href, text: '...' }] })
);
```

Dynamic resource with template:
```typescript
server.registerResource(
  'user-profile',
  new ResourceTemplate('user://{userId}/profile', {
    list: async () => ({
      resources: [
        { uri: 'user://123/profile', name: 'Alice' },
        { uri: 'user://456/profile', name: 'Bob' }
      ]
    })
  }),
  { title: 'User Profile', mimeType: 'application/json' },
  async (uri, { userId }) => ({
    contents: [{ uri: uri.href, text: JSON.stringify({ userId }) }]
  })
);
```

#### Registering Prompts

```typescript
server.registerPrompt(
  'review-code',
  {
    title: 'Code Review',
    description: 'Review code for best practices',
    argsSchema: z.object({ code: z.string() })
  },
  ({ code }) => ({
    messages: [{
      role: 'user' as const,
      content: { type: 'text' as const, text: `Please review:\n\n${code}` }
    }]
  })
);
```

### Transport Setup (v2)

#### Stateless Server (simplest)

```typescript
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';

const app = createMcpExpressApp();

app.post('/mcp', async (req, res) => {
  const server = new McpServer({ name: 'my-server', version: '1.0.0' });
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined  // stateless
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(3000, '127.0.0.1');
```

#### Stateful Server (with sessions, resumability, auth)

From the official `simpleStreamableHttp.ts` example:

```typescript
import { randomUUID } from 'node:crypto';
import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { isInitializeRequest, McpServer } from '@modelcontextprotocol/server';
import cors from 'cors';

const app = createMcpExpressApp();

// CORS for browser clients
app.use(cors({
  exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id', 'Last-Event-Id', 'Mcp-Protocol-Version'],
  origin: '*'  // restrict in production
}));

// Map to store transports by session ID
const transports: { [sessionId: string]: NodeStreamableHTTPServerTransport } = {};

// POST handler
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    await transports[sessionId].handleRequest(req, res, req.body);
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization
    const eventStore = new InMemoryEventStore();
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      eventStore,  // Enable resumability
      onsessioninitialized: sessionId => {
        transports[sessionId] = transport;
      }
    });

    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && transports[sid]) delete transports[sid];
    };

    const server = getServer();  // Create McpServer instance
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
      id: null
    });
  }
});

// GET handler (SSE streams)
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

// DELETE handler (session termination)
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});
```

### Auth Integration (v2 SDK)

From the official example, auth is wired as Express middleware:

```typescript
import {
  createProtectedResourceMetadataRouter,
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
  setupAuthServer
} from '@modelcontextprotocol/examples-shared';

// Set up OAuth
const mcpServerUrl = new URL('http://localhost:3000/mcp');
const authServerUrl = new URL('http://localhost:3001');

setupAuthServer({ authServerUrl, mcpServerUrl, strictResource: false, demoMode: true });

// Protected Resource Metadata route
app.use(createProtectedResourceMetadataRouter('/mcp'));

// Auth middleware
const authMiddleware = requireBearerAuth({
  requiredScopes: [],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
  strictResource: false,
  expectedResource: mcpServerUrl
});

// Apply to routes
app.post('/mcp', authMiddleware, mcpPostHandler);
app.get('/mcp', authMiddleware, mcpGetHandler);
app.delete('/mcp', authMiddleware, mcpDeleteHandler);
```

### DNS Rebinding Protection

`createMcpExpressApp()` includes Host header validation by default:

```typescript
// Default: DNS rebinding protection auto-enabled
const app = createMcpExpressApp();

// When binding to all interfaces, provide allowlist
const app = createMcpExpressApp({
  host: '0.0.0.0',
  allowedHosts: ['localhost', '127.0.0.1', 'myhost.local']
});
```

### Logging from Handlers

```typescript
server.registerTool(
  'fetch-data',
  {
    description: 'Fetch data from an API',
    inputSchema: z.object({ url: z.string() })
  },
  async ({ url }, ctx): Promise<CallToolResult> => {
    await ctx.mcpReq.log('info', `Fetching ${url}`);
    const res = await fetch(url);
    await ctx.mcpReq.log('debug', `Response status: ${res.status}`);
    const text = await res.text();
    return { content: [{ type: 'text', text }] };
  }
);
```

### Elicitation (User Input)

Two modes:
- **Form** (`mode: 'form'`): Collects non-sensitive data via schema-driven form
- **URL** (`mode: 'url'`): For sensitive data (API keys, payments, OAuth)

```typescript
const result = await ctx.mcpReq.elicitInput({
  mode: 'form',
  message: 'Please share your feedback:',
  requestedSchema: {
    type: 'object',
    properties: {
      rating: { type: 'number', title: 'Rating', minimum: 1, maximum: 5 }
    },
    required: ['rating']
  }
});
```

### Tasks (Experimental)

```typescript
server.experimental.tasks.registerToolTask(
  'long-operation',
  { description: '...', inputSchema: z.object({ duration: z.number() }) },
  {
    async createTask({ duration }, ctx) {
      const task = await ctx.task.store.createTask({ ttl: ctx.task.requestedTtl });
      // Perform async work...
      return { task };
    },
    async getTask(_args, ctx) {
      return await ctx.task.store.getTask(ctx.task.id);
    },
    async getTaskResult(_args, ctx) {
      return await ctx.task.store.getTaskResult(ctx.task.id);
    }
  }
);
```

---

## 6. Tool Design Specification

### Tool Definition Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique identifier (1-128 chars, case-sensitive, `[A-Za-z0-9_\-.]`) |
| `title` | No | Human-readable display name |
| `description` | No | Human-readable description |
| `inputSchema` | Yes | JSON Schema for expected parameters (MUST be valid JSON Schema object, not null) |
| `outputSchema` | No | JSON Schema for structured output validation |
| `annotations` | No | Behavioral hints (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) |
| `icons` | No | Array of icons for UI display |
| `execution` | No | Execution properties (`taskSupport`: "forbidden"/"optional"/"required") |

### Tool Result Structure

Tools return `CallToolResult` with:
- `content`: Array of content items (text, image, audio, resource_link, resource)
- `structuredContent`: Optional structured JSON (if `outputSchema` is defined)
- `isError`: Boolean indicating execution error

### Error Handling (Two Levels)

1. **Protocol Errors**: Standard JSON-RPC errors (unknown tool, malformed request, server error)
   ```json
   { "jsonrpc": "2.0", "id": 3, "error": { "code": -32602, "message": "Unknown tool: invalid_tool_name" } }
   ```

2. **Tool Execution Errors**: Reported with `isError: true` -- actionable feedback for LLM self-correction
   ```json
   { "result": { "content": [{ "type": "text", "text": "Invalid date: must be in the future" }], "isError": true } }
   ```

### Security Requirements for Tools

Servers MUST:
- Validate all tool inputs
- Implement proper access controls
- Rate limit tool invocations
- Sanitize tool outputs

Clients SHOULD:
- Prompt for user confirmation on sensitive operations
- Show tool inputs to user before calling server
- Validate tool results before passing to LLM
- Implement timeouts for tool calls
- Log tool usage for audit purposes

---

## 7. Security Best Practices

### Session Hijacking Prevention

- Servers implementing authorization MUST verify ALL inbound requests
- Servers MUST NOT use sessions for authentication (sessions are NOT auth tokens)
- Session IDs MUST be secure, non-deterministic (use cryptographic random generators)
- Servers SHOULD bind session IDs to user-specific information (e.g., `<user_id>:<session_id>`)

### Token Passthrough (FORBIDDEN)

MCP servers MUST NOT:
- Accept tokens not issued specifically for them
- Forward/passthrough tokens to downstream APIs
- Skip audience validation on tokens

### Confused Deputy Prevention

MCP proxy servers using static client IDs MUST obtain user consent for EACH dynamically registered client before forwarding to third-party authorization servers.

### Scope Minimization

- Start with minimal scope set (e.g., `mcp:tools-basic`)
- Use incremental elevation via `WWW-Authenticate` challenges
- Avoid wildcard/omnibus scopes (`*`, `all`, `full-access`)
- Server SHOULD accept reduced-scope tokens

### DNS Rebinding Protection

- Servers MUST validate `Origin` header (return 403 if invalid)
- Localhost servers SHOULD bind to 127.0.0.1 only
- Use `createMcpExpressApp()` which includes Host header validation

### SSRF Prevention

MCP clients SHOULD:
- Require HTTPS for all OAuth URLs in production
- Block private IP ranges (10.x, 172.16.x, 192.168.x, 169.254.x)
- Validate redirect targets
- Consider using egress proxies

---

## 8. Recommendations for SKAPARA MCP Server

### SDK Version Decision

**Recommendation: Start with v1.x (`@modelcontextprotocol/sdk@1.27.1`), plan migration to v2.**

Rationale:
- v2 is still "pre-alpha" (stable Q1 2026 target, which means very soon)
- v1.x is the recommended production version
- v1.x has `StreamableHTTPServerTransport` and supports the 2025-11-25 spec
- v2 split packages (`@modelcontextprotocol/server` + `@modelcontextprotocol/node` + `@modelcontextprotocol/express`) are the future

**Alternative: If timeline allows, go directly to v2** since Q1 2026 is now. The API patterns (`registerTool()`, `McpServer`, `NodeStreamableHTTPServerTransport`) are stable and well-documented. The v2 example server (`simpleStreamableHttp.ts`) is production-grade.

### Transport

**Use Streamable HTTP** -- this is the only sensible choice for a remote HTTP server.

Configuration:
- **Stateful mode** with `sessionIdGenerator: () => randomUUID()` for session tracking
- **Enable resumability** with an EventStore (start with InMemoryEventStore, migrate to Redis-backed later)
- **Enable JSON response mode** (`enableJsonResponse: true`) as fallback for clients that don't support SSE
- Single endpoint: `POST/GET/DELETE /mcp`

### Authentication Architecture

**Two-tier approach** matching our public + authenticated user model:

1. **Public tools** (browse products, search, view product details): No auth required
   - Server returns results without requiring `Authorization` header
   - These tools check `if (authInfo) { ... }` to optionally personalize

2. **Authenticated tools** (add to cart, checkout, manage orders, manage profile): Require valid Bearer token
   - Server responds `401 Unauthorized` when token is missing/invalid
   - Use existing Supabase Auth as the authorization server (Supabase already implements OAuth)

**Implementation approach**:
- Wrap each tool handler to check auth requirement
- For auth-required tools: validate Supabase JWT from `Authorization: Bearer` header
- Return `401` with `WWW-Authenticate: Bearer resource_metadata="..."` for unauthenticated requests to protected tools
- Implement RFC 9728 Protected Resource Metadata at `/.well-known/oauth-protected-resource/mcp`

### Tool Design for SKAPARA

Based on the spec, each tool should have:

```typescript
server.registerTool(
  'browse-products',        // name: snake-case with category prefix
  {
    title: 'Browse Products',
    description: 'Browse the SKAPARA product catalog with optional filters',
    inputSchema: z.object({
      category: z.string().optional().describe('Product category filter'),
      search: z.string().optional().describe('Search query'),
      page: z.number().optional().default(1).describe('Page number'),
      limit: z.number().optional().default(20).describe('Items per page')
    }),
    annotations: {
      readOnlyHint: true,     // Does not modify state
      openWorldHint: false    // Operates in a closed domain
    }
  },
  async (args, ctx) => {
    // Implementation
    return {
      content: [{ type: 'text', text: JSON.stringify(products) }],
      structuredContent: products
    };
  }
);
```

### Tool Categorization (17 tools)

| Tool | Auth Required | Annotations |
|---|---|---|
| `browse-products` | No | readOnly, !destructive |
| `search-products` | No | readOnly, !destructive |
| `get-product-details` | No | readOnly, !destructive |
| `get-product-variants` | No | readOnly, !destructive |
| `get-categories` | No | readOnly, !destructive |
| `add-to-cart` | Yes | !readOnly, !destructive |
| `remove-from-cart` | Yes | !readOnly, destructive |
| `update-cart-item` | Yes | !readOnly, !destructive |
| `get-cart` | Yes | readOnly, !destructive |
| `create-checkout` | Yes | !readOnly, !destructive |
| `get-checkout-status` | Yes | readOnly, !destructive |
| `list-orders` | Yes | readOnly, !destructive |
| `get-order-details` | Yes | readOnly, !destructive |
| `track-order` | Yes | readOnly, !destructive |
| `get-profile` | Yes | readOnly, !destructive |
| `update-profile` | Yes | !readOnly, !destructive |
| `manage-wishlist` | Yes | !readOnly, !destructive |

### CORS Headers

Essential for browser-based AI clients:
```typescript
app.use(cors({
  exposedHeaders: ['WWW-Authenticate', 'Mcp-Session-Id', 'Last-Event-Id', 'Mcp-Protocol-Version'],
  origin: ['https://claude.ai', 'https://chatgpt.com']  // Restrict in production
}));
```

### Security Checklist

- [ ] Validate `Origin` header on all connections (DNS rebinding protection)
- [ ] Bind to `127.0.0.1` in dev, use domain validation in prod
- [ ] Implement rate limiting per tool per session
- [ ] Validate all tool inputs with Zod schemas
- [ ] Sanitize all tool outputs (no internal errors, no DB details)
- [ ] Use cryptographically secure session IDs (randomUUID)
- [ ] Bind session IDs to user identity when authenticated
- [ ] Implement Protected Resource Metadata (RFC 9728) at well-known URI
- [ ] Validate token audience (tokens must be issued for this server)
- [ ] HTTPS required in production
- [ ] Implement request timeouts
- [ ] Log all tool invocations for audit

### Deployment Architecture

```
                  Internet
                     |
                   Caddy (HTTPS/TLS)
                     |
              /mcp endpoint
                     |
          SKAPARA MCP Server (port 8002)
           |                    |
     Supabase Cloud       Redis Cache
     (DB + Auth)          (Sessions)
```

- MCP server as Docker container in existing stack
- Single `/mcp` endpoint handling POST/GET/DELETE
- Caddy reverse proxy for HTTPS termination
- Redis for session storage and event store (for resumability)
- Supabase for data access and JWT validation

---

## Appendix A: Key Spec Quotes

### On Transport Choice
> "Local MCP servers that use the STDIO transport typically serve a single MCP client, whereas remote MCP servers that use the Streamable HTTP transport will typically serve many MCP clients."

### On Session Security
> "MCP servers that implement authorization MUST verify all inbound requests. MCP Servers MUST NOT use sessions for authentication."

### On Token Passthrough
> "MCP servers MUST NOT accept any tokens that were not explicitly issued for the MCP server."

### On Tool Security
> "For trust & safety and security, there SHOULD always be a human in the loop with the ability to deny tool invocations."

### On Auth Being Optional
> "Authorization is OPTIONAL for MCP implementations."

---

## Appendix B: Version Comparison

| Feature | 2024-11-05 | 2025-03-26 | 2025-11-25 |
|---|---|---|---|
| Transport | HTTP+SSE | Streamable HTTP | Streamable HTTP |
| Auth discovery | N/A | Fallback URLs (/authorize, /token) | RFC 9728 Protected Resource Metadata |
| Client registration | N/A | Dynamic Client Registration (primary) | Client ID Metadata Documents (primary) |
| Resource indicators | N/A | N/A | RFC 8707 (REQUIRED) |
| PKCE | N/A | Required | Required (S256 mandatory) |
| Tasks | N/A | N/A | Experimental |
| Structured output | N/A | N/A | outputSchema + structuredContent |
| Tool annotations | N/A | N/A | readOnlyHint, destructiveHint, etc. |

---

## Appendix C: npm Package Reference

| Package | Version | Status | Use |
|---|---|---|---|
| `@modelcontextprotocol/sdk` | 1.27.1 | Stable (v1) | Monolithic SDK for production |
| `@modelcontextprotocol/server` | pre-alpha | v2 dev | Server-only package |
| `@modelcontextprotocol/client` | pre-alpha | v2 dev | Client-only package |
| `@modelcontextprotocol/node` | pre-alpha | v2 dev | Node.js HTTP transport |
| `@modelcontextprotocol/express` | pre-alpha | v2 dev | Express middleware + DNS protection |
| `@modelcontextprotocol/hono` | pre-alpha | v2 dev | Hono middleware |
