# Plan 09 — Observabilidad, Monitoring, Alerting & Logging

**Prioridad**: P2
**Estimacion**: 25-30h
**Dependencias**: Plan 06 (PodClaw Governance), Docker stack operativo (Plan 10)
**Bloquea**: Ninguno directamente (pero es prerequisito para SLA de produccion)

---

## 1. Objetivo

Dotar al stack Docker self-hosted de observabilidad end-to-end: metricas de sistema y aplicacion (Prometheus), visualizacion (Grafana), agregacion de logs (Loki), y alertas automaticas (Alertmanager/Grafana). Pasar de "healthchecks binarios sin agregacion" a "dashboards con historico, correlacion y alertas proactivas".

## 2. Estado Actual (Validado)

| Area | Score | Evidencia |
|------|-------|-----------|
| Metricas de sistema | 0/10 | Sin Prometheus, sin node_exporter, sin cAdvisor |
| Metricas de aplicacion | 2/10 | PodClaw `/metrics` (bridge/api.py:436) retorna JSON in-memory, no formato Prometheus |
| Metricas frontend | 0/10 | `/api/health` mide latencias pero no expone `/metrics` |
| Metricas admin | 0/10 | Sin endpoint de metricas |
| Metricas mcp-server | 0/10 | Solo `/health` basico (index.ts:790) |
| Logging estructurado | 6/10 | PodClaw usa `structlog` con JSON output (236 refs en 20 archivos), `PODCLAW_JSON_LOGS=true` |
| Logging frontend/admin | 2/10 | `console.log` + `logInfo()` custom, sin formato estandar |
| Agregacion de logs | 0/10 | `json-file` driver con rotacion 10MB x 3, sin Loki/ELK |
| Alertas | 0/10 | Sin Alertmanager, sin PagerDuty, sin webhooks de alerta |
| Health checks | 7/10 | 8/8 servicios con healthcheck Docker, frontend con deep check (Supabase, Redis, Stripe, Printify) |
| Presupuesto agentes | 5/10 | `cost_guard_hook.py` trackea costos diarios in-memory/Supabase, pero sin alerta externa |
| OpenTelemetry | 1/10 | Paquetes en `node_modules` (frontend, admin) pero sin configuracion activa |

### Lo que ya existe y se puede reutilizar

1. **PodClaw `/metrics`** (`podclaw/bridge/api.py:436-439`): Retorna `{agent_name: {tool_calls, tool_errors, total_latency_ms}}` — necesita adaptarse a formato Prometheus
2. **PodClaw `/costs`** (`podclaw/bridge/api.py:443-446`): Retorna costos diarios por agente — valioso para dashboard de negocio
3. **PodClaw `/health` y `/api/health`** (`podclaw/bridge/api.py:894-938`): Deep check con estado de orchestrator, heartbeat, Supabase, Redis, event queue
4. **Frontend `/api/health`** (`frontend/src/app/api/health/route.ts`): Latencias de Supabase, Redis, Printify, Stripe + uso de memoria
5. **`metrics_hook.py`** (`podclaw/hooks/metrics_hook.py`): Hook PreToolUse/PostToolUse con contadores y latencia por agente
6. **`cost_guard_hook.py`** (`podclaw/hooks/cost_guard_hook.py`): Presupuesto diario por agente con warning al 80%
7. **structlog JSON** (`podclaw/main.py:423-444`): Ya configura `JSONRenderer` cuando `PODCLAW_JSON_LOGS=true` — Loki puede parsear directamente

## 3. Gap Estructural

El stack tiene healthchecks individuales por servicio pero **cero visibilidad historica ni correlada**. No hay forma de responder: "Cual fue el error rate de PodClaw ayer?", "Cuanta RAM consumio frontend en la ultima hora?", "Cuantas veces se excedio el presupuesto del agente designer este mes?". Los logs se pierden al rotar (10MB x 3 archivos). Las alertas son inexistentes — si un servicio se degrada sin caer (p.ej. latencia alta en Supabase), nadie se entera hasta que un usuario se queja.

El `metrics_hook.py` de PodClaw es valioso pero retorna JSON plano — Prometheus necesita formato text/OpenMetrics. Los healthchecks de Docker solo emiten UP/DOWN sin registrar latencia historica. El frontend tiene mediciones de latencia en su healthcheck pero las descarta despues de cada request.

## 4. Decision Arquitectonica

### Stack: Prometheus + Grafana + Loki (NO OpenTelemetry completo, NO Datadog/NewRelic)

**Justificacion**:
- Prometheus + Grafana + Loki son el estandar open-source para self-hosted, con imagenes Docker oficiales
- OpenTelemetry completo (traces, spans) anade complejidad desproporcionada para un stack de 8 servicios sin microservicios internos
- Las metricas de PodClaw (tool_calls, costos, latencia) se mapean naturalmente a Prometheus gauges/counters
- Loki consume logs de Docker directamente via el driver `loki` — cero cambios en los servicios existentes
- Grafana unifica metricas + logs en un solo dashboard
- Overhead total: ~384MB RAM adicional (prometheus 256M + grafana 128M + loki 256M + cadvisor 128M = 768M, pero Loki reemplaza archivos de log)

### Exporters: prom-client (Node.js) + prometheus-fastapi-instrumentator (Python)

**Justificacion**:
- `prom-client` es la libreria estandar para Node.js — expone `/metrics` en formato Prometheus nativo
- `prometheus-fastapi-instrumentator` instrumenta FastAPI automaticamente (request count, latency, status codes)
- Ambas son zero-config para metricas basicas, con custom metrics para logica de negocio
- cAdvisor proporciona metricas de containers (CPU, RAM, network, disk I/O) sin cambios en los servicios

### Alertas: Grafana Alerting (NO Alertmanager standalone)

**Justificacion**:
- Grafana 11+ tiene alerting integrado con soporte para Telegram, email, webhooks
- Evita otro servicio (Alertmanager) y su configuracion YAML
- PodClaw ya tiene integracion Telegram — las alertas de Grafana pueden usar el mismo bot
- Para escalar a PagerDuty/OpsGenie, Grafana soporta contact points nativos

## 5. Plan de Implementacion

### Bloque A: Infraestructura de Observabilidad — Docker (6h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| A1 | Agregar servicio `prometheus` a docker-compose.yml | `docker-compose.yml` | 30min | — |
| A2 | Crear `deploy/prometheus/prometheus.yml` con scrape configs para todos los servicios | `deploy/prometheus/prometheus.yml` | 1h | — |
| A3 | Agregar servicio `grafana` a docker-compose.yml | `docker-compose.yml` | 30min | — |
| A4 | Crear `deploy/grafana/datasources.yml` (Prometheus + Loki auto-provisioned) | `deploy/grafana/datasources.yml` | 30min | — |
| A5 | Agregar servicio `loki` a docker-compose.yml | `docker-compose.yml` | 30min | — |
| A6 | Crear `deploy/loki/loki-config.yml` (filesystem storage, retention 30d) | `deploy/loki/loki-config.yml` | 30min | — |
| A7 | Agregar servicio `cadvisor` para metricas de containers | `docker-compose.yml` | 30min | — |
| A8 | Crear red `monitoring` y conectar prometheus, grafana, loki, cadvisor + servicios | `docker-compose.yml` | 30min | — |
| A9 | Cambiar logging driver de `json-file` a `loki` en todos los servicios | `docker-compose.yml` (x-logging anchor) | 30min | — |
| A10 | Actualizar `docker-compose.local.yml` con puertos para Grafana (127.0.0.1:3100) y Prometheus (127.0.0.1:9090) | `docker-compose.local.yml` | 15min | — |
| A11 | Actualizar `docker-compose.prod.yml` con ruta Caddy `/grafana*` proxied a grafana:3100 | `docker-compose.prod.yml`, `deploy/Caddyfile` | 30min | — |
| A12 | Agregar variables `GRAFANA_ADMIN_PASSWORD`, `GF_SERVER_ROOT_URL` a `.env.example` | `.env.example` | 15min | — |
| A13 | Actualizar `start.sh` fase 0 para iniciar monitoring antes que infra | `start.sh` | 15min | — |

### Bloque B: Endpoints `/metrics` en Servicios (6h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| B1 | PodClaw: instalar `prometheus-fastapi-instrumentator`, instrumentar bridge API | `podclaw/requirements.txt`, `podclaw/bridge/api.py` | 1h |
| B2 | PodClaw: exponer custom metrics — `podclaw_tool_calls_total`, `podclaw_tool_errors_total`, `podclaw_tool_latency_seconds` (histograma), `podclaw_daily_cost_eur` (gauge por agente), `podclaw_budget_usage_ratio` (gauge) | `podclaw/bridge/metrics_exporter.py` (nuevo), `podclaw/bridge/api.py` | 2h |
| B3 | PodClaw: exponer `podclaw_heartbeat_last_run_timestamp`, `podclaw_event_queue_size`, `podclaw_active_sessions` | `podclaw/bridge/metrics_exporter.py` | 30min |
| B4 | Frontend: instalar `prom-client`, crear `/api/metrics` con request count, latency histogram, memory gauge, Supabase/Redis latency gauges | `frontend/package.json`, `frontend/src/app/api/metrics/route.ts`, `frontend/src/lib/metrics.ts` (nuevo) | 1.5h |
| B5 | Admin: instalar `prom-client`, crear `/panel/api/metrics` con request count y memory | `admin/package.json`, `admin/src/app/api/metrics/route.ts` (nuevo) | 30min |
| B6 | MCP Server: instalar `prom-client`, exponer `/metrics` con tool invocation count, OAuth token count, latency | `mcp-server/package.json`, `mcp-server/src/index.ts` | 30min |

### Bloque C: Dashboards de Grafana (5h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| C1 | Dashboard "System Overview": CPU, RAM, network por container (cAdvisor), disk usage, container restarts | `deploy/grafana/dashboards/system-overview.json` | 1h |
| C2 | Dashboard "PodClaw Agents": tool_calls/min por agente, error rate, latencia p50/p95/p99, presupuesto diario usado vs limite, sesiones activas, heartbeat status | `deploy/grafana/dashboards/podclaw-agents.json` | 1.5h |
| C3 | Dashboard "Storefront": request rate, latencia p50/p99, error rate (4xx/5xx), Supabase latency, Redis latency, memory heap usage | `deploy/grafana/dashboards/storefront.json` | 1h |
| C4 | Dashboard "Business Metrics": costos diarios por agente (EUR), tool calls totales, newsletter sends, design generations, orders procesadas (via Supabase queries en Grafana) | `deploy/grafana/dashboards/business-metrics.json` | 1h |
| C5 | Dashboard provisioning config (auto-load al iniciar Grafana) | `deploy/grafana/dashboards/dashboards.yml` | 30min |

### Bloque D: Reglas de Alerta (4h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| D1 | Contact point: Telegram (usa el mismo bot de PodClaw, `TELEGRAM_BOT_TOKEN` + `PODCLAW_ADMIN_TELEGRAM_CHAT_ID`) | Grafana UI o `deploy/grafana/alerting/contact-points.yml` | 30min |
| D2 | Contact point: Email via Resend SMTP relay | `deploy/grafana/grafana.ini` (smtp config) | 30min |
| D3 | Alerta: Servicio caido (container unhealthy > 2min) | `deploy/grafana/alerting/rules.yml` | 30min |
| D4 | Alerta: Error rate > 5% en frontend o PodClaw (ventana 5min) | `deploy/grafana/alerting/rules.yml` | 20min |
| D5 | Alerta: Latencia p99 > 5s en frontend o > 30s en PodClaw | `deploy/grafana/alerting/rules.yml` | 20min |
| D6 | Alerta: Presupuesto de agente > 80% del limite diario (`podclaw_budget_usage_ratio > 0.8`) | `deploy/grafana/alerting/rules.yml` | 20min |
| D7 | Alerta: RAM container > 85% del limite | `deploy/grafana/alerting/rules.yml` | 20min |
| D8 | Alerta: Disco > 80% en el host (via node_exporter o cadvisor) | `deploy/grafana/alerting/rules.yml` | 20min |
| D9 | Alerta: Heartbeat de PodClaw no ejecutado en 2.5x intervalo | `deploy/grafana/alerting/rules.yml` | 20min |
| D10 | Alerta: Redis disconnected (frontend health check metric) | `deploy/grafana/alerting/rules.yml` | 20min |

### Bloque E: Logging Estructurado y Loki (3h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| E1 | Verificar que PodClaw emite JSON con `PODCLAW_JSON_LOGS=true` en Docker (ya funciona via `_configure_structlog`) | `podclaw/main.py:423-444` — solo verificacion | 15min |
| E2 | Frontend: crear middleware de logging que emita JSON estructurado (timestamp, level, method, path, status, latency) | `frontend/src/middleware.ts` o `frontend/src/instrumentation.ts` | 1h |
| E3 | Admin: mismo middleware de logging JSON | `admin/src/middleware.ts` | 30min |
| E4 | MCP Server: configurar `pino` o equivalente para JSON output | `mcp-server/src/index.ts` | 30min |
| E5 | Crear labels de Loki por servicio en docker-compose logging config | `docker-compose.yml` (logging labels) | 15min |
| E6 | Verificar pipeline completo: log emitido -> Loki -> query en Grafana Explore | Manual testing | 30min |

### Bloque F: Uptime Monitoring y Integracion (2h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| F1 | Prometheus blackbox_exporter para HTTP probes externas (frontend, admin, bridge) | `docker-compose.yml`, `deploy/prometheus/blackbox.yml` | 45min |
| F2 | Panel de uptime en Grafana (% disponibilidad 24h/7d/30d) | `deploy/grafana/dashboards/system-overview.json` (agregar) | 30min |
| F3 | Documentar runbook de alertas: que hacer ante cada alerta, escalacion | `docs/runbooks/alertas.md` | 45min |

## 6. Orden de Ejecucion

```
Bloque A (6h) ──→ Bloque B (6h) ──→ Bloque C (5h)
                                         ↓
                  Bloque E (3h) ──→ Bloque D (4h) ──→ Bloque F (2h)
```

- **A primero**: Sin infraestructura Docker no hay donde enviar metricas
- **B depende de A**: Los endpoints `/metrics` necesitan que Prometheus exista para scrapearlos
- **E puede ir en paralelo con B**: El logging estructurado y Loki son independientes de Prometheus
- **C depende de B**: Los dashboards necesitan datos reales para validar queries
- **D depende de C**: Las alertas se construyen sobre las mismas queries de los dashboards
- **F al final**: Uptime monitoring y runbooks requieren todo lo anterior funcionando

## 7. Validaciones Tecnicas

| # | Validacion | Criterio de Exito |
|---|-----------|-------------------|
| V1 | Prometheus scraping | `curl localhost:9090/api/v1/targets` → todos los targets en estado `up` |
| V2 | PodClaw `/metrics` formato Prometheus | `curl localhost:8000/metrics` → output con `# HELP`, `# TYPE`, text/plain |
| V3 | Frontend `/api/metrics` | `curl localhost:3000/api/metrics` → metricas `prom-client` validas |
| V4 | cAdvisor metricas | `container_memory_usage_bytes{name="frontend"}` retorna valores en Prometheus |
| V5 | Grafana datasources | Grafana UI → Data Sources → Prometheus y Loki con "Data source is working" |
| V6 | Dashboards cargan | Los 4 dashboards provisioned aparecen sin errores "No data" |
| V7 | Loki recibe logs | Grafana Explore → Loki → `{container_name="podclaw"}` retorna logs JSON parseados |
| V8 | Alerta de test | Matar un servicio (`docker compose stop rembg`) → alerta Telegram en < 3min |
| V9 | Alerta de presupuesto | Forzar `podclaw_budget_usage_ratio` > 0.8 → notificacion Telegram |
| V10 | Blackbox probe | Prometheus blackbox → HTTP 200 para frontend y admin URLs |

## 8. Validaciones de Negocio

- El administrador puede ver en un solo dashboard cuanto gasta cada agente de PodClaw por dia
- Si PodClaw se queda sin presupuesto, llega una alerta a Telegram ANTES de que el usuario note degradacion
- Si el frontend tiene latencia > 5s durante 5 minutos, llega alerta sin que nadie este mirando dashboards
- Los logs de hace 30 dias son consultables en Grafana (no se pierden con rotacion de archivos)
- Un nuevo desarrollador puede entender el estado del sistema en < 5 minutos viendo el dashboard System Overview

## 9. Metricas de Exito

| Metrica | Antes | Despues |
|---------|-------|---------|
| Servicios con `/metrics` Prometheus | 0/8 | 5/8 (frontend, admin, podclaw, mcp-server, cadvisor) |
| Dashboards de Grafana | 0 | 4 (system, agents, storefront, business) |
| Reglas de alerta configuradas | 0 | 8+ (service down, error rate, latency, budget, RAM, disk, heartbeat, Redis) |
| Retencion de logs | ~30MB (3 archivos x 10MB, rotados) | 30 dias en Loki (configurable) |
| Tiempo medio de deteccion (MTTD) | Infinito (sin alertas) | < 3 min |
| Metricas historicas | 0 dias | 15 dias (Prometheus default retention) |
| Canales de alerta | 0 | 2 (Telegram, Email) |

## 10. Estimacion Total

| Bloque | Horas | Paralelizable |
|--------|-------|---------------|
| A — Infra Docker (Prometheus, Grafana, Loki, cAdvisor) | 6h | No (primero) |
| B — Endpoints `/metrics` en servicios | 6h | No (depende de A) |
| C — Dashboards Grafana | 5h | No (depende de B) |
| D — Reglas de Alerta | 4h | No (depende de C) |
| E — Logging Estructurado + Loki | 3h | Si (con B) |
| F — Uptime + Runbook | 2h | No (ultimo) |
| **Total** | **26h** | — |

**Esfuerzo con 2 agentes paralelos**: ~20h elapsed (B+E en paralelo ahorra 3h)

### Overhead de recursos adicionales

| Servicio nuevo | CPU | RAM (limite) | RAM (reserva) | Disco |
|----------------|-----|-------------|---------------|-------|
| prometheus | 0.5 | 256M | 128M | ~500MB (15d retention) |
| grafana | 0.5 | 128M | 64M | ~50MB (dashboards, DB) |
| loki | 0.5 | 256M | 128M | ~2GB (30d logs) |
| cadvisor | 0.5 | 128M | 64M | 0 (read-only) |
| **Total adicional** | **2.0** | **768M** | **384M** | **~2.5GB** |

**Stack total con observabilidad**: ~4.0 GB RAM (limites), 8.5 CPUs — viable en VPS de 8GB RAM.

---

*Plan derivado de audit-360 validado (10-docker-deploy.md gaps #4, #10, #11). Evidencia verificada contra codigo fuente real 2026-02-23: bridge/api.py:436 (metrics), hooks/metrics_hook.py (counters), hooks/cost_guard_hook.py (budgets), main.py:423 (structlog), frontend health/route.ts (latencies), docker-compose.yml (8 healthchecks, json-file logging).*
