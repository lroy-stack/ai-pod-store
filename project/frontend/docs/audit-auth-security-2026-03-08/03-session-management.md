# Session Management Analysis — 2026-03-08

## Resumen Ejecutivo

El sistema de session management usa un modelo **custom cookie-based** sobre Supabase Auth. Los tokens JWT (access + refresh) se almacenan en cookies httpOnly gestionadas manualmente por las API routes (login, logout, session). NO se usa `@supabase/ssr` para gestionar cookies automaticamente en login/logout — solo en el middleware para validacion de rutas protegidas. El refresh token flow existe y funciona correctamente en `/api/auth/session`. Cross-tab sync esta implementado via localStorage events.

**Hallazgos criticos:**
1. Login route usa env vars incorrectas (`SUPABASE_URL` / `SUPABASE_ANON_KEY` sin prefijo `NEXT_PUBLIC_`) — funciona en server-side pero es inconsistente con la documentacion del proyecto.
2. OAuth callback usa `getSession()` (deprecated/insecure) en lugar de `getUser()` para verificar autenticacion.
3. OAuth callback NO establece cookies httpOnly `sb-access-token`/`sb-refresh-token` — la sesion OAuth queda en el client-side Supabase SDK (localStorage) sin proteccion httpOnly.
4. No hay `onAuthStateChange` listener — no se detectan cambios de sesion en tiempo real.
5. El "Remember Me" checkbox almacena `data.session` en localStorage, pero el login response NO incluye `session` en el body (lo elimino intencionalmente), asi que el `rememberMe` path es dead code.

---

## 1. Login Flow

### 1.1 API Route (`src/app/api/auth/login/route.ts`)

**Metodo:** POST

**Flujo:**
1. Rate limiting via `authLimiter.check(ip)` (IP-based)
2. Turnstile CAPTCHA verification (graceful skip si `TURNSTILE_SECRET_KEY` no configurado)
3. Validacion de campos (email format regex, password presence)
4. Crea Supabase client con `createClient(supabaseUrl, supabaseAnonKey)` — cliente efimero server-side
5. `signInWithPassword({ email, password })` contra Supabase Auth
6. Fetch `users.locale` y `users.deletion_requested_at` de la DB
7. Establece cookies httpOnly con access_token y refresh_token
8. Retorna user data (id, email, name, locale, deletion_requested_at) + expires_at

**Supabase client usado:** `@supabase/supabase-js` directo (NO `@supabase/ssr`), con `autoRefreshToken: true` y `persistSession: true` (ambos innecesarios en server-side ya que el client se descarta inmediatamente).

**Env vars:**
```
SUPABASE_URL (sin NEXT_PUBLIC_ prefix) — linea 6
SUPABASE_ANON_KEY (sin NEXT_PUBLIC_ prefix) — linea 7
```
Estas NO son las vars `NEXT_PUBLIC_*`. En server-side API routes funcionan correctamente, pero la naming convention es inconsistente. El `.env.local` probablemente tiene ambas variantes. **Riesgo:** si solo existen las `NEXT_PUBLIC_*` vars en el entorno, el login route falla silenciosamente con `undefined!` como URL.

### 1.2 Cookies establecidas

| Cookie | Valor | httpOnly | Secure | SameSite | MaxAge | Path |
|---|---|---|---|---|---|---|
| `sb-access-token` | JWT access token | `true` | `true` (solo prod) | `lax` | `expires_in` (~3600s) | `/` |
| `sb-refresh-token` | Refresh token | `true` | `true` (solo prod) | `lax` | 604800 (7 dias) | `/` |

**Notas:**
- `Secure: false` en development — permite HTTP en localhost (correcto)
- `SameSite: lax` — permite navegacion top-level cross-site (correcto para redirects OAuth)
- Access token MaxAge se toma de `session.expires_in` con fallback a 3600s
- NO hay `Domain` attribute — cookie es valida solo para el dominio exacto (correcto)

### 1.3 Client-side post-login (`src/components/auth/LoginForm.tsx`)

1. Fetch POST `/api/auth/login` con email, password, turnstileToken
2. Si `rememberMe` y `data.session` existe: `localStorage.setItem('sb-session', JSON.stringify(data.session))` — **DEAD CODE** porque el response body NO incluye `session` (fue eliminado intencionalmente por seguridad, linea 96-110 del login route)
3. Broadcast login event via `localStorage.setItem('pod-auth-sync', ...)` para cross-tab sync
4. POST `/api/cart/merge` — merge anonymous cart
5. POST `/api/session/migrate` — migra fingerprint y conversation ID al usuario autenticado
6. Redirect a `/${userLocale}/`

**Social login (OAuth):**
- Usa `supabase.auth.signInWithOAuth({ provider, redirectTo })` del client-side Supabase SDK
- Provider: Google o Apple
- `redirectTo`: `${window.location.origin}/${locale}/auth/callback`
- El SDK redirige al consent screen del provider, luego de vuelta al callback

---

## 2. Logout Flow

### 2.1 API Route (`src/app/api/auth/logout/route.ts`)

**Metodo:** POST

**Flujo:**
1. Lee `sb-access-token` de cookies
2. Si existe token: crea Supabase client con el token en header Authorization, llama `supabase.auth.signOut()` — **invalida el token en Supabase Auth** (revoca la sesion server-side)
3. Si signOut falla, continua igualmente (best-effort)
4. Limpia ambas cookies (`sb-access-token`, `sb-refresh-token`) con `maxAge: 0`
5. En caso de excepcion catch-all: tambien limpia cookies con `response.cookies.delete()`

**Env vars:** `SUPABASE_URL` + `SUPABASE_ANON_KEY` (misma inconsistencia que login)

### 2.2 Cookie cleanup

Las dos cookies de sesion se limpian correctamente:
- `sb-access-token`: value='', maxAge=0, mismos flags httpOnly/secure/sameSite/path
- `sb-refresh-token`: value='', maxAge=0, mismos flags

**Completitud:** SI limpia todas las cookies de sesion propias. NO limpia cookies de Supabase SDK nativas (e.g., `sb-<project-ref>-auth-token`) — estas solo existirian si el OAuth flow las creo via el client-side SDK.

### 2.3 Client-side cleanup

**LogoutButton.tsx (`src/components/auth/LogoutButton.tsx`):**
1. POST `/api/auth/logout`
2. `localStorage.removeItem('sb-session')` — limpia el rememberMe storage (dead code counterpart)
3. Redirect a `/${locale}/auth/login`

**useAuth.ts logout function (`src/hooks/useAuth.ts`):**
1. POST `/api/auth/logout` con `credentials: 'include'`
2. Actualiza state local (user=null, authenticated=false)
3. Broadcast logout event via `localStorage.setItem('pod-auth-sync', ...)` para cross-tab sync

**Nota:** Hay DOS paths de logout — `LogoutButton` y `useAuth().logout()`. `LogoutButton` NO usa `useAuth()`, asi que no broadcast el evento cross-tab. Si se usa `LogoutButton`, otras pestanas no se enteran inmediatamente del logout (solo al proximo `checkSession` cada 5 min).

---

## 3. Middleware Auth Guard (`src/middleware.ts`)

### 3.1 Protected routes

```typescript
const protectedRoutes = ['/profile', '/orders', '/wishlist']
```

Rutas que permiten guest access (NO protegidas): `/cart`, `/checkout`, `/shop`, `/chat`

El matching usa regex para accounting de locale prefix:
```typescript
pathname.match(new RegExp(`^/[a-z]{2}${route}(/|$)`))
```

### 3.2 JWT validation

**Metodo:** `supabase.auth.getUser()` via `@supabase/ssr` `createServerClient`

**Flujo para rutas protegidas:**
1. Crea `createServerClient` de `@supabase/ssr` con cookie adapter (getAll/setAll)
2. Llama `supabase.auth.getUser()` — **valida JWT contra Supabase Auth server** (NO solo presencia de cookie, NO solo decode local)
3. Si user es null o hay error: redirect a `/${locale}/auth/login?returnUrl=${pathname}`
4. Si user valido: agrega `x-user-id` header al response

**Env vars en middleware:** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (correcto para Edge runtime)

**Token refresh en middleware:** El `@supabase/ssr` `createServerClient` con cookie adapter puede hacer refresh automatico si el access token expiro. El `setAll` callback actualiza las cookies en el response. Sin embargo, el middleware solo invoca `getUser()`, que NO triggerea refresh automatico — solo valida el access token actual.

### 3.3 Redirect flow

- Redirect destino: `/${locale}/auth/login`
- `returnUrl` query param preserva la ruta original para redirect post-login
- El `LoginForm.tsx` NO usa `returnUrl` para redirect post-login — siempre va a `/${userLocale}/` (el returnUrl se ignora)

**Hallazgo:** El `returnUrl` se establece en el middleware redirect pero NUNCA se consume en el LoginForm. El usuario siempre termina en la homepage despues del login, no en la pagina que intento visitar.

### 3.4 Funcionalidad adicional del middleware

- **CSRF protection:** Double-submit cookie pattern (`csrf-token` cookie + `x-csrf-token` header). Aplica a POST/PUT/PATCH/DELETE en `/api/*` (excepto webhooks, admin, cron).
- **Tenant resolution:** Custom domain -> tenant_id via `/api/tenant-resolve` con cache en cookie (5 min TTL)
- **A/B testing:** Deterministic variant assignment via visitor ID cookie + hash
- **Matcher:** `['/', '/api/:path*', '/(de|en|es)/:path*', '/((?!_next|_vercel|.*\\..*).*)']`

---

## 4. Supabase Clients

| Client | Archivo | Env vars | RLS | Uso |
|---|---|---|---|---|
| Anon (browser) | `src/lib/supabase.ts` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Respetada | Client-side: OAuth flow, getSession en callback. Lazy singleton via Proxy. `persistSession: true`, `autoRefreshToken: true` |
| Server (user auth) | `src/lib/supabase-server.ts` `createServerClient()` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Respetada | API routes autenticadas. Extrae JWT de `Authorization` header. Tambien exporta `createAdminClient()` |
| Admin (service role) | `src/lib/supabase-admin.ts` | `SUPABASE_URL` (fallback `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_KEY` | **Bypassed** | Operaciones admin, cron jobs, sync. Lazy singleton via Proxy |
| Auth guard | `src/lib/auth-guard.ts` | `SUPABASE_URL` (fallback `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_KEY` | **Bypassed** | `getAuthUser()`, `requireAuth()`, `requireAdmin()`. Lee token de cookie `sb-access-token`, valida con `getUser(token)`, fetch tier/role de DB |
| Login route | `src/app/api/auth/login/route.ts` | `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Respetada | Efimero per-request. `signInWithPassword()` |
| Session route | `src/app/api/auth/session/route.ts` | `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (verify), `SUPABASE_ANON_KEY` (refresh) | Bypassed (verify) / Respetada (refresh) | `getUser(accessToken)` con service key, `refreshSession()` con anon key |
| Middleware | `src/middleware.ts` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Respetada | `@supabase/ssr` createServerClient, `getUser()` para validar JWT |

**Inconsistencia de env vars:** Las API routes de auth (login, logout, session) usan `SUPABASE_URL` y `SUPABASE_ANON_KEY` (sin `NEXT_PUBLIC_`), mientras que el middleware y el client-side usan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Si estas vars apuntan a diferentes URLs/keys, el sistema se rompe silenciosamente.

---

## 5. OAuth Callback Flow (`src/app/[locale]/(focused)/auth/callback/page.tsx`)

**Tipo:** Client component (`'use client'`)

**Flujo:**
1. `supabase.auth.getSession()` — el client-side SDK automaticamente intercambia el OAuth code por tokens usando el hash fragment de la URL
2. Si session existe: migra datos anonimos (fingerprint, conversation ID) via POST `/api/session/migrate`
3. Redirect a `/${locale}/`
4. Si no hay session o error: muestra error, redirect a login en 3s

**Problemas criticos:**

1. **Usa `getSession()` en lugar de `getUser()`**: `getSession()` lee de localStorage/memoria local y NO valida el JWT contra el servidor Supabase. Un token modificado localmente pasaria la validacion. Supabase recomienda usar `getUser()` para verificar autenticidad.

2. **NO establece cookies httpOnly**: El OAuth flow usa el client-side Supabase SDK que almacena tokens en localStorage (via `persistSession: true` en `src/lib/supabase.ts`). Las cookies `sb-access-token` y `sb-refresh-token` httpOnly que usa el resto del sistema (login, session, middleware, auth-guard) **NUNCA se establecen** en el OAuth flow. Esto significa que:
   - Despues de OAuth login, `useAuth().checkSession()` llama `/api/auth/session` que busca `sb-access-token` cookie — **no la encuentra** — devuelve `authenticated: false`
   - El middleware en rutas protegidas busca cookies via `@supabase/ssr` — podria encontrar las cookies nativas de Supabase (`sb-<ref>-auth-token`) si el SDK las establece, pero la sesion NO esta en las custom cookies
   - **El OAuth login probablemente esta roto** para cualquier funcionalidad que dependa de las custom cookies httpOnly

3. **No limpia localStorage en error**: Si el OAuth falla, los tokens parciales quedan en localStorage

---

## 6. Token Refresh Mechanism

### 6.1 Session endpoint (`/api/auth/session`)

El refresh token flow esta implementado correctamente en `src/app/api/auth/session/route.ts`:

1. Lee `sb-access-token` y `sb-refresh-token` de cookies
2. Valida access token con `supabase.auth.getUser(accessToken)` usando service key
3. Si access token invalido/expirado Y refresh token existe:
   - Crea nuevo client con anon key
   - `supabase.auth.refreshSession({ refresh_token: refreshToken })`
   - Si refresh exitoso: actualiza ambas cookies con nuevos tokens
   - Si refresh falla: limpia ambas cookies
4. Si no hay refresh token: limpia cookies

### 6.2 Periodic check

`useAuth()` hook ejecuta `checkSession()` cada 5 minutos via `setInterval`. Cada check llama `/api/auth/session` que automaticamente renueva tokens expirados.

### 6.3 Middleware refresh

El middleware **NO hace refresh**. Solo valida con `getUser()`. Si el access token expiro y el middleware se ejecuta antes del proximo `checkSession()`, el usuario es redirigido a login innecesariamente. Sin embargo, `@supabase/ssr` con el cookie adapter podria intentar refresh interno — depende de la implementacion de la libreria.

### 6.4 Timeline de tokens

| Token | MaxAge | Renovacion |
|---|---|---|
| Access token | ~3600s (1 hora) | Via `/api/auth/session` refresh flow |
| Refresh token | 604800s (7 dias) | Se emite nuevo refresh token en cada refresh |
| CSRF token | 28800s (8 horas) | Se regenera en middleware si no existe |

---

## 7. Security Assessment

| Aspecto | Estado | Notas |
|---|---|---|
| httpOnly cookies | PARCIAL | Login flow: SI. OAuth flow: NO (tokens en localStorage) |
| Secure flag | PARCIAL | Solo en `NODE_ENV === 'production'`. En dev es false (aceptable) |
| SameSite attribute | OK | `lax` en session cookies, `strict` en CSRF cookie |
| Session fixation | OK | Supabase Auth genera nuevos tokens en cada `signInWithPassword()`. No hay session ID reutilizado |
| CSRF protection | OK | Double-submit cookie pattern implementado en middleware. Aplica a mutaciones API |
| Logout cleanup (server) | OK | `supabase.auth.signOut()` invalida token en Supabase. Cookies limpiadas con maxAge=0 |
| Logout cleanup (client) | PARCIAL | `LogoutButton` limpia `sb-session` localStorage pero NO broadcast cross-tab event |
| Token refresh | OK | Implementado en `/api/auth/session` con refresh token. Periodic check cada 5 min |
| Cross-tab sync | OK | Via localStorage `pod-auth-sync` events. Login, logout y session-check se broadcast |
| JWT validation | OK | Middleware usa `getUser()` (server-side validation), no solo decode local |
| OAuth session cookies | CRITICO | OAuth callback NO establece httpOnly cookies. Sesion OAuth probablemente rota para APIs que dependen de cookies |
| returnUrl consumed | NO | Middleware establece returnUrl pero LoginForm lo ignora — siempre redirect a homepage |
| Rate limiting | OK | `authLimiter` en login route (IP-based) |
| CAPTCHA | OK | Turnstile integration con graceful skip si no configurado |
| Env var consistency | WARN | Auth routes usan `SUPABASE_URL`/`SUPABASE_ANON_KEY`, middleware usa `NEXT_PUBLIC_*` variants |
| Token in response body | OK | Access/refresh tokens NO se devuelven en response body (solo en httpOnly cookies) |
| `getSession()` vs `getUser()` | CRITICO | OAuth callback usa `getSession()` que no valida JWT server-side |
| `onAuthStateChange` | AUSENTE | No hay listener de cambios de estado de auth. Cambios de email, password reset, token revocation no se detectan en tiempo real |
| Dual logout paths | WARN | `LogoutButton` y `useAuth().logout()` son paths independientes con diferente comportamiento cross-tab |

---

## 8. Recomendaciones

### Criticas (P0)

1. **Arreglar OAuth callback session cookies**: El callback page debe llamar a un API route server-side que establezca las cookies httpOnly `sb-access-token` y `sb-refresh-token` despues de verificar la sesion OAuth. Sin esto, los usuarios que hacen login via Google/Apple no tienen sesion funcional para API routes autenticadas.

2. **Reemplazar `getSession()` por `getUser()` en OAuth callback**: `getSession()` no valida el JWT contra el servidor. Cambiar a `getUser()` o, mejor, mover la verificacion a un API route server-side.

3. **Unificar env vars**: Decidir entre `SUPABASE_URL`/`SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` para API routes server-side. Documentar la convencion. Agregar validacion de startup que verifique que todas las vars necesarias existen.

### Altas (P1)

4. **Consumir returnUrl post-login**: El `LoginForm` debe leer `searchParams.get('returnUrl')` y redirigir alli despues del login exitoso, en lugar de siempre ir a homepage.

5. **Unificar logout paths**: `LogoutButton` deberia usar `useAuth().logout()` en lugar de implementar su propio flujo, para asegurar cross-tab sync en todos los casos.

6. **Agregar `onAuthStateChange` listener**: Registrar listener en el client-side Supabase SDK para detectar cambios de sesion en tiempo real (email change confirmation, password reset, token revocation).

7. **Refresh en middleware**: Considerar hacer refresh de tokens expirados en el middleware (via `@supabase/ssr` session handling) para evitar redirects innecesarios a login cuando el access token expiro pero el refresh token es valido.

### Medias (P2)

8. **Eliminar dead code de rememberMe**: El path `localStorage.setItem('sb-session', ...)` en LoginForm nunca se ejecuta porque el response no incluye `session`. Eliminar o reimplementar si la feature es deseada.

9. **Limpiar cookies OAuth nativas**: En logout, considerar limpiar tambien las cookies nativas de Supabase (`sb-<project-ref>-auth-token`) que el client-side SDK podria haber creado durante OAuth flow.

10. **CSRF cookie name**: Cambiar `csrf-token` a `__Host-csrf-token` para aprovechar el prefijo `__Host-` que el propio comentario del codigo menciona como intencion (linea 66-73 de csrf.ts) pero no implementa.

---

## Archivos Analizados

| Archivo | Proposito |
|---|---|
| `src/app/api/auth/login/route.ts` | Login endpoint (email/password) |
| `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/session/route.ts` | Session check + token refresh |
| `src/middleware.ts` | Auth guard, CSRF, tenant resolution, A/B testing |
| `src/lib/supabase.ts` | Client-side Supabase client (anon) |
| `src/lib/supabase-server.ts` | Server-side Supabase client (user auth + admin) |
| `src/lib/supabase-admin.ts` | Admin Supabase client (service role) |
| `src/lib/auth-guard.ts` | Centralized auth/authorization for API routes |
| `src/lib/csrf.ts` | CSRF token generation and validation |
| `src/hooks/useAuth.ts` | Client-side auth state management + cross-tab sync |
| `src/components/auth/LoginForm.tsx` | Login form UI + OAuth social login |
| `src/components/auth/LogoutButton.tsx` | Logout button UI |
| `src/app/[locale]/(focused)/auth/callback/page.tsx` | OAuth callback handler |
