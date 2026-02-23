# Plan 01 — Seguridad & Autenticación

**Prioridad**: P0 — BLOQUEANTE
**Estimación**: 40-50h
**Dependencias**: Ninguna (primer dominio a resolver)
**Bloquea**: Todos los demás dominios

---

## 1. Objetivo

Cerrar todos los vectores de acceso no autorizado. Hacer que la plataforma sea segura para manejar datos reales de clientes (PII, pagos, diseños).

## 2. Estado Actual (Validado)

| Área | Score | Evidencia |
|------|-------|-----------|
| Admin Auth | 2/10 | Cookie JSON sin firma, falsificable trivialmente |
| Admin Middleware | 0/10 | `middleware.ts:7` excluye TODAS las rutas `/api/*` |
| Admin APIs | 1/10 | 66/69 routes sin `requireAuth()` |
| Setup-RBAC | 0/10 | Endpoint público crea cuentas admin |
| DB RLS | 3/10 | 25+ tablas sin RLS, `USING(true)` en messaging |
| Auth Sync | 2/10 | `public.users` no vinculado a `auth.users`, sin trigger |
| Telegram Secret | 2/10 | Fallback hardcoded `default_secret_change_in_production` |
| MCP JWT | 3/10 | Decode sin verificar firma en `session.ts:68-92` |
| CSRF | 0/10 | Sin protección CSRF en ninguna mutation |
| Input Validation | 1/10 | Sin Zod/yup en API routes del admin |
| Printify HMAC | 5/10 | `===` en vez de `timingSafeEqual()` |
| WhatsApp Webhook | 3/10 | Verificación condicional, bypass si falta env var |
| Theme CSS Injection | 4/10 | `dangerouslySetInnerHTML` con valores de DB sin sanitizar |
| Rate Limiting Admin | 0/10 | Sin rate limiter en login admin |

### Cadena de ataque actual (3 pasos para control total):
1. `POST /api/admin/setup-rbac` → Crear cuenta admin
2. Forjar cookie `admin-session={"role":"admin","email":"..."}`
3. Acceder a los 66 endpoints sin auth → PII, finanzas, agentes

## 3. Gap Estructural

El admin panel fue construido como herramienta interna sin considerar que un atacante pudiera alcanzarlo. La decisión de excluir `/api/*` del middleware fue intencional (para simplificar desarrollo) pero crea una superficie de ataque masiva. El sistema de auth dual (Supabase para frontend, bcrypt custom para admin) no está reconciliado, y el database no tiene la capa de defensa en profundidad que RLS proporciona.

## 4. Decisión Arquitectónica

### Auth Admin: `iron-session` + TOTP (NO migrar a Supabase Auth)

**Justificación**:
- Migrar admin a Supabase Auth requiere cambiar el modelo de datos de admin_users, RBAC completo, OAuth flows — ~80h adicionales
- `iron-session` resuelve el problema de cookies firmadas en 4h
- TOTP para MFA es independiente y se puede añadir después
- El admin es una app interna con <10 usuarios — no necesita la complejidad de Supabase Auth

### RLS: Habilitar en TODAS las tablas + policies por role

**Justificación**:
- Defensa en profundidad — incluso si una API tiene un bug, RLS protege los datos
- Supabase anon key es pública por diseño — RLS es la única barrera real
- Las policies deben ser `auth.uid() = user_id` para tablas de usuario, `auth.role() = 'service_role'` para tablas internas

### Input Validation: Zod en todas las API routes

**Justificación**:
- Previene injection, type confusion, y data corruption
- Zod es ya dependencia del frontend (via AI SDK) — sin overhead adicional
- Schemas reutilizables entre frontend forms y API validation

## 5. Plan de Implementación

### Bloque A: Parches Críticos Inmediatos (8h)

| # | Tarea | Archivo(s) | Esfuerzo | Cierra |
|---|-------|-----------|----------|--------|
| A1 | Eliminar endpoint `setup-rbac` | `admin/src/app/api/admin/setup-rbac/route.ts` | 15min | C-03 |
| A2 | Eliminar fallback secret Telegram | `frontend/src/app/api/webhooks/telegram/route.ts:32` | 15min | C-06 |
| A3 | Fix middleware: proteger `/api/*` | `admin/src/middleware.ts:7-8` | 30min | C-02 |
| A4 | Instalar `iron-session`, firmar cookie admin | `admin/src/app/api/auth/login/route.ts`, nuevo `admin/src/lib/session.ts` | 4h | C-01 |
| A5 | Actualizar `getAdminSession()` para verificar firma | `admin/src/lib/rbac.ts:24-52` | 1h | C-01 |
| A6 | Añadir rate limiter a login admin | `admin/src/app/api/auth/login/route.ts` | 1h | M-02 |
| A7 | Aumentar password mínimo a 12 chars | `admin/src/app/api/auth/login/route.ts` | 30min | — |

### Bloque B: Protección de APIs Admin (6h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| B1 | Crear wrapper `withAuth()` genérico | `admin/src/lib/auth-middleware.ts` | 1h |
| B2 | Aplicar `withAuth()` a 66 API routes | `admin/src/app/api/**/*.ts` | 3h |
| B3 | Crear `withValidation(schema)` wrapper con Zod | `admin/src/lib/validation.ts` | 1h |
| B4 | Schemas Zod para top 10 mutations (products, orders, designs) | `admin/src/lib/schemas/` | 1h |

### Bloque C: RLS y Database Security (12h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| C1 | Crear trigger `handle_new_user()` que sincronice `auth.users` → `public.users` | Nueva migración | 2h |
| C2 | ALTER TABLE `public.users` ADD CONSTRAINT fk_auth REFERENCES `auth.users(id)` | Nueva migración | 1h |
| C3 | ENABLE RLS en 25+ tablas sin RLS | Nueva migración | 2h |
| C4 | Crear policies para tablas de usuario: orders, designs, cart_items, wishlists, shipping_addresses, notifications | Nueva migración | 3h |
| C5 | Fix messaging: reemplazar `USING(true)` por policies reales | Nueva migración | 2h |
| C6 | Policies para tablas internas: agent_events, agent_sessions → solo `service_role` | Nueva migración | 1h |
| C7 | Policies para newsletter_subscribers (PII) | Nueva migración | 1h |

### Bloque D: Webhooks y Integraciones (4h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| D1 | Printify: `timingSafeEqual()` para HMAC | `frontend/src/app/api/webhooks/printify/route.ts:30` | 30min |
| D2 | WhatsApp: hacer verificación obligatoria (no condicional) | `frontend/src/app/api/webhooks/whatsapp/route.ts:73-84` | 30min |
| D3 | MCP: eliminar JWT decode sin firma | `mcp-server/src/auth/session.ts:68-92` | 1h |
| D4 | Theme: sanitizar CSS variables antes de inyectar | `frontend/src/lib/theme-server.ts:91-116` | 1h |
| D5 | Frontend admin APIs: añadir auth check a `/api/admin/orders` y `/api/admin/alert` | `frontend/src/app/api/admin/**/*.ts` | 1h |

### Bloque E: CSRF y Headers (4h)

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| E1 | Implementar CSRF token en admin (double-submit cookie) | `admin/src/lib/csrf.ts`, `admin/src/middleware.ts` | 2h |
| E2 | Añadir CSP header a Caddy | `deploy/Caddyfile` | 1h |
| E3 | Revisar y endurecer CORS en admin API routes | `admin/src/middleware.ts` | 1h |

### Bloque F: MFA Admin (6h) — Post-estabilización

| # | Tarea | Archivo(s) | Esfuerzo |
|---|-------|-----------|----------|
| F1 | Instalar `otplib` para TOTP | `admin/package.json` | 15min |
| F2 | Tabla `admin_totp_secrets` en Supabase | Nueva migración | 30min |
| F3 | API: setup TOTP (generar secret, QR code) | `admin/src/app/api/auth/totp/setup/route.ts` | 2h |
| F4 | API: verify TOTP en login flow | `admin/src/app/api/auth/totp/verify/route.ts` | 1.5h |
| F5 | UI: pantalla de setup TOTP + verificación en login | `admin/src/app/login/page.tsx`, nuevo componente | 1.5h |
| F6 | Enforcement: requerir TOTP para super_admin | `admin/src/lib/rbac.ts` | 30min |

## 6. Orden de Ejecución

```
Bloque A (8h) ──→ Bloque B (6h) ──→ Bloque E (4h)
                                         ↓
Bloque C (12h) ─────────────────→ Bloque D (4h) ──→ Bloque F (6h)
```

- A y C pueden ejecutarse en paralelo (no tienen dependencias cruzadas)
- B depende de A (necesita iron-session para el wrapper withAuth)
- D depende de C parcialmente (las policies de messaging son prerequisito)
- E y F van al final (requieren que auth esté estabilizado)

## 7. Validaciones Técnicas

| # | Validación | Criterio de Éxito |
|---|-----------|-------------------|
| V1 | Cookie admin firmada | `JSON.parse(cookie)` debe FALLAR — cookie es opaca |
| V2 | Middleware protege APIs | `curl -X GET localhost:3001/api/products` → 401 |
| V3 | setup-rbac eliminado | `curl -X POST localhost:3001/api/admin/setup-rbac` → 404 |
| V4 | RLS activo | `SELECT * FROM products` con anon key → solo rows permitidas |
| V5 | handle_new_user funciona | Registro en frontend → row aparece en `public.users` con mismo UUID |
| V6 | Messaging protegido | `SELECT * FROM telegram_messages` con anon key → 0 rows |
| V7 | Rate limit funciona | 11 intentos de login → HTTP 429 |
| V8 | CSRF activo | POST sin CSRF token → 403 |
| V9 | Printify HMAC | Request con firma incorrecta → 401 (sin timing leak) |
| V10 | MCP JWT | Token sin firma válida → 401 |

## 8. Validaciones de Negocio

- Un atacante externo NO puede acceder a ninguna API admin sin credenciales válidas
- Un usuario autenticado solo ve SUS datos (orders, designs, messages)
- Un admin con password comprometido NO puede acceder sin TOTP (post-F)
- Webhooks solo aceptan requests de Stripe/Printify/Telegram verificados

## 9. Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| APIs admin protegidas | 3/69 (4%) | 69/69 (100%) |
| Tablas con RLS | ~40/64 (62%) | 64/64 (100%) |
| Admin auth score | 2/10 | 8/10 |
| Vectores de escalación | 3 (setup-rbac, cookie, middleware) | 0 |
| OWASP Top 10 cubiertos | 4/10 | 8/10 |

## 10. Estimación Total

| Bloque | Horas | Paralelizable |
|--------|-------|---------------|
| A — Parches Críticos | 8h | Sí (con C) |
| B — APIs Admin | 6h | No (depende de A) |
| C — RLS Database | 12h | Sí (con A) |
| D — Webhooks | 4h | Parcial |
| E — CSRF/Headers | 4h | No |
| F — MFA | 6h | No |
| **Total** | **40h** | — |

**Esfuerzo con 2 agentes paralelos**: ~25h elapsed (A+C en paralelo, luego B+D, luego E+F)

---

*Plan derivado de audit-360 validado. Hallazgos C-01 a C-07 confirmados contra código fuente real 2026-02-23.*
