# MCP Server — SDK Reference (v1.26.0)

## Transport Pattern: One Transport Per Session

Each `initialize` request creates a NEW `StreamableHTTPServerTransport` + `McpServer` pair.
The SDK handles `Mcp-Session-Id` headers automatically when `sessionIdGenerator` is provided.

**Key imports:**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
```

**Pattern:**
```typescript
const transports = new Map<string, StreamableHTTPServerTransport>();

// POST /mcp handler:
if (sessionId && transports.has(sessionId)) {
  await transports.get(sessionId)!.handleRequest(req, res, body);
} else if (!sessionId && isInitializeRequest(body)) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sid) => transports.set(sid, transport),
  });
  transport.onclose = () => { if (transport.sessionId) transports.delete(transport.sessionId); };
  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
} else {
  res.writeHead(400); res.end('Bad Request');
}
```

## Tool Registration (registerTool — NOT tool())

`server.tool()` is **deprecated** in SDK 1.26+. Use `server.registerTool()`:

```typescript
server.registerTool('tool_name', {
  description: 'What this tool does',
  inputSchema: zodSchema,  // Pass full Zod schema, not .shape
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
}, async (args, extra) => {
  // extra.authInfo?: AuthInfo — validated JWT auth
  // extra.sessionId?: string — MCP session ID
  // extra.signal: AbortSignal — cancellation
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
```

## Auth Context Injection

Before `transport.handleRequest(req, res, body)`:
1. Call `injectAuthInfo(req)` from `src/auth/session.ts`
2. This validates JWT and sets `req.auth = AuthInfo`
3. SDK passes it to tool handlers as `extra.authInfo`

```typescript
// In authenticated tool handlers:
const userId = (extra.authInfo?.extra as Record<string, unknown>)?.userId as string;
if (!userId) return { content: [{ type: 'text', text: 'Authentication required' }], isError: true };
```

**AuthInfo shape:** `{ token, clientId, scopes, expiresAt?, extra?: { userId, email } }`

## Testing with curl

**ALWAYS** use `Accept: application/json` to avoid SSE responses:

```bash
# 1. Initialize session
curl -s -D- -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","clientInfo":{"name":"test","version":"1.0"},"capabilities":{}}}'

# Save Mcp-Session-Id from response headers

# 2. Call a tool (with session)
curl -s -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_products","arguments":{"query":"shirt","limit":5}}}'

# 3. Terminate session
curl -s -X DELETE http://localhost:8002/mcp \
  -H "Mcp-Session-Id: <session-id>"
```

## Directory Structure

```
src/
├── index.ts              — HTTP server + transport-per-session pattern
├── auth/
│   ├── oauth-provider.ts — OAuth 2.1 endpoints (authorize, token, revoke, well-known)
│   └── session.ts        — JWT validation → AuthInfo (used by injectAuthInfo)
├── tools/
│   ├── search-products.ts — search_products (PUBLIC)
│   └── ...               — Additional tools (see app_spec.txt section 9)
├── lib/
│   ├── supabase.ts       — Supabase admin client singleton
│   ├── stripe.ts         — Stripe client singleton
│   └── redis.ts          — ioredis client singleton
├── middleware/
│   ├── rate-limit.ts     — Redis sliding window rate limiter
│   └── audit.ts          — Structured JSON audit logging
├── resources/
│   └── catalog.ts        — MCP Resource: product catalog
└── prompts/
    └── shopping-assistant.ts — MCP Prompt template
```
