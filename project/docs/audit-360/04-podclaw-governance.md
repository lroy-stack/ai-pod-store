# Audit 360 — 04: PodClaw & Gobernanza IA

> **Fecha**: 2026-02-23 | **Alcance**: Sistema de agentes, Bridge API, gobernanza, observabilidad, Printify sync

---

## 1. Estado Actual

### 1.1 Inventario de Agentes (10 agentes)

Todos los agentes estan definidos en `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/core.py` (linea 28-32) y cada uno tiene su clase Python en `podclaw/agents/`.

| Agente | Modelo | Horario (UTC) | Budget/Sesion (USD) | Budget Diario (EUR) | Conectores MCP | Estado |
|--------|--------|---------------|---------------------|---------------------|----------------|--------|
| researcher | Haiku 4.5 | 06:00 | $0.60 | 1.50 | supabase, crawl4ai | REAL |
| marketing | Sonnet 4.5 | 07:00, 15:00 | $1.00 | 2.00 | supabase, crawl4ai, resend, telegram, whatsapp | REAL |
| designer | Sonnet 4.5 | 07:00 | $1.50 | 3.00 | supabase, fal, printify, crawl4ai, gemini | REAL |
| newsletter | Sonnet 4.5 | 09:00, 17:00 | $0.80 | 1.50 | supabase, resend, gemini | REAL |
| cataloger | Sonnet 4.5 | 08:00, 14:00, 18:00 | $6.00 | 15.00 | supabase, printify, gemini | REAL |
| customer_manager | Sonnet 4.5 | 12:00, 22:00 | $1.00 | 2.00 | supabase, resend, stripe, telegram, whatsapp, printify | REAL |
| seo_manager | Haiku 4.5 | 16:00 (Dom) | $0.50 | 1.00 | supabase, crawl4ai | REAL |
| finance | Sonnet 4.5 | 23:00 | $1.20 | 2.50 | supabase, stripe | REAL |
| qa_inspector | Haiku 4.5 | 10:00 | $0.15 | 0.15 | supabase, gemini, printify | REAL |
| brand_manager | Sonnet 4.5 | 08:00 (Lun) | $0.80 | 1.50 | supabase, printify | REAL |

**Presupuesto diario total**: EUR 30.15 (limite global configurable: EUR 30.00 via `GLOBAL_DAILY_SPEND_LIMIT_EUR`).

**Evaluacion**: Los 10 agentes son implementaciones REALES, no stubs. Cada clase hereda de `BaseAgent` (`podclaw/agents/base.py`) y provee `default_task()` y `system_prompt_additions()`. Sin embargo, los agentes son esencialmente **objetos de configuracion** -- toda la logica reside en los prompts de tarea enviados a Claude, no en codigo Python.

### 1.2 Flujo de Ejecucion

Definido en `podclaw/core.py` (`Orchestrator.run_agent()`, linea 147):

1. **APScheduler cron trigger** dispara a la hora programada (`podclaw/scheduler.py`)
2. `Orchestrator.run_agent(agent_name)` inicia
3. Verificaciones pre-ejecucion:
   - Kill-switch: `_disabled_agents` set (persiste via StateStore SQLite)
   - Circuit breaker: consulta `agent_events` en Supabase (>=3 errores en 24h = abierto)
   - Session lock: `asyncio.Lock` con timeout de 60s impide ejecucion concurrente
4. Reset de contadores de rate limit (`rate_limit_hook.reset_counters()`)
5. `ClientFactory.create_client()` construye el cliente Claude SDK con:
   - System prompt (preambulo seguridad + SKILL.md + archivos contexto)
   - Seleccion de MCP servers segun `AGENT_TOOLS` mapping
   - Cadena de hooks: security (fail-closed), cost_guard, rate_limit
   - Budget cap: `max_budget_usd` del SDK
   - SandboxSettings habilitado
6. `client.query(prompt)` ejecuta el agente
7. Resultados registrados en: daily memory, event store, audit log, session table
8. **Aprendizaje incremental**: Haiku extrae insights clave y los persiste a MEMORY.md

### 1.3 Retry y Deferred Retry

`run_agent_with_retry()` (core.py ~linea 430):
- **Reintentos inmediatos**: hasta 2 con backoff exponencial (5s, 10s)
- **Reintento diferido**: si todos fallan, programa un one-shot via scheduler
- Los reintentos usan `session resume` (no inician de cero) para preservar contexto

### 1.4 Skills (10 SKILL.md)

Ubicacion: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/skills/{agent_name}/SKILL.md`

| Skill | Tamano | Evaluacion |
|-------|--------|------------|
| researcher | 4,513 bytes | COMPLETO -- ciclo detallado, inventario de herramientas |
| marketing | 3,014 bytes | COMPLETO -- contenido por plataforma, reglas de persistencia |
| designer | 9,682 bytes | COMPLETO -- politica sourcing-first, tablas de dimensiones, quality gates |
| cataloger | 9,026 bytes | COMPLETO -- workflow 3 ciclos, modelo de precios, validacion EU |
| customer_manager | 3,273 bytes | COMPLETO -- segmentos RFM, umbrales de reembolso |
| finance | 3,301 bytes | COMPLETO -- reconciliacion, scorecard, deteccion anomalias |
| newsletter | 2,855 bytes | COMPLETO -- CAN-SPAM, drip sequences, A/B testing |
| qa_inspector | 5,367 bytes | COMPLETO -- QA visual, chequeo variantes, correlacion conversion |
| seo_manager | 2,133 bytes | COMPLETO -- meta tags, hreflang, datos estructurados |
| brand_manager | 2,685 bytes | COMPLETO -- etiquetas cuello, packaging, guardrails |

### 1.5 Conectores (12 conectores)

Ubicacion: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/connectors/`

| Conector | Lineas | Operaciones Clave | Estado |
|----------|--------|-------------------|--------|
| **printify** | 1,071 | CRUD productos, ordenes, blueprints, webhooks, GPSR | REAL, produccion |
| **supabase** | ~500 | query, insert, update, delete, rpc, vector_search, upload_image | REAL |
| **stripe** | 182 | list_charges, get_balance, revenue_report, create_refund, disputes, payouts | REAL |
| **fal** | ~500 | generate (4 modelos FLUX), get_status, remove_bg, upscale | REAL |
| **gemini** | ~450 | check_image (quality), generate_image, embed_text, embed_batch | REAL |
| **crawl4ai** | ~650 | crawl_url, crawl_batch, extract_article, crawl_site, capture_screenshot | REAL |
| **resend** | ~180 | send, send_batch | REAL |
| **telegram** | ~150 | send, send_photo, broadcast | REAL |
| **whatsapp** | ~130 | send, send_template | REAL |
| **memory** | ~350 | SQLite cognitive memory con busqueda semantica | REAL |
| **delegate** | ~230 | Delegacion cross-agent con modo async | REAL |

**Seguridad en Printify connector**:
- Proteccion SSRF via `_resolve_and_check_ssrf()` (bloquea IPs privadas/reservadas)
- Allowlist de hosts para imagenes (`_ALLOWED_IMAGE_HOSTS`)
- Validacion de URLs webhook con hosts permitidos
- Validacion segura de IDs via regex
- Connection pooling via `httpx.AsyncClient` compartido

### 1.6 Bridge API

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/bridge/api.py` (958 lineas)

**40+ endpoints** organizados por categoria:

| Categoria | Endpoints | Descripcion |
|-----------|----------|-------------|
| Tasks | `POST /task`, `GET /task/{id}`, `GET /tasks` | Enrutamiento de tareas en lenguaje natural |
| Orchestrator | `POST /start`, `GET /status`, `POST /stop` | Control de ciclo de vida |
| Agents | `GET /agents`, `GET /agents/{name}`, `POST /agents/{name}/run`, `/pause`, `/resume`, `/disable`, `/enable` | Gestion individual |
| Events | `GET /events`, `GET /sessions`, `GET /sessions/{id}/events` | Consulta de eventos |
| Metrics | `GET /metrics`, `GET /costs` | Costos y metricas |
| Schedule | `GET /schedule`, `PUT /schedule`, `PUT /schedule/{agent}` | Gestion de horarios |
| Memory | `GET /memory`, `GET /memory/daily`, `GET /memory/context/{file}`, `GET /memory/soul` | Acceso a memoria |
| Heartbeat | `GET /heartbeat/status`, `POST /heartbeat/trigger`, `/pause`, `/resume`, `GET /heartbeat/alerts` | Monitor de pulso |
| Queue | `GET /queue`, `POST /queue/push` | Cola de eventos |
| Soul | `GET /soul`, `GET /soul/proposals`, `POST /soul/proposals/{id}/approve\|reject` | Evolucion de identidad |
| Chat | `POST /chat/stream` (SSE), `GET /chat/conversations`, `DELETE /chat/conversations/{id}` | Chat admin |
| ReadOnly | `POST /readonly/enable\|disable`, `GET /readonly` | Modo lectura |
| Health | `GET /health`, `GET /api/health` | Health checks |

**Autenticacion** (`podclaw/bridge/auth.py`):
- Bearer token via `require_auth` FastAPI dependency
- Comparacion constant-time (`secrets.compare_digest`)
- Localhost exento (127.0.0.1, ::1)
- Rate limiting en auth fallidos: sliding window con lockout (10 fallos en 60s = bloqueo 5 min)
- Si auth habilitado pero token vacio: `sys.exit(1)` al arranque

**Validacion de requests** (Pydantic):
- `TaskRequest`: 1-5000 caracteres
- `ChatStreamRequest`: 1-10000 caracteres
- `QueuePushRequest`: event_type requerido, payload max 10KB

### 1.7 Production Governor

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/production_governor.py` (27,876 bytes)

Controlador adaptativo de produccion condicionado por mercado:
- Se ejecuta a las 05:55 UTC diariamente
- Calcula limites de produccion basados en: trafico, ventas, calidad, costos
- Modo "proxy" (sin datos reales de vistas) o modo "real"
- Controles anti-saturacion (soft: 15%, hard: 25%)
- Comportamiento cold-start: max 3 productos/dia durante 14 dias
- Deteccion de presion presupuestaria
- **Fail-safe**: limit=1 producto/dia, generacion IA deshabilitada si no hay cache

---

## 2. Gaps Detectados

### 2.1 Gaps Criticos

| # | Gap | Archivo/Ubicacion | Impacto |
|---|-----|-------------------|---------|
| G1 | **Estado en memoria** -- rate limits, refund tracking, session locks usan variables Python a nivel modulo | `hooks/rate_limit_hook.py`, `hooks/cost_guard_hook.py`, `core.py` | Reset en restart, no funciona multi-instancia |
| G2 | **Sin cola de trabajo externa** -- ejecucion de agentes bloquea dentro del proceso FastAPI | `core.py`, `bridge/api.py` | Bridge API no-responsive durante ejecucion |
| G3 | **Output schemas sin enforcement** -- `AGENT_OUTPUT_SCHEMAS` definido para 3 agentes pero nunca validado post-ejecucion | `config.py` linea 350-377 | Salidas inconsistentes, no se puede confiar en formato |
| G4 | **Sin metricas Prometheus/OpenTelemetry** -- solo logging estructurado | Todo el sistema | Sin dashboards, sin alertas automaticas |
| G5 | **Heartbeat no reporta al admin dashboard** -- solo escribe a HEARTBEAT.md y logs | `heartbeat.py` | Decisiones invisibles en UI |
| G6 | **Production Governor sin tests** -- 27,876 bytes de logica critica sin cobertura | `production_governor.py` | Regresiones silenciosas |
| G7 | **Chat session sin tests unitarios** -- 34,130 bytes de streaming SSE sin cobertura | `chat_session.py` | Vulnerabilidades en chat admin |
| G8 | **Soul evolution sin tests** -- mutacion controlada de SOUL.md sin verificacion | `soul_evolution.py` | Cambios de identidad no verificados |

### 2.2 Gaps de Gobernanza

| # | Gap | Detalle |
|---|-----|---------|
| G9 | **Sin visualizacion de decisiones** -- no hay forma grafica de ver que decidio cada agente y por que | Solo texto en logs y daily memory |
| G10 | **Sin sistema de reputacion** -- no hay scoring de calidad por agente a lo largo del tiempo | No hay metricas historicas de exito/fallo |
| G11 | **Sin consola de comandos en tiempo real** -- el admin no puede intervenir mientras un agente esta ejecutando | Solo puede deshabilitar/pausar pre/post ejecucion |
| G12 | **Escalation solo en SOUL.md** -- no hay workflow de aprobacion real (ticket, email, UI) | El agente simplemente no actua, sin notificar |

---

## 3. Riesgos

### 3.1 Riesgos Operativos

| Riesgo | Probabilidad | Impacto | Mitigacion Actual |
|--------|-------------|---------|-------------------|
| **Gasto desbocado** por agente con bug en prompt | Media | Alto (EUR 30/dia max) | Dual defense: SDK `max_budget_usd` + `cost_guard_hook` |
| **Agente crea productos inapropiados** en Printify | Baja | Alto (reputacion) | QA inspector post-creacion, quality gate hook |
| **Perdida de estado en restart** (rate limits, refund tracking) | Alta (en deploy) | Medio | Ninguna -- variables en memoria |
| **Bridge API bloqueada** durante sesion larga de cataloger | Alta | Medio | Timeout 15min, pero no hay separacion worker |
| **Circuit breaker falso positivo** por errores transitorios | Media | Medio | Umbral de 3 errores en 24h puede ser demasiado agresivo |

### 3.2 Riesgos de Seguridad

| Riesgo | Probabilidad | Impacto | Mitigacion Actual |
|--------|-------------|---------|-------------------|
| **Token de bridge en .env sin rotacion** | Alta | Critico | Sin mecanismo de rotacion automatica |
| **Prompt injection via datos de cliente** en customer_manager | Media | Alto | Security preamble + `[DATA]` boundaries + patron injection detection |
| **SSRF via printify connector** | Baja | Alto | `_resolve_and_check_ssrf()` activo |
| **Escalation sin notificacion real** | Media | Alto | El agente registra pero no hay canal de notificacion garantizado |

### 3.3 Riesgos a Escala (1000+ tenants)

| Riesgo | Detalle |
|--------|---------|
| **Arquitectura single-tenant** | Config hardcoded con shop IDs unicos, un set de API keys. Rediseno fundamental requerido |
| **Connection pool exhaustion** en Supabase | Todos los agentes + MCP + frontend comparten una instancia |
| **Sin queue/worker** para distribuir trabajo | Imposible escalar horizontalmente sin Celery/SQS |
| **Scheduler en memoria** | APScheduler solo funciona en un proceso -- no distribuido |

---

## 4. Quick Wins

| # | Quick Win | Esfuerzo | Impacto |
|---|-----------|----------|---------|
| QW1 | **Exponer OpenAPI docs** del Bridge -- FastAPI los genera automaticamente, solo habilitar `/docs` | 30 min | Alto -- documentacion instantanea |
| QW2 | **Mover daily_refund_total y rate limits a Redis** | 2-4h | Medio -- estado persistente entre restarts |
| QW3 | **Agregar health check para Production Governor** en el dashboard admin | 1-2h | Medio -- visibilidad de decisiones |
| QW4 | **Tests para Production Governor** -- la logica es pura (sin I/O), facil de testear | 4-6h | Alto -- 27KB de codigo critico cubierto |
| QW5 | **Webhook de notificacion en escalation** -- enviar Telegram cuando un agente escala | 2-3h | Alto -- admin enterado en tiempo real |
| QW6 | **Agregar `AGENT_OUTPUT_SCHEMAS` enforcement** post-ejecucion con logging de desviaciones | 2-3h | Medio -- outputs estructurados confiables |

---

## 5. Refactor Estructural Recomendado

### 5.1 Separar Bridge API de Ejecucion de Agentes

**Problema**: La ejecucion de agentes bloquea el proceso FastAPI.

**Solucion propuesta**:
```
Bridge API (FastAPI) ──> Redis Queue ──> Worker Process(es)
      ^                                        |
      └────── Result Channel (Redis Pub/Sub) ──┘
```

Archivos afectados:
- `podclaw/core.py` -- extraer ejecucion a worker
- `podclaw/bridge/api.py` -- endpoints async encolan trabajo
- Nuevo: `podclaw/worker.py` -- consume de Redis, ejecuta agentes

### 5.2 Consola de Comandos en Tiempo Real

Agregar capacidad de intervencion mid-execution:
- WebSocket endpoint en Bridge para observar sesion activa
- Comando `STOP_GRACEFUL` que inyecta un tool_result de cancelacion
- UI en admin panel con log streaming

### 5.3 Visualizacion de Decisiones

Dashboard que muestra:
- Timeline de agentes con acciones tomadas
- Arbol de decisiones (que herramientas se llamaron, resultados)
- Metricas de exito/fallo por agente por dia
- Grafico de costos acumulados

Requiere: nuevo endpoint `GET /agents/{name}/decision-tree/{session_id}` que reconstruye la cadena de tool calls desde `agent_events`.

### 5.4 Sistema de Reputacion por Agente

Score calculado de:
- Tasa de exito de sesiones (completadas / total)
- Eficiencia de presupuesto (costo real / costo presupuestado)
- Calidad de outputs (medida por QA inspector)
- Tiempo de ejecucion vs expectativa
- Rate de circuit breaker triggers

Persistir en tabla `agent_reputation` con snapshots diarios.

---

## 6. Roadmap por Fases

### Fase 1: Estabilizacion (Semana 1-2)
- [ ] Mover estado en memoria a Redis (rate limits, refund tracking, cost tracking)
- [ ] Tests para Production Governor, Chat Session, Soul Evolution
- [ ] Habilitar OpenAPI docs en Bridge
- [ ] Notificacion Telegram en escalation

### Fase 2: Observabilidad (Semana 3-4)
- [ ] Metricas Prometheus via `starlette-prometheus` o `prometheus-fastapi-instrumentator`
- [ ] Dashboard Grafana con:
  - Costo por agente por dia
  - Sesiones activas
  - Tool calls por tipo
  - Errores y circuit breakers
- [ ] Health check endpoint para Production Governor
- [ ] Decision tree endpoint para sesiones completadas

### Fase 3: Arquitectura Worker (Semana 5-8)
- [ ] Introducir Redis como message broker
- [ ] Separar worker process de Bridge API
- [ ] Implementar consola de comandos WebSocket
- [ ] Sistema de reputacion por agente

### Fase 4: Multi-Tenant Preparation (Semana 9-12)
- [ ] Abstraer `PRINTIFY_SHOP_ID` a nivel tenant
- [ ] Config por tenant (presupuestos, horarios, skills)
- [ ] Pool de conexiones Supabase con tenant isolation
- [ ] Scheduler distribuido (reemplazar APScheduler in-memory)

---

## 7. Impacto en Escalabilidad

### Capacidad Actual
- **Single-tenant**: 1 tienda, 10 agentes, ~15 sesiones/dia
- **Throughput**: ~1 sesion activa a la vez (lock de sesion)
- **Costo diario**: max EUR 30.15 (controlado)
- **Storage**: Supabase + SQLite local (state_store)

### Limitantes para Escala
1. **APScheduler in-memory**: Un solo proceso, no distribuible
2. **Session lock Python**: Un agente a la vez por instancia
3. **Config.py hardcoded**: API keys, shop IDs, presupuestos globales
4. **Sin horizontal scaling**: Bridge + Orchestrator + Scheduler en un proceso

### Recomendacion
Para escalar mas alla de 1 tienda:
- Migrar scheduler a Celery Beat + Redis
- Worker pool con concurrency controlada
- Config por tenant en base de datos (no archivos)
- Separar Bridge API en servicio stateless escalable horizontalmente

**Conclusion**: El sistema PodClaw es una implementacion madura y bien pensada para single-tenant. Los 10 agentes son reales, con SKILL.md completos, conectores funcionales, y gobernanza solida (dual budget defense, circuit breakers, kill switches, audit trail). Los gaps principales son: estado en memoria, acoplamiento Bridge/Worker, y falta de visualizacion de decisiones. La transicion a multi-tenant requiere un rediseno significativo pero planificable.
