# Roadmap Ejecutivo — POD AI Platform

**Fecha**: 2026-02-23
**Base**: 13 planes de desarrollo validados contra código fuente real
**Auditoría**: 11 reportes, 93% precisión confirmada
**Investigación externa**: 7 dominios analizados (Stripe, Shopify, Vercel, Linear, AI agents, LLM governance, multi-tenant SaaS)

---

## Resumen de Esfuerzo Total

| # | Plan | Dominio | Horas | Prioridad |
|---|------|---------|-------|-----------|
| 01 | Seguridad & Auth | Admin auth, RLS, webhooks, CSRF, MFA | 40h | P0 |
| 02 | Admin Dashboard | Layout, React Query, UI tokens, paginación | 33h | P0 |
| 03 | Database | Auth sync, indexes, pgvector, partitioning, pooling | 28h | P0 |
| 04 | Frontend Ecommerce | SEO, SSR, páginas faltantes, performance | 37h | P1 |
| 05 | Categorías | Tabla relacional, API, landing pages, admin CRUD | 26h | P1 |
| 06 | PodClaw Governance | Redis state, non-blocking bridge, observabilidad, tests | 36h | P1 |
| 07 | MCP Server | JWT fix, tests, rate limiting, sessions | 22h | P1 |
| 08 | Testing & CI/CD | Pipeline, admin/MCP tests, PodClaw critical | 36h | P0 |
| 09 | Observabilidad | Prometheus, Grafana, Loki, alertas | 26h | P2 |
| 10 | Growth & Engagement | Double opt-in, reviews, cart recovery, blog, analytics | 40h | P2 |
| 11 | Multi-Tenant | tenant_id, RLS, onboarding, Stripe Connect, domains | 93h | P3 |
| 12 | Documentación | ADRs, OpenAPI, runbooks, onboarding docs | 18.5h | P2 |
| 13 | Printify Integration | Retry orders, refunds, variant sync, resilience, chargebacks | 41h | P1 |
| | **TOTAL** | | **476.5h** | |

---

## Fases de Ejecución

### FASE 0: Parches Críticos de Seguridad (Semana 1-2)

**Objetivo**: Eliminar TODOS los vectores de acceso no autorizado. Sin esto, NO hay producción.

**Horas**: ~48h (Plan 01 completo + Plan 08 Bloque A)

| Tarea | Plan | Bloque | Horas | Impacto |
|-------|------|--------|-------|---------|
| Eliminar `setup-rbac` endpoint | 01 | A1 | 0.25h | Cierra vector de escalación |
| Eliminar fallback secret Telegram | 01 | A2 | 0.25h | Cierra vector RCE |
| Fix middleware: proteger `/api/*` | 01 | A3 | 0.5h | 66 APIs protegidas |
| Firmar cookie admin (`iron-session`) | 01 | A4-A5 | 5h | Sesiones infalsificables |
| Rate limiter en login admin | 01 | A6 | 1h | Anti brute-force |
| `requireAuth()` en 66 APIs | 01 | B1-B2 | 4h | Admin APIs protegidas |
| Zod validation en top 10 mutations | 01 | B3-B4 | 2h | Anti injection |
| ENABLE RLS en 25+ tablas | 01 | C3-C7 | 8h | PII protegido |
| Trigger `handle_new_user()` + FK | 01 | C1-C2 | 3h | Auth sync funcional |
| Fix messaging `USING(true)` | 01 | C5 | 2h | Mensajes privados |
| Fix Printify HMAC timing | 01 | D1 | 0.5h | Anti timing attack |
| Fix WhatsApp webhook bypass | 01 | D2 | 0.5h | Webhook seguro |
| Eliminar MCP JWT bypass | 01 | D3 | 1h | MCP auth real |
| Sanitizar CSS theme injection | 01 | D4 | 1h | Anti CSS injection |
| Frontend admin APIs auth | 01 | D5 | 1h | Admin orders/alert protegidos |
| CSRF protection | 01 | E1-E3 | 4h | Anti cross-site attacks |
| CSP header en Caddy | 01 | E2 | 1h | Content Security Policy |
| CI/CD pipeline básico | 08 | A1-A6 | 6h | Validación automática |
| Migration cleanup (test data) | 03 | C1-C4 | 4h | Sin datos ficticios en prod |

**Score esperado post-Fase 0**: 7.5/10 → **PRODUCCIÓN MÍNIMA VIABLE**

**Criterio de completitud**: Curl a cualquier API admin sin cookie → 401. `SELECT * FROM orders` con anon key → solo rows propias.

---

### FASE 1: Estabilización y Arquitectura (Semanas 3-6)

**Objetivo**: Base de código mantenible, testeable y observable. Admin funcional como dashboard cohesivo.

**Horas**: ~95h (Planes 02, 03 parcial, 08 parcial)

| Tarea | Plan | Horas | Impacto |
|-------|------|-------|---------|
| Admin layout: route group `(dashboard)` | 02-A | 8h | 27 páginas con sidebar |
| Admin React Query migration | 02-B | 10h | Cache, deduplicación, retry |
| Admin UI: fix 62 color tokens + 24 alerts | 02-C | 8h | Design system consistente |
| Admin paginación server-side | 02-D | 5h | Escala con datos |
| Admin Supabase client cleanup | 02-E | 2h | Single source of truth |
| DB indexes faltantes (12 compound) | 03-B | 6h | Queries 5-10x más rápidas |
| pgvector HNSW migration | 03-D | 3h | Similarity search <50ms |
| Connection pooling (Supavisor) | 03-F | 2h | Soporte 50+ concurrent |
| Redis KEYS → SCAN fix | 03-G | 1h | Redis no se bloquea |
| Admin API tests (15+ specs) | 08-B | 10h | Regresiones detectadas |
| MCP Server tests (8+ specs) | 08-C | 6h | 17 tools verificados |
| PodClaw critical path tests | 08-D | 6h | 77KB de lógica cubierta |
| Frontend unit tests foundation | 08-E | 4h | Hooks y utils testeados |
| Admin MFA (TOTP) | 01-F | 6h | 2FA para admin |
| Settings page: conectar a API real | 02-C7 | 1h | Config persiste |
| Eliminar test-sse route | 02-C6 | 0.1h | Sin debug en prod |

**Score esperado post-Fase 1**: 8.0/10

**Criterio de completitud**: `vitest run` en admin → 15+ specs green. Todas las páginas admin con sidebar. 0 color violations.

---

### FASE 2: Funcionalidad Competitiva (Semanas 7-12)

**Objetivo**: Paridad con ecommerce modernos. SEO funcional. Categorías navegables. Agentes resilientes.

**Horas**: ~159h (Planes 04, 05, 06, 07, 13)

| Tarea | Plan | Horas | Impacto |
|-------|------|-------|---------|
| **SEO critical**: Homepage + Shop SSR | 04-A | 10h | Google indexa contenido real |
| Dynamic sitemap con productos | 04-B | 3h | Todas las URLs en Google |
| 6 páginas faltantes (/about, /contact, /faq...) | 04-C | 8h | Footer links dejan de ser 404 |
| Loading states + error boundaries | 04-D | 5h | UX resiliente |
| Fix social links + breadcrumbs | 04-E | 4h | Navegación profesional |
| Legal pages → SafeMarkdown | 04-F | 3h | XSS defense-in-depth |
| **Categorías SQL migration** | 05-A | 5h | Tabla relacional con i18n |
| Categories API + hook | 05-B | 4h | Sin fetch de 100 productos |
| Category landing pages SSR | 05-C | 6h | SEO per categoría |
| Category sidebar + breadcrumbs | 05-D | 4h | Navegación por categoría |
| Admin category CRUD | 05-E | 5h | Gestión de categorías |
| **PodClaw Redis state backend** | 06-A | 6h | Estado persiste en reinicios |
| Bridge non-blocking execution | 06-B | 5h | API responde durante jobs |
| PodClaw Prometheus metrics | 06-C | 8h | Costo/ejecución/errores visibles |
| PodClaw health + decision tree | 06-D | 4h | Status per agente |
| Agent events TTL cleanup | 06-E | 3h | DB no crece sin límite |
| PodClaw 3 archivos críticos tests | 06-F | 10h | 77KB testeado |
| **MCP JWT security** | 07-A | 2h | JWT bypass eliminado |
| MCP test infrastructure | 07-B-C | 7h | OAuth + JWT tested |
| MCP tool tests | 07-D | 5h | 17 tools verificados |
| MCP rate limiting 4-tier | 07-E | 3h | Anti abuse per tool |
| MCP session persistence | 07-F | 3h | Sessions sobreviven restart |
| MCP error + observability | 07-G | 2h | Error codes estándar |
| E2E nuevos (admin + GDPR) | 08-F | 4h | Flujos end-to-end |
| **Printify order retry scheduler** | 13-A | 10h | Órdenes stuck auto-reintentan |
| **Printify variant UPSERT fix** | 13-B | 6h | Race conditions eliminadas |
| **Printify connector resilience** | 13-C | 6h | Backoff + circuit breaker |
| Printify cleanup + consistency | 13-D | 6h | Huérfanos limpiados |
| Printify gobernanza mejorada | 13-E | 6h | DEDUP + admin approval |
| Printify integration tests | 13-F | 4h | Retry, sync, refund testeados |

**Score esperado post-Fase 2**: 8.5/10

**Criterio de completitud**: Google Search Console indexa productos y categorías. PodClaw sobrevive restart. Bridge API responde <200ms durante ejecución de agentes.

---

### FASE 3: Diferenciación y Escala (Semanas 13-20)

**Objetivo**: Observabilidad completa, growth engines activos, documentación de producción.

**Horas**: ~84.5h (Planes 09, 10, 12, 03 parcial)

| Tarea | Plan | Horas | Impacto |
|-------|------|-------|---------|
| **Monitoring stack Docker** | 09-A | 6h | Prometheus + Grafana + Loki |
| Endpoints `/metrics` todos los servicios | 09-B | 6h | Métricas recolectadas |
| 4 dashboards Grafana | 09-C | 5h | Visibilidad total |
| Alertas (Telegram + Email) | 09-D | 4h | Respuesta proactiva |
| Logging estructurado + Loki | 09-E | 3h | Logs centralizados |
| Uptime monitoring | 09-F | 2h | SLA tracking |
| **Double opt-in newsletter** | 10-B | 4h | LEGAL (obligatorio DE) |
| Homepage social proof | 10-A | 6h | Trust signals |
| Reviews con fotos | 10-C | 5h | +270% conversión |
| Cross-sell + recently viewed | 10-D | 5h | Engagement |
| Cart recovery (abandoned carts) | 10-E | 5h | Revenue recuperado |
| Email templates localizados | 10-F | 4h | CAN-SPAM + i18n |
| Blog/content marketing | 10-G | 5h | SEO long-tail |
| Social media + UGC | 10-H | 3h | Sharing + proof |
| Referral program UI | 10-I | 3h | Growth viral |
| Funnel analytics | 10-J | 4h | Métricas de conversión |
| **ADRs + API docs** | 12-A-B | 8h | Decisiones documentadas |
| Onboarding + runbooks | 12-C-D | 6h | Team-ready |
| PodClaw docs + ERD | 12-E | 3h | Schema documentado |
| CHANGELOG + maintenance | 12-F | 1.5h | Historial versionado |
| DB partitioning (3 tablas) | 03-E | 8h | Escala temporal |

**Score esperado post-Fase 3**: 9.0/10

---

### FASE 4: Multi-Tenant SaaS (Semanas 21-32)

**Objetivo**: De single-brand a plataforma SaaS. Múltiples tiendas, billing, aislamiento.

**Horas**: ~93h (Plan 11 completo)

| Sub-fase | Contenido | Horas |
|----------|-----------|-------|
| 4.1 Foundation | `tenants` table, `tenant_id` en 56 tablas, auth function | 20h |
| 4.2 RLS & Isolation | Policies reescritas, storage per tenant, PII encryption | 16h |
| 4.3 Onboarding & Admin | Signup, provisioning, wizard, super-admin panel | 18h |
| 4.4 PodClaw Per-Tenant | Config per tenant, budgets, memory, connectors | 14h |
| 4.5 Billing & Domains | Stripe Connect, 4 planes, Caddy on_demand_tls | 12h |
| 4.6 SMTP & Testing | Custom email per tenant, E2E isolation tests | 6h |

**Score esperado post-Fase 4**: 9.5/10

---

## Quick Wins — Máximo Impacto, Mínimo Esfuerzo

| # | Acción | Tiempo | Plan | Impacto |
|---|--------|--------|------|---------|
| 1 | Eliminar `setup-rbac` + secret Telegram | 30min | 01 | 2 vectores de ataque cerrados |
| 2 | Fix middleware `/api/*` | 30min | 01 | 66 APIs protegidas |
| 3 | Eliminar `test-sse/route.ts` | 5min | 02 | Debug endpoint removido |
| 4 | Printify `timingSafeEqual()` | 30min | 01 | Timing attack prevenido |
| 5 | WhatsApp webhook obligatorio | 30min | 01 | Bypass eliminado |
| 6 | Legal pages → SafeMarkdown | 1h | 04 | XSS defense-in-depth |
| 7 | Redis KEYS → SCAN | 1h | 03 | Redis no se bloquea en prod |
| 8 | `iron-session` en admin | 4h | 01 | Cookies infalsificables |
| 9 | CSP header en Caddy | 1h | 01 | Content Security Policy |
| 10 | Double opt-in newsletter | 4h | 10 | Legalidad en Alemania |

**Total quick wins: ~13h para cerrar los problemas más urgentes**

---

## Dependencias Críticas Entre Planes

```
Plan 01 (Seguridad) ────────┐
                            ├──→ Plan 02 (Admin) ──→ Plan 10 (Growth)
Plan 03 (Database)  ────────┤
                            ├──→ Plan 05 (Categorías) ──→ Plan 04 (Frontend SEO)
Plan 08 (Testing/CI) ──────┘
                            ├──→ Plan 06 (PodClaw) ──→ Plan 09 (Observabilidad)
                            │
                            ├──→ Plan 07 (MCP)
                            │
                            ├──→ Plan 13 (Printify) [requiere 01 HMAC fix]
                            │
                            └──→ Plan 11 (Multi-tenant) [requiere 01+03 completos]

Plan 12 (Docs) ──→ Sin dependencias, ejecutable en cualquier momento
```

**Camino crítico**: 01 → 03 → 05 → 04 → 10 → 11

---

## Riesgos Estratégicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Data breach antes de Fase 0 | Alta (si expuesto) | Crítico — GDPR multas + reputación | **NO DESPLEGAR** hasta completar Fase 0 |
| Costos LLM descontrolados | Media | Alto — EUR 30.15/día = EUR 11K/año | Semantic caching (RedisVL), model routing, `max_budget_usd` |
| PodClaw falla silenciosamente | Alta | Alto — Tienda sin gestión automática | Fase 2: Prometheus + alertas + health checks |
| Google no indexa productos | Alta (actual) | Alto — Sin tráfico orgánico | Fase 2: SSR + JSON-LD + sitemap dinámico |
| Multa por falta de double opt-in (DE) | Media | Alto — hasta EUR 300K (UWG + GDPR) | Quick win #10: implementar antes de marketing |
| Multi-tenant retrofit es destructivo | Baja | Muy alto — 56 tablas + todas las policies | Fase 4 planificada desde el inicio, no improvisada |
| Agentes AI sin observabilidad | Alta (actual) | Alto — debugging ciego | Fase 3: Langfuse + Prometheus + Grafana |
| Context window agota en agentes largos | Media | Medio — tasks incompletas | Artefactos externos + session resumption del SDK |

---

## Secuencia Óptima de Desarrollo

```
Semana 1-2:   [FASE 0] Seguridad + CI/CD básico ═══════════════════ GATE: "¿Puedo desplegar?"
Semana 3-4:   [FASE 1] Admin layout + React Query + DB indexes
Semana 5-6:   [FASE 1] Admin tests + MFA + pgvector + pooling
Semana 7-8:   [FASE 2] SEO (homepage SSR, sitemap) + Categorías SQL
Semana 9-10:  [FASE 2] Category pages + PodClaw Redis + Bridge async
Semana 11-12: [FASE 2] MCP hardening + PodClaw metrics + E2E tests
Semana 13-14: [FASE 3] Monitoring stack + Double opt-in + Reviews
Semana 15-16: [FASE 3] Growth features + Blog + Analytics
Semana 17-18: [FASE 3] Docs + ADRs + Runbooks + DB partitioning
Semana 19-20: [FASE 3] Social + Referrals + Funnel optimization
Semana 21-24: [FASE 4] Multi-tenant foundation + RLS rewrite
Semana 25-28: [FASE 4] Tenant onboarding + PodClaw per-tenant
Semana 29-32: [FASE 4] Billing + Custom domains + SMTP + Testing
```

---

## Para Harness V3

Este roadmap se traduce directamente en:

1. **`app_spec.txt`**: Resumen del proyecto con datos reales validados (no estimaciones del audit)
2. **`feature_list.json`**: Cada tarea numerada → un feature testeable
3. **Módulos paralelizables**: Planes 01+03 (Fase 0), 04+05+06+07 (Fase 2), 09+10+12 (Fase 3)
4. **Validaciones incrementales**: Cada bloque tiene criterios de éxito verificables por el agente

**Estructura propuesta para feature_list.json**:
- Fase 0: ~25 features (seguridad + CI/CD)
- Fase 1: ~30 features (admin + DB + tests)
- Fase 2: ~60 features (frontend + categorías + PodClaw + MCP + Printify)
- Fase 3: ~35 features (observabilidad + growth + docs)
- Fase 4: ~40 features (multi-tenant)
- **Total estimado: ~190 features**

---

## Conclusión

POD AI tiene una base técnica sólida en varias áreas (PodClaw 8/10, Docker 7.5/10, i18n/GDPR 9.5/10) pero el admin panel es una **puerta abierta** que bloquea todo. Las 48 horas de la Fase 0 transforman el proyecto de "demo insegura" a "MVP desplegable". Las siguientes 390 horas lo llevan de MVP a plataforma SaaS competitiva.

**El diferenciador real** — un agente IA autónomo gestionando una tienda ecommerce — está bien construido a nivel de agentes pero invisible sin observabilidad. La inversión en Prometheus/Grafana/Langfuse convierte PodClaw de "caja negra que funciona" a "plataforma AI observable y confiable".

**Prioridad absoluta**: Seguridad (Fase 0) → Admin + Tests (Fase 1) → SEO + Categorías + PodClaw (Fase 2) → Growth + Observabilidad (Fase 3) → Multi-tenant (Fase 4).

---

*Roadmap generado 2026-02-23. Basado en auditoría 360° validada (93% precisión) + investigación externa de 7 dominios + auditoría integral Printify. 13 planes de desarrollo con 476.5h de trabajo estimadas.*
