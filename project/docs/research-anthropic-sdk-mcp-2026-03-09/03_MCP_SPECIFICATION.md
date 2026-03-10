# MCP Specification -- Research Completo

> **Fuente**: [modelcontextprotocol.io](https://modelcontextprotocol.io/specification) + [spec.modelcontextprotocol.io](https://spec.modelcontextprotocol.io/)
> **Fecha de investigacion**: 2026-03-09
> **Version del spec investigada**: 2025-06-18 (Current) / 2025-11-25 (publicada pero backwards-compatible)

---

## Tabla de Contenidos

1. [Version del Spec](#1-version-del-spec)
2. [Arquitectura General](#2-arquitectura-general)
3. [Transport Layers](#3-transport-layers)
4. [Session Lifecycle](#4-session-lifecycle)
5. [Tools](#5-tools)
6. [Resources](#6-resources)
7. [Prompts](#7-prompts)
8. [Sampling](#8-sampling)
9. [Roots](#9-roots)
10. [Elicitation](#10-elicitation)
11. [Authorization (OAuth 2.1)](#11-authorization-oauth-21)
12. [Utilities](#12-utilities)
13. [Error Handling](#13-error-handling)
14. [Security Model](#14-security-model)
15. [Resumability](#15-resumability)

---

## 1. Version del Spec

El MCP usa versionado basado en fechas con formato `YYYY-MM-DD`, indicando la ultima fecha donde hubo cambios **backwards-incompatible**.

### Revisiones Publicadas

| Version | Estado | Notas |
|---|---|---|
| `2024-11-05` | Final | Primera version estable. Transport HTTP+SSE (legacy) |
| `2025-03-26` | Final | Mejoras menores |
| `2025-06-18` | **Current** | Streamable HTTP, Elicitation, OAuth 2.1, Structured Output, Tool Annotations |
| `2025-11-25` | Current (compatible) | Backwards-compatible con 2025-06-18, no incrementa version |

**Regla clave**: La version del protocolo NO se incrementa si los cambios son backwards-compatible. Solo cambia cuando hay breaking changes.

### Negociacion de Version

La negociacion ocurre durante la inicializacion:
- El cliente envia la version que soporta (SHOULD ser la mas reciente)
- Si el server la soporta, responde con la misma version
- Si no, responde con otra version que soporte (SHOULD la mas reciente)
- Si el cliente no soporta la version del server, SHOULD desconectarse

---

## 2. Arquitectura General

MCP sigue una arquitectura **cliente-servidor** sobre JSON-RPC 2.0:

```
Host Application (ej: Claude Desktop, IDE)
  |
  +-- MCP Client (protocolo)
        |
        +-- MCP Server 1 (tools, resources, prompts)
        +-- MCP Server 2 (tools, resources, prompts)
        +-- MCP Server N ...
```

### Roles

| Rol | Descripcion |
|---|---|
| **Host** | Aplicacion que contiene el LLM (Claude Desktop, IDE, chatbot) |
| **Client** | Componente dentro del host que mantiene conexion 1:1 con un server |
| **Server** | Proceso que expone tools, resources, prompts al client |

### Primitivas del Protocolo

| Primitiva | Control | Descripcion |
|---|---|---|
| **Tools** | Model-controlled | El LLM decide cuando invocar |
| **Resources** | Application-controlled | La app decide que contexto incluir |
| **Prompts** | User-controlled | El usuario selecciona explicitamente |
| **Sampling** | Server-initiated | El server pide al client que haga LLM calls |
| **Elicitation** | Server-initiated | El server pide info al usuario via client |
| **Roots** | Client-provided | El client informa al server de sus filesystem roots |

---

## 3. Transport Layers

MCP define dos transportes estandar. Los mensajes JSON-RPC MUST ser UTF-8.

### 3.1 stdio Transport

El client lanza el server como **subproceso**. Comunicacion via stdin/stdout.

```
Client (parent process)
  |-- stdin  --> Server (child process)
  |-- stdout <-- Server
  |-- stderr <-- Server (logging, opcional)
```

**Reglas**:
- Mensajes delimitados por newlines
- Los mensajes MUST NOT contener newlines embebidos
- El server MUST NOT escribir nada a stdout que no sea un mensaje MCP valido
- El server MAY escribir logs a stderr
- Shutdown: el client cierra stdin, espera exit, luego SIGTERM, luego SIGKILL

**Cuando usar**: Servidores locales, herramientas CLI, procesos que se lanzan bajo demanda.

```python
# Ejemplo: lanzar un MCP server via stdio
import subprocess
import json

proc = subprocess.Popen(
    ["node", "my-mcp-server.js"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Enviar mensaje
request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {"name": "MyClient", "version": "1.0"}
    }
}
proc.stdin.write((json.dumps(request) + "\n").encode())
proc.stdin.flush()

# Leer respuesta
line = proc.stdout.readline()
response = json.loads(line)
```

### 3.2 Streamable HTTP Transport

Reemplaza el antiguo HTTP+SSE transport de 2024-11-05. El server opera como proceso independiente que acepta multiples clientes.

**Un unico endpoint** (ej: `https://example.com/mcp`) que soporta POST y GET.

#### Envio de mensajes (Client -> Server): HTTP POST

```
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
Mcp-Session-Id: abc123
MCP-Protocol-Version: 2025-06-18
Authorization: Bearer <token>

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Respuestas posibles**:
1. **JSON directo**: `Content-Type: application/json` con un JSON-RPC response
2. **SSE stream**: `Content-Type: text/event-stream` -- puede enviar notifications/requests antes del response final
3. **202 Accepted**: para notifications/responses del client (sin body)
4. **4xx errors**: para inputs invalidos

#### Escucha de mensajes del server: HTTP GET

```
GET /mcp HTTP/1.1
Accept: text/event-stream
Mcp-Session-Id: abc123
MCP-Protocol-Version: 2025-06-18
```

- El server abre un SSE stream para enviar requests/notifications al client
- El server MAY responder 405 si no soporta SSE en GET
- El client MAY mantener multiples SSE streams simultaneos
- El server MUST enviar cada mensaje en UN solo stream (no broadcast)

#### Session Management

```
Mcp-Session-Id: <cryptographically-secure-id>
```

1. El server MAY asignar un session ID en el response al `InitializeResult`
2. El client MUST incluir `Mcp-Session-Id` en todas las requests subsiguientes
3. Sin session ID -> server responde 400 Bad Request
4. Server termina session -> responde 404 Not Found
5. Client recibe 404 -> debe re-inicializar sin session ID
6. Client termina session -> HTTP DELETE al endpoint con el session ID

#### Protocol Version Header

```
MCP-Protocol-Version: 2025-06-18
```

El client MUST incluir este header en TODAS las requests HTTP posteriores a la inicializacion. Si el server no lo recibe, SHOULD asumir version `2025-03-26`.

#### Security Warning para Streamable HTTP

- Servers MUST validar el header `Origin` para prevenir DNS rebinding
- Servers SHOULD bindear solo a localhost (127.0.0.1) cuando corren localmente
- Servers SHOULD implementar autenticacion

**Cuando usar**: Servidores remotos, APIs en la nube, multiples clientes concurrentes, necesidad de streaming.

#### Backwards Compatibility con HTTP+SSE legacy

**Servers** que quieren soportar clients antiguos:
- Mantener endpoints SSE + POST del transporte viejo junto al nuevo endpoint MCP

**Clients** que quieren soportar servers antiguos:
1. POST InitializeRequest al URL del server
2. Si funciona -> es Streamable HTTP
3. Si falla con 4xx -> probar GET esperando SSE stream con evento `endpoint`
4. Si llega `endpoint` -> es HTTP+SSE legacy

### 3.3 Custom Transports

Permitidos. MUST preservar formato JSON-RPC y lifecycle de MCP. SHOULD documentar patrones de conexion.

---

## 4. Session Lifecycle

### 4.1 Fases

```
1. Initialization  -->  2. Operation  -->  3. Shutdown
```

### 4.2 Initialization

**Client envia `initialize` request:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": {}
    },
    "clientInfo": {
      "name": "ExampleClient",
      "title": "Example Client Display Name",
      "version": "1.0.0"
    }
  }
}
```

**Server responde con `InitializeResult`:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": {
      "logging": {},
      "prompts": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "tools": { "listChanged": true },
      "completions": {}
    },
    "serverInfo": {
      "name": "ExampleServer",
      "title": "Example Server Display Name",
      "version": "1.0.0"
    },
    "instructions": "Optional instructions for the client"
  }
}
```

**Client envia `initialized` notification:**

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

### 4.3 Capability Negotiation

| Categoria | Capability | Descripcion |
|---|---|---|
| **Client** | `roots` | Provee filesystem roots |
| **Client** | `sampling` | Soporta LLM sampling requests |
| **Client** | `elicitation` | Soporta elicitation requests |
| **Client** | `experimental` | Features no-estandar |
| **Server** | `prompts` | Ofrece prompt templates |
| **Server** | `resources` | Provee recursos legibles |
| **Server** | `tools` | Expone tools invocables |
| **Server** | `logging` | Emite log messages |
| **Server** | `completions` | Soporta autocompletado |
| **Server** | `experimental` | Features no-estandar |

Sub-capabilities:
- `listChanged`: soporta notificaciones de cambio en listas (prompts, resources, tools)
- `subscribe`: soporta subscripciones a cambios individuales (solo resources)

### 4.4 Operation

Ambas partes MUST:
- Respetar la version negociada
- Solo usar capabilities que se negociaron exitosamente

### 4.5 Shutdown

**stdio**: Client cierra stdin -> espera exit -> SIGTERM -> SIGKILL
**HTTP**: Cerrar conexiones HTTP. Client SHOULD enviar DELETE con session ID.

### 4.6 Timeouts

- Implementations SHOULD establecer timeouts para todas las requests
- Al expirar, el sender SHOULD emitir un `CancelledNotification` y dejar de esperar
- SDKs SHOULD permitir timeouts configurables por request
- Progress notifications MAY resetear el timeout clock
- Pero SHOULD existir un timeout maximo absoluto

---

## 5. Tools

**Protocol Revision**: 2025-06-18

Tools son **model-controlled**: el LLM descubre e invoca tools automaticamente.

### 5.1 Capability Declaration

```json
{
  "capabilities": {
    "tools": {
      "listChanged": true
    }
  }
}
```

### 5.2 Tool Definition Schema

```json
{
  "name": "get_weather",
  "title": "Weather Information Provider",
  "description": "Get current weather for a location",
  "inputSchema": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City name or zip code"
      }
    },
    "required": ["location"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "temperature": { "type": "number" },
      "conditions": { "type": "string" },
      "humidity": { "type": "number" }
    },
    "required": ["temperature", "conditions", "humidity"]
  },
  "annotations": {
    "title": "Weather Lookup",
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": true
  }
}
```

#### Campos del Tool

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `name` | string | Si | Identificador unico |
| `title` | string | No | Nombre human-readable para display |
| `description` | string | Si | Descripcion de funcionalidad |
| `inputSchema` | JSON Schema | Si | Schema de parametros de entrada |
| `outputSchema` | JSON Schema | No | Schema de output estructurado |
| `annotations` | ToolAnnotations | No | Hints de comportamiento |

### 5.3 Tool Annotations

Las annotations son **hints** -- NO garantias. Clients MUST considerarlas untrusted a menos que vengan de servers confiables.

| Annotation | Tipo | Default | Descripcion |
|---|---|---|---|
| `readOnlyHint` | boolean | `false` | Si true, el tool NO modifica su entorno |
| `destructiveHint` | boolean | `true` | Si true, el tool PUEDE realizar updates destructivos |
| `idempotentHint` | boolean | `false` | Si true, llamadas repetidas con mismos args no tienen efecto adicional |
| `openWorldHint` | boolean | `true` | Si true, el tool interactua con entidades externas |

**Nota**: `destructiveHint` e `idempotentHint` solo son significativos cuando `readOnlyHint` es `false`. Un tool read-only por definicion ni destruye datos ni necesita ser idempotente.

**Ejemplos de uso**:

```json
// Tool de busqueda web (read-only, interactua con internet)
{
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": true
  }
}

// Tool de borrar archivo (destructivo, local)
{
  "annotations": {
    "readOnlyHint": false,
    "destructiveHint": true,
    "idempotentHint": true,
    "openWorldHint": false
  }
}

// Tool de crear registro en DB (no idempotente, no destructivo)
{
  "annotations": {
    "readOnlyHint": false,
    "destructiveHint": false,
    "idempotentHint": false,
    "openWorldHint": false
  }
}
```

### 5.4 Protocol Messages

#### Listing Tools

```json
// Request
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": { "cursor": "optional" } }

// Response
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "tools": [ /* tool definitions */ ],
    "nextCursor": "next-page-cursor"
  }
}
```

#### Calling Tools

```json
// Request
{
  "jsonrpc": "2.0", "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": { "location": "New York" }
  }
}

// Response (unstructured)
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "content": [
      { "type": "text", "text": "Temperature: 72F, Partly cloudy" }
    ],
    "isError": false
  }
}

// Response (structured + unstructured for backwards compat)
{
  "jsonrpc": "2.0", "id": 5,
  "result": {
    "content": [
      { "type": "text", "text": "{\"temperature\": 22.5, \"conditions\": \"Partly cloudy\", \"humidity\": 65}" }
    ],
    "structuredContent": {
      "temperature": 22.5,
      "conditions": "Partly cloudy",
      "humidity": 65
    }
  }
}
```

#### List Changed Notification

```json
{ "jsonrpc": "2.0", "method": "notifications/tools/list_changed" }
```

### 5.5 Tool Result Content Types

| Tipo | Campo | Descripcion |
|---|---|---|
| `text` | `text` | Texto plano |
| `image` | `data` + `mimeType` | Imagen base64 |
| `audio` | `data` + `mimeType` | Audio base64 |
| `resource_link` | `uri` + `name` + `mimeType` | Link a un resource |
| `resource` | `resource.uri` + `resource.text/blob` | Resource embebido |

Todos los content types soportan `annotations` opcionales (`audience`, `priority`, `lastModified`).

### 5.6 Error Handling en Tools

Dos mecanismos:

1. **Protocol errors** (JSON-RPC): tool desconocido, args invalidos, server error
```json
{ "jsonrpc": "2.0", "id": 3, "error": { "code": -32602, "message": "Unknown tool: invalid_name" } }
```

2. **Tool execution errors** (`isError: true`): fallos de API, datos invalidos, errores de logica
```json
{
  "jsonrpc": "2.0", "id": 4,
  "result": {
    "content": [{ "type": "text", "text": "API rate limit exceeded" }],
    "isError": true
  }
}
```

### 5.7 Implementacion TypeScript (MCP SDK)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "my-server",
  version: "1.0.0"
});

// Definir tool con annotations
server.tool(
  "get_weather",
  "Get current weather for a location",
  {
    location: { type: "string", description: "City name" }
  },
  {
    annotations: {
      readOnlyHint: true,
      openWorldHint: true
    }
  },
  async ({ location }) => {
    const weather = await fetchWeather(location);
    return {
      content: [{ type: "text", text: JSON.stringify(weather) }]
    };
  }
);
```

### 5.8 Implementacion Python (MCP SDK)

```python
from mcp.server import Server
from mcp.types import Tool, TextContent

server = Server("my-server")

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="get_weather",
            description="Get current weather for a location",
            inputSchema={
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name or zip code"
                    }
                },
                "required": ["location"]
            },
            annotations={
                "readOnlyHint": True,
                "openWorldHint": True
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "get_weather":
        weather = await fetch_weather(arguments["location"])
        return [TextContent(type="text", text=str(weather))]
    raise ValueError(f"Unknown tool: {name}")
```

---

## 6. Resources

**Protocol Revision**: 2025-06-18

Resources son **application-controlled**: la host app decide como incorporar contexto.

### 6.1 Capability Declaration

```json
{
  "capabilities": {
    "resources": {
      "subscribe": true,
      "listChanged": true
    }
  }
}
```

- `subscribe`: client puede subscribirse a cambios de recursos individuales
- `listChanged`: server emitira notificaciones cuando la lista de resources cambie
- Ambos son opcionales

### 6.2 Resource Definition

```json
{
  "uri": "file:///project/src/main.rs",
  "name": "main.rs",
  "title": "Rust Application Main File",
  "description": "Primary application entry point",
  "mimeType": "text/x-rust",
  "size": 1024,
  "annotations": {
    "audience": ["user", "assistant"],
    "priority": 0.8,
    "lastModified": "2025-01-12T15:00:58Z"
  }
}
```

| Campo | Tipo | Requerido | Descripcion |
|---|---|---|---|
| `uri` | string (URI) | Si | Identificador unico del recurso |
| `name` | string | Si | Nombre del recurso |
| `title` | string | No | Nombre human-readable para display |
| `description` | string | No | Descripcion |
| `mimeType` | string | No | MIME type |
| `size` | number | No | Tamano en bytes |
| `annotations` | object | No | Metadata de audiencia, prioridad, fecha |

### 6.3 Resource Annotations

| Campo | Tipo | Descripcion |
|---|---|---|
| `audience` | string[] | `["user"]`, `["assistant"]`, o `["user", "assistant"]` |
| `priority` | number | 0.0 (menos importante) a 1.0 (mas importante/requerido) |
| `lastModified` | string | ISO 8601 timestamp |

### 6.4 Protocol Messages

#### Listing Resources

```json
// Request
{ "jsonrpc": "2.0", "id": 1, "method": "resources/list", "params": { "cursor": "optional" } }

// Response
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "resources": [
      { "uri": "file:///project/src/main.rs", "name": "main.rs", "mimeType": "text/x-rust" }
    ],
    "nextCursor": "next-page-cursor"
  }
}
```

#### Reading Resources

```json
// Request
{ "jsonrpc": "2.0", "id": 2, "method": "resources/read", "params": { "uri": "file:///project/src/main.rs" } }

// Response (text)
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "contents": [{
      "uri": "file:///project/src/main.rs",
      "mimeType": "text/x-rust",
      "text": "fn main() {\n    println!(\"Hello world!\");\n}"
    }]
  }
}

// Response (binary)
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "contents": [{
      "uri": "file:///example.png",
      "mimeType": "image/png",
      "blob": "base64-encoded-data"
    }]
  }
}
```

#### Resource Templates (URI Templates RFC 6570)

```json
// Request
{ "jsonrpc": "2.0", "id": 3, "method": "resources/templates/list", "params": { "cursor": "optional" } }

// Response
{
  "jsonrpc": "2.0", "id": 3,
  "result": {
    "resourceTemplates": [{
      "uriTemplate": "file:///{path}",
      "name": "Project Files",
      "description": "Access files in the project directory",
      "mimeType": "application/octet-stream"
    }]
  }
}
```

#### Subscriptions

```json
// Subscribe
{ "jsonrpc": "2.0", "id": 4, "method": "resources/subscribe", "params": { "uri": "file:///project/src/main.rs" } }

// Server notification when resource changes
{ "jsonrpc": "2.0", "method": "notifications/resources/updated", "params": { "uri": "file:///project/src/main.rs" } }

// List changed notification
{ "jsonrpc": "2.0", "method": "notifications/resources/list_changed" }
```

### 6.5 URI Schemes

| Scheme | Uso |
|---|---|
| `https://` | Recurso en la web (solo si el client puede fetch directamente) |
| `file://` | Recursos tipo filesystem (no necesitan ser fisicos) |
| `git://` | Integracion con Git |
| Custom | MUST cumplir RFC 3986 |

### 6.6 Resources vs Tools -- Cuando Usar Cada Uno

| Aspecto | Resources | Tools |
|---|---|---|
| Control | Application-driven | Model-driven |
| Proposito | Proveer contexto/datos | Ejecutar acciones/computaciones |
| Analogia | GET (lectura) | POST (accion) |
| Ejemplo | Leer un archivo, DB schema | Ejecutar query, llamar API |
| Subscriptions | Si (cambios en tiempo real) | No |
| Side effects | No | Si |

---

## 7. Prompts

**Protocol Revision**: 2025-06-18

Prompts son **user-controlled**: se exponen para que el usuario los seleccione explicitamente (ej: slash commands).

### 7.1 Capability Declaration

```json
{
  "capabilities": {
    "prompts": {
      "listChanged": true
    }
  }
}
```

### 7.2 Protocol Messages

#### Listing Prompts

```json
// Request
{ "jsonrpc": "2.0", "id": 1, "method": "prompts/list", "params": { "cursor": "optional" } }

// Response
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "prompts": [{
      "name": "code_review",
      "title": "Request Code Review",
      "description": "Asks the LLM to analyze code quality",
      "arguments": [
        { "name": "code", "description": "The code to review", "required": true }
      ]
    }],
    "nextCursor": "next-page-cursor"
  }
}
```

#### Getting a Prompt

```json
// Request
{
  "jsonrpc": "2.0", "id": 2,
  "method": "prompts/get",
  "params": {
    "name": "code_review",
    "arguments": { "code": "def hello():\n    print('world')" }
  }
}

// Response
{
  "jsonrpc": "2.0", "id": 2,
  "result": {
    "description": "Code review prompt",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "Please review this Python code:\ndef hello():\n    print('world')"
        }
      }
    ]
  }
}
```

### 7.3 Prompt Message Content Types

Los mensajes pueden contener:
- **Text content**: `{ "type": "text", "text": "..." }`
- **Image content**: `{ "type": "image", "data": "base64...", "mimeType": "image/png" }`
- **Audio content**: `{ "type": "audio", "data": "base64...", "mimeType": "audio/wav" }`
- **Embedded resources**: `{ "type": "resource", "resource": { "uri": "...", "text": "..." } }`

Los roles son `"user"` o `"assistant"`.

### 7.4 Dynamic Prompts

Los prompts pueden incluir contenido dinamico:

```python
@server.get_prompt()
async def get_prompt(name: str, arguments: dict):
    if name == "code_review":
        code = arguments.get("code", "")
        # Leer archivos, consultar DB, etc.
        context = await get_project_context()
        return {
            "description": "Code review with project context",
            "messages": [
                {
                    "role": "user",
                    "content": {
                        "type": "text",
                        "text": f"Review this code in context of:\n{context}\n\nCode:\n{code}"
                    }
                }
            ]
        }
```

---

## 8. Sampling

**Protocol Revision**: 2025-06-18

Sampling permite que el **server pida al client** que haga llamadas LLM. El server NO necesita API keys.

### 8.1 Capability Declaration (Client)

```json
{
  "capabilities": {
    "sampling": {}
  }
}
```

### 8.2 Request/Response

```json
// Server -> Client: sampling/createMessage
{
  "jsonrpc": "2.0", "id": 1,
  "method": "sampling/createMessage",
  "params": {
    "messages": [
      {
        "role": "user",
        "content": { "type": "text", "text": "What is the capital of France?" }
      }
    ],
    "modelPreferences": {
      "hints": [
        { "name": "claude-3-sonnet" },
        { "name": "claude" }
      ],
      "intelligencePriority": 0.8,
      "speedPriority": 0.5,
      "costPriority": 0.3
    },
    "systemPrompt": "You are a helpful assistant.",
    "maxTokens": 100
  }
}

// Client -> Server: response
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "role": "assistant",
    "content": { "type": "text", "text": "The capital of France is Paris." },
    "model": "claude-3-sonnet-20240307",
    "stopReason": "endTurn"
  }
}
```

### 8.3 Model Preferences

| Campo | Tipo | Descripcion |
|---|---|---|
| `hints` | array | Sugerencias de modelos (substrings, no exactos). Advisory, el client decide |
| `costPriority` | number (0-1) | Prioridad de minimizar costes |
| `speedPriority` | number (0-1) | Prioridad de baja latencia |
| `intelligencePriority` | number (0-1) | Prioridad de capacidades avanzadas |

### 8.4 Human-in-the-Loop

El flujo SHOULD incluir revision humana:
1. Server envia `sampling/createMessage`
2. Client presenta la request al usuario para aprobacion
3. Usuario revisa/modifica y aprueba
4. Client envia al LLM
5. LLM genera respuesta
6. Client presenta respuesta al usuario
7. Usuario revisa/modifica y aprueba
8. Client retorna respuesta al server

---

## 9. Roots

**Protocol Revision**: 2025-06-18

Roots definen los **limites del filesystem** donde el server puede operar.

### 9.1 Capability Declaration (Client)

```json
{
  "capabilities": {
    "roots": {
      "listChanged": true
    }
  }
}
```

### 9.2 Protocol Messages

```json
// Server -> Client: roots/list
{ "jsonrpc": "2.0", "id": 1, "method": "roots/list" }

// Client -> Server: response
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "roots": [
      { "uri": "file:///home/user/projects/myproject", "name": "My Project" },
      { "uri": "file:///home/user/repos/backend", "name": "Backend Repository" }
    ]
  }
}

// Client -> Server: notification de cambio
{ "jsonrpc": "2.0", "method": "notifications/roots/list_changed" }
```

### 9.3 Reglas

- Root URIs MUST ser `file://` URIs en la spec actual
- Clients MUST validar URIs para prevenir path traversal
- Servers SHOULD respetar los limites de roots en operaciones
- Clients SHOULD pedir consentimiento antes de exponer roots

---

## 10. Elicitation

**Protocol Revision**: 2025-06-18 (NUEVO en esta version)

Elicitation permite que el **server pida informacion al usuario** a traves del client. Diferente de sampling (que pide LLM calls).

### 10.1 Capability Declaration (Client)

```json
{
  "capabilities": {
    "elicitation": {}
  }
}
```

### 10.2 Request/Response

```json
// Server -> Client: elicitation/create
{
  "jsonrpc": "2.0", "id": 1,
  "method": "elicitation/create",
  "params": {
    "message": "Please provide your contact information",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "Your full name" },
        "email": { "type": "string", "format": "email", "description": "Email address" },
        "age": { "type": "number", "minimum": 18 }
      },
      "required": ["name", "email"]
    }
  }
}

// Response: Accept
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "action": "accept",
    "content": { "name": "John Doe", "email": "john@example.com", "age": 30 }
  }
}

// Response: Decline
{ "jsonrpc": "2.0", "id": 1, "result": { "action": "decline" } }

// Response: Cancel
{ "jsonrpc": "2.0", "id": 1, "result": { "action": "cancel" } }
```

### 10.3 Schema Soportado

Solo objetos planos con propiedades primitivas (NO estructuras anidadas, NO arrays):

| Tipo | Validaciones soportadas |
|---|---|
| `string` | `minLength`, `maxLength`, `format` (email, uri, date, date-time) |
| `number` / `integer` | `minimum`, `maximum` |
| `boolean` | `default` |
| `string` + `enum` | `enum` (valores), `enumNames` (labels) |

### 10.4 Response Actions

| Action | Significado | content |
|---|---|---|
| `accept` | Usuario aprobo y envio datos | Datos que matchean el schema |
| `decline` | Usuario rechazo explicitamente | Omitido |
| `cancel` | Usuario cerro sin decidir (escape, click afuera) | Omitido |

### 10.5 Seguridad

- Servers MUST NOT usar elicitation para pedir informacion sensible
- Clients SHOULD mostrar claramente QUE server pide la info
- Clients SHOULD implementar rate limiting
- Clients SHOULD permitir a usuarios declinar en cualquier momento

---

## 11. Authorization (OAuth 2.1)

**Protocol Revision**: 2025-06-18

Authorization es OPCIONAL. Solo aplica a HTTP-based transports. Para stdio, credentials vienen del environment.

### 11.1 Standards

| Standard | RFC |
|---|---|
| OAuth 2.1 | draft-ietf-oauth-v2-1-13 |
| Authorization Server Metadata | RFC 8414 |
| Dynamic Client Registration | RFC 7591 |
| Protected Resource Metadata | RFC 9728 |
| Resource Indicators | RFC 8707 |

### 11.2 Roles

- **MCP Server** = OAuth 2.1 Resource Server
- **MCP Client** = OAuth 2.1 Client
- **Authorization Server** = Emite access tokens (puede ser separado o co-hosted)

### 11.3 Discovery Flow

```
1. Client hace request sin token
2. Server responde 401 con WWW-Authenticate header
3. Client extrae resource_metadata URL del header
4. Client GET /.well-known/oauth-protected-resource -> obtiene AS URL
5. Client GET /.well-known/oauth-authorization-server -> obtiene AS metadata
6. (Opcional) Client POST /register -> Dynamic Client Registration
7. Client inicia OAuth flow con PKCE + resource parameter
8. Obtiene access token
9. Client hace requests con Authorization: Bearer <token>
```

### 11.4 Requisitos Clave

- MCP servers MUST implementar Protected Resource Metadata (RFC 9728)
- MCP clients MUST incluir `resource` parameter (RFC 8707) en auth/token requests
- MCP clients MUST usar PKCE
- Access tokens se envian via `Authorization: Bearer <token>` header
- Tokens MUST NOT ir en query string
- Authorization MUST incluirse en CADA request HTTP (incluso dentro de una session)
- Servers MUST validar que tokens fueron emitidos para ELLOS como audience
- Servers MUST NOT hacer token passthrough (pasar tokens de clients a upstream APIs)

### 11.5 Error Codes HTTP

| Status | Descripcion | Uso |
|---|---|---|
| 401 | Unauthorized | Auth requerida o token invalido |
| 403 | Forbidden | Scopes invalidos o permisos insuficientes |
| 400 | Bad Request | Request de auth malformada |

### 11.6 Dynamic Client Registration

SHOULD soportarse porque:
- Clients no conocen todos los servers de antemano
- Registration manual crea friccion
- Permite conexion seamless a nuevos servers

Si NO se soporta, el client necesita:
1. Hardcodear client_id para ese AS, o
2. UI para que el usuario ingrese credentials

---

## 12. Utilities

### 12.1 Ping

Verificacion de que la contraparte esta respondiendo. Cualquiera de los dos puede enviar.

```json
// Request
{ "jsonrpc": "2.0", "id": "123", "method": "ping" }

// Response
{ "jsonrpc": "2.0", "id": "123", "result": {} }
```

- Receiver MUST responder promptly con resultado vacio
- Si no hay respuesta en timeout razonable, MAY considerar la conexion stale

### 12.2 Cancellation

Cancelar requests en progreso. Cualquiera de los dos puede enviar.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": "123",
    "reason": "User requested cancellation"
  }
}
```

**Reglas**:
- MUST solo referenciar requests previamente emitidas que se creen en progreso
- El `initialize` request MUST NOT ser cancelado por clients
- Receivers SHOULD parar procesamiento y liberar recursos
- Receivers MAY ignorar si el request ya completo o es desconocido
- Race conditions son esperadas y ambas partes MUST manejarlas gracefully

### 12.3 Progress

Tracking de progreso para operaciones largas.

```json
// Request con progressToken
{
  "jsonrpc": "2.0", "id": 1,
  "method": "tools/call",
  "params": {
    "name": "long_operation",
    "arguments": {},
    "_meta": { "progressToken": "abc123" }
  }
}

// Server notifica progreso
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "abc123",
    "progress": 50,
    "total": 100,
    "message": "Processing items..."
  }
}
```

- `progress` MUST incrementar con cada notification
- `total` es opcional (puede ser desconocido)
- `message` SHOULD proveer informacion human-readable
- `progress` y `total` MAY ser floating point
- `progressToken` MUST ser string o integer, unico entre requests activos

### 12.4 Logging

Servers envian log messages estructurados a clients.

```json
// Client configura nivel
{ "jsonrpc": "2.0", "id": 1, "method": "logging/setLevel", "params": { "level": "info" } }

// Server envia log
{
  "jsonrpc": "2.0",
  "method": "notifications/message",
  "params": {
    "level": "error",
    "logger": "database",
    "data": {
      "error": "Connection failed",
      "details": { "host": "localhost", "port": 5432 }
    }
  }
}
```

**Niveles** (syslog RFC 5424): debug, info, notice, warning, error, critical, alert, emergency

### 12.5 Completion (Autocomplete)

Autocompletado de argumentos para prompts y resource URIs.

```json
// Request
{
  "jsonrpc": "2.0", "id": 1,
  "method": "completion/complete",
  "params": {
    "ref": { "type": "ref/prompt", "name": "code_review" },
    "argument": { "name": "language", "value": "py" },
    "context": {
      "arguments": { "previousArg": "value" }
    }
  }
}

// Response
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "completion": {
      "values": ["python", "pytorch", "pyside"],
      "total": 10,
      "hasMore": true
    }
  }
}
```

**Reference types**: `ref/prompt` (por nombre) y `ref/resource` (por URI template).
Maximo 100 items por respuesta.

### 12.6 Pagination

Paginacion cursor-based para operaciones de lista.

```json
// Primera request (sin cursor)
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }

// Response con cursor
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "tools": [ /* ... */ ],
    "nextCursor": "eyJwYWdlIjogMn0="
  }
}

// Siguiente pagina
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": { "cursor": "eyJwYWdlIjogMn0=" } }
```

**Operaciones paginables**: `resources/list`, `resources/templates/list`, `prompts/list`, `tools/list`

**Reglas**:
- Cursors son opacos -- clients MUST NOT parsearlos ni modificarlos
- No persistir cursors entre sessions
- El server determina el page size
- `nextCursor` ausente = fin de resultados

---

## 13. Error Handling

### 13.1 Standard JSON-RPC Error Codes

| Code | Name | Descripcion |
|---|---|---|
| `-32700` | Parse error | JSON invalido |
| `-32600` | Invalid request | La request no es un JSON-RPC valido |
| `-32601` | Method not found | Metodo no existe o capability no soportada |
| `-32602` | Invalid params | Parametros invalidos (tool desconocido, args invalidos, cursor invalido) |
| `-32603` | Internal error | Error interno del server |

### 13.2 Custom Error Codes

| Code | Uso |
|---|---|
| `-32002` | Resource not found |
| `-1` | User rejected sampling request |

### 13.3 Initialization Error

```json
{
  "jsonrpc": "2.0", "id": 1,
  "error": {
    "code": -32602,
    "message": "Unsupported protocol version",
    "data": { "supported": ["2024-11-05"], "requested": "1.0.0" }
  }
}
```

---

## 14. Security Model

### 14.1 Principios Fundamentales

1. **Human-in-the-Loop**: SHOULD siempre haber un humano con capacidad de denegar tool invocations y sampling requests
2. **Least Privilege**: Comenzar con scopes minimos, escalar solo cuando se necesite
3. **Consent**: Clients SHOULD pedir consentimiento antes de exponer roots o ejecutar tools
4. **Untrusted Annotations**: Tool annotations MUST considerarse untrusted a menos que vengan de servers confiables

### 14.2 Security Requirements para Servers

- MUST validar todas las tool inputs
- MUST implementar access controls
- SHOULD rate-limit tool invocations
- MUST sanitizar tool outputs
- MUST validar resource URIs
- MUST NOT solicitar info sensible via elicitation
- Log messages MUST NOT contener credentials, PII, o detalles internos

### 14.3 Security Requirements para Clients

- SHOULD mostrar tool inputs al usuario antes de invocar (prevenir data exfiltration)
- SHOULD pedir confirmacion en operaciones sensibles
- SHOULD validar tool results antes de pasar al LLM
- SHOULD implementar timeouts
- SHOULD loggear tool usage para auditoria
- MUST implementar PKCE para OAuth
- SHOULD validar redirects para prevenir open redirection
- SHOULD implementar rate limiting para elicitation

### 14.4 Token Security

- Tokens MUST enviarse solo via `Authorization: Bearer` header
- Tokens MUST NOT ir en query strings
- Servers MUST validar que tokens fueron emitidos para ellos (audience binding)
- Servers MUST NOT hacer token passthrough a upstream APIs
- Short-lived access tokens para reducir impacto de leaks
- Public clients MUST rotar refresh tokens

### 14.5 Session Security

- Session IDs MUST ser cryptographically secure (UUID, JWT, hash)
- Servers MUST NOT usar sessions para autenticacion
- Servers SHOULD bindear session IDs a user info (`<user_id>:<session_id>`)

### 14.6 SSRF Prevention

- Clients SHOULD requerir HTTPS para URLs OAuth en produccion
- Clients SHOULD bloquear rangos IP privados (10.x, 172.16.x, 192.168.x, 169.254.x)
- Clients SHOULD validar redirect targets
- Considerar egress proxies (ej: Smokescreen)

### 14.7 Local MCP Server Security

- Clients MUST implementar consent antes de ejecutar comandos de servers locales
- Mostrar comando exacto que se ejecutara
- Sandboxing de server processes
- Servers locales SHOULD usar stdio o restringir acceso HTTP

### 14.8 Confused Deputy Prevention

- MCP proxy servers MUST implementar per-client consent antes de forward a third-party AS
- Consent cookies MUST usar `__Host-` prefix, Secure, HttpOnly, SameSite=Lax
- Validacion exacta de redirect URIs
- State parameter validation (cryptographically secure, single-use, short expiration)

---

## 15. Resumability

### 15.1 Como Funciona

Para soportar reconexion y redelivery de mensajes perdidos en Streamable HTTP:

1. **Server asigna IDs a eventos SSE**:
   - El ID MUST ser globalmente unico dentro de la session (o por-client si no hay session)
   - IDs se asignan per-stream y actuan como cursor

2. **Client reconecta con Last-Event-ID**:
   ```
   GET /mcp HTTP/1.1
   Accept: text/event-stream
   Mcp-Session-Id: abc123
   Last-Event-ID: evt-42
   ```

3. **Server replays mensajes**:
   - MAY replegar mensajes que se hubieran enviado despues del last event ID
   - MUST NOT replegar mensajes de un stream diferente
   - Resume el stream desde ese punto

### 15.2 Importante

- Disconnection SHOULD NOT interpretarse como cancelacion
- Para cancelar, el client SHOULD enviar explicitamente `CancelledNotification`
- Event IDs son per-stream, no globales
- El server decide si soporta resumability

### 15.3 Ejemplo SSE con IDs

```
id: evt-1
data: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progressToken":"abc","progress":1,"total":10}}

id: evt-2
data: {"jsonrpc":"2.0","method":"notifications/progress","params":{"progressToken":"abc","progress":5,"total":10}}

id: evt-3
data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"Done!"}]}}
```

Si la conexion se corta despues de `evt-2`, el client reconecta con `Last-Event-ID: evt-2` y el server reenvia `evt-3`.

---

## Apendice A: Tabla Completa de Metodos JSON-RPC

### Client -> Server (Requests)

| Method | Descripcion | Capability requerida |
|---|---|---|
| `initialize` | Inicializar session | - |
| `ping` | Health check | - |
| `tools/list` | Listar tools | `tools` |
| `tools/call` | Invocar tool | `tools` |
| `resources/list` | Listar resources | `resources` |
| `resources/read` | Leer resource | `resources` |
| `resources/templates/list` | Listar templates | `resources` |
| `resources/subscribe` | Subscribirse a resource | `resources.subscribe` |
| `resources/unsubscribe` | Desubscribirse | `resources.subscribe` |
| `prompts/list` | Listar prompts | `prompts` |
| `prompts/get` | Obtener prompt | `prompts` |
| `completion/complete` | Autocompletar | `completions` |
| `logging/setLevel` | Configurar nivel de log | `logging` |

### Server -> Client (Requests)

| Method | Descripcion | Capability requerida |
|---|---|---|
| `sampling/createMessage` | Pedir LLM generation | `sampling` (client) |
| `elicitation/create` | Pedir info al usuario | `elicitation` (client) |
| `roots/list` | Listar filesystem roots | `roots` (client) |

### Client -> Server (Notifications)

| Method | Descripcion |
|---|---|
| `notifications/initialized` | Session lista |
| `notifications/cancelled` | Cancelar request |
| `notifications/progress` | Progreso de operacion |
| `notifications/roots/list_changed` | Roots cambiaron |

### Server -> Client (Notifications)

| Method | Descripcion |
|---|---|
| `notifications/cancelled` | Cancelar request |
| `notifications/progress` | Progreso de operacion |
| `notifications/tools/list_changed` | Lista de tools cambio |
| `notifications/resources/list_changed` | Lista de resources cambio |
| `notifications/resources/updated` | Resource especifico cambio |
| `notifications/prompts/list_changed` | Lista de prompts cambio |
| `notifications/message` | Log message |

---

## Apendice B: Arquitectura Recomendada para Nuestro MCP Server

Basado en la spec, para el POD AI Store MCP server:

### Transport Recomendado

**Streamable HTTP** porque:
- Necesitamos multiples clientes (frontend, PodClaw agents, admin)
- Necesitamos session management
- Puede correr como servicio Docker independiente
- Soporta SSE para notificaciones en tiempo real

### Capabilities a Implementar (Server)

```json
{
  "capabilities": {
    "tools": { "listChanged": true },
    "resources": { "subscribe": true, "listChanged": true },
    "prompts": { "listChanged": true },
    "logging": {},
    "completions": {}
  }
}
```

### Tools Candidatos

| Tool | Annotations | Descripcion |
|---|---|---|
| `search_products` | readOnly, openWorld | Buscar en catalogo |
| `get_product_details` | readOnly | Detalles de producto |
| `create_order` | destructive, !idempotent | Crear pedido |
| `update_product` | !readOnly, !destructive, idempotent | Actualizar producto |
| `sync_printful` | !readOnly, openWorld | Sincronizar con Printful |
| `generate_design` | !readOnly, openWorld | Generar diseno con fal.ai |

### Resources Candidatos

| URI Pattern | Descripcion |
|---|---|
| `product://{id}` | Datos de producto |
| `catalog://categories` | Lista de categorias |
| `order://{id}` | Datos de pedido |
| `store://config` | Configuracion de tienda |
| `analytics://dashboard` | Metricas clave |

### Auth

- OAuth 2.1 con PKCE para clientes HTTP
- Tokens JWT emitidos por nuestro AS (Supabase Auth como base)
- Resource parameter = `https://mcp.skapara.com`
- Dynamic Client Registration para integraciones futuras

---

## Fuentes

- [MCP Specification (oficial)](https://modelcontextprotocol.io/specification)
- [MCP Specification 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/)
- [MCP Tools](https://modelcontextprotocol.io/docs/concepts/tools)
- [MCP Resources](https://modelcontextprotocol.io/docs/concepts/resources)
- [MCP Prompts](https://modelcontextprotocol.io/docs/concepts/prompts)
- [MCP Sampling](https://modelcontextprotocol.io/docs/concepts/sampling)
- [MCP Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP Lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- [MCP Authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices)
- [MCP Elicitation](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation)
- [MCP Roots](https://modelcontextprotocol.io/specification/2025-06-18/client/roots)
- [MCP Pagination](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/pagination)
- [MCP Completion](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/completion)
- [MCP Logging](https://modelcontextprotocol.io/specification/2025-06-18/server/utilities/logging)
- [GitHub Spec Repo](https://github.com/modelcontextprotocol/specification)
- [Auth0 MCP Spec Update Blog](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
- [ForgeCode MCP 2025-06-18 Analysis](https://forgecode.dev/blog/mcp-spec-updates/)
