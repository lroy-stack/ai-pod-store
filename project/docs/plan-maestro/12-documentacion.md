# Plan 12 — Documentación Estructurada & ADRs

**Prioridad**: P2
**Estimación**: 15-20h
**Dependencias**: Ninguna (puede ejecutarse en paralelo con cualquier otro plan)
**Bloquea**: Nada directamente, pero acelera todos los demás planes (onboarding, debugging, incident response)

---

## 1. Objetivo

Establecer un sistema de documentación sostenible que cubra: decisiones arquitectónicas (ADRs), referencia de APIs, guías de onboarding, runbooks operativos y documentación consolidada de los agentes PodClaw. La documentación debe ser mantenible por agentes y humanos, vivir junto al código, y servir como fuente de verdad única.

## 2. Estado Actual (Validado)

### Documentación Existente — Inventario

| Documento | Ubicación | Tamaño | Estado |
|-----------|----------|--------|--------|
| CLAUDE.md (design system + Docker) | `project/CLAUDE.md` | Grande | COMPLETO — estándar de referencia |
| PodClaw README.md | `podclaw/README.md` | 6,918 bytes | COMPLETO |
| PodClaw AGENTS.md | `podclaw/AGENTS.md` | 7,129 bytes | COMPLETO |
| PodClaw SECURITY.md | `podclaw/SECURITY.md` | 6,121 bytes | COMPLETO |
| PodClaw SOUL.md | `podclaw/SOUL.md` | 2,922 bytes | COMPLETO |
| PodClaw MEMORY.md | `podclaw/MEMORY.md` | 4,879 bytes | COMPLETO |
| PodClaw TOOLS.md | `podclaw/TOOLS.md` | 13,060 bytes | COMPLETO |
| PodClaw CONTRIBUTING.md | `podclaw/CONTRIBUTING.md` | 7,871 bytes | COMPLETO |
| PodClaw USAGE.md | `podclaw/USAGE.md` | 8,167 bytes | COMPLETO |
| PodClaw SKILL.md (×10 agentes) | `podclaw/skills/*/SKILL.md` | 10 archivos | COMPLETO |
| MCP Server CLAUDE.md | `mcp-server/CLAUDE.md` | 5,099 bytes | COMPLETO |
| Deploy README | `deploy/README.md` | 9,062 bytes | COMPLETO |
| Deploy BACKUP.md | `deploy/BACKUP.md` | 3,361 bytes | COMPLETO |
| Deploy Cloudflare guides | `deploy/CLOUDFLARE-*.md` | 2 archivos | COMPLETO |
| Supabase README | `supabase/README.md` | Existe | Referencia DB |
| Project CONTRIBUTING.md | `project/CONTRIBUTING.md` | Existe | Genérico |
| Audit 360 | `docs/audit-360/` | 7+ archivos | COMPLETO |
| Plan Maestro | `docs/plan-maestro/` | 9+ archivos | EN PROGRESO |

### Documentación FALTANTE

| # | Documento | Impacto |
|---|----------|---------|
| F1 | **ADR system** — sin registro formal de decisiones arquitectónicas | Decisiones se pierden en conversaciones, bus factor = 1 |
| F2 | **API reference consolidada** — Bridge (51 endpoints), Admin (69 routes), MCP (17 tools) sin OpenAPI/Swagger | Integraciones externas bloqueadas, debug lento |
| F3 | **Onboarding guide** — no hay guía unificada "de 0 a running" | Nuevo desarrollador necesita horas leyendo múltiples READMEs |
| F4 | **Deployment runbook** — `deploy/README.md` cubre setup pero no troubleshooting ni rollback | Incidentes sin protocolo claro |
| F5 | **Incident response playbook** — no existe | Tiempo de resolución impredecible |
| F6 | **PodClaw docs consolidadas** — 10 SKILL.md + AGENTS.md + TOOLS.md dispersos | No hay vista unificada del árbol de decisión de los agentes |
| F7 | **Database schema docs** — ERD ausente, descripciones de tablas parciales | 64 tablas sin documentación visual de relaciones |
| F8 | **CHANGELOG** — no existe a nivel proyecto | Regresiones difíciles de rastrear, releases sin historial |
| F9 | **CLAUDE.md maintenance strategy** — se actualiza ad hoc sin protocolo | Riesgo de divergencia entre docs y realidad |

### Score de Documentación

| Área | Score | Justificación |
|------|-------|---------------|
| PodClaw docs | 9/10 | 8 archivos .md exhaustivos, cada skill documentada |
| Deploy docs | 7/10 | Buena guía de setup, falta runbook de incidentes |
| API reference | 2/10 | FastAPI genera OpenAPI pero no está expuesto; Admin y MCP sin docs |
| Onboarding | 3/10 | Cada componente tiene README pero no hay guía unificada |
| Architecture decisions | 0/10 | Cero ADRs formales |
| Schema docs | 2/10 | `supabase/README.md` existe pero sin ERD ni descripciones completas |
| Changelog | 0/10 | Inexistente |

## 3. Gap Estructural

La documentación de POD AI es **bimodal**: PodClaw tiene documentación de clase mundial (8 archivos .md cubriendo seguridad, agentes, herramientas, contribución, uso), pero el resto del sistema carece de documentación formal. Las decisiones arquitectónicas viven en la memoria del desarrollador principal y en CLAUDE.md, pero no hay un sistema de ADRs que permita entender el **por qué** detrás de cada decisión. Esto crea un bus factor de 1 — si el desarrollador principal no está disponible, nadie sabe por qué se eligió `iron-session` sobre Supabase Auth, por qué hay 3 route groups en el frontend, o por qué Redis se usa solo para caché y no como message broker.

La API surface es masiva (51 + 69 + 17 = 137 endpoints) pero no tiene documentación consumible por herramientas (OpenAPI/Swagger). Esto bloquea tanto integraciones externas como la propia eficiencia de desarrollo interno.

El database schema (64 tablas, 45+ indexes, 98 migraciones) no tiene documentación visual (ERD) ni descripciones semánticas de las tablas, lo que hace que cualquier cambio requiera leer migraciones individuales para entender relaciones.

## 4. Decisión Arquitectónica

### ADR Format: Michael Nygard (ligero, Markdown)

**Formato elegido**: `docs/adr/NNNN-titulo-kebab-case.md`

```markdown
# ADR-NNNN: Título de la Decisión

**Estado**: Aceptada | Propuesta | Supersedida por ADR-XXXX
**Fecha**: YYYY-MM-DD
**Decisores**: [nombres/roles]

## Contexto
[Qué problema estamos resolviendo]

## Decisión
[Qué decidimos hacer]

## Consecuencias
[Positivas, negativas, riesgos aceptados]
```

**Justificación**:
- El formato Nygard es el estándar de facto para ADRs en la industria
- Markdown puro — sin herramientas adicionales, vive junto al código
- Inmutable: una vez aceptada, una ADR nunca se edita — se supersede con otra
- Numeración secuencial simple (`0001`, `0002`, ...) — sin categorías

### API Docs: OpenAPI auto-generado + Markdown manual

**Justificación**:
- Bridge API (FastAPI) ya genera OpenAPI — solo hay que exponerlo
- Admin APIs (Next.js Route Handlers) no tienen auto-generación — documentar con Markdown + ejemplos curl
- MCP tools ya están documentados en `mcp-server/CLAUDE.md` — consolidar y expandir

### CLAUDE.md: Protocolo de actualización obligatoria

**Justificación**:
- CLAUDE.md es el documento más importante del proyecto — lo leen agentes AI en cada sesión
- Debe actualizarse como parte de cualquier PR que cambie arquitectura, rutas, o estándares
- Agregar sección "Last verified" con fecha y hash de commit

### Docs-as-Code: Todo en `docs/` con Markdown

**Justificación**:
- Sin herramientas externas (no Notion, no Confluence, no Wiki)
- Versionado con Git — historial completo de cambios
- Renderizable en GitHub/GitLab automáticamente
- Buscable con grep/ripgrep por agentes AI

## 5. Plan de Implementación

### Bloque A: Sistema ADR + Decisiones Retroactivas (4h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| A1 | Crear directorio `docs/adr/` con `README.md` (instrucciones del formato, índice) | `docs/adr/README.md` | 30min |
| A2 | ADR-0001: Elección de stack (Next.js + Supabase + Claude SDK) | `docs/adr/0001-stack-tecnologico.md` | 20min |
| A3 | ADR-0002: Auth dual — Supabase Auth (frontend) + iron-session (admin) | `docs/adr/0002-auth-dual-supabase-iron-session.md` | 20min |
| A4 | ADR-0003: Route groups (landing, app, focused) sin page.tsx en (app) | `docs/adr/0003-route-groups-frontend.md` | 20min |
| A5 | ADR-0004: Self-hosted Docker Compose (no Kubernetes) | `docs/adr/0004-docker-compose-self-hosted.md` | 20min |
| A6 | ADR-0005: PodClaw multi-agente con Claude Agent SDK | `docs/adr/0005-podclaw-multi-agente.md` | 20min |
| A7 | ADR-0006: Supabase Cloud (no self-hosted) para database | `docs/adr/0006-supabase-cloud.md` | 15min |
| A8 | ADR-0007: MCP Server con OAuth 2.1 para tools AI | `docs/adr/0007-mcp-server-oauth.md` | 15min |
| A9 | ADR-0008: Tailwind v4 semantic tokens (prohibición de hardcoded colors) | `docs/adr/0008-semantic-tokens-tailwind.md` | 15min |
| A10 | ADR-0009: i18n con next-intl (en/es/de) | `docs/adr/0009-i18n-next-intl.md` | 15min |
| A11 | ADR-0010: Redis solo para caché (no message broker) | `docs/adr/0010-redis-cache-only.md` | 15min |
| A12 | Crear template `docs/adr/_TEMPLATE.md` para futuras ADRs | `docs/adr/_TEMPLATE.md` | 15min |

### Bloque B: Documentación de APIs (4h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| B1 | Habilitar FastAPI `/docs` endpoint en Bridge API (ya genera OpenAPI, solo exponerlo) | `podclaw/bridge/api.py` | 15min |
| B2 | Exportar OpenAPI JSON de Bridge y guardarlo en `docs/api/bridge-openapi.json` | `docs/api/bridge-openapi.json` | 15min |
| B3 | Documentar Admin APIs: inventario de 69 routes con método, path, auth, body, response | `docs/api/admin-api.md` | 1.5h |
| B4 | Documentar MCP tools: expandir `mcp-server/CLAUDE.md` con ejemplos de request/response para los 17 tools | `docs/api/mcp-tools.md` | 1h |
| B5 | Crear `docs/api/README.md` como índice de todas las APIs con links | `docs/api/README.md` | 30min |
| B6 | Documentar webhook endpoints: Stripe, Printify, Telegram, WhatsApp con payloads de ejemplo | `docs/api/webhooks.md` | 30min |

### Bloque C: Onboarding & Guías de Desarrollo (3h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| C1 | Guía de onboarding: prerequisites, clone, .env setup, Docker start, verificación | `docs/getting-started.md` | 1h |
| C2 | Guía de contribución unificada: coding standards, PR process, commit conventions, branching | `docs/development-guide.md` | 1h |
| C3 | Diagrama de arquitectura con Mermaid: componentes, redes, flujos de datos | `docs/architecture.md` | 1h |

### Bloque D: Runbooks Operativos (3h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| D1 | Deployment runbook: paso a paso prod, pre-flight checks, rollback, SSL renewal | `docs/runbooks/deployment.md` | 1h |
| D2 | Incident response playbook: severidad (P0-P3), escalation, comunicación, post-mortem template | `docs/runbooks/incident-response.md` | 1h |
| D3 | PodClaw agent failure playbook: qué hacer cuando un agente falla, kill switches, budget excedido | `docs/runbooks/agent-failure.md` | 30min |
| D4 | Database emergency playbook: backup/restore, migration rollback, RLS debugging | `docs/runbooks/database-emergency.md` | 30min |

### Bloque E: PodClaw Docs Consolidadas + DB Schema (3h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| E1 | Consolidar 10 SKILL.md en vista unificada: tabla de agentes, capabilities, delegation rules, árbol de decisión | `docs/podclaw-agents.md` | 1h |
| E2 | Diagrama Mermaid del flujo de decisión entre agentes (orchestrator → specialist → delegation) | Incluido en `docs/podclaw-agents.md` | 30min |
| E3 | Database schema doc: ERD Mermaid de las 64 tablas agrupadas por dominio (users, products, orders, agent, messaging) | `docs/database-schema.md` | 1h |
| E4 | Descripciones semánticas de tablas clave: propósito, columnas importantes, relaciones, RLS policies | Incluido en `docs/database-schema.md` | 30min |

### Bloque F: CHANGELOG + CLAUDE.md Maintenance (1.5h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| F1 | Crear `CHANGELOG.md` con formato Keep a Changelog: secciones Added/Changed/Fixed/Removed | `CHANGELOG.md` | 30min |
| F2 | Poblar CHANGELOG retroactivo con hitos principales del git log (últimas 10-15 entradas significativas) | `CHANGELOG.md` | 30min |
| F3 | Agregar sección "Maintenance Protocol" a CLAUDE.md: cuándo actualizar, qué secciones, verificación de fecha | `CLAUDE.md` (nueva sección) | 15min |
| F4 | Agregar "Last verified: YYYY-MM-DD (commit hash)" a CLAUDE.md | `CLAUDE.md` (header) | 15min |

## 6. Orden de Ejecución

```
Bloque A (ADRs, 4h) ──────────────────────────────────────┐
                                                           │
Bloque B (APIs, 4h) ────────────────────────────────────┐  │
                                                        │  │
Bloque C (Onboarding, 3h) ──────────────────────────┐  │  │
                                                     │  │  │── Todos paralelizables
Bloque D (Runbooks, 3h) ────────────────────────┐   │  │  │
                                                 │   │  │  │
Bloque E (PodClaw + DB, 3h) ────────────────┐  │   │  │  │
                                             │  │   │  │  │
Bloque F (CHANGELOG + CLAUDE.md, 1.5h) ─┐  │  │   │  │  │
                                         ↓  ↓  ↓   ↓  ↓  ↓
                                    [ Sin dependencias cruzadas ]
```

- **Todos los bloques son independientes** — pueden ejecutarse en cualquier orden o en paralelo
- Bloque A es el más valioso per-hora (captura decisiones antes de que se olviden)
- Bloque B tiene la mayor superficie de impacto (137 endpoints documentados)
- Bloque F es el quick win más rápido (1.5h para CHANGELOG + maintenance protocol)
- **Recomendación**: F → A → C → B → D → E (optimizado por valor inmediato / esfuerzo)

## 7. Validaciones Técnicas

| # | Validación | Criterio de Éxito |
|---|-----------|-------------------|
| V1 | ADR system funcional | `docs/adr/` contiene README + template + 10 ADRs retroactivas |
| V2 | Bridge OpenAPI accesible | `curl http://localhost:8000/docs` → Swagger UI renderiza |
| V3 | Admin API documentada | `docs/api/admin-api.md` lista 69 routes con método, path, auth required |
| V4 | MCP tools documentados | `docs/api/mcp-tools.md` cubre 17 tools con request/response examples |
| V5 | Onboarding verificado | Nuevo desarrollador puede ir de `git clone` a `./start.sh` en <30min siguiendo `docs/getting-started.md` |
| V6 | Diagrama de arquitectura | `docs/architecture.md` contiene diagrama Mermaid renderizable con todos los servicios y redes |
| V7 | Runbook de deployment | `docs/runbooks/deployment.md` incluye pre-flight, deploy, verify, rollback |
| V8 | Incident playbook | `docs/runbooks/incident-response.md` define severidades P0-P3 con tiempos de respuesta |
| V9 | ERD database | `docs/database-schema.md` contiene diagrama Mermaid con relaciones entre tablas |
| V10 | CHANGELOG existe | `CHANGELOG.md` tiene formato Keep a Changelog con entradas retroactivas |
| V11 | CLAUDE.md protocol | CLAUDE.md incluye "Last verified" date y sección "Maintenance Protocol" |
| V12 | PodClaw consolidado | `docs/podclaw-agents.md` incluye tabla unificada de 10 agentes + diagrama de decisión |

## 8. Validaciones de Negocio

- Un nuevo desarrollador puede configurar el entorno completo sin asistencia humana siguiendo `getting-started.md`
- Un operador puede diagnosticar y resolver un incidente de producción siguiendo los runbooks sin conocimiento previo del sistema
- Cualquier decisión arquitectónica pasada es rastreable con su contexto y justificación via ADRs
- Un integrador externo puede consumir las APIs del Bridge, Admin, y MCP con la documentación disponible
- El CHANGELOG permite a stakeholders no técnicos entender qué cambió entre versiones
- CLAUDE.md se mantiene sincronizado con la realidad del codebase gracias al protocolo de mantenimiento

## 9. Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| ADRs formales | 0 | 10+ retroactivas + template para futuras |
| APIs con docs consumibles | 0/137 | 137/137 (OpenAPI + Markdown) |
| Documentación de onboarding | Dispersa en 8+ READMEs | 1 guía unificada + architecture diagram |
| Runbooks operativos | 0 | 4 (deployment, incident, agent failure, DB emergency) |
| PodClaw agent docs | Dispersas en 10 SKILL.md + 3 .md | 1 vista consolidada + diagrama de decisión |
| Database schema visual | 0 ERDs | 1 ERD Mermaid completo (64 tablas) |
| CHANGELOG | Inexistente | Activo con formato estándar |
| CLAUDE.md freshness | Sin protocolo | Con fecha de verificación + maintenance protocol |
| Documentation score (estimado) | 4/10 | 8/10 |
| Bus factor para operaciones | 1 | 2+ (cualquiera con acceso a docs puede operar) |

## 10. Estimación Total

| Bloque | Horas | Paralelizable |
|--------|-------|---------------|
| A — ADRs (10 retroactivas + template) | 4h | Sí (con todos) |
| B — Documentación de APIs | 4h | Sí (con todos) |
| C — Onboarding & Development Guide | 3h | Sí (con todos) |
| D — Runbooks Operativos | 3h | Sí (con todos) |
| E — PodClaw Consolidado + DB Schema | 3h | Sí (con todos) |
| F — CHANGELOG + CLAUDE.md Maintenance | 1.5h | Sí (con todos) |
| **Total** | **18.5h** | — |

**Esfuerzo con 3 agentes paralelos**: ~7h elapsed (A+B en paralelo, C+D en paralelo, E+F en paralelo)

### Estructura de Archivos Resultante

```
project/
├── CHANGELOG.md                          ← NUEVO
├── CLAUDE.md                             ← ACTUALIZADO (maintenance protocol + verified date)
├── docs/
│   ├── audit-360/                        ← Ya existe
│   ├── plan-maestro/                     ← Ya existe
│   ├── adr/                              ← NUEVO
│   │   ├── README.md                     ← Índice + instrucciones
│   │   ├── _TEMPLATE.md                  ← Template para nuevas ADRs
│   │   ├── 0001-stack-tecnologico.md
│   │   ├── 0002-auth-dual-supabase-iron-session.md
│   │   ├── 0003-route-groups-frontend.md
│   │   ├── 0004-docker-compose-self-hosted.md
│   │   ├── 0005-podclaw-multi-agente.md
│   │   ├── 0006-supabase-cloud.md
│   │   ├── 0007-mcp-server-oauth.md
│   │   ├── 0008-semantic-tokens-tailwind.md
│   │   ├── 0009-i18n-next-intl.md
│   │   └── 0010-redis-cache-only.md
│   ├── api/                              ← NUEVO
│   │   ├── README.md                     ← Índice de APIs
│   │   ├── bridge-openapi.json           ← Auto-generado de FastAPI
│   │   ├── admin-api.md                  ← 69 routes documentadas
│   │   ├── mcp-tools.md                  ← 17 tools con ejemplos
│   │   └── webhooks.md                   ← Stripe, Printify, Telegram, WhatsApp
│   ├── runbooks/                         ← NUEVO
│   │   ├── deployment.md
│   │   ├── incident-response.md
│   │   ├── agent-failure.md
│   │   └── database-emergency.md
│   ├── architecture.md                   ← NUEVO (diagrama Mermaid)
│   ├── getting-started.md                ← NUEVO (onboarding)
│   ├── development-guide.md              ← NUEVO (contribución)
│   ├── podclaw-agents.md                 ← NUEVO (consolidación)
│   └── database-schema.md               ← NUEVO (ERD + descripciones)
```

### Mantenimiento Continuo

| Trigger | Acción Requerida |
|---------|-----------------|
| Cambio en arquitectura (nueva dependencia, nuevo servicio, cambio de pattern) | Crear nueva ADR |
| Nuevo endpoint en cualquier API | Actualizar `docs/api/` correspondiente |
| Cambio en CLAUDE.md | Actualizar "Last verified" date |
| Release significativo | Agregar entrada a CHANGELOG.md |
| Nueva tabla en Supabase | Actualizar `docs/database-schema.md` |
| Nuevo agente PodClaw o cambio de skills | Actualizar `docs/podclaw-agents.md` |
| Incidente de producción resuelto | Actualizar runbook relevante + crear post-mortem |

---

*Plan derivado de audit 06-testing-docs.md (gaps G16-G21) validado contra inventario real de documentación. 2026-02-23.*
