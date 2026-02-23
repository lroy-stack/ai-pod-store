# Audit 360 — 05: MCP Server

> **Fecha**: 2026-02-23 | **Alcance**: Arquitectura, 17 tools, OAuth 2.1, JWT, rate limiting, integraciones

---

## 1. Estado Actual

### 1.1 Arquitectura del Servidor

**Ubicacion**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/`
**Framework**: Raw Node.js `http.createServer` con MCP SDK `@modelcontextprotocol/sdk` v1.0.4
**Entry point**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/index.ts`
**Puerto**: 8002
**Lenguaje**: TypeScript, compilado a `/mcp-server/dist/`

**Dependencias principales**:
- `@modelcontextprotocol/sdk` v1.0.4 -- SDK de MCP
- `@supabase/supabase-js` -- Cliente Supabase
- `stripe` -- SDK de Stripe
- `ioredis` -- Cliente Redis
- `jose` -- Manejo JWT (firmado, verificacion)
- `zod` -- Validacion de schemas

**Patron de transporte**: Una sesion MCP por `StreamableHTTPServerTransport`:

```
POST /mcp (initialize) → nuevo Transport + McpServer
POST /mcp (con Mcp-Session-Id) → reutiliza Transport existente
DELETE /mcp (con Mcp-Session-Id) → cierra sesion
```

Las sesiones se almacenan en un `Map<string, StreamableHTTPServerTransport>` en memoria.

### 1.2 Estructura de Directorios

```
mcp-server/src/
├── index.ts              — HTTP server + transport-per-session
├── auth/
│   ├── oauth-provider.ts — OAuth 2.1 (615 lineas): authorize, token, revoke, well-known
│   └── session.ts        — JWT validation → AuthInfo (107 lineas)
├── tools/                — 17 tools (cada uno en su archivo)
│   ├── search-products.ts
│   ├── get-product-details.ts
│   ├── get-store-info.ts
│   ├── get-store-policies.ts
│   ├── list-categories.ts
│   ├── get-product-reviews.ts
│   ├── get-my-profile.ts
│   ├── update-my-profile.ts
│   ├── list-my-orders.ts
│   ├── get-order-status.ts
│   ├── track-shipment.ts
│   ├── get-cart.ts
│   ├── update-cart.ts
│   ├── create-checkout.ts
│   ├── list-wishlist.ts
│   ├── add-to-wishlist.ts
│   └── remove-from-wishlist.ts
├── lib/
│   ├── supabase.ts       — Supabase admin client singleton
│   ├── stripe.ts         — Stripe client singleton
│   ├── redis.ts          — ioredis client singleton
│   ├── audit-log.ts      — Logging estructurado con redaccion (108 lineas)
│   ├── logger.ts         — Logger base
│   └── completions.ts    — Autocompletado para tool params
├── middleware/
│   └── rate-limit.ts     — Redis sliding window (209 lineas)
├── resources/
│   └── catalog.ts        — MCP Resource: catalog://products
└── prompts/
    └── shopping-assistant.ts — MCP Prompt template
```

### 1.3 Inventario de Tools (17 Tools)

Todos los 17 tools son implementaciones REALES:

| # | Tool | Auth | Tipo | Archivo | Descripcion |
|---|------|------|------|---------|-------------|
| 1 | `search_products` | PUBLIC | Read | `tools/search-products.ts` | Busqueda por query con ILIKE + sanitizacion SQL |
| 2 | `get_product_details` | PUBLIC | Read | `tools/get-product-details.ts` | Detalles completos de producto por ID/slug |
| 3 | `get_store_info` | PUBLIC | Read | `tools/get-store-info.ts` | Informacion general de la tienda |
| 4 | `get_store_policies` | PUBLIC | Read | `tools/get-store-policies.ts` | Politicas (envio, devolucion, privacidad) |
| 5 | `list_categories` | PUBLIC | Read | `tools/list-categories.ts` | Categorias de productos disponibles |
| 6 | `get_product_reviews` | PUBLIC | Read | `tools/get-product-reviews.ts` | Resenas de un producto |
| 7 | `get_my_profile` | PROTECTED | Read | `tools/get-my-profile.ts` | Perfil del usuario autenticado |
| 8 | `update_my_profile` | PROTECTED | Write | `tools/update-my-profile.ts` | Actualizar nombre, preferencias |
| 9 | `list_my_orders` | PROTECTED | Read | `tools/list-my-orders.ts` | Historial de pedidos |
| 10 | `get_order_status` | PROTECTED | Read | `tools/get-order-status.ts` | Estado de un pedido especifico |
| 11 | `track_shipment` | PROTECTED | Read | `tools/track-shipment.ts` | Tracking de envio |
| 12 | `get_cart` | PROTECTED | Read | `tools/get-cart.ts` | Contenido del carrito |
| 13 | `update_cart` | PROTECTED | Write | `tools/update-cart.ts` | Agregar/quitar items del carrito |
| 14 | `create_checkout` | PROTECTED | Write | `tools/create-checkout.ts` | Crear sesion Stripe checkout |
| 15 | `list_wishlist` | PROTECTED | Read | `tools/list-wishlist.ts` | Lista de deseos |
| 16 | `add_to_wishlist` | PROTECTED | Write | `tools/add-to-wishlist.ts` | Agregar a lista de deseos |
| 17 | `remove_from_wishlist` | PROTECTED | Write | `tools/remove-from-wishlist.ts` | Quitar de lista de deseos |

**Recursos MCP** (2): `catalog://products`, `store://policies`
**Prompts MCP** (1): `shopping_assistant`

**Fuentes de datos**: Todos los tools usan Supabase para datos. `create_checkout` tambien usa Stripe. `search_products` usa PostgreSQL ILIKE con prevencion de inyeccion SQL via `sanitizeForLike()`.

### 1.4 Seguridad

#### OAuth 2.1

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/auth/oauth-provider.ts` (615 lineas)

Implementacion completa de OAuth 2.1 con PKCE:
- **PKCE obligatorio**: Solo S256 (SHA-256), plain no permitido
- **Endpoints**:
  - `/.well-known/oauth-authorization-server` -- metadata
  - `/.well-known/oauth-protected-resource` -- resource metadata
  - `/oauth/authorize` -- flujo de autorizacion con formulario HTML
  - `/oauth/token` -- intercambio de codigo por JWT
  - `/oauth/revoke` -- revocacion de tokens
- **Codigos de autorizacion**: Almacenados en Redis (fallback in-memory), uso unico
- **Revocacion**: Blacklist en Redis con TTL = tiempo hasta expiracion natural
- **XSS prevention**: `escapeHtml()` en formulario de autorizacion
- **Auto-approve**: Disponible para testing (parametro configurable)

#### JWT

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/auth/session.ts` (107 lineas)

- Firmado con HS256 usando `MCP_JWT_SECRET` (variable requerida, falla al arranque si falta)
- Expiracion: 24 horas
- Verificacion de issuer: debe coincidir con `MCP_BASE_URL`
- Revocacion: Redis primero, fallback in-memory
- **RIESGO**: Fallback Supabase JWT (lineas 68-92) -- decodifica sin verificacion de firma para tokens con issuer `*.supabase.co`. Pensado para desarrollo pero peligroso en produccion

#### Rate Limiting

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/middleware/rate-limit.ts` (209 lineas)

- Algoritmo: sliding window (Redis con fallback in-memory)
- Limites:
  - 60 req/min (no autenticado)
  - 120 req/min (autenticado)
- Key: per-IP + per-user
- Respuesta: `429 Too Many Requests` con headers `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **Fail-open** en errores de Redis
- Limpieza in-memory cada 5 minutos

#### Audit Logging

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/mcp-server/src/lib/audit-log.ts` (108 lineas)

- Cada tool call envuelto con `withAuditLog()` decorator
- JSON estructurado a stdout: timestamp, tool, duration_ms, success, user_id, input_sanitized
- Redaccion de campos sensibles: `access_token`, `password`, `api_key`, `secret`, `token`, `authorization`, `bearer`

### 1.5 Puntos de Integracion

| Origen | Destino | Protocolo | Proposito |
|--------|---------|-----------|-----------|
| Frontend (storefront) | MCP Server | HTTP port 8002 | AI chat assistant usa tools como provider |
| MCP Server | Supabase | REST API | Todos los tools consultan datos via admin client |
| MCP Server | Stripe | SDK | `create_checkout` crea sesiones de pago |
| MCP Server | Redis | ioredis | Rate limiting, OAuth tokens, revocacion |
| External AI (Claude, ChatGPT) | MCP Server | MCP Protocol | Tools expuestos para clientes AI externos |

**CORS configurado** para: `claude.ai`, `chatgpt.com`, `localhost:3000`

**Nota importante**: PodClaw NO usa el MCP server. PodClaw tiene sus propios conectores MCP en Python (`podclaw/connectors/`). El MCP server es un servicio separado orientado a clientes/consumidores.

---

## 2. Gaps Detectados

| # | Gap | Detalle | Severidad |
|---|-----|---------|-----------|
| G1 | **Zero tests** | No hay ni un solo archivo de test. Sin jest, vitest, ni script `test` en package.json | CRITICA |
| G2 | **Sesiones MCP en memoria** | `transports` Map se pierde en restart. No hay horizontal scaling posible | ALTA |
| G3 | **Supabase JWT sin verificacion de firma** | `session.ts` lineas 68-92 decodifica tokens Supabase sin verificar firma | CRITICA (seguridad) |
| G4 | **Sin per-tool rate limiting** | Rate limit es global (por IP), no por tool. Un cliente puede hacer 120 `create_checkout` por minuto | ALTA |
| G5 | **Sin caching de respuestas** | Cada `search_products` golpea Supabase directamente. Redis disponible pero no usado para cache | MEDIA |
| G6 | **Fail-open en rate limiting** | Si Redis falla, fallback in-memory funciona pero se pierde entre instancias | MEDIA |
| G7 | **Sin input validation exhaustiva** | Schemas Zod existen pero no todos los tools validan limites de longitud de strings | BAJA |
| G8 | **Sin health check endpoint** | No hay `/health` o `/ready` para load balancers | MEDIA |
| G9 | **Log file local** | `mcp-server.log` escrito localmente, no integrado con sistema centralizado | BAJA |
| G10 | **Sin metricas de uso** | No hay tracking de tools mas usados, latencias, tasa de error | MEDIA |

---

## 3. Riesgos

### 3.1 Riesgos de Seguridad

| Riesgo | Probabilidad | Impacto | Mitigacion Actual |
|--------|-------------|---------|-------------------|
| **Supabase JWT bypass** -- atacante usa token Supabase expirado o manipulado | Media | Critico | Ninguna -- el token se decodifica sin verificacion |
| **Token revocation perdida en restart** | Alta | Medio | Redis como primary, pero in-memory como fallback |
| **Replay attack** con tokens JWT | Baja | Medio | JWT 24h expiry, revocacion disponible |
| **SQL injection via search** | Baja | Alto | `sanitizeForLike()` en search-products |
| **Rate limit bypass** en modo multi-instancia | Media | Medio | Requiere Redis compartido entre instancias |

### 3.2 Riesgos Operativos

| Riesgo | Probabilidad | Impacto |
|--------|-------------|---------|
| **Sesion MCP perdida** por restart del servidor | Alta | Medio -- clientes deben reconectar |
| **Supabase connection exhaustion** por muchas sesiones MCP concurrentes | Media | Alto -- afecta toda la plataforma |
| **Memory leak** por sesiones MCP no cerradas (Map crece indefinidamente) | Media | Alto a largo plazo |

### 3.3 Riesgos a Escala (1000+ tenants)

| Riesgo | Detalle |
|--------|---------|
| **In-memory session store** | Imposible escalar horizontalmente con sesiones en Map |
| **Single Supabase admin client** | Todos los tools comparten un cliente con service key -- sin tenant isolation |
| **Sin connection pooling** | Cada tool call crea consulta independiente a Supabase |
| **CORS hardcoded** | Solo `claude.ai` y `chatgpt.com` -- sin soporte dinamico por tenant |
| **Sin multi-store routing** | Tools asumen una sola tienda -- no hay parametro `store_id` |

---

## 4. Quick Wins

| # | Quick Win | Esfuerzo | Impacto |
|---|-----------|----------|---------|
| QW1 | **Eliminar Supabase JWT fallback** en `session.ts` lineas 68-92. En produccion, solo aceptar MCP-issued JWTs | 15 min | CRITICO -- cierra vulnerabilidad de seguridad |
| QW2 | **Agregar endpoint `/health`** que verifica: Redis, Supabase, Stripe connections | 1h | Alto -- requerido para Docker/k8s |
| QW3 | **Cache Redis para `search_products`** con TTL 30s. `get_store_info` y `list_categories` con TTL 5 min | 2-3h | Alto -- reduce carga Supabase dramaticamente |
| QW4 | **Per-tool rate limits** para `create_checkout` (max 5/min) y `update_cart` (max 30/min) | 2h | Alto -- previene abuso |
| QW5 | **Session cleanup timer** -- eliminar sesiones MCP inactivas despues de 30 min | 1h | Medio -- previene memory leak |
| QW6 | **Agregar script `test` a package.json** con vitest y crear primeros 5 tests para tools publicos | 4-6h | Alto -- primera cobertura |

---

## 5. Refactor Estructural Recomendado

### 5.1 Sesiones MCP en Redis

**Problema**: `transports` Map en memoria impide horizontal scaling y se pierde en restart.

**Solucion**:
```typescript
// Reemplazar Map<string, Transport> con:
// 1. Redis para metadata de sesion (auth, created_at, last_activity)
// 2. Transport local pero reconectable via session resume
// 3. Sticky sessions en load balancer (Caddy upstream hash)
```

Archivos afectados: `src/index.ts`

### 5.2 Capa de Cache con Redis

```
Cliente MCP → Rate Limit → Auth → Cache Layer → Tool Handler → Supabase
                                      ↓
                                   Redis Cache
                                   (TTL por tool)
```

TTLs recomendados:
- `search_products`: 30s (datos cambian frecuentemente)
- `get_product_details`: 60s
- `get_store_info`: 300s (raramente cambia)
- `list_categories`: 300s
- `get_store_policies`: 600s
- Tools protegidos: SIN cache (datos personales)

### 5.3 Seguridad JWT Robusta

1. Eliminar Supabase JWT fallback
2. Implementar JWT refresh tokens (actualmente solo access tokens de 24h)
3. Agregar JWT audience (`aud`) claim para identificar clientes MCP
4. Rotar `MCP_JWT_SECRET` periodicamente con soporte de multiples secrets

### 5.4 Observabilidad

- Metricas por tool: latencia p50/p95/p99, tasa de error, calls/min
- Metricas de sesion: activas, creadas/min, duracion promedio
- Dashboards: integracion con Prometheus + Grafana existente del stack

---

## 6. Roadmap por Fases

### Fase 1: Seguridad y Estabilidad (Semana 1)
- [ ] Eliminar Supabase JWT fallback (`session.ts` lineas 68-92)
- [ ] Agregar health check endpoint (`/health`)
- [ ] Session cleanup timer para sesiones inactivas
- [ ] Primeros tests: 5 tools publicos + OAuth flow

### Fase 2: Performance (Semana 2-3)
- [ ] Redis cache layer para tools de lectura
- [ ] Per-tool rate limiting (especialmente `create_checkout`)
- [ ] Connection pooling para Supabase
- [ ] Metricas basicas (tools usage, latencia)

### Fase 3: Testing Completo (Semana 3-4)
- [ ] Tests para los 17 tools con Supabase/Stripe mockeados
- [ ] Tests para OAuth 2.1 flow completo (authorize, token, revoke)
- [ ] Tests para rate limiting (Redis + fallback)
- [ ] Tests para session management (create, reuse, cleanup)
- [ ] Load testing con artillery o k6

### Fase 4: Resiliencia (Semana 5-6)
- [ ] Session metadata en Redis (no solo in-memory Map)
- [ ] JWT refresh tokens
- [ ] Circuit breaker para Supabase/Stripe calls
- [ ] Graceful degradation cuando Redis no esta disponible

### Fase 5: Multi-Tenant (Semana 7-10)
- [ ] Parametro `store_id` en tools
- [ ] Tenant context derivado de JWT claims
- [ ] CORS dinamico por tenant
- [ ] Supabase RLS enforcement por tenant

---

## 7. Impacto en Escalabilidad

### Capacidad Actual
- **Sesiones concurrentes**: Limitado por memoria del proceso Node.js (estimado: ~10,000 sesiones)
- **Throughput**: Limitado por Supabase (sin cache), estimado ~100 req/s
- **Horizontal scaling**: NO posible (sesiones en memoria)
- **Tools**: 17, todos funcionales, 6 publicos + 11 protegidos

### Limitantes para Escala

1. **In-memory sessions**: Sesiones MCP en `Map` -- un solo proceso
2. **Sin cache**: Cada request golpea Supabase -- cuello de botella
3. **Single admin client**: Un Supabase client con service key para todo
4. **Rate limit in-memory fallback**: No compartido entre instancias

### Trayectoria Recomendada

| Escala | Arquitectura |
|--------|-------------|
| 1 tienda, <100 usuarios | Estado actual es suficiente |
| 1 tienda, 100-1000 usuarios | Agregar Redis cache + per-tool rate limits |
| 1 tienda, 1000+ usuarios | Redis sessions + horizontal scaling (2-3 instancias con sticky sessions) |
| Multi-tenant | Rediseno completo: tenant context, RLS, CORS dinamico |

**Conclusion**: El MCP server es una implementacion funcional y bien estructurada con OAuth 2.1 completo, 17 tools reales, rate limiting, y audit logging. Los gaps criticos son: zero tests, Supabase JWT sin verificacion de firma, y sesiones en memoria. Los quick wins (eliminar JWT fallback, agregar cache Redis, agregar tests) mejorarian significativamente la postura de seguridad y rendimiento con esfuerzo modesto.
