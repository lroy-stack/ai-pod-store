# Security Headers & Cache Control Analysis — 2026-03-08

## Resumen Ejecutivo

La aplicacion tiene una configuracion de security headers **solida** en Next.js (`next.config.ts`) con CSP, HSTS, X-Frame-Options y Permissions-Policy. Sin embargo, existen **problemas criticos**:

1. **Duplicacion de headers con conflicto** entre Next.js y Caddy — las CSP son diferentes, causando headers duplicados y comportamiento impredecible en navegadores.
2. **API routes sensibles sin Cache-Control explicito** — `/api/user/profile`, `/api/orders`, `/api/cart`, `/api/wishlist/*`, `/api/conversations/*` no establecen `Cache-Control: no-store`. Dependen de `force-dynamic` (presente solo en profile y payment-methods) o de la heuristica de Next.js. Si Cloudflare u otro CDN cachea estas respuestas, datos de un usuario se filtran a otro.
3. **CORS demasiado abierto en proxy-image** — `Access-Control-Allow-Origin: *` en `/api/proxy-image` permite SSRF limitado (mitigado por allowlist de dominios).
4. **CORS solo en 5 de ~90 API routes** — la mayoria de routes no tiene headers CORS, lo cual es correcto para same-origin pero problematico si se necesita acceso cross-origin desde admin (port 3001).
5. **XSS bien mitigado** — `SafeHTML`, `SafeMarkdown` con DOMPurify, CSS sanitization en theme-server. Los usos de `dangerouslySetInnerHTML` restantes son JSON-LD (seguros) y theme CSS (sanitizado).

**Severidad global**: MEDIA-ALTA (el riesgo de cache leak en CDN es el mas critico)

---

## 1. Security Headers

### 1.1 Next.js Config Headers (`next.config.ts:116-137`)

Aplicados a **todas las rutas** via `source: '/:path*'`:

| Header | Valor | Estado |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | OK |
| `X-Frame-Options` | `DENY` | OK |
| `X-XSS-Protection` | `1; mode=block` | OK (legacy, redundante con CSP) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | OK (falta `preload`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | OK |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | OK (falta `payment=()`) |
| `Content-Security-Policy` | Ver seccion 1.1.1 | Parcialmente OK |

#### 1.1.1 CSP — Production

```
default-src 'self';
script-src 'self' 'strict-dynamic';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com;
img-src 'self' data: blob: https://images.printify.com https://images-api.printify.com
        https://pfy-prod-image-storage.s3.us-east-2.amazonaws.com https://*.supabase.co
        https://via.placeholder.com https://placehold.co https://*.fal.ai https://fal.media
        https://images.unsplash.com https://files.cdn.printful.com;
connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com
            https://*.fal.ai https://images-api.printify.com https://api.printify.com;
font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com;
frame-ancestors 'none'
```

**Problemas CSP Production**:
- Falta `frame-src` para Stripe (`https://js.stripe.com https://hooks.stripe.com`) — Stripe checkout iframe se bloqueara
- Falta `object-src 'none'` (recomendado por OWASP)
- Falta `base-uri 'self'` (recomendado para prevenir base tag injection)
- `connect-src` no incluye `https://api.stripe.com` — las llamadas fetch a Stripe fallaran
- `wss://*.supabase.co` no esta en production `connect-src` — Realtime subscriptions fallaran

#### 1.1.2 CSP — Development

Incluye `'unsafe-inline' 'unsafe-eval'` en script-src (necesario para Turbopack). Tambien incluye `ws://localhost:*` y `wss://*.supabase.co` en connect-src. Correcto para dev.

### 1.2 Caddy Headers (`deploy/Caddyfile:67-76, 96-105`)

Caddy aplica security headers **identicos** en ambos bloques de servidor (primary domain y custom domains):

| Header | Valor Caddy | Valor Next.js | Conflicto |
|---|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Identico | Duplicado (inofensivo) |
| `X-Content-Type-Options` | `nosniff` | Identico | Duplicado (inofensivo) |
| `X-Frame-Options` | `DENY` | Identico | Duplicado (inofensivo) |
| `X-XSS-Protection` | `1; mode=block` | Identico | Duplicado (inofensivo) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Identico | Duplicado (inofensivo) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Sin `payment=()` | **Diferente** |
| `Content-Security-Policy` | Ver abajo | Ver arriba | **CONFLICTO CRITICO** |
| `-Server` | (remove) | N/A | OK — oculta Caddy version |

#### 1.2.1 CSP Caddy vs Next.js — Conflicto

La CSP de Caddy es **completamente diferente** de la de Next.js:

```
# Caddy CSP:
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';    # MAS PERMISIVO que Next.js production
style-src 'self' 'unsafe-inline';                     # Sin Google Fonts
img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com;  # Menos fuentes de imagen
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com
            https://generativelanguage.googleapis.com;  # Incluye Stripe (falta en Next.js)
font-src 'self';                                      # Sin Google Fonts
frame-src https://js.stripe.com https://hooks.stripe.com;  # Stripe frames (falta en Next.js)
object-src 'none';                                    # Presente (falta en Next.js)
base-uri 'self'                                       # Presente (falta en Next.js)
```

**Comportamiento con headers duplicados**: Cuando Caddy y Next.js ambos envian `Content-Security-Policy`, el navegador recibe **dos** CSP headers. El navegador aplica la **interseccion** (la mas restrictiva de ambas). Esto significa:
- Las imagenes de Printify/Printful seran **bloqueadas** (Caddy no las permite en img-src)
- Google Fonts sera **bloqueado** (Caddy no los permite en font-src/style-src)
- `'strict-dynamic'` de Next.js sera anulado por Caddy's `'unsafe-inline' 'unsafe-eval'` de forma impredecible

**Esto es un BUG ACTIVO en produccion**.

### 1.3 Headers Ausentes

| Header | Importancia | Donde Falta |
|---|---|---|
| `X-Permitted-Cross-Domain-Policies: none` | Baja | Ambos |
| `Cross-Origin-Opener-Policy: same-origin` | Media | Ambos |
| `Cross-Origin-Embedder-Policy: require-corp` | Media | Ambos |
| `Cross-Origin-Resource-Policy: same-origin` | Media | Ambos |
| HSTS `preload` flag | Media | Ambos (`max-age` OK pero sin `preload`) |
| `Permissions-Policy: payment=()` | Baja | Next.js (Caddy lo tiene) |

---

## 2. Cache Control — API Routes

### 2.1 Routes con Cache-Control Explicito

| API Route | Cache-Control | Tipo de Dato | OK |
|---|---|---|---|
| `/api/storefront/theme` | `public, max-age=300` | Publico (tema) | OK |
| `/api/storefront/branding` | `public, max-age=300` | Publico (branding) | OK |
| `/api/storefront/personalization-surcharge` | `public, max-age=300` | Publico (precio) | OK |
| `/api/proxy-image` | `public, max-age=86400, s-maxage=604800` | Publico (imagen) | OK |
| `/api/metrics` | `no-cache, no-store, must-revalidate` | Interno | OK |

### 2.2 Routes con `force-dynamic` pero SIN Cache-Control Explicito

Estas routes usan `export const dynamic = 'force-dynamic'` lo que hace que Next.js las trate como dinamicas y NO las cachee internamente. Sin embargo, **no envian `Cache-Control: no-store` en la respuesta HTTP**, lo que significa que un CDN (Cloudflare, Fastly) o un proxy intermedio **podria cachear las respuestas**.

| API Route | force-dynamic | Cache-Control Header | Dato Sensible | Riesgo |
|---|---|---|---|---|
| `/api/user/profile` | SI | **NINGUNO** | Email, nombre, telefono | **CRITICO** |
| `/api/profile/payment-methods` | SI | **NINGUNO** | Metodos de pago | **CRITICO** |
| `/api/profile/payment-methods/[id]` | SI | **NINGUNO** | Metodo de pago individual | **CRITICO** |
| `/api/notifications/*` (5 routes) | SI | **NINGUNO** | Notificaciones del usuario | ALTO |
| `/api/products/[id]/social-proof` | SI | **NINGUNO** | Social proof data | BAJO |
| `/api/products/[id]/cross-sell` | SI | **NINGUNO** | Cross-sell recs | BAJO |
| `/api/products/trending` | SI | **NINGUNO** | Trending products | BAJO |
| `/api/products` | SI | **NINGUNO** | Catalogo publico | BAJO |
| `/api/categories/*` (2 routes) | SI | **NINGUNO** | Categorias publicas | BAJO |
| `/api/storefront/branding` | SI | `public, max-age=300` | Publico | OK |
| `/api/verify-domain` | SI | **NINGUNO** | Verificacion dominio | BAJO |
| `/api/tenant/gate` | SI | **NINGUNO** | Tenant config | BAJO |
| `/api/tenant-resolve` | SI | **NINGUNO** | Tenant ID | MEDIO |
| `/api/rag/*` (5 routes) | SI | **NINGUNO** | Datos RAG internos | MEDIO |
| `/api/webhooks/cache-invalidate` | SI | **NINGUNO** | Webhook interno | BAJO |

### 2.3 Routes SIN `force-dynamic` NI Cache-Control (datos sensibles)

Estas routes son las mas peligrosas: no tienen `force-dynamic` ni `Cache-Control`. Next.js **podria** tratarlas como estaticas (si no detecta uso dinamico), y un CDN definitivamente podria cachearlas.

| API Route | force-dynamic | Cache-Control | Dato Sensible | Riesgo |
|---|---|---|---|---|
| `/api/orders` | NO | **NINGUNO** | Historial de pedidos | **CRITICO** |
| `/api/orders/[id]` | NO | **NINGUNO** | Detalle de pedido | **CRITICO** |
| `/api/orders/[id]/invoice` | NO | **NINGUNO** | Factura | **CRITICO** |
| `/api/orders/[id]/returns` | NO | **NINGUNO** | Devolucion | **CRITICO** |
| `/api/orders/[id]/reorder` | NO | **NINGUNO** | Reorden | ALTO |
| `/api/cart` | NO | **NINGUNO** | Carrito del usuario | **CRITICO** |
| `/api/cart/shipping-estimate` | NO | **NINGUNO** | Estimacion envio | MEDIO |
| `/api/wishlist/items` | NO | **NINGUNO** | Lista de deseos | ALTO |
| `/api/wishlist/sync` | NO | **NINGUNO** | Sync wishlist | ALTO |
| `/api/wishlist/share` | NO | **NINGUNO** | Compartir wishlist | MEDIO |
| `/api/conversations` | NO | **NINGUNO** | Chat del usuario | **CRITICO** |
| `/api/conversations/[id]` | NO | **NINGUNO** | Conversacion individual | **CRITICO** |
| `/api/profile/change-password` | NO | **NINGUNO** | Cambio contrasena | ALTO |
| `/api/profile/change-email` | NO | **NINGUNO** | Cambio email | ALTO |
| `/api/profile/delete` | NO | **NINGUNO** | Eliminacion cuenta | ALTO |
| `/api/profile/cancel-deletion` | NO | **NINGUNO** | Cancelar eliminacion | ALTO |
| `/api/profile/avatar` | NO | **NINGUNO** | Avatar usuario | MEDIO |
| `/api/profile/export` | NO | **NINGUNO** | Exportacion datos GDPR | **CRITICO** |
| `/api/shipping-addresses/[id]` | SI | **NINGUNO** | Direcciones | **CRITICO** |
| `/api/auth/session` | NO | **NINGUNO** | Session tokens | **CRITICO** |
| `/api/referral` | NO | **NINGUNO** | Codigo referido | MEDIO |
| `/api/reviews` | NO | **NINGUNO** | Reviews usuario | MEDIO |
| `/api/designs/*` | NO | **NINGUNO** | Disenos del usuario | ALTO |

### 2.4 Cloudflare Caching Risk

**Escenario de ataque**: Si la aplicacion esta detras de Cloudflare (mencionado en Caddyfile comentarios):

1. Usuario A hace GET `/api/user/profile` → Cloudflare cachea la respuesta (no hay `Cache-Control: no-store`, no hay `private`)
2. Usuario B hace GET `/api/user/profile` → Cloudflare devuelve el perfil de Usuario A
3. **Resultado**: Leak de datos personales (email, nombre, telefono, metodos de pago)

**Mitigacion actual**: NINGUNA. Las routes dependen de que Next.js no cachee internamente (via `force-dynamic` donde existe), pero esto NO afecta a CDNs externos.

**Solucion requerida**: Todas las routes que devuelven datos autenticados deben enviar:
```
Cache-Control: private, no-store, no-cache, must-revalidate
Vary: Cookie
```

---

## 3. Cache Control — Pages

| Page | Ruta | Tipo | `revalidate` | Riesgo |
|---|---|---|---|---|
| Shop (producto grid) | `(app)/shop/page.tsx` | ISR | `revalidate = 300` (5 min) | OK — datos publicos |
| Categoria | `(app)/shop/category/[slug]/page.tsx` | ISR | `revalidate = 600` (10 min) | OK — datos publicos |
| Producto detalle | `(app)/shop/[id]/page.tsx` | ISR | `revalidate = 3600` (1 hora) | OK — datos publicos |
| Landing | `(landing)/page.tsx` | Sin export | Dinamico (server components) | OK |
| Profile | `(app)/profile/` | Sin export | Dinamico (auth-protected) | OK — middleware redirige a login |
| Orders | `(app)/orders/` | Sin export | Dinamico (auth-protected) | OK — middleware redirige a login |
| Wishlist | `(app)/wishlist/` | Sin export | Dinamico (auth-protected) | OK — middleware redirige a login |
| Blog post | `(app)/blog/[slug]/page.tsx` | Sin export | Dinamico | OK |
| FAQ | `(focused)/faq/page.tsx` | Sin export | Dinamico | OK |

**Las paginas estan bien configuradas**: las paginas publicas tienen ISR con revalidacion razonable, y las paginas autenticadas no tienen cache exports y estan protegidas por middleware de autenticacion.

---

## 4. CORS Configuration

### 4.1 CORS Library (`src/lib/cors.ts`)

- **Origenes permitidos**: `BASE_URL`, `http://localhost:3000`, `http://localhost:3001` (admin)
- **Metodos**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, X-Requested-With
- **Credentials**: `true` (permite cookies cross-origin)
- **Max-Age**: 86400 (24h preflight cache)
- **Validacion**: Compara `origin` contra allowlist. Si no coincide, usa `BASE_URL` como fallback.

**Problema**: El fallback a `BASE_URL` cuando el origin no esta en la allowlist significa que la respuesta SIEMPRE incluye `Access-Control-Allow-Origin: <algun_valor>`. Deberia **omitir** el header para origins no permitidos.

### 4.2 Routes con CORS

Solo **5 de ~90 API routes** importan `getCorsHeaders`:

| Route | CORS | Justificacion |
|---|---|---|
| `/api/ping` | Allowlist | Health check cross-origin |
| `/api/health` | Allowlist | Health check cross-origin |
| `/api/categories` | Allowlist | Admin panel accede desde :3001 |
| `/api/categories/[slug]` | Allowlist | Admin panel accede desde :3001 |
| `/api/test-rate-limit` | Allowlist | Testing |

### 4.3 CORS Abierto (`*`)

| Route | CORS | Riesgo |
|---|---|---|
| `/api/proxy-image` | `Access-Control-Allow-Origin: *` | BAJO — allowlist de dominios limita a Printful/Printify CDN |

### 4.4 Multi-tenant CORS

No hay configuracion CORS especifica para custom domains de tenants. Si un tenant tiene `custom-store.com` y hace fetch a la API en `skapara.com/api/...`, las requests seran bloqueadas por CORS porque `custom-store.com` no esta en la allowlist.

**Solucion necesaria**: La CORS lib deberia aceptar dominios de tenants verificados (consultar `tenants.domain` en la DB o cache).

---

## 5. Multi-tenant Cache Safety

### 5.1 Domain Resolution Caching

**Flujo de resolucion** (`middleware.ts:47-77`):

1. Middleware lee cookie `x-tenant-id` (TTL: 5 min, httpOnly, secure en prod, sameSite: lax)
2. Si no hay cookie y no es dominio primario: fetch interno a `/api/tenant-resolve?domain=<hostname>`
3. `/api/tenant-resolve` consulta Redis cache (TTL: 5 min) → si miss, consulta Supabase `tenants` table
4. Resultado se guarda en Redis y en cookie `x-tenant-id`
5. El tenant_id se propaga via header `x-tenant-id` a las API routes

**Seguridad del cache**:
- Cookie `x-tenant-id` es `httpOnly: true` — no legible por JavaScript (bueno)
- Cookie `sameSite: 'lax'` — se envia en navegacion top-level pero no en iframes/fetch cross-site (bueno)
- Redis cache es por dominio (`tenant:resolve:<domain>`) — no hay colision entre tenants (bueno)
- Negative results se cachean tambien (previene hammering) (bueno)

### 5.2 Cache Poisoning Risk

**Riesgo MEDIO**: Si un atacante puede influir en el header `Host` de una request:

1. Request con `Host: attacker-controlled.com` → middleware resuelve tenant_id de atacante
2. Si Cloudflare cachea la pagina con ese tenant_id → otros usuarios ven datos del tenant atacante
3. **Mitigacion actual**: Caddy pasa `Host {host}` al frontend (linea 92), y la resolucion de tenant es por cookie/Redis, no por cache de pagina. Sin embargo, si Next.js ISR cachea una pagina de producto, el `x-tenant-id` header no participa en la cache key.

**Escenario especifico**:
- Las paginas con `revalidate` (shop, category, product) generan HTML cacheado por Next.js ISR
- Si la query de productos filtra por `tenant_id` (via header), el ISR cache podria servir productos del tenant A al tenant B
- **Mitigacion necesaria**: Incluir `Vary: x-tenant-id` en respuestas de paginas con ISR, o usar `dynamicParams` con validacion de tenant

**Riesgo de cookie `x-tenant-id`**:
- Cookie tiene `maxAge: 300` (5 min) — si el usuario cambia de dominio de tenant, recibira datos del tenant anterior durante 5 min
- No hay mecanismo para invalidar la cookie al cambiar de dominio

---

## 6. XSS Vectors

### 6.1 `dangerouslySetInnerHTML` — Inventario Completo

| Archivo | Linea | Contenido | Sanitizado | Riesgo |
|---|---|---|---|---|
| `components/common/SafeHTML.tsx` | 57 | HTML arbitrario | SI (DOMPurify) | BAJO |
| `[locale]/layout.tsx` | 78 | Theme CSS inline | SI (`sanitizeCSSValue()` en `theme-server.ts`) | BAJO |
| `(landing)/page.tsx` | 184, 188 | JSON-LD (organization, website) | Seguro (`JSON.stringify` de datos controlados) | NINGUNO |
| `(app)/blog/[slug]/page.tsx` | 118 | JSON-LD (blog post) | Seguro (`JSON.stringify`) | BAJO — si el blog acepta UGC |
| `(app)/shop/page.tsx` | 258, 444 | JSON-LD (categories, products) | Seguro (`JSON.stringify` de datos DB) | BAJO |
| `(app)/shop/[id]/page.tsx` | 183, 188 | JSON-LD (product, breadcrumb) | Seguro (`JSON.stringify`) | BAJO |
| `(app)/shop/category/[slug]/page.tsx` | 348 | JSON-LD (item list) | Seguro (`JSON.stringify`) | BAJO |
| `(focused)/faq/page.tsx` | 116 | JSON-LD (FAQ) | Seguro (`JSON.stringify` de datos estaticos) | NINGUNO |

### 6.2 ReactMarkdown / SafeMarkdown

| Archivo | Sanitizado | Detalle |
|---|---|---|
| `components/common/SafeMarkdown.tsx` | SI | DOMPurify con `ALLOWED_TAGS` y `ALLOWED_ATTR` restrictivos |
| SSR fallback | NO | `getDOMPurify()` retorna `null` en servidor → devuelve `children` sin sanitizar |

**Riesgo SSR**: Durante SSR, `SafeMarkdown` **no sanitiza** el contenido (DOMPurify es browser-only). Si el contenido markdown viene de input del usuario (DB), un atacante podria inyectar HTML que se renderiza en el HTML del servidor. La hidratacion en cliente re-sanitizaria, pero el HTML inicial del servidor contendria el payload XSS.

**Mitigacion**: El comentario dice "content is from our DB, not user input" — pero si algun admin inserta contenido malicioso en la DB (compromiso de admin), el SSR lo renderizaria sin sanitizar.

### 6.3 Theme CSS Injection (`theme-server.ts:92-100`)

La funcion `sanitizeCSSValue()` valida que los valores CSS:
- No contengan `<`, `>`, `"`, `'`, `;`, `{`, `}`
- No contengan keywords como `script`, `javascript`, `expression`, `url`
- Solo contengan caracteres alfanumericos, `#`, `%`, `()`, `.`, espacio, `-`, `/`, `,`

**Evaluacion**: Robusto. Previene inyeccion de CSS malicioso via `dangerouslySetInnerHTML` en el tema. Un atacante que controle `store_themes.css_variables` no podria inyectar HTML.

### 6.4 JSON-LD Injection Risk

Los JSON-LD schemas usan `JSON.stringify()` de datos que provienen de la base de datos. Si un producto tiene un `title` como `</script><script>alert(1)</script>`, `JSON.stringify` lo escaparia como `"<\/script><script>alert(1)<\/script>"`. Sin embargo, `JSON.stringify` **no escapa** `</script>` por defecto en todos los engines.

**Riesgo BAJO**: En la practica, Next.js RSC serializa correctamente el HTML. Pero seria mas seguro usar una funcion de escape dedicada para JSON-LD en contexto `<script>`.

---

## 7. Recomendaciones

### CRITICA (P0) — Implementar inmediatamente

1. **Unificar CSP entre Next.js y Caddy**: Eliminar la CSP de Caddy (`Caddyfile:74, 103`) y dejar que solo Next.js la gestione. O al reves: eliminar CSP de Next.js y centralizar en Caddy. No ambos. La duplicacion causa bloqueo de recursos (imagenes, fonts, Stripe, Realtime).

2. **Agregar `Cache-Control: private, no-store` a todas las API routes autenticadas**: Crear un helper `noCacheHeaders()` y aplicarlo a las respuestas de:
   - `/api/user/profile`
   - `/api/orders/*`
   - `/api/cart/*`
   - `/api/wishlist/*`
   - `/api/conversations/*`
   - `/api/profile/*`
   - `/api/auth/session`
   - `/api/shipping-addresses/*`
   - `/api/notifications/*`
   - `/api/designs/*`

3. **Agregar `export const dynamic = 'force-dynamic'` a routes autenticadas que lo carecen**: `/api/orders`, `/api/cart`, `/api/wishlist/*`, `/api/conversations/*`, `/api/profile/*` (excepto payment-methods que ya lo tiene), `/api/auth/session`, `/api/designs/*`.

### ALTA (P1) — Implementar esta semana

4. **Arreglar CSP de produccion en Next.js**: Agregar `frame-src https://js.stripe.com https://hooks.stripe.com`, `object-src 'none'`, `base-uri 'self'`, `wss://*.supabase.co` en `connect-src`, y `https://api.stripe.com` en `connect-src`.

5. **CORS para custom domains de tenants**: Modificar `cors.ts` para aceptar dominios de tenants verificados. Consultar Redis cache de `tenant:resolve:*` para validar origins.

6. **Eliminar fallback CORS**: En `getCorsHeaders()`, si el origin no esta en allowlist, NO devolver `Access-Control-Allow-Origin`. Devolver headers vacios o sin el header ACAO.

7. **Agregar `Vary: Cookie` a respuestas autenticadas**: Para que CDNs que respetan `Vary` no sirvan respuestas cacheadas a otros usuarios.

### MEDIA (P2) — Implementar este sprint

8. **SSR sanitization para SafeMarkdown**: Implementar un sanitizador server-side (sin DOMPurify) como fallback, o usar `sanitize-html` que funciona en Node.js.

9. **Agregar headers COOP/COEP/CORP**: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` (cuidado: puede romper iframes de Stripe).

10. **HSTS preload**: Agregar `preload` a HSTS header y registrar dominio en hstspreload.org cuando este en produccion.

11. **Multi-tenant ISR cache safety**: Agregar `Vary: x-tenant-id` en respuestas de paginas ISR, o desactivar ISR para paginas que filtran por tenant.

12. **CSRF cookie prefix**: Renombrar `csrf-token` a `__Host-csrf-token` para activar protecciones del browser (Secure, no Domain, Path=/).

### BAJA (P3) — Nice to have

13. **JSON-LD escaping**: Usar una funcion dedicada que escape `</script>` dentro de `JSON.stringify` para JSON-LD.

14. **Agregar `X-Permitted-Cross-Domain-Policies: none`** en Next.js headers.

15. **Revisar cookie `x-tenant-id` TTL**: Considerar reducir de 5 min a 1 min, o invalidar al detectar cambio de hostname.
