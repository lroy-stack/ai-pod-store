# Plan 07 — MCP Server

**Prioridad**: P1
**Estimacion**: 20-25h
**Dependencias**: Plan 01 (fix JWT bypass en `session.ts:68-92`)
**Bloquea**: Plan 08 (testing CI/CD — cobertura MCP server)

---

## 1. Objetivo

Convertir el MCP server de un servicio funcional sin cobertura de tests ni controles granulares en un componente production-ready: JWT seguro, tests automatizados, rate limiting por tool, persistencia de sesiones, y health checks completos.

## 2. Estado Actual (Validado)

| Area | Score | Evidencia |
|------|-------|-----------|
| OAuth 2.1 | 8/10 | PKCE obligatorio (S256), authorize/token/revoke, codigos en Redis con uso unico |
| JWT MCP-issued | 7/10 | HS256 firmado, issuer check, revocacion Redis+in-memory |
| JWT Supabase fallback | 1/10 | `session.ts:68-92` decodifica sin verificacion de firma |
| Rate Limiting global | 6/10 | Sliding window Redis+fallback, 60/120 req/min, fail-open |
| Rate Limiting per-tool | 0/10 | No existe. Un cliente puede hacer 120 `create_checkout`/min |
| Tests | 0/10 | Zero archivos de test, sin vitest/jest, sin script `test` en `package.json` |
| Health Check | 5/10 | `/health` basico existe, `/ready` verifica Supabase/Redis/Stripe |
| Sesiones MCP | 3/10 | `Map<string, Transport>` en memoria, se pierde en restart |
| Audit Logging | 8/10 | `withAuditLog()` decorator en todos los tools, redaccion de secrets |
| Error Responses | 5/10 | JSON-RPC basico, sin error codes estandarizados ni detalles utiles |
| Input Validation | 6/10 | Zod schemas en tools pero sin limites de longitud consistentes |
| CORS | 4/10 | Hardcoded `claude.ai`, `chatgpt.com`, `localhost:3000` |

### Inventario de Tools (17 implementados)

| # | Tool | Auth | Tipo | Riesgo sin per-tool rate limit |
|---|------|------|------|-------------------------------|
| 1 | `search_products` | PUBLIC | Read | Medio -- queries costosas a Supabase |
| 2 | `get_product_details` | PUBLIC | Read | Bajo |
| 3 | `get_store_info` | PUBLIC | Read | Bajo |
| 4 | `get_store_policies` | PUBLIC | Read | Bajo |
| 5 | `list_categories` | PUBLIC | Read | Bajo |
| 6 | `get_product_reviews` | PUBLIC | Read | Bajo |
| 7 | `get_my_profile` | PROTECTED | Read | Bajo |
| 8 | `update_my_profile` | PROTECTED | Write | Medio -- data mutation |
| 9 | `list_my_orders` | PROTECTED | Read | Bajo |
| 10 | `get_order_status` | PROTECTED | Read | Bajo |
| 11 | `track_shipment` | PROTECTED | Read | Bajo |
| 12 | `get_cart` | PROTECTED | Read | Bajo |
| 13 | `update_cart` | PROTECTED | Write | Alto -- puede crear items infinitos |
| 14 | `create_checkout` | PROTECTED | Write | **Critico** -- crea sesiones Stripe ($) |
| 15 | `list_wishlist` | PROTECTED | Read | Bajo |
| 16 | `add_to_wishlist` | PROTECTED | Write | Medio -- llena DB |
| 17 | `remove_from_wishlist` | PROTECTED | Write | Bajo |

### Cadena de ataque actual (JWT bypass):

1. Construir JWT con payload `{"iss":"https://xyzxyz.supabase.co","sub":"victim-uuid","email":"victim@email.com"}`
2. Base64-encode sin firma valida
3. `Authorization: Bearer <token-manipulado>` pasa `validateJwt()` en `session.ts:68-92`
4. Acceder a tools protegidos con identidad de cualquier usuario

## 3. Gap Estructural

El MCP server fue construido con buena arquitectura (OAuth 2.1 completo, audit logging, rate limiting) pero tiene tres huecos criticos que lo hacen inseguro para produccion:

1. **JWT Supabase sin firma**: El fallback en `session.ts:68-92` fue pensado para desarrollo pero esta activo en todos los entornos. Cualquier token con `iss` conteniendo `supabase.co` se acepta sin verificacion criptografica. Esto permite impersonacion de cualquier usuario.

2. **Zero tests**: 17 tools, OAuth 2.1 completo, rate limiting, session management -- y ni un solo test. Cualquier cambio puede romper funcionalidad silenciosamente. El `package.json` ni siquiera tiene un script `test`.

3. **Sesiones efimeras**: El `Map<string, Transport>` en memoria significa que un restart del proceso pierde todas las sesiones activas. En Docker esto ocurre en cada deploy. Sin persistencia en Redis, no hay horizontal scaling posible.

El rate limiting es global (por IP) pero no granular por tool, lo que permite que un cliente autenticado haga 120 `create_checkout` por minuto creando sesiones Stripe innecesarias.

## 4. Decision Arquitectonica

### JWT: Eliminar fallback Supabase (NO arreglar, ELIMINAR)

**Justificacion**:
- El frontend ya tiene su propia autenticacion via Supabase Auth -- no necesita pasar tokens Supabase al MCP server
- El MCP server emite sus propios JWTs via OAuth 2.1 -- ese es el flujo correcto
- "Arreglar" el fallback (verificando firma con JWKS de Supabase) agrega complejidad innecesaria y un segundo sistema de auth
- La solucion correcta es que el frontend obtenga un MCP JWT via OAuth y use ese token

### Tests: Vitest (NO Jest)

**Justificacion**:
- El proyecto es ESM-first (`"type": "module"` en `package.json`) -- Jest tiene problemas con ESM
- Vitest soporta ESM nativamente, TypeScript sin config extra, y es mas rapido
- El frontend ya usa un stack compatible (Next.js + TypeScript)
- Mocking de Supabase/Stripe/Redis es directo con `vi.mock()`

### Rate Limiting: Per-tool con tiers (NO reescribir, EXTENDER)

**Justificacion**:
- El rate limiter actual (`middleware/rate-limit.ts`) es solido -- sliding window con Redis
- Solo necesita extenderse para aceptar un `toolName` parameter y consultar limites por tier
- Los tools de escritura y especialmente `create_checkout` necesitan limites mucho mas restrictivos
- El patron existente de Redis sorted sets escala bien para keys adicionales

### Sesiones: Metadata en Redis + Transport local (NO serializar transports)

**Justificacion**:
- Los `StreamableHTTPServerTransport` del SDK no son serializables -- no se pueden guardar en Redis completos
- La solucion practica es guardar metadata (auth, created_at, last_activity) en Redis
- En restart, los clientes reconectan automaticamente (el SDK MCP lo soporta)
- Para horizontal scaling futuro: sticky sessions en Caddy (upstream hash por session-id)

## 5. Plan de Implementacion

### Bloque A: Seguridad JWT (2h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| A1 | Eliminar bloque Supabase JWT fallback (lineas 67-92) | `mcp-server/src/auth/session.ts` | 30min | G3 |
| A2 | Mejorar error en catch: log tipo de token rechazado | `mcp-server/src/auth/session.ts` | 15min | -- |
| A3 | Agregar validacion de `aud` (audience) claim al JWT | `mcp-server/src/auth/session.ts` | 30min | -- |
| A4 | Agregar validacion de `exp` (expirado) explicita con margen de 30s | `mcp-server/src/auth/session.ts` | 15min | -- |
| A5 | Documentar flujo correcto: Frontend -> OAuth 2.1 -> MCP JWT | `mcp-server/README.md` (seccion Auth) | 30min | -- |

### Bloque B: Infraestructura de Tests (3h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| B1 | Instalar vitest + dependencias de test | `mcp-server/package.json` | 15min | G1 |
| B2 | Crear `vitest.config.ts` con aliases y setup | `mcp-server/vitest.config.ts` | 30min | G1 |
| B3 | Agregar script `test`, `test:watch`, `test:coverage` a package.json | `mcp-server/package.json` | 15min | G1 |
| B4 | Crear helpers de mock: `__tests__/helpers/mock-supabase.ts` | `mcp-server/src/__tests__/helpers/` | 1h | -- |
| B5 | Crear helpers de mock: `__tests__/helpers/mock-stripe.ts` | `mcp-server/src/__tests__/helpers/` | 30min | -- |
| B6 | Crear helpers de mock: `__tests__/helpers/mock-redis.ts` | `mcp-server/src/__tests__/helpers/` | 30min | -- |

### Bloque C: Tests de OAuth y JWT (4h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| C1 | Test: JWT MCP valido retorna AuthInfo correcta | `mcp-server/src/__tests__/auth/session.test.ts` | 30min | G1 |
| C2 | Test: JWT expirado es rechazado | `mcp-server/src/__tests__/auth/session.test.ts` | 30min | G1 |
| C3 | Test: JWT sin firma valida es rechazado | `mcp-server/src/__tests__/auth/session.test.ts` | 30min | G1 |
| C4 | Test: JWT revocado (Redis) es rechazado | `mcp-server/src/__tests__/auth/session.test.ts` | 30min | G1 |
| C5 | Test: Token Supabase es RECHAZADO (post-A1) | `mcp-server/src/__tests__/auth/session.test.ts` | 30min | G1, G3 |
| C6 | Test: OAuth authorize flow genera codigo valido | `mcp-server/src/__tests__/auth/oauth.test.ts` | 30min | G1 |
| C7 | Test: OAuth token exchange con PKCE valido | `mcp-server/src/__tests__/auth/oauth.test.ts` | 30min | G1 |
| C8 | Test: OAuth revoke invalida token correctamente | `mcp-server/src/__tests__/auth/oauth.test.ts` | 30min | G1 |

### Bloque D: Tests de Tools (5h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| D1 | Test: `search_products` con query valida retorna resultados | `mcp-server/src/__tests__/tools/search-products.test.ts` | 45min | G1 |
| D2 | Test: `search_products` con SQL injection es sanitizado | `mcp-server/src/__tests__/tools/search-products.test.ts` | 30min | G1 |
| D3 | Test: `get_product_details` por ID y por slug | `mcp-server/src/__tests__/tools/get-product-details.test.ts` | 30min | G1 |
| D4 | Test: `create_checkout` requiere auth y crea sesion Stripe | `mcp-server/src/__tests__/tools/create-checkout.test.ts` | 45min | G1 |
| D5 | Test: `create_checkout` sin auth retorna error | `mcp-server/src/__tests__/tools/create-checkout.test.ts` | 30min | G1 |
| D6 | Test: `update_cart` add/remove/update items | `mcp-server/src/__tests__/tools/update-cart.test.ts` | 45min | G1 |
| D7 | Test: `get_my_profile` retorna datos del usuario autenticado | `mcp-server/src/__tests__/tools/get-my-profile.test.ts` | 30min | G1 |
| D8 | Test: `list_my_orders` filtra por usuario autenticado | `mcp-server/src/__tests__/tools/list-my-orders.test.ts` | 30min | G1 |
| D9 | Test: tool protegido sin auth retorna error apropiado | `mcp-server/src/__tests__/tools/auth-required.test.ts` | 30min | G1 |

### Bloque E: Rate Limiting Per-Tool (3h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| E1 | Definir configuracion de rate limits por tool tier | `mcp-server/src/middleware/rate-limit.ts` | 30min | G4 |
| E2 | Extender `rateLimitMiddleware()` para aceptar `toolName` | `mcp-server/src/middleware/rate-limit.ts` | 1h | G4 |
| E3 | Aplicar rate limit per-tool en `handleMcpPost()` | `mcp-server/src/index.ts` | 30min | G4 |
| E4 | Test: `create_checkout` bloqueado al exceder 5/min | `mcp-server/src/__tests__/middleware/rate-limit.test.ts` | 30min | G4 |
| E5 | Test: `search_products` bloqueado al exceder 30/min | `mcp-server/src/__tests__/middleware/rate-limit.test.ts` | 30min | G4 |

Rate limits per-tool propuestos:

| Tier | Tools | Limite |
|------|-------|--------|
| **Critical** | `create_checkout` | 5/min por usuario |
| **Write** | `update_cart`, `update_my_profile`, `add_to_wishlist`, `remove_from_wishlist` | 20/min por usuario |
| **Read-Auth** | `get_my_profile`, `list_my_orders`, `get_order_status`, `track_shipment`, `get_cart`, `list_wishlist` | 60/min por usuario |
| **Public** | `search_products`, `get_product_details`, `get_store_info`, `get_store_policies`, `list_categories`, `get_product_reviews` | 30/min por IP |

### Bloque F: Session Persistence y Health (3h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| F1 | Guardar metadata de sesion MCP en Redis (auth, timestamps) | `mcp-server/src/lib/session-store.ts` (nuevo) | 1h | G2 |
| F2 | Implementar cleanup de sesiones inactivas (TTL 30min) | `mcp-server/src/lib/session-store.ts` | 30min | G2 |
| F3 | Enriquecer `/health` con metricas de sesiones y uptime | `mcp-server/src/index.ts` | 30min | G8 |
| F4 | Estandarizar error responses con codigos MCP | `mcp-server/src/lib/errors.ts` (nuevo) | 30min | -- |
| F5 | Test: sesion metadata persiste en Redis y expira correctamente | `mcp-server/src/__tests__/lib/session-store.test.ts` | 30min | G2 |

### Bloque G: Error Responses y Observabilidad (2h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| G1 | Crear constantes de error MCP estandarizadas | `mcp-server/src/lib/errors.ts` | 30min | -- |
| G2 | Aplicar error codes consistentes en los 17 tools | `mcp-server/src/tools/*.ts` | 45min | -- |
| G3 | Agregar metricas basicas: tool calls/min, latencia, error rate | `mcp-server/src/lib/metrics.ts` (nuevo) | 30min | G10 |
| G4 | Exponer metricas en `/health` (top 5 tools, p95 latencia) | `mcp-server/src/index.ts` | 15min | G10 |

## 6. Orden de Ejecucion

```
Bloque A (2h) ──→ Bloque C (4h)
      ↓
Bloque B (3h) ──→ Bloque D (5h)
                        ↓
Bloque E (3h) ──→ Bloque F (3h) ──→ Bloque G (2h)
```

- **A debe ir primero**: El fix de JWT es prerequisito de seguridad y del test C5
- **B en paralelo con A**: Infraestructura de tests es independiente del fix JWT
- **C depende de A+B**: Necesita vitest instalado y JWT corregido para test C5
- **D depende de B**: Solo necesita infraestructura de tests (mocks)
- **E puede empezar cuando D termine**: Asi se testea el rate limiting contra los tests de tools
- **F y G al final**: Mejoras incrementales que no bloquean funcionalidad

**Dependencia externa**: Plan 01 tarea D3 (`session.ts:68-92`) es la misma que A1 de este plan. Si Plan 01 se ejecuta primero, A1 ya estara completa.

## 7. Validaciones Tecnicas

| # | Validacion | Criterio de Exito |
|---|-----------|-------------------|
| V1 | JWT Supabase rechazado | Token con `iss: *.supabase.co` sin firma valida -> `null` de `validateJwt()` |
| V2 | JWT MCP valido aceptado | Token firmado con `MCP_JWT_SECRET` + issuer correcto -> `AuthInfo` valida |
| V3 | JWT expirado rechazado | Token con `exp` en el pasado -> `null` |
| V4 | JWT revocado rechazado | Token en Redis blacklist -> `null` |
| V5 | Tests pasan | `npm test` ejecuta exitosamente con >= 30 tests pasando |
| V6 | Cobertura de auth | `session.ts` y `oauth-provider.ts` tienen >= 80% line coverage |
| V7 | Rate limit per-tool funciona | 6 llamadas a `create_checkout` en 1 minuto -> 6ta retorna 429 |
| V8 | Rate limit global funciona | 61 requests sin auth en 1 minuto -> 61va retorna 429 |
| V9 | Session metadata en Redis | `redis-cli KEYS "mcp:session:*"` muestra sesiones activas |
| V10 | Session cleanup funciona | Sesion inactiva 31 minutos -> eliminada de Redis y del `Map` |
| V11 | Health endpoint completo | `GET /health` retorna `tools_count`, `active_sessions`, `uptime_seconds` |
| V12 | Error responses estandarizadas | Tool protegido sin auth -> JSON-RPC error con `code: -32001`, `message: "Authentication required"` |

## 8. Validaciones de Negocio

- Un cliente externo (Claude, ChatGPT) NO puede acceder a datos de usuario sin completar el flujo OAuth 2.1 completo
- Un token Supabase manipulado NO permite impersonar a otro usuario via MCP tools
- Un usuario autenticado NO puede crear mas de 5 sesiones Stripe checkout por minuto (proteccion de costos)
- Un cliente sin autenticar NO puede abusar de `search_products` para hacer scraping masivo (30 req/min max)
- Un restart del servicio NO pierde la informacion de sesiones activas (metadata en Redis)
- El equipo de operaciones PUEDE verificar la salud del servicio via `/health` y `/ready` antes de enrutar trafico

## 9. Metricas de Exito

| Metrica | Antes | Despues |
|---------|-------|---------|
| Tests | 0 | >= 30 (auth + 5 tools + rate limit + sessions) |
| Cobertura auth | 0% | >= 80% |
| JWT bypass vectors | 1 (Supabase fallback) | 0 |
| Rate limit granularidad | 1 tier (global) | 4 tiers (critical/write/read-auth/public) |
| Session persistence | In-memory only | Redis metadata + in-memory transport |
| Health check | Basico (status + tool count) | Completo (uptime, metricas, dependencias) |
| Error codes estandarizados | 0 | 17 tools con error codes MCP |
| Script `test` en package.json | No existe | `vitest run` + `vitest --coverage` |

## 10. Estimacion Total

| Bloque | Horas | Paralelizable |
|--------|-------|---------------|
| A -- Seguridad JWT | 2h | Si (con B) |
| B -- Infraestructura Tests | 3h | Si (con A) |
| C -- Tests OAuth/JWT | 4h | No (depende de A+B) |
| D -- Tests de Tools | 5h | No (depende de B) |
| E -- Rate Limiting Per-Tool | 3h | Parcial (depende de D para tests) |
| F -- Session Persistence | 3h | No (depende de E) |
| G -- Error Responses + Observabilidad | 2h | No (ultimo) |
| **Total** | **22h** | -- |

**Esfuerzo con 2 agentes paralelos**: ~15h elapsed (A+B en paralelo, luego C+D en paralelo, luego E -> F -> G secuencial)

**Ruta critica**: A (2h) -> C (4h) -> E (3h) -> F (3h) -> G (2h) = 14h minimo secuencial

---

*Plan derivado de audit-360/05-mcp-server.md validado. Gaps G1-G10 confirmados contra codigo fuente real 2026-02-23. Archivos clave: `mcp-server/src/auth/session.ts` (107 lineas), `mcp-server/src/index.ts` (973 lineas), `mcp-server/src/middleware/rate-limit.ts` (209 lineas), `mcp-server/package.json`.*
