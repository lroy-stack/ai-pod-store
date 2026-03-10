# PodClaw Sprint 1 — Event Foundation

*Plan de desarrollo basado en 7 auditorías + 4 docs de research Anthropic*
*Objetivo: PodClaw responde al CEO via WhatsApp/Telegram en <5 min*

---

## Contexto Técnico

### Lo que YA funciona (no tocar)
- `orchestrator.run_agent()` — unidad atómica de ejecución, se mantiene
- Hook chain fail-closed (5 pre + 7 post) — compatible con event-driven
- 11 conectores MCP in-process — se mantienen
- Budget enforcement dual (SDK + cost_guard Redis) — se mantiene
- Circuit breaker, distributed locking, retry backoff — se mantienen
- Memory system 3-tier — se mantiene
- Event Store (agent_events) — se mantiene

### Lo que CAMBIA
- **Quién invoca `run_agent()`**: de scheduler cron → event dispatcher
- **Cómo llegan las tareas**: de APScheduler → webhooks + event queue
- **Cómo se comunican resultados**: de logs → WhatsApp/Telegram al CEO

### Principio rector
**Cambio mínimo, máximo impacto.** No reescribimos PodClaw — le añadimos una capa de eventos encima del orchestrator existente.

---

## FASE A: Critical Fixes (Día 1)

Bugs del audit que afectan la estabilidad del event loop.

### A1. Redis Lock TTL fix
**Archivo**: `podclaw/redis_store.py`
**Cambio**: Lock TTL de 1200s → 1500s (session 900s + 600s buffer)
**Por qué**: Si session se extiende, otro instance puede adquirir el lock

### A2. Hook timeout wrapper
**Archivo**: `podclaw/hook_adapters.py`
**Cambio**: Envolver CADA hook en `asyncio.wait_for(hook(), timeout=10.0)`
**Por qué**: Si security_hook o rate_limit_hook cuelgan, bloquean el event loop indefinidamente

### A3. Supabase thread pool timeout
**Archivo**: `podclaw/event_store.py`
**Cambio**: `await asyncio.wait_for(asyncio.to_thread(supabase_call), timeout=30.0)`
**Por qué**: Supabase sync client puede colgar el thread pool

### Verificación Fase A
```bash
cd podclaw && python -m pytest tests/ -k "lock or hook or timeout" -v
```

---

## FASE B: Message Gateway (Día 2-4)

El CEO envía mensaje → PodClaw lo recibe y normaliza.

### B1. CEO Identity Config
**Archivo nuevo**: `podclaw/gateway/__init__.py`
**Archivo nuevo**: `podclaw/gateway/config.py`

```python
# gateway/config.py
import os

CEO_WHATSAPP_NUMBER = os.environ["CEO_WHATSAPP_NUMBER"]  # "+34612345678"
CEO_TELEGRAM_CHAT_ID = os.environ["CEO_TELEGRAM_CHAT_ID"]  # "123456789"

# Fail-closed: si no están configurados, PodClaw no arranca
assert CEO_WHATSAPP_NUMBER, "CEO_WHATSAPP_NUMBER required"
assert CEO_TELEGRAM_CHAT_ID, "CEO_TELEGRAM_CHAT_ID required"
```

### B2. Normalized Message Model
**Archivo nuevo**: `podclaw/gateway/models.py`

```python
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional

class Platform(Enum):
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"
    BRIDGE = "bridge"  # Terminal local

class MessageType(Enum):
    TEXT = "text"
    IMAGE = "image"
    BUTTON_RESPONSE = "button_response"
    COMMAND = "command"

@dataclass
class NormalizedMessage:
    id: str
    platform: Platform
    sender_id: str  # phone number o chat_id
    is_ceo: bool    # verificado contra whitelist
    type: MessageType
    text: Optional[str] = None
    image_url: Optional[str] = None
    button_payload: Optional[str] = None  # "approve:design_123"
    reply_to: Optional[str] = None
    timestamp: datetime = None
```

### B3. WhatsApp Inbound Webhook
**Archivo nuevo**: `podclaw/gateway/whatsapp_inbound.py`

Responsabilidades:
1. Recibir POST de Meta WhatsApp Cloud API (webhook verification + messages)
2. Verificar firma HMAC-SHA256 (fail-closed)
3. Verificar que `from` == `CEO_WHATSAPP_NUMBER` (fail-closed: ignorar si no es CEO)
4. Extraer: texto, imagen URL, button response
5. Normalizar a `NormalizedMessage`
6. Persistir en `whatsapp_messages` (Supabase)
7. Emitir evento al event router

**Endpoint**: Registrar en bridge FastAPI como `POST /webhooks/whatsapp`

### B4. Telegram Inbound Webhook
**Archivo nuevo**: `podclaw/gateway/telegram_inbound.py`

Responsabilidades:
1. Recibir POST del Telegram Bot API (update)
2. Verificar secret_token header (fail-closed)
3. Verificar que `chat.id` == `CEO_TELEGRAM_CHAT_ID` (fail-closed)
4. Extraer: texto, foto URL, callback_query (botones)
5. Normalizar a `NormalizedMessage`
6. Persistir en `telegram_messages` (Supabase)
7. Emitir evento al event router

**Endpoint**: Registrar en bridge FastAPI como `POST /webhooks/telegram`

### B5. WhatsApp Outbound (mejorar conector existente)
**Archivo**: `podclaw/connectors/whatsapp_connector.py` (109 LOC actual)

Añadir tools:
- `whatsapp_send_image` — enviar imagen con caption
- `whatsapp_send_buttons` — enviar mensaje con botones interactivos (Meta Interactive Messages API)

```python
# Ejemplo: enviar preview de diseño con botones approve/reject
@tool(name="whatsapp_send_buttons", annotations={"destructiveHint": False})
async def whatsapp_send_buttons(
    text: str,
    image_url: str | None = None,
    buttons: list[dict] = None  # [{"id": "approve_123", "title": "✅ Aprobar"}]
) -> dict:
    ...
```

### B6. Telegram Outbound (mejorar conector existente)
**Archivo**: `podclaw/connectors/telegram_connector.py` (125 LOC actual)

Añadir tools:
- `telegram_send_inline_keyboard` — enviar mensaje con inline keyboard buttons

### Verificación Fase B
```bash
# Test: enviar mensaje de prueba desde WhatsApp al webhook
curl -X POST http://localhost:8000/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[...]}'

# Debe: verificar firma, verificar CEO, normalizar, persistir, emitir evento
```

---

## FASE C: Event Router (Día 5-7)

Mensaje normalizado → clasificar → despachar al agente correcto.

### C1. Event Classifier
**Archivo nuevo**: `podclaw/router/__init__.py`
**Archivo nuevo**: `podclaw/router/classifier.py`

Clasifica el `NormalizedMessage` del CEO en un tipo de evento:

```python
from enum import Enum

class EventType(Enum):
    # CEO requests
    DESIGN_REQUEST = "ceo.design_request"       # "diseña una camiseta..."
    DESIGN_FROM_IMAGE = "ceo.design_from_image"  # [imagen] + texto
    CATALOG_REQUEST = "ceo.catalog_request"      # "publica el producto..."
    QUERY = "ceo.query"                          # "¿cuánto vendimos?"
    RESEARCH_REQUEST = "ceo.research_request"    # "investiga qué gorras..."
    MARKETING_REQUEST = "ceo.marketing_request"  # "crea post para..."
    SYSTEM_COMMAND = "ceo.system_command"        # "pausa marketing agent"
    APPROVAL = "ceo.approve"                     # botón approve
    REJECTION = "ceo.reject"                     # botón reject
    GENERAL = "ceo.general"                      # conversación general

    # System events (futuros)
    WEBHOOK_STRIPE = "webhook.stripe"
    WEBHOOK_PRINTFUL = "webhook.printful"
    CUSTOMER_EMAIL = "customer.email"
```

**Clasificación**: Usar Haiku 4.5 con prompt corto (~$0.001/clasificación):
```
Classify this CEO message into ONE category:
- design_request: wants to create a design
- design_from_image: sent an image to use as reference
- catalog_request: wants to manage products/catalog
- query: asking about business metrics/status
- research_request: wants market research
- marketing_request: wants marketing content
- system_command: wants to control agents/system
- general: casual conversation

Message: "{text}"
Category:
```

**Fallback mecánico**: Si Haiku falla, usar regex patterns:
- `/diseñ|design|crea.*camiseta/i` → DESIGN_REQUEST
- `/vend|revenue|ingres|cost/i` → QUERY
- `/pausa|stop|resume|restart/i` → SYSTEM_COMMAND
- Button payload `approve:*` → APPROVAL
- Button payload `reject:*` → REJECTION
- Image present → DESIGN_FROM_IMAGE

### C2. Agent Dispatcher
**Archivo nuevo**: `podclaw/router/dispatcher.py`

Mapea `EventType` → agente + prompt:

```python
ROUTING_TABLE = {
    EventType.DESIGN_REQUEST: {
        "agent": "designer",
        "prompt_template": "CEO request: {text}\nDesign a product based on this request.",
    },
    EventType.DESIGN_FROM_IMAGE: {
        "agent": "designer",
        "prompt_template": "CEO sent a reference image: {image_url}\nInstruction: {text}",
    },
    EventType.CATALOG_REQUEST: {
        "agent": "cataloger",
        "prompt_template": "CEO request: {text}\nManage the product catalog accordingly.",
    },
    EventType.QUERY: {
        "agent": "finance",
        "prompt_template": "CEO asks: {text}\nProvide accurate business metrics.",
    },
    EventType.RESEARCH_REQUEST: {
        "agent": "researcher",
        "prompt_template": "CEO wants research on: {text}",
    },
    EventType.SYSTEM_COMMAND: {
        "agent": None,  # Handled directly by orchestrator
    },
    EventType.APPROVAL: {
        "agent": None,  # Handled by approval manager
    },
    EventType.REJECTION: {
        "agent": None,  # Handled by approval manager
    },
}
```

**Dispatch flow**:
```python
async def dispatch(message: NormalizedMessage, event_type: EventType):
    route = ROUTING_TABLE[event_type]

    if route["agent"] is None:
        return await handle_system_event(message, event_type)

    agent_name = route["agent"]
    prompt = route["prompt_template"].format(
        text=message.text or "",
        image_url=message.image_url or "",
    )

    # Usar el orchestrator existente — NO reinventar
    result = await orchestrator.run_agent(
        agent_name=agent_name,
        task=prompt,
        source=f"ceo:{message.platform.value}",
    )

    # Enviar resultado al CEO
    await send_to_ceo(message.platform, result.summary)
```

### C3. Response Sender
**Archivo nuevo**: `podclaw/router/responder.py`

Envía el resultado del agente de vuelta al CEO por el mismo canal:

```python
async def send_to_ceo(platform: Platform, text: str, image_url: str = None):
    if platform == Platform.WHATSAPP:
        if image_url:
            await whatsapp_send_image(CEO_WHATSAPP_NUMBER, image_url, text)
        else:
            await whatsapp_send(CEO_WHATSAPP_NUMBER, text)
    elif platform == Platform.TELEGRAM:
        if image_url:
            await telegram_send_photo(CEO_TELEGRAM_CHAT_ID, image_url, text)
        else:
            await telegram_send(CEO_TELEGRAM_CHAT_ID, text)
```

### C4. Integrar con Bridge API
**Archivo**: `podclaw/bridge/api.py`

Añadir endpoints de webhook:
```python
@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    # B3: WhatsApp inbound handler
    ...

@app.post("/webhooks/telegram")
async def telegram_webhook(request: Request):
    # B4: Telegram inbound handler
    ...
```

### C5. Modificar main.py — Event Loop
**Archivo**: `podclaw/main.py`

Cambio mínimo: el scheduler sigue existiendo para los 5 crons residuales, pero ahora TAMBIÉN hay un event router escuchando.

```python
# Añadir al startup (después de scheduler.start())
from podclaw.router.dispatcher import EventDispatcher

event_dispatcher = EventDispatcher(orchestrator, memory_manager)
# El dispatcher se activa cuando llegan webhooks — no es un loop, es reactive
```

### Verificación Fase C
```
Test E2E: CEO envía "¿cuánto vendimos esta semana?" via WhatsApp
  → Webhook recibe → Normaliza → Clasifica como QUERY → Dispatch a finance agent
  → Finance agent ejecuta (orchestrator.run_agent) → Resultado
  → Responder al CEO via WhatsApp con el resumen de ventas
```

---

## FASE D: Scheduler Hybrid (Día 8)

Convertir el scheduler de "driver principal" a "cron residual".

### D1. Reducir scheduler a crons esenciales
**Archivo**: `podclaw/scheduler.py`

Mantener SOLO:
```python
RESIDUAL_CRONS = {
    "reconciliation": {"func": "sync_printful", "trigger": "interval", "minutes": 30},
    "delivery_check": {"func": "check_delivery", "trigger": "interval", "hours": 6},
    "product_metrics": {"func": "product_metrics_etl", "trigger": "cron", "hour": 2},
    "cleanup": {"func": "cleanup_temp", "trigger": "cron", "hour": 3},
    "gdpr_hard_delete": {"func": "gdpr_delete", "trigger": "cron", "hour": 4},
    # System jobs que se mantienen
    "memory_consolidation": {"func": "memory_consolidation", "trigger": "cron", "hour": 23, "minute": 30},
    "session_reaper": {"func": "session_reaper", "trigger": "interval", "hours": 1},
    "memory_decay": {"func": "memory_decay", "trigger": "cron", "hour": 4},
}
```

Eliminar los 10 agent crons (researcher 06:00, designer 08:00, etc.) — ahora son event-driven via CEO messages.

### D2. Fallback: CEO inactivo
**Archivo nuevo**: `podclaw/router/fallback.py`

Si el CEO no envía mensajes en 48h, ejecutar automáticamente:
- `researcher` (tendencias)
- `qa_inspector` (verificar productos)
- `finance` (reporte semanal)

Esto previene que la tienda quede desatendida si el CEO está de vacaciones.

---

## FASE E: Printful Connector (Día 9-12)

Reemplazar Printify connector (1,366 LOC, 22 tools) con Printful.

### E1. Nuevo conector Printful
**Archivo nuevo**: `podclaw/connectors/printful_connector.py`

Reutilizar la lógica ya probada del frontend TypeScript (`frontend/src/lib/pod/printful/client.ts` + `mapper.ts`) como referencia, pero implementar en Python.

**Tools prioritarias (Sprint 1)**:
```python
# Catálogo
printful_get_catalog          # GET /products (cached 10min)
printful_get_catalog_variants # GET /products/{id}
printful_get_printfiles       # GET /products/{id}/printfiles

# Productos
printful_list_products        # GET /store/products
printful_get_product          # GET /store/products/{id}
printful_create_product       # POST /store/products
printful_update_product       # PUT /store/products/{id}
printful_delete_product       # DELETE /store/products/{id}

# Diseño
printful_upload_file          # POST /files
printful_create_mockup        # POST /mockup-generator/create-task/{id}
printful_poll_mockup          # GET /mockup-generator/task

# Pedidos
printful_create_order         # POST /orders?confirm=true
printful_get_order            # GET /orders/{id}
printful_cancel_order         # DELETE /orders/{id}

# Envío
printful_get_shipping_rates   # POST /shipping/rates
```

**Features del client**:
- Rate limiting: Token bucket (120 req/min)
- Retry: 2 intentos para 5xx, respeta Retry-After para 429
- Headers: Bearer auth + User-Agent + X-PF-Store-Id
- SSRF protection (mantener del Printify connector)
- Circuit breaker (mantener patrón existente)

### E2. Actualizar config.py
**Archivo**: `podclaw/config.py`

```python
# Reemplazar
PRINTIFY_API_TOKEN → PRINTFUL_API_TOKEN
PRINTIFY_SHOP_ID → PRINTFUL_STORE_ID

# Añadir
PRINTFUL_WEBHOOK_SECRET = os.environ.get("PRINTFUL_WEBHOOK_SECRET")
```

### E3. Actualizar main.py
**Archivo**: `podclaw/main.py`

En `_build_connectors()`: reemplazar `PrintifyMCPConnector` con `PrintfulMCPConnector`.

---

## FASE F: Tests + Verificación (Día 13-14)

### F1. Tests unitarios nuevos
```
tests/
├── gateway/
│   ├── test_whatsapp_inbound.py    # Verify HMAC, CEO check, normalize
│   ├── test_telegram_inbound.py    # Verify secret, CEO check, normalize
│   └── test_normalizer.py          # Message model tests
├── router/
│   ├── test_classifier.py          # Event classification (regex + Haiku)
│   ├── test_dispatcher.py          # Routing table, agent dispatch
│   └── test_responder.py           # Outbound message formatting
└── connectors/
    └── test_printful_connector.py  # API calls, rate limiting, error handling
```

### F2. Test E2E: "Hello World" event-driven
```
1. Simular webhook WhatsApp: CEO envía "hola"
   → Verifica: normalización, clasificación (GENERAL), respuesta "Hola CEO"

2. Simular webhook WhatsApp: CEO envía "¿cuánto vendimos hoy?"
   → Verifica: clasificación (QUERY), dispatch a finance, respuesta con datos

3. Simular webhook Telegram: CEO envía "/status"
   → Verifica: clasificación (SYSTEM_COMMAND), respuesta con estado del sistema

4. Simular webhook WhatsApp: número desconocido envía mensaje
   → Verifica: RECHAZADO (no es CEO), no se procesa, se logea intento
```

### F3. Security tests
```
1. Webhook sin firma HMAC → RECHAZADO
2. Webhook con firma inválida → RECHAZADO
3. Mensaje desde número no-CEO → IGNORADO + LOG
4. Mensaje con prompt injection → Sanitizado por security_hook existente
5. Flood de mensajes → Rate limited
```

---

## Archivos a Crear (11 nuevos)

| Archivo | LOC est. | Propósito |
|---------|----------|-----------|
| `podclaw/gateway/__init__.py` | 5 | Package init |
| `podclaw/gateway/config.py` | 20 | CEO identity + whitelist |
| `podclaw/gateway/models.py` | 50 | NormalizedMessage dataclass |
| `podclaw/gateway/whatsapp_inbound.py` | 120 | WhatsApp webhook handler |
| `podclaw/gateway/telegram_inbound.py` | 100 | Telegram webhook handler |
| `podclaw/router/__init__.py` | 5 | Package init |
| `podclaw/router/classifier.py` | 80 | Event classification |
| `podclaw/router/dispatcher.py` | 100 | Agent dispatch + routing table |
| `podclaw/router/responder.py` | 60 | Outbound to CEO |
| `podclaw/router/fallback.py` | 40 | CEO inactivo 48h |
| `podclaw/connectors/printful_connector.py` | 800 | Printful API client |

**Total nuevo**: ~1,380 LOC

## Archivos a Modificar (6 existentes)

| Archivo | Cambio |
|---------|--------|
| `podclaw/redis_store.py` | Lock TTL 1200→1500 |
| `podclaw/hook_adapters.py` | Timeout wrapper 10s |
| `podclaw/event_store.py` | Thread pool timeout 30s |
| `podclaw/connectors/whatsapp_connector.py` | +2 tools (image, buttons) |
| `podclaw/connectors/telegram_connector.py` | +1 tool (inline keyboard) |
| `podclaw/main.py` | Event dispatcher init + webhook routes |
| `podclaw/scheduler.py` | Reducir a crons residuales |
| `podclaw/config.py` | Printful env vars + CEO identity |
| `podclaw/bridge/api.py` | Webhook endpoints |

---

## Orden de Ejecución

```
Día 1:     FASE A — Critical fixes (3 cambios quirúrgicos)
Día 2-4:   FASE B — Message Gateway (recibir + normalizar + enviar)
Día 5-7:   FASE C — Event Router (clasificar + despachar + responder)
Día 8:     FASE D — Scheduler hybrid (reducir crons)
Día 9-12:  FASE E — Printful Connector (reemplazar Printify)
Día 13-14: FASE F — Tests + verificación E2E
```

## Definition of Done

Sprint 1 está completo cuando:
- [ ] CEO envía "hola" por WhatsApp → PodClaw responde en <30s
- [ ] CEO envía "¿cuánto vendimos?" → Finance agent ejecuta y responde
- [ ] CEO envía comando por Telegram → Sistema responde
- [ ] Mensaje de número desconocido → Rechazado silenciosamente
- [ ] Webhook sin firma → Rechazado
- [ ] 5 crons residuales siguen funcionando
- [ ] Printful connector funcional (list, create, upload, order)
- [ ] Tests pasan (unit + E2E)
- [ ] Zero regresiones en funcionalidad existente

## Lo que NO incluye Sprint 1

- Diseño SVG → PNG pipeline (Sprint 2)
- Approval flow con botones (Sprint 2)
- Customer-facing mode (Sprint 3)
- Email inbound (Sprint 3)
- Design tasks table + workflow (Sprint 2)
- Monitoring/Prometheus (Sprint 4)

---

*Plan basado en: Agent SDK Python docs (v0.1.48), MCP Spec (2025-06-18), PodClaw audit (3 CRITICAL, 6 HIGH), Blueprint v2 (7 docs), OpenClaw reference architecture.*
