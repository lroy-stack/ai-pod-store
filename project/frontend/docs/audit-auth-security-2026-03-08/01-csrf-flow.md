# CSRF Flow Analysis — 2026-03-08

## Resumen Ejecutivo

La aplicacion implementa proteccion CSRF con double-submit cookie pattern en el middleware de Next.js, validando tokens en TODAS las peticiones mutacion a `/api/*` (excepto webhooks, admin, cron). Sin embargo, **solo 2 de ~40+ componentes/hooks que hacen peticiones mutacion incluyen el header CSRF**. Esto significa que la gran mayoria de funcionalidades POST/PUT/PATCH/DELETE estan rotas en produccion — el middleware devuelve 403 para cada peticion sin el header `x-csrf-token`.

---

## 1. Modulo CSRF (`src/lib/csrf.ts`)

### Generacion del token

- **Algoritmo**: `crypto.getRandomValues()` (Web Crypto API, compatible con Edge Runtime y Node.js)
- **Longitud**: 32 bytes aleatorios convertidos a hex string = **64 caracteres**
- **Funcion**: `generateCSRFToken()` — sin dependencias externas

### Validacion

- **Patron**: Double-submit cookie — el token se almacena en una cookie (`csrf-token`) y el cliente debe reenviarlo en un header (`x-csrf-token`). El middleware compara ambos valores.
- **Funcion**: `validateCSRFToken(cookieToken, headerToken)` — requiere que ambos esten presentes, misma longitud, y sean identicos.
- **Comparacion**: String comparison simple (`===`), NO timing-safe. El codigo documenta explicitamente que `timingSafeEqual` no esta disponible en Edge Runtime y que timing attacks no son practicos contra tokens de 64 caracteres hex.

### Opciones de cookie

```typescript
CSRF_COOKIE_OPTIONS = {
  httpOnly: false,    // DEBE ser false — el cliente necesita leer la cookie via document.cookie
  secure: true,       // Solo en produccion (HTTPS)
  sameSite: 'strict', // No se envia en peticiones cross-site
  path: '/',          // Disponible en toda la app
  maxAge: 28800,      // 8 horas (8 * 60 * 60)
}
```

**Nota de seguridad**: El nombre de la cookie es `csrf-token` (sin prefijo `__Host-`). El comentario en el codigo menciona el prefijo `__Host-` pero NO lo usa realmente. Esto significa que la cookie no tiene las restricciones adicionales que ofrece `__Host-` (debe ser Secure, sin Domain, Path=/).

### Constantes exportadas

| Constante | Valor |
|---|---|
| `CSRF_COOKIE_NAME` | `'csrf-token'` |
| `CSRF_HEADER_NAME` | `'x-csrf-token'` |
| `requiresCSRFProtection()` | `true` para POST, PUT, PATCH, DELETE |

---

## 2. Middleware Enforcement (`src/middleware.ts`)

### Punto de generacion del token

El token CSRF se genera en el middleware (linea 166-170), **despues** de resolver tenant, i18n, y A/B testing, pero **antes** de la validacion de rutas protegidas (auth):

```
Tenant Resolution → i18n middleware → A/B Testing → CSRF Generation/Validation → Auth (protected routes)
```

Si la cookie `csrf-token` no existe en la request, se genera un token nuevo y se setea en la response cookie. Esto ocurre en **todas las requests** que matchean el middleware matcher.

### Rutas excluidas de validacion CSRF

| Patron | Razon |
|---|---|
| `/api/webhooks/*` | Autenticacion propia (firma del webhook) |
| `/api/admin/*` | Autenticacion propia (admin session/token) |
| `/api/cron/*` | Autenticacion propia (cron secret) |
| Requests GET/HEAD/OPTIONS | No son mutaciones — `requiresCSRFProtection()` retorna false |

### Flujo de validacion (lineas 176-189)

1. Verifica que la ruta sea `/api*`
2. Verifica que el metodo HTTP requiera proteccion (POST/PUT/PATCH/DELETE)
3. Verifica que NO sea webhook, admin, o cron
4. Lee `headerToken` de `request.headers.get('x-csrf-token')`
5. Lee `cookieToken` de `request.cookies.get('csrf-token')`
6. Llama a `validateCSRFToken(cookieToken, headerToken)`
7. Si falla: retorna `403` con body `{ error: 'CSRF token validation failed', message: '...' }`

### Middleware matcher

```typescript
matcher: ['/', '/api/:path*', '/(de|en|es)/:path*', '/((?!_next|_vercel|.*\\..*).*)']
```

Cubre todas las rutas `/api/*`, lo que significa que la validacion CSRF aplica a **todas** las API routes de mutacion (excepto las excluidas arriba).

---

## 3. Componentes con CSRF correcto

| Componente | File:Line | Como envia token |
|---|---|---|
| `NewsletterSignup` | `src/components/landing/NewsletterSignup.tsx:72-84` | Lee cookie con `getCookie(CSRF_COOKIE_NAME)`, envia como `[CSRF_HEADER_NAME]: csrfToken` en headers. Importa constantes de `@/lib/csrf`. Muestra error al usuario si token no existe. |
| `useChatTransport` | `src/hooks/useChatTransport.ts:46-51` | Lee cookie con regex `document.cookie.match(/csrf-token=([^;]*)/)`, envia como `headers.set('x-csrf-token', csrfToken)`. Custom fetch wrapper que aplica a todas las llamadas del AI SDK chat. |

**Total: 2 de ~40+ puntos de mutacion.**

---

## 4. Componentes SIN CSRF (VULNERABLES)

Todos los siguientes componentes hacen `fetch('/api/...', { method: 'POST|PUT|PATCH|DELETE' })` SIN incluir el header `x-csrf-token`. El middleware retornara 403 para cada una de estas llamadas.

### Hooks

| Hook | File:Line | Metodo HTTP | Endpoint |
|---|---|---|---|
| `useCart` | `src/hooks/useCart.tsx:89` | POST | `/api/cart` (add item) |
| `useCart` | `src/hooks/useCart.tsx:138` | PATCH | `/api/cart` (update quantity) |
| `useCart` | `src/hooks/useCart.tsx:176` | PATCH | `/api/cart` (apply coupon) |
| `useCart` | `src/hooks/useCart.tsx:198` | PATCH | `/api/cart` (remove coupon) |
| `useCart` | `src/hooks/useCart.tsx:219` | DELETE | `/api/cart` (remove item) |
| `useWishlist` | `src/hooks/useWishlist.tsx:166` | DELETE | `/api/wishlist/items` |
| `useWishlist` | `src/hooks/useWishlist.tsx:187` | POST | `/api/wishlist` (create) |
| `useWishlist` | `src/hooks/useWishlist.tsx:204` | POST | `/api/wishlist/items` (add item) |
| `useWishlist` | `src/hooks/useWishlist.tsx:266` | POST | `/api/wishlist/sync` |
| `useAuth` | `src/hooks/useAuth.ts:140` | POST | `/api/auth/logout` |
| `useDesignPersistence` | `src/hooks/useDesignPersistence.ts:50` | POST | `/api/designs/save` |
| `usePushNotifications` | `src/hooks/usePushNotifications.ts:43` | POST | `/api/notifications/subscribe` |

### Components — Auth

| Componente | File:Line | Metodo HTTP | Endpoint |
|---|---|---|---|
| `LoginForm` | `src/components/auth/LoginForm.tsx:68` | POST | `/api/auth/login` |
| `LoginForm` | `src/components/auth/LoginForm.tsx:109` | POST | `/api/cart/merge` |
| `LoginForm` | `src/components/auth/LoginForm.tsx:120` | POST | `/api/session/migrate` |
| `RegisterForm` | `src/components/auth/RegisterForm.tsx:101` | POST | `/api/auth/register` |
| `LogoutButton` | `src/components/auth/LogoutButton.tsx:19` | POST | `/api/auth/logout` |
| `ForgotPasswordForm` | `src/components/auth/ForgotPasswordForm.tsx:25` | POST | `/api/auth/forgot-password` |
| `ResetPasswordForm` | `src/components/auth/ResetPasswordForm.tsx:62` | POST | `/api/auth/reset-password` |
| `EmailVerificationHandler` | `src/components/auth/EmailVerificationHandler.tsx:37` | POST | `/api/auth/verify-email` |

### Components — Profile

| Componente | File:Line | Metodo HTTP | Endpoint |
|---|---|---|---|
| `ProfileForm` | `src/components/profile/ProfileForm.tsx:189` | POST | `/api/profile/avatar` |
| `ProfileForm` | `src/components/profile/ProfileForm.tsx:220` | POST | `/api/profile/change-email` |
| `ProfileForm` | `src/components/profile/ProfileForm.tsx:254` | PATCH | `/api/user/profile` |
| `ChangePasswordForm` | `src/components/profile/ChangePasswordForm.tsx:59` | POST | `/api/profile/change-password` |
| `DeleteAccountSection` | `src/components/profile/DeleteAccountSection.tsx:45` | POST | `/api/profile/delete` |
| `DeletionCountdownBanner` | `src/components/profile/DeletionCountdownBanner.tsx:33` | POST | `/api/profile/cancel-deletion` |
| `ShippingAddressList` | `src/components/profile/ShippingAddressList.tsx:69` | DELETE | `/api/shipping-addresses/{id}` |
| `ShippingAddressList` | `src/components/profile/ShippingAddressList.tsx:92` | PUT | `/api/shipping-addresses/{id}` |
| `PaymentMethodsList` | `src/components/profile/PaymentMethodsList.tsx:115` | DELETE | `/api/profile/payment-methods/{id}` |
| `PlanCard` | `src/components/profile/PlanCard.tsx:53` | POST | `/api/subscription/portal` |

### Components — Cart & Checkout

| Componente | File:Line | Metodo HTTP | Endpoint |
|---|---|---|---|
| `CartView` | `src/components/cart/CartView.tsx:116` | PATCH | `/api/cart` |
| `CartView` | `src/components/cart/CartView.tsx:135` | POST | `/api/cart` |
| `CartView` | `src/components/cart/CartView.tsx:173` | POST | `/api/coupons/validate` |
| `CartView` | `src/components/cart/CartView.tsx:221` | POST | `/api/cart/shipping-estimate` |
| `CheckoutView` | `src/components/checkout/CheckoutView.tsx:129` | POST | `/api/checkout/calculate-tax` |
| `CheckoutView` | `src/components/checkout/CheckoutView.tsx:170` | POST | `/api/shipping-addresses` |
| `CheckoutView` | `src/components/checkout/CheckoutView.tsx:248` | POST | `/api/checkout/create-session` |

### Components — Orders & Reviews

| Componente | File:Line | Metodo HTTP | Endpoint |
|---|---|---|---|
| `OrderDetailView` | `src/components/orders/OrderDetailView.tsx:135` | POST | `/api/orders/{id}/returns` |
| `ReviewForm` | `src/components/products/ReviewForm.tsx:86` | POST | `/api/reviews/upload-photos` |
| `ReviewForm` | `src/components/products/ReviewForm.tsx:99` | POST | `/api/reviews` |

### Components — Billing & Subscription

| Componente | File:Line | Metodo HTTP | Endpoint |
|---|---|---|---|
| `BillingSettings` | `src/components/billing/BillingSettings.tsx:55` | POST | `/api/billing/portal` |
| `UpgradeModal` | `src/components/engagement/UpgradeModal.tsx:27` | POST | `/api/subscription/create` |

### Components — Design & Chat

| Componente | File:Line | Metodo HTTP | Endpoint |
|---|---|---|---|
| `DesignPreviewArtifact` | `src/components/artifacts/DesignPreviewArtifact/DesignPreviewArtifact.tsx:59` | POST | `/api/designs/remove-bg` |
| `DesignPreviewArtifact` | `src/components/artifacts/DesignPreviewArtifact/DesignPreviewArtifact.tsx:87` | POST | `/api/designs/mockup` |
| `ChatMessages` | `src/components/storefront/ChatMessages.tsx:201` | POST | `/api/checkout/create-session` |
| `ChatMessages` | `src/components/storefront/ChatMessages.tsx:247` | POST | `/api/orders/{id}/returns` |

### Components — Misc

| Componente | File:Line | Metodo HTTP | Endpoint |
|---|---|---|---|
| `ErrorBoundary` | `src/components/ErrorBoundary.tsx:56` | POST | `/api/errors/report` |
| `CaptchaChallenge` | `src/components/CaptchaChallenge.tsx:19` | POST | `/api/captcha/verify` |
| `ContactForm` | `src/components/contact/ContactForm.tsx:55` | POST | `/api/contact` |
| `DataExportSection` | `src/components/profile/DataExportSection.tsx:16` | POST | `/api/profile/export` |

**Total: ~42 puntos de mutacion SIN CSRF header.**

---

## 5. Analisis de Impacto

### La app esta rota? — SI, parcialmente

El middleware valida CSRF en **todas** las rutas `/api/*` con metodo POST/PUT/PATCH/DELETE (excepto webhooks, admin, cron). Dado que ~42 de ~44 puntos de mutacion NO envian el header `x-csrf-token`, estas llamadas reciben un **403 CSRF token validation failed** del middleware.

### Por que podria "parecer" que funciona

Hay varias explicaciones posibles:

1. **Las unicas funcionalidades que SI funcionan son**: el chat (via `useChatTransport`) y el newsletter signup. Todo lo demas (cart, checkout, login, register, profile, wishlist, orders, reviews, etc.) falla silenciosamente con 403 si el CSRF esta activo en el middleware.

2. **El CSRF se implemento recientemente**: Es probable que la proteccion CSRF se anadio al middleware despues de que la mayoria de componentes ya estaban escritos. Los componentes existentes nunca fueron actualizados para incluir el header.

3. **Testing insuficiente**: Si las pruebas se ejecutan sin middleware (unit tests directos a los route handlers) o en un entorno donde el middleware no esta activo, los 403 no se detectan.

### Impacto por severidad

| Severidad | Funcionalidades afectadas |
|---|---|
| **CRITICO** | Login, Register, Checkout (create-session), Cart (add/update/delete) |
| **ALTO** | Profile update, Change password, Delete account, Shipping addresses, Payment methods |
| **MEDIO** | Wishlist, Reviews, Design save, Order returns, Contact form |
| **BAJO** | Error reporting, Captcha verify, Push notification subscribe |

### Riesgo CSRF real (si se desactiva la validacion para "arreglar")

Si se desactiva la validacion CSRF en el middleware en lugar de arreglar los componentes, las siguientes rutas serian vulnerables a CSRF:
- `/api/profile/delete` — borrar cuenta del usuario
- `/api/checkout/create-session` — crear sesion de pago
- `/api/cart` — manipular carrito
- `/api/auth/logout` — logout forzado (logout CSRF)

La cookie `sameSite: 'strict'` ofrece proteccion parcial, pero no todos los navegadores la respetan al 100%, y no protege contra subdomain attacks (la cookie NO usa prefijo `__Host-`).

---

## 6. Patron de Referencia

### NewsletterSignup.tsx — Patron con imports de constantes

```typescript
// 1. Importar constantes del modulo CSRF
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/csrf'

// 2. Helper para leer cookies
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

// 3. Antes del fetch, leer el token y validar que exista
const csrfToken = getCookie(CSRF_COOKIE_NAME)
if (!csrfToken) {
  toast.error('Security token missing. Please refresh the page.')
  return
}

// 4. Incluir en headers
const res = await fetch('/api/newsletter/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    [CSRF_HEADER_NAME]: csrfToken,
  },
  body: JSON.stringify({ email, locale }),
})
```

### useChatTransport.ts — Patron con regex directa

```typescript
// Dentro de un custom fetch wrapper
const csrfToken = document.cookie.match(
  /(?:^|;\s*)csrf-token=([^;]*)/
)?.[1]
if (csrfToken) {
  headers.set('x-csrf-token', csrfToken)
}
```

### Patron recomendado — Hook reutilizable

La solucion ideal es crear un hook o wrapper de fetch que inyecte automaticamente el CSRF token en todas las peticiones mutacion, evitando tener que modificar cada componente individualmente:

```typescript
// src/lib/api-fetch.ts
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/csrf'

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  return document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  )?.[1] ?? null
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const method = (init?.method ?? 'GET').toUpperCase()

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken)
    }
  }

  return fetch(input, { ...init, headers })
}
```

---

## 7. Recomendaciones

### Urgencia CRITICA — Arreglar ahora

1. **Crear `src/lib/api-fetch.ts`** con un wrapper de fetch que inyecte automaticamente el header CSRF en peticiones mutacion (ver patron recomendado arriba).

2. **Reemplazar todos los `fetch('/api/...')` con metodo mutacion** en componentes y hooks para usar `apiFetch()`. Son ~42 puntos a actualizar.

3. **Alternativa rapida**: Si la migracion de todos los componentes es demasiado costosa a corto plazo, crear un `useApiFetch()` hook que envuelva fetch y se pueda adoptar incrementalmente.

### Prioridad ALTA

4. **Renombrar la cookie a `__Host-csrf-token`** para obtener las protecciones del prefijo `__Host-` (Secure obligatorio, sin Domain, Path=/). El comentario en el codigo ya lo describe pero no lo implementa.

5. **Tests de integracion**: Agregar tests que verifiquen que las peticiones mutacion a `/api/*` sin header CSRF reciben 403. Esto detectaria regresiones futuras.

### Prioridad MEDIA

6. **Considerar timing-safe comparison**: Aunque el argumento de que 64 caracteres hex hacen impractico un timing attack es razonable, seria mas correcto usar `crypto.subtle.timingSafeEqual()` si esta disponible en el Edge Runtime, o una implementacion manual en constante-time.

7. **Rotacion de token**: Actualmente el token tiene un maxAge de 8 horas. Considerar generar un token nuevo despues de cada autenticacion exitosa (login/register) para prevenir session fixation del CSRF token.

8. **Documentar el contrato**: Agregar un comentario en el middleware que indique explicitamente que TODOS los componentes que hacen fetch mutacion deben usar `apiFetch()` o incluir manualmente el header CSRF.
