# Proxy Chain & IP Forwarding Analysis -- 2026-03-08

## Resumen Ejecutivo

La cadena de proxy presenta **dos vulnerabilidades CRITICAL** y **una HIGH**:

1. **CRITICAL -- IP Spoofing via X-Forwarded-For**: Caddy no tiene `trusted_proxies` configurado. No hay Cloudflare integrado a nivel de infraestructura. Cualquier cliente puede enviar `X-Forwarded-For: fake-ip` y el codebase lo acepta sin validacion, bypaseando todo el rate limiting.
2. **CRITICAL -- Cookie `secure: true` puede fallar en produccion**: Si Caddy termina TLS y hace reverse proxy por HTTP interno a Next.js, el servidor ve `NODE_ENV=production` pero la request llega como HTTP. Caddy no inyecta `X-Forwarded-Proto: https`, y Next.js no lo consulta de todas formas -- la logica usa `NODE_ENV` directamente, lo cual funciona, pero es fragil.
3. **HIGH -- Sin Cloudflare trusted_proxies**: El Caddyfile tiene un comentario mencionando el plugin `caddy-cloudflare` pero no esta implementado. Si se pone Cloudflare delante sin configurar `trusted_proxies`, Caddy vera la IP de Cloudflare como cliente real.

---

## 1. Caddy Configuration

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/deploy/Caddyfile`

### 1.1 Reverse Proxy Setup

Caddy actua como unico punto de entrada. Rutea por path:

| Path | Backend | Notas |
|---|---|---|
| `/api/bridge/*` | `podclaw:8000` | `uri strip_prefix /api/bridge` antes de proxear |
| `/panel*` | `admin:3001` | Admin panel (Next.js con basePath=/panel) |
| `/mcp*` | `mcp-server:8002` | MCP Server |
| `/.well-known/oauth-*` | `mcp-server:8002` | OAuth 2.1 discovery |
| `/oauth/*` | `mcp-server:8002` | OAuth endpoints |
| `/*` (default) | `frontend:3000` | Storefront catch-all |

Para custom tenant domains (`:443` block), se usa `on_demand` TLS con verificacion via `GET http://frontend:3000/api/verify-domain?domain=<hostname>`. Rate-limited a 5 certs / 2 min.

### 1.2 SSL/TLS Configuration

**Modo local** (`CADDY_SITE_ADDRESS=http://localhost`):
- HTTP puro, sin TLS
- Caddy en puerto 80, mapeado a `127.0.0.1:8080` en docker-compose.local.yml

**Modo produccion** (`CADDY_SITE_ADDRESS=${DOMAIN}`):
- Caddy usa **auto HTTPS via Let's Encrypt** (ACME automatico)
- Puertos 80 y 443 expuestos directamente al host (sin 127.0.0.1 binding)
- Para custom domains: `on_demand` TLS (Let's Encrypt on-the-fly)
- **No hay Cloudflare origin cert** configurado
- **No hay plugin caddy-cloudflare** instalado (se usa `caddy:2.9-alpine` stock)

### 1.3 Headers & Rewrites

**Security headers aplicados por Caddy** (lineas 67-76):
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- CSP con `unsafe-inline` y `unsafe-eval` (permisivo)
- `-Server` (elimina header Server de Caddy)

**Headers NO configurados**:
- No hay `header_up X-Real-IP {remote_host}` -- Caddy no inyecta IP del cliente
- No hay `header_up X-Forwarded-Proto {scheme}` -- no propaga protocolo
- Caddy si envia `X-Forwarded-For` automaticamente en `reverse_proxy` (comportamiento default), pero no valida la cadena previa

Para custom tenant domains, si se pasa `header_up Host {host}` (linea 92).

### 1.4 Trusted Proxies (Cloudflare)

**Estado: NO CONFIGURADO**

Linea 31 del Caddyfile:
```
# NOTE: For production behind Cloudflare, use a custom Caddy image with
# caddy-cloudflare plugin and add: trusted_proxies cloudflare
```

Esto es solo un comentario. La imagen usada es `caddy:2.9-alpine` (stock, sin plugins). Para integrar Cloudflare se necesitaria:
1. Imagen custom con `xcaddy build --with github.com/caddy-dns/cloudflare`
2. Directiva `trusted_proxies cloudflare` en el site block
3. Sin esto, si Cloudflare esta delante, Caddy tratara la IP de Cloudflare como el cliente

**Rate limiting a nivel Caddy**: NO hay. Todo el rate limiting esta en la capa de aplicacion (Next.js, MCP server).

---

## 2. Docker Network Topology

```
                    INTERNET
                       |
            [Cloudflare -- NO CONFIGURADO]
                       |
              +--------+--------+
              |  Caddy :80/:443 |  (red: proxy)
              +--------+--------+
              |        |        |        |
         frontend  admin   podclaw  mcp-server
          :3000    :3001    :8000     :8002
              |                         |
              +--- (red: data) ---+-----+
              |                   |
            Redis              Redis
            :6379              :6379

         podclaw --- (red: ai-services) --- rembg :8080
                                        --- crawl4ai :11235

         prometheus/grafana/loki --- (red: monitoring)
```

### Flujo de trafico (produccion):

```
Cliente --> DNS --> VPS:80/443 --> Caddy --> frontend/admin/podclaw/mcp-server
```

- **Sin Cloudflare**: El trafico llega directo al VPS. Caddy ve la IP real del cliente.
- **Con Cloudflare** (futuro): `Cliente --> Cloudflare --> VPS:443 --> Caddy`. Sin `trusted_proxies`, Caddy vera IP de Cloudflare, no del cliente.

### Puertos expuestos:

| Modo | Caddy | Frontend | Admin | PodClaw | MCP | Redis |
|---|---|---|---|---|---|---|
| Base (docker-compose.yml) | expose 80,443 | expose 3000 | expose 3001 | expose 8000 | expose 8002 | expose 6379 |
| Local | 127.0.0.1:8080:80 | 127.0.0.1:3000 | 127.0.0.1:3001 | 127.0.0.1:8000 | 127.0.0.1:8002 | 127.0.0.1:6379 |
| Prod | 0.0.0.0:80:80, 0.0.0.0:443:443 | (solo via Caddy) | (solo via Caddy) | (solo via Caddy) | (solo via Caddy) | (no expuesto) |

En produccion, solo Caddy tiene puertos mapeados al host. Los servicios internos solo usan `expose` (accesible solo dentro de Docker networks).

---

## 3. IP Reading in Codebase

### 3.0 Tabla completa de lecturas de IP

| Archivo | Linea | Header(s) usado(s) | Contexto |
|---|---|---|---|
| `frontend/src/lib/rate-limit.ts` | 99-103 | `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for` | `getClientIP()` -- usado por rate limiter central |
| `frontend/src/lib/auth-guard.ts` | 109-114 | `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for` | `getClientIP()` -- usado por auth guard, rechaza localhost en prod |
| `frontend/src/app/api/auth/login/route.ts` | 11 | `x-forwarded-for` | Rate limiting de login |
| `frontend/src/app/api/auth/register/route.ts` | 9 | `x-forwarded-for` | Rate limiting de registro |
| `frontend/src/app/api/auth/forgot-password/route.ts` | 20 | `x-forwarded-for` | Rate limiting de forgot-password |
| `frontend/src/app/api/chat/route.ts` | 64-65 | `x-forwarded-for`, `x-real-ip` | Rate limiting de chat AI |
| `frontend/src/app/api/consent/route.ts` | 11-12 | `x-forwarded-for`, `x-real-ip` | Logging de consentimiento GDPR |
| `frontend/src/app/api/designs/route.ts` | 105 | `x-forwarded-for` | Rate limiting de design generation |
| `frontend/src/app/api/coupons/validate/route.ts` | 7 | `x-forwarded-for` | Rate limiting de validacion de cupones |
| `frontend/src/app/api/checkout/create-session/route.ts` | 32 | `x-forwarded-for` | Rate limiting de checkout |
| `admin/src/lib/rate-limit.ts` | 84-89 | `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for` | `getClientIP()` -- rate limiter del admin |
| `admin/src/lib/auth-middleware.ts` | -- | `x-forwarded-for` (probable) | Admin auth middleware |
| `mcp-server/src/middleware/rate-limit.ts` | 54-66 | `x-forwarded-for`, `x-real-ip`, `socket.remoteAddress` | MCP rate limiter |
| `cloudflare-worker/src/index.ts` | -- | IP via Cloudflare runtime | Solo aplica si el worker esta desplegado |

### 3.1 Patron de lectura de IP

Existen **3 implementaciones diferentes** de `getClientIP()`:

**Patron A** (rate-limit.ts y admin/rate-limit.ts) -- Prioridad: `cf-connecting-ip > x-real-ip > x-forwarded-for[0]`:
```typescript
return cfIp || realIp || forwarded?.split(',')[0] || 'unknown'
```

**Patron B** (auth-guard.ts) -- Mismo orden pero con validacion anti-loopback en produccion:
```typescript
if (process.env.NODE_ENV === 'production') {
  if (raw === '127.0.0.1' || raw === '::1' || raw === 'localhost') return 'unknown'
}
```

**Patron C** (rutas individuales) -- Solo `x-forwarded-for`, sin fallback a otros headers:
```typescript
const ip = request.headers.get('x-forwarded-for') || 'unknown'
```

### 3.2 IP Spoofing Risk Assessment -- CRITICAL

**Escenario de ataque (sin Cloudflare)**:

```
Atacante --> Caddy --> Next.js

Request del atacante:
  X-Forwarded-For: 1.2.3.4

Caddy (default behavior) appends real IP:
  X-Forwarded-For: 1.2.3.4, <real-attacker-ip>

Next.js lee: forwarded?.split(',')[0] = "1.2.3.4"  <-- IP SPOOFED
```

El rate limiter contara las requests contra `1.2.3.4` (inexistente), no contra la IP real del atacante. El atacante puede:
- Enviar un header diferente en cada request (`X-Forwarded-For: random-ip-N`)
- Bypassear completamente todo el rate limiting
- Evadir bloqueos por IP en auth (login, registro, forgot-password)

**Escenario con Cloudflare (futuro)**:

Si se configura Cloudflare delante sin `trusted_proxies`:
```
Atacante --> Cloudflare --> Caddy --> Next.js

Cloudflare sets: CF-Connecting-IP: <real-ip>
Cloudflare sets: X-Forwarded-For: <real-ip>

Caddy appends its own: X-Forwarded-For: <real-ip>, <cloudflare-ip>

Next.js reads cf-connecting-ip = <real-ip>  <-- CORRECTO (Cloudflare header)
```
PERO: sin Cloudflare, un atacante puede enviar `CF-Connecting-IP: fake` directamente, y el codigo lo aceptara como IP real.

**Impacto**:
- Rate limiting completamente bypaseable
- Logs de auditoria con IPs falsas (GDPR consent, login attempts)
- Imposible bloquear atacantes por IP

---

## 4. Next.js Configuration

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/next.config.ts`

### Security headers (lineas 116-137):

Next.js aplica headers de seguridad via `headers()` en la config. Estos son **redundantes** con los de Caddy (se aplican dos veces):
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (Next.js tiene menos restricciones que Caddy -- no bloquea `payment`)
- CSP: Next.js usa `strict-dynamic` en produccion (mas seguro que Caddy que usa `unsafe-eval`)

**Conflicto de CSP**: Caddy y Next.js ambos envian `Content-Security-Policy`. El navegador usara el **mas restrictivo** si hay multiples headers CSP, lo cual puede causar comportamiento inesperado. Deberia definirse en un solo lugar.

### Configuraciones relevantes:

- `output: 'standalone'` -- Para Docker deployment
- **No hay** `serverExternalPackages` ni configuracion de trusted proxies
- **No hay** `x-forwarded-proto` handling
- **No hay** rewrites/redirects relevantes para la cadena de proxy

---

## 5. SSL Chain

### Escenario actual (sin Cloudflare):

```
Cliente (HTTPS) --TLS--> Caddy :443 --HTTP--> Next.js :3000
                          ^                      ^
                    Let's Encrypt cert      Ve request como HTTP
                    Termina TLS aqui        NODE_ENV=production
```

### Analisis por hop:

| Hop | Protocolo | Certificado | Observaciones |
|---|---|---|---|
| Cliente --> Caddy | HTTPS (TLS 1.2/1.3) | Let's Encrypt auto | Caddy maneja ACME automaticamente |
| Caddy --> Next.js | HTTP | N/A (red Docker interna) | Next.js ve la request como HTTP |
| Caddy --> PodClaw | HTTP | N/A | Interno |
| Caddy --> Admin | HTTP | N/A | Interno |
| Caddy --> MCP Server | HTTP | N/A | Interno |

### Cookie `secure` flag -- Funciona pero es fragil:

El patron usado en todo el codebase:
```typescript
secure: process.env.NODE_ENV === 'production'
```

**Archivos que usan este patron** (19+ ubicaciones):
- `middleware.ts` (3 cookies: x-tenant-id, pod-visitor-id, ab-variant-*)
- `api/auth/login/route.ts` (access_token, refresh_token)
- `api/auth/logout/route.ts` (clear cookies)
- `api/auth/session/route.ts` (session refresh)
- `api/cart/route.ts` (guest_cart_id)
- `api/captcha/verify/route.ts` (captcha_verified)
- `lib/csrf.ts` (csrf token)
- `lib/cookie-consent.ts` (consent -- usa string `Secure` hardcoded)

**Esto FUNCIONA** porque la decision de `secure` se basa en `NODE_ENV`, no en el protocolo de la request. Dado que Docker Compose seta `NODE_ENV: production`, las cookies siempre tendran `secure: true` en produccion.

**Riesgo**: Si alguien ejecuta el server en produccion sin TLS delante (e.g., accediendo directamente a `http://host:3000`), las cookies con `secure: true` no se enviaran y la autenticacion fallara silenciosamente.

### Escenario futuro con Cloudflare:

```
Cliente --TLS--> Cloudflare --TLS/HTTP--> Caddy :443 --HTTP--> Next.js :3000
                   ^                        ^
             CF cert (edge)          Let's Encrypt o CF Origin cert
```

**Problema potencial**: Double TLS termination. Si Cloudflare usa "Full (Strict)", necesita que Caddy tenga un cert valido (Let's Encrypt funciona). Si usa "Flexible", Cloudflare envia HTTP a Caddy -- en ese caso Caddy no haria HTTPS y las security headers como HSTS no se aplicarian correctamente.

---

## 6. start.sh Orchestration

**Archivo**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/start.sh`

### Diferencias Local vs Prod:

| Aspecto | `--local` | `--prod` |
|---|---|---|
| Override file | `docker-compose.local.yml` | `docker-compose.prod.yml` |
| CADDY_SITE_ADDRESS | `http://localhost` | `${DOMAIN}` (requerido) |
| Caddy ports | `127.0.0.1:8080:80` | `0.0.0.0:80:80, 0.0.0.0:443:443` |
| Debug ports | Todos en 127.0.0.1 | Solo Caddy expuesto |
| Bridge auth | Disabled | Enabled (`PODCLAW_BRIDGE_AUTH_ENABLED=true`) |
| CORS | localhost origins | Solo `https://${DOMAIN}` |

### Validaciones del script:

- Verifica que Docker y docker compose estan instalados
- Crea `.env` desde `.env.example` si no existe
- Valida 11 variables requeridas (no vacias, no placeholder)
- En modo `--prod`: valida que `DOMAIN` esta seteado y no es `yourdomain.com`
- Valida `GRAFANA_ADMIN_PASSWORD` no sea default
- **No valida** nada relacionado con Cloudflare, proxies, o SSL

### Fases de arranque:

1. Infraestructura: redis, rembg, crawl4ai (espera health checks)
2. Aplicacion: podclaw, frontend, admin, mcp-server
3. Reverse proxy: caddy (depende de todos los anteriores)
4. Monitoring (opcional, si `ENABLE_MONITORING=true`): prometheus, grafana, loki

---

## 7. Recomendaciones

### CRITICAL (resolver antes de produccion)

| # | Issue | Solucion |
|---|---|---|
| C1 | IP Spoofing -- rate limiting bypaseable | Configurar `trusted_proxies` en Caddy. Sin Cloudflare: `trusted_proxies private_ranges`. Con Cloudflare: build custom image con plugin y usar `trusted_proxies cloudflare` |
| C2 | `CF-Connecting-IP` aceptado sin Cloudflare | Si no hay Cloudflare delante, NO leer `cf-connecting-ip`. Ese header solo es confiable si Cloudflare es el unico que lo puede setear. Agregar logica condicional: `const BEHIND_CLOUDFLARE = process.env.BEHIND_CLOUDFLARE === 'true'` |
| C3 | 6 rutas usan solo `x-forwarded-for` sin `getClientIP()` | Estandarizar: login, register, forgot-password, designs, coupons/validate, checkout/create-session deben usar `getClientIP()` de rate-limit.ts en vez de leer el header directamente |

### HIGH

| # | Issue | Solucion |
|---|---|---|
| H1 | CSP duplicado (Caddy + Next.js) | Definir CSP en un solo lugar. Recomendacion: mantenerlo en Next.js (donde puede ser dinamico con nonces) y eliminar el CSP de Caddy |
| H2 | Sin `X-Forwarded-Proto` | Caddy deberia enviar `header_up X-Forwarded-Proto {scheme}` a los backends. Aunque ahora no se usa, librerias futuras o middleware podrian depender de el |
| H3 | Caddy prod expone 80/443 a 0.0.0.0 sin firewall | Si se usa Cloudflare, configurar firewall (iptables/ufw) para solo aceptar trafico en 80/443 desde rangos de IP de Cloudflare. Sin esto, atacantes pueden bypassear Cloudflare accediendo directamente al VPS |

### MEDIUM

| # | Issue | Solucion |
|---|---|---|
| M1 | Sin rate limiting en Caddy | Agregar `rate_limit` directive en Caddy para proteccion a nivel de proxy (antes de que la request llegue a Next.js) |
| M2 | `getClientIP()` tiene 3 implementaciones distintas | Crear un unico modulo compartido o al menos asegurar que todas usan la misma logica |
| M3 | On-demand TLS sin rate limiting agresivo | 5 certs/2min puede ser abusado para generar certs fraudulentos. Considerar bajar a 2 certs/5min y agregar validacion mas estricta en `/api/verify-domain` |

### LOW

| # | Issue | Solucion |
|---|---|---|
| L1 | Security headers duplicados | Next.js y Caddy envian los mismos headers (HSTS, X-Frame-Options, etc.). No es danino pero genera ruido. Mantener en un solo lugar |
| L2 | cookie-consent.ts usa `Secure` hardcoded | Deberia seguir el patron `secure: process.env.NODE_ENV === 'production'` como el resto del codebase |

---

## Apendice A: Cloudflare Worker (MCP Proxy)

Existe un Cloudflare Worker en `/Users/lr0y/POD-AI-PDR/pod_workspace/project/cloudflare-worker/src/index.ts` que actua como proxy para el MCP server. Este worker:
- Aplica rate limiting por IP (via Cloudflare KV o in-memory)
- Filtra metodos JSON-RPC permitidos (whitelist)
- Agrega DDoS protection de Cloudflare
- Solo aplica al path `/mcp`, no al storefront

Este worker es **independiente** de la configuracion de Caddy/Docker. Si se despliega, el flujo para MCP seria:
```
Cliente --> Cloudflare Worker --> Origin (VPS:443) --> Caddy --> mcp-server:8002
```
Pero el storefront seguiria sin Cloudflare protection a menos que se configure por separado.
