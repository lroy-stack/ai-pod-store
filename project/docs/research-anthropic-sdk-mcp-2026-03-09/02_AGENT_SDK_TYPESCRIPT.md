# Claude Agent SDK TypeScript -- Investigacion Completa

**Fecha**: 2026-03-09
**Fuentes**: Documentacion oficial Anthropic, GitHub, npm, docs de API

---

## 1. Existe el Agent SDK TypeScript? -- SI

El Claude Agent SDK para TypeScript **existe oficialmente** y tiene paridad casi completa con la version Python.

| Propiedad | Valor |
|---|---|
| **Paquete npm** | `@anthropic-ai/claude-agent-sdk` |
| **Repositorio** | [github.com/anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript) |
| **Version actual** | `0.2.72` (actualizado 2026-03-09) |
| **Requisitos** | Node.js 18+ |
| **Licencia** | Propietaria (Anthropic Commercial Terms of Service) |
| **Estado** | Produccion (V1 estable), V2 preview disponible |
| **Instalacion** | `npm install @anthropic-ai/claude-agent-sdk` |

### Nombre anterior
El SDK se llamaba **Claude Code SDK** y fue renombrado a **Claude Agent SDK**. Existe una guia de migracion oficial.

### Diferencia con @anthropic-ai/sdk
- `@anthropic-ai/sdk` -- SDK de bajo nivel para la API de Anthropic (Messages API, tool_use, streaming). Tu implementas el loop de herramientas.
- `@anthropic-ai/claude-agent-sdk` -- SDK de alto nivel que te da un agente autonomo con herramientas built-in (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch). Claude ejecuta las herramientas por ti.

---

## 2. Comparacion Python vs TypeScript -- Feature Parity

### API Principal

| Feature | Python | TypeScript | Notas |
|---|---|---|---|
| `query()` | `async for msg in query()` | `for await (const msg of query())` | Mismo concepto, async generators |
| `tool()` | Decorador `@tool(name, desc, schema)` | Funcion `tool(name, desc, zodSchema, handler)` | Python usa dict/type, TS usa Zod |
| `create_sdk_mcp_server()` | Si | `createSdkMcpServer()` | Identico |
| `list_sessions()` | Si (sincrono) | `listSessions()` (async) | Ligera diferencia |
| `get_session_messages()` | Si (sincrono) | `getSessionMessages()` (async) | Ligera diferencia |
| Hooks | Si | Si | Mismos eventos |
| Subagents | Si | Si | Mismo API |
| MCP servers | Si | Si | Mismo API |
| Permissions | Si | Si | Mismo API |
| Sessions (resume/fork) | Si | Si | Mismo API |
| Structured Output | Si | Si | JSON Schema |
| Plugins | Si | Si | Mismo API |
| File Checkpointing | Si | Si | Mismo API |
| Sandbox Settings | Si | Si | Mismo API |
| Thinking/Effort config | Si | Si | Mismo API |

### Diferencias Clave

| Aspecto | Python | TypeScript |
|---|---|---|
| **Client persistente** | `ClaudeSDKClient` (clase con `connect/query/disconnect`) | No existe equivalente directo en V1. V2 preview tiene `createSession()` |
| **Interrupts** | `ClaudeSDKClient.interrupt()` | `query.interrupt()` (solo en streaming input mode) |
| **V2 API** | No disponible | Si -- `unstable_v2_createSession`, `unstable_v2_resumeSession`, `unstable_v2_prompt` |
| **Transport custom** | Si (`Transport` ABC) | No documentado como clase abstracta |
| **Tool schema** | Dict Python o JSON Schema | Zod schema (Zod 3 y Zod 4 soportados) |
| **Session management** | `query()` siempre crea nueva session | `query()` + `resume` option, o V2 sessions |
| **Naming convention** | snake_case (`allowed_tools`, `mcp_servers`) | camelCase (`allowedTools`, `mcpServers`) |
| **Built-in tools identicos** | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion, Agent | Identicos |

### Lo que Python tiene y TypeScript NO (o viceversa)

| Feature | Python | TypeScript |
|---|---|---|
| `ClaudeSDKClient` (persistent client) | SI | NO (usar V2 preview como alternativa) |
| V2 Session API (preview) | NO | SI (`unstable_v2_*`) |
| Custom Transport | SI | No documentado |
| `query().stopTask(taskId)` | No documentado | SI |
| `query().toggleMcpServer()` | No documentado | SI |
| `query().setMcpServers()` | No documentado | SI |
| `query().reconnectMcpServer()` | No documentado | SI |
| `query().supportedModels()` | No documentado | SI |
| `query().supportedAgents()` | No documentado | SI |
| `query().accountInfo()` | No documentado | SI |

**Conclusion**: TypeScript tiene MAS funcionalidad en el objeto `Query` retornado por `query()`. Python compensa con `ClaudeSDKClient` para conversaciones persistentes.

---

## 3. API Surface -- TypeScript

### Funciones principales

```typescript
// 1. Query -- funcion principal
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message);
}

// 2. Tool -- definir herramientas custom con Zod
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const myTool = tool(
  "greet",
  "Greet a user",
  { name: z.string() },
  async (args) => ({
    content: [{ type: "text", text: `Hello, ${args.name}!` }]
  })
);

// 3. createSdkMcpServer -- servidor MCP in-process
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

const server = createSdkMcpServer({
  name: "my-tools",
  version: "1.0.0",
  tools: [myTool]
});

// 4. Sessions
import { listSessions, getSessionMessages } from "@anthropic-ai/claude-agent-sdk";

const sessions = await listSessions({ dir: "/path/to/project", limit: 10 });
const messages = await getSessionMessages(sessions[0].sessionId);
```

### V2 API (Preview/Unstable)

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt
} from "@anthropic-ai/claude-agent-sdk";

// One-shot
const result = await unstable_v2_prompt("What is 2 + 2?", {
  model: "claude-opus-4-6"
});

// Session-based
await using session = unstable_v2_createSession({
  model: "claude-opus-4-6"
});

await session.send("Hello!");
for await (const msg of session.stream()) {
  if (msg.type === "assistant") {
    // process response
  }
}

// Resume
await using resumed = unstable_v2_resumeSession(sessionId, {
  model: "claude-opus-4-6"
});
```

### Options (configuracion completa)

```typescript
interface Options {
  // Core
  model?: string;
  fallbackModel?: string;
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };
  cwd?: string;

  // Tools & Permissions
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };
  allowedTools?: string[];
  disallowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
  canUseTool?: CanUseTool;

  // MCP
  mcpServers?: Record<string, McpServerConfig>;

  // Subagents
  agents?: Record<string, AgentDefinition>;
  agent?: string;

  // Sessions
  resume?: string;
  forkSession?: boolean;
  sessionId?: string;
  persistSession?: boolean;
  continue?: boolean;

  // Hooks
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;

  // Budget & Limits
  maxBudgetUsd?: number;
  maxTurns?: number;

  // Thinking
  thinking?: ThinkingConfig;
  effort?: 'low' | 'medium' | 'high' | 'max';

  // Output
  outputFormat?: { type: 'json_schema'; schema: JSONSchema };
  includePartialMessages?: boolean;
  promptSuggestions?: boolean;

  // Advanced
  betas?: SdkBeta[];
  env?: Record<string, string | undefined>;
  sandbox?: SandboxSettings;
  plugins?: SdkPluginConfig[];
  settingSources?: ('user' | 'project' | 'local')[];
  enableFileCheckpointing?: boolean;
  abortController?: AbortController;
  additionalDirectories?: string[];
  toolConfig?: ToolConfig;

  // Process
  executable?: 'bun' | 'deno' | 'node';
  pathToClaudeCodeExecutable?: string;
  spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
}
```

### Query Object -- Metodos disponibles

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
  initializationResult(): Promise<SDKControlInitializeResponse>;
  supportedCommands(): Promise<SlashCommand[]>;
  supportedModels(): Promise<ModelInfo[]>;
  supportedAgents(): Promise<AgentInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  accountInfo(): Promise<AccountInfo>;
  reconnectMcpServer(serverName: string): Promise<void>;
  toggleMcpServer(serverName: string, enabled: boolean): Promise<void>;
  setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  close(): void;
}
```

### Hook Events (18 eventos)

```typescript
type HookEvent =
  | "PreToolUse"       // Antes de ejecutar herramienta
  | "PostToolUse"      // Despues de ejecutar herramienta
  | "PostToolUseFailure" // Cuando falla herramienta
  | "Notification"     // Notificaciones
  | "UserPromptSubmit" // Cuando usuario envia prompt
  | "SessionStart"     // Inicio de sesion
  | "SessionEnd"       // Fin de sesion
  | "Stop"             // Agente se detiene
  | "SubagentStart"    // Subagente inicia
  | "SubagentStop"     // Subagente termina
  | "PreCompact"       // Antes de compactar contexto
  | "PermissionRequest" // Solicitud de permiso
  | "Setup"            // Configuracion inicial
  | "TeammateIdle"     // Teammate ocioso
  | "TaskCompleted"    // Tarea completada
  | "ConfigChange"     // Cambio de configuracion
  | "WorktreeCreate"   // Worktree creado
  | "WorktreeRemove";  // Worktree eliminado
```

### Message Types (16 tipos)

```typescript
type SDKMessage =
  | SDKAssistantMessage        // Respuesta del modelo
  | SDKUserMessage             // Mensaje del usuario
  | SDKUserMessageReplay       // Replay de mensaje
  | SDKResultMessage           // Resultado final (success/error)
  | SDKSystemMessage           // Init del sistema
  | SDKPartialAssistantMessage // Streaming parcial
  | SDKCompactBoundaryMessage  // Limite de compactacion
  | SDKStatusMessage           // Estado
  | SDKHookStartedMessage      // Hook iniciado
  | SDKHookProgressMessage     // Progreso de hook
  | SDKHookResponseMessage     // Respuesta de hook
  | SDKToolProgressMessage     // Progreso de herramienta
  | SDKAuthStatusMessage       // Estado de auth
  | SDKTaskNotificationMessage // Notificacion de tarea
  | SDKTaskStartedMessage      // Tarea iniciada
  | SDKTaskProgressMessage     // Progreso de tarea
  | SDKFilesPersistedEvent     // Archivos persistidos
  | SDKToolUseSummaryMessage   // Resumen de uso de herramientas
  | SDKRateLimitEvent          // Rate limit
  | SDKPromptSuggestionMessage; // Sugerencia de prompt
```

### AgentDefinition (Subagentes)

```typescript
type AgentDefinition = {
  description: string;           // Cuando usar este agente
  prompt: string;                // System prompt del agente
  tools?: string[];              // Herramientas permitidas
  disallowedTools?: string[];    // Herramientas bloqueadas
  model?: "sonnet" | "opus" | "haiku" | "inherit";
  mcpServers?: AgentMcpServerSpec[];
  skills?: string[];             // Skills a precargar
  maxTurns?: number;             // Max turnos
  criticalSystemReminder_EXPERIMENTAL?: string;
};
```

---

## 4. MCP Client Integration

### Tres formas de conectar MCP servers

#### 1. stdio (proceso local)
```typescript
const options = {
  mcpServers: {
    github: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    }
  },
  allowedTools: ["mcp__github__*"]
};
```

#### 2. HTTP/SSE (servidor remoto)
```typescript
const options = {
  mcpServers: {
    "remote-api": {
      type: "sse",
      url: "https://api.example.com/mcp/sse",
      headers: { Authorization: `Bearer ${token}` }
    }
  },
  allowedTools: ["mcp__remote-api__*"]
};
```

#### 3. SDK MCP Server (in-process)
```typescript
import { tool, createSdkMcpServer, query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const searchProducts = tool(
  "search_products",
  "Search products in the store",
  { query: z.string(), category: z.string().optional() },
  async (args) => {
    const results = await db.products.search(args.query, args.category);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);

const storeServer = createSdkMcpServer({
  name: "store",
  tools: [searchProducts]
});

for await (const msg of query({
  prompt: "Find me black t-shirts",
  options: {
    mcpServers: { store: storeServer },
    allowedTools: ["mcp__store__*"]
  }
})) {
  // ...
}
```

### Tool Naming Convention
```
mcp__<server-name>__<tool-name>
```
Ejemplo: `mcp__github__list_issues`, `mcp__store__search_products`

### Wildcards
```typescript
allowedTools: [
  "mcp__github__*",           // Todas las tools del server github
  "mcp__db__query",           // Solo query del server db
  "mcp__slack__send_message"  // Solo send_message de slack
]
```

### Tool Search (auto-discovery)
Cuando hay muchas MCP tools, el SDK activa automaticamente "tool search" para no saturar el contexto. Se activa cuando las descripciones de tools superan el 10% del context window.

```typescript
env: { ENABLE_TOOL_SEARCH: "auto:5" } // Activar al 5%
```

### Gestion dinamica de MCP servers en runtime
```typescript
const q = query({ prompt: "...", options });

// Reconectar
await q.reconnectMcpServer("github");

// Activar/desactivar
await q.toggleMcpServer("github", false);

// Reemplazar todos los servers
await q.setMcpServers({ newServer: { command: "npx", args: ["..."] } });

// Ver estado
const status = await q.mcpServerStatus();
```

### Configuracion desde archivo (.mcp.json)
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

---

## 5. Patrones de Uso -- Ejemplos Reales

### Bug Finder Agent
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix all security vulnerabilities in the auth module",
  options: {
    allowedTools: ["Read", "Edit", "Glob", "Grep", "Bash"],
    permissionMode: "acceptEdits",
    maxBudgetUsd: 5.0,
    maxTurns: 50
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Multi-Agent Code Review
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Review the entire codebase for quality, security, and performance",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Agent"],
    agents: {
      "security-reviewer": {
        description: "Reviews code for security vulnerabilities",
        prompt: "You are a security expert. Find OWASP Top 10 issues.",
        tools: ["Read", "Glob", "Grep"],
        model: "sonnet"
      },
      "performance-reviewer": {
        description: "Reviews code for performance issues",
        prompt: "You are a performance expert. Find N+1 queries, memory leaks.",
        tools: ["Read", "Glob", "Grep"],
        model: "sonnet"
      }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Agent con Hooks de Auditoria
```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { appendFile } from "fs/promises";

const auditHook: HookCallback = async (input) => {
  const toolInput = (input as any).tool_input;
  await appendFile("./audit.log",
    `${new Date().toISOString()}: ${JSON.stringify(toolInput)}\n`
  );
  return {};
};

const blockDangerousHook: HookCallback = async (input) => {
  const command = (input as any).tool_input?.command ?? "";
  if (command.includes("rm -rf") || command.includes("DROP TABLE")) {
    return {
      decision: "block",
      reason: "Dangerous command blocked by policy"
    };
  }
  return {};
};

for await (const message of query({
  prompt: "Clean up the project",
  options: {
    allowedTools: ["Read", "Edit", "Bash", "Glob"],
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [auditHook] }],
      PreToolUse: [{ matcher: "Bash", hooks: [blockDangerousHook] }]
    }
  }
})) {
  // ...
}
```

### E-Commerce Agent con MCP
```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const searchProducts = tool(
  "search_products",
  "Search products by query and filters",
  {
    query: z.string(),
    category: z.string().optional(),
    maxPrice: z.number().optional()
  },
  async (args) => {
    const products = await supabase
      .from("products")
      .select("*")
      .textSearch("name", args.query)
      .limit(10);
    return { content: [{ type: "text", text: JSON.stringify(products.data) }] };
  }
);

const getOrderStatus = tool(
  "get_order_status",
  "Get the status of an order",
  { orderId: z.string() },
  async (args) => {
    const order = await supabase
      .from("orders")
      .select("*")
      .eq("id", args.orderId)
      .single();
    return { content: [{ type: "text", text: JSON.stringify(order.data) }] };
  }
);

const storeTools = createSdkMcpServer({
  name: "store",
  tools: [searchProducts, getOrderStatus]
});

for await (const msg of query({
  prompt: "Help me find a black hoodie under 50 euros",
  options: {
    mcpServers: { store: storeTools },
    allowedTools: ["mcp__store__*"],
    systemPrompt: "You are a helpful shopping assistant for SKAPARA store."
  }
})) {
  if (msg.type === "result" && msg.subtype === "success") {
    console.log(msg.result);
  }
}
```

---

## 6. Si NO existiera el SDK (contexto historico)

Esto ya no aplica porque el SDK SI existe, pero para referencia:

### Alternativa 1: @anthropic-ai/sdk directo
El SDK base (`@anthropic-ai/sdk`) soporta:
- `toolRunner()` -- loop automatico de herramientas
- `betaZodTool()` -- definicion de tools con Zod
- MCP helpers: `mcpTools()`, `mcpMessages()`
- Streaming con helpers

Pero tu tendrias que:
- Implementar el loop de agente manualmente
- Gestionar estado de conversacion
- Implementar cada herramienta (Read, Write, Edit, Bash, etc.)
- No hay sessions, hooks, subagents, ni permissions built-in

### Alternativa 2: AI SDK de Vercel
`@ai-sdk/anthropic` + `ai` package. Soporta tool calling y streaming pero no tiene el ecosistema de agente autonomo.

---

## 7. Recomendacion: Python vs TypeScript para nuestro caso

### Contexto del proyecto
- **Stack actual**: Frontend en Next.js (TypeScript), Backend de agentes en Python (PodClaw con Claude Agent SDK Python)
- **Caso de uso**: E-commerce agent con MCP servers, Supabase, Stripe, Printful

### Tabla comparativa para NUESTRO caso

| Criterio | Python | TypeScript | Ganador |
|---|---|---|---|
| **Feature parity** | Completo | Completo + V2 preview | TS (ligeramente) |
| **MCP integration** | Identica | Identica + gestion dinamica runtime | TS |
| **Stack alignment** | Requiere servicio separado (FastAPI bridge) | Mismo runtime que frontend (Next.js) | **TS** |
| **Deploy simplicity** | Imagen Docker separada (podclaw) | Podria integrar en frontend o servicio Node | **TS** |
| **ClaudeSDKClient** | Si (conversaciones persistentes) | No en V1, V2 preview tiene sessions | Python |
| **Madurez** | Mas tiempo en produccion | Igual de maduro (0.2.72) | Empate |
| **Community/Docs** | Excelente | Excelente | Empate |
| **Custom Transport** | Si (para remote execution) | No documentado | Python |
| **Licencia** | Propietaria | Propietaria | Empate |
| **Ecosistema de herramientas** | Identico (Read, Write, Edit, Bash, Glob, Grep) | Identico | Empate |
| **Schema validation** | Dict/JSON Schema | Zod (type-safe, mejor DX) | **TS** |

### Recomendacion

**Para un NUEVO proyecto**: TypeScript. Elimina la complejidad del bridge Python-Node, comparte tipos con el frontend, y tiene ligeramente mas features en el objeto Query.

**Para NUESTRO proyecto (PodClaw existente)**: Mantener Python a corto plazo. La migracion a TypeScript seria beneficiosa pero no urgente. PodClaw ya funciona con 9 agentes configurados, skills, memory system, y bridge API.

**Plan de migracion sugerido (si se decide migrar)**:
1. Crear nuevo servicio TS con `@anthropic-ai/claude-agent-sdk`
2. Migrar tools como MCP servers (in-process con `createSdkMcpServer`)
3. Mantener misma arquitectura de agentes (AgentDefinition es identica)
4. Migrar hooks de Python a TypeScript (mismo concepto)
5. Eliminar bridge FastAPI -- el servicio Node puede servir directamente
6. Beneficio: un solo runtime (Node.js) para todo el stack

### Factores clave para la decision
- Si la prioridad es **reducir complejidad operacional** -> Migrar a TS
- Si la prioridad es **estabilidad y no romper lo que funciona** -> Mantener Python
- Si se planea **escalar con mas MCP servers** -> TS tiene mejor gestion runtime
- Si se necesita **ClaudeSDKClient para conversaciones persistentes** -> Python (o esperar V2 estable en TS)

---

## Sources

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [TypeScript SDK Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [TypeScript V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [Python SDK Reference](https://platform.claude.com/docs/en/agent-sdk/python)
- [MCP Integration Guide](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [GitHub: claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [npm: @anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- [GitHub: anthropic-sdk-typescript](https://github.com/anthropics/anthropic-sdk-typescript)
- [Example Agents](https://github.com/anthropics/claude-agent-sdk-demos)
