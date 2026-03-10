# MCP Server — Auditoría Consolidada

**Fecha**: 2026-03-09
**Auditor**: Claude Opus 4.6
**Scope**: `/mcp-server/` completo — core, auth, 17 tools, tests, infraestructura
**Reportes fuente**: `AUDIT_CORE_AUTH_SECURITY.md`, `AUDIT_TOOLS.md`, `AUDIT_TESTS_INFRA.md`

---

## Scorecard Ejecutivo

| Dominio | Score | Estado |
|---|---|---|
| Arquitectura MCP | 9/10 | Excelente — transport-per-session, StreamableHTTP, correcto |
| Input Validation | 9/10 | Zod en todos los tools, UUID validation, sanitizeForLike |
| Auth (OAuth 2.1) | 6/10 | PKCE correcto, pero sin refresh tokens, test user hardcoded |
| Data Access (RLS) | 3/10 | **CRITICAL** — service key bypassa RLS en TODAS las queries |
| Rate Limiting | 7/10 | Redis sliding window + in-memory fallback, pero fail-open |
| Tool Completeness | 7/10 | 17 tools, faltan coupon/review/return |
| Test Coverage | 3/10 | **CRITICAL** — 3/17 tools testeados, 2 suites rotas |
| Docker/Infra | 8/10 | Multi-stage, non-root, healthcheck. Falta NODE_ENV |
| Error Handling | 8/10 | Consistente, una excepción (Stripe error leak) |
| Seguridad General | 6/10 | Buenos patrones, debilidades en defense-in-depth |

**Score Global: 6.6/10** — Producción NO recomendada sin fixes CRITICAL

---

## Hallazgos por Severidad (Verificados contra codebase)

### CRITICAL (3)

| # | Hallazgo | Archivo | Verificado |
|---|---|---|---|
| C1 | **Supabase service key en TODAS las queries** — RLS completamente bypassed. Si cualquier tool tiene un bug en userId filter, se expone toda la DB | `src/lib/supabase.ts:17` | SI |
| C2 | **Test user hardcoded en OAuth auto_approve** — Accesible cuando NODE_ENV no es 'production'. El Dockerfile NO setea NODE_ENV | `src/auth/oauth-provider.ts:204-208`, `Dockerfile` | SI |
| C3 | **14/17 tools sin tests** — Solo search-products tiene tests funcionales. get-cart y create-checkout solo testean auth guard. OAuth tests rotos (MCP_JWT_SECRET) | `src/__tests__/tools.test.ts` | SI |

### HIGH (6)

| # | Hallazgo | Archivo | Verificado |
|---|---|---|---|
| H1 | Auth enforcement per-tool, no centralizada — un tool nuevo sin auth check queda público | `src/index.ts:677-678` | SI |
| H2 | Rate limiter fail-open en Redis error — `return true` en catch block | `src/middleware/rate-limit.ts:243-247` | SI |
| H3 | X-Forwarded-For trusted sin validación de proxy — IP spoofing para bypass rate limit | `src/middleware/rate-limit.ts:54-59` | SI |
| H4 | Sin refresh tokens — access tokens de 24h sin rotación | `src/auth/oauth-provider.ts:452-453` | SI |
| H5 | create_checkout leaks Stripe error messages — `err.message` directo al caller | `src/tools/create-checkout.ts:180` | SI |
| H6 | list_categories fetch ALL products — O(n) en cada llamada, escala mal | `src/tools/list-categories.ts:43-48` | SI |

### MEDIUM (10)

| # | Hallazgo | Archivo |
|---|---|---|
| M1 | search_products sin offset/paginación | `src/tools/search-products.ts` |
| M2 | get_product_details usa SELECT * (puede exponer columnas internas) | `src/tools/get-product-details.ts` |
| M3 | get_cart default currency 'USD' en vez de 'EUR' | `src/tools/get-cart.ts:97` |
| M4 | list_categories sin cache Redis | `src/tools/list-categories.ts` |
| M5 | create_checkout permite open redirect via success_url/cancel_url | `src/tools/create-checkout.ts` |
| M6 | update_my_profile sin max length en name | `src/tools/update-my-profile.ts` |
| M7 | remove_from_wishlist solo remueve items con variant_id IS NULL | `src/tools/remove-from-wishlist.ts:86` |
| M8 | OAuth login form sin CSRF token | `src/auth/oauth-provider.ts:270` |
| M9 | redis.keys() O(N) en session listing | `src/session.ts:113` |
| M10 | User IDs en logs (PII/GDPR) | `src/session.ts:38` |

### LOW (7)

| # | Hallazgo | Archivo |
|---|---|---|
| L1 | JWT secret hardcoded en start-dev.sh | `start-dev.sh:13` |
| L2 | .env.example usa JWT_SECRET, código usa MCP_JWT_SECRET | `.env.example:26` |
| L3 | Policies referencia Printify/podstore.local en vez de Printful/SKAPARA | `src/resources/policies.ts` |
| L4 | Deprecated SDK methods con @ts-ignore | `src/index.ts:565-566,597` |
| L5 | Coverage thresholds 30% (demasiado bajo) | `vitest.config.ts:34-37` |
| L6 | 5 scripts debug huérfanos en raíz con paths absolutos hardcoded | raíz del proyecto |
| L7 | supertest instalado pero nunca usado | `package.json` devDependencies |

---

## Hallazgos Positivos

1. **PKCE S256 correctamente implementado** en OAuth 2.1
2. **Zod schemas en TODOS los inputs** con UUID validation y range limits
3. **sanitizeForLike()** previene ILIKE injection en PostgreSQL
4. **escapeHtml()** en output del OAuth form
5. **Body size limits**: 1MB MCP, 16KB OAuth
6. **withAuditLog()** wrapper con PII sanitization
7. **Tool annotations** correctos (readOnlyHint, destructiveHint, idempotentHint)
8. **IDOR protection** en get_order_status y track_shipment
9. **Context injection** — userId viene de JWT, nunca del input del cliente
10. **Graceful shutdown** con cleanup de transports y Redis
11. **Health + Readiness** endpoints separados con dependency checks
12. **Docker**: multi-stage, non-root, Alpine, healthcheck
13. **Token revocation** RFC 7009 con Redis blacklist + TTL
14. **3 vulnerabilidades npm fixeables** con `npm audit fix`

---

## Tools Faltantes (Completitud)

| Tool | Prioridad | Razón |
|---|---|---|
| `validate_coupon` / `apply_coupon` | HIGH | Sistema de cupones existe en frontend, inaccesible via MCP |
| `submit_review` | MEDIUM | Puede leer reviews pero no crear |
| `request_return` | MEDIUM | Sin forma de iniciar devoluciones via AI |
| `get_shipping_estimate` | MEDIUM | Sin estimación de envío pre-checkout |
| `clear_cart` | LOW | Solo puede remover items uno a uno |
| `get_product_recommendations` | LOW | Sin recomendaciones personalizadas |

---

## Plan de Acción (Priorizado)

### Inmediato (Antes de Producción)

1. **Dockerfile**: Agregar `ENV NODE_ENV=production` → bloquea auto_approve (C2)
2. **npm audit fix**: Resuelve 3 vulnerabilidades HIGH (hono, express-rate-limit)
3. **Rate limiter**: Fallback a in-memory en Redis error en vez de fail-open (H2)
4. **Stripe error leak**: Retornar mensaje genérico en create-checkout (H5)
5. **.env.example**: Cambiar JWT_SECRET → MCP_JWT_SECRET (L2)

### Corto Plazo (Pre-lanzamiento)

6. **User-scoped Supabase client** para tools protegidos — defense-in-depth via RLS (C1)
7. **Auth middleware centralizado** en vez de per-tool checks (H1)
8. **Fix OAuth tests**: Setear MCP_JWT_SECRET en vitest setup file (C3)
9. **X-Forwarded-For**: Usar último IP de la cadena o X-Real-IP de Caddy (H3)
10. **Refresh tokens**: Access tokens de 1h + refresh token con rotación (H4)
11. **list_categories**: RPC o materialized view + cache Redis 5min (H6)

### Medio Plazo

12. **Tests para los 14 tools restantes** (target cobertura 70%)
13. **Paginación** en search_products, list_my_orders
14. **validate_coupon tool** para MCP
15. **Cleanup**: Mover 5 scripts debug a scripts/debug/ o eliminar
16. **Actualizar deps mayores**: stripe 17→20, jose 5→6

---

*Reportes detallados disponibles en:*
- `AUDIT_CORE_AUTH_SECURITY.md` — arquitectura, OAuth, seguridad, Docker
- `AUDIT_TOOLS.md` — auditoría individual de los 17 tools
- `AUDIT_TESTS_INFRA.md` — cobertura de tests, Dockerfile, scripts
