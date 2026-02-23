# Audit 360 — 06: Testing & Documentacion

> **Fecha**: 2026-02-23 | **Alcance**: Inventario de tests, infraestructura, gaps de cobertura, auditoria de documentacion

---

## 1. Estado Actual

### 1.1 Inventario de Tests por Componente

#### PodClaw (Python/pytest) -- 21 archivos de test

**Config**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/pytest.ini` (`asyncio_mode=auto`, timeout=30s)
**Fixtures**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/podclaw/tests/conftest.py` (233 lineas)

| Archivo | Que Testea | Lineas | Real? |
|---------|-----------|--------|-------|
| `tests/test_core.py` | Orchestrator init, start/stop, ejecucion, circuit breaker, retry | 15,379 bytes | SI |
| `tests/test_delegation.py` | Delegacion cross-agent | 10,357 bytes | SI |
| `tests/test_heartbeat.py` | Heartbeat runner lifecycle | 12,485 bytes | SI |
| `tests/test_memory_manager.py` | Memory read/write, consolidacion | 5,798 bytes | SI |
| `tests/test_pricing.py` | Logica de calculo de precios | 3,273 bytes | SI |
| `tests/test_scheduler.py` | APScheduler job setup, cron triggers | 8,981 bytes | SI |
| `tests/bridge/test_api.py` | Bridge API endpoints | Real | SI |
| `tests/connectors/test_crawl4ai_connector.py` | Crawl4AI connector | Real | SI |
| `tests/connectors/test_fal_connector.py` | fal.ai connector | Real | SI |
| `tests/connectors/test_gemini_connector.py` | Gemini connector | Real | SI |
| `tests/connectors/test_printify_connector.py` | Printify connector | Real | SI |
| `tests/connectors/test_stripe_connector.py` | Stripe connector | Real | SI |
| `tests/connectors/test_supabase_connector.py` | Supabase connector | Real | SI |
| `tests/hooks/test_cost_guard_hook.py` | Cost guard (budget diario) | Real | SI |
| `tests/hooks/test_event_log_hook.py` | Event logging hook | Real | SI |
| `tests/hooks/test_memory_hook.py` | Memory persistence hook | Real | SI |
| `tests/hooks/test_metrics_hook.py` | Metrics collection | Real | SI |
| `tests/hooks/test_quality_gate_hook.py` | Design quality gating | Real | SI |
| `tests/hooks/test_rate_limit_hook.py` | Per-session rate limiting | Real | SI |
| `tests/hooks/test_security_hook.py` | Seguridad: refunds, pricing, bulk ops | Real | SI |
| `tests/e2e/test_agent_flow.py` | End-to-end agent execution | Real | SI |

**conftest.py** provee fixtures completos:
- `tmp_workspace` -- workspace temporal
- `memory_manager` -- MemoryManager con directorio tmp
- `state_store` -- StateStore SQLite temporal
- `event_store` -- EventStore con mock Supabase
- `mock_supabase` -- Mock chainable (`.table().select().eq().execute()`)
- `event_queue` -- SystemEventQueue
- `sample_tool_use` / `sample_tool_result` -- payloads de ejemplo
- Auto-reset de estado a nivel modulo en hooks

#### Frontend (Playwright E2E) -- 36 archivos spec

**Config**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/playwright.config.ts`

| Categoria | Archivos | Tests |
|-----------|----------|-------|
| **API** | `api/health.spec.ts`, `api/products.spec.ts`, `api/cart.spec.ts`, `api/chat.spec.ts`, `api/auth.spec.ts`, `api/orders.spec.ts`, `api/wishlist.spec.ts`, `api/bridge.spec.ts`, `api/designs.spec.ts` | 9 specs |
| **Auth** | `auth/auth-flow.spec.ts`, `auth/auth-visual.spec.ts`, `auth/login.spec.ts`, `auth/register.spec.ts`, `auth/password-reset.spec.ts` | 5 specs |
| **Cart** | `cart/cart-flow.spec.ts`, `cart/checkout.spec.ts` | 2 specs |
| **Chat** | `chat/assistant.spec.ts`, `chat/chat-flow.spec.ts`, `chat/chat-flow-simple.spec.ts`, `chat/chat-flow-authenticated.spec.ts`, `chat/chat-flow-verified.spec.ts` | 5 specs |
| **Shop** | `shop/browse.spec.ts`, `shop/product-detail.spec.ts`, `shop/search.spec.ts`, `shop/shopping-flow.spec.ts`, `shop/personalization-flow.spec.ts`, `shop/personalizer-mockup-fix.spec.ts` | 6 specs |
| **Navigation** | `navigation/responsive.spec.ts`, `navigation/i18n.spec.ts` | 2 specs |
| **Orders** | `orders/order-history.spec.ts` | 1 spec |
| **Wishlist** | `wishlist/wishlist-flow.spec.ts` | 1 spec |
| **Designs** | `designs/design-flow.spec.ts` | 1 spec |
| **Admin** | `admin/admin-flow.spec.ts`, `admin/theme-switching.spec.ts` | 2 specs |
| **Integration** | `integration/webhooks/stripe.spec.ts`, `integration/webhooks/printify.spec.ts` | 2 specs |

#### MCP Server -- 0 archivos de test

**Sin configuracion de testing.** No hay jest.config, vitest.config, ni script `test` en `package.json`.

#### Admin Panel -- 0 archivos de test

**Sin configuracion de testing.** No hay archivos de test ni configuracion de framework.

### 1.2 Infraestructura de Testing

| Componente | Herramienta | Configurado? | Ubicacion Config |
|------------|-------------|-------------|------------------|
| PodClaw | pytest + pytest-asyncio | SI | `podclaw/pytest.ini` |
| Frontend E2E | Playwright | SI | `frontend/playwright.config.ts` |
| Frontend Unit | Ninguna | NO | No existe |
| Admin Panel | Ninguna | NO | No existe |
| MCP Server | Ninguna | NO | No existe |
| CI/CD | GitHub Actions | NO | `.github/` existe pero sin workflows |

**Dependencias de test instaladas (PodClaw)**:
- `pytest` -- framework base
- `pytest-asyncio` -- soporte async/await
- `pytest-timeout` -- timeout de 30s por test

**Playwright (Frontend)**:
- Navegadores: Chromium, Firefox, WebKit
- Modo: headless por defecto
- Server: `npm run dev` como webServer dependency

---

## 2. Gaps Detectados

### 2.1 Codigo Critico SIN Tests

| # | Codigo | Tamano | Riesgo | Razon |
|---|--------|--------|--------|-------|
| G1 | **MCP Server completo** (17 tools + OAuth + rate limit) | ~3,000 lineas TS | CRITICO | Zero tests para servicio orientado a clientes |
| G2 | **Admin Panel completo** | ~30+ paginas Next.js | ALTO | Zero tests para panel de administracion |
| G3 | **Production Governor** (`production_governor.py`) | 27,876 bytes | CRITICO | Controla produccion diaria, logica pura testeable |
| G4 | **Chat Session** (`chat_session.py`) | 34,130 bytes | ALTO | Streaming SSE, manejo de estado conversacional |
| G5 | **Soul Evolution** (`soul_evolution.py`) | 15,926 bytes | MEDIO | Mutacion de identidad del agente |
| G6 | **Memory Manager consolidacion LLM** | Parcial en `test_memory_manager.py` | MEDIO | Solo read/write testeado, no consolidacion con LLM |
| G7 | **Frontend componentes** (unit) | Toda la UI | ALTO | Solo E2E, sin tests unitarios de componentes |
| G8 | **SSRF protection** en Printify connector | `_resolve_and_check_ssrf()` | ALTO | Funcion de seguridad critica sin tests directos |
| G9 | **Bridge auth rate limiter** | `podclaw/bridge/auth.py` | MEDIO | Lockout logic sin tests de integracion |
| G10 | **Connector adapter** (`connector_adapter.py`) | 6,039 bytes | MEDIO | Capa de traduccion entre agentes y conectores |

### 2.2 Gaps de Infraestructura

| # | Gap | Impacto |
|---|-----|---------|
| G11 | **Sin CI/CD** -- `.github/` vacio, no hay pipelines | Los tests nunca se ejecutan automaticamente |
| G12 | **Sin coverage reports** -- no hay `--cov` configurado en pytest | No se sabe el % de cobertura real |
| G13 | **Sin test de carga** -- no hay k6, artillery, o locust config | Desconocemos limites de throughput |
| G14 | **Sin test de contrato** -- no hay Pact o similar entre frontend y APIs | Breaking changes pasan desapercibidos |
| G15 | **Sin smoke tests** para Docker stack -- `start.sh` no verifica funcionalidad post-deploy | Deploy puede parecer exitoso pero no funcionar |

### 2.3 Gaps de Documentacion

| # | Documento Faltante | Impacto |
|---|-------------------|---------|
| G16 | **Diagrama de arquitectura** -- no hay diagrama visual del sistema completo | Dificil onboarding de nuevos desarrolladores |
| G17 | **Runbook de operaciones** -- no hay guia de que hacer en incidentes | Respuesta reactiva, no proactiva |
| G18 | **Documentacion API** consumible -- FastAPI genera OpenAPI pero no esta expuesto | Integraciones externas bloqueadas |
| G19 | **Guia multi-tenant** -- no hay documentacion de estrategia de escalado | Decisiones ad-hoc cuando se necesite |
| G20 | **Playbook de gobernanza** -- que hacer cuando los agentes fallan | Admin sin protocolo claro |
| G21 | **Changelog** -- no hay historial de cambios versionado | Dificil tracking de regresiones |

---

## 3. Riesgos

### 3.1 Riesgos por Falta de Tests

| Riesgo | Probabilidad | Impacto | Area |
|--------|-------------|---------|------|
| **Regresion en MCP server** despliega tool roto a produccion | Alta | Critico | MCP Server |
| **Production Governor calcula limites erroneos** despues de refactor | Media | Alto | PodClaw |
| **OAuth flow roto** despues de update de dependencias | Media | Alto | MCP Server |
| **Admin panel muestra datos incorrectos** sin que nadie lo note | Media | Medio | Admin |
| **Chat SSE pierde mensajes** por bug en streaming | Media | Alto | PodClaw Bridge |

### 3.2 Riesgos por Falta de CI/CD

| Riesgo | Probabilidad | Impacto |
|--------|-------------|---------|
| **Merge de codigo roto** a main sin deteccion automatica | Alta | Alto |
| **Drift entre tests locales y produccion** | Media | Medio |
| **Regression silenciosa** acumulada por semanas | Alta | Critico |

### 3.3 Riesgos por Falta de Documentacion

| Riesgo | Probabilidad | Impacto |
|--------|-------------|---------|
| **Bus factor = 1** para operaciones | Alta | Critico |
| **Incidente sin runbook** con tiempo de resolucion extendido | Media | Alto |
| **Integracion externa fallida** por falta de API docs | Media | Medio |

---

## 4. Quick Wins

| # | Quick Win | Esfuerzo | Impacto |
|---|-----------|----------|---------|
| QW1 | **Agregar `pytest --cov`** a PodClaw con reporte HTML | 30 min | Alto -- visibilidad de cobertura |
| QW2 | **5 tests basicos MCP Server** (vitest): `search_products`, `get_store_info`, `list_categories`, `get_product_details`, `get_product_reviews` con Supabase mockeado | 4-6h | CRITICO -- primera cobertura |
| QW3 | **Tests Production Governor** -- logica pura sin I/O, trivial de mockear | 3-4h | Alto -- 27KB cubiertos |
| QW4 | **GitHub Actions basico**: lint + typecheck + pytest + vitest on push | 2-3h | CRITICO -- CI minimo |
| QW5 | **Habilitar FastAPI `/docs`** para documentacion API automatica | 15 min | Alto -- docs instantaneas |
| QW6 | **Crear `docs/architecture.md`** con diagrama Mermaid del sistema | 2-3h | Alto -- onboarding |
| QW7 | **Smoke test post-deploy** en `start.sh`: curl health endpoints | 1h | Medio -- deploy verification |

---

## 5. Refactor Estructural Recomendado

### 5.1 Estrategia de Testing Profesional

#### Piramide de Tests Propuesta

```
           /  E2E  \          ← Playwright (ya existe: 36 specs)
          /  Integ.  \        ← API contract + webhook flow
         / Componentes \      ← Vitest + React Testing Library
        /   Unitarios    \    ← Pytest (existe parcial) + Vitest (nuevo)
```

#### Tier 1: Inmediato (1-2 dias)

| Que | Framework | Archivos a Crear |
|-----|-----------|-----------------|
| MCP Server tools (publicos) | vitest | `mcp-server/src/__tests__/tools/search-products.test.ts` (x5) |
| Production Governor | pytest | `podclaw/tests/test_production_governor.py` |
| Chat Session (unit) | pytest | `podclaw/tests/test_chat_session.py` |
| Bridge auth rate limiter | pytest | `podclaw/tests/bridge/test_auth.py` |

#### Tier 2: Corto Plazo (3-5 dias)

| Que | Framework | Archivos a Crear |
|-----|-----------|-----------------|
| MCP Server tools (protegidos) | vitest | `mcp-server/src/__tests__/tools/get-my-profile.test.ts` (x12) |
| MCP OAuth flow completo | vitest | `mcp-server/src/__tests__/auth/oauth-flow.test.ts` |
| MCP rate limiting | vitest | `mcp-server/src/__tests__/middleware/rate-limit.test.ts` |
| Admin componentes clave | vitest | `admin/src/__tests__/components/` (Dashboard, AgentCard, etc.) |
| Frontend componentes clave | vitest | `frontend/src/__tests__/components/` (Cart, Checkout, Auth) |
| SSRF protection | pytest | `podclaw/tests/connectors/test_ssrf_protection.py` |
| Soul Evolution | pytest | `podclaw/tests/test_soul_evolution.py` |

#### Tier 3: Medio Plazo (1-2 semanas)

| Que | Framework | Archivos a Crear |
|-----|-----------|-----------------|
| Load testing Bridge API | k6 | `tests/load/bridge-api.js` |
| Load testing MCP Server | k6 | `tests/load/mcp-server.js` |
| Multi-agent coordination | pytest | `podclaw/tests/e2e/test_multi_agent.py` |
| Memory consolidation con mock LLM | pytest | `podclaw/tests/test_memory_consolidation.py` |
| E2E payment flow (Stripe test mode) | Playwright | `frontend/tests/e2e/payments/full-flow.spec.ts` |
| Contract tests Frontend <-> Bridge | Pact | `tests/contracts/bridge.pact.ts` |

### 5.2 Configuracion CI/CD Propuesta

**Archivo**: `.github/workflows/ci.yml`

```yaml
# Propuesta de estructura
jobs:
  lint:
    - Frontend: next lint
    - Admin: next lint
    - PodClaw: ruff check
    - MCP Server: tsc --noEmit

  test-podclaw:
    - pytest --cov --cov-report=html
    - Upload coverage artifact

  test-mcp:
    - vitest run --coverage
    - Upload coverage artifact

  test-frontend-unit:
    - vitest run (cuando se agregue)

  test-e2e:
    - Playwright (con Supabase mock o test project)
    - Upload trace on failure

  docker-build:
    - docker compose build (smoke test)
```

**Triggers**: push a `main`/`master`, pull requests, scheduled (weekly full suite)

### 5.3 Estructura de Documentacion Propuesta

```
docs/
├── audit-360/                    ← Ya existe (este audit)
│   ├── README.md
│   ├── 04-podclaw-governance.md
│   ├── 05-mcp-server.md
│   ├── 06-testing-docs.md
│   └── 07-database-schema.md
├── architecture.md               ← NUEVO: Diagrama Mermaid, flujos de datos
├── operations-runbook.md         ← NUEVO: Monitoring, alertas, incidentes
├── deployment-guide.md           ← NUEVO: Paso a paso produccion + rollback
├── api-reference.md              ← NUEVO: Bridge + MCP server API (o link a /docs)
├── governance-playbook.md        ← NUEVO: Protocolo cuando agentes fallan
├── multi-tenant-strategy.md      ← NUEVO: Plan de escalado
├── security-playbook.md          ← NUEVO: Modelo de amenazas extendido
├── ecommerce-strategy.md         ← NUEVO: Pricing, seleccion de productos
├── development-guide.md          ← NUEVO: Guia consolidada para contribuidores
└── changelog.md                  ← NUEVO: Historial de cambios
```

Documentacion que YA EXISTE y es de calidad:

| Documento | Ubicacion | Tamano | Evaluacion |
|-----------|----------|--------|------------|
| CLAUDE.md (design system) | `project/CLAUDE.md` | Grande | COMPLETO |
| PodClaw README.md | `podclaw/README.md` | 6,918 bytes | COMPLETO |
| AGENTS.md | `podclaw/AGENTS.md` | 7,129 bytes | COMPLETO |
| SECURITY.md | `podclaw/SECURITY.md` | 6,121 bytes | COMPLETO |
| SOUL.md | `podclaw/SOUL.md` | 2,922 bytes | COMPLETO |
| MEMORY.md | `podclaw/MEMORY.md` | 4,879 bytes | COMPLETO |
| TOOLS.md | `podclaw/TOOLS.md` | 13,060 bytes | COMPLETO |
| CONTRIBUTING.md | `podclaw/CONTRIBUTING.md` | 7,871 bytes | COMPLETO |
| USAGE.md | `podclaw/USAGE.md` | 8,167 bytes | COMPLETO |
| MCP Server CLAUDE.md | `mcp-server/CLAUDE.md` | 5,099 bytes | COMPLETO |
| Catalog README | `podclaw/catalog/README.md` | Existe | Referencia EU |
| Deploy README | `deploy/README.md` | Existe | Guia deploy |
| Supabase README | `supabase/README.md` | Existe | Documentacion DB |

---

## 6. Roadmap por Fases

### Fase 1: Cobertura Critica (Semana 1)
- [ ] Configurar vitest en MCP Server (`mcp-server/vitest.config.ts`)
- [ ] 5 tests para tools MCP publicos con Supabase mockeado
- [ ] Tests para Production Governor (logica pura)
- [ ] Tests para Chat Session (unit)
- [ ] Agregar `pytest --cov` con threshold minimo 60%
- [ ] GitHub Actions CI basico: lint + typecheck + test

### Fase 2: Expansion de Cobertura (Semana 2-3)
- [ ] 12 tests para tools MCP protegidos
- [ ] Tests para OAuth 2.1 flow completo
- [ ] Tests para MCP rate limiting
- [ ] Tests para SSRF protection en Printify connector
- [ ] Tests para Soul Evolution
- [ ] Tests para Bridge auth rate limiter
- [ ] Configurar vitest en Admin Panel
- [ ] 5 tests de componentes Admin (Dashboard, AgentCard, OrderDetail)

### Fase 3: Documentacion Fundacional (Semana 3-4)
- [ ] `docs/architecture.md` con diagramas Mermaid
- [ ] `docs/operations-runbook.md` con procedimientos de incidentes
- [ ] `docs/governance-playbook.md` para agentes
- [ ] Habilitar FastAPI `/docs` y MCP Server health endpoint
- [ ] Smoke tests post-deploy en `start.sh`

### Fase 4: Testing Avanzado (Semana 5-8)
- [ ] Load testing con k6 (Bridge API + MCP Server)
- [ ] Frontend component tests con vitest + React Testing Library
- [ ] Contract tests Frontend <-> Bridge
- [ ] Multi-agent coordination E2E tests
- [ ] Coverage gates en CI: fail si coverage baja del threshold

### Fase 5: Documentacion Completa (Semana 8-12)
- [ ] `docs/deployment-guide.md` con rollback procedures
- [ ] `docs/multi-tenant-strategy.md`
- [ ] `docs/security-playbook.md`
- [ ] `docs/changelog.md` con proceso de versionado
- [ ] ADRs (Architecture Decision Records) para decisiones clave

---

## 7. Impacto en Escalabilidad

### Situacion Actual de Cobertura

| Componente | Tests | Cobertura Estimada | Prioridad |
|------------|-------|-------------------|-----------|
| PodClaw core | 21 archivos pytest | ~65% del core, ~40% total | Expandir |
| PodClaw connectors | 6 archivos | ~70% de conectores | Agregar SSRF tests |
| PodClaw hooks | 7 archivos | ~80% de hooks | Buena cobertura |
| Frontend E2E | 36 specs Playwright | ~60% de flujos usuario | Agregar unit tests |
| Frontend Unit | 0 | 0% | URGENTE para componentes criticos |
| Admin Panel | 0 | 0% | URGENTE |
| MCP Server | 0 | 0% | CRITICO |

### Impacto de la Falta de Tests en Escalabilidad

1. **Velocidad de desarrollo**: Sin tests, cada cambio requiere verificacion manual -- bottleneck a medida que el equipo crece
2. **Confianza en deploys**: Sin CI/CD, deploy a produccion es un acto de fe
3. **Onboarding**: Sin tests como documentacion viva, nuevos desarrolladores tardan mas en entender el sistema
4. **Refactoring**: Sin cobertura, refactors necesarios para multi-tenant son riesgosos
5. **Regresiones acumuladas**: Sin deteccion automatica, bugs se descubren tarde y cuestan mas

### Meta de Cobertura Recomendada

| Componente | Actual | Meta 30 dias | Meta 90 dias |
|------------|--------|-------------|-------------|
| PodClaw | ~40% | 65% | 80% |
| MCP Server | 0% | 50% | 75% |
| Frontend (E2E) | ~60% | 65% | 70% |
| Frontend (Unit) | 0% | 20% | 50% |
| Admin | 0% | 15% | 40% |

**Conclusion**: El inventario de tests existente en PodClaw es solido (21 archivos, fixtures bien estructurados), y los 36 specs de Playwright cubren los flujos criticos del frontend. Sin embargo, MCP Server (0 tests, 17 tools orientados a clientes) y Admin Panel (0 tests) representan riesgos criticos. La documentacion existente para PodClaw es excelente (AGENTS.md, SECURITY.md, SOUL.md, TOOLS.md, CONTRIBUTING.md, USAGE.md), pero falta documentacion de arquitectura global, runbooks operativos, y guias de gobernanza. La prioridad inmediata es: (1) tests MCP Server, (2) CI/CD basico, (3) documentacion de arquitectura.
