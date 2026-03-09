# Cloudflare Turnstile & Anti-bot Analysis — 2026-03-08

## Resumen Ejecutivo

La aplicacion implementa **dos sistemas CAPTCHA separados** que no estan integrados entre si:

1. **Cloudflare Turnstile** — Protege login y registro. Implementacion correcta con graceful degradation en desarrollo. Actualmente configurado con **test keys** en `.env.local` (siempre pasa).
2. **hCaptcha (CaptchaChallenge)** — Componente definido pero **nunca importado ni utilizado** en ningun flujo. Codigo muerto.

**Cobertura critica**: Solo 2 de 6+ formularios publicos tienen proteccion Turnstile. Los formularios de forgot-password, reset-password, contacto y newsletter **no tienen ningun CAPTCHA**, aunque algunos tienen rate limiting como mitigacion parcial.

---

## 1. Server-side Verification (`src/lib/turnstile.ts`)

### `verifyTurnstileToken(token, remoteIp?): Promise<boolean>`

- Verifica tokens contra `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- Envia `secret` + `response` + `remoteip` (opcional) como `application/x-www-form-urlencoded`
- **Graceful degradation**: Si `TURNSTILE_SECRET_KEY` no esta configurado, retorna `true` (skip silencioso con warning en consola)
- Si la key SI esta configurada pero no hay token, retorna `false` (rechaza)
- Errores de red/API tambien retornan `false` (fail-closed cuando la key existe)

### `requireValidTurnstileToken(token, remoteIp?): Promise<void>`

- Wrapper que lanza `Error('CAPTCHA token required')` si no hay token
- Lanza `Error('CAPTCHA verification failed')` si verificacion falla
- **Problema**: NO tiene graceful degradation. Si `TURNSTILE_SECRET_KEY` no esta, `verifyTurnstileToken` retorna `true`, pero si el token es `null/undefined`, lanza error antes de llegar a la verificacion
- **Ningun endpoint usa esta funcion actualmente** — todos usan `verifyTurnstileToken` directamente

### Observaciones de seguridad

- **Positivo**: Pasa `remoteIp` a Cloudflare para validacion adicional (IP binding)
- **Riesgo**: La degradation silenciosa significa que si alguien olvida configurar la key en produccion, Turnstile queda completamente desactivado sin alarma visible

---

## 2. Client Widget (`src/components/auth/TurnstileWidget.tsx`)

### Carga del script

- Carga `https://challenges.cloudflare.com/turnstile/v0/api.js` de forma asincrona y deferred
- Patron singleton: `turnstileScriptPromise` evita cargas duplicadas
- Si el script falla (CDN bloqueado, offline), resuelve `false` y loguea warning. Permite retry en siguiente mount (`turnstileScriptPromise = null`)

### Comportamiento sin site key

- Si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no esta configurado (ni como prop ni como env var):
  - Loguea warning en consola
  - Renderiza `null` (widget invisible)
  - El formulario puede enviarse sin token Turnstile (el server-side tambien skippea verificacion)

### Callbacks

| Callback | Que hace |
|---|---|
| `onVerify(token)` | Recibe el token verificado. Los formularios lo guardan en estado (`setTurnstileToken`) |
| `onExpire()` | Se dispara a los ~5 min. Los formularios hacen `setTurnstileToken(null)` |
| `onError(error)` | Error del widget. Los formularios hacen `setTurnstileToken(null)` |

### Cleanup

- En unmount, llama `turnstile.remove(widgetId)` para limpiar el widget del DOM
- Flag `mounted` previene actualizaciones de estado post-unmount

---

## 3. CaptchaChallenge Component (`src/components/CaptchaChallenge.tsx`)

### Estado: CODIGO MUERTO

- Usa **hCaptcha** (libreria `@hcaptcha/react-hcaptcha`), NO Cloudflare Turnstile
- Se muestra como Dialog modal con titulo "Quick Verification"
- Valida contra `/api/captcha/verify` que verifica con la API de hCaptcha
- **Nunca se importa ni usa en ningun componente** — grep confirma 0 referencias externas

### API `/api/captcha/verify`

- Verifica tokens hCaptcha contra `https://api.hcaptcha.com/siteverify`
- En caso de exito, setea cookie `pod-captcha-verified=1` (httpOnly, 24h TTL)
- Graceful degradation en dev: si no hay `HCAPTCHA_SECRET_KEY`, acepta cualquier token
- Usa site key de test por defecto: `10000000-ffff-ffff-ffff-000000000001`

### Intencion original

Aparentemente disenado para el flujo de chat (basado en el texto "continue chatting"), pero nunca se conecto. El chat route (`/api/chat`) NO verifica la cookie `pod-captcha-verified`.

---

## 4. Coverage Matrix

| Formulario | TurnstileWidget | Token enviado | API verifica | Rate Limit | Estado |
|---|---|---|---|---|---|
| `RegisterForm.tsx` | SI | SI (`turnstileToken`) | SI (`/api/auth/register`) | SI (3/60min) | **PROTEGIDO** |
| `LoginForm.tsx` | SI | SI (`turnstileToken`) | SI (`/api/auth/login`) | SI (5/15min) | **PROTEGIDO** |
| `ForgotPasswordForm.tsx` | NO | NO | NO | SI (3/60min) | **PARCIAL** — solo rate limit |
| `ResetPasswordForm.tsx` | NO | NO | NO | NO | **DESPROTEGIDO** (requiere access token valido) |
| `ContactForm.tsx` | NO | NO | N/A (no existe API route `/api/contact`) | N/A | **SIN BACKEND** — el form hace POST a una ruta que no existe |
| `NewsletterSignup.tsx` | NO | NO | NO | NO | **PARCIAL** — tiene CSRF token pero no CAPTCHA |
| Chat (`/api/chat`) | NO (tenia hCaptcha planeado) | NO | NO | SI (20/min + velocity) | **PARCIAL** — rate limit + anomaly monitor |
| Checkout (`/api/checkout/*`) | NO | NO | NO | NO | **N/A** — requiere auth + cart session |

### Observaciones criticas

1. **ForgotPasswordForm sin CAPTCHA** — Permite email enumeration bombing (aunque el endpoint no revela si el email existe, si dispara emails via Supabase Auth). El rate limit de 3/60min mitiga parcialmente.
2. **ContactForm sin backend** — El componente hace POST a `/api/contact` que no existe. Retornara 404.
3. **NewsletterSignup sin CAPTCHA** — Solo protegido por CSRF. Un atacante puede hacer spam de suscripciones (cada una genera un email de confirmacion via Resend, consumiendo cuota).

---

## 5. API Routes con Turnstile

| Endpoint | Verifica Turnstile | Rate Limit | Notas |
|---|---|---|---|
| `POST /api/auth/register` | SI (`verifyTurnstileToken`) | SI (3/60min) | Pasa IP como `remoteIp` |
| `POST /api/auth/login` | SI (`verifyTurnstileToken`) | SI (5/15min) | Pasa IP como `remoteIp` |
| `POST /api/auth/forgot-password` | NO | SI (3/60min) | Deberia tener Turnstile |
| `POST /api/auth/reset-password` | NO | NO | Protegido por access token en vez de CAPTCHA |
| `POST /api/newsletter/subscribe` | NO | NO | Deberia tener Turnstile o al menos rate limit |
| `POST /api/chat` | NO | SI (20/min + velocity + anomaly) | Multi-capa de proteccion sin CAPTCHA |
| `POST /api/captcha/verify` | N/A (es el endpoint de hCaptcha) | NO | Endpoint huerfano — nada lo consume |
| `POST /api/checkout/create-session` | NO | NO | Requiere auth (session cookie) |

### Endpoints que deberian verificar Turnstile pero no lo hacen

1. **`/api/auth/forgot-password`** — Vector de abuso: disparar emails masivos a emails aleatorios
2. **`/api/newsletter/subscribe`** — Vector de abuso: inflar lista de suscriptores con emails falsos, consumir cuota de Resend
3. **`/api/contact`** — No existe el endpoint, pero cuando se cree, deberia incluir Turnstile

---

## 6. Configuracion para Desarrollo Local

### Variables de entorno necesarias

```bash
# En .env.local (frontend)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Valores actuales en `.env.local`

Ambas variables estan configuradas con **Cloudflare test keys**:
- `1x00000000000000000000AA` — Test site key que **siempre pasa** el challenge sin interaccion del usuario
- `1x0000000000000000000000000000000AA` — Test secret key que **siempre valida** cualquier token

Estos son los [test keys oficiales de Cloudflare](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) para desarrollo:

| Tipo | Site Key | Secret Key | Comportamiento |
|---|---|---|---|
| Always passes | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` | Widget invisible, siempre OK |
| Always blocks | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` | Siempre falla |
| Forces interactive | `3x00000000000000000000FF` | N/A | Muestra challenge visible |

### En `.env.example` (proyecto raiz)

```
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

Sin valores de ejemplo — el desarrollador debe saber que poner.

### Variables hCaptcha (para CaptchaChallenge — codigo muerto)

```bash
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=   # No configurado en .env.local
HCAPTCHA_SECRET_KEY=              # No configurado en .env.local
# El componente usa test key hardcodeado: 10000000-ffff-ffff-ffff-000000000001
```

---

## 7. Recomendaciones

### CRITICO

1. **Anadir Turnstile a `/api/auth/forgot-password`** — Actualmente solo tiene rate limit (3/60min). Un atacante puede hacer 3 requests por IP por hora, potencialmente desde multiples IPs.

2. **Anadir Turnstile a `/api/newsletter/subscribe`** — Sin rate limit ni CAPTCHA. Vulnerable a spam masivo que consume cuota de Resend y llena la tabla de suscriptores.

3. **Crear o eliminar `/api/contact`** — El `ContactForm.tsx` hace POST a un endpoint que no existe. O se implementa con Turnstile, o se elimina el componente.

### ALTO

4. **Eliminar codigo muerto de hCaptcha** — `CaptchaChallenge.tsx` y `/api/captcha/verify` son codigo muerto. Eliminarlos reduce superficie de ataque y dependencia (`@hcaptcha/react-hcaptcha`).

5. **Alerta en produccion si TURNSTILE_SECRET_KEY falta** — La degradation silenciosa es peligrosa. Deberia loguearse como ERROR (no warn) en `NODE_ENV === 'production'`, o lanzar error al arrancar.

6. **Reemplazar test keys antes de produccion** — Las keys actuales en `.env.local` siempre pasan. Necesitan reemplazarse con keys reales del dashboard de Cloudflare. Anadir check en `start.sh` o health check.

### MEDIO

7. **Rate limit para `/api/newsletter/subscribe`** — Independientemente de Turnstile, deberia tener un rate limiter (ej. 5/hora por IP).

8. **Considerar Turnstile en el chat** — El chat tiene buena proteccion multi-capa (rate limit, velocity check, anomaly monitor, concurrent slots), pero para usuarios anonimos sin fingerprint (`noFpChatLimiter`: solo 5/min), un Turnstile inicial podria ser util.

9. **Token expiracion en formularios** — Los tokens Turnstile expiran a los ~5 minutos. Si el usuario tarda mas en llenar el formulario (especialmente registro), el token expira y `setTurnstileToken(null)`. El formulario permite enviarse con `turnstileToken: undefined`, que el server acepta en degradation mode. Considerar forzar re-render del widget si el token expira.

---

## Archivos Relevantes

| Archivo | Ruta absoluta |
|---|---|
| Server verification | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/turnstile.ts` |
| Client widget | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/auth/TurnstileWidget.tsx` |
| hCaptcha (muerto) | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/CaptchaChallenge.tsx` |
| hCaptcha API (muerto) | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/captcha/verify/route.ts` |
| Register form | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/auth/RegisterForm.tsx` |
| Login form | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/auth/LoginForm.tsx` |
| Forgot password form | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/auth/ForgotPasswordForm.tsx` |
| Reset password form | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/auth/ResetPasswordForm.tsx` |
| Contact form | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/contact/ContactForm.tsx` |
| Newsletter signup | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/components/landing/NewsletterSignup.tsx` |
| Register API | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/auth/register/route.ts` |
| Login API | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/auth/login/route.ts` |
| Forgot password API | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/auth/forgot-password/route.ts` |
| Reset password API | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/auth/reset-password/route.ts` |
| Newsletter API | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/newsletter/subscribe/route.ts` |
| Chat API | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/app/api/chat/route.ts` |
| Anomaly monitor | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/anomaly-monitor.ts` |
| Rate limiters | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/src/lib/rate-limit.ts` |
| Env config | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/.env.local` (lines 47-48) |
| Env example | `/Users/lr0y/POD-AI-PDR/pod_workspace/project/.env.example` (lines 99-100) |
