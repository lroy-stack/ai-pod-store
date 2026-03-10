# Claude Agent SDK para Python - Referencia Tecnica Exhaustiva

> **Fecha**: 2026-03-09
> **Version SDK**: 0.1.48 (Released 2026-03-07)
> **Status**: Alpha (3 - Alpha)
> **Licencia**: MIT (gobernado por Anthropic Commercial Terms of Service)
> **Fuentes**: Documentacion oficial de Anthropic (platform.claude.com), GitHub, PyPI, Engineering Blog

---

## Tabla de Contenidos

1. [Instalacion y Setup](#1-instalacion-y-setup)
2. [Arquitectura General](#2-arquitectura-general)
3. [Conceptos Core](#3-conceptos-core)
4. [API Surface - query() y ClaudeSDKClient](#4-api-surface)
5. [ClaudeAgentOptions - Configuracion Completa](#5-claudeagentoptions)
6. [Tool System](#6-tool-system)
7. [Custom Tools (In-Process MCP Servers)](#7-custom-tools)
8. [Hook System](#8-hook-system)
9. [MCP Client Integration](#9-mcp-client-integration)
10. [Sub-agentes](#10-sub-agentes)
11. [Session Management](#11-session-management)
12. [Streaming](#12-streaming)
13. [Structured Outputs](#13-structured-outputs)
14. [Permissions y Security](#14-permissions-y-security)
15. [Agent Loop - Ciclo de Ejecucion](#15-agent-loop)
16. [Message Types Completos](#16-message-types)
17. [Error Handling](#17-error-handling)
18. [Hosting y Deploy](#18-hosting-y-deploy)
19. [SDK de TypeScript](#19-sdk-typescript)
20. [Patrones Avanzados](#20-patrones-avanzados)
21. [Migracion desde Claude Code SDK](#21-migracion)

---

## 1. Instalacion y Setup

### Requisitos

- **Python**: 3.10+ (soporta 3.10, 3.11, 3.12, 3.13)
- **Node.js**: 18+ (requerido por el CLI de Claude Code que se bundlea)
- **API Key**: `ANTHROPIC_API_KEY` como variable de entorno

### Instalacion

```bash
# Con pip
python3 -m venv .venv && source .venv/bin/activate
pip3 install claude-agent-sdk

# Con uv (recomendado)
uv init && uv add claude-agent-sdk
```

El **Claude Code CLI se bundlea automaticamente** con el paquete. No requiere instalacion separada.

Opcionalmente se puede instalar el CLI por separado:
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

O usar un path custom:
```python
ClaudeAgentOptions(cli_path="/path/to/claude")
```

### Configuracion de API Key

```bash
export ANTHROPIC_API_KEY=your-api-key
```

**Proveedores alternativos soportados**:
- **Amazon Bedrock**: `CLAUDE_CODE_USE_BEDROCK=1` + credenciales AWS
- **Google Vertex AI**: `CLAUDE_CODE_USE_VERTEX=1` + credenciales Google Cloud
- **Microsoft Azure**: `CLAUDE_CODE_USE_FOUNDRY=1` + credenciales Azure

### Paquetes en PyPI

| Paquete | Proposito |
|---------|-----------|
| `claude-agent-sdk` | SDK de agentes (este documento) |
| `anthropic` | Client SDK directo para la API REST |

**IMPORTANTE**: `claude-agent-sdk` != `anthropic`. El Agent SDK es un wrapper de alto nivel que incluye el agent loop, tools, hooks, y el CLI. El Client SDK (`anthropic`) es acceso directo a la API donde tu implementas el tool loop.

---

## 2. Arquitectura General

### Diferencia fundamental con el Client SDK

```python
# Client SDK: TU implementas el tool loop
response = client.messages.create(...)
while response.stop_reason == "tool_use":
    result = your_tool_executor(response.tool_use)
    response = client.messages.create(tool_result=result, **params)

# Agent SDK: Claude maneja tools autonomamente
async for message in query(prompt="Fix the bug in auth.py"):
    print(message)
```

### Como funciona internamente

El SDK ejecuta el **mismo agentic loop que Claude Code**:

1. **Recibe prompt** - Claude recibe prompt + system prompt + tool definitions + historial
2. **Evalua y responde** - Claude decide la accion: texto, tool calls, o ambos
3. **Ejecuta tools** - El SDK ejecuta cada tool y recopila resultados
4. **Repite** - Pasos 2-3 se repiten (cada ciclo = 1 turn)
5. **Retorna resultado** - Cuando Claude no necesita mas tools, retorna ResultMessage

### Diagrama de flujo

```
prompt --> [Claude evalua] --> tool calls?
                                  |
                    SI: ejecutar tools --> feedback a Claude --> repetir
                    NO: retornar resultado final
```

### Renombramiento

El SDK fue renombrado de **Claude Code SDK** a **Claude Agent SDK** a finales de 2025, reflejando que ya no es solo un asistente de codigo sino un runtime de agentes de proposito general.

---

## 3. Conceptos Core

### Agent
Un agente autonomo que puede leer archivos, ejecutar comandos, buscar en la web, editar codigo, y mas. Usa el mismo agent loop que Claude Code.

### Tool
Capacidad que el agente puede usar: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, Agent, etc. Tambien custom tools via MCP.

### Hook
Callback function que se ejecuta en puntos especificos del agent loop (PreToolUse, PostToolUse, Stop, etc.). Permite validar, bloquear, modificar, o auditar comportamiento.

### Session
Historial de conversacion que el SDK acumula mientras el agente trabaja. Se persiste a disco automaticamente. Se puede resumir, forkear, o continuar.

### Subagent
Instancia separada de agente que el agente principal puede spawnear para subtareas focalizadas. Context isolado, tools restringidos, posible paralelismo.

### MCP (Model Context Protocol)
Estandar abierto para conectar agentes a tools externos: bases de datos, APIs, browsers, y cientos mas.

---

## 4. API Surface

### Dos interfaces principales

| Feature | `query()` | `ClaudeSDKClient` |
|---------|-----------|-------------------|
| **Session** | Nueva sesion cada vez | Reutiliza misma sesion |
| **Conversacion** | Intercambio unico | Multiples intercambios en mismo contexto |
| **Conexion** | Automatica | Control manual |
| **Streaming Input** | Soportado | Soportado |
| **Interrupts** | NO soportado | Soportado |
| **Hooks** | Soportado | Soportado |
| **Custom Tools** | Soportado | Soportado |
| **Continue Chat** | No (nueva cada vez) | Si (mantiene conversacion) |
| **Caso de uso** | Tareas one-off | Conversaciones continuas |

### 4.1 `query()` - One-Shot Queries

```python
async def query(
    *,
    prompt: str | AsyncIterable[dict[str, Any]],
    options: ClaudeAgentOptions | None = None,
    transport: Transport | None = None
) -> AsyncIterator[Message]
```

**Parametros**:
| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `prompt` | `str \| AsyncIterable[dict]` | Prompt como string o async iterable para streaming |
| `options` | `ClaudeAgentOptions \| None` | Configuracion (defaults a `ClaudeAgentOptions()`) |
| `transport` | `Transport \| None` | Transporte custom para comunicacion con CLI |

**Ejemplo basico**:
```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Find all TODO comments and create a summary",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Glob", "Grep"]),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

**Ejemplo con opciones completas**:
```python
options = ClaudeAgentOptions(
    system_prompt="You are an expert Python developer",
    permission_mode="acceptEdits",
    cwd="/home/user/project",
    allowed_tools=["Read", "Edit", "Glob", "Grep", "Bash"],
    max_turns=30,
    max_budget_usd=0.50,
    effort="high",
)

async for message in query(prompt="Create a Python web server", options=options):
    print(message)
```

### 4.2 `ClaudeSDKClient` - Conversaciones Interactivas

```python
class ClaudeSDKClient:
    def __init__(self, options: ClaudeAgentOptions | None = None, transport: Transport | None = None)
    async def connect(self, prompt: str | AsyncIterable[dict] | None = None) -> None
    async def query(self, prompt: str | AsyncIterable[dict], session_id: str = "default") -> None
    async def receive_messages(self) -> AsyncIterator[Message]
    async def receive_response(self) -> AsyncIterator[Message]
    async def interrupt(self) -> None
    async def set_permission_mode(self, mode: str) -> None
    async def set_model(self, model: str | None = None) -> None
    async def rewind_files(self, user_message_id: str) -> None
    async def get_mcp_status(self) -> list[McpServerStatus]
    async def add_mcp_server(self, name: str, config: McpServerConfig) -> None
    async def remove_mcp_server(self, name: str) -> None
    async def get_server_info(self) -> dict[str, Any] | None
    async def disconnect(self) -> None
```

**Metodos clave**:
| Metodo | Descripcion |
|--------|-------------|
| `connect(prompt)` | Conectar a Claude con prompt inicial opcional |
| `query(prompt)` | Enviar nueva consulta en modo streaming |
| `receive_response()` | Recibir mensajes hasta ResultMessage |
| `interrupt()` | Interrumpir ejecucion (solo streaming) |
| `set_permission_mode(mode)` | Cambiar modo de permisos mid-session |
| `set_model(model)` | Cambiar modelo mid-session |
| `rewind_files(id)` | Revertir archivos a un estado anterior (requiere `enable_file_checkpointing=True`) |
| `get_mcp_status()` | Estado de MCP servers conectados |
| `add_mcp_server(name, config)` | Agregar MCP server en runtime |
| `remove_mcp_server(name)` | Remover MCP server en runtime |

**Ejemplo - Conversacion multi-turn**:
```python
import asyncio
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions, AssistantMessage, TextBlock

async def main():
    options = ClaudeAgentOptions(
        allowed_tools=["Read", "Edit", "Glob", "Grep"],
    )

    async with ClaudeSDKClient(options=options) as client:
        # Primera consulta
        await client.query("Analyze the auth module")
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")

        # Segunda consulta - mantiene contexto
        await client.query("Now refactor it to use JWT")
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")

asyncio.run(main())
```

**Ejemplo - Interrupts**:
```python
async def interruptible_task():
    options = ClaudeAgentOptions(allowed_tools=["Bash"], permission_mode="acceptEdits")

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Count from 1 to 100 slowly")
        await asyncio.sleep(2)
        await client.interrupt()
        print("Task interrupted!")

        await client.query("Just say hello instead")
        async for message in client.receive_response():
            pass
```

**Ejemplo - Permiso custom con `can_use_tool`**:
```python
from claude_agent_sdk.types import (
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)

async def custom_permission_handler(
    tool_name: str, input_data: dict, context: ToolPermissionContext
) -> PermissionResultAllow | PermissionResultDeny:
    # Bloquear escrituras a directorios sistema
    if tool_name == "Write" and input_data.get("file_path", "").startswith("/system/"):
        return PermissionResultDeny(message="System directory write not allowed", interrupt=True)

    # Redirigir operaciones sensibles a sandbox
    if tool_name in ["Write", "Edit"] and "config" in input_data.get("file_path", ""):
        safe_path = f"./sandbox/{input_data['file_path']}"
        return PermissionResultAllow(updated_input={**input_data, "file_path": safe_path})

    return PermissionResultAllow(updated_input=input_data)

options = ClaudeAgentOptions(
    can_use_tool=custom_permission_handler,
    allowed_tools=["Read", "Write", "Edit"],
)
```

---

## 5. ClaudeAgentOptions - Configuracion Completa

```python
@dataclass
class ClaudeAgentOptions:
    # --- Tools ---
    tools: list[str] | ToolsPreset | None = None
    allowed_tools: list[str] = field(default_factory=list)
    disallowed_tools: list[str] = field(default_factory=list)

    # --- Prompts ---
    system_prompt: str | SystemPromptPreset | None = None

    # --- MCP ---
    mcp_servers: dict[str, McpServerConfig] | str | Path = field(default_factory=dict)

    # --- Permissions ---
    permission_mode: PermissionMode | None = None
    can_use_tool: CanUseTool | None = None
    permission_prompt_tool_name: str | None = None

    # --- Session ---
    continue_conversation: bool = False
    resume: str | None = None
    fork_session: bool = False

    # --- Limits ---
    max_turns: int | None = None
    max_budget_usd: float | None = None

    # --- Model ---
    model: str | None = None
    fallback_model: str | None = None
    effort: Literal["low", "medium", "high", "max"] | None = None

    # --- Thinking ---
    thinking: ThinkingConfig | None = None
    max_thinking_tokens: int | None = None  # Deprecated: use thinking

    # --- Output ---
    output_format: dict[str, Any] | None = None
    include_partial_messages: bool = False

    # --- Subagents ---
    agents: dict[str, AgentDefinition] | None = None

    # --- Hooks ---
    hooks: dict[HookEvent, list[HookMatcher]] | None = None

    # --- Settings ---
    setting_sources: list[SettingSource] | None = None
    settings: str | None = None

    # --- Environment ---
    cwd: str | Path | None = None
    cli_path: str | Path | None = None
    add_dirs: list[str | Path] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    extra_args: dict[str, str | None] = field(default_factory=dict)

    # --- Plugins ---
    plugins: list[SdkPluginConfig] = field(default_factory=list)

    # --- Sandbox ---
    sandbox: SandboxSettings | None = None

    # --- File Checkpointing ---
    enable_file_checkpointing: bool = False

    # --- Betas ---
    betas: list[SdkBeta] = field(default_factory=list)

    # --- Other ---
    user: str | None = None
    max_buffer_size: int | None = None
    stderr: Callable[[str], None] | None = None
    debug_stderr: Any = sys.stderr  # Deprecated
```

### Campos detallados

| Campo | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `tools` | `list[str] \| ToolsPreset \| None` | `None` | Config de tools. `{"type": "preset", "preset": "claude_code"}` para defaults |
| `allowed_tools` | `list[str]` | `[]` | Tools auto-aprobados sin prompting. NO restringe a solo estos; usa `disallowed_tools` para bloquear |
| `disallowed_tools` | `list[str]` | `[]` | Tools SIEMPRE denegados. Prevalecen sobre todo, incluyendo `bypassPermissions` |
| `system_prompt` | `str \| SystemPromptPreset \| None` | `None` | Prompt custom o preset `claude_code` con opcion `append` |
| `mcp_servers` | `dict[str, McpServerConfig] \| str \| Path` | `{}` | Servidores MCP o path a config |
| `permission_mode` | `PermissionMode` | `None` | `"default"`, `"acceptEdits"`, `"plan"`, `"bypassPermissions"` |
| `continue_conversation` | `bool` | `False` | Continuar la conversacion mas reciente |
| `resume` | `str \| None` | `None` | Session ID para resumir |
| `fork_session` | `bool` | `False` | Forkear sesion al resumir |
| `max_turns` | `int \| None` | `None` | Maximo de turns con tool-use |
| `max_budget_usd` | `float \| None` | `None` | Presupuesto maximo en USD |
| `model` | `str \| None` | `None` | Modelo Claude a usar (ej: `"claude-sonnet-4-6"`) |
| `fallback_model` | `str \| None` | `None` | Modelo de fallback |
| `effort` | `Literal["low","medium","high","max"]` | `None` | Profundidad de razonamiento |
| `thinking` | `ThinkingConfig \| None` | `None` | Config de extended thinking |
| `output_format` | `dict` | `None` | `{"type": "json_schema", "schema": {...}}` para structured outputs |
| `include_partial_messages` | `bool` | `False` | Habilitar streaming de StreamEvents |
| `agents` | `dict[str, AgentDefinition]` | `None` | Subagentes definidos programaticamente |
| `hooks` | `dict[HookEvent, list[HookMatcher]]` | `None` | Hooks para interceptar eventos |
| `setting_sources` | `list[SettingSource]` | `None` | `["user", "project", "local"]` para cargar settings del filesystem |
| `cwd` | `str \| Path` | `None` | Working directory |
| `env` | `dict[str, str]` | `{}` | Variables de entorno |
| `sandbox` | `SandboxSettings` | `None` | Config de sandbox |
| `enable_file_checkpointing` | `bool` | `False` | Habilitar tracking de cambios para rewind |
| `can_use_tool` | `CanUseTool` | `None` | Callback de permisos custom |
| `plugins` | `list[SdkPluginConfig]` | `[]` | Plugins locales |

### System Prompt Preset

```python
# Custom prompt
options = ClaudeAgentOptions(system_prompt="You are a senior Python developer.")

# Preset de Claude Code con append
options = ClaudeAgentOptions(
    system_prompt={
        "type": "preset",
        "preset": "claude_code",
        "append": "Always follow PEP 8 style guidelines."
    }
)
```

### Thinking Config

```python
# Adaptativo (Claude decide cuando pensar)
thinking={"type": "adaptive"}

# Habilitado con budget de tokens
thinking={"type": "enabled", "budget_tokens": 10000}

# Deshabilitado
thinking={"type": "disabled"}
```

### Effort Level

| Nivel | Comportamiento | Caso de uso |
|-------|---------------|-------------|
| `"low"` | Razonamiento minimo, respuestas rapidas | Buscar archivos, listar directorios |
| `"medium"` | Razonamiento balanceado | Ediciones rutinarias |
| `"high"` | Analisis profundo | Refactors, debugging |
| `"max"` | Maxima profundidad | Problemas multi-step complejos |

---

## 6. Tool System

### Built-in Tools

| Categoria | Tools | Funcion |
|-----------|-------|---------|
| **Archivos** | `Read`, `Edit`, `Write` | Leer, modificar, crear archivos |
| **Busqueda** | `Glob`, `Grep` | Buscar archivos por patron, contenido con regex |
| **Ejecucion** | `Bash` | Ejecutar comandos shell, scripts, git |
| **Web** | `WebSearch`, `WebFetch` | Buscar en web, fetch y parse de paginas |
| **Discovery** | `ToolSearch` | Cargar tools on-demand dinamicamente |
| **Orquestacion** | `Agent`, `Skill`, `AskUserQuestion`, `TodoWrite` | Subagentes, skills, preguntas al usuario, tareas |

### Tool Permissions

```python
# Auto-aprobar tools especificos (read-only)
allowed_tools=["Read", "Glob", "Grep"]

# Bloquear tools (prevalece sobre todo)
disallowed_tools=["Bash"]

# Scoping de tools con reglas
allowed_tools=["Bash(npm:*)"]  # Solo comandos npm
```

### Ejecucion Paralela de Tools

Cuando Claude pide multiples tool calls en un turn:
- **Read-only tools** (Read, Glob, Grep, MCP read-only): ejecutan concurrentemente
- **Write tools** (Edit, Write, Bash): ejecutan secuencialmente

Custom tools default a secuencial. Para habilitar paralelismo, marcar como read-only:
```python
@tool("my_tool", "...", {...}, annotations=ToolAnnotations(readOnlyHint=True))
```

---

## 7. Custom Tools (In-Process MCP Servers)

### Concepto

Custom tools se implementan como **in-process MCP servers** que ejecutan directamente en tu proceso Python, eliminando la necesidad de procesos separados.

**Ventajas sobre MCP servers externos**:
- Sin gestion de subprocesos
- Mejor performance (sin IPC overhead)
- Deploy mas simple (un solo proceso Python)
- Debugging mas facil
- Type safety con Python types

### `@tool` Decorator

```python
def tool(
    name: str,
    description: str,
    input_schema: type | dict[str, Any],
    annotations: ToolAnnotations | None = None
) -> Callable[[Callable[[Any], Awaitable[dict[str, Any]]]], SdkMcpTool[Any]]
```

**Input Schema - Dos formas**:

1. **Simple type mapping** (recomendado):
```python
{"name": str, "age": int, "enabled": bool, "items": list}
```

2. **JSON Schema** (para validacion compleja):
```python
{
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer", "minimum": 0, "maximum": 150},
        "format": {"type": "string", "enum": ["json", "csv", "xml"]},
    },
    "required": ["name", "age"],
}
```

### `create_sdk_mcp_server()`

```python
def create_sdk_mcp_server(
    name: str,
    version: str = "1.0.0",
    tools: list[SdkMcpTool[Any]] | None = None
) -> McpSdkServerConfig
```

### Ejemplo Completo

```python
from claude_agent_sdk import (
    tool, create_sdk_mcp_server, ClaudeSDKClient, ClaudeAgentOptions,
)
from typing import Any
import aiohttp

@tool(
    "get_weather",
    "Get current temperature for a location",
    {"latitude": float, "longitude": float},
)
async def get_weather(args: dict[str, Any]) -> dict[str, Any]:
    async with aiohttp.ClientSession() as session:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={args['latitude']}&longitude={args['longitude']}&current=temperature_2m"
        async with session.get(url) as response:
            data = await response.json()
    return {
        "content": [
            {"type": "text", "text": f"Temperature: {data['current']['temperature_2m']}"}
        ]
    }

# Crear servidor MCP in-process
weather_server = create_sdk_mcp_server(
    name="weather",
    version="1.0.0",
    tools=[get_weather],
)

# Usar con Claude
options = ClaudeAgentOptions(
    mcp_servers={"weather": weather_server},
    allowed_tools=["mcp__weather__get_weather"],
)

async with ClaudeSDKClient(options=options) as client:
    await client.query("What's the weather in San Francisco?")
    async for msg in client.receive_response():
        print(msg)
```

### Tool Name Format

Pattern: `mcp__{server_name}__{tool_name}`

Ejemplo: tool `get_weather` en server `my-tools` -> `mcp__my-tools__get_weather`

### Mixed Server Support

```python
options = ClaudeAgentOptions(
    mcp_servers={
        "internal": sdk_server,           # In-process SDK server
        "external": {                      # External subprocess server
            "type": "stdio",
            "command": "external-server",
        },
    }
)
```

### Tool Annotations

```python
from mcp.types import ToolAnnotations

@tool(
    "safe_read",
    "Read-only data access",
    {"query": str},
    annotations=ToolAnnotations(
        readOnlyHint=True,       # Permite ejecucion paralela
        destructiveHint=False,   # No destructivo
        openWorldHint=False,     # No accede a recursos externos
    ),
)
```

---

## 8. Hook System

### Concepto

Hooks son callback functions que ejecutan TU codigo en respuesta a eventos del agente. Hooks ejecutan en tu proceso, NO dentro del context window del agente (no consumen contexto).

### Hooks Disponibles

| Hook Event | Python SDK | Trigger | Caso de uso |
|-----------|-----------|---------|-------------|
| `PreToolUse` | Si | Antes de ejecutar tool | Bloquear comandos peligrosos |
| `PostToolUse` | Si | Despues de ejecutar tool | Auditar cambios |
| `PostToolUseFailure` | Si | Tool fallo | Manejar/log errores |
| `UserPromptSubmit` | Si | Prompt del usuario | Inyectar contexto |
| `Stop` | Si | Agente termina | Guardar estado |
| `SubagentStart` | Si | Subagente inicia | Tracking de tareas |
| `SubagentStop` | Si | Subagente termina | Agregar resultados |
| `PreCompact` | Si | Antes de compactacion | Archivar transcript |
| `Notification` | Si | Mensajes de status | Enviar a Slack/PagerDuty |
| `PermissionRequest` | Si | Dialogo de permiso | Custom permission handling |
| `SessionStart` | **NO** (solo TS) | Sesion inicia | Init logging |
| `SessionEnd` | **NO** (solo TS) | Sesion termina | Cleanup |

### HookMatcher

```python
@dataclass
class HookMatcher:
    matcher: str | None = None     # Regex pattern (ej: "Bash", "Write|Edit", "^mcp__")
    hooks: list[HookCallback] = field(default_factory=list)
    timeout: float | None = None   # Timeout en segundos (default: 60)
```

### HookCallback Signature

```python
HookCallback = Callable[
    [HookInput, str | None, HookContext],
    Awaitable[HookJSONOutput]
]
```

**Parametros**:
1. `input_data` - Datos del evento (tipado segun hook type)
2. `tool_use_id` - ID para correlacionar PreToolUse/PostToolUse del mismo tool call
3. `context` - Contexto adicional (reservado para uso futuro en Python)

### HookInput Types

```python
HookInput = (
    PreToolUseHookInput      # tool_name, tool_input, tool_use_id
    | PostToolUseHookInput   # tool_name, tool_input, tool_response, tool_use_id
    | PostToolUseFailureHookInput  # tool_name, tool_input, error, is_interrupt
    | UserPromptSubmitHookInput    # prompt
    | StopHookInput               # stop_hook_active
    | SubagentStopHookInput       # agent_id, agent_transcript_path, agent_type
    | PreCompactHookInput          # trigger ("manual"|"auto"), custom_instructions
    | NotificationHookInput        # message, title, notification_type
    | SubagentStartHookInput       # agent_id, agent_type
    | PermissionRequestHookInput   # tool_name, tool_input, permission_suggestions
)
```

**Base fields en todos los inputs**: `session_id`, `transcript_path`, `cwd`, `permission_mode`

### Hook Output

```python
class SyncHookJSONOutput(TypedDict):
    # Control
    continue_: NotRequired[bool]        # Continuar ejecucion (default: True)
    suppressOutput: NotRequired[bool]   # Ocultar stdout del transcript
    stopReason: NotRequired[str]        # Mensaje cuando continue es False

    # Decision
    decision: NotRequired[Literal["block"]]
    systemMessage: NotRequired[str]     # Mensaje para Claude
    reason: NotRequired[str]            # Feedback para Claude

    # Hook-specific
    hookSpecificOutput: NotRequired[HookSpecificOutput]
```

**HookSpecificOutput para PreToolUse**:
```python
{
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow" | "deny" | "ask",
    "permissionDecisionReason": "Reason string",
    "updatedInput": {...}  # Input modificado (requiere permissionDecision: "allow")
}
```

**Prioridad de decisiones**: `deny` > `ask` > `allow`

### Ejemplo - Proteger archivos .env

```python
async def protect_env_files(input_data, tool_use_id, context):
    file_path = input_data["tool_input"].get("file_path", "")
    if file_path.split("/")[-1] == ".env":
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "deny",
                "permissionDecisionReason": "Cannot modify .env files",
            }
        }
    return {}

options = ClaudeAgentOptions(
    hooks={
        "PreToolUse": [HookMatcher(matcher="Write|Edit", hooks=[protect_env_files])]
    }
)
```

### Ejemplo - Redirigir escrituras a sandbox

```python
async def redirect_to_sandbox(input_data, tool_use_id, context):
    if input_data["tool_name"] == "Write":
        original_path = input_data["tool_input"].get("file_path", "")
        return {
            "hookSpecificOutput": {
                "hookEventName": input_data["hook_event_name"],
                "permissionDecision": "allow",
                "updatedInput": {
                    **input_data["tool_input"],
                    "file_path": f"/sandbox{original_path}",
                },
            }
        }
    return {}
```

### Ejemplo - Webhook async (no bloquea al agente)

```python
async def async_hook(input_data, tool_use_id, context):
    asyncio.create_task(send_to_logging_service(input_data))
    return {"async_": True, "asyncTimeout": 30000}
```

### Encadenamiento de Hooks

```python
options = ClaudeAgentOptions(
    hooks={
        "PreToolUse": [
            HookMatcher(hooks=[rate_limiter]),         # 1. Rate limits
            HookMatcher(hooks=[authorization_check]),   # 2. Permisos
            HookMatcher(hooks=[input_sanitizer]),       # 3. Sanitizar
            HookMatcher(hooks=[audit_logger]),           # 4. Auditar
        ]
    }
)
```

### Matchers con Regex

```python
hooks={
    "PreToolUse": [
        HookMatcher(matcher="Write|Edit|Delete", hooks=[file_security_hook]),  # Mod tools
        HookMatcher(matcher="^mcp__", hooks=[mcp_audit_hook]),                 # All MCP
        HookMatcher(hooks=[global_logger]),                                      # Todo
    ]
}
```

---

## 9. MCP Client Integration

### Concepto

MCP (Model Context Protocol) es un estandar abierto para conectar agentes a tools y data sources externos. Con MCP, el agente puede query DBs, integrar con APIs (Slack, GitHub, etc.) sin escribir implementaciones custom.

### Tipos de Transporte

| Tipo | Uso | Config |
|------|-----|--------|
| **stdio** | Procesos locales via stdin/stdout | `command`, `args`, `env` |
| **SSE** | Servers remotos (streaming) | `type: "sse"`, `url`, `headers` |
| **HTTP** | Servers remotos (no-streaming) | `type: "http"`, `url`, `headers` |
| **SDK** | In-process (custom tools) | Via `create_sdk_mcp_server()` |

### Configurar MCP Servers

**En codigo**:
```python
options = ClaudeAgentOptions(
    mcp_servers={
        # stdio (proceso local)
        "github": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-github"],
            "env": {"GITHUB_TOKEN": os.environ["GITHUB_TOKEN"]},
        },
        # SSE (server remoto)
        "remote-api": {
            "type": "sse",
            "url": "https://api.example.com/mcp/sse",
            "headers": {"Authorization": f"Bearer {os.environ['API_TOKEN']}"},
        },
        # HTTP (server remoto, no-streaming)
        "docs": {
            "type": "http",
            "url": "https://code.claude.com/docs/mcp",
        },
        # SDK (in-process)
        "custom": my_sdk_server,
    },
    allowed_tools=["mcp__github__*", "mcp__remote-api__*"],
)
```

**Desde archivo `.mcp.json`** (se carga automaticamente):
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Tool Naming Convention

Pattern: `mcp__<server-name>__<tool-name>`

- Wildcards: `mcp__github__*` permite todos los tools de github server
- Especifico: `mcp__db__query` solo permite query tool

### MCP Tool Search

Cuando hay muchos MCP tools, las definiciones pueden consumir mucho context window. Tool search carga tools on-demand:

```python
options = ClaudeAgentOptions(
    env={"ENABLE_TOOL_SEARCH": "auto:5"},  # Activar al 5% del context
)
```

| Valor | Comportamiento |
|-------|---------------|
| `auto` | Activa cuando MCP tools superan 10% del context (default) |
| `auto:5` | Activa al 5% |
| `true` | Siempre habilitado |
| `false` | Deshabilitado, todos los tools cargados upfront |

Requiere modelos Sonnet 4+ u Opus 4+. Haiku NO soporta tool search.

### Verificar Conexion MCP

```python
async for message in query(prompt="...", options=options):
    if isinstance(message, SystemMessage) and message.subtype == "init":
        failed_servers = [
            s for s in message.data.get("mcp_servers", [])
            if s.get("status") != "connected"
        ]
        if failed_servers:
            print(f"Failed to connect: {failed_servers}")
```

### McpServerConfig Types

```python
# stdio
class McpStdioServerConfig(TypedDict):
    type: NotRequired[Literal["stdio"]]
    command: str
    args: NotRequired[list[str]]
    env: NotRequired[dict[str, str]]

# SSE
class McpSSEServerConfig(TypedDict):
    type: Literal["sse"]
    url: str
    headers: NotRequired[dict[str, str]]

# HTTP
class McpHttpServerConfig(TypedDict):
    type: Literal["http"]
    url: str
    headers: NotRequired[dict[str, str]]

# SDK (in-process)
class McpSdkServerConfig(TypedDict):
    type: Literal["sdk"]
    name: str
    instance: Any
```

---

## 10. Sub-agentes

### Concepto

Subagentes son instancias separadas de agente que el agente principal spawea para subtareas. Beneficios:
- **Context isolation**: Cada subagente tiene conversacion fresca
- **Paralelizacion**: Multiples subagentes pueden ejecutar concurrentemente
- **Instrucciones especializadas**: System prompts adaptados por expertise
- **Tools restringidos**: Menor riesgo de acciones no intencionadas

### Tres formas de crear subagentes

1. **Programatico** (recomendado para SDK): parametro `agents` en `ClaudeAgentOptions`
2. **Filesystem**: archivos markdown en `.claude/agents/`
3. **Built-in**: `general-purpose` subagent disponible automaticamente con `Agent` en `allowedTools`

### AgentDefinition

```python
@dataclass
class AgentDefinition:
    description: str                                            # Cuando usar este agente
    prompt: str                                                 # System prompt del agente
    tools: list[str] | None = None                              # Tools (None = hereda todos)
    model: Literal["sonnet", "opus", "haiku", "inherit"] | None = None  # Override de modelo
```

**IMPORTANTE**: Subagentes NO pueden spawnear sus propios subagentes. No incluir `Agent` en tools de un subagent.

### Ejemplo

```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition

async for message in query(
    prompt="Review the authentication module for security issues",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Grep", "Glob", "Agent"],  # Agent REQUERIDO
        agents={
            "code-reviewer": AgentDefinition(
                description="Expert code review specialist for security reviews.",
                prompt="""You are a code review specialist with expertise in security.
Identify vulnerabilities, check for performance issues, suggest improvements.""",
                tools=["Read", "Grep", "Glob"],  # Read-only
                model="sonnet",
            ),
            "test-runner": AgentDefinition(
                description="Runs and analyzes test suites.",
                prompt="You are a test execution specialist. Run tests and analyze results.",
                tools=["Bash", "Read", "Grep"],  # Puede ejecutar
            ),
        },
    ),
):
    if hasattr(message, "result"):
        print(message.result)
```

### Lo que hereda un subagente

| Recibe | NO Recibe |
|--------|-----------|
| Su propio system prompt | Historial de conversacion del padre |
| Prompt del Agent tool | Tool results previos del padre |
| Project CLAUDE.md (via settingSources) | System prompt del padre |
| Tool definitions (heredados o subset) | Skills (excepto si listados explicitamente en TS) |

### Invocacion

- **Automatica**: Claude decide basado en `description`
- **Explicita**: `"Use the code-reviewer agent to check the auth module"`

### Combinaciones de Tools Comunes

| Caso de uso | Tools |
|-------------|-------|
| Analisis read-only | `Read`, `Grep`, `Glob` |
| Ejecucion de tests | `Bash`, `Read`, `Grep` |
| Modificacion de codigo | `Read`, `Edit`, `Write`, `Grep`, `Glob` |
| Acceso completo | Todos (omitir `tools`) |

### Detectar Invocacion de Subagente

```python
async for message in query(prompt="...", options=options):
    if hasattr(message, "content") and message.content:
        for block in message.content:
            if getattr(block, "type", None) == "tool_use" and block.name in ("Task", "Agent"):
                print(f"Subagent invoked: {block.input.get('subagent_type')}")

    if hasattr(message, "parent_tool_use_id") and message.parent_tool_use_id:
        print("  (running inside subagent)")
```

### Dynamic Agent Configuration

```python
def create_security_agent(level: str) -> AgentDefinition:
    is_strict = level == "strict"
    return AgentDefinition(
        description="Security code reviewer",
        prompt=f"You are a {'strict' if is_strict else 'balanced'} security reviewer...",
        tools=["Read", "Grep", "Glob"],
        model="opus" if is_strict else "sonnet",
    )

agents={"security-reviewer": create_security_agent("strict")}
```

### Resumir Subagentes

Los subagentes pueden ser resumidos para continuar donde quedaron. El transcript persiste independientemente de la conversacion principal.

---

## 11. Session Management

### Concepto

Una session es el historial de conversacion que el SDK acumula. Contiene: prompt, cada tool call, cada tool result, cada response. Se escribe a disco automaticamente.

### Session Storage

Sessions se almacenan en: `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`

Donde `<encoded-cwd>` es el directorio absoluto con caracteres no-alfanumericos reemplazados por `-`.

### Tres Operaciones

| Operacion | Como | Uso |
|-----------|------|-----|
| **Continue** | `continue_conversation=True` | Mas reciente en el directorio. No rastrear IDs |
| **Resume** | `resume=session_id` | Session especifica por ID. Rastrear IDs |
| **Fork** | `resume=session_id, fork_session=True` | Nueva session con copia del historial. Original intacto |

### Capturar Session ID

```python
session_id = None

async for message in query(
    prompt="Analyze the auth module",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Glob", "Grep"]),
):
    if isinstance(message, ResultMessage):
        session_id = message.session_id
        if message.subtype == "success":
            print(message.result)

print(f"Session ID: {session_id}")
```

### Resumir Session

```python
async for message in query(
    prompt="Now implement the refactoring you suggested",
    options=ClaudeAgentOptions(
        resume=session_id,
        allowed_tools=["Read", "Edit", "Write", "Glob", "Grep"],
    ),
):
    if isinstance(message, ResultMessage) and message.subtype == "success":
        print(message.result)
```

### Forkear Session

```python
# Fork: nueva session con historial copiado
async for message in query(
    prompt="Instead of JWT, implement OAuth2",
    options=ClaudeAgentOptions(resume=session_id, fork_session=True),
):
    if isinstance(message, ResultMessage):
        forked_id = message.session_id
```

### Listar Sessions

```python
from claude_agent_sdk import list_sessions

for session in list_sessions(directory="/path/to/project", limit=10):
    print(f"{session.summary} ({session.session_id})")
```

### Leer Messages de una Session

```python
from claude_agent_sdk import get_session_messages

messages = get_session_messages(session_id)
for msg in messages:
    print(f"[{msg.type}] {msg.uuid}")
```

### ClaudeSDKClient - Session Automatica

Con `ClaudeSDKClient`, el session ID se maneja internamente:

```python
async with ClaudeSDKClient(options=options) as client:
    await client.query("Analyze the auth module")  # Crea session
    async for msg in client.receive_response():
        print_response(msg)

    await client.query("Now refactor it to use JWT")  # Misma session
    async for msg in client.receive_response():
        print_response(msg)
```

### Resume Across Hosts

- Mover archivo de session al mismo path en nuevo host
- O capturar resultados y pasarlos como prompt a nueva session (mas robusto)

---

## 12. Streaming

### Output Streaming (Partial Messages)

Habilitar con `include_partial_messages=True`:

```python
from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import StreamEvent

options = ClaudeAgentOptions(include_partial_messages=True)

async for message in query(prompt="Explain databases", options=options):
    if isinstance(message, StreamEvent):
        event = message.event
        if event.get("type") == "content_block_delta":
            delta = event.get("delta", {})
            if delta.get("type") == "text_delta":
                print(delta.get("text", ""), end="", flush=True)
```

### StreamEvent

```python
@dataclass
class StreamEvent:
    uuid: str
    session_id: str
    event: dict[str, Any]  # Raw Claude API stream event
    parent_tool_use_id: str | None = None
```

### Event Types

| Event Type | Descripcion |
|-----------|-------------|
| `message_start` | Inicio de nuevo mensaje |
| `content_block_start` | Inicio de bloque (text o tool_use) |
| `content_block_delta` | Update incremental |
| `content_block_stop` | Fin de bloque |
| `message_delta` | Updates a nivel mensaje (stop reason, usage) |
| `message_stop` | Fin del mensaje |

### Message Flow con Streaming

```
StreamEvent (message_start)
StreamEvent (content_block_start) - text block
StreamEvent (content_block_delta) - text chunks...
StreamEvent (content_block_stop)
StreamEvent (content_block_start) - tool_use block
StreamEvent (content_block_delta) - tool input chunks...
StreamEvent (content_block_stop)
StreamEvent (message_delta)
StreamEvent (message_stop)
AssistantMessage - mensaje completo
... tool ejecuta ...
ResultMessage - resultado final
```

### Stream Tool Calls

```python
current_tool = None
tool_input = ""

async for message in query(prompt="Read README.md", options=options):
    if isinstance(message, StreamEvent):
        event = message.event
        if event.get("type") == "content_block_start":
            content_block = event.get("content_block", {})
            if content_block.get("type") == "tool_use":
                current_tool = content_block.get("name")
                tool_input = ""
        elif event.get("type") == "content_block_delta":
            delta = event.get("delta", {})
            if delta.get("type") == "input_json_delta":
                tool_input += delta.get("partial_json", "")
        elif event.get("type") == "content_block_stop":
            if current_tool:
                print(f"Tool {current_tool} called with: {tool_input}")
                current_tool = None
```

### Limitaciones

- **Extended thinking**: Cuando se habilita `max_thinking_tokens`, StreamEvent NO se emite
- **Structured output**: El JSON result solo aparece en `ResultMessage.structured_output`

### Input Streaming

```python
async def message_stream():
    yield {"type": "user", "message": {"role": "user", "content": "Analyze data:"}}
    await asyncio.sleep(0.5)
    yield {"type": "user", "message": {"role": "user", "content": "Temperature: 25C"}}

async with ClaudeSDKClient() as client:
    await client.query(message_stream())
    async for message in client.receive_response():
        print(message)
```

---

## 13. Structured Outputs

### Concepto

Definir la forma exacta de datos que quieres de vuelta usando JSON Schema. El agente usa los tools que necesita, y obtienes JSON validado.

### Configuracion

```python
options = ClaudeAgentOptions(
    output_format={
        "type": "json_schema",
        "schema": {
            "type": "object",
            "properties": {
                "company_name": {"type": "string"},
                "founded_year": {"type": "number"},
            },
            "required": ["company_name"],
        },
    }
)
```

### Con Pydantic

```python
from pydantic import BaseModel

class Step(BaseModel):
    step_number: int
    description: str
    estimated_complexity: str

class FeaturePlan(BaseModel):
    feature_name: str
    summary: str
    steps: list[Step]
    risks: list[str]

options = ClaudeAgentOptions(
    output_format={
        "type": "json_schema",
        "schema": FeaturePlan.model_json_schema(),
    }
)

async for message in query(prompt="Plan dark mode feature", options=options):
    if isinstance(message, ResultMessage) and message.structured_output:
        plan = FeaturePlan.model_validate(message.structured_output)
        print(f"Feature: {plan.feature_name}")
```

### Error Handling

| Subtype | Significado |
|---------|-------------|
| `success` | Output generado y validado |
| `error_max_structured_output_retries` | No pudo producir output valido tras retries |

---

## 14. Permissions y Security

### Permission Evaluation Order

1. **Hooks** - Pueden allow/deny/continue
2. **Deny rules** (`disallowed_tools`) - Bloquean incluso en `bypassPermissions`
3. **Permission mode** - `bypassPermissions` aprueba todo, `acceptEdits` aprueba file ops
4. **Allow rules** (`allowed_tools`) - Auto-aprueba tools listados
5. **canUseTool callback** - Decision en runtime (skip en `dontAsk` mode)

### Permission Modes

| Modo | Comportamiento |
|------|---------------|
| `"default"` | Sin auto-approvals; tools no matcheados triggerean `canUseTool` |
| `"acceptEdits"` | Auto-aprueba file edits (Edit, Write, mkdir, rm, mv, cp) |
| `"plan"` | Sin ejecucion de tools; Claude solo planifica |
| `"bypassPermissions"` | Todo corre sin prompts. **PELIGROSO** - usar solo en entornos aislados |

**NOTA**: `dontAsk` solo disponible en TypeScript.

### Cambiar Permisos Mid-Session

```python
q = query(prompt="...", options=ClaudeAgentOptions(permission_mode="default"))
await q.set_permission_mode("acceptEdits")  # Cambiar mid-session
async for message in q:
    ...
```

### canUseTool Callback

```python
CanUseTool = Callable[
    [str, dict[str, Any], ToolPermissionContext],
    Awaitable[PermissionResult]
]
```

```python
@dataclass
class PermissionResultAllow:
    behavior: Literal["allow"] = "allow"
    updated_input: dict[str, Any] | None = None
    updated_permissions: list[PermissionUpdate] | None = None

@dataclass
class PermissionResultDeny:
    behavior: Literal["deny"] = "deny"
    message: str = ""
    interrupt: bool = False
```

### SandboxSettings

Configuracion programatica de sandbox:

```python
options = ClaudeAgentOptions(
    sandbox=SandboxSettings(...)  # Config de sandbox
)
```

### Security Best Practices

1. **Usar `disallowed_tools`** para bloquear tools peligrosos explicitamente
2. **`allowed_tools` NO restringe `bypassPermissions`** - todo tool se aprueba en ese modo
3. **Subagentes heredan `bypassPermissions`** y NO se puede override
4. **Hooks pueden bloquear** incluso en `bypassPermissions` (deny en hook > permission mode)
5. **max_budget_usd** para limitar costos
6. **max_turns** para evitar loops infinitos
7. **Container sandboxing** para produccion

---

## 15. Agent Loop - Ciclo de Ejecucion

### Flujo Completo

1. **Recibe prompt** -> SystemMessage con subtype `"init"` (metadata de session)
2. **Claude evalua** -> AssistantMessage con text + tool calls
3. **Ejecuta tools** -> UserMessage con tool results
4. **Repite** pasos 2-3 (cada ciclo = 1 turn)
5. **Resultado final** -> AssistantMessage (solo texto) + ResultMessage

### Turns y Budget

| Opcion | Control | Default |
|--------|---------|---------|
| `max_turns` | Maximo tool-use round trips | Sin limite |
| `max_budget_usd` | Costo maximo antes de parar | Sin limite |

### Result Subtypes

| Subtype | Que paso | `result` disponible? |
|---------|----------|---------------------|
| `success` | Claude termino normalmente | Si |
| `error_max_turns` | Alcanzo limite de turns | No |
| `error_max_budget_usd` | Alcanzo limite de budget | No |
| `error_during_execution` | Error interrumpio el loop | No |
| `error_max_structured_output_retries` | Structured output fallo tras retries | No |

### Context Window

- **System prompt**: Costo fijo pequeno, siempre presente
- **CLAUDE.md**: Contenido completo en cada request (prompt-cached)
- **Tool definitions**: Cada tool suma su schema
- **Historial**: Crece con cada turn
- **Tool outputs grandes**: Consumen context significativo

### Compactacion Automatica

Cuando el context window se acerca al limite, el SDK compacta automaticamente: resume historial viejo, mantiene intercambios recientes y decisiones clave.

- Emite `SystemMessage` con subtype `"compact_boundary"`
- Hook `PreCompact` permite archivar transcript antes
- Instrucciones en CLAUDE.md se preservan (se re-inyectan cada request)
- `/compact` como prompt para compactacion manual

---

## 16. Message Types Completos

### Union Type Principal

```python
Message = UserMessage | AssistantMessage | SystemMessage | ResultMessage | StreamEvent
```

### UserMessage

```python
@dataclass
class UserMessage:
    content: str | list[ContentBlock]
    uuid: str | None = None
    parent_tool_use_id: str | None = None
    tool_use_result: dict[str, Any] | None = None
```

### AssistantMessage

```python
@dataclass
class AssistantMessage:
    content: list[ContentBlock]
    model: str
    parent_tool_use_id: str | None = None
    error: AssistantMessageError | None = None
    # AssistantMessageError = Literal["authentication_failed", "billing_error",
    #   "rate_limit", "invalid_request", "server_error", "unknown"]
```

### SystemMessage

```python
@dataclass
class SystemMessage:
    subtype: str  # "init", "compact_boundary", etc.
    data: dict[str, Any]
```

### ResultMessage

```python
@dataclass
class ResultMessage:
    subtype: str
    duration_ms: int
    duration_api_ms: int
    is_error: bool
    num_turns: int
    session_id: str
    total_cost_usd: float | None = None
    usage: dict[str, Any] | None = None  # input_tokens, output_tokens, cache_*
    result: str | None = None
    stop_reason: str | None = None  # "end_turn", "max_tokens", "refusal"
    structured_output: Any = None
```

### TaskStartedMessage / TaskProgressMessage / TaskNotificationMessage

Para background tasks (subagentes, bash backgroundeados):

```python
@dataclass
class TaskStartedMessage(SystemMessage):
    task_id: str
    description: str
    task_type: str | None  # "local_bash", "local_agent", "remote_agent"

@dataclass
class TaskProgressMessage(SystemMessage):
    task_id: str
    usage: TaskUsage  # total_tokens, tool_uses, duration_ms
    last_tool_name: str | None

@dataclass
class TaskNotificationMessage(SystemMessage):
    task_id: str
    status: str  # "completed", "failed", "stopped"
    output_file: str
    summary: str
```

### Content Block Types

```python
ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock

@dataclass
class TextBlock:
    text: str

@dataclass
class ThinkingBlock:
    thinking: str
    signature: str

@dataclass
class ToolUseBlock:
    id: str
    name: str
    input: dict[str, Any]

@dataclass
class ToolResultBlock:
    tool_use_id: str
    content: str | list[dict[str, Any]] | None = None
    is_error: bool | None = None
```

---

## 17. Error Handling

### Jerarquia de Errores

```python
ClaudeSDKError (base)
  |-- CLIConnectionError
  |     |-- CLINotFoundError
  |-- ProcessError (exit_code, stderr)
  |-- CLIJSONDecodeError (line, original_error)
```

### Ejemplo

```python
from claude_agent_sdk import (
    ClaudeSDKError, CLINotFoundError, CLIConnectionError, ProcessError, CLIJSONDecodeError,
)

try:
    async for message in query(prompt="Hello"):
        pass
except CLINotFoundError:
    print("Please install Claude Code")
except ProcessError as e:
    print(f"Process failed with exit code: {e.exit_code}")
    print(f"Stderr: {e.stderr}")
except CLIJSONDecodeError as e:
    print(f"Failed to parse response: {e.line}")
except CLIConnectionError:
    print("Connection to Claude Code failed")
except ClaudeSDKError as e:
    print(f"SDK error: {e}")
```

---

## 18. Hosting y Deploy

### Arquitectura

El Agent SDK es un **proceso long-running** que:
- Ejecuta comandos en shell persistente
- Maneja file operations en working directory
- Mantiene estado conversacional

### System Requirements

- **Runtime**: Python 3.10+ + Node.js 18+ (CLI)
- **Resources**: ~1GiB RAM, 5GiB disco, 1 CPU
- **Network**: HTTPS outbound a `api.anthropic.com`

### Patrones de Deploy

| Patron | Descripcion | Caso de uso |
|--------|-------------|-------------|
| **Ephemeral** | Container nuevo por tarea, destruir al completar | Bug fixes, invoice processing |
| **Long-Running** | Containers persistentes, multiples procesos | Email agents, bots de chat |
| **Hybrid** | Ephemeral con hidratacion de historial | Project managers, deep research |
| **Single Container** | Multiples procesos en un container | Simulaciones multi-agente |

### Sandbox Providers

- Modal Sandbox, Cloudflare Sandboxes, Daytona, E2B, Fly Machines, Vercel Sandbox

### Docker

```dockerfile
FROM python:3.12-slim

# Install Node.js (required for CLI)
RUN apt-get update && apt-get install -y nodejs npm

# Install SDK
RUN pip install claude-agent-sdk

COPY . /app
WORKDIR /app

CMD ["python", "agent.py"]
```

### Costo

- El costo dominante son los **tokens de la API**
- Container hosting: ~$0.05/hora minimo

---

## 19. SDK de TypeScript

### Existe y es oficial

```bash
npm install @anthropic-ai/claude-agent-sdk
```

GitHub: `https://github.com/anthropics/claude-agent-sdk-typescript`

### Diferencias con Python SDK

| Feature | Python | TypeScript |
|---------|--------|------------|
| `SessionStart`/`SessionEnd` hooks | NO | SI |
| `dontAsk` permission mode | NO | SI |
| `persistSession: false` | NO | SI |
| V2 Preview (`createSession()`) | NO | SI (unstable) |
| Events adicionales de observabilidad | NO | SI |
| `Skill` tool en AgentDefinition | NO | SI |
| Content blocks | `message.content` | `message.message.content` |

### API TypeScript (referencia rapida)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits",
    maxTurns: 30,
    maxBudgetUsd: 0.50,
    effort: "high",
    mcpServers: {...},
    hooks: { PreToolUse: [{ matcher: "Bash", hooks: [myCallback] }] },
    agents: { "reviewer": { description: "...", prompt: "...", tools: [...] } },
  }
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

---

## 20. Patrones Avanzados

### 20.1 Multi-Agent Orchestration

```python
# Definir agentes especializados
agents = {
    "researcher": AgentDefinition(
        description="Deep research specialist",
        prompt="You are a thorough researcher...",
        tools=["Read", "Grep", "Glob", "WebSearch", "WebFetch"],
        model="sonnet",
    ),
    "implementer": AgentDefinition(
        description="Code implementation specialist",
        prompt="You are an expert developer...",
        tools=["Read", "Edit", "Write", "Bash"],
        model="sonnet",
    ),
    "tester": AgentDefinition(
        description="Testing specialist",
        prompt="You write and run comprehensive tests...",
        tools=["Bash", "Read", "Write"],
        model="sonnet",
    ),
}

# Orquestador principal
async for message in query(
    prompt="Research, implement, and test a new feature for user authentication",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Glob", "Grep", "Agent"],
        agents=agents,
        model="claude-opus-4-6",  # Orquestador usa Opus
    ),
):
    ...
```

### 20.2 Pipeline con Session Resume

```python
# Step 1: Analisis
session_id = None
async for msg in query(prompt="Analyze the codebase architecture", options=analysis_opts):
    if isinstance(msg, ResultMessage):
        session_id = msg.session_id

# Step 2: Plan (resume con contexto del analisis)
async for msg in query(
    prompt="Create an implementation plan based on your analysis",
    options=ClaudeAgentOptions(resume=session_id),
):
    if isinstance(msg, ResultMessage):
        session_id = msg.session_id

# Step 3: Implementar (resume con contexto del plan)
async for msg in query(
    prompt="Implement the plan",
    options=ClaudeAgentOptions(
        resume=session_id,
        allowed_tools=["Read", "Edit", "Write", "Bash"],
    ),
):
    ...
```

### 20.3 Agente con Guardrails via Hooks

```python
# Hook de rate limiting
request_count = 0

async def rate_limiter(input_data, tool_use_id, context):
    global request_count
    request_count += 1
    if request_count > 100:
        return {
            "continue_": False,
            "stopReason": "Rate limit exceeded",
        }
    return {}

# Hook de audit logging
async def audit_logger(input_data, tool_use_id, context):
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "tool": input_data.get("tool_name"),
        "session": input_data.get("session_id"),
    }
    with open("audit.log", "a") as f:
        f.write(json.dumps(log_entry) + "\n")
    return {}

# Hook de content filtering
async def content_filter(input_data, tool_use_id, context):
    prompt = input_data.get("prompt", "")
    if any(word in prompt.lower() for word in BLOCKED_WORDS):
        return {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "updatedPrompt": "[FILTERED]",
            }
        }
    return {}

options = ClaudeAgentOptions(
    hooks={
        "PreToolUse": [
            HookMatcher(hooks=[rate_limiter, audit_logger]),
        ],
        "UserPromptSubmit": [
            HookMatcher(hooks=[content_filter]),
        ],
    }
)
```

### 20.4 File Checkpointing y Rewind

```python
async with ClaudeSDKClient(options=ClaudeAgentOptions(
    enable_file_checkpointing=True,
    allowed_tools=["Read", "Edit", "Write"],
)) as client:
    await client.query("Refactor the auth module")
    user_msg_id = None
    async for msg in client.receive_response():
        if isinstance(msg, UserMessage):
            user_msg_id = msg.uuid

    # Revertir cambios si no gustan
    await client.rewind_files(user_msg_id)
```

### 20.5 Context Efficiency con Subagentes

Usar subagentes para subtareas mantiene el context del agente principal lean:

- Cada subagente tiene context fresco
- Solo su respuesta final vuelve al padre
- El context principal crece por ese resumen, no por toda la subtarea

---

## 21. Migracion desde Claude Code SDK

### Cambios Breaking (v0.1.0)

| Antes (v < 0.1.0) | Ahora (v >= 0.1.0) |
|--------------------|---------------------|
| `ClaudeCodeOptions` | `ClaudeAgentOptions` |
| System prompt separado | Merged system prompt config |
| Settings se cargan auto | `setting_sources` explicito (default: none) |
| Tool name `"Task"` | Tool name `"Agent"` (v2.1.63+) |

### Guia

1. Renombrar `ClaudeCodeOptions` -> `ClaudeAgentOptions`
2. Agregar `setting_sources=["project"]` si necesitas cargar CLAUDE.md
3. Verificar que `hooks` usan la nueva signature
4. Actualizar referencias a `"Task"` -> `"Agent"` en tool detection

---

## Apendice A: Imports Rapidos

```python
from claude_agent_sdk import (
    # Core
    query,
    ClaudeSDKClient,
    ClaudeAgentOptions,

    # Tools
    tool,
    create_sdk_mcp_server,

    # Messages
    AssistantMessage,
    UserMessage,
    SystemMessage,
    ResultMessage,

    # Content Blocks
    TextBlock,
    ThinkingBlock,
    ToolUseBlock,
    ToolResultBlock,

    # Agents
    AgentDefinition,

    # Hooks
    HookMatcher,

    # Sessions
    list_sessions,
    get_session_messages,

    # Errors
    ClaudeSDKError,
    CLINotFoundError,
    CLIConnectionError,
    ProcessError,
    CLIJSONDecodeError,

    # Transport
    Transport,
)

from claude_agent_sdk.types import (
    StreamEvent,
    PermissionResultAllow,
    PermissionResultDeny,
    ToolPermissionContext,
)
```

## Apendice B: Versiones Soportadas

| Python SDK | CLI Version | Fecha |
|-----------|-------------|-------|
| 0.1.48 | Latest | 2026-03-07 |
| 0.0.23 | - | 2025-09-28 |

## Apendice C: URLs de Referencia

- **Documentacion oficial**: https://platform.claude.com/docs/en/agent-sdk/overview
- **Python SDK Reference**: https://platform.claude.com/docs/en/agent-sdk/python
- **TypeScript SDK Reference**: https://platform.claude.com/docs/en/agent-sdk/typescript
- **GitHub (Python)**: https://github.com/anthropics/claude-agent-sdk-python
- **GitHub (TypeScript)**: https://github.com/anthropics/claude-agent-sdk-typescript
- **GitHub (Demos)**: https://github.com/anthropics/claude-agent-sdk-demos
- **PyPI**: https://pypi.org/project/claude-agent-sdk/
- **npm**: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk
- **Engineering Blog**: https://claude.com/blog/building-agents-with-the-claude-agent-sdk
- **MCP Protocol**: https://modelcontextprotocol.io
- **MCP Servers Directory**: https://github.com/modelcontextprotocol/servers
