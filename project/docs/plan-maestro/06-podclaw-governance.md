# Plan 06 — PodClaw: Gobernanza, Observabilidad y Persistencia

**Prioridad**: P1
**Estimacion**: 30-40h
**Dependencias**: Plan 03 (Database — tablas `agent_events`, `agent_daily_costs`, partitioning)
**Bloquea**: Plan 11 (Multi-tenant), Plan 08 (Testing — cobertura PodClaw)

---

## 1. Objetivo

Hacer que PodClaw sea resiliente a reinicios, observable en tiempo real, y no-bloqueante. Migrar todo estado efimero a Redis, instrumentar metricas para Grafana, desacoplar la ejecucion de agentes del Bridge API, y cubrir con tests los 3 archivos criticos que controlan produccion, chat y evolucion de identidad.

## 2. Estado Actual (Validado)

| Area | Score | Evidencia |
|------|-------|-----------|
| Agentes | 10/10 | 10 agentes reales, cada uno con clase Python, SKILL.md, y conectores |
| Presupuesto | 9/10 | EUR 30.15/dia, dual defense (SDK `max_budget_usd` + `cost_guard_hook`), global limit |
| Rate Limits | 4/10 | `_counters` dict en memoria (`hooks/rate_limit_hook.py:24`) — se pierde en restart |
| Cost Tracking | 6/10 | `_daily_costs` dict en memoria con fallback a Supabase (`hooks/cost_guard_hook.py:85`) |
| Circuit Breaker | 7/10 | 3 errores/24h = open, consulta `agent_events` en Supabase, con tests |
| Bridge API | 5/10 | 51 endpoints funcionales, pero `POST /agents/{name}/run` bloquea el proceso FastAPI |
| Observabilidad | 2/10 | Solo logging estructurado (structlog). Sin Prometheus, sin Grafana, sin dashboards |
| Health Check | 6/10 | `/health` basico existe, `/api/health` con sub-checks (orchestrator, heartbeat, supabase, scheduler) |
| Production Governor | 3/10 | 27KB de logica critica de negocio — **0 tests** (`production_governor.py`) |
| Chat Session | 3/10 | 34KB de streaming SSE — **0 tests** (`chat_session.py`) |
| Soul Evolution | 3/10 | 16KB de mutaciones de identidad — **0 tests** (`soul_evolution.py`) |
| Event Cleanup | 0/10 | Sin TTL ni cleanup automatico para `agent_events`, `heartbeat_events` |
| State Persistence | 4/10 | SQLite local para state_store, pero rate limits y session locks son in-memory |

### Inventario validado

- **10 agentes**: researcher, marketing, designer, newsletter, cataloger, customer_manager, seo_manager, finance, qa_inspector, brand_manager
- **12 conectores**: printify, supabase, stripe, fal, gemini, crawl4ai, resend, telegram, whatsapp, memory, delegate + rembg (sidecar)
- **51 endpoints Bridge**: tasks (3), orchestrator (3), agents (6), events (3), metrics (2), schedule (2), memory (5), heartbeat (5), queue (2), soul (4), chat (4), readonly (3), health (2), skills (1), plus aliases
- **10 SKILL.md**: todos completos (2KB-10KB cada uno)
- **Presupuesto diario**: EUR 30.15 (configurable via `GLOBAL_DAILY_SPEND_LIMIT_EUR`)

## 3. Gap Estructural

El sistema PodClaw fue construido como single-process: Bridge API + Orchestrator + Scheduler + Heartbeat corren en el mismo proceso Python. Esto tiene tres consecuencias:

1. **Estado volatil**: Los rate limits (`_counters`), cost tracking (`_daily_costs`), session locks (`_session_lock`), y disabled agents (`_disabled_agents`) viven en variables Python a nivel de modulo. Un restart los borra. En produccion esto significa que un agente que ya consumio 14 de 15 tool calls puede reiniciar y consumir 15 mas.

2. **Bloqueo del Bridge**: Cuando `POST /agents/{name}/run` ejecuta un agente, la sesion Claude SDK puede durar 5-15 minutos. Durante ese tiempo, el thread pool de FastAPI se satura y los demas endpoints responden con timeouts. Actualmente solo `POST /task` usa `BackgroundTasks` (`bridge/api.py:300-315`); el resto de ejecuciones bloquean.

3. **Cero observabilidad operativa**: No hay metricas Prometheus, no hay dashboards Grafana, no hay forma de ver costos acumulados, errores por agente, o duracion de sesiones en tiempo real. La informacion existe en logs y en Supabase, pero no se consume de forma visual.

4. **77KB de logica critica sin tests**: `production_governor.py` (27KB), `chat_session.py` (34KB), y `soul_evolution.py` (16KB) controlan respectivamente cuantos productos se crean por dia, el chat directo con el admin, y las mutaciones de identidad del agente. Ninguno tiene un solo test.

## 4. Decision Arquitectonica

### 4.1 Redis como backend de estado efimero (NO SQLite, NO Supabase)

**Justificacion**:
- Redis ya esta en el stack Docker (`docker-compose.yml:206`), en la red `data`, con AOF persistence habilitado
- PodClaw ya tiene `REDIS_URL` inyectado como variable de entorno (`docker-compose.yml:67`)
- Rate limits son datos efimeros con TTL natural (1 sesion o 1 dia) — perfectos para Redis HASH + EXPIRE
- SQLite (StateStore) es local al container y no sobrevive reconstrucciones de imagen
- Supabase seria sobredimensionado para contadores que cambian cientos de veces por hora

### 4.2 BackgroundTasks de FastAPI para desbloquear Bridge (NO Celery/SQS)

**Justificacion**:
- Celery requiere un message broker adicional, workers separados, y complejidad de deployment — sobredimensionado para 10 agentes con ~15 sesiones/dia
- FastAPI `BackgroundTasks` ya se usa para `/task` (`bridge/api.py:300`) — patrón probado en el codebase
- El patron fire-and-forget + polling via `/task/{id}` ya existe — extenderlo a `/agents/{name}/run` es natural
- Para multi-tenant (futuro), se migraria a Celery — pero esa decision es del Plan 11

### 4.3 Prometheus + Grafana para metricas (NO custom dashboards)

**Justificacion**:
- `prometheus-fastapi-instrumentator` instrumenta TODOS los endpoints con 3 lineas de codigo
- Metricas custom (costo/agente, sesiones, errores) se exportan como Counters/Gauges/Histograms
- Grafana ya tiene dashboards pre-armados para FastAPI + Redis
- El admin panel muestra lo que ya muestra (datos de Supabase); Grafana es para ops

### 4.4 Tests unitarios con mocking completo (NO tests de integracion)

**Justificacion**:
- `production_governor.py` es logica pura (calculo matematico) — no necesita I/O real para testear
- `chat_session.py` puede mockearse con `AsyncMock` del SDK de Claude
- `soul_evolution.py` opera sobre strings (SOUL.md) — tests unitarios puros
- Los tests de integracion (agente real hablando con Supabase) ya existen en `tests/e2e/test_agent_flow.py`

## 5. Plan de Implementacion

### Bloque A: Redis State Backend (6h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| A1 | Crear `podclaw/redis_store.py` — wrapper async sobre `redis.asyncio` con operaciones: `incr_with_ttl()`, `get_counter()`, `hset/hget()`, `set_with_ttl()` | Nuevo: `podclaw/redis_store.py` | 2h | G1 |
| A2 | Refactorizar `hooks/rate_limit_hook.py` — reemplazar `_counters` dict por Redis HASH `podclaw:rate:{agent}:{date}` con TTL 24h. Mantener fallback in-memory si Redis no disponible | `podclaw/hooks/rate_limit_hook.py` | 1.5h | G1 |
| A3 | Refactorizar `hooks/cost_guard_hook.py` — mover `_daily_costs` a Redis key `podclaw:cost:{agent}:{date}` con INCRBY-FLOAT y TTL 48h. Eliminar fallback in-memory | `podclaw/hooks/cost_guard_hook.py` | 1h | G1 |
| A4 | Persistir `_disabled_agents` en Redis SET `podclaw:disabled_agents` en lugar de solo memoria + SQLite | `podclaw/core.py` (Orchestrator.__init__, _restore_disabled_agents) | 1h | G1 |
| A5 | Persistir refund tracking (`daily_refund_total`) en Redis key `podclaw:refunds:{date}` con TTL 48h | `podclaw/hooks/cost_guard_hook.py` o `podclaw/connectors/stripe.py` | 0.5h | G1 |

### Bloque B: Bridge API Non-Blocking (5h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| B1 | Crear modelo `AgentTask` (id, agent, status, result, started_at, completed_at) con almacenamiento en Redis | Nuevo: `podclaw/bridge/task_store.py` | 1h | G2 |
| B2 | Refactorizar `POST /agents/{name}/run` — encolar ejecucion via `BackgroundTasks`, retornar `task_id` inmediatamente (HTTP 202) | `podclaw/bridge/api.py:380-420` (aprox) | 1.5h | G2 |
| B3 | Crear `GET /agents/{name}/run/{task_id}` — polling de estado de ejecucion desde Redis | `podclaw/bridge/api.py` | 1h | G2 |
| B4 | Refactorizar `POST /heartbeat/trigger` — mismo patron non-blocking | `podclaw/bridge/api.py:780-800` (aprox) | 0.5h | G2 |
| B5 | Actualizar admin panel proxy routes para usar el patron polling (202 + GET status) | `admin/src/app/api/agent/*/route.ts` | 1h | G2 |

### Bloque C: Observabilidad — Prometheus + Grafana (8h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| C1 | Instalar `prometheus-fastapi-instrumentator` + `prometheus-client` en `requirements.txt` | `podclaw/requirements.txt` | 15min | G4 |
| C2 | Instrumentar Bridge API — `Instrumentator().instrument(app)` + endpoint `/metrics` | `podclaw/bridge/api.py` (al inicio de `create_app()`) | 30min | G4 |
| C3 | Metricas custom — Counters: `podclaw_agent_sessions_total{agent,status}`, `podclaw_tool_calls_total{agent,tool}`, `podclaw_errors_total{agent,error_type}` | Nuevo: `podclaw/metrics.py` | 1.5h | G4 |
| C4 | Metricas custom — Gauges: `podclaw_daily_cost_eur{agent}`, `podclaw_active_sessions`, `podclaw_circuit_breaker_state{agent}` | `podclaw/metrics.py` | 1h | G4 |
| C5 | Metricas custom — Histograms: `podclaw_session_duration_seconds{agent}`, `podclaw_tool_latency_seconds{tool}` | `podclaw/metrics.py` | 1h | G4 |
| C6 | Emitir metricas desde hooks y orchestrator — `cost_guard_hook`, `rate_limit_hook`, `core.py` | Multiples archivos en `podclaw/hooks/`, `podclaw/core.py` | 1.5h | G4 |
| C7 | Dashboard Grafana JSON — paneles: costo/dia por agente, sesiones activas, errores por tipo, duracion de sesiones, tool calls top-10, circuit breaker timeline | Nuevo: `deploy/grafana/dashboards/podclaw.json` | 1.5h | G4 |
| C8 | Agregar Grafana + Prometheus a `docker-compose.yml` — servicio `prometheus` (scrape PodClaw :8000/metrics) + servicio `grafana` (provision dashboard automatico) | `docker-compose.yml`, nuevo: `deploy/prometheus/prometheus.yml` | 1h | G4 |

### Bloque D: Health Endpoint Mejorado + Decision Tree (4h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| D1 | Extender `/api/health` con estado por agente: ultimo run, resultado, circuit breaker state, disabled, costo acumulado hoy | `podclaw/bridge/api.py:892-956` | 1.5h | G5 |
| D2 | Agregar check de Redis connectivity al health endpoint | `podclaw/bridge/api.py:892-956` | 30min | G5 |
| D3 | Agregar check de Production Governor (ultimo calculo, limites vigentes) al health endpoint | `podclaw/bridge/api.py:892-956` | 30min | G5 |
| D4 | Crear `GET /agents/{name}/decision-tree/{session_id}` — reconstruye arbol de tool calls desde `agent_events` con timestamps, inputs resumidos, outputs resumidos, y costos | `podclaw/bridge/api.py`, nuevo: `podclaw/bridge/decision_tree.py` | 1.5h | G9 |

### Bloque E: Cleanup Automatico + TTL (3h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| E1 | Crear funcion SQL `cleanup_old_events(retention_days INT)` — borra `agent_events` con `created_at < NOW() - interval` | Nueva migracion: `supabase/migrations/XXX_event_cleanup.sql` | 1h | — |
| E2 | Crear funcion SQL `cleanup_heartbeat_events(retention_days INT)` — borra `heartbeat_events` antiguos | Misma migracion | 30min | — |
| E3 | Registrar job diario en APScheduler (02:00 UTC) que ejecuta las funciones de cleanup via RPC | `podclaw/scheduler.py` | 30min | — |
| E4 | Endpoint `POST /maintenance/cleanup` para trigger manual con parametro `retention_days` (default: 90) | `podclaw/bridge/api.py` | 30min | — |
| E5 | Agregar index parcial `agent_events(created_at)` para que el DELETE sea eficiente en tablas grandes | Misma migracion | 30min | — |

### Bloque F: Tests de Archivos Criticos (10h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| F1 | Tests `production_governor.py` — cold start (14 dias, max 3/dia) | Nuevo: `podclaw/tests/test_production_governor.py` | 1h | G6 |
| F2 | Tests `production_governor.py` — modo proxy (sin views: `floor(S_7d / 3)`) | `podclaw/tests/test_production_governor.py` | 1h | G6 |
| F3 | Tests `production_governor.py` — modo real (tiers de trafico, anti-saturacion soft/hard) | `podclaw/tests/test_production_governor.py` | 1h | G6 |
| F4 | Tests `production_governor.py` — presion presupuestaria, fail-safe (limit=1) | `podclaw/tests/test_production_governor.py` | 1h | G6 |
| F5 | Tests `production_governor.py` — hook deny/allow basado en cache de decision | `podclaw/tests/test_production_governor.py` | 0.5h | G6 |
| F6 | Tests `chat_session.py` — construccion de system prompt (security preamble, SOUL.md, memory) | Nuevo: `podclaw/tests/test_chat_session.py` | 1h | G7 |
| F7 | Tests `chat_session.py` — flujo SSE (text_delta, tool_start, tool_result, done, error) con SDK mockeado | `podclaw/tests/test_chat_session.py` | 1.5h | G7 |
| F8 | Tests `chat_session.py` — limites (max turns, budget, conversation persistence) | `podclaw/tests/test_chat_session.py` | 1h | G7 |
| F9 | Tests `soul_evolution.py` — proteccion de secciones inmutables (Constraints, Escalation Rules) | Nuevo: `podclaw/tests/test_soul_evolution.py` | 0.5h | G8 |
| F10 | Tests `soul_evolution.py` — review triggers (keywords destructivos), auto-approve vs pending | `podclaw/tests/test_soul_evolution.py` | 0.5h | G8 |
| F11 | Tests `soul_evolution.py` — diff generation, max lines limit, proposal lifecycle (pending/applied/rejected) | `podclaw/tests/test_soul_evolution.py` | 0.5h | G8 |

## 6. Orden de Ejecucion

```
Bloque A (6h) ──→ Bloque B (5h)
      │                │
      ↓                ↓
Bloque C (8h) ──→ Bloque D (4h)
                       │
Bloque E (3h) ←────────┘
      │
      ↓
Bloque F (10h) — puede ejecutarse en paralelo con A/B/C
```

**Dependencias**:
- **A antes de B**: El Bridge non-blocking usa Redis para almacenar estado de tareas (`task_store.py`)
- **A antes de C**: Las metricas Prometheus leen contadores de Redis (no de variables locales)
- **C antes de D**: El health endpoint extendido expone metricas que Prometheus ya scrappea
- **E independiente**: Solo necesita Supabase (no depende de Redis ni Prometheus)
- **F independiente**: Tests unitarios puros, no dependen de infraestructura — **empezar aqui si hay urgencia**

**Ruta critica**: A → B → C → D = 23h secuencial
**Con paralelismo**: A+F en paralelo (6h), luego B+E en paralelo (5h), luego C (8h), luego D (4h) = ~23h elapsed

## 7. Validaciones Tecnicas

| # | Validacion | Criterio de Exito |
|---|-----------|-------------------|
| V1 | Rate limits persisten restart | Ejecutar agente, verificar contador en Redis (`GET podclaw:rate:cataloger:{date}` > 0), restart PodClaw, verificar que el contador sigue ahi |
| V2 | Cost tracking persiste restart | `HGET podclaw:cost:designer:{date}` retorna valor > 0 despues de restart |
| V3 | Bridge no bloquea durante ejecucion | `POST /agents/cataloger/run` → HTTP 202. Simultaneamente `GET /health` responde en <200ms |
| V4 | Polling de tarea funciona | `GET /agents/cataloger/run/{task_id}` → `{"status": "running"}` → eventualmente `{"status": "completed", "result": {...}}` |
| V5 | Prometheus scraping activo | `curl localhost:8000/metrics` retorna metricas en formato Prometheus con `podclaw_agent_sessions_total` |
| V6 | Grafana dashboard carga | Acceder a Grafana → dashboard "PodClaw Operations" muestra paneles con datos reales |
| V7 | Health endpoint completo | `GET /api/health` retorna estado por agente, Redis connectivity, Production Governor status |
| V8 | Decision tree reconstruye sesion | `GET /agents/cataloger/decision-tree/{session_id}` retorna arbol JSON con tool calls, timestamps, costos |
| V9 | Cleanup ejecuta sin errores | `POST /maintenance/cleanup?retention_days=90` → `{"deleted_events": N, "deleted_heartbeat": M}` |
| V10 | Tests de Production Governor pasan | `pytest podclaw/tests/test_production_governor.py -v` → 15+ tests, 100% pass |
| V11 | Tests de Chat Session pasan | `pytest podclaw/tests/test_chat_session.py -v` → 10+ tests, 100% pass |
| V12 | Tests de Soul Evolution pasan | `pytest podclaw/tests/test_soul_evolution.py -v` → 8+ tests, 100% pass |
| V13 | Disabled agents persisten restart | Deshabilitar agente via `/agents/researcher/disable`, restart PodClaw, verificar que sigue deshabilitado (`GET /agents/researcher` → `disabled: true`) |

## 8. Validaciones de Negocio

- Un restart de PodClaw (deploy, crash, actualizacion Docker) **NO resetea** limites de gasto ni rate limits — el presupuesto diario de EUR 30.15 se respeta incluso con multiples restarts
- El admin puede consultar el dashboard de agentes **mientras un agente esta ejecutando** — sin timeouts ni paginas en blanco
- El admin puede ver en Grafana: cuanto gasto cada agente hoy, cuantos productos creo el cataloger esta semana, y si algun circuit breaker se activo
- El Production Governor toma decisiones de produccion basadas en mercado real — los tests garantizan que el cold start limita a 3 productos/dia y el fail-safe a 1 producto/dia
- Las tablas de eventos no crecen indefinidamente — cleanup automatico a 90 dias mantiene la base de datos manejable
- La evolucion de SOUL.md esta testeada — las secciones "Constraints" y "Escalation Rules" son inmutables incluso si un agente propone cambios

## 9. Metricas de Exito

| Metrica | Antes | Despues |
|---------|-------|---------|
| Estado que sobrevive restart | 2/7 (circuit breaker + disabled via SQLite) | 7/7 (rate limits, costs, disabled, refunds, session locks, task states, governor cache) |
| Tiempo de respuesta Bridge durante ejecucion | >15s (timeout) | <200ms (non-blocking) |
| Cobertura de tests en archivos criticos | 0% (0/3 archivos) | >80% (3/3 archivos, 33+ tests) |
| Metricas operativas disponibles | 0 (solo logs) | 12+ metricas Prometheus con dashboard Grafana |
| Health checks por componente | 4 (orchestrator, heartbeat, supabase, scheduler) | 8 (+redis, +production_governor, +per-agent status, +event_queue depth) |
| Tiempo de diagnostico de incidente | ~30min (leer logs, consultar Supabase manual) | <5min (Grafana dashboard + health endpoint) |
| Retencion de eventos | Infinita (sin cleanup) | 90 dias con cleanup automatico |

## 10. Estimacion Total

| Bloque | Horas | Paralelizable |
|--------|-------|---------------|
| A — Redis State Backend | 6h | Si (con F) |
| B — Bridge Non-Blocking | 5h | No (depende de A) |
| C — Observabilidad Prometheus + Grafana | 8h | Si (con B, parcial) |
| D — Health + Decision Tree | 4h | No (depende de C) |
| E — Cleanup Automatico | 3h | Si (independiente) |
| F — Tests Archivos Criticos | 10h | Si (con A, B, C) |
| **Total** | **36h** | — |

**Esfuerzo con 2 agentes paralelos**: ~23h elapsed (A+F en paralelo → B+E en paralelo → C → D)

**Recomendacion de inicio**: Bloque F (tests) puede ejecutarse inmediatamente sin dependencias de infraestructura. Es el bloque con mayor ROI porque cubre 77KB de logica de negocio critica con tests unitarios puros.

---

*Plan derivado de audit-360/04-podclaw-governance.md validado. Gaps G1-G12 confirmados contra codigo fuente real 2026-02-23. Redis ya disponible en docker-compose.yml como servicio existente.*
