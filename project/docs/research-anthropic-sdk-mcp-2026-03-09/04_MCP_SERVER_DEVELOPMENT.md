# MCP Server Development -- Best Practices & Reference Guide

> Investigacion realizada el 2026-03-09 basada en documentacion oficial de Anthropic y MCP.
> Fuentes: modelcontextprotocol.io, github.com/modelcontextprotocol, platform.claude.com

---

## Indice

1. [SDKs Disponibles](#1-sdks-disponibles)
2. [Crear un MCP Server](#2-crear-un-mcp-server)
3. [Registrar Tools](#3-registrar-tools)
4. [Tool Annotations](#4-tool-annotations)
5. [Resources](#5-resources)
6. [Transport](#6-transport)
7. [Auth en Server (OAuth 2.1 + PKCE)](#7-auth-en-server-oauth-21--pkce)
8. [Security Best Practices](#8-security-best-practices)
9. [Patrones de Diseno](#9-patrones-de-diseno)
10. [Testing MCP Servers](#10-testing-mcp-servers)
11. [Deployment](#11-deployment)
12. [Ejemplos Reales de Referencia](#12-ejemplos-reales-de-referencia)
13. [Estado Actual de Nuestro MCP Server](#13-estado-actual-de-nuestro-mcp-server)

---

## 1. SDKs Disponibles

### TypeScript SDK

- **Paquete**: `@modelcontextprotocol/sdk` (v1.x produccion, v2 pre-alpha)
- **Repo**: https://github.com/modelcontextprotocol/typescript-sdk
- **Runtime**: Node.js, Bun, Deno
- **Licencia**: Apache 2.0 (nuevo) / MIT (existente)

**v2 (pre-alpha)** -- paquetes separados:

```bash
# Server SDK
npm install @modelcontextprotocol/server zod

# Client SDK
npm install @modelcontextprotocol/client zod

# Middleware (opcional)
npm install @modelcontextprotocol/node       # Node.js HTTP transport
npm install @modelcontextprotocol/express     # Express integration
npm install @modelcontextprotocol/hono        # Hono integration
```

> Nota: v2 requiere **Zod v4** como peer dependency. v1 usa Zod v3.

**v1 (produccion actual -- recomendada)**:

```bash
npm install @modelcontextprotocol/sdk zod
```

Nuestro server usa `@modelcontextprotocol/sdk@^1.27.1`.

### Python SDK

- **Paquete**: `mcp` (PyPI)
- **Repo**: https://github.com/modelcontextprotocol/python-sdk
- **Interfaz principal**: `FastMCP` class

```bash
uv add "mcp[cli]"
# o
pip install "mcp[cli]"
```

**Ejemplo minimo Python:**

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("MyServer", json_response=True)

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    return f"Hello, {name}!"

@mcp.prompt()
def greet_user(name: str, style: str = "friendly") -> str:
    return f"Write a {style} greeting for {name}."

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

### Comparativa SDK

| Aspecto | TypeScript SDK | Python SDK |
|---------|---------------|------------|
| Version estable | v1.27.x | PyPI `mcp` |
| API principal | `McpServer` class | `FastMCP` class |
| Tool registration | `server.registerTool()` | `@mcp.tool()` decorator |
| Schema validation | Zod schemas | Python type hints (auto) |
| Transport | Manual setup | `mcp.run(transport=...)` |
| Auth helpers | `AuthInfo` type + middleware | Built-in OAuth support |
| Structured output | Manual JSON responses | Pydantic models, TypedDicts, dataclasses |

---

## 2. Crear un MCP Server

### Estructura Minima (TypeScript)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// 1. Crear instancia del server
const server = new McpServer(
  { name: 'my-ecommerce-server', version: '1.0.0' },
  {
    capabilities: {
      tools: {},       // Exponer tools
      resources: {},   // Exponer resources
      prompts: {},     // Exponer prompts
      logging: {},     // Logging
      completions: {}, // Autocompletado
    },
  }
);

// 2. Registrar tools
server.registerTool(
  'search_products',
  {
    description: 'Search products in the catalog',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().min(1).max(50).default(10).describe('Max results'),
    }),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (args, extra) => {
    // args ya esta validado por Zod
    const results = await searchProducts(args.query, args.limit);
    return {
      content: [{ type: 'text', text: JSON.stringify(results) }],
    };
  }
);

// 3. Conectar transport
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});
await server.connect(transport);
```

### Estructura Minima (Python)

```python
from mcp.server.fastmcp import FastMCP, Context
from mcp.server.session import ServerSession

mcp = FastMCP("ecommerce-server", json_response=True)

@mcp.tool(
    annotations={
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": False,
    }
)
async def search_products(query: str, limit: int = 10) -> str:
    """Search products in the catalog.

    Args:
        query: Search query text
        limit: Maximum number of results (1-50)
    """
    results = await do_search(query, limit)
    return json.dumps(results)

@mcp.resource("catalog://products")
async def get_catalog() -> str:
    """Full product catalog"""
    return json.dumps(await fetch_all_products())

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

### Patron Transport-per-Session (TypeScript, HTTP)

Cada sesion MCP necesita su propio par `McpServer` + `StreamableHTTPServerTransport`:

```typescript
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

const transports = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'my-server', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } }
  );
  // ... register tools, resources, prompts ...
  return server;
}

const httpServer = http.createServer(async (req, res) => {
  if (req.url !== '/mcp') return;

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      // Sesion existente -- reusar transport
      await transports.get(sessionId)!.handleRequest(req, res, body);
    } else if (!sessionId && isInitializeRequest(body)) {
      // Nueva sesion
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => transports.set(sid, transport),
      });
      transport.onclose = () => {
        if (transport.sessionId) transports.delete(transport.sessionId);
      };
      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Bad Request' }));
    }
  }

  if (req.method === 'GET') {
    const sessionId = req.headers['mcp-session-id'] as string;
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res);
    }
  }

  if (req.method === 'DELETE') {
    const sessionId = req.headers['mcp-session-id'] as string;
    if (sessionId && transports.has(sessionId)) {
      await transports.get(sessionId)!.handleRequest(req, res);
    }
  }
});

httpServer.listen(8002);
```

---

## 3. Registrar Tools

### TypeScript: `server.registerTool()` (SDK v1.26+)

> NOTA: `server.tool()` esta **deprecated** en SDK 1.26+. Usar `registerTool()`.

```typescript
import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

server.registerTool(
  'get_product_details',
  {
    title: 'Get Product Details',
    description: 'Get detailed info about a product including variants, images, and pricing',
    inputSchema: z.object({
      productId: z.string().uuid().describe('Product UUID'),
      locale: z.enum(['en', 'es', 'de']).default('en').describe('Language for response'),
    }),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async (args, extra) => {
    // extra.authInfo?: AuthInfo -- JWT auth info inyectada
    // extra.sessionId?: string -- MCP session ID
    // extra.signal: AbortSignal -- cancellation

    const product = await getProduct(args.productId, args.locale);

    if (!product) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Product ${args.productId} not found` }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(product) }],
    };
  }
);
```

### Python: `@mcp.tool()` decorator

```python
from mcp.server.fastmcp import FastMCP, Context
from mcp.server.session import ServerSession

mcp = FastMCP("store")

@mcp.tool(
    annotations={
        "title": "Get Product Details",
        "readOnlyHint": True,
        "idempotentHint": True,
        "openWorldHint": False,
    }
)
async def get_product_details(
    product_id: str,
    locale: str = "en",
    ctx: Context[ServerSession, None] = None,
) -> str:
    """Get detailed info about a product.

    Args:
        product_id: Product UUID
        locale: Language (en, es, de)
    """
    await ctx.info(f"Fetching product {product_id}")
    product = await fetch_product(product_id, locale)
    return json.dumps(product)
```

### Patron Registry (centralizar definiciones)

Nuestro MCP server usa un patron de registry que es best practice:

```typescript
// tools/registry.ts
interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodObject<any>;
  annotations: ToolAnnotations;
  auth: 'none' | 'required';
  handler: (input: any, authInfo?: AuthInfo) => Promise<any>;
}

const toolDefinitions: ToolDefinition[] = [
  {
    name: 'search_products',
    title: 'Search Products',
    description: 'Search products in catalog by title, description, or category',
    inputSchema: searchProductsSchema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    auth: 'none',
    handler: (input) => searchProducts(input),
  },
  // ... mas tools ...
];

export function registerAllTools(server: McpServer): number {
  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        title: tool.title,
        annotations: tool.annotations,
      },
      withAuth(
        tool.auth,
        withAuditLog(tool.name, async (input, extra) => {
          const result = await tool.handler(input, extra?.authInfo);
          return createToolResponse(result);
        })
      )
    );
  }
  return toolDefinitions.length;
}
```

### Tool Name Best Practices

1. Usar **snake_case** para nombres: `search_products`, `get_order_status`
2. Ser **descriptivos y especificos**: `get_product_details` > `get_details`
3. Incluir **ejemplos en descriptions** para guiar al modelo
4. Usar **JSON Schema detallado** con `.describe()` en cada parametro Zod
5. Mantener tools **atomicos y enfocados** (una responsabilidad)
6. Documentar **formatos de retorno** esperados

### Tool Name Conflicts (Multi-Server)

Cuando multiples MCP servers tienen tools con nombres iguales:

```typescript
// Estrategia 1: Prefijo con nombre de server
'web1___search_web' y 'web2___search_web'

// Estrategia 2: Prefijo aleatorio
'jrwxs___search_web' y '6cq52___search_web'

// Estrategia 3: URI del server
'web1.example.com:search_web' y 'web2.example.com:search_web'
```

---

## 4. Tool Annotations

Las annotations son **hints** sobre el comportamiento del tool. NO se deben usar para decisiones de seguridad.

### Tabla de Annotations

| Annotation | Tipo | Default | Significado |
|-----------|------|---------|-------------|
| `title` | string | - | Nombre human-readable para UI |
| `readOnlyHint` | boolean | `false` | Si `true`, el tool NO modifica su entorno |
| `destructiveHint` | boolean | `true` | Si `true`, puede hacer updates destructivos (solo relevante si readOnlyHint=false) |
| `idempotentHint` | boolean | `false` | Si `true`, llamadas repetidas con mismos args no tienen efecto adicional |
| `openWorldHint` | boolean | `true` | Si `true`, interactua con entidades externas |

### Cuando Usar Cada Annotation

#### Read-only search tool

```typescript
{
  name: 'search_products',
  annotations: {
    readOnlyHint: true,      // No modifica nada
    openWorldHint: false,    // Solo consulta DB interna
    // destructiveHint y idempotentHint no aplican cuando readOnlyHint=true
  }
}
```

#### Destructive delete tool

```typescript
{
  name: 'delete_cart_item',
  annotations: {
    readOnlyHint: false,     // Modifica estado
    destructiveHint: true,   // Es destructivo (borra datos)
    idempotentHint: true,    // Borrar 2 veces el mismo item = misma resultado
    openWorldHint: false,    // Solo afecta DB interna
  }
}
```

#### Non-destructive create tool

```typescript
{
  name: 'add_to_cart',
  annotations: {
    readOnlyHint: false,     // Modifica estado
    destructiveHint: false,  // No destruye datos existentes
    idempotentHint: false,   // Agregar 2 veces = 2 items (no idempotente)
    openWorldHint: false,    // Solo DB interna
  }
}
```

#### External API tool

```typescript
{
  name: 'create_checkout',
  annotations: {
    readOnlyHint: true,      // Solo genera URL (no procesa pago)
    idempotentHint: false,   // Cada call crea nueva sesion Stripe
    openWorldHint: true,     // Interactua con Stripe API
  }
}
```

#### Track shipment (external read)

```typescript
{
  name: 'track_shipment',
  annotations: {
    readOnlyHint: true,      // Solo lee
    idempotentHint: true,    // Misma query = misma respuesta
    openWorldHint: true,     // Consulta carriers externos
  }
}
```

### Best Practices para Annotations

1. **Ser preciso sobre side effects** -- indicar claramente si el tool modifica su entorno
2. **Usar titulos descriptivos** -- `title` para display en UI del cliente
3. **idempotentHint solo si es real** -- marcar idempotent solo si llamadas repetidas NO tienen efecto adicional
4. **Distinguir open/closed world** -- DB interna = closed, API externa = open
5. **NUNCA confiar para seguridad** -- son HINTS, no garantias. No usar para decisiones de autorizacion

---

## 5. Resources

Los resources exponen datos de solo lectura que los clientes pueden surfacear al LLM como contexto.

### Diferencia con Tools

| Aspecto | Tools | Resources |
|---------|-------|-----------|
| Control | Model-controlled (LLM invoca) | Application-controlled (cliente decide) |
| Proposito | Ejecutar acciones | Exponer datos como contexto |
| Side effects | Pueden modificar estado | Solo lectura |
| Invocacion | `tools/call` | `resources/read` |

### Resource URI Schema

```
[protocol]://[host]/[path]
```

Ejemplos:
- `catalog://products` -- catalogo de productos
- `store://policies` -- politicas de la tienda
- `orders://user/{userId}` -- pedidos de un usuario
- `file:///logs/app.log` -- archivo de logs

### Resource Definition Structure

```typescript
{
  uri: string;           // URI unico del resource
  name: string;          // Nombre descriptivo
  title?: string;        // Nombre human-readable para display
  description?: string;  // Descripcion para guiar al LLM
  mimeType?: string;     // Tipo MIME (application/json, text/plain, etc.)
  size?: number;         // Tamano en bytes (opcional)
}
```

### Resource Templates (URIs dinamicos)

```typescript
{
  uriTemplate: string;   // URI template (RFC 6570)
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
}
```

### Implementacion TypeScript

```typescript
// Resource: catalog://products
server.resource(
  'products',
  'catalog://products',
  {
    description: 'Product catalog with all active products',
    mimeType: 'application/json',
  },
  async (uri: URL) => {
    const products = await fetchProducts();
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(products),
      }],
    };
  }
);

// Resource Template: catalog://products/{productId}
server.resource(
  'product-detail',
  'catalog://products/{productId}',
  {
    description: 'Detailed product information by ID',
    mimeType: 'application/json',
  },
  async (uri: URL, params: { productId: string }) => {
    const product = await fetchProduct(params.productId);
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(product),
      }],
    };
  }
);
```

### Implementacion Python

```python
@mcp.resource("catalog://products")
async def get_catalog() -> str:
    """Full product catalog with active products"""
    products = await fetch_all_products()
    return json.dumps(products)

@mcp.resource("catalog://products/{product_id}")
async def get_product(product_id: str) -> str:
    """Detailed product information"""
    product = await fetch_product(product_id)
    return json.dumps(product)
```

### Resource Subscriptions (Updates en Tiempo Real)

```typescript
// Server-side: notificar cuando cambia un resource
server.notification({
  method: 'notifications/resources/updated',
  params: { uri: 'catalog://products' },
});

// Client-side: suscribirse a updates
client.request({
  method: 'resources/subscribe',
  params: { uri: 'catalog://products' },
});
```

### Best Practices para Resources

1. **URIs claros y descriptivos** -- documentar el esquema custom
2. **Incluir descriptions** que guien al LLM sobre el contenido
3. **Setear MIME types** siempre que sea posible
4. **Resource templates para contenido dinamico** (parametrizado por ID, etc.)
5. **Subscriptions para datos que cambian frecuentemente** (inventario, precios)
6. **Paginar listas grandes** -- no devolver 10K productos de golpe
7. **Cache contenido cuando sea apropiado**
8. **Validar URIs antes de procesar** -- prevenir path traversal

---

## 6. Transport

MCP define tres mecanismos de transporte para comunicacion cliente-servidor.

### Comparativa de Transportes

| Transport | Uso | Protocolo | Sesiones | Streaming |
|-----------|-----|-----------|----------|-----------|
| **stdio** | CLI tools, local | stdin/stdout | No | No |
| **Streamable HTTP** | Web, remote, multi-client | HTTP POST + SSE | Si | Si |
| **SSE** (deprecated) | Legacy web | HTTP GET (SSE) + POST | Limitado | Solo server->client |

### stdio Transport

Ideal para tools locales y CLI. Simple comunicacion por stdin/stdout.

**Cuando usar:**
- Building CLI tools
- Integraciones locales
- Comunicacion simple entre procesos
- Scripts de shell

```typescript
// Server
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'my-server', version: '1.0.0' });
const transport = new StdioServerTransport();
await server.connect(transport);
```

```python
# Server
from mcp.server import Server
from mcp.server.stdio import stdio_server

app = Server("my-server")

async with stdio_server() as streams:
    await app.run(streams[0], streams[1], app.create_initialization_options())
```

**Config para Claude Desktop (stdio):**

```json
{
  "mcpServers": {
    "my-store": {
      "command": "node",
      "args": ["./dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://...",
        "SUPABASE_SERVICE_KEY": "..."
      }
    }
  }
}
```

### Streamable HTTP Transport (RECOMENDADO para produccion)

**Cuando usar:**
- Integraciones web
- Comunicacion cliente-servidor sobre HTTP
- Sesiones con estado
- Multiples clientes concurrentes
- Conexiones resumibles

**Flujo:**
1. **Client -> Server**: Cada mensaje JSON-RPC se envia como HTTP POST al endpoint MCP
2. **Server -> Client**: Responde con JSON (`application/json`) o SSE stream (`text/event-stream`)
3. **Server notifications**: Via SSE streams en respuesta a POST o GET requests

```typescript
// Server con Express
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const app = express();

app.post('/mcp', async (req, res) => {
  // Handle JSON-RPC request
  const transport = getOrCreateTransport(req);
  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', (req, res) => {
  // Optional: SSE stream para server-initiated notifications
  res.setHeader('Content-Type', 'text/event-stream');
  // ...
});

app.listen(8002);
```

**Session Management:**

```typescript
// Server asigna session ID durante initialize
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  onsessioninitialized: (sid) => {
    transports.set(sid, transport);
  },
});

// Cliente incluye session ID en requests subsecuentes
fetch('/mcp', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Mcp-Session-Id': sessionId,
  },
  body: JSON.stringify(request),
});

// Terminar sesion
fetch('/mcp', {
  method: 'DELETE',
  headers: { 'Mcp-Session-Id': sessionId },
});
```

**Resumability (SSE Event IDs):**

```typescript
class InMemoryEventStore implements EventStore {
  private events = new Map<string, { streamId: string; message: JSONRPCMessage }>();

  async storeEvent(streamId: string, message: JSONRPCMessage): Promise<string> {
    const eventId = `${streamId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    this.events.set(eventId, { streamId, message });
    return eventId;
  }

  async replayEventsAfter(
    lastEventId: string,
    { send }: { send: (eventId: string, message: JSONRPCMessage) => Promise<void> }
  ): Promise<string> {
    // Replay events after the given ID...
  }
}

// Usar con transport
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  eventStore: new InMemoryEventStore(),
});
```

### SSE Transport (DEPRECATED)

> Deprecated desde protocol version 2024-11-05. Reemplazado por Streamable HTTP.
> Mantener solo para backwards compatibility con clientes legacy.

```typescript
// Legacy SSE server
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

app.get('/sse', (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  server.connect(transport);
});

app.post('/messages', (req, res) => {
  transport.handlePostMessage(req, res);
});
```

### Backwards Compatibility

Detectar transport del servidor:

```typescript
async function detectTransport(serverUrl: string): Promise<'streamable-http' | 'legacy-sse'> {
  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: { /* ... */ },
      }),
    });

    if (response.ok) return 'streamable-http';
  } catch {
    const sseResponse = await fetch(serverUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
    });
    if (sseResponse.ok) return 'legacy-sse';
  }

  throw new Error('Unsupported transport');
}
```

### Security en Transport HTTP

1. **Validar Origin headers** -- prevenir DNS rebinding attacks
2. **Bind a localhost** -- en local, bind a `127.0.0.1` (NO `0.0.0.0`)
3. **Implementar autenticacion** en todas las conexiones
4. **HTTPS** siempre en produccion
5. **Validar Session IDs** -- UUIDs criptograficamente seguros
6. **Rate limiting** en el endpoint MCP

---

## 7. Auth en Server (OAuth 2.1 + PKCE)

### Arquitectura de Autorizacion MCP

```
MCP Client (OAuth 2.1 Client)
    |
    | Bearer token
    v
MCP Server (OAuth 2.1 Resource Server)
    |
    | Validates token
    v
Authorization Server (issues tokens)
```

- El **MCP Server** actua como **OAuth 2.1 Resource Server**
- El **MCP Client** actua como **OAuth 2.1 Client**
- El **Authorization Server** emite tokens (puede ser el mismo server o separado)

### Requisitos de Autorizacion

- Authorization es **OPCIONAL** para MCP
- HTTP transports **SHOULD** implementar esta spec
- stdio transports **SHOULD NOT** -- usar credenciales del entorno

### Estandares Base

- OAuth 2.1 (draft-ietf-oauth-v2-1-13)
- OAuth 2.0 Authorization Server Metadata (RFC 8414)
- OAuth 2.0 Dynamic Client Registration (RFC 7591)
- OAuth 2.0 Protected Resource Metadata (RFC 9728)
- OAuth Client ID Metadata Documents

### Protected Resource Metadata Discovery

El MCP server DEBE publicar su metadata de resource protegido:

```http
# Opcion 1: WWW-Authenticate header en 401
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource",
                         scope="products:read"

# Opcion 2: Well-known URI
GET /.well-known/oauth-protected-resource
```

### Flujo Completo de Authorization

```
1. Client -> MCP Server: Request sin token
2. MCP Server -> Client: 401 + WWW-Authenticate con resource_metadata
3. Client -> MCP Server: GET resource_metadata
4. Client: Extrae authorization_servers de metadata
5. Client -> Auth Server: GET /.well-known/oauth-authorization-server
6. Client: Registra client (CIMD, pre-registration, o dynamic)
7. Client: Genera PKCE parameters (code_verifier + code_challenge)
8. Client -> Auth Server: Authorization request + code_challenge + resource
9. User: Autoriza en browser
10. Auth Server -> Client: Authorization code
11. Client -> Auth Server: Token request + code_verifier + resource
12. Auth Server -> Client: Access token (+ refresh token)
13. Client -> MCP Server: Request + Bearer token
14. MCP Server: Valida token, procesa request
```

### PKCE Obligatorio

```typescript
// Generar PKCE parameters
import { createHash, randomBytes } from 'crypto';

const codeVerifier = randomBytes(32).toString('base64url');
const codeChallenge = createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Authorization request
const authUrl = new URL(authorizationEndpoint);
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');
authUrl.searchParams.set('resource', 'https://mcp.example.com');
```

### Token Usage

```http
# SIEMPRE en Authorization header (NUNCA en query string)
GET /mcp HTTP/1.1
Host: mcp.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

# El token DEBE incluirse en CADA request HTTP, incluso dentro de la misma sesion
```

### Token Validation (Server-side)

```typescript
// Ejemplo de validacion (nuestro server usa jose)
import * as jose from 'jose';

async function validateToken(token: string): Promise<AuthInfo> {
  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: 'https://auth.example.com',
    audience: 'https://mcp.example.com',  // DEBE coincidir con el resource
  });

  return {
    token,
    clientId: payload.client_id as string,
    scopes: (payload.scope as string || '').split(' '),
    expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
    extra: {
      userId: payload.sub,
      email: payload.email,
    },
  };
}
```

### Well-Known Endpoints

```typescript
// /.well-known/oauth-authorization-server
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({
    issuer: MCP_BASE_URL,
    authorization_endpoint: `${MCP_BASE_URL}/oauth/authorize`,
    token_endpoint: `${MCP_BASE_URL}/oauth/token`,
    revocation_endpoint: `${MCP_BASE_URL}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic'],
    scopes_supported: ['products:read', 'cart:write', 'orders:read', 'profile:read', 'profile:write'],
    client_id_metadata_document_supported: true,
  });
});

// /.well-known/oauth-protected-resource
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json({
    resource: MCP_BASE_URL,
    authorization_servers: [`${MCP_BASE_URL}`],
    scopes_supported: ['products:read', 'cart:write', 'orders:read', 'profile:read'],
    bearer_methods_supported: ['header'],
  });
});
```

### Error Handling en Auth

| Status | Descripcion | Uso |
|--------|-------------|-----|
| 401 | Unauthorized | Auth requerida o token invalido |
| 403 | Forbidden | Scopes insuficientes |
| 400 | Bad Request | Request de auth malformado |

**Step-Up Authorization (insufficient scope):**

```http
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
                         scope="cart:write orders:read",
                         resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource",
                         error_description="Cart write permission required"
```

---

## 8. Security Best Practices

### 8.1 Input Validation (Zod Schemas)

SIEMPRE validar inputs con schemas estrictos:

```typescript
import { z } from 'zod';

const searchProductsSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .max(200, 'Query too long')
    .describe('Search query text'),
  limit: z.number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Max results'),
  category: z.string()
    .uuid()
    .optional()
    .describe('Filter by category UUID'),
  // NUNCA aceptar SQL, paths del filesystem, o comandos sin sanitizar
});
```

**Reglas de validacion:**

- Validar TODOS los parametros contra el schema
- Sanitizar file paths y system commands
- Validar URLs e identificadores externos
- Verificar tamanos y rangos de parametros
- **Prevenir command injection**
- Limitar tamano del body (1MB max es razonable)

```typescript
// Body size limit
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB
req.on('data', (chunk: Buffer) => {
  totalBytes += chunk.length;
  if (totalBytes > MAX_BODY_SIZE) {
    req.destroy();
    reject(new Error('Request body too large'));
  }
});
```

### 8.2 Rate Limiting

Implementar rate limiting por IP, por usuario, y por tool:

```typescript
// Sliding window rate limiter con Redis
async function rateLimitMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  toolName?: string
): Promise<boolean> {
  const ip = req.socket.remoteAddress || 'unknown';
  const key = toolName
    ? `rl:tool:${toolName}:${ip}`
    : `rl:global:${ip}`;

  const redis = getRedisClient();
  if (!redis) return true; // Graceful fallback si Redis no esta

  const now = Date.now();
  const windowMs = 60_000; // 1 minuto
  const maxRequests = toolName === 'create_checkout' ? 5 : 60;

  // Sliding window con ZRANGEBYSCORE
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, now - windowMs);
  pipeline.zadd(key, now, `${now}:${Math.random()}`);
  pipeline.zcard(key);
  pipeline.expire(key, Math.ceil(windowMs / 1000));

  const results = await pipeline.exec();
  const count = results?.[2]?.[1] as number;

  if (count > maxRequests) {
    res.writeHead(429, {
      'Content-Type': 'application/json',
      'Retry-After': '60',
    });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Rate limit exceeded' },
      id: null,
    }));
    return false;
  }

  return true;
}
```

**Rate limits recomendados por tipo de tool:**

| Categoria | Requests/minuto | Ejemplo |
|-----------|----------------|---------|
| Read-only public | 60 | search_products, get_store_info |
| Read-only auth | 30 | get_cart, list_orders |
| Write operations | 10 | update_cart, add_to_wishlist |
| Checkout/payment | 5 | create_checkout |
| OAuth endpoints | 10 | /oauth/authorize, /oauth/token |

### 8.3 Prompt Injection Defense en Tool Responses

> CRITICO: Los tool responses se insertan en el contexto del LLM. Si contienen datos de usuario no sanitizados, pueden inyectar instrucciones maliciosas.

```typescript
// MALO -- user content sin sanitizar va directo al LLM
async function getProductReviews(productId: string) {
  const reviews = await db.getReviews(productId);
  return reviews; // Un review podria contener: "Ignore previous instructions..."
}

// BIEN -- marcar claramente los limites de datos de usuario
async function getProductReviews(productId: string) {
  const reviews = await db.getReviews(productId);
  return {
    _meta: { source: 'user_generated', count: reviews.length },
    reviews: reviews.map(r => ({
      ...r,
      // Marcar contenido de usuario como datos, no instrucciones
      text: `[USER REVIEW]: ${r.text}`,
    })),
  };
}
```

**Defensas contra prompt injection:**

1. **Marcar datos de usuario** con prefijos/delimitadores claros (`[USER DATA]`, `[REVIEW]`)
2. **No incluir instrucciones ejecutables** en datos de usuario
3. **Limitar longitud de texto** de usuario en responses
4. **Sanitizar HTML/markdown** de contenido de usuario
5. **No confiar en tool descriptions** para seguridad -- los modelos pueden ser manipulados

### 8.4 Principle of Least Privilege

```typescript
// MALO -- un solo scope omnibus
scopes_supported: ['full-access']

// BIEN -- scopes granulares
scopes_supported: [
  'products:read',      // Leer catalogo
  'cart:read',          // Leer carrito
  'cart:write',         // Modificar carrito
  'orders:read',        // Leer pedidos
  'profile:read',       // Leer perfil
  'profile:write',      // Modificar perfil
  'checkout:create',    // Crear sesion de checkout
]
```

**Scope minimization:**

- Pedir solo scopes minimos inicialmente (`products:read`)
- Usar step-up authorization para scopes adicionales
- El server DEBE aceptar tokens con scope reducido
- NUNCA usar wildcards (`*`, `all`, `full-access`)
- Loggear eventos de elevacion de scope

### 8.5 Session Security

```typescript
// Session IDs DEBEN ser:
// - No deterministicos (UUIDs con crypto.randomUUID())
// - No predecibles (NO sequenciales)
// - Vinculados a informacion del usuario

const sessionId = crypto.randomUUID(); // Correcto

// Vincular session a usuario
const sessionKey = `${userId}:${sessionId}`; // Previene hijacking
```

**Protecciones contra session hijacking:**

- NUNCA usar sessions para autenticacion (siempre verificar token)
- Session IDs criptograficamente seguros
- Rotar/expirar sessions
- Vincular session a userId del token
- No confiar en el session ID como prueba de identidad

### 8.6 Token Security

```typescript
// Token Passthrough esta PROHIBIDO
// El MCP server NUNCA debe pasar tokens de clientes a APIs downstream

// MALO -- pasar token del cliente a Stripe
const stripe = new Stripe(req.auth.token); // NUNCA hacer esto

// BIEN -- usar credenciales propias del server
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
```

**Reglas de tokens:**

- SOLO aceptar tokens emitidos para este MCP server (validar audience)
- NUNCA pass-through tokens a APIs downstream
- Tokens corta duracion (reducir impacto de leak)
- Rotar refresh tokens para clientes publicos
- Almacenamiento seguro de tokens

### 8.7 SSRF Prevention

Cuando el MCP server hace fetch de URLs externas (ej: OAuth metadata):

```typescript
// MALO -- seguir cualquier URL sin validar
const metadata = await fetch(untrustedUrl);

// BIEN -- validar URL antes de fetch
function validateUrl(url: string): boolean {
  const parsed = new URL(url);
  // Requirir HTTPS
  if (parsed.protocol !== 'https:') return false;
  // Bloquear IPs privadas
  const ip = parsed.hostname;
  if (isPrivateIP(ip)) return false;
  // Bloquear metadata endpoints cloud
  if (ip.startsWith('169.254.')) return false;
  return true;
}
```

### 8.8 Audit Logging

```typescript
// Patron de audit log para tools
function withAuditLog(
  toolName: string,
  handler: ToolHandler
): ToolHandler {
  return async (args, extra) => {
    const startTime = Date.now();
    const userId = extra?.authInfo?.extra?.userId;

    try {
      const result = await handler(args, extra);

      logger.info('tool_call', {
        tool: toolName,
        userId,
        sessionId: extra?.sessionId,
        duration: Date.now() - startTime,
        success: true,
        // NO loguear args completos (pueden tener datos sensibles)
        argKeys: Object.keys(args || {}),
      });

      return result;
    } catch (error) {
      logger.error('tool_call_error', {
        tool: toolName,
        userId,
        sessionId: extra?.sessionId,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
```

---

## 9. Patrones de Diseno

### 9.1 Tool Grouping por Dominio

Agrupar tools por dominio funcional:

```
tools/
  # Publicos (sin auth)
  search-products.ts      # search_products
  get-product-details.ts  # get_product_details
  list-categories.ts      # list_categories
  get-store-info.ts       # get_store_info
  get-store-policies.ts   # get_store_policies
  get-product-reviews.ts  # get_product_reviews

  # Carrito (auth required)
  get-cart.ts             # get_cart
  update-cart.ts          # update_cart
  create-checkout.ts      # create_checkout

  # Perfil (auth required)
  get-my-profile.ts       # get_my_profile
  update-my-profile.ts    # update_my_profile

  # Pedidos (auth required)
  list-my-orders.ts       # list_my_orders
  get-order-status.ts     # get_order_status
  track-shipment.ts       # track_shipment

  # Wishlist (auth required)
  list-wishlist.ts        # list_wishlist
  add-to-wishlist.ts      # add_to_wishlist
  remove-from-wishlist.ts # remove_from_wishlist

  # Registry central
  registry.ts             # registerAllTools()
```

### 9.2 Error Handling Patterns

Los errores de tool se reportan DENTRO del resultado, NO como errores de protocolo MCP:

```typescript
// CORRECTO -- error en el content del resultado
try {
  const result = await performOperation();
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
} catch (error) {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: `Error: ${error.message}`,
    }],
  };
}

// INCORRECTO -- lanzar excepcion (se convierte en error de protocolo)
throw new Error('Product not found'); // No hacer esto
```

**Patron de response helper:**

```typescript
// lib/response.ts
export function createToolResponse(data: any): ToolResult {
  return {
    content: [{
      type: 'text',
      text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
    }],
  };
}

export function createErrorResponse(message: string): ToolResult {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: message,
    }],
  };
}
```

### 9.3 Auth Middleware Pattern

```typescript
// middleware/auth.ts
type AuthLevel = 'none' | 'required';

function withAuth(level: AuthLevel, handler: ToolHandler): ToolHandler {
  if (level === 'none') return handler;

  return async (args, extra) => {
    const userId = extra?.authInfo?.extra?.userId as string | undefined;

    if (!userId) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: 'Authentication required. Please sign in first.',
        }],
      };
    }

    return handler(args, extra);
  };
}
```

### 9.4 Structured vs Unstructured Responses

```typescript
// Structured (JSON) -- preferido para datos
return {
  content: [{
    type: 'text',
    text: JSON.stringify({
      products: [...],
      total: 42,
      page: 1,
      hasMore: true,
    }),
  }],
};

// Unstructured (texto libre) -- para respuestas narrativas
return {
  content: [{
    type: 'text',
    text: `Found 42 products matching "shirt". Showing page 1.
Top results:
1. Classic Cotton Tee - $29.99
2. Premium Hoodie - $59.99
...`,
  }],
};

// Imagenes (embedded)
return {
  content: [
    { type: 'text', text: 'Product image:' },
    { type: 'image', data: base64Image, mimeType: 'image/jpeg' },
  ],
};
```

**Python: Structured Output con Pydantic:**

```python
from pydantic import BaseModel

class ProductResult(BaseModel):
    id: str
    title: str
    price: float
    currency: str

@mcp.tool()
async def search_products(query: str) -> list[ProductResult]:
    """Search products"""
    results = await db.search(query)
    return [ProductResult(**r) for r in results]
```

### 9.5 Context Object para Progreso

```python
@mcp.tool()
async def sync_catalog(ctx: Context[ServerSession, None]) -> str:
    """Sync product catalog from Printful"""
    products = await fetch_printful_products()

    for i, product in enumerate(products):
        await ctx.report_progress(progress=i, total=len(products))
        await ctx.info(f"Processing {product['title']}")
        await process_product(product)

    return f"Synced {len(products)} products"
```

### 9.6 Lifespan Management (Python)

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    """Manage app lifecycle -- DB connections, cache, etc."""
    db = await Database.connect(os.environ['DATABASE_URL'])
    redis = await Redis.connect(os.environ['REDIS_URL'])

    try:
        yield AppContext(db=db, redis=redis)
    finally:
        await redis.close()
        await db.disconnect()

mcp = FastMCP("store", lifespan=app_lifespan)
```

### 9.7 Completions (Autocompletado)

```typescript
// Manejar completion/complete para sugerir valores
if (body.method === 'completion/complete') {
  const params = body.params;

  if (params.ref.type === 'ref/resource' && params.ref.uri === 'catalog://products/{productId}') {
    // Sugerir product IDs que matchean el input parcial
    const products = await searchProducts(params.argument.value);
    return {
      completion: {
        values: products.map(p => p.id),
        total: products.length,
        hasMore: false,
      },
    };
  }
}
```

---

## 10. Testing MCP Servers

### MCP Inspector

La herramienta oficial para testing interactivo:

```bash
# Instalar y ejecutar
npx @modelcontextprotocol/inspector

# Inspeccionar server local (TypeScript)
npx @modelcontextprotocol/inspector node path/to/server/index.js

# Inspeccionar server local (Python)
npx @modelcontextprotocol/inspector uv --directory path/to/server run package-name

# Inspeccionar server remoto (HTTP)
# En el Inspector UI, conectar a http://localhost:8002/mcp

# Inspeccionar paquete npm
npx -y @modelcontextprotocol/inspector npx @modelcontextprotocol/server-filesystem /tmp
```

**Funcionalidades del Inspector:**

- **Resources tab**: Listar, leer, inspeccionar contenido, testar subscripciones
- **Prompts tab**: Ver templates, testar con argumentos custom, previsualizar mensajes
- **Tools tab**: Listar tools con schemas, testar con inputs custom, ver resultados
- **Notifications pane**: Ver logs y notificaciones del server
- **Server connection**: Seleccionar transport, customizar args y env

### Testing con curl

```bash
# 1. Inicializar sesion
SESSION_ID=$(curl -s -D- -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
    "protocolVersion":"2024-11-05",
    "clientInfo":{"name":"test","version":"1.0"},
    "capabilities":{}
  }}' 2>&1 | grep -i 'mcp-session-id' | awk '{print $2}' | tr -d '\r')

echo "Session: $SESSION_ID"

# 2. Listar tools
curl -s -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# 3. Llamar un tool
curl -s -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
    "name":"search_products",
    "arguments":{"query":"shirt","limit":5}
  }}'

# 4. Listar resources
curl -s -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","id":4,"method":"resources/list","params":{}}'

# 5. Terminar sesion
curl -s -X DELETE http://localhost:8002/mcp \
  -H "Mcp-Session-Id: $SESSION_ID"
```

### Unit Tests (Vitest)

```typescript
// __tests__/tools.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('search_products tool', () => {
  let server: McpServer;

  beforeAll(() => {
    server = createMcpServer();
  });

  it('should return products matching query', async () => {
    const result = await callTool(server, 'search_products', {
      query: 'shirt',
      limit: 5,
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content[0].text);
    expect(data.products).toBeInstanceOf(Array);
    expect(data.products.length).toBeLessThanOrEqual(5);
  });

  it('should validate input schema', async () => {
    const result = await callTool(server, 'search_products', {
      query: '', // Invalid: empty string
      limit: 100, // Invalid: > 50
    });

    expect(result.isError).toBeTruthy();
  });

  it('should handle auth-required tools without auth', async () => {
    const result = await callTool(server, 'get_cart', {});

    expect(result.isError).toBeTruthy();
    expect(result.content[0].text).toContain('Authentication required');
  });
});
```

### Estrategia de Testing Completa

1. **Functional testing**: Verificar ejecucion correcta con inputs validos e invalidos
2. **Integration testing**: Testar interaccion con sistemas externos (mocked y reales)
3. **Security testing**: Validar autenticacion, autorizacion, input sanitization, rate limiting
4. **Performance testing**: Comportamiento bajo carga, timeout handling, resource cleanup
5. **Error handling**: Verificar que errores se reportan correctamente via protocolo MCP

### Workflow de Desarrollo

1. **Iniciar**: Lanzar Inspector con el server, verificar conectividad basica
2. **Testing iterativo**: Hacer cambios, rebuild, reconectar Inspector, testar features
3. **Edge cases**: Inputs invalidos, argumentos faltantes, operaciones concurrentes
4. **Verificar errores**: Revisar que errores se muestran correctamente

---

## 11. Deployment

### Docker

```dockerfile
# Dockerfile para MCP server TypeScript
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
RUN addgroup -g 1001 -S mcpuser && \
    adduser -S mcpuser -u 1001
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
USER mcpuser
EXPOSE 8002
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8002/health || exit 1
CMD ["node", "dist/index.js"]
```

### Docker Compose (como parte del stack)

```yaml
# docker-compose.yml
services:
  mcp-server:
    build: ./mcp-server
    ports:
      - "127.0.0.1:8002:8002"
    environment:
      - PORT=8002
      - MCP_BASE_URL=https://mcp.example.com
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - proxy
      - data
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          memory: 256M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8002/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### Caddy Reverse Proxy

```caddyfile
mcp.example.com {
    reverse_proxy mcp-server:8002

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }

    # Rate limiting at proxy level
    rate_limit {
        zone mcp_api {
            match {
                path /mcp*
            }
            key {remote_host}
            events 120
            window 1m
        }
    }
}
```

### Health Checks

```typescript
// /health -- liveness (el server esta corriendo)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    tools_count: 17,
    active_sessions: transports.size,
    timestamp: new Date().toISOString(),
  });
});

// /ready -- readiness (dependencias disponibles)
app.get('/ready', async (req, res) => {
  const checks = {
    supabase: await checkSupabase(),
    redis: await checkRedis(),
    stripe: await checkStripe(),
  };

  const ready = Object.values(checks).every(c => c.status === 'ready');
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    checks,
  });
});
```

### Graceful Shutdown

```typescript
const shutdown = async () => {
  console.info('[MCP Server] Shutting down...');

  // 1. Cerrar todas las sesiones activas
  for (const [, transport] of transports) {
    try { await transport.close(); } catch {}
  }
  transports.clear();

  // 2. Cerrar HTTP server
  server.close();

  // 3. Cerrar conexiones a dependencies
  await closeRedis();

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Claude Desktop Config (para MCP server remoto)

```bash
# Agregar server remoto via CLI
claude mcp add --transport http my-store-mcp https://mcp.example.com/mcp
```

---

## 12. Ejemplos Reales de Referencia

### Servers Oficiales (Reference Implementations)

| Server | Descripcion | Skills |
|--------|-------------|--------|
| [Everything](https://github.com/modelcontextprotocol/servers/tree/main/src/everything) | Test/referencia completa | Tools, Resources, Prompts |
| [Filesystem](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) | Operaciones de archivos seguras | Access controls, path sanitization |
| [Fetch](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch) | Web content fetching | Content conversion, LLM optimization |
| [Git](https://github.com/modelcontextprotocol/servers/tree/main/src/git) | Operaciones Git | Search, manipulate repos |
| [Memory](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) | Knowledge graph | Persistent memory |
| [Sequential Thinking](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking) | Problem-solving | Dynamic reasoning |
| [Time](https://github.com/modelcontextprotocol/servers/tree/main/src/time) | Time/timezone | Conversion utilities |

### Uso rapido de servers de referencia

```bash
# Desde npm
npx -y @modelcontextprotocol/server-memory
npx -y @modelcontextprotocol/server-filesystem /path/to/files

# Desde PyPI
uvx mcp-server-git --repository ~/code/project.git
```

### Config para Claude Desktop (multiples servers)

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<TOKEN>" }
    },
    "my-store": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_KEY": "...",
        "STRIPE_SECRET_KEY": "..."
      }
    }
  }
}
```

---

## 13. Estado Actual de Nuestro MCP Server

### Ubicacion

`/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/`

### Stack

- **SDK**: `@modelcontextprotocol/sdk@^1.27.1` (TypeScript, produccion)
- **Transport**: Streamable HTTP (port 8002)
- **Auth**: OAuth 2.1 + JWT (jose library)
- **DB**: Supabase (admin client)
- **Cache**: Redis (ioredis) -- optional, graceful fallback
- **Payments**: Stripe
- **Validation**: Zod v3
- **Testing**: Vitest + supertest

### Que Tenemos (ya implementado)

| Componente | Estado | Archivos |
|-----------|--------|----------|
| 17 tools con registry pattern | OK | `src/tools/registry.ts`, `src/tools/*.ts` |
| Tool annotations (readOnlyHint, etc.) | OK | En cada tool definition |
| Auth middleware (none/required) | OK | `src/middleware/auth.ts` |
| Audit logging | OK | `src/lib/audit-log.ts` |
| Rate limiting (Redis sliding window) | OK | `src/middleware/rate-limit.ts` |
| OAuth 2.1 endpoints | OK | `src/auth/oauth-provider.ts` |
| JWT validation | OK | `src/auth/session.ts` |
| Session management | OK | `src/session.ts`, `src/index.ts` |
| Resources (catalog, policies) | OK | `src/resources/*.ts` |
| Prompts (shopping assistant) | OK | `src/prompts/shopping-assistant.ts` |
| Completions | OK | `src/lib/completions.ts` |
| Health/Ready checks | OK | `src/index.ts` (/health, /ready) |
| CORS configuration | OK | `src/index.ts` |
| Body size limit (1MB) | OK | `src/index.ts` |
| SSE Event Store (resumability) | OK | `src/index.ts` (InMemoryEventStore) |
| Graceful shutdown | OK | `src/index.ts` |
| Security headers | OK | X-Content-Type-Options, X-Frame-Options, Cache-Control |
| Structured responses | OK | `src/lib/response.ts` |
| Tests | Parcial | `src/__tests__/*.test.ts` |
| Dockerfile | OK | `Dockerfile` |
| Docker Compose integration | OK | En stack principal |

### Mejoras Potenciales Identificadas

1. **Migrar a SDK v2** cuando salga stable (Q1 2026) -- paquetes separados server/client
2. **Resource templates** -- catalog://products/{productId} con parametros
3. **Resource subscriptions** -- notificaciones en tiempo real de cambios
4. **Scope-based auth** -- scopes granulares por tool (products:read, cart:write)
5. **Step-up authorization** -- 403 con insufficient_scope para tools premium
6. **DPoP tokens** -- propuesta activa en el spec
7. **Client ID Metadata Documents** -- soportar CIMD para registro automatico
8. **Prompt injection hardening** -- delimitar mas claramente datos de usuario en responses
9. **Event store persistente** -- Redis en vez de in-memory para SSE resumability
10. **Metrics/observability** -- Prometheus metrics, OpenTelemetry tracing

---

## Fuentes

- [MCP Quickstart / Build an MCP Server](https://modelcontextprotocol.io/quickstart)
- [MCP Tools Documentation](https://modelcontextprotocol.io/legacy/concepts/tools)
- [MCP Resources Documentation](https://modelcontextprotocol.io/legacy/concepts/resources)
- [MCP Transports Documentation](https://modelcontextprotocol.io/legacy/concepts/transports)
- [MCP Authorization Specification (Draft)](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
- [MCP Example Servers](https://modelcontextprotocol.io/examples)
- [TypeScript SDK (GitHub)](https://github.com/modelcontextprotocol/typescript-sdk)
- [Python SDK (GitHub)](https://github.com/modelcontextprotocol/python-sdk)
- [Python SDK Documentation](https://py.sdk.modelcontextprotocol.io/)
- [MCP Specification Changelog](https://spec.modelcontextprotocol.io/specification/2025-03-26/changelog/)
- [MCP Blog - OAuth Client Registration](https://blog.modelcontextprotocol.io/posts/client_registration/)
- [MCP Blog - Core Maintainer Update Jan 2026](https://blog.modelcontextprotocol.io/posts/2026-01-22-core-maintainer-update/)
- [MCP Blog - One Year Anniversary](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
