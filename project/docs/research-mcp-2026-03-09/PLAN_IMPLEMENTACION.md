# MCP Server — Plan de Implementacion

**Fecha**: 2026-03-09
**Basado en**: 3 reportes de auditoria + 5 documentos de research
**Objetivo**: MCP server production-ready, compatible con ChatGPT y Claude, seguro para e-commerce real

---

## Contexto

Nuestro MCP server (17 tools, StreamableHTTP, OAuth 2.1+PKCE) es **arquitecturalmente correcto** — el transport-per-session, tool registration, y Zod validation siguen los patrones oficiales del SDK. Sin embargo, tiene gaps de seguridad criticos para un servidor publico que maneja datos reales de usuarios (pagos, pedidos, perfiles).

### Referencia del ecosistema

| Server | Tools | Auth | Approach |
|---|---|---|---|
| **Shopify MCP** | 4 | None (storefront) | Minimal, public-only |
| **Stripe MCP** | 29 | OAuth / API keys | verb_noun, hosted |
| **commercetools** | 40+ | Configurable | CRUD per domain |
| **SKAPARA (nosotros)** | 17 | OAuth 2.1 + PKCE | Hybrid public/auth |

Nuestro approach es el correcto para nuestro caso: **hybrid public/authenticated** como Shopify (split by auth), con tool granularity tipo Stripe (verb_noun).

---

## Fases de Implementacion

### FASE 1 — Security Fixes (Critico, antes de produccion)

**Objetivo**: Cerrar todos los hallazgos CRITICAL y HIGH de la auditoria.

#### 1.1 Dockerfile: NODE_ENV=production
- Agregar `ENV NODE_ENV=production` al runtime stage
- Bloquea auto_approve backdoor de OAuth
- **Esfuerzo**: 1 linea

#### 1.2 Rate Limiter: Fail-closed para checkout, fail-to-memory para resto
- En `rate-limit.ts:243-247`: catch block llama `rateLimitInMemory()` en vez de `return true`
- Para `create_checkout`: fail-closed (rechazar si no se puede verificar rate limit)
- **Esfuerzo**: 10 lineas

#### 1.3 Stripe Error Leak
- En `create-checkout.ts:180`: retornar mensaje generico en vez de `err.message`
- **Esfuerzo**: 1 linea

#### 1.4 X-Forwarded-For Trust
- Implementar `TRUSTED_PROXY_IPS` env var
- Solo confiar en X-Forwarded-For si viene de proxy conocido
- Tomar ultimo IP no-trusted de la cadena (no el primero)
- **Esfuerzo**: 20 lineas

#### 1.5 npm audit fix
- Resolver 3 vulnerabilidades HIGH (hono, @hono/node-server, express-rate-limit)
- **Esfuerzo**: 1 comando

#### 1.6 .env.example: JWT_SECRET -> MCP_JWT_SECRET
- Corregir inconsistencia de nombre de variable
- **Esfuerzo**: 1 linea

---

### FASE 2 — Auth Hardening (Pre-lanzamiento)

**Objetivo**: Cumplir con MCP spec 2025-11-25 y OAuth 2.1 best practices.

#### 2.1 Token Lifetime + Refresh Tokens
- Access token: **15 minutos** (no 24h) — standard para APIs con datos de pago
- Implementar refresh tokens (opaque, Redis, 7 dias, one-time-use con rotation)
- Agregar `grant_type: 'refresh_token'` al token endpoint
- Replay detection: si refresh token ya usado, revocar toda la familia
- **Referencia**: `02_AUTH_SESSION_SECURITY.md` seccion 5.1

#### 2.2 JWT Audience Fix (RFC 8707)
- Crear JWT con `audience: MCP_BASE_URL` (no `'mcp-client'`)
- Validar audience en `jwtVerify()` — `{ issuer: MCP_BASE_URL, audience: MCP_BASE_URL }`
- **Referencia**: MCP spec 2025-11-25, RFC 8707

#### 2.3 Token Revocation Race Fix
- Al revocar: escribir a AMBOS Redis + in-memory simultaneamente
- Al validar: checar in-memory PRIMERO (siempre disponible), luego Redis (para tokens revocados por otras instancias)
- **Referencia**: `02_AUTH_SESSION_SECURITY.md` seccion 5.2

#### 2.4 Protected Resource Metadata en 401
- Cuando tool requiere auth y no hay token, retornar HTTP 401 con:
  ```
  WWW-Authenticate: Bearer resource_metadata="https://mcp.skapara.com/.well-known/oauth-protected-resource"
  ```
- Requerido por MCP spec 2025-11-25 (RFC 9728)

#### 2.5 Auth Middleware Centralizado
- Crear `withAuth()` HOF wrapper que reemplaza los checks manuales en cada tool
- Tool registry pattern: cada tool declara `auth: 'required' | 'optional' | 'none'`
- El middleware rechaza automaticamente antes de llegar al handler
- **Referencia**: `03_TYPESCRIPT_ARCHITECTURE.md` seccion 4

#### 2.6 OAuth Rate Limiting
- Rate limit en endpoints OAuth: `/oauth/token` (10/min/IP), `/oauth/authorize` (20/min/IP)
- Previene brute-force de authorization codes

#### 2.7 Auto-approve Hardening
- Cambiar guard de `NODE_ENV !== 'production'` a `MCP_ENABLE_TEST_AUTH === 'true'`
- Variable explicita, no dependiente de NODE_ENV
- No incluir en .env.example produccion

---

### FASE 3 — Architecture Refactor

**Objetivo**: Reducir index.ts de 1018 a ~150 lineas, mejorar mantenibilidad.

#### 3.1 Tool Registry Pattern
- Extraer 17 tool registrations de `index.ts` a un registry
- Cada tool exporta: `{ name, meta, handler }` (schema, annotations, auth requirement)
- `index.ts` solo hace: `registerAllTools(server)` + HTTP routing
- **Beneficio**: index.ts pasa de 1018 a ~150 lineas

#### 3.2 Response Wrapper Unificado
- Crear `createToolResponse()` que estandariza:
  - `content: [{ type: 'text', text: JSON.stringify(data) }]`
  - `structuredContent: data`
  - `isError` flag
- Eliminar el pattern repetido 17 veces

#### 3.3 outputSchema en Tools
- Agregar `outputSchema` (Zod) a todos los tools que retornan datos estructurados
- Permite validacion automatica por el SDK y mejor typing para clients

#### 3.4 Fix Tool Annotations
- `openWorldHint: false` en la mayoria (operan en dominio cerrado)
- `add_to_wishlist`: `destructiveHint: false` (no es destructivo, es aditivo)
- Solo `openWorldHint: true` en tools que llaman APIs externas (create_checkout -> Stripe)

---

### FASE 4 — SDK Upgrade + Spec Compliance

**Objetivo**: Actualizar a SDK estable mas reciente y cumplir spec 2025-11-25.

#### 4.1 SDK Upgrade
- `@modelcontextprotocol/sdk` de `^1.0.4` a `^1.27.1`
- Migrar `server.resource()` y `server.prompt()` (deprecated) a `server.registerResource()` y `server.registerPrompt()`
- Eliminar `@ts-ignore` de index.ts

#### 4.2 InMemoryEventStore para Resumability
- Agregar `eventStore: new InMemoryEventStore()` al crear transports
- Permite reconexion SSE con `Last-Event-ID`
- Patron oficial del SDK

#### 4.3 Protocol Version Header
- Validar `MCP-Protocol-Version` header en requests (requerido por spec 2025-11-25)
- Responder `400 Bad Request` si version no soportada

#### 4.4 CORS Completo
- Agregar `Vary: Origin` header
- Agregar `Access-Control-Expose-Headers: Mcp-Session-Id, WWW-Authenticate`
- Agregar origins: `claude.ai`, `chatgpt.com`

#### 4.5 Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Cache-Control: no-store`
- `Strict-Transport-Security` (via Caddy, no duplicar)

---

### FASE 5 — Data Access + Completeness

**Objetivo**: Defense-in-depth en DB y tools faltantes.

#### 5.1 Supabase Client Split
- `getAnonClient()` — para tools publicos (catalog, categories, store info)
- `getAdminClient()` — solo para operaciones admin (health check, system queries)
- Para tools autenticados: mantener service key + OBLIGAR `.eq('user_id', userId)` via helper `scopedQuery()`
- **Por que no user JWT**: Nuestro MCP emite sus propios JWTs, no Supabase JWTs. Crear Supabase-compatible JWTs requiere el JWT secret de Supabase, que es un acoplamiento fuerte.

#### 5.2 Ownership Check en Query (no post-fetch)
- `get_order_status` y `track_shipment`: agregar `.eq('user_id', userId)` al query
- Eliminar el pattern de "fetch todo, luego checar"

#### 5.3 list_categories Optimization
- Reemplazar fetch-all-products con RPC de Supabase (`rpc('get_category_counts')`)
- O materializar con cache Redis (TTL 5 min)

#### 5.4 Tools Faltantes
- `validate_coupon` — HIGH prioridad (sistema existe en frontend)
- `submit_review` — MEDIUM
- `get_shipping_estimate` — MEDIUM
- Paginacion en `search_products` y `list_my_orders` (agregar `offset`)

#### 5.5 Fixes Menores
- `get_cart`: default currency `'EUR'` (no `'USD'`)
- `get_product_details`: SELECT explicito (no `*`)
- `update_my_profile`: `.max(100)` en name
- `create_checkout`: validar success_url/cancel_url contra dominios permitidos
- Policies: actualizar brand a SKAPARA, provider a Printful

---

### FASE 6 — Tests + Cleanup

**Objetivo**: Cobertura de tests robusta y proyecto limpio.

#### 6.1 Fix OAuth Tests
- Setear `MCP_JWT_SECRET` en vitest setup file
- Eliminar `oauth.test.ts` (duplicado de `oauth-flow.test.ts`)

#### 6.2 Tests para Tools Restantes
- Minimo: auth guard test para los 11 tools protegidos
- Funcional: search-products, get-product-details, list-categories, update-cart, create-checkout
- Target: 70% cobertura

#### 6.3 Integration Tests
- Usar supertest (ya instalado) para testear HTTP endpoints
- Test MCP protocol flow: initialize -> tools/call -> response
- Test CORS headers, rate limiting, auth rejection

#### 6.4 Cleanup
- Mover 5 scripts debug a `scripts/debug/` o eliminar
- Eliminar `supertest`/`@types/supertest` si no se usan, o escribir integration tests
- Subir coverage thresholds de 30% a 60%

---

## Orden de Ejecucion Recomendado

```
FASE 1 (Security Fixes)     — INMEDIATO        — ~2h
FASE 2 (Auth Hardening)     — Semana 1         — ~6h
FASE 3 (Architecture)       — Semana 1-2       — ~4h
FASE 4 (SDK + Spec)         — Semana 2         — ~3h
FASE 5 (Data + Completeness)— Semana 2-3       — ~4h
FASE 6 (Tests + Cleanup)    — Continuo         — ~4h
```

Total estimado: ~23h de desarrollo

---

## Compatibilidad con AI Clients

Despues de estas fases, nuestro MCP server sera compatible con:

| Client | Requisitos | Estado actual | Despues |
|---|---|---|---|
| **ChatGPT** | HTTPS, StreamableHTTP, OAuth opcional | Falta HTTPS publico | Compatible |
| **Claude** | HTTPS, OAuth+PKCE, Dynamic Client Registration | Falta DCR y HTTPS | Compatible (DCR en backlog) |
| **Custom clients** | StreamableHTTP, Bearer token | Funcional | Mejorado |

**Nota**: Dynamic Client Registration (DCR) queda en backlog (FASE 5+). Claude funciona sin DCR si se configura manualmente.

---

*Basado en:*
- `01_MCP_SDK_SPEC_AUTH.md` — Spec oficial, transport, auth
- `02_AUTH_SESSION_SECURITY.md` — OAuth 2.1 best practices, token lifecycle
- `03_TYPESCRIPT_ARCHITECTURE.md` — Patterns de produccion, middleware, testing
- `04_SECURITY_HARDENING.md` — OWASP, threat model, rate limiting
- `05_ECOMMERCE_REFERENCE.md` — Shopify/Stripe/PayPal MCP, ChatGPT/Claude integration
- `AUDIT_CONSOLIDATED.md` — Hallazgos verificados de la auditoria
