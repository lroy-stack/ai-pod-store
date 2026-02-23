# Auditoría Estratégica 360° — Resumen Ejecutivo

**Fecha:** 2026-02-23
**Plataforma:** POD AI Store — Print-on-Demand con IA autónoma
**Auditor:** Claude Opus 4.6
**Scope:** 11 dimensiones, 64 tablas DB, 8 servicios Docker, 194+ API routes, 10 agentes IA

---

## Puntuación Global: 6.2 / 10

| # | Dimensión | Puntuación | Bloqueante? |
|---|-----------|------------|-------------|
| 01 | Admin Dashboard | 5.5/10 | **SÍ** — 66/69 APIs sin auth |
| 02 | Frontend eCommerce | 6.5/10 | No — funcional pero incompleto |
| 03 | Sistema de Categorías | 4.0/10 | No — VARCHAR sin tabla relacional |
| 04 | PodClaw & Gobernanza | 7.5/10 | No — agentes reales, falta persistencia de estado |
| 05 | MCP Server | 6.0/10 | No — 0 tests, bypass JWT |
| 06 | Testing & Documentación | 5.0/10 | **SÍ** — 0 tests en Admin/MCP, sin CI/CD |
| 07 | Database Schema & RLS | 5.0/10 | **SÍ** — 25+ tablas sin RLS |
| 08 | Seguridad & Auth | 4.5/10 | **SÍ** — sesión admin falsificable |
| 09 | i18n & Legal & GDPR | 9.5/10 | No — falta double opt-in (DE) |
| 10 | Docker & Deploy | 7.5/10 | No — sólido, falta monitoreo |
| 11 | Integraciones | 6.5/10 | No — Stripe/Printify maduros, sin circuit breaker |

### Lo que está bien construido:
- Frontend auth (Supabase) — JWT validado server-side, rate limiting, Turnstile
- PodClaw — 10 agentes reales con budgets, skills, circuit breaker, event sourcing
- Docker hardening — cap_drop ALL, non-root, redes segmentadas, log rotation
- i18n — 988 claves × 3 locales sincronizados, Impressum TMG compliant
- Legal/GDPR — Cookie consent, soft delete, consent tracking, data export
- Stripe webhook — HMAC timing-safe, eventos manejados correctamente
- Printify connector — SSRF protection, allowlist de hosts, connection pooling

---

## Hallazgos Críticos — 11 Bloqueantes de Producción

### Seguridad (los más urgentes)

| ID | Hallazgo | Reporte | Impacto | Esfuerzo Fix |
|----|----------|---------|---------|--------------|
| **C-01** | Cookie admin JSON sin firma — cualquiera puede crear `{"role":"admin"}` | 08 | Escalación de privilegios trivial | 4h (iron-session) |
| **C-02** | Middleware admin excluye TODAS las rutas `/api/*` | 08 | 66 endpoints expuestos públicamente | 2h |
| **C-03** | Endpoint `setup-rbac` sin protección | 08 | Atacantes crean cuentas admin | 0.5h (eliminar) |
| **C-04** | 25+ tablas Supabase sin RLS activado | 07 | PII expuesto (emails, pedidos, diseños) | 8-12h |
| **C-05** | `public.users` no vinculado a `auth.users` — sin trigger `handle_new_user()` | 07 | RLS policies pueden no funcionar | 2h |
| **C-06** | Secret Telegram hardcodeado: `default_secret_change_in_production` | 08 | Vector RCE via webhook Telegram | 0.5h |
| **C-07** | Messaging tables con `USING (true)` — completamente abiertas | 07 | Todos los mensajes visibles a anon | 2h |

### Arquitectura

| ID | Hallazgo | Reporte | Impacto | Esfuerzo Fix |
|----|----------|---------|---------|--------------|
| **C-08** | Test/seed data embebido en migraciones de producción | 07 | Datos ficticios en prod | 4h |
| **C-09** | MCP Server: 0 tests + bypass JWT por fallback decode | 05, 06 | 17 tools sin verificar, auth hole | 8h |
| **C-10** | PodClaw rate limits en memoria, no persistentes | 04 | Se pierden al reiniciar | 4h |
| **C-11** | Bridge API bloqueada durante ejecución de agentes | 04 | API no responde durante jobs | 8h |

---

## Hallazgos por Severidad — Resumen

| Severidad | Cantidad | Área Principal |
|-----------|----------|----------------|
| **CRITICAL** | 11 | Seguridad admin, RLS, auth sync |
| **HIGH** | 18 | APIs sin auth, páginas faltantes, categorías, testing |
| **MEDIUM** | 25+ | UI/UX, validación, email, webhooks, monitoreo |
| **LOW** | 8 | CSP, aria-labels, soft-delete inconsistente |

---

## Hallazgos Transversales (cruzan múltiples reportes)

### 1. Admin Panel = Punto Más Débil
- **Reporte 01**: 66/69 APIs sin auth, 27/34 páginas sin sidebar, 67+ violaciones de color tokens
- **Reporte 08**: Cookie falsificable, middleware bypassed, setup-rbac abierto
- **Reporte 06**: 0 tests para admin (ni unit ni E2E)
- **Impacto combinado**: El admin panel es actualmente una puerta abierta a toda la plataforma

### 2. Dual Auth Systems Sin Reconciliar
- **Frontend**: Supabase Auth (JWT, OAuth, MFA-ready) — **bien implementado**
- **Admin**: bcrypt custom (cookie JSON sin firma, sin MFA) — **fundamentalmente inseguro**
- **Database**: `users.role` simple + RBAC (`admin_roles`/`user_roles`) coexisten sin reconciliación
- **Recomendación**: Migrar admin a Supabase Auth o implementar iron-session + TOTP

### 3. Testing Desigual
- **PodClaw**: 21 archivos test, conftest robusto, cobertura de core + hooks + connectors ✓
- **Frontend E2E**: 36 Playwright specs cubriendo auth, cart, chat, shop ✓
- **Admin**: 0 tests ✗
- **MCP Server**: 0 tests ✗
- **Frontend Unit**: 0 tests ✗
- **CI/CD**: `.github/` existe pero sin workflows ✗

### 4. Categorías = Deuda Técnica Clave
- VARCHAR(100) sin tabla relacional, sin jerarquía, sin metadata
- 17 categorías hardcodeadas en frontend JS
- Bloquea: landing pages por categoría, SEO, filtros avanzados, expansión a verticales
- Requiere: migración SQL + API + UI (estimado: 2-3 semanas)

### 5. Base de Datos Necesita Hardening
- 25+ tablas sin RLS (incluyendo `newsletter_subscribers` con PII)
- `public.users.id` generado con `gen_random_uuid()`, no referencia `auth.users(id)`
- IVFFlat en vez de HNSW para pgvector (<10K rows)
- Sin partitioning para tablas de alto crecimiento (messages, agent_events)
- Missing indexes en queries clave (orders, designs, variants, documents GIN)

---

## Puntuación por Área Funcional

| Área | Score | Estado |
|------|-------|--------|
| Frontend Authentication | 8/10 | Producción-ready |
| Admin Authentication | 2/10 | **BLOQUEANTE** |
| Frontend APIs | 7/10 | Funcional |
| Admin APIs | 1/10 | **BLOQUEANTE** |
| PodClaw Agents | 8/10 | Producción-ready (persistencia pendiente) |
| Docker/Infrastructure | 7.5/10 | Sólido (monitoreo pendiente) |
| Database Schema | 5/10 | Funcional pero inseguro |
| Database RLS | 3/10 | **BLOQUEANTE** |
| Testing Coverage | 4/10 | **BLOQUEANTE** (Admin/MCP) |
| i18n/Legal/GDPR | 9/10 | Casi completo |
| Security Headers | 7/10 | Correcto |
| Component Quality | 6/10 | Tokens + layout inconsistente |
| Performance | 5/10 | Sin optimización (categorías, indexes) |
| Monitoring/Observability | 2/10 | No existe |

---

## Quick Wins — Mayor Impacto, Menor Esfuerzo

| # | Acción | Tiempo | Cierra | Impacto |
|---|--------|--------|--------|---------|
| 1 | Eliminar bypass `/api/*` en admin middleware | 30 min | C-02 | 66 APIs protegidas |
| 2 | Eliminar endpoint `setup-rbac` | 15 min | C-03 | Cierra vector de escalación |
| 3 | Eliminar secret Telegram fallback | 15 min | C-06 | Cierra vector RCE |
| 4 | Firmar cookie admin con `iron-session` | 4h | C-01 | Sesiones infalsificables |
| 5 | Enable RLS en tablas con PII (newsletter, drip, designs) | 4h | C-04 parcial | PII protegido |
| 6 | Crear trigger `handle_new_user()` | 2h | C-05 | Auth sync funcional |
| 7 | Fix messaging policies (reemplazar `USING(true)`) | 2h | C-07 | Mensajes protegidos |
| 8 | Añadir `requireAuth()` a 66 admin APIs | 4h | H-01 | APIs admin protegidas |
| 9 | Crear `.dockerignore` en 3 proyectos | 30 min | — | Secrets fuera de layers |
| 10 | Añadir idempotency key a Stripe checkout | 1h | — | Sin cargos duplicados |

**Total Quick Wins: ~18 horas para cerrar 7/11 hallazgos críticos**

---

## Roadmap de Remediación Consolidado

### Fase 0: Parches Críticos de Seguridad (1-2 semanas, ~20h)

**Objetivo:** Eliminar todos los vectores de acceso no autorizado.

- [ ] Firmar cookie admin (`iron-session` o JWT)
- [ ] Proteger middleware admin (no excluir `/api/*`)
- [ ] Eliminar `setup-rbac` endpoint
- [ ] Añadir `requireAuth()` a 66 admin APIs
- [ ] Enable RLS en TODAS las tablas + policies apropiadas
- [ ] Fix messaging policies (`USING(true)` → políticas reales)
- [ ] Crear trigger `handle_new_user()` + vincular `public.users` a `auth.users`
- [ ] Eliminar secret Telegram fallback
- [ ] Mover `SUPABASE_SERVICE_KEY` de build arg a runtime-only en Docker
- [ ] Eliminar test/seed data de migraciones → mover a `seed.sql`

### Fase 1: Estabilización y Testing (2-4 semanas, ~50h)

**Objetivo:** Base de código testeable y observable.

- [ ] CI/CD: GitHub Actions (lint + tsc + pytest + docker build)
- [ ] Tests MCP Server: mínimo 5 specs (auth, tools, sessions)
- [ ] Tests Admin: mínimo 10 specs (login, CRUD products, orders)
- [ ] Admin layout: crear route group `(dashboard)/` + DashboardLayout universal
- [ ] React Query: migrar top 10 páginas admin (reemplazar `useEffect` + `fetch`)
- [ ] Corregir 67+ violaciones de color tokens (bg-blue-* → bg-primary)
- [ ] Consolidar admin APIs: typed responses, error handling consistente
- [ ] Rate limiting en login admin
- [ ] Aumentar password min a 12+ caracteres
- [ ] Habilitar email confirmations en Supabase

### Fase 2: Funcionalidad y UX (1-2 meses, ~80h)

**Objetivo:** Paridad competitiva con stores modernos.

- [ ] Sistema de categorías relacional (tabla + API + landing pages + sidebar)
- [ ] Páginas faltantes: /about, /contact, /faq, /blog, /size-guide
- [ ] Homepage: testimonials, trust signals, newsletter capture, social proof
- [ ] PodClaw: Redis para persistencia de estado, separar workers
- [ ] MCP Server: rate limiting per-tool, health endpoint, session persistence
- [ ] Stripe: idempotency keys, `invoice.payment_failed` handler
- [ ] Printify: timing-safe HMAC comparison
- [ ] Double opt-in email para Newsletter (requerido en DE)
- [ ] Indexes faltantes (orders, designs, variants, documents GIN)
- [ ] Reemplazar IVFFlat con HNSW para pgvector
- [ ] Habilitar connection pooler en Supabase

### Fase 3: Escalabilidad y Observabilidad (2-3 meses, ~100h)

**Objetivo:** Preparar para 1.000+ clientes y operación 24/7.

- [ ] Monitoreo: Prometheus + Grafana + Loki (métricas, logs, alertas)
- [ ] Circuit breakers en todas las integraciones externas
- [ ] Admin MFA: TOTP para cuentas admin
- [ ] Partitioning: messages, agent_events, audit_log por mes
- [ ] Automated cleanup: system_events, heartbeat_events (TTL)
- [ ] PodClaw: dashboard de observabilidad (Grafana), decision tree visualizer
- [ ] Testing: cobertura >50% en todos los componentes
- [ ] SAST/DAST en CI/CD
- [ ] Zero-downtime deployments
- [ ] Evaluar multi-tenant strategy (`tenant_id` column)

### Fase 4: Multi-Tenant y SaaS (3-6 meses, ~150h)

**Objetivo:** Escalar de single-brand a plataforma SaaS.

- [ ] Añadir `tenant_id` a todas las tablas
- [ ] `brand_config` multi-tenant (no singleton)
- [ ] Aislamiento de datos por tenant en RLS
- [ ] Docker Swarm (Tier 2) → Kubernetes (Tier 3)
- [ ] PII encryption at rest (pgsodium)
- [ ] SMTP configurado para dominios custom
- [ ] OAuth providers (Google, Apple) configurados
- [ ] Storage buckets para diseños/imágenes

---

## Impacto en Escalabilidad (1.000+ Clientes)

| Área | Estado Actual | Con 1K+ Clientes | Riesgo |
|------|--------------|-------------------|--------|
| Admin Auth | Cookie falsificable | Data breach garantizado | **CRÍTICO** |
| RLS | 25+ tablas abiertas | PII de todos los clientes expuesto | **CRÍTICO** |
| Messages table | Sin partición | Query degradation >100K rows | ALTO |
| Connection pooling | Disabled | Connection exhaustion >50 concurrent | ALTO |
| Categorías | VARCHAR sin índice | Filtrado O(n) en catálogo | MEDIO |
| Agent state | En memoria | Perdido en cada restart/deploy | ALTO |
| Monitoreo | No existe | Sin visibilidad de errores en producción | ALTO |
| Multi-tenant | No existe | Imposible escalar a SaaS | MEDIO (largo plazo) |

---

## Esfuerzo Estimado Total

| Fase | Horas | Duración (1 FTE) | Score Esperado |
|------|-------|-------------------|----------------|
| Fase 0 — Parches Críticos | ~20h | 1-2 semanas | 7.5/10 |
| Fase 1 — Estabilización | ~50h | 2-4 semanas | 8.0/10 |
| Fase 2 — Funcionalidad | ~80h | 1-2 meses | 8.5/10 |
| Fase 3 — Escalabilidad | ~100h | 2-3 meses | 9.0/10 |
| Fase 4 — Multi-Tenant | ~150h | 3-6 meses | 9.5/10 |
| **Total** | **~400h** | **~5-6 meses** | **9.5/10** |

**Para producción mínima viable (Score 7.5/10): ~20 horas (Fase 0 solamente)**

---

## Conclusión

POD AI es un proyecto técnicamente ambicioso con una base sólida en varias áreas (PodClaw agents, Docker hardening, i18n/GDPR, frontend auth). Sin embargo, el **admin panel representa un riesgo de seguridad crítico** que bloquea cualquier despliegue en producción. Las 20 horas de la Fase 0 transformarían la plataforma de "demo técnica avanzada" a "MVP desplegable con precauciones".

La fortaleza diferenciadora — un agente IA autónomo que gestiona una tienda ecommerce — está bien implementada a nivel de agentes (7.5/10), pero necesita inversión en observabilidad y persistencia de estado para operar de forma confiable en producción.

**Prioridad absoluta:** Seguridad del admin panel → RLS en Supabase → CI/CD → Testing → Categorías.

---

*Reportes detallados disponibles en `docs/audit-360/01` a `docs/audit-360/11`.*
*Auditoría realizada con Claude Opus 4.6 el 2026-02-23.*
