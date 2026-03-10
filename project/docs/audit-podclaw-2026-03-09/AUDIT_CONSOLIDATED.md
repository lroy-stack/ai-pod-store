# PodClaw — Auditoría Consolidada (2026-03-09)

## Resumen Ejecutivo

PodClaw es un sistema de orquestación de agentes autónomos construido sobre el Claude Agent SDK (Python). Gestiona 10 sub-agentes especializados que operan un e-commerce print-on-demand 24/7, con 11 conectores MCP, 9 hooks de seguridad/observabilidad, y un bridge FastAPI para control administrativo.

**Veredicto: Arquitectura sólida con seguridad bien diseñada. Necesita hardening en auth/observabilidad para producción.**

---

## Scorecard

| Área | Score | Riesgo |
|------|-------|--------|
| Arquitectura Core | 9/10 | Bajo |
| Modelo de Seguridad | 8/10 | Bajo |
| Auth & Authorization | 5/10 | ALTO |
| Observabilidad | 4/10 | ALTO |
| Memory System | 7/10 | Medio |
| Production Governor | 8/10 | Bajo |
| Bridge API | 6/10 | Alto |
| Conectores MCP | 8/10 | Bajo |
| Testing | 5/10 | Medio |
| Deployment | 7/10 | Bajo |

---

## Arquitectura

### Core (core.py — 1,056 LOC)

Orquestador central que gestiona 10 agentes con:
- Session lifecycle con distributed locking (Redis SET NX + Supabase fallback)
- Circuit breaker (3+ errores en 24h → agente deshabilitado)
- Kill-switch persistido en StateStore
- Retry con backoff exponencial (2 reintentos, 5s + 10s)
- Timeout de sesión: 900s (15min)

### Agentes (10)

| Agente | Modelo | Budget USD/sesión | Budget EUR/día | Schedule |
|--------|--------|-------------------|----------------|----------|
| researcher | Haiku 4.5 | $0.60 | €1.50 | 06:00 |
| designer | Sonnet 4.5 | $1.50 | €3.00 | 08:00 |
| cataloger | Sonnet 4.5 | $6.00 | €15.00 | 10:00, 14:00, 18:00 |
| marketing | Sonnet 4.5 | $1.00 | €2.00 | 07:00, 15:00 |
| newsletter | Sonnet 4.5 | $0.80 | €1.50 | 09:00, 17:00 |
| customer_manager | Sonnet 4.5 | $1.00 | €2.00 | 12:00, 22:00 |
| finance | Sonnet 4.5 | $1.20 | €2.50 | 23:00 |
| seo_manager | Haiku 4.5 | $0.50 | €1.00 | Domingos 16:00 |
| qa_inspector | Haiku 4.5 | $0.15 | €0.15 | 10:00 |
| brand_manager | Sonnet 4.5 | $0.80 | €1.50 | Lunes 08:00 |

**Global daily spend limit: €30.00**

### Conectores MCP (11)

| Conector | Propósito | Auth | LOC |
|----------|-----------|------|-----|
| supabase | DB + storage | Service key | 357 |
| printify | POD catalog | Bearer JWT | 1,366 |
| stripe | Pagos + refunds | API key | 181 |
| fal | Image gen | Bearer key | 387 |
| gemini | Embeddings + moderation | API key | 372 |
| resend | Email | API key | 152 |
| crawl4ai | Web scraping | None (localhost) | 598 |
| telegram | Messaging | Bot token | 125 |
| whatsapp | Messaging | Bearer + phone ID | 109 |
| delegate | Sub-agent delegation | Orchestrator ref | 189 |
| memory | Cognitive search | Local SQLite | 255 |

### Hook Chain (Fail-Closed Security)

```
PreToolUse (deny chain):
  [0] security_hook     → FAIL-CLOSED (error = deny)
  [1] cost_guard_hook   → FAIL-OPEN (error = allow)
  [2] rate_limit_hook   → FAIL-OPEN (error = allow)
  [3] governor_hook     → FAIL-SAFE (no cache = limit 1)

PostToolUse (observation):
  [4] event_log_hook    → Audit trail inmutable
  [5] memory_hook       → Daily memory append
  [6] metrics_hook      → Contadores in-memory
  [7] quality_gate_hook → Verificación mecánica
  [8] sync_hook         → Auto-sync Printify→Supabase
```

---

## Hallazgos Críticos

### CRITICAL (Riesgo de Producción)

#### C1: Bridge API sin RBAC
- **Archivo**: `bridge/auth.py`
- **Problema**: Solo bearer token auth. Todos los endpoints requieren el mismo token. Sin permisos granulares (read-only, admin, audit).
- **Impacto**: Cualquier persona con el token tiene acceso completo a TODOS los endpoints (start/stop agentes, chat, refunds, memory).
- **Recomendación**: Implementar JWT con role claims o OAuth 2.1 con scopes.

#### C2: Sin rotación de tokens
- **Archivo**: `config.py` (BRIDGE_AUTH_TOKEN)
- **Problema**: Token en env var sin expiración ni mecanismo de refresh. Sin rotación automática.
- **Impacto**: Token comprometido = acceso permanente hasta cambio manual.
- **Recomendación**: Token rotation automática, considerar mTLS para bridge.

#### C3: Monitorización ausente
- **Problema**: Sin Prometheus metrics, sin alerting rules, sin dashboards. `prometheus_metrics.py` existe pero no está integrado.
- **Impacto**: Sin visibilidad operativa. Problemas detectados solo por síntomas visibles.
- **Recomendación**: Wiring de prometheus-client + Grafana dashboards.

### HIGH (Funcionalidad/Fiabilidad)

#### H1: Redis Lock TTL mismatch
- **Archivo**: `core.py` / `redis_store.py`
- **Problema**: Lock TTL = 20min (1200s), max session = 15min (900s). Si disconnect timeout se extiende, otro instance puede adquirir el lock.
- **Fix**: Lock TTL ≥ 1500s (session + cleanup buffer).

#### H2: Resume SDK session sin validación
- **Archivo**: `core.py`
- **Problema**: Si sesión anterior crasheó con contexto corrupto, resume carga estado malo. No hay health check antes de resume.
- **Fix**: `force_fresh=True` si sesión anterior terminó con error.

#### H3: Sin audit trail para mutaciones de memoria
- **Archivo**: `memory_manager.py`
- **Problema**: Updates a context files no logueados a audit_log table. No se puede detectar ediciones no autorizadas.
- **Fix**: Hooks PreContextUpdate/PostContextUpdate.

#### H4: Event Queue DLQ sin monitorización
- **Archivo**: `event_queue.py`
- **Problema**: Eventos fallidos van a DLQ con TTL 7d pero sin alerting. Items expiran silenciosamente.
- **Fix**: Escalación L2 cuando DLQ alcance N items.

#### H5: LLM consolidation no determinista
- **Archivo**: `memory_manager.py`
- **Problema**: Mismo daily log puede producir diferentes weekly summaries por varianza del LLM.
- **Mitigación**: Fallback mecánico ya existe, pero datos podrían perderse.

#### H6: Supabase sync en thread pool sin timeout
- **Archivo**: `event_store.py`
- **Problema**: Supabase client es sync, envuelto en `asyncio.to_thread()`. Si Supabase cuelga, bloquea thread pool. Sin timeout.
- **Fix**: Wrapper con timeout (30s default).

### MEDIUM

#### M1: Config reload (SIGHUP) no re-init clientes
- **Archivo**: `main.py`
- Reloads env vars pero no reconecta Redis/Supabase. Conexiones stale posibles.

#### M2: Event Queue wake_mode ignorado
- **Archivo**: `event_queue.py`
- `drain()` procesa todos los eventos inmediatamente, ignora `wake_mode: "next-heartbeat"`.

#### M3: Circuit breaker cuenta retries como errores separados
- **Archivo**: `core.py`
- 1 sesión con 3 retries = 3 errores → abre circuit breaker. Debería distinguir transient vs persistent.

#### M4: Rate limit counter split al cruzar medianoche UTC
- **Archivo**: `redis_store.py`
- Keys por fecha (YYYY-MM-DD). Agente ejecutando a medianoche tiene counter split en dos keys.

#### M5: Floating-point precision en cost tracking
- **Archivo**: `redis_store.py`
- `INCRBYFLOAT` usa IEEE754. Errores de redondeo acumulan (0.1 + 0.2 ≠ 0.3).

#### M6: Memory files sin encriptación at rest
- **Archivo**: `memory_manager.py`
- SOUL.md, MEMORY.md, context files en plaintext en disco.

#### M7: Hook timeout ausente
- **Archivo**: `hook_adapters.py`
- Si security_hook o rate_limit_hook cuelgan, SDK bloquea indefinidamente. Necesita asyncio.timeout wrapper.

---

## Fortalezas

1. **Seguridad fail-closed bien implementada** — security_hook bloquea en cualquier error de validación
2. **Budget enforcement dual** — SDK max_budget_usd + cost_guard Redis
3. **SSRF protection en Printify** — Validación de hostname contra IPs privadas
4. **Prompt injection defense** — 4 capas (preamble, regex, sanitize, PII scrub)
5. **Protected tables** — users, orders, payments bloqueados de escritura por agentes
6. **Emergency kill-switch** — read-only mode global
7. **Distributed locking** — Redis + Supabase fallback con fail-closed
8. **Production Governor adaptativo** — Límites basados en señales de mercado reales
9. **Event sourcing inmutable** — Audit trail completo en agent_events
10. **Graceful degradation** — Redis → Supabase → in-memory fallback chain

---

## Testing

| Módulo | Tests | Cobertura |
|--------|-------|-----------|
| core.py | Lifecycle, routing, sessions | Alta |
| production_governor.py | Signals, decisions, rules | Alta |
| soul_evolution.py | Proposals, immutable sections | Alta |
| heartbeat.py | Health monitoring, alerts | Alta |
| memory_manager.py | Consolidation, sanitization | Media |
| delegation.py | Sub-agent delegation | Media |
| scheduler.py | Cron jobs, lifecycle | Media |
| chat_session.py | Chat state | Media |
| connectors/ | Stubs (mocked) | Baja |
| bridge/ | Stubs (mocked) | Baja |
| hooks/ | Stubs (mocked) | Baja |

**Gaps**: Sin E2E tests para workflows completos, sin load testing, sin chaos testing.

---

## Plan de Acción Recomendado

### Inmediato (1-2 días)
1. Fix Redis lock TTL → 1500s
2. Timeout wrapper para Supabase thread pool (30s)
3. Validar env vars críticas al startup (fail-fast)

### Corto plazo (1 sprint)
4. RBAC en Bridge API (JWT con role claims)
5. Health check antes de resume SDK session
6. Wiring Prometheus metrics + /metrics endpoint
7. DLQ monitoring con alertas

### Medio plazo (1 quarter)
8. Migrar a Supabase client async
9. Token rotation automática
10. E2E tests para ciclo researcher→cataloger→finance
11. Distributed tracing (OpenTelemetry)

---

*Auditoría generada por 3 agentes especializados en paralelo. Hallazgos verificados contra codebase real.*
