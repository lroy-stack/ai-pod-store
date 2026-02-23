# Plan 08 — Testing Strategy & CI/CD

**Prioridad**: P0 — BLOQUEANTE
**Estimación**: 35-40h
**Dependencias**: Plan 01 (Seguridad) parcialmente — tests de auth necesitan auth funcional
**Bloquea**: Todos los planes (CI/CD valida cada cambio)

---

## 1. Objetivo

Establecer un pipeline de CI/CD que bloquee merges con regresiones, y una estrategia de testing que cubra los componentes críticos sin aspirar a 100% coverage (irreal para un proyecto AI-heavy).

## 2. Estado Actual (Validado)

| Área | Cobertura | Evidencia |
|------|-----------|-----------|
| PodClaw unit tests | 21 archivos | conftest robusto, mocks de connectors |
| Frontend E2E | 36 Playwright specs | Auth, cart, chat, shop cubiertos |
| Admin tests | **0** | Ni unit ni E2E |
| MCP Server tests | **0** | Ni unit ni integration |
| Frontend unit tests | **0** | Sin vitest/jest configurado |
| CI/CD | 1 workflow (`ci.yml`) | Existe pero audit lo reportó como vacío — verificar contenido |
| PodClaw critical untested | 3 archivos | `production_governor.py` (27KB), `chat_session.py` (34KB), `soul_evolution.py` (16KB) |

## 3. Gap Estructural

Testing es bimodal: PodClaw y Playwright están bien cubiertos, pero admin (34 páginas, 69 APIs) y MCP (17 tools) tienen cobertura CERO. Esto significa que cualquier refactor en Plan 02 (Admin) puede introducir regresiones invisibles. Sin CI/CD funcional, los cambios de todos los planes se acumulan sin validación automática.

## 4. Decisión Arquitectónica

### Testing Pyramid para POD AI

```
         /\
        /  \  E2E (Playwright) — 36 specs existentes + 15 nuevos
       /    \  → Happy paths de usuario completos
      /------\
     /        \  Integration — 30 specs nuevos
    /          \  → Admin APIs con auth, MCP tools, Bridge API
   /------------\
  /              \  Unit — 40 specs nuevos
 /                \  → Schemas Zod, utils, hooks, componentes críticos
/==================\
```

### CI/CD: GitHub Actions con 4 stages

**Justificación**:
- `ci.yml` ya existe — construir sobre lo que hay
- 4 stages paralelos: lint+typecheck, unit tests, integration tests, docker build
- E2E se ejecuta on-demand (demasiado lento para cada push)
- PRs bloqueados si cualquier stage falla

### Test Framework: Vitest (admin + frontend unit) + Playwright (E2E)

**Justificación**:
- Vitest es 5-10x más rápido que Jest para proyectos Vite/Next.js
- Playwright ya está configurado y tiene 36 specs
- pytest ya cubre PodClaw — no cambiar

## 5. Plan de Implementación

### Bloque A: CI/CD Pipeline (6h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| A1 | Auditar `ci.yml` existente — verificar qué stages tiene | 30min |
| A2 | Stage 1: Lint + TypeScript (`eslint . && tsc --noEmit` para frontend + admin) | 1h |
| A3 | Stage 2: Unit tests (`vitest run` para frontend + admin, `pytest` para PodClaw) | 1h |
| A4 | Stage 3: Integration tests (MCP tools, admin APIs) | 1h |
| A5 | Stage 4: Docker build smoke test (`docker compose build`) | 1h |
| A6 | Branch protection rules: require CI pass for merge to main | 30min |

### Bloque B: Admin API Tests (10h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| B1 | Configurar Vitest en admin (`vitest.config.ts`, scripts) | 1h |
| B2 | Test helper: mock de iron-session, mock de Supabase client | 1h |
| B3 | Tests de auth: login success, login fail, session expired, rate limit | 2h |
| B4 | Tests de CRUD products: create, read, update, delete con auth | 2h |
| B5 | Tests de orders: list, detail, status update con auth | 1.5h |
| B6 | Tests de designs: list, moderate, delete con auth | 1.5h |
| B7 | Tests de settings/branding: save, load con auth | 1h |

### Bloque C: MCP Server Tests (6h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| C1 | Configurar Vitest en mcp-server | 1h |
| C2 | Tests de OAuth flow: authorize, token, revoke, PKCE | 2h |
| C3 | Tests de 5 tools principales: search-products, get-cart, create-checkout, get-order-status, get-my-profile | 2h |
| C4 | Tests de session management: create, resume, expire | 1h |

### Bloque D: PodClaw Critical Path Tests (6h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| D1 | Tests para `production_governor.py`: budget enforcement, kill switches, escalation | 2h |
| D2 | Tests para `chat_session.py`: SSE streaming, message routing, error handling | 2h |
| D3 | Tests para `soul_evolution.py`: constraint immutability, personality drift detection | 2h |

### Bloque E: Frontend Unit Tests — Foundational (4h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| E1 | Configurar Vitest + React Testing Library en frontend | 1h |
| E2 | Tests de utils: `cookie-consent.ts`, `legal-utils.ts`, `unsubscribe-token.ts` | 1h |
| E3 | Tests de hooks: `useAuth`, `useCart`, `useChat` | 1h |
| E4 | Tests de componentes: `SafeMarkdown`, `CookieConsent`, `StorefrontHeader` | 1h |

### Bloque F: Playwright E2E — Nuevos Specs (4h)

| # | Tarea | Esfuerzo |
|---|-------|----------|
| F1 | Admin E2E: login → products CRUD → logout | 1.5h |
| F2 | Admin E2E: orders management → status update | 1h |
| F3 | GDPR E2E: export data → request deletion → verify | 1h |
| F4 | Newsletter E2E: subscribe → unsubscribe flow | 30min |

## 6. Orden de Ejecución

```
Bloque A (CI/CD) ── primer commit
        ↓
Bloque B (Admin Tests) ──┐
Bloque C (MCP Tests)  ───┤── en paralelo
Bloque D (PodClaw)  ─────┤
Bloque E (Frontend Unit) ─┘
        ↓
Bloque F (E2E) ── último (necesita todo funcionando)
```

## 7. Validaciones Técnicas

| # | Validación | Criterio |
|---|-----------|----------|
| V1 | CI pipeline pasa | Push a branch → 4 stages green |
| V2 | Branch protection | PR sin CI → cannot merge |
| V3 | Admin tests | `vitest run` → 10+ specs passing |
| V4 | MCP tests | `vitest run` → 8+ specs passing |
| V5 | PodClaw critical | `pytest tests/` → production_governor, chat_session, soul_evolution covered |
| V6 | Coverage report | Generated and visible in CI output |

## 8. Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Admin test specs | 0 | 15+ |
| MCP test specs | 0 | 8+ |
| PodClaw untested critical files | 3 | 0 |
| Frontend unit tests | 0 | 10+ |
| CI/CD stages | ? (audit inconsistente) | 4 stages funcionales |
| E2E specs total | 36 | 40+ |
| Testing score | 5/10 | 8/10 |

## 9. Estimación Total

| Bloque | Horas |
|--------|-------|
| A — CI/CD | 6h |
| B — Admin Tests | 10h |
| C — MCP Tests | 6h |
| D — PodClaw Critical | 6h |
| E — Frontend Unit | 4h |
| F — E2E Nuevos | 4h |
| **Total** | **36h** |

**Con 3 agentes paralelos (B+C+D)**: ~20h elapsed

---

*Plan derivado de audit 06-testing-docs.md validado. CI/CD existe (corrección al audit). 2026-02-23.*
