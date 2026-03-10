# PodClaw — Evolución Arquitectónica: De Cron-Driven a Event-Driven

## Auditoría Comparativa del Modelo Operativo y Nivel de Autonomía

**Fecha**: 2026-03-09
**Scope**: PodClaw (cron-driven, e-commerce POD) vs OpenClaw (event-driven, asistente personal)

---

## 1. Diagnóstico del Estado Actual

### PodClaw: 100% Cron-Driven

| Métrica | Valor |
|---------|-------|
| Modelo de ejecución | Cron batch (APScheduler) |
| Utilización | 52% (11.5h idle/día) |
| Latencia mínima inter-agente | 1-22 horas (via context files) |
| Latencia de evento "urgente" | 60 segundos mínimo |
| Horas activas | 06:00-23:30 UTC |
| Horas completamente idle | 00:00-05:59 UTC (6h) |
| Worker model | Single asyncio.Queue (secuencial) |
| Comunicación inter-agente | Archivos .md en disco (eventual consistency) |

**Ciclo diario actual**:
```
06:00  researcher       (trends, oportunidades)
07:00  designer         (diseños nuevos)
07:00  marketing AM     (promociones)
08:00  cataloger #1     (crear productos)
09:00  newsletter AM    (campañas email)
10:00  qa_inspector     (verificación calidad)
12:00  customer_mgr #1  (soporte, reviews)
14:00  cataloger #2     (pricing/inventory)
15:00  marketing PM     (push social)
16:00  seo_manager      (domingos solamente)
17:00  newsletter PM    (campañas tarde)
18:00  cataloger #3     (peak prep)
22:00  customer_mgr #2  (soporte nocturno)
23:00  finance          (reconciliación diaria)
23:30  consolidation    (memoria → weekly)
```

**Problema central**: El event queue existe (`event_queue.py`, 462 LOC) pero está **infrautilizado**. Los eventos se drenan solo durante heartbeat (cada 30min) o por el urgent drain loop (cada 60s). No hay dispatch inmediato.

### OpenClaw: 85-95% Event-Driven

| Métrica | Valor |
|---------|-------|
| Modelo de ejecución | Event-driven push |
| Latencia típica | <100ms |
| Activación | Mensaje de canal, webhook, voice, CLI, heartbeat |
| Worker model | Per-session isolated lanes |
| Comunicación | Gateway WebSocket (broadcast real-time) |
| Disponibilidad | 24/7 (channel listeners always-on) |
| Graceful shutdown | Espera in-flight replies (0 mensajes perdidos) |

**Flujo de ejecución**:
```
Canal (WhatsApp/Telegram/etc.) → listener always-on
  ↓ evento push inmediato
Gateway dispatchInboundMessage()
  ↓ <100ms
Agent session (isolated, per-conversation)
  ↓ streaming
Reply delivered to channel
```

---

## 2. Gap Analysis: Qué le Falta a PodClaw

### 2.1 Activación por Eventos (No existe)

PodClaw no puede reaccionar a eventos en tiempo real:
- Email de cliente → espera hasta próximo cron de customer_manager (hasta 10h)
- Pedido nuevo en Stripe → espera hasta finance (23:00)
- Diseño generado por designer → espera 1h para cataloger
- Alerta de pricing de finance → espera 15h para cataloger

**OpenClaw equivalente**: Webhook `POST /hooks/agent` → 202 Accepted → agent ejecuta inmediatamente.

### 2.2 Comunicación Inter-Agente Directa (No existe)

| Ruta | Latencia actual | Latencia ideal |
|------|-----------------|----------------|
| researcher → designer | 1h (via best_sellers.md) | <1min (evento directo) |
| designer → cataloger | 1h (via design_library.md) | <1min |
| cataloger → qa_inspector | 22h (reports diarios) | <5min |
| finance → cataloger | 15h (via pricing_history.md) | <1min |
| qa_inspector → designer | 22h | <5min |

### 2.3 Customer Service Reactivo (No existe)

PodClaw ejecuta customer_manager 2x/día (12:00 y 22:00). Un email de cliente a las 12:05 espera hasta las 22:00 (10h).

**OpenClaw equivalente**: Webhook de email (Gmail Pub/Sub) → agent responde en <1min.

### 2.4 Ejecución Continua (No existe)

PodClaw tiene 6h completamente idle (00:00-05:59 UTC) donde ni siquiera heartbeat funciona (pausa fuera de active hours 05:00-23:00).

### 2.5 Graceful Shutdown (Parcial)

PodClaw puede perder trabajo si se mata durante ejecución. OpenClaw espera todos los in-flight replies antes de shutdown.

---

## 3. Arquitectura Propuesta: PodClaw v2

### 3.1 Modelo Híbrido: Event-First + Cron-Fallback

No abandonar cron completamente — algunos trabajos son inherentemente batch (consolidación de memoria, reconciliación financiera). Pero el **flujo principal** debe ser event-driven.

```
┌─────────────────────────────────────────────────┐
│                  EVENT BUS                       │
│         (Redis Streams o asyncio Queue)          │
├─────────────────────────────────────────────────┤
│                                                   │
│  SOURCES (Push)              CONSUMERS            │
│  ├─ Webhooks (Stripe,       ├─ Orchestrator       │
│  │   Printful, email)       │   ├─ researcher     │
│  ├─ Bridge API              │   ├─ designer       │
│  │   (admin chat)           │   ├─ cataloger      │
│  ├─ Heartbeat               │   ├─ marketing      │
│  │   (health alerts)        │   ├─ customer_mgr   │
│  ├─ Inter-agent events      │   ├─ finance        │
│  │   (handoffs)             │   ├─ qa_inspector   │
│  ├─ Cron scheduler          │   ├─ newsletter     │
│  │   (batch jobs)           │   ├─ seo_manager    │
│  └─ System events           │   └─ brand_manager  │
│     (startup, shutdown)     │                      │
│                              └─ Event Processor    │
│                                  (priority queue)  │
└─────────────────────────────────────────────────┘
```

### 3.2 Componentes Nuevos

#### A) Event Router (reemplaza urgent_drain_loop)
```python
class EventRouter:
    """Dispatch inmediato por prioridad, no por timer."""

    async def route(self, event: SystemEvent):
        if event.priority == Priority.CRITICAL:
            # Preempt current low-priority task
            await self.orchestrator.preempt_and_run(event.target_agent, event.task)
        elif event.priority == Priority.HIGH:
            # Execute next (bypass queue)
            await self.orchestrator.run_agent(event.target_agent, event.task)
        elif event.priority == Priority.NORMAL:
            # Queue for next available slot
            await self.event_queue.push(event)
        else:
            # Low priority — next heartbeat
            await self.event_queue.push(event)
```

#### B) Webhook Receiver (nuevo endpoint en Bridge)
```python
@app.post("/webhooks/{provider}")
async def receive_webhook(provider: str, request: Request):
    """Receive and dispatch external webhooks immediately."""
    body = await request.json()

    if provider == "stripe":
        event = map_stripe_event(body)
        await event_router.route(SystemEvent(
            source=f"webhook:stripe",
            event_type=event.type,
            target_agent="finance" if "payment" in event.type else "customer_manager",
            priority=Priority.HIGH,
            payload=body,
        ))
    elif provider == "printful":
        event = map_printful_event(body)
        await event_router.route(SystemEvent(
            source=f"webhook:printful",
            event_type=event.type,
            target_agent="cataloger",
            priority=Priority.NORMAL,
            payload=body,
        ))
    elif provider == "email":
        await event_router.route(SystemEvent(
            source="webhook:email",
            event_type="customer_email",
            target_agent="customer_manager",
            priority=Priority.HIGH,
            payload=body,
        ))

    return {"status": "accepted"}  # 202-style
```

#### C) Agent Handoff Protocol (nuevo)
```python
# En cada tool handler de agente, al completar trabajo:
async def designer_complete_handler(result, event_queue):
    """Designer completa diseño → notifica cataloger."""
    if result.get("designs_created"):
        await event_queue.push(SystemEvent(
            source="agent:designer",
            event_type="designs_ready",
            target_agent="cataloger",
            priority=Priority.NORMAL,
            wake_mode="now",
            payload={"design_ids": result["designs_created"]},
        ))
```

#### D) Priority Queue (reemplaza FIFO)
```python
class PriorityEventQueue:
    """Cola con prioridades: CRITICAL > HIGH > NORMAL > LOW."""

    def __init__(self):
        self._queue = asyncio.PriorityQueue()

    async def push(self, event: SystemEvent):
        await self._queue.put((event.priority.value, event.created_at, event))

    async def pop(self) -> SystemEvent:
        _, _, event = await self._queue.get()
        return event
```

### 3.3 Tareas que Migran de Cron a Event-Driven

| Tarea | Trigger Actual | Trigger Propuesto | Prioridad |
|-------|---------------|-------------------|-----------|
| Customer support | Cron 12:00, 22:00 | Webhook email/Stripe → inmediato | ALTA |
| Cataloger pricing | Cron 14:00 | Finance alert event → inmediato | ALTA |
| Designer → Cataloger | Cron 07:00 → 08:00 (1h gap) | designer_complete event → <1min | ALTA |
| QA → Designer rework | Cron 10:00 → 07:00+1d (22h) | qa_issue event → <5min | MEDIA |
| Researcher → Marketing | Cron 06:00 → 07:00 (1h gap) | trends_ready event → <5min | MEDIA |
| Order fulfillment | Cron finance 23:00 | Stripe webhook → inmediato | ALTA |
| Printful sync | Cron cataloger 18:00 | Printful webhook → inmediato | MEDIA |

### 3.4 Tareas que Permanecen en Cron

| Tarea | Razón | Schedule |
|-------|-------|----------|
| Memory consolidation | Batch por naturaleza | 23:30 daily |
| Production governor | Decisión diaria basada en métricas | 05:55 daily |
| Memory decay | Mantenimiento periódico | 04:00 daily |
| SEO analysis | Semanal, no urgente | Domingos 16:00 |
| Brand audit | Semanal, no urgente | Lunes 08:00 |
| Newsletter campaigns | Programado por marketing calendar | 09:00, 17:00 |

---

## 4. Definición Clara de Agentes v2

### 4.1 Estructura Propuesta

```
podclaw/
├── orchestrator.py          # Event router + session manager
├── agents/
│   ├── base.py              # BaseAgent con lifecycle hooks
│   ├── researcher.py        # Trigger: cron + event
│   ├── designer.py          # Trigger: event (trends_ready) + cron fallback
│   ├── cataloger.py         # Trigger: event (designs_ready, pricing_alert) + cron
│   ├── marketing.py         # Trigger: event (trends_ready) + cron
│   ├── newsletter.py        # Trigger: cron (programmed campaigns)
│   ├── customer_manager.py  # Trigger: event (email, refund) + cron fallback
│   ├── finance.py           # Trigger: event (stripe webhook) + cron fallback
│   ├── qa_inspector.py      # Trigger: event (product_created) + cron
│   ├── seo_manager.py       # Trigger: cron (weekly)
│   └── brand_manager.py     # Trigger: cron (weekly)
├── skills/
│   ├── researcher/SKILL.md
│   ├── designer/SKILL.md
│   ├── cataloger/SKILL.md
│   └── ...                  # Un SKILL.md por agente
├── tasks/
│   ├── task_registry.py     # Task definitions con trigger conditions
│   └── task_types.py        # Dataclasses para task payloads
├── connectors/
│   ├── supabase_connector.py
│   ├── printful_connector.py  # NUEVO (reemplaza printify)
│   ├── stripe_connector.py
│   ├── fal_connector.py
│   ├── gemini_connector.py
│   ├── resend_connector.py
│   ├── crawl4ai_connector.py
│   ├── telegram_connector.py
│   ├── whatsapp_connector.py
│   ├── memory_connector.py
│   └── delegate_connector.py
├── hooks/                   # Sin cambios (security, cost, rate limit)
├── bridge/                  # + webhook receiver endpoint
├── config.py               # + event routing config
├── event_router.py          # NUEVO: priority dispatch
└── event_queue.py           # Upgrade: priority queue
```

### 4.2 Agent Base Class v2

```python
class BaseAgent:
    name: str
    model: str
    tools: list[str]
    context_files: list[str]

    # NUEVO: Trigger configuration
    triggers: list[Trigger] = [
        CronTrigger("0 8 * * *"),           # Cron fallback
        EventTrigger("designs_ready"),        # Event-driven
        WebhookTrigger("printful:product_*"), # External webhook
    ]

    # NUEVO: Handoff configuration
    on_complete: list[Handoff] = [
        Handoff(target="cataloger", event="designs_ready", condition="designs_created > 0"),
    ]

    # Existing
    budget_usd: float
    daily_budget_eur: float
    rate_limits: dict[str, int]
```

---

## 5. Conector Printful: Diseño Modular

### 5.1 Estado Actual

| Componente | Printify | Printful |
|-----------|----------|----------|
| Frontend (PODProvider) | Deprecated | **Completo** (21 ops) |
| PodClaw connector | **Activo** (29 tools) | **No existe** |
| Webhooks | HMAC signature | Query-string secret |
| API base | api.printify.com/v1 | api.printful.com |
| Response format | Direct JSON | `{ code, result, paging }` envelope |

### 5.2 Nuevo Conector: `printful_connector.py`

**21 tools mínimo**, mapeados desde PrintfulProvider del frontend:

**Catálogo (3)**:
- `printful_get_blueprints` → getCatalogProducts()
- `printful_get_blueprint` → getCatalogProduct(id)
- `printful_get_variants` → getCatalogProduct(id).variants

**Productos (5)**:
- `printful_create_product` → createSyncProduct()
- `printful_get_product` → getSyncProduct(id)
- `printful_list_products` → listSyncProducts()
- `printful_update_product` → read-modify-write
- `printful_delete_product` → deleteSyncProduct(id)

**Pedidos (4)**:
- `printful_create_order` → createOrder(body, confirm=true)
- `printful_get_order` → getOrder(id)
- `printful_submit_production` → confirmOrder(id)
- `printful_cancel_order` → cancelOrder(id) (DELETE)

**Diseños (3)**:
- `printful_upload_file` → createFile()
- `printful_get_file` → getFile(id)
- `printful_create_mockup` → createMockupTask()

**Shipping (1)**:
- `printful_get_shipping_rates` → getShippingRates()

**Metadata (2)**:
- `printful_get_store` → getStore()
- `printful_health_check` → getStore() ping

**Webhooks (2)**:
- `printful_verify_webhook` → query-string secret validation
- `printful_normalize_event` → event type mapping

**Seguridad** (reutilizar de printify_connector):
- SSRF protection (hostname resolution)
- Image URL validation (HTTPS + whitelist)
- Safe ID regex
- Circuit breaker (5 failures → 60s open)
- Retry con exponential backoff (2s, 4s, 8s)
- Duplicate title detection (Levenshtein)

### 5.3 Migración: Plan de 4 Semanas

**Semana 1**: Core connector (10 tools básicos, tests unitarios)
**Semana 2**: Features (uploads, mockups, rate limiting, SSRF)
**Semana 3**: Production (circuit breaker, retries, webhooks, config)
**Semana 4**: Testing E2E + dual-provider + cutover gradual

**Coexistencia**: Printify y Printful coexisten hasta cutover completo. Feature flag en config:
```python
POD_PROVIDER = os.environ.get("POD_PROVIDER", "printful")  # "printify" | "printful"
```

---

## 6. Archivos Clave a Modificar/Crear

### Archivos Nuevos

| Archivo | Propósito | Fase |
|---------|-----------|------|
| `podclaw/event_router.py` | Priority dispatch, preemption | Event-driven |
| `podclaw/connectors/printful_connector.py` | Nuevo conector Printful | Connector |
| `podclaw/tasks/task_registry.py` | Task definitions con triggers | Architecture |
| `podclaw/tasks/task_types.py` | Dataclasses para payloads | Architecture |
| `podclaw/bridge/webhooks.py` | Webhook receiver endpoint | Event-driven |

### Archivos a Modificar

| Archivo | Cambio | Fase |
|---------|--------|------|
| `config.py` | + PRINTFUL_* vars, + event routing config, + trigger definitions | Config |
| `core.py` | + preempt_and_run(), refactor run_agent() para soportar event triggers | Core |
| `event_queue.py` | PriorityQueue en vez de FIFO, dispatch inmediato | Core |
| `scheduler.py` | Reducir cron jobs, delegar a event router | Core |
| `heartbeat.py` | Integrar con event_router en vez de drain manual | Core |
| `main.py` | + printful connector registration, + webhook routes | Config |
| `bridge/api.py` | + POST /webhooks/{provider} endpoint | Bridge |
| `SOUL.md` | Actualizar identidad para modelo event-driven | Identity |

### Archivos Existentes Sin Cambios

- `hooks/security_hook.py` — Seguridad no cambia
- `hooks/cost_guard_hook.py` — Budget no cambia
- `hooks/rate_limit_hook.py` — Rate limits no cambian
- `memory_manager.py` — Consolidation no cambia
- `connector_adapter.py` — Patrón SDK adapter no cambia
- Todos los demás conectores (supabase, stripe, fal, gemini, resend, crawl4ai, telegram, whatsapp)

---

## 7. Impacto Esperado

### Métricas de Mejora

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Utilización | 52% | 70-75% | +40% |
| Latencia inter-agente | 1-22h | <5min | 95%+ |
| Latencia customer support | hasta 10h | <1min | 99%+ |
| Latencia pricing alerts | 15h | <1min | 99%+ |
| Idle time | 11.5h/día | 6-7h/día | -40% |
| Event processing | 60s mínimo | <1s | 98%+ |
| Mensajes perdidos en shutdown | Posible | 0 | 100% |

### Costes

- **LLM cost**: Podría aumentar 10-20% por sesiones más frecuentes pero más cortas
- **Infra cost**: Sin cambios (Redis ya existe, no se añaden servicios)
- **Dev cost**: ~6-8 semanas para implementación completa

### Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Sobrecarga por demasiados eventos | Rate limiting en event router + daily budget caps |
| Event storms (webhook flood) | Deduplication + circuit breaker en webhook receiver |
| Regression en cron jobs | Cron permanece como fallback, event-driven es opt-in |
| Printful API downtime | Circuit breaker + Printify fallback durante transición |

---

## 8. Roadmap de Implementación

### Fase 1: Event Infrastructure (2 semanas)
1. `event_router.py` con priority dispatch
2. `PriorityEventQueue` (upgrade event_queue.py)
3. Agent handoff protocol (designer→cataloger, finance→cataloger)
4. Webhook receiver en bridge (`POST /webhooks/{provider}`)
5. Tests unitarios para routing y prioridades

### Fase 2: Printful Connector (3-4 semanas)
1. `printful_connector.py` (21 tools)
2. SSRF, circuit breaker, retries
3. Dual-provider coexistence
4. Tests E2E contra Printful sandbox
5. Cutover gradual con feature flag

### Fase 3: Customer Service Reactivo (1-2 semanas)
1. Email webhook integration (Resend inbound o IMAP)
2. Stripe webhook → customer_manager dispatch
3. Refund flow event-driven
4. Tests E2E para flujo completo

### Fase 4: Full Event-Driven (2-3 semanas)
1. Migrar todos los handoffs inter-agente a eventos
2. Reducir cron schedule a solo batch jobs
3. Heartbeat integrado con event router
4. Graceful shutdown (esperar in-flight)
5. Monitoring dashboard (pending events, latencias)

**Total estimado: 8-11 semanas**

---

## 9. Conclusión

PodClaw tiene una base arquitectónica sólida (seguridad, budget enforcement, memory system) pero opera con un modelo de ejecución obsoleto (100% cron) que desperdicia 48% del tiempo disponible y genera latencias de horas en comunicación inter-agente.

La evolución hacia un modelo event-driven no requiere reescribir el sistema — los componentes clave (event_queue, heartbeat, hooks) ya existen. Lo que falta es:

1. **Un event router con priority dispatch** (reemplaza urgent_drain_loop)
2. **Webhook receiver** para eventos externos (Stripe, Printful, email)
3. **Agent handoff protocol** para comunicación directa inter-agente
4. **Nuevo conector Printful** (el frontend ya migró, el backend debe seguir)

El modelo final es **híbrido**: event-driven para trabajo reactivo (customer service, handoffs, webhooks) + cron para trabajo batch (consolidación, governor, SEO semanal). Esto acerca PodClaw al nivel de autonomía de OpenClaw manteniendo las fortalezas únicas del sistema actual (production governor, security hooks, budget enforcement).

---

*Documento generado a partir de 3 agentes de investigación especializados analizando PodClaw (scheduler, core, config, event_queue, heartbeat, connectors, skills) y OpenClaw (gateway, agents, channels, cron, hooks, skills) en paralelo.*
